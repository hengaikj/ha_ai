package com.hengaikj.ai;

import com.hengaikj.ai.auth.service.AuthUserContext;
import com.hengaikj.ai.mapper.UsageMapper;
import com.hengaikj.ai.usage.UsageService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.mockito.Mockito.*;

class UsageScopeServiceTest {
    @Test
    void enterpriseAdminQueryUsesOnlyItsEnterpriseScope() {
        UsageMapper mapper = mock(UsageMapper.class);
        new UsageService(mapper).recent(new AuthUserContext(1L, "admin", "Admin", 100L,
                Set.of("enterprise-admin"), List.of(), Map.of()));
        verify(mapper).selectScopedUsage(false, 100L, null);
    }

    @Test
    void projectMemberQueryUsesOnlyAssignedProjects() {
        UsageMapper mapper = mock(UsageMapper.class);
        new UsageService(mapper).recent(new AuthUserContext(2L, "member", "Member", 100L,
                Set.of("project-viewer"), List.of(11L, 12L), Map.of()));
        verify(mapper).selectScopedUsage(false, null, List.of(11L, 12L));
    }

    @Test
    void platformAdminQueryIsGlobal() {
        UsageMapper mapper = mock(UsageMapper.class);
        new UsageService(mapper).recent(new AuthUserContext(3L, "root", "Root", null,
                Set.of("platform-admin"), List.of(), Map.of()));
        verify(mapper).selectScopedUsage(true, null, null);
    }
}
