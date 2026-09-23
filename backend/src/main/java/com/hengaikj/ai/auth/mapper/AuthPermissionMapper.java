package com.hengaikj.ai.auth.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hengaikj.ai.auth.entity.AuthPermissionEntity;

import java.util.List;

@Mapper
public interface AuthPermissionMapper extends BaseMapper<AuthPermissionEntity> {
    @Select("SELECT p.permission_code FROM ha_auth_user_role ur " +
            "JOIN ha_auth_role_permission rp ON rp.role_id=ur.role_id " +
            "JOIN ha_auth_permission p ON p.id=rp.permission_id WHERE ur.user_id=#{userId}")
    List<String> selectPermissionCodesByUserId(@Param("userId") long userId);
}
