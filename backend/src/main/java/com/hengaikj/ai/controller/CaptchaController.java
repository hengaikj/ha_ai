package com.hengaikj.ai.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

/** 开发联调验证码适配；正式认证由后续认证模块接管。 */
@RestController
public class CaptchaController {
    @GetMapping("/api/captchaImage")
    public Map<String, Object> captchaImage() {
        return Map.of("code", 200, "msg", "操作成功", "captchaEnabled", false,
                "uuid", "", "img", "");
    }
}
