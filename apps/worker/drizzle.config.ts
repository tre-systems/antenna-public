import { defineConfig } from 'drizzle-kit';

// Use Drizzle for schema tooling while Wrangler applies checked-in migrations.
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
});
