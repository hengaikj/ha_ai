# M02 API Contract v0.3

状态：APPROVED FOR IMPLEMENTATION / 2026-09-24

适用基线：M02 Requirement Baseline v0.2 Candidate

本 Contract 由 Product、Architecture/Security、Backend、Frontend、Integration 和 QA 在本次维护会话中逐项确认。它只定义 M02 IAM/RBAC 与管理界面的目标 Contract；实现、迁移和测试必须分别通过 feature 分支与 PR 验收。

## Canonical API

M02 用户与角色管理统一使用 `/api/auth/**`。旧的 `/api/users`、`/api/roles`、`/api/permissions` 路径不作为 M02 验收入口，也不得在新 UI 中继续使用。

所有成功响应使用：

```json
{"success":true,"requestId":"<id>","data":{}}
```

所有响应（包括 4xx/5xx）必须返回 `x-request-id`，错误使用稳定的 `error.type` 和 `error.code`，消息文本不作为前端分支协议。

## User API

| Method | Path | 语义 |
|---|---|---|
| GET | `/api/auth/users` | 按操作者授权范围分页查询用户；支持基础筛选 |
| POST | `/api/auth/users` | 创建用户；平台管理员必须选择 ACTIVE 企业 |
| POST | `/api/auth/users/{userId}/status` | 设置 `ACTIVE` 或 `DISABLED` |
| GET | `/api/auth/roles` | 返回当前操作者可绑定的角色目录 |
| GET | `/api/auth/enterprises/options` | 仅平台管理员可读，返回 ACTIVE 企业选项 |
| PUT | `/api/auth/users/{userId}/roles` | 全量替换用户全局角色绑定；允许空列表解绑 |

列表响应不得返回 `password`、`password_hash`、JWT、Bearer、API Key `secret` 或 `keyHash`。

## Authorization and invariants

- 权限不足返回 403；未认证返回 401；不存在资源返回 404；冲突返回 409；参数错误返回 400。
- 授权失败必须 fail-closed。
- 平台、企业和项目成员数据范围由 Backend 强制执行，UI 隐藏入口不能替代服务端授权。
- 禁止管理员停用自己；禁止停用最后一个 ACTIVE 平台管理员。
- 用户和角色变更必须写入审计事件。
- 项目角色只能通过项目成员关系管理，不能通过全局角色绑定绕过项目边界。

## Pagination and filtering

`GET /api/auth/users` 采用分页参数 `page`、`pageSize`，并支持经批准的基础筛选字段。正式实现必须在响应中返回总数和当前页数据；具体上限、默认值和筛选字段由 Backend 实现 PR 固化并以契约测试验证，不得静默改变字段语义。

## Laya boundary

Laya 作为 M02 独立、默认关闭的 POC，不新增生产对外 API，不改变 `/v1/**`、API Key、Usage 或 Provider Contract。Laya 只能从 Backend 生成的授权候选逻辑模型中选择；输入必须脱敏，决策需记录 Request ID、Decision ID、版本和 fallback 原因；异常或低置信度时仅回退到项目已授权默认模型，无合规默认模型则失败关闭。依赖、模型、镜像和 revision 必须固定并支持离线启动。

## Implementation gate

本文件是批准的 Contract，不代表所有条目已经实现。Backend、Frontend 和 Integration 必须分别提交 feature 分支、PR、测试和真实 HTTP/浏览器证据；任何未实现条目都必须在 PR 中明确列为待完成项，不能以旧测试或 Mock 证据宣称完成。
