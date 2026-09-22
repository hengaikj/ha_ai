<template>
  <div style="margin: 10px 0 0">
    <div class="header-title">
      <el-button type="text" :icon="ArrowLeft" @click="back">返回</el-button>
      <div class="str">{{ props.mode === 'show' ? '查看' : '编辑' }}</div>
    </div>
    <div ref="topTab">
      <el-tabs v-model="activeTab" @tab-click="tabClick">
        <el-tab-pane label="基础信息" name="0"></el-tab-pane>
        <el-tab-pane label="分类" name="1"></el-tab-pane>
        <el-tab-pane label="BOM补充信息" name="2"></el-tab-pane>
        <el-tab-pane label="分工" name="3"></el-tab-pane>
        <el-tab-pane label="单车用量" name="4"></el-tab-pane>
        <el-tab-pane label="目标成本" name="5"></el-tab-pane>
        <el-tab-pane label="评估成本" name="6"></el-tab-pane>
        <el-tab-pane label="当前成本" name="7"></el-tab-pane>
      </el-tabs>
    </div>
    <div ref="scrollWrap" class="scroll-wrap">
      <el-form label-position="top">
        <div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="项目代号">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.projectName" :disabled="disabledForm.top" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.projectName || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="工厂代码">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.factoryCode" :disabled="disabledForm.top" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.factoryCode || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <div class="el-edit-bottom" data-anchor="0">基础信息</div>

          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="SOR号">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.sorNumber" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.sorNumber || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="SOR名称">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.sorName" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.sorName || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="ECR号">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.ecrNumber" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.ecrNumber || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="ECR名称">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.ecrName" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.ecrName || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="装配级别">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.assemblyLevel" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.assemblyLevel || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="零件号">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.partNumber" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.partNumber || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="零件名称">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.partName" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.partName || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="零部件关键技术状态描述">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.partTechDesc" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.partTechDesc || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="单车用量">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.unitUsage" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.unitUsage || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="模块标识">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.moduleIdentifier" :disabled="disabledForm[0]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.moduleIdentifier || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="首用车型">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.firstVehicleModel" :disabled="disabledForm[0]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.firstVehicleModel || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="供应商名称">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.supplierName" :disabled="disabledForm[0]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.supplierName || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div>
          <div class="el-edit-bottom" data-anchor="1">分类</div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="通用化级别">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.generalizationLevel" :disabled="disabledForm[1]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.generalizationLevel || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="是否架构件">
                <template v-if="props.mode !== 'show'">
                  <el-radio-group v-model="searchForm.isArchitectureComponent" :disabled="disabledForm[1]">
                    <el-radio-button :label="'是'">是</el-radio-button>
                    <el-radio-button :label="'否'">否</el-radio-button>
                  </el-radio-group>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.isArchitectureComponent || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div>
          <div class="el-edit-bottom" data-anchor="2">BOM补充信息</div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="建议货源">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.suggestedSupplySource" :disabled="disabledForm[2]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.suggestedSupplySource || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="货源描述">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.sourceDescription" :disabled="disabledForm[2]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.sourceDescription || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="多结构货源">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.multiStructuredSupplySources" :disabled="disabledForm[2]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.multiStructuredSupplySources || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="24">
              <el-form-item label="多结构货源描述">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.multiSourcesDescription" :disabled="disabledForm[2]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.multiSourcesDescription || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div>
          <div class="el-edit-bottom" data-anchor="3">分工</div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="研发专业部门">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.developmentDepartment" :disabled="disabledForm[3]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.developmentDepartment || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="专业工程师">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.expertEngineer" :disabled="disabledForm[3]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.expertEngineer || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="零件属性">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.partAttribute" :disabled="disabledForm[3]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.partAttribute || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="成本专业科室">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.firstClassification" :disabled="disabledForm[3]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.firstClassification || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="成本二级分类">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.secondClassification" :disabled="disabledForm[3]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.secondClassification || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="成本三级分类">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.threeClassification" :disabled="disabledForm[3]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.threeClassification || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="成本工程师">
                <template v-if="props.mode !== 'show'">
                  <el-input v-model="searchForm.costEngineer" :disabled="disabledForm[3]" placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.costEngineer || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="采购工程师">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.procurementBusinessLine" :disabled="disabledForm[3]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.procurementBusinessLine || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div>
          <div class="el-edit-bottom" data-anchor="4">单车用量</div>
          <el-row :gutter="24">
            <el-col v-for="(item, index) in ((searchForm as any).costBomPattern || [])" :key="'danche' + index" :span="8">
              <el-form-item v-if="item.patternName != '加权'" :label="item.patternName">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="(searchForm as any).costBomPattern[index].usagePerVehicle" :disabled="disabledForm[4]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ (searchForm as any).costBomPattern[index].usagePerVehicle || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>
        <div>
          <div class="el-edit-bottom" data-anchor="5">目标成本</div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="材料成本（不含摊销）">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.targetMaterialCost" :disabled="disabledForm[5]"
                    placeholder="请输入" @blur="handleBlur('targetMaterialCost')"
                    @focus="handleFocus('targetMaterialCost')"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.targetMaterialCost || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div>
          <div class="el-edit-bottom" data-anchor="6">评估成本</div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="材料成本（不含摊销）">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.assessMaterialCost" :disabled="disabledForm[6]"
                    placeholder="请输入" @blur="handleBlur('assessMaterialCost')"
                    @focus="handleFocus('assessMaterialCost')"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.assessMaterialCost || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="数据来源">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.assessDataSources" :disabled="disabledForm[6]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.assessDataSources || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div>
          <div class="el-edit-bottom" data-anchor="7">当前成本</div>
          <el-row :gutter="24">
            <el-col :span="8">
              <el-form-item label="材料成本（含摊销）">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.currentMaterialCostAmortize" :disabled="disabledForm[7]"
                    placeholder="请输入" @blur="handleBlur('currentMaterialCostAmortize')"
                    @focus="handleFocus('currentMaterialCostAmortize')"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.currentMaterialCostAmortize || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="数据来源（含摊销）">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.currentAmortizeDataSources" :disabled="disabledForm[7]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.currentAmortizeDataSources || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="材料成本（不含摊销）">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.currentMaterialCost" :disabled="disabledForm[7]"
                    placeholder="请输入" @blur="handleBlur('currentMaterialCost')"
                    @focus="handleFocus('currentMaterialCost')"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.currentMaterialCost || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="数据来源（不含摊销）">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.currentDataSources" :disabled="disabledForm[7]"
                    placeholder="请输入"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.currentDataSources || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="摊销">
                <template v-if="props.mode !== 'show'">
                  <el-input
v-model="searchForm.currentAmortize" :disabled="disabledForm[7]"
                    placeholder="请输入" @blur="handleBlur('currentAmortize')"
                    @focus="handleFocus('currentAmortize')"></el-input>
                </template>
                <template v-else>
                  <div class="detail-text">{{ searchForm.currentAmortize || '-' }}</div>
                </template>
              </el-form-item>
            </el-col>
          </el-row>
        </div>
      </el-form>
    </div>
    <div class="drawer-footer mt10">
      <el-button @click="$emit('back')">取消</el-button>
      <el-button type="primary" :loading="saveLoading" :disabled="auth_null" @click="saveClick">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue";
import { ArrowLeft } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import _ from "lodash";
import { editProfitBom, editDesignBom, editAdminBom } from "@/api/revenue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();

const props = defineProps<{
  backfill: Record<string, unknown>;
  mode?: string;
}>();

const emit = defineEmits<{
  (e: "back", refresh?: boolean): void;
}>();

// ============================================================
// 工具函数
// ============================================================

function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const num = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

// ============================================================
// 响应式状态
// ============================================================

const searchForm = ref<Record<string, unknown>>({});
const disabledForm = reactive<Record<string | number, boolean>>({
  top: true,
  0: true,
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
  6: true,
  7: true,
});
const activeTab = ref("0");
const saveLoading = ref(false);

const scrollWrap = ref<HTMLElement>();
const _topTab = ref<HTMLElement>();

// ============================================================
// 权限计算
// ============================================================

const permissions = computed(() => authStore.permissions);
const auth_fullAccess = computed(() => permissions.value.includes("*:*:*"));
const auth_design = computed(() => permissions.value.includes("system:design:bom:edit"));
const auth_profit = computed(() => permissions.value.includes("system:profit:bom:edit"));
const auth_revenue = computed(() => permissions.value.includes("system:revenue:bom:edit"));
const auth_null = computed(
  () =>
    !auth_fullAccess.value &&
    !auth_design.value &&
    !auth_profit.value &&
    !auth_revenue.value,
);

// ============================================================
// 方法
// ============================================================

function handleBlur(key: string) {
  searchForm.value[key] = formatPrice(searchForm.value[key] as number | string | null);
}

function handleFocus(key: string) {
  searchForm.value[key] = parsePrice(searchForm.value[key]);
}

function back() {
  emit("back");
}

function saveClick() {
  saveLoading.value = true;
  let subFunc: (data?: unknown) => Promise<unknown> = () => {
    BaseToast.error("当前账号无权限");
    return Promise.resolve(true);
  };
  [
    "targetMaterialCost",
    "assessMaterialCost",
    "currentMaterialCostAmortize",
    "currentMaterialCost",
    "currentAmortize",
  ].forEach((item) => {
    searchForm.value[item] = parsePrice(searchForm.value[item]);
  });
  if (auth_profit.value) {
    subFunc = editProfitBom;
  } else if (auth_design.value) {
    subFunc = editDesignBom;
  } else if (auth_fullAccess.value || auth_revenue.value) {
    subFunc = editAdminBom;
  }
  subFunc(searchForm.value)
    .then((res: any) => {
      if (res.code == 200) {
        BaseToast.success("保存成功");
        emit("back", true);
      } else {
        BaseToast.error(res.message as string);
      }
    })
    .finally(() => {
      saveLoading.value = false;
    });
}

function tabClick(cur: { name: string }) {
  const anchor = document.querySelector(`[data-anchor="${cur.name}"]`);
  if (anchor) {
    let target = (anchor as HTMLElement).offsetTop - 160;
    if (cur.name == "0") {
      target = 0;
    }
    scrollWrap.value?.scrollTo({
      top: target,
      behavior: "smooth",
    });
  }
}

function scrolling() {
  const anchors = document.querySelectorAll(`[data-anchor]`);
  const topTabOffset = 158;
  void topTabOffset;
  let nearest: Element | null = null;
  let min = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const rect = anchor.getBoundingClientRect();
    if (rect.top <= min && rect.top >= 0) {
      nearest = anchor;
      min = rect.top;
    }
  }
  if (nearest) {
    const name = nearest.getAttribute("data-anchor");
    if (activeTab.value != name) {
      activeTab.value = name!;
    }
  }
}

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
  scrollWrap.value?.addEventListener("scroll", scrolling, {
    passive: true,
  });
});

onBeforeUnmount(() => {
  scrollWrap.value?.removeEventListener("scroll", scrolling);
});

// 初始化
searchForm.value = _.cloneDeep(props.backfill) as Record<string, unknown>;
searchForm.value.partAttribute = searchForm.value.partAttribute || "";
[
  "targetMaterialCost",
  "assessMaterialCost",
  "currentMaterialCostAmortize",
  "currentMaterialCost",
  "currentAmortize",
].forEach((item) => {
  searchForm.value[item] = formatPrice(searchForm.value[item] as number | string | null);
});

if (props.mode !== "show") {
  if (auth_design.value) {
    disabledForm[6] = false;
  }
  if (auth_profit.value) {
    disabledForm[5] = false;
  }
  if (auth_revenue.value) {
    ["top", 0, 1, 2, 3, 4].forEach((item) => {
      disabledForm[item] = false;
    });
  }
  if (auth_fullAccess.value) {
    ["top", 0, 1, 2, 3, 4, 5, 6].forEach((item) => {
      disabledForm[item] = false;
    });
  }
}

void _topTab.value;
</script>

<style lang="scss" scoped>
.scroll-wrap {
  height: calc(100vh - 230px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
}

.drawer-footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;
}

.el-edit-bottom {
  position: relative;
  padding-left: 14px;
  font-size: 16px;
  color: #333;
  margin: 30px 0 10px;
}

.el-edit-bottom::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background-color: #1890ff;
  border-radius: 2px;
}
</style>
