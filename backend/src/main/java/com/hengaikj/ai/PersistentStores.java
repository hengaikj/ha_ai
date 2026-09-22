package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.hengaikj.ai.persistence.entity.ApiKeyEntity;
import com.hengaikj.ai.persistence.mapper.ApiKeyMapper;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;

interface PersistentApiKeyStore {
    void save(ApiKey key);
    ApiKey find(String hash);
    ApiKey findById(String apiKeyId);
    void updateStatus(ApiKey key);
}

/**
 * API Key 的业务持久化主路径。明文 Secret 只在创建/注册时存在于进程内，
 * 数据库和 Redis 均只保存 SHA-256 摘要及非敏感上下文。
 */
final class MybatisApiKeyStore implements PersistentApiKeyStore {
    private final ApiKeyMapper mapper;

    MybatisApiKeyStore(ApiKeyMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void save(ApiKey key) {
        var entity = new ApiKeyEntity();
        entity.apiKeyId = Long.parseLong(key.apiKeyId());
        entity.enterpriseId = key.enterpriseId();
        entity.projectId = Long.parseLong(key.projectId());
        entity.keyName = key.apiKeyId();
        entity.keyPrefix = key.apiKeyId();
        entity.keyHash = key.hash();
        entity.entitlementMode = "BALANCE";
        entity.status = key.status().name();
        entity.expiresAt = toLocalDateTime(key.expiresAt());
        entity.revokedAt = key.status() == ApiKeyStatus.REVOKED ? LocalDateTime.now(ZoneOffset.UTC) : null;
        entity.version = 0L;
        entity.createdAt = LocalDateTime.now(ZoneOffset.UTC);
        entity.updatedAt = entity.createdAt;

        var existing = mapper.selectById(entity.apiKeyId);
        if (existing == null) {
            mapper.insert(entity);
            return;
        }
        mapper.update(null, new UpdateWrapper<ApiKeyEntity>()
                .eq("api_key_id", entity.apiKeyId)
                .set("status", entity.status)
                .set("expires_at", entity.expiresAt)
                .set("revoked_at", entity.revokedAt)
                .set("updated_at", entity.updatedAt));
    }

    @Override
    public ApiKey find(String hash) {
        var entity = mapper.selectOne(new QueryWrapper<ApiKeyEntity>()
                .eq("key_hash", hash)
                .last("LIMIT 1"));
        if (entity == null) return null;
        return new ApiKey(String.valueOf(entity.apiKeyId), String.valueOf(entity.projectId),
                entity.enterpriseId, null, entity.keyHash,
                ApiKeyStatus.valueOf(entity.status), toInstant(entity.expiresAt));
    }

    @Override
    public ApiKey findById(String apiKeyId) {
        var entity = mapper.selectById(Long.parseLong(apiKeyId));
        if (entity == null) return null;
        return new ApiKey(String.valueOf(entity.apiKeyId), String.valueOf(entity.projectId),
                entity.enterpriseId, null, entity.keyHash,
                ApiKeyStatus.valueOf(entity.status), toInstant(entity.expiresAt));
    }

    @Override
    public void updateStatus(ApiKey key) {
        mapper.update(null, new UpdateWrapper<ApiKeyEntity>()
                .eq("key_hash", key.hash())
                .set("status", key.status().name())
                .set("revoked_at", key.status() == ApiKeyStatus.REVOKED
                        ? LocalDateTime.now(ZoneOffset.UTC) : null)
                .set("updated_at", LocalDateTime.now(ZoneOffset.UTC)));
    }

    private static LocalDateTime toLocalDateTime(Instant value) {
        return value == null ? null : LocalDateTime.ofInstant(value, ZoneOffset.UTC);
    }

    private static Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}

final class RedisApiKeyCache {
    private final StringRedisTemplate redis;
    private final String namespace;

    RedisApiKeyCache(StringRedisTemplate redis, String namespace) {
        this.redis = redis;
        this.namespace = namespace.endsWith(":") ? namespace : namespace + ":";
    }

    String key(String hash) {
        return namespace + "apikey:" + hash;
    }

    void put(ApiKey key) {
        redis.opsForHash().putAll(key(key.hash()), Map.of(
                "apiKeyId", key.apiKeyId(),
                "projectId", key.projectId(),
                "enterpriseId", String.valueOf(key.enterpriseId()),
                "status", key.status().name(),
                "expiresAt", key.expiresAt() == null ? "" : key.expiresAt().toString()));
    }

    ApiKey get(String hash) {
        var values = redis.opsForHash().entries(key(hash));
        if (values.isEmpty()) return null;
        var expiry = String.valueOf(values.getOrDefault("expiresAt", ""));
        return new ApiKey(String.valueOf(values.get("apiKeyId")),
                String.valueOf(values.get("projectId")),
                Long.parseLong(String.valueOf(values.get("enterpriseId"))),
                null, hash, ApiKeyStatus.valueOf(String.valueOf(values.get("status"))),
                expiry.isBlank() ? null : Instant.parse(expiry));
    }

    void evict(String hash) {
        redis.delete(key(hash));
    }
}
