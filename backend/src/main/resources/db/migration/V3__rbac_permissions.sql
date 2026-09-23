-- M02 RBAC 基础权限模型。仅定义权限与角色权限关系，不包含用户管理或项目成员变更。
CREATE TABLE ha_auth_permission (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '权限ID',
    permission_code VARCHAR(128) NOT NULL COMMENT '权限编码',
    display_name VARCHAR(128) NOT NULL COMMENT '权限名称',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认证权限';

CREATE TABLE ha_auth_role_permission (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '角色权限关系ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    permission_id BIGINT NOT NULL COMMENT '权限ID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_role_permission (role_id, permission_id),
    CONSTRAINT fk_auth_role_permission_role FOREIGN KEY (role_id) REFERENCES ha_auth_role (id),
    CONSTRAINT fk_auth_role_permission_permission FOREIGN KEY (permission_id) REFERENCES ha_auth_permission (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色权限关系';

INSERT IGNORE INTO ha_auth_permission (permission_code, display_name) VALUES
    ('project:read', '查看项目'),
    ('project:create', '创建项目'),
    ('project:update', '更新项目'),
    ('api-key:read', '查看 API Key'),
    ('api-key:manage', '管理 API Key');

INSERT IGNORE INTO ha_auth_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM ha_auth_role r CROSS JOIN ha_auth_permission p WHERE r.role_code = 'platform-admin';

INSERT IGNORE INTO ha_auth_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM ha_auth_role r JOIN ha_auth_permission p
WHERE r.role_code IN ('enterprise-admin', 'project-admin')
  AND p.permission_code IN ('project:read', 'project:create', 'project:update', 'api-key:read', 'api-key:manage');

INSERT IGNORE INTO ha_auth_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM ha_auth_role r JOIN ha_auth_permission p
WHERE r.role_code = 'project-developer' AND p.permission_code IN ('project:read', 'api-key:read');

INSERT IGNORE INTO ha_auth_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM ha_auth_role r JOIN ha_auth_permission p
WHERE r.role_code = 'project-viewer' AND p.permission_code = 'project:read';
