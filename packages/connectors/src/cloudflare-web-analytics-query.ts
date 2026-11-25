import { firstGraphqlError } from './cloudflare-analytics-model';
import { readRecentRumRows, type RumRow } from './cloudflare-web-analytics-points';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { AdapterError } from './types';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

const DAILY_QUERY = `query WebAnalyticsDay($account: String!, $day: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      recent: rumPageloadEventsAdaptiveGroups(
        limit: 5000
        filter: { date_geq: $day, date_leq: $day }
        orderBy: [date_ASC, sum_visits_DESC]
      ) {
        count
        avg { sampleInterval }
        sum { visits }
        dimensions { date requestHost }
      }
    }
  }
}`;

type PayloadResult = { ok: true; payload: unknown } | { ok: false; error: AdapterError };
type RowsResult = { ok: true; rows: RumRow[] } | { ok: false; error: AdapterError };

export const fetchGraphqlPayload = async (
  apiToken: string,
  query: string,
  variables: Record<string, string>,
): Promise<PayloadResult> => {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }
  const responseError = await cloudflareResponseError(response);
  if (responseError) return { ok: false, error: responseError };
  return parsePayload(response);
};

export const fetchDailyRecentRows = async (
  accountId: string,
  apiToken: string,
  start: string,
  end: string,
): Promise<RowsResult> => {
  const outcomes = await Promise.all(
    inclusiveDates(start, end).map((day) => fetchDay(accountId, apiToken, day)),
  );
  const failed = outcomes.find((outcome) => !outcome.ok);
  if (failed) return failed;
  return { ok: true, rows: outcomes.flatMap((outcome) => (outcome.ok ? outcome.rows : [])) };
};

const fetchDay = async (accountId: string, apiToken: string, day: string): Promise<RowsResult> => {
  const fetched = await fetchGraphqlPayload(apiToken, DAILY_QUERY, { account: accountId, day });
  if (!fetched.ok) return fetched;
  const rows = readRecentRumRows(fetched.payload);
  if (rows === null) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected GraphQL payload' } };
  }
  return { ok: true, rows };
};

const cloudflareResponseError = async (response: Response): Promise<AdapterError | null> => {
  if (response.status === 401 || response.status === 403) {
    await discardResponse(response);
    return { code: 'unauthorized', message: `HTTP ${response.status}` };
  }
  if (response.status === 429) {
    await discardResponse(response);
    return { code: 'rate_limited', message: 'Cloudflare GraphQL rate limit' };
  }
  if (response.ok) return null;
  await discardResponse(response);
  return { code: 'fetch_failed', message: `HTTP ${response.status}` };
};

const parsePayload = async (response: Response): Promise<PayloadResult> => {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
  const graphqlError = firstGraphqlError(payload);
  if (graphqlError === null) return { ok: true, payload };
  return {
    ok: false,
    error: {
      code: /auth|permission|denied|forbidden/i.test(graphqlError)
        ? 'unauthorized'
        : 'parse_failed',
      message: graphqlError,
    },
  };
};

const inclusiveDates = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};
