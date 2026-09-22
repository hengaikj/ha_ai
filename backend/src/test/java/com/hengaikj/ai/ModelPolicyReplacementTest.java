package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.hengaikj.ai.persistence.entity.ProjectPolicyEntity;
import com.hengaikj.ai.persistence.mapper.LogicalModelMapper;
import com.hengaikj.ai.persistence.mapper.ProjectPolicyMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ModelPolicyReplacementTest {
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void clearingPolicyRevokesRowsEvenWhenLogicalModelsAreUnavailable() {
        var policyMapper = mock(ProjectPolicyMapper.class);
        var modelMapper = mock(LogicalModelMapper.class);
        var service = new ModelPolicyService(policyMapper, modelMapper);
        // 可用模型查询为空时，数据库中仍可能存在已停用模型的授权。
        service.replace("123", Set.of());
        ArgumentCaptor<Wrapper<ProjectPolicyEntity>> query = ArgumentCaptor.forClass(Wrapper.class);
        verify(policyMapper).update(isNull(), query.capture());
        var wrapper = (com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<ProjectPolicyEntity>) query.getValue();
        assertTrue(wrapper.getSqlSegment().contains("project_id"));
        assertFalse(wrapper.getSqlSegment().contains("logical_model_id"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue(123L));
        assertTrue(wrapper.getParamNameValuePairs().containsValue("DISABLED"));
        verifyNoInteractions(modelMapper);
    }

    @Test
    void memoryReplacementCanClearAndThenGrantAgain() {
        var service = new ModelPolicyService();
        service.allow("p", "old");
        service.replace("p", Set.of());
        assertTrue(service.allowed("p").isEmpty());
        service.allow("p", "new");
        assertEquals(Set.of("new"), service.allowed("p"));
    }
}
