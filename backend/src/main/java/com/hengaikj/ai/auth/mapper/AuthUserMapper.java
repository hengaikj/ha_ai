package com.hengaikj.ai.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuthUserMapper extends BaseMapper<AuthUserEntity> {
    @Select("SELECT * FROM ha_auth_user WHERE username=#{username} FOR UPDATE")
    AuthUserEntity selectByUsernameForUpdate(@Param("username") String username);

    @Select("SELECT COUNT(*) FROM ha_auth_user u JOIN ha_auth_user_role ur ON ur.user_id=u.id JOIN ha_auth_role r ON r.id=ur.role_id WHERE r.role_code='platform-admin'")
    long countPlatformAdmins();
    @Select("SELECT COUNT(*) FROM ha_auth_user u JOIN ha_auth_user_role ur ON ur.user_id=u.id JOIN ha_auth_role r ON r.id=ur.role_id WHERE r.role_code='platform-admin' AND u.status='ACTIVE'")
    long countActivePlatformAdmins();
}
