export type RdGroup = {
  id: number;
  groupCode: string;
  groupName: string;
  sortNo?: number | null;
  status?: string | null;
};

export type RdProfession = {
  id: number;
  groupId: number;
  professionCode: string;
  professionName: string;
  sortNo?: number | null;
  status?: string | null;
};

export type RdCategoryOption = {
  categoryId: number;
  categoryCode?: string | null;
  categoryName: string;
  physicalLevel: number;
  parentId?: number | null;
  partAttribute?: string | null;
  firstClassification?: string | null;
  secondClassification?: string | null;
  fullPath: string;
  responsibilityType?: string | null;
};

export type RdMutation = {
  requestId: string;
};

export type RdGroupSavePayload = RdMutation & {
  groupCode: string;
  groupName: string;
  sortNo?: number | null;
  status?: string | null;
};

export type RdProfessionSavePayload = RdMutation & {
  groupId: number;
  professionCode: string;
  professionName: string;
  sortNo?: number | null;
  status?: string | null;
};

export type RdProfessionCategoryReplacePayload = RdMutation & {
  categoryIds: number[];
};
