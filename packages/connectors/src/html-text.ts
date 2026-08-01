// Linear scanners avoid catastrophic regex backtracking on external markup.
export type HtmlElement = {
  readonly openingTag: string;
  readonly innerHtml: string;
};

const ENTITY_VALUES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&nbsp;': ' ',
  '&#39;': "'",
  '&#x2f;': '/',
};

export const htmlToText = (html: string): string =>
  decodeHtmlEntitiesOnce(stripHtmlTags(html)).replace(/\s+/g, ' ').trim();

export const decodeHtmlEntitiesOnce = (value: string): string =>
  value.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x2f);/gi, (entity) => {
    return ENTITY_VALUES[entity.toLowerCase()] ?? entity;
  });

// Configurable tag replacement supports sources that splice markup within tokens.
export const stripHtmlTags = (html: string, tagReplacement = ' '): string => {
  let text = '';
  let inTag = false;
  for (const character of html) {
    if (character === '<') {
      inTag = true;
      text += tagReplacement;
    } else if (character === '>') {
      inTag = false;
    } else if (!inTag) {
      text += character;
    }
  }
  return text;
};

export const extractHtmlElements = (html: string, tagName: string): HtmlElement[] => {
  // Case-fold once to keep repeated element scans linear.
  const lower = html.toLowerCase();
  const prefixes = { open: `<${tagName.toLowerCase()}`, close: `</${tagName.toLowerCase()}` };
  const elements: HtmlElement[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const found = nextElement(html, lower, prefixes, cursor);
    if (!found) break;
    elements.push(found.element);
    cursor = found.next;
  }

  return elements;
};

// Self-closing tags require direct opening-tag attribute reads.
export const firstOpeningTag = (html: string, tagName: string): string | undefined => {
  const prefix = `<${tagName.toLowerCase()}`;
  const start = findTag(html.toLowerCase(), prefix, 0);
  if (start === -1) return undefined;
  const end = html.indexOf('>', start + prefix.length);
  return end === -1 ? undefined : html.slice(start, end + 1);
};

export const htmlAttribute = (openingTag: string, attributeName: string): string | undefined => {
  const target = attributeName.toLowerCase();
  let cursor = firstSpacing(openingTag);
  if (cursor === -1) return undefined;

  while (cursor < openingTag.length) {
    cursor = skipSpacing(openingTag, cursor);
    if (openingTag[cursor] === '>' || openingTag[cursor] === '/') break;
    const nameStart = cursor;
    while (isAttributeNameCharacter(openingTag[cursor])) cursor += 1;
    const name = openingTag.slice(nameStart, cursor).toLowerCase();
    cursor = skipSpacing(openingTag, cursor);
    if (openingTag[cursor] !== '=') continue;
    cursor = skipSpacing(openingTag, cursor + 1);
    const parsed = attributeValueAt(openingTag, cursor);
    if (parsed === undefined) return undefined;
    if (name === target) return parsed.value;
    cursor = parsed.next;
  }

  return undefined;
};

export const hasHtmlClass = (openingTag: string, className: string): boolean =>
  htmlAttribute(openingTag, 'class')?.split(/\s+/).includes(className) ?? false;

type TagPrefixes = { readonly open: string; readonly close: string };

const nextElement = (
  html: string,
  lower: string,
  prefixes: TagPrefixes,
  from: number,
): { readonly element: HtmlElement; readonly next: number } | undefined => {
  const openStart = findTag(lower, prefixes.open, from);
  if (openStart === -1) return undefined;
  const openEnd = html.indexOf('>', openStart + prefixes.open.length);
  if (openEnd === -1) return undefined;
  const closeStart = lower.indexOf(prefixes.close, openEnd + 1);
  if (closeStart === -1) return undefined;
  const closeEnd = html.indexOf('>', closeStart + prefixes.close.length);
  if (closeEnd === -1) return undefined;

  const element = {
    openingTag: html.slice(openStart, openEnd + 1),
    innerHtml: html.slice(openEnd + 1, closeStart),
  };
  return { element, next: closeEnd + 1 };
};

const findTag = (lowerHtml: string, prefix: string, from: number): number => {
  let candidate = lowerHtml.indexOf(prefix, from);
  while (candidate !== -1) {
    const boundary = lowerHtml[candidate + prefix.length];
    if (boundary === '>' || boundary === '/' || isSpacing(boundary)) return candidate;
    candidate = lowerHtml.indexOf(prefix, candidate + prefix.length);
  }
  return -1;
};

const attributeValueAt = (
  openingTag: string,
  start: number,
): { readonly value: string; readonly next: number } | undefined => {
  const quote = openingTag[start];
  if (quote === '"' || quote === "'") {
    const end = openingTag.indexOf(quote, start + 1);
    return end === -1 ? undefined : { value: openingTag.slice(start + 1, end), next: end + 1 };
  }

  let end = start;
  while (end < openingTag.length && !isSpacing(openingTag[end]) && openingTag[end] !== '>')
    end += 1;
  return { value: openingTag.slice(start, end), next: end };
};

const firstSpacing = (value: string): number => {
  for (let index = 0; index < value.length; index += 1) {
    if (isSpacing(value[index])) return index;
  }
  return -1;
};

const skipSpacing = (value: string, start: number): number => {
  let cursor = start;
  while (isSpacing(value[cursor])) cursor += 1;
  return cursor;
};

const isSpacing = (value: string | undefined): boolean =>
  value === ' ' || value === '\n' || value === '\r' || value === '\t' || value === '\f';

const isAttributeNameCharacter = (value: string | undefined): boolean =>
  value !== undefined && !isSpacing(value) && value !== '=' && value !== '>' && value !== '/';
