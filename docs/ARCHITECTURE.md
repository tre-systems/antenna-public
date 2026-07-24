# Architecture

## Overview

```text
Browser ───────────────┐
                      │ HTTPS / SSE
MCP client ── MCP ─────┼──> Cloudflare Worker
                      │      ├── Better Auth + allowlist
Shared-link reader ────┘      ├── plan and source-policy gates
                             ├── D1 metadata and signal points
Cron ────────────────────────>├── connector dispatch
                             ├── R2 optional raw payloads
                             ├── Durable Object SSE channels
                             └── Analytics Engine app events
```

The Worker is the only authority. Browser and MCP clients are presentation and
transport surfaces, not alternate backends.

Rendered diagrams and their Graphviz sources live in
[`docs/diagrams`](diagrams/README.md).

## Packages

### `apps/worker`

Owns routing, auth, persistence, planner execution, source access, cron dispatch,
notifications, SSE fan-out, and static asset serving.

### `apps/web`

Preact single-page application. It renders Worker decisions and submits
validated user intent. It must not decide source rights or public eligibility.

### `apps/mcp`

Local stdio and hosted HTTP MCP surfaces. Tools map to owner-scoped Worker APIs
and preserve explicit approval for mutations.

### `packages/connectors`

Pure async adapters from validated configuration to `AdapterResult`. They use
native `fetch` and do not know about D1, R2, auth, or collection visibility.

### `packages/registry`

Static connector templates, configuration schemas, matching hints, refresh
cadence, server-secret declarations, display metadata, and source policy.

### `packages/shared`

Wire types and Zod schemas shared across trusted server code and clients.

## Data flow

1. A user creates or confirms a signal from a registered template.
2. The Worker validates configuration and stores server-derived metadata.
3. Cron identifies due signals and injects any declared server secret.
4. The connector fetches and normalises source data.
5. The Worker stores change-aware points and status.
6. A collection Durable Object fans out a refresh event over SSE.
7. Read routes serialise an audience-appropriate view.

Connectors never write persistence directly.

## Trust boundaries

### Untrusted

- browser fields and local storage
- MCP tool arguments
- anonymous public and shared-link requests
- connector responses
- source URLs and source payloads

### High trust

- Worker environment secrets
- D1 authentication and OAuth tables
- source-policy registry metadata
- Cloudflare account controls
- deployment workflow credentials

## Public and shared reads

The source gate evaluates:

1. collection visibility
2. signal visibility
3. source-policy existence
4. execution mode
5. rights review status
6. public-display eligibility

Serialisers remove signal configuration, refresh cadence, owner identity, and
raw internal errors. Missing or disallowed resources return 404 to reduce
enumeration information.

## Authentication

Better Auth handles Google OAuth and sessions. The Worker rechecks the configured
email allowlist for authenticated requests. Google provider access and refresh
tokens are discarded before account persistence.

The test bypass requires `BYPASS_AUTH=1` and a defined non-production
`NODE_ENV`. Deployment configuration pins `NODE_ENV=production`.

## Persistence

- D1 stores identity, collections, plans, signal configuration, normalised
  points, alerts, notification state, and MCP/OAuth records.
- R2 may retain selected raw source payloads when registry policy permits it.
- Analytics Engine stores intentionally anonymous application events.
- Durable Objects hold transient stream and rate-limit state.

The public migration chain begins with a schema-only baseline and contains no
operator data.

## Extending Antenna

To add a connector:

1. Implement a pure adapter and co-located tests.
2. Add a typed registry template with a Zod configuration schema.
3. Add explicit source policy and retention decisions.
4. Register the template.
5. Declare server secrets in registry metadata rather than special-casing
   dispatch.
6. Add contract tests for any new audience or sharing behaviour.
