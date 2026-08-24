# First Independently Acceptable Batch

Status: `CREDENTIALLESS_FOUNDATION_TOOLING_IN_PROGRESS_APPLICATION_GATE_BLOCKED`.

| Order | Story/work | Existing tests | Entry condition |
| --- | --- | --- | --- |
| 1 | Credentialless G7 boundary/tooling | Foundation contract tests; not Story acceptance evidence | Confirmed target app, sanitized inventory, official public contracts and ADR-0002; no signed request |
| 1A | Signed G7 capability and contract evidence | Contract suite to link to existing Story tests | Coordinated credential rotation, Harness SANDBOX Secret references and target app permissions |
| 2 | US-001 在正确租户和权限范围进入工作台 | TEST-001..003 | Authentication, data-scope and audit decisions approved |
| 3 | US-002 同步并检索车队对象目录 | TEST-004..006 | G7 object APIs verified in SANDBOX; projection decision approved |
| 4 | US-003 查看带新鲜度的车辆事实 | TEST-007..009 | Snapshot/feed/history limits and retention verified |
| 5 | US-004 从今天的工作流接手一项变化 | TEST-010..012 | US-001..003 contracts and UX states approved |
| 6 | Foundation 0 delivery/security baseline | NFR-001..008 evidence | Target Harness scope, infrastructure/connectors and approved G7-GAP/ADR set |

No other Epic starts concurrently. The credentialless tooling row does not authorize an application service, migration, local business state or Story completion. `US-069..074` are separately blocked because their Story definitions contain no `TEST-*` IDs; the source's Build Ready statement also still says 68 FR although the PRD contains 82.
