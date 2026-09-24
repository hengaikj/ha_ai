package com.hengaikj.ai.auth.dto;

import java.util.List;

public record UserRoleBindingRequest(List<String> roleCodes) {
    public UserRoleBindingRequest { if (roleCodes == null) roleCodes = List.of(); }
}
