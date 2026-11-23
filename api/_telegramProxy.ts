const FALLBACK_TG_BOT_TOKEN = "8932524192:AAGVxYSuKPZX6sOQFkXz0U7ESVQ2NcHmJZw";

const FILE_PATH_CACHE = new Map<string, { filePath: string; fileSize?: number; expiresAt: number }>();
const FILE_PATH_TTL_MS = 20 * 60 * 1000; // 20 minutes (safely inside Telegram's ~1 hour link window)

const BOT_TOKEN_RE = /^\d{6,15}:[A-Za-z0-9_-]{20,80}$/;
const FILE_ID_RE = /^[A-Za-z0-9_=-]{8,300}$/;
const FILE_PATH_RE = /^[A-Za-z0-9_./-]{1,300}$/;

export function resolveTelegramBotToken(overrideToken?: string | null): string {
  const candidate = String(overrideToken || "").trim();
  if (candidate && BOT_TOKEN_RE.test(candidate)) {
    return candidate;
  }
  const envToken = String(
    process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || ""
  ).trim();
  if (envToken && BOT_TOKEN_RE.test(envToken)) {
    return envToken;
  }
  return FALLBACK_TG_BOT_TOKEN;
}

export function isValidTelegramFileId(fileId?: string | null): boolean {
  return Boolean(fileId && FILE_ID_RE.test(String(fileId).trim()));
}

export function isSafeTelegramFilePath(filePath?: string | null): boolean {
  const clean = String(filePath || "").trim();
  if (!clean || clean.startsWith("/") || clean.includes("..")) return false;
  return FILE_PATH_RE.test(clean);
}

export function invalidateTelegramFilePathCache(fileId: string, token?: string): void {
  const key = `${token || "default"}:${fileId}`;
  FILE_PATH_CACHE.delete(key);
  FILE_PATH_CACHE.delete(fileId);
}

export async function resolveTelegramFilePath(
  fileId: string,
  token: string,
  forceRefresh = false
): Promise<{ filePath: string; fileSize?: number } | { error: string; status: number }> {
  const cleanId = String(fileId || "").trim();
  if (!isValidTelegramFileId(cleanId)) {
    return { error: "Invalid fileId format", status: 400 };
  }

  const cacheKey = `${token.slice(0, 12)}:${cleanId}`;
  if (!forceRefresh) {
    const cached = FILE_PATH_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { filePath: cached.filePath, fileSize: cached.fileSize };
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(cleanId)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    const tgJson = (await tgRes.json().catch(() => null)) as any;
    if (!tgRes.ok || !tgJson?.ok || !tgJson?.result?.file_path) {
      return {
        error: tgJson?.description || "Telegram file not found",
        status: tgRes.status === 400 ? 404 : tgRes.status || 404,
      };
    }

    const filePath = String(tgJson.result.file_path).trim();
    if (!isSafeTelegramFilePath(filePath)) {
      return { error: "Unsafe Telegram file path", status: 400 };
    }
    const fileSize =
      typeof tgJson.result.file_size === "number" ? tgJson.result.file_size : undefined;

    FILE_PATH_CACHE.set(cacheKey, {
      filePath,
      fileSize,
      expiresAt: Date.now() + FILE_PATH_TTL_MS,
    });
    return { filePath, fileSize };
  } catch (err: any) {
    return { error: err?.message || "Failed to resolve Telegram fileId", status: 502 };
  }
}

const EXT_MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
};

export function detectMimeType(opts: {
  fileName?: string;
  filePath?: string;
  headerContentType?: string | null;
  sampleBytes?: Buffer | Uint8Array | null;
}): string {
  const headerCt = String(opts.headerContentType || "").split(";")[0].trim().toLowerCase();
  if (
    headerCt &&
    headerCt !== "application/octet-stream" &&
    headerCt !== "binary/octet-stream"
  ) {
    return headerCt;
  }

  // Magic-byte inspection (handles Telegram sendDocument where images/PDFs/videos return octet-stream)
  const buf = opts.sampleBytes;
  if (buf && buf.length >= 12) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return "image/png";
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return "image/webp";
    }
    if (
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
    ) {
      return "image/gif";
    }
    if (
      buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d
    ) {
      return "application/pdf";
    }
    // MP4 / MOV: 'ftyp' at offset 4
    if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      return "video/mp4";
    }
    // WebM / MKV EBML header
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return "video/webm";
    }
    // MP3 ID3 or sync frame
    if (
      (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    ) {
      return "audio/mpeg";
    }
    // WAV RIFF....WAVE
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
    ) {
      return "audio/wav";
    }
    // OGG OggS
    if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return "audio/ogg";
    }
  }

  for (const candidate of [opts.fileName, opts.filePath]) {
    if (!candidate) continue;
    const clean = String(candidate).split("?")[0].trim().toLowerCase();
    const dotIdx = clean.lastIndexOf(".");
    if (dotIdx !== -1) {
      const ext = clean.slice(dotIdx + 1);
      if (EXT_MIME_MAP[ext]) return EXT_MIME_MAP[ext];
    }
  }

  return headerCt || "application/octet-stream";
}

export function extractTelegramParamsFromUrl(rawUrl: string): {
  fileId?: string;
  path?: string;
  name?: string;
  token?: string;
} | null {
  try {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed.startsWith("/api/telegram/file")) return null;
    const u = new URL(trimmed, "https://local.invalid");
    return {
      fileId: u.searchParams.get("fileId") || u.searchParams.get("file_id") || undefined,
      path: u.searchParams.get("path") || undefined,
      name: u.searchParams.get("name") || undefined,
      token: u.searchParams.get("token") || undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchTelegramFileBuffer(opts: {
  fileId?: string;
  filePath?: string;
  fileName?: string;
  token?: string;
  timeoutMs?: number;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  const token = resolveTelegramBotToken(opts.token);
  let resolvedPath = String(opts.filePath || "").trim();

  if (opts.fileId) {
    const resolved = await resolveTelegramFilePath(opts.fileId, token);
    if ("error" in resolved) return null;
    resolvedPath = resolved.filePath;
  }

  if (!isSafeTelegramFilePath(resolvedPath)) return null;

  const tryDownload = async (pathToFetch: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 6000);
    try {
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${pathToFetch}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  let res = await tryDownload(resolvedPath);
  if ((!res || !res.ok) && opts.fileId) {
    // Self-heal if cached Telegram path rotated: force-refresh getFile once
    invalidateTelegramFilePathCache(opts.fileId, token);
    const refreshed = await resolveTelegramFilePath(opts.fileId, token, true);
    if (!("error" in refreshed)) {
      resolvedPath = refreshed.filePath;
      res = await tryDownload(resolvedPath);
    }
  }

  if (!res || !res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = detectMimeType({
    fileName: opts.fileName,
    filePath: resolvedPath,
    headerContentType: res.headers.get("content-type"),
    sampleBytes: buf,
  });

  return { buffer: buf, contentType };
}
