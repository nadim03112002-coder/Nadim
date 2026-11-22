import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

const sanitizeCloudPayload = (val: unknown): unknown => {
  if (val === null || val === undefined) return null;
  if (typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(sanitizeCloudPayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (v !== undefined) out[k] = sanitizeCloudPayload(v);
  }
  return out;
};

const withCloudTimeout = <T,>(promise: Promise<T>, ms = 3500): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Cloud sync timed out after ${ms}ms`)), ms)
    ),
  ]);

const isDemoSchoolId = (schoolId?: string | null): boolean =>
  !schoolId || schoolId === "demo_school" || schoolId.startsWith("demo_");

const SUBCOLLECTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

const isSubcollectionCacheFresh = (localKey: string, ttlMs = SUBCOLLECTION_TTL_MS): boolean => {
  try {
    const tsRaw = localStorage.getItem(`${localKey}__sync_ts`);
    if (!tsRaw) return false;
    return Date.now() - Number(tsRaw) < ttlMs;
  } catch {
    return false;
  }
};

const markSubcollectionCacheFresh = (localKey: string) => {
  try {
    localStorage.setItem(`${localKey}__sync_ts`, String(Date.now()));
  } catch {}
};

export async function loadSchoolSubcollection<T extends { id: string }>(
  schoolId: string | undefined,
  subcollection: string,
  localKey: string,
  forceRefresh = false
): Promise<T[]> {
  let localItems: T[] = [];
  let hasLocalCache = false;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localItems = parsed;
        hasLocalCache = true;
      }
    }
  } catch (err) {
    console.warn(`[schoolCloudSync] Failed reading local cache ${localKey}:`, err);
  }

  if (!db || !schoolId || isDemoSchoolId(schoolId)) {
    return localItems;
  }

  if (!forceRefresh && hasLocalCache && isSubcollectionCacheFresh(localKey)) {
    return localItems;
  }

  try {
    const snap = await withCloudTimeout(
      getDocs(collection(db, "schools", schoolId, subcollection)),
      4000
    );
    const cloudItems = snap.docs.map((d) => d.data() as T);
    markSubcollectionCacheFresh(localKey);
    if (cloudItems.length > 0) {
      try {
        localStorage.setItem(localKey, JSON.stringify(cloudItems));
      } catch (err) {
        console.warn(`[schoolCloudSync] Failed caching ${localKey}:`, err);
      }
      return cloudItems;
    }
    // If cloud is empty and local has user-entered items, push local items up once
    if (localItems.length > 0) {
      await syncSchoolSubcollection(schoolId, subcollection, localItems).catch(() => {});
    }
    return localItems;
  } catch (err) {
    console.warn(`[schoolCloudSync] Cloud read failed for ${subcollection}:`, err);
    return localItems;
  }
}

export async function syncSchoolSubcollection<T extends { id: string }>(
  schoolId: string | undefined,
  subcollection: string,
  items: T[],
  deletedIds?: string[]
): Promise<void> {
  if (!db || !schoolId || isDemoSchoolId(schoolId)) return;
  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    const nextIds = new Set<string>();
    const idsStorageKey = `nst_synced_ids_${schoolId}_${subcollection}`;

    for (const item of items) {
      const id = String(item.id);
      nextIds.add(id);
      batch.set(
        doc(db, "schools", schoolId, subcollection, id),
        sanitizeCloudPayload({ ...item, schoolId, updatedAt: nowIso }) as Record<string, unknown>,
        { merge: true }
      );
    }

    const toDelete = new Set<string>(Array.isArray(deletedIds) ? deletedIds.map(String) : []);
    try {
      const prevRaw = localStorage.getItem(idsStorageKey);
      if (prevRaw) {
        const prevIds: string[] = JSON.parse(prevRaw);
        if (Array.isArray(prevIds)) {
          for (const prevId of prevIds) {
            if (!nextIds.has(prevId)) toDelete.add(prevId);
          }
        }
      }
      localStorage.setItem(idsStorageKey, JSON.stringify(Array.from(nextIds)));
    } catch {}

    for (const delId of toDelete) {
      batch.delete(doc(db, "schools", schoolId, subcollection, delId));
    }

    await withCloudTimeout(batch.commit(), 5000);
  } catch (err) {
    console.warn(`[schoolCloudSync] Batch sync failed for ${subcollection}:`, err);
  }
}

export async function saveSchoolSubdoc<T extends { id: string }>(
  schoolId: string | undefined,
  subcollection: string,
  item: T
): Promise<void> {
  if (!db || !schoolId || isDemoSchoolId(schoolId)) return;
  try {
    await withCloudTimeout(
      setDoc(
        doc(db, "schools", schoolId, subcollection, String(item.id)),
        sanitizeCloudPayload({ ...item, schoolId, updatedAt: new Date().toISOString() }) as Record<string, unknown>,
        { merge: true }
      ),
      4000
    );
  } catch (err) {
    console.warn(`[schoolCloudSync] Save doc failed for ${subcollection}/${item.id}:`, err);
  }
}

export async function deleteSchoolSubdoc(
  schoolId: string | undefined,
  subcollection: string,
  docId: string
): Promise<void> {
  if (!db || !schoolId || isDemoSchoolId(schoolId)) return;
  try {
    await withCloudTimeout(
      deleteDoc(doc(db, "schools", schoolId, subcollection, String(docId))),
      4000
    );
  } catch (err) {
    console.warn(`[schoolCloudSync] Delete doc failed for ${subcollection}/${docId}:`, err);
  }
}

export async function loadSchoolSettingBlob<T>(
  schoolId: string | undefined,
  settingKey: string,
  localKey: string,
  fallback: T,
  forceRefresh = false
): Promise<T> {
  let localVal: T = fallback;
  let hasLocal = false;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      localVal = JSON.parse(raw) as T;
      hasLocal = true;
    }
  } catch (err) {
    console.warn(`[schoolCloudSync] Failed reading local blob ${localKey}:`, err);
  }

  if (!db || !schoolId || isDemoSchoolId(schoolId)) return localVal;
  if (!forceRefresh && hasLocal && isSubcollectionCacheFresh(localKey)) return localVal;

  try {
    const snap = await withCloudTimeout(
      getDoc(doc(db, "schools", schoolId, "erp_settings", settingKey)),
      3500
    );
    markSubcollectionCacheFresh(localKey);
    if (snap.exists() && snap.data()?.value !== undefined) {
      const cloudVal = snap.data().value as T;
      try {
        localStorage.setItem(localKey, JSON.stringify(cloudVal));
      } catch {}
      return cloudVal;
    }
  } catch (err) {
    console.warn(`[schoolCloudSync] Failed loading setting blob ${settingKey}:`, err);
  }
  return localVal;
}

export async function saveSchoolSettingBlob<T>(
  schoolId: string | undefined,
  settingKey: string,
  localKey: string,
  value: T
): Promise<void> {
  try {
    localStorage.setItem(localKey, JSON.stringify(value));
  } catch (err) {
    console.warn(`[schoolCloudSync] Failed saving local blob ${localKey}:`, err);
  }
  if (!db || !schoolId || isDemoSchoolId(schoolId)) return;
  try {
    await withCloudTimeout(
      setDoc(
        doc(db, "schools", schoolId, "erp_settings", settingKey),
        sanitizeCloudPayload({
          value,
          schoolId,
          updatedAt: new Date().toISOString(),
        }) as Record<string, unknown>,
        { merge: true }
      ),
      4000
    );
  } catch (err) {
    console.warn(`[schoolCloudSync] Failed saving setting blob ${settingKey}:`, err);
  }
}

const cleanRtdbNodeKey = (raw: string): string =>
  String(raw || "").trim().replace(/[.#$[\]/]/g, "_");

async function readSchoolRtdbNode<T>(
  schoolId: string | undefined,
  nodeName: string
): Promise<T[]> {
  if (!schoolId || isDemoSchoolId(schoolId)) return [];
  try {
    const { rtdb } = await import("../firebase");
    if (!rtdb) return [];
    const { ref, get } = await import("firebase/database");
    const snap = await withCloudTimeout(
      get(ref(rtdb, `schools/${cleanRtdbNodeKey(schoolId)}/${nodeName}`)),
      3000
    );
    if (!snap.exists()) return [];
    const val = snap.val();
    if (!val || typeof val !== "object") return [];
    return Object.values(val) as T[];
  } catch (err) {
    console.warn(`[schoolCloudSync] RTDB read failed for ${nodeName}:`, err);
    return [];
  }
}

export async function loadMergedStoreSales<T extends { id: string; receiptNo?: string; updatedAt?: string; date?: string }>(
  schoolId: string | undefined,
  localKey?: string,
  forceRefresh = false
): Promise<T[]> {
  const key = localKey || `nst_school_store_sales_${schoolId || "default"}`;
  if (!forceRefresh && isSubcollectionCacheFresh(`${key}__merged`, 5 * 60 * 1000)) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }

  const [fsItems, rtdbItems] = await Promise.all([
    loadSchoolSubcollection<T>(schoolId, "store_sales", key, forceRefresh),
    readSchoolRtdbNode<T>(schoolId, "store_sales"),
  ]);

  const merged = new Map<string, T>();
  for (const item of fsItems) {
    if (item?.id) merged.set(item.id, item);
  }
  for (const item of rtdbItems) {
    if (!item?.id) continue;
    const prev = merged.get(item.id);
    if (!prev || (item.updatedAt && (!prev.updatedAt || item.updatedAt >= prev.updatedAt))) {
      merged.set(item.id, item);
    }
  }

  const list = Array.from(merged.values()).sort((a, b) =>
    String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || ""))
  );
  markSubcollectionCacheFresh(`${key}__merged`);
  if (list.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }
  return list;
}

export async function loadMergedStoreReservations<T extends { id: string; status?: string; bookedAt?: string; razorpayPaymentId?: string }>(
  schoolId: string | undefined,
  localKey?: string,
  forceRefresh = false
): Promise<T[]> {
  const key = localKey || `nst_school_store_reservations_${schoolId || "default"}`;
  if (!forceRefresh && isSubcollectionCacheFresh(`${key}__merged`, 5 * 60 * 1000)) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }

  const [fsItems, rtdbItems] = await Promise.all([
    loadSchoolSubcollection<T>(schoolId, "store_reservations", key, forceRefresh),
    readSchoolRtdbNode<T>(schoolId, "store_reservations"),
  ]);

  const merged = new Map<string, T>();
  for (const item of fsItems) {
    if (item?.id) merged.set(item.id, item);
  }
  for (const item of rtdbItems) {
    if (!item?.id) continue;
    const prev = merged.get(item.id);
    // Prefer RTDB patch when it holds collected/paid online status
    if (!prev) {
      merged.set(item.id, item);
    } else if (item.razorpayPaymentId || item.status === "collected") {
      merged.set(item.id, { ...prev, ...item });
    }
  }

  markSubcollectionCacheFresh(`${key}__merged`);
  const list = Array.from(merged.values()).sort((a, b) =>
    String(b.bookedAt || "").localeCompare(String(a.bookedAt || ""))
  );
  if (list.length > 0) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }
  return list;
}

