<template>
  <div class="app-container history-import-attachment-page">
    <el-form :inline="true" :model="searchForm" size="small" class="mb-4">
      <el-form-item label="上传时间">
        <el-date-picker
          v-model="searTime"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="yyyy-MM-dd"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="文件名称">
        <el-input
          v-model="searchForm.fileName"
          placeholder="请输入文件名称"
          clearable
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="main-split">
      <aside class="project-tree-panel">
        <div class="tree-header">
          <span class="tree-title">项目目录</span>
        </div>
        <el-input
          v-model="treeFilterText"
          size="small"
          clearable
          :prefix-icon="Search"
          placeholder="搜索项目或阀点"
          class="tree-search"
        />
        <el-tree
          ref="projectTreeRef"
          v-loading="treeLoading"
          class="project-tree"
          node-key="id"
          :data="treeData"
          :props="treeProps"
          :highlight-current="true"
          :expand-on-click-node="false"
          :filter-node-method="filterTreeNode"
          :current-node-key="selectedTreeNodeId"
          default-expand-all
          @node-click="handleTreeNodeClick"
        >
          <template #default="{ data }">
            <span class="custom-tree-node">
              <span
                class="folder-icon"
                :class="data.nodeType === 'valve' ? 'folder-icon--open' : 'folder-icon--closed'"
              ></span>
              <span class="tree-node-label" :title="data.label">{{ data.label }}</span>
            </span>
          </template>
        </el-tree>
      </aside>

      <section class="file-list-panel">
        <div v-if="currentPath" class="current-path">
          当前位置：<span>{{ currentPath }}</span>
          <span v-if="total >= 0" class="current-count">（{{ total }} 个文件）</span>
        </div>

        <div class="mb-4 toolbar-row">
          <el-button
            v-hasPermi="['revenue:history-import:attachment:upload']"
            type="primary"
            size="mini"
            plain
            :icon="Upload"
            @click="handleUpload"
          >附件上传</el-button>
          <el-button
            v-hasPermi="['revenue:history-import:attachment:remove']"
            size="mini"
            plain
            type="danger"
            :icon="DeleteIcon"
            :loading="actionLoading"
            @click="handleBatchDelete"
          >批量删除</el-button>
          <el-button
            v-hasPermi="['revenue:history-import:attachment:download']"
            size="mini"
            plain
            type="warning"
            :icon="Download"
            :loading="actionLoading"
            :disabled="!haveChecked"
            @click="handleBatchDownload"
          >批量下载</el-button>
          <el-button type="default" class="view-toggle-btn" @click="toggleViewMode">
            <Grid v-if="viewMode === 'table'" />
            <Operation v-else />
          </el-button>
        </div>

        <div v-if="viewMode === 'table'" class="table-wrapper">
          <el-table
            ref="tableRef"
            v-loading="loading"
            :data="tableData"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="50" align="center" />
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="fileName" label="文件名称" min-width="220" show-overflow-tooltip />
            <el-table-column
              v-if="showProjectColumns"
              label="项目名称"
              min-width="140"
              show-overflow-tooltip
            >
              <template #default="scope">
                {{ resolveProjectDisplayName(scope.row.projectId, scope.row.projectName) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="showProjectColumns"
              prop="valvePoint"
              label="项目阀点"
              width="100"
              align="center"
            />
            <el-table-column prop="fileType" label="文件类型" width="120" align="center" />
            <el-table-column prop="creatorName" label="上传人" width="120" align="center" />
            <el-table-column prop="uploadTime" label="上传时间" width="180" align="center" />
            <el-table-column label="操作" width="180" fixed="right" align="center">
              <template #default="scope">
                <el-button
                  v-hasPermi="['revenue:history-import:attachment:preview']"
                  type="text"
                  @click="handlePreview(scope.row)"
                >预览</el-button>
                <el-button
                  v-hasPermi="['revenue:history-import:attachment:download']"
                  type="text"
                  @click="handleDownload(scope.row)"
                >下载</el-button>
                <el-button
                  v-hasPermi="['revenue:history-import:attachment:remove']"
                  type="text"
                  @click="handleDelete(scope.row)"
                >删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else class="grid-view">
          <div class="grid-header mb-4">
            <el-checkbox v-model="checkedAll">全选</el-checkbox>
          </div>
          <div class="grid-container">
            <div v-for="item in tableData" :key="item.id" class="grid-item">
              <div class="grid-item-content">
                <div class="checkbox-wrapper">
                  <el-checkbox v-model="item.checked" />
                </div>
                <div class="file-icon">
                  <Document />
                </div>
                <div class="file-info">
                  <div class="file-name">{{ item.fileName }}</div>
                  <div v-if="showProjectColumns" class="file-project">
                    {{ formatProjectPath(item) }}
                  </div>
                  <div class="file-type">{{ item.fileType }}</div>
                  <div class="file-time">{{ item.uploadTime }}</div>
                </div>
                <div class="hover-actions">
                  <el-button size="small" @click="handlePreview(item)">预览</el-button>
                  <el-button size="small" @click="handleDownload(item)">下载</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <pagination
          v-show="total > 0"
          v-model:page="searchForm.pageNum"
          v-model:limit="searchForm.pageSize"
          :total="total"
          @pagination="getList"
        />
      </section>
    </div>

    <el-dialog
      v-model="uploadDialogVisible"
      title="附件上传"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="96px" size="small">
        <el-form-item label="项目名称" prop="projectId">
          <el-select
            v-model="uploadForm.projectId"
            filterable
            clearable
            placeholder="请选择项目"
            style="width: 100%"
            @change="handleUploadProjectChange"
          >
            <el-option
              v-for="item in projectOptions"
              :key="item.projectId"
              :label="item.projectName"
              :value="item.projectId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="项目阀点" prop="valvePoint">
          <el-select
            v-model="uploadForm.valvePoint"
            filterable
            clearable
            placeholder="请选择阀点"
            style="width: 100%"
          >
            <el-option
              v-for="item in valvePointOptions"
              :key="item.id || item.valveName"
              :label="item.valveName"
              :value="item.valveName"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="附件文件" required>
          <div v-loading="uploading">
            <el-upload
              ref="uploadRef"
              drag
              action="#"
              :auto-upload="false"
              :limit="1"
              :show-file-list="false"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.zip"
              :on-change="handleFileChange"
            >
              <Upload />
              <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 pdf、doc、docx、xls、xlsx、png、jpg、jpeg、txt、zip，单文件最大 50MB
                </div>
              </template>
            </el-upload>
            <div v-if="pendingFile" class="pending-file">
              <Paperclip />
              <span>{{ pendingFile.name }}</span>
              <el-button type="text" @click="clearPendingFile">移除</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="uploading" @click="submitUpload">确定</el-button>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>

    <FilePreview
      v-if="previewShow"
      ref="previewRef"
      @close-preview="previewShow = false"
    />

    <!-- 确认弹窗 -->
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue';
import {
  Search,
  Refresh,
  Upload,
  Download,
  Delete as DeleteIcon,
  Document,
  Paperclip,
  Grid,
  Operation,
} from '@element-plus/icons-vue';
import { BaseToast } from '@/components/base/BaseToast';
import BaseConfirm from '@/components/base/BaseConfirm.vue';
import { useBaseConfirmDialog } from '@/composables/useBaseConfirmDialog';
import FilePreview from '@/components/FilePreview.vue';
import { valveOptions } from '@/api/project';
import { listValve } from '@/api/system/valve';
import { getRevenueProjectList } from '@/api/revenue/projectList';
import { listSelectableProjectCostFlowProjects } from '@/api/system/expenses';
import {
  batchDeleteHistoryImportAttachments,
  batchDownloadHistoryImportAttachments,
  deleteHistoryImportAttachment,
  downloadHistoryImportAttachment,
  getHistoryImportAttachmentTreeSummary,
  listHistoryImportAttachments,
  previewHistoryImportAttachment,
  uploadHistoryImportAttachment,
} from '@/api/revenue/historyImportAttachment';

// ===== TypeScript interfaces =====
interface TreeNode {
  id: string;
  label: string;
  nodeType: 'uncategorized' | 'project' | 'valve';
  projectName?: string;
  projectId?: number;
  projectIds?: number[];
  storedProjectNames?: string[];
  valvePoint?: string;
  children?: TreeNode[];
}

interface ValveSummaryItem {
  valvePoint: string;
  count: number;
}

interface ProjectSummaryItem {
  projectId: number;
  projectName: string;
  totalCount: number;
  valves: ValveSummaryItem[];
}

interface TreeSummary {
  totalCount: number;
  uncategorizedCount: number;
  projects: ProjectSummaryItem[];
}

interface ValveOption {
  id: number | string;
  valveName: string;
  sort: number;
}

interface UploadForm {
  projectId: number | null;
  projectCode: string;
  projectName: string;
  valvePoint: string;
}

interface SearchForm {
  fileName: string;
  projectId?: string | number;
  projectIds?: string;
  projectNames?: string;
  valvePoint?: string;
  uncategorized?: boolean;
  pageNum: number;
  pageSize: number;
  createdAtStart?: string;
  createdAtEnd?: string;
}

interface TableItem {
  id: number;
  fileName: string;
  projectId?: number;
  projectName?: string;
  valvePoint?: string;
  fileType?: string;
  creatorName?: string;
  uploadTime?: string;
  checked: boolean;
  [key: string]: unknown;
}

interface ProjectOptionItem {
  projectId: number;
  projectCode: string;
  projectName: string;
}

interface PreviewTypeItem {
  name: string;
  type: string;
  ext: string[];
}

interface GroupData {
  projectName: string;
  projectIds: number[];
  storedProjectNames: string[];
  totalCount: number;
  valveMap: Map<string, number>;
}

// ===== Constants =====
const PREVIEW_TYPES: PreviewTypeItem[] = [
  { name: 'PDF', type: 'application/pdf', ext: ['pdf'] },
  { name: 'DOCX', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['docx'] },
  { name: 'DOC', type: 'application/msword', ext: ['doc'] },
  { name: 'XLSX', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: ['xlsx'] },
  { name: 'XLS', type: 'application/vnd.ms-excel', ext: ['xls'] },
  { name: 'TXT', type: 'text/plain', ext: ['txt'] },
  { name: 'PNG', type: 'image/png', ext: ['png'] },
  { name: 'JPG', type: 'image/jpeg', ext: ['jpg', 'jpeg'] },
];

// ===== Utility functions =====
function safeText(value: unknown, fallback = ''): string {
  const text = String(value == null ? '' : value).trim();
  return text || String(fallback == null ? '' : fallback);
}

 
function extractValveRows(response: any): any[] {
  if (!response) {
    return [];
  }
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response.data)) {
    return response.data;
  }
  if (Array.isArray(response.rows)) {
    return response.rows;
  }
  return [];
}

function saveAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===== Template refs =====
 
const projectTreeRef = ref<any>(null);
 
const uploadFormRef = ref<any>(null);
 
const uploadRef = ref<any>(null);
 
const previewRef = ref<any>(null);
 
const _tableRef = ref<any>(null);

// ===== 确认弹窗 =====
const {
  confirmState,
  openConfirm,
  resolveConfirm,
  rejectConfirm,
} = useBaseConfirmDialog();

// ===== Reactive state =====
const loading = ref(false);
const treeLoading = ref(false);
const actionLoading = ref(false);
const uploading = ref(false);
const uploadDialogVisible = ref(false);
const previewShow = ref(false);
const searTime = ref<string[] | null>(null);
const pendingFile = ref<File | null>(null);
const treeFilterText = ref('');
const treeData = ref<TreeNode[]>([]);
const treeSummary = ref<TreeSummary>({
  totalCount: 0,
  uncategorizedCount: 0,
  projects: [],
});
const projectNameMap = ref<Record<number, string>>({});
const treeProps = {
  children: 'children',
  label: 'label',
};
const selectedTreeNode = ref<TreeNode | null>(null);
const selectedTreeNodeId = ref<string | null>(null);
const projectOptions = ref<ProjectOptionItem[]>([]);
const valvePointOptions = ref<ValveOption[]>([]);
const valvePointOrder = ref<string[]>([]);
const uploadForm = reactive<UploadForm>({
  projectId: null,
  projectCode: '',
  projectName: '',
  valvePoint: '',
});
const uploadRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  valvePoint: [{ required: true, message: '请选择项目阀点', trigger: 'change' }],
};
const searchForm = reactive<SearchForm>({
  fileName: '',
  projectId: undefined,
  projectIds: undefined,
  projectNames: undefined,
  valvePoint: undefined,
  uncategorized: undefined,
  pageNum: 1,
  pageSize: 10,
  createdAtStart: undefined,
  createdAtEnd: undefined,
});
const tableData = ref<TableItem[]>([]);
const selectedRows = ref<TableItem[]>([]);
const total = ref(0);
const viewMode = ref<string>('table');

// ===== Computed =====
const haveChecked = computed(() => {
  return tableData.value.some((item: any) => item.checked) || selectedRows.value.length > 0;
});

const checkedAll = computed({
  get() {
    return tableData.value.length > 0 && tableData.value.every((item: any) => item.checked);
  },
  set(val: boolean) {
    tableData.value.forEach((item: any) => {
      item.checked = val;
    });
  },
});

const showProjectColumns = computed(() => {
  const nodeType = selectedTreeNode.value && selectedTreeNode.value.nodeType;
  return nodeType !== 'valve';
});

const currentPath = computed(() => {
  const node = selectedTreeNode.value;
  if (!node) {
    return '';
  }
  if (node.nodeType === 'uncategorized') {
    return '未分类';
  }
  if (node.nodeType === 'project') {
    return resolveProjectDisplayName(node.projectId, node.projectName);
  }
  if (node.nodeType === 'valve') {
    const projectLabel = resolveProjectDisplayName(node.projectId, node.projectName);
    return `${projectLabel} / ${node.valvePoint || '-'}`;
  }
  return '';
});

// ===== Watchers =====
watch(searTime, (value: string[] | null) => {
  if (value && value.length === 2) {
    searchForm.createdAtStart = `${value[0]} 00:00:00`;
    searchForm.createdAtEnd = `${value[1]} 23:59:59`;
  } else {
    searchForm.createdAtStart = undefined;
    searchForm.createdAtEnd = undefined;
  }
});

watch(treeFilterText, (value: string) => {
  if (projectTreeRef.value) {
    projectTreeRef.value.filter(value);
  }
});

// ===== Methods =====
 
function extractProjectName(row: any): string {
  const vehicleModel = (row && row.vehicleModel) || {};
  return safeText(
    vehicleModel.modelName || row.modelName || row.projectName,
    row.projectCode || row.projectNo || row.wbsNumber || ''
  );
}

function resolveProjectDisplayName(projectId: number | undefined, fallback = ''): string {
  if (projectId == null) return safeText(fallback, '-');
  const mapped = projectNameMap.value[projectId];
  if (mapped) {
    return mapped;
  }
  return safeText(fallback, `项目${projectId}`);
}

function buildProjectGroupKey(projectName: string): string {
  return String(projectName || '').trim().toLowerCase();
}

function buildProjectGroupId(projectName: string): string {
  return `project-name-${encodeURIComponent(projectName)}`;
}

 
function _resolveProjectIdsByDisplayName(displayName: string): number[] {
  const target = String(displayName || '').trim().toLowerCase();
  const ids: number[] = [];
  Object.entries(projectNameMap.value).forEach(([id, name]) => {
    if (String(name || '').trim().toLowerCase() === target) {
      ids.push(Number(id));
    }
  });
  return ids;
}

async function refreshPageData(): Promise<void> {
  await Promise.all([loadProjectNameMap(), loadValveOptions()]);
  await loadTreeSummary();
  restoreOrSelectTreeNode();
  await getList();
}

async function loadValveOptions(): Promise<void> {
   
  let rows: any[] = [];
  try {
    const res = await valveOptions();
    rows = extractValveRows(res);
  } catch {
    // fallback
  }
  if (!rows.length) {
    try {
      const res = await listValve({
        pageNum: 1,
        pageSize: 500,
      });
      rows = extractValveRows(res);
    } catch {
      // fallback
    }
  }
  const sorted = [...rows].sort((left: any, right: any) => {
    const sortLeft = Number(left.sort);
    const sortRight = Number(right.sort);
    if (Number.isFinite(sortLeft) && Number.isFinite(sortRight) && sortLeft !== sortRight) {
      return sortLeft - sortRight;
    }
    return safeText(left.valveName).localeCompare(safeText(right.valveName), 'zh-CN', {
      sensitivity: 'base',
    });
  });
  valvePointOptions.value = sorted
    .map((row: any) => ({
      id: row.id,
      valveName: safeText(row.valveName),
      sort: row.sort,
    }))
    .filter((item: any) => item.valveName);
  valvePointOrder.value = valvePointOptions.value.map((item: any) => item.valveName);
}

async function loadProjectNameMap(): Promise<void> {
  try {
    const res = await getRevenueProjectList({
      pageNum: 1,
      pageSize: 500,
    });
    const rows = res.rows || ((res as any).data && (res as any).data.rows) || (res as any).data || [];
    const list = Array.isArray(rows) ? rows : [];
    const map: Record<number, string> = {};
     
    list.forEach((row: any) => {
      const projectId = Number(row.projectId || row.id);
      if (!projectId) {
        return;
      }
      map[projectId] = extractProjectName(row);
    });
    projectNameMap.value = map;
  } catch {
    projectNameMap.value = {};
  }
}

async function loadTreeSummary(): Promise<void> {
  treeLoading.value = true;
  try {
    const res = await getHistoryImportAttachmentTreeSummary();
    // request() 已解包 R.data，这里 res 本身就是树汇总对象；兼容偶发仍带 data 信封的情况
    const payload =
      res && Array.isArray((res as unknown as TreeSummary).projects)
        ? (res as unknown as TreeSummary)
        : ((res as unknown as { data?: TreeSummary })?.data || {
            totalCount: 0,
            uncategorizedCount: 0,
            projects: [],
          });
    treeSummary.value = {
      totalCount: Number(payload.totalCount || 0),
      uncategorizedCount: Number(payload.uncategorizedCount || 0),
      projects: Array.isArray(payload.projects) ? payload.projects : [],
    };
    treeData.value = buildTreeNodes(treeSummary.value);
  } finally {
    treeLoading.value = false;
  }
}

function buildTreeNodes(summary: TreeSummary): TreeNode[] {
  const nodes: TreeNode[] = [];
  if ((summary.uncategorizedCount || 0) > 0) {
    nodes.push({
      id: 'uncategorized',
      label: `未分类 (${summary.uncategorizedCount})`,
      nodeType: 'uncategorized',
    });
  }

  const groupMap = new Map<string, GroupData>();
  (summary.projects || []).forEach((project: any) => {
    const projectLabel = resolveProjectDisplayName(project.projectId, project.projectName);
    const groupKey = buildProjectGroupKey(projectLabel);
    if (!groupKey) {
      return;
    }
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        projectName: projectLabel,
        projectIds: [],
        storedProjectNames: [],
        totalCount: 0,
        valveMap: new Map(),
      });
    }
    const group = groupMap.get(groupKey)!;
    if (project.projectId && !group.projectIds.includes(project.projectId)) {
      group.projectIds.push(project.projectId);
    }
    const storedProjectName = safeText(project.projectName);
    if (storedProjectName && !group.storedProjectNames.includes(storedProjectName)) {
      group.storedProjectNames.push(storedProjectName);
    }
    if (projectLabel && !group.storedProjectNames.includes(projectLabel)) {
      group.storedProjectNames.push(projectLabel);
    }
    group.totalCount += Number(project.totalCount || 0);
    (project.valves || []).forEach((valve: any) => {
      const valvePoint = valve.valvePoint;
      if (!valvePoint) {
        return;
      }
      const prev = group.valveMap.get(valvePoint) || 0;
      group.valveMap.set(valvePoint, prev + Number(valve.count || 0));
    });
  });

  const sortedGroups = Array.from(groupMap.values()).sort((left: any, right: any) =>
    String(left.projectName).localeCompare(String(right.projectName), 'zh-CN', { sensitivity: 'base' })
  );

  sortedGroups.forEach((group: any) => {
    const groupId = buildProjectGroupId(group.projectName);
    const filterScope = {
      projectIds: [...group.projectIds],
      storedProjectNames: [...group.storedProjectNames],
    };
    const children: TreeNode[] = buildOrderedValvePoints(group.valveMap).map((valvePoint: any) => ({
      id: `${groupId}-${valvePoint}`,
      label: `${valvePoint} (${group.valveMap.get(valvePoint)})`,
      nodeType: 'valve' as const,
      projectName: group.projectName,
      projectIds: filterScope.projectIds,
      storedProjectNames: filterScope.storedProjectNames,
      valvePoint,
    }));

    nodes.push({
      id: groupId,
      label: `${group.projectName} (${group.totalCount})`,
      nodeType: 'project',
      projectName: group.projectName,
      projectIds: filterScope.projectIds,
      storedProjectNames: filterScope.storedProjectNames,
      children,
    });
  });
  return nodes;
}

function buildOrderedValvePoints(valveMap: Map<string, number>): string[] {
  const ordered: string[] = (valvePointOrder.value || []).filter((valvePoint: any) => valveMap.has(valvePoint));
  Array.from(valveMap.keys()).forEach((valvePoint: any) => {
    if (!ordered.includes(valvePoint)) {
      ordered.push(valvePoint);
    }
  });
  return ordered;
}

function restoreOrSelectTreeNode(): void {
  if (selectedTreeNodeId.value && treeNodeExists(selectedTreeNodeId.value)) {
    selectedTreeNode.value = findTreeNodeById(selectedTreeNodeId.value);
  } else {
    selectDefaultTreeNode();
    return;
  }
  applyTreeFilter(selectedTreeNode.value, false);
  syncTreeSelection();
}

function findTreeNodeById(nodeId: string): TreeNode | null {
  let target: TreeNode | null = null;
  const walk = (nodes: TreeNode[]): void => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        target = node;
        return;
      }
      if (node.children && node.children.length) {
        walk(node.children);
      }
      if (target) {
        return;
      }
    }
  };
  walk(treeData.value);
  return target;
}

function treeNodeExists(nodeId: string): boolean {
  if (!nodeId) {
    return false;
  }
  const walk = (nodes: TreeNode[]): boolean => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return true;
      }
      if (node.children && node.children.length && walk(node.children)) {
        return true;
      }
    }
    return false;
  };
  return walk(treeData.value);
}

function findFirstSelectableNode(nodes: TreeNode[] = []): TreeNode | null {
  for (const node of nodes) {
    if (node.nodeType === 'uncategorized' || node.nodeType === 'project') {
      return node;
    }
  }
  return nodes[0] || null;
}

function selectDefaultTreeNode(): void {
  const firstNode = findFirstSelectableNode(treeData.value);
  if (!firstNode) {
    selectedTreeNode.value = null;
    selectedTreeNodeId.value = null;
    searchForm.projectId = undefined;
    searchForm.projectIds = undefined;
    searchForm.projectNames = undefined;
    searchForm.valvePoint = undefined;
    searchForm.uncategorized = undefined;
    return;
  }
  selectedTreeNode.value = firstNode;
  selectedTreeNodeId.value = firstNode.id;
  applyTreeFilter(firstNode, false);
  syncTreeSelection();
}

function syncTreeSelection(): void {
  nextTick(() => {
    if (projectTreeRef.value && selectedTreeNodeId.value) {
      projectTreeRef.value.setCurrentKey(selectedTreeNodeId.value);
    }
  });
}

function filterTreeNode(value: string, data: TreeNode): boolean {
  if (!value) {
    return true;
  }
  const keyword = String(value).trim().toLowerCase();
  const label = String(data.label || '').toLowerCase();
  const projectName = String(data.projectName || '').toLowerCase();
  const valvePoint = String(data.valvePoint || '').toLowerCase();
  return label.includes(keyword) || projectName.includes(keyword) || valvePoint.includes(keyword);
}

function handleTreeNodeClick(data: TreeNode): void {
  selectedTreeNode.value = data;
  selectedTreeNodeId.value = data.id;
  applyTreeFilter(data);
}

function applyTreeFilter(node: TreeNode | null, resetPage = true): void {
  searchForm.projectId = undefined;
  searchForm.projectIds = undefined;
  searchForm.projectNames = undefined;
  searchForm.valvePoint = undefined;
  searchForm.uncategorized = undefined;

  if (!node) {
    // 保持清空
  } else if (node.nodeType === 'uncategorized') {
    searchForm.uncategorized = true;
  } else if (node.nodeType === 'project' || node.nodeType === 'valve') {
    const projectIds = (node.projectIds || []).filter((id: any) => id);
    const storedProjectNames = (node.storedProjectNames || []).filter((name: any) => name);
    if (projectIds.length) {
      searchForm.projectIds = projectIds.join(',');
    }
    if (storedProjectNames.length) {
      searchForm.projectNames = storedProjectNames.join(',');
    }
    if (node.nodeType === 'valve') {
      searchForm.valvePoint = node.valvePoint;
    }
  }
  if (resetPage) {
    searchForm.pageNum = 1;
    getList();
  }
}

 
function buildListQueryParams(): Record<string, any> {
   
  const params: Record<string, any> = {
    pageNum: searchForm.pageNum,
    pageSize: searchForm.pageSize,
  };
  if (searchForm.fileName) {
    params.fileName = searchForm.fileName;
  }
  if (searchForm.createdAtStart) {
    params.createdAtStart = searchForm.createdAtStart;
  }
  if (searchForm.createdAtEnd) {
    params.createdAtEnd = searchForm.createdAtEnd;
  }
  if (searchForm.uncategorized) {
    params.uncategorized = true;
  }
  if (searchForm.projectIds) {
    params.projectIds = searchForm.projectIds;
  }
  if (searchForm.projectNames) {
    params.projectNames = searchForm.projectNames;
  }
  if (searchForm.valvePoint) {
    params.valvePoint = searchForm.valvePoint;
  }
  return params;
}

async function getList(): Promise<void> {
  loading.value = true;
  try {
    const res = await listHistoryImportAttachments(buildListQueryParams());
     
    tableData.value = ((res.rows || []) as any).map((item: any) => ({
      ...item,
      checked: false,
    }));
    total.value = Number((res as any).total) || 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch(): void {
  searchForm.pageNum = 1;
  getList();
}

function handleReset(): void {
  searTime.value = null;
  searchForm.fileName = '';
  searchForm.pageNum = 1;
  getList();
}

async function loadProjectOptions(): Promise<void> {
  const res = await listSelectableProjectCostFlowProjects({
    pageNum: 1,
    pageSize: 200,
  });
  const rows = res.rows || (res.data && (res.data as any).rows) || res.data || [];
  const list = Array.isArray(rows) ? rows : [];
  projectOptions.value = list
     
    .map((row: any) => ({
      projectId: Number(row.projectId || row.id),
      projectCode: safeText(row.projectCode || row.projectNo || row.wbsNumber),
      projectName: extractProjectName(row),
    }))
    .filter((item: any) => item.projectId && item.projectName);
}

function formatProjectPath(row: TableItem): string {
  if (!row.projectId) {
    return '未分类';
  }
  const projectLabel = resolveProjectDisplayName(row.projectId, row.projectName);
  return row.valvePoint ? `${projectLabel} / ${row.valvePoint}` : projectLabel;
}

async function handleUpload(): Promise<void> {
  pendingFile.value = null;
  uploadForm.projectId = null;
  uploadForm.projectCode = '';
  uploadForm.projectName = '';
  uploadForm.valvePoint = '';
  const node = selectedTreeNode.value;
  if (node && (node.nodeType === 'valve' || node.nodeType === 'project')) {
    uploadForm.projectName = node.projectName || '';
    if (node.nodeType === 'valve') {
      uploadForm.valvePoint = node.valvePoint || '';
    }
  }
  uploadDialogVisible.value = true;
  await Promise.all([loadProjectOptions(), loadValveOptions()]);
  if (node && node.projectIds && node.projectIds.length === 1) {
    uploadForm.projectId = node.projectIds[0];
    handleUploadProjectChange(node.projectIds[0]);
  } else if (node && (node.nodeType === 'valve' || node.nodeType === 'project')) {
    const matched = projectOptions.value.find((item: any) => item.projectName === node.projectName);
    if (matched) {
      uploadForm.projectId = matched.projectId;
      handleUploadProjectChange(matched.projectId);
    }
  }
  nextTick(() => {
    if (uploadRef.value) {
      uploadRef.value.clearFiles();
    }
    if (uploadFormRef.value) {
      uploadFormRef.value.clearValidate();
    }
  });
}

function handleUploadProjectChange(projectId: number): void {
  const target = projectOptions.value.find((item: any) => item.projectId === projectId);
  if (!target) {
    uploadForm.projectCode = '';
    uploadForm.projectName = '';
    return;
  }
  uploadForm.projectCode = target.projectCode;
  uploadForm.projectName = target.projectName;
}

 
function handleFileChange(file: any): void {
  if (file.status !== 'ready' || !file.raw) {
    return;
  }
  pendingFile.value = file.raw;
}

function clearPendingFile(): void {
  pendingFile.value = null;
  if (uploadRef.value) {
    uploadRef.value.clearFiles();
  }
}

async function submitUpload(): Promise<void> {
  const valid = await new Promise<boolean>((resolve) => {
    if (!uploadFormRef.value) {
      resolve(false);
      return;
    }
    uploadFormRef.value.validate((passed: boolean) => resolve(passed));
  });
  if (!valid) {
    return;
  }
  if (!pendingFile.value) {
    BaseToast.warning('请先选择文件');
    return;
  }
  const formData = new FormData();
  formData.append('file', pendingFile.value);
  formData.append('projectId', String(uploadForm.projectId || ''));
  formData.append('projectCode', uploadForm.projectCode);
  formData.append('projectName', uploadForm.projectName);
  formData.append('valvePoint', uploadForm.valvePoint);
  uploading.value = true;
  try {
    await uploadHistoryImportAttachment(formData);
    BaseToast.success('上传成功');
    uploadDialogVisible.value = false;
    pendingFile.value = null;
    await refreshPageData();
  } finally {
    uploading.value = false;
  }
}

function getCheckedIds(): number[] {
  if (viewMode.value === 'table') {
    return selectedRows.value.map((item: any) => item.id);
  }
  return tableData.value.filter((item: any) => item.checked).map((item: any) => item.id);
}

async function handleBatchDelete(): Promise<void> {
  const ids = getCheckedIds();
  if (!ids.length) {
    return;
  }
  try {
    await openConfirm({
      title: '提示',
      message: '确定删除选中附件吗？',
      type: 'warning',
    });
  } catch {
    return;
  }
  actionLoading.value = true;
  try {
    await batchDeleteHistoryImportAttachments(ids);
    BaseToast.success('删除成功');
    await refreshPageData();
  } finally {
    actionLoading.value = false;
  }
}

async function handleBatchDownload(): Promise<void> {
  const ids = getCheckedIds();
  if (!ids.length) {
    return;
  }
  actionLoading.value = true;
  try {
    const { data } = await batchDownloadHistoryImportAttachments(ids);
    saveAs(data, 'history-import-attachments.zip');
  } catch (err: any) {
    console.error('批量下载失败', err);
    BaseToast.error(err?.message || '批量下载失败，请稍后重试');
  } finally {
    actionLoading.value = false;
  }
}

async function handleDelete(row: TableItem): Promise<void> {
  try {
    await openConfirm({
      title: '提示',
      message: `确定删除附件「${row.fileName}」吗？`,
      type: 'warning',
    });
  } catch {
    return;
  }
  await deleteHistoryImportAttachment(row.id);
  BaseToast.success('删除成功');
  await refreshPageData();
}

function resolvePreviewType(fileName: string): PreviewTypeItem | undefined {
  const ext = String(fileName || '').split('.').pop()!.toLowerCase();
  return PREVIEW_TYPES.find((item: any) => item.ext.includes(ext));
}

async function handlePreview(row: TableItem): Promise<void> {
  const previewType = resolvePreviewType(row.fileName);
  if (!previewType) {
    BaseToast.warning('当前文件类型暂不支持预览');
    return;
  }
  try {
    // 调用预览接口拿文件流，由 FilePreview/jit-viewer 渲染，避免浏览器另存为
    const { data } = await previewHistoryImportAttachment(row.id);
    const blob = new Blob([data], { type: previewType.type });
    previewShow.value = true;
    await nextTick();
    previewRef.value?.setFileToIframe(blob, row.fileName);
  } catch (err: any) {
    console.error('预览附件失败', err);
    BaseToast.error(err?.message || '预览失败，请稍后重试');
  }
}

async function handleDownload(row: TableItem): Promise<void> {
  try {
    const previewType = resolvePreviewType(row.fileName);
    const { data } = await downloadHistoryImportAttachment(row.id);
    const blob = new Blob([data], {
      type: previewType ? previewType.type : 'application/octet-stream',
    });
    saveAs(blob, row.fileName);
  } catch (err: any) {
    console.error('下载附件失败', err);
    BaseToast.error(err?.message || '下载失败，请稍后重试');
  }
}

function handleSelectionChange(selection: TableItem[]): void {
  selectedRows.value = selection;
}

function toggleViewMode(): void {
  viewMode.value = viewMode.value === 'table' ? 'grid' : 'table';
}

// ===== Lifecycle =====
onMounted(() => {
  refreshPageData();
});

void _tableRef.value;
void _resolveProjectIdsByDisplayName;
</script>

<style scoped lang="scss">
.mb-4 {
  margin-bottom: 16px;
}

.main-split {
  display: flex;
  align-items: stretch;
  gap: 16px;
  min-height: 520px;
}

.project-tree-panel {
  width: 280px;
  flex-shrink: 0;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fff;
  padding: 12px;
}

.tree-header {
  margin-bottom: 12px;
}

.tree-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.tree-search {
  margin-bottom: 12px;
}

.project-tree {
  max-height: calc(100vh - 320px);
  overflow: auto;
}

.custom-tree-node {
  display: inline-flex;
  align-items: center;
  max-width: calc(100% - 24px);
  vertical-align: middle;
}

.folder-icon {
  display: inline-block;
  width: 18px;
  height: 14px;
  margin-right: 6px;
  flex-shrink: 0;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  vertical-align: middle;
}

.folder-icon--closed {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23F4B400' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E");
}

.folder-icon--open {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23F4B400' d='M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z'/%3E%3Cpath fill='%23E8A317' d='M3 10h14l2 2h8v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-10z'/%3E%3C/svg%3E");
}

.tree-node-icon {
  flex-shrink: 0;
  margin-right: 6px;
  font-size: 16px;
  color: #f5c542;
}

.tree-node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.project-tree .el-tree-node__content) {
  height: 30px;
}

:deep(.project-tree .el-tree-node.is-current > .el-tree-node__content) {
  background-color: #ecf5ff;
}

.file-list-panel {
  flex: 1;
  min-width: 0;
}

.current-path {
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;

  span {
    color: #303133;
    font-weight: 500;
  }
}

.current-count {
  margin-left: 4px;
  color: #909399;
  font-weight: normal;
}

.toolbar-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.view-toggle-btn {
  margin-left: auto;
}

.table-wrapper {
  min-height: 300px;
}

.pending-file {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.grid-view {
  .grid-container {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }

  .grid-item {
    position: relative;
    border: 1px solid #e4e7ed;
    border-radius: 4px;

    &:hover {
      box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    }

    .grid-item-content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-height: 180px;
    }

    .checkbox-wrapper {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 10;
    }

    .file-icon {
      font-size: 48px;
      color: #409eff;
      margin: 32px 0 16px;
    }

    .file-info {
      width: 100%;
      padding: 0 10px 12px;

      .file-name {
        font-weight: 500;
        min-height: 40px;
      }

      .file-project {
        font-size: 12px;
        color: #606266;
        margin-bottom: 4px;
      }

      .file-type,
      .file-time {
        font-size: 12px;
        color: #909399;
      }
    }

    .hover-actions {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.92);
    }

    &:hover .hover-actions {
      display: flex;
    }
  }
}
</style>
