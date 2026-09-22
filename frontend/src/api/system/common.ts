import type {
  SystemId,
  SystemPageQuery,
  SystemPageResponse,
  TableDataInfo,
} from "@/types/system";

export function joinIds(ids: SystemId | SystemId[]): string {
  return Array.isArray(ids) ? ids.join(",") : String(ids);
}

export function mapTableData<T>(
  payload: TableDataInfo<T>,
  query?: SystemPageQuery,
): SystemPageResponse<T> {
  return {
    records: payload.rows ?? [],
    total: payload.total ?? 0,
    pageNum: query?.pageNum,
    pageSize: query?.pageSize,
  };
}
