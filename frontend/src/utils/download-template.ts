import ExcelJS from "exceljs";

export type ExcelTemplateColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ExcelTemplateOptions = {
  fileName: string;
  sheetName: string;
  columns: ExcelTemplateColumn[];
  sampleRow: Record<string, string | number | null>;
};

export function downloadLocalTemplate(fileName: string): void {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const link = document.createElement("a");
  link.href = `${baseUrl}template/${encodeURIComponent(fileName)}`;
  link.download = fileName;
  link.click();
}

export async function downloadExcelTemplate(
  options: ExcelTemplateOptions,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName);
  worksheet.columns = options.columns;
  worksheet.addRow(options.sampleRow);
  worksheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    options.fileName,
  );
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
