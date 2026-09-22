# M01 Wave 1 启动核验与澄清

本次状态：实现已进入独立 Review 准备，但截图证据 BLOCKED、正式接口解码仍 CLARIFICATION_REQUIRED；不申请 Issue #18 验收。

## Git 与事实源

- 已有仓库，未重复 clone。启动时 main 工作区干净。
- 后续使用用户指定凭据完成 `git fetch --all --prune`（退出 0）及子分支 push；原始输出见 git-fetch-authenticated.txt、git-after-authenticated-fetch.txt。
- 已创建 Draft PR：https://github.com/hengaikj/ha_ai/pull/24（基底 feature/m01-frontend）；页面 Mock Slice 已实现，真实接口接线和截图仍待完成。
- 已在 Draft PR #24 增加 Project/API Key/Usage 页面端口、OpenAPI Mock 适配器和页面交互测试；页面继续复用 AppLayout、BasePageHeader、BaseDataTable、PermissionButton、BaseEmpty、TraceErrorAlert。
- 项目负责人已在远端提交原始品牌 SVG（Commit `57359be9b87254dae5d17a4322045810b59c9d36`）；已按该提交字节物化到本地并接入 AppLayout 的智行官 Header。
- `git fetch --all --prune` 返回 Empty reply from server；HTTP/1.1 重试也未完成同步。原始输出见 evidence/m01-wave1/。
- 通过 GitHub REST API 再次核对远端分支 SHA，与本地引用一致：
  - develop：fd664c64c406a22b06268be8679b1315b176f487
  - feature/m01-frontend：dbb9287e883da6570710b9ff31babcf006e059c4
  - design/m01-product-prototype：6bc64f198d76717e4669794c2ea647560d47477d
- 前端相对 develop：ahead 8 / behind 18。未 rebase、未 merge、未 force push。
- 从已核对前端 SHA 创建 feature/m01-frontend-wave1。
- 读取 develop 启动文档、前端执行 Skill、任务包、.project 状态及 Design Handoff Gate；读取 PR #14 分支的 ui 页面规格、组件映射、Token、资源清单、实施说明和 review 文件。
- 已读取 Issue #15、#17 正文与评论。Issue #17 明确授权 Wave 1 实现，Candidate 本身不作为阻止实现的理由。Platform Contract 收敛不阻塞企业端。

## Issue #15：品牌字节已物化，源文件证据仍待归档

远端已提供负责人确认的原始品牌资产（上传文件名 `V1独立图形-彩色(6).svg`），并在 Commit `57359be9b87254dae5d17a4322045810b59c9d36` 物化。该提交文件通过 GitHub Contents API 下载到本地，未修改字节；当前本地目标 SHA-256 为 `d4abd5e7602ba81090f6f9219dac015ae0092d1c9edef6b583d5b0611f9475c3`。

SOURCE_SHA256 = d4abd5e7602ba81090f6f9219dac015ae0092d1c9edef6b583d5b0611f9475c3（负责人评论提供）
TARGET_SHA256 = d4abd5e7602ba81090f6f9219dac015ae0092d1c9edef6b583d5b0611f9475c3
HASH_MATCH = true

实际引用位置：`frontend/src/layouts/AppLayout.vue` 的智行官 Header 分支。Sidebar/Header 仍等待远端分支同步后由 Reviewer 检查。

## Issue #17：企业端 Contract 澄清

以下缺口仅阻塞依赖它们的正式数据/权限接线，不否认页面字段、组件和状态布局可先实现。

| 编号 | 证据 | 受影响范围与所需输入 |
| --- | --- | --- |
| FE-W1-001 | enterprise-management.yaml 的 GET /api/projects、GET /api/projects/{projectId}/api-keys、GET /api/usage 均仅引用 SuccessEnvelope；components.schemas.SuccessEnvelope.data 没有 type 或 $ref | 明确列表 data 是数组还是分页对象，并关联已存在的 Summary Schema；不得用前端 Mock 冻结响应结构 |
| FE-W1-002 | POST /api/projects/{projectId}/api-keys 的 200 同样仅引用 SuccessEnvelope；ApiKeySummary 只有 apiKeyId/keyName/keyPrefix/status/expiresAt | 明确创建成功响应及一次性完整 Secret 的准确字段名、位置；不能自行假设 secret/apiKey/key 等字段 |
| FE-W1-003 | OpenAPI 只有中文角色/项目范围说明；PermissionButton 调用 authStore.hasPermission(permission)，现有权限机制使用字符串权限码；资产改造清单明确禁止自行发明新权限码 | 给出项目创建、Key 创建/启禁用/撤销及路由的正式权限映射和上下文来源；不得沿用 public 路由作为正式鉴权 |

HTTP 技术适配事项（不要求重定义 Contract）：现有 api/http.ts 的 request() 要求 code/message/data，管理契约使用 success/requestId/data。后续应在现有 HTTP 层上增加管理 API 适配，保留认证、401 处理和 x-request-id；不修改全局旧响应语义。

## 已有实现风险与复用结论

- AiShellPage.vue 是独立 Header/Sidebar，未复用 AppLayout；项目/Key 保存在页面 ref，所有项目共用 keys，创建操作未走 Transport。这些是当前基线现状，不是本次实现。
- router/index.ts 的 /ai 入口为 public。正式接线需要去除公开访问并遵循已有 Auth/Router/Menu 机制。
- KEEP：AppLayout、BasePageHeader、BaseDataTable（内置 BaseEmpty）、PermissionButton、TraceErrorAlert、Element Plus、global.css、Router、Store、HTTP。
- ADAPT：AiShellPage/AiPlaceholderPage 的业务页面接线及管理 API 响应适配。
- UNKNOWN：Secret 创建响应、列表响应结构、权限码映射、原始品牌资产。
- 未删除公共组件，未改业务 Contract，未扩展 Billing/Payment/Platform。
- Mock 与真实 HTTP Transport 已分开：`src/api/ai/mock.ts` 只在 `VITE_ENABLE_AI_MOCK=true` 时使用；`src/api/ai/http.ts` 没有在缺少正式解码器时猜测 array/items/records 或 Secret 字段，而是返回 `CONTRACT_PENDING`。
- Mock Key 列表仅有 `keyPrefix`；Secret 只在创建成功的页面状态中短暂存在，路由变化/卸载/刷新后清空；REVOKED 没有任何启用动作。

## NOT_FOUND

- develop: docs/开发协作规范.md（启动文档引用，但文件不存在）。
- develop: contracts/openapi/enterprise-management.yaml（前端分支有候选文件）。
- feature/m01-frontend 初始基线中未包含品牌目标文件；负责人提交 57359be9 后已物化到本地。
- 本地环境未直接取得原始上传文件名 `V1独立图形-彩色(6).svg`，源 SHA 采用负责人 Issue 评论提供的证据。

## 验证

初次 pnpm 调用在 Corepack 启动阶段退出 1（Cannot find matching keyid），随后显式调用锁定版本解决：`COREPACK_DEFAULT_TO_LATEST=0 corepack pnpm@9.15.4 install --frozen-lockfile` 成功。未禁用签名校验、未改依赖锁文件。

| 项目 | 命令（前缀均为 COREPACK_DEFAULT_TO_LATEST=0 corepack pnpm@9.15.4） | 退出码 | 结果 |
| --- | --- | --- | --- |
| Build | run build | 0 | PASS（既有基线，非 Wave 1 完成证明） |
| 原 Type Check | run type-check（vue-tsc --noEmit） | 0 | 不能作为完整类型检查证据：根配置 files=[]，依赖 references |
| 修正后 Type Check | run type-check（vue-tsc -b --force） | 0 | PASS（独立执行） |
| Vitest | run test | 0 | PASS，4 文件、8 测试（既有测试） |

独立 type-check 已改为 `vue-tsc -b --force`，明确遍历并重新检查 app/node 项目引用。没有以 Build 成功替代独立类型检查。Build 存在较大 chunk 和第三方 PURE 注释警告，未修改旧业务依赖。

Issue 回报已发送：
- https://github.com/hengaikj/ha_ai/issues/15#issuecomment-5771689727
- https://github.com/hengaikj/ha_ai/issues/17#issuecomment-5771689851

本地凭据文件 docs/.git_env 仅用于授权请求，已加入本仓库本地 exclude，不提交凭据。

## Wave 1 实现验证

- Vitest：`pnpm test` 退出 0，5 个文件、12 个测试通过（包含 Mock 端口的项目隔离、一次性 Secret、REVOKED、409 和 Contract Pending 测试）。
- Type Check：`pnpm run type-check` 退出 0，命令为 `vue-tsc -b --force`。
- Build：`pnpm run build` 退出 0。
- ESLint：目标文件 0 errors、4 个既有格式规则 warnings。
- Playwright：已执行 `playwright test --config=playwright.ai.config.ts`，退出 1；Chromium 无法加载（系统 libc 不满足 GLIBC_2.18/2.25），系统 Firefox 115 也无法建立 Juggler 通道。详细原始输出见测试结果目录和命令日志。因此截图与 Playwright 交互证据均 NOT_RUN，不把浏览器启动失败写成页面失败。

截图：1440×900 / 1366×768 / 768×1024 = NOT_RUN（浏览器运行时不兼容，未制造替代截图）。

CONTRACT_CHECK = CLARIFICATION_REQUIRED（页面 Mock 字段核对通过；真实响应解码待 FE-W1-001/002/003）
BASELINE_DEVIATION = 本次新增核验记录并修正独立类型检查命令，无业务或视觉基线修改
HUMAN_DECISION_REQUIRED = Contract Owner 补齐 FE-W1-001/002/003；项目负责人提供原始 SVG 来源

完成上述依赖与实现、真实验证后，再交 Issue #18 独立 Reviewer。
