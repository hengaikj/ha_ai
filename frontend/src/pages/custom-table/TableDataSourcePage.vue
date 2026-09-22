<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Refresh, Search } from "@element-plus/icons-vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { listCustTableProviders } from "@/api/cust-table";
import type { CustTableProvider } from "@/types/cust-table";

const loading = ref(false);
const keyword = ref("");
const ownerModule = ref("");
const rows = ref<CustTableProvider[]>([]);
const moduleOptions = computed(() =>
  Array.from(new Set(rows.value.map((item) => item.ownerModule))).sort(),
);
async function load() {
  loading.value = true;
  try {
    const providers = await listCustTableProviders(
      ownerModule.value || undefined,
    );
    const normalizedKeyword = keyword.value.trim().toLowerCase();
    rows.value = normalizedKeyword
      ? providers.filter((item) =>
          `${item.providerCode} ${item.displayName}`
            .toLowerCase()
            .includes(normalizedKeyword),
        )
      : providers;
  } finally {
    loading.value = false;
  }
}
function resetQuery() {
  keyword.value = "";
  ownerModule.value = "";
  load();
}
onMounted(load);
</script>

<template>
  <PageContainer
    title="数据源管理"
    description="维护设计工作台可选择的受控 Provider 数据源、启停状态和样例预览数据。"
  >
    <div class="toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索编码或名称"
        @keyup.enter="load"
      >
        <template #prefix
          ><el-icon><Search /></el-icon
        ></template>
      </el-input>
      <el-select v-model="ownerModule" clearable placeholder="所属模块">
        <el-option
          v-for="item in moduleOptions"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" row-key="id" border>
      <el-table-column prop="ownerModule" label="模块" width="110" />
      <el-table-column
        prop="providerCode"
        label="Provider编码"
        min-width="210"
        show-overflow-tooltip
      />
      <el-table-column prop="displayName" label="名称" min-width="170" />
      <el-table-column prop="dataShape" label="形态" width="90" />
      <el-table-column label="数据源状态" width="90">
        <template #default="{ row }">
          <BaseStatusTag
            :label="row.status === 'ACTIVE' ? '启用' : '停用'"
            :type="row.status === 'ACTIVE' ? 'success' : 'info'"
          />
        </template>
      </el-table-column>
      <el-table-column label="字段数" width="90">
        <template #default="{ row }">{{
          row.descriptor.fields.length
        }}</template>
      </el-table-column>
      <el-table-column label="参数数" width="90">
        <template #default="{ row }">{{
          row.descriptor.parameters.length
        }}</template>
      </el-table-column>
      <el-table-column
        prop="remark"
        label="备注"
        min-width="160"
        show-overflow-tooltip
      />
    </el-table>
  </PageContainer>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 160px 130px auto auto;
  gap: 10px;
  margin-bottom: 14px;
}
@media (max-width: 768px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
