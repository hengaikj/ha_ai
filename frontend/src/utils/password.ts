const PASSWORD_COMPLEXITY_MESSAGE =
  "密码需为6-16位，且包含数字、大小写字母和特殊字符";

export function validatePasswordComplexity(password: string): string {
  if (password.length < 6 || password.length > 16) {
    return PASSWORD_COMPLEXITY_MESSAGE;
  }
  if (!/[0-9]/.test(password)) {
    return PASSWORD_COMPLEXITY_MESSAGE;
  }
  if (!/[a-z]/.test(password)) {
    return PASSWORD_COMPLEXITY_MESSAGE;
  }
  if (!/[A-Z]/.test(password)) {
    return PASSWORD_COMPLEXITY_MESSAGE;
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return PASSWORD_COMPLEXITY_MESSAGE;
  }

  return "";
}
