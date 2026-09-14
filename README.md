# imgkit-web

纯前端图片处理工具库，浏览器端零原生依赖，提供链式 API 与函数式 API 两种调用风格。

[![npm version](https://img.shields.io/npm/v/imgkit-web)](https://www.npmjs.com/package/imgkit-web)
[![license](https://img.shields.io/npm/l/imgkit-web)](./LICENSE)

## 特性

- **纯前端零依赖** — 核心算法基于 ImageData 实现，不依赖任何第三方图像库（sharp/jimp），浏览器端零原生依赖
- **双调用风格** — 链式 API（`imgpilot(src).resize().watermark().toBlob()`）与函数式 API（`crop / resize / filter` 等独立函数），按场景选择
- **10 大功能模块** — 压缩、水印、裁剪、缩放、旋转翻转、格式转换、滤镜、元信息、EXIF 解析、ZIP 打包
- **TypeScript 严格模式** — 完整类型定义（`.d.ts`），所有接口严格类型化
- **撤销/重做内置** — Pipeline 内置快照历史，支持链式操作的撤销与重做
- **Demo 可视化** — 提供完整 Vite Demo 站点，上传 → 设置参数 → 预览 → 下载

## 安装

```bash
npm install imgkit-web
```

## 快速开始

### 链式调用

```ts
import { imgpilot, Position } from 'imgkit-web';

const pipeline = await imgpilot(file);
const result = await pipeline
  .resize({ width: 800, fit: 'contain' })
  .filter({ brightness: 0.1, saturate: 1.2 })
  .watermark({ text: '© 2026', position: Position.BottomRight, opacity: 0.8 })
  .compress({ maxSize: 100 * 1024 });

console.log(result.size, result.quality);
```

### 函数式调用

```ts
import { crop, resize, filter, loadImage, getImageData, toDataURL } from 'imgkit-web';

const img = await loadImage(file);
const id = getImageData(img);
const cropped = crop(id, { aspectRatio: 16 / 9 });
const filtered = filter(cropped, { grayscale: 0.5 });
const url = toDataURL(
  { data: filtered.data, width: filtered.width, height: filtered.height },
  'image/png'
);
```

### 批量处理

```ts
import { imgkitBatch, Position } from 'imgkit-web';

const pipelines = await imgkitBatch([fileA, fileB, fileC]);
for (const p of pipelines) {
  p.resize({ width: 800 }).watermark({ text: 'watermark', position: Position.Center });
  const blob = await p.toBlob('image/jpeg', 0.85);
}
```

## 链式 API

`imgpilot(src)` 返回 `Pipeline` 实例，支持链式调用。

```ts
const p = await imgpilot(file);        // File / Blob
const p = await imgpilot(url);         // URL 字符串
const p = await imgpilot(arrayBuffer); // ArrayBuffer
```

### crop

```ts
p.crop({ x, y, width, height })        // 区域裁剪
p.crop({ aspectRatio: 16/9, align })   // 宽高比裁剪
```

### resize

```ts
p.resize({ width, height, fit, algorithm })
// fit: 'exact' | 'contain' | 'cover' | 'fill'
// algorithm: 'nearest' | 'bilinear'
```

### rotate / flip

```ts
p.rotate(45)               // 顺时针 45°
p.flip('horizontal')       // 水平翻转
p.flip('vertical')         // 垂直翻转
```

### filter

```ts
p.filter({
  grayscale: 0.5, sepia: 0.3, brightness: 0.2, contrast: 0.1,
  blur: 2, invert: 0.1, opacity: 0.9, hueRotate: 30, saturate: 1.2,
})
```

### watermark

```ts
// 文本水印
p.watermark({
  text: '© 2026', position: Position.BottomRight,
  opacity: 0.8, font: '24px sans-serif', color: 'rgba(255,255,255,0.8)',
  margin: 16, tile: false, tileGap: 40,
})

// 图片水印
p.watermark({ image: watermarkImageData, position: Position.Center })
```

### compress

```ts
const result = await p.compress({
  quality: 0.8,           // 质量 0-1
  maxSize: 100 * 1024,    // 目标体积上限（字节），启用二分搜索
  mimeType: 'image/jpeg',
})
// result: { blob, quality, size, mimeType }
```

### convert / toBlob / toImageData

```ts
const blob = await p.convert('image/webp', 0.9)
const blob = await p.toBlob('image/jpeg', 0.8)
const id = p.toImageData()   // 取当前 ImageData（拷贝）
```

### metadata

```ts
const info = p.metadata()
// { width, height, size, pixels, channels, averageBrightness, hasAlpha }
```

### undo / redo

```ts
p.canUndo   // 是否可撤销
p.canRedo   // 是否可重做
p.undo()    // 撤销到上一步状态
p.redo()    // 重做到下一步状态
```

## 函数式 API

所有核心函数均可单独 import：

```ts
import {
  crop, resize, rotate, rotate90, rotate90Once, flip, filter,
  watermark, applyWatermarkImage, applyTextWatermark, resolvePosition,
  compress, convert, metadata, parseExif, normalizeMime,
  createZip, crc32, imgkitBatch,
} from 'imgkit-web';
```

浏览器工具函数：

```ts
import {
  loadImage, getImageData, putImageData, createCanvas,
  toBlob, toDataURL, renderText,
  browserEncoder, browserTextRenderer,
} from 'imgkit-web';
```

### 核心函数签名

| 函数 | 说明 |
|------|------|
| `crop(image, options)` | 区域裁剪 / 宽高比裁剪 |
| `resize(image, options)` | 缩放（最近邻 / 双线性，contain / cover / exact / fill） |
| `rotate(image, degrees)` | 任意角度旋转，透明填充空白区域 |
| `rotate90(image, deg)` | 90° 整数倍高效旋转 |
| `flip(image, axis)` | 水平 / 垂直翻转 |
| `filter(image, options)` | 灰度 / 棕褐 / 亮度 / 对比度 / 高斯模糊 / 反相 / 色相 / 饱和度 |
| `watermark(image, options, textRenderer?)` | 文本 / 图片水印，支持平铺、九宫格定位 |
| `compress(image, options)` | 质量压缩 + 目标体积二分搜索 |
| `convert(image, mimeType, quality?)` | JPEG / PNG / WebP 格式转换 |
| `metadata(image)` | 宽高 / 体积 / 平均亮度 / 透明通道检测 |
| `parseExif(buffer)` | JPEG EXIF 解析（方向 / 厂商 / 型号 / GPS 等） |
| `createZip(entries)` | 浏览器端 ZIP 打包 |
| `crc32(data)` | CRC-32 校验值计算 |
| `imgkitBatch(sources)` | 批量加载多张图片，返回 Pipeline 数组 |

### 浏览器工具函数

| 函数 | 说明 |
|------|------|
| `loadImage(source)` | 从 File / Blob / URL / ArrayBuffer 加载图片 |
| `getImageData(source)` | 从 Image / Canvas 提取像素数据 |
| `putImageData(canvas, data)` | 将像素数据写入 Canvas |
| `createCanvas(w, h)` | 创建 Canvas / OffscreenCanvas |
| `toBlob(canvas, mime, quality?)` | Canvas 导出为 Blob |
| `toDataURL(canvas, mime, quality?)` | Canvas 导出为 DataURL |
| `renderText(text, options)` | 渲染文本为 ImageData |

## 核心类型

```ts
interface ImageDataLike {
  data: Uint8ClampedArray; // RGBA, 长度 = width * height * 4
  width: number;
  height: number;
}

enum Position {
  TopLeft, Top, TopRight, Left, Center, Right,
  BottomLeft, Bottom, BottomRight,
}

type ImageMimeType = 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/webp'
type FitMode = 'contain' | 'cover' | 'exact' | 'fill'
type ResizeAlgorithm = 'nearest' | 'bilinear'
```

> 完整类型定义参见 [API 文档 - 类型定义](https://github.com/yuxiaZhao/imgkit-web/blob/main/docs/api/types.md)。

## 架构

所有图像处理模块平铺在 `src/` 下，核心算法为纯函数（输入输出均为 `ImageDataLike`），不依赖任何运行时 API，可在浏览器、Worker 等任意 JS 环境运行。

```
src/
├── types.ts       # 公共类型定义
├── utils.ts       # 工具函数（像素读写、数学工具）
├── adapter.ts     # 浏览器适配层（加载/编码/文本渲染）
├── pipeline.ts    # 链式 Pipeline（含撤销/重做）
├── crop.ts        # 裁剪算法
├── resize.ts      # 缩放算法（最近邻/双线性）
├── rotate.ts      # 旋转/翻转算法
├── filter.ts      # 滤镜算法（含高斯模糊）
├── watermark.ts   # 水印算法（Alpha 混合）
├── compress.ts    # 压缩策略（二分搜索）
├── convert.ts     # 格式转换
├── metadata.ts    # 元信息提取
├── exif.ts        # EXIF 解析
├── zip.ts         # ZIP 打包 / CRC-32
└── index.ts       # 统一入口
```

## 适用场景

- 浏览器端图片预处理（上传前压缩 / 加水印）
- 静态站点 / 博客的图片批处理
- 教学与算法研究（核心层完全开源）

## Demo 站点

在线预览：[imgkit-web.pages.dev](https://imgkit-web.pages.dev/)

启动本地 Demo：

```bash
npm run dev:demo
```

浏览器打开 `http://localhost:3000`，上传图片 → 设置参数 → 执行处理 → 预览下载。

## 文档

在线文档：[imgkit-web-docs.pages.dev](https://imgkit-web-docs.pages.dev/)

详细文档：

- [快速开始](https://github.com/yuxiaZhao/imgkit-web/blob/main/docs/guide/quickstart.md)
- [架构设计](https://github.com/yuxiaZhao/imgkit-web/blob/main/docs/guide/architecture.md)
- [链式 API](https://github.com/yuxiaZhao/imgkit-web/blob/main/docs/api/index.md)
- [函数式 API](https://github.com/yuxiaZhao/imgkit-web/blob/main/docs/api/functions.md)
- [类型定义](https://github.com/yuxiaZhao/imgkit-web/blob/main/docs/api/types.md)

## 许可证

[MIT](./LICENSE)