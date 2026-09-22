package com.hengaikj.ai.entity;
import java.time.Instant;
/** 对外API Key摘要；严禁包含完整Secret或keyHash。 */
public record ApiKeySummary(Long apiKeyId,String keyName,String keyPrefix,String status,Instant expiresAt,Instant createdAt) {}
