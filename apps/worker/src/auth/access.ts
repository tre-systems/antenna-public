import { eq } from 'drizzle-orm';
import type { db } from '../db/client';
import { user } from '../db/schema';

// ALLOWED_EMAILS restricts sign-up when set; BLOCKED_EMAILS always wins.
export type AccessEnv = {
  readonly ALLOWED_EMAILS?: string;
  readonly BLOCKED_EMAILS?: string;
};

export const parseEmailList = (raw: string | undefined): ReadonlySet<string> => {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
};

export type AccessRules = {
  readonly allowed: ReadonlySet<string>;
  readonly blocked: ReadonlySet<string>;
};

export const accessRules = (env: AccessEnv): AccessRules => ({
  allowed: parseEmailList(env.ALLOWED_EMAILS),
  blocked: parseEmailList(env.BLOCKED_EMAILS),
});

// Blocked always wins: an address on both lists is refused.
export const emailPermitted = (rules: AccessRules, email: string): boolean => {
  const normalised = email.trim().toLowerCase();
  if (rules.blocked.has(normalised)) return false;
  return rules.allowed.size === 0 || rules.allowed.has(normalised);
};

// Return a user-facing refusal reason.
export const refusalReason = (rules: AccessRules, email: string): 'blocked' | 'not_invited' => {
  const normalised = email.trim().toLowerCase();
  return rules.blocked.has(normalised) ? 'blocked' : 'not_invited';
};

// Re-check policy on session creation so access changes affect existing users.
export const assertSessionUserPermitted = async (
  client: ReturnType<typeof db>,
  userId: string,
  rules: AccessRules,
): Promise<void> => {
  const rows = await client
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .all();
  const email = rows[0]?.email;
  if (email === undefined) throw new Error('Unknown user');
  if (!emailPermitted(rules, email)) throw new Error(`Account ${refusalReason(rules, email)}`);
};
