package com.hengaikj.ai;

import com.hengaikj.ai.auth.controller.AuthExceptionHandler;
import com.hengaikj.ai.auth.dto.RoleSummary;
import com.hengaikj.ai.auth.dto.EnterpriseOption;
import com.hengaikj.ai.auth.dto.UserSummary;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.UserRoleManagementService;
import com.hengaikj.ai.auth.controller.UserRoleManagementController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserRoleManagementController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(AuthExceptionHandler.class)
class UserRoleManagementHttpTest {
    @Autowired MockMvc mvc;
    @MockBean UserRoleManagementService service;
    @MockBean AuthzService authz;

    @Test
    void authorizedUserListReturns200() throws Exception {
        when(authz.currentUser(any())).thenReturn(actor());
        when(service.list(any())).thenReturn(List.of(new UserSummary(1L, "u", "U", 100L, "ACTIVE", List.of("enterprise-admin"))));
        mvc.perform(get("/api/auth/users").with(user("7")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].username").value("u"));
    }

    @Test
    void authorizedUserCreateReturns201() throws Exception {
        when(authz.currentUser(any())).thenReturn(actor());
        when(service.create(any(), any())).thenReturn(new UserSummary(2L, "new", "New", 100L, "ACTIVE", List.of()));
        mvc.perform(post("/api/auth/users").with(user("7")).contentType("application/json")
                        .content("{\"username\":\"new\",\"password\":\"VerySecurePass123\",\"displayName\":\"New\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.userId").value(2));
    }

    @Test
    void missingPermissionReturns403() throws Exception {
        when(authz.currentUser(any())).thenReturn(actor());
        when(service.list(any())).thenThrow(new AccessDeniedException("无权限"));
        mvc.perform(get("/api/auth/users").with(user("7")))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedReturns401() throws Exception {
        when(authz.currentUser(isNull())).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录"));
        mvc.perform(get("/api/auth/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void platformEnterpriseOptionsReturnsActiveChoices() throws Exception {
        when(authz.currentUser(any())).thenReturn(new AuthUserContext(1L, "platform", "Platform", null,
                Set.of("platform-admin"), List.of(), Map.of(), Set.of("user:create")));
        when(service.activeEnterpriseOptions(any())).thenReturn(List.of(new EnterpriseOption(100L, "企业 A")));
        mvc.perform(get("/api/auth/enterprises/options").with(user("1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].enterpriseId").value(100));
    }

    @Test
    void enterpriseOptionsWithoutPlatformScopeReturns403() throws Exception {
        when(authz.currentUser(any())).thenReturn(actor());
        when(service.activeEnterpriseOptions(any())).thenThrow(new AccessDeniedException("只有平台管理员可以选择企业"));
        mvc.perform(get("/api/auth/enterprises/options").with(user("7")))
                .andExpect(status().isForbidden());
    }

    private static AuthUserContext actor() {
        return new AuthUserContext(7L, "actor", "Actor", 100L, Set.of("enterprise-admin"), List.of(), Map.of(),
                Set.of("user:read", "user:create", "user:update", "user:role:manage", "role:read"));
    }
}
