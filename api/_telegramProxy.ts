import dns from "dns";
import https from "https";
import net from "net";
import { saveMediaVaultToSupabase } from "./_supabaseServer.js";

try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
    (net as any).setDefaultAutoSelectFamily(false);
  }
} catch {}

// Disable keepAlive on Vercel serverless to avoid stale half-open TLS sockets across Lambda freezes
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const TELEGRAM_HTTPS_AGENT = new https.Agent({
  keepAlive: !IS_SERVERLESS,
  keepAliveMsecs: 30000,
  maxSockets: 16,
  family: 4,
});

export async function telegramBotApiRequest<T = any>(opts: {
  token: string;
  methodPath: string;
  httpMethod?: "GET" | "POST";
  body?: Buffer | string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): Promise<{ status: number; ok: boolean; json: T | null }> {
  const method = opts.httpMethod || (opts.body ? "POST" : "GET");
  const timeoutMs = opts.timeoutMs || 12000;
  const bodyBuf =
    opts.body === undefined
      ? undefined
      : Buffer.isBuffer(opts.body)
      ? opts.body
      : Buffer.from(opts.body, "utf8");

  return new Promise((resolve, reject) => {
    const reqHeaders: Record<string, string | number> = {
      ...(opts.headers || {}),
    };
    if (bodyBuf) {
      reqHeaders["Content-Length"] = bodyBuf.length;
    }

    const req = https.request(
      {
        hostname: "api.telegram.org",
        port: 443,
        path: `/bot${opts.token}/${opts.methodPath}`,
        method,
        agent: TELEGRAM_HTTPS_AGENT,
        family: 4,
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const status = res.statusCode || 502;
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: T | null = null;
          try {
            json = raw ? (JSON.parse(raw) as T) : null;
          } catch {}
          resolve({ status, ok: status >= 200 && status < 300, json });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      const err: any = new Error(`Telegram API timeout after ${timeoutMs}ms`);
      err.name = "AbortError";
      req.destroy(err);
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (bodyBuf) {
      req.write(bodyBuf);
    }
    req.end();
  });
}

function buildMultipartFormPayload(
  fields: Array<{ name: string; value: string }>,
  fileField?: { name: string; fileName: string; mimeType: string; buffer: Buffer }
): { body: Buffer; contentType: string } {
  const boundary = `----NstaTg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  const chunks: Buffer[] = [];
  for (const field of fields) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
        "utf8"
      )
    );
  }
  if (fileField) {
    const safeFileName = fileField.fileName.replace(/["\r\n]/g, "_");
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${safeFileName}"\r\nContent-Type: ${fileField.mimeType}\r\n\r\n`,
        "utf8"
      )
    );
    chunks.push(fileField.buffer);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const FILE_PATH_CACHE = new Map<string, { filePath: string; fileSize?: number; expiresAt: number }>();
const FILE_PATH_TTL_MS = 20 * 60 * 1000; // 20 minutes (safely inside Telegram's ~1 hour link window)

const DISCOVERED_CHAT_CACHE = new Map<
  string,
  { chats: Array<{ id: string; title: string; type: string }>; expiresAt: number }
>();
const DISCOVERED_CHAT_TTL_MS = 10 * 60 * 1000;

const BOT_TOKEN_RE = /^\d{6,15}:[A-Za-z0-9_-]{20,100}$/;
const BOT_TOKEN_EXTRACT_RE = /\d{6,15}:[A-Za-z0-9_-]{20,100}/;
const FILE_ID_RE = /^[A-Za-z0-9_=-]{8,300}$/;
const FILE_PATH_RE = /^[A-Za-z0-9_./-]{1,300}$/;
const CHAT_ID_RE = /^-?\d{5,20}$|^@[A-Za-z][A-Za-z0-9_]{3,63}$/;

// Working chat cache per bot token to avoid failing on unreachable channels repeatedly
const WORKING_CHAT_CACHE = new Map<string, { chatId: string; expiresAt: number }>();
const WORKING_CHAT_TTL_MS = 15 * 60 * 1000;

// Telegram Bot API allows sendDocument up to 50MB, but getFile strictly fails above 20MB.
export const TELEGRAM_MAX_PLAYABLE_BYTES = Math.floor(19.5 * 1024 * 1024);
export const TELEGRAM_SERVERLESS_DIRECT_BYTES = Math.floor(3.5 * 1024 * 1024);

export function getTelegramMaxDirectUploadBytes(): number {
  return IS_SERVERLESS ? TELEGRAM_SERVERLESS_DIRECT_BYTES : TELEGRAM_MAX_PLAYABLE_BYTES;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BOT_HEALTH_CACHE = new Map<
  string,
  {
    bot: { id: number; username?: string; first_name?: string };
    expiresAt: number;
  }
>();
const BOT_HEALTH_TTL_MS = 5 * 60 * 1000;

// Serialize & pace Telegram write requests to prevent burst 429 FloodWait errors
let telegramSendQueue: Promise<void> = Promise.resolve();
let lastTelegramSendAtMs = 0;
let telegramFloodWaitUntilMs = 0;
const TELEGRAM_MIN_SEND_INTERVAL_MS = 450;

export function getTelegramFloodWaitRemainingSec(): number {
  const remaining = telegramFloodWaitUntilMs - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function noteTelegramFloodWait(retryAfterSec?: number): void {
  const sec = Number(retryAfterSec || 0);
  if (sec > 0) {
    telegramFloodWaitUntilMs = Math.max(telegramFloodWaitUntilMs, Date.now() + sec * 1000);
  }
}

function enqueueTelegramSend<T>(fn: () => Promise<T>): Promise<T> {
  const run = telegramSendQueue.then(async () => {
    const waitGap = TELEGRAM_MIN_SEND_INTERVAL_MS - (Date.now() - lastTelegramSendAtMs);
    if (waitGap > 0) {
      await sleep(waitGap);
    }
    lastTelegramSendAtMs = Date.now();
    return fn();
  });
  telegramSendQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

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
    const extracted = cleaned.match(BOT_TOKEN_EXTRACT_RE)?.[0];
    if (extracted && BOT_TOKEN_RE.test(extracted)) {
      return extracted;
    }
    const compact = cleaned.replace(/\s+/g, "").replace(/^bot(?=\d+:)/i, "");
    if (compact && BOT_TOKEN_RE.test(compact)) {
      return compact;
    }
  }
  return "";
}

export function getTelegramTokenDiagnostics(): {
  envPresent: boolean;
  reason: "ok" | "missing_in_runtime_env" | "invalid_token_format";
  hint?: string;
} {
  if (resolveTelegramBotToken()) {
    return { envPresent: true, reason: "ok" };
  }
  const rawValues = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_TOKEN,
    process.env.BOT_TOKEN,
    process.env.VITE_TELEGRAM_BOT_TOKEN,
  ]
    .map((v) => cleanEnvValue(v))
    .filter(Boolean);

  if (rawValues.length === 0) {
    return { envPresent: false, reason: "missing_in_runtime_env" };
  }
  const first = rawValues[0];
  let hint = "expected_botfather_token";
  if (first.startsWith("@") || /bot$/i.test(first)) {
    hint = "looks_like_username_or_bot_name";
  } else if (/^-?\d+$/.test(first)) {
    hint = "looks_like_chat_id_not_token";
  }
  return {
    envPresent: true,
    reason: "invalid_token_format",
    hint,
  };
}

export function normalizeTelegramChatId(chatId?: string | null): string {
  const cleaned = cleanEnvValue(chatId);
  if (!cleaned) return "";
  // Extract channel ID from links like https://t.me/boost?c=3994854940 or https://t.me/c/3994854940/1
  const urlMatch = cleaned.match(/t\.me\/(?:boost\?(?:[^#]*&)?c=|c\/)(\d{6,16})/i);
  if (urlMatch?.[1]) {
    return `-100${urlMatch[1]}`;
  }
  // Telegram channels & supergroups always start with -100; recover common typo "1003945418652" -> "-1003945418652"
  if (/^100\d{9,15}$/.test(cleaned)) {
    return `-${cleaned}`;
  }
  return cleaned;
}

export function isValidTelegramChatId(chatId?: string | null): boolean {
  const clean = normalizeTelegramChatId(chatId);
  return Boolean(clean && CHAT_ID_RE.test(clean));
}

function splitAndNormalizeChatIds(rawValues: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawValues) {
    const pieces = String(raw || "")
      .split(/[\s,;]+/)
      .map((p) => normalizeTelegramChatId(p))
      .filter((id) => Boolean(id) && CHAT_ID_RE.test(id));
    for (const id of pieces) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  const priority = (id: string) => (id.startsWith("-100") ? 0 : id.startsWith("-") ? 1 : 2);
  return out.sort((a, b) => priority(a) - priority(b));
}

export function getConfiguredTelegramStorageChatIds(): string[] {
  return splitAndNormalizeChatIds([
    process.env.TELEGRAM_STORAGE_CHAT_ID,
    process.env.TELEGRAM_CHAT_CHANNEL_ID,
    process.env.VITE_TELEGRAM_CHAT_CHANNEL_ID,
    process.env.VITE_TELEGRAM_STORAGE_CHAT_ID,
  ]);
}

export function getConfiguredTelegramStorageChatId(): string {
  return getConfiguredTelegramStorageChatIds()[0] || "";
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
    const allowed = encodeURIComponent(JSON.stringify(["channel_post", "my_chat_member", "message"]));
    const { ok, json } = await telegramBotApiRequest<any>({
      token,
      methodPath: `getUpdates?limit=30&allowed_updates=${allowed}`,
      httpMethod: "GET",
      timeoutMs: 5000,
    });
    if (!ok || !json?.ok || !Array.isArray(json.result)) return [];

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

export async function resolveTelegramStorageChatCandidates(
  token: string,
  requestedChatIds?: Array<string | null | undefined>,
  includeDiscovered = false
): Promise<string[]> {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const addId = (raw?: string | null) => {
    const id = normalizeTelegramChatId(raw);
    if (id && CHAT_ID_RE.test(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  };

  const cacheKey = token ? token.slice(0, 12) : "";
  const workingCached = cacheKey ? WORKING_CHAT_CACHE.get(cacheKey) : null;
  if (workingCached && workingCached.expiresAt > Date.now()) {
    addId(workingCached.chatId);
  }

  for (const id of getConfiguredTelegramStorageChatIds()) {
    addId(id);
  }

  const clientSorted = splitAndNormalizeChatIds(requestedChatIds || []);
  for (const id of clientSorted) {
    addId(id);
  }

  if (includeDiscovered || ordered.length === 0) {
    const discovered = await discoverTelegramStorageChats(token);
    for (const c of discovered) {
      addId(c.id);
    }
  }

  return ordered;
}

export async function resolveTelegramStorageChatId(
  token: string,
  requestedChatId?: string | null
): Promise<string> {
  const candidates = await resolveTelegramStorageChatCandidates(token, [requestedChatId], false);
  return candidates[0] || "";
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

  const activeFloodSec = getTelegramFloodWaitRemainingSec();
  if (activeFloodSec > 6) {
    return {
      error: `Too Many Requests: retry after ${activeFloodSec}`,
      status: 429,
    };
  }

  const callGetFile = async () => {
    const { status, ok, json } = await telegramBotApiRequest<any>({
      token,
      methodPath: `getFile?file_id=${encodeURIComponent(cleanId)}`,
      httpMethod: "GET",
      timeoutMs: 8000,
    });
    return { status, ok, tgJson: json };
  };

  try {
    let { status, ok, tgJson } = await callGetFile();

    // Auto-retry once on brief Telegram 429 rate-limit windows
    if (status === 429) {
      const retrySec = Number(tgJson?.parameters?.retry_after || 1);
      noteTelegramFloodWait(retrySec);
      if (retrySec > 0 && retrySec <= 4) {
        await sleep(retrySec * 1000 + 150);
        ({ status, ok, tgJson } = await callGetFile());
        if (status === 429) {
          noteTelegramFloodWait(Number(tgJson?.parameters?.retry_after || 0));
        }
      }
    }

    if (!ok || !tgJson?.ok || !tgJson?.result?.file_path) {
      const desc = String(tgJson?.description || "Telegram file not found");
      if (/file is too big/i.test(desc)) {
        return {
          error: "File 20MB se badi hai — Telegram Bot API 20MB se badi file stream nahi karta.",
          status: 413,
        };
      }
      return {
        error: desc,
        status: status === 429 ? 429 : status === 400 ? 404 : status || 404,
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

export async function getTelegramBotHealth(token: string): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  const configuredChatIds = getConfiguredTelegramStorageChatIds();
  const configuredChatId = configuredChatIds[0] || "";
  const maxDirectUploadBytes = getTelegramMaxDirectUploadBytes();
  const cacheKey = token.slice(0, 12);
  const cached = BOT_HEALTH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const discoveredChats = configuredChatIds.length === 0 ? await discoverTelegramStorageChats(token) : [];
    return {
      status: 200,
      body: {
        ok: true,
        configured: true,
        cached: true,
        bot: cached.bot,
        hasStorageChatId: Boolean(configuredChatId || discoveredChats.length > 0),
        storageChatConfigured: Boolean(configuredChatId),
        storageChatCount: configuredChatIds.length,
        maxDirectUploadBytes,
        discoveredChats: discoveredChats.slice(0, 5),
      },
    };
  }

  const floodSec = getTelegramFloodWaitRemainingSec();
  if (floodSec > 0) {
    return {
      status: 429,
      body: {
        ok: false,
        configured: true,
        hasStorageChatId: Boolean(configuredChatId),
        storageChatConfigured: Boolean(configuredChatId),
        discoveredChats: [],
        retryAfter: floodSec,
        error: `Too Many Requests: retry after ${floodSec}`,
      },
    };
  }

  try {
    const { status: tgStatus, ok: tgOk, json: rawJson } = await telegramBotApiRequest<any>({
      token,
      methodPath: "getMe",
      httpMethod: "GET",
      timeoutMs: 8000,
    });
    const data = rawJson || { ok: false };
    if (tgStatus === 429) {
      noteTelegramFloodWait(Number(data?.parameters?.retry_after || 10));
    }
    if (tgOk && data?.ok && data?.result) {
      const bot = {
        id: data.result.id,
        username: data.result.username,
        first_name: data.result.first_name,
      };
      BOT_HEALTH_CACHE.set(cacheKey, {
        bot,
        expiresAt: Date.now() + BOT_HEALTH_TTL_MS,
      });
    }
    const discoveredChats =
      !configuredChatId && data?.ok ? await discoverTelegramStorageChats(token) : [];
    const status = tgOk ? 200 : tgStatus === 429 ? 429 : 502;
    return {
      status,
      body: {
        ok: Boolean(data?.ok),
        configured: true,
        bot: data?.result
          ? { id: data.result.id, username: data.result.username, first_name: data.result.first_name }
          : undefined,
        hasStorageChatId: Boolean(configuredChatId || discoveredChats.length > 0),
        storageChatConfigured: Boolean(configuredChatId),
        storageChatCount: configuredChatIds.length,
        maxDirectUploadBytes,
        discoveredChats: discoveredChats.slice(0, 5),
        ...(data?.parameters?.retry_after ? { retryAfter: Number(data.parameters.retry_after) } : {}),
        error: data?.description,
      },
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError" || /abort/i.test(String(err?.message || ""));
    return {
      status: isAbort ? 504 : 502,
      body: {
        ok: false,
        configured: true,
        storageChatConfigured: Boolean(configuredChatId),
        error: isAbort ? "Telegram getMe timeout" : err?.message || "Telegram health check failed",
      },
    };
  }
}

export async function readUploadPayloadFromRequest(req: any): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  caption?: string;
  chatId?: string;
  fallbackChatIds?: string[];
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
  const headerChatFallbacks = req.headers?.["x-chat-fallbacks"]
    ? String(req.headers["x-chat-fallbacks"])
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
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
      fallbackChatIds: headerChatFallbacks,
    };
  }

  if (Buffer.isBuffer(req.rawBody) && headerMime !== "application/json") {
    return {
      buffer: req.rawBody,
      fileName: headerFileName || `upload_${Date.now()}.bin`,
      mimeType: headerMime || "application/octet-stream",
      caption: headerCaption,
      chatId: headerChatId,
      fallbackChatIds: headerChatFallbacks,
    };
  }

  if (req.body && typeof req.body === "object" && (req.body.dataUrl || req.body.base64)) {
    const rawData = String(req.body.dataUrl || req.body.base64);
    const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = match?.[1] || String(req.body.mimeType || headerMime || "application/octet-stream");
    const b64 = match?.[2] || rawData;
    const buffer = Buffer.from(b64, "base64");
    const bodyFallbacks = Array.isArray(req.body.fallbackChatIds)
      ? req.body.fallbackChatIds.map((s: any) => String(s || "").trim()).filter(Boolean)
      : headerChatFallbacks;
    return {
      buffer,
      fileName: String(req.body.fileName || headerFileName || `upload_${Date.now()}.bin`),
      mimeType,
      caption: req.body.caption ? String(req.body.caption) : headerCaption,
      chatId: req.body.chatId ? String(req.body.chatId).trim() : headerChatId,
      fallbackChatIds: bodyFallbacks,
    };
  }

  if (typeof req.body === "string" && req.body.length > 0 && headerMime !== "application/json") {
    return {
      buffer: Buffer.from(req.body, "latin1"),
      fileName: headerFileName || `upload_${Date.now()}.bin`,
      mimeType: headerMime || "application/octet-stream",
      caption: headerCaption,
      chatId: headerChatId,
      fallbackChatIds: headerChatFallbacks,
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
        fallbackChatIds: Array.isArray(parsed?.fallbackChatIds)
          ? parsed.fallbackChatIds.map((s: any) => String(s || "").trim()).filter(Boolean)
          : headerChatFallbacks,
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
    fallbackChatIds: headerChatFallbacks,
  };
}

export async function uploadBufferToTelegram(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  caption?: string;
  chatId?: string;
  fallbackChatIds?: string[];
  allowVaultFallback?: boolean;
}): Promise<
  | {
      ok: true;
      url: string;
      fileId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      storage: "telegram" | "vault";
      chatId?: string;
      telegramFallbackReason?: string;
    }
  | { ok: false; status: number; error: string; retryAfter?: number }
> {
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

  const safeName = String(opts.fileName || `upload_${Date.now()}.bin`).replace(/[\r\n/\\]+/g, "_");
  const detectedMime = detectMimeType({
    fileName: safeName,
    headerContentType: opts.mimeType,
    sampleBytes: opts.buffer,
  });

  const allowVault = opts.allowVaultFallback !== false;
  const tryVaultFallback = async (reason: string): Promise<{
    ok: true;
    url: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storage: "vault";
    telegramFallbackReason: string;
  } | null> => {
    if (!allowVault) return null;
    try {
      const saved = await saveMediaVaultToSupabase({
        buffer: opts.buffer,
        fileName: safeName,
        mimeType: detectedMime,
      });
      if (saved.ok) {
        const permanentUrl = `/api/telegram/file?mediaId=${encodeURIComponent(saved.mediaId)}&name=${encodeURIComponent(safeName)}`;
        return {
          ok: true,
          url: permanentUrl,
          fileId: saved.mediaId,
          fileName: safeName,
          fileSize: opts.buffer.length,
          mimeType: detectedMime,
          storage: "vault",
          telegramFallbackReason: reason,
        };
      }
    } catch {}
    return null;
  };

  const token = resolveTelegramBotToken();
  if (!token) {
    const vaultRes = await tryVaultFallback("missing_telegram_bot_token");
    if (vaultRes) return vaultRes;
    return {
      ok: false,
      status: 503,
      error: "Server par TELEGRAM_BOT_TOKEN configure nahi hai. Settings -> Secrets me TELEGRAM_BOT_TOKEN set karein.",
    };
  }

  const requestedList = [opts.chatId, ...(opts.fallbackChatIds || [])];
  let chatCandidates = await resolveTelegramStorageChatCandidates(token, requestedList, false);
  if (chatCandidates.length === 0) {
    chatCandidates = await resolveTelegramStorageChatCandidates(token, requestedList, true);
  }
  if (chatCandidates.length === 0) {
    const vaultRes = await tryVaultFallback("no_storage_chat_id");
    if (vaultRes) return vaultRes;
    return {
      ok: false,
      status: 400,
      error:
        "TELEGRAM_STORAGE_CHAT_ID set nahi hai. Apne Telegram channel me bot ko Admin banakar ek test message bhejein ya Vercel Env Vars check karein.",
    };
  }

  // Wait briefly if Telegram is in an active short FloodWait (<=12s), only skip to Vault if FloodWait > 12s
  const activeFloodRemainingMs = telegramFloodWaitUntilMs - Date.now();
  if (activeFloodRemainingMs > 12000) {
    const retrySec = Math.ceil(activeFloodRemainingMs / 1000);
    const vaultRes = await tryVaultFallback(`flood_wait_${retrySec}s`);
    if (vaultRes) return vaultRes;
    return {
      ok: false,
      status: 429,
      retryAfter: retrySec,
      error: `Telegram par bahut zyada requests aa rahi hain (429). Kripya ${retrySec} second baad dobara try karein.`,
    };
  }

  let lastStatus = 502;
  let lastDesc = "Telegram upload fail ho gaya.";
  let lastRetryAfter: number | undefined;
  let discoveredAppended = false;

  const attemptSendToChat = async (targetChatId: string) => {
    const fields: Array<{ name: string; value: string }> = [{ name: "chat_id", value: targetChatId }];
    if (opts.caption) {
      fields.push({ name: "caption", value: String(opts.caption).slice(0, 1000) });
    }
    const multipart = buildMultipartFormPayload(fields, {
      name: "document",
      fileName: safeName,
      mimeType: detectedMime,
      buffer: opts.buffer,
    });

    const sendOnce = () =>
      enqueueTelegramSend(async () => {
        const remaining = telegramFloodWaitUntilMs - Date.now();
        if (remaining > 0 && remaining <= 12500) {
          await sleep(remaining + 200);
        }
        return telegramBotApiRequest<any>({
          token,
          methodPath: "sendDocument",
          httpMethod: "POST",
          body: multipart.body,
          headers: { "Content-Type": multipart.contentType },
          timeoutMs: 25000,
        });
      });

    let { status, ok, json } = await sendOnce();
    if (status === 429) {
      const retrySec = Number(json?.parameters?.retry_after || 0);
      if (retrySec > 0) {
        noteTelegramFloodWait(retrySec);
      }
      if (retrySec > 0 && retrySec <= 10) {
        await sleep(retrySec * 1000 + 250);
        ({ status, ok, json } = await sendOnce());
        if (status === 429) {
          noteTelegramFloodWait(Number(json?.parameters?.retry_after || 0));
        }
      }
    }
    return { status, ok, json };
  };

  try {
    for (let idx = 0; idx < chatCandidates.length; idx++) {
      const candidateChatId = chatCandidates[idx];
      const { status, ok, json } = await attemptSendToChat(candidateChatId);

      if (ok && json?.ok) {
        const doc =
          json.result?.document ||
          (Array.isArray(json.result?.photo) ? json.result.photo.slice(-1)[0] : null) ||
          json.result?.audio ||
          json.result?.video ||
          json.result?.voice ||
          json.result?.animation;

        const fileId = String(doc?.file_id || "").trim();
        if (fileId) {
          WORKING_CHAT_CACHE.set(token.slice(0, 12), {
            chatId: candidateChatId,
            expiresAt: Date.now() + WORKING_CHAT_TTL_MS,
          });
          const finalFileName = String(doc?.file_name || safeName);
          const permanentUrl = `/api/telegram/file?fileId=${encodeURIComponent(fileId)}&name=${encodeURIComponent(finalFileName)}`;
          return {
            ok: true,
            url: permanentUrl,
            fileId,
            fileName: finalFileName,
            fileSize: Number(doc?.file_size || opts.buffer.length),
            mimeType: String(doc?.mime_type || detectedMime),
            storage: "telegram",
            chatId: candidateChatId,
          };
        }
        lastStatus = 502;
        lastDesc = "Telegram se file_id prapt nahi hua.";
        continue;
      }

      lastStatus = status;
      lastDesc = String(json?.description || `Telegram error (${status})`);
      if (status === 429 && json?.parameters?.retry_after) {
        lastRetryAfter = Number(json.parameters.retry_after);
      }

      const isUnauthorizedToken = status === 401 || /unauthorized/i.test(lastDesc);
      const isChatPermissionOrNotFound =
        !isUnauthorizedToken &&
        status !== 429 &&
        (status === 400 ||
          status === 403 ||
          /chat not found|bot was kicked|bot is not a member|need administrator rights|have no rights|forbidden/i.test(
            lastDesc
          ));

      if (isUnauthorizedToken || status === 429) {
        break;
      }

      // If all explicit candidates fail due to chat/permission error, append auto-discovered chats once
      if (isChatPermissionOrNotFound && idx === chatCandidates.length - 1 && !discoveredAppended) {
        discoveredAppended = true;
        const discovered = await discoverTelegramStorageChats(token, true);
        for (const d of discovered) {
          if (!chatCandidates.includes(d.id)) {
            chatCandidates.push(d.id);
          }
        }
      }
    }

    const vaultRes = await tryVaultFallback(`${lastStatus}:${lastDesc}`);
    if (vaultRes) return vaultRes;

    let friendly = lastDesc;
    if (/chat not found|bot is not a member|need administrator rights|have no rights/i.test(lastDesc)) {
      friendly = `Telegram channel permission error (${lastDesc}). Ensure karein ki Bot channel me Admin hai aur TELEGRAM_STORAGE_CHAT_ID sahi (-100...) hai.`;
    } else if (/unauthorized/i.test(lastDesc)) {
      friendly = "Telegram Bot Token invalid ya revoke ho gaya hai. Kripya server TELEGRAM_BOT_TOKEN check karein.";
    } else if (lastStatus === 429) {
      friendly = `Telegram par bahut zyada requests aa rahi hain (429).${lastRetryAfter ? ` Kripya ${lastRetryAfter} second baad` : " Kuch second baad"} dobara try karein.`;
    }
    return {
      ok: false,
      status: lastStatus === 429 ? 429 : lastStatus >= 400 ? lastStatus : 502,
      ...(lastRetryAfter ? { retryAfter: lastRetryAfter } : {}),
      error: friendly,
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError" || /abort/i.test(String(err?.message || ""));
    const vaultRes = await tryVaultFallback(isAbort ? "telegram_timeout" : err?.message || "network_error");
    if (vaultRes) return vaultRes;

    return {
      ok: false,
      status: isAbort ? 504 : 502,
      error: isAbort
        ? "Telegram server se response lene me timeout ho gaya. Kripya dobara try karein."
        : err?.message || "Telegram upload fail ho gaya.",
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
