import { describe, it, expect } from 'vitest';
import renderToString from 'preact-render-to-string';
import { SignalCard } from './SignalCard';
import { makePublicSignal, makeSignal, NOW } from './signal-card-test-fixtures';

describe('SignalCard status and errors', () => {
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
      // Raw code stays in the title attribute so power users can still hover it.
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
    // Stripped error stays in the title so the secret name survives truncation.
    expect(html).toContain('title="needs TRADING_ECONOMICS_API_KEY"');
    // The setup note replaces the "Waiting for the next tick…" placeholder
    // rather than competing with it.
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
});
