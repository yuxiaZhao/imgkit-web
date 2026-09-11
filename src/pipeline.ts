import { cloneImageData } from "./utils";
import { crop } from "./crop";
import { resize } from "./resize";
import { flip } from "./rotate";
import { rotate } from "./rotate";
import { filter } from "./filter";
import { watermark } from "./watermark";
import { compress } from "./compress";
import { convert } from "./convert";
import { metadata } from "./metadata";
import { browserEncoder, browserTextRenderer } from "./adapter";
import type {
  ImageDataLike,
  CropOptions,
  ResizeOptions,
  FlipAxis,
  FilterOptions,
  WatermarkOptions,
  CompressOptions,
  CompressResult,
  ImageMimeType,
  ImageMetadata,
  Encoder,
  TextRenderer,
} from "./types";

export class Pipeline {
  private image: ImageDataLike;
  private encoder: Encoder;
  private textRenderer: TextRenderer;
  private historyLimit: number;
  private history: ImageDataLike[];
  private historyIndex: number;

  constructor(
    image: ImageDataLike,
    encoder?: Encoder,
    textRenderer?: TextRenderer,
    historyLimit = 20,
  ) {
    this.image = cloneImageData(image);
    this.encoder = encoder ?? browserEncoder;
    this.textRenderer = textRenderer ?? browserTextRenderer;
    this.historyLimit = Math.max(1, historyLimit);
    this.history = [cloneImageData(image)];
    this.historyIndex = 0;
  }

  private snapshot(): void {
    // 截断 redo 尾部
    this.history = this.history.slice(0, this.historyIndex + 1);
    // 压入当前快照
    this.history.push(cloneImageData(this.image));
    // 超出上限则丢弃最早
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  // 链式操作

  crop(opts: CropOptions): this {
    this.snapshot();
    this.image = crop(this.image, opts);
    return this;
  }

  resize(opts: ResizeOptions): this {
    this.snapshot();
    this.image = resize(this.image, opts);
    return this;
  }

  rotate(degrees: number): this {
    this.snapshot();
    this.image = rotate(this.image, degrees);
    return this;
  }

  flip(axis: FlipAxis): this {
    this.snapshot();
    this.image = flip(this.image, axis);
    return this;
  }

  filter(opts: FilterOptions): this {
    this.snapshot();
    this.image = filter(this.image, opts);
    return this;
  }

  watermark(opts: WatermarkOptions): this {
    this.snapshot();
    this.image = watermark(this.image, opts, this.textRenderer);
    return this;
  }

  // 输出操作

  async compress(opts: CompressOptions): Promise<CompressResult> {
    return compress(this.image, opts);
  }

  async convert(
    mimeType: ImageMimeType,
    quality?: number,
  ): Promise<Blob> {
    return convert(this.image, mimeType, quality);
  }

  async toBlob(
    mime: ImageMimeType = "image/png",
    quality?: number,
  ): Promise<Blob> {
    return this.encoder.encode(this.image, mime, quality);
  }

  toImageData(): ImageDataLike {
    return cloneImageData(this.image);
  }

  metadata(): ImageMetadata {
    return metadata(this.image);
  }

  // 撤销/重做

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  undo(): this {
    if (!this.canUndo) return this;
    this.historyIndex--;
    this.image = cloneImageData(this.history[this.historyIndex]);
    return this;
  }

  redo(): this {
    if (!this.canRedo) return this;
    this.historyIndex++;
    this.image = cloneImageData(this.history[this.historyIndex]);
    return this;
  }

  _setDefaults(encoder: Encoder, textRenderer: TextRenderer): void {
    this.encoder = encoder;
    this.textRenderer = textRenderer;
  }
}

// 工厂函数

import { loadImage, getImageData, createCanvas } from "./adapter";

export async function imgpilot(
  source: File | Blob | string | ArrayBuffer,
): Promise<Pipeline> {
  const img = await loadImage(source);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = getImageData(img);
  return new Pipeline(imageData, browserEncoder, browserTextRenderer);
}

export async function imgkitBatch(
  sources: (File | Blob | string | ArrayBuffer)[],
): Promise<Pipeline[]> {
  return Promise.all(sources.map((s) => imgpilot(s)));
}