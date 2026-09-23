package com.hengaikj.ai.provider;

public class GatewayException extends RuntimeException {
    public final int status;
    public final String code;

    public GatewayException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
