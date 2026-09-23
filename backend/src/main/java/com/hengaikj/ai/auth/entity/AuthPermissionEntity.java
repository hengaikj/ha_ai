package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("ha_auth_permission")
public class AuthPermissionEntity {
    @TableId
    public Long id;
    public String permissionCode;
    public String displayName;
}
