package com.hengaikj.ai;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
@Component
public class FakeProvider implements ProviderAdapter {
 public ChatResponse complete(ChatRequest request) {
  return new ChatResponse("chatcmpl-"+UUID.randomUUID(),"chat.completion",Instant.now().getEpochSecond(),request.model(),List.of(new Choice(0,new Message("assistant","FakeProvider response"),"stop")));
 }
}
