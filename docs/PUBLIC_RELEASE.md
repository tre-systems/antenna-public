# Public release contract

This repository is the neutral, self-hosted Antenna distribution. A private
hosted product may contribute code to it, but the repositories keep separate
Git histories and deployment identities.

## Direction of travel

Reusable fixes and features move from a reviewed private snapshot into a branch
in this repository as a curated content change. Do not merge, rebase, or replace
this history with the private repository. Improvements made here can be applied
back to a private deployment as ordinary, reviewed changes.

Publish security and correctness fixes promptly. Group larger product changes
into coherent slices so their public configuration, documentation, and tests can
be reviewed together.

## Public overlay

Keep these files public-specific when adapting a private change:

- `LICENSE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `.github/`
- `.env.example`, Worker development examples, and `apps/worker/wrangler.toml`
- `apps/web/src/brand.ts`, web icons, privacy and terms templates
- `docs/SELF_HOSTING.md`, `docs/SECRETS.md`, and this release contract

The public overlay may evolve independently. Never overwrite it wholesale from
a hosted deployment.

## Exclusions

Do not publish:

- credentials, tokens, owner data, collection contents, or data-bearing
  migrations
- production account, database, bucket, route, domain, OAuth, or monitoring
  identifiers
- deployment workflows or hosted-service operational configuration
- TRE logos, product lockups, parent-brand endorsement, or verification assets
- private-only sources, operator integrations, commercial terms, or internal
  planning documents

## Release procedure

1. Start from a clean branch based on the current public `main`.
2. Identify one coherent private change and copy only reusable implementation,
   tests, and documentation.
3. Reapply the public overlay and remove deployment- or operator-specific
   assumptions.
4. Review the complete diff, including generated and binary assets.
5. Run the isolation check and standard gates:

   ```sh
   npm run check:public-release
   npm run verify
   npm run test:contracts
   npm run test:e2e
   npm run test:e2e:a11y
   npm run check:bundle
   npm run audit:security
   ```

6. Confirm secret scanning passes in GitHub before merging or tagging a release.
7. Describe the public behaviour change without naming private users, resources,
   or deployment details.

`check:public-release` rejects known private product identifiers and requires
the checked-in Worker configuration to retain its local auth origin, placeholder
D1 identifier, and lack of a production route. It supplements secret scanning;
it does not replace human review.
