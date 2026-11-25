export interface AndroidDeviceAdminStatus {
  isNativeApp: boolean;
  supported: boolean;
  isAdminActive: boolean;
  isDeviceOwner: boolean;
  isUninstallBlocked: boolean;
  isAccessibilityGuardEnabled: boolean;
  isAccessibilityGuardLocked: boolean;
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
  unlockUninstallProtectionTemporarily?: (seconds: number) => boolean;
  triggerHaptic?: (kind: string) => void;
}

const DEFAULT_PACKAGE = "app.lifemaker.school";
const DEFAULT_SHORT_RECEIVER = "app.lifemaker.school/.SchoolDeviceAdminReceiver";
const DEFAULT_RECEIVER = "app.lifemaker.school/app.lifemaker.school.SchoolDeviceAdminReceiver";
const ADMIN_PIN_HASH_STORAGE_KEY = "lm_device_admin_pin_hash_v1";

function getBridge(): LifeMakerDeviceAdminBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { LifeMakerAndroid?: LifeMakerDeviceAdminBridge }).LifeMakerAndroid;
}

export function getAndroidDeviceAdminStatus(): AndroidDeviceAdminStatus {
  const bridge = getBridge();
  const isNative = Boolean(bridge && (bridge.isNativeApp?.() ?? true));

  const fallback: AndroidDeviceAdminStatus = {
    isNativeApp: isNative,
    supported: false,
    isAdminActive: false,
    isDeviceOwner: false,
    isUninstallBlocked: false,
    isAccessibilityGuardEnabled: false,
    isAccessibilityGuardLocked: true,
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
    return {
      isNativeApp: isNative,
      supported: Boolean(parsed.supported),
      isAdminActive: Boolean(parsed.isAdminActive),
      isDeviceOwner: Boolean(parsed.isDeviceOwner),
      isUninstallBlocked: Boolean(parsed.isUninstallBlocked),
      isAccessibilityGuardEnabled: Boolean(parsed.isAccessibilityGuardEnabled),
      isAccessibilityGuardLocked:
        parsed.isAccessibilityGuardLocked === undefined
          ? true
          : Boolean(parsed.isAccessibilityGuardLocked),
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

export function hasCustomDeviceAdminPin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY));
  } catch {
    return false;
  }
}

export async function saveCustomDeviceAdminPin(pin: string): Promise<void> {
  const clean = pin.trim();
  if (!clean) {
    try {
      localStorage.removeItem(ADMIN_PIN_HASH_STORAGE_KEY);
    } catch {}
    return;
  }
  const hash = await sha256Hex(clean);
  try {
    localStorage.setItem(ADMIN_PIN_HASH_STORAGE_KEY, hash);
  } catch {}
}

export async function verifyCustomDeviceAdminPin(pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(ADMIN_PIN_HASH_STORAGE_KEY);
    if (!stored) return true;
    const candidate = await sha256Hex(pin.trim());
    return candidate === stored;
  } catch {
    return false;
  }
}
