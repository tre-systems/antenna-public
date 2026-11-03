import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { session, user } from './schema';
import { oauthClient } from './oauth-clients';

export const oauth2RefreshToken = sqliteTable(
  'oauth2_refresh_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources', { mode: 'json' }).$type<string[]>(),
    requestedUserInfoClaims: text('requested_user_info_claims', { mode: 'json' }).$type<string[]>(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    revoked: integer('revoked', { mode: 'timestamp_ms' }),
    rotatedAt: integer('rotated_at', { mode: 'timestamp_ms' }),
    rotationReplayResponse: text('rotation_replay_response'),
    rotationReplayExpiresAt: integer('rotation_replay_expires_at', { mode: 'timestamp_ms' }),
    authTime: integer('auth_time', { mode: 'timestamp_ms' }),
    confirmation: text('confirmation', { mode: 'json' }).$type<Record<string, unknown>>(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (t) => [
    index('oauth2_refresh_token_client_id_idx').on(t.clientId),
    index('oauth2_refresh_token_session_id_idx').on(t.sessionId),
    index('oauth2_refresh_token_user_id_idx').on(t.userId),
    index('oauth2_refresh_token_authorization_code_id_idx').on(t.authorizationCodeId),
  ],
);

export const oauth2AccessToken = sqliteTable(
  'oauth2_access_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources', { mode: 'json' }).$type<string[]>(),
    requestedUserInfoClaims: text('requested_user_info_claims', { mode: 'json' }).$type<string[]>(),
    refreshId: text('refresh_id').references(() => oauth2RefreshToken.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    revoked: integer('revoked', { mode: 'timestamp_ms' }),
    confirmation: text('confirmation', { mode: 'json' }).$type<Record<string, unknown>>(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (t) => [
    index('oauth2_access_token_client_id_idx').on(t.clientId),
    index('oauth2_access_token_session_id_idx').on(t.sessionId),
    index('oauth2_access_token_user_id_idx').on(t.userId),
    index('oauth2_access_token_authorization_code_id_idx').on(t.authorizationCodeId),
    index('oauth2_access_token_refresh_id_idx').on(t.refreshId),
  ],
);

export const oauth2Consent = sqliteTable(
  'oauth2_consent',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    resources: text('resources', { mode: 'json' }).$type<string[]>(),
    requestedUserInfoClaims: text('requested_user_info_claims', { mode: 'json' }).$type<string[]>(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('oauth2_consent_client_id_idx').on(t.clientId),
    index('oauth2_consent_user_id_idx').on(t.userId),
  ],
);

export const oauthClientAssertion = sqliteTable('oauth2_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});
