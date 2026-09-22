# Git 与 PR 规范

## 分支
- main：稳定主线
- develop：开发集成
- feature/*：功能开发
- fix/*：缺陷修复
- docs/*：工程文档

## Commit
统一中文，推荐：`类型(模块): 中文说明`。
示例：`功能(gateway): 增加 API Key 鉴权与 Redis 回源`。

## PR 必填
任务编号、Requirement/AC、实现内容、明确未实现、API/DB/配置变化、自动化测试、DEV验证、已知问题、Baseline偏离。

## 合并
构建、自动化测试、Contract检查、Secret检查及必要真实环境验证未通过，不得以“先合再说”替代 Gate。
