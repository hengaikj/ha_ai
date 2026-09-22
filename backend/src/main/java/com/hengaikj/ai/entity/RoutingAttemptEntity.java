package com.hengaikj.ai.entity;
import com.baomidou.mybatisplus.annotation.*;
@TableName("ha_ai_routing_attempt") public class RoutingAttemptEntity { @TableId(type=IdType.AUTO) public Long id; public Long requestId; public String provider; public String status; }
