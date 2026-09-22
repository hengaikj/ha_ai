# 多 Agent 编排入口

同一个Session中由 Orchestrator 读取本目录状态并分派 Agent。

推荐总控指令：
```text
请先读取 .agent/COMMON.md、.agent/orchestrator/SKILL.md 和 .project/*.yaml，
严格按 task-board.yaml 的依赖关系推进。
可并行任务并行执行；每个任务必须以Git/PR/CI/Test Evidence作为完成依据。
遇到 HUMAN_DECISION_REQUIRED 停止自动晋升并请求项目负责人确认。
```

状态文件是编排事实源，但不得由开发Agent自行把自己从FAILED/IN_PROGRESS改成VERIFIED；状态晋升由Orchestrator依据Reviewer/Integration证据执行。
