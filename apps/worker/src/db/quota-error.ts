type QuotaError = 'collection_quota_exceeded' | 'signal_quota_exceeded';

// Drizzle and D1 wrap SQLite errors. Return only our fixed codes, never query/binding text.
export const isQuotaError = (error: unknown, code: QuotaError): boolean => {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    if (current.message === code || current.message.startsWith(`D1_ERROR: ${code}:`)) return true;
    current = current.cause;
  }
  return false;
};
