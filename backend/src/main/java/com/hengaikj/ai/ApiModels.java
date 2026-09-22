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
    ProviderException(String message, String code) { super(message); this.code = code; }
    String code() { return code; }
}
