package com.hengaikj.ai;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/v1")
public final class GatewayController {
    private final GatewayService gateway;

    public GatewayController(GatewayService gateway) {
        this.gateway = gateway;
    }

    @GetMapping("/models")
    public Map<String, Object> models(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            HttpServletResponse response) {
        response.setHeader("x-request-id", GatewayService.newRequestId());
        var context = gateway.authenticate(authorization);
        return Map.of("object", "list", "data", gateway.models(context));
    }

    @PostMapping("/chat/completions")
    public ResponseEntity<ChatCompletionResponse> chat(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Client-Request-Id", required = false) String clientRequestId,
            @Valid @RequestBody ChatCompletionRequest request) {
        var requestId = GatewayService.newRequestId();
        var context = gateway.authenticate(authorization);
        var response = gateway.chat(context, request, clientRequestId, requestId);
        return ResponseEntity.ok().header("x-request-id", requestId).body(response);
    }
}
