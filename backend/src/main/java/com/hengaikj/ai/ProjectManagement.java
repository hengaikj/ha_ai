package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.hengaikj.ai.persistence.entity.ProjectEntity;
import com.hengaikj.ai.persistence.mapper.ProjectMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Project 管理的应用层、领域边界和基础设施实现。 */
interface ProjectRepository {
    ProjectRecord create(long enterpriseId, String code, String name, String entitlementMode);
    ProjectRecord find(long enterpriseId, long projectId);
    ProjectRecord update(long enterpriseId, long projectId, String name, String entitlementMode);
}

final class ProjectRecord {
    final long projectId;
    final long enterpriseId;
    final String projectCode;
    final String projectName;
    final String entitlementMode;
    final String status;

    ProjectRecord(long projectId, long enterpriseId, String projectCode, String projectName,
                  String entitlementMode, String status) {
        this.projectId = projectId;
        this.enterpriseId = enterpriseId;
        this.projectCode = projectCode;
        this.projectName = projectName;
        this.entitlementMode = entitlementMode;
        this.status = status;
    }
}

final class MybatisProjectRepository implements ProjectRepository {
    private final ProjectMapper mapper;

    MybatisProjectRepository(ProjectMapper mapper) { this.mapper = mapper; }

    @Override
    public ProjectRecord create(long enterpriseId, String code, String name, String entitlementMode) {
        if (mapper.selectCount(new QueryWrapper<ProjectEntity>()
                .eq("enterprise_id", enterpriseId).eq("project_code", code)) > 0) {
            throw GatewayException.conflict("企业内项目编码已存在");
        }
        var row = new ProjectEntity();
        row.projectId = nextId();
        row.enterpriseId = enterpriseId;
        row.projectCode = code;
        row.projectName = name;
        row.entitlementMode = entitlementMode;
        row.status = "ACTIVE";
        row.version = 0L;
        row.createdAt = LocalDateTime.now();
        row.updatedAt = row.createdAt;
        mapper.insert(row);
        return toRecord(row);
    }

    @Override
    public ProjectRecord find(long enterpriseId, long projectId) {
        var row = mapper.selectOne(new QueryWrapper<ProjectEntity>()
                .eq("enterprise_id", enterpriseId).eq("project_id", projectId));
        if (row == null) throw GatewayException.notFound("项目不存在");
        return toRecord(row);
    }

    @Override
    public ProjectRecord update(long enterpriseId, long projectId, String name, String entitlementMode) {
        var current = mapper.selectOne(new QueryWrapper<ProjectEntity>()
                .eq("enterprise_id", enterpriseId).eq("project_id", projectId));
        if (current == null) throw GatewayException.notFound("项目不存在");
        var update = new UpdateWrapper<ProjectEntity>().eq("enterprise_id", enterpriseId)
                .eq("project_id", projectId).set("project_name", name)
                .set("entitlement_mode", entitlementMode)
                .set("updated_at", LocalDateTime.now()).setSql("version = version + 1");
        mapper.update(null, update);
        return find(enterpriseId, projectId);
    }

    private long nextId() {
        var values = mapper.selectObjs(new QueryWrapper<ProjectEntity>().select("COALESCE(MAX(project_id),0)+1"));
        return values.isEmpty() ? 1L : ((Number) values.get(0)).longValue();
    }

    private ProjectRecord toRecord(ProjectEntity row) {
        return new ProjectRecord(row.projectId, row.enterpriseId, row.projectCode, row.projectName,
                row.entitlementMode, row.status);
    }
}

final class InMemoryProjectRepository implements ProjectRepository {
    private final AtomicLong sequence = new AtomicLong(1000);
    private final Map<Long, ProjectRecord> rows = new ConcurrentHashMap<>();

    @Override
    public ProjectRecord create(long enterpriseId, String code, String name, String entitlementMode) {
        if (rows.values().stream().anyMatch(p -> p.enterpriseId == enterpriseId && p.projectCode.equals(code))) {
            throw GatewayException.conflict("企业内项目编码已存在");
        }
        var row = new ProjectRecord(sequence.incrementAndGet(), enterpriseId, code, name, entitlementMode, "ACTIVE");
        rows.put(row.projectId, row);
        return row;
    }
    @Override
    public ProjectRecord find(long enterpriseId, long projectId) {
        var row = rows.get(projectId);
        if (row == null || row.enterpriseId != enterpriseId) throw GatewayException.notFound("项目不存在");
        return row;
    }
    @Override
    public ProjectRecord update(long enterpriseId, long projectId, String name, String entitlementMode) {
        var old = find(enterpriseId, projectId);
        var next = new ProjectRecord(old.projectId, old.enterpriseId, old.projectCode, name,
                entitlementMode, old.status);
        rows.put(projectId, next);
        return next;
    }
}

final class ProjectApplicationService {
    private final ProjectRepository repository;

    ProjectApplicationService(ProjectRepository repository) { this.repository = repository; }

    ProjectRecord create(long enterpriseId, ProjectCreateCommand command) {
        validateEnterprise(enterpriseId);
        validateText(command.projectCode(), "projectCode", 64);
        validateText(command.projectName(), "projectName", 128);
        validateMode(command.entitlementMode());
        return repository.create(enterpriseId, command.projectCode().trim(), command.projectName().trim(),
                command.entitlementMode());
    }

    ProjectRecord get(long enterpriseId, long projectId) {
        validateEnterprise(enterpriseId);
        if (projectId <= 0) throw GatewayException.badRequest("projectId必须为正整数");
        return repository.find(enterpriseId, projectId);
    }

    ProjectRecord update(long enterpriseId, long projectId, ProjectUpdateCommand command) {
        validateEnterprise(enterpriseId);
        if (projectId <= 0) throw GatewayException.badRequest("projectId必须为正整数");
        validateText(command.projectName(), "projectName", 128);
        validateMode(command.entitlementMode());
        return repository.update(enterpriseId, projectId, command.projectName().trim(), command.entitlementMode());
    }

    private static void validateEnterprise(long enterpriseId) {
        if (enterpriseId <= 0) throw GatewayException.badRequest("X-Enterprise-Id必须为正整数");
    }
    private static void validateText(String value, String field, int max) {
        if (value == null || value.trim().isEmpty() || value.length() > max) {
            throw GatewayException.badRequest(field + "不能为空且长度不能超过" + max);
        }
    }
    private static void validateMode(String mode) {
        if (!"BALANCE".equals(mode) && !"SUBSCRIPTION".equals(mode)) {
            throw GatewayException.badRequest("entitlementMode仅支持BALANCE或SUBSCRIPTION");
        }
    }
}

record ProjectCreateCommand(String projectCode, String projectName, String entitlementMode) {}
record ProjectUpdateCommand(String projectName, String entitlementMode) {}
