SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ha_ai_logical_model (
  logical_model_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '逻辑模型ID',
  model_code VARCHAR(128) NOT NULL COMMENT '对企业暴露的模型编码',
  model_name VARCHAR(128) NOT NULL COMMENT '模型名称',
  status VARCHAR(32) NOT NULL COMMENT '状态：ENABLED-启用，DISABLED-禁用',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL COMMENT '更新时间',
  PRIMARY KEY (logical_model_id),
  UNIQUE KEY uk_logical_model_code (model_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对企业暴露的逻辑模型定义表';

CREATE TABLE IF NOT EXISTS ha_ai_api_key (
  api_key_id BIGINT NOT NULL COMMENT '企业API Key记录ID',
  enterprise_id BIGINT NOT NULL COMMENT '所属企业ID',
  project_id BIGINT NOT NULL COMMENT '所属项目/应用ID',
  key_name VARCHAR(128) NOT NULL COMMENT 'API Key名称',
  key_prefix VARCHAR(32) NOT NULL COMMENT 'API Key展示前缀，不包含完整密钥',
  key_hash VARCHAR(128) NOT NULL COMMENT 'API Key不可逆摘要，不保存完整明文',
  entitlement_mode VARCHAR(32) NOT NULL COMMENT '权益模式：BALANCE-预充值余额，SUBSCRIPTION-订阅',
  status VARCHAR(32) NOT NULL COMMENT '状态：ENABLED-启用，DISABLED-禁用，REVOKED-永久撤销',
  expires_at DATETIME(3) NULL COMMENT '可选过期时间',
  revoked_at DATETIME(3) NULL COMMENT '永久撤销时间',
  version BIGINT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL COMMENT '更新时间',
  PRIMARY KEY (api_key_id),
  UNIQUE KEY uk_ai_api_key_hash (key_hash),
  KEY idx_ai_api_key_project_status (project_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业项目API Key管理表';

CREATE TABLE IF NOT EXISTS ha_ai_project_model_policy (
  policy_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '项目模型权限记录ID',
  project_id BIGINT NOT NULL COMMENT '项目ID',
  logical_model_id BIGINT NOT NULL COMMENT '逻辑模型ID',
  status VARCHAR(32) NOT NULL DEFAULT 'ENABLED' COMMENT '权限状态：ENABLED-允许，DISABLED-禁止',
  created_at DATETIME(3) NOT NULL COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL COMMENT '更新时间',
  PRIMARY KEY (policy_id),
  UNIQUE KEY uk_project_model_policy (project_id, logical_model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目逻辑模型调用权限表';

CREATE TABLE IF NOT EXISTS ha_ai_request (
  request_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '平台AI调用请求ID',
  enterprise_id BIGINT NOT NULL COMMENT '所属企业ID',
  project_id BIGINT NOT NULL COMMENT '项目ID',
  api_key_id BIGINT NOT NULL COMMENT 'API Key记录ID',
  logical_model_id BIGINT NOT NULL COMMENT '请求逻辑模型ID',
  client_request_id VARCHAR(128) NULL COMMENT '客户端请求标识',
  stream TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否流式：1-是，0-否',
  execution_result VARCHAR(32) NULL COMMENT '执行结果：SUCCESS-成功，FAILED-失败，CANCELLED-取消',
  delivery_result VARCHAR(32) NULL COMMENT '交付结果：NOT_STARTED-未开始，PARTIAL-部分，COMPLETE-完整，CLIENT_ABORTED-客户端中断',
  billing_result VARCHAR(32) NULL COMMENT '计费结果：NOT_CHARGEABLE-不计费，PENDING-待处理，CHARGEABLE-可计费，SETTLED-已结算，SETTLEMENT_FAILED-结算失败',
  started_at DATETIME(3) NOT NULL COMMENT '请求开始时间',
  first_token_at DATETIME(3) NULL COMMENT '首个模型内容Token/Chunk到达时间',
  finished_at DATETIME(3) NULL COMMENT '请求结束时间',
  created_at DATETIME(3) NOT NULL COMMENT '记录创建时间',
  PRIMARY KEY (request_id),
  KEY idx_ai_request_project_time (project_id,created_at),
  KEY idx_ai_request_enterprise_time (enterprise_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业AI模型调用请求主记录表';

CREATE TABLE IF NOT EXISTS ha_ai_routing_attempt (
  attempt_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '上游路由尝试ID',
  request_id BIGINT NOT NULL COMMENT '平台AI调用请求ID',
  attempt_no INT NOT NULL COMMENT '同一请求内尝试序号，从1开始',
  provider_id BIGINT NOT NULL COMMENT '实际供应商ID',
  channel_id BIGINT NOT NULL COMMENT '实际渠道ID',
  provider_request_id VARCHAR(256) NULL COMMENT '上游供应商请求标识',
  execution_result VARCHAR(32) NULL COMMENT '尝试执行结果：SUCCESS-成功，FAILED-失败，CANCELLED-取消',
  normalized_error_code VARCHAR(64) NULL COMMENT '平台规范化错误码',
  started_at DATETIME(3) NOT NULL COMMENT '尝试开始时间',
  first_token_at DATETIME(3) NULL COMMENT '首个模型内容Token/Chunk到达时间',
  finished_at DATETIME(3) NULL COMMENT '尝试结束时间',
  created_at DATETIME(3) NOT NULL COMMENT '记录创建时间',
  PRIMARY KEY (attempt_id),
  UNIQUE KEY uk_request_attempt_no (request_id,attempt_no),
  KEY idx_attempt_channel_time (channel_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI模型调用上游路由尝试记录表';
