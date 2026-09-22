package com.hengaikj.ai;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

/** 企业 Project 管理接口，所有查询均按企业范围隔离。 */
@RestController
@RequestMapping("/api/projects")
final class ProjectController {
    private final ProjectApplicationService service;

    ProjectController(ProjectApplicationService service) { this.service = service; }

    @PostMapping
    ResponseEntity<Map<String, Object>> create(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                                @Valid @RequestBody ProjectCreateRequest request,
                                                HttpServletResponse response) {
        return ok(response, service.create(enterpriseId,
                new ProjectCreateCommand(request.projectCode(), request.projectName(), request.entitlementMode())));
    }

    @GetMapping
    ResponseEntity<Map<String, Object>> list(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                               HttpServletResponse response) {
        var requestId = GatewayService.newRequestId();
        var data = service.list(enterpriseId).stream().map(this::data).toList();
        response.setHeader("x-request-id", requestId);
        return ResponseEntity.ok().header("x-request-id", requestId)
                .body(Map.of("success", true, "requestId", requestId, "data", data));
    }

    @GetMapping("/{projectId}")
    ResponseEntity<Map<String, Object>> get(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                             @PathVariable long projectId,
                                             HttpServletResponse response) {
        return ok(response, service.get(enterpriseId, projectId));
    }

    @PutMapping("/{projectId}")
    ResponseEntity<Map<String, Object>> update(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                                @PathVariable long projectId,
                                                @Valid @RequestBody ProjectUpdateRequest request,
                                                HttpServletResponse response) {
        return ok(response, service.update(enterpriseId, projectId,
                new ProjectUpdateCommand(request.projectName(), request.entitlementMode())));
    }

    private Map<String, String> data(ProjectRecord project) {
        return Map.of("projectId", String.valueOf(project.projectId), "projectCode", project.projectCode,
                "projectName", project.projectName, "entitlementMode", project.entitlementMode,
                "status", project.status);
    }

    private ResponseEntity<Map<String, Object>> ok(HttpServletResponse response, ProjectRecord project) {
        var requestId = GatewayService.newRequestId();
        response.setHeader("x-request-id", requestId);
        var data = data(project);
        return ResponseEntity.ok().header("x-request-id", requestId)
                .body(Map.of("success", true, "requestId", requestId, "data", data));
    }
}

record ProjectCreateRequest(@NotBlank @Size(max = 64) String projectCode,
                            @NotBlank @Size(max = 128) String projectName,
                            @NotBlank String entitlementMode) {}
record ProjectUpdateRequest(@NotBlank @Size(max = 128) String projectName,
                            @NotBlank String entitlementMode) {}
