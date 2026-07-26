import { HTML_PAGE_REQUEST_INIT } from './browser-request';
import type { Adapter, AdapterResult, DataPoint } from './types';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';

export type TbenchLeaderboardConfig = {
  readonly version?: string;
  readonly limit?: number;
};

const DEFAULT_VERSION = '2.1';
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const SOURCE_PAGE = 'https://www.tbench.ai/leaderboard/terminal-bench/';

export const tbenchLeaderboard: Adapter<TbenchLeaderboardConfig> = async (
  config,
): Promise<AdapterResult> => {
  const version =
    typeof config.version === 'string' && config.version ? config.version : DEFAULT_VERSION;
  const limit =
    typeof config.limit === 'number' && config.limit > 0
      ? Math.min(config.limit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const url = `${SOURCE_PAGE}${version}`;
  let response: Response;
  try {
    response = await fetch(url, HTML_PAGE_REQUEST_INIT);
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (!response.ok) {
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'fetch_failed', message: `HTTP ${String(response.status)}` },
    };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }

  const entries = parseLeaderboard(html, limit);
  if (entries.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no verified entries found' } };
  }

  const now = Date.now();
  const points: DataPoint[] = entries.map((entry, idx) => ({
    dimensions: {
      metric: 'leaderboard_entry',
      rank: idx + 1,
      agent: entry.agent,
      model: entry.model,
      agent_org: entry.agentOrg,
    },
    value: entry.accuracy,
    unit: '%',
    ts: now,
    sourceUrl: url,
  }));

  return { ok: true, points, rawPayload: { version, entries } };
};

type LeaderboardEntry = {
  readonly agent: string;
  readonly model: string;
  readonly agentOrg: string;
  readonly accuracy: number;
  readonly verified: boolean;
};

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const currentEntry = (row: string, cells: readonly string[]): LeaderboardEntry | undefined => {
  if (cells.length < 11 || !row.includes('details in Harbor Hub')) return undefined;
  return parsedEntry(cells[1] ?? '', cells[2] ?? '', cells[6] ?? '', cells[4] ?? '');
};

const legacyEntry = (cells: readonly string[]): LeaderboardEntry | undefined => {
  if (cells.length < 8 || !cells[1]?.includes('hover-card-trigger')) return undefined;
  return parsedEntry(cells[2] ?? '', cells[3] ?? '', cells[5] ?? '', cells[7] ?? '');
};

const parsedEntry = (
  agentCell: string,
  modelCell: string,
  agentOrgCell: string,
  accuracyCell: string,
): LeaderboardEntry | undefined => {
  const agent = stripTags(agentCell);
  const model = stripTags(modelCell);
  const agentOrg = stripTags(agentOrgCell);
  const accuracyMatch = /^(\d+(?:\.\d+)?)%/.exec(stripTags(accuracyCell));
  const accuracy = Number(accuracyMatch?.[1]);
  if (!agent || !model || !Number.isFinite(accuracy)) return undefined;
  return { agent, model, agentOrg, accuracy, verified: true };
};

const parseLeaderboard = (html: string, limit: number): ReadonlyArray<LeaderboardEntry> => {
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const entries: LeaderboardEntry[] = [];

  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? [];
    const entry = currentEntry(row, cells) ?? legacyEntry(cells);
    if (!entry) continue;
    entries.push(entry);
    if (entries.length >= limit) break;
  }

  return entries;
};
