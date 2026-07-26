import { describe, expect, it } from 'vitest';
import { sourcePolicyForTemplate } from '@antenna/registry';
import { matchPrompt } from './match';

type ExpectedSignal = {
  readonly templateId: string;
  readonly sourceLabel: string;
};

const expectSignals = (prompt: string, expectedSignals: readonly ExpectedSignal[]) => {
  const plan = matchPrompt(prompt);
  expect(plan.unmatched, prompt).toEqual([]);
  expect(
    plan.signals.map((signal) => ({
      templateId: signal.template_id,
      sourceLabel: signal.source_label,
      missing: signal.missing,
    })),
    prompt,
  ).toEqual(expectedSignals.map((signal) => ({ ...signal, missing: [] })));
  return plan.signals;
};

describe('Ask Antenna prompt parity smoke', () => {
  it.each([
    {
      prompt: 'weather in Madrid',
      signals: [{ templateId: 'weather', sourceLabel: 'Open-Meteo' }],
    },
    {
      prompt: 'track CHF/USD',
      signals: [{ templateId: 'fx-pair', sourceLabel: 'Frankfurter (ECB)' }],
    },
    {
      prompt: 'BTC yearly graph',
      signals: [{ templateId: 'crypto-history', sourceLabel: 'Coinbase' }],
    },
    {
      prompt: 'npm security advisories',
      signals: [
        { templateId: 'github-security-advisories', sourceLabel: 'GitHub Security Advisories' },
      ],
    },
    {
      prompt: 'Cloudflare incidents',
      signals: [{ templateId: 'cloudflare-incidents', sourceLabel: 'Cloudflare Status' }],
    },
    {
      prompt: 'security vulnerabilities being exploited',
      signals: [{ templateId: 'cisa-kev-recent', sourceLabel: 'CISA KEV' }],
    },
    {
      prompt: 'UK economic calendar',
      signals: [{ templateId: 'uk-economic-calendar', sourceLabel: 'Bank of England' }],
    },
  ])('keeps public-safe prompt "$prompt" on public cloud sources', ({ prompt, signals }) => {
    const matched = expectSignals(prompt, signals);
    for (const signal of matched) {
      const policy = sourcePolicyForTemplate(signal.template_id);
      expect(policy?.executionMode, signal.template_id).toBe('public_cloud');
      expect(policy?.publicDisplayEligible, signal.template_id).toBe(true);
      expect(policy?.rightsStatus, signal.template_id).toBe('public');
    }
  });

  it.each([
    {
      prompt: 'yearly graph for BA.L',
      signals: [{ templateId: 'market-history', sourceLabel: 'Yahoo Finance' }],
    },
    {
      prompt: 'UK 10Y gilt and GBP/USD one year chart',
      signals: [
        { templateId: 'macro-market-history', sourceLabel: 'Free macro sources' },
        { templateId: 'macro-market-history', sourceLabel: 'Free macro sources' },
      ],
    },
    {
      prompt: 'GitHub Trending',
      signals: [{ templateId: 'github-trending', sourceLabel: 'GitHub Trending' }],
    },
    {
      prompt: 'Karpathy jobs snapshot',
      signals: [{ templateId: 'karpathy-jobs-snapshot', sourceLabel: 'Karpathy / BLS' }],
    },
  ])('keeps dogfood-only prompt "$prompt" clearly non-public', ({ prompt, signals }) => {
    const matched = expectSignals(prompt, signals);
    for (const signal of matched) {
      const policy = sourcePolicyForTemplate(signal.template_id);
      expect(policy?.executionMode, signal.template_id).toBe('public_cloud');
      expect(policy?.publicDisplayEligible, signal.template_id).toBe(false);
      expect(signal.rights_status, signal.template_id).toBe('with-attribution');
    }
  });

  it.each([
    {
      prompt: 'track https://example.test/metrics.json',
      fragment: 'track https://example.test/metrics.json',
      blocker_reason: 'unsafe_generated_extraction',
      acquisition_state: 'generated_candidate',
      acquisition_strategy: 'manual_blocker',
    },
    {
      prompt: 'US treasury auctions',
      fragment: 'US treasury auctions',
      blocker_reason: 'unsupported_source',
      acquisition_state: 'source_unavailable',
      acquisition_strategy: 'manual_blocker',
    },
  ])('keeps unsupported prompt "$prompt" as a typed setup blocker', (expected) => {
    const plan = matchPrompt(expected.prompt);
    expect(plan.signals).toEqual([]);
    expect(plan.unmatched).toEqual([
      {
        fragment: expected.fragment,
        blocker_reason: expected.blocker_reason,
        acquisition_state: expected.acquisition_state,
        acquisition_strategy: expected.acquisition_strategy,
      },
    ]);
  });
});
