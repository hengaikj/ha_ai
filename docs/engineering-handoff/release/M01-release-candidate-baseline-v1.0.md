# M01 Release Candidate Baseline v1.0

状态：FROZEN
冻结日期：2026-09-23（Asia/Shanghai）
基线分支：`develop`
基线 Commit：`79fc320492427fc3fbf8c502ecff42621815f14e`

## Gate 结论

M01 已由总控确认通过：

| Gate | 状态 |
| --- | --- |
| Requirement | PASS |
| Contract | PASS |
| Backend | PASS |
| Frontend | PASS |
| Integration | PASS |

PR #43 与 PR #44 已合并。此前 M01 相关的 PR #38、PR #39、PR #42 也已进入 `develop`，本文件以当前 `develop` 合并提交作为唯一 RC 代码基线。

## 冻结规则

本基线冻结后不再修改 M01 业务代码、API Contract、数据库语义或运行配置。任何后续修改必须：

1. 建立新的分支和 Change Request。
2. 说明对本基线的影响。
3. 重新执行受影响的 Requirement、Contract、Backend、Frontend 和 Integration Gate。
4. 形成新的候选基线，不覆盖本文件对应的 Commit。

## 运行基线

| 组件 | 地址或配置 |
| --- | --- |
| Frontend | `http://127.0.0.1:5173` |
| Backend | `http://127.0.0.1:18080` |
| MySQL | `127.0.0.1:3306` |
| Redis | `127.0.0.1:6379` |
| Frontend Mock | `VITE_ENABLE_AI_MOCK=false` |
| Vite API proxy | `/api` 转发到 `http://127.0.0.1:18080` |
| Compose backend | 容器 `8080` 映射到宿主机 `18080` |

RC 复核使用现有 Docker Compose 实例。未启动第二套环境，未替换现有 MySQL 或 Redis 数据卷。

## 范围边界

本 RC 覆盖 M01 已批准的 API Key、Usage、OpenAI-compatible Gateway、Provider evidence、持久化/缓存基础、前端真实 HTTP transport，以及正式 JWT 用户上下文和管理接口接入。

密码重置、用户注册、企业切换、多因素认证、外部 IdP、Token Refresh、正式菜单/权限码管理、Billing、新 Provider 扩展和生产部署配置不属于本 RC。它们必须进入后续 Requirement Baseline 或经批准的 Change Request。

## 关联证据

- [M01 交付证据索引](./M01-delivery-evidence-v1.0.md)
- [Requirement Baseline v1.1](../requirements/requirement-baseline-v1.1.md)
- [Integration Profile](../integration/integration-profile.json)
- [Coverage Matrix](../quality/coverage-matrix.json)
