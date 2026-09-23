-- M02-B 用户与角色管理权限。仅新增权限种子，不改变既有认证表结构。
INSERT IGNORE INTO ha_auth_permission (permission_code, display_name) VALUES
    ('user:read', '查看用户'),
    ('user:create', '创建用户'),
    ('user:update', '更新用户'),
    ('user:role:manage', '管理用户角色'),
    ('role:read', '查看角色');

INSERT IGNORE INTO ha_auth_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM ha_auth_role r CROSS JOIN ha_auth_permission p
WHERE r.role_code = 'platform-admin'
  AND p.permission_code IN ('user:read', 'user:create', 'user:update', 'user:role:manage', 'role:read');

INSERT IGNORE INTO ha_auth_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM ha_auth_role r JOIN ha_auth_permission p
WHERE r.role_code = 'enterprise-admin'
  AND p.permission_code IN ('user:read', 'user:create', 'user:update', 'user:role:manage', 'role:read');
