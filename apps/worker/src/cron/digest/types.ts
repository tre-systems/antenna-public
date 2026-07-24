import type { Db, Env as DbEnv } from '../../db/client';
import type {
  signalAlerts,
  collections,
  signals,
  notificationPrefs,
  user as userTable,
} from '../../db/schema';

export type DigestEnv = DbEnv & {
  readonly RESEND_API_KEY?: string;
  readonly NOTIFICATION_FROM_EMAIL?: string;
  readonly BETTER_AUTH_URL?: string;
};

export type DigestSummary = {
  readonly considered: number;
  readonly sent: number;
  readonly skipped: number;
  readonly failed: number;
};

export type Client = Db;
export type UserRow = typeof userTable.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;
export type PreferenceRow = typeof notificationPrefs.$inferSelect;
export type DigestCadence = 'daily' | 'weekly';

export type Candidate = {
  readonly user: UserRow;
  readonly collection: CollectionRow;
  readonly preference: PreferenceRow;
};

export type AlertRow = {
  readonly alert: typeof signalAlerts.$inferSelect;
  readonly signal: typeof signals.$inferSelect;
};

export type DigestPeriod = {
  readonly start: Date;
  readonly end: Date;
  readonly key: string;
};

export type DeliveryRecord = {
  readonly id: string;
  readonly userId: string;
  readonly collectionId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly sentAt: Date;
  readonly status: 'sent' | 'error';
  readonly error: string | null;
};
