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
| 6 | US-005 创建派车草稿并比较候选 | TEST-013..014 | Local synthetic workflow implemented; signed G7 candidate contracts and persistence remain open |
| 7 | US-006 校验人车关系并确认派车 | TEST-015..017 | Local validation and idempotent pending command implemented; DB constraint/migration and live G7 readback remain open |
| 8 | US-007 在一条时间线跟进在途变化 | TEST-018..020 | TEST-018 out-of-order projection implemented; TEST-019..020 work creation and fallback composition remain open |
| 9 | Foundation 0 delivery/security baseline | NFR-001..008 evidence | Target Harness scope, infrastructure/connectors and approved G7-GAP/ADR set |

Local progress in this batch: US-001 has a synthetic server-owned session/BFF boundary; US-004 has a responsive synthetic-data workbench shell; US-005..007 now have a local dispatch domain and BFF/UI slice. TEST-013, TEST-014, TEST-015, TEST-017 and TEST-018 pass with unit, smoke or browser evidence. TEST-016 is partial because local validation passes while the database constraint and migration execution remain closed. Real authentication, RLS, persistent audit, signed G7 facts/write/readback and business acceptance remain blocked.

No other Epic starts concurrently. The 2026-08-25 approval authorizes local interfaces, synthetic tests, draft migration review and application shells under ADR-0004; it does not authorize migration execution, signed G7 claims, live G7 writes, Agent/model/R3 capabilities, production deployment, Secret/RBAC changes or Story completion. `STORY-001` is resolved: `US-069..074` now map to `TEST-146..163`, all previous IDs remain stable, and the Build Ready FR count is corrected to 82.
