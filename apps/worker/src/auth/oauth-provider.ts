import { mcp } from '@better-auth/mcp';
import { jwt } from 'better-auth/plugins';
import { activeOAuthGrantClaims } from './oauth-grant-claims';

export const oauthOrigin = (baseURL: string | undefined): string =>
  new URL(baseURL ?? 'http://localhost:8787').origin;

export const oauthPlugins = (origin: string) => [
  jwt({
    jwt: { issuer: `${origin}/api/auth`, audience: `${origin}/api/mcp` },
    disableSettingJwtHeader: true,
  }),
  mcp({
    loginPage: '/',
    consentPage: '/api/oauth/consent',
    resource: `${origin}/api/mcp`,
    scopes: ['openid', 'profile', 'email', 'offline_access', 'antenna'],
    grantTypes: ['authorization_code', 'refresh_token'],
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultApplicationType: 'infer',
    refreshTokenReuseInterval: 0,
    accessTokenExpiresIn: 900,
    extensions: [
      {
        claims: {
          accessToken: ({ ctx, user, client, sessionId }) => {
            const { adapter: storage } = ctx.context;
            return activeOAuthGrantClaims(
              storage,
              user?.id,
              client.clientId,
              sessionId,
              `${origin}/api/mcp`,
            );
          },
        },
      },
    ],
  }),
];
