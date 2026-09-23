package com.hengaikj.ai.usage;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.hengaikj.ai.entity.UsageEntity;
import com.hengaikj.ai.mapper.UsageMapper;
import com.hengaikj.ai.auth.service.AuthUserContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
public class UsageService {
    private final UsageMapper mapper;
    private final ConcurrentLinkedQueue<UsageRecord> testRecords = new ConcurrentLinkedQueue<>();

    /** 测试专用构造器，允许不启动 MyBatis 的单元测试。 */
    public UsageService() { this.mapper = null; }

    @Autowired
    public UsageService(UsageMapper mapper) { this.mapper = mapper; }

    public UsageRecord record(String id, String model, long prompt, long completion) {
        Instant recordedAt = Instant.now();
        UsageRecord record = new UsageRecord(id, model, prompt, completion, prompt + completion, recordedAt);
        if (mapper == null) {
            testRecords.add(record);
            return record;
        }
        UsageEntity entity = new UsageEntity();
        entity.requestId = id;
        entity.model = model;
        entity.promptTokens = prompt;
        entity.completionTokens = completion;
        entity.totalTokens = prompt + completion;
        entity.recordedAt = LocalDateTime.ofInstant(recordedAt, ZoneOffset.UTC);
        mapper.insert(entity);
        return record;
    }

    public List<UsageRecord> recent() {
        if (mapper == null) return List.copyOf(testRecords);
        return mapper.selectList(new QueryWrapper<UsageEntity>()
                        .orderByDesc("recorded_at")
                        .last("LIMIT 100"))
                .stream().map(this::toRecord).toList();
    }

    public List<UsageSummary> recent(AuthUserContext user) {
        if (mapper == null) {
            return List.of();
        }
        boolean platformAdmin = user.roleCodes().contains("platform-admin");
        Long enterpriseId = !platformAdmin && user.roleCodes().contains("enterprise-admin")
                ? user.enterpriseId() : null;
        List<Long> projectIds = !platformAdmin && enterpriseId == null ? user.projectIds() : null;
        return mapper.selectScopedUsage(platformAdmin, enterpriseId, projectIds).stream()
                .map(row -> new UsageSummary(row.getRequestId(), row.getProjectId() == null ? null : row.getProjectId().toString(),
                        row.getModel(), row.getExecutionResult(), row.getCreatedAt() == null ? null : row.getCreatedAt().toInstant(ZoneOffset.UTC)))
                .toList();
    }

    private UsageRecord toRecord(UsageEntity entity) {
        Instant recordedAt = entity.recordedAt == null ? null : entity.recordedAt.toInstant(ZoneOffset.UTC);
        return new UsageRecord(entity.requestId, entity.model,
                entity.promptTokens == null ? 0 : entity.promptTokens,
                entity.completionTokens == null ? 0 : entity.completionTokens,
                entity.totalTokens == null ? 0 : entity.totalTokens, recordedAt);
    }
}
