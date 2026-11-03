import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth/minimal';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { magicLink } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';

const origin = 'http://localhost:8787';
const fixtureEmail = ['fixture', 'example.invalid'].join('@');
type Verification = { identifier: string; value: string };

const fixture = () => {
  const records = {
    verification: [] as Verification[],
    user: [] as unknown[],
    session: [] as unknown[],
    account: [] as unknown[],
  };
  let delivered: string | undefined;
  const auth = betterAuth({
    baseURL: origin,
    secret: randomBytes(32).toString('hex'),
    database: memoryAdapter(records),
    account: { storeStateStrategy: 'database' },
    socialProviders: { google: { clientId: 'fixture', clientSecret: 'fixture' } },
    plugins: [
      magicLink({
        sendMagicLink: ({ url }) => {
          delivered = url;
        },
      }),
    ],
    logger: { disabled: true },
    rateLimit: { enabled: false },
  });
  return { auth, records, delivery: () => delivered };
};

const post = (path: string, body: unknown) =>
  new Request(`${origin}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });

describe('installed Better Auth verification boundaries', () => {
  it('does not accept database OAuth state as a Magic Link token', async () => {
    const f = fixture();
    const response = await f.auth.handler(
      post('/sign-in/social', {
        provider: 'google',
        callbackURL: '/',
        disableRedirect: true,
        additionalData: { email: fixtureEmail },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json<{ url: string }>();
    const state = new URL(body.url).searchParams.get('state');
    if (!state) throw new Error('OAuth fixture did not create state');
    expect(f.records.verification.some((v) => v.identifier === `auth-state:${state}`)).toBe(true);

    const verification = await f.auth.handler(
      new Request(
        `${origin}/api/auth/magic-link/verify?token=${encodeURIComponent(state)}&callbackURL=/`,
      ),
    );
    expect(verification.status).toBe(302);
    const location = new URL(verification.headers.get('location') ?? '', origin);
    expect(location.searchParams.get('error')).toBe('INVALID_TOKEN');
    expect(verification.headers.has('set-cookie')).toBe(false);
    expect(f.records.user).toHaveLength(0);
    expect(f.records.session).toHaveLength(0);
    expect(f.delivery()).toBeUndefined();
  });

  it('preserves genuine Magic Link sign-in and rejects token replay', async () => {
    const f = fixture();
    const response = await f.auth.handler(
      post('/sign-in/magic-link', {
        email: fixtureEmail,
        callbackURL: '/',
      }),
    );
    expect(response.status).toBe(200);
    const link = f.delivery();
    if (!link) throw new Error('Magic Link fixture did not deliver a link');
    const signedIn = await f.auth.handler(new Request(link));
    expect(signedIn.status).toBe(302);
    expect(signedIn.headers.get('set-cookie')?.includes('session_token=')).toBe(true);
    expect(f.records.user).toHaveLength(1);
    expect(f.records.session).toHaveLength(1);

    const replay = await f.auth.handler(new Request(link));
    expect(replay.status).toBe(302);
    const location = new URL(replay.headers.get('location') ?? '', origin);
    expect(location.searchParams.get('error')).toBe('INVALID_TOKEN');
    expect(f.records.session).toHaveLength(1);
  });
});
