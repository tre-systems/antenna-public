import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanRecord, ProposedSignal } from '@antenna/shared';
import { confirmPlan, rejectPlan, submitPrompt } from './plans';
import { captureFetch } from './test-support';

const samplePlan: PlanRecord = {
  id: 'p1',
  collection_id: 'd1',
  prompt: 'track CHF/USD',
  status: 'proposed',
  plan: { prompt: 'track CHF/USD', signals: [], unmatched: [] },
  created_at: 0,
};

const sampleSignal: ProposedSignal = {
  template_id: 'fx-pair',
  display_name: 'CHF/USD',
  config: { base: 'CHF', quote: 'USD' },
  missing: [],
  refresh_seconds: 60,
  rights_status: 'public',
  source_label: 'Frankfurter (ECB)',
};

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api plan endpoints', () => {
  it('submitPrompt POSTs to /api/plan with the prompt body', async () => {
    const calls = captureFetch(samplePlan);
    const result = await submitPrompt('track CHF/USD');
    expect(result).toEqual(samplePlan);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/api/plan');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ prompt: 'track CHF/USD' }));
  });

  it('submitPrompt can target a selected collection', async () => {
    const calls = captureFetch({ ...samplePlan, collection_id: 'collection/selected' });
    const result = await submitPrompt('track CHF/USD', 'collection/selected');
    expect(result.collection_id).toBe('collection/selected');
    expect(calls[0]?.url).toBe('/api/plan');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ prompt: 'track CHF/USD', collection_id: 'collection/selected' }),
    );
  });

  it('submitPrompt omits an undefined collection id', async () => {
    const calls = captureFetch(samplePlan);
    await submitPrompt('track CHF/USD', undefined);
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ prompt: 'track CHF/USD' }));
  });

  it('confirmPlan POSTs edited signals to /api/plan/:id/confirm', async () => {
    const calls = captureFetch({ created_signal_ids: ['b1'] });
    const result = await confirmPlan('p1', [sampleSignal]);
    expect(result.created_signal_ids).toEqual(['b1']);
    expect(calls[0]?.url).toBe('/api/plan/p1/confirm');
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ edited_signals: [{ config: sampleSignal.config }] }),
    );
  });

  it('rejectPlan POSTs to /api/plan/:id/reject', async () => {
    const calls = captureFetch({ ok: true });
    const result = await rejectPlan('p1');
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe('/api/plan/p1/reject');
    expect(calls[0]?.init?.method).toBe('POST');
  });
});
