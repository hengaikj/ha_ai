# M01 UI → Frontend 实施说明

## 必须KEEP
- AppLayout
- SidebarMenuItem
- BasePageHeader
- BaseDataTable
- PermissionButton
- BaseEmpty
- TraceErrorAlert
- global.css既有Token
- Element Plus

## 必须ADAPT
当前AiShellPage/AiPlaceholderPage只是临时Shell，应替换为正式业务页面，但不要另造第二套Layout。

## Logo
正式实现必须把项目负责人提供的原始 `V1独立图形-彩色(5).svg` 放入前端品牌资源目录并直接引用。图片生成稿中的Logo仅用于布局示意，不能作为资源提取来源。

## 禁止
- 深色侧栏重做；
- 全局换主题；
- 重新设计控件高度/圆角体系；
- 把表格/按钮切成图片；
- 根据效果图新增OpenAPI不存在的字段；
- 暴露Provider Credential；
- 用生成式近似Logo替代原始SVG。

## 验证
前端实现后使用现有Build/Vitest/Type Check，并增加固定Viewport截图供UI Reviewer对照；视觉Review不能替代功能与Contract测试。
