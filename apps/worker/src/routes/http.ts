import type { StatusCode } from 'hono/utils/http-status';

type JsonResponder = {
  json: (data: unknown, status?: StatusCode) => Response;
};

export const ok = (c: JsonResponder, data: unknown): Response => c.json(data);

export const err = (c: JsonResponder, error: string, status: StatusCode): Response =>
  c.json({ error }, status);

// Same envelope as `err`, plus the context a caller needs to act on the refusal
// — the quota it hit, the signals that were skipped, the policy that blocked
// it. Keeps `error` in the same place for every failure so browser and MCP
// clients can branch on one field.
export const errWith = (
  c: JsonResponder,
  error: string,
  detail: Readonly<Record<string, unknown>>,
  status: StatusCode,
): Response => c.json({ error, ...detail }, status);
