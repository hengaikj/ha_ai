package com.hengaikj.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProjectManagementTest {
    @Test
    void concurrentCreatesUseDistinctIdsEvenWithSameDatabaseSnapshot() throws Exception {
        var mapper = org.mockito.Mockito.mock(com.hengaikj.ai.persistence.mapper.ProjectMapper.class);
        org.mockito.Mockito.when(mapper.selectObjs(org.mockito.ArgumentMatchers.any()))
                .thenReturn(java.util.List.of(1001L));
        var barrier = new java.util.concurrent.CyclicBarrier(2);
        org.mockito.Mockito.when(mapper.insert(org.mockito.ArgumentMatchers.any(
                com.hengaikj.ai.persistence.entity.ProjectEntity.class))).thenAnswer(invocation -> {
            barrier.await(5, java.util.concurrent.TimeUnit.SECONDS);
            return 1;
        });
        var repository = new MybatisProjectRepository(mapper);
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> repository.create(1L, "first", "项目一", "BALANCE"));
            var second = executor.submit(() -> repository.create(1L, "second", "项目二", "BALANCE"));
            assertNotEquals(first.get(10, java.util.concurrent.TimeUnit.SECONDS).projectId,
                    second.get(10, java.util.concurrent.TimeUnit.SECONDS).projectId);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void concurrentDuplicateCodeBecomesConflict() {
        var mapper = org.mockito.Mockito.mock(com.hengaikj.ai.persistence.mapper.ProjectMapper.class);
        org.mockito.Mockito.when(mapper.insert(org.mockito.ArgumentMatchers.any(
                com.hengaikj.ai.persistence.entity.ProjectEntity.class)))
                .thenThrow(new org.springframework.dao.DuplicateKeyException("数据库唯一约束冲突"));
        var repository = new MybatisProjectRepository(mapper);
        var error = assertThrows(GatewayException.class,
                () -> repository.create(1L, "demo", "演示项目", "BALANCE"));
        assertEquals(org.springframework.http.HttpStatus.CONFLICT, error.status());
    }

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
    void listReturnsOnlyProjectsInEnterprise() {
        var service = new ProjectApplicationService(new InMemoryProjectRepository());
        service.create(1001L, new ProjectCreateCommand("one", "项目一", "BALANCE"));
        service.create(1001L, new ProjectCreateCommand("two", "项目二", "SUBSCRIPTION"));
        service.create(1002L, new ProjectCreateCommand("other", "其他企业", "BALANCE"));
        var projects = service.list(1001L);
        assertEquals(2, projects.size());
        assertTrue(projects.stream().allMatch(project -> project.enterpriseId == 1001L));
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
