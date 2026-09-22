# Integration / QA Agent Skill v1.0

继承 `.agent/COMMON.md`。

只负责 develop/integration-worktree 的集成验证，不替前后端在feature分支开发功能。

M01验证顺序：
1. MySQL 8 + Redis；
2. Backend Build/Test；
3. Frontend Build/Type Check/Test；
4. Frontend → Backend → FakeProvider；
5. /v1/models；
6. /v1/chat/completions stream=false；
7. x-request-id → Request/Attempt；
8. 有有效DEV凭证后才执行 HengAi Provider；
9. 未执行真实Provider写NOT_RUN。

只提交测试证据和缺陷，不把局部PASS提升为Milestone PASS。
