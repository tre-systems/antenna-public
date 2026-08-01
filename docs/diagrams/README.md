# Diagrams

Graphviz / DOT sources plus rendered PNGs. The `.dot` files are the source of truth; the PNGs are committed for in-browser viewing on GitHub.

## Files

| Diagram                        | Source                   | Rendered                 |
| ------------------------------ | ------------------------ | ------------------------ |
| System boundaries              | `system-overview.dot`    | `system-overview.png`    |
| Agent-first signal authoring   | `ask-antenna-flow.dot`   | `ask-antenna-flow.png`   |
| Scheduled signal ingestion     | `ingestion-flow.dot`     | `ingestion-flow.png`     |
| Signal read authority          | `source-policy-gate.dot` | `source-policy-gate.png` |
| Operational data relationships | `data-model.dot`         | `data-model.png`         |
| Google sign-in via Better Auth | `auth-flow.dot`          | `auth-flow.png`          |
| Signal status lifecycle        | `signal-lifecycle.dot`   | `signal-lifecycle.png`   |

## Reading Order

1. **System boundaries** for the browser, MCP, Worker, ingestion, storage, and external-service shape.
2. **Agent-first signal authoring** for proposal, approval, and Worker-owned confirmation guardrails.
3. **Scheduled ingestion** and **status lifecycle** for bounded refresh, persistence, SSE, and retry behaviour.
4. **Signal read authority** before changing owner, shared-link, public, or source-policy behaviour.
5. **Operational data relationships** for ownership, authoring, and ingestion records. Use
   `apps/worker/src/db/schema.ts` and migrations for exhaustive columns and foreign keys.
6. **Google sign-in** when touching Better Auth, account access, token persistence, or initial collection provisioning.

Each diagram answers one architectural question. Keep labels at the responsibility/invariant level;
do not turn a diagram into a second schema, route catalogue, or connector list. Exact fields and
endpoint shapes belong in their owning source or reference document.

## Conventions

Color coding by domain:

- Green nodes / clusters — Worker-owned application behavior and successful outcomes.
- Yellow / orange — scheduled work, retry timing, and signal runtime records.
- Purple — reviewed registry/adapter code and external identity/data services.
- Teal — durable persistence and telemetry stores.
- Blue — client/protocol entry points and observability services.
- Red — error / stale outcomes.
- Diamonds — decisions.
- Bold green outline — terminal success state.

Fonts: Avenir. Rendered at 220 DPI.

## Render

```
npm run diagrams          # render all .dot files to PNG next to the source
npm run check:diagrams    # verify each .dot renders cleanly and the PNG exists
```

Both scripts assume Graphviz is on PATH (`brew install graphviz`). CI installs Graphviz before running `npm run verify`. On a local machine without `dot`, `npm run check:diagrams` skips with a clear message; generated PNGs should still be refreshed before committing diagram changes.

To render one manually:

```
dot -Tpng:cairo docs/diagrams/<name>.dot -Gdpi=220 -o docs/diagrams/<name>.png
```
