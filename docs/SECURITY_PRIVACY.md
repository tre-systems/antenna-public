# Security and privacy

## Security objectives

- authenticated reads and writes are owner-scoped
- public and shared reads fail closed
- credentials never reach the browser, logs, connector configuration, or public
  responses
- connector output remains untrusted until normalised
- production cannot enable the test auth bypass
- operational failures do not expose raw database or source errors

## Sensitive data

| Data                   | Location                | Protection                                          |
| ---------------------- | ----------------------- | --------------------------------------------------- |
| Session tokens         | D1                      | opaque values, owner-scoped auth checks             |
| Google provider tokens | D1 `account`            | AES-GCM encrypted; unused ID token discarded        |
| MCP personal tokens    | D1 `mcp_tokens`         | one-way SHA-256 hashes                              |
| MCP OAuth grants       | D1 OAuth tables         | high-trust database access controls                 |
| Connector secrets      | Worker secrets          | injected only by dispatch                           |
| Signal configuration   | D1                      | owner-only APIs; removed from anonymous reads       |
| Normalised points      | D1                      | collection and source-policy gates                  |
| Optional raw payloads  | R2                      | registry retention decision and owner access        |
| Anonymous usage events | Analytics Engine        | curated fields only; no stable user/device ID       |
| Shared fetch snapshots | D1 `upstream_snapshots` | public-cloud sources only; no owner, no credentials |

## Authentication controls

- Sign-in requires Google OAuth. Who may complete it is two lists:
  `ALLOWED_EMAILS` unset means **anyone with a Google account can sign up**;
  set means only those addresses. `BLOCKED_EMAILS` always refuses and wins over
  the allowlist. Set `ALLOWED_EMAILS` unless open sign-up is what you want.
- Both lists are normalised and rechecked at user creation, at session
  creation, and on every authenticated request, so editing either ends live
  sessions and MCP tokens immediately rather than at the next sign-in.
- `ADMIN_EMAILS` is not an access gate. It decides who may read
  deployment-wide operational data, and only aggregate counts cross that
  boundary.
- OAuth state and PKCE are handled by Better Auth.
- Provider access and refresh tokens are encrypted before persistence; the ID
  token and its profile claims are discarded.
- Sign-out invalidates the current session.
- Production pins `NODE_ENV=production`; the E2E bypass checks this value before
  accepting a synthetic principal.

Operators should request only the identity scopes the deployment uses and keep
the encryption key outside source control.

## Public and shared access

Anonymous serializers must never return:

- owner identifiers or email addresses
- signal configuration
- refresh cadence
- connector secrets or setup values
- raw source payloads
- internal stack traces or database errors

The source-access gate requires reviewed public-cloud policy and explicit
audience eligibility. Private-cloud, authenticated, or `needs-review` sources
remain owner-only.

## Shared upstream fetches

One upstream call can serve several accounts, so N users tracking the same
thing cost one fetch rather than N. Reuse is gated on the source's execution
mode: only `public_cloud` sources, whose result depends on their configuration
alone with no per-user credentials and no owner-scoped data, are ever shared.
`private_cloud` sources are fetched per signal, always, and templates that
archive a raw payload are excluded so the archive keeps no gaps.

Only the fetch is shared. Points, status, alerts, and history stay owner-scoped,
so a shared result is indistinguishable from a private one downstream. Widening
what may be shared means changing a source policy under review, not a cache.

## Logging and observability

Sentry and Worker logs remove credentials, cookies, query strings, share slugs,
request bodies, and database query details. New logging must use stable
identifiers and bounded metadata rather than payloads or personal data.

Do not log:

- authorization or cookie headers
- OAuth codes, states, tokens, or secrets
- collection prompts or connector responses by default
- owner email addresses
- private source URLs with embedded identifiers

## Threats and controls

| Threat                            | Primary controls                                   |
| --------------------------------- | -------------------------------------------------- |
| Broken object-level authorization | owner predicates and route-level tests             |
| Shared-link enumeration           | high-entropy slugs, 404 on unavailable resources   |
| Source-policy bypass              | server-owned registry and fail-closed serializer   |
| SSRF                              | arbitrary REST/private fetching disabled by policy |
| Stored credential disclosure      | Worker secrets, encryption/hashing, redaction      |
| Cross-site scripting              | Preact escaping and restrictive response headers   |
| Brute force and abuse             | Durable Object rate limiting, per-account quotas   |
| Replay or double confirmation     | atomic plan claim and idempotent writes            |
| Supply-chain compromise           | lockfile, dependency review, pinned CI actions     |

## Operator checklist

Before internet exposure:

- create dedicated least-privilege Cloudflare and OAuth credentials
- set `ALLOWED_EMAILS`; leaving it unset means anyone who finds the Worker URL can create an account
- rotate example or development secrets
- enable GitHub secret scanning, push protection, Dependabot, and code scanning
- review every public-display source licence and terms
- configure retention and deletion procedures
- publish operator-specific privacy and terms notices
- test anonymous public/shared routes with private signals present
- test log and error redaction
- rehearse secret rotation and incident response

See [SECURITY.md](../SECURITY.md) for private vulnerability reporting.
