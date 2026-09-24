# M02 Baseline Approval Checklist v0.1 Draft

状态：DRAFT / OWNER DEFAULTS CONFIRMED; AWAITING CROSS-FUNCTIONAL BASELINE APPROVAL

基线候选：[M02 Requirement Baseline v0.2 Candidate](./requirement-baseline-m02-v0.2-candidate.md)

本清单把已确认的范围和仍需决策的默认建议压缩为一次审批入口。勾选/回复前保持 DRAFT；任何代码、数据库、API 或部署实现均需正式 Baseline/Contract 审批后授权。

## 已确认范围

| 决定 | 状态 | 证据 |
| --- | --- | --- |
| M02-A/B IAM/RBAC 进入 M02 Requirement 分母 | CONFIRMED | 用户在本任务中明确“进入” |
| 用户与角色管理必须有前端界面 | CONFIRMED | 用户在本任务中明确“要求有界面” |
| Laya 语义模型路由进入 M02，独立工作流 | CONFIRMED | 用户在本任务中明确“单独纳入” |

## 待批准的默认建议

回复本表的选择，或在审批记录中给出替代决定。

| ID | 决策 | 建议默认值 | 当前状态 |
| --- | --- | --- | --- |
| DEC-M02-01 | 优先级 | IAM/RBAC + 管理界面 P0；Laya P1 独立评估，生产启用另设 Gate | CONFIRMED BY OWNER（“按建议推进”，2026-09-23） |
| DEC-M02-02 | IAM canonical API | 保留 Backend 已实现 `/api/auth/**`，修订 M02 Contract；Frontend `baseURL=/api` 下请求相对 `/auth/**` | CONFIRMED BY OWNER（按建议采用；Contract 更新仍待评审） |
| DEC-M02-03 | 角色界面范围 | M02 提供角色目录读取与用户角色绑定；角色 CRUD、权限树、角色停用需另行定义 Requirement/API；用户与角色 UI 独立列为 M02-IAM-005 | CONFIRMED BY OWNER（按建议采用） |
| DEC-M02-04 | 平台管理员创建用户的企业选择 | 新增经授权的 ACTIVE 企业选项 API；后端仍校验企业状态；不硬编码企业 ID | CONFIRMED BY OWNER；PR #51 已实现、PR #52 已完成真实 UI 接入；Contract 签署待完成 |
| DEC-M02-05 | API/安全验收 | Permission Mapper 缺失时 fail-closed；在合并 SHA 上做真实 MySQL HTTP、迁移升级/幂等及跨企业负向验收 | CONFIRMED BY OWNER；PR #49/#50/#51 已合并，后端 73/73 真实 HTTP 与启动证据已记录；跨职能签署待完成 |
| DEC-M02-06 | Laya 首阶段 | 独立 Contract/隐私/模型质量/资源评审后做可关闭 POC；不默认生产启用或改变 M01 Contract | CONFIRMED BY OWNER（按建议采用；独立工作流） |

## 审批及实施 Gate

| 责任领域 | 审批人 | 状态 |
| --- | --- | --- |
| Product：目标、分母、优先级与角色 UI 深度 | TBD | PENDING |
| Architecture/Security：API 语义、fail-closed、Laya 边界/隐私/降级 | TBD | PENDING |
| Backend：Controller/DTO/迁移/真实 MySQL HTTP | PR #49/#50/#51 记录与 `/tmp/ha-ai-evidence/m02-real-http/89aa6021/` | EVIDENCE RECORDED；正式签署 PENDING |
| Frontend：页面和 API 对接/浏览器证据 | PR #52 代码审查评论 | EVIDENCE RECORDED；正式签署 PENDING |
| Integration/QA：端到端证据、发布和回滚门槛 | PR #52 浏览器证据与合并后复核 | EVIDENCE RECORDED；正式签署 PENDING |

## 当前证据对账（2026-09-24）

| 项目 | 当前事实 | 证据 |
| --- | --- | --- |
| 主线 | `develop` = `734a95f42da946c6088820cb634180ffa32e0074`；PR #52 merge = `69f8dc7f4360754023a6acdd2830cadf7f032e68` | GitHub PR #48/#52 |
| Backend 运行时 | `127.0.0.1:18080`；Spring 启动、RedisTemplate JSON + JavaTimeModule、Flyway、MySQL/Redis 正常 | `/tmp/ha-ai-evidence/backend-image-refresh`、`/tmp/ha-ai-evidence/m02-real-http/89aa6021/` |
| Frontend 运行时 | `127.0.0.1:5173`；`VITE_ENABLE_AI_MOCK=false`；Vite 代理指向 18080 | PR #52 浏览器 Network 与截图 |
| M02 IAM UI | 用户查询/创建/启停、角色读取/绑定、ACTIVE 企业选项已真实操作验证 | `output/playwright/pr52-m02-users-roles-active.png` |
| M01 AI 管理页 | API Key 创建、一次性 Secret、列表脱敏、disable/enable/revoke、Usage 已真实操作验证 | `output/playwright/pr52-ai-api-keys-*.png`、`pr52-ai-usage.png` |

以上是证据状态更新，不等同于 Baseline APPROVED；Product、Architecture/Security、Backend、Frontend、Integration、QA 仍需正式签署。

以上六项产品范围与推荐默认设计已按用户“按建议推进”及后续 UI 范围确认记录。Baseline 仍为 DRAFT：Product、Architecture/Security、Backend、Frontend、Integration 和 QA 的正式审批/签署尚未齐备；在审批完成前，不授权 M02 功能实现。审批后再更新 Baseline 与 Contract 版本，并按已批准的 [Backend 工作包](./m02-backend-iam-work-package-v0.1-draft.md)、[Frontend 工作包](./m02-frontend-iam-work-package-v0.1-draft.md) 和独立 Laya Gate 授权实施。
