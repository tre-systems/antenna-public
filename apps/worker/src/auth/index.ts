// Better Auth wiring for the Worker.
//
// We import from `better-auth/minimal` so we don't drag the Kysely runtime
// (full mode) into the Workers bundle. The drizzle adapter then plugs into
// our existing D1-backed client.
//
// Multi-tenant model: every signed-in user owns at least one collection.
// `ensureUserCollection` is idempotent and runs on both user create and
// session create, so a returning user whose collection was deleted out from
// under them is healed on the next sign-in.

import { and, eq } from 'drizzle-orm';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { mcp } from 'better-auth/plugins';
import { PRODUCT_NAME } from '../brand';
import { db, type Env as DbEnv } from '../db/client';
import {
  account,
  collections,
  signals,
  dismissedStarterSignals,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  user,
  verification,
} from '../db/schema';
export type AuthEnv = DbEnv & {
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly ALLOWED_EMAILS: string;
  readonly BETTER_AUTH_URL?: string;
};

const GOOGLE_SCOPES: ReadonlyArray<string> = ['openid', 'email', 'profile'];

export const parseWhitelist = (raw: string | undefined): ReadonlySet<string> => {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
};

// Re-check the whitelist at session-creation time, not just at user creation.
// The `user.create.before` hook only fires once (first sign-in), so without
// this a user removed from ALLOWED_EMAILS could keep signing in with their
// existing account. Fail closed: an unknown user id or a non-whitelisted email
// aborts the session.
export const assertSessionUserWhitelisted = async (
  client: ReturnType<typeof db>,
  userId: string,
  whitelist: ReadonlySet<string>,
): Promise<void> => {
  const rows = await client
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .all();
  const email = rows[0]?.email.toLowerCase();
  if (!email || !whitelist.has(email)) {
    throw new Error('Email not in sign-in allowlist');
  }
};

// Retained for dismissal compatibility with installations that add their own
// starter-template row. The public baseline does not seed operator data.
const SEED_TEMPLATE_COLLECTION_ID = 'seed-collection';

export const ensureUserCollection = async (
  client: ReturnType<typeof db>,
  userId: string,
  _binding?: D1Database,
): Promise<void> => {
  const existing = await client
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.ownerId, userId))
    .limit(1)
    .all();
  const now = new Date();
  if (existing.length > 0) {
    return;
  }
  await client
    .insert(collections)
    .values({
      // Deterministic identity makes simultaneous user/session hooks
      // idempotent without preventing the user from creating more collections.
      id: `primary-${userId}`,
      ownerId: userId,
      title: PRODUCT_NAME,
      layout: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
};

export const recordStarterSignalDismissal = async (
  client: ReturnType<typeof db>,
  collectionId: string,
  signal: typeof signals.$inferSelect,
  now: Date = new Date(),
): Promise<void> => {
  if (collectionId === SEED_TEMPLATE_COLLECTION_ID) return;
  const signature = signalSignature(signal);
  const seedRows = await client
    .select({ id: signals.id })
    .from(signals)
    .where(
      and(
        eq(signals.collectionId, SEED_TEMPLATE_COLLECTION_ID),
        eq(signals.templateId, signal.templateId),
        eq(signals.config, signal.config),
      ),
    )
    .limit(1)
    .all();
  if (seedRows.length === 0) return;

  await client
    .insert(dismissedStarterSignals)
    .values({
      collectionId,
      signalSignature: signature,
      dismissedAt: now,
    })
    .onConflictDoNothing()
    .run();
};

const signalSignature = (signal: typeof signals.$inferSelect): string => {
  const config = typeof signal.config === 'string' ? signal.config : JSON.stringify(signal.config);
  return `${signal.templateId}|${config}`;
};

// Google is used only to establish identity. No connector consumes its provider
// tokens, so discard all bearer-like values before Better Auth persists the
// account. Keeping the columns supports Better Auth's schema without retaining
// credentials the application does not need.
export const minimizeAccountTokens = (
  incoming: Record<string, unknown>,
): Record<string, unknown> => ({
  ...incoming,
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
});

export const trustedOriginsForAuth = (baseUrl: string | undefined): ReadonlyArray<string> => {
  if (baseUrl) {
    const origin = new URL(baseUrl).origin;
    if (origin.startsWith('https://')) return [origin];
  }
  return ['http://localhost:5173', 'http://localhost:8787'];
};

export const createAuth = (env: AuthEnv) => {
  const whitelist = parseWhitelist(env.ALLOWED_EMAILS);
  const client = db(env);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    ...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
    database: drizzleAdapter(client, {
      provider: 'sqlite',
      schema: {
        user,
        session,
        account,
        verification,
        oauthApplication,
        oauthAccessToken,
        oauthConsent,
      },
      // We've declared the BA tables in singular form to match BA defaults.
      usePlural: false,
    }),
    plugins: [
      // OAuth Authorization Server for MCP clients. `claude mcp add --transport
      // http <url>` triggers the existing Google sign-in and auto-issues a
      // per-user token — no manual token to copy. The plugin serves discovery,
      // dynamic client registration, and /mcp/{authorize,token}; access tokens
      // are stored in D1 (oauth_* tables) and audience-bound, so the upstream
      // Google token is never exposed to the MCP client. PKCE (S256) required.
      mcp({
        loginPage: '/',
        // `oidcConfig` is typed as full OIDCOptions (loginPage required); the
        // plugin overrides it with the top-level loginPage at runtime, so we
        // repeat it here only to satisfy the type.
        oidcConfig: { loginPage: '/', requirePKCE: true },
      }),
    ],
    emailAndPassword: { enabled: false },
    account: {
      storeStateStrategy: 'database',
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: [...GOOGLE_SCOPES],
      },
    },
    databaseHooks: {
      user: {
        create: {
          // eslint-disable-next-line @typescript-eslint/require-await -- BA hook signature requires Promise<void>
          before: async (incoming) => {
            const emailLower = incoming.email.toLowerCase();
            if (!whitelist.has(emailLower)) {
              // Throwing from a `before` hook aborts the create — BA surfaces
              // it back through the OAuth callback as an `error=` query param
              // on the redirect to the SPA.
              throw new Error('Email not in sign-in allowlist');
            }
          },
          after: async (created) => {
            await ensureUserCollection(client, created.id, env.DB);
          },
        },
      },
      session: {
        create: {
          before: async (incoming) => {
            // Re-validate the whitelist on every sign-in. Throwing aborts the
            // session, so a de-whitelisted returning user is locked out the
            // same way a brand-new non-whitelisted user is.
            await assertSessionUserWhitelisted(client, incoming.userId, whitelist);
          },
          after: async (created) => {
            // Heal returning users whose collection was deleted out from under
            // them. Idempotent: the helper no-ops when the user already owns
            // a collection, which is the common path.
            await ensureUserCollection(client, created.userId, env.DB);
          },
        },
      },
      account: {
        create: {
          before: (incoming) => Promise.resolve({ data: minimizeAccountTokens(incoming) }),
        },
        update: {
          before: (incoming) => Promise.resolve({ data: minimizeAccountTokens(incoming) }),
        },
      },
    },
    trustedOrigins: [...trustedOriginsForAuth(env.BETTER_AUTH_URL)],
  });
};

export type Auth = ReturnType<typeof createAuth>;
