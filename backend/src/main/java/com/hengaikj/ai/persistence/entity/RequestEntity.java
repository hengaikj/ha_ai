package com.hengaikj.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_ai_request")
public class RequestEntity {
    @TableId(type = IdType.INPUT)
    public Long requestId;
    public Long enterpriseId;
    public Long projectId;
    public Long apiKeyId;
    public Long logicalModelId;
    public String clientRequestId;
    public Boolean stream;
    public String executionResult;
    public String deliveryResult;
    public String billingResult;
    public LocalDateTime startedAt;
    public LocalDateTime firstTokenAt;
    public LocalDateTime finishedAt;
    public LocalDateTime createdAt;
}
