# M02 模型路由需求候选 v0.1

状态：DRAFT / PENDING PRODUCT AND ARCHITECTURE REVIEW
日期：2026-09-23（Asia/Shanghai）
适用基线：M02 Requirement Baseline v0.3（本候选尚未纳入其批准分母）
设计提案：[M02 Laya 模型路由决策模块提案 v0.2](../architecture/m02-laya-model-routing-proposal-v0.2.md)

本文用于决定是否将 Laya 辅助的语义模型路由纳入 M02。它不是已批准 Requirement、API Contract、数据库设计或开发授权。M01 仍保持冻结。

## 业务目标候选

在项目明确启用自动模型选择后，平台根据请求任务特征，从该项目已授权的逻辑模型中推荐合适的逻辑模型；平台策略完成最终校验和选择，再由已有 Provider/Channel 路由机制完成实际上游调用。目标是让调用方无需为每类任务硬编码模型名，同时保留平台对权限、成本和可用性的控制。

## Requirement 候选

| ID | 需求候选 | 优先级候选 | 状态 |
| --- | --- | --- | --- |
| HA-M02-ROUTE-001 | 自动路由只可在项目当前已授权、已启用且存在可用 Channel 的逻辑模型集合内选择；任何 Laya 输出都必须经 HA AI 后端策略校验。 | P1 候选 | PENDING |
| HA-M02-ROUTE-002 | 调用方显式指定 `model` 时，保持现有 Contract 的严格模型语义；只有使用经批准的显式自动路由模式或逻辑模型别名时才触发语义模型选择。 | P1 候选 | PENDING |
| HA-M02-ROUTE-003 | Laya 只负责从后端提供的候选中给出语义建议；不得选择 Provider、Channel、Credential 或绕过硬性策略。 | P1 候选 | PENDING |
| HA-M02-ROUTE-004 | Laya 不可用、超时、返回无效结果或低于批准的置信度门槛时，平台只能使用项目预先配置且已授权的默认逻辑模型；没有合规默认值时按批准的错误语义失败。 | P1 候选 | PENDING |
| HA-M02-ROUTE-005 | 每次自动路由应以 Request ID 关联最终逻辑模型、决策器/模板版本、策略版本、降级状态及原因；记录不得默认保存未经脱敏的原始提示。 | P1 候选 | PENDING |
| HA-M02-ROUTE-006 | Laya 推理资源用量与企业 Chat 用量分开核算；Laya 的 token 数不得自动计为企业 Chat 账单或 Usage。 | P2 候选 | PENDING |
| HA-M02-ROUTE-007 | 自动路由模块可按环境开关并可独立健康检查；关闭或故障时，显式模型调用保持原有行为。 | P1 候选 | PENDING |

## 验收条件候选

批准 Requirement 时，应为以下每项补充目标环境和通过阈值：

1. 在给定的中文、英文和中英混合标注语料上，对比 Laya multilingual 与 typed-decisions checkpoint；评估准确率、错误路由率、置信度校准和拒答/回退比例。测试集、样本量、通过阈值和权重摘要待 QA/产品确认。
2. 对任意决策输出，证明后端最终选择属于项目允许集合；构造模型越权、停用模型、无可用 Channel 和 Provider 故障场景，均不得调用未授权上游。
3. 通过真实 HTTP 验证严格模型调用、自动路由调用、项目未启用自动路由、Laya 401/422/5xx、超时、低置信度和默认模型不可用行为。
4. 对同一 Request ID 可追溯语义决策、最终逻辑模型、Provider/Channel attempt、Usage 和响应证据；日志和持久化证据不得包含 Gateway API Key、JWT、Provider 凭证或未经批准的原始提示。
5. 关闭 Laya 后，现有显式模型 Chat 调用通过回归；开启 Laya 后，现有 OpenAI-compatible 请求/响应结构只按批准的向后兼容 Contract 变化。
6. 目标 CPU/GPU、并发、模型预热策略及 P95/P99 延迟、内存/显存、启动时间和恢复目标由产品/运维批准后形成通过标准。

## 尚待确认

| 编号 | 待确认事项 | 负责人建议 |
| --- | --- | --- |
| ROUTE-OPEN-001 | 是否把自动模型路由纳入 M02 Requirement 分母；若纳入，优先级是 P0 还是 P1 | 产品负责人 |
| ROUTE-OPEN-002 | 自动模式使用新的请求扩展字段还是平台逻辑模型别名；如何保持现有 `model` 语义 | Contract/架构负责人 |
| ROUTE-OPEN-003 | 哪些项目可启用、谁配置路线候选与默认逻辑模型 | 产品/平台运营 |
| ROUTE-OPEN-004 | 决策输入是否包含完整当前消息、对话历史或仅摘要；脱敏与留存要求 | 安全/隐私负责人 |
| ROUTE-OPEN-005 | 采用哪个 Laya checkpoint；中文样本、低置信度阈值和模型评估通过线 | AI/QA 负责人 |
| ROUTE-OPEN-006 | 决策时延预算、缓存策略、服务不可用时的 SLA 和熔断策略 | 架构/运维负责人 |
| ROUTE-OPEN-007 | 决策审计字段是否扩展候选 `ha_ai_routing_decision` 表，还是新增独立实体 | Backend/DBA |
| ROUTE-OPEN-008 | Laya 内部推理用量是否纳入平台成本观测，以及保留周期 | 财务/平台运营 |

## 明确不在本候选中的内容

- 修改 M01 冻结的 `/v1/chat/completions`、`/v1/models`、API Key 或 Usage 行为。
- 由 Laya 执行最终 Chat 生成、调用 Provider、访问数据库或读取供应商凭证。
- 让 Laya 自主返回任意 Provider/Channel、endpoint 或模型凭证引用。
- 自动计费、余额扣减或将 Laya 推理 token 算作企业用量。
- 在 Requirement、Contract、硬件目标和验收阈值未批准前启用生产自动路由。
