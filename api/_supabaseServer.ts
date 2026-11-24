const DEFAULT_SUPABASE_URL = "https://mcdwtjpiekqpusnfjnco.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n5m3wcMptKipbj1uOI4jSg_YmhdwnXB";

function getServerSupabaseConfig(): { url: string; apiKey: string; isServiceRole: boolean } {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  )
    .trim()
    .replace(/\/+$/, "");

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();

  return {
    url,
    apiKey: serviceRoleKey || anonKey,
    isServiceRole: Boolean(serviceRoleKey),
  };
}

function normalizeServerDocPath(rawPath: string, explicitSchoolId?: string) {
  const parts = String(rawPath || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  const path = parts.join("/");
  const docId = parts.length > 0 ? parts[parts.length - 1] : "";
  const collectionPath = parts.length > 1 ? parts.slice(0, -1).join("/") : "_root";
  let schoolId = explicitSchoolId ? String(explicitSchoolId).trim() : "";
  if (!schoolId && parts[0] === "schools" && parts.length >= 2) {
    schoolId = parts[1];
  }
  return { path, collectionPath, docId, schoolId };
}

async function sbRestFetch(
  endpointPath: string,
  init: RequestInit = {},
  timeoutMs = 4500
): Promise<Response | null> {
  const { url, apiKey } = getServerSupabaseConfig();
  if (!url || !apiKey) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url}/rest/v1/${endpointPath}`, {
      ...init,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

export async function supabaseServerKeepalive(): Promise<{ ok: boolean; status: number; usingServiceRole: boolean }> {
  const { isServiceRole } = getServerSupabaseConfig();
  const res = await sbRestFetch("kv_documents?select=path&limit=1", { method: "GET" });
  return { ok: Boolean(res?.ok), status: res?.status || 500, usingServiceRole: isServiceRole };
}

// ── FCM TOKENS ───────────────────────────────────────────────────────────────

export async function fetchFcmTokensFromSupabase(): Promise<Record<string, any> | null> {
  const res = await sbRestFetch(
    "fcm_tokens?select=token_key,user_id,student_id,school_id,class_id,class_name,role,platform,token,device_id,updated_at&limit=5000",
    { method: "GET" }
  );
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  if (!Array.isArray(rows)) return null;

  const map: Record<string, any> = {};
  for (const r of rows) {
    if (!r?.token_key || !r?.token) continue;
    map[String(r.token_key)] = {
      token: String(r.token),
      userId: r.user_id || "",
      studentId: r.student_id || "",
      schoolId: r.school_id || "",
      classId: r.class_id || "",
      className: r.class_name || "",
      role: r.role || "",
      platform: r.platform || "pwa",
      deviceId: r.device_id || "",
      updatedAt: r.updated_at || "",
    };
  }
  return map;
}

export async function upsertFcmTokenInSupabase(record: {
  tokenKey: string;
  userId?: string;
  studentId?: string;
  schoolId?: string;
  classId?: string;
  className?: string;
  role?: string;
  platform?: string;
  token: string;
  deviceId?: string;
}): Promise<boolean> {
  if (!record.tokenKey || !record.token) return false;
  const res = await sbRestFetch("fcm_tokens?on_conflict=token_key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      token_key: String(record.tokenKey),
      user_id: String(record.userId || ""),
      student_id: String(record.studentId || ""),
      school_id: String(record.schoolId || ""),
      class_id: String(record.classId || ""),
      class_name: String(record.className || ""),
      role: String(record.role || ""),
      platform: String(record.platform || "pwa"),
      token: String(record.token),
      device_id: String(record.deviceId || ""),
      updated_at: new Date().toISOString(),
    }),
  });
  return Boolean(res?.ok);
}

export async function deleteFcmTokenFromSupabase(tokenKey: string): Promise<void> {
  if (!tokenKey) return;
  await sbRestFetch(`fcm_tokens?token_key=eq.${encodeURIComponent(tokenKey)}`, { method: "DELETE" });
}

// ── SCHOOLS TABLE ────────────────────────────────────────────────────────────

export async function fetchAllSchoolsFromSupabase(): Promise<any[] | null> {
  const res = await sbRestFetch("schools?select=id,code,name,data&limit=1000", { method: "GET" });
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => ({ ...(r?.data || {}), id: r?.data?.id || r?.id }));
}

export async function upsertSchoolInSupabase(schoolId: string, data: Record<string, any>): Promise<boolean> {
  if (!schoolId) return false;
  const cleanId = String(schoolId).trim();
  const res = await sbRestFetch("schools?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: cleanId,
      code: String(data?.code || "").trim(),
      name: String(data?.name || "").trim(),
      data: { ...data, id: cleanId },
      updated_at: new Date().toISOString(),
    }),
  });
  return Boolean(res?.ok);
}

// ── WEBPUSH SUBSCRIPTIONS & DUES ─────────────────────────────────────────────

export async function fetchWebpushSubsFromSupabase(): Promise<Record<string, any> | null> {
  const res = await sbRestFetch("webpush_subs?select=id,data&limit=5000", { method: "GET" });
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  if (!Array.isArray(rows)) return null;
  const map: Record<string, any> = {};
  for (const r of rows) {
    if (r?.id && r?.data) {
      map[String(r.id)] = { ...r.data, id: String(r.id) };
    }
  }
  return map;
}

export async function getWebpushSubFromSupabase(subId: string): Promise<any | null> {
  if (!subId) return null;
  const res = await sbRestFetch(`webpush_subs?id=eq.${encodeURIComponent(subId)}&select=data&limit=1`, {
    method: "GET",
  });
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  return Array.isArray(rows) && rows[0]?.data ? rows[0].data : null;
}

export async function upsertWebpushSubInSupabase(record: any): Promise<boolean> {
  if (!record?.id) return false;
  const res = await sbRestFetch("webpush_subs?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: String(record.id),
      user_id: String(record.userId || ""),
      school_id: String(record.schoolId || ""),
      data: record,
      updated_at: new Date().toISOString(),
    }),
  });
  return Boolean(res?.ok);
}

export async function deleteWebpushSubFromSupabase(subId: string): Promise<void> {
  if (!subId) return;
  await sbRestFetch(`webpush_subs?id=eq.${encodeURIComponent(subId)}`, { method: "DELETE" });
}

export async function fetchWebpushDuesFromSupabase(): Promise<Record<string, any> | null> {
  const res = await sbRestFetch("webpush_dues?select=due_key,data&limit=10000", { method: "GET" });
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  if (!Array.isArray(rows)) return null;
  const map: Record<string, any> = {};
  for (const r of rows) {
    if (r?.due_key && r?.data) {
      map[String(r.due_key)] = r.data;
    }
  }
  return map;
}

export async function upsertWebpushDueInSupabase(dueKey: string, payload: any): Promise<boolean> {
  if (!dueKey || !payload) return false;
  const res = await sbRestFetch("webpush_dues?on_conflict=due_key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      due_key: String(dueKey),
      student_id: String(payload.studentId || ""),
      school_id: String(payload.schoolId || ""),
      data: payload,
      updated_at: new Date().toISOString(),
    }),
  });
  return Boolean(res?.ok);
}

// ── KV_DOCUMENTS SERVER ADAPTER ──────────────────────────────────────────────

export async function getKvDocFromSupabase<T = any>(
  docPath: string,
  timeoutMs = 4500
): Promise<T | null> {
  const { path } = normalizeServerDocPath(docPath);
  if (!path) return null;
  const res = await sbRestFetch(
    `kv_documents?path=eq.${encodeURIComponent(path)}&select=data&limit=1`,
    { method: "GET" },
    timeoutMs
  );
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  return Array.isArray(rows) && rows[0]?.data !== undefined ? (rows[0].data as T) : null;
}

export async function upsertKvDocInSupabase(
  docPath: string,
  payload: Record<string, any>,
  explicitSchoolId?: string,
  timeoutMs = 4500
): Promise<boolean> {
  const meta = normalizeServerDocPath(docPath, explicitSchoolId);
  if (!meta.path || !meta.docId) return false;
  const res = await sbRestFetch(
    "kv_documents?on_conflict=path",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        path: meta.path,
        collection_path: meta.collectionPath,
        doc_id: meta.docId,
        school_id: String(payload?.schoolId || meta.schoolId || ""),
        data: payload || {},
        updated_at: new Date().toISOString(),
      }),
    },
    timeoutMs
  );
  return Boolean(res?.ok);
}

export async function patchKvDocInSupabase(
  docPath: string,
  patch: Record<string, any>,
  explicitSchoolId?: string
): Promise<boolean> {
  const existing = (await getKvDocFromSupabase<Record<string, any>>(docPath)) || {};
  return upsertKvDocInSupabase(docPath, { ...existing, ...patch }, explicitSchoolId);
}

export async function deleteKvCollectionFromSupabase(
  collectionPath: string,
  timeoutMs = 8000
): Promise<boolean> {
  const cleanCol = String(collectionPath || "").trim();
  if (!cleanCol) return false;
  const res = await sbRestFetch(
    `kv_documents?collection_path=eq.${encodeURIComponent(cleanCol)}`,
    { method: "DELETE" },
    timeoutMs
  );
  return Boolean(res?.ok);
}

const TG_STAGE_ID_RE = /^tgs_[A-Za-z0-9_-]{6,64}$/;

export function isValidTelegramStageId(uploadId?: string | null): boolean {
  return Boolean(uploadId && TG_STAGE_ID_RE.test(String(uploadId).trim()));
}

export async function saveTelegramStagingChunk(opts: {
  uploadId: string;
  chunkIndex: number;
  buffer: Buffer;
}): Promise<boolean> {
  if (!isValidTelegramStageId(opts.uploadId)) return false;
  if (!Number.isInteger(opts.chunkIndex) || opts.chunkIndex < 0 || opts.chunkIndex >= 40) return false;
  if (!opts.buffer || opts.buffer.length === 0) return false;
  return upsertKvDocInSupabase(
    `tg_stage/${opts.uploadId}/chunk_${opts.chunkIndex}`,
    {
      index: opts.chunkIndex,
      size: opts.buffer.length,
      data: opts.buffer.toString("base64"),
      createdAt: new Date().toISOString(),
    },
    "_tg_stage",
    15000
  );
}

export async function readTelegramStagingChunks(opts: {
  uploadId: string;
  chunkCount: number;
  maxBytes: number;
}): Promise<{ ok: true; buffer: Buffer } | { ok: false; status: number; error: string }> {
  if (!isValidTelegramStageId(opts.uploadId)) {
    return { ok: false, status: 400, error: "Invalid staging uploadId" };
  }
  const count = Number(opts.chunkCount);
  if (!Number.isInteger(count) || count < 1 || count > 40) {
    return { ok: false, status: 400, error: "Invalid chunkCount" };
  }

  const buffers: Buffer[] = new Array(count);
  let totalBytes = 0;

  for (let i = 0; i < count; i += 4) {
    const batch = Array.from({ length: Math.min(4, count - i) }, (_, offset) => i + offset);
    const docs = await Promise.all(
      batch.map((idx) =>
        getKvDocFromSupabase<{ data?: string }>(`tg_stage/${opts.uploadId}/chunk_${idx}`, 12000)
      )
    );
    for (let j = 0; j < batch.length; j++) {
      const idx = batch[j];
      const doc = docs[j];
      if (!doc?.data) {
        return { ok: false, status: 404, error: `Missing staging chunk ${idx}` };
      }
      const buf = Buffer.from(doc.data, "base64");
      totalBytes += buf.length;
      if (totalBytes > opts.maxBytes) {
        return { ok: false, status: 413, error: "File 19.5MB limit se badi hai." };
      }
      buffers[idx] = buf;
    }
  }

  return { ok: true, buffer: Buffer.concat(buffers) };
}

export async function purgeTelegramStaging(uploadId: string): Promise<void> {
  if (!isValidTelegramStageId(uploadId)) return;
  try {
    await deleteKvCollectionFromSupabase(`tg_stage/${uploadId}`, 8000);
  } catch {}
}

// ── MEDIA VAULT FALLBACK STORE (Handles Telegram 429 FloodWait & >4.5MB uploads) ──

const MEDIA_VAULT_CHUNK_BYTES = 512 * 1024; // 512 KB raw binary per chunk
const MEDIA_VAULT_MAX_SINGLE_SLICE_BYTES = 3 * 1024 * 1024; // 3 MB per response slice (safe under Vercel 4.5MB limit)
const MEDIA_VAULT_ID_RE = /^mv_[A-Za-z0-9_-]{6,80}$/;

export function isValidMediaVaultId(mediaId?: string | null): boolean {
  return Boolean(mediaId && MEDIA_VAULT_ID_RE.test(String(mediaId).trim()));
}

export interface MediaVaultMeta {
  mediaId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  chunkCount: number;
  chunkSize: number;
  encoding: "base64";
  data?: string;
  createdAt: string;
}

export async function saveMediaVaultToSupabase(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const mediaId = `mv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const totalSize = opts.buffer.length;
  const createdAt = new Date().toISOString();

  if (totalSize <= MEDIA_VAULT_CHUNK_BYTES) {
    const ok = await upsertKvDocInSupabase(
      `media_vault/${mediaId}`,
      {
        mediaId,
        fileName: opts.fileName,
        mimeType: opts.mimeType,
        fileSize: totalSize,
        chunkCount: 1,
        chunkSize: totalSize,
        encoding: "base64",
        data: opts.buffer.toString("base64"),
        createdAt,
      },
      "_media",
      15000
    );
    return ok ? { ok: true, mediaId } : { ok: false, error: "Media vault write failed" };
  }

  const chunkCount = Math.ceil(totalSize / MEDIA_VAULT_CHUNK_BYTES);
  const chunkIndices = Array.from({ length: chunkCount }, (_, i) => i);

  // Upload chunks in small batches of 3 to avoid saturating connections
  for (let i = 0; i < chunkIndices.length; i += 3) {
    const batch = chunkIndices.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (idx) => {
        const start = idx * MEDIA_VAULT_CHUNK_BYTES;
        const end = Math.min(totalSize, start + MEDIA_VAULT_CHUNK_BYTES);
        const sliceB64 = opts.buffer.subarray(start, end).toString("base64");
        return upsertKvDocInSupabase(
          `media_vault/${mediaId}/chunk_${idx}`,
          { index: idx, data: sliceB64 },
          "_media",
          15000
        );
      })
    );
    if (results.some((ok) => !ok)) {
      return { ok: false, error: "Media vault chunk upload failed" };
    }
  }

  const metaOk = await upsertKvDocInSupabase(
    `media_vault/${mediaId}`,
    {
      mediaId,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      fileSize: totalSize,
      chunkCount,
      chunkSize: MEDIA_VAULT_CHUNK_BYTES,
      encoding: "base64",
      createdAt,
    },
    "_media",
    15000
  );

  return metaOk ? { ok: true, mediaId } : { ok: false, error: "Media vault metadata write failed" };
}

export async function readMediaVaultSlice(opts: {
  mediaId: string;
  rangeHeader?: string | null;
}): Promise<
  | {
      ok: true;
      buffer: Buffer;
      fileName: string;
      mimeType: string;
      totalSize: number;
      start: number;
      end: number;
      isPartial: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const cleanId = String(opts.mediaId || "").trim();
  if (!isValidMediaVaultId(cleanId)) {
    return { ok: false, status: 400, error: "Invalid mediaId" };
  }

  const meta = await getKvDocFromSupabase<MediaVaultMeta>(`media_vault/${cleanId}`, 12000);
  if (!meta || !Number.isFinite(Number(meta.fileSize))) {
    return { ok: false, status: 404, error: "Media not found in vault" };
  }

  const totalSize = Number(meta.fileSize);
  const fileName = String(meta.fileName || `${cleanId}.bin`);
  const mimeType = String(meta.mimeType || "application/octet-stream");
  const chunkSize = Number(meta.chunkSize || MEDIA_VAULT_CHUNK_BYTES);
  const chunkCount = Math.max(1, Number(meta.chunkCount || 1));

  if (totalSize <= 0) {
    return {
      ok: true,
      buffer: Buffer.alloc(0),
      fileName,
      mimeType,
      totalSize: 0,
      start: 0,
      end: 0,
      isPartial: false,
    };
  }

  let start = 0;
  let end = totalSize - 1;
  let isPartial = false;

  const rawRange = String(opts.rangeHeader || "").trim();
  if (rawRange.startsWith("bytes=")) {
    const spec = rawRange.slice(6).split(",")[0].trim();
    const [rawStart, rawEnd] = spec.split("-");
    if (rawStart === "" && rawEnd) {
      const suffixLen = Number(rawEnd);
      if (Number.isFinite(suffixLen) && suffixLen > 0) {
        start = Math.max(0, totalSize - suffixLen);
        end = totalSize - 1;
        isPartial = true;
      }
    } else {
      const parsedStart = Number(rawStart);
      if (Number.isFinite(parsedStart) && parsedStart >= 0 && parsedStart < totalSize) {
        start = parsedStart;
        const parsedEnd = rawEnd ? Number(rawEnd) : totalSize - 1;
        end = Number.isFinite(parsedEnd) ? Math.min(totalSize - 1, Math.max(start, parsedEnd)) : totalSize - 1;
        isPartial = true;
      } else if (Number.isFinite(parsedStart) && parsedStart >= totalSize) {
        return { ok: false, status: 416, error: "Requested range not satisfiable" };
      }
    }
  }

  // Cap single chunked response slice to 2MB so serverless responses never exceed 4.5MB limit
  if (end - start + 1 > MEDIA_VAULT_MAX_SINGLE_SLICE_BYTES) {
    end = start + MEDIA_VAULT_MAX_SINGLE_SLICE_BYTES - 1;
    isPartial = true;
  }

  if (chunkCount === 1 && typeof meta.data === "string") {
    const fullBuf = Buffer.from(meta.data, "base64");
    const sliced = isPartial ? fullBuf.subarray(start, end + 1) : fullBuf;
    return {
      ok: true,
      buffer: sliced,
      fileName,
      mimeType,
      totalSize: fullBuf.length,
      start,
      end: isPartial ? start + sliced.length - 1 : fullBuf.length - 1,
      isPartial,
    };
  }

  const startChunk = Math.floor(start / chunkSize);
  const endChunk = Math.floor(end / chunkSize);
  const chunkIndexes = Array.from({ length: endChunk - startChunk + 1 }, (_, i) => startChunk + i);
  const chunkDocs = await Promise.all(
    chunkIndexes.map((c) =>
      getKvDocFromSupabase<{ data?: string }>(`media_vault/${cleanId}/chunk_${c}`, 12000)
    )
  );
  const chunkBuffers: Buffer[] = [];
  for (let i = 0; i < chunkDocs.length; i++) {
    const chunkDoc = chunkDocs[i];
    if (!chunkDoc?.data) {
      return { ok: false, status: 404, error: `Missing media chunk ${startChunk + i}` };
    }
    chunkBuffers.push(Buffer.from(chunkDoc.data, "base64"));
  }

  const combined = Buffer.concat(chunkBuffers);
  const localOffset = start - startChunk * chunkSize;
  const length = end - start + 1;
  const sliced = combined.subarray(localOffset, localOffset + length);

  return {
    ok: true,
    buffer: sliced,
    fileName,
    mimeType,
    totalSize,
    start,
    end: start + sliced.length - 1,
    isPartial,
  };
}
