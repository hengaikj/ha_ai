package com.hengaikj.ai;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.List;
@Service
public class GatewayService {
 private final ProviderAdapter provider;
 private final ApiKey key;
 public GatewayService(ProviderAdapter provider,@Value("${ha.integration-key:}") String secret) {
  this.provider=provider;
  this.key=secret.isBlank()?null:new ApiKey(new Project(1,new Enterprise(1)),secret,ApiKey.Status.ENABLED,null);
 }
 public void authenticate(String authorization) {
  if(key==null || authorization==null || !authorization.startsWith("Bearer ") || !key.authenticates(authorization.substring(7),Instant.now()))
   throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
 }
 public ModelList models() { return new ModelList("list",List.of(new ModelView("fake-model","model","fake"))); }
 public ChatResponse complete(ChatRequest request) {
  if(Boolean.TRUE.equals(request.stream())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  if(!"fake-model".equals(request.model())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  return provider.complete(request);
 }
}
