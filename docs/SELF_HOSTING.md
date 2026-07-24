# Self-hosting

This guide creates an independent Antenna deployment. Do not reuse resource
identifiers, OAuth clients, or credentials from another installation.

## Prerequisites

- Node.js 22 or later
- a Cloudflare account with Workers, D1, R2, Durable Objects, and Analytics
  Engine available
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
Worker name and R2 bucket name if they are already used in your account.

Analytics Engine is declared by dataset name and does not require a separate
creation command. Durable Object migrations are applied during Worker deploy.

## 3. Configure the URL

Set `BETTER_AUTH_URL` to the final HTTPS origin. Either:

- leave `workers_dev = true` and use the assigned Workers.dev hostname, or
- set `workers_dev = false` and add your own `[[routes]]` custom-domain entry.

The repository deliberately ships without a production route.

## 4. Configure Google OAuth

Create a Web application OAuth client. Add:

- authorised origin: your final HTTPS origin
- redirect URI: `<origin>/api/auth/callback/google`

Google sign-in requests only `openid`, `email`, and `profile`.

## 5. Set secrets

Follow [SECRETS.md](SECRETS.md). Use a narrow `ALLOWED_EMAILS` value before the
first deployment.

## 6. Apply the database baseline

```sh
npx wrangler d1 migrations apply antenna --remote \
  --config apps/worker/wrangler.toml
```

The public baseline creates schema only. First sign-in creates the owner's
initial empty collection.

## 7. Build and deploy

```sh
npm run build
npm run deploy
```

Then verify:

```sh
curl --fail --show-error https://your-host.example/healthz
```

Complete an interactive sign-in, create a collection from a public-safe
template, and verify that a signed-out request cannot read private content.

## 8. Connect MCP

Set an explicit base URL for the local stdio server:

```sh
ANTENNA_BASE_URL=https://your-host.example \
  node apps/mcp/dist/server.js
```

Create a personal token from Antenna's settings page or configure an OAuth MCP
client against the hosted `/api/mcp` endpoint.

## Production hardening

- create a staging environment before schema or policy changes
- protect the deployment environment in GitHub
- separate CI from deployment
- enable secret scanning, push protection, dependency updates, and code scanning
- configure operator-specific privacy, terms, retention, and incident response
- review public-display source licences and attribution
- monitor `/healthz`, Worker errors, D1 failures, and connector status
