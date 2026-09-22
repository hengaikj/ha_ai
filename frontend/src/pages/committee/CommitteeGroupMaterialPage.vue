<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import * as echarts from "echarts";
import type { ECharts } from "echarts";
import {
  ArrowDown,
  ArrowUp,
  Back,
  EditPen,
  FullScreen,
  Lock,
  MagicStick,
  Plus,
  QuestionFilled,
  Top,
  View,
} from "@element-plus/icons-vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import {
  fetchGroupMaterial,
  fetchCommitteeSubtotalWeighted,
  generateGroupMaterialSuggestions,
  fetchCommitteeGateAssignments,
  fetchCommitteeAttachments,
  downloadCommitteeAttachment,
  saveGroupMaterial,
  refreshGroupMaterialSourceData,
} from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { formatDate, formatFinancialNumber } from "@/utils/formatters";
import {
  calculateChartYAxisScale,
  formatCommitteeChartXAxisLabel,
  formatTimelinePointDate,
  sanitizeAmountInput,
  formatAmountInput,
  parseAmountInput,
  normalizeAmountOnBlur,
  formatAmountDisplay,
  formatPositiveAmountInput,
  parsePositiveAmountInput,
  normalizePositiveAmountOnBlur,
  sanitizePositiveAmountInput,
} from "./committee-ui";
import CommitteeAttachmentPanel from "./components/CommitteeAttachmentPanel.vue";
import CommitteeFilePreviewDialog from "./components/CommitteeFilePreviewDialog.vue";
import fileIcon from "@/assets/commit/file.png";
import pdfIcon from "@/assets/commit/file-pdf.png";
import wordIcon from "@/assets/commit/word3.png";
import commitIconAmountOrange from "@/assets/commit/group-19602.png";
import commitIconAmountGreen from "@/assets/commit/group-19617.png";
import commitIconBaic from "@/assets/commit/group-19604.png";
import commitIconCar from "@/assets/commit/group-19603.png";
import commitIconCheck from "@/assets/commit/group-19618.png";
import commitIconCommentBlue from "@/assets/commit/group-19616.png";
import commitIconDocumentBlue from "@/assets/commit/group-19601.png";
import commitIconDownloadGreen from "@/assets/commit/group-19613.png";
import commitIconGridGreen from "@/assets/commit/group-19605.png";
import commitIconLayers from "@/assets/commit/group-19600.png";
import commitIconMilestone from "@/assets/commit/milestone-active.png";
import commitIconMilestoneNormal from "@/assets/commit/milestone-normal.png";
import commitIconPieBlue from "@/assets/commit/group-19606.png";
import commitIconPieGreen from "@/assets/commit/group-19608.png";
import commitIconRobot from "@/assets/commit/group-19607.png";
import commitIconWalletBlue from "@/assets/commit/group-19612.png";
import commitbackground from "@/assets/commit/group-19600.png";
import baicGroupLogo from "@/assets/committee/baic-group-logo.png";
import groupMeetingBackdrop from "@/assets/committee/group-meeting-backdrop.png";
import type {
  CommitteeGateAssignment,
  CommitteeId,
  CommitteeMeeting,
  CommitteeOpinionSummary,
  CommitteeOpinionSummarySnapshot,
  CommitteeSubtotalWeightedData,
} from "@/types/committee";

type MaterialTarget =
  | "cover"
  | "previousGateRequirements"
  | "deliveryReview"
  | "attachment";
type ReviewBlockKind = "quality" | "cost" | "revenue" | "custom";
type ReviewBlock = {
  id: string;
  kind: ReviewBlockKind;
  title: string;
  content?: string;
};
type QualityIssue = {
  id: string;
  issue: string;
  action: string;
  ownerDepartment: string;
  dueDate: string;
};
type PreviousGateRequirement = {
  id: string;
  requirement: string;
  completion: string;
};
type CostForecastNode = {
  id: string;
  label: string;
  value: string;
};
type CostForecastBaseNode = {
  id: string;
  label: string;
  readonly?: boolean;
};
type RevenueForecastGroup = {
  id: string;
  label: string;
  margin: string;
  profit: string;
  metrics?: Record<string, string>;
  customRows?: RevenueForecastMetricRow[];
};
type RevenueForecastBaseNode = {
  id: string;
  label: string;
  readonly?: boolean;
};
type RevenueForecastMetricRow = {
  key: string;
  label: string;
  category: string;
  custom?: boolean;
};
type RevenueSupplementMetric = {
  id: string;
  label: string;
  value: string;
};
type ImportedMaterialRow = Record<string, unknown>;

const route = useRoute();
const router = useRouter();
const props = withDefaults(
  defineProps<{
    mode?: "route" | "display" | "edit";
  }>(),
  { mode: "route" },
);
const loading = ref(false);
const loadError = ref<{ code: string; message: string; traceId?: string }>();
const saving = ref(false);
const sourceRefreshing = ref(false);
const aiGenerating = ref(false);
const savedMaterialSnapshot = ref("");
const lastSavedAt = ref("");
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const aiSuggestionsExpanded = ref(false);
const generatedOpinionSummary = ref<CommitteeOpinionSummary>();
const opinionSummarySnapshot = ref<CommitteeOpinionSummarySnapshot>();
const aiSuggestionTransferKey = "committee-ai-suggestions";
const deliverablesExpanded = ref(false);
const materialScopeExpanded = ref(false);
const unsavedMaterialMessage = "当前集团会议材料尚未保存，确认离开当前页面吗？";
const deleteTarget = ref<
  | { type: "block"; id: string }
  | { type: "quality-issue"; id: string }
  | { type: "previous-gate-requirement"; id: string }
  | null
>(null);
const meeting = ref<CommitteeMeeting | null>(null);
const subtotalWeightedData = ref<CommitteeSubtotalWeightedData | null>(null);
const displayRootRef = ref<HTMLElement | null>(null);
const downloadingAttachmentId = ref<CommitteeId | null>(null);
const attachmentPreviewVisible = ref(false);
const attachmentPreviewFile = ref<Blob | null>(null);
const attachmentPreviewTitle = ref("");
const spectrumImageUrl = ref("");
const spectrumImageLoading = ref(false);
let spectrumImageObjectUrl = "";
let costChart: ECharts | null = null;
let revenueChart: ECharts | null = null;
const display = computed(
  () =>
    props.mode === "display" ||
    (props.mode === "route" && route.name === "committeeGroupMaterialDisplay"),
);
const meetingId = computed(() => String(route.params.meetingId ?? ""));
const displayData = computed(() => meeting.value?.display);
const sourceData = computed(() => {
  const weighted = subtotalWeightedData.value;
  const groupDisplay = displayData.value;
  const materialSourceData = meeting.value?.material?.sourceData;
  if (groupDisplay) {
    const cost = groupDisplay.cost;
    const revenue = groupDisplay.revenue;
    const sourceStatus =
      groupDisplay.meta?.dataStatus === "PARTIAL" ||
      materialSourceData?.sourceStatus === "PARTIAL"
        ? "PARTIAL"
        : "COMPLETE";
    return {
      vehicleInvestment: stringifyDisplayValue(
        cost?.vehicleInvestment ??
          groupDisplay.projectOverview?.vehicleInvestment ??
          materialSourceData?.vehicleInvestment,
      ),
      targetCost:
        cost?.targetCost !== undefined && cost.targetCost !== null
          ? formatCostDisplayValue(cost.targetCost)
          : sourceCostInYuan(materialSourceData?.targetCost),
      currentActualCost:
        cost?.currentActualCost !== undefined && cost.currentActualCost !== null
          ? formatCostDisplayValue(cost.currentActualCost)
          : sourceCostInYuan(materialSourceData?.currentActualCost),
      contributionMargin: stringifyDisplayValue(
        weighted?.bg || 0,
      ),
      operatingProfit: stringifyDisplayValue(
        weighted?.yelr || weighted?.yell || 0,
      ),
      marketGuidePriceTaxIncluded: stringifyDisplayValue(
        weighted?.zdPrice || 0,
      ),
      tpPriceTaxIncluded: stringifyDisplayValue(
        weighted?.tpPrice || 0,
      ),
      materialCost: stringifyDisplayValue(
        weighted?.clPrice || 0,
      ),
      variableManufacturingExpense: stringifyDisplayValue(
        weighted?.bdzzPrice || 0,
      ),
      variableSellingExpense: stringifyDisplayValue(
        weighted?.bdxsPrice || 0,
      ),
      costVersionId: stringifyDisplayValue(
        cost?.costVersionId ?? materialSourceData?.costVersionId,
      ),
      costVersion: stringifyDisplayValue(
        cost?.costVersion ?? materialSourceData?.costVersion,
      ),
      revenueFlowId: stringifyDisplayValue(
        revenue?.revenueFlowId ?? materialSourceData?.revenueFlowId,
      ),
      revenueRecordIds:
        revenue?.revenueRecordIds ?? materialSourceData?.revenueRecordIds ?? {},
      s8Url: stringifyDisplayValue(
        weighted?.s8Url,
      ),
      asOfTime:
        cost?.asOfTime ??
        materialSourceData?.asOfTime ??
        groupDisplay.meta?.generatedAt ??
        undefined,
      refreshedAt:
        groupDisplay.meta?.generatedAt ??
        materialSourceData?.refreshedAt ??
        undefined,
      sourceStatus,
    };
  }
  const normalizedSourceData = {
    ...(materialSourceData ?? {}),
    targetCost: sourceCostInYuan(materialSourceData?.targetCost),
    currentActualCost: sourceCostInYuan(materialSourceData?.currentActualCost),
  };
  if (!weighted) {
    return {
      ...normalizedSourceData,
      contributionMargin: "0",
      operatingProfit: "0",
      marketGuidePriceTaxIncluded: "0",
      tpPriceTaxIncluded: "0",
      materialCost: "0",
      variableManufacturingExpense: "0",
      variableSellingExpense: "0",
      s8Url: undefined,
    };
  }
  return {
    ...normalizedSourceData,
    contributionMargin: stringifyDisplayValue(
      weighted.bg || 0,
    ),
    operatingProfit: stringifyDisplayValue(
      weighted.yelr || weighted.yell || 0,
    ),
    marketGuidePriceTaxIncluded: stringifyDisplayValue(
      weighted.zdPrice || 0,
    ),
    tpPriceTaxIncluded: stringifyDisplayValue(
      weighted.tpPrice || 0,
    ),
    materialCost: stringifyDisplayValue(
      weighted.clPrice || 0,
    ),
    variableManufacturingExpense: stringifyDisplayValue(
      weighted.bdzzPrice || 0,
    ),
    variableSellingExpense: stringifyDisplayValue(
      weighted.bdxsPrice || 0,
    ),
    s8Url: stringifyDisplayValue(weighted.s8Url),
  };
});
const demoMeetingIds = new Set([
  "",
  "undefined",
  "demo-group-material-meeting",
  "meeting_group_a_g9_1",
]);
const useDemoMaterial = computed(
  () =>
    display.value &&
    (route.query.demo === "1" || demoMeetingIds.has(meetingId.value)),
);
const useDisplayDemoFallbacks = computed(
  () => display.value && useDemoMaterial.value,
);
const form = reactive({
  coverTitle: "",
  reportDepartment: "",
  executiveSummary: "",
  previousGateRequirements: "",
  deliveryReview: "",
  decisionText: "",
  costPoints: "",
  costForecastNodes: "",
  revenuePoints: "",
  revenueForecastGroups: "",
  revenueSupplementMetrics: "",
  reviewBlocks: "",
  qualityIssues: "",
  expectedLockVersion: 0,
  aiQualitySuggestion: "",
  aiCostSuggestion: "",
  aiRevenueSuggestion: "",
});
const aiCombinedSuggestion = computed(() =>
  [
    form.aiQualitySuggestion && `质量参考建议：${form.aiQualitySuggestion}`,
    form.aiCostSuggestion && `成本参考建议：${form.aiCostSuggestion}`,
    form.aiRevenueSuggestion && `收益参考建议：${form.aiRevenueSuggestion}`,
  ]
    .filter(Boolean)
    .join("\n\n"),
);
const displayedOpinionSummary = computed(
  () => generatedOpinionSummary.value ?? opinionSummarySnapshot.value?.result,
);
const opinionGatePoints = computed(() =>
  (displayedOpinionSummary.value?.projects ?? []).flatMap((project) =>
    project.gatePoints.map((gatePoint) => ({
      ...gatePoint,
      projectId: project.projectId,
      projectName: project.projectName,
    })),
  ),
);

function opinionItems(opinion: string | string[] | undefined) {
  if (Array.isArray(opinion)) return opinion.filter(Boolean);
  if (!opinion) return [];
  return opinion
    .split(/\r?\n|(?=\d+[、.)])/)
    .map((item) => item.trim())
    .filter(Boolean);
}
const reviewBlockDefinitions: Array<{
  kind: Exclude<ReviewBlockKind, "custom">;
  title: string;
}> = [
  { kind: "quality", title: "质量板块" },
  { kind: "cost", title: "成本板块" },
  { kind: "revenue", title: "收益板块" },
];
const reviewBlocks = ref<ReviewBlock[]>(
  reviewBlockDefinitions.map((item) => ({
    id: `review-${item.kind}`,
    ...item,
  })),
);
const qualityIssues = reactive<QualityIssue[]>([
  {
    id: "quality-issue-1",
    issue: "",
    action: "",
    ownerDepartment: "",
    dueDate: "",
  },
]);
const previousGateRequirementRows = reactive<PreviousGateRequirement[]>([]);
const showPreviousGateRequirements = ref(true);
const departmentOptions = ref<CommitteeGateAssignment[]>([]);
const departmentOptionsLoading = ref(false);
const sectionNumbers = computed(() => {
  let number = 0;
  const numbers = {
    spectrum: ++number,
    gateInfo: ++number,
    timeline: 0,
    previousGateRequirements: 0,
    deliverables: 0,
    review: 0,
    decision: 0,
  } as Record<string, number>;

  numbers.timeline = ++number;
  if (showPreviousGateRequirements.value) {
    numbers.previousGateRequirements = ++number;
  }
  numbers.deliverables = ++number;
  numbers.review = ++number;
  numbers.decision = ++number;
  // number 最后一次自增结果不需要保存到变量，直接计算即可
  numbers.attachments = number + 1;

  return numbers;
});
const costPointLabels = [
  "成本目标及当前实际（加权）",
  "降本路径",
  "技术与产品管理部意见",
];
const costPointPlaceholders = [
  "请输入成本目标、当前实际及差异说明",
  "请输入降本措施、责任路径及预期结果",
  "请输入技术与产品管理部评审意见",
];
const defaultCostPoints = costPointLabels.map(() => "");
const costPoints = reactive([...defaultCostPoints]);
const costForecastNodes = reactive<CostForecastNode[]>([]);
const revenuePointLabels = [
  "立项收益目标",
  "当前实际收益情况",
  "集团技术与产品管理部意见",
];
const revenuePointPlaceholders = [
  "请输入立项阶段的收益目标及测算依据",
  "请输入当前实际收益情况及目标差异",
  "请输入集团技术与产品管理部评审意见",
];
const defaultRevenuePoints = revenuePointLabels.map(() => "");
const revenuePoints = reactive([...defaultRevenuePoints]);
const revenueForecastGroups = reactive<RevenueForecastGroup[]>([]);
const revenueForecastCustomRows = reactive<RevenueForecastMetricRow[]>([]);
const revenueSupplementMetrics = reactive<RevenueSupplementMetric[]>([
  { id: "revenue-supplement-1", label: "", value: "" },
  { id: "revenue-supplement-2", label: "", value: "" },
]);
const editableScope: Array<{ label: string; target: MaterialTarget }> = [
  { label: "封面标题区", target: "cover" },
  { label: "产品委员会要求与完成情况", target: "previousGateRequirements" },
  { label: "评审校核主要问题汇总", target: "deliveryReview" },
  { label: "附件展示区", target: "attachment" },
];
const readonlyScope = [
  "产品型谱与阀点信息",
  "阀点进度总览",
  "评审结论与交付物清单",
  "提请决议事项",
];
const materialSnapshot = computed(() =>
  JSON.stringify({
    previousGateRequirementsVisible: showPreviousGateRequirements.value,
    coverTitle: form.coverTitle,
    reportDepartment: form.reportDepartment,
    executiveSummary: form.executiveSummary,
    previousGateRequirements: serializePreviousGateRequirements(),
    costPoints: serializeCostPoints(),
    costForecastNodes: serializeCostForecastNodes(),
    revenuePoints: serializeRevenuePoints(),
    revenueForecastGroups: serializeRevenueForecastGroups(),
    revenueSupplementMetrics: serializeRevenueSupplementMetrics(),
    reviewBlocks: serializeReviewBlocks(),
    qualityIssues: serializeQualityIssues(),
    deliveryReview: form.deliveryReview,
    decisionText: form.decisionText,
    aiQualitySuggestion: form.aiQualitySuggestion,
    aiCostSuggestion: form.aiCostSuggestion,
    aiRevenueSuggestion: form.aiRevenueSuggestion,
  }),
);
const isMaterialDirty = computed(
  () =>
    Boolean(savedMaterialSnapshot.value) &&
    materialSnapshot.value !== savedMaterialSnapshot.value,
);
const currentGateName = computed(() =>
  displayValue(meeting.value?.gateName, "--"),
);
const materialEditable = computed(
  () =>
    ["PREPARING", "READY", "REVISING"].includes(
      meeting.value?.meetingStatus ?? "",
    ) && meeting.value?.materialStatus !== "READY",
);

const gatePurpose = computed(() => {
  const val = displayData.value?.gateInfo?.gatePurpose;
  if (val != null && String(val).trim() !== "") return String(val).trim();
  if (useDisplayDemoFallbacks.value) {
    return "按固定汇报版式展示型谱、阀点进展、交付物、质量、成本、收益与决议事项。";
  }
  return displayValue(val, "--");
});

const coreWorkContent = computed(() => {
  const val = displayData.value?.gateInfo?.coreWorkContent;
  if (val != null && String(val).trim() !== "") return String(val).trim();
  if (useDisplayDemoFallbacks.value) {
    return "统一集团技术与产品管理部、财务、战略及相关专题部门对项目的评审结论口径，形成可直接归档的会议结论与责任部门督办要求。";
  }
  return displayValue(val, "--");
});
const fallbackTimelineMonths = Array.from({ length: 36 }, (_, index) => {
  const date = new Date(2026, 5 + index, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
});
type TimelinePoint = {
  gateId?: CommitteeId | number | null;
  gate?: string;
  date?: string;
  current?: boolean;
  completed?: boolean;
  offset: number;
};
const timelinePlanBase: TimelinePoint[] = [
  { gate: "G9", date: "2026/06/10", offset: 3.6 },
  { gate: "G8", date: "2026/06/10", offset: 11.2 },
  { gate: "G7", date: "2026/06/10", offset: 23.5 },
  { gate: "G6", date: "2026/06/10", offset: 30.3 },
  { gate: "G5", date: "2026/06/10", offset: 37.2 },
  { gate: "G4", date: "2026/06/10", offset: 44.8 },
  { gate: "G3", date: "2026/06/10", offset: 59.3 },
  { gate: "G2", date: "2026/06/10", offset: 68.5 },
  { gate: "G1", date: "2026/06/10", offset: 91 },
];
const timelineActualBase: TimelinePoint[] = [
  { gate: "G9", date: "2026/06/10", offset: 3.6 },
  { gate: "G8", date: "2026/06/10", offset: 11.2 },
  { gate: "G7", date: "2026/06/10", offset: 23.5 },
  { gate: "G6", date: "2026/06/10", offset: 30.3 },
  { gate: "G5", date: "2026/06/10", offset: 37.2 },
  { gate: "G4", date: "2026/06/10", offset: 44.8 },
  { gate: "G3", date: "2026/06/10", offset: 59.3 },
  { gate: "G2", date: "2026/06/10", offset: 68.5 },
  { gate: "G1", date: "2026/06/10", offset: 91 },
];
const timelineDateParts = (value: unknown) => {
  const match = String(value ?? "").match(/(\d{4})[-/]?(\d{1,2})/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : undefined;
};
const timelineDateSerial = (value: unknown) => {
  const parts = timelineDateParts(value);
  if (!parts) return undefined;
  const dayMatch = String(value ?? "").match(/\d{4}[-/]\d{1,2}[-/](\d{1,2})/);
  const day = dayMatch ? Number(dayMatch[1]) : 1;
  const daysInMonth = new Date(parts.year, parts.month, 0).getDate();
  return parts.year * 12 + parts.month - 1 + Math.max(day - 1, 0) / daysInMonth;
};
const timelineRange = computed(() => {
  const gates = displayData.value?.gateProgress?.gates ?? [];
  const dates = gates
    .flatMap((gate) => [
      timelineDateParts(gate.plannedFinishDate),
      timelineDateParts(gate.actualFinishDate),
    ])
    .filter((date): date is { year: number; month: number } => Boolean(date));
  if (!dates.length) return fallbackTimelineMonths;
  const dateSerials = dates.map(({ year, month }) => year * 12 + month - 1);
  const start = Math.min(...dateSerials);
  const end = Math.max(...dateSerials);
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const serial = start + index;
    return { year: Math.floor(serial / 12), month: (serial % 12) + 1 };
  });
});
const timelineMonths = computed(() =>
  timelineRange.value.map(({ month }) => `${month}月`),
);
const timelineYears = computed(() => {
  const years: { year: number; count: number }[] = [];
  timelineRange.value.forEach(({ year }) => {
    const current = years[years.length - 1];
    if (current?.year === year) current.count += 1;
    else years.push({ year, count: 1 });
  });
  return years;
});
const timelineGridStyle = computed(() => ({
  gridTemplateColumns: `168px repeat(${timelineMonths.value.length}, minmax(70px, 1fr))`,
  minWidth: `${168 + timelineMonths.value.length * 70}px`,
}));
const timelinePointOffset = (value: unknown, fallback: number) => {
  const serial = timelineDateSerial(value);
  if (serial === undefined) return fallback;
  const range = timelineRange.value;
  const start = range[0].year * 12 + range[0].month - 1;
  const end = range[range.length - 1].year * 12 + range[range.length - 1].month;
  return Math.max(0, Math.min(100, ((serial - start) / (end - start)) * 100));
};
const timelinePointStyle = (point: TimelinePoint) => ({
  left: `clamp(36px, ${point.offset}%, calc(100% - 36px))`,
});
function buildDisplayTimelinePoints(kind: "planned" | "actual") {
  const gateProgress = displayData.value?.gateProgress;
  const gates = gateProgress?.gates ?? [];
  if (!gates.length) {
    if (!useDisplayDemoFallbacks.value) return [];
    const basePoints = kind === "planned" ? timelinePlanBase : timelineActualBase;
    const currentIdx = basePoints.findIndex(
      (point) => point.gate === currentGateName.value,
    );
    const currentDate = currentIdx >= 0 ? basePoints[currentIdx].date : undefined;
    const currentSerial = timelineDateSerial(currentDate);

    return basePoints.map((point, index) => {
      const isCurrent = point.gate === currentGateName.value;
      const pointSerial = timelineDateSerial(point.date);
      const isBeforeCurrent =
        kind === "planned" &&
        !isCurrent &&
        currentIdx >= 0 &&
        (index < currentIdx ||
          (currentSerial !== undefined &&
            pointSerial !== undefined &&
            pointSerial < currentSerial));

      return {
        ...point,
        current: isCurrent,
        completed: kind === "actual" || isBeforeCurrent,
        offset: timelinePointOffset(point.date, point.offset),
      };
    });
  }
  const timelineGates =
    kind === "actual"
      ? gates.filter(
          (gate) => timelineDateSerial(gate.actualFinishDate) !== undefined,
        )
      : gates;
  const activeGates = gates.filter(
    (gate) => timelineDateSerial(gate.actualFinishDate) === undefined,
  );
  const currentGateId = gateProgress?.currentGateId;
  const progressCurrentGateName = gateProgress?.currentGateName?.trim();
  const currentGate =
    activeGates.find(
      (gate) =>
        currentGateId !== null &&
        currentGateId !== undefined &&
        gate.gateId !== null &&
        gate.gateId !== undefined &&
        String(gate.gateId) === String(currentGateId),
    ) ??
    activeGates.find(
      (gate) =>
        Boolean(progressCurrentGateName) &&
        (gate.gateName?.trim() === progressCurrentGateName ||
          gate.gateCode?.trim() === progressCurrentGateName),
    ) ??
    activeGates.find((gate) => gate.current === true) ??
    gates.find(
      (gate) =>
        currentGateId !== null &&
        currentGateId !== undefined &&
        gate.gateId !== null &&
        gate.gateId !== undefined &&
        String(gate.gateId) === String(currentGateId),
    ) ??
    gates.find(
      (gate) =>
        Boolean(progressCurrentGateName) &&
        (gate.gateName?.trim() === progressCurrentGateName ||
          gate.gateCode?.trim() === progressCurrentGateName),
    ) ??
    gates.find((gate) => gate.current === true);

  const currentGateIndex = currentGate ? timelineGates.indexOf(currentGate) : -1;
  const currentGatePlannedSerial = currentGate
    ? timelineDateSerial(currentGate.plannedFinishDate)
    : undefined;

  return timelineGates.map((gate, index) => {
    const isCurrent = gate === currentGate;
    const hasActualFinish =
      timelineDateSerial(gate.actualFinishDate) !== undefined;

    // 计划时间轴：排在当前进行（蓝色）左侧的历史节点或历史日期，同样展示为绿色已完成状态
    const gatePlannedSerial = timelineDateSerial(gate.plannedFinishDate);
    const isLeftOfCurrent =
      kind === "planned" &&
      Boolean(currentGate) &&
      !isCurrent &&
      ((currentGateIndex >= 0 && index < currentGateIndex) ||
        (currentGatePlannedSerial !== undefined &&
          gatePlannedSerial !== undefined &&
          gatePlannedSerial < currentGatePlannedSerial) ||
        (gate.sequenceNo !== undefined &&
          gate.sequenceNo !== null &&
          currentGate?.sequenceNo !== undefined &&
          currentGate?.sequenceNo !== null &&
          Number(gate.sequenceNo) < Number(currentGate.sequenceNo)));

    return {
      gateId: gate.gateId,
      gate: displayValue(gate.gateName ?? gate.gateCode, ""),
      date: displayDate(
        kind === "planned" ? gate.plannedFinishDate : gate.actualFinishDate,
      ),
      current: isCurrent,
      completed: hasActualFinish || isLeftOfCurrent,
      offset: timelinePointOffset(
        kind === "planned" ? gate.plannedFinishDate : gate.actualFinishDate,
        50,
      ),
    };
  });
}
const timelinePlan = computed(() => buildDisplayTimelinePoints("planned"));
const timelineActual = computed(() => buildDisplayTimelinePoints("actual"));
const previousGateRows = computed(() =>
  previousGateRequirementRows.map((item, index) => ({
    id: item.id,
    index: index + 1,
    requirement: item.requirement,
    completion: item.completion,
  })),
);
const fallbackDeliverableItems = [
  { label: "产品型谱方案", icon: commitIconPieBlue },
  { label: "平台与动力总成", icon: commitIconRobot },
  { label: "成本测算及收益测算", icon: commitIconWalletBlue },
  { label: "产品质量方案", icon: commitIconDocumentBlue },
  { label: "产品研发方案", icon: commitIconLayers },
  { label: "产品定义方案", icon: commitIconDocumentBlue },
  { label: "产品配置方案", icon: commitIconGridGreen },
  { label: "产品收益测算", icon: commitIconPieGreen },
  { label: "专项风险关闭清单", icon: commitIconCheck },
  { label: "产品投放方案", icon: commitIconDownloadGreen },
];
const deliverableItems = computed(() => {
  const rows = displayData.value?.deliverables ?? [];
  if (!rows.length && useDisplayDemoFallbacks.value)
    return fallbackDeliverableItems;
  return rows.map((item) => ({
    label: displayValue(item.materialName),
    icon: fileIcon,
  }));
});
const visibleDeliverableItems = computed(() =>
  deliverablesExpanded.value
    ? deliverableItems.value
    : deliverableItems.value.slice(0, 10),
);
const showDeliverableToggle = computed(
  () => deliverableItems.value.length > 10,
);
type SignalTone = "green" | "yellow" | "red" | "empty";
type ReviewMatrixRow = {
  dimension: string;
  [key: string]: SignalTone | string;
};
type ReviewMatrixDisplayGroup = {
  title: string;
  count: string;
  departments: Array<{
    key: string;
    label: string;
    taskId?: CommitteeId | number | null;
  }>;
  rows: ReviewMatrixRow[];
};
const fallbackReviewMatrixGroups: ReviewMatrixDisplayGroup[] = [
  {
    title: "品牌公司职能部室",
    count: "8 个参评部室",
    departments: [
      { key: "tech", label: "技术/费用" },
      { key: "cost", label: "成本" },
      { key: "profit", label: "收益" },
      { key: "quality", label: "质量" },
      { key: "strategy", label: "战略" },
      { key: "marketing", label: "营销" },
      { key: "manufacture", label: "制造" },
      { key: "finance", label: "财务" },
    ],
    rows: [
      {
        dimension: "技术/费用",
        tech: "green",
        cost: "yellow",
        profit: "green",
        quality: "green",
        strategy: "yellow",
        marketing: "green",
        manufacture: "green",
        finance: "green",
      },
      {
        dimension: "收益",
        tech: "empty",
        cost: "empty",
        profit: "green",
        quality: "green",
        strategy: "yellow",
        marketing: "yellow",
        manufacture: "empty",
        finance: "green",
      },
      {
        dimension: "量价",
        tech: "empty",
        cost: "empty",
        profit: "yellow",
        quality: "green",
        strategy: "green",
        marketing: "yellow",
        manufacture: "empty",
        finance: "green",
      },
      {
        dimension: "竞争力",
        tech: "green",
        cost: "empty",
        profit: "green",
        quality: "green",
        strategy: "yellow",
        marketing: "yellow",
        manufacture: "green",
        finance: "green",
      },
      {
        dimension: "质量",
        tech: "yellow",
        cost: "red",
        profit: "green",
        quality: "green",
        strategy: "yellow",
        marketing: "empty",
        manufacture: "green",
        finance: "green",
      },
      {
        dimension: "结论建议",
        tech: "green",
        cost: "yellow",
        profit: "green",
        quality: "green",
        strategy: "yellow",
        marketing: "green",
        manufacture: "green",
        finance: "green",
      },
    ],
  },
  {
    title: "集团部室及管委会办公室",
    count: "7 个参评部室",
    departments: [
      { key: "groupTech", label: "集团技术" },
      { key: "groupCost", label: "集团成本" },
      { key: "groupProfit", label: "集团收益" },
      { key: "groupQuality", label: "集团质量" },
      { key: "groupStrategy", label: "集团战略" },
      { key: "groupMarketing", label: "集团营销" },
      { key: "groupFinance", label: "集团财务" },
    ],
    rows: [
      {
        dimension: "技术/费用",
        groupTech: "green",
        groupCost: "yellow",
        groupProfit: "yellow",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "green",
        groupFinance: "green",
      },
      {
        dimension: "收益",
        groupTech: "empty",
        groupCost: "empty",
        groupProfit: "green",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "yellow",
        groupFinance: "yellow",
      },
      {
        dimension: "量价",
        groupTech: "empty",
        groupCost: "empty",
        groupProfit: "yellow",
        groupQuality: "green",
        groupStrategy: "green",
        groupMarketing: "yellow",
        groupFinance: "yellow",
      },
      {
        dimension: "竞争力",
        groupTech: "green",
        groupCost: "empty",
        groupProfit: "green",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "yellow",
        groupFinance: "green",
      },
      {
        dimension: "质量",
        groupTech: "green",
        groupCost: "red",
        groupProfit: "green",
        groupQuality: "empty",
        groupStrategy: "yellow",
        groupMarketing: "empty",
        groupFinance: "green",
      },
      {
        dimension: "结论建议",
        groupTech: "green",
        groupCost: "yellow",
        groupProfit: "green",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "green",
        groupFinance: "green",
      },
    ],
  },
];
const reviewSignalDimensions = [
  { label: "技术/费用", field: "techSignal" },
  { label: "收益", field: "revenueSignal" },
  { label: "量价", field: "volumePriceSignal" },
  { label: "竞争力", field: "competitivenessSignal" },
  { label: "质量", field: "qualitySignal" },
  { label: "结论建议", field: "conclusionSignal" },
] as const;

function isGroupDeptGroup(groupVal?: string | null): boolean {
  const upper = String(groupVal ?? "").trim().toUpperCase();
  return upper === "GROUP" || upper.includes("集团");
}

const reviewMatrixGroups = computed<ReviewMatrixDisplayGroup[]>(() => {
  const groups = displayData.value?.reviewMatrix?.groups ?? [];
  if (!groups.length && useDisplayDemoFallbacks.value)
    return fallbackReviewMatrixGroups;
  return groups.map((group) => {
    const departments = (group.departments ?? []).map((department, index) => ({
      key: `department-${department.departmentId ?? index}`,
      label: displayValue(department.departmentName, `部门${index + 1}`),
      taskId: department.taskId,
    }));

    const isGroup = isGroupDeptGroup(group.departmentGroup);
    const dimensionsToRender = isGroup
      ? reviewSignalDimensions
      : reviewSignalDimensions.filter((dim) => dim.field === "conclusionSignal");

    return {
      title: displayDepartmentGroup(group.departmentGroup),
      count: `${departments.length} 个参评部室`,
      departments,
      rows: dimensionsToRender.map((dimension) => {
        const row: ReviewMatrixRow = { dimension: dimension.label };
        (group.departments ?? []).forEach((department, index) => {
          const key = `department-${department.departmentId ?? index}`;
          row[key] = normalizeSignalTone(department[dimension.field]);
        });
        return row;
      }),
    };
  });
});

function reviewMatrixRowClassName({ row }: { row: ReviewMatrixRow }) {
  return row.dimension === "结论建议" ? "is-conclusion-row" : "";
}

function openHrefInNewWindow(href: string) {
  try {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.location.href = href;
  }
}

function openInNewWindow(location: {
  name?: string;
  path?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
}) {
  try {
    const resolved = router.resolve(location);
    if (resolved?.href) {
      openHrefInNewWindow(resolved.href);
    } else {
      void router.push(location);
    }
  } catch {
    void router.push(location);
  }
}

function openProjectDetail() {
  const projectId =
    displayData.value?.projectOverview?.projectId ?? meeting.value?.projectId;
  if (!projectId) return;
  openInNewWindow({
    name: "committeeProjectDetail",
    params: { projectId: String(projectId) },
  });
}

function openGateData(gateId?: CommitteeId | number | null) {
  const projectId =
    displayData.value?.projectOverview?.projectId ?? meeting.value?.projectId;
  if (!projectId || !gateId) return;
  openInNewWindow({
    name: "committeeMeetingHistory",
    params: { projectId: String(projectId), gateId: String(gateId) },
  });
}

function openReviewTask(taskId?: CommitteeId | number | null) {
  if (!taskId) return;
  openInNewWindow({
    name: "committeeReviewDetail",
    params: { taskId: String(taskId) },
  });
}

function openCostData() {
  const project = displayData.value?.projectOverview;
  const gate = displayData.value?.gateInfo as Record<string, any> | undefined;
  const cost = displayData.value?.cost as Record<string, any> | undefined;
  const rawMeeting = meeting.value as Record<string, any> | undefined;
  const rawDisplay = displayData.value as Record<string, any> | undefined;
  const rawSource = sourceData.value as Record<string, any> | undefined;

  const projectId =
    (project as any)?.projectId ??
    rawMeeting?.projectId ??
    rawMeeting?.projectOverview?.projectId ??
    rawSource?.projectId ??
    rawMeeting?.project_id ??
    rawDisplay?.projectId ??
    rawSource?.project_id ??
    "";
  const versionId =
    cost?.costVersionId ??
    rawSource?.costVersionId ??
    rawMeeting?.material?.sourceData?.costVersionId ??
    cost?.versionId ??
    rawDisplay?.costVersionId ??
    rawSource?.costVersionId ??
    "";
  const vehicleModelId =
    (project as any)?.vehicleModelId ??
    rawMeeting?.vehicleModelId ??
    rawMeeting?.projectOverview?.vehicleModelId ??
    rawSource?.vehicleModelId ??
    rawMeeting?.vehicle_model_id ??
    "";
  const valveId =
    gate?.valveId ??
    gate?.gateId ??
    rawMeeting?.gateId ??
    rawMeeting?.gateInfo?.valveId ??
    rawMeeting?.gateInfo?.gateId ??
    rawSource?.valveId ??
    rawMeeting?.valve_id ??
    "";
  const projectName =
    (project as any)?.projectName ??
    rawMeeting?.projectName ??
    rawSource?.projectName ??
    rawMeeting?.project_name ??
    "";
  const projectCode =
    (project as any)?.projectCode ??
    rawMeeting?.projectCode ??
    rawSource?.projectCode ??
    rawMeeting?.project_code ??
    "";
  const valveName =
    gate?.gateName ??
    rawMeeting?.gateName ??
    rawSource?.valveName ??
    rawMeeting?.gate_name ??
    "";
  const version =
    cost?.costVersion ??
    rawSource?.costVersion ??
    "";

  if (projectId && versionId) {
    openInNewWindow({
      path: "/cost/research/new-history/detail",
      query: {
        projectId: String(projectId),
        bomVersionId: String(versionId),
        versionId: String(versionId),
        ...(version ? { version: String(version) } : {}),
        ...(vehicleModelId ? { vehicleModelId: String(vehicleModelId) } : {}),
        ...(valveId ? { valveId: String(valveId) } : {}),
        vehicleModelName: projectName,
        projectName,
        projectCode,
        valveName,
        activeMenu: "/cost/research/new-history",
      },
    });
  } else {
    openInNewWindow({
      path: "/cost/research/new-history",
      query: {
        ...(projectId ? { projectId: String(projectId) } : {}),
        ...(projectName ? { projectName } : {}),
        ...(projectCode ? { projectCode } : {}),
        activeMenu: "/cost/research/new-history",
      },
    });
  }
}

function openRevenueData(recordId?: CommitteeId | number | null) {
  const s8Url = String(
    subtotalWeightedData.value?.s8Url ?? sourceData.value?.s8Url ?? "",
  ).trim();
  if (s8Url) {
    openHrefInNewWindow(s8Url);
    return;
  }
  const flowId =
    displayData.value?.revenue?.revenueFlowId ??
    sourceData.value?.revenueFlowId;
  if (!flowId) return;
  const project = displayData.value?.projectOverview;
  openInNewWindow({
    name: "RevenueProjectFlowDetail",
    query: {
      flowId: String(flowId),
      ...(recordId ? { recordId: String(recordId) } : {}),
      ...(project?.projectId ? { projectId: String(project.projectId) } : {}),
      ...(project?.projectCode ? { projectCode: project.projectCode } : {}),
      ...(project?.projectName ? { projectName: project.projectName } : {}),
      ...(meeting.value?.gateName ? { valve: meeting.value.gateName } : {}),
    },
  });
}

function revenueMetricSubjectId(label: string) {
  const subjectIds: Record<string, number> = {
    边贡: 34,
    营业利润: 35,
    "市场指导价（含税）": 5,
    "TP价（含税）": 7,
    材料成本: 12,
    变动制造费用: 16,
    变动销售费用: 17,
  };
  return (
    displayData.value?.revenue?.revenueRecordIds?.[String(subjectIds[label])] ??
    null
  );
}

const fallbackQualityOpinionRows = [
  {
    index: 1,
    problem: "关键零部件质量风险需要结合量产爬坡节奏，细化闭环验证计划。",
    measure: "补充风险清单和验证计划，形成问题关闭责任人与验收要求。",
    owner: "质量部",
    date: "2026-07-20",
  },
  {
    index: 2,
    problem: "供应商质量稳定性对交付节奏存在一定影响。",
    measure: "组织供应商专项审批，纳入月度跟踪。",
    owner: "采购部 / 质量部",
    date: "2026-07-30",
  },
];
const qualityOpinionRows = computed(() => {
  const rows = display.value ? (displayData.value?.qualityIssues ?? []) : [];
  if (display.value && displayData.value) {
    return rows.map((item, index) => ({
      index: index + 1,
      problem: displayValue(item.issue),
      measure: displayValue(item.action),
      owner: displayValue(item.ownerDepartment),
      date: displayDate(item.dueDate),
    }));
  }
  if (
    !rows.length &&
    !qualityIssues.some((item) => item.issue || item.action) &&
    useDisplayDemoFallbacks.value
  ) {
    return fallbackQualityOpinionRows;
  }
  const sourceRows = display.value && rows.length ? rows : qualityIssues;
  return sourceRows.map((item, index) => ({
    index: index + 1,
    problem: displayValue(item.issue),
    measure: displayValue(item.action),
    owner: displayValue(item.ownerDepartment),
    date: displayDate(item.dueDate),
  }));
});

function asImportedRows(value: unknown): ImportedMaterialRow[] {
  const source =
    typeof value === "string" && value.trim()
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return undefined;
          }
        })()
      : value;
  if (!Array.isArray(source)) return [];
  return source.filter(
    (item): item is ImportedMaterialRow =>
      typeof item === "object" && item !== null,
  );
}

function readMaterialRows(keys: string[]): ImportedMaterialRow[] {
  const material = meeting.value?.material as
    | Record<string, unknown>
    | undefined;
  if (!material) return [];
  for (const key of keys) {
    const rows = asImportedRows(material[key]);
    if (rows.length) return rows;
  }
  return [];
}

function importedText(row: ImportedMaterialRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "";
}

const costImportedNodeFields = [
  { label: "目标成本", value: "" },
  { label: "当前实际", value: "" },
];
const costForecastBaseNodes: CostForecastBaseNode[] = [
  { id: "target-cost", label: "目标成本", readonly: true },
  { id: "current-actual", label: "当前实际", readonly: true },
  { id: "sop-forecast", label: "SOP预计" },
  { id: "sop6-forecast", label: "SOP+6预计" },
];
const requiredCostForecastBaseNodes = costForecastBaseNodes.filter(
  (node) => node.readonly,
);
const revenueImportedGroupFields = [
  { label: "目标成本", margin: "", profit: "" },
  { label: "当前实际", margin: "", profit: "" },
];
const revenueForecastBaseNodes: RevenueForecastBaseNode[] = [
  { id: "target-cost", label: "目标成本" },
  { id: "current-actual", label: "当前实际", readonly: true },
  { id: "sop-forecast", label: "SOP预算" },
  { id: "sop6-forecast", label: "SOP+6Y预算" },
];
const requiredRevenueForecastBaseNodes = revenueForecastBaseNodes.filter(
  (node) => ["target-cost", "current-actual"].includes(node.id),
);
const revenueMetricColumnWidth = 200;
const revenueImportedMetricFields = [
  { label: "市场指导价（含税）", value: "" },
  { label: "TP价（含税）", value: "" },
  { label: "材料成本", value: "" },
  { label: "变动制造费用", value: "" },
  { label: "变动销售费用", value: "" },
];

function mergeImportedRows<T extends { label: string }>(
  fields: T[],
  rows: T[],
): T[] {
  return fields.map((field) => {
    const matched = rows.find((row) => row.label === field.label);
    return matched ? { ...field, ...matched } : { ...field };
  });
}

function normalizeRevenueNodeLabel(label: string) {
  return label.replace(/\s+/g, "");
}

function formatRevenueMetricCellValue(value: unknown, groupLabel?: string): string {
  const formatted = formatFinancialNumber(value as any, "0");
  if (normalizeRevenueNodeLabel(groupLabel ?? "") === "当前实际") {
    if (formatted.endsWith(".00")) {
      return formatted.slice(0, -3);
    }
  }
  return formatted;
}

function normalizeCostNodeLabel(label: string) {
  return label.replace(/\s+/g, "");
}

function sourceCostInYuan(value?: string) {
  const rawValue = value?.trim() ?? "";
  if (!rawValue) return "";
  const numericValue = Number(rawValue.replace(/,/g, ""));
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : rawValue;
}

function formatCostDisplayValue(value?: string | number | null) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";
  const numericValue = Number(rawValue.replace(/,/g, ""));
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : rawValue;
}

const costImportedNodes = computed(() => {
  const rows = sourceData.value
    ? [
        {
          label: "目标成本",
          value: formatCostDisplayValue(sourceData.value.targetCost),
        },
        {
          label: "当前实际",
          value: formatCostDisplayValue(sourceData.value.currentActualCost),
        },
      ]
    : readMaterialRows([
        "costImportedNodes",
        "costImportedMetrics",
        "importedCostNodes",
      ])
        .map((item) => ({
          label: importedText(item, [
            "label",
            "name",
            "nodeName",
            "metricName",
          ]),
          value: importedText(item, ["value", "amount", "cost", "metricValue"]),
        }))
        .filter((item) => item.label || item.value);
  return mergeImportedRows(costImportedNodeFields, rows);
});
function currentImportedCostValue(label: string) {
  return (
    costImportedNodes.value.find(
      (item) =>
        normalizeCostNodeLabel(item.label) === normalizeCostNodeLabel(label),
    )?.value ?? ""
  );
}
const costInsightIcons = [
  { icon: commitIconWalletBlue, tone: "blue" },
  { icon: commitIconDownloadGreen, tone: "green" },
  { icon: commitIconCommentBlue, tone: "blue" },
];

function autoCostSummaryInsight() {
  const targetCost = currentImportedCostValue("目标成本").trim();
  const currentActualCost = currentImportedCostValue("当前实际").trim();
  return [
    targetCost && `目标成本 ${targetCost} 元`,
    currentActualCost && `当前实际 ${currentActualCost} 元`,
  ]
    .filter(Boolean)
    .join("；");
}

const costInsightCards = computed(() =>
  costPointLabels.map((title, index) => ({
    title,
    content:
      costPoints[index]?.trim() ||
      (index === 0 ? autoCostSummaryInsight() : "") ||
      "--",
    icon: costInsightIcons[index]?.icon ?? commitIconDocumentBlue,
    tone: costInsightIcons[index]?.tone ?? "blue",
  })),
);

function toCostNumber(value: string) {
  const matched = value.match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : 0;
}


function formatChartAxisValue(value: number) {
  return value.toLocaleString("zh-CN");
}

const costBars = computed(() =>
  costForecastNodes
    .map((item) => ({
      label: item.label.trim(),
      rawValue: item.value.trim(),
      value: toCostNumber(item.value),
    }))
    .filter((item) => item.label && item.rawValue)
    .map(({ label, value }) => ({ label, value })),
);

const costDeltaLabels = computed(() =>
  costBars.value.slice(1).map((item, index) => {
    const delta = item.value - costBars.value[index].value;
    if (Math.abs(delta) < 0.001) {
      return "持平";
    }
    const prefix = delta > 0 ? "+" : "-";
    const absDelta = Math.abs(delta);
    let formatted = absDelta.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (formatted.endsWith(".00")) {
      formatted = formatted.slice(0, -3);
    }
    return `${prefix}${formatted}`;
  }),
);

function formatCostDeltaLabel(params: unknown) {
  const dataIndex =
    typeof params === "object" &&
    params !== null &&
    "dataIndex" in params &&
    typeof params.dataIndex === "number"
      ? params.dataIndex
      : 0;
  const value = costDeltaLabels.value[dataIndex] ?? "";
  if (value.startsWith("+")) {
    return `{red|${value}}`;
  } else if (value.startsWith("-")) {
    return `{green|${value}}`;
  }
  return `{neutral|${value}}`;
}

function formatForecastValueLabel(params: unknown) {
  const value =
    typeof params === "object" &&
    params !== null &&
    "value" in params &&
    (typeof params.value === "number" || typeof params.value === "string")
      ? params.value
      : "";
  const formatted = formatFinancialNumber(value, "");
  return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
}

const costChartOption = computed(() => {
  const bars = costBars.value;
  const categories = bars.map((item) => item.label);
  const values = bars.map((item) => item.value);
  const costYAxisScale = calculateChartYAxisScale(values);
  const markLineData = bars
    .slice(1)
    .map((item, index) => [
      { coord: [index, bars[index].value] },
      { coord: [index + 1, item.value] },
    ]);

  return {
    animation: false,
    title: {
      text: "{title|成本目标达成}{sub|（元）}",
      left: 0,
      top: 0,
      textStyle: {
        rich: {
          title: {
            color: "#0f2338",
            fontSize: 17,
            fontWeight: 700,
          },
          sub: {
            color: "#64748b",
            fontSize: 14,
            fontWeight: 400,
          },
        },
      },
    },
    grid: {
      top: 48,
      right: 24,
      bottom: 52,
      left: 16,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
        shadowStyle: {
          color: "rgba(59, 130, 246, 0.04)",
        },
      },
      backgroundColor: "rgba(255, 255, 255, 0.98)",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { fontSize: 14, color: "#1e293b" },
      extraCssText:
        "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border-radius: 8px;",
      formatter(params: unknown) {
        const list = Array.isArray(params) ? params : [];
        const barItem = list.find(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "seriesName" in item &&
            item.seriesName === "成本柱",
        ) as { name?: string; value?: number } | undefined;
        if (!barItem) return "";
        const formatted =
          typeof barItem.value === "number"
            ? barItem.value.toLocaleString("zh-CN")
            : (barItem.value ?? "");
        return `<div style="font-weight:600;margin-bottom:4px;color:#0f172a;">${barItem.name}</div><div style="color:#475569;">成本: <span style="font-weight:700;color:#2563eb;">${formatted}</span> 元</div>`;
      },
    },
    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: true,
      triggerEvent: true,
      axisTick: { show: false },
      axisLine: {
        lineStyle: {
          color: "#e2e8f0",
          width: 1,
        },
      },
      axisLabel: {
        interval: 0,
        rotate: 0,
        color: "#1e293b",
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 20,
        margin: 10,
        formatter: (value: string) => formatCommitteeChartXAxisLabel(value),
      },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: costYAxisScale.max,
      interval: costYAxisScale.interval,
      axisLine: {
        show: true,
        lineStyle: { color: "#e2e8f0", width: 1 },
      },
      axisTick: {
        show: true,
        lineStyle: { color: "#cbd5e1" },
        length: 4,
      },
      axisLabel: {
        color: "#64748b",
        fontSize: 12,
        fontWeight: 500,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        formatter: formatChartAxisValue,
        margin: 12,
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: "#f1f5f9",
          type: "dashed",
        },
      },
    },
    series: [
      {
        name: "成本柱",
        type: "bar",
        data: values,
        barWidth: 26,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#93c5fd" },
            { offset: 1, color: "rgba(147, 197, 253, 0.35)" },
          ]),
        },
      },
      {
        name: "趋势折线",
        type: "line",
        smooth: 0.35,
        data: values,
        symbol: "circle",
        symbolSize: 8,
        z: 5,
        lineStyle: {
          color: "#2563eb",
          width: 3,
          shadowColor: "rgba(37, 99, 235, 0.2)",
          shadowBlur: 6,
          shadowOffsetY: 2,
        },
        itemStyle: {
          color: "#ffffff",
          borderColor: "#2563eb",
          borderWidth: 2.5,
          shadowColor: "rgba(37, 99, 235, 0.25)",
          shadowBlur: 4,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(37, 99, 235, 0.12)" },
            { offset: 0.7, color: "rgba(37, 99, 235, 0.02)" },
            { offset: 1, color: "rgba(37, 99, 235, 0)" },
          ]),
        },
        label: {
          show: true,
          position: "top",
          distance: 16,
          color: "#0f172a",
          fontSize: 17,
          fontWeight: 700,
          fontFamily:
            'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          formatter: formatForecastValueLabel,
        },
      },
      {
        name: "差值指示",
        type: "line",
        data: [],
        z: 30,
        zlevel: 2,
        markLine: {
          silent: true,
          symbol: "none",
          z: 30,
          zlevel: 2,
          lineStyle: {
            color: "transparent",
            width: 0,
          },
          label: {
            show: true,
            position: "insideMiddle",
            distance: 0,
            verticalAlign: "middle",
            rotate: 0,
            formatter: formatCostDeltaLabel,
            rich: {
              red: {
                align: "center",
                verticalAlign: "middle",
                color: "#dc2626",
                backgroundColor: "#ffffff",
                borderColor: "#fca5a5",
                borderWidth: 1.5,
                borderRadius: 14,
                padding: [5, 12],
                fontSize: 17,
                fontWeight: 700,
                fontFamily:
                  'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                shadowColor: "rgba(220, 38, 38, 0.15)",
                shadowBlur: 6,
                shadowOffsetY: 2,
              },
              green: {
                align: "center",
                verticalAlign: "middle",
                color: "#16a34a",
                backgroundColor: "#ffffff",
                borderColor: "#86efac",
                borderWidth: 1.5,
                borderRadius: 14,
                padding: [5, 12],
                fontSize: 17,
                fontWeight: 700,
                fontFamily:
                  'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                shadowColor: "rgba(22, 163, 74, 0.15)",
                shadowBlur: 6,
                shadowOffsetY: 2,
              },
              neutral: {
                align: "center",
                verticalAlign: "middle",
                color: "#475569",
                backgroundColor: "#ffffff",
                borderColor: "#cbd5e1",
                borderWidth: 1.5,
                borderRadius: 14,
                padding: [5, 12],
                fontSize: 17,
                fontWeight: 700,
                fontFamily:
                  'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                shadowColor: "rgba(100, 116, 139, 0.1)",
                shadowBlur: 6,
                shadowOffsetY: 2,
              },
            },
          },
          data: markLineData,
        },
      },
    ],
  };
});
const revenueImportedGroups = computed(() =>
  mergeImportedRows(
    revenueImportedGroupFields,
    sourceData.value
      ? [
          {
            label: "当前实际",
            margin: sourceData.value.contributionMargin ?? "",
            profit: sourceData.value.operatingProfit ?? "",
          },
        ]
      : readMaterialRows([
          "revenueImportedGroups",
          "revenueImportedGroupMetrics",
          "importedRevenueGroups",
        ])
          .map((item) => ({
            label: importedText(item, ["label", "name", "groupName"]),
            margin: importedText(item, [
              "margin",
              "contribution",
              "edgeContribution",
              "contributionMargin",
            ]),
            profit: importedText(item, ["profit", "income", "grossProfit"]),
          }))
          .filter((item) => item.label || item.margin || item.profit),
  ),
);
const currentActualRevenueGroup = computed(
  () =>
    [
      ...readMaterialRows([
        "revenueImportedGroups",
        "revenueImportedGroupMetrics",
        "importedRevenueGroups",
      ]).map((item) => ({
        label: importedText(item, ["label", "name", "groupName"]),
        margin: importedText(item, [
          "margin",
          "contribution",
          "edgeContribution",
          "contributionMargin",
        ]),
        profit: importedText(item, ["profit", "income", "grossProfit"]),
      })),
      ...revenueImportedGroups.value,
    ].find((item) =>
      ["当前实际", "当前实际"].includes(normalizeRevenueNodeLabel(item.label)),
    ) ?? { label: "当前实际", margin: "", profit: "" },
);
const revenueForecastMetricRows = computed<RevenueForecastMetricRow[]>(() => [
  { key: "margin", label: "边贡", category: "核心收益指标" },
  { key: "profit", label: "营业利润", category: "" },
  ...revenueImportedMetricFields.map((item, index) => ({
    key: `metric-${index}`,
    label: item.label,
    category: index === 0 ? "价格与成本指标" : "",
  })),
  ...revenueForecastCustomRows,
]);
const revenueImportedMetrics = computed(() =>
  mergeImportedRows(
    revenueImportedMetricFields,
    sourceData.value
      ? [
          {
            label: "市场指导价（含税）",
            value: sourceData.value.marketGuidePriceTaxIncluded ?? "",
          },
          {
            label: "TP价（含税）",
            value: sourceData.value.tpPriceTaxIncluded ?? "",
          },
          { label: "材料成本", value: sourceData.value.materialCost ?? "" },
          {
            label: "变动制造费用",
            value: sourceData.value.variableManufacturingExpense ?? "",
          },
          {
            label: "变动销售费用",
            value: sourceData.value.variableSellingExpense ?? "",
          },
        ]
      : readMaterialRows([
          "revenueImportedMetrics",
          "revenueImportedIndexes",
          "importedRevenueMetrics",
        ])
          .map((item) => ({
            label: importedText(item, ["label", "name", "metricName"]),
            value: importedText(item, ["value", "amount", "metricValue"]),
          }))
          .filter((item) => item.label || item.value),
  ),
);
const revenueInsightIcons = [
  { icon: commitIconAmountOrange, tone: "orange" },
  { icon: commitIconAmountGreen, tone: "green" },
  { icon: commitIconCommentBlue, tone: "blue" },
];
const revenueInsightCards = computed(() =>
  revenuePointLabels.map((title, index) => ({
    title,
    content: revenuePoints[index]?.trim() || "--",
    icon: revenueInsightIcons[index]?.icon ?? commitIconCommentBlue,
    tone: revenueInsightIcons[index]?.tone ?? "blue",
  })),
);
const revenueChartGroups = computed(() =>
  revenueForecastGroups
    .filter((group) => group.label.trim())
    .map((group) => {
      const isCurrentActual = ["当前实际", "当前实际"].includes(
        normalizeRevenueNodeLabel(group.label),
      );
      return {
        id: group.id,
        label: group.label,
        margin:
          (isCurrentActual && sourceData.value?.contributionMargin) ||
          group.margin ||
          "0",
        profit:
          (isCurrentActual && sourceData.value?.operatingProfit) ||
          group.profit ||
          "0",
        metrics: Object.fromEntries(
          revenueForecastMetricRows.value.map((row) => {
            const key = row.key;
            const importedValue = revenueImportedMetrics.value[
              Number(key.replace("metric-", ""))
            ]?.value;
            return [
              key,
              (isCurrentActual && importedValue) ||
                group.metrics?.[key] ||
                "0",
            ];
          }),
        ),
      };
    }),
);
const revenueTableRows = computed(() =>
  revenueForecastMetricRows.value.map((row) => ({
    metric: row.label,
    values: Object.fromEntries(
      revenueChartGroups.value.map((group) => [
        group.id,
        getRevenueForecastValue(group, row.key) || "0",
      ]),
    ),
  })),
);

function toRevenueNumber(value: string) {
  const matched = value.match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : 0;
}

const revenueMarginValues = computed(() =>
  revenueChartGroups.value.map((item) => toRevenueNumber(item.margin)),
);
const revenueProfitValues = computed(() =>
  revenueChartGroups.value.map((item) => toRevenueNumber(item.profit)),
);
const revenueYAxisScale = computed(() =>
  calculateChartYAxisScale([
    ...revenueMarginValues.value,
    ...revenueProfitValues.value,
  ]),
);
const revenueChartOption = computed(() => ({
  animation: false,
  title: {
    text: "{title|收益兑现路径}{sub|（元）}",
    left: 0,
    top: 0,
    textStyle: {
      rich: {
        title: {
          color: "#0f2338",
          fontSize: 17,
          fontWeight: 700,
        },
        sub: {
          color: "#64748b",
          fontSize: 14,
          fontWeight: 400,
        },
      },
    },
  },
  legend: {
    top: 0,
    right: 0,
    itemWidth: 14,
    itemHeight: 14,
    icon: "roundRect",
    textStyle: {
      color: "#475569",
      fontSize: 14,
      fontWeight: 500,
    },
    data: ["边贡", "营业利润"],
  },
  grid: {
    top: 56,
    left: revenueMetricColumnWidth,
    right: 0,
    bottom: 8,
    containLabel: false,
  },
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "shadow",
      shadowStyle: {
        color: "rgba(59, 130, 246, 0.05)",
      },
    },
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { fontSize: 14, color: "#1e293b" },
    extraCssText: "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border-radius: 8px;",
  },
  xAxis: [
    {
      type: "category",
      data: revenueChartGroups.value.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e2e8f0", width: 1 } },
      axisLabel: {
        interval: 0,
        color: "#1e293b",
        fontSize: 14,
        fontWeight: 600,
        margin: 10,
        formatter: (value: string) => formatCommitteeChartXAxisLabel(value),
      },
    },
    {
      type: "category",
      data: revenueChartGroups.value.map((item) => item.label),
      show: false,
    },
  ],
  yAxis: {
    type: "value",
    min: revenueYAxisScale.value.min,
    max: revenueYAxisScale.value.max,
    interval: revenueYAxisScale.value.interval,
    axisLine: {
      show: true,
      lineStyle: { color: "#e2e8f0", width: 1 },
    },
    axisTick: {
      show: true,
      lineStyle: { color: "#cbd5e1" },
      length: 4,
    },
    axisLabel: {
      color: "#64748b",
      fontSize: 12,
      fontWeight: 500,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      formatter: formatChartAxisValue,
      margin: 12,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: "#f1f5f9",
        type: "dashed",
      },
    },
  },
  series: [
    {
      name: "边贡",
      type: "bar",
      xAxisIndex: 0,
      data: revenueMarginValues.value.map((val) => ({
        value: val,
        itemStyle: {
          borderRadius: (val ?? 0) < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0],
        },
      })),
      barWidth: 22,
      barGap: "20%",
      z: 2,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#7eb6ff" },
          { offset: 1, color: "#adc8ff" },
        ]),
      },
      label: { show: false },
    },
    {
      name: "营业利润",
      type: "bar",
      xAxisIndex: 0,
      z: 2,
      data: revenueProfitValues.value.map((val) => ({
        value: val,
        itemStyle: {
          borderRadius: (val ?? 0) < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0],
        },
      })),
      barWidth: 22,
      barGap: "20%",
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#2563eb" },
          { offset: 1, color: "#3b82f6" },
        ]),
      },
      label: { show: false },
    },
    {
      name: "边贡",
      type: "bar",
      xAxisIndex: 1,
      z: 10,
      silent: true,
      data: revenueMarginValues.value.map((val) => ({
        value: val,
      })),
      barWidth: 22,
      barGap: "20%",
      itemStyle: {
        color: "transparent",
        borderColor: "transparent",
      },
      label: {
        show: true,
        position: (params: any) => ((params?.value ?? 0) < 0 ? "bottom" : "top"),
        distance: 6,
        color: "#1d4ed8",
        fontSize: 16,
        fontWeight: 700,
        fontFamily:
          'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: "#ffffff",
        borderColor: "#bfdbfe",
        borderWidth: 1,
        borderRadius: 4,
        padding: [2, 6],
        formatter: (params: any) => formatFinancialNumber(params?.value, "0"),
      },
      tooltip: { show: false },
    },
    {
      name: "营业利润",
      type: "bar",
      xAxisIndex: 1,
      z: 10,
      silent: true,
      data: revenueProfitValues.value.map((val) => ({
        value: val,
      })),
      barWidth: 22,
      barGap: "20%",
      itemStyle: {
        color: "transparent",
        borderColor: "transparent",
      },
      label: {
        show: true,
        position: (params: any) => ((params?.value ?? 0) < 0 ? "bottom" : "top"),
        distance: 6,
        color: "#1d4ed8",
        fontSize: 16,
        fontWeight: 700,
        fontFamily:
          'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: "#ffffff",
        borderColor: "#bfdbfe",
        borderWidth: 1,
        borderRadius: 4,
        padding: [2, 6],
        formatter: (params: any) => formatFinancialNumber(params?.value, "0"),
      },
      tooltip: { show: false },
    },
  ],
}));
type AttachmentDisplayItem = {
  attachmentId: CommitteeId;
  title: string;
  type: "pdf" | "word" | "file";
  icon: string;
  fileName: string;
};

const attachmentItems = computed<AttachmentDisplayItem[]>(() => {
  const rows = displayData.value?.attachments ?? [];
  return rows.map((item) => {
    const fileName = item.fileName || "附件";
    const type = attachmentFileType(fileName, item.fileType);
    return {
      attachmentId: item.id,
      title: fileName,
      type,
      icon: type === "pdf" ? pdfIcon : type === "word" ? wordIcon : fileIcon,
      fileName,
    };
  });
});

async function previewAttachmentItem(item: AttachmentDisplayItem) {
  downloadingAttachmentId.value = item.attachmentId;
  attachmentPreviewFile.value = null;
  attachmentPreviewTitle.value = item.fileName;
  attachmentPreviewVisible.value = true;
  try {
    const response = await downloadCommitteeAttachment(item.attachmentId);
    attachmentPreviewFile.value = response.data;
  } catch {
    attachmentPreviewVisible.value = false;
    BaseToast.error("附件预览失败");
  } finally {
    downloadingAttachmentId.value = null;
  }
}

function goToProjectDetail() {
  if (!meeting.value?.projectId) return;
  void router.push({
    name: "committeeProjectDetail",
    params: { projectId: String(meeting.value.projectId) },
  });
}

function demoGroupMaterial(): CommitteeMeeting {
  return {
    id: "demo-group-material-meeting",
    meetingName: "BE22 平台纯电",
    meetingLevel: "GROUP",
    meetingType: "PRODUCT_COMMITTEE",
    projectId: "demo-project-be22",
    projectName: "BE22 平台纯电",
    gateId: "demo-gate-g9",
    gateName: "G9",
    attemptNo: 1,
    meetingTime: "2026-06-06 09:00",
    reviewDeadlineTime: "2026-06-06 09:00",
    meetingLocation: "集团技术中心 8 层第一会议室",
    meetingStatus: "CUTOFF_LOCKED",
    lockVersion: 0,
    materialLockVersion: 0,
    material: {
      coverTitle: "BE22 平台纯电 SUV 项目",
      reportDepartment: "集团技术与产品管理部",
      executiveSummary:
        "围绕型谱、阀点、交付物、质量、成本、收益与决议事项进行统一汇报。项目整体完成度 86%，当前阀点为 G9，已具备集团产品委员会集中评审条件。",
      previousGateRequirements: JSON.stringify({
        visible: true,
        rows: [
          {
            id: "previous-gate-requirement-1",
            requirement:
              "第二轮降本专项方案补充完整，形成量产成本锁定与收益测算闭环。",
            completion: "专项降本路径已完成评审并纳入本轮材料。",
          },
          {
            id: "previous-gate-requirement-2",
            requirement:
              "确认二级会后新增风险项关闭计划，并同步进入集团会审阅。",
            completion: "各责任部门反馈完成，当前风险均已形成处置要求。",
          },
        ],
      }),
      deliveryReview:
        "质量、成本、收益相关参评部门已形成正式评审意见。关键风险集中在量产爬坡、零部件成本锁定和收益达成路径，需要会议形成统一判断。",
      costPoints: JSON.stringify([
        "成本目标及当前实际（加权）存在 16 元级差距，当前需持续推进专项降本。",
        "通过平台化复用、采购价格重谈及配置优化，SOP 节点预计可回归目标线。",
        "集团技术与产品管理部建议将降本专项列入会后督办清单并按月复盘。",
      ]),
      revenuePoints: JSON.stringify([
        "立项目标收益维持高端系列项目要求，当前仍具备中长期兑现基础。",
        "当前实际收益受成本爬坡与量产准备影响承压，短期边贡较目标回落。",
        "建议将收益测算版本与财务、营销口径再次对齐后，作为下一轮会议的正式基线。",
      ]),
      qualityIssues: JSON.stringify([
        {
          id: "quality-issue-1",
          issue: "量产爬坡质量风险仍需跟踪。",
          action: "形成专项关闭计划并按周更新。",
          ownerDepartment: "质量管理部",
          dueDate: "2026-06-30",
        },
      ]),
      reviewBlocks: JSON.stringify([
        { id: "review-quality", kind: "quality", title: "质量板块" },
        { id: "review-cost", kind: "cost", title: "成本板块" },
        { id: "review-revenue", kind: "revenue", title: "收益板块" },
      ]),
      revenueForecastGroups: JSON.stringify([
        {
          id: "revenue-forecast-target-cost",
          label: "目标成本",
          margin: "78",
          profit: "14",
          metrics: {
            "metric-0": "19.88 元",
            "metric-1": "17.88 元",
            "metric-2": "12.00 元",
            "metric-3": "0.10 元",
            "metric-4": "1.00 元",
          },
        },
        {
          id: "revenue-forecast-current-actual",
          label: "当前实际",
          margin: "66",
          profit: "12",
          metrics: {
            "metric-0": "21.88 元",
            "metric-1": "19.88 元",
            "metric-2": "13.00 元",
            "metric-3": "0.10 元",
            "metric-4": "1.00 元",
          },
        },
        {
          id: "revenue-forecast-sop-forecast",
          label: "SOP预算",
          margin: "78",
          profit: "14",
          metrics: {
            "metric-0": "21.88 元",
            "metric-1": "19.88 元",
            "metric-2": "12.50 元",
            "metric-3": "0.10 元",
            "metric-4": "1.00 元",
          },
        },
        {
          id: "revenue-forecast-sop6-forecast",
          label: "SOP+6Y预算",
          margin: "0",
          profit: "0",
          metrics: {
            "metric-0": "0",
            "metric-1": "0",
            "metric-2": "0",
            "metric-3": "0",
            "metric-4": "0",
          },
        },
      ]),
      costForecastNodes: JSON.stringify([
        { id: "cost-forecast-1", label: "目标成本", value: "72" },
        { id: "cost-forecast-2", label: "当前实际", value: "88" },
        { id: "cost-forecast-3", label: "SOP 预计", value: "72" },
        { id: "cost-forecast-4", label: "SOP+6预计", value: "54" },
      ]),
      decisionText:
        "提请集团产品委员会确认项目是否具备进入下一阶段的决策条件，并明确后续重点督办事项、责任部门和完成时限。",
      aiQualitySuggestion:
        "建议突出当前质量风险清单、关闭率、未关闭项责任部门及预计关闭时间。",
      aiCostSuggestion:
        "建议补充车型投资、零部件目标成本、降本举措及成本偏差说明。",
      aiRevenueSuggestion:
        "建议补充销量、价格、毛利和收益敏感性测算，形成决策支撑。",
    },
  };
}

function isBlankMaterialValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !value.trim())
  );
}

function isEmptyMaterialRows(value: unknown, valueKeys: string[]) {
  if (isBlankMaterialValue(value)) return true;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return false;
    }
  }
  if (!Array.isArray(parsed)) return false;
  return !parsed.some((row) => {
    if (row && typeof row === "object") {
      return valueKeys.some(
        (key) => !isBlankMaterialValue((row as Record<string, unknown>)[key]),
      );
    }
    return !isBlankMaterialValue(row);
  });
}

function selectDisplayString(
  materialValue: unknown,
  displayValue: string | null | undefined,
) {
  return displayValue !== undefined &&
    displayValue !== null &&
    (display.value || isBlankMaterialValue(materialValue))
    ? displayValue
    : materialValue;
}

function buildDisplayBackedMaterial(nextMeeting: CommitteeMeeting) {
  const groupDisplay = nextMeeting.display;
  const material = nextMeeting.material ?? {};
  if (!groupDisplay) return material;

  const cover = groupDisplay.cover;
  const previousGateRequirements = groupDisplay.previousGate?.requirements;
  const cost = groupDisplay.cost;
  const revenue = groupDisplay.revenue;
  const decision = groupDisplay.decision;

  return {
    ...material,
    coverTitle: selectDisplayString(material.coverTitle, cover?.coverTitle),
    reportDepartment: selectDisplayString(
      material.reportDepartment,
      cover?.reportDepartment,
    ),
    previousGateRequirements:
      previousGateRequirements &&
      (display.value || isBlankMaterialValue(material.previousGateRequirements))
        ? JSON.stringify({
            visible: previousGateRequirements.visible !== false,
            rows: (previousGateRequirements.rows ?? []).map((item, index) => ({
              id: item.id ?? `previous-gate-requirement-${index + 1}`,
              requirement: item.requirement ?? "",
              completion: item.completion ?? "",
            })),
          })
        : material.previousGateRequirements,
    reviewBlocks:
      Array.isArray(groupDisplay.reviewBlocks) &&
      groupDisplay.reviewBlocks.length > 0 &&
      (display.value || isBlankMaterialValue(material.reviewBlocks))
        ? JSON.stringify(
            groupDisplay.reviewBlocks.map((item, index) => ({
              id: item.id ?? `review-${item.kind ?? "custom"}-${index + 1}`,
              kind: item.kind ?? "custom",
              title: item.title ?? "自定义板块",
              ...(item.content === undefined || item.content === null
                ? {}
                : { content: item.content }),
            })),
          )
        : material.reviewBlocks,
    decisionText: selectDisplayString(
      material.decisionText,
      decision?.requestedDecision,
    ),
    costPoints:
      Array.isArray(cost?.points) &&
      cost.points.length > 0 &&
      (display.value || isEmptyMaterialRows(material.costPoints, []))
        ? JSON.stringify(cost.points)
        : material.costPoints,
    costForecastNodes:
      Array.isArray(cost?.forecastNodes) &&
      cost.forecastNodes.length > 0 &&
      (display.value ||
        isEmptyMaterialRows(material.costForecastNodes, ["value"]))
        ? JSON.stringify(
            cost.forecastNodes.map((item, index) => ({
              id: item.id ?? `cost-forecast-${index + 1}`,
              label: item.label ?? "",
              value: stringifyDisplayValue(item.value),
            })),
          )
        : material.costForecastNodes,
    revenuePoints:
      Array.isArray(revenue?.points) &&
      revenue.points.length > 0 &&
      (display.value || isEmptyMaterialRows(material.revenuePoints, []))
        ? JSON.stringify(revenue.points)
        : material.revenuePoints,
    revenueForecastGroups:
      Array.isArray(revenue?.forecastGroups) &&
      revenue.forecastGroups.length > 0 &&
      (display.value ||
        isEmptyMaterialRows(material.revenueForecastGroups, [
          "margin",
          "profit",
          "metrics",
        ]))
        ? JSON.stringify(
            revenue.forecastGroups.map((item, index) => ({
              id: item.id ?? `revenue-forecast-${index + 1}`,
              label: item.label ?? "",
              margin: stringifyDisplayValue(item.margin),
              profit: stringifyDisplayValue(item.profit),
              metrics: Object.fromEntries(
                Object.entries(item.metrics ?? {}).map(([key, value]) => [
                  key,
                  stringifyDisplayValue(value),
                ]),
              ),
            })),
          )
        : material.revenueForecastGroups,
    revenueSupplementMetrics:
      Array.isArray(revenue?.supplementMetrics) &&
      revenue.supplementMetrics.length > 0 &&
      (display.value ||
        isEmptyMaterialRows(material.revenueSupplementMetrics, ["value"]))
        ? JSON.stringify(
            revenue.supplementMetrics.map((item, index) => ({
              id: item.id ?? `revenue-supplement-${index + 1}`,
              label: item.label ?? "",
              value: stringifyDisplayValue(item.value),
            })),
          )
        : material.revenueSupplementMetrics,
    qualityIssues:
      Array.isArray(groupDisplay.qualityIssues) &&
      groupDisplay.qualityIssues.length > 0 &&
      (display.value ||
        isEmptyMaterialRows(material.qualityIssues, [
          "issue",
          "action",
          "ownerDepartment",
          "dueDate",
        ]))
        ? JSON.stringify(
            groupDisplay.qualityIssues.map((item, index) => ({
              id: item.id ?? `quality-issue-${index + 1}`,
              issue: item.issue ?? "",
              action: item.action ?? "",
              ownerDepartment: item.ownerDepartment ?? "",
              dueDate: item.dueDate ?? "",
            })),
          )
        : material.qualityIssues,
  };
}

function applyMeetingMaterial(nextMeeting: CommitteeMeeting) {
  meeting.value = nextMeeting;
  opinionSummarySnapshot.value = nextMeeting.material?.opinionSummarySnapshot;
  generatedOpinionSummary.value = undefined;
  const editableMaterial = { ...buildDisplayBackedMaterial(nextMeeting) };
  delete editableMaterial.sourceData;
  Object.assign(form, editableMaterial, {
    expectedLockVersion: nextMeeting.materialLockVersion ?? 0,
  });
  hydratePreviousGateRequirements(form.previousGateRequirements);
  hydrateCostPoints(form.costPoints);
  hydrateCostForecastNodes(form.costForecastNodes);
  hydrateRevenuePoints(form.revenuePoints);
  hydrateRevenueForecastGroups(form.revenueForecastGroups);
  hydrateRevenueSupplementMetrics(form.revenueSupplementMetrics);
  hydrateReviewBlocks(form.reviewBlocks);
  hydrateQualityIssues(form.qualityIssues);
  aiSuggestionsExpanded.value =
    [
      form.aiQualitySuggestion,
      form.aiCostSuggestion,
      form.aiRevenueSuggestion,
    ].some(Boolean) || !!opinionSummarySnapshot.value;
  savedMaterialSnapshot.value = materialSnapshot.value;
  lastSavedAt.value = displayDate(new Date().toISOString());
}

function applyTransferredAiSuggestions() {
  if (display.value || route.query.aiReference !== "1") return;

  try {
    const raw = window.sessionStorage.getItem(
      `${aiSuggestionTransferKey}:${meetingId.value}`,
    );
    if (!raw) return;
    const transfer = JSON.parse(raw) as {
      qualitySuggestion?: unknown;
      costSuggestion?: unknown;
      revenueSuggestion?: unknown;
      opinionSummary?: CommitteeOpinionSummary;
    };
    const qualitySuggestion =
      typeof transfer.qualitySuggestion === "string"
        ? transfer.qualitySuggestion
        : "";
    const costSuggestion =
      typeof transfer.costSuggestion === "string"
        ? transfer.costSuggestion
        : "";
    const revenueSuggestion =
      typeof transfer.revenueSuggestion === "string"
        ? transfer.revenueSuggestion
        : "";
    if (
      transfer.opinionSummary &&
      typeof transfer.opinionSummary === "object"
    ) {
      generatedOpinionSummary.value = transfer.opinionSummary;
      aiSuggestionsExpanded.value = true;
    }
    if (!qualitySuggestion && !costSuggestion && !revenueSuggestion) return;

    form.aiQualitySuggestion = qualitySuggestion;
    form.aiCostSuggestion = costSuggestion;
    form.aiRevenueSuggestion = revenueSuggestion;
    aiSuggestionsExpanded.value = true;
  } catch {
    // 忽略无效的临时传递数据，避免阻断材料加载。
  }
}

function clearSpectrumImageUrl() {
  if (spectrumImageObjectUrl) {
    URL.revokeObjectURL(spectrumImageObjectUrl);
    spectrumImageObjectUrl = "";
  }
  spectrumImageUrl.value = "";
}

function isImageAttachment(file: { fileName: string; fileType: string }) {
  return (
    file.fileType.toLowerCase().startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.fileName)
  );
}

async function loadSpectrumImage(projectId: CommitteeId) {
  clearSpectrumImageUrl();
  spectrumImageLoading.value = true;
  try {
    const displaySpectrum = displayData.value?.productSpectrum ?? [];
    const displayFile = displaySpectrum.find(
      (item) => item.brandPatternFileUrl || item.brandPatternFileName,
    );
    if (displayFile?.brandPatternFileUrl) {
      spectrumImageUrl.value = displayFile.brandPatternFileUrl;
      return;
    }
    if (displayFile?.brandPatternAttachmentId) {
      const response = await downloadCommitteeAttachment(
        String(displayFile.brandPatternAttachmentId),
      );
      spectrumImageObjectUrl = URL.createObjectURL(response.data);
      spectrumImageUrl.value = spectrumImageObjectUrl;
      return;
    }
    const files = await fetchCommitteeAttachments(
      "PROJECT_SPECTRUM",
      projectId,
    );
    const imageFile = files.find(isImageAttachment);
    if (!imageFile) return;

    if (imageFile.fileUrl) {
      spectrumImageUrl.value = imageFile.fileUrl;
      return;
    }

    const response = await downloadCommitteeAttachment(imageFile.id);
    spectrumImageObjectUrl = URL.createObjectURL(response.data);
    spectrumImageUrl.value = spectrumImageObjectUrl;
  } catch {
    clearSpectrumImageUrl();
  } finally {
    spectrumImageLoading.value = false;
  }
}

function defaultPreviousGateRequirementRows(): PreviousGateRequirement[] {
  return [
    {
      id: "previous-gate-requirement-1",
      requirement: "",
      completion: "",
    },
  ];
}

function hydratePreviousGateRequirements(value?: string) {
  previousGateRequirementRows.splice(0);
  showPreviousGateRequirements.value = true;

  if (!value) {
    previousGateRequirementRows.push(...defaultPreviousGateRequirementRows());
    return;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const candidateRows =
      typeof parsed === "object" &&
      parsed !== null &&
      "rows" in parsed &&
      Array.isArray(parsed.rows)
        ? parsed.rows
        : parsed;
    if (typeof parsed === "object" && parsed !== null && "visible" in parsed) {
      showPreviousGateRequirements.value = parsed.visible !== false;
    }
    if (Array.isArray(candidateRows)) {
      const rows = candidateRows
        .filter(
          (item): item is Partial<PreviousGateRequirement> =>
            typeof item === "object" && item !== null,
        )
        .map((item, index) => ({
          id:
            typeof item.id === "string"
              ? item.id
              : `previous-gate-requirement-${index + 1}`,
          requirement:
            typeof item.requirement === "string" ? item.requirement : "",
          completion:
            typeof item.completion === "string" ? item.completion : "",
        }))
        .filter((item) => item.requirement || item.completion);
      if (rows.length) {
        previousGateRequirementRows.push(...rows);
        return;
      }
      previousGateRequirementRows.push(...defaultPreviousGateRequirementRows());
      return;
    }
  } catch {
    // 兼容历史版本的单段文本格式。
  }

  previousGateRequirementRows.push({
    id: "previous-gate-requirement-1",
    requirement: value,
    completion: "",
  });
}

function serializePreviousGateRequirements() {
  return JSON.stringify({
    visible: showPreviousGateRequirements.value,
    rows: previousGateRequirementRows.map(
      ({ id, requirement, completion }) => ({
        id,
        requirement,
        completion,
      }),
    ),
  });
}

function defaultReviewBlocks(): ReviewBlock[] {
  return reviewBlockDefinitions.map((item) => ({
    id: `review-${item.kind}`,
    ...item,
  }));
}

function hydrateReviewBlocks(value?: string) {
  let rows: ReviewBlock[] = [];
  if (value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        rows = parsed
          .filter(
            (item): item is Partial<ReviewBlock> =>
              typeof item === "object" && item !== null,
          )
          .map((item, index) => {
            const kind: ReviewBlockKind =
              item.kind === "quality" ||
              item.kind === "cost" ||
              item.kind === "revenue" ||
              item.kind === "custom"
                ? item.kind
                : "custom";
            return {
              id:
                typeof item.id === "string" && item.id.trim()
                  ? item.id
                  : `review-${kind}-${index + 1}`,
              kind,
              title:
                typeof item.title === "string" && item.title.trim()
                  ? item.title
                  : kind === "custom"
                    ? "自定义板块"
                    : (reviewBlockDefinitions.find((def) => def.kind === kind)
                        ?.title ?? "自定义板块"),
              content:
                typeof item.content === "string" ? item.content : undefined,
            };
          });
      }
    } catch {
      rows = [];
    }
  }
  reviewBlocks.value = rows.length ? rows : defaultReviewBlocks();
}

function serializeReviewBlocks() {
  return JSON.stringify(
    reviewBlocks.value.map(({ id, kind, title, content }) => ({
      id,
      kind,
      title,
      ...(content === undefined ? {} : { content }),
    })),
  );
}

function defaultQualityIssues(): QualityIssue[] {
  return [
    {
      id: "quality-issue-1",
      issue: "",
      action: "",
      ownerDepartment: "",
      dueDate: "",
    },
  ];
}

function hydrateQualityIssues(value?: string) {
  qualityIssues.splice(0, qualityIssues.length);
  if (value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const rows = parsed
          .filter(
            (item): item is Partial<QualityIssue> =>
              typeof item === "object" && item !== null,
          )
          .map((item, index) => ({
            id:
              typeof item.id === "string" && item.id.trim()
                ? item.id
                : `quality-issue-${index + 1}`,
            issue: typeof item.issue === "string" ? item.issue : "",
            action: typeof item.action === "string" ? item.action : "",
            ownerDepartment:
              typeof item.ownerDepartment === "string"
                ? item.ownerDepartment
                : "",
            dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
          }))
          .filter(
            (item) =>
              item.issue || item.action || item.ownerDepartment || item.dueDate,
          );
        if (rows.length) {
          qualityIssues.push(...rows);
          return;
        }
      }
    } catch {
      // 兼容历史空值或非结构化内容。
    }
  }
  qualityIssues.push(...defaultQualityIssues());
}

function serializeQualityIssues() {
  return JSON.stringify(
    qualityIssues.map(({ id, issue, action, ownerDepartment, dueDate }) => ({
      id,
      issue,
      action,
      ownerDepartment,
      dueDate,
    })),
  );
}

function hydrateCostPoints(value?: string) {
  costPoints.splice(0, costPoints.length, ...defaultCostPoints);
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      costPointLabels.forEach((_, index) => {
        const item = parsed[index];
        costPoints[index] =
          typeof item === "string"
            ? item
            : typeof item === "object" && item !== null
              ? importedText(item as ImportedMaterialRow, [
                  "content",
                  "value",
                  "text",
                  "description",
                ])
              : "";
      });
    }
  } catch {
    const rows = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    costPointLabels.forEach((_, index) => {
      if (rows[index]) costPoints[index] = rows[index];
    });
  }
}

function serializeCostPoints() {
  return JSON.stringify(
    costPointLabels.map((_, index) => costPoints[index] ?? ""),
  );
}

function defaultCostForecastNodes(): CostForecastNode[] {
  return costForecastBaseNodes.map((node) => ({
    id: `cost-forecast-${node.id}`,
    label: node.label,
    value: "",
  }));
}

function isReadonlyCostForecastNode(id: string) {
  return requiredCostForecastBaseNodes.some(
    (node) => node.readonly && id === `cost-forecast-${node.id}`,
  );
}

function isBaseCostForecastNode(id: string) {
  return requiredCostForecastBaseNodes.some(
    (node) => id === `cost-forecast-${node.id}`,
  );
}

function withDefaultCostForecastNodes(rows: CostForecastNode[]) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    label: normalizeCostNodeLabel(row.label),
  }));
  const baseRows = requiredCostForecastBaseNodes.map((node) => {
    const id = `cost-forecast-${node.id}`;
    const matched = normalizedRows.find(
      (row) =>
        row.id === id ||
        normalizeCostNodeLabel(row.label) ===
          normalizeCostNodeLabel(node.label),
    );
    return {
      id,
      label: node.label,
      value: node.readonly
        ? currentImportedCostValue(node.label) || matched?.value || ""
        : (matched?.value ?? ""),
    };
  });
  const customRows = rows
    .filter((row) => !isBaseCostForecastNode(row.id))
    .filter(
      (row) =>
        !requiredCostForecastBaseNodes.some(
          (node) =>
            normalizeCostNodeLabel(row.label) ===
            normalizeCostNodeLabel(node.label),
        ),
    );
  return [...baseRows, ...customRows];
}

function getCostForecastValue(node: CostForecastNode) {
  return node.value;
}

function displayCostForecastValue(node: CostForecastNode) {
  return `${formatAmountDisplay(node.value, "--")} 元`;
}

function handleCostForecastBlur(node: CostForecastNode) {
  const current = getCostForecastValue(node);
  const normalized = normalizePositiveAmountOnBlur(current);
  if (normalized !== current) {
    setCostForecastValue(node, normalized);
  }
}

function setCostForecastValue(node: CostForecastNode, value: string) {
  if (isReadonlyCostForecastNode(node.id)) return;
  node.value = value;
}

function setCostForecastInputValue(
  node: CostForecastNode,
  value: string | number,
) {
  setCostForecastValue(node, sanitizePositiveAmountInput(value));
}

function hydrateCostForecastNodes(value?: string) {
  costForecastNodes.splice(0, costForecastNodes.length);
  if (!value) {
    costForecastNodes.push(
      ...withDefaultCostForecastNodes(defaultCostForecastNodes()),
    );
    return;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const rows = parsed
        .filter(
          (item): item is Partial<CostForecastNode> =>
            typeof item === "object" && item !== null,
        )
        .map((item, index) => ({
          id:
            typeof item.id === "string"
              ? item.id
              : `cost-forecast-${index + 1}`,
          label:
            typeof item.label === "string" || typeof item.label === "number"
              ? String(item.label)
              : "",
          value:
            typeof item.value === "string" || typeof item.value === "number"
              ? String(item.value)
              : "",
        }));
      costForecastNodes.push(
        ...withDefaultCostForecastNodes(
          rows.length ? rows : defaultCostForecastNodes(),
        ),
      );
      return;
    }
  } catch {
    // 兼容历史非结构化文本，失败时回到默认预测节点。
  }

  costForecastNodes.push(
    ...withDefaultCostForecastNodes(defaultCostForecastNodes()),
  );
}

function serializeCostForecastNodes() {
  return JSON.stringify(
    costForecastNodes.map(({ id, label, value }) => ({ id, label, value })),
  );
}

function hydrateRevenuePoints(value?: string) {
  revenuePoints.splice(0, revenuePoints.length, ...defaultRevenuePoints);
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      revenuePointLabels.forEach((_, index) => {
        const item = parsed[index];
        revenuePoints[index] = typeof item === "string" ? item : "";
      });
    }
  } catch {
    const rows = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    revenuePointLabels.forEach((_, index) => {
      if (rows[index]) revenuePoints[index] = rows[index];
    });
  }
}

function serializeRevenuePoints() {
  return JSON.stringify(
    revenuePointLabels.map((_, index) => revenuePoints[index] ?? ""),
  );
}

function isDefaultRevenueZero(value: string) {
  return /^0(?:\.0+)?(?:\s*元)?$/.test(value);
}

function normalizeEditableRevenueValue(
  value?: string,
  clearDefaultZero = false,
) {
  const normalized = value?.trim() ?? "";
  return clearDefaultZero && isDefaultRevenueZero(normalized) ? "" : normalized;
}

function normalizeEditableRevenueGroup(row: RevenueForecastGroup) {
  const metrics = row.metrics ?? {};
  const values = [row.margin, row.profit, ...Object.values(metrics)].map(
    (value) => value.trim(),
  );
  const clearDefaultZero =
    values.length > 0 &&
    values.every((value) => !value || isDefaultRevenueZero(value));
  return {
    ...row,
    margin: normalizeEditableRevenueValue(row.margin, clearDefaultZero),
    profit: normalizeEditableRevenueValue(row.profit, clearDefaultZero),
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [
        key,
        normalizeEditableRevenueValue(value, clearDefaultZero),
      ]),
    ),
  };
}

function defaultRevenueForecastGroups(): RevenueForecastGroup[] {
  return revenueForecastBaseNodes.map((node) => {
    const defaultValue = node.readonly ? "0" : "";
    return {
      id: `revenue-forecast-${node.id}`,
      label: node.label,
      margin: defaultValue,
      profit: defaultValue,
      metrics: Object.fromEntries(
        revenueImportedMetricFields.map((_, index) => [
          `metric-${index}`,
          defaultValue,
        ]),
      ),
    };
  });
}

function isReadonlyRevenueForecastGroup(id: string) {
  return id === "revenue-forecast-current-actual";
}

function isBaseRevenueForecastGroup(id: string) {
  return requiredRevenueForecastBaseNodes.some(
    (node) => id === `revenue-forecast-${node.id}`,
  );
}

function withDefaultRevenueForecastGroups(rows: RevenueForecastGroup[]) {
  const normalizedRows = rows.map((row) => ({
    ...row,
    label: normalizeRevenueNodeLabel(row.label),
  }));
  const baseRows = requiredRevenueForecastBaseNodes.map((node) => {
    const id = `revenue-forecast-${node.id}`;
    const matched = normalizedRows.find(
      (row) =>
        row.id === id ||
        normalizeRevenueNodeLabel(row.label) ===
          normalizeRevenueNodeLabel(node.label),
    );
    if (node.readonly) {
      return {
        id,
        label: node.label,
        margin:
          currentActualRevenueGroup.value.margin || matched?.margin || "0",
        profit:
          currentActualRevenueGroup.value.profit || matched?.profit || "0",
        metrics: Object.fromEntries(
          [...revenueImportedMetricFields.map((_, index) => `metric-${index}`), ...revenueForecastCustomRows.map((row) => row.key)].map((key) => {
            const fixedIndex = Number(key.replace("metric-", ""));
            return [key, revenueImportedMetrics.value[fixedIndex]?.value || matched?.metrics?.[key] || "0"];
          }),
        ),
      };
    }
    const editableMatched = matched
      ? normalizeEditableRevenueGroup(matched)
      : undefined;
    const metrics = Object.fromEntries(
      [...revenueImportedMetricFields.map((_, index) => `metric-${index}`), ...revenueForecastCustomRows.map((row) => row.key)].map((key) => {
        return [key, editableMatched?.metrics?.[key] ?? ""];
      }),
    );
    return {
      id,
      label: node.label,
      margin: editableMatched?.margin ?? "",
      profit: editableMatched?.profit ?? "",
      metrics,
    };
  });
  const customRows = rows
    .filter((row) => !isBaseRevenueForecastGroup(row.id))
    .filter(
      (row) =>
        !requiredRevenueForecastBaseNodes.some(
          (node) =>
            normalizeRevenueNodeLabel(row.label) ===
            normalizeRevenueNodeLabel(node.label),
        ),
    )
    .map(normalizeEditableRevenueGroup);
  return [...baseRows, ...customRows];
}

function isRevenueTextMetric(key: string) {
  return key !== "margin" && key !== "profit";
}

function getRevenueForecastValue(group: RevenueForecastGroup, key: string) {
  if (key === "margin") return group.margin;
  if (key === "profit") return group.profit;
  return group.metrics?.[key] ?? "";
}

function displayRevenueForecastValue(group: RevenueForecastGroup, key: string) {
  const value = getRevenueForecastValue(group, key);
  const rawStr = String(value ?? "").trim();
  if (!rawStr || rawStr === "0" || rawStr === "0.00") {
    return "0.00 元";
  }
  if (rawStr.endsWith("元")) {
    return rawStr;
  }
  const formatted = formatAmountDisplay(rawStr, "");
  if (formatted) {
    return `${formatted} 元`;
  }
  return `${rawStr} 元`;
}

function handleRevenueForecastBlur(group: RevenueForecastGroup, key: string) {
  const current = getRevenueForecastValue(group, key);
  const normalized = normalizeAmountOnBlur(current);
  if (normalized !== current) {
    setRevenueForecastValue(group, key, normalized);
  }
}

function setRevenueForecastValue(
  group: RevenueForecastGroup,
  key: string,
  value: string,
) {
  if (isReadonlyRevenueForecastGroup(group.id)) return;
  if (key === "margin") {
    group.margin = value;
    return;
  }
  if (key === "profit") {
    group.profit = value;
    return;
  }
  group.metrics = { ...(group.metrics ?? {}), [key]: value };
}

function setRevenueForecastTextValue(
  group: RevenueForecastGroup,
  key: string,
  value: string | number,
) {
  setRevenueForecastValue(group, key, String(value ?? ""));
}

function setRevenueForecastInputValue(
  group: RevenueForecastGroup,
  key: string,
  value: string | number,
) {
  setRevenueForecastValue(group, key, sanitizeAmountInput(value));
}

function revenueForecastRowClassName({
  row,
  rowIndex,
}: {
  row: RevenueForecastMetricRow;
  rowIndex: number;
}) {
  return row.category && rowIndex > 0 ? "is-category-start" : "";
}

function hydrateRevenueForecastGroups(value?: string) {
  revenueForecastGroups.splice(0, revenueForecastGroups.length);
  revenueForecastCustomRows.splice(0, revenueForecastCustomRows.length);
  if (!value) {
    revenueForecastGroups.push(
      ...withDefaultRevenueForecastGroups(defaultRevenueForecastGroups()),
    );
    return;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const rows = parsed
        .filter(
          (item): item is Partial<RevenueForecastGroup> =>
            typeof item === "object" && item !== null,
        )
        .map((item, index) => ({
          id:
            typeof item.id === "string"
              ? item.id
              : `revenue-forecast-${index + 1}`,
          label: typeof item.label === "string" ? item.label : "",
          margin:
            typeof item.margin === "string" || typeof item.margin === "number"
              ? String(item.margin)
              : "",
          profit:
            typeof item.profit === "string" || typeof item.profit === "number"
              ? String(item.profit)
              : "",
          metrics:
            typeof item.metrics === "object" && item.metrics !== null
              ? Object.fromEntries(
                  Object.entries(item.metrics).map(([key, metricValue]) => [
                    key,
                    typeof metricValue === "string" ||
                    typeof metricValue === "number"
                      ? String(metricValue)
                      : "",
                  ]),
                )
              : {},
          customRows: Array.isArray(item.customRows)
            ? (item.customRows as unknown[])
                .filter(
                  (row): row is Partial<RevenueForecastMetricRow> =>
                    typeof row === "object" && row !== null,
                )
                .map((row) => ({
                  key: typeof row.key === "string" ? row.key : "",
                  label: typeof row.label === "string" ? row.label : "",
                  category: "",
                  custom: true,
                }))
                .filter((row) => row.key && row.label)
            : [],
        }));
      const customRows = rows.find((row) => row.customRows?.length)?.customRows ?? [];
      revenueForecastCustomRows.push(...customRows);
      revenueForecastGroups.push(
        ...withDefaultRevenueForecastGroups(
          rows.length ? rows : defaultRevenueForecastGroups(),
        ),
      );
      return;
    }
  } catch {
    // 兼容历史非结构化文本，失败时回到默认预测分组。
  }

  revenueForecastGroups.push(
    ...withDefaultRevenueForecastGroups(defaultRevenueForecastGroups()),
  );
}

function serializeRevenueForecastGroups() {
  return JSON.stringify(
    revenueForecastGroups.map(({ id, label, margin, profit, metrics }, index) => ({
      id,
      label,
      margin,
      profit,
      metrics: metrics ?? {},
      customRows: index === 0 ? revenueForecastCustomRows : undefined,
    })),
  );
}

function defaultRevenueSupplementMetrics(): RevenueSupplementMetric[] {
  return [
    { id: "revenue-supplement-1", label: "", value: "" },
    { id: "revenue-supplement-2", label: "", value: "" },
  ];
}

function hydrateRevenueSupplementMetrics(value?: string) {
  revenueSupplementMetrics.splice(0, revenueSupplementMetrics.length);
  if (!value) {
    revenueSupplementMetrics.push(...defaultRevenueSupplementMetrics());
    return;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const rows = parsed
        .filter(
          (item): item is Partial<RevenueSupplementMetric> =>
            typeof item === "object" && item !== null,
        )
        .map((item, index) => ({
          id:
            typeof item.id === "string"
              ? item.id
              : `revenue-supplement-${index + 1}`,
          label: typeof item.label === "string" ? item.label : "",
          value: typeof item.value === "string" ? item.value : "",
        }));
      revenueSupplementMetrics.push(
        ...(rows.length ? rows : defaultRevenueSupplementMetrics()),
      );
      return;
    }
  } catch {
    // 兼容历史非结构化文本，失败时回到默认补充指标。
  }

  revenueSupplementMetrics.push(...defaultRevenueSupplementMetrics());
}

function serializeRevenueSupplementMetrics() {
  return JSON.stringify(
    revenueSupplementMetrics.map(({ id, label, value }) => ({
      id,
      label,
      value,
    })),
  );
}

function addPreviousGateRequirement() {
  previousGateRequirementRows.push({
    id: `previous-gate-requirement-${Date.now()}`,
    requirement: "",
    completion: "",
  });
}

function requestPreviousGateRequirementDeletion(id: string) {
  deleteTarget.value = { type: "previous-gate-requirement", id };
}

async function loadDepartmentOptions(gateId?: CommitteeId | null) {
  departmentOptions.value = [];
  if (!gateId) return;
  departmentOptionsLoading.value = true;
  try {
    const result = await fetchCommitteeGateAssignments(gateId);
    departmentOptions.value = result.assignments ?? [];
  } catch {
    departmentOptions.value = [];
  } finally {
    departmentOptionsLoading.value = false;
  }
}

async function load() {
  if (useDemoMaterial.value) {
    subtotalWeightedData.value = null;
    applyMeetingMaterial(demoGroupMaterial());
    clearSpectrumImageUrl();
    return;
  }

  loading.value = true;
  loadError.value = undefined;
  try {
    const nextMeeting = await fetchGroupMaterial(
      meetingId.value,
      display.value,
    );
    if (!display.value) {
      await loadDepartmentOptions(nextMeeting.gateId);
    }
    await loadSubtotalWeightedData(nextMeeting);
    applyMeetingMaterial(nextMeeting);
    applyTransferredAiSuggestions();
    if (display.value) {
      await loadSpectrumImage(nextMeeting.projectId);
    } else {
      clearSpectrumImageUrl();
    }
    if (!display.value && !materialEditable.value) {
      await router.replace({
        name: "committeeGroupMaterialDisplay",
        params: { meetingId: meetingId.value },
      });
    }
  } catch (reason) {
    const source = reason as {
      code?: string;
      message?: string;
      traceId?: string;
    };
    loadError.value = {
      code: source.code ?? "FRONTEND-COMMITTEE-GROUP-MATERIAL-001",
      message: source.message ?? "集团会议材料加载失败，请稍后重试。",
      traceId: source.traceId,
    };
  } finally {
    loading.value = false;
  }
}

async function loadSubtotalWeightedData(nextMeeting: CommitteeMeeting) {
  const projectName = nextMeeting.projectName?.trim();
  const valvePoint = resolveValvePoint(nextMeeting);
  subtotalWeightedData.value = null;
  if (!projectName || !valvePoint) return;

  try {
    subtotalWeightedData.value = await fetchCommitteeSubtotalWeighted(
      projectName,
      valvePoint,
    );
  } catch {
    // 新接口暂不可用时继续展示会议材料中已有的收益取数。
  }
}

function resolveValvePoint(nextMeeting: CommitteeMeeting) {
  const displayGate = nextMeeting.display?.gateInfo;
  const currentGate = nextMeeting.display?.gateProgress?.gates?.find(
    (gate) => gate.current === true,
  );
  const rawValue =
    displayGate?.gateCode ??
    currentGate?.gateCode ??
    nextMeeting.gateName?.match(/G\d+/i)?.[0] ??
    nextMeeting.gateName;
  return rawValue?.trim();
}

async function save() {
  if (!materialEditable.value) return;
  saving.value = true;
  try {
    const { expectedLockVersion, ...content } = form;
    await saveGroupMaterial(meetingId.value, {
      expectedLockVersion,
      content: {
        ...content,
        previousGateRequirements: serializePreviousGateRequirements(),
        costPoints: serializeCostPoints(),
        costForecastNodes: serializeCostForecastNodes(),
        revenuePoints: serializeRevenuePoints(),
        revenueForecastGroups: serializeRevenueForecastGroups(),
        revenueSupplementMetrics: serializeRevenueSupplementMetrics(),
        reviewBlocks: serializeReviewBlocks(),
        qualityIssues: serializeQualityIssues(),
      },
    });
    BaseToast.success("集团会议材料已保存");
    await load();
  } finally {
    saving.value = false;
  }
}

async function refreshSourceData() {
  if (!materialEditable.value) return;
  if (isMaterialDirty.value) {
    BaseToast.warning("请先保存当前材料，再刷新取数");
    return;
  }
  sourceRefreshing.value = true;
  try {
    await refreshGroupMaterialSourceData(
      meetingId.value,
      meeting.value?.materialLockVersion ?? 0,
    );
    BaseToast.success("上会材料取数已刷新");
    await load();
  } finally {
    sourceRefreshing.value = false;
  }
}

defineExpose({ refreshSourceData });

async function generateAiSuggestions() {
  if (!materialEditable.value) return;
  aiGenerating.value = true;
  try {
    const suggestions = await generateGroupMaterialSuggestions(
      meetingId.value,
      form.expectedLockVersion,
    );
    if (
      suggestions &&
      typeof suggestions === "object" &&
      "projects" in suggestions
    ) {
      generatedOpinionSummary.value = suggestions as CommitteeOpinionSummary;
    } else {
      const legacySuggestions = suggestions as unknown as {
        qualitySuggestion?: string;
        costSuggestion?: string;
        revenueSuggestion?: string;
      };
      form.aiQualitySuggestion = legacySuggestions.qualitySuggestion ?? "";
      form.aiCostSuggestion = legacySuggestions.costSuggestion ?? "";
      form.aiRevenueSuggestion = legacySuggestions.revenueSuggestion ?? "";
    }
    aiSuggestionsExpanded.value = true;
    BaseToast.success("参考建议已生成，确认后请手动保存材料");
  } finally {
    aiGenerating.value = false;
  }
}

function displayValue(value: unknown, fallback = "--") {
  return value === undefined || value === null || value === ""
    ? fallback
    : String(value);
}

function stringifyDisplayValue(value: unknown) {
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

function displayDate(value: unknown) {
  if (value === undefined || value === null || value === "") return "--";
  if (typeof value === "string") {
    const formatted = formatDate(value);
    return formatted !== "--" ? formatted : value.trim() || "--";
  }
  if (typeof value === "number" || value instanceof Date) {
    return formatDate(value);
  }
  return "--";
}

function formatProgressValue(value: unknown, fallback = "--") {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `${Math.round((numeric <= 1 ? numeric * 100 : numeric) * 100) / 100}%`;
  }
  return String(value);
}

function displayDepartmentGroup(value: unknown) {
  const group = displayValue(value, "");
  const labels: Record<string, string> = {
    SECOND_COMPANY: "品牌公司职能部室",
    GROUP: "集团部室及管委会办公室",
    GROUP_COMPANY: "集团部室及管委会办公室",
  };
  return labels[group] ?? (group || "评审部门");
}

function normalizeSignalTone(value: unknown): SignalTone {
  const signal = displayValue(value, "EMPTY").toUpperCase();
  if (signal === "GREEN") return "green";
  if (signal === "YELLOW") return "yellow";
  if (signal === "RED") return "red";
  return "empty";
}

function attachmentFileType(
  fileName: string,
  fileType?: string | null,
): AttachmentDisplayItem["type"] {
  const name = fileName.toLowerCase();
  const mime = (fileType ?? "").toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    mime.includes("word")
  ) {
    return "word";
  }
  return "file";
}

function backToMeetingDetail() {
  if (!meetingId.value || meetingId.value === "undefined") {
    void router.replace(
      String(route.query.returnPath || route.meta.breadcrumbParentPath || "/"),
    );
    return;
  }
  router.replace(`/committee/meetings/group/${meetingId.value}`);
}

function goToEdit() {
  if (
    !meetingId.value ||
    meetingId.value === "undefined" ||
    !materialEditable.value
  )
    return;
  router.push(`/committee/meetings/group/${meetingId.value}/material/edit`);
}

function goToDisplay() {
  if (!meetingId.value || meetingId.value === "undefined") return;
  router.push(`/committee/meetings/group/${meetingId.value}/material/display`);
}

function shouldBlockMaterialLeave() {
  return !display.value && isMaterialDirty.value;
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!shouldBlockMaterialLeave()) return;
  event.preventDefault();
  event.returnValue = unsavedMaterialMessage;
}

function focusMaterialTarget(target: MaterialTarget) {
  document
    .querySelector<HTMLElement>(`[data-material-target="${target}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function scrollToReviewBlock(id: string) {
  document
    .querySelector<HTMLElement>(`[data-review-block-id="${id}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addReviewBlock(kind: ReviewBlockKind) {
  if (kind === "custom") {
    const block: ReviewBlock = {
      id: `review-custom-${Date.now()}`,
      kind,
      title: "自定义板块",
      content: "",
    };
    reviewBlocks.value.push(block);
    return;
  }
  if (reviewBlocks.value.some((item) => item.kind === kind)) return;
  const definition = reviewBlockDefinitions.find((item) => item.kind === kind);
  if (!definition) return;
  const block = { id: `review-${kind}`, ...definition };
  reviewBlocks.value.push(block);
}

function moveReviewBlock(id: string, direction: "top" | "up" | "down") {
  const index = reviewBlocks.value.findIndex((item) => item.id === id);
  if (index < 0) return;
  const targetIndex =
    direction === "top"
      ? 0
      : direction === "up"
        ? Math.max(0, index - 1)
        : Math.min(reviewBlocks.value.length - 1, index + 1);
  if (targetIndex === index) return;
  const [block] = reviewBlocks.value.splice(index, 1);
  if (block) reviewBlocks.value.splice(targetIndex, 0, block);
}

function requestBlockDeletion(id: string) {
  deleteTarget.value = { type: "block", id };
}

function addQualityIssue() {
  const id = `quality-issue-${Date.now()}`;
  qualityIssues.push({
    id,
    issue: "",
    action: "",
    ownerDepartment: "",
    dueDate: "",
  });
}

function requestQualityIssueDeletion(id: string) {
  deleteTarget.value = { type: "quality-issue", id };
}

function addCostForecastNode() {
  costForecastNodes.push({
    id: `cost-forecast-custom-${Date.now()}`,
    label: "",
    value: "",
  });
}

function removeCostForecastNode(id: string) {
  if (isBaseCostForecastNode(id)) return;
  const index = costForecastNodes.findIndex((item) => item.id === id);
  if (index >= 0) costForecastNodes.splice(index, 1);
}

function addRevenueForecastGroup() {
  revenueForecastGroups.push({
    id: `revenue-forecast-custom-${Date.now()}`,
    label: "",
    margin: "",
    profit: "",
    metrics: Object.fromEntries(
      revenueImportedMetricFields.map((_, index) => [`metric-${index}`, ""]),
    ),
  });
}

function addRevenueForecastMetricRow() {
  const key = `custom-metric-${Date.now()}`;
  revenueForecastCustomRows.push({
    key,
    label: "自定义指标",
    category: "",
    custom: true,
  });
  revenueForecastGroups.forEach((group) => {
    group.metrics = { ...(group.metrics ?? {}), [key]: "" };
  });
}

function removeRevenueForecastMetricRow(key: string) {
  const index = revenueForecastCustomRows.findIndex((row) => row.key === key);
  if (index < 0) return;
  revenueForecastCustomRows.splice(index, 1);
  revenueForecastGroups.forEach((group) => {
    if (!group.metrics) return;
    const { [key]: _removed, ...metrics } = group.metrics;
    group.metrics = metrics;
  });
}

function removeRevenueForecastGroup(id: string) {
  if (isBaseRevenueForecastGroup(id)) return;
  const index = revenueForecastGroups.findIndex((item) => item.id === id);
  if (index >= 0) revenueForecastGroups.splice(index, 1);
}

function confirmMaterialDeletion() {
  const target = deleteTarget.value;
  if (!target) return;
  if (target.type === "quality-issue") {
    const index = qualityIssues.findIndex((item) => item.id === target.id);
    if (index >= 0) qualityIssues.splice(index, 1);
  } else if (target.type === "previous-gate-requirement") {
    const index = previousGateRequirementRows.findIndex(
      (item) => item.id === target.id,
    );
    if (index >= 0) previousGateRequirementRows.splice(index, 1);
  } else {
    const index = reviewBlocks.value.findIndex((item) => item.id === target.id);
    if (index >= 0) reviewBlocks.value.splice(index, 1);
  }
  deleteTarget.value = null;
}

async function toggleFullscreen() {
  const target = document.querySelector<HTMLElement>(
    ".committee-group-material-display",
  );
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await target?.requestFullscreen?.();
}

const coverTitle = computed(
  () =>
    (display.value ? displayData.value?.cover?.coverTitle : form.coverTitle) ||
    form.coverTitle ||
    `${displayValue(meeting.value?.projectName)} ${displayValue(meeting.value?.gateName)} 集团会议汇报材料`,
);
const coverFacts = computed(() => [
  {
    label: "当前阀点",
    value: displayValue(
      displayData.value?.cover?.gateName,
      currentGateName.value,
    ),
  },
  {
    label: "会议时间",
    value: displayDate(
      displayData.value?.cover?.meetingTime ?? meeting.value?.meetingTime,
    ),
  },
  {
    label: "会议地点",
    value: displayValue(
      displayData.value?.cover?.meetingLocation ??
        meeting.value?.meetingLocation,
    ),
  },
]);
const overviewFacts = computed(() => {
  const overview = displayData.value?.projectOverview;
  const useDemoFallbacks = useDisplayDemoFallbacks.value;
  return [
    {
      label: "项目代号",
      value: displayValue(overview?.projectName ?? meeting.value?.projectName),
      icon: commitIconDocumentBlue,
      tone: "blue",
    },
    {
      label: "品牌",
      value: displayValue(
        overview?.brandName ?? overview?.brand,
        useDemoFallbacks ? "北京汽车" : "--",
      ),
      icon: commitIconBaic,
      tone: "red",
    },
    {
      label: "项目类型",
      value: displayValue(
        overview?.projectType,
        useDemoFallbacks ? "整车项目" : "--",
      ),
      icon: commitIconGridGreen,
      tone: "green",
    },
    {
      label: "生产基地",
      value: displayValue(
        overview?.productionBase,
        useDemoFallbacks ? "北京工厂" : "--",
      ),
      icon: commitIconRobot,
      tone: "blue",
    },
    {
      label: "所属公司",
      value: displayValue(overview?.owningCompany),
      icon: commitIconLayers,
      tone: "green",
    },
    {
      label: "项目总投资",
      value: displayValue(
        overview?.totalInvestment,
        useDemoFallbacks ? "4.28 亿元" : "--",
      ),
      icon: commitIconAmountOrange,
      tone: "orange",
    },
    {
      label: "车型投资",
      value: displayValue(
        overview?.vehicleInvestment ?? sourceData.value?.vehicleInvestment,
      ),
      icon: commitIconCar,
      tone: "soft-blue",
    },
    {
      label: "预算执行率",
      value: formatProgressValue(
        overview?.executionRate,
        useDemoFallbacks ? "82%" : "--",
      ),
      icon: commitIconPieBlue,
      tone: "blue",
    },
    {
      label: "项目背景",
      value: displayValue(
        overview?.projectBackground,
        useDemoFallbacks
          ? "BE22 项目面向纯电 SUV 主流市场，围绕平台化、智能化与成本收益平衡形成集团级决策材料。"
          : "--",
      ),
      icon: commitbackground,
      tone: "soft-blue",
      full: true,
    },
  ];
});

async function renderCostChart() {
  if (!display.value) return;
  await nextTick();
  const element = displayRootRef.value?.querySelector<HTMLElement>(
    '[data-review-chart="cost"]',
  );
  if (!element) {
    costChart?.dispose();
    costChart = null;
    return;
  }
  if (costChart?.getDom() !== element) {
    costChart?.dispose();
    costChart = echarts.init(element);
  }
  costChart ??= echarts.init(element);
  costChart.setOption(costChartOption.value, true);
  if (typeof costChart.off === "function") {
    costChart.off("click");
  }
  if (typeof costChart.on === "function") {
    costChart.on("click", handleCostChartClick);
  }
}

function handleCostChartClick(_params?: unknown) {
  openCostData();
}

async function renderRevenueChart() {
  if (!display.value) return;
  await nextTick();
  const element = displayRootRef.value?.querySelector<HTMLElement>(
    '[data-review-chart="revenue"]',
  );
  if (!element) {
    revenueChart?.dispose();
    revenueChart = null;
    return;
  }
  if (revenueChart?.getDom() !== element) {
    revenueChart?.dispose();
    revenueChart = echarts.init(element);
  }
  revenueChart ??= echarts.init(element);
  revenueChart.setOption(revenueChartOption.value, true);
  if (typeof revenueChart.off === "function") {
    revenueChart.off("click", handleRevenueChartClick);
  }
  if (typeof revenueChart.on === "function") {
    revenueChart.on("click", handleRevenueChartClick);
  }
}

function handleRevenueChartClick(params: unknown) {
  if (
    typeof params !== "object" ||
    params === null ||
    !("seriesName" in params) ||
    !["边贡", "营业利润"].includes(String(params.seriesName))
  ) {
    return;
  }
  const subjectId = params.seriesName === "边贡" ? 34 : 35;
  openRevenueData(
    displayData.value?.revenue?.revenueRecordIds?.[String(subjectId)],
  );
}

function handleRevenueTableRowClick(row: { metric?: string }) {
  openRevenueData(revenueMetricSubjectId(row.metric ?? ""));
}

async function renderCharts() {
  await Promise.all([renderCostChart(), renderRevenueChart()]);
}

function resizeCharts() {
  costChart?.resize();
  revenueChart?.resize();
}

onBeforeRouteLeave(async () => {
  if (!isMaterialDirty.value) return true;
  try {
    await openConfirm({
      title: "未保存提示",
      message: unsavedMaterialMessage,
      confirmText: "离开",
      cancelText: "取消",
    });
    return true;
  } catch {
    return false;
  }
});

let unmounted = false;

onMounted(() => {
  window.addEventListener("resize", resizeCharts);
  window.addEventListener("beforeunload", handleBeforeUnload);
  void load().then(() => {
    if (!unmounted) return renderCharts();
  });
});

onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener("resize", resizeCharts);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  costChart?.dispose();
  revenueChart?.dispose();
  costChart = null;
  revenueChart = null;
});

watch([display, costChartOption, revenueChartOption], () => {
  void renderCharts();
});
</script>

<template>
  <PageContainer
    class="bq-management-page"
    :class="{ 'is-group-material-edit': !display }"
    :variant="display ? 'framed' : 'plain'"
    :title="display ? '集团会议材料展示' : '编辑集团会议材料'"
    description="围绕质量、成本、收益形成结构化上会材料。"
  >
    <TraceErrorAlert v-if="loadError" v-bind="loadError" />
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="backToMeetingDetail"
      >
        返回会议详情
      </PermissionButton>
      <PermissionButton
        v-if="display"
        :icon="FullScreen"
        @click="toggleFullscreen"
      >
        全屏
      </PermissionButton>
      <PermissionButton
        v-if="display && !useDemoMaterial && materialEditable"
        type="primary"
        plain
        @click="goToEdit"
      >
        编辑材料
      </PermissionButton>
      <PermissionButton
        v-if="!display && materialEditable"
        :icon="View"
        plain
        @click="goToDisplay"
      >
        查看上会展示
      </PermissionButton>
      <PermissionButton
        v-if="!display && materialEditable"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </PermissionButton>
    </template>

    <div
      v-if="display"
      ref="displayRootRef"
      v-loading="loading"
      class="committee-group-material-display"
    >
      <section class="group-material-display__hero">
        <div class="group-material-display__hero-brand">
          <img :src="baicGroupLogo" alt="北汽集团" />
        </div>
        <div class="group-material-display__hero-panel">
          <div class="group-material-display__hero-backdrop" aria-hidden="true">
            <img :src="groupMeetingBackdrop" alt="" />
          </div>
          <div class="group-material-display__hero-copy">
            <h2>{{ coverTitle }}</h2>
            <p class="group-material-display__hero-department">
              汇报部门：{{ form.reportDepartment || "集团技术与产品管理部" }}
            </p>
          </div>
          <div class="group-material-display__cover-facts">
            <article
              v-for="item in coverFacts"
              :key="item.label"
              class="group-material-display__cover-fact"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
        </div>
      </section>

      <section class="group-material-display__section">
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.spectrum).padStart(2, "0") }}</p>
          </div>
        </header>
        <div class="group-material-display__spectrum-card">
          <div
            v-if="spectrumImageUrl"
            v-loading="spectrumImageLoading"
            class="group-material-display__spectrum-image-wrap"
          >
            <img
              class="group-material-display__spectrum-image"
              :src="spectrumImageUrl"
              alt="产品型谱"
              @error="clearSpectrumImageUrl"
            />
          </div>
          <div
            v-else
            v-loading="spectrumImageLoading"
            class="group-material-display__spectrum-empty"
          >
            暂无型谱图片
          </div>
        </div>
      </section>

      <section class="group-material-display__section">
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.gateInfo).padStart(2, "0") }}</p>
          </div>
        </header>
        <div class="group-material-display__gate-report-card">
          <h4
            class="is-clickable"
            @click="
              openGateData(displayData?.gateInfo?.gateId ?? meeting?.gateId)
            "
          >
            {{ currentGateName }} 阀点汇报
          </h4>
          <div class="group-material-display__subsection">
            <div class="group-material-display__subsection-head">阀点意图</div>
            <div class="group-material-display__subsection-body">
              <div class="committee-text-strong">
                {{ currentGateName }} · 集团评审
              </div>
              <ul class="group-material-display__bullet-list group-material-display__bullet-list--dark group-material-display__intent-bullets">
                <li>
                  <span class="intent-label">阀点目的：</span><span class="intent-val">{{ gatePurpose }}</span>
                </li>
                <li>
                  <span class="intent-label">核心工作内容：</span><span class="intent-val">{{ coreWorkContent }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="group-material-display__subsection">
            <div class="group-material-display__subsection-head">项目概述</div>
            <article
              class="group-material-display__overview-composite is-clickable"
              @click="openProjectDetail"
            >
              <div class="group-material-display__overview-main">
                <!--                <div class="group-material-display__overview-title">-->
                <!--                  <h4>项目基础信息</h4>-->
                <!--                  <span-->
                <!--                    >{{ displayValue(meeting?.gateName, "G9") }} 阀点汇报</span-->
                <!--                  >-->
                <!--                </div>-->
                <div class="group-material-display__fact-grid">
                  <div
                    v-for="item in overviewFacts"
                    :key="item.label"
                    class="group-material-display__fact"
                    :class="[
                      item.full ? 'group-material-display__fact--full' : '',
                      item.tone ? `is-${item.tone}` : '',
                    ]"
                  >
                    <span
                      v-if="item.icon"
                      class="group-material-display__fact-icon"
                      :class="item.tone ? `is-${item.tone}` : ''"
                    >
                      <img :src="item.icon" alt="" />
                    </span>
                    <div class="group-material-display__fact-body">
                      <span>{{ item.label }}</span>
                      <span class="committee-text-strong">{{
                        item.value
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="group-material-display__section">
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.timeline).padStart(2, "0") }}</p>
          </div>
        </header>
        <div class="group-material-display__section-card">
          <div
            v-if="timelinePlan.length || timelineActual.length"
            class="group-material-display__timeline-board"
          >
            <div
              class="group-material-display__timeline-row group-material-display__timeline-row--year"
              :style="timelineGridStyle"
            >
              <span class="group-material-display__timeline-year-label"
                >年</span
              >
              <span
                v-for="year in timelineYears"
                :key="year.year"
                class="committee-text-strong"
                :style="{ gridColumn: `span ${year.count}` }"
              >
                {{ year.year }}年
              </span>
            </div>
            <div
              class="group-material-display__timeline-row group-material-display__timeline-row--month"
              :style="timelineGridStyle"
            >
              <span>月</span>
              <b
                v-for="(month, index) in timelineMonths"
                :key="`${month}-${index}`"
              >
                {{ month }}
              </b>
            </div>
            <div
              class="group-material-display__timeline-row group-material-display__timeline-row--gates"
              :style="timelineGridStyle"
            >
              <span>
                <span class="committee-text-strong">预计节点时间</span>
                <small>计划时间轴</small>
              </span>
              <div class="group-material-display__timeline-track">
                <div
                  v-for="point in timelinePlan"
                  :key="`plan-${point.gate}`"
                  class="group-material-display__timeline-point"
                  :style="timelinePointStyle(point)"
                >
                  <span
                    class="group-material-display__gate-pill"
                    :class="[
                      point.current ? 'is-current' : '',
                      point.completed ? 'is-completed' : '',
                    ]"
                  >
                    <img
                      :src="
                        point.current || point.completed
                          ? commitIconMilestone
                          : commitIconMilestoneNormal
                      "
                      alt=""
                    />
                    <b>{{ point.gate }}</b>
                  </span>
                  <small>{{ formatTimelinePointDate(point.date) }}</small>
                  <BaseStatusTag
                    v-if="point.current"
                    class="group-material-display__timeline-status"
                    label="当前进行"
                    type="primary"
                  />
                </div>
              </div>
            </div>
            <div
              class="group-material-display__timeline-row group-material-display__timeline-row--gates"
              :style="timelineGridStyle"
            >
              <span>
                <span class="committee-text-strong">实际完成时间</span>
                <small class="is-green">实际时间轴</small>
              </span>
              <div class="group-material-display__timeline-track">
                <div
                  v-for="point in timelineActual"
                  :key="`actual-${point.gate}`"
                  class="group-material-display__timeline-point"
                  :style="timelinePointStyle(point)"
                >
                  <span
                    class="group-material-display__gate-pill"
                    :class="[
                      point.current ? 'is-current' : '',
                      point.completed ? 'is-completed' : '',
                    ]"
                  >
                    <img
                      :src="
                        point.current || point.completed
                          ? commitIconMilestone
                          : commitIconMilestoneNormal
                      "
                      alt=""
                    />
                    <b>{{ point.gate }}</b>
                  </span>
                  <small>{{ formatTimelinePointDate(point.date) }}</small>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="group-material-display__timeline-empty">
            暂无阀点进度数据
          </div>
        </div>
      </section>

      <section
        v-if="showPreviousGateRequirements"
        class="group-material-display__section"
      >
        <header class="group-material-display__section-head">
          <div>
            <p>
              {{
                String(sectionNumbers.previousGateRequirements).padStart(2, "0")
              }}
            </p>
            <h3>
              上个阀点<span v-if="displayData?.previousGate?.gateName">（{{ displayData.previousGate.gateName }}）</span>过会要求
            </h3>
          </div>
        </header>
        <div class="group-material-display__section-card">
          <el-table
            class="group-material-display__blue-table"
            :data="previousGateRows"
            row-key="index"
          >
            <el-table-column
              prop="index"
              label="序号"
              width="80"
              align="center"
            />
            <el-table-column
              prop="requirement"
              label="要求事项"
              min-width="360"
            />
            <el-table-column
              prop="completion"
              label="完成进度"
              min-width="360"
            />
          </el-table>
        </div>
      </section>

      <section class="group-material-display__section">
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.deliverables).padStart(2, "0") }}</p>
          </div>
        </header>
        <div class="group-material-display__blue-panel">
          <header>
            <span class="committee-text-strong">交付物清单</span>
            <span>共 {{ deliverableItems.length }} 项</span>
          </header>
          <div class="group-material-display__deliverables">
            <span
              v-for="item in visibleDeliverableItems"
              :key="item.label"
              class="group-material-display__deliverable-item"
            >
              <span class="group-material-display__deliverable-icon">
                <img :src="fileIcon" alt="" />
              </span>
              <b>{{ item.label }}</b>
            </span>
          </div>
          <button
            v-if="showDeliverableToggle"
            class="group-material-display__deliverable-toggle"
            type="button"
            :aria-expanded="deliverablesExpanded"
            @click="deliverablesExpanded = !deliverablesExpanded"
          >
            <el-icon>
              <ArrowUp v-if="deliverablesExpanded" />
              <ArrowDown v-else />
            </el-icon>
            {{ deliverablesExpanded ? "折叠" : "展开" }}
          </button>
        </div>
        <div class="group-material-display__blue-panel">
          <header>
            <span class="committee-text-strong">评审矩阵</span>
          </header>
          <article
            v-for="group in reviewMatrixGroups"
            :key="group.title"
            class="group-material-display__matrix-group"
          >
            <div class="group-material-display__matrix-title">
              <span class="committee-text-strong">{{ group.title }}</span>
              <span>{{ group.count }}</span>
            </div>
            <el-table
              class="group-material-display__matrix-table"
              :data="group.rows"
              row-key="dimension"
              :row-class-name="reviewMatrixRowClassName"
            >
              <el-table-column
                label="评审维度"
                width="120"
                fixed
                align="center"
              >
                <template #default="{ row }">
                  <div
                    class="group-material-display__matrix-dimension-cell"
                    :class="{
                      'is-conclusion-dimension': row.dimension === '结论建议',
                    }"
                  >
                    <span>{{ row.dimension }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-for="department in group.departments"
                :key="department.key"
                :label="department.label"
                min-width="94"
                align="center"
              >
                <template #default="{ row }">
                  <span
                    v-if="row[department.key] !== 'empty'"
                    class="group-material-display__signal"
                    :class="[
                      `is-${row[department.key]}`,
                      {
                        'is-conclusion-signal': row.dimension === '结论建议',
                        'is-clickable': department.taskId,
                      },
                    ]"
                    @click="openReviewTask(department.taskId)"
                  ></span>
                  <span v-else class="group-material-display__signal-empty">
                    --
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </article>
        </div>
      </section>

      <section class="group-material-display__section">
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.review).padStart(2, "0") }}</p>
          </div>
        </header>
        <template v-for="block in reviewBlocks" :key="block.id">
          <div
            v-if="block.kind === 'quality'"
            class="group-material-display__blue-panel group-material-display__blue-panel--spaced-table"
          >
            <header>
              <span class="committee-text-strong">{{ block.title }}</span>
              <span>共 {{ qualityOpinionRows.length }} 个</span>
            </header>
            <el-table
              class="group-material-display__blue-table"
              :data="qualityOpinionRows"
              row-key="index"
            >
              <el-table-column
                prop="index"
                label="序号"
                width="80"
                align="center"
              />
              <el-table-column prop="problem" label="问题" min-width="260" />
              <el-table-column prop="measure" label="措施" min-width="260" />
              <el-table-column prop="owner" label="责任部门" min-width="140" />
              <el-table-column prop="date" label="完成时间" width="130" />
            </el-table>
          </div>
          <div
            v-else-if="block.kind === 'cost'"
            class="group-material-display__blue-panel"
          >
            <header>
              <span class="committee-text-strong">{{ block.title }}</span>
            </header>
            <div class="group-material-display__cost-block">
              <div class="group-material-display__cost-insights">
                <article
                  v-for="item in costInsightCards"
                  :key="item.title"
                  class="group-material-display__cost-insight"
                >
                  <span
                    class="group-material-display__cost-insight-icon"
                    :class="`is-${item.tone}`"
                  >
                    <img :src="item.icon" alt="" />
                  </span>
                  <div>
                    <span>{{ item.title }}</span>
                    <span class="committee-text-strong">{{
                      item.content
                    }}</span>
                  </div>
                </article>
              </div>
              <div
                data-review-chart="cost"
                class="group-material-display__cost-echarts is-clickable"
                @click="openCostData"
              ></div>
            </div>
          </div>
          <div
            v-else-if="block.kind === 'revenue'"
            class="group-material-display__blue-panel"
          >
            <header>
              <span class="committee-text-strong">{{ block.title }}</span>
            </header>
            <div class="group-material-display__revenue-block">
              <div class="group-material-display__cost-insights">
                <article
                  v-for="item in revenueInsightCards"
                  :key="item.title"
                  class="group-material-display__cost-insight"
                >
                  <span
                    class="group-material-display__cost-insight-icon"
                    :class="`is-${item.tone}`"
                  >
                    <img :src="item.icon" alt="" />
                  </span>
                  <div>
                    <span>{{ item.title }}</span>
                    <span class="committee-text-strong">{{
                      item.content
                    }}</span>
                  </div>
                </article>
              </div>
              <div
                data-review-chart="revenue"
                class="group-material-display__revenue-echarts is-clickable"
              ></div>
              <el-table
                class="group-material-display__revenue-table"
                :data="revenueTableRows"
                row-key="metric"
                border
                :show-header="false"
                @row-click="handleRevenueTableRowClick"
              >
                <el-table-column
                  prop="metric"
                  label="指标"
                  :width="revenueMetricColumnWidth"
                  align="center"
                  class-name="revenue-metric-col"
                />
                <el-table-column
                  v-for="group in revenueChartGroups"
                  :key="group.id"
                  :label="group.label"
                  align="center"
                  :class-name="
                    [
                      '目标成本',
                      '当前实际',
                    ].includes(normalizeRevenueNodeLabel(group.label))
                      ? 'revenue-data-col is-emphasis-col'
                      : 'revenue-data-col'
                  "
                >
                  <template #default="{ row }">
                    <span
                      :class="{
                        'group-material-display__revenue-value--emphasis': [
                          '目标成本',
                          '当前实际',
                        ].includes(normalizeRevenueNodeLabel(group.label)),
                        'is-clickable': Boolean(
                          displayData?.revenue?.revenueRecordIds,
                        ),
                      }"
                      @click="
                        openRevenueData(revenueMetricSubjectId(row.metric))
                      "
                    >
                      {{ formatRevenueMetricCellValue(row.values[group.id], group.label) }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
          <div
            v-else
            class="group-material-display__blue-panel group-material-display__custom-block"
          >
            <header>
              <span class="committee-text-strong">{{ block.title }}</span>
            </header>
            <p>{{ block.content || "--" }}</p>
          </div>
        </template>
      </section>

      <section class="group-material-display__section">
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.decision).padStart(2, "0") }}</p>
          </div>
        </header>
        <div class="group-material-display__decision-box">
          <el-input
            v-model="form.decisionText"
            class="group-material-display__decision-input"
            type="textarea"
            resize="none"
            :autosize="{ minRows: 4, maxRows: 6 }"
            :readonly="!materialEditable"
            placeholder="请输入提请决议事项"
          />
          <PermissionButton
            v-if="materialEditable"
            type="primary"
            size="small"
            :loading="saving"
            @click="save"
          >
            保存
          </PermissionButton>
        </div>
      </section>

      <section
        class="group-material-display__section group-material-display__section--attachments"
      >
        <header class="group-material-display__section-head">
          <div>
            <p>{{ String(sectionNumbers.attachments).padStart(2, "0") }}</p>
          </div>
        </header>
        <div class="group-material-display__attachments">
          <div
            v-if="!attachmentItems.length"
            class="group-material-display__attachments-empty"
          >
            暂无会议材料附件
          </div>
          <template v-else>
            <article
              v-for="item in attachmentItems"
              :key="item.attachmentId"
              class="group-material-display__attachment-card"
              role="button"
              tabindex="0"
              :aria-label="`预览附件：${item.title}`"
              :aria-busy="downloadingAttachmentId === item.attachmentId"
              @click="previewAttachmentItem(item)"
              @keydown.enter.prevent="previewAttachmentItem(item)"
              @keydown.space.prevent="previewAttachmentItem(item)"
            >
              <span
                class="group-material-display__attachment-icon"
                :class="`is-${item.type}`"
              >
                <img :src="item.icon" alt="" />
              </span>
              <div class="group-material-display__attachment-body">
                <span class="committee-text-strong">{{ item.title }}</span>
              </div>
            </article>
          </template>
        </div>
      </section>
    </div>

    <div v-else v-loading="loading" class="group-material-edit-form">
      <div
        class="group-material-edit-form__save-state"
        :class="{ 'is-dirty': isMaterialDirty }"
      >
        <div>
          <span class="group-material-edit-form__save-dot"></span>
          <strong>{{
            isMaterialDirty ? "有未保存修改" : "当前内容已保存"
          }}</strong>
        </div>
        <span>最近保存：{{ lastSavedAt || "--" }}</span>
      </div>

      <section
        class="group-material-edit-form__scope-guide"
        aria-label="材料编辑范围"
      >
        <div class="group-material-edit-form__scope-guide-main">
          <div class="group-material-edit-form__scope-guide-heading">
            <span class="group-material-edit-form__scope-guide-icon">
              <el-icon><EditPen /></el-icon>
            </span>
            <strong>本页需人工维护</strong>
            <el-tag size="small" effect="plain" type="primary">
              {{ editableScope.length }} 项
            </el-tag>
          </div>

          <div class="group-material-edit-form__scope-guide-actions">
            <PermissionButton
              v-for="item in editableScope"
              :key="item.target"
              link
              type="primary"
              :data-testid="`group-material-scope-edit-${item.target}`"
              @click="focusMaterialTarget(item.target)"
            >
              {{ item.label }}
            </PermissionButton>
          </div>

          <PermissionButton
            link
            class="group-material-edit-form__scope-guide-toggle"
            :aria-expanded="materialScopeExpanded"
            data-testid="group-material-scope-toggle"
            @click="materialScopeExpanded = !materialScopeExpanded"
          >
            {{ materialScopeExpanded ? "收起完整范围" : "查看完整范围" }}
            <el-icon>
              <ArrowUp v-if="materialScopeExpanded" />
              <ArrowDown v-else />
            </el-icon>
          </PermissionButton>
        </div>

        <div class="group-material-edit-form__scope-guide-context">
          <div class="group-material-edit-form__scope-guide-meeting">
            <strong>{{ displayValue(meeting?.meetingName) }}</strong>
            <span>项目 {{ displayValue(meeting?.projectName) }}</span>
            <span>当前阀点 {{ currentGateName }}</span>
          </div>
          <span class="group-material-edit-form__scope-guide-readonly">
            <el-icon><Lock /></el-icon>
            其余 {{ readonlyScope.length }} 项由系统自动带入
          </span>
        </div>

        <el-collapse-transition>
          <div
            v-if="materialScopeExpanded"
            class="group-material-edit-form__scope-guide-detail"
          >
            <strong>系统带入内容</strong>
            <div class="group-material-edit-form__scope-guide-detail-items">
              <span v-for="item in readonlyScope" :key="item">
                <i></i>{{ item }}
                <PermissionButton
                  v-if="item === '产品型谱与阀点信息'"
                  link
                  type="primary"
                  data-testid="group-material-project-gate-view"
                  @click="goToProjectDetail"
                >
                  查看
                </PermissionButton>
              </span>
            </div>
          </div>
        </el-collapse-transition>
      </section>

      <el-form label-width="128px">
        <section
          class="group-material-edit-form__section"
          data-material-target="cover"
        >
          <BaseSectionTitle
            class="group-material-edit-form__section-head"
            title="封面信息"
            heading-tag="h2"
          >
            <template #title-extra>
              <el-tooltip
                content="维护汇报标题和落款信息，作为展示页封面统一引用。"
                placement="top"
              >
                <el-icon class="group-material-edit-form__help-icon"
                  ><QuestionFilled
                /></el-icon>
              </el-tooltip>
            </template>
          </BaseSectionTitle>
          <div class="group-material-edit-form__cover-editor">
            <el-form-item
              class="group-material-edit-form__top-field is-span-full"
              label-position="top"
              label="汇报标题"
            >
              <el-input
                v-model="form.coverTitle"
                placeholder="请输入汇报标题"
              />
            </el-form-item>
            <el-form-item
              class="group-material-edit-form__top-field"
              label-position="top"
              label="汇报部门"
            >
              <el-input
                v-model="form.reportDepartment"
                placeholder="请输入汇报部门"
              />
            </el-form-item>
            <el-form-item
              class="group-material-edit-form__top-field is-readonly-field"
              label-position="top"
              label="汇报时间"
            >
              <el-input
                :model-value="displayDate(meeting?.meetingTime).slice(0, 10)"
                disabled
              />
            </el-form-item>
          </div>
        </section>

        <section
          class="group-material-edit-form__section group-material-edit-form__previous-gate"
          data-material-target="previousGateRequirements"
        >
          <BaseSectionTitle
            class="group-material-edit-form__section-head"
            title="产品委员会要求与完成情况"
            heading-tag="h2"
          >
            <template #title-extra>
              <el-tooltip
                content="维护上个阀点明确的要求事项及当前完成进度，可按需展示。"
                placement="top"
              >
                <el-icon class="group-material-edit-form__help-icon"
                  ><QuestionFilled
                /></el-icon>
              </el-tooltip>
            </template>
            <template #actions>
              <div class="group-material-edit-form__section-actions">
              <PermissionButton
                v-if="showPreviousGateRequirements"
                plain
                size="small"
                class="group-material-edit-form__add-button"
                @click="addPreviousGateRequirement"
              >
                新增一行
              </PermissionButton>
              <span class="group-material-edit-form__section-hint"
                >展示该模块</span
              >
              <el-switch v-model="showPreviousGateRequirements" />
              </div>
            </template>
          </BaseSectionTitle>
          <template v-if="showPreviousGateRequirements">
            <div class="group-material-edit-form__section-headless">
              <div class="group-material-edit-form__row-list">
                <section
                  v-for="(item, index) in previousGateRequirementRows"
                  :key="item.id"
                  class="group-material-edit-form__topic-item"
                >
                  <div class="group-material-edit-form__row-card-head">
                    <span class="group-material-edit-form__row-index">
                      序号 {{ index + 1 }}
                    </span>
                    <PermissionButton
                      link
                      type="danger"
                      class="group-material-edit-form__previous-remove-btn"
                      @click="requestPreviousGateRequirementDeletion(item.id)"
                    >
                      删除
                    </PermissionButton>
                  </div>
                  <div class="group-material-edit-form__previous-card-body">
                    <el-form-item
                      class="group-material-edit-form__top-field"
                      label="要求事项"
                      label-position="top"
                    >
                      <el-input
                        v-model="item.requirement"
                        type="textarea"
                        :autosize="{ minRows: 3 }"
                        placeholder="请输入上个阀点明确的要求事项"
                      />
                    </el-form-item>
                    <el-form-item
                      class="group-material-edit-form__top-field"
                      label="完成进度"
                      label-position="top"
                    >
                      <el-input
                        v-model="item.completion"
                        type="textarea"
                        :autosize="{ minRows: 3 }"
                        placeholder="请输入当前完成情况、结果及未完成原因"
                      />
                    </el-form-item>
                  </div>
                </section>
              </div>
            </div>
          </template>
        </section>

        <section
          class="group-material-edit-form__section"
          data-material-target="deliveryReview"
        >
          <BaseSectionTitle
            class="group-material-edit-form__section-head"
            title="评审校核主要问题汇总"
            heading-tag="h2"
          >
            <template #title-extra>
              <el-tooltip
                content="质量、成本、收益为标准板块，可按会议需要调整展示顺序。"
                placement="top"
              >
                <el-icon class="group-material-edit-form__help-icon"
                  ><QuestionFilled
                /></el-icon>
              </el-tooltip>
            </template>
          </BaseSectionTitle>
          <div class="group-material-edit-form__ai-reference">
            <div class="group-material-edit-form__ai-reference-head">
              <div class="group-material-edit-form__title-with-help">
                <strong>AI 综合参考建议</strong>
                <el-tooltip
                  content="AI 建议仅供会议材料编辑参考，不会自动写入正式材料。"
                  placement="top"
                >
                  <el-icon class="group-material-edit-form__help-icon"
                    ><QuestionFilled
                  /></el-icon>
                </el-tooltip>
              </div>
              <div class="group-material-edit-form__ai-reference-actions">
                <span class="group-material-edit-form__ai-reference-note">
                  仅供参考
                </span>
                <PermissionButton
                  link
                  type="primary"
                  :icon="MagicStick"
                  :loading="aiGenerating"
                  data-testid="group-material-ai-suggestions-generate"
                  @click="generateAiSuggestions"
                >
                  生成建议
                </PermissionButton>
                <el-button
                  link
                  type="primary"
                  data-testid="group-material-ai-suggestions-toggle"
                  :aria-expanded="aiSuggestionsExpanded"
                  @click="aiSuggestionsExpanded = !aiSuggestionsExpanded"
                >
                  {{ aiSuggestionsExpanded ? "收起" : "展开" }}
                </el-button>
              </div>
            </div>
            <div
              v-if="aiSuggestionsExpanded"
              class="group-material-edit-form__ai-content"
            >
              <template v-if="displayedOpinionSummary">
                <div
                  v-for="gatePoint in opinionGatePoints"
                  :key="`${gatePoint.projectId}-${gatePoint.gatePointId}`"
                  class="material-opinion-gate"
                >
                  <article
                    v-for="department in gatePoint.departments"
                    :key="department.departmentId"
                    class="material-opinion-department"
                  >
                    <div class="material-opinion-department__head">
                      <strong>{{ department.department }}</strong>
                    </div>
                    <ul v-if="opinionItems(department.opinion).length">
                      <li
                        v-for="item in opinionItems(department.opinion)"
                        :key="item"
                      >
                        {{ item }}
                      </li>
                    </ul>
                    <a
                      v-if="department.opinionUrl"
                      :href="department.opinionUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      >查看 {{ department.department }} 意见文件</a
                    >
                    <p v-else-if="!opinionItems(department.opinion).length">
                      评审建议均为正向，无负向建议
                    </p>
                    <p v-if="department.opinionSummary">
                      {{ department.opinionSummary }}
                    </p>
                  </article>
                </div>
              </template>
              <p v-else>{{ aiCombinedSuggestion || "尚未生成" }}</p>
            </div>
          </div>
          <div class="group-material-edit-form__review-workbench">
            <div class="group-material-edit-form__block-outline">
              <button
                v-for="(item, index) in reviewBlocks"
                :key="item.id"
                type="button"
                class="group-material-edit-form__block-outline-item"
                :aria-label="`定位到${item.title}`"
                :data-testid="`group-material-block-outline-${item.kind}`"
                @click="scrollToReviewBlock(item.id)"
              >
                <span class="group-material-edit-form__block-outline-index">
                  {{ String(index + 1).padStart(2, "0") }}
                </span>
                <span class="group-material-edit-form__block-outline-copy">
                  <strong>{{ item.title }}</strong>
                </span>
              </button>
              <el-dropdown
                class="group-material-edit-form__block-outline-add-wrap"
                trigger="click"
                @command="addReviewBlock"
              >
                <PermissionButton
                  type="primary"
                  class="group-material-edit-form__block-outline-add"
                  data-testid="group-material-block-add"
                >
                  <el-icon><Plus /></el-icon>
                  <span>新增板块</span>
                </PermissionButton>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="definition in reviewBlockDefinitions"
                      :key="definition.kind"
                      :command="definition.kind"
                      :disabled="
                        reviewBlocks.some(
                          (item) => item.kind === definition.kind,
                        )
                      "
                    >
                      {{ definition.title }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="custom"
                      divided
                      data-testid="group-material-add-custom-block"
                    >
                      自定义板块
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <section
              v-for="(block, index) in reviewBlocks"
              :key="block.id"
              class="group-material-edit-form__block-editor"
              :data-review-block-id="block.id"
              :data-testid="`group-material-block-${block.kind}`"
            >
              <header>
                <div>
                  <span>{{ String(index + 1).padStart(2, "0") }}</span>
                  <div>
                    <h3>{{ block.title }}</h3>
                  </div>
                </div>
                <div class="group-material-edit-form__block-editor-actions">
                  <div class="group-material-edit-form__block-order-actions">
                    <PermissionButton
                      text
                      size="small"
                      class="group-material-edit-form__block-order-button"
                      :disabled="index === 0"
                      :aria-label="`置顶${block.title}`"
                      :data-testid="`group-material-block-top-${block.kind}`"
                      @click="moveReviewBlock(block.id, 'top')"
                    >
                      <el-icon><Top /></el-icon>
                      置顶
                    </PermissionButton>
                    <PermissionButton
                      text
                      size="small"
                      class="group-material-edit-form__block-order-button"
                      :disabled="index === 0"
                      :aria-label="`上移${block.title}`"
                      :data-testid="`group-material-block-up-${block.kind}`"
                      @click="moveReviewBlock(block.id, 'up')"
                    >
                      <el-icon><ArrowUp /></el-icon>
                      上移
                    </PermissionButton>
                    <PermissionButton
                      text
                      size="small"
                      class="group-material-edit-form__block-order-button"
                      :disabled="index === reviewBlocks.length - 1"
                      :aria-label="`下移${block.title}`"
                      :data-testid="`group-material-block-down-${block.kind}`"
                      @click="moveReviewBlock(block.id, 'down')"
                    >
                      <el-icon><ArrowDown /></el-icon>
                      下移
                    </PermissionButton>
                  </div>
                  <PermissionButton
                    v-if="block.kind === 'quality'"
                    plain
                    size="small"
                    class="group-material-edit-form__add-button"
                    data-testid="group-material-quality-add-row"
                    @click="addQualityIssue"
                  >
                    新增一行
                  </PermissionButton>
                  <PermissionButton
                    link
                    type="danger"
                    :data-testid="`group-material-remove-${block.kind}-block`"
                    @click="requestBlockDeletion(block.id)"
                  >
                    删除
                  </PermissionButton>
                </div>
              </header>

              <div
                v-if="block.kind === 'quality'"
                class="group-material-edit-form__quality-editor"
              >
                <div class="group-material-edit-form__table-footer-remark group-material-edit-form__block-conclusion">
                  <span class="group-material-edit-form__table-footer-remark-label">质量结论</span>
                  <el-input
                    v-model="block.content"
                    type="textarea"
                    :autosize="{ minRows: 1, maxRows: 3 }"
                    placeholder="请输入质量结论（选填，未填写前台不展示）"
                    class="group-material-edit-form__table-footer-remark-input"
                    data-testid="group-material-quality-conclusion"
                  />
                </div>
                <div class="group-material-edit-form__row-list">
                  <section
                    v-for="(issue, index) in qualityIssues"
                    :key="issue.id"
                    class="group-material-edit-form__topic-item group-material-edit-form__quality-card"
                  >
                    <div class="group-material-edit-form__row-card-head group-material-edit-form__quality-card-head">
                      <div class="group-material-edit-form__quality-head-left">
                        <span class="group-material-edit-form__row-index group-material-edit-form__quality-index-badge">
                          序号 {{ index + 1 }}
                        </span>
                      </div>
                      <PermissionButton
                        link
                        type="danger"
                        class="group-material-edit-form__quality-remove-btn"
                        :data-testid="`group-material-quality-remove-row-${index}`"
                        @click="requestQualityIssueDeletion(issue.id)"
                      >
                        删除
                      </PermissionButton>
                    </div>

                    <div class="group-material-edit-form__quality-card-body">
                      <div class="group-material-edit-form__quality-text-grid">
                        <el-form-item
                          class="group-material-edit-form__top-field group-material-edit-form__quality-field"
                          label-position="top"
                          label="质量问题"
                        >
                          <el-input
                            v-model="issue.issue"
                            type="textarea"
                            :autosize="{ minRows: 2 }"
                            placeholder="请输入质量问题、风险表现及影响范围"
                          />
                        </el-form-item>
                        <el-form-item
                          class="group-material-edit-form__top-field group-material-edit-form__quality-field"
                          label-position="top"
                          label="整改措施"
                        >
                          <el-input
                            v-model="issue.action"
                            type="textarea"
                            :autosize="{ minRows: 2 }"
                            placeholder="请输入整改措施、验证方式及关闭标准"
                          />
                        </el-form-item>
                      </div>

                      <div class="group-material-edit-form__topic-item-grid group-material-edit-form__quality-meta-grid">
                        <el-form-item
                          class="group-material-edit-form__top-field group-material-edit-form__quality-field"
                          label-position="top"
                          label="责任部门"
                        >
                          <el-input
                            v-model="issue.ownerDepartment"
                            placeholder="请输入责任部门"
                            clearable
                          />
                        </el-form-item>
                        <el-form-item
                          class="group-material-edit-form__top-field group-material-edit-form__quality-field"
                          label-position="top"
                          label="计划完成时间"
                        >
                          <el-input
                            v-model="issue.dueDate"
                            placeholder="请输入计划完成时间"
                            clearable
                          />
                        </el-form-item>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <div
                v-else-if="block.kind === 'cost'"
                class="group-material-edit-form__cost-editor"
              >
                <section
                  class="group-material-edit-form__standard-editor group-material-edit-form__cost-standard-editor"
                >
                  <div class="group-material-edit-form__standard-grid">
                    <el-form-item
                      v-for="(label, index) in costPointLabels"
                      :key="label"
                      class="group-material-edit-form__top-field group-material-edit-form__cost-standard-field"
                      label-position="top"
                      :label="label"
                    >
                      <el-input
                        v-model="costPoints[index]"
                        type="textarea"
                        :autosize="{ minRows: 3 }"
                        :placeholder="costPointPlaceholders[index]"
                        :data-testid="`group-material-cost-point-${index}`"
                      />
                    </el-form-item>
                  </div>
                </section>

                <section
                  class="group-material-edit-form__forecast-editor group-material-edit-form__cost-forecast-editor"
                >
                  <div
                    class="group-material-edit-form__forecast-toolbar is-actions-only"
                  >
                    <PermissionButton
                      plain
                      size="small"
                      class="group-material-edit-form__add-button"
                      data-testid="group-material-cost-forecast-add-row"
                      @click="addCostForecastNode"
                    >
                      <el-icon><Plus /></el-icon>
                      新增预测节点
                    </PermissionButton>
                  </div>
                  <div class="group-material-edit-form__cost-node-list">
                    <div class="group-material-edit-form__cost-node-list-head">
                      <span>类型</span>
                      <span>成本节点</span>
                      <span>金额（元）</span>
                      <span>操作</span>
                    </div>
                    <template
                      v-for="(node, index) in costForecastNodes"
                      :key="node.id"
                    >
                      <div
                        v-if="isReadonlyCostForecastNode(node.id)"
                        class="group-material-edit-form__cost-node-row is-readonly"
                      >
                        <span class="group-material-edit-form__cost-node-index">
                          基准
                        </span>
                        <div
                          class="group-material-edit-form__cost-node-readonly-copy"
                        >
                          <strong>{{ node.label }}</strong>
                          <small>系统自动带入</small>
                        </div>
                        <strong
                          class="group-material-edit-form__cost-node-readonly-value"
                        >
                          {{ displayCostForecastValue(node) }}
                        </strong>
                        <span
                          class="group-material-edit-form__cost-node-readonly-action"
                        >
                          只读
                        </span>
                      </div>
                      <div
                        v-else
                        class="group-material-edit-form__cost-node-row"
                      >
                        <span class="group-material-edit-form__cost-node-index">
                          预测 {{ String(index - 1).padStart(2, "0") }}
                        </span>
                        <el-input
                          v-model="node.label"
                          placeholder="请输入节点名称"
                          :data-testid="`group-material-cost-forecast-row-${index}-label`"
                        />
                        <el-input
                          :model-value="getCostForecastValue(node)"
                          placeholder="请输入金额"
                          inputmode="decimal"
                          :formatter="formatPositiveAmountInput"
                          :parser="parsePositiveAmountInput"
                          :data-testid="`group-material-cost-forecast-row-${index}-value`"
                          @update:model-value="
                            setCostForecastInputValue(node, $event)
                          "
                          @blur="handleCostForecastBlur(node)"
                        >
                          <template #suffix>元</template>
                        </el-input>
                        <PermissionButton
                          link
                          type="danger"
                          :data-testid="`group-material-cost-forecast-remove-row-${index}`"
                          @click="removeCostForecastNode(node.id)"
                        >
                          删除
                        </PermissionButton>
                      </div>
                    </template>
                  </div>
                </section>
              </div>

              <div
                v-else-if="block.kind === 'revenue'"
                class="group-material-edit-form__revenue-editor"
              >
                <section
                  class="group-material-edit-form__standard-editor group-material-edit-form__revenue-standard-editor"
                >
                  <div class="group-material-edit-form__standard-grid">
                    <el-form-item
                      v-for="(label, index) in revenuePointLabels"
                      :key="label"
                      class="group-material-edit-form__top-field group-material-edit-form__revenue-standard-field"
                      label-position="top"
                      :label="label"
                    >
                      <el-input
                        v-model="revenuePoints[index]"
                        type="textarea"
                        :autosize="{ minRows: 3 }"
                        :placeholder="revenuePointPlaceholders[index]"
                        :data-testid="`group-material-revenue-point-${index}`"
                      />
                    </el-form-item>
                  </div>
                </section>

                <!--                <section class="group-material-edit-form__readonly-panel">-->
                <!--                  <div class="group-material-edit-form__rows-head">-->
                <!--                    <div class="group-material-edit-form__title-with-help">-->
                <!--                      <el-icon><Lock /></el-icon-->
                <!--                      ><strong>收益模块带入分组</strong>-->
                <!--                      <el-tag effect="plain" type="info">只读</el-tag>-->
                <!--                    </div>-->
                <!--                  </div>-->
                <!--                  <el-table-->
                <!--                    :data="revenueImportedGroups"-->
                <!--                    border-->
                <!--                    class="group-material-edit-form__readonly-el-table"-->
                <!--                  >-->
                <!--                    <el-table-column prop="label" label="分组名称" />-->
                <!--                    <el-table-column prop="margin" label="边贡" align="center" />-->
                <!--                    <el-table-column prop="profit" label="利润" align="center" />-->
                <!--                  </el-table>-->
                <!--                </section>-->

                <section
                  class="group-material-edit-form__forecast-editor group-material-edit-form__revenue-forecast-editor"
                >
                  <div
                    class="group-material-edit-form__forecast-toolbar is-actions-only"
                  >
                    <PermissionButton
                      plain
                      size="small"
                      class="group-material-edit-form__add-button"
                      data-testid="group-material-revenue-forecast-add-metric-row"
                      @click="addRevenueForecastMetricRow"
                    >
                      <el-icon><Plus /></el-icon>
                      新增指标行
                    </PermissionButton>
                    <PermissionButton
                      plain
                      size="small"
                      class="group-material-edit-form__add-button"
                      data-testid="group-material-revenue-forecast-add-row"
                      @click="addRevenueForecastGroup"
                    >
                      <el-icon><Plus /></el-icon>
                      新增收益分组
                    </PermissionButton>
                  </div>
                  <el-table
                    :data="revenueForecastMetricRows"
                    class="group-material-edit-form__revenue-table group-material-edit-form__revenue-forecast-table"
                    row-key="key"
                    :row-class-name="revenueForecastRowClassName"
                  >
                    <el-table-column
                      fixed="left"
                      width="180"
                      class-name="is-metric-column"
                      label-class-name="is-metric-column"
                    >
                      <template #header>
                        <div class="group-material-edit-form__revenue-metric-header">
                          <span class="group-material-edit-form__revenue-metric-header-dot"></span>
                          <span>收益指标</span>
                        </div>
                      </template>
                      <template #default="{ row }">
                        <div class="group-material-edit-form__revenue-metric">
                          <small v-if="row.category">{{ row.category }}</small>
                          <el-input
                            v-if="row.custom"
                            v-model="row.label"
                            size="small"
                            placeholder="请输入指标名称"
                            :data-testid="`group-material-revenue-forecast-metric-row-${row.key}-label`"
                          />
                          <span v-else
                            class="group-material-edit-form__metric-label"
                            >{{ row.label }}</span
                          >
                          <PermissionButton
                            v-if="row.custom"
                            link
                            type="danger"
                            size="small"
                            :data-testid="`group-material-revenue-forecast-remove-metric-row-${row.key}`"
                            @click="removeRevenueForecastMetricRow(row.key)"
                          >删除</PermissionButton>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-for="(group, index) in revenueForecastGroups"
                      :key="group.id"
                      min-width="190"
                      :class-name="
                        isReadonlyRevenueForecastGroup(group.id)
                          ? 'is-readonly-revenue-column'
                          : 'is-editable-revenue-column'
                      "
                      :label-class-name="
                        isReadonlyRevenueForecastGroup(group.id)
                          ? 'is-readonly-revenue-column'
                          : 'is-editable-revenue-column'
                      "
                    >
                      <template #header>
                        <div
                          class="group-material-edit-form__revenue-node-header"
                          :class="{
                            'is-readonly': isReadonlyRevenueForecastGroup(
                              group.id,
                            ),
                            'is-base': isBaseRevenueForecastGroup(group.id),
                          }"
                        >
                          <div
                            class="group-material-edit-form__revenue-node-mode-row"
                          >
                            <span
                              class="group-material-edit-form__revenue-node-mode"
                              :class="{
                                'is-readonly': isReadonlyRevenueForecastGroup(
                                  group.id,
                                ),
                              }"
                            >
                              <el-icon
                                v-if="!isReadonlyRevenueForecastGroup(group.id)"
                                ><EditPen
                              /></el-icon>
                              <i v-else aria-hidden="true"></i>
                              {{
                                isReadonlyRevenueForecastGroup(group.id)
                                  ? "系统基准"
                                  : "可编辑"
                              }}
                            </span>
                            <PermissionButton
                              v-if="!isBaseRevenueForecastGroup(group.id)"
                              link
                              type="danger"
                              :data-testid="`group-material-revenue-forecast-remove-row-${index}`"
                              @click="removeRevenueForecastGroup(group.id)"
                            >
                              删除
                            </PermissionButton>
                          </div>
                          <span
                            v-if="isBaseRevenueForecastGroup(group.id)"
                            class="group-material-edit-form__revenue-node-title"
                          >
                            {{ group.label }}
                          </span>
                          <el-input
                            v-else
                            v-model="group.label"
                            placeholder="请输入分组名称"
                            :data-testid="`group-material-revenue-forecast-row-${index}-label`"
                          />
                        </div>
                      </template>
                      <template #default="{ row }">
                        <div
                          class="group-material-edit-form__revenue-value"
                          :class="{
                            'is-readonly': isReadonlyRevenueForecastGroup(
                              group.id,
                            ),
                          }"
                        >
                          <span
                            v-if="isReadonlyRevenueForecastGroup(group.id)"
                            class="group-material-edit-form__readonly-value"
                          >
                            {{ displayRevenueForecastValue(group, row.key) }}
                          </span>
                          <el-input
                            v-else-if="isRevenueTextMetric(row.key)"
                            :model-value="
                              getRevenueForecastValue(group, row.key)
                            "
                            placeholder="请输入"
                            class="group-material-edit-form__revenue-cell-input"
                            :data-testid="`group-material-revenue-forecast-row-${index}-${row.key}`"
                            @update:model-value="
                              setRevenueForecastTextValue(
                                group,
                                row.key,
                                $event,
                              )
                            "
                          />
                          <el-input
                            v-else
                            :model-value="
                              getRevenueForecastValue(group, row.key)
                            "
                            placeholder="0.00"
                            inputmode="decimal"
                            :formatter="formatAmountInput"
                            :parser="parseAmountInput"
                            class="group-material-edit-form__revenue-cell-input"
                            :data-testid="`group-material-revenue-forecast-row-${index}-${row.key}`"
                            @update:model-value="
                              setRevenueForecastInputValue(
                                group,
                                row.key,
                                $event,
                              )
                            "
                            @blur="
                              handleRevenueForecastBlur(group, row.key)
                            "
                          >
                            <template #suffix>元</template>
                          </el-input>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div
                    class="group-material-edit-form__revenue-table-add-bar"
                    @click="addRevenueForecastMetricRow"
                  >
                    <el-icon><Plus /></el-icon>
                    <span>添加自定义收益指标行</span>
                  </div>
                </section>

                <!--                <section class="group-material-edit-form__readonly-panel">-->
                <!--                  <div class="group-material-edit-form__rows-head">-->
                <!--                    <div class="group-material-edit-form__title-with-help">-->
                <!--                      <el-icon><Lock /></el-icon-->
                <!--                      ><strong>收益模块带入指标</strong>-->
                <!--                      <el-tag effect="plain" type="info">只读</el-tag>-->
                <!--                    </div>-->
                <!--                  </div>-->
                <!--                  <div class="group-material-edit-form__readonly-data-list">-->
                <!--                    <div-->
                <!--                      v-for="item in revenueImportedMetrics"-->
                <!--                      :key="item.label"-->
                <!--                      class="group-material-edit-form__readonly-data-row"-->
                <!--                    >-->
                <!--                      <span>{{ item.label }}</span>-->
                <!--                      <strong>{{ item.value }}</strong>-->
                <!--                    </div>-->
                <!--                  </div>-->
                <!--                </section>-->

                <!--                <section class="group-material-edit-form__forecast-editor">-->
                <!--                  <div class="group-material-edit-form__rows-head">-->
                <!--                    <div class="group-material-edit-form__title-with-help">-->
                <!--                      <el-icon><EditPen /></el-icon-->
                <!--                      ><strong>会议补充指标</strong>-->
                <!--                    </div>-->
                <!--                    <PermissionButton-->
                <!--                      plain-->
                <!--                      permission="committee:material:edit"-->
                <!--                      data-testid="group-material-revenue-metric-add-row"-->
                <!--                      @click="addRevenueSupplementMetric"-->
                <!--                    >-->
                <!--                      新增指标-->
                <!--                    </PermissionButton>-->
                <!--                  </div>-->
                <!--                  <div class="group-material-edit-form__forecast-grid">-->
                <!--                    <section-->
                <!--                      v-for="(metric, index) in revenueSupplementMetrics"-->
                <!--                      :key="metric.id"-->
                <!--                      class="group-material-edit-form__topic-item group-material-edit-form__forecast-card"-->
                <!--                    >-->
                <!--                      <div class="group-material-edit-form__row-card-head">-->
                <!--                        <el-tag type="success">手工维护</el-tag>-->
                <!--                        <PermissionButton-->
                <!--                          link-->
                <!--                          type="danger"-->
                <!--                          permission="committee:material:edit"-->
                <!--                          :data-testid="`group-material-revenue-metric-remove-row-${index}`"-->
                <!--                          @click="removeRevenueSupplementMetric(metric.id)"-->
                <!--                        >-->
                <!--                          删除-->
                <!--                        </PermissionButton>-->
                <!--                      </div>-->
                <!--                      <div class="group-material-edit-form__forecast-fields">-->
                <!--                        <el-form-item label="字段名称">-->
                <!--                          <el-input-->
                <!--                            v-model="metric.label"-->
                <!--                            :data-testid="`group-material-revenue-metric-row-${index}-label`"-->
                <!--                          />-->
                <!--                        </el-form-item>-->
                <!--                        <el-form-item label="字段值">-->
                <!--                          <el-input-->
                <!--                            v-model="metric.value"-->
                <!--                            :data-testid="`group-material-revenue-metric-row-${index}-value`"-->
                <!--                          />-->
                <!--                        </el-form-item>-->
                <!--                      </div>-->
                <!--                    </section>-->
                <!--                  </div>-->
                <!--                </section>-->
              </div>

              <div
                v-else
                class="group-material-edit-form__standard-editor group-material-edit-form__custom-editor"
              >
                <el-form-item
                  class="group-material-edit-form__top-field"
                  label-position="top"
                  label="板块名称"
                >
                  <el-input
                    v-model="block.title"
                    placeholder="请输入自定义板块名称"
                  />
                </el-form-item>
                <el-form-item
                  class="group-material-edit-form__top-field is-long-text"
                  label-position="top"
                  label="板块内容"
                >
                  <el-input
                    v-model="block.content"
                    type="textarea"
                    :autosize="{ minRows: 8 }"
                    placeholder="请输入该板块需要在会上展示的核心内容"
                  />
                </el-form-item>
              </div>
            </section>
          </div>
        </section>

        <CommitteeAttachmentPanel
          class="group-material-edit-form__attachment-section"
          data-material-target="attachment"
          biz-code="MEETING_MATERIAL"
          :biz-id="meetingId"
          editable
          allow-delete
          compact
          section-heading
          title="附件展示区"
          description="上传并管理本次集团会议的材料附件。"
        />
      </el-form>
      <BaseConfirm
        v-model="confirmState.visible"
        v-bind="confirmState"
        @confirm="resolveConfirm"
        @cancel="rejectConfirm"
      />
      <BaseConfirm
        :model-value="Boolean(deleteTarget)"
        title="删除材料内容"
        :message="
          deleteTarget?.type === 'block'
            ? '删除后展示页将不再显示该板块，确认删除？'
            : deleteTarget?.type === 'previous-gate-requirement'
              ? '确认删除该条产品委员会要求与完成情况？删除后无法恢复。'
              : '确认删除该条质量问题？删除后无法恢复。'
        "
        type="danger"
        confirm-text="确认删除"
        @confirm="confirmMaterialDeletion"
        @cancel="deleteTarget = null"
        @update:model-value="(visible) => !visible && (deleteTarget = null)"
      />
    </div>
  </PageContainer>
  <CommitteeFilePreviewDialog
    v-model="attachmentPreviewVisible"
    :file="attachmentPreviewFile"
    :file-name="attachmentPreviewTitle"
  />
</template>

<style scoped>
.committee-group-material-display {
  --report-ink: #17385e;
  --report-ink-soft: #4b617a;
  --report-muted: #7b8ea3;
  --report-line: #dce6f0;
  --report-surface: #ffffff;
  display: grid;
  gap: clamp(32px, 3.2vw, 52px);
  padding: clamp(22px, 3vw, 36px);
  border: 1px solid #e1e9f2;
  border-radius: 14px;
  background: linear-gradient(180deg, #f2f6fa 0%, #f8fafc 100%);
}

.committee-group-material-display:fullscreen {
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  padding: 24px clamp(24px, 4vw, 64px);
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: 0;
  border: 0;
}

.committee-group-material-display:fullscreen::backdrop {
  background: #edf3f8;
}

.group-material-display__hero,
.group-material-display__section {
  display: grid;
  gap: 18px;
  border-radius: 12px;
}

.group-material-display__hero {
  padding: 0;
  gap: 0;
  background: transparent;
}

.group-material-display__hero-brand {
  display: flex;
  align-items: center;
  min-height: 88px;
  padding: 0 44px;
  background: #fff;
  border: 1px solid #e1e9f2;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
}

.group-material-display__hero-brand img {
  display: block;
  width: min(260px, 28vw);
  height: auto;
  max-height: 42px;
  object-fit: contain;
  object-position: left center;
}

.group-material-display__hero-panel {
  position: relative;
  isolation: isolate;
  display: grid;
  gap: 26px;
  min-height: 286px;
  padding: 42px 44px 32px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(118deg, #102c50 0%, #1d5da9 58%, #2d82d8 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0 0 16px 16px;
  box-shadow: 0 18px 40px rgba(23, 56, 94, 0.16);
}

.group-material-display__hero-backdrop {
  position: absolute;
  z-index: 0;
  top: 0;
  right: 0;
  width: min(48%, 650px);
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 0, 0, 0.1) 20%,
    rgba(0, 0, 0, 0.72) 52%,
    #000 78%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 0, 0, 0.1) 20%,
    rgba(0, 0, 0, 0.72) 52%,
    #000 78%
  );
}

.group-material-display__hero-backdrop::after {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(45, 130, 216, 0.94) 0%,
      rgba(45, 130, 216, 0.58) 22%,
      rgba(45, 130, 216, 0) 58%
    ),
    linear-gradient(
      90deg,
      rgba(16, 44, 80, 0.3) 0%,
      rgba(16, 44, 80, 0.04) 58%,
      rgba(16, 44, 80, 0.12) 100%
    );
  content: "";
}

.group-material-display__hero-backdrop img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
  opacity: 0.72;
}

.group-material-display__hero-panel
  > :not(.group-material-display__hero-backdrop) {
  position: relative;
  z-index: 1;
}

.group-material-display__hero-copy {
  display: grid;
  max-width: min(72%, 820px);
  gap: 18px;
}

.group-material-display__section-head p,
.group-material-display__hero-department,
.group-material-display__cover-fact span,
.group-material-display__fact span {
  margin: 0;
}

.group-material-display__hero h2 {
  margin: 0;
  color: #fff;
  font-size: clamp(30px, 3vw, 40px);
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.group-material-display__hero-department {
  color: rgba(255, 255, 255, 0.88);
  font-size: 17px;
  line-height: 26px;
  letter-spacing: 0.02em;
}

.group-material-display__cover-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: auto;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.28);
}

.group-material-display__cover-fact {
  display: grid;
  gap: 8px;
  min-width: 0;
  min-height: 62px;
  padding: 0 28px;
}

.group-material-display__cover-fact:first-child {
  padding-left: 0;
}

.group-material-display__cover-fact + .group-material-display__cover-fact {
  border-left: 1px solid rgba(255, 255, 255, 0.28);
}

.group-material-display__cover-fact span {
  color: rgba(255, 255, 255, 0.72);
  font-size: 16px;
  line-height: 22px;
  letter-spacing: 0.04em;
}

.group-material-display__cover-fact strong {
  overflow: hidden;
  color: #fff;
  font-size: 19px;
  font-weight: 700;
  line-height: 26px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-display__section {
  padding: 0;
}

.group-material-display__section--attachments {
  padding: 0 0 16px;
  background: transparent;
}

.group-material-display__section-head {
  position: relative;
  display: block;
  padding: 0 0 14px;
  border-bottom: 1px solid var(--report-line);
  text-align: left;
}

.group-material-display__section-head > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  gap: 14px;
  width: 100%;
}

.group-material-display__section-head::after {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 44px;
  height: 3px;
  border-radius: 999px;
  background: var(--bq-color-primary);
  content: "";
}

.group-material-display__section-head p {
  margin: 0;
  color: #a7b8c9;
  font-size: 48px;
  font-weight: 700;
  line-height: 0.82;
  letter-spacing: -0.06em;
  font-variant-numeric: tabular-nums;
}

.group-material-display__section-head h3 {
  margin: 0;
  padding-bottom: 2px;
  color: var(--report-ink);
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.group-material-display__spectrum-card,
.group-material-display__overview-composite,
.group-material-display__summary-card,
.group-material-display__section-card,
.group-material-display__gate-report-card,
.group-material-display__blue-panel {
  border: 1px solid #dfe8f1;
  border-radius: 12px;
  background: var(--report-surface);
  box-shadow:
    0 10px 28px rgba(38, 74, 112, 0.055),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
}

.group-material-display__spectrum-card {
  overflow: hidden;
}

.group-material-display__spectrum-image-wrap {
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  padding: 10px;
  background: #fff;
}

.group-material-display__spectrum-image,
.group-material-display__spectrum-empty {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  background: #fff;
}

.group-material-display__spectrum-empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: var(--report-muted);
  font-size: 15px;
}

.group-material-display__spectrum-table {
  width: 100%;
}

.group-material-display__spectrum-table :deep(.el-table__header-wrapper th),
.group-material-display__spectrum-table
  :deep(.el-table__fixed-header-wrapper th) {
  height: 40px;
  color: #294b70;
  background: #dce9f6;
  font-size: 16px;
  font-weight: 700;
}

.group-material-display__spectrum-table :deep(.el-table__cell) {
  border-bottom-color: #edf2f8;
}

.group-material-display__spectrum-table :deep(.el-table__body .el-table__cell) {
  height: 44px;
  color: #333;
  font-size: 16px;
}

.group-material-display__spectrum-table :deep(.cell) {
  display: flex;
  align-items: center;
  min-height: 24px;
  white-space: nowrap;
}

.group-material-display__status-cell {
  display: inline-flex;
  align-items: center;
}

.group-material-display__status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  border-radius: 50%;
  background: #52c41a;
}

.group-material-display__gate-report-card {
  display: grid;
  gap: 16px;
  padding: 20px;
}

.group-material-display__gate-report-card > h4 {
  margin: 0;
  padding-bottom: 2px;
  color: var(--report-ink);
  font-size: 20px;
  line-height: 1.35;
}

.group-material-display__subsection {
  overflow: hidden;
  border: 1px solid #e0e8f1;
  border-radius: 10px;
  background: #fff;
}

.group-material-display__subsection-head {
  position: relative;
  min-height: 42px;
  padding: 10px 16px 10px 21px;
  color: #315577;
  background: #f4f8fc;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  letter-spacing: 0.04em;
}

.group-material-display__subsection-head::before {
  position: absolute;
  top: 11px;
  bottom: 11px;
  left: 0;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: var(--bq-color-primary);
  content: "";
}

.group-material-display__subsection-body {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  color: var(--report-ink-soft);
  font-size: 16px;
  line-height: 1.7;
}

.group-material-display__intent-bullets {
  margin-top: 6px;
  display: grid;
  gap: 10px;

  li {
    font-size: 15px;
    line-height: 1.75;
    color: #334155;
  }

  .intent-label {
    font-weight: 700;
    color: #17345c;
    margin-right: 2px;
  }

  .intent-val {
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.group-material-display__subsection-body p {
  margin: 0;
}

.group-material-display__bullet-list--compact {
  gap: 4px;
  font-size: 14px;
}

.group-material-display__overview-composite {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #d7e5f5;
}

.group-material-display__overview-main {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 20px;
}

.group-material-display__overview-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e3edf8;
}

.group-material-display__overview-title h4,
.group-material-display__summary-card h4 {
  margin: 0;
  color: #12325e;
  font-size: 18px;
}

.group-material-display__overview-title span {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef5ff;
  color: #2f73e7;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.group-material-display__fact-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.group-material-display__fact {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 62px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f7fbff;
  border: 1px solid #f1f6fd;
}

.group-material-display__fact--full {
  grid-column: 1 / -1;
}

.group-material-display__fact-body {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.group-material-display__fact span {
  color: #71849c;
  font-size: 14px;
}

.group-material-display__fact .committee-text-strong {
  color: #17345c;
  font-size: 17px;
  line-height: 1.4;
}

.group-material-display__fact:not(.group-material-display__fact--full)
  .committee-text-strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-display__fact-icon,
.group-material-display__deliverable-icon,
.group-material-display__attachment-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: #fff;
  /* background: #5d96f2; */
  font-size: 18px;
}

.group-material-display__fact-icon.is-soft-blue {
  background: #a7bee5;
}

.group-material-display__fact-icon.is-red {
  background: #ee3b45;
}

.group-material-display__fact-icon.is-green {
  background: #4fc992;
}

.group-material-display__fact-icon.is-orange {
  background: #f3a369;
}

.group-material-display__fact-icon,
.group-material-display__deliverable-icon {
  overflow: hidden;
  background: transparent !important;
  color: inherit;
  font-size: 0;
}

.group-material-display__fact-icon img,
.group-material-display__deliverable-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.group-material-display__overview-gate {
  display: grid;
  align-content: center;
  gap: 16px;
  min-width: 0;
  padding: 24px;
  color: #fff;
  background: linear-gradient(150deg, #12325e 0%, #1f61c2 64%, #2f86f4 100%);
}

.group-material-display__overview-gate-head {
  display: grid;
  gap: 10px;
}

.group-material-display__overview-gate-head span {
  color: rgba(255, 255, 255, 0.78);
  font-size: 16px;
  font-weight: 700;
}

.group-material-display__overview-gate-head .committee-text-strong {
  color: #fff;
  font-size: 24px;
}

.group-material-display__gate-purpose,
.group-material-display__bullet-list {
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: 16px;
  line-height: 1.8;
}

.group-material-display__bullet-list {
  display: grid;
  gap: 8px;
  padding-left: 18px;
}

.group-material-display__subsection-body
  .group-material-display__bullet-list--dark {
  padding-left: 0;
  color: #315170;
  list-style: none;
}

.group-material-display__bullet-list--dark li {
  position: relative;
  padding-left: 16px;
}

.group-material-display__bullet-list--dark li::before {
  content: "";
  position: absolute;
  top: 0.72em;
  left: 0;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: #4c8ff0;
  transform: translateY(-50%) rotate(45deg);
}

.group-material-display__section-card {
  display: grid;
  gap: 16px;
  padding: 20px;
  overflow: hidden;
}

.group-material-display__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.group-material-display__summary-card {
  display: grid;
  gap: 10px;
  min-height: 150px;
  padding: 18px;
  border: 1px solid #dce8f5;
}

.group-material-display__summary-card p {
  margin: 0;
  color: #4d5f73;
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.group-material-display__attachments {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.group-material-display__section--attachments
  > .group-material-display__attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid #dce8f5;
  border-radius: 8px;
  background: #fff;
}

.group-material-display__attachments article {
  display: grid;
  gap: 6px;
  min-height: 56px;
  padding: 12px 16px;
  border: 1px solid #e2ebf6;
  border-radius: 8px;
  background: #f7fbff;
}

.group-material-display__attachments-empty {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  padding: 16px;
  border: 1px dashed #c9d9ec;
  border-radius: 8px;
  color: #6f8299;
  font-size: 16px;
  background: #f7fbff;
}
.group-material-display__attachments span {
  color: #6f8299;
  font-size: 14px;
}

.group-material-display__attachments .committee-text-strong {
  color: #17345c;
  font-size: 17px;
}

.group-material-display__timeline-board {
  display: grid;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid #d7e3ee;
  border-radius: 10px;
  background: #fff;
  scrollbar-color: #9bb4d7 #edf3fb;
  scrollbar-width: thin;
}

.group-material-display__timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 16px;
  border: 1px dashed #c9d9ec;
  border-radius: 8px;
  color: #6f8299;
  font-size: 16px;
  background: #fff;
}

.group-material-display__timeline-board::-webkit-scrollbar {
  height: 10px;
}

.group-material-display__timeline-board::-webkit-scrollbar-track {
  border-radius: 5px;
  background: #edf3fb;
}

.group-material-display__timeline-board::-webkit-scrollbar-thumb {
  border: 2px solid #edf3fb;
  border-radius: 5px;
  background: #9bb4d7;
}

.group-material-display__timeline-row {
  display: grid;
  grid-template-columns: 168px repeat(36, minmax(70px, 1fr));
  min-width: 2688px;
  border-bottom: 1px solid #e4eefc;
}

.group-material-display__timeline-row:last-child {
  border-bottom: 0;
}

.group-material-display__timeline-row > span {
  display: flex;
  align-items: center;
  padding: 14px 28px;
  color: #2d3440;
  font-size: 17px;
  font-weight: 700;
  background: #f8fbff;
}

.group-material-display__timeline-row--gates > span {
  display: grid;
  align-content: center;
  gap: 4px;
  min-height: 118px;
}

.group-material-display__timeline-row--gates > span .committee-text-strong {
  color: #1f2937;
  font-size: 18px;
  line-height: 1.35;
}

.group-material-display__timeline-row--gates > span small {
  color: #4e8ffd;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
}

.group-material-display__timeline-row--gates > span small.is-green {
  color: #24b873;
}

.group-material-display__timeline-row--year {
  grid-template-columns: 168px repeat(36, minmax(70px, 1fr));
  color: #23496e;
  background: #dce9f6;
}

.group-material-display__timeline-row--year span,
.group-material-display__timeline-row--year .committee-text-strong {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  padding: 0 14px;
  color: #23496e;
  font-size: 18px;
  background: #dce9f6;
  border-left: 1px solid rgba(255, 255, 255, 0.9);
}

.group-material-display__timeline-row--year
  .group-material-display__timeline-year-label {
  grid-column: 1;
  border-left: 0;
}

.group-material-display__timeline-row--month > span {
  justify-content: center;
  min-height: 52px;
  color: #678099;
  background: #f3f7fb;
}

.group-material-display__timeline-row--month b {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  color: #5d7187;
  font-size: 16px;
  font-weight: 700;
  background: #f3f7fb;
  border-left: 1px solid #e1eaf3;
}

.group-material-display__timeline-track {
  position: relative;
  grid-column: 2 / -1;
  min-height: 118px;
}

.group-material-display__timeline-track::before {
  position: absolute;
  top: 76px;
  right: 0;
  left: 0;
  height: 2px;
  background: #dbe8fb;
  content: "";
}

.group-material-display__timeline-point {
  position: absolute;
  top: 20px;
  z-index: 1;
  display: grid;
  justify-items: center;
  min-width: 72px;
  transform: translateX(-50%);
}

.group-material-display__timeline-point small {
  position: relative;
  z-index: 1;
  margin-top: 7px;
  color: #3d4550;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.group-material-display__timeline-status {
  height: 22px;
  margin-top: 6px;
  border: 0;
  border-radius: 4px;
  background: #dbeaff;
  color: #3f8df7;
  font-size: 14px;
  line-height: 22px;
}

.group-material-display__gate-pill {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-self: center;
  justify-self: center;
  align-items: center;
  justify-content: center;
  width: 43px;
  height: 53px;
  margin: 0;
  color: #394552;
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
}

.group-material-display__gate-pill.is-current,
.group-material-display__gate-pill.is-completed {
  color: #fff;
}

.group-material-display__gate-pill img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.group-material-display__gate-pill.is-completed:not(.is-current) img {
  filter: hue-rotate(279deg) saturate(80%) contrast(92.5%);
}

.group-material-display__gate-pill b {
  position: relative;
  z-index: 1;
  transform: translateY(-5px);
  font-size: 16px;
  line-height: 1;
}

.group-material-display__blue-panel {
  overflow: hidden;
}

.group-material-display__blue-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 50px;
  padding: 0 20px;
  color: var(--report-ink);
  background: #f1f6fb;
  border-bottom: 1px solid #dfe8f1;
}

.group-material-display__blue-panel > header .committee-text-strong {
  font-size: 17px;
}

.group-material-display__blue-panel > header span {
  padding: 3px 10px;
  border-radius: 999px;
  background: #e4edf6;
  color: #6d8297;
  font-size: 14px;
}

.group-material-display__custom-block > p {
  min-height: 96px;
  margin: 0;
  padding: 20px;
  color: #344861;
  font-size: 16px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.group-material-display__blue-table,
.group-material-display__matrix-table {
  width: 100%;
  overflow: hidden;
  border: 1px solid #e1ebf7;
  border-radius: 8px;
}

.group-material-display__blue-table :deep(.el-table__inner-wrapper),
.group-material-display__matrix-table :deep(.el-table__inner-wrapper) {
  overflow: hidden;
  border-radius: 8px;
}

.group-material-display__blue-table :deep(.el-table__inner-wrapper::before),
.group-material-display__matrix-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.group-material-display__blue-table :deep(.el-table__header-wrapper th),
.group-material-display__matrix-table :deep(.el-table__header-wrapper th) {
  color: #294b70;
  background: #edf4fa;
  font-weight: 700;
}

.group-material-display__blue-table :deep(.el-table__cell),
.group-material-display__matrix-table :deep(.el-table__cell) {
  border-bottom-color: #edf2f8;
  font-size: 16px;
}

.group-material-display__matrix-table
  :deep(.el-table__body-wrapper td .cell),
.group-material-display__matrix-table
  :deep(.el-table__fixed-body-wrapper td .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

.group-material-display__matrix-dimension-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  color: #4b617a;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.group-material-display__matrix-dimension-cell.is-conclusion-dimension {
  color: #17385e;
  font-weight: 700;
}

.group-material-display__matrix-table :deep(.is-conclusion-row > td) {
  background: #f3f8ff;
  border-top: 1px solid #b9d3f2;
  border-bottom: 1px solid #b9d3f2;
}

.group-material-display__matrix-table
  :deep(.is-conclusion-row > td:first-child) {
  box-shadow: inset 2px 0 #4d8ff0;
}

.group-material-display__matrix-table :deep(.is-conclusion-row .cell) {
  min-height: 48px;
}

.group-material-display__matrix-table
  :deep(.is-conclusion-row .is-conclusion-signal) {
  width: 12px;
  height: 12px;
}

.group-material-display__matrix-table
  :deep(.is-conclusion-row .is-conclusion-signal.is-green) {
  box-shadow: 0 0 0 4px rgba(50, 200, 117, 0.14);
}

.group-material-display__matrix-table
  :deep(.is-conclusion-row .is-conclusion-signal.is-yellow) {
  box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.22);
}

.group-material-display__matrix-table
  :deep(.is-conclusion-row .is-conclusion-signal.is-red) {
  box-shadow: 0 0 0 4px rgba(240, 86, 86, 0.14);
}

.group-material-display__blue-panel--spaced-table {
  padding-bottom: 14px;
}

.group-material-display__blue-panel--spaced-table
  .group-material-display__blue-table {
  width: calc(100% - 28px);
  margin: 14px 14px 0;
}

.group-material-display__deliverables {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 16px;
}

.group-material-display__deliverable-item {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  color: #2e5787;
  background: #f2f7ff;
  font-size: 16px;
}

.group-material-display__deliverable-item b {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-display__deliverable-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 12px;
}

.group-material-display__deliverable-toggle {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 4px;
  margin: 0 0 14px 16px;
  padding: 0;
  border: 0;
  color: #4e8ffd;
  background: transparent;
  font-size: 16px;
  line-height: 22px;
  cursor: pointer;
}

.group-material-display__deliverable-toggle:hover {
  color: #2f6fe8;
}

.group-material-display__deliverable-toggle .el-icon {
  font-size: 16px;
}

.group-material-display__attachment-body {
  display: flex;
  align-items: center;
  min-width: 0;
  text-align: left;
}

.group-material-display__attachment-body .committee-text-strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-display__attachments article {
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  width: fit-content;
  max-width: 100%;
  column-gap: 12px;
  min-height: 48px;
  padding: 8px 12px;
  border: 0;
  border-radius: 6px;
  background: #f5f8fc;
}

.group-material-display__attachment-card {
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.group-material-display__attachment-card[aria-busy="true"] {
  cursor: wait;
  opacity: 0.72;
}

.group-material-display__attachments-empty,
.group-material-display__timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  padding: 16px;
  border: 1px dashed #c9d9ec;
  border-radius: 8px;
  color: #6f8299;
  font-size: 16px;
  background: #f7fbff;
}

.group-material-display__attachments-empty {
  grid-column: 1 / -1;
}

.group-material-display__timeline-empty {
  min-height: 160px;
  background: #fff;
}

.group-material-display__attachment-card:hover {
  background: #eef5ff;
}

.group-material-display__attachment-card:focus-visible {
  outline: 2px solid #2f6fe8;
  outline-offset: 2px;
}

.group-material-display__attachment-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: 4px;
}

.group-material-display__attachment-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.group-material-display__matrix-group {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.group-material-display__matrix-title {
  display: flex;
  justify-content: space-between;
  color: #24405f;
  font-size: 16px;
}

.group-material-display__matrix-title span {
  color: #6f8299;
  font-size: 14px;
}

.group-material-display__signal {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d9e2ee;
}

.group-material-display__signal.is-green {
  background: #32c875;
}

.group-material-display__signal.is-yellow {
  background: #eab308;
}

.group-material-display__signal.is-red {
  background: #f05656;
}

.group-material-display__signal-empty {
  color: #8c9aaa;
  font-size: 14px;
  line-height: 18px;
}

.committee-group-material-display .is-clickable {
  cursor: pointer;
}

.committee-group-material-display .is-clickable:hover {
  filter: brightness(0.96);
}

.group-material-display__cost-block {
  display: grid;
  gap: 18px;
  padding: 16px;
  background: #fff;
}

.group-material-display__cost-insights {
  display: grid;
  gap: 12px;
}

.group-material-display__cost-insight {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 14px 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
    transform: translateY(-1px);
  }

  &.is-green {
    background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
    border-color: #dcfce7;

    &:hover {
      border-color: #86efac;
      box-shadow: 0 4px 14px rgba(22, 163, 74, 0.08);
    }

    .group-material-display__cost-insight-icon {
      background: #dcfce7;
      color: #16a34a;
    }
  }

  &.is-orange {
    background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
    border-color: #fef3c7;

    &:hover {
      border-color: #fde047;
      box-shadow: 0 4px 14px rgba(217, 119, 6, 0.08);
    }

    .group-material-display__cost-insight-icon {
      background: #fef3c7;
      color: #d97706;
    }
  }

  &.is-blue {
    background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
    border-color: #dbeafe;

    &:hover {
      border-color: #93c5fd;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.08);
    }

    .group-material-display__cost-insight-icon {
      background: #dbeafe;
      color: #2563eb;
    }
  }
}

.group-material-display__cost-insight > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.group-material-display__cost-insight span:not(.committee-text-strong) {
  color: #64748b;
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.group-material-display__cost-insight .committee-text-strong {
  color: #0f172a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.group-material-display__cost-insight-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.group-material-display__cost-insight-icon img {
  display: block;
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.group-material-display__cost-echarts {
  width: 100%;
  min-height: 300px;
  border-radius: 10px;
  background: #ffffff;
}

.group-material-display__revenue-block {
  display: grid;
  gap: 20px;
  padding: 16px 20px;
  background: #ffffff;
}

.group-material-display__revenue-echarts {
  width: 100%;
  min-height: 300px;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
}

.group-material-display__revenue-table {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  --el-table-border-color: #e8eef5;
  --el-table-row-hover-bg-color: #f1f5f9;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02);
}

.group-material-display__revenue-table :deep(.el-table__inner-wrapper) {
  overflow: hidden;
  border-radius: 10px;
}

.group-material-display__revenue-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.group-material-display__revenue-table :deep(.el-table__cell) {
  height: 44px;
  padding: 0;
  border-bottom-color: #edf2f7;
  color: #334155;
  font-size: 15px;
  text-align: center;
}

.group-material-display__revenue-table :deep(.el-table__cell .cell) {
  padding: 0 10px;
  line-height: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.group-material-display__revenue-table :deep(.el-table__row) {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.group-material-display__revenue-table :deep(.el-table__row .revenue-metric-col),
.group-material-display__revenue-table :deep(.el-table__row .el-table__cell:first-child) {
  background: #f8fafc;
  color: #1e293b;
  font-weight: 600;
  font-size: 14.5px;
  border-right: 1px solid #e2e8f0;
  text-align: center;
}

.group-material-display__revenue-table :deep(.el-table__row .revenue-metric-col .cell),
.group-material-display__revenue-table :deep(.el-table__row .el-table__cell:first-child .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  font-weight: 600;
  color: #1e293b;
}

.group-material-display__revenue-table :deep(.el-table__row .is-emphasis-col) {
  background: rgba(240, 245, 255, 0.4);
}

.group-material-display__revenue-value--emphasis {
  color: #1d4ed8;
  font-size: 16px;
  font-weight: 700;
}

.group-material-display__bar-chart {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 58px;
  min-height: 230px;
  padding: 28px 24px 18px;
  background:
    repeating-linear-gradient(
      to top,
      #eef3fa 0,
      #eef3fa 1px,
      transparent 1px,
      transparent 36px
    ),
    #fff;
}

.group-material-display__bar-chart article {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-width: 82px;
}

.group-material-display__bar {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 36px;
  min-height: 30px;
  padding-top: 4px;
  color: #fff;
  background: linear-gradient(180deg, #76a8ed, #4c82dc);
  font-size: 14px;
}

.group-material-display__bar-chart span {
  color: #4c6078;
  font-size: 14px;
}

.group-material-display__bar-chart em {
  color: #3cc174;
  font-size: 14px;
  font-style: normal;
}

.group-material-display__bar-stack {
  display: flex;
  align-items: end;
  gap: 7px;
}

.group-material-display__bar-stack b,
.group-material-display__bar-stack i {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 30px;
  min-height: 18px;
  padding-top: 3px;
  color: #fff;
  font-size: 14px;
  font-style: normal;
}

.group-material-display__bar-stack b {
  background: #88b5ef;
}

.group-material-display__bar-stack i {
  background: #4f86e8;
}

.group-material-display__decision-box {
  display: grid;
  gap: 14px;
  min-height: 112px;
  padding: 18px 20px;
  border: 1px solid #dfe8f1;
  border-left: 4px solid var(--bq-color-primary);
  border-radius: 10px;
  color: var(--report-ink-soft);
  background: #fff;
  box-shadow: 0 10px 28px rgba(38, 74, 112, 0.045);
}

.group-material-display__decision-input :deep(.el-textarea__inner) {
  min-height: 106px !important;
  padding: 12px 14px;
  border: 0;
  border-radius: 8px;
  background: #f4f8ff;
  box-shadow: inset 0 0 0 1px #eef3fb;
  color: #4a5c70;
  font-size: 16px;
  line-height: 1.8;
}

.group-material-display__decision-input
  :deep(.el-textarea__inner::placeholder) {
  color: #9badc3;
}

.group-material-display__decision-box .el-button {
  justify-self: end;
}

:global(.page-container.is-group-material-edit) {
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

:global(.page-container.is-group-material-edit .page-container__header) {
  margin-bottom: 10px;
  padding: 4px 0 14px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

:global(.page-container.is-group-material-edit .page-container__body) {
  background: transparent;
}

.group-material-edit-form {
  --material-edit-control-bg: color-mix(
    in srgb,
    var(--bq-color-surface),
    var(--bq-color-bg-soft) 22%
  );
  --material-edit-control-hover-bg: color-mix(
    in srgb,
    var(--bq-color-surface),
    var(--bq-color-primary-soft) 12%
  );
  --material-edit-control-line: color-mix(
    in srgb,
    var(--bq-color-border),
    var(--bq-color-text-muted) 32%
  );
  --material-edit-control-hover-line: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border) 64%
  );
  --material-edit-readonly-bg: color-mix(
    in srgb,
    var(--bq-color-bg-muted),
    white 30%
  );
  --material-edit-placeholder: color-mix(
    in srgb,
    var(--bq-color-text-muted),
    white 44%
  );
  --material-section-head-bg: color-mix(
    in srgb,
    var(--bq-color-surface),
    var(--bq-color-bg-soft) 36%
  );
  --material-section-head-accent: color-mix(
    in srgb,
    var(--bq-color-primary),
    white 24%
  );
  --material-section-head-divider: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border-subtle) 88%
  );
  --material-section-body-bg: color-mix(
    in srgb,
    var(--bq-color-bg-soft),
    white 44%
  );
  --material-section-shadow: 0 8px 24px rgba(31, 71, 133, 0.08);
  --material-outline-bg: color-mix(
    in srgb,
    var(--bq-color-bg-soft),
    var(--bq-color-primary-soft) 24%
  );
  --material-block-head-bg: color-mix(
    in srgb,
    var(--bq-color-bg-soft),
    var(--bq-color-primary-soft) 36%
  );
  display: grid;
  gap: var(--bq-space-section, 16px);
  color: var(--bq-color-text);
  font-size: 16px;
  line-height: 22px;
}

.group-material-edit-form__save-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 4px 8px 10px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper);
  line-height: 18px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.group-material-edit-form__save-state > div,
.group-material-edit-form__title-with-help,
.group-material-edit-form__scope-head > div {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.group-material-edit-form__save-state strong {
  color: var(--bq-color-text);
  font-size: 13px;
}

.group-material-edit-form__save-state.is-dirty {
  background: transparent;
  border-bottom-color: color-mix(
    in srgb,
    var(--bq-color-warning),
    var(--bq-color-border-subtle) 64%
  );
}

.group-material-edit-form__save-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bq-color-success);
}

.group-material-edit-form__save-state.is-dirty
  .group-material-edit-form__save-dot {
  background: var(--bq-color-warning);
}

.group-material-edit-form__scope-guide {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 8px 8px 14px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.group-material-edit-form__scope-guide-main,
.group-material-edit-form__scope-guide-context,
.group-material-edit-form__scope-guide-heading,
.group-material-edit-form__scope-guide-actions,
.group-material-edit-form__scope-guide-meeting,
.group-material-edit-form__scope-guide-readonly,
.group-material-edit-form__scope-guide-detail-items,
.group-material-edit-form__scope-guide-detail-items > span {
  display: flex;
  align-items: center;
}

.group-material-edit-form__scope-guide-main {
  flex-wrap: wrap;
  gap: 8px 16px;
  min-width: 0;
}

.group-material-edit-form__scope-guide-heading {
  flex: none;
  gap: 8px;
  min-height: 24px;
}

.group-material-edit-form__scope-guide-heading > strong {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.group-material-edit-form__scope-guide-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--bq-color-primary);
  background: var(--bq-color-primary-soft);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__scope-guide-actions {
  flex: 1 1 480px;
  flex-wrap: wrap;
  gap: 2px 14px;
  min-width: 0;
}

.group-material-edit-form__scope-guide-actions .el-button,
.group-material-edit-form__scope-guide-toggle.el-button,
.group-material-edit-form__scope-guide-detail-items .el-button {
  min-height: 22px;
  margin: 0;
  padding: 0;
}

.group-material-edit-form__scope-guide-toggle {
  flex: none;
  margin-left: auto !important;
  color: var(--bq-color-text-secondary);
}

.group-material-edit-form__scope-guide-toggle .el-icon {
  margin-left: 4px;
}

.group-material-edit-form__scope-guide-context {
  justify-content: space-between;
  gap: 8px 20px;
  min-width: 0;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper);
  line-height: 20px;
}

.group-material-edit-form__scope-guide-meeting {
  min-width: 0;
  gap: 0;
}

.group-material-edit-form__scope-guide-meeting > * {
  min-width: 0;
}

.group-material-edit-form__scope-guide-meeting > * + *::before {
  margin: 0 8px;
  color: var(--bq-color-border);
  content: "·";
}

.group-material-edit-form__scope-guide-meeting strong {
  overflow: hidden;
  color: var(--bq-color-text-secondary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-edit-form__scope-guide-readonly {
  flex: none;
  gap: 5px;
}

.group-material-edit-form__scope-guide-detail {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px 16px;
  padding-top: 10px;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__scope-guide-detail > strong {
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 22px;
}

.group-material-edit-form__scope-guide-detail-items {
  flex-wrap: wrap;
  gap: 4px 20px;
  min-width: 0;
}

.group-material-edit-form__scope-guide-detail-items > span {
  gap: 6px;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  line-height: 22px;
}

.group-material-edit-form__scope-guide-detail-items i {
  flex: none;
  width: 4px;
  height: 4px;
  background: var(--bq-color-icon-muted);
  border-radius: 50%;
}

.group-material-edit-form__section {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  margin-bottom: 20px;
}

.group-material-edit-form__section.is-readonly {
  background: var(--bq-color-bg-soft);
}

.group-material-edit-form__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: 16px 20px;
  background: var(--material-section-head-bg);
  border-bottom: 1px solid var(--material-section-head-divider);
}

.group-material-edit-form__section-head::before {
  flex: 0 0 4px;
  width: 4px;
  height: 24px;
  border-radius: 999px;
  background: var(--material-section-head-accent);
  content: "";
}

.group-material-edit-form__section-head > h2,
.group-material-edit-form__section-head
  > .group-material-edit-form__title-with-help {
  flex: 1;
  min-width: 0;
  margin: 0;
}

.group-material-edit-form__section-head
  > .group-material-edit-form__title-with-help {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.group-material-edit-form__section-head
  > .group-material-edit-form__title-with-help
  .group-material-edit-form__help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 50%;
  font-size: 13px;
}

.group-material-edit-form__section-head > h2,
.group-material-edit-form__section-head
  > .group-material-edit-form__title-with-help
  h2 {
  color: var(--bq-color-text);
  font-size: var(--bq-font-section-title);
  font-weight: 700;
  line-height: 24px;
  letter-spacing: 0;
}

.group-material-edit-form__section-head
  > .group-material-edit-form__section-actions {
  flex: none;
  min-height: 24px;
}

.group-material-edit-form__section-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 24px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 22px;
}

.group-material-edit-form__section-hint {
  white-space: nowrap;
}

.group-material-edit-form__section-headless {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.group-material-edit-form__section h2,
.group-material-edit-form__block-editor h3 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: var(--bq-font-section-title);
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0;
}

.group-material-edit-form__ai-reference {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 2px 0 4px;
}

.group-material-edit-form__ai-reference-head,
.group-material-edit-form__ai-reference-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-material-edit-form__ai-reference-head {
  justify-content: space-between;
  min-height: 28px;
}

.group-material-edit-form__ai-reference-head
  .group-material-edit-form__title-with-help
  > strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.group-material-edit-form__ai-reference-actions {
  flex: none;
  gap: 8px;
}

.group-material-edit-form__ai-reference-actions .el-button {
  margin-left: 0;
}

.group-material-edit-form__ai-reference-note {
  padding-right: 10px;
  color: var(--bq-color-text-muted);
  border-right: 1px solid var(--bq-color-border-subtle);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.group-material-edit-form__help-icon {
  flex: none;
  color: var(--bq-color-text-muted);
  font-size: 15px;
  cursor: help;
}

.group-material-edit-form__facts-grid,
.group-material-edit-form__scope-grid,
.group-material-edit-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.group-material-edit-form__section:is(
  [data-material-target="cover"],
  .group-material-edit-form__previous-gate,
  [data-material-target="deliveryReview"]
),
.group-material-edit-form__attachment-section {
  gap: 0;
  padding: 0;
  overflow: hidden;
  background: var(--bq-color-surface);
  border-color: color-mix(
    in srgb,
    var(--bq-color-border),
    var(--bq-color-text-muted) 22%
  );
  border-radius: calc(var(--bq-radius-control) + 4px);
  box-shadow: var(--material-section-shadow);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.group-material-edit-form__attachment-section {
  margin-bottom: 20px;
}

.group-material-edit-form__attachment-section
  :deep(.attachment-panel--compact > header) {
  min-height: 62px;
  padding: 16px 20px;
  background: var(--material-section-head-bg);
  border-bottom-color: var(--material-section-head-divider);
  box-shadow: none;
}

.group-material-edit-form__attachment-section
  :deep(.attachment-panel--compact .file-list),
.group-material-edit-form__attachment-section
  :deep(.attachment-panel--compact > .el-empty) {
  background: var(--material-section-body-bg);
}

.group-material-edit-form__section:is(
    [data-material-target="cover"],
    .group-material-edit-form__previous-gate,
    [data-material-target="deliveryReview"]
  ):focus-within,
.group-material-edit-form__attachment-section:focus-within {
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border) 62%
  );
  box-shadow: 0 10px 28px rgba(31, 71, 133, 0.12);
}

.group-material-edit-form__section:is(
    [data-material-target="cover"],
    .group-material-edit-form__previous-gate,
    [data-material-target="deliveryReview"]
  )
  > .group-material-edit-form__section-head {
  align-items: center;
  min-height: 62px;
  padding: 16px 20px;
  background: var(--material-section-head-bg);
  border-bottom-color: var(--material-section-head-divider);
  box-shadow: none;
}

.group-material-edit-form__section:is(
    [data-material-target="cover"],
    [data-material-target="deliveryReview"]
  )
  .group-material-edit-form__title-with-help {
  gap: 8px;
}

.group-material-edit-form__section:is(
    [data-material-target="cover"],
    [data-material-target="deliveryReview"]
  )
  .group-material-edit-form__help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 50%;
  font-size: 13px;
}

.group-material-edit-form__section[data-material-target="deliveryReview"]
  > .group-material-edit-form__ai-reference {
  padding: 12px 20px;
  background: var(--bq-color-surface);
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__section[data-material-target="deliveryReview"]
  > .group-material-edit-form__review-workbench {
  padding: 16px 20px 20px;
  background: var(--material-section-body-bg);
}

.group-material-edit-form__cover-editor {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.8fr);
  gap: 16px 20px;
  padding: 18px 20px 20px;
  background: var(--material-section-body-bg);
}

.group-material-edit-form__cover-editor .is-span-full {
  grid-column: 1 / -1;
}

.group-material-edit-form__fact-card,
.group-material-edit-form__scope-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__fact-card span,
.group-material-edit-form__scope-list span {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 22px;
}

.group-material-edit-form__fact-card strong {
  overflow: hidden;
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-edit-form__scope-card {
  gap: 12px;
  border-left: 3px solid var(--bq-color-primary);
  background: color-mix(in srgb, var(--bq-color-primary-soft), white 58%);
}

.group-material-edit-form__scope-card.is-readonly {
  border-left-color: var(--bq-color-icon-muted);
  background: var(--bq-color-bg-soft);
}

.group-material-edit-form__scope-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-material-edit-form__scope-head .el-icon {
  flex: none;
  color: var(--bq-color-primary);
  font-size: 18px;
}

.group-material-edit-form__scope-card.is-readonly .el-icon {
  color: var(--bq-color-text-secondary);
}

.group-material-edit-form__scope-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.group-material-edit-form__scope-list > div,
.group-material-edit-form__scope-list span {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.group-material-edit-form__scope-list > div {
  justify-content: flex-start;
}

.group-material-edit-form__scope-list > div .el-button {
  flex: none;
  min-height: 20px;
  margin: 0;
  padding: 0;
}

.group-material-edit-form__scope-list i {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--bq-color-primary);
}

.group-material-edit-form__scope-card.is-readonly
  .group-material-edit-form__scope-list
  i {
  background: var(--bq-color-icon-muted);
}

.group-material-edit-form__review-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  min-width: 0;
}

.group-material-edit-form__editors {
  display: grid;
  gap: 8px;
}

.group-material-edit-form__block-outline {
  display: flex;
  align-items: stretch;
  gap: 8px;
  min-width: 0;
  padding: 6px;
  overflow-x: auto;
  background: var(--material-outline-bg);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: calc(var(--bq-radius-control) + 4px);
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.035);
  scrollbar-color: var(--bq-color-border) transparent;
  scrollbar-width: thin;
}

.group-material-edit-form__block-outline-item {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  flex: 1 1 150px;
  align-items: center;
  gap: 9px;
  min-width: 130px;
  min-height: 44px;
  padding: 7px 10px;
  color: var(--bq-color-text-secondary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  box-shadow: none;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.group-material-edit-form__block-outline-item:hover {
  z-index: 1;
  background: var(--bq-color-primary-soft);
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border) 64%
  );
  box-shadow: 0 4px 12px rgba(48, 84, 135, 0.08);
  transform: translateY(-1px);
}

.group-material-edit-form__block-outline-item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--bq-color-primary), white 40%);
  outline-offset: 2px;
}

.group-material-edit-form__block-outline-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--bq-color-text-muted);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--bq-color-bg-muted);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  transition:
    color 0.16s ease,
    background-color 0.16s ease;
}

.group-material-edit-form__block-outline-item:hover
  .group-material-edit-form__block-outline-index {
  color: var(--bq-color-primary-active);
  background: var(--bq-color-primary-soft);
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border) 72%
  );
}

.group-material-edit-form__block-outline-copy {
  display: grid;
  min-width: 0;
}

.group-material-edit-form__block-outline-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-material-edit-form__block-outline-copy strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.group-material-edit-form__block-outline-add-wrap {
  display: flex;
  flex: 0 0 128px;
  min-width: 128px;
}

.group-material-edit-form__block-outline-add {
  width: 100%;
  min-height: 44px;
  margin: 0;
  box-shadow: 0 4px 10px rgba(78, 143, 253, 0.18);
}

.group-material-edit-form__block-outline-add:hover {
  box-shadow: 0 6px 14px rgba(78, 143, 253, 0.24);
}

.group-material-edit-form__block-outline-add .el-icon {
  font-size: 16px;
}

.group-material-edit-form__block-editor > header > div > span {
  display: inline-flex;
  align-items: center;
  min-width: 24px;
  color: var(--bq-color-text-muted);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
}

.group-material-edit-form__block-order-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 2px;
  min-width: 0;
  padding-right: 8px;
  border-right: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__block-order-actions .el-button {
  width: auto;
  min-width: 0;
  height: 28px;
  margin: 0;
  padding: 0 7px;
}

.group-material-edit-form__block-order-button {
  --el-button-bg-color: transparent;
  --el-button-border-color: transparent;
  --el-button-hover-bg-color: var(--bq-color-primary-soft);
  --el-button-hover-border-color: transparent;
  --el-button-hover-text-color: var(--bq-color-primary-active);
  --el-button-text-color: var(--bq-color-text-secondary);
}

.group-material-edit-form__block-order-button.is-disabled {
  --el-button-disabled-bg-color: transparent;
  --el-button-disabled-border-color: transparent;
  --el-button-disabled-text-color: var(--bq-color-text-disabled);
}

.group-material-edit-form__block-order-button .el-icon {
  margin: 0;
  font-size: 14px;
}

.group-material-edit-form__block-editor {
  display: grid;
  gap: 0;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  background: var(--bq-color-surface);
  border: 1px solid
    color-mix(in srgb, var(--bq-color-border), var(--bq-color-text-muted) 18%);
  border-radius: calc(var(--bq-radius-control) + 2px);
  box-shadow: 0 6px 18px rgba(31, 71, 133, 0.07);
  scroll-margin-top: 12px;
  transition:
    border-color 0.16s,
    box-shadow 0.16s;
}

.group-material-edit-form__block-editor > header,
.group-material-edit-form__block-editor > header > div {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.group-material-edit-form__block-editor > header {
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 12px 16px;
  background: var(--material-block-head-bg);
  border-bottom: 1px solid var(--material-section-head-divider);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.72);
}

.group-material-edit-form__block-editor > header > div > span {
  justify-content: center;
  min-width: 30px;
  height: 28px;
  color: var(--bq-color-primary-active);
  background: color-mix(in srgb, var(--bq-color-primary-soft), white 28%);
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary), var(--bq-color-border) 76%);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__block-editor > header h3 {
  font-weight: 700;
}

.group-material-edit-form__block-editor > header > div {
  flex-wrap: wrap;
  align-items: center;
}

.group-material-edit-form__block-editor-actions {
  justify-content: flex-end;
  gap: 8px !important;
  margin-left: auto;
}

.group-material-edit-form__add-button {
  color: var(--bq-color-primary-active);
  background: var(--bq-color-surface);
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border) 74%
  );
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035);
}

.group-material-edit-form__add-button:hover,
.group-material-edit-form__add-button:focus-visible {
  color: var(--bq-color-primary-active);
  background: color-mix(in srgb, var(--bq-color-primary-soft), white 34%);
  border-color: var(--bq-color-primary);
  box-shadow: none;
}

.group-material-edit-form__standard-editor {
  display: grid;
  gap: 14px;
  padding: 18px;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.group-material-edit-form__cost-editor,
.group-material-edit-form__revenue-editor {
  display: grid;
  gap: 14px;
}

.group-material-edit-form__cost-editor {
  gap: 18px;
  padding: 18px;
}

.group-material-edit-form__revenue-editor {
  gap: 18px;
  padding: 18px;
}

.group-material-edit-form__cost-standard-editor {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.group-material-edit-form__cost-standard-editor
  .group-material-edit-form__standard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
}

.group-material-edit-form__cost-standard-editor
  :deep(
    .group-material-edit-form__standard-grid
      .group-material-edit-form__cost-standard-field
  ) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.group-material-edit-form__cost-standard-editor
  :deep(.group-material-edit-form__cost-standard-field:last-child) {
  grid-column: 1 / -1;
}

.group-material-edit-form__revenue-standard-editor {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.group-material-edit-form__revenue-standard-editor
  .group-material-edit-form__standard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
}

.group-material-edit-form__revenue-standard-editor
  :deep(
    .group-material-edit-form__standard-grid
      .group-material-edit-form__revenue-standard-field
  ) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
}

.group-material-edit-form__revenue-standard-editor
  :deep(.group-material-edit-form__revenue-standard-field:last-child) {
  grid-column: 1 / -1;
}

.group-material-edit-form__standard-grid {
  display: grid;
  gap: 20px;
}

.group-material-edit-form__standard-grid :deep(.el-form-item) {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
}

.group-material-edit-form__standard-grid :deep(.el-form-item__label) {
  justify-content: flex-end;
  min-height: 44px;
  padding: 0;
  text-align: right;
  white-space: normal;
}

.group-material-edit-form__readonly-panel {
  display: grid;
  gap: 18px;
  padding: 18px 20px;
  background: #fbfcfd;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}
.group-material-edit-form__forecast-editor {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: var(--bq-color-surface);
  border: 1px solid color-mix(in srgb, var(--bq-color-primary), white 66%);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__cost-forecast-editor {
  padding: 18px 0 0;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.group-material-edit-form__revenue-forecast-editor {
  padding: 18px 0 0;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.group-material-edit-form__forecast-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 30px;
}

.group-material-edit-form__forecast-toolbar.is-actions-only {
  justify-content: flex-end;
}

.group-material-edit-form__forecast-toolbar .el-button {
  flex: 0 0 auto;
  height: 30px;
  margin: 0;
  padding: 0 10px;
}

.group-material-edit-form__forecast-toolbar .el-icon {
  margin-right: 3px;
}

.group-material-edit-form__readonly-panel
  .group-material-edit-form__rows-head
  .el-icon {
  color: var(--bq-color-text-muted);
}

.group-material-edit-form__readonly-data-list {
  overflow: hidden;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__readonly-data-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  align-items: center;
  padding: 10px 12px;
  color: var(--bq-color-text);
  background: #fff;
}

.group-material-edit-form__readonly-data-row
  + .group-material-edit-form__readonly-data-row {
  border-top: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__readonly-data-row strong {
  justify-self: center;
  color: var(--bq-color-text);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.group-material-edit-form__readonly-table {
  overflow: hidden;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__readonly-table-head,
.group-material-edit-form__readonly-table-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px 280px;
  align-items: center;
  min-height: 50px;
  padding: 0 16px;
}

.group-material-edit-form__readonly-table-head {
  color: var(--bq-color-text);
  font-weight: 600;
  background: #f0f1f2;
}

.group-material-edit-form__readonly-table-row {
  color: var(--bq-color-text);
  background: #fff;
}

.group-material-edit-form__readonly-table-row
  + .group-material-edit-form__readonly-table-row {
  border-top: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__readonly-table-row strong {
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}

.group-material-edit-form__readonly-el-table {
  width: 100%;
}

.group-material-edit-form__readonly-el-table :deep(.el-table__header th) {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  background: #f0f1f2;
}

.group-material-edit-form__readonly-el-table :deep(.el-table__cell) {
  color: var(--bq-color-text);
  font-size: 14px;
}

.group-material-edit-form__forecast-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 16px;
}

.group-material-edit-form__forecast-card {
  align-content: start;
  min-height: 178px;
  padding: 24px 20px 22px;
}

.group-material-edit-form__revenue-table {
  width: 100%;
  overflow: hidden;
  border-radius: var(--bq-radius-control);
  --el-table-border-color: var(--bq-color-border-subtle);
  --el-table-row-hover-bg-color: #f8fbff;
}

.group-material-edit-form__revenue-table :deep(.el-table__inner-wrapper) {
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__revenue-table :deep(.el-table__header th) {
  min-height: 86px;
  padding: 12px 10px;
  color: var(--bq-color-text);
  background: #f1f1f1;
  font-weight: 700;
}

.group-material-edit-form__revenue-table :deep(.el-table__body td) {
  height: 66px;
  padding: 0;
  background: #fff;
}

.group-material-edit-form__revenue-table :deep(.el-table__body td:nth-child(3)),
.group-material-edit-form__revenue-table
  :deep(.el-table__header th:nth-child(3)) {
  background: #f5f7fb;
}

.group-material-edit-form__revenue-table
  :deep(.el-table__body tr.is-category-start td) {
  border-top: 6px solid #f0f1f2;
}

.group-material-edit-form__revenue-forecast-table {
  border-top: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.group-material-edit-form__revenue-forecast-table
  :deep(.el-table__inner-wrapper) {
  border-radius: 0;
}

.group-material-edit-form__revenue-forecast-table
  :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.group-material-edit-form__revenue-forecast-table :deep(.el-table__header th) {
  height: 80px;
  padding: 10px 12px;
  background: var(--bq-color-bg-soft);
  border-bottom-color: var(--bq-color-border-subtle);
  vertical-align: middle;
}

.group-material-edit-form__revenue-forecast-table
  :deep(.el-table__header th > .cell) {
  min-height: 62px;
  padding: 0;
}

.group-material-edit-form__revenue-forecast-table
  :deep(.el-table__header th:first-child > .cell) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 8px;
}

.group-material-edit-form__revenue-forecast-table :deep(.el-table__body td) {
  height: 56px;
  border-bottom-color: var(--bq-color-border-subtle);
}

.group-material-edit-form__revenue-forecast-table
  :deep(th.is-readonly-revenue-column),
.group-material-edit-form__revenue-forecast-table
  :deep(td.is-readonly-revenue-column) {
  background: color-mix(in srgb, var(--bq-color-bg-muted), white 48%);
}

.group-material-edit-form__revenue-forecast-table
  :deep(th.is-editable-revenue-column) {
  background: var(--bq-color-bg-soft);
}

.group-material-edit-form__revenue-forecast-table
  :deep(td.is-editable-revenue-column) {
  background: var(--bq-color-surface);
  transition: background 0.16s ease;
}

.group-material-edit-form__revenue-forecast-table
  :deep(td.is-editable-revenue-column:focus-within) {
  background: color-mix(in srgb, var(--bq-color-bg-soft), white 42%);
}

.group-material-edit-form__revenue-forecast-table
  :deep(.el-table__body tr.is-category-start td) {
  border-top: 4px solid var(--bq-color-bg-muted);
}

.group-material-edit-form__cost-node-list {
  display: grid;
}

.group-material-edit-form__cost-node-list-head,
.group-material-edit-form__cost-node-row {
  display: grid;
  grid-template-columns: 76px minmax(200px, 1.35fr) minmax(180px, 0.65fr) 64px;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 56px;
  padding: 10px 12px;
}

.group-material-edit-form__cost-node-list-head {
  color: var(--bq-color-text-muted);
  min-height: 40px;
  padding: 8px 12px;
  background: var(--bq-color-bg-soft);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__cost-node-list-head span:first-child,
.group-material-edit-form__cost-node-list-head span:last-child {
  text-align: center;
}

.group-material-edit-form__cost-node-list-head span:nth-child(3) {
  text-align: right;
}

.group-material-edit-form__cost-node-row {
  transition: background 0.16s;
}

.group-material-edit-form__cost-node-row:not(.is-readonly) {
  background: var(--bq-color-surface);
}

.group-material-edit-form__cost-node-row:not(.is-readonly):hover {
  background: var(--bq-color-bg-soft);
}

.group-material-edit-form__cost-node-row
  + .group-material-edit-form__cost-node-row {
  border-top: 1px solid var(--bq-color-border-subtle);
}

.group-material-edit-form__cost-node-row:focus-within {
  background: color-mix(in srgb, var(--bq-color-bg-soft), white 42%);
}

.group-material-edit-form__cost-node-row.is-readonly {
  background: color-mix(in srgb, var(--bq-color-bg-muted), white 48%);
}

.group-material-edit-form__cost-node-row.is-readonly:focus-within {
  background: color-mix(in srgb, var(--bq-color-bg-muted), white 48%);
}

.group-material-edit-form__cost-node-index {
  color: var(--bq-color-text-muted);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.group-material-edit-form__cost-node-readonly-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.group-material-edit-form__cost-node-readonly-copy strong {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.group-material-edit-form__cost-node-readonly-copy small,
.group-material-edit-form__cost-node-readonly-action {
  color: var(--bq-color-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.group-material-edit-form__cost-node-readonly-value {
  justify-self: end;
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 700;
  line-height: 24px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.group-material-edit-form__cost-node-readonly-action {
  justify-self: center;
}

.group-material-edit-form__cost-node-row > .el-button {
  justify-self: center;
  margin: 0;
  padding: 0;
}

.group-material-edit-form__cost-node-row :deep(.el-input__wrapper) {
  min-height: 36px;
  background: var(--material-edit-control-bg);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-line),
    0 1px 2px rgba(15, 23, 42, 0.045);
}

.group-material-edit-form__cost-node-row
  > :nth-child(3)
  :deep(.el-input__inner) {
  text-align: right;
}

.group-material-edit-form__cost-node-row :deep(.el-input__wrapper:hover) {
  background: var(--material-edit-control-hover-bg);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-hover-line),
    0 2px 5px rgba(48, 84, 135, 0.06);
}

.group-material-edit-form__cost-node-row :deep(.el-input__wrapper.is-focus) {
  background: var(--bq-color-surface);
  box-shadow:
    inset 0 0 0 1px var(--bq-color-primary),
    0 0 0 2px var(--bq-color-primary-soft);
}

.group-material-edit-form__revenue-metric {
  display: grid;
  align-content: center;
  gap: 4px;
  min-height: 56px;
  padding: 0 12px;
}

.group-material-edit-form__revenue-metric small {
  color: var(--bq-color-text-muted);
  font-size: 12px;
  line-height: 18px;
  margin-top: 0;
}

.group-material-edit-form__revenue-table
  :deep(.el-table__header th:first-child) {
  font-size: 14px;
}

.group-material-edit-form__revenue-metric strong,
.group-material-edit-form__metric-label {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
}

.group-material-edit-form__revenue-node-header {
  display: grid;
  grid-template-rows: 20px 36px;
  align-content: stretch;
  gap: 6px;
  width: 100%;
  min-height: 62px;
  min-width: 0;
}

.group-material-edit-form__revenue-node-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 20px;
  min-height: 20px;
  padding: 0 2px;
}

.group-material-edit-form__revenue-node-mode-row .el-button {
  margin: 0;
  padding: 0;
}

.group-material-edit-form__revenue-node-mode {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--bq-color-primary-active);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.group-material-edit-form__revenue-node-mode .el-icon {
  font-size: 13px;
}

.group-material-edit-form__revenue-node-mode i {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  background: var(--bq-color-icon-muted);
  border-radius: 50%;
}

.group-material-edit-form__revenue-node-mode.is-readonly {
  color: var(--bq-color-text-muted);
}

.group-material-edit-form__revenue-node-title {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  box-sizing: border-box;
}

.group-material-edit-form__revenue-node-header.is-readonly {
  background: transparent;
}

.group-material-edit-form__revenue-node-header.is-base {
  text-align: center;
}

.group-material-edit-form__revenue-node-header.is-base
  .group-material-edit-form__revenue-node-mode-row,
.group-material-edit-form__revenue-node-header.is-base
  .group-material-edit-form__revenue-node-title {
  justify-content: center;
}

.group-material-edit-form__revenue-value {
  display: grid;
  align-items: center;
  min-height: 56px;
  padding: 0 12px;
}

.group-material-edit-form__revenue-value.is-readonly {
  justify-content: end;
}

.group-material-edit-form__revenue-value strong,
.group-material-edit-form__readonly-value {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  text-align: right;
}

.group-material-edit-form__revenue-value :deep(.el-input__wrapper),
.group-material-edit-form__revenue-node-header :deep(.el-input__wrapper) {
  height: 36px;
  min-height: 36px;
  background: var(--material-edit-control-bg);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-line),
    0 1px 2px rgba(15, 23, 42, 0.045);
}

.group-material-edit-form__revenue-value :deep(.el-input__wrapper:hover),
.group-material-edit-form__revenue-node-header :deep(.el-input__wrapper:hover) {
  background: var(--material-edit-control-hover-bg);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-hover-line),
    0 2px 5px rgba(48, 84, 135, 0.06);
}

.group-material-edit-form__revenue-value :deep(.el-input__wrapper.is-focus),
.group-material-edit-form__revenue-node-header
  :deep(.el-input__wrapper.is-focus) {
  background: var(--bq-color-surface);
  box-shadow:
    inset 0 0 0 1px var(--bq-color-primary),
    0 0 0 2px var(--bq-color-primary-soft);
}

.group-material-edit-form__revenue-value :deep(.el-input__inner) {
  color: var(--bq-color-text);
  font-size: 14px;
  text-align: right;
}

.group-material-edit-form__revenue-value :deep(.el-input__suffix) {
  color: var(--bq-color-text-muted);
  font-size: 14px;
}

.group-material-edit-form__forecast-fields {
  display: grid;
  gap: 20px;
}

.group-material-edit-form__forecast-fields :deep(.el-form-item) {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}

.group-material-edit-form__forecast-fields :deep(.el-form-item__label) {
  justify-content: flex-end;
  padding: 0;
  text-align: right;
}

.group-material-edit-form__forecast-fields--group {
  gap: 18px;
}

.group-material-edit-form__forecast-fields--group
  :deep(.group-material-edit-form__forecast-group-name) {
  grid-template-columns: 66px minmax(0, 1fr);
  gap: 12px;
}

.group-material-edit-form__forecast-fields--group
  :deep(.group-material-edit-form__forecast-group-name .el-form-item__label) {
  width: auto !important;
  min-width: 0;
  white-space: nowrap;
}

.group-material-edit-form__forecast-inline {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.group-material-edit-form__forecast-inline :deep(.el-form-item) {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.group-material-edit-form__forecast-inline :deep(.el-form-item__label) {
  justify-content: flex-end;
  width: auto !important;
  min-width: 0;
  padding: 0;
  text-align: right;
}

.group-material-edit-form__forecast-inline :deep(.el-form-item__content) {
  min-width: 0;
}

.group-material-edit-form__rows-head,
.group-material-edit-form__row-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.group-material-edit-form__rows-head {
  margin-bottom: 2px;
}

.group-material-edit-form__rows-head strong,
.group-material-edit-form__section-title,
.group-material-edit-form__scope-head strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.group-material-edit-form__rows-head .el-icon {
  color: var(--bq-color-primary);
  font-size: 18px;
}

.group-material-edit-form__row-list {
  display: grid;
  gap: 14px;
}

.group-material-edit-form__topic-item {
  display: grid;
  gap: 14px;
  padding: 20px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.group-material-edit-form__topic-item-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.group-material-edit-form__previous-gate {
  > .group-material-edit-form__section-headless {
    padding: 16px 20px 24px;
    background: var(--material-section-body-bg);
  }

  .group-material-edit-form__section-actions > .el-button {
    margin-right: 4px;
  }

  .group-material-edit-form__section-hint {
    padding-left: 12px;
    border-left: 1px solid var(--bq-color-border-subtle);
  }

  .group-material-edit-form__row-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .group-material-edit-form__topic-item {
    display: flex;
    flex-direction: column;
    padding: 0;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.03);
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px 0 rgba(15, 23, 42, 0.05);
    }

    &:focus-within {
      border-color: var(--bq-color-primary, #1e40af);
      box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.08), 0 4px 12px 0 rgba(15, 23, 42, 0.05);

      .group-material-edit-form__row-index {
        color: #ffffff;
        background: var(--bq-color-primary, #1e40af);
        border-color: var(--bq-color-primary, #1e40af);
      }
    }
  }

  .group-material-edit-form__row-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 16px;
    background: #f8fafc;
    border-bottom: 1px solid #edf2f7;

    .group-material-edit-form__row-index {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 600;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 4px;
      transition: all 0.2s ease;
      letter-spacing: 0.2px;

      &::before {
        content: '';
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
    }

    .group-material-edit-form__previous-remove-btn,
    .el-button {
      height: 26px;
      padding: 0 8px;
      font-size: 12px;
      color: #94a3b8;
      border-radius: 4px;
      transition: all 0.16s ease;

      &:hover {
        color: #dc2626 !important;
        background: #fee2e2 !important;
      }
    }
  }

  .group-material-edit-form__previous-card-body {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
    padding: 16px 18px 18px;
  }

  .group-material-edit-form__top-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 0;

    :deep(.el-form-item__label) {
      padding-bottom: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      line-height: 20px;
    }

    :deep(.el-textarea__inner) {
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
      transition: all 0.16s ease;

      &:hover {
        border-color: #94a3b8;
      }

      &:focus {
        border-color: var(--bq-color-primary, #1e40af);
        box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.12);
      }
    }
  }
}

.group-material-edit-form__quality-editor {
  padding: 16px 20px 24px;

  .group-material-edit-form__row-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .group-material-edit-form__topic-item {
    display: flex;
    flex-direction: column;
    padding: 0;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.03);
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px 0 rgba(15, 23, 42, 0.05);
    }

    &:focus-within {
      border-color: var(--bq-color-primary, #1e40af);
      box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.08), 0 4px 12px 0 rgba(15, 23, 42, 0.05);

      .group-material-edit-form__quality-index-badge {
        color: #ffffff;
        background: var(--bq-color-primary, #1e40af);
        border-color: var(--bq-color-primary, #1e40af);
      }
    }
  }

  .group-material-edit-form__row-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 16px;
    background: #f8fafc;
    border-bottom: 1px solid #edf2f7;

    .group-material-edit-form__quality-index-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 600;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 4px;
      transition: all 0.2s ease;
      letter-spacing: 0.2px;

      &::before {
        content: '';
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
    }

    .group-material-edit-form__quality-remove-btn {
      height: 26px;
      padding: 0 8px;
      font-size: 12px;
      color: #94a3b8;
      border-radius: 4px;
      transition: all 0.16s ease;

      &:hover {
        color: #dc2626 !important;
        background: #fee2e2 !important;
      }
    }
  }

  .group-material-edit-form__quality-card-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 18px 18px;
  }

  .group-material-edit-form__quality-text-grid,
  .group-material-edit-form__quality-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
  }

  .group-material-edit-form__quality-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 0;

    :deep(.el-form-item__label) {
      padding-bottom: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      line-height: 20px;
    }

    :deep(.el-textarea__inner) {
      padding: 8px 12px;
      font-size: 13px;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
      transition: all 0.16s ease;

      &:hover {
        border-color: #94a3b8;
      }

      &:focus {
        border-color: var(--bq-color-primary, #1e40af);
        box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.12);
      }
    }

    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
    }

    :deep(.el-input__wrapper) {
      height: 34px;
      padding: 0 11px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
      transition: all 0.16s ease;

      &:hover {
        border-color: #94a3b8;
      }

      &.is-focus,
      &:focus-within {
        border-color: var(--bq-color-primary, #1e40af);
        box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.12);
      }
    }

    :deep(.el-input__inner) {
      font-size: 13px;
      color: #1e293b;
    }
  }
}

.group-material-edit-form__row-index {
  color: var(--bq-color-text-muted);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  font-variant-numeric: tabular-nums;
}

:deep(.group-material-edit-form__top-field) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 8px;
  min-width: 0;
  margin-bottom: 0;
}

:deep(.group-material-edit-form__top-field .el-form-item__label) {
  justify-content: flex-start;
  width: auto !important;
  min-height: 22px;
  padding: 0;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  text-align: left;
  white-space: nowrap;
  transition: color 0.16s ease;
}

:deep(
  .group-material-edit-form__top-field:not(.is-readonly-field):focus-within
    .el-form-item__label
) {
  color: var(--bq-color-primary-active);
}

:deep(.group-material-edit-form__top-field .el-form-item__content) {
  min-width: 0;
  margin-left: 0 !important;
}

:deep(.group-material-edit-form__top-field .el-textarea__inner) {
  min-height: 88px !important;
  padding: 11px 12px;
  caret-color: var(--bq-color-primary);
  background: var(--material-edit-control-bg);
  border-radius: var(--bq-radius-control);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-line),
    0 1px 2px rgba(15, 23, 42, 0.045);
  resize: vertical;
  transition:
    background 0.16s,
    box-shadow 0.16s;
}

:deep(.group-material-edit-form__top-field .el-textarea__inner:hover) {
  background: var(--material-edit-control-hover-bg);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-hover-line),
    0 2px 5px rgba(48, 84, 135, 0.06);
}

:deep(.group-material-edit-form__top-field .el-textarea__inner:focus) {
  background: var(--bq-color-surface);
  box-shadow:
    inset 0 0 0 1px var(--bq-color-primary),
    0 0 0 3px var(--bq-color-primary-soft);
}

:deep(.group-material-edit-form__top-field .el-input__wrapper),
:deep(.group-material-edit-form__top-field .el-select__wrapper) {
  min-height: 36px;
  background: var(--material-edit-control-bg);
  border-radius: var(--bq-radius-control);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-line),
    0 1px 2px rgba(15, 23, 42, 0.045);
  transition:
    background 0.16s,
    box-shadow 0.16s;
}

:deep(.group-material-edit-form__top-field .el-input__wrapper:hover),
:deep(.group-material-edit-form__top-field .el-select__wrapper:hover) {
  background: var(--material-edit-control-hover-bg);
  box-shadow:
    inset 0 0 0 1px var(--material-edit-control-hover-line),
    0 2px 5px rgba(48, 84, 135, 0.06);
}

:deep(.group-material-edit-form__top-field .el-input__wrapper.is-focus),
:deep(.group-material-edit-form__top-field .el-input__wrapper:focus-within),
:deep(.group-material-edit-form__top-field .el-select__wrapper.is-focused),
:deep(.group-material-edit-form__top-field .el-select__wrapper:focus-within) {
  background: var(--bq-color-surface);
  box-shadow:
    inset 0 0 0 1px var(--bq-color-primary),
    0 0 0 3px var(--bq-color-primary-soft);
}

:deep(
  .group-material-edit-form__top-field.is-readonly-field .el-input__wrapper
) {
  color: var(--bq-color-text-muted);
  background: var(--material-edit-readonly-bg);
  box-shadow: inset 0 0 0 1px var(--bq-color-border-subtle);
}

:deep(.group-material-edit-form__top-field .el-input__inner::placeholder),
:deep(.group-material-edit-form__top-field .el-textarea__inner::placeholder),
.group-material-edit-form__cost-node-row :deep(.el-input__inner::placeholder),
.group-material-edit-form__revenue-value :deep(.el-input__inner::placeholder),
.group-material-edit-form__revenue-node-header
  :deep(.el-input__inner::placeholder) {
  color: var(--material-edit-placeholder);
  opacity: 1;
}

:deep(.group-material-edit-form__top-field .el-input__inner),
:deep(.group-material-edit-form__top-field .el-textarea__inner),
:deep(.group-material-edit-form__top-field .el-select__selected-item),
.group-material-edit-form__cost-node-row :deep(.el-input__inner),
.group-material-edit-form__revenue-value :deep(.el-input__inner),
.group-material-edit-form__revenue-node-header :deep(.el-input__inner) {
  color: var(--bq-color-text);
  font-weight: 400;
}

:deep(
  .group-material-edit-form__top-field .el-select__placeholder.is-transparent
) {
  color: var(--material-edit-placeholder);
}

:deep(
  .group-material-edit-form__top-field
    .el-select__placeholder:not(.is-transparent)
) {
  color: var(--bq-color-text);
  font-weight: 400;
}

:deep(
  .group-material-edit-form__top-field.is-readonly-field
    .el-input.is-disabled
    .el-input__inner
) {
  color: var(--bq-color-text-secondary);
  font-variant-numeric: tabular-nums;
  cursor: default;
  -webkit-text-fill-color: var(--bq-color-text-secondary);
}

:deep(.group-material-edit-form__top-field.is-long-text .el-textarea__inner) {
  min-height: 168px !important;
}

.group-material-edit-form__custom-editor {
  gap: 16px;
}

.group-material-edit-form__ai-content {
  min-width: 0;
  padding: 12px 0 0;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.group-material-edit-form__ai-content p {
  margin: 0;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.opinion-stats,
.material-opinion-gate,
.material-opinion-department {
  display: grid;
  gap: 10px;
}

.opinion-stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 14px;
}

.opinion-stats > div {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  background: var(--bq-color-surface);
  border-radius: 4px;
}

.opinion-stats span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.material-opinion-gate {
}

.material-opinion-department {
  padding: 12px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 4px;
}

.material-opinion-department__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.material-opinion-department ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}

.material-opinion-department a {
  width: fit-content;
  color: var(--el-color-primary);
  font-size: 12px;
}

.group-material-edit-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.group-material-edit-form :deep(.el-form-item__label) {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.group-material-edit-form :deep(.el-input),
.group-material-edit-form :deep(.el-textarea) {
  width: 100%;
  font-size: 14px;
}

.group-material-edit-form :deep(.el-button) {
  font-size: 14px;
  font-weight: 400;
}

.group-material-edit-form :deep(.el-tag) {
  font-size: var(--bq-font-helper);
  font-weight: 400;
  line-height: 18px;
}

.group-material-edit-form :deep(.el-textarea__inner) {
  line-height: 22px;
}

@media print {
  .committee-group-material-display {
    display: block;
    padding: 0;
    background: #fff;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .committee-group-material-display :deep(.el-button) {
    display: none !important;
  }

  .group-material-display__hero,
  .group-material-display__section {
    margin-bottom: 12mm;
  }

  .group-material-display__hero,
  .group-material-display__section-head,
  .group-material-display__metric,
  .group-material-display__fact,
  .group-material-display__decision-box,
  .group-material-display__attachment-item {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .group-material-display__section-head {
    break-after: avoid-page;
    page-break-after: avoid;
  }

  .group-material-display__spectrum-card {
    overflow: visible !important;
  }

  .group-material-display__spectrum-table {
    min-width: 0 !important;
  }

  .group-material-display__spectrum-table,
  .group-material-display__spectrum-table :deep(table) {
    width: 100% !important;
    table-layout: fixed;
  }

  .group-material-display__spectrum-table :deep(col) {
    width: auto !important;
  }

  .group-material-display__spectrum-table :deep(.el-table__cell) {
    padding: 3px 0;
  }

  .group-material-display__spectrum-table :deep(.el-table__body-wrapper) {
    overflow: visible !important;
  }

  .group-material-display__spectrum-table :deep(.el-table__inner-wrapper),
  .group-material-display__spectrum-table :deep(.el-scrollbar),
  .group-material-display__spectrum-table :deep(.el-scrollbar__wrap) {
    overflow: visible !important;
  }

  .group-material-display__spectrum-table :deep(.el-scrollbar__view) {
    width: 100% !important;
  }

  .group-material-display__spectrum-table :deep(.el-scrollbar__bar) {
    display: none !important;
  }

  .group-material-display__spectrum-table :deep(.cell) {
    padding: 0 2px;
    font-size: 8px;
    line-height: 12px;
    white-space: normal;
    word-break: break-word;
    overflow: visible;
    text-overflow: clip;
  }

  .group-material-display__blue-panel {
    break-inside: avoid-page;
    page-break-inside: avoid;
    overflow: visible !important;
  }

  .group-material-display__revenue-table {
    width: 100% !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .group-material-display__revenue-table :deep(table) {
    width: 100% !important;
    table-layout: fixed;
  }

  .group-material-display__revenue-table :deep(col) {
    width: auto !important;
  }

  .group-material-display__revenue-table :deep(.el-table__body-wrapper) {
    overflow: visible !important;
  }

  .group-material-display__revenue-table :deep(.el-table__inner-wrapper),
  .group-material-display__revenue-table :deep(.el-scrollbar),
  .group-material-display__revenue-table :deep(.el-scrollbar__wrap) {
    overflow: visible !important;
  }

  .group-material-display__revenue-table :deep(.el-scrollbar__view) {
    width: 100% !important;
  }

  .group-material-display__revenue-table :deep(.el-scrollbar__bar) {
    display: none !important;
  }

  .group-material-display__revenue-table :deep(.el-table__cell) {
    height: auto !important;
  }

  .group-material-display__revenue-table :deep(.el-table__cell .cell) {
    padding: 5px 8px;
    line-height: 16px;
    white-space: normal;
    word-break: break-word;
    overflow: visible;
    text-overflow: clip;
  }
}

@media (max-width: 1280px) {
  .group-material-display__hero,
  .group-material-display__overview-composite,
  .group-material-display__summary-grid,
  .group-material-display__attachments {
    grid-template-columns: 1fr;
  }

  .group-material-display__deliverables {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .group-material-edit-form__save-state,
  .group-material-edit-form__section-head,
  .group-material-edit-form__section-actions,
  .group-material-edit-form__scope-head,
  .group-material-edit-form__ai-reference-head {
    flex-direction: column;
    align-items: stretch;
  }

  .group-material-edit-form__ai-reference-actions {
    justify-content: flex-end;
  }

  .group-material-edit-form__scope-guide-actions {
    flex-basis: 100%;
    order: 3;
  }

  .group-material-edit-form__scope-guide-context {
    flex-direction: column;
    align-items: flex-start;
  }

  .group-material-edit-form__scope-guide-meeting {
    flex-wrap: wrap;
  }

  .group-material-edit-form__scope-guide-detail {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-material-edit-form__facts-grid,
  .group-material-edit-form__scope-grid,
  .group-material-edit-form__scope-list,
  .group-material-edit-form__grid,
  .group-material-edit-form__review-workbench,
  .group-material-edit-form__forecast-grid,
  .group-material-edit-form__readonly-data-row,
  .group-material-edit-form__readonly-table-head,
  .group-material-edit-form__readonly-table-row,
  .group-material-edit-form__forecast-inline {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-material-edit-form__cover-editor {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-material-edit-form__cover-editor .is-span-full {
    grid-column: auto;
  }

  .group-material-edit-form__previous-gate
    .group-material-edit-form__previous-card-body,
  .group-material-edit-form__previous-gate
    .group-material-edit-form__topic-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-material-edit-form__quality-editor
    .group-material-edit-form__quality-text-grid,
  .group-material-edit-form__quality-editor
    .group-material-edit-form__quality-meta-grid,
  .group-material-edit-form__quality-editor
    .group-material-edit-form__topic-item,
  .group-material-edit-form__quality-editor
    .group-material-edit-form__topic-item-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  :deep(.group-material-edit-form__top-field .el-form-item__label) {
    white-space: normal;
  }

  .group-material-edit-form__cost-standard-editor
    .group-material-edit-form__standard-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-material-edit-form__cost-standard-editor
    :deep(.group-material-edit-form__cost-standard-field:last-child) {
    grid-column: auto;
  }

  .group-material-edit-form__revenue-standard-editor
    .group-material-edit-form__standard-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .group-material-edit-form__revenue-standard-editor
    :deep(.group-material-edit-form__revenue-standard-field:last-child) {
    grid-column: auto;
  }

  .group-material-edit-form__forecast-toolbar {
    flex-wrap: wrap;
  }

  .group-material-edit-form__cost-node-list-head {
    display: none;
  }

  .group-material-edit-form__cost-node-row {
    grid-template-columns: 36px minmax(0, 1fr) 44px;
  }

  .group-material-edit-form__cost-node-row
    .group-material-edit-form__cost-node-index {
    grid-row: 1 / 3;
  }

  .group-material-edit-form__cost-node-row > :nth-child(2) {
    grid-column: 2 / 3;
  }

  .group-material-edit-form__cost-node-row > :nth-child(3) {
    grid-column: 2 / 4;
  }

  .group-material-edit-form__cost-node-row > :nth-child(4) {
    grid-column: 3 / 4;
    grid-row: 1;
  }

  .group-material-edit-form__cost-node-readonly-value {
    justify-self: start;
  }

  .group-material-edit-form__previous-gate
    .group-material-edit-form__section-actions {
    flex-flow: row wrap;
    align-items: center;
  }

  .group-material-edit-form__standard-grid :deep(.el-form-item),
  .group-material-edit-form__forecast-fields :deep(.el-form-item),
  .group-material-edit-form__forecast-inline :deep(.el-form-item) {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .group-material-edit-form__standard-grid :deep(.el-form-item__label),
  .group-material-edit-form__forecast-fields :deep(.el-form-item__label),
  .group-material-edit-form__forecast-inline :deep(.el-form-item__label) {
    justify-content: flex-start;
    min-height: auto;
    text-align: left;
  }

  .committee-group-material-display {
    padding: 10px;
  }

  .group-material-display__hero {
    padding: 10px;
    gap: 0;
  }

  .group-material-display__hero-panel {
    min-height: auto;
    padding: 24px 20px;
  }

  .group-material-display__hero-brand {
    min-height: 72px;
    padding: 0 20px;
  }

  .group-material-display__hero-brand img {
    width: min(210px, 58vw);
  }

  .group-material-display__hero-backdrop {
    width: 68%;
    height: 100%;
    -webkit-mask-image: linear-gradient(
      90deg,
      transparent 0%,
      rgba(0, 0, 0, 0.18) 22%,
      rgba(0, 0, 0, 0.76) 60%,
      #000 82%
    );
    mask-image: linear-gradient(
      90deg,
      transparent 0%,
      rgba(0, 0, 0, 0.18) 22%,
      rgba(0, 0, 0, 0.76) 60%,
      #000 82%
    );
  }

  .group-material-display__hero-copy {
    max-width: 100%;
  }

  .group-material-display__cover-facts,
  .group-material-display__fact-grid,
  .group-material-display__deliverables {
    grid-template-columns: 1fr;
  }

  .group-material-display__cover-fact {
    min-height: auto;
    padding: 0;
  }

  .group-material-display__cover-fact + .group-material-display__cover-fact {
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.24);
    border-left: 0;
  }

  .group-material-display__cover-fact strong {
    white-space: normal;
  }

  .group-material-display__hero h2,
  .group-material-display__section-head p,
  .group-material-display__section-head h3 {
    font-size: 24px;
  }

  .group-material-display__spectrum-card {
    overflow-x: auto;
  }

  .group-material-display__timeline-board,
  .group-material-display__blue-panel {
    overflow-x: auto;
  }

  .group-material-display__spectrum-table {
    min-width: 980px;
  }

  .group-material-display__bar-chart {
    justify-content: flex-start;
    overflow-x: auto;
  }
}

@media print {
  :global(.app-layout__navbar),
  :global(.app-layout__sidebar),
  :global(.app-layout__tags-view),
  :global(.page-container__header) {
    display: none !important;
  }

  :global(html),
  :global(body),
  :global(#app),
  :global(.app-layout),
  :global(.app-layout__main),
  :global(.app-layout__content) {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  :global(.app-layout),
  :global(.app-layout__main),
  :global(.app-layout__content) {
    margin: 0 !important;
    padding: 0 !important;
  }

  .committee-group-material-display {
    display: block;
    padding: 0;
    background: #fff;
  }

  .group-material-display__hero,
  .group-material-display__section {
    margin-bottom: 12px;
    padding: 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .group-material-display__spectrum-card,
  .group-material-display__timeline-board,
  .group-material-display__blue-panel,
  .group-material-display__section-card,
  .group-material-display__blue-table,
  .group-material-display__matrix-table,
  .group-material-display__revenue-table,
  .group-material-display__bar-chart,
  .group-material-display__spectrum-table :deep(.el-table__inner-wrapper),
  .group-material-display__blue-table :deep(.el-table__inner-wrapper),
  .group-material-display__matrix-table :deep(.el-table__inner-wrapper),
  .group-material-display__revenue-table :deep(.el-table__inner-wrapper),
  .group-material-display__spectrum-table :deep(.el-table__body-wrapper),
  .group-material-display__blue-table :deep(.el-table__body-wrapper),
  .group-material-display__matrix-table :deep(.el-table__body-wrapper),
  .group-material-display__revenue-table :deep(.el-table__body-wrapper),
  .group-material-display__spectrum-table :deep(.el-scrollbar__wrap),
  .group-material-display__blue-table :deep(.el-scrollbar__wrap),
  .group-material-display__matrix-table :deep(.el-scrollbar__wrap),
  .group-material-display__revenue-table :deep(.el-scrollbar__wrap) {
    overflow: visible !important;
  }

  .group-material-display__spectrum-table,
  .group-material-display__blue-table,
  .group-material-display__matrix-table,
  .group-material-display__revenue-table {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .group-material-display__spectrum-table :deep(table),
  .group-material-display__blue-table :deep(table),
  .group-material-display__matrix-table :deep(table),
  .group-material-display__revenue-table :deep(table) {
    width: 100% !important;
    table-layout: fixed !important;
  }

  .group-material-display__spectrum-table :deep(col),
  .group-material-display__blue-table :deep(col),
  .group-material-display__matrix-table :deep(col),
  .group-material-display__revenue-table :deep(col) {
    width: auto !important;
  }

  .group-material-display__spectrum-table :deep(.el-scrollbar__bar),
  .group-material-display__blue-table :deep(.el-scrollbar__bar),
  .group-material-display__matrix-table :deep(.el-scrollbar__bar),
  .group-material-display__revenue-table :deep(.el-scrollbar__bar) {
    display: none !important;
  }

  .group-material-display__spectrum-table :deep(.el-table__cell),
  .group-material-display__blue-table :deep(.el-table__cell),
  .group-material-display__matrix-table :deep(.el-table__cell),
  .group-material-display__revenue-table :deep(.el-table__cell) {
    height: auto !important;
    padding: 4px !important;
    font-size: 10px !important;
    line-height: 1.35 !important;
  }

  .group-material-display__spectrum-table :deep(.cell),
  .group-material-display__blue-table :deep(.cell),
  .group-material-display__matrix-table :deep(.cell),
  .group-material-display__revenue-table :deep(.cell) {
    display: block;
    padding: 0 4px !important;
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: normal !important;
    word-break: break-word;
  }
}
</style>
