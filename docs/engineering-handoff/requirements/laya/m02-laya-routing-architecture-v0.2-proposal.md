# M02 Laya 模型路由决策模块提案 v0.2

状态：PROPOSED / PENDING REVIEW
日期：2026-09-23（Asia/Shanghai）
适用基线：M01 Release Candidate `79fc320492427fc3fbf8c502ecff42621815f14e`

M02 范围：产品已确认 Laya 路由纳入 M02 独立工作流（M02-LAYA-001）；本架构提案仍待技术评审，不构成实现授权。M01 API Contract 与代码冻结继续有效。

本文是 M02 架构评审材料，不构成已批准 Requirement、Contract 或开发授权。M01 业务代码与 OpenAI-compatible Contract 继续冻结。

## 1. 目标与边界

在 HA AI Gateway 中增加可选的语义模型路由能力。Laya 根据请求内容给出结构化的任务类型、领域、复杂度、风险与推荐路线；HA AI 后端依据项目策略、模型白名单、额度、Provider 可用状态和管理员规则，独立确定最终逻辑模型与实际调用渠道。

Laya 只提供决策信号，不调用最终生成模型，不持有企业 Provider 凭证，不直接访问项目数据库，也不负责授权、限流、计费或最终 Provider 选择。当前 M01 的 `/v1/chat/completions`、`/v1/models`、API Key 和 Usage Contract 不变。

## 2. 代码与运行边界

建议采用单仓多模块目录并独立进程运行：

```text
backend/                         # Spring Boot Gateway 与最终策略执行
modules/laya-router/             # Python HTTP 适配层与 Laya SDK 依赖
deploy/docker/                   # 可选的 laya-router 服务定义
```

`modules/laya-router` 通过固定版本的 PyPI 包或锁定的上游 Git Commit 引用 Laya，不复制其源码。M02 POC 阶段优先使用上游 `laya-serve`；如需项目专用输入校验、响应裁剪或健康检查，再在本仓 Python 模块中包装其 `Router`。模型权重使用独立缓存卷，版本或摘要必须固定并记录。

Spring Boot 通过内网 HTTP 调用 Python 模块；不将 PyTorch 嵌入 JVM，也不使用 `ProcessBuilder` 管理 Python 生命周期。Compose 中的 Laya 服务默认关闭或仅在独立 profile 启动，不自动改变现有 M01 服务、端口、数据卷或启动顺序。

## 3. 两阶段请求路由

当前总体数据模型中的路由策略针对一个 `logical_model_id` 配置候选 Channel，再由策略决定优先级、权重或故障转移；它解决的是“这个逻辑模型走哪个 Provider/Channel”。Laya 的位置应在此前，解决“这个请求适合哪个逻辑模型/路线”。两者不能合并成一个模型决策，也不能让 Laya 返回 Provider、Channel 或 Credential。

```text
阶段 A：语义模型选择
用户请求 + 项目允许的逻辑模型候选
  → Laya 给出候选 route / logical_model_id 建议
  → HA AI Policy 验证并确定 logical_model_id

阶段 B：Provider/Channel 选择
确定的 logical_model_id
  → 现有路由策略选择候选 Channel
  → Provider 健康、权限、额度、权重/优先级检查
  → ProviderAdapter 发起上游调用
```

阶段 A 是新增能力；阶段 B 复用现有路由策略设计。若产品只需要在同一逻辑模型下切换 Provider，Laya 没有必要加入该链路。

### 请求顺序

```text
API Key 验证和项目范围
  → 请求格式与资源限制
  → 拒绝规则、管理员强制策略和项目允许模型集合
  → 客户端显式模型处理或 Laya 建议（仅自动路由模式）
  → HA AI Policy 将允许的 route 映射到 logical_model_id
  → 额度、Provider 状态与现有 Channel 路由策略
  → ProviderAdapter 发起上游调用
  → 记录 Decision、Routing Attempt、Usage 和响应证据
```

安全优先级：拒绝规则、管理员强制策略和项目白名单优先于 Laya 建议。当前 OpenAI-compatible Contract 中 `model` 表示调用方指定的模型。不得静默改变其含义。自动路由需要独立、明确的调用模式或已批准的逻辑模型别名；该模式及字段需要先进入 Contract 评审。严格模式继续校验并执行显式模型。

Laya 推荐结果只能从 HA AI 提供给它的候选逻辑模型集合中选择。HA AI 的配置将逻辑路线（如 `fast`、`balanced`、`quality`、`code`、`multilingual`）映射到项目允许的 `logical_model_id`。后端必须校验模型处于启用状态、项目有权使用、额度规则允许，并且至少存在可用 Channel；不能信任 Laya 返回的自由文本或任意模型名。

## 4. Laya 决策输入与映射

Laya 上游接口使用 `POST /v1/systemone`，请求由 `state` 和 `questions` 组成。其类型包括 `choice`、`score`、`noul`；输出含答案、概率/置信度及 `usage.input_tokens`。Laya Router 自身选择 English、Multilingual 或 Typed Decisions checkpoint；这与 HA AI 选择逻辑模型/Provider 是两个不同层次。

Laya 的 `typed-decisions` checkpoint 由上游针对有限的预设流程训练，不能未经评估就作为通用模型路由 checkpoint。其 Router 对 English、Multilingual 和 Typed Decisions 的 checkpoint 选择，与 HA AI 的逻辑模型选择是不同的过程。POC 应用中文及中英混合样本，分别验证 multilingual 与 typed-decisions（以及适用时 English）checkpoint 的表现后再决定；推荐默认从 multilingual checkpoint 开始评估，不预先承诺 typed-decisions。

第一版问题模板可让一个 `choice` 问题在本次请求允许的路线中选择；用 `score` 和 `noul` 问题提供复杂度、工具需求或敏感度信号。路由策略可组合这些信号，但硬限制仍由确定性 HA AI 规则执行。`router_questions()` 可供模板设计参考，其中固定的 `domain` 值不等于 HA AI 的模型路线集合，模板需由 HA AI 自己版本化。

建议传入的 `state` 只包含完成分类所需的最少信息：用户消息、必要的最近对话片段、已脱敏的请求特征和候选逻辑路线。项目允许模型由后端校验后生成候选集合，不传用户身份、API Key、JWT、上游凭证、完整用户档案或无关租户数据。是否允许将用户提示发送到本地模型服务、日志保留期限和敏感字段脱敏规则需由安全/隐私评审确认。

## 5. 内部决策契约草案

这不是对外 API Contract。建议后端内部使用稳定结果对象：

```json
{
  "decisionId": "uuid",
  "router": "laya",
  "routerVersion": "0.3.7",
  "checkpoint": "multilingual",
  "policyVersion": "project-policy-version",
  "route": "quality",
  "confidence": 0.91,
  "reasonCode": "HIGH_COMPLEXITY",
  "fallback": false
}
```

客户端响应不暴露原始路由 prompt、完整分类概率、内部策略表达式、Provider 凭证信息或敏感决策文本。是否向调用方返回逻辑模型名仍由兼容 Contract 决定。审计记录应限制保存原始输入；默认保存 request ID、决策类别、版本、信心区间、最终模型和降级原因。

## 6. 策略执行、失败与降级

`RoutingDecisionService` 负责调用决策器；`RoutingPolicyService` 对建议进行白名单和硬规则校验；`ProviderSelector` 只接受经过校验的路线。Laya 超时、不可达、鉴权失败、格式错误、模型未就绪或低置信度时，执行项目已配置的静态默认路线；若无可用候选则按现有 Gateway 错误 Contract 失败关闭，不得调用未授权模型。

自动降级必须有最大等待时间、并发/熔断控制和明确的 fallback 标记，不能因 Laya 故障无限延迟 Chat 请求。对同一输入可选地使用缓存，但必须将项目、策略版本、路由模板版本、模型模式纳入缓存键；不得跨租户复用带敏感上下文的决策结果。人工 override 和模型白名单始终优先于缓存与模型建议。

## 7. 资源、部署与供应链

Laya 依赖 Python、PyTorch、Transformers、Safetensors、Hugging Face Hub，且需下载模型权重。官方资料声明 Python `>=3.10`，PyPI 当前源码版本标记为 `0.3.7`；性能数据是上游特定硬件基准，不能直接作为本项目 SLA。上线前需在目标 CPU/GPU、并发和中文工作负载上测量启动时间、内存/显存、吞吐、尾延迟和错误率。

POC 与生产均需固定 Python 基础镜像摘要、Laya 包版本/源码 Commit、模型仓库 revision 和权重摘要。设置下载缓存卷、离线启动策略、非 root 用户、容器资源上限和模型就绪探针。`LAYA_API_KEY` 仅用于 Gateway 到 Laya 的服务认证，与企业发放的 Gateway API Key 分离；服务只暴露于容器内网。Laya 决策的 `usage.input_tokens` 是路由器资源用量，不得直接计入企业 Chat 账单；是否作为平台内部成本指标记录另行定义。

## 8. 与现有仓库设计的对应

仓库总体数据模型已出现逻辑模型/Channel 映射、每逻辑模型的路由策略、路由决策、Routing Attempt 和 Usage Evidence 的候选设计。现有 `ha_ai_routing_decision` 主要记录所选 Channel；若需审计语义模型决策，还需评估扩展决策记录（如模式、候选逻辑模型、选中逻辑模型、router/template 版本、回退原因），并由 Contract/数据库评审决定，不可直接把 Laya 决策塞入现有字段。当前 Backend 的 `OpenAiService` 使用单一 `ProviderAdapter`，`PolicyService` 为内存项目白名单；与本提案的两阶段路由仍有实现差距，应纳入批准后的 M02 任务拆分。

## 9. 评审待决项

| ID | 决策项 | 建议默认值 | 状态 |
| --- | --- | --- | --- |
| LAYA-M02-001 | M02 范围已确认纳入独立工作流；确认优先级、POC 范围以及生产启用 Gate | 纳入 M02 独立工作流；生产启用另设 Gate | SCOPE CONFIRMED / DETAILS PENDING |
| LAYA-M02-002 | 自动路由 API 模式 | 新增显式 auto 模式/逻辑别名；保持现有 `model` 严格语义 | PENDING |
| LAYA-M02-003 | 首发 Laya checkpoint | 对中文/混合语料评估 multilingual 与 typed-decisions 后选择 | PENDING |
| LAYA-M02-004 | 路由候选的粒度 | HA AI 逻辑模型集合；Provider/Channel 由现有阶段 B 选择 | PENDING |
| LAYA-M02-005 | Laya 不可用或低信心时行为 | 仅回退至项目配置且已授权的默认逻辑模型 | PENDING |
| LAYA-M02-006 | 决策审计与持久化字段 | 评估扩展决策记录；不保存原始提示默认值 | PENDING |
| LAYA-M02-007 | 输入隐私和处理边界 | 发送最少必要、已脱敏文本；确认数据处理政策 | PENDING |
| LAYA-M02-008 | Laya Usage 归属 | 作为平台内部路由成本指标，不计入企业 Chat Usage，待确认 | PENDING |
| LAYA-M02-009 | 部署硬件与服务等级 | 通过目标环境压测后确定 | PENDING |

## 10. 验收建议

进入实现前，应先批准 Requirement、对外/内部 Contract、路由白名单语义、输入脱敏规则和失败策略。实现验收至少覆盖：

- 语义模型选择与 Provider/Channel 选择分阶段验证；规则优先级、显式模型和管理员 override 均符合批准 Contract，不能选中未授权模型。
- Laya 英文、中文和中英混合样本；checkpoint 对比、边界输入、低信心、错误结构和模型未就绪场景。
- Timeout、401、422、5xx、熔断和静态 fallback；记录 request ID、decision ID、policy version 和 fallback reason。
- 租户隔离、最小化输入、日志与证据脱敏、服务间密钥轮换。
- Router 开启/关闭时 Chat Contract 与现有调用链兼容；严格模型模式保持现有语义，auto 模式有独立 Contract；真实 HTTP 验证使用固定模型权重和可复现部署配置。
- 目标硬件下启动、内存/显存、吞吐、P95/P99 延迟与故障恢复达到批准的 SLO。

## 参考源码

- [Laya 仓库](https://github.com/NandhaKishorM/laya)
- [Agent 推理实现](https://github.com/NandhaKishorM/laya/blob/main/laya/agent.py)
- [模型 Router 实现](https://github.com/NandhaKishorM/laya/blob/main/laya/router.py)
- [HTTP 服务实现](https://github.com/NandhaKishorM/laya/blob/main/laya/serve.py)
- [路由问题模板](https://github.com/NandhaKishorM/laya/blob/main/laya/presets.py)
- [HTTP 服务测试](https://github.com/NandhaKishorM/laya/blob/main/tests/test_serve.py)
