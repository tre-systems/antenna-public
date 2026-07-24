import { defineConfig } from 'drizzle-kit';

// Schema pointer for Drizzle-aware tooling. D1 migrations are the checked-in SQL
// files under `drizzle/` and are applied with Wrangler, not drizzle-kit.
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
});
