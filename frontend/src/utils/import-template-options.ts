import type { ExcelTemplateOptions } from "@/utils/download-template";

export function createGateReviewBudgetImportTemplate(): ExcelTemplateOptions {
  return {
    fileName: "阀点预算导入模版.xlsx",
    sheetName: "过阀预算导入",
    columns: [
      { header: "WBS编号", key: "wbsNumber", width: 24 },
      { header: "WBS名称", key: "wbsName", width: 32 },
      { header: "金额类型", key: "amountKind", width: 20 },
      { header: "维度类型", key: "dimensionType", width: 18 },
      { header: "金额", key: "amount", width: 16 },
      { header: "备注", key: "remark", width: 30 },
    ],
    sampleRow: {
      wbsNumber: "WBS-001",
      wbsName: "过阀预算项",
      amountKind: "VALVE_ASSESS",
      dimensionType: "VALVE",
      amount: "100000.00",
      remark: "示例行，导入前可删除",
    },
  };
}

export function createCompetitorImportTemplate(): ExcelTemplateOptions {
  return {
    fileName: "竞品导入模板.xlsx",
    sheetName: "竞品导入",
    columns: [
      { header: "车型名称", key: "name", width: 24 },
      { header: "品牌", key: "brand", width: 20 },
      { header: "销量（台）", key: "level", width: 16 },
      { header: "实际成交价（万元）", key: "sortNo", width: 20 },
      { header: "市场指导价（万元）", key: "remark", width: 20 },
      { header: "状态", key: "status", width: 14 },
    ],
    sampleRow: {
      name: "示例车型",
      brand: "示例品牌",
      level: "10000",
      sortNo: 12.5,
      remark: "15.8",
      status: "ENABLED",
    },
  };
}

export function createMechanizedKanbanImportTemplate(): ExcelTemplateOptions {
  return {
    fileName: "综采看板-数据导入模版.xlsx",
    sheetName: "综采数据",
    columns: [
      { header: "公司", key: "company", width: 18 },
      { header: "采购业务线", key: "businessLine", width: 18 },
      { header: "申请单号", key: "orderNo", width: 22 },
      { header: "采购额", key: "procurementAmount", width: 16 },
      {
        header: "采购结果报告金额",
        key: "procurementResultAmount",
        width: 22,
      },
      { header: "降本额", key: "costReductionAmount", width: 16 },
      { header: "降本率", key: "costReductionRate", width: 14 },
      {
        header: "需求确认日期",
        key: "requirementConfirmationDate",
        width: 18,
      },
      {
        header: "采购结果结束日期",
        key: "procurementResultsEndDate",
        width: 18,
      },
      {
        header: "采购结果结束月",
        key: "procurementResultsEndMonth",
        width: 18,
      },
      {
        header: "节假日周期（法定节假日周期）",
        key: "procurementAmountCompletionRate",
        width: 32,
      },
      { header: "采购周期", key: "procurementCycle", width: 14 },
    ],
    sampleRow: {
      company: "北汽股份",
      businessLine: "营销采购",
      orderNo: "GF2025072800912",
      procurementAmount: "996930.00",
      procurementResultAmount: "659002.00",
      costReductionAmount: "337928.00",
      costReductionRate: "33.90",
      requirementConfirmationDate: "2026-02-02",
      procurementResultsEndDate: "2026-02-10",
      procurementResultsEndMonth: "2026-02",
      procurementAmountCompletionRate: null,
      procurementCycle: 8,
    },
  };
}
