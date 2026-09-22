package com.hengaikj.ai;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
record ModelView(String id,String object,String owned_by) {}
record ModelList(String object,List<ModelView> data) {}
record Message(@NotBlank String role,@NotBlank String content) {}
record ChatRequest(@NotBlank String model,@NotEmpty List<@Valid Message> messages,Boolean stream) {}
record Choice(int index,Message message,String finish_reason) {}
record ChatResponse(String id,String object,long created,String model,List<Choice> choices) {}
record ErrorBody(String message,String type,String code) {}
record ErrorResponse(ErrorBody error) {}
