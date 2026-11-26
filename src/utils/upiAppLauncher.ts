export interface DetectedNativeUpiApp {
  packageName: string;
  appName: string;
  brandKey: string;
}

export type WebUpiAppId = "auto" | "phonepe" | "gpay" | "paytm" | "bhim";

export const NATIVE_DEDICATED_UPI_KEY = "nsta_dedicated_upi_pkg";
export const WEB_DEDICATED_UPI_KEY = "nsta_dedicated_upi_web";

export const WEB_UPI_APP_OPTIONS: Array<{
  id: Exclude<WebUpiAppId, "auto">;
  label: string;
  schemePrefix: string;
  activeClass: string;
  idleClass: string;
}> = [
  {
    id: "phonepe",
    label: "PhonePe",
    schemePrefix: "phonepe://pay?",
    activeClass: "border-[#5f259f] bg-[#5f259f] text-white shadow-xs",
    idleClass:
      "border-[#5f259f]/30 bg-[#5f259f]/10 hover:bg-[#5f259f]/20 text-[#5f259f] dark:text-purple-300 dark:border-purple-500/35 dark:bg-purple-500/15",
  },
  {
    id: "gpay",
    label: "Google Pay",
    schemePrefix: "tez://upi/pay?",
    activeClass: "border-blue-600 bg-blue-600 text-white shadow-xs",
    idleClass:
      "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 dark:border-blue-500/35 dark:bg-blue-500/15",
  },
  {
    id: "paytm",
    label: "Paytm",
    schemePrefix: "paytmmp://pay?",
    activeClass: "border-sky-600 bg-sky-600 text-white shadow-xs",
    idleClass:
      "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 dark:border-sky-500/35 dark:bg-sky-500/15",
  },
  {
    id: "bhim",
    label: "BHIM",
    schemePrefix: "bhim://pay?",
    activeClass: "border-orange-600 bg-orange-600 text-white shadow-xs",
    idleClass:
      "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 dark:border-orange-500/35 dark:bg-orange-500/15",
  },
];

export function readInstalledNativeUpiApps(): {
  hasBridge: boolean;
  apps: DetectedNativeUpiApp[];
  initialDedicatedPkg: string;
} {
  try {
    const bridge = (window as any).LifeMakerAndroid;
    if (bridge && typeof bridge.getInstalledUpiApps === "function") {
      const raw = bridge.getInstalledUpiApps();
      const parsed = JSON.parse(typeof raw === "string" ? raw : "[]");
      if (Array.isArray(parsed)) {
        const validApps: DetectedNativeUpiApp[] = parsed.filter(
          (a) => a && typeof a.packageName === "string" && a.packageName.trim().length > 0
        );
        let savedPkg = "";
        try {
          savedPkg = localStorage.getItem(NATIVE_DEDICATED_UPI_KEY) || "";
        } catch {}
        const initialDedicatedPkg =
          savedPkg && validApps.some((a) => a.packageName === savedPkg)
            ? savedPkg
            : validApps[0]?.packageName || "";
        return { hasBridge: true, apps: validApps, initialDedicatedPkg };
      }
    }
  } catch {}
  return { hasBridge: false, apps: [], initialDedicatedPkg: "" };
}

export function getSavedWebDedicatedUpiApp(): WebUpiAppId {
  try {
    const saved = localStorage.getItem(WEB_DEDICATED_UPI_KEY) as WebUpiAppId | null;
    if (saved && (saved === "auto" || WEB_UPI_APP_OPTIONS.some((o) => o.id === saved))) {
      return saved;
    }
  } catch {}
  return "auto";
}

export function launchNativeUpiApp(upiUri: string, pkgName?: string): boolean {
  if (!upiUri) return false;
  if (pkgName) {
    try {
      localStorage.setItem(NATIVE_DEDICATED_UPI_KEY, pkgName);
    } catch {}
  }
  try {
    const bridge = (window as any).LifeMakerAndroid;
    if (bridge && typeof bridge.launchUpiApp === "function") {
      const ok = bridge.launchUpiApp(upiUri, pkgName || "");
      if (ok) return true;
    }
  } catch {}
  try {
    window.location.href = upiUri;
    return true;
  } catch {
    return false;
  }
}

export function buildUpiQueryAndUri(params: {
  upiId: string;
  schoolName?: string;
  amount: number;
  txnNote?: string;
}): { upiQuery: string; upiUri: string } {
  const cleanUpi = String(params.upiId || "").trim();
  if (!cleanUpi) return { upiQuery: "", upiUri: "" };
  const amountRounded = Math.max(0, Math.round(Number(params.amount) || 0));
  const note = String(params.txnNote || "School Fee").slice(0, 50);
  const upiQuery = `pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(
    String(params.schoolName || "School").slice(0, 40)
  )}${amountRounded > 0 ? `&am=${amountRounded}` : ""}&cu=INR&tn=${encodeURIComponent(note)}`;
  return { upiQuery, upiUri: `upi://pay?${upiQuery}` };
}

function fallbackByteHash(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 ^= b;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (b + i) & 0xff;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `fnv_${bytes.length.toString(16)}_${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export async function computeImageHash(input: File | Blob | string): Promise<string> {
  try {
    let bytes: Uint8Array;
    if (typeof input === "string") {
      const commaIdx = input.indexOf(",");
      const payload = commaIdx >= 0 ? input.slice(commaIdx + 1) : input;
      if (commaIdx >= 0 && input.slice(0, commaIdx).includes(";base64")) {
        const bin = atob(payload);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        bytes = new TextEncoder().encode(input);
      }
    } else {
      const buf = await input.arrayBuffer();
      bytes = new Uint8Array(buf);
    }

    if (typeof window !== "undefined" && window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
      const arr = Array.from(new Uint8Array(digest));
      return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return fallbackByteHash(bytes);
  } catch {
    if (typeof input === "string") {
      return fallbackByteHash(new TextEncoder().encode(input.slice(0, 4096)));
    }
    return "";
  }
}
