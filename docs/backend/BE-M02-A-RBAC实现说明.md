# BE-M02-A RBAC 基础能力说明

本阶段只提供 Permission、Role、UserContext 和 Authorization 基础能力。

## 实现范围

- `ha_auth_permission` 保存权限编码和显示名称。
- `ha_auth_role_permission` 保存角色与权限的多对多关系。
- `AuthUserContext.permissionCodes` 从用户的全局角色关系加载；项目成员角色仍由项目范围授权单独判断，避免把项目权限提升为全局权限。
- `AuthzService.requirePermission` 提供统一权限检查入口；无权限返回 403。
- `/getInfo` 返回当前用户实际权限编码。

当前种子权限为：

- `project:read`
- `project:create`
- `project:update`
- `api-key:read`
- `api-key:manage`

角色权限关系由 Flyway V3 初始化。权限表只描述授权关系，不新增用户管理、项目成员管理、Audit 或 Usage 行为。

## Contract 影响

本阶段没有修改既有 OpenAPI 路由和请求字段。`/getInfo` 已有 `permissions` 响应字段，本阶段将其从固定空列表改为数据库授权结果。新增的权限编码属于 RBAC 内部数据模型；如果后续需要对外暴露新的权限 Contract，应单独提交 Contract 变更审查。

## 验证

`mvn test`：60 项测试，0 失败，0 错误，2 项按环境跳过。
