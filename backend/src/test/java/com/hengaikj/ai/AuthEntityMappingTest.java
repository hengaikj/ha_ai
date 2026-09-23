package com.hengaikj.ai;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.hengaikj.ai.auth.entity.AuthRoleEntity;
import com.hengaikj.ai.auth.entity.AuthSessionEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.AuthUserRoleEntity;
import com.hengaikj.ai.auth.entity.EnterpriseEntity;
import com.hengaikj.ai.auth.entity.ProjectMemberEntity;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthEntityMappingTest {
    @Test
    void authTablesUseMysqlAutoIncrementIdsThroughMybatisPlus() throws Exception {
        for (Class<?> entity : List.of(AuthRoleEntity.class, AuthSessionEntity.class, AuthUserEntity.class,
                AuthUserRoleEntity.class, EnterpriseEntity.class, ProjectMemberEntity.class)) {
            assertEquals(IdType.AUTO, entity.getField("id").getAnnotation(TableId.class).type(), entity.getSimpleName());
        }
    }
}
