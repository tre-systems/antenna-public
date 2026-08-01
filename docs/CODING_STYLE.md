# Antenna — Coding Style

> Conventions for code that lives in this repo, trimmed to what makes sense at this scale.

## Core principles

- Keep docs aligned with implementation reality. If a doc describes a hardening
  target instead of current behaviour, say so clearly.
- Keep source-rights and visibility decisions server-owned. The browser renders
  policy decisions; it does not invent them.
- Keep connectors pure. They fetch and normalize data, then return structured
  results. They do not write D1, R2, auth state, or collection state.
- Validate at boundaries with shared Zod schemas before mutating state.
- Treat expected failures as data with a closed `ApiErrorCode` or discriminated
  result. Let unexpected platform and programmer failures reach top-level
  telemetry.
- Prefer small, testable helpers over broad rewrites or new framework patterns.
- Co-locate tests with the code they cover unless the test is a true Playwright
  end-to-end flow.

## Project boundaries and side effects

The main ownership lines are:

| Area                  | Owns                                                                        | Must not own                                                                     |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/connectors` | Pure source adapters and narrow parsers                                     | D1/R2 writes, auth, collection mutation, UI policy                               |
| `packages/registry`   | Connector templates, config schemas, source policy, display resolvers       | Browser-only formatting, dispatcher branches, per-user state                     |
| `packages/shared`     | Wire types and schemas crossing app boundaries                              | Worker-only persistence or browser-only presentation state                       |
| `apps/worker`         | Auth, persistence, routing, source policy enforcement, dispatch             | Preact UI state, connector-specific parsing that belongs in adapters             |
| `apps/web`            | Presentation, interaction state, local signals, rendering server-owned data | Source-rights decisions, Worker response shape redeclarations, direct secret use |
| `apps/mcp`            | MCP tool surface over the same shared contracts                             | Alternate business rules or config validation                                    |

Side effects should have clear choke points:

- External data fetches happen through adapters, called by the cron/dispatch
  path.
- DB access goes through the Worker DB client and Drizzle schema.
- Source policy is resolved by Worker/registry helpers before writes or external
  reads.
- SSE notifications are best-effort outputs of Worker state changes, not a
  source of truth.
- Browser state is presentation state unless it is explicitly confirmed through a
  Worker route and revalidated server-side.

When adding a new path, ask which existing owner should receive it before adding
another helper or branch.

## State and API conventions

- Authoritative collection, signal, source-policy, and credential state lives on
  the Worker side.
- Client-submitted plans and edits are patches or suggestions. Re-resolve
  template identity, source policy, refresh cadence, and config validation on the
  server before writing.
- Use typed dependency objects for side-effecting helpers when the collaborator
  list is not obvious from direct parameters.
- Prefer one typed options object once a function has several parameters or
  multiple optional settings.
- Use callable getters only when a collaborator must read fresh mutable state.
  Stable services can be passed directly.
- Keep public HTTP and MCP response shapes in `@antenna/shared` rather than
  redeclaring them locally.

## Size limits

Keep things small enough that the whole shape is visible at once.

- **Files: under 200 lines.** If a file grows past this, extract a helper module, a component, or a hook. Tests have the same budget.
- **Functions: under 20 lines.** Extract complex logic into named helpers. The exception is straightforward declarative content (config tables, route lists, schema objects) — there is no logic to follow, so length is fine.

These are guidelines, not gates. If a 25-line function is clearer than two 12-line ones, leave it. If a 220-line file has no natural decomposition, leave it. Just bias toward smaller.

## TypeScript

- `strict: true` plus the additional flags in `tsconfig.base.json`: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`.
- No `any`. Use `unknown` and narrow, or define a proper type. ESLint is configured to error on `any`.
- Prefer named exports. Default exports only for top-level Preact components when convenient.
- Prefer discriminated unions over throwing for expected error cases:

  ```ts
  type AdapterResult = { ok: true; data: DataPoint[] } | { ok: false; error: AdapterError };
  ```

- `zod` schemas live in `packages/shared/src/zod-schemas.ts` and are the single source of truth for types crossing the wire.

## Validation and errors

- Validate request bodies, query params, MCP inputs, and persisted JSON before
  using them.
- Validate before mutation. If validation fails, return a structured error and
  leave state unchanged.
- Keep public error shapes stable enough for browser and MCP callers to handle.
- Redact secrets, OAuth tokens, recovery material, raw private config, and
  unnecessary personally identifiable information before logging or returning errors.
- Throw for programmer mistakes or platform failures that cannot be handled
  locally. Return typed errors for expected product states.

## Comments

Lean and helpful. Comment **why**, not **what**.

- Don't restate what the code already says.
- Do explain non-obvious constraints, invariants, or workarounds.
- Don't leave commented-out code in committed files.
- Don't write multi-paragraph docstrings or banner comments. One short line is the max.

## Naming

- TypeScript files: `kebab-case.ts` for utilities; `PascalCase.tsx` for Preact components.
- Types and interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE` only for true module-level immutables (URLs, magic numbers). Otherwise `camelCase`.
- Avoid abbreviations except established jargon (URL, API, ID, DB, FX, OAuth).

## Dependency policy

Default to existing platform APIs and local helpers. Add a runtime dependency
only when it clearly:

- removes a real security or correctness risk,
- implements a standard we should not hand-roll,
- removes repeated maintenance burden across multiple modules, or
- handles a complex domain that is not a product differentiator.

New dependency proposals should explain which modules get simpler, what bundle
or Worker/runtime cost is introduced, what security/maintenance risk is added,
and how the dependency fits the existing package boundaries.

## Tests

- Vitest for unit and integration. Playwright for end-to-end flows.
- **Co-locate** unit and integration tests next to the source they cover: `match.ts` plus `match.test.ts`. **No `test/`, `tests/`, or `__tests__/` directories** for unit / integration tests. The Vitest glob already expects `**/*.{test,spec}.{ts,tsx}` anywhere under `apps/` and `packages/`.
- `tests/e2e/` is the **only** allowed separate test folder — Playwright specs live there because they exercise the running app, not a specific source file.
- Test the public surface of a module, not implementation details.
- Prefer fewer, broader tests over many narrow ones — especially for the planner and adapters where the value is "does it produce the right plan / DataPoint shape," not "does each helper return the expected substring."

## Patterns specific to this codebase

### Adapters (`packages/connectors`)

- Pure async functions: `(config: SignalConfig) => Promise<AdapterResult>`.
- Never touch D1 or R2. The Worker handles persistence.
- Use native `fetch`. No HTTP client libraries.
- Prefer API responses or narrow TypeScript parsers over broad HTML parser dependencies.
- Errors caught inside the adapter, returned as `AdapterError`. Never throw to the caller.

### Registry (`packages/registry`)

- Each connector template is its own file exporting a typed `ConnectorTemplate`.
- `matchHints` are simple keyword / regex arrays — easy to read, easy to add to.
- `paramExtractors` are small functions that pull params from the prompt string. If a template needs an async resolution step (geocoding, symbol lookup, OAuth-account picker), add a `paramResolvers` entry rather than special-casing the planner.
- `rightsStatus` is set on every template, including sources that require auth.
- Treat registry metadata as server-owned. UI code can render source labels and rights posture returned by the Worker, but should not invent or persist source/rights/display metadata independently.
- Every template declares a Zod `configSchema` in the registry. The Worker validates complete planner matches, plan confirmation writes, owner signal updates, and dispatch inputs against that schema. Future MCP write tools must reuse the same schema rather than adding per-tool config checks.
- Templates that should be dispatched but kept out of the public matcher should declare `private: true` rather than living in dispatcher branches.
- Template-specific display rules (`title`, `sourceLabel`, `sourceUrl`, `pointLabel`, `pointSourceUrl`) belong in `packages/registry/src/display.ts`. The Worker resolves them at read time so the SPA does not need per-`template_id` source/rights branches.

### Source-Policy Review Checklist

Every new source needs a matching entry in `packages/registry/src/source-policy.ts` before it is registered in the template list. Review and record:

- **Source id and label:** stable identifier plus the user-facing attribution label.
- **Execution mode:** `public_cloud`, `private_cloud`, or `user_side_runner`. Default to the narrowest mode that works.
- **Rights status:** `public`, `with-attribution`, `requires-auth`, or `needs-review`. Use `needs-review` for anything ambiguous; the dispatcher fails closed.
- **Public-display eligibility:** `true` only when public/shared collection display is reviewed and acceptable. Private-only or page-derived sources stay `false`.
- **Attribution:** the exact source text the Worker can return to browser, MCP, and future public reads.
- **Raw-payload retention:** opt in with `retainRawPayload` only when retention is useful and privacy/licensing posture is explicit.
- **Refresh cadence:** pick a conservative `defaultRefreshSeconds`, then document any rate-limit or market-hours assumption in `reviewNotes`.
- **Review date:** update `lastReviewed` when the source decision changes, not just when code is reformatted.

### Worker code (`apps/worker`)

- Hono routes stay thin: validate input, call into a domain function, return a response. No business logic inline.
- Validate request bodies and query params with Zod schemas from `@antenna/shared`. Hand-rolled `typeof` guards are not enough — use `safeParse` and return `400` with structured `issues` on failure.
- The cron handler is the only place that calls adapters; HTTP routes never fetch external APIs synchronously.
- All DB access goes through `apps/worker/src/db/client.ts` using Drizzle.
- Shared parse/format helpers (`parseConfig`, `parseDimensions`, `toMillis`, ts/Date coercions) live in `apps/worker/src/db/codecs.ts` — do not re-implement them per route or in the dispatcher.
- Mutating routes must scope reads and writes through the authenticated owner via an inner-join on `collections.ownerId`. Do not add per-handler `userOwnsSignal`-style helpers alongside the join — pick one shape and keep it.
- Treat client-submitted signal plans as suggestions or patches. Re-resolve templates, source policy, refresh cadence, and config validation against the server registry's `configSchema` before writing `signals`.
- Use Drizzle `batch()` for multi-row writes that should succeed or fail atomically (plan confirmation, seed cloning). Plain `for` loops over `insert().run()` leak half-written state.
- Compose the Worker env type once (`WorkerEnv`) and import it from a single place rather than spreading `AuthEnv & MiddlewareEnv & DispatchEnv & NotifyEnv` across files; adding a secret should touch one type.

### Frontend (`apps/web`)

- Each `SignalCard` is a single component file.
- Signals (`@preact/signals`) own signal state. No React Context for cross-cutting state.
- No `console.log` in committed code — use a small logger if needed.
- Wire types that cross HTTP (`DataPoint`, `HistoryPoint`, `SignalStatus`, `ApiSignal`) come from `@antenna/shared`. The SPA does not re-declare Worker response shapes locally.
- Prefer server-resolved display strings from `/api/signals` over per-`template_id` branches in the SPA. New source labels, source URLs, and point attribution rules belong in `packages/registry/src/display.ts`; `apps/web/src/signal-format.ts` keeps only browser presentation shaping.

## Documentation and reviews

- One owner doc per topic: product contract in `SPEC.md`, system shape in
  `ARCHITECTURE.md`, secrets in `SECRETS.md`, security/privacy in
  `SECURITY_PRIVACY.md`, and deployment guidance in `SELF_HOSTING.md`.
- Update docs in the same change when behaviour, commands, schemas, routes,
  source policy, operating procedures, or verification steps change.
- Track active work in GitHub issues rather than stable reference docs.
- New sources need the source-policy checklist above. Auth, sharing,
  persistence, and public reads usually need security/privacy review as well as
  focused change review.

## Verifying locally

```
npm run format        # prettier --write
npm run lint          # eslint .
npm run typecheck     # delegates to each workspace's typecheck script
npm run check:doc-links  # verifies local Markdown links and anchors
npm run check:imports    # enforces app/package import boundaries
npm run test:unit     # Vitest unit and integration suite
npm run test:contracts # public/shared/source-policy contract tests
npm run test:e2e      # Playwright (runs tests/e2e specs; wrapper skips only if none exist)
npm run test:e2e:a11y # Playwright + axe accessibility smoke
npm run check:bundle  # web build plus JS/CSS gzip budget check
npm run audit:security # production dependency audit at high severity or above
npm run verify        # standard gate: format, docs, imports, lint, types, diagrams, unit
```

Each workspace exposes its own `typecheck` script that runs `tsc --noEmit` against its `tsconfig.json`. The root `typecheck` fans out via `npm --workspaces --if-present`, and no-ops when no workspaces exist yet.

`verify` includes the cheap doc-link and import-boundary checks. It does not run
the security audit, bundle budget, or a11y e2e by default because those are
slower CI/release checks.

## Git hooks

Husky installs two hooks on `npm install`. Don't bypass with `--no-verify`.

- **`pre-commit`** — `lint-staged` (Prettier on staged `*.{ts,tsx,js,mjs,json,md,css,html}`, ESLint --fix on staged `*.{ts,tsx,js,mjs}`) followed by `npm run test:unit`. Fast; runs on every commit.
- **`pre-push`** — `npm run test:e2e` (Playwright). The current suite includes hosted-flow coverage under `tests/e2e/`; the wrapper skips only if the folder has no specs.

CI also runs secret scanning, the production dependency audit, the bundle
budget, and Playwright. It deliberately does not deploy a public-repository
checkout.
