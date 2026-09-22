package com.hengaikj.ai;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid; import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity; import org.springframework.web.bind.annotation.*; import java.time.Instant; import java.util.*;
@RestController @RequestMapping("/api") final class ApiKeyManagementController {
 private final ApiKeyManagementService service; ApiKeyManagementController(ApiKeyManagementService s){service=s;}
 @GetMapping("/projects/{projectId}/api-keys") ResponseEntity<ApiKeyListResponse> list(@RequestHeader("X-Enterprise-Id") long e,@PathVariable("projectId") long p,HttpServletResponse h){var id=GatewayService.newRequestId();h.setHeader("x-request-id",id);return ResponseEntity.ok(new ApiKeyListResponse(true,id,service.list(e,p)));}
 @PostMapping("/projects/{projectId}/api-keys") ResponseEntity<ApiKeyCreateResponse> create(@RequestHeader("X-Enterprise-Id") long e,@PathVariable("projectId") long p,@Valid @RequestBody ApiKeyCreateRequest r,HttpServletResponse h){var id=GatewayService.newRequestId();h.setHeader("x-request-id",id);return ResponseEntity.ok(new ApiKeyCreateResponse(true,id,service.create(e,p,r.keyName(),r.expiresAt())));}
 @PostMapping("/api-keys/{id}/disable") ResponseEntity<StatusResponse> disable(@RequestHeader("X-Enterprise-Id") long e,@RequestHeader("X-Project-Id") long p,@PathVariable String id,HttpServletResponse h){return change(e,p,id,ApiKeyStatus.DISABLED,h);}
 @PostMapping("/api-keys/{id}/enable") ResponseEntity<StatusResponse> enable(@RequestHeader("X-Enterprise-Id") long e,@RequestHeader("X-Project-Id") long p,@PathVariable String id,HttpServletResponse h){return change(e,p,id,ApiKeyStatus.ENABLED,h);}
 @PostMapping("/api-keys/{id}/revoke") ResponseEntity<StatusResponse> revoke(@RequestHeader("X-Enterprise-Id") long e,@RequestHeader("X-Project-Id") long p,@PathVariable String id,HttpServletResponse h){return change(e,p,id,ApiKeyStatus.REVOKED,h);}
 private ResponseEntity<StatusResponse> change(long e,long p,String id,ApiKeyStatus s,HttpServletResponse h){var rid=GatewayService.newRequestId();service.change(e,p,id,s);h.setHeader("x-request-id",rid);return ResponseEntity.ok(new StatusResponse(true,rid,Map.of("apiKeyId",id,"status",s.name())));}
}
record ApiKeyCreateRequest(@NotBlank String keyName, Instant expiresAt) {}
record ApiKeyListResponse(boolean success,String requestId,List<ApiKeySummary> data) {}
record ApiKeyCreateResponse(boolean success,String requestId,ApiKeyCreated data) {}
record StatusResponse(boolean success,String requestId,Map<String,String> data) {}
