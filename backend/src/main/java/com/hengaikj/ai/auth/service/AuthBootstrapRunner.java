package com.hengaikj.ai.auth.service;

import com.hengaikj.ai.auth.entity.AuthRoleEntity;
import com.hengaikj.ai.auth.entity.AuthUserEntity;
import com.hengaikj.ai.auth.entity.AuthUserRoleEntity;
import com.hengaikj.ai.auth.mapper.AuthRoleMapper;
import com.hengaikj.ai.auth.mapper.AuthUserMapper;
import com.hengaikj.ai.auth.mapper.AuthUserRoleMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AuthBootstrapRunner implements ApplicationRunner {
    private final AuthUserMapper users;
    private final AuthRoleMapper roles;
    private final AuthUserRoleMapper userRoles;
    private final PasswordEncoder passwords;
    private final String username;
    private final String password;

    public AuthBootstrapRunner(AuthUserMapper users, AuthRoleMapper roles, AuthUserRoleMapper userRoles,
                               PasswordEncoder passwords,
                               @Value("${AUTH_BOOTSTRAP_ADMIN_USERNAME:}") String username,
                               @Value("${AUTH_BOOTSTRAP_ADMIN_PASSWORD:}") String password) {
        this.users = users;
        this.roles = roles;
        this.userRoles = userRoles;
        this.passwords = passwords;
        this.username = username;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.countPlatformAdmins() > 0) return;
        if (username == null || username.isBlank() || password == null || password.length() < 12) {
            throw new IllegalStateException("首次启动需配置 AUTH_BOOTSTRAP_ADMIN_USERNAME 和至少 12 位的 AUTH_BOOTSTRAP_ADMIN_PASSWORD");
        }
        AuthRoleEntity role = roles.selectByRoleCode("platform-admin");
        if (role == null) throw new IllegalStateException("认证角色未初始化，请先执行数据库迁移");
        AuthUserEntity user = new AuthUserEntity();
        user.username = username.trim();
        user.displayName = user.username;
        user.passwordHash = passwords.encode(password);
        user.enterpriseId = null;
        user.status = "ACTIVE";
        user.failedLoginCount = 0;
        if (users.insert(user) != 1 || user.id == null) throw new IllegalStateException("初始管理员创建失败");
        AuthUserRoleEntity relation = new AuthUserRoleEntity();
        relation.userId = user.id;
        relation.roleId = role.id;
        if (userRoles.insert(relation) != 1) throw new IllegalStateException("初始管理员角色初始化失败");
    }
}
