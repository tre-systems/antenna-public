import { Hono } from 'hono';
import { z } from 'zod';
import { err, errWith } from './http';

// Accept machine-authenticated usage events from apps outside Cloudflare.

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

// Compare ingest tokens without leaking matching-prefix timing.
const timingSafeEqual = (input: string, expected: string): boolean => {
  const encoder = new TextEncoder();
  const left = encoder.encode(input);
  const right = encoder.encode(expected);
  let diff = left.length ^ right.length;
  for (let i = 0; i < right.length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
};

export const beaconRoute = new Hono<{ Bindings: BeaconEnv }>().post('/', async (c) => {
  const token = c.env.BEACON_INGEST_TOKEN;
  const dataset = c.env.APP_USAGE;
  if (typeof token !== 'string' || token.trim().length === 0 || dataset === undefined) {
    return err(c, 'beacon_not_configured', 503);
  }

  const bearer = /^Bearer\s+(.+)$/i.exec(c.req.header('authorization') ?? '')?.[1]?.trim() ?? '';
  if (bearer.length === 0 || !timingSafeEqual(bearer, token)) {
    return err(c, 'unauthorized', 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return err(c, 'invalid_json', 400);
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return errWith(c, 'invalid_event', { issues: parsed.error.issues }, 400);
  }

  const { project, event, value, meta } = parsed.data;
  dataset.writeDataPoint({
    indexes: [project],
    blobs: [event, meta ?? ''],
    doubles: [value ?? 1],
  });

  return c.json({ ok: true }, 202);
});
