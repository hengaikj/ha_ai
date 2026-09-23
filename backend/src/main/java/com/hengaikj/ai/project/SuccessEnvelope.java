package com.hengaikj.ai.project;

public record SuccessEnvelope<T>(boolean success, String requestId, T data) {
    public static <T> SuccessEnvelope<T> of(String requestId, T data) {
        return new SuccessEnvelope<>(true, requestId, data);
    }
}
