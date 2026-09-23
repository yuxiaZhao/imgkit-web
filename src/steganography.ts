import type {
  ImageDataLike,
  LsbDepth,
  SteganographyChannels,
  SteganographyEmbedOptions,
  SteganographyExtractOptions,
  SteganographyEmbedResult,
  SteganographyExtractResult,
} from "./types";
import { cloneImageData, assertImageData } from "./utils";


// 隐写数据魔数头，用于快速识别有效隐写图
const MAGIC_BYTES = new Uint8Array([0x49, 0x4d, 0x47, 0x53]); // "IMGS"

// 头部固定长度：魔数 4B + 载荷长度 4B + 加密标志 1B
const HEADER_SIZE = 9;

// 通道在像素中的字节偏移：R=0, G=1, B=2
const CHANNEL_OFFSETS: Record<SteganographyChannels, number[]> = {
  R: [0],
  G: [1],
  B: [2],
  RG: [0, 1],
  RB: [0, 2],
  GB: [1, 2],
  RGB: [0, 1, 2],
};


// 解析通道列表，返回字节偏移数组 
function resolveChannels(channels: SteganographyChannels = "RGB"): number[] {
  return CHANNEL_OFFSETS[channels];
}

//   构造位掩码：低 depth 位为 1，其余为 0 */
function lowBitsMask(depth: LsbDepth): number {
  return (1 << depth) - 1;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// 基于 key 生成与 plaintext 等长的伪随机字节流，再做 XOR。
function xorCipher(data: Uint8Array, key: string): Uint8Array {
  if (!key) return data;
  const keyBytes = encodeUtf8(key);
  if (keyBytes.length === 0) return data;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

function writeUint32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >>> 8) & 0xff;
  buf[2] = (value >>> 16) & 0xff;
  buf[3] = (value >>> 24) & 0xff;
  return buf;
}

function readUint32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

//生成可写入的像素通道索引序列。
function buildWritableSlots(
  image: ImageDataLike,
  channels: number[],
): Int32Array {
  const { width, height, data } = image;
  const channelCount = channels.length;
  const pixelCount = width * height;

  // 先统计有效槽位数
  let slotCount = 0;
  for (let p = 0; p < pixelCount; p++) {
    if (data[p * 4 + 3] !== 0) {
      slotCount += channelCount;
    }
  }

  const slots = new Int32Array(slotCount * 2);
  let si = 0;
  for (let p = 0; p < pixelCount; p++) {
    if (data[p * 4 + 3] === 0) continue;
    const base = p * 4;
    for (let c = 0; c < channelCount; c++) {
      slots[si++] = base;
      slots[si++] = channels[c];
    }
  }
  return slots;
}

export function steganographyCapacity(
  image: ImageDataLike,
  options?: { depth?: LsbDepth; channels?: SteganographyChannels },
): number {
  assertImageData(image, "image");
  const depth = options?.depth ?? 1;
  const channels = resolveChannels(options?.channels);
  const slots = buildWritableSlots(image, channels);
  const totalBits = (slots.length / 2) * depth;
  const totalBytes = Math.floor(totalBits / 8);
  return Math.max(0, totalBytes - HEADER_SIZE);
}


//   将文本信息嵌入图片像素的最低有效位中。
export function embedMessage(
  image: ImageDataLike,
  options: SteganographyEmbedOptions,
): SteganographyEmbedResult {
  assertImageData(image, "image");

  const depth: LsbDepth = options.depth ?? 1;
  const channels = resolveChannels(options.channels);
  const key = options.key;

  const plaintext = encodeUtf8(options.message);

  const encrypted = key ? xorCipher(plaintext, key) : plaintext;
  const encryptedFlag = key ? 1 : 0;

  // 拼接完整比特流
  const payloadLen = encrypted.length;
  const totalBytes = HEADER_SIZE + payloadLen;
  const stream = new Uint8Array(totalBytes);
  stream.set(MAGIC_BYTES, 0);
  stream.set(writeUint32LE(payloadLen), 4);
  stream[8] = encryptedFlag;
  stream.set(encrypted, HEADER_SIZE);

  // 容量校验
  const slots = buildWritableSlots(image, channels);
  const slotCount = slots.length / 2;
  const totalBitsNeeded = totalBytes * 8;
  const totalBitsAvailable = slotCount * depth;

  if (totalBitsNeeded > totalBitsAvailable) {
    const capacityBytes = Math.max(0, Math.floor(totalBitsAvailable / 8) - HEADER_SIZE);
    throw new RangeError(
      `Message exceeds image capacity (max ${capacityBytes} bytes, got ${payloadLen} bytes)`,
    );
  }

  // 复制原图，在副本上写入
  const result = cloneImageData(image);
  const data = result.data;
  const mask = lowBitsMask(depth);
  const highBitsMask = 0xff ^ mask; // 保留高位，清掉低 depth 位

  // 逐比特写入
  // 每个 slot可承载 depth 个比特
  let bitIndex = 0;
  for (let i = 0; i < slotCount && bitIndex < totalBitsNeeded; i++) {
    const pixelIndex = slots[i * 2];
    const channelOffset = slots[i * 2 + 1];
    const byteIndex = pixelIndex + channelOffset;

    // 取出接下来 depth 个比特，组成一个小整数
    let bits = 0;
    for (let b = 0; b < depth; b++) {
      if (bitIndex + b >= totalBitsNeeded) break;
      const globalBit = bitIndex + b;
      const byte = stream[globalBit >>> 3];
      const bit = (byte >>> (7 - (globalBit & 7))) & 1;
      bits |= bit << (depth - 1 - b);
    }
    bitIndex += depth;

    // 清掉低位，写入新值
    data[byteIndex] = (data[byteIndex] & highBitsMask) | (bits & mask);
  }

  return {
    image: result,
    bitsWritten: totalBitsNeeded,
    bytesWritten: totalBytes,
    capacity: Math.max(0, Math.floor(totalBitsAvailable / 8) - HEADER_SIZE),
  };
}

// 提取算法 
export function extractMessage(
  image: ImageDataLike,
  options?: SteganographyExtractOptions,
): SteganographyExtractResult {
  assertImageData(image, "image");

  const depth: LsbDepth = options?.depth ?? 1;
  const channels = resolveChannels(options?.channels);
  const key = options?.key;

  // 先读取头部（9 字节 = 72 比特）
  const slots = buildWritableSlots(image, channels);
  const slotCount = slots.length / 2;
  const totalBitsAvailable = slotCount * depth;

  // 统一的比特读取函数：从 startBit 起读取 nBytes 字节
  // 每个字节按 MSB-first 顺序组装
  function readBytes(startBit: number, nBytes: number): Uint8Array | null {
    const needed = nBytes * 8;
    if (startBit + needed > totalBitsAvailable) return null;
    const out = new Uint8Array(nBytes);
    const data = image.data;
    const mask = lowBitsMask(depth);

    for (let bytePos = 0; bytePos < nBytes; bytePos++) {
      let byte = 0;
      for (let bitInByte = 0; bitInByte < 8; bitInByte++) {
        const globalBit = startBit + bytePos * 8 + bitInByte;
        const slotIdx = Math.floor(globalBit / depth);
        const pixelIndex = slots[slotIdx * 2];
        const channelOffset = slots[slotIdx * 2 + 1];
        const byteIndex = pixelIndex + channelOffset;
        // 取出低 depth 位
        const bits = data[byteIndex] & mask;
        // 在 depth 比特中，定位当前需要的那个比特（高位在前，与 embed 一致）
        const bitInSlot = globalBit % depth;
        const bit = (bits >>> (depth - 1 - bitInSlot)) & 1;
        byte = (byte << 1) | bit;
      }
      out[bytePos] = byte;
    }
    return out;
  }

  // 1. 读取魔数头
  const header = readBytes(0, HEADER_SIZE);
  if (!header) {
    return { success: false, message: "", bytesRead: 0 };
  }

  // 校验魔数
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (header[i] !== MAGIC_BYTES[i]) {
      return { success: false, message: "", bytesRead: 0 };
    }
  }

  // 2. 读取载荷长度与加密标志
  const payloadLen = readUint32LE(header, 4);
  const encryptedFlag = header[8];

  // 容量合理性校验，防止异常大长度导致越界
  const maxPayload = Math.max(0, Math.floor(totalBitsAvailable / 8) - HEADER_SIZE);
  if (payloadLen > maxPayload) {
    return { success: false, message: "", bytesRead: 0 };
  }

  // 3. 读取载荷
  const payload = readBytes(HEADER_SIZE * 8, payloadLen);
  if (!payload) {
    return { success: false, message: "", bytesRead: 0 };
  }

  // 4. 解密
  if (encryptedFlag === 1) {
    if (!key) {
      throw new Error("Encrypted message requires key");
    }
    const decrypted = xorCipher(payload, key);
    return {
      success: true,
      message: decodeUtf8(decrypted),
      bytesRead: HEADER_SIZE + payloadLen,
    };
  }

  return {
    success: true,
    message: decodeUtf8(payload),
    bytesRead: HEADER_SIZE + payloadLen,
  };
}
