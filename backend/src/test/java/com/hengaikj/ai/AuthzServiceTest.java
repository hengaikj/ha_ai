package com.hengaikj.ai;

import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.ProjectMemberMapper;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.AuthzService.ProjectAction;
import com.hengaikj.ai.entity.ProjectEntity;
import com.hengaikj.ai.mapper.ProjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthzServiceTest {
    private final AuthUserMapper users = mock(AuthUserMapper.class);
    private final AuthRoleMapper roles = mock(AuthRoleMapper.class);
    private final ProjectMemberMapper members = mock(ProjectMemberMapper.class);
    private final ProjectMapper projects = mock(ProjectMapper.class);
    private AuthzService authz;

    @BeforeEach
    void setUp() {
        authz = new AuthzService(users, roles, members, projects);
        ProjectEntity projectA = new ProjectEntity();
        projectA.id = 10L;
        projectA.enterpriseId = 100L;
        ProjectEntity projectB = new ProjectEntity();
        projectB.id = 20L;
        projectB.enterpriseId = 200L;
        when(projects.selectById(10L)).thenReturn(projectA);
        when(projects.selectById(20L)).thenReturn(projectB);
    }

    @Test
    void enterpriseAdminCanManageProjectsInsideItsSingleEnterprise() {
        principal(1, 100L, List.of("enterprise-admin"), List.of());
        var user = authz.currentUser(authentication(1));
        assertEquals(100L, user.enterpriseId());
        assertTrue(user.roleCodes().contains("enterprise-admin"));
        assertDoesNotThrow(() -> authz.requireProjectAccess(user, 10, ProjectAction.MANAGE_KEYS));
        assertThrows(AccessDeniedException.class,
                () -> authz.requireProjectAccess(user, 20, ProjectAction.MANAGE_KEYS));
    }

    @Test
    void projectAdminCanManageOnlyAnAssignedProject() {
        principal(2, 100L, List.of(), List.of(new ProjectMemberMapper.ProjectRoleRow(10L, "project-admin")));
        var user = authz.currentUser(authentication(2));
        assertDoesNotThrow(() -> authz.requireProjectAccess(user, 10, ProjectAction.MANAGE_KEYS));
        assertThrows(AccessDeniedException.class,
                () -> authz.requireProjectAccess(user, 20, ProjectAction.READ_PROJECT));
    }

    @Test
    void developerCanReadButCannotManageApiKeys() {
        principal(3, 100L, List.of(), List.of(new ProjectMemberMapper.ProjectRoleRow(10L, "project-developer")));
        var user = authz.currentUser(authentication(3));
        assertDoesNotThrow(() -> authz.requireProjectAccess(user, 10, ProjectAction.READ_KEYS));
        assertThrows(AccessDeniedException.class,
                () -> authz.requireProjectAccess(user, 10, ProjectAction.MANAGE_KEYS));
    }

    @Test
    void viewerCanReadUsageButCannotReadApiKeys() {
        principal(4, 100L, List.of(), List.of(new ProjectMemberMapper.ProjectRoleRow(10L, "project-viewer")));
        var user = authz.currentUser(authentication(4));
        assertDoesNotThrow(() -> authz.requireProjectAccess(user, 10, ProjectAction.READ_USAGE));
        assertThrows(AccessDeniedException.class,
                () -> authz.requireProjectAccess(user, 10, ProjectAction.READ_KEYS));
    }

    @Test
    void enterpriseAdminUsesItsOwnEnterpriseWhenCreatingProjectWithoutTargetId() {
        principal(6, 100L, List.of("enterprise-admin"), List.of());
        var user = authz.currentUser(authentication(6));
        assertEquals(100L, authz.requireProjectCreation(user, null));
        assertThrows(AccessDeniedException.class, () -> authz.requireProjectCreation(user, 200L));
    }

    @Test
    void platformAdminCanManageAnyEnterprise() {
        principal(5, null, List.of("platform-admin"), List.of());
        var user = authz.currentUser(authentication(5));
        assertNull(user.enterpriseId());
        assertDoesNotThrow(() -> authz.requireProjectAccess(user, 20, ProjectAction.MANAGE_KEYS));
        assertDoesNotThrow(() -> authz.requireProjectCreation(user, 200L));
    }

    private void principal(long userId, Long enterpriseId, List<String> globalRoles,
                           List<ProjectMemberMapper.ProjectRoleRow> projectRoles) {
        AuthUserEntity entity = new AuthUserEntity();
        entity.id = userId;
        entity.enterpriseId = enterpriseId;
        entity.username = "user-" + userId;
        entity.displayName = "User " + userId;
        entity.status = "ACTIVE";
        when(users.selectById(userId)).thenReturn(entity);
        when(roles.selectRoleCodesByUserId(userId)).thenReturn(globalRoles);
        when(members.selectProjectRolesByUserId(userId)).thenReturn(projectRoles);
    }

    private static UsernamePasswordAuthenticationToken authentication(long userId) {
        return UsernamePasswordAuthenticationToken.authenticated(String.valueOf(userId), "", List.of());
    }
}
