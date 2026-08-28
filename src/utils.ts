import type { ImageDataLike } from "./types";

export function createImageData(w: number, h: number): ImageDataLike {
  const len = w * h * 4;
  return { data: new Uint8ClampedArray(len), width: w, height: h };
}

export function cloneImageData(src: ImageDataLike): ImageDataLike {
  return {
    data: new Uint8ClampedArray(src.data),
    width: src.width,
    height: src.height,
  };
}

export function getPixel(
  src: ImageDataLike,
  x: number,
  y: number,
): [r: number, g: number, b: number, a: number] {
  const idx = (y * src.width + x) * 4;
  const d = src.data;
  return [d[idx], d[idx + 1], d[idx + 2], d[idx + 3]];
}

export function setPixel(
  dst: ImageDataLike,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const idx = (y * dst.width + x) * 4;
  const d = dst.data;
  d[idx] = r;
  d[idx + 1] = g;
  d[idx + 2] = b;
  d[idx + 3] = a;
}

export function assertImageData(img: ImageDataLike, label = "ImageData"): void {
  if (!img || typeof img.width !== "number" || typeof img.height !== "number") {
    throw new TypeError(`${label} 不是有效的 ImageDataLike 对象`);
  }
  const expected = img.width * img.height * 4;
  if (img.data.length !== expected) {
    throw new RangeError(`${label} 像素数据长度不匹配: 期望 ${expected}, 实际 ${img.data.length}`);
  }
}

export function packRGBA(r: number, g: number, b: number, a: number): number {
  return ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function gaussian(x: number, sigma: number): number {
  const s2 = sigma * sigma;
  return (1 / (2 * Math.PI * s2)) * Math.exp(-(x * x) / (2 * s2));
}

export function gaussianKernel(sigma: number, radius: number): number[] {
  const size = radius * 2 + 1;
  const kernel: number[] = [];
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const v = gaussian(x, sigma);
    kernel.push(v);
    sum += v;
  }
  // 归一化
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  return kernel;
}

export function binarySearchQuality(
  fn: (q: number) => Promise<{ size: number }>,
  maxSize: number,
  lo = 0.1,
  hi = 1.0,
  iterations = 12,
): Promise<number> {
  let best = lo;
  let remaining = iterations;

  const step = async (l: number, h: number): Promise<number> => {
    if (remaining <= 0) return best;
    remaining--;
    const mid = (l + h) / 2;
    const result = await fn(mid);
    if (result.size <= maxSize) {
      best = mid;
      if (l >= h) return best;
      return step(mid, h);
    }
    return step(l, mid);
  };

  return step(lo, hi);
}