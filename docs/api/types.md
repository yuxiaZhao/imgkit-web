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

## 图片隐写类型

### LsbDepth

```ts
type LsbDepth = 1 | 2 | 3 | 4
```

LSB 比特深度。1 = 每通道最低位（最隐蔽），数值越大容量越大但像素改动越明显。

### SteganographyChannels

```ts
type SteganographyChannels = 'R' | 'G' | 'B' | 'RG' | 'RB' | 'GB' | 'RGB'
```

隐写使用的颜色通道。

### SteganographyEmbedOptions

```ts
interface SteganographyEmbedOptions {
  message: string;              // 待嵌入的文本（必填）
  key?: string;                 // 加密密钥，留空则不加密
  depth?: LsbDepth;             // LSB 比特深度，默认 1
  channels?: SteganographyChannels; // 颜色通道，默认 'RGB'
}
```

### SteganographyExtractOptions

```ts
interface SteganographyExtractOptions {
  key?: string;                       // 解密密钥（与嵌入时一致）
  depth?: LsbDepth;                   // 与嵌入时一致的比特深度，默认 1
  channels?: SteganographyChannels;    // 与嵌入时一致的颜色通道
}
```

### SteganographyEmbedResult

```ts
interface SteganographyEmbedResult {
  image: ImageDataLike;     // 嵌入后的图片数据
  bitsWritten: number;       // 实际写入的比特数
  bytesWritten: number;      // 实际写入的字节数（含头部）
  capacity: number;          // 图片总可用容量（字节）
}
```

### SteganographyExtractResult

```ts
interface SteganographyExtractResult {
  success: boolean;     // 是否成功检测到隐写魔数头
  message: string;      // 提取出的文本（失败时为空字符串）
  bytesRead: number;    // 实际读取的字节数
}
```