package com.hengaikj.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_usage_record")
public class UsageEntity {
    @TableId(type = IdType.AUTO) public Long id;
    public String requestId;
    public String model;
    public Long promptTokens;
    public Long completionTokens;
    public Long totalTokens;
    public LocalDateTime recordedAt;
}
