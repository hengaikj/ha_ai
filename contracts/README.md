# Contracts

本目录保存前后端共同遵守的机器可读工程契约。

计划目录：
- `openapi/`：OpenAI-compatible、企业管理、平台运营接口契约；
- `database/`：MySQL 8 Schema / Migration；
- `redis/`：Redis Key 与运行态契约。

接口字段或语义变更必须先更新契约并完成影响分析，不得仅在前端或后端单边修改。
