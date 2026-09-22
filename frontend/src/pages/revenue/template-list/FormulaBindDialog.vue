<script setup lang="ts">
/**
 * 绑定公式：选择生效公式，并将参数绑定到当前模板中的叶子科目。
 */
import { computed, reactive, watch } from "vue";
import { BaseToast } from "@/components/base/BaseToast";
import {
  hasValue,
  normalizeFormulaParameterBinding,
  validateFormulaBindingsForRow,
  wouldCreateDependencyCycle,
  type FlatSubject,
  type FormulaOption,
  type FormulaParameterBinding,
  type TemplateDialogRow,
} from "./template-editor-model";

const props = defineProps<{
  modelValue: boolean;
  rows: TemplateDialogRow[];
  currentRow: TemplateDialogRow | null;
  formulaOptions: FormulaOption[];
  subjectFlatList: FlatSubject[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [payload: {
    formula: FormulaOption;
    bindings: FormulaParameterBinding[];
  }];
}>();

const form = reactive({
  formulaId: null as string | number | null,
  parameterBindings: [] as FormulaParameterBinding[],
});

const selectedFormula = computed(
  () =>
    props.formulaOptions.find(
      (item) =>
        String(item.value) === String(form.formulaId) ||
        String(item.formulaCode) === String(form.formulaId),
    ) || null,
);

const bindSubjectOptions = computed(() => {
  const currentSubjectId = props.currentRow?.subjectId;
  const seenMap: Record<string, boolean> = {};
  return props.rows
    .map((row) => {
      if (!hasValue(row.subjectId)) return null;
      const subject = props.subjectFlatList.find(
        (item) => String(item.id) === String(row.subjectId) && item.isLeaf,
      );
      if (!subject) return null;
      const key = String(row.subjectId);
      if (seenMap[key]) return null;
      seenMap[key] = true;
      const disabled =
        hasValue(currentSubjectId) &&
        (key === String(currentSubjectId) ||
          wouldCreateDependencyCycle(
            props.rows,
            props.currentRow?.uid || "",
            currentSubjectId,
            row.subjectId,
          ));
      return {
        id: row.subjectId as string | number,
        label: subject.pathLabel || subject.subjectName,
        disabled,
      };
    })
    .filter((item): item is { id: string | number; label: string; disabled: boolean } =>
      Boolean(item),
    );
});

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    const row = props.currentRow;
    form.formulaId = row?.formulaId ?? null;
    form.parameterBindings = Array.isArray(row?.formulaParameterBindings)
      ? row!.formulaParameterBindings.map((item, index) =>
          normalizeFormulaParameterBinding(item, index),
        )
      : [];
    syncParameters();
  },
);

watch(
  () => form.formulaId,
  () => {
    if (props.modelValue) syncParameters();
  },
);

function syncParameters() {
  const formula = selectedFormula.value;
  if (!formula) {
    form.parameterBindings = [];
    return;
  }
  const existingMap = form.parameterBindings.reduce<Record<string, FormulaParameterBinding>>(
    (map, item) => {
      if (item?.parameterKey) map[item.parameterKey] = item;
      return map;
    },
    {},
  );
  form.parameterBindings = formula.parameters.map((parameter, index) => {
    const existed = existingMap[parameter.parameterKey] || {};
    return {
      parameterIndex: index + 1,
      parameterKey: parameter.parameterKey,
      parameterLabel: parameter.parameterLabel || parameter.parameterKey,
      parameterName:
        parameter.parameterName || parameter.parameterLabel || parameter.parameterKey,
      subjectId: hasValue(existed.subjectId) ? existed.subjectId! : null,
      subjectCode: existed.subjectCode,
      subjectName: existed.subjectName,
    };
  });
}

function handleCancel() {
  emit("update:modelValue", false);
}

function handleConfirm() {
  const formula = selectedFormula.value;
  const row = props.currentRow;
  if (!formula) {
    BaseToast.warning("请选择公式");
    return;
  }
  if (!row) return;
  if (form.parameterBindings.some((item) => !hasValue(item.subjectId))) {
    BaseToast.warning("请为每一个公式参数选择对应科目");
    return;
  }
  const message = validateFormulaBindingsForRow(
    props.rows,
    row,
    form.parameterBindings,
    props.subjectFlatList,
  );
  if (message) {
    BaseToast.error(message);
    return;
  }
  emit("confirm", {
    formula,
    bindings: form.parameterBindings.map((item) => ({ ...item })),
  });
  emit("update:modelValue", false);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="绑定公式"
    width="720px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="88px" size="small">
      <el-form-item label="公式" required>
        <el-select
          v-model="form.formulaId"
          class="formula-bind-select"
          placeholder="请选择公式"
          clearable
          filterable
        >
          <el-option
            v-for="option in formulaOptions"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
          >
            <span>{{ option.label }}</span>
            <span class="formula-option__expression">{{ option.expression }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item v-if="selectedFormula" label="参数绑定" required>
        <div v-if="!form.parameterBindings.length" class="formula-bind-empty">
          当前公式未识别到参数
        </div>
        <div v-else class="formula-bind-parameter-list">
          <div
            v-for="parameter in form.parameterBindings"
            :key="parameter.parameterKey"
            class="formula-bind-parameter-row"
          >
            <div class="formula-bind-parameter-row__label">
              <el-tag size="small" effect="dark">{{ parameter.parameterLabel }}</el-tag>
              <span>{{ parameter.parameterName }}</span>
            </div>
            <el-select
              v-model="parameter.subjectId"
              clearable
              filterable
              :placeholder="`请选择${parameter.parameterLabel}对应科目`"
              style="width: 100%"
            >
              <el-option
                v-for="option in bindSubjectOptions"
                :key="String(option.id)"
                :label="option.label"
                :value="option.id"
                :disabled="option.disabled"
              />
            </el-select>
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.formula-bind-select {
  width: 100%;
}

.formula-option__expression {
  float: right;
  margin-left: 16px;
  color: #8492a6;
  font-size: 12px;
}

.formula-bind-empty {
  padding: 18px 12px;
  border: 1px dashed #dcdfe6;
  color: #909399;
  text-align: center;
}

.formula-bind-parameter-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.formula-bind-parameter-row {
  padding: 12px;
  border: 1px solid #e4edf7;
  background: #fff;
}

.formula-bind-parameter-row__label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #475669;
  font-size: 13px;
}
</style>
