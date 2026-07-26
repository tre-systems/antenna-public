import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { CollectionTemplateListResponse, TemplateRecord } from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import { templatesRoute } from './templates';

const buildApp = (): Hono<{ Variables: AuthVars }> => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', { id: 'user-1', email: 'user@test.local', name: 'User' });
    await next();
  });
  app.route('/api/templates', templatesRoute);
  return app;
};

describe('GET /api/templates', () => {
  it('returns registry metadata without executable template internals', async () => {
    const res = await buildApp().request('/api/templates');

    expect(res.status).toBe(200);
    const body: TemplateRecord[] = await res.json();
    expect(body.length).toBeGreaterThan(5);
    expect(body[0]).toEqual({
      id: 'fx-pair',
      display_name: 'FX pair',
      param_keys: ['base', 'quote'],
      planner_enabled: true,
      rights_status: 'public',
      default_refresh_seconds: 900,
      retain_raw_payload: false,
      server_secret_required: false,
      setup_message: null,
      source_policy: {
        source_id: 'frankfurter-ecb',
        label: 'Frankfurter (ECB)',
        source_url: 'https://www.frankfurter.app/',
        rights_status: 'public',
        execution_mode: 'public_cloud',
        public_display_eligible: true,
        public_display_blocker: null,
        attribution: 'Frankfurter, using European Central Bank reference rates',
        last_reviewed: '2026-05-21',
      },
    });
    expect(JSON.stringify(body)).not.toContain('matchHints');
    expect(JSON.stringify(body)).not.toContain('adapter');
  });

  it('surfaces planner and setup state for non-default templates', async () => {
    const res = await buildApp().request('/api/templates');
    const body: TemplateRecord[] = await res.json();

    expect(body.find((item) => item.id === 'rest-metric')).toMatchObject({
      planner_enabled: false,
      source_policy: {
        rights_status: 'needs-review',
        execution_mode: 'private_cloud',
        public_display_eligible: false,
      },
    });
    const tradingEconomics = body.find((item) => item.id === 'trading-economics-market');
    expect(tradingEconomics?.server_secret_required).toBe(true);
    expect(tradingEconomics?.setup_message).toContain('TRADING_ECONOMICS_API_KEY');
    expect(body.find((item) => item.id === 'manual-metric')).toMatchObject({
      source_policy: {
        execution_mode: 'private_cloud',
        public_display_eligible: false,
      },
    });
  });
});

describe('GET /api/templates/collections', () => {
  it('returns curated collection templates without community discovery', async () => {
    const res = await buildApp().request('/api/templates/collections');

    expect(res.status).toBe(200);
    const body: CollectionTemplateListResponse = await res.json();
    expect(body.templates.map((template) => template.id)).toEqual([
      'founder-morning',
      'ai-frontier-watch',
      'problem-radar',
      'trader-morning',
      'ops-morning',
      'investor-watchlist',
      'local-living',
    ]);
    expect(body.templates.every((template) => template.kind === 'curated')).toBe(true);
    expect(body.templates[0]).toMatchObject({
      id: 'founder-morning',
      kind: 'curated',
      label: 'Founder Morning',
    });
    expect(body.templates[0]?.signals[0]).toEqual({
      template_id: 'market-overview',
      display_name: 'Market overview',
      title: 'Market overview',
      config: {},
      refresh_seconds: 1800,
    });
    expect(JSON.stringify(body)).not.toContain('adapter');
    expect(JSON.stringify(body)).not.toContain('matchHints');
    expect(JSON.stringify(body)).not.toContain('kind":"community');
  });
});
