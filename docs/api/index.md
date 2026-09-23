# 链式 API

`imgpilot(src)` 返回 `Pipeline` 实例，支持链式调用。`imgkitBatch(sources)` 可批量加载多张图片。

## 创建 Pipeline

```ts
import { imgpilot, imgkitBatch } from 'imgkit-web';

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

### embed / extract（图片隐写）

将文本信息隐藏到图片像素的最低有效位（LSB）中，肉眼不可见。嵌入步骤会进入历史快照，支持 undo/redo；提取是只读操作，不修改当前图片。

```ts
// 嵌入文本到图片像素（LSB）
p.embed({
  message: '版权所有 © 2026',   // 待嵌入文本（必填）
  key: 'my-secret',             // 可选，密钥加密（XOR 流加密）
  depth: 1,                     // LSB 比特深度 1-4，默认 1
  channels: 'RGB',              // 颜色通道 R/G/B/RG/RB/GB/RGB，默认 RGB
})

// 从图片提取隐藏文本（只读）
const result = p.extract({ key: 'my-secret', depth: 1, channels: 'RGB' })
// result: { success: boolean, message: string, bytesRead: number }
```

**参数说明**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `message` | `string` | — | 待嵌入的文本（embed 必填） |
| `key` | `string` | — | 加密密钥，留空则不加密 |
| `depth` | `1 \| 2 \| 3 \| 4` | `1` | LSB 比特深度，数值越大容量越大但痕迹越明显 |
| `channels` | `SteganographyChannels` | `'RGB'` | 使用的颜色通道 |

**返回值**：

- `embed()` 返回 `this`（支持链式调用）
- `extract()` 返回 `SteganographyExtractResult`：
  - `success`：是否成功检测到隐写魔数头
  - `message`：提取出的文本（失败时为空字符串）
  - `bytesRead`：实际读取的字节数

> **注意**：嵌入后必须以 PNG 或 WebP 无损模式输出，JPEG 等有损压缩会破坏 LSB 数据。