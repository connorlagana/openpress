/**
 * Identify images by magic bytes (never trust the declared MIME type or file
 * extension) and read dimensions from headers. SVG is intentionally not
 * accepted: it can carry script.
 */
export type ImageInfo = { mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/avif" | "image/x-icon"; ext: string; width?: number; height?: number };

export function sniffImage(b: Uint8Array): ImageInfo | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === "PNG") {
    return { mime: "image/png", ext: "png", width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (b.length >= 10 && ascii(0, 6).match(/^GIF8[79]a$/)) {
    return { mime: "image/gif", ext: "gif", width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  }
  if (b.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return { mime: "image/webp", ext: "webp", width: 1 + (dv.getUint32(24, true) & 0xffffff), height: 1 + (dv.getUint32(27, true) & 0xffffff) };
    if (chunk === "VP8 ") return { mime: "image/webp", ext: "webp", width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = dv.getUint32(21, true);
      return { mime: "image/webp", ext: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { mime: "image/webp", ext: "webp" };
  }
  if (b.length >= 12 && ascii(4, 4) === "ftyp" && /^(avif|avis)$/.test(ascii(8, 4))) return { mime: "image/avif", ext: "avif" };
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { mime: "image/x-icon", ext: "ico" };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) break;
      const marker = b[o + 1];
      const len = dv.getUint16(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: "image/jpeg", ext: "jpg", height: dv.getUint16(o + 5), width: dv.getUint16(o + 7) };
      }
      o += 2 + len;
    }
    return { mime: "image/jpeg", ext: "jpg" };
  }
  return null;
}
