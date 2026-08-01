import type { DataPoint } from '../api';
import { safeExternalUrl } from './display';
import type { RenderSignal } from './types';

export type GithubTrendingRow = {
  readonly rank: number;
  readonly repo: string;
  readonly url: string | null;
  readonly language?: string;
  readonly starsToday?: string;
};

export function githubTrendingCardData(signal: RenderSignal): GithubTrendingRow[] | null {
  if (signal.template_id !== 'github-trending') return null;
  if (signal.points.length === 0) return null;
  const rows = signal.points
    .map(parseTrendingPoint)
    .filter((row): row is GithubTrendingRow => row !== null);
  rows.sort((a, b) => a.rank - b.rank);
  return rows.length > 0 ? rows : null;
}

const parseTrendingPoint = (point: DataPoint): GithubTrendingRow | null => {
  const raw = typeof point.value === 'string' ? point.value : (point.value_text ?? '');
  if (!raw) return null;
  const [repo, ...rest] = raw.split(' · ').map((s) => s.trim());
  if (!repo) return null;
  const details = parseDetails(rest);
  return { rank: rankOf(point), repo, url: safeExternalUrl(point.display?.source_url), ...details };
};

const parseDetails = (
  parts: ReadonlyArray<string>,
): Pick<GithubTrendingRow, 'language' | 'starsToday'> => {
  let language: string | undefined;
  let starsToday: string | undefined;
  for (const part of parts) {
    const starsMatch = /^\+([\d,]+)\s+stars?\s+today$/i.exec(part);
    if (starsMatch?.[1]) starsToday = starsMatch[1];
    else if (!language) language = part;
  }
  return { ...(language ? { language } : {}), ...(starsToday ? { starsToday } : {}) };
};

const rankOf = (point: DataPoint): number => {
  const raw = point.dimensions?.rank;
  const rank = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
  return Number.isFinite(rank) ? rank : 0;
};
