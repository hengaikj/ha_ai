package com.hengaikj.ai.auth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("ha_auth_project_member")
public class ProjectMemberEntity {
    @TableId public Long id;
    public Long userId;
    public Long projectId;
    public Long roleId;
    public LocalDateTime createdAt;
}
