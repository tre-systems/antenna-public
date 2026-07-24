# Contributing

Thank you for improving Antenna.

## Before opening a change

- Search existing issues and discussions.
- For security vulnerabilities, follow [SECURITY.md](SECURITY.md).
- Keep connectors pure: they may use native `fetch`, but must not write D1 or R2.
- Keep source identity, rights, refresh policy, and public eligibility in the
  server-owned registry.
- Never commit credentials, personal data, production identifiers, or real
  private collection contents.

## Development

```sh
cp .env.example .env
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
npm ci
npm run verify
```

Run the browser suite with:

```sh
npm run test:e2e
```

The E2E wrapper creates isolated local D1 state and sets a synthetic principal.
The auth bypass is hard-gated off in production.

## Changes

- Add or update tests with behaviour changes.
- Keep tests beside the source they cover; Playwright specs are the exception.
- Update documentation when configuration, security boundaries, source policy,
  or deployment steps change.
- Edit Graphviz `.dot` files, run `npm run diagrams`, and commit both source and
  rendered output.
- Run `npm run verify`, relevant contract tests, E2E tests, the bundle check, and
  the security audit before requesting review.

Use clear, outcome-focused commits. By contributing, you agree that your
contributions are licensed under the MIT licence.
