import { retryAfterSecondsFromHeaders } from './http-retry-after';
import type { AdapterError } from './types';

const DEFAULT_GITHUB_RETRY_AFTER_SECONDS = 3600;

export const githubAuthHeader = (token: string | undefined): Record<string, string> =>
  typeof token === 'string' && token.trim().length > 0 ? { Authorization: `Bearer ${token}` } : {};

export const githubRateLimitError = (response: Response, message: string): AdapterError => ({
  code: 'rate_limited',
  message,
  retryAfterSeconds: githubRetryAfterSeconds(response.headers),
});

export const githubRetryAfterSeconds = (headers: Headers, nowMs = Date.now()): number =>
  retryAfterSecondsFromHeaders(headers, resetInSeconds(headers, nowMs), nowMs);

// GitHub reports `x-ratelimit-reset` as an absolute epoch second, not a delay.
const resetInSeconds = (headers: Headers, nowMs: number): number => {
  const resetAtSeconds = Number(headers.get('x-ratelimit-reset'));
  return Number.isFinite(resetAtSeconds) && resetAtSeconds > 0
    ? Math.max(1, Math.ceil(resetAtSeconds - nowMs / 1000))
    : DEFAULT_GITHUB_RETRY_AFTER_SECONDS;
};
