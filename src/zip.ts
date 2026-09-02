import type { ZipEntry } from "./types";

const CRC32_TABLE = new Uint32Array(256);

(function initCrc32() {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC32_TABLE[i] = c;
  }
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(arr: number[], val: number) {
  arr.push(val & 0xff, (val >> 8) & 0xff);
}

function writeU32(arr: number[], val: number) {
  arr.push(val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff);
}

function dosDateTime(now: Date): number {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  const min = now.getMinutes();
  const sec = Math.floor(now.getSeconds() / 2);
  return ((year - 1980) << 25) | (month << 21) | (day << 16) | (hour << 11) | (min << 5) | sec;
}

export function createZip(entries: ZipEntry[]): Blob {
  const now = new Date();
  const dt = dosDateTime(now);

  const localHeaders: number[][] = [];
  const fileDatas: number[][] = [];
  const centralEntries: number[][] = [];

  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Array.from(new TextEncoder().encode(entry.name));
    const checksum = crc32(entry.data);
    const size = entry.data.length;

    const lh: number[] = [];
    writeU32(lh, 0x04034b50);
    writeU16(lh, 20);
    writeU16(lh, 0x0800);
    writeU16(lh, 0x0000);
    writeU32(lh, dt);
    writeU32(lh, checksum);
    writeU32(lh, size);
    writeU32(lh, size);
    writeU16(lh, nameBytes.length);
    writeU16(lh, 0);
    localHeaders.push(lh);

    const fd: number[] = [];
    fd.push(...nameBytes);
    fd.push(...entry.data);
    fileDatas.push(fd);

    const cd: number[] = [];
    writeU32(cd, 0x02014b50);
    writeU16(cd, 20);
    writeU16(cd, 20);
    writeU16(cd, 0x0800);
    writeU16(cd, 0x0000);
    writeU32(cd, dt);
    writeU32(cd, checksum);
    writeU32(cd, size);
    writeU32(cd, size);
    writeU16(cd, nameBytes.length);
    writeU16(cd, 0);
    writeU16(cd, 0);
    writeU16(cd, 0);
    writeU32(cd, 0);
    writeU32(cd, offset);
    centralEntries.push(cd);

    offset += 30 + nameBytes.length + size;
  }

  const result: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    result.push(...localHeaders[i]);
    result.push(...fileDatas[i]);
  }

  const cdStart = result.length;
  for (const cd of centralEntries) {
    result.push(...cd);
  }
  const cdSize = result.length - cdStart;

  const eocd: number[] = [];
  writeU32(eocd, 0x06054b50);
  writeU16(eocd, 0);
  writeU16(eocd, 0);
  writeU16(eocd, entries.length);
  writeU16(eocd, entries.length);
  writeU32(eocd, cdSize);
  writeU32(eocd, cdStart);
  writeU16(eocd, 0);
  result.push(...eocd);

  return new Blob([new Uint8Array(result)], { type: "application/zip" });
}