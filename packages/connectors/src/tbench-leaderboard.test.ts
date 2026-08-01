import { afterEach, describe, expect, it, vi } from 'vitest';
import { tbenchLeaderboard } from './tbench-leaderboard';

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeRow = (
  agent: string,
  model: string,
  agentOrg: string,
  accuracy: string,
  verified = true,
): string => {
  const badge = verified ? `<span data-slot="hover-card-trigger"></span>` : '';
  return [
    `<tr>`,
    `<td></td>`,
    `<td>${badge}1</td>`,
    `<td>${agent}</td>`,
    `<td>${model}</td>`,
    `<td>2026-05-01</td>`,
    `<td>${agentOrg}</td>`,
    `<td>OpenAI</td>`,
    `<td>${accuracy}</td>`,
    `</tr>`,
  ].join('');
};

const makeHtml = (...rows: string[]): string =>
  `<html><body><table>${rows.join('')}</table></body></html>`;

const makeCurrentRow = (agent: string, model: string, agentOrg: string, accuracy: string): string =>
  [
    `<tr>`,
    `<td><a aria-label="Open rank 1 details in Harbor Hub">1</a></td>`,
    `<td><a>${agent}</a></td>`,
    `<td><a>${model}</a></td>`,
    `<td>xhigh</td>`,
    `<td><strong>${accuracy}</strong><span> ± 1.2%</span></td>`,
    `<td>Jun 7, 2026</td>`,
    `<td><a>${agentOrg}</a></td>`,
    `<td>Model Org</td>`,
    `<td>#75</td>`,
    `<td>-0.2%</td>`,
    `<td>$552.67</td>`,
    `</tr>`,
  ].join('');

const mockFetch = (html: string, status = 200) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(html, {
        status,
        headers: { 'content-type': 'text/html' },
      }),
    ),
  );
};

describe('tbenchLeaderboard', () => {
  it('parses the current verified Harbor Hub leaderboard rows', async () => {
    mockFetch(makeHtml(makeCurrentRow('Claude Code', 'Fable 5', 'Anthropic', '83.8%')));

    const result = await tbenchLeaderboard({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]).toMatchObject({
      dimensions: {
        agent: 'Claude Code',
        model: 'Fable 5',
        agent_org: 'Anthropic',
        cost_usd: 552.67,
      },
      value: 83.8,
    });
  });

  it('returns verified entries sorted by rank, up to the default limit', async () => {
    const html = makeHtml(
      makeRow('Codex CLI', 'GPT-5.5', 'OpenAI', '83.4%± 2.2'),
      makeRow('Terminus 2', 'GPT-5.5', 'TerminalBench', '78.2%± 1.8'),
      makeRow('Terminus 2', 'Gemini 3 Pro', 'TerminalBench', '74.4%± 1.5'),
      makeRow('Devin', 'Claude 4 Opus', 'Cognition', '71.0%± 1.2'),
      makeRow('Mariner', 'Gemini 3 Pro', 'Google DeepMind', '68.5%± 2.0'),
      makeRow('Extra', 'SomeModel', 'SomeOrg', '60.0%± 1.0'), // beyond default limit of 5
    );
    mockFetch(html);

    const result = await tbenchLeaderboard({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(5);

    const first = result.points[0];
    expect(first?.dimensions.agent).toBe('Codex CLI');
    expect(first?.dimensions.model).toBe('GPT-5.5');
    expect(first?.dimensions.agent_org).toBe('OpenAI');
    expect(first?.dimensions.metric).toBe('leaderboard_entry');
    expect(first?.dimensions.rank).toBe(1);
    expect(first?.value).toBe(83.4);
    expect(first?.unit).toBe('%');
  });

  it('skips non-verified rows', async () => {
    const html = makeHtml(
      makeRow('Verified Agent', 'Model A', 'Org A', '80.0%± 1.0', true),
      makeRow('Unverified Agent', 'Model B', 'Org B', '90.0%± 0.5', false),
    );
    mockFetch(html);

    const result = await tbenchLeaderboard({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(1);
    expect(result.points[0]?.dimensions.agent).toBe('Verified Agent');
  });

  it('respects a custom limit', async () => {
    const html = makeHtml(
      makeRow('Agent 1', 'Model', 'Org', '80.0%± 1.0'),
      makeRow('Agent 2', 'Model', 'Org', '75.0%± 1.0'),
      makeRow('Agent 3', 'Model', 'Org', '70.0%± 1.0'),
    );
    mockFetch(html);

    const result = await tbenchLeaderboard({ limit: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.length).toBe(2);
  });

  it('rejects invalid benchmark versions before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await tbenchLeaderboard({ version: '../secrets' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid benchmark version' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parses accuracy stripping the margin-of-error suffix', async () => {
    const html = makeHtml(makeRow('Agent', 'Model', 'Org', '73.6%± 3.1'));
    mockFetch(html);

    const result = await tbenchLeaderboard({});
    if (!result.ok) throw new Error('expected ok');
    expect(result.points[0]?.value).toBe(73.6);
  });

  it('fails with parse_failed when no verified entries are found', async () => {
    const html = makeHtml(makeRow('Unverified', 'Model', 'Org', '90.0%± 1.0', false));
    mockFetch(html);

    const result = await tbenchLeaderboard({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('fails with fetch_failed on non-2xx response', async () => {
    mockFetch('rate limited', 429);

    const result = await tbenchLeaderboard({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('429');
  });

  it('fails with fetch_failed when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await tbenchLeaderboard({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
    expect(result.error.message).toContain('network error');
  });
});
