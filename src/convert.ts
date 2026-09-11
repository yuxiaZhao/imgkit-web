import type { ImageDataLike, ImageMimeType } from "./types";
import { createCanvas, putImageData, toBlob } from "./adapter";

export function normalizeMime(raw: string): ImageMimeType {
  const m = raw.trim().toLowerCase();
  if (m === "image/jpg" || m === "image/jpeg") return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/webp") return "image/webp";
  return "image/png"; // 兜底用 PNG
}

export async function convert(
  data: ImageDataLike,
  mimeType: ImageMimeType,
  quality = 0.92,
): Promise<Blob> {
  const mime = normalizeMime(mimeType);
  const canvas = createCanvas(data.width, data.height);
  putImageData(canvas, data);
  return toBlob(canvas, mime, quality);
}