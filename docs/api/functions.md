# 函数式 API

所有核心函数均可单独 import：

```ts
import {
  crop, resize, rotate, rotate90, rotate90Once, flip, filter,
  watermark, applyWatermarkImage, applyTextWatermark, resolvePosition,
  compress, convert, metadata, parseExif, normalizeMime,
  createZip, crc32,
  imgkitBatch,
} from 'imgpilot';
```

浏览器工具函数：

```ts
import {
  loadImage, getImageData, putImageData, createCanvas,
  toBlob, toDataURL, renderText,
  browserEncoder, browserTextRenderer,
} from 'imgpilot';
```

## crop

```ts
function crop(image: ImageDataLike, options: CropOptions): ImageDataLike
```

`CropOptions`：
- `x`, `y`, `width`, `height`：区域裁剪
- `aspectRatio`：宽高比裁剪（与上互斥）
- `align`：宽高比模式下的对齐方式（Position）

## resize

```ts
function resize(image: ImageDataLike, options: ResizeOptions): ImageDataLike
```

`ResizeOptions`：
- `width`, `height`：目标尺寸（至少一个）
- `fit`：`'exact' | 'contain' | 'cover' | 'fill'`
- `algorithm`：`'nearest' | 'bilinear'`

## rotate / flip

```ts
function rotate(image: ImageDataLike, degrees: number): ImageDataLike
function rotate90(image: ImageDataLike, deg: number): ImageDataLike
function rotate90Once(image: ImageDataLike): ImageDataLike
function flip(image: ImageDataLike, axis: 'horizontal' | 'vertical'): ImageDataLike
```

`rotate` 支持任意角度，画布扩展以容纳完整图像，空白区域为透明。`rotate90` 是 90° 整数倍的高效实现，`rotate90Once` 是单次 90° 顺时针旋转。

## filter

```ts
function filter(image: ImageDataLike, options: FilterOptions): ImageDataLike
```

`FilterOptions` 所有字段可选：
- `grayscale` 0-1
- `sepia` 0-1
- `brightness` -1~1
- `contrast` -1~1
- `blur` >=0（高斯半径，可分离卷积）
- `invert` 0-1
- `opacity` 0-1
- `hueRotate` 角度
- `saturate` 0-1（1 为不变）

## watermark

```ts
function watermark(image, options, textRenderer?): ImageDataLike
function applyWatermarkImage(image, wmImage, options): ImageDataLike
function applyTextWatermark(image, text, options, textRenderer?): ImageDataLike
function resolvePosition(...)
```

## compress / convert

```ts
async function compress(image, options): Promise<CompressResult>
async function convert(image, mimeType, quality?): Promise<Blob>
```

`compress` 在指定 `maxSize` 时启用二分搜索：在 [0.1, quality] 范围内迭代 12 次，找最大满足体积约束的质量值。

## metadata

```ts
function metadata(image: ImageDataLike): ImageMetadata
```

返回 `{ width, height, size, pixels, channels, averageBrightness, hasAlpha }`。

## parseExif

```ts
function parseExif(buf: ArrayBuffer): ExifInfo
```

从 JPEG 原始字节中解析 EXIF 元信息。返回 `{ orientation, make, model, dateTime, gps }`，非 JPEG 或无 EXIF 字段时返回空对象。

## imgkitBatch

```ts
function imgkitBatch(sources: Array<File | Blob | string | ArrayBuffer>): Promise<Pipeline[]>
```

批量加载多张图片，返回各自独立的 Pipeline 实例数组。

```ts
const pipelines = await imgkitBatch([fileA, fileB, fileC]);
pipelines[0].resize({ width: 800 });
pipelines[1].filter({ grayscale: 1 });
```

## createZip / crc32

```ts
function createZip(entries: ZipEntry[]): Blob
function crc32(data: Uint8Array): number
```

`createZip` 将多个文件打包为 ZIP Blob，支持浏览器端下载。`crc32` 为 CRC-32 校验值计算。

```ts
const zipBlob = createZip([
  { name: 'result-1.jpg', data: uint8Array1 },
  { name: 'result-2.png', data: uint8Array2 },
]);
```

## 浏览器工具函数

```ts
function loadImage(source: File | Blob | string | ArrayBuffer): Promise<HTMLImageElement>
function getImageData(source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas): ImageDataLike
function putImageData(canvas: HTMLCanvasElement | OffscreenCanvas, data: ImageDataLike): void
function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas
function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas, mime: ImageMimeType, quality?: number): Promise<Blob>
function toDataURL(canvas: HTMLCanvasElement | OffscreenCanvas, mime: ImageMimeType, quality?: number): string
function renderText(text: string, options: { font: string; color: string; rotate?: number }): ImageDataLike
```

工具函数：

```ts
function createImageData(w: number, h: number): ImageDataLike
function cloneImageData(src: ImageDataLike): ImageDataLike
function getPixel(data: Uint8ClampedArray, offset: number): [number, number, number, number]
function setPixel(data: Uint8ClampedArray, offset: number, r: number, g: number, b: number, a: number): void
function packRGBA(r: number, g: number, b: number, a: number): number
function clamp(v: number, lo: number, hi: number): number
function lerp(a: number, b: number, t: number): number
function degToRad(deg: number): number
function gaussian(x: number, sigma: number): number
function gaussianKernel(sigma: number, radius: number): number[]
function binarySearchQuality(...): number
```