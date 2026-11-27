export interface AndroidDeviceAdminStatus {
  isNativeApp: boolean;
  supported: boolean;
  isAdminActive: boolean;
  isDeviceOwner: boolean;
  isUninstallBlocked: boolean;
  isAccessibilityGuardEnabled: boolean;
  isAccessibilityGuardLocked: boolean;
  uninstallPinRequired: boolean;
  hasNativeAdminPin: boolean;
  tempUnlockRemainingSec: number;
  enabledAt: number;
  packageName: string;
  receiverComponent: string;
  shortReceiverComponent: string;
  adbDeviceOwnerCommand: string;
}

interface LifeMakerDeviceAdminBridge {
  isNativeApp?: () => boolean;
  getDeviceAdminStatus?: () => string;
  isDeviceAdminActive?: () => boolean;
  isDeviceOwnerApp?: () => boolean;
  requestDeviceAdmin?: () => boolean;
  deactivateDeviceAdmin?: () => boolean;
  openDeviceAdminSettings?: () => void;
  setUninstallBlocked?: (blocked: boolean) => boolean;
  lockDeviceScreen?: () => boolean;
  isAccessibilityGuardEnabled?: () => boolean;
  openAccessibilityGuardSettings?: () => void;
  setAccessibilityGuardLocked?: (locked: boolean) => boolean;
  setUninstallPinRequired?: (required: boolean) => boolean;
  isUninstallPinRequired?: () => boolean;
  unlockUninstallProtectionTemporarily?: (seconds: number) => boolean;
  syncAdminPinHash?: (pinHash: string) => void;
  hasNativeAdminPin?: () => boolean;
  triggerHaptic?: (kind: string) => void;
}

const DEFAULT_PACKAGE = "app.lifemaker.school";
const DEFAULT_SHORT_RECEIVER = "app.lifemaker.school/.SchoolDeviceAdminReceiver";
const DEFAULT_RECEIVER = "app.lifemaker.school/app.lifemaker.school.SchoolDeviceAdminReceiver";
const ADMIN_PIN_HASH_STORAGE_KEY = "lm_device_admin_pin_hash_v1";
const SCHOOL_PIN_HASH_PREFIX = "lm_school_admin_pin_hash_";
const UNINSTALL_PIN_REQUIRED_STORAGE_KEY = "lm_uninstall_pin_required_v1";
const SCHOOL_PIN_REQUIRED_PREFIX = "lm_school_uninstall_pin_required_";

function getBridge(): LifeMakerDeviceAdminBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { LifeMakerAndroid?: LifeMakerDeviceAdminBridge }).LifeMakerAndroid;
}

export function getCachedUninstallPinRequired(schoolId?: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (schoolId) {
      const schVal = localStorage.getItem(`${SCHOOL_PIN_REQUIRED_PREFIX}${schoolId}`);
      if (schVal === "false") return false;
      if (schVal === "true") return true;
    }
    const globalVal = localStorage.getItem(UNINSTALL_PIN_REQUIRED_STORAGE_KEY);
    if (globalVal === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export function syncUninstallPinRequiredToNative(
  required: boolean,
  schoolId?: string,
  options?: { syncGuardLock?: boolean }
): void {
  const bridge = getBridge();
  const prevRequired = getCachedUninstallPinRequired(schoolId);
  try {
    localStorage.setItem(UNINSTALL_PIN_REQUIRED_STORAGE_KEY, required ? "true" : "false");
    if (schoolId) {
      localStorage.setItem(`${SCHOOL_PIN_REQUIRED_PREFIX}${schoolId}`, required ? "true" : "false");
    }
  } catch {}

  try {
    bridge?.setUninstallPinRequired?.(required);
  } catch {}

  // Backward-compatible sync for APKs using isAccessibilityGuardLocked:
  // When OFF -> unlock guard so Accessibility Service never shows the PIN prompt.
  // When ON  -> lock guard on explicit toggle or OFF->ON transition (without clobbering active temp unlock).
  try {
    if (!required) {
      bridge?.setAccessibilityGuardLocked?.(false);
    } else if (options?.syncGuardLock || !prevRequired) {
      bridge?.setAccessibilityGuardLocked?.(true);
    }
  } catch {}
}

export function getCachedSchoolAdminPinHash(schoolId?: string): string {
  if (typeof window === "undefined") return "";
  try {
    if (schoolId) {
      const schHash = localStorage.getItem(`${SCHOOL_PIN_HASH_PREFIX}${schoolId}`);
      if (schHash && schHash.trim()) return schHash.trim();
    }
    return (localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function syncSchoolAdminPinHashToNative(
  pinHash?: string | null,
  schoolId?: string,
  options?: { clearIfEmpty?: boolean }
): void {
  const bridge = getBridge();
  const clean = (pinHash || "").trim();
  if (!clean) {
    if (options?.clearIfEmpty) {
      try {
        localStorage.removeItem(ADMIN_PIN_HASH_STORAGE_KEY);
        if (schoolId) {
          localStorage.removeItem(`${SCHOOL_PIN_HASH_PREFIX}${schoolId}`);
        }
      } catch {}
      try {
        bridge?.syncAdminPinHash?.("");
      } catch {}
    }
    return;
  }

  try {
    localStorage.setItem(ADMIN_PIN_HASH_STORAGE_KEY, clean);
    if (schoolId) {
      localStorage.setItem(`${SCHOOL_PIN_HASH_PREFIX}${schoolId}`, clean);
    }
  } catch {}

  try {
    bridge?.syncAdminPinHash?.(clean);
  } catch {}
}

export function syncStoredAdminPinToNative(schoolId?: string): void {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    if (typeof bridge.syncAdminPinHash === "function") {
      const stored = getCachedSchoolAdminPinHash(schoolId);
      if (stored && stored.trim().length > 0) {
        bridge.syncAdminPinHash(stored.trim());
      }
    }
    if (typeof bridge.setUninstallPinRequired === "function") {
      bridge.setUninstallPinRequired(getCachedUninstallPinRequired(schoolId));
    }
  } catch {}
}

export async function syncRawPinFallbackToNativeIfMissing(
  rawPin?: string,
  schoolId?: string
): Promise<string> {
  const bridge = getBridge();
  try {
    const clean = (rawPin || "").trim();
    if (!clean) return "";
    const hash = await sha256Hex(clean);
    const hasCustom = Boolean(localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY));
    if (hasCustom) {
      syncStoredAdminPinToNative();
      return localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY) || hash;
    }
    if (bridge?.hasNativeAdminPin?.()) {
      return hash;
    }
    syncSchoolAdminPinHashToNative(hash, schoolId);
    return hash;
  } catch {
    return "";
  }
}

export function getAndroidDeviceAdminStatus(): AndroidDeviceAdminStatus {
  const bridge = getBridge();
  const isNative = Boolean(bridge && (bridge.isNativeApp?.() ?? true));

  const cachedPinRequired = getCachedUninstallPinRequired();
  const fallback: AndroidDeviceAdminStatus = {
    isNativeApp: isNative,
    supported: false,
    isAdminActive: false,
    isDeviceOwner: false,
    isUninstallBlocked: false,
    isAccessibilityGuardEnabled: false,
    isAccessibilityGuardLocked: cachedPinRequired,
    uninstallPinRequired: cachedPinRequired,
    hasNativeAdminPin: false,
    tempUnlockRemainingSec: 0,
    enabledAt: 0,
    packageName: DEFAULT_PACKAGE,
    receiverComponent: DEFAULT_RECEIVER,
    shortReceiverComponent: DEFAULT_SHORT_RECEIVER,
    adbDeviceOwnerCommand: `adb shell dpm set-device-owner ${DEFAULT_SHORT_RECEIVER}`,
  };

  if (!bridge || typeof bridge.getDeviceAdminStatus !== "function") {
    return fallback;
  }

  try {
    const raw = bridge.getDeviceAdminStatus();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AndroidDeviceAdminStatus>;
    const shortComp = String(parsed.shortReceiverComponent || DEFAULT_SHORT_RECEIVER);
    const guardLocked =
      parsed.isAccessibilityGuardLocked === undefined
        ? true
        : Boolean(parsed.isAccessibilityGuardLocked);
    const pinRequired =
      parsed.uninstallPinRequired === undefined
        ? cachedPinRequired && guardLocked
        : Boolean(parsed.uninstallPinRequired);
    return {
      isNativeApp: isNative,
      supported: Boolean(parsed.supported),
      isAdminActive: Boolean(parsed.isAdminActive),
      isDeviceOwner: Boolean(parsed.isDeviceOwner),
      isUninstallBlocked: Boolean(parsed.isUninstallBlocked),
      isAccessibilityGuardEnabled: Boolean(parsed.isAccessibilityGuardEnabled),
      isAccessibilityGuardLocked: guardLocked,
      uninstallPinRequired: pinRequired,
      hasNativeAdminPin: Boolean(parsed.hasNativeAdminPin),
      tempUnlockRemainingSec: Number(parsed.tempUnlockRemainingSec || 0),
      enabledAt: Number(parsed.enabledAt || 0),
      packageName: String(parsed.packageName || DEFAULT_PACKAGE),
      receiverComponent: String(parsed.receiverComponent || DEFAULT_RECEIVER),
      shortReceiverComponent: shortComp,
      adbDeviceOwnerCommand: `adb shell dpm set-device-owner ${shortComp}`,
    };
  } catch {
    return fallback;
  }
}

export function requestAndroidDeviceAdmin(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.requestDeviceAdmin !== "function") return false;
  bridge.triggerHaptic?.("light");
  return Boolean(bridge.requestDeviceAdmin());
}

export function deactivateAndroidDeviceAdmin(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.deactivateDeviceAdmin !== "function") return false;
  bridge.triggerHaptic?.("medium");
  return Boolean(bridge.deactivateDeviceAdmin());
}

export function openAndroidDeviceAdminSettings(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.openDeviceAdminSettings !== "function") return false;
  bridge.triggerHaptic?.("light");
  bridge.openDeviceAdminSettings();
  return true;
}

export function setAndroidUninstallBlocked(blocked: boolean): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.setUninstallBlocked !== "function") return false;
  bridge.triggerHaptic?.("success");
  return Boolean(bridge.setUninstallBlocked(blocked));
}

export function lockAndroidDeviceScreen(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.lockDeviceScreen !== "function") return false;
  return Boolean(bridge.lockDeviceScreen());
}

export function openAndroidAccessibilityGuardSettings(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.openAccessibilityGuardSettings !== "function") return false;
  bridge.triggerHaptic?.("light");
  bridge.openAccessibilityGuardSettings();
  return true;
}

export function setAndroidAccessibilityGuardLocked(locked: boolean): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.setAccessibilityGuardLocked !== "function") return false;
  bridge.triggerHaptic?.(locked ? "success" : "medium");
  return Boolean(bridge.setAccessibilityGuardLocked(locked));
}

export function unlockAndroidProtectionTemporarily(seconds: number): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.unlockUninstallProtectionTemporarily !== "function") return false;
  bridge.triggerHaptic?.("medium");
  return Boolean(bridge.unlockUninstallProtectionTemporarily(seconds));
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(`lm_admin_guard_v1:${text}`);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback deterministic digest if WebCrypto is unavailable in non-secure context
  let h = 2166136261;
  const input = `lm_admin_guard_v1:${text}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

export async function computeDeviceAdminPinHash(pin: string): Promise<string> {
  const clean = pin.trim();
  if (!clean) return "";
  return sha256Hex(clean);
}

export function hasCustomDeviceAdminPin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY));
  } catch {
    return false;
  }
}

export async function saveCustomDeviceAdminPin(pin: string, schoolId?: string): Promise<string> {
  const clean = pin.trim();
  if (!clean) {
    syncSchoolAdminPinHashToNative("", schoolId, { clearIfEmpty: true });
    return "";
  }
  const hash = await sha256Hex(clean);
  syncSchoolAdminPinHashToNative(hash, schoolId);
  return hash;
}

export async function verifyAgainstPinHash(pin: string, expectedHash?: string | null): Promise<boolean> {
  try {
    const target = (expectedHash || localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY) || "").trim();
    if (!target) return true;
    const candidate = await sha256Hex(pin.trim());
    return candidate === target;
  } catch {
    return false;
  }
}

export async function verifyCustomDeviceAdminPin(pin: string): Promise<boolean> {
  return verifyAgainstPinHash(pin);
}
