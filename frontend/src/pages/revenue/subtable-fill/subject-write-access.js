function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || fallback;
}

function readPermissionLevel(source = {}) {
  return safeText(
    source && (
      source.effectivePermissionLevel ||
      source.permissionLevel ||
      source.directPermissionLevel
    )
  ).toUpperCase();
}

function hasExplicitPermission(source = {}) {
  return Boolean(readPermissionLevel(source));
}

function canWriteSubject(source = {}) {
  if (!source || typeof source !== "object") return false;
  if (source.editable === true) return true;
  if (source.editable === false) return false;

  const level = readPermissionLevel(source);
  if (!level) return true;
  return level === "DATA_ENTRY" || level === "WRITE" || level === "WRITABLE";
}

function canReadSubject(source = {}) {
  if (!source || typeof source !== "object") return false;
  if (source.visible === false) return false;
  const level = readPermissionLevel(source);
  if (level === "NONE" || level === "NO_PERMISSION" || level === "DISABLED") return false;
  const readonlyReason = safeText(source.readonlyReason).toUpperCase();
  if (readonlyReason === "NO_PERMISSION") return false;
  return true;
}

function isVisibleSubjectLeaf(source = {}) {
  if (!source || typeof source !== "object") return false;
  return canReadSubject(source);
}

function isWritableSubjectLeaf(source = {}) {
  if (!source || typeof source !== "object") return false;
  if (hasExplicitPermission(source) || source.editable === true || source.editable === false) {
    return canWriteSubject(source);
  }
  if (source.readonly === true) return false;
  if (safeText(source.readonlyReason)) return false;
  return true;
}

function writeBucket(bucket, key, value, setter) {
  const normalizedKey = safeText(key);
  if (!normalizedKey) return;
  if (typeof setter === "function") {
    setter(bucket, normalizedKey, value);
    return;
  }
  bucket[normalizedKey] = value;
}

function collectVisibleSubjectIdsFromTree(nodes = [], bucket = {}, setter) {
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach((node) => {
    if (!node || typeof node !== "object") return;
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length) {
      collectVisibleSubjectIdsFromTree(children, bucket, setter);
      return;
    }
    if (!isVisibleSubjectLeaf(node)) return;
    writeBucket(bucket, node.subjectId || node.rowId || node.id, true, setter);
  });
  return bucket;
}

function collectWritableSubjectIdsFromTree(nodes = [], bucket = {}, setter) {
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach((node) => {
    if (!node || typeof node !== "object") return;
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length) {
      collectWritableSubjectIdsFromTree(children, bucket, setter);
      return;
    }
    if (!isWritableSubjectLeaf(node)) return;
    writeBucket(bucket, node.subjectId || node.rowId || node.id, true, setter);
  });
  return bucket;
}

function collectVisibleSubjectIdsFromRows(rows = [], bucket = {}, resolveSubjectId, setter) {
  const list = Array.isArray(rows) ? rows : [];
  list.forEach((row) => {
    if (!isVisibleSubjectLeaf(row)) return;
    const id = typeof resolveSubjectId === "function"
      ? resolveSubjectId(row)
      : row && (row.subjectId || row.rowId || row.id);
    writeBucket(bucket, id, true, setter);
  });
  return bucket;
}

function collectWritableSubjectIdsFromRows(rows = [], bucket = {}, resolveSubjectId, setter) {
  const list = Array.isArray(rows) ? rows : [];
  list.forEach((row) => {
    if (!isWritableSubjectLeaf(row)) return;
    const id = typeof resolveSubjectId === "function"
      ? resolveSubjectId(row)
      : row && (row.subjectId || row.rowId || row.id);
    writeBucket(bucket, id, true, setter);
  });
  return bucket;
}

const exports = {
  canReadSubject,
  canWriteSubject,
  collectVisibleSubjectIdsFromRows,
  collectVisibleSubjectIdsFromTree,
  collectWritableSubjectIdsFromRows,
  collectWritableSubjectIdsFromTree,
  isVisibleSubjectLeaf,
  isWritableSubjectLeaf,
  readPermissionLevel,
};

export default exports;
