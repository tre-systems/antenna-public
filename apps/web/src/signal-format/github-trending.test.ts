import { describe, expect, it } from 'vitest';
import { githubTrendingCardData } from './github-trending';
import type { ApiSignal } from '../api';

describe('githubTrendingCardData', () => {
  const NOW = Date.now();
  const make = (points: ApiSignal['points'], template_id = 'github-trending'): ApiSignal => ({
    id: 'gt1',
    template_id,
    visibility: 'private',
    config: {},
    refresh_seconds: 21_600,
    status: {
      status: 'live',
      last_ok_at: NOW,
      last_attempt_at: NOW,
      last_error: null,
      last_manual_request_at: null,
    },
    points,
  });

  it('parses repo · language · stars and returns rows sorted by rank', () => {
    const rows = githubTrendingCardData(
      make([
        {
          dimensions: { source: 'github-trending', rank: '2' },
          value: 'two/repo · Python · +20 stars today',
          display: { label: 'two/repo', source_url: 'https://github.com/two/repo' },
          ts: NOW,
        },
        {
          dimensions: { source: 'github-trending', rank: '1' },
          value: 'one/repo · TypeScript · +40 stars today',
          display: { label: 'one/repo', source_url: 'https://github.com/one/repo' },
          ts: NOW,
        },
      ]),
    );
    expect(rows).toEqual([
      {
        rank: 1,
        repo: 'one/repo',
        url: 'https://github.com/one/repo',
        language: 'TypeScript',
        starsToday: '40',
      },
      {
        rank: 2,
        repo: 'two/repo',
        url: 'https://github.com/two/repo',
        language: 'Python',
        starsToday: '20',
      },
    ]);
  });

  it('handles missing language and missing stars gracefully', () => {
    const rows = githubTrendingCardData(
      make([
        {
          dimensions: { source: 'github-trending', rank: 1 },
          value: 'bare/repo',
          ts: NOW,
        },
        {
          dimensions: { source: 'github-trending', rank: 2 },
          value: 'lang/only · Rust',
          ts: NOW,
        },
        {
          dimensions: { source: 'github-trending', rank: 3 },
          value: 'stars/only · +1,234 stars today',
          ts: NOW,
        },
      ]),
    );
    expect(rows).toEqual([
      { rank: 1, repo: 'bare/repo', url: null },
      { rank: 2, repo: 'lang/only', url: null, language: 'Rust' },
      { rank: 3, repo: 'stars/only', url: null, starsToday: '1,234' },
    ]);
  });

  it('returns null for non-github-trending templates and empty point sets', () => {
    expect(githubTrendingCardData(make([], 'fx-pair'))).toBeNull();
    expect(githubTrendingCardData(make([]))).toBeNull();
  });
});
