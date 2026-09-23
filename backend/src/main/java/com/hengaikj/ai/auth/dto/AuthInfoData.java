package com.hengaikj.ai.auth.dto;

import java.util.List;

public record AuthInfoData(AuthUserSummary user, List<String> roles, List<String> permissions) {}
