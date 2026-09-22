package com.hengaikj.ai.service;
import org.springframework.stereotype.Service; import java.util.concurrent.ConcurrentHashMap; import java.util.Set;
@Service public class PolicyService { private final ConcurrentHashMap<Long,Set<String>> policies=new ConcurrentHashMap<>(); public void allow(long project,String model){policies.computeIfAbsent(project,k->ConcurrentHashMap.newKeySet()).add(model);} public boolean allowed(long project,String model){return policies.getOrDefault(project,Set.of("fake-model")).contains(model);} }
