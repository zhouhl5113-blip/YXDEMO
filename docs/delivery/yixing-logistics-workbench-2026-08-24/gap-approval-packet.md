# G7 Gap And Design Approval Packet

Prepared: 2026-08-25. Owner: 周贺龙.

## What Is Ready

- Eight required product assets match the amended manifest.
- `STORY-001` is resolved with `TEST-146..163`; existing IDs were preserved.
- The target `ZHLDEMO` application, 41 active scopes, 82 SANDBOX-supported REST
  endpoints and 18 message scopes are recorded without exposing credentials.
- ADR-0004 defines minimum local ownership and rollback boundaries for all ten gaps.

## Recommended Decision

Approve ADR-0004 and all ten gap boundaries for design and test implementation,
but activate physical migrations one gap at a time only after its signed SANDBOX
evidence and named reviewers exist. Keep these controls unchanged:

- G7 and AMap production credentials remain unbound.
- Shared old G7 credentials remain unused.
- Raw location history is not stored.
- Agent, model calls and `G7-GAP-004/006` runtime stay disabled until OQ-009.
- R3 stays disabled until an independent second approver is assigned.
- Production deployment and Harness Secret/RBAC changes require separate approval.

## Decision Recorded

周贺龙 sent the following exact approval in the Codex task on 2026-08-25:

```text
批准仅限本地开发测试：接受 ADR-0004；批准 G7-GAP-001..010 的数据所有权和最小本地候选进入设计、接口、测试与迁移评审。任何迁移执行仍须对应缺口的签名 SANDBOX 证据和具名复核；G7/高德生产凭据、真实 G7 写入、Agent、模型调用、R3、生产部署、Secret 和 RBAC 变更保持关闭。周贺龙担任 Product、Security、Data 和本地 Design 批准人。
```

This approval still does not allow a migration to run. It permits the project to
finish interfaces, domain tests, draft migrations, local application shells and
review evidence while the dedicated G7 SANDBOX credential is prepared.

## External Action Still Required

To activate G7 contract tests, create a new dedicated SANDBOX credential for
`ZHLDEMO` rather than reusing or invalidating credentials used by other systems.
The values must be entered directly into Harness Secret Manager under:

- `G7_TENANT_CODE`
- `G7_SANDBOX_ACCESS_KEY`
- `G7_SANDBOX_SECRET_KEY`

Do not paste values into Codex, GitHub, screenshots or evidence. Provider-side
creation and Harness Secret mutation require a separate explicit approval.

## Gate Effect

The approval text is recorded in
`evidence/g7-gap-local-design-approval.json`. Design work may proceed under ADR-0004.
Product and Design gates remain blocked until the signed SANDBOX evidence,
remaining retention/runtime decisions and action-specific approvals are complete.
