package com.hengaikj.ai;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.hengaikj.ai.entity.ApiKeyEntity;
import com.hengaikj.ai.mapper.ApiKeyMapper;
import com.hengaikj.ai.service.ApiKeyService;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BackendContextTest {
    @Test
    void keyHashIsDeterministicAndOneWay() {
        String h = ApiKeyService.hash("secret");
        assertEquals(64, h.length());
        assertNotEquals("secret", h);
        assertEquals(h, ApiKeyService.hash("secret"));
    }

    @Test
    void stateChangeInvalidatesCachedApiKeyContext() {
        ApiKeyMapper mapper = mock(ApiKeyMapper.class);
        RedisTemplate<String, Object> redis = mock(RedisTemplate.class);
        ApiKeyEntity entity = new ApiKeyEntity();
        entity.id = 9L;
        entity.enterpriseId = 1L;
        entity.projectId = 2L;
        entity.keyHash = ApiKeyService.hash("secret").getBytes(StandardCharsets.UTF_8);
        entity.status = "ENABLED";
        when(mapper.selectOne(any(QueryWrapper.class))).thenReturn(entity);

        new ApiKeyService(mapper, redis).change(1L, 2L, 9L, "REVOKED");

        verify(redis).delete("ha:dev:apikey:" + ApiKeyService.hash("secret"));
    }
}
