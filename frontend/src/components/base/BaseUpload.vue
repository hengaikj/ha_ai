<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { UploadFile, UploadFiles, UploadRawFile } from "element-plus";

withDefaults(
  defineProps<{
    accept?: string;
    limit?: number;
    maxSizeMb?: number;
    disabled?: boolean;
    buttonText?: string;
    tip?: string;
  }>(),
  {
    accept: "",
    limit: 1,
    maxSizeMb: 20,
    disabled: false,
    buttonText: "选择文件",
    tip: "上传前需校验文件大小、类型、摘要和权限。",
  },
);

const emit = defineEmits<{
  selected: [file: UploadFile, files: UploadFiles];
  "size-exceeded": [file: UploadRawFile];
}>();

function handleChange(file: UploadFile, files: UploadFiles) {
  emit("selected", file, files);
}

function beforeUpload(file: UploadRawFile, maxSizeMb: number) {
  if (file.size > maxSizeMb * 1024 * 1024) {
    emit("size-exceeded", file);
    return false;
  }
  return false;
}
</script>

<template>
  <el-upload
    :accept="accept"
    :limit="limit"
    :disabled="disabled"
    :auto-upload="false"
    :before-upload="(file: UploadRawFile) => beforeUpload(file, maxSizeMb)"
    @change="handleChange"
  >
    <PermissionButton :disabled="disabled">{{ buttonText }}</PermissionButton>
    <template #tip>
      <div class="base-upload__tip">{{ tip }}</div>
    </template>
  </el-upload>
</template>

<style scoped>
.base-upload__tip {
  margin-top: 6px;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}
</style>
