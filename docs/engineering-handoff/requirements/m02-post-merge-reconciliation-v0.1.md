# M02 合并后状态对账 v0.1

状态：EVIDENCE RECORD / BASELINE AND CONTRACT APPROVED; IMPLEMENTATION FOLLOW-UP REQUIRED
日期：2026-09-23（Asia/Shanghai）
核对主线：`develop` `09b0353e9899b95c16a7e0b7720724785bad4223`

本文记录 M02-A、M02-B 合并后的代码与验证事实，并列出继续推进前的基线差异。它不是已批准的 M02 Requirement Baseline，不追认未签字的业务需求，也不授权新的 M02 实现。

## 已合并内容

| PR | 范围 | 合并提交 | 状态 |
| --- | --- | --- | --- |
| [#45](https://github.com/hengaikj/ha_ai/pull/45) | M02-A：RBAC 权限、角色与用户授权上下文 | `2d195035c36bf05e6969f1f62b81c109d092e225` | MERGED |
| [#46](https://github.com/hengaikj/ha_ai/pull/46) | M02-B：用户管理、角色绑定、企业范围及项目成员访问 | `4eb8882210c4e9e76e7a109a0ea108c2b27f1c84` | MERGED |
| [#47](https://github.com/hengaikj/ha_ai/pull/47) | 前端：后端任务中心未接入时关闭轮询 | `c5db6b7` | MERGED |
| [#49](https://github.com/hengaikj/ha_ai/pull/49) | 授权缺失组件 fail-closed | `158f317452821b3250447a43069b247eb8197065` | MERGED |
| [#50](https://github.com/hengaikj/ha_ai/pull/50) | API Key 状态变更先认证再查询 | `bd70341d50f740980810dafa899d1205a0b9b36f` | MERGED |
| [#51](https://github.com/hengaikj/ha_ai/pull/51) | ACTIVE 企业选项及 M02 安全边界修复 | `89aa6021c38d693d75e73225317b8c313b6e5018` | MERGED |
| [#52](https://github.com/hengaikj/ha_ai/pull/52) | M02 前端用户与角色管理 UI、`/api/auth/**` 适配与真实浏览器证据 | `69f8dc7f4360754023a6acdd2830cadf7f032e68` | MERGED |

PR #47 是前端开发行为修复；PR #52 已完成并合并 M02 用户与角色管理界面及真实 `/api/auth/**` 联调。M02 Baseline 仍需跨职能审批，合并事实不等同于 Requirement PASS。

## 主线验证证据

验证命令均针对合并主线及其对应运行实例复核；当前 `develop` 为 `09b0353e9899b95c16a7e0b7720724785bad4223`。

| 层级 | 命令或证据 | 结果 | 限制 |
| --- | --- | --- | --- |
| Backend | `mvn clean package` | PASS；83 tests，0 failures，0 errors，3 conditional skips；`BUILD SUCCESS` | 真实 MySQL/JWT HTTP 验收另存为独立证据 |
| Spring Context | `SpringContextStartupTest`（包含于上述构建） | PASS | 证明测试上下文启动，不等同于部署环境验收 |
| Frontend | `pnpm exec vue-tsc -b` | PASS，退出码 0 | 无 |
| Frontend | `pnpm run build` | PASS，退出码 0 | 有既有 Vue CSS 弃用、Rolldown 注释及大 chunk 警告 |
| Real MySQL HTTP | Backend runtime SHA `89aa6021c38d693d75e73225317b8c313b6e5018` | 真实 JWT/SecurityFilterChain/MySQL 验收 73/73 PASS，含 Request ID、数据库读回和安全扫描 | 正式 Baseline/Contract 签署仍待完成 |
| Live Frontend + Backend | PR #52 合并前后现有 5173/18080 环境的真实浏览器验收 | PASS（证据已记录） | 需由 Baseline Approval Checklist 完成跨职能签署；未启动第二套环境 |

### 2026-09-24 合并后运行实例复核

未启动第二套环境。当前单机运行实例为 Frontend `127.0.0.1:5173`、Backend Docker `127.0.0.1:18080`、真实 MySQL 8.4 与 Redis。Frontend Vite 进程来自 PR #52 工作树，`VITE_ENABLE_AI_MOCK=false`，代理目标为 `http://127.0.0.1:18080`；Frontend 根页面 HTTP 200。

PR #52 浏览器证据已覆盖用户查询/创建/启停、角色读取/绑定、企业选项、API Key 创建及一次性 Secret 展示、列表脱敏、disable/enable/revoke、Usage 页面。证据文件保存在本地 `output/playwright/pr52-*.png`，Secret 未写入截图或文档。

Backend 启动日志确认 RedisTemplate JSON serializer + JavaTimeModule、Tomcat 8080；`mvn clean package` 与前端 Vitest/build 证据已分别记录在 PR #51/#52。

## Baseline 差异

主线 [M02 Requirement Baseline v0.1 Draft](./requirement-baseline-m02-v0.1-draft.md) 仍是原始需求收集入口。用户已确认 IAM/RBAC 进入 M02、用户/角色管理必须提供界面、Laya 独立纳入 M02。本次更新的 [M02 Requirement Baseline v0.2 Candidate](./requirement-baseline-m02-v0.2-candidate.md) 已记录这些范围决定；Laya 细分需求与架构材料独立归档于 `requirements/laya/`。v0.2 仍是 DRAFT，优先级、Contract/技术验收责任及正式审批待完成，不代表既有实现已完成需求验收或授权新实现。

原文档分支 `docs/m02-laya-model-routing` 上的 Laya 路由候选已复制到本 PR 的独立文档目录，并将其过时的 v0.3 基线引用修订为 M02 v0.2 Candidate。范围虽已确认，API、数据库、部署或业务实现仍须通过各自 Contract/架构审批。

## 继续推进前的审批项

所有需要负责人选择的默认建议汇总于 [M02 Baseline Approval Checklist v0.1 Draft](./m02-baseline-approval-checklist-v0.1-draft.md)。

1. 产品、架构和交付负责人确认 [v0.2 Candidate](./requirement-baseline-m02-v0.2-candidate.md) 的优先级、每项验收条件与责任人。
2. 评审 [Frontend IAM 工作包](./m02-frontend-iam-work-package-v0.1-draft.md) 和 [Backend IAM 工作包](./m02-backend-iam-work-package-v0.1-draft.md)，确定页面范围、角色管理深度、平台管理员企业选项数据源、Contract、HTTP/迁移测试、责任人与真实浏览器验收。
3. 独立评审 [Laya 需求草案](./laya/m02-laya-routing-requirements-v0.1-draft.md) 与 [架构提案](./laya/m02-laya-routing-architecture-v0.2-proposal.md)，确定 Contract、隐私、失败策略、模型评估阈值、目标运行环境及发布 Gate。
4. 工作包当前是评审草案。完成正式基线审批后，再授权 Backend、Frontend、Integration 和 QA 实施；范围决定本身不作为 API、数据库、部署或业务实现授权。

## Evidence → Finding → Path

| Evidence | Finding | Path |
| --- | --- | --- |
| PR #45/#46/#49/#50/#51/#52/#57 已合并，`develop` 为 `09b0353` | M02 后端与前端 IAM 能力及证据文档已成为当前代码事实 | GitHub PR 页面及本文件“已合并内容” |
| Backend `mvn clean package` 全量结果 | 合并主线 Maven 构建通过；MySQL 专项验收被跳过 | 主线 worktree `backend/target/surefire-reports/` 与 Maven 输出 |
| Frontend 类型检查和构建退出码均为 0 | 合并主线前端可通过类型检查与生产构建 | 主线 worktree `frontend/` 构建输出 |
| PR #52 真实浏览器证据与合并后运行时复核 | 前端 IAM 联调已完成；正式 Baseline 审批及 Laya 技术细化仍待完成 | `docs/engineering-handoff/requirements/requirement-baseline-m02-v0.2-candidate.md`；`requirements/laya/` |
