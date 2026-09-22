<template>
  <el-dialog
    title="数据导入"
    :model-value="visible"
    width="520px"
    append-to-body
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form class="data-import-form" label-width="0px" size="small" @submit.prevent>
      <el-form-item>
        <el-select
          :model-value="rootSubjectId"
          placeholder="请选择本次导入模板"
          filterable
          style="width: 100%"
          @update:model-value="$emit('update:rootSubjectId', $event)"
        >
          <el-option
            v-for="item in options"
            :key="item.id"
            :label="item.label"
            :value="item.id"
          >
            <span>{{ item.label }}</span>
            <span class="data-import-option-meta">{{ item.leafCount }} 个科目</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item class="data-import-help-item">
        <div class="data-import-help">
          请先下载本模块模板填写，再选择文件导入。模板含可填和计算科目；已有值会带入模板。清空 Excel 可填格子再导入会清空页面对应格子；计算格导入后可对比导入值与公式值并选择是否覆盖公式，默认否。整份模板都空则不会改页面。
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button size="small" native-type="button" @click="$emit('update:visible', false)">取消</el-button>
        <el-button
          size="small"
          :disabled="loading"
          @click="$emit('download-template')"
        >
          下载模板
        </el-button>
        <el-button
          size="small"
          type="primary"
          native-type="button"
          :loading="loading"
          @click="$emit('choose-file')"
        >
          选择文件
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 子表填报页"数据导入"弹窗（纯展示）。
 *
 * 下载模板 / 选择文件均回调父页面；隐藏文件输入仍由 detail.vue 持有。
 */
defineProps<{
  visible?: boolean;
  rootSubjectId?: string | number;
  options?: Array<{ id: string | number; label: string; leafCount: number }>;
  loading?: boolean;
}>();

defineEmits<{
  'update:visible': [value: boolean];
  'update:rootSubjectId': [value: string | number];
  'choose-file': [];
  'download-template': [];
}>();
</script>

<style lang="scss" scoped>
.data-import-option-meta {
  float: right;
  color: #8492a6;
  font-size: 12px;
}
</style>
