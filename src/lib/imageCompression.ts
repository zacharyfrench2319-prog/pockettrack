/**
 * Compresses an image file or data URL to a smaller JPEG for AI processing.
 * Returns a base64 string (without the data URI prefix).
 */

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.75;

export async function compressImageToBase64(
  source: File | string,
  opts?: { maxDimension?: number; quality?: number }
): Promise<string> {
  const maxDim = opts?.maxDimension ?? MAX_DIMENSION;
  const quality = opts?.quality ?? JPEG_QUALITY;

  const img = new Image();
  const loadPromise = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });

  if (source instanceof File) {
    img.src = URL.createObjectURL(source);
  } else {
    // data URL or object URL
    img.src = source.startsWith("data:") ? source : `data:image/jpeg;base64,${source}`;
  }

  await loadPromise;

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  if (source instanceof File) {
    URL.revokeObjectURL(img.src);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.split(",")[1];
}

/**
 * Compresses an image File for upload to storage (returns a Blob).
 */
export async function compressImageToBlob(
  file: File,
  opts?: { maxDimension?: number; quality?: number }
): Promise<Blob> {
  const maxDim = opts?.maxDimension ?? MAX_DIMENSION;
  const quality = opts?.quality ?? JPEG_QUALITY;

  const img = new Image();
  const loadPromise = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });
  img.src = URL.createObjectURL(file);
  await loadPromise;

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality);
  });
}
