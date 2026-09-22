package com.hengaikj.ai;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import java.security.SecureRandom;
import java.util.Base64;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest
@AutoConfigureMockMvc
class GatewayTest {
 static final String SECRET=Base64.getUrlEncoder().withoutPadding().encodeToString(new SecureRandom().generateSeed(32));
 @DynamicPropertySource static void properties(DynamicPropertyRegistry r) { r.add("ha.integration-key",()->SECRET); }
 @Autowired MockMvc mvc;
 @Test void models() throws Exception { mvc.perform(get("/v1/models").header("Authorization","Bearer "+SECRET)).andExpect(status().isOk()).andExpect(header().exists("x-request-id")).andExpect(jsonPath("$.data[0].id").value("fake-model")); }
 @Test void fakeCompletion() throws Exception { mvc.perform(post("/v1/chat/completions").header("Authorization","Bearer "+SECRET).contentType("application/json").content("{\"model\":\"fake-model\",\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"stream\":false}")).andExpect(status().isOk()).andExpect(header().exists("x-request-id")).andExpect(jsonPath("$.choices[0].message.content").value("FakeProvider response")); }
 @Test void unauthorizedHasTrace() throws Exception { mvc.perform(get("/v1/models")).andExpect(status().isUnauthorized()).andExpect(header().exists("x-request-id")); }
 @Test void malformed() throws Exception { mvc.perform(post("/v1/chat/completions").header("Authorization","Bearer "+SECRET).contentType("application/json").content("{} ")).andExpect(status().isBadRequest()).andExpect(header().exists("x-request-id")); }
 @Test void rejectsStreaming() throws Exception { mvc.perform(post("/v1/chat/completions").header("Authorization","Bearer "+SECRET).contentType("application/json").content("{\"model\":\"fake-model\",\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"stream\":true}")).andExpect(status().isBadRequest()); }
 @Test void keyStatesAndScope() {
  Project project=new Project(2,new Enterprise(1));
  for(ApiKey.Status state:ApiKey.Status.values()) assertEquals(state==ApiKey.Status.ENABLED,new ApiKey(project,SECRET,state,null).authenticates(SECRET,Instant.now()));
  ApiKey key=new ApiKey(project,SECRET,ApiKey.Status.ENABLED,Instant.now().minusSeconds(1));
  assertFalse(key.authenticates(SECRET,Instant.now())); assertEquals(1,key.project().enterprise().enterpriseId());
  assertFalse(new ApiKey(project,SECRET,ApiKey.Status.ENABLED,null).authenticates("wrong",Instant.now()));
 }
}
