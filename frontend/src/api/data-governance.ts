import { request } from "@/api/http";
import type { TableDataInfo } from "@/types/system";
import type {
  AdsCostSummary,
  AdsCostSummaryDetail,
  AdsCostSourceDetail,
  AdsCostException,
  GovernanceAdsTableContent,
  GovernanceAdsQueryRequest,
  GovernanceArrival,
  GovernanceArrivalQuery,
  GovernanceArrivalRequest,
  GovernanceBatch,
  GovernanceBatchDetail,
  GovernanceBatchQuery,
  GovernanceCostSummaryQuery,
  GovernanceJob,
  GovernanceJobCreateRequest,
  GovernanceOverview,
  GovernancePageQuery,
  GovernancePageResult,
  GovernanceQualityRule,
  GovernanceQualityRuleRequest,
  GovernanceQualityIssue,
  GovernanceQualityIssueQuery,
  GovernanceQualityIssueUpdateRequest,
  GovernanceSource,
  GovernanceSourceBatch,
  GovernanceSourceBatchQuery,
  GovernanceSourceRequest,
  GovernanceSourceSyncResult,
  GovernanceTableMetadata,
  GovernanceScript,
  GovernanceScriptCreateRequest,
  GovernanceScriptDetail,
  GovernanceScriptDraftRequest,
  GovernanceScriptVersion,
  GovernanceTriggerRequest,
  GovernanceCollectionObject,
} from "@/types/data-governance";

const PREFIX = "/data/governance";
function mapPage<T>(
  payload: TableDataInfo<T>,
  pageNo: number,
  pageSize: number,
): GovernancePageResult<T> {
  return {
    records: payload.rows ?? [],
    total: Number(payload.total ?? 0),
    pageNo,
    pageSize,
  };
}
function pageParams<T extends object>(
  query: T & { pageNo: number; pageSize: number },
) {
  const { pageNo, pageSize, ...filters } = query;
  return { ...filters, pageNum: pageNo, pageSize };
}
export const fetchGovernanceOverview = () =>
  request<GovernanceOverview>({ url: `${PREFIX}/overview`, method: "get" });
export async function fetchGovernanceSources(query: {
  keyword?: string;
  sourceSystem?: string;
  accessMethod?: string;
  connectionStatus?: string;
  pageNo: number;
  pageSize: number;
}) {
  return mapPage(
    await request<TableDataInfo<GovernanceSource>>({
      url: `${PREFIX}/sources`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export const createGovernanceSource = (data: GovernanceSourceRequest) =>
  request<GovernanceSource>({ url: `${PREFIX}/sources`, method: "post", data });
export const updateGovernanceSource = (
  sourceCode: string,
  data: GovernanceSourceRequest,
) =>
  request<GovernanceSource>({
    url: `${PREFIX}/sources/${encodeURIComponent(sourceCode)}`,
    method: "put",
    data,
  });
export const deleteGovernanceSource = (sourceCode: string) =>
  request<void>({
    url: `${PREFIX}/sources/${encodeURIComponent(sourceCode)}`,
    method: "delete",
  });
export const testGovernanceSourceConnection = (sourceCode: string) =>
  request<GovernanceSource>({
    url: `${PREFIX}/sources/${encodeURIComponent(sourceCode)}/test`,
    method: "post",
  });
export const syncGovernanceSource = (sourceCode: string) =>
  request<GovernanceSourceSyncResult>({
    url: `${PREFIX}/sources/${encodeURIComponent(sourceCode)}/sync`,
    method: "post",
    timeout: 310_000,
  });
export const fetchGovernanceOdsTableMetadata = (keyword?: string) =>
  request<GovernanceTableMetadata[]>({
    url: `${PREFIX}/metadata/ods-tables`,
    method: "get",
    params: { keyword: keyword || undefined },
  });
export const fetchGovernanceTableMetadata = (
  layerType?: "ODS" | "DWD" | "ADS",
  keyword?: string,
) =>
  request<GovernanceTableMetadata[]>({
    url: `${PREFIX}/metadata/tables`,
    method: "get",
    params: {
      layerType: layerType || undefined,
      keyword: keyword || undefined,
    },
  });
export const fetchGovernanceAdsTables = (keyword?: string) =>
  request<GovernanceTableMetadata[]>({
    url: `${PREFIX}/ads/tables`,
    method: "get",
    params: { keyword: keyword || undefined },
  });
export const fetchGovernanceAdsTableContent = ({
  tableCode,
  ...pageQuery
}: {
  tableCode: string;
  pageNo: number;
  pageSize: number;
  keyword?: string;
}) =>
  request<GovernanceAdsTableContent>({
    url: `${PREFIX}/ads/tables/${encodeURIComponent(tableCode)}/content`,
    method: "get",
    params: pageParams(pageQuery),
  });
export const queryGovernanceAdsTable = (data: GovernanceAdsQueryRequest) => {
  const { pageNo, ...query } = data;
  return request<GovernanceAdsTableContent>({
    url: `${PREFIX}/ads/query`,
    method: "post",
    data: {
      ...query,
      pageNum: pageNo,
    },
  });
};
export async function fetchGovernanceArrivals(query: GovernanceArrivalQuery) {
  return mapPage(
    await request<TableDataInfo<GovernanceArrival>>({
      url: `${PREFIX}/sources/arrivals`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export const registerGovernanceArrival = (
  sourceCode: string,
  data: GovernanceArrivalRequest,
) =>
  request<GovernanceArrival>({
    url: `${PREFIX}/sources/${encodeURIComponent(sourceCode)}/arrivals`,
    method: "post",
    data,
  });
export async function fetchGovernanceSourceBatches(
  query: GovernanceSourceBatchQuery,
) {
  return mapPage(
    await request<TableDataInfo<GovernanceSourceBatch>>({
      url: `${PREFIX}/source-batches`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export async function fetchGovernanceJobs(query: GovernancePageQuery) {
  const payload = await request<TableDataInfo<GovernanceJob> | GovernanceJob[]>(
    {
      url: `${PREFIX}/jobs`,
      method: "get",
      params: pageParams(query),
    },
  );
  if (!Array.isArray(payload)) {
    return mapPage(payload, query.pageNo, query.pageSize);
  }

  const start = (query.pageNo - 1) * query.pageSize;
  return {
    records: payload.slice(start, start + query.pageSize),
    total: payload.length,
    pageNo: query.pageNo,
    pageSize: query.pageSize,
  };
}
export const createGovernanceJob = (data: GovernanceJobCreateRequest) =>
  request<GovernanceJob>({ url: `${PREFIX}/jobs`, method: "post", data });
export async function fetchGovernanceCollectionObjects(query: {
  pageNo: number;
  pageSize: number;
  keyword?: string;
}) {
  return mapPage(
    await request<TableDataInfo<GovernanceCollectionObject>>({
      url: `${PREFIX}/collection-objects`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export async function fetchGovernanceScripts(query: GovernancePageQuery) {
  return mapPage(
    await request<TableDataInfo<GovernanceScript>>({
      url: `${PREFIX}/scripts`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export const createGovernanceScript = (data: GovernanceScriptCreateRequest) =>
  request<GovernanceScript>({ url: `${PREFIX}/scripts`, method: "post", data });
export const fetchGovernanceScriptDetail = (scriptCode: string) =>
  request<GovernanceScriptDetail>({
    url: `${PREFIX}/scripts/${encodeURIComponent(scriptCode)}`,
    method: "get",
  });
export const createGovernanceScriptDraft = (
  scriptCode: string,
  data: GovernanceScriptDraftRequest,
) =>
  request<GovernanceScriptVersion>({
    url: `${PREFIX}/scripts/${encodeURIComponent(scriptCode)}/versions`,
    method: "post",
    data,
  });
export const updateGovernanceScriptDraft = (
  scriptCode: string,
  version: number,
  data: GovernanceScriptDraftRequest,
) =>
  request<GovernanceScriptVersion>({
    url: `${PREFIX}/scripts/${encodeURIComponent(scriptCode)}/versions/${version}`,
    method: "put",
    data,
  });
export const submitGovernanceScriptReview = (
  scriptCode: string,
  version: number,
) =>
  request<GovernanceScriptVersion>({
    url: `${PREFIX}/scripts/${encodeURIComponent(scriptCode)}/versions/${version}/submit`,
    method: "post",
  });
export const publishGovernanceScript = (
  scriptCode: string,
  version: number,
  comment?: string,
) =>
  request<GovernanceScriptVersion>({
    url: `${PREFIX}/scripts/${encodeURIComponent(scriptCode)}/versions/${version}/publish`,
    method: "post",
    data: { comment },
  });
export const rejectGovernanceScript = (
  scriptCode: string,
  version: number,
  comment: string,
) =>
  request<GovernanceScriptVersion>({
    url: `${PREFIX}/scripts/${encodeURIComponent(scriptCode)}/versions/${version}/reject`,
    method: "post",
    data: { comment },
  });
export const updateGovernanceJobStatus = (jobCode: string, enabled: boolean) =>
  request<void>({
    url: `${PREFIX}/jobs/${encodeURIComponent(jobCode)}/status`,
    method: "put",
    data: { enabled },
  });
export const triggerGovernanceJob = (data: GovernanceTriggerRequest) =>
  request<GovernanceBatch>({
    url: `${PREFIX}/batches/trigger`,
    method: "post",
    data,
  });
export async function fetchGovernanceBatches(query: GovernanceBatchQuery) {
  return mapPage(
    await request<TableDataInfo<GovernanceBatch>>({
      url: `${PREFIX}/batches`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export const fetchGovernanceBatchDetail = (batchNo: string) =>
  request<GovernanceBatchDetail>({
    url: `${PREFIX}/batches/${encodeURIComponent(batchNo)}`,
    method: "get",
  });
export const retryGovernanceBatch = (batchNo: string, requestNo: string) =>
  request<GovernanceBatch>({
    url: `${PREFIX}/batches/${encodeURIComponent(batchNo)}/retry`,
    method: "post",
    data: { requestNo },
  });
export const cancelGovernanceBatch = (batchNo: string) =>
  request<void>({
    url: `${PREFIX}/batches/${encodeURIComponent(batchNo)}`,
    method: "delete",
  });
export const recoverStaleGovernanceBatches = () =>
  request<number>({ url: `${PREFIX}/batches/recover-stale`, method: "post" });
export async function fetchGovernanceQualityRules(query: GovernancePageQuery) {
  return mapPage(
    await request<TableDataInfo<GovernanceQualityRule>>({
      url: `${PREFIX}/quality/rules`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export const updateGovernanceQualityRule = (
  ruleCode: string,
  data: GovernanceQualityRuleRequest,
) =>
  request<void>({
    url: `${PREFIX}/quality/rules/${encodeURIComponent(ruleCode)}`,
    method: "put",
    data,
  });
export async function fetchGovernanceQualityIssues(
  query: GovernanceQualityIssueQuery,
) {
  return mapPage(
    await request<TableDataInfo<GovernanceQualityIssue>>({
      url: `${PREFIX}/quality/issues`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export const updateGovernanceQualityIssue = (
  issueId: number,
  data: GovernanceQualityIssueUpdateRequest,
) =>
  request<void>({
    url: `${PREFIX}/quality/issues/${issueId}`,
    method: "put",
    data,
  });
export async function fetchGovernanceCostSummaries(
  query: GovernanceCostSummaryQuery,
) {
  return mapPage(
    await request<TableDataInfo<AdsCostSummary>>({
      url: `${PREFIX}/ads/cost-summaries`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export async function fetchGovernanceCostSummaryDetails(query: {
  batchNo?: string;
  partNo?: string;
  priceMatchStatus?: string;
  pageNo: number;
  pageSize: number;
}) {
  return mapPage(
    await request<TableDataInfo<AdsCostSummaryDetail>>({
      url: `${PREFIX}/ads/cost-summary-details`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export async function fetchGovernanceCostSourceDetails(query: {
  batchNo?: string;
  projectNo?: string;
  vehiclem?: string;
  partNo?: string;
  pageNo: number;
  pageSize: number;
}) {
  return mapPage(
    await request<TableDataInfo<AdsCostSourceDetail>>({
      url: `${PREFIX}/ads/cost-source-details`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
export async function fetchGovernanceCostExceptions(query: {
  batchNo?: string;
  ruleCode?: string;
  handlingStatus?: string;
  pageNo: number;
  pageSize: number;
}) {
  return mapPage(
    await request<TableDataInfo<AdsCostException>>({
      url: `${PREFIX}/ads/cost-exceptions`,
      method: "get",
      params: pageParams(query),
    }),
    query.pageNo,
    query.pageSize,
  );
}
