# BE-M02-A 开发任务

目标：
实现 HA AI M02 RBAC 权限基础能力。

范围：
- Permission
- Role
- UserContext
- Authorization

输入：
- M02 API Contract
- M02 Technical Design

验收：
1. 权限校验流程可运行
2. JWT用户上下文可获取
3. 无权限访问返回403
4. 测试通过

禁止：
- 用户CRUD
- ProjectMember
- Audit
- Usage增强
