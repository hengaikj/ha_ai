# PAGE-APIKEY-CREATE 创建API Key

字段：
- keyName：必填；
- expiresAt：可空。

成功后进入“Secret仅展示一次”状态。普通列表不得展示完整Secret，只显示keyPrefix。

Secret一次性展示：
- 明确提示离开后不可再次查看；
- 允许复制动作；
- 不将Secret写入截图、日志、错误追踪或普通页面状态；
- Design Screenshot使用明显虚构/遮罩样例，不使用真实Key。

错误：400/403/404/409/500按管理API统一模式处理并保留x-request-id。
