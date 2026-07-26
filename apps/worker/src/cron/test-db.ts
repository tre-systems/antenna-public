// Swaps the Worker's D1-backed `db()` for an in-memory better-sqlite3 client.
// Not a test file (no .test.ts suffix) so vitest ignores it.
//
// Used from a test file as:
//   vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';

type Sqlite = ReturnType<typeof Database>;

export const inMemoryDbClient = async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
};
