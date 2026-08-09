# Antenna specification

This document owns the current product contract: what Antenna is, who it serves, and which behavior
users can rely on. [ARCHITECTURE.md](ARCHITECTURE.md) owns implementation shape.

## Product Goal

Antenna is a developer-owned personal signal layer for people and their agents. It turns a small set
of reviewed sources into fresh, attributable, owner-scoped observations that can be read visually in
an installable app or programmatically through MCP.

The primary user is a developer who asks an agent to configure signals, add a connector when one is
missing, and use the collection in a recurring report. Antenna is not a no-code connector
marketplace. Code and deployment remain acceptable parts of extending it.

## Product Contract

### Accounts And Collections

- Google OAuth is the only interactive sign-in method.
- Sign-up is open when `ALLOWED_EMAILS` is unset. `BLOCKED_EMAILS` is the moderation lever and wins
  over the allowlist.
- Every account has at least one owner-scoped collection and may create up to ten.
- Collections have a title, optional description, ordered signals, saved layout, refresh mode, and
  `private`, `shared`, or `public` visibility.
- Private is the default. Shared-link slugs are bearer capabilities and are revoked when a
  collection returns to private.
- Public discovery is disabled. External access is by direct link only.

### Signals

A signal is a configured instance of a server-owned connector template. It has:

- a title, position, visibility, refresh interval, and validated configuration;
- sourced observations with fetch and observation timestamps;
- `loading`, `live`, `stale`, or `error` status, including the last successful refresh;
- optional history and registry-defined alert rules;
- Worker-resolved source label, URL, attribution, and rights metadata.

New signals start `loading`. The one-minute cron dispatches only due work, honors retry gates, and
stores successful observations. A recoverable source failure keeps prior good data as `stale`; a
first or unrecoverable failure becomes `error`. The browser also presents old `live` data as stale
when it is older than twice the configured refresh interval.

### Signal Authoring

MCP is the primary authoring surface. An agent:

1. lists the templates and owned collections;
2. proposes a signal from an exact template or a natural-language request;
3. shows the stored plan, source, missing configuration, and target collection to the user;
4. confirms only after explicit approval.

The Worker, not the client, resolves template identity, source policy, refresh cadence, and display
metadata. Confirmation accepts patches only for configuration fields marked missing in the stored
plan, then validates the complete configuration before writing signals. Concurrent confirmation of
one plan creates at most one set of signals.

Natural-language matching is deterministic and makes no model call. Unmatched requests are stored
as owner-scoped connector requests so a developer can decide whether to implement a connector.
Fresh-account onboarding retains a browser composer; there is no general post-onboarding “track
something” flow.

### PWA Workspace

The installable Preact app is the visual and arrangement surface. It provides:

- collection switching, source and freshness detail, status, history, and recent alerts;
- saved card arrangement and slideshow presentation;
- collection and signal visibility controls that remain subject to Worker policy;
- light/dark themes, responsive layouts, and service-worker updates.

An SSE channel prompts collection-scoped refetches after changes. The app falls back to polling
after repeated stream failures. The PWA never becomes authoritative for source or access policy.

### Agent Access

The Worker hosts a `2026-07-28` per-request Stateless MCP endpoint at `/api/mcp`, with a stateless
`2025-11-25` compatibility path; the repository also ships a local stdio entry point using the same
server factory. Both call the existing owner-scoped Worker API and expose the same tools, resources,
and prompts.

MCP OAuth is the supported credential flow. Owners can inspect and disconnect clients. Historical
manual `pbk_` credentials remain revocable, but new manual-token issuance is disabled. Read tools
may run without approval; tools that confirm, update, reorder, or remove data require the agent to
show the proposed change and receive explicit approval.

### Source And Sharing Policy

Each connector template points to a reviewed policy in `packages/registry/src/source-policy.ts`.
The policy owns source identity, rights posture, execution mode, public-display eligibility,
attribution, and review notes.

Every anonymous collection read must pass all of these gates:

1. the route matches the collection visibility;
2. the signal visibility permits that route;
3. the source is reviewed and eligible for external display;
4. execution mode is `public_cloud`.

External reads omit signal configuration, refresh cadence, and owner controls. `requires-auth`,
`needs-review`, manual, deployment-owned, credentialed, and private-source signals fail closed.
Public-cloud results may be shared between owners only when they depend on configuration alone and
retain no raw payload; points, status, alerts, and history always remain owner-scoped.

Personal-finance monitoring is instrument-only: public symbols, prices, performance, distributions,
rates, and market context are permitted. Antenna never stores an owner's quantities, balances, book
costs, gains or losses, account identifiers, cash holdings, or portfolio value.

## Deliberate Boundaries

Antenna does not currently provide:

- a generic arbitrary-URL server-side fetcher or generated connector runtime;
- a public connector marketplace, collection discovery feed, ranking, or social interaction;
- automated email briefs or a separate daily-brief screen;
- brokerage sync, portfolio accounting, trading, or financial advice;
- native mobile applications, multi-user collection editing, billing, or paid plans;
- an LLM in collection, dispatch, source policy, or plan matching.

Potential changes to these boundaries belong in GitHub issues until implemented.
