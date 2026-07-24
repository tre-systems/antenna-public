import type { Adapter, AdapterResult, DataPoint } from './types';
import { extractHtmlElements, htmlAttribute, htmlToText } from './html-text';

type BoeUpcomingPublicationsConfig = {
  readonly sourceUrl?: string;
  readonly limit?: number;
};

export type BoePublication = {
  readonly title: string;
  readonly dateLabel: string;
  readonly dateMs: number;
  readonly url: string;
};

const DEFAULT_SOURCE = 'https://www.bankofengland.co.uk/events/upcoming-events';
const SOURCE_ORIGIN = 'https://www.bankofengland.co.uk';
const DEFAULT_LIMIT = 3;
const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const boeUpcomingPublications: Adapter<BoeUpcomingPublicationsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const sourceUrl = stringValue(config.sourceUrl) ?? DEFAULT_SOURCE;
  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'antenna' },
    });
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (!response.ok) {
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  const now = Date.now();
  const publications = parseBoeUpcomingPublications(html, now);
  if (publications.length === 0) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: 'no Bank of England publications parsed' },
    };
  }

  const limit = positiveInt(config.limit) ?? DEFAULT_LIMIT;
  return {
    ok: true,
    points: [
      {
        dimensions: { source: 'boe-upcoming-events', metric: 'upcoming_publications' },
        value: publications.length,
        unit: 'events',
        ts: now,
        sourceUrl,
      },
      ...publications
        .slice(0, limit)
        .map((publication, index) => toPublicationPoint(publication, index + 1, now)),
    ],
    rawPayload: { source: sourceUrl, publications },
  };
};

export const parseBoeUpcomingPublications = (html: string, now: number): BoePublication[] => {
  const section = sectionAfterHeading(html, 'Upcoming key publications');
  if (!section) return [];

  const anchors = extractHtmlElements(section, 'a').flatMap((anchor) => {
    const href = htmlAttribute(anchor.openingTag, 'href');
    const label = htmlToText(anchor.innerHtml);
    if (!href || !label) return [];
    const parsed = parsePublicationLabel(label, now);
    if (!parsed) return [];
    return [{ ...parsed, url: resolveUrl(href) }];
  });

  // The BoE page sometimes lists the same publication twice (once in the
  // headline strip, once inside the section body), which would duplicate
  // the row on the card. Dedupe on title + scheduled date.
  const seen = new Set<string>();
  return anchors
    .sort((a, b) => a.dateMs - b.dateMs || a.title.localeCompare(b.title))
    .filter((pub) => {
      const key = `${pub.title}|${pub.dateLabel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sectionAfterHeading = (html: string, heading: string): string | undefined => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `<h2\\b[^>]*>\\s*${escaped}\\s*<\\/h2>([\\s\\S]*?)(?:<h2\\b|$)`,
    'i',
  ).exec(html);
  return match?.[1];
};

const parsePublicationLabel = (
  label: string,
  now: number,
): Omit<BoePublication, 'url'> | undefined => {
  const match =
    /^(.*?)\s+Next:\s+(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/i.exec(
      label,
    );
  if (!match) return undefined;
  const title = match[1]?.trim();
  const day = Number(match[2]);
  const month = match[3]?.toLowerCase();
  const explicitYear = match[4] ? Number(match[4]) : undefined;
  if (!title || !Number.isInteger(day) || !month || MONTHS[month] === undefined) return undefined;

  const nowDate = new Date(now);
  let year = explicitYear ?? nowDate.getUTCFullYear();
  let dateMs = Date.UTC(year, MONTHS[month], day);
  if (!explicitYear && dateMs < now - 30 * 86_400_000) {
    year += 1;
    dateMs = Date.UTC(year, MONTHS[month], day);
  }

  return {
    title,
    dateLabel: `${year}-${String(MONTHS[month] + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dateMs,
  };
};

const toPublicationPoint = (publication: BoePublication, rank: number, ts: number): DataPoint => ({
  dimensions: {
    source: 'boe-upcoming-events',
    metric: 'publication',
    rank,
    date: publication.dateLabel,
    days_until: Math.max(0, Math.ceil((publication.dateMs - ts) / 86_400_000)),
  },
  value: publication.title,
  unit: publication.dateLabel,
  ts,
  sourceUrl: publication.url,
});

const resolveUrl = (href: string): string => {
  try {
    return new URL(href, SOURCE_ORIGIN).toString();
  } catch {
    return DEFAULT_SOURCE;
  }
};

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const positiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
