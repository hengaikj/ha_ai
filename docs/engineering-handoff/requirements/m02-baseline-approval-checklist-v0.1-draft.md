# M02 Baseline Approval Checklist v0.1 Draft

状态：DRAFT / AWAITING OWNER DECISIONS

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
| DEC-M02-01 | 优先级 | IAM/RBAC + 管理界面 P0；Laya P1 独立评估，生产启用另设 Gate | PENDING |
| DEC-M02-02 | IAM canonical API | 保留 Backend 已实现 `/api/auth/**`，修订 M02 Contract；Frontend `baseURL=/api` 下请求相对 `/auth/**` | PENDING |
| DEC-M02-03 | 角色界面范围 | M02 提供角色目录读取与用户角色绑定；角色 CRUD、权限树、角色停用需另行定义 Requirement/API | PENDING |
| DEC-M02-04 | 平台管理员创建用户的企业选择 | 新增经授权的 ACTIVE 企业选项 API；后端仍校验企业状态；不硬编码企业 ID | PENDING |
| DEC-M02-05 | API/安全验收 | 修复或证明 Permission Mapper 缺失时 fail-closed；在合并 SHA 上做真实 MySQL HTTP、迁移升级/幂等及跨企业负向验收 | PENDING |
| DEC-M02-06 | Laya 首阶段 | 独立 Contract/隐私/模型质量/资源评审后做可关闭 POC；不默认生产启用或改变 M01 Contract | PENDING |

## 审批及实施 Gate

| 责任领域 | 审批人 | 状态 |
| --- | --- | --- |
| Product：目标、分母、优先级与角色 UI 深度 | TBD | PENDING |
| Architecture/Security：API 语义、fail-closed、Laya 边界/隐私/降级 | TBD | PENDING |
| Backend：Controller/DTO/迁移/真实 MySQL HTTP | TBD | PENDING |
| Frontend：页面和 API 对接/浏览器证据 | TBD | PENDING |
| Integration/QA：端到端证据、发布和回滚门槛 | TBD | PENDING |

完成以上决定后更新 Baseline 与 Contract 版本并记录签署；随后按已批准的 [Backend 工作包](./m02-backend-iam-work-package-v0.1-draft.md)、[Frontend 工作包](./m02-frontend-iam-work-package-v0.1-draft.md) 和独立 Laya Gate 授权实施。
