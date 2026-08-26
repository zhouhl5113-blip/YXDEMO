# Evidence Index

| Evidence | Purpose | Current result |
| --- | --- | --- |
| `asset-verification.csv` | Required asset presence and SHA-256 | 8/8 match |
| `evidence/manifest-amendment.md` | Missing-hash amendment and prototype key sanitization | Recorded; AMap rotation still required |
| `evidence/delivery-artifact-generation.json` | Stable-ID extraction counts | 464 trace rows; 82 matrix rows |
| `evidence/story-acceptance-amendment.json` | Product-owner correction for missing Story acceptance IDs | `TEST-146..163` added; original IDs preserved; `STORY-001` resolved |
| `evidence/g7-gap-local-design-approval.json` | Exact ADR-0004 and G7-GAP-001..010 local approval | Design/test/draft migration review allowed; execution, live G7, Agent/R3, production and Secret/RBAC changes prohibited |
| `evidence/foundation-credentialless-build.json` | Pre-gate toolchain, TDD, coverage and boundary assertions | 11/11 tests pass; TypeScript/Biome pass; no live G7 call, migration, Service or deployment |
| `evidence/foundation-credentialless-tests.junit.xml` | Machine-readable Foundation unit/contract result | 11 tests, 0 failures, 0 skipped |
| `evidence/foundation-authorization-policy.json` | Local authorization policy TDD, trace links and negative assertions | 12/12 focused tests pass; runtime, persistence and production limitations retained |
| `evidence/foundation-authorization-tests.junit.xml` | Machine-readable local authorization test result | 12 tests, 0 failures, 0 skipped |
| `evidence/foundation-session-authorization-policy.json` | Session version, selected-role, approval separation and minimal audit contract evidence | 15/15 focused tests pass; local BFF boundary now exists, while persistent audit, real revocation propagation and RLS remain absent |
| `evidence/foundation-session-authorization-tests.junit.xml` | Machine-readable session authorization contract result | 15 tests, 0 failures, 0 skipped |
| `evidence/foundation-workbench-build.json` | Local workbench clean check/build and prohibited-action record | Format/lint/strict/build pass; 48/48 tests pass; Product/Design gates remain blocked |
| `evidence/foundation-workbench-tests.junit.xml` | Current machine-readable combined regression result | 48 tests, 0 failures, 0 skipped |
| `evidence/foundation-workbench-browser-qa.json` | Browser interaction and responsive acceptance for the local application shell | Search, role switch, map fallback, local accept and 1440/1280/390 viewports pass; no application console errors |
| `evidence/foundation-workbench-security.json` | Local workbench static and runtime security baseline | Risky sink/credential scan and HTTP boundary checks pass; dependency audit, strict script CSP and Harness Security Gate remain blocked |
| `evidence/dispatch-workflow-build.json` | US-005..007 local dispatch implementation and prohibited-action record | Check/build pass; 54/54 tests pass; persistence, migrations and live G7 remain disabled |
| `evidence/dispatch-workflow-tests.junit.xml` | Machine-readable TEST-013..018 domain regression | 6 tests, 0 failures, 0 skipped |
| `evidence/dispatch-workflow-smoke.json` | Local BFF role, validation, idempotency and pending-sync smoke | All assertions pass; no external write |
| `evidence/dispatch-workflow-browser-qa.json` | Dispatch interaction, Chinese copy and responsive QA | Draft, candidate review, override and confirmation pass at 1440/1280/390 |
| `evidence/dispatch-sync-recovery-build.json` | US-008 local failure/retry/revoke/backlog implementation record | Check/build pass; 57/57 tests; real G7, persistence and monitoring remain disabled |
| `evidence/dispatch-sync-recovery-tests.junit.xml` | Machine-readable TEST-021..023 domain regression | 3 tests, 0 failures, 0 skipped |
| `evidence/dispatch-sync-recovery-smoke.json` | Local BFF failure-to-readback recovery smoke | CONFIRMED preserved; FAILED -> RETRYING -> SYNCED on one command |
| `evidence/dispatch-sync-recovery-browser-qa.json` | Visible retry/revoke/impact state and responsive QA | Recovery flow passes at 1440/1280/390 with no console or overflow errors |
| `evidence/screenshots/workbench-1440x900.png` | 1440x900 desktop visual evidence | SHA-256 recorded in browser QA JSON |
| `evidence/screenshots/workbench-1280x720.png` | 1280x720 compact desktop visual evidence | No clipped work rows; SHA-256 recorded in browser QA JSON |
| `evidence/screenshots/workbench-390x844.png` | 390x844 mobile work-surface evidence | No page or toolbar horizontal overflow; SHA-256 recorded in browser QA JSON |
| `evidence/screenshots/dispatch-candidates-1440x900.png` | Candidate comparison visual evidence | Blockers, advice, freshness and source remain visibly distinct |
| `evidence/screenshots/dispatch-confirmed-1280x720.png` | Compact desktop dispatch confirmation evidence | Business and sync status remain separate with no horizontal overflow |
| `evidence/screenshots/dispatch-confirmed-390x844.png` | Mobile dispatch confirmation evidence | Long command reference wraps; bottom navigation remains available |
| `evidence/screenshots/dispatch-sync-failed-1440x900.png` | Desktop synchronization failure evidence | Last attempt, impact, upstream reference, retry and revoke remain visible |
| `evidence/screenshots/dispatch-sync-synced-390x844.png` | Mobile synchronization recovery evidence | Same command converges to SYNCED with no page/control overflow |
| `product-design-gate-check.md` | Human-readable Product/Design readiness verdict | `FAIL (BLOCKED)`; structure valid, mandatory approvals/evidence absent |
| `evidence/product-design-gate-check.json` | Machine-readable gate structure and blocker result | 10/10 structure checks pass; verdict `BLOCKED` |
| `evidence/product-design-gate-tests.junit.xml` | Prior gate-validator regression evidence | 15 tests at the previous checkpoint; current combined regression is 48/48 in `foundation-workbench-tests.junit.xml` |
| `g7-capability-matrix.csv` | One row per FR with ownership/reuse/gap decision | 82 rows updated with authenticated inventory; contract tests blocked |
| `evidence/g7-public-api-catalog.json` | Hashed public G7 catalog/OpenAPI evidence | 107 catalog, 30 selected schemas |
| `evidence/g7-target-application-confirmation.json` | Product-owner target application and credential-status confirmation | `ZHLDEMO` confirmed dedicated; old credentials remain active for dependent systems and are prohibited for this project |
| `evidence/g7-credential-dependency-decision.json` | Shared-credential dependency and safe development decision | Existing credentials retained for other systems; this project is credentialless/offline only |
| `evidence/g7-workbench-sandbox-inventory.json` | Redacted target-tenant application, Scope and SANDBOX inventory | Confirmed target; 41 active scopes/107 endpoints; SANDBOX 82 supported/25 unsupported; no credential inspected |
| `g7-gap-decisions.md` | Governed local-gap review records | 10 approved for local design/test/migration review; 0 approved for activation or production |
| `harness-discovery.md` | Live Harness scope and independent readback | Project + 3 environments bound; Service/Pipeline/Infrastructure/Secrets absent |
| `evidence/harness-scope-create.json` | Controlled Harness scope mutation/readback | Project + dev/preprod/prod created; no deployment, Secret or RBAC mutation |
| `evidence/harness-readback-2026-08-25.json` | Latest live Harness read-only inventory | Project + 3 environments; 0 Service/Pipeline/Infrastructure/Secret; managed Secret Manager connector healthy |
| `evidence/local-runtime-discovery.json` | Local host capability and setup decision | WSL 1 selected; production unsuitable |
| `evidence/local-runtime-setup.json` | Installed local data services and repeatable health checks | PostgreSQL 16 and Redis 7 healthy; Redis Streams passed; loopback-only |
| `evidence/identity-governance-assignment.json` | Named identity-governance responsibilities and separation-of-duties status | 周贺龙 assigned Product/Security/Data; independent R3 approver absent and R3 disabled |
| `evidence/local-design-approval.json` | Action-specific local Design approval and mandatory disabled controls | ADR-0003/OQ-008 policy contracts approved locally; Agent, R3, live G7 write, production and Secret changes disabled |
| `repo:docs/security/YXDEMO-threat-model.md` | Repository-grounded assets, boundaries, abuse paths and prioritized mitigations | Context confirmed for local/intranet/VPN; 10 threats recorded; security review required |
| `repo:docs/security/identity-access-decision-brief.md` | Account, role, session and authorization proposal | Option A confirmed; implementation remains blocked pending approval |
| `repo:docs/architecture/adr-0003-keycloak-identity-application-authorization.md` | Identity provider and application authorization boundary | Accepted only for local policy contracts/tests; runtime, persistence and production remain blocked |
| `repo:docs/architecture/adr-0004-g7-platform-first-local-data-boundaries.md` | Minimum local ownership, schema gate and rollback rules for G7 gaps | Accepted for local design/test/migration review; requires signed SANDBOX evidence and named activation review before migrations execute |
| `gap-approval-packet.md` | One-page G7 gap and local Design approval record | Exact project-owner decision recorded; no production or execution approval inferred |
| `traceability.csv` | RQ/UJ/FR/NFR/AD/EP/US/TEST/OQ linkage | 464 rows; 163 stable TEST IDs; US-001 and US-004..008 have partial local evidence; external/persistence acceptance remains open |
| `open-decisions.md` | Blocking administrator/product decisions | OQ-008 resolved locally; credential, gaps, runtime, Acceptance and production governance remain open |
| `release-plan.md` | Immutable promotion and rollback | Draft, target/owners unresolved |
| `evidence/workspace-validation.md` | Control-record validation | Passed at `intake`; local runtime, 57-test combined regression, browser QA and gate structure passed |
