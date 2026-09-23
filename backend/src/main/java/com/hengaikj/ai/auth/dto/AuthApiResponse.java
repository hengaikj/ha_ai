package com.hengaikj.ai.auth.dto;

public record AuthApiResponse<T>(int code, String msg, T data) {
    public static <T> AuthApiResponse<T> success(T data) { return new AuthApiResponse<>(200, "操作成功", data); }
    public static <T> AuthApiResponse<T> failure(int code, String message) { return new AuthApiResponse<>(code, message, null); }
}
