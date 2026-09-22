package com.hengaikj.ai;

import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

/** API Key 管理错误边界：不把数据库、Secret或内部异常写入响应。 */
@Order(-1)
@RestControllerAdvice(assignableTypes = ApiKeyManagementController.class)
final class ApiKeyManagementExceptionHandler {
    @ExceptionHandler(GatewayException.class)
    ResponseEntity<ErrorResponse> business(GatewayException ex) {
        return error(ex.status().value(), ex.code(), ex.getMessage());
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, ServletRequestBindingException.class,
            MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ErrorResponse> invalid(Exception ex) {
        return error(400, "invalid_request", "API Key请求参数无效");
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex) {
        return error(500, "internal_error", "API Key服务内部错误");
    }
    private ResponseEntity<ErrorResponse> error(int status, String code, String message) {
        return ResponseEntity.status(status).header("x-request-id", GatewayService.newRequestId())
                .body(new ErrorResponse(new ErrorBody(message, "gateway_error", code)));
    }
}
