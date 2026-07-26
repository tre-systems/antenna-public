import { describe, it, expect } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import { makeSignal, NOW } from './signal-card-test-fixtures';

describe('SignalCard list-style cards', () => {
  it('keeps compact GitHub Trending cards list-like instead of rendering one huge repo', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'github-trending',
          display: { title: 'GitHub Trending', source_label: 'GitHub Trending', source_url: null },
          points: [
            {
              dimensions: { rank: 1 },
              value: 'vercel/next.js · TypeScript · +1,234 stars today',
              ts: NOW,
            },
            {
              dimensions: { rank: 2 },
              value: 'facebook/react · JavaScript · +987 stars today',
              ts: NOW,
            },
          ],
        })}
      />,
    );

    expect(html).toContain('data-testid="github-trending-summary"');
    expect(html).toContain('#1');
    expect(html).toContain('vercel/next.js');
    expect(html).toContain('+1,234');
    expect(html).not.toContain('text-2xl');
  });

  it('renders the AI jobs exposure signal with a hero share + context line', () => {
    const signal = makeSignal({
      template_id: 'karpathy-jobs-snapshot',
      config: {},
      points: [
        { dimensions: { metric: 'occupations' }, value: 341, ts: NOW },
        { dimensions: { metric: 'jobs_analyzed' }, value: 143066500, unit: 'jobs', ts: NOW },
        {
          dimensions: { metric: 'weighted_ai_exposure' },
          value: null,
          value_text: '4.9 / 10',
          ts: NOW,
        },
        { dimensions: { metric: 'high_exposure_jobs' }, value: 49009400, unit: 'jobs', ts: NOW },
        {
          dimensions: { metric: 'high_exposure_share' },
          value: null,
          value_text: '34%',
          ts: NOW,
        },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-testid="karpathy-hero"');
    expect(html).toContain('34%');
    expect(html).toContain('highly AI-exposed');
    expect(html).toContain('49M');
    expect(html).toContain('143M');
    expect(html).toContain('4.9 / 10');
    expect(html).toContain('341');
    // The hero replaces the truncated grid layout, so its labels must be gone.
    expect(html).not.toContain('High exposure');
    expect(html).not.toContain('49,009,400');
  });

  it('renders the AI jobs exposure top exposed roles as ranked compact rows with exposure chips', () => {
    const signal = makeSignal({
      template_id: 'karpathy-jobs-snapshot',
      config: {},
      points: [
        { dimensions: { metric: 'high_exposure_share' }, value: null, value_text: '34%', ts: NOW },
        {
          dimensions: {
            metric: 'top_role',
            rank: 1,
            category: 'Programmers',
            jobs: 540_000,
            exposure: 72,
          },
          value: 'Programmers',
          ts: NOW,
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 2,
            category: 'Mathematicians',
            jobs: 36_000,
            exposure: 55,
          },
          value: 'Mathematicians',
          ts: NOW,
        },
        {
          dimensions: {
            metric: 'top_role',
            rank: 3,
            category: 'Accountants',
            jobs: 1_300_000,
            exposure: 28,
          },
          value: 'Accountants',
          ts: NOW,
        },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('Programmers');
    expect(html).toContain('Mathematicians');
    expect(html).toContain('Accountants');
    expect(html).toContain('72%');
    expect(html).toContain('540k jobs');
    expect(html).toContain('Top 3 most exposed');
  });

  it('renders GitHub Trending as a structured list with repo links, language, and stars-today chip', () => {
    const signal = makeSignal({
      template_id: 'github-trending',
      config: {},
      // The server resolves the card-level source to the trending list while
      // each point carries its own per-repo URL.
      display: {
        title: 'GitHub Trending',
        source_label: 'GitHub Trending',
        source_url: 'https://github.com/trending',
      },
      points: [
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
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('GitHub Trending');
    expect(html).toContain('data-testid="github-trending-list"');
    // Rank order: #1 before #2.
    expect(html.indexOf('#1')).toBeLessThan(html.indexOf('#2'));
    expect(html.indexOf('one/repo')).toBeLessThan(html.indexOf('two/repo'));
    expect(html).toContain('href="https://github.com/one/repo"');
    expect(html).toContain('href="https://github.com/two/repo"');
    // Language + stars are separate elements, not a truncated tail of the value.
    expect(html).toContain('TypeScript');
    expect(html).toContain('Python');
    expect(html).toContain('+40');
    expect(html).toContain('+20');
    expect(html).toContain('stars today');
  });
});
