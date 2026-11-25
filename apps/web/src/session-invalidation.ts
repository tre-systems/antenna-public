// In-flight requests from a former session must not sign out a newly selected owner.
let version = 0;
const listeners = new Set<() => void>();

export const sessionVersion = (): number => version;
export const advanceSessionVersion = (): void => {
  version += 1;
};
export const onSessionInvalidated = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const invalidateSession = (requestVersion: number): void => {
  if (requestVersion !== version) return;
  advanceSessionVersion();
  for (const listener of listeners) listener();
};
