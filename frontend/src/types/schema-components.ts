import type { FieldPermission } from "@/utils/permission";
import type { FormItemRule } from "element-plus";

export type SchemaOption = {
  label: string;
  value: string | number | boolean;
  type?: "primary" | "success" | "warning" | "danger" | "info";
  styleClass?:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | string;
  listClass?:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | string;
  cssClass?: string;
  color?: string;
  disabled?: boolean;
  raw?: Record<string, unknown>;
};

export type SchemaSearchField = {
  prop: string;
  label: string;
  component: "date" | "input" | "select";
  options?: SchemaOption[];
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
};

export type SchemaFormField = {
  prop: string;
  label: string;
  component:
    | "checkbox"
    | "date"
    | "input"
    | "input-number"
    | "radio"
    | "select"
    | "switch"
    | "textarea";
  options?: SchemaOption[];
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  required?: boolean;
  rules?: FormItemRule | FormItemRule[];
  span?: number;
  rows?: number;
  min?: number;
  max?: number;
  precision?: number;
  help?: string;
};

export type SchemaDescriptionItem = {
  prop: string;
  label: string;
  span?: number;
  permission?: FieldPermission;
  maskedValue?: string;
  unreadableText?: string;
};
