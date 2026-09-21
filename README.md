# HA AI 聚合服务平台

本仓库作为“智行官企业 AI 聚合服务平台”的测试开发仓库。

## 团队沟通语言规范

本项目团队统一使用**中文**进行工程协作，包括但不限于：

- Git Commit 提交说明使用中文；
- Pull Request 标题、描述、Review 意见使用中文；
- Issue 标题、内容、验收结论使用中文；
- 源码中的业务注释、复杂逻辑说明、TODO/FIXME 使用中文；
- 数据库表和字段必须使用中文 COMMENT；
- OpenAPI、接口字段 description、错误说明使用中文；
- 测试报告、部署说明、变更说明、开发交接材料使用中文。

Java 类名、方法名、变量名、Package、数据库字段名、API Path 等代码标识符继续使用规范英文，不使用拼音命名。

## 当前技术基线

- Java + Spring Boot + MyBatis-Plus
- MySQL 8
- Redis
- Java 根包：`com.hengaikj.ai`
- Maven/工程模块前缀：`ha-`
- 数据库表前缀：`ha_`
- Redis Namespace：`ha:{env}:`
- 金额、余额、额度、成本、结算、价格、费率：`DECIMAL(24,12)` / Java `BigDecimal`
- 数据库所有业务表、业务字段必须有中文注释

## 开发规则

正式业务规则以已批准 Engineering Handoff Baseline 为准。开发过程中发现需要改变 Requirement、Design 或 Technical Baseline 的内容时，必须先提出变更，不得静默修改。

当前第一开发里程碑为 M01：打通 Enterprise → Project → API Key → Model Policy → ProviderAdapter → OpenAI-compatible API 的真实垂直调用链。
