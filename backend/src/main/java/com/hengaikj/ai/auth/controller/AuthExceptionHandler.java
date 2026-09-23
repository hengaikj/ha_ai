package com.hengaikj.ai.auth.controller;

import com.hengaikj.ai.auth.dto.AuthApiResponse;
import com.hengaikj.ai.auth.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<AuthApiResponse<Void>> invalidRequest(Exception ignored) {
        return ResponseEntity.badRequest().body(AuthApiResponse.failure(400, "请求参数不合法"));
    }

    @ExceptionHandler(AuthService.AuthenticationFailedException.class)
    public ResponseEntity<AuthApiResponse<Void>> authenticationFailed() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(AuthApiResponse.failure(401, "用户名或密码错误"));
    }
}
