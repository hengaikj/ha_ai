<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import * as echarts from "echarts";
import type { ECharts } from "echarts";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Close,
  FullScreen,
  Menu,
  ScaleToOriginal,
} from "@element-plus/icons-vue";
import baicGroupLogo from "@/assets/committee/baic-group-logo.png";
import groupMeetingBackdrop from "@/assets/committee/group-meeting-backdrop.png";
import fileIcon from "@/assets/commit/file.png";
import commitIconMilestone from "@/assets/commit/milestone-active.png";
import commitIconMilestoneNormal from "@/assets/commit/milestone-normal.png";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { downloadCommitteeAttachment } from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import { formatFinancialNumber } from "@/utils/formatters";
import type {
  AttachmentDisplayItem,
  ReviewBlock,
  ReviewMatrixDisplayGroup,
  TimelinePoint,
} from "../committee-material-types";
import {
  calculateChartYAxisScale,
  formatCommitteeChartXAxisLabel,
  formatTimelinePointDate,
  parseCommitteeDecisionConclusion,
  parseCommitteeDecisionItems,
} from "../committee-ui";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    coverTitle: string;
    reportDepartment?: string;
    coverFacts: Array<{ label: string; value: string }>;
    currentGateName: string;
    meetingTime?: string;
    spectrumImageUrl?: string;
    spectrumImageLoading?: boolean;
    gateBullets?: string[];
    gatePurpose?: string;
    coreWorkContent?: string;
    overviewFacts: Array<{
      label: string;
      value: string;
      icon?: string;
      tone?: string;
      full?: boolean;
    }>;
    timelinePlan: TimelinePoint[];
    timelineActual: TimelinePoint[];
    timelineYears: Array<{ year: number; count: number }>;
    timelineMonths: string[];
    timelineGridStyle: Record<string, string>;
    timelinePointStyle: (point: TimelinePoint) => Record<string, string>;
    showPreviousGateRequirements?: boolean;
    previousGateRows: Array<{
      id: string;
      index: number;
      requirement: string;
      completion: string;
    }>;
    previousGateName?: string;
    previousGateTitles?: {
      requirement: string;
      completion: string;
    };
    deliverableItems: Array<{ label: string; icon: string }>;
    reviewMatrixGroups: ReviewMatrixDisplayGroup[];
    qualityOpinionRows: Array<{
      index: number;
      title?: string;
      problem: string;
      measure: string;
      owner: string;
      date: string;
    }>;
    costInsightCards: Array<{
      title: string;
      content: string;
      icon: string;
      tone: string;
    }>;
    customCostPoints?: Array<{
      id: string;
      label: string;
      value: string;
      icon: string;
      tone: string;
    }>;
    revenueInsightCards: Array<{
      title: string;
      content: string;
      icon: string;
      tone: string;
    }>;
    customRevenuePoints?: Array<{
      id: string;
      label: string;
      value: string;
      icon: string;
      tone: string;
    }>;
    costChartOption: any;
    costForecastRemark?: string;
    revenueChartOption: any;
    revenueForecastRemark?: string;
    revenueTableRows: any[];
    revenueChartGroups: any[];
    revenueMetricColumnWidth?: number;
    reviewBlocks: ReviewBlock[];
    sectionNumbers?: Record<string, number>;
    decisionText: string;
    attachmentItems: AttachmentDisplayItem[];
    downloadingAttachmentId?: string | number | null;
    slideIndex?: number;
  }>(),
  {
    modelValue: true,
    gateBullets: () => [],
    gatePurpose: "",
    coreWorkContent: "",
    reportDepartment: "集团技术与产品管理部",
    spectrumImageUrl: "",
    spectrumImageLoading: false,
    showPreviousGateRequirements: false,
    previousGateName: "",
    previousGateTitles: () => ({
      requirement: "产品委员会要求与完成情况事项",
      completion: "本阶段落实进展与整改成果",
    }),
    revenueMetricColumnWidth: 200,
    downloadingAttachmentId: null,
    slideIndex: 0,
    customCostPoints: () => [],
    customRevenuePoints: () => [],
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "update:slideIndex", value: number): void;
  (e: "close"): void;
  (e: "openProject"): void;
  (e: "openGate", gateId?: string | number | null): void;
  (e: "openReviewTask", taskId?: string | number | null): void;
  (e: "openCostData"): void;
  (e: "openRevenueData", recordId?: string | number | null): void;
  (e: "previewAttachment", item: AttachmentDisplayItem): void;
}>();

const stageWidth = 1920;
const stageHeight = 1080;
const stageScale = ref(1);
const currentSlideIndex = ref(props.slideIndex ?? 0);
const pptDrawerVisible = ref(false);
const presentationRootRef = ref<HTMLElement | null>(null);
const active = ref(true);
const isAllDeliverablesDialogVisible = ref(false);

export interface SpotlightPayload {
  type?: "single" | "pair" | "qualityPair";
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  tone?: string;
  department?: string;
  targetDate?: string;
  content?: string;
  problem?: string;
  measure?: string;
  leftTitle?: string;
  leftContent?: string;
  leftStripeTone?: string;
  rightTitle?: string;
  rightContent?: string;
  rightStripeTone?: string;
}

const spotlightState = reactive<{
  visible: boolean;
  data: SpotlightPayload;
}>({
  visible: false,
  data: {
    title: "",
    content: "",
  },
});

function openSpotlight(payload: SpotlightPayload) {
  spotlightState.data = payload;
  spotlightState.visible = true;
}

function closeSpotlight() {
  spotlightState.visible = false;
}

const spotlightContentStyle = computed(() => {
  const len = spotlightState.data.content?.trim().length || 0;
  if (len <= 45) {
    return { fontSize: "30px", lineHeight: "1.8" };
  } else if (len <= 120) {
    return { fontSize: "27px", lineHeight: "1.8" };
  }
  return { fontSize: "24px", lineHeight: "1.85" };
});

const spotlightProblemStyle = computed(() => {
  const text =
    spotlightState.data.leftContent || spotlightState.data.problem || "";
  const len = text.trim().length;
  if (len <= 45) {
    return { fontSize: "28px", lineHeight: "1.75" };
  } else if (len <= 120) {
    return { fontSize: "25px", lineHeight: "1.8" };
  }
  return { fontSize: "22px", lineHeight: "1.85" };
});

const spotlightMeasureStyle = computed(() => {
  const text =
    spotlightState.data.rightContent || spotlightState.data.measure || "";
  const len = text.trim().length;
  if (len <= 45) {
    return { fontSize: "28px", lineHeight: "1.75" };
  } else if (len <= 120) {
    return { fontSize: "25px", lineHeight: "1.8" };
  }
  return { fontSize: "22px", lineHeight: "1.85" };
});

const displayedDeliverableItems = computed(() => {
  const items = props.deliverableItems || [];
  if (items.length === 0) return [];

  // 计算行可用宽度：舞台宽 1920 - 外边距 (44*2) - 面板内边距 (18*2) - 边框 ≈ 1770px
  const ROW_WIDTH = 1770;
  const MORE_CHIP_WIDTH = 10; // 尾部“更多提示”胶囊预留宽度（含间距）
  const CHIP_GAP = 12;
  const MAX_ROWS = 2; // 最多展示 2 排，多余进入“更多”

  function getChipWidth(label: string): number {
    let textW = 0;
    const str = String(label || "");
    for (let i = 0; i < str.length; i++) {
      textW += str.charCodeAt(i) > 255 ? 17 : 10;
    }
    // 图标28px + 间距10px + 内边距30px + 边框2px = 70px
    const rawWidth = textW + 70;
    // 单项最大宽度 320px
    return Math.min(rawWidth, 320) + CHIP_GAP;
  }

  let currentRow = 1;
  let currentRowWidth = 0;
  const result: typeof items = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const w = getChipWidth(item.label || "");

    if (currentRow < MAX_ROWS) {
      if (currentRowWidth + w <= ROW_WIDTH) {
        currentRowWidth += w;
        result.push(item);
      } else {
        // 当前排已满，换行进入下一排
        currentRow++;
        const limitWidth =
          currentRow === MAX_ROWS ? ROW_WIDTH - MORE_CHIP_WIDTH : ROW_WIDTH;
        if (w <= limitWidth) {
          currentRowWidth = w;
          result.push(item);
        } else {
          break;
        }
      }
    } else {
      // 最后一排（第 3 排）：继续排布，保留尾部更多提示胶囊空间
      if (currentRowWidth + w <= ROW_WIDTH - MORE_CHIP_WIDTH) {
        currentRowWidth += w;
        result.push(item);
      } else {
        break;
      }
    }
  }

  return result;
});

const backgroundFactItem = computed(() => {
  return (
    (props.overviewFacts || []).find((item) => item.label === "项目背景") || null
  );
});

const isBackgroundExpanded = computed(() => {
  const val = backgroundFactItem.value?.value?.trim() || "";
  if (!val || val === "--") return false;
  if (val.includes("\n")) return true;
  return val.length > 38;
});

const upperSectionStyle = computed(() => {
  return { flex: "1.08 1 0%", minHeight: "0" };
});

let costChart: ECharts | null = null;
let revenueChart: ECharts | null = null;

interface SlideItem {
  id: string;
  type:
    | "cover"
    | "spectrum"
    | "gateInfoAndTimeline"
    | "previousGate"
    | "deliverablesAndMatrix"
    | "reviewQuality"
    | "reviewCost"
    | "reviewRevenue"
    | "reviewCustom"
    | "decision"
    | "attachments";
  sectionNumber?: string;
  sectionTitle: string;
  slideTitle?: string;
  block?: ReviewBlock;
}

const slideList = computed<SlideItem[]>(() => {
  const slides: SlideItem[] = [];
  let secIdx = 1;

  // 1. 封面页
  slides.push({
    id: "slide-cover",
    type: "cover",
    sectionTitle: "封面",
    slideTitle: props.coverTitle,
  });

  // 2. 01 产品型谱
  slides.push({
    id: "slide-spectrum",
    type: "spectrum",
    sectionNumber: String(secIdx++).padStart(2, "0"),
    sectionTitle: "产品型谱",
  });

  // 3. 02 阀点信息与进度总览（合并为一个完整大页面）
  slides.push({
    id: "slide-gateInfoAndTimeline",
    type: "gateInfoAndTimeline",
    sectionNumber: String(secIdx++).padStart(2, "0"),
    sectionTitle: "阀点信息与进度总览",
  });

  // 4. 03 产品委员会要求与完成情况（若存在）
  if (props.showPreviousGateRequirements) {
    slides.push({
      id: "slide-previousGate",
      type: "previousGate",
      sectionNumber: String(secIdx++).padStart(2, "0"),
      sectionTitle: "产品委员会要求与完成情况",
      slideTitle: props.previousGateName
        ? `上个阀点（${props.previousGateName}）过会要求`
        : "产品委员会要求与完成情况",
    });
  }

  // 5. 04 评审结论与交付物清单
  slides.push({
    id: "slide-deliverablesAndMatrix",
    type: "deliverablesAndMatrix",
    sectionNumber: String(secIdx++).padStart(2, "0"),
    sectionTitle: "评审结论与交付物清单",
  });

  // 6. 05 评审校核主要问题汇总 各独立板块（质量、成本、收益、自定义）
  const reviewSecNum = String(secIdx++).padStart(2, "0");
  (props.reviewBlocks ?? []).forEach((block) => {
    if (block.kind === "quality") {
      slides.push({
        id: "slide-review-quality",
        type: "reviewQuality",
        sectionNumber: reviewSecNum,
        sectionTitle: "评审校核主要问题汇总",
        slideTitle: "质量板块",
        block,
      });
    } else if (block.kind === "cost") {
      slides.push({
        id: "slide-review-cost",
        type: "reviewCost",
        sectionNumber: reviewSecNum,
        sectionTitle: "评审校核主要问题汇总",
        slideTitle: "成本板块",
        block,
      });
    } else if (block.kind === "revenue") {
      slides.push({
        id: "slide-review-revenue",
        type: "reviewRevenue",
        sectionNumber: reviewSecNum,
        sectionTitle: "评审校核主要问题汇总",
        slideTitle: "收益板块",
        block,
      });
    } else {
      slides.push({
        id: `slide-review-custom-${block.id}`,
        type: "reviewCustom",
        sectionNumber: reviewSecNum,
        sectionTitle: "评审校核主要问题汇总",
        slideTitle: block.title || "自定义板块",
        block,
      });
    }
  });

  // 7. 提请决议事项
  slides.push({
    id: "slide-decision",
    type: "decision",
    sectionNumber: String(secIdx++).padStart(2, "0"),
    sectionTitle: "提请决议事项",
  });

  // 8. 附件展示区
  slides.push({
    id: "slide-attachments",
    type: "attachments",
    sectionNumber: String(secIdx++).padStart(2, "0"),
    sectionTitle: "附件展示区",
  });

  return slides;
});

const currentQualityConclusion = computed(() => {
  const current = slideList.value[currentSlideIndex.value];
  if (current?.type === "reviewQuality") {
    return (
      current.block?.content?.trim() ||
      props.reviewBlocks?.find((b) => b.kind === "quality")?.content?.trim() ||
      ""
    );
  }
  return "";
});

function updateStageScale() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const scaleX = winW / stageWidth;
  const scaleY = winH / stageHeight;
  stageScale.value = Math.min(scaleX, scaleY);
}

const decisionDisplayItems = computed(() =>
  parseCommitteeDecisionItems(props.decisionText),
);
const currentDecisionConclusion = computed(() =>
  parseCommitteeDecisionConclusion(props.decisionText),
);

const resolvedDecisionConclusion = computed(() => {
  if (currentDecisionConclusion.value?.trim()) {
    return currentDecisionConclusion.value.trim();
  }
  if (decisionDisplayItems.value.length) {
    return "当前会议提请决议结论主要执行建议如下；";
  }
  return "";
});

const formattedDecisionConclusionHeadline = computed(() => {
  return resolvedDecisionConclusion.value || "";
});

function getAttachmentMeta(fileName: string) {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  if (["ppt", "pptx"].includes(ext)) {
    return {
      tag: "PPT 汇报文稿",
      extLabel: ext.toUpperCase(),
      themeClass: "is-ppt",
    };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return {
      tag: "Excel 测算表",
      extLabel: ext.toUpperCase(),
      themeClass: "is-excel",
    };
  }
  if (["doc", "docx"].includes(ext)) {
    return {
      tag: "Word 报告文档",
      extLabel: ext.toUpperCase(),
      themeClass: "is-word",
    };
  }
  if (["pdf"].includes(ext)) {
    return {
      tag: "PDF 支撑文档",
      extLabel: "PDF",
      themeClass: "is-pdf",
    };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      tag: "压缩数据包",
      extLabel: ext.toUpperCase(),
      themeClass: "is-archive",
    };
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
    return {
      tag: "图片附件",
      extLabel: ext.toUpperCase(),
      themeClass: "is-image",
    };
  }
  return {
    tag: "支撑附件",
    extLabel: ext ? ext.toUpperCase() : "FILE",
    themeClass: "is-file",
  };
}

const localPreviewVisible = ref(false);
const localPreviewFile = ref<Blob | null>(null);
const localPreviewTitle = ref("");
const localDownloadingId = ref<string | number | null>(null);

async function handlePreviewAttachment(item: AttachmentDisplayItem) {
  localDownloadingId.value = item.attachmentId;
  localPreviewFile.value = null;
  localPreviewTitle.value = item.fileName;
  localPreviewVisible.value = true;
  try {
    const response = await downloadCommitteeAttachment(item.attachmentId);
    localPreviewFile.value = response.data;
  } catch {
    localPreviewVisible.value = false;
    BaseToast.error("附件预览失败");
  } finally {
    localDownloadingId.value = null;
  }
}

function formatIntentMultilineText(text?: string): string {
  if (!text) return "--";
  return String(text).replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function normalizeRevenueNodeLabel(label?: string) {
  return String(label ?? "").replace(/\s+/g, "");
}

function isCurrentActualRevenueNode(label?: string) {
  return normalizeRevenueNodeLabel(label) === "当前实际";
}

function formatRevenueMetricCellValue(value: unknown, groupLabel?: string): string {
  const formatted = formatFinancialNumber(value as any, "0");
  if (normalizeRevenueNodeLabel(groupLabel) === "当前实际") {
    if (formatted.endsWith(".00")) {
      return formatted.slice(0, -3);
    }
  }
  return formatted;
}

function isInteractiveCostNode(label?: string) {
  const clean = String(label ?? "").replace(/\s+/g, "");
  return clean === "目标成本" || clean === "当前实际";
}

function buildPresentationCostChartOption(rawOption: any) {
  if (!rawOption) return rawOption;
  const categories: string[] = Array.isArray(rawOption.xAxis?.data)
    ? rawOption.xAxis.data
    : [];

  const rawSeries = Array.isArray(rawOption.series) ? rawOption.series : [];
  const series = rawSeries.map((s: any) => {
    if (s && (s.type === "bar" || s.name === "成本柱")) {
      const data = Array.isArray(s.data)
        ? s.data.map((item: any, index: number) => {
            const rawLabel =
              categories[index] ??
              (typeof item === "object" && item !== null ? item?.name : "");
            const clickable = isInteractiveCostNode(rawLabel) || index === 0 || index === 1;
            const val =
              typeof item === "object" && item !== null && "value" in item
                ? item.value
                : item;
            const originalItemStyle =
              typeof item === "object" && item !== null
                ? item.itemStyle
                : undefined;
            return {
              ...(typeof item === "object" && item !== null ? item : {}),
              name: rawLabel,
              value: val,
              cursor: clickable ? "pointer" : "default",
              itemStyle: {
                ...originalItemStyle,
                cursor: clickable ? "pointer" : "default",
              },
            };
          })
        : s.data;
      return {
        ...s,
        z: 5,
        cursor: "default",
        data,
      };
    }
    if (s && (s.type === "line" || s.name === "趋势折线")) {
      return {
        ...s,
        z: 10,
        triggerEvent: true,
        triggerLineEvent: true,
        cursor: "pointer",
      };
    }
    return s;
  });

  const rawGrid = rawOption.grid || {};
  const rawXAxis = rawOption.xAxis || {};
  const rawAxisLabel = rawXAxis.axisLabel || {};

  return {
    ...rawOption,
    grid: {
      ...rawGrid,
      bottom: Math.max(Number(rawGrid.bottom) || 0, 52),
      containLabel: true,
    },
    xAxis: {
      ...rawXAxis,
      axisLabel: {
        ...rawAxisLabel,
        interval: 0,
        rotate: 0,
        margin: 10,
        fontSize: 16,
        lineHeight: 20,
        formatter: (val: string) => formatCommitteeChartXAxisLabel(val),
      },
    },
    series,
  };
}

function handlePresentationCostChartClick(params: any) {
  if (!params) return;

  // 点击时动态从当前图表实例获取最新的 X 轴类目数据，如果没取到则从 props 兜底
  const currentOption = (costChart as any)?.getOption?.();
  const xAxisData =
    currentOption?.xAxis?.[0]?.data ||
    props.costChartOption?.xAxis?.data ||
    [];

  // 点击时再根据当前点击的 dataIndex 或 params 动态获取当前柱子名称
  const nodeLabel =
    (typeof params.dataIndex === "number" ? xAxisData[params.dataIndex] : "") ||
    params.name ||
    (params.componentType === "xAxis" ? params.value : "");

  console.log("👉 [成本图表点击] 动态获取节点名称:", nodeLabel, params);

  // 1. 柱状图（成本柱）点击
  const isBar = params.seriesType === "bar" || params.seriesName === "成本柱";
  if (isBar) {
    if (isInteractiveCostNode(nodeLabel) || params.dataIndex === 0 || params.dataIndex === 1) {
      emit("openCostData");
    }
    return;
  }

  // 2. 趋势折线（包含圆点和两点对应的折线段）点击
  const isLine =
    params.seriesType === "line" || params.seriesName === "趋势折线";
  if (isLine) {
    // 2.1 点击的是数据点圆点
    if (typeof params.dataIndex === "number" && params.dataIndex >= 0) {
      if (params.dataIndex === 0 || params.dataIndex === 1 || isInteractiveCostNode(nodeLabel)) {
        emit("openCostData");
      }
      return;
    }

    // 2.2 点击在线段本体上（判断点击的 X 坐标是否落在目标成本到当前实际区间）
    const clickX = params.event?.offsetX ?? params.event?.zrX;
    if (typeof clickX === "number" && costChart) {
      try {
        const xIndex = costChart.convertFromPixel({ xAxisIndex: 0 }, clickX);
        if (typeof xIndex === "number" && xIndex <= 1.3) {
          emit("openCostData");
          return;
        }
      } catch {
        emit("openCostData");
        return;
      }
    } else {
      emit("openCostData");
      return;
    }
  }

  // 3. X 轴标签点击（triggerEvent: true）
  if (params.componentType === "xAxis") {
    if (isInteractiveCostNode(nodeLabel)) {
      emit("openCostData");
    }
    return;
  }
}

async function initCostChartOnElement(element: HTMLElement) {
  await nextTick();
  if (costChart && costChart.getDom() !== element) {
    costChart.dispose();
    costChart = null;
  }
  if (!costChart) {
    const width = element.clientWidth || 820;
    const height = element.clientHeight || 680;
    costChart = echarts.init(element, undefined, { width, height });
  }
  if (props.costChartOption) {
    const option = buildPresentationCostChartOption(props.costChartOption);
    costChart.setOption(option, true);
  }
  if (typeof costChart.off === "function") {
    costChart.off("click");
  }
  if (typeof costChart.on === "function") {
    costChart.on("click", handlePresentationCostChartClick);
  }
  costChart.resize();
  setTimeout(() => {
    costChart?.resize();
  }, 100);
}

function revenueMetricSubjectId(label: string) {
  const subjectIds: Record<string, number> = {
    "边贡": 34,
    "营业利润": 35,
    "市场指导价（含税）": 5,
    "TP价（含税）": 7,
    "材料成本": 12,
    "变动制造费用": 16,
    "变动销售费用": 17,
  };
  return subjectIds[label] ?? null;
}

function handleRevenueMetricClick(metric?: string) {
  if (!metric) return;
  const subjectId = revenueMetricSubjectId(metric);
  emit("openRevenueData", subjectId);
}

function onCostChartMounted(el: any) {
  if (el && el instanceof HTMLElement) {
    void initCostChartOnElement(el);
  }
}

async function renderCostChart() {
  await nextTick();
  const element = presentationRootRef.value?.querySelector<HTMLElement>(
    '[data-review-chart="presentation-cost"]',
  );
  if (element) {
    await initCostChartOnElement(element);
  } else {
    costChart?.dispose();
    costChart = null;
  }
}


function buildLocalRevenueChartOption() {
  const groups = (props.revenueChartGroups && props.revenueChartGroups.length > 0)
    ? props.revenueChartGroups
    : [
        { label: "目标成本", margin: "0", profit: "0" },
        { label: "当前实际", margin: "45136.06", profit: "0" },
        { label: "SOP预算", margin: "0", profit: "0" },
        { label: "SOP+6Y预算", margin: "0", profit: "0" },
      ];

  const categories = groups.map((g: any) => g.label || "");
  const marginData = groups.map((g: any) => {
    const matched = String(g.margin || "0").match(/-?\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : 0;
  });
  const profitData = groups.map((g: any) => {
    const matched = String(g.profit || "0").match(/-?\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : 0;
  });
  const buildBarData = (values: number[], withLabel = false) =>
    values.map((value, index) => {
      const label = categories[index] ?? "";
      const clickable = isCurrentActualRevenueNode(label);
      return {
        value,
        cursor: clickable ? "pointer" : "default",
        itemStyle: {
          cursor: clickable ? "pointer" : "default",
          borderRadius: (value ?? 0) < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0],
        },
        label: withLabel
          ? {
              show: true,
              position: value < 0 ? "bottom" : "top",
              align: "center",
            }
          : { show: false },
      };
    });

  const scale = calculateChartYAxisScale([...marginData, ...profitData]);
  const colWidth = props.revenueMetricColumnWidth || 200;

  return {
    animation: false,
    title: {
      text: "{title|收益兑现路径}{sub|（元）}",
      left: 0,
      top: 0,
      textStyle: {
        rich: {
          title: {
            color: "#0f2338",
            fontSize: 16,
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
      top: 54,
      left: colWidth,
      right: 0,
      bottom: 28,
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
      textStyle: { fontSize: 14 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        const seen = new Set<string>();
        const validParams = params.filter((p) => {
          if (!["边贡", "营业利润"].includes(p.seriesName) || seen.has(p.seriesName)) {
            return false;
          }
          seen.add(p.seriesName);
          return true;
        });
        if (!validParams.length) return "";
        const title = validParams[0]?.axisValueLabel || "";
        const lines = validParams.map((p) => {
          return `${p.marker} ${p.seriesName}: ${formatFinancialNumber(p.value, "0")} 元`;
        });
        return [title, ...lines].join("<br/>");
      },
    },
    xAxis: [
      {
        type: "category",
        data: categories,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisLabel: {
          interval: 0,
          color: "#1e293b",
          fontSize: 14,
          fontWeight: 600,
          margin: 10,
          formatter: (val: string) => formatCommitteeChartXAxisLabel(val),
        },
      },
      {
        type: "category",
        data: categories,
        show: false,
      },
    ],
    yAxis: {
      type: "value",
      min: scale.min,
      max: scale.max,
      interval: scale.interval,
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
        formatter: (val: number) => Number(val).toLocaleString("zh-CN"),
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
        z: 2,
        cursor: "default",
        data: buildBarData(marginData, false),
        barWidth: 22,
        barGap: "20%",
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
        cursor: "default",
        data: buildBarData(profitData, false),
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
        data: buildBarData(marginData, true),
        barWidth: 22,
        barGap: "20%",
        itemStyle: {
          color: "transparent",
          borderColor: "transparent",
        },
        label: {
          show: true,
          align: "center",
          distance: 6,
          color: "#1d4ed8",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
        data: buildBarData(profitData, true),
        barWidth: 22,
        barGap: "20%",
        itemStyle: {
          color: "transparent",
          borderColor: "transparent",
        },
        label: {
          show: true,
          align: "center",
          distance: 6,
          color: "#1d4ed8",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'DIN, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
  };
}

async function initRevenueChartOnElement(element: HTMLElement) {
  await nextTick();
  if (revenueChart && revenueChart.getDom() !== element) {
    revenueChart.dispose();
    revenueChart = null;
  }
  if (!revenueChart) {
    const width = element.clientWidth || 820;
    const height = element.clientHeight || 260;
    revenueChart = echarts.init(element, undefined, { width, height });
  }

  // This component owns the presentation chart, so its local option must be
  // used to keep the negative-value axis and label handling effective.
  const option = buildLocalRevenueChartOption();

  revenueChart.setOption(option, true);

  if (typeof revenueChart.off === "function") {
    revenueChart.off("click");
  }
  if (typeof revenueChart.on === "function") {
    revenueChart.on("click", (params: any) => {
      const nodeLabel = params?.name || (params?.componentType === "xAxis" ? params?.value : "");
      if (!isCurrentActualRevenueNode(nodeLabel)) {
        return;
      }
      if (["边贡", "营业利润"].includes(String(params?.seriesName))) {
        const subjectId = params.seriesName === "边贡" ? 34 : 35;
        emit("openRevenueData", subjectId);
      } else {
        emit("openRevenueData", 34);
      }
    });
  }

  revenueChart.resize();
  requestAnimationFrame(() => {
    revenueChart?.resize();
  });
  setTimeout(() => {
    revenueChart?.resize();
  }, 80);
  setTimeout(() => {
    revenueChart?.resize();
  }, 250);
}

function onRevenueChartMounted(el: any) {
  if (el && el instanceof HTMLElement) {
    void initRevenueChartOnElement(el);
  }
}

async function renderRevenueChart() {
  await nextTick();
  const element = presentationRootRef.value?.querySelector<HTMLElement>(
    '[data-review-chart="presentation-revenue"]',
  );
  if (element) {
    await initRevenueChartOnElement(element);
  } else {
    revenueChart?.dispose();
    revenueChart = null;
  }
}

function handleSlideAfterEnter() {
  const current = slideList.value[currentSlideIndex.value];
  if (current?.type === "reviewCost") {
    void renderCostChart();
  } else if (current?.type === "reviewRevenue") {
    void renderRevenueChart();
  }
}

function resizeCharts() {
  costChart?.resize();
  revenueChart?.resize();
}

function goToSlide(index: number) {
  if (index < 0 || index >= slideList.value.length) return;
  closeSpotlight();
  currentSlideIndex.value = index;
  emit("update:slideIndex", index);
  pptDrawerVisible.value = false;
  const current = slideList.value[index];
  if (current?.type === "reviewCost") {
    void renderCostChart();
  } else if (current?.type === "reviewRevenue") {
    void renderRevenueChart();
  }
}

function prevSlide() {
  if (currentSlideIndex.value > 0) {
    goToSlide(currentSlideIndex.value - 1);
  }
}

function nextSlide() {
  if (currentSlideIndex.value < slideList.value.length - 1) {
    goToSlide(currentSlideIndex.value + 1);
  }
}

function handleClose() {
  emit("update:modelValue", false);
  emit("close");
}

const isOsFullscreen = ref(Boolean(document.fullscreenElement));

function updateOsFullscreenState() {
  isOsFullscreen.value = Boolean(document.fullscreenElement);
}

async function toggleOsFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    }
  } catch (err) {
    console.warn("toggleOsFullscreen error", err);
  }
  updateOsFullscreenState();
}

let lastWheelTime = 0;
function handleStageWheel(event: WheelEvent) {
  resetCursorTimer();
  const target = event.target as HTMLElement | null;
  const scrollContainer = target?.closest(
    ".is-scrollable, .el-table__body-wrapper, .el-scrollbar__wrap",
  );
  if (scrollContainer) {
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    if (event.deltaY > 0 && scrollTop + clientHeight < scrollHeight - 4) {
      return;
    }
    if (event.deltaY < 0 && scrollTop > 4) {
      return;
    }
  }

  const now = Date.now();
  if (now - lastWheelTime < 380) return;
  if (Math.abs(event.deltaY) < 15) return;

  if (event.deltaY > 0) {
    nextSlide();
    lastWheelTime = now;
  } else if (event.deltaY < 0) {
    prevSlide();
    lastWheelTime = now;
  }
}

const isToolbarVisible = ref(false);
let toolbarHideTimer: ReturnType<typeof setTimeout> | null = null;
const isHoveringToolbar = ref(false);
const isDropdownOrPopoverOpen = ref(false);

// 鼠标超过2秒不动自动隐藏光标（全局穿透控制）
const isCursorHidden = ref(false);
let cursorHideTimer: ReturnType<typeof setTimeout> | null = null;

function showCursor() {
  if (isCursorHidden.value) {
    isCursorHidden.value = false;
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("is-ppt-cursor-hidden");
    document.body.classList.remove("is-ppt-cursor-hidden");
  }
}

function hideCursor() {
  if (presentationEffectsActive) {
    isCursorHidden.value = true;
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("is-ppt-cursor-hidden");
      document.body.classList.add("is-ppt-cursor-hidden");
    }
  }
}

function resetCursorTimer() {
  showCursor();
  if (cursorHideTimer) {
    clearTimeout(cursorHideTimer);
    cursorHideTimer = null;
  }
  if (!presentationEffectsActive) return;
  cursorHideTimer = setTimeout(() => {
    hideCursor();
  }, 2000);
}

function handleGlobalUserActivity() {
  resetCursorTimer();
}

function handlePresentationMouseLeave() {
  if (cursorHideTimer) {
    clearTimeout(cursorHideTimer);
    cursorHideTimer = null;
  }
  showCursor();
}

/**
 * 判断鼠标是否在屏幕下方接近工具栏区块
 * 底部工具栏位于屏幕水平正中，距离视口底部 24px，高度约 52px，总宽度约 340px
 * 触发感应区：垂直距离视口底部 <= 110px，水平距离屏幕中心 <= 280px（感应宽度 560px）
 */
function isNearToolbarArea(clientX: number, clientY: number): boolean {
  if (typeof window === "undefined") return false;
  const windowHeight = window.innerHeight || 1080;
  const windowWidth = window.innerWidth || 1920;
  const distFromBottom = windowHeight - clientY;
  const centerX = windowWidth / 2;
  const distFromCenter = Math.abs(clientX - centerX);

  return distFromBottom >= 0 && distFromBottom <= 110 && distFromCenter <= 280;
}

function resetToolbarTimer(delay = 2500) {
  if (toolbarHideTimer) {
    clearTimeout(toolbarHideTimer);
    toolbarHideTimer = null;
  }
  if (
    isHoveringToolbar.value ||
    isDropdownOrPopoverOpen.value ||
    pptDrawerVisible.value
  ) {
    return;
  }
  toolbarHideTimer = setTimeout(() => {
    if (
      !isHoveringToolbar.value &&
      !isDropdownOrPopoverOpen.value &&
      !pptDrawerVisible.value
    ) {
      isToolbarVisible.value = false;
    }
  }, delay);
}

function handlePresentationMouseMove(event: MouseEvent) {
  resetCursorTimer();

  // 若当前正在悬停工具栏、已展开下拉菜单或抽屉，保持显示
  if (
    isHoveringToolbar.value ||
    isDropdownOrPopoverOpen.value ||
    pptDrawerVisible.value
  ) {
    isToolbarVisible.value = true;
    return;
  }

  const near = isNearToolbarArea(event.clientX, event.clientY);
  if (near) {
    isToolbarVisible.value = true;
    resetToolbarTimer(2500);
  } else {
    // 鼠标在其他上方或两侧区域移动：若工具栏当前处于可见状态，则快速平滑淡出，不遮挡大屏阅读
    if (isToolbarVisible.value) {
      resetToolbarTimer(400);
    }
  }
}

function handleToolbarMouseEnter() {
  isHoveringToolbar.value = true;
  isToolbarVisible.value = true;
  if (toolbarHideTimer) {
    clearTimeout(toolbarHideTimer);
    toolbarHideTimer = null;
  }
}

function handleToolbarMouseLeave() {
  isHoveringToolbar.value = false;
  resetToolbarTimer(1000);
}

function handleDropdownVisibleChange(visible: boolean) {
  isDropdownOrPopoverOpen.value = visible;
  if (visible) {
    isToolbarVisible.value = true;
    if (toolbarHideTimer) {
      clearTimeout(toolbarHideTimer);
      toolbarHideTimer = null;
    }
  } else {
    resetToolbarTimer(1200);
  }
}

function handleKeydown(event: KeyboardEvent) {
  const targetTag = (event.target as HTMLElement)?.tagName?.toLowerCase();
  if (["input", "textarea"].includes(targetTag || "")) return;

  const key = event.key;
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(key)) {
    event.preventDefault();
    nextSlide();
  } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(key)) {
    event.preventDefault();
    prevSlide();
  } else if (key === "Home") {
    event.preventDefault();
    goToSlide(0);
  } else if (key === "End") {
    event.preventDefault();
    goToSlide(slideList.value.length - 1);
  } else if (key.toLowerCase() === "m" || key.toLowerCase() === "o") {
    event.preventDefault();
    pptDrawerVisible.value = !pptDrawerVisible.value;
  } else if (key === "Escape") {
    event.preventDefault();
    if (spotlightState.visible) {
      closeSpotlight();
      return;
    }
    if (isAllDeliverablesDialogVisible.value) {
      isAllDeliverablesDialogVisible.value = false;
      return;
    }
    handleClose();
  }
}

function handleWindowResize() {
  updateStageScale();
  resizeCharts();
  updateOsFullscreenState();
}

let presentationEffectsActive = false;

function setupPresentationEffects() {
  if (presentationEffectsActive) return;
  presentationEffectsActive = true;
  document.body.classList.add("is-ppt-presentation-active");
  updateStageScale();
  updateOsFullscreenState();
  window.addEventListener("resize", handleWindowResize);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("mousemove", handleGlobalUserActivity, { passive: true });
  window.addEventListener("pointermove", handleGlobalUserActivity, { passive: true });
  window.addEventListener("mousedown", handleGlobalUserActivity, { passive: true });
  window.addEventListener("wheel", handleGlobalUserActivity, { passive: true });
  document.addEventListener("mouseleave", handlePresentationMouseLeave);
  document.addEventListener("fullscreenchange", updateOsFullscreenState);
  if (
    typeof props.slideIndex === "number" &&
    props.slideIndex >= 0 &&
    props.slideIndex !== currentSlideIndex.value
  ) {
    currentSlideIndex.value = props.slideIndex;
  }
  const current = slideList.value[currentSlideIndex.value];
  if (current?.type === "reviewCost") void renderCostChart();
  if (current?.type === "reviewRevenue") void renderRevenueChart();
  resetCursorTimer();
}

function teardownPresentationEffects() {
  if (!presentationEffectsActive) return;
  presentationEffectsActive = false;
  document.body.classList.remove("is-ppt-presentation-active");
  if (toolbarHideTimer) {
    clearTimeout(toolbarHideTimer);
    toolbarHideTimer = null;
  }
  if (cursorHideTimer) {
    clearTimeout(cursorHideTimer);
    cursorHideTimer = null;
  }
  showCursor();
  window.removeEventListener("resize", handleWindowResize);
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("mousemove", handleGlobalUserActivity);
  window.removeEventListener("pointermove", handleGlobalUserActivity);
  window.removeEventListener("mousedown", handleGlobalUserActivity);
  window.removeEventListener("wheel", handleGlobalUserActivity);
  document.removeEventListener("mouseleave", handlePresentationMouseLeave);
  document.removeEventListener("fullscreenchange", updateOsFullscreenState);
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  }
  pptDrawerVisible.value = false;
  isAllDeliverablesDialogVisible.value = false;
  isDropdownOrPopoverOpen.value = false;
  closeSpotlight();
}

onMounted(setupPresentationEffects);
onActivated(() => {
  active.value = true;
  setupPresentationEffects();
});
onDeactivated(() => {
  active.value = false;
  teardownPresentationEffects();
});
onBeforeUnmount(() => {
  teardownPresentationEffects();
  costChart?.dispose();
  revenueChart?.dispose();
  costChart = null;
  revenueChart = null;
});

watch(
  () => props.slideIndex,
  (newIdx) => {
    if (
      typeof newIdx === "number" &&
      newIdx >= 0 &&
      newIdx !== currentSlideIndex.value
    ) {
      goToSlide(newIdx);
    }
  },
);

watch(
  () => pptDrawerVisible.value,
  (visible) => {
    if (visible) {
      isToolbarVisible.value = true;
    } else {
      resetToolbarTimer(1000);
    }
  },
);

watch(
  () => currentSlideIndex.value,
  async (newIndex) => {
    await nextTick();
    const current = slideList.value[newIndex];
    if (current?.type === "reviewCost") {
      void renderCostChart();
    } else if (current?.type === "reviewRevenue") {
      void renderRevenueChart();
    }
  },
);

watch(
  () => props.costChartOption,
  () => {
    if (slideList.value[currentSlideIndex.value]?.type === "reviewCost") {
      void renderCostChart();
    }
  },
);

watch(
  () => props.revenueChartOption,
  () => {
    if (slideList.value[currentSlideIndex.value]?.type === "reviewRevenue") {
      void renderRevenueChart();
    }
  },
);

// 产品委员会要求与完成情况：整组统一自适应字号与字重算法（根据条目总数与整组最长文本统一计算，杜绝单条文字长短不一导致同一页各卡片字体大小、字重参差不齐）
const unifiedPreviousGateTextStyle = computed(() => {
  const rows = props.previousGateRows || [];
  const count = rows.length || 1;
  let maxLen = 0;
  for (const row of rows) {
    const reqLen = (row.requirement || "").trim().length;
    const compLen = (row.completion || "").trim().length;
    if (reqLen > maxLen) maxLen = reqLen;
    if (compLen > maxLen) maxLen = compLen;
  }

  if (count <= 2) {
    if (maxLen <= 25) {
      return { fontSize: "24px", lineHeight: "1.65", fontWeight: "600" };
    }
    if (maxLen <= 60) {
      return { fontSize: "21px", lineHeight: "1.65", fontWeight: "500" };
    }
    return { fontSize: "19px", lineHeight: "1.65", fontWeight: "500" };
  } else if (count <= 3) {
    if (maxLen <= 25) {
      return { fontSize: "22px", lineHeight: "1.6", fontWeight: "600" };
    }
    if (maxLen <= 60) {
      return { fontSize: "19px", lineHeight: "1.6", fontWeight: "500" };
    }
    return { fontSize: "18px", lineHeight: "1.6", fontWeight: "500" };
  } else {
    // 4~5 条场景
    if (maxLen <= 25) {
      return { fontSize: "19px", lineHeight: "1.55", fontWeight: "600" };
    }
    if (maxLen <= 60) {
      return { fontSize: "17px", lineHeight: "1.55", fontWeight: "500" };
    }
    return { fontSize: "16px", lineHeight: "1.55", fontWeight: "500" };
  }
});

function getPreviousGateTextStyle(_text?: string) {
  return unifiedPreviousGateTextStyle.value;
}

// 成本/收益文字卡片：根据整体卡片总数与总行数/最长内容统一计算自适应字号，确保同组所有卡片字号、字重严格一致，杜绝参差不齐
const costCardsUnifiedTextStyle = computed(() => {
  const count =
    (props.costInsightCards?.length || 0) +
    (props.customCostPoints?.length || 0);
  let maxLen = 0;
  let totalEstimatedLines = 0;

  props.costInsightCards?.forEach((c) => {
    const text = c.content || "";
    if (text.length > maxLen) maxLen = text.length;
    totalEstimatedLines += estimateCardLines(text);
  });
  props.customCostPoints?.forEach((c) => {
    const text = c.value || "";
    if (text.length > maxLen) maxLen = text.length;
    totalEstimatedLines += estimateCardLines(text);
  });

  // 1. 内容极少场景（如 1~2 张简短卡片，总行数 <= 7 行）：字号大幅放大，饱满大气
  if (count <= 3 && totalEstimatedLines <= 7) {
    return { fontSize: "20px", lineHeight: "1.65", fontWeight: "normal", letterSpacing: "0.6px" };
  }

  // 2. 内容偏少场景（如 3 张卡片，总行数 <= 13 行）：大字号清晰呈现
  if (count <= 4 && totalEstimatedLines <= 13) {
    return { fontSize: "18px", lineHeight: "1.6", fontWeight: "normal", letterSpacing: "0.5px" };
  }

  // 3. 中等内容场景（总行数 <= 18 行）：
  if (totalEstimatedLines <= 18) {
    return { fontSize: "16.8px", lineHeight: "1.55", fontWeight: "normal", letterSpacing: "0.4px" };
  }

  // 4. 偏多内容场景（如当前 5 张卡片且含降本路径长文本，总行数约 19~24 行）：
  // 采用兼顾大屏清晰度与紧凑排版的统一 16px / 1.5 行高，杜绝虚空留白，整列严谨紧凑不溢出
  if (totalEstimatedLines <= 25) {
    return { fontSize: "16px", lineHeight: "1.5", fontWeight: "normal", letterSpacing: "0.3px" };
  }

  // 5. 超高密度极端场景（总行数 > 25 行）：自适应紧凑为 15px
  return { fontSize: "15px", lineHeight: "1.45", fontWeight: "normal", letterSpacing: "0.2px" };
});

const revenueCardsUnifiedTextStyle = computed(() => {
  const count =
    (props.revenueInsightCards?.length || 0) +
    (props.customRevenuePoints?.length || 0);
  let maxLen = 0;
  let totalEstimatedLines = 0;

  props.revenueInsightCards?.forEach((c) => {
    const text = c.content || "";
    if (text.length > maxLen) maxLen = text.length;
    totalEstimatedLines += estimateCardLines(text);
  });
  props.customRevenuePoints?.forEach((c) => {
    const text = c.value || "";
    if (text.length > maxLen) maxLen = text.length;
    totalEstimatedLines += estimateCardLines(text);
  });

  if (count <= 3 && totalEstimatedLines <= 7) {
    return { fontSize: "20px", lineHeight: "1.65", fontWeight: "normal", letterSpacing: "0.6px" };
  }

  if (count <= 4 && totalEstimatedLines <= 13) {
    return { fontSize: "18px", lineHeight: "1.6", fontWeight: "normal", letterSpacing: "0.5px" };
  }

  if (totalEstimatedLines <= 18) {
    return { fontSize: "16.8px", lineHeight: "1.55", fontWeight: "normal", letterSpacing: "0.4px" };
  }

  if (totalEstimatedLines <= 25) {
    return { fontSize: "16px", lineHeight: "1.5", fontWeight: "normal", letterSpacing: "0.3px" };
  }

  return { fontSize: "15px", lineHeight: "1.45", fontWeight: "normal", letterSpacing: "0.2px" };
});

/**
 * 估算大屏汇报模式下左侧卡片文本所占的真实连续视觉行数
 * 采用精确连续浮点模型，杜绝 Math.ceil 进位虚报行数导致卡片过度膨胀留白
 */
function estimateCardLines(rawText: string | undefined | null): number {
  if (!rawText || !rawText.trim()) return 1;
  const lines = rawText.split(/\r?\n/);
  let totalLines = 0;
  // 字号 16px 下，一行约容纳 23.5 个全角中文字符
  const CHARS_PER_LINE = 23.5;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      totalLines += 0.25;
      continue;
    }
    let charUnits = 0;
    for (let i = 0; i < line.length; i++) {
      charUnits += line.charCodeAt(i) > 255 ? 1 : 0.5;
    }
    // 连续浮点行数：保底 1 行，向上按实际占比平滑增加
    const lineCount = Math.max(1, charUnits / CHARS_PER_LINE);
    totalLines += lineCount;
  }
  return Math.max(1, totalLines);
}

/**
 * 智能计算卡片的高度/Flex权重字典
 * 核心优化：
 * 1. 采用精确物理高度当量模型：固定头部开销（1.8行当量）+ 真实文本连续行数；
 * 2. 彻底消灭单卡片内部虚高产生的死白空洞，各卡片高度与内容几乎 100% 精确契合；
 * 3. 整组卡片自然紧凑铺满容器高度，底部不留多余空隙，下方卡片完整展示不截断。
 */
function computeCardFlexMap(items: Array<{ id: string; text: string }>) {
  const result: Record<string, { flex: string; minHeight: string }> = {};
  if (!items || items.length === 0) return result;

  const linesList = items.map((item) => estimateCardLines(item.text));
  const maxLines = Math.max(...linesList);

  // 若全部卡片内容均极少（如均在 2 行以内）：平均分配
  if (maxLines <= 2) {
    items.forEach((item) => {
      result[item.id] = {
        flex: "1 1 0%",
        minHeight: "44px",
      };
    });
    return result;
  }

  // 内容有多有少：按实际物理高度当量（固定头部 1.8 + 真实文本行数）精准分配权重
  items.forEach((item, index) => {
    const lines = linesList[index];
    const weight = 1.8 + lines;

    result[item.id] = {
      flex: `${weight.toFixed(2)} ${weight.toFixed(2)} 0%`,
      minHeight: "44px",
    };
  });

  return result;
}

const costCardsAdaptiveFlexMap = computed(() => {
  const items: Array<{ id: string; text: string }> = [];
  (props.costInsightCards || []).forEach((c, idx) => {
    items.push({ id: `insight-${c.title || idx}`, text: c.content || "" });
  });
  (props.customCostPoints || []).forEach((c, idx) => {
    items.push({ id: `custom-${c.id || idx}`, text: c.value || "" });
  });
  return computeCardFlexMap(items);
});

function getCostCardFlexStyle(id: string) {
  return (
    costCardsAdaptiveFlexMap.value[id] || {
      flex: "1 1 0%",
      minHeight: "64px",
    }
  );
}

const revenueCardsAdaptiveFlexMap = computed(() => {
  const items: Array<{ id: string; text: string }> = [];
  (props.revenueInsightCards || []).forEach((c, idx) => {
    items.push({ id: `insight-${c.title || idx}`, text: c.content || "" });
  });
  (props.customRevenuePoints || []).forEach((c, idx) => {
    items.push({ id: `custom-${c.id || idx}`, text: c.value || "" });
  });
  return computeCardFlexMap(items);
});

function getRevenueCardFlexStyle(id: string) {
  return (
    revenueCardsAdaptiveFlexMap.value[id] || {
      flex: "1 1 0%",
      minHeight: "64px",
    }
  );
}
</script>

<template>
  <div
    v-show="active"
    ref="presentationRootRef"
    class="ppt-presentation-root"
    :class="{ 'is-cursor-hidden': isCursorHidden }"
    @mousemove="handlePresentationMouseMove"
    @pointermove="handlePresentationMouseMove"
    @mouseleave="handlePresentationMouseLeave"
    @wheel="handleStageWheel"
  >
    <!-- 自适应居中舞台 -->
    <div class="ppt-stage-wrapper">
      <div
        class="ppt-stage"
        :style="{
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
          transform: `scale(${stageScale})`,
          transformOrigin: 'center center',
        }"
      >
        <transition
          name="ppt-slide-fade"
          mode="out-in"
          @after-enter="handleSlideAfterEnter"
        >
          <div
            :key="slideList[currentSlideIndex]?.id"
            class="ppt-slide-card"
            :class="`ppt-slide-card--${slideList[currentSlideIndex]?.type}`"
          >
            <!-- 1. 封面页（三段式：上白 + 中蓝 + 下白） -->
            <div
              v-if="slideList[currentSlideIndex]?.type === 'cover'"
              class="ppt-slide-inner ppt-cover-layout"
            >
              <!-- 顶部 Top Header（白色背景） -->
              <header class="ppt-cover-top">
                <img
                  class="ppt-cover-logo"
                  :src="baicGroupLogo"
                  alt="北汽集团"
                />
                <span class="ppt-cover-badge">{{ currentGateName }}</span>
              </header>

              <!-- 中间 Hero Banner（红框深蓝底色区域） -->
              <div class="ppt-cover-banner">
                <div class="ppt-cover-backdrop" aria-hidden="true">
                  <img :src="groupMeetingBackdrop" alt="" />
                </div>
                <div class="ppt-cover-content">
                  <h1 class="ppt-cover-title">{{ coverTitle }}</h1>
                  <p class="ppt-cover-department">
                    汇报部门：<strong>{{ reportDepartment }}</strong>
                  </p>
                </div>
              </div>

              <!-- 底部 Facts & Footer（白色/浅色背景） -->
              <div class="ppt-cover-bottom">
                <div class="ppt-cover-facts">
                  <article
                    v-for="item in coverFacts"
                    :key="item.label"
                    class="ppt-cover-fact"
                  >
                    <span class="ppt-cover-fact-label">{{ item.label }}</span>
                    <strong class="ppt-cover-fact-val">{{ item.value }}</strong>
                  </article>
                </div>
                <footer class="ppt-cover-footer">
                  <div class="ppt-slide-footer__left">
                    <span>{{ reportDepartment }}</span>
                  </div>
                  <div class="ppt-slide-footer__right">
                    <span class="ppt-slide-footer__page"
                      >01 / {{ String(slideList.length).padStart(2, "0") }}</span
                    >
                  </div>
                </footer>
              </div>
            </div>

            <!-- 2. 标准页（非封面） -->
            <div v-else class="ppt-slide-inner ppt-standard-layout">
              <!-- 统一页眉 -->
              <header class="ppt-slide-header">
                <div class="ppt-slide-header__left">
                  <img
                    class="ppt-slide-header__logo"
                    :src="baicGroupLogo"
                    alt="北汽集团"
                  />
                  <div class="ppt-slide-header__divider"></div>
                  <span class="ppt-slide-header__meeting-title">{{
                    coverTitle
                  }}</span>
                  <span class="ppt-slide-header__gate-tag">{{
                    currentGateName
                  }}</span>
                </div>
                <div class="ppt-slide-header__right">
                  <span
                    v-if="slideList[currentSlideIndex]?.sectionNumber"
                    class="ppt-slide-header__section-num"
                  >
                    {{ slideList[currentSlideIndex]?.sectionNumber }}
                  </span>
                  <div class="ppt-slide-header__title-group">
                    <h3 class="ppt-slide-header__section-title">
                      {{ slideList[currentSlideIndex]?.sectionTitle }}
                    </h3>
                  </div>
                </div>
              </header>

              <!-- 统一主体 -->
              <main class="ppt-slide-body">
                <!-- 01 产品型谱 -->
                <div
                  v-if="slideList[currentSlideIndex]?.type === 'spectrum'"
                  class="ppt-body-spectrum"
                >
                  <div class="ppt-spectrum-card">
                    <img
                      v-if="spectrumImageUrl"
                      class="ppt-spectrum-image"
                      :src="spectrumImageUrl"
                      alt="产品型谱"
                    />
                    <div v-else class="ppt-spectrum-empty">暂无型谱图片</div>
                  </div>
                </div>

                <!-- 02 阀点信息与进度总览（合并后的完整页面） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'gateInfoAndTimeline'
                  "
                  class="ppt-body-gate-and-timeline"
                >
                  <!-- 上半部分：阀点意图 + 项目概述 -->
                  <div
                    class="ppt-gatetimeline-upper"
                    :style="upperSectionStyle"
                    :class="{ 'is-expanded-bg': isBackgroundExpanded }"
                  >
                    <div class="ppt-gate-intent-panel">
                      <header class="ppt-sub-head">
                        <span class="committee-text-strong"
                          >{{ currentGateName }} 阀点意图</span
                        >
                      </header>
                      <div class="ppt-gate-intent-inner">
                        <!-- 1. 阀点目的 -->
                        <div class="ppt-intent-pod">
                          <div class="ppt-intent-pod__head">
                            <span class="ppt-intent-pod__stripe is-purpose"></span>
                            <span class="ppt-intent-pod__title">阀点目的</span>
                          </div>
                          <div class="ppt-intent-pod__content">
                            <p class="ppt-intent-pod__text">
                              {{
                                formatIntentMultilineText(
                                  gatePurpose ||
                                  (gateBullets && gateBullets[0])
                                )
                              }}
                            </p>
                          </div>
                        </div>

                        <!-- 2. 核心工作内容 -->
                        <div class="ppt-intent-pod">
                          <div class="ppt-intent-pod__head">
                            <span class="ppt-intent-pod__stripe is-work"></span>
                            <span class="ppt-intent-pod__title">核心工作内容</span>
                          </div>
                          <div class="ppt-intent-pod__content">
                            <p class="ppt-intent-pod__text">
                              {{
                                formatIntentMultilineText(
                                  coreWorkContent ||
                                  (gateBullets && gateBullets[1])
                                )
                              }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="ppt-project-overview-panel">
                      <header class="ppt-sub-head">
                        <span class="committee-text-strong">项目概述</span>
                      </header>
                      <div
                        class="ppt-overview-fact-grid"
                        :class="{ 'is-expanded-bg': isBackgroundExpanded }"
                      >
                        <div
                          v-for="item in overviewFacts"
                          :key="item.label"
                          class="group-material-display__fact ppt-fact-item"
                          :class="[
                            (item.full || item.label === '项目背景')
                              ? 'group-material-display__fact--full ppt-fact-item--full'
                              : '',
                            item.tone ? `is-${item.tone}` : '',
                            ((item.full || item.label === '项目背景') && isBackgroundExpanded)
                              ? 'is-multiline'
                              : '',
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
                  </div>

                  <!-- 下半部分：阀点进度总览时间轴（保持原有样式结构） -->
                  <div class="ppt-gatetimeline-lower">
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">阀点进度</span>
                    </header>
                    <div
                      v-if="timelinePlan.length || timelineActual.length"
                      class="group-material-display__timeline-board ppt-timeline-board-fit"
                    >
                      <div
                        class="group-material-display__timeline-row group-material-display__timeline-row--year"
                        :style="timelineGridStyle"
                      >
                        <span
                          class="group-material-display__timeline-year-label"
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
                          <span class="committee-text-strong"
                            >计划时间</span
                          >
                        
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
                          <span class="committee-text-strong"
                            >实际时间</span
                          >
                          
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
                </div>

                <!-- 03 产品委员会要求与完成情况（沉浸式高管决策双列对照看板） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'previousGate'
                  "
                  class="ppt-body-previous-gate"
                >
                  <div
                    v-if="previousGateRows.length"
                    class="ppt-prevgate-stage"
                    :class="`is-count-${Math.min(previousGateRows.length, 5)}`"
                  >
                    <!-- 顶部极境双舱标头：全宽与下方卡片1:1对齐，中央微核徽章与流光翼线平衡呼吸感 -->
                    <header class="ppt-prevgate-deck-header">
                      <!-- 左列主头：上个阀点决策与要求 -->
                      <div class="ppt-deck-col is-req">
                        <div class="ppt-deck-pod-core">
                          <span class="ppt-deck-ray is-left"></span>
                          <span class="ppt-deck-emblem is-blue">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                          </span>
                          <h4 class="ppt-deck-main-title">
                            {{ previousGateTitles.requirement }}
                          </h4>
                          <span class="ppt-deck-ray is-right"></span>
                        </div>
                      </div>

                      <!-- 中间占位通道（与下方 52px 纵向对齐） -->
                      <div class="ppt-deck-flow-center"></div>

                      <!-- 右列主头：落实整改成果与闭环 -->
                      <div class="ppt-deck-col is-exec">
                        <div class="ppt-deck-pod-core">
                          <span class="ppt-deck-ray is-left"></span>
                          <span class="ppt-deck-emblem is-green">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </span>
                          <h4 class="ppt-deck-main-title">
                            {{ previousGateTitles.completion }}
                          </h4>
                          <span class="ppt-deck-ray is-right"></span>
                        </div>
                      </div>
                    </header>

                    <!-- 双列独立对照卡片流：整行成组交互与局部放大 -->
                    <div class="ppt-prevgate-grid-flow">
                      <div
                        v-for="row in previousGateRows"
                        :key="row.id || row.index"
                        class="ppt-prevgate-pair-row ppt-zoomable-pair-row"
                        title="点击放大查看该项要求与落实进展"
                        @click="openSpotlight({
                          type: 'pair',
                          title: `${previousGateTitles.requirement} ${String(row.index).padStart(2, '0')}`,
                          subtitle: '产品委员会要求与完成情况 · 落实跟踪',
                          badge: String(row.index).padStart(2, '0'),
                          tone: 'blue',
                          leftTitle: previousGateTitles.requirement,
                          leftContent: row.requirement || '暂无要求事项',
                          leftStripeTone: 'blue',
                          rightTitle: previousGateTitles.completion,
                          rightContent: row.completion || '暂无落实进展',
                          rightStripeTone: 'green',
                        })"
                      >
                        <!-- 左卡：要求事项（带左侧高雅微序号柱与北汽深蓝高光饰条） -->
                        <div class="ppt-prevgate-block is-req">
                          <div class="ppt-block-accent is-blue"></div>
                          <div class="ppt-block-index">
                            <span class="ppt-block-num">{{ String(row.index).padStart(2, "0") }}</span>
                          </div>
                          <div class="ppt-block-body">
                            <p
                              class="ppt-block-text is-req-text"
                              :style="getPreviousGateTextStyle(row.requirement)"
                            >
                              {{ row.requirement || "--" }}
                            </p>
                          </div>
                        </div>

                        <!-- 中间衔接通道：悬浮矢量流动微标，连接左右两张独立卡片 -->
                        <div class="ppt-prevgate-corridor">
                          <div class="ppt-corridor-line"></div>
                          <div class="ppt-corridor-node">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          </div>
                        </div>

                        <!-- 右卡：落实进展（带翡翠绿微标与高对比清晰文字） -->
                        <div class="ppt-prevgate-block is-exec">
                          <div class="ppt-block-accent is-green"></div>
                          <div class="ppt-block-status-icon">
                            <span class="ppt-status-check-circle">✓</span>
                          </div>
                          <div class="ppt-block-body">
                            <p
                              class="ppt-block-text is-exec-text"
                              :style="getPreviousGateTextStyle(row.completion)"
                            >
                              {{ row.completion || "--" }}
                            </p>
                          </div>
                          <span class="ppt-zoom-indicator is-prevgate-indicator" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <polyline points="9 21 3 21 3 15"></polyline>
                              <line x1="21" y1="3" x2="14" y2="10"></line>
                              <line x1="3" y1="21" x2="10" y2="14"></line>
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="ppt-prevgate-empty">
                    <div class="ppt-prevgate-empty-box">
                      <span>暂无产品委员会要求与完成情况事项</span>
                    </div>
                  </div>
                </div>

                <!-- 04 评审结论与交付物清单 -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type ===
                    'deliverablesAndMatrix'
                  "
                  class="ppt-body-deliverables"
                >
                  <div class="ppt-deliverables-layout">
                    <!-- 上方评审矩阵：上下两组部门卡片（高度适度降低，为底部材料板块留出充裕空间） -->
                    <div class="ppt-matrix-vertical-deck">
                      <div
                        v-for="(group, gIdx) in reviewMatrixGroups"
                        :key="group.title"
                        class="ppt-matrix-card"
                        :class="[
                          `ppt-matrix-card--theme-${gIdx % 2}`,
                          { 'ppt-matrix-card--compact': group.rows.length <= 1 },
                        ]"
                      >
                        <!-- 卡片顶栏（20px 大标题，与其他页面一致） -->
                        <header class="ppt-matrix-card-bar">
                          <div class="ppt-matrix-bar-left">
                            <span class="ppt-matrix-bar-stripe"></span>
                            <span class="ppt-matrix-bar-title">{{ group.title }}</span>
                          </div>
                          <span class="ppt-matrix-bar-tag">{{ group.count }}</span>
                        </header>

                        <!-- 表格主体 -->
                        <div class="ppt-matrix-table-wrap">
                          <table class="ppt-matrix-table">
                            <colgroup>
                              <col class="ppt-col-dim" />
                              <col
                                v-for="department in group.departments"
                                :key="department.key"
                                class="ppt-col-dept"
                              />
                            </colgroup>
                            <thead>
                              <tr>
                                <th class="ppt-th-dim">
                                  <span class="ppt-th-dim-chip">评审维度</span>
                                </th>
                                <th
                                  v-for="department in group.departments"
                                  :key="department.key"
                                  class="ppt-th-dept"
                                  :title="department.label"
                                >
                                  <div class="ppt-th-dept-chip">
                                    <span class="ppt-th-dept-text">{{ department.label }}</span>
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr
                                v-for="row in group.rows"
                                :key="row.dimension"
                                :class="{
                                  'is-conclusion-tr': row.dimension === '结论建议',
                                }"
                              >
                                <td class="ppt-td-dim">
                                  <span class="ppt-dim-name">{{ row.dimension }}</span>
                                </td>
                                <td
                                  v-for="department in group.departments"
                                  :key="department.key"
                                  class="ppt-td-val"
                                >
                                  <span
                                    v-if="row[department.key] !== 'empty'"
                                    class="ppt-matrix-signal-dot"
                                    :class="[
                                      `is-${row[department.key]}`,
                                      {
                                        'is-conclusion-dot': row.dimension === '结论建议',
                                        'is-clickable': department.taskId,
                                      },
                                    ]"
                                    @click="emit('openReviewTask', department.taskId)"
                                  ></span>
                                  <span v-else class="ppt-matrix-empty-dash">--</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <!-- 页面最下方区块：交付物清单（高度更高，容纳最多3排胶囊，标题统一为 20px） -->
                    <div class="ppt-deliverables-panel">
                      <header class="ppt-deliverables-panel-header">
                        <div class="ppt-deliverables-bar-left">
                          <span class="ppt-deliverables-bar-stripe"></span>
                          <span class="ppt-deliverables-bar-title">交付物清单</span>
                        </div>
                      </header>
                      <div class="ppt-deliverables-panel-body">
                        <div class="ppt-deliverables-flow">
                          <!-- 1. 自适应材料标题长度的文件标签（根据空间最多展示3排） -->
                          <div
                            v-for="item in displayedDeliverableItems"
                            :key="item.label"
                            class="ppt-deliverable-chip"
                            :title="item.label"
                          >
                            <span class="ppt-deliverable-chip-icon">
                              <img :src="fileIcon" alt="" />
                            </span>
                            <span class="ppt-deliverable-chip-text">{{ item.label }}</span>
                          </div>

                          <!-- 2. 尾部省略号与总数突出展示胶囊 -->
                          <div
                            class="ppt-deliverable-more-chip"
                            @click="isAllDeliverablesDialogVisible = true"
                            title="点击查看全部交付物清单"
                          >
                            <span class="ppt-more-chip__dots" aria-hidden="true">
                              <i></i><i></i><i></i>
                            </span>
                            <span class="ppt-more-chip__label">
                              <span class="ppt-more-chip__prefix">{{ deliverableItems.length > displayedDeliverableItems.length ? '等共' : '共' }}</span>
                              <strong class="ppt-more-chip__num">{{ deliverableItems.length }}</strong>
                              <span class="ppt-more-chip__suffix">份材料</span>
                            </span>
                            <span class="ppt-more-chip__action">
                              <span>全部</span>
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 05 质量板块（独立成页） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'reviewQuality'
                  "
                  class="ppt-body-quality"
                >
                  <div class="ppt-quality-panel">
                    <!-- 左上角标题（服务器下发标准字段内容） -->
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">{{
                        slideList[currentSlideIndex]?.slideTitle || "质量板块"
                      }}</span>
                      <span class="ppt-quality-count-badge">共 {{ qualityOpinionRows.length }} 项</span>
                    </header>

                    <!-- 质量板块核心总结性结论横幅（Executive Headline Banner） -->
                    <div
                      v-if="currentQualityConclusion"
                      class="ppt-quality-conclusion-bar ppt-quality-conclusion-bar--headline ppt-zoomable-remark"
                      title="点击放大聚焦查看质量总结结论"
                      @click.stop="openSpotlight({
                        title: '质量板块总结结论',
                        subtitle: '质量板块 · 核心研判定调',
                        badge: '总结结论',
                        tone: 'blue',
                        content: currentQualityConclusion,
                      })"
                    >
                      <!-- 左侧高光柱（权威定调指示） -->
                      <div class="ppt-headline-accent-bar" aria-hidden="true"></div>

                      <!-- 核心结论内容区 -->
                      <div class="ppt-quality-conclusion-content">
                        <div class="ppt-quality-conclusion-text">
                          {{ currentQualityConclusion }}
                        </div>
                      </div>

                      <!-- 背景淡雅权威引言水印 -->
                      <div class="ppt-headline-watermark" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="60" height="60" fill="currentColor">
                          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                        </svg>
                      </div>

                      <!-- 放大查看微交互指引 -->
                      <span class="ppt-zoom-indicator is-headline-zoom" aria-hidden="true" title="放大聚焦查看">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <polyline points="9 21 3 21 3 15"></polyline>
                          <line x1="21" y1="3" x2="14" y2="10"></line>
                          <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                      </span>
                    </div>

                    <!-- 事项区块卡片流（沉稳高级企业行政双舱） -->
                    <div
                      v-if="qualityOpinionRows.length"
                      class="ppt-quality-cards-container"
                      :class="`is-count-${Math.min(qualityOpinionRows.length, 3)}`"
                    >
                      <div
                        v-for="row in qualityOpinionRows"
                        :key="row.index"
                        class="ppt-quality-item-card ppt-zoomable-card"
                        title="点击放大查看质量问题详情"
                        @click="openSpotlight({
                          type: 'qualityPair',
                          title: row.title || `质量问题 ${row.index}`,
                          subtitle: '质量板块 · 议题研判',
                          badge: String(row.index).padStart(2, '0'),
                          tone: 'blue',
                          department: row.owner,
                          targetDate: row.date,
                          problem: row.problem || '暂无问题描述',
                          measure: row.measure || '暂无应对举措',
                        })"
                      >
                        <!-- 卡片顶栏：序号 + 议题标题 + 责任部门与目标时间 -->
                        <header class="ppt-quality-card-bar">
                          <div class="ppt-quality-bar-left">
                            <span class="ppt-quality-num-badge">
                              {{ String(row.index).padStart(2, "0") }}
                            </span>
                            <span class="ppt-quality-bar-title">
                              {{ row.title || `质量问题 ${row.index}` }}
                            </span>
                          </div>
                          <div class="ppt-quality-bar-right">
                            <div v-if="row.owner" class="ppt-quality-meta-chip is-dept">
                              <svg class="ppt-meta-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                              </svg>
                              <span class="ppt-meta-label">责任部门</span>
                              <span class="ppt-meta-divider"></span>
                              <span class="ppt-meta-val">{{ row.owner }}</span>
                            </div>
                            <div v-if="row.date" class="ppt-quality-meta-chip is-date">
                              <svg class="ppt-meta-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                              </svg>
                              <span class="ppt-meta-label">目标完成时间</span>
                              <span class="ppt-meta-divider"></span>
                              <span class="ppt-meta-val">{{ row.date }}</span>
                            </div>
                            <span class="ppt-zoom-indicator is-quality-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </div>
                        </header>

                        <!-- 卡片内容区：左右沉稳双舱 -->
                        <div class="ppt-quality-content-grid">
                          <!-- 左舱：问题诊断 -->
                          <div class="ppt-quality-pod ppt-quality-pod--problem">
                            <div class="ppt-pod-text-area">
                              <p class="ppt-pod-text is-problem-text">
                                {{ row.problem || "--" }}
                              </p>
                            </div>
                          </div>

                          <!-- 右舱：应对举措 -->
                          <div class="ppt-quality-pod ppt-quality-pod--measure">
                            <div class="ppt-pod-text-area">
                              <p class="ppt-pod-text is-measure-text">
                                {{ row.measure || "--" }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-else class="ppt-quality-empty">
                      暂无质量板块相关问题与措施
                    </div>
                  </div>
                </div>

                <!-- 06 成本板块（独立成页） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'reviewCost'
                  "
                  class="ppt-body-cost"
                >
                  <div class="ppt-cost-panel">
                    <!-- 左上角标题（服务器下发标准字段内容） -->
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">{{
                        slideList[currentSlideIndex]?.slideTitle || "成本板块"
                      }}</span>
                    </header>
                    <div class="ppt-cost-layout">
                      <!-- 左侧：3个核心成本文字洞察卡片（根据文字内容自适应高度；内容均少则平均分） -->
                      <div class="ppt-cost-side">
                        <article
                          v-for="(item, idx) in costInsightCards"
                          :key="item.title || idx"
                          class="ppt-cost-equal-card ppt-zoomable-card"
                          :class="`is-${item.tone}`"
                          :style="getCostCardFlexStyle(`insight-${item.title || idx}`)"
                          title="点击放大查看"
                          @click="openSpotlight({
                            title: item.title,
                            subtitle: '成本板块 · 成本研判',
                            icon: item.icon,
                            tone: item.tone,
                            content: item.content || '暂无内容',
                          })"
                        >
                          <header class="ppt-cost-equal-head">
                            <span class="ppt-cost-equal-icon">
                              <img :src="item.icon" alt="" />
                            </span>
                            <span class="ppt-cost-equal-title">{{ item.title }}</span>
                            <span class="ppt-zoom-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </header>
                          <div class="ppt-cost-equal-body">
                            <p
                              class="ppt-cost-equal-text"
                              :style="costCardsUnifiedTextStyle"
                            >
                              {{ item.content || "--" }}
                            </p>
                          </div>
                        </article>
                        <article
                          v-for="(item, idx) in customCostPoints"
                          :key="item.id || idx"
                          class="ppt-cost-equal-card ppt-cost-custom-card ppt-zoomable-card"
                          :class="`is-${item.tone}`"
                          :style="getCostCardFlexStyle(`custom-${item.id || idx}`)"
                          title="点击放大查看"
                          @click="openSpotlight({
                            title: item.label || '自定义标题',
                            subtitle: '成本板块 · 自定义要点',
                            icon: item.icon,
                            tone: item.tone,
                            content: item.value || '暂无内容',
                          })"
                        >
                          <header class="ppt-cost-equal-head">
                            <span class="ppt-cost-equal-icon">
                              <img :src="item.icon" alt="" />
                            </span>
                            <span class="ppt-cost-equal-title">{{ item.label || "自定义表题" }}</span>
                            <span class="ppt-zoom-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </header>
                          <div class="ppt-cost-equal-body">
                            <p
                              class="ppt-cost-equal-text"
                              :style="costCardsUnifiedTextStyle"
                            >
                              {{ item.value || "--" }}
                            </p>
                          </div>
                        </article>
                      </div>

                      <!-- 右侧：ECharts 成本柱状图（占宽 52%） -->
                      <div class="ppt-cost-main">
                        <div class="ppt-cost-chart-card">
                          <div
                            data-review-chart="presentation-cost"
                            :ref="onCostChartMounted"
                            class="ppt-cost-echarts"
                          ></div>
                          <div
                            v-if="costForecastRemark?.trim()"
                            class="ppt-chart-remark ppt-zoomable-remark"
                            title="点击放大查看"
                            @click.stop="openSpotlight({
                              title: '成本目标达成备注',
                              subtitle: '成本板块 · 备注说明',
                              badge: '备注',
                              tone: 'orange',
                              content: costForecastRemark,
                            })"
                          >
                            <span class="ppt-chart-remark-text">备注：{{ costForecastRemark }}</span>
                            <span class="ppt-zoom-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 07 收益板块（独立成页） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'reviewRevenue'
                  "
                  class="ppt-body-revenue"
                >
                  <div class="ppt-revenue-panel">
                    <!-- 左上角标题（服务器下发标准字段内容） -->
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">{{
                        slideList[currentSlideIndex]?.slideTitle || "收益板块"
                      }}</span>
                    </header>

                    <div class="ppt-revenue-layout">
                      <!-- 左侧：3个核心收益文字洞察卡片（根据文字内容自适应高度；内容均少则平均分） -->
                      <div class="ppt-revenue-side">
                        <article
                          v-for="(item, idx) in revenueInsightCards"
                          :key="item.title || idx"
                          class="ppt-revenue-equal-card ppt-zoomable-card"
                          :class="`is-${item.tone}`"
                          :style="getRevenueCardFlexStyle(`insight-${item.title || idx}`)"
                          title="点击放大查看"
                          @click="openSpotlight({
                            title: item.title,
                            subtitle: '收益板块 · 收益研判',
                            icon: item.icon,
                            tone: item.tone,
                            content: item.content || '暂无内容',
                          })"
                        >
                          <header class="ppt-revenue-equal-head">
                            <span class="ppt-revenue-equal-icon">
                              <img :src="item.icon" alt="" />
                            </span>
                            <span class="ppt-revenue-equal-title">{{ item.title }}</span>
                            <span class="ppt-zoom-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </header>
                          <div class="ppt-revenue-equal-body">
                            <p
                              class="ppt-revenue-equal-text"
                              :style="revenueCardsUnifiedTextStyle"
                            >
                              {{ item.content || "--" }}
                            </p>
                          </div>
                        </article>
                        <article
                          v-for="(item, idx) in customRevenuePoints"
                          :key="item.id || idx"
                          class="ppt-revenue-equal-card ppt-revenue-custom-card ppt-zoomable-card"
                          :class="`is-${item.tone}`"
                          :style="getRevenueCardFlexStyle(`custom-${item.id || idx}`)"
                          title="点击放大查看"
                          @click="openSpotlight({
                            title: item.label || '自定义标题',
                            subtitle: '收益板块 · 自定义要点',
                            icon: item.icon,
                            tone: item.tone,
                            content: item.value || '暂无内容',
                          })"
                        >
                          <header class="ppt-revenue-equal-head">
                            <span class="ppt-revenue-equal-icon">
                              <img :src="item.icon" alt="" />
                            </span>
                            <span class="ppt-revenue-equal-title">{{ item.label || "自定义表题" }}</span>
                            <span class="ppt-zoom-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </header>
                          <div class="ppt-revenue-equal-body">
                            <p
                              class="ppt-revenue-equal-text"
                              :style="revenueCardsUnifiedTextStyle"
                            >
                              {{ item.value || "--" }}
                            </p>
                          </div>
                        </article>
                      </div>

                      <!-- 右侧：图表与表格一体化分析看板（占宽 52%，上下 1:1 分布） -->
                      <div class="ppt-revenue-main">
                        <!-- 上半部：ECharts 收益兑现路径柱状图（占 50%） -->
                        <div class="ppt-revenue-chart-card">
                          <div
                            data-review-chart="presentation-revenue"
                            :ref="onRevenueChartMounted"
                            class="ppt-revenue-echarts"
                          ></div>
                          <div
                            v-if="revenueForecastRemark?.trim()"
                            class="ppt-chart-remark ppt-zoomable-remark"
                            title="点击放大查看"
                            @click.stop="openSpotlight({
                              title: '收益兑现路径备注',
                              badge: '备注',
                              tone: 'orange',
                              content: revenueForecastRemark,
                            })"
                          >
                            <span class="ppt-chart-remark-text">备注：{{ revenueForecastRemark }}</span>
                            <span class="ppt-zoom-indicator" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <polyline points="9 21 3 21 3 15"></polyline>
                                <line x1="21" y1="3" x2="14" y2="10"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                              </svg>
                            </span>
                          </div>
                        </div>

                        <!-- 下半部：指标明细校核表格（占 50%） -->
                        <div class="ppt-revenue-table-wrap">
                          <table class="ppt-revenue-native-table">
                            <tbody>
                              <tr
                                v-for="row in revenueTableRows"
                                :key="row.metric"
                              >
                                <td class="ppt-rev-td-metric">{{ row.metric }}</td>
                                <td
                                  v-for="group in revenueChartGroups"
                                  :key="group.id"
                                  class="ppt-rev-td-val"
                                  :class="{
                                    'is-clickable': isCurrentActualRevenueNode(group.label),
                                    'is-emphasis': [
                                      '目标成本',
                                      '当前实际',
                                    ].includes(
                                      normalizeRevenueNodeLabel(group.label),
                                    ),
                                  }"
                                  :title="isCurrentActualRevenueNode(group.label) ? '点击查看收益数据明细' : undefined"
                                  @click="isCurrentActualRevenueNode(group.label) ? handleRevenueMetricClick(row.metric) : undefined"
                                >
                                  {{ formatRevenueMetricCellValue(row.values[group.id], group.label) }}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 08 自定义板块（独立成页） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'reviewCustom'
                  "
                  class="ppt-body-custom"
                >
                  <div class="ppt-custom-panel">
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">{{
                        slideList[currentSlideIndex]?.slideTitle
                      }}</span>
                    </header>
                    <div class="ppt-custom-content">
                      <p>
                        {{
                          slideList[currentSlideIndex]?.block?.content || "--"
                        }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- 09 提请决议事项（现场输入与保存看板） -->
                <div
                  v-else-if="slideList[currentSlideIndex]?.type === 'decision'"
                  class="ppt-body-decision"
                >
                  <div class="ppt-decision-panel">
                    <!-- 顶栏：完全对齐收益板块等标准页面的统一标题样式与字号（无蓝色竖条，统一 20px 标准标题） -->
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">{{
                        slideList[currentSlideIndex]?.slideTitle || "提请决议事项"
                      }}</span>
                    </header>

                    <!-- 主体：全画幅大气质感空间（右侧北汽大楼山峦光影背景 + 左侧核心大字排版） -->
                    <div
                      class="ppt-decision-workspace ppt-decision-workspace--ref"
                      :class="[
                        `is-count-${Math.min(decisionDisplayItems.length, 4)}`,
                        { 'is-empty': !decisionDisplayItems.length },
                        { 'has-conclusion': Boolean(resolvedDecisionConclusion) },
                      ]"
                    >
                      <!-- 纯 CSS/矢量高定底图（纯粹远景自然山峦渐变色块，无生硬建筑线条） -->
                      <div class="ppt-ref-css-backdrop" aria-hidden="true">
                        <svg class="ppt-ref-backdrop-svg" viewBox="0 0 960 620" preserveAspectRatio="xMaxYMid slice" fill="none">
                          <defs>
                            <!-- 远景柔和群山层叠渐变 1 -->
                            <linearGradient id="refGradHillFar" x1="0%" y1="50%" x2="100%" y2="50%">
                              <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
                              <stop offset="30%" stop-color="#eff6ff" stop-opacity="0.25" />
                              <stop offset="70%" stop-color="#dbeafe" stop-opacity="0.5" />
                              <stop offset="100%" stop-color="#bfdbfe" stop-opacity="0.6" />
                            </linearGradient>
                            <!-- 中景山峦渐变 2 -->
                            <linearGradient id="refGradHillMid" x1="0%" y1="30%" x2="100%" y2="70%">
                              <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
                              <stop offset="40%" stop-color="#e0effe" stop-opacity="0.3" />
                              <stop offset="85%" stop-color="#c7ddfe" stop-opacity="0.5" />
                              <stop offset="100%" stop-color="#a8cdfe" stop-opacity="0.55" />
                            </linearGradient>
                            <!-- 近景薄雾地平线渐变 -->
                            <linearGradient id="refGradMist" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
                              <stop offset="60%" stop-color="#f0f6ff" stop-opacity="0.5" />
                              <stop offset="100%" stop-color="#ffffff" stop-opacity="0.95" />
                            </linearGradient>
                          </defs>

                          <!-- 远景柔和群山层叠色块（自然延展至右侧天际线，纯色块无任何杂线） -->
                          <path d="M80 430 C 260 320, 480 340, 680 310 C 780 295, 870 230, 960 220 L960 620 L80 620 Z" fill="url(#refGradHillFar)" />
                          <path d="M220 470 C 400 370, 580 400, 750 360 C 830 340, 900 310, 960 300 L960 620 L220 620 Z" fill="url(#refGradHillMid)" />
                          <rect x="0" y="460" width="960" height="160" fill="url(#refGradMist)" />
                        </svg>
                      </div>

                      <!-- 空状态 -->
                      <div
                        v-if="!decisionDisplayItems.length"
                        class="ppt-decision-empty-box"
                      >
                        <div class="ppt-decision-empty-icon">
                          <svg
                            viewBox="0 0 24 24"
                            width="44"
                            height="44"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.6"
                          >
                            <path
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.5L19 7.5V19a2 2 0 0 1-2 2z"
                            />
                          </svg>
                        </div>
                        <p class="ppt-decision-empty-text">本次会议暂无提请决议事项</p>
                      </div>

                      <div v-else class="ppt-ref-main-flow">
                        <!-- 顶层：总纲统领区（开放式大字布局，配备高定设计的中部长光轨） -->
                        <div
                          v-if="resolvedDecisionConclusion"
                          class="ppt-ref-manifesto-stage"
                        >
                          <h2 class="ppt-ref-hero-headline">
                            {{ formattedDecisionConclusionHeadline }}
                          </h2>

                          <!-- 中部分割架构：承上启下的长光轨架构分割线（左侧端点立锚 + 向右舒展渐隐至水墨山峦） -->
                          <div class="ppt-ref-main-divider" aria-hidden="true">
                            <span class="ppt-divider-anchor"></span>
                            <span class="ppt-divider-rail"></span>
                          </div>
                        </div>

                        <!-- 底层：落地执行决议事项列表（开放式经典布局：大号艺术斜体数字 + 优雅细竖线 + 舒展大字） -->
                        <div class="ppt-ref-action-grid">
                          <article
                            v-for="(item, index) in decisionDisplayItems"
                            :key="item.id"
                            class="ppt-ref-action-line"
                            :class="`ref-line-${index + 1}`"
                          >
                            <!-- 大号浅蓝艺术斜体数字 -->
                            <div class="ppt-ref-italic-num" aria-hidden="true">
                              {{ String(index + 1).padStart(2, "0") }}
                            </div>

                            <!-- 优雅柔和细竖线 -->
                            <div class="ppt-ref-item-sep" aria-hidden="true"></div>

                            <!-- 执行事项正文 -->
                            <div class="ppt-ref-item-body">
                              <p class="ppt-ref-item-text">{{ item.value }}</p>
                            </div>
                          </article>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 10 附件展示区（自适应高端材料卡片流） -->
                <div
                  v-else-if="
                    slideList[currentSlideIndex]?.type === 'attachments'
                  "
                  class="ppt-body-attachments"
                >
                  <div class="ppt-attachments-panel">
                    <!-- 顶栏：服务器下发标准标题 + 正常数量统计 -->
                    <header class="ppt-sub-head">
                      <span class="committee-text-strong">{{
                        slideList[currentSlideIndex]?.slideTitle || "附件展示区"
                      }}</span>

                      <div class="ppt-attach-top-meta">
                        <span class="ppt-attach-meta-badge">
                          <span class="ppt-tag-dot--blue"></span>
                          <span>共 {{ attachmentItems.length }} 份附件</span>
                        </span>
                      </div>
                    </header>

                    <!-- 主体展示区 -->
                    <div class="ppt-attachments-workspace">
                      <!-- 空状态 -->
                      <div v-if="!attachmentItems.length" class="ppt-attach-empty-box">
                        <span class="ppt-attach-empty-text">暂无会议附件</span>
                      </div>

                      <!-- 1 个附件时的全景尊崇主材料卡片 -->
                      <div
                        v-else-if="attachmentItems.length === 1"
                        class="ppt-attach-single-layout"
                      >
                        <article
                          class="ppt-attach-hero-card"
                          :class="getAttachmentMeta(attachmentItems[0].fileName).themeClass"
                          @click="handlePreviewAttachment(attachmentItems[0])"
                        >
                          <div class="ppt-hero-icon-box">
                            <span class="ppt-hero-icon-ext">
                              {{ getAttachmentMeta(attachmentItems[0].fileName).extLabel }}
                            </span>
                            <svg class="ppt-hero-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>

                          <div class="ppt-hero-content-box">
                            <h3 class="ppt-hero-filename" :title="attachmentItems[0].title || attachmentItems[0].fileName">
                              {{ attachmentItems[0].title || attachmentItems[0].fileName }}
                            </h3>
                            <div class="ppt-hero-action-row">
                              <button
                                type="button"
                                class="ppt-hero-preview-btn"
                                :disabled="localDownloadingId === attachmentItems[0].attachmentId || downloadingAttachmentId === attachmentItems[0].attachmentId"
                                @click.stop="handlePreviewAttachment(attachmentItems[0])"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                <span>{{ (localDownloadingId === attachmentItems[0].attachmentId || downloadingAttachmentId === attachmentItems[0].attachmentId) ? "正在加载..." : "在线预览" }}</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      </div>

                      <!-- 2~5 个附件时的自适应网格卡片流 -->
                      <div
                        v-else
                        class="ppt-attach-multi-grid"
                        :class="`is-count-${Math.min(attachmentItems.length, 5)}`"
                      >
                        <article
                          v-for="item in attachmentItems"
                          :key="item.attachmentId"
                          class="ppt-attach-grid-card"
                          :class="getAttachmentMeta(item.fileName).themeClass"
                          @click="handlePreviewAttachment(item)"
                        >
                          <div class="ppt-grid-card-head">
                            <div class="ppt-grid-icon-box">
                              <span class="ppt-grid-icon-ext">
                                {{ getAttachmentMeta(item.fileName).extLabel }}
                              </span>
                              <svg class="ppt-grid-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                          </div>

                          <div class="ppt-grid-card-body">
                            <h4 class="ppt-grid-filename" :title="item.title || item.fileName">
                              {{ item.title || item.fileName }}
                            </h4>
                          </div>

                          <div class="ppt-grid-card-foot">
                            <button
                              type="button"
                              class="ppt-grid-preview-btn"
                              :disabled="localDownloadingId === item.attachmentId || downloadingAttachmentId === item.attachmentId"
                              @click.stop="handlePreviewAttachment(item)"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>{{ (localDownloadingId === item.attachmentId || downloadingAttachmentId === item.attachmentId) ? "加载中..." : "点击预览" }}</span>
                            </button>
                          </div>
                        </article>
                      </div>
                    </div>
                  </div>
                </div>
              </main>

              <!-- 统一页脚 -->
              <footer class="ppt-slide-footer">
                <div class="ppt-slide-footer__left">
                  <span>{{ reportDepartment }}</span>
                </div>
                <div class="ppt-slide-footer__right">
                  <span class="ppt-slide-footer__page"
                    >{{ String(currentSlideIndex + 1).padStart(2, "0") }} /
                    {{ String(slideList.length).padStart(2, "0") }}</span
                  >
                </div>
              </footer>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- 悬浮汇报工具栏 -->
    <nav
      class="ppt-floating-toolbar"
      :class="{ 'is-hidden': !isToolbarVisible }"
      @mouseenter="handleToolbarMouseEnter"
      @mouseleave="handleToolbarMouseLeave"
    >
      <div class="ppt-floating-toolbar__inner">
        <el-tooltip
          :teleported="false"
          content="上一页 (← / PageUp)"
          placement="top"
          popper-class="ppt-toolbar-tooltip-popper"
          :show-after="300"
        >
          <button
            class="ppt-btn ppt-btn--icon"
            :disabled="currentSlideIndex === 0"
            @click.stop="prevSlide"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>
        </el-tooltip>

        <el-dropdown
          trigger="click"
          popper-class="ppt-page-dropdown-popper"
          :teleported="false"
          max-height="420px"
          @command="goToSlide"
          @visible-change="handleDropdownVisibleChange"
        >
          <button class="ppt-btn ppt-btn--page" type="button">
            <span>{{ String(currentSlideIndex + 1).padStart(2, "0") }}</span>
            <span class="ppt-page-divider">/</span>
            <span>{{ String(slideList.length).padStart(2, "0") }}</span>
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="ppt-page-dropdown-menu">
              <el-dropdown-item
                v-for="(s, idx) in slideList"
                :key="s.id"
                :command="idx"
                :class="{ 'is-active': idx === currentSlideIndex }"
              >
                <span class="ppt-dropdown-idx">{{
                  String(idx + 1).padStart(2, "0")
                }}</span>
                <span class="ppt-dropdown-title">{{
                  s.slideTitle || s.sectionTitle
                }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-tooltip
          :teleported="false"
          content="下一页 (→ / Space / PageDown)"
          placement="top"
          popper-class="ppt-toolbar-tooltip-popper"
          :show-after="300"
        >
          <button
            class="ppt-btn ppt-btn--icon"
            :disabled="currentSlideIndex === slideList.length - 1"
            @click.stop="nextSlide"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>
        </el-tooltip>

        <div class="ppt-toolbar-divider"></div>

        <el-tooltip
          :teleported="false"
          content="幻灯片大纲目录 (M / O)"
          placement="top"
          popper-class="ppt-toolbar-tooltip-popper"
          :show-after="300"
        >
          <button
            class="ppt-btn ppt-btn--icon"
            :class="{ 'is-active': pptDrawerVisible }"
            @click.stop="pptDrawerVisible = !pptDrawerVisible"
          >
            <el-icon><Menu /></el-icon>
          </button>
        </el-tooltip>

        <el-tooltip
          :teleported="false"
          :content="isOsFullscreen ? '还原窗口' : '铺满全屏 (F11)'"
          placement="top"
          popper-class="ppt-toolbar-tooltip-popper"
          :show-after="300"
        >
          <button
            class="ppt-btn ppt-btn--icon"
            @click.stop="toggleOsFullscreen"
          >
            <el-icon>
              <ScaleToOriginal v-if="isOsFullscreen" />
              <FullScreen v-else />
            </el-icon>
          </button>
        </el-tooltip>

        <el-tooltip
          :teleported="false"
          content="退出全屏 (Esc)"
          placement="top"
          popper-class="ppt-toolbar-tooltip-popper"
          :show-after="300"
        >
          <button class="ppt-btn ppt-btn--icon" @click.stop="handleClose">
            <el-icon><Close /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </nav>

    <!-- 幻灯片大纲抽屉 -->
    <div
      class="ppt-outline-drawer"
      :class="{ 'is-visible': pptDrawerVisible }"
      @click.self="pptDrawerVisible = false"
    >
      <div class="ppt-outline-drawer__panel">
        <div class="ppt-outline-drawer__header">
          <h4>幻灯片大纲 (共 {{ slideList.length }} 页)</h4>
          <button
            class="ppt-outline-drawer__close"
            @click="pptDrawerVisible = false"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="ppt-outline-drawer__list">
          <div
            v-for="(s, idx) in slideList"
            :key="s.id"
            class="ppt-outline-item"
            :class="{ 'is-current': idx === currentSlideIndex }"
            @click="goToSlide(idx)"
          >
            <div class="ppt-outline-item__num">
              {{ String(idx + 1).padStart(2, "0") }}
            </div>
            <div class="ppt-outline-item__info">
              <div class="ppt-outline-item__sec">
                {{ s.sectionTitle }}
              </div>
              <div v-if="s.slideTitle" class="ppt-outline-item__sub">
                {{ s.slideTitle }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 独立区块局部放大特效浮窗（Spotlight Zoom Modal，大屏触控与演播特化） -->
    <transition name="ppt-spotlight-anim">
      <div
        v-if="spotlightState.visible"
        class="ppt-spotlight-overlay"
        @click.self="closeSpotlight"
      >
        <div
          class="ppt-spotlight-dialog"
          :class="`is-${spotlightState.data.tone || 'blue'}`"
        >
          <!-- 顶部流光色条 -->
          <div class="ppt-spotlight-glow-bar"></div>

          <!-- 浮窗头部 -->
          <header class="ppt-spotlight-header">
            <div class="ppt-spotlight-header-main">
              <div class="ppt-spotlight-title-row">
                <!-- 序号徽章或图标 -->
                <span
                  v-if="spotlightState.data.badge"
                  class="ppt-spotlight-badge"
                >
                  {{ spotlightState.data.badge }}
                </span>
                <span
                  v-else-if="spotlightState.data.icon"
                  class="ppt-spotlight-icon-badge"
                >
                  <img :src="spotlightState.data.icon" alt="" />
                </span>
                <h3 class="ppt-spotlight-title">{{ spotlightState.data.title }}</h3>
              </div>
            </div>

            <!-- 元数据标签（责任部门、目标完成时间等） -->
            <div class="ppt-spotlight-header-extra">
              <div
                v-if="spotlightState.data.department"
                class="ppt-spotlight-chip is-dept"
              >
                <svg class="ppt-spotlight-chip-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span class="ppt-spotlight-chip-label">责任部门</span>
                <span class="ppt-spotlight-chip-divider"></span>
                <span class="ppt-spotlight-chip-val">{{ spotlightState.data.department }}</span>
              </div>

              <div
                v-if="spotlightState.data.targetDate"
                class="ppt-spotlight-chip is-date"
              >
                <svg class="ppt-spotlight-chip-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span class="ppt-spotlight-chip-label">目标完成时间</span>
                <span class="ppt-spotlight-chip-divider"></span>
                <span class="ppt-spotlight-chip-val">{{ spotlightState.data.targetDate }}</span>
              </div>

              <!-- 右上角关闭按钮 -->
              <button
                type="button"
                class="ppt-spotlight-close-btn"
                @click="closeSpotlight"
                title="关闭浮窗 (Esc)"
              >
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </header>

          <!-- 浮窗核心内容区（放大呈现核心文字，凸显排版） -->
          <div class="ppt-spotlight-body">
            <!-- A. 双舱对照合并放大展示（质量问题、产品委员会要求与完成情况事项等） -->
            <div
              v-if="spotlightState.data.type === 'pair' || spotlightState.data.type === 'qualityPair'"
              class="ppt-spotlight-pair-grid"
            >
              <!-- 左舱 -->
              <div
                class="ppt-spotlight-pair-pod"
                :class="`is-${spotlightState.data.leftStripeTone || 'problem'}`"
              >
                <header class="ppt-spotlight-pod-header">
                  <span
                    class="ppt-spotlight-pod-stripe"
                    :class="`is-${spotlightState.data.leftStripeTone || 'problem'}`"
                  ></span>
                  <h4 class="ppt-spotlight-pod-title">
                    {{ spotlightState.data.leftTitle || '问题诊断' }}
                  </h4>
                </header>
                <div class="ppt-spotlight-pod-content">
                  <p
                    class="ppt-spotlight-content-text is-pair-text"
                    :style="spotlightProblemStyle"
                  >
                    {{ spotlightState.data.leftContent || spotlightState.data.problem }}
                  </p>
                </div>
              </div>

              <!-- 右舱 -->
              <div
                class="ppt-spotlight-pair-pod"
                :class="`is-${spotlightState.data.rightStripeTone || 'measure'}`"
              >
                <header class="ppt-spotlight-pod-header">
                  <span
                    class="ppt-spotlight-pod-stripe"
                    :class="`is-${spotlightState.data.rightStripeTone || 'measure'}`"
                  ></span>
                  <h4 class="ppt-spotlight-pod-title">
                    {{ spotlightState.data.rightTitle || '应对举措' }}
                  </h4>
                </header>
                <div class="ppt-spotlight-pod-content">
                  <p
                    class="ppt-spotlight-content-text is-pair-text"
                    :style="spotlightMeasureStyle"
                  >
                    {{ spotlightState.data.rightContent || spotlightState.data.measure }}
                  </p>
                </div>
              </div>
            </div>

            <!-- B. 单卡片常规放大展示（成本、收益、上个阀点等） -->
            <div v-else class="ppt-spotlight-content-card">
              <p
                class="ppt-spotlight-content-text"
                :style="spotlightContentStyle"
              >
                {{ spotlightState.data.content }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 查看全部交付物清单模态弹窗（全屏内嵌级） -->
    <!-- 查看全部交付物清单模态弹窗（一屏全景紧凑呈现） -->
    <div
      class="ppt-modal-overlay"
      :class="{ 'is-visible': isAllDeliverablesDialogVisible }"
      @click.self="isAllDeliverablesDialogVisible = false"
    >
      <div class="ppt-modal-panel">
        <header class="ppt-modal-header">
          <div class="ppt-modal-title-wrap">
            <span class="ppt-deliverables-bar-stripe"></span>
            <h4 class="ppt-modal-title">
              交付物清单
              <span class="ppt-modal-count-text">(共 {{ deliverableItems.length }} 份)</span>
            </h4>
          </div>
          <button
            type="button"
            class="ppt-modal-close-btn"
            @click="isAllDeliverablesDialogVisible = false"
            title="关闭 (Esc)"
          >
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <div class="ppt-modal-body">
          <div class="ppt-deliverables-dialog-grid">
            <div
              v-for="(item, idx) in deliverableItems"
              :key="`${item.label}-${idx}`"
              class="ppt-deliverable-dialog-item"
              :title="item.label"
            >
              <span class="ppt-dialog-item-idx">{{ String(idx + 1).padStart(2, "0") }}</span>
              <span class="ppt-deliverable-compact-icon">
                <img :src="fileIcon" alt="" />
              </span>
              <span class="ppt-deliverable-dialog-label">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <footer class="ppt-modal-footer">
          <div class="ppt-modal-footer-stat">
            共计 <strong>{{ deliverableItems.length }}</strong> 份会议交付材料文件
          </div>
          <button
            type="button"
            class="committee-display-btn committee-display-btn--primary"
            @click="isAllDeliverablesDialogVisible = false"
          >
            完成
          </button>
        </footer>
      </div>
    </div>

    <!-- 全屏演示专用置顶附件预览弹窗 -->
    <CommitteeFilePreviewDialog
      v-model="localPreviewVisible"
      :file="localPreviewFile"
      :file-name="localPreviewTitle"
    />
  </div>
</template>

<style src="../styles/CommitteeMaterialPresentation.scss" scoped></style>

<style>
/* 全屏汇报演示光标自动隐藏：穿透所有组件、Canvas、SVG、按钮，强制全局隐藏 */
html.is-ppt-cursor-hidden,
html.is-ppt-cursor-hidden *,
body.is-ppt-cursor-hidden,
body.is-ppt-cursor-hidden *,
.ppt-presentation-root.is-cursor-hidden,
.ppt-presentation-root.is-cursor-hidden * {
  cursor: none !important;
}
</style>
