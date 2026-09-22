# M01 通用错误与权限状态

## 401
认证失效；遵循现有Auth/Router机制返回登录，不由业务页面自行实现第二套登录流程。

## 403
无权限或租户/项目数据范围越权。使用现有Forbidden/权限体系。

## 404
资源不存在。页面保留返回上级入口。

## 409
资源状态冲突、重复业务键或并发版本冲突。应保留用户输入并展示可理解错误，不自动重试写操作。

## 500
平台内部错误。使用TraceErrorAlert/统一错误反馈；展示可用于支持定位的x-request-id/trace信息，不暴露Secret。

## Empty
BaseDataTable/BaseEmpty。

## Loading
沿用现有Element Plus与BaseDataTable loading。
