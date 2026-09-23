package com.hengaikj.ai.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UserCreateRequest(
        @NotBlank String username,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotBlank String displayName,
        Long enterpriseId,
        List<String> roleCodes) {}
