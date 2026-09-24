<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  bindM02UserRoles,
  changeM02UserStatus,
  createM02User,
  fetchM02EnterpriseOptions,
  fetchM02Roles,
  fetchM02Users,
  type M02EnterpriseOption,
  type M02RoleSummary,
  type M02UserSummary,
} from "@/api/m02-auth";

const users = ref<M02UserSummary[]>([]);
const roles = ref<M02RoleSummary[]>([]);
const enterprises = ref<M02EnterpriseOption[]>([]);
const loading = ref(false);
const createVisible = ref(false);
const draft = ref({ username: "", password: "", displayName: "", enterpriseId: undefined as number | undefined });

async function load() {
  loading.value = true;
  try {
    [users.value, roles.value] = await Promise.all([fetchM02Users(), fetchM02Roles()]);
    try {
      enterprises.value = await fetchM02EnterpriseOptions();
    } catch {
      enterprises.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  await createM02User({ ...draft.value });
  ElMessage.success("用户已创建");
  createVisible.value = false;
  draft.value = { username: "", password: "", displayName: "", enterpriseId: undefined };
  await load();
}

async function toggleStatus(user: M02UserSummary) {
  const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
  await ElMessageBox.confirm(`确认将 ${user.username} 设为 ${next}？`, "变更状态");
  await changeM02UserStatus(user.userId, { status: next });
  await load();
}

async function bindRoles(user: M02UserSummary) {
  const selected = roles.value.filter((role) => user.roleCodes.includes(role.roleCode)).map((role) => role.roleCode);
  await bindM02UserRoles(user.userId, { roleCodes: selected });
  ElMessage.success("角色已更新");
  await load();
}

onMounted(load);
</script>

<template>
  <section class="m02-user-role-page bq-management-page">
    <div class="page-header">
      <div>
        <h1>M02 用户与角色</h1>
        <p>独立 IAM 页面，使用 /api/auth/** 接口。</p>
      </div>
      <el-button type="primary" @click="createVisible = true">创建用户</el-button>
    </div>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="users" row-key="userId">
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="displayName" label="显示名" />
        <el-table-column prop="enterpriseId" label="企业" />
        <el-table-column prop="status" label="状态" />
        <el-table-column label="角色">
          <template #default="{ row }">{{ row.roleCodes.join(", ") || "—" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <el-button link type="primary" @click="toggleStatus(row)">{{ row.status === "ACTIVE" ? "停用" : "启用" }}</el-button>
            <el-button link type="primary" @click="bindRoles(row)">保存当前角色</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createVisible" title="创建用户" width="480px">
      <el-form label-width="90px" @submit.prevent="submitCreate">
        <el-form-item label="用户名"><el-input v-model="draft.username" /></el-form-item>
        <el-form-item label="显示名"><el-input v-model="draft.displayName" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="draft.password" type="password" show-password /></el-form-item>
        <el-form-item label="企业"><el-select v-model="draft.enterpriseId" clearable placeholder="平台管理员请选择"><el-option v-for="item in enterprises" :key="item.enterpriseId" :label="item.displayName" :value="item.enterpriseId" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="submitCreate">创建</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.m02-user-role-page { min-height: 100%; padding: 24px; background: var(--bq-color-surface); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h1 { margin: 0; font-size: 24px; }
p { margin: 8px 0 0; color: var(--bq-color-text-secondary); }
</style>
