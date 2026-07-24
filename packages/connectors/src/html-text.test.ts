import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntitiesOnce,
  extractHtmlElements,
  hasHtmlClass,
  htmlAttribute,
  htmlToText,
} from './html-text';

describe('HTML text helpers', () => {
  it('strips tags and decodes each entity exactly once', () => {
    expect(htmlToText('<strong>A &amp; B</strong>')).toBe('A & B');
    expect(decodeHtmlEntitiesOnce('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
  });

  it('extracts elements and their quoted attributes', () => {
    const [anchor] = extractHtmlElements(
      '<p><a class="Link muted" href="/example">Example</a></p>',
      'a',
    );

    expect(anchor).toBeDefined();
    expect(htmlAttribute(anchor?.openingTag ?? '', 'href')).toBe('/example');
    expect(hasHtmlClass(anchor?.openingTag ?? '', 'muted')).toBe(true);
    expect(htmlToText(anchor?.innerHtml ?? '')).toBe('Example');
  });
});
