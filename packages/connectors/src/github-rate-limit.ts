import type { AdapterError } from './types';

const DEFAULT_GITHUB_RETRY_AFTER_SECONDS = 3600;

export const githubRateLimitError = (response: Response, message: string): AdapterError => ({
  code: 'rate_limited',
  message,
  retryAfterSeconds: githubRetryAfterSeconds(response.headers),
});

export const githubRetryAfterSeconds = (headers: Headers, nowMs = Date.now()): number => {
  const retryAfter = parseRetryAfter(headers.get('retry-after'));
  if (retryAfter !== undefined) return retryAfter;

  const resetAtSeconds = Number(headers.get('x-ratelimit-reset'));
  if (Number.isFinite(resetAtSeconds) && resetAtSeconds > 0) {
    return Math.max(1, Math.ceil(resetAtSeconds - nowMs / 1000));
  }

  return DEFAULT_GITHUB_RETRY_AFTER_SECONDS;
};

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));

  const retryAtMs = Date.parse(value);
  if (!Number.isFinite(retryAtMs)) return undefined;

  return Math.max(1, Math.ceil((retryAtMs - Date.now()) / 1000));
};
