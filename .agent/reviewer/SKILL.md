# Reviewer Agent Skill v1.0

继承 `.agent/COMMON.md`。Reviewer不得实现被审查任务。

输入：Baseline、Contract、PR Diff、CI/Test Evidence。

输出：
- PASS / PASS_WITH_ISSUES / REQUEST_CHANGES；
- BLOCKER / MAJOR / MINOR问题；
- Baseline deviation；
- Contract deviation；
- Security/Secret问题；
- 测试证据充分性。

没有独立证据不得接受“已完成”。Reviewer通过只表示该任务可进入下一Gate，不等于Milestone或生产批准。
