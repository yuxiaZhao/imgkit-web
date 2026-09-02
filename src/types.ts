export interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type ImageMimeType = "image/jpeg" | "image/jpg" | "image/png" | "image/webp";

export enum Position {
  TopLeft = "top-left",
  Top = "top",
  TopRight = "top-right",
  Left = "left",
  Center = "center",
  Right = "right",
  BottomLeft = "bottom-left",
  Bottom = "bottom",
  BottomRight = "bottom-right",
}

export type FlipAxis = "horizontal" | "vertical";

export type FitMode = "contain" | "cover" | "exact" | "fill";

export type ResizeAlgorithm = "nearest" | "bilinear";

export interface CompressOptions {
  quality?: number;
  maxSize?: number;
  mimeType?: ImageMimeType;
}

export interface CompressResult {
  blob: Blob;
  quality: number;
  size: number;
  mimeType: string;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export interface WatermarkOptions {
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

export interface CropOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  align?: Position;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: FitMode;
  algorithm?: ResizeAlgorithm;
}

export interface FilterOptions {
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

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  pixels: number;
  channels: number;
  averageBrightness: number;
  hasAlpha: boolean;
}

export interface ExifInfo {
  orientation?: number;
  make?: string;
  model?: string;
  dateTime?: string;
  gps?: { latitude: number; longitude: number };
}

export interface ProcessContext {
  image: ImageDataLike;
  encoder?: Encoder;
  textRenderer?: TextRenderer;
}

export interface Encoder {
  encode(data: ImageDataLike, mimeType: ImageMimeType, quality?: number): Promise<Blob>;
}

export interface TextRenderer {
  renderText(text: string, options: { font: string; color: string; rotate?: number }): ImageDataLike;
}

export type Processor = (ctx: ProcessContext) => Promise<ImageDataLike> | ImageDataLike;