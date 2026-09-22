import type { BackendId } from "@/types/information";
import type { TaskCenterTaskResponse } from "@/types/task-center";

export type CostCenterPage<T> = {
    pageNo: number;
    pageSize: number;
    hasNext: boolean;
    total?: number;
    records: T[];
};

export type FactDatasetType = "VERSION_DETAIL" | "GATE_SNAPSHOT" | "AGGREGATE";

export type FactSortDirection = "ASC" | "DESC";

export type CostFactQuery = {
    projectId: BackendId;
    vehicleModelId: BackendId;
    gateId: BackendId;
    datasetType: FactDatasetType;
    fields?: string[];
    sortField?: string;
    sortDirection?: FactSortDirection;
    pageNum?: number;
    pageSize?: number;
};

export type CostFactRow = Record<string, unknown>;

export type CostFactPageResponse = CostCenterPage<CostFactRow>;

export type CostFactExportTaskResponse = TaskCenterTaskResponse;

export type TargetPriceItem = {
    targetPriceId: number;
    partCode: string;
    partName: string;
    targetType?: string | null;
    sorCode?: string | null;
    exFactoryPrice?: string | null;
    packagingCosts?: string | null;
    transportCosts?: string | null;
    arrivalPrice?: string | null;
    purchaseEngineer?: string | null;
    maintainDate?: string | null;
    source?: string | null;
};

export type CostQueryPriceItem = {
    priceId: number;
    sourceType: "SRM_CONTRACT" | "FIXED_PRICE" | "FORECAST_PRICE" | string;
    company?: string | null;
    partNo: string;
    partName?: string | null;
    projectNo?: string | null;
    factoryCode?: string | null;
    factoryName?: string | null;
    supplierCode?: string | null;
    supplierName?: string | null;
    priceFlag?: string | null;
    productServiceFlag?: string | null;
    excludeTaxPrice?: string | null;
    amortizePrice?: string | null;
    noAmortizePrice?: string | null;
    supplierRatio?: string | null;
    wrapCost?: string | null;
    freightCost?: string | null;
    measureUnitName?: string | null;
    priceUnitName?: string | null;
    orderUnitName?: string | null;
    conversionCoefficient?: string | null;
    purchase?: string | null;
    effectiveStartAt?: string | null;
    effectiveEndAt?: string | null;
    transmitAt?: string | null;
};

export type BomQueryItem = {
    id: number | string;
    projectId?: number | string | null;
    projectName?: string | null;
    vehicleReorganizeCode?: string | null;
    vehicleReorganizeName?: string | null;
    partNo?: string | null;
    partName?: string | null;
    quantity?: string | null;
    unit?: string | null;
    firstVehicleModel?: string | null;
    sorName?: string | null;
    expertEngineer?: string | null;
    suggestedSupplySource?: string | null;
    developmentDepartment?: string | null;
    generalizationLevel?: string | null;
    architectureComponent?: string | null;
    ecnProcessNum?: string | null;
    partCategory?: string | null;
    createdBy?: string | null;
    createdAt?: string | null;
};

export type BomQueryPageResponse = CostCenterPage<BomQueryItem>;

export type PurchaseBomItem = {
    purchaseBomId: number;
    projectId: number;
    projectName: string;
    projectNumber?: string | null;
    createdBy?: number | null;
    createBy?: string | null;
    createdAt?: string | null;
    updatedBy?: number | null;
    updatedByName?: string | null;
    reorganizeCount: number;
    costBomStatus: string;
    valveId?: number | null;
    remark?: string | null;
    patterns?: PurchaseBomReorganizePatternItem[] | null;
    updatedAt?: string | null;
    version: number;
};

export type PurchaseBomDetail = PurchaseBomItem & {
    valveId?: number | null;
    generatedCostBomVersionId?: number | null;
    generateTaskId?: number | null;
    generateRequestedAt?: string | null;
    generateFailureSummary?: string | null;
    createdBy?: number | null;
    createdAt?: string | null;
    updatedBy?: number | null;
};

export type PurchaseBomReorganizePatternItem = {
    relationId: number;
    purchaseBomId: number;
    projectId: number;
    reorganizeCode: string;
    reorganizeName?: string | null;
    plant?: string | null;
    patternId?: number | null;
    patternCode?: string | null;
    patternName?: string | null;
    partCount?: number | null;
    checked?: boolean | null;
    sourceSnapshotId?: number | null;
    updatedAt?: string | null;
};

export type PurchaseBomReorganizePatternBindPayload = {
    patternId: number | null;
    patternCode: string | null;
    patternName: string | null;
};

export type PurchaseBomSourcePartItem = {
    sourcePartId: number;
    purchaseBomId: number;
    projectId: number;
    reorganizeCode: string;
    partNo: string;
    partName?: string | null;
    pathQuantity?: string | null;
    unitCode?: string | null;
    modelUserd1st?: string | null;
    sorNum?: string | null;
    engineerIncharge?: string | null;
    sogForSug?: string | null;
    respDept?: string | null;
    pendingGeneralLevel?: string | null;
    partType?: string | null;
    ecnProcessNum?: string | null;
    partCategory?: string | null;
    createBy?: string | null;
    createTime?: string | null;
    sourceSnapshotId?: number | null;
    legacySyncBomId?: number | null;
    sourceBatchNo?: string | null;
    updatedAt?: string | null;
};

export type PurchaseBomVehicleVersionItem = {
    costBomVersionId: string;
    versionNo: number;
    versionName?: string | null;
    status?: string | null;
};

export type CostBomPatternItem = {
    patternId: number;
    patternCode: string;
    patternName: string;
    projectId?: number | null;
    vehicleModelId?: number | null;
    legacyPatternId?: number | null;
    status: string;
    remark?: string | null;
    createdAt?: string | null;
    version: number;
};

export type PurchaseBomProjectPatternItem = {
    patternId: number;
    patternCode: string;
    patternName: string;
    reorganizeCode12?: string | null;
    reorganizeCode18?: string | null;
};

export type CostBomPatternQuery = {
    pageNo?: number;
    pageSize?: number;
    keyword?: string;
    patternCode?: string;
    patternName?: string;
    status?: string;
    projectId?: number;
    vehicleModelId?: number;
    createdAtStart?: string;
    createdAtEnd?: string;
    sortField?: string;
    sortDirection?: "ASC" | "DESC" | string;
};

export type CostBomPatternPageResponse =
    | CostBomPatternItem[]
    | CostCenterPage<CostBomPatternItem>;

export type PurchaseBomDiffItem = {
    partNo: string;
    partName?: string | null;
    oldPartName?: string | null;
    newPartName?: string | null;
    changeType: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED" | string;
    oldPartId?: number | null;
    newSourcePartId?: number | null;
    oldQuantity?: string | null;
    newQuantity?: string | null;
    oldUnit?: string | null;
    newUnit?: string | null;
};

export type PurchaseBomDiffPage = {
    projectId: number;
    purchaseBomId: number;
    reorganizeCode: string;
    baseVersionId: string;
    valveId: number;
    vehicleModelId?: number | null;
    oldPartCount: number;
    newPartCount: number;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
    total?: number;
    pageNo: number;
    pageSize: number;
    hasNext: boolean;
    records: PurchaseBomDiffItem[];
};

export type PurchaseBomPartCompare = {
    projectId: number;
    purchaseBomId: number;
    reorganizeCode: string;
    baseVersionId: string;
    valveId: number;
    vehicleModelId?: number | null;
    partNo: string;
    partName?: string | null;
    oldVersionPart?: PurchaseBomSourcePartItem | null;
    newVersionPart?: PurchaseBomSourcePartItem | null;
    diffFields: Array<{
        fieldCode: string;
        fieldName: string;
        oldValue?: string | null;
        newValue?: string | null;
    }>;
};

export type PurchaseMeetingPriceItem = {
    purchaseMeetingPriceId: number;
    meetingNo?: string | null;
    yearMeetingNo?: string | null;
    meetingDate?: string | null;
    pricingBasis?: string | null;
    vehicleModel?: string | null;
    purchaseBusinessLine?: string | null;
    purchaseMajor?: string | null;
    topicType?: string | null;
    partNo: string;
    partName?: string | null;
    supplier?: string | null;
    exFactoryPrice?: string | null;
    packingFee?: string | null;
    logisticsFee?: string | null;
    noAmortizationPrice?: string | null;
    toolingAmortizationFee?: string | null;
    techDevAmortizationFee?: string | null;
    factoryUnitPrice?: string | null;
    paymentToolingFee?: string | null;
    paymentTechDevFee?: string | null;
    amortizationToolingFee?: string | null;
    amortizationTechDevFee?: string | null;
    amortizationQuantity?: string | null;
    effectiveStartDate?: string | null;
    effectiveEndDate?: string | null;
    remark?: string | null;
    updatedAt?: string | null;
    version: number;
};

export type CostBomGenerateVersionItem = {
    generateVersionId: number;
    costBomVersionId?: number | null;
    projectId: number;
    vehicleModelId?: number | null;
    valveId?: number | null;
    vehicleModelName?: string | null;
    valveName?: string | null;
    version?: number | string | null;
    bomVersion?: number | string | null;
    versionName?: string | null;
    recordType?: string | null;
    latest: boolean;
    lockStatus?: string | null;
    valveStatus?: string | null;
    valveTime?: string | null;
    createBy?: string | number | null;
    updateBy?: string | number | null;
    sourcePurchaseBomId?: number | null;
    sourceTaskId?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type CostBomVersionItem = {
    rowKey?: string;
    versionId: number;
    version: number;
    versionNo: number;
    bomVersion?: number | string | null;
    recordType?: string | null;
    status: string;
    lockStatus?: string | null;
    latest: boolean;
    partCount: number;
    totalCurrentCostAmount?: string | null;
    vehicleModelId?: number | null;
    valveId?: number | null;
    vehicleModelName?: string | null;
    valveName?: string | null;
    valveTime?: string | null;
    createBy?: string | null;
    submittedBy?: number | null;
    submittedByName?: string | null;
    createTime?: string | null;
    submittedAt?: string | null;
    updatedBy?: number | null;
    updatedByName?: string | null;
    updatedAt?: string | null;
};

export type CostBomPartItem = {
    partId: string | number;
    /** 后端 Long 主键原值，禁止转为 JavaScript Number。 */
    partIdText?: string;
    parentId?: number | string | null;
    version: number;
    partNo: string;
    partNumber?: string | null;
    rawPartNumber?: string | null;
    partName: string;
    vehicleModelId?: number | null;
    valveId?: number | null;
    sorId?: number | null;
    sorCode?: string | null;
    sorNumber?: string | null;
    sorName?: string | null;
    supplierId?: number | null;
    supplierCode?: string | null;
    quantity?: string | null;
    unit?: string | null;
    targetCostAmount?: string | null;
    estimatedCostAmount?: string | null;
    currentCostAmount?: string | null;
    materialCostAmount?: string | null;
    amortizePrice?: string | null;
    noAmortizePrice?: string | null;
    materialCostWithAmortization?: string | null;
    materialCostWithoutAmortization?: string | null;
    summaryWrapCost?: string | null;
    summaryFreightCost?: string | null;
    amortizationAmount?: string | null;
    summaryDataSource?: string | null;
    summaryRemark?: string | null;
    supplierName?: string | null;
    firstVehicleModel?: string | null;
    factoryCode?: string | null;
    vehicleReorganizeId?: number | null;
    vehicleReorganizeCode?: string | null;
    vehicleReorganizeName?: string | null;
    ecrNumber?: string | null;
    ecrName?: string | null;
    iaNumber?: string | null;
    iaName?: string | null;
    quotaSrm?: string | null;
    assemblyLevel?: string | null;
    partVersion?: string | null;
    partTechDesc?: string | null;
    moduleIdentifier?: string | null;
    generalizationLevel?: string | null;
    architectureComponent?: string | null;
    isArchitectureComponent?: string | null;
    suggestedSupplySource?: string | null;
    sourceDescription?: string | null;
    multiStructuredSupplySources?: string | null;
    multiSourcesDescription?: string | null;
    developmentDepartment?: string | null;
    expertEngineer?: string | null;
    firstClassification?: string | null;
    secondClassification?: string | null;
    threeClassification?: string | null;
    costEngineer?: string | null;
    procurementEngineer?: string | null;
    costEngineerName?: string | null;
    procurementBusinessLine?: string | null;
    procurementEngineerName?: string | null;
    targetValue?: string | null;
    targetRemark?: string | null;
    initialEvaluationValue?: string | null;
    bidRounds?: number | null;
    exFactoryPrice?: string | null;
    assessDataSources?: string | null;
    currentDataSources?: string | null;
    currentAmortize?: string | null;
    currentAmortizeDataSources?: string | null;
    supplementInfo?: string | null;
    partAttribute?: string | null;
    costDepartmentId?: number | null;
    costCategoryLevel2Id?: number | null;
    costCategoryLevel2Code?: string | null;
    costCategoryLevel2Name?: string | null;
    costCategoryLevel2?: string | null;
    costCategoryLevel3Id?: number | null;
    costCategoryLevel3Code?: string | null;
    costCategoryLevel3Name?: string | null;
    costCategoryLevel3?: string | null;
    costEngineerId?: number | null;
    purchaseEngineerId?: number | null;
    createName?: string | null;
    createBy?: string | number | null;
    createTime?: string | null;
    updateBy?: string | number | null;
    updateTime?: string | null;
    patterns?: CostBomPartPatternItem[] | null;
    costBomPattern?: CostBomPartPatternItem[] | null;
    costBomExtend?: Record<string, unknown> | null;
};

export type CostBomPartPatternItem = {
    id?: number | null;
    costBomId?: number | null;
    patternName?: string | null;
    usagePerVehicle?: string | number | null;
    targetCost?: string | number | null;
    assessedCost?: string | number | null;
    currentCost?: string | number | null;
    currentCostAmortize?: string | number | null;
    currentPackageCost?: string | number | null;
    currentFreightCost?: string | number | null;
    [key: string]: unknown;
};

export type CostBomPartSaveItem = Omit<CostBomPartItem, "partId" | "version">;

export type CostBomPartWritePayload = {
    id?: number | string | null;
    bomVersionId?: number | string | null;
    vehicleModelId?: number | string | null;
    vehicleModelName?: string | null;
    valveId?: number | string | null;
    valveName?: string | null;
    version?: number | string | null;
    projectName?: string | null;
    factoryCode?: string | null;
    partNumber?: string | null;
    partName?: string | null;
    sorNumber?: string | null;
    sorName?: string | null;
    ecrNumber?: string | null;
    ecrName?: string | null;
    iaNumber?: string | null;
    iaName?: string | null;
    assemblyLevel?: string | null;
    partTechDesc?: string | null;
    unitUsage?: string | number | null;
    moduleIdentifier?: string | null;
    firstVehicleModel?: string | null;
    quotaSrm?: string | null;
    supplierName?: string | null;
    generalizationLevel?: string | null;
    isArchitectureComponent?: string | null;
    suggestedSupplySource?: string | null;
    sourceDescription?: string | null;
    multiStructuredSupplySources?: string | null;
    multiSourcesDescription?: string | null;
    developmentDepartment?: string | null;
    expertEngineer?: string | null;
    firstClassification?: string | null;
    secondClassification?: string | null;
    threeClassification?: string | null;
    costEngineer?: string | null;
    procurementEngineer?: string | null;
    partAttribute?: string | null;
    targetValue?: string | number | null;
    targetRemark?: string | null;
    initialEvaluationValue?: string | number | null;
    costBomPattern?: CostBomPartPatternItem[] | null;
    [key: string]: unknown;
};

export type CostBomPartEditScope = "profit" | "design" | "admin";

export type CostBomPartSaveResult = {
    versionId: number;
    projectId: number;
    versionNo: number;
    status: string;
    partCount: number;
    totalCurrentCostAmount?: string | null;
    updatedAt?: string | null;
};

export type CostBomPartColumn = {
    field: keyof CostBomPartItem;
    title: string;
    groupName: string;
    dataType: "TEXT" | "NUMBER" | "MONEY" | string;
    defaultVisible: boolean;
    filterable: boolean;
};

export type CostBomPartMetadata = {
    projectId: number;
    versionId: number;
    columns: CostBomPartColumn[];
    filterableFields: Array<keyof CostBomPartItem>;
    usagePatternNames: string[];
    patternHeaders: Array<{
        patternName: string;
        reorganizeName?: string | null;
        reorganizePartCount?: number | null;
        reorganizeSyncTime?: string | null;
    }>;
};

export type CostBomFilterFields = {
    operatorConfig?: Record<string, unknown>;
    rows?: Array<{
        boardName?: string;
        attrName?: string;
        field?: string;
        fieldType?: string;
        tableSource?: string;
    }>;
    fields?: Array<{
        field: string;
        title: string;
        dataType: "TEXT" | "NUMBER" | "MONEY" | string;
        operators: string[];
    }>;
};

export type CostBomExportResult = {
    exportId: number;
    projectId: number;
    versionId: number;
    format: string;
    fileName: string;
    fileId: BackendId;
    rowCount: number;
    expiresAt?: string | null;
};

export type CostBomImportTemplate = {
    templateVersion: string;
    fileName: string;
    fileId: BackendId;
    fileSize: number;
    sha256: string;
    expiresAt?: string | null;
};

export type CostBomValveDataCopyResult = {
    sourceVersionId?: number | null;
    targetVersionId: number;
    projectId: number;
    copiedPartCount: number;
    copiedPatternCount: number;
    targetPartCount: number;
    totalCurrentCostAmount?: string | null;
    updatedAt?: string | null;
};

export type CostBomAnalysisCategoryItem = {
    vehicleModelId?: number | null;
    vehicleModelName?: string | null;
    rowType: "CATEGORY" | "WEIGHT" | string;
    patternId?: number | null;
    patternCode?: string | null;
    patternName?: string | null;
    categoryLevel?: number | null;
    categoryId?: number | null;
    categoryCode?: string | null;
    categoryName?: string | null;
    targetCostAmount?: string | null;
    currentCostAmount?: string | null;
    partCount?: number | null;
};

export type CostBomAnalysisCategoryResult = {
    projectId: number;
    versionId: number;
    valveId?: number | null;
    records: CostBomAnalysisCategoryItem[];
};

export type CostBomCategoryItem = {
    categoryId: BackendId;
    parentId: BackendId;
    categoryCode: string;
    categoryName: string;
    categoryLevel: number;
    sortNo: number;
    legacyCategoryId?: number | null;
    status: string;
    remark?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    version: number;
};

export type CostBomCategoryPayload = {
    parentId: BackendId;
    categoryCode: string;
    categoryName: string;
    categoryLevel: number;
    sortNo: number;
    status: string;
    remark?: string | null;
    version?: number;
};

export type CostBomVersionDeleteResult = {
    versionId: number;
    projectId: number;
    versionNo?: number | null;
    deleted: boolean;
    deletedBy: number;
    deletedAt: string;
};

export type CostBomVersionLockResult = {
    versionId: number;
    projectId: number;
    versionNo: number;
    lockStatus: "LOCKED" | "UNLOCKED" | string;
    updatedBy?: number | null;
    updatedAt?: string | null;
};

export type CostBomVersionGateStatus = "1" | "2" | "3";

export type CostBomVersionGateStatusResult = {
    versionId: number;
    projectId: number;
    versionNo: number;
    status: CostBomVersionGateStatus;
    updatedAt?: string | null;
};

export type CostBomPartDeleteResult = {
    versionId: number;
    projectId: number;
    partId: number | string;
    remainingPartCount: number;
    totalCurrentCostAmount?: string | null;
    deletedBy: number;
    deletedAt: string;
};

export type CostCoefficientItem = {
    coefficientId: BackendId;
    coefficientCode: string;
    coefficientName: string;
    sourceUnit: string;
    targetUnit: string;
    coefficientValue: string;
    status: string;
    remark?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    version: number;
};

export type CostErrorLogItem = {
    errorLogId: BackendId;
    businessCode?: string | null;
    businessName?: string | null;
    errorMessage: string;
    projectId?: number | null;
    projectName?: string | null;
    valveId?: number | null;
    valveName?: string | null;
    status: string;
    remark?: string | null;
    createBy?: string | null;
    createdBy?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    version: number;
};

export type OaEvaluationPriceItem = {
    id: number;
    costMajor?: string | null;
    secondarySystem?: string | null;
    tertiarySystem?: string | null;
    evaluator?: string | null;
    project?: string | null;
    evaluationType?: string | null;
    fileNo?: string | null;
    partNo: string;
    partName?: string | null;
    initialEvaluationValue?: string | null;
    factoryPrice?: string | null;
    packageFee?: string | null;
    logisticsFee?: string | null;
    warehouseFee?: string | null;
    costBreakdownTargetB?: string | null;
    differenceAB?: string | null;
    targetAchievementRate?: string | null;
    changePlanDescription?: string | null;
    beforeChangePartNo?: string | null;
    afterChangePartNo?: string | null;
    afterChangePartName?: string | null;
    originalCost?: string | null;
    changedCost?: string | null;
    costChange?: string | null;
    toolingMoldQuantity?: number | null;
    toolingMoldQuote?: string | null;
    toolingMoldEvaluation?: string | null;
    differenceEvaluationQuote?: string | null;
    designWorkingDays?: string | null;
    designFee?: string | null;
    testFee?: string | null;
    calibrationFee?: string | null;
    rpPart?: string | null;
    evaluationTotal?: string | null;
    developmentQuote?: string | null;
    developmentDifference?: string | null;
    purchaseInputQuoteC?: string | null;
    quoteEvaluationCA?: string | null;
    finalQuoteD?: string | null;
    negotiationResultDC?: string | null;
    remark?: string | null;
    updatedAt?: string | null;
    version: number;
};

export type SupplyRatioPart = {
    partNo: string;
    ratioTotal: string;
    complete: boolean;
    suppliers: Array<{
        supplierCode?: string | null;
        supplierName?: string | null;
        supplierChName?: string | null;
        supplierRatio?: string | null;
        noAmortizePrice?: string | null;
        noAmortizationPrice?: string | null;
        amortizePrice?: string | null;
        amortizationPrice?: string | null;
        transmitDate?: string | null;
        transmitAt?: string | null;
        ratioTransmitDate?: string | null;
        quotaTransmitDate?: string | null;
    }>;
};

export type CostBomDashboardValveSummary = {
    valveId?: number | null;
    valveCode?: string | null;
    valveName?: string | null;
    valveStatus?: string | null;
    targetCostAmount?: string | null;
    currentCostAmount?: string | null;
    partCount: number;
};

export type CostBomDashboardPatternSummary = {
    patternId?: number | null;
    patternCode?: string | null;
    patternName?: string | null;
    valves: CostBomDashboardValveSummary[];
};

export type CostBomDashboardPatternDetail = {
    patternId?: number | null;
    patternCode?: string | null;
    patternName?: string | null;
    targetCostAmount?: string | null;
    currentCostAmount?: string | null;
    partCount: number;
};

export type TaskCreatedResponse = {
    taskId: number;
    taskType: string;
    businessModule: string;
    businessId: number;
    businessKey: string;
    batchNo?: string | null;
    status: string;
    createdAt?: string | null;
    taskNo?: string | null;
};
