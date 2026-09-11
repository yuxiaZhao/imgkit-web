# 快速开始

## 安装

```bash
npm install imgpilot
```

## 浏览器使用

### 链式调用

```ts
import { imgpilot, Position } from 'imgpilot';

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
import { crop, resize, filter, metadata } from 'imgpilot';
import { loadImage, getImageData, toDataURL } from 'imgpilot';

const img = await loadImage(file);
const id = getImageData(img);
const cropped = crop(id, { aspectRatio: 16 / 9 });
const filtered = filter(cropped, { grayscale: 0.5 });
const url = toDataURL({ data: filtered.data, width: filtered.width, height: filtered.height }, 'image/png');
```

### 批量处理

```ts
import { imgkitBatch, Position } from 'imgpilot';

const pipelines = await imgkitBatch([fileA, fileB, fileC]);
for (const p of pipelines) {
  p.resize({ width: 800 }).watermark({ text: 'watermark', position: Position.Center });
  const blob = await p.toBlob('image/jpeg', 0.85);
}
```

## Demo 站点

启动本地 Demo 体验完整功能：

```bash
npm run dev:demo
```

浏览器打开 `http://localhost:3000`，上传图片 → 设置参数 → 执行处理 → 预览下载。

也可直接访问在线站点：[imgpilot.pages.dev](https://imgpilot.pages.dev/)
