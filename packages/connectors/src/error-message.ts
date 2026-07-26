export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
