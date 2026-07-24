const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(ts: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - ts);
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} min ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)} hr ago`;
  return `${Math.floor(delta / DAY)} d ago`;
}
