# 平台端 AI 页面

状态：DESIGN CANDIDATE / CG-UI-001 STATIC RESOLVED。

Contract来源：`feature/m01-frontend` Commit `dbb9287e883da6570710b9ff31babcf006e059c4`。后续应收敛到正式Contract/develop。

## PAGE-LOGICAL-MODELS
接口：GET/POST /api/platform/models。

列表字段可冻结：
- logicalModelId
- modelCode
- modelName
- capabilities
- status：ENABLED / DISABLED
- createdAt
- updatedAt

创建字段：
- modelCode（必填）
- modelName（必填）
- capabilities（可选对象）
- status（可选，默认ENABLED）

## PAGE-PROVIDERS
接口：GET/POST /api/platform/providers。

列表字段：
- providerId
- providerCode
- providerName
- adapterCode
- status：ENABLED / DISABLED
- createdAt
- updatedAt

创建字段：
- providerCode
- providerName
- adapterCode
- status（可选，默认ENABLED）

普通响应不包含Credential明文。

## PAGE-CHANNELS
接口：GET/POST /api/platform/channels。

列表字段：
- channelId
- providerId
- channelCode
- channelName
- endpoint
- credentialRef（引用，不是凭证明文）
- priority
- weight
- status：ENABLED / DISABLED
- version
- createdAt
- updatedAt

创建字段：
- providerId
- channelCode
- channelName
- endpoint
- credentialRef
- priority（默认0）
- weight（默认100）
- status（默认ENABLED）

## 组件
三页复用AppLayout + BasePageHeader + BaseDataTable + PermissionButton。权限：Model/Channel Operator。

## Gate
字段缺失阻塞已解除；OpenAPI lint目前只有Issue报告，尚缺完整原始输出证据，因此正式Design Baseline仍需Contract收敛与Gate复核。
