/**
 * Telegram Cloud Storage Service
 * Media Storage backed by @LmpsschoolappBot via secure server-side proxy.
 *
 * Architecture:
 * - Browser uploads binary media to /api/telegram/upload
 * - Bot Token & Channel ID stay strictly on server-side (process.env.TELEGRAM_BOT_TOKEN / TELEGRAM_STORAGE_CHAT_ID)
 * - Files are served permanently via /api/telegram/file?fileId=... with CORS, Range requests & auto-refreshing file_path
 */

const _env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const DEFAULT_STORAGE_CHAT_ID = (_env.VITE_TELEGRAM_STORAGE_CHAT_ID || '').trim();
export const DEFAULT_CHAT_CHANNEL_ID = (_env.VITE_TELEGRAM_CHAT_CHANNEL_ID || '').trim();
export const TELEGRAM_CHAT_INVITE_LINK = 'https://t.me/+p0aIY7YWgGxhYzk1';
const STORAGE_CHAT_KEY = 'nst_telegram_storage_chat_id';

// Telegram Bot API `getFile` strictly rejects downloading/streaming any file > 20MB.
export const TELEGRAM_MAX_FILE_SIZE_BYTES = Math.floor(19.5 * 1024 * 1024);

export interface TelegramUploadResult {
  url: string;
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  directUrl?: string;
}

export interface UploadOptions {
  fileName?: string;
  caption?: string;
  type?: 'image' | 'video' | 'audio' | 'pdf' | 'document';
  chatId?: string;
  timeoutMs?: number;
  onProgress?: (percent: number) => void;
}

/**
 * Gets custom storage chat ID if explicitly configured locally
 */
export const getTelegramStorageChatId = (): string => {
  try {
    return (localStorage.getItem(STORAGE_CHAT_KEY) || DEFAULT_STORAGE_CHAT_ID || '').trim();
  } catch {
    return DEFAULT_STORAGE_CHAT_ID;
  }
};

/**
 * Sets custom storage channel/chat ID
 */
export const setTelegramStorageChatId = (chatId: string) => {
  try {
    if (chatId) {
      localStorage.setItem(STORAGE_CHAT_KEY, chatId.trim());
    } else {
      localStorage.removeItem(STORAGE_CHAT_KEY);
    }
  } catch {}
};

/**
 * Converts a base64 Data URL or string to a Blob
 */
export function dataUrlToBlob(dataUrl: string, defaultMime = 'image/jpeg'): Blob {
  const parts = dataUrl.split(';base64,');
  const mime = parts[0]?.replace('data:', '') || defaultMime;
  const byteString = atob(parts[1] || parts[0]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

/**
 * Builds a permanent, non-expiring URL backed by Telegram's immutable file_id.
 */
export function buildPermanentTelegramUrl(fileId: string, fileName?: string): string {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const nameParam = fileName ? `&name=${encodeURIComponent(fileName)}` : '';
  return `/api/telegram/file?fileId=${encodeURIComponent(cleanId)}${nameParam}`;
}

/**
 * Resolves Telegram and media URLs for browser loading.
 * Preserves permanent /api/telegram/file?fileId=... URLs untouched so links never expire.
 */
export function resolveTelegramUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('data:audio/') ||
    trimmed.startsWith('data:application/pdf')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/api/telegram/file')) {
    return trimmed;
  }

  if (trimmed.includes('/api/telegram/file') && trimmed.includes('fileId=')) {
    try {
      const idx = trimmed.indexOf('/api/telegram/file');
      return trimmed.slice(idx);
    } catch {}
  }

  if (trimmed.startsWith('https://t.me/') || trimmed.startsWith('http://t.me/')) {
    return trimmed;
  }

  return trimmed;
}

function parseServerUploadError(status: number, data: any): string {
  if (status === 413) {
    return data?.error || 'File size limit se badi hai (Vercel limit 4.5MB / Telegram 19.5MB). Kripya chhoti file ya compressed media upload karein.';
  }
  if (status === 503) {
    return data?.error || 'Server par TELEGRAM_BOT_TOKEN configure nahi hai.';
  }
  if (status === 429) {
    return data?.error || 'Telegram par abhi bahut requests aa rahi hain. 5-10 second baad dubara koshish karein.';
  }
  if (status >= 500 && !data?.error && !data?.description) {
    return `Telegram storage server error (${status}). Vercel Env variables aur deployment check karein.`;
  }
  return data?.error || data?.description || `Upload server error (${status})`;
}

/**
 * Uploads binary payload via our secure server-side proxy (/api/telegram/upload).
 * Never exposes Telegram Bot Token in browser network requests or URLs.
 */
async function uploadViaServerProxyOnce(
  blob: Blob,
  fileName: string,
  targetChatId: string,
  timeoutMs: number,
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  const mimeType = blob.type || 'application/octet-stream';

  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<TelegramUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = timeoutMs;

      if (opts.onProgress) opts.onProgress(15);

      if (xhr.upload && opts.onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.min(92, Math.max(18, Math.round((evt.loaded / evt.total) * 92)));
            opts.onProgress!(pct);
          }
        };
      }

      xhr.onload = () => {
        let data: any = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {}

        if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data?.fileId) {
          const permanentUrl = data.url || buildPermanentTelegramUrl(data.fileId, data.fileName || fileName);
          if (opts.onProgress) opts.onProgress(100);
          resolve({
            url: permanentUrl,
            directUrl: permanentUrl,
            fileId: data.fileId,
            fileName: data.fileName || fileName,
            fileSize: data.fileSize || blob.size,
            mimeType: data.mimeType || mimeType,
          });
        } else {
          const err: any = new Error(parseServerUploadError(xhr.status, data));
          err.status = xhr.status;
          reject(err);
        }
      };

      xhr.onerror = () => {
        const err: any = new Error('Storage server se sampark nahi ho saka. Kripya apna internet connection check karein.');
        err.transient = true;
        reject(err);
      };

      xhr.ontimeout = () => {
        const err: any = new Error(`Upload time limit exceed ho gaya (${Math.round(timeoutMs / 1000)}s). Internet slow hai.`);
        err.transient = true;
        reject(err);
      };

      xhr.open('POST', '/api/telegram/upload', true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(fileName));
      xhr.setRequestHeader('X-Mime-Type', mimeType);
      if (targetChatId) {
        xhr.setRequestHeader('X-Chat-Id', targetChatId);
      }
      if (opts.caption) {
        xhr.setRequestHeader('X-Caption', encodeURIComponent(opts.caption));
      }
      xhr.send(blob);
    });
  }

  // Fetch fallback for headless/worker environments
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName),
      'X-Mime-Type': mimeType,
    };
    if (targetChatId) headers['X-Chat-Id'] = targetChatId;
    if (opts.caption) headers['X-Caption'] = encodeURIComponent(opts.caption);

    const res = await fetch('/api/telegram/upload', {
      method: 'POST',
      headers,
      body: blob,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!res.ok || !data?.ok || !data?.fileId) {
      const err: any = new Error(parseServerUploadError(res.status, data));
      err.status = res.status;
      throw err;
    }

    const permanentUrl = data.url || buildPermanentTelegramUrl(data.fileId, data.fileName || fileName);
    if (opts.onProgress) opts.onProgress(100);

    return {
      url: permanentUrl,
      directUrl: permanentUrl,
      fileId: data.fileId,
      fileName: data.fileName || fileName,
      fileSize: data.fileSize || blob.size,
      mimeType: data.mimeType || mimeType,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function uploadViaServerProxy(
  blob: Blob,
  fileName: string,
  targetChatId: string,
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  const defaultTimeoutMs =
    blob.size <= 1.5 * 1024 * 1024 ? 25000 : blob.size <= 5 * 1024 * 1024 ? 45000 : 120000;
  const timeoutMs = opts.timeoutMs || defaultTimeoutMs;

  try {
    return await uploadViaServerProxyOnce(blob, fileName, targetChatId, timeoutMs, opts);
  } catch (err: any) {
    const status = Number(err?.status || 0);
    const isTransient = Boolean(err?.transient) || status === 502 || status === 504;
    if (isTransient && blob.size <= 2 * 1024 * 1024) {
      await new Promise((r) => setTimeout(r, 450));
      return await uploadViaServerProxyOnce(blob, fileName, targetChatId, timeoutMs, opts);
    }
    throw err;
  }
}

/**
 * Checks Telegram Storage server proxy health and connectivity
 */
export async function checkTelegramStorageHealth(): Promise<{
  ok: boolean;
  message: string;
  botUsername?: string;
  hasStorageChatId?: boolean;
  discoveredChats?: Array<{ id: string; title: string; type: string }>;
}> {
  try {
    const res = await fetch('/api/telegram/health');
    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!data) {
      return { ok: false, message: `Server returned status ${res.status}` };
    }
    return {
      ok: Boolean(res.ok && data?.ok),
      message: data?.ok
        ? `Connected to @${data.bot?.username || 'Telegram Bot'}`
        : data?.error || `Bot offline (${res.status})`,
      botUsername: data?.bot?.username,
      hasStorageChatId: Boolean(data?.hasStorageChatId),
      discoveredChats: Array.isArray(data?.discoveredChats) ? data.discoveredChats : [],
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to reach Telegram proxy' };
  }
}

/**
 * Primary universal upload function: Uploads any media or file via /api/telegram/upload.
 */
export async function uploadToTelegramStorage(
  fileInput: File | Blob | string,
  options?: UploadOptions | string
): Promise<TelegramUploadResult> {
  const opts: UploadOptions = typeof options === 'string' ? { caption: options } : options || {};
  const targetChatId = (opts.chatId || getTelegramStorageChatId()).trim();

  let blob: Blob;
  let fileName = opts.fileName || 'file';

  if (typeof fileInput === 'string') {
    if (fileInput.startsWith('data:')) {
      const mimeMatch = fileInput.match(/^data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      blob = dataUrlToBlob(fileInput, mime);
      if (!opts.fileName) {
        const ext = mime.split('/')[1] || 'jpg';
        fileName = `upload_${Date.now()}.${ext}`;
      }
    } else {
      throw new Error('Invalid string format for file upload (must be a data: URL)');
    }
  } else if (fileInput instanceof File) {
    blob = fileInput;
    fileName = fileInput.name || fileName;
  } else {
    blob = fileInput;
  }

  // Enforce 19.5MB limit so Telegram Bot API getFile never rejects download/playback (>20MB)
  if (blob.size > TELEGRAM_MAX_FILE_SIZE_BYTES) {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File size ${sizeMb}MB hai. Telegram Bot API 20MB se badi file stream/download nahi karta — kripya 19.5MB se chhota video/file upload karein.`
    );
  }

  return await uploadViaServerProxy(blob, fileName, targetChatId, opts);
}

/**
 * Uploads an image to Telegram Cloud and returns the permanent proxy URL
 */
export async function uploadImageToTelegram(
  file: File | Blob | string,
  fileName?: string,
  caption = 'NSTA Media'
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || `image_${Date.now()}.jpg`,
    caption,
    type: 'image',
  });
  return result.url;
}

/**
 * Uploads a PDF to Telegram Cloud and returns the permanent proxy URL
 */
export async function uploadPdfToTelegram(
  file: File | Blob,
  fileName?: string,
  caption = 'NSTA Lecture PDF'
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || `document_${Date.now()}.pdf`,
    caption,
    type: 'pdf',
  });
  return result.url;
}

/**
 * Uploads an Audio file to Telegram Cloud and returns the permanent proxy URL
 */
export async function uploadAudioToTelegram(
  file: File | Blob,
  fileName?: string,
  caption = 'NSTA Audio Lecture'
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || `audio_${Date.now()}.mp3`,
    caption,
    type: 'audio',
  });
  return result.url;
}

/**
 * Uploads a Video file to Telegram Cloud with progress callback and returns the permanent proxy URL
 */
export async function uploadVideoToTelegram(
  file: File | Blob,
  fileName?: string,
  caption = 'NSTA Video Lecture',
  onProgress?: (percent: number) => void
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || (file instanceof File ? file.name : `video_${Date.now()}.mp4`),
    caption,
    type: 'video',
    onProgress,
  });
  return result.url;
}

/**
 * Sends a message to the Telegram Chat Channel
 */
export async function sendTelegramChatMessage(
  text: string,
  options?: { chatId?: string; replyToMessageId?: number; parseMode?: string }
): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch('/api/telegram/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        chat_id: options?.chatId || DEFAULT_CHAT_CHANNEL_ID || undefined,
        reply_to_message_id: options?.replyToMessageId,
        parse_mode: options?.parseMode || 'HTML',
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to send Telegram message' };
  }
}

/**
 * Syncs a new Community post to the Telegram Channel
 */
export async function sendTelegramCommunityPost(post: {
  authorName: string;
  authorRole?: string;
  text?: string;
  category?: string;
  imageUrl?: string;
  videoUrl?: string;
}): Promise<void> {
  try {
    const roleBadge = post.authorRole ? ` [${post.authorRole}]` : '';
    const categoryBadge = post.category ? `📌 <b>#${post.category.replace(/\s+/g, '_')}</b>\n` : '';
    const mediaBadge = post.imageUrl
      ? `\n🖼️ <a href="${post.imageUrl}">View Attached Image</a>`
      : post.videoUrl
      ? `\n🎥 <a href="${post.videoUrl}">Watch Attached Video</a>`
      : '';

    const formattedMessage = `📢 <b>NSTA Community Post</b>\n👤 <b>${post.authorName}${roleBadge}</b>\n${categoryBadge}\n${post.text || '(Shared Media)'}${mediaBadge}`;

    await sendTelegramChatMessage(formattedMessage);
  } catch (err) {
    console.warn('[Telegram Community Sync] Notice:', err);
  }
}
