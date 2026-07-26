import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { user } from '../db/schema';

// Deployment admins. Sign-up is open, so this is not an access gate — it marks
// the accounts allowed to see deployment-wide operational data. Admins are
// blocked by BLOCKED_EMAILS like anyone else.
export type AdminEnv = { readonly ADMIN_EMAILS?: string };

export const parseAdminEmails = (raw: string | undefined): ReadonlySet<string> => {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
};

export const isAdminEmail = (env: AdminEnv, email: string): boolean =>
  parseAdminEmails(env.ADMIN_EMAILS).has(email.trim().toLowerCase());

// Fails closed: an unset ADMIN_EMAILS, or a user id with no row, is not an
// admin.
export const isAdminUser = async (client: Db, env: AdminEnv, userId: string): Promise<boolean> => {
  const admins = parseAdminEmails(env.ADMIN_EMAILS);
  if (admins.size === 0) return false;

  const [row] = await client
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .all();
  return row !== undefined && admins.has(row.email.trim().toLowerCase());
};
