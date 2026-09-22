package com.hengaikj.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.http.HttpStatus;

/**
 * OpenAI-compatible HengAi adapter. Credentials are accepted only through configuration
 * and are never included in exception messages or request logs.
 */
final class HengAiProvider implements ProviderAdapter {
    private final String channelId;
    private final URI endpoint;
    private final String apiKey;
    private final HttpClient client;
    private final ObjectMapper mapper;
    private final Duration timeout;

    HengAiProvider(String channelId, String baseUrl, String apiKey, ObjectMapper mapper) {
        this(channelId, baseUrl, apiKey, mapper, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10)).build(), Duration.ofSeconds(60));
    }

    HengAiProvider(String channelId, String baseUrl, String apiKey, ObjectMapper mapper,
                   HttpClient client, Duration timeout) {
        this.channelId = channelId;
        this.endpoint = URI.create(baseUrl.replaceAll("/+$", "") + "/chat/completions");
        this.apiKey = apiKey;
        this.mapper = mapper;
        this.client = client;
        this.timeout = timeout;
    }

    @Override public String channelId() { return channelId; }

    @Override
    public ProviderResult complete(ChatCompletionRequest request) {
        try {
            var payload = mapper.createObjectNode()
                    .put("model", request.model())
                    .put("stream", false);
            var messages = payload.putArray("messages");
            for (var message : request.messages()) {
                var item = messages.addObject().put("role", message.role());
                item.set("content", mapper.valueToTree(message.content()));
            }
            var httpRequest = HttpRequest.newBuilder(endpoint)
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            var response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw normalizeStatus(response.statusCode());
            }
            return parseSuccess(response.body());
        } catch (java.net.http.HttpTimeoutException | java.net.SocketTimeoutException ex) {
            throw new ProviderException(HttpStatus.GATEWAY_TIMEOUT,
                    "上游模型服务超时", "provider_timeout");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型服务调用中断", "provider_error");
        } catch (IOException | RuntimeException ex) {
            if (ex instanceof ProviderException providerException) throw providerException;
            throw new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型服务响应无效", "provider_invalid_response");
        }
    }

    private ProviderResult parseSuccess(String body) {
        try {
            JsonNode root = mapper.readTree(body);
            var choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new ProviderException(HttpStatus.BAD_GATEWAY,
                        "上游模型服务响应无效", "provider_invalid_response");
            }
            var content = choices.get(0).path("message").path("content");
            if (!content.isTextual()) {
                throw new ProviderException(HttpStatus.BAD_GATEWAY,
                        "上游模型服务响应无效", "provider_invalid_response");
            }
            var usage = root.path("usage");
            return new ProviderResult(content.textValue(), root.path("id").asText(null),
                    new Usage(usage.path("prompt_tokens").asLong(0),
                            usage.path("completion_tokens").asLong(0),
                            usage.path("total_tokens").asLong(0)));
        } catch (IOException ex) {
            throw new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型服务响应无效", "provider_invalid_response");
        }
    }

    private ProviderException normalizeStatus(int status) {
        return switch (status) {
            case 401, 403 -> new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型服务认证失败", "provider_authentication_error");
            case 404 -> new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型不存在", "provider_model_not_found");
            case 429 -> new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型服务限流", "provider_rate_limit");
            default -> new ProviderException(HttpStatus.BAD_GATEWAY,
                    "上游模型服务错误", "provider_error");
        };
    }
}
