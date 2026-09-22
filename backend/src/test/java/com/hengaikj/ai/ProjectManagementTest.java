package com.hengaikj.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProjectManagementTest {
    @Test
    void memoryRepositorySupportsCreateReadUpdateAndTenantIsolation() {
        var service = new ProjectApplicationService(new InMemoryProjectRepository());
        var created = service.create(1001L, new ProjectCreateCommand("demo", "演示项目", "BALANCE"));
        assertEquals("ACTIVE", created.status);
        assertEquals("演示项目", service.get(1001L, created.projectId).projectName);
        var updated = service.update(1001L, created.projectId,
                new ProjectUpdateCommand("更新项目", "SUBSCRIPTION"));
        assertEquals("更新项目", updated.projectName);
        assertEquals("SUBSCRIPTION", updated.entitlementMode);
        assertThrows(GatewayException.class, () -> service.get(1002L, created.projectId));
    }

    @Test
    void rejectsDuplicateCodeAndInvalidEntitlementMode() {
        var service = new ProjectApplicationService(new InMemoryProjectRepository());
        service.create(1001L, new ProjectCreateCommand("demo", "演示项目", "BALANCE"));
        assertThrows(GatewayException.class,
                () -> service.create(1001L, new ProjectCreateCommand("demo", "重复项目", "BALANCE")));
        assertThrows(GatewayException.class,
                () -> service.create(1001L, new ProjectCreateCommand("other", "其他项目", "UNKNOWN")));
    }
}
