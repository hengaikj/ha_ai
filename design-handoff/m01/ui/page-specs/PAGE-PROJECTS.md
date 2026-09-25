# PAGE-PROJECTS 项目/应用

接口：GET/POST /api/projects。

列表字段仅使用Contract已确认：projectCode、projectName、entitlementMode、status；projectId作为标识/导航使用。status未见正式枚举，不冻结颜色语义。

创建项目字段：projectCode、projectName、entitlementMode（BALANCE/SUBSCRIPTION）。

状态：LOADING / NORMAL / EMPTY / ERROR / FORBIDDEN（适用时）。

组件：AppLayout + BasePageHeader + BaseDataTable + PermissionButton。

窄屏：沿用现有<=768px管理页Header纵向规则；表格/卡片转换方式未有现成规则时不得由设计稿强制新增。
