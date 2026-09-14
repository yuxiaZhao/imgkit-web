/**
 * 生成一个最小的有效 PNG 图片用于 E2E 测试（100x60 像素，蓝色背景 + 白色矩形）
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let cval = n;
    for (let k = 0; k < 8; k++) {
      if (cval & 1) cval = 0xedb88320 ^ (cval >>> 1);
      else cval = cval >>> 1;
    }
    table[n] = cval;
  }
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

const width = 100;
const height = 60;

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr.writeUInt8(8, 8);   // bit depth
ihdr.writeUInt8(2, 9);   // color type: RGB
ihdr.writeUInt8(0, 10);  // compression
ihdr.writeUInt8(0, 11);  // filter
ihdr.writeUInt8(0, 12);  // interlace

// IDAT: raw pixels (each row: filter byte + RGB triplets)
const rawRows: Buffer[] = [];
for (let y = 0; y < height; y++) {
  const row: number[] = [0]; // filter: none
  for (let x = 0; x < width; x++) {
    const inRect = x > 20 && x < 80 && y > 15 && y < 45;
    row.push(inRect ? 255 : 0, inRect ? 255 : 0, 255); // RGB
  }
  rawRows.push(Buffer.from(row));
}
const rawData = Buffer.concat(rawRows);
const compressed = deflateSync(rawData);
const idat = pngChunk('IDAT', compressed);
const iend = pngChunk('IEND', Buffer.alloc(0));

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  pngChunk('IHDR', ihdr),
  idat,
  iend,
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outPath = join(__dirname, 'test-image.png');
writeFileSync(outPath, png);
console.log(`Test image generated: ${outPath} (${png.length} bytes, ${width}x${height}px)`);