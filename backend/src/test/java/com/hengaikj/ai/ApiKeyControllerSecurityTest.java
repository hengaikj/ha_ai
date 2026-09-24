package com.hengaikj.ai;

import com.hengaikj.ai.auth.service.AuthzService;
import com.hengaikj.ai.controller.ApiKeyController;
import com.hengaikj.ai.service.ApiKeyService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ApiKeyControllerSecurityTest {
    @Test
    void statusChangeAuthenticatesBeforeLookingUpKey() {
        ApiKeyService service = mock(ApiKeyService.class);
        AuthzService authz = mock(AuthzService.class);
        Authentication authentication = mock(Authentication.class);
        ResponseStatusException unauthorized = new ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "登录状态无效");
        when(authz.currentUser(authentication)).thenThrow(unauthorized);
        ApiKeyController controller = new ApiKeyController(service, authz);

        assertThrows(ResponseStatusException.class,
                () -> controller.disable(99L, authentication, null));
        verify(authz).currentUser(authentication);
        verifyNoInteractions(service);
    }
}
