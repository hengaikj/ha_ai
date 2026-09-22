const MAX_VEHICLE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_VEHICLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_VEHICLE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

export function validateVehicleImageFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (
    !ALLOWED_VEHICLE_IMAGE_TYPES.has(file.type.toLowerCase()) ||
    !ALLOWED_VEHICLE_IMAGE_EXTENSIONS.has(extension)
  ) {
    return "请选择 JPG、JPEG 或 PNG 图片";
  }
  if (file.size > MAX_VEHICLE_IMAGE_SIZE) {
    return "图片大小不能超过 5MB";
  }
  return null;
}
