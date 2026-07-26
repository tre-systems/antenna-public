// Post authors are deliberately dropped here: candidate ranking needs the post,
// not the person, and Reddit usernames are personal data under UK GDPR. Any
// outreach flow must re-read the author from Reddit at the point of use.
export type RedditCandidate = {
  readonly id: string;
  readonly subreddit: string;
  readonly title: string;
  readonly body: string;
  readonly permalink: string;
  readonly createdMs: number;
  readonly markerHits: number;
  readonly score: number;
};

const BODY_MAX_CHARS = 4000;
// Capped below the per-marker weight so body length can only ever break ties
// between posts with the same marker count, never outrank an extra marker.
const LENGTH_SCORE_CAP = 9;

// Phrases that distinguish "I have an unmet need" from general discussion.
// Deliberately deterministic: the cheap prefilter ahead of any model-scored pass.
const PROBLEM_MARKERS: readonly RegExp[] = [
  /\bhow (?:do|would|can) (?:i|you|we)\b/i,
  /\b(?:is|are) there (?:a|an|any)\b/i,
  /\banyone know\b/i,
  /\bany way to\b/i,
  /\bwhat do you (?:use|guys use)\b/i,
  /\blooking for (?:a|an|any|some)\b/i,
  /\b(?:i )?need (?:a|an|help|advice)\b/i,
  /\bhelp with\b/i,
  /\bstruggling\b/i,
  /\bfrustrat(?:ed|ing)\b/i,
  /\bwast(?:e|ing) (?:so much )?time\b/i,
  /\b(?:doing (?:this|it) )?manually\b/i,
  /\bby hand\b/i,
  /\btedious\b/i,
  /\btakes (?:me )?(?:hours|forever|ages)\b/i,
  /\bcan(?:'|’)?t find (?:a|an|any)\b/i,
  /\bwish there was\b/i,
  /\bdoes anyone else\b/i,
  /\bwork ?around\b/i,
];

const ENTRY_PATTERN = /<entry>([\s\S]*?)<\/entry>/g;

export const parseRedditFeed = (feed: string, subreddit: string): RedditCandidate[] => {
  const entries: RedditCandidate[] = [];
  for (const match of feed.matchAll(ENTRY_PATTERN)) {
    const entry = match[1];
    if (!entry) continue;

    const id = tagText(entry, 'id')?.replace(/^t3_/, '');
    const title = redactUserHandles(decodeEntities(tagText(entry, 'title') ?? ''));
    const permalink = attribute(entry, 'link', 'href');
    const publishedMs = Date.parse(tagText(entry, 'published') ?? '');
    if (!id || !title || !permalink || !Number.isFinite(publishedMs)) continue;

    const body = plainText(tagText(entry, 'content') ?? '');
    const markerHits = countMarkerHits(`${title}\n${body}`);

    entries.push({
      id,
      subreddit: attribute(entry, 'category', 'term') ?? subreddit,
      title,
      body: body.slice(0, BODY_MAX_CHARS),
      permalink,
      createdMs: publishedMs,
      markerHits,
      score: candidateScore(markerHits, body.length),
    });
  }
  return entries;
};

// A text-shape proxy for "someone is describing a real problem", not demand —
// the feed carries no comment count or score. Recurrence is the clustering
// stage's job.
export const candidateScore = (markerHits: number, bodyChars: number): number =>
  markerHits * 10 + Math.min(LENGTH_SCORE_CAP, Math.floor(bodyChars / 100));

export const isProblemCandidate = (post: RedditCandidate, minBodyChars: number): boolean =>
  post.body.length >= minBodyChars && post.markerHits > 0;

const countMarkerHits = (text: string): number =>
  PROBLEM_MARKERS.reduce((total, marker) => (marker.test(text) ? total + 1 : total), 0);

const tagText = (entry: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(entry);
  return match?.[1]?.trim() || undefined;
};

const attribute = (entry: string, tag: string, attr: string): string | undefined => {
  const match = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`).exec(entry);
  return match?.[1]?.trim() || undefined;
};

// Reddit appends a "submitted by /u/name" footer after this marker: cutting
// there drops the only author mention outside <author>. Link-only posts have no
// body before it and fall out on the minimum-length check.
const BODY_END_MARKER = '<!-- SC_ON -->';

// Defence in depth for the no-authors rule: bodies mention other people too.
const USER_HANDLE = /\/?\bu\/[a-z0-9_-]{2,21}\b/gi;

const redactUserHandles = (value: string): string => value.replace(USER_HANDLE, '[user]');

// Content is HTML escaped inside XML, so markup only appears after a first
// decode pass; tags are stripped and decoded again to recover literal ampersands.
const plainText = (content: string): string => {
  const decoded = decodeEntities(content);
  const bodyOnly = decoded.split(BODY_END_MARKER)[0] ?? decoded;
  return redactUserHandles(
    decodeEntities(bodyOnly.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim(),
  );
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (value: string): string =>
  value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, token: string) => {
    if (token.startsWith('#x') || token.startsWith('#X')) {
      return codePoint(Number.parseInt(token.slice(2), 16)) ?? match;
    }
    if (token.startsWith('#')) return codePoint(Number.parseInt(token.slice(1), 10)) ?? match;
    return ENTITIES[token.toLowerCase()] ?? match;
  });

const codePoint = (value: number): string | undefined =>
  Number.isFinite(value) && value > 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : undefined;
