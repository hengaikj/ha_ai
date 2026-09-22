package com.hengaikj.ai;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

interface PersistentApiKeyStore {
    void save(ApiKey key);
    ApiKey find(String hash);
    void updateStatus(ApiKey key);
}

final class JdbcApiKeyStore implements PersistentApiKeyStore {
    private final JdbcTemplate jdbc;
    JdbcApiKeyStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void save(ApiKey key) {
        jdbc.update("""
            INSERT INTO ha_ai_api_key(api_key_id,enterprise_id,project_id,key_name,key_prefix,key_hash,
              entitlement_mode,status,expires_at,revoked_at,version,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,0,NOW(3),NOW(3))
            ON DUPLICATE KEY UPDATE status=VALUES(status),expires_at=VALUES(expires_at),updated_at=NOW(3)
            """, Long.parseLong(key.apiKeyId()), key.enterpriseId(), Long.parseLong(key.projectId()),
                key.apiKeyId(), key.apiKeyId(), key.hash(), "BALANCE", key.status().name(),
                key.expiresAt() == null ? null : Timestamp.from(key.expiresAt()),
                key.status() == ApiKeyStatus.REVOKED ? Timestamp.from(Instant.now()) : null);
    }
    public ApiKey find(String hash) {
        List<ApiKey> rows = jdbc.query("""
            SELECT api_key_id,project_id,enterprise_id,key_hash,status,expires_at
            FROM ha_ai_api_key WHERE key_hash=?
            """, (rs, n) -> new ApiKey(String.valueOf(rs.getLong(1)), String.valueOf(rs.getLong(2)),
                rs.getLong(3), null, ApiKeyStatus.valueOf(rs.getString(5)),
                rs.getTimestamp(6) == null ? null : rs.getTimestamp(6).toInstant()), hash);
        return rows.isEmpty() ? null : rows.get(0);
    }
    public void updateStatus(ApiKey key) {
        jdbc.update("UPDATE ha_ai_api_key SET status=?,revoked_at=?,updated_at=NOW(3) WHERE key_hash=?",
            key.status().name(), key.status() == ApiKeyStatus.REVOKED ? Timestamp.from(Instant.now()) : null, key.hash());
    }
}

final class RedisApiKeyCache {
    private final StringRedisTemplate redis;
    private final String namespace;
    RedisApiKeyCache(StringRedisTemplate redis, String namespace) { this.redis = redis; this.namespace = namespace; }
    String key(String hash) { return namespace + "apikey:" + hash; }
    void put(ApiKey key) {
        redis.opsForHash().putAll(key(key.hash()), java.util.Map.of(
            "apiKeyId", key.apiKeyId(), "projectId", key.projectId(), "enterpriseId", String.valueOf(key.enterpriseId()),
            "status", key.status().name(), "expiresAt", key.expiresAt() == null ? "" : key.expiresAt().toString()));
    }
    ApiKey get(String hash) {
        var values = redis.opsForHash().entries(key(hash));
        if (values.isEmpty()) return null;
        var expiry = String.valueOf(values.getOrDefault("expiresAt", ""));
        return new ApiKey(String.valueOf(values.get("apiKeyId")), String.valueOf(values.get("projectId")),
            Long.parseLong(String.valueOf(values.get("enterpriseId"))), null,
            ApiKeyStatus.valueOf(String.valueOf(values.get("status"))),
            expiry.isBlank() ? null : Instant.parse(expiry));
    }
    void evict(String hash) { redis.delete(key(hash)); }
}
