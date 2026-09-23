package com.hengaikj.ai;

import com.hengaikj.ai.auth.entity.AuthRoleEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.AuthUserRoleEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import com.hengaikj.ai.auth.service.AuthBootstrapRunner;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthBootstrapRunnerTest {
    private final AuthUserMapper users = mock(AuthUserMapper.class);
    private final AuthRoleMapper roles = mock(AuthRoleMapper.class);
    private final AuthUserRoleMapper userRoles = mock(AuthUserRoleMapper.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(4);

    @Test
    void createsOnlyAPlatformAdminAndStoresOnlyBcryptPasswordHash() throws Exception {
        when(users.countPlatformAdmins()).thenReturn(0L);
        AuthRoleEntity role = new AuthRoleEntity();
        role.id = 9L;
        when(roles.selectByRoleCode("platform-admin")).thenReturn(role);
        when(users.insert(any(AuthUserEntity.class))).thenAnswer(call -> {
            AuthUserEntity user = call.getArgument(0);
            user.id = 88L;
            return 1;
        });
        when(userRoles.insert(any(AuthUserRoleEntity.class))).thenReturn(1);
        AuthBootstrapRunner runner = new AuthBootstrapRunner(users, roles, userRoles, passwords,
                "local-admin", "local-only-password-2026");

        runner.run(null);

        verify(users).insert(org.mockito.ArgumentMatchers.<AuthUserEntity>argThat(user -> user.id.equals(88L) && user.enterpriseId == null
                && "ACTIVE".equals(user.status) && !user.passwordHash.equals("local-only-password-2026")
                && passwords.matches("local-only-password-2026", user.passwordHash)));
        verify(userRoles).insert(org.mockito.ArgumentMatchers.<AuthUserRoleEntity>argThat(link -> link.userId.equals(88L) && link.roleId.equals(9L)));
    }

    @Test
    void refusesFirstStartupWithoutBootstrapCredentials() {
        when(users.countPlatformAdmins()).thenReturn(0L);
        AuthBootstrapRunner runner = new AuthBootstrapRunner(users, roles, userRoles, passwords, "", "");
        assertThrows(IllegalStateException.class, () -> runner.run(null));
        verify(users, never()).insert(any(AuthUserEntity.class));
    }

    @Test
    void existingPlatformAdminPreventsAnotherBootstrapAccount() throws Exception {
        when(users.countPlatformAdmins()).thenReturn(1L);
        AuthBootstrapRunner runner = new AuthBootstrapRunner(users, roles, userRoles, passwords, "ignored", "ignored");
        assertDoesNotThrow(() -> runner.run(null));
        verify(users, never()).insert(any(AuthUserEntity.class));
        verifyNoInteractions(userRoles);
    }
}
