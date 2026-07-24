import { describe, expect, it } from 'vitest';
import { templates } from '@antenna/registry';
import { prepareAdapterConfig } from './config';
import type { Client, DispatchEnv, DispatchTemplate, SignalRow } from './types';

const templateById = (id: string): DispatchTemplate => {
  const found = templates.find((template) => template.id === id);
  if (!found) throw new Error(`missing template fixture: ${id}`);
  return found;
};

// prepareAdapterConfig only touches signal config and env secrets — no per-owner auth injection.
const fakeClient = {} as unknown as Client;
const env = (overrides: Partial<DispatchEnv> = {}): DispatchEnv =>
  overrides as unknown as DispatchEnv;
const signal = (config: string): SignalRow =>
  ({ config, collectionId: 'collection-1' }) as unknown as SignalRow;

const TE_CONFIG =
  '{"symbol":"XAUUSD:CUR","label":"Gold","unit":"USD/t.oz","sourceUrl":"https://tradingeconomics.com/commodity/gold"}';

describe('prepareAdapterConfig', () => {
  it('injects the server GitHub token into GitHub templates', () => {
    const result = prepareAdapterConfig(
      fakeClient,
      env({ GITHUB_TOKEN: 'test-github-token' }),
      signal('{}'),
      templateById('github-trending'),
    );
    expect(result).toEqual({ ok: true, config: { githubToken: 'test-github-token' } });
  });

  it('omits the GitHub token when the server has none configured', () => {
    const result = prepareAdapterConfig(
      fakeClient,
      env(),
      signal('{}'),
      templateById('github-trending'),
    );
    expect(result).toEqual({ ok: true, config: {} });
  });

  it('does not inject a GitHub token into non-GitHub templates', () => {
    const result = prepareAdapterConfig(
      fakeClient,
      env({ GITHUB_TOKEN: 'test-github-token' }),
      signal('{"base":"EUR","quote":"USD"}'),
      templateById('fx-pair'),
    );
    expect(result).toEqual({ ok: true, config: { base: 'EUR', quote: 'USD' } });
  });

  it('fails closed with setup_required when a required server secret is absent', () => {
    const result = prepareAdapterConfig(
      fakeClient,
      env(),
      signal(TE_CONFIG),
      templateById('trading-economics-market'),
    );
    expect(result).toEqual({
      ok: false,
      message:
        'setup_required: Set TRADING_ECONOMICS_API_KEY to enable Trading Economics market cards.',
    });
  });

  it('injects a present server secret under the template configKey', () => {
    const result = prepareAdapterConfig(
      fakeClient,
      env({ TRADING_ECONOMICS_API_KEY: 'te_secret' }),
      signal(TE_CONFIG),
      templateById('trading-economics-market'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toMatchObject({ symbol: 'XAUUSD:CUR', apiKey: 'te_secret' });
    }
  });
});
