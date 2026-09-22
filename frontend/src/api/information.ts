import { request } from "@/api/http";
import { createIdempotencyKey } from "@/utils/idempotency";
import { resolveServerTotal } from "@/utils/pagination";
import type { TaskCenterTaskResponse } from "@/types/task-center";
import type {
  BackendId,
  InformationDictionaryItem,
  InformationDictionaryModuleType,
  InformationDictionaryPageResponse,
  InformationDictionaryPayload,
  InformationDictionaryQuery,
} from "@/types/information";

type SysCompetitor = {
  id?: BackendId;
  competitorName?: string;
  brandName?: string;
  salesNum?: string | number;
  actualPrice?: string | number;
  guidePrice?: string | number;
  status?: string;
  remark?: string;
  createTime?: string;
};

export type CompetitorExportTask = {
  taskId: string;
  taskNo: string;
};

function mapCompetitor(item: SysCompetitor): InformationDictionaryItem {
  return {
    itemId: item.id ?? item.competitorName ?? "",
    moduleType: "competitors",
    code: String(item.id ?? item.competitorName ?? ""),
    name: item.competitorName ?? "",
    brand: item.brandName ?? null,
    level: item.salesNum === undefined ? null : String(item.salesNum),
    sortNo: Number(item.actualPrice ?? 0),
    status: item.status === "1" ? "DISABLED" : "ENABLED",
    remark:
      item.guidePrice === undefined || item.guidePrice === null
        ? (item.remark ?? null)
        : String(item.guidePrice),
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function competitorPayload(data: InformationDictionaryPayload, id?: BackendId) {
  const salesNum = parsePositiveInteger(data.level);
  return {
    id,
    competitorName: data.name,
    brandName: data.brand ?? undefined,
    salesNum,
    actualPrice: data.sortNo ?? 0,
    guidePrice: data.remark ? Number(data.remark) : 0,
    remark: data.remark ?? undefined,
  };
}

function parsePositiveInteger(value?: string | number | null): number {
  const text = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(text)) {
    throw new Error("请输入正整数");
  }
  return Number(text);
}

export async function fetchInformationDictionaryItems(
  moduleType: InformationDictionaryModuleType,
  params: InformationDictionaryQuery,
): Promise<InformationDictionaryPageResponse> {
  if (moduleType !== "competitors") {
    return {
      records: [],
      total: 0,
      pageNo: params.pageNo ?? 1,
      pageSize: params.pageSize ?? 0,
    };
  }

  const response = await request<
    { rows?: SysCompetitor[]; total?: number } | SysCompetitor[]
  >({
    url: "/system/competitor/list",
    method: "get",
    params: {
      pageNum: params.pageNo,
      pageSize: params.pageSize,
      competitorName: params.name ?? params.keyword,
      brandName: params.brand,
      "params[endTime]": params.createdAtEnd,
      "params[beginTime]": params.createdAtStart,
    },
  });

  const source = Array.isArray(response) ? response : (response.rows ?? []);
  const keyword = params.keyword?.trim();
  const records = source
    .map(mapCompetitor)
    .filter(
      (item) =>
        !keyword ||
        item.name.includes(keyword) ||
        item.brand?.includes(keyword),
    );

  return {
    records,
    total: Array.isArray(response)
      ? records.length
      : resolveServerTotal(response.total),
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? records.length,
  };
}

export async function createInformationDictionaryItem(
  moduleType: InformationDictionaryModuleType,
  data: InformationDictionaryPayload,
): Promise<InformationDictionaryItem> {
  if (moduleType !== "competitors") {
    throw new Error(`Unsupported dictionary module: ${moduleType}`);
  }
  await request<void>({
    url: "/system/competitor",
    method: "post",
    data: competitorPayload(data),
  });
  return mapCompetitor(competitorPayload(data));
}

export async function updateInformationDictionaryItem(
  moduleType: InformationDictionaryModuleType,
  itemId: BackendId,
  data: InformationDictionaryPayload,
): Promise<InformationDictionaryItem> {
  if (moduleType !== "competitors") {
    throw new Error(`Unsupported dictionary module: ${moduleType}`);
  }
  await request<void>({
    url: "/system/competitor",
    method: "put",
    data: competitorPayload(data, itemId),
  });
  return mapCompetitor(competitorPayload(data, itemId));
}

export function deleteInformationDictionaryItem(
  moduleType: InformationDictionaryModuleType,
  itemId: BackendId,
  _version?: number,
): Promise<void> {
  void _version;
  if (moduleType !== "competitors") {
    return Promise.resolve();
  }
  return request<void>({
    url: `/system/competitor/${itemId}`,
    method: "delete",
  });
}

export function createCompetitorExportTask(
  params: InformationDictionaryQuery,
): Promise<CompetitorExportTask> {
  return request<CompetitorExportTask>({
    url: "/system/competitor/export/task",
    method: "post",
    params: {
      competitorName: params.name ?? params.keyword,
      brandName: params.brand,
      "params[endTime]": params.createdAtEnd,
      "params[beginTime]": params.createdAtStart,
    },
    headers: {
      "Idempotency-Key": createIdempotencyKey("competitor-export"),
    },
  });
}

export function importCompetitors(file: File): Promise<TaskCenterTaskResponse> {
  const data = new FormData();
  data.append("file", file);
  return request<TaskCenterTaskResponse>({
    url: "/system/competitor/import/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("competitor-import"),
    },
  });
}
