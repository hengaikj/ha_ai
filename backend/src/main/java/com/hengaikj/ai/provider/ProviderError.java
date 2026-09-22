package com.hengaikj.ai.provider;
public class ProviderError extends RuntimeException { public final int status; public final String code; public ProviderError(int s,String c,String m){super(m);status=s;code=c;} }
