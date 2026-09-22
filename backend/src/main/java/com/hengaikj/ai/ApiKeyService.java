package com.hengaikj.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class ApiKeyService {
    private final Map<String, ApiKey> database = new ConcurrentHashMap<>();
    private final Map<String, ApiKey> redis = new ConcurrentHashMap<>();
    private final PersistentApiKeyStore persistent;
    private final RedisApiKeyCache cache;

    public ApiKeyService() { this(null, null); }
    public ApiKeyService(PersistentApiKeyStore persistent) { this(persistent, null); }
    public ApiKeyService(PersistentApiKeyStore persistent, RedisApiKeyCache cache) {
        this.persistent = persistent; this.cache = cache;
    }

    public void register(ApiKey key) {
        if (persistent != null) persistent.save(key);
        if (persistent == null) {
            database.put(key.hash(), key);
            redis.put(key.hash(), key);
        }
        if (cache != null) cache.put(key);
    }

    public void disable(String secret) {
        update(secret, ApiKeyStatus.DISABLED);
    }

    public void revoke(String secret) {
        update(secret, ApiKeyStatus.REVOKED);
    }

    public void evictCache(String secret) {
        redis.remove(hash(secret));
        if (cache != null) cache.evict(hash(secret));
    }

    public ApiKeyContext authenticate(String secret, Instant now) {
        var digest = hash(secret);
        var key = redis.get(digest);
        if (key == null && cache != null) key = cache.get(digest);
        if (key == null) {
            key = database.get(digest);
            if (key == null && persistent != null) key = persistent.find(digest);
            if (key != null) {
                if (persistent == null) redis.put(digest, key);
                if (cache != null) cache.put(key);
            }
        }
        if (key == null || key.status() != ApiKeyStatus.ENABLED
                || (key.expiresAt() != null && !now.isBefore(key.expiresAt()))) {
            throw GatewayException.unauthorized("API Key禁用、撤销或过期");
        }
        return new ApiKeyContext(key.apiKeyId(), key.projectId(), key.enterpriseId());
    }

    private void update(String secret, ApiKeyStatus status) {
        var digest = hash(secret);
        var old = database.get(digest);
        if (old == null && cache != null) old = cache.get(digest);
        if (old == null && persistent != null) old = persistent.find(digest);
        if (old != null) {
            var updated = old.withStatus(status);
            if (persistent == null) {
                database.put(updated.hash(), updated);
                redis.put(updated.hash(), updated);
            }
            if (cache != null) cache.put(updated);
            if (persistent != null) persistent.updateStatus(updated);
        }
    }

    static String hash(String secret) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(secret.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("无法计算API Key摘要", ex);
        }
    }
}

final class ApiKey {
    private final String apiKeyId;
    private final String projectId;
    private final long enterpriseId;
    private final String secret;
    private final String keyHash;
    private final ApiKeyStatus status;
    private final Instant expiresAt;

    ApiKey(String apiKeyId, String projectId, long enterpriseId, String secret,
           ApiKeyStatus status, Instant expiresAt) {
        this(apiKeyId, projectId, enterpriseId, secret,
                secret == null ? null : ApiKeyService.hash(secret), status, expiresAt);
    }

    ApiKey(String apiKeyId, String projectId, long enterpriseId, String secret,
           String keyHash, ApiKeyStatus status, Instant expiresAt) {
        this.apiKeyId = apiKeyId;
        this.projectId = projectId;
        this.enterpriseId = enterpriseId;
        this.secret = secret;
        this.keyHash = keyHash;
        this.status = status;
        this.expiresAt = expiresAt;
    }

    String apiKeyId() { return apiKeyId; }
    String projectId() { return projectId; }
    long enterpriseId() { return enterpriseId; }
    String secret() { return secret; }
    ApiKeyStatus status() { return status; }
    Instant expiresAt() { return expiresAt; }
    ApiKey withStatus(ApiKeyStatus next) {
        return new ApiKey(apiKeyId, projectId, enterpriseId, secret, keyHash, next, expiresAt);
    }
    String hash() {
        if (keyHash == null) throw new IllegalStateException("API Key缺少keyHash");
        return keyHash;
    }
}

record ApiKeyContext(String apiKeyId, String projectId, long enterpriseId) {}

enum ApiKeyStatus { ENABLED, DISABLED, REVOKED }
