package com.hengaikj.ai.auth.controller;

import com.hengaikj.ai.auth.dto.*;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.UserRoleManagementService;
import com.hengaikj.ai.project.SuccessEnvelope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.hengaikj.ai.filter.RequestIdFilter.ATTRIBUTE;

@RestController
@RequestMapping("/api/auth")
public class UserRoleManagementController {
    private final UserRoleManagementService service;
    private final AuthzService authz;

    public UserRoleManagementController(UserRoleManagementService service, AuthzService authz) {
        this.service = service;
        this.authz = authz;
    }

    @GetMapping("/users")
    public SuccessEnvelope<List<UserSummary>> users(Authentication authentication, HttpServletRequest request) {
        return SuccessEnvelope.of(requestId(request), service.list(authz.currentUser(authentication)));
    }

    @PostMapping("/users")
    public ResponseEntity<SuccessEnvelope<UserSummary>> create(Authentication authentication, HttpServletRequest request,
                                                                @Valid @RequestBody UserCreateRequest body) {
        AuthUserContext actor = authz.currentUser(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(SuccessEnvelope.of(requestId(request), service.create(actor, body)));
    }

    @PostMapping("/users/{userId}/status")
    public SuccessEnvelope<UserSummary> status(Authentication authentication, HttpServletRequest request,
                                                @PathVariable long userId, @Valid @RequestBody UserStatusRequest body) {
        return SuccessEnvelope.of(requestId(request), service.changeStatus(authz.currentUser(authentication), userId, body));
    }

    @GetMapping("/roles")
    public SuccessEnvelope<List<RoleSummary>> roles(Authentication authentication, HttpServletRequest request) {
        return SuccessEnvelope.of(requestId(request), service.roles(authz.currentUser(authentication)));
    }

    @GetMapping("/enterprises/options")
    public SuccessEnvelope<List<EnterpriseOption>> enterpriseOptions(Authentication authentication,
                                                                       HttpServletRequest request) {
        return SuccessEnvelope.of(requestId(request),
                service.activeEnterpriseOptions(authz.currentUser(authentication)));
    }

    @PutMapping("/users/{userId}/roles")
    public SuccessEnvelope<UserSummary> bindRoles(Authentication authentication, HttpServletRequest request,
                                                   @PathVariable long userId, @Valid @RequestBody UserRoleBindingRequest body) {
        return SuccessEnvelope.of(requestId(request), service.bind(authz.currentUser(authentication), userId, body));
    }

    private static String requestId(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE);
        return value == null ? "" : value.toString();
    }
}
