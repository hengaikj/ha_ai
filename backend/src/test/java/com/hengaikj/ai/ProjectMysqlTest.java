package com.hengaikj.ai;

import com.hengaikj.ai.persistence.mapper.ProjectMapper;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/** 显式开启真实MySQL测试；事务回滚测试数据。 */
@SpringBootTest(properties = "ha.gateway.persistence.enabled=false")
@EnabledIfSystemProperty(named="project.mysql.test", matches="true")
@Transactional
class ProjectMysqlTest extends ProjectContractTest {
    @Autowired ProjectMapper mapper;
    @Override protected ProjectRepository repository() { return new MybatisProjectRepository(mapper); }
}
