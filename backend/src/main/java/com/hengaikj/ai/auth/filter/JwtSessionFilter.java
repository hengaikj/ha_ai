package com.hengaikj.ai.auth.filter;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthSessionMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;

public class JwtSessionFilter extends OncePerRequestFilter {
    private final AuthSessionMapper sessions;
    private final AuthUserMapper users;
    private final ObjectMapper objectMapper;

    public JwtSessionFilter(AuthSessionMapper sessions, AuthUserMapper users, ObjectMapper objectMapper) {
        this.sessions = sessions;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.equals("/login") || path.equals("/api/captchaImage") || path.startsWith("/v1/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuthentication && !hasActiveSession(jwtAuthentication)) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(response.getOutputStream(), Map.of("code", 401, "msg", "登录状态已失效"));
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean hasActiveSession(JwtAuthenticationToken authentication) {
        String jti = authentication.getToken().getId();
        String subject = authentication.getToken().getSubject();
        if (jti == null || subject == null) return false;
        AuthSessionEntity session = sessions.selectOne(new QueryWrapper<AuthSessionEntity>().eq("jti", jti));
        if (session == null || session.revokedAt != null || session.expiresAt == null) return false;
        if (!Long.toString(session.userId).equals(subject)) return false;
        if (!session.expiresAt.toInstant(ZoneOffset.UTC).isAfter(Instant.now())) return false;
        AuthUserEntity user = users.selectById(session.userId);
        return user != null && "ACTIVE".equals(user.status);
    }
}
