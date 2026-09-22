# M01 Design Clarifications

- DC-M01-001：OPEN。ApiKeySummary含ENABLED/DISABLED/REVOKED，且存在enable端点，但当前证据未明确REVOKED调用enable是否409。高保真不为REVOKED展示启用动作，等待确认。
- DC-M01-002：OPEN。ProjectSummary提供status字符串，但未见枚举；可预留状态位置，不定义状态集合/颜色语义。
- DC-M01-003：OPEN。Logical Model / Provider / Channel路径与创建动作已确认，具体列表字段继续从完整components schema提取。
