# M01 Delivery Evidence v1.0

日期：2026-09-23（Asia/Shanghai）
对应 RC：`79fc320492427fc3fbf8c502ecff42621815f14e`
分支：`develop`

## 证据结论

M01 的 Requirement、Contract、Backend、Frontend 和 Integration Gate 已通过。本文索引代码、构建、测试、运行环境和历史联调材料，供 Release Candidate 复核。

## 代码与 PR

| 项目 | 证据 |
| --- | --- |
| RC 分支 | `develop` |
| RC Commit | `79fc320492427fc3fbf8c502ecff42621815f14e` |
| PR #43 | MERGED |
| PR #44 | MERGED |
| 远端分支 | `origin/develop` 与本地 RC Commit 一致 |

## 构建与测试

后端在当前 RC Commit 执行：

```text
cd backend
mvn test package
```

结果：退出码 `0`，`BUILD SUCCESS`；共运行 58 个测试，失败 0，错误 0，跳过 2 个。测试集合包含 `SpringContextStartupTest`、Redis/Spring 上下文装配、API Key、Usage、认证、项目管理、网关和权限范围测试。

前端在当前 RC Commit 执行：

```text
cd frontend
pnpm exec vue-tsc -b
pnpm run build
```

结果：两个命令均退出码 `0`。Vite 构建成功；输出中的 `::v-deep`、大 chunk 和第三方 `#__PURE__` 注释属于既有构建告警，不改变构建结果。

## 真实运行环境

复核时保留已有实例：

- Frontend：`http://127.0.0.1:5173`
- Backend：`http://127.0.0.1:18080`
- MySQL：`127.0.0.1:3306`
- Redis：`127.0.0.1:6379`
- `VITE_ENABLE_AI_MOCK=false`
- Vite `/api` proxy：`http://127.0.0.1:18080`

Docker 状态复核显示 `ha-ai-backend`、`ha-ai-mysql`、`ha-ai-redis` 均为运行中。未重新部署第二套测试环境。

## HTTP 与浏览器证据

此前真实联调已覆盖 API Key 创建、列表、状态操作、Chat/Gateway 和 Usage 持久化；Secret 仅在创建响应中返回一次，列表不返回 Secret 或 `keyHash`。请求均通过真实 HTTP transport，未启用 AI Mock。

已保存材料：

- [前端真实联调报告](../../../output/playwright/frontend-live-integration.md)
- [前端登录页 Network 截图](../../../output/playwright/frontend-live-login.png)
- [前端页面快照](../../../output/playwright/frontend-live-login-snapshot.txt)
- [M01 当前联调证据](../../../output/playwright/frontend-m01-integration-evidence.md)
- [M01 联调报告](../../../output/playwright/m01-frontend-integration-report.md)
- [当前前端验证记录](../../../output/playwright/frontend-verify-current.md)

历史报告中的 404/502 是早期 Backend 未更新或未启动时的阻塞记录，不能覆盖当前 RC Gate 结论；它们保留用于审计时间线。

## 敏感信息与证据边界

本文不保存真实 API Key Secret、JWT、密码或完整 Authorization 值。Request ID、日志和截图只作为脱敏后的定位证据使用。真实运行环境中的密钥继续由本地环境变量和 Compose 配置管理。

未在本文复制完整后端日志；可按 RC Commit 和运行实例使用 `docker logs ha-ai-backend` 复核。`docs/` 与 `output/` 中的既有证据文件保持原样。

## Evidence -> Finding -> Path

| Evidence | Finding | Path |
| --- | --- | --- |
| `mvn test package` 退出码 0，58 tests | Backend 构建、Spring Context 和核心 HTTP 测试通过 | `backend/` |
| `vue-tsc -b`、`pnpm run build` 退出码 0 | Frontend 类型检查和生产构建通过 | `frontend/` |
| 已有真实 HTTP/浏览器记录 | M01 API Key、Usage、Gateway 联调通过 | `output/playwright/` |
| `docker ps` 显示三项服务运行 | RC 使用单机 MySQL/Redis/Backend 实例 | Docker Compose |
| RC Commit 与 `origin/develop` 一致 | 交付内容可由固定 Commit 重现 | `79fc320492427fc3fbf8c502ecff42621815f14e` |
