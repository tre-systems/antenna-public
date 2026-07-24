import { DAY_MS, DIGEST_HOUR, DIGEST_TIME_ZONE, DIGEST_WINDOW_MINUTES, WEEK_MS } from './constants';
import type { DigestCadence, DigestPeriod, PreferenceRow } from './types';

export const isDigestWindow = (nowMs: number): boolean => {
  const parts = localTimeParts(nowMs);
  return parts.hour === DIGEST_HOUR && parts.minute < DIGEST_WINDOW_MINUTES;
};

export const isWithinQuietHours = (preference: PreferenceRow, nowMs: number): boolean => {
  if (!preference.quietHoursStart || !preference.quietHoursEnd) return false;
  const start = minuteOfDay(preference.quietHoursStart);
  const end = minuteOfDay(preference.quietHoursEnd);
  if (start === null || end === null || start === end) return false;
  return quietHoursContains(localTimeParts(nowMs), start, end);
};

export const digestPeriod = (preference: PreferenceRow, nowMs: number): DigestPeriod | null => {
  if (preference.frequency === 'weekly') {
    if (localWeekday(nowMs) !== 'Mon') return null;
    return weeklyPeriod(nowMs);
  }
  return dailyPeriod(nowMs);
};

export const cadenceForPreference = (preference: PreferenceRow): DigestCadence =>
  preference.frequency === 'weekly' ? 'weekly' : 'daily';

const quietHoursContains = (
  now: { readonly hour: number; readonly minute: number },
  start: number,
  end: number,
): boolean => {
  const current = now.hour * 60 + now.minute;
  return start < end ? current >= start && current < end : current >= start || current < end;
};

const weeklyPeriod = (nowMs: number): DigestPeriod => ({
  start: new Date(nowMs - WEEK_MS),
  end: new Date(nowMs),
  key: `weekly:${localDayKey(nowMs)}`,
});

const dailyPeriod = (nowMs: number): DigestPeriod => ({
  start: new Date(nowMs - DAY_MS),
  end: new Date(nowMs),
  key: localDayKey(nowMs),
});

const localDayKey = (nowMs: number): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DIGEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date(nowMs))
    .reduce<Record<string, string>>((out, part) => {
      out[part.type] = part.value;
      return out;
    }, {});
  return `${parts.year ?? '0000'}-${parts.month ?? '00'}-${parts.day ?? '00'}`;
};

const localTimeParts = (nowMs: number): { readonly hour: number; readonly minute: number } => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DIGEST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(nowMs))
    .reduce<Record<string, string>>((out, part) => {
      out[part.type] = part.value;
      return out;
    }, {});
  return {
    hour: Number(parts.hour ?? '0'),
    minute: Number(parts.minute ?? '0'),
  };
};

const localWeekday = (nowMs: number): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: DIGEST_TIME_ZONE,
    weekday: 'short',
  }).format(new Date(nowMs));

const minuteOfDay = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};
