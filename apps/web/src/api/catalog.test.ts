import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConnectorRequests, getTemplates } from './catalog';
import { captureFetch } from './test-support';

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api catalog endpoints', () => {
  it('getConnectorRequests GETs /api/requests', async () => {
    const calls = captureFetch([]);
    const result = await getConnectorRequests();
    expect(result).toEqual([]);
    expect(calls[0]?.url).toBe('/api/requests');
    expect(calls[0]?.init?.method).toBeUndefined();
  });

  it('getTemplates GETs the registry template metadata endpoint', async () => {
    const calls = captureFetch([
      {
        id: 'fx-pair',
        display_name: 'FX pair',
        param_keys: ['base', 'quote'],
        planner_enabled: true,
        rights_status: 'public',
        default_refresh_seconds: 900,
        retain_raw_payload: false,
        server_secret_required: false,
        setup_message: null,
        source_policy: null,
      },
    ]);
    const result = await getTemplates();
    expect(result[0]?.id).toBe('fx-pair');
    expect(calls[0]?.url).toBe('/api/templates');
    expect(calls[0]?.init?.method).toBeUndefined();
  });
});
