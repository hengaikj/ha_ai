import { listOaProjectUsers as listOaProjectUsersApi } from "@/api/system/expenses";
import {
  hasProjectId,
  parseListPayload,
  safeText,
} from "./workbench-utils";

function normalizePhoneNumber(value) {
  const text = safeText(value).replace(/\D/g, "");
  return /^1\d{10}$/.test(text) ? text : "";
}

function normalizeOaProjectUser(row = {}) {
  const source = row && typeof row === "object" ? row : {};
  return {
    userId: safeText(source.userId || source.id),
    userName: safeText(source.userName || source.nickName || source.name),
    phoneNumber: normalizePhoneNumber(source.phoneNumber || source.mobile || source.phonenumber),
  };
}

function uniqueByPhone(users = []) {
  const seen = {};
  return (Array.isArray(users) ? users : []).filter((user) => {
    const phone = normalizePhoneNumber(user && user.phoneNumber);
    if (!phone || seen[phone]) return false;
    seen[phone] = true;
    return true;
  });
}

export async function listProjectOaUsersByPermission(ctx, permissionKey) {
  if (!hasProjectId(ctx)) return [];
  const pageSize = 200;
  const users = [];
  try {
    for (let pageNum = 1; pageNum <= 20; pageNum += 1) {
      const payload = await listOaProjectUsersApi({
        projectId: ctx.projectId,
        permissions: [permissionKey],
        pageNum,
        pageSize,
      });
      const rows = parseListPayload(payload).map(normalizeOaProjectUser);
      users.push(...rows);
      if (rows.length < pageSize) break;
    }
    return uniqueByPhone(users);
  } catch (_error) {
    return uniqueByPhone(users);
  }
}
