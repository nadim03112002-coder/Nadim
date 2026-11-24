import type { User } from '../types';
import { sbDeleteDocument, sbGetDocument, sbSetDocument } from './supabaseDbAdapter';

export interface PasskeySavedAccount {
  key: string;
  userId: string;
  uid: string;
  displayId?: string;
  name: string;
  email?: string;
  mobile?: string;
  role?: string;
  userType?: string;
  schoolId?: string;
  schoolName?: string;
  avatar?: string;
  credentialId?: string;
  userHandleB64?: string;
  deviceId?: string;
  bindingToken: string;
  method: 'android_biometric' | 'webauthn';
  enrolledAt: string;
  lastUsedAt?: string;
  userSnapshot: Record<string, any>;
}

export interface PasskeyCapabilities {
  supported: boolean;
  hasAndroidBiometric: boolean;
  hasWebAuthn: boolean;
  label: string;
}

const PASSKEY_ACCOUNTS_KEY = 'nst_passkey_accounts_v1';
const PERSISTENT_DEVICE_ID_KEY = 'nst_persistent_device_id';

let lastCloudSyncAt = 0;
let inFlightCloudSync: Promise<PasskeySavedAccount[]> | null = null;

function getAndroidBridge(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).LifeMakerAndroid || null;
}

export function getPersistentDeviceId(): string {
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.getPersistentDeviceId === 'function') {
    try {
      const nativeId = String(bridge.getPersistentDeviceId() || '').trim();
      if (nativeId) {
        try {
          localStorage.setItem(PERSISTENT_DEVICE_ID_KEY, nativeId);
        } catch {}
        return nativeId;
      }
    } catch {}
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const stored = String(localStorage.getItem(PERSISTENT_DEVICE_ID_KEY) || '').trim();
      if (stored) return stored;
      const generated =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `web_${crypto.randomUUID().replace(/-/g, '')}`
          : `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(PERSISTENT_DEVICE_ID_KEY, generated);
      return generated;
    } catch {}
  }

  return '';
}

export function getPasskeyCapabilities(): PasskeyCapabilities {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      hasAndroidBiometric: false,
      hasWebAuthn: false,
      label: 'Passkey',
    };
  }

  const bridge = getAndroidBridge();
  const hasAndroidBiometric = Boolean(bridge && typeof bridge.authenticateBiometric === 'function');
  const hasWebAuthn = Boolean(
    typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function' &&
      window.isSecureContext
  );

  return {
    supported: hasAndroidBiometric || hasWebAuthn,
    hasAndroidBiometric,
    hasWebAuthn,
    label: hasAndroidBiometric
      ? 'Fingerprint / Mobile Face Lock'
      : hasWebAuthn
      ? 'Device Passkey (Biometric)'
      : 'Passkey',
  };
}

function sanitizeUserSnapshot(user: Record<string, any>): Record<string, any> {
  const clone: Record<string, any> = { ...user };
  delete clone.password;
  delete clone.recoveryPassword;
  return clone;
}

function buildAccountKey(user: Record<string, any>): string {
  const raw = String(
    user.uid || user.id || user.email || user.mobile || user.displayId || 'user'
  )
    .trim()
    .toLowerCase();
  return raw;
}

function encodeCloudKey(raw: string): string {
  const clean = String(raw || '').trim();
  if (!clean) return 'empty';
  try {
    const bytes = new TextEncoder().encode(clean);
    return `k_${bufferToBase64Url(bytes)}`;
  } catch {
    return `k_${clean.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }
}

function encodeCredKey(credentialId: string): string {
  const clean = String(credentialId || '').trim();
  if (!clean) return '';
  if (/^[A-Za-z0-9_-]{8,256}$/.test(clean)) {
    return `c_${clean}`;
  }
  return encodeCloudKey(clean);
}

function generateBindingToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `pk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function bufferToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function createChallengeBytes(): Uint8Array {
  const challenge = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(challenge);
  } else {
    for (let i = 0; i < challenge.length; i++) {
      challenge[i] = Math.floor(Math.random() * 256);
    }
  }
  return challenge;
}

function getValidRpHost(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = String(window.location.hostname || '').trim().toLowerCase();
  if (!host) return undefined;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return undefined;
  return host;
}

function isValidPasskeyEntry(item: any): item is PasskeySavedAccount {
  return Boolean(
    item &&
      typeof item === 'object' &&
      typeof item.key === 'string' &&
      typeof item.bindingToken === 'string' &&
      item.userSnapshot &&
      typeof item.userSnapshot === 'object'
  );
}

export function listSavedPasskeyAccounts(): PasskeySavedAccount[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASSKEY_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPasskeyEntry);
  } catch {
    return [];
  }
}

function writeSavedPasskeyAccounts(list: PasskeySavedAccount[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PASSKEY_ACCOUNTS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {}
}

function mergePasskeyLists(
  primary: PasskeySavedAccount[],
  secondary: PasskeySavedAccount[]
): PasskeySavedAccount[] {
  const map = new Map<string, PasskeySavedAccount>();
  for (const item of [...secondary, ...primary]) {
    if (!isValidPasskeyEntry(item)) continue;
    const normKey = item.key.trim().toLowerCase();
    const existing = map.get(normKey);
    if (!existing) {
      map.set(normKey, item);
      continue;
    }
    const existingTs = Date.parse(existing.lastUsedAt || existing.enrolledAt || '') || 0;
    const incomingTs = Date.parse(item.lastUsedAt || item.enrolledAt || '') || 0;
    const newer = incomingTs >= existingTs ? item : existing;
    const older = incomingTs >= existingTs ? existing : item;
    map.set(normKey, {
      ...older,
      ...newer,
      credentialId: newer.credentialId || older.credentialId,
      userHandleB64: newer.userHandleB64 || older.userHandleB64,
      deviceId: newer.deviceId || older.deviceId,
      userSnapshot: { ...older.userSnapshot, ...newer.userSnapshot },
    });
  }
  return Array.from(map.values())
    .sort((a, b) => {
      const tb = Date.parse(b.lastUsedAt || b.enrolledAt || '') || 0;
      const ta = Date.parse(a.lastUsedAt || a.enrolledAt || '') || 0;
      return tb - ta;
    })
    .slice(0, 12);
}

function buildCompactCloudEntry(entry: PasskeySavedAccount): PasskeySavedAccount {
  return {
    ...entry,
    userSnapshot: sanitizeUserSnapshot(entry.userSnapshot || {}),
  };
}

function buildUserLookupCandidates(userOrEntry: Record<string, any>): string[] {
  return Array.from(
    new Set(
      [
        userOrEntry.key,
        userOrEntry.uid,
        userOrEntry.userId,
        userOrEntry.id,
        userOrEntry.email,
        userOrEntry.mobile,
        userOrEntry.phone,
        userOrEntry.displayId,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase())
    )
  );
}

async function savePasskeyEntryToCloud(entry: PasskeySavedAccount): Promise<void> {
  const cleanEntry = buildCompactCloudEntry(entry);
  const nowIso = new Date().toISOString();
  const deviceId = cleanEntry.deviceId || getPersistentDeviceId();
  const tasks: Array<Promise<any>> = [];

  if (cleanEntry.credentialId) {
    const credKey = encodeCredKey(cleanEntry.credentialId);
    if (credKey) {
      tasks.push(
        sbSetDocument(
          `passkeys_cred/${credKey}`,
          {
            credentialId: cleanEntry.credentialId,
            userHandleB64: cleanEntry.userHandleB64 || '',
            entry: cleanEntry,
            updatedAt: nowIso,
          },
          false
        )
      );
    }
  }

  if (deviceId) {
    const devPath = `passkeys_device/${encodeCloudKey(deviceId)}`;
    const accountFieldKey = encodeCloudKey(cleanEntry.key.toLowerCase());
    tasks.push(
      (async () => {
        const existingDev = await sbGetDocument<{ accounts?: Record<string, PasskeySavedAccount> }>(devPath);
        const accounts = { ...(existingDev?.accounts || {}) };
        accounts[accountFieldKey] = { ...cleanEntry, deviceId };
        await sbSetDocument(
          devPath,
          {
            deviceId,
            accounts,
            updatedAt: nowIso,
          },
          false
        );
      })()
    );
  }

  const userCandidates = buildUserLookupCandidates({
    ...cleanEntry,
    ...(cleanEntry.userSnapshot || {}),
  });
  for (const cand of userCandidates.slice(0, 5)) {
    const userPath = `passkeys_user/${encodeCloudKey(cand)}`;
    tasks.push(
      (async () => {
        const existingUser = await sbGetDocument<Record<string, any>>(userPath);
        const credIds = Array.from(
          new Set([...(existingUser?.credentialIds || []), ...(cleanEntry.credentialId ? [cleanEntry.credentialId] : [])])
        );
        const devIds = Array.from(
          new Set([...(existingUser?.deviceIds || []), ...(deviceId ? [deviceId] : [])])
        );
        await sbSetDocument(
          userPath,
          {
            accountKey: cleanEntry.key,
            userId: cleanEntry.userId,
            uid: cleanEntry.uid,
            credentialIds: credIds,
            deviceIds: devIds,
            latestEntry: cleanEntry,
            updatedAt: nowIso,
          },
          false
        );
      })()
    );
  }

  await Promise.allSettled(tasks);
}

async function removePasskeyEntryFromCloud(
  accountKey: string,
  entry?: PasskeySavedAccount | null
): Promise<void> {
  const cleanKey = String(accountKey || '').trim().toLowerCase();
  if (!cleanKey) return;
  const deviceId = entry?.deviceId || getPersistentDeviceId();
  const tasks: Array<Promise<any>> = [];

  if (entry?.credentialId) {
    const credKey = encodeCredKey(entry.credentialId);
    if (credKey) {
      tasks.push(sbDeleteDocument(`passkeys_cred/${credKey}`));
    }
  }

  if (deviceId) {
    const devPath = `passkeys_device/${encodeCloudKey(deviceId)}`;
    const accountFieldKey = encodeCloudKey(cleanKey);
    tasks.push(
      (async () => {
        const existingDev = await sbGetDocument<{ accounts?: Record<string, PasskeySavedAccount> }>(devPath);
        if (!existingDev?.accounts) return;
        const nextAccounts = { ...existingDev.accounts };
        delete nextAccounts[accountFieldKey];
        if (Object.keys(nextAccounts).length === 0) {
          await sbDeleteDocument(devPath);
        } else {
          await sbSetDocument(
            devPath,
            {
              deviceId,
              accounts: nextAccounts,
              updatedAt: new Date().toISOString(),
            },
            false
          );
        }
      })()
    );
  }

  if (entry) {
    const userCandidates = buildUserLookupCandidates({
      ...entry,
      ...(entry.userSnapshot || {}),
    });
    for (const cand of userCandidates.slice(0, 5)) {
      tasks.push(sbDeleteDocument(`passkeys_user/${encodeCloudKey(cand)}`));
    }
  } else {
    tasks.push(sbDeleteDocument(`passkeys_user/${encodeCloudKey(cleanKey)}`));
  }

  await Promise.allSettled(tasks);
}

export async function syncPasskeysFromCloud(force = false): Promise<PasskeySavedAccount[]> {
  const localList = listSavedPasskeyAccounts();
  const now = Date.now();
  if (!force && now - lastCloudSyncAt < 8000 && localList.length > 0) {
    return localList;
  }
  if (inFlightCloudSync) return inFlightCloudSync;

  inFlightCloudSync = (async () => {
    try {
      const deviceId = getPersistentDeviceId();
      if (!deviceId) return localList;

      const devDoc = await sbGetDocument<{ accounts?: Record<string, PasskeySavedAccount> }>(
        `passkeys_device/${encodeCloudKey(deviceId)}`
      );
      const cloudEntries = devDoc?.accounts
        ? Object.values(devDoc.accounts).filter(isValidPasskeyEntry)
        : [];

      const merged = mergePasskeyLists(localList, cloudEntries);
      if (merged.length > 0) {
        writeSavedPasskeyAccounts(merged);
      }

      // Backfill any pre-existing local entries into Cloud so Clear Data won't lose them
      const cloudKeySet = new Set(cloudEntries.map((c) => c.key.trim().toLowerCase()));
      const unbackedLocal = localList.filter((item) => !cloudKeySet.has(item.key.trim().toLowerCase()));
      if (unbackedLocal.length > 0) {
        for (const item of unbackedLocal) {
          void savePasskeyEntryToCloud({ ...item, deviceId: item.deviceId || deviceId });
        }
      }

      lastCloudSyncAt = Date.now();
      return merged;
    } catch {
      return localList;
    } finally {
      inFlightCloudSync = null;
    }
  })();

  return inFlightCloudSync;
}

export function removeSavedPasskeyAccount(accountKey: string, entry?: PasskeySavedAccount | null): void {
  const cleanKey = String(accountKey || '').trim().toLowerCase();
  if (!cleanKey) return;
  const existing = entry || listSavedPasskeyAccounts().find((a) => a.key.toLowerCase() === cleanKey) || null;
  const next = listSavedPasskeyAccounts().filter((a) => a.key.toLowerCase() !== cleanKey);
  writeSavedPasskeyAccounts(next);
  void removePasskeyEntryFromCloud(cleanKey, existing);
}

export function findSavedPasskeyForAccount(
  userOrQuery: string | Record<string, any> | null | undefined
): PasskeySavedAccount | null {
  if (!userOrQuery) return null;
  const saved = listSavedPasskeyAccounts();
  if (saved.length === 0) return null;

  if (typeof userOrQuery === 'string') {
    const q = userOrQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    if (!q) return null;
    return (
      saved.find((entry) => {
        const snap = entry.userSnapshot || {};
        const candidates = [
          entry.key,
          entry.userId,
          entry.uid,
          entry.displayId,
          entry.email,
          snap.id,
          snap.uid,
          snap.displayId,
          snap.email,
          snap.admissionNo,
          snap.studentId,
        ]
          .filter(Boolean)
          .map((v) => String(v).trim().toLowerCase());
        if (candidates.includes(q)) return true;

        if (digits.length >= 10) {
          const mob = String(entry.mobile || snap.mobile || snap.phone || '').replace(/\D/g, '');
          if (mob.length >= 10 && mob.endsWith(digits.slice(-10))) return true;
        }
        return false;
      }) || null
    );
  }

  const targetIds = new Set(
    [
      buildAccountKey(userOrQuery),
      userOrQuery.id,
      userOrQuery.uid,
      userOrQuery.displayId,
      userOrQuery.email,
      userOrQuery.studentId,
      userOrQuery.admissionNo,
    ]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase())
  );
  const targetDigits = String(userOrQuery.mobile || userOrQuery.phone || '').replace(/\D/g, '');

  return (
    saved.find((entry) => {
      const snap = entry.userSnapshot || {};
      const entryIds = [
        entry.key,
        entry.userId,
        entry.uid,
        entry.displayId,
        entry.email,
        snap.id,
        snap.uid,
        snap.displayId,
        snap.email,
        snap.studentId,
        snap.admissionNo,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase());

      if (entryIds.some((id) => targetIds.has(id))) return true;

      if (targetDigits.length >= 10) {
        const mob = String(entry.mobile || snap.mobile || snap.phone || '').replace(/\D/g, '');
        if (mob.length >= 10 && mob.endsWith(targetDigits.slice(-10))) return true;
      }
      return false;
    }) || null
  );
}

export async function findCloudPasskeyForAccount(
  userOrQuery: string | Record<string, any> | null | undefined
): Promise<PasskeySavedAccount | null> {
  const localMatch = findSavedPasskeyForAccount(userOrQuery);
  if (localMatch) return localMatch;

  await syncPasskeysFromCloud(true);
  const syncedMatch = findSavedPasskeyForAccount(userOrQuery);
  if (syncedMatch) return syncedMatch;

  if (!userOrQuery) return null;
  const candidates =
    typeof userOrQuery === 'string'
      ? [userOrQuery.trim().toLowerCase()]
      : buildUserLookupCandidates(userOrQuery);

  for (const cand of candidates.slice(0, 5)) {
    const doc = await sbGetDocument<{ latestEntry?: PasskeySavedAccount }>(
      `passkeys_user/${encodeCloudKey(cand)}`
    );
    const latest = doc?.latestEntry;
    if (latest && isValidPasskeyEntry(latest)) {
      const currentDeviceId = getPersistentDeviceId();
      if (
        latest.method === 'webauthn' ||
        (latest.deviceId && currentDeviceId && latest.deviceId === currentDeviceId)
      ) {
        const nextList = mergePasskeyLists([latest], listSavedPasskeyAccounts());
        writeSavedPasskeyAccounts(nextList);
        return latest;
      }
    }
  }
  return null;
}

export function updateSavedPasskeySnapshot(user: Record<string, any>): void {
  const existing = findSavedPasskeyForAccount(user);
  if (!existing) return;
  const sanitized = sanitizeUserSnapshot(user);
  const updatedItem: PasskeySavedAccount = {
    ...existing,
    name: String(sanitized.name || existing.name),
    email: sanitized.email || existing.email,
    mobile: sanitized.mobile || sanitized.phone || existing.mobile,
    role: sanitized.role || existing.role,
    schoolId: sanitized.schoolId || existing.schoolId,
    schoolName: sanitized.schoolName || existing.schoolName,
    avatar: sanitized.avatar || sanitized.photoUrl || existing.avatar,
    userSnapshot: { ...existing.userSnapshot, ...sanitized },
  };
  const all = listSavedPasskeyAccounts().map((item) =>
    item.key === existing.key ? updatedItem : item
  );
  writeSavedPasskeyAccounts(all);
  void savePasskeyEntryToCloud(updatedItem);
}

export async function verifyNativeAndroidBiometric(promptTitle = 'SCHOOL+ Passkey'): Promise<boolean> {
  const bridge = getAndroidBridge();
  if (!bridge || typeof bridge.authenticateBiometric !== 'function') {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const cbName = `__nstaPasskeyCb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;

    const cleanup = () => {
      try {
        delete (window as any)[cbName];
      } catch {
        (window as any)[cbName] = undefined;
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(false);
    }, 45000);

    (window as any)[cbName] = (success: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(Boolean(success));
    };

    try {
      bridge.authenticateBiometric(promptTitle, cbName);
    } catch {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        resolve(false);
      }
    }
  });
}

async function createWebAuthnCredential(
  user: Record<string, any>
): Promise<{ credentialId: string; userHandleB64: string }> {
  const encoder = new TextEncoder();
  const rawUid = String(user.uid || user.id || user.email || user.mobile || 'school_user')
    .trim()
    .slice(0, 64);
  const userHandleBytes = encoder.encode(rawUid).slice(0, 64);
  const userHandleB64 = bufferToBase64Url(userHandleBytes);
  const accountLabel = String(user.email || user.mobile || user.displayId || user.name || 'SCHOOL+ User');
  const displayName = String(user.name || accountLabel);
  const rpHost = getValidRpHost();
  const rp: PublicKeyCredentialRpEntity = rpHost
    ? { id: rpHost, name: 'SCHOOL+' }
    : { name: 'SCHOOL+' };

  const attemptCreate = async (requireResident: boolean): Promise<PublicKeyCredential | null> => {
    return (await navigator.credentials.create({
      publicKey: {
        challenge: createChallengeBytes() as BufferSource,
        rp,
        user: {
          id: userHandleBytes as BufferSource,
          name: accountLabel,
          displayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: requireResident ? 'required' : 'preferred',
          ...(requireResident ? { requireResidentKey: true } : {}),
        },
        timeout: 45000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
  };

  let credential: PublicKeyCredential | null = null;
  try {
    credential = await attemptCreate(true);
  } catch (err: any) {
    const msg = String(err?.message || err?.name || '');
    if (/notallowed|abort|cancel/i.test(msg)) {
      throw err;
    }
    credential = await attemptCreate(false);
  }

  if (!credential || !credential.rawId) {
    throw new Error('Device passkey registration cancel ho gaya.');
  }

  return {
    credentialId: bufferToBase64Url(credential.rawId),
    userHandleB64,
  };
}

async function verifyWebAuthnCredential(
  credentialId?: string
): Promise<{ verified: boolean; credentialId?: string; userHandleStr?: string }> {
  const rpId = getValidRpHost();
  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = credentialId
    ? [
        {
          id: base64UrlToUint8Array(credentialId) as BufferSource,
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        },
      ]
    : undefined;

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: createChallengeBytes() as BufferSource,
      ...(rpId ? { rpId } : {}),
      ...(allowCredentials ? { allowCredentials } : {}),
      userVerification: 'required',
      timeout: 45000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion || !assertion.rawId) {
    return { verified: false };
  }

  const assertionResp = assertion.response as AuthenticatorAssertionResponse | undefined;
  let userHandleStr = '';
  if (assertionResp?.userHandle) {
    try {
      userHandleStr = new TextDecoder().decode(assertionResp.userHandle).trim();
    } catch {}
  }

  return {
    verified: true,
    credentialId: bufferToBase64Url(assertion.rawId),
    userHandleStr,
  };
}

export async function enrollPasskeyForUser(
  user: User | Record<string, any>
): Promise<{ ok: boolean; entry?: PasskeySavedAccount; error?: string }> {
  const caps = getPasskeyCapabilities();
  if (!caps.supported) {
    return {
      ok: false,
      error: 'Is device ya browser par Fingerprint / Passkey support uplabdh nahi hai.',
    };
  }

  let method: 'android_biometric' | 'webauthn' = caps.hasAndroidBiometric ? 'android_biometric' : 'webauthn';
  let credentialId: string | undefined;
  let userHandleB64: string | undefined;

  try {
    if (caps.hasAndroidBiometric) {
      const ok = await verifyNativeAndroidBiometric(`Enable Passkey · ${user.name || 'SCHOOL+'}`);
      if (!ok) {
        return { ok: false, error: 'Fingerprint / Face verification cancel ya fail hua.' };
      }
      method = 'android_biometric';
    } else {
      const created = await createWebAuthnCredential(user as Record<string, any>);
      credentialId = created.credentialId;
      userHandleB64 = created.userHandleB64;
      method = 'webauthn';
      try {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
          void navigator.storage.persist().catch(() => false);
        }
      } catch {}
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/notallowed|abort|cancel/i.test(msg)) {
      return { ok: false, error: 'Passkey verification cancel kar diya gaya.' };
    }
    return {
      ok: false,
      error: msg || 'Device par Passkey / Biometric set nahi ho saka.',
    };
  }

  const sanitized = sanitizeUserSnapshot(user as Record<string, any>);
  const key = buildAccountKey(sanitized);
  const existing = findSavedPasskeyForAccount(sanitized);
  const deviceId = getPersistentDeviceId();

  const entry: PasskeySavedAccount = {
    key,
    userId: String(sanitized.id || sanitized.uid || key),
    uid: String(sanitized.uid || sanitized.id || key),
    displayId: sanitized.displayId ? String(sanitized.displayId) : undefined,
    name: String(sanitized.name || 'User'),
    email: sanitized.email ? String(sanitized.email) : undefined,
    mobile: sanitized.mobile || sanitized.phone ? String(sanitized.mobile || sanitized.phone) : undefined,
    role: sanitized.role ? String(sanitized.role) : undefined,
    userType: sanitized.userType ? String(sanitized.userType) : undefined,
    schoolId: sanitized.schoolId ? String(sanitized.schoolId) : undefined,
    schoolName: sanitized.schoolName ? String(sanitized.schoolName) : undefined,
    avatar: sanitized.avatar || sanitized.photoUrl ? String(sanitized.avatar || sanitized.photoUrl) : undefined,
    credentialId: credentialId || existing?.credentialId,
    userHandleB64: userHandleB64 || existing?.userHandleB64,
    deviceId: deviceId || existing?.deviceId,
    bindingToken: existing?.bindingToken || generateBindingToken(),
    method,
    enrolledAt: existing?.enrolledAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    userSnapshot: sanitized,
  };

  const currentList = listSavedPasskeyAccounts().filter(
    (item) => item.key.toLowerCase() !== key && (!existing || item.key.toLowerCase() !== existing.key.toLowerCase())
  );
  writeSavedPasskeyAccounts([entry, ...currentList]);

  try {
    await Promise.race([
      savePasskeyEntryToCloud(entry),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {}

  return { ok: true, entry };
}

export async function authenticateWithPasskey(
  entry: PasskeySavedAccount,
  promptTitle?: string
): Promise<{ ok: boolean; user?: Record<string, any>; error?: string }> {
  const caps = getPasskeyCapabilities();
  if (!caps.supported) {
    return {
      ok: false,
      error: 'Is device par Fingerprint / Passkey uplabdh nahi hai.',
    };
  }

  try {
    let verified = false;
    let verifiedCredentialId = entry.credentialId;
    if (caps.hasAndroidBiometric) {
      verified = await verifyNativeAndroidBiometric(promptTitle || `Unlock · ${entry.name}`);
    } else if (caps.hasWebAuthn) {
      const res = await verifyWebAuthnCredential(entry.credentialId);
      verified = res.verified;
      if (res.credentialId) verifiedCredentialId = res.credentialId;
    }

    if (!verified) {
      return {
        ok: false,
        error: 'Fingerprint / Face Lock verify nahi hua. Dobara try karein.',
      };
    }

    const updatedEntry: PasskeySavedAccount = {
      ...entry,
      credentialId: verifiedCredentialId,
      deviceId: getPersistentDeviceId() || entry.deviceId,
      lastUsedAt: new Date().toISOString(),
    };
    const nextList = [
      updatedEntry,
      ...listSavedPasskeyAccounts().filter((item) => item.key.toLowerCase() !== entry.key.toLowerCase()),
    ];
    writeSavedPasskeyAccounts(nextList);
    void savePasskeyEntryToCloud(updatedEntry);

    return {
      ok: true,
      user: { ...entry.userSnapshot },
    };
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/notallowed|abort|cancel/i.test(msg)) {
      return { ok: false, error: 'Passkey verification cancel kiya gaya.' };
    }
    return {
      ok: false,
      error: msg || 'Passkey verification fail hua.',
    };
  }
}

export async function authenticateWithDiscoverableWebAuthn(): Promise<{
  ok: boolean;
  entry?: PasskeySavedAccount;
  user?: Record<string, any>;
  resolvedUid?: string;
  credentialId?: string;
  error?: string;
}> {
  const caps = getPasskeyCapabilities();
  if (!caps.hasWebAuthn) {
    return {
      ok: false,
      error: 'Is browser par Device Passkey uplabdh nahi hai.',
    };
  }

  try {
    const res = await verifyWebAuthnCredential(undefined);
    if (!res.verified || !res.credentialId) {
      return {
        ok: false,
        error: 'Koi saved Passkey select ya verify nahi hua.',
      };
    }

    const credKey = encodeCredKey(res.credentialId);
    let matchedEntry: PasskeySavedAccount | null = null;

    if (credKey) {
      const credDoc = await sbGetDocument<{ entry?: PasskeySavedAccount }>(`passkeys_cred/${credKey}`);
      if (credDoc?.entry && isValidPasskeyEntry(credDoc.entry)) {
        matchedEntry = credDoc.entry;
      }
    }

    if (!matchedEntry && res.userHandleStr) {
      const userDoc = await sbGetDocument<{ latestEntry?: PasskeySavedAccount }>(
        `passkeys_user/${encodeCloudKey(res.userHandleStr.toLowerCase())}`
      );
      if (userDoc?.latestEntry && isValidPasskeyEntry(userDoc.latestEntry)) {
        matchedEntry = userDoc.latestEntry;
      }
    }

    if (matchedEntry) {
      const restoredEntry: PasskeySavedAccount = {
        ...matchedEntry,
        credentialId: res.credentialId,
        deviceId: getPersistentDeviceId() || matchedEntry.deviceId,
        lastUsedAt: new Date().toISOString(),
      };
      const merged = mergePasskeyLists([restoredEntry], listSavedPasskeyAccounts());
      writeSavedPasskeyAccounts(merged);
      void savePasskeyEntryToCloud(restoredEntry);
      return {
        ok: true,
        entry: restoredEntry,
        user: { ...restoredEntry.userSnapshot },
        credentialId: res.credentialId,
      };
    }

    if (res.userHandleStr) {
      return {
        ok: true,
        resolvedUid: res.userHandleStr,
        credentialId: res.credentialId,
      };
    }

    return {
      ok: false,
      error: 'Is Passkey se juda account record nahi mila. Ek baar ID & Password se link karein.',
    };
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/notallowed|abort|cancel/i.test(msg)) {
      return { ok: false, error: 'Passkey verification cancel kiya gaya.' };
    }
    return {
      ok: false,
      error: msg || 'Saved Passkey se unlock nahi ho saka.',
    };
  }
}

export async function persistRestoredWebAuthnEntry(
  user: Record<string, any>,
  credentialId: string
): Promise<PasskeySavedAccount> {
  const sanitized = sanitizeUserSnapshot(user);
  const key = buildAccountKey(sanitized);
  const entry: PasskeySavedAccount = {
    key,
    userId: String(sanitized.id || sanitized.uid || key),
    uid: String(sanitized.uid || sanitized.id || key),
    displayId: sanitized.displayId ? String(sanitized.displayId) : undefined,
    name: String(sanitized.name || 'User'),
    email: sanitized.email ? String(sanitized.email) : undefined,
    mobile: sanitized.mobile || sanitized.phone ? String(sanitized.mobile || sanitized.phone) : undefined,
    role: sanitized.role ? String(sanitized.role) : undefined,
    userType: sanitized.userType ? String(sanitized.userType) : undefined,
    schoolId: sanitized.schoolId ? String(sanitized.schoolId) : undefined,
    schoolName: sanitized.schoolName ? String(sanitized.schoolName) : undefined,
    avatar: sanitized.avatar || sanitized.photoUrl ? String(sanitized.avatar || sanitized.photoUrl) : undefined,
    credentialId,
    deviceId: getPersistentDeviceId() || undefined,
    bindingToken: generateBindingToken(),
    method: 'webauthn',
    enrolledAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    userSnapshot: sanitized,
  };
  const merged = mergePasskeyLists([entry], listSavedPasskeyAccounts());
  writeSavedPasskeyAccounts(merged);
  void savePasskeyEntryToCloud(entry);
  return entry;
}
