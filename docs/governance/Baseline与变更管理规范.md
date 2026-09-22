# Baseline 与变更管理规范

## 权威层级
Requirement Baseline 决定“做什么”；Design Baseline 决定“用户如何使用”；Technical Baseline 决定“工程边界与约束”；Engineering Handoff 将三者转换为开发输入。

## 开发时发现缺口
发现未定义事项时：
1. 停止把猜测写成正式规则；
2. 标记 UNKNOWN；
3. 判断是否只是实现细节；
4. 若影响 Requirement/Design/Technical Baseline，提交 Change Request；
5. 项目负责人确认后更新 Baseline；
6. 再继续实现。

## 禁止
- 为了页面方便新增业务状态；
- 为了代码方便改变计费、额度、权限规则；
- 把参考项目实现当成当前项目 Requirement；
- 用模拟测试替代真实环境通过结论；
- 静默修改 OpenAPI 或数据库语义。
