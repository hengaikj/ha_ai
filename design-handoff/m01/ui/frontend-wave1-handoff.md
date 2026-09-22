# Frontend Wave 1 Handoff

状态：READY_FOR_FRONTEND_PREPARATION / NOT_DESIGN_BASELINE。

前端可先准备组件接线和Mock，但正式业务字段不得超出Page Specs。

## Wave 1
- PAGE-PROJECTS
- PAGE-PROJECT-CREATE
- PAGE-API-KEYS
- PAGE-APIKEY-CREATE
- PAGE-USAGE
- PAGE-ERROR-STATES

## 复用
AppLayout / BasePageHeader / BaseDataTable / PermissionButton / BaseEmpty / TraceErrorAlert / Element Plus / global.css。

## 暂停
- Platform三页具体业务列：等待Issue #16；
- 原始品牌SVG引用：等待Issue #15物化；
- REVOKED Key重新启用动作：等待DC-M01-001关闭。

## 前端不得做
- 根据效果图补字段；
- 重做Layout；
- 换主题；
- 自行定义项目status枚举；
- 在列表返回完整API Secret。
