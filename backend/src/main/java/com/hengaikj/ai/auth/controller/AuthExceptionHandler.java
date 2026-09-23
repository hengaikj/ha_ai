package com.hengaikj.ai.auth.controller;

import com.hengaikj.ai.auth.dto.AuthApiResponse;
import com.hengaikj.ai.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<?> invalidRequest(Exception ignored, HttpServletRequest request) {
        if (request.getRequestURI().startsWith("/api/")) {
            return ResponseEntity.badRequest().body(apiError("请求参数或状态不合法", "validation_error", 400));
        }
        return ResponseEntity.badRequest().body(AuthApiResponse.failure(400, "请求参数不合法"));
    }

    @ExceptionHandler(AuthService.AuthenticationFailedException.class)
    public ResponseEntity<AuthApiResponse<Void>> authenticationFailed() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(AuthApiResponse.failure(401, "用户名或密码错误"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> forbidden(HttpServletRequest request) {
        if (request.getRequestURI().startsWith("/api/")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(apiError("无权限或数据范围越权", "authorization_error", 403));
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(AuthApiResponse.failure(403, "无权执行该操作"));
    }

    @ExceptionHandler({ResponseStatusException.class, DuplicateKeyException.class})
    public ResponseEntity<?> requestConflictOrMissing(Exception error, HttpServletRequest request) {
        HttpStatus status = error instanceof ResponseStatusException response
                ? HttpStatus.valueOf(response.getStatusCode().value()) : HttpStatus.CONFLICT;
        String message = switch (status) {
            case BAD_REQUEST -> "请求参数或状态不合法";
            case NOT_FOUND -> "资源不存在";
            case CONFLICT -> error instanceof ResponseStatusException response && response.getReason() != null
                    ? response.getReason() : "资源冲突";
            default -> "平台内部错误";
        };
        if (request.getRequestURI().startsWith("/api/")) {
            return ResponseEntity.status(status).body(apiError(message, status == HttpStatus.CONFLICT ? "conflict" : "request_error", status.value()));
        }
        return ResponseEntity.status(status).body(AuthApiResponse.failure(status.value(), message));
    }

    private static java.util.Map<String, Object> apiError(String message, String type, int code) {
        return java.util.Map.of("error", java.util.Map.of("message", message, "type", type, "code", Integer.toString(code)));
    }
}
