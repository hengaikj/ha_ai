<script setup lang="ts">
import { Picture } from "@element-plus/icons-vue";
</script>

<template>
  <div class="vehicle-image-fallback" role="img" aria-label="车型图片不可用">
    <el-icon><Picture /></el-icon>
    <span>图片不可用</span>
  </div>
</template>

<style scoped>
.vehicle-image-fallback {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 400;
  line-height: 1.2;
}

.vehicle-image-fallback .el-icon {
  flex: 0 0 auto;
  font-size: 12px;
}
</style>
