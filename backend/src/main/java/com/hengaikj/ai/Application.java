package com.hengaikj.ai;
import org.springframework.boot.*;import org.springframework.boot.autoconfigure.*;import org.springframework.web.bind.annotation.*;import org.springframework.http.*;import java.security.*;import java.util.*;
@SpringBootApplication public class Application { public static void main(String[] a){SpringApplication.run(Application.class,a);} }
@RestController @RequestMapping("/v1") class GatewayController {
 record Msg(String role,Object content){} record Chat(String model,List<Msg> messages,Boolean stream){}
 final Map<String,String> keys=new HashMap<>(); final Set<String> models=Set.of("ha-gpt-4o-mini");
 GatewayController(){keys.put(hash("m01-demo-key"),"ENABLED");}
 static String hash(String s){try{var d=MessageDigest.getInstance("SHA-256");return HexFormat.of().formatHex(d.digest(s.getBytes()));}catch(Exception e){throw new RuntimeException(e);}}
 String auth(String h){if(h==null||!h.startsWith("Bearer "))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"API Key无效");String st=keys.get(hash(h.substring(7)));if(!"ENABLED".equals(st))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"API Key禁用、撤销或过期");return st;}
 @GetMapping("/models") Map<String,Object> models(@RequestHeader(value="Authorization",required=false)String a){auth(a); return Map.of("object","list","data",models.stream().map(m->Map.of("id",m,"object","model","owned_by","ha-ai")).toList());}
 @PostMapping("/chat/completions") ResponseEntity<?> chat(@RequestHeader(value="Authorization",required=false)String a,@RequestBody Chat c){auth(a);String id=UUID.randomUUID().toString();if(Boolean.TRUE.equals(c.stream())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"M01仅支持stream=false");if(!models.contains(c.model())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"模型未授权");Map<String,Object> msg=Map.of("role","assistant","content","FakeProvider response");Map<String,Object> body=Map.of("id","chatcmpl-"+id.substring(0,8),"object","chat.completion","model",c.model(),"choices",List.of(Map.of("index",0,"message",msg,"finish_reason","stop")),"usage",Map.of("prompt_tokens",0,"completion_tokens",0,"total_tokens",0));return ResponseEntity.ok().header("x-request-id",id).body(body);}
}
