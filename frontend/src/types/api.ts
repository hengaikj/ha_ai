export interface ApiResponse<T> {
  code: string | number;
  message?: string;
  msg?: string;
  data?: T;
  traceId?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  traceId?: string;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}
