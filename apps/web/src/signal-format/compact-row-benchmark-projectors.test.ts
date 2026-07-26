import { describe, expect, it } from 'vitest';
import { compactRowsCardData } from './compact-rows';
import { makeSignal } from './test-support';

describe('compactRowsCardData benchmark rows', () => {
  it('shapes aa-highlights intelligence into rows with index score chips', () => {
    const signal = makeSignal({
      template_id: 'aa-highlights',
      config: { category: 'intelligence' },
      points: [
        {
          dimensions: { metric: 'aa_intelligence', rank: 1, model: 'GPT-5.5 (xhigh)' },
          value: 60.24,
          unit: '',
          source_url: 'https://artificialanalysis.ai/models/gpt-5-5',
        },
        {
          dimensions: { metric: 'aa_intelligence', rank: 2, model: 'Claude Opus 4.7 (max)' },
          value: 57.28,
          unit: '',
        },
        {
          dimensions: { metric: 'aa_intelligence', rank: 3, model: 'Kimi K2.6' },
          value: 43.5,
          unit: '',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);
    expect(out?.rows[0]?.title).toBe('GPT-5.5 (xhigh)');
    expect(out?.rows[0]?.chip).toBe('60.2');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[0]?.href).toBe('https://artificialanalysis.ai/models/gpt-5-5');
    expect(out?.rows[1]?.chipTone).toBe('ok');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 by intelligence');
  });

  it('shows frontier intelligence, speed, and price in one comparable row set', () => {
    const signal = makeSignal({
      template_id: 'aa-frontier',
      points: [
        {
          dimensions: {
            metric: 'aa_frontier',
            rank: 1,
            model: 'Model A',
            speed: 125,
            price: 2.5,
          },
          value: 61,
          unit: 'index',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.summary).toBe('Top 1 · score, speed & price');
    expect(out?.rows[0]).toMatchObject({
      title: 'Model A',
      subtitle: '125 tok/s · $2.5/M',
      chip: '61.0',
    });
  });

  it('shapes aa-highlights speed into rows with tok/s chips', () => {
    const signal = makeSignal({
      template_id: 'aa-highlights',
      config: { category: 'speed' },
      points: [
        {
          dimensions: { metric: 'aa_speed', rank: 1, model: 'gpt-oss-120b (high)' },
          value: 248.3,
          unit: 'tok/s',
        },
        {
          dimensions: { metric: 'aa_speed', rank: 2, model: 'Gemini 3.5 Flash' },
          value: 72,
          unit: 'tok/s',
        },
        {
          dimensions: { metric: 'aa_speed', rank: 3, model: 'Slow Model' },
          value: 30,
          unit: 'tok/s',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows[0]?.chip).toBe('248 tok/s');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[1]?.chipTone).toBe('info');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 fastest');
  });

  it('shapes aa-highlights price into rows with $/M chips', () => {
    const signal = makeSignal({
      template_id: 'aa-highlights',
      config: { category: 'price' },
      points: [
        {
          dimensions: { metric: 'aa_price', rank: 1, model: 'gpt-oss-120b (high)' },
          value: 0.195,
          unit: '$/M',
        },
        {
          dimensions: { metric: 'aa_price', rank: 2, model: 'Claude Opus 4.7 (max)' },
          value: 4.1,
          unit: '$/M',
        },
        {
          dimensions: { metric: 'aa_price', rank: 3, model: 'GPT-5.5 (xhigh)' },
          value: 8.0,
          unit: '$/M',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out?.rows[0]?.chip).toBe('$0.20/M');
    expect(out?.rows[0]?.chipTone).toBe('ok');
    expect(out?.rows[1]?.chipTone).toBe('info');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 cheapest');
  });

  it('shapes tbench-leaderboard into rows with accuracy chips and ok/info/muted tones', () => {
    const signal = makeSignal({
      template_id: 'tbench-leaderboard',
      points: [
        {
          dimensions: {
            metric: 'leaderboard_entry',
            rank: 1,
            agent: 'Codex CLI',
            model: 'GPT-5.5',
            agent_org: 'OpenAI',
          },
          value: 83.4,
          unit: '%',
          source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
        },
        {
          dimensions: {
            metric: 'leaderboard_entry',
            rank: 2,
            agent: 'Terminus 2',
            model: 'Gemini 3 Pro',
            agent_org: 'TerminalBench',
          },
          value: 74.4,
          unit: '%',
          source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
        },
        {
          dimensions: {
            metric: 'leaderboard_entry',
            rank: 3,
            agent: 'Some Agent',
            model: 'Old Model',
            agent_org: 'Org',
          },
          value: 60.0,
          unit: '%',
          source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.1',
        },
      ],
    });
    const out = compactRowsCardData(signal);
    expect(out).not.toBeNull();
    expect(out?.rows).toHaveLength(3);

    const first = out?.rows[0];
    expect(first?.title).toBe('Codex CLI');
    expect(first?.subtitle).toBe('GPT-5.5');
    expect(first?.chip).toBe('83.4%');
    expect(first?.chipTone).toBe('ok');
    expect(first?.href).toBe('https://www.tbench.ai/leaderboard/terminal-bench/2.1');

    expect(out?.rows[1]?.chipTone).toBe('info');
    expect(out?.rows[2]?.chipTone).toBe('muted');
    expect(out?.summary).toBe('Top 3 verified');
  });
});
