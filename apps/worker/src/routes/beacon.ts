import { Hono } from 'hono';
import { z } from 'zod';

// Machine-token usage-event ingest for deployed apps that cannot bind the
// app_usage Analytics Engine dataset directly (anything off-Cloudflare).
// Mounted before session auth: callers are servers, not signed-in browsers.

const SLUG_RX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const eventSchema = z
  .object({
    project: z.string().regex(SLUG_RX),
    event: z.string().regex(SLUG_RX),
    value: z.number().min(0).max(1_000_000).optional(),
    meta: z.string().max(256).optional(),
  })
  .strict();

export type BeaconEnv = {
  readonly APP_USAGE?: AnalyticsEngineDataset;
  readonly BEACON_INGEST_TOKEN?: string;
};

// Constant-time comparison so the shared ingest token cannot be recovered
// byte-by-byte from response timing.
const timingSafeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
};

export const beaconRoute = new Hono<{ Bindings: BeaconEnv }>().post('/', async (c) => {
  const token = c.env.BEACON_INGEST_TOKEN;
  const dataset = c.env.APP_USAGE;
  if (typeof token !== 'string' || token.trim().length === 0 || dataset === undefined) {
    return c.json({ error: 'beacon_not_configured' }, 503);
  }

  const header = c.req.header('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (bearer.length === 0 || !timingSafeEqual(bearer, token)) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_event', issues: parsed.error.issues }, 400);
  }

  const { project, event, value, meta } = parsed.data;
  dataset.writeDataPoint({
    indexes: [project],
    blobs: [event, meta ?? ''],
    doubles: [value ?? 1],
  });

  return c.json({ ok: true }, 202);
});
