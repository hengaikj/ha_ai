package com.hengaikj.ai;

import com.hengaikj.ai.auth.service.JwtSessionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 真实 MyBatis Mapper + MySQL 下的项目成员 HTTP 验收。
 * 默认不运行；在已准备好的 MySQL 8 环境中以 M02_REAL_MYSQL=true 显式执行。
 */
@SpringBootTest(properties = "spring.flyway.enabled=false")
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "M02_REAL_MYSQL", matches = "true")
class ProjectMemberRealMapperHttpTest {
    @MockBean com.hengaikj.ai.auth.mapper.AuthAuditEventMapper auditEventMapper;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtSessionService sessions;
    @Autowired PasswordEncoder passwordEncoder;

    private Long enterpriseId;
    private Long projectId;
    private Long userId;
    private String jti;

    @BeforeEach
    void fixture() {
        enterpriseId = jdbc.queryForObject(
                "SELECT id FROM ha_enterprise WHERE status='ACTIVE' ORDER BY id LIMIT 1", Long.class);
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("INSERT INTO ha_project(enterprise_id,name,entitlement_mode,project_code,status) VALUES (?,?,?,?,?)",
                enterpriseId, "M02 mapper fixture", "BALANCE", "M02-" + suffix, "ACTIVE");
        projectId = jdbc.queryForObject("SELECT id FROM ha_project WHERE project_code=?", Long.class, "M02-" + suffix);
        jdbc.update("INSERT INTO ha_auth_user(username,password_hash,display_name,enterprise_id,status) VALUES (?,?,?,?,?)",
                "m02-member-" + suffix, passwordEncoder.encode("unused-test-password"), "M02 Member", enterpriseId, "ACTIVE");
        userId = jdbc.queryForObject("SELECT id FROM ha_auth_user WHERE username=?", Long.class, "m02-member-" + suffix);
        Long roleId = jdbc.queryForObject("SELECT id FROM ha_auth_role WHERE role_code='project-viewer'", Long.class);
        jdbc.update("INSERT INTO ha_auth_project_member(user_id,project_id,role_id) VALUES (?,?,?)", userId, projectId, roleId);
        JwtSessionService.IssuedSession issued = sessions.issue(userId);
        jti = issued.jti();
        token = issued.accessToken();
    }

    private String token;

    @AfterEach
    void cleanup() {
        if (jti != null) jdbc.update("DELETE FROM ha_auth_session WHERE jti=?", jti);
        if (userId != null) jdbc.update("DELETE FROM ha_auth_project_member WHERE user_id=?", userId);
        if (userId != null) jdbc.update("DELETE FROM ha_auth_user WHERE id=?", userId);
        if (projectId != null) jdbc.update("DELETE FROM ha_project WHERE id=?", projectId);
    }

    @Test
    void projectMemberReadsOnlyAssignedProjectsThroughRealMappers() throws Exception {
        mvc.perform(get("/api/projects").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].projectCode").value(org.hamcrest.Matchers.startsWith("M02-")));
    }
}
