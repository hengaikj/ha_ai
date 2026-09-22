package com.hengaikj.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.hengaikj.ai.persistence.mapper.ApiKeyMapper;

@Configuration
@ConditionalOnProperty(name = "ha.gateway.persistence.enabled", havingValue = "true")
class PersistenceConfiguration {
    @Bean PersistentApiKeyStore persistentApiKeyStore(ApiKeyMapper mapper) {
        return new MybatisApiKeyStore(mapper);
    }
    @Bean RedisApiKeyCache redisApiKeyCache(StringRedisTemplate redis,
                                             org.springframework.core.env.Environment env) {
        return new RedisApiKeyCache(redis, env.getProperty("ha.gateway.redis.namespace", "ha:dev:"));
    }
}
