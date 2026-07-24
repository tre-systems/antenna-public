import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Env = { readonly DB: D1Database };

export const db = (env: Env) => drizzle(env.DB, { schema });

export type Db = ReturnType<typeof db>;
