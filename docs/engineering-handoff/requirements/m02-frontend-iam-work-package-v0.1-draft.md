# M02 Frontend IAM 工作包 v0.1 Draft

状态：DRAFT / OWNER SCOPE AND PRIORITY CONFIRMED; PENDING CROSS-FUNCTIONAL CONTRACT APPROVAL

适用基线：[M02 Requirement Baseline v0.2 Candidate](./requirement-baseline-m02-v0.2-candidate.md)

API 提案：[M02 API Contract 对齐提案 v0.1](./m02-api-contract-reconciliation-v0.1-draft.md)

代码核对基准：`develop` `c5db6b7dea9867c466f91180d6a81c69acec3559`

此工作包把已确认的“用户和角色管理必须有界面”拆成前端交付范围。它不是开发授权；API Contract、优先级和实现任务获批前不得据此改变生产代码。

## 主线现状与差距

主线已有通用管理页面，但不是 M02 用户/角色 API 的前端：

| 现有文件 | 当前调用 | 与 M02 差距 |
| --- | --- | --- |
| `frontend/src/pages/system/SystemUserPage.vue` | 经 `frontend/src/api/platform-system.ts` 请求 `/system/user/list`、`/system/user`、`/system/user/changeStatus`、`/system/user/authRole` | 用的是传统 RuoYi 风格 API；页面还包含组织、岗位、批量导入/导出、删除、密码重置、会话安全等 M02 Controller 未提供的功能 |
| `frontend/src/pages/system/SystemRolePage.vue` | 经 `platform-system.ts` 请求 `/system/role/list`、`/system/role/optionselect` 和 `/system/role/*` | 现页面提供角色 CRUD、菜单/权限树等能力；M02 后端目前只有角色读取与用户全局角色绑定 |

代码搜索未发现前端请求 `/api/auth/users` 或 `/api/auth/roles` 的适配层。故不能以现有页面文件存在作为 M02 UI 已完成的证据。

## 目标用户路径

1. 具备用户读取权限的管理员打开用户管理页，查看其授权范围内的用户及状态、企业和角色摘要。
2. 具备用户创建权限的管理员创建用户；平台管理员选择有效企业，企业管理员只能使用自身企业；页面提示初始密码限制并且提交后不显示密码散列。
3. 具备用户更新权限的管理员将用户设为 `ACTIVE` 或 `DISABLED`，成功后从服务端刷新状态。
4. 具备角色读取权限的管理员查看角色目录；对授权用户查看当前全局角色。
5. 具备角色管理权限的管理员绑定已分配给自己的可用角色；提交是全量替换，界面需先展示当前绑定并要求确认，不能误把新增理解为追加。

实现应采用独立 M02 页面或对现有页面做明确隔离的 M02 模式。鉴于现有页面含大量后端不支持的旧操作，默认建议创建精简的 M02 管理页；实现评审时再决定是否复用表格/表单组件。

Owner 已确认必须有独立纳入 M02 的“用户与角色管理”界面，建议优先级 P0；本工作包范围为角色目录读取和用户角色绑定，不含创建/编辑/停用角色或权限树。若后续需 CRUD，必须新增产品需求、Contract 与 Backend API，不能把旧 `/system/role/*` 功能默认带入 M02。

## Contract 依赖

前端开始接真实 API 前，以下事项必须固定：

- Owner 已选择 canonical path `/api/auth/...`；须由 Backend/Frontend/Architecture 将其写入并评审 Contract 后，才开始真实 API 对接。
- Owner 已选择新增受权限保护的 ACTIVE 企业选项 API；端点 Contract 与权限范围仍待评审，后端需再次校验企业状态，不能硬编码企业 ID 或把项目列表当企业目录。
- `GET /api/auth/roles` 如何提供“可展示角色”与“当前操作者可绑定角色”的区别。主线当前返回所有角色，企业管理员写入却仅能绑定 `enterprise-admin`。
- 用户列表是否分页/检索；当前接口无查询参数且返回全量企业/平台范围记录。
- `PUT /api/auth/users/{userId}/roles` 的全量替换及非空列表语义、解绑行为、自我停用限制。
- 成功 envelope、401 错误 envelope、403/409 字段及 `x-request-id` 在错误响应中的行为。

这些依赖见 [Contract 对齐提案](./m02-api-contract-reconciliation-v0.1-draft.md)，任何未签署字段都不得由前端单方面假设。

## 前端验收条件

| ID | 验收 | 证据 |
| --- | --- | --- |
| FE-IAM-001 | `user:read` / `role:read` 控制入口；直接访问时 401/403 显示明确错误，不出现成功或空数据假象 | 前端权限测试；浏览器权限正/负场景 |
| FE-IAM-002 | 用户列表准确呈现 API 的用户 ID、姓名、企业、状态和角色；范围由后端强制，UI 不自行扩大范围 | 浏览器响应和页面截图；跨企业身份对照 |
| FE-IAM-003 | 创建流程校验必填字段、12–128 字符密码要求及角色；企业管理员固定自身企业；平台管理员使用批准的企业选项来源选择有效企业；HTTP 201 后刷新 | 表单测试；浏览器 Network 与服务端持久化读回 |
| FE-IAM-004 | 启用/停用只发送批准的状态值；请求失败时回滚乐观 UI 状态；成功后刷新读回 | 前端测试及浏览器状态变更正/负场景 |
| FE-IAM-005 | 角色目录只显示已批准可见/可分配的角色；绑定前确认全量替换，成功刷新读回 | 浏览器目录、请求体和读回对照；越权角色 403/400 场景 |
| FE-IAM-006 | 请求失败时保留 Request ID 供定位；UI 不依赖错误 message 文本做业务分支 | 浏览器 Network 截图、脱敏请求/响应、控制台无异常 |
| FE-IAM-007 | 不展示 M02 API 未支持的角色 CRUD、组织/岗位编辑、批量导入导出、删除、密码重置、解锁或会话撤销控件 | 页面人工验收与组件测试 |

当前 `UserSummary` 只有 `enterpriseId`，没有企业名称；`RoleSummary` 只有角色 ID、编码和名称，没有角色状态。UI 只能显示这些已签署字段，除非另行批准 API 增加企业名称或角色状态。

前端 Axios 默认 `baseURL` 为 `/api`。如采用 wire path `/api/auth/users`，封装层应传相对 URL `/auth/users`（或使用明确的 baseURL override），避免拼出 `/api/api/auth/...`。最终 wire URL 必须在浏览器 Network 中验明。

## 交付物和完成证据

- 实际调用已批准 M02 API 的用户与角色页面、路由和权限入口。
- 覆盖字段映射、权限态、错误处理、创建/启停/角色绑定交互的前端自动化测试。
- `pnpm exec vue-tsc -b` 与 `pnpm run build` 在实现提交 SHA 上通过。
- 使用真实 Backend + 持久化数据库的浏览器验证：页面截图、Network 记录、Request ID、创建/状态/绑定后的服务端读回；不得以组件 mock 测试代替集成证据。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| 页面加载与请求函数 | 当前系统管理 UI 使用传统 `/system/**` 路径 | `frontend/src/pages/system/SystemUserPage.vue`、`SystemRolePage.vue`、`frontend/src/api/platform-system.ts` |
| Backend M02 Controller | 可直接映射的能力只有用户列表/创建/状态、角色目录、全量角色绑定 | `backend/src/main/java/com/hengaikj/ai/auth/controller/UserRoleManagementController.java` |
| 页面没有 M02 API adapter | M02 前端界面与真实 API 尚未打通 | `frontend/src/api/` 搜索结果与本工作包“主线现状与差距” |
