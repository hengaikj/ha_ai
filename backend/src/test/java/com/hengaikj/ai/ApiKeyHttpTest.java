package com.hengaikj.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hengaikj.ai.entity.ApiKeyCreateResponse;
import com.hengaikj.ai.entity.ApiKeySummary;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ApiKeyHttpTest {
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void secretIsPresentOnlyOnCreateResponseAndListDtoContainsNoSecretOrHashFields() throws Exception {
        var created = new ApiKeyCreateResponse("1", "n", "ha_abc", "ENABLED", null,
                Instant.parse("2026-01-01T00:00:00Z"), "ha_abc.full-secret-once");
        var listed = new ApiKeySummary("1", "n", "ha_abc", "ENABLED", null,
                Instant.parse("2026-01-01T00:00:00Z"));
        String createJson = json.writeValueAsString(created);
        String listJson = json.writeValueAsString(listed);
        assertTrue(createJson.contains("ha_abc.full-secret-once"));
        assertFalse(listJson.contains("secret"));
        assertFalse(listJson.contains("keyHash"));
        assertFalse(listJson.contains("full-secret-once"));
    }
}
