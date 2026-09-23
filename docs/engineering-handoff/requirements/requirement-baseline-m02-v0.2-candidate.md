# M02 Requirement Baseline v0.2 Candidate

状态：DRAFT / SCOPE CONFIRMED; PENDING PRIORITY, ARCHITECTURE AND DELIVERY APPROVAL

日期：2026-09-23（Asia/Shanghai）

主线证据基准：`develop` `c5db6b7dea9867c466f91180d6a81c69acec3559`

上游草案：[M02 Requirement Baseline v0.1 Draft](./requirement-baseline-m02-v0.1-draft.md)

合并对账：[M02 合并后状态对账 v0.1](./m02-post-merge-reconciliation-v0.1.md)

本文把已合并的 M02-A/B 能力整理成需求基线候选，并记录已确认的产品范围决定。`IMPLEMENTED` 只表示代码已在主线，不表示验收完成。本文不授权新的代码、数据库、API Contract 或部署工作；优先级、技术边界、验收责任和正式审批完成前维持 DRAFT。

## 已确认的 M02 范围决定

2026-09-23，用户确认：M02-A/B IAM 与 RBAC 需求进入 M02；用户和角色管理必须提供可用的前端界面；Laya 语义模型路由纳入 M02，但作为独立工作流管理。下表将这些决定落实为需求分母候选。优先级仍待确认；验收条件还需由产品、架构、Backend、Frontend、Integration 与 QA 评审。

| Requirement | 候选需求 | 建议验收条件 | 代码状态 | 优先级 / 决定 |
| --- | --- | --- | --- | --- |
| M02-IAM-001 | 用户认证上下文提供角色与权限码，受保护操作按权限执行；无权限请求被拒绝 | 登录用户信息包含其角色和权限码；权限不足的 API 返回拒绝；权限允许的 API 按已批准数据范围返回 | IMPLEMENTED（M02-A） | SCOPE CONFIRMED；建议 P0 |
| M02-IAM-002 | 平台管理员和企业管理员可按授权范围查询用户；可创建用户并更新 ACTIVE/DISABLED 状态 | 平台管理员可指定有效企业；企业管理员只能操作自身企业；用户列表和写入响应不含 password/hash；无权限、越权、无效状态分别有明确 HTTP 结果 | IMPLEMENTED（M02-B） | SCOPE CONFIRMED；建议 P0 |
| M02-IAM-003 | 管理员可读取可用角色，并在授权范围内管理用户的全局角色绑定 | 角色读取要求 `role:read`；绑定要求 `user:role:manage`；越权绑定与项目角色绕过项目成员关系均被拒绝；绑定结果可由后续用户查询核实 | IMPLEMENTED（M02-B） | SCOPE CONFIRMED；建议 P0 |
| M02-IAM-004 | 项目成员只能读取其成员关系授权的项目；平台管理员和企业管理员遵循各自范围 | 项目成员的项目列表限于 `projectIds`；企业管理员限于本企业；平台管理员可按现有规则读取；跨范围数据不可见 | IMPLEMENTED（M02-A/B） | SCOPE CONFIRMED；建议 P0 |
| M02-IAM-005 | 提供可用的用户与角色管理前端界面，并接通 M02 用户/角色 API | 管理员可在界面完成用户查询、创建、启停、角色查询与现有角色绑定；角色目录为读取/绑定界面，不暗示 M02 后端支持角色 CRUD；界面遵循权限和企业范围；真实浏览器操作与 HTTP 请求/响应通过验收 | NOT IMPLEMENTED / NOT VERIFIED | SCOPE CONFIRMED；建议 P0 |
| M02-LAYA-001 | 以独立工作流把 Laya 语义模型路由作为 M02 能力进行评估和集成 | 按独立候选文档完成目标与边界、路由决策/API、数据隐私、失败降级、评估指标、运行目标、审计与发布/回滚验收 | PROPOSAL ONLY | SCOPE CONFIRMED；建议 P1，生产启用另设 Gate |

上述 P0/P1 是供审批的建议，不是已批准优先级。IAM 和 UI 构成同一管理能力的完整交付路径；Laya 仍需先独立评审与评估，生产自动路由另设 Gate。

### 候选接口清单（以主线实现为事实）

- `GET /api/auth/users`：读取当前操作者范围内用户。
- `POST /api/auth/users`：创建用户，成功返回 `201`。
- `POST /api/auth/users/{userId}/status`：设置 `ACTIVE` 或 `DISABLED`。
- `GET /api/auth/roles`：读取角色。
- `PUT /api/auth/users/{userId}/roles`：替换用户的全局角色绑定。
- 项目列表读取由现有 Project API 提供，并按操作者角色及 `projectIds` 过滤。

当前创建用户字段为 `username`、`password`（12–128 字符）、`displayName`、可选 `enterpriseId` 和 `roleCodes`；平台管理员创建时必须提供有效企业，企业管理员只能创建到自身企业。状态更新请求为 `{"status":"ACTIVE"|"DISABLED"}`；角色绑定请求为 `{"roleCodes":[...]}` 且语义是替换全量全局绑定，空列表当前不合法。现有 M02 API 只读角色目录并绑定角色，不提供角色 CRUD。

上述路由和字段是代码核对结果，不是已批准的外部 API Contract。Contract 文件 [m02-api-contract-v0.2.md](../../../contracts/m02-api-contract-v0.2.md) 目前列出 `/api/users`、`/api/roles`、`/api/permissions` 等路径，与主线 Controller 的 `/api/auth/...` 实际路由不一致。开始前端对接前必须统一规范路径、字段、响应 envelope、状态码、分页/检索、权限失败与角色绑定替换语义，并明确这是文档过时还是需要修改 API。

## Contract、安全与数据迁移 Gate

- **Contract 对齐**：实际 Controller 与 `contracts/m02-api-contract-v0.2.md` 路由不一致；先确定 canonical contract，再实现页面，避免前后端各按不同路径交付。
- **授权失败关闭**：当前 `AuthzService.requirePermission` 和项目列表权限检查在 `permissions` mapper 为 `null` 时直接返回。需由架构/安全评审确认生产配置绝不可能缺失该依赖，并补充启动失败或 fail-closed 验证；不得把静默放行作为 M02 的验收结果。
- **角色可分配性**：`GET /api/auth/roles` 当前返回全部角色，而企业管理员绑定规则只允许 `enterprise-admin`。Contract/UI 需明确是否返回可分配过滤结果或增加可分配标记，并验证越权绑定被拒绝。
- **管理不变量**：确认是否禁止管理员停用自己或最后一个有效平台管理员；当前候选代码未体现这些保护。确认是否要求用户操作审计、检索/分页，或将其明确排除在 M02 管理界面的最小范围之外。
- **迁移与持久化**：必须在合并 SHA 对应源码上验证干净安装和升级路径、V4 权限种子幂等、真实 MySQL HTTP 的授权/跨企业/状态/绑定/密码散列不泄露。当前 `mvn clean package` 中 Spring 测试排除了真实 DataSource/Flyway；PR #46 真实 MySQL 记录没有在合并 SHA 上重跑。

## 独立工作流与其他待决项

- Laya 已纳入 M02，但以 M02-LAYA-001 独立工作流评审和交付，不与 IAM/RBAC 共用验收或发布假设。细分 Requirement 与架构提案见 [Laya 模型路由独立需求草案](./laya/m02-laya-routing-requirements-v0.1-draft.md) 和 [Laya 架构提案](./laya/m02-laya-routing-architecture-v0.2-proposal.md)；文档的适用基线已对齐到本 v0.2 候选。
- 注册、密码重置、Token Refresh、企业切换、多因素认证、外部 IdP、Billing、Provider 扩展、生产 SLA 与部署能力仍沿用 v0.1 的候选状态，不因 M02-A/B 合并而自动纳入。
- 前端虽存在通用系统用户/角色页面文件，但尚无证据证明这些页面已接通 M02 API 或完成真实浏览器验收，因此 M02-IAM-005 是明确范围要求、实现与验收仍未完成。

## 审批与验收门槛

本候选转为 APPROVED 前，负责人须在 PR 或基线审批记录中逐项确认：

1. 将用户已确认范围固化为正式 Requirement 分母；确认本文件建议的 IAM/UI P0、Laya P1 优先级及责任人，或记录替代决定。
2. 表中验收条件是否满足业务预期，尤其是平台级/企业级角色范围、项目角色绑定边界和数据隔离。
3. API Contract、数据迁移与兼容性是否接受；当前证据只验证合并代码和已有测试，不代替重新签署 Contract。
4. 每项验收的责任人、测试环境、HTTP/浏览器证据、审计要求、发布及回滚责任人。
5. 其余 v0.1 候选主题逐项纳入、延期或排除，不能默认为已批准。

### 可追踪验收与当前证据状态

| Requirement | 可验收结果 | 已有证据 | 尚缺证据 / Gate |
| --- | --- | --- | --- |
| M02-IAM-001 | 登录后的用户信息含角色和权限码；授权请求通过、未授权请求拒绝；企业/平台范围正确 | `AuthHttpTest`、`AuthzServiceTest`、主线 Maven 构建通过 | 使用真实持久化数据和真实 HTTP 覆盖关键角色矩阵；给出权限种子部署验证 |
| M02-IAM-002 | 列表、创建、启停 API 的 200/201、401/403/400/404/409 语义稳定；越权企业数据不可见；响应无凭证散列 | `UserRoleManagementHttpTest` 覆盖 mock service 的列表、创建、401、403；`UserRoleManagementServiceTest` 覆盖部分企业范围和密码字段映射 | HTTP 测试尚未覆盖全部端点；生产式 HTTP + MySQL 正向/负向验收及响应字段扫描 |
| M02-IAM-003 | 角色读取与角色绑定 API 按 permission code 授权；企业管理员不能绑定平台/项目角色；绑定可读回 | `UserRoleManagementServiceTest` 部分验证角色限制 | `GET /api/auth/roles` 与 `PUT /api/auth/users/{userId}/roles` 的端到端 HTTP、持久化和读回验证 |
| M02-IAM-004 | `/api/projects` 对成员按 `projectIds` 过滤，对企业管理员按企业过滤，对平台管理员按平台范围读取 | `ProjectHttpTest` 查询条件断言；PR #46 记录真实 MySQL Mapper HTTP 1/1 | 在合并提交上重跑真实 MySQL HTTP，并附请求/响应、数据库夹具和 Request ID |
| M02-IAM-005 | 经授权管理员可打开用户和角色页面；页面分别读取 `GET /api/auth/users`、`GET /api/auth/roles`；创建、状态变更和绑定分别调用已批准的 M02 API，刷新后显示持久结果；401/403 不产生假成功 | 仓库有通用用户/角色页面文件 | 当前页面调用 `/system/user/*`、`/system/role/*` 等传统端点；没有适配 M02 API 的前端代码。页面还含组织/岗位、角色 CRUD 等超出当前 M02 API 的旧能力；需缩到已批准 M02 功能或另行批准后端范围，再提供真实浏览器 Network、Request ID 和截图证据。浏览器角色目录只读，现有角色绑定，不包含角色 CRUD |
| M02-LAYA-001 | 经批准的显式自动路由模式只从项目允许模型中选择；拒绝越权输出；故障/低信心遵循项目默认值或批准错误；可追溯且不泄露敏感输入 | 仅有需求和架构提案 | 产品/架构/隐私/QA 批准 Contract、样本与阈值、时延/资源目标及降级语义后，单独实现和测试；生产启用另设 Gate |

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
