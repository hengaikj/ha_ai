import type { AuditDomain } from "@/types/revenue";

/** 项目列表进入阶段详情页时的路由目标配置 */
export interface ProjectListStageDetailTarget {
  path: string;
  subjectDomain: AuditDomain;
  action: string;
  subjectApiMode?: string;
  selectedSourceStage?: string;
  readonlyAuthorizedScope?: string;
  /** 路由 query.stage 覆盖值（缺省时用当前行阶段） */
  stage?: string;
  /** 只读查看时展示的阶段（如 S2 用户看 S3 项目） */
  readonlyStage?: string;
}

export function resolveProjectListStageDetailMenuKey(options?: {
  currentMenuKey?: string;
  stageCode?: string;
}): string;

export function resolveProjectListStageDetailTarget(options?: {
  stageCode?: string;
  actionKey?: string;
  hasAction?: (key: string) => boolean;
  isSuperAdmin?: boolean;
}): ProjectListStageDetailTarget | null;
