export type PageLike<T = unknown> = {
  pageNo?: number | string;
  pageNum?: number | string;
  pageSize?: number | string;
  total?: number | string | null;
  hasNext?: boolean;
  records?: T[];
  rows?: T[];
};

export type QueryTablePage<T> = {
  list: T[];
  total: number;
  pageNo: number;
  pageSize: number;
};

export function resolvePageTotal<T>(
  page: PageLike<T>,
  _fallbackPageNo: number,
  _fallbackPageSize: number,
) {
  void _fallbackPageNo;
  void _fallbackPageSize;
  return resolveServerTotal(page.total);
}

export function resolveServerTotal(total: unknown) {
  const parsed = toFiniteNumber(total);
  return parsed !== undefined && parsed >= 0 ? parsed : 0;
}

export function toQueryTableResult<T>(
  page: PageLike<T>,
  fallbackPageNo: number,
  fallbackPageSize: number,
): QueryTablePage<T> {
  return {
    list: page.records ?? page.rows ?? [],
    total: resolvePageTotal(page, fallbackPageNo, fallbackPageSize),
    pageNo: toPositiveInteger(page.pageNo ?? page.pageNum) ?? fallbackPageNo,
    pageSize: toPositiveInteger(page.pageSize) ?? fallbackPageSize,
  };
}

export function paginateArray<T>(
  rows: T[],
  pageNo: number,
  pageSize: number,
): QueryTablePage<T> {
  if (!Number.isInteger(pageNo) || pageNo <= 0) {
    throw new RangeError("页码必须是正整数");
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError("每页条数必须是正整数");
  }
  const start = (pageNo - 1) * pageSize;
  return {
    list: rows.slice(start, start + pageSize),
    total: rows.length,
    pageNo,
    pageSize,
  };
}

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPositiveInteger(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed !== undefined && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}
