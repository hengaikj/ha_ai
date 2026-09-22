# M01 Wave 1 启动核验与澄清

本次状态：CLARIFICATION_REQUIRED。不是实现完成报告，不申请 Issue #18 验收。

## Git 与事实源

- 已有仓库，未重复 clone。启动时 main 工作区干净。
- `git fetch --all --prune` 返回 Empty reply from server；HTTP/1.1 重试也未完成同步。原始输出见 evidence/m01-wave1/。
- 通过 GitHub REST API 再次核对远端分支 SHA，与本地引用一致：
  - develop：fd664c64c406a22b06268be8679b1315b176f487
  - feature/m01-frontend：dbb9287e883da6570710b9ff31babcf006e059c4
  - design/m01-product-prototype：6bc64f198d76717e4669794c2ea647560d47477d
- 前端相对 develop：ahead 8 / behind 18。未 rebase、未 merge、未 force push。
- 从已核对前端 SHA 创建 feature/m01-frontend-wave1。
- 读取 develop 启动文档、前端执行 Skill、任务包、.project 状态及 Design Handoff Gate；读取 PR #14 分支的 ui 页面规格、组件映射、Token、资源清单、实施说明和 review 文件。
- 已读取 Issue #15、#17 正文与评论。Issue #17 明确授权 Wave 1 实现，Candidate 本身不作为阻止实现的理由。Platform Contract 收敛不阻塞企业端。

## Issue #15：BLOCKED_SOURCE_FILE

指定源文件 `V1独立图形-彩色(5).svg` 在本次本地检索中 NOT_FOUND；指定目标文件在前端分支 NOT_FOUND。相邻项目有不带 `(5)` 的同名近似文件，但没有证据证明它们就是指定原件，因此未复制。

SOURCE_SHA256 = NOT_AVAILABLE
TARGET_SHA256 = NOT_AVAILABLE
HASH_MATCH = NOT_RUN

需要原始文件字节的可访问位置；不得从效果图或其他项目品牌资产推定相同。

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

## NOT_FOUND

- develop: docs/开发协作规范.md（启动文档引用，但文件不存在）。
- develop: contracts/openapi/enterprise-management.yaml（前端分支有候选文件）。
- feature/m01-frontend: frontend/src/assets/brand/zhixingguan-logo.svg。
- 指定原件 V1独立图形-彩色(5).svg。

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

截图：1440×900 / 1366×768 / 768×1024 均 NOT_RUN，尚未运行页面，未制造替代截图。

CONTRACT_CHECK = CLARIFICATION_REQUIRED
BASELINE_DEVIATION = 本次新增核验记录并修正独立类型检查命令，无业务或视觉基线修改
HUMAN_DECISION_REQUIRED = Contract Owner 补齐 FE-W1-001/002/003；项目负责人提供原始 SVG 来源

完成上述依赖与实现、真实验证后，再交 Issue #18 独立 Reviewer。
