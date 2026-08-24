# Delivery Workspace Validation

Observed: `2026-08-24T09:03:40Z`. Result: `PASSED` at lifecycle stage `intake`.

Validated commands:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test-HarnessCodexSetup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\Test-DeliveryWorkspace.ps1 -Path .\deliveries\yixing-logistics-workbench-2026-08-24
```

Results:

- Harness/Codex workspace setup passed; hosted Harness OAuth remains optional/pending because the authenticated read-only local MCP fallback is active.
- Delivery record JSON, identifier, stage, gate ordering, evidence directory, Secret hygiene and traceability schema passed.
- Required asset verification passed 8/8.
- Generated evidence contains 82 G7 matrix rows and 446 traceability rows with exact stable-ID counts.
- The repository prototype contains one empty AMap key declaration and no embedded key value.
- GitHub `main` is the default branch at audited commit `21d209fe970fef89dfe3ca8052efe4437796f48b`; the original evidence branch remains available.
- Harness delivery evidence is published on `codex/harness-scope-evidence` for review in Draft PR #1; the last published head before this validation was `60ca72758ada1c324c02fdfdba0b1db025181cc3`.
- Harness Project `default/yixing_logistics_workbench` and Environment boundaries `yixing_dev`, `yixing_preprod`, `yixing_prod` were created in a one-shot confirmed session and independently read back through the default read-only connection.
- Service, Pipeline, project Secrets and all three Infrastructure definitions remain absent.
- Local host discovery identified Windows Server 2025 with no exposed hardware virtualization. The approved restart completed; Microsoft WSL `2.7.12.0` now runs Ubuntu 24.04 as WSL 1 with kernel `4.4.0-26100-Microsoft`.
- PostgreSQL `16.15` and Redis `7.0.15` are healthy and reachable from Windows on loopback ports 5432 and 6379. PostgreSQL listens on `localhost`; Redis binds `127.0.0.1 -::1` with protected mode enabled.
- Redis Streams `XADD`, `XRANGE` and `DEL` passed, and the temporary verification key was removed.
- `scripts/Setup-LocalRuntime.ps1` passed PowerShell parser validation and a repeat execution. PSScriptAnalyzer is not installed, so lint evidence is not claimed.
- `gitleaks` is not installed locally; Harness Secret scanning remains mandatory at Security Gate.

No gate transition, Secret/RBAC change, firewall change, application database/schema creation, database migration or deployment was attempted. PostgreSQL package installation created only its default system cluster. Product and Design gates remain blocked by the decisions in `open-decisions.md`.
