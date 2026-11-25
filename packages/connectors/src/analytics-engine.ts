import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';
import type { AdapterError } from './types';

// These patterns guard identifiers interpolated into Analytics Engine SQL.
export const ACCOUNT_ID_RX = /^[0-9a-f]{32}$/;
export const SLUG_RX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const analyticsSqlUrl = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

export async function fetchAnalyticsRows(
  accountId: string,
  apiToken: string,
  sql: string,
): Promise<{ ok: true; payload: unknown } | { ok: false; error: AdapterError }> {
  let response: Response;
  try {
    response = await fetch(analyticsSqlUrl(accountId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: sql,
    });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (response.status === 401 || response.status === 403) {
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'unauthorized', message: `analytics SQL API HTTP ${response.status}` },
    };
  }
  if (response.status === 429) {
    await discardResponse(response);
    return { ok: false, error: { code: 'rate_limited', message: 'analytics SQL API rate limit' } };
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

  return { ok: true, payload };
}
