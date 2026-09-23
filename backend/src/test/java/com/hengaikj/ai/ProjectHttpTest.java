package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.EnterpriseEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthSessionMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import com.hengaikj.ai.auth.mapper.EnterpriseMapper;
import com.hengaikj.ai.auth.mapper.ProjectMemberMapper;
import com.hengaikj.ai.auth.service.AuthBootstrapRunner;
import com.hengaikj.ai.auth.service.JwtSessionService;
import com.hengaikj.ai.entity.ProjectEntity;
import com.hengaikj.ai.mapper.ApiKeyMapper;
import com.hengaikj.ai.mapper.ProjectMapper;
import com.hengaikj.ai.mapper.RequestMapper;
import com.hengaikj.ai.mapper.RoutingAttemptMapper;
import com.hengaikj.ai.mapper.UsageMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
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
class ProjectHttpTest {
    @Autowired MockMvc mvc;
    @Autowired JwtSessionService jwtSessions;
    @MockBean AuthBootstrapRunner bootstrapRunner;
    @MockBean AuthUserMapper authUsers;
    @MockBean AuthRoleMapper authRoles;
    @MockBean AuthUserRoleMapper authUserRoles;
    @MockBean AuthSessionMapper authSessions;
    @MockBean ProjectMemberMapper projectMembers;
    @MockBean ProjectMapper projects;
    @MockBean EnterpriseMapper enterprises;
    @MockBean ApiKeyMapper apiKeys;
    @MockBean RequestMapper requests;
    @MockBean RoutingAttemptMapper routingAttempts;
    @MockBean UsageMapper usages;

    @Test
    void projectListReturnsContractDtoAndFiltersToTheUsersEnterprise() throws Exception {
        var token = tokenFor(1L, 100L, List.of("enterprise-admin"), List.of());
        ProjectEntity row = project(11L, 100L, "ALPHA");
        when(projects.selectList(any(Wrapper.class))).thenReturn(List.of(row));

        mvc.perform(get("/api/projects").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].projectId").value("11"))
                .andExpect(jsonPath("$.data[0].projectCode").value("ALPHA"))
                .andExpect(jsonPath("$.data[0].projectName").value("Project ALPHA"));

        ArgumentCaptor<QueryWrapper<ProjectEntity>> query = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(projects).selectList(query.capture());
        assertTrue(query.getValue().getCustomSqlSegment().contains("enterprise_id"), query.getValue().getCustomSqlSegment());
        assertTrue(query.getValue().getParamNameValuePairs().toString().contains("100"), query.getValue().getParamNameValuePairs().toString());
    }

    @Test
    void projectMemberListFiltersToOnlyAssignedProjects() throws Exception {
        var token = tokenFor(2L, 100L, List.of(), List.of(new ProjectMemberMapper.ProjectRoleRow(11L, "project-viewer")));
        when(projects.selectList(any(Wrapper.class))).thenReturn(List.of(project(11L, 100L, "ALPHA")));

        mvc.perform(get("/api/projects").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        ArgumentCaptor<QueryWrapper<ProjectEntity>> query = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(projects).selectList(query.capture());
        assertTrue(query.getValue().getCustomSqlSegment().contains("enterprise_id"));
        assertTrue(query.getValue().getCustomSqlSegment().contains("id IN"));
        assertTrue(query.getValue().getParamNameValuePairs().toString().contains("11"));
        assertTrue(query.getValue().getParamNameValuePairs().toString().contains("100"));
    }

    @Test
    void enterpriseAdminCreatesProjectInItsOwnEnterpriseWithoutEnterpriseId() throws Exception {
        var token = tokenFor(3L, 100L, List.of("enterprise-admin"), List.of());
        when(enterprises.selectById(100L)).thenReturn(enterprise(100L));
        when(projects.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(projects.insert(any(ProjectEntity.class))).thenAnswer(call -> {
            ProjectEntity row = call.getArgument(0);
            row.id = 21L;
            return 1;
        });

        mvc.perform(post("/api/projects").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectCode\":\"NEW\",\"projectName\":\"New Project\",\"entitlementMode\":\"BALANCE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectId").value("21"))
                .andExpect(jsonPath("$.data.projectName").value("New Project"));
        verify(projects).insert(org.mockito.ArgumentMatchers.<ProjectEntity>argThat(row -> row.enterpriseId.equals(100L) && "NEW".equals(row.projectCode)));
    }

    @Test
    void platformAdminMustSelectAnExistingEnterpriseToCreateProject() throws Exception {
        var token = tokenFor(4L, null, List.of("platform-admin"), List.of());
        when(enterprises.selectById(200L)).thenReturn(enterprise(200L));
        when(projects.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(projects.insert(any(ProjectEntity.class))).thenAnswer(call -> {
            ((ProjectEntity) call.getArgument(0)).id = 22L;
            return 1;
        });

        mvc.perform(post("/api/projects").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectCode\":\"GLOBAL\",\"projectName\":\"Global Project\",\"entitlementMode\":\"BALANCE\",\"enterpriseId\":200}"))
                .andExpect(status().isOk());
        verify(projects).insert(org.mockito.ArgumentMatchers.<ProjectEntity>argThat(row -> row.enterpriseId.equals(200L)));
    }

    @Test
    void duplicateProjectCodeReturnsConflict() throws Exception {
        var token = tokenFor(5L, 100L, List.of("enterprise-admin"), List.of());
        when(enterprises.selectById(100L)).thenReturn(enterprise(100L));
        when(projects.selectCount(any(Wrapper.class))).thenReturn(1L);
        mvc.perform(post("/api/projects").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectCode\":\"DUP\",\"projectName\":\"Duplicate\",\"entitlementMode\":\"BALANCE\"}"))
                .andExpect(status().isConflict());
        verify(projects, never()).insert(any(ProjectEntity.class));
    }

    @Test
    void unauthenticatedProjectListReturns401() throws Exception {
        mvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
    }

    private String tokenFor(long userId, Long enterpriseId, List<String> roles,
                            List<ProjectMemberMapper.ProjectRoleRow> projectRoles) {
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
        when(projectMembers.selectProjectRolesByUserId(userId)).thenReturn(projectRoles);
        return issued.accessToken();
    }

    private static ProjectEntity project(long id, long enterpriseId, String code) {
        ProjectEntity row = new ProjectEntity();
        row.id = id;
        row.enterpriseId = enterpriseId;
        row.projectCode = code;
        row.name = "Project " + code;
        row.entitlementMode = "BALANCE";
        row.status = "ACTIVE";
        return row;
    }

    private static EnterpriseEntity enterprise(long id) {
        EnterpriseEntity row = new EnterpriseEntity();
        row.id = id;
        row.displayName = "Enterprise " + id;
        row.status = "ACTIVE";
        return row;
    }

    private static String bearer(String token) { return "Bearer " + token; }
}
