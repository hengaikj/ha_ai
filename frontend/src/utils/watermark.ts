export interface WatermarkSettings {
  watermarkId: string;
  watermarkText: string;
  x: number;
  y: number;
  xSpace: number;
  ySpace: number;
  font: string;
  fontWeight: number;
  color: string;
  fontSize: string;
  alpha: number;
  width: number;
  height: number;
  angle: number;
  zIndex: number;
  parentNode: HTMLElement | null;
}

const defaultSettings: WatermarkSettings = {
  watermarkId: "wm_div_id",
  watermarkText: "收益与成本管理系统",
  x: 20,
  y: 20,
  xSpace: 100,
  ySpace: 50,
  font: "Microsoft YaHei, Arial, sans-serif",
  fontWeight: 300,
  color: "black",
  fontSize: "15px",
  alpha: 0.1,
  width: 320,
  height: 100,
  angle: -15,
  zIndex: 9999,
  parentNode: null,
};

function resolveParent(parentNode: HTMLElement | null): HTMLElement {
  return parentNode ?? document.body;
}

function createWatermarkBackground(settings: WatermarkSettings): string {
  const canvas = document.createElement("canvas");
  canvas.width = settings.width + settings.xSpace;
  canvas.height = settings.height + settings.ySpace;

  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return "";
  }
  if (!ctx) {
    return "";
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = settings.alpha;
  ctx.fillStyle = settings.color;
  ctx.font = `${settings.fontWeight} ${settings.fontSize} ${settings.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.translate(settings.x + settings.width / 2, settings.y + settings.height / 2);
  ctx.rotate((Math.PI / 180) * settings.angle);
  ctx.fillText(settings.watermarkText, -settings.width / 2, 0, settings.width);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function applyContainerStyle(
  container: HTMLDivElement,
  settings: WatermarkSettings,
  backgroundUrl: string,
): void {
  const parent = resolveParent(settings.parentNode);
  const isBodyParent = parent === document.body;

  Object.assign(container.style, {
    position: isBodyParent ? "fixed" : "absolute",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: String(settings.zIndex),
    backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "none",
    backgroundRepeat: "repeat",
    backgroundPosition: "0 0",
  });
}

const Watermark = {
  set(settings: Partial<WatermarkSettings> = {}): void {
    if (typeof document === "undefined") {
      return;
    }

    const finalSettings = { ...defaultSettings, ...settings };
    const parent = resolveParent(finalSettings.parentNode);
    this.clear(finalSettings.watermarkId);

    const container = document.createElement("div");
    container.id = finalSettings.watermarkId;
    container.setAttribute("aria-hidden", "true");
    container.dataset.watermarkText = finalSettings.watermarkText;
    applyContainerStyle(
      container,
      finalSettings,
      createWatermarkBackground(finalSettings),
    );

    parent.appendChild(container);
  },

  clear(watermarkId = defaultSettings.watermarkId): void {
    if (typeof document === "undefined") {
      return;
    }

    document.getElementById(watermarkId)?.remove();
  },
};

export default Watermark;
