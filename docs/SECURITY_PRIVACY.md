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

| Data                   | Location         | Protection                                    |
| ---------------------- | ---------------- | --------------------------------------------- |
| Session tokens         | D1               | opaque values, owner-scoped auth checks       |
| Google provider tokens | not retained     | discarded before account persistence          |
| MCP personal tokens    | D1 `mcp_tokens`  | one-way SHA-256 hashes                        |
| MCP OAuth grants       | D1 OAuth tables  | high-trust database access controls           |
| Connector secrets      | Worker secrets   | injected only by dispatch                     |
| Signal configuration   | D1               | owner-only APIs; removed from anonymous reads |
| Normalised points      | D1               | collection and source-policy gates            |
| Optional raw payloads  | R2               | registry retention decision and owner access  |
| Anonymous usage events | Analytics Engine | curated fields only; no stable user/device ID |

## Authentication controls

- Sign-in requires Google OAuth and an operator-maintained allowlist.
- The allowlist is normalised and checked when sessions are used.
- OAuth state and PKCE are handled by Better Auth.
- Provider access, refresh, and ID tokens are discarded before persistence.
- Sign-out invalidates the current session.
- Production pins `NODE_ENV=production`; the E2E bypass checks this value before
  accepting a synthetic principal.

Operators should avoid requesting provider scopes that the deployment does not
use and should remove stored provider tokens when no connector needs them.

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

| Threat                            | Primary controls                                      |
| --------------------------------- | ----------------------------------------------------- |
| Broken object-level authorization | owner predicates and route-level tests                |
| Shared-link enumeration           | high-entropy slugs, 404 on unavailable resources      |
| Source-policy bypass              | server-owned registry and fail-closed serializer      |
| SSRF                              | arbitrary REST/private fetching disabled by policy    |
| Stored credential disclosure      | Worker secrets, token minimisation/hashing, redaction |
| Cross-site scripting              | Preact escaping and restrictive response headers      |
| Brute force and abuse             | Durable Object rate limiting                          |
| Replay or double confirmation     | atomic plan claim and idempotent writes               |
| Supply-chain compromise           | lockfile, dependency review, pinned CI actions        |

## Operator checklist

Before internet exposure:

- create dedicated least-privilege Cloudflare and OAuth credentials
- set a restrictive email allowlist
- rotate example or development secrets
- enable GitHub secret scanning, push protection, Dependabot, and code scanning
- review every public-display source licence and terms
- configure retention and deletion procedures
- publish operator-specific privacy and terms notices
- test anonymous public/shared routes with private signals present
- test log and error redaction
- rehearse secret rotation and incident response

See [SECURITY.md](../SECURITY.md) for private vulnerability reporting.
