<template>
  <section
    ref="containerRef"
    v-loading="pageBlocking"
    class="subtable-fill-detail rev-impact-theme rv-card rv-list-card"
    :element-loading-text="pageBlockingText"
  >
    <div class="rv-list-head">
      <div>
        <div class="rv-list-title">{{ pageTitle }}</div>
        <div class="page-sub">{{ projectTitle }}</div>
      </div>
      <div class="rv-list-toolbar">
        <el-button size="small" @click="goBack">返回项目列表</el-button>
        <el-button
          v-if="showDataImportAction"
          size="small"
          type="success"
          plain
          :icon="Download"
          @click="dataImport.openDataImportDialog"
        >
          数据导入
        </el-button>
        <el-button
          v-if="showS3BulkActions"
          size="small"
          type="primary"
          plain
          :loading="state.s3BulkApplying"
          @click.stop.prevent="s3Confirmation.applyS3BulkDecision(null, 'accept_s2')"
        >
          全部接受S2
        </el-button>
        <el-button
          v-if="showS3BulkActions"
          size="small"
          plain
          :loading="state.s3BulkApplying"
          @click.stop.prevent="s3Confirmation.applyS3BulkDecision(null, 'keep_original')"
        >
          全部坚持原值
        </el-button>
        <el-tooltip
          v-if="showOwnerSubmitAction"
          :content="submitOverviewGuardHint"
          :disabled="!showSubmitOverviewGuardHint"
          placement="bottom"
        >
          <span
            class="submit-disabled-tooltip"
            :tabindex="showSubmitOverviewGuardHint ? 0 : -1"
          >
            <el-button
              size="small"
              type="success"
              :loading="state.ownerSubmitting"
              :disabled="!canSubmitSecondaryConfirm"
              @click="onSubmitSecondaryConfirm"
            >
              {{ submitActionText }}
            </el-button>
          </span>
        </el-tooltip>
        <el-tooltip
          v-if="showStageFinalSubmitAction"
          :content="submitOverviewGuardHint"
          :disabled="!showSubmitOverviewGuardHint"
          placement="bottom"
        >
          <span
            class="submit-disabled-tooltip"
            :tabindex="showSubmitOverviewGuardHint ? 0 : -1"
          >
            <el-button
              size="small"
              type="success"
              :loading="state.stageFinalSubmitting"
              :disabled="!canSubmitStageFinal"
              @click="onSubmitStageFinal"
            >
              {{ stageFinalSubmitText }}
            </el-button>
          </span>
        </el-tooltip>
        <el-button
          v-if="canUseTestFill"
          size="small"
          type="warning"
          plain
          :loading="state.testFilling"
          @click="onTestFillAllCells"
        >
          一键填充测试数据
        </el-button>
        <el-button
          v-if="showHistoryImportAction"
          size="small"
          type="success"
          plain
          :icon="Download"
          @click="openHistoryImportDialog"
        >
          导入草稿
        </el-button>
        <el-button
          v-if="showSaveDraftAction"
          size="small"
          type="primary"
          :disabled="saveDraftButtonDisabled"
          :title="saveDraftButtonTitle"
          @click="onSaveDraft"
        >
          {{ saveDraftText }}
        </el-button>
      </div>
    </div>

    <div v-if="showFlowModeSwitch" class="toolbar-line stage-mode-toolbar">
      <div class="toolbar-group">
        <span class="label">模式</span>
        <stage-mode-switch
          :value="flowPageMode"
          :edit-label="flowModeEditLabel"
          :submit-label="flowModeSubmitLabel"
          :visible="true"
          size="small"
          @value-update="onFlowPageModeChange"
        />
      </div>
    </div>

    <input
      ref="dataImportInput"
      class="data-import-input"
      type="file"
      accept=".xlsx,.xls"
      @change="handleDataImportFileChange"
    />

    <DataImportDialog
      v-model:visible="state.dataImportDialogVisible"
      v-model:root-subject-id="state.dataImportRootSubjectId"
      :options="dataImportRootSubjectOptions"
      :loading="state.dataImporting"
      @choose-file="chooseDataImportFile"
      @download-template="downloadDataImportTemplate"
    />

    <div class="info-grid">
      <div class="info-item"><span>项目编号</span><b>{{ state.project.projectNo || "-" }}</b></div>
      <div class="info-item"><span>阀点</span><b>{{ state.project.gate || "-" }}</b></div>
      <div class="info-item"><span>阶段</span><b>{{ displayUiText((state.project.audit && (state.project.audit.stage || state.project.audit.stageCode)) || currentStageCode || "-") }}</b></div>
      <div class="info-item"><span>当前用户</span><b>{{ state.currentUserName }}</b></div>
      <div class="info-item"><span>{{ subjectCountLabel }}</span><b>{{ subjectCountValue }}</b></div>
      <div class="info-item"><span>最近保存</span><b>{{ state.detail.lastSavedAt || "-" }} / {{ state.detail.lastSavedBy || "-" }}</b></div>
    </div>

    <div v-if="showS3BulkActions" class="s3-guidance-card">
      <b>二次确认提示</b>
      <span>如果都不接受 S2，可先点击"全部坚持原值"；需要修改新值时，点击具体单元格输入。</span>
    </div>

      <div v-if="showStageFinalSubmitAction" class="progress-card stage-final-card">
        <div class="progress-title">
        <span>{{ stageCompletionTitle }}</span>
        <b :class="{ 'is-ok': canSubmitStageFinal }">
          {{ stageCompletionStatusText }}
        </b>
      </div>
      <el-table :data="stageCompletionRows" border size="small">
        <el-table-column label="根科目模块" min-width="200">
          <template #default="scope">
            <button type="button" class="module-scroll-link" @click="scrollToModuleHeader(scope.row)">
              {{ displayUiText(scope.row.name) }}
            </button>
          </template>
        </el-table-column>
        <el-table-column label="完成进度" min-width="140">
          <template #default="scope">{{ scope.row.done }}/{{ scope.row.total }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="120" />
        <el-table-column label="异常项" min-width="240">
          <template #default="scope">
            {{ formatStageCompletionIssues(scope.row) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="showS1SubtableStateActions"
          label="操作"
          min-width="190"
          align="right"
        >
          <template #default="scope">
            <el-button
              v-if="s1ModuleFlow.canReeditS1Subtable(scope.row)"
              size="small"
              type="warning"
              plain
              :loading="s1ModuleFlow.isS1SubtableActionLoading(scope.row, 'reedit')"
              @click.stop="onReeditS1Subtable(scope.row)"
            >
              重新编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="!showStageFinalSubmitAction" class="progress-card">
      <div class="progress-title">子表提交状态</div>
      <el-table :data="subtableProgress" border size="small">
        <el-table-column label="子表" min-width="200">
          <template #default="scope">
            <button type="button" class="module-scroll-link" @click="scrollToModuleHeader(scope.row)">
              {{ displayUiText(scope.row.name) }}
            </button>
          </template>
        </el-table-column>
        <el-table-column label="完成进度" min-width="180">
          <template #default="scope">{{ scope.row.done }}/{{ scope.row.total }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="140" />
        <el-table-column
          v-if="showS1SubtableStateActions"
          label="操作"
          min-width="160"
          align="right"
        >
          <template #default="scope">
            <el-button
              v-if="s1ModuleFlow.canReeditS1Subtable(scope.row)"
              size="small"
              type="warning"
              plain
              :loading="s1ModuleFlow.isS1SubtableActionLoading(scope.row, 'reedit')"
              @click.stop="onReeditS1Subtable(scope.row)"
            >
              重新编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 加载中不挂大表；加载结束后再渲染，避免 Vue3 深度 Proxy 与矩阵首绘堵死 -->
    <div v-if="pageBlocking" class="module-section-list-placeholder" aria-hidden="true"></div>
    <div v-else-if="moduleSections.length" class="module-section-list">
      <section
        v-for="section in moduleSections"
        :key="section.key"
        v-loading="moduleLoading.isModuleLoading(section)"
        class="module-section"
        :element-loading-text="moduleLoading.moduleLoadingText(section)"
        :data-module-scroll-key="moduleScrollKey(section)"
        :data-module-scroll-aliases="moduleScrollAliases(section)"
      >
        <div class="module-section-head">
          <div>
            <div class="module-title-row">
              <div class="module-title">{{ displayUiText(section.name) }}</div>
              <span
                v-if="resolveModuleTitleNotice(section)"
                class="module-title-warning"
              >
                {{ resolveModuleTitleNotice(section) }}
              </span>
            </div>
          </div>
          <div
            v-if="showS3BulkActions || s1ModuleFlow.shouldShowS1ModuleToolbar(section)"
            class="module-section-actions"
          >
            <template v-if="s1ModuleFlow.shouldShowS1ModuleToolbar(section)">
              <el-button
                v-if="s1ModuleFlow.canImportS1ModuleDraft(section)"
                size="small"
                type="success"
                plain
                :icon="Download"
                @click.stop.prevent="openS1ModuleDataImportDialog(section)"
              >
                数据导入
              </el-button>
              <el-button
                v-if="s1ModuleFlow.canSaveS1ModuleDraft(section)"
                size="small"
                type="primary"
                plain
                :loading="s1ModuleFlow.isS1SubtableActionLoading(section, 'save-draft')"
                @click.stop.prevent="saveS1ModuleDraft(section)"
              >
                保存草稿
              </el-button>
            </template>
            <el-button
              v-if="canShowS3SectionBulkActions(section)"
              size="small"
              type="primary"
              plain
              :loading="state.s3BulkApplying"
              @click.stop.prevent="s3Confirmation.applyS3BulkDecision(section, 'accept_s2')"
            >
              本模块接受S2
            </el-button>
            <el-button
              v-if="canShowS3SectionBulkActions(section)"
              size="small"
              plain
              :loading="state.s3BulkApplying"
              @click.stop.prevent="s3Confirmation.applyS3BulkDecision(section, 'keep_original')"
            >
              本模块坚持原值
            </el-button>
          </div>
        </div>

        <div v-if="moduleLoading.isModuleLoadError(section)" class="module-load-error">
          <span>{{ moduleLoading.moduleLoadErrorText(section) }}</span>
          <el-button
            size="small"
            type="primary"
            plain
            @click.stop.prevent="moduleLoading.retryLoadModule(section)"
          >
            重试
          </el-button>
        </div>

        <div v-if="!isYearOnlySection(section)" class="toolbar-line module-toolbar">
          <div class="toolbar-group">
            <span class="label">视图</span>
            <el-radio-group v-model="state.viewMode" size="small">
              <el-radio-button label="overview">总览</el-radio-button>
              <el-radio-button label="year">按年份</el-radio-button>
              <el-radio-button label="trim">按版型</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="state.viewMode === 'year'" class="toolbar-group">
            <span class="label">年份</span>
            <el-select v-model="state.activeYearKey" size="small" style="width: 160px">
              <el-option
                v-for="option in displayYearOptions"
                :key="`year_${section.key}_${option.key}`"
                :label="option.label"
                :value="option.key"
              />
            </el-select>
            <el-button
              v-if="canUseYearDimensionTools(section)"
              size="small"
              type="primary"
              plain
              :icon="CirclePlus"
              @click="yearDimension.openYearEditor('add')"
            >
              新增
            </el-button>
            <el-button
              v-if="canUseYearDimensionTools(section) && dimensions.years.length"
              size="small"
              plain
              :icon="Edit"
              @click="yearDimension.openYearEditor('rename')"
            >
              重命名
            </el-button>
            <el-button
              v-if="canCopyPreviousYearDataForSection(section)"
              size="small"
              type="success"
              plain
              :icon="DocumentCopy"
              :loading="state.copyPreviousYearSaving"
              @click="onCopyPreviousYear(section)"
            >
              复制上一年
            </el-button>
            <el-button
              v-if="canDeleteActiveYearForSection(section)"
              size="small"
              type="danger"
              plain
              :icon="Delete"
              @click="onDeleteActiveYear"
            >
              删除
            </el-button>
          </div>
          <div v-if="state.viewMode === 'trim'" class="toolbar-group">
            <span class="label">版型</span>
            <el-select v-model="state.activeTrimId" size="small" style="width: 180px">
              <el-option
                v-for="trim in trimOptions"
                :key="`trim_${(section as any).key}_${(trim as any).trimId}`"
                :label="(trim as any).trimName"
                :value="(trim as any).trimId"
              />
            </el-select>
          </div>
          <div v-if="canUseYearDimensionTools(section)" class="toolbar-group">
            <span class="label">当年版型配置</span>
            <el-select
              :value="activeYearTrimIds"
              size="small"
              multiple
              collapse-tags
              style="width: 320px"
              @change="onYearTrimConfigChange"
            >
              <el-option
                v-for="trim in trimOptions"
                :key="`year_cfg_${(section as any).key}_${(trim as any).trimId}`"
                :label="(trim as any).trimName"
                :value="(trim as any).trimId"
              />
            </el-select>
          </div>
        </div>

        <div class="table-wrap">
          <table class="fill-table">
            <thead>
              <template v-if="isSectionOverviewHeader(section)">
                <tr class="header-row header-year-row">
                  <th class="sticky-col subject-col" rowspan="2">科目</th>
                  <th
                    v-for="column in rndInvestmentAmountColumnsForSection(section)"
                    :key="`${section.key}_${column.key}`"
                    class="rnd-investment-amount-col"
                    rowspan="2"
                  >
                    {{ column.label }}
                  </th>
                  <th
                    v-for="year in sectionOverviewYearHeaders(section)"
                    :key="`${section.key}_${year.key}`"
                    :colspan="year.colspan"
                  >
                    {{ year.label }}
                  </th>
                </tr>
                <tr class="header-row header-trim-row">
                  <th v-for="column in sectionOverviewDetailColumns(section)" :key="`overview_${section.key}_${column.key}`">
                    {{ column.label }}
                  </th>
                </tr>
              </template>
              <tr v-else class="header-row header-main-row">
                <th class="sticky-col subject-col">科目</th>
                <th v-for="column in sectionVisibleActiveColumns(section)" :key="`${section.key}_${column.key}`">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in section.treeRows" :key="subjectTree.resolveSubjectTreeRowKey(row)">
                <tr
                  :class="{
                    'subject-tree-parent-row': subjectTree.isSubjectTreeParent(row),
                    'subject-tree-leaf-row': !subjectTree.isSubjectTreeParent(row),
                  }"
                >
                  <td
                    class="sticky-col subject-col subject-tree-col"
                    :class="{ 'is-collapse-parent': subjectTree.isSubjectTreeParent(row) }"
                    @click="subjectTree.isSubjectTreeParent(row) && subjectTree.toggleSubjectTreeRow(row)"
                  >
                    <div class="subject-tree-cell" :style="subjectTree.subjectTreeCellStyle(row)">
                      <button
                        v-if="subjectTree.isSubjectTreeParent(row)"
                        type="button"
                        class="subject-tree-toggle"
                        @click.stop="subjectTree.toggleSubjectTreeRow(row)"
                      >
                        <i :class="subjectTree.subjectTreeIconClass(row)"></i>
                      </button>
                      <span v-else class="subject-tree-leaf-mark"></span>
                      <el-tooltip
                        :disabled="!cellEditing.isFormulaCalculatedRow(row)"
                        placement="top"
                        effect="dark"
                        :show-after="280"
                        popper-class="revenue-formula-tooltip"
                      >
                        <template #content>
                          <div class="revenue-formula-tooltip__content">
                            {{ cellEditing.resolveFormulaTooltipText(row) }}
                          </div>
                        </template>
                        <span
                          class="subject-tree-label"
                          :class="{ 'is-formula-subject': cellEditing.isFormulaCalculatedRow(row) }"
                        >{{ subjectTree.resolveSubjectTreeLabel(row) }}</span>
                      </el-tooltip>
                      <el-popover
                        v-if="subjectNote.shouldShowSubjectNoteIcon(row, section)"
                        trigger="manual"
                        :visible="subjectNote.isSubjectNotePopoverVisible(row)"
                        placement="bottom-start"
                          :width="280"
                        popper-class="revenue-fill-cell-popover revenue-subject-note-popover"
                        @update:visible="(visible: boolean) => !visible && subjectNote.closeSubjectNoteEditor()"
                      >
                        <div class="fill-cell-editor-panel audit-cell-editor-panel" @click.stop>
                          <div class="audit-popover-title">{{ state.subjectNoteEditor.title || '科目说明' }}</div>
                          <div class="audit-opinion-row">
                            <div class="audit-opinion-label">科目说明</div>
                            <el-input
                              type="textarea"
                              :rows="3"
                              :model-value="state.subjectNoteEditor.noteText"
                              :disabled="state.subjectNoteEditor.readonly"
                              :placeholder="state.subjectNoteEditor.readonly ? '当前仅可查看科目说明' : '可填写该科目的说明'"
                              @input="subjectNote.onSubjectNoteEditorInput"
                            />
                          </div>
                          <div class="audit-popover-actions">
                            <el-button size="small" @click="subjectNote.closeSubjectNoteEditor">取消</el-button>
                            <el-button
                              v-if="!state.subjectNoteEditor.readonly"
                              size="small"
                              type="primary"
                              :loading="state.subjectNoteSubmitting"
                              :disabled="state.subjectNoteSubmitting"
                              @click="subjectNote.submitSubjectNote(row, section)"
                            >
                              提交说明
                            </el-button>
                          </div>
                        </div>
                        <template #reference>
                          <el-button
                            class="fill-opinion-icon-btn subject-note-icon-btn"
                            :class="{ 'is-active': subjectNote.hasSubjectNote(row) }"
                            size="small"
                            :icon="ChatDotSquare"
                            circle
                            :title="subjectNote.hasSubjectNote(row) ? (state.subjectNoteEditor.readonly || subjectNote.isSubjectNoteReadonly(section) ? '查看科目说明' : '编辑科目说明') : '添加科目说明'"
                            @click.stop="subjectNote.openSubjectNoteEditor(row, section)"
                          />
                        </template>
                      </el-popover>
                    </div>
                  </td>
                  <td
                    v-for="column in sectionVisibleActiveColumns(section)"
                    :key="`${subjectTree.resolveSubjectTreeRowKey(row)}_${column.key}`"
                    :class="[
                      s3Confirmation.matrixCellClass(row, column),
                      { 'is-import-overwrite-pending': dataImport.isDataImportFormulaCompareCell(row, column) },
                    ]"
                  >
                    <template v-if="subjectTree.isSubjectTreeParent(row)">
                      <span v-if="subjectTree.displayAggregateLabel(row, column)" class="aggregate-value-wrap">
                        <span class="aggregate-value-text">{{ subjectTree.displaySubjectTreeParentCellValue(row, column) }}</span>
                        <span class="aggregate-calc-tag">{{ subjectTree.displayAggregateLabel(row, column) }}</span>
                      </span>
                      <span v-else>{{ subjectTree.displaySubjectTreeParentCellValue(row, column) }}</span>
                    </template>
                    <template v-else-if="s3Confirmation.isS3ConfirmationCell(row, column)">
                      <el-popover
                        trigger="manual"
                        :visible="s3Confirmation.isS3PopoverVisible(row, column)"
                        placement="bottom-start"
                        :width="360"
                        popper-class="revenue-s3-confirm-popover"
                      >
                        <div
                          class="s3-confirm-cell audit-cell-editor-panel"
                          :class="s3Confirmation.s3CandidateClass(row, column)"
                          @mousedown.stop
                          @click.stop
                        >
                          <div class="audit-popover-title">{{ s3Confirmation.resolveS3PopoverTitle(row, column) }}</div>
                          <div class="audit-popover-sub">
                            {{
                              s3Confirmation.isS3ConfirmableCell(row, column)
                                ? s3Confirmation.s3PopoverSubText(row, column)
                                : "当前子表已保存二次确认意见，仅可查看；如需改值请先点击「重新编辑」。"
                            }}
                          </div>

                          <el-radio-group
                            v-if="s3Confirmation.isS3PopoverVisible(row, column)"
                            v-model="state.s3CellEditor.choice"
                            class="s3-choice-group"
                            :disabled="!s3Confirmation.isS3ConfirmableCell(row, column)"
                          >
                            <div class="audit-choice-list">
                              <label
                                v-if="s3Confirmation.hasS3SuggestedValue(row, column)"
                                class="audit-choice-item"
                                :class="{ 'is-selected': state.s3CellEditor.choice === 'accept_s2' }"
                                @click.stop="s3Confirmation.isS3ConfirmableCell(row, column) && (state.s3CellEditor.choice = 'accept_s2')"
                              >
                                <div class="audit-choice-head">
                                  <el-radio value="accept_s2" label="accept_s2">
                                    S2评审值
                                  </el-radio>
                                  <b>{{ s3Confirmation.displayS3Value(row, column) }}</b>
                                </div>
                                <div class="audit-choice-meta">
                                  <span>{{ s3Confirmation.s3ReviewerText(row, column) }}</span>
                                  <span>{{ s3Confirmation.s3ReviewConclusionText(row, column) }}</span>
                                </div>
                                <div v-if="s3Confirmation.s3OpinionText(row, column)" class="audit-choice-note">
                                  {{ s3Confirmation.s3OpinionText(row, column) }}
                                </div>
                              </label>

                              <label
                                class="audit-choice-item"
                                :class="{ 'is-selected': state.s3CellEditor.choice === 'keep_original' }"
                                @click.stop="s3Confirmation.isS3ConfirmableCell(row, column) && (state.s3CellEditor.choice = 'keep_original')"
                              >
                                <div class="audit-choice-head">
                                  <el-radio value="keep_original" label="keep_original">
                                    S1原值
                                  </el-radio>
                                  <b>{{ s3Confirmation.displayS3OriginalValue(row, column) }}</b>
                                </div>
                              </label>
                            </div>

                            <div
                              class="audit-custom-row"
                              :class="{ 'is-selected': state.s3CellEditor.choice === 'custom' }"
                              @click.stop="s3Confirmation.isS3ConfirmableCell(row, column) && (state.s3CellEditor.choice = 'custom')"
                            >
                              <el-radio value="custom" label="custom">
                                输入新值（S3确认）
                              </el-radio>
                              <el-select
                                v-if="isModeInputRow(row)"
                                :model-value="state.s3CellEditor.customValue"
                                size="small"
                                :disabled="!s3Confirmation.isS3ConfirmableCell(row, column)"
                                @mousedown.stop
                                @click.stop
                                @update:model-value="(val: string) => s3Confirmation.onS3CustomInput(row, column, val)"
                              >
                                <el-option label="总额录入" value="总额录入" />
                                <el-option label="费率计算" value="费率计算" />
                              </el-select>
                              <el-input
                                v-else
                                :model-value="state.s3CellEditor.customValue"
                                size="small"
                                placeholder="重新给值"
                                :disabled="!s3Confirmation.isS3ConfirmableCell(row, column)"
                                @mousedown.stop
                                @click.stop
                                @focus="s3Confirmation.isS3ConfirmableCell(row, column) && (state.s3CellEditor.choice = 'custom')"
                                @update:model-value="(val: string) => s3Confirmation.onS3CustomInput(row, column, val)"
                                @keyup.enter="s3Confirmation.confirmS3SelectedValue(row, column)"
                              />
                            </div>
                          </el-radio-group>

                          <div class="audit-opinion-row" @mousedown.stop @click.stop>
                            <div class="audit-opinion-label">确认意见</div>
                            <el-input
                              :model-value="state.s3CellEditor.opinion"
                              type="textarea"
                              :rows="2"
                              placeholder="可填写本次二次确认意见"
                              :disabled="!s3Confirmation.isS3ConfirmableCell(row, column)"
                              @mousedown.stop
                              @click.stop
                              @focus.stop
                              @update:model-value="(val: string) => s3Confirmation.onS3OpinionInput(row, column, val)"
                            />
                          </div>

                          <div class="audit-popover-actions">
                            <el-button
                              size="small"
                              @click.stop.prevent="s3Confirmation.closeS3Popover({ flushDrafts: true })"
                            >
                              关闭
                            </el-button>
                            <el-button
                              v-if="s3Confirmation.isS3ConfirmableCell(row, column)"
                              size="small"
                              type="primary"
                              @click.stop.prevent="s3Confirmation.confirmS3SelectedValue(row, column)"
                            >
                              确认
                            </el-button>
                          </div>
                        </div>
                        <template #reference>
                          <el-button
                            class="audit-cell-editor-trigger s3-cell-trigger"
                            size="small"
                            :type="s3Confirmation.s3CellButtonType(row, column)"
                            plain
                            @click.stop="s3Confirmation.toggleS3Popover(row, column)"
                          >
                            {{ s3Confirmation.displayS3FinalValue(row, column) }}
                            <ChatDotSquare
                              v-if="s3Confirmation.hasS3CellOpinion(row, column)"
                              class="fill-cell-opinion-icon"
                            />
                          </el-button>
                        </template>
                      </el-popover>
                    </template>
                    <template v-else-if="dataImport.isDataImportFormulaCompareCell(row, column)">
                      <div class="data-import-overwrite-cell">
                        <div class="data-import-overwrite-original">
                          {{ dataImport.displayDataImportFormulaCompareValue(row, column) || "（空）" }}
                        </div>
                        <div class="data-import-overwrite-import">
                          <span>导入值：{{ dataImport.displayDataImportImportValue(row, column) || "（空）" }}</span>
                          <span class="data-import-overwrite-label">覆盖公式</span>
                          <el-radio-group
                            :model-value="dataImport.isDataImportFormulaOverwrite(row, column)"
                            size="small"
                            :disabled="!state.canEditFill || state.isS3ConfirmationStage || dataImport.isDataImportOverwriteSaving(row, column)"
                            @update:model-value="(val: string | number | boolean) => dataImport.onDataImportFormulaOverwriteChange(row, column, val === true)"
                          >
                            <el-radio :value="true">是</el-radio>
                            <el-radio :value="false">否</el-radio>
                          </el-radio-group>
                        </div>
                      </div>
                    </template>
                    <template v-else-if="cellEditing.isEditableCell(row, column)">
                      <div class="fill-cell-inline-editor">
                        <el-select
                          v-if="isModeInputRow(row)"
                          size="small"
                          :model-value="cellEditing.getEditableCellValue(row, column) || '总额录入'"
                          @change="onCellChange(row, column, $event)"
                        >
                          <el-option label="总额录入" value="总额录入" />
                          <el-option label="费率计算" value="费率计算" />
                        </el-select>
                        <el-input
                          v-else
                          size="small"
                          :model-value="cellEditing.getEditableCellValue(row, column)"
                          placeholder="请输入"
                          @update:model-value="(val: string) => cellEditing.onCellInput(row, column, val)"
                          @change="onCellChange(row, column, $event)"
                          @keyup.enter="blurCellInputOnEnter"
                        />
                        <el-popover
                          trigger="manual"
                          :visible="cellEditing.isFillPopoverVisible(row, column)"
                          placement="bottom-start"
                            :width="280"
                          popper-class="revenue-fill-cell-popover"
                          @update:visible="(visible: boolean) => !visible && cellEditing.closeFillCellEditor()"
                        >
                          <div class="fill-cell-editor-panel audit-cell-editor-panel" @click.stop>
                            <div class="audit-popover-title">{{ cellEditing.resolveFillPopoverTitle(row, column) }}</div>
                            <div class="audit-opinion-row">
                              <div class="audit-opinion-label">填报意见</div>
                              <el-input
                                type="textarea"
                                :rows="3"
                                :model-value="state.fillCellEditor.opinion"
                                placeholder="可填写该值的说明或意见"
                                @input="cellEditing.onFillEditorOpinionInput"
                              />
                            </div>

                            <div class="audit-popover-actions">
                              <el-button size="small" @click="cellEditing.closeFillCellEditor">取消</el-button>
                              <el-button
                                size="small"
                                type="primary"
                                :loading="state.fillCellOpinionSubmitting"
                                :disabled="state.fillCellOpinionSubmitting"
                                @click="confirmFillCellEditor"
                              >
                                提交意见
                              </el-button>
                            </div>
                          </div>
                          <template #reference>
                            <el-button
                              class="fill-opinion-icon-btn"
                              :class="{ 'is-active': cellEditing.hasFillCellOpinion(row, column) }"
                              size="small"
                              :icon="ChatDotSquare"
                              circle
                              :title="cellEditing.hasFillCellOpinion(row, column) ? '已填写意见' : '填写意见'"
                              @click.stop="cellEditing.openFillCellEditor(row, column)"
                            />
                          </template>
                        </el-popover>
                      </div>
                    </template>
                    <template v-else>
                      <span v-if="subjectTree.displayAggregateLabel(row, column)" class="aggregate-value-wrap">
                        <span class="aggregate-value-text">{{ cellEditing.displayCellValue(row, column) }}</span>
                        <span class="aggregate-calc-tag">{{ subjectTree.displayAggregateLabel(row, column) }}</span>
                      </span>
                      <span v-else>{{ cellEditing.displayCellValue(row, column) }}</span>
                    </template>
                  </td>
                </tr>
              </template>

              <tr v-if="!section.treeRows.length">
                <td :colspan="sectionVisibleActiveColumns(section).length + 1" class="empty-row">{{ emptyModuleText }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <module-opinion-card
          v-if="s1ModuleFlow.shouldShowS1ModuleOpinionCard(section)"
          class="s1-module-opinion-card"
          :title="s1ModuleFlow.resolveS1ModuleOpinionTitle(section)"
          :prior-opinions="resolvePriorOpinionsForModule(section)"
          :value="s1ModuleFlow.resolveS1ModuleOpinion(section)"
          :disabled="!s1ModuleFlow.canEditS1ModuleOpinion(section) || !isSubmitOverviewMode"
          :submit-disabled="isS1ModuleSubmitDisabled(section)"
          :submit-loading="s1ModuleFlow.isS1SubtableSubmitting(section)"
          :submit-hint="resolveS1ModuleSubmitButtonHint(section)"
          placeholder="请输入填报意见"
          :show-save="false"
          :show-submit="s1ModuleFlow.canSubmitS1Module(section)"
          :show-reedit="s1ModuleFlow.canReeditS1ModuleOpinion(section)"
          submit-text="提交"
          :handle-submit="(opinion: string) => submitS1Module(section, opinion)"
          @value-update="s1ModuleFlow.setS1ModuleOpinion(section, $event)"
          @reedit="onReeditS1Subtable(section)"
        />

        <module-opinion-card
          v-if="shouldShowS3ModuleOpinionCard(section)"
          class="s1-module-opinion-card"
          title="二次确认意见"
          :prior-opinions="resolvePriorOpinionsForModule(section)"
          :value="resolveS3ModuleOpinion(section)"
          :disabled="!canEditS3ModuleOpinion(section)"
          :save-loading="isS3ModuleOpinionSaving(section)"
          placeholder="请输入二次确认意见"
          :show-save="canEditS3ModuleOpinion(section)"
          :show-submit="false"
          :show-reedit="isS3ModuleOpinionLocked(section)"
          save-text="保存意见"
          reedit-text="重新编辑"
          @value-update="setS3ModuleOpinion(section, $event)"
          @save="saveS3ModuleOpinion(section)"
          @reedit="enableS3ModuleOpinionReedit(section)"
        />
      </section>
    </div>
    <div v-else class="empty-module-state">{{ emptyStateText }}</div>

    <el-dialog
      v-model="state.yearEditorVisible"
      :title="state.yearEditorMode === 'rename' ? '重命名年份' : '新增年份'"
      width="420px"
      append-to-body
    >
      <el-form label-width="88px" @submit.prevent>
        <el-form-item label="年份">
          <el-input
            v-model="state.yearEditorValue"
            placeholder="例如：2029 或 2029年"
            maxlength="8"
            @keyup.enter="yearDimension.confirmYearEditor"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="state.yearEditorVisible = false">取消</el-button>
          <el-button size="small" type="primary" @click="yearDimension.confirmYearEditor">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="state.historyImportDialogVisible"
      title="导入草稿"
      width="960px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div v-loading="state.historyImportLoading || state.historyImportApplying" class="history-import-panel">
        <div class="history-import-controls">
          <div class="toolbar-group">
            <span class="label">导入来源</span>
            <span class="history-import-source-name">上一阀点草稿</span>
          </div>
          <el-button size="small" type="primary" plain @click="previewHistoryImport">刷新预览</el-button>
        </div>

        <div class="history-import-summary">
          <div class="summary-item">
            <span>来源阀点</span>
            <b>{{ state.historyImportPreview.sourceValvePoint || "-" }}</b>
          </div>
          <div class="summary-item">
            <span>可导入</span>
            <b>{{ state.historyImportPreview.importableCount || 0 }}</b>
          </div>
          <div class="summary-item">
            <span>将覆盖</span>
            <b>{{ state.historyImportPreview.overwriteCount || 0 }}</b>
          </div>
          <div class="summary-item">
            <span>不可导入</span>
            <b>{{ state.historyImportPreview.blockedCount || 0 }}</b>
          </div>
        </div>

        <el-alert
          v-if="historyImportPreviewMessage"
          :title="historyImportPreviewMessage"
          type="info"
          show-icon
          :closable="false"
        />

        <el-alert
          v-if="historyImportOverwriteCount > 0"
          class="history-import-alert"
          title="存在当前页已有值，导入前需要确认覆盖。"
          type="warning"
          show-icon
          :closable="false"
        />

        <el-table
          :data="historyImportItems"
          border
          size="small"
          max-height="420"
          class="history-import-table"
        >
          <el-table-column label="科目" min-width="180">
            <template #default="scope">
              {{ displayUiText(scope.row.subjectName || scope.row.subjectCode || scope.row.subjectId || "-") }}
            </template>
          </el-table-column>
          <el-table-column label="维度" min-width="180">
            <template #default="scope">
              {{ formatHistoryImportDimension(scope.row) }}
            </template>
          </el-table-column>
          <el-table-column label="来源值" min-width="130">
            <template #default="scope">{{ formatHistoryImportValue(scope.row.sourceRawValue) }}</template>
          </el-table-column>
          <el-table-column label="当前值" min-width="130">
            <template #default="scope">{{ formatHistoryImportValue(scope.row.currentRawValue) }}</template>
          </el-table-column>
          <el-table-column label="导入后" min-width="130">
            <template #default="scope">{{ formatHistoryImportValue(scope.row.sourceRawValue) }}</template>
          </el-table-column>
          <el-table-column label="来源信息" min-width="220">
            <template #default="scope">
              <div>{{ scope.row.sourceValvePoint || "-" }} / {{ scope.row.sourceRecordStatus || "-" }}</div>
              <div class="history-import-meta">
                {{ scope.row.sourceOwnerName || scope.row.sourceOwnerId || "-" }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="140">
            <template #default="scope">
              <el-tag
                size="small"
                :type="scope.row.importable ? (scope.row.willOverwrite ? 'warning' : 'success') : 'danger'"
              >
                {{ historyImportItemStatusText(scope.row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原因" min-width="180">
            <template #default="scope">{{ scope.row.blockedReason || "-" }}</template>
          </el-table-column>
        </el-table>

        <el-checkbox
          v-if="historyImportOverwriteCount > 0"
          v-model="state.historyImportOverwriteConfirmed"
          class="history-import-confirm"
        >
          确认覆盖当前已有值
        </el-checkbox>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="state.historyImportDialogVisible = false">取消</el-button>
          <el-button
            size="small"
            type="success"
            :disabled="!canApplyHistoryImport"
            :loading="state.historyImportApplying"
            :icon="Download"
            @click="applyHistoryImport"
          >
            导入为草稿
          </el-button>
        </div>
      </template>
    </el-dialog>
  </section>
  <BaseConfirm
    v-model="confirmState.visible"
    :title="confirmState.title"
    :message="confirmState.message"
    :type="confirmState.type"
    :confirm-text="confirmState.confirmText"
    :cancel-text="confirmState.cancelText"
    :loading="confirmState.loading"
    @confirm="resolveConfirm"
    @cancel="rejectConfirm"
  />
  <!-- 不用 ElMessageBox / el-dialog：确认按钮卸载后点击后续逻辑可能被丢掉，导致不发请求 -->
  <Teleport to="body">
    <div
      v-if="s1SubmitConfirm.visible"
      class="s1-submit-confirm-mask"
      @click.stop
    >
      <div class="s1-submit-confirm-box" @click.stop>
        <div class="s1-submit-confirm-title">提交确认</div>
        <p class="s1-submit-confirm-message">{{ s1SubmitConfirm.message }}</p>
        <div class="s1-submit-confirm-actions">
          <button
            type="button"
            class="s1-submit-confirm-btn"
            @click="cancelS1ModuleSubmitConfirm"
          >
            取消
          </button>
          <button
            type="button"
            class="s1-submit-confirm-btn s1-submit-confirm-btn--primary"
            @click="confirmS1ModuleSubmit"
          >
            确认提交
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import {
  applySubtableHistoryImport,
  buildModulePriorOpinionCards,
  previewSubtableHistoryImport,
  saveSubtableFillCell,
  saveSubtableFillCells,
  saveSubtableFillDraft,
  saveSubtableFillCellOpinion,
  saveSubtableAuditModuleOpinion,
  submitSubtableAuditModule,
  cancelS1SubtableSubmit,
  submitS1StageFinal,
  submitS3OwnerConfirmation,
  submitS3StageFinal,
  submitSubtableFillSecondaryConfirm,
} from "@/pages/revenue/subtable-workbench/service";
import {
  AUDIT_DOMAIN,
  REVENUE_MODULE_CODE,
  isRevenueYearOnlyRow,
  resolveRevenueModuleTitleNotice,
} from "@/pages/revenue/subtable-workbench/domain-config";
import { hasRevenuePermission } from "@/pages/revenue/permissions";
import {
  REVENUE_FLOW_STAGE_PERMISSIONS,
  hasFlowStageActionPermission,
  resolveFlowStageActionPermission,
  resolveFlowStageDefaultAction,
} from "@/utils/revenue-permissions";
import {
  buildLifecycleColumn,
  buildLifecycleSubtotalColumn as matrixBuildLifecycleSubtotalColumn,
  buildLifecycleTrimColumns as matrixBuildLifecycleTrimColumns,
  buildDisplayYearOptions,
  buildRevenueModuleSections,
  buildSubjectTreeRows,
  buildYearSubtotalColumn,
  isSavableMatrixColumn,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import {
  isS3CandidateSavedAsArchived,
} from "@/pages/revenue/subtable-workbench/services/stage-completion-summary";
import { nowText } from "@/pages/revenue/subtable-workbench/services/workbench-utils";
import { RND_INVESTMENT_TAX_INCLUDED_CELL_KEY, RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY, buildRndInvestmentAmountColumns, isRndAmountCellKey } from "@/pages/revenue/subtable-workbench/formula-engine";
import b31TestData from "./b31-test-data";
import { formatPeriodExpenseDisplayText } from "@/utils/displayText";
import { reactive, ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useRevenueDiagnostics } from "@/composables/revenue/useRevenueDiagnostics";
import { useRevenueYearDimension } from "@/composables/revenue/useRevenueYearDimension";
import { useRevenueSubjectTree } from "@/composables/revenue/useRevenueSubjectTree";
import { useRevenueCellEditing } from "@/composables/revenue/useRevenueCellEditing";
import { useRevenueFormulaRecalc } from "@/composables/revenue/useRevenueFormulaRecalc";
import { useRevenueModuleLoading } from "@/composables/revenue/useRevenueModuleLoading";
import { useRevenueS1ModuleFlow } from "@/composables/revenue/useRevenueS1ModuleFlow";
import { useRevenueS3Confirmation } from "@/composables/revenue/useRevenueS3Confirmation";
import { useRevenueDataImport } from "@/composables/revenue/useRevenueDataImport";
import { resolveVisibleFillRows } from "@/composables/revenue/resolve-visible-fill-rows";
import { useRevenueSubjectNote } from "@/composables/revenue/useRevenueSubjectNote";
import ModuleOpinionCard from "@/pages/revenue/subtable-workbench/components/ModuleOpinionCard.vue";
import StageModeSwitch from "@/pages/revenue/subtable-workbench/components/StageModeSwitch.vue";
import DataImportDialog from "./components/DataImportDialog.vue";
import s1WorkflowGuards from "@/pages/revenue/subtable-workbench/s1-workflow-guards";
import subjectWriteAccess from "./subject-write-access";
import {
  CirclePlus,
  Edit,
  DocumentCopy,
  Delete,
  ChatDotSquare,
  Download,
} from "@element-plus/icons-vue";
import {
  moduleScrollAliases as buildModuleScrollAliases,
  moduleScrollKey as buildModuleScrollKey,
  moduleScrollKeyCandidates as buildModuleScrollKeyCandidates,
  normalizeModuleScrollKey as normalizeModuleIdentityScrollKey,
  resolveModuleSectionBySource as resolveModuleSectionByIdentity,
} from "./module-identity";

const HISTORY_IMPORT_ACTION_VISIBLE = false;
const {
  normalizeS1ModuleProgressItem,
  resolveS1ModuleProgressStatus: resolveS1ModuleProgressStatusGuard,
} = s1WorkflowGuards;
const {
  collectVisibleSubjectIdsFromRows,
  collectVisibleSubjectIdsFromTree,
  collectWritableSubjectIdsFromRows,
  collectWritableSubjectIdsFromTree,
} = subjectWriteAccess;

// 纯工具函数（提取自 methods，用于在 forEach/map 回调中去除 this.）
function normalizePositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

function appendUniquePositiveNumber(target: number[], value: unknown) {
  const number = normalizePositiveNumber(value);
  if (number != null && target.indexOf(number) === -1) {
    target.push(number);
  }
}

// displayUiText = formatPeriodExpenseDisplayText（来自 composable useRevenueSubjectTree）
function displayUiText(value: unknown) {
  return formatPeriodExpenseDisplayText(value);
}

// normalizeSubjectId（提取自 methods，保留原始数字格式化逻辑）
function normalizeSubjectId(value: unknown) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  if (/^-?\d+(\.0+)?$/u.test(raw)) return String(Number(raw));
  return raw;
}

// normalizeModuleScrollKey（包装模块级 identity 函数）
function normalizeModuleScrollKey(value: unknown) {
  return normalizeModuleIdentityScrollKey(value);
}
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();
    const { confirmState, resolveConfirm, rejectConfirm } = useBaseConfirmDialog();
    const s1SubmitConfirm = reactive({
      visible: false,
      message: "",
    });
    // 不放进 reactive，避免弹窗 @closed 抢先把待提交数据清掉导致确认后直接 return、不发请求
    let pendingS1Submit: { section: Record<string, unknown>; opinion: string } | null = null;

    // ============================================================
    // 1. 共享响应式状态（替代 data()）
    // ============================================================
    interface SubtableFillProject {
      projectNo: string;
      projectName: string;
      gate: string;
      audit: { stage: string; stageCode?: string };
      flowId?: string | number;
      [key: string]: unknown;
    }

    interface SubtableFillDetail {
      dimensions: { years: string[]; trims: string[] };
      trimOptions: Array<Record<string, unknown>>;
      yearTrimConfig: Record<string, string[]>;
      rows: import("@/types/revenue").MatrixRow[];
      parentSubjectDisplay: Record<string, string>;
      subtableProgress: unknown[];
      lastSavedAt: string;
      lastSavedBy: string;
      flowId?: string | number;
      [key: string]: unknown;
    }

    interface SubtableFillStageSummary {
      ok: boolean;
      modules: unknown[];
      message?: string;
    }

    interface SubtableFillHistoryPreview {
      items: unknown[];
      message: string;
      overwriteCount: number;
      importableCount: number;
      blockedCount: number;
      sourceValvePoint: string;
      [key: string]: unknown;
    }

    const state = reactive({
      // 查询参数（来自路由）
      queryProjectId: "",
      queryFlowId: "",
      queryProjectCode: "",
      queryProjectName: "",
      queryUserId: "",
      queryUserName: "",
      /** S3 本人草稿 ownerId 过滤键（登录名/邮箱） */
      queryOwnerUserId: "",
      queryPermissionKey: "",
      queryStage: "",
      queryValve: "",
      querySubjectDomain: "",
      querySubjectApiMode: "",
      hasAllPermission: false,

      // 项目与流程
      project: {
        projectNo: "",
        projectName: "",
        gate: "",
        audit: { stage: "" },
      } as SubtableFillProject,
      detail: {
        dimensions: { years: [] as string[], trims: [] as string[] },
        trimOptions: [] as Array<Record<string, unknown>>,
        yearTrimConfig: {} as Record<string, string[]>,
        rows: [] as import("@/types/revenue").MatrixRow[],
        parentSubjectDisplay: {} as Record<string, string>,
        subtableProgress: [] as unknown[],
        lastSavedAt: "-",
        lastSavedBy: "-",
      } as SubtableFillDetail,
      activeFlowId: "",
      currentStageCode: "",
      viewMode: "year",
      flowPageMode: "",

      // 用户
      currentUser: "1",
      currentUserName: "当前用户",

      // 权限
      canEditFill: false,
      hasS1FlowFillPermission: false,
      hasS1FlowSubmitPermission: false,
      hasS1FlowCancelSubmitPermission: false,
      isS1FlowPermissionEntry: false,
      hasWritableSubjects: false,
      visibleSubjectMap: {} as Record<string, boolean>,
      writableSubjectMap: {} as Record<string, boolean>,

      // 维度
      dimensions: { years: [] as string[], trims: [] as string[] },
      trimOptions: [] as import("@/types/revenue").TrimOption[],
      localYearTrimConfig: {} as Record<string, string[]>,
      activeYearKey: "",
      activeYearIndex: 0,
      activeRealYearIndex: 0,
      activeYearLabel: "",
      activeTrimId: "",
      displayYearOptions: [] as Array<{ key: string; yearIndex: number }>,
      activeColumns: [] as import("@/types/revenue").MatrixColumn[],

      // 模块区块
      moduleSections: [] as import("@/types/revenue").ModuleSection[],
      filteredRows: [] as import("@/types/revenue").MatrixRow[],

      // 模块加载
      moduleLoadPlan: [] as import("@/types/revenue").ModuleLoadPlan[],
      moduleSubjectTreePayload: null as import("@/types/revenue").SubjectTreeNode[] | null,
      modulePatternList: [] as unknown[],
      moduleOwnerScoped: true,
      moduleLoadStateMap: {} as Record<string, import("@/types/revenue").ModuleLoadState>,
      moduleRecordMap: {} as Record<string, unknown>,
      moduleLoadRunId: 0,
      moduleBaseQuery: {} as Record<string, unknown>,

      // S2 审核状态
      s2ModuleOpinionMap: {} as Record<string, string>,
      s2ModuleSubmitMap: {} as Record<string, unknown>,
      s2ModuleReviewState: {} as Record<string, unknown>,
      moduleS2Suggestions: [] as unknown[],

      // S1 模块状态
      s1ModuleOpinionMap: {} as Record<string, string>,
      s1ModuleSubmitMap: {} as Record<string, unknown>,
      s1ModuleTimeline: [] as unknown[],
      s1ModuleOpinionDraftMap: {} as Record<string, string>,
      s1ModuleDraftTargetMap: {} as Record<string, unknown>,
      s1ModuleOpinionLockedMap: {} as Record<string, boolean>,
      s1ModuleOpinionReeditMap: {} as Record<string, boolean>,
      s1SubtableSubmittingKey: "",
      s1SubtableActionLoadingKey: "",

      // S3 确认
      isS3ConfirmationStage: false,
      activeS3PopoverKey: "",
      s3BulkApplying: false,
      showS3BulkActions: false,
      s3CellEditor: {
        key: "",
        row: null,
        column: null,
        choice: "",
        customValue: "",
        opinion: "",
      },

      // 单元格编辑
      cellInputDrafts: {} as Record<string, string>,
      cellInputOriginals: {} as Record<string, string>,
      activeFillPopoverKey: "",
      fillCellEditor: {
        key: "",
        row: null,
        column: null,
        value: "",
        opinion: "",
      } as {
        key: string;
        row: import("@/types/revenue").MatrixRow | null;
        column: import("@/types/revenue").MatrixColumn | null;
        value: string;
        opinion: string;
      },

      // 公式
      formulaSourceDetail: null as Record<string, unknown> | null,
      formulaRecalcTimerId: null as number | null,
      formulaDebugEnabled: false,
      inputScopeDebugEnabled: false,

      // 数据导入
      dataImportDialogVisible: false,
      dataImportRootSubjectId: "",
      dataImporting: false,
      dataImportCompareByCell: {},
      dataImportFormulaOverwriteByCell: {},
      dataImportOverwriteSavingByCell: {},

      // 草案
      ownerSubmitDraftLocked: false,

      // 意见
      fillOpinionMaps: null as unknown,
      flowOpinionItems: [] as unknown[],

      // S1 科目说明
      subjectNoteMap: {} as Record<string, unknown>,
      subjectNoteSubmitting: false,
      subjectNoteEditor: {
        visibleKey: "",
        subjectId: "",
        sectionKey: "",
        title: "",
        noteText: "",
        readonly: false,
      },

      // 阶段完成
      stageCompletionSummary: null as SubtableFillStageSummary | null,
      showStageFinalSubmitAction: false,

      // 加载
      loading: false,
      isAnyModuleLoading: false,
      hasModuleLoadErrors: false,

      // 科目树
      collapsedSubjectTreeMap: {} as Record<string, boolean>,

      // 年份编辑器
      yearEditorMode: "add",
      yearEditorValue: "",
      yearEditorVisible: false,

      // 额外未在 RevenueFillState 中定义的属性（供 Options API methods 使用）
      testFilling: false,
      s3ModuleOpinionDraftMap: {} as Record<string, string>,
      s3ModuleOpinionMap: {} as Record<string, string>,
      s3ModuleOpinionReeditMap: {} as Record<string, boolean>,
      s3ModuleOpinionSavingKey: "",
      ownerSubmitting: false,
      stageFinalSubmitting: false,
      fillCellOpinionSubmitting: false,
      copyPreviousYearSaving: false,
      historyImportDialogVisible: false,
      historyImportSourceType: "PREVIOUS_DRAFT",
      historyImportPreview: {
        items: [] as unknown[],
        message: "",
        overwriteCount: 0,
        importableCount: 0,
        blockedCount: 0,
        sourceValvePoint: "",
      } as SubtableFillHistoryPreview,
      historyImportLoading: false,
      historyImportApplying: false,
      historyImportOverwriteConfirmed: false,
    }) as any;

    // ============================================================
    // 2. 计算权限相关值（供 composable deps 使用）
    // ============================================================
    const routeMenuKey = String(route.query.menuKey || "").trim();
    const isS1Entry = routeMenuKey === "flow_s1" && String(route.query.stage || "S1").trim().toUpperCase() === "S1";

    const permissions = computed(() => authStore.permissions);
    const hasS1Fill = computed(() => {
      const perms = permissions.value;
      if (!Array.isArray(perms)) return false;
      return perms.some((p: string) =>
        p === "revenue:subtable:s1:fill" || p === "*:*:*",
      );
    });
    const hasS1Submit = computed(() => {
      const perms = permissions.value;
      if (!Array.isArray(perms)) return false;
      return perms.some((p: string) =>
        p === "revenue:subtable:s1:submit" || p === "*:*:*",
      );
    });
    const hasS1CancelSubmit = computed(() => {
      const perms = permissions.value;
      if (!Array.isArray(perms)) return false;
      return perms.some((p: string) =>
        p === "revenue:subtable:s1:cancelSubmit" || p === "*:*:*",
      );
    });

    // ============================================================
    // 3. 初始化 composable 链（处理交叉依赖）
    // ============================================================
    // 3.1 无依赖 composable
    const diagnostics = useRevenueDiagnostics(state);
    const yearDimension = useRevenueYearDimension(state);
    const subjectTree = useRevenueSubjectTree(state);

    // 3.2 前向引用解决 cellEditing ↔ formulaRecalc 循环依赖
    const formulaRecalcForward: { scheduleFormulaRecalc: () => void } = {
      scheduleFormulaRecalc: () => {},
    };
    const cellEditS1Forward = {
      isS1ModuleSubmitted: (() => false) as (section: { key?: string }) => boolean,
    };

    const cellEditing = useRevenueCellEditing(state, {
      isSubjectTreeParent: subjectTree.isSubjectTreeParent,
      resolveMatrixRow: subjectTree.resolveMatrixRow,
      readCellObjectValue: subjectTree.readCellObjectValue,
      normalizeSubjectId: subjectTree.normalizeSubjectId,
      normalizeExactSubjectName: subjectTree.normalizeExactSubjectName,
      displayUiText: subjectTree.displayUiText,
      resolveRowSubjectId: subjectTree.resolveRowSubjectId,
      scheduleFormulaRecalc: () => formulaRecalcForward.scheduleFormulaRecalc(),
      resolveModuleSectionBySource: (row) => resolveModuleSectionBySource(row as Record<string, unknown>),
      isS1ModuleSubmitted: (module) => cellEditS1Forward.isS1ModuleSubmitted(module),
    });

    const formulaRecalc = useRevenueFormulaRecalc(state, {
      resolveMatrixRow: subjectTree.resolveMatrixRow,
      isSubjectTreeParent: subjectTree.isSubjectTreeParent,
      getCellValue: cellEditing.getCellValue,
      getCellRecordMeta: cellEditing.getCellRecordMeta,
      resolveCellLegacyKey: cellEditing.resolveCellLegacyKey,
      resolveCellDimensionKey: cellEditing.resolveCellDimensionKey,
      isColumnFillableByInputScope: cellEditing.isColumnFillableByInputScope,
      isEditableCell: cellEditing.isEditableCell,
      isEditableInputRow: cellEditing.isEditableInputRow,
      getPageTraceNow: diagnostics.getPageTraceNow,
      formatPageTraceTime: diagnostics.formatPageTraceTime,
    });

    // 回填前向引用
    formulaRecalcForward.scheduleFormulaRecalc = formulaRecalc.scheduleFormulaRecalc;

    // 3.3 前向引用（用于跨 composable 引用 + methods 中方法）
    const buildSaveDraftParamsForward: { fn: () => Record<string, unknown> } = {
      fn: () => ({}),
    };
    const redirectForward: { fn: () => boolean } = {
      fn: () => false,
    };
    const saveFillCellValueForward: {
      fn: (row: import("@/types/revenue").MatrixRow, column: import("@/types/revenue").MatrixColumn, value: unknown) => Promise<{ ok?: boolean }>;
    } = {
      fn: async () => ({ ok: false }),
    };
    const saveCellOpinionForward: {
      fn: (
        row: import("@/types/revenue").MatrixRow,
        column: import("@/types/revenue").MatrixColumn,
        opinion: string,
        options?: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
    } = {
      fn: async () => ({ ok: false }),
    };
    const queueDraftSaveOperationForward: {
      fn: <T>(runSave: () => Promise<T>) => Promise<T>;
    } = {
      fn: async (runSave) => runSave(),
    };
    const clearDataImportCompareStateForward: { fn: () => void } = {
      fn: () => {},
    };
    const sectionVisibleActiveColumnsForward: {
      fn: (section: import("@/types/revenue").ModuleSection) => import("@/types/revenue").MatrixColumn[];
    } = {
      fn: () => [],
    };
    // S1 相关前向引用（moduleLoading → s1ModuleFlow）
    const s1Forward = {
      isS1ModuleSubmitted: (() => false) as (section: import("@/types/revenue").ModuleSection) => boolean,
      isS1ModuleOpinionReediting: (() => false) as (section: import("@/types/revenue").ModuleSection) => boolean,
      resolveS1ModuleOpinionKeys: (() => []) as (section: import("@/types/revenue").ModuleSection) => string[],
      applyS1ModuleReviewState: (() => {}) as (mapState: Record<string, unknown>) => void,
      applyS2ModuleReviewState: (() => {}) as (mapState: Record<string, unknown>) => void,
      buildS1ModuleSaveParams: (() => ({})) as (section: import("@/types/revenue").ModuleSection, extra?: Record<string, unknown>) => Record<string, unknown>,
    };
    // 科目说明前向引用（moduleLoading 早于 subjectNote 初始化）
    const subjectNoteForward = {
      loadSubjectNotes: (async () => {}) as (query?: Record<string, unknown>) => Promise<void>,
      getCanEditFill: (() => false) as () => boolean,
    };
    // 运行时 flag 同步（loadPage 前调用，避免用 watch 写回 state 引发连锁更新卡死）
    const runtimeFlagsForward = {
      sync: (() => {}) as () => void,
    };

    // 3.4 模块加载（需要最多的依赖注入）
    const moduleLoading = useRevenueModuleLoading(state, {
      getPageTraceNow: diagnostics.getPageTraceNow,
      formatPageTraceTime: diagnostics.formatPageTraceTime,
      createPageRenderTrace: diagnostics.createPageRenderTrace,
      buildPageRenderSummary: diagnostics.buildPageRenderSummary,
      logPageRenderTiming: diagnostics.logPageRenderTiming,
      resolveSubjectTreeNodes: subjectTree.resolveSubjectTreeNodes,
      normalizeRowsBySubjectTree: subjectTree.normalizeRowsBySubjectTree,
      // 与 Vue2 一致：按 effectivePermissionLevel / readonlyReason 过滤，避免未授权子表进入进度与模块列表
      collectVisibleSubjectIds: (nodes, bucket) =>
        collectVisibleSubjectIdsFromTree(nodes, bucket),
      collectSubjectIds: (nodes, bucket) =>
        collectWritableSubjectIdsFromTree(nodes, bucket),
      collectVisibleRowSubjectIds: (rows, bucket) =>
        collectVisibleSubjectIdsFromRows(rows, bucket, subjectTree.resolveRowSubjectId),
      collectRowSubjectIds: (rows, bucket) =>
        collectWritableSubjectIdsFromRows(rows, bucket, subjectTree.resolveRowSubjectId),
      mergeStoredYearsIntoDetail: yearDimension.mergeStoredYearsIntoDetail,
      syncTopLevelDimensionStateFromDetail: yearDimension.syncTopLevelDimensionStateFromDetail,
      // syncActiveDimensionSelection 会在 moduleLoading 内部实现；此处占位满足类型
      syncActiveDimensionSelection: (() => {}) as () => void,
      applyCurrentDetailFormulas: formulaRecalc.applyCurrentDetailFormulas,
      loadFormulaSourceDetail: formulaRecalc.loadFormulaSourceDetail,
      loadSubjectNotes: (query) => subjectNoteForward.loadSubjectNotes(query),
      syncRuntimeFlagsToState: () => runtimeFlagsForward.sync(),
      scheduleManagementRateInputScopeDiagnostics: formulaRecalc.scheduleManagementRateInputScopeDiagnostics,
      isS1FlowPermissionEntry: isS1Entry,
      hasS1FlowFillPermission: hasS1Fill.value,
      hasS1FlowSubmitPermission: hasS1Submit.value,
      hasS1FlowCancelSubmitPermission: hasS1CancelSubmit.value,
      isS1ModuleSubmitted: (section) => s1Forward.isS1ModuleSubmitted(section),
      isS1ModuleOpinionReediting: (section) => s1Forward.isS1ModuleOpinionReediting(section),
      resolveS1ModuleOpinionKeys: (section) => s1Forward.resolveS1ModuleOpinionKeys(section),
      applyS1ModuleReviewState: (mapState) => s1Forward.applyS1ModuleReviewState(mapState),
      applyS2ModuleReviewState: (mapState) => s1Forward.applyS2ModuleReviewState(mapState),
      buildS1ModuleSaveParams: (section, extra) => s1Forward.buildS1ModuleSaveParams(section, extra),
      buildSaveDraftParams: () => buildSaveDraftParamsForward.fn(),
      redirectToStageDetailIfNeeded: () => redirectForward.fn(),
      clearDataImportCompareState: () => clearDataImportCompareStateForward.fn(),
    });

    // 3.5 S1 模块流程
    const s1ModuleFlow = useRevenueS1ModuleFlow(state, {
      resolveMatrixRow: subjectTree.resolveMatrixRow,
      isSubjectTreeParent: subjectTree.isSubjectTreeParent,
      isEditableInputRow: cellEditing.isEditableInputRow,
      isColumnFillableByInputScope: cellEditing.isColumnFillableByInputScope,
      getCellRecordMeta: cellEditing.getCellRecordMeta,
      normalizeSubjectId: subjectTree.normalizeSubjectId,
      normalizeExactSubjectName: subjectTree.normalizeExactSubjectName,
      displayUiText: subjectTree.displayUiText,
      resolveRowSubjectId: subjectTree.resolveRowSubjectId,
      resolveModuleSectionBySource: (() => {
        // 需要 resolveModuleSectionByIdentity
        const sections = state.moduleSections;
        return (source: unknown) => {
          const key = String((source as Record<string, unknown>)?.moduleKey || (source as Record<string, unknown>)?.rootSubjectId || "").trim();
          return sections.find((s: any) => s.key === key || s.moduleKey === key) || null;
        };
      })(),
      isMainPnlSection: (() => {
        return (section: import("@/types/revenue").ModuleSection) =>
          String(section.moduleCode || "").trim() === "main_pnl";
      })(),
      rowAllActionColumns: () => state.activeColumns,
      appendUniquePositiveNumber: (list: (string | number)[], id: unknown) => {
        const num = Number(id);
        if (Number.isFinite(num) && num > 0) {
          const trunk = Math.trunc(num);
          if (!list.includes(trunk)) list.push(trunk);
        }
      },
      buildSaveDraftParams: () => buildSaveDraftParamsForward.fn(),
    });

    // 回填 s1Forward（供 moduleLoading deps 使用）
    s1Forward.isS1ModuleSubmitted = s1ModuleFlow.isS1ModuleSubmitted;
    cellEditS1Forward.isS1ModuleSubmitted = s1ModuleFlow.isS1ModuleSubmitted;
    s1Forward.isS1ModuleOpinionReediting = s1ModuleFlow.isS1ModuleOpinionReediting;
    s1Forward.resolveS1ModuleOpinionKeys = s1ModuleFlow.resolveS1ModuleOpinionKeys;
    s1Forward.applyS1ModuleReviewState = s1ModuleFlow.applyS1ModuleReviewState;
    s1Forward.applyS2ModuleReviewState = s1ModuleFlow.applyS2ModuleReviewState;
    s1Forward.buildS1ModuleSaveParams = s1ModuleFlow.buildS1ModuleSaveParams;
    // 必须回填：否则 S1 提交校验只带模块字段、没有 projectId/flowId，
    // ensureProjectCostFlow 会在不发请求的情况下直接抛「未找到当前项目收益流程」
    buildSaveDraftParamsForward.fn = () => buildSaveDraftParams();

    // 3.5b S1 科目说明
    const subjectNote = useRevenueSubjectNote(state, {
      isSubjectTreeParent: subjectTree.isSubjectTreeParent,
      resolveMatrixRow: subjectTree.resolveMatrixRow,
      resolveRowSubjectId: subjectTree.resolveRowSubjectId,
      resolveSubjectTreeLabel: subjectTree.resolveSubjectTreeLabel,
      isS1ModuleSubmitted: (section) => s1Forward.isS1ModuleSubmitted(section),
      getCanEditFill: () => subjectNoteForward.getCanEditFill(),
    });
    subjectNoteForward.loadSubjectNotes = subjectNote.loadSubjectNotes;

    // 3.6 S3 确认
    const s3Confirmation = useRevenueS3Confirmation(state, {
      resolveMatrixRow: subjectTree.resolveMatrixRow,
      isSubjectTreeParent: subjectTree.isSubjectTreeParent,
      isEditableInputRow: cellEditing.isEditableInputRow,
      isColumnFillableByInputScope: cellEditing.isColumnFillableByInputScope,
      getCellValue: cellEditing.getCellValue,
      buildCellDraftKey: cellEditing.buildCellDraftKey,
      resolveCellLegacyKey: cellEditing.resolveCellLegacyKey,
      updateCellValueLocally: cellEditing.updateCellValueLocally,
      getCellRecordMeta: cellEditing.getCellRecordMeta,
      updateCellRecordMeta: cellEditing.updateCellRecordMeta,
      readLocalCellOpinion: cellEditing.readLocalCellOpinion,
      writeLocalCellOpinion: cellEditing.writeLocalCellOpinion,
      blurActivePopoverElement: cellEditing.blurActivePopoverElement,
      displayUiText: subjectTree.displayUiText,
      resolveRowSubjectId: subjectTree.resolveRowSubjectId,
      isRndInvestmentAmountColumn: cellEditing.isRndInvestmentAmountColumn,
      isYearOnlyRow: cellEditing.isYearOnlyRow,
      validatePercentDisplayInput: cellEditing.validatePercentDisplayInput,
      scheduleFormulaRecalc: formulaRecalc.scheduleFormulaRecalc,
      buildSaveDraftParams: () => buildSaveDraftParamsForward.fn(),
      saveCellOpinion: (row, column, opinion, options) =>
        saveCellOpinionForward.fn(row, column, opinion, options),
      isS3ModuleEditableForRow: (row) => {
        const section = resolveModuleSectionBySource(row as Record<string, unknown>);
        if (!section) return true;
        return !isS3ModuleOpinionLocked(section);
      },
    });

    // 3.7 数据导入
    const dataImport = useRevenueDataImport(state, {
      resolveMatrixRow: subjectTree.resolveMatrixRow,
      isEditableInputRow: cellEditing.isEditableInputRow,
      isComputedRow: cellEditing.isComputedRow,
      isColumnFillableByInputScope: cellEditing.isColumnFillableByInputScope,
      isYearOnlyRow: cellEditing.isYearOnlyRow,
      isRndInvestmentSourceRow: cellEditing.isRndInvestmentSourceRow,
      isRndExpenseRow: cellEditing.isRndExpenseRow,
      isSubjectTreeParent: subjectTree.isSubjectTreeParent,
      getCellValue: cellEditing.getCellValue,
      getEditableCellValue: cellEditing.getEditableCellValue,
      displayCellValue: cellEditing.displayCellValue,
      buildCellDraftKey: cellEditing.buildCellDraftKey,
      resolveCellLegacyKey: cellEditing.resolveCellLegacyKey,
      resolveCellValueRow: cellEditing.resolveCellValueRow,
      updateCellValueLocally: cellEditing.updateCellValueLocally,
      clearCellInputDraft: cellEditing.clearCellInputDraft,
      validatePercentDisplayInput: cellEditing.validatePercentDisplayInput,
      normalizeSubjectId: subjectTree.normalizeSubjectId,
      normalizeExactSubjectName: subjectTree.normalizeExactSubjectName,
      displayUiText: subjectTree.displayUiText,
      compareIdText: subjectTree.compareIdText,
      applyCurrentDetailFormulas: formulaRecalc.applyCurrentDetailFormulas,
      sectionVisibleActiveColumns: (section) => sectionVisibleActiveColumnsForward.fn(section),
      saveFillCellValue: (row, column, value) => saveFillCellValueForward.fn(row, column, value),
      queueDraftSaveOperation: (runSave) => queueDraftSaveOperationForward.fn(runSave),
    });
    clearDataImportCompareStateForward.fn = dataImport.clearDataImportCompareState;

    // diagnostics 返回值解构
    const { createSubmitRefreshTrace, logSubmitRefreshDecision, logSubmitLocalRenderTiming } = diagnostics;

    // yearDimension 返回值解构
    const { writeStoredYears, ensureDetailDimensions, deleteActiveYear, buildRealYearTrimColumn } = yearDimension;

    // subjectTree 返回值解构
    const { resolveRowSubjectId, resolveMatrixRow, isSubjectTreeParent } = subjectTree;

    // cellEditing 返回值解构
    const { isEditableInputRow, isColumnFillableByInputScope, isRndInvestmentSourceRow, isRndExpenseRow, getCellValue, buildCellDraftKey, clearCellInputDraft, validatePercentDisplayInput, updateCellValueLocally, getCellRecordMeta, updateCellRecordMeta, resolveCellLegacyKey, resolveCellDimensionKey, resolveCellValueRow, readLocalCellOpinion, writeLocalCellOpinion, closeFillCellEditor } = cellEditing;

    // formulaRecalc 返回值解构
    const { flushScheduledFormulaRecalc, applyCurrentDetailFormulas, logConsumerCreditSaveDebug, buildAllRealColumns } = formulaRecalc;

    // moduleLoading 返回值解构
    const { loadPage, refreshStageCompletionSummary, loadS1ModuleReviewState, retryLoadModule } = moduleLoading;

    // s1ModuleFlow 返回值解构
    const { resolveS1ModuleOpinionKeys, writeS1ModuleMap } = s1ModuleFlow;

    // s3Confirmation 返回值解构
    const { getS3Candidate, hasS3ActionableCandidate } = s3Confirmation;

    // ============================================================
    // 4. 返回：状态 + composable 方法合并到组件实例
    // ============================================================

    // 4.1 模板事件绑定包装（composable 返回的方法不可直接暴露给模板）
    const dataImportInput = ref<HTMLInputElement | null>(null);
    const containerRef = ref<HTMLElement | null>(null);
    function handleDataImportFileChange(event: Event) {
      return dataImport.handleDataImportFileChange(
        event,
        () => selectedDataImportRootSubject.value,
      );
    }
    function chooseDataImportFile() {
      if (!selectedDataImportRootSubject.value) {
        ElMessage.warning("请选择导入模板");
        return;
      }
      const input = dataImportInput.value;
      if (!input) return;
      input.value = "";
      input.click();
    }
    function downloadDataImportTemplate() {
      dataImport.downloadDataImportTemplate();
    }

// ---- computed ----
const currentPermissions = computed(() => {
      return authStore.permissions || [];
  });
const isS1FlowPermissionEntry = computed(() => {
      return routeMenuKey === "flow_s1" && String(queryStage.value || "S1").trim().toUpperCase() === "S1";
  });
const isS3FlowPermissionEntry = computed(() => {
      return routeMenuKey === "flow_s3" && String(queryStage.value || "S3").trim().toUpperCase() === "S3";
  });
const s1FlowActionKey = computed(() => {
      const action = String(route.query.action || "").trim().toLowerCase();
      return action || resolveFlowStageDefaultAction("S1", currentPermissions.value);
  });
const s3FlowActionKey = computed(() => {
      const action = String(route.query.action || "").trim().toLowerCase();
      return action || resolveFlowStageDefaultAction("S3", currentPermissions.value);
  });
const isS1FinalSubmitAction = computed(() => {
      return ["stage_final_submit", "final_submit", "submit"].includes(s1FlowActionKey.value);
  });
const isS1FillAction = computed(() => {
      return ["open_fill", "fill"].includes(s1FlowActionKey.value);
  });
const isS3FinalSubmitAction = computed(() => {
      return ["stage_final_submit", "final_submit", "submit"].includes(s3FlowActionKey.value);
  });
const isS3ConfirmAction = computed(() => {
      return ["confirm", "open_fill", "fill"].includes(s3FlowActionKey.value);
  });
const s1FlowPageMode = computed(() => {
      if (!isS1FlowPermissionEntry.value) return "";
      if (isS1FinalSubmitAction.value) return "submit";
      if (isS1FillAction.value) return "fill";
      return "view";
  });
const hasS1FlowViewPermission = computed(() => {
      return hasFlowStageActionPermission(currentPermissions.value, "S1", "view");
  });
const hasS1FlowFillPermission = computed(() => {
      return hasRevenuePermission(currentPermissions.value, REVENUE_FLOW_STAGE_PERMISSIONS.S1.fill);
  });
const hasS1FlowSubmitPermission = computed(() => {
      return hasRevenuePermission(currentPermissions.value, REVENUE_FLOW_STAGE_PERMISSIONS.S1.submit);
  });
const hasS1FlowCancelSubmitPermission = computed(() => {
      return hasRevenuePermission(currentPermissions.value, REVENUE_FLOW_STAGE_PERMISSIONS.S1.cancelSubmit);
  });
const hasS3FlowConfirmPermission = computed(() => {
      return hasFlowStageActionPermission(currentPermissions.value, "S3", "confirm");
  });
const hasS3FlowViewPermission = computed(() => {
      return hasFlowStageActionPermission(currentPermissions.value, "S3", "view");
  });
const hasS3FlowSubmitPermission = computed(() => {
      return hasFlowStageActionPermission(currentPermissions.value, "S3", "submit");
  });
    // 切换开关出现条件:能编辑(填报/二次确认) + 能进入查看提交态(查看或提交任一)
const showS1ModeSwitch = computed(() => {
      return isS1FlowPermissionEntry.value &&
        currentStageCode.value === "S1" &&
        hasS1FlowFillPermission.value &&
        (hasS1FlowViewPermission.value || hasS1FlowSubmitPermission.value);
  });
const s3FlowPageMode = computed(() => {
      if (!isS3FlowPermissionEntry.value) return "";
      if (isS3FinalSubmitAction.value) return "submit";
      if (isS3ConfirmAction.value) return "confirm";
      return "view";
  });
const showS3ModeSwitch = computed(() => {
      return isS3FlowPermissionEntry.value &&
        currentStageCode.value === "S3" &&
        hasS3FlowConfirmPermission.value &&
        (hasS3FlowViewPermission.value || hasS3FlowSubmitPermission.value);
  });
    // 统一两态模式：edit（S1 填报 / S3 二次确认） | view_submit（查看提交）
const flowPageMode = computed(() => {
      if (currentStageCode.value === "S3") {
        return s3FlowPageMode.value === "confirm" ? "edit" : "view_submit";
      }
      return s1FlowPageMode.value === "fill" ? "edit" : "view_submit";
  });
const showFlowModeSwitch = computed(() => {
      if (currentStageCode.value === "S3") return showS3ModeSwitch.value;
      return showS1ModeSwitch.value;
  });
const flowModeEditLabel = computed(() => {
      return currentStageCode.value === "S3" ? "二次确认" : "子表填报";
  });
const flowModeSubmitLabel = computed(() => {
      const hasSubmit = currentStageCode.value === "S3"
        ? hasS3FlowSubmitPermission.value
        : hasS1FlowSubmitPermission.value;
      return hasSubmit ? "查看提交" : "查看";
  });
const activeFlowActionKey = computed(() => {
      if (currentStageCode.value === "S1") return s1FlowActionKey.value;
      if (currentStageCode.value === "S3") return s3FlowActionKey.value;
      return String(route.query.action || "").trim().toLowerCase() ||
        resolveFlowStageDefaultAction(currentStageCode.value, currentPermissions.value);
  });
const queryPermissionKey = computed(() => {
      return resolveFlowStageActionPermission(currentStageCode.value, activeFlowActionKey.value);
  });
const hasAllPermission = computed(() => {
      return hasRevenuePermission(currentPermissions.value, "*:*:*");
  });
const queryUserId = computed(() => {
      // 科目权限树等接口需要数字用户主键；优先当前登录用户 id，避免 URL 误带登录名导致无科目
      const routeUser = String(route.query.user || "").trim();
      const numericId = String(authStore.currentUser?.id || "").trim();
      if (numericId) return numericId;
      // 兼容：路由 user 已是数字时可用
      if (routeUser && !routeUser.includes("@")) return routeUser;
      return "1";
  });
/** 与后端 project-cost ownerId 对齐的登录名（邮箱/userName），仅用于 S3 本人草稿过滤 */
const queryOwnerUserId = computed(() => {
      const ownerUser = String(route.query.ownerUser || "").trim();
      if (ownerUser) return ownerUser;
      const username = String(authStore.currentUser?.username || "").trim();
      if (username) return username;
      // 兼容旧链接：user 参数曾被写成登录名
      const routeUser = String(route.query.user || "").trim();
      if (routeUser.includes("@") || routeUser === username) return routeUser;
      return "";
  });
const queryUserName = computed(() => {
      return String(
          route.query.userName ||
          authStore.currentUser?.displayName ||
          authStore.currentUser?.username ||
          "当前用户"
      ).trim();
  });
const querySubjectApiMode = computed(() => {
      return String(route.query.subjectApiMode || "permission").trim().toLowerCase();
  });
const querySubjectDomain = computed(() => {
      return String(route.query.subjectDomain || AUDIT_DOMAIN.SUBTABLE).trim().toLowerCase();
  });
const isMainSubjectDomain = computed(() => {
      return querySubjectDomain.value === AUDIT_DOMAIN.MAIN_TABLE;
  });
const queryProjectCode = computed(() => {
      return String(
        route.query.projectCode ||
          route.query.projectNo ||
          ""
      );
  });
const queryProjectName = computed(() => {
      return String(route.query.projectName || "").trim();
  });
const queryProjectId = computed(() => {
      return String(
        route.query.projectId ||
          route.query.project_id ||
          route.query.bizProjectId ||
          route.query.projectCostProjectId ||
          ""
      ).trim();
  });
const queryFlowId = computed(() => {
      // 对齐 Vue2 列表跳转的 flowId || id；Vue3 resolveDetailRoute 会把流程主键放到 query.id
      return String(route.query.flowId || route.query.id || "").trim();
  });
const activeFlowId = computed(() => {
      return String(
        queryFlowId.value ||
          (state.project && state.project.flowId) ||
          (state.detail && state.detail.flowId) ||
          ""
      ).trim();
  });
const queryStage = computed(() => {
      // URL 常带 node=S1 而非 stage，与流程入口保持一致
      return String(route.query.stage || route.query.node || "S1");
  });
const queryValve = computed(() => {
      return String(route.query.valvePoint || route.query.valve || "").trim();
  });
const canEditFill = computed(() => {
      if (currentStageCode.value === "S1") {
        return isS1FillAction.value && hasS1FlowFillPermission.value;
      }
      if (currentStageCode.value === "S3") {
        return isS3ConfirmAction.value && hasS3FlowConfirmPermission.value;
      }
      return false;
  });
const currentStageCode = computed(() => {
      return String(
        (state.project.audit && state.project.audit.stageCode) || queryStage.value || ""
      )
        .trim()
        .toUpperCase();
  });
const isFillStage = computed(() => {
      return currentStageCode.value === "S1" || currentStageCode.value === "S3";
  });
const isS3ConfirmationStage = computed(() => {
      return currentStageCode.value === "S3";
  });
const isStageFinalSubmitter = computed(() => {
      if (currentStageCode.value === "S1") {
        return isS1FinalSubmitAction.value && hasS1FlowSubmitPermission.value;
      }
      if (currentStageCode.value === "S3") {
        return isS3FinalSubmitAction.value && hasS3FlowSubmitPermission.value;
      }
      return false;
  });
const pageTitle = computed(() => {
      if (currentStageCode.value === "S3") return "子表二次确认详情";
      if (currentStageCode.value === "S1") return "子表填报详情";
      if (currentStageCode.value === "S2") return "子表审核基准预览";
      if (currentStageCode.value === "S4") return "主表审核基准预览";
      if (currentStageCode.value === "S6") return "集团财务审核主表基准预览";
      return "收益测算详情";
  });
const showOwnerSubmitAction = computed(() => {
      if (currentStageCode.value === "S1") {
        if (isS1FlowPermissionEntry.value) return false;
        return canEditFill.value && !isStageFinalSubmitter.value;
      }
      return currentStageCode.value === "S3" && canEditFill.value;
  });
const showStageFinalSubmitAction = computed(() => {
      return ["S1", "S3"].includes(currentStageCode.value) && isStageFinalSubmitter.value;
  });
// 供 loadPage / 科目说明读取：一次性写入 state，不用 watch 持续同步（避免首屏连锁更新卡死）
runtimeFlagsForward.sync = () => {
  state.currentStageCode = currentStageCode.value;
  state.canEditFill = canEditFill.value;
  state.isS1FlowPermissionEntry = isS1FlowPermissionEntry.value;
  state.hasS1FlowFillPermission = hasS1FlowFillPermission.value;
  state.hasS1FlowSubmitPermission = hasS1FlowSubmitPermission.value;
  state.hasS1FlowCancelSubmitPermission = hasS1FlowCancelSubmitPermission.value;
  state.flowPageMode = flowPageMode.value;
  state.showStageFinalSubmitAction = showStageFinalSubmitAction.value;
  state.isS3ConfirmationStage = isS3ConfirmationStage.value;
};
subjectNoteForward.getCanEditFill = () => canEditFill.value;
const showS1SubtableStateActions = computed(() => {
      return isS1FlowPermissionEntry.value &&
        currentStageCode.value === "S1" &&
        hasS1FlowCancelSubmitPermission.value;
  });
const showSaveDraftAction = computed(() => {
      if (isS1FlowPermissionEntry.value && currentStageCode.value === "S1") return false;
      return currentStageCode.value === "S1" && canEditFill.value;
  });
const hasSubmittedOwnerFillRecord = computed(() => {
      if (currentStageCode.value !== "S1" || !canEditFill.value) return false;
      const rows = Array.isArray(filteredRows.value) ? filteredRows.value : [];
      const currentUser = String(state.currentUser || "").trim();
      return rows.some((row: any) => {
        const dataRow = subjectTree.resolveMatrixRow(row);
        if (!dataRow) return false;
        return rowActiveColumns(dataRow).some((column: any) => {
          if (!isSavableMatrixColumn(column)) return false;
          if (!cellEditing.isColumnFillableByInputScope(dataRow, column)) return false;
          const recordMeta = cellEditing.getCellRecordMeta(dataRow, column);
          if (!recordMeta || String(recordMeta.recordStatus || "").toUpperCase() !== "ARCHIVED") {
            return false;
          }
          const ownerId = String(recordMeta.ownerId || "").trim();
          return !ownerId || !currentUser || matchesCurrentRecordOwner(ownerId);
        });
      });
  });
const saveDraftButtonDisabled = computed(() => {
      return !canEditFill.value ||
        !hasWritableSubjects.value ||
        isAnyModuleLoading.value ||
        hasModuleLoadErrors.value ||
        state.ownerSubmitDraftLocked ||
        hasSubmittedOwnerFillRecord.value;
  });
const saveDraftButtonTitle = computed(() => {
      if (!hasWritableSubjects.value) {
        return "当前用户暂无可填科目，不能保存草稿";
      }
      if (state.ownerSubmitDraftLocked || hasSubmittedOwnerFillRecord.value) {
        return "本人填报已提交，不能继续保存草稿";
      }
      return "";
  });
const showHistoryImportAction = computed(() => {
      return HISTORY_IMPORT_ACTION_VISIBLE &&
        currentStageCode.value === "S1" &&
        canEditFill.value &&
        hasWritableSubjects.value &&
        Boolean(activeFlowId.value);
  });
const showDataImportAction = computed(() => {
      return currentStageCode.value === "S1" && canEditFill.value && !isS1FlowPermissionEntry.value;
  });
const dataImportRootSubjectOptions = computed(() => {
      return dataImport.buildDataImportRootSubjectOptions();
  });
const selectedDataImportRootSubject = computed(() => {
      const targetId = String(state.dataImportRootSubjectId || "").trim();
      return dataImportRootSubjectOptions.value.find((item: any) => item.id === targetId) || null;
  });
const showS3BulkActions = computed(() => {
      return isS3ConfirmationStage.value && canEditFill.value;
  });
function canShowS3SectionBulkActions(section: Record<string, unknown> = {}) {
      return showS3BulkActions.value && canEditS3ModuleOpinion(section);
  }
const saveDraftText = computed(() => {
      return "保存草稿";
  });
const submitActionText = computed(() => {
      if (currentStageCode.value === "S1") return "提交本人填报";
      if (currentStageCode.value === "S3") return "提交本人二次确认";
      return "";
  });
const stageFinalSubmitText = computed(() => {
      if (currentStageCode.value === "S3") return "生成主表并流转到 S4 品牌财务主表审核";
      return "生成主表并流转到 S2 集团部室审核";
  });
const stageCompletionTitle = computed(() => {
      if (currentStageCode.value === "S3") return "S3 业务经理二次确认阶段完成清单";
      return "S1 业务经理填报阶段完成清单";
  });
const allModuleSectionsYearOnly = computed(() => {
      const sections = moduleSections.value || [];
      return sections.length > 0 && sections.every((section: any) => isYearOnlySection(section));
  });
const isSubmitOverviewMode = computed(() => {
      return state.viewMode === "overview" || allModuleSectionsYearOnly.value;
  });
const submitOverviewGuardHint = computed(() => {
      if (currentStageCode.value === "S1" && showOwnerSubmitAction.value && hasSubmittedOwnerFillRecord.value) {
        return "本人填报已提交，需先重新编辑后才能再次提交";
      }
      return "请切换到总览，确认全部年份与版型后再提交";
  });
const showSubmitOverviewGuardHint = computed(() => {
      return (showOwnerSubmitAction.value || showStageFinalSubmitAction.value) &&
        (!isSubmitOverviewMode.value ||
          (currentStageCode.value === "S1" && showOwnerSubmitAction.value && hasSubmittedOwnerFillRecord.value));
  });
const isAnyModuleLoading = computed(() => {
      return Object.values(state.moduleLoadStateMap || {}).some(
        (state: any) => state && state.status === "loading"
      );
  });
const hasModuleLoadErrors = computed(() => {
      return Object.values(state.moduleLoadStateMap || {}).some(
        (state: any) => state && state.status === "error"
      );
  });
const canSubmitSecondaryConfirm = computed(() => {
      return isFillStage.value &&
        canEditFill.value &&
        isSubmitOverviewMode.value &&
        !isAnyModuleLoading.value &&
        !hasModuleLoadErrors.value &&
        !state.ownerSubmitting &&
        !state.stageFinalSubmitting &&
        !hasSubmittedOwnerFillRecord.value;
  });
const canSubmitStageFinal = computed(() => {
      return showStageFinalSubmitAction.value &&
        !state.ownerSubmitting &&
        !state.stageFinalSubmitting &&
        !isAnyModuleLoading.value &&
        !hasModuleLoadErrors.value &&
        isSubmitOverviewMode.value &&
        Boolean(state.stageCompletionSummary && state.stageCompletionSummary.ok);
  });
const isSubmitBlocking = computed(() => {
      return state.ownerSubmitting ||
        state.stageFinalSubmitting ||
        state.fillCellOpinionSubmitting;
  });
const pageBlocking = computed(() => {
      return state.loading || isSubmitBlocking.value;
  });
const pageBlockingText = computed(() => {
      return isSubmitBlocking.value ? "提交处理中，请勿重复操作" : "加载中";
  });
const stageCompletionRows = computed(() => {
      const modules =
        state.stageCompletionSummary && Array.isArray(state.stageCompletionSummary.modules)
          ? state.stageCompletionSummary.modules
          : [];
      return modules;
  });
const stageCompletionStatusText = computed(() => {
      if (!state.stageCompletionSummary) return "正在检查";
      return state.stageCompletionSummary.ok
        ? "可最终提交"
        : state.stageCompletionSummary.message || "存在阻塞项";
  });
const canUseTestFill = computed(() => {
      return false;
  });
const hasWritableSubjects = computed(() => {
      return Object.keys(state.writableSubjectMap || {}).length > 0;
  });
const historyImportItems = computed(() => {
      return Array.isArray(state.historyImportPreview.items)
        ? state.historyImportPreview.items
        : [];
  });
const historyImportPreviewMessage = computed(() => {
      return String(state.historyImportPreview.message || "").trim();
  });
const historyImportOverwriteCount = computed(() => {
      return Number(state.historyImportPreview.overwriteCount || 0);
  });
const canApplyHistoryImport = computed(() => {
      const importableCount = Number(state.historyImportPreview.importableCount || 0);
      if (!importableCount || state.historyImportLoading || state.historyImportApplying) return false;
      if (historyImportOverwriteCount.value > 0 && !state.historyImportOverwriteConfirmed) return false;
      return true;
  });
const canCopyPreviousYearData = computed(() => {
      return canEditFill.value &&
        !isS3ConfirmationStage.value &&
        state.viewMode === "year" &&
        !isLifecycleYearActive.value &&
        activeRealYearIndex.value > 0 &&
        (dimensions.value.years || []).length > 1;
  });
const canDeleteActiveYear = computed(() => {
      return canEditFill.value &&
        !isS3ConfirmationStage.value &&
        state.viewMode === "year" &&
        !isLifecycleYearActive.value &&
        (dimensions.value.years || []).length > 1;
  });
const dimensions = computed(() => {
      return state.detail.dimensions || { years: [], trims: [] };
  });
const trimOptions = computed(() => {
      const list = Array.isArray(state.detail.trimOptions) ? state.detail.trimOptions : [];
      if (list.length) {
        return list
          .map((item: any, index: any) => {
            if (!item || typeof item !== "object") return null;
            const trimId = String(item.trimId || item.id || item.code || item.name || "").trim();
            if (!trimId) return null;
            return {
              trimId,
              trimName: String(item.trimName || item.name || item.label || trimId).trim() || trimId,
              trimIndex: Number.isInteger(item.trimIndex) ? Number(item.trimIndex) : index,
            };
          })
          .filter(Boolean);
      }

      return (dimensions.value.trims || []).map((trimName: any, index: any) => ({
        trimId: String(trimName || `trim_${index + 1}`).trim(),
        trimName: String(trimName || `版型${index + 1}`).trim(),
        trimIndex: index,
      }));
  });
const _isRndExpenseDetail = computed(() => {
      const rows = Array.isArray(state.detail.rows) ? state.detail.rows : [];
      return rows.some((row: any) => isRndExpenseRow(row));
  });
const rndInvestmentAmountColumns = computed(() => {
      return buildRndInvestmentAmountColumns();
  });
const displayYearOptions = computed(() => {
      return buildDisplayYearOptions(dimensions.value.years || []);
  });
const activeYearOption = computed(() => {
      const options = state.displayYearOptions;
      const key = String(state.activeYearKey || "").trim();
      return (
        options.find((item: any) => item.key === key) ||
        options.find((item: any) => item.yearIndex === state.activeYearIndex) ||
        options[0] ||
        null
      );
  });
const isLifecycleYearActive = computed(() => {
      return Boolean(activeYearOption.value && activeYearOption.value.lifecycle);
  });
const activeRealYearIndex = computed(() => {
      if (isLifecycleYearActive.value) return -1;
      const option = activeYearOption.value;
      if (option && Number.isInteger(option.yearIndex)) return option.yearIndex;
      const years = dimensions.value.years || [];
      return Math.min(Math.max(state.activeYearIndex, 0), Math.max(years.length - 1, 0));
  });
const activeYearLabel = computed(() => {
      if (isLifecycleYearActive.value) return "全生命周期";
      const years = dimensions.value.years || [];
      const index = Math.min(Math.max(activeRealYearIndex.value, 0), Math.max(years.length - 1, 0));
      return years[index] || "";
  });
const activeYearTrimIds = computed(() => {
      const year = String(activeYearLabel.value || "").trim();
      if (!year) return [];
      const configured = state.localYearTrimConfig[year];
      if (Array.isArray(configured) && configured.length) {
        return configured.slice();
      }
      return (trimOptions as any).value.map((item: any) => item.trimId);
  });
const projectTitle = computed(() => {
      const projectNo = state.project.projectNo || queryProjectCode.value;
      const projectName = state.project.projectName || queryProjectName.value || "收益测算项目";
      const gate = state.project.gate || queryValve.value;
      return `${projectNo} / ${projectName}（阀点 ${gate}）`;
  });
const writableSubjectCount = computed(() => {
      const rows = filteredRows.value || [];
      return rows.filter((row: any) => !cellEditing.isComputedRow(row)).length;
  });
const subjectCountLabel = computed(() => {
      if (currentStageCode.value === "S3") return "待确认科目";
      return isFillStage.value ? "可填科目" : "科目数";
  });
const subjectCountValue = computed(() => {
      return isFillStage.value ? writableSubjectCount.value : (filteredRows.value || []).length;
  });
const emptyModuleText = computed(() => {
      if (currentStageCode.value === "S3") return "当前模块暂无待确认科目";
      return isFillStage.value ? "当前模块暂无可填科目" : "当前模块暂无科目";
  });
const emptyStateText = computed(() => {
      if (currentStageCode.value === "S3") return "当前用户暂无待确认科目";
      return isFillStage.value ? "当前用户暂无可填科目" : "当前暂无科目";
  });
const filteredRows = computed(() => {
      return resolveVisibleFillRows(state, canEditFill.value);
  });
// 导入逻辑读 state.filteredRows；页面展示用 computed，需同步避免「暂无可导入模板」
watch(
  filteredRows,
  (rows) => {
    state.filteredRows = Array.isArray(rows) ? rows : [];
  },
  { immediate: true },
);
const moduleSections = computed(() => {
      return buildRevenueModuleSections(filteredRows.value).map((section: any) => ({
        ...section,
        treeRows: buildSubjectTreeRows(section.rows, {
          collapsedMap: state.collapsedSubjectTreeMap,
          parentDisplayMap: parentSubjectDisplayMap.value,
          keyPrefix: section.key,
        }),
      }));
  });
const parentSubjectDisplayMap = computed(() => {
      const map = state.detail && state.detail.parentSubjectDisplay;
      if (!map || typeof map !== "object" || Array.isArray(map)) return {};
      return map;
  });
const _visibleActiveColumns = computed(() => {
      return activeColumns.value.filter((column: any) => !isHiddenSubtotalColumn(column));
  });
const activeColumns = computed(() => {
      const years = dimensions.value.years || [];
      const cols: any[] = [];

      if (state.viewMode === "overview") {
        years.forEach((year: any, yi: any) => {
          const yearColumns: any[] = [];
          resolveYearTrimOptions(yi).forEach((trim: any) => {
            const column = {
              key: `y${yi}_t${(trim as any).trimId}`,
              label: (trim as any).trimName,
              yearLabel: year,
              yearIndex: yi,
              trimId: (trim as any).trimId,
              trimIndex: (trim as any).trimIndex,
              real: true,
              displayOnly: false,
              aggregateMode: "NONE",
            };
            cols.push(column);
            yearColumns.push(column);
          });
          const subtotalColumn = buildYearSubtotalColumn(year, yi, yearColumns, {
            sourceRows: formulaRecalc.getAggregateSourceRows(),
          });
          cols.push(subtotalColumn);
        });
        if (years.length > 1) {
          const lifecycleTrimColumns = buildLifecycleTrimColumns();
          cols.push(...lifecycleTrimColumns);
          cols.push(buildLifecycleSubtotalColumn(lifecycleTrimColumns));
        }
        return cols;
      }

      if (state.viewMode === "trim") {
        const activeTrim =
          (trimOptions as any).value.find((item: any) => item.trimId === state.activeTrimId) ||
          trimOptions.value[0] ||
          null;
        if (!activeTrim) return cols;
        years.forEach((year: any, yi: any) => {
          const exists = resolveYearTrimOptions(yi).some(
            (item: any) => (item as any).trimId === activeTrim.trimId
          );
          if (!exists) return;
          cols.push({
            key: `y${yi}_t${activeTrim.trimId}`,
            label: year,
            yearLabel: year,
            yearIndex: yi,
            trimId: activeTrim.trimId,
            trimIndex: activeTrim.trimIndex,
            real: true,
            displayOnly: false,
            aggregateMode: "NONE",
          });
        });
        if (cols.length > 1) {
          cols.push(buildLifecycleColumn(cols, {
            key: `lifecycle_${activeTrim.trimId}`,
            label: "全生命周期",
            trimId: activeTrim.trimId,
            trimName: activeTrim.trimName,
            trimIndex: activeTrim.trimIndex,
            sourceRows: formulaRecalc.getAggregateSourceRows(),
            allSourceColumns: formulaRecalc.buildAllRealColumns(),
          }));
        }
        return cols;
      }

      if (isLifecycleYearActive.value) {
        const lifecycleTrimColumns = buildLifecycleTrimColumns();
        cols.push(...lifecycleTrimColumns);
        cols.push(buildLifecycleSubtotalColumn(lifecycleTrimColumns));
        return cols;
      }

      const yearIndex = Math.min(Math.max(activeRealYearIndex.value, 0), Math.max(years.length - 1, 0));
      const yearColumns: any[] = [];
      resolveYearTrimOptions(yearIndex).forEach((trim: any) => {
        const column = {
          key: `y${yearIndex}_t${(trim as any).trimId}`,
          label: (trim as any).trimName,
          yearLabel: years[yearIndex] || "",
          yearIndex,
          trimId: (trim as any).trimId,
          trimIndex: (trim as any).trimIndex,
          real: true,
          displayOnly: false,
          aggregateMode: "NONE",
        };
        cols.push(column);
        yearColumns.push(column);
      });
      if (yearColumns.length > 0) {
        cols.push(buildYearSubtotalColumn(years[yearIndex] || "", yearIndex, yearColumns, {
          sourceRows: formulaRecalc.getAggregateSourceRows(),
        }));
      }
      return cols;
  });
const subtableProgress = computed(() => {
      // 显式依赖提交/锁定 map，保证提交后进度表立刻重算
      void state.s1ModuleSubmitMap;
      void state.s1ModuleOpinionLockedMap;
      void state.s1ModuleOpinionDraftMap;
      const buildRows = () => buildModuleProgressRows(moduleSections.value);
      if (!canEditFill.value) {
        const progress = Array.isArray(state.detail.subtableProgress)
          ? state.detail.subtableProgress
          : [];
        if (!progress.length) return buildRows();
        return progress.map((item: any) => {
          const module = resolveModuleSectionBySource(item);
          if (!module) return item;
          return {
            ...item,
            key: module.key,
            moduleKey: module.moduleKey,
            rootSubjectId: module.rootSubjectId,
            rootSubjectName: module.rootSubjectName,
            moduleName: module.moduleName,
            subtable: (item as any).subtable || resolveModuleSubtableName(module),
          };
        });
      }
      return buildRows();
  });

// ---- watch ----
watch(
  () => state.activeYearIndex,
  () => {
    formulaRecalc.scheduleManagementRateInputScopeDiagnostics();
  }
);
watch(
  () => state.activeYearKey,
  () => {
    formulaRecalc.scheduleManagementRateInputScopeDiagnostics();
  }
);
watch(
  () => state.activeTrimId,
  () => {
    formulaRecalc.scheduleManagementRateInputScopeDiagnostics();
  }
);
watch(
  () => state.viewMode,
  () => {
    formulaRecalc.scheduleManagementRateInputScopeDiagnostics();
  }
);

// 同步路由查询参数到 state（loadPage 依赖 state.query*，路由参数解析见上方 query* computed）
function syncQueryParamsToState() {
  state.queryProjectId = queryProjectId.value;
  state.queryFlowId = queryFlowId.value;
  state.activeFlowId = activeFlowId.value;
  state.queryProjectCode = queryProjectCode.value;
  state.queryProjectName = queryProjectName.value;
  state.queryUserId = queryUserId.value;
  state.queryUserName = queryUserName.value;
  state.queryOwnerUserId = queryOwnerUserId.value;
  state.queryPermissionKey = queryPermissionKey.value;
  state.queryStage = queryStage.value;
  state.queryValve = queryValve.value;
  // 填报页始终按子表域处理：URL 常误带 subjectDomain=main，会导致公式源跳过/科目树裁剪异常
  // （壳层 query 本身也不透传 domain，与 Vue2 一致）
  state.querySubjectDomain = AUDIT_DOMAIN.SUBTABLE;
  state.querySubjectApiMode = querySubjectApiMode.value;
  state.hasAllPermission = hasAllPermission.value;
}

/** 记录归属是否为当前用户（兼容数字 userId 与登录名 ownerId） */
function matchesCurrentRecordOwner(ownerId: unknown) {
  const owner = String(ownerId == null ? "" : ownerId).trim();
  if (!owner) return true;
  const numericId = String(state.currentUser || state.queryUserId || "").trim();
  const loginName = String(state.queryOwnerUserId || "").trim();
  return owner === numericId || (Boolean(loginName) && owner === loginName);
}

/** 对齐列表进详情权限：无当前阶段操作权限时禁止加载 S1/S3 填报页 */
function ensureStageEntryPermission() {
  const stage = String(
    currentStageCode.value || queryStage.value || "",
  )
    .trim()
    .toUpperCase();
  if (stage === "S3") {
    if (
      hasS3FlowConfirmPermission.value ||
      hasS3FlowViewPermission.value ||
      hasS3FlowSubmitPermission.value
    ) {
      return true;
    }
    BaseToast.warning("缺少 S3 操作权限");
    router.replace("/revenue/project-list").catch(() => undefined);
    return false;
  }
  if (stage === "S1") {
    if (
      hasS1FlowFillPermission.value ||
      hasS1FlowViewPermission.value ||
      hasS1FlowSubmitPermission.value
    ) {
      return true;
    }
    BaseToast.warning("缺少 S1 操作权限");
    router.replace("/revenue/project-list").catch(() => undefined);
    return false;
  }
  return true;
}

// ---- lifecycle hooks ----
onMounted(() => {
  syncQueryParamsToState();
  runtimeFlagsForward.sync();
  if (!ensureStageEntryPermission()) return;
  moduleLoading.loadPage();
  document.addEventListener("click", s3Confirmation.handleDocumentClickForS3Popover);
  document.addEventListener("click", cellEditing.handleDocumentClickForCellPopover);
});

// route.query 变化（如 mode 切换 router.replace）时同步查询参数，flush: sync 保证 loadPage 前已更新
watch(
  () => route.query,
  () => {
    syncQueryParamsToState();
  },
  { flush: "sync" }
);

onBeforeUnmount(() => {
  document.removeEventListener("click", s3Confirmation.handleDocumentClickForS3Popover);
  document.removeEventListener("click", cellEditing.handleDocumentClickForCellPopover);
  formulaRecalc.cancelScheduledFormulaRecalc();
});

// ---- methods ----
function isHiddenSubtotalColumn(_column: any) {
      return false;
  }

/** 包装 matrix-utils：补齐年份/版型参数，避免总览切换时列为空或 ReferenceError */
function buildLifecycleTrimColumns() {
  const years = dimensions.value.years || [];
  const trims = (trimOptions.value && trimOptions.value.length)
    ? trimOptions.value
    : (dimensions.value.trims || []);
  return matrixBuildLifecycleTrimColumns(years, trims, {
    sourceRows: formulaRecalc.getAggregateSourceRows(),
    resolveYearTrimOptions,
  });
}

function buildLifecycleSubtotalColumn(lifecycleTrimColumns: unknown[] = []) {
  return matrixBuildLifecycleSubtotalColumn(lifecycleTrimColumns, {
    sourceRows: formulaRecalc.getAggregateSourceRows(),
  });
}

    // 统一模式组件回调：edit↔编辑（S1 填报/S3 二次确认），view_submit↔查看提交
function onFlowPageModeChange(mode: string) {
      const unified = String(mode || "").trim();
      if (currentStageCode.value === "S3") {
        return onS3PageModeChange(unified === "edit" ? "confirm" : "submit");
      }
      return onS1PageModeChange(unified === "edit" ? "fill" : "submit");
  }
async function onS3PageModeChange(mode: string) {
      if (!isS3FlowPermissionEntry.value) return;
      const nextMode = String(mode || "").trim();
      // 查看提交态:有提交权走 stage_final_submit,否则退化为只读查看
      const action = nextMode === "submit"
        ? (hasS3FlowSubmitPermission.value ? "stage_final_submit" : "view")
        : "confirm";
      if (s3FlowActionKey.value === action) return;
      const query = {
        ...route.query,
        action,
      };
      if (action === "stage_final_submit") {
        (query as any).subjectApiMode = "all";
      } else if ((query as any).subjectApiMode === "all") {
        delete (query as any).subjectApiMode;
      }
      try {
        await router.replace({ path: route.path, query });
      } catch (_error) {
        // 重复导航不影响重新加载当前页模式。
      }
      await moduleLoading.loadPage();
  }
async function onS1PageModeChange(mode: string) {
      if (!isS1FlowPermissionEntry.value) return;
      const nextMode = String(mode || "").trim();
      const action = nextMode === "submit"
        ? (hasS1FlowSubmitPermission.value ? "stage_final_submit" : "view")
        : "open_fill";
      if (s1FlowActionKey.value === action) return;
      const query = {
        ...route.query,
        action,
      };
      if (action === "stage_final_submit") {
        (query as any).subjectApiMode = "all";
      } else if ((query as any).subjectApiMode === "all") {
        delete (query as any).subjectApiMode;
      }
      try {
        await router.replace({ path: route.path, query });
      } catch (_error) {
        // 重复导航不影响重新加载当前页模式。
      }
      await moduleLoading.loadPage();
    }

    // normalizePositiveNumber / appendUniquePositiveNumber 已提取为模块级纯函数

function rowAllActionColumns(row: import("@/types/revenue").MatrixRow) {
      if (isYearOnlyRow(row)) return buildYearOnlyColumns.value;
      return decorateRndInvestmentColumns(formulaRecalc.buildAllRealColumns(), row);
    }

async function onReeditS1Subtable(source: Record<string, unknown> = {}) {
      if (!s1ModuleFlow.canReeditS1Subtable(source)) return;
      const targets = s1ModuleFlow.collectS1SubtableSubmittedTargets(source);
      const identity = s1ModuleFlow.resolveS1ModuleIdentity(source);
      const moduleName = identity.moduleName || s1ModuleFlow.resolveS1SubtableDisplayName(source);
      const previousOpinion = String(s1ModuleFlow.resolveS1ModuleOpinion(source) || "");
      const restoreTarget = {
        rootSubjectId: identity.rootSubjectId,
        moduleKey: identity.moduleKey,
        moduleName,
        name: moduleName,
      };
      let reeditOpinion: string;
      try {
        const promptResult = await ElMessageBox.prompt(
          `确认将"${moduleName}"转为可重新编辑吗？请填写重新编辑处理意见。`,
          "重新编辑确认",
          {
            confirmButtonText: "确认重新编辑",
            cancelButtonText: "取消",
            inputType: "textarea",
            inputPlaceholder: "请输入重新编辑处理意见",
            inputValidator(value) {
              return String(value || "").trim() ? true : "请填写重新编辑处理意见";
            },
            type: "warning",
          }
        );
        reeditOpinion = String((promptResult && promptResult.value) || "").trim();
      } catch (_error) {
        return;
      }
      state.s1SubtableActionLoadingKey = s1ModuleFlow.resolveS1SubtableActionKey(source, "reedit");
      try {
        await waitForPendingDraftOperations();
        const baseParams = {
          ...buildSaveDraftParams(),
          targetRecordIds: targets.targetRecordIds,
          targetSubmitIds: targets.targetSubmitIds,
          moduleName,
          rootSubjectId: identity.rootSubjectId,
          moduleKey: identity.moduleKey,
          opinion: previousOpinion,
          submitRemark: reeditOpinion,
        };
        const result = await cancelS1SubtableSubmit(baseParams);
        if (!result || !result.ok) {
          BaseToast.warning((result && result.message) || "重新编辑失败");
          return;
        }
        BaseToast.success("已允许重新编辑");
        const moduleSection = resolveModuleSectionBySource(source) || source;
        try {
          await loadS1ModuleReviewState({
            ...buildSaveDraftParams(),
            userId: state.currentUser || state.queryUserId,
          });
        } catch (error) {
          console.warn("[onReeditS1Subtable] loadS1ModuleReviewState failed", error);
        }
        try {
          await retryLoadModule(moduleSection as import("@/types/revenue").ModuleSection);
        } catch (error) {
          console.warn("[onReeditS1Subtable] retryLoadModule failed", error);
          BaseToast.warning("重新编辑成功，但本子表数据刷新失败，请点「重试加载」");
        }
        s1ModuleFlow.restoreS1ModuleOpinionAfterReedit(restoreTarget as any, previousOpinion);
        try {
          await refreshStageCompletionSummary();
        } catch (_error) {
          // 进度表刷新失败不阻断重新编辑
        }
      } finally {
        state.s1SubtableActionLoadingKey = "";
      }
    }

function openS1ModuleDataImportDialog(section: Record<string, unknown> = {}) {
      if (!s1ModuleFlow.canImportS1ModuleDraft(section)) return;
      const identity = s1ModuleFlow.resolveS1ModuleIdentity(section);
      const options = dataImportRootSubjectOptions.value || [];
      const matched = options.find((item: any) => {
        const rootSubjectId = String(item.rootSubjectId || item.id || "").trim();
        const rootSubjectName = String(item.rootSubjectName || item.label || "").trim();
        return (
          (identity.rootSubjectId && rootSubjectId === identity.rootSubjectId) ||
          rootSubjectName === String(identity.moduleName || "").trim() ||
          String(item.id || "").trim() === String(identity.moduleKey || "").trim()
        );
      });
      if (matched) {
        state.dataImportRootSubjectId = matched.id;
      }
      dataImport.openDataImportDialog();
    }

async function saveS1ModuleDraft(section: Record<string, unknown> = {}) {
      if (!s1ModuleFlow.canSaveS1ModuleDraft(section)) return null;
      const identity = s1ModuleFlow.resolveS1ModuleIdentity(section);
      state.s1SubtableActionLoadingKey = s1ModuleFlow.resolveS1SubtableActionKey(section, "save-draft");
      try {
        const result = await saveSubtableDraftQueued(s1ModuleFlow.buildS1ModuleSaveParams(section, {
          submitRemark: `S1_MODULE_DRAFT_${identity.moduleName}`,
        }));
        if (!result || !result.ok) {
          BaseToast.error((result && result.message) || "本子表草稿保存失败");
          return null;
        }
        const targetRecordIds = Array.isArray(result.affectedRecordIds) ? result.affectedRecordIds : [];
        if (targetRecordIds.length) {
          s1ModuleFlow.writeS1ModuleMap("s1ModuleDraftTargetMap", section, {
            targetRecordIds,
            targetSubmitIds: result.submitId ? [result.submitId] : [],
          });
        }
        state.detail["lastSavedAt"] = (result && result.savedAt) || "-";
        state.detail["lastSavedBy"] = state.currentUserName || state.currentUser || "-";
        await moduleLoading.refreshStageCompletionSummary();
        BaseToast.success(`已保存本子表草稿：${displayUiText(identity.moduleName)}`);
        dataImport.finalizeDataImportSessionAfterDraftSave({ section });
        return result;
      } finally {
        state.s1SubtableActionLoadingKey = "";
      }
    }

    // 前序节点针对本子表的意见(填报/审核/主表审核),展示在该子表意见录入框上方
function resolvePriorOpinionsForModule(section: Record<string, unknown> = {}) {
      return buildModulePriorOpinionCards(
        state.flowOpinionItems,
        s1ModuleFlow.resolveS1ModuleIdentity(section),
        currentStageCode.value
      );
  }
    // S3 业务经理二次确认:按子表录入/保存二次确认意见(意见草稿,不改提交生命周期)
function shouldShowS3ModuleOpinionCard(section: Record<string, unknown> = {}) {
      return currentStageCode.value === "S3" &&
        isS3FlowPermissionEntry.value &&
        !isMainPnlSection(section) &&
        Boolean(s1ModuleFlow.resolveS1ModuleIdentity(section).moduleKey);
  }
function resolveS3ModuleOpinionKey(section: Record<string, unknown> = {}) {
      return s1ModuleFlow.resolveS1ModuleIdentity(section).moduleKey;
  }
function resolveS3ModuleOpinion(section: Record<string, unknown> = {}) {
      const key = resolveS3ModuleOpinionKey(section);
      if (Object.prototype.hasOwnProperty.call(state.s3ModuleOpinionDraftMap, key)) {
        return String(state.s3ModuleOpinionDraftMap[key] || "");
      }
      return String(state.s3ModuleOpinionMap[key] || "");
  }
function setS3ModuleOpinion(section: Record<string, unknown> = {}, value = "") {
      const key = resolveS3ModuleOpinionKey(section);
      state.s3ModuleOpinionDraftMap[key] = String(value == null ? "" : value);
  }
function isS3ModuleOpinionSaved(section: Record<string, unknown> = {}) {
      const key = resolveS3ModuleOpinionKey(section);
      return Object.prototype.hasOwnProperty.call(state.s3ModuleOpinionMap, key) &&
        String(state.s3ModuleOpinionMap[key] || "").trim() !== "";
  }
function isS3ModuleOpinionReediting(section: Record<string, unknown> = {}) {
      return Boolean(state.s3ModuleOpinionReeditMap[resolveS3ModuleOpinionKey(section)]);
  }
function isS3ModuleOpinionLocked(section: Record<string, unknown> = {}) {
      return isS3ModuleOpinionSaved(section) && !isS3ModuleOpinionReediting(section);
  }
function enableS3ModuleOpinionReedit(section: Record<string, unknown> = {}) {
      state.s3ModuleOpinionReeditMap[resolveS3ModuleOpinionKey(section)] = true;
  }
function canEditS3ModuleOpinion(section: Record<string, unknown> = {}) {
      return currentStageCode.value === "S3" &&
        canEditFill.value &&
        !isMainPnlSection(section) &&
        !isS3ModuleOpinionLocked(section);
  }
function isS3ModuleOpinionSaving(section: Record<string, unknown> = {}) {
      return state.s3ModuleOpinionSavingKey === resolveS3ModuleOpinionKey(section);
  }
async function saveS3ModuleOpinion(section: Record<string, unknown> = {}) {
      if (!canEditS3ModuleOpinion(section)) return;
      const identity = s1ModuleFlow.resolveS1ModuleIdentity(section);
      const s2Submit = s1ModuleFlow.resolveS2ModuleSubmit(section);
      const opinion = String(resolveS3ModuleOpinion(section) || "").trim();
      if (!opinion) {
        BaseToast.warning("请先填写二次确认意见");
        return;
      }
      state.s3ModuleOpinionSavingKey = identity.moduleKey;
      try {
        const result = await saveSubtableAuditModuleOpinion({
          ...buildSaveContextParams(),
          userName: state.currentUserName || state.currentUser,
          stage: "S3",
          stageCode: "S3",
          subjectDomain: AUDIT_DOMAIN.SUBTABLE,
          rootSubjectId: identity.rootSubjectId,
          moduleName: identity.moduleName,
          moduleKey: identity.moduleKey,
          targetRecordIds: Array.isArray(s2Submit && (s2Submit as any).targetRecordIds)
            ? (s2Submit as any).targetRecordIds
            : [],
          targetSubmitIds: Array.isArray(s2Submit && (s2Submit as any).targetSubmitIds)
            ? (s2Submit as any).targetSubmitIds
            : [],
          opinion,
        });
        if (!result || result.ok === false) {
          BaseToast.warning((result && result.message) || "二次确认意见保存失败");
          return;
        }
        state.s3ModuleOpinionMap[identity.moduleKey] = opinion;
        delete state.s3ModuleOpinionDraftMap[identity.moduleKey];
        // 保存后锁定,需点「重新编辑」才能再改(对齐 S2)
        delete state.s3ModuleOpinionReeditMap[identity.moduleKey];
        BaseToast.success(`已保存二次确认意见：${displayUiText(identity.moduleName)}`);
      } catch (error) {
        BaseToast.warning((error && (error as any).message) || "二次确认意见保存失败");
      } finally {
        state.s3ModuleOpinionSavingKey = "";
      }
  }
function isS1ModuleSubmitDisabled(section: Record<string, unknown> = {}) {
      return !s1ModuleFlow.canSubmitS1Module(section) || !isSubmitOverviewMode.value;
    }

function resolveS1ModuleSubmitButtonHint(section: Record<string, unknown> = {}) {
      const hint = s1ModuleFlow.resolveS1ModuleSubmitHint(section);
      if (hint) return hint;
      if (!isSubmitOverviewMode.value) {
        return "请切换到总览，确认全部年份与版型后再提交";
      }
      return "";
    }

async function submitS1Module(section: Record<string, unknown> = {}, emittedOpinion: unknown = "") {
      if (!s1ModuleFlow.canSubmitS1Module(section)) return;
      if (!isSubmitOverviewMode.value) {
        BaseToast.warning("请切换到总览，确认全部年份与版型后再提交");
        return;
      }
      if (emittedOpinion != null && String(emittedOpinion).trim()) {
        s1ModuleFlow.setS1ModuleOpinion(section, String(emittedOpinion));
      }
      const identity = s1ModuleFlow.resolveS1ModuleIdentity(section);
      const opinion = String(s1ModuleFlow.resolveS1ModuleOpinion(section) || "").trim();
      if (!opinion) {
        BaseToast.warning(`请先填写${s1ModuleFlow.resolveS1ModuleOpinionTitle(section)}`);
        return;
      }
      pendingS1Submit = { section, opinion };
      s1SubmitConfirm.message = `确认提交“${displayUiText(identity.moduleName)}”吗？提交后该表将只读，需重新编辑后才能修改。`;
      s1SubmitConfirm.visible = true;
    }

function cancelS1ModuleSubmitConfirm() {
      pendingS1Submit = null;
      s1SubmitConfirm.visible = false;
    }

function confirmS1ModuleSubmit() {
      const pending = pendingS1Submit;
      const section = pending && pending.section;
      const opinion = pending ? String(pending.opinion || "").trim() : "";
      pendingS1Submit = null;
      s1SubmitConfirm.visible = false;
      if (!section || !opinion) {
        BaseToast.warning("请先填写填报意见");
        return;
      }
      BaseToast.info("正在提交…");
      // 不 await：避免确认层卸载后把后续请求逻辑一起丢掉
      void executeS1ModuleSubmit(section, opinion);
    }

async function executeS1ModuleSubmit(section: Record<string, unknown>, opinion: string) {
      state.s1SubtableSubmittingKey = s1ModuleFlow.resolveS1SubtableActionKey(section, "submit");
      try {
        // 草稿队列最多等 300ms，避免卡住导致后面的提交接口发不出去
        await Promise.race([
          waitForPendingDraftOperations(),
          new Promise((resolve) => window.setTimeout(resolve, 300)),
        ]);
        const latestSubmitCheck = await moduleLoading.ensureS1ModuleCanSubmitLatest(section);
        if (!latestSubmitCheck || !latestSubmitCheck.ok) {
          BaseToast.warning(
            (latestSubmitCheck && latestSubmitCheck.message) ||
              "当前子表状态已变化，请刷新后重试"
          );
          return;
        }
        const result = await submitSubtableFillSecondaryConfirm({
          ...buildSaveDraftParams(),
          ...s1ModuleFlow.buildS1ModuleSaveParams(section),
          detail: state.detail,
          formulaSourceDetail: state.formulaSourceDetail,
        });
        if (!result || !result.ok) {
          BaseToast.warning((result && result.message) || "提交失败");
          return;
        }
        const flowResult = result.result || {};
        const submittedRecordIds: any[] = [];
        ([] as any[]).concat(flowResult.affectedRecordIds || []).forEach((id: any) => {
          appendUniquePositiveNumber(submittedRecordIds, id);
        });
        ([] as any[]).concat(flowResult.affectedRecords || []).forEach((record: any) => {
          appendUniquePositiveNumber(submittedRecordIds, record && (record.id || record.recordId));
        });
        const submitOpinionResult = await submitSubtableAuditModule({
          ...s1ModuleFlow.buildS1ModuleSaveParams(section),
          targetRecordIds: submittedRecordIds,
          targetSubmitIds: flowResult.submitId ? [flowResult.submitId] : [],
          rowIds: s1ModuleFlow.collectS1ModuleVisibleSubjectIds(section),
          submittedBy: state.currentUser,
          submittedName: state.currentUserName || state.currentUser,
          opinion,
          includeReviewerFilter: false,
        });
        if (!submitOpinionResult || !submitOpinionResult.ok) {
          BaseToast.warning((submitOpinionResult && submitOpinionResult.message) || "已提交，填报意见归档失败");
          await moduleLoading.loadPage();
          return;
        }
        await finishS1ModuleSubmitWithoutFullReload(section, result, submitOpinionResult, opinion);
        BaseToast.success(`已提交：${displayUiText(s1ModuleFlow.resolveS1ModuleIdentity(section).moduleName)}`);
        try {
          await moduleLoading.loadPage();
        } catch (error) {
          console.error("[submitS1Module] loadPage failed", error);
          BaseToast.warning("提交成功，但页面刷新失败，请手动刷新");
        }
        await finishS1ModuleSubmitWithoutFullReload(section, result, submitOpinionResult, opinion);
        scrollToModuleHeader(section);
      } catch (error: unknown) {
        console.error("[submitS1Module] unexpected error", error);
        const message =
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: string }).message || "")
            : "";
        BaseToast.warning(message || "提交过程异常，请刷新后重试");
      } finally {
        state.s1SubtableSubmittingKey = "";
      }
    }

function blurCellInputOnEnter(event: KeyboardEvent) {
      const target = event && event.target;
      if (target && typeof (target as any).blur === "function") {
        (target as any).blur();
      }
    }

function resolveModuleTitleNotice(section: Record<string, unknown> = {}) {
      return resolveRevenueModuleTitleNotice(section);
    }

    // normalizeModuleScrollKey 已提取为模块级纯函数

function moduleScrollKeyCandidates(source: Record<string, unknown> = {}) {
      return buildModuleScrollKeyCandidates(source);
    }

function moduleScrollKey(source: Record<string, unknown> = {}) {
      return buildModuleScrollKey(source);
    }

function moduleScrollAliases(source: Record<string, unknown> = {}) {
      return buildModuleScrollAliases(source);
    }

function scrollToModuleHeader(source: Record<string, unknown> = {}) {
      const module = resolveModuleSectionBySource(source) || source;
      const keys = moduleScrollKeyCandidates(module);
      if (!keys.length || !containerRef.value || typeof containerRef.value.querySelectorAll !== "function") return;
      const sections = Array.from(containerRef.value.querySelectorAll("[data-module-scroll-key]"));
      const target = sections.find((item: any) => {
        const key = normalizeModuleScrollKey(item.getAttribute("data-module-scroll-key"));
        if (keys.indexOf(key) !== -1) return true;
        const aliases = String(item.getAttribute("data-module-scroll-aliases") || "")
          .split("|")
          .map((alias: any) => normalizeModuleScrollKey(alias))
          .filter(Boolean);
        return aliases.some((alias: any) => keys.indexOf(alias) !== -1);
      });
      if (!target) {
        BaseToast.warning("未定位到对应模块");
        return;
      }
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

function resolveModuleSectionBySource(source: Record<string, unknown> = {}) {
      return resolveModuleSectionByIdentity(source, moduleSections.value || []);
    }

function resolveModuleSubtableName(module: Record<string, unknown> = {}) {
      const row = ((module.rows as any[]) || [])[0] || ((module.sourceRows as any[]) || [])[0] || {};
      return row.subtable || module.name || "未分组";
    }

function buildModuleProgressRows( modules: any[] = []) {
      return (Array.isArray(modules) ? modules : []).map((module: any) => {
        const rows = Array.isArray(module.rows) ? module.rows : [];
        const item = {
          key: module.key,
          moduleKey: module.moduleKey,
          rootSubjectId: module.rootSubjectId,
          rootSubjectName: module.rootSubjectName,
          moduleName: module.moduleName,
          subtable: resolveModuleSubtableName(module),
          name: module.name || resolveModuleSubtableName(module),
          done: 0,
          total: 0,
        };
        if (isS3ConfirmationStage.value) {
          (item as any).archived = 0;
          rows.forEach((row: any) => {
            const progress = rowS3ConfirmationProgress(row);
            item.done += progress.done;
            item.total += progress.total;
            (item as any).archived += progress.archived;
          });
          return {
            ...item,
            status: resolveS3ModuleProgressStatus(item),
          };
        }
        rows.forEach((row: any) => {
          item.done += rowDoneCount(row);
          item.total += rowTotalCount(row);
        });
        (item as any).moduleSubmitted = s1ModuleFlow.isS1ModuleSubmitted(module);
        (item as any).submitted = (item as any).moduleSubmitted ? item.total : 0;
        return normalizeS1ModuleProgressItem(item);
      });
    }

function _resolveS1ModuleProgressStatus(item: Record<string, unknown> = {}) {
      return resolveS1ModuleProgressStatusGuard(item);
    }

function isMainPnlSection(section: Record<string, unknown> = {}) {
      if (!section || typeof section !== "object") return false;
      if (section.moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
      const sectionText = [
        section.name,
        section.moduleName,
        section.rootSubjectName,
        Array.isArray(section.rootPath) ? section.rootPath.join("/") : "",
      ].filter(Boolean).join("/");
      return /(^|\/)主表(\/|$)/.test(sectionText);
    }

function isYearOnlyRow(row: Record<string, unknown> = {}) {
      const dataRow = subjectTree.resolveMatrixRow(row as any) || row;
      return isRevenueYearOnlyRow(dataRow as any);
    }

function isYearOnlySection(section: Record<string, unknown> = {}) {
      if (!section || typeof section !== "object") return false;
      if (isRevenueYearOnlyRow(section)) return true;
      const rows: any[] = ([] as any[]).concat(Array.isArray(section.rows) ? section.rows : [])
        .concat(Array.isArray(section.sourceRows) ? section.sourceRows : []);
      return rows.some((row: any) => isYearOnlyRow(row));
    }

function isSectionOverviewHeader(section: Record<string, unknown> = {}) {
      return state.viewMode === "overview" && !isYearOnlySection(section);
    }

function canUseDimensionTools(section: Record<string, unknown> = {}) {
      return canEditFill.value &&
        !isAnyModuleLoading.value &&
        !hasModuleLoadErrors.value &&
        !isS3ConfirmationStage.value &&
        !isMainPnlSection(section) &&
        !isYearOnlySection(section);
    }

function canUseYearDimensionTools(section: Record<string, unknown> = {}) {
      return canUseDimensionTools(section) && state.viewMode === "year" && !isLifecycleYearActive.value;
    }

function canCopyPreviousYearDataForSection(section: Record<string, unknown> = {}) {
      return canUseDimensionTools(section) && canCopyPreviousYearData.value;
    }

function canDeleteActiveYearForSection(section: Record<string, unknown> = {}) {
      return canUseDimensionTools(section) && canDeleteActiveYear.value;
    }

function isRndInvestmentAmountColumn(column: Record<string, unknown> = {}) {
      return Boolean(column && (column.rndInvestmentAmount || isRndAmountCellKey(column.cellKey || column.key)));
    }

function isRndExpenseSection(section: Record<string, unknown> = {}) {
      if (!section || typeof section !== "object") return false;
      if (isMainPnlSection(section)) return false;
      if (section.moduleCode === REVENUE_MODULE_CODE.RND_EXPENSE) return true;
      const sectionText = [
        section.name,
        section.moduleName,
        section.rootSubjectName,
        Array.isArray(section.rootPath) ? section.rootPath.join("/") : "",
      ].filter(Boolean).join("/");
      if (/研发投资|研发费用/.test(sectionText)) return true;
      const rows: any[] = ([] as any[]).concat(Array.isArray(section.rows) ? section.rows : [])
        .concat(Array.isArray(section.sourceRows) ? section.sourceRows : []);
      return rows.some((row: any) => isRndExpenseRow(row));
    }

function shouldShowRndInvestmentAmountColumn(context: Record<string, unknown>) {
      if (isMainSubjectDomain.value) return false;
      if (!context || typeof context !== "object") return false;
      if (Array.isArray(context.rows) || Array.isArray(context.sourceRows) || Array.isArray(context.treeRows)) {
        return isRndExpenseSection(context);
      }
      return isRndInvestmentSourceRow(context);
    }

function rndInvestmentAmountColumnsForSection(section: import("@/types/revenue").ModuleSection) {
      if (!shouldShowRndInvestmentAmountColumn(section)) return [];
      return rndInvestmentAmountColumns.value;
    }

function decorateRndInvestmentColumns(columns: import("@/types/revenue").MatrixColumn[] = [], context: Record<string, unknown>) {
      if (!shouldShowRndInvestmentAmountColumn(context)) return columns;
      if ((columns || []).some((column: any) => isRndInvestmentAmountColumn(column))) return columns;
      return rndInvestmentAmountColumns.value.concat(columns);
    }

const buildYearOnlyColumns = computed(() => {
      const years = dimensions.value.years || [];
      return years.map((year: any, yearIndex: any) => ({
        key: `y${yearIndex}_t0`,
        label: year,
        yearLabel: year,
        yearIndex,
        trimId: "",
        trimName: "",
        trimIndex: 0,
        real: true,
        displayOnly: false,
        aggregateMode: "NONE",
        yearOnly: true,
      })).filter((column: any) => String(column.yearLabel || "").trim());
    })

function sectionActiveColumns(section: import("@/types/revenue").ModuleSection) {
      if (isYearOnlySection(section)) return buildYearOnlyColumns.value;
      return decorateRndInvestmentColumns(activeColumns.value, section);
    }

function rowActiveColumns(row: import("@/types/revenue").MatrixRow) {
      if (isYearOnlyRow(row)) return buildYearOnlyColumns.value;
      return decorateRndInvestmentColumns(activeColumns.value, row);
    }

function sectionVisibleActiveColumns(section: import("@/types/revenue").ModuleSection) {
      return sectionActiveColumns(section).filter((column: any) => !isHiddenSubtotalColumn(column));
    }
    sectionVisibleActiveColumnsForward.fn = sectionVisibleActiveColumns;

function sectionOverviewDetailColumns(section: any) {
      return sectionVisibleActiveColumns(section).filter((column: any) => !isRndInvestmentAmountColumn(column));
    }

function sectionOverviewYearHeaders(section: import("@/types/revenue").ModuleSection) {
      if (state.viewMode !== "overview") return [];
      const years = dimensions.value.years || [];
      const columns = sectionOverviewDetailColumns(section);
      const headers = years.map((year: any, index: any) => ({
        key: `year_${index}`,
        label: year,
        colspan: columns.filter((column: any) => column.yearIndex === index).length,
      })).filter((item: any) => item.colspan > 0);
      if (years.length > 1) {
        const lifecycleColumnCount = columns.filter((column: any) => column.yearIndex === -1).length;
        if (lifecycleColumnCount > 0) {
          headers.push({
            key: "lifecycle",
            label: "全生命周期",
            colspan: lifecycleColumnCount,
          });
        }
      }
      return headers;
    }

    function isModeInputRow(row: any) {
      const dataRow = resolveMatrixRow(row);
      return String(dataRow && dataRow.inputType).toLowerCase() === "mode";
    }

    async function onCellChange(row: any, column: any, value: any) {
      const dataRow = resolveMatrixRow(row);
      if (!dataRow || !column) return { ok: false };
      const inputValue = String(value == null ? "" : value);
      const draftKey = buildCellDraftKey(dataRow, column);
      const pending = cellSaveRequestMap[draftKey];
      if (pending && pending.value === inputValue && pending.promise) {
        return pending.promise;
      }
      const promise = queueDraftSaveOperation(() =>
        saveFillCellValue(dataRow, column, inputValue)
      );
      cellSaveRequestMap[draftKey] = {
        value: inputValue,
        promise,
      };
      try {
        return await promise;
      } finally {
        if (cellSaveRequestMap[draftKey] && cellSaveRequestMap[draftKey].promise === promise) {
          delete cellSaveRequestMap[draftKey];
        }
      }
    }

    async function confirmFillCellEditor() {
      if (state.fillCellOpinionSubmitting) return;
      const row = state.fillCellEditor.row;
      const column = state.fillCellEditor.column;
      if (!row || !column) return;
      state.fillCellOpinionSubmitting = true;
      try {
        const opinionResult = await saveCellOpinion(row, column, state.fillCellEditor.opinion, {
          sourceType: "fill_opinion",
          mapName: "fillOpinionMap",
        });
        if (!opinionResult || !opinionResult.ok) {
          BaseToast.warning((opinionResult && opinionResult.message) || "意见保存失败");
          return;
        }
        BaseToast.success("意见已保存");
        closeFillCellEditor();
      } finally {
        state.fillCellOpinionSubmitting = false;
      }
    }

    async function onSaveDraft() {
      const result = await saveSubtableDraftQueued();
      if (!result || !result.ok) {
        BaseToast.error((result && result.message) || "草稿保存失败");
        return;
      }
      BaseToast.success(`草稿已保存：${(result && result.savedAt) || "-"}`);
      dataImport.finalizeDataImportSessionAfterDraftSave();
      await loadPage();
    }

    function openHistoryImportDialog() {
      if (!showHistoryImportAction.value) {
        BaseToast.warning("当前阶段不可导入草稿");
        return;
      }
      state.historyImportDialogVisible = true;
      state.historyImportOverwriteConfirmed = false;
      previewHistoryImport();
    }

    async function previewHistoryImport() {
      if (!state.historyImportDialogVisible || state.historyImportLoading) return;
      state.historyImportLoading = true;
      state.historyImportOverwriteConfirmed = false;
      try {
        const result = await previewSubtableHistoryImport({
          ...buildHistoryImportContextParams(),
          sourceType: state.historyImportSourceType,
        });
        if (!result || !result.ok) {
          state.historyImportPreview = { items: [], message: (result && result.message) || "草稿预览失败" };
          BaseToast.error((result && result.message) || "草稿预览失败");
          return;
        }
        state.historyImportPreview = result;
      } finally {
        state.historyImportLoading = false;
      }
    }

    async function applyHistoryImport() {
      if (!canApplyHistoryImport.value) return;
      if (historyImportOverwriteCount.value > 0) {
        try {
          await ElMessageBox.confirm(
            `本次导入将覆盖 ${historyImportOverwriteCount.value} 个当前已有值，确认导入为草稿？`,
            "确认覆盖",
            {
              confirmButtonText: "导入",
              cancelButtonText: "取消",
              type: "warning",
            }
          );
        } catch (_error) {
          return;
        }
      }

      state.historyImportApplying = true;
      try {
        const result = await applySubtableHistoryImport({
          ...buildHistoryImportContextParams(),
          sourceType: state.historyImportSourceType,
          overwriteExisting: historyImportOverwriteCount.value > 0,
        });
        if (!result || !result.ok) {
          BaseToast.error((result && result.message) || "草稿导入失败");
          return;
        }
        BaseToast.success(`已导入 ${result.savedCount || 0} 个单元格为草稿`);
        state.historyImportDialogVisible = false;
        await loadPage();
      } finally {
        state.historyImportApplying = false;
      }
    }

    function formatHistoryImportDimension( row: any = {}) {
      const parts: any[] = [];
      if (row.modelYear) parts.push(`${row.modelYear}年`);
      if (row.yearAggregateMode && row.yearAggregateMode !== "SPECIFIC") {
        parts.push(row.yearAggregateMode);
      }
      if (row.modelName) parts.push(row.modelName);
      if (row.trimName) parts.push(row.trimName);
      return parts.length ? parts.join(" / ") : "-";
    }

    function formatHistoryImportValue(value: any) {
      const text = String(value == null ? "" : value).trim();
      return text || "-";
    }

    function historyImportItemStatusText( row: any = {}) {
      if (!row.importable) return "不可导入";
      if (row.willOverwrite) return "将覆盖";
      return "可导入";
    }

    async function onCopyPreviousYear( section: any = {}) {
      if (!canCopyPreviousYearData.value || state.copyPreviousYearSaving) return;
      const rows = getSectionRows(section);
      if (!rows.length) {
        BaseToast.warning("当前子表没有可复制的填报数据");
        return;
      }
      const years = state.dimensions.years || [];
      const sourceYear = String(years[state.activeRealYearIndex - 1] || "").trim();
      const targetYear = String(state.activeYearLabel || "").trim();
      const sectionName = displayUiText(section.name || section.moduleName || section.rootSubjectName || "当前子表");
      try {
        await ElMessageBox.confirm(
          `确认将「${sectionName}」中「${sourceYear}」数据复制到「${targetYear}」？当前子表当前年已有值会被覆盖。`,
          "复制上一年",
          {
            confirmButtonText: "复制",
            cancelButtonText: "取消",
            type: "warning",
          }
        );
      } catch (_error) {
        return;
      }

      state.copyPreviousYearSaving = true;
      try {
        const copyResult = copyPreviousYearData(section);
        const changedCount = copyResult.changedCount || 0;
        const cells = buildCopyPreviousYearCellPayloads(copyResult.targets);
        if (!changedCount || !cells.length) {
          BaseToast.success("上一年数据与当前子表当前年一致，无需保存");
          return;
        }
        const result = await saveSubtableCellsQueued({
          submitRemark: "COPY_PREVIOUS_YEAR",
          cells,
        });
        if (!result || !result.ok) {
          BaseToast.error((result && result.message) || "复制后保存失败");
          return;
        }
        state.detail["lastSavedAt"] = (result && result.savedAt || "-");
        state.detail["lastSavedBy"] = state.currentUserName || state.currentUser || "-";
        await refreshStageCompletionSummary();
        BaseToast.success(`已复制本子表上一年数据并保存草稿，共更新 ${changedCount} 个单元格`);
      } finally {
        state.copyPreviousYearSaving = false;
      }
    }

    async function onDeleteActiveYear() {
      if (!canDeleteActiveYear.value) return;
      const yearLabel = String(state.activeYearLabel || "").trim();
      try {
        await ElMessageBox.confirm(
          `确认删除「${yearLabel}」？页面中该年的填报数据会被移除。`,
          "删除年份",
          {
            confirmButtonText: "删除",
            cancelButtonText: "取消",
            type: "warning",
          }
        );
      } catch (_error) {
        return;
      }

      if (!deleteActiveYear({ applyFormulas: applyCurrentDetailFormulas })) return;
      const result = await saveSubtableDraftQueued({
        submitRemark: "DELETE_YEAR",
      });
      if (!result || !result.ok) {
        BaseToast.error((result && result.message) || "删除后保存失败");
        return;
      }
      state.detail["lastSavedAt"] = (result && result.savedAt || "-");
      state.detail["lastSavedBy"] = state.currentUserName || state.currentUser || "-";
      await refreshStageCompletionSummary();
      BaseToast.success(`已删除年份并保存草稿：${yearLabel}`);
    }

    async function onTestFillAllCells() {
      if (!canUseTestFill.value || state.testFilling) return;
      state.testFilling = true;
      try {
        const filled = fillAllTestCells();
        if (!filled) {
          BaseToast.warning("当前没有可填充的真实单元格");
          return;
        }
        const result = await saveSubtableDraftQueued();
        if (!result || !result.ok) {
          BaseToast.error((result && result.message) || "测试数据保存失败");
          return;
        }
        BaseToast.success(`已填充并保存 ${filled} 个测试单元格`);
        await loadPage();
      } finally {
        state.testFilling = false;
      }
    }

    function onYearTrimConfigChange(value: any) {
      const yearKey = String(activeYearLabel.value || "").trim();
      if (!yearKey || yearKey === "全生命周期") return;
      const allTrimIds = (trimOptions as any).value.map((item: any) => item.trimId);
      const next = Array.isArray(value)
        ? value
            .map((item: any) => String(item || "").trim())
            .filter((trimId: any) => trimId && allTrimIds.includes(trimId))
        : [];

      if (!next.length) {
        BaseToast.warning("至少保留一个版型");
        const fallback = allTrimIds.length ? [allTrimIds[0]] : [];
        state.localYearTrimConfig[yearKey] = fallback;
        ensureDetailDimensions();
        state.detail.yearTrimConfig[yearKey] = fallback.slice();
        applyCurrentDetailFormulas();
        return;
      }

      const selected = Array.from(new Set(next));
      state.localYearTrimConfig[yearKey] = selected;
      ensureDetailDimensions();
      state.detail.yearTrimConfig[yearKey] = selected.slice();
      if (state.activeTrimId && !next.includes(state.activeTrimId)) {
        state.activeTrimId = next[0];
      }
      applyCurrentDetailFormulas();
    }

    async function onSubmitSecondaryConfirm() {
      if (state.ownerSubmitting || state.stageFinalSubmitting) return;
      if (!ensureSubmitOverviewMode()) return;
      if (state.isS3ConfirmationStage) {
        const confirmed = await confirmStageFlowSubmit(
          "确认提交本人 S3 业务经理二次确认吗？提交后等待管理经理汇总流转。"
        );
        if (!confirmed) return;
        state.ownerSubmitting = true;
        try {
          await waitForPendingDraftOperations();
          const result = await submitS3OwnerConfirmation({
            ...buildSaveDraftParams(),
            formulaSourceDetail: state.formulaSourceDetail,
            subjectApiMode: "auto",
          });
          if (!result || !result.ok) {
            BaseToast.warning((result && result.message) || "提交二次确认失败");
            return;
          }
          const flowResult = result.result || {};
          if (flowResult.pendingConfirm) {
            BaseToast.success(
              `本人二次确认已提交，等待管理经理确认完成清单后流转至：${displayUiText(flowResult.targetStage || "S4")}`
            );
            await finishOwnerSubmitWithoutFullReload(result, "提交本人二次确认");
            return;
          }
          BaseToast.success(
            `二次确认已提交，已生成 S3 业务经理二次确认主表并流转至：${displayUiText(flowResult.nextStage || "S4")}`
          );
          returnToPreviousPageAfterSubmit();
          return;
        } finally {
          state.ownerSubmitting = false;
        }
      }
      const confirmed = await confirmStageFlowSubmit(
        "确认提交本人 S1 业务经理填报吗？提交后等待管理经理最终提交。"
      );
      if (!confirmed) return;
      state.ownerSubmitting = true;
      try {
        await waitForPendingDraftOperations();
        const result = await submitSubtableFillSecondaryConfirm({
          projectId: state.queryProjectId,
          flowId: state.queryFlowId,
          projectCode: state.queryProjectCode,
          projectName: state.queryProjectName,
          permissionKey: state.queryPermissionKey,
          fullAccess: state.hasAllPermission,
          userId: state.currentUser,
          stage: state.queryStage,
          valve: state.queryValve,
          visibleSubjectIds: buildVisibleSubjectIds(),
          actor: state.currentUserName || state.currentUser,
          detail: state.detail,
          formulaSourceDetail: state.formulaSourceDetail,
        });
        if (!result || !result.ok) {
          BaseToast.warning((result && result.message) || `${submitActionText.value}失败`);
          return;
        }
        if (result.result && result.result.flowAdvanced === false) {
          BaseToast.success(`${submitActionText.value}已保存，等待管理经理最终提交`);
          await finishOwnerSubmitWithoutFullReload(result);
          return;
        } else {
          const flowResult = result.result || {};
          if (flowResult.pendingConfirm) {
            BaseToast.success(
              `${submitActionText.value}已提交，等待第二人确认后流转至：${displayUiText(flowResult.targetStage || "-")}`
            );
          } else {
            BaseToast.success(
              `${submitActionText.value}已提交，流转至：${displayUiText(flowResult.nextStage || "-")}`
            );
          }
        }
        await loadPage();
      } finally {
        state.ownerSubmitting = false;
      }
    }

    function formatStageCompletionIssues( row: any = {}) {
      const issues = Array.isArray(row.issues) ? row.issues : [];
      if (!issues.length) return "-";
      return issues.slice(0, 3).map(displayUiText).join("；") + (issues.length > 3 ? ` 等 ${issues.length} 项` : "");
    }

    async function onSubmitStageFinal() {
      if (!state.showStageFinalSubmitAction || state.stageFinalSubmitting) return;
      if (!ensureSubmitOverviewMode()) return;
      if (!canSubmitStageFinal.value) {
        await refreshStageCompletionSummary();
        BaseToast.warning(
          (state.stageCompletionSummary && state.stageCompletionSummary.message) ||
            "完成清单未通过，不能最终提交"
        );
        return;
      }
      const isS3Final = state.currentStageCode === "S3";
      const confirmed = await confirmStageFlowSubmit(
        isS3Final
          ? "确认生成 S3 业务经理二次确认主表并流转到 S4 品牌财务主表审核吗？"
          : "确认生成 S1 业务经理填报主表并流转到 S2 集团部室审核吗？"
      );
      if (!confirmed) return;
      state.stageFinalSubmitting = true;
      try {
        await waitForPendingDraftOperations();
        const submitAction = isS3Final ? submitS3StageFinal : submitS1StageFinal;
        const result = await submitAction({
          ...buildSaveDraftParams(),
          formulaSourceDetail: state.formulaSourceDetail,
          subjectApiMode: "all",
          // 最终提交 = 系统级聚合，按模板全集取数（含当前用户未授权的来源子表科目）
          subjectScope: "template",
        });
        if (!result || !result.ok) {
          if (result && result.summary) {
            state.stageCompletionSummary = result.summary;
          }
          BaseToast.warning(
            (result && result.message) ||
              (isS3Final ? "S3 业务经理二次确认最终提交失败" : "S1 业务经理填报最终提交失败")
          );
          return;
        }
        const flowResult = result.result || {};
        if (flowResult.pendingConfirm) {
          BaseToast.success(
            isS3Final
              ? `已生成 S3 业务经理二次确认主表，等待第二人确认后流转到：${displayUiText(flowResult.targetStage || "S4")}`
              : `已生成 S1 业务经理填报主表，等待第二人确认后流转到：${displayUiText(flowResult.targetStage || "S2")}`
          );
          await loadPage();
          return;
        }
        BaseToast.success(
          isS3Final
            ? `已生成 S3 业务经理二次确认主表并流转到：${displayUiText(flowResult.nextStage || "S4")}`
            : `已生成 S1 业务经理填报主表并流转到：${displayUiText(flowResult.nextStage || "S2")}`
        );
        returnToPreviousPageAfterSubmit();
      } finally {
        state.stageFinalSubmitting = false;
      }
    }

    /** 解析提交/返回应回到的列表路径（优先入口 fromPath） */
    function resolveReturnListPath() {
      const fromPath = String(route.query.fromPath || "").trim();
      if (fromPath.startsWith("/")) {
        return fromPath.split("?")[0] || "/revenue/project-list";
      }
      const menuKey = String(route.query.menuKey || routeMenuKey || "")
        .trim()
        .toLowerCase();
      const menuPathMap: Record<string, string> = {
        flow_s1: "/revenue/s1",
        flow_s2: "/revenue/flow/s2",
        flow_s3: "/revenue/flow/s3",
        flow_s4: "/revenue/flow/s4",
        flow_s5: "/revenue/flow/s5",
        flow_s6: "/revenue/flow/s6",
        flow_s7: "/revenue/flow/s7",
        flow_s8: "/revenue/flow/s8",
        project_list: "/revenue/project-list",
        meeting_review: "/revenue/meeting-review",
      };
      return menuPathMap[menuKey] || "/revenue/project-list";
    }

    function goBack() {
      // 对齐 Vue2：优先 history.back；无可用历史时回列表（全屏详情页避免停留）
      const listPath = resolveReturnListPath();
      try {
        const historyState = router.options.history.state as
          | { back?: unknown }
          | null
          | undefined;
        if (historyState && historyState.back != null && historyState.back !== "") {
          router.back();
          return;
        }
      } catch (_error) {
        // history.state 异常时走 replace
      }
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
        return;
      }
      router.replace(listPath);
    }

    function getSectionRows( section: any = {}) {
      return section && Array.isArray(section.rows) ? section.rows : [];
    }

    function buildCopyPreviousYearCellPayloads( targets: any[] = []) {
      return (Array.isArray(targets) ? targets : []).map((target: any) => {
        const row = resolveMatrixRow(target && target.row);
        const column = target && target.column;
        const rowSubjectId = resolveRowSubjectId(row);
        const recordMeta = row && column ? getCellRecordMeta(row, column) : null;
        const recordId =
          recordMeta &&
          String(recordMeta.recordStatus || "").toUpperCase() === "DRAFT" &&
          (!recordMeta.ownerId || matchesCurrentRecordOwner(recordMeta.ownerId))
            ? recordMeta.id
            : undefined;
        return {
          moduleCode: row && row.moduleCode,
          moduleName: row && (row.moduleName || row.subtable || row.rootSubjectName),
          subtable: row && row.subtable,
          rootSubjectName: row && row.rootSubjectName,
          fullNamePath: row && row.fullNamePath,
          subjectPath: row && row.subjectPath,
          subject: row && row.subject,
          subjectName: row && row.subjectName,
          unit: row && row.unit,
          rowId: row && (row.id || row.rowId || row.subjectId),
          subjectId: rowSubjectId,
          templateSubjectId: row && row.templateSubjectId,
          expenseSubjectId: row && row.expenseSubjectId,
          year: column && column.yearLabel,
          trimId: column && column.trimId,
          trimName: column && (column.trimName || column.trimId),
          yearIndex: column && column.yearIndex,
          trimIndex: column && column.trimIndex,
          yearAggregateMode: column && column.yearAggregateMode,
          yearOnly: isYearOnlyRow(row),
          value: target && target.value,
          recordId,
        };
      }).filter((item: any) => item && normalizeSubjectId(item.subjectId || item.rowId));
    }

    function copyPreviousYearData( section: any = {}) {
      if (!canCopyPreviousYearData.value) return { changedCount: 0, targets: [] };
      const years = dimensions.value.years || [];
      const targetYearIndex = activeRealYearIndex.value;
      const sourceYearIndex = targetYearIndex - 1;
      const sourceYear = String(years[sourceYearIndex] || "").trim();
      const targetYear = String(years[targetYearIndex] || "").trim();
      if (!sourceYear || !targetYear) return { changedCount: 0, targets: [] };

      const fallbackTrimIds = (trimOptions as any).value.map((item: any) => item.trimId);
      const sourceTrimIds = Array.isArray(state.localYearTrimConfig[sourceYear])
        ? state.localYearTrimConfig[sourceYear].filter((trimId: any) => fallbackTrimIds.includes(trimId))
        : fallbackTrimIds.slice();
      const copyTrimIds = sourceTrimIds.length ? sourceTrimIds : fallbackTrimIds.slice();
      if (!copyTrimIds.length) return { changedCount: 0, targets: [] };

      const copyTrimMap = {};
      copyTrimIds.forEach((trimId: any) => {
        (copyTrimMap as Record<string, any>)[trimId] = true;
      });
      const copyTrims = (trimOptions as any).value.filter((trim: any) => (copyTrimMap as Record<string, any>)[trim.trimId]);
      let changedCount = 0;
      const targets: any[] = [];
      const rows = getSectionRows(section);
      rows.forEach((row: any) => {
        const dataRow = resolveMatrixRow(row);
        if (!isEditableInputRow(dataRow)) return;
        copyTrims.forEach((trim: any) => {
          const sourceColumn = buildRealYearTrimColumn(sourceYearIndex, trim);
          const targetColumn = buildRealYearTrimColumn(targetYearIndex, trim);
          if (!isColumnFillableByInputScope(dataRow, targetColumn)) return;
          const sourceValue = getCellValue(dataRow, sourceColumn);
          const currentValue = getCellValue(dataRow, targetColumn);
          const nextValue = String(sourceValue == null ? "" : sourceValue);
          if (String(currentValue == null ? "" : currentValue) === nextValue) return;
          changedCount += 1;
          updateCellValueLocally(dataRow, targetColumn, nextValue);
          clearCellInputDraft(dataRow, targetColumn);
          targets.push({ row: dataRow, column: targetColumn, value: nextValue });
        });
      });
      if (changedCount > 0) {
        state.localYearTrimConfig[targetYear] = copyTrimIds.slice();
        ensureDetailDimensions();
        state.detail.yearTrimConfig[targetYear] = copyTrimIds.slice();
        applyCurrentDetailFormulas();
        writeStoredYears(state.dimensions.years || []);
      }
      return { changedCount, targets };
    }

    function buildVisibleSubjectIds() {
      const rows = Array.isArray(filteredRows.value) ? filteredRows.value : [];
      const seen = {};
      const result: any[] = [];
      rows.forEach((row: any) => {
        const subjectId = resolveRowSubjectId(row);
        if (!subjectId || (seen as Record<string, any>)[subjectId]) return;
        (seen as Record<string, any>)[subjectId] = true;
        result.push(subjectId);
      });
      return result;
    }

    function buildHistoryImportContextParams() {
      return {
        ...buildSaveContextParams(),
        targetModelYears: historyImportTargetModelYears(),
        targetTrimNames: historyImportTargetTrimNames(),
        targetSubjectIds: historyImportTargetSubjectIds(),
      };
    }

    // 草稿/单元格保存队列不能放进 reactive：Vue3 会把 Promise 包成 Proxy，finally 里 === 失败导致清不掉
    let draftSavePromise: Promise<unknown> | null = null;
    const cellSaveRequestMap: Record<string, { value: string; promise: Promise<unknown> }> = {};

    async function queueDraftSaveOperation(runSave: any) {
      const previousSave = draftSavePromise;
      const nextSave = (previousSave || Promise.resolve())
        .catch(() => null)
        .then(() => runSave());
      draftSavePromise = nextSave;
      try {
        return await nextSave;
      } finally {
        if (draftSavePromise === nextSave) {
          draftSavePromise = null;
        }
      }
    }
    queueDraftSaveOperationForward.fn = queueDraftSaveOperation;

    async function saveSubtableCellsQueued( params: any = {}) {
      return queueDraftSaveOperation(() => saveSubtableFillCells({
        ...buildSaveContextParams(),
        ...params,
      }));
    }

    async function saveCellOpinion(row: any, column: any, opinion: any, options: any = {}) {
      const dataRow = resolveMatrixRow(row);
      if (!dataRow || !column) return { ok: false, message: "未定位到单元格" };
      const existing = readLocalCellOpinion(dataRow, column, options.mapName || "fillOpinionMap");
      const recordMeta = options.recordMeta || getCellRecordMeta(dataRow, column) || {};
      const existingRecordIds =
        existing && Array.isArray(existing.targetRecordIds) ? existing.targetRecordIds : [];
      const recordId = options.recordId || recordMeta.id || existingRecordIds[0];
      const nextOpinion = String(opinion == null ? "" : opinion).trim();
      if (!nextOpinion && !existing) return { ok: true };
      if (!recordId) {
        return { ok: false, message: "请先保存单元格值，再填写意见" };
      }
      const result = await saveSubtableFillCellOpinion(
        buildCellOpinionPayload(dataRow, column, nextOpinion, {
          ...options,
          recordId,
          recordMeta,
        })
      );
      if (!result || !result.ok) return result || { ok: false };
      writeLocalCellOpinion(
        dataRow,
        column,
        {
          ...(existing || {}),
          reviewId: result.reviewId || (existing && existing.reviewId),
          reviewDataSubmitId: result.reviewDataSubmitId || (existing && existing.reviewDataSubmitId),
          opinion: nextOpinion,
          reviewerId: state.currentUser,
          reviewerName: state.currentUserName || state.currentUser,
          sourceType: options.sourceType || "fill_opinion",
          targetRecordIds: [recordId],
          time: result.savedAt,
        },
        options.mapName || "fillOpinionMap"
      );
      return result;
    }

    async function saveFillCellValue(row: any, column: any, value: any, options: any = {}) {
      const dataRow = resolveMatrixRow(row);
      if (isSubjectTreeParent(row) || !dataRow) return { ok: false };
      if (!isSavableMatrixColumn(column)) {
        if (options.showMessage !== false) BaseToast.warning("列小计和生命周期仅用于展示，不保存");
        return { ok: false, message: "列小计和生命周期仅用于展示，不保存" };
      }
      const inputValue = String(value == null ? "" : value);
      const draftKey = buildCellDraftKey(dataRow, column);
      const hasOriginalValue = Object.prototype.hasOwnProperty.call(state.cellInputOriginals, draftKey);
      const currentValue = hasOriginalValue
        ? String(state.cellInputOriginals[draftKey] == null ? "" : state.cellInputOriginals[draftKey])
        : String(getCellValue(row, column) == null ? "" : getCellValue(row, column));
      const valueValidation = validatePercentDisplayInput(
        resolveCellValueRow(dataRow, column),
        inputValue
      );
      if (!valueValidation.ok) {
        if (hasOriginalValue) {
          updateCellValueLocally(dataRow, column, currentValue);
          applyCurrentDetailFormulas();
        }
        clearCellInputDraft(row, column);
        if (options.showMessage !== false) BaseToast.warning(valueValidation.message || "输入值格式不正确");
        return { ok: false, message: valueValidation.message || "输入值格式不正确" };
      }
      const nextValue = valueValidation.value;
      flushScheduledFormulaRecalc();
      logConsumerCreditSaveDebug("保存前", dataRow, column, {
        save: {
          inputValue,
          currentValue,
          nextValue,
        },
      });
      if (nextValue === currentValue) {
        if (hasOriginalValue) {
          updateCellValueLocally(dataRow, column, currentValue);
          const formulaResult = applyCurrentDetailFormulas();
          logConsumerCreditSaveDebug("值未变化-回填原值后重算", dataRow, column, {
            formulaResult,
            save: {
              inputValue,
              currentValue,
              nextValue,
            },
          });
        }
        clearCellInputDraft(row, column);
        const recordMeta = getCellRecordMeta(dataRow, column);
        logConsumerCreditSaveDebug("值未变化-跳过接口", dataRow, column, {
          save: {
            inputValue,
            currentValue,
            nextValue,
            recordMeta,
          },
        });
        return { ok: true, unchanged: true, recordId: recordMeta && recordMeta.id, recordMeta };
      }
      if (isRndInvestmentAmountColumn(column)) {
        const result = await saveRndInvestmentAmountChange(dataRow, column, nextValue);
        if ((!result || !result.ok) && hasOriginalValue) {
          updateCellValueLocally(dataRow, column, currentValue);
          applyCurrentDetailFormulas();
        }
        return result || { ok: false };
      }
      const recordMeta = getCellRecordMeta(row, column);
      const recordId =
        recordMeta &&
        String(recordMeta.recordStatus || "").toUpperCase() === "DRAFT" &&
        (!recordMeta.ownerId || matchesCurrentRecordOwner(recordMeta.ownerId))
          ? recordMeta.id
          : undefined;
      const rowSubjectId = resolveRowSubjectId(dataRow);
      const result = await saveSubtableFillCell({
        projectId: state.queryProjectId,
        flowId: state.queryFlowId,
        projectCode: state.queryProjectCode,
        projectName: state.queryProjectName,
        permissionKey: state.queryPermissionKey,
        fullAccess: state.hasAllPermission,
        userId: state.currentUser,
        stage: state.queryStage,
        valve: state.queryValve,
        visibleSubjectIds: buildVisibleSubjectIds(),
        moduleCode: dataRow.moduleCode,
        moduleName: dataRow.moduleName || dataRow.subtable || dataRow.rootSubjectName,
        subtable: dataRow.subtable,
        rootSubjectName: dataRow.rootSubjectName,
        fullNamePath: dataRow.fullNamePath,
        subjectPath: dataRow.subjectPath,
        subject: dataRow.subject,
        subjectName: dataRow.subjectName,
        unit: dataRow.unit,
        rowId: dataRow.id,
        subjectId: rowSubjectId,
        templateSubjectId: dataRow.templateSubjectId,
        expenseSubjectId: dataRow.expenseSubjectId,
        year: column.yearLabel,
        trimId: column.trimId,
        trimName: column.trimName || column.label || column.trimId,
        yearIndex: column.yearIndex,
        trimIndex: column.trimIndex,
        value: nextValue,
        recordId,
        actor: state.currentUserName || state.currentUser,
      });
      if (!result || !result.ok) {
        if (hasOriginalValue) {
          updateCellValueLocally(dataRow, column, currentValue);
          const formulaResult = applyCurrentDetailFormulas();
          logConsumerCreditSaveDebug("保存失败-回滚后重算", dataRow, column, {
            formulaResult,
            save: {
              inputValue,
              currentValue,
              nextValue,
              result,
            },
          });
        }
        if (options.showMessage !== false) BaseToast.error((result && result.message) || "保存失败");
        return { ok: false, message: (result && result.message) || "保存失败" };
      }
      updateCellValueLocally(dataRow, column, nextValue);
      updateCellRecordMeta(dataRow, column, result.recordId || recordId);
      const formulaResult = applyCurrentDetailFormulas();
      clearCellInputDraft(row, column);
      state.detail["lastSavedAt"] = (result && result.savedAt || "-");
      state.detail["lastSavedBy"] = state.currentUserName || state.currentUser || "-";
      const nextRecordMeta = getCellRecordMeta(dataRow, column);
      logConsumerCreditSaveDebug("保存成功-本地更新并重算后", dataRow, column, {
        formulaResult,
        save: {
          inputValue,
          currentValue,
          nextValue,
          requestRecordId: recordId,
          result,
          nextRecordMeta,
        },
      });
      return {
        ok: true,
        recordId: result.recordId || recordId,
        recordMeta: nextRecordMeta,
        savedAt: result.savedAt,
      };
    }
    saveFillCellValueForward.fn = saveFillCellValue;
    saveCellOpinionForward.fn = saveCellOpinion;

    function fillAllTestCells() {
      const rows = (Array.isArray(state.detail.rows) ? state.detail.rows : []).filter((row: any) =>
        isEditableInputRow(row)
      );
      const allColumns = buildAllRealColumns();
      let filled = 0;
      rows.forEach((row: any, rowIndex: any) => {
        const columns = decorateRndInvestmentColumns(allColumns, row);
        columns.forEach((column: any, columnIndex: any) => {
          if (!isSavableMatrixColumn(column)) return;
          if (!isColumnFillableByInputScope(row, column)) return;
          const value = buildTestCellValue(row, column, rowIndex, columnIndex);
          updateCellValueLocally(row, column, value);
          filled += 1;
        });
      });
      if (filled > 0) {
        applyCurrentDetailFormulas();
        state.cellInputDrafts = {};
        state.cellInputOriginals = {};
      }
      return filled;
    }

    function buildTestCellValue(row: any, column: any, rowIndex: any, columnIndex: any) {
      if (String(row && row.inputType).toLowerCase() === "mode") return "总额录入";
      const b31Value =
        b31TestData && typeof b31TestData.resolveB31TestCellValue === "function" ? b31TestData.resolveB31TestCellValue(row, column) : "";
      if (String(b31Value || "").trim()) return b31Value;
      const subjectText = `${row && row.subject ? row.subject : ""} ${row && row.subjectPath ? row.subjectPath : ""}`;
      const unitText = String((row && row.unit) || "");
      const yearIndex = Number(column && column.yearIndex) || 0;
      const trimIndex = Number(column && column.trimIndex) || 0;
      if (unitText.includes("%") || unitText.includes("％")) {
        return String(((rowIndex + 1) * 3 + yearIndex + trimIndex) % 80 + 5);
      }
      if (/销量|台/.test(subjectText + unitText)) {
        return String(1000 + rowIndex * 25 + yearIndex * 120 + trimIndex * 30);
      }
      if (/价格|价|收入|成本|费用|利润|金额|元|万/.test(subjectText + unitText)) {
        return String(100 + rowIndex * 7 + yearIndex * 11 + trimIndex * 3);
      }
      return String(10 + rowIndex + columnIndex);
    }

    function buildCellOpinionPayload(row: any, column: any, opinion: any, options: any = {}) {
      const dataRow = resolveMatrixRow(row);
      const recordId = options.recordId || (options.recordMeta && options.recordMeta.id);
      return {
        ...buildSaveDraftParams(),
        stageCode: state.currentStageCode || state.queryStage,
        subjectDomain: AUDIT_DOMAIN.SUBTABLE,
        sourceType: options.sourceType || "fill_opinion",
        rowId: dataRow && (dataRow.id || dataRow.rowId || dataRow.subjectId),
        subjectId: dataRow && resolveRowSubjectId(dataRow),
        templateSubjectId: dataRow && dataRow.templateSubjectId,
        expenseSubjectId: dataRow && dataRow.expenseSubjectId,
        rootSubjectId: dataRow && (dataRow.rootSubjectId || dataRow.__moduleRootId),
        moduleKey: dataRow && (dataRow.rootSubjectId || dataRow.__moduleRootId || dataRow.subtable),
        moduleName: dataRow && (dataRow.subtable || dataRow.rootSubjectName || dataRow.moduleName),
        cellKey: resolveCellLegacyKey(column),
        dimensionKey: isRndInvestmentAmountColumn(column)
          ? resolveCellLegacyKey(column)
          : resolveCellDimensionKey(column),
        yearLabel: column && column.yearLabel,
        year: column && column.yearLabel,
        yearAggregateMode: column && column.yearAggregateMode,
        trimId: column && column.trimId,
        trimName: isYearOnlyRow(dataRow) || isRndInvestmentAmountColumn(column) ? "" : column && (column.trimName || column.trimId),
        trimIndex: column && column.trimIndex,
        recordId,
        targetRecordIds: recordId ? [recordId] : [],
        opinion,
      };
    }

    async function saveSubtableDraftQueued( params: any = {}) {
      return queueDraftSaveOperation(() => saveSubtableFillDraft({
        ...buildSaveDraftParams(),
        ...params,
      }));
    }

    async function waitForPendingDraftOperations() {
      if (!draftSavePromise) return;
      await Promise.race([
        draftSavePromise.catch(() => null),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
      draftSavePromise = null;
    }

    async function finishS1ModuleSubmitWithoutFullReload( section: any = {}, saveResult: any = {}, submitResult: any = {}, opinion = "") {
      const flowResult = (saveResult && saveResult.result) || {};
      const targetRecordIds: any[] = [];
      const targetSubmitIds: any[] = [];
      ([] as any[]).concat(flowResult.affectedRecordIds || []).forEach((id: any) => {
        appendUniquePositiveNumber(targetRecordIds, id);
      });
      ([] as any[]).concat(flowResult.affectedRecords || []).forEach((record: any) => {
        appendUniquePositiveNumber(targetRecordIds, record && (record.id || record.recordId));
      });
      ([] as any[]).concat(flowResult.submitId || [])
        .concat(flowResult.submitIds || [])
        .concat(flowResult.targetSubmitIds || [])
        .forEach((id: any) => appendUniquePositiveNumber(targetSubmitIds, id));
      if (targetRecordIds.length || targetSubmitIds.length) {
        writeS1ModuleMap("s1ModuleDraftTargetMap", section, {
          targetRecordIds,
          targetSubmitIds,
        });
      }

      const normalizedState = normalizeS1ModuleReviewState(
        (submitResult && submitResult.moduleReviewState) || {}
      );
      const keys = resolveS1ModuleOpinionKeys(section);
      const fallbackOpinion = String(opinion || "");
      keys.forEach((key: any) => {
        if (!key) return;
        if (Object.prototype.hasOwnProperty.call(normalizedState.opinionMap, key)) {
          state.s1ModuleOpinionMap[key] = normalizedState.opinionMap[key];
        } else if (fallbackOpinion.trim()) {
          state.s1ModuleOpinionMap[key] = fallbackOpinion;
        }
        if (Object.prototype.hasOwnProperty.call(normalizedState.submitMap, key)) {
          state.s1ModuleSubmitMap[key] = normalizedState.submitMap[key];
        } else {
          state.s1ModuleSubmitMap[key] = {
            submitted: true,
            targetRecordIds,
            targetSubmitIds,
            submittedBy: state.currentUser,
            submittedName: state.currentUserName || state.currentUser,
            submittedAt: flowResult.submittedAt || saveResult.submittedAt || "",
          };
        }
        state.s1ModuleOpinionLockedMap[key] = true;
        delete state.s1ModuleOpinionDraftMap[key];
        delete state.s1ModuleOpinionReeditMap[key];
      });
      // key 解析失败或 Vue3 原地改属性不刷新时，用整体替换兜底
      if (fallbackOpinion.trim()) {
        writeS1ModuleMap("s1ModuleOpinionMap", section, fallbackOpinion);
      }
      writeS1ModuleMap("s1ModuleSubmitMap", section, {
        submitted: true,
        targetRecordIds,
        targetSubmitIds,
        submittedBy: state.currentUser,
        submittedName: state.currentUserName || state.currentUser,
        submittedAt: flowResult.submittedAt || saveResult.submittedAt || "",
      });
      writeS1ModuleMap("s1ModuleOpinionLockedMap", section, true);
      s1ModuleFlow.deleteS1ModuleMap("s1ModuleOpinionDraftMap", section);
      s1ModuleFlow.deleteS1ModuleMap("s1ModuleOpinionReeditMap", section);
      if ((normalizedState as any).timeline.length) {
        state.s1ModuleTimeline = normalizedState.timeline;
      }

      const submittedAt = flowResult.submittedAt || saveResult.submittedAt || nowText();
      state.detail["lastSavedAt"] = submittedAt;
      state.detail["lastSavedBy"] = state.currentUserName || state.currentUser || "-";
      await refreshStageCompletionSummary();
    }

    function resolveS3ModuleProgressStatus( item: any = {}) {
      if (!item.total) return "无待确认项";
      if (item.archived === item.total) return "已提交";
      if (item.done === item.total) return "待提交";
      return "确认中";
    }

    function resolveYearTrimOptions(yearIndex: any) {
      // 使用 computed 的 dimensions/trimOptions，避免顶层 state 未同步时列为空
      const years = dimensions.value.years || [];
      const yearKey = String(years[yearIndex] || "").trim();
      const all = trimOptions.value;
      if (!yearKey) return all;
      const selected = state.localYearTrimConfig[yearKey];
      if (!Array.isArray(selected) || !selected.length) return all;
      const selectedMap = {};
      selected.forEach((trimId: any) => {
        (selectedMap as Record<string, any>)[String(trimId || "").trim()] = true;
      });
      const filtered = (all as any).filter((item: any) => (selectedMap as Record<string, any>)[item.trimId]);
      return filtered.length ? filtered : all;
    }

    function rowS3ConfirmationProgress(row: any) {
      const progress = {
        total: 0,
        done: 0,
        archived: 0,
      };
      rowActiveColumns(row).forEach((column: any) => {
        if (!isSavableMatrixColumn(column)) return;
        if (!isColumnFillableByInputScope(row, column)) return;
        const candidate = getS3Candidate(row, column);
        progress.total += 1;
        const value = candidate && hasS3ActionableCandidate(row, column)
          ? candidate.finalValue
          : getCellValue(row, column);
        if (String(value == null ? "" : value).trim()) progress.done += 1;
        if (isS3CandidateSavedAsArchived(candidate)) progress.archived += 1;
      });
      return progress;
    }

    function rowDoneCount(row: any) {
      const columns = rowAllActionColumns(row);
      let done = 0;
      columns.forEach((column: any) => {
        if (!isSavableMatrixColumn(column)) return;
        if (!isColumnFillableByInputScope(row, column)) return;
        const value = String(getCellValue(row, column) || "").trim();
        if (value) done += 1;
      });
      return done;
    }

    function rowTotalCount(row: any) {
      return rowAllActionColumns(row).filter((column: any) =>
        isSavableMatrixColumn(column) && isColumnFillableByInputScope(row, column)
      ).length;
    }

    function parseLooseNumber(value: any) {
      const text = String(value == null ? "" : value).trim().replace(/,/g, "");
      if (!text) return null;
      const numberValue = Number(text);
      return Number.isFinite(numberValue) ? numberValue : null;
    }

    function warnRndTaxAmountIfNeeded(row: any) {
      const dataRow = resolveMatrixRow(row);
      if (!dataRow || !dataRow.cells) return;
      const taxIncluded = parseLooseNumber(dataRow.cells[RND_INVESTMENT_TAX_INCLUDED_CELL_KEY]);
      const taxExcluded = parseLooseNumber(dataRow.cells[RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY]);
      if (taxIncluded == null || taxExcluded == null) return;
      if (taxIncluded < taxExcluded) {
        BaseToast.warning("投资总额-含税小于投资总额-不含税，请确认填报口径");
      }
    }

    async function saveRndInvestmentAmountChange(row: any, column: any, value: any) {
      const dataRow = resolveMatrixRow(row);
      if (!dataRow || !column) return { ok: false, message: "未定位到研发费用单元格" };
      updateCellValueLocally(dataRow, column, value);
      warnRndTaxAmountIfNeeded(dataRow);
      applyCurrentDetailFormulas();

      const recordMeta = getCellRecordMeta(dataRow, column);
      const recordId =
        recordMeta &&
        String(recordMeta.recordStatus || "").toUpperCase() === "DRAFT" &&
        (!recordMeta.ownerId || matchesCurrentRecordOwner(recordMeta.ownerId))
          ? recordMeta.id
          : undefined;
      const rowSubjectId = resolveRowSubjectId(dataRow);
      const result = await saveSubtableFillCell({
        projectId: state.queryProjectId,
        flowId: state.queryFlowId,
        projectCode: state.queryProjectCode,
        projectName: state.queryProjectName,
        permissionKey: state.queryPermissionKey,
        fullAccess: state.hasAllPermission,
        userId: state.currentUser,
        stage: state.queryStage,
        valve: state.queryValve,
        visibleSubjectIds: buildVisibleSubjectIds(),
        moduleCode: dataRow.moduleCode,
        moduleName: dataRow.moduleName || dataRow.subtable || dataRow.rootSubjectName,
        subtable: dataRow.subtable,
        rootSubjectName: dataRow.rootSubjectName,
        fullNamePath: dataRow.fullNamePath,
        subjectPath: dataRow.subjectPath,
        subject: dataRow.subject,
        subjectName: dataRow.subjectName,
        unit: column.unit || dataRow.unit,
        rowId: dataRow.id,
        subjectId: rowSubjectId,
        templateSubjectId: dataRow.templateSubjectId,
        expenseSubjectId: dataRow.expenseSubjectId,
        year: "",
        trimId: "",
        yearIndex: -1,
        trimIndex: Number(column.trimIndex),
        yearAggregateMode: column.yearAggregateMode,
        value,
        recordId,
        actor: state.currentUserName || state.currentUser,
      });
      if (!result || !result.ok) {
        BaseToast.error((result && result.message) || "研发费用保存失败");
        return { ok: false, message: (result && result.message) || "研发费用保存失败" };
      }
      updateCellRecordMeta(dataRow, column, result.recordId || recordId);
      clearCellInputDraft(dataRow, column);
      state.detail.lastSavedAt = (result && result.savedAt) || "-";
      state.detail.lastSavedBy = state.currentUserName || state.currentUser || "-";
      const nextRecordMeta = getCellRecordMeta(dataRow, column);
      return {
        ok: true,
        recordId: result.recordId || recordId,
        recordMeta: nextRecordMeta,
        savedAt: result.savedAt,
      };
    }

    function buildSaveDraftParams() {
      return {
        ...buildSaveContextParams(),
        detail: state.detail,
      };
    }

    function buildSaveContextParams() {
      return {
        projectId: state.queryProjectId,
        flowId: state.activeFlowId || state.queryFlowId,
        projectCode: state.queryProjectCode,
        projectName: state.queryProjectName,
        permissionKey: state.queryPermissionKey,
        fullAccess: state.hasAllPermission,
        userId: state.currentUser,
        // S3 本人草稿过滤：与后端 ownerId（登录名）对齐
        ownerUserId: state.queryOwnerUserId || undefined,
        actor: state.currentUserName || state.currentUser,
        stage: state.queryStage,
        valve: state.queryValve,
        visibleSubjectIds: buildVisibleSubjectIds(),
        s1FlowFillPermission: state.isS1FlowPermissionEntry && state.hasS1FlowFillPermission,
        s1FlowSubmitPermission: state.isS1FlowPermissionEntry && state.hasS1FlowSubmitPermission,
        s1FlowCancelSubmitPermission: state.isS1FlowPermissionEntry && state.hasS1FlowCancelSubmitPermission,
      };
    }

    function historyImportTargetModelYears() {
      const result: any[] = [];
      const seen = {};
      (state.dimensions.years || []).forEach((year: any) => {
        const matched = String(year == null ? "" : year).match(/\d{4}/);
        const value = matched ? Number(matched[0]) : Number(year);
        if (!Number.isFinite(value) || value <= 0 || (seen as Record<string, any>)[value]) return;
        (seen as Record<string, any>)[value] = true;
        result.push(Math.trunc(value));
      });
      return result;
    }

    function historyImportTargetTrimNames() {
      const result: any[] = [];
      const seen = {};
      (state.trimOptions || []).forEach((trim: any) => {
        const name = String((trim && (trim.trimName || trim.name || trim.trimId)) || "").trim();
        if (!name || (seen as Record<string, any>)[name]) return;
        (seen as Record<string, any>)[name] = true;
        result.push(name);
      });
      return result;
    }

    function historyImportTargetSubjectIds() {
      return buildVisibleSubjectIds()
        .map((item: any) => Number(item))
        .filter((item: any, index: any, list: any) => Number.isFinite(item) && item > 0 && list.indexOf(item) === index);
    }

    function applyOwnerSubmitResultLocally( result: any = {}) {
      const flowResult = (result && result.result) || {};
      const submittedAt = flowResult.submittedAt || result.submittedAt || nowText();
      state.detail.lastSavedAt = submittedAt;
      state.detail.lastSavedBy = state.currentUserName || state.currentUser || "-";
      if (state.currentStageCode === "S1" && flowResult.flowAdvanced === false) {
        state.ownerSubmitDraftLocked = true;
      }
      return {
        submittedAt,
        lastSavedBy: state.currentUserName || state.currentUser || "-",
        flowAdvanced: flowResult.flowAdvanced,
        nextStage: flowResult.nextStage,
        pendingConfirm: Boolean(flowResult.pendingConfirm),
      };
    }

    async function finishOwnerSubmitWithoutFullReload( result: any = {}, action = "提交本人填报") {
      const trace = createSubmitRefreshTrace(action);
      const localState = applyOwnerSubmitResultLocally(result);
      logSubmitRefreshDecision(trace, "提交成功后跳过全量刷新", {
        fullReload: false,
        reason: "submits/save 已保存当前详情快照，当前页面只需要更新最近保存信息和完成一次局部渲染。",
        skippedApis: [
          "user-period-expense-subject-permissions/tree",
          "project-costs/subjects",
          "project-costs/records/query",
          "project-costs/review-suggestions/query",
        ],
        localState,
        result: result.result || result,
      });
      try {
        await logSubmitLocalRenderTiming(trace, localState);
      } catch (_error) {
        // 提交后的局部渲染日志不阻断提交流程。
      }
    }

    function ensureSubmitOverviewMode() {
      if (isSubmitOverviewMode.value) return true;
      BaseToast.warning(submitOverviewGuardHint.value);
      return false;
    }

    async function confirmStageFlowSubmit(message: any, title = "提交确认") {
      try {
        await ElMessageBox.confirm(message, title, {
          confirmButtonText: "确认提交",
          cancelButtonText: "取消",
          type: "warning",
        });
        return true;
      } catch (_error) {
        return false;
      }
    }

    function returnToPreviousPageAfterSubmit() {
      // 对齐 Vue2：提交成功后延迟返回；全屏详情下明确 replace 到列表，避免 back 无效仍停在本页
      window.setTimeout(() => {
        const listPath = resolveReturnListPath();
        router.replace(listPath).catch(() => {
          goBack();
        });
      }, 800);
    }

  function normalizeS1ModuleReviewState(mapState: Record<string, unknown>) {
    return {
      opinionMap:
        mapState &&
        mapState.opinionMap &&
        typeof mapState.opinionMap === "object" &&
        !Array.isArray(mapState.opinionMap)
          ? (mapState.opinionMap as Record<string, string>)
          : {},
      submitMap:
        mapState &&
        mapState.submitMap &&
        typeof mapState.submitMap === "object" &&
        !Array.isArray(mapState.submitMap)
          ? (mapState.submitMap as Record<string, unknown>)
          : {},
      timeline: Array.isArray(mapState && mapState.timeline) ? mapState.timeline : [],
    };
  }

void _isRndExpenseDetail.value;
void _visibleActiveColumns.value;
void _resolveS1ModuleProgressStatus;
</script>

<style lang="scss" scoped src="./styles/detail.scss"></style>
<style lang="scss" src="./styles/detail-popover.scss"></style>
<style lang="scss">
.s1-submit-confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
}

.s1-submit-confirm-box {
  width: 420px;
  padding: 16px 20px 14px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.s1-submit-confirm-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}

.s1-submit-confirm-message {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 20px;
  color: #4a5a6e;
}

.s1-submit-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.s1-submit-confirm-btn {
  min-width: 72px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
}

.s1-submit-confirm-btn--primary {
  border-color: #409eff;
  background: #409eff;
  color: #fff;
}
</style>
