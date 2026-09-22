package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.hengaikj.ai.persistence.entity.LogicalModelEntity;
import com.hengaikj.ai.persistence.entity.ProjectPolicyEntity;
import com.hengaikj.ai.persistence.mapper.LogicalModelMapper;
import com.hengaikj.ai.persistence.mapper.ProjectPolicyMapper;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class ModelPolicyService {
    private final Map<String, Set<String>> policies = new ConcurrentHashMap<>();
    private final ProjectPolicyMapper policyMapper;
    private final LogicalModelMapper logicalModelMapper;

    public ModelPolicyService() {
        this(null, null);
    }

    public ModelPolicyService(ProjectPolicyMapper policyMapper) {
        this(policyMapper, null);
    }

    public ModelPolicyService(ProjectPolicyMapper policyMapper, LogicalModelMapper logicalModelMapper) {
        this.policyMapper = policyMapper;
        this.logicalModelMapper = logicalModelMapper;
    }

    public void allow(String projectId, String model) {
        if (policyMapper == null || logicalModelMapper == null) {
            policies.computeIfAbsent(projectId, ignored -> ConcurrentHashMap.newKeySet()).add(model);
            return;
        }
        var logicalModel = findOrCreateModel(model);
        var existing = policyMapper.selectOne(new QueryWrapper<ProjectPolicyEntity>()
                .eq("project_id", Long.parseLong(projectId))
                .eq("logical_model_id", logicalModel.logicalModelId)
                .last("LIMIT 1"));
        if (existing == null) {
            var row = new ProjectPolicyEntity();
            row.projectId = Long.parseLong(projectId);
            row.logicalModelId = logicalModel.logicalModelId;
            row.status = "ENABLED";
            row.createdAt = LocalDateTime.now(ZoneOffset.UTC);
            row.updatedAt = row.createdAt;
            policyMapper.insert(row);
        } else if (!"ENABLED".equals(existing.status)) {
            policyMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<ProjectPolicyEntity>()
                    .eq("policy_id", existing.policyId)
                    .set("status", "ENABLED")
                    .set("updated_at", LocalDateTime.now(ZoneOffset.UTC)));
        }
    }

    /** 替换项目的模型授权集合；空集合表示撤销全部授权。 */
    public void replace(String projectId, Set<String> models) {
        if (projectId == null || projectId.isBlank() || models == null
                || models.stream().anyMatch(model -> model == null || model.isBlank())) {
            throw GatewayException.badRequest("项目模型权限参数无效");
        }
        if (policyMapper == null || logicalModelMapper == null) {
            policies.put(projectId, ConcurrentHashMap.newKeySet());
            policies.get(projectId).addAll(Set.copyOf(models));
            return;
        }
        var current = allowed(projectId);
        current.stream().filter(model -> !models.contains(model)).forEach(model -> {
            var entity = logicalModelMapper.selectOne(new QueryWrapper<LogicalModelEntity>()
                    .eq("model_code", model).last("LIMIT 1"));
            if (entity != null) policyMapper.update(null,
                    new com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<ProjectPolicyEntity>()
                            .eq("project_id", Long.parseLong(projectId))
                            .eq("logical_model_id", entity.logicalModelId)
                            .set("status", "DISABLED")
                            .set("updated_at", LocalDateTime.now(ZoneOffset.UTC)));
        });
        models.forEach(model -> allow(projectId, model));
    }

    public boolean isAllowed(String projectId, String model) {
        if (policyMapper == null || logicalModelMapper == null) {
            return policies.getOrDefault(projectId, Set.of()).contains(model);
        }
        var logicalModel = logicalModelMapper.selectOne(new QueryWrapper<LogicalModelEntity>()
                .eq("model_code", model)
                .eq("status", "ENABLED")
                .last("LIMIT 1"));
        if (logicalModel == null) return false;
        return policyMapper.selectCount(new QueryWrapper<ProjectPolicyEntity>()
                .eq("project_id", Long.parseLong(projectId))
                .eq("logical_model_id", logicalModel.logicalModelId)
                .eq("status", "ENABLED")) > 0;
    }

    public Set<String> allowed(String projectId) {
        if (policyMapper == null || logicalModelMapper == null) {
            return Set.copyOf(policies.getOrDefault(projectId, Set.of()));
        }
        return policyMapper.selectList(new QueryWrapper<ProjectPolicyEntity>()
                        .eq("project_id", Long.parseLong(projectId))
                        .eq("status", "ENABLED"))
                .stream()
                .map(row -> logicalModelMapper.selectById(row.logicalModelId))
                .filter(model -> model != null && "ENABLED".equals(model.status))
                .map(model -> model.modelCode)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private LogicalModelEntity findOrCreateModel(String model) {
        var existing = logicalModelMapper.selectOne(new QueryWrapper<LogicalModelEntity>()
                .eq("model_code", model)
                .last("LIMIT 1"));
        if (existing != null) return existing;
        var entity = new LogicalModelEntity();
        entity.logicalModelId = nextLogicalModelId();
        entity.modelCode = model;
        entity.modelName = model;
        entity.status = "ENABLED";
        entity.createdAt = LocalDateTime.now(ZoneOffset.UTC);
        entity.updatedAt = entity.createdAt;
        logicalModelMapper.insert(entity);
        return entity;
    }

    private long nextLogicalModelId() {
        var result = logicalModelMapper.selectObjs(new QueryWrapper<LogicalModelEntity>()
                .select("COALESCE(MAX(logical_model_id), 0) + 1"));
        if (result.isEmpty() || result.get(0) == null) return 1L;
        return ((Number) result.get(0)).longValue();
    }
}
