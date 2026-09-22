package com.hengaikj.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_ai_project_model_policy")
public class ProjectPolicyEntity {
    @TableId(type = IdType.AUTO)
    public Long policyId;
    public Long projectId;
    public Long logicalModelId;
    public String status;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
