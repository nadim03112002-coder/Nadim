import { supabase, extractSchoolIdFromPath } from './supabaseClient';

let schemaReadyCache: { ready: boolean; checkedAt: number } | null = null;
let schemaProbePromise: Promise<boolean> | null = null;
const SCHEMA_CACHE_TTL_MS = 60_000;

export async function isSupabaseSchemaReady(forceRecheck = false): Promise<boolean> {
  if (!supabase) return false;
  const now = Date.now();
  if (!forceRecheck && schemaReadyCache && now - schemaReadyCache.checkedAt < SCHEMA_CACHE_TTL_MS) {
    return schemaReadyCache.ready;
  }
  if (schemaProbePromise) return schemaProbePromise;

  schemaProbePromise = (async () => {
    try {
      const { error } = await supabase
        .from('kv_documents')
        .select('path', { head: true, count: 'exact' })
        .limit(1);
      const ready = !error;
      schemaReadyCache = { ready, checkedAt: Date.now() };
      return ready;
    } catch {
      schemaReadyCache = { ready: false, checkedAt: Date.now() };
      return false;
    } finally {
      schemaProbePromise = null;
    }
  })();

  return schemaProbePromise;
}

const normalizeDocPath = (
  rawPath: string
): { path: string; collectionPath: string; docId: string; schoolId: string } => {
  const parts = String(rawPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  const path = parts.join('/');
  const docId = parts.length > 0 ? parts[parts.length - 1] : '';
  const collectionPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '_root';
  const schoolId = extractSchoolIdFromPath(path);
  return { path, collectionPath, docId, schoolId };
};

export async function sbGetDocument<T = Record<string, any>>(docPath: string): Promise<T | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  const { path } = normalizeDocPath(docPath);
  if (!path) return null;

  try {
    const { data, error } = await supabase
      .from('kv_documents')
      .select('data')
      .eq('path', path)
      .maybeSingle();
    if (error || !data) return null;
    return (data.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function sbSetDocument(
  docPath: string,
  payload: Record<string, any>,
  merge = true
): Promise<boolean> {
  if (!supabase || !(await isSupabaseSchemaReady())) return false;
  const { path, collectionPath, docId, schoolId } = normalizeDocPath(docPath);
  if (!path || !collectionPath || !docId) return false;

  try {
    let nextData = payload || {};
    if (merge) {
      const existing = await sbGetDocument<Record<string, any>>(path);
      if (existing && typeof existing === 'object') {
        nextData = { ...existing, ...payload };
      }
    }

    const rowSchoolId = String((nextData as any)?.schoolId || schoolId || '').trim();
    const { error } = await supabase.from('kv_documents').upsert(
      {
        path,
        collection_path: collectionPath,
        doc_id: docId,
        school_id: rowSchoolId,
        data: nextData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'path' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function sbDeleteDocument(docPath: string): Promise<boolean> {
  if (!supabase || !(await isSupabaseSchemaReady())) return false;
  const { path } = normalizeDocPath(docPath);
  if (!path) return false;

  try {
    const { error } = await supabase.from('kv_documents').delete().eq('path', path);
    return !error;
  } catch {
    return false;
  }
}

export async function sbQueryCollection<T = Record<string, any>>(
  collectionPath: string,
  options?: { schoolId?: string; limit?: number }
): Promise<T[] | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  const cleanCol = String(collectionPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/');
  if (!cleanCol) return [];

  try {
    let query = supabase
      .from('kv_documents')
      .select('data')
      .eq('collection_path', cleanCol);

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }
    query = query.order('updated_at', { ascending: false }).limit(options?.limit && options.limit > 0 ? options.limit : 2000);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return null;
    return data.map((row: any) => row.data as T);
  } catch {
    return null;
  }
}

export async function sbQueryCollectionWithIds<T = Record<string, any>>(
  collectionPath: string,
  options?: { schoolId?: string; limit?: number }
): Promise<Array<{ id: string; data: T }> | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  const cleanCol = String(collectionPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/');
  if (!cleanCol) return [];

  try {
    let query = supabase
      .from('kv_documents')
      .select('doc_id,data')
      .eq('collection_path', cleanCol);

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }
    query = query.order('updated_at', { ascending: false }).limit(options?.limit && options.limit > 0 ? options.limit : 2000);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return null;
    return data.map((row: any) => ({
      id: String(row.doc_id || row.data?.id || ''),
      data: row.data as T,
    }));
  } catch {
    return null;
  }
}

export async function sbBatchSetDocuments(
  entries: Array<{ path: string; data: Record<string, any> }>
): Promise<boolean> {
  if (!supabase || entries.length === 0 || !(await isSupabaseSchemaReady())) return false;

  try {
    const nowIso = new Date().toISOString();
    const dedup = new Map<string, any>();
    for (const entry of entries) {
      const meta = normalizeDocPath(entry.path);
      if (!meta.path || !meta.collectionPath || !meta.docId) continue;
      dedup.set(meta.path, {
        path: meta.path,
        collection_path: meta.collectionPath,
        doc_id: meta.docId,
        school_id: String(entry.data?.schoolId || meta.schoolId || '').trim(),
        data: entry.data || {},
        updated_at: nowIso,
      });
    }

    const rows = Array.from(dedup.values());
    if (rows.length === 0) return true;

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabase.from('kv_documents').upsert(chunk as any[], { onConflict: 'path' });
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function sbBatchDeleteDocuments(paths: string[]): Promise<boolean> {
  if (!supabase || paths.length === 0 || !(await isSupabaseSchemaReady())) return false;

  try {
    const cleanPaths = paths
      .map((p) => normalizeDocPath(p).path)
      .filter(Boolean);
    if (cleanPaths.length === 0) return true;

    for (let i = 0; i < cleanPaths.length; i += 200) {
      const chunk = cleanPaths.slice(i, i + 200);
      const { error } = await supabase.from('kv_documents').delete().in('path', chunk);
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sbSubscribeCollection(
  collectionPath: string,
  onChange: () => void
): () => void {
  if (!supabase) return () => {};
  const cleanCol = String(collectionPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/');
  if (!cleanCol) return () => {};

  const channel = supabase
    .channel(`kv_col_${cleanCol.replace(/[^a-zA-Z0-9_]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kv_documents',
        filter: `collection_path=eq.${cleanCol}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

export function sbSubscribeDocument(
  docPath: string,
  onChange: () => void
): () => void {
  if (!supabase) return () => {};
  const { path } = normalizeDocPath(docPath);
  if (!path) return () => {};

  const channel = supabase
    .channel(`kv_doc_${path.replace(/[^a-zA-Z0-9_]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kv_documents',
        filter: `path=eq.${path}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

// ── SCHOOLS TABLE HELPERS ────────────────────────────────────────────────────

export async function sbGetSchool<T = Record<string, any>>(schoolId: string): Promise<T | null> {
  if (!supabase || !schoolId || !(await isSupabaseSchemaReady())) return null;
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('id,data')
      .eq('id', String(schoolId).trim())
      .maybeSingle();
    if (error || !data) return null;
    const raw = (data.data || {}) as Record<string, any>;
    return { ...raw, id: raw.id || data.id } as T;
  } catch {
    return null;
  }
}

export async function sbGetAllSchools<T = Record<string, any>>(): Promise<T[] | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('id,data')
      .limit(1000);
    if (error || !Array.isArray(data)) return null;
    return data.map((row: any) => ({ ...(row.data || {}), id: row.data?.id || row.id } as T));
  } catch {
    return null;
  }
}

export async function sbSaveSchool(
  schoolId: string,
  payload: Record<string, any>,
  merge = true
): Promise<boolean> {
  if (!supabase || !schoolId || !(await isSupabaseSchemaReady())) return false;
  const cleanId = String(schoolId).trim();
  try {
    let nextData: Record<string, any> = { ...(payload || {}), id: cleanId };
    if (merge) {
      const existing = await sbGetSchool<Record<string, any>>(cleanId);
      if (existing && typeof existing === 'object') {
        nextData = { ...existing, ...nextData, id: cleanId };
      }
    }
    const { error } = await supabase.from('schools').upsert(
      {
        id: cleanId,
        code: String(nextData.code || '').trim(),
        name: String(nextData.name || '').trim(),
        data: nextData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function sbDeleteSchool(schoolId: string): Promise<boolean> {
  if (!supabase || !schoolId || !(await isSupabaseSchemaReady())) return false;
  try {
    const { error } = await supabase.from('schools').delete().eq('id', String(schoolId).trim());
    return !error;
  } catch {
    return false;
  }
}

export function sbSubscribeSchools(onChange: () => void, schoolId?: string): () => void {
  if (!supabase) return () => {};
  const filter = schoolId ? `id=eq.${String(schoolId).trim()}` : undefined;
  const channel = supabase
    .channel(`schools_rt_${schoolId || 'all'}_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      filter
        ? { event: '*', schema: 'public', table: 'schools', filter }
        : { event: '*', schema: 'public', table: 'schools' },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

// ── USERS TABLE HELPERS ──────────────────────────────────────────────────────

export async function sbGetUser<T = Record<string, any>>(userId: string): Promise<T | null> {
  if (!supabase || !userId || !(await isSupabaseSchemaReady())) return null;
  try {
    const cleanUid = String(userId).trim();
    const { data, error } = await supabase
      .from('users')
      .select('id,data')
      .eq('id', cleanUid)
      .maybeSingle();
    if (error || !data) return null;
    const raw = (data.data || {}) as Record<string, any>;
    return { ...raw, id: raw.id || data.id } as T;
  } catch {
    return null;
  }
}

export async function sbSaveUser(user: Record<string, any>, merge = true): Promise<boolean> {
  if (!supabase || !user || !(user.id || user.uid) || !(await isSupabaseSchemaReady())) return false;
  const uid = String(user.id || user.uid).trim();
  if (!uid) return false;
  try {
    let nextData: Record<string, any> = { ...user, id: uid };
    if (merge) {
      const existing = await sbGetUser<Record<string, any>>(uid);
      if (existing && typeof existing === 'object') {
        nextData = { ...existing, ...nextData, id: uid };
      }
    }
    const email = String(nextData.email || '').trim().toLowerCase();
    const mobile = String(nextData.mobile || nextData.phone || '').trim();
    const schoolId = String(nextData.schoolId || '').trim();
    const role = String(nextData.role || 'STUDENT').trim();
    const { error } = await supabase.from('users').upsert(
      {
        id: uid,
        email,
        mobile,
        school_id: schoolId,
        role,
        data: nextData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function sbDeleteUser(userId: string): Promise<boolean> {
  if (!supabase || !userId || !(await isSupabaseSchemaReady())) return false;
  try {
    const { error } = await supabase.from('users').delete().eq('id', String(userId).trim());
    return !error;
  } catch {
    return false;
  }
}

export async function sbFindUserByEmail<T = Record<string, any>>(email: string): Promise<T | null> {
  if (!supabase || !email || !(await isSupabaseSchemaReady())) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    const { data: primary } = await supabase
      .from('users')
      .select('data')
      .eq('email', cleanEmail)
      .limit(1);
    if (Array.isArray(primary) && primary.length > 0 && primary[0]?.data) {
      return primary[0].data as T;
    }
    const { data: recovery } = await supabase
      .from('users')
      .select('data')
      .filter('data->>recoveryEmail', 'eq', cleanEmail)
      .limit(1);
    if (Array.isArray(recovery) && recovery.length > 0 && recovery[0]?.data) {
      return recovery[0].data as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sbFindUserByField<T = Record<string, any>>(
  field: 'linkedGoogleUid' | 'displayId' | 'mobile' | 'recoveryMobile' | 'uid' | 'id',
  value: string
): Promise<T | null> {
  if (!supabase || !value || !(await isSupabaseSchemaReady())) return null;
  const cleanVal = String(value).trim();
  if (!cleanVal) return null;
  try {
    if (field === 'id') {
      return sbGetUser<T>(cleanVal);
    }
    if (field === 'mobile') {
      const { data } = await supabase.from('users').select('data').eq('mobile', cleanVal).limit(1);
      if (Array.isArray(data) && data.length > 0 && data[0]?.data) return data[0].data as T;
    }
    const { data } = await supabase
      .from('users')
      .select('data')
      .filter(`data->>${field}`, 'eq', cleanVal)
      .limit(1);
    if (Array.isArray(data) && data.length > 0 && data[0]?.data) {
      return data[0].data as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sbFindUserByNameAndClass<T = Record<string, any>>(
  name: string,
  classLevel: string
): Promise<T | null> {
  if (!supabase || !name || !classLevel || !(await isSupabaseSchemaReady())) return null;
  const nameNorm = String(name).trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('data')
      .filter('data->>classLevel', 'eq', String(classLevel))
      .limit(250);
    if (error || !Array.isArray(data)) return null;
    const matched = data.find((r: any) => String(r?.data?.name || '').trim().toLowerCase() === nameNorm);
    return (matched?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function sbFindUserByCandidates<T = Record<string, any>>(
  candidateIds: string[],
  rawInput: string,
  lowerInput: string
): Promise<T | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  const cleanCands = Array.from(new Set((candidateIds || []).map((c) => String(c || '').trim()).filter(Boolean)));
  try {
    if (cleanCands.length > 0) {
      const { data: directRows } = await supabase
        .from('users')
        .select('data')
        .in('id', cleanCands.slice(0, 20))
        .limit(1);
      if (Array.isArray(directRows) && directRows.length > 0 && directRows[0]?.data) {
        return directRows[0].data as T;
      }
    }

    const lookups: Array<Promise<T | null>> = [];
    if (rawInput) {
      lookups.push(sbFindUserByField<T>('mobile', rawInput));
      lookups.push(sbFindUserByField<T>('recoveryMobile', rawInput));
    }
    if (lowerInput) {
      lookups.push(sbFindUserByEmail<T>(lowerInput));
    }
    for (const cid of cleanCands.slice(0, 5)) {
      lookups.push(sbFindUserByField<T>('displayId', cid));
      lookups.push(sbFindUserByField<T>('uid', cid));
    }

    const results = await Promise.all(lookups);
    for (const r of results) {
      if (r && (r as any).id) return r;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sbGetUsersPage<T = Record<string, any>>(
  limitCount = 100,
  offset = 0
): Promise<T[] | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('data')
      .order('updated_at', { ascending: false })
      .range(offset, offset + Math.max(1, limitCount) - 1);
    if (error || !Array.isArray(data)) return null;
    return data.map((r: any) => r.data as T);
  } catch {
    return null;
  }
}

export async function sbGetAllUsers<T = Record<string, any>>(limitCount = 1000): Promise<T[] | null> {
  return sbGetUsersPage<T>(limitCount, 0);
}

export function sbSubscribeUser(userId: string, onUser: (data: any | null) => void): () => void {
  if (!supabase || !userId) return () => {};
  const cleanUid = String(userId).trim();
  const channel = supabase
    .channel(`user_rt_${cleanUid.replace(/[^a-zA-Z0-9_]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${cleanUid}`,
      },
      (payload: any) => {
        if (payload?.eventType === 'DELETE') {
          onUser(null);
          return;
        }
        const rowData = payload?.new?.data;
        if (rowData) onUser({ ...rowData, id: rowData.id || cleanUid });
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

export function sbSubscribeUsers(onUsers: (list: any[]) => void, limitCount = 500): () => void {
  if (!supabase) return () => {};
  let disposed = false;
  const refresh = () => {
    if (disposed) return;
    sbGetUsersPage(limitCount, 0).then((rows) => {
      if (!disposed && Array.isArray(rows)) onUsers(rows);
    }).catch(() => {});
  };
  const channel = supabase
    .channel(`users_all_${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refresh)
    .subscribe();

  return () => {
    disposed = true;
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

// ── RTDB-COMPATIBLE PATH HELPERS (BACKED BY kv_documents + REALTIME) ─────────

export async function sbRtdbGet<T = any>(rtdbPath: string): Promise<T | null> {
  if (!supabase || !(await isSupabaseSchemaReady())) return null;
  const cleanPath = String(rtdbPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/');
  if (!cleanPath) return null;

  try {
    const exact = await sbGetDocument<any>(cleanPath);
    if (exact !== null) return exact as T;

    const childRows = await sbQueryCollectionWithIds<any>(cleanPath);
    if (Array.isArray(childRows) && childRows.length > 0) {
      const map: Record<string, any> = {};
      for (const row of childRows) {
        if (row.id) map[row.id] = row.data;
      }
      return map as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sbRtdbSet(rtdbPath: string, payload: any): Promise<boolean> {
  if (payload === null || payload === undefined) {
    return sbDeleteDocument(rtdbPath);
  }
  const wrapped = typeof payload === 'object' ? payload : { value: payload };
  return sbSetDocument(rtdbPath, wrapped, false);
}

export async function sbRtdbUpdate(rtdbPath: string, patch: Record<string, any>): Promise<boolean> {
  return sbSetDocument(rtdbPath, patch, true);
}

export async function sbRtdbRemove(rtdbPath: string): Promise<boolean> {
  return sbDeleteDocument(rtdbPath);
}

export function sbRtdbSubscribe(rtdbPath: string, onVal: (val: any) => void): () => void {
  if (!supabase) return () => {};
  const cleanPath = String(rtdbPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/');
  if (!cleanPath) return () => {};

  let disposed = false;
  const emit = () => {
    if (disposed) return;
    sbRtdbGet(cleanPath)
      .then((val) => {
        if (!disposed) onVal(val);
      })
      .catch(() => {});
  };

  emit();
  const unsubDoc = sbSubscribeDocument(cleanPath, emit);
  const unsubCol = sbSubscribeCollection(cleanPath, emit);

  return () => {
    disposed = true;
    unsubDoc();
    unsubCol();
  };
}

// ── FCM TOKEN STORAGE ────────────────────────────────────────────────────────

export async function sbUpsertFcmToken(record: {
  tokenKey: string;
  userId?: string;
  studentId?: string;
  schoolId?: string;
  classId?: string;
  className?: string;
  role?: string;
  platform: 'pwa' | 'android_native';
  token: string;
  deviceId?: string;
}): Promise<boolean> {
  if (!supabase || !record.tokenKey || !record.token) return false;
  try {
    const { error } = await supabase.from('fcm_tokens').upsert(
      {
        token_key: record.tokenKey,
        user_id: String(record.userId || ''),
        student_id: String(record.studentId || ''),
        school_id: String(record.schoolId || ''),
        class_id: String(record.classId || ''),
        class_name: String(record.className || ''),
        role: String(record.role || ''),
        platform: record.platform || 'pwa',
        token: record.token,
        device_id: String(record.deviceId || ''),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token_key' }
    );
    return !error;
  } catch {
    return false;
  }
}
