export const logDispatch = (payload: Readonly<Record<string, unknown>>): void => {
  console.log(JSON.stringify(payload));
};

export const logDispatchError = (payload: Readonly<Record<string, unknown>>): void => {
  console.error(JSON.stringify(payload));
};

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
