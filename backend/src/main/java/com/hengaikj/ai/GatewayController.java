package com.hengaikj.ai;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
@RestController
public class GatewayController {
 private final GatewayService service;
 public GatewayController(GatewayService service) { this.service=service; }
 @GetMapping("/v1/models")
 ModelList models(@RequestHeader(value="Authorization",required=false) String auth) {
  service.authenticate(auth); return service.models();
 }
 @PostMapping("/v1/chat/completions")
 ChatResponse chat(@RequestHeader(value="Authorization",required=false) String auth,@Valid @RequestBody ChatRequest request) {
  service.authenticate(auth); return service.complete(request);
 }
}
