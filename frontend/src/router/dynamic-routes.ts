import type { Router, RouteRecordRaw } from "vue-router";
import ComingSoonPage from "@/pages/ComingSoonPage.vue";
import type { MenuNode } from "@/types/auth";

const COMPONENT_MODULES = import.meta.glob([
  "../pages/**/*.vue",
  "!../pages/ComingSoonPage.vue",
  "!../pages/ComponentGuidePage.vue",
  "!../pages/ForbiddenPage.vue",
  "!../pages/LoginPage.vue",
  "!../pages/NotFoundPage.vue",
]);
const DYNAMIC_ROUTE_PREFIX = "dynamic-";
const MIGRATED_COMPONENT_ALIASES: Record<string, string> = {
  "custom-table/templates/index":
    "../pages/custom-table/TemplateCenterPage.vue",
  "custom-table/categories/index":
    "../pages/custom-table/TemplateCategoryPage.vue",
  "custom-table/designer/index": "../pages/custom-table/TableDesignerPage.vue",
  "custom-table/data-sources/index":
    "../pages/custom-table/TableDataSourcePage.vue",
  "custom-table/runtime/index":
    "../pages/custom-table/runtime/CustTableRuntimeView.vue",
  "data-governance/overview":
    "../pages/data-governance/GovernanceOverviewPage.vue",
  "data-governance/sources":
    "../pages/data-governance/GovernanceSourcePage.vue",
  "data-governance/connections":
    "../pages/data-governance/GovernanceSourcePage.vue",
  "data-governance/ods-batches":
    "../pages/data-governance/GovernanceSourceBatchPage.vue",
  "data-governance/ods-batches/index":
    "../pages/data-governance/GovernanceSourceBatchPage.vue",
  "data-governance/source-batches":
    "../pages/data-governance/GovernanceSourceBatchPage.vue",
  "data-governance/source-batches/index":
    "../pages/data-governance/GovernanceSourceBatchPage.vue",
  "data-governance/jobs": "../pages/data-governance/GovernanceJobPage.vue",
  "data-governance/scripts":
    "../pages/data-governance/GovernanceScriptPage.vue",
  "data-governance/batches": "../pages/data-governance/GovernanceBatchPage.vue",
  "data-governance/lineage":
    "../pages/data-governance/GovernanceLineagePage.vue",
  GovernanceLineage: "../pages/data-governance/GovernanceLineagePage.vue",
  "data-governance/quality-rules":
    "../pages/data-governance/GovernanceQualityRulePage.vue",
  "data-governance/cost-summaries":
    "../pages/data-governance/GovernanceCostSummaryPage.vue",
  "data-governance/ads-results":
    "../pages/data-governance/GovernanceAdsResultPage.vue",
  "system/user/index": "../pages/system/SystemUserPage.vue",
  "system/user/data-permission":
    "../pages/system/SystemUserDataPermissionPage.vue",
  "system/user/authData": "../pages/system/SystemUserDataPermissionPage.vue",
  "system/user/auth-data": "../pages/system/SystemUserDataPermissionPage.vue",
  "system/user-auth/data": "../pages/system/SystemUserDataPermissionPage.vue",
  "system/user/authRole": "../pages/system/SystemUserAuthRolePage.vue",
  "system/user-auth/role": "../pages/system/SystemUserAuthRolePage.vue",
  "system/role/index": "../pages/system/SystemRolePage.vue",
  "system/role/authUser": "../pages/system/SystemRoleAuthUserPage.vue",
  "system/role-auth/user": "../pages/system/SystemRoleAuthUserPage.vue",
  "system/dept/index": "../pages/system/SystemDeptPage.vue",
  "system/menu/index": "../pages/system/SystemMenuPage.vue",
  "system/post/index": "../pages/system/SystemPostPage.vue",
  "system/dict/index": "../pages/system/SystemDictPage.vue",
  "system/dict/data": "../pages/system/SystemDictDetailPage.vue",
  "system/config/index": "../pages/system/SystemConfigPage.vue",
  "system/task-center/index": "../pages/system/task-center/index.vue",
  "system/TaskCenterPage": "../pages/system/task-center/index.vue",
  "monitor/operlog/index": "../pages/system/SystemOperationLogPage.vue",
  "monitor/logininfor/index": "../pages/system/SystemLoginLogPage.vue",
  "monitor/online/index": "../pages/system/OnlineUserPage.vue",
  "monitor/job/index": "../pages/system/SchedulerManagementPage.vue",
  "monitor/druid/index": "../pages/system/DruidMonitorPage.vue",
  "monitor/server/index": "../pages/system/ServerMonitorPage.vue",
  "monitor/cache/index": "../pages/system/CacheMonitorPage.vue",
  "monitor/cache/list": "../pages/system/CacheListPage.vue",
  "monitor/service/index": "../pages/system/MicroserviceMonitorPage.vue",
  "monitor/notification/index":
    "../pages/system/NotificationManagementPage.vue",
  "system/NotificationManagementPage":
    "../pages/system/NotificationManagementPage.vue",
  "system/SystemMenuPage": "../pages/system/SystemMenuPage.vue",
  "system/SystemPostPage": "../pages/system/SystemPostPage.vue",
  "system/SystemDictPage": "../pages/system/SystemDictPage.vue",
  "system/SystemDictDetailPage": "../pages/system/SystemDictDetailPage.vue",
  "system/SystemConfigPage": "../pages/system/SystemConfigPage.vue",
  "system/SystemOperationLogPage": "../pages/system/SystemOperationLogPage.vue",
  "system/SystemLoginLogPage": "../pages/system/SystemLoginLogPage.vue",
  "system/OnlineUserPage": "../pages/system/OnlineUserPage.vue",
  "system/SchedulerManagementPage":
    "../pages/system/SchedulerManagementPage.vue",
  "system/DruidMonitorPage": "../pages/system/DruidMonitorPage.vue",
  "system/ServerMonitorPage": "../pages/system/ServerMonitorPage.vue",
  "system/CacheMonitorPage": "../pages/system/CacheMonitorPage.vue",
  "system/CacheListPage": "../pages/system/CacheListPage.vue",
  "system/MicroserviceMonitorPage":
    "../pages/system/MicroserviceMonitorPage.vue",
  "committee/dashboard/index": "../pages/committee/CommitteeDashboardPage.vue",
  "committee/projects/index": "../pages/committee/CommitteeProjectListPage.vue",
  "committee/reviews/index": "../pages/committee/CommitteeReviewListPage.vue",
  "committee/meetings/second/index":
    "../pages/committee/CommitteeMeetingListPage.vue",
  "committee/meetings/group/index":
    "../pages/committee/CommitteeMeetingListPage.vue",
  "committee/meetings/departments/index":
    "../pages/committee/CommitteeReviewDepartmentConfigPage.vue",
  "committee/meetings/materials/index":
    "../pages/committee/CommitteeMaterialTemplatePage.vue",
  "committee/rectifications/index":
    "../pages/committee/CommitteeRectificationPage.vue",
  "committee/config/index": "../pages/committee/CommitteeConfigPage.vue",
  "system/project/index": "../pages/project/ProjectManagementPage.vue",
  "project/index": "../pages/project/ProjectManagementPage.vue",
  "project/projects/index": "../pages/project/ProjectManagementPage.vue",
  "project/ProjectManagementPage": "../pages/project/ProjectManagementPage.vue",
  "system/vehicle/model/index": "../pages/vehicle/VehicleModelPage.vue",
  "project/vehicle-models/index": "../pages/vehicle/VehicleModelPage.vue",
  "vehicle/VehicleModelPage": "../pages/vehicle/VehicleModelPage.vue",
  "system/pattern/index": "../pages/project/PatternManagementPage.vue",
  "project/patterns/index": "../pages/project/PatternManagementPage.vue",
  "project/PatternManagementPage": "../pages/project/PatternManagementPage.vue",
  "system/brand/index": "../pages/information/BrandManagementPage.vue",
  "information/brands/index": "../pages/information/BrandManagementPage.vue",
  "system/competitor/index":
    "../pages/information/CompetitorManagementPage.vue",
  "information/competitors/index":
    "../pages/information/CompetitorManagementPage.vue",
  "system/valve/index": "../pages/information/ValveManagementPage.vue",
  "information/valves/index": "../pages/information/ValveManagementPage.vue",
  "system/category/index": "../pages/information/CostCategoryPage.vue",
  "information/cost-categories/index":
    "../pages/information/CostCategoryPage.vue",
  "system/grade/index": "../pages/information/BudgetGradePage.vue",
  "information/budget-grades/index": "../pages/information/BudgetGradePage.vue",
  "system/sor/index": "../pages/information/SorManagementPage.vue",
  "information/sors/index": "../pages/information/SorManagementPage.vue",
  "system/expenses/index": "../pages/revenue/expenses/index.vue",
  "expenses/index": "../pages/revenue/expenses/index.vue",
  "revenue/expenses/index": "../pages/revenue/expenses/index.vue",
  "information/expenses/index": "../pages/revenue/expenses/index.vue",
  "information/revenue-subjects/index":
    "../pages/revenue/expenses/index.vue",
  "system/coefficient/index": "../pages/information/CostCoefficientPage.vue",
  "information/cost-coefficients/index":
    "../pages/information/CostCoefficientPage.vue",
  "system/presetcolumn/index": "../pages/information/PresetColumnListPage.vue",
  "information/preset-columns/index":
    "../pages/information/PresetColumnListPage.vue",
  "information/preset-columns/form":
    "../pages/information/PresetColumnFormPage.vue",
  "system/log/index": "../pages/information/CostErrorLogPage.vue",
  "information/cost-error-logs/index":
    "../pages/information/CostErrorLogPage.vue",
  "information/kanban/index": "../pages/information/InformationKanbanPage.vue",
  "system/kanban/currentProduction/index":
    "../pages/information/InformationKanbanPage.vue",
  "information/kanban/current-production/index":
    "../pages/information/InformationKanbanPage.vue",
  "system/kanban/mechanized/index":
    "../pages/information/MechanizedKanbanPage.vue",
  "information/kanban/mechanized/index":
    "../pages/information/MechanizedKanbanPage.vue",
  "budget/initiation/index":
    "../pages/budget/BudgetInitiationWorkbenchPage.vue",
  "budget/lixiang/index": "../pages/budget/BudgetInitiationWorkbenchPage.vue",
  "budget/gate-review/index":
    "../pages/budget/clique/BudgetGateReviewWorkbenchPage.vue",
  "budget/clique/index":
    "../pages/budget/clique/BudgetGateReviewWorkbenchPage.vue",
  "budget/evaluation/index": "../pages/budget/BudgetDashboardPage.vue",
  "budget/reports/index": "../pages/budget/BudgetReportsPage.vue",
  "budget/attachments/index": "../pages/budget/BudgetAttachmentsPage.vue",
  "budget/wbs/createreportforms": "../pages/budget/BudgetReportPage.vue",
  "budget/wbs/cliquecreatereportforms":
    "../pages/budget/clique/BudgetGateReviewReportPage.vue",
  "budget/gate-review/generate-report":
    "../pages/budget/clique/BudgetGateReviewReportPage.vue",
  "budget/initiation/version-history":
    "../pages/budget/BudgetVersionHistoryPage.vue",
  "budget/initiation/detail": "../pages/budget/BudgetInitiationDetailPage.vue",
  "budget/lixiang/wbsProjectInfo/index":
    "../pages/budget/BudgetInitiationDetailPage.vue",
  "budget/initiation/versions":
    "../pages/budget/BudgetInitiationHistoryPage.vue",
  "budget/initiation/assess": "../pages/budget/BudgetInitiationAssessPage.vue",
  "budget/gate-review/detail":
    "../pages/budget/clique/BudgetGateReviewDetailPage.vue",
  "budget/clique/detail":
    "../pages/budget/clique/BudgetGateReviewDetailPage.vue",
  "budget/gate-review/history":
    "../pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue",
  "budget/clique/wbs-history-version":
    "../pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue",
  "budget/gate-review/versions":
    "../pages/budget/clique/BudgetGateReviewVersionHistoryPage.vue",
  "budget/clique/history-version":
    "../pages/budget/clique/BudgetGateReviewVersionHistoryPage.vue",
  "budget/gate-review/assess":
    "../pages/budget/clique/BudgetGateReviewAssessPage.vue",
  "budget/clique/assess":
    "../pages/budget/clique/BudgetGateReviewAssessPage.vue",
  "budget/BudgetWorkbenchPage": "../pages/budget/BudgetWorkbenchPage.vue",
  "budget/BudgetInitiationWorkbenchPage":
    "../pages/budget/BudgetInitiationWorkbenchPage.vue",
  "budget/BudgetGateReviewWorkbenchPage":
    "../pages/budget/clique/BudgetGateReviewWorkbenchPage.vue",
  "budget/BudgetDashboardPage": "../pages/budget/BudgetDashboardPage.vue",
  "budget/BudgetReportsPage": "../pages/budget/BudgetReportsPage.vue",
  "budget/BudgetAttachmentsPage": "../pages/budget/BudgetAttachmentsPage.vue",
  "budget/BudgetReportPage": "../pages/budget/BudgetReportPage.vue",
  "budget/BudgetVersionHistoryPage":
    "../pages/budget/BudgetVersionHistoryPage.vue",
  "budget/BudgetInitiationDetailPage":
    "../pages/budget/BudgetInitiationDetailPage.vue",
  "budget/BudgetInitiationHistoryPage":
    "../pages/budget/BudgetInitiationHistoryPage.vue",
  "budget/BudgetInitiationAssessPage":
    "../pages/budget/BudgetInitiationAssessPage.vue",
  "budget/BudgetGateReviewDetailPage":
    "../pages/budget/clique/BudgetGateReviewDetailPage.vue",
  "budget/clique/BudgetGateReviewDetailPage":
    "../pages/budget/clique/BudgetGateReviewDetailPage.vue",
  "budget/BudgetGateReviewHistoryPage":
    "../pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue",
  "budget/clique/BudgetGateReviewWbsHistoryVersionPage":
    "../pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue",
  "budget/clique/BudgetGateReviewVersionHistoryPage":
    "../pages/budget/clique/BudgetGateReviewVersionHistoryPage.vue",
  "budget/BudgetGateReviewAssessPage":
    "../pages/budget/clique/BudgetGateReviewAssessPage.vue",
  "budget/clique/BudgetGateReviewAssessPage":
    "../pages/budget/clique/BudgetGateReviewAssessPage.vue",
  "cost/query/index": "../pages/cost/CostQueryPage.vue",
  "revenue/inquiry/index": "../pages/cost/CostQueryPage.vue",
  "cost/analysis/index": "../pages/cost/CostAnalysisPage.vue",
  "costmanagementnew/analysis-new":
    "../pages/cost/analysis/CostAnalysisWorkbenchPage.vue",
  "revenue/analyze/index": "../pages/cost/CostAnalysisPage.vue",
  "cost/bom/query/index": "../pages/cost/CostBomQueryPage.vue",
  "manageBom/searchBom/index": "../pages/cost/CostBomQueryPage.vue",
  "costmanagement/costbom/index": "../pages/cost/CostBomQueryPage.vue",
  "costmanagementnew/costbom/index": "../pages/cost/CostBomQueryPage.vue",
  "cost/bom/detail": "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "cost/bom/parts/add": "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/bom/parts/edit": "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/bom/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/bom/versions": "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/bom/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/bom/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "cost/bom/purchase-list/index":
    "../pages/cost/bom/purchase-list/PurchaseBomListPage.vue",
  "manageBom/purchaseBom/index":
    "../pages/cost/bom/purchase-list/PurchaseBomListPage.vue",
  "cost/bom/purchase-list/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "cost/bom/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "manageBom/purchaseBom/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "cost/bom/purchase-list/source-parts":
    "../pages/cost/bom/purchase-list/PurchaseBomSourcePartsPage.vue",
  "manageBom/purchaseBom/source-parts":
    "../pages/cost/bom/purchase-list/PurchaseBomSourcePartsPage.vue",
  "cost/bom/purchase-list/diff-analysis":
    "../pages/cost/bom/purchase-list/PurchaseBomDiffAnalysisPage.vue",
  "manageBom/purchaseBom/diff-analysis":
    "../pages/cost/bom/purchase-list/PurchaseBomDiffAnalysisPage.vue",
  "cost/research/project-cost/index":
    "../pages/cost/research/project-cost/ProjectCostViewPage.vue",
  "cost/research/project-cost/detail":
    "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "cost/research/project-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/project-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/project-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/project-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/research/project-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/research/project-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/research/project-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "costmanagementnew/projectcost/index":
    "../pages/cost/research/project-cost/ProjectCostViewPage.vue",
  "costmanagementnew/projectcostnew/index":
    "../pages/cost/research/project-cost/NewProjectCostPage.vue",
  "costmanagementnew/zc/projectcostnew/index":
    "../pages/cost/research/project-cost/NewProjectCostPage.vue",
  "cost/production/production-project/NewProjectCostPage":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "cost/production/project-cost/NewProjectCostPage":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "cost/production/production-project/NewProjectCostViewPage":
    "../pages/cost/production/production-project/NewProjectCostViewPage.vue",
  "cost/production/project-cost/NewProjectCostViewPage":
    "../pages/cost/production/production-project/NewProjectCostViewPage.vue",
  "cost/research/new-project-cost/detail":
    "../pages/cost/research/project-cost/NewProjectCostViewPage.vue",
  "cost/research/new-project-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/new-project-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/new-project-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/new-project-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/research/new-project-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/research/new-project-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/research/new-project-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "cost/research/detail": "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "cost/research/parts/add": "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/research/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/research/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/research/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "cost/research/history/index":
    "../pages/cost/research/history/CostResearchHistoryPage.vue",
  "cost/research/new-history/index":
    "../pages/cost/research/history/NewCostResearchHistoryPage.vue",
  "cost/research/new-history/detail":
    "../pages/cost/research/history/NewCostResearchHistoryViewPage.vue",
  "cost/research/new-history/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/new-history/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/new-history/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/new-history/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/research/new-history/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/research/new-history/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/research/new-history/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "cost/research/history/detail":
    "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "cost/research/history/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/history/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/history/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/research/history/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/research/history/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/research/history/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/research/history/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "costmanagementnew/costbomtwo/index":
    "../pages/cost/research/history/CostResearchHistoryPage.vue",
  "costmanagementnew/costbomshree/index":
    "../pages/cost/research/history/NewCostResearchHistoryPage.vue",
  "cost/research/meeting-import/index":
    "../pages/cost/research/meeting-import/MeetingImportPage.vue",
  "costmanagementnew/meetPrice/index":
    "../pages/cost/research/meeting-import/MeetingImportPage.vue",
  "cost/research/evaluation-import/index":
    "../pages/cost/research/evaluation-import/EvaluationImportPage.vue",
  "costmanagementnew/oaPrice/index":
    "../pages/cost/research/evaluation-import/EvaluationImportPage.vue",
  "cost/CostQueryPage": "../pages/cost/CostQueryPage.vue",
  "cost/CostAnalysisPage": "../pages/cost/CostAnalysisPage.vue",
  "cost/CostBomQueryPage": "../pages/cost/CostBomQueryPage.vue",
  "cost/cost-bom/CostBomDetailPage":
    "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "cost/cost-bom/CostBomPartEditorPage":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "cost/cost-bom/CostBomPartHistoryPage":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "cost/cost-bom/CostBomVersionHistoryPage":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "cost/cost-bom/CostBomVersionComparePage":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "cost/cost-bom/CostBomPartComparePage":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
};
const MIGRATED_ROUTE_PATH_ALIASES: Record<string, string> = {
  "/committee/dashboard": "../pages/committee/CommitteeDashboardPage.vue",
  "/committee/projects": "../pages/committee/CommitteeProjectListPage.vue",
  "/committee/projects/create":
    "../pages/committee/CommitteeProjectOnboardingPage.vue",
  "/committee/projects/:projectId/edit":
    "../pages/committee/CommitteeProjectOnboardingPage.vue",
  "/committee/reviews": "../pages/committee/CommitteeReviewListPage.vue",
  "/committee/reviews/tracking":
    "../pages/committee/CommitteeReviewListPage.vue",
  "/committee/reviews/:taskId":
    "../pages/committee/CommitteeReviewDetailPage.vue",
  "/committee/reviews/:taskId/confirm":
    "../pages/committee/CommitteeReviewDetailPage.vue",
  "/committee/reviews/:taskId/versions":
    "../pages/committee/CommitteeReviewDetailPage.vue",
  "/committee/meetings/second":
    "../pages/committee/CommitteeMeetingListPage.vue",
  "/committee/meetings/group":
    "../pages/committee/CommitteeMeetingListPage.vue",
  "/committee/meetings/departments":
    "../pages/committee/CommitteeReviewDepartmentConfigPage.vue",
  "/committee/meetings/materials":
    "../pages/committee/CommitteeMaterialTemplatePage.vue",
  "/committee/meetings/:level/create":
    "../pages/committee/CommitteeMeetingFormPage.vue",
  "/committee/meetings/:level/:meetingId/edit":
    "../pages/committee/CommitteeMeetingFormPage.vue",
  "/committee/meetings/:level/:meetingId":
    "../pages/committee/CommitteeMeetingDetailPage.vue",
  "/committee/meetings/group/:meetingId/material/edit":
    "../pages/committee/CommitteeGroupMaterialEditPage.vue",
  "/committee/meetings/group/:meetingId/material/display":
    "../pages/committee/CommitteeGroupMaterialDisplayPage.vue",
  "/committee/meetings/group/:meetingId/material/ai":
    "../pages/committee/CommitteeAiMaterialPage.vue",
  "/committee/snapshots": "../pages/committee/CommitteeSnapshotPage.vue",
  "/committee/snapshots/:snapshotId":
    "../pages/committee/CommitteeSnapshotPage.vue",
  "/committee/projects/:projectId/gates/:gateId/meeting-history":
    "../pages/committee/CommitteeMeetingHistoryPage.vue",
  "/committee/rectifications":
    "../pages/committee/CommitteeRectificationPage.vue",
  "/committee/config": "../pages/committee/CommitteeConfigPage.vue",
  "/custom-table/templates": "../pages/custom-table/TemplateCenterPage.vue",
  "/custom-table/categories": "../pages/custom-table/TemplateCategoryPage.vue",
  "/custom-table/designer": "../pages/custom-table/TableDesignerPage.vue",
  "/custom-table/data-sources": "../pages/custom-table/TableDataSourcePage.vue",
  "/custom-table/runtime/:workbookId":
    "../pages/custom-table/runtime/CustTableRuntimeView.vue",
  "/data-governance/sources":
    "../pages/data-governance/GovernanceSourcePage.vue",
  "/data-governance/connections":
    "../pages/data-governance/GovernanceSourcePage.vue",
  "/data-governance/ads-results":
    "../pages/data-governance/GovernanceAdsResultPage.vue",
  "/system/user-auth/data": "../pages/system/SystemUserDataPermissionPage.vue",
  "/system/user-auth/role": "../pages/system/SystemUserAuthRolePage.vue",
  "/system/role-auth/user": "../pages/system/SystemRoleAuthUserPage.vue",
  "/project/project": "../pages/project/ProjectManagementPage.vue",
  "/information/brands": "../pages/information/BrandManagementPage.vue",
  "/information/competitors":
    "../pages/information/CompetitorManagementPage.vue",
  "/information/valves": "../pages/information/ValveManagementPage.vue",
  "/information/cost-categories": "../pages/information/CostCategoryPage.vue",
  "/information/budget-grades": "../pages/information/BudgetGradePage.vue",
  "/information/sors": "../pages/information/SorManagementPage.vue",
  "/information/expenses": "../pages/revenue/expenses/index.vue",
  "/information/revenue-subjects": "../pages/revenue/expenses/index.vue",
  "/expenses": "../pages/revenue/expenses/index.vue",
  "/system/expenses": "../pages/revenue/expenses/index.vue",
  "/information/cost-coefficients":
    "../pages/information/CostCoefficientPage.vue",
  "/information/preset-columns":
    "../pages/information/PresetColumnListPage.vue",
  "/information/preset-columns/form":
    "../pages/information/PresetColumnFormPage.vue",
  "/information/cost-error-logs": "../pages/information/CostErrorLogPage.vue",
  "/information/kanban": "../pages/information/InformationKanbanPage.vue",
  "/information/kanban/current-production":
    "../pages/information/InformationKanbanPage.vue",
  "/information/kanban/mechanized":
    "../pages/information/MechanizedKanbanPage.vue",
  "/budget/initiation": "../pages/budget/BudgetInitiationWorkbenchPage.vue",
  "/budget/lixiang": "../pages/budget/BudgetInitiationWorkbenchPage.vue",
  "/budget/gate-review":
    "../pages/budget/clique/BudgetGateReviewWorkbenchPage.vue",
  "/budget/clique": "../pages/budget/clique/BudgetGateReviewWorkbenchPage.vue",
  "/budget/evaluation": "../pages/budget/BudgetDashboardPage.vue",
  "/budget/reports": "../pages/budget/BudgetReportsPage.vue",
  "/budget/attachments": "../pages/budget/BudgetAttachmentsPage.vue",
  "/budget/wbs/createreportforms": "../pages/budget/BudgetReportPage.vue",
  "/budget/wbs/cliquecreatereportforms":
    "../pages/budget/clique/BudgetGateReviewReportPage.vue",
  "/budget/gate-review/generate-report":
    "../pages/budget/clique/BudgetGateReviewReportPage.vue",
  "/budget/initiation/version-history":
    "../pages/budget/BudgetVersionHistoryPage.vue",
  "/budget/initiation/detail": "../pages/budget/BudgetInitiationDetailPage.vue",
  "/budget/lixiang/wbsProjectInfo":
    "../pages/budget/BudgetInitiationDetailPage.vue",
  "/budget/initiation/versions":
    "../pages/budget/BudgetInitiationHistoryPage.vue",
  "/budget/initiation/assess": "../pages/budget/BudgetInitiationAssessPage.vue",
  "/budget/gate-review/detail":
    "../pages/budget/clique/BudgetGateReviewDetailPage.vue",
  "/budget/clique/detail":
    "../pages/budget/clique/BudgetGateReviewDetailPage.vue",
  "/budget/gate-review/history":
    "../pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue",
  "/budget/clique/wbs-history-version":
    "../pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue",
  "/budget/gate-review/versions":
    "../pages/budget/clique/BudgetGateReviewVersionHistoryPage.vue",
  "/budget/clique/history-version":
    "../pages/budget/clique/BudgetGateReviewVersionHistoryPage.vue",
  "/budget/gate-review/assess":
    "../pages/budget/clique/BudgetGateReviewAssessPage.vue",
  "/budget/clique/assess":
    "../pages/budget/clique/BudgetGateReviewAssessPage.vue",
  "/cost/query": "../pages/cost/CostQueryPage.vue",
  "/costmanagementnew/inquiry": "../pages/cost/CostQueryPage.vue",
  "/cost/analysis": "../pages/cost/CostAnalysisPage.vue",
  "/costmanagementnew/analysis-new":
    "../pages/cost/analysis/CostAnalysisWorkbenchPage.vue",
  "/costmanagementnew/analyze": "../pages/cost/CostAnalysisPage.vue",
  "/cost/bom/query": "../pages/cost/CostBomQueryPage.vue",
  "/costmanagementnew/manageBom/searchBom":
    "../pages/cost/CostBomQueryPage.vue",
  "/cost/bom/detail": "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "/cost/bom/parts/add": "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/bom/parts/edit": "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/bom/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/bom/versions": "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/bom/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/bom/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/bom/purchase-list":
    "../pages/cost/bom/purchase-list/PurchaseBomListPage.vue",
  "/costmanagementnew/manageBom/purchaseBom":
    "../pages/cost/bom/purchase-list/PurchaseBomListPage.vue",
  "/manageBom/purchaseBom":
    "../pages/cost/bom/purchase-list/PurchaseBomListPage.vue",
  "/cost/bom/purchase-list/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "/cost/bom/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "/manageBom/purchaseBom/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "/costmanagementnew/manageBom/purchaseBom/reorganize":
    "../pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue",
  "/cost/bom/purchase-list/source-parts":
    "../pages/cost/bom/purchase-list/PurchaseBomSourcePartsPage.vue",
  "/manageBom/purchaseBom/source-parts":
    "../pages/cost/bom/purchase-list/PurchaseBomSourcePartsPage.vue",
  "/costmanagementnew/manageBom/purchaseBom/source-parts":
    "../pages/cost/bom/purchase-list/PurchaseBomSourcePartsPage.vue",
  "/cost/bom/purchase-list/diff-analysis":
    "../pages/cost/bom/purchase-list/PurchaseBomDiffAnalysisPage.vue",
  "/manageBom/purchaseBom/diff-analysis":
    "../pages/cost/bom/purchase-list/PurchaseBomDiffAnalysisPage.vue",
  "/costmanagementnew/manageBom/purchaseBom/diff-analysis":
    "../pages/cost/bom/purchase-list/PurchaseBomDiffAnalysisPage.vue",
  "/cost/research/project-cost":
    "../pages/cost/research/project-cost/ProjectCostViewPage.vue",
  "/cost/research/project-cost/detail":
    "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "/cost/research/project-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/project-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/project-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/project-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/research/project-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/research/project-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/research/project-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/costmanagementnew/projectcost":
    "../pages/cost/research/project-cost/ProjectCostViewPage.vue",
  "/costmanagementnew/projectcostnew":
    "../pages/cost/research/project-cost/NewProjectCostPage.vue",
  "/costmanagementnew/zy/projectcost":
    "../pages/cost/research/project-cost/ProjectCostViewPage.vue",
  "/costmanagementnew/zy/projectcostnew":
    "../pages/cost/research/project-cost/NewProjectCostPage.vue",
  "/costmanagementnew/zc/projectcostnew":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "/costmanagementnew/zc/cost/production/project-cost":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "/new-production-cost":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "/new-production-cost/detail":
    "../pages/cost/production/production-project/NewProjectCostViewPage.vue",
  "/new-production-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/new-production-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/new-production-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/new-production-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/new-production-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/new-production-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/new-production-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/production/new-production-cost":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "/cost/production/new-production-cost/detail":
    "../pages/cost/production/production-project/NewProjectCostViewPage.vue",
  "/cost/production/new-production-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/production/new-production-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/production/new-production-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/production/new-production-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/production/new-production-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/production/new-production-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/production/new-production-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/research/new-project-cost":
    "../pages/cost/research/project-cost/NewProjectCostPage.vue",
  "/cost/research/new-project-cost/detail":
    "../pages/cost/research/project-cost/NewProjectCostViewPage.vue",
  "/cost/research/new-project-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/new-project-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/new-project-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/new-project-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/research/new-project-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/research/new-project-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/research/new-project-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/production/project-cost":
    "../pages/cost/production/production-project/NewProjectCostPage.vue",
  "/cost/production/project-cost/detail":
    "../pages/cost/production/production-project/NewProjectCostViewPage.vue",
  "/cost/production/project-cost/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/production/project-cost/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/production/project-cost/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/production/project-cost/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/production/project-cost/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/production/project-cost/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/production/project-cost/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/research/detail": "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "/cost/research/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/research/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/research/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/research/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/research/history":
    "../pages/cost/research/history/CostResearchHistoryPage.vue",
  "/cost/research/new-history":
    "../pages/cost/research/history/NewCostResearchHistoryPage.vue",
  "/cost/research/new-history/detail":
    "../pages/cost/research/history/NewCostResearchHistoryViewPage.vue",
  "/cost/research/new-history/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/new-history/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/new-history/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/new-history/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/research/new-history/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/research/new-history/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/research/new-history/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/cost/research/history/detail":
    "../pages/cost/cost-bom/CostBomDetailPage.vue",
  "/cost/research/history/parts/add":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/history/parts/edit":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/history/parts/copy":
    "../pages/cost/cost-bom/CostBomPartEditorPage.vue",
  "/cost/research/history/parts/histories":
    "../pages/cost/cost-bom/CostBomPartHistoryPage.vue",
  "/cost/research/history/versions":
    "../pages/cost/cost-bom/CostBomVersionHistoryPage.vue",
  "/cost/research/history/versions/compare":
    "../pages/cost/cost-bom/CostBomVersionComparePage.vue",
  "/cost/research/history/versions/compare/parts":
    "../pages/cost/cost-bom/CostBomPartComparePage.vue",
  "/costmanagementnew/zy/costbomtwo":
    "../pages/cost/research/history/CostResearchHistoryPage.vue",
  "/costmanagementnew/zy/costbom":
    "../pages/cost/research/history/NewCostResearchHistoryPage.vue",
  "/costmanagementnew/zy/costbomshree":
    "../pages/cost/research/history/NewCostResearchHistoryPage.vue",
  "/cost/research/meeting-import":
    "../pages/cost/research/meeting-import/MeetingImportPage.vue",
  "/costmanagementnew/zy/meetPrice":
    "../pages/cost/research/meeting-import/MeetingImportPage.vue",
  "/cost/research/evaluation-import":
    "../pages/cost/research/evaluation-import/EvaluationImportPage.vue",
  "/costmanagementnew/zy/oaPrice":
    "../pages/cost/research/evaluation-import/EvaluationImportPage.vue",
};
const MIGRATED_ROUTE_META_ALIASES: Record<string, Record<string, unknown>> = {
  "/committee/meetings/second": { committeeLevel: "SECOND" },
  "/committee/meetings/group": { committeeLevel: "GROUP" },
  "/budget/initiation": { budgetPageType: "initiation" },
  "/budget/lixiang": { budgetPageType: "initiation" },
  "/budget/gate-review": { budgetPageType: "gate-review" },
  "/budget/clique": { budgetPageType: "gate-review" },
  "/budget/clique/detail": {
    title: "过阀评审查看",
    hidden: true,
  },
  "/budget/gate-review/detail": {
    title: "过阀评审查看",
    hidden: true,
  },
  "/budget/clique/wbs-history-version": {
    title: "WBS过阀历史版本",
    hidden: true,
  },
  "/budget/gate-review/history": {
    title: "WBS过阀历史版本",
    hidden: true,
  },
  "/budget/clique/history-version": {
    title: "过阀评审历史版本",
    hidden: true,
  },
  "/budget/gate-review/versions": {
    title: "过阀评审历史版本",
    hidden: true,
  },
  "/budget/clique/assess": {
    title: "过阀预算评审",
    hidden: true,
  },
  "/budget/gate-review/assess": {
    title: "过阀预算评审",
    hidden: true,
  },
};

const MIGRATED_ROUTE_ALIASES: Record<string, string> = {
  "/data-governance/connections": "/data-governance/sources",
  "/data-governance/sources": "/data-governance/connections",
  "/new-production-cost": "/cost/production/new-production-cost",
  "/new-production-cost/detail": "/cost/production/new-production-cost/detail",
  "/new-production-cost/parts/add":
    "/cost/production/new-production-cost/parts/add",
  "/new-production-cost/parts/edit":
    "/cost/production/new-production-cost/parts/edit",
  "/new-production-cost/parts/copy":
    "/cost/production/new-production-cost/parts/copy",
  "/new-production-cost/parts/histories":
    "/cost/production/new-production-cost/parts/histories",
  "/new-production-cost/versions":
    "/cost/production/new-production-cost/versions",
  "/new-production-cost/versions/compare":
    "/cost/production/new-production-cost/versions/compare",
  "/new-production-cost/versions/compare/parts":
    "/cost/production/new-production-cost/versions/compare/parts",
  "/cost/production/project-cost": "/cost/production/new-production-cost",
  "/cost/production/project-cost/detail":
    "/cost/production/new-production-cost/detail",
  "/cost/production/project-cost/parts/add":
    "/cost/production/new-production-cost/parts/add",
  "/cost/production/project-cost/parts/edit":
    "/cost/production/new-production-cost/parts/edit",
  "/cost/production/project-cost/parts/copy":
    "/cost/production/new-production-cost/parts/copy",
  "/cost/production/project-cost/parts/histories":
    "/cost/production/new-production-cost/parts/histories",
  "/cost/production/project-cost/versions":
    "/cost/production/new-production-cost/versions",
  "/cost/production/project-cost/versions/compare":
    "/cost/production/new-production-cost/versions/compare",
  "/cost/production/project-cost/versions/compare/parts":
    "/cost/production/new-production-cost/versions/compare/parts",
};

const REMOVED_ROUTE_PATH_PREFIXES = ["/cost/production/new-project-cost"];

function isRemovedRoutePath(path: string): boolean {
  return REMOVED_ROUTE_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function resolveMigratedRouteMeta(
  path: string,
  component?: string,
): Record<string, unknown> {
  const normalizedPath = path.replace(/\/$/, "");
  if (normalizedPath.startsWith("/cost/research/new-history/")) {
    return {
      pageFullscreenGroup: "cost-research-new-history",
    };
  }
  if (normalizedPath.startsWith("/committee/meetings/second/")) {
    return {
      activeMenu: "/committee/meetings/second",
      breadcrumbParentPath: "/committee/meetings/second",
    };
  }
  if (normalizedPath.startsWith("/committee/meetings/group/")) {
    return {
      activeMenu: "/committee/meetings/group",
      breadcrumbParentPath: "/committee/meetings/group",
    };
  }
  if (normalizedPath.startsWith("/committee/projects/")) {
    return {
      activeMenu: "/committee/projects",
      breadcrumbParentPath: "/committee/projects",
    };
  }
  if (
    normalizedPath === "/cost/production/new-production-cost" ||
    normalizedPath === "/new-production-cost" ||
    normalizedPath === "/costmanagementnew/zc/projectcostnew" ||
    normalizedPath === "/costmanagementnew/zc/cost/production/project-cost" ||
    normalizedPath === "/cost/production/project-cost"
  ) {
    return {
      activeMenu: "/cost/production/project-cost",
    };
  }
  if (
    normalizedPath.startsWith(
      "/costmanagementnew/zc/cost/production/project-cost/",
    ) ||
    normalizedPath.startsWith("/cost/production/project-cost/") ||
    normalizedPath.startsWith("/costmanagementnew/zc/projectcostnew/") ||
    normalizedPath.startsWith("/cost/production/new-production-cost/") ||
    normalizedPath.startsWith("/new-production-cost/")
  ) {
    return {
      activeMenu: "/cost/production/project-cost",
      breadcrumbParentPath: "/cost/production/project-cost",
    };
  }
  if (normalizedPath.startsWith("/committee/reviews/")) {
    return {
      activeMenu: "/committee/reviews",
      breadcrumbParentPath: "/committee/reviews",
    };
  }
  if (
    normalizedPath === "/cost/bom/purchase-list/reorganize" ||
    normalizedPath === "/cost/bom/reorganize" ||
    normalizedPath === "/manageBom/purchaseBom/reorganize" ||
    normalizedPath ===
      "/costmanagementnew/manageBom/purchaseBom/reorganize"
  ) {
    return {
      activeMenu: "/cost/bom/purchase-list",
      breadcrumbParentPath: "/cost/bom/purchase-list",
    };
  }
  if (
    /(?:^|\/)clique$|(?:^|\/)gate-review$/.test(normalizedPath) ||
    component?.replace(/^\/+/, "") === "budget/clique/index"
  ) {
    return { budgetPageType: "gate-review" };
  }
  if (
    /(?:^|\/)lixiang$|(?:^|\/)initiation$/.test(normalizedPath) ||
    component?.replace(/^\/+/, "") === "budget/lixiang/index"
  ) {
    return { budgetPageType: "initiation" };
  }
  return MIGRATED_ROUTE_META_ALIASES[path] ?? {};
}

export function normalizeMenuPath(path: string, parentPath = ""): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return parentPath || "/";
  }
  if (/^https?:\/\//.test(trimmedPath)) {
    return trimmedPath;
  }
  if (trimmedPath.startsWith("/")) {
    return trimmedPath;
  }

  const normalizedParent =
    parentPath === "/" ? "" : parentPath.replace(/\/$/, "");
  const parentTopSegment = normalizedParent.split("/").filter(Boolean)[0];
  const pathSegments = trimmedPath.split("/").filter(Boolean);
  const pathTopSegment = pathSegments[0];

  if (
    pathSegments.length > 1 &&
    parentTopSegment &&
    parentTopSegment === pathTopSegment
  ) {
    return `/${trimmedPath}`.replace(/\/+/g, "/");
  }

  return `${normalizedParent}/${trimmedPath}`.replace(/\/+/g, "/");
}

export function createDynamicRouteName(menu: MenuNode): string {
  const source = menu.routeName || menu.code || menu.id || menu.path;
  return `${DYNAMIC_ROUTE_PREFIX}${source}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isVisibleMenu(menu: MenuNode): boolean {
  return menu.visible !== false && !menu.hidden && menu.status !== "1";
}

function isDirectoryMenu(menu: MenuNode): boolean {
  return (
    menu.menuType === "M" ||
    menu.menuType === "DIRECTORY" ||
    Boolean(menu.children?.some((child) => child.menuType !== "F"))
  );
}

function shouldCreateRoute(menu: MenuNode, currentPath: string): boolean {
  const component = menu.component ?? "";
  const hasMigratedPath = Boolean(MIGRATED_ROUTE_PATH_ALIASES[currentPath]);

  // 首页由静态路由统一处理，避免后端返回 / 或 /index 时注册出重复首页。
  if (currentPath === "/" || currentPath === "/index") {
    return false;
  }

  if (isRemovedRoutePath(currentPath)) {
    return false;
  }

  if (isDirectoryMenu(menu) || menu.menuType === "F") {
    return false;
  }

  if (/^https?:\/\//.test(menu.path)) {
    return false;
  }

  if (hasMigratedPath) {
    return true;
  }

  return !["Layout", "ParentView", "InnerLink"].includes(component);
}

function resolveRouteComponent(componentPath?: string, routePath?: string) {
  const pathModuleKey = routePath
    ? MIGRATED_ROUTE_PATH_ALIASES[normalizeMenuPath(routePath)]
    : undefined;
  const normalizedRoutePath = routePath
    ? normalizeMenuPath(routePath).replace(/\/$/, "")
    : "";
  const isProductionProjectCostPath =
    normalizedRoutePath === "/cost/production/project-cost" ||
    normalizedRoutePath.startsWith("/cost/production/project-cost/") ||
    normalizedRoutePath === "/cost/production/new-production-cost" ||
    normalizedRoutePath.startsWith("/cost/production/new-production-cost/") ||
    normalizedRoutePath === "/new-production-cost" ||
    normalizedRoutePath.startsWith("/new-production-cost/") ||
    normalizedRoutePath === "/costmanagementnew/zc/projectcostnew" ||
    normalizedRoutePath.startsWith("/costmanagementnew/zc/projectcostnew/") ||
    normalizedRoutePath ===
      "/costmanagementnew/zc/cost/production/project-cost" ||
    normalizedRoutePath.startsWith(
      "/costmanagementnew/zc/cost/production/project-cost/",
    );

  if (
    componentPath &&
    !["Layout", "ParentView", "InnerLink"].includes(componentPath)
  ) {
    const normalized = componentPath
      .replace(/^@\/pages\//, "")
      .replace(/^\/?src\/pages\//, "")
      .replace(/^\/+/, "")
      .replace(/\.vue$/, "");
    const moduleKey =
      MIGRATED_COMPONENT_ALIASES[normalized] ?? `../pages/${normalized}.vue`;

    return isProductionProjectCostPath
      ? COMPONENT_MODULES[pathModuleKey ?? ""] ??
          COMPONENT_MODULES[moduleKey] ??
          ComingSoonPage
      : COMPONENT_MODULES[moduleKey] ??
          COMPONENT_MODULES[pathModuleKey ?? ""] ??
          ComingSoonPage;
  }

  return COMPONENT_MODULES[pathModuleKey ?? ""] ?? ComingSoonPage;
}

export function buildDynamicRouteRecords(
  menus: MenuNode[],
  parentPath = "",
  parents: Array<{ title: string; path?: string }> = [],
): RouteRecordRaw[] {
  return menus.flatMap((menu) => {
    if (menu.status === "1") {
      return [];
    }

    const currentPath = normalizeMenuPath(menu.path, parentPath);
    const currentBreadcrumb = {
      title: menu.title,
      path:
        isVisibleMenu(menu) && !isDirectoryMenu(menu) && menu.menuType !== "F"
          ? currentPath
          : undefined,
    };
    const breadcrumbTrail = menu.title
      ? [...parents, currentBreadcrumb]
      : parents;
    const childRoutes = buildDynamicRouteRecords(
      menu.children ?? [],
      currentPath,
      breadcrumbTrail,
    );

    if (!shouldCreateRoute(menu, currentPath)) {
      return childRoutes;
    }

    const route: RouteRecordRaw = {
      path: currentPath,
      ...(MIGRATED_ROUTE_ALIASES[currentPath]
        ? { alias: MIGRATED_ROUTE_ALIASES[currentPath] }
        : {}),
      name: createDynamicRouteName(menu),
      component: resolveRouteComponent(menu.component, currentPath),
      meta: {
        ...resolveMigratedRouteMeta(currentPath, menu.component),
        title: menu.title,
        permission: menu.permission,
        dynamic: true,
        menuId: menu.id,
        cacheable: menu.cacheable,
        hidden: !isVisibleMenu(menu),
        breadcrumbs: breadcrumbTrail,
      },
    };

    return [route, ...childRoutes];
  });
}

export function registerDynamicRoutes(
  router: Router,
  menus: MenuNode[],
): string[] {
  const records = buildDynamicRouteRecords(menus);
  const routeNames: string[] = [];

  for (const record of records) {
    const routeName = String(record.name);
    if (!router.hasRoute(routeName)) {
      router.addRoute("app", record);
    }
    routeNames.push(routeName);
  }

  return routeNames;
}

export function removeDynamicRoutes(
  router: Router,
  routeNames: string[],
): void {
  for (const routeName of routeNames) {
    if (router.hasRoute(routeName)) {
      router.removeRoute(routeName);
    }
  }
}
