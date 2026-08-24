# 易行物流智能工作台

当前仓库是生产交付的已核验产品资产基线，不是可运行应用，也不是发布候选。

## 当前状态

- `artifact-manifest.yaml` 中 8 个 required 资产均存在且 SHA-256 一致。
- 静态 HTML 仅作为只读 `product-reference`；其中原有高德 Key 已从仓库版本移除。
- 需求证据覆盖 44 RQ、15 UJ、82 FR、25 NFR、45 AD、12 EP、74 US 和 145 个既有 TEST ID。
- Harness 目标项目/服务/环境/基础设施尚未绑定，G7 SANDBOX 合同证据和缺口批准尚未完成。
- Product Gate 与 Design Gate 均处于阻断状态，因此尚未创建生产应用代码、数据库迁移或部署资源。

交付证据快照位于 `docs/delivery/yixing-logistics-workbench-2026-08-24/`。控制记录的权威工作副本由 Harness Delivery Workspace 管理。

## 安全边界

禁止提交 G7、高德、模型、数据库、Redis、会话或 KMS 凭据。真实值只能由已批准的 Secret Manager 提供。开发、测试和预生产默认只使用 G7 SANDBOX；PROD 绑定必须等待 Acceptance Gate 和人工批准。
