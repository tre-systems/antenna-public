const RETRY_DELAYS_MS = [100, 200] as const;

// Only the idempotent OAuth credential SELECT may use this retry boundary.
export async function retryOAuthRead<T>(read: () => T | PromiseLike<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error: unknown) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isTransientD1Error(error)) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

function isTransientD1Error(error: unknown): boolean {
  // Drizzle wraps the D1 error; never classify using its secret-bearing SQL message.
  for (let depth = 0; depth < 5 && error instanceof Error; depth++) {
    if (/^D1_ERROR: internal error\b/i.test(error.message)) return true;
    error = error.cause;
  }
  return false;
}
