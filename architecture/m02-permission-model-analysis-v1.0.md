# M02 Permission Model

采用：

RBAC + DataScope

模型：

User
 -> UserRole
 -> Role
 -> RolePermission
 -> Permission

项目域：

User
 -> ProjectMember
 -> ProjectRole
 -> Project

DataScope:
ALL / ENTERPRISE / PROJECT / SELF
