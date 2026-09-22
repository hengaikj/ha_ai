# PAGE-API-KEYS API Key

接口：GET/POST /api/projects/{projectId}/api-keys；disable/enable/revoke动作端点。

列表字段：keyName、keyPrefix、status、expiresAt；apiKeyId作为标识。

创建字段：keyName、expiresAt（可空）。

状态枚举：ENABLED / DISABLED / REVOKED。当前Contract存在enable端点但未证明REVOKED允许enable，因此REVOKED不展示启用动作，保留DC-M01-001。

安全：完整Secret只允许创建成功时一次性展示；普通列表只展示keyPrefix。

组件：AppLayout + BasePageHeader + BaseDataTable + PermissionButton + BaseEmpty + TraceErrorAlert。
