# Database Contract

MySQL 8。表前缀 `ha_`。所有业务表/字段必须中文COMMENT。金额/余额/额度/成本/结算/价格/费率统一 `DECIMAL(24,12)`；Token使用BIGINT。MySQL是权益、计费、Ledger最终权威。

完整Schema来源：已批准 Engineering Handoff 中 `database/ha_mysql8_schema_candidate_v1.0.sql`。开发团队导入完整DDL时不得改变已批准语义。
