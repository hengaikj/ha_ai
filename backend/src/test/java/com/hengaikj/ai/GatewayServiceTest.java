package com.hengaikj.ai;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GatewayServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void apiKeyUsesSha256AndFallsBackToDatabaseOnCacheMiss() {
        var service = new ApiKeyService();
        service.register(new ApiKey("k1", "p1", 1L, "secret", ApiKeyStatus.ENABLED, null));
        service.evictCache("secret");

        var context = service.authenticate("secret", NOW);

        assertEquals("p1", context.projectId());
        assertEquals(64, ApiKeyService.hash("secret").length());
    }

    @Test
    void disabledKeyCanBeEnabledAgain() {
        var keys = new ApiKeyService();
        keys.register(new ApiKey("k-enable", "p1", 1L, "enable-me", ApiKeyStatus.ENABLED, null));
        keys.disable("enable-me");
        assertThrows(GatewayException.class, () -> keys.authenticate("enable-me", NOW));
        keys.enable("enable-me");
        assertEquals("k-enable", keys.authenticate("enable-me", NOW).apiKeyId());
    }

    @Test
    void keyCanBeEnabledByPublicIdWithoutSecret() {
        var keys = new ApiKeyService();
        keys.register(new ApiKey("k-public", "p1", 1L, "secret-public", ApiKeyStatus.DISABLED, null));
        keys.enableById("k-public");
        assertEquals("k-public", keys.authenticate("secret-public", NOW).apiKeyId());
    }

    @Test
    void disabledRevokedAndExpiredKeysAreRejected() {
        var disabled = new ApiKeyService();
        disabled.register(new ApiKey("k1", "p1", 1L, "disabled", ApiKeyStatus.DISABLED, null));
        assertThrows(GatewayException.class, () -> disabled.authenticate("disabled", NOW));

        var revoked = new ApiKeyService();
        revoked.register(new ApiKey("k2", "p1", 1L, "revoked", ApiKeyStatus.REVOKED, null));
        assertThrows(GatewayException.class, () -> revoked.authenticate("revoked", NOW));

        var expired = new ApiKeyService();
        expired.register(new ApiKey("k3", "p1", 1L, "expired", ApiKeyStatus.ENABLED,
                NOW.minusSeconds(1)));
        assertThrows(GatewayException.class, () -> expired.authenticate("expired", NOW));
    }

    @Test
    void modelPolicyAndFakeProviderCreateRequestAndAttempt() {
        var keys = new ApiKeyService();
        keys.register(new ApiKey("k1", "p1", 1L, "secret", ApiKeyStatus.ENABLED, null));
        var policies = new ModelPolicyService();
        policies.allow("p1", "model-a");
        var registry = new ProviderRegistry();
        registry.register(new LogicalModel("model-a", "Model A", true));
        registry.register(new Provider("fake", "Fake", true));
        registry.register(new Channel("channel", "fake", "fake", "memory://fake", true));
        registry.bind("model-a", "channel");
        registry.add(new FakeProvider("channel", "hello", false));
        var gateway = new GatewayService(keys, policies, registry, new RequestRepository(), CLOCK);
        var context = gateway.authenticate("Bearer secret");

        var response = gateway.chat(context,
                new ChatCompletionRequest("model-a", List.of(new Message("user", "hi")), false),
                "client-1", "request-1");
        var snapshot = gateway.request("request-1");

        assertEquals("hello", snapshot.request().status() == RequestStatus.SUCCESS
                ? response.choices().get(0).message().content() : "");
        assertEquals(RequestStatus.SUCCESS, snapshot.request().status());
        assertEquals(1, snapshot.attempts().size());
        assertEquals(AttemptStatus.SUCCESS, snapshot.attempts().get(0).status());
        assertEquals("client-1", snapshot.request().clientRequestId());
    }

    @Test
    void unauthorizedModelIsRejectedBeforeProviderCall() {
        var gateway = GatewayService.demo();
        var context = gateway.authenticate("Bearer m01-demo-key");

        assertThrows(GatewayException.class, () -> gateway.chat(context,
                new ChatCompletionRequest("not-allowed", List.of(new Message("user", "hi")), false),
                null, "request-2"));
    }
}
