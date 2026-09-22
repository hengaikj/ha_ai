package com.hengaikj.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_ai_logical_model")
public class LogicalModelEntity {
    @TableId(type = IdType.INPUT)
    public Long logicalModelId;
    public String modelCode;
    public String modelName;
    public String status;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
