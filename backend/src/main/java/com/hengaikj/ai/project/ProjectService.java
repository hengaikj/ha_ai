package com.hengaikj.ai.project;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.hengaikj.ai.auth.entity.EnterpriseEntity;
import com.hengaikj.ai.auth.mapper.EnterpriseMapper;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.entity.ProjectEntity;
import com.hengaikj.ai.mapper.ProjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ProjectService {
    private final ProjectMapper projects;
    private final EnterpriseMapper enterprises;
    private final AuthzService authz;

    public ProjectService(ProjectMapper projects, EnterpriseMapper enterprises, AuthzService authz) {
        this.projects = projects;
        this.enterprises = enterprises;
        this.authz = authz;
    }

    public List<ProjectSummary> list(AuthUserContext user) {
        QueryWrapper<ProjectEntity> query = new QueryWrapper<>();
        if (!user.roleCodes().contains("platform-admin")) {
            if (user.roleCodes().contains("enterprise-admin")) {
                query.eq("enterprise_id", user.enterpriseId());
            } else if (user.projectIds().isEmpty()) {
                query.eq("id", -1L);
            } else {
                query.eq("enterprise_id", user.enterpriseId()).in("id", user.projectIds());
            }
        }
        query.orderByDesc("id");
        return projects.selectList(query).stream().map(ProjectService::summary).toList();
    }

    @Transactional
    public ProjectSummary create(AuthUserContext user, ProjectCreateRequest request) {
        Long enterpriseId = authz.requireProjectCreation(user, request.enterpriseId());
        EnterpriseEntity enterprise = enterprises.selectById(enterpriseId);
        if (enterprise == null || !"ACTIVE".equals(enterprise.status)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "企业不存在或不可用");
        }
        long duplicates = projects.selectCount(new QueryWrapper<ProjectEntity>()
                .eq("enterprise_id", enterpriseId).eq("project_code", request.projectCode().trim()));
        if (duplicates > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "项目编码已存在");
        ProjectEntity project = new ProjectEntity();
        project.enterpriseId = enterpriseId;
        project.projectCode = request.projectCode().trim();
        project.name = request.projectName().trim();
        project.entitlementMode = request.entitlementMode();
        project.status = "ACTIVE";
        try {
            if (projects.insert(project) != 1 || project.id == null) {
                throw new IllegalStateException("项目创建失败");
            }
        } catch (DuplicateKeyException duplicate) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "项目编码已存在");
        }
        return summary(project);
    }

    private static ProjectSummary summary(ProjectEntity project) {
        return new ProjectSummary(Long.toString(project.id), project.projectCode, project.name,
                project.entitlementMode, project.status);
    }
}
