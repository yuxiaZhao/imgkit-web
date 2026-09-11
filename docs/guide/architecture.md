# 架构设计

## 整体架构

imgpilot 采用扁平模块化设计，所有功能模块平铺在 `src/` 下：

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

## 核心设计原则

### 纯函数核心

所有处理函数签名形如 `(image: ImageDataLike, options) => ImageDataLike`，输入输出均为 `{ width, height, data: Uint8ClampedArray }`，不依赖任何运行时 API。

**优点**：
- 可在任何 JS 环境运行（浏览器、Deno、Worker）
- 易于单元测试（无 mock 需求）
- 算法实现完全开源，便于审查与教学

### 编码器/文本渲染器注入

压缩、转换等需要"将 ImageData 编码为二进制"的功能，通过 `Encoder` 接口注入；文本水印通过 `TextRenderer` 接口注入：

```ts
interface Encoder {
  encode(data: ImageDataLike, mimeType: ImageMimeType, quality?: number): Promise<Blob>;
}

interface TextRenderer {
  renderText(text: string, options: { font: string; color: string; rotate?: number }): ImageDataLike;
}
```

### 入口与导出

`package.json` 的 `exports` 字段实现条件导出：

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" }
  }
}
```

## 链式 Pipeline

`Pipeline` 类封装了链式 API，每个方法返回 `this`，并内置历史快照用于 undo/redo：

```ts
class Pipeline {
  crop(options): this
  resize(options): this
  rotate(degrees): this
  flip(axis): this
  filter(options): this
  watermark(options): this
  async compress(options): Promise<CompressResult>
  async convert(mime, quality?): Promise<Blob>
  async toBlob(mime, quality?): Promise<Blob>
  toImageData(): ImageDataLike
  metadata(): ImageMetadata
  get canUndo(): boolean
  get canRedo(): boolean
  undo(): this
  redo(): this
}
```

## 构建配置

| 工具 | 用途 |
|------|------|
| tsup | 库构建（ESM + CJS + DTS） |
| Vite | Demo 站点开发与构建 |
| VitePress | 文档站点 |
| ESLint + Prettier | 代码规范与格式化 |

## 依赖清单

### 开发依赖

- typescript / tsup / vite / vitepress / eslint / prettier

所有图像处理算法均为原创实现，未引入 sharp/jimp/lwip 等第三方图像库。