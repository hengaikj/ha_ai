<script setup lang="ts">
import { computed } from "vue";
import type {
  CustTableTemplateDetail,
  CustTableTemplateVersion,
} from "@/types/cust-table";
import PermissionButton from "@/components/security/PermissionButton.vue";
const props = defineProps<{
  modelValue: boolean;
  template?: CustTableTemplateDetail;
  restoring?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  restore: [version: CustTableTemplateVersion];
}>();
const rows = computed(() => props.template?.versions ?? []);
</script>
<template>
  <el-drawer
    :model-value="modelValue"
    title="版本记录"
    size="560px"
    @update:model-value="emit('update:modelValue', $event)"
    ><el-table :data="rows"
      ><el-table-column prop="versionNo" label="版本" width="76"
        ><template #default="{ row }"
          >v{{ row.versionNo }}</template
        ></el-table-column
      ><el-table-column
        prop="publishedBy"
        label="发布人"
        width="110"
      /><el-table-column
        prop="publishedTime"
        label="发布时间"
        width="170"
      /><el-table-column
        prop="remark"
        label="版本说明"
        min-width="150"
        show-overflow-tooltip
      /><el-table-column label="操作" width="80"
        ><template #default="{ row }"
          ><PermissionButton
            permission="base:cust-table:template:edit"
            link
            type="primary"
            :loading="restoring"
            @click="emit('restore', row)"
            >恢复</PermissionButton
          ></template
        ></el-table-column
      ></el-table
    ></el-drawer
  >
</template>
