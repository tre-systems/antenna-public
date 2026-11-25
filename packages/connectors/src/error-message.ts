// Exception messages can contain credentialed URLs or snippets of private response bodies.
export const errorMessage = (err: unknown): string => {
  if (err instanceof SyntaxError) return 'Invalid source response';
  if (err instanceof DOMException && err.name === 'TimeoutError') return 'Source request timed out';
  if (err instanceof DOMException && err.name === 'AbortError') return 'Source request aborted';
  return 'Source operation failed';
};
