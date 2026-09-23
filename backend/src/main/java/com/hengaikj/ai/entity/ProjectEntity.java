package com.hengaikj.ai.entity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_project")
public class ProjectEntity {
    @TableId(type = IdType.AUTO) public Long id;
    public Long enterpriseId;
    public String projectCode;
    public String name;
    public String entitlementMode;
    public String status;
    public LocalDateTime createdAt;
}
