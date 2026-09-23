# M02 Requirement Baseline v0.2 Candidate

状态：DRAFT / PENDING PRODUCT, ARCHITECTURE AND DELIVERY APPROVAL

日期：2026-09-23（Asia/Shanghai）

主线证据基准：`develop` `c5db6b7dea9867c466f91180d6a81c69acec3559`

上游草案：[M02 Requirement Baseline v0.1 Draft](./requirement-baseline-m02-v0.1-draft.md)

合并对账：[M02 合并后状态对账 v0.1](./m02-post-merge-reconciliation-v0.1.md)

本文把已合并的 M02-A/B 能力整理成可审议的需求候选，并明确仍缺的产品决定。`IMPLEMENTED` 只表示代码已在主线，不表示需求已获批准或验收完成。本文不授权新的代码、数据库、API Contract 或部署工作；批准记录完成前维持 DRAFT。

## 建议的候选范围

建议将已交付的访问控制与基础用户管理作为 M02 核心需求候选进入评审。每项优先级仍由产品负责人确认；下表的验收条件是供批准时采用的建议，需由产品、架构、Backend、Frontend、Integration 与 QA 确认。

| Requirement | 候选需求 | 建议验收条件 | 代码状态 | 优先级 / 决定 |
| --- | --- | --- | --- | --- |
| M02-IAM-001 | 用户认证上下文提供角色与权限码，受保护操作按权限执行；无权限请求被拒绝 | 登录用户信息包含其角色和权限码；权限不足的 API 返回拒绝；权限允许的 API 按已批准数据范围返回 | IMPLEMENTED（M02-A） | PENDING PRODUCT |
| M02-IAM-002 | 平台管理员和企业管理员可按授权范围查询用户；可创建用户并更新 ACTIVE/DISABLED 状态 | 平台管理员可指定有效企业；企业管理员只能操作自身企业；用户列表和写入响应不含 password/hash；无权限、越权、无效状态分别有明确 HTTP 结果 | IMPLEMENTED（M02-B） | PENDING PRODUCT |
| M02-IAM-003 | 管理员可读取可用角色，并在授权范围内管理用户的全局角色绑定 | 角色读取要求 `role:read`；绑定要求 `user:role:manage`；越权绑定与项目角色绕过项目成员关系均被拒绝；绑定结果可由后续用户查询核实 | IMPLEMENTED（M02-B） | PENDING PRODUCT |
| M02-IAM-004 | 项目成员只能读取其成员关系授权的项目；平台管理员和企业管理员遵循各自范围 | 项目成员的项目列表限于 `projectIds`；企业管理员限于本企业；平台管理员可按现有规则读取；跨范围数据不可见 | IMPLEMENTED（M02-A/B） | PENDING PRODUCT |
| M02-IAM-005 | 提供用户与角色管理的前端操作界面 | 待产品决定是否属于 M02；如纳入，需定义页面、角色可见性、操作流程及前后端真实 HTTP 验收 | NOT CONFIRMED | PENDING PRODUCT |

### 候选接口清单（以主线实现为事实）

- `GET /api/auth/users`：读取当前操作者范围内用户。
- `POST /api/auth/users`：创建用户，成功返回 `201`。
- `POST /api/auth/users/{userId}/status`：设置 `ACTIVE` 或 `DISABLED`。
- `GET /api/auth/roles`：读取角色。
- `PUT /api/auth/users/{userId}/roles`：替换用户的全局角色绑定。
- 项目列表读取由现有 Project API 提供，并按操作者角色及 `projectIds` 过滤。

上述接口是代码核对结果，不是对外部 API Contract 的批准。若需求批准需要调整路径、字段、状态码或兼容规则，须先走 Contract 评审。

## 明确排除与待决项

- Laya / 语义模型路由不纳入本候选范围。它保持独立提案；若产品希望纳入 M02，需先决定是否纳入及其业务目标，再另行完成路由 API、数据隐私、失败降级、评估指标、运行目标和发布边界审查。当前 Laya 草案对 v0.3 的引用须先与主线基线版本对齐。
- 注册、密码重置、Token Refresh、企业切换、多因素认证、外部 IdP、Billing、Provider 扩展、生产 SLA 与部署能力仍沿用 v0.1 的候选状态，不因 M02-A/B 合并而自动纳入。
- 前端存在通用系统用户/角色页面文件；本次仅确认后端 M02 接口和页面文件存在，未证明这些页面已接通本次 M02 API 或完成真实浏览器验收。因此 M02-IAM-005 必须由产品明确纳入或排除。

## 审批与验收门槛

本候选转为 APPROVED 前，负责人须在 PR 或基线审批记录中逐项确认：

1. M02-IAM-001 至 M02-IAM-004 是否纳入正式 Requirement 分母，并给出 P0/P1 或明确排除；M02-IAM-005 是否纳入。
2. 表中验收条件是否满足业务预期，尤其是平台级/企业级角色范围、项目角色绑定边界和数据隔离。
3. API Contract、数据迁移与兼容性是否接受；当前证据只验证合并代码和已有测试，不代替重新签署 Contract。
4. 每项验收的责任人、测试环境、HTTP/浏览器证据、审计要求、发布及回滚责任人。
5. 其余 v0.1 候选主题和 Laya 提案逐项纳入、延期或排除，不能默认为已批准。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| PR #45 和 PR #46 合并至 `develop`；主线全量构建 76 tests、0 failures、0 errors、3 skipped | IAM/RBAC 与用户/角色管理能力是已交付代码事实；需求批准仍待完成 | [PR #45](https://github.com/hengaikj/ha_ai/pull/45)、[PR #46](https://github.com/hengaikj/ha_ai/pull/46)、[合并后状态对账](./m02-post-merge-reconciliation-v0.1.md) |
| `UserRoleManagementController` 和 `UserRoleManagementService` | 用户、角色接口、权限门禁、企业范围、状态限制及无密码字段摘要已实现 | `backend/src/main/java/com/hengaikj/ai/auth/controller/UserRoleManagementController.java`、`backend/src/main/java/com/hengaikj/ai/auth/service/UserRoleManagementService.java` |
| `ProjectService.list` 按角色及 `projectIds` 生成项目查询范围 | 项目可见范围已在服务层实施 | `backend/src/main/java/com/hengaikj/ai/project/ProjectService.java` |
| 后端 `mvn clean package` 与前端类型检查、构建记录 | 合并主线构建通过；真实 MySQL HTTP 测试未在合并提交重跑，浏览器端到端未运行 | [合并后状态对账](./m02-post-merge-reconciliation-v0.1.md#主线验证证据) |
| 前端有系统用户/角色页面文件，但缺少 M02 真实联调证据 | 页面是否纳入范围及是否连通新接口仍待确认 | `frontend/src/pages/system/SystemUserPage.vue`、`SystemRolePage.vue`；禁止据此宣称 M02 前端验收通过 |

## 变更记录

| 版本 | 说明 |
| --- | --- |
| v0.2 candidate | 将 M02-A/B 主线能力映射为待审批 Requirement 候选；补列前端管理 UI 与 Laya 的独立待决项；不改变 DRAFT 状态 |
