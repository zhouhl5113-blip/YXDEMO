# First Independently Acceptable Batch

Status: `LOCAL_FOUNDATION_AND_APPLICATION_SHELL_AUTHORIZED_CONTRACT_ACTIVATION_BLOCKED`.

| Order | Story/work | Existing tests | Entry condition |
| --- | --- | --- | --- |
| 1 | Credentialless G7 boundary/tooling | Foundation contract tests; not Story acceptance evidence | Confirmed target app, sanitized inventory, official public contracts and ADR-0002; no signed request |
| 1A | Signed G7 capability and contract evidence | Contract suite to link to existing Story tests | Coordinated credential rotation, Harness SANDBOX Secret references and target app permissions |
| 2 | US-001 在正确租户和权限范围进入工作台 | TEST-001..003 | Authentication, data-scope and audit decisions approved |
| 3 | US-002 同步并检索车队对象目录 | TEST-004..006 | G7 object APIs verified in SANDBOX; projection decision approved |
| 4 | US-003 查看带新鲜度的车辆事实 | TEST-007..009 | Snapshot/feed/history limits and retention verified |
| 5 | US-004 从今天的工作流接手一项变化 | TEST-010..012 | US-001..003 contracts and UX states approved |
| 6 | Foundation 0 delivery/security baseline | NFR-001..008 evidence | Target Harness scope, infrastructure/connectors and approved G7-GAP/ADR set |

Local progress in this batch: US-001 now has a synthetic server-owned session/BFF boundary and US-004 has a responsive synthetic-data workbench shell. TEST-001 and TEST-003 pass at the local BFF boundary; TEST-002 produces a masked audit record but does not persist/read it back. TEST-010..012 have partial browser evidence only. Real authentication, RLS, persistent audit, the prefilled write orchestrator, G7 facts and business acceptance remain blocked.

No other Epic starts concurrently. The 2026-08-25 approval authorizes local interfaces, synthetic tests, draft migration review and application shells under ADR-0004; it does not authorize migration execution, signed G7 claims, live G7 writes, Agent/model/R3 capabilities, production deployment, Secret/RBAC changes or Story completion. `STORY-001` is resolved: `US-069..074` now map to `TEST-146..163`, all previous IDs remain stable, and the Build Ready FR count is corrected to 82.
