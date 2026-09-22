package com.hengaikj.ai;
import org.junit.jupiter.api.Test; import java.time.Instant; import static org.junit.jupiter.api.Assertions.*;
class ApiKeyManagementTest {
 @Test void createListAndStateMachineNeverLeaksSecret(){var s=new ApiKeyManagementService(new InMemoryApiKeyManagementRepository());var c=s.create(1,2,"开发",Instant.now().plusSeconds(3600));assertNotNull(c.secret());assertTrue(c.secret().startsWith("sk-ha-"));assertNotEquals(c.secret(),s.list(1,2).get(0).keyPrefix());assertEquals(1,s.list(1,2).size());assertEquals("ENABLED",c.status());s.change(1,2,c.apiKeyId(),ApiKeyStatus.DISABLED);s.change(1,2,c.apiKeyId(),ApiKeyStatus.ENABLED);s.change(1,2,c.apiKeyId(),ApiKeyStatus.REVOKED);assertThrows(GatewayException.class,()->s.change(1,2,c.apiKeyId(),ApiKeyStatus.ENABLED));}
 @Test void tenantAndProjectScopeAreEnforced(){var s=new ApiKeyManagementService(new InMemoryApiKeyManagementRepository());var c=s.create(1,2,"开发",null);assertTrue(s.list(2,2).isEmpty());assertThrows(GatewayException.class,()->s.change(2,2,c.apiKeyId(),ApiKeyStatus.DISABLED));assertThrows(GatewayException.class,()->s.change(1,3,c.apiKeyId(),ApiKeyStatus.DISABLED));}
}
