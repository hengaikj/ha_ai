package com.hengaikj.ai.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;
import java.util.UUID;

@RestController
public class CaptchaController {
    @GetMapping("/api/captchaImage")
    public Map<String, Object> captchaImage() {
        return Map.of("captchaEnabled", false, "uuid", UUID.randomUUID().toString(), "img", "");
    }
}
