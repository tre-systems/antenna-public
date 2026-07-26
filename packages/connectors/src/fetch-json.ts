import type { AdapterError } from './types';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';

// Only for adapters happy with these fixed codes: adapters needing rate-limit,
// unauthorized, or prefixed messages keep their own fetch.
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
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  try {
    return { ok: true, body: await response.json() };
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
};
