package com.hengaikj.ai.entity;
import java.time.Instant;
public record ApiKeyCreateRequest(String keyName,Instant expiresAt) {}
