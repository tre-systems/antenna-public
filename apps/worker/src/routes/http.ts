import type { StatusCode } from 'hono/utils/http-status';

type JsonResponder = {
  json: (data: unknown, status?: StatusCode) => Response;
};

export const ok = (c: JsonResponder, data: unknown): Response => c.json(data);

export const err = (c: JsonResponder, error: string, status: StatusCode): Response =>
  c.json({ error }, status);
