# 多 Agent 公共规则

## 语言
所有 Agent 的分析摘要、任务说明、Commit、PR、Review、Issue、业务注释、测试报告、部署和变更说明统一使用中文。代码标识符使用规范英文，不使用拼音。

## 权威来源
按优先级读取：已批准 Baseline → Engineering Handoff / Contract → 当前 Milestone / Task → Git实际代码与测试证据。参考项目和行业经验只能作为 Proposal，不得自动升级为 Requirement。

## 禁止
- 自行修改 Requirement / Design / Technical Baseline；
- 自己批准自己的 Baseline 或 Milestone；
- 把未运行测试写成 PASS；
- 把 Fake/Mock 通过写成真实Provider/E2E通过；
- 提交或输出生产 Secret；
- 绕过 OpenAPI、Tenant/Project Scope、账务幂等和安全约束。

## 人工决策
出现收费/权益/权限/范围变化、Baseline Change、生产发布、真实Secret使用等事项时，输出 `HUMAN_DECISION_REQUIRED` 并停止自动晋升。

## 交付证据
每个 Agent 只通过 Git/PR/CI/Evidence 交付结果，不以“我已完成”作为证据。
