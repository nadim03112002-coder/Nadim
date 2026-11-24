import { uploadImageToTelegram, resolveTelegramUrl, dataUrlToBlob } from './telegramStorageService';

/**
 * Universal Image Upload Service powered by Telegram Cloud Storage (@nsta_vault_bot)
 * Unlimited Free Cloud CDN hosting for profile photos, status updates, community posts,
 * homework attachments, and admin formulas.
 */

export interface ImgBBUploadResponse {
  success: boolean;
  url?: string;
  displayUrl?: string;
  deleteUrl?: string;
  error?: string;
}

/**
 * Compresses an image File/Blob to high quality web JPEG Base64
 * Keeps size optimized (~100-300KB) for instant loading
 */
export interface UploadImageOptions {
  isHd?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  preservePng?: boolean;
}

function drawToScaledCanvas(
  source: CanvasImageSource & { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
  isPng: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  let width = source.width || maxWidth;
  let height = source.height || maxHeight;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (!isPng) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(source, 0, 0, width, height);
  }
  return canvas;
}

function canvasToBlobFast(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            try {
              resolve(dataUrlToBlob(canvas.toDataURL(mimeType, quality), mimeType));
            } catch (err) {
              reject(err);
            }
          }
        },
        mimeType,
        quality
      );
      return;
    }
    try {
      resolve(dataUrlToBlob(canvas.toDataURL(mimeType, quality), mimeType));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fast binary image compression directly to Blob using createImageBitmap + canvas.toBlob.
 * Avoids slow main-thread Base64 + atob byte-loop decoding for multi-megapixel camera photos.
 */
export async function compressImageToBlob(
  file: File | Blob | string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.78,
  preservePng = false
): Promise<Blob> {
  const isPng =
    preservePng ||
    (typeof file === 'string' && file.startsWith('data:image/png')) ||
    (typeof file === 'object' && 'type' in file && file.type === 'image/png' && preservePng);
  const outMime = isPng ? 'image/png' : 'image/jpeg';

  if (typeof file === 'string') {
    if (file.startsWith('data:image/')) {
      const dataUrl = await compressImage(file, maxWidth, maxHeight, quality, isPng);
      return dataUrlToBlob(dataUrl, outMime);
    }
    throw new Error('Invalid image string');
  }

  // Fast background-thread decode via createImageBitmap when available
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = drawToScaledCanvas(bitmap, maxWidth, maxHeight, isPng);
      bitmap.close();
      bitmap = null;
      return await canvasToBlobFast(canvas, outMime, quality);
    } catch {
      try {
        bitmap?.close();
      } catch {}
    }
  }

  // Fallback to <img> + objectURL + canvas.toBlob
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objectUrl;
      });
      const canvas = drawToScaledCanvas(
        { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, ...img } as any,
        maxWidth,
        maxHeight,
        isPng
      );
      return await canvasToBlobFast(canvas, outMime, quality);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const dataUrl = await compressImage(file, maxWidth, maxHeight, quality, isPng);
  return dataUrlToBlob(dataUrl, outMime);
}

/**
 * Compresses an image File/Blob to high quality web JPEG or transparent PNG Base64.
 * Keeps size optimized (~100-300KB) for instant loading while preserving alpha channel for signatures.
 */
export async function compressImage(
  file: File | Blob | string,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82,
  preservePng = false
): Promise<string> {
  // Auto-detect if file or string is a PNG or signature that must keep transparency
  const isPng = preservePng ||
    (typeof file === 'string' && file.startsWith('data:image/png')) ||
    (typeof file === 'object' && 'type' in file && file.type === 'image/png');

  return new Promise((resolve, reject) => {
    if (typeof file === 'string' && file.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => {
        const canvas = drawToScaledCanvas(img, maxWidth, maxHeight, isPng);
        resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(file);
      img.src = file;
      return;
    }

    if (typeof file !== 'string' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = drawToScaledCanvas(img, maxWidth, maxHeight, isPng);
          const resultUrl = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
          URL.revokeObjectURL(objectUrl);
          resolve(resultUrl);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file as any);
      };
      img.src = objectUrl;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = drawToScaledCanvas(img, maxWidth, maxHeight, isPng);
        resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = reject;
    if (typeof file !== 'string') {
      reader.readAsDataURL(file as any);
    } else {
      resolve(String(file));
    }
  });
}

/**
 * Uploads an image directly to Telegram Cloud Storage (@nsta_vault_bot).
 * Supports HD mode & transparent PNG preservation for signatures, stamps, and logos.
 */
export async function uploadImageToImgBB(
  file: File | Blob | string,
  name?: string,
  options?: UploadImageOptions | boolean
): Promise<string> {
  const isHd = typeof options === 'boolean' ? options : !!options?.isHd;
  const preservePng =
    (typeof options === 'object' && !!options?.preservePng) ||
    (typeof file === 'string' && file.startsWith('data:image/png')) ||
    (typeof file === 'object' && file !== null && 'type' in file && (file as Blob).type === 'image/png') ||
    Boolean(
      name &&
        (name.toLowerCase().endsWith('.png') ||
          name.toLowerCase().includes('sig_') ||
          name.toLowerCase().includes('stamp'))
    );
  // Optimized resolution: 1280px provides crisp retina display on mobile & desktop, while keeping size under 180KB!
  const targetMaxWidth = (typeof options === 'object' && options?.maxWidth) ? options.maxWidth : isHd ? 1600 : 1280;
  const targetMaxHeight = (typeof options === 'object' && options?.maxHeight) ? options.maxHeight : isHd ? 1600 : 1280;
  const targetQuality = (typeof options === 'object' && options?.quality) ? options.quality : isHd ? 0.84 : 0.78;

  let compressedBlob: Blob | null = null;
  try {
    compressedBlob = await compressImageToBlob(file, targetMaxWidth, targetMaxHeight, targetQuality, preservePng);
  } catch (err) {
    console.warn('[Image Upload Service] Pre-compression skipped:', err);
  }

  // ── Strategy 1: Telegram Cloud Storage with fast binary compressed Blob ──
  try {
    const inputPayload = compressedBlob || file;
    const defaultExt = preservePng ? 'png' : 'jpg';
    const directTelegramUrl = await uploadImageToTelegram(
      inputPayload,
      name || `nsta_img_${Date.now()}.${defaultExt}`,
      'NSTA App Media'
    );
    if (directTelegramUrl && typeof directTelegramUrl === 'string' && directTelegramUrl.trim()) {
      return resolveTelegramUrl(directTelegramUrl.trim());
    }
  } catch (tgErr: any) {
    console.warn('[Image Upload Service] Telegram storage attempt error:', tgErr?.message || tgErr);
  }

  // ── Strategy 2: In-App Compressed Data URL Fallback (For offline & network resilience) ──
  try {
    const fallbackWidth = isHd ? 1280 : 800;
    const fallbackHeight = isHd ? 1280 : 800;
    const fallbackQuality = isHd ? 0.82 : 0.72;
    const ultraCompact = await compressImage(file, fallbackWidth, fallbackHeight, fallbackQuality, preservePng);
    if (ultraCompact) {
      return ultraCompact;
    }
  } catch (compErr) {
    console.warn('[Image Upload Service] Fallback compression error:', compErr);
  }

  throw new Error('Photo process nahi ho payi. Kripya dobara koshish karein.');
}
