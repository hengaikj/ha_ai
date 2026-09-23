# M02 Requirement Baseline v0.2 Candidate

状态：DRAFT / PENDING PRODUCT, ARCHITECTURE AND DELIVERY APPROVAL

日期：2026-09-23（Asia/Shanghai）

主线证据基准：`develop` `c5db6b7dea9867c466f91180d6a81c69acec3559`

上游草案：[M02 Requirement Baseline v0.1 Draft](./requirement-baseline-m02-v0.1-draft.md)

合并对账：[M02 合并后状态对账 v0.1](./m02-post-merge-reconciliation-v0.1.md)

本文把已合并的 M02-A/B 能力整理成需求基线候选，并记录已确认的产品范围决定。`IMPLEMENTED` 只表示代码已在主线，不表示验收完成。本文不授权新的代码、数据库、API Contract 或部署工作；优先级、技术边界、验收责任和正式审批完成前维持 DRAFT。

## 已确认的 M02 范围决定

2026-09-23，用户确认：M02-A/B IAM 与 RBAC 需求进入 M02；用户和角色管理必须提供可用的前端界面；Laya 语义模型路由纳入 M02，但作为独立工作流管理。下表将这些决定落实为需求分母候选。优先级仍待确认；验收条件还需由产品、架构、Backend、Frontend、Integration 与 QA 评审。

| Requirement | 候选需求 | 建议验收条件 | 代码状态 | 优先级 / 决定 |
| --- | --- | --- | --- | --- |
| M02-IAM-001 | 用户认证上下文提供角色与权限码，受保护操作按权限执行；无权限请求被拒绝 | 登录用户信息包含其角色和权限码；权限不足的 API 返回拒绝；权限允许的 API 按已批准数据范围返回 | IMPLEMENTED（M02-A） | SCOPE CONFIRMED；优先级待定 |
| M02-IAM-002 | 平台管理员和企业管理员可按授权范围查询用户；可创建用户并更新 ACTIVE/DISABLED 状态 | 平台管理员可指定有效企业；企业管理员只能操作自身企业；用户列表和写入响应不含 password/hash；无权限、越权、无效状态分别有明确 HTTP 结果 | IMPLEMENTED（M02-B） | SCOPE CONFIRMED；优先级待定 |
| M02-IAM-003 | 管理员可读取可用角色，并在授权范围内管理用户的全局角色绑定 | 角色读取要求 `role:read`；绑定要求 `user:role:manage`；越权绑定与项目角色绕过项目成员关系均被拒绝；绑定结果可由后续用户查询核实 | IMPLEMENTED（M02-B） | SCOPE CONFIRMED；优先级待定 |
| M02-IAM-004 | 项目成员只能读取其成员关系授权的项目；平台管理员和企业管理员遵循各自范围 | 项目成员的项目列表限于 `projectIds`；企业管理员限于本企业；平台管理员可按现有规则读取；跨范围数据不可见 | IMPLEMENTED（M02-A/B） | SCOPE CONFIRMED；优先级待定 |
| M02-IAM-005 | 提供可用的用户与角色管理前端界面，并接通 M02 用户/角色 API | 管理员可在界面完成用户查询、创建、启停、角色查询与绑定；界面遵循权限和企业范围；真实浏览器操作与 HTTP 请求/响应通过验收 | NOT IMPLEMENTED / NOT VERIFIED | SCOPE CONFIRMED；优先级待定 |
| M02-LAYA-001 | 以独立工作流把 Laya 语义模型路由作为 M02 能力进行评估和集成 | 按独立候选文档完成目标与边界、路由决策/API、数据隐私、失败降级、评估指标、运行目标、审计与发布/回滚验收 | PROPOSAL ONLY | SCOPE CONFIRMED；技术验收与优先级待定 |

### 候选接口清单（以主线实现为事实）

- `GET /api/auth/users`：读取当前操作者范围内用户。
- `POST /api/auth/users`：创建用户，成功返回 `201`。
- `POST /api/auth/users/{userId}/status`：设置 `ACTIVE` 或 `DISABLED`。
- `GET /api/auth/roles`：读取角色。
- `PUT /api/auth/users/{userId}/roles`：替换用户的全局角色绑定。
- 项目列表读取由现有 Project API 提供，并按操作者角色及 `projectIds` 过滤。

上述接口是代码核对结果，不是对外部 API Contract 的批准。若需求批准需要调整路径、字段、状态码或兼容规则，须先走 Contract 评审。

## 独立工作流与其他待决项

- Laya 已纳入 M02，但以 M02-LAYA-001 独立工作流评审和交付，不与 IAM/RBAC 共用验收或发布假设。细分 Requirement 与架构提案见 [Laya 模型路由独立需求草案](./laya/m02-laya-routing-requirements-v0.1-draft.md) 和 [Laya 架构提案](./laya/m02-laya-routing-architecture-v0.2-proposal.md)；文档的适用基线已对齐到本 v0.2 候选。
- 注册、密码重置、Token Refresh、企业切换、多因素认证、外部 IdP、Billing、Provider 扩展、生产 SLA 与部署能力仍沿用 v0.1 的候选状态，不因 M02-A/B 合并而自动纳入。
- 前端虽存在通用系统用户/角色页面文件，但尚无证据证明这些页面已接通 M02 API 或完成真实浏览器验收，因此 M02-IAM-005 是明确范围要求、实现与验收仍未完成。

## 审批与验收门槛

本候选转为 APPROVED 前，负责人须在 PR 或基线审批记录中逐项确认：

1. 将用户已确认的 M02-IAM-001 至 005 及独立工作流 M02-LAYA-001 纳入正式 Requirement 分母；负责人给出 P0/P1 优先级和责任人。
2. 表中验收条件是否满足业务预期，尤其是平台级/企业级角色范围、项目角色绑定边界和数据隔离。
3. API Contract、数据迁移与兼容性是否接受；当前证据只验证合并代码和已有测试，不代替重新签署 Contract。
4. 每项验收的责任人、测试环境、HTTP/浏览器证据、审计要求、发布及回滚责任人。
5. 其余 v0.1 候选主题逐项纳入、延期或排除，不能默认为已批准。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| PR #45 和 PR #46 合并至 `develop`；主线全量构建 76 tests、0 failures、0 errors、3 skipped | IAM/RBAC 与用户/角色管理能力是已交付代码事实；需求批准仍待完成 | [PR #45](https://github.com/hengaikj/ha_ai/pull/45)、[PR #46](https://github.com/hengaikj/ha_ai/pull/46)、[合并后状态对账](./m02-post-merge-reconciliation-v0.1.md) |
| `UserRoleManagementController` 和 `UserRoleManagementService` | 用户、角色接口、权限门禁、企业范围、状态限制及无密码字段摘要已实现 | `backend/src/main/java/com/hengaikj/ai/auth/controller/UserRoleManagementController.java`、`backend/src/main/java/com/hengaikj/ai/auth/service/UserRoleManagementService.java` |
| `ProjectService.list` 按角色及 `projectIds` 生成项目查询范围 | 项目可见范围已在服务层实施 | `backend/src/main/java/com/hengaikj/ai/project/ProjectService.java` |
| 后端 `mvn clean package` 与前端类型检查、构建记录 | 合并主线构建通过；真实 MySQL HTTP 测试未在合并提交重跑，浏览器端到端未运行 | [合并后状态对账](./m02-post-merge-reconciliation-v0.1.md#主线验证证据) |
| 前端有系统用户/角色页面文件，但缺少 M02 真实联调证据 | 已确认必须交付管理界面；页面是否连通新接口及真实浏览器验收仍未证明 | `frontend/src/pages/system/SystemUserPage.vue`、`SystemRolePage.vue`；禁止据此宣称 M02 前端验收通过 |

## 变更记录

| 版本 | 说明 |
| --- | --- |
| v0.2 candidate | 记录 IAM/RBAC 入围、管理 UI 必须交付、Laya 独立纳入 M02 的范围决定；保留优先级、技术验收和正式审批为待决项 |
