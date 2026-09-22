/**
 * 收益模块仍有一批 JS 实现文件，这里为无后缀/相对路径导入补充声明，
 * 避免 vue-tsc 因缺少 .d.ts 直接失败。运行时仍走原 JS 逻辑。
 */
declare module "@/pages/revenue/subtable-workbench/matrix-utils";
declare module "@/pages/revenue/subtable-workbench/excel-template-parser";
declare module "@/pages/revenue/subtable-workbench/excel-template-exporter";
declare module "@/pages/revenue/subtable-workbench/formula-engine";
declare module "@/pages/revenue/subtable-workbench/services/detail-draft";
declare module "@/pages/revenue/subtable-workbench/material-design-cost";
declare module "@/pages/revenue/subtable-workbench/s1-workflow-guards";
declare module "@/pages/revenue/subtable-workbench/service";
declare module "@/pages/revenue/subtable-workbench/value-normalizer";
declare module "@/pages/revenue/subtable-workbench/services/detail-diagnostics";
declare module "@/pages/revenue/subtable-workbench/services/detail-matrix";
declare module "@/pages/revenue/subtable-workbench/services/stage-completion-summary";
declare module "@/pages/revenue/subtable-fill/formula-tooltip-map";
declare module "@/pages/revenue/meeting-review/service";
declare module "@/pages/revenue/project-list/service";
declare module "./service";
declare module "./review-suggestion";
declare module "./module-identity";
declare module "./subject-write-access";
declare module "./b31-test-data";
declare module "./stage-detail-target";
declare module "./detail.vue";
declare module "../main-table-import/detail.vue";
declare module "@/components/UploadTips";
