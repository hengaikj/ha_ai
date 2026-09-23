package com.hengaikj.ai;

import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthPermissionMapper;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.ProjectMemberMapper;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.mapper.ProjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RbacAuthorizationTest {
    @Test
    void userContextIncludesDatabasePermissions() {
        AuthUserMapper users = mock(AuthUserMapper.class);
        AuthRoleMapper roles = mock(AuthRoleMapper.class);
        ProjectMemberMapper members = mock(ProjectMemberMapper.class);
        ProjectMapper projects = mock(ProjectMapper.class);
        AuthPermissionMapper permissions = mock(AuthPermissionMapper.class);
        AuthUserEntity user = new AuthUserEntity();
        user.id = 7L;
        user.username = "member";
        user.displayName = "Member";
        user.status = "ACTIVE";
        when(users.selectById(7L)).thenReturn(user);
        when(roles.selectRoleCodesByUserId(7L)).thenReturn(List.of("project-admin"));
        when(members.selectProjectRolesByUserId(7L)).thenReturn(List.of());
        when(permissions.selectPermissionCodesByUserId(7L)).thenReturn(List.of("project:read", "api-key:manage"));

        AuthzService authz = new AuthzService(users, roles, members, projects, permissions);
        AuthUserContext context = authz.currentUser(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("7", "", List.of()));

        assertDoesNotThrow(() -> authz.requirePermission(context, "api-key:manage"));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> authz.requirePermission(context, "project:update"));
    }

    @Test
    void legacyContextWithoutPermissionStoreHasNoImplicitPermissions() {
        AuthUserContext context = new AuthUserContext(1L, "u", "U", 10L,
                Set.of("project-admin"), List.of(2L), Map.of(2L, Set.of("project-admin")));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> new AuthzService(mock(AuthUserMapper.class), mock(AuthRoleMapper.class),
                        mock(ProjectMemberMapper.class), mock(ProjectMapper.class))
                        .requirePermission(context, "project:update"));
    }
}
