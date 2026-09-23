package com.hengaikj.ai;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthSchemaMigrationTest {
    private static final String URL = System.getenv("AUTH_MIGRATION_TEST_URL");
    private static final String USER = System.getenv("AUTH_MIGRATION_TEST_USER");
    private static final String PASSWORD = System.getenv("AUTH_MIGRATION_TEST_PASSWORD");

    @Test
    void migratesAnEmptyMysqlSchema() throws Exception {
        requireMysqlConfiguration();
        String schema = testSchemaName();
        try {
            migrate(schema, null);
            try (Connection connection = connection(schema); Statement statement = connection.createStatement()) {
                assertTableExists(statement, "ha_enterprise");
                assertTableExists(statement, "ha_auth_user");
                assertTableExists(statement, "ha_auth_role");
                assertTableExists(statement, "ha_auth_user_role");
                assertTableExists(statement, "ha_auth_project_member");
                assertTableExists(statement, "ha_auth_session");
                assertTableExists(statement, "ha_auth_permission");
                assertTableExists(statement, "ha_auth_role_permission");
                assertColumnExists(statement, "ha_project", "project_code");
                assertColumnExists(statement, "ha_project", "status");
                assertEquals(5, scalarInt(statement, "SELECT COUNT(*) FROM ha_auth_role"));
                assertEquals(5, scalarInt(statement, "SELECT COUNT(*) FROM ha_auth_permission"));
                migrate(schema, null);
                assertEquals(5, scalarInt(statement, "SELECT COUNT(*) FROM ha_auth_role"));
            }
        } finally {
            dropSchema(schema);
        }
    }

    @Test
    void upgradesV1ProjectsAndCreatesEnterpriseRows() throws Exception {
        requireMysqlConfiguration();
        String schema = testSchemaName();
        try {
            migrate(schema, MigrationVersion.fromVersion("1"));
            try (Connection connection = connection(schema); Statement statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO ha_project(id, enterprise_id, name, entitlement_mode) VALUES (70123, 99123, 'migration fixture', 'BALANCE')");
            }
            migrate(schema, null);
            try (Connection connection = connection(schema); Statement statement = connection.createStatement()) {
                assertEquals(1, scalarInt(statement, "SELECT COUNT(*) FROM ha_enterprise WHERE id=99123"));
                assertEquals(1, scalarInt(statement, "SELECT COUNT(*) FROM ha_project WHERE id=70123 AND project_code='HAI-70123' AND status='ACTIVE'"));
                assertTrue(indexExists(statement, "ha_project", "uk_project_enterprise_code"));
                migrate(schema, null);
                assertEquals(1, scalarInt(statement, "SELECT COUNT(*) FROM ha_enterprise WHERE id=99123"));
            }
        } finally {
            dropSchema(schema);
        }
    }

    private static void requireMysqlConfiguration() {
        Assumptions.assumeTrue(URL != null && USER != null && PASSWORD != null,
                "set AUTH_MIGRATION_TEST_URL/USER/PASSWORD to run the MySQL migration test");
        Assumptions.assumeTrue(URL.startsWith("jdbc:mysql://"), "migration test requires MySQL 8");
    }

    private static String testSchemaName() {
        return "ha_ai_auth_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static void migrate(String schema, MigrationVersion target) {
        Flyway.configure()
                .dataSource(URL, USER, PASSWORD)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(true)
                .cleanDisabled(true)
                .locations("classpath:db/migration")
                .target(target == null ? MigrationVersion.LATEST : target)
                .load()
                .migrate();
    }

    private static Connection connection(String schema) throws Exception {
        int queryAt = URL.indexOf('?');
        String base = queryAt < 0 ? URL : URL.substring(0, queryAt);
        String query = queryAt < 0 ? "" : URL.substring(queryAt);
        int databaseSeparator = base.lastIndexOf('/');
        String schemaUrl = base.substring(0, databaseSeparator + 1) + schema + query;
        return DriverManager.getConnection(schemaUrl, USER, PASSWORD);
    }

    private static void assertTableExists(Statement statement, String table) throws Exception {
        assertEquals(1, scalarInt(statement, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='" + table + "'"));
    }

    private static void assertColumnExists(Statement statement, String table, String column) throws Exception {
        assertEquals(1, scalarInt(statement, "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='" + table + "' AND column_name='" + column + "'"));
    }

    private static boolean indexExists(Statement statement, String table, String index) throws Exception {
        return scalarInt(statement, "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='" + table + "' AND index_name='" + index + "'") > 0;
    }

    private static int scalarInt(Statement statement, String sql) throws Exception {
        try (ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getInt(1);
        }
    }

    private static void dropSchema(String schema) throws Exception {
        if (URL == null || USER == null || PASSWORD == null) return;
        try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("DROP DATABASE IF EXISTS `" + schema + "`");
        }
    }
}
