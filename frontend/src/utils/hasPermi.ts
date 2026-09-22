import { useAuthStore } from "@/stores/auth";

export function hasPermi(permissionCode?: string | string[]): boolean {
  const authStore = useAuthStore();
  return authStore.hasPermission(permissionCode);
}
