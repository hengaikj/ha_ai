package com.hengaikj.ai.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String username, @NotBlank String password, String code, String uuid) {}
