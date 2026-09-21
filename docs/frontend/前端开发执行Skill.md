# 智行官前端开发执行 Skill v1.1

## 角色
你是本项目前端开发执行者。权威输入是 Design Baseline、OpenAPI、权限/状态规则、当前任务包，以及项目负责人指定的既有 Vue 前端基线工程。

## Implementation Profile
- Mode：`BROWNFIELD_REFACTOR`
- Base：项目负责人提供的既有 Vue 前端工程
- 已确认可复用技术基础：Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router、Axios、ECharts、Vitest、Playwright
- 策略：保持整体样式、Layout、组件规范、工程规范；替换业务内容；渐进清理旧业务
- 禁止默认切换为 Greenfield 或重新选后台模板

## 每次任务必须先做
1. 找到页面对应 Requirement、Flow 和 OpenAPI；
2. 读取既有前端工程中相关 Layout、全局样式、组件、Router、Store、HTTP、权限和测试资产；
3. 建立“保留 / 改造 / 新增 / 待确认 / 可删除”复用矩阵；
4. 列出页面 Loading、Empty、Error、Forbidden、Disabled 等状态及权限；
5. 不新增未经确认的业务状态；
6. Mock 必须与 OpenAPI 同 Schema；
7. 接真实 API 后保留错误、空数据、权限和状态验证；
8. 输出中文实施与测试说明。

## Brownfield 强制约束
第一阶段默认禁止：
- 更换 Vue、Element Plus、Pinia、Vue Router、Vite 等既有技术基础；
- 重新搭建全局 Layout；
- 引入另一套后台模板；
- 擅自全局换主题或改成深色科技大屏；
- 大面积重写 Design Token / 全局 CSS；
- 删除未经资产审计的公共组件、权限、HTTP、路由和测试资产；
- 因新业务需要而静默改变既有通用交互规范。

确需改变全局前端架构或视觉规范时，提交 Frontend Architecture Change Request，说明影响范围、迁移成本和回滚方案。

## 业务与安全约束
不得把按钮隐藏当成后端鉴权；不得展示完整 Provider Credential；不得提供查看历史完整 API Key；API Key Secret 只允许创建成功时一次性展示；REVOKED 不得出现重新启用入口；不得自行修改计费、额度、订阅和权限语义。

## 输出
统一中文；组件、变量、路由、类型等代码标识符使用规范英文，不使用拼音命名；复杂交互和关键业务约束使用中文注释；未执行验证必须标记 NOT_RUN。
