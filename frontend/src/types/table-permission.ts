import type { FieldPermission } from "@/utils/permission";

export type PermissionColumnSchema<TRow extends Record<string, unknown>> = {
  prop: keyof TRow & string;
  label: string;
  permission?: FieldPermission;
  formatter?: (value: unknown, row: TRow) => string | number;
  hiddenWhenDenied?: boolean;
  maskedValue?: string;
  unreadableText?: string;
  minWidth?: string | number;
  width?: string | number;
  align?: "left" | "center" | "right";
};

export type PermissionRowAction = {
  key: string;
  label: string;
  permission?: string | string[];
  type?: "primary" | "success" | "warning" | "danger" | "info" | "default";
  disabled?: boolean;
  disabledReason?: string;
};
