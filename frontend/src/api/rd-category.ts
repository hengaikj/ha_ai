import { request } from "@/api/http";
import { createIdempotencyKey } from "@/utils/idempotency";
import type {
  RdCategoryOption,
  RdGroup,
  RdGroupSavePayload,
  RdProfession,
  RdProfessionCategoryReplacePayload,
  RdProfessionSavePayload,
} from "@/types/rd-category";

function mutationId(prefix: string) {
  return createIdempotencyKey(prefix);
}

function mutationHeaders(requestId: string) {
  return { "Idempotency-Key": requestId };
}

export function normalizeRdCategoryIds(categoryIds: number[]) {
  return [
    ...new Set(
      categoryIds.filter(
        (categoryId) => Number.isFinite(categoryId) && categoryId > 0,
      ),
    ),
  ];
}

export function fetchRdGroups(): Promise<RdGroup[]> {
  return request<RdGroup[]>({
    url: "/base/rd-categories/groups",
    method: "get",
  });
}

export function saveRdGroup(
  payload: Omit<RdGroupSavePayload, "requestId">,
  id?: number,
): Promise<RdGroup> {
  const requestId = mutationId("rd-group");
  const body = { ...payload, requestId };
  return request<RdGroup>({
    url: id ? `/base/rd-categories/groups/${id}` : "/base/rd-categories/groups",
    method: id ? "put" : "post",
    data: body,
    headers: mutationHeaders(requestId),
  });
}

export function deleteRdGroup(id: number): Promise<void> {
  const requestId = mutationId("rd-group-delete");
  return request<void>({
    url: `/base/rd-categories/groups/${id}`,
    method: "delete",
    data: { requestId },
    headers: mutationHeaders(requestId),
  });
}

export function fetchRdProfessions(groupId?: number): Promise<RdProfession[]> {
  return request<RdProfession[]>({
    url: "/base/rd-categories/professions",
    method: "get",
    params: groupId ? { groupId } : undefined,
  });
}

export function saveRdProfession(
  payload: Omit<RdProfessionSavePayload, "requestId">,
  id?: number,
): Promise<RdProfession> {
  const requestId = mutationId("rd-profession");
  const body = { ...payload, requestId };
  return request<RdProfession>({
    url: id
      ? `/base/rd-categories/professions/${id}`
      : "/base/rd-categories/professions",
    method: id ? "put" : "post",
    data: body,
    headers: mutationHeaders(requestId),
  });
}

export function deleteRdProfession(id: number): Promise<void> {
  const requestId = mutationId("rd-profession-delete");
  return request<void>({
    url: `/base/rd-categories/professions/${id}`,
    method: "delete",
    data: { requestId },
    headers: mutationHeaders(requestId),
  });
}

export function fetchRdCategoryOptions(): Promise<RdCategoryOption[]> {
  return request<RdCategoryOption[]>({
    url: "/base/rd-categories/category-options",
    method: "get",
  });
}

export function fetchRdProfessionCategories(
  professionId: number,
): Promise<RdCategoryOption[]> {
  return request<RdCategoryOption[]>({
    url: `/base/rd-categories/professions/${professionId}/categories`,
    method: "get",
  });
}

export function replaceRdProfessionCategories(
  professionId: number,
  categoryIds: number[],
): Promise<void> {
  const requestId = mutationId("rd-profession-category");
  const payload: RdProfessionCategoryReplacePayload = {
    requestId,
    categoryIds: normalizeRdCategoryIds(categoryIds),
  };
  return request<void>({
    url: `/base/rd-categories/professions/${professionId}/categories`,
    method: "put",
    data: payload,
    headers: mutationHeaders(requestId),
  });
}
