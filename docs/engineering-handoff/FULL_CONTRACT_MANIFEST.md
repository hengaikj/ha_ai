# Full Contract Materialization Manifest

状态：`MATERIALIZATION_PENDING`

本清单锁定已批准 Engineering Handoff ZIP 中必须原样物化到 Git 的机器可读文件及 SHA-256。Agent 不得用摘要README替代这些文件，也不得自行重建其内容。

| 目标Git路径 | 来源文件 | SHA-256 |
|---|---|---|
| contracts/database/ha_mysql8_schema_candidate_v1.0.sql | database/ha_mysql8_schema_candidate_v1.0.sql | afb880e9a5d4fafd003672b7a54fb37b1fb6f4bb6cac9c6ced91b7460dbb816a |
| contracts/openapi/openai-compatible.yaml | api/openai-compatible.yaml | c682ebb991b7b9b66a1c831b96bcbbce903a661c8927da6b0c28a99640897ea5 |
| contracts/openapi/enterprise-management.yaml | api/enterprise-management.yaml | 01ee3aacad532bae1e4a42ac00eda20cf865ddc7c9454bb2805ebefccf7d16aa |
| contracts/openapi/platform-management.yaml | api/platform-management.yaml | b57dbdd844decb7f7cc6afdf1e2a0e5425db6c54edff8e4e582e60112f826604 |
| contracts/redis/redis-contract.yaml | redis/redis-contract.yaml | 7f61e77aa4570796d189dca8d17e17cc0e59fa31466648368a8e32679b6a3945 |
| contracts/testing/test-matrix.json | testing/test-matrix.json | 6d33b7bae21008297db9e49ce8552856226159b18a96548005ff0b464288f54f |
| contracts/testing/acceptance-mapping.json | testing/acceptance-mapping.json | 4f1ab1bbce1ea2c96fb98570ddb35accc196db691823e29ae1d1e4141ca0f486 |
| contracts/testing/integration-test-contract.json | integration/integration-test-contract.json | d795469470067c3b2cfedef74f3bd2363d740f8689179e63fdb891be82be997d |
| docs/engineering-handoff/requirements/requirements.json | requirements/requirements.json | 9627bbd5e028b7e4a1353eb266b11c32ed50c443513e2d2db2f31923575a6b75 |
| docs/engineering-handoff/quality/coverage-matrix.json | quality/coverage-matrix.json | a604244ce9bb81eebed8ea06db1a63e3c2ed70f44a1228e5fa96453170d47d2b |
| docs/engineering-handoff/quality/development-gate.json | quality/development-gate.json | 921a66b66fd4e35df8978d4d224a73b389532c669c688b187a6a3e0aae319f26 |

## Gate

只有目标文件全部存在且SHA-256逐项匹配后：
- `full_contract_materialized = true`
- Backend Agent 才能把“完整Contract缺失”解除；
- README或摘要契约不能作为替代。

## 来源

来源制品：`ha-ai-platform-engineering-handoff-v1.0-ready.zip`。
