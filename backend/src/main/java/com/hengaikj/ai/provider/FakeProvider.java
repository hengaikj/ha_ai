package com.hengaikj.ai.provider;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;

/** M01 的确定性 Provider，供真实 HTTP 链路和自动化测试使用。 */
@Primary
@Component
public class FakeProvider implements ProviderAdapter {
    @Override
    public List<ModelDescriptor> models() {
        return List.of(new ModelDescriptor("fake-model", "ha-ai-fake"));
    }

    @Override
    public ProviderResult chat(String model, String prompt) {
        if (!"fake-model".equals(model)) {
            throw new ProviderError(502, "upstream_error", "FakeProvider 不支持该模型");
        }
        String text = prompt == null || prompt.isBlank()
                ? "FakeProvider response"
                : "FakeProvider: " + prompt;
        return new ProviderResult(text, tokenCount(prompt), tokenCount(text));
    }

    private long tokenCount(String value) {
        return value == null || value.isBlank() ? 0 : value.trim().length();
    }
}
