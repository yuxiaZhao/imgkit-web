# 类型定义

## ImageDataLike

```ts
interface ImageDataLike {
  data: Uint8ClampedArray; // RGBA，长度 = width * height * 4
  width: number;
  height: number;
}
```

与浏览器原生 `ImageData` 同构，兼容纯函数测试环境。

## ImageMimeType

```ts
type ImageMimeType = 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/webp'
```

## Position（九宫格）

```ts
enum Position {
  TopLeft = 'top-left',
  Top = 'top',
  TopRight = 'top-right',
  Left = 'left',
  Center = 'center',
  Right = 'right',
  BottomLeft = 'bottom-left',
  Bottom = 'bottom',
  BottomRight = 'bottom-right',
}
```

## FlipAxis

```ts
type FlipAxis = 'horizontal' | 'vertical'
```

## FitMode

```ts
type FitMode = 'contain' | 'cover' | 'exact' | 'fill'
```

## ResizeAlgorithm

```ts
type ResizeAlgorithm = 'nearest' | 'bilinear'
```

## 各 Options 接口

### CompressOptions

```ts
interface CompressOptions {
  quality?: number;       // 0-1
  maxSize?: number;       // 字节
  mimeType?: ImageMimeType;
}
```

### WatermarkOptions

```ts
interface WatermarkOptions {
  text?: string;
  image?: ImageDataLike;
  position?: Position;
  opacity?: number;
  rotate?: number;
  font?: string;
  color?: string;
  scale?: number;
  margin?: number;
  tile?: boolean;
  tileGap?: number;
}
```

### CropOptions

```ts
interface CropOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  align?: Position;
}
```

### ResizeOptions

```ts
interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: FitMode;
  algorithm?: ResizeAlgorithm;
}
```

### FilterOptions

```ts
interface FilterOptions {
  grayscale?: number;
  sepia?: number;
  brightness?: number;
  contrast?: number;
  blur?: number;
  invert?: number;
  opacity?: number;
  hueRotate?: number;
  saturate?: number;
}
```

### ImageMetadata

```ts
interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  pixels: number;
  channels: number;
  averageBrightness: number;
  hasAlpha: boolean;
}
```

### ExifInfo

```ts
interface ExifInfo {
  orientation?: number;
  make?: string;
  model?: string;
  dateTime?: string;
  gps?: { latitude: number; longitude: number };
}
```

### CompressResult

```ts
interface CompressResult {
  blob: Blob;
  quality: number;
  size: number;
  mimeType: string;
}
```

## Encoder / TextRenderer

```ts
interface Encoder {
  encode(data: ImageDataLike, mimeType: ImageMimeType, quality?: number): Promise<Blob>;
}

interface TextRenderer {
  renderText(text: string, options: { font: string; color: string; rotate?: number }): ImageDataLike;
}
```

## ZipEntry

```ts
interface ZipEntry {
  name: string;
  data: Uint8Array;
}
```