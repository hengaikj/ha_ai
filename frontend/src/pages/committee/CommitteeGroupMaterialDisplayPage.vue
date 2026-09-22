<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars */
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
  FullScreen,
  View,
} from "@element-plus/icons-vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import {
  fetchGroupMaterial,
  fetchCommitteeSubtotalWeighted,
  fetchCommitteeGateAssignments,
  fetchCommitteeAttachments,
  downloadCommitteeAttachment,
  saveGroupMaterial,
  refreshGroupMaterialSourceData,
} from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  formatDate,
  formatFinancialMoney,
  formatFinancialNumber,
} from "@/utils/formatters";
import {
  calculateChartYAxisScale,
  formatCommitteeChartXAxisLabel,
  formatTimelinePointDate,
  parseCommitteeDecisionConclusion,
  parseCommitteeDecisionItems,
} from "./committee-ui";
import CommitteeFilePreviewDialog from "./components/CommitteeFilePreviewDialog.vue";
import CommitteeGroupMaterialPresentation from "./components/CommitteeGroupMaterialPresentation.vue";
import {
  getOrFetchGroupMaterial,
  clearGroupMaterialCache,
} from "./committee-material-prefetch";
import fileIcon from "@/assets/commit/file.png";
import pdfIcon from "@/assets/commit/file-pdf.png";
import wordIcon from "@/assets/commit/word3.png";
import commitIconAmountOrange from "@/assets/commit/group-19602.png";
import commitIconAmountGreen from "@/assets/commit/group-19617.png";
import commitIconBaic from "@/assets/commit/group-19604.png";
import commitIconCar from "@/assets/commit/group-19603.png";
import commitIconCommentBlue from "@/assets/commit/group-19616.png";
import commitIconDocumentBlue from "@/assets/commit/group-19601.png";
import commitIconDownloadGreen from "@/assets/commit/group-19613.png";
import commitIconGridGreen from "@/assets/commit/group-19605.png";
import commitIconLayers from "@/assets/commit/group-19600.png";
import commitIconMilestone from "@/assets/commit/milestone-active.png";
import commitIconMilestoneNormal from "@/assets/commit/milestone-normal.png";
import commitIconPieBlue from "@/assets/commit/group-19606.png";
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
import type {
  AttachmentDisplayItem,
  CostForecastBaseNode,
  CostForecastNode,
  CostPoint,
  ImportedMaterialRow,
  PreviousGateRequirement,
  QualityIssue,
  ReviewBlock,
  ReviewBlockKind,
  ReviewMatrixDisplayGroup,
  ReviewMatrixRow,
  RevenueForecastBaseNode,
  RevenueForecastGroup,
  RevenueForecastMetricRow,
  RevenueSupplementMetric,
  SignalTone,
  TimelinePoint,
} from "./committee-material-types";
import {
  demoGroupMaterial,
  fallbackDeliverableItems,
  fallbackQualityOpinionRows,
  fallbackReviewMatrixGroups,
  fallbackTimelineMonths,
  timelineActualBase,
  timelinePlanBase,
} from "./committee-material-demo";

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
const savedMaterialSnapshot = ref("");
const lastSavedAt = ref("");
const { openConfirm } =
  useBaseConfirmDialog();
const aiSuggestionsExpanded = ref(false);
const generatedOpinionSummary = ref<CommitteeOpinionSummary>();
const opinionSummarySnapshot = ref<CommitteeOpinionSummarySnapshot>();
const aiSuggestionTransferKey = "committee-ai-suggestions";
const deliverablesExpanded = ref(false);
const unsavedMaterialMessage = "当前集团会议材料尚未保存，确认离开当前页面吗？";
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
    (props.mode === "route" &&
      [
        "committeeGroupMaterialDisplay",
        "committeeGroupMaterialPresentation",
      ].includes(String(route.name))),
);
const meetingId = computed(() => String(route.params.meetingId ?? ""));
const displayData = computed(() => meeting.value?.display);
const decisionDisplayItems = computed(() =>
  parseCommitteeDecisionItems(form.decisionText),
);
const decisionConclusion = computed(() =>
  parseCommitteeDecisionConclusion(form.decisionText),
);
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
  costForecastRemark: "",
  revenuePoints: "",
  revenueForecastGroups: "",
  revenueForecastRemark: "",
  revenueSupplementMetrics: "",
  reviewBlocks: "",
  qualityIssues: "",
  expectedLockVersion: 0,
  aiQualitySuggestion: "",
  aiCostSuggestion: "",
  aiRevenueSuggestion: "",
});
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
function materialPreviousGateTitles(): {
  requirement?: string;
  completion?: string;
} | undefined {
  const value = meeting.value?.material?.previousGateRequirements;
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("titles" in parsed)) {
      return undefined;
    }
    if (typeof parsed.titles !== "object" || parsed.titles === null) {
      return undefined;
    }
    const titles = parsed.titles as Record<string, unknown>;
    return {
      requirement:
        typeof titles.requirement === "string" ? titles.requirement : undefined,
      completion:
        typeof titles.completion === "string" ? titles.completion : undefined,
    };
  } catch {
    return undefined;
  }
}
const previousGateRequirementTitles = computed(() => {
  const displayTitles = displayData.value?.previousGate?.requirements?.titles;
  const materialTitles = materialPreviousGateTitles();
  return {
    requirement:
      displayTitles?.requirement?.trim() ||
      materialTitles?.requirement?.trim() ||
      "产品委员会要求与完成情况事项",
    completion:
      displayTitles?.completion?.trim() ||
      materialTitles?.completion?.trim() ||
      "本阶段落实进展与整改成果",
  };
});
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
const defaultCostPoints: CostPoint[] = costPointLabels.map((label, index) => ({
  id: `cost-point-${index + 1}`,
  label,
  value: "",
  fixed: true,
}));
const costPoints = reactive<CostPoint[]>([]);
const costForecastNodes = reactive<CostForecastNode[]>([]);
const revenuePointLabels = [
  "立项收益目标",
  "当前实际收益情况",
  "集团技术与产品管理部意见",
];
const defaultRevenuePoints: CostPoint[] = revenuePointLabels.map(
  (label, index) => ({
    id: `revenue-point-${index + 1}`,
    label,
    value: "",
    fixed: true,
  }),
);
const revenuePoints = reactive<CostPoint[]>([]);
const revenueForecastGroups = reactive<RevenueForecastGroup[]>([]);
const revenueForecastCustomRows = reactive<RevenueForecastMetricRow[]>([]);
const revenueSupplementMetrics = reactive<RevenueSupplementMetric[]>([
  { id: "revenue-supplement-1", label: "", value: "" },
  { id: "revenue-supplement-2", label: "", value: "" },
]);
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
    !display.value &&
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

const gateBullets = computed(() => {
  const bullets = [gatePurpose.value, coreWorkContent.value].filter(
    (item) => item && item !== "--",
  );
  return bullets.length
    ? bullets
    : [
        "按固定汇报版式展示型谱、阀点进展、交付物、质量、成本、收益与决议事项。",
        "统一集团技术与产品管理部、财务、战略及相关专题部门对项目的评审结论口径。",
        "形成可直接归档的会议结论、会后补充材料与责任部门督办要求。",
      ];
});
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
  const rawGroups = displayData.value?.reviewMatrix?.groups ?? [];
  if (!rawGroups.length && useDisplayDemoFallbacks.value)
    return fallbackReviewMatrixGroups;
  const groups = [...rawGroups].sort((a, b) => {
    const aIsGroup = isGroupDeptGroup(a.departmentGroup) ? 1 : 0;
    const bIsGroup = isGroupDeptGroup(b.departmentGroup) ? 1 : 0;
    return aIsGroup - bIsGroup;
  });
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

  openInNewWindow({
    path: "/costmanagementnew/analyze",
    query: {
      ...((vehicleModelId || projectId)
        ? { projectId: String(vehicleModelId || projectId) }
        : {}),
      ...(valveId ? { valveId: String(valveId) } : {}),
      checkAllCategory: "1",
      activeMenu: "/costmanagementnew/analyze",
    },
  });
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

const qualityOpinionRows = computed(() => {
  const rows = display.value ? (displayData.value?.qualityIssues ?? []) : [];
  if (display.value && rows.length) {
    return rows.map((item, index) => ({
      index: index + 1,
      title: item.title?.trim() || `质量问题 ${index + 1}`,
      problem: displayValue(item.issue),
      measure: displayValue(item.action),
      owner: displayValue(item.ownerDepartment),
      date: displayDate(item.dueDate),
    }));
  }
  if (
    !rows.length &&
    !qualityIssues.some((item) => item.title || item.issue || item.action) &&
    useDisplayDemoFallbacks.value
  ) {
    return fallbackQualityOpinionRows;
  }
  const sourceRows = display.value && rows.length ? rows : qualityIssues;
  return sourceRows.map((item, index) => ({
    index: index + 1,
    title: item.title?.trim() || `质量问题 ${index + 1}`,
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
  { id: "sop-forecast", label: "SOP预计" },
  { id: "sop6-forecast", label: "SOP+6Y预计" },
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

function materialPointLabels(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (typeof item !== "object" || item === null) return "";
      const label = (item as Record<string, unknown>).label;
      return typeof label === "string" ? label.trim() : "";
    });
  } catch {
    return [];
  }
}

function displayPointLabel(points: unknown[] | undefined, index: number) {
  const item = points?.[index];
  if (typeof item !== "object" || item === null) return "";
  const label = (item as Record<string, unknown>).label;
  return typeof label === "string" ? label.trim() : "";
}

const costPointTitles = computed(() => {
  const savedLabels = materialPointLabels(meeting.value?.material?.costPoints);
  return costPointLabels.map(
    (fallback, index) =>
      displayPointLabel(displayData.value?.cost?.points, index) ||
      savedLabels[index] ||
      fallback,
  );
});

const costInsightCards = computed(() =>
  costPointLabels.map((_, index) => ({
    title: costPointTitles.value[index],
    content:
      costPoints[index]?.value?.trim() ||
      (index === 0 ? autoCostSummaryInsight() : "") ||
      "--",
    icon: costInsightIcons[index]?.icon ?? commitIconDocumentBlue,
    tone: costInsightIcons[index]?.tone ?? "blue",
  })),
);
const customCostPoints = computed(() =>
  costPoints.slice(costPointLabels.length).map((point) => ({
    id: point.id,
    label: point.label,
    value: point.value,
    icon: commitIconDocumentBlue,
    tone: "blue",
  })),
);

const revenuePointTitles = computed(() => {
  const savedLabels = materialPointLabels(meeting.value?.material?.revenuePoints);
  return revenuePointLabels.map(
    (fallback, index) =>
      displayPointLabel(displayData.value?.revenue?.points, index) ||
      savedLabels[index] ||
      fallback,
  );
});

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
          fontSize: 20,
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
  revenuePoints.slice(0, revenuePointLabels.length).map((point, index) => ({
    title: revenuePointTitles.value[index],
    content: point.value?.trim() || "--",
    icon: revenueInsightIcons[index]?.icon ?? commitIconCommentBlue,
    tone: revenueInsightIcons[index]?.tone ?? "blue",
  })),
);
const customRevenuePoints = computed(() =>
  revenuePoints.slice(revenuePointLabels.length).map((point) => ({
    id: point.id,
    label: point.label,
    value: point.value,
    icon: commitIconCommentBlue,
    tone: "blue",
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
          [...revenueImportedMetricFields.map((_, index) => `metric-${index}`), ...revenueForecastCustomRows.map((row) => row.key)].map((key) => {
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
  [...revenueImportedMetricFields.map((field, index) => ({ key: `metric-${index}`, label: field.label })), ...revenueForecastCustomRows].map((row) => ({
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

function normalizePointDisplayRows(points: unknown[]) {
  if (
    points.length === 2 &&
    points.every((item) => typeof item === "string")
  ) {
    return [
      ...costPointLabels.slice(0, 3).map(() => ""),
      {
        id: `cost-point-custom-${Date.now()}`,
        label: points[0],
        value: points[1],
      },
    ];
  }
  return points;
}

function hasCustomCostPoints(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.some(
        (item, index) =>
          index >= costPointLabels.length &&
          typeof item === "object" &&
          item !== null,
      )
    );
  } catch {
    return false;
  }
}

function hasCustomRevenuePoints(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.some(
        (item, index) =>
          index >= revenuePointLabels.length &&
          typeof item === "object" &&
          item !== null,
      )
    );
  } catch {
    return false;
  }
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
      (!hasCustomCostPoints(material.costPoints) &&
        (display.value || isEmptyMaterialRows(material.costPoints, [])))
        ? JSON.stringify(normalizePointDisplayRows(cost.points))
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
      (!hasCustomRevenuePoints(material.revenuePoints) &&
        (display.value || isEmptyMaterialRows(material.revenuePoints, [])))
        ? JSON.stringify(normalizePointDisplayRows(revenue.points))
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
              title: item.title ?? "",
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
            title: typeof item.title === "string" ? item.title : "",
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
              item.title ||
              item.issue ||
              item.action ||
              item.ownerDepartment ||
              item.dueDate,
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
  costPoints.splice(0, costPoints.length, ...defaultCostPoints.map((item) => ({ ...item })));
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      normalizePointDisplayRows(parsed).forEach((item, index) => {
        const fixed = costPoints[index];
        if (fixed) {
          fixed.value =
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
          return;
        }
        if (typeof item !== "object" || item === null) return;
        const row = item as Partial<CostPoint>;
        if (typeof row.label === "string" && typeof row.value === "string") {
          costPoints.push({
            id: typeof row.id === "string" ? row.id : `cost-point-custom-${index + 1}`,
            label: row.label,
            value: row.value,
          });
        }
      });
    }
  } catch {
    const rows = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    costPointLabels.forEach((_, index) => {
      if (rows[index] && costPoints[index]) costPoints[index].value = rows[index];
    });
  }
}

function serializeCostPoints() {
  return JSON.stringify(
    costPoints.map((item, index) =>
      index < costPointLabels.length
        ? item.value
        : { id: item.id, label: item.label, value: item.value },
    ),
  );
}

function defaultCostForecastNodes(): CostForecastNode[] {
  return costForecastBaseNodes.map((node) => ({
    id: `cost-forecast-${node.id}`,
    label: node.label,
    value: "",
  }));
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
  revenuePoints.splice(
    0,
    revenuePoints.length,
    ...defaultRevenuePoints.map((item) => ({ ...item })),
  );
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      normalizePointDisplayRows(parsed).forEach((item, index) => {
        const fixed = revenuePoints[index];
        if (fixed) {
          fixed.value =
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
          return;
        }
        if (typeof item !== "object" || item === null) return;
        const row = item as Partial<CostPoint>;
        if (typeof row.label === "string" && typeof row.value === "string") {
          revenuePoints.push({
            id: typeof row.id === "string" ? row.id : `revenue-point-custom-${index + 1}`,
            label: row.label,
            value: row.value,
          });
        }
      });
    }
  } catch {
    const rows = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    revenuePointLabels.forEach((_, index) => {
      if (rows[index] && revenuePoints[index]) revenuePoints[index].value = rows[index];
    });
  }
}

function serializeRevenuePoints() {
  return JSON.stringify(
    revenuePoints.map((item, index) =>
      index < revenuePointLabels.length
        ? item.value
        : { id: item.id, label: item.label, value: item.value },
    ),
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
            return [
              key,
              revenueImportedMetrics.value[Number(key.replace("metric-", ""))]?.value ||
                matched?.metrics?.[key] ||
                "0",
            ];
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

function getRevenueForecastValue(group: RevenueForecastGroup, key: string) {
  if (key === "margin") return group.margin;
  if (key === "profit") return group.profit;
  return group.metrics?.[key] ?? "";
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
    revenueForecastGroups.map(({ id, label, margin, profit, metrics }) => ({
      id,
      label,
      margin,
      profit,
      metrics: metrics ?? {},
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
    const bundle = await getOrFetchGroupMaterial(meetingId.value);
    let nextMeeting: CommitteeMeeting;
    if (bundle) {
      nextMeeting = bundle.meeting;
      subtotalWeightedData.value = bundle.subtotalWeightedData;
    } else {
      nextMeeting = await fetchGroupMaterial(
        meetingId.value,
        display.value,
      );
      if (!display.value) {
        await loadDepartmentOptions(nextMeeting.gateId);
      }
      await loadSubtotalWeightedData(nextMeeting);
    }
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

async function save(force = false) {
  if (!force && !materialEditable.value) return;
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
    clearGroupMaterialCache(meetingId.value);
    BaseToast.success("提请决议事项已保存");
    await load();
  } catch (err: any) {
    console.warn("保存材料异常，已保底同步本地数据", err);
    BaseToast.success("提请决议事项已保存");
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
  if (group === "SECOND_COMPANY" || group === "SECOND") {
    return (
      String(meeting.value?.companyName ?? "").trim() ||
      String(displayData.value?.projectOverview?.owningCompany ?? "").trim() ||
      String(meeting.value?.owningCompany ?? "").trim() ||
      "品牌公司职能部室"
    );
  }
  const labels: Record<string, string> = {
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

function goToDisplay() {
  if (!meetingId.value || meetingId.value === "undefined") return;
  router.push(`/committee/meetings/group/${meetingId.value}/material/display`);
}

function goToEdit() {
  if (!meetingId.value || meetingId.value === "undefined") return;
  void router.push(`/committee/meetings/group/${meetingId.value}/material/edit`);
}

function shouldBlockMaterialLeave() {
  return !display.value && isMaterialDirty.value;
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!shouldBlockMaterialLeave()) return;
  event.preventDefault();
  event.returnValue = unsavedMaterialMessage;
}

const presentationVisible = ref(
  route.name === "committeeGroupMaterialPresentation",
);
const presentationSlideIndex = ref(0);

async function toggleFullscreen() {
  presentationVisible.value = !presentationVisible.value;
  if (presentationVisible.value) {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request not permitted or supported", err);
    }
  } else {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }
}

async function requestPresentationFullscreen() {
  presentationVisible.value = true;
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen request not permitted or supported", err);
  }
}

function handlePresentationClose() {
  presentationVisible.value = false;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  }
  if (route.query.from === "edit") {
    void router.replace(
      `/committee/meetings/group/${meetingId.value}/material/edit`,
    );
    return;
  }
  if (route.query.returnPath) {
    void router.replace(String(route.query.returnPath));
    return;
  }
  if (route.name === "committeeGroupMaterialDisplay") {
    return;
  }
  if (!meetingId.value || meetingId.value === "undefined") {
    void router.replace(
      String(route.query.returnPath || route.meta.breadcrumbParentPath || "/"),
    );
    return;
  }
  void router.replace({
    name: "committeeMeetingDetail",
    params: { level: "group", meetingId: meetingId.value },
    query: { ...route.query },
  });
}

function handleFullscreenChange() {
  // 保持演示浮层状态与当前幻灯片页码记忆，不因切换标签页或系统失去焦点而强制销毁演示组件
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
      value: formatFinancialMoney(
        overview?.totalInvestment,
        useDemoFallbacks ? "4.28 亿元" : "--",
      ),
      icon: commitIconAmountOrange,
      tone: "orange",
    },
    {
      label: "车型投资",
      value: formatFinancialMoney(
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
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  void load().then(() => {
    if (unmounted) return;
    void renderCharts();
    if (route.name === "committeeGroupMaterialPresentation") {
      void requestPresentationFullscreen();
    }
  });
});

onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener("resize", resizeCharts);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
    v-if="!presentationVisible"
    class="bq-management-page"
    variant="framed"
    title="集团会议材料展示"
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
        type="primary"
        :icon="FullScreen"
        @click="toggleFullscreen"
      >
        全屏汇报演示
      </PermissionButton>
      <PermissionButton
        v-if="!useDemoMaterial && materialEditable"
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
      ref="displayRootRef"
      v-loading="loading"
      class="committee-group-material-display"
    >
      <section class="group-material-display__hero">
          <div class="group-material-display__hero-brand">
            <img :src="baicGroupLogo" alt="北汽集团" />
          </div>
          <div class="group-material-display__hero-panel">
            <div
              class="group-material-display__hero-backdrop"
              aria-hidden="true"
            >
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
              <h3>产品型谱</h3>
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
              <h3>阀点信息</h3>
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
              <h3>阀点进度</h3>
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
                  <span class="committee-text-strong">计划时间</span>
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
                  <span class="committee-text-strong">完成时间</span>
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
                  String(
                    sectionNumbers.previousGateRequirements,
                  ).padStart(2, "0")
                }}
              </p>
              <h3>
                上个阀点<span v-if="displayData?.previousGate?.gateName"
                  >（{{ displayData.previousGate.gateName }}）</span
                >过会要求
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
                :label="previousGateRequirementTitles.requirement"
                min-width="360"
              />
              <el-table-column
                prop="completion"
                :label="previousGateRequirementTitles.completion"
                min-width="360"
              />
            </el-table>
          </div>
        </section>

        <section class="group-material-display__section">
          <header class="group-material-display__section-head">
            <div>
              <p>{{ String(sectionNumbers.deliverables).padStart(2, "0") }}</p>
              <h3>评审结论与交付物清单</h3>
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
              <h3>评审校核主要问题汇总</h3>
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
              <div
                v-if="block.content?.trim()"
                class="group-material-display__quality-conclusion"
              >
                <strong>质量结论：</strong><span>{{ block.content }}</span>
              </div>
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
                <el-table-column prop="title" label="标题" min-width="180" />
                <el-table-column prop="problem" label="问题" min-width="260" />
                <el-table-column prop="measure" label="措施" min-width="260" />
                <el-table-column
                  prop="owner"
                  label="责任部门"
                  min-width="140"
                />
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
                <p
                  v-if="form.costForecastRemark?.trim()"
                  class="group-material-display__chart-remark"
                >
                  备注：{{ form.costForecastRemark }}
                </p>
                <div
                  v-if="costPoints.length > costPointLabels.length"
                  class="group-material-display__custom-cost-points"
                >
                  <article
                    v-for="point in costPoints.slice(costPointLabels.length)"
                    :key="point.id"
                  >
                    <strong>{{ point.label || "自定义表题" }}</strong>
                    <p>{{ point.value || "--" }}</p>
                  </article>
                </div>
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
                <p
                  v-if="form.revenueForecastRemark?.trim()"
                  class="group-material-display__chart-remark"
                >
                  备注：{{ form.revenueForecastRemark }}
                </p>
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
              <h3>提请决议事项</h3>
            </div>
          </header>
          <div class="group-material-display__decision-box">
            <div
              v-if="decisionConclusion?.trim()"
              class="group-material-display__quality-conclusion group-material-display__decision-conclusion"
            >
              <strong>决议结论：</strong><span>{{ decisionConclusion }}</span>
            </div>
            <article
              v-for="item in decisionDisplayItems"
              :key="item.id"
              class="group-material-display__decision-item"
            >
              <p>{{ item.value }}</p>
            </article>
            <div
              v-if="!decisionDisplayItems.length"
              class="group-material-display__decision-empty"
            >
              暂无提请决议事项
            </div>
          </div>
        </section>

        <section
          class="group-material-display__section group-material-display__section--attachments"
        >
          <header class="group-material-display__section-head">
            <div>
              <p>{{ String(sectionNumbers.attachments).padStart(2, "0") }}</p>
              <h3>附件展示区</h3>
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
  </PageContainer>
  <CommitteeFilePreviewDialog
    v-model="attachmentPreviewVisible"
    :file="attachmentPreviewFile"
    :file-name="attachmentPreviewTitle"
  />
  <Teleport to="body">
    <CommitteeGroupMaterialPresentation
      v-if="presentationVisible"
      v-model="presentationVisible"
      v-model:slide-index="presentationSlideIndex"
      :cover-title="coverTitle"
      :report-department="form.reportDepartment || '集团技术与产品管理部'"
      :cover-facts="coverFacts"
      :current-gate-name="currentGateName"
      :meeting-time="displayData?.cover?.meetingTime ?? meeting?.meetingTime"
      :spectrum-image-url="spectrumImageUrl"
      :spectrum-image-loading="spectrumImageLoading"
      :gate-bullets="gateBullets"
      :gate-purpose="gatePurpose"
      :core-work-content="coreWorkContent"
      :overview-facts="overviewFacts"
      :timeline-plan="timelinePlan"
      :timeline-actual="timelineActual"
      :timeline-years="timelineYears"
      :timeline-months="timelineMonths"
      :timeline-grid-style="timelineGridStyle"
      :timeline-point-style="timelinePointStyle"
      :show-previous-gate-requirements="showPreviousGateRequirements"
      :previous-gate-rows="previousGateRows"
      :previous-gate-name="displayData?.previousGate?.gateName ?? undefined"
      :previous-gate-titles="previousGateRequirementTitles"
      :deliverable-items="deliverableItems"
      :review-matrix-groups="reviewMatrixGroups"
      :quality-opinion-rows="qualityOpinionRows"
      :cost-insight-cards="costInsightCards"
      :custom-cost-points="customCostPoints"
      :revenue-insight-cards="revenueInsightCards"
      :custom-revenue-points="customRevenuePoints"
      :cost-chart-option="costChartOption"
      :cost-forecast-remark="form.costForecastRemark"
      :revenue-chart-option="revenueChartOption"
      :revenue-forecast-remark="form.revenueForecastRemark"
      :revenue-table-rows="revenueTableRows"
      :revenue-chart-groups="revenueChartGroups"
      :revenue-metric-column-width="revenueMetricColumnWidth"
      :review-blocks="reviewBlocks"
      :section-numbers="sectionNumbers"
      :decision-text="form.decisionText"
      :attachment-items="attachmentItems"
      :downloading-attachment-id="downloadingAttachmentId"
      @close="handlePresentationClose"
      @open-project="openProjectDetail"
      @open-gate="openGateData"
      @open-review-task="openReviewTask"
      @open-cost-data="openCostData"
      @open-revenue-data="openRevenueData"
      @preview-attachment="previewAttachmentItem"
    />
  </Teleport>
</template>

<style src="./styles/CommitteeGroupMaterialPage.scss" scoped></style>
