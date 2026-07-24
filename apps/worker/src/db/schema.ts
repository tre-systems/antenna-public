import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// JSON shapes are stored as TEXT and serialised/deserialised at the call site.
// `.$type<...>()` annotates the column type without producing runtime checks.

export type CollectionLayout = {
  readonly version: number;
  readonly slots: ReadonlyArray<{
    readonly signal_id: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }>;
};

export type SignalConfig = Readonly<Record<string, unknown>>;

export type DataPointDimensions = Readonly<Record<string, string>>;

export type ProposedPlanItem =
  | {
      readonly kind: 'signal';
      readonly templateId: string;
      readonly params: Readonly<Record<string, unknown>>;
      readonly missing: ReadonlyArray<string>;
      readonly requiresAuth: ReadonlyArray<string>;
    }
  | { readonly kind: 'connector_request'; readonly prompt: string; readonly reason: string };

export type ProposedPlan = ReadonlyArray<ProposedPlanItem>;

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  visibility: text('visibility', { enum: ['private', 'shared', 'public'] })
    .notNull()
    .default('private'),
  refreshMode: text('refresh_mode', { enum: ['scheduled', 'on_demand'] })
    .notNull()
    .default('scheduled'),
  slug: text('slug').unique(),
  forkedFromCollectionId: text('forked_from_collection_id'),
  layout: text('layout').$type<CollectionLayout>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const userCollectionVisits = sqliteTable(
  'user_collection_visits',
  {
    userId: text('user_id').notNull(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.collectionId] }),
    index('user_collection_visits_collection_id_idx').on(t.collectionId),
  ],
);

export const collectionTemplatePublications = sqliteTable(
  'collection_template_publications',
  {
    collectionId: text('collection_id')
      .primaryKey()
      .references(() => collections.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    description: text('description'),
    summary: text('summary').notNull(),
    publishedBy: text('published_by').notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('collection_template_publications_published_by_idx').on(t.publishedBy),
    index('collection_template_publications_updated_at_idx').on(t.updatedAt),
  ],
);

export const signals = sqliteTable('signals', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id),
  templateId: text('template_id').notNull(),
  title: text('title').notNull(),
  config: text('config').$type<SignalConfig>().notNull(),
  refreshSeconds: integer('refresh_seconds').notNull(),
  position: integer('position').notNull(),
  visibility: text('visibility', { enum: ['private', 'shared', 'public'] })
    .notNull()
    .default('private'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const dismissedStarterSignals = sqliteTable(
  'dismissed_starter_signals',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    signalSignature: text('signal_signature').notNull(),
    dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.signalSignature] })],
);

export const signalPoints = sqliteTable(
  'signal_points',
  {
    signalId: text('signal_id')
      .notNull()
      .references(() => signals.id, { onDelete: 'cascade' }),
    // Dispatch wall-clock time. Latest reads sort by this so historical or
    // forecast points from one adapter result cannot crowd out fresh status.
    fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
    observedAt: integer('observed_at', { mode: 'timestamp_ms' }).notNull(),
    metricKey: text('metric_key').notNull(),
    dimensions: text('dimensions').$type<DataPointDimensions>(),
    value: real('value'),
    valueText: text('value_text'),
    unit: text('unit'),
    sourceUrl: text('source_url'),
    rawPayloadId: text('raw_payload_id'),
  },
  (t) => [
    primaryKey({ columns: [t.signalId, t.observedAt, t.metricKey] }),
    index('signal_points_signal_fetched_idx').on(
      t.signalId,
      t.fetchedAt,
      t.observedAt,
      t.metricKey,
    ),
  ],
);

export const signalStatus = sqliteTable(
  'signal_status',
  {
    signalId: text('signal_id')
      .primaryKey()
      .references(() => signals.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['live', 'stale', 'error', 'loading'] }).notNull(),
    lastOkAt: integer('last_ok_at', { mode: 'timestamp_ms' }),
    lastError: text('last_error'),
    // Dispatcher reads this on each tick to honour user-triggered refreshes.
    lastManualRequestAt: integer('last_manual_request_at', { mode: 'timestamp_ms' }),
    nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }),
    // Fingerprint and timestamp of the last materialised adapter snapshot.
    // Successful unchanged refreshes still advance last_ok_at without writing
    // another identical set of signal_points.
    lastDataHash: text('last_data_hash'),
    lastDataAt: integer('last_data_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('signal_status_last_ok_at_idx').on(t.lastOkAt)],
);

export const signalAlerts = sqliteTable(
  'signal_alerts',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    signalId: text('signal_id')
      .notNull()
      .references(() => signals.id, { onDelete: 'cascade' }),
    ruleId: text('rule_id').notNull(),
    ruleLabel: text('rule_label').notNull(),
    metricKey: text('metric_key').notNull(),
    observedAt: integer('observed_at', { mode: 'timestamp_ms' }).notNull(),
    triggeredAt: integer('triggered_at', { mode: 'timestamp_ms' }).notNull(),
    value: real('value').notNull(),
    previousValue: real('previous_value').notNull(),
    unit: text('unit'),
    sourceUrl: text('source_url'),
  },
  (t) => [
    index('signal_alerts_collection_triggered_idx').on(t.collectionId, t.triggeredAt),
    index('signal_alerts_signal_observed_idx').on(t.signalId, t.observedAt),
  ],
);

export const collectionPlans = sqliteTable('collection_plans', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id')
    .notNull()
    .references(() => collections.id),
  prompt: text('prompt').notNull(),
  proposed: text('proposed').$type<ProposedPlan>().notNull(),
  status: text('status', { enum: ['proposed', 'confirmed', 'rejected'] })
    .notNull()
    .default('proposed'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
});

// A unique claim is inserted in the same D1 batch as confirmed signals. It is
// the concurrency barrier that prevents two requests which both observed a
// proposed plan from materialising it twice.
export const planConfirmationClaims = sqliteTable('plan_confirmation_claims', {
  planId: text('plan_id')
    .primaryKey()
    .references(() => collectionPlans.id, { onDelete: 'cascade' }),
  claimedAt: integer('claimed_at', { mode: 'timestamp_ms' }).notNull(),
});

export const connectorRequests = sqliteTable('connector_requests', {
  id: text('id').primaryKey(),
  collectionId: text('collection_id').references(() => collections.id),
  prompt: text('prompt').notNull(),
  requestedBy: text('requested_by').notNull(),
  notes: text('notes'),
  status: text('status', { enum: ['requested', 'building', 'rejected', 'available'] })
    .notNull()
    .default('requested'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
});

export const publicCollectionReports = sqliteTable(
  'public_collection_reports',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    category: text('category', { enum: ['broken', 'inappropriate', 'spam', 'other'] }).notNull(),
    message: text('message'),
    requesterHash: text('requester_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('public_collection_reports_collection_id_idx').on(t.collectionId),
    index('public_collection_reports_created_at_idx').on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Better Auth tables
//
// Shape mirrors better-auth 1.6.x core schemas (user / session / account /
// verification) — see node_modules/@better-auth/core/dist/db/schema/*.d.mts.
// `usePlural` is left off the adapter config so the singular table names are
// authoritative. Google is identity-only in Antenna: account hooks discard
// access, refresh, and ID tokens before persistence.
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }),
  onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),
});

export const notificationPrefs = sqliteTable(
  'notification_prefs',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    collectionId: text('collection_id').references(() => collections.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: ['daily_digest'] }).notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    frequency: text('frequency', { enum: ['daily', 'weekly'] })
      .notNull()
      .default('daily'),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.scope, t.channel] }),
    index('notification_prefs_collection_idx').on(t.collectionId),
  ],
);

export const notificationDeliveries = sqliteTable(
  'notification_deliveries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: ['daily_digest'] }).notNull(),
    periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }).notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    status: text('status', { enum: ['sent', 'error'] }).notNull(),
    error: text('error'),
  },
  (t) => [
    index('notification_deliveries_collection_idx').on(t.collectionId),
    index('notification_deliveries_user_period_idx').on(t.userId, t.periodEnd),
  ],
);

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const mcpTokens = sqliteTable(
  'mcp_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    label: text('label'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('mcp_tokens_user_id_idx').on(t.userId)],
);

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// ---------------------------------------------------------------------------
// OAuth Authorization Server tables for the Better Auth `mcp` / `oidcProvider`
// plugin. Property names (camelCase) MUST match the plugin's field names so its
// Drizzle adapter binds correctly; SQL column names stay snake_case per repo
// convention. `oauth_access_token` / `oauth_consent` reference the application's
// unique `client_id` (not its `id`), matching the plugin schema.
// ---------------------------------------------------------------------------

export const oauthApplication = sqliteTable(
  'oauth_application',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon'),
    metadata: text('metadata'),
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'),
    redirectUrls: text('redirect_urls').notNull(),
    type: text('type').notNull(),
    disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('oauth_application_user_id_idx').on(t.userId)],
);

export const oauthAccessToken = sqliteTable(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    accessToken: text('access_token').notNull().unique(),
    refreshToken: text('refresh_token').notNull().unique(),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }).notNull(),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }).notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    scopes: text('scopes').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('oauth_access_token_client_id_idx').on(t.clientId),
    index('oauth_access_token_user_id_idx').on(t.userId),
    index('oauth_access_token_refresh_expires_idx').on(t.refreshTokenExpiresAt),
  ],
);

export const oauthConsent = sqliteTable(
  'oauth_consent',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    scopes: text('scopes').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    consentGiven: integer('consent_given', { mode: 'boolean' }).notNull(),
  },
  (t) => [
    index('oauth_consent_client_id_idx').on(t.clientId),
    index('oauth_consent_user_id_idx').on(t.userId),
  ],
);

// Re-export `sql` so callers building raw fragments don't need a second import path.
export { sql };
