// Apply the same privacy boundary to browser/Worker errors, traces and breadcrumbs.
const FILTERED = '[Filtered]';
const SENSITIVE_KEYS = /(?:token|secret|password|authorization|cookie|api[_-]?key|db\.statement)/i;
const PRIVATE_FIELDS = new Set([
  'collection',
  'config',
  'datapoint',
  'digest',
  'prompt',
  'requestbody',
  'response',
  'signal',
  'sourcepayload',
  'text',
  'params',
  'parameters',
  'bindings',
  'query',
  'sql',
  'http.query',
  'url.query',
  'http.fragment',
  'url.fragment',
  'state',
]);
const OMIT_FIELDS = new Set(['query_string', 'vars']);

const redactPath = (value: string): string =>
  value
    .replace(/(\/(?:c|api\/(?:shared|public)\/collections))\/[^/?#\s]+/g, '$1/[Filtered]')
    .replace(/\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}(?=\/|$)/gi, '/[Filtered]')
    .replace(/\/[a-f0-9]{16,}(?=\/|$)/gi, '/[Filtered]');

const redactUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    url.pathname = redactPath(url.pathname);
    return url.toString();
  } catch {
    return FILTERED;
  }
};

const redactString = (value: string): string => {
  if (/failed (?:to run )?query\s*:/i.test(value)) return 'Database query failed [Filtered]';
  return redactPath(
    value
      .replace(/\b(?:params|parameters|bindings)\s*:[\s\S]*/i, 'params: [Filtered]')
      .replace(/https?:\/\/[^\s<>"']+|\/[^\s<>"']*/gi, (part) =>
        /^https?:/i.test(part) ? redactUrl(part) : (part.split(/[?#]/, 1)[0] ?? FILTERED),
      ),
  );
};

const redactValue = (value: unknown, depth: number, parent?: string): unknown => {
  if (depth > 20) return FILTERED;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, depth + 1));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const lower = key.toLowerCase();
      if (
        OMIT_FIELDS.has(lower) ||
        lower === 'user' ||
        (parent === 'request' && lower === 'data') ||
        (parent === 'logentry' && lower === 'params')
      )
        return [];
      const sensitive = SENSITIVE_KEYS.test(key) || PRIVATE_FIELDS.has(lower);
      return [[key, sensitive ? FILTERED : redactValue(entry, depth + 1, lower)]];
    }),
  );
};

export const redactTelemetry = <T>(value: T): T => redactValue(value, 0) as T;
