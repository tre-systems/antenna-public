import { describe, expect, it } from 'vitest';
import { antennaUsers } from './antenna-users';

describe('antennaUsers', () => {
  it('emits one point per supplied count, in card order', async () => {
    const result = await antennaUsers({
      total_users: 42,
      new_users_24h: 2,
      new_users_7d: 9,
      active_users_7d: 17,
      collections: 60,
      signals: 300,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.dimensions.metric)).toEqual([
      'total_users',
      'active_users_7d',
      'new_users_7d',
      'new_users_24h',
      'collections',
      'signals',
    ]);
    expect(result.points[0]).toMatchObject({ value: 42, unit: 'users' });
  });

  it('skips counts the Worker did not supply', async () => {
    const result = await antennaUsers({ total_users: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
  });

  it('reports an error rather than an empty snapshot when nothing was supplied', async () => {
    const result = await antennaUsers({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('ignores non-finite values instead of writing them as points', async () => {
    const result = await antennaUsers({ total_users: Number.NaN, collections: 5 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((point) => point.dimensions.metric)).toEqual(['collections']);
  });
});
