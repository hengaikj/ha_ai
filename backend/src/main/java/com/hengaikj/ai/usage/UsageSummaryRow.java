package com.hengaikj.ai.usage;

import java.time.LocalDateTime;

public class UsageSummaryRow {
    private String requestId;
    private Long projectId;
    private String model;
    private String executionResult;
    private LocalDateTime createdAt;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getExecutionResult() { return executionResult; }
    public void setExecutionResult(String executionResult) { this.executionResult = executionResult; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
