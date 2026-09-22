package com.hengaikj.ai;

import java.util.List;

record ModelView(String id, String object, String owned_by) {}
record ChatCompletionRequest(String model, List<Message> messages, Boolean stream) {}
record Message(String role, Object content) {}
record Choice(int index, Message message, String finish_reason) {}
record Usage(long prompt_tokens, long completion_tokens, long total_tokens) {}
record ChatCompletionResponse(String id, String object, long created, String model,
                              List<Choice> choices, Usage usage) {}
record ErrorResponse(ErrorBody error) {}
record ErrorBody(String message, String type, String code) {}
class ProviderException extends RuntimeException {
    private final String code;
    private final org.springframework.http.HttpStatus status;
    ProviderException(String message, String code) {
        this(org.springframework.http.HttpStatus.BAD_GATEWAY, message, code);
    }
    ProviderException(org.springframework.http.HttpStatus status, String message, String code) {
        super(message); this.status = status; this.code = code;
    }
    String code() { return code; }
    org.springframework.http.HttpStatus status() { return status; }
}
