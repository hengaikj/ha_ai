package com.hengaikj.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hengaikj.ai.controller.OpenAiController;
import com.hengaikj.ai.entity.ApiKeyEntity;
import com.hengaikj.ai.filter.RequestIdFilter;
import com.hengaikj.ai.mapper.RequestMapper;
import com.hengaikj.ai.mapper.RoutingAttemptMapper;
import com.hengaikj.ai.provider.FakeProvider;
import com.hengaikj.ai.provider.GatewayExceptionHandler;
import com.hengaikj.ai.service.ApiKeyService;
import com.hengaikj.ai.service.OpenAiService;
import com.hengaikj.ai.service.PolicyService;
import com.hengaikj.ai.usage.ResponseEvidenceService;
import com.hengaikj.ai.usage.UsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OpenAiGatewayTest {
    private MockMvc mvc;
    private ApiKeyService apiKeys;

    @BeforeEach
    void setUp() {
        apiKeys = mock(ApiKeyService.class);
        var service = new OpenAiService(
                apiKeys,
                new PolicyService(),
                new FakeProvider(),
                new UsageService(),
                new ResponseEvidenceService(),
                mock(RequestMapper.class),
                mock(RoutingAttemptMapper.class),
                new ObjectMapper().findAndRegisterModules());
        mvc = MockMvcBuilders.standaloneSetup(new OpenAiController(service))
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .setControllerAdvice(new GatewayExceptionHandler())
                .addFilters(new RequestIdFilter())
                .build();
        var key = new ApiKeyEntity();
        key.id = 7L;
        key.enterpriseId = 1L;
        key.projectId = 1L;
        key.status = "ENABLED";
        when(apiKeys.findActive(eq("integration-secret"))).thenReturn(key);
    }

    @Test
    void modelsReturnsAuthorizedFakeModelAndRequestId() throws Exception {
        mvc.perform(get("/v1/models")
                        .header("Authorization", "Bearer integration-secret"))
                .andExpect(status().isOk())
                .andExpect(header().exists("x-request-id"))
                .andExpect(jsonPath("$.object").value("list"))
                .andExpect(jsonPath("$.data[0].id").value("fake-model"));
    }

    @Test
    void chatReturnsNonStreamingCompletionAndRecordsUsage() throws Exception {
        mvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer integration-secret")
                        .contentType("application/json")
                        .content("""
                                {"model":"fake-model","stream":false,
                                 "messages":[{"role":"user","content":"你好"}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(header().exists("x-request-id"))
                .andExpect(jsonPath("$.object").value("chat.completion"))
                .andExpect(jsonPath("$.model").value("fake-model"))
                .andExpect(jsonPath("$.choices[0].message.content").isNotEmpty())
                .andExpect(jsonPath("$.usage.total_tokens").isNumber());
    }

    @Test
    void invalidApiKeyReturns401WithRequestId() throws Exception {
        when(apiKeys.findActive(anyString())).thenReturn(null);
        mvc.perform(get("/v1/models")
                        .header("Authorization", "Bearer bad-secret"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("x-request-id"));
    }

    @Test
    void projectScopeCanBeDerivedFromApiKey() throws Exception {
        mvc.perform(get("/v1/models")
                        .header("Authorization", "Bearer integration-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("fake-model"));
    }
}
