import { ACCOUNT_ID_RX } from './analytics-engine';
import { hostTrafficPoints, readRumRowSets } from './cloudflare-web-analytics-points';
import { fetchDailyRecentRows, fetchGraphqlPayload } from './cloudflare-web-analytics-query';
import { boundedInt, commaSeparatedValues } from './config-values';
import type { Adapter, AdapterResult } from './types';

export type CloudflareWebAnalyticsConfig = {
  readonly accountId: string;
  readonly apiToken: string;
  readonly hosts: string;
  readonly days?: number;
};

const HOST_RX = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;
const LOOKBACK_DAYS = 90;

const QUERY = `query WebAnalytics(
  $account: String!
  $recentStart: Date!
  $previousStart: Date!
  $lookbackStart: Date!
  $end: Date!
) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      recent: rumPageloadEventsAdaptiveGroups(
        limit: 5000
        filter: { date_geq: $recentStart, date_leq: $end }
        orderBy: [date_ASC, sum_visits_DESC]
      ) {
        count
        avg { sampleInterval }
        sum { visits }
        dimensions { date requestHost }
      }
      previous: rumPageloadEventsAdaptiveGroups(
        limit: 5000
        filter: { date_geq: $previousStart, date_lt: $recentStart }
        orderBy: [date_ASC, sum_visits_DESC]
      ) {
        count
        avg { sampleInterval }
        sum { visits }
        dimensions { date requestHost }
      }
      lookback: rumPageloadEventsAdaptiveGroups(
        limit: 5000
        filter: { date_geq: $lookbackStart, date_lt: $previousStart }
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
  const recentStart = daysBefore(end, days - 1);
  const previousStart = daysBefore(end, days * 2 - 1);
  const lookbackStart = daysBefore(end, LOOKBACK_DAYS - 1);
  const fetched = await fetchGraphqlPayload(apiToken, QUERY, {
    account: accountId,
    recentStart,
    previousStart,
    lookbackStart,
    end: isoDate(end),
  });
  if (!fetched.ok) return fetched;
  const rows = readRumRowSets(fetched.payload);
  if (rows === null) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected GraphQL payload' } };
  }
  let recentRows = rows.recent;
  let recentQuery = 'window';
  if (rows.recent.some((row) => row.avg.sampleInterval !== 1)) {
    const daily = await fetchDailyRecentRows(accountId, apiToken, recentStart, isoDate(end));
    if (!daily.ok) return daily;
    recentRows = daily.rows;
    recentQuery = 'daily';
  }
  const allRows = [...rows.lookback, ...rows.previous, ...recentRows];
  const points = hostTrafficPoints(hosts, allRows, days, end);
  return {
    ok: true,
    points,
    rawPayload: { days, hosts, rowCount: allRows.length, recentQuery },
  };
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const daysBefore = (date: Date, days: number): string => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return isoDate(copy);
};
