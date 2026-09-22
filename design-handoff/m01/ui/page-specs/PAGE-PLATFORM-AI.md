# 平台端 AI 页面

状态：DESIGN CANDIDATE / CONTRACT GAP IDENTIFIED。

已确认端点：
- PAGE-LOGICAL-MODELS：GET/POST /api/platform/models
- PAGE-PROVIDERS：GET/POST /api/platform/providers
- PAGE-CHANNELS：GET/POST /api/platform/channels

已确认权限：Model/Channel Operator。
已确认安全边界：Provider Credential不得通过普通查询接口返回明文。

## Contract Gap
当前 `platform-management.yaml` 的 components/schemas 没有 LogicalModelSummary、ProviderSummary、ChannelSummary 或相应创建DTO；其SuccessEnvelope.data也未绑定具体schema。因此现阶段无法从正式Contract冻结三页的表格列和创建表单字段。

## UI处理
可以冻结：AppLayout、BasePageHeader、BaseDataTable、PermissionButton、Loading/Empty/Error/Forbidden结构。
不得冻结：具体业务列、创建字段、Provider Credential展示、Channel路由配置字段。

结论：平台三页保持骨架Candidate，等待Contract补全，不用UI猜字段。
