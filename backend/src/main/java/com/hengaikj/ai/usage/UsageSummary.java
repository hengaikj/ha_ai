package com.hengaikj.ai.usage;

import java.time.Instant;

public record UsageSummary(String requestId, String projectId, String model,
                           String executionResult, Instant createdAt) {}
