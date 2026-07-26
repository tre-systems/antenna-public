import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { beaconRoute, type BeaconEnv } from './beacon';

const TOKEN = 'beacon-test-token';

type WrittenPoint = {
  indexes?: readonly (string | ArrayBuffer | null)[];
  blobs?: readonly (string | ArrayBuffer | null)[];
  doubles?: readonly number[];
};

const buildApp = (env: BeaconEnv) => {
  const app = new Hono<{ Bindings: BeaconEnv }>();
  app.route('/api/beacon', beaconRoute);
  return {
    post: (body: unknown, authorization?: string) =>
      app.request(
        '/api/beacon',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authorization === undefined ? {} : { Authorization: authorization }),
          },
          body: JSON.stringify(body),
        },
        env,
      ),
  };
};

const datasetMock = () => {
  const written: WrittenPoint[] = [];
  const dataset = {
    writeDataPoint: vi.fn((point?: WrittenPoint) => {
      if (point) written.push(point);
    }),
  } as unknown as AnalyticsEngineDataset;
  return { dataset, written };
};

describe('POST /api/beacon', () => {
  it('returns 503 when the ingest token or dataset binding is missing', async () => {
    const { dataset } = datasetMock();
    const noToken = buildApp({ APP_USAGE: dataset });
    const noDataset = buildApp({ BEACON_INGEST_TOKEN: TOKEN });

    const resNoToken = await noToken.post({ project: 'demo', event: 'ping' }, `Bearer ${TOKEN}`);
    const resNoDataset = await noDataset.post(
      { project: 'demo', event: 'ping' },
      `Bearer ${TOKEN}`,
    );

    expect(resNoToken.status).toBe(503);
    expect(resNoDataset.status).toBe(503);
  });

  it('rejects missing or wrong bearer tokens', async () => {
    const { dataset, written } = datasetMock();
    const app = buildApp({ APP_USAGE: dataset, BEACON_INGEST_TOKEN: TOKEN });

    const missing = await app.post({ project: 'demo', event: 'ping' });
    const wrong = await app.post({ project: 'demo', event: 'ping' }, 'Bearer nope');

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(written).toHaveLength(0);
  });

  it('rejects malformed events without writing', async () => {
    const { dataset, written } = datasetMock();
    const app = buildApp({ APP_USAGE: dataset, BEACON_INGEST_TOKEN: TOKEN });

    const badSlug = await app.post({ project: 'Bad Slug!', event: 'ping' }, `Bearer ${TOKEN}`);
    const extraKey = await app.post(
      { project: 'demo', event: 'ping', user_id: 'u1' },
      `Bearer ${TOKEN}`,
    );

    expect(badSlug.status).toBe(400);
    expect(extraKey.status).toBe(400);
    expect(written).toHaveLength(0);
  });

  it('writes a data point with defaults applied and returns 202', async () => {
    const { dataset, written } = datasetMock();
    const app = buildApp({ APP_USAGE: dataset, BEACON_INGEST_TOKEN: TOKEN });

    const res = await app.post(
      { project: 'swade-toolbox', event: 'character_created' },
      `Bearer ${TOKEN}`,
    );

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(written).toEqual([
      {
        indexes: ['swade-toolbox'],
        blobs: ['character_created', ''],
        doubles: [1],
      },
    ]);
  });

  it('passes through explicit value and meta', async () => {
    const { dataset, written } = datasetMock();
    const app = buildApp({ APP_USAGE: dataset, BEACON_INGEST_TOKEN: TOKEN });

    const res = await app.post(
      { project: 'demo', event: 'batch_import', value: 25, meta: 'nightly' },
      `Bearer ${TOKEN}`,
    );

    expect(res.status).toBe(202);
    expect(written).toEqual([
      { indexes: ['demo'], blobs: ['batch_import', 'nightly'], doubles: [25] },
    ]);
  });
});
