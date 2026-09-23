-- 开发联调专用且可重复执行；不要在生产环境执行。
INSERT INTO ha_enterprise (id, display_name, status)
VALUES (910000000001, 'M01 Integration Enterprise', 'ACTIVE')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), status = VALUES(status);

INSERT INTO ha_project (enterprise_id, project_code, name, entitlement_mode, status)
VALUES (910000000001, 'M01-INTEGRATION', 'M01 Login Integration Project', 'BALANCE', 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), entitlement_mode = VALUES(entitlement_mode), status = VALUES(status);
