import { ACCOUNT_ID_RX } from './analytics-engine';
import {
  analyticsWindows,
  firstGraphqlError,
  readAccount,
  serialiseWindows,
} from './cloudflare-analytics-model';
import {
  dailyPoint,
  hourlyExceptionPoints,
  statusPoints,
  windowPoint,
  workerPoints,
} from './cloudflare-analytics-points';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult, DataPoint } from './types';

type CloudflareAnalyticsConfig = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly days?: number;
};

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

// Every user-influenced input is a GraphQL variable, so there is no
// query-string interpolation and no injection surface.
const QUERY = `query FleetAnalytics(
  $account: String!
  $trendStart: Time!
  $trendEnd: Time!
  $previousStart: Time!
  $currentStart: Time!
  $end: Time!
) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      daily: workersInvocationsAdaptive(
        limit: 1000
        filter: { datetime_geq: $trendStart, datetime_lt: $trendEnd }
        orderBy: [date_ASC]
      ) {
        sum { requests errors }
        dimensions { date }
      }
      current: workersInvocationsAdaptive(
        limit: 1000
        filter: { datetime_geq: $currentStart, datetime_lt: $end }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests errors }
        dimensions { scriptName status }
      }
      previous: workersInvocationsAdaptive(
        limit: 1000
        filter: { datetime_geq: $previousStart, datetime_lt: $currentStart }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests errors }
        dimensions { scriptName status }
      }
      hourly: workersInvocationsAdaptive(
        limit: 10000
        filter: { datetime_geq: $currentStart, datetime_lt: $end }
        orderBy: [datetimeHour_ASC]
      ) {
        sum { requests errors }
        dimensions { datetimeHour scriptName status }
      }
    }
  }
}`;

export const cloudflareAnalytics: Adapter<CloudflareAnalyticsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const accountId = config.accountId.trim();
  const apiToken = config.apiToken.trim();
  const days = normaliseDays(config.days);

  if (!ACCOUNT_ID_RX.test(accountId)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid account id' } };
  }
  if (apiToken.length === 0) {
    return { ok: false, error: { code: 'unauthorized', message: 'missing analytics API token' } };
  }

  const windows = analyticsWindows(new Date(), days);
  const body = JSON.stringify({
    query: QUERY,
    variables: {
      account: accountId,
      trendStart: windows.trend.start.toISOString(),
      trendEnd: windows.trend.end.toISOString(),
      previousStart: windows.previous.start.toISOString(),
      currentStart: windows.current.start.toISOString(),
      end: windows.current.end.toISOString(),
    },
  });

  let response: Response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: { code: 'unauthorized', message: `Cloudflare GraphQL HTTP ${response.status}` },
    };
  }
  if (response.status === 429) {
    return { ok: false, error: { code: 'rate_limited', message: 'Cloudflare GraphQL rate limit' } };
  }
  if (!response.ok) {
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }

  // GraphQL answers query and permission failures with HTTP 200 plus an
  // `errors` array, so a bare status check would read them as success.
  const graphqlError = firstGraphqlError(payload);
  if (graphqlError !== null) {
    const unauthorized = /auth|permission|denied|forbidden/i.test(graphqlError);
    return {
      ok: false,
      error: { code: unauthorized ? 'unauthorized' : 'parse_failed', message: graphqlError },
    };
  }

  const account = readAccount(payload);
  if (account === undefined) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected GraphQL payload' } };
  }

  const points: DataPoint[] = [
    ...account.daily.map(dailyPoint),
    ...workerPoints(account.current, 'current', windows.current, 'worker'),
    ...workerPoints(account.previous, 'previous', windows.previous, 'worker-comparison'),
    ...statusPoints(account.current, 'current', windows.current),
    ...statusPoints(account.previous, 'previous', windows.previous),
    ...hourlyExceptionPoints(account.hourly),
    windowPoint(account.current, 'current', windows.current),
    windowPoint(account.previous, 'previous', windows.previous),
  ];

  return {
    ok: true,
    points,
    rawPayload: {
      days,
      windows: serialiseWindows(windows),
      daily: account.daily,
      current: account.current,
      previous: account.previous,
      hourly: account.hourly,
    },
  };
};

const normaliseDays = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(1, Math.trunc(value)));
};
