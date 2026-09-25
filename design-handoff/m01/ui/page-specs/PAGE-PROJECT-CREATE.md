# PAGE-PROJECT-CREATE 创建项目

呈现方式：沿用Element Plus Dialog/Drawer模式；最终选型以现有项目交互一致性为准。

字段严格来自Contract：
- projectCode：必填，企业内唯一项目编码；
- projectName：必填，项目名称；
- entitlementMode：必填，BALANCE / SUBSCRIPTION。

交互：
- 保存中按钮进入loading，防重复提交；
- 400显示字段/状态错误；
- 403显示无权限；
- 409显示重复业务键或状态冲突；
- 500进入统一错误反馈并保留x-request-id。

不得新增项目描述、负责人、预算、默认模型等当前Contract未定义字段。
