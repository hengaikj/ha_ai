package com.hengaikj.ai.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuthSessionMapper extends BaseMapper<AuthSessionEntity> {}
