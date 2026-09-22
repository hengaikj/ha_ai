<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <el-drawer
    v-model="drawerVisible"
    title="现场计算器"
    direction="rtl"
    :size="props.size"
    class="meeting-review-calc-drawer"
    :append-to-body="false"
    :modal-append-to-body="false"
  >
    <div class="calc-body">
      <div class="calc-section">
        <div class="calc-title">基准值</div>
        <div class="calc-base-grid">
          <div class="calc-base-field">
            <div class="calc-base-label">版本</div>
            <el-select
              v-model="props.state.calcBaseVersion"
              size="small"
              style="width: 100%"
              :popper-append-to-body="false"
              popper-class="meeting-review-calc-popper"
              @change="onCalcBaseChange"
            >
              <el-option
                v-for="item in props.allVersions"
                :key="`calc_base_${item.key}`"
                :label="item.label"
                :value="item.key"
              />
            </el-select>
          </div>
          <div class="calc-base-field">
            <div class="calc-base-label">口径</div>
            <el-select
              v-model="props.state.calcBaseYear"
              size="small"
              style="width: 100%"
              :popper-append-to-body="false"
              popper-class="meeting-review-calc-popper"
              @change="onCalcBaseChange"
            >
              <el-option
                v-for="item in props.calcBaseYearOptions"
                :key="`calc_base_year_${item.value}`"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </div>
      </div>

      <div class="calc-section">
        <div class="calc-title">测算方式</div>
        <el-radio-group v-model="calcMode" size="small" @change="onCalcModeChange">
          <el-radio-button value="single">单值测算</el-radio-button>
          <el-radio-button value="mix">销量MIX测算</el-radio-button>
        </el-radio-group>
      </div>

      <div class="calc-section">
        <div class="calc-title">测算版本</div>
        <div class="calc-version-toolbar">
          <el-button size="small" @click="createCalcVersionDraft">+ 新建版本</el-button>
          <el-button
            v-for="item in props.state.calcVersions"
            :key="`calc_version_${item.key}`"
            size="small"
            :type="item.key === props.state.activeCalcVersionKey ? 'primary' : 'default'"
            @click="selectCalcVersion(item.key)"
          >
            {{ item.label }}
          </el-button>
        </div>
        <div class="calc-version-edit-row">
          <el-input
            v-model="calcVersionNameInput"
            size="small"
            placeholder="支持自由命名，例如：测算值v1"
          />
          <el-button
            size="small"
            :disabled="!props.state.activeCalcVersionKey"
            @click="removeCalcVersion(props.state.activeCalcVersionKey)"
          >
            删除当前版本
          </el-button>
        </div>
      </div>

      <div v-if="calcMode === 'single'" class="calc-section">
        <div class="calc-title">调整科目（元）</div>
        <div v-if="!(props.calcEditableFields || []).length" class="calc-empty">
          暂无可调整科目
        </div>
        <div
          v-for="field in props.calcEditableFields"
          :key="`field_${field.id}`"
          class="calc-row"
        >
          <label>{{ field.label }}</label>
          <el-input
            size="small"
            :model-value="props.state.calcDraftValues[field.id]"
            @update:model-value="onCalcFieldInput(field.id, $event)"
          />
        </div>
      </div>

      <div v-else class="calc-section calc-mix-section">
        <div class="calc-title">销量MIX</div>
        <div class="calc-mix-summary">
          <div class="calc-mix-summary-item" :class="mixRatioStatusClass">
            <span>MIX合计</span>
            <b>{{ mixSumText }}</b>
          </div>
          <div class="calc-mix-summary-item">
            <span>销量合计</span>
            <b>{{ adjustedVolumeTotalText }} / {{ formatPlainNumber(baseMixTotalVolume) }}</b>
          </div>
        </div>
        <div class="calc-mix-actions">
          <el-button size="small" @click="normalizeMixRows">归一</el-button>
          <el-button size="small" @click="resetMixRows">重置</el-button>
        </div>
        <div v-if="!mixRows.length" class="calc-empty">
          暂无可调整版型
        </div>
        <div v-else class="calc-mix-input-list">
          <div class="calc-mix-input-head">
            <span>版型</span>
            <span>MIX</span>
            <span>销量</span>
          </div>
          <div
            v-for="row in mixRows"
            :key="`mix_input_${row.trimIndex}_${row.trimName}`"
            class="calc-mix-input-row"
          >
            <label :title="row.trimName">{{ row.trimName }}</label>
            <el-input
              :model-value="row.adjustedMixInput"
              size="small"
              @update:model-value="onMixRowInput(row, 'mix', $event)"
            >
              <template #append>%</template>
            </el-input>
            <el-input
              :model-value="row.adjustedVolumeInput"
              size="small"
              @update:model-value="onMixRowInput(row, 'volume', $event)"
            />
          </div>
        </div>
      </div>

      <div class="calc-section">
        <el-button size="small" type="primary" style="width: 100%" @click="runCalc">
          重新测算
        </el-button>
      </div>

      <div class="calc-section calc-result-section">
        <div class="calc-result-group">
          <div class="calc-result-title">单车收益（元）</div>
          <div class="calc-result-grid">
            <div class="calc-result-item">
              <span>边际贡献</span>
              <b>{{ calcMetricText('margin') }}</b>
            </div>
            <div class="calc-result-item">
              <span>边际贡献率</span>
              <b>{{ calcMetricText('margin_rate') }}</b>
            </div>
            <div class="calc-result-item">
              <span>营业利润</span>
              <b>{{ calcMetricText('op_profit') }}</b>
            </div>
            <div class="calc-result-item">
              <span>营业利润率</span>
              <b>{{ calcMetricText('op_rate') }}</b>
            </div>
          </div>
        </div>
        <div class="calc-result-group calc-result-project">
          <div class="calc-result-title">项目利润（万元）</div>
          <div class="calc-result-grid">
            <div class="calc-result-item">
              <span>销售收入</span>
              <b>{{ calcMetricText('proj_rev') }}</b>
            </div>
            <div class="calc-result-item">
              <span>边际贡献</span>
              <b>{{ calcMetricText('proj_margin') }}</b>
            </div>
            <div class="calc-result-item">
              <span>营业利润</span>
              <b>{{ calcMetricText('proj_profit') }}</b>
            </div>
          </div>
        </div>
      </div>

      <div class="calc-section">
        <el-button size="small" style="width: 100%" @click="applyCalcToMatrix">
          保存为测算版本
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/* eslint-disable vue/no-mutating-props */
import { ref, computed, watch, type PropType } from 'vue';
import { BaseToast } from '@/components/base/BaseToast';
import {
  REVENUE_MODULE_CODE,
  REVENUE_VALUE_SOURCE,
} from '@/pages/revenue/subtable-workbench/domain-config';
import { applyRevenueFormulasToDetail, REVENUE_FORMULA_CALCULATION_MODE } from '@/pages/revenue/subtable-workbench/formula-engine';
import { isForcedRatioAggregateRow, REVENUE_ROW_KIND } from '@/pages/revenue/subtable-workbench/matrix-utils';

// ==================== Constants ====================
const CALC_RESULT_METRIC_META: Record<string, { unit: string }> = Object.freeze({
  margin: { unit: '元' },
  margin_rate: { unit: '%' },
  op_profit: { unit: '元' },
  op_rate: { unit: '%' },
  proj_rev: { unit: '万元' },
  proj_margin: { unit: '万元' },
  proj_profit: { unit: '万元' },
});

const MIX_TOLERANCE = 0.0001;

/** MIX 比率行：与主表公式引擎 reviewResolveRatioComponentsByAlias 一致的分子/分母别名 */
const MIX_RATIO_ALIAS_MAP: Record<
  string,
  { numeratorId: string; denominatorId: string; numeratorName: string; denominatorName: string }
> = Object.freeze({
  margin_rate: {
    numeratorId: 'margin',
    denominatorId: 'revenue',
    numeratorName: '边际贡献',
    denominatorName: '销售收入',
  },
  op_rate: {
    numeratorId: 'op_profit',
    denominatorId: 'revenue',
    numeratorName: '营业利润',
    denominatorName: '销售收入',
  },
});

// ==================== Props / Emits ====================
interface TrimItem {
  trimIndex: number;
  trimName: string;
  baseVolume: number;
  baseMix: number;
  adjustedMixValue: number;
  adjustedMixInput: string;
  adjustedVolumeValue: number;
  adjustedVolumeInput: string;
  locked: boolean;
  [key: string]: any;
}

 
interface CalcVersion {
  key: string;
  label: string;
  values?: Record<string, any>;
  calcMode?: string;
  mixScenario?: Record<string, any>;
  [key: string]: any;
}

// 运行时声明 props，与 Vue2 版 OnsiteCalculatorDrawer 对齐（避免 type-only 导致 v-model/visible 失效）
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: Boolean,
    default: undefined,
  },
  size: {
    type: String,
    default: '460px',
  },
  state: {
    type: Object as PropType<Record<string, any>>,
    required: true,
  },
  allVersions: {
    type: Array as PropType<Array<{ key: string; label: string; group?: string; [key: string]: any }>>,
    default: () => [],
  },
  calcBaseYearOptions: {
    type: Array as PropType<Array<{ value: string | number; label: string }>>,
    default: () => [],
  },
  calcEditableFields: {
    type: Array as PropType<Array<{ id: string; label: string; [key: string]: any }>>,
    default: () => [],
  },
  subjects: {
    type: Array as PropType<Array<{ group?: string; name?: string; unit?: string; items?: any[]; [key: string]: any }>>,
    default: () => [],
  },
  dimensions: {
    type: Object as PropType<{ years?: string[]; trims?: string[] }>,
    default: () => ({ years: [], trims: [] }),
  },
  defaultTrimIndex: {
    type: Number,
    default: 0,
  },
  buildBaseSnapshot: {
    type: Function as PropType<(versionKey?: string, yearIndex?: number | string) => Record<string, any>>,
    required: true,
  },
  computeCalcValues: {
    type: Function as PropType<(merged: Record<string, any>) => Record<string, any>>,
    required: true,
  },
  getVersionValue: {
    type: Function as PropType<(...args: any[]) => any>,
    required: true,
  },
  formatNumber: {
    type: Function as PropType<(value: any, item?: any) => string>,
    required: true,
  },
  safeNumber: {
    type: Function as PropType<(value: any) => number | null>,
    required: true,
  },
  cloneValue: {
    type: Function as PropType<(value: any) => any>,
    required: true,
  },
  resolveCalcSubjectPath: {
    type: Function as PropType<(item: any, group: any) => string>,
    required: true,
  },
  resolveCalcSubjectMeta: {
    type: Function as PropType<(item: any, group: any) => Record<string, any>>,
    required: true,
  },
  ensureStateAfterVersionChange: {
    type: Function as PropType<() => void>,
    required: true,
  },
  persistDraft: {
    type: Function as PropType<() => Promise<any> | any>,
    required: true,
  },
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:visible': [value: boolean];
}>();

// ==================== State ====================
const calcMode = ref<string>('single');
const calcVersionNameInput = ref<string>('');
const calcResult = ref<Record<string, any>>({});
const mixInputMode = ref<string>('mix');
const mixLockTotalVolume = ref<boolean>(true);
const mixRows = ref<TrimItem[]>([]);
const mixTotalVolumeInput = ref<string>('');

// Vue2 使用 :visible.sync；Vue3 使用 v-model:visible，同时兼容 v-model(modelValue)
const drawerVisible = computed({
  get: () => {
    if (props.modelValue !== undefined) return Boolean(props.modelValue);
    return Boolean(props.visible);
  },
  set: (value: boolean) => {
    emit('update:visible', value);
    emit('update:modelValue', value);
  },
});

// ==================== Computed ====================
const baseMixTotalVolume = computed(() => {
  return mixRows.value.reduce((sum: number, row: TrimItem) => sum + toFiniteNumber(row.baseVolume), 0);
});

const adjustedVolumeTotal = computed(() => {
  return mixRows.value.reduce((sum: number, row: TrimItem) => sum + getAdjustedVolume(row), 0);
});

const adjustedMixSum = computed(() => {
  return mixRows.value.reduce((sum: number, row: TrimItem) => sum + getAdjustedMix(row), 0);
});

const mixSumText = computed(() => {
  return formatPercent(adjustedMixSum.value);
});

const adjustedVolumeTotalText = computed(() => {
  return formatPlainNumber(adjustedVolumeTotal.value);
});

const mixRatioStatusClass = computed(() => {
  return Math.abs(adjustedMixSum.value - 1) <= MIX_TOLERANCE ? 'is-ok' : 'is-warning';
});

// ==================== Watch ====================
watch(
  drawerVisible,
  (value) => {
    if (value) {
      initializeDrawer();
    }
  },
);

// ==================== Utility Methods ====================
const safeText = (value: any, fallback: any = ''): string => {
  const text = String(value == null ? '' : value).trim();
  return text || String(fallback == null ? '' : fallback);
};

const clone = (value: any): any => {
  return props.cloneValue(value);
};

const roundNumber = (value: any, precision = 4): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const base = Math.pow(10, precision);
  return Math.round(num * base) / base;
};

const toFiniteNumber = (value: any): number => {
  const num = props.safeNumber(value);
  return num == null ? 0 : num;
};

const parseVolumeInput = (value: any): number => {
  const num = props.safeNumber(value);
  return num == null ? 0 : num;
};

const parseMixInput = (value: any): number => {
  const text = safeText(value);
  if (!text) return 0;
  const num = Number(text.replace(/,/g, '').replace(/[%％]/g, ''));
  if (!Number.isFinite(num)) return 0;
  return num / 100;
};

const formatPlainNumber = (value: any, precision = 2): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num));
  const base = Math.pow(10, precision);
  return String(Math.round(num * base) / base);
};

const formatPercent = (value: any, precision = 2): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${formatPlainNumber(num * 100, precision)}%`;
};

const formatPercentInput = (value: any): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return formatPlainNumber(num * 100, 2);
};

const findCalcVersionByKey = (key: string): CalcVersion | undefined => {
  const expected = safeText(key);
  return (props.state.calcVersions || []).find((item: any) => item && item.key === expected);
};

const ensureState = () => {
  props.ensureStateAfterVersionChange();
};

const getDefaultCalcBaseVersion = (): string => {
  const baseline = safeText(props.state.baselineVersion);
  if (baseline) return baseline;
  const baselineOption = (props.allVersions || []).find((item: any) => item && item.group === 'baseline');
  return safeText(baselineOption && baselineOption.key, 'brand');
};

const getCalcBaseVersion = (): string => {
  return safeText(props.state.calcBaseVersion, getDefaultCalcBaseVersion());
};

const isSubtotalTrimLabel = (value: any): boolean => {
  const text = safeText(value);
  return text === '小计' || text === '合计';
};

const getTrimIndexesForMix = (): number[] => {
  const trims: string[] = Array.isArray(props.dimensions?.trims) ? props.dimensions!.trims : [];
  if (!trims.length) return [];
  if (trims.length === 1) return [0];
  return trims
    .map((item: string, index: number) => ({ item, index }))
    .filter(({ item, index }: { item: string; index: number }) => index !== props.defaultTrimIndex && !isSubtotalTrimLabel(item))
    .map(({ index }: { index: number }) => index);
};

const getSubjectKeys = (itemOrId: any): string[] => {
  const keys: string[] = [];
  const push = (value: any) => {
    const key = safeText(value);
    if (key && !keys.includes(key)) keys.push(key);
  };
  if (itemOrId && typeof itemOrId === 'object') {
    push(itemOrId.subjectId);
    push(itemOrId.id);
    push(itemOrId.templateId);
    push(itemOrId.subjectCode);
  } else {
    push(itemOrId);
  }
  return keys;
};

const findSubjectByTemplateId = (templateId: string): { group: any; item: any } | null => {
  const expected = safeText(templateId);
  if (!expected) return null;
  for (let groupIndex = 0; groupIndex < (props.subjects || []).length; groupIndex += 1) {
    const group = (props.subjects || [])[groupIndex];
    const items: any[] = Array.isArray(group?.items) ? group.items! : [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (getSubjectKeys(item).includes(expected)) return { group, item };
    }
  }
  return null;
};

const getSubjectVersionNumber = (
  itemOrId: any,
  versionKey: string,
  trimIndex: number,
  yearIndex: number | string,
): number | null => {
  const value = props.getVersionValue(itemOrId, versionKey, trimIndex, yearIndex);
  const num = props.safeNumber(value);
  return num == null ? null : num;
};

// ==================== Drawer Lifecycle ====================
const initializeDrawer = () => {
  if (!props.state.calcBaseVersion) {
    props.state.calcBaseVersion = getDefaultCalcBaseVersion();
  }
  calcMode.value = props.state.calcMode === 'mix' ? 'mix' : 'single';
  mixInputMode.value = 'mix';
  mixLockTotalVolume.value = true;
  if (props.state.activeCalcVersionKey) {
    const active = findCalcVersionByKey(props.state.activeCalcVersionKey);
    if (active) {
      selectCalcVersion(active.key);
      return;
    }
  }
  initCalcDraftFromBase();
};

const onCalcBaseChange = () => {
  props.state.activeCalcVersionKey = '';
  calcVersionNameInput.value = '';
  initCalcDraftFromBase();
};

const onCalcModeChange = () => {
  props.state.calcMode = calcMode.value;
  props.state.activeCalcVersionKey = '';
  calcVersionNameInput.value = '';
  initCalcDraftFromBase();
};

const initCalcDraftFromBase = () => {
  if (calcMode.value === 'mix') {
    initMixRowsFromBase();
    runMixCalc(false);
    return;
  }
  const baseSnapshot = props.buildBaseSnapshot(getCalcBaseVersion(), props.state.calcBaseYear);
  const draft: Record<string, string> = {};
  props.calcEditableFields.forEach((field: any) => {
    const val = baseSnapshot[field.id];
    draft[field.id] = val == null ? '' : String(val);
  });
  props.state.calcDraftValues = draft;
  calcVersionNameInput.value = '';
  // 打开时先带出主表基准值；后续公式若写成 0，仍保留这份快照
  calcResult.value = { ...baseSnapshot };
  runSingleCalc();
};

const onCalcFieldInput = (fieldId: string, value: any) => {
  // Element Plus 可能传入原生事件；对齐 Vue2 仅写入实际输入值
  const next =
    value && typeof value === 'object' && 'target' in value
      ? (value as { target?: { value?: unknown } }).target?.value
      : value;
  if (!props.state.calcDraftValues || typeof props.state.calcDraftValues !== 'object') {
    props.state.calcDraftValues = {};
  }
  props.state.calcDraftValues[fieldId] = next;
};

const runSingleCalc = (): Record<string, any> => {
  const baseSnapshot = props.buildBaseSnapshot(getCalcBaseVersion(), props.state.calcBaseYear);
  const draftInput = props.state.calcDraftValues || {};
  const merged = { ...baseSnapshot };

  props.calcEditableFields.forEach((field: any) => {
    const raw = draftInput[field.id];
    if (String(raw).trim() === '') return;
    const num = props.safeNumber(raw);
    if (num != null) merged[field.id] = num;
  });

  const rawValues = props.computeCalcValues(merged) || {};
  // 公式写成 0 时保留主表快照，打开计算器即能看到基准边际贡献/利润
  const keptValues = keepSnapshotWhenFormulaZero(baseSnapshot, rawValues);
  const calcValues = fillSingleCalcRateMetrics(keptValues);
  calcResult.value = calcValues;
  return calcValues;
};

/** 公式结果为 0 / 空时，保留打开计算器时从主表带出的基准值 */
const keepSnapshotWhenFormulaZero = (
  snapshot: Record<string, any> = {},
  calcValues: Record<string, any> = {},
) => {
  const next = { ...(snapshot || {}), ...(calcValues || {}) };
  Object.keys(snapshot || {}).forEach((key) => {
    const seed = Number(snapshot[key]);
    const current = Number(next[key]);
    if (Number.isFinite(seed) && seed !== 0 && (!Number.isFinite(current) || current === 0)) {
      next[key] = snapshot[key];
    }
  });
  return next;
};

/** 单值测算：对齐 Vue2 公式补比率和项目利润 */
const fillSingleCalcRateMetrics = (values: Record<string, any> = {}) => {
  const next = { ...(values || {}) };
  const toNum = (value: any): number | null => {
    const num = Number(value);
    return Number.isFinite(num) && num !== 0 ? num : null;
  };
  let revenue = toNum(next.revenue);
  if (revenue == null && toNum(next.dealer) != null) revenue = Number(next.dealer) / 1.13;
  if (revenue == null && toNum(next.tp) != null) revenue = Number(next.tp) / 1.13;
  const margin = Number(next.margin);
  const opProfit = Number(next.op_profit);
  if (revenue != null) {
    if (Number.isFinite(margin)) next.margin_rate = margin / revenue;
    if (Number.isFinite(opProfit)) next.op_rate = opProfit / revenue;
    next.revenue = revenue;
  }
  const volume = toNum(next.proj_vol);
  if (volume != null) {
    if (revenue != null) next.proj_rev = revenue * volume;
    if (Number.isFinite(margin)) next.proj_margin = margin * volume;
    if (Number.isFinite(opProfit)) next.proj_profit = opProfit * volume;
  }
  return next;
};

/** 锁定的销量合计：优先手工合计，否则用基准销量合计 */
const getLockedMixTotalVolume = (): number => {
  const fromInput = parseVolumeInput(mixTotalVolumeInput.value);
  if (fromInput > 0) return fromInput;
  return toFiniteNumber(baseMixTotalVolume.value);
};

/**
 * MIX 测算使用的销量合计。
 * 基准销量为 0 时，不能再用基准合计做分母（否则销量录入会清空 MIX，测算也会误报合计为 0）。
 */
const getMixTotalVolume = (): number => {
  const locked = getLockedMixTotalVolume();
  if (locked > 0) return locked;
  return mixRows.value.reduce((sum: number, row: TrimItem) => sum + getAdjustedVolume(row), 0);
};

/** 按当前各版型销量重算 MIX，保证合计为 100% */
const syncMixFromAdjustedVolumes = () => {
  const total = mixRows.value.reduce(
    (sum: number, row: TrimItem) => sum + getAdjustedVolume(row),
    0,
  );
  mixRows.value.forEach((row: TrimItem) => {
    const volume = getAdjustedVolume(row);
    const mix = total > 0 ? volume / total : 0;
    row.adjustedVolumeValue = volume;
    row.adjustedMixValue = mix;
    row.adjustedMixInput = total > 0 ? formatPercentInput(mix) : '';
  });
};

const initMixRowsFromBase = () => {
  const versionKey = getCalcBaseVersion();
  const yearIndex = props.state.calcBaseYear;
  const trims: string[] = Array.isArray(props.dimensions?.trims) ? props.dimensions!.trims : [];
  const trimIndexes = getTrimIndexesForMix();
  const volumeSubject = findSubjectByTemplateId('proj_vol');
  const mixSubject = findSubjectByTemplateId('mix');
  const rows: TrimItem[] = trimIndexes.map((trimIndex: number) => {
    const volume = getSubjectVersionNumber(
      volumeSubject && volumeSubject.item ? volumeSubject.item : 'proj_vol',
      versionKey,
      trimIndex,
      yearIndex,
    );
    const rawMix = getSubjectVersionNumber(
      mixSubject && mixSubject.item ? mixSubject.item : 'mix',
      versionKey,
      trimIndex,
      yearIndex,
    );
    return {
      trimIndex,
      trimName: safeText(trims[trimIndex], `版型${trimIndex + 1}`),
      baseVolume: volume == null ? 0 : volume,
      baseMix: rawMix == null ? null as any : rawMix,
      adjustedMixValue: 0,
      adjustedMixInput: '',
      adjustedVolumeValue: 0,
      adjustedVolumeInput: '',
      locked: false,
    };
  });
  const total = rows.reduce((sum: number, row: any) => sum + toFiniteNumber(row.baseVolume), 0);
  rows.forEach((row: any) => {
    const fallbackMix = total > 0 ? row.baseVolume / total : 0;
    row.baseMix = row.baseMix == null ? fallbackMix : row.baseMix;
    row.adjustedMixValue = row.baseMix;
    row.adjustedMixInput = formatPercentInput(row.baseMix);
    row.adjustedVolumeValue = row.baseVolume;
    row.adjustedVolumeInput = formatPlainNumber(row.baseVolume);
  });
  mixRows.value = rows;
  mixTotalVolumeInput.value = formatPlainNumber(total);
  props.state.mixInputMode = 'mix';
  props.state.mixLockTotalVolume = mixLockTotalVolume.value;
};

const restoreMixScenario = (scenario: Record<string, any> = {}) => {
  const rows = Array.isArray(scenario.rows) ? scenario.rows : [];
  if (scenario.baseVersion) {
    props.state.calcBaseVersion = scenario.baseVersion;
  }
  if (scenario.baseYear != null) {
    props.state.calcBaseYear = scenario.baseYear;
  }
  mixInputMode.value = 'mix';
  mixLockTotalVolume.value = true;
  mixTotalVolumeInput.value = safeText(scenario.totalVolume, '');
  mixRows.value = rows.map((row: any, index: number) => {
    const baseMix = Number(row.baseMix);
    const adjustedMix = Number(row.adjustedMix);
    const baseVolume = Number(row.baseVolume);
    const adjustedVolume = Number(row.adjustedVolume);
    return {
      trimIndex: Number.isInteger(Number(row.trimIndex)) ? Number(row.trimIndex) : index,
      trimName: safeText(row.trimName, `版型${index + 1}`),
      baseVolume: Number.isFinite(baseVolume) ? baseVolume : 0,
      baseMix: Number.isFinite(baseMix) ? baseMix : 0,
      adjustedMixValue: Number.isFinite(adjustedMix) ? adjustedMix : 0,
      adjustedMixInput: Number.isFinite(adjustedMix) ? formatPercentInput(adjustedMix) : '',
      adjustedVolumeValue: Number.isFinite(adjustedVolume) ? adjustedVolume : 0,
      adjustedVolumeInput: Number.isFinite(adjustedVolume) ? formatPlainNumber(adjustedVolume) : '',
      locked: false,
    };
  });
  if (!mixTotalVolumeInput.value) {
    mixTotalVolumeInput.value = formatPlainNumber(baseMixTotalVolume.value);
  }
  props.state.mixInputMode = 'mix';
  props.state.mixLockTotalVolume = mixLockTotalVolume.value;
};

const getAdjustedMix = (row: TrimItem): number => {
  const value = Number(row && row.adjustedMixValue);
  return Number.isFinite(value) ? value : parseMixInput(row && row.adjustedMixInput);
};

const getAdjustedVolume = (row: TrimItem): number => {
  const value = Number(row && row.adjustedVolumeValue);
  return Number.isFinite(value) ? value : parseVolumeInput(row && row.adjustedVolumeInput);
};

const syncVolumeInputsFromMix = () => {
  const total = getMixTotalVolume();
  mixRows.value.forEach((row: TrimItem) => {
    const mix = parseMixInput(row.adjustedMixInput);
    const volume = total * mix;
    row.adjustedMixValue = mix;
    row.adjustedVolumeValue = volume;
    row.adjustedVolumeInput = formatPlainNumber(volume);
  });
};

const syncMixInputsFromVolume = () => {
  const total = getMixTotalVolume();
  mixRows.value.forEach((row: TrimItem) => {
    const volume = parseVolumeInput(row.adjustedVolumeInput);
    const mix = total > 0 ? volume / total : 0;
    row.adjustedVolumeValue = volume;
    row.adjustedMixValue = mix;
    row.adjustedMixInput = total > 0 ? formatPercentInput(mix) : '';
  });
};

const _onMixInputModeChange = () => {
  mixInputMode.value = 'mix';
  syncVolumeInputsFromMix();
  props.state.mixInputMode = 'mix';
};

const _onMixTotalModeChange = () => {
  props.state.mixLockTotalVolume = mixLockTotalVolume.value;
  if (!mixLockTotalVolume.value && !mixTotalVolumeInput.value) {
    mixTotalVolumeInput.value = formatPlainNumber(baseMixTotalVolume.value);
  }
  if (mixInputMode.value === 'mix') syncVolumeInputsFromMix();
  if (mixInputMode.value === 'volume') syncMixInputsFromVolume();
};

const _onMixTotalVolumeInput = () => {
  if (mixInputMode.value === 'mix') syncVolumeInputsFromMix();
};

const _onMixRowLockChange = () => {
  syncVolumeInputsFromMix();
};

const onMixRowInput = (row: TrimItem, field: string, value: any) => {
  if (field === 'mix') {
    row.adjustedMixInput = value;
    const mix = parseMixInput(value);
    const volume = getMixTotalVolume() * mix;
    row.adjustedMixValue = mix;
    row.adjustedVolumeValue = volume;
    row.adjustedVolumeInput = formatPlainNumber(volume);
    return;
  }
  row.adjustedVolumeInput = value;
  row.adjustedVolumeValue = parseVolumeInput(value);
  const lockedTotal = getLockedMixTotalVolume();
  if (lockedTotal > 0) {
    // 与 Vue2 一致：相对锁定/基准销量合计，只换算当前行 MIX
    const mix = row.adjustedVolumeValue / lockedTotal;
    row.adjustedMixValue = mix;
    row.adjustedMixInput = formatPercentInput(mix);
    return;
  }
  // 基准销量为 0：按当前销量份额同步全部 MIX，避免对应 MIX 被清空
  syncMixFromAdjustedVolumes();
};

const getUnlockedRows = (): TrimItem[] => {
  return mixRows.value.filter((row: TrimItem) => !row.locked);
};

const _fillMixRemainder = () => {
  const unlocked = getUnlockedRows();
  if (!unlocked.length) return;
  const lockedSum = mixRows.value
    .filter((row: TrimItem) => row.locked)
    .reduce((sum: number, row: TrimItem) => sum + parseMixInput(row.adjustedMixInput), 0);
  const keepSum = unlocked
    .slice(0, -1)
    .reduce((sum: number, row: TrimItem) => sum + parseMixInput(row.adjustedMixInput), 0);
  const target = Math.max(0, 1 - lockedSum - keepSum);
  const last = unlocked[unlocked.length - 1];
  last.adjustedMixInput = formatPercentInput(target);
  syncVolumeInputsFromMix();
};

const normalizeMixRows = () => {
  const unlocked = getUnlockedRows();
  if (!unlocked.length) return;
  const lockedSum = mixRows.value
    .filter((row: TrimItem) => row.locked)
    .reduce((sum: number, row: TrimItem) => sum + parseMixInput(row.adjustedMixInput), 0);
  const target = Math.max(0, 1 - lockedSum);
  const current = unlocked.reduce((sum: number, row: TrimItem) => sum + parseMixInput(row.adjustedMixInput), 0);
  const base = unlocked.reduce((sum: number, row: TrimItem) => sum + Number(row.baseMix || 0), 0);
  unlocked.forEach((row: TrimItem) => {
    const ratio =
      current > 0
        ? parseMixInput(row.adjustedMixInput) / current
        : base > 0
          ? Number(row.baseMix || 0) / base
          : 1 / unlocked.length;
    row.adjustedMixInput = formatPercentInput(target * ratio);
  });
  syncVolumeInputsFromMix();
};

const resetMixRows = () => {
  mixRows.value.forEach((row: TrimItem) => {
    row.adjustedMixValue = row.baseMix;
    row.adjustedMixInput = formatPercentInput(row.baseMix);
    row.adjustedVolumeValue = row.baseVolume;
    row.adjustedVolumeInput = formatPlainNumber(row.baseVolume);
    row.locked = false;
  });
  mixTotalVolumeInput.value = formatPlainNumber(baseMixTotalVolume.value);
};

 
const validateMixInput = (showMessage = true): boolean => {
  if (!mixRows.value.length) {
    if (showMessage) BaseToast.warning('暂无可调整版型');
    return false;
  }
  const total = getMixTotalVolume();
  if (total <= 0) {
    if (showMessage) BaseToast.warning('销量合计必须大于 0');
    return false;
  }
  if (Math.abs(adjustedMixSum.value - 1) > MIX_TOLERANCE) {
    if (showMessage) BaseToast.warning('调整MIX合计需等于 100%');
    return false;
  }
  return true;
};

const normalizePath = (value: any): string => {
  return safeText(value)
    .replace(/\s+/g, '')
    .toLowerCase();
};

const buildMixFormulaDetail = (adjustedRows: any[] = []): any => {
  const year = '现场测算';
  const rows: any[] = [];
  props.subjects.forEach((group: any) => {
    const groupName = safeText(group && (group.group || group.name));
    (group.items || []).forEach((item: any) => {
      const templateId = safeText(item && (item.templateId || item.id));
      const subjectId = safeText(item && item.subjectId);
      const subjectName = safeText(item && item.name).replace(/^[\s\u3000]+/, '');
      const subjectPath = props.resolveCalcSubjectPath(item, group);
      const meta = props.resolveCalcSubjectMeta(item, group);
      const resolvedFormulaExpression = safeText(
        (meta && meta.formulaExpression) ||
          (item && (item.formulaExpression || item.expression)),
      );
      const resolvedEntryMode = safeText(
        (meta && meta.entryMode) ||
          (item && (item.entryMode || item.templateEntryMode)) ||
          (resolvedFormulaExpression ? 'CALCULATED' : ''),
      );
      const rowKind = safeText(
        item && (item.rowKind || item.rowType),
        resolvedEntryMode === 'CALCULATED' || meta.formulaKey || resolvedFormulaExpression
          ? meta.rowKind || REVENUE_ROW_KIND.FORMULA
          : REVENUE_ROW_KIND.INPUT,
      );
      const cells: Record<string, any> = {};
      const cellMap: Record<string, any> = {};
      adjustedRows.forEach((mixRow: any, trimOrder: number) => {
        const cellKey = `y0_t${trimOrder}`;
        let value = getSubjectVersionNumber(item, getCalcBaseVersion(), mixRow.trimIndex, props.state.calcBaseYear);
        if (value == null) {
          value = getSubjectVersionNumber(item, getCalcBaseVersion(), props.defaultTrimIndex, props.state.calcBaseYear);
        }
        if (templateId === 'proj_vol') value = mixRow.adjustedVolume;
        if (templateId === 'mix') value = mixRow.adjustedMix;
        cells[cellKey] = value == null ? '' : value;
        cellMap[`${year}__${mixRow.trimId}`] = cells[cellKey];
        cellMap[`${year}__${mixRow.trimName}`] = cells[cellKey];
      });
      rows.push({
        ...item,
        id: subjectId || templateId,
        rowId: subjectId || templateId,
        templateId,
        subjectId,
        subjectCode: safeText(item && item.subjectCode),
        subject: subjectName,
        subjectName,
        subjectPath,
        fullNamePath: subjectPath,
        rootSubjectName: groupName,
        subtable: '主表',
        moduleCode: REVENUE_MODULE_CODE.MAIN_PNL,
        rowKind,
        valueSource: safeText(
          item && (item.valueSource || item.sourceType),
          rowKind === REVENUE_ROW_KIND.INPUT ? REVENUE_VALUE_SOURCE.INPUT : meta.valueSource,
        ),
        inputType: safeText(item && item.inputType),
        unit: safeText(item && item.unit, group && group.unit),
        entryMode: resolvedEntryMode,
        templateEntryMode: safeText(
          (meta && meta.templateEntryMode) ||
            resolvedEntryMode ||
            (item && (item.templateEntryMode || item.entryMode)),
        ),
        formulaId: (meta && meta.formulaId) || (item && item.formulaId),
        formulaKey: safeText(
          (meta && meta.formulaKey) || (item && (item.formulaKey || item.formulaCode)),
        ),
        formulaCode: safeText(
          (meta && meta.formulaCode) || (item && (item.formulaCode || item.formulaKey)),
        ),
        formulaName: safeText((meta && meta.formulaName) || (item && item.formulaName)),
        formulaExpression: resolvedFormulaExpression,
        formulaParamBindings: (() => {
          const candidates = [
            meta && meta.formulaParamBindings,
            item && item.formulaParamBindings,
          ];
          for (let index = 0; index < candidates.length; index += 1) {
            const value = candidates[index];
            if (Array.isArray(value) && value.length) return value;
            if (typeof value === 'string' && value.trim()) return value;
          }
          return Array.isArray(candidates[0])
            ? candidates[0]
            : Array.isArray(candidates[1])
              ? candidates[1]
              : [];
        })(),
        aggregateFormula: safeText(
          (meta && meta.aggregateFormula) || (item && item.aggregateFormula),
        ),
        ratioNumeratorPath: safeText(
          (meta && meta.ratioNumeratorPath) || (item && item.ratioNumeratorPath),
        ),
        ratioDenominatorPath: safeText(
          (meta && meta.ratioDenominatorPath) || (item && item.ratioDenominatorPath),
        ),
        formulaMeta: meta,
        cells,
        cellMap,
      });
    });
  });
  return {
    dimensions: {
      years: [year],
      trims: adjustedRows.map((row: any) => ({
        trimId: row.trimId,
        trimName: row.trimName,
        name: row.trimName,
      })),
    },
    rows,
  };
};

const readFormulaRowCell = (row: any, trimOrder: number): number | null => {
  const cells = row && row.cells && typeof row.cells === 'object' ? row.cells : {};
  const value = cells[`y0_t${trimOrder}`];
  const num = props.safeNumber(value);
  return num == null ? null : num;
};

const resolveAggregateFormula = (row: Record<string, any> = {}): string => {
  // 与主表年小计一致：单车边际贡献率 / 营业利润率强制按「分子合计/分母合计」
  if (isForcedRatioAggregateRow(row)) return 'ratio';
  const formula = safeText(row.aggregateFormula).toLowerCase();
  if (formula) return formula;
  if (safeText(row.unit) === '%') return 'weighted_by_mix';
  return 'sum';
};

const findFormulaRowByPath = (rows: any[] = [], path = ''): any | null => {
  const expected = normalizePath(path);
  if (!expected) return null;
  let fallback: any = null;
  rows.forEach((row: any) => {
    const rowPath = normalizePath(row && (row.subjectPath || row.fullNamePath));
    if (rowPath === expected) fallback = row;
    if (!fallback && (rowPath.endsWith(expected) || expected.endsWith(rowPath))) {
      fallback = row;
    }
  });
  return fallback;
};

const resolveMixRatioAlias = (row: Record<string, any> = {}) => {
  const key = safeText(row && row.templateId).toLowerCase();
  if (MIX_RATIO_ALIAS_MAP[key]) return MIX_RATIO_ALIAS_MAP[key];
  const name = safeText(row && (row.subjectName || row.subject))
    .replace(/^[\s\u3000]+/, '')
    .replace(/[（()）]/g, '')
    .replace(/[%％]/g, '');
  if (name === '边际贡献率') return MIX_RATIO_ALIAS_MAP.margin_rate;
  if (name === '营业利润率') return MIX_RATIO_ALIAS_MAP.op_rate;
  return null;
};

/** 优先匹配「单车收益」分组，避免项目利润同名科目抢键 */
const findMixFormulaRowByTemplateId = (
  rows: any[] = [],
  templateId = '',
  subjectName = '',
): any | null => {
  const expectedId = safeText(templateId).toLowerCase();
  const expectedName = safeText(subjectName)
    .replace(/^[\s\u3000]+/, '')
    .replace(/[（()）]/g, '')
    .replace(/[%％]/g, '');
  let fallback: any = null;
  let preferred: any = null;
  rows.forEach((row: any) => {
    const id = safeText(row && row.templateId).toLowerCase();
    const name = safeText(row && (row.subjectName || row.subject))
      .replace(/^[\s\u3000]+/, '')
      .replace(/[（()）]/g, '')
      .replace(/[%％]/g, '');
    const path = normalizePath(
      row && (row.subjectPath || row.fullNamePath || row.rootSubjectName),
    );
    const idMatch = expectedId && id === expectedId;
    const nameMatch = expectedName && name === expectedName;
    if (!idMatch && !nameMatch) return;
    fallback = row;
    if (path.includes('单车收益') || path.includes('单车')) {
      preferred = row;
    }
  });
  return preferred || fallback;
};

const resolveMixRatioComponentRows = (row: any, rows: any[] = []) => {
  let numeratorRow = findFormulaRowByPath(rows, row && row.ratioNumeratorPath);
  let denominatorRow = findFormulaRowByPath(rows, row && row.ratioDenominatorPath);
  if (numeratorRow && denominatorRow) {
    return { numeratorRow, denominatorRow };
  }
  const alias = resolveMixRatioAlias(row);
  if (!alias) return { numeratorRow, denominatorRow };
  if (!numeratorRow) {
    numeratorRow = findMixFormulaRowByTemplateId(rows, alias.numeratorId, alias.numeratorName);
  }
  if (!denominatorRow) {
    denominatorRow = findMixFormulaRowByTemplateId(
      rows,
      alias.denominatorId,
      alias.denominatorName,
    );
  }
  return { numeratorRow, denominatorRow };
};

const aggregateFormulaRow = (row: any, adjustedRows: any[] = []): number | null => {
  const formula = resolveAggregateFormula(row);
  if (safeText(row.templateId) === 'mix') {
    return adjustedRows.length ? 1 : null;
  }
  if (formula === 'ratio') return null;
  const values = adjustedRows.map((item: any, index: number) => ({
    value: readFormulaRowCell(row, index),
    mix: item.adjustedMix,
  }));
  const valid = values.filter((item: any) => item.value != null);
  if (!valid.length) return null;
  if (formula === 'weighted' || formula === 'weighted_by_mix' || formula === 'volume_weighted') {
    const total = valid.reduce((sum: number, item: any) => sum + item.value * item.mix, 0);
    return roundNumber(total, 4);
  }
  const total = valid.reduce((sum: number, item: any) => sum + item.value, 0);
  return roundNumber(total, 4);
};

const extractMixFormulaValues = (detail: any, adjustedRows: any[] = []): Record<string, any> => {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const result: Record<string, any> = {};
  rows.forEach((row: any) => {
    const key = safeText(row && row.templateId);
    if (!key) return;
    const formula = resolveAggregateFormula(row);
    if (formula === 'ratio') return;
    const value = aggregateFormulaRow(row, adjustedRows);
    if (value != null) result[key] = value;
  });
  rows.forEach((row: any) => {
    const key = safeText(row && row.templateId);
    if (!key || resolveAggregateFormula(row) !== 'ratio') return;
    const { numeratorRow, denominatorRow } = resolveMixRatioComponentRows(row, rows);
    const numeratorKey = safeText(numeratorRow && numeratorRow.templateId);
    const denominatorKey = safeText(denominatorRow && denominatorRow.templateId);
    const alias = resolveMixRatioAlias(row);
    const numerator =
      (numeratorKey ? result[numeratorKey] : null) ??
      (alias ? result[alias.numeratorId] : null);
    const denominator =
      (denominatorKey ? result[denominatorKey] : null) ??
      (alias ? result[alias.denominatorId] : null);
    if (denominator == null || Number(denominator) === 0 || numerator == null) return;
    result[key] = roundNumber(Number(numerator) / Number(denominator), 4);
  });
  return result;
};

const getAdjustedMixRowsForCalc = () => {
  return mixRows.value.map((row: TrimItem, index: number) => ({
    trimIndex: row.trimIndex,
    trimName: row.trimName,
    trimId: `mix_${index}`,
    baseVolume: row.baseVolume,
    baseMix: row.baseMix,
    adjustedMix: getAdjustedMix(row),
    adjustedVolume: getAdjustedVolume(row),
    locked: row.locked === true,
  }));
};

const runMixCalc = (showMessage = true): Record<string, any> | null => {
  if (!validateMixInput(showMessage)) return null;
  const adjustedRows = getAdjustedMixRowsForCalc();
  try {
    const detail = buildMixFormulaDetail(adjustedRows);
    applyRevenueFormulasToDetail(detail, {
      targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
      calculationMode: REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT,
      ignoreMissingFormulaBindings: true,
    });
    const result = extractMixFormulaValues(detail, adjustedRows);
    calcResult.value = result;
    return result;
  } catch (error) {
    console.warn('[meeting-review] mix calc formula failed:', error);
    if (showMessage) BaseToast.warning('销量MIX测算失败');
    return null;
  }
};

const runCalc = () => {
  return calcMode.value === 'mix' ? runMixCalc(true) : runSingleCalc();
};

const calcMetricText = (metricKey: string): string => {
  const item = CALC_RESULT_METRIC_META[metricKey] || {};
  const raw = calcResult.value ? calcResult.value[metricKey] : undefined;
  if (metricKey === 'margin_rate' || metricKey === 'op_rate') {
    const num = Number(raw);
    if (Number.isFinite(num)) return formatPercent(num);
  }
  return props.formatNumber(raw, item);
};

const createCalcVersionDraft = () => {
  props.state.activeCalcVersionKey = '';
  calcVersionNameInput.value = '';
  initCalcDraftFromBase();
};

const selectCalcVersion = (key: string) => {
  const version = findCalcVersionByKey(key);
  if (!version) return;
  props.state.activeCalcVersionKey = key;
  calcMode.value = version.calcMode === 'mix' ? 'mix' : 'single';
  props.state.calcMode = calcMode.value;
  calcVersionNameInput.value = version.label;

  if (calcMode.value === 'mix') {
    restoreMixScenario(version.mixScenario || {});
    calcResult.value = clone(version.values || {});
    if (!Object.keys(calcResult.value || {}).length) runMixCalc(false);
    return;
  }

  const draft: Record<string, string> = {};
  props.calcEditableFields.forEach((field: any) => {
    const value = version.values && version.values[field.id];
    draft[field.id] = value == null ? '' : String(value);
  });
  props.state.calcDraftValues = draft;
  calcResult.value = clone(version.values || {});
  if (!Object.keys(calcResult.value || {}).length) runSingleCalc();
};

const removeCalcVersion = async (key: string) => {
  if (!key) return;
  const list = props.state.calcVersions || [];
  props.state.calcVersions = list.filter((item: CalcVersion) => item.key !== key);
  props.state.compareVersions = (props.state.compareVersions || []).filter((item: string) => item !== key);

  if (props.state.baselineVersion === key) {
    props.state.baselineVersion = 'brand';
  }
  if (props.state.decisionSource === key) {
    props.state.decisionSource = 'finance';
  }
  if (props.state.activeCalcVersionKey === key) {
    props.state.activeCalcVersionKey = '';
    calcVersionNameInput.value = '';
  }

  initCalcDraftFromBase();
  ensureState();
  await props.persistDraft();
};

const buildMixScenarioPayload = (): Record<string, any> => {
  return {
    inputMode: 'mix',
    lockTotalVolume: true,
    baseVersion: getCalcBaseVersion(),
    baseYear: props.state.calcBaseYear,
    totalVolume: getMixTotalVolume(),
    rows: getAdjustedMixRowsForCalc(),
  };
};

const buildCalcVersionPayload = (key: string, label: string, values: Record<string, any>): Record<string, any> => {
  const payload: Record<string, any> = {
    key,
    label,
    dot: 'calc',
    group: 'calc',
    values: clone(values),
    calcMode: calcMode.value,
  };
  if (calcMode.value === 'mix') {
    payload.mixScenario = buildMixScenarioPayload();
  }
  return payload;
};

const applyCalcToMatrix = async () => {
  const calcValues = runCalc();
  if (!calcValues) {
    BaseToast.warning('请先完成测算');
    return;
  }

  const currentKey = safeText(props.state.activeCalcVersionKey);
  const customLabel = safeText(calcVersionNameInput.value);

  if (currentKey) {
    const item = findCalcVersionByKey(currentKey);
    if (!item) return;
    const next = buildCalcVersionPayload(currentKey, customLabel || item.label, calcValues);
    Object.keys(next).forEach((prop: string) => {
      (item as any)[prop] = next[prop];
    });
  } else {
    const nextSeed = Number(props.state.calcVersionSeed || 0) + 1;
    props.state.calcVersionSeed = nextSeed;
    const key = `calc_v${nextSeed}`;
    const label = customLabel || `测算值v${nextSeed}`;
    props.state.calcVersions.push(buildCalcVersionPayload(key, label, calcValues));
    props.state.activeCalcVersionKey = key;
    calcVersionNameInput.value = label;
  }

  if (
    props.state.activeCalcVersionKey &&
    props.state.activeCalcVersionKey !== props.state.baselineVersion &&
    !props.state.compareVersions.includes(props.state.activeCalcVersionKey)
  ) {
    props.state.compareVersions.push(props.state.activeCalcVersionKey);
  }

  ensureState();
  const response = await props.persistDraft();
  if (response && response.ok) {
    BaseToast.success('测算版本已保存');
  } else {
    BaseToast.warning((response && response.message) || '测算版本已在当前页面更新，草稿保存失败');
  }
};

void _onMixInputModeChange;
void _onMixTotalModeChange;
void _onMixTotalVolumeInput;
void _onMixRowLockChange;
void _fillMixRemainder;
</script>

<style lang="scss">
.meeting-review-calc-drawer {
  z-index: 3100 !important;
  background: #fafaf9;
  color: #0c0a09;

  .el-drawer__header {
    margin-bottom: 0;
    padding: 14px 16px;
    border-bottom: 1px solid #e7e5e4;
    background: #fff;
    color: #0c0a09;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .el-drawer__body {
    padding: 0;
    background: #fafaf9;
  }

  .calc-body {
    padding: 12px;
  }

  .calc-section {
    border: 1px solid #e7e5e4;
    border-radius: 6px;
    background: #fff;
    padding: 10px;
    margin-bottom: 10px;
    box-shadow: 0 0 0 1px rgba(12, 10, 9, 0.03);
  }

  .calc-base-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .calc-base-label {
    margin-bottom: 6px;
    color: #78716c;
    font-size: 11px;
    font-weight: 700;
  }

  .calc-title {
    margin-bottom: 8px;
    font-size: 12px;
    color: #78716c;
    text-transform: uppercase;
    letter-spacing: 0;
    font-weight: 700;
  }

  .calc-empty {
    border: 1px dashed #d6d3d1;
    border-radius: 6px;
    color: #a8a29e;
    font-size: 12px;
    padding: 10px;
    text-align: center;
  }

  .calc-version-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .calc-version-edit-row {
    margin-top: 8px;
    display: flex;
    gap: 8px;
  }

  .calc-row {
    display: grid;
    grid-template-columns: 132px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .calc-row label {
    font-size: 12px;
    color: #44403c;
    font-weight: 600;
  }

  .calc-row .unit {
    font-size: 12px;
    color: #a8a29e;
    text-align: right;
  }

  .calc-mix-section {
    overflow: hidden;
  }

  .calc-mix-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .calc-mix-summary {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    margin-bottom: 8px;

    .calc-mix-summary-item {
      display: flex;
      min-width: 0;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border: 1px solid #e7e5e4;
      border-radius: 4px;
      background: #fafaf9;
      color: #57534e;
      padding: 6px 8px;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;

      span,
      b {
        min-width: 0;
      }

      b {
        color: inherit;
        text-align: right;
        overflow-wrap: anywhere;
      }
    }

    .is-ok {
      border-color: #bbf7d0;
      background: #f0fdf4;
      color: #166534;
    }

    .is-warning {
      border-color: #fed7aa;
      background: #fff7ed;
      color: #c2410c;
    }
  }

  .calc-mix-total-row {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    label {
      color: #44403c;
      font-size: 12px;
      font-weight: 600;
    }
  }

  .calc-mix-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .calc-mix-input-list {
    display: grid;
    gap: 8px;
  }

  .calc-mix-input-head {
    display: grid;
    grid-template-columns: minmax(84px, 116px) minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    color: #78716c;
    font-size: 11px;
    font-weight: 700;
  }

  .calc-mix-input-row {
    display: grid;
    grid-template-columns: minmax(84px, 116px) minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;

    label {
      min-width: 0;
      color: #44403c;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .el-input-group__append {
      padding: 0 6px;
    }
  }

  .calc-result-section {
    display: grid;
    gap: 10px;
  }

  .calc-section.calc-result-section {
    border: 0;
    background: transparent;
    padding: 0;
    box-shadow: none;
  }

  .calc-result-group {
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    border-radius: 6px;
    padding: 10px;
  }

  .calc-result-group:first-child {
    border-color: #bbf7d0;
    background: #f0fdf4;
  }

  .calc-result-title {
    margin-bottom: 8px;
    font-size: 12px;
    color: #334155;
    font-weight: 700;
  }

  .calc-result-grid {
    display: grid;
    gap: 8px;
  }

  .calc-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #334155;
  }

  .calc-result-item b {
    color: #0071e3;
    font-size: 16px;
    letter-spacing: 0;
    font-family: "SF Mono", "JetBrains Mono", "Roboto Mono", monospace;
  }

  .el-input__inner,
  .el-textarea__inner {
    border-color: #d6d3d1;
    border-radius: 4px;
    color: #0c0a09;
    background: #fff;
  }

  .el-input__inner:focus,
  .el-textarea__inner:focus {
    border-color: #0071e3;
    box-shadow: 0 0 0 2px #bfdbfe;
  }

  .el-button {
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .calc-version-toolbar .el-button--primary,
  .calc-section .el-button--primary {
    border-color: #0071e3;
    background: #0071e3;
    color: #fff;
  }

  .calc-version-toolbar .el-button--primary:hover,
  .calc-version-toolbar .el-button--primary:focus,
  .calc-section .el-button--primary:hover,
  .calc-section .el-button--primary:focus {
    border-color: #005bb5;
    background: #005bb5;
    color: #fff;
  }

  .calc-section > .el-button:not(.el-button--primary) {
    border-color: #d6d3d1;
    color: #44403c;
    background: #fff;
  }

  .calc-section > .el-button:not(.el-button--primary):hover,
  .calc-section > .el-button:not(.el-button--primary):focus {
    border-color: #0071e3;
    color: #0071e3;
    background: #eff6ff;
  }
}

.meeting-review-calc-popper {
  border: 1px solid #e7e5e4 !important;
  box-shadow: 0 8px 22px rgba(12, 10, 9, 0.12) !important;

  .el-select-dropdown__item {
    color: #44403c;
  }

  .el-select-dropdown__item.hover,
  .el-select-dropdown__item:hover {
    background: #eff6ff;
    color: #0071e3;
  }

  .el-select-dropdown__item.selected {
    color: #0071e3;
    font-weight: 700;
  }
}

@media (max-width: 1200px) {
  .meeting-review-calc-drawer {
    .calc-row {
      grid-template-columns: 1fr;

      .unit {
        text-align: left;
      }
    }

    .calc-mix-summary {
      grid-template-columns: 1fr;
    }

    .calc-mix-input-row {
      grid-template-columns: 1fr;
    }

    .calc-mix-input-head {
      display: none;
    }
  }
}
</style>
