package com.hengaikj.ai;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public final class RequestRepository {
    private final AtomicLong sequence = new AtomicLong(1000);
    private final Map<String, RequestRecord> requestRecords = new ConcurrentHashMap<>();
    private final Map<Long, AttemptRecord> attempts = new ConcurrentHashMap<>();

    RequestRecord start(String requestId, String clientRequestId, String projectId, String apiKeyId,
                        String model, Instant startedAt) {
        var record = new RequestRecord(sequence.incrementAndGet(), requestId, clientRequestId,
                projectId, apiKeyId, model, startedAt, null, RequestStatus.STARTED);
        requestRecords.put(requestId, record);
        return record;
    }

    AttemptRecord attempt(long requestId, String providerId, String channelId, Instant startedAt) {
        var record = new AttemptRecord(sequence.incrementAndGet(), requestId, providerId, channelId,
                startedAt, null, AttemptStatus.STARTED, null);
        attempts.put(record.attemptId(), record);
        return record;
    }

    void succeed(long id, Instant finishedAt, String ignoredProviderRequestId) {
        var attempt = attempts.get(id);
        if (attempt != null) {
            attempts.put(id, attempt.finished(finishedAt, AttemptStatus.SUCCESS,
                    ignoredProviderRequestId));
            return;
        }
        var request = requestRecords.values().stream().filter(r -> r.id() == id).findFirst().orElseThrow();
        requestRecords.put(request.requestId(), request.finished(finishedAt, RequestStatus.SUCCESS));
    }

    void fail(long id, Instant finishedAt, String ignoredErrorCode) {
        var attempt = attempts.get(id);
        if (attempt != null) {
            attempts.put(id, attempt.finished(finishedAt, AttemptStatus.FAILED, ignoredErrorCode));
            return;
        }
        var request = requestRecords.values().stream().filter(r -> r.id() == id).findFirst().orElseThrow();
        requestRecords.put(request.requestId(), request.finished(finishedAt, RequestStatus.FAILED));
    }

    RequestSnapshot find(String requestId) {
        var request = Optional.ofNullable(requestRecords.get(requestId))
                .orElseThrow(() -> new IllegalArgumentException("请求不存在"));
        var requestAttempts = attempts.values().stream()
                .filter(a -> a.requestId() == request.id()).toList();
        return new RequestSnapshot(request, requestAttempts);
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
