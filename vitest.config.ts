import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@antenna/mcp/factory',
        replacement: fileURLToPath(new URL('./apps/mcp/src/factory.ts', import.meta.url)),
      },
    ],
  },
  test: {
    include: [
      'apps/**/*.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.{test,spec}.{ts,mjs}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.wrangler/**', 'tests/e2e/**'],
    environment: 'node',
  },
});
