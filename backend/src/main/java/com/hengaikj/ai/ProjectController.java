package com.hengaikj.ai;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 企业 Project 管理接口，所有查询均按企业范围隔离。 */
@RestController
@RequestMapping("/api/projects")
final class ProjectController {
    private final ProjectApplicationService service;

    ProjectController(ProjectApplicationService service) { this.service = service; }

    @PostMapping
    ResponseEntity<ProjectResponse> create(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                           @Valid @RequestBody ProjectCreateRequest request,
                                           HttpServletResponse response) {
        return ok(service.create(enterpriseId,
                new ProjectCreateCommand(request.projectCode(), request.projectName(), request.entitlementMode())), response);
    }

    @GetMapping
    ResponseEntity<ProjectListResponse> list(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                              HttpServletResponse response) {
        var requestId = GatewayService.newRequestId();
        response.setHeader("x-request-id", requestId);
        var data = service.list(enterpriseId).stream().map(ProjectSummary::from).toList();
        return ResponseEntity.ok().header("x-request-id", requestId)
                .body(new ProjectListResponse(true, requestId, data));
    }

    @GetMapping("/{projectId}")
    ResponseEntity<ProjectResponse> get(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                        @PathVariable long projectId,
                                        HttpServletResponse response) {
        return ok(service.get(enterpriseId, projectId), response);
    }

    @PutMapping("/{projectId}")
    ResponseEntity<ProjectResponse> update(@RequestHeader("X-Enterprise-Id") long enterpriseId,
                                           @PathVariable long projectId,
                                           @Valid @RequestBody ProjectUpdateRequest request,
                                           HttpServletResponse response) {
        return ok(service.update(enterpriseId, projectId,
                new ProjectUpdateCommand(request.projectName(), request.entitlementMode())), response);
    }

    private ResponseEntity<ProjectResponse> ok(ProjectRecord project, HttpServletResponse response) {
        var requestId = GatewayService.newRequestId();
        response.setHeader("x-request-id", requestId);
        return ResponseEntity.ok().header("x-request-id", requestId)
                .body(new ProjectResponse(true, requestId, ProjectSummary.from(project)));
    }
}

record ProjectSummary(String projectId, String projectCode, String projectName,
                      String entitlementMode, String status) {
    static ProjectSummary from(ProjectRecord project) {
        return new ProjectSummary(String.valueOf(project.projectId), project.projectCode,
                project.projectName, project.entitlementMode, project.status);
    }
}

record ProjectListResponse(boolean success, String requestId, List<ProjectSummary> data) {}
record ProjectResponse(boolean success, String requestId, ProjectSummary data) {}

record ProjectCreateRequest(@NotBlank @Size(max = 64) String projectCode,
                            @NotBlank @Size(max = 128) String projectName,
                            @NotBlank String entitlementMode) {}
record ProjectUpdateRequest(@NotBlank @Size(max = 128) String projectName,
                            @NotBlank String entitlementMode) {}
