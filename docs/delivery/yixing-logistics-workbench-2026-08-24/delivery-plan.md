# Delivery Plan

Current stage: `product-design-gate-review`. Product Gate and Design Gate are `BLOCKED`; credentialless repository tooling and integration-boundary contracts may proceed under ADR-0002, but the production application and migrations have not started.

| Batch | Dependencies | Independently reviewable outcome | Immutable candidate | Gate and accountable role |
| --- | --- | --- | --- | --- |
| Product evidence | Verified assets, full requirement extraction, public G7 evidence | 82-row matrix, 446-row traceability, gaps and open decisions | Evidence bundle only | Product Gate / Product owner |
| Credentialless Foundation tooling | Confirmed target app, sanitized inventory, official public contracts, ADR-0002 | Reproducible Node/TypeScript workspace, shared contracts, fail-closed `integrations/g7` boundary and synthetic tests | Review source only; not a release candidate | Product + Design evidence / Engineering |
| G7 SANDBOX discovery | Rotated SANDBOX credentials in Harness, tenant app permissions, named G7 owner | Authenticated app inventory and read/controlled-write contract evidence | Evidence bundle only | Product + Design / G7 integration owner |
| Foundation 0 + US-001..004 | Product/Design approval, target Harness scope, approved gaps/ADRs | Monorepo, tenancy/session/RLS/audit/outbox/telemetry, G7 ports/contracts, CI/container baseline | `yixing-logistics-workbench:<git-sha>-foundation0.<build-id>` plus OCI digest | Build + Security / Engineering and security |
| V1-A | Accepted Foundation 0 candidate | Trusted workbench, order/dispatch/in-transit/map/receipt workflow | New digest, never rebuilt between environments | Acceptance / Operations + Product + QA |
| V1-B | V1-A evidence, identity/device/safety decisions | Six roles, Driver Companion and vehicle readiness | New digest | Acceptance / Fleet + Safety + QA |
| V1-C | Agent/model/tool/approval governance | Exception closure and controlled Agent execution; late-arrival golden case | New digest | Acceptance / AI governance + Operations |
| V1.5 | Separate scope approval after V1 evidence | Customer, settlement, cost, Playbook and knowledge governance | New digest | Full gate chain / Named owners TBD |
| V2 | Separate optimization outcome approval | Metrics, prediction, profitability and improvement loop | New digest | Full gate chain / Named owners TBD |

Sequence is strict: credentialless tooling may run before the gates because it cannot call G7 or create business state; target binding and Product/Design approval are still required before the production application/Foundation 0 services, followed by one independently accepted release slice at a time. The static HTML prototype is always a separate read-only `product-reference` artifact and never enters the production image.
