# M02 Laya 模型路由决策模块提案 v0.1

状态：PROPOSED / PENDING REVIEW
日期：2026-09-23（Asia/Shanghai）
适用基线：M01 Release Candidate `79fc320492427fc3fbf8c502ecff42621815f14e`

本文是 M02 架构评审材料，不构成已批准 Requirement、Contract 或开发授权。M01 业务代码与 OpenAI-compatible Contract 继续冻结。

## 1. 目标与边界

在 HA AI Gateway 中增加可选的模型路由决策能力。Laya 根据请求内容给出结构化的任务类型、领域、复杂度、风险与推荐路线；HA AI 后端依据项目策略、模型白名单、额度、Provider 可用状态和管理员规则，独立确定最终调用目标。

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

## 3. 请求路由顺序

```text
API Key 验证和项目范围
  → 请求格式与资源限制
  → 显式调用模型 / 管理员强制策略
  → 项目模型白名单和硬性策略
  → Laya 路由建议（策略启用时）
  → HA AI 策略验证候选模型、额度、Provider 状态
  → 确定最终模型并调用 ProviderAdapter
  → 记录 Decision、Routing Attempt、Usage 和响应证据
```

安全优先级：拒绝策略、管理员强制策略和项目白名单优先于 Laya 建议。客户端显式 `model` 字段依照后续批准的项目模式处理：可设为严格模式（必须授权且按指定模型执行），或自动模式（字段代表逻辑模型，仍允许平台选具体模型）。未作出业务决定前，不允许静默改变当前 OpenAI-compatible API 的 `model` 含义。

Laya 推荐结果只能选择项目策略配置的逻辑路线，例如 `fast`、`balanced`、`quality`、`code`、`multilingual`。路由策略将逻辑路线映射到已启用模型集合，不能让 Laya 自由返回 Provider ID、凭证引用、URL 或未授权模型。

## 4. Laya 决策输入与映射

Laya 上游接口使用 `POST /v1/systemone`，请求由 `state` 和 `questions` 组成。其类型包括 `choice`、`score`、`noul`；输出含答案、概率/置信度及 `usage.input_tokens`。Laya Router 自身选择 English、Multilingual 或 Typed Decisions checkpoint；这与 HA AI 选择逻辑模型/Provider 是两个不同层次。

本项目应显式请求 `typed-decisions` 或经验证的决策模型，避免将 Laya checkpoint 的语言路由误当成 HA AI Provider 路由。第一版建议让一个 choice 问题直接输出候选逻辑路线，并以独立 `noul` 问题表示是否需要工具、是否敏感；复杂度可作为解释/规则信号。Laya 的 `router_questions()` 可作为 POC 起点，但其固定 domain 值不等于本项目完整路线策略，生产问题模板须由 HA AI 自己版本化维护。

建议传入的 `state` 只包含完成分类所需的最少信息：用户消息、必要的最近对话片段、请求模型模式和项目允许路线。不得传入 API Key、JWT、上游凭证、完整用户档案或与决策无关的租户数据。敏感字段应在进入 Laya 前按安全规则脱敏。

## 5. 内部决策契约草案

这不是对外 API Contract。建议后端内部使用稳定结果对象：

```json
{
  "decisionId": "uuid",
  "router": "laya",
  "routerVersion": "0.3.7",
  "checkpoint": "typed-decisions",
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

POC 与生产均需固定 Python 基础镜像摘要、Laya 包版本/源码 Commit、模型仓库 revision 和权重摘要。设置下载缓存卷、离线启动策略、非 root 用户、容器资源上限和模型就绪探针。`LAYA_API_KEY` 仅用于 Gateway 到 Laya 的服务认证，与企业发放的 Gateway API Key 分离；服务只暴露于容器内网。

## 8. 与现有仓库设计的对应

仓库总体数据模型已出现路由策略、路由决策、Routing Attempt 和 Usage Evidence 的候选设计；此提案将 Laya 决策映射到这些概念，不替代 Provider/Channel 的静态策略，也不声称已有实现。当前 Backend 的 `OpenAiService` 使用单一 `ProviderAdapter`，`PolicyService` 为内存项目白名单；与本提案的动态策略执行仍有实现差距，应纳入批准后的 M02 任务拆分。

## 9. 评审待决项

| ID | 决策项 | 建议默认值 | 状态 |
| --- | --- | --- | --- |
| LAYA-M02-001 | Laya 是否纳入 M02 Requirement 分母 | 纳入模型路由 POC，生产启用单独 Gate | PENDING |
| LAYA-M02-002 | 客户端显式 `model` 的含义 | 先保持严格指定语义；自动路由使用平台定义的逻辑模型 ID 或独立模式 | PENDING |
| LAYA-M02-003 | 首发决策 checkpoint | 显式 `typed-decisions`，真实数据集验收后再定 | PENDING |
| LAYA-M02-004 | Laya 不可用时的行为 | 只回退到项目配置的已授权默认模型 | PENDING |
| LAYA-M02-005 | 输入、决策和证据保留策略 | 最小化输入、默认不持久化原文 | PENDING |
| LAYA-M02-006 | 计入 M02 数据库和对外 API 的字段 | 先仅记录内部决策与现有 Request/Attempt 关联 | PENDING |
| LAYA-M02-007 | 部署硬件与服务等级 | 通过目标环境压测后确定 | PENDING |

## 10. 验收建议

进入实现前，应先批准 Requirement、对外/内部 Contract、路由白名单语义、输入脱敏规则和失败策略。实现验收至少覆盖：

- 规则优先级、显式模型和管理员 override；任何情况下都不能选中未授权模型。
- Laya 英文/中文/多语言、边界输入、低信心、错误结构和模型未就绪场景。
- Timeout、401、422、5xx、熔断和静态 fallback；记录 request ID、decision ID、policy version 和 fallback reason。
- 租户隔离、最小化输入、日志与证据脱敏、服务间密钥轮换。
- Router 开启/关闭时 Chat Contract 与现有调用链兼容；真实 HTTP 验证使用固定模型权重和可复现部署配置。
- 目标硬件下启动、内存/显存、吞吐、P95/P99 延迟与故障恢复达到批准的 SLO。

## 参考源码

- [Laya 仓库](https://github.com/NandhaKishorM/laya)
- [Agent 推理实现](https://github.com/NandhaKishorM/laya/blob/main/laya/agent.py)
- [模型 Router 实现](https://github.com/NandhaKishorM/laya/blob/main/laya/router.py)
- [HTTP 服务实现](https://github.com/NandhaKishorM/laya/blob/main/laya/serve.py)
- [路由问题模板](https://github.com/NandhaKishorM/laya/blob/main/laya/presets.py)
- [HTTP 服务测试](https://github.com/NandhaKishorM/laya/blob/main/tests/test_serve.py)
