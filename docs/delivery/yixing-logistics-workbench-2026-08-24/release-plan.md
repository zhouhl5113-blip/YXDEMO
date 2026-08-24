# Release Plan

Status: `DRAFT_BLOCKED`. Target environments, owners and production approval are unresolved.

## Artifact Contract

Each batch produces one OCI candidate named `yixing-logistics-workbench:<git-sha>-<slice>.<build-id>` with recorded `sha256:<64-hex>`, SBOM, provenance and signature. Dev, preproduction and production promote the same digest. The prototype is separately published only as read-only `product-reference` and reads no production Secret.

| Environment | Required target | Migration policy | Deployment, evidence and observation | Approval |
| --- | --- | --- | --- | --- |
| Dev | `environmentId` + `infrastructureId` TBD | Preflight only until G7 gaps/ADRs approved; then backward-compatible expand step | Full candidate, health, SANDBOX/stub check and core smoke | Engineering owner TBD |
| Preproduction | IDs TBD | Exact same migration package; restore rehearsal | Same digest; UJ E2E, UI viewports, accessibility, performance, tenant isolation, weak network, concurrency, failure recovery, DAST and business acceptance | Product, QA, Security, Operations TBD |
| Production | IDs TBD | Expand/contract only; previous application digest and compatible schema verified | Proposed 5% canary for 30 minutes, then 25%, then rolling remainder; 24-hour heightened observation. Values are provisional until RELEASE-001 | Explicit human Production approver + SRE TBD |

Release Gate must verify preproduction and production digest equality, signed evidence, production write-action inventory, freeze window, database compatibility and tested rollback. PROD G7 credentials may be bound only after Acceptance Gate and explicit approval.

Rollback triggers: required test/policy failure; digest mismatch; unaccepted critical/high vulnerability; tenant isolation or R2/R3 bypass; G7 write/readback failure; driver safety-mode failure; smoke/CV/SLO breach; or unavailable rollback. Roll back application traffic to the last approved digest; database recovery follows the reviewed forward-fix/restore procedure. Cancelling rollback always requires explicit human approval.
