package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.EnterpriseEntity;
import com.hengaikj.ai.auth.mapper.AuthPermissionMapper;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthSessionMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import com.hengaikj.ai.auth.mapper.EnterpriseMapper;
import com.hengaikj.ai.auth.mapper.ProjectMemberMapper;
import com.hengaikj.ai.auth.service.AuthBootstrapRunner;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.JwtSessionService;
import com.hengaikj.ai.entity.ApiKeyCreateResponse;
import com.hengaikj.ai.entity.ApiKeySummary;
import com.hengaikj.ai.entity.ProjectEntity;
import com.hengaikj.ai.mapper.ApiKeyMapper;
import com.hengaikj.ai.mapper.ProjectMapper;
import com.hengaikj.ai.mapper.RequestMapper;
import com.hengaikj.ai.mapper.RoutingAttemptMapper;
import com.hengaikj.ai.mapper.UsageMapper;
import com.hengaikj.ai.service.ApiKeyService;
import com.hengaikj.ai.usage.UsageRecord;
import com.hengaikj.ai.usage.UsageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
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
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,com.baomidou.mybatisplus.autoconfigure.MybatisPlusAutoConfiguration,org.springframework.boot.autoconfigure.data.redis.RedisReactiveAutoConfiguration"
})
@AutoConfigureMockMvc
class ManagementScopeHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JwtSessionService jwtSessions;
    @MockBean AuthBootstrapRunner bootstrapRunner;
    @MockBean AuthPermissionMapper permissions;
    @MockBean AuthUserMapper authUsers;
    @MockBean AuthRoleMapper authRoles;
    @MockBean AuthUserRoleMapper authUserRoles;
    @MockBean AuthSessionMapper authSessions;
    @MockBean ProjectMemberMapper projectMembers;
    @MockBean EnterpriseMapper enterprises;
    @MockBean ProjectMapper projects;
    @MockBean ApiKeyMapper apiKeyMapper;
    @MockBean RequestMapper requests;
    @MockBean RoutingAttemptMapper routingAttempts;
    @MockBean UsageMapper usageMapper;
    @MockBean ApiKeyService apiKeys;
    @MockBean UsageService usages;

    @Test
    void keyListUsesAuthenticatedProjectScopeAndNeverLeaksSecretOrHash() throws Exception {
        String token = tokenFor(1L, 100L, List.of("enterprise-admin"));
        when(projects.selectById(11L)).thenReturn(project(11L, 100L));
        when(apiKeys.list(100L, 11L)).thenReturn(List.of(
                new ApiKeySummary("7", "prod", "ha_abcd", "ENABLED", null, Instant.parse("2026-01-01T00:00:00Z"))));

        mvc.perform(get("/api/projects/11/api-keys").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].keyPrefix").value("ha_abcd"))
                .andExpect(jsonPath("$.data[0].status").value("ENABLED"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("keyHash"))));
        verify(apiKeys).list(100L, 11L);
    }

    @Test
    void crossEnterpriseKeyListIsForbidden() throws Exception {
        String token = tokenFor(2L, 100L, List.of("enterprise-admin"));
        when(projects.selectById(22L)).thenReturn(project(22L, 200L));
        mvc.perform(get("/api/projects/22/api-keys").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        verify(apiKeys, never()).list(anyLong(), anyLong());
    }

    @Test
    void createKeyReturnsSecretInsideContractEnvelopeOnce() throws Exception {
        String token = tokenFor(3L, 100L, List.of("enterprise-admin"));
        when(projects.selectById(11L)).thenReturn(project(11L, 100L));
        when(apiKeys.create(eq(100L), eq(11L), any())).thenReturn(new ApiKeyCreateResponse(
                "8", "browser", "ha_efgh", "ENABLED", null, Instant.parse("2026-01-01T00:00:00Z"), "ha_efgh.complete-secret"));

        mvc.perform(post("/api/projects/11/api-keys").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"keyName\":\"browser\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.secret").value("ha_efgh.complete-secret"))
                .andExpect(jsonPath("$.data.apiKeyId").value("8"));
    }

    @Test
    void keyStatusMutationUsesKeyProjectScopeAndNeedsNoTenantHeaderOrProjectQuery() throws Exception {
        String token = tokenFor(4L, 100L, List.of("enterprise-admin"));
        when(apiKeys.findById(7L)).thenReturn(key(7L, 100L, 11L));
        when(projects.selectById(11L)).thenReturn(project(11L, 100L));
        when(apiKeys.change(100L, 11L, 7L, "DISABLED"))
                .thenReturn(new ApiKeySummary("7", "prod", "ha_abcd", "DISABLED", null, Instant.now()));

        mvc.perform(post("/api/api-keys/7/disable").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
    }

    @Test
    void usageRequiresLoginAndReturnsContractEnvelope() throws Exception {
        String token = tokenFor(5L, 100L, List.of("enterprise-admin"));
        when(usages.recent(any(AuthUserContext.class))).thenReturn(List.of(new com.hengaikj.ai.usage.UsageSummary("req-1", "11", "gpt-test", "SUCCEEDED", Instant.parse("2026-01-01T00:00:00Z"))));
        mvc.perform(get("/api/usage").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].requestId").value("req-1"));
        mvc.perform(get("/api/usage")).andExpect(status().isUnauthorized());
    }

    private String tokenFor(long userId, Long enterpriseId, List<String> roles) {
        when(authSessions.insert(any(AuthSessionEntity.class))).thenReturn(1);
        var issued = jwtSessions.issue(userId);
        AuthSessionEntity session = new AuthSessionEntity();
        session.userId = userId;
        session.jti = issued.jti();
        session.expiresAt = LocalDateTime.ofInstant(issued.expiresAt(), ZoneOffset.UTC);
        when(authSessions.selectOne(any())).thenReturn(session);
        AuthUserEntity user = new AuthUserEntity();
        user.id = userId;
        user.username = "user-" + userId;
        user.displayName = user.username;
        user.enterpriseId = enterpriseId;
        user.status = "ACTIVE";
        when(authUsers.selectById(userId)).thenReturn(user);
        when(authRoles.selectRoleCodesByUserId(userId)).thenReturn(roles);
        when(projectMembers.selectProjectRolesByUserId(userId)).thenReturn(List.of());
        return issued.accessToken();
    }

    private static ProjectEntity project(long id, long enterpriseId) {
        ProjectEntity value = new ProjectEntity(); value.id = id; value.enterpriseId = enterpriseId; return value;
    }
    private static com.hengaikj.ai.entity.ApiKeyEntity key(long id, long enterpriseId, long projectId) {
        var value = new com.hengaikj.ai.entity.ApiKeyEntity(); value.id = id; value.enterpriseId = enterpriseId; value.projectId = projectId; return value;
    }
    private static String bearer(String token) { return "Bearer " + token; }
}
