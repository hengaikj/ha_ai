package com.hengaikj.ai;

import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

/** Project错误响应保留追踪ID，并避免暴露数据库内部错误。 */
@Order(-1)
@RestControllerAdvice(assignableTypes = ProjectController.class)
final class ProjectExceptionHandler {
    @ExceptionHandler(GatewayException.class)
    ResponseEntity<ErrorResponse> business(GatewayException ex) {
        return error(ex.status().value(), ex.code(), ex.getMessage());
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, ServletRequestBindingException.class,
            MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ErrorResponse> invalid(Exception ex) {
        return error(400, "invalid_request", "项目请求参数无效");
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex) {
        return error(500, "internal_error", "项目服务内部错误");
    }
    private ResponseEntity<ErrorResponse> error(int status, String code, String message) {
        return ResponseEntity.status(status).header("x-request-id", GatewayService.newRequestId())
                .body(new ErrorResponse(new ErrorBody(message, "gateway_error", code)));
    }
}
