package com.hengaikj.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/** 项目管理持久化实体，对应企业项目主表。 */
@TableName("ha_ai_project")
public class ProjectEntity {
    @TableId(type = IdType.INPUT)
    public Long projectId;
    public Long enterpriseId;
    public String projectCode;
    public String projectName;
    public String entitlementMode;
    public String status;
    public Long version;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
