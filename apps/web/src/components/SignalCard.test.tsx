// Renders via preact-render-to-string for assertion against output HTML — keeps deps light (no JSDOM, no testing-library).
import { describe, it, expect } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import type { ApiSignal, PublicApiSignal } from '../api';

const NOW = Date.now();

function makeSignal(overrides: Partial<ApiSignal> = {}): ApiSignal {
  return {
    id: 'b-fx-1',
    template_id: 'fx-pair',
    config: { pair: 'EUR/USD' },
    refresh_seconds: 60,
    status: {
      status: 'live',
      last_ok_at: NOW - 10_000,
      last_attempt_at: NOW - 10_000,
      last_error: null,
      last_manual_request_at: null,
    },
    points: [{ dimensions: { pair: 'EUR/USD' }, value: 1.0876, ts: NOW - 10_000 }],
    ...overrides,
    visibility: overrides.visibility ?? 'private',
  };
}

function makePublicSignal(overrides: Partial<PublicApiSignal> = {}): PublicApiSignal {
  const {
    config: _config,
    refresh_seconds: _refreshSeconds,
    ...base
  } = makeSignal({
    status: {
      status: 'error',
      last_ok_at: null,
      last_attempt_at: NOW - 5_000,
      last_error: 'setup_required: needs TRADING_ECONOMICS_API_KEY',
      last_manual_request_at: null,
    },
    points: [],
  });
  return { ...base, ...overrides };
}

describe('SignalCard', () => {
  it('renders the derived title, source label, and formatted point value', () => {
    const html = renderToString(<SignalCard signal={makeSignal()} />);
    expect(html).toContain('EUR/USD');
    expect(html).toContain('Frankfurter (ECB)');
    // formatValue now caps fractional values at 2 decimals — FX rates
    // round (1.0876 → 1.09) to match the rest of the collection's column
    // formatting.
    expect(html).toContain('1.09');
    expect(html).not.toContain('1.0876');
    expect(html).toContain('data-status="live"');
  });

  it('renders manual cost signals as private currency cards', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'manual-cost',
          config: {
            amount: 12.34,
            currency: 'GBP',
            period: 'month_to_date',
            provider: 'Cloudflare',
            service: 'Workers',
            project: 'Antenna',
          },
          display: {
            title: 'Cloudflare · Antenna costs',
            source_label: 'Manual cost entry',
            source_url: null,
          },
          points: [
            {
              dimensions: {
                family: 'cost',
                metric: 'cost',
                period: 'month_to_date',
                posture: 'manual',
                provider: 'Cloudflare',
                service: 'Workers',
                project: 'Antenna',
              },
              value: 12.34,
              unit: 'GBP',
              ts: NOW,
            },
          ],
        })}
      />,
    );

    expect(html).toContain('Cloudflare · Antenna costs');
    expect(html).toContain('£12.34');
    expect(html).toContain('month to date');
    expect(html).toContain('manual');
  });

  it('starts owner cards in compact detail mode', () => {
    const html = renderToString(<SignalCard signal={makeSignal()} />);
    expect(html).toContain('data-expanded="false"');
    expect(html).toContain('data-testid="signal-card-header"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Expand signal details"');
    expect(html).not.toContain('>Open<');
    expect(html).not.toContain('>Details<');
  });

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

  it('keeps headerless presentation cards expanded', () => {
    const html = renderToString(<SignalCard signal={makeSignal()} hideHeader />);
    expect(html).toContain('data-expanded="true"');
    expect(html).not.toContain('Expand signal details');
  });

  it('keeps expanded details user-facing and omits connector config', () => {
    const html = renderToString(
      <SignalCard
        hideHeader
        signal={makeSignal({
          template_id: 'macro-market-history',
          config: { preset: 'gbp-usd' },
          refresh_seconds: 21_600,
        })}
      />,
    );

    expect(html).toContain('Last updated');
    expect(html).toContain('Every 6h');
    expect(html).toContain('Private');
    expect(html).not.toContain('Preset');
    expect(html).not.toContain('gbp-usd');
  });

  it('links the source label when a point carries a source URL', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          points: [
            {
              dimensions: { pair: 'EUR/USD' },
              value: 1.0876,
              ts: NOW - 10_000,
              source_url: 'https://example.test/source',
            },
          ],
        })}
      />,
    );
    expect(html).toContain('href="https://example.test/source"');
    expect(html).toContain('target="_blank"');
  });

  it('links macro signals to their source page before data arrives', () => {
    const html = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'macro-market-history',
          config: { preset: 'uk-10y-gilt' },
          points: [],
        })}
      />,
    );
    expect(html).toContain('UK 10Y gilt 1Y');
    expect(html).toContain('Bank of England');
    expect(html).toContain('href="https://www.bankofengland.co.uk/boeapps/database/"');
  });

  it('shows owner signals whether their source can be publicly displayed', () => {
    const publicHtml = renderToString(
      <SignalCard
        signal={makeSignal({
          source_policy: {
            source_id: 'frankfurter-ecb',
            label: 'Frankfurter (ECB)',
            source_url: 'https://frankfurter.dev/',
            rights_status: 'public',
            execution_mode: 'public_cloud',
            public_display_eligible: true,
            public_display_blocker: null,
            attribution: 'Frankfurter, using European Central Bank reference rates',
            last_reviewed: '2026-05-21',
          },
        })}
      />,
    );

    expect(publicHtml).not.toContain('data-testid="source-posture-badge"');
    expect(publicHtml).not.toContain('public-safe');

    const privateHtml = renderToString(
      <SignalCard
        signal={makeSignal({
          template_id: 'market-history',
          source_policy: {
            source_id: 'yahoo-finance-chart',
            label: 'Yahoo Finance',
            source_url: 'https://finance.yahoo.com/',
            rights_status: 'with-attribution',
            execution_mode: 'public_cloud',
            public_display_eligible: false,
            public_display_blocker: 'Private-only stopgap for yearly charts.',
            attribution: 'Yahoo Finance',
            last_reviewed: '2026-05-21',
          },
        })}
      />,
    );

    expect(privateHtml).not.toContain('data-source-posture="blocked"');
    expect(privateHtml).not.toContain('private-only');
    expect(privateHtml).not.toContain('Private-only stopgap for yearly charts.');
  });

  it('hides the owner source posture badge on read-only public signals', () => {
    const html = renderToString(
      <SignalCard
        readOnly
        signal={makeSignal({
          source_policy: {
            source_id: 'frankfurter-ecb',
            label: 'Frankfurter (ECB)',
            source_url: 'https://frankfurter.dev/',
            rights_status: 'public',
            execution_mode: 'public_cloud',
            public_display_eligible: true,
            public_display_blocker: null,
            attribution: 'Frankfurter, using European Central Bank reference rates',
            last_reviewed: '2026-05-21',
          },
        })}
      />,
    );

    expect(html).not.toContain('data-testid="source-posture-badge"');
  });

  it('shows the error message when last_error is fresher than last_ok_at', () => {
    const signal = makeSignal({
      status: {
        status: 'error',
        last_ok_at: NOW - 60_000,
        last_attempt_at: NOW - 5_000,
        last_error: 'upstream timeout',
        last_manual_request_at: null,
      },
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-status="error"');
    expect(html).toContain('Last refresh failed — this signal will retry');
    expect(html).toContain('title="upstream timeout"');
  });

  it('translates canonical adapter error codes into plain-English footers', () => {
    const cases: Array<[string, string]> = [
      ['fetch_failed: HTTP 522', 'Source is down (522) — will retry'],
      ['fetch_failed: HTTP 429', 'Rate limited by source — will retry'],
      ['fetch_failed: HTTP 404', 'Source returned not-found (404)'],
      [
        'fetch_failed: HTTP 401',
        'Source rejected the credentials (401) — reconnect auth or update the server secret',
      ],
      ['rate_limited', 'Rate limited by source — will retry'],
      [
        'rate_limited: GitHub advisory API rate limit',
        'GitHub API rate limit hit — add GITHUB_TOKEN or wait for retry',
      ],
      [
        'parse_failed: missing field',
        'Source response changed format — connector needs review (missing field)',
      ],
      [
        'unauthorized: refresh token expired',
        'Credentials expired or were rejected — reconnect auth or update the server secret',
      ],
      ['invalid_config: fx-pair', 'This signal configuration is invalid — open settings'],
    ];
    for (const [raw, friendly] of cases) {
      const signal = makeSignal({
        status: {
          status: 'error',
          last_ok_at: NOW - 60_000,
          last_attempt_at: NOW - 5_000,
          last_error: raw,
          last_manual_request_at: null,
        },
      });
      const html = renderToString(<SignalCard signal={signal} />);
      expect(html, `case ${raw}`).toContain(friendly);
      // The raw code is preserved in the title attribute as a tooltip so
      // power users can still see the underlying message on hover.
      expect(html, `case ${raw}`).toContain(`title="${raw}"`);
    }
  });

  it('renders setup-required secret errors as action-oriented copy', () => {
    const signal = makeSignal({
      template_id: 'trading-economics-market',
      config: { symbol: 'EURUSD:CUR' },
      points: [],
      status: {
        status: 'error',
        last_ok_at: null,
        last_attempt_at: NOW - 5_000,
        last_error: 'setup_required: needs TRADING_ECONOMICS_API_KEY',
        last_manual_request_at: null,
      },
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-status="setup"');
    expect(html).toContain('needs setup');
    expect(html).toContain('Trading Economics needs a server secret.');
    expect(html).toContain(
      'Add TRADING_ECONOMICS_API_KEY in Cloudflare Workers, then wait for the next scheduled refresh.',
    );
    expect(html).not.toContain('setup_required:');
    // Stripped error preserved in the title attribute so the secret name is
    // still visible on hover even if the footer truncates.
    expect(html).toContain('title="needs TRADING_ECONOMICS_API_KEY"');
    // The "Waiting for the next tick…" placeholder should not be shown
    // alongside a setup-needed note — they would compete with each other.
    expect(html).not.toContain('Waiting for the next tick');
  });

  it('does not expose owner-only setup details on public/read-only signals', () => {
    const html = renderToString(<SignalCard signal={makePublicSignal()} readOnly />);

    expect(html).toContain('This signal is temporarily unavailable.');
    expect(html).not.toContain('TRADING_ECONOMICS_API_KEY');
    expect(html).not.toContain('setup_required:');
  });

  it('explains setup-required source-policy and runner blockers', () => {
    const cases: Array<[string, string, string]> = [
      [
        'setup_required: Generic REST requires source review before cloud refresh',
        'Frankfurter (ECB) needs source review.',
        'Keep this signal private until the source policy is reviewed and marked safe to refresh.',
      ],
      [
        'setup_required: Calendar runs user-side and cannot be refreshed by cloud dispatch',
        'Frankfurter (ECB) needs a private runner.',
        'Cloud refresh cannot fetch this source; connect a user-side runner or use another source.',
      ],
      [
        'setup_required: Yahoo cannot refresh externally visible signal (source_not_public_display_eligible)',
        'Frankfurter (ECB) cannot refresh while shared or public.',
        'Make the collection and signal private, or switch to a public-cloud source.',
      ],
    ];
    for (const [raw, title, detail] of cases) {
      const html = renderToString(
        <SignalCard
          signal={makeSignal({
            points: [],
            status: {
              status: 'error',
              last_ok_at: null,
              last_attempt_at: NOW - 5_000,
              last_error: raw,
              last_manual_request_at: null,
            },
          })}
        />,
      );
      expect(html, `case ${raw}`).toContain(title);
      expect(html, `case ${raw}`).toContain(detail);
    }
  });

  it('renders a crypto watchlist title from config.pairs (array or comma-string)', () => {
    const fromArray = makeSignal({
      template_id: 'crypto-watchlist',
      config: { pairs: ['BTC-USD', 'ETH-USD'] },
      points: [
        { dimensions: { pair: 'BTC-USD' }, value: 65432.1, ts: NOW },
        { dimensions: { pair: 'ETH-USD' }, value: 3210.5, ts: NOW },
      ],
    });
    expect(renderToString(<SignalCard signal={fromArray} />)).toContain('Crypto: BTC, ETH');

    // Registry stores the param as a comma-joined string; same UI title.
    const fromString = makeSignal({
      template_id: 'crypto-watchlist',
      config: { pairs: 'BTC-USD,ETH-USD' },
      points: [{ dimensions: { pair: 'BTC-USD' }, value: 65432.1, ts: NOW }],
    });
    const html = renderToString(<SignalCard signal={fromString} />);
    expect(html).toContain('Crypto: BTC, ETH');
    expect(html).toContain('Coinbase');
  });

  it('collapses long watchlists to "first three + N more" so signals stay tidy', () => {
    const signal = makeSignal({
      template_id: 'crypto-watchlist',
      config: { pairs: 'BTC-USD,ETH-USD,SOL-USD,ADA-USD,DOGE-USD' },
      points: [],
    });
    expect(renderToString(<SignalCard signal={signal} />)).toContain(
      'Crypto: BTC, ETH, SOL +2 more',
    );
  });

  it('formats equity-watchlist titles and strips exchange suffixes', () => {
    const signal = makeSignal({
      template_id: 'equity-watchlist',
      config: { tickers: 'AZN.UK,VTI.US,SHEL.L,QQQ.US' },
      points: [],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('Stocks: AZN, VTI, SHEL +1 more');
    expect(html).toContain('Stooq');
  });

  it('renders Worker text values from value_text instead of numeric value', () => {
    const signal = makeSignal({
      template_id: 'github-trending',
      config: {},
      points: [
        {
          dimensions: { metric: 'next_event' },
          value: null,
          value_text: 'PBOC LPR Decision',
          unit: null,
        },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('PBOC LPR Decision');
    expect(html).not.toContain('null');
  });

  it('renders the weather signal as a hero temperature + descriptors', () => {
    const signal = makeSignal({
      template_id: 'weather',
      config: { location: 'London' },
      points: [
        {
          dimensions: { location: 'London', metric: 'temperature' },
          value: 13.4,
          unit: '°C',
          ts: NOW,
        },
        { dimensions: { location: 'London', metric: 'humidity' }, value: 84, unit: '%', ts: NOW },
        { dimensions: { location: 'London', metric: 'wind' }, value: 13.7, unit: 'm/s', ts: NOW },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-testid="weather-hero"');
    expect(html).toContain('13.4');
    expect(html).not.toContain('13.4000');
    expect(html).toContain('°C');
    expect(html).toContain('Mild');
    expect(html).toContain('Strong breeze');
    expect(html).toContain('humidity');
    expect(html).toContain('84%');
  });

  it('renders the weather forecast strip, WMO icon, and advice line', () => {
    // Pick a wet-day fixture so the advice picks the umbrella branch (the
    // most informative variant) and the forecast strip exposes per-hour
    // testids the assertions below can target.
    const FIXED_NOON = new Date();
    FIXED_NOON.setHours(12, 0, 0, 0);
    const noonMs = FIXED_NOON.getTime();
    const hourPoint = (
      hourOffset: number,
      metric: 'hourly_temperature' | 'hourly_precipitation_probability' | 'hourly_weather_code',
      value: number,
    ) => ({
      dimensions: { location: 'London', metric, hour: hourOffset },
      value,
      ts: noonMs + hourOffset * 3_600_000,
    });
    const hours = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((h) => [
      hourPoint(h, 'hourly_temperature', 12),
      hourPoint(h, 'hourly_precipitation_probability', h === 5 ? 80 : 20),
      hourPoint(h, 'hourly_weather_code', h === 5 ? 61 : 1),
    ]);
    const signal = makeSignal({
      template_id: 'weather',
      config: { location: 'London' },
      points: [
        {
          dimensions: { location: 'London', metric: 'temperature' },
          value: 12,
          unit: '°C',
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'feels_like' },
          value: 12,
          unit: '°C',
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'precipitation' },
          value: 0.3,
          unit: 'mm',
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'weather_code' },
          value: 61,
          ts: noonMs,
        },
        {
          dimensions: { location: 'London', metric: 'is_day' },
          value: 1,
          ts: noonMs,
        },
        ...hours,
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    // WMO icon is rendered via the shared WeatherIcon, which stamps the
    // raw condition on the <svg> as a data attribute. "rain" → WMO 61
    // (drizzle/rain) per the connector's mapping.
    expect(html).toContain('data-condition="rain"');
    // Forecast strip is present with 12 hour columns…
    expect(html).toContain('data-testid="weather-forecast"');
    for (let h = 1; h <= 12; h += 1) {
      expect(html).toContain(`data-hour-offset="${String(h)}"`);
    }
    // …and the peak rain hour is labelled by local time (5 hours after
    // noon → "5p"). The same label appears in the advice string so the
    // forecast and advice cross-reference each other.
    expect(html).toContain('>5p<');
    // Advice line uses the umbrella branch with the peak-rain percentage.
    expect(html).toContain('data-testid="weather-advice"');
    expect(html).toMatch(/Bring an umbrella — 80% rain at 5p/);
  });

  it('renders the air quality signal with a hero AQI + gauge + health text', () => {
    const signal = makeSignal({
      template_id: 'airquality',
      config: { location: 'London' },
      points: [
        { dimensions: { location: 'London', metric: 'aqi' }, value: 22, unit: 'EAQI', ts: NOW },
        { dimensions: { location: 'London', metric: 'pm2_5' }, value: 9.8, unit: 'µg/m³', ts: NOW },
        { dimensions: { location: 'London', metric: 'pm10' }, value: 12.9, unit: 'µg/m³', ts: NOW },
      ],
    });
    const html = renderToString(<SignalCard signal={signal} />);
    expect(html).toContain('data-testid="airquality-hero"');
    expect(html).toContain('22');
    expect(html).toContain('EAQI');
    expect(html).toContain('Good');
    expect(html).toContain('acceptable');
    expect(html).toContain('linear-gradient');
    expect(html).toMatch(/left:\s*22%/);
    expect(html).toContain('PM2.5');
    expect(html).toContain('PM10');
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
    // The truncated grid layout must not also render — labels like
    // "High exposure" / "Jobs" should not appear when the hero replaces them.
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
    // Each repo links to its GitHub page.
    expect(html).toContain('href="https://github.com/one/repo"');
    expect(html).toContain('href="https://github.com/two/repo"');
    // Language + stars rendered as separate visible elements (not truncated
    // tail of the value string).
    expect(html).toContain('TypeScript');
    expect(html).toContain('Python');
    expect(html).toContain('+40');
    expect(html).toContain('+20');
    expect(html).toContain('stars today');
  });
});
