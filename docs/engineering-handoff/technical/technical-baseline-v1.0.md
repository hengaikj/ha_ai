# Technical Baseline v1.0

状态：APPROVED

- Java + Spring Boot + MyBatis-Plus
- MySQL 8 为权益/计费/Ledger最终权威
- Redis 为可重建运行态投影、缓存和控制状态
- Greenfield自研；new-api、Higress、LiteLLM、Cloudflare AI Gateway、RuoYi-Vue-Plus、Jeepay均为REFERENCE ONLY
- 工程/模块前缀：ha-
- Java根包：com.hengaikj.ai
- 表前缀：ha_
- Redis命名空间：ha:{env}:
- 金额/余额/额度/成本/结算/价格/费率：DECIMAL(24,12)，Java BigDecimal
- Token：BIGINT/Long
- 数据库业务表和字段必须有中文COMMENT
- Request、RoutingAttempt、Usage/Cost Evidence、ChargeComponent、BillingSettlement、Ledger分层
- API Key完整Secret仅创建时展示一次；Provider Credential不得向企业暴露明文
- RoundingMode.HALF_UP；ChargeComponent高精度计算后定标12位；Settlement汇总定标Charge；Ledger使用权威定标金额
