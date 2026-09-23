package com.hengaikj.ai.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ProjectCreateRequest(
        @NotBlank String projectCode,
        @NotBlank String projectName,
        @NotBlank @Pattern(regexp = "BALANCE|SUBSCRIPTION") String entitlementMode,
        Long enterpriseId) {}
