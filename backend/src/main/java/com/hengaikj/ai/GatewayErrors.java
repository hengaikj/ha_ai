package com.hengaikj.ai;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
@RestControllerAdvice
public class GatewayErrors {
 @ExceptionHandler(ResponseStatusException.class)
 ResponseEntity<ErrorResponse> status(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(new ErrorResponse(new ErrorBody("请求被拒绝","invalid_request_error",Integer.toString(e.getStatusCode().value())))); }
 @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class})
 ResponseEntity<ErrorResponse> invalid(Exception e) { return ResponseEntity.badRequest().body(new ErrorResponse(new ErrorBody("请求格式无效","invalid_request_error","400"))); }
 @ExceptionHandler(Exception.class)
 ResponseEntity<ErrorResponse> unexpected(Exception e) { return ResponseEntity.internalServerError().body(new ErrorResponse(new ErrorBody("内部服务错误","server_error","500"))); }
}
