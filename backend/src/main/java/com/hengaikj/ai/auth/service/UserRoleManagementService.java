package com.hengaikj.ai.auth.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.hengaikj.ai.auth.dto.RoleSummary;
import com.hengaikj.ai.auth.dto.EnterpriseOption;
import com.hengaikj.ai.auth.dto.UserCreateRequest;
import com.hengaikj.ai.auth.dto.UserRoleBindingRequest;
import com.hengaikj.ai.auth.dto.UserStatusRequest;
import com.hengaikj.ai.auth.dto.UserSummary;
import com.hengaikj.ai.auth.dto.UserPage;
import com.hengaikj.ai.auth.entity.EnterpriseEntity;
import com.hengaikj.ai.auth.entity.AuthRoleEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.AuthUserRoleEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import com.hengaikj.ai.auth.mapper.EnterpriseMapper;
import com.hengaikj.ai.auth.mapper.AuthAuditEventMapper;
import com.hengaikj.ai.auth.entity.AuthAuditEventEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class UserRoleManagementService {
    private static final String PLATFORM_ADMIN = "platform-admin";
    private static final String ENTERPRISE_ADMIN = "enterprise-admin";
    private static final Set<String> PROJECT_ROLES = Set.of("project-admin", "project-developer", "project-viewer");
    private final AuthUserMapper users;
    private final AuthRoleMapper roles;
    private final AuthUserRoleMapper userRoles;
    private final EnterpriseMapper enterprises;
    private final PasswordEncoder passwords;
    private final AuthzService authz;
    private final AuthAuditEventMapper audit;

    public UserRoleManagementService(AuthUserMapper users, AuthRoleMapper roles, AuthUserRoleMapper userRoles,
                                     EnterpriseMapper enterprises, PasswordEncoder passwords, AuthzService authz) {
        this(users, roles, userRoles, enterprises, passwords, authz, null);
    }
    @Autowired
    public UserRoleManagementService(AuthUserMapper users, AuthRoleMapper roles, AuthUserRoleMapper userRoles,
                                     EnterpriseMapper enterprises, PasswordEncoder passwords, AuthzService authz, @Nullable AuthAuditEventMapper audit) {
        this.users = users;
        this.roles = roles;
        this.userRoles = userRoles;
        this.enterprises = enterprises;
        this.passwords = passwords;
        this.authz = authz;
        this.audit = audit;
    }

    public UserPage list(AuthUserContext actor, int page, int pageSize, String keyword, String status) {
        authz.requirePermission(actor, "user:read");
        page = Math.max(1, page); pageSize = Math.min(100, Math.max(1, pageSize));
        QueryWrapper<AuthUserEntity> query = new QueryWrapper<>();
        if (!isPlatform(actor)) query.eq("enterprise_id", requireEnterprise(actor));
        if (keyword != null && !keyword.isBlank()) query.and(q -> q.like("username", keyword.trim()).or().like("display_name", keyword.trim()));
        if (status != null && !status.isBlank()) query.eq("status", status);
        query.orderByAsc("id");
        long total = users.selectCount(query);
        query.last("LIMIT " + pageSize + " OFFSET " + ((long)(page - 1) * pageSize));
        return new UserPage(total, page, pageSize, users.selectList(query).stream().map(this::summary).toList());
    }
    /** Compatibility helper for existing service callers. */
    public List<UserSummary> list(AuthUserContext actor) { return list(actor, 1, 100, null, null).items(); }

    public List<RoleSummary> roles(AuthUserContext actor) {
        authz.requirePermission(actor, "role:read");
        QueryWrapper<AuthRoleEntity> q = new QueryWrapper<AuthRoleEntity>().orderByAsc("id");
        q.notIn("role_code", PROJECT_ROLES);
        if (!isPlatform(actor)) q.ne("role_code", PLATFORM_ADMIN);
        return roles.selectList(q).stream()
                .map(role -> new RoleSummary(role.id, role.roleCode, role.displayName)).toList();
    }

    public List<EnterpriseOption> activeEnterpriseOptions(AuthUserContext actor) {
        authz.requirePermission(actor, "user:create");
        if (!isPlatform(actor)) throw new AccessDeniedException("只有平台管理员可以选择企业");
        return enterprises.selectList(new QueryWrapper<EnterpriseEntity>()
                        .eq("status", "ACTIVE").orderByAsc("id"))
                .stream().map(enterprise -> new EnterpriseOption(enterprise.id, enterprise.displayName)).toList();
    }

    @Transactional
    public UserSummary create(AuthUserContext actor, UserCreateRequest request) {
        authz.requirePermission(actor, "user:create");
        Long enterpriseId = targetEnterprise(actor, request.enterpriseId());
        if (users.selectByUsernameForUpdate(request.username().trim()) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
        }
        AuthUserEntity user = new AuthUserEntity();
        user.username = request.username().trim();
        user.passwordHash = passwords.encode(request.password());
        user.displayName = request.displayName().trim();
        user.enterpriseId = enterpriseId;
        user.status = "ACTIVE";
        user.failedLoginCount = 0;
        users.insert(user);
        List<String> requestedRoles = request.roleCodes() == null ? List.of() : request.roleCodes();
        if (!requestedRoles.isEmpty()) authz.requirePermission(actor, "user:role:manage");
        bind(actor, user, new UserRoleBindingRequest(requestedRoles));
        return summary(user);
    }

    @Transactional
    public UserSummary changeStatus(AuthUserContext actor, long userId, UserStatusRequest request) {
        authz.requirePermission(actor, "user:update");
        AuthUserEntity user = requireUser(userId);
        checkScope(actor, user);
        if (!Set.of("ACTIVE", "DISABLED").contains(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户状态不合法");
        }
        if ("DISABLED".equals(request.status()) && user.id == actor.userId()) throw new ResponseStatusException(HttpStatus.CONFLICT, "不能停用自己");
        if ("DISABLED".equals(request.status()) && roles.selectRoleCodesByUserId(user.id).contains(PLATFORM_ADMIN)
                && users.countActivePlatformAdmins() <= 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "不能停用最后一个平台管理员");
        user.status = request.status();
        users.updateById(user);
        recordAudit(actor, user.id, "USER_STATUS_CHANGED");
        return summary(user);
    }

    @Transactional
    public UserSummary bind(AuthUserContext actor, long userId, UserRoleBindingRequest request) {
        authz.requirePermission(actor, "user:role:manage");
        AuthUserEntity user = requireUser(userId);
        return bind(actor, user, request);
    }

    private UserSummary bind(AuthUserContext actor, AuthUserEntity user, UserRoleBindingRequest request) {
        checkScope(actor, user);
        List<String> requested = request.roleCodes().stream().filter(Objects::nonNull).distinct().toList();
        if (!isPlatform(actor) && requested.stream().anyMatch(code -> !ENTERPRISE_ADMIN.equals(code))) {
            throw new AccessDeniedException("企业管理员只能绑定企业管理员角色");
        }
        if (requested.stream().anyMatch(PROJECT_ROLES::contains)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "项目角色必须通过项目成员关系绑定");
        }
        userRoles.delete(new QueryWrapper<AuthUserRoleEntity>().eq("user_id", user.id));
        for (String roleCode : requested) {
            AuthRoleEntity role = roles.selectByRoleCode(roleCode);
            if (role == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "角色不存在");
            AuthUserRoleEntity link = new AuthUserRoleEntity();
            link.userId = user.id;
            link.roleId = role.id;
            userRoles.insert(link);
        }
        recordAudit(actor, user.id, "USER_ROLES_REPLACED");
        return summary(user);
    }
    private void recordAudit(AuthUserContext actor, Long target, String action) {
        if (audit == null) return;
        AuthAuditEventEntity e = new AuthAuditEventEntity(); e.actorUserId = actor.userId(); e.targetUserId = target; e.action = action; audit.insert(e);
    }

    private UserSummary summary(AuthUserEntity user) {
        List<String> roleCodes = roles.selectRoleCodesByUserId(user.id);
        return new UserSummary(user.id, user.username, user.displayName, user.enterpriseId, user.status,
                roleCodes == null ? List.of() : roleCodes.stream().sorted().toList());
    }

    private AuthUserEntity requireUser(long userId) {
        AuthUserEntity user = users.selectById(userId);
        if (user == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        return user;
    }

    private void checkScope(AuthUserContext actor, AuthUserEntity target) {
        if (!isPlatform(actor) && !Objects.equals(actor.enterpriseId(), target.enterpriseId)) {
            throw new AccessDeniedException("无权管理其他企业用户");
        }
    }

    private Long targetEnterprise(AuthUserContext actor, Long requested) {
        if (isPlatform(actor)) {
            if (requested == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "enterpriseId不能为空");
            return requireActiveEnterprise(requested);
        }
        Long own = requireEnterprise(actor);
        if (requested != null && !own.equals(requested)) throw new AccessDeniedException("无权指定其他企业");
        return requireActiveEnterprise(own);
    }

    private Long requireActiveEnterprise(Long enterpriseId) {
        EnterpriseEntity enterprise = enterprises.selectById(enterpriseId);
        if (enterprise == null || !"ACTIVE".equals(enterprise.status)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "企业不存在或不可用");
        }
        return enterpriseId;
    }

    private long requireEnterprise(AuthUserContext actor) {
        if (actor.enterpriseId() == null) throw new AccessDeniedException("缺少企业范围");
        return actor.enterpriseId();
    }

    private boolean isPlatform(AuthUserContext actor) { return actor.roleCodes().contains(PLATFORM_ADMIN); }
}
