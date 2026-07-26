import { describe, expect, it } from 'vitest';
import { templates } from '@antenna/registry';
import { prepareAdapterConfig } from './config';
import type { Client, CollectionRow, DispatchEnv, DispatchTemplate, SignalRow } from './types';

const templateById = (id: string): DispatchTemplate => {
  const found = templates.find((template) => template.id === id);
  if (!found) throw new Error(`missing template fixture: ${id}`);
  return found;
};

// Most templates need nothing from D1; only the deployment-stats template does,
// and it gets its own suite below with a real in-memory database.
const fakeClient = {} as unknown as Client;
const collection = (ownerId = 'owner-1'): CollectionRow =>
  ({ id: 'collection-1', ownerId }) as unknown as CollectionRow;
const env = (overrides: Partial<DispatchEnv> = {}): DispatchEnv =>
  overrides as unknown as DispatchEnv;
const signal = (config: string): SignalRow =>
  ({ config, collectionId: 'collection-1' }) as unknown as SignalRow;

const TE_CONFIG =
  '{"symbol":"XAUUSD:CUR","label":"Gold","unit":"USD/t.oz","sourceUrl":"https://tradingeconomics.com/commodity/gold"}';

describe('prepareAdapterConfig', () => {
  it('injects the server GitHub token into GitHub templates', async () => {
    const result = await prepareAdapterConfig(
      fakeClient,
      env({ GITHUB_TOKEN: 'ghp_server' }),
      signal('{}'),
      collection(),
      templateById('github-trending'),
    );
    expect(result).toEqual({ ok: true, config: { githubToken: 'ghp_server' } });
  });

  it('omits the GitHub token when the server has none configured', async () => {
    const result = await prepareAdapterConfig(
      fakeClient,
      env(),
      signal('{}'),
      collection(),
      templateById('github-trending'),
    );
    expect(result).toEqual({ ok: true, config: {} });
  });

  it('does not inject a GitHub token into non-GitHub templates', async () => {
    const result = await prepareAdapterConfig(
      fakeClient,
      env({ GITHUB_TOKEN: 'ghp_server' }),
      signal('{"base":"EUR","quote":"USD"}'),
      collection(),
      templateById('fx-pair'),
    );
    expect(result).toEqual({ ok: true, config: { base: 'EUR', quote: 'USD' } });
  });

  it('fails closed with setup_required when a required server secret is absent', async () => {
    const result = await prepareAdapterConfig(
      fakeClient,
      env(),
      signal(TE_CONFIG),
      collection(),
      templateById('trading-economics-market'),
    );
    expect(result).toEqual({
      ok: false,
      message:
        'setup_required: Set TRADING_ECONOMICS_API_KEY to enable Trading Economics market cards.',
    });
  });

  it('injects a present server secret under the template configKey', async () => {
    const result = await prepareAdapterConfig(
      fakeClient,
      env({ TRADING_ECONOMICS_API_KEY: 'te_secret' }),
      signal(TE_CONFIG),
      collection(),
      templateById('trading-economics-market'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toMatchObject({ symbol: 'XAUUSD:CUR', apiKey: 'te_secret' });
    }
  });
});
