package com.hengaikj.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    GatewayService gatewayService(ObjectProvider<PersistentApiKeyStore> store,
                                  ObjectProvider<RedisApiKeyCache> cache,
                                  ObjectProvider<JdbcTemplate> jdbc) {
        var persistent = store.getIfAvailable();
        if (persistent == null) return GatewayService.demo();
        var keys = new ApiKeyService(persistent, cache.getIfAvailable());
        keys.register(new ApiKey("1001", "1001", 1001L, "m01-demo-key",
                ApiKeyStatus.ENABLED, null));
        var policies = new ModelPolicyService();
        policies.allow("1001", "ha-gpt-4o-mini");
        var registry = new ProviderRegistry();
        registry.register(new LogicalModel("ha-gpt-4o-mini", "ha-gpt-4o-mini", true));
        registry.register(new Provider("2001", "Fake Provider", true));
        registry.register(new Channel("3001", "2001", "fake", "memory://fake", true));
        registry.bind("ha-gpt-4o-mini", "3001");
        registry.add(new FakeProvider("3001", "FakeProvider response", false));
        return new GatewayService(keys, policies, registry,
                new RequestRepository(jdbc.getIfAvailable()), java.time.Clock.systemUTC());
    }
}
