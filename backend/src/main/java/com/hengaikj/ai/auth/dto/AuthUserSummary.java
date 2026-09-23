package com.hengaikj.ai.auth.dto;

import java.util.List;

public record AuthUserSummary(long userId, String username, String displayName, Long enterpriseId,
                              List<String> roleCodes, List<String> permissionCodes, List<Long> projectIds) {}
