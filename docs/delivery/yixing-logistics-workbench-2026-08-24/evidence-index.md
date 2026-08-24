# Evidence Index

| Evidence | Purpose | Current result |
| --- | --- | --- |
| `asset-verification.csv` | Required asset presence and SHA-256 | 8/8 match |
| `evidence/manifest-amendment.md` | Missing-hash amendment and prototype key sanitization | Recorded; AMap rotation still required |
| `evidence/delivery-artifact-generation.json` | Stable-ID extraction counts | 446 trace rows; 82 matrix rows |
| `g7-capability-matrix.csv` | One row per FR with ownership/reuse/gap decision | 82 rows updated with authenticated inventory; contract tests blocked |
| `evidence/g7-public-api-catalog.json` | Hashed public G7 catalog/OpenAPI evidence | 107 catalog, 30 selected schemas |
| `evidence/g7-workbench-sandbox-inventory.json` | Redacted target-tenant application, Scope and SANDBOX inventory | 41 active scopes/107 endpoints; SANDBOX 82 supported/25 unsupported; no credential inspected |
| `g7-gap-decisions.md` | Proposed local-gap review records | 10 proposed, 0 approved |
| `harness-discovery.md` | Live Harness scope and independent readback | Project + 3 environments bound; Service/Pipeline/Infrastructure/Secrets absent |
| `evidence/harness-scope-create.json` | Controlled Harness scope mutation/readback | Project + dev/preprod/prod created; no deployment, Secret or RBAC mutation |
| `evidence/local-runtime-discovery.json` | Local host capability and setup decision | WSL 1 selected; production unsuitable |
| `evidence/local-runtime-setup.json` | Installed local data services and repeatable health checks | PostgreSQL 16 and Redis 7 healthy; Redis Streams passed; loopback-only |
| `traceability.csv` | RQ/UJ/FR/NFR/AD/EP/US/TEST/OQ linkage | 446 rows; implementation not started |
| `open-decisions.md` | Blocking administrator/product decisions | G7 workbench access resolved; credential contracts and governance remain open |
| `release-plan.md` | Immutable promotion and rollback | Draft, target/owners unresolved |
| `evidence/workspace-validation.md` | Control-record validation | Passed at `intake`; local runtime and setup script passed |
