import type { ImageDataLike, CropOptions } from "./types";
import { Position } from "./types";
import { createImageData } from "./utils";

function calcAspectCropRect(
  srcW: number,
  srcH: number,
  ratio: number,
  align: Position,
): { x: number; y: number; w: number; h: number } {
  const srcRatio = srcW / srcH;

  let w: number, h: number;
  if (srcRatio > ratio) {
    // 原图更宽，裁宽度
    h = srcH;
    w = Math.round(h * ratio);
  } else {
    // 原图更高，裁高度
    w = srcW;
    h = Math.round(w / ratio);
  }

  // 水平对齐
  let x: number;
  switch (align) {
    case Position.TopLeft:
    case Position.Left:
    case Position.BottomLeft:
      x = 0;
      break;
    case Position.TopRight:
    case Position.Right:
    case Position.BottomRight:
      x = srcW - w;
      break;
    default:
      x = Math.round((srcW - w) / 2);
  }

  // 垂直对齐
  let y: number;
  switch (align) {
    case Position.TopLeft:
    case Position.Top:
    case Position.TopRight:
      y = 0;
      break;
    case Position.BottomLeft:
    case Position.Bottom:
    case Position.BottomRight:
      y = srcH - h;
      break;
    default:
      y = Math.round((srcH - h) / 2);
  }

  return { x, y, w, h };
}

function validateBounds(
  srcW: number,
  srcH: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (w <= 0 || h <= 0) {
    throw new RangeError(`裁剪区域尺寸无效: ${w}x${h}`);
  }
  if (x < 0 || y < 0 || x + w > srcW || y + h > srcH) {
    throw new RangeError(
      `裁剪区域 (${x},${y},${w},${h}) 超出图片边界 (${srcW}x${srcH})`,
    );
  }
}

function extractPixels(
  src: ImageDataLike,
  x: number,
  y: number,
  w: number,
  h: number,
): ImageDataLike {
  const dst = createImageData(w, h);
  const srcData = src.data;
  const dstData = dst.data;

  for (let row = 0; row < h; row++) {
    const srcRowStart = ((y + row) * src.width + x) * 4;
    const dstRowStart = row * w * 4;
    // 逐行拷贝
    for (let col = 0; col < w; col++) {
      const si = srcRowStart + col * 4;
      const di = dstRowStart + col * 4;
      dstData[di] = srcData[si];
      dstData[di + 1] = srcData[si + 1];
      dstData[di + 2] = srcData[si + 2];
      dstData[di + 3] = srcData[si + 3];
    }
  }

  return dst;
}

export function crop(src: ImageDataLike, opts: CropOptions): ImageDataLike {
  const { width: srcW, height: srcH } = src;

  let x: number, y: number, w: number, h: number;

  if (opts.aspectRatio != null) {
    const align = opts.align ?? Position.Center;
    const rect = calcAspectCropRect(srcW, srcH, opts.aspectRatio, align);
    x = rect.x;
    y = rect.y;
    w = rect.w;
    h = rect.h;
  } else if (opts.x != null && opts.y != null && opts.width != null && opts.height != null) {
    x = opts.x;
    y = opts.y;
    w = opts.width;
    h = opts.height;
  } else {
    throw new TypeError(
      "crop: 必须指定裁剪区域 (x/y/width/height) 或 目标宽高比 (aspectRatio)",
    );
  }

  validateBounds(srcW, srcH, x, y, w, h);
  return extractPixels(src, x, y, w, h);
}