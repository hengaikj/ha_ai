# M01 UI Contract Gap Register

## CG-UI-001 Platform Model/Provider/Channel DTO缺失
Severity：BLOCKER_FOR_PLATFORM_HIGH_FIDELITY
Status：OPEN

证据：platform-management.yaml存在models/providers/channels GET/POST路径，但components/schemas仅定义通用ErrorResponse、Money、PageMeta、SuccessEnvelope及Project/ApiKey/Usage/Billing摘要，没有LogicalModel/Provider/Channel具体Schema。

影响：
- 无法冻结列表列；
- 无法冻结创建表单；
- 无法生成可交付的平台端高保真业务内容；
- 不阻塞企业端项目/API Key/Usage继续设计。

建议：Contract Owner补充相应Request/Response Schema，再由UI Agent消费；UI Agent不得反向定义API。

## CG-UI-002 Requirement语义清单不足
Severity：BLOCKER_FOR_FORMAL_TRACEABILITY
Status：OPEN

当前requirements.json只含REQ ID、P0、APPROVED，没有需求描述/AC，因此不能完成正式REQ→UI语义追溯。已有Baseline文档可作为人工参考，但机器Contract仍应补全描述或引用。
