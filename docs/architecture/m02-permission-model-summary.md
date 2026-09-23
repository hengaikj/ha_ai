# M02 Permission Model Summary

采用：
RBAC + DataScope

核心：
User -> UserRole -> Role -> RolePermission -> Permission

项目域：
Project -> ProjectMember -> ProjectRole

DataScope:
ALL / ENTERPRISE / PROJECT / SELF

Human API:
JWT

AI Gateway:
API Key
