package com.hengaikj.ai.controller;

import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.AuthzService.ProjectAction;
import com.hengaikj.ai.entity.ApiKeyCreateRequest;
import com.hengaikj.ai.entity.ApiKeyCreateResponse;
import com.hengaikj.ai.entity.ApiKeyEntity;
import com.hengaikj.ai.entity.ApiKeySummary;
import com.hengaikj.ai.filter.RequestIdFilter;
import com.hengaikj.ai.project.SuccessEnvelope;
import com.hengaikj.ai.service.ApiKeyService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiKeyController {
    private final ApiKeyService service;
    private final AuthzService authz;

    public ApiKeyController(ApiKeyService service, AuthzService authz) {
        this.service = service;
        this.authz = authz;
    }

    @PostMapping("/projects/{projectId}/api-keys")
    public ResponseEntity<SuccessEnvelope<ApiKeyCreateResponse>> create(
            @PathVariable("projectId") long projectId,
            @RequestBody ApiKeyCreateRequest requestBody,
            Authentication authentication,
            HttpServletRequest request
    ) {
        AuthUserContext user = authz.currentUser(authentication);
        AuthzService.ProjectScope scope = authz.requireProjectAccess(user, projectId, ProjectAction.MANAGE_KEYS);
        return ResponseEntity.status(HttpStatus.CREATED).body(SuccessEnvelope.of(requestId(request),
                service.create(scope.enterpriseId(), scope.projectId(), requestBody)));
    }

    @GetMapping("/projects/{projectId}/api-keys")
    public SuccessEnvelope<List<ApiKeySummary>> list(
            @PathVariable("projectId") long projectId,
            Authentication authentication,
            HttpServletRequest request
    ) {
        AuthUserContext user = authz.currentUser(authentication);
        AuthzService.ProjectScope scope = authz.requireProjectAccess(user, projectId, ProjectAction.READ_KEYS);
        return SuccessEnvelope.of(requestId(request), service.list(scope.enterpriseId(), scope.projectId()));
    }

    @PostMapping("/api-keys/{keyId}/disable")
    public SuccessEnvelope<ApiKeySummary> disable(@PathVariable("keyId") long keyId, Authentication authentication,
                                                  HttpServletRequest request) {
        return change(keyId, "DISABLED", authentication, request);
    }

    @PostMapping("/api-keys/{keyId}/enable")
    public SuccessEnvelope<ApiKeySummary> enable(@PathVariable("keyId") long keyId, Authentication authentication,
                                                 HttpServletRequest request) {
        return change(keyId, "ENABLED", authentication, request);
    }

    @PostMapping("/api-keys/{keyId}/revoke")
    public SuccessEnvelope<ApiKeySummary> revoke(@PathVariable("keyId") long keyId, Authentication authentication,
                                                 HttpServletRequest request) {
        return change(keyId, "REVOKED", authentication, request);
    }

    private SuccessEnvelope<ApiKeySummary> change(long keyId, String status, Authentication authentication,
                                                   HttpServletRequest request) {
        ApiKeyEntity key = service.findById(keyId);
        if (key == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "API Key不存在");
        AuthUserContext user = authz.currentUser(authentication);
        AuthzService.ProjectScope scope = authz.requireProjectAccess(user, key.projectId, ProjectAction.MANAGE_KEYS);
        return SuccessEnvelope.of(requestId(request), service.change(scope.enterpriseId(), scope.projectId(), keyId, status));
    }

    private static String requestId(HttpServletRequest request) {
        Object value = request.getAttribute(RequestIdFilter.ATTRIBUTE);
        return value == null ? request.getHeader("x-request-id") : value.toString();
    }
}
