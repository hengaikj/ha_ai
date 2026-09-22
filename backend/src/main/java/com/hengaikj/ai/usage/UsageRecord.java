package com.hengaikj.ai.usage;
import java.time.Instant;
public record UsageRecord(String requestId,String model,long promptTokens,long completionTokens,long totalTokens,Instant recordedAt) {}
