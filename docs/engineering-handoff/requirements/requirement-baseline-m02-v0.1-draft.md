# M02 Requirement Baseline v0.1 Draft

状态：DRAFT / PENDING APPROVAL
创建日期：2026-09-23（Asia/Shanghai）
前置基线：[M01 Release Candidate Baseline v1.0](../release/M01-release-candidate-baseline-v1.0.md)

本文件是 M02 的需求收集和评审入口，不是开发授权，也不是已批准 Requirement。M01 冻结期间不得用本文件驱动代码、数据库、API Contract 或部署变更。

## 已知边界

当前仓库没有批准的 M02 Requirement 分母。现有设计材料只把以下主题列为 M01 之后的候选范围：

- 密码重置和用户注册
- 企业切换
- 多因素认证和外部 IdP
- Token Refresh
- 正式菜单与权限码管理
- Billing
- 新 Provider 扩展
- 生产部署配置

这些主题均为候选输入，不能直接视为 M02 的 P0 需求。

## M02 立项问题

以下问题在批准前必须由产品、架构和交付负责人确认：

| 编号 | 待确认内容 | 当前状态 |
| --- | --- | --- |
| M02-INT-001 | M02 的业务目标、用户和交付边界 | UNKNOWN |
| M02-INT-002 | P0/P1 Requirement 分母及优先级 | UNKNOWN |
| M02-INT-003 | 每项 Requirement 的验收条件和真实 HTTP 证据 | UNKNOWN |
| M02-INT-004 | 是否包含认证增强、Billing 或 Provider 扩展 | UNKNOWN |
| M02-INT-005 | 数据模型、API Contract 和迁移兼容要求 | UNKNOWN |
| M02-INT-006 | 运行环境、发布窗口、回滚和观测要求 | UNKNOWN |
| M02-INT-007 | 计费、余额、支付对账或权益变更的业务规则 | UNKNOWN |
| M02-INT-008 | 生产 SLA、审计保留和安全合规要求 | UNKNOWN |

## 候选需求主题

以下主题可以作为 M02 讨论材料，尚未进入 Requirement 分母：

1. 用户身份生命周期：注册、密码重置、Token Refresh、企业切换。
2. 身份提供方扩展：多因素认证和外部 IdP。
3. 管理权限治理：正式菜单、权限码和审计边界。
4. 商业化能力：Billing、支付状态、人工入账和权益一致性。
5. Provider 能力扩展：新 Provider、路由策略和上线验证。
6. 生产运行能力：部署配置、回滚、可观测性和 SLA。

## 批准门槛

M02 Baseline 只有在以下材料齐备后才能从 DRAFT 变为 APPROVED：

- 已确认的 Requirement 分母和优先级。
- 每项 Requirement 的验收标准、Contract 影响和证据类型。
- 数据库、API、配置及迁移影响评估。
- 依赖、风险、回滚和发布责任人。
- 产品、架构、Backend、Frontend、Integration 和 QA 的签字或等效审查记录。

在批准之前，任何实现分支都必须标记为未授权；发现需求缺口时按 Baseline 变更管理规范提交 Change Request，不得自行补全业务语义。
