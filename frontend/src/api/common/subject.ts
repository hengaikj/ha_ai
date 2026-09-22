/**
 * 公共 - 科目数据 API
 * 模板关联科目等下拉场景使用收益科目树，不再请求已下线的 /revenue/subject/list。
 */
import { expenseSubjectTree } from "@/api/system/expenses";

type SubjectOption = {
  id: string;
  label: string;
  name?: string;
  subject?: string;
};

type SubjectTreeNode = {
  id?: string | number;
  subjectName?: string;
  subject_name?: string;
  name?: string;
  children?: SubjectTreeNode[];
};

function safeText(value: unknown): string {
  return String(value == null ? "" : value).trim();
}

function unwrapSubjectTree(payload: unknown): SubjectTreeNode[] {
  if (Array.isArray(payload)) {
    return payload as SubjectTreeNode[];
  }
  if (payload && typeof payload === "object") {
    const source = payload as { data?: unknown; rows?: unknown };
    if (Array.isArray(source.data)) {
      return source.data as SubjectTreeNode[];
    }
    if (Array.isArray(source.rows)) {
      return source.rows as SubjectTreeNode[];
    }
  }
  return [];
}

function flattenSubjectOptions(
  nodes: SubjectTreeNode[],
  parentPath = "",
): SubjectOption[] {
  const options: SubjectOption[] = [];
  nodes.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const name = safeText(node.subjectName || node.subject_name || node.name);
    if (!node.id || !name) {
      return;
    }
    const label = parentPath ? `${parentPath} / ${name}` : name;
    options.push({
      id: String(node.id),
      label,
      name,
      subject: name,
    });
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length) {
      options.push(...flattenSubjectOptions(children, label));
    }
  });
  return options;
}

/**
 * 查询启用中的收益科目，供模板关联科目下拉使用。
 */
export async function querySubjectData(): Promise<{ data?: SubjectOption[] }> {
  const payload = await expenseSubjectTree({ enabled: true });
  return {
    data: flattenSubjectOptions(unwrapSubjectTree(payload)),
  };
}
