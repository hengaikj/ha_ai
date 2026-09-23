package com.hengaikj.ai;

import com.hengaikj.ai.entity.ApiKeyEntity;
import com.hengaikj.ai.mapper.ApiKeyMapper;
import com.hengaikj.ai.service.ApiKeyService;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ApiKeyServiceSecurityTest {
    @Test
    void disablingKeyInvalidatesItsRedisContext() {
        ApiKeyMapper mapper = mock(ApiKeyMapper.class);
        @SuppressWarnings("unchecked") RedisTemplate<String, Object> redis = mock(RedisTemplate.class);
        ApiKeyEntity entity = activeKey();
        when(mapper.selectOne(any())).thenReturn(entity);
        ApiKeyService service = new ApiKeyService(mapper, redis);

        service.change(100L, 11L, 7L, "DISABLED");

        verify(mapper).updateById(entity);
        verify(redis).delete("ha:dev:apikey:" + new String(entity.keyHash, StandardCharsets.UTF_8));
    }

    @Test
    void revokedKeyCannotBeEnabledAgain() {
        ApiKeyMapper mapper = mock(ApiKeyMapper.class);
        @SuppressWarnings("unchecked") RedisTemplate<String, Object> redis = mock(RedisTemplate.class);
        ApiKeyEntity entity = activeKey();
        entity.status = "REVOKED";
        when(mapper.selectOne(any())).thenReturn(entity);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> new ApiKeyService(mapper, redis).change(100L, 11L, 7L, "ENABLED"));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(mapper, never()).updateById(any(ApiKeyEntity.class));
    }

    private static ApiKeyEntity activeKey() {
        ApiKeyEntity value = new ApiKeyEntity();
        value.id = 7L;
        value.enterpriseId = 100L;
        value.projectId = 11L;
        value.status = "ENABLED";
        value.keyHash = ApiKeyService.hash("secret").getBytes(StandardCharsets.UTF_8);
        return value;
    }
}
