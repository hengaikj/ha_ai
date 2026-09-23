-- M01 formal user authentication schema.
-- Apply: Flyway migrate from V1. Verify: run AuthSchemaMigrationTest with AUTH_MIGRATION_TEST_*.
-- Rollback: forward-only migration; restore from backup or create a new forward migration.

CREATE TABLE ha_enterprise (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '企业ID',
    display_name VARCHAR(128) NOT NULL COMMENT '企业显示名称',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '企业状态',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_enterprise_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='企业';

INSERT IGNORE INTO ha_enterprise (id, display_name, status)
SELECT source.enterprise_id, CONCAT('企业 ', source.enterprise_id), 'ACTIVE'
FROM (
    SELECT enterprise_id FROM ha_project WHERE enterprise_id IS NOT NULL
    UNION
    SELECT enterprise_id FROM ha_api_key WHERE enterprise_id IS NOT NULL
) source;

ALTER TABLE ha_project
    ADD COLUMN project_code VARCHAR(64) NULL COMMENT '企业内唯一项目编码',
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '项目状态';

UPDATE ha_project SET project_code = CONCAT('HAI-', id) WHERE project_code IS NULL;
ALTER TABLE ha_project MODIFY COLUMN project_code VARCHAR(64) NOT NULL COMMENT '企业内唯一项目编码';
ALTER TABLE ha_project
    ADD UNIQUE KEY uk_project_enterprise_code (enterprise_id, project_code),
    ADD KEY idx_project_enterprise_status (enterprise_id, status),
    ADD CONSTRAINT fk_project_enterprise FOREIGN KEY (enterprise_id) REFERENCES ha_enterprise (id);

CREATE TABLE ha_auth_user (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    username VARCHAR(128) NOT NULL COMMENT '登录用户名',
    password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt密码摘要',
    display_name VARCHAR(128) NOT NULL COMMENT '用户显示名称',
    enterprise_id BIGINT NULL COMMENT '所属企业；平台管理员为空',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '账号状态',
    failed_login_count INT NOT NULL DEFAULT 0 COMMENT '连续登录失败次数',
    locked_until TIMESTAMP NULL COMMENT '账号锁定截止时间',
    last_login_at TIMESTAMP NULL COMMENT '最近登录时间',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_user_username (username),
    KEY idx_auth_user_enterprise_status (enterprise_id, status),
    CONSTRAINT fk_auth_user_enterprise FOREIGN KEY (enterprise_id) REFERENCES ha_enterprise (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认证用户';

CREATE TABLE ha_auth_role (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '角色ID',
    role_code VARCHAR(64) NOT NULL COMMENT '角色编码',
    display_name VARCHAR(128) NOT NULL COMMENT '角色名称',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认证角色';

INSERT IGNORE INTO ha_auth_role (role_code, display_name) VALUES
    ('platform-admin', '平台超级管理员'),
    ('enterprise-admin', '企业管理员'),
    ('project-admin', '项目管理员'),
    ('project-developer', '项目开发成员'),
    ('project-viewer', '项目只读成员');

CREATE TABLE ha_auth_user_role (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户角色关系ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_user_role (user_id, role_id),
    KEY idx_auth_user_role_role (role_id),
    CONSTRAINT fk_auth_user_role_user FOREIGN KEY (user_id) REFERENCES ha_auth_user (id),
    CONSTRAINT fk_auth_user_role_role FOREIGN KEY (role_id) REFERENCES ha_auth_role (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户角色关系';

CREATE TABLE ha_auth_project_member (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '项目成员关系ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    project_id BIGINT NOT NULL COMMENT '项目ID',
    role_id BIGINT NOT NULL COMMENT '项目角色ID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_project_member (user_id, project_id, role_id),
    KEY idx_auth_project_member_project (project_id, role_id),
    CONSTRAINT fk_auth_project_member_user FOREIGN KEY (user_id) REFERENCES ha_auth_user (id),
    CONSTRAINT fk_auth_project_member_project FOREIGN KEY (project_id) REFERENCES ha_project (id),
    CONSTRAINT fk_auth_project_member_role FOREIGN KEY (role_id) REFERENCES ha_auth_role (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户项目成员关系';

CREATE TABLE ha_auth_session (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '会话ID',
    jti VARCHAR(64) NOT NULL COMMENT 'JWT唯一会话标识',
    user_id BIGINT NOT NULL COMMENT '会话所属用户',
    issued_at TIMESTAMP NOT NULL COMMENT '签发时间',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    revoked_at TIMESTAMP NULL COMMENT '撤销时间',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_session_jti (jti),
    KEY idx_auth_session_user_expiry (user_id, expires_at),
    CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES ha_auth_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='JWT登录会话';
