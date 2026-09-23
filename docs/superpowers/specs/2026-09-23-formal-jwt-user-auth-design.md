# HA AI 正式 JWT 与用户库认证设计

日期：2026-09-23  
基线：`develop` / `ee3842fe55d40c466e9d25794d320ab3746a91be`

## 目标与约束

为 M01 提供可用于浏览器真实联调的正式登录与用户上下文，并让项目、API Key、Usage 管理接口执行身份、企业和项目范围校验。用户只属于一个企业；平台超级管理员可以跨企业管理数据。认证使用 JWT 与 MySQL 用户库，不使用固定开发账号或内存身份。

继续遵守现有 API Key Secret 规则；API Key 仍用于 `/v1` Gateway 调用。管理端使用用户 JWT。管理请求的企业上下文由服务端认证用户确定，不信任 `X-Enterprise-Id` 请求头。不要新增未经批准的 `permission_code`；第一版按数据库角色与项目成员关系做授权。

## 方案选择

采用 Spring Security OAuth2 Resource Server 校验 JWT，Nimbus HMAC-SHA-256 签名，密钥由环境注入且至少 256 bit。密码使用 BCrypt。相较自写 Servlet Filter，这能复用标准 Bearer Token 校验、无状态请求上下文和异常处理；相较接入外部身份提供方，该方案满足当前仓库自有用户库需求，不引入额外运行服务。

Access JWT 有效期 60 分钟，载荷只放 `sub`（用户 ID）、`jti`（会话 ID）、`iss`、`iat`、`exp`。数据库会话记录负责登出撤销和会话状态检查；角色、企业和项目范围每次从数据库加载，避免长期 JWT 携带过期权限。第一版不加入 refresh token；令牌过期后重新登录。登录失败返回统一错误，连续失败 5 次后锁定账号 15 分钟。

## 身份与授权模型

- `ha_enterprise`：企业 ID、名称、状态与审计时间；迁移为已有 Project/API Key 的企业 ID 补建企业记录。
- `ha_auth_user`：用户名、BCrypt 密码摘要、显示名、状态、单一 `enterprise_id`、失败次数及锁定截止时间。平台超级管理员企业 ID 为空。
- `ha_auth_role` 与 `ha_auth_user_role`：保存角色定义和用户角色关系。第一版内置 `platform-admin`、`enterprise-admin`、`project-admin`、`project-developer`、`project-viewer`。
- `ha_auth_project_member`：保存用户可访问的项目及项目角色。项目成员只能访问所属企业且已授权的项目。
- `ha_auth_session`：保存 JWT 的 `jti`、用户、签发/过期/撤销时间。密码重置、账号停用或登出会撤销相关会话。

授权规则：

| 角色 | 数据范围 | M01 管理操作 |
|---|---|---|
| `platform-admin` | 全部企业和项目 | 项目、API Key、Usage 全部操作 |
| `enterprise-admin` | 用户所属企业 | 企业内项目和 API Key 管理、Usage 查询 |
| `project-admin` | 已加入项目 | 项目详情、该项目 API Key 管理、Usage 查询 |
| `project-developer` | 已加入项目 | 项目与 API Key 列表、Usage 查询；不可创建/变更 Key |
| `project-viewer` | 已加入项目 | Project 与 Usage 只读 |

不返回或创建新的 permission code。前端超级管理员角色编码使用现有识别值 `platform-admin`。登录用户上下文额外包含 `enterpriseId`；超级管理员返回 `null`。

## HTTP 接口

认证接口遵循前端 `src/api/auth.ts` 的既有请求格式和通用 `{code,msg,data}` 响应：

- `POST /login`：接收 `username`、`password`，兼容可选 `code`、`uuid`。验证码功能关闭时不校验这两个字段。成功返回 `data.accessToken`、`data.expiresIn` 和用户摘要。
- `POST /logout`：撤销当前 JWT 对应会话。
- `GET /getInfo`：返回 `data.user`、`data.roles`、`data.permissions`；权限数组第一版为空，角色规则在服务端执行。
- `GET /getRouters`：只返回当前用户可见的 AI 项目、API Key、Usage 路由菜单。
- 所有认证接口回传 `x-request-id`。受保护请求没有令牌或令牌无效时返回 401。

管理 API 使用现有 Contract 的 `SuccessEnvelope`（`success`、`requestId`、`data`）：

- 补齐 `GET /api/projects`，返回登录用户范围内的 `ProjectSummary[]`。
- `POST /api/projects` 按现有 Project Contract 创建项目；企业管理员的企业范围从身份取得。为满足超级管理员跨企业管理全部数据，新增可选 `enterpriseId` 请求字段：仅超级管理员可指定目标企业；其他角色提交该字段时返回 403。该字段需要 Contract 变更。
- API Key 创建、列表、状态变更和 Usage 查询从认证主体加载范围，不接受调用方通过 `X-Enterprise-Id` 扩权。状态变更通过 API Key ID 查询其 Project，再校验角色和范围；不要求前端另传 Project ID。
- `GET /api/usage` 通过 `ha_ai_request` 的 requestId 关联筛选企业/项目范围；超级管理员可以查询全部记录。响应字段按现有 `UsageSummary` Contract 返回；执行/交付/计费结果的具体枚举尚未定义，不在本认证变更中虚构枚举值。
- `/v1/models` 与 `/v1/chat/completions` 继续使用 API Key Bearer 认证，不要求用户 JWT。企业和项目范围由 API Key 数据库记录确定，不信任客户端租户头。

由于 OpenAPI 尚未描述登录/用户上下文接口，正式编码前需要新增 Contract 变更，覆盖认证响应、用户上下文中的 `enterpriseId`、登录错误及 JWT Bearer 安全定义，并为超级管理员跨企业创建项目添加 `enterpriseId`。Project Summary 字段不变；实现 Project 列表所需的存储字段差异通过向前兼容数据库迁移解决。API Key DTO 必须把 `apiKeyId` 序列化为字符串，以符合现有前端解码器。

前端配套限于登录用户类型添加 `enterpriseId`、为 Usage 实现 Contract 解码器、创建/状态操作请求匹配正式响应封套，并保持 `VITE_ENABLE_AI_MOCK=false`。浏览器 Chat 验证使用已创建 API Key 从真实页面上下文发出 `/v1/chat/completions` 请求；本次不新增 Chat 产品页面。

## 数据迁移与初始管理员

新增 Flyway 后续迁移，不改写已执行的 `V1__m01_b.sql`。创建 `ha_enterprise` 并迁移已有企业 ID；`ha_project` 增加 `project_code` 和 `status`，增加企业内项目编码唯一索引；按现有行生成稳定编码并设为 `ACTIVE`。`ha_usage_record` 不复制租户字段，通过 Request 关联做授权过滤。

初始超级管理员由显式环境变量引导：`AUTH_BOOTSTRAP_ADMIN_USERNAME` 和 `AUTH_BOOTSTRAP_ADMIN_PASSWORD`。仅在数据库尚无平台管理员时创建一次，密码立即 BCrypt 编码；启动日志不输出凭据，绝不记录密码。密码变量不进入仓库，运维在首次启动后移除。没有管理员且未配置引导凭据时，应用启动失败并给出不含秘密的配置提示。初始账号角色为 `platform-admin`，企业 ID 为空。

后续普通企业用户由运维 CLI 创建：密码从交互式终端读取，不放在命令参数或日志中；CLI 校验企业、角色和项目成员关系后写入数据库。第一版不提供公开注册或用户管理页面。

JWT 密钥通过 `AUTH_JWT_HMAC_KEY` 注入，不提供仓库默认值；长度不足时启动失败。Docker Compose 只引用环境变量，不写入明文默认密码或签名密钥。

## 验证与完成条件

必须使用 MySQL 8 执行迁移与真实 HTTP 验证，并覆盖：BCrypt 登录成功/失败、账号锁定、缺失/过期/撤销 JWT、登出、超级管理员跨企业访问、企业用户跨企业 403、项目成员范围、无权限 403、`x-request-id`、项目列表、API Key 生命周期、Chat API Key 鉴权、Usage 租户过滤以及响应证据无 API Key/Bearer。Maven Build/Unit/Integration 测试通过后，使用前端 Mock 关闭的浏览器完成登录→项目→API Key→Chat→Usage。

当前项目列表数据库字段不全且无项目记录，联调使用独立的显式 SQL seed 项目，归属 enterprise 1；禁止在应用启动时静默写入业务样本。超级管理员跨企业创建项目使用新增 Contract 的可选 `enterpriseId` 字段。

## 需在 Contract Review 中确认的细节

- 登录错误统一为 401 还是使用前端 RuoYi 业务码；响应需保证错误消息不区分“用户不存在”和“密码错误”。
- `UsageSummary.executionResult`、`deliveryResult`、`billingResult` 目前只有 string 类型、没有取值语义；在定义获批前不得以新的伪造状态值填充。
- 超级管理员创建项目时的 `enterpriseId` 是可选字段，但对该角色实际必填；其他角色不得指定企业。

## 不在本次范围

密码重置、用户注册、企业切换、多因素认证、外部 IdP、Token Refresh、正式菜单/权限码管理、M02、Billing 和新 Provider。`CG-ENT-003` 的既有人工决策状态不因本设计自动改成已完成。
