package com.hengaikj.ai.entity;
import com.baomidou.mybatisplus.annotation.*; import java.time.Instant;
@TableName("ha_api_key") public class ApiKeyEntity { @TableId(type=IdType.AUTO) public Long id; public Long enterpriseId; public Long projectId; public String keyName; public String keyPrefix; public byte[] keyHash; public String status; public Instant expiresAt; public Instant createdAt; }
