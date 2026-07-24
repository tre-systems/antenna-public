export const retryAfterSecondsFromHeaders = (
  headers: Headers,
  fallbackSeconds: number,
  nowMs = Date.now(),
): number => {
  const value = headers.get('retry-after');
  if (!value) return fallbackSeconds;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));

  const retryAtMs = Date.parse(value);
  if (!Number.isFinite(retryAtMs)) return fallbackSeconds;

  return Math.max(1, Math.ceil((retryAtMs - nowMs) / 1000));
};
