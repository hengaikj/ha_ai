export const SENSITIVE_CONFIG_MASK = "******";

const sensitiveKeywords = [
  "password",
  "passwd",
  "secret",
  "token",
  "credential",
  "privatekey",
  "apikey",
  "accesskey",
  "feishuappid",
];

export function isSensitiveConfigKey(configKey: string): boolean {
  const normalized = configKey.toLowerCase().replaceAll(/[._-]/g, "");
  return sensitiveKeywords.some((keyword) => normalized.includes(keyword));
}

export function configValueForEditor(
  configKey: string,
  configValue: string | undefined,
): string {
  if (
    isSensitiveConfigKey(configKey) &&
    configValue === SENSITIVE_CONFIG_MASK
  ) {
    return "";
  }
  return configValue ?? "";
}

export function configValueForSubmit(input: {
  editing: boolean;
  configKey: string;
  configValue: string;
}): string {
  if (
    input.editing &&
    isSensitiveConfigKey(input.configKey) &&
    !input.configValue.trim()
  ) {
    return SENSITIVE_CONFIG_MASK;
  }
  return input.configValue;
}
