package com.hengaikj.ai.auth.controller;

import com.hengaikj.ai.auth.dto.AuthApiResponse;
import com.hengaikj.ai.auth.dto.AuthInfoData;
import com.hengaikj.ai.auth.dto.AuthMenu;
import com.hengaikj.ai.auth.dto.AuthUserSummary;
import com.hengaikj.ai.auth.dto.LoginData;
import com.hengaikj.ai.auth.dto.LoginRequest;
import com.hengaikj.ai.auth.service.AuthService;
import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.JwtSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class AuthController {
    private static final List<String> NO_PERMISSION_CODES = List.of();
    private final AuthService authService;
    private final AuthzService authz;
    private final JwtSessionService sessions;

    public AuthController(AuthService authService, AuthzService authz, JwtSessionService sessions) {
        this.authService = authService;
        this.authz = authz;
        this.sessions = sessions;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthApiResponse<LoginData>> login(@Valid @RequestBody LoginRequest request) {
        try {
            AuthService.LoginResult result = authService.login(request);
            return ResponseEntity.ok(AuthApiResponse.success(new LoginData(result.accessToken(), result.expiresIn())));
        } catch (AuthService.AuthenticationFailedException failure) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(AuthApiResponse.failure(401, "用户名或密码错误"));
        }
    }

    @PostMapping("/logout")
    public AuthApiResponse<Void> logout(Authentication authentication) {
        JwtAuthenticationToken jwt = (JwtAuthenticationToken) authentication;
        sessions.revoke(jwt.getToken().getId());
        return AuthApiResponse.success(null);
    }

    @GetMapping("/getInfo")
    public AuthApiResponse<AuthInfoData> getInfo(Authentication authentication) {
        AuthUserContext context = authz.currentUser(authentication);
        List<String> roleCodes = context.roleCodes().stream().sorted().toList();
        AuthUserSummary user = new AuthUserSummary(context.userId(), context.username(), context.displayName(),
                context.enterpriseId(), roleCodes, NO_PERMISSION_CODES, context.projectIds());
        List<String> permissionCodes = user.permissionCodes().stream().sorted().toList();
        return AuthApiResponse.success(new AuthInfoData(user, roleCodes, permissionCodes));
    }

    @GetMapping("/getRouters")
    public AuthApiResponse<List<AuthMenu>> getRouters(Authentication authentication) {
        authz.currentUser(authentication);
        List<AuthMenu> menus = List.of(
                new AuthMenu("/ai/projects", "AiProjects", "ai/AiManagementPage.vue", Map.of("title", "项目")),
                new AuthMenu("/ai/usage", "AiUsage", "ai/AiManagementPage.vue", Map.of("title", "调用记录")));
        return AuthApiResponse.success(menus);
    }
}
