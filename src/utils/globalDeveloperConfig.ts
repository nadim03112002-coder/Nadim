import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { get, onValue, ref, set } from "firebase/database";
import { db, rtdb } from "../firebase";
import { uploadImageToImgBB } from "../services/imgbbService";

export interface GlobalWebsiteDeveloperConfig {
  name: string;
  roleTitle: string;
  organization: string;
  photoUrl: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_GLOBAL_DEVELOPER: GlobalWebsiteDeveloperConfig = {
  name: "Nadim Anwar",
  roleTitle: "Platform Developer & Architect",
  organization: "Life Maker",
  photoUrl: "",
};

const LOCAL_GLOBAL_DEV_KEY = "nst_global_website_developer";
const EVENT_NAME = "nst-global-developer-updated";

const normalizeDevConfig = (raw: any): GlobalWebsiteDeveloperConfig => {
  const src = raw && typeof raw === "object" ? raw : {};
  const name = typeof src.name === "string" && src.name.trim() ? src.name.trim() : DEFAULT_GLOBAL_DEVELOPER.name;
  const roleTitle =
    typeof src.roleTitle === "string" && src.roleTitle.trim()
      ? src.roleTitle.trim()
      : DEFAULT_GLOBAL_DEVELOPER.roleTitle;
  const organization =
    typeof src.organization === "string" && src.organization.trim()
      ? src.organization.trim()
      : DEFAULT_GLOBAL_DEVELOPER.organization;
  const photoUrl = typeof src.photoUrl === "string" ? src.photoUrl.trim() : "";
  return {
    name,
    roleTitle,
    organization,
    photoUrl,
    ...(src.updatedAt ? { updatedAt: String(src.updatedAt) } : {}),
    ...(src.updatedBy ? { updatedBy: String(src.updatedBy) } : {}),
  };
};

export const getLocalGlobalDeveloperConfig = (): GlobalWebsiteDeveloperConfig => {
  if (typeof window === "undefined") return { ...DEFAULT_GLOBAL_DEVELOPER };
  try {
    const raw = localStorage.getItem(LOCAL_GLOBAL_DEV_KEY);
    if (raw) {
      return normalizeDevConfig(JSON.parse(raw));
    }
    const sysRaw = localStorage.getItem("nst_system_settings");
    if (sysRaw) {
      const parsed = JSON.parse(sysRaw);
      if (parsed?.websiteDeveloper && typeof parsed.websiteDeveloper === "object") {
        return normalizeDevConfig(parsed.websiteDeveloper);
      }
    }
  } catch {}
  return { ...DEFAULT_GLOBAL_DEVELOPER };
};

const cacheLocalGlobalDeveloperConfig = (cfg: GlobalWebsiteDeveloperConfig) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_GLOBAL_DEV_KEY, JSON.stringify(cfg));
    const sysRaw = localStorage.getItem("nst_system_settings");
    if (sysRaw) {
      const parsed = JSON.parse(sysRaw);
      if (parsed && typeof parsed === "object") {
        parsed.websiteDeveloper = cfg;
        localStorage.setItem("nst_system_settings", JSON.stringify(parsed));
      }
    }
  } catch {}
};

export const saveGlobalDeveloperConfig = async (
  patch: Partial<GlobalWebsiteDeveloperConfig>,
  updatedBy = "Life Maker Super Admin"
): Promise<GlobalWebsiteDeveloperConfig> => {
  const current = getLocalGlobalDeveloperConfig();
  let finalPhotoUrl =
    patch.photoUrl !== undefined ? String(patch.photoUrl || "").trim() : current.photoUrl;

  if (finalPhotoUrl && finalPhotoUrl.startsWith("data:image/")) {
    try {
      finalPhotoUrl = await uploadImageToImgBB(finalPhotoUrl, `global_developer_${Date.now()}.png`);
    } catch (err) {
      console.warn("[globalDeveloperConfig] ImgBB upload fallback:", err);
    }
  }

  const next: GlobalWebsiteDeveloperConfig = normalizeDevConfig({
    ...current,
    ...patch,
    photoUrl: finalPhotoUrl,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });

  cacheLocalGlobalDeveloperConfig(next);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    window.dispatchEvent(
      new CustomEvent("nst_system_settings_updated", {
        detail: { websiteDeveloper: next },
      })
    );
  }

  const tasks: Promise<any>[] = [];
  if (rtdb) {
    tasks.push(set(ref(rtdb, "system_settings/websiteDeveloper"), next));
  }
  if (db) {
    tasks.push(
      setDoc(doc(db, "config", "system_settings"), { websiteDeveloper: next }, { merge: true })
    );
    tasks.push(
      setDoc(doc(db, "system_settings", "website_developer"), next, { merge: true })
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return next;
};

const LOCAL_GLOBAL_DEV_TS_KEY = "nst_global_website_developer_ts";
const GLOBAL_DEV_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const subscribeToGlobalDeveloperConfig = (
  cb: (cfg: GlobalWebsiteDeveloperConfig) => void
): (() => void) => {
  let active = true;
  const deliver = (raw: any) => {
    if (!active) return;
    const normalized = normalizeDevConfig(raw);
    cacheLocalGlobalDeveloperConfig(normalized);
    try {
      localStorage.setItem(LOCAL_GLOBAL_DEV_TS_KEY, String(Date.now()));
    } catch {}
    cb(normalized);
  };

  // 1. Immediate cached/default delivery (0 network reads)
  cb(getLocalGlobalDeveloperConfig());

  // 2. Same-tab & cross-tab window sync
  const onEvent = (e: any) => {
    if (e?.detail) deliver(e.detail);
    else if (active) cb(getLocalGlobalDeveloperConfig());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_GLOBAL_DEV_KEY || e.key === "nst_system_settings") {
      if (active) cb(getLocalGlobalDeveloperConfig());
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT_NAME, onEvent);
    window.addEventListener("storage", onStorage);
  }

  // 3. Refresh from Firestore once only if cached timestamp is older than 30 mins
  let isFresh = false;
  try {
    const rawTs = localStorage.getItem(LOCAL_GLOBAL_DEV_TS_KEY);
    const hasLocal = Boolean(localStorage.getItem(LOCAL_GLOBAL_DEV_KEY));
    if (hasLocal && rawTs && Date.now() - Number(rawTs) < GLOBAL_DEV_CACHE_TTL_MS) {
      isFresh = true;
    }
  } catch {}

  if (!isFresh) {
    if (db) {
      getDoc(doc(db, "system_settings", "website_developer"))
        .then((snap) => {
          if (snap.exists()) {
            deliver(snap.data());
          } else {
            try {
              localStorage.setItem(LOCAL_GLOBAL_DEV_TS_KEY, String(Date.now()));
            } catch {}
          }
        })
        .catch(() => {});
    } else if (rtdb) {
      get(ref(rtdb, "system_settings/websiteDeveloper"))
        .then((snap) => {
          const val = snap.val();
          if (val && typeof val === "object") deliver(val);
        })
        .catch(() => {});
    }
  }

  return () => {
    active = false;
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENT_NAME, onEvent);
      window.removeEventListener("storage", onStorage);
    }
  };
};
