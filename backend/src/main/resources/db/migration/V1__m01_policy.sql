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
