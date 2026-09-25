# M01 Low-Fi Wireframe Spec

## PAGE-PROJECTS
- 复用AppLayout。
- BasePageHeader：项目/应用。
- 主区：BaseDataTable。
- 行动作：进入项目详情。
- 状态：LOADING / NORMAL / EMPTY / ERROR / FORBIDDEN（适用时）。
- 移动/窄屏：先沿用现有表格与Layout行为，实际组件审计后确认，不预设转卡片。

## PAGE-PROJECT-DETAIL
- Header：项目名称与基础状态。
- 内容采用现有页面结构/Tab模式优先。
- M01入口：API Key、模型权限、调用记录。
- 不新增未经确认的项目业务状态。

## PAGE-API-KEYS
- Header + 创建入口 + BaseDataTable。
- 列表至少表达Key识别信息、状态及Baseline支持的操作。
- 创建成功后完整Secret只展示一次。
- 状态覆盖：LOADING / NORMAL / EMPTY / ERROR / FORBIDDEN + ENABLED / DISABLED / REVOKED / EXPIRED。
- REVOKED不设计重新启用入口。

## PAGE-MODEL-POLICY
- Header + 模型权限列表。
- 明确已授权/未授权视觉状态。
- PermissionButton只控制前端动作可见性/可操作性，后端仍为权限权威。

## PAGE-USAGE
- Header + 调用记录表。
- 以当前Contract能够提供的字段为准。
- x-request-id作为追溯入口之一。
- 不在原型阶段自行添加成本/计费字段。

## Platform Pages
PAGE-LOGICAL-MODELS / PAGE-PROVIDERS / PAGE-CHANNELS 均先采用 Header + Table + 标准状态结构；高保真前先核对各自正式Contract字段与允许动作。
