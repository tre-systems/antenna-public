import { eq } from 'drizzle-orm';
import { parseEmailList } from '../auth/access';
import type { Db } from '../db/client';
import { user } from '../db/schema';

// Admins may read deployment-wide data but remain subject to BLOCKED_EMAILS.
export type AdminEnv = { readonly ADMIN_EMAILS?: string };

export const parseAdminEmails = parseEmailList;

export const isAdminEmail = (env: AdminEnv, email: string): boolean =>
  parseAdminEmails(env.ADMIN_EMAILS).has(email.trim().toLowerCase());

// Missing configuration or users fail closed.
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
