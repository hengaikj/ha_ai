package com.hengaikj.ai;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "ha.gateway.persistence.enabled=false")
@AutoConfigureMockMvc
class GatewayControllerTest {
    @Autowired
    MockMvc mvc;

    @Test
    void modelsReturnsOnlyPolicyModelsAndRequestId() throws Exception {
        mvc.perform(get("/v1/models").header("Authorization", "Bearer m01-demo-key"))
                .andExpect(status().isOk())
                .andExpect(header().exists("x-request-id"))
                .andExpect(jsonPath("$.object").value("list"))
                .andExpect(jsonPath("$.data[0].id").value("ha-gpt-4o-mini"))
                .andExpect(jsonPath("$.data[0].owned_by").value("ha-ai"));
    }

    @Test
    void chatReturnsNonStreamingFakeProviderResponse() throws Exception {
        mvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer m01-demo-key")
                        .header("X-Client-Request-Id", "client-123")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"model":"ha-gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(header().exists("x-request-id"))
                .andExpect(jsonPath("$.object").value("chat.completion"))
                .andExpect(jsonPath("$.created").isNumber())
                .andExpect(jsonPath("$.choices[0].message.content").value("FakeProvider response"));
    }

    @Test
    void streamIsRejectedByM01Scope() throws Exception {
        mvc.perform(post("/v1/chat/completions")
                        .header("Authorization", "Bearer m01-demo-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"model":"ha-gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":true}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_request"));
    }
}
