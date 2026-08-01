import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_PURPOSE_CRAWLER, GOOGLE_DATA_USAGE, PRODUCT_NAME, PRODUCT_TAGLINE } from './brand';

const indexHtml = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

describe('index.html crawler content', () => {
  it('exposes static branding and purpose text without JavaScript', () => {
    const normalized = indexHtml.replace(/\s+/g, ' ');

    expect(indexHtml).toContain(`<h1>${PRODUCT_NAME}</h1>`);
    expect(indexHtml).toContain(PRODUCT_TAGLINE);
    expect(normalized).toContain(APP_PURPOSE_CRAWLER);
    expect(normalized).toContain(GOOGLE_DATA_USAGE);
    expect(indexHtml).toContain('src="/favicon.svg"');
    expect(indexHtml).toContain('href="/privacy/"');
    expect(indexHtml).toContain('href="/terms/"');
    expect(indexHtml).toContain('id="app-purpose"');
  });
});
