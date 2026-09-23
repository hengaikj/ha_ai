package com.hengaikj.ai.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hengaikj.ai.entity.UsageEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import com.hengaikj.ai.usage.UsageSummaryRow;

import java.util.List;

@Mapper
public interface UsageMapper extends BaseMapper<UsageEntity> {
    @Select("""
            <script>
            SELECT u.request_id AS requestId, r.project_id AS projectId, u.model AS model,
                   r.status AS executionResult, u.recorded_at AS createdAt
            FROM ha_usage_record u
            INNER JOIN ha_ai_request r ON r.request_id = u.request_id
            <where>
              <if test='platformAdmin == false'>
                <choose>
                  <when test='enterpriseId != null'>AND r.enterprise_id = #{enterpriseId}</when>
                  <when test='projectIds != null and projectIds.size() > 0'>
                    AND r.project_id IN
                    <foreach collection='projectIds' item='projectId' open='(' separator=',' close=')'>#{projectId}</foreach>
                  </when>
                  <otherwise>AND 1 = 0</otherwise>
                </choose>
              </if>
            </where>
            ORDER BY u.recorded_at DESC LIMIT 100
            </script>
            """)
    List<UsageSummaryRow> selectScopedUsage(@Param("platformAdmin") boolean platformAdmin,
                                           @Param("enterpriseId") Long enterpriseId,
                                           @Param("projectIds") List<Long> projectIds);
}
