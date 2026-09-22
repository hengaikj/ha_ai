package com.hengaikj.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.ObjectProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mybatis.spring.annotation.MapperScan;
import com.hengaikj.ai.persistence.mapper.ApiKeyMapper;
import com.hengaikj.ai.persistence.mapper.AttemptMapper;
import com.hengaikj.ai.persistence.mapper.LogicalModelMapper;
import com.hengaikj.ai.persistence.mapper.ProjectPolicyMapper;
import com.hengaikj.ai.persistence.mapper.RequestMapper;
import com.hengaikj.ai.persistence.mapper.ProjectMapper;

@SpringBootApplication
@MapperScan("com.hengaikj.ai.persistence.mapper")
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    ModelPolicyService modelPolicyService(ObjectProvider<ProjectPolicyMapper> policyMapper,
                                           ObjectProvider<LogicalModelMapper> logicalModelMapper) {
        return new ModelPolicyService(policyMapper.getIfAvailable(), logicalModelMapper.getIfAvailable());
    }

    @Bean
    GatewayService gatewayService(ObjectProvider<PersistentApiKeyStore> store,
                                  ObjectProvider<RedisApiKeyCache> cache,
                                  ObjectProvider<ApiKeyMapper> apiKeyMapper,
                                  ObjectProvider<ProjectPolicyMapper> policyMapper,
                                  ObjectProvider<LogicalModelMapper> logicalModelMapper,
                ObjectProvider<RequestMapper> requestMapper,
                ObjectProvider<AttemptMapper> attemptMapper,
                ObjectProvider<ProjectMapper> projectMapper,
                ObjectProvider<ObjectMapper> mapper,
                                  ModelPolicyService policyService,
                                  org.springframework.core.env.Environment env) {
        if (!env.getProperty("ha.gateway.persistence.enabled", Boolean.class, false)) {
            return GatewayService.demo();
        }
        var persistent = store.getIfAvailable();
        if (persistent == null) return GatewayService.demo();
        var keys = new ApiKeyService(persistent, cache.getIfAvailable());
        keys.register(new ApiKey("1001", "1001", 1001L, "m01-demo-key",
                ApiKeyStatus.ENABLED, null));
        var policies = policyService;
        policies.allow("1001", "ha-gpt-4o-mini");
        var registry = new ProviderRegistry();
        registry.register(new LogicalModel("ha-gpt-4o-mini", "ha-gpt-4o-mini", true));
        registry.register(new Provider("2001", "Fake Provider", true));
        registry.register(new Channel("3001", "2001", "fake", "memory://fake", true));
        registry.bind("ha-gpt-4o-mini", "3001");
        registry.add(new FakeProvider("3001", "FakeProvider response", false));
        var hengaiKey = env.getProperty("ha.provider.hengai.api-key", "").trim();
        if (!hengaiKey.isEmpty()) {
            var baseUrl = env.getProperty("ha.provider.hengai.base-url",
                    "https://api.hengaikj.com/v1");
            registry.register(new Provider("2002", "HengAi", true));
            registry.register(new Channel("3002", "2002", "hengai", baseUrl, true));
            registry.bind("ha-gpt-4o-mini", "3002");
            registry.add(new HengAiProvider("3002", baseUrl, hengaiKey,
                    mapper.getIfAvailable(ObjectMapper::new)));
        }
        return new GatewayService(keys, policies, registry,
                new RequestRepository(requestMapper.getIfAvailable(),
                        attemptMapper.getIfAvailable(), logicalModelMapper.getIfAvailable()),
                java.time.Clock.systemUTC());
    }

    @Bean
    ApiKeyManagementService apiKeyManagementService(ObjectProvider<ApiKeyMapper> mapper,
                                                      ObjectProvider<ProjectMapper> projectMapper,
                                                      org.springframework.core.env.Environment env) {
        if (env.getProperty("ha.gateway.persistence.enabled", Boolean.class, false)
                && mapper.getIfAvailable() != null) {
            return new ApiKeyManagementService(new MybatisApiKeyManagementRepository(mapper.getIfAvailable(), projectMapper.getIfAvailable()));
        }
        return new ApiKeyManagementService(new InMemoryApiKeyManagementRepository());
    }

    @Bean
    ProjectApplicationService projectApplicationService(ObjectProvider<ProjectMapper> mapper,
                                                        org.springframework.core.env.Environment env) {
        if (env.getProperty("ha.gateway.persistence.enabled", Boolean.class, false)
                && mapper.getIfAvailable() != null) {
            return new ProjectApplicationService(new MybatisProjectRepository(mapper.getIfAvailable()));
        }
        return new ProjectApplicationService(new InMemoryProjectRepository());
    }
}
