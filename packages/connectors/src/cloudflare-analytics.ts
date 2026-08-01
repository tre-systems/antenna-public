import { ACCOUNT_ID_RX, SLUG_RX } from './analytics-engine';
import {
  analyticsWindows,
  firstGraphqlError,
  readAccount,
  serialiseWindows,
  type AccountRows,
} from './cloudflare-analytics-model';
import { dailyPoint, windowPoint, workerPoints } from './cloudflare-analytics-points';
import { boundedInt } from './config-values';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult, DataPoint } from './types';

type CloudflareAnalyticsConfig = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly days?: number;
  readonly script?: string;
};

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

// Every user-controlled input is a GraphQL variable.
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
    }
  }
}`;

const queryFor = (script: string | undefined): string =>
  script === undefined
    ? QUERY
    : QUERY.replace('dimensions { date }', 'dimensions { date scriptName }');

export const cloudflareAnalytics: Adapter<CloudflareAnalyticsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const accountId = config.accountId.trim();
  const apiToken = config.apiToken.trim();
  const days = boundedInt(config.days, DEFAULT_DAYS, 1, MAX_DAYS);
  const script = normaliseScript(config.script);

  if (!ACCOUNT_ID_RX.test(accountId)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid account id' } };
  }
  if (script === null) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid Worker script name' } };
  }
  if (apiToken.length === 0) {
    return { ok: false, error: { code: 'unauthorized', message: 'missing analytics API token' } };
  }

  const windows = analyticsWindows(new Date(), days);
  const body = JSON.stringify({
    query: queryFor(script),
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
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'unauthorized', message: `Cloudflare GraphQL HTTP ${response.status}` },
    };
  }
  if (response.status === 429) {
    await discardResponse(response);
    return { ok: false, error: { code: 'rate_limited', message: 'Cloudflare GraphQL rate limit' } };
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }

  // GraphQL can return query and permission failures with HTTP 200.
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

  const scoped = scopeRows(account, script);
  const points: DataPoint[] = [
    ...scoped.daily.map(dailyPoint),
    ...workerPoints(scoped.current, 'current', windows.current, 'worker'),
    windowPoint(scoped.current, 'current', windows.current, script),
    windowPoint(scoped.previous, 'previous', windows.previous, script),
  ];

  return {
    ok: true,
    points,
    rawPayload: {
      days,
      windows: serialiseWindows(windows),
      script,
      daily: scoped.daily,
      current: scoped.current,
      previous: scoped.previous,
    },
  };
};

const normaliseScript = (value: string | undefined): string | undefined | null => {
  if (value === undefined) return undefined;
  const script = value.trim();
  return SLUG_RX.test(script) ? script : null;
};

const scopeRows = (account: AccountRows, script: string | undefined): AccountRows => {
  if (script === undefined) return account;
  return {
    daily: account.daily.filter((row) => row.dimensions.scriptName === script),
    current: account.current.filter((row) => row.dimensions.scriptName === script),
    previous: account.previous.filter((row) => row.dimensions.scriptName === script),
  };
};
