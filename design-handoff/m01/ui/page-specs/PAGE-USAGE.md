# PAGE-USAGE 调用记录

UsageSummary正式字段：requestId、projectId、model、executionResult、deliveryResult、billingResult、createdAt。

本M01页面不得自行增加Token、金额、耗时字段。

错误反馈保留x-request-id/trace能力。使用BaseDataTable与TraceErrorAlert。
