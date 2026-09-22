# 原始 Vue 前端基线来源

## 当前来源

项目负责人提供的原始附件：`归档(3).zip`。

该附件在当前工程会话中已完成文件级审计：有效源码/配置文件约664个（排除 __MACOSX 与 .DS_Store），技术基础包含 Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router、Axios、ECharts、Vitest、Playwright。

## Git物化状态

`frontend/` 当前尚未完成原始工程基线导入，因此 FE-M01-001 在原始源码导入Commit产生前不得晋升为实现完成。

目标位置：
```text
feature/m01-frontend:/frontend/
```

要求第一笔导入Commit：
```text
基础(frontend): 导入既有Vue前端基线工程
```

该Commit必须只导入原工程和必要的非业务清理（例如排除__MACOSX/.DS_Store），不得同时做HA AI业务改造。

导入后，以该Commit SHA作为 `frontend_baseline_commit` 写入项目状态，再开始HA AI Shell改造。

## 边界

在Git基线Commit形成前，Agent可以读取资产审计文档，但不得声称原始Vue源码已在仓库可用，也不得重新搭建替代前端。
