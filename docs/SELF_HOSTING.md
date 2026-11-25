# Self-hosting

This guide creates an independent Antenna deployment. Do not reuse resource
identifiers, OAuth clients, or credentials from another installation.

## Prerequisites

- Node.js 22 or later
- a Cloudflare account on the Workers Paid plan, with D1, R2, and Analytics
  Engine available. The Durable Object classes in `apps/worker/wrangler.toml`
  are declared with `new_classes`, the key-value storage backend, and the
  Workers Free plan offers only the SQLite backend.
- Wrangler authentication
- a Google Cloud OAuth web client
- a domain or Workers.dev hostname

## 1. Install and verify

```sh
npm ci
npm run verify
```

## 2. Create Cloudflare resources

```sh
npx wrangler d1 create antenna
npx wrangler r2 bucket create antenna-payloads
```

Copy the returned D1 database ID into `apps/worker/wrangler.toml`. Change the
Worker name and R2 bucket name if they are already used in your account. The
bucket name appears in `wrangler.toml` and in the two `r2:lifecycle` scripts in
`apps/worker/package.json`; change all three together.

Raw payloads expire after 365 days through a bucket lifecycle rule. Add it to
the new bucket once:

```sh
npm run r2:lifecycle --workspace=apps/worker
```

Analytics Engine is declared by dataset name and does not require a separate
creation command. Durable Object migrations are applied during Worker deploy.

## 3. Configure the URL

Set `BETTER_AUTH_URL` under `[vars]` in `apps/worker/wrangler.toml` to the
final HTTPS origin; it ships as `http://localhost:8787`. Either:

- leave `workers_dev = true` and use the assigned Workers.dev hostname, or
- set `workers_dev = false` and add your own `[[routes]]` custom-domain entry.

The repository deliberately ships without a production route.

## 4. Configure Google OAuth

Create a Web application OAuth client. Add:

- authorised origin: your final HTTPS origin
- redirect URI: `<origin>/api/auth/callback/google`

Google sign-in requests only `openid`, `email`, and `profile`.

## 5. Set secrets

Follow [SECRETS.md](SECRETS.md). The Worker does not exist until step 7, so the
first `wrangler secret put` asks whether to create it; answer yes.

Set `ALLOWED_EMAILS` before the first deployment. Access is decided by two
lists: with `ALLOWED_EMAILS` set, only those addresses can sign in; leave it
unset and **anyone with a Google account who finds your Worker URL can create an
account on it**. `BLOCKED_EMAILS` always refuses and wins over the allowlist.
Both are rechecked on every request, so editing either ends live sessions and
MCP tokens immediately rather than at the next sign-in.

## 6. Apply the database baseline

```sh
npx wrangler d1 migrations apply antenna --remote \
  --config apps/worker/wrangler.toml
```

The public baseline creates schema only. First sign-in creates the owner's
initial empty collection.

### Existing installations

Back up D1 and test migrations on an independent staging database before upgrading
an existing installation. Migration `0004_oauth_provider.sql` creates the supported
OAuth provider tables and adds a unique provider/account identity index. Duplicate
account identities stop the migration before it changes legacy grants; review
duplicates without merging different users.

The migration preserves users, sessions, collections, signals and manual tokens.
It disables legacy OAuth registrations and expires their grants rather than
copying plaintext credentials into the new provider. Reconnect MCP clients after
applying the migration and deploying the matching code. Apply migrations before
accepting traffic with the new release. Do not run this public migration against
another installation's private migration chain.

## 7. Build and deploy

```sh
npm run deploy
```

`npm run deploy` builds the MCP package and the web app before it deploys the
Worker.

Then verify:

```sh
curl --fail --show-error https://your-host.example/healthz
```

Complete an interactive sign-in, create a collection from a public-safe
template, and verify that a signed-out request cannot read private content.

## 8. Connect MCP

Add the hosted endpoint to an OAuth-capable client, then complete browser
sign-in:

```sh
claude mcp add --transport http antenna https://your-host.example/api/mcp
```

### Local stdio server

`npm run build` writes the stdio entry point to `apps/mcp/dist/server.js`. It
reads three environment variables:

| Name               | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `ANTENNA_BASE_URL` | origin of the Worker, for example `http://localhost:8787`; required      |
| `ANTENNA_SESSION`  | the `better-auth.session_token` cookie value, or a whole `Cookie` header |
| `ANTENNA_TOKEN`    | a historical manual token, used in place of `ANTENNA_SESSION`            |

Copy the session cookie from the browser's developer tools after signing in.
Against a local Worker running with `BYPASS_AUTH=1`, the credential is not
checked but one must still be present, so any placeholder works:

```sh
claude mcp add antenna \
  --env ANTENNA_BASE_URL=http://localhost:8787 \
  --env ANTENNA_SESSION=local \
  -- node /absolute/path/to/apps/mcp/dist/server.js
```

New manual-token issuance is disabled. `apps/mcp/dist/token-cli.js` lists and
revokes historical tokens with the same three variables; they are also
revocable from the connections screen.

## Production hardening

- create a staging environment before schema or policy changes
- protect the deployment environment in GitHub
- separate CI from deployment
- enable secret scanning, push protection, dependency updates, and code scanning
- configure operator-specific privacy, terms, retention, and incident response
- review public-display source licences and attribution
- monitor `/healthz`, Worker errors, D1 failures, and connector status
