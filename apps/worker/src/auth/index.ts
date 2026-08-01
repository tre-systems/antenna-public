// Use Better Auth's minimal runtime with the D1 Drizzle adapter.

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { mcp } from 'better-auth/plugins';
import { db, type Env as DbEnv } from '../db/client';
import {
  account,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  user,
  verification,
} from '../db/schema';
import { protectAccountTokens } from './account-tokens';
import { accessRules, assertSessionUserPermitted, emailPermitted, refusalReason } from './access';
import { ensureUserCollection } from './ensure-user-collection';

export { ensureUserCollection } from './ensure-user-collection';
export { recordStarterSignalDismissal } from './starter-signals';

export type AuthEnv = DbEnv & {
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly ENCRYPTION_KEY: string;
  readonly ALLOWED_EMAILS?: string;
  readonly BLOCKED_EMAILS?: string;
  readonly BETTER_AUTH_URL?: string;
};

const GOOGLE_SCOPES: ReadonlyArray<string> = ['openid', 'email', 'profile'];

export const trustedOriginsForAuth = (baseUrl: string | undefined): ReadonlyArray<string> => {
  const localDefaults = ['http://localhost:5173', 'http://localhost:8787'] as const;
  if (!baseUrl) return [...localDefaults];

  const origin = new URL(baseUrl).origin;
  if (origin.startsWith('https://')) return [origin];
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return localDefaults.includes(origin as (typeof localDefaults)[number])
      ? [...localDefaults]
      : [...localDefaults, origin];
  }
  return [...localDefaults];
};

export const createAuth = (env: AuthEnv) => {
  const rules = accessRules(env);
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
      // Our BA tables are declared in singular form to match BA defaults.
      usePlural: false,
    }),
    plugins: [
      // Issue audience-bound MCP access tokens without exposing Google tokens.
      mcp({
        loginPage: '/',
        // Repeat loginPage to satisfy OIDCOptions; the plugin uses the top-level value.
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
            // Better Auth redirects thrown create errors back to the SPA.
            if (!emailPermitted(rules, incoming.email)) {
              throw new Error(`Account ${refusalReason(rules, incoming.email)}`);
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
            await assertSessionUserPermitted(client, incoming.userId, rules);
          },
          after: async (created) => {
            // Restore a missing collection for returning users.
            await ensureUserCollection(client, created.userId, env.DB);
          },
        },
      },
      account: {
        create: {
          before: async (incoming) => {
            return { data: await protectAccountTokens(incoming, env.ENCRYPTION_KEY) };
          },
        },
        update: {
          before: async (incoming) => {
            return { data: await protectAccountTokens(incoming, env.ENCRYPTION_KEY) };
          },
        },
      },
    },
    trustedOrigins: [...trustedOriginsForAuth(env.BETTER_AUTH_URL)],
  });
};

export type Auth = ReturnType<typeof createAuth>;
