# M02 Laya 模型路由架构审查记录 v0.1

状态：REVIEW RECORD / PENDING BASELINE AND CONTRACT APPROVAL
日期：2026-09-24（Asia/Shanghai）
审查基线：`develop` `4c129ee68c222b0e5cdcfd571dc753437c491148`
关联提案：[M02 Laya 模型路由决策模块提案 v0.2](./m02-laya-routing-architecture-v0.2-proposal.md)

本文是架构审查记录，不是 Requirement、API Contract、数据库迁移或开发授权。M02 Baseline 仍为 DRAFT；在审批完成前不得实现 Laya 服务、修改 `/v1/**`、扩展 Provider 路由或新增生产部署配置。

## 决策摘要

建议把 Laya 保持为独立的 M02-P1 评估工作流，采用“语义建议 → HA AI 确定性策略校验 → 现有逻辑模型/Provider 路由”的两阶段边界。第一阶段只做可关闭、默认关闭的 POC；现有显式 `model` 语义、API Key、Usage 和 Provider/Channel Contract 保持不变。

当前没有足够的批准输入进入实现。以下五项是阻塞 POC 的架构决策：自动路由调用模式、候选逻辑模型来源、低置信度/故障行为、输入隐私与保留、审计和资源目标。

## 受影响边界

| 区域 | 影响 | 当前结论 |
| --- | --- | --- |
| Gateway Chat | 可能在请求格式校验后增加语义决策步骤 | 不得改变现有显式 `model` 语义；自动路由需独立模式或逻辑别名 |
| Project Policy | 决定可供 Laya 选择的候选逻辑模型 | 候选集必须由后端按项目/企业权限生成，不能信任 Laya 自由文本 |
| Provider/Channel Routing | 执行最终逻辑模型到 Provider/Channel 的选择 | 继续作为第二阶段；Laya 不返回 Provider、Channel 或凭证 |
| Usage/Audit | 记录决策和回退原因 | 至少记录 request ID、decision ID、策略/路由器版本和 fallback reason；默认不保存原始提示 |
| Deploy/Supply Chain | Python、模型权重和服务间认证 | POC 独立 profile、默认关闭；版本、镜像和模型 revision 必须可复现 |

## 关键风险与必须决策

### 1. 对外 Contract 语义

现有 OpenAI-compatible 请求中的 `model` 是调用方显式指定的模型。若静默把它改成“路线”或“自动选择”，会破坏 M01 Contract。必须在 Contract 审批中二选一：

- 增加明确的自动路由模式/字段，并规定与 `model` 的互斥和优先级；或
- 定义已批准的逻辑模型别名，并明确调用方看到的模型语义和响应行为。

未完成前只允许保留现有严格模型模式。

### 2. 租户、权限和候选白名单

后端先完成 API Key、项目范围、管理员强制策略、模型白名单和额度校验，再生成候选逻辑模型集合。Laya 只能从候选集合选择；后端必须再次校验模型启用状态、项目授权、额度和可用 Channel。缓存键至少包含企业/项目、策略版本、模板版本和模式，禁止跨租户复用带敏感上下文的结果。

### 3. 失败、低置信度和超时

以下情况必须有批准的确定性行为：超时、服务不可达、401/422/5xx、格式错误、模型未就绪、低置信度、无可用候选。建议默认：仅回退到项目已授权的静态默认逻辑模型；没有默认或候选时失败关闭，返回现有 Gateway 错误 Contract。必须设最大等待时间、并发上限、熔断和明确的 fallback 标记。

### 4. 隐私与日志

发送给 Laya 的输入只包含分类必需且已脱敏的文本/特征，不得包含 API Key、JWT、Provider 凭证、完整用户档案或无关租户数据。安全/隐私审批需决定是否允许提示文本离开 JVM、保留期限、脱敏规则和删除路径。默认日志只保存分类结果和版本元数据，不保存原始提示、完整概率向量或内部策略表达式。

### 5. 供应链与运行目标

Laya 适配器、Python 基础镜像、模型权重和上游 revision 必须固定并记录摘要。服务使用独立内网认证，与企业 API Key 分离；容器采用非 root、资源上限、就绪探针和离线启动策略。POC 必须在目标 CPU/GPU 和中文/混合输入上测量启动时间、内存/显存、吞吐、P95/P99、错误率和恢复时间，不能直接引用上游基准作为本项目 SLO。

## 推荐最小 POC 形态

1. 新增独立的内部 `SemanticRouter` 适配器接口，不改现有 ProviderAdapter 和 M01 `/v1/**` Contract。
2. 仅在显式批准的内部自动路由模式下调用；配置默认关闭，未开启时完全绕过 Laya。
3. 后端生成有限候选路线，验证 Laya 输出后再交给现有策略和 Provider/Channel 路由。
4. 对 Laya 超时、错误和低置信度执行确定性 fallback；每次决策产生可追踪 ID，但不记录原始提示。
5. POC 仅使用固定样本和脱敏数据，提供开关、回滚和不影响现有 M01 流量的独立运行 profile。

## 验收矩阵（进入实现前必须固化）

| 类别 | 必须覆盖 |
| --- | --- |
| Contract | 显式模型、自动模式/别名、互斥规则、响应模型和错误码 |
| 权限 | 企业/项目隔离、模型白名单、管理员 override、未授权模型拒绝 |
| 可靠性 | timeout、401、422、5xx、熔断、低置信度、无默认路线 |
| 隐私 | 输入最小化、脱敏、日志扫描、服务间密钥隔离和轮换 |
| 质量 | 中文、英文、中英混合、边界输入、准确率/错误路由率/校准阈值 |
| 运行 | 启停、资源、P95/P99、故障恢复、关闭开关后的 M01 回归 |
| 供应链 | 依赖锁定、模型 revision/摘要、镜像摘要、离线启动 |

## 审批门槛与后续动作

在 Product、Architecture/Security、Contract、Backend、Frontend、Integration、QA 完成 Baseline/POC 评审前：

- 不创建 Laya 生产模块、数据库表、对外 API 或 Docker Compose 默认服务；
- 不改变 M01 `/v1/**`、API Key、Usage 或 Provider Contract；
- 不把本审查记录当作 POC 开发授权。

批准后再拆分独立 feature 分支和 PR，并要求真实 HTTP、故障注入、隐私扫描、资源测量和可回滚证据。

## 上游仓库快照与新增评估风险（2026-09-24）

本节依据上游 [Laya GitHub 仓库](https://github.com/NandhaKishorM/laya) 当前 README 的公开信息整理，只用于风险评估，不锁定本项目依赖版本。

- 上游当前文档同时提供 `laya`、`laya-multilingual` 和 `laya-typed-decisions` 三类 checkpoint，并由 `Router` 按请求选择；HA AI 仍必须把候选逻辑模型和最终授权放在后端策略层。
- `Router` 首次使用会下载 checkpoint；服务部署必须预下载或提供可审计的模型缓存/离线启动方案，不能让生产首请求隐式联网下载。
- 上游文档提示长文本需要显式设置 `max_len`，并给出不同输入长度的准确率变化；POC 必须在 HA AI 的中文、英文和混合语料上重新测量，不能直接采用上游基准。
- 上游公开结果显示英文 checkpoint 在非拉丁文本上可能出现高置信度错误；因此不能用 confidence 单项作为安全兜底，必须先做脚本/语言覆盖验证并设置确定性白名单和回退。
- `max_loaded`、预加载和多 checkpoint 切换会改变内存占用与重载延迟；资源预算、并发、P95/P99 和冷启动行为必须作为 POC Gate，而不是部署后再观察。
- 上游安装要求 Python 3.10+，并提供 HTTP server 可选依赖；本项目若采用独立服务，必须固定 Python、包版本、镜像摘要、模型 revision 和权重摘要，并单独执行供应链审查。

这些事实强化了现有结论：Laya 只能作为默认关闭、可回滚的独立 POC；在 Contract、隐私、质量阈值、资源 SLO 和发布 Gate 获批前，不得进入 Backend/Frontend 代码或 Compose 默认服务。
