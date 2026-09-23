package com.hengaikj.ai.auth.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.mapper.AuthSessionMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class JwtSessionService {
    private final JwtEncoder encoder;
    private final AuthSessionMapper sessions;
    private final String issuer;
    private final long ttlSeconds;

    public JwtSessionService(JwtEncoder encoder, AuthSessionMapper sessions,
                             @Value("${app.auth.jwt.issuer:https://ha-ai.local}") String issuer,
                             @Value("${app.auth.jwt.ttl-seconds:3600}") long ttlSeconds) {
        if (ttlSeconds <= 0 || ttlSeconds > 3600) throw new IllegalStateException("AUTH_JWT_TTL_SECONDS must be 1..3600");
        this.encoder = encoder;
        this.sessions = sessions;
        this.issuer = issuer;
        this.ttlSeconds = ttlSeconds;
    }

    @Transactional
    public IssuedSession issue(long userId) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(ttlSeconds);
        String jti = UUID.randomUUID().toString();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(Long.toString(userId))
                .id(jti)
                .issuedAt(now)
                .expiresAt(expiresAt)
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        AuthSessionEntity session = new AuthSessionEntity();
        session.jti = jti;
        session.userId = userId;
        session.issuedAt = LocalDateTime.ofInstant(now, ZoneOffset.UTC);
        session.expiresAt = LocalDateTime.ofInstant(expiresAt, ZoneOffset.UTC);
        if (sessions.insert(session) != 1) throw new IllegalStateException("JWT session persistence failed");
        return new IssuedSession(token, jti, expiresAt, ttlSeconds);
    }

    @Transactional
    public void revoke(String jti) {
        if (jti == null || jti.isBlank()) return;
        sessions.update(null, new UpdateWrapper<AuthSessionEntity>()
                .eq("jti", jti)
                .isNull("revoked_at")
                .set("revoked_at", LocalDateTime.ofInstant(Instant.now(), ZoneOffset.UTC)));
    }

    public record IssuedSession(String accessToken, String jti, Instant expiresAt, long expiresIn) {}
}
