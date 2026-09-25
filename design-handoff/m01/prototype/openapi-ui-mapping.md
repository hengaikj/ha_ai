# M01 OpenAPI → UI Mapping

状态：DRAFT。依据远端当前Contract核对。

## 项目
`GET/POST /api/projects`；创建字段为 projectCode、projectName、entitlementMode（BALANCE/SUBSCRIPTION）。ProjectSummary可展示 projectId、projectCode、projectName、entitlementMode、status。status当前未见枚举，不自行定义。

## 项目详情
`GET/PUT /api/projects/{projectId}`。当前Contract未完整限定详情data字段，高保真不得自行增加。

## API Key
`GET/POST /api/projects/{projectId}/api-keys`；disable/enable/revoke动作均有端点。创建字段 keyName、expiresAt。ApiKeySummary字段：apiKeyId、keyName、keyPrefix、status（ENABLED/DISABLED/REVOKED）、expiresAt。Contract存在enable端点，但当前证据未明确REVOKED能否enable，因此UI不推断。

## 模型权限
`GET/PUT /api/projects/{projectId}/models` 已确认。具体列表字段继续按完整Schema核对。

## 调用记录
UsageSummary：requestId、projectId、model、executionResult、deliveryResult、billingResult、createdAt。M01表格不自行增加Token、金额、耗时字段。

## 平台
已确认 `GET/POST /api/platform/models`、`providers`、`channels`；权限为Model/Channel Operator。Provider Credential不得通过普通查询返回明文。具体列表列继续从components schema核对。

## 通用
管理API明确400/401/403/404/409/500及x-request-id；正式页面开发包覆盖适用错误反馈。
