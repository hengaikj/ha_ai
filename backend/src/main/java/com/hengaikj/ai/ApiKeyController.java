package com.hengaikj.ai;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** API Key 生命周期管理接口；明文 Secret 不在管理响应中返回。 */
@RestController
@RequestMapping("/api/api-keys")
final class ApiKeyController {
    private final GatewayService gateway;
    ApiKeyController(GatewayService gateway) { this.gateway = gateway; }

    @PostMapping("/{keyId}/enable")
    ResponseEntity<Map<String, Object>> enable(@PathVariable String keyId, HttpServletResponse response) {
        return change(keyId, "enable", gateway::enableApiKey, response);
    }

    @PostMapping("/{keyId}/disable")
    ResponseEntity<Map<String, Object>> disable(@PathVariable String keyId, HttpServletResponse response) {
        return change(keyId, "disable", gateway::disableApiKey, response);
    }

    @PostMapping("/{keyId}/revoke")
    ResponseEntity<Map<String, Object>> revoke(@PathVariable String keyId, HttpServletResponse response) {
        return change(keyId, "revoke", gateway::revokeApiKey, response);
    }

    private ResponseEntity<Map<String, Object>> change(String keyId, String action,
                                                        java.util.function.Consumer<String> operation,
                                                        HttpServletResponse response) {
        if (keyId == null || keyId.isBlank()) throw GatewayException.badRequest("keyId不能为空");
        operation.accept(keyId);
        var requestId = GatewayService.newRequestId();
        response.setHeader("x-request-id", requestId);
        return ResponseEntity.ok().header("x-request-id", requestId)
                .body(Map.of("success", true, "requestId", requestId,
                        "data", Map.of("keyId", keyId, "action", action)));
    }
}
