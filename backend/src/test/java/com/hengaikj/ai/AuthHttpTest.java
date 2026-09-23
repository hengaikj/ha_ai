package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthPermissionMapper;
import com.hengaikj.ai.auth.mapper.AuthSessionMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import com.hengaikj.ai.auth.mapper.EnterpriseMapper;
import com.hengaikj.ai.auth.mapper.ProjectMemberMapper;
import com.hengaikj.ai.auth.service.AuthBootstrapRunner;
import com.hengaikj.ai.auth.service.AuthService;
import com.hengaikj.ai.auth.service.JwtSessionService;
import com.hengaikj.ai.entity.ApiKeyEntity;
import com.hengaikj.ai.mapper.ApiKeyMapper;
import com.hengaikj.ai.mapper.ProjectMapper;
import com.hengaikj.ai.mapper.RequestMapper;
import com.hengaikj.ai.mapper.RoutingAttemptMapper;
import com.hengaikj.ai.mapper.UsageMapper;
import com.hengaikj.ai.service.ApiKeyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "AUTH_JWT_HMAC_KEY=unit-test-only-key-with-more-than-32-bytes",
        "AUTH_JWT_ISSUER=https://ha-ai.test",
        "AUTH_BOOTSTRAP_ADMIN_USERNAME=test-admin",
        "AUTH_BOOTSTRAP_ADMIN_PASSWORD=unit-test-only-password",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,com.baomidou.mybatisplus.autoconfigure.MybatisPlusAutoConfiguration,org.springframework.boot.autoconfigure.data.redis.RedisReactiveAutoConfiguration"
})
@AutoConfigureMockMvc
class AuthHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JwtSessionService jwtSessions;
    @MockBean AuthService authService;
    @MockBean AuthBootstrapRunner bootstrapRunner;
    @MockBean AuthUserMapper authUsers;
    @MockBean AuthRoleMapper authRoles;
    @MockBean AuthPermissionMapper authPermissions;
    @MockBean AuthUserRoleMapper authUserRoles;
    @MockBean AuthSessionMapper authSessions;
    @MockBean EnterpriseMapper enterprises;
    @MockBean ProjectMemberMapper projectMembers;
    @MockBean ProjectMapper projects;
    @MockBean ApiKeyMapper apiKeys;
    @MockBean ApiKeyService apiKeyService;
    @MockBean RequestMapper requests;
    @MockBean RoutingAttemptMapper routingAttempts;
    @MockBean UsageMapper usages;

    @Test
    void loginIsPublicReturnsJwtAndRequestId() throws Exception {
        when(authService.login(any())).thenReturn(new AuthService.LoginResult("test-jwt", 3600));
        mvc.perform(post("/login").header("x-request-id", "auth-login-123")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"local-admin\",\"password\":\"valid-test-password\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("x-request-id", "auth-login-123"))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("test-jwt"))
                .andExpect(jsonPath("$.data.expiresIn").value(3600));
    }

    @Test
    void currentUserRequiresBearerJwt() throws Exception {
        mvc.perform(get("/getInfo"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void loginRejectsMissingCredentialsWithBadRequest() throws Exception {
        mvc.perform(post("/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"operator\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void captchaStatusIsPublicAndDisabled() throws Exception {
        mvc.perform(get("/api/captchaImage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.captchaEnabled").value(false));
    }

    @Test
    void apiKeyBearerIsNotParsedAsHumanJwtOnGatewayRoutes() throws Exception {
        ApiKeyEntity key = new ApiKeyEntity();
        key.id = 8L;
        key.enterpriseId = 100L;
        key.projectId = 11L;
        key.status = "ENABLED";
        when(apiKeyService.findActive("ha_test_api_key" )).thenReturn(key);

        mvc.perform(get("/v1/models").header("Authorization", "Bearer ha_test_api_key"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.object").value("list"));
    }

    @Test
    void validSessionLoadsUserContextAndLogoutRevokesIt() throws Exception {
        when(authSessions.insert(any(AuthSessionEntity.class))).thenReturn(1);
        var issued = jwtSessions.issue(72L);
        AuthSessionEntity session = new AuthSessionEntity();
        session.userId = 72L;
        session.jti = issued.jti();
        session.expiresAt = LocalDateTime.ofInstant(issued.expiresAt(), ZoneOffset.UTC);
        when(authSessions.selectOne(any())).thenReturn(session);
        when(authSessions.update(isNull(), any(UpdateWrapper.class))).thenAnswer(invocation -> {
            session.revokedAt = LocalDateTime.now(ZoneOffset.UTC);
            return 1;
        });
        AuthUserEntity user = new AuthUserEntity();
        user.id = 72L;
        user.username = "operator";
        user.displayName = "本地管理员";
        user.enterpriseId = null;
        user.status = "ACTIVE";
        when(authUsers.selectById(72L)).thenReturn(user);
        when(authRoles.selectRoleCodesByUserId(72L)).thenReturn(List.of("platform-admin"));
        when(projectMembers.selectProjectRolesByUserId(72L)).thenReturn(List.of());
        when(authPermissions.selectPermissionCodesByUserId(72L)).thenReturn(List.of("project:read", "api-key:manage"));

        mvc.perform(get("/getInfo").header("Authorization", "Bearer " + issued.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.userId").value(72))
                .andExpect(jsonPath("$.data.user.enterpriseId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.roles[0]").value("platform-admin"))
                .andExpect(jsonPath("$.data.user.permissionCodes[0]").value("api-key:manage"))
                .andExpect(jsonPath("$.data.permissions[0]").value("api-key:manage"));
        mvc.perform(post("/logout").header("Authorization", "Bearer " + issued.accessToken()))
                .andExpect(status().isOk());
        mvc.perform(get("/getInfo").header("Authorization", "Bearer " + issued.accessToken()))
                .andExpect(status().isUnauthorized());
    }
}
