package com.hengaikj.ai.provider;
import org.springframework.web.bind.annotation.*; import org.springframework.http.*; import java.util.Map;
@RestControllerAdvice public class ProviderExceptionHandler { @ExceptionHandler(ProviderError.class) ResponseEntity<Map<String,Object>> handle(ProviderError e){return ResponseEntity.status(e.status).body(Map.of("error",Map.of("type","upstream_error","code",e.code,"message",e.getMessage())));}}
