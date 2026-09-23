package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("ha_auth_role")
public class AuthRoleEntity {
    @TableId(type = IdType.AUTO) public Long id;
    public String roleCode;
    public String displayName;
}
