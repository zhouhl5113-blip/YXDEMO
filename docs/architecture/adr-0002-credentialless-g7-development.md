# ADR-0002: Credentialless G7 Development Boundary

## Status

`ACCEPTED_LOCAL_DEVELOPMENT_ONLY`

## Date

2026-08-24

## Context

`ZHLDEMO` is the confirmed dedicated G7 application for this product, but its existing credentials are still used by other systems. Rotating them now could break those consumers. The credentials have also appeared in a communication channel, so the delivery contract prohibits their first use by this project until a coordinated provider-side rotation is complete.

The project still needs to establish reproducible repository tooling and the server-side G7 anti-corruption boundary. These activities can be performed from sanitized workbench inventory, hashed official API documentation and synthetic fixtures without making a signed G7 request.

## Decision

- Leave all existing G7 credentials unchanged and do not inspect, copy, log or use them.
- Develop only in `CREDENTIALLESS_OFFLINE_CONTRACTS_ONLY` mode until coordinated rotation evidence and Harness Secret bindings exist.
- Create the `integrations/g7` port, error contract, endpoint metadata model and a fail-closed live-use policy before any HTTP adapter.
- Use only synthetic non-production fixtures for automated tests. Fixtures cannot be presented as SANDBOX request/response evidence.
- Keep production mode, signed requests, callbacks, streaming subscriptions and controlled writes unavailable.
- Do not create local business tables, queues, state machines or services under this ADR. Those remain subject to approved `G7-GAP-*` records and their own ADRs.

## Consequences

Positive:

- Foundation tooling and deterministic boundary tests can proceed without risking dependent systems or exposing credentials.
- Browsers, clients and future Agent code cannot accidentally acquire G7 credential material.
- The future live adapter has an explicit fail-closed prerequisite rather than relying on an undocumented environment convention.

Negative:

- No behavioral claim can be made for G7 authorization, signing, throttling, cursor expiry, callbacks or writes.
- US-002 and US-003 remain blocked at their signed SANDBOX acceptance criteria.
- Product and Design gates remain blocked; this ADR authorizes tooling and boundary contracts only, not the production application.

## Exit Criteria

- Owners of every dependent system approve a coordinated credential cutover.
- Old credentials are invalidated and new SANDBOX credentials are stored only in approved Harness Secret entries.
- Signed read-only SANDBOX contract tests pass with values redacted from all evidence.
- G7 limits, signing/clock-skew, retention and callback rules are recorded.

## Related Requirements And Evidence

- AD-001, AD-002, AD-038
- NFR-003, NFR-005, NFR-007
- `docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/g7-credential-dependency-decision.json`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/evidence/g7-workbench-sandbox-inventory.json`
- `docs/delivery/yixing-logistics-workbench-2026-08-24/open-decisions.md`
