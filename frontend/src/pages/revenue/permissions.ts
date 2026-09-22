/**
 * 收益权限模块（向后兼容重导出）
 *
 * 原逻辑已迁移至 @/utils/revenue-permissions.ts
 * 本文件保持原有导出接口，确保现有引用无需修改即可平滑过渡
 */
export {
  REVENUE_FLOW_STAGE_PERMISSIONS,
  REVENUE_FORMULA_PERMISSIONS,
  REVENUE_TEMPLATE_PERMISSIONS,
  REVENUE_PERMISSIONS,
  hasRevenuePermission,
  resolveFlowStageIndexPermission,
  resolveFlowStageActionPermission,
  hasFlowStageIndexPermission,
  hasFlowStageActionPermission,
  resolveFlowStageDefaultAction,
  buildFlowStageActions,
  buildS1FlowActions,
} from "@/utils/revenue-permissions";
