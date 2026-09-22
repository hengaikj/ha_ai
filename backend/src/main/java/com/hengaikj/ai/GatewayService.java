package com.hengaikj.ai;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class GatewayService {
    private final ApiKeyService apiKeys;
    private final ModelPolicyService policies;
    private final ProviderRegistry providers;
    private final RequestRepository requests;
    private final Clock clock;

    public GatewayService(ApiKeyService apiKeys, ModelPolicyService policies,
                          ProviderRegistry providers, RequestRepository requests, Clock clock) {
        this.apiKeys = apiKeys;
        this.policies = policies;
        this.providers = providers;
        this.requests = requests;
        this.clock = clock;
    }

    public static GatewayService demo() {
        var keys = new ApiKeyService();
        keys.register(new ApiKey("demo-key-id", "project-demo", 1001L, "m01-demo-key",
                ApiKeyStatus.ENABLED, null));
        var policies = new ModelPolicyService();
        policies.allow("project-demo", "ha-gpt-4o-mini");
        var registry = new ProviderRegistry();
        registry.register(new LogicalModel("ha-gpt-4o-mini", "ha-gpt-4o-mini", true));
        registry.register(new Provider("fake-provider", "Fake Provider", true));
        registry.register(new Channel("fake-channel", "fake-provider", "fake", "memory://fake", true));
        registry.bind("ha-gpt-4o-mini", "fake-channel");
        registry.add(new FakeProvider("fake-channel", "FakeProvider response", false));
        return new GatewayService(keys, policies, registry, new RequestRepository(), Clock.systemUTC());
    }

    public ApiKeyContext authenticate(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw GatewayException.unauthorized("API Key无效");
        }
        return apiKeys.authenticate(authorization.substring("Bearer ".length()), clock.instant());
    }

    public List<ModelView> models(ApiKeyContext context) {
        return policies.allowed(context.projectId()).stream()
                .filter(providers::isAvailable)
                .map(model -> new ModelView(model, "model", "ha-ai"))
                .toList();
    }

    public ChatCompletionResponse chat(ApiKeyContext context, ChatCompletionRequest request,
                                       String clientRequestId, String requestId) {
        if (request == null || request.model() == null || request.messages() == null
                || request.messages().isEmpty()) {
            throw GatewayException.badRequest("请求必须包含model和至少一条messages");
        }
        if (Boolean.TRUE.equals(request.stream())) {
            throw GatewayException.badRequest("M01仅支持stream=false");
        }
        if (!policies.isAllowed(context.projectId(), request.model())) {
            throw GatewayException.badRequest("模型未授权");
        }

        Instant started = clock.instant();
        var record = requests.start(requestId, clientRequestId, context.projectId(),
                context.apiKeyId(), request.model(), started);
        var route = providers.route(request.model());
        var attempt = requests.attempt(record.id(), route.providerId(), route.channelId(), started);
        try {
            var result = providers.call(route, request);
            requests.succeed(attempt.attemptId(), clock.instant(), result.providerRequestId());
            requests.succeed(record.id(), clock.instant(), null);
            return new ChatCompletionResponse("chatcmpl-" + requestId.substring(0, 8),
                    "chat.completion", clock.instant().getEpochSecond(), request.model(),
                    List.of(new Choice(0, new Message("assistant", result.content()), "stop")),
                    result.usage());
        } catch (ProviderException ex) {
            requests.fail(attempt.attemptId(), clock.instant(), ex.code());
            requests.fail(record.id(), clock.instant(), null);
            throw GatewayException.upstream(ex.status(), ex.code(), ex.getMessage());
        }
    }

    public RequestSnapshot request(String requestId) {
        return requests.find(requestId);
    }

    public static String newRequestId() {
        return UUID.randomUUID().toString();
    }
}
