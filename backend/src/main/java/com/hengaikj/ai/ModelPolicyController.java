package com.hengaikj.ai;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/** 项目模型权限管理接口。 */
@RestController
@RequestMapping("/api/projects/{projectId}/models")
final class ModelPolicyController {
    private final ModelPolicyService service;

    ModelPolicyController(ModelPolicyService service) { this.service = service; }

    @GetMapping
    ResponseEntity<Map<String, Object>> get(@PathVariable long projectId,
                                             HttpServletResponse response) {
        validateProject(projectId);
        return ok(response, service.allowed(String.valueOf(projectId)));
    }

    @PutMapping
    ResponseEntity<Map<String, Object>> replace(@PathVariable long projectId,
                                                 @Valid @RequestBody ModelPolicyRequest request,
                                                 HttpServletResponse response) {
        validateProject(projectId);
        service.replace(String.valueOf(projectId), SetCopy.copy(request.models()));
        return ok(response, service.allowed(String.valueOf(projectId)));
    }

    private ResponseEntity<Map<String, Object>> ok(HttpServletResponse response, java.util.Set<String> models) {
        var requestId = GatewayService.newRequestId();
        response.setHeader("x-request-id", requestId);
        return ResponseEntity.ok().header("x-request-id", requestId)
                .body(Map.of("success", true, "requestId", requestId,
                        "data", Map.of("models", models.stream().sorted().toList())));
    }

    private static void validateProject(long projectId) {
        if (projectId <= 0) throw GatewayException.badRequest("projectId必须为正整数");
    }
}

record ModelPolicyRequest(@NotNull List<String> models) {}

final class SetCopy {
    private SetCopy() {}
    static java.util.Set<String> copy(List<String> values) {
        return values == null ? null : java.util.Set.copyOf(values);
    }
}
