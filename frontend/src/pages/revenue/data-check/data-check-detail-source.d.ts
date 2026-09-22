import type { Ref, Reactive } from "vue";

export interface DataCheckSourceModelOptions {
  project: Reactive<Record<string, unknown>>;
  dimensions: Reactive<Record<string, unknown>>;
  subjects: Ref<unknown[]>;
  sourceVersions: Ref<unknown[]>;
  candidateValues: Ref<Record<string, unknown>>;
  sourceRecordMap: Ref<Record<string, unknown>>;
  calcEditableFields: Ref<unknown[]>;
  state: Reactive<Record<string, unknown>>;
  pageMessage?: Ref<string>;
  mergeProjectWithRoute: (flow?: Record<string, unknown>) => Record<string, unknown>;
  getStageLabel: (stageCode: string) => string;
  getCurrentStage: () => string;
  getReviewYearOptions: () => unknown[];
  getCalcBaseYearOptions: () => unknown[];
  getDefaultYearIndexes: () => number[];
  clone: <T>(value: T) => T;
  safeText: (value: unknown, fallback?: string) => string;
  roundNumber: (value: unknown, digits?: number) => number | null;
  STAGE_ORDER?: string[];
  SUBJECT_ID_BY_NAME?: Readonly<Record<string, string>>;
}

export interface DataCheckSourceModel {
  applyDataCheckPayload: (payload?: Record<string, unknown>) => void;
  resetCompareData: () => void;
  replaceCompareSources: (sources?: unknown[]) => void;
  upsertCompareSource: (source?: Record<string, unknown>) => string;
  getCompareSourceList: () => unknown[];
  buildSourceVersionsFromSources: (sources?: unknown[]) => unknown[];
  buildSubjectsFromSourceDetails: (sources?: unknown[]) => unknown[];
  buildCandidateValuesFromSourceDetails: (sources?: unknown[]) => Record<string, unknown>;
  syncReviewDimensionsFromSourceDetails: (sources?: unknown[]) => void;
  normalizeState: (state?: Record<string, unknown>) => Record<string, unknown>;
  resetStateFromVersions: () => void;
  getDefaultBaselineVersionKey: () => string;
  getDefaultTrimIndex: () => number;
  resolveSubjectValueKeys: (itemOrId: unknown) => string[];
  getRawVersionValue: (
    itemOrId: unknown,
    versionKey: string,
    trimIndex: number,
    yearIndex: number
  ) => number | null;
  getVersionValue: (
    itemOrId: unknown,
    versionKey: string,
    trimIndex: number,
    yearIndex: number
  ) => number | null;
  buildCalcEditableFields: (subjectList?: unknown[]) => unknown[];
  getReviewFormulaMeta: (item: unknown, group: unknown) => Record<string, unknown> | null;
  resolveCalcSubjectPath: (item: unknown, group: unknown) => string;
  resolveCalcSubjectMeta: (item: unknown, group: unknown) => Record<string, unknown>;
  isCalcInputSubject: (item: unknown, group: unknown) => boolean;
  orderCalcEditableFields: (fields?: unknown[]) => unknown[];
  normalizeSubjectMatchName: (value: unknown) => string;
  inferTemplateId: (row?: Record<string, unknown>, groupName?: string) => string;
  alignCompareSourceSubjects: (
    source?: Record<string, unknown>,
    subjectList?: unknown[]
  ) => Record<string, unknown>;
}

export const SUBJECT_ID_BY_NAME: Readonly<Record<string, string>>;

export function createDataCheckSourceModel(
  options?: DataCheckSourceModelOptions
): DataCheckSourceModel;
