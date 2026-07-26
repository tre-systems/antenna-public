import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntitiesOnce,
  extractHtmlElements,
  firstOpeningTag,
  hasHtmlClass,
  htmlAttribute,
  htmlToText,
  stripHtmlTags,
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

  it('walks past malformed markup instead of backtracking over it', () => {
    expect(extractHtmlElements('<a href="/x">one</a><a href="/y">two', 'a')).toEqual([
      { openingTag: '<a href="/x">', innerHtml: 'one' },
    ]);
    expect(extractHtmlElements('<article>a</article><articles>b</articles>', 'article')).toEqual([
      { openingTag: '<article>', innerHtml: 'a' },
    ]);
  });

  it('reads attributes from self-closing tags that have no closing tag', () => {
    const feed = '<entry><link\n  href="https://example.test/x" rel="alternate" /></entry>';

    expect(htmlAttribute(firstOpeningTag(feed, 'link') ?? '', 'href')).toBe(
      'https://example.test/x',
    );
    expect(firstOpeningTag(feed, 'title')).toBeUndefined();
  });

  it('can strip tags without splitting the surrounding token', () => {
    expect(stripHtmlTags('2026&nbsp;Jun-<b>6</b>', '')).toBe('2026&nbsp;Jun-6');
    expect(htmlToText('2026&nbsp;Jun- 6')).toBe('2026 Jun- 6');
  });
});
