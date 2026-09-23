package com.hengaikj.ai.provider;

import java.util.List;

public interface ProviderAdapter {
    List<ModelDescriptor> models();

    ProviderResult chat(String model, String prompt);

    record ModelDescriptor(String id, String ownedBy) {}

    record ProviderResult(String content, long promptTokens, long completionTokens) {}
}
