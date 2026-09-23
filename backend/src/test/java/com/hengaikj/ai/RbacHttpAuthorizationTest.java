package com.hengaikj.ai;

import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.project.ProjectController;
import com.hengaikj.ai.project.ProjectService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Set;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(com.hengaikj.ai.auth.controller.AuthExceptionHandler.class)
class RbacHttpAuthorizationTest {
    @Autowired MockMvc mvc;
    @MockBean ProjectService projects;
    @MockBean AuthzService authz;

    @Test
    void permissionAllowsProjectList() throws Exception {
        when(authz.currentUser(any())).thenReturn(context());
        mvc.perform(get("/api/projects").with(user("7")))
                .andExpect(status().isOk());
    }

    @Test
    void permissionDeniesProjectListWith403() throws Exception {
        when(authz.currentUser(any())).thenReturn(context());
        doThrow(new AccessDeniedException("无权执行该操作"))
                .when(authz).requireProjectListAccess(any());
        mvc.perform(get("/api/projects").with(user("7")))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedProjectListReturns401() throws Exception {
        when(authz.currentUser(isNull())).thenThrow(new ResponseStatusException(
                HttpStatus.UNAUTHORIZED, "登录状态无效"));
        mvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized());
    }

    private static AuthUserContext context() {
        return new AuthUserContext(7L, "rbac-user", "RBAC User", 100L,
                Set.of("enterprise-admin"), List.of(), Map.of(), Set.of("project:read"));
    }
}
