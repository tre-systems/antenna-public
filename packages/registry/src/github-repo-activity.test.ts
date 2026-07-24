import { describe, expect, it } from 'vitest';
import { githubRepoActivityTemplate } from './github-repo-activity';

const anyHintMatches = (prompt: string): boolean =>
  githubRepoActivityTemplate.matchHints.some((rx) => rx.test(prompt));

describe('githubRepoActivityTemplate.matchHints', () => {
  it.each([
    'github repo activity',
    'track stars for example-org/collection',
    'how many issues on cloudflare/workers',
    'forks of facebook/react',
    'show me a repo tile',
  ])('matches "%s"', (prompt) => {
    expect(anyHintMatches(prompt)).toBe(true);
  });

  it.each(['weather in Berlin', 'bitcoin price', 'football scores'])(
    'does not match "%s"',
    (prompt) => {
      expect(anyHintMatches(prompt)).toBe(false);
    },
  );
});

describe('githubRepoActivityTemplate.paramExtractors', () => {
  const { owner, repo } = githubRepoActivityTemplate.paramExtractors;

  it('extracts owner and repo from "owner/repo"', () => {
    expect(owner?.('track example-org/collection stars')).toBe('example-org');
    expect(repo?.('track example-org/collection stars')).toBe('collection');
  });

  it('handles dots and hyphens in segments', () => {
    expect(owner?.('show me cloudflare-foundations/wrangler.action stars')).toBe(
      'cloudflare-foundations',
    );
    expect(repo?.('show me cloudflare-foundations/wrangler.action stars')).toBe('wrangler.action');
  });

  it('returns undefined when no owner/repo present', () => {
    expect(owner?.('just some words')).toBeUndefined();
    expect(repo?.('just some words')).toBeUndefined();
  });
});
