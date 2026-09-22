package com.hengaikj.ai;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiKeyManagementContractTest {
    @Test
    void managementResponsesAndApplicableErrorsMatchContract() throws Exception {
        var service = new ApiKeyManagementService(new InMemoryApiKeyManagementRepository());
        var mvc = MockMvcBuilders.standaloneSetup(new ApiKeyManagementController(service))
                .setControllerAdvice(new ApiKeyManagementExceptionHandler()).build();
        var create = mvc.perform(post("/api/projects/11/api-keys").header("X-Enterprise-Id", 7)
                .contentType("application/json").content("{\"keyName\":\"开发\"}"))
                .andExpect(status().isOk()).andExpect(header().exists("x-request-id"))
                .andExpect(jsonPath("$.data.secret").isString())
                .andExpect(jsonPath("$.data.keyHash").doesNotExist()).andReturn();
        var body = create.getResponse().getContentAsString();
        var id = body.replaceAll(".*\\\"apiKeyId\\\":\\\"([^\\\"]+).*", "$1");
        mvc.perform(get("/api/projects/11/api-keys").header("X-Enterprise-Id", 7))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].secret").doesNotExist())
                .andExpect(jsonPath("$.data[0].keyHash").doesNotExist());
        mvc.perform(post("/api/api-keys/" + id + "/revoke").header("X-Enterprise-Id", 7).header("X-Project-Id", 11))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REVOKED"));
        mvc.perform(post("/api/api-keys/" + id + "/enable").header("X-Enterprise-Id", 7).header("X-Project-Id", 11))
                .andExpect(status().isConflict()).andExpect(header().exists("x-request-id"));
        mvc.perform(get("/api/projects/11/api-keys").header("X-Enterprise-Id", 0))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/projects/11/api-keys").header("X-Enterprise-Id", 7).header("X-Project-Id", 99))
                .andExpect(status().isOk());
        mvc.perform(get("/api/projects/11/api-keys").header("X-Enterprise-Id", 7))
                .andExpect(status().isOk());
    }

    @Test
    void missingKeyReturns404AndUnexpectedFailureIsSanitized() throws Exception {
        var repo = org.mockito.Mockito.mock(ApiKeyManagementRepository.class);
        var service = new ApiKeyManagementService(repo);
        org.mockito.Mockito.when(repo.list(1, 2)).thenThrow(new IllegalStateException("数据库Secret内部详情"));
        org.mockito.Mockito.when(repo.find(1, 2, "missing")).thenThrow(GatewayException.notFound("API Key不存在"));
        org.mockito.Mockito.when(repo.update(1, 2, "missing", ApiKeyStatus.DISABLED)).thenThrow(GatewayException.notFound("API Key不存在"));
        var mvc = MockMvcBuilders.standaloneSetup(new ApiKeyManagementController(service))
                .setControllerAdvice(new ApiKeyManagementExceptionHandler()).build();
        mvc.perform(get("/api/projects/2/api-keys").header("X-Enterprise-Id", 1))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.error.code").value("internal_error"));
        mvc.perform(post("/api/api-keys/missing/disable").header("X-Enterprise-Id", 1).header("X-Project-Id", 2))
                .andExpect(status().isNotFound());
    }
}
