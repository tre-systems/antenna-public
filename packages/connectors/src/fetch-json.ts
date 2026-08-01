import type { AdapterError } from './types';
import { discardResponse } from './discard-response';
import { errorMessage } from './error-message';

// Adapters needing richer HTTP error mapping keep their own fetch path.
export type FetchJsonResult =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly error: AdapterError };

export const fetchJson = async (url: string, init?: RequestInit): Promise<FetchJsonResult> => {
  let response: Response;
  try {
    // Preserve bare-fetch semantics when no request options are needed.
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
