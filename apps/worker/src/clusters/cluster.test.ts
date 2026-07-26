import { describe, expect, it } from 'vitest';
import {
  clusterProblems,
  cosineSimilarity,
  dedupeByPost,
  problemStatement,
  type EmbeddedProblem,
  type ProblemInput,
} from './cluster';

const input = (overrides: Partial<ProblemInput> = {}): ProblemInput => ({
  postId: 'a1',
  subreddit: 'smallbusiness',
  title: 'Rebuilding the same invoice sheet every month',
  body: 'I export three reports and stitch them together by hand.',
  permalink: 'https://www.reddit.com/r/smallbusiness/comments/a1/',
  createdMs: Date.parse('2026-07-01T00:00:00Z'),
  ...overrides,
});

const embedded = (overrides: Partial<EmbeddedProblem> = {}): EmbeddedProblem => ({
  ...input(),
  embedding: [1, 0, 0],
  ...overrides,
});

describe('dedupeByPost', () => {
  it('collapses the same post seen across many snapshots', () => {
    const deduped = dedupeByPost([
      input({ postId: 'a1' }),
      input({ postId: 'a1' }),
      input({ postId: 'a1' }),
      input({ postId: 'b2' }),
    ]);
    expect(deduped.map((item) => item.postId)).toEqual(['a1', 'b2']);
  });

  it('keeps the earliest sighting of a post', () => {
    const early = Date.parse('2026-07-01T00:00:00Z');
    const late = Date.parse('2026-07-02T00:00:00Z');
    const [kept] = dedupeByPost([
      input({ postId: 'a1', createdMs: late, title: 'later copy' }),
      input({ postId: 'a1', createdMs: early, title: 'first sighting' }),
    ]);
    expect(kept?.title).toBe('first sighting');
  });

  it('orders deterministically regardless of input order', () => {
    const items = [
      input({ postId: 'c', createdMs: 3 }),
      input({ postId: 'a', createdMs: 1 }),
      input({ postId: 'b', createdMs: 2 }),
    ];
    expect(dedupeByPost(items).map((i) => i.postId)).toEqual(['a', 'b', 'c']);
    expect(dedupeByPost([...items].reverse()).map((i) => i.postId)).toEqual(['a', 'b', 'c']);
  });
});

describe('problemStatement', () => {
  it('joins title and body and collapses whitespace', () => {
    expect(problemStatement(input({ title: 'A  problem', body: 'with\n\nspacing' }))).toBe(
      'A problem with spacing',
    );
  });

  it('trims long bodies so context cannot dilute the vector', () => {
    expect(problemStatement(input({ body: 'x'.repeat(5000) })).length).toBe(500);
  });
});

describe('cosineSimilarity', () => {
  it('scores identical vectors at 1 and orthogonal at 0', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('ignores magnitude, comparing direction only', () => {
    expect(cosineSimilarity([2, 0], [8, 0])).toBeCloseTo(1);
  });

  it('returns 0 for empty, mismatched, or zero vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });
});

describe('clusterProblems', () => {
  it('groups similar problems and separates unrelated ones', () => {
    const clusters = clusterProblems([
      embedded({ postId: 'a', embedding: [1, 0, 0], createdMs: 1 }),
      embedded({ postId: 'b', embedding: [0.98, 0.02, 0], createdMs: 2 }),
      embedded({ postId: 'c', embedding: [0, 1, 0], createdMs: 3 }),
      embedded({ postId: 'd', embedding: [0, 0.97, 0.03], createdMs: 4 }),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((cluster) => cluster.distinctPosts === 2)).toBe(true);
  });

  it('ranks by how many distinct posts a problem covers', () => {
    const clusters = clusterProblems([
      embedded({ postId: 'a', embedding: [1, 0, 0], createdMs: 1 }),
      embedded({ postId: 'b', embedding: [0.99, 0.01, 0], createdMs: 2 }),
      embedded({ postId: 'c', embedding: [0.99, 0, 0.01], createdMs: 3 }),
      embedded({ postId: 'd', embedding: [0, 1, 0], createdMs: 4 }),
      embedded({ postId: 'e', embedding: [0, 0.99, 0.01], createdMs: 5 }),
    ]);
    expect(clusters.map((cluster) => cluster.distinctPosts)).toEqual([3, 2]);
  });

  it('drops one-off posts, which are not yet a demand signal', () => {
    const clusters = clusterProblems([
      embedded({ postId: 'lonely', embedding: [0, 0, 1], createdMs: 1 }),
      embedded({ postId: 'a', embedding: [1, 0, 0], createdMs: 2 }),
      embedded({ postId: 'b', embedding: [0.99, 0.01, 0], createdMs: 3 }),
    ]);
    expect(clusters.map((cluster) => cluster.key)).toEqual(['a']);
  });

  it('records the subreddits and time span a problem spans', () => {
    const [cluster] = clusterProblems([
      embedded({ postId: 'a', subreddit: 'excel', embedding: [1, 0, 0], createdMs: 100 }),
      embedded({
        postId: 'b',
        subreddit: 'smallbusiness',
        embedding: [0.99, 0.01, 0],
        createdMs: 900,
      }),
    ]);
    expect(cluster?.subreddits).toEqual(['excel', 'smallbusiness']);
    expect(cluster?.firstSeenMs).toBe(100);
    expect(cluster?.lastSeenMs).toBe(900);
  });

  it('is deterministic regardless of the order posts arrive in', () => {
    const items = [
      embedded({ postId: 'a', embedding: [1, 0, 0], createdMs: 1 }),
      embedded({ postId: 'b', embedding: [0.99, 0.01, 0], createdMs: 2 }),
      embedded({ postId: 'c', embedding: [0, 1, 0], createdMs: 3 }),
      embedded({ postId: 'd', embedding: [0, 0.99, 0.01], createdMs: 4 }),
    ];
    const forward = clusterProblems(items).map((c) => `${c.key}:${c.distinctPosts}`);
    const reversed = clusterProblems([...items].reverse()).map(
      (c) => `${c.key}:${c.distinctPosts}`,
    );
    expect(reversed).toEqual(forward);
  });

  it('honours a stricter threshold by splitting loose groups apart', () => {
    const items = [
      embedded({ postId: 'a', embedding: [1, 0, 0], createdMs: 1 }),
      embedded({ postId: 'b', embedding: [0.85, 0.53, 0], createdMs: 2 }),
    ];
    expect(clusterProblems(items, { threshold: 0.8 })).toHaveLength(1);
    expect(clusterProblems(items, { threshold: 0.99 })).toHaveLength(0);
  });

  it('returns nothing for an empty archive rather than throwing', () => {
    expect(clusterProblems([])).toEqual([]);
  });
});
