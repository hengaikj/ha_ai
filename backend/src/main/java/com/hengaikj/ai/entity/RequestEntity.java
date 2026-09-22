package com.hengaikj.ai.entity;
import com.baomidou.mybatisplus.annotation.*;
@TableName("ha_ai_request") public class RequestEntity { @TableId(type=IdType.AUTO) public Long id; public String requestId; public Long enterpriseId; public Long projectId; public String model; public String status; }
