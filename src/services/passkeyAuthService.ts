import type { User } from '../types';

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

function getAndroidBridge(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).LifeMakerAndroid || null;
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

export function listSavedPasskeyAccounts(): PasskeySavedAccount[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASSKEY_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.key === 'string' &&
        typeof item.bindingToken === 'string' &&
        item.userSnapshot &&
        typeof item.userSnapshot === 'object'
    );
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

export function removeSavedPasskeyAccount(accountKey: string): void {
  const cleanKey = String(accountKey || '').trim().toLowerCase();
  if (!cleanKey) return;
  const next = listSavedPasskeyAccounts().filter((a) => a.key.toLowerCase() !== cleanKey);
  writeSavedPasskeyAccounts(next);
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

export function updateSavedPasskeySnapshot(user: Record<string, any>): void {
  const existing = findSavedPasskeyForAccount(user);
  if (!existing) return;
  const sanitized = sanitizeUserSnapshot(user);
  const all = listSavedPasskeyAccounts().map((item) =>
    item.key === existing.key
      ? {
          ...item,
          name: String(sanitized.name || item.name),
          email: sanitized.email || item.email,
          mobile: sanitized.mobile || sanitized.phone || item.mobile,
          role: sanitized.role || item.role,
          schoolId: sanitized.schoolId || item.schoolId,
          schoolName: sanitized.schoolName || item.schoolName,
          avatar: sanitized.avatar || sanitized.photoUrl || item.avatar,
          userSnapshot: { ...item.userSnapshot, ...sanitized },
        }
      : item
  );
  writeSavedPasskeyAccounts(all);
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

async function createWebAuthnCredential(user: Record<string, any>): Promise<string> {
  const encoder = new TextEncoder();
  const userHandle = encoder.encode(String(user.uid || user.id || user.email || 'school_user').slice(0, 64));
  const accountLabel = String(user.email || user.mobile || user.displayId || user.name || 'SCHOOL+ User');
  const displayName = String(user.name || accountLabel);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: createChallengeBytes() as BufferSource,
      rp: {
        name: 'SCHOOL+',
      },
      user: {
        id: userHandle as BufferSource,
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
        residentKey: 'preferred',
      },
      timeout: 45000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential || !credential.rawId) {
    throw new Error('Device passkey registration cancel ho gaya.');
  }
  return bufferToBase64Url(credential.rawId);
}

async function verifyWebAuthnCredential(credentialId?: string): Promise<boolean> {
  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = credentialId
    ? [{ id: base64UrlToUint8Array(credentialId) as BufferSource, type: 'public-key' }]
    : undefined;

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: createChallengeBytes() as BufferSource,
      ...(allowCredentials ? { allowCredentials } : {}),
      userVerification: 'required',
      timeout: 45000,
    },
  })) as PublicKeyCredential | null;

  return Boolean(assertion && assertion.rawId);
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

  try {
    if (caps.hasAndroidBiometric) {
      const ok = await verifyNativeAndroidBiometric(`Enable Passkey · ${user.name || 'SCHOOL+'}`);
      if (!ok) {
        return { ok: false, error: 'Fingerprint / Face verification cancel ya fail hua.' };
      }
      method = 'android_biometric';
    } else {
      credentialId = await createWebAuthnCredential(user as Record<string, any>);
      method = 'webauthn';
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
    if (caps.hasAndroidBiometric) {
      verified = await verifyNativeAndroidBiometric(promptTitle || `Unlock · ${entry.name}`);
    } else if (caps.hasWebAuthn) {
      verified = await verifyWebAuthnCredential(entry.credentialId);
    }

    if (!verified) {
      return {
        ok: false,
        error: 'Fingerprint / Face Lock verify nahi hua. Dobara try karein.',
      };
    }

    const updatedEntry: PasskeySavedAccount = {
      ...entry,
      lastUsedAt: new Date().toISOString(),
    };
    const nextList = [
      updatedEntry,
      ...listSavedPasskeyAccounts().filter((item) => item.key.toLowerCase() !== entry.key.toLowerCase()),
    ];
    writeSavedPasskeyAccounts(nextList);

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
