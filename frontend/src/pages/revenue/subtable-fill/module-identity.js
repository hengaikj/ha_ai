export function normalizeModuleScrollKey(value) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5:-]+/g, "_")
    .toLowerCase();
}

function appendNormalized(values, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => appendNormalized(values, item));
    return;
  }
  const key = normalizeModuleScrollKey(value);
  if (key && values.indexOf(key) === -1) values.push(key);
}

function appendModuleKey(values, value) {
  const key = normalizeModuleScrollKey(value);
  if (!key) return;
  appendNormalized(values, key);
  if (key.indexOf("module:") === 0) {
    appendNormalized(values, key.slice("module:".length));
  } else {
    appendNormalized(values, `module:${key}`);
  }
}

export function moduleIdentityKeyCandidates(source = {}) {
  if (!source || typeof source !== "object") return [];
  const values = [];
  appendNormalized(values, source.rootSubjectId);
  appendNormalized(values, source.displayRootSubjectId);
  appendNormalized(values, source.__moduleRootId);
  appendModuleKey(values, source.moduleKey);
  appendModuleKey(values, source.key);
  appendNormalized(values, source.rootSubjectName);
  appendNormalized(values, source.moduleName);
  appendNormalized(values, source.__moduleRootName);
  appendNormalized(values, source.name);
  appendNormalized(values, source.subtable);
  return values;
}

export function moduleScrollKeyCandidates(source = {}) {
  return moduleIdentityKeyCandidates(source);
}

export function moduleScrollKey(source = {}) {
  const keys = moduleScrollKeyCandidates(source);
  return keys[0] || "";
}

export function moduleScrollAliases(source = {}) {
  return moduleScrollKeyCandidates(source).join("|");
}

export function resolveModuleSectionBySource(source = {}, moduleSections = []) {
  const sourceKeys = moduleIdentityKeyCandidates(source);
  if (!sourceKeys.length) return null;
  return (Array.isArray(moduleSections) ? moduleSections : []).find((module) => {
    const moduleKeys = moduleIdentityKeyCandidates(module);
    return moduleKeys.some((key) => sourceKeys.indexOf(key) !== -1);
  }) || null;
}
