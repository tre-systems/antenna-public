import { describe, expect, it } from 'vitest';
import { redditProblemsTemplate } from './reddit-problems';

const anyHintMatches = (prompt: string): boolean =>
  redditProblemsTemplate.matchHints.some((rx) => rx.test(prompt));

describe('redditProblemsTemplate.matchHints', () => {
  it.each([
    'reddit problems',
    'what problems are people posting about',
    'pain points in r/smallbusiness',
    'unmet needs',
    'r/excel',
    'what are people complaining about',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Paris', 'GitHub Trending', 'BTC price'])('does not match "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(false);
  });
});

describe('redditProblemsTemplate.paramExtractors', () => {
  it('pulls a subreddit name out of the prompt', () => {
    expect(
      redditProblemsTemplate.paramExtractors.subreddits?.('pain points in r/smallbusiness'),
    ).toBe('smallbusiness');
    expect(
      redditProblemsTemplate.paramExtractors.subreddits?.('no subreddit here'),
    ).toBeUndefined();
  });
});

describe('redditProblemsTemplate.configSchema', () => {
  it('accepts an empty config and a bounded subreddit list', () => {
    expect(redditProblemsTemplate.configSchema.safeParse({}).success).toBe(true);
    expect(
      redditProblemsTemplate.configSchema.safeParse({ subreddits: ['excel'], limit: 5 }).success,
    ).toBe(true);
  });

  it('rejects unbounded or empty inputs', () => {
    expect(redditProblemsTemplate.configSchema.safeParse({ subreddits: [] }).success).toBe(false);
    expect(redditProblemsTemplate.configSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(redditProblemsTemplate.configSchema.safeParse({ lookbackHours: 999 }).success).toBe(
      false,
    );
  });
});

describe('redditProblemsTemplate metadata', () => {
  it('requires attribution, refreshes six-hourly, and keeps raw payloads', () => {
    expect(redditProblemsTemplate.rightsStatus).toBe('with-attribution');
    expect(redditProblemsTemplate.defaultRefreshSeconds).toBe(21_600);
    // The ranked candidate list in the raw payload is the input to the
    // downstream scoring pass; the top-N points alone are not enough.
    expect(redditProblemsTemplate.retainRawPayload).toBe(true);
  });
});
