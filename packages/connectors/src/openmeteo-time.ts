// Open-Meteo timestamps arrive as unixtime seconds (timeformat=unixtime) or ISO strings.
export const parseOpenMeteoTs = (time: unknown): number => {
  if (typeof time === 'number' && Number.isFinite(time)) return time * 1000;
  if (typeof time === 'string') {
    const parsed = Date.parse(time);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
};

export const rawArray = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? value : [];
