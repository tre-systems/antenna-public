import { Hono } from 'hono';
import type { AuthVars } from '../auth/middleware';
import type { WorkerEnv } from '../env';

export const authHealthRoute = new Hono<{ Bindings: WorkerEnv; Variables: AuthVars }>().get(
  '/',
  (c) => c.json({ ok: true, authenticated: true, ts: Date.now() }),
);
