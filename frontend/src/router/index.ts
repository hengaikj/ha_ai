import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from "vue-router";
import { ApiBusinessError } from "@/api/http";
import { markOaNotificationReceived } from "@/api/system/expenses";
import AppLayout from "@/layouts/AppLayout.vue";
import ComponentGuidePage from "@/pages/ComponentGuidePage.vue";
import ComingSoonPage from "@/pages/ComingSoonPage.vue";
import ForbiddenPage from "@/pages/ForbiddenPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import {
  normalizeMenuPath,
  registerDynamicRoutes,
  removeDynamicRoutes,
} from "@/router/dynamic-routes";
import { useAuthStore } from "@/stores/auth";
import type { MenuNode } from "@/types/auth";
import { restoreRouteScroll, saveRouteScroll } from "@/utils/route-scroll";

const IndexPage = () => import("@/pages/index.vue");
const ProductionDashboardPage = () =>
  import("@/pages/legacy-dashboard/ProductionDashboardPage.vue");
const VisualDashboardPage = () =>
  import("@/pages/legacy-dashboard/VisualDashboardPage.vue");
const PurchaseDashboardPage = () =>
  import("@/pages/legacy-dashboard/PurchaseDashboardPage.vue");
const UserProfilePage = () => import("@/pages/user/UserProfilePage.vue");
const SystemUserPage = () => import("@/pages/system/SystemUserPage.vue");
const SystemUserDataPermissionPage = () =>
  import("@/pages/system/SystemUserDataPermissionPage.vue");
const SystemUserAuthRolePage = () =>
  import("@/pages/system/SystemUserAuthRolePage.vue");
const SystemRolePage = () => import("@/pages/system/SystemRolePage.vue");
const SystemRoleAuthUserPage = () =>
  import("@/pages/system/SystemRoleAuthUserPage.vue");
const SystemMenuPage = () => import("@/pages/system/SystemMenuPage.vue");
const SystemDeptPage = () => import("@/pages/system/SystemDeptPage.vue");
const SystemPostPage = () => import("@/pages/system/SystemPostPage.vue");
const SystemDictPage = () => import("@/pages/system/SystemDictPage.vue");
const SystemDictDetailPage = () =>
  import("@/pages/system/SystemDictDetailPage.vue");
const SystemConfigPage = () => import("@/pages/system/SystemConfigPage.vue");
const SystemOperationLogPage = () =>
  import("@/pages/system/SystemOperationLogPage.vue");
const SystemLoginLogPage = () =>
  import("@/pages/system/SystemLoginLogPage.vue");
const NotificationManagementPage = () =>
  import("@/pages/system/NotificationManagementPage.vue");
const ProjectManagementPage = () =>
  import("@/pages/project/ProjectManagementPage.vue");
const PatternManagementPage = () =>
  import("@/pages/project/PatternManagementPage.vue");
const VehicleModelPage = () => import("@/pages/vehicle/VehicleModelPage.vue");
const InformationBrandsPage = () =>
  import("@/pages/information/BrandManagementPage.vue");
const InformationCompetitorsPage = () =>
  import("@/pages/information/CompetitorManagementPage.vue");
const InformationValvesPage = () =>
  import("@/pages/information/ValveManagementPage.vue");
const InformationCostCategoriesPage = () =>
  import("@/pages/information/CostCategoryPage.vue");
const InformationRdCategoriesPage = () =>
  import("@/pages/information/RdCategoryManagementPage.vue");
const InformationBudgetGradesPage = () =>
  import("@/pages/information/BudgetGradePage.vue");
const InformationSorsPage = () =>
  import("@/pages/information/SorManagementPage.vue");
const InformationCostCoefficientsPage = () =>
  import("@/pages/information/CostCoefficientPage.vue");
const InformationPresetColumnsPage = () =>
  import("@/pages/information/PresetColumnListPage.vue");
const PresetColumnFormPage = () =>
  import("@/pages/information/PresetColumnFormPage.vue");
const InformationCostErrorLogsPage = () =>
  import("@/pages/information/CostErrorLogPage.vue");
const InformationKanbanPage = () =>
  import("@/pages/information/InformationKanbanPage.vue");
const MechanizedKanbanPage = () =>
  import("@/pages/information/MechanizedKanbanPage.vue");
const BudgetInitiationWorkbenchPage = () =>
  import("@/pages/budget/BudgetInitiationWorkbenchPage.vue");
const BudgetGateReviewWorkbenchPage = () =>
  import("@/pages/budget/clique/BudgetGateReviewWorkbenchPage.vue");
const BudgetGateReviewReportPage = () =>
  import("@/pages/budget/clique/BudgetGateReviewReportPage.vue");
const BudgetGateReviewVersionHistoryPage = () =>
  import("@/pages/budget/clique/BudgetGateReviewVersionHistoryPage.vue");
const BudgetDashboardPage = () =>
  import("@/pages/budget/BudgetDashboardPage.vue");
const BudgetReportsPage = () => import("@/pages/budget/BudgetReportsPage.vue");
const BudgetAttachmentsPage = () =>
  import("@/pages/budget/BudgetAttachmentsPage.vue");
const BudgetReportPage = () => import("@/pages/budget/BudgetReportPage.vue");
const BudgetVersionHistoryPage = () =>
  import("@/pages/budget/BudgetVersionHistoryPage.vue");
const BudgetInitiationDetailPage = () =>
  import("@/pages/budget/BudgetInitiationDetailPage.vue");
const BudgetInitiationHistoryPage = () =>
  import("@/pages/budget/BudgetInitiationHistoryPage.vue");
const BudgetInitiationAssessPage = () =>
  import("@/pages/budget/BudgetInitiationAssessPage.vue");
const BudgetGateReviewDetailPage = () =>
  import("@/pages/budget/clique/BudgetGateReviewDetailPage.vue");
const BudgetGateReviewWbsHistoryVersionPage = () =>
  import("@/pages/budget/clique/BudgetGateReviewWbsHistoryVersionPage.vue");
const BudgetGateReviewAssessPage = () =>
  import("@/pages/budget/clique/BudgetGateReviewAssessPage.vue");
const CostQueryPage = () => import("@/pages/cost/CostQueryPage.vue");
const CostBomQueryPage = () => import("@/pages/cost/CostBomQueryPage.vue");
const CostAnalysisWorkbenchPage = () =>
  import("@/pages/cost/analysis/CostAnalysisWorkbenchPage.vue");
const CostAnalysisRoutePage = CostAnalysisWorkbenchPage;
const CostAnalysisPage = () => import("@/pages/cost/CostAnalysisPage.vue");
const CostBomDetailPage = () =>
  import("@/pages/cost/cost-bom/CostBomDetailPage.vue");
const CostBomPartEditorPage = () =>
  import("@/pages/cost/cost-bom/CostBomPartEditorPage.vue");
const CostBomPartHistoryPage = () =>
  import("@/pages/cost/cost-bom/CostBomPartHistoryPage.vue");
const CostBomVersionComparePage = () =>
  import("@/pages/cost/cost-bom/CostBomVersionComparePage.vue");
const CostBomPartComparePage = () =>
  import("@/pages/cost/cost-bom/CostBomPartComparePage.vue");
const CostBomVersionHistoryPage = () =>
  import("@/pages/cost/cost-bom/CostBomVersionHistoryPage.vue");
const PurchaseBomListPage = () =>
  import("@/pages/cost/bom/purchase-list/PurchaseBomListPage.vue");
const PurchaseBomReorganizePage = () =>
  import("@/pages/cost/bom/purchase-list/PurchaseBomReorganizePage.vue");
const PurchaseBomSourcePartsPage = () =>
  import("@/pages/cost/bom/purchase-list/PurchaseBomSourcePartsPage.vue");
const PurchaseBomDiffAnalysisPage = () =>
  import("@/pages/cost/bom/purchase-list/PurchaseBomDiffAnalysisPage.vue");
const NewProjectCostPage = () =>
  import("@/pages/cost/research/project-cost/NewProjectCostPage.vue");
const ProductionNewProjectCostPage = () =>
  import(
    "@/pages/cost/production/production-project/NewProjectCostPage.vue"
  );
const ProjectCostViewPage = () =>
  import("@/pages/cost/research/project-cost/ProjectCostViewPage.vue");
const NewProjectCostViewPage = () =>
  import("@/pages/cost/research/project-cost/NewProjectCostViewPage.vue");
const ProductionNewProjectCostViewPage = () =>
  import("@/pages/cost/production/production-project/NewProjectCostViewPage.vue");
const CostResearchHistoryPage = () =>
  import("@/pages/cost/research/history/CostResearchHistoryPage.vue");
const NewCostResearchHistoryPage = () =>
  import("@/pages/cost/research/history/NewCostResearchHistoryPage.vue");
const CostResearchHistoryViewPage = () =>
  import("@/pages/cost/research/history/CostResearchHistoryViewPage.vue");
const NewCostResearchHistoryViewPage = () =>
  import("@/pages/cost/research/history/NewCostResearchHistoryViewPage.vue");
const MeetingImportPage = () =>
  import("@/pages/cost/research/meeting-import/MeetingImportPage.vue");
const EvaluationImportPage = () =>
  import("@/pages/cost/research/evaluation-import/EvaluationImportPage.vue");
const TemplateCenterPage = () =>
  import("@/pages/custom-table/TemplateCenterPage.vue");
const TemplateCategoryPage = () =>
  import("@/pages/custom-table/TemplateCategoryPage.vue");
const TableDesignerPage = () =>
  import("@/pages/custom-table/TableDesignerPage.vue");
const TableDataSourcePage = () =>
  import("@/pages/custom-table/TableDataSourcePage.vue");
const CustTableRuntimeView = () =>
  import("@/pages/custom-table/runtime/CustTableRuntimeView.vue");
const CommitteeDashboardPage = () =>
  import("@/pages/committee/CommitteeDashboardPage.vue");
const CommitteeProjectListPage = () =>
  import("@/pages/committee/CommitteeProjectListPage.vue");
const CommitteeProjectDetailPage = () =>
  import("@/pages/committee/CommitteeProjectDetailPage.vue");
const CommitteeProjectOnboardingPage = () =>
  import("@/pages/committee/CommitteeProjectOnboardingPage.vue");
const CommitteeGateFormPage = () =>
  import("@/pages/committee/CommitteeGateFormPage.vue");
const CommitteeReviewListPage = () =>
  import("@/pages/committee/CommitteeReviewListPage.vue");
const CommitteeReviewDetailPage = () =>
  import("@/pages/committee/CommitteeReviewDetailPage.vue");
const CommitteeMeetingListPage = () =>
  import("@/pages/committee/CommitteeMeetingListPage.vue");
const CommitteeMeetingDetailPage = () =>
  import("@/pages/committee/CommitteeMeetingDetailPage.vue");
const CommitteeMeetingFormPage = () =>
  import("@/pages/committee/CommitteeMeetingFormPage.vue");
const CommitteeReviewDepartmentConfigPage = () =>
  import("@/pages/committee/CommitteeReviewDepartmentConfigPage.vue");
const CommitteeMaterialTemplatePage = () =>
  import("@/pages/committee/CommitteeMaterialTemplatePage.vue");
const CommitteeGroupMaterialDisplayPage = () =>
  import("@/pages/committee/CommitteeGroupMaterialDisplayPage.vue");
const CommitteeGroupMaterialEditPage = () =>
  import("@/pages/committee/CommitteeGroupMaterialEditPage.vue");
const CommitteeSnapshotPage = () =>
  import("@/pages/committee/CommitteeSnapshotPage.vue");
const CommitteeMeetingHistoryPage = () =>
  import("@/pages/committee/CommitteeMeetingHistoryPage.vue");
const CommitteeAiMaterialPage = () =>
  import("@/pages/committee/CommitteeAiMaterialPage.vue");
export const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: { public: true, title: "登录" },
  },
  {
    path: "/productionnewtwo",
    alias: "/dashboard/productionnewtwo",
    name: "legacyProductionDashboardStandalone",
    component: ProductionDashboardPage,
    meta: { title: "在产车型看板", hidden: true, menuAccessExempt: true },
  },
  {
    path: "/visualnew",
    alias: "/dashboard/visualnew",
    name: "legacyVisualDashboardStandalone",
    component: VisualDashboardPage,
    meta: { title: "车型项目看板", hidden: true, menuAccessExempt: true },
  },
  {
    path: "/visualnew-dashboard",
    alias: "/dashboard/visualnew-dashboard",
    name: "legacyVisualDashboardCompatStandalone",
    component: VisualDashboardPage,
    meta: { title: "车型项目看板", hidden: true, menuAccessExempt: true },
  },
  {
    path: "/purchase",
    alias: "/dashboard/purchase",
    name: "legacyPurchaseDashboardStandalone",
    component: PurchaseDashboardPage,
    meta: { title: "采购看板", hidden: true, menuAccessExempt: true },
  },
  {
    path: "/",
    name: "app",
    component: AppLayout,
    children: [
      {
        path: "",
        name: "dashboard",
        component: IndexPage,
        meta: { title: "首页", menuAccessExempt: true },
      },
      {
        // 后端菜单有时返回 /index，统一回到固定首页，避免产生第二个首页标签。
        path: "index",
        redirect: { name: "dashboard" },
        meta: { title: "首页", menuAccessExempt: true },
      },
      {
        path: "components",
        name: "componentGuide",
        component: ComponentGuidePage,
        meta: { title: "组件规范", menuAccessExempt: true },
      },
      {
        path: "user/profile",
        name: "userProfile",
        component: UserProfilePage,
        meta: {
          title: "个人中心",
          hidden: true,
          menuAccessExempt: true,
          breadcrumbs: [{ title: "个人中心" }],
        },
      },
      {
        path: "revenue/project-flow-create",
        name: "RevenueProjectFlowCreate",
        component: () => import("@/pages/revenue/project-flow/create.vue"),
        meta: {
          title: "新增收益流程",
          hidden: true,
          menuAccessExempt: true,
          activeMenu: "/revenue/project-list",
        },
      },
      {
        path: "revenue/my-todos",
        name: "RevenueMyTodos",
        component: () => import("@/pages/revenue/my-todos/index.vue"),
        meta: {
          title: "我的待办",
          menuAccessExempt: true,
          activeMenu: "/revenue/my-todos",
        },
      },
      {
        path: "revenue/project-flow-detail",
        name: "RevenueProjectFlowDetail",
        component: () => import("@/pages/revenue/project-flow/detail.vue"),
        meta: {
          title: "流程管理",
          hidden: true,
          menuAccessExempt: true,
          activeMenu: "/revenue/project-list",
        },
      },
      {
        path: "committee",
        redirect: "/committee/dashboard",
        meta: { title: "产品委员会" },
      },
      {
        path: "committee/dashboard",
        name: "committeeDashboard",
        component: CommitteeDashboardPage,
        meta: { title: "委员会工作台", permission: "committee:dashboard:view" },
      },
      {
        path: "committee/projects",
        name: "committeeProjects",
        component: CommitteeProjectListPage,
        meta: { title: "上会项目管理", permission: "committee:project:list" },
      },
      {
        path: "committee/projects/:projectId",
        name: "committeeProjectDetail",
        component: CommitteeProjectDetailPage,
        meta: {
          title: "上会项目管理详情",
          permission: "committee:project:view",
          hidden: true,
        },
      },
      {
        path: "committee/projects/create",
        name: "committeeProjectCreate",
        component: CommitteeProjectOnboardingPage,
        meta: {
          title: "创建上会项目管理",
          permission: "committee:project:add",
          hidden: true,
        },
      },
      {
        path: "committee/projects/:projectId/edit",
        name: "committeeProjectEdit",
        component: CommitteeProjectOnboardingPage,
        meta: {
          title: "编辑项目",
          permission: "committee:project:edit",
          permissionsAll: ["committee:project:view"],
          hidden: true,
        },
      },
      {
        path: "committee/projects/:projectId/gates/new",
        name: "committeeGateCreate",
        component: CommitteeGateFormPage,
        meta: {
          title: "关联阀点",
          permission: "committee:gate:create",
          hidden: true,
        },
      },
      {
        path: "committee/projects/:projectId/gates/:gateId/edit",
        name: "committeeGateEdit",
        component: CommitteeGateFormPage,
        meta: {
          title: "编辑阀点",
          permission: "committee:gate:update",
          hidden: true,
        },
      },
      {
        path: "committee/projects/:projectId/gates/:gateId/meeting-history",
        name: "committeeMeetingHistory",
        component: CommitteeMeetingHistoryPage,
        meta: {
          title: "会议历史",
          permission: "committee:project:query",
          hidden: true,
        },
      },
      {
        path: "committee/reviews",
        name: "committeeReviews",
        component: CommitteeReviewListPage,
        meta: { title: "阀点评审", permission: "committee:review:list" },
      },
      {
        path: "committee/reviews/tracking",
        name: "committeeReviewTracking",
        component: CommitteeReviewListPage,
        meta: {
          title: "部门评审跟踪",
          permission: "committee:review:query",
          hidden: true,
        },
      },
      {
        path: "committee/reviews/:taskId",
        name: "committeeReviewDetail",
        component: CommitteeReviewDetailPage,
        meta: {
          title: "评审详情",
          permission: "committee:review:query",
          hidden: true,
        },
      },
      {
        path: "committee/reviews/:taskId/confirm",
        name: "committeeReviewConfirm",
        component: CommitteeReviewDetailPage,
        props: { mode: "approve" },
        meta: {
          title: "负责人确认",
          permission: "committee:review:approve",
          hidden: true,
        },
      },
      {
        path: "committee/reviews/:taskId/versions",
        name: "committeeReviewVersions",
        component: CommitteeReviewDetailPage,
        props: { mode: "history" },
        meta: {
          title: "评审版本历史",
          permission: "committee:review:query",
          hidden: true,
        },
      },
      {
        path: "committee/meetings/second",
        name: "committeeSecondMeetings",
        component: CommitteeMeetingListPage,
        meta: {
          title: "品牌公司会议",
          permission: "committee:meeting:second:list",
          committeeLevel: "SECOND",
        },
      },
      {
        path: "committee/meetings/group",
        name: "committeeGroupMeetings",
        component: CommitteeMeetingListPage,
        meta: {
          title: "集团会议",
          permission: "committee:meeting:group:list",
          committeeLevel: "GROUP",
        },
      },
      {
        path: "committee/meetings/departments",
        name: "committeeReviewDepartmentConfig",
        component: CommitteeReviewDepartmentConfigPage,
        meta: {
          title: "会议参评部门配置",
          permission: "committee:config:dept",
        },
      },
      {
        path: "committee/meetings/materials",
        name: "committeeMaterialTemplates",
        component: CommitteeMaterialTemplatePage,
        meta: {
          title: "材料清单管理",
          permission: "committee:material-template:list",
        },
      },
      {
        path: "committee/meetings/:level(second)/create",
        name: "committeeSecondMeetingCreate",
        component: CommitteeMeetingFormPage,
        meta: {
          title: "创建品牌公司会议",
          permission: "committee:meeting:second:create",
          permissionsAll: ["committee:project:list", "committee:project:query"],
          hidden: true,
        },
      },
      {
        path: "committee/meetings/:level(group)/create",
        name: "committeeGroupMeetingCreate",
        component: CommitteeMeetingFormPage,
        meta: {
          title: "创建集团会议",
          permission: "committee:meeting:group:create",
          permissionsAll: [
            "committee:project:list",
            "committee:project:query",
            "committee:conclusion:view",
          ],
          hidden: true,
        },
      },
      {
        path: "committee/meetings/:level(second)/:meetingId/edit",
        name: "committeeSecondMeetingEdit",
        component: CommitteeMeetingFormPage,
        meta: {
          title: "编辑品牌公司会议",
          permission: "committee:meeting:second:update",
          permissionsAll: [
            "committee:meeting:second:list",
            "committee:project:query",
          ],
          hidden: true,
        },
      },
      {
        path: "committee/meetings/:level(group)/:meetingId/edit",
        name: "committeeGroupMeetingEdit",
        component: CommitteeMeetingFormPage,
        meta: {
          title: "编辑集团会议",
          permission: "committee:meeting:group:update",
          permissionsAll: [
            "committee:meeting:group:list",
            "committee:project:query",
            "committee:conclusion:view",
          ],
          hidden: true,
        },
      },
      {
        path: "committee/meetings/:level/:meetingId",
        name: "committeeMeetingDetail",
        component: CommitteeMeetingDetailPage,
        meta: { title: "会议详情", hidden: true },
      },
      {
        path: "committee/meetings/group/:meetingId/material/edit",
        name: "committeeGroupMaterialEdit",
        component: CommitteeGroupMaterialEditPage,
        meta: {
          title: "编辑集团会议材料",
          permission: "committee:material:edit",
          permissionsAll: ["committee:material:view"],
          hidden: true,
        },
      },
      {
        path: "committee/meetings/group/:meetingId/material/display",
        name: "committeeGroupMaterialDisplay",
        component: CommitteeGroupMaterialDisplayPage,
        meta: {
          title: "集团会议材料展示",
          permission: "committee:material:view",
          hidden: true,
        },
      },
      {
        path: "committee/meetings/group/:meetingId/material/presentation",
        name: "committeeGroupMaterialPresentation",
        component: CommitteeGroupMaterialDisplayPage,
        meta: {
          title: "集团会议材料全屏汇报演示",
          permission: "committee:material:view",
          hidden: true,
        },
      },
      {
        path: "committee/meetings/group/:meetingId/material/ai",
        name: "committeeGroupMaterialAi",
        component: CommitteeAiMaterialPage,
        meta: {
          title: "集团会议材料 AI 辅助",
          permission: "committee:material:view",
          permissionsAll: [
            "committee:meeting:group:list",
            "committee:review:query",
          ],
          hidden: true,
        },
      },
      {
        path: "committee/snapshots",
        name: "committeeSnapshots",
        component: CommitteeSnapshotPage,
        meta: {
          title: "快照与历史",
          permission: "committee:snapshot:view",
          hidden: true,
        },
      },
      {
        path: "committee/snapshots/:snapshotId",
        name: "committeeSnapshotDetail",
        component: CommitteeSnapshotPage,
        meta: {
          title: "上会快照详情",
          permission: "committee:snapshot:view",
          hidden: true,
        },
      },
      {
        path: "system",
        redirect: "/system/user",
        meta: { title: "系统管理" },
      },
      {
        path: "system/user",
        name: "systemUser",
        component: SystemUserPage,
        meta: { title: "用户管理", permission: "system:user:list" },
      },
      {
        path: "system/user-auth/data/:userId/:userName/:nickName",
        name: "systemUserDataPermission",
        component: SystemUserDataPermissionPage,
        meta: {
          title: "用户数据权限",
          permission: "system:project:permission",
          activeMenu: "/system/user",
          breadcrumbParentPath: "/system/user",
        },
      },
      {
        path: "system/user/:userId/data-permission",
        name: "systemUserDataPermissionLegacy",
        component: SystemUserDataPermissionPage,
        meta: {
          title: "用户数据权限",
          permission: "system:project:permission",
          activeMenu: "/system/user",
          breadcrumbParentPath: "/system/user",
        },
      },
      {
        path: "system/user-auth/data/:userId/:username/:displayName",
        name: "systemUserDataPermissionLegacyNamed",
        component: SystemUserDataPermissionPage,
        meta: {
          title: "用户数据权限",
          permission: "system:project:permission",
          activeMenu: "/system/user",
          breadcrumbParentPath: "/system/user",
        },
      },
      {
        path: "system/user-auth/role/:userId",
        name: "systemUserAuthRole",
        component: SystemUserAuthRolePage,
        meta: {
          title: "分配角色",
          permission: "system:user:role:oper",
          activeMenu: "/system/user",
          breadcrumbParentPath: "/system/user",
        },
      },
      {
        path: "system/role",
        name: "systemRole",
        component: SystemRolePage,
        meta: { title: "角色管理", permission: "system:role:list" },
      },
      {
        path: "system/role-auth/user/:roleId",
        name: "systemRoleAuthUser",
        component: SystemRoleAuthUserPage,
        meta: {
          title: "分配用户",
          permission: "system:role:list",
          breadcrumbParentPath: "/system/role",
        },
      },
      {
        path: "system/menu",
        name: "systemMenu",
        component: SystemMenuPage,
        meta: { title: "菜单管理", permission: "system:menu:list" },
      },
      {
        path: "system/dept",
        name: "systemDept",
        component: SystemDeptPage,
        meta: { title: "部门管理", permission: "system:dept:list" },
      },
      {
        path: "system/post",
        name: "systemPost",
        component: SystemPostPage,
        meta: { title: "岗位管理", permission: "system:post:list" },
      },
      {
        path: "system/dict",
        name: "systemDict",
        component: SystemDictPage,
        meta: { title: "字典管理", permission: "system:dict:list" },
      },
      {
        path: "system/dict/:dictTypeCode",
        name: "systemDictDetail",
        component: SystemDictDetailPage,
        meta: {
          title: "字典项管理",
          permission: "system:dict:list",
          breadcrumbParentPath: "/system/dict",
        },
      },
      {
        path: "system/config",
        name: "systemConfig",
        component: SystemConfigPage,
        meta: { title: "参数设置", permission: "system:config:list" },
      },
      {
        path: "system/logs",
        redirect: "/system/logs/operation",
        meta: { title: "日志管理" },
      },
      {
        path: "system/logs/operation",
        name: "systemOperationLog",
        component: SystemOperationLogPage,
        meta: {
          title: "操作日志",
          permission: "monitor:operlog:list",
          breadcrumbParentPath: "/system/logs/operation",
        },
      },
      {
        path: "system/logs/login",
        name: "systemLoginLog",
        component: SystemLoginLogPage,
        meta: {
          title: "登录日志",
          permission: "monitor:logininfor:list",
          breadcrumbParentPath: "/system/logs/login",
        },
      },
      {
        path: "monitor/notification",
        name: "notificationManagement",
        component: NotificationManagementPage,
        meta: {
          title: "通知管理",
          permission: "notification:message:list",
        },
      },
      {
        path: "project",
        redirect: "/project/projects",
        meta: { title: "车型项目管理" },
      },
      {
        path: "project/projects",
        name: "projectManagement",
        component: ProjectManagementPage,
        meta: { title: "项目管理", permission: "system:project:list" },
      },
      {
        path: "project/vehicle-models",
        name: "vehicleModel",
        component: VehicleModelPage,
        meta: { title: "车型管理", permission: "system:vehicle:model:list" },
      },
      {
        path: "project/patterns",
        name: "patternManagement",
        component: PatternManagementPage,
        meta: { title: "版型管理", permission: "system:pattern:list" },
      },
      {
        path: "information",
        redirect: "/information/competitors",
        meta: { title: "信息管理" },
      },
      {
        path: "information/brands",
        name: "informationBrands",
        component: InformationBrandsPage,
        meta: { title: "品牌管理", permission: "system:brand:list" },
      },
      {
        path: "information/competitors",
        name: "informationCompetitors",
        component: InformationCompetitorsPage,
        meta: { title: "竞品管理", permission: "system:competitor:list" },
      },
      {
        path: "information/valves",
        name: "informationValves",
        component: InformationValvesPage,
        meta: { title: "阀点管理", permission: "system:valve:list" },
      },
      {
        path: "information/cost-categories",
        name: "informationCostCategories",
        component: InformationCostCategoriesPage,
        meta: { title: "成本分类管理", permission: "system:category:list" },
      },
      {
        path: "information/rd-categories",
        name: "informationRdCategories",
        component: InformationRdCategoriesPage,
        meta: { title: "研发分类管理", permission: "base:rd-category:list" },
      },
      {
        path: "information/budget-grades",
        name: "informationBudgetGrades",
        component: InformationBudgetGradesPage,
        meta: { title: "预算等级管理", permission: "system:grade:list" },
      },
      {
        path: "information/sors",
        name: "informationSors",
        component: InformationSorsPage,
        meta: { title: "SOR管理", permission: "system:sor:list" },
      },
      {
        path: "information/cost-coefficients",
        name: "informationCostCoefficients",
        component: InformationCostCoefficientsPage,
        meta: {
          title: "成本转换系数",
          permission: "system:coefficient:list",
        },
      },
      {
        path: "information/preset-columns",
        name: "informationPresetColumns",
        component: InformationPresetColumnsPage,
        meta: {
          title: "预置列管理",
          permission: "system:column:list",
        },
      },
      {
        path: "information/preset-columns/form",
        name: "presetColumnForm",
        component: PresetColumnFormPage,
        meta: {
          title: "预置列表单",
          permission: "system:column:add",
          breadcrumbParentPath: "/information/preset-columns",
        },
      },
      {
        path: "information/cost-error-logs",
        name: "informationCostErrorLogs",
        component: InformationCostErrorLogsPage,
        meta: { title: "成本报错日志", permission: "system:log:list" },
      },
      {
        path: "information/kanban",
        redirect: "/information/kanban/current-production",
        meta: { title: "看板数据管理" },
      },
      {
        path: "information/kanban/current-production",
        name: "informationKanbanCurrentProduction",
        component: InformationKanbanPage,
        meta: {
          title: "在产数据",
          permission: "system:production:car:list",
          breadcrumbParentPath: "/information/kanban/current-production",
        },
      },
      {
        path: "information/kanban/mechanized",
        name: "informationKanbanMechanized",
        component: MechanizedKanbanPage,
        meta: {
          title: "综采数据",
          permission: "system:comprehensive:list",
          breadcrumbParentPath: "/information/kanban/mechanized",
        },
      },
      {
        path: "budget",
        redirect: "/budget/initiation",
        meta: { title: "预算管理" },
      },
      {
        path: "budget/initiation",
        name: "budgetInitiation",
        component: BudgetInitiationWorkbenchPage,
        meta: {
          title: "立项评审",
          permission: "budget:initiation:list",
          budgetPageType: "initiation",
          activeMenu: "/budget/wbs-touzi/lixiang",
          breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
        },
      },
      // {
      //   path: "budget/initiation",
      //   name: "budgetInitiation",
      //   component: BudgetInitiationWorkbenchPage,
      //   meta: {
      //     title: "立项评审",
      //     permission: "budget:initiation:list",
      //     budgetPageType: "initiation",
      //     activeMenu: "/budget/wbs-touzi/lixiang",
      //     breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
      //   },
      // },
      {
        path: "budget/gate-review",
        name: "budgetGateReview",
        component: BudgetGateReviewWorkbenchPage,
        meta: {
          title: "过阀评审",
          permission: "budget:gate-review:list",
          budgetPageType: "gate-review",
          activeMenu: "/budget/wbs-touzi/clique",
          breadcrumbParentPath: "/budget/wbs-touzi/clique",
        },
      },
      {
        path: "budget/evaluation",
        name: "budgetEvaluation",
        component: BudgetDashboardPage,
        meta: { title: "预算看板", permission: "budget:evaluation:list" },
      },
      {
        path: "budget/reports",
        name: "budgetReports",
        component: BudgetReportsPage,
        meta: { title: "预算报表", permission: "budget:reports:list" },
      },
      {
        path: "budget/attachments",
        name: "budgetAttachments",
        component: BudgetAttachmentsPage,
        meta: { title: "预算附件", permission: "budget:attachments:list" },
      },
      {
        path: "budget/wbs/createreportforms",
        name: "budgetInitiationReportPage",
        component: BudgetReportPage,
        meta: {
          title: "立项评审表",
          hidden: true,
          permission: "budget:initiation:generate-report",
          activeMenu: "/budget/wbs-touzi/lixiang",
          breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
        },
      },
      {
        path: "budget/gate-review/generate-report",
        alias: "/budget/wbs/cliquecreatereportforms",
        name: "过阀评审生成报表",
        component: BudgetGateReviewReportPage,
        meta: {
          title: "过阀评审生成报表",
          hidden: true,
          permission: "budget:gate-review:generate-report",
          activeMenu: "/budget/wbs-touzi/clique",
          breadcrumbParentPath: "/budget/wbs-touzi/clique",
        },
      },
      {
        path: "budget/initiation/version-history",
        name: "budgetInitiationVersionHistory",
        component: BudgetVersionHistoryPage,
        meta: {
          title: "立项版本历史版本",
          hidden: true,
          permission: "budget:initiation:list",
          activeMenu: "/budget/wbs-touzi/lixiang",
          breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
        },
      },
      {
        path: "budget/initiation/detail",
        alias: [
          "/budget/lixiang/wbsProjectInfo",
          "/budget/lixiang/wbsProjectInfo/index",
        ],
        name: "budgetInitiationDetailPage",
        component: BudgetInitiationDetailPage,
        meta: {
          title: "立项预算明细",
          hidden: true,
          permission: "budget:initiation:list",
          activeMenu: "/budget/wbs-touzi/lixiang",
          breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
        },
      },
      {
        path: "budget/initiation/versions",
        name: "budgetInitiationHistory",
        component: BudgetInitiationHistoryPage,
        meta: {
          title: "立项历史版本",
          hidden: true,
          permission: "budget:initiation:list",
          activeMenu: "/budget/wbs-touzi/lixiang",
          breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
        },
      },
      {
        path: "budget/initiation/assess",
        name: "budgetInitiationAssess",
        component: BudgetInitiationAssessPage,
        meta: {
          title: "立项评估",
          hidden: true,
          permission: "budget:initiation:evaluate",
          activeMenu: "/budget/wbs-touzi/lixiang",
          breadcrumbParentPath: "/budget/wbs-touzi/lixiang",
        },
      },
      {
        path: "budget/clique/detail",
        alias: "/budget/gate-review/detail",
        name: "过阀评审查看",
        component: BudgetGateReviewDetailPage,
        meta: {
          title: "过阀评审查看",
          hidden: true,
          permission: "budget:gate-review:view",
          activeMenu: "/budget/wbs-touzi/clique",
          breadcrumbParentPath: "/budget/wbs-touzi/clique",
        },
      },
      {
        path: "budget/clique/wbs-history-version",
        alias: "/budget/gate-review/history",
        name: "WBS过阀历史版本",
        component: BudgetGateReviewWbsHistoryVersionPage,
        meta: {
          title: "WBS过阀历史版本",
          hidden: true,
          permission: "budget:gate-review:wbs-history:view",
          activeMenu: "/budget/wbs-touzi/clique",
          breadcrumbParentPath: "/budget/wbs-touzi/clique",
        },
      },
      {
        path: "budget/clique/history-version",
        alias: "/budget/gate-review/versions",
        name: "过阀评审历史版本",
        component: BudgetGateReviewVersionHistoryPage,
        meta: {
          title: "过阀评审历史版本",
          hidden: true,
          permission: "budget:gate-review:history:view",
          activeMenu: "/budget/wbs-touzi/clique",
          breadcrumbParentPath: "/budget/wbs-touzi/clique",
        },
      },
      {
        path: "budget/clique/assess",
        alias: "/budget/gate-review/assess",
        name: "过阀预算评审",
        component: BudgetGateReviewAssessPage,
        meta: {
          title: "过阀预算评审",
          hidden: true,
          permission: "budget:gate-review:evaluate",
          activeMenu: "/budget/wbs-touzi/clique",
          breadcrumbParentPath: "/budget/wbs-touzi/clique",
        },
      },
      {
        path: "custom-table",
        redirect: "/custom-table/templates",
        meta: { title: "自定义表格" },
      },
      {
        path: "custom-table/templates",
        name: "customTableTemplates",
        component: TemplateCenterPage,
        meta: {
          title: "模板中心",
          permission: "base:cust-table:template:list",
        },
      },
      {
        path: "custom-table/categories",
        name: "customTableCategories",
        component: TemplateCategoryPage,
        meta: {
          title: "模板分类",
          permission: "base:cust-table:category:list",
        },
      },
      {
        path: "custom-table/data-sources",
        name: "customTableDataSources",
        component: TableDataSourcePage,
        meta: {
          title: "数据源管理",
          permission: "base:cust-table:provider:list",
          breadcrumbParentPath: "/custom-table/templates",
        },
      },
      {
        path: "custom-table/designer/:templateId?",
        name: "customTableDesigner",
        component: TableDesignerPage,
        meta: {
          title: "设计工作台",
          permission: [
            "base:cust-table:template:edit",
            "base:cust-table:template:query",
          ],
          breadcrumbParentPath: "/custom-table/templates",
        },
      },
      {
        path: "custom-table/runtime/:workbookId",
        name: "custTableRuntime",
        component: CustTableRuntimeView,
        props: true,
        meta: {
          title: "自定义表格填报",
          hidden: true,
          permission: "base:cust-table:workbook:query",
          breadcrumbParentPath: "/custom-table/templates",
        },
      },
      {
        path: "cost",
        redirect: "/cost/query",
        meta: { title: "成本管理" },
      },
      {
        path: "cost/query",
        name: "costQuery",
        component: CostQueryPage,
        meta: { title: "成本查询", permission: "cost:query:list" },
      },
      {
        path: "cost/analysis",
        name: "costAnalysis",
        component: CostAnalysisPage,
        meta: { title: "成本分析", permission: "cost:analysis:list" },
      },
      {
        path: "cost/analysis-new",
        name: "costAnalysisNew",
        component: CostAnalysisRoutePage,
        meta: { title: "成本分析(新)", permission: "cost:analysis:list" },
      },
      {
        path: "costmanagementnew/analysis-new",
        name: "costManagementNewAnalysis",
        component: CostAnalysisRoutePage,
        meta: { title: "成本分析(新)", permission: "cost:analysis:list" },
      },
      {
        path: "cost/bom/query",
        name: "costBomQuery",
        component: CostBomQueryPage,
        meta: { title: "成本BOM查询", permission: "cost:bom:query:list" },
      },
      {
        path: "cost/bom/detail",
        name: "costBomDetail",
        component: CostBomDetailPage,
        meta: {
          title: "成本BOM明细",
          permission: "cost:bom:query:view",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/parts/add",
        name: "costBomPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增成本BOM零件",
          permission: "cost:bom:query:create",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/parts/edit",
        name: "costBomPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑成本BOM零件",
          permission: "cost:bom:query:edit",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/parts/copy",
        name: "costBomPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制成本BOM零件",
          permission: "cost:bom:query:copy",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/parts/histories",
        name: "costBomPartHistory",
        component: CostBomPartHistoryPage,
        meta: {
          title: "成本BOM零件历史",
          permission: "cost:bom:query:history",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/versions",
        name: "costBomVersionHistory",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "成本BOM版本",
          permission: "cost:bom:query:history",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/versions/compare",
        name: "costBomVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "成本BOM版本对比",
          permission: "cost:bom:query:compare",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/query",
        },
      },
      {
        path: "cost/bom/versions/compare/parts",
        name: "costBomPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "零件详情对比",
          permission: "cost:bom:query:compare",
          permissionPrefix: "cost:bom:query",
          breadcrumbParentPath: "/cost/bom/versions/compare",
        },
      },
      {
        path: "cost/bom/purchase-list",
        name: "costBomPurchaseList",
        alias: [
          "/manageBom/purchaseBom",
          "/costmanagementnew/manageBom/purchaseBom",
        ],
        component: PurchaseBomListPage,
        meta: {
          title: "采购BOM清单",
          permission: "system:purchaseBom:list",
        },
      },
      {
        path: "cost/bom/purchase-list/reorganize",
        name: "costBomPurchaseReorganize",
        alias: [
          "/cost/bom/reorganize",
          "/manageBom/purchaseBom/reorganize",
          "/costmanagementnew/manageBom/purchaseBom/reorganize",
        ],
        component: PurchaseBomReorganizePage,
        meta: {
          title: "查看整编",
          hidden: true,
          permission: "system:purchaseBom:query",
          activeMenu: "/cost/bom/purchase-list",
          breadcrumbParentPath: "/cost/bom/purchase-list",
        },
      },
      {
        path: "cost/bom/purchase-list/source-parts",
        name: "costBomPurchaseSourceParts",
        alias: [
          "/manageBom/purchaseBom/source-parts",
          "/costmanagementnew/manageBom/purchaseBom/source-parts",
        ],
        component: PurchaseBomSourcePartsPage,
        meta: {
          title: "采购BOM源零件",
          hidden: true,
          permission: "system:purchaseBom:query",
          breadcrumbParentPath: "/cost/bom/purchase-list",
        },
      },
      {
        path: "cost/bom/purchase-list/diff-analysis",
        name: "costBomPurchaseDiffAnalysis",
        alias: [
          "/manageBom/purchaseBom/diff-analysis",
          "/costmanagementnew/manageBom/purchaseBom/diff-analysis",
        ],
        component: PurchaseBomDiffAnalysisPage,
        meta: {
          title: "采购BOM差异分析",
          hidden: true,
          permission: "system:purchaseBom:query",
          breadcrumbParentPath: "/cost/bom/purchase-list",
        },
      },
      {
        path: "cost/research/project-cost",
        name: "costResearchProjectCost",
        component: ProjectCostViewPage,
        meta: {
          title: "项目成本",
          permission: "cost:research:project-cost:list",
        },
      },
      {
        path: "cost/research/project-cost/detail",
        name: "costResearchProjectCostView",
        component: ProjectCostViewPage,
        meta: {
          title: "项目成本查看",
          hidden: true,
          permission: "cost:research:project-cost:view",
          permissionPrefix: "cost:research:project-cost",
          activeMenu: "/cost/research/project-cost",
          breadcrumbParentPath: "/cost/research/project-cost",
          breadcrumbs: [
            { title: "成本管理", path: "/cost" },
            { title: "在研车型", path: "/cost/research" },
            { title: "项目成本", path: "/cost/research/project-cost" },
            { title: "项目成本查看" },
          ],
        },
      },
      {
        path: "cost/research/new-project-cost",
        alias: [
          "/costmanagementnew/projectcostnew",
          "/costmanagementnew/zy/projectcostnew",
        ],
        name: "costResearchNewProjectCost",
        component: NewProjectCostPage,
        meta: {
          title: "项目成本",
          permission: "cost:research:project-cost:list",
        },
      },
      {
        path: "cost/research/new-project-cost/detail",
        name: "costResearchNewProjectCostView",
        component: NewProjectCostViewPage,
        meta: {
          title: "项目成本查看",
          hidden: true,
          permission: "cost:research:project-cost:view",
          permissionPrefix: "cost:research:project-cost",
          activeMenu: "/cost/research/new-project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost",
          breadcrumbs: [
            { title: "成本管理", path: "/cost" },
            { title: "在研车型", path: "/cost/research" },
            { title: "项目成本", path: "/cost/research/new-project-cost" },
            { title: "项目成本查看" },
          ],
        },
      },
      {
        path: "cost/research/new-project-cost/parts/add",
        name: "costResearchNewProjectCostPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增项目成本零件",
          permissionsAny: [
            "cost:research:project-cost:create",
            "cost:research:new-project-cost:add",
            "cost:research:new-project-cost:view-page:add",
          ],
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost",
        },
      },
      {
        path: "cost/research/new-project-cost/parts/edit",
        name: "costResearchNewProjectCostPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑项目成本零件",
          permissionsAny: [
            "cost:research:project-cost:edit",
            "cost:research:new-project-cost:edit",
            "cost:research:new-project-cost:view-page:edit",
          ],
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost",
        },
      },
      {
        path: "cost/research/new-project-cost/parts/copy",
        name: "costResearchNewProjectCostPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制项目成本零件",
          permission: "cost:research:project-cost:copy",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost",
        },
      },
      {
        path: "cost/research/new-project-cost/parts/histories",
        name: "costResearchNewProjectCostPartHistory",
        component: CostBomPartHistoryPage,
        meta: {
          title: "项目成本零件历史",
          permission: "cost:research:project-cost:history",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost",
        },
      },
      {
        path: "cost/research/new-project-cost/versions",
        name: "costResearchNewProjectCostVersions",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "历史版本",
          permission: "cost:research:project-cost:history",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost",
        },
      },
      {
        path: "cost/research/new-project-cost/versions/compare",
        name: "costResearchNewProjectCostVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "项目成本版本对比",
          permission: "cost:research:project-cost:compare",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/new-project-cost/versions",
        },
      },
      {
        path: "cost/research/new-project-cost/versions/compare/parts",
        name: "costResearchNewProjectCostPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "零件详情对比",
          permission: "cost:research:project-cost:compare",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath:
            "/cost/research/new-project-cost/versions/compare",
        },
      },
      {
        path: "cost/production/project-cost",
        alias: [
          "/new-production-cost",
          "/cost/production/new-production-cost",
          "/costmanagementnew/zc/projectcostnew",
        ],
        name: "costProductionProjectCost",
        component: ProductionNewProjectCostPage,
        meta: {
          title: "项目成本",
          permission: "cost:production:project-cost:list",
          activeMenu: "/cost/production/project-cost",
        },
      },
      {
        path: "cost/production/project-cost/detail",
        alias: [
          "/new-production-cost/detail",
          "/cost/production/new-production-cost/detail",
        ],
        name: "costProductionProjectCostView",
        component: ProductionNewProjectCostViewPage,
        meta: {
          title: "项目成本查看",
          hidden: true,
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost",
          breadcrumbs: [
            { title: "成本管理", path: "/cost" },
            { title: "在产车型", path: "/cost/production" },
            {
              title: "项目成本",
              path: "/cost/production/project-cost",
            },
            { title: "项目成本查看" },
          ],
        },
      },
      {
        path: "cost/production/project-cost/parts/add",
        alias: [
          "/new-production-cost/parts/add",
          "/cost/production/new-production-cost/parts/add",
        ],
        name: "costProductionProjectCostPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增项目成本零件",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost",
        },
      },
      {
        path: "cost/production/project-cost/parts/edit",
        alias: [
          "/new-production-cost/parts/edit",
          "/cost/production/new-production-cost/parts/edit",
        ],
        name: "costProductionProjectCostPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑项目成本零件",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost",
        },
      },
      {
        path: "cost/production/project-cost/parts/copy",
        alias: [
          "/new-production-cost/parts/copy",
          "/cost/production/new-production-cost/parts/copy",
        ],
        name: "costProductionProjectCostPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制项目成本零件",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost",
        },
      },
      {
        path: "cost/production/project-cost/parts/histories",
        alias: [
          "/new-production-cost/parts/histories",
          "/cost/production/new-production-cost/parts/histories",
        ],
        name: "costProductionProjectCostPartHistory",
        component: CostBomPartHistoryPage,
        meta: {
          title: "项目成本零件历史",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost",
        },
      },
      {
        path: "cost/production/project-cost/versions",
        alias: [
          "/new-production-cost/versions",
          "/cost/production/new-production-cost/versions",
        ],
        name: "costProductionProjectCostVersions",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "项目成本历史版本",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost",
        },
      },
      {
        path: "cost/production/project-cost/versions/compare",
        alias: [
          "/new-production-cost/versions/compare",
          "/cost/production/new-production-cost/versions/compare",
        ],
        name: "costProductionProjectCostVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "项目成本版本对比",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath: "/cost/production/project-cost/versions",
        },
      },
      {
        path: "cost/production/project-cost/versions/compare/parts",
        alias: [
          "/new-production-cost/versions/compare/parts",
          "/cost/production/new-production-cost/versions/compare/parts",
        ],
        name: "costProductionProjectCostPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "零件详情对比",
          permission: "cost:production:project-cost:list",
          permissionPrefix: "cost:production:project-cost",
          activeMenu: "/cost/production/project-cost",
          breadcrumbParentPath:
            "/cost/production/project-cost/versions/compare",
        },
      },
      {
        path: "cost/research/project-cost/parts/add",
        name: "costResearchProjectCostPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增项目成本零件",
          permissionsAny: [
            "cost:research:project-cost:create",
            "cost:research:project-cost:view-page:add",
          ],
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/project-cost/parts/edit",
        name: "costResearchProjectCostPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑项目成本零件",
          permissionsAny: [
            "cost:research:project-cost:edit",
            "cost:research:project-cost:view-page:edit",
          ],
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/project-cost/parts/copy",
        name: "costResearchProjectCostPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制项目成本零件",
          permission: "cost:research:project-cost:copy",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/project-cost/parts/histories",
        name: "costResearchProjectCostPartHistory",
        component: CostBomPartHistoryPage,
        meta: {
          title: "项目成本零件历史",
          permission: "cost:research:project-cost:version:query",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/project-cost/versions",
        name: "costResearchProjectCostVersions",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "历史版本",
          permission: "cost:research:project-cost:version:query",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/project-cost/versions/compare",
        name: "costResearchProjectCostVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "项目成本版本对比",
          permission: "cost:research:project-cost:version:compare",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost/versions",
        },
      },
      {
        path: "cost/research/project-cost/versions/compare/parts",
        name: "costResearchProjectCostPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "零件详情对比",
          permission: "cost:research:project-cost:version:compare",
          permissionPrefix: "cost:research:project-cost",
          breadcrumbParentPath: "/cost/research/project-cost/versions/compare",
        },
      },
      {
        path: "cost/research/history",
        name: "costResearchHistory",
        component: CostResearchHistoryPage,
        meta: { title: "成本履历", permission: "cost:research:history:list" },
      },
      {
        path: "cost/research/history/detail",
        name: "costResearchHistoryView",
        component: CostResearchHistoryViewPage,
        meta: {
          title: "成本履历查看",
          hidden: true,
          permission: "cost:research:history:view",
          permissionPrefix: "cost:research:history",
          activeMenu: "/cost/research/history",
          breadcrumbParentPath: "/cost/research/history",
          breadcrumbs: [
            { title: "成本管理", path: "/cost" },
            { title: "在研车型", path: "/cost/research" },
            { title: "成本履历", path: "/cost/research/history" },
            { title: "成本履历查看" },
          ],
        },
      },
      {
        path: "cost/research/new-history",
        alias: [
          "/costmanagementnew/costbomshree",
          "/costmanagementnew/zy/costbom",
          "/costmanagementnew/zy/costbomshree",
        ],
        name: "costResearchNewHistory",
        component: NewCostResearchHistoryPage,
        meta: {
          title: "成本履历",
          permission: "cost:research:new-history:list",
          cacheable: true,
        },
      },
      {
        path: "cost/research/new-history/detail",
        name: "costResearchNewHistoryView",
        component: NewCostResearchHistoryViewPage,
        meta: {
          title: "成本履历查看",
          hidden: true,
          permission: "cost:research:history:view",
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          activeMenu: "/cost/research/new-history",
          breadcrumbParentPath: "/cost/research/new-history",
          breadcrumbs: [
            { title: "成本管理", path: "/cost" },
            { title: "在研车型", path: "/cost/research" },
            { title: "成本履历", path: "/cost/research/new-history" },
            { title: "成本履历查看" },
          ],
        },
      },
      {
        path: "cost/research/new-history/parts/add",
        name: "costResearchNewHistoryPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增成本履历零件",
          hidden: true,
          permission: "cost:research:new-history:add",
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/new-history/parts/edit",
        name: "costResearchNewHistoryPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑成本履历零件",
          hidden: true,
          permissionsAny: [
            "cost:research:new-history:edit",
            "cost:research:new-history:view-page:edit",
          ],
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/new-history/parts/copy",
        name: "costResearchNewHistoryPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制成本履历零件",
          hidden: true,
          permission: "cost:research:new-history:copy",
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/new-history/parts/histories",
        name: "costResearchNewHistoryPartHistories",
        component: CostBomPartHistoryPage,
        meta: {
          title: "成本履历零件历史版本",
          hidden: true,
          permission: "cost:research:new-history:version:query",
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/new-history/versions",
        name: "costResearchNewHistoryVersions",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "成本履历历史版本",
          hidden: true,
          permissionsAny: [
            "cost:research:new-history:version:query",
            "cost:research:new-history:list-page:history",
          ],
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/new-history/versions/compare",
        name: "costResearchNewHistoryVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "成本履历版本对比",
          hidden: true,
          permission: "cost:research:new-history:version:compare",
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history/versions",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/new-history/versions/compare/parts",
        name: "costResearchNewHistoryPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "成本履历零件详情对比",
          hidden: true,
          permission: "cost:research:new-history:version:compare",
          permissionPrefix: "cost:research:new-history",
          pageFullscreenGroup: "cost-research-new-history",
          breadcrumbParentPath: "/cost/research/new-history/versions/compare",
          activeMenu: "/cost/research/new-history",
        },
      },
      {
        path: "cost/research/parts/add",
        name: "costResearchPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增零件",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:create",
            "cost:research:project-cost:view-page:add",
            "cost:research:new-project-cost:add",
            "cost:research:new-project-cost:view-page:add",
            "cost:research:history:add",
            "cost:research:new-history:add",
          ],
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/parts/edit",
        name: "costResearchPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑零件",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:edit",
            "cost:research:project-cost:view-page:edit",
            "cost:research:new-project-cost:edit",
            "cost:research:new-project-cost:view-page:edit",
            "cost:research:history:edit",
            "cost:research:history:view-page:edit",
            "cost:research:new-history:edit",
            "cost:research:new-history:view-page:edit",
          ],
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/parts/copy",
        name: "costResearchPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制零件",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:copy",
            "cost:research:history:copy",
          ],
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/parts/histories",
        name: "costResearchPartHistories",
        component: CostBomPartHistoryPage,
        meta: {
          title: "零件历史",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:history",
            "cost:research:history:history",
          ],
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/versions",
        name: "costResearchVersions",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "历史版本",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:history",
            "cost:research:project-cost:version:query",
            "cost:research:history:history",
            "cost:research:history:version:query",
            "cost:research:history:list-page:history",
            "cost:research:new-history:version:query",
            "cost:research:new-history:list-page:history",
          ],
          breadcrumbParentPath: "/cost/research/project-cost",
        },
      },
      {
        path: "cost/research/versions/compare",
        name: "costResearchVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "版本对比",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:compare",
            "cost:research:project-cost:version:compare",
            "cost:research:history:compare",
            "cost:research:history:version:compare",
            "cost:research:new-history:version:compare",
          ],
          breadcrumbParentPath: "/cost/research/versions",
        },
      },
      {
        path: "cost/research/versions/compare/parts",
        name: "costResearchPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "零件详情对比",
          hidden: true,
          permissionsAny: [
            "cost:research:project-cost:compare",
            "cost:research:project-cost:version:compare",
            "cost:research:history:compare",
            "cost:research:history:version:compare",
            "cost:research:new-history:version:compare",
          ],
          breadcrumbParentPath: "/cost/research/versions/compare",
        },
      },

      {
        path: "cost/research/history/parts/add",
        name: "costResearchHistoryPartAdd",
        component: CostBomPartEditorPage,
        meta: {
          title: "新增成本履历零件",
          permission: "cost:research:history:add",
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history",
        },
      },
      {
        path: "cost/research/history/parts/edit",
        name: "costResearchHistoryPartEdit",
        component: CostBomPartEditorPage,
        meta: {
          title: "编辑成本履历零件",
          permissionsAny: [
            "cost:research:history:edit",
            "cost:research:history:view-page:edit",
          ],
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history",
        },
      },
      {
        path: "cost/research/history/parts/copy",
        name: "costResearchHistoryPartCopy",
        component: CostBomPartEditorPage,
        meta: {
          title: "复制成本履历零件",
          permission: "cost:research:history:copy",
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history",
        },
      },
      {
        path: "cost/research/history/parts/histories",
        name: "costResearchHistoryPartHistory",
        component: CostBomPartHistoryPage,
        meta: {
          title: "成本履历零件历史版本",
          permission: "cost:research:history:version:query",
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history",
        },
      },
      {
        path: "cost/research/history/versions",
        name: "costResearchHistoryVersions",
        component: CostBomVersionHistoryPage,
        meta: {
          title: "成本履历历史版本",
          permissionsAny: [
            "cost:research:history:version:query",
            "cost:research:history:list-page:history",
          ],
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history",
        },
      },
      {
        path: "cost/research/history/versions/compare",
        name: "costResearchHistoryVersionCompare",
        component: CostBomVersionComparePage,
        meta: {
          title: "成本履历版本对比",
          permission: "cost:research:history:version:compare",
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history/versions",
        },
      },
      {
        path: "cost/research/history/versions/compare/parts",
        name: "costResearchHistoryPartCompare",
        component: CostBomPartComparePage,
        meta: {
          title: "零件详情对比",
          permission: "cost:research:history:version:compare",
          permissionPrefix: "cost:research:history",
          breadcrumbParentPath: "/cost/research/history/versions/compare",
        },
      },
      {
        path: "cost/research/meeting-import",
        name: "costResearchMeetingImport",
        component: MeetingImportPage,
        meta: {
          title: "采购上会价格导入",
          permission: "cost:research:meeting-import:list",
        },
      },
      {
        path: "cost/research/evaluation-import",
        name: "costResearchEvaluationImport",
        component: EvaluationImportPage,
        meta: {
          title: "评估价格导入",
          permission: "cost:research:evaluation-import:list",
        },
      },
    ],
  },
  // 收益流程详情：独立全屏页（不挂 AppLayout），刷新也能命中，避免套在侧栏右侧
  {
    path: "/revenue/subtable-fill-detail",
    name: "RevenueSubtableFillDetail",
    component: () => import("@/pages/revenue/subtable-fill/detail.vue"),
    meta: {
      title: "子表填报详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/revenue/subtable-audit-detail",
    name: "RevenueSubtableAuditDetail",
    component: () => import("@/pages/revenue/subtable-audit/detail.vue"),
    meta: {
      title: "子表审核详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/revenue/main-table-audit-detail",
    name: "RevenueMainTableAuditDetail",
    component: () => import("@/pages/revenue/main-table-audit/detail.vue"),
    meta: {
      title: "主表审核详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/revenue/meeting-review-detail",
    name: "RevenueMeetingReviewDetail",
    component: () => import("@/pages/revenue/meeting-review/detail.vue"),
    meta: {
      title: "上会评审详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/revenue/s5-main-selection-detail",
    name: "RevenueS5MainSelectionDetail",
    component: () => import("@/pages/revenue/s5-main-selection/detail.vue"),
    meta: {
      title: "主表选型详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/revenue/s5-decision-approval-detail",
    name: "RevenueS5DecisionApprovalDetail",
    component: () => import("@/pages/revenue/s5-decision-approval/detail.vue"),
    meta: {
      title: "决策审批详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/revenue/data-check-detail",
    name: "RevenueDataCheckDetail",
    component: () => import("@/pages/revenue/data-check/detail.vue"),
    meta: {
      title: "数据校核详情",
      hidden: true,
      menuAccessExempt: true,
    },
  },
  {
    path: "/ai", name: "AiShell", component: AppLayout, redirect: "/ai/projects",
    meta: { title: "智行官" },
    children: [
      { path: "projects", name: "AiProjects", component: () => import("@/pages/ai/ProjectManagementPage.vue"), meta: { title: "项目" } },
    ],
  },
  { path: "/platform/ai/models", name: "AiModels", component: () => import("@/pages/ai/AiPlaceholderPage.vue"), props: { title: "模型" }, meta: { public: true, title: "模型" } },
  { path: "/platform/ai/providers", name: "AiProviders", component: () => import("@/pages/ai/AiPlaceholderPage.vue"), props: { title: "Provider" }, meta: { public: true, title: "Provider" } },
  {
    path: "/403",
    name: "forbidden",
    component: ForbiddenPage,
    meta: { public: true, title: "无权限" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "notFound",
    component: ComingSoonPage,
    meta: { public: true, title: "功能开发中" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

const handledOaNotificationIds = new Set<string>();

function getOaNotificationId(to: RouteLocationNormalized): string | undefined {
  const rawId = to.query.notificationId;
  const notificationId = Array.isArray(rawId) ? rawId[0] : rawId;
  const normalizedId = String(notificationId ?? "").trim();
  return normalizedId || undefined;
}

function receiveOaNotification(to: RouteLocationNormalized): void {
  const notificationId = getOaNotificationId(to);
  if (!notificationId || handledOaNotificationIds.has(notificationId)) {
    return;
  }

  handledOaNotificationIds.add(notificationId);
  // if (typeof window !== "undefined") {
  //   window.alert("OA通知接收");
  // }

  void markOaNotificationReceived(notificationId).catch((error) => {
    // OA 回执失败不应阻断用户进入评审详情，后续可通过 OA 重试机制补偿。
    console.warn("OA 通知接收回执失败", error);
  });
}

function hasMenuPathAccess(
  menus: MenuNode[],
  paths: string[],
  parentPath = "",
): boolean {
  const normalizeAccessPath = (path: string) =>
    path.split("?")[0].replace(/\/$/, "") || "/";
  const isSamePathPattern = (menuPath: string, accessPath: string) => {
    const menuPathSegments = normalizeAccessPath(menuPath)
      .split("/")
      .filter(Boolean);
    const pathSegments = normalizeAccessPath(accessPath)
      .split("/")
      .filter(Boolean);

    return (
      menuPathSegments.length === pathSegments.length &&
      menuPathSegments.every((segment, index) => {
        const accessSegment = pathSegments[index];
        return (
          segment.startsWith(":") ||
          accessSegment?.startsWith(":") ||
          segment === accessSegment
        );
      })
    );
  };

  return menus.some((menu) => {
    if (menu.status === "1" || menu.menuType === "F") {
      return false;
    }

    const menuPath = normalizeMenuPath(menu.path, parentPath);
    const matchesPath = paths.some((path) => isSamePathPattern(menuPath, path));
    if (matchesPath) {
      return true;
    }

    return hasMenuPathAccess(menu.children ?? [], paths, menuPath);
  });
}

function resolveMenuAccessPaths(to: RouteLocationNormalized): string[] {
  const paths = new Set([to.path]);

  to.matched.forEach((record) => {
    if (record.path) {
      paths.add(record.path);
    }
    if (record.aliasOf?.name) {
      paths.add(
        router.resolve({
          name: record.aliasOf.name,
          params: to.params,
        }).path,
      );
    }
  });

  return [...paths];
}

function alertForbiddenNavigation(
  to: RouteLocationNormalized,
  accessPaths: string[],
  reason: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.alert(
    [
      "路由访问被拦截（403）",
      `跳转地址：${to.fullPath}`,
      `路由路径：${to.path}`,
      `路由名称：${String(to.name ?? "-")}`,
      `菜单匹配路径：${accessPaths.join("、") || "-"}`,
      `拦截原因：${reason}`,
    ].join("\n"),
  );
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  // 登录页不应沿用上一次会话的残留认证状态。
  if (to.name === "login") {
    if (authStore.isAuthenticated || authStore.currentUser) {
      removeDynamicRoutes(router, authStore.expireSession());
    }
    return true;
  }

  if (to.meta.public && to.name !== "notFound") {
    return true;
  }

  if (
    to.meta.public &&
    to.name === "notFound" &&
    authStore.isAuthenticated &&
    authStore.dynamicRoutesLoaded
  ) {
    return true;
  }

  if (!authStore.isAuthenticated) {
    removeDynamicRoutes(router, authStore.clearDynamicRoutes());
    return {
      name: "login",
      query: { redirect: to.fullPath },
    };
  }

  if (!authStore.currentUser) {
    try {
      await authStore.loadAuthContext();
    } catch (unknownError) {
      if (unknownError instanceof ApiBusinessError) {
        removeDynamicRoutes(router, authStore.clearDynamicRoutes());
        return {
          name: "login",
          query: { redirect: to.fullPath },
        };
      }
      throw unknownError;
    }
  }

  if (!authStore.dynamicRoutesLoaded) {
    const routeNames = registerDynamicRoutes(router, authStore.menus);
    authStore.markDynamicRoutesLoaded(routeNames);
    if (routeNames.length) {
      return {
        path: to.path,
        query: to.query,
        hash: to.hash,
        replace: true,
      };
    }
  }

  const menuAccessPaths = resolveMenuAccessPaths(to);
  const hasBackendMenuAccess = hasMenuPathAccess(
    authStore.menus,
    menuAccessPaths,
  );
  const hasLocalHiddenRouteFallback = to.meta.hidden === true;
  if (
    !to.meta.menuAccessExempt &&
    !hasBackendMenuAccess &&
    !hasLocalHiddenRouteFallback
  ) {
    alertForbiddenNavigation(to, menuAccessPaths, "后端未返回匹配的菜单路由");
    return { name: "forbidden" };
  }

  const permission = to.meta.permission as string | string[] | undefined;
  if (
    permission &&
    !authStore.hasPermission(permission) &&
    !hasBackendMenuAccess &&
    !hasLocalHiddenRouteFallback
  ) {
    alertForbiddenNavigation(to, menuAccessPaths, "缺少路由访问权限");
    return { name: "forbidden" };
  }

  const permissionsAll = to.meta.permissionsAll as string[] | undefined;
  if (
    !hasBackendMenuAccess &&
    !hasLocalHiddenRouteFallback &&
    permissionsAll?.some(
      (requiredPermission) => !authStore.hasPermission(requiredPermission),
    )
  ) {
    alertForbiddenNavigation(to, menuAccessPaths, "组合权限不完整");
    return { name: "forbidden" };
  }

  const permissionsAny = to.meta.permissionsAny as string[] | undefined;
  if (
    !hasBackendMenuAccess &&
    !hasLocalHiddenRouteFallback &&
    permissionsAny?.length &&
    !permissionsAny.some((requiredPermission) =>
      authStore.hasPermission(requiredPermission),
    )
  ) {
    alertForbiddenNavigation(to, menuAccessPaths, "缺少任一可用路由权限");
    return { name: "forbidden" };
  }

  receiveOaNotification(to);

  return true;
});

router.beforeEach((to, from) => {
  if (to.fullPath !== from.fullPath) {
    saveRouteScroll(from.fullPath);
  }
});

router.afterEach((to) => {
  restoreRouteScroll(to.fullPath);
});

export default router;
