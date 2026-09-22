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
  CircleCheck,
  Delete,
  Document,
  EditPen,
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
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { formatDate, formatFinancialNumber } from "@/utils/formatters";
import {
  calculateChartYAxisScale,
  formatCommitteeChartXAxisLabel,
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
import {
  prefetchGroupMaterialData,
  clearGroupMaterialCache,
} from "./committee-material-prefetch";
import CommitteeAttachmentPanel from "./components/CommitteeAttachmentPanel.vue";
import CommitteeFilePreviewDialog from "./components/CommitteeFilePreviewDialog.vue";
import fileIcon from "@/assets/commit/file.png";
import commitIconAmountOrange from "@/assets/commit/group-19602.png";
import commitIconAmountGreen from "@/assets/commit/group-19617.png";
import commitIconCommentBlue from "@/assets/commit/group-19616.png";
import commitIconDownloadGreen from "@/assets/commit/group-19613.png";
import commitIconWalletBlue from "@/assets/commit/group-19612.png";
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
  MaterialTarget,
  PreviousGateRequirement,
  QualityIssue,
  ReviewBlock,
  ReviewBlockKind,
  RevenueForecastBaseNode,
  RevenueForecastGroup,
  RevenueForecastMetricRow,
  RevenueSupplementMetric,
  SignalTone,
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
const aiGenerating = ref(false);
const savedMaterialSnapshot = ref("");
const lastSavedAt = ref("");
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const aiSuggestionsExpanded = ref(false);
const generatedOpinionSummary = ref<CommitteeOpinionSummary>();
const opinionSummarySnapshot = ref<CommitteeOpinionSummarySnapshot>();
const aiSuggestionTransferKey = "committee-ai-suggestions";
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
function weightedRevenueValue(...values: unknown[]) {
  for (const value of values) {
    const normalizedValue = stringifyDisplayValue(value);
    if (normalizedValue !== undefined) return normalizedValue;
  }
  return "0";
}

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
      contributionMargin: weightedRevenueValue(weighted?.bg),
      operatingProfit: weightedRevenueValue(weighted?.yelr, weighted?.yell),
      marketGuidePriceTaxIncluded: weightedRevenueValue(weighted?.zdPrice),
      tpPriceTaxIncluded: weightedRevenueValue(weighted?.tpPrice),
      materialCost: weightedRevenueValue(weighted?.clPrice),
      variableManufacturingExpense: weightedRevenueValue(weighted?.bdzzPrice),
      variableSellingExpense: weightedRevenueValue(weighted?.bdxsPrice),
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
        weighted?.s8Url ?? materialSourceData?.s8Url,
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
  return {
    ...normalizedSourceData,
    contributionMargin: weightedRevenueValue(weighted?.bg),
    operatingProfit: weightedRevenueValue(weighted?.yelr, weighted?.yell),
    marketGuidePriceTaxIncluded: weightedRevenueValue(weighted?.zdPrice),
    tpPriceTaxIncluded: weightedRevenueValue(weighted?.tpPrice),
    materialCost: weightedRevenueValue(weighted?.clPrice),
    variableManufacturingExpense: weightedRevenueValue(weighted?.bdzzPrice),
    variableSellingExpense: weightedRevenueValue(weighted?.bdxsPrice),
    s8Url: stringifyDisplayValue(weighted?.s8Url ?? materialSourceData?.s8Url),
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
    title: "",
    issue: "",
    action: "",
    ownerDepartment: "",
    dueDate: "",
  },
]);
type DecisionItem = { id: string; value: string };
const decisionItems = reactive<DecisionItem[]>([
  { id: "decision-item-1", value: "" },
]);
const decisionConclusion = ref("");
const previousGateRequirementRows = reactive<PreviousGateRequirement[]>([]);
const previousGateRequirementTitles = reactive({
  requirement: "要求事项",
  completion: "完成进度",
});
const showPreviousGateRequirements = ref(true);
const departmentOptions = ref<CommitteeGateAssignment[]>([]);
const departmentOptionsLoading = ref(false);
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
const defaultCostPoints: CostPoint[] = costPointLabels.map((label, index) => ({
  id: `cost-point-${index + 1}`,
  label,
  value: "",
  placeholder: costPointPlaceholders[index],
  fixed: true,
}));
const costPoints = reactive<CostPoint[]>([]);
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
const defaultRevenuePoints: CostPoint[] = revenuePointLabels.map(
  (label, index) => ({
    id: `revenue-point-${index + 1}`,
    label,
    value: "",
    placeholder: revenuePointPlaceholders[index],
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
const editableScope: Array<{ label: string; target: MaterialTarget }> = [
  { label: "封面标题区", target: "cover" },
  { label: "产品委员会要求与完成情况", target: "previousGateRequirements" },
  { label: "评审校核主要问题汇总", target: "deliveryReview" },
  { label: "提请决议事项", target: "decision" },
  { label: "附件展示区", target: "attachment" },
];
const readonlyScope = [
  "产品型谱与阀点信息",
  "阀点进度总览",
  "评审结论与交付物清单",
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
    costForecastRemark: form.costForecastRemark,
    revenuePoints: serializeRevenuePoints(),
    revenueForecastGroups: serializeRevenueForecastGroups(),
    revenueForecastRemark: form.revenueForecastRemark,
    revenueSupplementMetrics: serializeRevenueSupplementMetrics(),
    reviewBlocks: serializeReviewBlocks(),
    qualityIssues: serializeQualityIssues(),
    deliveryReview: form.deliveryReview,
    decisionText: serializeDecisionItems(),
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
const timelinePointOffset = (value: unknown, fallback: number) => {
  const serial = timelineDateSerial(value);
  if (serial === undefined) return fallback;
  const range = timelineRange.value;
  const start = range[0].year * 12 + range[0].month - 1;
  const end = range[range.length - 1].year * 12 + range[range.length - 1].month;
  return Math.max(0, Math.min(100, ((serial - start) / (end - start)) * 100));
};
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
const deliverableItems = computed(() => {
  const rows = displayData.value?.deliverables ?? [];
  if (!rows.length && useDisplayDemoFallbacks.value)
    return fallbackDeliverableItems;
  return rows.map((item) => ({
    label: displayValue(item.materialName),
    icon: fileIcon,
  }));
});
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
    revenueImportedGroups.value.find((item) =>
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
const revenueChartGroups = computed(() =>
  revenueForecastGroups
    .filter((group) => group.label.trim())
    .map((group) => {
      return {
        id: group.id,
        label: group.label,
        margin: group.margin || "0",
        profit: group.profit || "0",
        metrics: Object.fromEntries(
          revenueImportedMetricFields.map((_, index) => {
            const key = `metric-${index}`;
            return [key, group.metrics?.[key] || "0"];
          }),
        ),
      };
    }),
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

function goToProjectDetail() {
  if (!meeting.value?.projectId) return;
  void router.push({
    name: "committeeProjectDetail",
    params: { projectId: String(meeting.value.projectId) },
  });
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
      (display.value ||
        isEmptyMaterialRows(material.costPoints, ["label", "value"]))
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
      (display.value ||
        isEmptyMaterialRows(material.revenuePoints, ["label", "value"]))
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
  hydrateDecisionItems(form.decisionText);
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
  previousGateRequirementTitles.requirement = "要求事项";
  previousGateRequirementTitles.completion = "完成进度";
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
    if (typeof parsed === "object" && parsed !== null && "titles" in parsed) {
      const titles = parsed.titles;
      if (typeof titles === "object" && titles !== null) {
        if (
          "requirement" in titles &&
          typeof titles.requirement === "string"
        ) {
          previousGateRequirementTitles.requirement = titles.requirement;
        }
        if (
          "completion" in titles &&
          typeof titles.completion === "string"
        ) {
          previousGateRequirementTitles.completion = titles.completion;
        }
      }
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
    titles: {
      requirement: previousGateRequirementTitles.requirement,
      completion: previousGateRequirementTitles.completion,
    },
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
      title: "",
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
    qualityIssues.map(
      ({ id, title, issue, action, ownerDepartment, dueDate }) => ({
        id,
        title: title ?? "",
        issue,
        action,
        ownerDepartment,
        dueDate,
      }),
    ),
  );
}

function hydrateCostPoints(value?: string) {
  costPoints.splice(
    0,
    costPoints.length,
    ...defaultCostPoints.map((item) => ({ ...item })),
  );
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      normalizePointDisplayRows(parsed).forEach((item, index) => {
        const fixed = costPoints[index];
        if (fixed) {
          if (typeof item === "object" && item !== null) {
            const savedLabel = (item as Partial<CostPoint>).label;
            if (typeof savedLabel === "string") fixed.label = savedLabel;
          }
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
            id:
              typeof row.id === "string" && row.id.trim()
                ? row.id
                : `cost-point-custom-${index + 1}`,
            label: row.label,
            value: row.value,
            placeholder: "请输入内容",
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
    costPoints.map(({ id, label, value }) => ({ id, label, value })),
  );
}

function hydrateDecisionItems(value?: string) {
  decisionItems.splice(0, decisionItems.length);
  decisionConclusion.value = "";
  if (value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      let rawList: unknown[] = [];
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as {
          conclusion?: unknown;
          decisionConclusion?: unknown;
          items?: unknown;
          list?: unknown;
          rows?: unknown;
        };
        if (typeof obj.conclusion === "string") {
          decisionConclusion.value = obj.conclusion;
        } else if (typeof obj.decisionConclusion === "string") {
          decisionConclusion.value = obj.decisionConclusion;
        }
        if (Array.isArray(obj.items)) {
          rawList = obj.items;
        } else if (Array.isArray(obj.list)) {
          rawList = obj.list;
        } else if (Array.isArray(obj.rows)) {
          rawList = obj.rows;
        }
      }
      const rows = rawList
        .map((item, index): DecisionItem | undefined => {
          if (typeof item === "string") {
            return { id: `decision-item-${index + 1}`, value: item };
          }
          if (typeof item !== "object" || item === null) return undefined;
          const row = item as Partial<DecisionItem>;
          return {
            id:
              typeof row.id === "string" && row.id.trim()
                ? row.id
                : `decision-item-${index + 1}`,
            value: typeof row.value === "string" ? row.value : "",
          };
        })
        .filter((item): item is DecisionItem => Boolean(item));
      if (rows.length) {
        decisionItems.push(...rows);
        return;
      }
    } catch {
      decisionItems.push({ id: "decision-item-1", value });
      return;
    }
  }
  decisionItems.push({ id: "decision-item-1", value: "" });
}

function serializeDecisionItems() {
  return JSON.stringify({
    conclusion: decisionConclusion.value,
    items: decisionItems.map(({ id, value }) => ({ id, value })),
  });
}

function addDecisionItem() {
  decisionItems.push({ id: `decision-item-${Date.now()}`, value: "" });
}

function removeDecisionItem(id: string) {
  if (decisionItems.length <= 1) return;
  const index = decisionItems.findIndex((item) => item.id === id);
  if (index >= 0) decisionItems.splice(index, 1);
}

function addCostPoint() {
  costPoints.push({
    id: `cost-point-custom-${Date.now()}`,
    label: "",
    value: "",
    placeholder: "请输入要点详细说明...",
  });
}

function removeCostPoint(id: string) {
  const index = costPoints.findIndex((item) => item.id === id && !item.fixed);
  if (index >= 0) costPoints.splice(index, 1);
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
          if (typeof item === "object" && item !== null) {
            const row = item as Partial<CostPoint>;
            if (typeof row.label === "string") fixed.label = row.label;
            fixed.value = typeof row.value === "string" ? row.value : "";
          } else {
            fixed.value = typeof item === "string" ? item : "";
          }
          return;
        }
        if (typeof item !== "object" || item === null) return;
        const row = item as Partial<CostPoint>;
        if (typeof row.label === "string" && typeof row.value === "string") {
          revenuePoints.push({
            id:
              typeof row.id === "string" && row.id.trim()
                ? row.id
                : `revenue-point-custom-${index + 1}`,
            label: row.label,
            value: row.value,
            placeholder: "请输入内容",
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
    revenuePoints.map(({ id, label, value }) => ({ id, label, value })),
  );
}

function addRevenuePoint() {
  revenuePoints.push({
    id: `revenue-point-custom-${Date.now()}`,
    label: "",
    value: "",
    placeholder: "请输入要点详细说明...",
  });
}

function removeRevenuePoint(id: string) {
  const index = revenuePoints.findIndex(
    (item) => item.id === id && !item.fixed,
  );
  if (index >= 0) revenuePoints.splice(index, 1);
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
    // 静默预加载全屏演示所需展示数据（后台异步无感）
    if (!display.value && meetingId.value) {
      void prefetchGroupMaterialData(meetingId.value);
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
    // 收益指标仅以该接口为准，请求失败时由页面统一展示 0。
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
        costForecastRemark: form.costForecastRemark,
        revenuePoints: serializeRevenuePoints(),
        revenueForecastGroups: serializeRevenueForecastGroups(),
        revenueForecastRemark: form.revenueForecastRemark,
        revenueSupplementMetrics: serializeRevenueSupplementMetrics(),
        reviewBlocks: serializeReviewBlocks(),
        qualityIssues: serializeQualityIssues(),
        decisionText: serializeDecisionItems(),
      },
    });
    // 保存成功后：清理旧缓存并立即异步预取最新材料数据，保证后续点击“查看上会展示”时直接命中最新数据
    clearGroupMaterialCache(meetingId.value);
    void prefetchGroupMaterialData(meetingId.value);
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

// 保留兼容历史材料和展示数据的辅助实现，编辑模板当前不直接渲染这些字段。
void buildDisplayTimelinePoints;
void deliverableItems;
void fallbackReviewMatrixGroups;
void revenueMetricSubjectId;
void fallbackQualityOpinionRows;
void costInsightIcons;
void autoCostSummaryInsight;
void revenueInsightIcons;
void formatProgressValue;
void displayDepartmentGroup;
void normalizeSignalTone;
void attachmentFileType;

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
  router.push({
    path: `/committee/meetings/group/${meetingId.value}/material/presentation`,
    query: { from: "edit" },
  });
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
    title: "",
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
    class="bq-management-page is-group-material-edit"
    variant="plain"
    title="编辑集团会议材料"
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
        v-if="materialEditable"
        :icon="View"
        plain
        @click="goToDisplay"
      >
        查看上会展示
      </PermissionButton>
      <PermissionButton
        v-if="materialEditable"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </PermissionButton>
    </template>

    <div v-loading="loading" class="group-material-edit-form">
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
              <!-- 双列全局表头配置：提炼至卡片框外，统一配置两列标题 -->
              <div class="group-material-edit-form__previous-columns-header">
                <div class="group-material-edit-form__previous-col-meta is-left">
                  <div class="group-material-edit-form__col-meta-tag">
                    <el-icon class="group-material-edit-form__col-icon"><Document /></el-icon>
                    <span>左列标题</span>
                  </div>
                  <el-input
                    v-model="previousGateRequirementTitles.requirement"
                    maxlength="40"
                    clearable
                    class="group-material-edit-form__previous-header-input"
                    placeholder="请输入左列标题（默认：要求事项）"
                  />
                </div>
                <div class="group-material-edit-form__previous-col-meta is-right">
                  <div class="group-material-edit-form__col-meta-tag">
                    <el-icon class="group-material-edit-form__col-icon"><CircleCheck /></el-icon>
                    <span>右列标题</span>
                  </div>
                  <el-input
                    v-model="previousGateRequirementTitles.completion"
                    maxlength="40"
                    clearable
                    class="group-material-edit-form__previous-header-input"
                    placeholder="请输入右列标题（默认：完成进度）"
                  />
                </div>
              </div>

              <!-- 事项列表（卡片框内仅录入具体内容，不再重复多余标题框） -->
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
                    <el-form-item class="group-material-edit-form__top-field">
                      <el-input
                        v-model="item.requirement"
                        type="textarea"
                        :autosize="{ minRows: 3 }"
                        :placeholder="`请输入${previousGateRequirementTitles.requirement || '要求事项'}（如上个阀点明确的要求事项）`"
                      />
                    </el-form-item>
                    <el-form-item class="group-material-edit-form__top-field">
                      <el-input
                        v-model="item.completion"
                        type="textarea"
                        :autosize="{ minRows: 3 }"
                        :placeholder="`请输入${previousGateRequirementTitles.completion || '完成进度'}（如当前完成情况、结果及未完成原因）`"
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
                        <el-input
                          v-model="issue.title"
                          class="group-material-edit-form__quality-title-input"
                          size="small"
                          maxlength="40"
                          show-word-limit
                          placeholder="请输入质量标题"
                        />
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
                  <div class="group-material-edit-form__standard-section-head">
                    <div class="group-material-edit-form__forecast-toolbar is-actions-only">
                      <PermissionButton
                        plain
                        size="small"
                        class="group-material-edit-form__add-button"
                        data-testid="group-material-cost-add-point"
                        @click="addCostPoint"
                      >
                        <el-icon><Plus /></el-icon>
                        新增输入框
                      </PermissionButton>
                    </div>
                  </div>
                  <div
                    class="group-material-edit-form__standard-grid"
                    :class="{
                      'has-custom-point':
                        costPoints.length > costPointLabels.length,
                    }"
                  >
                    <div
                      v-for="(point, index) in costPoints"
                      :key="point.id"
                      class="group-material-edit-form__point-card"
                      :class="{ 'is-custom-point': !point.fixed }"
                    >
                      <el-form-item
                        :class="{ 'is-custom-cost-point': !point.fixed }"
                        class="group-material-edit-form__top-field group-material-edit-form__cost-standard-field"
                        label-position="top"
                      >
                        <template #label>
                          <div
                            class="group-material-edit-form__custom-point-label"
                          >
                            <div class="group-material-edit-form__point-label-content">
                              <span
                                v-if="!point.fixed"
                                class="group-material-edit-form__point-badge"
                              >
                                自定义
                              </span>
                              <span
                                v-else
                                class="group-material-edit-form__point-dot"
                              ></span>
                              <el-input
                                v-model="point.label"
                                maxlength="40"
                                placeholder="请输入要点标题"
                                class="group-material-edit-form__point-inline-title"
                                :data-testid="`group-material-cost-point-${index}-label`"
                              />
                            </div>
                            <PermissionButton
                              v-if="!point.fixed"
                              link
                              type="danger"
                              class="group-material-edit-form__point-remove-btn"
                              :data-testid="`group-material-cost-point-${index}-remove`"
                              @click="removeCostPoint(point.id)"
                            >
                              <el-icon><Delete /></el-icon>
                              <span>删除</span>
                            </PermissionButton>
                          </div>
                        </template>
                        <el-input
                          v-model="point.value"
                          type="textarea"
                          :autosize="{ minRows: 3 }"
                          :placeholder="point.placeholder || '请输入详细说明内容...'"
                          :data-testid="`group-material-cost-point-${index}`"
                        />
                      </el-form-item>
                    </div>
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
                  <div class="group-material-edit-form__table-footer-remark">
                    <span class="group-material-edit-form__table-footer-remark-label">图表备注</span>
                    <el-input
                      v-model="form.costForecastRemark"
                      type="textarea"
                      :autosize="{ minRows: 1, maxRows: 3 }"
                      placeholder="请输入图表补充说明（选填，未填写前台不展示）"
                      class="group-material-edit-form__table-footer-remark-input"
                      data-testid="group-material-cost-forecast-remark"
                    />
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
                  <div class="group-material-edit-form__standard-section-head">
                    <div class="group-material-edit-form__forecast-toolbar is-actions-only">
                      <PermissionButton
                        plain
                        size="small"
                        class="group-material-edit-form__add-button"
                        data-testid="group-material-revenue-add-point"
                        @click="addRevenuePoint"
                      >
                        <el-icon><Plus /></el-icon>
                        新增输入框
                      </PermissionButton>
                    </div>
                  </div>
                  <div
                    class="group-material-edit-form__standard-grid"
                    :class="{
                      'has-custom-point':
                        revenuePoints.length > revenuePointLabels.length,
                    }"
                  >
                    <div
                      v-for="(point, index) in revenuePoints"
                      :key="point.id"
                      class="group-material-edit-form__point-card"
                      :class="{ 'is-custom-point': !point.fixed }"
                    >
                      <el-form-item
                        :class="{ 'is-custom-revenue-point': !point.fixed }"
                        class="group-material-edit-form__top-field group-material-edit-form__revenue-standard-field"
                        label-position="top"
                      >
                        <template #label>
                          <div
                            class="group-material-edit-form__custom-point-label"
                          >
                            <div class="group-material-edit-form__point-label-content">
                              <span
                                v-if="!point.fixed"
                                class="group-material-edit-form__point-badge"
                              >
                                自定义
                              </span>
                              <span
                                v-else
                                class="group-material-edit-form__point-dot"
                              ></span>
                              <el-input
                                v-model="point.label"
                                maxlength="40"
                                placeholder="请输入要点标题"
                                class="group-material-edit-form__point-inline-title"
                                :data-testid="`group-material-revenue-point-${index}-label`"
                              />
                            </div>
                            <PermissionButton
                              v-if="!point.fixed"
                              link
                              type="danger"
                              class="group-material-edit-form__point-remove-btn"
                              :data-testid="`group-material-revenue-point-${index}-remove`"
                              @click="removeRevenuePoint(point.id)"
                            >
                              <el-icon><Delete /></el-icon>
                              <span>删除</span>
                            </PermissionButton>
                          </div>
                        </template>
                        <el-input
                          v-model="point.value"
                          type="textarea"
                          :autosize="{ minRows: 3 }"
                          :placeholder="point.placeholder || '请输入详细说明内容...'"
                          :data-testid="`group-material-revenue-point-${index}`"
                        />
                      </el-form-item>
                    </div>
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
                      class="group-material-edit-form__add-button group-material-edit-form__add-metric-button"
                      data-testid="group-material-revenue-forecast-add-metric-row"
                      @click="addRevenueForecastMetricRow"
                    >
                      <el-icon><Plus /></el-icon>
                      新增指标行
                    </PermissionButton>
                    <PermissionButton
                      plain
                      size="small"
                      class="group-material-edit-form__add-button group-material-edit-form__add-group-button"
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
                      width="190"
                      class-name="is-metric-column"
                      label-class-name="is-metric-column"
                    >
                      <template #header>
                        <div class="group-material-edit-form__revenue-metric-header">
                          <span class="group-material-edit-form__revenue-metric-header-dot"></span>
                          <span class="group-material-edit-form__revenue-metric-header-text">收益指标</span>
                        </div>
                      </template>
                      <template #default="{ row }">
                        <div class="group-material-edit-form__revenue-metric" :class="{ 'is-custom-metric': row.custom }">
                          <template v-if="row.custom">
                            <div class="group-material-edit-form__custom-metric-row">
                              <span class="group-material-edit-form__custom-metric-tag">自定义</span>
                              <el-input
                                v-model="row.label"
                                size="small"
                                placeholder="请输入指标名称"
                                class="group-material-edit-form__custom-metric-input"
                                :data-testid="`group-material-revenue-forecast-metric-row-${row.key}-label`"
                              />
                              <PermissionButton
                                link
                                type="danger"
                                size="small"
                                class="group-material-edit-form__custom-metric-remove-btn"
                                :data-testid="`group-material-revenue-forecast-remove-metric-row-${row.key}`"
                                @click="removeRevenueForecastMetricRow(row.key)"
                              >
                                <el-icon><Delete /></el-icon>
                              </PermissionButton>
                            </div>
                          </template>
                          <template v-else>
                            <span v-if="row.category" class="group-material-edit-form__metric-category-tag">
                              {{ row.category }}
                            </span>
                            <span class="group-material-edit-form__metric-label">{{ row.label }}</span>
                          </template>
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
                              class="group-material-edit-form__revenue-group-remove-btn"
                              :data-testid="`group-material-revenue-forecast-remove-row-${index}`"
                              @click="removeRevenueForecastGroup(group.id)"
                            >
                              <el-icon><Delete /></el-icon>
                              <span>删除</span>
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
                            class="group-material-edit-form__revenue-node-input"
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
                            <template #suffix>
                              <span class="group-material-edit-form__cell-unit">元</span>
                            </template>
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
                  <div class="group-material-edit-form__table-footer-remark">
                    <span class="group-material-edit-form__table-footer-remark-label">图表备注</span>
                    <el-input
                      v-model="form.revenueForecastRemark"
                      type="textarea"
                      :autosize="{ minRows: 1, maxRows: 3 }"
                      placeholder="请输入图表补充说明（选填，未填写前台不展示）"
                      class="group-material-edit-form__table-footer-remark-input"
                      data-testid="group-material-revenue-forecast-remark"
                    />
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
                <div class="group-material-edit-form__custom-card">
                  <div class="group-material-edit-form__custom-card-body">
                    <el-form-item
                      class="group-material-edit-form__top-field group-material-edit-form__custom-title-field"
                      label-position="top"
                      label="板块名称"
                    >
                      <el-input
                        v-model="block.title"
                        placeholder="请输入自定义板块名称（如：供应链保障、专项技术攻坚等）"
                        clearable
                        maxlength="40"
                        show-word-limit
                        data-testid="group-material-custom-block-title"
                      />
                    </el-form-item>
                    <el-form-item
                      class="group-material-edit-form__top-field is-long-text group-material-edit-form__custom-content-field"
                      label-position="top"
                      label="板块汇报核心内容"
                    >
                      <el-input
                        v-model="block.content"
                        type="textarea"
                        :autosize="{ minRows: 6, maxRows: 16 }"
                        placeholder="请输入该板块需要在会上展示的核心内容、关键进展、专项测算或决策诉求..."
                        show-word-limit
                        maxlength="2000"
                        data-testid="group-material-custom-block-content"
                      />
                    </el-form-item>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section
          class="group-material-edit-form__section group-material-edit-form__decision-section"
          data-material-target="decision"
        >
          <BaseSectionTitle
            class="group-material-edit-form__section-head"
            title="提请决议事项"
            heading-tag="h2"
          >
            <template #title-extra>
              <el-tooltip
                content="维护本次集团会议需审议决议的核心事项。"
                placement="top"
              >
                <el-icon class="group-material-edit-form__help-icon"
                  ><QuestionFilled
                /></el-icon>
              </el-tooltip>
            </template>
            <template #actions>
              <PermissionButton
                plain
                size="small"
                class="group-material-edit-form__add-button"
                data-testid="group-material-decision-add-row"
                @click="addDecisionItem"
              >
                <el-icon><Plus /></el-icon>
                新增输入框
              </PermissionButton>
            </template>
          </BaseSectionTitle>
          <div class="group-material-edit-form__decision-editor-body">
            <div class="group-material-edit-form__table-footer-remark group-material-edit-form__block-conclusion">
              <span class="group-material-edit-form__table-footer-remark-label">决议结论</span>
              <el-input
                v-model="decisionConclusion"
                type="textarea"
                :autosize="{ minRows: 1, maxRows: 3 }"
                placeholder="请输入决议结论（选填，未填写前台不展示）"
                class="group-material-edit-form__table-footer-remark-input"
                data-testid="group-material-decision-conclusion"
              />
            </div>
            <section
              v-for="(item, index) in decisionItems"
              :key="item.id"
              class="group-material-edit-form__decision-item"
            >
              <div
                v-if="decisionItems.length > 1"
                class="group-material-edit-form__decision-item-actions"
              >
                <PermissionButton
                  link
                  type="danger"
                  @click="removeDecisionItem(item.id)"
                >
                  <el-icon><Delete /></el-icon>
                  删除
                </PermissionButton>
              </div>
              <el-input
                v-model="item.value"
                type="textarea"
                resize="none"
                :autosize="{ minRows: 4, maxRows: 10 }"
                placeholder="请输入提请决议事项"
                :data-testid="`group-material-decision-input-${index}`"
              />
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

<style src="./styles/CommitteeGroupMaterialPage.scss" scoped></style>
