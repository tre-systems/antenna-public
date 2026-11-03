import { oauthConsentFormSchema } from '@antenna/shared';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { html } from 'hono/html';
import { createAuth } from '../auth';
import { requireUser, type AuthVars, type MiddlewareEnv } from '../auth/middleware';
import { oauthOrigin } from '../auth/oauth-provider';
import { err } from './http';

export const oauthConsentRoute = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>()
  .use('*', bodyLimit({ maxSize: 16384, onError: (c) => err(c, 'invalid_body', 413) }))
  .use('*', requireUser())
  .get('/consent', async (c) => {
    const query = new URL(c.req.url).search.slice(1);
    const auth = createAuth(c.env);
    if (
      query.length > 12000 ||
      !(await verifyOAuthQueryParams(query, (await auth.$context).secret))
    ) {
      return err(c, 'invalid_query', 400);
    }
    const clientId = new URLSearchParams(query).get('client_id');
    if (!clientId) return err(c, 'invalid_query', 400);
    const client = await auth.api.getOAuthClientPublic({
      headers: c.req.raw.headers,
      query: { client_id: clientId },
    });
    c.header('Cache-Control', 'no-store');
    // no-referrer makes native form POSTs send Origin: null and fail the origin guard.
    // Keep the signed query private to this origin while preserving a real form Origin.
    c.header('Referrer-Policy', 'same-origin');
    return c.html(consentPage(client.client_name ?? 'OAuth client', clientId, query));
  })
  .post('/consent', async (c) => {
    if (c.req.header('origin') !== oauthOrigin(c.env.BETTER_AUTH_URL))
      return err(c, 'unauthorized', 403);
    const parsed = oauthConsentFormSchema.safeParse(await c.req.parseBody());
    if (!parsed.success) return err(c, 'invalid_body', 400);
    const auth = createAuth(c.env);
    if (!(await verifyOAuthQueryParams(parsed.data.oauth_query, (await auth.$context).secret))) {
      return err(c, 'invalid_body', 400);
    }
    const headers = new Headers(c.req.raw.headers);
    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');
    const response = await auth.handler(
      new Request(`${oauthOrigin(c.env.BETTER_AUTH_URL)}/api/auth/oauth2/consent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          oauth_query: parsed.data.oauth_query,
          accept: parsed.data.accept === 'allow',
        }),
      }),
    );
    if (!response.ok) return response;
    const result: { url?: unknown } | null = await response.json();
    if (typeof result?.url !== 'string' || result.url.length === 0) {
      throw new Error('Invalid OAuth consent response');
    }
    // Native form redirects to an agent callback are blocked by form-action 'self'.
    // Keep that policy intact and let a normal link finish the validated OAuth response.
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    return c.html(
      html`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Return to your agent — Antenna</title>
          </head>
          <body>
            <main>
              <h1>Return to your agent</h1>
              <p><a href="${result.url}" rel="noreferrer">Continue to your agent</a></p>
            </main>
          </body>
        </html>`,
    );
  });

const consentPage = (name: string, id: string, query: string) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Connect an agent — Antenna</title>
      </head>
      <body>
        <main>
          <h1>Connect ${name} to Antenna?</h1>
          <p>Client ID: ${id}</p>
          <p>
            This agent can read and change your owner-scoped Antenna collections and signals. It can
            maintain access until you disconnect it in Settings → Agents.
          </p>
          <p>Requested permissions: ${new URLSearchParams(query).get('scope') ?? ''}</p>
          <form method="post" action="/api/oauth/consent">
            <input type="hidden" name="oauth_query" value="${query}" />
            <button type="submit" name="accept" value="deny">Deny</button>
            <button type="submit" name="accept" value="allow">Allow access</button>
          </form>
        </main>
      </body>
    </html>`;
