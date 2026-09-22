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
        database.put(key.hash(), key);
        redis.put(key.hash(), key);
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
    }

    public ApiKeyContext authenticate(String secret, Instant now) {
        var key = redis.get(hash(secret));
        if (key == null && cache != null) key = cache.get(hash(secret));
        if (key == null) {
            key = database.get(hash(secret));
            if (key == null && persistent != null) key = persistent.find(hash(secret));
            if (key != null) {
                redis.put(hash(secret), key);
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
        var old = database.get(hash(secret));
        if (old == null && persistent != null) old = persistent.find(hash(secret));
        if (old != null) {
            var updated = new ApiKey(old.apiKeyId(), old.projectId(), old.enterpriseId(),
                    old.secret(), status, old.expiresAt());
            database.put(updated.hash(), updated);
            redis.put(updated.hash(), updated);
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

record ApiKey(String apiKeyId, String projectId, long enterpriseId, String secret,
              ApiKeyStatus status, Instant expiresAt) {
    String hash() {
        return ApiKeyService.hash(secret);
    }
}

record ApiKeyContext(String apiKeyId, String projectId, long enterpriseId) {}

enum ApiKeyStatus { ENABLED, DISABLED, REVOKED }
