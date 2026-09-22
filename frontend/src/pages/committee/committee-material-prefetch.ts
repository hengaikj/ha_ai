import {
  fetchGroupMaterial,
  fetchCommitteeSubtotalWeighted,
} from "@/api/committee";
import type { CommitteeMeeting } from "@/types/committee";

export interface CachedGroupMaterialBundle {
  meeting: CommitteeMeeting;
  subtotalWeightedData: any;
  timestamp: number;
}

const ongoingRequests = new Map<string, Promise<CachedGroupMaterialBundle | null>>();
const latestBundles = new Map<string, CachedGroupMaterialBundle>();

function resolveValvePoint(meeting: CommitteeMeeting): string | undefined {
  const displayGate = meeting.display?.gateInfo;
  const currentGate = meeting.display?.gateProgress?.gates?.find(
    (g: any) => g.current === true,
  );
  const rawValue =
    displayGate?.gateCode ??
    currentGate?.gateCode ??
    meeting.gateName?.match(/G\d+/i)?.[0] ??
    meeting.gateName;
  return rawValue?.trim();
}

/**
 * 在会议详情页、编辑页调取集团会议上会展示数据（每次均实时请求最新数据，不使用阻断刷新的常驻缓存）
 */
export async function prefetchGroupMaterialData(
  meetingId: string | number,
): Promise<CachedGroupMaterialBundle | null> {
  const key = String(meetingId || "").trim();
  if (!key || key === "undefined" || key === "null") return null;

  // 若已有进行中的网络请求，复用同一个 Promise，避免瞬间并发重复请求
  if (ongoingRequests.has(key)) {
    return ongoingRequests.get(key)!;
  }

  const task = (async () => {
    try {
      const meeting = await fetchGroupMaterial(key, true);
      let subtotalWeightedData: any = null;

      const projectName = meeting.projectName?.trim();
      const valvePoint = resolveValvePoint(meeting);
      if (projectName && valvePoint) {
        try {
          subtotalWeightedData = await fetchCommitteeSubtotalWeighted(
            projectName,
            valvePoint,
          );
        } catch {
          // 辅助取数失败不影响主流程
        }
      }

      const bundle: CachedGroupMaterialBundle = {
        meeting,
        subtotalWeightedData,
        timestamp: Date.now(),
      };
      latestBundles.set(key, bundle);
      return bundle;
    } catch (err) {
      console.warn(`⚠️ [材料获取] 获取展示材料失败: meetingId=${key}`, err);
      return null;
    } finally {
      ongoingRequests.delete(key);
    }
  })();

  ongoingRequests.set(key, task);
  return task;
}

/**
 * 获取展示材料数据（展示页面优先调用）：
 * 1. 若前置页面（详情/编辑页）刚刚发起的请求还在传输中，直接复用 Promise 等待完成，绝不重复发请求！
 * 2. 若前置页面刚刚（60秒内）拉取完成，直接复用该数据；
 * 3. 若均无，才发起新的请求。
 */
export async function getOrFetchGroupMaterial(
  meetingId: string | number,
): Promise<CachedGroupMaterialBundle | null> {
  const key = String(meetingId || "").trim();
  if (!key || key === "undefined" || key === "null") return null;

  // 1. 若前置页面发起的请求还在传输中，直接复用等待其返回，绝不发起新请求
  if (ongoingRequests.has(key)) {
    return ongoingRequests.get(key)!;
  }

  // 2. 若前置页面（详情页/编辑页）已拉取完成，直接复用，绝不再发请求
  const cached = latestBundles.get(key);
  if (cached) {
    return cached;
  }

  // 3. 只有均无时（如直接访问展示页），才发起拉取
  return prefetchGroupMaterialData(key);
}

/**
 * 获取最新拉取的材料数据
 */
export function getCachedGroupMaterial(
  meetingId: string | number,
): CachedGroupMaterialBundle | null {
  const key = String(meetingId || "").trim();
  if (!key) return null;
  return latestBundles.get(key) ?? null;
}

/**
 * 清除数据
 */
export function clearGroupMaterialCache(meetingId?: string | number) {
  if (meetingId) {
    const key = String(meetingId).trim();
    latestBundles.delete(key);
    ongoingRequests.delete(key);
  } else {
    latestBundles.clear();
    ongoingRequests.clear();
  }
}
