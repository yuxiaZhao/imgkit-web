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
  private _image: ImageDataLike;
  private _encoder: Encoder;
  private _textRenderer: TextRenderer;
  private _historyLimit: number;
  private _history: ImageDataLike[];
  private _historyIndex: number;

  constructor(
    image: ImageDataLike,
    encoder?: Encoder,
    textRenderer?: TextRenderer,
    historyLimit = 20,
  ) {
    this._image = cloneImageData(image);
    this._encoder = encoder ?? browserEncoder;
    this._textRenderer = textRenderer ?? browserTextRenderer;
    this._historyLimit = Math.max(1, historyLimit);
    this._history = [cloneImageData(image)];
    this._historyIndex = 0;
  }

  private _snapshot(): void {
    // 截断 redo 尾部
    this._history = this._history.slice(0, this._historyIndex + 1);
    // 压入当前快照
    this._history.push(cloneImageData(this._image));
    // 超出上限则丢弃最早
    if (this._history.length > this._historyLimit) {
      this._history.shift();
    } else {
      this._historyIndex++;
    }
  }

  // ─── 链式操作 ───

  crop(opts: CropOptions): this {
    this._snapshot();
    this._image = crop(this._image, opts);
    return this;
  }

  resize(opts: ResizeOptions): this {
    this._snapshot();
    this._image = resize(this._image, opts);
    return this;
  }

  rotate(degrees: number): this {
    this._snapshot();
    this._image = rotate(this._image, degrees);
    return this;
  }

  flip(axis: FlipAxis): this {
    this._snapshot();
    this._image = flip(this._image, axis);
    return this;
  }

  filter(opts: FilterOptions): this {
    this._snapshot();
    this._image = filter(this._image, opts);
    return this;
  }

  watermark(opts: WatermarkOptions): this {
    this._snapshot();
    this._image = watermark(this._image, opts, this._textRenderer);
    return this;
  }

  // ─── 输出操作 ───

  async compress(opts: CompressOptions): Promise<CompressResult> {
    return compress(this._image, opts);
  }

  async convert(
    mimeType: ImageMimeType,
    quality?: number,
  ): Promise<Blob> {
    return convert(this._image, mimeType, quality);
  }

  async toBlob(
    mime: ImageMimeType = "image/png",
    quality?: number,
  ): Promise<Blob> {
    return this._encoder.encode(this._image, mime, quality);
  }

  toImageData(): ImageDataLike {
    return cloneImageData(this._image);
  }

  metadata(): ImageMetadata {
    return metadata(this._image);
  }

  // ─── 撤销/重做 ───

  get canUndo(): boolean {
    return this._historyIndex > 0;
  }

  get canRedo(): boolean {
    return this._historyIndex < this._history.length - 1;
  }

  undo(): this {
    if (!this.canUndo) return this;
    this._historyIndex--;
    this._image = cloneImageData(this._history[this._historyIndex]);
    return this;
  }

  redo(): this {
    if (!this.canRedo) return this;
    this._historyIndex++;
    this._image = cloneImageData(this._history[this._historyIndex]);
    return this;
  }

  _setDefaults(encoder: Encoder, textRenderer: TextRenderer): void {
    this._encoder = encoder;
    this._textRenderer = textRenderer;
  }
}

// ─── 工厂函数 ───

import { loadImage, getImageData, createCanvas } from "./adapter";

export async function imgkit(
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
  return Promise.all(sources.map((s) => imgkit(s)));
}