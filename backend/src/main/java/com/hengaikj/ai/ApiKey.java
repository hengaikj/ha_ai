package com.hengaikj.ai;
import java.time.Instant;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
public final class ApiKey {
 public enum Status { ENABLED, DISABLED, REVOKED }
 private final Project project;
 private final byte[] keyHash;
 private final String keyPrefix;
 private final Status status;
 private final Instant expiresAt;
 public ApiKey(Project project,String secret,Status status,Instant expiresAt) {
  this.project=project; this.keyHash=digest(secret); this.keyPrefix=secret.substring(0,Math.min(8,secret.length())); this.status=status; this.expiresAt=expiresAt;
 }
 public Project project() { return project; }
 public String keyPrefix() { return keyPrefix; }
 public boolean authenticates(String secret,Instant now) {
  return status==Status.ENABLED && (expiresAt==null || expiresAt.isAfter(now)) && MessageDigest.isEqual(keyHash,digest(secret));
 }
 private static byte[] digest(String value) {
  try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
  catch(NoSuchAlgorithmException e) { throw new IllegalStateException("摘要算法不可用"); }
 }
}
