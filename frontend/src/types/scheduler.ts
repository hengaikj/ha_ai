export type SchedulerJobStatus = "0" | "1";
export type SchedulerJobConcurrent = "0" | "1";
export type SchedulerMisfirePolicy = "0" | "1" | "2" | "3";
export type SchedulerLogStatus = "0" | "1";

export interface SchedulerJob {
  jobId: number;
  jobName: string;
  jobGroup: string;
  invokeTarget: string;
  cronExpression: string;
  misfirePolicy: SchedulerMisfirePolicy;
  concurrent: SchedulerJobConcurrent;
  status: SchedulerJobStatus;
  maxRetryCount?: number;
  retryInterval?: number;
  remark?: string;
  nextValidTime?: string | null;
  createTime?: string;
  updateTime?: string;
}

export interface SchedulerJobPayload {
  jobName: string;
  jobGroup: string;
  invokeTarget: string;
  cronExpression: string;
  misfirePolicy: SchedulerMisfirePolicy;
  concurrent: SchedulerJobConcurrent;
  status: SchedulerJobStatus;
  maxRetryCount?: number;
  retryInterval?: number;
  remark?: string;
}

export interface SchedulerJobUpdatePayload extends SchedulerJobPayload {
  jobId: number;
}

export interface SchedulerJobQuery {
  pageNum?: number;
  pageSize?: number;
  jobName?: string;
  jobGroup?: string;
  invokeTarget?: string;
  status?: SchedulerJobStatus;
}

export interface SchedulerJobLog {
  jobLogId: number;
  jobName: string;
  jobGroup: string;
  invokeTarget: string;
  jobMessage?: string;
  status: SchedulerLogStatus;
  exceptionInfo?: string;
  startTime?: string;
  stopTime?: string;
}

export interface SchedulerJobLogQuery {
  pageNum?: number;
  pageSize?: number;
  jobName?: string;
  jobGroup?: string;
  status?: SchedulerLogStatus;
  beginTime?: string;
  endTime?: string;
}

export interface SchedulerPage<T> {
  records: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}
