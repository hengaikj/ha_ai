package com.hengaikj.ai.auth.dto;
import java.util.List;
public record UserPage(long total, int page, int pageSize, List<UserSummary> items) {}
