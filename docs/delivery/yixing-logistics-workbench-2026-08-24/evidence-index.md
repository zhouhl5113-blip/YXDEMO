# Evidence Index

| Evidence | Purpose | Current result |
| --- | --- | --- |
| `asset-verification.csv` | Required asset presence and SHA-256 | 8/8 match |
| `evidence/manifest-amendment.md` | Missing-hash amendment and prototype key sanitization | Recorded; AMap rotation still required |
| `evidence/delivery-artifact-generation.json` | Stable-ID extraction counts | 446 trace rows; 82 matrix rows |
| `evidence/foundation-credentialless-build.json` | Pre-gate toolchain, TDD, coverage and boundary assertions | 11/11 tests pass; TypeScript/Biome pass; no live G7 call, migration, Service or deployment |
| `evidence/foundation-credentialless-tests.junit.xml` | Machine-readable Foundation unit/contract result | 11 tests, 0 failures, 0 skipped |
| `product-design-gate-check.md` | Human-readable Product/Design readiness verdict | `FAIL (BLOCKED)`; structure valid, mandatory approvals/evidence absent |
| `evidence/product-design-gate-check.json` | Machine-readable gate structure and blocker result | 10/10 structure checks pass; verdict `BLOCKED` |
| `evidence/product-design-gate-tests.junit.xml` | Gate-validator regression evidence | 15 tests, 0 failures, 0 skipped |
| `g7-capability-matrix.csv` | One row per FR with ownership/reuse/gap decision | 82 rows updated with authenticated inventory; contract tests blocked |
| `evidence/g7-public-api-catalog.json` | Hashed public G7 catalog/OpenAPI evidence | 107 catalog, 30 selected schemas |
| `evidence/g7-target-application-confirmation.json` | Product-owner target application and credential-status confirmation | `ZHLDEMO` confirmed dedicated; old credentials remain active for dependent systems and are prohibited for this project |
| `evidence/g7-credential-dependency-decision.json` | Shared-credential dependency and safe development decision | Existing credentials retained for other systems; this project is credentialless/offline only |
| `evidence/g7-workbench-sandbox-inventory.json` | Redacted target-tenant application, Scope and SANDBOX inventory | Confirmed target; 41 active scopes/107 endpoints; SANDBOX 82 supported/25 unsupported; no credential inspected |
| `g7-gap-decisions.md` | Proposed local-gap review records | 10 proposed, 0 approved |
| `harness-discovery.md` | Live Harness scope and independent readback | Project + 3 environments bound; Service/Pipeline/Infrastructure/Secrets absent |
| `evidence/harness-scope-create.json` | Controlled Harness scope mutation/readback | Project + dev/preprod/prod created; no deployment, Secret or RBAC mutation |
| `evidence/local-runtime-discovery.json` | Local host capability and setup decision | WSL 1 selected; production unsuitable |
| `evidence/local-runtime-setup.json` | Installed local data services and repeatable health checks | PostgreSQL 16 and Redis 7 healthy; Redis Streams passed; loopback-only |
| `repo:docs/security/YXDEMO-threat-model.md` | Repository-grounded assets, boundaries, abuse paths and prioritized mitigations | Context confirmed for local/intranet/VPN; 10 threats recorded; security review required |
| `repo:docs/security/identity-access-decision-brief.md` | Account, role, session and authorization proposal | Option A confirmed; implementation remains blocked pending approval |
| `repo:docs/architecture/adr-0003-keycloak-identity-application-authorization.md` | Identity provider and application authorization boundary | `PROPOSED`; Security/Product/Data approval pending |
| `traceability.csv` | RQ/UJ/FR/NFR/AD/EP/US/TEST/OQ linkage | 446 rows; selected Foundation contracts partially implemented; all business Stories remain blocked/not started |
| `open-decisions.md` | Blocking administrator/product decisions | Identity direction recorded; credential, scope, approval and production governance remain open |
| `release-plan.md` | Immutable promotion and rollback | Draft, target/owners unresolved |
| `evidence/workspace-validation.md` | Control-record validation | Passed at `intake`; local runtime, Foundation checks and gate structure passed |
