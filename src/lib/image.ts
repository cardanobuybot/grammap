/**
 * Prepares a picture for a plot in the browser: crops it to the plot's proportions,
 * scales it down and encodes it small enough to upload.
 */

const MAX_BYTES = 330 * 1024;
const MAX_SIDE = 1024;

export class ImageError extends Error {}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back to <img>, which decodes a few formats createImageBitmap does not */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new ImageError('unreadable');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageError('unreadable'));
    reader.readAsDataURL(blob);
  });

/** Returns a data URL of the picture cropped to `cellsW`×`cellsH` proportions. */
export async function preparePlotImage(file: File, cellsW: number, cellsH: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('unreadable');
  const source = await loadBitmap(file);
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!sw || !sh) throw new ImageError('unreadable');

  // 4–24 picture pixels per map pixel: sharp when zoomed in, light enough for big plots.
  const perCell = Math.max(4, Math.min(24, Math.floor(MAX_SIDE / Math.max(cellsW, cellsH))));
  const width = Math.min(MAX_SIDE, cellsW * perCell);
  const height = Math.min(MAX_SIDE, cellsH * perCell);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('unreadable');
  ctx.imageSmoothingQuality = 'high';

  // "Cover": fill the plot, cropping whatever does not fit its proportions.
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
  if ('close' in source) source.close();

  for (const [type, quality] of [
    ['image/webp', 0.92],
    ['image/webp', 0.8],
    ['image/jpeg', 0.85],
    ['image/jpeg', 0.7],
    ['image/jpeg', 0.5],
  ] as const) {
    const blob = await toBlob(canvas, type, quality);
    // Browsers that cannot encode the requested type silently return PNG instead.
    if (blob && blob.type === type && blob.size <= MAX_BYTES) return toDataUrl(blob);
  }
  throw new ImageError('too_large');
}
