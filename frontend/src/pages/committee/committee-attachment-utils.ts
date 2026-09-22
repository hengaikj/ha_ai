const committeeAttachmentExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".pptx",
];

export function isSupportedCommitteeAttachment(file: File) {
  const fileName = file.name.toLowerCase();
  return committeeAttachmentExtensions.some((extension) =>
    fileName.endsWith(extension),
  );
}
