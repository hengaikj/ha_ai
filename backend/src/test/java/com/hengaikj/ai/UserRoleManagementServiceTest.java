package com.hengaikj.ai;

import com.hengaikj.ai.auth.dto.UserRoleBindingRequest;
import com.hengaikj.ai.auth.dto.UserStatusRequest;
import com.hengaikj.ai.auth.dto.UserCreateRequest;
import com.hengaikj.ai.auth.dto.EnterpriseOption;
import com.hengaikj.ai.auth.entity.EnterpriseEntity;
import com.hengaikj.ai.auth.entity.AuthRoleEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.AuthUserRoleEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import com.hengaikj.ai.auth.mapper.EnterpriseMapper;
import com.hengaikj.ai.auth.mapper.AuthAuditEventMapper;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.UserRoleManagementService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserRoleManagementServiceTest {
    private final AuthUserMapper users = mock(AuthUserMapper.class);
    private final AuthRoleMapper roles = mock(AuthRoleMapper.class);
    private final AuthUserRoleMapper userRoles = mock(AuthUserRoleMapper.class);
    private final EnterpriseMapper enterprises = mock(EnterpriseMapper.class);
    private final AuthzService authz = mock(AuthzService.class);
    private final AuthAuditEventMapper audit = mock(AuthAuditEventMapper.class);
    private final UserRoleManagementService service = new UserRoleManagementService(
            users, roles, userRoles, enterprises, new BCryptPasswordEncoder(), authz, audit);

    @Test
    void enterpriseListUsesActorEnterpriseAndNeverMapsPasswordHash() {
        AuthUserEntity user = user(11L, 100L);
        when(users.selectList(any())).thenReturn(List.of(user));
        when(roles.selectRoleCodesByUserId(11L)).thenReturn(List.of("enterprise-admin"));
        var result = service.list(actor(7L, 100L, "enterprise-admin"));
        assertEquals(1, result.size());
        assertEquals("user-11", result.get(0).username());
        verify(users).selectList(any());
    }

    @Test
    void roleBindingInsertsOnlyApprovedGlobalRole() {
        AuthUserEntity target = user(11L, 100L);
        AuthRoleEntity role = new AuthRoleEntity();
        role.id = 3L;
        role.roleCode = "enterprise-admin";
        when(users.selectById(11L)).thenReturn(target);
        when(roles.selectByRoleCode("enterprise-admin")).thenReturn(role);
        when(roles.selectRoleCodesByUserId(11L)).thenReturn(List.of("enterprise-admin"));
        service.bind(actor(7L, 100L, "enterprise-admin"), 11L,
                new UserRoleBindingRequest(List.of("enterprise-admin")));
        verify(userRoles).insert(org.mockito.ArgumentMatchers.<AuthUserRoleEntity>any());
    }

    @Test
    void enterpriseAdminCannotBindPlatformRole() {
        AuthUserEntity target = user(11L, 100L);
        when(users.selectById(11L)).thenReturn(target);
        assertThrows(AccessDeniedException.class, () -> service.bind(actor(7L, 100L, "enterprise-admin"), 11L,
                new UserRoleBindingRequest(List.of("platform-admin"))));
        verifyNoInteractions(userRoles);
    }

    @Test
    void enterpriseAdminCannotChangeOtherEnterpriseUser() {
        when(users.selectById(11L)).thenReturn(user(11L, 200L));
        assertThrows(AccessDeniedException.class, () -> service.changeStatus(actor(7L, 100L, "enterprise-admin"), 11L,
                new UserStatusRequest("DISABLED")));
    }

    @Test
    void platformAdminCannotCreateUserInMissingEnterprise() {
        when(enterprises.selectById(999L)).thenReturn(null);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.create(platformActor(), new UserCreateRequest(
                        "new-user", "VerySecurePass123", "New User", 999L, List.of())));
        verify(users, never()).insert(org.mockito.ArgumentMatchers.<AuthUserEntity>any());
    }

    @Test
    void platformAdminCannotCreateUserInInactiveEnterprise() {
        EnterpriseEntity enterprise = new EnterpriseEntity();
        enterprise.id = 100L;
        enterprise.status = "DISABLED";
        when(enterprises.selectById(100L)).thenReturn(enterprise);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> service.create(platformActor(), new UserCreateRequest(
                        "new-user", "VerySecurePass123", "New User", 100L, List.of())));
        verify(users, never()).insert(org.mockito.ArgumentMatchers.<AuthUserEntity>any());
    }

    @Test
    void platformAdminGetsOnlyActiveEnterpriseOptions() {
        EnterpriseEntity active = new EnterpriseEntity();
        active.id = 100L;
        active.displayName = "Active Enterprise";
        active.status = "ACTIVE";
        when(enterprises.selectList(any())).thenReturn(List.of(active));
        assertEquals(List.of(new EnterpriseOption(100L, "Active Enterprise")),
                service.activeEnterpriseOptions(platformActor()));
    }

    @Test
    void enterpriseAdminCannotReadGlobalEnterpriseOptions() {
        assertThrows(AccessDeniedException.class,
                () -> service.activeEnterpriseOptions(actor(7L, 100L, "enterprise-admin")));
        verify(enterprises, never()).selectList(any());
    }

    private static AuthUserEntity user(long id, long enterpriseId) {
        AuthUserEntity user = new AuthUserEntity();
        user.id = id; user.username = "user-" + id; user.displayName = "User"; user.enterpriseId = enterpriseId; user.status = "ACTIVE";
        user.passwordHash = "bcrypt-hash";
        return user;
    }

    private static AuthUserContext actor(long id, long enterpriseId, String role) {
        return new AuthUserContext(id, "actor", "Actor", enterpriseId, Set.of(role), List.of(), Map.of(),
                Set.of("user:read", "user:update", "user:role:manage", "role:read"));
    }

    private static AuthUserContext platformActor() {
        return new AuthUserContext(1L, "platform", "Platform", null, Set.of("platform-admin"), List.of(), Map.of(),
                Set.of("user:create", "user:role:manage"));
    }
}
