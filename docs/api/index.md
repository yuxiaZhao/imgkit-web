# 链式 API

`imgpilot(src)` 返回 `Pipeline` 实例，支持链式调用。`imgkitBatch(sources)` 可批量加载多张图片。

## 创建 Pipeline

```ts
import { imgpilot, imgkitBatch } from 'imgpilot';

// 单张图片
const p = await imgpilot(file);        // File/Blob
const p2 = await imgpilot(url);        // URL 字符串
const p3 = await imgpilot(arrayBuffer); // ArrayBuffer

// 批量加载
const pipelines = await imgkitBatch([fileA, fileB, fileC]);
pipelines[0].resize({ width: 800 });
pipelines[1].filter({ grayscale: 1 });
```

## 方法

### crop

```ts
p.crop({ x, y, width, height })          // 区域裁剪
p.crop({ aspectRatio: 16/9, align })      // 宽高比裁剪
```

### resize

```ts
p.resize({ width, height, fit, algorithm })
// fit: 'exact' | 'contain' | 'cover' | 'fill'
// algorithm: 'nearest' | 'bilinear'
```

### rotate / flip

```ts
p.rotate(45)                // 顺时针 45°
p.flip('horizontal')        // 水平翻转
p.flip('vertical')          // 垂直翻转
```

### filter

```ts
p.filter({
  grayscale: 0.5,
  sepia: 0.3,
  brightness: 0.2,
  contrast: 0.1,
  blur: 2,
  invert: 0.1,
  opacity: 0.9,
  hueRotate: 30,
  saturate: 1.2,
})
```

### watermark

```ts
// 文本水印
p.watermark({
  text: '© 2026',
  position: Position.BottomRight,
  opacity: 0.8,
  rotate: 0,
  font: '24px sans-serif',
  color: 'rgba(255,255,255,0.8)',
  margin: 16,
  tile: false,
  tileGap: 40,
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

### convert

```ts
const blob = await p.convert('image/webp', 0.9)
```

### toBlob / toImageData

```ts
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