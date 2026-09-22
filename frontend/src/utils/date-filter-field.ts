type DateFilterField = {
  field?: unknown;
  value?: unknown;
  label?: unknown;
  fieldType?: unknown;
  dataType?: unknown;
};

export function isDateFilterField(field?: DateFilterField): boolean {
  const dataType = `${field?.fieldType || ""} ${field?.dataType || ""}`.toUpperCase();
  if (["DATE", "TIME", "DATETIME", "TIMESTAMP"].some((type) => dataType.includes(type))) {
    return true;
  }

  const fieldText = `${field?.field || ""} ${field?.value || ""} ${field?.label || ""}`.toLowerCase();
  return ["createtime", "createdat", "updatetime", "updatedat", "时间", "日期"].some((text) =>
    fieldText.includes(text),
  );
}
