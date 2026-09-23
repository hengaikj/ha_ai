package com.hengaikj.ai.auth.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record UserRoleBindingRequest(@NotEmpty List<String> roleCodes) {}
