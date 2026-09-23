package com.hengaikj.ai.auth.service;

import com.hengaikj.ai.auth.dto.LoginRequest;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class AuthService {
    private static final int MAX_FAILURES = 5;
    private static final int LOCK_MINUTES = 15;
    private static final String FAILURE_MESSAGE = "用户名或密码错误";

    private final AuthUserMapper users;
    private final PasswordEncoder passwordEncoder;
    private final JwtSessionService sessions;
    private final Clock clock;
    private final String timingHash;

    public AuthService(AuthUserMapper users, PasswordEncoder passwordEncoder, JwtSessionService sessions, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.sessions = sessions;
        this.clock = clock;
        this.timingHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public LoginResult login(LoginRequest request) {
        if (request == null || request.username() == null || request.password() == null || request.username().isBlank() || request.password().isBlank()) {
            throw new AuthenticationFailedException(FAILURE_MESSAGE);
        }
        String username = request.username().trim();
        AuthUserEntity user = users.selectByUsernameForUpdate(username);
        if (user == null) {
            passwordEncoder.matches(request.password(), timingHash);
            throw new AuthenticationFailedException(FAILURE_MESSAGE);
        }
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        boolean passwordMatches = passwordEncoder.matches(request.password(), user.passwordHash);
        if (!"ACTIVE".equals(user.status) || (user.lockedUntil != null && user.lockedUntil.isAfter(now))) {
            throw new AuthenticationFailedException(FAILURE_MESSAGE);
        }
        if (!passwordMatches) {
            int failures = (user.failedLoginCount == null ? 0 : user.failedLoginCount) + 1;
            user.failedLoginCount = failures;
            if (failures >= MAX_FAILURES) user.lockedUntil = now.plusMinutes(LOCK_MINUTES);
            users.updateById(user);
            throw new AuthenticationFailedException(FAILURE_MESSAGE);
        }
        user.failedLoginCount = 0;
        user.lockedUntil = null;
        user.lastLoginAt = now;
        users.updateById(user);
        JwtSessionService.IssuedSession issued = sessions.issue(user.id);
        return new LoginResult(issued.accessToken(), issued.expiresIn());
    }

    public record LoginResult(String accessToken, long expiresIn) {}

    public static final class AuthenticationFailedException extends RuntimeException {
        public AuthenticationFailedException(String message) { super(message); }
    }
}
