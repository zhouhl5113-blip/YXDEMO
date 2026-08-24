---
title: Fleet Office Design Contract
status: final
created: 2026-08-20
updated: 2026-08-21
tokens:
  name: Fleet Office / 车队作战台
  description: 安静、精确、面向连续工作的物流办公界面
  colors:
    canvas: "#F6F7F8"
    surface: "#FFFFFF"
    ink: "#17212B"
    ink_muted: "#65717E"
    line: "#D9DEE3"
    teal: "#087F78"
    amber: "#B87300"
    coral: "#C84D43"
    violet: "#6558B8"
    green: "#187A4D"
  typography:
    sans: "Inter, Noto Sans SC, Microsoft YaHei, sans-serif"
    mono: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    size: [12, 13, 14, 16, 20, 28]
    line_height: [1.35, 1.5]
  rounded: [2, 4, 6, 8]
  spacing: [4, 8, 12, 16, 24, 32]
  components:
    - LifecycleRail
    - CommandSurface
    - ActivityStream
    - ContextDrawer
    - ObjectHeader
    - DataPulse
    - WorkComposer
    - StateNotice
    - AgentRunHeader
    - EvidenceLedger
    - AgentLane
    - ApprovalRail
    - SelectionBar
    - ActionDialog
    - NotificationPanel
    - DriverSafetyHeader
    - RunEvent
---

# Fleet Office 视觉设计契约

## Brand & Style

这是物流办公界面，不是监控大屏，也不是营销站。视觉目标是“清醒、可扫描、可信”：用户在长时间值班中能迅速区分事实、风险和动作，而不会被高饱和装饰或层层卡片消耗注意力。

界面采用浅灰画布、白色工作面和深墨文本。青绿用于可执行主动作，琥珀表示时效风险，珊瑚红表示需要立即干预，紫色只标识系统推断/自动化建议，绿色表示已经确认的正常或完成。颜色必须与图标、文本或形状共同表达状态。

## Colors

| Token | 用途 | 规则 |
|---|---|---|
| `{tokens.colors.canvas}` | 全局画布 | 不使用渐变、光斑或装饰纹理 |
| `{tokens.colors.surface}` | 工作面、抽屉、菜单 | 通过边线而非大阴影分层 |
| `{tokens.colors.ink}` | 主文本、图标 | 正文对比度满足 AA |
| `{tokens.colors.ink_muted}` | 元数据、时间、新鲜度 | 不用于关键告警内容 |
| `{tokens.colors.line}` | 分隔、表格、输入边界 | 1px；仅关键焦点加粗 |
| `{tokens.colors.teal}` | 主动作、选中对象 | 不作为整页背景 |
| `{tokens.colors.amber}` | 即将超时、数据延迟 | 必须附带文字状态 |
| `{tokens.colors.coral}` | 高风险、失败、失联 | 不用于装饰或普通删除提示 |
| `{tokens.colors.violet}` | 系统建议、自动匹配 | 明确标注“建议”，不能伪装为事实 |
| `{tokens.colors.green}` | 已完成、已确认 | “未知”绝不使用绿色 |

## Typography

- UI 与正文采用 `{tokens.typography.sans}`，中文默认 14px/1.5。
- 车牌、请求 ID、游标、时间戳等机器可识别值采用 `{tokens.typography.mono}`。
- 页面工作区标题最高 28px；紧凑面板标题 14-16px，禁止在抽屉中使用英雄字号。
- 字间距固定为 0。用字号、字重和留白建立层级，不压缩字符。
- 数字表格使用等宽数字特性；单位与数值之间保留可扫描间距。

## Layout & Spacing

桌面布局以 1440px 为基准：

- `LifecycleRail`：216px 固定宽度，显示从订单到结算的业务生命周期和待处理数；中等屏折叠为 68px 图标轨。
- `CommandSurface`：最小 690px、弹性增长，承载状态漏斗、筛选、对象表格、批量动作和规划/调度窗格。
- `ContextDrawer`：360-440px，可固定或收起，展示当前对象的完整上下文。
- 顶部命令区 64px；活动流单行最小高度 72px；所有固定控件使用稳定尺寸，加载和状态变化不得导致布局跳动。
- 间距严格取自 `{tokens.spacing}`。同层内容 8-12px，区块之间 24px。

禁止“页面 section 变成悬浮卡片”。活动记录可作为重复列表项使用轻边界；对象抽屉本身是容器，不再嵌套卡片套卡片。

## Elevation & Depth

默认以边线和背景差建立层级：

- 工作面：无阴影。
- 上下文抽屉：左侧 1px `{tokens.colors.line}`。
- 命令面板浮层：`0 12px 32px rgba(23,33,43,.16)`，仅此类临时层使用明显阴影。
- 焦点态：2px `{tokens.colors.teal}` 外框，偏移 2px。

## Shapes

- 容器圆角最大 8px，对应 `{tokens.rounded}`。
- 图标按钮为 36x36px 方形，圆角 6px；有标准符号时不使用带文字的圆角胶囊。
- 状态标签仅用于紧凑状态，圆角 4px；不得以彩色胶囊替代可读句子。
- 头像和实时脉冲点可为圆形；其他业务对象不强行圆形化。

## Components

### LifecycleRail

固定运输生命周期导航。订单、配载、派车、在途、异常、回单、结算为稳定顺序，每项包含 Lucide 图标、业务标签和待处理数；当前项用左侧 3px 青绿条、背景和 `aria-current` 同时表达。角色只改变默认落点和字段，不重排这条链路。

### CommandSurface

包含页面语境、全局命令入口和当前工作流。命令入口支持 `Ctrl/Cmd + K`，占位文本应给出对象或动作示例，而不是“请输入内容”。

### ActivityStream

每条记录固定包含：优先级、发生/到期时间、对象身份、发生了什么、来源与新鲜度、责任状态、一个主动作。选中时整行背景轻微变化，详情在右侧更新，不导航到新页面。

### ContextDrawer

首屏顺序固定为：对象身份、当前状态/新鲜度、最相关事实、当前工作、主动作。轨迹、媒体、原始数据和审计按需展开。抽屉关闭后中央工作流扩展，但选择保留在 URL。

### ObjectHeader

以对象真实名称作为标题，如车牌或司机姓名。二级信息展示组织、类型和关联对象。状态紧邻标题，但不覆盖标题。

### DataPulse

显示“来源 + 发生时间 + 接收时间/相对新鲜度”。四态：新鲜、延迟、失联、未知；必须有文本与图标，不只变色。

### WorkComposer

用于接手、分派、记录干预、设置时限和关闭工作。默认只显示当前步骤所需字段，更多选项渐进展开；高风险关闭必须显示复核要求。

### StateNotice

统一承载外部不可用、部分权限、历史区间超限、游标失效和媒体处理中等状态。文案需说明“发生了什么、哪些数据受影响、用户现在能做什么”。

### AgentRunHeader

Agent 运行头部固定显示线程名称、对象作用域、操作者、风险级别、阶段和恢复入口。建议使用 `{tokens.colors.violet}`，但必须同时显示“建议/运行中”文本；不得用紫色伪装成 G7 事实。

### EvidenceLedger

证据账本是纵向紧凑列表，不是高装饰卡片。每行固定显示事实摘要、来源、发生/接收时间、新鲜度和请求 ID；事实用 `{tokens.colors.ink_muted}`，未知用 `{tokens.colors.amber}`，冲突用 `{tokens.colors.coral}`。展开原始响应时使用等宽字体和可复制的 trace。

### AgentLane

并行专家以 4px 左边界和简短状态行表达，不使用四个大卡片占满工作面。每条 lane 显示专家角色、当前工具、耗时、结论数量和证据覆盖率；完成后可折叠。

### ApprovalRail

审批栏固定在运行线程底部，使用 `{tokens.colors.teal}` 表达可批准动作、`{tokens.colors.coral}` 表达 R3 危险动作。按钮必须是带图标的明确命令，如“批准执行”“拒绝并说明”“修改参数”；禁止“好的”“继续”这类模糊 CTA。

### SelectionBar

用户选中队列行后，在表格上方保留对象名称、当前状态、责任人和角色化主动作。选择不会因筛选或短暂提示而失去；对象不再属于筛选结果时清除选择，并明确回到未选状态。

### ActionDialog

结构化确认框只用于发布、审批、批量处理和紧急上报等具有业务后果的动作。标题说明将做什么，正文列出对象范围、负责人和结果，确认按钮使用完整命令；关闭或取消不改变业务状态。

### NotificationPanel

通知面板从顶部铃铛展开，按“需立即处理、待确认、仅知会”排序。每条通知包含对象、变化、发生时间和可执行动作；未读数量与列表状态同步，关闭面板不清除未读。

### DriverSafetyHeader

司机进入行驶安全模式后，工作面收敛为下一站、导航状态、停车确认和紧急上报。两个动作保持稳定尺寸和高对比度；复杂队列、指标、自由输入及非紧急通知在此状态下隐藏。

### RunEvent

运行事件使用时间线行展示计划、工具调用、返回、重试、人工批准、回读和审计链接。事件颜色不是唯一状态编码，必须同时有文本、图标和时间戳。

## Do's and Don'ts

### Do

- 让车牌、司机、事件和任务成为可直接打开的对象。
- 在事实旁显示来源和新鲜度，在动作旁显示责任和结果。
- 高密度但保持稳定行高、清晰分组和键盘路径。
- 使用熟悉的 Lucide 图标，并为不熟悉的图标提供 tooltip 与可访问名称。
- 把地图用于解释路线、围栏和位置证据，按需打开。

### Don't

- 不用十几张 KPI 卡片占据首屏。
- 不把地图做成所有角色的默认主页。
- 不使用紫蓝渐变、玻璃拟态、大圆角或装饰性光斑。
- 不把“AI 建议”与 G7 事实混合成同一种视觉。
- 不把 Agent 的进度当作业务结果；“工具已返回”与“业务已生效”必须有不同状态。
- 不展示隐藏推理链；只展示短依据、证据引用、冲突和可审计事件。
- 不把“没有数据”显示成“正常”，也不隐藏失败的同步状态。
