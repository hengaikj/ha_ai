<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string;
  }>(),
  {
    text: "支持 .xlsx 格式",
  },
);
</script>

<template>
  <div class="upload-tips">
    <el-icon class="upload-tips__icon"><upload-filled /></el-icon>
    <div class="upload-tips__text">
      <span>点击或将文件拖拽到这里上传</span>
    </div>
    <div class="upload-tips__hint">{{ text }}</div>
  </div>
</template>

<style scoped>
.upload-tips {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #999;
}
.upload-tips__icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 8px;
}
.upload-tips__text {
  margin-bottom: 4px;
}
.upload-tips__hint {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
