package com.hengaikj.ai;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class ModelPolicyService {
    private final Map<String, Set<String>> policies = new ConcurrentHashMap<>();

    public void allow(String projectId, String model) {
        policies.computeIfAbsent(projectId, ignored -> ConcurrentHashMap.newKeySet()).add(model);
    }

    public boolean isAllowed(String projectId, String model) {
        return policies.getOrDefault(projectId, Set.of()).contains(model);
    }

    public Set<String> allowed(String projectId) {
        return Set.copyOf(policies.getOrDefault(projectId, Set.of()));
    }
}
