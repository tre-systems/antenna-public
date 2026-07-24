import type { AdapterError } from './types';
import { discardResponse } from './discard-response';

// Shared fetch + JSON + error-mapping for adapters whose failure handling is
// exactly: network throw → fetch_failed (error message), non-2xx →
// fetch_failed (`HTTP ${status}`), JSON parse throw → parse_failed (error
// message). Callers that need bespoke status handling (rate-limit/unauthorized
// branches, per-item message prefixes, or different success shapes) keep their
// own fetch and must NOT use this helper — the error codes/messages here are
// unit-tested and intentionally fixed.
export type FetchJsonResult =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly error: AdapterError };

export const fetchJson = async (url: string, init?: RequestInit): Promise<FetchJsonResult> => {
  let response: Response;
  try {
    // Call with a single arg when no init is given so the request — and the
    // call signature tests assert on — matches a bare `fetch(url)` exactly.
    response = init === undefined ? await fetch(url) : await fetch(url, init);
  } catch (err) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  try {
    return { ok: true, body: await response.json() };
  } catch (err) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: err instanceof Error ? err.message : String(err) },
    };
  }
};
