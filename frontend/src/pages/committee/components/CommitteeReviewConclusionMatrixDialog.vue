<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import {
  Close,
  Document,
  FullScreen,
  ScaleToOriginal,
} from "@element-plus/icons-vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import {
  downloadCommitteeAttachment,
  fetchCommitteeAttachments,
  fetchCommitteeReviewRecord,
  fetchCommitteeReviewTaskLatestRecord,
  fetchCommitteeReviewTasks,
} from "@/api/committee";
import type {
  CommitteeAttachment,
  CommitteeMeeting,
  CommitteeMeetingLevel,
  CommitteeReviewContent,
  CommitteeReviewMeetingDetail,
  CommitteeReviewSummary,
  CommitteeReviewTask,
  CommitteeSignal,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import { committeeDepartmentGroupLabel } from "../committee-ui";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import baicGroupLogo from "@/assets/committee/baic-group-logo.png";
import fileIcon from "@/assets/commit/file.png";
import {
  fallbackDeliverableItems,
  fallbackReviewMatrixGroups,
} from "../committee-material-demo";

type ReviewSummaryGroup = CommitteeReviewSummary["groups"][number];
type ReviewSummaryDepartment = ReviewSummaryGroup["departments"][number];

interface DepartmentResolvedSignals {
  techSignal?: CommitteeSignal | string | null;
  revenueSignal?: CommitteeSignal | string | null;
  volumePriceSignal?: CommitteeSignal | string | null;
  competitivenessSignal?: CommitteeSignal | string | null;
  qualitySignal?: CommitteeSignal | string | null;
  conclusionSignal?: CommitteeSignal | string | null;
}

interface MatrixDisplayDepartment {
  key: string;
  label: string;
  departmentId?: string | number;
  taskId?: string | number | null;
}

interface MatrixDimensionRow {
  key: keyof DepartmentResolvedSignals;
  dimension: string;
  isConclusion?: boolean;
}

interface DeliverableItemDisplay {
  label: string;
  file?: CommitteeAttachment | null;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    meetingId?: string | number | null;
    bizCode?: string;
    initialAttachments?: CommitteeAttachment[];
    summary?: CommitteeReviewSummary | null;
    companyName?: string | null;
    meetingLevel?: CommitteeMeetingLevel;
    reviewStatusOptions?: SchemaOption[];
    meeting?:
      | CommitteeMeeting
      | CommitteeReviewMeetingDetail
      | Record<string, any>
      | null;
    projectName?: string | null;
    gateName?: string | null;
    meetingName?: string | null;
    reportDepartment?: string;
  }>(),
  {
    title: "各部室评审结论汇总",
    meetingId: undefined,
    bizCode: "MEETING_MATERIAL",
    initialAttachments: () => [],
    summary: null,
    companyName: undefined,
    meetingLevel: "SECOND",
    reviewStatusOptions: () => [],
    meeting: undefined,
    projectName: undefined,
    gateName: undefined,
    meetingName: undefined,
    reportDepartment: "集团技术与产品管理部",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const router = useRouter();
const isFullscreen = ref(true);
const loading = ref(false);
const signalsCache = ref<Record<string, DepartmentResolvedSignals>>({});
const resolvedTaskMap = ref<Record<string, string | number>>({});

// 1920x1080 自适应舞台比例系统
const stageWidth = 1920;
const stageHeight = 1080;
const stageScale = ref(1);
const dialogStageWrapperRef = ref<HTMLElement | null>(null);
let stageResizeObserver: ResizeObserver | null = null;

// 上会材料与清单状态
const attachments = ref<CommitteeAttachment[]>(
  props.initialAttachments ? [...props.initialAttachments] : [],
);
const attachmentsLoading = ref(false);

// 在线预览弹窗状态
const previewVisible = ref(false);
const previewFile = ref<Blob | null>(null);
const previewTitle = ref("");
let previewRequestId = 0;
let unmounted = false;

const matrixDimensions: MatrixDimensionRow[] = [
  { key: "techSignal", dimension: "技术/费用" },
  { key: "revenueSignal", dimension: "收益" },
  { key: "volumePriceSignal", dimension: "量价" },
  { key: "competitivenessSignal", dimension: "竞争力" },
  { key: "qualitySignal", dimension: "质量" },
  { key: "conclusionSignal", dimension: "结论建议", isConclusion: true },
];

// 顶部标题（仅展示项目名称与阀点）
const displayMeetingTitle = computed(() => {
  const meetingObj = props.meeting as Record<string, unknown> | undefined;
  const projectName = props.projectName || meetingObj?.projectName;
  const gateName = props.gateName || meetingObj?.gateName;

  const parts = [projectName, gateName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return (
    props.meetingName ||
    (props.companyName ? `${props.companyName} 会议` : "各部室评审结论汇总")
  );
});



function updateStageScale() {
  if (typeof window === "undefined") return;
  const container = dialogStageWrapperRef.value;
  const availableW = container?.clientWidth || window.innerWidth;
  const availableH = container?.clientHeight || window.innerHeight;
  if (!availableW || !availableH) return;

  const scaleW = availableW / stageWidth;
  const scaleH = availableH / stageHeight;
  stageScale.value = Math.min(scaleW, scaleH);
}

function startStageResizeObserver() {
  if (typeof ResizeObserver === "undefined") return;
  stageResizeObserver?.disconnect();
  if (dialogStageWrapperRef.value) {
    stageResizeObserver = new ResizeObserver(() => {
      updateStageScale();
    });
    stageResizeObserver.observe(dialogStageWrapperRef.value);
  }
}

function stopStageResizeObserver() {
  stageResizeObserver?.disconnect();
  stageResizeObserver = null;
}

function isTrueFullscreenActive(): boolean {
  return Boolean(
    document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element })
        .webkitFullscreenElement ||
      (document as unknown as { mozFullScreenElement?: Element })
        .mozFullScreenElement ||
      (document as unknown as { msFullscreenElement?: Element })
        .msFullscreenElement,
  );
}

async function enterTrueFullscreen() {
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    if (!isTrueFullscreenActive()) {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
    }
  } catch (err) {
    console.warn("Fullscreen request not permitted or supported", err);
  }
}

async function exitTrueFullscreen() {
  try {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    if (isTrueFullscreenActive()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    }
  } catch (err) {
    console.warn("Exit fullscreen error", err);
  }
}

function handleFullscreenChange() {
  isFullscreen.value = isTrueFullscreenActive();
  void nextTick(updateStageScale);
}

function updateVisible(value: boolean) {
  if (!value && isTrueFullscreenActive()) {
    void exitTrueFullscreen();
  }
  emit("update:modelValue", value);
}

async function toggleFullscreen() {
  if (isFullscreen.value || isTrueFullscreenActive()) {
    await exitTrueFullscreen();
    isFullscreen.value = false;
  } else {
    isFullscreen.value = true;
    await enterTrueFullscreen();
  }
  void nextTick(updateStageScale);
}

function normalizeSignalTone(
  value?: CommitteeSignal | string | null,
): "green" | "yellow" | "red" | "empty" {
  const upper = String(value ?? "").trim().toUpperCase();
  if (upper === "GREEN" || upper === "1" || upper === "PASS" || upper === "通过") {
    return "green";
  }
  if (
    upper === "YELLOW" ||
    upper === "2" ||
    upper === "CONDITIONAL_PASS" ||
    upper === "带条件通过" ||
    upper === "待条件通过"
  ) {
    return "yellow";
  }
  if (upper === "RED" || upper === "3" || upper === "FAIL" || upper === "不通过") {
    return "red";
  }
  return "empty";
}

function getDepartmentSignals(row: ReviewSummaryDepartment): DepartmentResolvedSignals {
  const deptId = String(row.departmentId);
  if (signalsCache.value[deptId]) {
    return signalsCache.value[deptId];
  }

  const rowSource = row as unknown as Record<string, unknown>;
  const recordContent = row.currentRecord?.content;

  return {
    techSignal: (recordContent?.techSignal ?? rowSource.techSignal) as CommitteeSignal | undefined,
    revenueSignal: (recordContent?.revenueSignal ?? rowSource.revenueSignal) as CommitteeSignal | undefined,
    volumePriceSignal: (recordContent?.volumePriceSignal ?? rowSource.volumePriceSignal) as CommitteeSignal | undefined,
    competitivenessSignal: (recordContent?.competitivenessSignal ?? rowSource.competitivenessSignal) as CommitteeSignal | undefined,
    qualitySignal: (recordContent?.qualitySignal ?? rowSource.qualitySignal) as CommitteeSignal | undefined,
    conclusionSignal: (row.conclusionSignal ?? recordContent?.conclusionSignal ?? rowSource.conclusionSignal) as CommitteeSignal | undefined,
  };
}

const allDepartments = computed<ReviewSummaryDepartment[]>(() => {
  return (props.summary?.groups ?? []).flatMap((g) => g.departments);
});

// 判断是否为集团部室
function isGroupDepartment(groupVal?: string | null): boolean {
  const upper = String(groupVal ?? "").trim().toUpperCase();
  return upper === "GROUP" || upper.includes("集团");
}

// 1. 集团部室及管委会办公室：排在第 1 位，完整展示 6 大评审维度
const groupMatrixGroups = computed(() => {
  const groups = (props.summary?.groups ?? []).filter((g) =>
    isGroupDepartment(g.departmentGroup),
  );
  if (!groups.length) {
    const fallbackGroup = fallbackReviewMatrixGroups.find((g) =>
      isGroupDepartment(g.title),
    );
    if (fallbackGroup) {
      return [fallbackGroup];
    }
  }
  return groups.map((group) => {
    const departments: MatrixDisplayDepartment[] = (group.departments ?? []).map(
      (dept, dIdx) => ({
        key: `group-dept-${dept.departmentId ?? dIdx}`,
        label: dept.departmentName || `部室${dIdx + 1}`,
        departmentId: dept.departmentId,
        taskId:
          dept.taskId ??
          dept.currentRecord?.reviewTaskId ??
          resolvedTaskMap.value[String(dept.departmentId)],
      }),
    );

    return {
      title: committeeDepartmentGroupLabel(group.departmentGroup, props.companyName) || "集团部室及管委会办公室",
      count: `${departments.length} 个参评部室`,
      departments,
      rows: matrixDimensions.map((dimension) => {
        const rowData: Record<
          string,
          "green" | "yellow" | "red" | "empty" | string | boolean
        > = {
          key: dimension.key,
          dimension: dimension.dimension,
          isConclusion: Boolean(dimension.isConclusion),
        };

        (group.departments ?? []).forEach((dept, dIdx) => {
          const key = `group-dept-${dept.departmentId ?? dIdx}`;
          const signals = getDepartmentSignals(dept);
          rowData[key] = normalizeSignalTone(signals[dimension.key]);
        });

        return rowData;
      }),
    };
  });
});

// 2. 品牌公司/二级单位（北汽股份、北汽新能源等）：排在第 2 位，紧凑展示结论建议行
const brandMatrixGroups = computed(() => {
  const groups = (props.summary?.groups ?? []).filter(
    (g) => !isGroupDepartment(g.departmentGroup),
  );
  if (!groups.length) {
    const fallbackBrand = fallbackReviewMatrixGroups.find(
      (g) => !isGroupDepartment(g.title),
    );
    if (fallbackBrand) {
      return [fallbackBrand];
    }
  }
  return groups.map((group) => {
    const departments: MatrixDisplayDepartment[] = (group.departments ?? []).map(
      (dept, dIdx) => ({
        key: `brand-dept-${dept.departmentId ?? dIdx}`,
        label: dept.departmentName || `部室${dIdx + 1}`,
        departmentId: dept.departmentId,
        taskId:
          dept.taskId ??
          dept.currentRecord?.reviewTaskId ??
          resolvedTaskMap.value[String(dept.departmentId)],
      }),
    );

    const conclusionRowData: Record<
      string,
      "green" | "yellow" | "red" | "empty" | string | boolean
    > = {
      key: "conclusionSignal",
      dimension: "结论建议",
      isConclusion: true,
    };

    (group.departments ?? []).forEach((dept, dIdx) => {
      const key = `brand-dept-${dept.departmentId ?? dIdx}`;
      const signals = getDepartmentSignals(dept);
      conclusionRowData[key] = normalizeSignalTone(signals.conclusionSignal);
    });

    return {
      title: committeeDepartmentGroupLabel(group.departmentGroup, props.companyName) || "北汽股份",
      count: `${departments.length} 个参评部室`,
      departments,
      rows: [conclusionRowData],
    };
  });
});

// 统一合并为评审矩阵组（品牌公司在上面，集团在下面展示，最下面是材料）
const reviewMatrixGroups = computed(() => [
  ...brandMatrixGroups.value,
  ...groupMatrixGroups.value,
]);

// 3. 上会交付物材料列表
const deliverableItems = computed<DeliverableItemDisplay[]>(() => {
  if (attachments.value && attachments.value.length > 0) {
    return attachments.value.map((att) => ({
      label: att.fileName,
      file: att,
    }));
  }
  const meetingObj = props.meeting as Record<string, unknown> | undefined;
  const gateMaterials =
    (meetingObj?.materials as Array<{ materialName?: string; fileName?: string }>) ??
    ((meetingObj?.currentGate as Record<string, unknown>)?.materials as Array<{
      materialName?: string;
      fileName?: string;
    }>) ??
    [];
  if (gateMaterials.length > 0) {
    return gateMaterials.map((m) => ({
      label: m.materialName || m.fileName || "会议材料文件",
      file: null,
    }));
  }
  return fallbackDeliverableItems.map((item) => ({
    label: item.label,
    file: null,
  }));
});

async function loadMissingSignals(force = false) {
  if (!props.summary?.groups?.length) return;

  const deptsToFetch = allDepartments.value.filter((dept) => {
    const deptId = String(dept.departmentId);
    if (!force && signalsCache.value[deptId]) return false;
    const existing = getDepartmentSignals(dept);
    const hasAnySignal =
      existing.techSignal !== undefined ||
      existing.revenueSignal !== undefined ||
      existing.volumePriceSignal !== undefined ||
      existing.competitivenessSignal !== undefined ||
      existing.qualitySignal !== undefined;
    return !hasAnySignal;
  });

  if (!deptsToFetch.length) return;

  loading.value = true;
  try {
    const fetchPromises = deptsToFetch.map(async (dept) => {
      const deptId = String(dept.departmentId);
      const reviewTaskId = dept.taskId ?? dept.currentRecord?.reviewTaskId;
      const recordId = dept.currentRecord?.id;

      let content: Partial<CommitteeReviewContent> | null | undefined =
        dept.currentRecord?.content;

      if (!content && reviewTaskId) {
        try {
          const taskDetail = await fetchCommitteeReviewTaskLatestRecord(reviewTaskId);
          const taskContent =
            taskDetail?.currentRecord?.content ??
            (taskDetail as { content?: Partial<CommitteeReviewContent> })?.content ??
            taskDetail?.draft;
          if (taskContent) {
            content = taskContent;
          }
        } catch {
          // ignore
        }
      }

      if (!content && recordId) {
        try {
          const recordDetail = await fetchCommitteeReviewRecord(recordId);
          if (recordDetail?.content) {
            content = recordDetail.content;
          }
        } catch {
          // ignore
        }
      }

      const currentCached = signalsCache.value[deptId] || {};
      signalsCache.value[deptId] = {
        techSignal:
          content?.techSignal ??
          currentCached.techSignal ??
          (dept as any).techSignal,
        revenueSignal:
          content?.revenueSignal ??
          currentCached.revenueSignal ??
          (dept as any).revenueSignal,
        volumePriceSignal:
          content?.volumePriceSignal ??
          currentCached.volumePriceSignal ??
          (dept as any).volumePriceSignal,
        competitivenessSignal:
          content?.competitivenessSignal ??
          currentCached.competitivenessSignal ??
          (dept as any).competitivenessSignal,
        qualitySignal:
          content?.qualitySignal ??
          currentCached.qualitySignal ??
          (dept as any).qualitySignal,
        conclusionSignal:
          dept.conclusionSignal ??
          content?.conclusionSignal ??
          currentCached.conclusionSignal,
      };
    });

    await Promise.all(fetchPromises);
  } catch (err) {
    console.warn("loadMissingSignals failed", err);
  } finally {
    loading.value = false;
  }
}

async function loadAttachments() {
  const meetingId =
    props.meetingId ||
    props.meeting?.id ||
    (props.meeting as Record<string, any>)?.meetingId;
  if (!meetingId) {
    attachments.value = props.initialAttachments ?? [];
    return;
  }
  attachmentsLoading.value = true;
  try {
    const remoteFiles = await fetchCommitteeAttachments(
      props.bizCode,
      String(meetingId),
    );
    attachments.value = remoteFiles;
  } catch {
    attachments.value = props.initialAttachments ?? [];
  } finally {
    attachmentsLoading.value = false;
  }
}

async function previewAttachment(file: CommitteeAttachment) {
  const requestId = ++previewRequestId;
  previewFile.value = null;
  previewTitle.value = file.fileName;
  previewVisible.value = true;
  try {
    if (file.fileUrl) {
      if (unmounted || requestId !== previewRequestId) return;
      const resp = await globalThis.fetch(file.fileUrl);
      if (!resp.ok) throw new Error("附件下载失败");
      previewFile.value = await resp.blob();
      return;
    }
    const response = await downloadCommitteeAttachment(file.id);
    if (unmounted || requestId !== previewRequestId) return;
    const rawData = (response as any)?.data ?? response;
    previewFile.value = rawData instanceof Blob ? rawData : new Blob([rawData]);
  } catch {
    if (!unmounted && requestId === previewRequestId) {
      previewVisible.value = false;
      BaseToast.error("获取附件预览失败");
    }
  }
}

function handleDeliverableClick(item: DeliverableItemDisplay) {
  if (item.file) {
    void previewAttachment(item.file);
    return;
  }
  const matched = attachments.value.find(
    (att) =>
      att.fileName === item.label ||
      att.fileName.includes(item.label) ||
      item.label.includes(att.fileName),
  );
  if (matched) {
    void previewAttachment(matched);
    return;
  }
  if (attachments.value.length > 0) {
    void previewAttachment(attachments.value[0]);
    return;
  }
  previewTitle.value = item.label;
  previewFile.value = new Blob(
    [`【会议交付材料】\n文件名：${item.label}\n交付状态：已完成上会交付并评审`],
    { type: "text/plain;charset=utf-8" },
  );
  previewVisible.value = true;
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
    window.open(href, "_blank");
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

function resolveCurrentGateId(): string | number | undefined {
  const meetingObj = props.meeting as Record<string, any> | undefined;
  return (
    props.summary?.gateId ||
    meetingObj?.gateId ||
    meetingObj?.currentGateId ||
    (meetingObj?.currentGate as { id?: string | number } | undefined)?.id
  );
}

async function prefetchTasks() {
  const gateId = resolveCurrentGateId();
  if (!gateId) return;
  try {
    const result = await fetchCommitteeReviewTasks({ gateId: String(gateId) });
    const list: CommitteeReviewTask[] = Array.isArray(result)
      ? result
      : (result as any)?.rows || (result as any)?.list || [];
    list.forEach((t) => {
      if (t.departmentId && t.id) {
        resolvedTaskMap.value[String(t.departmentId)] = t.id;
      }
    });
  } catch (err) {
    console.warn("Prefetch review tasks failed", err);
  }
}

async function handleOpenTask(
  taskId?: string | number | null,
  department?: MatrixDisplayDepartment,
) {
  let targetTaskId =
    (taskId ?? undefined) ||
    (department?.taskId ?? undefined) ||
    (department?.departmentId
      ? resolvedTaskMap.value[String(department.departmentId)]
      : undefined);

  if (!targetTaskId && department?.departmentId) {
    const gateId = resolveCurrentGateId();
    if (gateId) {
      try {
        const result = await fetchCommitteeReviewTasks({
          gateId: String(gateId),
          departmentId: String(department.departmentId),
        });
        const list: CommitteeReviewTask[] = Array.isArray(result)
          ? result
          : (result as any)?.rows || (result as any)?.list || [];
        if (list.length > 0 && list[0]?.id) {
          targetTaskId = list[0].id;
          resolvedTaskMap.value[String(department.departmentId)] = targetTaskId;
        }
      } catch (err) {
        console.warn("Fetch review task failed", err);
      }
    }
  }

  if (!targetTaskId) {
    BaseToast.warning(
      `未获取到${department?.label ? `【${department.label}】` : ""}对应的阀点评审详情`,
    );
    return;
  }

  openInNewWindow({
    name: "committeeReviewDetail",
    params: { taskId: String(targetTaskId) },
  });
}

function handleKeydown() {
  // 无子弹窗时交给原生 Esc 处理关闭
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      isFullscreen.value = true;
      void enterTrueFullscreen();
      void loadMissingSignals();
      void loadAttachments();
      void prefetchTasks();
      void nextTick(() => {
        updateStageScale();
        startStageResizeObserver();
      });
    } else {
      stopStageResizeObserver();
      if (isTrueFullscreenActive()) {
        void exitTrueFullscreen();
      }
    }
  },
);

watch(
  () => props.summary,
  () => {
    if (props.modelValue) {
      void prefetchTasks();
    }
  },
  { immediate: true },
);

watch(
  () => [props.meetingId, props.bizCode],
  () => {
    if (props.modelValue) {
      void loadAttachments();
    }
  },
);

function setupFullscreenEvents() {
  teardownFullscreenEvents();
  window.addEventListener("resize", updateStageScale);
  window.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);
}

function teardownFullscreenEvents() {
  window.removeEventListener("resize", updateStageScale);
  window.removeEventListener("keydown", handleKeydown, true);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
  document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
}

function deactivateConclusionDialog() {
  stopStageResizeObserver();
  previewRequestId += 1;
  previewFile.value = null;
  previewVisible.value = false;
  teardownFullscreenEvents();
  if (isTrueFullscreenActive()) {
    void exitTrueFullscreen();
  }
  if (props.modelValue) emit("update:modelValue", false);
}

onMounted(() => {
  setupFullscreenEvents();
  if (props.modelValue) {
    void nextTick(() => {
      updateStageScale();
      startStageResizeObserver();
    });
  }
});

onActivated(() => {
  setupFullscreenEvents();
  if (props.modelValue) {
    void nextTick(() => {
      updateStageScale();
      startStageResizeObserver();
    });
  }
});

onDeactivated(deactivateConclusionDialog);

onBeforeUnmount(() => {
  unmounted = true;
  deactivateConclusionDialog();
});
</script>

<template>
  <BaseFormDialog
    :model-value="modelValue"
    :title="title"
    :width="isFullscreen ? '100vw' : 'min(1560px, 96vw)'"
    :top="isFullscreen ? '0' : '2.5vh'"
    :show-footer="false"
    :show-close="false"
    class="committee-conclusion-matrix-dialog"
    :class="{ 'is-fullscreen': isFullscreen }"
    destroy-on-close
    @update:model-value="updateVisible"
  >
    <!-- 舞台自适应居中容器 -->
    <div
      v-loading="loading"
      ref="dialogStageWrapperRef"
      class="ppt-dialog-stage-wrapper"
      :class="{ 'is-fullscreen-stage': isFullscreen }"
    >
      <div
        class="ppt-stage"
        :style="{
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
          transform: `scale(${stageScale})`,
          transformOrigin: 'center center',
        }"
      >
        <div class="ppt-slide-card ppt-dialog-slide-card">
          <div class="ppt-slide-inner ppt-standard-layout">
            <!-- 1. 统一页眉（北汽集团 PPT 标准头） -->
            <header class="ppt-slide-header">
              <div class="ppt-slide-header__left">
                <img
                  class="ppt-slide-header__logo"
                  :src="baicGroupLogo"
                  alt="北汽集团"
                />
                <div class="ppt-slide-header__divider" />
                <span class="ppt-slide-header__meeting-title">
                  {{ displayMeetingTitle }}
                </span>
<!--                <span v-if="currentGateName" class="ppt-slide-header__gate-tag">-->
<!--                  {{ currentGateName }}-->
<!--                </span>-->
              </div>
              <div class="ppt-slide-header__right">
<!--                <span class="ppt-slide-header__section-num">04</span>-->
<!--                <div class="ppt-slide-header__title-group">-->
<!--                  <h3 class="ppt-slide-header__section-title">-->
<!--                    评审结论与交付物清单-->
<!--                  </h3>-->
<!--                </div>-->
                <!-- 右侧窗口操作区：全屏/还原 & 关闭 -->
                <div class="ppt-dialog-actions">
                  <button
                    type="button"
                    class="ppt-dialog-action-btn"
                    :title="isFullscreen ? '退出全屏' : '全屏展示'"
                    @click="toggleFullscreen"
                  >
                    <el-icon><component :is="isFullscreen ? ScaleToOriginal : FullScreen" /></el-icon>
                  </button>
                  <button
                    type="button"
                    class="ppt-dialog-action-btn is-close"
                    title="关闭 (Esc)"
                    @click="updateVisible(false)"
                  >
                    <el-icon><Close /></el-icon>
                  </button>
                </div>
              </div>
            </header>

            <!-- 2. 统一主体（04 评审结论与交付物清单） -->
            <main class="ppt-slide-body">
              <div class="ppt-body-deliverables">
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
                          <span class="ppt-matrix-bar-stripe" />
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
                              :key="String(row.dimension)"
                              :class="{
                                'is-conclusion-tr': row.isConclusion || row.dimension === '结论建议',
                              }"
                            >
                              <td class="ppt-td-dim">
                                <span class="ppt-dim-name">{{ row.dimension }}</span>
                              </td>
                              <td
                                v-for="department in group.departments"
                                :key="department.key"
                                class="ppt-td-val"
                                :class="{ 'is-clickable-cell': row[department.key] !== 'empty' }"
                                @click="row[department.key] !== 'empty' && handleOpenTask(department.taskId, department)"
                              >
                                <span
                                  v-if="row[department.key] !== 'empty'"
                                  class="ppt-matrix-signal-dot"
                                  :class="[
                                    `is-${row[department.key]}`,
                                    {
                                      'is-conclusion-dot': row.isConclusion || row.dimension === '结论建议',
                                      'is-clickable': true,
                                    },
                                  ]"
                                  :title="`点击查看【${department.label}】阀点评审详情`"
                                />
                                <span v-else class="ppt-matrix-empty-dash">--</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                <!-- 3. 页面最下方区块：交付物清单（全部直接平铺展示） -->
                <div class="ppt-deliverables-panel">
                  <header class="ppt-deliverables-panel-header">
                    <div class="ppt-deliverables-bar-left">
                      <span class="ppt-deliverables-bar-stripe" />
                      <span class="ppt-deliverables-bar-title">上会材料</span>
                      <span v-if="deliverableItems.length > 0" class="ppt-deliverables-bar-count">
                        (共 {{ deliverableItems.length }} 份)
                      </span>
                    </div>
                  </header>
                  <div class="ppt-deliverables-panel-body">
                    <div v-if="deliverableItems.length > 0" class="ppt-deliverables-flow">
                      <!-- 全部交付物直接平铺展示 -->
                      <div
                        v-for="item in deliverableItems"
                        :key="item.label"
                        class="ppt-deliverable-chip"
                        :title="item.file ? `点击在线预览：${item.label}` : item.label"
                        @click="handleDeliverableClick(item)"
                      >
                        <span class="ppt-deliverable-chip-icon">
                          <img :src="fileIcon" alt="" />
                        </span>
                        <span class="ppt-deliverable-chip-text">{{ item.label }}</span>
                      </div>
                    </div>
                    <div v-else class="ppt-attachment-empty">
                      <el-icon class="ppt-attachment-empty-icon"><Document /></el-icon>
                      <span class="ppt-attachment-empty-text">当前议题暂无交付物清单</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

            <!-- 4. 统一页脚 -->
<!--            <footer class="ppt-slide-footer">-->
<!--              <div class="ppt-slide-footer__left">-->
<!--                <span>{{ reportDepartment || "集团技术与产品管理部" }}</span>-->
<!--              </div>-->
<!--              <div class="ppt-slide-footer__right">-->
<!--                <span class="ppt-slide-footer__page">05 / 10</span>-->
<!--              </div>-->
<!--            </footer>-->
          </div>
        </div>
      </div>
    </div>

    <!-- 附件在线预览弹窗 -->
    <CommitteeFilePreviewDialog
      v-model="previewVisible"
      :file="previewFile"
      :file-name="previewTitle"
    />
  </BaseFormDialog>
</template>

<style src="../styles/CommitteeMaterialPresentation.scss" scoped></style>

<style lang="scss" scoped>
.ppt-dialog-stage-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  background: transparent;
  box-sizing: border-box;

  &.is-fullscreen-stage {
    background: radial-gradient(circle at 50% 40%, #112847 0%, #081424 100%);
  }
}

.ppt-stage {
  width: 1920px;
  height: 1080px;
  flex-shrink: 0;
  position: relative;
  box-sizing: border-box;
}

.ppt-dialog-slide-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f4f8fc 0%, #ffffff 100%);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.24);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  border: 1px solid #dce8f5;
}

.ppt-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 18px;
  padding-left: 18px;
  border-left: 1px solid #dce6f0;
}

.ppt-dialog-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid #d5e3f2;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;

  &:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
    transform: translateY(-1px);
  }

  &.is-close:hover {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #dc2626;
  }
}

.is-clickable {
  cursor: pointer;
}

.is-clickable-cell {
  cursor: pointer;
  transition: background-color 0.18s ease;

  &:hover {
    background-color: rgba(37, 99, 235, 0.05) !important;
  }
}

.ppt-matrix-signal-dot.is-clickable {
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;

  &:hover {
    transform: scale(1.3);
  }
}

.ppt-deliverables-bar-count {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  margin-left: 6px;
}

.ppt-deliverable-chip {
  cursor: pointer !important;
}

.ppt-deliverables-panel-body {
  overflow-y: auto !important;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.4);
    border-radius: 3px;
  }
}

.ppt-attachment-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 24px 0;
  color: #94a3b8;
  font-size: 14px;
}

.ppt-attachment-empty-icon {
  font-size: 18px;
  color: #cbd5e1;
}

:global(.base-form-dialog.committee-conclusion-matrix-dialog) {
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  overflow: hidden !important;
  border: none !important;
  box-shadow: none !important;
}

:global(.base-form-dialog.committee-conclusion-matrix-dialog .el-dialog__header) {
  display: none !important;
}

:global(.base-form-dialog.committee-conclusion-matrix-dialog .el-dialog__body) {
  padding: 0 !important;
  margin: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  background: transparent !important;
}

:global(.base-form-dialog.committee-conclusion-matrix-dialog.is-fullscreen) {
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  margin: 0 !important;
  border-radius: 0 !important;
  background: #081424 !important;

  .el-dialog__body {
    background: #081424 !important;
  }
}

:global(.base-form-dialog.committee-conclusion-matrix-dialog:not(.is-fullscreen)) {
  width: min(1560px, 92vw, calc(88vh * 16 / 9)) !important;
  height: calc(min(1560px, 92vw, calc(88vh * 16 / 9)) * 9 / 16) !important;
  max-height: 88vh !important;
  margin: calc((100vh - (min(1560px, 92vw, calc(88vh * 16 / 9)) * 9 / 16)) / 2) auto 0 !important;
  border-radius: 16px !important;
  background: transparent !important;
  box-shadow: none !important;
}

:global(.base-form-dialog.committee-conclusion-matrix-dialog:not(.is-fullscreen) .el-dialog__body) {
  height: 100% !important;
  max-height: 100% !important;
  border-radius: 16px !important;
  background: transparent !important;
}
</style>
