package com.hengaikj.ai.entity;
import java.time.Instant;
public record ApiKeyCreateResponse(Long apiKeyId,String keyName,String keyPrefix,String status,Instant expiresAt,Instant createdAt,String secret) {}
