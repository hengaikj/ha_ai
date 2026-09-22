import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parse } from "vue/compiler-sfc";

const BUTTON_TAGS = new Set([
  "PermissionButton",
  "el-button",
  "ElButton",
  "button",
]);
const PERMISSION_CODE =
  /[A-Za-z0-9][A-Za-z0-9_-]*(?::[A-Za-z0-9][A-Za-z0-9_-]*)+/g;
const UI_ONLY_LABELS =
  /^(返回|取消|关闭|重置|搜索|查询|展开|折叠|全部展开|全部折叠|清空筛选|清空选择)$/;
const EXCLUDED_PERMISSION_PREFIXES = ["data:governance:"];
const DATA_GOVERNANCE_PAGE_PREFIX = "src/pages/data-governance/";
const BUSINESS_CLASSIFICATIONS = new Set([
  "business-read",
  "business-mutation",
  "file-transfer",
]);
const ALLOWED_MANUAL_CLASSIFICATIONS = new Set([
  "local-ui",
  "navigation-view",
  "public-authentication",
  ...BUSINESS_CLASSIFICATIONS,
]);
const ACCEPTED_MULTI_LABEL_PERMISSIONS = new Map([
  ["system:attachment:list", "附件入口与附件预览均读取同一附件资源"],
  ["system:attachment:download", "单文件下载与批量打包下载属于同一下载能力"],
  ["system:attachment:remove", "单条删除与批量删除执行同一附件删除能力"],
  ["system:attachment:upload", "不同页面上传文案均调用统一附件上传接口"],
  ["system:project:list", "同步和对比均只读取项目评估数据"],
  ["system:project:valve:list", "同步、对比和查看均只读取项目阀点数据"],
  ["system:project:valve:edit", "保存评估与执行过阀均修改项目阀点状态或内容"],
  ["system:project:edit", "保存项目表单与列表编辑项目属于同一项目修改能力"],
  [
    "system:project:permission",
    "保存项目数据权限与数据权限入口属于同一授权能力",
  ],
  ["committee:gate:create", "创建阀点入口与新建表单保存均执行阀点创建"],
  ["committee:gate:update", "编辑阀点入口与编辑表单保存均执行阀点更新"],
  ["committee:material:edit", "材料入口编辑与材料保存均修改上会材料"],
  [
    "committee:material-category:add",
    "新增分类入口与新增表单保存均创建材料分类",
  ],
  [
    "committee:material-category:edit",
    "编辑分类入口与编辑表单保存均修改材料分类",
  ],
  [
    "committee:material-template:add",
    "新增材料入口与新增表单保存均创建材料模板",
  ],
  [
    "committee:material-template:edit",
    "编辑材料入口与编辑表单保存均修改材料模板",
  ],
  [
    "committee:attachment:download",
    "下载、查看及动态附件名称均读取同一委员会附件",
  ],
  ["committee:config:dept", "部门配置页的保存文案指向同一配置能力"],
  ["committee:attachment:upload", "上传PDF与上传附件均调用委员会附件上传"],
  ["committee:project:init", "创建项目入口与项目表单保存均初始化上会项目管理"],
  [
    "committee:project:update",
    "项目列表、详情编辑入口与表单保存均修改上会项目管理资料",
  ],
  ["committee:review:draft", "填写入口与保存草稿均维护评审草稿"],
  ["committee:review:approve", "同意与负责人审批均执行评审审批"],
  ["committee:review:query", "查看评审与版本历史均读取评审记录"],
  ["committee:review:reply", "协同、回复和知会均发送评审沟通信息"],
  [
    "committee:meeting:second:conclude",
    "录入品牌公司会议结论入口与提交确认均执行结论保存",
  ],
  [
    "committee:meeting:group:conclude",
    "录入集团会议结论入口与提交确认均执行结论保存",
  ],
  [
    "committee:meeting:second:update",
    "品牌公司会议编辑入口与动态表单文案均执行会议更新",
  ],
  [
    "committee:meeting:group:update",
    "集团会议编辑入口与动态表单文案均执行会议更新",
  ],
  [
    "committee:meeting:second:create",
    "品牌公司会议创建入口与动态表单文案均执行会议创建",
  ],
  [
    "committee:meeting:group:create",
    "集团会议创建入口与动态表单文案均执行会议创建",
  ],
  ["cost:research:history:delete", "单条删除与批量删除执行同一成本履历删除"],
  ["cost:analysis:delete", "单条删除与批量删除执行同一成本分析删除"],
  ["cost:bom:query:delete", "单条删除与批量删除执行同一成本BOM删除"],
  ["cost:research:history:copy-valve", "复制阀点入口文案指向同一阀点复制能力"],
  ["cost:research:history:gate:copy", "复制阀点入口与确认复制均执行阀点复制"],
  [
    "cost:research:new-history:gate:copy",
    "成本履历复制阀点入口与确认复制均执行阀点复制",
  ],
  [
    "cost:research:history:version:query",
    "历史版本入口与查看版本均读取成本履历版本",
  ],
  [
    "cost:research:new-history:version:query",
    "历史版本入口与查看版本均读取成本履历版本",
  ],
  ["cost:analysis:copy-valve", "复制阀点入口文案指向同一阀点复制能力"],
  ["cost:bom:query:copy-valve", "复制阀点入口文案指向同一阀点复制能力"],
  ["cost:research:history:add", "新增零件入口与表单保存均执行零件创建"],
  ["cost:research:history:edit", "编辑零件入口与表单保存均执行零件更新"],
  ["cost:research:history:copy", "复制零件入口与表单保存均执行零件复制"],
  ["cost:research:new-history:add", "新增零件入口与表单保存均执行零件创建"],
  ["cost:research:new-history:edit", "编辑零件入口与表单保存均执行零件更新"],
  ["cost:research:new-history:copy", "复制零件入口与表单保存均执行零件复制"],
  ["cost:research:project-cost:create", "新增零件入口与表单保存均执行零件创建"],
  ["cost:research:project-cost:edit", "编辑零件入口与表单保存均执行零件更新"],
  ["cost:research:project-cost:copy", "复制零件入口与表单保存均执行零件复制"],
  ["cost:research:project-cost:list", "查看成本与查看版本均读取项目成本"],
  [
    "cost:research:new-project-cost:version:query",
    "历史版本入口与查看版本均读取项目成本版本",
  ],
  [
    "base:cust-table:template:edit",
    "V2模板新建、设计和草稿保存统一维护模板草稿",
  ],
  [
    "base:cust-table:category:edit",
    "V2分类新增、编辑和删除统一使用分类维护权限",
  ],
  [
    "base:cust-table:binding:edit",
    "V2业务绑定新增、更新和解绑统一使用业务绑定维护权限",
  ],
  ["base:cust-table:workbook:edit", "填报入口与保存单元格均修改V2工作簿"],
  ["cost:bom:purchase-list:export", "通用导出与车型版本导出属于采购清单导出"],
  ["cost:bom:purchase-list:view", "查看与查看整编均读取采购清单"],
  [
    "cost:bom:purchase-list:bind-pattern",
    "选择版型与保存均维护采购清单版型绑定",
  ],
  [
    "information:cost-coefficient:remove",
    "单条删除与批量删除执行同一成本系数删除",
  ],
  ["information:preset-column:remove", "单条删除与批量删除执行同一预置列删除"],
  ["information:preset-column:add", "新增预置列入口与表单保存均执行创建"],
  ["information:preset-column:edit", "编辑预置列入口与表单保存均执行更新"],
  ["system:pattern:remove", "单条删除与批量删除执行同一版型删除"],
  ["project:project:remove", "单条删除与批量删除执行同一项目删除"],
  ["system:role:assign-user", "分配用户入口与添加用户均执行角色用户分配"],
  [
    "system:role:cancel-user",
    "分配用户页入口、单条和批量取消共用角色用户取消能力",
  ],
  [
    "system:role:grant-permission",
    "授权入口、预览、保存及确认均属于角色授权流程",
  ],
  [
    "system:role:grant-data-scope",
    "数据权限入口与保存数据范围属于同一角色数据授权",
  ],
  ["system:user:role:oper", "分配角色入口与提交均维护用户角色关系"],
  ["system:user:remove", "单条删除与批量删除执行同一用户删除"],
  ["system:vehicle:model:remove", "单条删除与批量删除执行同一车型删除"],
  [
    "monitor:job:query",
    "任务详情、执行日志入口与更多菜单均读取定时任务或日志信息",
  ],
  [
    "monitor:job:changeStatus",
    "启停、立即执行与更多菜单均使用后端统一任务状态操作权限",
  ],
  [
    "monitor:job:remove",
    "任务和日志的单条删除、批量删除及日志清空共用后端删除权限",
  ],
]);

export function auditVueSource(source, file) {
  const { descriptor } = parse(source, { filename: file });
  const root = descriptor.template?.ast;
  if (!root) return [];

  const buttons = [];

  function visit(node, inheritedPermission) {
    if (node.type !== 1) {
      node.children?.forEach((child) => visit(child, inheritedPermission));
      return;
    }

    const ownPermission = readPermission(node);
    const guardPermission =
      node.tag === "PermissionGuard"
        ? (ownPermission ?? inheritedPermission)
        : inheritedPermission;

    if (BUTTON_TAGS.has(node.tag)) {
      const effectivePermission = ownPermission ?? guardPermission;
      buttons.push({
        file,
        tag: node.tag,
        label:
          readVisibleText(node) ||
          readAttribute(node, "aria-label") ||
          "动态文案",
        dataTest:
          readAttribute(node, "data-test") ??
          readAttribute(node, "data-testid") ??
          null,
        permissionCodes: effectivePermission?.codes ?? [],
        permissionExpression: effectivePermission?.expression ?? null,
        permissionMode: ownPermission
          ? ownPermission.mode
          : guardPermission
            ? "guard"
            : "none",
      });
    }

    node.children?.forEach((child) => visit(child, guardPermission));
  }

  visit(root, null);
  return buttons;
}

export function buildButtonAudit(
  inputButtons,
  classifications = [],
  dynamicPermissionSources = [],
) {
  const dynamicResolution = resolveDynamicPermissions(
    inputButtons,
    dynamicPermissionSources,
  );
  const buttons = dynamicResolution.buttons;
  const permissionLabels = new Map();
  const pageLabels = new Map();

  buttons.forEach((button) => {
    button.permissionCodes.forEach((permissionCode) => {
      const labels = permissionLabels.get(permissionCode) ?? new Set();
      labels.add(button.label);
      permissionLabels.set(permissionCode, labels);
    });

    const pageLabelKey = `${button.file}\t${button.label}`;
    const pageButtons = pageLabels.get(pageLabelKey) ?? [];
    pageButtons.push(button.permissionCodes);
    pageLabels.set(pageLabelKey, pageButtons);
  });

  const permissionConflicts = [...permissionLabels.entries()]
    .filter(([, labels]) => labels.size > 1)
    .map(([permissionCode, labels]) => {
      const acceptanceReason =
        ACCEPTED_MULTI_LABEL_PERMISSIONS.get(permissionCode);
      return {
        permissionCode,
        labels: [...labels].sort(),
        disposition: EXCLUDED_PERMISSION_PREFIXES.some((prefix) =>
          permissionCode.startsWith(prefix),
        )
          ? "excluded"
          : acceptanceReason
            ? "accepted"
            : "unresolved",
        ...(acceptanceReason ? { acceptanceReason } : {}),
      };
    });
  const unresolvedPermissionConflicts = permissionConflicts.filter(
    (item) => item.disposition === "unresolved",
  );
  const pageNameConflicts = [...pageLabels.entries()]
    .filter(([, pageButtons]) => {
      const signatures = new Set(
        pageButtons
          .filter((codes) => codes.length)
          .map((codes) => [...codes].sort().join(",")),
      );
      return pageButtons.length > 1 && signatures.size > 1;
    })
    .map(([key, pageButtons]) => {
      const [file, label] = key.split("\t");
      const permissionCodes = [...new Set(pageButtons.flat())].sort();
      return { file, label, permissionCodes };
    });
  const buttonClassifications = buttons.map((button) =>
    classifyButton(button, classifications),
  );
  const unclassifiedUnprotected = buttonClassifications.filter(
    (button) => button.classification === "unclassified",
  );
  const businessCommandsWithoutPermission = buttonClassifications.filter(
    (button) =>
      button.permissionMode === "none" &&
      BUSINESS_CLASSIFICATIONS.has(button.classification),
  );
  const excludedDataGovernance = buttonClassifications.filter(
    (button) => button.classification === "excluded-data-governance",
  );
  const unusedClassifications = classifications.filter(
    (classification) =>
      !buttons.some(
        (button) =>
          button.permissionMode === "none" &&
          classificationMatchesButton(classification, button),
      ),
  );
  const unresolvedDynamicPermissions = dynamicResolution.unresolved;
  const unusedDynamicPermissionSources = dynamicResolution.unusedSources;
  const passed =
    unresolvedPermissionConflicts.length === 0 &&
    pageNameConflicts.length === 0 &&
    unclassifiedUnprotected.length === 0 &&
    businessCommandsWithoutPermission.length === 0 &&
    unusedClassifications.length === 0 &&
    unresolvedDynamicPermissions.length === 0 &&
    unusedDynamicPermissionSources.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: buttons.length,
      protected: buttons.filter((button) => button.permissionMode !== "none")
        .length,
      static: buttons.filter((button) => button.permissionMode === "static")
        .length,
      dynamic: buttons.filter((button) => button.permissionMode === "dynamic")
        .length,
      guarded: buttons.filter((button) => button.permissionMode === "guard")
        .length,
      unprotected: buttons.filter((button) => button.permissionMode === "none")
        .length,
      permissionConflicts: permissionConflicts.length,
      unresolvedPermissionConflicts: unresolvedPermissionConflicts.length,
      pageNameConflicts: pageNameConflicts.length,
      unclassifiedUnprotected: unclassifiedUnprotected.length,
      businessCommandsWithoutPermission:
        businessCommandsWithoutPermission.length,
      excludedDataGovernance: excludedDataGovernance.length,
      unusedClassifications: unusedClassifications.length,
      unresolvedDynamicPermissions: unresolvedDynamicPermissions.length,
      unusedDynamicPermissionSources: unusedDynamicPermissionSources.length,
    },
    passed,
    permissionConflicts,
    unresolvedPermissionConflicts,
    pageNameConflicts,
    buttonClassifications,
    unclassifiedUnprotected,
    businessCommandsWithoutPermission,
    unusedClassifications,
    unresolvedDynamicPermissions,
    unusedDynamicPermissionSources,
    unprotectedCommands: buttons.filter(
      (button) =>
        button.permissionMode === "none" &&
        button.label !== "动态文案" &&
        !UI_ONLY_LABELS.test(button.label),
    ),
    buttons,
  };
}

function resolveDynamicPermissions(buttons, sources) {
  const usedSources = new Set();
  const resolvedButtons = buttons.map((button) => {
    if (
      button.permissionMode !== "dynamic" ||
      button.permissionCodes.length > 0
    ) {
      return button;
    }

    const expression = normalizePermissionExpression(
      button.permissionExpression ?? "",
    );
    const matches = sources.filter(
      (source) =>
        sameAuditFile(source.file, button.file) &&
        expression.includes(source.variable),
    );
    let variants = [expression];
    matches.forEach((source) => {
      usedSources.add(source);
      variants = variants.flatMap((variant) =>
        source.values.map((value) =>
          variant
            .split(`\${${source.variable}}`)
            .join(value)
            .split(source.variable)
            .join(value),
        ),
      );
    });
    const permissionCodes = [
      ...new Set(
        variants.flatMap((variant) => variant.match(PERMISSION_CODE) ?? []),
      ),
    ];
    return {
      ...button,
      permissionCodes,
      dynamicPermissionSources: matches.map((source) => source.variable),
    };
  });

  return {
    buttons: resolvedButtons,
    unresolved: resolvedButtons.filter(
      (button) =>
        button.permissionMode === "dynamic" &&
        button.permissionCodes.length === 0,
    ),
    unusedSources: sources.filter((source) => !usedSources.has(source)),
  };
}

function normalizePermissionExpression(expression) {
  return expression.replace(/\s+/g, " ").trim();
}

function normalizeAuditFile(file) {
  return file.replace(/\\/g, "/");
}

function sameAuditFile(left, right) {
  return normalizeAuditFile(left) === normalizeAuditFile(right);
}

export function loadButtonClassifications(file) {
  const document = JSON.parse(readFileSync(file, "utf8"));
  if (document.version !== 1 || !Array.isArray(document.classifications)) {
    throw new Error("按钮分类清单必须使用 version=1 和 classifications 数组");
  }
  const keys = new Set();
  const expanded = [];
  document.classifications.forEach((item, index) => {
    const labels = item.label ? [item.label] : item.labels;
    if (
      !item.file ||
      !Array.isArray(labels) ||
      labels.length === 0 ||
      labels.some((label) => typeof label !== "string" || !label) ||
      !item.reason
    ) {
      throw new Error(`第 ${index + 1} 条按钮分类缺少文件、名称或原因`);
    }
    if (!ALLOWED_MANUAL_CLASSIFICATIONS.has(item.classification)) {
      throw new Error(
        `第 ${index + 1} 条按钮分类包含非法分类：${item.classification}`,
      );
    }
    labels.forEach((label) => {
      const key = [item.file, label, item.dataTest ?? "", item.tag ?? ""].join(
        "\t",
      );
      if (keys.has(key)) {
        throw new Error(`第 ${index + 1} 条按钮分类与已有规则重复：${key}`);
      }
      keys.add(key);
      const classification = { ...item };
      delete classification.labels;
      expanded.push({ ...classification, label });
    });
  });
  return expanded;
}

export function loadDynamicPermissionSources(file) {
  const document = JSON.parse(readFileSync(file, "utf8"));
  if (document.version !== 1 || !Array.isArray(document.sources)) {
    throw new Error("动态权限清单必须使用 version=1 和 sources 数组");
  }
  const keys = new Set();
  return document.sources.map((item, index) => {
    if (
      !item.file ||
      !item.variable ||
      !Array.isArray(item.values) ||
      item.values.length === 0 ||
      item.values.some((value) => typeof value !== "string" || !value) ||
      !item.reason
    ) {
      throw new Error(
        `第 ${index + 1} 条动态权限契约缺少文件、变量、取值或原因`,
      );
    }
    const key = `${item.file}\t${item.variable}`;
    if (keys.has(key)) {
      throw new Error(`第 ${index + 1} 条动态权限契约与已有规则重复：${key}`);
    }
    keys.add(key);
    return item;
  });
}

function classifyButton(button, classifications) {
  if (button.permissionMode !== "none") {
    return {
      ...button,
      classification: "permission-controlled",
      reason: "按钮已绑定权限码或权限守卫",
    };
  }
  if (button.file.startsWith(DATA_GOVERNANCE_PAGE_PREFIX)) {
    return {
      ...button,
      classification: "excluded-data-governance",
      reason: "数据治理模块由其他团队负责，本轮明确排除",
    };
  }
  if (UI_ONLY_LABELS.test(button.label)) {
    return {
      ...button,
      classification: "local-ui",
      reason: "仅改变当前页面查询、展示或弹窗状态",
    };
  }

  const matches = classifications.filter((item) =>
    classificationMatchesButton(item, button),
  );
  if (matches.length === 1) {
    return { ...button, ...matches[0] };
  }
  return {
    ...button,
    classification: "unclassified",
    reason:
      matches.length > 1 ? "匹配到多个分类规则" : "未配置无权限按钮分类规则",
  };
}

function classificationMatchesButton(classification, button) {
  return (
    sameAuditFile(classification.file, button.file) &&
    classification.label === button.label &&
    (classification.dataTest === undefined ||
      classification.dataTest === button.dataTest) &&
    (classification.tag === undefined || classification.tag === button.tag)
  );
}

function readPermission(node) {
  const attribute = node.props?.find(
    (prop) => prop.type === 6 && prop.name === "permission",
  );
  if (attribute?.value?.content) {
    return {
      codes: attribute.value.content.match(PERMISSION_CODE) ?? [],
      expression: attribute.value.content,
      mode: "static",
    };
  }

  const binding = node.props?.find(
    (prop) =>
      prop.type === 7 &&
      prop.name === "bind" &&
      prop.arg?.type === 4 &&
      prop.arg.content === "permission",
  );
  if (!binding) return null;

  const expression = binding.exp?.content ?? "";
  return {
    codes: extractLiteralPermissionCodes(expression),
    expression,
    mode: "dynamic",
  };
}

function extractLiteralPermissionCodes(expression) {
  const codes = [];
  for (const match of expression.matchAll(/(["'`])([^"'`]+)\1/g)) {
    if (match[2].includes("${")) continue;
    const values = match[2].match(PERMISSION_CODE) ?? [];
    codes.push(...values);
  }
  return [...new Set(codes)];
}

function readAttribute(node, name) {
  return node.props?.find((prop) => prop.type === 6 && prop.name === name)
    ?.value?.content;
}

function readVisibleText(node) {
  if (node.type === 2) return node.content.trim();
  if (node.type === 5) return "";
  return (node.children ?? [])
    .map(readVisibleText)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function walkVueFiles(directory, output = []) {
  for (const name of readdirSync(directory)) {
    const file = path.join(directory, name);
    const stat = statSync(file);
    if (stat.isDirectory()) walkVueFiles(file, output);
    else if (file.endsWith(".vue")) output.push(file);
  }
  return output;
}

function toMarkdown(audit) {
  const lines = [
    "# 页面按钮名称与权限码核实报告",
    "",
    `生成时间：${audit.generatedAt}`,
    "",
    "## 汇总",
    "",
    `- 页面按钮总数：${audit.summary.total}`,
    `- 已受权限控制：${audit.summary.protected}`,
    `- 无权限码按钮：${audit.summary.unprotected}`,
    `- 同权限码多名称：${audit.summary.permissionConflicts}`,
    `- 未解决权限语义冲突：${audit.summary.unresolvedPermissionConflicts}`,
    `- 同页面同名但权限码不同：${audit.summary.pageNameConflicts}`,
    `- 未分类无权限按钮：${audit.summary.unclassifiedUnprotected}`,
    `- 未授权业务命令：${audit.summary.businessCommandsWithoutPermission}`,
    `- 明确排除的数据治理按钮：${audit.summary.excludedDataGovernance}`,
    `- 未命中的陈旧分类规则：${audit.summary.unusedClassifications}`,
    `- 未解析动态权限按钮：${audit.summary.unresolvedDynamicPermissions}`,
    `- 未命中的动态权限契约：${audit.summary.unusedDynamicPermissionSources}`,
    "",
    "## 同权限码多名称",
    "",
  ];
  if (!audit.permissionConflicts.length) lines.push("无。");
  audit.permissionConflicts.forEach((item) => {
    const disposition =
      item.disposition === "accepted"
        ? "已核实为同一能力别名"
        : item.disposition === "excluded"
          ? "数据治理模块，本轮排除"
          : "待整改";
    lines.push(
      `- \`${item.permissionCode}\`：${item.labels.join("、")}（${disposition}）`,
    );
  });
  lines.push("", "## 同页面同名按钮", "");
  if (!audit.pageNameConflicts.length) lines.push("无。");
  audit.pageNameConflicts.forEach((item) => {
    lines.push(
      `- \`${item.file}\` / ${item.label}：${item.permissionCodes.map((code) => `\`${code}\``).join("、")}`,
    );
  });
  lines.push("", "## 无权限码待核对命令", "");
  if (!audit.unprotectedCommands.length) lines.push("无。");
  audit.unprotectedCommands.forEach((button) => {
    lines.push(`- \`${button.file}\`：${button.label}`);
  });
  lines.push("", "## 未分类无权限按钮", "");
  if (!audit.unclassifiedUnprotected.length) lines.push("无。");
  audit.unclassifiedUnprotected.forEach((button) => {
    lines.push(`- \`${button.file}\`：${button.label}`);
  });
  lines.push("", "## 未授权业务命令", "");
  if (!audit.businessCommandsWithoutPermission.length) lines.push("无。");
  audit.businessCommandsWithoutPermission.forEach((button) => {
    lines.push(
      `- \`${button.file}\`：${button.label}（${button.classification}，${button.reason}）`,
    );
  });
  lines.push("", "## 未命中的陈旧分类规则", "");
  if (!audit.unusedClassifications.length) lines.push("无。");
  audit.unusedClassifications.forEach((classification) => {
    lines.push(
      `- \`${classification.file}\`：${classification.label}（${classification.reason}）`,
    );
  });
  lines.push("", "## 未解析动态权限按钮", "");
  if (!audit.unresolvedDynamicPermissions.length) lines.push("无。");
  audit.unresolvedDynamicPermissions.forEach((button) => {
    lines.push(
      `- \`${button.file}\`：${button.label}（\`${normalizePermissionExpression(button.permissionExpression ?? "")}\`）`,
    );
  });
  lines.push("", "## 未命中的动态权限契约", "");
  if (!audit.unusedDynamicPermissionSources.length) lines.push("无。");
  audit.unusedDynamicPermissionSources.forEach((source) => {
    lines.push(
      `- \`${source.file}\`：\`${source.variable}\`（${source.reason}）`,
    );
  });
  return `${lines.join("\n")}\n`;
}

async function main() {
  const root = process.cwd();
  const pagesDir = path.join(root, "src/pages");
  const classifications = loadButtonClassifications(
    path.join(root, "scripts/page-button-classifications.json"),
  );
  const dynamicPermissionSources = loadDynamicPermissionSources(
    path.join(root, "scripts/page-button-dynamic-permissions.json"),
  );
  const buttons = walkVueFiles(pagesDir)
    .filter((file) => !file.endsWith("ComponentGuidePage.vue"))
    .flatMap((file) =>
      auditVueSource(readFileSync(file, "utf8"), path.relative(root, file)),
    );
  const audit = buildButtonAudit(
    buttons,
    classifications,
    dynamicPermissionSources,
  );
  console.log(
    process.argv.includes("--json")
      ? JSON.stringify(audit, null, 2)
      : toMarkdown(audit),
  );
  if (!audit.passed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
