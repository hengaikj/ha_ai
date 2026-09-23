package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_auth_session")
public class AuthSessionEntity {
    @TableId(type = IdType.AUTO) public Long id;
    public String jti;
    public Long userId;
    public LocalDateTime issuedAt;
    public LocalDateTime expiresAt;
    public LocalDateTime revokedAt;
    public LocalDateTime createdAt;
}
