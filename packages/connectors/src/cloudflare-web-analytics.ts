import { ACCOUNT_ID_RX } from './analytics-engine';
import { firstGraphqlError } from './cloudflare-analytics-model';
import { hostTrafficPoints, readRumRows } from './cloudflare-web-analytics-points';
import { boundedInt, commaSeparatedValues } from './config-values';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { Adapter, AdapterResult } from './types';

export type CloudflareWebAnalyticsConfig = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly hosts: string;
  readonly days?: number;
};

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const HOST_RX = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const LOOKBACK_DAYS = 90;

const QUERY = `query WebAnalytics($account: String!, $start: Date!, $end: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(
        limit: 5000
        filter: { date_geq: $start, date_leq: $end }
        orderBy: [date_ASC, sum_visits_DESC]
      ) {
        count
        sum { visits }
        dimensions { date requestHost }
      }
    }
  }
}`;

export const cloudflareWebAnalytics: Adapter<CloudflareWebAnalyticsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const accountId = config.accountId.trim();
  const apiToken = config.apiToken.trim();
  const hosts = commaSeparatedValues(config.hosts.toLowerCase());
  const days = boundedInt(config.days, DEFAULT_DAYS, 1, MAX_DAYS);
  if (!ACCOUNT_ID_RX.test(accountId)) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid account id' } };
  }
  if (hosts.length === 0 || hosts.some((host) => !HOST_RX.test(host))) {
    return { ok: false, error: { code: 'parse_failed', message: 'invalid host list' } };
  }
  if (apiToken.length === 0) {
    return { ok: false, error: { code: 'unauthorized', message: 'missing analytics API token' } };
  }

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS + 1);
  const body = JSON.stringify({
    query: QUERY,
    variables: { account: accountId, start: isoDate(start), end: isoDate(end) },
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
    return { ok: false, error: { code: 'unauthorized', message: `HTTP ${response.status}` } };
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
  const graphqlError = firstGraphqlError(payload);
  if (graphqlError !== null) {
    return {
      ok: false,
      error: {
        code: /auth|permission|denied|forbidden/i.test(graphqlError)
          ? 'unauthorized'
          : 'parse_failed',
        message: graphqlError,
      },
    };
  }
  const rows = readRumRows(payload);
  if (rows === null) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected GraphQL payload' } };
  }
  const points = hostTrafficPoints(hosts, rows, days, end);
  return { ok: true, points, rawPayload: { days, hosts, rowCount: rows.length } };
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
