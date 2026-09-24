# M02 Frontend Integration Request v0.1

状态：COMPLETED / EVIDENCE RECORDED；BASELINE SIGN-OFF PENDING

基线：Backend `89aa6021c38d693d75e73225317b8c313b6e5018`；Frontend PR #52 merge `69f8dc7f4360754023a6acdd2830cadf7f032e68`

## 目标

在不修改 M01 已发布业务 Contract 的前提下，完成 M02 独立用户与角色管理界面，并与后端 `/api/auth/**` canonical API 对齐。M02 页面必须使用当前 `127.0.0.1:18080` 运行环境进行真实浏览器验收。

## 前端执行项

1. 盘点并停止新增旧 `/system/**`、`/api/users`、`/api/roles` 调用；M02 适配层统一指向已合并后端实际路径。
2. 用户页面支持查询、创建、启用/停用，并在响应与状态中排除 `password`、`password_hash`。
3. 角色页面支持角色目录读取和用户角色绑定；项目角色绑定必须被 UI 禁止，最终以服务端 403/业务拒绝为准。
4. 平台管理员企业选择只展示后端返回的 ACTIVE 企业，不在前端硬编码企业 ID。
5. 对 401、403、404、409 显示明确状态；权限不足时隐藏操作入口，但不能依赖隐藏替代后端鉴权。
6. 保持 `VITE_ENABLE_AI_MOCK=false`，不得以 mock 响应替代真实接口验收。

## 验收证据

提交以下内容后才可关闭前端工作包：

- `pnpm exec vue-tsc -b` 与 `pnpm run build` 日志。
- 浏览器页面截图、Network 导出或等价记录，包含用户查询/创建/状态、角色读取/绑定、企业选项。
- 每个请求的 method、URL、status、`x-request-id`，并记录 401/403/404 负例。
- 使用真实 JWT、当前 18080、真实 MySQL/Redis；不得启动第二套验收环境。
- 脱敏后的响应样本，证明没有密码、JWT、Bearer、API Key `secret` 或 `keyHash` 泄露。

## 完成门槛

前端 PR 必须基于 `89aa6021` 或其后端已审阅主线，列出实际调用路径与旧路径清理结果。仅有构建通过不能关闭工作包；必须同时提供真实浏览器 Network 证据。已由 PR #52 完成代码审查、测试、构建和真实浏览器验收，并合并至 develop。剩余动作是由 Frontend、Integration、QA 在 M02 Baseline Approval Checklist 上登记结论；本文不单独把 M02 Baseline 标记为 APPROVED。
