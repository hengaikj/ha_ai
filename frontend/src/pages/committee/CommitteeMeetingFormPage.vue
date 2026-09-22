<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { Back } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import { ApiBusinessError } from "@/api/http";
import {
  createCommitteeMeeting,
  fetchCommitteeConclusions,
  fetchCommitteeGateMeetings,
  fetchCommitteeMeeting,
  fetchCommitteeProject,
  fetchCommitteeProjects,
  updateCommitteeMeeting,
} from "@/api/committee";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { replaceBrowserLocation } from "@/utils/browser-navigation";
import { formatDate, formatDateTime } from "@/utils/formatters";
import type {
  CommitteeConclusion,
  CommitteeGate,
  CommitteeMeeting,
  CommitteeMeetingCreateCommand,
  CommitteeMeetingLevel,
  CommitteeMeetingUpdateCommand,
  CommitteeProject,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";

type GateDisplay = Pick<CommitteeGate, "id" | "gateName" | "gatePurpose">;
type EditingLinkedContext = Pick<
  CommitteeMeeting,
  "projectId" | "gateId" | "linkedSecondMeetingId" | "linkedSecondConclusionId"
>;
type AdmissionState =
  | "IDLE"
  | "LOADING"
  | "NO_GATE"
  | "GATE_IN_PROGRESS"
  | "NO_MEETING"
  | "NO_EFFECTIVE_CONCLUSION"
  | "CONCLUSION_REJECTED"
  | "READY"
  | "LOAD_FAILED";

interface MeetingFormModel {
  meetingType: "PRODUCT_COMMITTEE" | "GATE_REVIEW";
  projectId: string;
  gateId: string;
  linkedSecondMeetingId: string;
  linkedSecondConclusionId: string;
  meetingTime: string;
  reviewDeadlineTime: string;
  meetingLocation: string;
  meetingHost: string;
  remark: string;
  changeReason: string;
  expectedLockVersion: number;
}

type ErrorInfo = { code: string; message: string; traceId?: string };

const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
function resolveRouteLevel(): CommitteeMeetingLevel {
  const routeLevel = String(route.params.level ?? "").toUpperCase();
  if (routeLevel === "GROUP" || route.path.includes("/meetings/group/")) {
    return "GROUP";
  }
  return "SECOND";
}
const level = computed<CommitteeMeetingLevel>(resolveRouteLevel);
const parentPath = computed(() =>
  level.value === "GROUP"
    ? "/committee/meetings/group"
    : "/committee/meetings/second",
);
const editing = computed(() => Boolean(route.params.meetingId));
const initialLoading = ref(true);
const saving = ref(false);
const linkedContextLoading = ref(false);
const projectOptionsLoading = ref(false);
const projects = ref<
  Array<Pick<CommitteeProject, "projectId" | "projectName">>
>([]);
const selectedGate = ref<GateDisplay | null>(null);
const linkedSecondMeeting = ref<CommitteeMeeting | null>(null);
const currentSecondConclusion = ref<CommitteeConclusion | null>(null);
const conclusionDecisionOptions = ref<SchemaOption[]>([]);
const admissionState = ref<AdmissionState>("IDLE");
const loadError = ref<ErrorInfo>();
const linkedContextError = ref<ErrorInfo>();
const projectContextError = ref<ErrorInfo>();
const projectSearchError = ref<ErrorInfo>();
const saveError = ref<ErrorInfo>();
const initialReviewDeadlineTime = ref("");
const editingMeetingStatus = ref("");
let componentActive = true;
let loadRequestSequence = 0;
let contextRequestSequence = 0;
let projectSearchRequestSequence = 0;
let submitRequestSequence = 0;
let lastProjectSearchKeyword = "";

function emptyMeetingForm(): MeetingFormModel {
  return {
    meetingType: "PRODUCT_COMMITTEE",
    projectId: "",
    gateId: "",
    linkedSecondMeetingId: "",
    linkedSecondConclusionId: "",
    meetingTime: "",
    reviewDeadlineTime: "",
    meetingLocation: "",
    meetingHost: "",
    remark: "",
    changeReason: "",
    expectedLockVersion: 0,
  };
}

const form = reactive<MeetingFormModel>(emptyMeetingForm());

const submitLabel = computed(() =>
  level.value === "GROUP" ? "保存集团会议" : "保存品牌公司会议",
);
const formLabelWidth = computed(() =>
  level.value === "GROUP" ? "150px" : "120px",
);
const currentGateLabel = computed(() => {
  if (!selectedGate.value) return "";
  const purpose = selectedGate.value.gatePurpose?.trim();
  return purpose
    ? `${selectedGate.value.gateName} · ${purpose}`
    : selectedGate.value.gateName;
});
const linkedSecondMeetingLabel = computed(() => {
  if (linkedContextError.value && form.linkedSecondMeetingId) {
    return `关联会议 #${form.linkedSecondMeetingId}（关联信息加载失败）`;
  }
  const meeting = linkedSecondMeeting.value;
  return meeting
    ? `${meeting.meetingName}（第 ${meeting.attemptNo} 次）`
    : "未上会";
});
const linkedSecondConclusionLabel = computed(() => {
  if (linkedContextError.value && form.linkedSecondConclusionId) {
    return `结论 #${form.linkedSecondConclusionId}（关联信息加载失败）`;
  }
  const decision =
    linkedSecondMeeting.value?.currentConclusionDecision ??
    currentSecondConclusion.value?.decision;
  if (!decision) return "未形成有效结论";
  return (
    conclusionDecisionOptions.value.find(
      (item) => String(item.value) === String(decision),
    )?.label ?? decision
  );
});
const editingConcluded = computed(
  () => editing.value && editingMeetingStatus.value === "CONCLUDED",
);
const editingReadOnly = computed(
  () =>
    editing.value &&
    Boolean(editingMeetingStatus.value) &&
    !["PREPARING", "READY", "CUTOFF_LOCKED", "CONCLUDED", "REVISING"].includes(
      editingMeetingStatus.value,
    ),
);
const formUnavailable = computed(
  () => initialLoading.value || Boolean(loadError.value),
);
const submitDisabled = computed(
  () =>
    initialLoading.value ||
    saving.value ||
    Boolean(loadError.value) ||
    Boolean(projectContextError.value) ||
    editingReadOnly.value,
);
function dateValue(value: unknown): string {
  const formatted = formatDate(value as string | null | undefined);
  return formatted === "--" ? "" : formatted;
}

function meetingDateTimeValue(value: unknown): string {
  const formatted = formatDateTime(value as string | null | undefined);
  return formatted === "--" ? "" : formatted;
}

const defaultMeetingTime = new Date(2000, 0, 1, 0, 0, 0);
const disabledMeetingMinutes = () =>
  Array.from({ length: 60 }, (_, minute) => minute);

function normalizeMeetingHour(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2})(?::\d{2}(?::\d{2})?)?$/);
  return match ? `${match[1]} ${match[2]}:00:00` : value;
}

function todayValue(): string {
  return formatDate(new Date());
}

function futureTimeError(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(value) ||
    value.slice(0, 10) <= todayValue()
  ) {
    return new Error("会议时间必须晚于今天");
  }
  const linkedMeetingTime = meetingDateTimeValue(
    linkedSecondMeeting.value?.meetingTime,
  );
  if (
    level.value === "GROUP" &&
    linkedMeetingTime &&
    value.slice(0, 16) < linkedMeetingTime.slice(0, 16)
  ) {
    return new Error("集团会议时间不能早于关联品牌公司会议时间");
  }
}

function groupMeetingDisabledDate(date: Date) {
  const linkedMeetingTime = dateValue(linkedSecondMeeting.value?.meetingTime);
  if (level.value !== "GROUP" || !linkedMeetingTime) {
    return false;
  }
  return dateValue(date) < linkedMeetingTime;
}

function reviewDeadlineError(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(value)
  ) {
    return;
  }
  if (value.slice(0, 10) < todayValue()) {
    return new Error("评审截止时间不能早于今天");
  }
  if (form.meetingTime && value.slice(0, 16) > form.meetingTime.slice(0, 16)) {
    return new Error("评审截止时间不能晚于会议时间");
  }
}

function normalizeError(
  unknownError: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): ErrorInfo {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }
  return { code: fallbackCode, message: fallbackMessage, traceId: "unknown" };
}

const formRules: FormRules<MeetingFormModel> = {
  projectId: [{ required: true, message: "请选择关联项目", trigger: "change" }],
  gateId: [{ required: true, message: "当前阀点不能为空", trigger: "change" }],
  meetingTime: [
    { required: true, message: "请选择会议时间", trigger: "change" },
    {
      validator: (_rule, value, callback) => callback(futureTimeError(value)),
      trigger: "change",
    },
  ],
  reviewDeadlineTime: [
    { required: true, message: "请选择审批截止时间", trigger: "change" },
    {
      validator: (_rule, value, callback) =>
        callback(reviewDeadlineError(value)),
      trigger: "change",
    },
  ],
  remark: [{ max: 500, message: "备注不能超过 500 个字符", trigger: "change" }],
  // changeReason: [
  //   { max: 1000, message: "修改原因不能超过 1000 个字符", trigger: "change" },
  //   {
  //     validator: (_rule, value, callback) => callback(changeReasonError(value)),
  //     trigger: "change",
  //   },
  // ],
};

function clearDerivedState() {
  selectedGate.value = null;
  linkedSecondMeeting.value = null;
  currentSecondConclusion.value = null;
  form.gateId = "";
  form.linkedSecondMeetingId = "";
  form.linkedSecondConclusionId = "";
}

interface MeetingRouteSnapshot {
  key: string;
  level: CommitteeMeetingLevel;
  meetingId: string;
}

function readRouteSnapshot(): MeetingRouteSnapshot {
  const routeLevel = resolveRouteLevel();
  const meetingId = route.params.meetingId
    ? String(route.params.meetingId)
    : "";
  return {
    key: `${routeLevel}:${meetingId || "create"}`,
    level: routeLevel,
    meetingId,
  };
}

function isCurrentRoute(routeKey: string) {
  return componentActive && readRouteSnapshot().key === routeKey;
}

function isCurrentLoad(requestSequence: number, routeKey: string) {
  return requestSequence === loadRequestSequence && isCurrentRoute(routeKey);
}

function isCurrentContext(requestSequence: number, routeKey: string) {
  return requestSequence === contextRequestSequence && isCurrentRoute(routeKey);
}

function isCurrentSubmit(requestSequence: number, routeKey: string) {
  return requestSequence === submitRequestSequence && isCurrentRoute(routeKey);
}

function isCurrentProjectSearch(requestSequence: number, routeKey: string) {
  return (
    requestSequence === projectSearchRequestSequence && isCurrentRoute(routeKey)
  );
}

function resetRouteState() {
  ++contextRequestSequence;
  ++projectSearchRequestSequence;
  ++submitRequestSequence;
  initialLoading.value = true;
  saving.value = false;
  linkedContextLoading.value = false;
  projectOptionsLoading.value = false;
  projects.value = [];
  loadError.value = undefined;
  linkedContextError.value = undefined;
  projectContextError.value = undefined;
  projectSearchError.value = undefined;
  saveError.value = undefined;
  initialReviewDeadlineTime.value = "";
  editingMeetingStatus.value = "";
  lastProjectSearchKeyword = "";
  admissionState.value = "IDLE";
  Object.assign(form, emptyMeetingForm());
  clearDerivedState();
  formRef.value?.clearValidate?.();
}

function latestConcludedSecondMeeting(
  meetings: CommitteeMeeting[],
  projectId: string,
  gateId: string,
) {
  return meetings
    .filter(
      (meeting) =>
        meeting.meetingLevel === "SECOND" &&
        meeting.meetingStatus === "CONCLUDED" &&
        String(meeting.projectId) === projectId &&
        String(meeting.gateId) === gateId,
    )
    .sort(
      (left, right) =>
        Number(right.attemptNo ?? 0) - Number(left.attemptNo ?? 0) ||
        Date.parse(right.meetingTime) - Date.parse(left.meetingTime),
    )[0];
}

function latestSecondMeeting(
  meetings: CommitteeMeeting[],
  projectId: string,
  gateId: string,
) {
  return meetings
    .filter(
      (meeting) =>
        meeting.meetingLevel === "SECOND" &&
        String(meeting.projectId) === projectId &&
        String(meeting.gateId) === gateId,
    )
    .sort(
      (left, right) =>
        Number(right.attemptNo ?? 0) - Number(left.attemptNo ?? 0) ||
        Date.parse(right.meetingTime) - Date.parse(left.meetingTime),
    )[0];
}

function resolveCurrentConclusion(
  meeting: CommitteeMeeting,
  conclusions: CommitteeConclusion[],
) {
  if (!meeting.currentConclusionId) return null;
  return (
    conclusions.find(
      (item) => String(item.id) === String(meeting.currentConclusionId),
    ) ?? null
  );
}

async function loadCreateProjectContext(projectId: string) {
  const routeSnapshot = readRouteSnapshot();
  const requestSequence = ++contextRequestSequence;
  projectContextError.value = undefined;
  clearDerivedState();
  admissionState.value =
    projectId && routeSnapshot.level === "GROUP" ? "LOADING" : "IDLE";
  if (!projectId) return;

  try {
    const detail = await fetchCommitteeProject(projectId);
    if (!isCurrentContext(requestSequence, routeSnapshot.key)) return;
    const gate = detail.currentGate;
    if (!gate) {
      admissionState.value =
        routeSnapshot.level === "GROUP" ? "NO_GATE" : "IDLE";
      return;
    }

    if (routeSnapshot.level === "SECOND") {
      selectedGate.value = gate;
      form.gateId = String(gate.id);
      return;
    }

    const history = await fetchCommitteeGateMeetings(
      projectId,
      String(gate.id),
    );
    if (!isCurrentContext(requestSequence, routeSnapshot.key)) return;
    const latestMeeting = latestSecondMeeting(
      history.second,
      projectId,
      String(gate.id),
    );
    const meeting = latestConcludedSecondMeeting(
      history.second,
      projectId,
      String(gate.id),
    );
    if (!meeting) {
      selectedGate.value = gate;
      linkedSecondMeeting.value = latestMeeting ?? null;
      form.gateId = String(gate.id);
      admissionState.value =
        gate.gateStatus === "IN_PROGRESS" ? "GATE_IN_PROGRESS" : "NO_MEETING";
      return;
    }

    const conclusions = await fetchCommitteeConclusions(meeting.id);
    if (!isCurrentContext(requestSequence, routeSnapshot.key)) return;
    const conclusion = resolveCurrentConclusion(meeting, conclusions);
    selectedGate.value = gate;
    linkedSecondMeeting.value = meeting;
    currentSecondConclusion.value = conclusion;
    form.gateId = String(gate.id);

    if (!conclusion || conclusion.conclusionStatus !== "EFFECTIVE") {
      form.linkedSecondMeetingId = "";
      form.linkedSecondConclusionId = "";
      admissionState.value =
        gate.gateStatus === "IN_PROGRESS"
          ? "GATE_IN_PROGRESS"
          : "NO_EFFECTIVE_CONCLUSION";
      return;
    }
    if (!["PASS", "CONDITIONAL_PASS"].includes(conclusion.decision)) {
      form.linkedSecondMeetingId = "";
      form.linkedSecondConclusionId = "";
      admissionState.value =
        gate.gateStatus === "IN_PROGRESS"
          ? "GATE_IN_PROGRESS"
          : "CONCLUSION_REJECTED";
      return;
    }
    form.linkedSecondMeetingId = meeting.id;
    form.linkedSecondConclusionId = conclusion.id;
    admissionState.value = "READY";
  } catch (error) {
    if (!isCurrentContext(requestSequence, routeSnapshot.key)) return;
    clearDerivedState();
    admissionState.value =
      routeSnapshot.level === "GROUP" ? "LOAD_FAILED" : "IDLE";
    projectContextError.value = normalizeError(
      error,
      "COMMITTEE_PROJECT_CONTEXT_LOAD_FAILED",
      "项目会议条件加载失败，请稍后重试",
    );
  }
}

function retryProjectContext() {
  if (form.projectId) {
    void loadCreateProjectContext(form.projectId);
  }
}

async function loadEditingContext(
  meeting: CommitteeMeeting,
  routeSnapshot: MeetingRouteSnapshot,
  requestSequence: number,
) {
  if (!isCurrentLoad(requestSequence, routeSnapshot.key)) return;
  const fallbackGate: GateDisplay = {
    id: meeting.gateId,
    gateName: meeting.gateName,
    gatePurpose: null,
  };
  selectedGate.value = fallbackGate;
  try {
    const detail = await fetchCommitteeProject(String(meeting.projectId));
    if (!isCurrentLoad(requestSequence, routeSnapshot.key)) return;
    const meetingGate = [detail.currentGate, ...detail.gateHistory].find(
      (gate) => gate && String(gate.id) === String(meeting.gateId),
    );
    if (meetingGate) {
      selectedGate.value = meetingGate;
    }
  } catch {
    if (!isCurrentLoad(requestSequence, routeSnapshot.key)) return;
    // 会议详情中的项目和阀点仍可只读展示，不伪造项目详情。
  }

  if (routeSnapshot.level !== "GROUP" || !meeting.linkedSecondMeetingId) return;
  await loadEditingLinkedContext(meeting, () =>
    isCurrentLoad(requestSequence, routeSnapshot.key),
  );
}

async function loadEditingLinkedContext(
  meeting: EditingLinkedContext,
  isCurrent: () => boolean,
) {
  const linkedSecondMeetingId = meeting.linkedSecondMeetingId;
  if (!linkedSecondMeetingId) return;
  const history = await fetchCommitteeGateMeetings(
    String(meeting.projectId),
    String(meeting.gateId),
  );
  if (!isCurrent()) return;
  linkedSecondMeeting.value =
    history.second.find(
      (item) => String(item.id) === String(linkedSecondMeetingId),
    ) ?? null;

  const conclusions = await fetchCommitteeConclusions(linkedSecondMeetingId);
  if (!isCurrent()) return;
  currentSecondConclusion.value =
    conclusions.find(
      (item) => String(item.id) === String(meeting.linkedSecondConclusionId),
    ) ?? null;
}

async function retryLinkedContext() {
  const routeSnapshot = readRouteSnapshot();
  if (
    routeSnapshot.level !== "GROUP" ||
    !routeSnapshot.meetingId ||
    !form.linkedSecondMeetingId
  ) {
    return;
  }

  const requestSequence = ++contextRequestSequence;
  linkedContextLoading.value = true;
  try {
    await loadEditingLinkedContext(
      {
        projectId: form.projectId,
        gateId: form.gateId,
        linkedSecondMeetingId: form.linkedSecondMeetingId,
        linkedSecondConclusionId: form.linkedSecondConclusionId,
      },
      () => isCurrentContext(requestSequence, routeSnapshot.key),
    );
    if (!isCurrentContext(requestSequence, routeSnapshot.key)) return;
    linkedContextError.value = undefined;
  } catch (error) {
    if (!isCurrentContext(requestSequence, routeSnapshot.key)) return;
    linkedContextError.value = normalizeError(
      error,
      "COMMITTEE_MEETING_CONTEXT_LOAD_FAILED",
      "会议关联信息加载失败，请稍后重试",
    );
  } finally {
    if (isCurrentContext(requestSequence, routeSnapshot.key)) {
      linkedContextLoading.value = false;
    }
  }
}

async function searchProjects(keyword: string, preserveError = false) {
  const routeSnapshot = readRouteSnapshot();
  if (routeSnapshot.meetingId) return;
  const normalizedKeyword = keyword.trim();
  const requestSequence = ++projectSearchRequestSequence;
  lastProjectSearchKeyword = normalizedKeyword;
  if (!preserveError) {
    projectSearchError.value = undefined;
  }
  projectOptionsLoading.value = true;
  try {
    const result = await fetchCommitteeProjects({
      pageNum: 1,
      pageSize: 50,
      ...(normalizedKeyword ? { projectName: normalizedKeyword } : {}),
    });
    if (!isCurrentProjectSearch(requestSequence, routeSnapshot.key)) return;
    projectSearchError.value = undefined;
    const selectedProject = projects.value.find(
      (item) => String(item.projectId) === form.projectId,
    );
    projects.value =
      selectedProject &&
      !result.rows.some(
        (item) => String(item.projectId) === String(selectedProject.projectId),
      )
        ? [selectedProject, ...result.rows]
        : result.rows;
  } catch (error) {
    if (!isCurrentProjectSearch(requestSequence, routeSnapshot.key)) return;
    projectSearchError.value = normalizeError(
      error,
      "COMMITTEE_PROJECT_SEARCH_FAILED",
      "项目搜索失败，请稍后重试",
    );
  } finally {
    if (isCurrentProjectSearch(requestSequence, routeSnapshot.key)) {
      projectOptionsLoading.value = false;
      initialLoading.value = false;
    }
  }
}

function retryProjectSearch() {
  void searchProjects(lastProjectSearchKeyword, true);
}

async function loadConclusionDecisionOptions() {
  try {
    conclusionDecisionOptions.value = await fetchPlatformDictItems(
      "committee_conclusion_decision",
    );
  } catch {
    conclusionDecisionOptions.value = [];
  }
}

async function loadMeetingForm(conflictError?: ErrorInfo) {
  const routeSnapshot = readRouteSnapshot();
  const requestSequence = ++loadRequestSequence;
  resetRouteState();
  await loadConclusionDecisionOptions();

  try {
    if (!routeSnapshot.meetingId) {
      const projectRequestSequence = ++projectSearchRequestSequence;
      try {
        const result = await fetchCommitteeProjects({
          pageNum: 1,
          pageSize: 50,
        });
        if (
          !isCurrentLoad(requestSequence, routeSnapshot.key) ||
          !isCurrentProjectSearch(projectRequestSequence, routeSnapshot.key)
        ) {
          return;
        }
        projects.value = result.rows;
      } catch (error) {
        if (
          !isCurrentLoad(requestSequence, routeSnapshot.key) ||
          !isCurrentProjectSearch(projectRequestSequence, routeSnapshot.key)
        ) {
          return;
        }
        loadError.value = normalizeError(
          error,
          "COMMITTEE_PROJECTS_LOAD_FAILED",
          "项目列表加载失败，请稍后重试",
        );
      }
      return;
    }

    let meeting: CommitteeMeeting;
    try {
      meeting = await fetchCommitteeMeeting(
        routeSnapshot.level,
        routeSnapshot.meetingId,
      );
    } catch (error) {
      if (!isCurrentLoad(requestSequence, routeSnapshot.key)) return;
      loadError.value = normalizeError(
        error,
        "COMMITTEE_MEETING_DETAIL_LOAD_FAILED",
        "会议详情加载失败，请稍后重试",
      );
      return;
    }
    if (!isCurrentLoad(requestSequence, routeSnapshot.key)) return;

    projects.value = [
      {
        projectId: String(meeting.projectId),
        projectName: meeting.projectName,
      },
    ];
    editingMeetingStatus.value = meeting.meetingStatus;
    Object.assign(form, {
      meetingType: meeting.meetingType ?? "PRODUCT_COMMITTEE",
      projectId: String(meeting.projectId),
      gateId: String(meeting.gateId),
      linkedSecondMeetingId: meeting.linkedSecondMeetingId
        ? String(meeting.linkedSecondMeetingId)
        : "",
      linkedSecondConclusionId: meeting.linkedSecondConclusionId
        ? String(meeting.linkedSecondConclusionId)
        : "",
      meetingTime: meetingDateTimeValue(meeting.meetingTime),
      reviewDeadlineTime: meetingDateTimeValue(meeting.reviewDeadlineTime),
      meetingLocation: meeting.meetingLocation ?? "",
      meetingHost: meeting.meetingHost ?? "",
      remark: meeting.remark ?? "",
      changeReason: "",
      expectedLockVersion: meeting.lockVersion,
    });
    initialReviewDeadlineTime.value = meetingDateTimeValue(
      meeting.reviewDeadlineTime,
    );
    try {
      await loadEditingContext(meeting, routeSnapshot, requestSequence);
    } catch (error) {
      if (!isCurrentLoad(requestSequence, routeSnapshot.key)) return;
      linkedContextError.value = normalizeError(
        error,
        "COMMITTEE_MEETING_CONTEXT_LOAD_FAILED",
        "会议关联信息加载失败，请稍后重试",
      );
    }
  } finally {
    if (isCurrentLoad(requestSequence, routeSnapshot.key)) {
      initialLoading.value = false;
      if (conflictError) {
        saveError.value = {
          ...conflictError,
          message: loadError.value
            ? `${conflictError.message}，服务器最新信息加载失败，请重新加载后再确认`
            : `${conflictError.message}，已加载服务器最新信息，请确认后重新保存`,
        };
      }
    }
  }
}

function load() {
  return loadMeetingForm();
}

function optionalTrimmed(value: string) {
  return value.trim() || undefined;
}

function buildCreatePayload(
  meetingLevel: CommitteeMeetingLevel,
  source: MeetingFormModel,
): CommitteeMeetingCreateCommand {
  return {
    projectId: source.projectId,
    gateId: source.gateId,
    meetingType:
      meetingLevel === "GROUP" ? "PRODUCT_COMMITTEE" : source.meetingType,
    meetingTime: normalizeMeetingHour(source.meetingTime),
    reviewDeadlineTime: normalizeMeetingHour(source.reviewDeadlineTime),
    ...(optionalTrimmed(source.meetingLocation)
      ? { meetingLocation: optionalTrimmed(source.meetingLocation) }
      : {}),
    ...(optionalTrimmed(source.meetingHost)
      ? { meetingHost: optionalTrimmed(source.meetingHost) }
      : {}),
    ...(meetingLevel === "GROUP" &&
    source.linkedSecondMeetingId &&
    source.linkedSecondConclusionId
      ? {
          linkedSecondMeetingId: source.linkedSecondMeetingId,
          linkedSecondConclusionId: source.linkedSecondConclusionId,
        }
      : {}),
    ...(optionalTrimmed(source.remark)
      ? { remark: optionalTrimmed(source.remark) }
      : {}),
  };
}

function buildUpdatePayload(
  source: MeetingFormModel,
): CommitteeMeetingUpdateCommand {
  return {
    expectedLockVersion: source.expectedLockVersion,
    meetingTime: normalizeMeetingHour(source.meetingTime),
    reviewDeadlineTime: normalizeMeetingHour(source.reviewDeadlineTime),
    meetingLocation: optionalTrimmed(source.meetingLocation),
    ...(optionalTrimmed(source.meetingHost)
      ? { meetingHost: optionalTrimmed(source.meetingHost) }
      : {}),
    remark: optionalTrimmed(source.remark),
    changeReason: optionalTrimmed(source.changeReason),
  };
}

function hasRequiredFormValues(source: MeetingFormModel) {
  return Boolean(
    source.projectId &&
    source.gateId &&
    source.meetingTime &&
    source.reviewDeadlineTime,
  );
}

function readFormSnapshot(): MeetingFormModel {
  return { ...form };
}

function isCurrentFormSnapshot(snapshot: MeetingFormModel) {
  return (Object.keys(snapshot) as Array<keyof MeetingFormModel>).every(
    (key) => form[key] === snapshot[key],
  );
}

async function submit() {
  if (submitDisabled.value) return;
  const routeSnapshot = readRouteSnapshot();
  const requestSequence = ++submitRequestSequence;
  saveError.value = undefined;
  const currentForm = formRef.value;
  if (!currentForm) return;
  const formSnapshot = readFormSnapshot();
  try {
    const valid = await currentForm.validate();
    if (!valid || !hasRequiredFormValues(formSnapshot)) return;
  } catch {
    return;
  }
  if (!isCurrentSubmit(requestSequence, routeSnapshot.key)) return;
  if (!isCurrentFormSnapshot(formSnapshot)) return;
  if (submitDisabled.value) return;

  saving.value = true;
  let savedMeetingId: string;
  try {
    const result = routeSnapshot.meetingId
      ? await updateCommitteeMeeting(
          routeSnapshot.level,
          routeSnapshot.meetingId,
          buildUpdatePayload(formSnapshot),
        )
      : await createCommitteeMeeting(
          routeSnapshot.level,
          buildCreatePayload(routeSnapshot.level, formSnapshot),
        );
    if (!isCurrentSubmit(requestSequence, routeSnapshot.key)) return;
    savedMeetingId = result.id;
  } catch (error) {
    if (!isCurrentSubmit(requestSequence, routeSnapshot.key)) return;
    const normalizedError = normalizeError(
      error,
      "COMMITTEE_MEETING_SAVE_FAILED",
      "会议保存失败，请检查输入后重试",
    );
    saving.value = false;
    if (
      routeSnapshot.meetingId &&
      error instanceof ApiBusinessError &&
      error.code === "COMMITTEE_CONCURRENT_MODIFICATION"
    ) {
      await loadMeetingForm(normalizedError);
      return;
    }
    saveError.value = normalizedError;
    return;
  }

  BaseToast.success(routeSnapshot.meetingId ? "会议信息已更新" : "会议已创建");
  const detailPath = `/committee/meetings/${routeSnapshot.level.toLowerCase()}/${savedMeetingId}`;
  try {
    await router.replace(detailPath);
  } catch {
    replaceBrowserLocation(detailPath);
  } finally {
    if (isCurrentSubmit(requestSequence, routeSnapshot.key)) {
      saving.value = false;
    }
  }
}

watch(
  () => [
    route.path,
    String(route.params.level ?? ""),
    String(route.params.meetingId ?? ""),
  ],
  () => {
    void load();
  },
  { immediate: true },
);
watch(
  () => form.projectId,
  (projectId, previousProjectId) => {
    if (editing.value || projectId === previousProjectId) return;
    ++submitRequestSequence;
    void loadCreateProjectContext(projectId);
  },
);
onBeforeUnmount(() => {
  componentActive = false;
  saving.value = false;
  ++loadRequestSequence;
  ++contextRequestSequence;
  ++projectSearchRequestSequence;
  ++submitRequestSequence;
});
</script>

<template>
  <PageContainer
    class="bq-management-page"
    :title="`${editing ? '编辑' : '创建'}${level === 'GROUP' ? '集团' : '品牌公司'}会议`"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="
          router.replace(
            String(
              route.query.returnPath ||
                route.meta.breadcrumbParentPath ||
                route.meta.activeMenu ||
                parentPath,
            ),
          )
        "
      >
        返回
      </PermissionButton>
      <PermissionButton
        type="primary"
        :loading="saving"
        :disabled="submitDisabled"
        @click="submit"
      >
        {{ submitLabel }}
      </PermissionButton>
    </template>
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      :label-width="formLabelWidth"
      label-position="top"
      class="committee-meeting-form"
    >
      <section class="committee-meeting-form__section">
        <el-alert
          v-if="initialLoading"
          data-testid="initial-loading-hint"
          title="正在加载会议表单"
          type="info"
          :closable="false"
          show-icon
        />
        <div v-if="loadError" class="committee-meeting-form__errors">
          <TraceErrorAlert v-bind="loadError" />
          <div class="committee-meeting-form__reload">
            <PermissionButton
              data-testid="reload-button"
              native-type="button"
              :loading="initialLoading"
              @click="load"
            >
              重新加载
            </PermissionButton>
          </div>
        </div>
        <div v-if="linkedContextError" class="committee-meeting-form__errors">
          <TraceErrorAlert v-bind="linkedContextError" />
          <div class="committee-meeting-form__reload">
            <PermissionButton
              data-testid="linked-context-reload-button"
              native-type="button"
              :loading="linkedContextLoading"
              @click="retryLinkedContext"
            >
              重新加载关联信息
            </PermissionButton>
          </div>
        </div>
        <div
          v-if="projectContextError || projectSearchError || saveError"
          class="committee-meeting-form__errors"
        >
          <TraceErrorAlert
            v-if="projectContextError"
            v-bind="projectContextError"
          />
          <div
            v-if="projectContextError"
            class="committee-meeting-form__reload"
          >
            <PermissionButton
              data-testid="project-context-reload-button"
              native-type="button"
              @click="retryProjectContext"
            >
              重新加载项目条件
            </PermissionButton>
          </div>
          <TraceErrorAlert
            v-if="projectSearchError"
            v-bind="projectSearchError"
          />
          <div v-if="projectSearchError" class="committee-meeting-form__reload">
            <PermissionButton
              data-testid="project-search-reload-button"
              native-type="button"
              :loading="projectOptionsLoading"
              @click="retryProjectSearch"
            >
              重新搜索项目
            </PermissionButton>
          </div>
          <TraceErrorAlert v-if="saveError" v-bind="saveError" />
        </div>
        <el-alert
          v-if="
            !initialLoading && !loadError && !editing && projects.length === 0
          "
          data-testid="empty-projects-hint"
          title="暂无可选项目"
          type="info"
          :closable="false"
          show-icon
        />
        <el-alert
          v-if="editingConcluded"
          data-testid="meeting-readonly-hint"
          title="当前会议已形成结论，可修改会议时间、评审截止时间、会议地点、会议主持人和备注"
          type="warning"
          :closable="false"
          show-icon
        />
        <el-alert
          v-else-if="editingReadOnly"
          data-testid="meeting-readonly-hint"
          title="当前会议已封存，仅可查看，不能修改"
          type="warning"
          :closable="false"
          show-icon
        />
        <div class="committee-meeting-form__grid">
          <el-form-item label="会议类型">
            <el-input
              v-if="level === 'GROUP'"
              data-testid="meeting-type-readonly"
              value="集团产品委员会"
              disabled
            />
            <el-select
              v-else
              v-model="form.meetingType"
              data-testid="meeting-type"
              :disabled="formUnavailable || editing"
            >
              <el-option label="产品委员会" value="PRODUCT_COMMITTEE" />
              <el-option label="阀点评审会" value="GATE_REVIEW" />
            </el-select>
          </el-form-item>

          <el-form-item label="关联项目" prop="projectId">
            <el-select
              v-model="form.projectId"
              data-testid="project-select"
              filterable
              remote
              reserve-keyword
              :remote-method="searchProjects"
              :loading="projectOptionsLoading"
              :disabled="formUnavailable || editing || saving"
              placeholder="请选择项目"
            >
              <el-option
                v-for="item in projects"
                :key="item.projectId"
                :label="item.projectName"
                :value="String(item.projectId)"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="当前阀点" prop="gateId">
            <el-input
              data-testid="current-gate"
              :model-value="currentGateLabel"
              disabled
            />
          </el-form-item>

          <template v-if="level === 'GROUP'">
            <el-form-item label="关联品牌公司会议">
              <el-input
                data-testid="linked-second-meeting"
                :model-value="linkedSecondMeetingLabel"
                disabled
              />
            </el-form-item>
            <el-form-item label="品牌公司会议结论">
              <el-input
                data-testid="linked-second-conclusion"
                :model-value="linkedSecondConclusionLabel"
                disabled
              />
            </el-form-item>
          </template>

          <el-form-item label="会议时间" prop="meetingTime">
            <el-date-picker
              v-model="form.meetingTime"
              data-testid="meeting-time"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              time-format="HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              :default-time="defaultMeetingTime"
              :disabled-minutes="disabledMeetingMinutes"
              :show-now="false"
              :disabled-date="groupMeetingDisabledDate"
              :disabled="formUnavailable || editingReadOnly || saving"
              placeholder="请选择会议时间"
            />
          </el-form-item>
          <el-form-item label="评审截止时间" prop="reviewDeadlineTime">
            <el-date-picker
              v-model="form.reviewDeadlineTime"
              data-testid="review-deadline-time"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              time-format="HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              :default-time="defaultMeetingTime"
              :disabled-minutes="disabledMeetingMinutes"
              :show-now="false"
              :disabled="formUnavailable || editingReadOnly || saving"
              placeholder="请选择评审截止时间"
            />
          </el-form-item>
          <el-form-item label="会议地点">
            <el-input
              v-model="form.meetingLocation"
              data-testid="meeting-location"
              maxlength="255"
              :disabled="formUnavailable || editingReadOnly || saving"
              placeholder="请输入会议地点"
            />
          </el-form-item>
          <el-form-item label="会议主持人">
            <el-input
              v-model="form.meetingHost"
              data-testid="meeting-host"
              maxlength="100"
              :disabled="formUnavailable || editingReadOnly || saving"
              placeholder="请输入会议主持人姓名"
            />
          </el-form-item>

          <el-form-item
            label="备注"
            prop="remark"
            class="committee-meeting-form__full-row"
          >
            <el-input
              v-model="form.remark"
              data-testid="remark-input"
              maxlength="500"
              show-word-limit
              type="textarea"
              :disabled="formUnavailable || editingReadOnly || saving"
              placeholder="请输入备注"
            />
          </el-form-item>

<!--          <el-form-item-->
<!--            v-if="editing"-->
<!--            label="修改原因"-->
<!--            prop="changeReason"-->
<!--            class="committee-meeting-form__full-row"-->
<!--          >-->
<!--            <el-input-->
<!--              v-model="form.changeReason"-->
<!--              data-testid="change-reason-input"-->
<!--              maxlength="1000"-->
<!--              show-word-limit-->
<!--              :disabled="formUnavailable || editingReadOnly || saving"-->
<!--              placeholder="修改评审截止时间时必填"-->
<!--            />-->
<!--          </el-form-item>-->
        </div>
      </section>
    </el-form>
  </PageContainer>
</template>

<style scoped>
.committee-meeting-form {
  display: grid;
  gap: 16px;
}

.committee-meeting-form__section {
  display: grid;
  gap: 16px;
  padding: 18px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-card);
}

.committee-meeting-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.committee-meeting-form__grid :deep(.el-form-item) {
  display: block;
  margin-bottom: 0;
}

.committee-meeting-form__grid :deep(.el-form-item__label) {
  justify-content: flex-start;
  width: auto !important;
  height: auto;
  margin-bottom: 6px;
  padding-right: 0;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
}

.committee-meeting-form__grid :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.committee-meeting-form__errors {
  display: grid;
  gap: 8px;
}

.committee-meeting-form__reload {
  display: flex;
  justify-content: flex-end;
}

.committee-meeting-form__grid :deep(.el-select),
.committee-meeting-form__grid :deep(.el-date-editor),
.committee-meeting-form__grid :deep(.el-alert) {
  width: 100%;
}

.committee-meeting-form__full-row {
  grid-column: 1 / -1;
}

@media (max-width: 960px) {
  .committee-meeting-form__grid {
    grid-template-columns: 1fr;
  }

  .committee-meeting-form__full-row {
    grid-column: auto;
  }
}
</style>
