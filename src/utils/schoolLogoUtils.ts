import { getSchoolCacheSync, getSchoolLogoSync } from "./schoolIndexedDb";

/**
 * Checks if a URL points to the NSTA platform app's own logo (to prevent app branding from replacing school branding)
 */
export function isAppLogo(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.trim().toLowerCase();
  return (
    lower.includes("nsta-logo") ||
    lower.includes("nsta_logo") ||
    lower.includes("branding/nsta") ||
    lower.includes("favicon.svg") ||
    lower.endsWith("/icons/icon-192.png") ||
    lower.endsWith("/icons/icon-512.png") ||
    lower.endsWith("/icon-192.png") ||
    lower.endsWith("/icon-512.png") ||
    lower.endsWith("/apple-touch-icon.png") ||
    lower === "/branding/nsta-logo.png" ||
    lower === "/branding/nsta-logo.svg" ||
    lower === "branding/nsta-logo.png" ||
    lower === "branding/nsta-logo.svg"
  );
}

/**
 * Normalizes and cleans image URLs (including Google Drive links) so browsers can render them in <img> tags.
 */
export function cleanLogoUrl(url?: string): string {
  if (!url || typeof url !== "string") return "";
  let trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("branding/")) {
    trimmed = "/" + trimmed;
  }
  if (trimmed.startsWith("icons/")) {
    trimmed = "/" + trimmed;
  }
  // Google Drive format 1: /file/d/ID/view
  const dMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) {
    return `https://drive.google.com/uc?export=view&id=${dMatch[1]}`;
  }
  // Google Drive format 2: id=ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && trimmed.includes("drive.google.com")) {
    return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
  }
  return trimmed;
}

/**
 * Returns the school's explicit official Registration / School Code ONLY when legitimately entered.
 * Suppresses empty values, lock codes, "0002", placeholder codes, and auto-generated
 * school-name-prefix slugs (e.g. "LIFE_M" generated from "LIFE MAKER...").
 */
export function getVisibleSchoolRegNo(
  school?: { name?: string; code?: string; lockCode?: string; registrationNo?: string; regNo?: string } | null,
  overrideCode?: string | null
): string {
  const raw = String(
    overrideCode !== undefined && overrideCode !== null
      ? overrideCode
      : (school?.registrationNo || school?.regNo || school?.code || "")
  ).trim();
  if (!raw) return "";
  if (school?.lockCode && raw === String(school.lockCode).trim()) return "";
  if (raw === "0002" || raw === "SCH-REG" || raw === "SCH-001" || raw === "NSTZ-01") return "";

  const sName = String(school?.name || "").trim();
  if (sName) {
    const autoLegacySlug = sName.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const autoLegacySlugTrimmed = autoLegacySlug.replace(/_+$/, "");
    if (raw === autoLegacySlug || (autoLegacySlugTrimmed && raw === autoLegacySlugTrimmed)) {
      return "";
    }
  }
  return raw;
}

/**
 * Resolves the authentic saved school logo strictly isolated per schoolId.
 * Never leaks School A's logo onto School B, and never returns the NSTA app logo.
 */
export function getSavedSchoolLogo(preferredLogo?: string | null, schoolId?: string): string {
  // 1. If preferredLogo is provided and is a valid custom school logo (NOT an app logo), use it!
  if (preferredLogo && typeof preferredLogo === "string") {
    const cleaned = cleanLogoUrl(preferredLogo);
    if (cleaned && !isAppLogo(cleaned)) {
      return cleaned;
    }
  }

  // 2. If schoolId is specified, check strictly that school's IndexedDB logo & school profile
  if (schoolId) {
    const perSchoolLogo = getSchoolLogoSync(schoolId);
    if (perSchoolLogo) {
      const cleaned = cleanLogoUrl(perSchoolLogo);
      if (cleaned && !isAppLogo(cleaned)) {
        return cleaned;
      }
    }

    const schools = getSchoolCacheSync<any[]>("nst_schools_local_cache", []);
    if (Array.isArray(schools)) {
      const matched = schools.find((s) => s?.id === schoolId);
      if (matched?.logoUrl && typeof matched.logoUrl === "string") {
        const cleaned = cleanLogoUrl(matched.logoUrl);
        if (cleaned && !isAppLogo(cleaned)) {
          return cleaned;
        }
      }
    }

    return "";
  }

  // 3. Fallback when schoolId is omitted: only resolve if there is a single school in cache
  const schools = getSchoolCacheSync<any[]>("nst_schools_local_cache", []);
  if (Array.isArray(schools) && schools.length === 1 && schools[0]?.logoUrl) {
    const cleaned = cleanLogoUrl(schools[0].logoUrl);
    if (cleaned && !isAppLogo(cleaned)) {
      return cleaned;
    }
  }

  return "";
}
