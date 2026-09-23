package com.hengaikj.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hengaikj.ai.entity.ApiKeyEntity;
import com.hengaikj.ai.entity.RequestEntity;
import com.hengaikj.ai.entity.RoutingAttemptEntity;
import com.hengaikj.ai.filter.RequestIdFilter;
import com.hengaikj.ai.mapper.RequestMapper;
import com.hengaikj.ai.mapper.RoutingAttemptMapper;
import com.hengaikj.ai.provider.GatewayException;
import com.hengaikj.ai.provider.ProviderAdapter;
import com.hengaikj.ai.usage.ResponseEvidenceService;
import com.hengaikj.ai.usage.UsageRecord;
import com.hengaikj.ai.usage.UsageService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class OpenAiService {
    private final ApiKeyService apiKeys;
    private final PolicyService policy;
    private final ProviderAdapter provider;
    private final UsageService usage;
    private final ResponseEvidenceService evidence;
    private final RequestMapper requests;
    private final RoutingAttemptMapper attempts;
    private final ObjectMapper objectMapper;

    public OpenAiService(
            ApiKeyService apiKeys,
            PolicyService policy,
            ProviderAdapter provider,
            UsageService usage,
            ResponseEvidenceService evidence,
            RequestMapper requests,
            RoutingAttemptMapper attempts,
            ObjectMapper objectMapper
    ) {
        this.apiKeys = apiKeys;
        this.policy = policy;
        this.provider = provider;
        this.usage = usage;
        this.evidence = evidence;
        this.requests = requests;
        this.attempts = attempts;
        this.objectMapper = objectMapper;
    }

    public List<ProviderAdapter.ModelDescriptor> models(String authorization, Long enterpriseId, Long projectId) {
        ApiKeyEntity key = authenticate(authorization, enterpriseId, projectId);
        return provider.models().stream()
                .filter(model -> policy.allowed(key.projectId, model.id()))
                .toList();
    }

    public Map<String, Object> chat(
            String authorization,
            Long enterpriseId,
            Long projectId,
            Map<String, Object> body,
            String requestId
    ) {
        ApiKeyEntity key = authenticate(authorization, enterpriseId, projectId);
        long scopedProjectId = key.projectId;
        String model = stringValue(body, "model", "fake-model");
        if (Boolean.TRUE.equals(body.get("stream"))) {
            throw new GatewayException(400, "stream_not_supported", "M01 仅支持 stream=false");
        }
        if (!policy.allowed(scopedProjectId, model)) {
            throw new GatewayException(403, "model_not_allowed", "项目未授权该模型");
        }

        String traceId = requestId == null || requestId.isBlank()
                ? UUID.randomUUID().toString()
                : requestId;
        RequestEntity request = new RequestEntity();
        request.requestId = traceId;
        request.enterpriseId = key.enterpriseId;
        request.projectId = key.projectId;
        request.model = model;
        request.status = "PROCESSING";
        requests.insert(request);

        String prompt = extractPrompt(body);
        RoutingAttemptEntity attempt = new RoutingAttemptEntity();
        attempt.requestId = request.id;
        attempt.provider = "fake";
        attempt.status = "PROCESSING";
        attempts.insert(attempt);

        ProviderAdapter.ProviderResult result;
        try {
            result = provider.chat(model, prompt);
        } catch (RuntimeException exception) {
            request.status = "FAILED";
            requests.updateById(request);
            attempt.status = "FAILED";
            attempts.updateById(attempt);
            throw exception;
        }

        request.status = "SUCCEEDED";
        requests.updateById(request);
        attempt.status = "SUCCEEDED";
        attempts.updateById(attempt);

        UsageRecord usageRecord = usage.record(
                traceId,
                model,
                result.promptTokens(),
                result.completionTokens()
        );
        Map<String, Object> response = Map.of(
                "id", "chatcmpl-" + traceId,
                "object", "chat.completion",
                "created", Instant.now().getEpochSecond(),
                "model", model,
                "choices", List.of(Map.of(
                        "index", 0,
                        "message", Map.of("role", "assistant", "content", result.content()),
                        "finish_reason", "stop"
                )),
                "usage", Map.of(
                        "prompt_tokens", usageRecord.promptTokens(),
                        "completion_tokens", usageRecord.completionTokens(),
                        "total_tokens", usageRecord.totalTokens()
                )
        );
        try {
            evidence.save(traceId, objectMapper.writeValueAsString(response));
        } catch (JsonProcessingException exception) {
            throw new GatewayException(500, "evidence_write_failed", "响应证据生成失败");
        }
        return response;
    }

    private ApiKeyEntity authenticate(String authorization, Long enterpriseId, Long projectId) {
        if (enterpriseId == null || authorization == null || !authorization.startsWith("Bearer ")) {
            throw new GatewayException(401, "missing_api_key", "缺少有效 API Key");
        }
        String secret = authorization.substring("Bearer ".length()).trim();
        if (secret.isBlank()) {
            throw new GatewayException(401, "missing_api_key", "缺少有效 API Key");
        }
        ApiKeyEntity key = projectId == null
                ? apiKeys.findActive(secret, enterpriseId)
                : apiKeys.findActive(secret, enterpriseId, projectId);
        if (key == null) {
            throw new GatewayException(401, "invalid_api_key", "API Key 无效或已失效");
        }
        return key;
    }

    private String stringValue(Map<String, Object> body, String key, String fallback) {
        Object value = body == null ? null : body.get(key);
        return value instanceof String string && !string.isBlank() ? string : fallback;
    }

    private String extractPrompt(Map<String, Object> body) {
        Object messages = body == null ? null : body.get("messages");
        if (!(messages instanceof List<?> list) || list.isEmpty()) {
            return "";
        }
        Object last = list.get(list.size() - 1);
        if (last instanceof Map<?, ?> map) {
            Object content = map.get("content");
            return content instanceof String ? (String) content : "";
        }
        return "";
    }
}
