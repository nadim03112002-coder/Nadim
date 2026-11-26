import { getSchoolCacheSync } from "./schoolIndexedDb";
import { getSavedSchoolLogo, isAppLogo } from "./schoolLogoUtils";

export interface ActiveSchoolBrand {
  schoolId: string;
  name: string;
  tagline: string;
  logoUrl: string;
  hasCustomLogo: boolean;
}

const ACTIVE_SCHOOL_NAME_KEY = "nst_active_school_name";
const ACTIVE_SCHOOL_TAGLINE_KEY = "nst_active_school_tagline";

export function persistActiveSchoolBrand(brand?: {
  id?: string | null;
  name?: string | null;
  tagline?: string | null;
}) {
  if (typeof window === "undefined" || !brand) return;
  try {
    const cleanId = String(brand.id || "").trim();
    const cleanName = String(brand.name || "").trim();
    const cleanTagline = String(brand.tagline || "").trim();
    if (cleanId) localStorage.setItem("nst_active_school_id", cleanId);
    if (cleanName) localStorage.setItem(ACTIVE_SCHOOL_NAME_KEY, cleanName);
    if (cleanTagline) localStorage.setItem(ACTIVE_SCHOOL_TAGLINE_KEY, cleanTagline);
  } catch {}
}

export function resolveActiveSchoolBrand(overrides?: {
  schoolId?: string | null;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  schoolTagline?: string | null;
}): ActiveSchoolBrand {
  let resolvedId = String(overrides?.schoolId || "").trim();
  let resolvedName = String(overrides?.schoolName || "").trim();
  let resolvedTagline = String(overrides?.schoolTagline || "").trim();
  let rawLogo = String(overrides?.schoolLogoUrl || "").trim();

  if (typeof window !== "undefined") {
    try {
      const userRaw = localStorage.getItem("nst_current_user");
      if (userRaw) {
        const parsedUser = JSON.parse(userRaw);
        if (!resolvedId && parsedUser?.schoolId) {
          resolvedId = String(parsedUser.schoolId).trim();
        }
        if (!resolvedName && parsedUser?.schoolName) {
          resolvedName = String(parsedUser.schoolName).trim();
        }
      }

      if (!resolvedId) {
        resolvedId =
          String(
            localStorage.getItem("nst_active_school_id") ||
              localStorage.getItem("selectedPublicSchoolId") ||
              ""
          ).trim();
      }

      if (!resolvedName) {
        resolvedName = String(localStorage.getItem(ACTIVE_SCHOOL_NAME_KEY) || "").trim();
      }

      if (!resolvedTagline) {
        resolvedTagline = String(localStorage.getItem(ACTIVE_SCHOOL_TAGLINE_KEY) || "").trim();
      }
    } catch {}
  }

  try {
    const cachedSchools = getSchoolCacheSync<any[]>("nst_schools_local_cache", []);
    if (Array.isArray(cachedSchools) && cachedSchools.length > 0) {
      const matched =
        (resolvedId &&
          cachedSchools.find(
            (s) => s?.id === resolvedId || s?.code === resolvedId
          )) ||
        (cachedSchools.length === 1 ? cachedSchools[0] : undefined);

      if (matched) {
        if (!resolvedId && matched.id) resolvedId = String(matched.id).trim();
        if (!resolvedName && matched.name) resolvedName = String(matched.name).trim();
        if (!resolvedTagline) {
          resolvedTagline = String(
            matched.tagline || matched.websiteConfig?.heroSubheadline || ""
          ).trim();
        }
        if (!rawLogo && matched.logoUrl) {
          rawLogo = String(matched.logoUrl).trim();
        }
      }
    }
  } catch {}

  const savedLogo = getSavedSchoolLogo(rawLogo, resolvedId || undefined);
  const candidateLogo = savedLogo || (rawLogo && !isAppLogo(rawLogo) ? rawLogo : "");
  const hasCustomLogo = Boolean(candidateLogo && !isAppLogo(candidateLogo));

  return {
    schoolId: resolvedId,
    name: resolvedName,
    tagline: resolvedTagline,
    logoUrl: hasCustomLogo ? candidateLogo : "/branding/schoolplus-splash-logo.png?v=7",
    hasCustomLogo,
  };
}
