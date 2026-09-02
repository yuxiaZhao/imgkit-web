import type { ExifInfo } from "./types";

const SOI = 0xffd8;
const APP1 = 0xffe1;
const TIFF_LE = 0x4949; // "II"
const TIFF_BE = 0x4d4d; // "MM"

// EXIF tag IDs
const TAG_ORIENTATION = 0x0112;
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME = 0x0132;
const TAG_GPS_IFD = 0x8825;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LON_REF = 0x0003;
const TAG_GPS_LON = 0x0004;

function readU16(view: DataView, offset: number, le: boolean): number {
  return view.getUint16(offset, le);
}

function readU32(view: DataView, offset: number, le: boolean): number {
  return view.getUint32(offset, le);
}

function readAscii(view: DataView, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

function toDecimal(degrees: number, minutes: number, seconds: number, ref: string): number {
  let val = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") val = -val;
  return val;
}

function parseRational(view: DataView, offset: number, le: boolean): number {
  const num = readU32(view, offset, le);
  const den = readU32(view, offset + 4, le);
  return den === 0 ? 0 : num / den;
}

function parseGps(view: DataView, tiffOffset: number, gpsOffset: number, le: boolean) {
  try {
    const numEntries = readU16(view, tiffOffset + gpsOffset, le);
    let latRef = "";
    let lonRef = "";
    let lat: number[] = [];
    let lon: number[] = [];

    for (let i = 0; i < numEntries; i++) {
      const entryOff = tiffOffset + gpsOffset + 2 + i * 12;
      const tag = readU16(view, entryOff, le);
      const count = readU32(view, entryOff + 4, le);
      const valOff = entryOff + 8;

      if (tag === TAG_GPS_LAT_REF) {
        latRef = String.fromCharCode(view.getUint8(valOff));
      } else if (tag === TAG_GPS_LON_REF) {
        lonRef = String.fromCharCode(view.getUint8(valOff));
      } else if (tag === TAG_GPS_LAT && count === 3) {
        const dataOff = tiffOffset + readU32(view, valOff, le);
        lat = [
          parseRational(view, dataOff, le),
          parseRational(view, dataOff + 8, le),
          parseRational(view, dataOff + 16, le),
        ];
      } else if (tag === TAG_GPS_LON && count === 3) {
        const dataOff = tiffOffset + readU32(view, valOff, le);
        lon = [
          parseRational(view, dataOff, le),
          parseRational(view, dataOff + 8, le),
          parseRational(view, dataOff + 16, le),
        ];
      }
    }

    if (lat.length === 3 && lon.length === 3) {
      return {
        latitude: toDecimal(lat[0], lat[1], lat[2], latRef),
        longitude: toDecimal(lon[0], lon[1], lon[2], lonRef),
      };
    }
  } catch {
    // GPS 解析失败，返回已解析部分
  }
  return undefined;
}

export function parseExif(buf: ArrayBuffer): ExifInfo {
  const result: ExifInfo = {};
  if (buf.byteLength < 4) return result;

  const view = new DataView(buf);
  if (readU16(view, 0, false) !== SOI) return result;

  // 定位 APP1
  let app1Off = -1;
  let app1Len = 0;
  for (let i = 2; i < buf.byteLength - 2; ) {
    const marker = readU16(view, i, false);
    if (marker === APP1) {
      app1Off = i;
      app1Len = readU16(view, i + 2, false);
      break;
    }
    if (marker >= 0xffe0 && marker <= 0xffef) {
      const segLen = readU16(view, i + 2, false);
      i += 2 + segLen;
    } else {
      break;
    }
  }

  if (app1Off < 0 || app1Len < 10) return result;

  // 校验 "Exif\0\0"
  const exifStr = String.fromCharCode(
    view.getUint8(app1Off + 4),
    view.getUint8(app1Off + 5),
    view.getUint8(app1Off + 6),
    view.getUint8(app1Off + 7),
    view.getUint8(app1Off + 8),
    view.getUint8(app1Off + 9),
  );
  if (exifStr !== "Exif\u0000\u0000") return result;

  const tiffOffset = app1Off + 10;
  if (tiffOffset + 8 > buf.byteLength) return result;

  const byteOrder = readU16(view, tiffOffset, false);
  const le = byteOrder === TIFF_LE;
  if (byteOrder !== TIFF_LE && byteOrder !== TIFF_BE) return result;

  const tiffMagic = readU16(view, tiffOffset + 2, le);
  if (tiffMagic !== 0x002a) return result;

  const ifd0Offset = readU32(view, tiffOffset + 4, le);
  if (ifd0Offset === 0) return result;

  const ifd0Start = tiffOffset + ifd0Offset;
  if (ifd0Start + 2 > buf.byteLength) return result;

  const numEntries = readU16(view, ifd0Start, le);

  for (let i = 0; i < numEntries; i++) {
    const entryOff = ifd0Start + 2 + i * 12;
    if (entryOff + 12 > buf.byteLength) break;

    const tag = readU16(view, entryOff, le);
    const count = readU32(view, entryOff + 4, le);
    const valOff = entryOff + 8;

    if (tag === TAG_ORIENTATION) {
      result.orientation = readU16(view, valOff, le);
    } else if (tag === TAG_MAKE) {
      result.make = readAscii(view, valOff, Math.min(count, 32));
    } else if (tag === TAG_MODEL) {
      result.model = readAscii(view, valOff, Math.min(count, 32));
    } else if (tag === TAG_DATETIME) {
      result.dateTime = readAscii(view, valOff, Math.min(count, 20));
    } else if (tag === TAG_GPS_IFD) {
      const gpsOff = readU32(view, valOff, le);
      const gps = parseGps(view, tiffOffset, gpsOff, le);
      if (gps) result.gps = gps;
    }
  }

  return result;
}