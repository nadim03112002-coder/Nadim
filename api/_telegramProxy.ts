const FILE_PATH_CACHE = new Map<string, { filePath: string; fileSize?: number; expiresAt: number }>();
const FILE_PATH_TTL_MS = 20 * 60 * 1000; // 20 minutes (safely inside Telegram's ~1 hour link window)

const DISCOVERED_CHAT_CACHE = new Map<
  string,
  { chats: Array<{ id: string; title: string; type: string }>; expiresAt: number }
>();
const DISCOVERED_CHAT_TTL_MS = 10 * 60 * 1000;

const BOT_TOKEN_RE = /^\d{6,15}:[A-Za-z0-9_-]{20,80}$/;
const FILE_ID_RE = /^[A-Za-z0-9_=-]{8,300}$/;
const FILE_PATH_RE = /^[A-Za-z0-9_./-]{1,300}$/;
const CHAT_ID_RE = /^-?\d{5,20}$|^@[A-Za-z][A-Za-z0-9_]{3,63}$/;

// Legacy chat IDs tied to the older bot setup; never auto-fallback to them when env is unset
const LEGACY_CHAT_IDS = new Set(["7849468653", "-1004290996442"]);

// Telegram Bot API allows sendDocument up to 50MB, but getFile strictly fails above 20MB.
export const TELEGRAM_MAX_PLAYABLE_BYTES = Math.floor(19.5 * 1024 * 1024);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanEnvValue(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

export function resolveTelegramBotToken(): string {
  const candidates = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_TOKEN,
    process.env.BOT_TOKEN,
    process.env.VITE_TELEGRAM_BOT_TOKEN,
  ];
  for (const raw of candidates) {
    const cleaned = cleanEnvValue(raw).replace(/^bot(?=\d+:)/i, "");
    if (cleaned && BOT_TOKEN_RE.test(cleaned)) {
      return cleaned;
    }
  }
  return "";
}

export function getTelegramTokenDiagnostics(): {
  envPresent: boolean;
  reason: "ok" | "missing_in_runtime_env" | "invalid_token_format";
} {
  if (resolveTelegramBotToken()) {
    return { envPresent: true, reason: "ok" };
  }
  const hasAnyRaw = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_TOKEN,
    process.env.BOT_TOKEN,
    process.env.VITE_TELEGRAM_BOT_TOKEN,
  ].some((v) => Boolean(cleanEnvValue(v)));
  return {
    envPresent: hasAnyRaw,
    reason: hasAnyRaw ? "invalid_token_format" : "missing_in_runtime_env",
  };
}

export function isValidTelegramChatId(chatId?: string | null): boolean {
  const clean = String(chatId || "").trim();
  return Boolean(clean && CHAT_ID_RE.test(clean));
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
  const key = `${(token || "default").slice(0, 12)}:${fileId}`;
  FILE_PATH_CACHE.delete(key);
  FILE_PATH_CACHE.delete(fileId);
}

export async function discoverTelegramStorageChats(
  token: string,
  forceRefresh = false
): Promise<Array<{ id: string; title: string; type: string }>> {
  if (!token) return [];
  const cacheKey = token.slice(0, 12);
  if (!forceRefresh) {
    const cached = DISCOVERED_CHAT_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.chats;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const allowed = encodeURIComponent(JSON.stringify(["channel_post", "my_chat_member", "message"]));
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=30&allowed_updates=${allowed}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json().catch(() => null)) as any;
    if (!json?.ok || !Array.isArray(json.result)) return [];

    const byId = new Map<string, { id: string; title: string; type: string }>();
    for (const upd of json.result) {
      const chat = upd?.channel_post?.chat || upd?.my_chat_member?.chat || upd?.message?.chat;
      if (!chat || chat.id === undefined || chat.id === null) continue;
      const idStr = String(chat.id);
      if (!isValidTelegramChatId(idStr)) continue;
      byId.set(idStr, {
        id: idStr,
        title: String(chat.title || chat.username || chat.first_name || idStr),
        type: String(chat.type || "unknown"),
      });
    }

    // Prefer channels, then supergroups/groups, then private chats
    const priority = (t: string) => (t === "channel" ? 0 : t === "supergroup" || t === "group" ? 1 : 2);
    const chats = Array.from(byId.values()).sort((a, b) => priority(a.type) - priority(b.type));

    DISCOVERED_CHAT_CACHE.set(cacheKey, {
      chats,
      expiresAt: Date.now() + DISCOVERED_CHAT_TTL_MS,
    });
    return chats;
  } catch {
    return [];
  }
}

export async function resolveTelegramStorageChatId(
  token: string,
  requestedChatId?: string | null
): Promise<string> {
  const envCandidates = [
    process.env.TELEGRAM_STORAGE_CHAT_ID,
    process.env.TELEGRAM_CHAT_CHANNEL_ID,
    process.env.VITE_TELEGRAM_STORAGE_CHAT_ID,
    process.env.VITE_TELEGRAM_CHAT_CHANNEL_ID,
  ];
  for (const raw of envCandidates) {
    const cleaned = cleanEnvValue(raw);
    if (isValidTelegramChatId(cleaned)) return cleaned;
  }

  const candidate = cleanEnvValue(requestedChatId);
  if (isValidTelegramChatId(candidate) && !LEGACY_CHAT_IDS.has(candidate)) {
    return candidate;
  }

  const discovered = await discoverTelegramStorageChats(token);
  if (discovered.length > 0) {
    return discovered[0].id;
  }

  return "";
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
  if (!token) {
    return { error: "TELEGRAM_BOT_TOKEN is not configured on the server", status: 503 };
  }

  const cacheKey = `${token.slice(0, 12)}:${cleanId}`;
  if (!forceRefresh) {
    const cached = FILE_PATH_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { filePath: cached.filePath, fileSize: cached.fileSize };
    }
  }

  const callGetFile = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(cleanId)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      const tgJson = (await tgRes.json().catch(() => null)) as any;
      return { tgRes, tgJson };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    let { tgRes, tgJson } = await callGetFile();

    // Auto-retry once on brief Telegram 429 rate-limit windows
    if (tgRes.status === 429) {
      const retrySec = Number(tgJson?.parameters?.retry_after || 1);
      if (retrySec > 0 && retrySec <= 3) {
        await sleep(retrySec * 1000 + 150);
        ({ tgRes, tgJson } = await callGetFile());
      }
    }

    if (!tgRes.ok || !tgJson?.ok || !tgJson?.result?.file_path) {
      const desc = String(tgJson?.description || "Telegram file not found");
      if (/file is too big/i.test(desc)) {
        return {
          error: "File 20MB se badi hai — Telegram Bot API 20MB se badi file stream nahi karta.",
          status: 413,
        };
      }
      return {
        error: desc,
        status: tgRes.status === 429 ? 429 : tgRes.status === 400 ? 404 : tgRes.status || 404,
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

export async function readUploadPayloadFromRequest(req: any): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  caption?: string;
  chatId?: string;
} | { error: string; status: number }> {
  const headerFileName = req.headers?.["x-file-name"]
    ? decodeURIComponent(String(req.headers["x-file-name"]))
    : "";
  const headerCaption = req.headers?.["x-caption"]
    ? decodeURIComponent(String(req.headers["x-caption"]))
    : undefined;
  const headerChatId = req.headers?.["x-chat-id"]
    ? String(req.headers["x-chat-id"]).trim()
    : undefined;
  const headerMime = String(req.headers?.["x-mime-type"] || req.headers?.["content-type"] || "")
    .split(";")[0]
    .trim();

  if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
    return {
      buffer: Buffer.from(req.body),
      fileName: headerFileName || `upload_${Date.now()}.bin`,
      mimeType: headerMime || "application/octet-stream",
      caption: headerCaption,
      chatId: headerChatId,
    };
  }

  if (Buffer.isBuffer(req.rawBody) && headerMime !== "application/json") {
    return {
      buffer: req.rawBody,
      fileName: headerFileName || `upload_${Date.now()}.bin`,
      mimeType: headerMime || "application/octet-stream",
      caption: headerCaption,
      chatId: headerChatId,
    };
  }

  if (req.body && typeof req.body === "object" && (req.body.dataUrl || req.body.base64)) {
    const rawData = String(req.body.dataUrl || req.body.base64);
    const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = match?.[1] || String(req.body.mimeType || headerMime || "application/octet-stream");
    const b64 = match?.[2] || rawData;
    const buffer = Buffer.from(b64, "base64");
    return {
      buffer,
      fileName: String(req.body.fileName || headerFileName || `upload_${Date.now()}.bin`),
      mimeType,
      caption: req.body.caption ? String(req.body.caption) : headerCaption,
      chatId: req.body.chatId ? String(req.body.chatId).trim() : headerChatId,
    };
  }

  if (typeof req.body === "string" && req.body.length > 0 && headerMime !== "application/json") {
    return {
      buffer: Buffer.from(req.body, "latin1"),
      fileName: headerFileName || `upload_${Date.now()}.bin`,
      mimeType: headerMime || "application/octet-stream",
      caption: headerCaption,
      chatId: headerChatId,
    };
  }

  // Fallback: collect raw stream chunks (supports Vercel or raw Express streams)
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const hardCap = TELEGRAM_MAX_PLAYABLE_BYTES + 256 * 1024;
  try {
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > hardCap) {
        return {
          error: "File 19.5MB se badi hai — Telegram playback limit 20MB hai.",
          status: 413,
        };
      }
      chunks.push(buf);
    }
  } catch (err: any) {
    return { error: err?.message || "Failed to read upload stream", status: 400 };
  }

  const combined = Buffer.concat(chunks);
  if (combined.length === 0) {
    return { error: "Empty file upload", status: 400 };
  }

  if (headerMime === "application/json") {
    try {
      const parsed = JSON.parse(combined.toString("utf8"));
      const rawData = String(parsed?.dataUrl || parsed?.base64 || "");
      const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
      const mimeType = match?.[1] || String(parsed?.mimeType || "application/octet-stream");
      const buffer = Buffer.from(match?.[2] || rawData, "base64");
      return {
        buffer,
        fileName: String(parsed?.fileName || headerFileName || `upload_${Date.now()}.bin`),
        mimeType,
        caption: parsed?.caption ? String(parsed.caption) : headerCaption,
        chatId: parsed?.chatId ? String(parsed.chatId).trim() : headerChatId,
      };
    } catch {
      return { error: "Invalid JSON upload payload", status: 400 };
    }
  }

  return {
    buffer: combined,
    fileName: headerFileName || `upload_${Date.now()}.bin`,
    mimeType: headerMime || "application/octet-stream",
    caption: headerCaption,
    chatId: headerChatId,
  };
}

export async function uploadBufferToTelegram(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  caption?: string;
  chatId?: string;
}): Promise<
  | {
      ok: true;
      url: string;
      fileId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    }
  | { ok: false; status: number; error: string }
> {
  const token = resolveTelegramBotToken();
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: "Server par TELEGRAM_BOT_TOKEN configure nahi hai. Settings -> Secrets me TELEGRAM_BOT_TOKEN set karein.",
    };
  }

  if (!opts.buffer || opts.buffer.length === 0) {
    return { ok: false, status: 400, error: "File khali hai, upload nahi ho sakti." };
  }

  if (opts.buffer.length > TELEGRAM_MAX_PLAYABLE_BYTES) {
    const sizeMb = (opts.buffer.length / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      status: 413,
      error: `File size ${sizeMb}MB hai. Telegram Bot API 20MB se badi file play/download nahi karta — kripya 19.5MB se chhoti file upload karein.`,
    };
  }

  const targetChatId = await resolveTelegramStorageChatId(token, opts.chatId);
  if (!targetChatId) {
    return {
      ok: false,
      status: 400,
      error:
        "TELEGRAM_STORAGE_CHAT_ID set nahi hai. Apne naye channel me @LmpsschoolappBot ko Admin banakar ek test message bhejein ya Settings -> Secrets me TELEGRAM_STORAGE_CHAT_ID add karein.",
    };
  }

  const safeName = String(opts.fileName || `upload_${Date.now()}.bin`).replace(/[\r\n/\\]+/g, "_");
  const detectedMime = detectMimeType({
    fileName: safeName,
    headerContentType: opts.mimeType,
    sampleBytes: opts.buffer,
  });

  const sendAttempt = async () => {
    const form = new FormData();
    form.append("chat_id", targetChatId);
    if (opts.caption) {
      form.append("caption", String(opts.caption).slice(0, 1000));
    }
    const blob = new Blob([new Uint8Array(opts.buffer)], { type: detectedMime });
    form.append("document", blob, safeName);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = (await res.json().catch(() => null)) as any;
      return { res, json };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    let { res, json } = await sendAttempt();
    if (res.status === 429) {
      const retrySec = Number(json?.parameters?.retry_after || 1);
      if (retrySec > 0 && retrySec <= 3) {
        await sleep(retrySec * 1000 + 150);
        ({ res, json } = await sendAttempt());
      }
    }

    if (!res.ok || !json?.ok) {
      const rawDesc = String(json?.description || `Telegram error (${res.status})`);
      let friendly = rawDesc;
      if (/chat not found|bot is not a member|need administrator rights|have no rights/i.test(rawDesc)) {
        friendly = `Telegram channel permission error (${rawDesc}). Ensure karein ki @LmpsschoolappBot naye channel me Admin hai aur TELEGRAM_STORAGE_CHAT_ID sahi hai.`;
      } else if (/unauthorized/i.test(rawDesc)) {
        friendly = "Telegram Bot Token invalid ya revoke ho gaya hai. Kripya server TELEGRAM_BOT_TOKEN check karein.";
      } else if (res.status === 429) {
        friendly = "Telegram par bahut zyada requests aa rahi hain (429). Kuch second baad dobara try karein.";
      }
      return {
        ok: false,
        status: res.status === 429 ? 429 : res.status >= 400 ? res.status : 502,
        error: friendly,
      };
    }

    const doc =
      json.result?.document ||
      (Array.isArray(json.result?.photo) ? json.result.photo.slice(-1)[0] : null) ||
      json.result?.audio ||
      json.result?.video ||
      json.result?.voice ||
      json.result?.animation;

    const fileId = String(doc?.file_id || "").trim();
    if (!fileId) {
      return { ok: false, status: 502, error: "Telegram se file_id prapt nahi hua." };
    }

    const finalFileName = String(doc?.file_name || safeName);
    const permanentUrl = `/api/telegram/file?fileId=${encodeURIComponent(fileId)}&name=${encodeURIComponent(finalFileName)}`;

    return {
      ok: true,
      url: permanentUrl,
      fileId,
      fileName: finalFileName,
      fileSize: Number(doc?.file_size || opts.buffer.length),
      mimeType: String(doc?.mime_type || detectedMime),
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 502,
      error: err?.message || "Telegram upload fail ho gaya.",
    };
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
} | null {
  try {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed.startsWith("/api/telegram/file")) return null;
    const u = new URL(trimmed, "https://local.invalid");
    return {
      fileId: u.searchParams.get("fileId") || u.searchParams.get("file_id") || undefined,
      path: u.searchParams.get("path") || undefined,
      name: u.searchParams.get("name") || undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchTelegramFileBuffer(opts: {
  fileId?: string;
  filePath?: string;
  fileName?: string;
  timeoutMs?: number;
}): Promise<{ buffer: Buffer; contentType: string } | null> {
  const token = resolveTelegramBotToken();
  if (!token) return null;

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
