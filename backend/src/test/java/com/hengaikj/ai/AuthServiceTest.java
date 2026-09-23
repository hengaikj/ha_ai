package com.hengaikj.ai;

import com.hengaikj.ai.auth.dto.LoginRequest;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.service.AuthService;
import com.hengaikj.ai.auth.service.JwtSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceTest {
    private final AuthUserMapper users = mock(AuthUserMapper.class);
    private final JwtSessionService sessions = mock(JwtSessionService.class);
    private final PasswordEncoder passwords = new BCryptPasswordEncoder(4);
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-23T00:00:00Z"), ZoneOffset.UTC);
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(users, passwords, sessions, clock);
    }

    @Test
    void failedLoginTransactionMustCommitTheLockCounter() throws Exception {
        Transactional transaction = AuthService.class.getMethod("login", LoginRequest.class).getAnnotation(Transactional.class);
        assertTrue(java.util.Arrays.asList(transaction.noRollbackFor()).contains(AuthService.AuthenticationFailedException.class));
    }

    @Test
    void successfulLoginResetsFailuresAndIssuesOneHourSession() {
        AuthUserEntity user = userWithPassword("correct horse battery staple");
        user.failedLoginCount = 4;
        user.lockedUntil = LocalDateTime.now(clock).minusMinutes(1);
        when(users.selectByUsernameForUpdate("alice")).thenReturn(user);
        when(sessions.issue(41L)).thenReturn(new JwtSessionService.IssuedSession("signed-token", "jti", clock.instant().plusSeconds(3600), 3600));

        var result = service.login(new LoginRequest("alice", "correct horse battery staple", null, null));

        assertEquals("signed-token", result.accessToken());
        assertEquals(3600, result.expiresIn());
        assertEquals(0, user.failedLoginCount);
        assertNull(user.lockedUntil);
        assertNotNull(user.lastLoginAt);
        verify(users).updateById(user);
        verify(sessions).issue(41L);
    }

    @Test
    void fifthFailedPasswordLocksAccountForFifteenMinutes() {
        AuthUserEntity user = userWithPassword("correct password");
        user.failedLoginCount = 4;
        when(users.selectByUsernameForUpdate("alice")).thenReturn(user);

        assertThrows(AuthService.AuthenticationFailedException.class,
                () -> service.login(new LoginRequest("alice", "wrong password", null, null)));

        assertEquals(5, user.failedLoginCount);
        assertEquals(LocalDateTime.now(clock).plusMinutes(15), user.lockedUntil);
        verify(users).updateById(user);
        verifyNoInteractions(sessions);
    }

    @Test
    void lockedAccountReturnsSameAuthenticationFailureWithoutIssuingSession() {
        AuthUserEntity user = userWithPassword("correct password");
        user.failedLoginCount = 5;
        user.lockedUntil = LocalDateTime.now(clock).plusMinutes(5);
        when(users.selectByUsernameForUpdate("alice")).thenReturn(user);

        assertThrows(AuthService.AuthenticationFailedException.class,
                () -> service.login(new LoginRequest("alice", "correct password", null, null)));
        verifyNoInteractions(sessions);
        verify(users, never()).updateById(any(AuthUserEntity.class));
    }

    @Test
    void missingUsernameReturnsSameAuthenticationFailure() {
        when(users.selectByUsernameForUpdate("missing")).thenReturn(null);
        assertThrows(AuthService.AuthenticationFailedException.class,
                () -> service.login(new LoginRequest("missing", "any password", null, null)));
        verifyNoInteractions(sessions);
    }

    private AuthUserEntity userWithPassword(String password) {
        AuthUserEntity user = new AuthUserEntity();
        user.id = 41L;
        user.username = "alice";
        user.displayName = "Alice";
        user.enterpriseId = 100L;
        user.passwordHash = passwords.encode(password);
        user.status = "ACTIVE";
        user.failedLoginCount = 0;
        return user;
    }
}
