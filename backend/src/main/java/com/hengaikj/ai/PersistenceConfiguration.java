package com.hengaikj.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@ConditionalOnProperty(name = "ha.gateway.persistence.enabled", havingValue = "true")
class PersistenceConfiguration {
    @Bean PersistentApiKeyStore persistentApiKeyStore(JdbcTemplate jdbc) { return new JdbcApiKeyStore(jdbc); }
    @Bean RedisApiKeyCache redisApiKeyCache(StringRedisTemplate redis,
                                             org.springframework.core.env.Environment env) {
        return new RedisApiKeyCache(redis, env.getProperty("ha.gateway.redis.namespace", "ha:dev:"));
    }
}
