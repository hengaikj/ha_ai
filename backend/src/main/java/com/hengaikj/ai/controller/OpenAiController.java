package com.hengaikj.ai.controller;

import com.hengaikj.ai.filter.RequestIdFilter;
import com.hengaikj.ai.provider.ProviderAdapter;
import com.hengaikj.ai.service.OpenAiService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1")
public class OpenAiController {
    private final OpenAiService service;

    public OpenAiController(OpenAiService service) {
        this.service = service;
    }

    @GetMapping("/models")
    public Map<String, Object> models(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        List<Map<String, Object>> data = service.models(authorization).stream()
                .map(this::model)
                .toList();
        return Map.of("object", "list", "data", data);
    }

    @PostMapping("/chat/completions")
    public Map<String, Object> chat(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        return service.chat(
                authorization,
                body,
                (String) request.getAttribute(RequestIdFilter.ATTRIBUTE)
        );
    }

    private Map<String, Object> model(ProviderAdapter.ModelDescriptor descriptor) {
        return Map.of(
                "id", descriptor.id(),
                "object", "model",
                "owned_by", descriptor.ownedBy()
        );
    }
}
