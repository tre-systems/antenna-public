# Diagrams

Graphviz / DOT sources plus rendered PNGs. The `.dot` files are the source of truth; the PNGs are committed for in-browser viewing on GitHub.

## Files

| Diagram                           | Source                   | Rendered                 |
| --------------------------------- | ------------------------ | ------------------------ |
| System overview                   | `system-overview.dot`    | `system-overview.png`    |
| Ask Antenna: prompt → live signal | `ask-antenna-flow.dot`   | `ask-antenna-flow.png`   |
| Ingestion: cron → live data point | `ingestion-flow.dot`     | `ingestion-flow.png`     |
| Source policy and sharing gate    | `source-policy-gate.dot` | `source-policy-gate.png` |
| Data model (ER)                   | `data-model.dot`         | `data-model.png`         |
| Google OAuth via Better Auth      | `auth-flow.dot`          | `auth-flow.png`          |
| Signal lifecycle (state machine)  | `signal-lifecycle.dot`   | `signal-lifecycle.png`   |

## Reading Order

1. **System overview** for the whole Worker / SPA / D1 / R2 shape.
2. **Ask Antenna flow** for how prompts become planned signals, including plan-confirm guardrails.
3. **Ingestion flow** and **signal lifecycle** for refresh, status, SSE, and retry behaviour.
4. **Source policy gate** before sharing, generic REST, Yahoo/Finviz, or user-side/private-source changes.
5. **Data model** when changing persistence or ownership.
6. **Auth flow** when touching Google OAuth, allowlist enforcement, or collection provisioning.

## Conventions

Color coding by domain:

- Green nodes / clusters — Worker-side code (HTTP, planner, executor, adapters).
- Yellow / orange — scheduled or time-driven (cron triggers, dispatchers).
- Purple — registry templates and adapter functions (pure code, no DB writes).
- Teal — persistence (D1, R2).
- Blue — client surface, external sources, and reads.
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
