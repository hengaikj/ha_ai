/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/**
 * 收益 - 用户上下文解析
 *
 * 对齐 Vue2 list-page.resolveCurrentUserContext：
 * - userId：数字用户主键（科目权限树等接口需要）
 * - loginName：登录名/邮箱（兼容历史 ownerId 写入；S3 单元格值已改为节点共享，不再按归属人过滤展示）
 */

/**
 * 解析当前用户上下文
 * @returns 用户上下文；未登录或无法解析数字用户主键时返回 null
 */
export function resolveCurrentUserContext(authStore: any) {
  const currentUser = authStore?.currentUser || authStore?.user || null;
  const numericId = String(currentUser?.id || authStore?.userId || "").trim();
  if (!numericId) {
    return null;
  }

  const loginName = String(currentUser?.username || "").trim();
  const userName = String(
    currentUser?.displayName ||
      currentUser?.nickName ||
      loginName ||
      numericId,
  ).trim();

  return {
    user: currentUser,
    permissions: authStore?.permissions || currentUser?.permissions || [],
    roles: authStore?.roles || currentUser?.roles || [],
    userName,
    /** 数字用户主键：科目权限 / reviewerId 等 */
    userId: numericId,
    /** 登录名：S3 records/query 的 ownerId 过滤 */
    loginName: loginName || numericId,
  };
}
