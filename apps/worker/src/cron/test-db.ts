// Substitute an in-memory SQLite client for D1 in cron tests.

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
