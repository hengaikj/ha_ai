package com.hengaikj.ai.provider;
import org.springframework.beans.factory.annotation.Value; import org.springframework.http.*; import org.springframework.stereotype.Component; import org.springframework.web.client.RestClient; import java.util.Map;
@Component public class HengAiProvider { private final RestClient client; public HengAiProvider(@Value("${hengai.base-url:https://api.hengaikj.com/v1}") String base){client=RestClient.builder().baseUrl(base).build();}
 public String chat(String model,Object body,String credential){try{return client.post().uri("/chat/completions").header(HttpHeaders.AUTHORIZATION,"Bearer "+credential).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);}catch(Exception e){throw new ProviderError(502,"upstream_error","上游模型服务不可用");}}
 public String models(String credential){try{return client.get().uri("/models").header(HttpHeaders.AUTHORIZATION,"Bearer "+credential).retrieve().body(String.class);}catch(Exception e){throw new ProviderError(502,"upstream_error","上游模型服务不可用");}}
}
