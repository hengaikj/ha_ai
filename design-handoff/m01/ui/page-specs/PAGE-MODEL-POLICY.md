# PAGE-MODEL-POLICY 模型权限

接口：GET/PUT /api/projects/{projectId}/models。

已确认能力：查询、配置项目模型权限。具体模型列表字段必须按完整Schema冻结；当前设计只定义页面结构、已授权/未授权交互槽位，不自行创造模型能力、价格或供应商字段。

权限动作使用PermissionButton，后端为最终权限权威。
