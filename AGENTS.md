# Repository guidance

Read `README.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`,
`docs/CODING_STYLE.md`, and `docs/SECURITY_PRIVACY.md` before substantial work.

## Workflow

- Check `git status` before editing and preserve unrelated changes.
- Stage only files that belong to the current change.
- Do not commit credentials, personal data, production resource identifiers, or
  private collection contents.
- Use `npm run verify` as the standard quality gate.
- Run contract and E2E tests for API, policy, auth, schema, or browser changes.
- Never bypass Git hooks unless a maintainer explicitly requests it.

## Architecture boundaries

- The Worker owns authentication, source policy, persistence, plan execution,
  and connector dispatch.
- Connectors are pure adapters and do not write D1 or R2.
- Registry metadata is server-owned.
- The browser is not authoritative for template identity, source rights, public
  eligibility, source labels, or refresh cadence.
- Public and shared reads fail closed through collection visibility, signal
  visibility, source policy, and execution mode.
- Generic private URL fetching remains disabled until a safe execution policy
  exists.

## Tests

Unit and integration tests live beside their source. Playwright E2E tests live
under `tests/e2e`.
