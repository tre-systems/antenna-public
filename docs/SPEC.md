# Antenna specification

## Product goal

Antenna gives a person and their agents one governed place to read current
signals with source and freshness attached. It is a source-aware signal
composer, not a general scraper, social feed, BI suite, or autonomous agent
backend.

The product is successful when a self-hosting operator can:

1. sign in through an allowlisted Google account
2. create private collections from reviewed templates
3. inspect source, freshness, status, and source-policy posture
4. connect an MCP-aware client to the same owner-scoped data
5. propose signals in natural language and explicitly confirm the stored plan
6. share only signals that pass Worker-enforced policy

## Product contract

### Authentication

- Google OAuth is the interactive sign-in method.
- Only allowlisted email addresses may create or retain sessions.
- Google provider access, refresh, and ID tokens are discarded before the
  account row reaches D1.
- Production ignores the test-only auth bypass.
- MCP bearer values are stored as one-way hashes. OAuth-server access and
  refresh token records remain high-trust D1 data.

### Collections

- Every collection has one owner and is private by default.
- Visibility may be `private`, `shared`, or `public`.
- Non-private collections receive an unguessable slug.
- Anonymous reads omit owner configuration and refresh cadence.
- Public discovery can be disabled independently of direct shared reads.

### Signals

Every returned signal describes:

- title and current value or rows
- source label and source URL when known
- observation and fetch freshness
- status: `live`, `loading`, `stale`, or `error`
- signal visibility and source-policy posture

The browser may render these fields but may not invent them.

### Ask Antenna

The current planner is deterministic:

1. Match prompt fragments against registered connector templates.
2. Extract safe configuration and report missing fields.
3. Store the proposed plan in D1.
4. Accept only missing-field patches from the client.
5. Re-resolve template identity, policy, refresh cadence, and configuration on
   the Worker.
6. Create signals after explicit confirmation.
7. Record unmatched requests for later connector work.

### MCP

MCP is a thin interface over Worker-owned APIs. It may list collections, read
signals and history, run sourced briefs, propose new signals, and perform
explicitly approved mutations. It may not bypass ownership, setup requirements,
or source policy.

## Source policy

Each registered source has server-owned metadata:

- stable source identifier and display label
- execution mode: `public_cloud`, `private_cloud`, or `user_side_runner`
- rights status
- public-display eligibility
- attribution and review notes
- review date
- raw-payload retention decision

Public and shared reads fail closed. A response is allowed only when collection
visibility, signal visibility, execution mode, and reviewed source policy all
permit the requested audience.

Source-policy metadata is an engineering control, not legal advice. Operators
must verify licences and terms for their jurisdiction and intended use.

## Data minimisation

Antenna must not store secrets in source configuration or logs. Personal-finance
signals are instrument-only: public symbols, prices, performance,
distributions, rates, and market context. Do not persist balances, quantities,
book costs, gains or losses, account identifiers, cash holdings, or portfolio
values.

## Out of scope

- arbitrary server-side private URL fetching
- autonomous writes without explicit approval
- public anonymous MCP
- social ranking or a marketplace
- AI-generated values treated as source truth
- custody or analysis of personal financial accounts
