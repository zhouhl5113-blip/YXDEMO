# Identity and Access Decision Brief

Status: `DIRECTION_CONFIRMED_IMPLEMENTATION_APPROVAL_PENDING`

Observed: `2026-08-24`

Decision owner: Project initiator

Security/data approval: `PENDING`

## Confirmed context

- 访问范围：仅本机、公司内网或 VPN，不开放公网匿名访问。
- 账号责任：由易行物流项目建设账号和权限体系。
- 终端：工作人员使用 Web 工作台；司机仅使用 Driver Companion。
- 当前边界：Product Gate 和 Design Gate 仍阻断，不能创建生产身份服务、账号表或数据库迁移。

## Recommended option

选择 `A. 自托管 Keycloak + OIDC + 应用内 TenantScope/RBAC/ABAC`。

Keycloak 只负责认证和账号生命周期：用户名、凭据、MFA、登录流程、OIDC token、会话、撤销、恢复和以后可选的 AD/LDAP 联邦。易行物流 BFF 负责业务授权：租户、角色、组织、标签、车队、车辆/司机任务、班次、代理关系、字段投影和 R0-R3 风险动作。

推荐理由：

- 不自行实现密码哈希、MFA、OIDC 和令牌轮换等高风险基础能力。
- 可在公司内网或 VPN 自托管，数据和运维边界清晰。
- 支持未来对接公司 AD/LDAP 或其他 OIDC/SAML 身份源，不需要重写应用授权。
- Keycloak 的粗角色不能替代应用数据范围；关键授权仍由 BFF 和 PostgreSQL RLS 双重执行。

官方能力依据：

- [OpenID Connect endpoints and authorization code flow](https://www.keycloak.org/securing-apps/oidc-layers)
- [Server administration, MFA, WebAuthn, recovery codes and user federation](https://www.keycloak.org/docs/latest/server_admin/)
- [Production configuration requirements](https://www.keycloak.org/server/configuration-production)
- [Reverse proxy and management-path isolation](https://www.keycloak.org/server/reverseproxy)

## Alternatives

| Option | Result | Reason |
| --- | --- | --- |
| A. Self-hosted Keycloak | `RECOMMENDED` | 成熟认证能力，适合内网/VPN，可未来联邦 AD/LDAP；需要独立备份、升级和高可用运维 |
| B. Application-built passwords and tokens | `REJECT` | 会把密码、MFA、恢复、令牌轮换和安全响应全部变成自研高风险代码 |
| C. Cloud SaaS identity provider | `DEFER` | 运维负担低，但供应商、区域、费用、外网依赖和数据治理尚未决定 |

## Proposed account model

账号真相由身份提供方持有。应用不得保存密码、MFA 秘密或恢复码；若 `G7-GAP-001` 获批，应用只保存不可逆的外部 subject ID 映射、租户成员状态、业务角色、数据范围和审计引用。

| Subject type | Authentication | Application scope |
| --- | --- | --- |
| Workforce user | OIDC Authorization Code + PKCE；MFA | 显式选择的当前租户和角色，再与组织/标签/班次/代理求交 |
| Driver | Driver Companion 的 OIDC 轻量流程；换人/换车重新认证 | 当前司机 + 设备 + 有效任务 + 车辆 + 时间窗 + 允许命令 |
| Service account | 独立机器身份，禁止交互登录 | 单一服务、单一环境、最小接口，不拥有业务管理员角色 |
| Identity administrator | 强 MFA、独立管理入口 | 管理账号和 IdP 配置；默认无运输业务数据权限 |
| Auditor | 强 MFA、只读 | 只读审计证据；敏感字段仍按范围脱敏 |
| Break-glass account | 离线保管、强 MFA、每次人工启用 | 最短期限、全量告警、事后复核，不用于日常操作 |

账号状态建议为 `INVITED -> ACTIVE -> LOCKED/SUSPENDED -> REVOKED`。离职、租户移除、设备丢失或高风险事件必须撤销所有会话，而不是只隐藏前端入口。

## Proposed business roles

角色名称沿用产品六类核心用户，并为现有 PRD 角色提供映射。角色只提供动作集合，不能单独扩大数据范围。

| Role ID | Chinese role | Main allowed work | Explicit restrictions |
| --- | --- | --- | --- |
| `owner` | 物流老板 | 经营驾驶舱、租户内汇总、重大风险和审批 | 不查看 Secret；不能自批本人发起的 R3；不直接修改 G7 事实 |
| `fleet_lead` | 车队长 | 班次、人车就绪、车辆健康、交接和车队资源 | 无身份平台管理；不能越过所辖组织/车队 |
| `operations_manager` | 运营管理者 | 履约队列、风险、跨团队分派、范围内 R2 审批 | R3 必须双人；不能扩大租户或组织范围 |
| `logistics_specialist` | 物流专员 | 订单、客户协同、凭证、草稿和结案 | 无车辆停运/放行和身份管理权限 |
| `dispatcher` | 调度员 | 候选、资源锁、派车、异常调整和交接 | 不能批准本人发起的 R2；发布前必须重新校验资源和范围 |
| `driver` | 司机 | 当前任务、站点、异常、检查、回单和离线补传 | 只能访问绑定任务；无其他司机、经营数据、Agent 控制台或高风险工具 |

兼容映射：PRD 中的管理员、车队经理、安全员、车务人员和只读审计员是职责角色，可由上述业务角色加细分权限集组合，不应创建可以绕过数据范围的“超级业务角色”。身份管理员和安全审批人属于治理角色，与业务角色分离。

## Proposed authorization rule

每个请求都必须由服务端执行以下顺序，显式拒绝优先：

1. 验证 IdP 签名、issuer、audience、有效期、会话状态和认证强度。
2. 从服务端成员关系派生 `tenant_id`，忽略浏览器提交的 tenant、role 和 scope。
3. 检查账号、租户成员、当前角色、班次和代理关系均处于有效时间窗。
4. 计算 `effective permissions = role allow - explicit deny`。
5. 计算 `effective data scope = tenant AND organization AND tag AND fleet AND assignment/shift/delegation`。
6. 对对象、字段和动作再次授权；R2/R3 校验发起人、审批人、过期时间和计划 hash。
7. 将相同 tenant context 放入数据库事务并由 RLS 再校验。
8. 记录允许/拒绝结果、操作者、subject、角色、作用域版本、对象、请求/trace ID 和前后值。

第 5 条是安全优先建议，可解决 PRD OQ-008，但在 Security 与 Product 批准前仍为提案，不得据此创建运行时策略。

## Proposed session policy

以下数字用于形成可测试的安全基线，不是生产批准：

| Session | Proposed limit | Required behavior |
| --- | --- | --- |
| Workforce access token | 10 minutes | 仅服务端验证；不写 localStorage |
| Workforce idle / absolute session | 30 minutes / 8 hours | 活跃续期仍受账号和权限变更影响 |
| Refresh token | Rotating, one-time family | 重用即撤销整族并告警 |
| High-risk reauthentication | Last strong auth within 5 minutes | 敏感导出、身份变更、R3 和紧急授权 |
| Driver access token | 10 minutes | 仅 Driver BFF audience |
| Driver device session | At most one shift, maximum 12 hours | 绑定 driver/device/task/vehicle；换人换车立即重认证 |
| Offline command validity | Per command and task state | 超期、重复、旧任务版本必须拒绝并显示对账结果 |

工作人员默认强制 TOTP 或 WebAuthn，身份管理员、安全审批人和 break-glass 必须使用抗钓鱼的 WebAuthn/passkey 或等效强认证。司机首期可使用受控账号加一次性验证，但不得仅以可猜测的车牌、手机号后几位或长期共享 PIN 认证。

## Provisioning and separation of duties

- 账号邀请必须指定租户、初始角色、组织范围、有效期和发起人。
- 业务角色授权由租户权限管理员发起；身份管理员不能审批自己的业务提权。
- R3 至少需要两个不同自然人，且审批人不能是动作发起人或被代理人。
- 代理和替班必须有原因、开始/结束、范围上限；代理不得超过委托人的权限。
- 停用账号、离职或租户移除应在目标 SLO 内撤销 IdP 会话、应用会话、司机设备会话和待执行批准。
- 所有权限变更保留前后值；删除账号不得删除已产生的业务审计主体引用。

## Acceptance contracts before implementation

- `TEST-001`：伪造客户端 `tenant_id` 无效，服务端只使用可信身份和成员关系。
- `TEST-002`：跨租户、越权字段、越权导出和拒绝事件均不泄露对象摘要并写审计。
- `TEST-003`：角色、组织、代理或账号撤销后，旧会话不能继续提升访问。
- 角色切换只能缩小或保持范围，不能扩大范围。
- 身份管理员不能给自己授予业务权限；R2/R3 不能由发起人自批。
- PostgreSQL 应用查询和 RLS 分别执行相同租户拒绝测试。
- 司机换人、换车、设备撤销、命令重复/乱序/过期和离线恢复均有 E2E 证据。
- token、cookie、日志、trace、错误、截图和浏览器 bundle 中不得出现密码、MFA 秘密、refresh token 或 Secret 值。

## Deployment boundary

确认推荐方案后，下一步才生成 `ADR-0003`，状态保持 `PROPOSED`，并将 AUTH-001 更新为“技术方向已选、Security/Data 审批待办”。在以下条件满足前不得启动真实身份服务或账号数据库：

- Product 与 Design 明确批准账号所有权、OQ-008 数据范围和 `G7-GAP-001/008`。
- 确定身份服务的独立生产主机、TLS 域名、生产数据库、备份恢复和补丁负责人。
- 身份管理入口限定为受控管理网段，运行入口限定为本机/内网/VPN。
- Harness Secret、Service、Infrastructure 和 Pipeline 先读后建，并保留人工生产批准。
- 完成威胁模型中 TM-001、TM-002、TM-003 和 TM-005 的自动化验收。

## Confirmation recorded

项目发起人在收到推荐方案说明后连续指示继续处理，因此以下技术方向已记录为确认：

`同意采用方案 A：自托管 Keycloak 负责认证，易行物流 BFF + PostgreSQL RLS 负责业务权限；当前仅用于内网/VPN，先完成开发测试，不视为生产批准。`

对应 ADR-0003 已生成，状态为 `PROPOSED`。该确认选择技术方向，不替代 OQ-008、`G7-GAP-001/008`、安全/数据审批或生产批准。
