# Delivery Workspace Validation

Observed: `2026-08-26T04:46:01Z`. Result: `PASSED` at lifecycle stage `intake`.

Validated commands:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-HarnessCodexSetup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\Test-DeliveryWorkspace.ps1 -Path .\deliveries\yixing-logistics-workbench-2026-08-24
```

Results:

- Harness/Codex workspace setup passed; hosted Harness OAuth remains optional/pending because the authenticated read-only local MCP fallback is active.
- Delivery record JSON, identifier, stage, gate ordering, evidence directory, Secret hygiene and traceability schema passed.
- Required asset verification passed 8/8.
- Generated evidence contains 82 G7 matrix rows and 464 traceability rows with exact stable-ID sets.
- The credentialless Foundation workspace passed frozen dependency installation, Biome formatting/lint, TypeScript strict checking and 11/11 unit/offline contract tests. Coverage was 100% lines, 93.94% branches and 100% functions for the implemented contract surface.
- Traceability now links the approved local BFF/workbench shell to FR-017, NFR-003/005/006, US-001/004 and TEST-001..003/010..012 without marking either Story complete.
- The combined Foundation/workbench regression passed 48/48 tests. The Product/Design evidence validator passed all 10 structure checks; its strict gate mode returned non-zero with verdict `BLOCKED`, as required while decisions and signed G7 evidence are absent.
- The local dispatch increment raises the combined regression to 54/54 tests and covers TEST-013..018 for draft creation, candidate policy, time-window validation, identity conflicts, idempotent confirmation and out-of-order facts. TEST-016 remains partial because its database constraint and migration are correctly blocked pending signed SANDBOX evidence and named review.
- The Next.js 16.3.2 production build passed. Browser QA passed search, map fallback, server-validated local role switching and browser-local exception acceptance at 1440x900, 1280x720 and 390x844 with no application console errors or page-level horizontal overflow.
- The local dispatch BFF smoke passed six-role discovery, read-only-role denial, draft creation, warning override enforcement, missing-idempotency-key rejection, `CONFIRMED/PENDING` confirmation and exact idempotent replay. Browser QA passed the same dispatch flow at 1440x900, 1280x720 and 390x844 with Chinese business messages, no application console errors and no page-level horizontal overflow.
- The local web security baseline passed static risky-sink/credential review and runtime checks for response headers, no-store API responses, browser tenant isolation, cross-site rejection, malformed JSON and the 1024-byte request limit. Strict script CSP, dependency advisories, Harness scans, DAST, SBOM and provenance remain Security Gate blockers.
- The repository prototype contains one empty AMap key declaration and no embedded key value.
- GitHub `main` is the default branch at audited commit `21d209fe970fef89dfe3ca8052efe4437796f48b`; the original evidence branch remains available.
- Harness delivery evidence is published on `codex/harness-scope-evidence` for review in Draft PR #1; the local dispatch implementation checkpoint prepared by this validation is `90cc0d9b3e0c4a29fe31000d040a2a9e2e27d5cf`.
- Harness Project `default/yixing_logistics_workbench` and Environment boundaries `yixing_dev`, `yixing_preprod`, `yixing_prod` were created in a one-shot confirmed session and independently read back through the default read-only connection.
- Service, Pipeline, project Secrets and all three Infrastructure definitions remain absent.
- Local host discovery identified Windows Server 2025 with no exposed hardware virtualization. The approved restart completed; Microsoft WSL `2.7.12.0` now runs Ubuntu 24.04 as WSL 1 with kernel `4.4.0-26100-Microsoft`.
- PostgreSQL `16.15` and Redis `7.0.15` are healthy and reachable from Windows on loopback ports 5432 and 6379. PostgreSQL listens on `localhost`; Redis binds `127.0.0.1 -::1` with protected mode enabled.
- Redis Streams `XADD`, `XRANGE` and `DEL` passed, and the temporary verification key was removed.
- `scripts/Setup-LocalRuntime.ps1` passed PowerShell parser validation and a repeat execution. PSScriptAnalyzer is not installed, so lint evidence is not claimed.
- `gitleaks` is not installed locally; Harness Secret scanning remains mandatory at Security Gate.
- Authenticated G7 workbench discovery completed for application `ZHLDEMO`: 41 active scopes cover 107 production endpoints. The project owner confirmed it is dedicated to this project; confirmation is recorded without credential values.
- G7 SANDBOX is ready and isolated from production. Its inventory reports 82 supported and 25 unsupported REST endpoints plus 18 message-subscription scopes; unsupported REST coverage is recorded as a composition/contract question, not as proof that the platform lacks the capability.
- The 82-row G7 capability matrix now references authenticated workbench inventory and target-application confirmation. The owner confirmed old credentials remain active for dependent systems; they are prohibited for this project. Signed SANDBOX request/response contract tests remain blocked until a coordinated cutover, rotation evidence and Harness Secret binding exist.
- G7 credential details were not opened or recorded. No API request, SANDBOX reset, scope mutation, credential mutation or production write was attempted.

No live G7 call, gate transition, Secret/RBAC change, firewall change, application database/schema creation, database migration, Harness Service creation or deployment was attempted. The approved local synthetic-data runtime now includes the workbench shell and in-memory dispatch BFF; confirmation produces only a pending sync command. PostgreSQL package installation created only its default system cluster. G7-GAP-001..010 are approved for local design/test/migration review only; Product and Design gates remain blocked by the decisions in `open-decisions.md`, missing activation reviews and missing signed G7 contracts.
