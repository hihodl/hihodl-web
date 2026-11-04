"use client";

/**
 * A photo, made ready for a group upload (a group's photo, a receipt).
 *
 * The contract (groups-splitwise-grade.md, Images) takes the raw bytes, at
 * most 3 MB, PNG, JPEG or WebP, and strips EXIF, orientation included. So a
 * phone photo taken sideways would land sideways. It is drawn through a canvas
 * here first: the browser applies the EXIF orientation when it decodes
 * (`imageOrientation: "from-image"`, the default in current browsers), and
 * what comes out of the canvas is upright pixels with no metadata at all.
 *
 * It is also scaled so the long side is at most 2048 px and re-encoded as
 * JPEG, stepping the quality down until it is under the limit: a receipt
 * straight off a camera is often 5 MB and would be refused as
 * `image_too_large` for no reason the person could fix.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_SIDE = 2048;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to an <img>, which also honours EXIF orientation in current browsers */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("image:That file couldn't be read as an image. Use a PNG, JPEG or WebP.");
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Upright, under 3 MB, JPEG. Throws an Error whose message starts "image:" with words for the person. */
export async function uprightImage(file: File): Promise<Blob> {
  if (file.type && !ACCEPTED.includes(file.type)) {
    throw new Error("image:Use a PNG, JPEG or WebP image.");
  }
  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("image:This browser couldn't prepare the image. Try another one.");
    // JPEG has no transparency: a transparent PNG gets a white ground, not black.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    for (const q of [0.86, 0.75, 0.62, 0.5]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new Error("image:That image is too large, even made smaller. Choose another one.");
  } finally {
    img.close();
  }
}
