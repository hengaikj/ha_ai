<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import type { UploadFile, UploadRawFile, UploadUserFile } from "element-plus";
import {
  createCommitteeReplyMessage,
  createCommitteeReplyTopic,
  downloadCommitteeAttachment,
  fetchCommitteeAttachments,
  fetchCommitteeReplyMessages,
  fetchCommitteeReplyTopics,
  uploadCommitteeAttachment,
} from "@/api/committee";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  CommitteeAttachment,
  CommitteeReplyMessage,
  CommitteeReplyTopic,
} from "@/types/committee";
import CommitteeAttachmentList from "./CommitteeAttachmentList.vue";
import CommitteeDate from "./CommitteeDate.vue";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import { isSupportedCommitteeAttachment } from "../committee-attachment-utils";

const replyTopicAttachmentBizCode = "REPLY_TOPIC";
const replyMessageAttachmentBizCode = "REPLY_MESSAGE";
const attachmentAccept = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.pptx";

const props = withDefaults(
  defineProps<{
    recordId?: string;
    editable?: boolean;
  }>(),
  {
    editable: true,
  },
);

const loading = ref(false);
const topics = ref<CommitteeReplyTopic[]>([]);
const messages = ref<CommitteeReplyMessage[]>([]);
const activeTopicAttachments = ref<CommitteeAttachment[]>([]);
const messageAttachments = ref<Record<string, CommitteeAttachment[]>>({});
const activeTopic = ref<CommitteeReplyTopic>();
const topicForm = reactive({ title: "", content: "" });
const topicFiles = ref<UploadUserFile[]>([]);
const replyContent = ref("");
const replyFiles = ref<UploadUserFile[]>([]);
const composerVisible = ref(false);
const detailVisible = ref(false);
const replyComposerVisible = ref(false);
const submittingTopic = ref(false);
const submittingReply = ref(false);
const previewVisible = ref(false);
const previewFile = ref<Blob | null>(null);
const previewTitle = ref("");

const pendingTopicAttachments = computed<CommitteeAttachment[]>(() =>
  topicFiles.value.map((file) => ({
    id: String(file.uid ?? file.name ?? ""),
    bizCode: "",
    bizId: "",
    fileName: file.name || file.raw?.name || "附件",
    fileSize: file.size || file.raw?.size || 0,
    fileType: file.raw?.type || "application/octet-stream",
  })),
);

const pendingReplyAttachments = computed<CommitteeAttachment[]>(() =>
  replyFiles.value.map((file) => ({
    id: String(file.uid ?? file.name ?? ""),
    bizCode: "",
    bizId: "",
    fileName: file.name || file.raw?.name || "附件",
    fileSize: file.size || file.raw?.size || 0,
    fileType: file.raw?.type || "application/octet-stream",
  })),
);

function handleTopicFileChange(
  file: UploadFile,
  fileList: UploadUserFile[],
) {
  if (file.raw && !isSupportedCommitteeAttachment(file.raw)) {
    topicFiles.value = fileList.filter((item) => item.uid !== file.uid);
    BaseToast.error("不支持该附件格式，仅支持 PPTX，不支持 PPT");
    return;
  }
  topicFiles.value = fileList;
}

function handleReplyFileChange(
  file: UploadFile,
  fileList: UploadUserFile[],
) {
  if (file.raw && !isSupportedCommitteeAttachment(file.raw)) {
    replyFiles.value = fileList.filter((item) => item.uid !== file.uid);
    BaseToast.error("不支持该附件格式，仅支持 PPTX，不支持 PPT");
    return;
  }
  replyFiles.value = fileList;
}

function removePendingFile(
  file: CommitteeAttachment,
  target: "topic" | "reply",
) {
  const files = target === "topic" ? topicFiles : replyFiles;
  files.value = files.value.filter(
    (item) => String(item.uid) !== String(file.id),
  );
}

const sortedTopics = computed(() =>
  [...topics.value].sort((a, b) =>
    String(b.lastReplyTime ?? "").localeCompare(String(a.lastReplyTime ?? "")),
  ),
);

const totalReplyCount = computed(() =>
  topics.value.reduce(
    (total, topic) => total + Number(topic.replyCount ?? 0),
    0,
  ),
);

const latestReplyTime = computed(
  () =>
    sortedTopics.value[0]?.lastReplyTime || messages.value.at(-1)?.replyTime,
);

async function load(preferredTopicId?: string) {
  topics.value = [];
  if (!props.recordId) return;
  loading.value = true;
  try {
    topics.value = await fetchCommitteeReplyTopics(props.recordId);
    if (preferredTopicId) {
      const nextTopic = topics.value.find(
        (topic) => topic.id === preferredTopicId,
      );
      if (nextTopic) {
        activeTopic.value = nextTopic;
      }
    }
  } finally {
    loading.value = false;
  }
}

async function openTopic(row: CommitteeReplyTopic) {
  activeTopic.value = row;
  detailVisible.value = true;
  replyComposerVisible.value = false;
  replyContent.value = "";
  replyFiles.value = [];
  activeTopicAttachments.value = [];
  messageAttachments.value = {};
  const [nextMessages] = await Promise.all([
    fetchCommitteeReplyMessages(row.id),
    loadTopicAttachments(row),
  ]);
  messages.value = nextMessages;
  await loadMessageAttachments(nextMessages);
}

async function loadTopicAttachments(row: CommitteeReplyTopic) {
  const embeddedAttachments = (
    row as CommitteeReplyTopic & { attachments?: CommitteeAttachment[] }
  ).attachments;
  if (Array.isArray(embeddedAttachments)) {
    activeTopicAttachments.value = embeddedAttachments;
    return;
  }
  try {
    activeTopicAttachments.value = await fetchCommitteeAttachments(
      replyTopicAttachmentBizCode,
      row.id,
    );
  } catch {
    activeTopicAttachments.value = [];
  }
}

async function loadMessageAttachments(rows: CommitteeReplyMessage[]) {
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const embeddedAttachments = (
        row as unknown as {
          attachments?: CommitteeAttachment[];
        }
      ).attachments;
      if (Array.isArray(embeddedAttachments)) {
        return [row.id, embeddedAttachments] as const;
      }
      const files = await fetchCommitteeAttachments(
        replyMessageAttachmentBizCode,
        row.id,
      );
      return [row.id, files] as const;
    }),
  );
  messageAttachments.value = Object.fromEntries(
    results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value),
  );
}

async function addTopic() {
  if (!props.recordId || !topicForm.title.trim()) return;
  submittingTopic.value = true;
  try {
    const row = await createCommitteeReplyTopic(
      props.recordId,
      topicForm.title.trim(),
      topicForm.content.trim(),
    );
    const files = topicFiles.value
      .map((file) => file.raw)
      .filter((file): file is UploadRawFile => Boolean(file));
    let uploadFailed = false;
    for (const file of files) {
      try {
        await uploadCommitteeAttachment(
          replyTopicAttachmentBizCode,
          row.id,
          file,
        );
      } catch {
        uploadFailed = true;
      }
    }
    topicForm.title = "";
    topicForm.content = "";
    topicFiles.value = [];
    composerVisible.value = false;
    BaseToast.success(
      uploadFailed ? "协同主题已发起，部分附件上传失败" : "协同主题已发起",
    );
    await load(row.id);
    await openTopic(row);
  } finally {
    submittingTopic.value = false;
  }
}

async function addReply() {
  const topic = activeTopic.value;
  if (!topic || !replyContent.value.trim()) return;
  submittingReply.value = true;
  try {
    const row = await createCommitteeReplyMessage(
      topic.id,
      replyContent.value.trim(),
    );
    const files = replyFiles.value
      .map((file) => file.raw)
      .filter((file): file is UploadRawFile => Boolean(file));
    let uploadFailed = false;
    for (const file of files) {
      try {
        await uploadCommitteeAttachment(
          replyMessageAttachmentBizCode,
          row.id,
          file,
        );
      } catch {
        uploadFailed = true;
      }
    }
    replyContent.value = "";
    replyFiles.value = [];
    replyComposerVisible.value = false;
    BaseToast.success(
      uploadFailed ? "回复已提交，部分附件上传失败" : "回复已提交",
    );
    await load(topic.id);
    await openTopic(topic);
  } finally {
    submittingReply.value = false;
  }
}

function cancelReply() {
  replyContent.value = "";
  replyFiles.value = [];
  replyComposerVisible.value = false;
}

function topicTime(row: CommitteeReplyTopic) {
  const source = row as unknown as Record<string, unknown>;
  const value =
    source.createTime ??
    source.createdTime ??
    source.startTime ??
    source.starterTime ??
    row.lastReplyTime;
  return value as string | number | Date | undefined;
}

function cancelComposer() {
  topicForm.title = "";
  topicForm.content = "";
  topicFiles.value = [];
  composerVisible.value = false;
}

async function previewAttachment(row: CommitteeAttachment) {
  previewFile.value = null;
  previewTitle.value = row.fileName;
  previewVisible.value = true;
  try {
    if (row.fileUrl) {
      const response = await globalThis.fetch(row.fileUrl);
      if (!response.ok) throw new Error("附件下载失败");
      previewFile.value = await response.blob();
      return;
    }
    const response = await downloadCommitteeAttachment(row.id);
    previewFile.value = response.data;
  } catch {
    previewVisible.value = false;
    BaseToast.error("附件预览失败");
  }
}

async function downloadAttachment(row: CommitteeAttachment) {
  try {
    const blob = row.fileUrl
      ? await fetchAttachmentBlob(row.fileUrl)
      : (await downloadCommitteeAttachment(row.id)).data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = row.fileName || "附件";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    BaseToast.error("附件下载失败");
  }
}

async function fetchAttachmentBlob(fileUrl: string) {
  const response = await globalThis.fetch(fileUrl);
  if (!response.ok) throw new Error("附件下载失败");
  return response.blob();
}

onMounted(load);
watch(() => props.recordId, load);
</script>

<template>
  <section v-loading="loading" class="collaboration bq-detail-panel">
    <BaseSectionTitle
      class="collaboration__header"
      title="项目组协同回复"
      heading-tag="h2"
    >
      <template #title-extra>
        <div class="collaboration__metrics">
          <span class="collaboration__metric">
            <span class="collaboration__metric-label">协同记录</span>
            <span class="committee-text-strong"
              >{{ topics.length }} 个主题 / {{ totalReplyCount }} 条回复</span
            >
          </span>
          <span class="collaboration__metric">
            <span class="collaboration__metric-label">最近回复</span>
            <span class="committee-text-strong">
              <CommitteeDate :value="latestReplyTime" with-seconds />
            </span>
          </span>
        </div>
      </template>
      <template #actions>
        <PermissionButton
          permission="committee:project:collaboration-topic-edit"
          v-if="recordId && editable"
          type="primary"
          :icon="Plus"
          @click="composerVisible = true"
        >
          发起主题
        </PermissionButton>
      </template>
    </BaseSectionTitle>

    <el-empty v-if="!recordId" description="正式提交后可发起项目组协同回复" />

    <template v-else>
      <section v-if="composerVisible" class="collaboration__composer">
        <el-input
          v-model="topicForm.title"
          placeholder="填写回复主题"
          clearable
        />
        <el-input
          v-model="topicForm.content"
          type="textarea"
          :rows="3"
          resize="none"
          placeholder="填写主题说明"
        />
        <div class="collaboration__upload-row">
          <PermissionGuard p>
            <el-upload
              v-model:file-list="topicFiles"
              :auto-upload="false"
              :show-file-list="false"
              :accept="attachmentAccept"
              :limit="5"
              @change="handleTopicFileChange"
            >
              <PermissionButton> 上传附件 </PermissionButton>
              <template #tip>
                <span class="collaboration__upload-tip">
                  支持 PDF、Office 文档和图片，最多 5 个。
                </span>
              </template>
            </el-upload>
            <CommitteeAttachmentList
              v-if="pendingTopicAttachments.length"
              :files="pendingTopicAttachments"
              editable
              :show-download="false"
              :previewable="false"
              @delete="removePendingFile($event, 'topic')"
            />
          </PermissionGuard>
        </div>
        <div class="collaboration__actions">
          <PermissionButton :disabled="submittingTopic" @click="cancelComposer">
            取消
          </PermissionButton>
          <PermissionButton
            type="primary"
            permission="committee:project:collaboration-topic-edit"
            :disabled="!topicForm.title.trim()"
            :loading="submittingTopic"
            @click="addTopic"
          >
            提交主题
          </PermissionButton>
        </div>
      </section>

      <el-table
        :data="sortedTopics"
        border
        empty-text="当前暂无协同主题"
        class="collaboration__table"
        :table-layout="'fixed'"
      >
        <el-table-column label="主题" min-width="240">
          <template #default="{ row }">
            <span class="committee-text-strong collaboration__topic-title">
              {{ row.topicTitle }}
            </span>
            <div class="collaboration__topic-time">
              发起时间：<CommitteeDate :value="topicTime(row)" with-seconds />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="发起人" width="110">
          <template #default="{ row }">
            {{ row.starterName || "--" }}
          </template>
        </el-table-column>
        <el-table-column label="最近回复" width="140">
          <template #default="{ row }">
            <CommitteeDate :value="row.lastReplyTime" with-seconds />
          </template>
        </el-table-column>
        <el-table-column label="主题内容" min-width="300">
          <template #default="{ row }">
            <span class="collaboration__topic-content">
              {{ row.topicContent || "--" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="回复数" width="70" align="center">
          <template #default="{ row }">
            {{ row.replyCount ?? 0 }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton link @click="openTopic(row)">
              查看
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>

      <BaseDrawer
        v-model="detailVisible"
        :title="activeTopic?.topicTitle || '协同回复详情'"
        size="46%"
        :show-footer="false"
      >
        <div v-if="activeTopic" class="collaboration__detail">
          <section class="collaboration__drawer-section">
            <BaseSectionTitle
              title="主题信息"
              size="small"
              heading-tag="h3"
            />
            <el-descriptions :column="2" border>
              <el-descriptions-item label="发起人">
                {{ activeTopic.starterName || "--" }}
              </el-descriptions-item>
              <el-descriptions-item label="发起时间">
                <CommitteeDate :value="topicTime(activeTopic)" with-seconds />
              </el-descriptions-item>
              <el-descriptions-item label="最近回复">
                <CommitteeDate :value="activeTopic.lastReplyTime" with-seconds />
              </el-descriptions-item>
              <el-descriptions-item label="回复数">
                {{ activeTopic.replyCount ?? messages.length }}
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="collaboration__drawer-section">
            <BaseSectionTitle
              title="回复记录"
              size="small"
              heading-tag="h3"
            />
            <div class="collaboration__dialogue-list">
              <article class="collaboration__dialogue-card">
                <header class="collaboration__dialogue-head">
                  <div class="collaboration__dialogue-person">
                    <strong>{{ activeTopic.starterName || "--" }}</strong>
                  </div>
                  <div class="collaboration__dialogue-meta">
                    <el-tag size="small" type="info">主题发起</el-tag>
                    <CommitteeDate :value="topicTime(activeTopic)" with-seconds />
                  </div>
                </header>
                <p class="collaboration__dialogue-content">
                  {{ activeTopic.topicContent || "暂无主题说明" }}
                </p>
                <div
                  v-if="activeTopicAttachments.length"
                  class="collaboration__dialogue-attachments"
                >
                  <span>附件</span>
                  <CommitteeAttachmentList
                    :files="activeTopicAttachments"
                    :editable="false"
                    @preview="previewAttachment"
                    @download="downloadAttachment"
                  />
                </div>
              </article>
              <article
                v-for="row in messages"
                :key="row.id"
                class="collaboration__dialogue-card"
              >
                <header class="collaboration__dialogue-head">
                  <div class="collaboration__dialogue-person">
                    <strong>{{ row.replyUserName || "--" }}</strong>
                  </div>
                  <div class="collaboration__dialogue-meta">
                    <el-tag size="small" type="info">
                      回复给 {{ activeTopic.starterName || "--" }}
                    </el-tag>
                    <CommitteeDate :value="row.replyTime" with-seconds />
                  </div>
                </header>
                <p class="collaboration__dialogue-content">
                  {{ row.replyContent || "--" }}
                </p>
                <div
                  v-if="messageAttachments[row.id]?.length"
                  class="collaboration__dialogue-attachments"
                >
                  <span>附件</span>
                  <CommitteeAttachmentList
                    :files="messageAttachments[row.id] ?? []"
                    :editable="false"
                    @preview="previewAttachment"
                    @download="downloadAttachment"
                  />
                </div>
              </article>
              <el-empty
                v-if="!messages.length"
                description="当前主题暂无回复"
                :image-size="88"
              />
            </div>
          </section>

          <section
            class="collaboration__drawer-section collaboration__reply-section"
          >
            <PermissionButton
              v-if="editable && !replyComposerVisible"
              permission="committee:project:collaboration-topic-edit"
              @click="replyComposerVisible = true"
            >
              回复此主题
            </PermissionButton>
            <div v-else-if="editable" class="collaboration__reply-form">
              <el-input
                v-model="replyContent"
                type="textarea"
                :rows="4"
                resize="none"
                placeholder="填写回复内容"
              />
              <PermissionGuard >
                <el-upload
                  v-model:file-list="replyFiles"
                  :auto-upload="false"
                  :show-file-list="false"
                  :accept="attachmentAccept"
                  :limit="5"
                  @change="handleReplyFileChange"
                >
                  <PermissionButton>
                    上传附件
                  </PermissionButton>
                </el-upload>
                <CommitteeAttachmentList
                  v-if="pendingReplyAttachments.length"
                  :files="pendingReplyAttachments"
                  editable
                  :show-download="false"
                  :previewable="false"
                  @delete="removePendingFile($event, 'reply')"
                />
              </PermissionGuard>
              <div class="collaboration__actions">
                <PermissionButton
                  :disabled="submittingReply"
                  @click="cancelReply"
                >
                  取消
                </PermissionButton>
                <PermissionButton
                  type="primary"
                  :disabled="!replyContent.trim()"
                  :loading="submittingReply"
                  @click="addReply"
                >
                  提交回复
                </PermissionButton>
              </div>
            </div>
          </section>
        </div>
        <template #footer>
          <PermissionButton @click="detailVisible = false"
            >关闭</PermissionButton
          >
        </template>
      </BaseDrawer>
      <CommitteeFilePreviewDialog
        v-model="previewVisible"
        :file="previewFile"
        :file-name="previewTitle"
      />
    </template>
  </section>
</template>

<style scoped>
.collaboration {
  display: grid;
  gap: 10px;
}

.collaboration__header-main,
.collaboration__metrics,
.collaboration__message-head,
.collaboration__topic-detail,
.collaboration__actions {
  display: flex;
  min-width: 0;
}

.collaboration__topic-detail h3,
.collaboration__topic-detail p,
.collaboration__message p {
  margin: 0;
}

.collaboration__metrics {
  flex: 1 1 auto;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.collaboration__metrics::-webkit-scrollbar {
  display: none;
}

.collaboration__metric {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 18px;
  background: var(--bq-color-bg, #f8f9f9);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.collaboration__metric-label::after {
  margin: 0 5px;
  color: var(--bq-color-border, var(--el-border-color));
  content: "|";
}

.collaboration__metrics .committee-text-strong {
  display: inline;
  min-height: 0;
  padding: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 700;
  line-height: inherit;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.collaboration__composer,
.collaboration__reply {
  display: grid;
  gap: 8px;
  padding: 14px;
  background: color-mix(in srgb, var(--bq-color-primary, #4e8ffd) 3%, white);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.collaboration__composer {
  gap: 10px;
  padding: 16px 18px;
}

.collaboration__reply-form {
  display: grid;
  gap: 10px;
  padding: 14px;
  background: color-mix(in srgb, var(--bq-color-primary, #4e8ffd) 3%, white);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.collaboration__actions {
  justify-content: flex-end;
  gap: 8px;
}

.collaboration__upload-row {
  display: flex;
  align-items: flex-start;
  min-width: 0;
}

.collaboration__upload-tip {
  display: inline-flex;
  margin-left: 10px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 32px;
}

.collaboration__table {
  width: 100%;
  overflow: hidden;
  border-radius: var(--bq-radius-control, 4px);
}

.collaboration__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.collaboration__table :deep(.el-table__header-wrapper th.el-table__cell) {
  height: 44px;
  padding: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
  background: var(--bq-color-table-header, #f0f1f2);
}

.collaboration__table :deep(.el-table__cell) {
  border-color: var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.collaboration__table :deep(.el-table__body-wrapper td.el-table__cell) {
  padding: 8px 0;
}

.collaboration__table :deep(.el-table__cell .cell) {
  padding: 0 12px !important;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.collaboration__table :deep(.el-button.is-link) {
  height: 22px;
  padding: 0;
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.collaboration__topic-title {
  display: block;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 13px);
  font-weight: 700;
  line-height: 20px;
}

.collaboration__topic-time {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 18px;
}

.collaboration__dialogue-meta :deep(.committee-date) {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.collaboration__topic-content {
  display: -webkit-box;
  overflow: hidden;
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.collaboration__detail {
  display: grid;
  gap: 22px;
  min-width: 0;
  padding: 2px 0 18px;
}

.collaboration__drawer-section {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.collaboration__reply-section > :deep(.el-button) {
  justify-self: start;
}

.collaboration__detail :deep(.el-descriptions__table) {
  table-layout: fixed;
}

.collaboration__detail :deep(.el-descriptions__label) {
  width: 118px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  background: #f8f9fb;
}

.collaboration__detail :deep(.el-descriptions__label),
.collaboration__detail :deep(.el-descriptions__content) {
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 400;
  line-height: 22px;
}

.collaboration__dialogue-list {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.collaboration__dialogue-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-card, 6px);
  background: var(--bq-color-surface, var(--el-bg-color));
}

.collaboration__dialogue-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.collaboration__dialogue-person,
.collaboration__dialogue-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.collaboration__dialogue-person strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  font-weight: 700;
  line-height: 20px;
}

.collaboration__dialogue-meta {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.collaboration__dialogue-content {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  line-height: 24px;
  white-space: pre-wrap;
}

.collaboration__dialogue-attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
  background: var(--bq-color-bg-soft, var(--el-fill-color-extra-light));
}

.collaboration__dialogue-attachments > span {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  font-weight: 700;
}

@media (max-width: 860px) {
  .collaboration__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .collaboration__header-main,
  .collaboration__metrics {
    flex-wrap: wrap;
    overflow: visible;
  }

  .collaboration__dialogue-head,
  .collaboration__dialogue-meta {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
