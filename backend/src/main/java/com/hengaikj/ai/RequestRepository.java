package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.hengaikj.ai.persistence.entity.AttemptEntity;
import com.hengaikj.ai.persistence.entity.LogicalModelEntity;
import com.hengaikj.ai.persistence.entity.RequestEntity;
import com.hengaikj.ai.persistence.mapper.AttemptMapper;
import com.hengaikj.ai.persistence.mapper.LogicalModelMapper;
import com.hengaikj.ai.persistence.mapper.RequestMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class RequestRepository {
    private final AtomicLong sequence = new AtomicLong(System.currentTimeMillis() * 1000L);
    private final RequestMapper requestMapper;
    private final AttemptMapper attemptMapper;
    private final LogicalModelMapper logicalModelMapper;
    private final Map<String, RequestRecord> requestRecords = new ConcurrentHashMap<>();
    private final Map<Long, AttemptRecord> attempts = new ConcurrentHashMap<>();

    public RequestRepository() {
        this(null, null, null);
    }

    public RequestRepository(RequestMapper requestMapper, AttemptMapper attemptMapper,
                             LogicalModelMapper logicalModelMapper) {
        this.requestMapper = requestMapper;
        this.attemptMapper = attemptMapper;
        this.logicalModelMapper = logicalModelMapper;
    }

    RequestRecord start(String requestId, String clientRequestId, String projectId, String apiKeyId,
                        String model, Instant startedAt) {
        return start(requestId, clientRequestId, 0L, projectId, apiKeyId, model, startedAt);
    }

    RequestRecord start(String requestId, String clientRequestId, long enterpriseId,
                        String projectId, String apiKeyId, String model, Instant startedAt) {
        long id = sequence.incrementAndGet();
        if (requestMapper != null) {
            var entity = new RequestEntity();
            entity.requestId = id;
            entity.enterpriseId = enterpriseId;
            entity.projectId = Long.parseLong(projectId);
            entity.apiKeyId = Long.parseLong(apiKeyId);
            entity.logicalModelId = resolveLogicalModelId(model);
            entity.clientRequestId = clientRequestId;
            entity.stream = false;
            entity.executionResult = "STARTED";
            entity.deliveryResult = "NOT_STARTED";
            entity.billingResult = "NOT_CHARGEABLE";
            entity.startedAt = toLocalDateTime(startedAt);
            entity.createdAt = entity.startedAt;
            requestMapper.insert(entity);
        }
        var record = new RequestRecord(id, requestId, clientRequestId, projectId, apiKeyId,
                model, startedAt, null, RequestStatus.STARTED);
        requestRecords.put(requestId, record);
        return record;
    }

    AttemptRecord attempt(long requestId, String providerId, String channelId, Instant startedAt) {
        int attemptNo = (int) attempts.values().stream()
                .filter(attempt -> attempt.requestId() == requestId)
                .count() + 1;
        long id = sequence.incrementAndGet();
        if (attemptMapper != null) {
            var entity = new AttemptEntity();
            entity.attemptId = id;
            entity.requestId = requestId;
            entity.attemptNo = attemptNo;
            entity.providerId = Long.parseLong(providerId);
            entity.channelId = Long.parseLong(channelId);
            entity.executionResult = "STARTED";
            entity.startedAt = toLocalDateTime(startedAt);
            entity.createdAt = entity.startedAt;
            attemptMapper.insert(entity);
            id = entity.attemptId;
        }
        var record = new AttemptRecord(id, requestId, providerId, channelId, startedAt,
                null, AttemptStatus.STARTED, null);
        attempts.put(record.attemptId(), record);
        return record;
    }

    void succeed(long id, Instant finishedAt, String providerRequestId) {
        var attempt = attempts.get(id);
        if (attempt != null) {
            attempts.put(id, attempt.finished(finishedAt, AttemptStatus.SUCCESS, providerRequestId));
            if (attemptMapper != null) {
                attemptMapper.update(null, new UpdateWrapper<AttemptEntity>()
                        .eq("attempt_id", id)
                        .set("execution_result", "SUCCESS")
                        .set("provider_request_id", providerRequestId)
                        .set("finished_at", toLocalDateTime(finishedAt)));
            }
            return;
        }
        var request = requestRecords.values().stream()
                .filter(record -> record.id() == id).findFirst().orElseThrow();
        requestRecords.put(request.requestId(), request.finished(finishedAt, RequestStatus.SUCCESS));
        if (requestMapper != null) {
            requestMapper.update(null, new UpdateWrapper<RequestEntity>()
                    .eq("request_id", id)
                    .set("execution_result", "SUCCESS")
                    .set("finished_at", toLocalDateTime(finishedAt)));
        }
    }

    void fail(long id, Instant finishedAt, String errorCode) {
        var attempt = attempts.get(id);
        if (attempt != null) {
            attempts.put(id, attempt.finished(finishedAt, AttemptStatus.FAILED, errorCode));
            if (attemptMapper != null) {
                attemptMapper.update(null, new UpdateWrapper<AttemptEntity>()
                        .eq("attempt_id", id)
                        .set("execution_result", "FAILED")
                        .set("normalized_error_code", errorCode)
                        .set("finished_at", toLocalDateTime(finishedAt)));
            }
            return;
        }
        var request = requestRecords.values().stream()
                .filter(record -> record.id() == id).findFirst().orElseThrow();
        requestRecords.put(request.requestId(), request.finished(finishedAt, RequestStatus.FAILED));
        if (requestMapper != null) {
            requestMapper.update(null, new UpdateWrapper<RequestEntity>()
                    .eq("request_id", id)
                    .set("execution_result", "FAILED")
                    .set("finished_at", toLocalDateTime(finishedAt)));
        }
    }

    RequestSnapshot find(String requestId) {
        var request = Optional.ofNullable(requestRecords.get(requestId))
                .orElseThrow(() -> new IllegalArgumentException("请求不存在"));
        var requestAttempts = attempts.values().stream()
                .filter(attempt -> attempt.requestId() == request.id()).toList();
        return new RequestSnapshot(request, requestAttempts);
    }

    private long resolveLogicalModelId(String model) {
        if (logicalModelMapper == null) return 0L;
        return Optional.ofNullable(logicalModelMapper.selectOne(new QueryWrapper<LogicalModelEntity>()
                        .eq("model_code", model)
                        .last("LIMIT 1")))
                .map(entity -> entity.logicalModelId)
                .orElse(0L);
    }

    private static LocalDateTime toLocalDateTime(Instant value) {
        return LocalDateTime.ofInstant(value, ZoneOffset.UTC);
    }
}

record RequestRecord(long id, String requestId, String clientRequestId, String projectId,
                     String apiKeyId, String model, Instant startedAt, Instant finishedAt,
                     RequestStatus status) {
    RequestRecord finished(Instant at, RequestStatus result) {
        return new RequestRecord(id, requestId, clientRequestId, projectId, apiKeyId, model,
                startedAt, at, result);
    }
}

record AttemptRecord(long attemptId, long requestId, String providerId, String channelId,
                     Instant startedAt, Instant finishedAt, AttemptStatus status,
                     String providerRequestId) {
    AttemptRecord finished(Instant at, AttemptStatus result, String requestId) {
        return new AttemptRecord(attemptId, requestId(), providerId, channelId, startedAt, at,
                result, requestId);
    }
}

record RequestSnapshot(RequestRecord request, java.util.List<AttemptRecord> attempts) {}
enum RequestStatus { STARTED, SUCCESS, FAILED }
enum AttemptStatus { STARTED, SUCCESS, FAILED }
