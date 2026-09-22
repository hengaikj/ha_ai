<template>
  <div class="opinion-card">
    <div class="opinion-title">{{ title }}</div>
    <div v-if="priorOpinions.length" class="prior-opinions">
      <div class="prior-opinions-title">前序节点意见</div>
      <div
        v-for="(prior, index) in priorOpinions"
        :key="`prior_${index}`"
        class="prior-opinion-item"
      >
        <div class="prior-opinion-head">
          <span class="prior-opinion-label">{{ (prior as any).label }}</span>
          <span class="prior-opinion-meta">{{ (prior as any).time || "-" }}</span>
        </div>
        <div class="prior-opinion-text">{{ (prior as any).opinion || "-" }}</div>
        <div class="prior-opinion-author">填写人：{{ (prior as any).actor || "-" }}</div>
      </div>
    </div>
    <el-input
      v-if="showEditor"
      type="textarea"
      :rows="4"
      :model-value="localValue"
      :disabled="disabled"
      :placeholder="placeholder"
      @update:model-value="onLocalInput"
      @blur="$emit('blur')"
    />
    <div v-if="showSave || showReedit || showSubmit" class="opinion-actions">
      <el-button
        v-if="showSave"
        size="small"
        :loading="saveLoading"
        :disabled="saveLoading"
        @click="$emit('save')"
      >
        {{ saveText }}
      </el-button>
      <el-button
        v-if="showReedit"
        size="small"
        :disabled="reeditDisabled"
        @click="$emit('reedit')"
      >
        {{ reeditText }}
      </el-button>
      <!-- 可提交时不用 Tooltip 包一层，避免 Element Plus 吞掉点击 -->
      <el-tooltip
        v-if="showSubmit && submitHint"
        :content="submitHint"
        placement="top"
      >
        <span class="submit-disabled-tooltip" tabindex="0">
          <el-button
            size="small"
            type="primary"
            native-type="button"
            :loading="submitLoading"
            :disabled="submitDisabled"
            @click.stop.prevent="onSubmitClick"
          >
            {{ submitText }}
          </el-button>
        </span>
      </el-tooltip>
      <el-button
        v-else-if="showSubmit"
        size="small"
        type="primary"
        native-type="button"
        :loading="submitLoading"
        :disabled="submitDisabled"
        @click.stop.prevent="onSubmitClick"
      >
        {{ submitText }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps({
  title: { type: String, default: "审核意见" },
  value: { type: String, default: "" },
  priorOpinions: { type: Array, default: () => [] },
  placeholder: { type: String, default: "请输入审核意见" },
  disabled: { type: Boolean, default: false },
  submitDisabled: { type: Boolean, default: false },
  submitLoading: { type: Boolean, default: false },
  saveLoading: { type: Boolean, default: false },
  submitHint: { type: String, default: "" },
  showSave: { type: Boolean, default: false },
  showEditor: { type: Boolean, default: true },
  showSubmit: { type: Boolean, default: true },
  showReedit: { type: Boolean, default: false },
  reeditDisabled: { type: Boolean, default: false },
  saveText: { type: String, default: "保存草稿" },
  submitText: { type: String, default: "提交" },
  reeditText: { type: String, default: "重新编辑" },
  // 父级直接传入回调，避开 Vue3 原生 submit 事件名冲突
  handleSubmit: { type: Function, default: null },
});

const emit = defineEmits<{
  (e: "value-update", value: string): void;
  (e: "blur"): void;
  (e: "save"): void;
  (e: "reedit"): void;
  (e: "submit", value: string): void;
  (e: "submitModule", value: string): void;
}>();

/** 本地缓冲：避免父级 map 未及时响应时输入被清空 */
const localValue = ref(String(props.value || ""));

watch(
  () => props.value,
  (next) => {
    const text = String(next == null ? "" : next);
    if (text !== localValue.value) {
      localValue.value = text;
    }
  },
);

function onLocalInput(next: string | number) {
  const text = String(next == null ? "" : next);
  localValue.value = text;
  emit("value-update", text);
}

function onSubmitClick() {
  if (props.submitDisabled || props.submitLoading) return;
  const text = String(localValue.value || "");
  // 先通知父级当前值（用于草稿保存），再提交
  emit("value-update", text);
  if (typeof props.handleSubmit === "function") {
    props.handleSubmit(text);
    return;
  }
  emit("submitModule", text);
}
</script>

<style lang="scss" scoped>
.opinion-card {
  margin: 0;
  border-top: 1px solid var(--rv-line);
  border-radius: 0;
  background: #fff;
  padding: 10px 14px;
}

.opinion-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--rv-text-2);
  margin-bottom: 8px;
}

.prior-opinions {
  margin-bottom: 8px;
  border: 1px solid #edf2fa;
  border-radius: 6px;
  background: #f7f9fc;
  padding: 8px 10px;
}

.prior-opinions-title {
  font-size: 12px;
  font-weight: 600;
  color: #607289;
  margin-bottom: 6px;
}

.prior-opinion-item {
  border-top: 1px dashed #e2e9f3;
  padding: 6px 0;
}

.prior-opinion-item:first-of-type {
  border-top: none;
  padding-top: 0;
}

.prior-opinion-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #2f4258;
}

.prior-opinion-label {
  font-weight: 600;
}

.prior-opinion-meta {
  color: #91a0b4;
}

.prior-opinion-text {
  margin-top: 2px;
  font-size: 12px;
  color: #4a5a6e;
  white-space: pre-wrap;
}

.prior-opinion-author {
  margin-top: 2px;
  font-size: 12px;
  color: #91a0b4;
}

.opinion-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.submit-disabled-tooltip {
  display: inline-flex;
  vertical-align: middle;
}
</style>
