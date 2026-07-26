// Structured events: one JSON object per line, `event` as the discriminator.
export const logEvent = (payload: Readonly<Record<string, unknown>>): void => {
  console.log(JSON.stringify(payload));
};

export const logErrorEvent = (payload: Readonly<Record<string, unknown>>): void => {
  console.error(JSON.stringify(payload));
};

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
