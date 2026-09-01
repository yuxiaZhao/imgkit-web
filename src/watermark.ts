import type { ImageDataLike, WatermarkOptions, TextRenderer } from "./types";
import { Position } from "./types";
import { cloneImageData, clamp } from "./utils";

export function resolvePosition(
  canvasWidth: number,
  canvasHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
  position: Position = Position.BottomRight,
  margin = 16,
): { x: number; y: number } {
  const m = margin;
  switch (position) {
    case Position.TopLeft:
      return { x: m, y: m };
    case Position.Top:
      return { x: (canvasWidth - watermarkWidth) / 2, y: m };
    case Position.TopRight:
      return { x: canvasWidth - watermarkWidth - m, y: m };
    case Position.Left:
      return { x: m, y: (canvasHeight - watermarkHeight) / 2 };
    case Position.Center:
      return { x: (canvasWidth - watermarkWidth) / 2, y: (canvasHeight - watermarkHeight) / 2 };
    case Position.Right:
      return { x: canvasWidth - watermarkWidth - m, y: (canvasHeight - watermarkHeight) / 2 };
    case Position.BottomLeft:
      return { x: m, y: canvasHeight - watermarkHeight - m };
    case Position.Bottom:
      return { x: (canvasWidth - watermarkWidth) / 2, y: canvasHeight - watermarkHeight - m };
    case Position.BottomRight:
      return { x: canvasWidth - watermarkWidth - m, y: canvasHeight - watermarkHeight - m };
  }
}

function blendPixel(
  dst: Uint8ClampedArray,
  dstIdx: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const srcAlpha = a / 255;
  const dstAlpha = dst[dstIdx + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha === 0) {
    dst[dstIdx] = 0;
    dst[dstIdx + 1] = 0;
    dst[dstIdx + 2] = 0;
    dst[dstIdx + 3] = 0;
    return;
  }
  dst[dstIdx] = clamp(Math.round((r * srcAlpha + dst[dstIdx] * dstAlpha * (1 - srcAlpha)) / outAlpha), 0, 255);
  dst[dstIdx + 1] = clamp(Math.round((g * srcAlpha + dst[dstIdx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha), 0, 255);
  dst[dstIdx + 2] = clamp(Math.round((b * srcAlpha + dst[dstIdx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha), 0, 255);
  dst[dstIdx + 3] = clamp(Math.round(outAlpha * 255), 0, 255);
}

function stampWatermark(
  dst: ImageDataLike,
  watermark: ImageDataLike,
  wx: number,
  wy: number,
  opacity: number,
): void {
  const ww = watermark.width;
  const wh = watermark.height;
  const dw = dst.width;
  const dh = dst.height;
  const wData = watermark.data;
  const dData = dst.data;

  for (let y = 0; y < wh; y++) {
    const dy = wy + y;
    if (dy < 0 || dy >= dh) continue;
    for (let x = 0; x < ww; x++) {
      const dx = wx + x;
      if (dx < 0 || dx >= dw) continue;
      const wi = (y * ww + x) * 4;
      const sa = clamp(Math.round(wData[wi + 3] * opacity), 0, 255);
      if (sa === 0) continue;
      const di = (dy * dw + dx) * 4;
      blendPixel(dData, di, wData[wi], wData[wi + 1], wData[wi + 2], sa);
    }
  }
}

export function applyWatermarkImage(
  dst: ImageDataLike,
  watermark: ImageDataLike,
  options: WatermarkOptions,
): ImageDataLike {
  const result = cloneImageData(dst);
  const opacity = options.opacity ?? 1;
  const margin = options.margin ?? 16;
  const scale = options.scale ?? 1;
  const position = options.position ?? Position.BottomRight;

  let wm = watermark;
  if (scale !== 1) {
    const w = Math.round(watermark.width * scale);
    const h = Math.round(watermark.height * scale);
    if (w > 0 && h > 0) {
      wm = resizeWatermark(watermark, w, h);
    }
  }

  if (options.tile) {
    const gap = options.tileGap ?? 0;
    for (let y = 0; y < dst.height; y += wm.height + gap) {
      for (let x = 0; x < dst.width; x += wm.width + gap) {
        stampWatermark(result, wm, x, y, opacity);
      }
    }
  } else {
    const pos = resolvePosition(dst.width, dst.height, wm.width, wm.height, position, margin);
    stampWatermark(result, wm, pos.x, pos.y, opacity);
  }

  return result;
}

function resizeWatermark(src: ImageDataLike, w: number, h: number): ImageDataLike {
  const result = new Uint8ClampedArray(w * h * 4);
  const xRatio = src.width / w;
  const yRatio = src.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x * xRatio);
      const sy = Math.floor(y * yRatio);
      const si = (sy * src.width + sx) * 4;
      const di = (y * w + x) * 4;
      result[di] = src.data[si];
      result[di + 1] = src.data[si + 1];
      result[di + 2] = src.data[si + 2];
      result[di + 3] = src.data[si + 3];
    }
  }
  return { data: result, width: w, height: h };
}

export function applyTextWatermark(
  dst: ImageDataLike,
  text: string,
  options: WatermarkOptions,
  renderer: TextRenderer,
): ImageDataLike {
  const font = options.font ?? "24px sans-serif";
  const color = options.color ?? "rgba(255,255,255,0.8)";
  const rotate = options.rotate ?? 0;
  const textImage = renderer.renderText(text, { font, color, rotate });
  return applyWatermarkImage(dst, textImage, options);
}

export function watermark(
  src: ImageDataLike,
  options: WatermarkOptions,
  textRenderer?: TextRenderer,
): ImageDataLike {
  if (options.text && textRenderer) {
    return applyTextWatermark(src, options.text, options, textRenderer);
  }
  if (options.image) {
    return applyWatermarkImage(src, options.image, options);
  }
  return cloneImageData(src);
}