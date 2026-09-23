# 正式 JWT 与用户库认证实施计划

> **执行要求：** 按任务逐项实现并验证；每项完成后独立提交。不得开始 API Key、Usage 之外的新业务 Slice。

**目标：** 为 HA AI 提供正式的 MySQL 用户认证、可撤销 JWT 会话和基于企业/项目成员关系的 M01 管理 API 授权，并通过真实浏览器完成登录、项目、API Key、Chat、Usage 验证。

**架构：** Spring Security OAuth2 Resource Server 验证 HMAC-SHA-256 JWT；BCrypt 验证用户密码；MySQL 保存用户、角色、会话、企业与项目成员关系。超级管理员跨企业，普通用户仅属于一个企业。Management API 从数据库认证上下文判定范围，Gateway `/v1/**` 继续用 API Key 验证。

**技术栈：** Java 17、Spring Boot 3.3.5、Spring Security、OAuth2 Resource Server/Nimbus、MyBatis-Plus、MySQL 8、Flyway、Vue 3、TypeScript、pnpm、Playwright CLI。

**设计说明：** `docs/superpowers/specs/2026-09-23-formal-jwt-user-auth-design.md`

## 全局约束

- 用户只属于一个企业；`platform-admin` 的 `enterprise_id` 为空并可跨企业管理。
- JWT 有效期 60 分钟，Claims 仅包含 `sub`、`jti`、`iss`、`iat`、`exp`；会话撤销状态在 MySQL 校验。
- 密码只保存 BCrypt 摘要；JWT HMAC 密钥至少 256 bit，只从环境注入；不得写入仓库、日志或测试快照。
- API Key secret 只在创建响应中出现一次；数据库只保存 `key_prefix` 与 `key_hash`；`/v1/**` 不接受用户 JWT 替代 API Key。
- 管理请求不信任 `X-Enterprise-Id`；企业和项目范围由登录用户、角色和成员记录确定。
- 不新增 `permission_code`；按设计中的角色和项目成员范围执行授权。
- 不改写 `V1__m01_b.sql`，数据库变更用后续 Flyway migration。
- OpenAPI Lint 若项目仍无正式 validator，保持 `NOT_RUN`；YAML Parse 不得冒充 OpenAPI Lint。
- 本机初始管理员仅从 Docker 环境变量引导；凭据不提交，不输出到 Maven、Docker 或浏览器证据。

## Review Focus

- 修改 `X-Enterprise-Id` 不能扩大普通用户数据范围；测试跨企业和跨项目返回 403。
- 登出后仍有效签名的 JWT 必须因会话撤销返回 401；测试同一令牌登出前后行为。
- 用户 Bearer JWT 不得被 `/v1/**` 当作 API Key；API Key 不得作为管理 API 用户身份。
- 错误用户名与错误密码返回相同状态码和错误消息；连续 5 次失败锁定 15 分钟。
- `platform-admin` 在所有企业可读写，普通用户仅访问数据库成员范围内的企业与项目；分别覆盖创建 Project、操作 API Key 和查询 Usage。

---

### 任务 1：先更新并评审正式 OpenAPI Contract

**文件：**
- 修改：`contracts/openapi/enterprise-management.yaml`

**接口：**
- 新增 `POST /login`、`POST /logout`、`GET /getInfo`、`GET /getRouters`。
- 新增 LoginRequest、LoginResponse、CurrentUserContext、AuthError 等 schemas。
- `POST /login` 和 `GET /api/captchaImage` 显式 `security: []`；其他管理 API 声明 HumanAuth Bearer JWT。
- 用户上下文增加可空 `enterpriseId` 与 `projectIds`。
- Project CreateRequest 增加可选 `enterpriseId`；只允许 `platform-admin` 使用，其他角色提交时 403。
- 登录失败响应统一为 HTTP 401、`code=401`、消息“用户名或密码错误”，避免账号枚举。
- `UsageSummary` 中尚未确定的执行/交付/计费字段保持为可省略字段，不定义虚构枚举值。

**步骤：**

- [ ] **Step 1：修改 OpenAPI 路由与 schema。**

`LoginRequest` 必须含 `username`、`password`，`code` 和 `uuid` 可选；`LoginResponse.data` 含 `accessToken` 与 `expiresIn=3600`。`CurrentUserContext.user` 含 `userId`、`username`、`displayName`、`enterpriseId`、`roleCodes`、`permissionCodes`、`projectIds`。

- [ ] **Step 2：验证 YAML 和 `$ref`。**

运行 `ruby -e 'require "yaml"; YAML.load_file("contracts/openapi/enterprise-management.yaml")'`，再运行 `rg -n '\$ref:' contracts/openapi/enterprise-management.yaml` 与 `git diff --check`。YAML Parse 必须成功；OpenAPI Lint 如未安装则保持 `NOT_RUN / TOOL_NOT_FOUND`。

- [ ] **Step 3：提交 Contract 变更并等待 Review/合并。**

```bash
git add contracts/openapi/enterprise-management.yaml
git commit -m '契约(auth)：定义JWT登录与用户上下文'
```

建立 Contract PR；Contract 未 Review/合并前不得开始依赖这些字段的业务实现。合并后从最新 `develop` 重建 `feature/formal-jwt-user-auth` 并保留设计文档提交。

### 任务 2：新增企业、认证、项目字段数据库迁移

**文件：**
- 新建：`backend/src/main/resources/db/migration/V2__formal_user_auth.sql`
- 新建：`backend/src/test/java/com/hengaikj/ai/AuthSchemaMigrationTest.java`

**接口：**
- 数据表：`ha_enterprise`、`ha_auth_user`、`ha_auth_role`、`ha_auth_user_role`、`ha_auth_project_member`、`ha_auth_session`。
- `ha_project` 增加 `project_code`、`status`，唯一键为 `(enterprise_id, project_code)`。
- 已有企业 ID 从 `ha_project` 与 `ha_api_key` 补入 `ha_enterprise`；项目编码回填为 `HAI-{id}`，状态为 `ACTIVE`。

**步骤：**

- [ ] **Step 1：先写迁移集成测试。** 对空 MySQL 8 和仅有 V1 的库各应用 Flyway，断言表/列/唯一索引存在，旧 Project 行能获得唯一编码，重复迁移安全。
- [ ] **Step 2：运行 `mvn -Dtest=AuthSchemaMigrationTest test` 并确认新测试失败。**
- [ ] **Step 3：实现 V2 migration。** 用户密码列只允许存 BCrypt 字符串；session 的 `jti` 唯一；企业 ID 对非平台账号必填；外键和索引覆盖用户角色、用户项目与会话查询。
- [ ] **Step 4：运行 `mvn -Dtest=AuthSchemaMigrationTest test`，再运行 `mvn test`。** 两种 MySQL 起始状态均通过。
- [ ] **Step 5：提交迁移与测试。** `git commit -m '功能(auth)：新增用户认证数据库结构'`。

### 任务 3：实现认证持久层与角色/项目授权服务

**文件：**
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/entity/AuthUserEntity.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/entity/AuthRoleEntity.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/entity/AuthSessionEntity.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/entity/ProjectMemberEntity.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/mapper/AuthUserMapper.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/mapper/AuthRoleMapper.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/mapper/AuthSessionMapper.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/mapper/ProjectMemberMapper.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/service/AuthzService.java`
- 新建：`backend/src/test/java/com/hengaikj/ai/AuthzServiceTest.java`

**接口：**
- `AuthzService.currentUser(Authentication): AuthUserContext`
- `AuthzService.requireProjectAccess(AuthUserContext, long projectId, ProjectAction): ProjectScope`
- `AuthUserContext(userId, enterpriseId, roleCodes, projectIds)`。
- `ProjectAction` 值为 `READ_PROJECT`、`READ_KEYS`、`MANAGE_KEYS`、`READ_USAGE`、`CREATE_PROJECT`。

**步骤：**

- [ ] **Step 1：为五类角色写授权单测。** 覆盖平台管理员、企业管理员、项目管理员、开发成员、只读成员；验证不匹配 enterprise/project 的访问拒绝。
- [ ] **Step 2：运行 `mvn -Dtest=AuthzServiceTest test` 并确认失败。**
- [ ] **Step 3：实现 MyBatis-Plus Entity/Mapper 与 `AuthzService`。** 普通用户 enterpriseId 只读自用户行；平台管理员只能由 `platform-admin` 角色确定；`projectIds` 来自项目成员表，不读取客户端头。
- [ ] **Step 4：运行 `mvn -Dtest=AuthzServiceTest test`。** 允许用 `platform-admin` 角色编码兼容前端 `hasSuperAdminRole`，不新增 permission code。
- [ ] **Step 5：提交认证持久层。** `git commit -m '功能(auth)：增加用户角色与项目范围授权'`。

### 任务 4：实现 JWT 签发、会话撤销和 Spring Security

**文件：**
- 修改：`backend/pom.xml`
- 修改：`backend/src/main/resources/application.properties`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/config/SecurityConfig.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/config/JwtConfig.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/filter/JwtSessionFilter.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/service/JwtSessionService.java`
- 新建：`backend/src/test/java/com/hengaikj/ai/JwtSessionSecurityTest.java`

**接口：**
- `JwtSessionService.issue(long userId): IssuedSession(accessToken, jti, expiresAt)`
- `JwtSessionService.revoke(String jti): void`
- Security chain：`/v1/**` 放行到 Gateway API Key 验证；`/login`、`/api/captchaImage` 匿名；其他管理路由要求有效 JWT 和有效 DB session。

**步骤：**

- [ ] **Step 1：写 JWT 安全测试。** 验证正确签名和有效期通过；错误签名、过期 JWT、无 session、已撤销 session 均 401；JWT 用户 Bearer 访问 `/v1/models` 仍由 API Key 层拒绝。
- [ ] **Step 2：运行 `mvn -Dtest=JwtSessionSecurityTest test` 并确认失败。**
- [ ] **Step 3：加入 Spring Security OAuth2 Resource Server 与 Nimbus 配置。** 从 `AUTH_JWT_HMAC_KEY` 构造 HS256 decoder/encoder；缺少密钥或小于 32 bytes 时启动失败；每个 JWT 仅包含 `sub/jti/iss/iat/exp`。
- [ ] **Step 4：实现 session filter。** 将过滤器放在 `BearerTokenAuthenticationFilter` 之后；在受保护 API 读取 `jti` 并确认数据库 session 未撤销、未过期；登出撤销当前 session。
- [ ] **Step 5：为测试配置独立的非生产 HMAC 测试密钥（仅测试配置，不复用开发或生产密钥），运行 `mvn -Dtest=JwtSessionSecurityTest test` 与 `mvn test`。**
- [ ] **Step 6：提交 Security 实现。** `git commit -m '功能(auth)：接入签名JWT与会话撤销'`。

### 任务 5：实现登录、用户上下文、菜单与初始管理员引导

**文件：**
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/controller/AuthController.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/service/AuthService.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/service/AuthBootstrapRunner.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/dto/LoginRequest.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/auth/dto/LoginResponse.java`
- 新建：`backend/src/test/java/com/hengaikj/ai/AuthHttpTest.java`
- 修改：`deploy/docker/docker-compose.dev.yml`
- 新建：`deploy/docker/.env.example`

**接口：**
- `POST /login` 接收 `{username,password,code?,uuid?}`，返回 `{code:200,msg,data:{accessToken,expiresIn,user}}`。
- `GET /getInfo` 返回 `{code:200,msg,data:{user,roles,permissions}}`。
- `GET /getRouters` 返回 `{code:200,msg,data:[AI 项目、API Key、Usage 菜单]}`。
- `POST /logout` 返回 `{code:200,msg}` 并撤销当前 `jti`。

**步骤：**

- [ ] **Step 1：为登录和上下文写 MockMvc 测试。** 覆盖正确/错误密码、停用用户、企业归属、全局管理员角色、菜单路径、锁定阈值及登出后 401。
- [ ] **Step 2：运行 `mvn -Dtest=AuthHttpTest test` 并确认失败。**
- [ ] **Step 3：实现 `AuthService`。** BCrypt 校验；错误账号/密码统一 401 文案；第 5 次失败锁 15 分钟；成功清零失败计数并签发 3600 秒 JWT；验证码因当前 backend 明确关闭而可缺省。
- [ ] **Step 4：实现 AuthController、用户上下文和三个 AI 菜单。** `enterpriseId` 从用户行读取；全局管理员返回 null，permissions 第一版为空，roleCodes 含 `platform-admin`。
- [ ] **Step 5：实现一次性管理员引导。** `AUTH_BOOTSTRAP_ADMIN_USERNAME/PASSWORD` 仅当库中不存在平台管理员时创建；BCrypt 写入数据库；引导环境变量不回显；Docker Compose 要求 JWT 密钥及 bootstrap 凭据由 `.env` 提供。
- [ ] **Step 6：运行 `mvn -Dtest=AuthHttpTest test` 与 `mvn test package`。**
- [ ] **Step 7：提交登录 API。** `git commit -m '功能(auth)：实现登录与用户上下文接口'`。

### 任务 6：补齐受认证保护的 Project HTTP 与测试种子

**文件：**
- 新建：`backend/src/main/java/com/hengaikj/ai/project/ProjectController.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/project/ProjectService.java`
- 新建：`backend/src/main/java/com/hengaikj/ai/project/ProjectSummary.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/entity/ProjectEntity.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/mapper/ProjectMapper.java`
- 新建：`backend/src/test/java/com/hengaikj/ai/ProjectHttpTest.java`

**接口：**
- `GET /api/projects` 返回 `SuccessEnvelope<List<ProjectSummary>>`。
- `POST /api/projects` 接收 Project Contract 字段；企业管理员使用自身 enterpriseId，`platform-admin` 必须传有效目标 enterpriseId。
- `ProjectSummary(projectId, projectCode, projectName, entitlementMode, status)`，ID 序列化为字符串。

**步骤：**

- [ ] **Step 1：写 Project HTTP 测试。** 验证企业管理员只见本企业、项目成员只见成员项目、平台管理员见全部、普通用户伪造 enterpriseId 返回 403、项目编码重复 409、未认证 401。
- [ ] **Step 2：运行 `mvn -Dtest=ProjectHttpTest test` 并确认失败。**
- [ ] **Step 3：实现 Project Controller/Service。** 通过 `AuthzService` 获取范围；响应符合前端 `{success:true,requestId,data}`；创建时按 Contract 规则确定企业归属。
- [ ] **Step 4：添加显式联调 SQL seed。** 使用任务 9 的 `backend/scripts/dev/seed-m01-integration.sql`，准备 enterprise 与 `ACTIVE` 项目；不在 Spring 启动时写入样本数据。
- [ ] **Step 5：运行 `mvn -Dtest=ProjectHttpTest test` 与 MySQL 8 migration 测试。**
- [ ] **Step 6：提交 Project HTTP。** `git commit -m '功能(project)：补齐受认证项目列表接口'`。

### 任务 7：将 API Key、Gateway 与 Usage 接入认证/租户范围

**文件：**
- 修改：`backend/src/main/java/com/hengaikj/ai/controller/ApiKeyController.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/service/ApiKeyService.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/controller/OpenAiController.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/service/OpenAiService.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/usage/UsageController.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/usage/UsageService.java`
- 修改：`backend/src/main/java/com/hengaikj/ai/mapper/UsageMapper.java`
- 新建：`backend/src/test/java/com/hengaikj/ai/ManagementScopeHttpTest.java`

**接口：**
- Management Controller 从 `Authentication` 取得 `AuthUserContext`；API Key 创建响应包为 `SuccessEnvelope<ApiKeyCreateResponse>`，`apiKeyId` 为字符串。
- API Key 状态动作根据 keyId 查询项目并校验 scope，前端不需传 `projectId` 或 `X-Enterprise-Id`。
- `/v1/**` 按 `SHA-256(secret)` 全局查 Key 并使用实体自带 enterprise/project；绝不信任 `X-Enterprise-Id`。
- Usage 查询通过 `ha_ai_request.request_id` 关联企业、项目和执行状态，按认证主体过滤，返回现有 `UsageSummary` Envelope。

**步骤：**

- [ ] **Step 1：写 ManagementScopeHttpTest。** 覆盖用户 JWT 缺失、企业越权、项目越权、超级管理员全局操作、Key 创建只返回一次 secret、列表无 `secret/keyHash`、disable/enable/revoke 使 Redis 缓存失效、Chat 的 API Key 认证及 Usage 范围。
- [ ] **Step 2：运行 `mvn -Dtest=ManagementScopeHttpTest test` 并确认失败。**
- [ ] **Step 3：改造 API Key 管理控制器/服务。** 保留 secure random、hash-only DB、一次性返回；加 scope 检查和契约封套。
- [ ] **Step 4：改造 Gateway Key 查找。** 以 Key hash 定位企业与项目，缺失/停用/撤销/过期统一 401；移除对租户头的信任。
- [ ] **Step 5：改造 Usage 查询。** Mapper join `ha_usage_record` 与 `ha_ai_request`；超级管理员全量查询，其他身份按 projectIds/enterpriseId 条件过滤；未定义结果字段不填造值。
- [ ] **Step 6：运行 `mvn -Dtest=ManagementScopeHttpTest test`、`mvn test package`。**
- [ ] **Step 7：提交管理 API scope 实现。** `git commit -m '功能(auth)：为M01管理API加入企业项目授权'`。

### 任务 8：完成前端认证上下文和 Usage Contract 解码

**文件：**
- 修改：`frontend/src/types/auth.ts`
- 修改：`frontend/src/api/ai/types.ts`
- 修改：`frontend/src/api/ai/http.ts`
- 修改：`frontend/src/pages/ai/AiManagementPage.vue`
- 修改：`frontend/src/api/ai/management.test.ts`

**接口：**
- `BackendCurrentUser.enterpriseId?: number | null`。
- 新增 `usageDecoders.usage(data): UsageSummary[]`，校验 requestId/projectId/model/createdAt，不把缺少的结果字段臆造成状态。
- keys 页面使用 `apiKeyDecoders`；usage 页面使用 `usageDecoders`。

**步骤：**

- [ ] **Step 1：为缺少 enterpriseId 和 Usage DTO 测试写失败断言。** 覆盖有效、空列表、格式错误和结果字段缺省。
- [ ] **Step 2：运行 `pnpm --dir frontend exec vitest run src/api/ai/management.test.ts` 并确认失败。**
- [ ] **Step 3：实现类型和 decoder。** `usageDecoders` 只返回 API Contract 已定义字段；不新增 permission code。
- [ ] **Step 4：将 decoder 传给 service。** 根据当前 route kind 选择对应 decoder，避免 setup 时固定 `kind.value` 导致页面切换后错用 decoder。
- [ ] **Step 5：运行 `pnpm --dir frontend exec vitest run src/api/ai/management.test.ts`、`pnpm --dir frontend run type-check`、`pnpm --dir frontend run build`。**
- [ ] **Step 6：提交前端适配。** `git commit -m '功能(auth)：适配JWT用户上下文与Usage响应'`。

### 任务 9：容器化启动与 MySQL HTTP 集成测试

**文件：**
- 修改：`deploy/docker/docker-compose.dev.yml`
- 新建：`deploy/docker/.env.example`
- 新建：`backend/src/test/java/com/hengaikj/ai/AuthMySqlIntegrationTest.java`
- 新建：`backend/scripts/dev/seed-m01-integration.sql`
- 更新：`README.md` 中本地开发认证配置段落

**步骤：**

- [ ] **Step 1：写 MySQL IntegrationTest。** 建立管理员、企业管理员、项目成员和两个 enterprise/project fixture；验证迁移、登录会话撤销、范围隔离、Usage Join。
- [ ] **Step 2：使用运行中的 MySQL 8 实例，运行 `mvn -Dtest=AuthMySqlIntegrationTest test` 并确认失败；测试凭据由环境变量提供，不得把密码写入命令、日志或文档。**
- [ ] **Step 3：Compose 通过必需环境变量加载 JWT key 与 bootstrap admin，不设明文默认值；`.env.example` 仅含占位值和生成命令。**
- [ ] **Step 4：运行 `docker compose -f deploy/docker/docker-compose.dev.yml config`，使用本机 MySQL 8 运行 Flyway 和 `backend/scripts/dev/seed-m01-integration.sql`。**
- [ ] **Step 5：运行 `mvn test package`，记录 Exit Code、测试数、失败/错误数。**
- [ ] **Step 6：运行 `pnpm --dir frontend run type-check`、`pnpm --dir frontend run build`、`pnpm --dir frontend run test`。**
- [ ] **Step 7：提交容器与操作文档。** `git commit -m '文档(auth)：说明JWT本地初始化与MySQL联调'`。

### 任务 10：真实浏览器最终联调与证据

**文件：**
- 证据目录：`/tmp/ha-ai-evidence/m01-final-login/`

**步骤：**

- [ ] **Step 1：启动 Compose 中 MySQL/Redis/Backend，再启动 Frontend。** `VITE_ENABLE_AI_MOCK=false`，确认浏览器 Network 的真实请求都经 `/api` Proxy 到 `127.0.0.1:18080`。
- [ ] **Step 2：登录验证。** 用一次性引导的管理员账号登录，检查 `/login` 返回 200、`/getInfo` 与 `/getRouters` 成功，JWT 不写日志。
- [ ] **Step 3：完成真实管理浏览器流程。** 打开项目列表；新建/选中项目；创建 API Key 并确认 secret 只展示一次；用创建 Key 在当前页面上下文执行 `stream=false` Chat；打开 Usage 并看到对应 requestId。
- [ ] **Step 4：验证安全失败路径。** 登出后同一 JWT 访问管理 API 返回 401；普通用户访问其他企业或未授权项目返回 403；禁用/撤销 API Key 后 Gateway 返回 401。
- [ ] **Step 5：保存脱敏证据。** 保存登录页/项目/API Key/Usage 截图、浏览器 Network 状态与 requestId、Backend 启动/HTTP 摘要、MySQL Request/RoutingAttempt/Usage 行数；不保存密码、JWT、API Key secret 或 Authorization Header。
- [ ] **Step 6：填写中文 `LOGIN_INTEGRATION_REPORT`。** 包含账号初始化方式、接口说明、用户上下文、测试结果、Evidence 路径、未运行项；只有所有真实流程通过才报告 PASS。
- [ ] **Step 7：运行 `git status`、`git diff --check`，确认 Local/Remote HEAD 匹配；创建中文 PR，等待 Backend Review。**

## 提交顺序与 Review Gate

1. Contract PR 更新并合并后，确认 `develop` 已包含 Contract Commit。
2. `feature/formal-jwt-user-auth` 基于新的 `develop` 实现 Backend/Frontend。
3. Maven、pnpm、MySQL 和浏览器证据齐全后提交一个实现 PR；Review 通过并合并后才报告 `READY_FOR_FINAL_LOGIN_INTEGRATION=YES`。

实现 PR 不得混入其他业务 Slice、Billing、M02、正式 Provider 扩展或生产部署配置。
