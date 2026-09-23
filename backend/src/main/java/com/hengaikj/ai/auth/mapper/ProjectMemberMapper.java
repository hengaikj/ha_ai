package com.hengaikj.ai.auth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hengaikj.ai.auth.entity.ProjectMemberEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ProjectMemberMapper extends BaseMapper<ProjectMemberEntity> {
    @Select("SELECT pm.project_id AS projectId, r.role_code AS roleCode FROM ha_auth_project_member pm JOIN ha_auth_role r ON r.id=pm.role_id WHERE pm.user_id=#{userId}")
    List<ProjectRoleRow> selectProjectRolesByUserId(@Param("userId") long userId);

    class ProjectRoleRow {
        public Long projectId;
        public String roleCode;
        public ProjectRoleRow() {}
        public ProjectRoleRow(Long projectId, String roleCode) { this.projectId = projectId; this.roleCode = roleCode; }
    }
}
