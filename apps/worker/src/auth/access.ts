import { eq } from 'drizzle-orm';
import type { db } from '../db/client';
import { user } from '../db/schema';

// Two levers, so one deployment model serves both a hosted instance and a
// self-hosted one:
//
//   ALLOWED_EMAILS unset  → anyone with a Google account can sign up.
//   ALLOWED_EMAILS set    → only those addresses can, and everyone else is
//                           refused even if they already have an account.
//   BLOCKED_EMAILS        → always refused, whichever of the above applies.
//
// A self-hoster who deploys this to their own Worker gets a closed instance by
// setting one secret; leaving it unset opts into open sign-up deliberately
// rather than by accident.
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

// Why the refusal happened, so the sign-in page can say something useful rather
// than inviting an endless retry.
export const refusalReason = (rules: AccessRules, email: string): 'blocked' | 'not_invited' => {
  const normalised = email.trim().toLowerCase();
  return rules.blocked.has(normalised) ? 'blocked' : 'not_invited';
};

// Re-checked at session creation, not just user creation: the `user.create.before`
// hook only fires on first sign-in, so without this a newly blocked or
// de-listed account could keep signing in. An unknown user id also aborts —
// that state should not exist, and letting it through would be the more
// surprising failure.
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
