package com.hengaikj.ai;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

public final class GatewayException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    private GatewayException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    static GatewayException unauthorized(String message) {
        return new GatewayException(HttpStatus.UNAUTHORIZED, "invalid_api_key", message);
    }

    static GatewayException badRequest(String message) {
        return new GatewayException(HttpStatus.BAD_REQUEST, "invalid_request", message);
    }

    static GatewayException upstream(String message) {
        return new GatewayException(HttpStatus.BAD_GATEWAY, "provider_error", message);
    }

    HttpStatus status() {
        return status;
    }

    String code() {
        return code;
    }
}

@RestControllerAdvice
final class GatewayExceptionHandler {
    @ExceptionHandler(GatewayException.class)
    ResponseEntity<ErrorResponse> handle(GatewayException ex) {
        return ResponseEntity.status(ex.status())
                .body(new ErrorResponse(new ErrorBody(ex.getMessage(), "gateway_error", ex.code())));
    }
}
