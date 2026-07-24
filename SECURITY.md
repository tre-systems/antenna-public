# Security policy

## Supported versions

Security fixes are applied to the latest release and the `main` branch. Early
releases may change quickly; operators should keep dependencies and deployed
Workers current.

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository. Include:

- the affected route, component, or commit
- reproducible steps or a minimal proof of concept
- the expected security boundary
- the observed impact
- any suggested mitigation

Do not include live credentials, private collection contents, OAuth tokens, or
other people's personal data. Do not open a public issue until a fix and
disclosure plan have been agreed.

You should receive an acknowledgement within five working days. Maintainers will
coordinate validation, remediation, release timing, and credit with the
reporter.

## Deployment responsibility

Antenna is self-hosted software. Operators are responsible for Cloudflare,
Google OAuth, email, observability, DNS, secret storage, access control, privacy
notices, source licences, and incident response for their deployment.

The security assumptions and trust boundaries are documented in
[`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md).
