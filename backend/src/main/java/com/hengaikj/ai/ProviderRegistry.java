package com.hengaikj.ai;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class ProviderRegistry {
    private final Map<String, LogicalModel> models = new ConcurrentHashMap<>();
    private final Map<String, Provider> providers = new ConcurrentHashMap<>();
    private final Map<String, Channel> channels = new ConcurrentHashMap<>();
    private final Map<String, String> bindings = new ConcurrentHashMap<>();
    private final Map<String, ProviderAdapter> adapters = new ConcurrentHashMap<>();

    public void register(LogicalModel model) { models.put(model.modelCode(), model); }
    public void register(Provider provider) { providers.put(provider.providerId(), provider); }
    public void register(Channel channel) { channels.put(channel.channelId(), channel); }
    public void bind(String model, String channel) { bindings.put(model, channel); }
    public void add(ProviderAdapter adapter) { adapters.put(adapter.channelId(), adapter); }

    public boolean isAvailable(String model) {
        var channel = channels.get(bindings.get(model));
        return models.get(model) != null && models.get(model).enabled()
                && channel != null && channel.enabled()
                && providers.get(channel.providerId()) != null
                && providers.get(channel.providerId()).enabled();
    }

    Route route(String model) {
        var channel = channels.get(bindings.get(model));
        if (!isAvailable(model) || !adapters.containsKey(channel.channelId())) {
            throw GatewayException.badRequest("模型当前不可用");
        }
        return new Route(providers.get(channel.providerId()).providerId(), channel.channelId(),
                adapters.get(channel.channelId()));
    }

    ProviderResult call(Route route, ChatCompletionRequest request) {
        return route.adapter().complete(request);
    }
}

record LogicalModel(String modelCode, String modelName, boolean enabled) {}
record Provider(String providerId, String providerName, boolean enabled) {}
record Channel(String channelId, String providerId, String channelCode, String endpoint,
               boolean enabled) {}
record Route(String providerId, String channelId, ProviderAdapter adapter) {}

interface ProviderAdapter {
    String channelId();
    ProviderResult complete(ChatCompletionRequest request);
}

record ProviderResult(String content, String providerRequestId, Usage usage) {
    ProviderResult(String content, String providerRequestId) {
        this(content, providerRequestId, new Usage(0, 0, 0));
    }
}

final class FakeProvider implements ProviderAdapter {
    private final String channelId;
    private final String response;
    private final boolean fail;

    FakeProvider(String channelId, String response, boolean fail) {
        this.channelId = channelId;
        this.response = response;
        this.fail = fail;
    }

    @Override public String channelId() { return channelId; }

    @Override public ProviderResult complete(ChatCompletionRequest request) {
        if (fail) {
            throw new ProviderException("FakeProvider失败", "fake_provider_error");
        }
        return new ProviderResult(response, "fake-" + UUID.randomUUID());
    }
}
