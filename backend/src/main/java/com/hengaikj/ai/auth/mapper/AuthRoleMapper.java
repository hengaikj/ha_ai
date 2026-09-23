package com.hengaikj.ai.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hengaikj.ai.auth.entity.AuthRoleEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface AuthRoleMapper extends BaseMapper<AuthRoleEntity> {
    @Select("SELECT r.role_code FROM ha_auth_user_role ur JOIN ha_auth_role r ON r.id=ur.role_id WHERE ur.user_id=#{userId}")
    List<String> selectRoleCodesByUserId(@Param("userId") long userId);
}
