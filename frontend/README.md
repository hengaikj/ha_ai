# 北汽收益与成本管理系统前端

## 1. 当前范围

当前前端只完成 F1 基础工程骨架：

1. Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router、Axios。
2. 登录页、后台基础布局、工作台空壳页、403、404。
3. 请求封装、Token 注入、写接口幂等键、统一业务错误处理。
4. 当前用户、菜单、按钮权限的基础状态管理。
5. 基础展示组件和关键单元测试。

暂不实现业务 CRUD、看板、图表、外部同步、复杂成本分析和上会模板。

## 2. 环境变量

复制 `.env.example` 为本地环境文件后按需调整：

```bash
cp .env.example .env.development
```

| 变量                          | 说明                         | 本地默认                 |
| ----------------------------- | ---------------------------- | ------------------------ |
| `VITE_APP_TITLE`              | 浏览器标题和系统名称         | `北汽收益与成本管理系统` |
| `VITE_API_BASE_URL`           | 前端请求基础路径             | `/api`                   |
| `VITE_API_PROXY_TARGET`       | Vite 本地代理目标            | `http://localhost:8080`  |
| `VITE_ENABLE_MOCK`            | 是否启用 Mock                | `false`                  |
| `VITE_ENABLE_COMMITTEE_MOCK`  | 是否启用产品委员会独立 Mock  | `false`                  |

约束：前端不得使用 Mock 结果冒充联调通过，不得绕过 Gateway 直连 `app-service`。

页面标签栏和页面级全屏开关由“系统管理 → 参数设置”维护，不再从 `.env` 读取。请创建以下参数（参数值使用字符串 `true` 或 `false`）：

| 参数名称         | 参数键名                       | 默认值  |
| ---------------- | ------------------------------ | ------- |
| 页面多标签栏开关 | `VITE_ENABLE_TAGS_VIEW`        | `false` |
| 页面级全屏开关   | `VITE_ENABLE_PAGE_FULLSCREEN`  | `true`  |

本地仅验证 UI 时可临时开启 Mock：

```bash
VITE_ENABLE_MOCK=true pnpm dev
```

Mock 只覆盖登录、当前用户、菜单和系统管理页面基础数据，默认关闭；真实联调和验收必须关闭 Mock，并通过 Gateway 访问后端接口。

产品委员会页面可单独开启 `VITE_ENABLE_COMMITTEE_MOCK=true` 使用页面级 Mock 数据，不依赖 `VITE_ENABLE_MOCK`。

## 3. 常用命令

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm format
pnpm build
```

本地开发默认访问：

```text
http://127.0.0.1:5173
```

后端接口文档：

```text
http://localhost:8080/swagger-ui.html
```

## 4. 当前已对齐接口

| 能力         | 方法   | 路径                |
| ------------ | ------ | ------------------- |
| 验证码       | `GET`  | `/api/captchaImage` |
| 登录         | `POST` | `/login`            |
| 退出         | `POST` | `/logout`           |
| 当前用户     | `GET`  | `/getInfo`          |
| 当前用户菜单 | `GET`  | `/getRouters`       |

开发和部署环境统一通过 `VITE_API_BASE_URL=/api` 转发到 Gateway；代理会移除 `/api` 前缀，避免后端根路径 `/login` 与前端登录路由冲突。

## 5. 质量门禁

提交前至少执行：

```bash
pnpm test
pnpm lint
pnpm format
pnpm build
```

如果涉及接口路径、DTO 或权限判断变更，必须同步补充测试并更新相关中文文档。
