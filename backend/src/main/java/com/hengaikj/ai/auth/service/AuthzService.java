package com.hengaikj.ai.auth.service;

import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthPermissionMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.ProjectMemberMapper;
import com.hengaikj.ai.entity.ProjectEntity;
import com.hengaikj.ai.mapper.ProjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class AuthzService {
    private static final String PLATFORM_ADMIN = "platform-admin";
    private static final String ENTERPRISE_ADMIN = "enterprise-admin";
    private final AuthUserMapper users;
    private final AuthRoleMapper roles;
    private final ProjectMemberMapper members;
    private final ProjectMapper projects;
    private final AuthPermissionMapper permissions;

    @Autowired
    public AuthzService(AuthUserMapper users, AuthRoleMapper roles, ProjectMemberMapper members,
                        ProjectMapper projects, ObjectProvider<AuthPermissionMapper> permissions) {
        this.users = users;
        this.roles = roles;
        this.members = members;
        this.projects = projects;
        this.permissions = permissions.getIfAvailable();
    }

    public AuthzService(AuthUserMapper users, AuthRoleMapper roles, ProjectMemberMapper members,
                        ProjectMapper projects, AuthPermissionMapper permissions) {
        this.users = users;
        this.roles = roles;
        this.members = members;
        this.projects = projects;
        this.permissions = permissions;
    }

    public AuthzService(AuthUserMapper users, AuthRoleMapper roles, ProjectMemberMapper members, ProjectMapper projects) {
        this(users, roles, members, projects, (AuthPermissionMapper) null);
    }

    public AuthUserContext currentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录状态无效");
        }
        final long userId;
        try {
            userId = Long.parseLong(authentication.getName());
        } catch (RuntimeException invalidPrincipal) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录状态无效");
        }
        AuthUserEntity user = users.selectById(userId);
        if (user == null || !"ACTIVE".equals(user.status)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录状态无效");
        }
        Set<String> globalRoles = new HashSet<>(safe(roles.selectRoleCodesByUserId(userId)));
        Map<Long, Set<String>> projectRoles = new HashMap<>();
        for (ProjectMemberMapper.ProjectRoleRow row : safe(members.selectProjectRolesByUserId(userId))) {
            if (row.projectId != null && row.roleCode != null) {
                projectRoles.computeIfAbsent(row.projectId, ignored -> new HashSet<>()).add(row.roleCode);
            }
        }
        Set<String> exposedRoles = new HashSet<>(globalRoles);
        projectRoles.values().forEach(exposedRoles::addAll);
        return new AuthUserContext(user.id, user.username, user.displayName, user.enterpriseId, exposedRoles,
                projectRoles.keySet().stream().sorted().toList(), projectRoles,
                permissions == null ? Set.of() : new HashSet<>(safe(permissions.selectPermissionCodesByUserId(userId))));
    }

    public void requirePermission(AuthUserContext user, String permissionCode) {
        if (user.permissionCodes().contains(permissionCode)) return;
        throw new AccessDeniedException("无权执行该操作");
    }

    public ProjectScope requireProjectAccess(AuthUserContext user, long projectId, ProjectAction action) {
        ProjectEntity project = projects.selectById(projectId);
        if (project == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "项目不存在");
        boolean platform = user.roleCodes().contains(PLATFORM_ADMIN);
        boolean sameEnterprise = user.enterpriseId() != null && user.enterpriseId().equals(project.enterpriseId);
        if (!platform && !sameEnterprise) throw new AccessDeniedException("无权访问该项目");
        if (platform) return new ProjectScope(project.id, project.enterpriseId);
        if (user.roleCodes().contains(ENTERPRISE_ADMIN)) return new ProjectScope(project.id, project.enterpriseId);
        Set<String> projectRoles = user.projectRoleCodes().getOrDefault(projectId, Set.of());
        boolean allowed = switch (action) {
            case READ_PROJECT -> hasAny(projectRoles, "project-admin", "project-developer", "project-viewer");
            case READ_KEYS -> hasAny(projectRoles, "project-admin", "project-developer");
            case MANAGE_KEYS -> projectRoles.contains("project-admin");
            case READ_USAGE -> hasAny(projectRoles, "project-admin", "project-developer", "project-viewer");
            case CREATE_PROJECT -> false;
        };
        if (!allowed) throw new AccessDeniedException("无权执行该项目操作");
        return new ProjectScope(project.id, project.enterpriseId);
    }

    public Long requireProjectCreation(AuthUserContext user, Long targetEnterpriseId) {
        if (user.roleCodes().contains(PLATFORM_ADMIN)) {
            if (targetEnterpriseId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "enterpriseId不能为空");
            return targetEnterpriseId;
        }
        if (user.roleCodes().contains(ENTERPRISE_ADMIN) && user.enterpriseId() != null) {
            if (targetEnterpriseId == null) return user.enterpriseId();
            throw new AccessDeniedException("只有平台管理员可以指定企业");
        }
        if (targetEnterpriseId != null) throw new AccessDeniedException("无权指定企业");
        throw new AccessDeniedException("无权创建项目");
    }

    private static boolean hasAny(Set<String> roles, String... candidates) {
        for (String candidate : candidates) if (roles.contains(candidate)) return true;
        return false;
    }

    private static <T> List<T> safe(List<T> values) { return values == null ? List.of() : values; }

    public enum ProjectAction { READ_PROJECT, READ_KEYS, MANAGE_KEYS, READ_USAGE, CREATE_PROJECT }
    public record ProjectScope(long projectId, long enterpriseId) {}
}
