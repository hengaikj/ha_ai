# M02 API Contract 对齐提案 v0.1

状态：DRAFT / PENDING BACKEND, FRONTEND, ARCHITECTURE AND PRODUCT REVIEW

适用基线：[M02 Requirement Baseline v0.2 Candidate](./requirement-baseline-m02-v0.2-candidate.md)

代码核对基准：`develop` `c5db6b7dea9867c466f91180d6a81c69acec3559`

本文对照现有 Contract 草案与主线 M02 Controller/DTO，提出供评审的统一 API 表面。它不替换 `contracts/m02-api-contract-v0.2.md`，也不是实现授权。建议先确认 canonical 路径和行为，再决定更新 Contract 文档还是修改 Controller。

## 差异摘要

当前 [M02 API Contract v0.2](../../../contracts/m02-api-contract-v0.2.md) 仅列出 `GET /api/users`、`GET /api/roles`、`GET /api/permissions`、项目成员和 Usage/Audit 路径；它与主线用户/角色管理实现不一致。主线 Controller 的 base path 为 `/api/auth`，且包含创建用户、状态变更和角色绑定操作。前端目前调用更早的 `/system/**` 路径。本提案建议以 `/api/auth/...` 为 M02 管理 API 的 canonical surface，避免新 UI 继续依赖传统 `/system/**` API；该选择需 Backend、Frontend 和 Contract 负责人共同批准。

## 用户与角色 API 提案

| Method | Path | 成功状态 | 成功 `data` | 权限 / 范围 |
| --- | --- | --- | --- | --- |
| GET | `/api/auth/users` | 200 | `UserSummary[]` | `user:read`；平台管理员全局，企业管理员限本企业 |
| POST | `/api/auth/users` | 201 | `UserSummary` | `user:create`；平台管理员必须指定有效 `enterpriseId`，企业管理员只能创建到自身企业 |
| POST | `/api/auth/users/{userId}/status` | 200 | `UserSummary` | `user:update`；只允许自身授权范围，目标状态 `ACTIVE` 或 `DISABLED` |
| GET | `/api/auth/roles` | 200 | `RoleSummary[]` | `role:read`；需明确是全局目录还是当前操作者可绑定目录 |
| PUT | `/api/auth/users/{userId}/roles` | 200 | `UserSummary` | `user:role:manage`；全量替换全局角色绑定；项目角色通过项目成员 API 管理 |

当前 Controller 没有查询、搜索、分页参数；列表返回操作者范围内的完整记录并按用户 ID 升序。是否在 M02 加入分页/筛选由产品与 Backend 决定，不能在 UI 中假设已有分页 Contract。

### 请求与响应形状（按当前 DTO 提案）

创建用户：

```json
{
  "username": "alice",
  "password": "至少 12 个字符",
  "displayName": "Alice",
  "enterpriseId": 100,
  "roleCodes": ["enterprise-admin"]
}
```

`password` 当前长度校验为 12–128 字符；平台管理员需要传 `enterpriseId`；企业管理员省略时落到自己的企业，传其他企业会拒绝。返回摘要不能含 `password` 或 `password_hash`。

状态变更：`{"status":"ACTIVE"}` 或 `{"status":"DISABLED"}`。

角色绑定：`{"roleCodes":["enterprise-admin"]}`。其语义是替换全量绑定，列表当前要求非空。需明确是否保留“不能解绑最后一个全局角色”的限制；当前实现允许空请求体列表无法通过校验，但也尚未在 Contract 中定义角色清空流程。

用户摘要：

```json
{
  "userId": 42,
  "username": "alice",
  "displayName": "Alice",
  "enterpriseId": 100,
  "status": "ACTIVE",
  "roleCodes": ["enterprise-admin"]
}
```

角色摘要：`{"roleId": 2, "roleCode": "enterprise-admin", "displayName": "企业管理员"}`。M02 当前支持角色读取与用户角色绑定，不支持角色创建、编辑、删除或权限树管理；前端角色界面不得呈现这些未支持操作。

### Envelope、Request ID 与错误

成功响应使用 `{ "success": true, "requestId": "...", "data": ... }`，同时通过 `x-request-id` 响应头回传 Request ID。请求可提供 `x-request-id`，未提供时由服务端生成。

当前 `/api/**` 错误处理的已观察行为：

| HTTP 状态 | 已观察场景 | 错误形状 |
| --- | --- | --- |
| 400 | 参数校验、无效状态/请求 | `{"error":{"message":"...","type":"validation_error 或 request_error","code":"400"}}` |
| 401 | 缺少或失效的人类用户会话 | 由 Spring Security/Auth filter 返回；需在真实 HTTP 验证中固定响应形状 |
| 403 | 缺少权限、跨企业操作或不可分配角色 | `{"error":{"message":"...","type":"authorization_error","code":"403"}}` |
| 404 | 用户/企业不存在 | `{"error":{"message":"...","type":"request_error","code":"404"}}` |
| 409 | 用户名冲突 | `{"error":{"message":"...","type":"conflict","code":"409"}}` |

错误消息文本不应作为前端分支协议；前端按 HTTP 状态和稳定 `error.type` 处理。401 的实际响应仍是 Contract/HTTP 验收缺口。

## 角色可分配性待决

主线 `GET /api/auth/roles` 会返回角色表中的全部角色；企业管理员的写入路径却只允许绑定 `enterprise-admin`，且项目角色必须由项目成员关系单独授予。若直接把全量目录作为可选项，UI 会提供不可提交的角色选择。推荐 Contract 增加调用者可分配角色表达（例如每项 `assignable` 或区分 catalog 与 assignable options），并在真实 HTTP 中验证企业管理员、平台管理员和项目角色边界。该字段是提案，不是当前响应事实。

还需产品/安全评审是否禁止停用自身或最后一个有效平台管理员，以及用户/角色变更是否必须生成审计事件。当前代码和此提案均不能假设这些业务规则已实现。

## 前端联调验收建议

1. 登录并加载当前用户权限；无 `user:read`/`role:read` 权限时不显示相应入口，直接访问收到 403 时展示无权状态且不出现成功反馈。
2. 用户页 GET 返回值与真实字段映射一致；创建成功必须处理 HTTP 201，并刷新列表确认持久结果。
3. 状态切换使用批准的 `ACTIVE`/`DISABLED` 值；失败后恢复 UI 原状态，成功后刷新并核实结果。
4. 角色页读取可用目录；用户角色绑定确认全量替换语义，提交后刷新列表确认结果。不得提供 M02 不支持的角色 CRUD。
5. 提交真实浏览器 Network 证据：精确 method/path/status、脱敏 request/response、`x-request-id`；同时保留页面截图和无控制台应用错误记录。
6. 至少覆盖平台管理员、企业管理员、项目成员或普通用户，以及缺少权限、跨企业用户、无效/停用角色、重复用户名等正负场景；MySQL 数据库上验证持久化与数据范围。

## 待签署的 Contract 决定

- canonical path 是否采用主线 `/api/auth/...`；旧 v0.2 路径是文档过时还是仍有另一个模块使用。
- 角色目录响应是否只返回可绑定角色，或增加 `assignable` 能力字段。
- 是否增加分页/筛选、角色清空/解绑流程、自我/最后管理员保护和审计记录。
- 统一所有 API 错误的 401 envelope；验证 `x-request-id` 在错误响应也回传。
- 是否调整当前实际 API/DTO 以满足批准 Contract；批准前不改现有 M01 Contract。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| `UserRoleManagementController`、DTO 与 Service | 主线路由、字段、状态码、权限和绑定语义如本文所述 | `backend/src/main/java/com/hengaikj/ai/auth/controller/`、`auth/dto/`、`auth/service/UserRoleManagementService.java` |
| M02 API Contract v0.2 | 文档路由与主线实现不一致 | `contracts/m02-api-contract-v0.2.md` |
| 前端 `platform-system.ts` 与系统页面 | 当前用户/角色 UI 走旧 `/system/**` API | `frontend/src/api/platform-system.ts`、`frontend/src/pages/system/SystemUserPage.vue`、`SystemRolePage.vue` |
| Backend M02 HTTP 测试 | 现有 Controller MockMvc 测试 mock service 且关闭过滤器；不能证明真实鉴权、数据库范围或迁移结果 | `backend/src/test/java/com/hengaikj/ai/UserRoleManagementHttpTest.java` |
