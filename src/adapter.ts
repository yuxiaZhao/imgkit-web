import type { ImageDataLike, ImageMimeType, Encoder, TextRenderer } from "./types";

// ─── 图片加载 ───

export async function loadImage(
  source: File | Blob | string | ArrayBuffer,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    if (source instanceof File || source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else if (source instanceof ArrayBuffer) {
      const blob = new Blob([source]);
      img.src = URL.createObjectURL(blob);
    } else {
      img.src = source;
    }
  });
}

// ─── Canvas 创建 ───

export function createCanvas(
  w: number,
  h: number,
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// ─── 像素数据提取 ───

export function getImageData(
  source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas,
): ImageDataLike {
  if (source instanceof HTMLImageElement) {
    const c = createCanvas(source.width, source.height);
    const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    const imgData = ctx.getImageData(0, 0, source.width, source.height);
    return { data: imgData.data, width: source.width, height: source.height };
  }
  const ctx = source.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, source.width, source.height);
  return { data: imgData.data, width: source.width, height: source.height };
}

// ─── 像素数据写入 ───

export function putImageData(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  data: ImageDataLike,
): void {
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(data.data), data.width, data.height),
    0,
    0,
  );
}

// ─── 编码输出 ───

export function toBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mime: ImageMimeType,
  quality?: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("toBlob 返回空"));
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

export function toDataURL(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mime: ImageMimeType,
  quality?: number,
): string {
  if (canvas instanceof OffscreenCanvas) {
    throw new Error("OffscreenCanvas 不支持 toDataURL，请使用 toBlob");
  }
  return canvas.toDataURL(mime, quality);
}

// ─── 浏览器编码器 ───

export const browserEncoder: Encoder = {
  async encode(
    data: ImageDataLike,
    mimeType: ImageMimeType,
    quality = 0.92,
  ): Promise<Blob> {
    const c = createCanvas(data.width, data.height);
    putImageData(c, data);
    return toBlob(c, mimeType, quality);
  },
};

// ─── 文本渲染 ───

export function renderText(
  text: string,
  options: { font: string; color: string; rotate?: number },
): ImageDataLike {
  const fontSize = parseInt(options.font, 10) || 32;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = options.font;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.2;

  const angle = options.rotate ?? 0;
  const rad = (angle * Math.PI) / 180;
  const absSin = Math.abs(Math.sin(rad));
  const absCos = Math.abs(Math.cos(rad));
  const rotatedW = textWidth * absCos + textHeight * absSin;
  const rotatedH = textWidth * absSin + textHeight * absCos;

  c.width = Math.ceil(rotatedW) + 4;
  c.height = Math.ceil(rotatedH) + 4;

  ctx.save();
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rad);
  ctx.font = options.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = options.color;
  ctx.fillText(text, 0, 0);
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  return { data: imgData.data, width: c.width, height: c.height };
}

// ─── 默认文本渲染器 ───

export const browserTextRenderer: TextRenderer = {
  renderText,
};