package com.hengaikj.ai.auth.dto;

import java.util.List;

public record UserSummary(long userId, String username, String displayName,
                          Long enterpriseId, String status, List<String> roleCodes) {}
