import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { user } from './schema';

export const oauthClient = sqliteTable(
  'oauth2_client',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'),
    clientDiscoveryId: text('client_discovery_id'),
    disabled: integer('disabled', { mode: 'boolean' }).default(false),
    skipConsent: integer('skip_consent', { mode: 'boolean' }),
    enableEndSession: integer('enable_end_session', { mode: 'boolean' }),
    subjectType: text('subject_type'),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>(),
    clientCredentialsScopes: text('client_credentials_scopes', { mode: 'json' })
      .$type<string[]>()
      .default([]),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    name: text('name'),
    uri: text('uri'),
    icon: text('icon'),
    contacts: text('contacts', { mode: 'json' }).$type<string[]>(),
    tos: text('tos'),
    policy: text('policy'),
    softwareId: text('software_id'),
    softwareVersion: text('software_version'),
    softwareStatement: text('software_statement'),
    redirectUris: text('redirect_uris', { mode: 'json' }).$type<string[]>().notNull(),
    postLogoutRedirectUris: text('post_logout_redirect_uris', { mode: 'json' }).$type<string[]>(),
    backchannelLogoutUri: text('backchannel_logout_uri'),
    backchannelLogoutSessionRequired: integer('backchannel_logout_session_required', {
      mode: 'boolean',
    }),
    tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
    applicationType: text('application_type'),
    jwks: text('jwks'),
    jwksUri: text('jwks_uri'),
    grantTypes: text('grant_types', { mode: 'json' }).$type<string[]>(),
    responseTypes: text('response_types', { mode: 'json' }).$type<string[]>(),
    requirePKCE: integer('require_pkce', { mode: 'boolean' }),
    dpopBoundAccessTokens: integer('dpop_bound_access_tokens', { mode: 'boolean' }).default(false),
    referenceId: text('reference_id'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [index('oauth2_client_user_id_idx').on(t.userId)],
);

export const oauthResource = sqliteTable('oauth2_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes', { mode: 'json' }).$type<string[]>(),
  customClaims: text('custom_claims', { mode: 'json' }).$type<Record<string, unknown>>(),
  dpopBoundAccessTokensRequired: integer('dpop_bound_access_tokens_required', {
    mode: 'boolean',
  }).default(false),
  disabled: integer('disabled', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  policyVersion: integer('policy_version').default(1),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
});

export const oauthClientResource = sqliteTable(
  'oauth2_client_resource',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: 'cascade' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: 'cascade' }),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('oauth2_client_resource_client_id_idx').on(t.clientId),
    index('oauth2_client_resource_resource_id_idx').on(t.resourceId),
    uniqueIndex('oauth2_client_resource_client_id_resource_id_uidx').on(t.clientId, t.resourceId),
  ],
);
