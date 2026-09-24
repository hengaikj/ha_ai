# M02 Backend IAM 工作包 v0.1 Draft

状态：DRAFT / OWNER SCOPE AND DEFAULTS CONFIRMED; PENDING CROSS-FUNCTIONAL CONTRACT AND SECURITY APPROVAL

适用基线：[M02 Requirement Baseline v0.2 Candidate](./requirement-baseline-m02-v0.2-candidate.md)

API 提案：[M02 API Contract 对齐提案 v0.1](./m02-api-contract-reconciliation-v0.1-draft.md)

代码核对基准：`develop` `09b0353e9899b95c16a7e0b7720724785bad4223`

此工作包把已确认的 IAM/RBAC 与用户/角色 API 范围拆成可评审任务。它不授权实现或数据库变更；Contract、安全风险和优先级批准后才可建立实施分支。

## 主线现状

主线已提供 `AuthController.getInfo` 角色/权限码、M02 用户/角色 Controller、Service、V2–V4 数据迁移和项目范围过滤。实际路由与 `contracts/m02-api-contract-v0.2.md` 不一致。当前 `UserRoleManagementHttpTest` 是 `@WebMvcTest`，mock 了 Service/Authz 并关闭 Security filters；它不能单独证明真实认证、权限 Mapper、数据库范围或 Flyway 种子行为。后端已归档真实 MySQL/JWT/Filter HTTP 验收（73/73）及 Spring、Flyway、Redis/MySQL 启动证据；Contract 与跨职能签署仍待完成。

## 建议任务顺序

| 工作项 | 工作范围 | 完成条件 / 证据 | 依赖 |
| --- | --- | --- | --- |
| BE-IAM-01 Contract 对齐 | 与 Frontend/架构确认 canonical path、DTO、envelope/error、状态码、权限码、角色替换与列表语义；更新 Contract/OpenAPI 或实现路由，禁止文档和代码双轨 | 批准的单一 Contract；契约测试覆盖所有方法/字段/错误；Frontend 可按该版本接入 | Baseline/Contract 审批 |
| BE-IAM-02 授权 fail-closed | 删除所有构造路径中缺少权限 Mapper 时放行的路径；启动时缺少授权组件应失败 | PR #49 已合并，强制 `AuthPermissionMapper`、拒绝直接 null 注入，并测试缺 Bean 启动失败/null 构造拒绝；目标运行实例已确认 Spring 启动成功，真实 HTTP 安全矩阵已归档。正式安全/基线签署仍待完成 | BE-IAM-01；安全评审；PR #49 Review |
| BE-IAM-03 用户生命周期 API | 覆盖用户 list/create/status 的真实鉴权、字段校验、企业作用域、有效企业、用户名唯一冲突、状态限制、响应脱敏 | 真正数据库 HTTP 创建/查询/状态读回；平台管理员、同企业、跨企业、无权、未认证、禁用用户、无效状态、重复用户名等正负路径 | BE-IAM-01、BE-IAM-02 |
| BE-IAM-04 角色读取与绑定 | 明确全量目录与可分配选项；处理企业管理员与平台管理员各自可分配角色；防止项目角色通过全局绑定写入；明确替换和解绑语义 | 真实 HTTP 读取角色、绑定、刷新读回；未授权角色被拒绝；项目角色经项目成员 API 管理；角色替换失败时原绑定保持完整；角色结果与 Contract 一致 | BE-IAM-01、BE-IAM-02 |
| BE-IAM-05 项目数据范围 | 验证平台/企业管理员/项目成员项目列表和项目操作按 `projectIds`、企业及角色范围隔离；Key 状态变更必须先认证再做对象查询 | PR #50 已合并并增加未认证状态变更不得触发 Key 查询的回归测试；真实 HTTP 证据覆盖授权、跨企业拒绝和 Request ID | BE-IAM-02；PR #50 Review |
| BE-IAM-06 Migration 与部署 | 对 V2–V4 执行空库迁移、旧库升级、重复运行/种子幂等和唯一约束冲突验证；检查权限码正确授予角色 | MySQL 8 clean install + upgrade logs、种子行查询、第二次启动或重放无副作用；回滚/备份方案已评审 | Contract/schema approval |
| BE-IAM-07 审计与管理员不变量决定 | 与产品/安全决定是否要求用户变更审计、自我停用保护、最后平台管理员保护、分页/检索、停用用户的现有 session 是否撤销；仅批准的项目进入实现 | 每一项有明确纳入/排除记录；纳入者由持久化审计/负向 HTTP 用例证明 | 产品/安全决策 |
| BE-IAM-08 平台管理员企业选项数据源 | 新增经授权的 ACTIVE 企业选项 API；创建接口仍校验有效企业，不复用项目列表、不硬编码 ID | UI 从批准的数据源选择企业；后端独立校验企业状态/范围；真实 HTTP 正负向验证 | Contract/Backend 审批及实现 |
| BE-IAM-09 角色管理深度 | Owner 默认决定本 M02 角色 UI 只读目录和现有角色绑定；不含角色 CRUD、停用或权限树 | 明确 Requirement/Contract 和完整 HTTP/UI 验收；扩展角色 CRUD 须另提 Change Request | Owner 默认决定已记录；跨职能 Baseline/Contract 审批 |

## 角色矩阵与 HTTP 证据要求

至少在 MySQL 8 上使用真实 `SecurityFilterChain`、JWT/session 和 Mapper 执行以下 HTTP 测试；测试数据库须预先通过目标 SHA 的 Flyway 迁移。另以独立 Flyway 测试验证 clean install、upgrade path 和种子幂等。MockMvc 可用于测试装配，但不能作为唯一 HTTP 证据。

| 操作者 | 用户读/创建/状态 | 角色目录与绑定 | 项目范围 |
| --- | --- | --- | --- |
| platform-admin | 可跨企业；创建必须指定 ACTIVE enterprise；不可读取/回传 password hash | 按批准策略读/绑定全局角色；禁止通过绑定写项目角色 | 全平台项目范围 |
| enterprise-admin (Enterprise A) | 仅 Enterprise A；禁止创建/管理 Enterprise B | 只能绑定批准的企业角色；目录须清楚标记可分配角色 | 限 Enterprise A |
| project member | 不得获得企业级用户管理能力 | 不得读取或绑定未经授权的全局角色 | 只返回成员 `projectIds` 并按项目角色限制操作 |
| 普通/无权限用户 | 401/403，绝不返回空成功数据伪装授权 | 401/403 | 401/403 或仅批准的数据范围 |
| DISABLED user | 后续受保护请求返回 401 | 后续受保护请求返回 401 | 后续受保护请求返回 401 |

每次真实 HTTP 验收需记录目标 Git SHA、HTTP method/path/status、脱敏请求与响应、`x-request-id`、数据库断言和测试身份。响应体必须扫描并确认无 `password`、`password_hash`、JWT、服务密钥或 Provider 凭证。

## 当前明确的技术风险与未决业务语义

- PR #49/#50/#51 已合并到 develop；缺失 `AuthPermissionMapper` 时启动失败，授权路径不再 fail-open。PR #51 提供 ACTIVE 企业选项；后端真实 HTTP 证据已在 `/tmp/ha-ai-evidence/m02-real-http/89aa6021/` 归档。当前文档证据刷新由 PR #57 合并到 develop `09b0353`。
- 停用用户会使后续受保护请求因用户状态检查返回 401，但当前状态更新未撤销持久化的 session；是否需即时撤销 session 要产品/安全确认并纳入测试。
- 当前角色目录返回所有角色，但企业管理员写入仅接受 `enterprise-admin`；角色 API 需过滤可分配项或显式返回可分配能力。
- 平台管理员创建用户使用经授权的 ACTIVE 企业选项 API；PR #51 已提供该端点，前端 PR #52 已接入，后端仍需独立校验企业状态。
- Owner 已确认 M02“角色管理界面”限角色目录读取与用户绑定；当前后端不支持角色 CRUD、状态切换或权限树，若新增须走 Baseline Change Request。
- 当前角色绑定 PUT 语义为全量替换，HTTP DTO 拒绝空列表；Contract 应说明如何清空/解绑，以及企业管理员至少保留什么全局角色。
- 当前用户列表没有分页和过滤。是否纳入 M02 需产品/架构决定；不能在不设上限的前提下声称适合大规模用户目录。
- 是否禁止停用自身/最后一个平台管理员、是否审计用户和角色变更，尚无批准规则；代码及接口契约应按明确决定执行。
- M02 Controller 测试关闭过滤器、mock 服务；全量 `mvn clean package` 及 Spring Context 启动不能代替上述真实 HTTP + MySQL 安全验收。现有 `ProjectMemberRealMapperHttpTest` 是真实 JWT/filter/Mapper HTTP，但关闭 Flyway、依赖预迁移库，因此与 migration clean/upgrade 证据必须分别记录。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| Controller / Service / DTO | 已有五个用户与角色管理方法，用户摘要不含 password hash | `backend/src/main/java/com/hengaikj/ai/auth/controller/UserRoleManagementController.java`、`auth/service/UserRoleManagementService.java`、`auth/dto/` |
| Contract 文件 | 文档路径与实现不一致 | `contracts/m02-api-contract-v0.2.md` |
| `AuthzService` null mapper 分支 | 缺少权限 Mapper 时存在 fail-open 行为 | `backend/src/main/java/com/hengaikj/ai/auth/service/AuthzService.java` |
| 用户/角色 MockMvc 测试 | 当前 HTTP 测试不验证 filters、实际权限计算、MySQL 或迁移 | `backend/src/test/java/com/hengaikj/ai/UserRoleManagementHttpTest.java` |
| 真实 MySQL Mapper 测试 | 已有测试仅覆盖项目成员项目列表，默认按环境变量跳过 | `backend/src/test/java/com/hengaikj/ai/ProjectMemberRealMapperHttpTest.java` |
