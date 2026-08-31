import type { FlipAxis, ImageDataLike } from "./types";
import { createImageData, clamp, degToRad } from "./utils";

export function flip(src: ImageDataLike, axis: FlipAxis): ImageDataLike {
  const { width: w, height: h, data } = src;
  const dst = createImageData(w, h);
  const d = dst.data;

  if (axis === "horizontal") {
    for (let y = 0; y < h; y++) {
      const rowBase = y * w * 4;
      for (let x = 0; x < w; x++) {
        const si = rowBase + x * 4;
        const di = rowBase + (w - 1 - x) * 4;
        d[di] = data[si];
        d[di + 1] = data[si + 1];
        d[di + 2] = data[si + 2];
        d[di + 3] = data[si + 3];
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      const srcRowBase = y * w * 4;
      const dstRowBase = (h - 1 - y) * w * 4;
      for (let x = 0; x < w; x++) {
        const si = srcRowBase + x * 4;
        const di = dstRowBase + x * 4;
        d[di] = data[si];
        d[di + 1] = data[si + 1];
        d[di + 2] = data[si + 2];
        d[di + 3] = data[si + 3];
      }
    }
  }
  return dst;
}

export function rotate90Once(src: ImageDataLike): ImageDataLike {
  // 顺时针90°
  const { width: w, height: h, data } = src;
  const dst = createImageData(h, w);
  const d = dst.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = (x * h + (h - 1 - y)) * 4;
      d[di] = data[si];
      d[di + 1] = data[si + 1];
      d[di + 2] = data[si + 2];
      d[di + 3] = data[si + 3];
    }
  }
  return dst;
}

export function rotate90(src: ImageDataLike, deg: number): ImageDataLike {
  const n = ((deg % 360) + 360) % 360;
  const times = Math.round(n / 90) % 4;

  if (times === 0) {
    return { data: new Uint8ClampedArray(src.data), width: src.width, height: src.height };
  }

  let result = src;
  for (let i = 0; i < times; i++) {
    result = rotate90Once(result);
  }
  return result;
}

function rotateArbitrary(
  src: ImageDataLike,
  radians: number,
): ImageDataLike {
  const { width: w, height: h, data } = src;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const nw = Math.round(h * sin + w * cos);
  const nh = Math.round(h * cos + w * sin);
  const dst = createImageData(nw, nh);
  const d = dst.data;

  const cx = w / 2;
  const cy = h / 2;
  const dcx = nw / 2;
  const dcy = nh / 2;
  const cosA = Math.cos(-radians);
  const sinA = Math.sin(-radians);

  for (let dy = 0; dy < nh; dy++) {
    for (let dx = 0; dx < nw; dx++) {
      // 目标像素映射回源图坐标
      const sx = (dx - dcx) * cosA - (dy - dcy) * sinA + cx;
      const sy = (dx - dcx) * sinA + (dy - dcy) * cosA + cy;

      if (sx < 0 || sx >= w - 1 || sy < 0 || sy >= h - 1) continue;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * w + x0) * 4;
      const i01 = (y0 * w + x1) * 4;
      const i10 = (y1 * w + x0) * 4;
      const i11 = (y1 * w + x1) * 4;

      const di = (dy * nw + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const v =
          data[i00 + c] * (1 - fx) * (1 - fy) +
          data[i01 + c] * fx * (1 - fy) +
          data[i10 + c] * (1 - fx) * fy +
          data[i11 + c] * fx * fy;
        d[di + c] = clamp(Math.round(v), 0, 255);
      }
    }
  }
  return dst;
}

export function rotate(src: ImageDataLike, degrees: number): ImageDataLike {
  const n = ((degrees % 360) + 360) % 360;
  if (n % 90 === 0) return rotate90(src, n);
  return rotateArbitrary(src, degToRad(n));
}