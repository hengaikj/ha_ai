<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  CoffeeCup,
  Coin,
  Cpu,
  Monitor,
  Refresh,
  Tickets,
} from "@element-plus/icons-vue";
import { fetchServerMonitor } from "@/api/monitor";
import PageContainer from "@/components/layout/PageContainer.vue";
import type { ServerMonitorSnapshot } from "@/types/monitor";

const snapshot = ref<ServerMonitorSnapshot>({});
const loading = ref(false);

const cpuMetrics = computed(() => [
  { label: "核心数", value: snapshot.value.cpu?.cpuNum ?? "--" },
  { label: "用户使用率", value: percent(snapshot.value.cpu?.used) },
  { label: "系统使用率", value: percent(snapshot.value.cpu?.sys) },
  { label: "当前空闲率", value: percent(snapshot.value.cpu?.free) },
]);

const memoryRows = computed(() => [
  {
    label: "总内存",
    memory: withUnit(snapshot.value.mem?.total, "G"),
    jvm: withUnit(snapshot.value.jvm?.total, "M"),
  },
  {
    label: "已用内存",
    memory: withUnit(snapshot.value.mem?.used, "G"),
    jvm: withUnit(snapshot.value.jvm?.used, "M"),
  },
  {
    label: "剩余内存",
    memory: withUnit(snapshot.value.mem?.free, "G"),
    jvm: withUnit(snapshot.value.jvm?.free, "M"),
  },
  {
    label: "使用率",
    memory: percent(snapshot.value.mem?.usage),
    jvm: percent(snapshot.value.jvm?.usage),
    memoryDanger: Number(snapshot.value.mem?.usage ?? 0) > 80,
    jvmDanger: Number(snapshot.value.jvm?.usage ?? 0) > 80,
  },
]);

function percent(value?: number) {
  return value == null ? "--" : `${value}%`;
}

function withUnit(value: unknown, unit: string) {
  return value == null || value === "" ? "--" : `${value}${unit}`;
}

async function loadSnapshot() {
  loading.value = true;
  try {
    snapshot.value = await fetchServerMonitor();
  } finally {
    loading.value = false;
  }
}

onMounted(loadSnapshot);
</script>

<template>
  <PageContainer title="服务监控" description="查看服务器、JVM 和磁盘运行状态">
    <div v-loading="loading" class="server-monitor">
      <section class="monitor-section">
        <header class="monitor-section__header">
          <h2>
            <el-icon><Cpu /></el-icon>CPU
          </h2>
          <el-tooltip content="刷新服务监控" placement="top">
            <el-button
              circle
              :icon="Refresh"
              :loading="loading"
              aria-label="刷新服务监控"
              @click="loadSnapshot"
            />
          </el-tooltip>
        </header>
        <el-table :data="cpuMetrics" table-layout="fixed">
          <el-table-column prop="label" label="属性" min-width="160" />
          <el-table-column prop="value" label="值" min-width="140" />
        </el-table>
      </section>

      <section class="monitor-section">
        <header class="monitor-section__header">
          <h2>
            <el-icon><Tickets /></el-icon>内存
          </h2>
        </header>
        <el-table :data="memoryRows" table-layout="fixed">
          <el-table-column prop="label" label="属性" min-width="120" />
          <el-table-column label="内存" min-width="140">
            <template #default="{ row }">
              <span :class="{ 'is-danger': row.memoryDanger }">{{
                row.memory
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="JVM" min-width="140">
            <template #default="{ row }">
              <span :class="{ 'is-danger': row.jvmDanger }">{{ row.jvm }}</span>
            </template>
          </el-table-column>
        </el-table>
      </section>

      <section class="monitor-section monitor-section--wide">
        <header class="monitor-section__header">
          <h2>
            <el-icon><Monitor /></el-icon>服务器信息
          </h2>
        </header>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="服务器名称">
            {{ snapshot.sys?.computerName || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="操作系统">
            {{ snapshot.sys?.osName || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="服务器 IP">
            {{ snapshot.sys?.computerIp || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="系统架构">
            {{ snapshot.sys?.osArch || "--" }}
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="monitor-section monitor-section--wide">
        <header class="monitor-section__header">
          <h2>
            <el-icon><CoffeeCup /></el-icon>Java 虚拟机信息
          </h2>
        </header>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Java 名称">{{
            snapshot.jvm?.name || "--"
          }}</el-descriptions-item>
          <el-descriptions-item label="Java 版本">{{
            snapshot.jvm?.version || "--"
          }}</el-descriptions-item>
          <el-descriptions-item label="启动时间">{{
            snapshot.jvm?.startTime || "--"
          }}</el-descriptions-item>
          <el-descriptions-item label="运行时长">{{
            snapshot.jvm?.runTime || "--"
          }}</el-descriptions-item>
          <el-descriptions-item label="安装路径" :span="2">{{
            snapshot.jvm?.home || "--"
          }}</el-descriptions-item>
          <el-descriptions-item label="项目路径" :span="2">{{
            snapshot.sys?.userDir || "--"
          }}</el-descriptions-item>
          <el-descriptions-item label="运行参数" :span="2">{{
            snapshot.jvm?.inputArgs || "--"
          }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="monitor-section monitor-section--wide">
        <header class="monitor-section__header">
          <h2>
            <el-icon><Coin /></el-icon>磁盘状态
          </h2>
        </header>
        <el-table :data="snapshot.sysFiles ?? []" table-layout="fixed">
          <el-table-column
            prop="dirName"
            label="盘符路径"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="sysTypeName"
            label="文件系统"
            min-width="120"
          />
          <el-table-column prop="typeName" label="盘符类型" min-width="130" />
          <el-table-column prop="total" label="总大小" min-width="110" />
          <el-table-column prop="free" label="可用大小" min-width="110" />
          <el-table-column prop="used" label="已用大小" min-width="110" />
          <el-table-column label="已用百分比" min-width="130">
            <template #default="{ row }">
              <span :class="{ 'is-danger': Number(row.usage ?? 0) > 80 }">
                {{ percent(row.usage) }}
              </span>
            </template>
          </el-table-column>
          <template #empty>暂无磁盘信息</template>
        </el-table>
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.server-monitor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--bq-space-section);
}

.monitor-section {
  min-width: 0;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
  overflow: hidden;
}

.monitor-section--wide {
  grid-column: 1 / -1;
}

.monitor-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  background: var(--bq-color-surface);
}

.monitor-section__header h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.monitor-section__header .el-icon {
  color: var(--bq-color-text-secondary);
}

.monitor-section :deep(.el-table__header th.el-table__cell) {
  height: 48px;
  background: var(--bq-color-surface-muted);
  color: var(--bq-color-text-secondary);
  font-weight: 600;
}

.monitor-section :deep(.el-table__row td.el-table__cell) {
  height: 54px;
}

.monitor-section :deep(.el-descriptions__label),
.monitor-section :deep(.el-descriptions__content) {
  height: 54px;
  padding: 12px 16px !important;
}

.monitor-section :deep(.el-descriptions__label) {
  width: 22%;
  background: var(--bq-color-surface) !important;
  color: var(--bq-color-text-secondary);
  font-weight: 500;
}

.is-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}

@media (max-width: 900px) {
  .server-monitor {
    grid-template-columns: 1fr;
  }

  .monitor-section--wide {
    grid-column: auto;
  }
}
</style>
