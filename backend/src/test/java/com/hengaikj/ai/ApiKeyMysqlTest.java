package com.hengaikj.ai;
import com.hengaikj.ai.persistence.mapper.ApiKeyMapper;
import org.junit.jupiter.api.Test; import org.springframework.beans.factory.annotation.Autowired; import org.springframework.boot.test.context.SpringBootTest; import org.springframework.transaction.annotation.Transactional; import java.time.Instant; import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(properties="ha.gateway.persistence.enabled=true") @org.junit.jupiter.api.condition.EnabledIfSystemProperty(named="apikey.mysql.test",matches="true") @Transactional
class ApiKeyMysqlTest {
 @Autowired ApiKeyMapper mapper;
 @Test void mysqlStoresOnlyHashAndPrefix(){var s=new ApiKeyManagementService(new MybatisApiKeyManagementRepository(mapper));var c=s.create(998001,998002,"mysql-test",Instant.now().plusSeconds(3600));var row=mapper.selectById(Long.parseLong(c.apiKeyId()));assertNotNull(row);assertEquals(c.keyPrefix(),row.keyPrefix);assertEquals(ApiKeyService.hash(c.secret()),row.keyHash);assertNotEquals(c.secret(),row.keyHash);assertEquals(5, s.list(998001,998002).get(0).getClass().getRecordComponents().length);}
}
