package com.hengaikj.ai.auth.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record AuthUserContext(long userId, String username, String displayName, Long enterpriseId,
                              Set<String> roleCodes, List<Long> projectIds,
                              Map<Long, Set<String>> projectRoleCodes,
                              Set<String> permissionCodes) {
    public AuthUserContext(long userId, String username, String displayName, Long enterpriseId,
                           Set<String> roleCodes, List<Long> projectIds,
                           Map<Long, Set<String>> projectRoleCodes) {
        this(userId, username, displayName, enterpriseId, roleCodes, projectIds, projectRoleCodes, Set.of());
    }
    public AuthUserContext {
        roleCodes = Set.copyOf(roleCodes);
        projectIds = List.copyOf(projectIds);
        projectRoleCodes = projectRoleCodes.entrySet().stream()
                .collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getKey, e -> Set.copyOf(e.getValue())));
        permissionCodes = Set.copyOf(permissionCodes);
    }
}
