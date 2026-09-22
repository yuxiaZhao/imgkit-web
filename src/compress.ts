import type { ImageDataLike, ImageMimeType, CompressOptions, CompressResult } from "./types";
import { createCanvas, putImageData, toBlob } from "./adapter";

async function encode(
  data: ImageDataLike,
  mime: ImageMimeType,
  quality: number,
): Promise<{ blob: Blob; mimeType: string }> {
  const canvas = createCanvas(data.width, data.height);
  putImageData(canvas, data);
  const blob = await toBlob(canvas, mime, quality);
  return { blob, mimeType: mime };
}

// 二分搜索：在 [low, high] 内找最大 quality 使体积 ≤ maxSize
async function binarySearchQuality(
  data: ImageDataLike,
  mime: ImageMimeType,
  maxSize: number,
  qMin: number,
  qMax: number,
): Promise<CompressResult> {
  let lo = qMin;
  let hi = qMax;
  let best: CompressResult | null = null;

  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const { blob } = await encode(data, mime, mid);
    const result: CompressResult = { blob, quality: mid, size: blob.size, mimeType: mime };

    if (blob.size <= maxSize) {
      best = result;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (best) return best;

  // 最低质量仍超限 → PNG 无损,quality 无法调节体积,降级为 WebP 二分搜索接近 maxSize
  if (mime === "image/png") {
    return binarySearchQuality(data, "image/webp", maxSize, 0.1, 1);
  }

  // 返回最低质量结果
  const { blob } = await encode(data, mime, qMin);
  return { blob, quality: qMin, size: blob.size, mimeType: mime };
}

export async function compress(
  data: ImageDataLike,
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const mime: ImageMimeType = opts.mimeType ?? "image/jpeg";
  const quality = opts.quality;
  const maxSize = opts.maxSize;

  // 仅质量压缩
  if (quality !== undefined && maxSize === undefined) {
    const q = Math.max(0.1, Math.min(1, quality));
    const { blob } = await encode(data, mime, q);
    return { blob, quality: q, size: blob.size, mimeType: mime };
  }

  if (maxSize !== undefined) {
    const qMax = quality !== undefined ? Math.min(1, quality) : 1;
    const qMin = 0.1;
    return binarySearchQuality(data, mime, maxSize, qMin, qMax);
  }

  // 无参数 → 默认 0.92
  const { blob } = await encode(data, mime, 0.92);
  return { blob, quality: 0.92, size: blob.size, mimeType: mime };
}