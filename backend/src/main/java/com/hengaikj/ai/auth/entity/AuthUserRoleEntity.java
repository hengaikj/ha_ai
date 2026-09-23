package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_auth_user_role")
public class AuthUserRoleEntity {
    @TableId public Long id;
    public Long userId;
    public Long roleId;
    public LocalDateTime createdAt;
}
