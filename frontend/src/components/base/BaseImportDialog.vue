<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { computed, onDeactivated, ref, watch } from "vue";
import { UploadFilled, Upload, Download } from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    moduleName?: string;
    title?: string;
    accept?: string;
    loading?: boolean;
    templateText?: string;
    templateTitle?: string;
    templateDescription?: string;
    uploadText?: string;
    uploadActionText?: string;
    uploadTip?: string;
    confirmText?: string;
    cancelText?: string;
    maxSizeMb?: number;
    templateButtonProps?: Record<string, unknown>;
    confirmButtonProps?: Record<string, unknown>;
    cancelButtonProps?: Record<string, unknown>;
  }>(),
  {
    moduleName: "数据",
    title: "",
    accept: ".xlsx",
    loading: false,
    templateText: "下载空模板",
    templateTitle: "下载模板",
    templateDescription: "请按照要求导入标准 Excel 文件",
    uploadText: "将文件拖到此处，或",
    uploadActionText: "点击上传",
    uploadTip: "只能上传 xlsx 格式文件，且不超过 20MB",
    confirmText: "确定",
    cancelText: "取消",
    maxSizeMb: 1,
    templateButtonProps: () => ({}),
    confirmButtonProps: () => ({}),
    cancelButtonProps: () => ({}),
  },
);

const selectedFile = ref<UploadFile | null>(null);
const dialogTitle = computed(() => props.title || `${props.moduleName}导入`);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  import: [file: UploadFile];
  "download-template": [];
}>();

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) selectedFile.value = null;
  },
);

function handleSelected(file: UploadFile) {
  const fileName = file.name.toLowerCase();
  const acceptedExtensions = props.accept
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.startsWith("."));
  if (
    acceptedExtensions.length > 0 &&
    !acceptedExtensions.some((extension) => fileName.endsWith(extension))
  ) {
    selectedFile.value = null;
    BaseToast.error(`请选择 ${acceptedExtensions.join("、")} 格式文件`);
    return;
  }
  const fileSize = file.raw?.size ?? file.size ?? 0;
  if (fileSize > props.maxSizeMb * 1024 * 1024) {
    selectedFile.value = null;
    BaseToast.error(`文件大小不能超过 ${props.maxSizeMb}MB`);
    return;
  }
  selectedFile.value = file;
}

function handleRemove() {
  selectedFile.value = null;
}

function handleImport() {
  if (selectedFile.value) {
    emit("import", selectedFile.value);
  }
}

onDeactivated(() => {
  if (props.modelValue) emit("update:modelValue", false);
});
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="560px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="base-import-dialog">
      <section v-if="templateText" class="base-import-dialog__template">
        <div>
          <div class="base-import-dialog__template-title">
            {{ templateTitle }}
          </div>
          <div class="base-import-dialog__template-desc">
            {{ templateDescription }}
          </div>
        </div>
        <PermissionButton
          class="base-import-dialog__template-button"
          v-bind="templateButtonProps"
          plain
          :icon="Download"
          @click="emit('download-template')"
        >
          {{ templateText }}
        </PermissionButton>
      </section>

      <slot />

      <el-upload
        class="base-import-dialog__upload"
        drag
        :accept="accept"
        :limit="1"
        :disabled="loading"
        :auto-upload="false"
        :on-change="handleSelected"
        :on-remove="handleRemove"
      >
        <el-icon class="base-import-dialog__upload-icon">
          <UploadFilled />
        </el-icon>
        <div class="base-import-dialog__upload-text">
          {{ uploadText }}
          <span>{{ uploadActionText }}</span>
        </div>
        <div class="base-import-dialog__upload-tip">
          {{ uploadTip }}
        </div>
      </el-upload>
    </div>
    <template #footer>
      <PermissionButton
        v-bind="cancelButtonProps"
        :disabled="loading"
        @click="emit('update:modelValue', false)"
      >
        {{ cancelText }}
      </PermissionButton>
      <PermissionButton
        v-bind="confirmButtonProps"
        type="primary"
        :icon="Upload"
        :loading="loading"
        :disabled="!selectedFile"
        @click="handleImport"
      >
        {{ confirmText }}
      </PermissionButton>
    </template>
  </el-dialog>
</template>

<style scoped>
.base-import-dialog {
  display: grid;
  gap: 16px;
}

.base-import-dialog__template {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 72px;
  padding: 14px 18px;
  background: var(--bq-color-fill-light, #f5f7fa);
  border-radius: 4px;
}

.base-import-dialog__template-title {
  color: var(--bq-color-text-primary, #303133);
  font-size: 14px;
  line-height: 22px;
}

.base-import-dialog__template-desc {
  margin-top: 4px;
  color: var(--bq-color-text-secondary, #909399);
  font-size: 14px;
  line-height: 20px;
}

.base-import-dialog__template-button {
  flex: 0 0 auto;
}

.base-import-dialog__upload :deep(.el-upload) {
  width: 100%;
}

.base-import-dialog__upload :deep(.el-upload-dragger) {
  display: flex;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-color: var(--bq-color-border, #dcdfe6);
  border-radius: 4px;
}

.base-import-dialog__upload-icon {
  margin-bottom: 14px;
  color: #b7beca;
  font-size: 40px;
}

.base-import-dialog__upload-text {
  color: var(--bq-color-text-secondary, #909399);
  font-size: 14px;
  line-height: 22px;
}

.base-import-dialog__upload-text span {
  color: var(--bq-color-primary, #f56c6c);
}

.base-import-dialog__upload-tip {
  margin-top: 6px;
  color: var(--bq-color-text-secondary, #909399);
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}
</style>
