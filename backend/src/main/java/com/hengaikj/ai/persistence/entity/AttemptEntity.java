package com.hengaikj.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_ai_routing_attempt")
public class AttemptEntity {
    @TableId(type = IdType.INPUT)
    public Long attemptId;
    public Long requestId;
    public Integer attemptNo;
    public Long providerId;
    public Long channelId;
    public String providerRequestId;
    public String executionResult;
    public String normalizedErrorCode;
    public LocalDateTime startedAt;
    public LocalDateTime firstTokenAt;
    public LocalDateTime finishedAt;
    public LocalDateTime createdAt;
}
