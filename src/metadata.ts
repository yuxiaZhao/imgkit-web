import type { ImageDataLike, ImageMetadata } from "./types";

export function metadata(src: ImageDataLike): ImageMetadata {
  const { data, width, height } = src;
  const pixels = width * height;
  const channels = 4;
  const size = pixels * channels;

  let totalBrightness = 0;
  let hasAlpha = false;

  for (let i = 0; i < size; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    totalBrightness += r * 0.299 + g * 0.587 + b * 0.114;
    if (a < 255) hasAlpha = true;
  }

  const averageBrightness = pixels > 0 ? totalBrightness / pixels : 0;

  return {
    width,
    height,
    size,
    pixels,
    channels,
    averageBrightness,
    hasAlpha,
  };
}