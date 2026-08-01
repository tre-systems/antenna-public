---
name: antenna
description: >
  Read and manipulate Antenna signals. Use when the user asks about their
  collection data, wants a morning brief, wants agent-readable context, wants to
  add/remove/refresh a signal, asks why a source is stale or errored, or
  describes a live signal they want to track.
---

# Antenna Skill

Use this Skill when a user is working with Antenna through the MCP server.
Antenna is a source-rights-aware personal signal layer for agents:
it shows live signals, source links, freshness, and status, and it only creates
signals from registered templates.

## Operating Rules

- Read before acting. Use `list_collections` and `list_signals`, or
  `collection://current` for the primary-collection compatibility snapshot, before
  making recommendations.
- Never invent data. If a signal is missing, stale, setup-needed, or errored,
  say that directly and include the source/status detail the tool returned.
- Keep writes user-mediated. Show the exact proposed plan, config patch, order,
  or deletion target, then wait for explicit approval before calling
  `confirm_plan`, `update_signal`, `remove_signal`, or `reorder_signals`.
- Use server-owned template and source metadata. Do not claim a source is public
  or shareable unless the returned source policy says so.
- Prefer source links and freshness over commentary. The useful answer is what
  changed, where it came from, and whether the signal is trustworthy right now.
- Do not turn `manual-metric` into a live-data answer. It is for user-entered
  values only.

## Tool Catalogue

- `list_collections()`: list the caller's collections with ids, titles,
  visibility, update time, and signal counts.
- `get_collection({ collectionId })`: fetch one collection's metadata and ordered
  signal summaries.
- `list_signals({ collectionId?, status?, templateId? })`: list the caller's
  signals with status, source/display metadata, policy, config, and latest
  points. Pass `collectionId` from `list_collections` when the target is known.
- `get_signal({ signalId })`: fetch one signal by id.
- `get_signal_history({ signalId, range? })`: fetch chartable history. Supported
  ranges are `1m`, `3m`, `6m`, `1y`, and `all`.
- `list_connector_requests()`: list unmatched/setup-needed source requests
  captured by Ask Antenna.
- `list_templates()`: inspect registered connector templates and setup/source
  posture.
- `propose_signal({ prompt, collectionId? })`: create a plan from natural language, optionally in a
  selected collection. This does not create signals.
- `propose_template_signal({ templateId, collectionId? })`: create a plan for an exact template
  returned by `list_templates` when `direct_proposal_enabled` is true. This avoids prompt matching
  but does not create signals.
- `reject_plan({ planId })`: reject a pending plan after the user declines it.
- `confirm_plan({ planId, editedSignals? })`: create signals from a pending plan
  after explicit approval.
- `refresh_signal({ signalId })`: request a manual refresh; the dispatcher fetches
  on the next tick.
- `update_signal({ signalId, config?, refreshSeconds?, visibility? })`: patch a
  signal after approval. The Worker validates config and source-policy rules.
- `remove_signal({ signalId })`: delete one signal after approval.
- `reorder_signals({ collectionId?, orderedSignalIds })`: persist the full
  collection order after approval. Include every current signal id exactly once;
  pass `collectionId` for non-primary collections.

## Resources And Prompts

- `collection://current`: current collection snapshot for summarisation.
- `signals://{signal_id}`: one signal snapshot.
- `morning_brief`: built-in prompt for a concise collection summary. It should
  still use `list_signals` and history tools rather than guessing.
- `app_brief`: built-in prompt for production health, Worker errors, browser visits, and meaningful
  product actions. It keeps traffic, visits, health, and usage evidence distinct.

## Common Workflows

### Morning Brief

1. Call `list_collections` if collection choice is ambiguous, then
   `list_signals({ collectionId })` for the selected collection.
2. Group by status: live, loading, stale, error, setup-needed.
3. Call `get_signal_history` with `range: "1y"` for chartable market, crypto,
   macro, FX, and equity-history signals when direction or movement matters.
4. Summarise in practical terms: notable moves, stale/error/setup-needed signals,
   and important source links. Keep it concise.

### Add A Signal

1. Call `list_collections` when the target is ambiguous. Use `propose_signal` with the user's
   natural-language request, or call `list_templates` and `propose_template_signal` when the exact
   connector is known. Pass `collectionId` when targeting a selected collection.
2. Show the returned plan: signal title, template, source, missing fields, setup
   requirements, and source-rights posture.
3. Ask for confirmation. If fields are missing, ask for only those fields.
4. Call `confirm_plan` only after approval. Use `editedSignals` only to fill
   missing config values; do not submit authority fields.
5. Tell the user the signal will populate on the next dispatcher tick.

### Diagnose An Errored Or Stale Signal

1. Call `list_signals({ status: "error" })`, or inspect the reported signal with
   `get_signal`.
2. Surface `last_error`, `last_attempt_at`, `last_ok_at`, source label, and
   source URL.
3. If it looks transient, ask before calling `refresh_signal`.
4. If it looks like source shape, auth, rate limit, or rights trouble, explain
   the likely class and avoid repeated refreshes.

### Review Setup Requests

1. Call `list_connector_requests`.
2. Group requests by source/setup posture: known template missing credentials,
   source review needed, unsupported source, or vague prompt.
3. For known templates, explain the exact next setup action.
4. For unknown or rights-sensitive sources, do not promise live data. Say the
   source needs connector and source-policy review.

### Edit A Signal

1. Call `get_signal` first.
2. Describe the exact current config and proposed patch in human terms.
3. Ask for approval.
4. Call `update_signal` with only the changed fields. The Worker owns schema
   validation, refresh clamping, and public visibility blockers.

### Remove Or Tidy Signals

1. Call `list_collections` if collection choice is ambiguous, then `list_signals`.
2. Show titles, ids, status, and source labels for the affected signals.
3. Ask for explicit approval for each deletion or for the full reordered list.
4. Call `remove_signal` or `reorder_signals`.

## Registered Templates

Use `list_templates` for authoritative runtime details. The list below is
generated from `packages/registry/src/index.ts`; run `npm run skill:templates`
after changing the connector registry.

<!-- BEGIN GENERATED TEMPLATE LIST -->

- `fx-pair` - FX pair; params: `base`, `quote`; rights: public; refresh: 15m.
- `crypto-history` - Crypto history; params: `pairs`; rights: public; refresh: 6h.
- `crypto-watchlist` - Crypto watchlist; params: `pairs`; rights: public; refresh: 10m.
- `macro-market-history` - Macro market history; params: `preset`; rights: with-attribution; refresh: 6h.
- `market-history` - Market history; params: `symbol`; rights: with-attribution; refresh: 6h.
- `market-overview` - Market overview; params: none; rights: with-attribution; refresh: 30m.
- `trading-economics-market` - Trading Economics market; params: `symbol`, `label`, `unit`, `sourceUrl`; rights: with-attribution; refresh: 6h; secret: `TRADING_ECONOMICS_API_KEY`.
- `weather` - Weather; params: `location`, `lat`, `lon`; rights: public; refresh: 30m.
- `airquality` - Air quality; params: `location`, `lat`, `lon`; rights: public; refresh: 30m.
- `equity-watchlist` - Equity watchlist; params: `tickers`; rights: with-attribution; refresh: 10m; planner disabled.
- `sector-movers` - US sector movers; params: none; rights: with-attribution; refresh: 10m.
- `github-trending` - GitHub Trending; params: none; rights: with-attribution; refresh: 6h.
- `github-repo-activity` - GitHub repo activity; params: `owner`, `repo`; rights: public; refresh: 30m.
- `karpathy-jobs-snapshot` - Karpathy jobs snapshot; params: none; rights: with-attribution; refresh: 1d.
- `manual-cost` - Manual cost; params: `provider`, `amount`, `currency`, `period`; rights: requires-auth; refresh: 1d.
- `manual-metric` - Manual metric; params: `value`, `unit`, `label`; rights: public; refresh: 1d.
- `antenna-users` - Antenna users; params: none; rights: requires-auth; refresh: 1h.
- `rest-metric` - REST metric; params: `url`, `jsonPath`, `label`, `unit`; rights: needs-review; refresh: 30m; planner disabled.
- `uk-economic-calendar` - UK economic calendar; params: none; rights: public; refresh: 6h.
- `cisa-kev-recent` - CISA KEV recent additions; params: none; rights: public; refresh: 1h.
- `github-security-advisories` - GitHub Security Advisories; params: none; rights: public; refresh: 6h.
- `cloudflare-incidents` - Cloudflare incidents; params: none; rights: public; refresh: 15m.
- `tbench-leaderboard` - Terminal Bench leaderboard; params: none; rights: with-attribution; refresh: 6h.
- `aa-highlights` - Artificial Analysis highlights; params: `category`; rights: with-attribution; refresh: 1h.
- `aa-frontier` - Frontier model comparison; params: none; rights: with-attribution; refresh: 6h.
- `app-usage` - App usage; params: `project`, `account_id`; rights: requires-auth; refresh: 1h; secret: `CF_ANALYTICS_API_TOKEN`.
- `cloudflare-analytics` - Cloudflare traffic; params: `account_id`; rights: requires-auth; refresh: 1h; secret: `CF_ANALYTICS_API_TOKEN`.
- `project-portfolio` - Project portfolio; params: `projects`, `account_id`; rights: requires-auth; refresh: 1h; secret: `CF_ANALYTICS_API_TOKEN`.
- `app-health` - App health; params: `projects`; rights: requires-auth; refresh: 15m; secret: `APP_HEALTH_MANIFEST`; planner disabled.
- `cloudflare-web-analytics` - Web visits; params: `account_id`, `hosts`; rights: requires-auth; refresh: 1h; secret: `CF_ANALYTICS_API_TOKEN`; planner disabled.

<!-- END GENERATED TEMPLATE LIST -->

## Source Rights

- Respect `source_policy` and `public_display_blocker` on every signal.
- Sources marked `requires-auth`, `needs-review`, private, or cloud-ineligible
  are not safe to present as publicly shareable.
- Ask for credentials only when the setup state says the source needs them.
- Do not suggest scraping a site just because a URL exists. If no reviewed
  template exists, use `propose_signal`; if it becomes a connector request, tell
  the user it needs source review or setup.

## Response Style

- Be terse and operational. Use source names, freshness, and concrete next
  actions.
- Prefer labels such as "GBP/USD", "BTC 1Y", or "Cloudflare incidents" over raw
  config keys.
- If a write tool fails, report the Worker error plainly and do not retry a
  destructive/config-changing action without renewed approval.
