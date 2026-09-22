package com.hengaikj.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;

class HengAiProviderTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void parsesOpenAiResponseAndUsageWithoutExposingCredential() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            assertEquals("Bearer test-secret", exchange.getRequestHeaders().getFirst("Authorization"));
            var requestBody = new String(exchange.getRequestBody().readAllBytes());
            assertTrue(requestBody.contains("\"stream\":false"));
            assertFalse(requestBody.contains("test-secret"));
            var body = """
                    {"id":"chatcmpl-upstream-1","choices":[{"message":{"role":"assistant","content":"hello"}}],
                     "usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}
                    """;
            exchange.sendResponseHeaders(200, body.getBytes().length);
            exchange.getResponseBody().write(body.getBytes());
            exchange.close();
        });
        server.start();
        var adapter = new HengAiProvider("channel", "http://localhost:" + server.getAddress().getPort() + "/v1",
                "test-secret", new ObjectMapper());

        var result = adapter.complete(new ChatCompletionRequest("model",
                List.of(new Message("user", "hi")), false));

        assertEquals("hello", result.content());
        assertEquals("chatcmpl-upstream-1", result.providerRequestId());
        assertEquals(new Usage(3, 2, 5), result.usage());
    }

    @Test
    void normalizesAuthenticationErrorWithoutUpstreamBody() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            var body = "{\"error\":{\"message\":\"secret upstream detail\"}}";
            exchange.sendResponseHeaders(401, body.getBytes().length);
            exchange.getResponseBody().write(body.getBytes());
            exchange.close();
        });
        server.start();
        var adapter = new HengAiProvider("channel", "http://localhost:" + server.getAddress().getPort() + "/v1",
                "test-secret", new ObjectMapper());

        var exception = assertThrows(ProviderException.class, () -> adapter.complete(
                new ChatCompletionRequest("model", List.of(new Message("user", "hi")), false)));

        assertEquals("provider_authentication_error", exception.code());
        assertEquals(HttpStatus.BAD_GATEWAY, exception.status());
        assertFalse(exception.getMessage().contains("secret"));
    }

    @Test
    void timeoutIsNormalized() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            try { Thread.sleep(200); } catch (InterruptedException ignored) { }
            exchange.close();
        });
        server.start();
        var adapter = new HengAiProvider("channel", "http://localhost:" + server.getAddress().getPort() + "/v1",
                "test-secret", new ObjectMapper(), java.net.http.HttpClient.newHttpClient(),
                Duration.ofMillis(20));

        var exception = assertThrows(ProviderException.class, () -> adapter.complete(
                new ChatCompletionRequest("model", List.of(new Message("user", "hi")), false)));

        assertEquals("provider_timeout", exception.code());
        assertEquals(HttpStatus.GATEWAY_TIMEOUT, exception.status());
    }
}
