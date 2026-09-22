package com.hengaikj.ai.usage;
import org.springframework.web.bind.annotation.*; import java.util.List;
@RestController @RequestMapping("/api/usage") public class UsageController { private final UsageService service; public UsageController(UsageService s){service=s;} @GetMapping public List<UsageRecord> list(){return service.recent();} }
