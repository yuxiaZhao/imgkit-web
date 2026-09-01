import type { ImageDataLike, FilterOptions } from "./types";
import { createImageData, cloneImageData, clamp, gaussianKernel } from "./utils";

function sepiaMatrix(r: number, g: number, b: number): [number, number, number] {
  return [
    clamp(r * 0.393 + g * 0.769 + b * 0.189, 0, 255),
    clamp(r * 0.349 + g * 0.686 + b * 0.168, 0, 255),
    clamp(r * 0.272 + g * 0.534 + b * 0.131, 0, 255),
  ];
}

// YIQ -> RGB 近似矩阵，用于 hueRotate
function hueRotateColor(r: number, g: number, b: number, cos: number, sin: number): [number, number, number] {
  // 灰度值
  const y = r * 0.299 + g * 0.587 + b * 0.114;
  const u = r * -0.14713 + g * -0.28886 + b * 0.436;
  const v = r * 0.615 + g * -0.51499 + b * -0.10001;

  const u2 = u * cos - v * sin;
  const v2 = u * sin + v * cos;

  return [
    clamp(y + u2 * 1.13983 + v2 * 1.13983, 0, 255),
    clamp(y + u2 * -0.39465 + v2 * -0.5806, 0, 255),
    clamp(y + u2 * 2.03211 + v2 * 0, 0, 255),
  ];
}

function conv1D(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  kernel: number[],
  horizontal: boolean,
) {
  const r = Math.floor(kernel.length / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let k = 0; k < kernel.length; k++) {
        const offset = k - r;
        const sx = horizontal ? x + offset : x;
        const sy = horizontal ? y : y + offset;
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        const idx = (sy * w + sx) * 4;
        const kw = kernel[k];
        rSum += src[idx] * kw;
        gSum += src[idx + 1] * kw;
        bSum += src[idx + 2] * kw;
        aSum += src[idx + 3] * kw;
      }
      const di = (y * w + x) * 4;
      dst[di] = clamp(Math.round(rSum), 0, 255);
      dst[di + 1] = clamp(Math.round(gSum), 0, 255);
      dst[di + 2] = clamp(Math.round(bSum), 0, 255);
      dst[di + 3] = clamp(Math.round(aSum), 0, 255);
    }
  }
}

function processPixel(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  i: number,
  opts: FilterOptions & { skipBlur?: boolean },
) {
  let r = src[i];
  let g = src[i + 1];
  let b = src[i + 2];
  let a = src[i + 3];

  if (opts.grayscale) {
    const v = r * 0.299 + g * 0.587 + b * 0.114;
    r = lerpPixel(r, v, opts.grayscale);
    g = lerpPixel(g, v, opts.grayscale);
    b = lerpPixel(b, v, opts.grayscale);
  }

  if (opts.sepia) {
    const [sr, sg, sb] = sepiaMatrix(r, g, b);
    r = lerpPixel(r, sr, opts.sepia);
    g = lerpPixel(g, sg, opts.sepia);
    b = lerpPixel(b, sb, opts.sepia);
  }

  if (opts.brightness !== undefined && opts.brightness !== 0) {
    const fac = 1 + opts.brightness;
    r = clamp(r * fac, 0, 255);
    g = clamp(g * fac, 0, 255);
    b = clamp(b * fac, 0, 255);
  }

  if (opts.contrast !== undefined && opts.contrast !== 0) {
    const fac = (259 * (opts.contrast * 255 + 255)) / (255 * (259 - opts.contrast * 255));
    r = clamp(fac * (r - 128) + 128, 0, 255);
    g = clamp(fac * (g - 128) + 128, 0, 255);
    b = clamp(fac * (b - 128) + 128, 0, 255);
  }

  if (opts.saturate !== undefined && opts.saturate !== 0) {
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = lerpPixel(gray, r, 1 + opts.saturate);
    g = lerpPixel(gray, g, 1 + opts.saturate);
    b = lerpPixel(gray, b, 1 + opts.saturate);
  }

  if (opts.hueRotate) {
    const rad = (opts.hueRotate * Math.PI) / 180;
    const [hr, hg, hb] = hueRotateColor(r, g, b, Math.cos(rad), Math.sin(rad));
    r = hr;
    g = hg;
    b = hb;
  }

  if (opts.invert) {
    r = lerpPixel(r, 255 - r, opts.invert);
    g = lerpPixel(g, 255 - g, opts.invert);
    b = lerpPixel(b, 255 - b, opts.invert);
  }

  if (opts.opacity !== undefined && opts.opacity < 1) {
    a = clamp(a * opts.opacity, 0, 255);
  }

  dst[i] = r;
  dst[i + 1] = g;
  dst[i + 2] = b;
  dst[i + 3] = a;
}

function lerpPixel(a: number, b: number, t: number): number {
  return clamp(Math.round(a + (b - a) * t), 0, 255);
}

export function filter(src: ImageDataLike, opts: FilterOptions): ImageDataLike {
  const { width: w, height: h } = src;

  let work = cloneImageData(src);

  // 高斯模糊先执行（可分离卷积）
  if (opts.blur && opts.blur > 0) {
    const radius = Math.ceil(opts.blur * 2);
    const sigma = opts.blur;
    const kernel = gaussianKernel(sigma, radius);
    const temp = createImageData(w, h);
    conv1D(work.data, temp.data, w, h, kernel, true);
    const blurred = createImageData(w, h);
    conv1D(temp.data, blurred.data, w, h, kernel, false);
    work = blurred;
  }

  const hasColorFilter =
    opts.grayscale || opts.sepia ||
    (opts.brightness !== undefined && opts.brightness !== 0) ||
    (opts.contrast !== undefined && opts.contrast !== 0) ||
    (opts.saturate !== undefined && opts.saturate !== 0) ||
    opts.hueRotate ||
    opts.invert ||
    (opts.opacity !== undefined && opts.opacity < 1);

  if (!hasColorFilter) return work;

  const dst = createImageData(w, h);
  const len = w * h * 4;
  for (let i = 0; i < len; i += 4) {
    processPixel(work.data, dst.data, i, opts);
  }
  return dst;
}