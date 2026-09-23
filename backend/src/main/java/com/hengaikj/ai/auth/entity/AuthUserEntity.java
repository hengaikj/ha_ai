package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_auth_user")
public class AuthUserEntity {
    @TableId public Long id;
    public String username;
    public String passwordHash;
    public String displayName;
    public Long enterpriseId;
    public String status;
    public Integer failedLoginCount;
    public LocalDateTime lockedUntil;
    public LocalDateTime lastLoginAt;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
