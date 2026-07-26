import { defineConfig } from 'vitest/config';

export default defineConfig({
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
