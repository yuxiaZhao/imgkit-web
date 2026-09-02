import type { ImageDataLike, ImageMimeType, CompressOptions, CompressResult } from "./types";

const defaultCanvas = () => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1);
  return document.createElement("canvas");
};

async function encode(
  data: ImageDataLike,
  mime: ImageMimeType,
  quality: number,
): Promise<{ blob: Blob; mimeType: string }> {
  const canvas = defaultCanvas();
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data.data), data.width, data.height), 0, 0);

  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: mime, quality });
    return { blob, mimeType: mime };
  }
  // fallback to toBlob via canvas
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (!blob) return reject(new Error("toBlob 返回空"));
        resolve({ blob, mimeType: mime });
      },
      mime,
      quality,
    );
  });
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

  // 最低质量仍超限 → 尝试无损格式降级
  if (mime === "image/png") {
    const { blob } = await encode(data, "image/webp", 0.1);
    return { blob, quality: 0.1, size: blob.size, mimeType: "image/webp" };
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