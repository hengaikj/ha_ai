package com.hengaikj.ai.auth.dto;

import java.util.Map;

public record AuthMenu(String path, String name, String component, Map<String, Object> meta) {}
