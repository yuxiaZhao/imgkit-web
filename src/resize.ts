import type { ImageDataLike, ResizeOptions, FitMode } from "./types";
import { createImageData, clamp } from "./utils";

export function computeTargetSize(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  fit: FitMode,
): { w: number; h: number } {
  // 单边为0时按比例推算
  if (targetW === 0 && targetH === 0) return { w: srcW, h: srcH };
  if (targetW === 0) {
    const ratio = targetH / srcH;
    return { w: Math.round(srcW * ratio), h: targetH };
  }
  if (targetH === 0) {
    const ratio = targetW / srcW;
    return { w: targetW, h: Math.round(srcH * ratio) };
  }

  const srcRatio = srcW / srcH;
  const dstRatio = targetW / targetH;

  switch (fit) {
    case "contain": {
      // 完整放入目标区域内，不裁剪
      if (srcRatio > dstRatio) {
        return { w: targetW, h: Math.round(targetW / srcRatio) };
      }
      return { w: Math.round(targetH * srcRatio), h: targetH };
    }
    case "cover": {
      // 铺满目标区域，超出部分会被裁剪
      if (srcRatio > dstRatio) {
        return { w: Math.round(targetH * srcRatio), h: targetH };
      }
      return { w: targetW, h: Math.round(targetW / srcRatio) };
    }
    case "exact":
    case "fill":
    default:
      return { w: targetW, h: targetH };
  }
}

function nearestNeighbor(
  src: ImageDataLike,
  dstW: number,
  dstH: number,
): ImageDataLike {
  const dst = createImageData(dstW, dstH);
  const srcData = src.data;
  const dstData = dst.data;
  const xRatio = src.width / dstW;
  const yRatio = src.height / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.floor(dy * yRatio);
    const srcRowBase = sy * src.width * 4;
    const dstRowBase = dy * dstW * 4;
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.floor(dx * xRatio);
      const si = srcRowBase + sx * 4;
      const di = dstRowBase + dx * 4;
      dstData[di] = srcData[si];
      dstData[di + 1] = srcData[si + 1];
      dstData[di + 2] = srcData[si + 2];
      dstData[di + 3] = srcData[si + 3];
    }
  }
  return dst;
}

function bilinear(
  src: ImageDataLike,
  dstW: number,
  dstH: number,
): ImageDataLike {
  const dst = createImageData(dstW, dstH);
  const srcData = src.data;
  const dstData = dst.data;
  const srcW = src.width;
  const srcH = src.height;
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * yRatio;
    const sy0 = Math.floor(sy);
    const sy1 = Math.min(sy0 + 1, srcH - 1);
    const fy = sy - sy0;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * xRatio;
      const sx0 = Math.floor(sx);
      const sx1 = Math.min(sx0 + 1, srcW - 1);
      const fx = sx - sx0;

      const i00 = (sy0 * srcW + sx0) * 4;
      const i01 = (sy0 * srcW + sx1) * 4;
      const i10 = (sy1 * srcW + sx0) * 4;
      const i11 = (sy1 * srcW + sx1) * 4;

      const di = (dy * dstW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const v =
          srcData[i00 + c] * (1 - fx) * (1 - fy) +
          srcData[i01 + c] * fx * (1 - fy) +
          srcData[i10 + c] * (1 - fx) * fy +
          srcData[i11 + c] * fx * fy;
        dstData[di + c] = clamp(Math.round(v), 0, 255);
      }
    }
  }
  return dst;
}

export function resize(src: ImageDataLike, opts: ResizeOptions): ImageDataLike {
  const targetW = opts.width ?? 0;
  const targetH = opts.height ?? 0;
  const fit = opts.fit ?? "contain";
  const algo = opts.algorithm ?? "bilinear";

  const { w, h } = computeTargetSize(src.width, src.height, targetW, targetH, fit);

  if (w === src.width && h === src.height) {
    // 尺寸没变，直接返回副本
    return {
      data: new Uint8ClampedArray(src.data),
      width: src.width,
      height: src.height,
    };
  }

  return algo === "nearest" ? nearestNeighbor(src, w, h) : bilinear(src, w, h);
}