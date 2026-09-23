package com.hengaikj.ai;

import com.hengaikj.ai.entity.UsageEntity;
import com.hengaikj.ai.mapper.UsageMapper;
import com.hengaikj.ai.usage.UsageRecord;
import com.hengaikj.ai.usage.UsageService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UsagePersistenceTest {
    @Test
    void recordWritesUsageEntityToMySqlMapper() {
        UsageMapper mapper = mock(UsageMapper.class);
        UsageService service = new UsageService(mapper);

        UsageRecord record = service.record("req-persist", "fake-model", 3, 5);

        verify(mapper).insert(any(UsageEntity.class));
        assertEquals(8, record.totalTokens());
    }

    @Test
    void recentReadsUsageRecordsFromMySqlMapper() {
        UsageMapper mapper = mock(UsageMapper.class);
        UsageEntity entity = new UsageEntity();
        entity.requestId = "req-persist";
        entity.model = "fake-model";
        entity.promptTokens = 3L;
        entity.completionTokens = 5L;
        entity.totalTokens = 8L;
        when(mapper.selectList(any())).thenReturn(List.of(entity));

        List<UsageRecord> records = new UsageService(mapper).recent();

        assertEquals(1, records.size());
        assertEquals("req-persist", records.get(0).requestId());
        assertEquals(8, records.get(0).totalTokens());
    }
}
