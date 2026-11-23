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

export async function getKvDocFromSupabase<T = any>(docPath: string): Promise<T | null> {
  const { path } = normalizeServerDocPath(docPath);
  if (!path) return null;
  const res = await sbRestFetch(`kv_documents?path=eq.${encodeURIComponent(path)}&select=data&limit=1`, {
    method: "GET",
  });
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as any[];
  return Array.isArray(rows) && rows[0]?.data !== undefined ? (rows[0].data as T) : null;
}

export async function upsertKvDocInSupabase(
  docPath: string,
  payload: Record<string, any>,
  explicitSchoolId?: string
): Promise<boolean> {
  const meta = normalizeServerDocPath(docPath, explicitSchoolId);
  if (!meta.path || !meta.docId) return false;
  const res = await sbRestFetch("kv_documents?on_conflict=path", {
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
  });
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
