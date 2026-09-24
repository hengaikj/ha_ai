package com.hengaikj.ai.usage;

import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.auth.service.AuthzService.ProjectAction;
import com.hengaikj.ai.project.SuccessEnvelope;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static com.hengaikj.ai.filter.RequestIdFilter.ATTRIBUTE;

@RestController
@RequestMapping("/api/usage")
public class UsageController {
    private final UsageService service;
    private final AuthzService authz;

    public UsageController(UsageService service, AuthzService authz) {
        this.service = service;
        this.authz = authz;
    }

    @GetMapping
    public SuccessEnvelope<List<UsageSummary>> list(Authentication authentication, HttpServletRequest request) {
        var user = authz.currentUser(authentication);
        authz.requireProjectListAccess(user);
        return SuccessEnvelope.of(String.valueOf(request.getAttribute(ATTRIBUTE)), service.recent(user));
    }
}
