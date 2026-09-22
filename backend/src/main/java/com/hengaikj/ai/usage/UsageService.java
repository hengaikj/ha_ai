package com.hengaikj.ai.usage;
import org.springframework.stereotype.Service; import java.time.Instant; import java.util.concurrent.ConcurrentLinkedQueue; import java.util.List;
@Service public class UsageService { private final ConcurrentLinkedQueue<UsageRecord> records=new ConcurrentLinkedQueue<>(); public UsageRecord record(String id,String model,long prompt,long completion){UsageRecord r=new UsageRecord(id,model,prompt,completion,prompt+completion,Instant.now());records.add(r);return r;} public List<UsageRecord> recent(){return List.copyOf(records);} }
