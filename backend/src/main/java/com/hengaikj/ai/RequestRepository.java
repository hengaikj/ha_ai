package com.hengaikj.ai;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.jdbc.core.JdbcTemplate;

public final class RequestRepository {
    private final AtomicLong sequence = new AtomicLong(1000);
    private final JdbcTemplate jdbc;
    private final Map<String, RequestRecord> requestRecords = new ConcurrentHashMap<>();
    private final Map<Long, AttemptRecord> attempts = new ConcurrentHashMap<>();
    public RequestRepository() { this(null); }
    public RequestRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    RequestRecord start(String requestId, String clientRequestId, String projectId, String apiKeyId,
                        String model, Instant startedAt) {
        var record = new RequestRecord(sequence.incrementAndGet(), requestId, clientRequestId,
                projectId, apiKeyId, model, startedAt, null, RequestStatus.STARTED);
        requestRecords.put(requestId, record);
        if (jdbc != null) jdbc.update("""
          INSERT INTO ha_ai_request(request_id,enterprise_id,project_id,api_key_id,logical_model_id,
          client_request_id,stream,execution_result,delivery_result,billing_result,started_at,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
          """, record.id(), 0L, Long.parseLong(projectId), Long.parseLong(apiKeyId), 0L,
          clientRequestId, false, "STARTED", "NOT_STARTED", "NOT_CHARGEABLE",
          java.sql.Timestamp.from(startedAt), java.sql.Timestamp.from(startedAt));
        return record;
    }

    AttemptRecord attempt(long requestId, String providerId, String channelId, Instant startedAt) {
        var record = new AttemptRecord(sequence.incrementAndGet(), requestId, providerId, channelId,
                startedAt, null, AttemptStatus.STARTED, null);
        attempts.put(record.attemptId(), record);
        if (jdbc != null) jdbc.update("""
          INSERT INTO ha_ai_routing_attempt(attempt_id,request_id,attempt_no,provider_id,channel_id,
          execution_result,started_at,created_at) VALUES(?,?,?,?,?,?,?,?)
          """, record.attemptId(), requestId, 1, Long.parseLong(providerId), Long.parseLong(channelId),
          "STARTED", java.sql.Timestamp.from(startedAt), java.sql.Timestamp.from(startedAt));
        return record;
    }

    void succeed(long id, Instant finishedAt, String ignoredProviderRequestId) {
        var attempt = attempts.get(id);
        if (attempt != null) {
            attempts.put(id, attempt.finished(finishedAt, AttemptStatus.SUCCESS,
                    ignoredProviderRequestId));
            if (jdbc != null) jdbc.update("UPDATE ha_ai_routing_attempt SET execution_result='SUCCESS',provider_request_id=?,finished_at=? WHERE attempt_id=?",
                    ignoredProviderRequestId, java.sql.Timestamp.from(finishedAt), id);
            return;
        }
        var request = requestRecords.values().stream().filter(r -> r.id() == id).findFirst().orElseThrow();
        requestRecords.put(request.requestId(), request.finished(finishedAt, RequestStatus.SUCCESS));
        if (jdbc != null) jdbc.update("UPDATE ha_ai_request SET execution_result='SUCCESS',finished_at=? WHERE request_id=?",
                java.sql.Timestamp.from(finishedAt), id);
    }

    void fail(long id, Instant finishedAt, String ignoredErrorCode) {
        var attempt = attempts.get(id);
        if (attempt != null) {
            attempts.put(id, attempt.finished(finishedAt, AttemptStatus.FAILED, ignoredErrorCode));
            if (jdbc != null) jdbc.update("UPDATE ha_ai_routing_attempt SET execution_result='FAILED',normalized_error_code=?,finished_at=? WHERE attempt_id=?",
                    ignoredErrorCode, java.sql.Timestamp.from(finishedAt), id);
            return;
        }
        var request = requestRecords.values().stream().filter(r -> r.id() == id).findFirst().orElseThrow();
        requestRecords.put(request.requestId(), request.finished(finishedAt, RequestStatus.FAILED));
        if (jdbc != null) jdbc.update("UPDATE ha_ai_request SET execution_result='FAILED',finished_at=? WHERE request_id=?",
                java.sql.Timestamp.from(finishedAt), id);
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
