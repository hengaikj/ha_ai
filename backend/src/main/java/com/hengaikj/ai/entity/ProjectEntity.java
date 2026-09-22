package com.hengaikj.ai.entity;
import com.baomidou.mybatisplus.annotation.*;
@TableName("ha_project") public class ProjectEntity { @TableId(type=IdType.AUTO) public Long id; public Long enterpriseId; public String name; public String entitlementMode; }
