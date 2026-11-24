/**
 * Telegram Cloud Storage Service
 * Media Storage backed by @PothiaAppBot via secure server-side proxy.
 *
 * Architecture:
 * - Browser uploads binary media to /api/telegram/upload
 * - Bot Token & Channel ID stay strictly on server-side (process.env.TELEGRAM_BOT_TOKEN / TELEGRAM_STORAGE_CHAT_ID)
 * - Files are served permanently via /api/telegram/file?fileId=... with CORS, Range requests & auto-refreshing file_path
 */

import { sbSetDocument } from './supabaseDbAdapter';

const _env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

function normalizeClientChatId(raw?: string | null): string {
  const clean = String(raw || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!clean) return '';
  const urlMatch = clean.match(/t\.me\/(?:boost\?(?:[^#]*&)?c=|c\/)(\d{6,16})/i);
  if (urlMatch?.[1]) return `-100${urlMatch[1]}`;
  if (/^100\d{9,15}$/.test(clean)) return `-${clean}`;
  return clean;
}

export const DEFAULT_STORAGE_CHAT_ID = normalizeClientChatId(_env.VITE_TELEGRAM_STORAGE_CHAT_ID);
export const DEFAULT_CHAT_CHANNEL_ID = normalizeClientChatId(_env.VITE_TELEGRAM_CHAT_CHANNEL_ID);
export const TELEGRAM_CHAT_INVITE_LINK = 'https://t.me/+p0aIY7YWgGxhYzk1';
const STORAGE_CHAT_KEY = 'nst_telegram_storage_chat_id';

// Telegram Bot API `getFile` strictly rejects downloading/streaming any file > 20MB.
export const TELEGRAM_MAX_FILE_SIZE_BYTES = Math.floor(19.5 * 1024 * 1024);
// Vercel serverless functions cap request bodies at 4.5MB; files above 3.5MB use chunked staging -> Telegram.
const SERVER_PROXY_SAFE_BYTES = Math.floor(3.5 * 1024 * 1024);
const TELEGRAM_STAGE_CHUNK_BYTES = Math.floor(1.2 * 1024 * 1024);
const MEDIA_VAULT_CHUNK_BYTES = 512 * 1024;

export interface TelegramUploadResult {
  url: string;
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  directUrl?: string;
  storage?: 'telegram' | 'vault';
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
 * Gets primary storage chat ID (local override -> channel ID -> storage chat ID)
 */
export const getTelegramStorageChatId = (): string => {
  try {
    const stored = normalizeClientChatId(localStorage.getItem(STORAGE_CHAT_KEY));
    if (stored) return stored;
  } catch {}
  return DEFAULT_CHAT_CHANNEL_ID || DEFAULT_STORAGE_CHAT_ID;
};

/**
 * Returns ordered list of valid Telegram storage chat candidates (channel first, then DM/user chat)
 */
export const getTelegramChatCandidates = (explicitChatId?: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string) => {
    const clean = normalizeClientChatId(raw);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  };
  add(explicitChatId);
  try {
    add(localStorage.getItem(STORAGE_CHAT_KEY));
  } catch {}
  add(DEFAULT_CHAT_CHANNEL_ID);
  add(DEFAULT_STORAGE_CHAT_ID);
  const priority = (id: string) => (id.startsWith('-100') ? 0 : id.startsWith('-') ? 1 : 2);
  return out.sort((a, b) => priority(a) - priority(b));
};

/**
 * Sets custom storage channel/chat ID
 */
export const setTelegramStorageChatId = (chatId: string) => {
  try {
    const clean = normalizeClientChatId(chatId);
    if (clean) {
      localStorage.setItem(STORAGE_CHAT_KEY, clean);
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

const UPLOADED_IMAGE_PREVIEW_MAP = new Map<string, string>();

export function cacheUploadedMediaPreview(permanentUrl: string, blob: Blob): void {
  try {
    if (
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function' ||
      !permanentUrl ||
      !blob ||
      blob.size === 0 ||
      !blob.type.startsWith('image/')
    ) {
      return;
    }
    const key = resolveTelegramUrl(permanentUrl);
    if (!key) return;
    const existing = UPLOADED_IMAGE_PREVIEW_MAP.get(key);
    if (existing) return;
    if (UPLOADED_IMAGE_PREVIEW_MAP.size >= 40) {
      const oldestKey = UPLOADED_IMAGE_PREVIEW_MAP.keys().next().value;
      if (oldestKey) {
        const oldUrl = UPLOADED_IMAGE_PREVIEW_MAP.get(oldestKey);
        UPLOADED_IMAGE_PREVIEW_MAP.delete(oldestKey);
        if (oldUrl) {
          try { URL.revokeObjectURL(oldUrl); } catch {}
        }
      }
    }
    UPLOADED_IMAGE_PREVIEW_MAP.set(key, URL.createObjectURL(blob));
  } catch {}
}

export function getCachedMediaPreviewUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const key = resolveTelegramUrl(String(rawUrl));
  return UPLOADED_IMAGE_PREVIEW_MAP.get(key) || '';
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

  if (
    trimmed.includes('/api/telegram/file') &&
    (trimmed.includes('fileId=') || trimmed.includes('mediaId='))
  ) {
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

/**
 * Resilient <img> onError handler for Telegram & Media Vault images:
 * retries transient 429/502/propagation delays before falling back to local session preview.
 */
export function handleTelegramImageError(
  img: HTMLImageElement,
  rawUrl?: string | null,
  onFinalFail?: () => void
): void {
  const baseUrl = resolveTelegramUrl(String(rawUrl || img.getAttribute('src') || ''));
  if (!baseUrl || baseUrl.startsWith('data:') || baseUrl.startsWith('blob:')) {
    onFinalFail?.();
    return;
  }

  const attempt = Number(img.dataset.tgRetryCount || '0');
  if (attempt < 2) {
    const nextAttempt = attempt + 1;
    img.dataset.tgRetryCount = String(nextAttempt);
    const delayMs = nextAttempt === 1 ? 800 : 1800;
    const sep = baseUrl.includes('?') ? '&' : '?';
    setTimeout(() => {
      if (!img.isConnected) return;
      img.src = `${baseUrl}${sep}_rt=${nextAttempt}`;
    }, delayMs);
    return;
  }

  const localPreview = getCachedMediaPreviewUrl(baseUrl);
  if (localPreview && !img.dataset.tgLocalFallback) {
    img.dataset.tgLocalFallback = '1';
    img.src = localPreview;
    return;
  }

  onFinalFail?.();
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
  fallbackChatIds: string[],
  timeoutMs: number,
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  const mimeType = blob.type || 'application/octet-stream';
  const fallbacksHeader = fallbackChatIds.join(',');

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
          if (data.storage === 'vault') {
            console.warn('[TelegramStorage] Fallback vault used:', data.telegramFallbackReason || 'unknown');
          }
          const permanentUrl = data.url || buildPermanentTelegramUrl(data.fileId, data.fileName || fileName);
          cacheUploadedMediaPreview(permanentUrl, blob);
          if (opts.onProgress) opts.onProgress(100);
          resolve({
            url: permanentUrl,
            directUrl: permanentUrl,
            fileId: data.fileId,
            fileName: data.fileName || fileName,
            fileSize: data.fileSize || blob.size,
            mimeType: data.mimeType || mimeType,
            storage: data.storage || 'telegram',
          });
        } else {
          const err: any = new Error(parseServerUploadError(xhr.status, data));
          err.status = xhr.status;
          if (data?.retryAfter) err.retryAfter = Number(data.retryAfter);
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
      if (fallbacksHeader) {
        xhr.setRequestHeader('X-Chat-Fallbacks', fallbacksHeader);
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
    if (fallbacksHeader) headers['X-Chat-Fallbacks'] = fallbacksHeader;
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
      if (data?.retryAfter) err.retryAfter = Number(data.retryAfter);
      throw err;
    }

    if (data.storage === 'vault') {
      console.warn('[TelegramStorage] Fallback vault used:', data.telegramFallbackReason || 'unknown');
    }
    const permanentUrl = data.url || buildPermanentTelegramUrl(data.fileId, data.fileName || fileName);
    cacheUploadedMediaPreview(permanentUrl, blob);
    if (opts.onProgress) opts.onProgress(100);

    return {
      url: permanentUrl,
      directUrl: permanentUrl,
      fileId: data.fileId,
      fileName: data.fileName || fileName,
      fileSize: data.fileSize || blob.size,
      mimeType: data.mimeType || mimeType,
      storage: data.storage || 'telegram',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function blobSliceToBase64(slice: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read media chunk'));
    reader.readAsDataURL(slice);
  });
}

async function uploadToSupabaseMediaVault(
  blob: Blob,
  fileName: string,
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  const mimeType = blob.type || 'application/octet-stream';
  const mediaId = `mv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = new Date().toISOString();

  if (opts.onProgress) opts.onProgress(20);

  if (blob.size <= MEDIA_VAULT_CHUNK_BYTES) {
    const b64 = await blobSliceToBase64(blob);
    const saved = await sbSetDocument(
      `media_vault/${mediaId}`,
      {
        mediaId,
        fileName,
        mimeType,
        fileSize: blob.size,
        chunkCount: 1,
        chunkSize: blob.size,
        encoding: 'base64',
        data: b64,
        createdAt,
      },
      false
    );
    if (!saved) {
      throw new Error('Media vault upload failed');
    }
    const permanentUrl = `/api/telegram/file?mediaId=${encodeURIComponent(mediaId)}&name=${encodeURIComponent(fileName)}`;
    cacheUploadedMediaPreview(permanentUrl, blob);
    if (opts.onProgress) opts.onProgress(100);
    return {
      url: permanentUrl,
      directUrl: permanentUrl,
      fileId: mediaId,
      fileName,
      fileSize: blob.size,
      mimeType,
    };
  }

  const chunkCount = Math.ceil(blob.size / MEDIA_VAULT_CHUNK_BYTES);
  let uploadedChunks = 0;

  for (let i = 0; i < chunkCount; i += 2) {
    const batchIndices = i + 1 < chunkCount ? [i, i + 1] : [i];
    const results = await Promise.all(
      batchIndices.map(async (idx) => {
        const start = idx * MEDIA_VAULT_CHUNK_BYTES;
        const end = Math.min(blob.size, start + MEDIA_VAULT_CHUNK_BYTES);
        const b64 = await blobSliceToBase64(blob.slice(start, end));
        const ok = await sbSetDocument(
          `media_vault/${mediaId}/chunk_${idx}`,
          { index: idx, data: b64 },
          false
        );
        if (ok) {
          uploadedChunks++;
          if (opts.onProgress) {
            const pct = Math.min(94, Math.max(22, Math.round(20 + (uploadedChunks / chunkCount) * 74)));
            opts.onProgress(pct);
          }
        }
        return ok;
      })
    );
    if (results.some((ok) => !ok)) {
      throw new Error('Media chunk upload failed');
    }
  }

  const metaOk = await sbSetDocument(
    `media_vault/${mediaId}`,
    {
      mediaId,
      fileName,
      mimeType,
      fileSize: blob.size,
      chunkCount,
      chunkSize: MEDIA_VAULT_CHUNK_BYTES,
      encoding: 'base64',
      createdAt,
    },
    false
  );
  if (!metaOk) {
    throw new Error('Media vault metadata save failed');
  }

  const permanentUrl = `/api/telegram/file?mediaId=${encodeURIComponent(mediaId)}&name=${encodeURIComponent(fileName)}`;
  cacheUploadedMediaPreview(permanentUrl, blob);
  if (opts.onProgress) opts.onProgress(100);
  return {
    url: permanentUrl,
    directUrl: permanentUrl,
    fileId: mediaId,
    fileName,
    fileSize: blob.size,
    mimeType,
  };
}

/**
 * Uploads large files (3.5MB - 19.5MB) in <=1.2MB chunks to /api/telegram/stage-chunk
 * and commits them directly to Telegram via /api/telegram/stage-commit (staging chunks are purged right away).
 */
async function uploadViaChunkedTelegramStaging(
  blob: Blob,
  fileName: string,
  targetChatId: string,
  fallbackChatIds: string[],
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  const mimeType = blob.type || 'application/octet-stream';
  const uploadId = `tgs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const chunkCount = Math.ceil(blob.size / TELEGRAM_STAGE_CHUNK_BYTES);
  let uploaded = 0;

  if (opts.onProgress) opts.onProgress(12);

  for (let i = 0; i < chunkCount; i += 2) {
    const batch = i + 1 < chunkCount ? [i, i + 1] : [i];
    await Promise.all(
      batch.map(async (idx) => {
        const start = idx * TELEGRAM_STAGE_CHUNK_BYTES;
        const end = Math.min(blob.size, start + TELEGRAM_STAGE_CHUNK_BYTES);
        const slice = blob.slice(start, end);
        const res = await fetch('/api/telegram/stage-chunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Upload-Id': uploadId,
            'X-Chunk-Index': String(idx),
            'X-Total-Chunks': String(chunkCount),
          },
          body: slice,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const err: any = new Error(errData?.error || `Chunk ${idx + 1} upload fail (${res.status})`);
          err.status = res.status;
          throw err;
        }
        uploaded++;
        if (opts.onProgress) {
          const pct = Math.min(84, Math.max(15, Math.round(12 + (uploaded / chunkCount) * 72)));
          opts.onProgress(pct);
        }
      })
    );
  }

  if (opts.onProgress) opts.onProgress(88);

  const commitRes = await fetch('/api/telegram/stage-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      chunkCount,
      fileName,
      mimeType,
      caption: opts.caption,
      chatId: targetChatId || undefined,
      fallbackChatIds,
      allowVaultFallback: true,
    }),
  });

  const data = await commitRes.json().catch(() => null);
  if (!commitRes.ok || !data?.ok || !data?.fileId) {
    const err: any = new Error(parseServerUploadError(commitRes.status, data));
    err.status = commitRes.status;
    if (data?.retryAfter) err.retryAfter = Number(data.retryAfter);
    throw err;
  }

  if (data.storage === 'vault') {
    console.warn('[TelegramStorage] Chunk commit used fallback vault:', data.telegramFallbackReason || 'unknown');
  }

  const permanentUrl = data.url || buildPermanentTelegramUrl(data.fileId, data.fileName || fileName);
  cacheUploadedMediaPreview(permanentUrl, blob);
  if (opts.onProgress) opts.onProgress(100);

  return {
    url: permanentUrl,
    directUrl: permanentUrl,
    fileId: data.fileId,
    fileName: data.fileName || fileName,
    fileSize: data.fileSize || blob.size,
    mimeType: data.mimeType || mimeType,
    storage: data.storage || 'telegram',
  };
}

async function uploadViaServerProxy(
  blob: Blob,
  fileName: string,
  targetChatId: string,
  fallbackChatIds: string[],
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  // Files > 3.5MB bypass Vercel's 4.5MB body cap by staging <=1.2MB chunks -> assembling on server -> saving to Telegram Cloud
  if (blob.size > SERVER_PROXY_SAFE_BYTES) {
    try {
      return await uploadViaChunkedTelegramStaging(blob, fileName, targetChatId, fallbackChatIds, opts);
    } catch (stageErr) {
      console.warn('[TelegramStorage] Chunked Telegram staging failed, trying Vault fallback:', stageErr);
      return await uploadToSupabaseMediaVault(blob, fileName, opts);
    }
  }

  const defaultTimeoutMs =
    blob.size <= 1.5 * 1024 * 1024 ? 25000 : 45000;
  const timeoutMs = opts.timeoutMs || defaultTimeoutMs;

  try {
    return await uploadViaServerProxyOnce(blob, fileName, targetChatId, fallbackChatIds, timeoutMs, opts);
  } catch (err: any) {
    const status = Number(err?.status || 0);
    const retryAfter = Number(err?.retryAfter || 0);

    // Brief 429 retry if Telegram asked for <= 8s
    if (status === 429 && retryAfter > 0 && retryAfter <= 8) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000 + 250));
      try {
        return await uploadViaServerProxyOnce(blob, fileName, targetChatId, fallbackChatIds, timeoutMs, opts);
      } catch {}
    }

    const isTransient = Boolean(err?.transient) || status === 502 || status === 504;
    if (isTransient && blob.size <= 2 * 1024 * 1024) {
      await new Promise((r) => setTimeout(r, 450));
      try {
        return await uploadViaServerProxyOnce(blob, fileName, targetChatId, fallbackChatIds, timeoutMs, opts);
      } catch {}
    }

    // Emergency 1% resilience fallback to Cloud Media Vault when Telegram server proxy is unreachable
    const shouldFallbackToVault =
      status === 429 ||
      status === 413 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      Boolean(err?.transient);

    if (shouldFallbackToVault) {
      try {
        return await uploadToSupabaseMediaVault(blob, fileName, opts);
      } catch (vaultErr) {
        console.warn('[TelegramStorage] Media vault fallback failed:', vaultErr);
      }
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
  maxDirectUploadBytes?: number;
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
      maxDirectUploadBytes: data?.maxDirectUploadBytes,
      discoveredChats: Array.isArray(data?.discoveredChats) ? data.discoveredChats : [],
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to reach Telegram proxy' };
  }
}

/**
 * Primary universal upload function: Uploads any media or file via /api/telegram/upload (or chunked Telegram staging for >3.5MB).
 */
export async function uploadToTelegramStorage(
  fileInput: File | Blob | string,
  options?: UploadOptions | string
): Promise<TelegramUploadResult> {
  const opts: UploadOptions = typeof options === 'string' ? { caption: options } : options || {};
  const chatCandidates = getTelegramChatCandidates(opts.chatId);
  const targetChatId = chatCandidates[0] || '';

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

  return await uploadViaServerProxy(blob, fileName, targetChatId, chatCandidates, opts);
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
    const toAbsoluteHttpUrl = (raw?: string): string => {
      const clean = String(raw || '').trim();
      if (!clean || clean.startsWith('data:') || clean.startsWith('blob:')) return '';
      if (/^https?:\/\//i.test(clean)) return clean;
      if (clean.startsWith('/') && typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
        return `${window.location.origin}${clean}`;
      }
      return '';
    };

    const roleBadge = post.authorRole ? ` [${post.authorRole}]` : '';
    const categoryBadge = post.category ? `📌 <b>#${post.category.replace(/\s+/g, '_')}</b>\n` : '';
    const absImage = toAbsoluteHttpUrl(post.imageUrl);
    const absVideo = toAbsoluteHttpUrl(post.videoUrl);
    const mediaBadge = absImage
      ? `\n🖼️ <a href="${absImage}">View Attached Image</a>`
      : absVideo
      ? `\n🎥 <a href="${absVideo}">Watch Attached Video</a>`
      : '';

    const formattedMessage = `📢 <b>NSTA Community Post</b>\n👤 <b>${post.authorName}${roleBadge}</b>\n${categoryBadge}\n${post.text || '(Shared Media)'}${mediaBadge}`;

    await sendTelegramChatMessage(formattedMessage);
  } catch (err) {
    console.warn('[Telegram Community Sync] Notice:', err);
  }
}
