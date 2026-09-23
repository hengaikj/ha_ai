package com.hengaikj.ai;

import com.hengaikj.ai.auth.config.JwtConfig;
import com.hengaikj.ai.auth.filter.JwtSessionFilter;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.mapper.AuthSessionMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.service.JwtSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;

import jakarta.servlet.FilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class JwtSessionSecurityTest {
    private static final String SECRET = "development-test-key-32-bytes-minimum-value";

    @Test
    void signsAndValidatesHs256JwtWithRequiredClaims() {
        JwtConfig config = new JwtConfig(SECRET, "https://ha-ai.test");
        JwtEncoder encoder = config.jwtEncoder();
        JwtDecoder decoder = config.jwtDecoder();
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("https://ha-ai.test").subject("12").id("session-12")
                .issuedAt(now).expiresAt(now.plusSeconds(60)).build();
        String token = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        Jwt decoded = decoder.decode(token);
        assertEquals("12", decoded.getSubject());
        assertEquals("session-12", decoded.getId());
        assertEquals("https://ha-ai.test", decoded.getIssuer().toString());
        assertThrows(JwtException.class, () -> config.jwtDecoder().decode("not.a.jwt"));
    }

    @Test
    void rejectsAnExpiredToken() {
        JwtConfig config = new JwtConfig(SECRET, "https://ha-ai.test");
        Instant now = Instant.now();
        String token = config.jwtEncoder().encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder().issuer("https://ha-ai.test").subject("12").id("expired")
                        .issuedAt(now.minusSeconds(120)).expiresAt(now.minusSeconds(60)).build())).getTokenValue();
        assertThrows(JwtException.class, () -> config.jwtDecoder().decode(token));
    }

    @Test
    void refusesShortSigningSecretAtStartup() {
        assertThrows(IllegalStateException.class, () -> new JwtConfig("too-short", "https://ha-ai.test").jwtEncoder());
    }

    @Test
    void rejectsARevokedDatabaseSessionEvenWhenTheJwtSignatureIsValid() throws Exception {
        AuthSessionMapper sessions = mock(AuthSessionMapper.class);
        AuthUserMapper users = mock(AuthUserMapper.class);
        AuthSessionEntity row = new AuthSessionEntity();
        row.userId = 77L;
        row.jti = "revoked-session";
        row.expiresAt = LocalDateTime.now(ZoneOffset.UTC).plusMinutes(5);
        row.revokedAt = LocalDateTime.now(ZoneOffset.UTC);
        when(sessions.selectOne(any())).thenReturn(row);
        when(users.selectById(77L)).thenReturn(activeUser(77L));
        var filter = new ExposedJwtSessionFilter(sessions, users);
        setAuthentication("revoked-session");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] continued = {false};

        filter.invoke(new MockHttpServletRequest("GET", "/getInfo"), response, (request, result) -> continued[0] = true);

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("登录状态已失效"));
        assertFalse(continued[0]);
        SecurityContextHolder.clearContext();
    }

    @Test
    void acceptsAValidNonRevokedDatabaseSession() throws Exception {
        AuthSessionMapper sessions = mock(AuthSessionMapper.class);
        AuthUserMapper users = mock(AuthUserMapper.class);
        AuthSessionEntity row = new AuthSessionEntity();
        row.userId = 77L;
        row.jti = "active-session";
        row.expiresAt = LocalDateTime.now(ZoneOffset.UTC).plusMinutes(5);
        when(sessions.selectOne(any())).thenReturn(row);
        when(users.selectById(77L)).thenReturn(activeUser(77L));
        var filter = new ExposedJwtSessionFilter(sessions, users);
        setAuthentication("active-session");
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean[] continued = {false};

        filter.invoke(new MockHttpServletRequest("GET", "/getInfo"), response, (request, result) -> continued[0] = true);

        assertEquals(200, response.getStatus());
        assertTrue(continued[0]);
        SecurityContextHolder.clearContext();
    }

    private static void setAuthentication(String jti) {
        Instant now = Instant.now();
        var jwt = org.springframework.security.oauth2.jwt.Jwt.withTokenValue("test-token")
                .header("alg", "HS256").subject("77").claim("jti", jti).issuedAt(now).expiresAt(now.plusSeconds(300)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private static AuthUserEntity activeUser(long id) {
        AuthUserEntity user = new AuthUserEntity();
        user.id = id;
        user.status = "ACTIVE";
        return user;
    }

    private static final class ExposedJwtSessionFilter extends JwtSessionFilter {
        ExposedJwtSessionFilter(AuthSessionMapper sessions, AuthUserMapper users) {
            super(sessions, users, new com.fasterxml.jackson.databind.ObjectMapper());
        }
        void invoke(jakarta.servlet.http.HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response,
                    FilterChain chain) throws jakarta.servlet.ServletException, java.io.IOException {
            doFilterInternal(request, response, chain);
        }
    }

    @Test
    void persistsSessionOnIssueAndCanRevokeIt() {
        AuthSessionMapper sessions = mock(AuthSessionMapper.class);
        when(sessions.insert(any(AuthSessionEntity.class))).thenReturn(1);
        JwtConfig config = new JwtConfig(SECRET, "https://ha-ai.test");
        JwtSessionService service = new JwtSessionService(config.jwtEncoder(), sessions, "https://ha-ai.test", 3600);

        var issued = service.issue(77L);
        Jwt decoded = config.jwtDecoder().decode(issued.accessToken());
        assertEquals("77", decoded.getSubject());
        assertEquals(issued.jti(), decoded.getId());
        verify(sessions).insert(org.mockito.ArgumentMatchers.<AuthSessionEntity>argThat(row -> row.userId.equals(77L) && row.jti.equals(issued.jti()) && row.revokedAt == null));

        service.revoke(issued.jti());
        verify(sessions).update(any(), any());
    }
}
