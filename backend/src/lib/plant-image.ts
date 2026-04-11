export const PLANT_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_PLANT_IMAGE_BYTES = 3 * 1024 * 1024;

export function normalizeImageMimeType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

/** Detect image format from magic bytes (more reliable than browser-reported MIME). */
/** Normalize MongoDB / Mongoose binary fields to a Node Buffer (lean() may yield BSON Binary). */
export function normalizePlantImageBuffer(raw: unknown): Buffer | null {
  if (raw == null) return null;
  if (Buffer.isBuffer(raw)) return raw.length > 0 ? raw : null;
  if (raw instanceof Uint8Array) return raw.length > 0 ? Buffer.from(raw) : null;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner = o.buffer;
    if (Buffer.isBuffer(inner) && inner.length > 0) return inner;
    if (inner instanceof Uint8Array && inner.length > 0) {
      return Buffer.from(inner);
    }
    if (o.type === "Buffer" && Array.isArray(o.data)) {
      try {
        const buf = Buffer.from(o.data as number[]);
        return buf.length > 0 ? buf : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
