# M01 UI Implementation Review Contract

Frontend Wave 1完成后必须独立Review，不允许开发Agent自行声明设计还原PASS。

## 结论维度
- VISUAL_COMPLIANCE
- INTERACTION_COMPLIANCE
- STATE_COMPLIANCE
- CONTRACT_COMPLIANCE

每项：PASS / PASS_WITH_ISSUES / REQUEST_CHANGES / NOT_RUN。

## Evidence
- implementation_commit
- pull_request
- build
- type_check
- vitest
- desktop_screenshot
- narrow_screenshot
- contract_field_check
- known_issues

## 核心规则
视觉相似不能替代Contract正确；Contract正确也不能替代状态/响应式Review。未截图不得写VISUAL_COMPLIANCE=PASS。
