# 易行物流智能工作台

当前仓库包含已核验产品资产、Foundation 工具代码和获批的本地合成数据工作台，不是生产应用或发布候选。

## 当前状态

- `artifact-manifest.yaml` 中 8 个 required 资产均存在且 SHA-256 一致。
- 静态 HTML 仅作为只读 `product-reference`；其中原有高德 Key 已从仓库版本移除。
- 需求证据覆盖 44 RQ、15 UJ、82 FR、25 NFR、45 AD、12 EP、74 US 和 163 个稳定 TEST ID；原 `TEST-001..145` 未重新编号。
- Harness Account/Org/Project 与 dev/preprod/prod Environment 边界已绑定；Service、Pipeline、Infrastructure 和 Secrets 仍为空。
- `ZHLDEMO` 已确认，但现有 G7 凭据仍被其他系统使用。本项目只允许脱敏清单、官方公开合同和合成夹具，live G7 调用会失败关闭。
- Product Gate 与 Design Gate 均处于阻断状态；本地应用壳已获批准并通过构建，但尚未创建生产应用服务、数据库迁移或部署资源。
- 已建立 Node.js 24、TypeScript 5 strict、Biome、Node test runner、共享契约和 `packages/integrations/g7` 的无凭据边界。
- 已完成仓库威胁模型并确认账号技术方向：自托管 Keycloak 负责认证，应用 BFF + PostgreSQL RLS 负责细粒度业务授权；ADR-0003 仅获本地合同与测试批准，真实认证运行时和 RLS 仍未启用。
- `apps/web` 提供可运行的 Next.js 本地工作台；使用合成数据，真实 G7/高德写入、Agent、模型和 R3 保持关闭。

交付证据快照位于 `docs/delivery/yixing-logistics-workbench-2026-08-24/`。控制记录的权威工作副本由 Harness Delivery Workspace 管理。

## 安全边界

禁止提交 G7、高德、模型、数据库、Redis、会话或 KMS 凭据。真实值只能由已批准的 Secret Manager 提供。开发、测试和预生产默认只使用 G7 SANDBOX；PROD 绑定必须等待 Acceptance Gate 和人工批准。

## 本地验证

当前电脑可从 PowerShell 运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-Workspace.ps1 -Task install
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-Workspace.ps1 -Task check
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-Workspace.ps1 -Task verify:evidence
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-Workspace.ps1 -Task gate:product-design
powershell -ExecutionPolicy Bypass -File .\scripts\Invoke-Workspace.ps1 -Task dev:web
```

`check` 会依次执行格式检查、lint、TypeScript strict 和全部单元/离线合同测试。测试不会读取 `.env`、G7 凭据或生产数据。

`dev:web` 在 `http://127.0.0.1:3000/` 启动本地工作台。它只显示合成数据，不能用作生产部署。

`verify:evidence` 检查 82 行 G7 能力矩阵、464 行追踪和门禁边界是否自洽；`gate:product-design` 只在 Product/Design Gate 真正可放行时成功。当前它应返回 `BLOCKED` 和非零退出码。

## 当前代码边界

- `packages/contracts`：仅包含架构允许共享的结构化错误、TenantScope 和事件 envelope。
- `packages/integrations/g7`：仅包含 G7 端口、公开合同元数据和 fail-closed 访问策略；没有 HTTP、签名或真实凭据读取。
- `packages/identity-policy` 与 `packages/workbench-session`：本地授权、会话版本、租户范围和最小拒绝审计边界。
- `apps/web`：Next.js Web/BFF 本地应用壳；浏览器提交的租户值不会成为可信租户来源。
- `tests/unit`：共享契约的确定性测试。
- `tests/contract`：基于脱敏证据和合成数据的离线 G7 边界测试，不是 SANDBOX 行为证据。

详见 `docs/architecture/adr-0002-credentialless-g7-development.md`、`docs/architecture/adr-0003-keycloak-identity-application-authorization.md` 和 `docs/security/YXDEMO-threat-model.md`。
