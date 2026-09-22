import { ref } from "vue";
import { fetchCostAnalysisLatestBom } from "@/api/cost-analysis";
import type {
  CostAnalysisConditionDraft,
  CostAnalysisQuery,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";

const NORMAL_CONDITION_LIMIT = 6;
const CONDITIONS_STORAGE_KEY = "bq.cost-analysis.conditions.v1";
const BOM_LOAD_ERROR_CODE = "COST_ANALYSIS_BOM_LOAD_FAILED";

let nextClientId = 1;
const issuedClientIds = new Set<string>();

export interface CostAnalysisConditionValidationError {
  code:
    | "PROJECT_REQUIRED"
    | "VALVE_REQUIRED"
    | "BOM_REQUIRED"
    | "BOM_LOADING"
    | "PATTERN_REQUIRED"
    | "DUPLICATE_PROJECT_VALVE"
    | "CONDITION_LIMIT_EXCEEDED";
  clientId: string;
  message: string;
}

function createBlankCondition(
  currentClientIds: Iterable<string>,
): CostAnalysisConditionDraft {
  const currentIds = new Set(currentClientIds);
  let clientId: string;
  while (true) {
    const candidate = `cost-analysis-condition-${nextClientId++}`;
    if (issuedClientIds.has(candidate) || currentIds.has(candidate)) continue;
    clientId = candidate;
    break;
  }
  issuedClientIds.add(clientId);

  return {
    clientId,
    projectId: null,
    projectName: "",
    valveId: null,
    valveName: "",
    bom: null,
    patternIds: [],
    loadingBom: false,
    bomError: null,
  };
}

function cloneConditions(
  conditions: CostAnalysisConditionDraft[],
): CostAnalysisConditionDraft[] {
  return conditions.map((condition) => ({
    ...condition,
    bom: condition.bom
      ? {
          ...condition.bom,
          patterns: condition.bom.patterns.map((pattern) => ({ ...pattern })),
        }
      : null,
    patternIds: [...condition.patternIds],
    bomError: condition.bomError ? { ...condition.bomError } : null,
  }));
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isPatternId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function toPositiveSafeInteger(value: unknown): number | null {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[0-9]+$/.test(value)
        ? Number(value)
        : Number.NaN;
  return isPositiveSafeInteger(normalized) ? normalized : null;
}

function normalizeBomError(error: unknown): CostAnalysisTraceError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<CostAnalysisTraceError>;
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return {
        code: candidate.code,
        message: candidate.message,
        ...(typeof candidate.traceId === "string"
          ? { traceId: candidate.traceId }
          : {}),
      };
    }
  }

  return {
    code: BOM_LOAD_ERROR_CODE,
    message: error instanceof Error ? error.message : "最新 BOM 加载失败。",
  };
}

export function useCostAnalysisConditions(
  initial?: CostAnalysisConditionDraft[],
) {
  const initialConditions = initial?.length ? cloneConditions(initial) : [];
  initialConditions.forEach((condition) =>
    issuedClientIds.add(condition.clientId),
  );
  if (initialConditions.length === 0) {
    initialConditions.push(createBlankCondition([]));
  }

  const conditions = ref(initialConditions);
  const diffMode = ref(false);
  const projectRequestSequences = new Map<string, number>();

  function nextProjectRequestSequence(clientId: string): number {
    const sequence = (projectRequestSequences.get(clientId) ?? 0) + 1;
    projectRequestSequences.set(clientId, sequence);
    return sequence;
  }

  function findCondition(clientId: string) {
    return conditions.value.find(
      (condition) => condition.clientId === clientId,
    );
  }

  async function loadLatestBom(
    clientId: string,
    projectId: number,
    valveId: number,
  ): Promise<void> {
    const condition = findCondition(clientId);
    if (
      !condition ||
      condition.projectId !== projectId ||
      condition.valveId !== valveId
    ) {
      return;
    }

    const requestSequence = nextProjectRequestSequence(clientId);
    condition.loadingBom = true;
    condition.bomError = null;

    try {
      const bom = await fetchCostAnalysisLatestBom(projectId, valveId);
      const current = findCondition(clientId);
      if (
        !current ||
        projectRequestSequences.get(clientId) !== requestSequence ||
        current.projectId !== projectId ||
        current.valveId !== valveId
      ) {
        return;
      }

      const previousBom = current.bom;
      const previousPatternIds = current.patternIds;
      current.bom = {
        ...bom,
        patterns: bom.patterns.map((pattern) => ({ ...pattern })),
      };
      const availablePatternIds = new Set(bom.patterns.map((pattern) => pattern.patternId));
      current.patternIds =
        previousBom?.bomVersionId === bom.bomVersionId
          ? previousPatternIds.filter((patternId) => availablePatternIds.has(patternId))
          : bom.patterns.map((pattern) => pattern.patternId);
      if (current.patternIds.length === 0) {
        current.patternIds = bom.patterns.map((pattern) => pattern.patternId);
      }
      current.loadingBom = false;
    } catch (error) {
      const current = findCondition(clientId);
      if (
        !current ||
        projectRequestSequences.get(clientId) !== requestSequence ||
        current.projectId !== projectId ||
        current.valveId !== valveId
      ) {
        return;
      }
      current.bom = null;
      current.patternIds = [];
      current.loadingBom = false;
      current.bomError = normalizeBomError(error);
    }
  }

  function addCondition(): boolean {
    if (conditions.value.length >= NORMAL_CONDITION_LIMIT) return false;
    conditions.value.push(
      createBlankCondition(
        conditions.value.map((condition) => condition.clientId),
      ),
    );
    return true;
  }

  function removeCondition(clientId: string): void {
    if (conditions.value.length <= 1) return;
    const index = conditions.value.findIndex(
      (condition) => condition.clientId === clientId,
    );
    if (index < 0) return;
    nextProjectRequestSequence(clientId);
    conditions.value.splice(index, 1);
  }

  async function changeProject(
    clientId: string,
    project: BusinessProjectItem | null,
  ): Promise<void> {
    const condition = findCondition(clientId);
    if (!condition) return;

    condition.projectId = project?.projectId ?? null;
    condition.projectName = project?.projectName ?? "";
    condition.bom = null;
    condition.patternIds = [];
    condition.loadingBom = false;
    condition.bomError = null;

    if (!project) {
      nextProjectRequestSequence(clientId);
      return;
    }
    if (condition.valveId !== null) {
      await loadLatestBom(clientId, project.projectId, condition.valveId);
    }
  }

  async function changeValve(
    clientId: string,
    valve: BusinessValveItem | null,
  ): Promise<void> {
    const condition = findCondition(clientId);
    if (!condition) return;
    const valveId = toPositiveSafeInteger(valve?.valveId);
    condition.valveId = valveId;
    condition.valveName = valveId === null ? "" : (valve?.valveName ?? "");
    condition.bom = null;
    condition.patternIds = [];
    condition.loadingBom = false;
    condition.bomError = null;

    if (condition.projectId === null || valveId === null) {
      nextProjectRequestSequence(clientId);
      return;
    }
    await loadLatestBom(clientId, condition.projectId, valveId);
  }

  function changePatterns(clientId: string, patternIds: number[]): void {
    const condition = findCondition(clientId);
    if (!condition?.bom) return;

    const availablePatternIds = new Set(
      condition.bom.patterns.map((pattern) => pattern.patternId),
    );
    const filteredPatternIds = patternIds.filter(
      (patternId, index) =>
        isPatternId(patternId) &&
        availablePatternIds.has(patternId) &&
        patternIds.indexOf(patternId) === index,
    );
    if (filteredPatternIds.length === 0) return;
    condition.patternIds = filteredPatternIds;
  }

  async function refreshLatestBoms(): Promise<void> {
    const requests = conditions.value.flatMap((condition) => {
      if (
        condition.loadingBom ||
        !isPositiveSafeInteger(condition.projectId) ||
        !isPositiveSafeInteger(condition.valveId)
      ) {
        return [];
      }
      return [loadLatestBom(condition.clientId, condition.projectId, condition.valveId)];
    });
    await Promise.all(requests);
  }

  function setDiffMode(enabled: boolean): void {
    diffMode.value = enabled;
  }

  function validateConditions(): CostAnalysisConditionValidationError[] {
    const errors: CostAnalysisConditionValidationError[] = [];

    if (conditions.value.length > NORMAL_CONDITION_LIMIT) {
      errors.push({
        code: "CONDITION_LIMIT_EXCEEDED",
        clientId:
          conditions.value[NORMAL_CONDITION_LIMIT]?.clientId ??
          conditions.value[0].clientId,
        message: "普通模式最多支持 6 条对比条件。",
      });
    }

    const seenProjectValves = new Set<string>();
    conditions.value.forEach((condition) => {
      const hasProject = isPositiveSafeInteger(condition.projectId);
      const hasValve = isPositiveSafeInteger(condition.valveId);
      const hasBom = Boolean(
        condition.bom &&
        isPositiveSafeInteger(condition.bom.bomVersionId) &&
        condition.bom.projectId === condition.projectId,
      );
      if (!hasProject) {
        errors.push({
          code: "PROJECT_REQUIRED",
          clientId: condition.clientId,
          message: "请选择项目。",
        });
      } else if (!hasValve) {
        errors.push({
          code: "VALVE_REQUIRED",
          clientId: condition.clientId,
          message: "请选择阀点。",
        });
      } else if (!hasBom) {
        errors.push({
          code: "BOM_REQUIRED",
          clientId: condition.clientId,
          message: "未加载到当前项目和阀点的最新 BOM。",
        });
      } else {
        const availablePatternIds = new Set(
          condition.bom?.patterns.map((pattern) => pattern.patternId) ?? [],
        );
        const hasValidPattern = condition.patternIds.some(
          (patternId) =>
            isPatternId(patternId) && availablePatternIds.has(patternId),
        );
        if (!hasValidPattern) {
          errors.push({
            code: "PATTERN_REQUIRED",
            clientId: condition.clientId,
            message: "请至少选择一个版型。",
          });
        }
      }

      if (
        isPositiveSafeInteger(condition.projectId) &&
        isPositiveSafeInteger(condition.valveId)
      ) {
        const uniqueKey = `${condition.projectId}:${condition.valveId}`;
        if (seenProjectValves.has(uniqueKey)) {
          errors.push({
            code: "DUPLICATE_PROJECT_VALVE",
            clientId: condition.clientId,
            message: "项目和阀点组合不能重复。",
          });
        } else {
          seenProjectValves.add(uniqueKey);
        }
      }
    });

    return errors;
  }

  function resetConditions(): void {
    conditions.value = [
      createBlankCondition(
        conditions.value.map((condition) => condition.clientId),
      ),
    ];
    diffMode.value = false;
    projectRequestSequences.clear();
  }

  function saveConditions(): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      CONDITIONS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        diffMode: diffMode.value,
        conditions: conditions.value,
      }),
    );
  }

  function restoreConditions(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      const parsed = JSON.parse(
        localStorage.getItem(CONDITIONS_STORAGE_KEY) || "null",
      );
      if (
        !parsed ||
        parsed.version !== 1 ||
        !Array.isArray(parsed.conditions) ||
        parsed.conditions.length === 0 ||
        parsed.conditions.length > NORMAL_CONDITION_LIMIT
      )
        return false;
      const restored = parsed.conditions.map(
        (c: CostAnalysisConditionDraft) => ({
          ...c,
          loadingBom: false,
          bomError: null,
          patternIds: Array.isArray(c.patternIds) ? c.patternIds : [],
        }),
      );
      conditions.value = cloneConditions(restored);
      diffMode.value = parsed.diffMode === true;
      return true;
    } catch {
      return false;
    }
  }

  function toQueryConditions(): CostAnalysisQuery["conditions"] {
    return conditions.value.flatMap((condition) => {
      if (
        !isPositiveSafeInteger(condition.projectId) ||
        !isPositiveSafeInteger(condition.valveId) ||
        !condition.bom ||
        condition.bom.projectId !== condition.projectId
      ) {
        return [];
      }

      const availablePatternIds = new Set(
        condition.bom.patterns.map((pattern) => pattern.patternId),
      );
      const patternIds = condition.patternIds.filter(
        (patternId, index) =>
          isPatternId(patternId) &&
          availablePatternIds.has(patternId) &&
          condition.patternIds.indexOf(patternId) === index,
      );
      if (patternIds.length === 0) return [];

      return [
        {
          projectId: condition.projectId,
          valveId: condition.valveId,
          patternIds,
        },
      ];
    });
  }

  const api = {
    conditions,
    diffMode,
    addCondition,
    removeCondition,
    changeProject,
    changeValve,
    changePatterns,
    refreshLatestBoms,
    setDiffMode,
    validateConditions,
    resetConditions,
    toQueryConditions,
  };
  Object.defineProperties(api, {
    saveConditions: { value: saveConditions, enumerable: false },
    restoreConditions: { value: restoreConditions, enumerable: false },
  });
  return api as typeof api & {
    saveConditions: typeof saveConditions;
    restoreConditions: typeof restoreConditions;
  };
}
