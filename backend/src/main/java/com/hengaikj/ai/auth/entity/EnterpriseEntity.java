package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("ha_enterprise")
public class EnterpriseEntity {
    @TableId(type = IdType.AUTO) public Long id;
    public String displayName;
    public String status;
}
