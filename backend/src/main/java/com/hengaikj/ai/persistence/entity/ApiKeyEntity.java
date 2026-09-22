package com.hengaikj.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_ai_api_key")
public class ApiKeyEntity {
    @TableId(type = IdType.INPUT)
    public Long apiKeyId;
    public Long enterpriseId;
    public Long projectId;
    public String keyName;
    public String keyPrefix;
    public String keyHash;
    public String entitlementMode;
    public String status;
    public LocalDateTime expiresAt;
    public LocalDateTime revokedAt;
    public Long version;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public Long getApiKeyId() { return apiKeyId; }
    public Long getEnterpriseId() { return enterpriseId; }
    public Long getProjectId() { return projectId; }
    public String getKeyHash() { return keyHash; }
    public String getStatus() { return status; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public LocalDateTime getRevokedAt() { return revokedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
