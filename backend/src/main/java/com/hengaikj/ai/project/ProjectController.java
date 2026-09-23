package com.hengaikj.ai.project;

import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.filter.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectService service;
    private final AuthzService authz;

    public ProjectController(ProjectService service, AuthzService authz) {
        this.service = service;
        this.authz = authz;
    }

    @GetMapping
    public SuccessEnvelope<List<ProjectSummary>> list(Authentication authentication, HttpServletRequest request) {
        AuthUserContext user = authz.currentUser(authentication);
        authz.requirePermission(user, "project:read");
        return SuccessEnvelope.of(requestId(request), service.list(user));
    }

    @PostMapping
    public ResponseEntity<SuccessEnvelope<ProjectSummary>> create(Authentication authentication,
            HttpServletRequest servletRequest, @Valid @RequestBody ProjectCreateRequest request) {
        AuthUserContext user = authz.currentUser(authentication);
        authz.requirePermission(user, "project:create");
        return ResponseEntity.ok(SuccessEnvelope.of(requestId(servletRequest), service.create(user, request)));
    }

    private static String requestId(HttpServletRequest request) {
        Object value = request.getAttribute(RequestIdFilter.ATTRIBUTE);
        return value == null ? "" : value.toString();
    }
}
