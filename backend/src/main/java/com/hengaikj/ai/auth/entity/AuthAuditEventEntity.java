package com.hengaikj.ai.auth.entity;
import com.baomidou.mybatisplus.annotation.*;
import java.time.LocalDateTime;
@TableName("ha_auth_audit_event") public class AuthAuditEventEntity {
 @TableId(type=IdType.AUTO) public Long id; public Long actorUserId; public Long targetUserId; public String action; public String detail; public LocalDateTime createdAt;
}
