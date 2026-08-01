import type { StatusCode } from 'hono/utils/http-status';
import type { ApiErrorCode } from '@antenna/shared';

type JsonResponder = {
  json: (data: unknown, status?: StatusCode) => Response;
};

export const ok = (c: JsonResponder, data: unknown): Response => c.json(data);

export const err = (c: JsonResponder, error: ApiErrorCode, status: StatusCode): Response =>
  c.json({ error }, status);

// Add actionable context while preserving the common error envelope.
export const errWith = (
  c: JsonResponder,
  error: ApiErrorCode,
  detail: Readonly<Record<string, unknown>>,
  status: StatusCode,
): Response => c.json({ ...detail, error }, status);
