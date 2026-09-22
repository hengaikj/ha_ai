package com.hengaikj.ai;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.hengaikj.ai.persistence.entity.ApiKeyEntity;
import com.hengaikj.ai.persistence.mapper.ApiKeyMapper;
import com.hengaikj.ai.persistence.mapper.ProjectMapper;
import org.springframework.dao.DuplicateKeyException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

interface ApiKeyManagementRepository {
    ApiKeyManaged create(long enterpriseId,long projectId,String name,Instant expiresAt,String secret);
    List<ApiKeyManaged> list(long enterpriseId,long projectId);
    ApiKeyManaged find(long enterpriseId,long projectId,String id);
    ApiKeyManaged update(long enterpriseId,long projectId,String id,ApiKeyStatus status);
}
record ApiKeyManaged(String id,long enterpriseId,long projectId,String name,String prefix,String hash,ApiKeyStatus status,Instant expiresAt,String secret) {}

final class MybatisApiKeyManagementRepository implements ApiKeyManagementRepository {
    private final ApiKeyMapper mapper; private final ProjectMapper projects;
    MybatisApiKeyManagementRepository(ApiKeyMapper mapper, ProjectMapper projects){this.mapper=mapper;this.projects=projects;}
    public ApiKeyManaged create(long e,long p,String n,Instant x,String secret){
        var project=projects.selectOne(new QueryWrapper<com.hengaikj.ai.persistence.entity.ProjectEntity>().eq("enterprise_id",e).eq("project_id",p));
        if(project==null) throw GatewayException.notFound("项目不存在");
        var r=new ApiKeyEntity(); r.apiKeyId=IdWorker.getId(); r.enterpriseId=e; r.projectId=p; r.keyName=n;
        r.keyPrefix=prefix(secret); r.keyHash=ApiKeyService.hash(secret); r.status="ENABLED"; r.entitlementMode=project.entitlementMode; r.expiresAt=dt(x); r.version=0L; r.createdAt=LocalDateTime.now(); r.updatedAt=r.createdAt;
        try { mapper.insert(r); } catch(DuplicateKeyException ex){throw GatewayException.conflict("API Key冲突");}
        return to(r,secret);
    }
    public List<ApiKeyManaged> list(long e,long p){return mapper.selectList(new QueryWrapper<ApiKeyEntity>().eq("enterprise_id",e).eq("project_id",p).orderByAsc("api_key_id")).stream().map(r->to(r,null)).toList();}
    public ApiKeyManaged find(long e,long p,String id){var r=mapper.selectOne(new QueryWrapper<ApiKeyEntity>().eq("enterprise_id",e).eq("project_id",p).eq("api_key_id",id)); if(r==null)throw GatewayException.notFound("API Key不存在"); return to(r,null);}
    public ApiKeyManaged update(long e,long p,String id,ApiKeyStatus status){var r=find(e,p,id); if(r.status()==ApiKeyStatus.REVOKED && status==ApiKeyStatus.ENABLED)throw GatewayException.conflict("REVOKED API Key不可重新启用"); mapper.update(null,new UpdateWrapper<ApiKeyEntity>().eq("api_key_id",id).eq("enterprise_id",e).eq("project_id",p).set("status",status.name()).set("revoked_at",status==ApiKeyStatus.REVOKED?LocalDateTime.now():null).set("updated_at",LocalDateTime.now())); return find(e,p,id);}
    private static ApiKeyManaged to(ApiKeyEntity r,String s){return new ApiKeyManaged(String.valueOf(r.apiKeyId),r.enterpriseId,r.projectId,r.keyName,r.keyPrefix,r.keyHash,ApiKeyStatus.valueOf(r.status),r.expiresAt==null?null:r.expiresAt.toInstant(ZoneOffset.UTC),s);}
    private static LocalDateTime dt(Instant i){return i==null?null:LocalDateTime.ofInstant(i,ZoneOffset.UTC);} static String prefix(String s){return s.substring(0,Math.min(12,s.length()));}
}

final class InMemoryApiKeyManagementRepository implements ApiKeyManagementRepository {
    private final Map<String,ApiKeyManaged> rows=new ConcurrentHashMap<>();
    public ApiKeyManaged create(long e,long p,String n,Instant x,String s){var r=new ApiKeyManaged(String.valueOf(IdWorker.getId()),e,p,n,MybatisApiKeyManagementRepository.prefix(s),ApiKeyService.hash(s),ApiKeyStatus.ENABLED,x,s);rows.put(r.id(),r);return r;}
    public List<ApiKeyManaged> list(long e,long p){return rows.values().stream().filter(r->r.enterpriseId()==e&&r.projectId()==p).toList();}
    public ApiKeyManaged find(long e,long p,String id){var r=rows.get(id);if(r==null||r.enterpriseId()!=e||r.projectId()!=p)throw GatewayException.notFound("API Key不存在");return r;}
    public ApiKeyManaged update(long e,long p,String id,ApiKeyStatus s){var r=find(e,p,id);if(r.status()==ApiKeyStatus.REVOKED&&s==ApiKeyStatus.ENABLED)throw GatewayException.conflict("REVOKED API Key不可重新启用");var n=new ApiKeyManaged(r.id(),r.enterpriseId(),r.projectId(),r.name(),r.prefix(),r.hash(),s,r.expiresAt(),null);rows.put(id,n);return n;}
}

final class ApiKeyManagementService {
    private final ApiKeyManagementRepository repo; private static final SecureRandom RANDOM=new SecureRandom();
    ApiKeyManagementService(ApiKeyManagementRepository r){repo=r;}
    ApiKeyCreated create(long e,long p,String name,Instant exp){if(e<=0||p<=0)throw GatewayException.badRequest("企业和项目ID必须为正整数");if(name==null||name.isBlank()||name.length()>128)throw GatewayException.badRequest("keyName不能为空且长度不能超过128");byte[] b=new byte[32];RANDOM.nextBytes(b);String secret="sk-ha-"+Base64.getUrlEncoder().withoutPadding().encodeToString(b);var r=repo.create(e,p,name.trim(),exp,secret);return new ApiKeyCreated(r.id(),r.name(),r.prefix(),r.status().name(),r.expiresAt(),secret);}
    List<ApiKeySummary> list(long e,long p){if(e<=0||p<=0)throw GatewayException.badRequest("企业和项目ID必须为正整数");return repo.list(e,p).stream().map(r->new ApiKeySummary(r.id(),r.name(),r.prefix(),r.status().name(),r.expiresAt())).toList();}
    void change(long e,long p,String id,ApiKeyStatus s){if(e<=0||p<=0)throw GatewayException.badRequest("企业和项目ID必须为正整数");repo.update(e,p,id,s);}
}
record ApiKeyCreated(String apiKeyId,String keyName,String keyPrefix,String status,Instant expiresAt,String secret) {}
record ApiKeySummary(String apiKeyId,String keyName,String keyPrefix,String status,Instant expiresAt) {}
