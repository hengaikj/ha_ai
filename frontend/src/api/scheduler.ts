import {
  httpClient,
  parseBlobDownloadResponse,
  request,
  type BlobDownloadResponse,
} from "@/api/http";
import type {
  SchedulerJob,
  SchedulerJobLog,
  SchedulerJobLogQuery,
  SchedulerJobPayload,
  SchedulerJobQuery,
  SchedulerJobStatus,
  SchedulerJobUpdatePayload,
  SchedulerPage,
} from "@/types/scheduler";

interface SchedulerTableData<T> {
  rows?: T[];
  total?: number;
}

function mapPage<T>(
  response: SchedulerTableData<T>,
  pageNum?: number,
  pageSize?: number,
): SchedulerPage<T> {
  return {
    records: response.rows ?? [],
    total: Number(response.total ?? 0),
    pageNo: pageNum ?? 1,
    pageSize: pageSize ?? 10,
  };
}

function mapLogQuery(params: SchedulerJobLogQuery) {
  const { beginTime, endTime, ...query } = params;
  return {
    ...query,
    ...(beginTime ? { "params[beginTime]": beginTime } : {}),
    ...(endTime ? { "params[endTime]": endTime } : {}),
  };
}

export async function fetchSchedulerJobs(
  params: SchedulerJobQuery,
): Promise<SchedulerPage<SchedulerJob>> {
  const response = await request<SchedulerTableData<SchedulerJob>>({
    url: "/monitor/job/list",
    method: "get",
    params,
  });
  return mapPage(response, params.pageNum, params.pageSize);
}

export function fetchSchedulerJob(jobId: number): Promise<SchedulerJob> {
  return request<SchedulerJob>({
    url: `/monitor/job/${jobId}`,
    method: "get",
  });
}

export function createSchedulerJob(data: SchedulerJobPayload): Promise<void> {
  return request<void>({
    url: "/monitor/job",
    method: "post",
    data,
  });
}

export function updateSchedulerJob(
  data: SchedulerJobUpdatePayload,
): Promise<void> {
  return request<void>({
    url: "/monitor/job",
    method: "put",
    data,
  });
}

export function changeSchedulerJobStatus(
  jobId: number,
  jobGroup: string,
  status: SchedulerJobStatus,
): Promise<void> {
  return request<void>({
    url: "/monitor/job/changeStatus",
    method: "put",
    data: { jobId, jobGroup, status },
  });
}

export function runSchedulerJob(
  jobId: number,
  jobGroup: string,
): Promise<void> {
  return request<void>({
    url: "/monitor/job/run",
    method: "put",
    data: { jobId, jobGroup },
  });
}

export function deleteSchedulerJobs(jobIds: number[]): Promise<void> {
  return request<void>({
    url: `/monitor/job/${jobIds.join(",")}`,
    method: "delete",
  });
}

export async function exportSchedulerJobs(
  params: Omit<SchedulerJobQuery, "pageNum" | "pageSize">,
): Promise<BlobDownloadResponse> {
  const response = await httpClient.request<Blob>({
    url: "/monitor/job/export",
    method: "post",
    params,
    responseType: "blob",
  });
  return parseBlobDownloadResponse(response, "定时任务.xlsx");
}

export async function fetchSchedulerJobLogs(
  params: SchedulerJobLogQuery,
): Promise<SchedulerPage<SchedulerJobLog>> {
  const response = await request<SchedulerTableData<SchedulerJobLog>>({
    url: "/monitor/jobLog/list",
    method: "get",
    params: mapLogQuery(params),
  });
  return mapPage(response, params.pageNum, params.pageSize);
}

export function fetchSchedulerJobLog(
  jobLogId: number,
): Promise<SchedulerJobLog> {
  return request<SchedulerJobLog>({
    url: `/monitor/jobLog/${jobLogId}`,
    method: "get",
  });
}

export function deleteSchedulerJobLogs(jobLogIds: number[]): Promise<void> {
  return request<void>({
    url: `/monitor/jobLog/${jobLogIds.join(",")}`,
    method: "delete",
  });
}

export function cleanSchedulerJobLogs(): Promise<void> {
  return request<void>({
    url: "/monitor/jobLog/clean",
    method: "delete",
  });
}

export async function exportSchedulerJobLogs(
  params: Omit<SchedulerJobLogQuery, "pageNum" | "pageSize">,
): Promise<BlobDownloadResponse> {
  const response = await httpClient.request<Blob>({
    url: "/monitor/jobLog/export",
    method: "post",
    params: mapLogQuery(params),
    responseType: "blob",
  });
  return parseBlobDownloadResponse(response, "调度日志.xlsx");
}
