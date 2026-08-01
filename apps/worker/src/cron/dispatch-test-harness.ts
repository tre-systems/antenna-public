// Provide in-memory D1 and R2 substitutes for dispatch tests.

import { eq } from 'drizzle-orm';
import { vi } from 'vitest';
import * as schema from '../db/schema';
import type { DispatchEnv } from './dispatch';
import {
  TEST_ENCRYPTION_KEY,
  makeR2,
  makeSqlite,
  type Drizzle,
  type R2Stub,
} from './dispatch-test-fixtures';

export type { Drizzle, R2Stub } from './dispatch-test-fixtures';

type Visibility = 'private' | 'shared' | 'public';

// A seeded scheduled collection plus the env the dispatcher runs against.
export const arrangeDispatch = (): { db: Drizzle; env: DispatchEnv; r2: R2Stub } => {
  const { sqlite, db } = makeSqlite();
  const r2 = makeR2();
  // Cast lets us reuse runDispatch (which targets D1) against better-sqlite3.
  const env: DispatchEnv = {
    DB: { __sqlite: sqlite } as unknown as D1Database,
    PAYLOADS: r2.bucket,
    GOOGLE_CLIENT_ID: 'cid',
    GOOGLE_CLIENT_SECRET: 'csecret',
    ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
  };
  seedCollection(db);
  return { db, env, r2 };
};

export const seedCollection = (
  db: Drizzle,
  id = 'collection-1',
  ownerId = 'owner-1',
  visibility: Visibility = 'private',
  refreshMode: 'scheduled' | 'on_demand' = 'scheduled',
): void => {
  db.insert(schema.collections)
    .values({
      id,
      ownerId,
      title: id,
      visibility,
      refreshMode,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

export const seedSignal = (
  db: Drizzle,
  id: string,
  templateId: string,
  config: Record<string, unknown>,
  refreshSeconds: number,
  position = 0,
  visibility: Visibility = 'private',
  collectionId = 'collection-1',
): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId,
      templateId,
      title: id,
      config: JSON.stringify(config) as unknown as schema.SignalConfig,
      refreshSeconds,
      position,
      visibility,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

export const seedStatus = (
  db: Drizzle,
  signalId: string,
  partial: {
    lastOkAt?: number;
    lastManualRequestAt?: number;
    nextAttemptAt?: number;
    updatedAt: number;
  },
): void => {
  const at = (value: number | undefined): Date | null =>
    value === undefined ? null : new Date(value);
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: at(partial.lastOkAt),
      lastManualRequestAt: at(partial.lastManualRequestAt),
      nextAttemptAt: at(partial.nextAttemptAt),
      updatedAt: new Date(partial.updatedAt),
    })
    .run();
};

export const statusFor = (db: Drizzle, signalId: string) =>
  db.select().from(schema.signalStatus).where(eq(schema.signalStatus.signalId, signalId)).get();

export const pointsFor = (db: Drizzle, signalId: string) =>
  db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, signalId)).all();

export const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

export const makeChannels = () => {
  const calls: RequestInit[] = [];
  const stub = {
    fetch: vi.fn((_url: string, init?: RequestInit) => {
      if (init) calls.push(init);
      return Promise.resolve(new Response(null, { status: 204 }));
    }),
  };
  return {
    calls,
    namespace: {
      idFromName: vi.fn(() => ({})),
      get: vi.fn(() => stub),
    } as unknown as DurableObjectNamespace,
  };
};
