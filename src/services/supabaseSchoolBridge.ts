import {
  collection as fsCollection,
  doc as fsDoc,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
  onSnapshot as fsOnSnapshot,
  writeBatch as fsWriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  isSupabaseSchemaReady,
  sbBatchDeleteDocuments,
  sbBatchSetDocuments,
  sbDeleteDocument,
  sbDeleteSchool,
  sbDeleteUser,
  sbGetAllSchools,
  sbGetAllUsers,
  sbGetDocument,
  sbGetSchool,
  sbGetUser,
  sbQueryCollectionWithIds,
  sbSaveSchool,
  sbSaveUser,
  sbSetDocument,
  sbSubscribeCollection,
  sbSubscribeDocument,
  sbSubscribeSchools,
} from './supabaseDbAdapter';

export interface SbDocRef {
  __sbType: 'doc';
  path: string;
  collectionPath: string;
  id: string;
}

export interface SbWhereConstraint {
  __sbConstraint: 'where';
  field: string;
  op: '==' | 'in' | '!=' | 'array-contains';
  value: any;
}

export interface SbOrderConstraint {
  __sbConstraint: 'orderBy';
  field: string;
  dir: 'asc' | 'desc';
}

export interface SbLimitConstraint {
  __sbConstraint: 'limit';
  count: number;
}

export type SbConstraint = SbWhereConstraint | SbOrderConstraint | SbLimitConstraint;

export interface SbColRef {
  __sbType: 'col';
  path: string;
  wheres: SbWhereConstraint[];
  orderBys: SbOrderConstraint[];
  limitCount?: number;
}

export interface SbDocSnap<T = any> {
  id: string;
  exists: () => boolean;
  data: () => T;
}

export interface SbQuerySnap<T = any> {
  empty: boolean;
  size: number;
  docs: Array<{ id: string; data: () => T; exists: () => boolean }>;
  forEach: (cb: (docSnap: { id: string; data: () => T; exists: () => boolean }) => void) => void;
}

const cleanPath = (raw: string): string =>
  String(raw || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/');

const EMPTY_CHECK_TTL_MS = 8 * 60 * 1000;
const checkedEmptyCollections = new Map<string, number>();
const checkedEmptyDocs = new Map<string, number>();
const migratedCollectionsMem = new Set<string>();
const inflightColMigrations = new Map<string, Promise<void>>();

const getMigrationMetaPath = (colPath: string) =>
  `_migration_meta/${cleanPath(colPath).replace(/\//g, '__')}`;

async function hasCollectionBackfilledFromFirestore(colPath: string): Promise<boolean> {
  if (migratedCollectionsMem.has(colPath)) return true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(`nst_sb_migrated_${colPath}`) === '1') {
      migratedCollectionsMem.add(colPath);
      return true;
    }
  } catch {}
  try {
    const meta = await sbGetDocument<{ migratedAt?: string }>(getMigrationMetaPath(colPath));
    if (meta?.migratedAt) {
      migratedCollectionsMem.add(colPath);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`nst_sb_migrated_${colPath}`, '1');
        }
      } catch {}
      return true;
    }
  } catch {}
  return false;
}

function markCollectionBackfilled(colPath: string, count: number) {
  migratedCollectionsMem.add(colPath);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`nst_sb_migrated_${colPath}`, '1');
    }
  } catch {}
  void sbSetDocument(
    getMigrationMetaPath(colPath),
    { migratedAt: new Date().toISOString(), count },
    false
  );
}

const markPathNonEmpty = (path: string) => {
  const parts = cleanPath(path).split('/');
  checkedEmptyDocs.delete(cleanPath(path));
  if (parts.length > 1) {
    checkedEmptyCollections.delete(parts.slice(0, -1).join('/'));
  }
};

export function sbCol(path: string): SbColRef {
  return {
    __sbType: 'col',
    path: cleanPath(path),
    wheres: [],
    orderBys: [],
  };
}

export function sbDoc(path: string): SbDocRef {
  const p = cleanPath(path);
  const parts = p.split('/');
  return {
    __sbType: 'doc',
    path: p,
    collectionPath: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
    id: parts.length > 0 ? parts[parts.length - 1] : '',
  };
}

export function sbWhere(field: string, op: any, value: any): SbWhereConstraint {
  return { __sbConstraint: 'where', field, op, value };
}

export function sbOrderBy(field: string, dir: 'asc' | 'desc' = 'asc'): SbOrderConstraint {
  return { __sbConstraint: 'orderBy', field, dir };
}

export function sbLimit(count: number): SbLimitConstraint {
  return { __sbConstraint: 'limit', count };
}

export function sbQuery(target: SbColRef, ...constraints: SbConstraint[]): SbColRef {
  const next: SbColRef = {
    __sbType: 'col',
    path: target.path,
    wheres: [...target.wheres],
    orderBys: [...target.orderBys],
    limitCount: target.limitCount,
  };
  for (const c of constraints) {
    if (!c) continue;
    if (c.__sbConstraint === 'where') next.wheres.push(c);
    else if (c.__sbConstraint === 'orderBy') next.orderBys.push(c);
    else if (c.__sbConstraint === 'limit') next.limitCount = c.count;
  }
  return next;
}

const matchesConstraints = (
  items: Array<{ id: string; data: any }>,
  colRef: SbColRef
): Array<{ id: string; data: any }> => {
  let out = items;

  if (colRef.wheres.length > 0) {
    out = out.filter((item) => {
      const row = item.data || {};
      return colRef.wheres.every((w) => {
        const val = w.field === 'id' ? row.id ?? item.id : row[w.field];
        if (w.op === '==') return val === w.value;
        if (w.op === '!=') return val !== w.value;
        if (w.op === 'in') return Array.isArray(w.value) && w.value.includes(val);
        if (w.op === 'array-contains') return Array.isArray(val) && val.includes(w.value);
        return true;
      });
    });
  }

  if (colRef.orderBys.length > 0) {
    const ob = colRef.orderBys[0];
    out = [...out].sort((a, b) => {
      const av = a.data?.[ob.field] ?? '';
      const bv = b.data?.[ob.field] ?? '';
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return ob.dir === 'desc' ? -cmp : cmp;
    });
  }

  if (typeof colRef.limitCount === 'number' && colRef.limitCount > 0) {
    out = out.slice(0, colRef.limitCount);
  }

  return out;
};

const toFsColOrQuery = (colRef: SbColRef) => {
  const base = fsCollection(db, colRef.path);
  const cs: any[] = [];
  colRef.wheres.forEach((w) => cs.push(fsWhere(w.field, w.op as any, w.value)));
  colRef.orderBys.forEach((o) => cs.push(fsOrderBy(o.field, o.dir)));
  if (typeof colRef.limitCount === 'number') cs.push(fsLimit(colRef.limitCount));
  return cs.length > 0 ? fsQuery(base, ...cs) : base;
};

const makeDocSnap = <T = any>(id: string, data: T | null | undefined): SbDocSnap<T> => ({
  id,
  exists: () => data !== null && data !== undefined,
  data: () => data as T,
});

const makeQuerySnap = <T = any>(rows: Array<{ id: string; data: T }>): SbQuerySnap<T> => {
  const docs = rows.map((r) => ({
    id: r.id,
    exists: () => true,
    data: () => r.data,
  }));
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (cb) => docs.forEach(cb),
  };
};

export async function sbBridgeGetDoc(docRef: SbDocRef): Promise<SbDocSnap> {
  const p = docRef.path;
  const parts = p.split('/');
  const ready = await isSupabaseSchemaReady();

  if (ready) {
    let sbVal: any = null;
    if (parts.length === 2 && parts[0] === 'schools') {
      sbVal = await sbGetSchool(parts[1]);
    } else if (parts.length === 2 && parts[0] === 'users') {
      sbVal = await sbGetUser(parts[1]);
    } else {
      sbVal = await sbGetDocument(p);
    }
    if (sbVal !== null) {
      return makeDocSnap(docRef.id, sbVal);
    }
  }

  const lastEmpty = checkedEmptyDocs.get(p);
  if (lastEmpty && Date.now() - lastEmpty < EMPTY_CHECK_TTL_MS) {
    return makeDocSnap(docRef.id, null);
  }

  if (db) {
    try {
      const snap = await fsGetDoc(fsDoc(db, p));
      if (snap.exists()) {
        const fsData = snap.data() as Record<string, any>;
        if (ready) {
          if (parts.length === 2 && parts[0] === 'schools') {
            void sbSaveSchool(parts[1], fsData, true);
          } else if (parts.length === 2 && parts[0] === 'users') {
            void sbSaveUser({ ...fsData, id: parts[1] }, true);
          } else {
            void sbSetDocument(p, fsData, true);
          }
        }
        return makeDocSnap(docRef.id, fsData);
      }
      checkedEmptyDocs.set(p, Date.now());
    } catch {}
  }

  return makeDocSnap(docRef.id, null);
}

export async function sbBridgeGetDocs(colRef: SbColRef): Promise<SbQuerySnap> {
  const ready = await isSupabaseSchemaReady();

  if (ready) {
    let allRows: Array<{ id: string; data: any }> | null = null;
    if (colRef.path === 'schools') {
      const list = await sbGetAllSchools();
      if (Array.isArray(list)) {
        allRows = list.map((s: any) => ({ id: String(s.id || ''), data: s }));
      }
    } else if (colRef.path === 'users') {
      const list = await sbGetAllUsers(1000);
      if (Array.isArray(list)) {
        allRows = list.map((u: any) => ({ id: String(u.id || u.uid || ''), data: u }));
      }
    } else {
      allRows = await sbQueryCollectionWithIds(colRef.path);
    }

    if (Array.isArray(allRows) && allRows.length > 0) {
      if (db && !inflightColMigrations.has(colRef.path)) {
        const snapshotRows = allRows;
        void hasCollectionBackfilledFromFirestore(colRef.path)
          .then((alreadyDone) => {
            if (alreadyDone || inflightColMigrations.has(colRef.path)) return;
            const migrationTask = (async () => {
              try {
                const snap = await fsGetDocs(fsCollection(db, colRef.path));
                const existingIds = new Set(snapshotRows.map((r) => r.id));
                const missingRows = snap.docs
                  .map((docItem) => ({ id: docItem.id, data: docItem.data() as Record<string, any> }))
                  .filter((r) => r.id && !existingIds.has(r.id));
                if (missingRows.length > 0) {
                  if (colRef.path === 'schools') {
                    missingRows.forEach((r) => void sbSaveSchool(r.id, r.data, true));
                  } else if (colRef.path === 'users') {
                    missingRows.forEach((r) => void sbSaveUser({ ...r.data, id: r.id }, true));
                  } else {
                    await sbBatchSetDocuments(
                      missingRows.map((r) => ({ path: `${colRef.path}/${r.id}`, data: r.data }))
                    );
                  }
                }
                markCollectionBackfilled(colRef.path, snapshotRows.length + missingRows.length);
              } catch {} finally {
                inflightColMigrations.delete(colRef.path);
              }
            })();
            inflightColMigrations.set(colRef.path, migrationTask);
          })
          .catch(() => {});
      }
      return makeQuerySnap(matchesConstraints(allRows, colRef));
    }
  }

  // Avoid repeated Firestore queries for collections we already verified are empty
  const emptyKey = colRef.path;
  const lastEmpty = checkedEmptyCollections.get(emptyKey);
  if (lastEmpty && Date.now() - lastEmpty < EMPTY_CHECK_TTL_MS) {
    return makeQuerySnap([]);
  }

  if (db) {
    try {
      // Read full collection once during legacy migration so Supabase receives all items cleanly
      const snap = await fsGetDocs(fsCollection(db, colRef.path));
      const fsRows = snap.docs.map((docItem) => ({ id: docItem.id, data: docItem.data() as Record<string, any> }));
      if (fsRows.length > 0) {
        if (ready) {
          if (colRef.path === 'schools') {
            fsRows.forEach((r) => void sbSaveSchool(r.id, r.data, true));
          } else if (colRef.path === 'users') {
            fsRows.forEach((r) => void sbSaveUser({ ...r.data, id: r.id }, true));
          } else {
            void sbBatchSetDocuments(
              fsRows.map((r) => ({ path: `${colRef.path}/${r.id}`, data: r.data }))
            );
          }
          markCollectionBackfilled(colRef.path, fsRows.length);
        }
        return makeQuerySnap(matchesConstraints(fsRows, colRef));
      }
      checkedEmptyCollections.set(emptyKey, Date.now());
    } catch {
      // Fallback to constrained Firestore query if unfiltered read fails security rules
      try {
        const snap = await fsGetDocs(toFsColOrQuery(colRef));
        const fsRows = snap.docs.map((docItem) => ({ id: docItem.id, data: docItem.data() as Record<string, any> }));
        if (ready && fsRows.length > 0) {
          void sbBatchSetDocuments(
            fsRows.map((r) => ({ path: `${colRef.path}/${r.id}`, data: r.data }))
          );
        }
        return makeQuerySnap(fsRows);
      } catch {}
    }
  }

  return makeQuerySnap([]);
}

export async function sbBridgeSetDoc(
  docRef: SbDocRef,
  data: Record<string, any>,
  opts?: { merge?: boolean }
): Promise<void> {
  const p = docRef.path;
  const parts = p.split('/');
  const merge = opts?.merge !== false;
  markPathNonEmpty(p);

  if (await isSupabaseSchemaReady()) {
    let ok = false;
    if (parts.length === 2 && parts[0] === 'schools') {
      ok = await sbSaveSchool(parts[1], data, merge);
    } else if (parts.length === 2 && parts[0] === 'users') {
      ok = await sbSaveUser({ ...data, id: parts[1] }, merge);
    } else {
      ok = await sbSetDocument(p, data, merge);
    }
    if (ok) return;
  }

  if (db) {
    await fsSetDoc(fsDoc(db, p), data, opts ? opts : {});
  }
}

export async function sbBridgeUpdateDoc(docRef: SbDocRef, patch: Record<string, any>): Promise<void> {
  await sbBridgeSetDoc(docRef, patch, { merge: true });
}

export async function sbBridgeDeleteDoc(docRef: SbDocRef): Promise<void> {
  const p = docRef.path;
  const parts = p.split('/');

  if (await isSupabaseSchemaReady()) {
    let ok = false;
    if (parts.length === 2 && parts[0] === 'schools') {
      ok = await sbDeleteSchool(parts[1]);
    } else if (parts.length === 2 && parts[0] === 'users') {
      ok = await sbDeleteUser(parts[1]);
    } else {
      ok = await sbDeleteDocument(p);
    }
    if (ok) return;
  }

  if (db) {
    await fsDeleteDoc(fsDoc(db, p));
  }
}

export function sbBridgeWriteBatch(_dbInstance?: any) {
  const sets: Array<{ path: string; data: Record<string, any> }> = [];
  const deletes: string[] = [];
  const rawOps: Array<{ type: 'set' | 'delete'; path: string; data?: any; opts?: any }> = [];

  return {
    set(docRef: SbDocRef, data: Record<string, any>, opts?: { merge?: boolean }) {
      markPathNonEmpty(docRef.path);
      sets.push({ path: docRef.path, data });
      rawOps.push({ type: 'set', path: docRef.path, data, opts });
    },
    update(docRef: SbDocRef, data: Record<string, any>) {
      markPathNonEmpty(docRef.path);
      sets.push({ path: docRef.path, data });
      rawOps.push({ type: 'set', path: docRef.path, data, opts: { merge: true } });
    },
    delete(docRef: SbDocRef) {
      deletes.push(docRef.path);
      rawOps.push({ type: 'delete', path: docRef.path });
    },
    async commit() {
      if (await isSupabaseSchemaReady()) {
        const [setOk, delOk] = await Promise.all([
          sets.length > 0 ? sbBatchSetDocuments(sets) : Promise.resolve(true),
          deletes.length > 0 ? sbBatchDeleteDocuments(deletes) : Promise.resolve(true),
        ]);
        if (setOk && delOk) return;
      }
      if (db) {
        const fbBatch = fsWriteBatch(db);
        for (const op of rawOps) {
          if (op.type === 'set') fbBatch.set(fsDoc(db, op.path), op.data, op.opts || { merge: true });
          else fbBatch.delete(fsDoc(db, op.path));
        }
        await fbBatch.commit();
      }
    },
  };
}

export function sbBridgeOnSnapshot(
  target: SbDocRef | SbColRef,
  onNext: (snap: any) => void,
  onError?: (err: any) => void
): () => void {
  let disposed = false;
  let unsubRt = () => {};
  let unsubFs = () => {};

  const emitOnce = async () => {
    if (disposed) return;
    try {
      const snap =
        target.__sbType === 'doc'
          ? await sbBridgeGetDoc(target)
          : await sbBridgeGetDocs(target);
      if (!disposed) onNext(snap);
    } catch (err) {
      if (!disposed) onError?.(err);
    }
  };

  void isSupabaseSchemaReady().then((ready) => {
    if (disposed) return;
    if (ready) {
      void emitOnce();
      if (target.__sbType === 'doc') {
        const parts = target.path.split('/');
        if (parts.length === 2 && parts[0] === 'schools') {
          unsubRt = sbSubscribeSchools(() => void emitOnce(), parts[1]);
        } else {
          unsubRt = sbSubscribeDocument(target.path, () => void emitOnce());
        }
      } else if (target.path === 'schools') {
        unsubRt = sbSubscribeSchools(() => void emitOnce());
      } else {
        unsubRt = sbSubscribeCollection(target.path, () => void emitOnce());
      }
    } else if (db) {
      try {
        const fbTarget =
          target.__sbType === 'doc' ? fsDoc(db, target.path) : toFsColOrQuery(target);
        unsubFs = fsOnSnapshot(fbTarget as any, onNext, onError);
      } catch (err) {
        onError?.(err);
      }
    }
  });

  return () => {
    disposed = true;
    try { unsubRt(); } catch {}
    try { unsubFs(); } catch {}
  };
}
