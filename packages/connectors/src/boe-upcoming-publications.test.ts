import { afterEach, describe, expect, it, vi } from 'vitest';
import { boeUpcomingPublications, parseBoeUpcomingPublications } from './boe-upcoming-publications';

const html = `
  <h2>Upcoming key publications</h2>
  <p><a href="/monetary-policy-summary"> Monetary Policy Summary and minutes Next: Thursday 18 June </a></p>
  <p><a href="https://www.bankofengland.co.uk/report"> Monetary Policy Report Next: Thursday 30 July </a></p>
  <p><a href="/fpc-record"> Financial Policy Committee Record Next: Tuesday 7 July </a></p>
  <h2>Upcoming speeches, news and publications</h2>
  <p><a href="/speech">Speech // Andrew Bailey 21 May 2026</a></p>
`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseBoeUpcomingPublications', () => {
  it('extracts the key publications section and sorts by date', () => {
    const rows = parseBoeUpcomingPublications(html, Date.parse('2026-05-21T12:00:00Z'));

    expect(rows).toEqual([
      {
        title: 'Monetary Policy Summary and minutes',
        dateLabel: '2026-06-18',
        dateMs: Date.parse('2026-06-18T00:00:00Z'),
        url: 'https://www.bankofengland.co.uk/monetary-policy-summary',
      },
      {
        title: 'Financial Policy Committee Record',
        dateLabel: '2026-07-07',
        dateMs: Date.parse('2026-07-07T00:00:00Z'),
        url: 'https://www.bankofengland.co.uk/fpc-record',
      },
      {
        title: 'Monetary Policy Report',
        dateLabel: '2026-07-30',
        dateMs: Date.parse('2026-07-30T00:00:00Z'),
        url: 'https://www.bankofengland.co.uk/report',
      },
    ]);
  });

  it('dedupes when the page lists the same publication twice', () => {
    const rows = parseBoeUpcomingPublications(
      `<h2>Upcoming key publications</h2>
       <a href="/a">Monetary Policy Summary and minutes Next: Thursday 18 June</a>
       <a href="/b">Monetary Policy Summary and minutes Next: Thursday 18 June</a>
       <a href="/c">Financial Policy Committee Record Next: Tuesday 7 July</a>`,
      Date.parse('2026-05-21T12:00:00Z'),
    );

    expect(rows.map((r) => r.title)).toEqual([
      'Monetary Policy Summary and minutes',
      'Financial Policy Committee Record',
    ]);
  });

  it('rolls yearless dates into the next year when needed', () => {
    const rows = parseBoeUpcomingPublications(
      '<h2>Upcoming key publications</h2><a href="/x"> Monetary Policy Summary Next: Thursday 18 January </a>',
      Date.parse('2026-12-20T12:00:00Z'),
    );

    expect(rows[0]?.dateLabel).toBe('2027-01-18');
  });
});

describe('boeUpcomingPublications', () => {
  it('returns a count plus ranked publication points', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const result = await boeUpcomingPublications({ limit: 2 });

    expect(fetch).toHaveBeenCalledWith('https://www.bankofengland.co.uk/events/upcoming-events', {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'antenna' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toMatchObject({
      dimensions: { source: 'boe-upcoming-events', metric: 'upcoming_publications' },
      value: 3,
      unit: 'events',
      sourceUrl: 'https://www.bankofengland.co.uk/events/upcoming-events',
    });
    expect(result.points[1]).toMatchObject({
      dimensions: {
        source: 'boe-upcoming-events',
        metric: 'publication',
        rank: 1,
        date: '2026-06-18',
        days_until: 28,
      },
      value: 'Monetary Policy Summary and minutes',
      unit: '2026-06-18',
      sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy-summary',
    });
    expect(result.rawPayload).toMatchObject({
      source: 'https://www.bankofengland.co.uk/events/upcoming-events',
    });
  });

  it('maps missing key publications to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<h2>Nothing</h2>', { status: 200 })),
    );

    const result = await boeUpcomingPublications({});

    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'no Bank of England publications parsed' },
    });
  });
});
