/**
 * Getting a sponsor's image ready for upload.
 *
 * The backend strips every piece of metadata, EXIF orientation included. A
 * phone photo stored sideways with an "rotate 90" tag would therefore arrive
 * sideways. So the browser draws it upright into a canvas first (both
 * `createImageBitmap(..., { imageOrientation: "from-image" })` and an <img>
 * apply the tag) and uploads the pixels, not the file.
 *
 * Output: JPEG at quality 0.9, at most 2048px on the long side, under 3 MB.
 * A logo that arrives as PNG or WebP stays PNG so its transparency survives
 * (the board puts logos on a white plate anyway); it falls back to JPEG on a
 * white ground only if the PNG would not fit in 3 MB.
 */

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_SIDE = 2048;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export class ImageProblem extends Error {
  constructor(readonly reason: "type" | "unreadable" | "too_big") {
    super(reason);
  }
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      // Older Safari rejects the options bag. The <img> path below applies
      // orientation by default in every current browser.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      done: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageProblem("unreadable");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, opts: { keepTransparency: boolean }): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new ImageProblem("type");

  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageProblem("unreadable");

    if (opts.keepTransparency && file.type !== "image/jpeg") {
      ctx.drawImage(img.source, 0, 0, w, h);
      const png = await toBlob(canvas, "image/png");
      if (png && png.size <= MAX_UPLOAD_BYTES) return png;
      ctx.clearRect(0, 0, w, h);
    }

    // JPEG has no transparency: paint white first, or transparent pixels turn black.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    for (const q of [0.9, 0.8, 0.7]) {
      const jpeg = await toBlob(canvas, "image/jpeg", q);
      if (jpeg && jpeg.size <= MAX_UPLOAD_BYTES) return jpeg;
    }
    throw new ImageProblem("too_big");
  } finally {
    img.done();
  }
}
