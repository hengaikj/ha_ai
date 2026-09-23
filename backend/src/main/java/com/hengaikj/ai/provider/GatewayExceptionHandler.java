package com.hengaikj.ai.provider;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class GatewayExceptionHandler {
    @ExceptionHandler(GatewayException.class)
    ResponseEntity<Map<String, Object>> handle(GatewayException exception) {
        return ResponseEntity.status(exception.status).body(Map.of(
                "error", Map.of(
                        "type", exception.status == 401 ? "authentication_error" : "invalid_request_error",
                        "code", exception.code,
                        "message", exception.getMessage()
                )
        ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of(
                "error", Map.of(
                        "type", "invalid_request_error",
                        "code", "invalid_request",
                        "message", exception.getMessage() == null ? "请求参数不合法" : exception.getMessage()
                )
        ));
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException exception) {
        return ResponseEntity.status(404).body(Map.of(
                "error", Map.of(
                        "type", "not_found",
                        "code", "resource_not_found",
                        "message", exception.getMessage() == null ? "资源不存在" : exception.getMessage()
                )
        ));
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, Object>> handleConflict(IllegalStateException exception) {
        return ResponseEntity.status(409).body(Map.of(
                "error", Map.of(
                        "type", "conflict",
                        "code", "state_conflict",
                        "message", exception.getMessage() == null ? "资源状态冲突" : exception.getMessage()
                )
        ));
    }
}
