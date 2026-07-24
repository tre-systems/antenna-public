// The primary collection has no query param, keeping common deep links short.
export const collectionUrl = (id: string | null): string =>
  id === null ? '/' : `/?collection=${encodeURIComponent(id)}`;
