SET NAMES utf8mb4;

CREATE TABLE ha_enterprise (
 enterprise_id BIGINT NOT NULL COMMENT '企业ID，企业租户唯一标识', enterprise_code VARCHAR(64) NOT NULL COMMENT '企业编码', enterprise_name VARCHAR(200) NOT NULL COMMENT '企业名称', status VARCHAR(32) NOT NULL COMMENT '企业状态：ENABLED-启用，DISABLED-禁用', version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (enterprise_id), UNIQUE KEY uk_enterprise_code (enterprise_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业租户主表';

CREATE TABLE ha_ai_project (
 project_id BIGINT NOT NULL COMMENT '项目/应用ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', project_code VARCHAR(64) NOT NULL COMMENT '企业内唯一项目编码', project_name VARCHAR(128) NOT NULL COMMENT '项目/应用名称', entitlement_mode VARCHAR(32) NOT NULL COMMENT '权益模式：BALANCE-预充值余额，SUBSCRIPTION-订阅', status VARCHAR(32) NOT NULL COMMENT '项目状态：ACTIVE-正常，QUOTA_EXHAUSTED-额度耗尽，SUBSCRIPTION_EXPIRED-订阅到期，DISABLED-禁用', version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (project_id), UNIQUE KEY uk_ai_project_code (enterprise_id,project_code), KEY idx_ai_project_enterprise_status (enterprise_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业AI项目/应用表';

CREATE TABLE ha_ai_api_key (
 api_key_id BIGINT NOT NULL COMMENT '企业API Key记录ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', project_id BIGINT NOT NULL COMMENT '所属项目/应用ID', key_name VARCHAR(128) NOT NULL COMMENT 'API Key名称', key_prefix VARCHAR(32) NOT NULL COMMENT 'API Key展示前缀，不包含完整密钥', key_hash VARCHAR(128) NOT NULL COMMENT 'API Key不可逆摘要，不保存完整明文', entitlement_mode VARCHAR(32) NOT NULL COMMENT '固定权益模式：BALANCE-预充值余额，SUBSCRIPTION-订阅', status VARCHAR(32) NOT NULL COMMENT '状态：ENABLED-启用，DISABLED-禁用，REVOKED-永久撤销', expires_at DATETIME(3) NULL COMMENT '可选过期时间', revoked_at DATETIME(3) NULL COMMENT '永久撤销时间', version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (api_key_id), UNIQUE KEY uk_ai_api_key_hash (key_hash), KEY idx_ai_api_key_project_status (project_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业项目API Key管理表';

CREATE TABLE ha_entitlement_account (
 account_id BIGINT NOT NULL COMMENT '权益账户ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', project_id BIGINT NOT NULL COMMENT '所属项目ID', entitlement_mode VARCHAR(32) NOT NULL COMMENT '权益模式：BALANCE-预充值余额，SUBSCRIPTION-订阅', available_amount DECIMAL(24,12) NOT NULL DEFAULT 0 COMMENT '当前可用权益金额投影，精度12位小数，最终事实以账本为准', currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种代码', status VARCHAR(32) NOT NULL COMMENT '状态：ACTIVE-正常，EXHAUSTED-额度耗尽，DISABLED-禁用，EXPIRED-失效', version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (account_id), UNIQUE KEY uk_entitlement_project_mode (project_id,entitlement_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目权益账户当前余额投影表';

CREATE TABLE ha_entitlement_ledger (
 ledger_id BIGINT NOT NULL COMMENT '权益账本流水ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', project_id BIGINT NOT NULL COMMENT '所属项目ID', account_id BIGINT NOT NULL COMMENT '权益账户ID', entry_type VARCHAR(32) NOT NULL COMMENT '流水类型：GRANT-权益发放，CHARGE-AI调用扣费，REVERSAL-冲正，ALLOCATION-额度分配', direction VARCHAR(16) NOT NULL COMMENT '方向：CREDIT-增加权益，DEBIT-减少权益', amount DECIMAL(24,12) NOT NULL COMMENT '流水金额，精度12位小数', currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种代码', balance_before DECIMAL(24,12) NOT NULL COMMENT '生效前余额，精度12位小数', balance_after DECIMAL(24,12) NOT NULL COMMENT '生效后余额，精度12位小数', business_type VARCHAR(32) NOT NULL COMMENT '关联业务类型', business_id VARCHAR(64) NOT NULL COMMENT '关联业务ID', settlement_id BIGINT NULL COMMENT '关联AI计费结算ID', grant_id BIGINT NULL COMMENT '关联权益发放ID', reversal_of BIGINT NULL COMMENT '被冲正原流水ID', created_at DATETIME(3) NOT NULL COMMENT '入账时间', PRIMARY KEY (ledger_id), KEY idx_ledger_account_time (account_id,created_at), KEY idx_ledger_business (business_type,business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权益不可变账本流水表，已生效流水不得原地修改金额或删除';

CREATE TABLE ha_ai_logical_model (
 logical_model_id BIGINT NOT NULL COMMENT '逻辑模型ID', model_code VARCHAR(128) NOT NULL COMMENT '对企业暴露的模型编码', model_name VARCHAR(128) NOT NULL COMMENT '模型名称', capabilities JSON NULL COMMENT '模型能力元数据', status VARCHAR(32) NOT NULL COMMENT '状态：ENABLED-启用，DISABLED-禁用', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (logical_model_id), UNIQUE KEY uk_logical_model_code (model_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对企业暴露的逻辑模型定义表';

CREATE TABLE ha_ai_provider (
 provider_id BIGINT NOT NULL COMMENT '上游供应商ID', provider_code VARCHAR(64) NOT NULL COMMENT '供应商编码', provider_name VARCHAR(128) NOT NULL COMMENT '供应商名称', adapter_code VARCHAR(128) NOT NULL COMMENT 'ProviderAdapter实现编码', status VARCHAR(32) NOT NULL COMMENT '状态：ENABLED-启用，DISABLED-禁用', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (provider_id), UNIQUE KEY uk_ai_provider_code (provider_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上游AI模型供应商定义表';

CREATE TABLE ha_ai_provider_channel (
 channel_id BIGINT NOT NULL COMMENT '供应商渠道ID', provider_id BIGINT NOT NULL COMMENT '供应商ID', channel_code VARCHAR(64) NOT NULL COMMENT '渠道编码', channel_name VARCHAR(128) NOT NULL COMMENT '渠道名称', endpoint VARCHAR(512) NOT NULL COMMENT '上游API端点', credential_ref VARCHAR(255) NOT NULL COMMENT '上游凭证引用，不得向企业侧返回明文', priority INT NOT NULL DEFAULT 0 COMMENT '路由优先级', weight INT NOT NULL DEFAULT 100 COMMENT '路由权重', status VARCHAR(32) NOT NULL COMMENT '状态：ENABLED-启用，DISABLED-禁用', version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (channel_id), UNIQUE KEY uk_provider_channel_code (provider_id,channel_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上游供应商实际采购渠道实例表';

CREATE TABLE ha_ai_pricing_rule (
 pricing_rule_id BIGINT NOT NULL COMMENT '计价规则ID', logical_model_id BIGINT NOT NULL COMMENT '逻辑模型ID', provider_id BIGINT NOT NULL COMMENT '供应商ID', channel_id BIGINT NOT NULL COMMENT '渠道ID', pricing_type VARCHAR(32) NOT NULL COMMENT '计价类型：TOKEN-按Token，REQUEST-按次，SECOND-按秒，TIERED-阶梯', input_price DECIMAL(24,12) NULL COMMENT '输入计费单价，精度12位小数；适用时使用', output_price DECIMAL(24,12) NULL COMMENT '输出计费单价，精度12位小数；适用时使用', rate DECIMAL(24,12) NULL COMMENT '通用费率，精度12位小数；适用时使用', pricing_config JSON NULL COMMENT '扩展计价配置', currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种代码', effective_from DATETIME(3) NOT NULL COMMENT '生效时间', effective_to DATETIME(3) NULL COMMENT '失效时间', status VARCHAR(32) NOT NULL COMMENT '状态：DRAFT-草稿，ACTIVE-生效，EXPIRED-失效，DISABLED-禁用', version BIGINT NOT NULL DEFAULT 0 COMMENT '规则版本号', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (pricing_rule_id), KEY idx_pricing_channel_time (channel_id,effective_from,effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI模型供应商渠道计价规则版本表';

CREATE TABLE ha_ai_request (
 request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', project_id BIGINT NOT NULL COMMENT '项目ID', api_key_id BIGINT NOT NULL COMMENT 'API Key记录ID', logical_model_id BIGINT NOT NULL COMMENT '请求逻辑模型ID', client_request_id VARCHAR(128) NULL COMMENT '客户端请求标识', stream TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否流式：1-是，0-否', execution_result VARCHAR(32) NULL COMMENT '执行结果：SUCCESS-成功，FAILED-失败，CANCELLED-取消', delivery_result VARCHAR(32) NULL COMMENT '交付结果：NOT_STARTED-未开始，PARTIAL-部分，COMPLETE-完整，CLIENT_ABORTED-客户端中断', billing_result VARCHAR(32) NULL COMMENT '计费结果：NOT_CHARGEABLE-不计费，PENDING-待处理，CHARGEABLE-可计费，SETTLED-已结算，SETTLEMENT_FAILED-结算失败', started_at DATETIME(3) NOT NULL COMMENT '请求开始时间', first_token_at DATETIME(3) NULL COMMENT '首个模型内容Token/Chunk到达时间', finished_at DATETIME(3) NULL COMMENT '请求结束时间', created_at DATETIME(3) NOT NULL COMMENT '记录创建时间', PRIMARY KEY (request_id), KEY idx_ai_request_project_time (project_id,created_at), KEY idx_ai_request_enterprise_time (enterprise_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业AI模型调用请求主记录表';

CREATE TABLE ha_ai_routing_attempt (
 attempt_id BIGINT NOT NULL COMMENT '上游路由尝试ID', request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID', attempt_no INT NOT NULL COMMENT '同一请求内尝试序号，从1开始', provider_id BIGINT NOT NULL COMMENT '实际供应商ID', channel_id BIGINT NOT NULL COMMENT '实际渠道ID', provider_request_id VARCHAR(256) NULL COMMENT '上游供应商请求标识', execution_result VARCHAR(32) NULL COMMENT '尝试执行结果：SUCCESS-成功，FAILED-失败，CANCELLED-取消', normalized_error_code VARCHAR(64) NULL COMMENT '平台规范化错误码', started_at DATETIME(3) NOT NULL COMMENT '尝试开始时间', first_token_at DATETIME(3) NULL COMMENT '首个模型内容Token/Chunk到达时间', finished_at DATETIME(3) NULL COMMENT '尝试结束时间', created_at DATETIME(3) NOT NULL COMMENT '记录创建时间', PRIMARY KEY (attempt_id), UNIQUE KEY uk_request_attempt_no (request_id,attempt_no), KEY idx_attempt_channel_time (channel_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI模型调用上游路由尝试记录表';

CREATE TABLE ha_ai_usage_evidence (
 usage_evidence_id BIGINT NOT NULL COMMENT '上游用量证据ID', request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID', attempt_id BIGINT NOT NULL COMMENT '上游路由尝试ID', input_tokens BIGINT NULL COMMENT '上游计量的输入Token数量', output_tokens BIGINT NULL COMMENT '上游计量的输出Token数量', total_tokens BIGINT NULL COMMENT '本次尝试总Token数量', evidence_source VARCHAR(32) NOT NULL COMMENT '证据来源类型，例如RESPONSE、STREAM、QUERY', usage_payload JSON NULL COMMENT '脱敏后的上游用量证据扩展数据', created_at DATETIME(3) NOT NULL COMMENT '证据记录时间', PRIMARY KEY (usage_evidence_id), KEY idx_usage_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上游AI模型调用用量证据表';

CREATE TABLE ha_ai_cost_evidence (
 cost_evidence_id BIGINT NOT NULL COMMENT '上游计费证据ID', request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID', attempt_id BIGINT NOT NULL COMMENT '上游路由尝试ID', evidence_type VARCHAR(32) NOT NULL COMMENT '计费证据类型，例如USAGE、DIRECT_COST、PROVIDER_QUERY', evidence_value DECIMAL(24,12) NULL COMMENT '供应商直接返回的成本值，精度12位小数；不适用时为空', source_reference VARCHAR(512) NULL COMMENT '上游计费证据引用或脱敏标识', verified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已通过平台规则验证：1-是，0-否', created_at DATETIME(3) NOT NULL COMMENT '证据记录时间', PRIMARY KEY (cost_evidence_id), KEY idx_cost_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上游AI模型调用计费证据表';

CREATE TABLE ha_ai_charge_component (
 charge_component_id BIGINT NOT NULL COMMENT '企业调用费用组成明细ID', request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID', attempt_id BIGINT NOT NULL COMMENT '对应上游路由尝试ID', cost_evidence_id BIGINT NOT NULL COMMENT '计费依据ID', pricing_rule_id BIGINT NOT NULL COMMENT '适用计价规则ID', pricing_snapshot JSON NOT NULL COMMENT '本次费用计算使用的计价规则快照，防止历史价格变化导致重算漂移', charge_amount DECIMAL(24,12) NOT NULL COMMENT '本费用组成企业应承担金额，精度12位小数', currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种代码', status VARCHAR(32) NOT NULL COMMENT '状态：PENDING-待结算，CONFIRMED-已确认，REVERSED-已冲正', created_at DATETIME(3) NOT NULL COMMENT '创建时间', PRIMARY KEY (charge_component_id), KEY idx_charge_request (request_id), KEY idx_charge_attempt (attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业AI调用费用组成明细表';

CREATE TABLE ha_ai_billing_settlement (
 settlement_id BIGINT NOT NULL COMMENT '企业AI调用计费结算ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', project_id BIGINT NOT NULL COMMENT '所属项目ID', request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID', account_id BIGINT NOT NULL COMMENT '扣减的权益账户ID', business_key VARCHAR(128) NOT NULL COMMENT '计费结算业务幂等键，同一业务键只能成功结算一次', total_charge DECIMAL(24,12) NOT NULL COMMENT '本次请求最终企业应承担总费用，精度12位小数', currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种代码', status VARCHAR(32) NOT NULL COMMENT '状态：PENDING-待结算，SETTLED-已结算，FAILED-失败，REVERSED-已冲正', settled_at DATETIME(3) NULL COMMENT '成功结算时间', created_at DATETIME(3) NOT NULL COMMENT '创建时间', PRIMARY KEY (settlement_id), UNIQUE KEY uk_billing_business_key (business_key), UNIQUE KEY uk_billing_request (request_id), KEY idx_billing_project_time (project_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业AI调用计费结算表';

CREATE TABLE ha_payment_order (
 payment_order_id BIGINT NOT NULL COMMENT '平台支付订单ID', payment_order_no VARCHAR(64) NOT NULL COMMENT '平台支付订单号', enterprise_id BIGINT NOT NULL COMMENT '购买权益的企业ID', purchase_type VARCHAR(32) NOT NULL COMMENT '购买类型：BALANCE-余额充值，SUBSCRIPTION-订阅购买或续费', purchase_target_id BIGINT NULL COMMENT '购买目标ID，例如订阅套餐ID；余额充值时可为空', amount DECIMAL(24,12) NOT NULL COMMENT '支付订单金额，精度12位小数', currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '支付币种代码', channel_code VARCHAR(64) NULL COMMENT '实际支付渠道编码，首批渠道待实施配置确认', status VARCHAR(32) NOT NULL COMMENT '支付状态：CREATED-已创建，PAYING-支付中，SUCCESS-支付成功，FAILED-支付失败，CLOSED-关闭', channel_order_no VARCHAR(128) NULL COMMENT '支付渠道侧订单号', paid_at DATETIME(3) NULL COMMENT '支付成功时间', created_at DATETIME(3) NOT NULL COMMENT '创建时间', updated_at DATETIME(3) NOT NULL COMMENT '更新时间', PRIMARY KEY (payment_order_id), UNIQUE KEY uk_payment_order_no (payment_order_no), KEY idx_payment_enterprise_time (enterprise_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业在线购买权益支付订单表';

CREATE TABLE ha_entitlement_grant (
 grant_id BIGINT NOT NULL COMMENT '权益发放记录ID', enterprise_id BIGINT NOT NULL COMMENT '所属企业ID', source_type VARCHAR(32) NOT NULL COMMENT '来源类型：PAYMENT-在线支付，MANUAL-人工入账', source_id VARCHAR(64) NOT NULL COMMENT '来源业务ID', entitlement_type VARCHAR(32) NOT NULL COMMENT '发放权益类型：BALANCE-余额，SUBSCRIPTION-订阅', amount DECIMAL(24,12) NULL COMMENT '发放金额，精度12位小数；订阅型权益可为空', plan_id BIGINT NULL COMMENT '订阅套餐ID；余额型权益可为空', business_key VARCHAR(128) NOT NULL COMMENT '权益发放业务幂等键，同一业务键只能成功发放一次', status VARCHAR(32) NOT NULL COMMENT '状态：PENDING-待发放，GRANTED-已发放，FAILED-失败，REVERSED-已冲正', granted_at DATETIME(3) NULL COMMENT '权益成功发放时间', created_at DATETIME(3) NOT NULL COMMENT '创建时间', PRIMARY KEY (grant_id), UNIQUE KEY uk_entitlement_grant_business_key (business_key), KEY idx_grant_enterprise_time (enterprise_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业权益统一发放记录表，承接在线支付和人工入账';

CREATE TABLE ha_sys_user (
  user_id BIGINT NOT NULL COMMENT '系统用户ID',
  username VARCHAR(64) NOT NULL COMMENT '登录用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '登录密码不可逆摘要',
  display_name VARCHAR(128) NOT NULL COMMENT '用户显示名称',
  status VARCHAR(32) NOT NULL COMMENT '用户状态：ENABLED-启用，DISABLED-禁用',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL COMMENT '更新时间',
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_sys_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台及企业人员统一用户账号表';

CREATE TABLE ha_sys_role (
  role_id BIGINT NOT NULL COMMENT '角色ID',
  role_code VARCHAR(64) NOT NULL COMMENT '角色编码',
  role_name VARCHAR(128) NOT NULL COMMENT '角色名称',
  role_scope VARCHAR(32) NOT NULL COMMENT '角色范围：PLATFORM-平台侧，ENTERPRISE-企业侧',
  status VARCHAR(32) NOT NULL COMMENT '角色状态：ENABLED-启用，DISABLED-禁用',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (role_id),
  UNIQUE KEY uk_sys_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台与企业权限角色定义表';

CREATE TABLE ha_sys_permission (
  permission_id BIGINT NOT NULL COMMENT '权限ID',
  permission_code VARCHAR(128) NOT NULL COMMENT '权限编码',
  permission_name VARCHAR(128) NOT NULL COMMENT '权限名称',
  resource_type VARCHAR(32) NOT NULL COMMENT '资源类型：MENU-菜单，API-接口，ACTION-操作，DATA-数据范围',
  status VARCHAR(32) NOT NULL COMMENT '权限状态：ENABLED-启用，DISABLED-禁用',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (permission_id),
  UNIQUE KEY uk_sys_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统权限资源定义表';

CREATE TABLE ha_enterprise_member (
  member_id BIGINT NOT NULL COMMENT '企业成员ID',
  enterprise_id BIGINT NOT NULL COMMENT '所属企业ID',
  user_id BIGINT NOT NULL COMMENT '关联系统用户ID',
  status VARCHAR(32) NOT NULL COMMENT '成员状态：ENABLED-启用，DISABLED-禁用',
  joined_at DATETIME(3) NOT NULL COMMENT '加入企业时间',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (member_id),
  UNIQUE KEY uk_enterprise_member_user (enterprise_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业成员关系表';

CREATE TABLE ha_enterprise_member_role (
  id BIGINT NOT NULL COMMENT '关系ID',
  enterprise_id BIGINT NOT NULL COMMENT '所属企业ID',
  member_id BIGINT NOT NULL COMMENT '企业成员ID',
  role_id BIGINT NOT NULL COMMENT '角色ID',
  project_id BIGINT NULL COMMENT '可选项目范围ID，为空表示企业范围',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_member_role_scope (member_id,role_id,project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业成员角色及项目范围关系表';

CREATE TABLE ha_subscription_plan (
  plan_id BIGINT NOT NULL COMMENT '订阅套餐ID',
  plan_code VARCHAR(64) NOT NULL COMMENT '套餐编码',
  plan_name VARCHAR(128) NOT NULL COMMENT '套餐名称',
  billing_cycle VARCHAR(32) NOT NULL COMMENT '订阅周期：MONTHLY-月订阅，YEARLY-年订阅',
  monthly_entitlement_amount DECIMAL(24,12) NOT NULL COMMENT '每月释放权益额度，精度12位小数',
  price DECIMAL(24,12) NOT NULL COMMENT '套餐销售价格，精度12位小数',
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY' COMMENT '币种代码',
  status VARCHAR(32) NOT NULL COMMENT '套餐状态：ENABLED-启用，DISABLED-禁用',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (plan_id),
  UNIQUE KEY uk_subscription_plan_code (plan_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业订阅套餐定义表';

CREATE TABLE ha_enterprise_subscription (
  subscription_id BIGINT NOT NULL COMMENT '企业订阅ID',
  enterprise_id BIGINT NOT NULL COMMENT '所属企业ID',
  project_id BIGINT NOT NULL COMMENT '使用订阅权益的项目ID',
  plan_id BIGINT NOT NULL COMMENT '订阅套餐ID',
  status VARCHAR(32) NOT NULL COMMENT '订阅状态：ACTIVE-有效，EXPIRED-到期，CANCELLED-取消',
  started_at DATETIME(3) NOT NULL COMMENT '订阅开始时间',
  expires_at DATETIME(3) NOT NULL COMMENT '订阅到期时间',
  next_release_at DATETIME(3) NULL COMMENT '下一次月度额度释放时间',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (subscription_id),
  KEY idx_subscription_project_status (project_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业项目订阅实例表';

CREATE TABLE ha_quota_allocation (
  allocation_id BIGINT NOT NULL COMMENT '额度分配记录ID',
  enterprise_id BIGINT NOT NULL COMMENT '所属企业ID',
  project_id BIGINT NOT NULL COMMENT '目标项目ID',
  account_id BIGINT NOT NULL COMMENT '目标权益账户ID',
  allocation_type VARCHAR(32) NOT NULL COMMENT '分配类型：BALANCE-余额额度，SUBSCRIPTION-订阅月度额度',
  amount DECIMAL(24,12) NOT NULL COMMENT '本次分配额度，精度12位小数',
  business_type VARCHAR(32) NOT NULL COMMENT '来源业务类型',
  business_id VARCHAR(64) NOT NULL COMMENT '来源业务ID',
  status VARCHAR(32) NOT NULL COMMENT '状态：PENDING-待生效，APPLIED-已生效，REVERSED-已冲正',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (allocation_id),
  KEY idx_quota_project_time (project_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业权益向项目分配额度记录表';

CREATE TABLE ha_ai_provider_credential (
  credential_id BIGINT NOT NULL COMMENT '上游供应商凭证ID',
  provider_id BIGINT NOT NULL COMMENT '供应商ID',
  channel_id BIGINT NOT NULL COMMENT '渠道ID',
  secret_type VARCHAR(32) NOT NULL COMMENT '凭证类型',
  encrypted_secret TEXT NULL COMMENT '加密后的凭证密文',
  secret_ref VARCHAR(512) NULL COMMENT '外部密钥系统凭证引用',
  masked_hint VARCHAR(64) NULL COMMENT '凭证脱敏提示',
  status VARCHAR(32) NOT NULL COMMENT '凭证状态：ENABLED-启用，DISABLED-禁用，ROTATED-已轮换',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (credential_id),
  UNIQUE KEY uk_provider_channel_credential (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上游AI供应商渠道受控凭证表';

CREATE TABLE ha_ai_model_channel (
  id BIGINT NOT NULL COMMENT '映射ID',
  logical_model_id BIGINT NOT NULL COMMENT '逻辑模型ID',
  channel_id BIGINT NOT NULL COMMENT '供应商渠道ID',
  provider_model_code VARCHAR(128) NOT NULL COMMENT '上游原生模型编码',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：1-启用，0-禁用',
  capability_config JSON NULL COMMENT '模型能力及兼容配置',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_model_channel (logical_model_id,channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='逻辑模型到供应商渠道映射表';

CREATE TABLE ha_ai_routing_policy (
  routing_policy_id BIGINT NOT NULL COMMENT '路由策略ID',
  logical_model_id BIGINT NOT NULL COMMENT '适用逻辑模型ID',
  policy_name VARCHAR(128) NOT NULL COMMENT '路由策略名称',
  strategy VARCHAR(32) NOT NULL COMMENT '策略类型：PRIORITY、WEIGHTED、FAILOVER等',
  policy_config JSON NOT NULL COMMENT '候选渠道、优先级、权重、超时与回退配置',
  status VARCHAR(32) NOT NULL COMMENT '策略状态：DRAFT-草稿，ACTIVE-生效，DISABLED-禁用',
  version BIGINT NOT NULL DEFAULT 0 COMMENT '策略版本号',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (routing_policy_id),
  KEY idx_routing_model_status (logical_model_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='逻辑模型动态路由及回退策略定义表';

CREATE TABLE ha_ai_routing_decision (
  routing_decision_id BIGINT NOT NULL COMMENT '路由决策记录ID',
  request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID',
  routing_policy_id BIGINT NULL COMMENT '采用的路由策略ID',
  policy_version BIGINT NULL COMMENT '采用的策略版本号',
  candidate_channels JSON NULL COMMENT '候选渠道列表快照',
  selected_channel_id BIGINT NOT NULL COMMENT '最终选择的首个渠道ID',
  decision_reason VARCHAR(512) NULL COMMENT '路由选择原因或规则摘要',
  created_at DATETIME(3) NOT NULL COMMENT '决策时间',
  PRIMARY KEY (routing_decision_id),
  UNIQUE KEY uk_routing_decision_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI请求路由选择决策记录表';

CREATE TABLE ha_payment_channel (
  payment_channel_id BIGINT NOT NULL COMMENT '在线支付渠道ID',
  channel_code VARCHAR(64) NOT NULL COMMENT '支付渠道编码',
  channel_name VARCHAR(128) NOT NULL COMMENT '支付渠道名称',
  adapter_code VARCHAR(128) NOT NULL COMMENT '支付渠道适配器实现编码',
  config_ref VARCHAR(512) NULL COMMENT '支付渠道受控配置引用',
  status VARCHAR(32) NOT NULL COMMENT '支付渠道状态：ENABLED-启用，DISABLED-禁用',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  PRIMARY KEY (payment_channel_id),
  UNIQUE KEY uk_payment_channel_code (channel_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业在线购买权益支付渠道定义表';

CREATE TABLE ha_payment_callback (
  callback_id BIGINT NOT NULL COMMENT '支付渠道回调记录ID',
  payment_order_id BIGINT NOT NULL COMMENT '平台支付订单ID',
  channel_code VARCHAR(64) NOT NULL COMMENT '支付渠道编码',
  callback_key VARCHAR(128) NOT NULL COMMENT '支付渠道回调唯一标识',
  payload_digest VARCHAR(128) NOT NULL COMMENT '回调报文摘要',
  process_status VARCHAR(32) NOT NULL COMMENT '处理状态：RECEIVED-已接收，PROCESSED-已处理，IGNORED-重复忽略，FAILED-失败',
  received_at DATETIME(3) NOT NULL COMMENT '回调接收时间',
  processed_at DATETIME(3) NULL COMMENT '回调完成处理时间',
  created_at DATETIME(3) NOT NULL COMMENT '记录创建时间',
  PRIMARY KEY (callback_id),
  UNIQUE KEY uk_payment_callback_key (channel_code,callback_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='在线支付渠道回调及幂等处理记录表';

CREATE TABLE ha_manual_credit_order (
  manual_credit_id BIGINT NOT NULL COMMENT '人工入账业务单ID',
  enterprise_id BIGINT NOT NULL COMMENT '目标企业ID',
  project_id BIGINT NULL COMMENT '目标项目ID',
  grant_type VARCHAR(32) NOT NULL COMMENT '发放类型：BALANCE-余额，SUBSCRIPTION-订阅',
  amount DECIMAL(24,12) NULL COMMENT '人工发放余额金额，精度12位小数',
  plan_id BIGINT NULL COMMENT '人工开通的订阅套餐ID',
  business_reference VARCHAR(256) NOT NULL COMMENT '线下合同、付款凭证或其他业务依据编号',
  reason VARCHAR(512) NOT NULL COMMENT '人工入账原因说明',
  operator_id BIGINT NOT NULL COMMENT '执行人工入账的授权平台操作人ID',
  status VARCHAR(32) NOT NULL COMMENT '状态：DRAFT-草稿，COMPLETED-已完成，REVERSED-已冲正，CANCELLED-取消',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  completed_at DATETIME(3) NULL COMMENT '入账完成时间',
  PRIMARY KEY (manual_credit_id),
  KEY idx_manual_credit_enterprise_time (enterprise_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线下合同或付款确认后的人工权益入账业务单表';
