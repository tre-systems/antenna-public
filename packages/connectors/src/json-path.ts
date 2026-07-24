// Tiny dot+bracket resolver. Handles `a.b`, `a[0]`, `a[0].b`, `a.b[1].c`.
// Returns undefined on any miss so callers can decide how to surface it.
export const resolveJsonPath = (root: unknown, path: string): unknown => {
  const segments = tokenize(path);
  if (segments.length === 0) return undefined;
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof seg === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[seg];
    } else {
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return current;
};

type Segment = string | number;

const tokenize = (path: string): Segment[] => {
  const out: Segment[] = [];
  let buf = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i] ?? '';
    if (ch === '.') {
      if (buf) out.push(buf);
      buf = '';
    } else if (ch === '[') {
      if (buf) out.push(buf);
      buf = '';
      const end = path.indexOf(']', i);
      if (end === -1) return [];
      const inner = path.slice(i + 1, end);
      const idx = Number(inner);
      if (!Number.isInteger(idx) || idx < 0) return [];
      out.push(idx);
      i = end;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
};
