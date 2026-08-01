const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(ts: number, now: number = Date.now()): string {
  const delta = now - ts;
  if (Math.abs(delta) < MINUTE) return 'just now';
  const suffix = delta < 0 ? 'from now' : 'ago';
  const elapsed = Math.abs(delta);
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ${suffix}`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ${suffix}`;
  return `${Math.floor(elapsed / DAY)} d ${suffix}`;
}
