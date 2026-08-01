# Secrets and configuration

Never commit real values. Local Worker secrets belong in
`apps/worker/.dev.vars`; deployed values belong in Cloudflare Worker secrets.

## Required Worker secrets

| Name                   | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth web client                                        |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                     |
| `BETTER_AUTH_SECRET`   | session signing secret; generate with `openssl rand -hex 32`   |
| `ENCRYPTION_KEY`       | Google-token AES-GCM key; generate with `openssl rand -hex 32` |

## Optional Worker secrets

| Name                        | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `ALLOWED_EMAILS`            | optional sign-in allowlist; unset means open Google sign-up     |
| `BLOCKED_EMAILS`            | addresses always refused; wins over `ALLOWED_EMAILS`            |
| `ADMIN_EMAILS`              | readers of aggregate deployment-wide operational signals        |
| `GITHUB_TOKEN`              | higher GitHub API limits for supported connectors               |
| `TRADING_ECONOMICS_API_KEY` | authenticated economic-data fallback                            |
| `BEACON_INGEST_TOKEN`       | authenticates application-event ingestion                       |
| `CF_ANALYTICS_API_TOKEN`    | reads configured Analytics Engine and Cloudflare analytics data |
| `APP_HEALTH_MANIFEST`       | JSON allowlist mapping app IDs to operator-owned health URLs    |
| `SENTRY_DSN`                | Worker error reporting                                          |

Optional connector secrets are injected only when their registered template
declares them. Missing values produce `setup_required`; they must never be
placed in signal configuration.

## Local setup

```sh
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
openssl rand -hex 32
```

Use `http://localhost:8787` as the authorised JavaScript origin and
`http://localhost:8787/api/auth/callback/google` as the local Google redirect.

## Deployment

From `apps/worker`, set each required production value:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put ENCRYPTION_KEY
```

Set `ALLOWED_EMAILS` as a secret too when the instance should be closed. Set
public, non-secret values in `wrangler.toml`. Do not put credentials in
`[vars]`, CI logs, build arguments, or Vite variables.

Use distinct credentials for local, staging, and production environments.
Rotate a value immediately if it appears in source control or logs.
