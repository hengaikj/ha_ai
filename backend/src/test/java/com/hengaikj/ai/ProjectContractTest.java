package com.hengaikj.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

/** Project正式响应形状及临时企业上下文隔离验证。 */
class ProjectContractTest {
    protected ProjectRepository repository() { return new InMemoryProjectRepository(); }

    @Test
    void projectLifecycleContract() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new ProjectController(new ProjectApplicationService(repository())))
                .setControllerAdvice(new ProjectExceptionHandler()).build();
        var tenant = System.currentTimeMillis();
        mvc.perform(get("/api/projects").header("X-Enterprise-Id", tenant))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        var body = "{\"projectCode\":\"contract\",\"projectName\":\"契约项目\",\"entitlementMode\":\"BALANCE\"}";
        var result = mvc.perform(post("/api/projects").header("X-Enterprise-Id", tenant)
                .contentType("application/json").content(body)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectId").isString()).andReturn();
        var json = new ObjectMapper().readTree(result.getResponse().getContentAsString());
        assertEquals(json.get("requestId").asText(), result.getResponse().getHeader("x-request-id"));
        assertEquals(3,json.size()); assertEquals(5,json.get("data").size());
        var id = json.at("/data/projectId").asText();
        mvc.perform(get("/api/projects").header("X-Enterprise-Id", tenant))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].projectId").value(id));
        mvc.perform(get("/api/projects/"+id).header("X-Enterprise-Id", tenant))
                .andExpect(status().isOk()).andExpect(header().exists("x-request-id"));
        mvc.perform(put("/api/projects/"+id).header("X-Enterprise-Id", tenant)
                .contentType("application/json").content("{\"projectName\":\"更新\",\"entitlementMode\":\"SUBSCRIPTION\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.entitlementMode").value("SUBSCRIPTION"));
        mvc.perform(post("/api/projects").header("X-Enterprise-Id", tenant).contentType("application/json").content(body))
                .andExpect(status().isConflict()).andExpect(header().exists("x-request-id"));
        mvc.perform(get("/api/projects/"+id).header("X-Enterprise-Id", tenant+1)).andExpect(status().isNotFound());
        mvc.perform(put("/api/projects/"+id).header("X-Enterprise-Id", tenant+1)
                .contentType("application/json").content("{\"projectName\":\"越权\",\"entitlementMode\":\"BALANCE\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/projects").header("X-Enterprise-Id", tenant+1)).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/projects/0").header("X-Enterprise-Id", tenant)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/projects").header("X-Enterprise-Id", tenant).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }
    @Test
    void internalFailureIsSanitizedAndTraceable() throws Exception {
        var repo = org.mockito.Mockito.mock(ProjectRepository.class);
        org.mockito.Mockito.when(repo.list(1L)).thenThrow(new IllegalStateException("数据库内部敏感详情"));
        var mvc = MockMvcBuilders.standaloneSetup(new ProjectController(new ProjectApplicationService(repo)))
                .setControllerAdvice(new ProjectExceptionHandler()).build();
        mvc.perform(get("/api/projects").header("X-Enterprise-Id", 1))
                .andExpect(status().isInternalServerError()).andExpect(header().exists("x-request-id"))
                .andExpect(jsonPath("$.error.code").value("internal_error"));
    }

}
