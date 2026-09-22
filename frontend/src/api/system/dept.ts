import { request } from "@/api/http";
import type { SystemId, SysDept, SysDeptQuery } from "@/types/system";

export function fetchDeptTree(params?: SysDeptQuery): Promise<SysDept[]> {
  return request<SysDept[]>({
    url: "/system/dept/list",
    method: "get",
    params,
  });
}

export function fetchDeptTreeExcludeChild(
  deptId: SystemId,
): Promise<SysDept[]> {
  return request<SysDept[]>({
    url: `/system/dept/list/exclude/${deptId}`,
    method: "get",
  });
}

export function fetchDeptDetail(deptId: SystemId): Promise<SysDept> {
  return request<SysDept>({
    url: `/system/dept/${deptId}`,
    method: "get",
  });
}

export function createDept(data: SysDept): Promise<void> {
  return request<void>({
    url: "/system/dept",
    method: "post",
    data,
  });
}

export function updateDept(data: SysDept): Promise<void> {
  return request<void>({
    url: "/system/dept",
    method: "put",
    data,
  });
}

export function deleteDept(deptId: SystemId): Promise<void> {
  return request<void>({
    url: `/system/dept/${deptId}`,
    method: "delete",
  });
}
