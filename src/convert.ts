import type { ImageDataLike, ImageMimeType } from "./types";

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

  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data.data), data.width, data.height), 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("格式转换失败"));
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}