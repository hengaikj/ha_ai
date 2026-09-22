# Monorepo 与共享开发机规范

## 目标
前端、后端位于同一台真实开发机时，统一采用单仓库 Monorepo + Git Worktree + 独立进程/目录的方式协作。

## 仓库目录
```text
ha_ai/
├── backend/
├── frontend/
├── contracts/
│   ├── openapi/
│   ├── database/
│   └── redis/
├── docs/
├── deploy/
│   └── docker/
└── scripts/
```

- `backend/`：Java/Spring Boot 后端。
- `frontend/`：既有 Vue 工程渐进改造。
- `contracts/`：前后端共同遵守的机器可读契约。
- `docs/`：Baseline、开发规范、任务与证据。
- `deploy/`：本地/测试部署资产。
- `scripts/`：统一启动、停止、验证脚本。

## 同机工作目录
禁止前后端共用同一个 checkout 反复切分支。推荐：
```text
/workspace/ha-ai/
├── backend-worktree/      -> feature/m01-slice01
├── frontend-worktree/     -> feature/m01-frontend
└── integration-worktree/  -> develop
```

## 端口建议
- 前端 Vite：5173
- 后端 Spring Boot：8080
- MySQL 8：3306
- Redis：6379

端口冲突时允许环境配置调整，但不得把个人机器地址硬编码进源码。

## 联调层级
1. 前端个人开发：OpenAPI Mock。
2. 后端个人开发：FakeProvider。
3. develop 集成：前端 → 真实后端 → FakeProvider。
4. DEV E2E：前端 → 真实后端 → HengAi Provider。

## 语言
Commit、PR、Issue、Review、业务注释、测试/部署/变更说明统一中文；代码标识符使用规范英文。
