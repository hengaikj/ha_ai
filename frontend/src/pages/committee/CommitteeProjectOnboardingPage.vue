<script setup lang="ts">
import { Back, WarningFilled } from "@element-plus/icons-vue";
import type { FormInstance, FormRules, UploadFile } from "element-plus";
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  committeeRequestId,
  fetchCommitteeProject,
  fetchCommitteeProjectCandidates,
  fetchCommitteeProjectCompanyOptions,
  fetchCommitteeProjectVehicleInvestment,
  initializeCommitteeProject,
  updateCommitteeProjectProfile,
  uploadCommitteeAttachment,
} from "@/api/committee";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { BaseToast } from "@/components/base/BaseToast";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  CommitteeProjectCandidate,
  CommitteeProjectInitPayload,
} from "@/types/committee";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params.projectId ?? ""));
const isEditMode = computed(() => Boolean(projectId.value));
const pageTitle = computed(() => (isEditMode.value ? "编辑项目" : "关联项目"));
const candidateCompany = ref("");
const selectedProjectId = ref("");
const selected = ref<CommitteeProjectCandidate>();
const projectOptions = ref<CommitteeProjectCandidate[]>([]);
const companyOptions = ref<string[]>([]);
const loading = ref(false);
const loadingProjects = ref(false);
const spectrumPreviewUrl = ref("");
const spectrumFileName = ref("");
const pendingSpectrumFile = ref<File>();
const spectrumEmptyText = computed(() =>
  selected.value ? "暂无品牌型谱信息" : "选择项目后自动带出",
);
const saving = ref(false);
const formRef = ref<FormInstance>();
const PROJECT_TYPE_DICT = "committee_project_type";
const projectTypeOptions = ref<Array<{ label: string; value: string }>>([]);

const initRequestId = ref(committeeRequestId());
let projectSearchRequestId = 0;
let projectSelectionRequestId = 0;

interface CommitteeProjectForm {
  owningCompany: string;
  projectName: string;
  brand: string;
  projectCategory: string;
  projectType: string;
  productionBase: string;
  totalInvestment?: number | string;
  vehicleModelInvestment?: number | string;
  executionRate?: number | string;
  projectBackground: string;
  brandPatternFileName: string;
  brandPatternFileUrl: string;
  brandPatternAttachmentId: string;
}

const form = reactive<CommitteeProjectForm>({
  owningCompany: "",
  projectName: "",
  brand: "",
  projectCategory: "",
  projectType: "",
  productionBase: "",
  totalInvestment: undefined as number | string | undefined,
  vehicleModelInvestment: undefined as number | string | undefined,
  executionRate: undefined as number | string | undefined,
  projectBackground: "",
  brandPatternFileName: "",
  brandPatternFileUrl: "",
  brandPatternAttachmentId: "",
});
const formRules: FormRules<CommitteeProjectForm> = {
  totalInvestment: [
    { required: true, message: "请输入项目总投资", trigger: "change" },
    {
      type: "number",
      transform: (value) => Number(value),
      min: 0,
      message: "项目总投资不能小于 0",
      trigger: "change",
    },
  ],
  vehicleModelInvestment: [
    {
      type: "number",
      transform: (value) => Number(value),
      min: 0,
      message: "车型投资不能小于 0",
      trigger: "change",
    },
  ],
  executionRate: [
    { required: true, message: "请输入预算执行率", trigger: "change" },
    {
      type: "number",
      transform: (value) => Number(value),
      min: 0,
      max: 100,
      message: "预算执行率必须在 0 到 100 之间",
      trigger: "change",
    },
  ],
};

const brandPatternPreviewUrl = computed(() =>
  resolveSpectrumUrl(form.brandPatternFileUrl),
);
const spectrumDisplayUrl = computed(() =>
  isEditMode.value ? brandPatternPreviewUrl.value : spectrumPreviewUrl.value,
);
const spectrumDisplayEmptyText = computed(() =>
  isEditMode.value
    ? "暂无品牌型谱信息"
    : selected.value
      ? "暂无品牌型谱信息"
      : "选择项目后自动带出",
);

function mergeCompanyOptions(records: CommitteeProjectCandidate[]) {
  const companies = new Set(companyOptions.value);
  records.forEach((item) => {
    const company = String(item.company ?? "").trim();
    if (company) companies.add(company);
  });
  companyOptions.value = Array.from(companies);
}

async function loadProjectOptions(keyword = "") {
  const company = candidateCompany.value.trim();
  if (!company) {
    projectOptions.value = [];
    return;
  }
  const requestId = ++projectSearchRequestId;
  loadingProjects.value = true;
  try {
    const records = await fetchCommitteeProjectCandidates({
      company,
      keyword: keyword.trim() || undefined,
      limit: 50,
    });
    if (requestId !== projectSearchRequestId) return;
    mergeCompanyOptions(records);
    const current = selected.value;
    projectOptions.value =
      current && !records.some((item) => item.projectId === current.projectId)
        ? [current, ...records]
        : records;
  } finally {
    if (requestId === projectSearchRequestId) {
      loadingProjects.value = false;
    }
  }
}

async function searchProjects(keyword: string) {
  await loadProjectOptions(keyword).catch(() => undefined);
}

async function loadCompanyOptions() {
  const companies = await fetchCommitteeProjectCompanyOptions();
  companyOptions.value = Array.from(
    new Set(
      companies
        .map((company) => company.trim())
        .filter((company) => company.length > 0),
    ),
  );
  if (selected.value) mergeCompanyOptions([selected.value]);
}

function handleProjectSelectVisible(visible: boolean) {
  if (
    visible &&
    candidateCompany.value.trim() &&
    !loadingProjects.value &&
    projectOptions.value.length === 0
  ) {
    void loadProjectOptions().catch(() => undefined);
  }
}

function clearSpectrumPreview() {
  if (spectrumPreviewUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(spectrumPreviewUrl.value);
  }
  spectrumPreviewUrl.value = "";
  spectrumFileName.value = "";
  pendingSpectrumFile.value = undefined;
}

function clearProjectDetails() {
  form.totalInvestment = undefined;
  form.vehicleModelInvestment = undefined;
  form.executionRate = undefined;
  form.projectBackground = "";
  form.brandPatternFileName = "";
  form.brandPatternFileUrl = "";
  form.brandPatternAttachmentId = "";
  clearSpectrumPreview();
}

function resolveSpectrumUrl(value?: string | null) {
  const path = value?.trim();
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  if (path.startsWith("/api/") || path === "/api") return path;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

function formatFactory(
  factoryName?: string | null,
  factoryCode?: string | null,
  legacyFactory?: string | null,
) {
  const name = factoryName?.trim();
  const code = factoryCode?.trim();
  if (name && code) return `${name} / ${code}`;
  return name || code || legacyFactory?.trim() || "";
}

function clearSelectedProject() {
  projectSelectionRequestId += 1;
  selectedProjectId.value = "";
  selected.value = undefined;
  form.owningCompany = "";
  form.projectName = "";
  form.brand = "";
  form.projectCategory = "";
  form.projectType = "";
  form.productionBase = "";
  clearProjectDetails();
}

async function selectProjectById(projectId: string | number | undefined) {
  selectedProjectId.value = projectId ? String(projectId) : "";
  if (!projectId) {
    clearSelectedProject();
    return;
  }
  const project = projectOptions.value.find(
    (item) => String(item.projectId) === String(projectId),
  );
  if (project) await selectProject(project);
}

async function selectProject(row: CommitteeProjectCandidate) {
  const requestId = ++projectSelectionRequestId;
  if (selected.value?.projectId !== row.projectId) {
    clearProjectDetails();
  }
  selectedProjectId.value = String(row.projectId);
  selected.value = row;
  const company = String(row.company ?? "").trim();
  if (company && !companyOptions.value.includes(company)) {
    companyOptions.value.push(company);
  }
  form.owningCompany = company;
  form.projectName = row.projectName;
  form.brand = String(row.brandName ?? "");
  form.projectCategory = String(row.projectCategory ?? "");
  form.projectType = "";
  form.productionBase = formatFactory(
    row.factoryName,
    row.factoryCode,
    row.factory,
  );
  spectrumPreviewUrl.value = resolveSpectrumUrl(row.brandPatternFileUrl);
  spectrumFileName.value = row.brandPatternFileName ?? "";
  const investment = await fetchCommitteeProjectVehicleInvestment(
    String(row.projectId),
  );
  if (
    requestId !== projectSelectionRequestId ||
    String(selected.value?.projectId ?? "") !== String(row.projectId)
  ) {
    return;
  }
  form.vehicleModelInvestment =
    investment?.amount == null ? 0 : Number(investment.amount);
}

function handleCompanyChange() {
  projectSearchRequestId += 1;
  loadingProjects.value = false;
  clearSelectedProject();
  projectOptions.value = [];
  formRef.value?.clearValidate?.();
  if (candidateCompany.value.trim()) {
    void loadProjectOptions().catch(() => undefined);
  }
}

function handleDecimalInput(
  field: "totalInvestment" | "vehicleModelInvestment" | "executionRate",
  value: string | number,
) {
  const sanitized = String(value)
    .replace(/[^\d.]/g, "")
    .replace(/^\./, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/^(\d+\.\d{0,2}).*$/, "$1");
  form[field] = sanitized === "" ? undefined : sanitized;
}

function buildInitPayload(): CommitteeProjectInitPayload {
  const totalInvestment = form.totalInvestment;
  const vehicleModelInvestment = form.vehicleModelInvestment;
  const executionRate = form.executionRate;
  if (
    totalInvestment === undefined ||
    vehicleModelInvestment === undefined ||
    executionRate === undefined
  ) {
    throw new Error("项目初始化表单校验状态异常");
  }
  return {
    totalInvestment: Number(totalInvestment),
    vehicleModelInvestment: Number(vehicleModelInvestment),
    executionRate: Number(executionRate),
    projectBackground: form.projectBackground.trim() || undefined,
    projectType: form.projectType.trim() || undefined,
  };
}

function handleSpectrumFileChange(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) return;
  clearSpectrumPreview();
  pendingSpectrumFile.value = file;
  spectrumFileName.value = file.name;
  spectrumPreviewUrl.value = URL.createObjectURL(file);
}

function buildUpdatePayload() {
  const totalInvestment = form.totalInvestment;
  const vehicleModelInvestment = form.vehicleModelInvestment;
  const executionRate = form.executionRate;
  if (
    totalInvestment === undefined ||
    vehicleModelInvestment === undefined ||
    executionRate === undefined
  ) {
    throw new Error("项目画像表单校验状态异常");
  }
  return {
    totalInvestment,
    vehicleModelInvestment,
    executionRate,
    projectBackground: form.projectBackground.trim() || undefined,
    projectType: form.projectType.trim() || undefined,
  };
}

async function loadEditProject() {
  loading.value = true;
  try {
    const detail = await fetchCommitteeProject(projectId.value);
    const project = detail.project;
    Object.assign(form, {
      owningCompany: project.owningCompany ?? "",
      projectName: project.projectName,
      brand: project.brandName ?? "",
      projectCategory: project.projectCategory ?? "",
      projectType: project.projectType ?? "",
      productionBase: formatFactory(
        project.factoryName,
        project.factoryCode,
        project.productionBase,
      ),
      totalInvestment: project.totalInvestment ?? undefined,
      vehicleModelInvestment: project.vehicleModelInvestment ?? undefined,
      executionRate: project.executionRate ?? undefined,
      projectBackground: project.projectBackground ?? "",
      brandPatternAttachmentId:
        project.brandPatternAttachmentId === undefined ||
        project.brandPatternAttachmentId === null
          ? ""
          : String(project.brandPatternAttachmentId),
      brandPatternFileName: project.brandPatternFileName ?? "",
      brandPatternFileUrl: project.brandPatternFileUrl ?? "",
    });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (saving.value) return;
  if (
    form.totalInvestment === undefined ||
    form.vehicleModelInvestment === undefined ||
    form.executionRate === undefined
  ) {
    BaseToast.warning("请完整填写项目总投资、车型投资和预算执行率");
    return;
  }
  saving.value = true;
  try {
    await updateCommitteeProjectProfile(projectId.value, buildUpdatePayload());
    BaseToast.success("项目资料已更新");
    await router.replace(`/committee/projects/${projectId.value}`);
  } finally {
    saving.value = false;
  }
}

async function submit() {
  if (isEditMode.value) {
    await save();
    return;
  }
  if (saving.value) return;
  saving.value = true;
  try {
    if (!selected.value) {
      BaseToast.warning("请先选择已有项目");
      return;
    }
    if (!(await formRef.value?.validate().catch(() => false))) return;
    const projectId = String(selected.value.projectId);
    await initializeCommitteeProject(
      projectId,
      buildInitPayload(),
      initRequestId.value,
    );
    let spectrumUploadFailed = false;
    if (pendingSpectrumFile.value) {
      try {
        await uploadCommitteeAttachment(
          "PROJECT_SPECTRUM",
          projectId,
          pendingSpectrumFile.value,
        );
      } catch {
        spectrumUploadFailed = true;
        BaseToast.warning("项目已创建，型谱图片上传失败，可在详情页重新上传");
      }
    }
    if (!spectrumUploadFailed) BaseToast.success("项目已创建");
    await router.replace(`/committee/projects/${projectId}`);
  } finally {
    saving.value = false;
  }
}

async function loadProjectTypeOptions() {
  try {
    const items = await fetchPlatformDictItems(PROJECT_TYPE_DICT);
    projectTypeOptions.value = items.map((item) => ({
      label: item.label || item.dictItemLabel,
      value: item.value || item.dictItemCode,
    }));
  } catch {
    projectTypeOptions.value = [];
  }
}

onMounted(() => {
  void loadProjectTypeOptions();
  if (isEditMode.value) {
    void loadEditProject();
  } else {
    void loadCompanyOptions().catch(() => undefined);
  }
});
onBeforeUnmount(clearSpectrumPreview);
defineExpose({
  isEditMode,
  candidateCompany,
  selectedProjectId,
  form,
  searchProjects,
  selectProject,
  selectProjectById,
  handleCompanyChange,
  handleSpectrumFileChange,
  spectrumPreviewUrl,
  save,
  submit,
});
</script>

<template>
  <PageContainer
    class="bq-management-page committee-project-create"
    :class="{ 'committee-project-edit': isEditMode }"
    :title="pageTitle"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="
          router.replace(
            String(
              route.query.returnPath ||
                route.meta.breadcrumbParentPath ||
                route.meta.activeMenu ||
                (isEditMode
                  ? `/committee/projects/${projectId}`
                  : '/committee/projects'),
            ),
          )
        "
      >
        返回
      </PermissionButton>
      <PermissionButton
        type="primary"
        :disabled="!isEditMode && !selected"
        :loading="saving"
        @click="submit"
      >
        保存
      </PermissionButton>
    </template>

    <el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="formRules"
      label-position="top"
      class="create-form"
    >
      <section class="create-section">
        <BaseSectionTitle title="项目基础信息" heading-tag="h2" />
        <div class="form-grid">
          <el-form-item v-if="!isEditMode" label="所属公司筛选" required>
            <el-select
              v-model="candidateCompany"
              clearable
              filterable
              placeholder="请选择所属公司"
              @change="handleCompanyChange"
              @clear="handleCompanyChange"
            >
              <el-option
                v-for="company in companyOptions"
                :key="company"
                :label="company"
                :value="company"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!isEditMode" label="项目代号" required>
            <el-select
              v-model="selectedProjectId"
              data-testid="committee-project-select"
              clearable
              filterable
              remote
              reserve-keyword
              :remote-method="searchProjects"
              :loading="loadingProjects"
              :disabled="!candidateCompany.trim()"
              :placeholder="
                candidateCompany.trim()
                  ? '输入项目代号搜索并选择'
                  : '请先选择所属公司'
              "
              :no-data-text="
                candidateCompany.trim() ? '暂无匹配项目' : '请先选择所属公司'
              "
              @change="selectProjectById"
              @visible-change="handleProjectSelectVisible"
            >
              <el-option
                v-for="project in projectOptions"
                :key="project.projectId"
                :label="
                  project.wbsNumber
                    ? `${project.projectName}`
                    : project.projectName
                "
                :value="String(project.projectId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-else label="项目代号">
            <el-input v-model="form.projectName" disabled />
          </el-form-item>
          <el-form-item label="所属公司">
            <el-input
              v-model="form.owningCompany"
              data-testid="committee-project-company"
              disabled
              placeholder="选择项目后自动带出"
            />
          </el-form-item>
          <el-form-item label="品牌">
            <el-input
              v-model="form.brand"
              data-testid="committee-project-brand"
              disabled
              placeholder="选择项目后自动带出"
            />
          </el-form-item>
          <el-form-item label="项目分类">
            <el-input
              v-model="form.projectCategory"
              data-testid="committee-project-category"
              disabled
              placeholder="选择项目后自动带出"
            />
          </el-form-item>
          <el-form-item label="项目类型">
            <el-select
              v-model="form.projectType"
              data-testid="committee-project-type"
              clearable
              filterable
              placeholder="请选择项目类型"
            >
              <el-option
                v-for="item in projectTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="工厂名称">
            <el-input
              v-model="form.productionBase"
              data-testid="committee-project-production-base"
              disabled
              placeholder="选择项目后自动带出"
            />
          </el-form-item>
          <el-form-item label="项目总投资（元）" prop="totalInvestment">
            <el-input
              :key="selectedProjectId || 'unselected'"
              v-model="form.totalInvestment"
              inputmode="decimal"
              placeholder="请输入项目总投资"
              @input="handleDecimalInput('totalInvestment', $event)"
            />
          </el-form-item>
          <!-- 后面根据接口带出-->
          <el-form-item prop="vehicleModelInvestment">
            <template #label>
              <span class="form-label-with-tip">
                <span>车型投资（元）</span>
                <el-tooltip
                  content="数据源自预算板块立项/过阀评审-预算总金额数据"
                  placement="top"
                >
                  <el-icon
                    class="form-label-with-tip__icon"
                    aria-label="车型投资数据来源说明"
                    data-testid="committee-project-vehicle-investment-tip"
                    tabindex="0"
                  >
                    <WarningFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input
              :key="selectedProjectId || 'unselected'"
              v-model="form.vehicleModelInvestment"
              data-testid="committee-project-vehicle-model-investment"
              inputmode="decimal"
              disabled
              placeholder="选择项目后自动带出"
              @input="handleDecimalInput('vehicleModelInvestment', $event)"
            />
          </el-form-item>
          <el-form-item label="预算执行率(%)" prop="executionRate">
            <el-input
              :key="selectedProjectId || 'unselected'"
              v-model="form.executionRate"
              inputmode="decimal"
              placeholder="请输入预算执行率"
              @input="handleDecimalInput('executionRate', $event)"
            />
          </el-form-item>
        </div>
        <el-form-item label="项目背景">
          <el-input
            v-model="form.projectBackground"
            data-testid="committee-project-background"
            :disabled="!isEditMode && !selected"
            type="textarea"
            :rows="5"
            maxlength="2000"
            show-word-limit
            placeholder="请输入项目背景与目标描述"
          />
        </el-form-item>
      </section>

      <section v-if="!isEditMode" class="create-section">
        <BaseSectionTitle title="型谱信息" heading-tag="h2" />
        <!--        <el-form-item label="型谱图片上传">-->
        <!--          <div-->
        <!--            class="spectrum-field"-->
        <!--            :class="{ 'is-disabled': !selected }"-->
        <!--            :aria-disabled="!selected"-->
        <!--          >-->
        <!--            <div class="spectrum-upload-row">-->
        <!--              <el-upload-->
        <!--                :auto-upload="false"-->
        <!--                :show-file-list="false"-->
        <!--                accept="image/png,image/jpeg"-->
        <!--                :disabled="!selected"-->
        <!--                :on-change="handleSpectrumFileChange"-->
        <!--              >-->
        <!--                <PermissionButton :disabled="!selected">选择图片</PermissionButton>-->
        <!--              </el-upload>-->
        <!--              <span v-if="spectrumFileName" class="spectrum-file-name">-->
        <!--                {{ spectrumFileName }}-->
        <!--              </span>-->
        <!--            </div>-->
        <div v-if="spectrumPreviewUrl" class="spectrum-preview">
          <el-image
            class="spectrum-preview__image"
            :src="spectrumPreviewUrl"
            fit="contain"
            alt="型谱图片预览"
            data-testid="committee-project-spectrum-preview-image"
          />
        </div>
        <div v-else class="spectrum-empty" aria-disabled="true">
          {{ spectrumEmptyText }}
        </div>
        <!--            <p class="spectrum-description">-->
        <!--              支持 JPG / PNG 图片附件，保存后可在项目详情页查看。-->
        <!--            </p>-->
        <!--          </div>-->
        <!--        </el-form-item>-->
      </section>

      <section v-if="isEditMode" class="create-section">
        <BaseSectionTitle title="型谱信息" heading-tag="h2" />
        <div v-if="spectrumDisplayUrl" class="spectrum-preview">
          <el-image
            class="spectrum-preview__image"
            :src="spectrumDisplayUrl"
            fit="contain"
            alt="型谱图片预览"
            data-testid="committee-project-spectrum-preview-image"
          />
        </div>
        <div v-else class="spectrum-empty" aria-disabled="true">
          {{ spectrumDisplayEmptyText }}
        </div>
      </section>
    </el-form>
  </PageContainer>
</template>

<style scoped>
.create-section {
  display: grid;
  gap: 16px;
  padding: 18px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-card);
}

.create-form {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
}

.create-form :deep(.el-form-item) {
  display: block;
  margin-bottom: 0;
}

.create-form :deep(.el-form-item__label) {
  justify-content: flex-start;
  width: auto !important;
  height: auto;
  margin-bottom: 6px;
  padding-right: 0;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
}

.create-form :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.form-label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.form-label-with-tip__icon {
  color: var(--bq-color-icon-muted);
  font-size: 15px;
  cursor: help;
}

.form-label-with-tip__icon:hover,
.form-label-with-tip__icon:focus-visible {
  color: var(--bq-color-primary);
}

.create-form :deep(.el-input),
.create-form :deep(.el-select),
.create-form :deep(.el-input-number),
.create-form :deep(.el-date-editor) {
  width: 100%;
}

.spectrum-field {
  display: grid;
  gap: 0;
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.spectrum-field.is-disabled {
  background: var(--el-disabled-bg-color, var(--bq-color-bg-muted));
  border-color: var(--el-disabled-border-color, var(--bq-color-border-subtle));
  color: var(--el-disabled-text-color, var(--bq-color-text-muted));
}

.spectrum-preview {
  display: grid;
  width: 100%;
}

.spectrum-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spectrum-file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spectrum-description {
  margin: 0;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-compact);
}

.spectrum-preview__image {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
}

.spectrum-empty {
  min-height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border: 1px solid
    var(--el-disabled-border-color, var(--bq-color-border-subtle));
  border-radius: var(--bq-radius-control);
  color: var(--el-disabled-text-color, var(--bq-color-text-muted));
  background: var(--el-disabled-bg-color, var(--bq-color-bg-soft));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
  text-align: center;
  cursor: not-allowed;
  user-select: none;
}

@media (max-width: 960px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .create-form :deep(.el-form-item) {
    display: block;
  }

  .create-form :deep(.el-form-item__label) {
    white-space: normal;
  }

  .create-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .spectrum-preview {
    padding-left: 0;
  }
}
</style>
