import { describe, expect, it } from 'vitest';
import { matchPrompt } from './match';

describe('matchPrompt', () => {
  it('matches weather with extracted demo-city location and resolved lat/lon', () => {
    const plan = matchPrompt('weather in Madrid');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('weather');
    expect(signal?.config).toEqual({ location: 'Madrid', lat: 40.4168, lon: -3.7038 });
    expect(signal?.missing).toEqual([]);
    expect(signal?.source_label).toBe('Open-Meteo');
    expect(plan.unmatched).toHaveLength(0);
  });

  it('matches air quality with extracted demo-city location and resolved lat/lon', () => {
    const plan = matchPrompt('AQI in Madrid');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('airquality');
    expect(signal?.config).toEqual({ location: 'Madrid', lat: 40.4168, lon: -3.7038 });
    expect(signal?.missing).toEqual([]);
    expect(signal?.source_label).toBe('Open-Meteo Air Quality');
    expect(plan.unmatched).toHaveLength(0);
  });

  it('keeps unknown weather locations missing lat/lon', () => {
    const plan = matchPrompt('weather in Atlantis');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('weather');
    expect(signal?.config).toEqual({ location: 'Atlantis' });
    expect(signal?.missing).toEqual(expect.arrayContaining(['lat', 'lon']));
  });

  it('matches github repo activity with owner/repo from path', () => {
    const plan = matchPrompt('my GitHub PRs for example/antenna');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('github-repo-activity');
    expect(signal?.config).toEqual({ owner: 'example', repo: 'antenna' });
    expect(signal?.missing).toEqual([]);
  });

  it('matches github trending without repo params', () => {
    const plan = matchPrompt('GitHub Trending');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('github-trending');
    expect(signal?.config).toEqual({});
    expect(signal?.missing).toEqual([]);
    expect(signal?.rights_status).toBe('with-attribution');
    expect(signal?.source_label).toBe('GitHub Trending');
  });

  it('matches Karpathy jobs snapshot without params', () => {
    const plan = matchPrompt('Karpathy jobs snapshot');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('karpathy-jobs-snapshot');
    expect(signal?.config).toEqual({});
    expect(signal?.missing).toEqual([]);
    expect(signal?.rights_status).toBe('with-attribution');
    expect(signal?.source_label).toBe('Karpathy / BLS');
  });

  it('matches fx pair with base and quote and no missing params', () => {
    const plan = matchPrompt('track CHF/USD');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('fx-pair');
    expect(signal?.config).toEqual({ base: 'CHF', quote: 'USD' });
    expect(signal?.missing).toEqual([]);
    expect(signal?.rights_status).toBe('public');
  });

  it('splits "ETH and SOL spot" into two crypto-watchlist fragments', () => {
    // " and " is a fragment boundary, so each side is matched independently.
    const plan = matchPrompt('ETH and SOL spot');
    expect(plan.signals.length).toBeGreaterThanOrEqual(1);
    for (const signal of plan.signals) {
      expect(signal.template_id).toBe('crypto-watchlist');
    }
    const allPairs = plan.signals.map((b) => b.config.pairs).join(',');
    expect(allPairs).toContain('ETH-USD');
    expect(allPairs).toContain('SOL-USD');
  });

  it('matches a market history chart request', () => {
    const plan = matchPrompt('yearly graph for BA.L');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('market-history');
    expect(signal?.config).toEqual({ symbol: 'BA.L' });
    expect(signal?.rights_status).toBe('with-attribution');
  });

  it('carries market history context across ticker lists', () => {
    const plan = matchPrompt('yearly graphs for BA.L, VTI, 0P000125KV.L, ANTO.L and PII');
    expect(plan.signals).toHaveLength(5);
    expect(plan.signals.map((signal) => signal.template_id)).toEqual([
      'market-history',
      'market-history',
      'market-history',
      'market-history',
      'market-history',
    ]);
    expect(plan.signals.map((signal) => signal.config.symbol)).toEqual([
      'BA.L',
      'VTI',
      '0P000125KV.L',
      'ANTO.L',
      'PII',
    ]);
    expect(plan.unmatched).toEqual([]);
  });

  it('matches a crypto history chart request', () => {
    const plan = matchPrompt('bitcoin yearly graph');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('crypto-history');
    expect(signal?.config).toEqual({ pairs: 'BTC-USD' });
    expect(signal?.rights_status).toBe('public');
  });

  it('carries crypto history context across coin lists', () => {
    const plan = matchPrompt('BTC, ETH and SOL yearly graphs');
    expect(plan.signals).toHaveLength(3);
    expect(plan.signals.map((signal) => signal.template_id)).toEqual([
      'crypto-history',
      'crypto-history',
      'crypto-history',
    ]);
    expect(plan.signals.map((signal) => signal.config.pairs)).toEqual([
      'BTC-USD',
      'ETH-USD',
      'SOL-USD',
    ]);
    expect(plan.unmatched).toEqual([]);
  });

  it('carries history intent to ticker lists even when the first ticker is bare', () => {
    const plan = matchPrompt('BA.L, VTI and ANTO.L yearly graphs');
    expect(plan.signals).toHaveLength(3);
    expect(plan.signals.map((signal) => signal.template_id)).toEqual([
      'market-history',
      'market-history',
      'market-history',
    ]);
    expect(plan.signals.map((signal) => signal.config.symbol)).toEqual(['BA.L', 'VTI', 'ANTO.L']);
    expect(plan.unmatched).toEqual([]);
  });

  it('matches Trading Economics macro market requests', () => {
    const plan = matchPrompt('Trading Economics UK 10Y gilt');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('trading-economics-market');
    expect(signal?.config).toEqual({
      symbol: 'GUKG10:IND',
      label: 'UK 10Y gilt',
      unit: '%',
      sourceUrl: 'https://tradingeconomics.com/united-kingdom/government-bond-yield',
    });
    expect(signal?.rights_status).toBe('with-attribution');
    expect(signal?.source_label).toBe('Trading Economics');
  });

  it('matches default macro market requests to free-source presets', () => {
    const plan = matchPrompt('UK 10Y gilt and GBP/USD one year chart and gold and WTI crude oil');
    expect(plan.signals).toHaveLength(4);
    expect(plan.signals.map((signal) => signal.template_id)).toEqual([
      'macro-market-history',
      'macro-market-history',
      'macro-market-history',
      'macro-market-history',
    ]);
    expect(plan.signals.map((signal) => signal.config.preset)).toEqual([
      'uk-10y-gilt',
      'gbp-usd',
      'gold',
      'crude-oil',
    ]);
    expect(plan.signals.every((signal) => signal.source_label === 'Free macro sources')).toBe(true);
  });

  it('matches recent CISA KEV vulnerability prompts', () => {
    const plan = matchPrompt('security vulnerabilities and actively exploited CVEs');
    expect(plan.signals).toHaveLength(2);
    expect(plan.signals.map((signal) => signal.template_id)).toEqual([
      'cisa-kev-recent',
      'cisa-kev-recent',
    ]);
    expect(plan.signals.every((signal) => Object.keys(signal.config).length === 0)).toBe(true);
    expect(plan.unmatched).toEqual([]);
  });

  it('matches Cloudflare status incident prompts', () => {
    const plan = matchPrompt('Cloudflare incidents and Workers status');
    expect(plan.signals).toHaveLength(2);
    expect(plan.signals.map((signal) => signal.template_id)).toEqual([
      'cloudflare-incidents',
      'cloudflare-incidents',
    ]);
    expect(plan.signals.every((signal) => signal.source_label === 'Cloudflare Status')).toBe(true);
    expect(plan.unmatched).toEqual([]);
  });

  it('matches GitHub npm security advisory prompts', () => {
    const plan = matchPrompt('npm security advisories');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('github-security-advisories');
    expect(signal?.config).toEqual({});
    expect(signal?.rights_status).toBe('public');
    expect(signal?.source_label).toBe('GitHub Security Advisories');
    expect(plan.unmatched).toEqual([]);
  });

  it('matches UK economic calendar prompts', () => {
    const plan = matchPrompt('UK economic calendar');
    expect(plan.signals).toHaveLength(1);
    const signal = plan.signals[0];
    expect(signal?.template_id).toBe('uk-economic-calendar');
    expect(signal?.config).toEqual({});
    expect(signal?.rights_status).toBe('public');
    expect(signal?.source_label).toBe('Bank of England');
    expect(plan.unmatched).toEqual([]);
  });

  it('matches a complete manual cost without persisting billing credentials', () => {
    const plan = matchPrompt('track £12.34 Cloudflare cost month to date');
    expect(plan.signals).toHaveLength(1);
    expect(plan.signals[0]).toMatchObject({
      template_id: 'manual-cost',
      config: {
        amount: 12.34,
        currency: 'GBP',
        period: 'month_to_date',
        provider: 'Cloudflare',
        service: 'All services',
      },
      missing: [],
      rights_status: 'requires-auth',
      source_label: 'Manual cost entry',
    });
  });

  it('asks for amount and currency when a cost prompt omits them', () => {
    const plan = matchPrompt('track Modal spending');
    expect(plan.signals).toHaveLength(1);
    expect(plan.signals[0]?.template_id).toBe('manual-cost');
    expect(plan.signals[0]?.config).toEqual({
      period: 'month_to_date',
      provider: 'Modal',
    });
    expect(plan.signals[0]?.missing).toEqual(['amount', 'currency']);
  });

  it.each([
    ['is cloudflare ok', 'cloudflare-incidents'],
    ['cf outage', 'cloudflare-incidents'],
    ['are workers down', 'cloudflare-incidents'],
    ['workers kv down', 'cloudflare-incidents'],
    ['are there any new high severity npm vulns', 'github-security-advisories'],
    ['security vulnerabilities being exploited', 'cisa-kev-recent'],
    ['karpathy hiring', 'karpathy-jobs-snapshot'],
    ['show me AAPL.US over time', 'market-history'],
  ])('routes production setup-request prompt "%s"', (prompt, templateId) => {
    const plan = matchPrompt(prompt);
    expect(plan.signals).toHaveLength(1);
    expect(plan.signals[0]?.template_id).toBe(templateId);
    expect(plan.unmatched).toEqual([]);
  });

  it('captures unmatched fragments when nothing fires', () => {
    const plan = matchPrompt('silver futures every hour');
    expect(plan.signals).toHaveLength(0);
    expect(plan.unmatched).toHaveLength(1);
    expect(plan.unmatched[0]?.fragment).toBe('silver futures every hour');
    expect(plan.unmatched[0]?.blocker_reason).toBe('unsupported_source');
    expect(plan.unmatched[0]?.acquisition_state).toBe('source_unavailable');
    expect(plan.unmatched[0]?.acquisition_strategy).toBe('manual_blocker');
  });

  it('does not propose arbitrary REST URLs until source policy is explicit', () => {
    const plan = matchPrompt('track https://example.test/metrics.json');
    expect(plan.signals).toHaveLength(0);
    expect(plan.unmatched).toEqual([
      {
        fragment: 'track https://example.test/metrics.json',
        blocker_reason: 'unsafe_generated_extraction',
        acquisition_state: 'generated_candidate',
        acquisition_strategy: 'manual_blocker',
      },
    ]);
  });
});
