package com.hengaikj.ai;
import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*; import com.hengaikj.ai.service.ApiKeyService;
class BackendContextTest { @Test void keyHashIsDeterministicAndOneWay(){String h=ApiKeyService.hash("secret"); assertEquals(64,h.length()); assertNotEquals("secret",h); assertEquals(h,ApiKeyService.hash("secret"));} }
