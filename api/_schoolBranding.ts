import { extractTelegramParamsFromUrl, fetchTelegramFileBuffer } from "./_telegramProxy.js";
import { fetchAllSchoolsFromSupabase, upsertSchoolInSupabase } from "./_supabaseServer.js";

const RTDB_BASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://nst2512-6a2e4-default-rtdb.asia-southeast1.firebasedatabase.app";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "nst2512-6a2e4";

export interface PublicSchoolMeta {
  id: string;
  name: string;
  code: string;
  address?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  bannerColor?: string;
  status?: string;
  active?: boolean;
  isDefaultPublicWebsite?: boolean;
  websiteConfig?: {
    customSlug?: string;
    heroBadgeText?: string;
    heroHeadline?: string;
    heroSubheadline?: string;
    heroBannerUrl?: string;
    aboutSchool?: string;
    admissionSessionLabel?: string;
  };
}

export interface ResolvedSchoolBranding {
  school: PublicSchoolMeta;
  matchedByQuery: boolean;
  queryKey: string;
  title: string;
  description: string;
  shortName: string;
  siteName: string;
  themeColor: string;
  backgroundColor: string;
  canonicalUrl: string;
  ogImageUrl: string;
  splashLogoUrl: string;
  splashTitle: string;
  splashSubtitle: string;
  manifestHref: string;
  icon192Url: string;
  icon512Url: string;
  appleTouchIconUrl: string;
}

const DEFAULT_SCHOOL_ID = "MySyHGP5AguNdisdPKRu";

const DEFAULT_FALLBACK_SCHOOL: PublicSchoolMeta = {
  id: DEFAULT_SCHOOL_ID,
  name: "LIFE MAKER PUBLIC SCHOOL",
  code: "LMPS",
  address: "DHARAKA MARKET AFFOUR NAGRA SARAN",
  tagline: "Bright Future... Together",
  phone: "9525400122,9835763641",
  email: "n@gmail.com",
  bannerColor: "#1e3a8a",
  active: true,
  isDefaultPublicWebsite: true,
  websiteConfig: {
    heroHeadline: "LIFE MAKER PUBLIC SCHOOL",
    heroSubheadline:
      "Official Digital Campus of LIFE MAKER PUBLIC SCHOOL, Dharaka Market Affour, Nagra, Saran — Online Admission 2027-28, Fee Passbook, Attendance & Smart Learning.",
    aboutSchool:
      "LIFE MAKER PUBLIC SCHOOL, situated at Dharaka Market Affour, Nagra, Saran (Ummid Educational & Welfare Trust), delivers disciplined, technology-enabled education from Nursery to Class X.",
    admissionSessionLabel: "2027-28",
  },
};

let cachedSchools: { data: PublicSchoolMeta[]; fetchedAt: number } | null = null;
let inFlightSchoolsFetch: Promise<PublicSchoolMeta[]> | null = null;
const CACHE_TTL_MS = 30_000;

function isDemoSchoolEntry(s: any): boolean {
  if (!s) return true;
  const id = String(s.id || "").trim();
  const code = String(s.code || "").trim().toUpperCase();
  const name = String(s.name || "").trim().toLowerCase();
  const email = String(s.email || s.adminEmail || "").trim().toLowerCase();
  if (id === "dps_gurgaon_sector45") return true;
  if (code === "DPS45" && name.includes("delhi public school")) return true;
  if (email.includes("@demoschool.edu.in")) return true;
  return false;
}

function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== "object") return undefined;
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("nullValue" in val) return null;
  if ("mapValue" in val) {
    const out: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  if ("arrayValue" in val) {
    return (val.arrayValue?.values || []).map(decodeFirestoreValue);
  }
  return undefined;
}

function sanitizeSchoolMeta(id: string, raw: any): PublicSchoolMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const resolvedId = String(raw.id || id).trim();
  const name = String(raw.name || "").trim();
  if (!name) return null;
  const rawCode = String(raw.code || "").trim();
  const resolvedCode =
    rawCode ||
    (resolvedId === DEFAULT_SCHOOL_ID || name.toLowerCase().includes("life maker") ? "LMPS" : "");
  return {
    id: resolvedId,
    name,
    code: resolvedCode,
    address: raw.address ? String(raw.address).trim() : undefined,
    tagline: raw.tagline ? String(raw.tagline).trim() : undefined,
    phone: raw.phone ? String(raw.phone).trim() : undefined,
    email: raw.email ? String(raw.email).trim() : undefined,
    logoUrl: raw.logoUrl ? String(raw.logoUrl).trim() : undefined,
    bannerColor: raw.bannerColor ? String(raw.bannerColor).trim() : undefined,
    status: raw.status ? String(raw.status).trim() : undefined,
    active: raw.active !== false,
    isDefaultPublicWebsite: raw.isDefaultPublicWebsite === true,
    websiteConfig:
      raw.websiteConfig && typeof raw.websiteConfig === "object"
        ? {
            customSlug: raw.websiteConfig.customSlug ? String(raw.websiteConfig.customSlug).trim() : undefined,
            heroBadgeText: raw.websiteConfig.heroBadgeText ? String(raw.websiteConfig.heroBadgeText).trim() : undefined,
            heroHeadline: raw.websiteConfig.heroHeadline ? String(raw.websiteConfig.heroHeadline).trim() : undefined,
            heroSubheadline: raw.websiteConfig.heroSubheadline
              ? String(raw.websiteConfig.heroSubheadline).trim()
              : undefined,
            heroBannerUrl: raw.websiteConfig.heroBannerUrl
              ? String(raw.websiteConfig.heroBannerUrl).trim()
              : undefined,
            aboutSchool: raw.websiteConfig.aboutSchool ? String(raw.websiteConfig.aboutSchool).trim() : undefined,
            admissionSessionLabel: raw.websiteConfig.admissionSessionLabel
              ? String(raw.websiteConfig.admissionSessionLabel).trim()
              : undefined,
          }
        : undefined,
  };
}

async function fetchJsonWithTimeout<T = any>(url: string, timeoutMs = 2500): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAllPublicSchools(forceRefresh = false): Promise<PublicSchoolMeta[]> {
  if (!forceRefresh && cachedSchools && Date.now() - cachedSchools.fetchedAt < CACHE_TTL_MS) {
    return cachedSchools.data;
  }
  if (!forceRefresh && inFlightSchoolsFetch) {
    return inFlightSchoolsFetch;
  }

  const task = (async () => {
    const merged = new Map<string, PublicSchoolMeta>();

    // 1. Primary: Supabase schools table (unlimited reads)
    const sbSchools = await fetchAllSchoolsFromSupabase();
    if (Array.isArray(sbSchools) && sbSchools.length > 0) {
      for (const raw of sbSchools) {
        const meta = sanitizeSchoolMeta(String(raw?.id || ""), raw);
        if (meta && meta.status !== "ARCHIVED" && meta.status !== "DELETED") {
          merged.set(meta.id, meta);
        }
      }
    }

    // 2. Legacy fallback & one-time auto-seed from RTDB schools_profiles if Supabase schools table empty
    if (merged.size === 0) {
      const rtdbProfiles = await fetchJsonWithTimeout<Record<string, any>>(
        `${RTDB_BASE_URL}/schools_profiles.json`,
        2500
      );
      if (rtdbProfiles && typeof rtdbProfiles === "object") {
        for (const [id, raw] of Object.entries(rtdbProfiles)) {
          const meta = sanitizeSchoolMeta(id, raw);
          if (meta && meta.status !== "ARCHIVED" && meta.status !== "DELETED") {
            merged.set(meta.id, meta);
            void upsertSchoolInSupabase(meta.id, raw as Record<string, any>);
          }
        }
      }
    }

    // 3. Fallback: Firestore schools collection REST API (if RTDB & Supabase both empty)
    if (merged.size === 0) {
      const fsData = await fetchJsonWithTimeout<{ documents?: Array<{ name: string; fields?: Record<string, any> }> }>(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/schools?pageSize=50`,
        2800
      );
      if (Array.isArray(fsData?.documents)) {
        for (const docItem of fsData.documents) {
          const docId = docItem.name?.split("/").pop() || "";
          const fieldsObj: Record<string, any> = {};
          if (docItem.fields) {
            for (const [k, v] of Object.entries(docItem.fields)) {
              fieldsObj[k] = decodeFirestoreValue(v);
            }
          }
          const meta = sanitizeSchoolMeta(docId, fieldsObj);
          if (meta && meta.status !== "ARCHIVED" && meta.status !== "DELETED") {
            merged.set(meta.id, meta);
            void upsertSchoolInSupabase(meta.id, fieldsObj);
          }
        }
      }
    }

    const list = Array.from(merged.values());
    if (list.length > 0) {
      cachedSchools = { data: list, fetchedAt: Date.now() };
    }
    return list;
  })();

  inFlightSchoolsFetch = task;
  try {
    return await task;
  } finally {
    if (inFlightSchoolsFetch === task) {
      inFlightSchoolsFetch = null;
    }
  }
}

export function buildShortName(school: PublicSchoolMeta): string {
  const code = (school.code || "").trim();
  if (code.length >= 2 && code.length <= 12) return code.toUpperCase();
  const words = (school.name || "School").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words.map((w) => w[0]?.toUpperCase() || "").join("").slice(0, 6);
    if (initials.length >= 2 && initials.length <= 12) return initials;
  }
  return (school.name || "LMPS").trim().slice(0, 12);
}

export function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isUsableImageUrl(url?: string): boolean {
  if (!url) return false;
  const u = url.trim();
  return u.startsWith("https://") || u.startsWith("http://") || u.startsWith("data:image/") || u.startsWith("/");
}

function isSvgUrl(url?: string): boolean {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  return u.endsWith(".svg") || u.startsWith("data:image/svg+xml");
}

function truncateText(text: string, maxLen: number): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

export async function resolveSchoolBranding(opts: {
  origin: string;
  pathname?: string;
  schoolQuery?: string;
  forceRefresh?: boolean;
}): Promise<ResolvedSchoolBranding> {
  const origin = (opts.origin || "").replace(/\/+$/, "");
  const rawPathname = (opts.pathname || "/").trim() || "/";
  const cleanPath = rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;
  const query = (opts.schoolQuery || "").trim();

  let allSchools: PublicSchoolMeta[];
  if (!opts.forceRefresh && cachedSchools?.data?.length) {
    allSchools = cachedSchools.data;
    if (Date.now() - cachedSchools.fetchedAt >= CACHE_TTL_MS) {
      void fetchAllPublicSchools(false).catch(() => {});
    }
  } else if (opts.forceRefresh) {
    allSchools = await fetchAllPublicSchools(true);
  } else {
    const budgetMs = query ? 1200 : 350;
    allSchools = await Promise.race([
      fetchAllPublicSchools(false),
      new Promise<PublicSchoolMeta[]>((resolve) => setTimeout(() => resolve([]), budgetMs)),
    ]);
  }
  const activeSchools = allSchools.filter((s) => s.status !== "ARCHIVED" && s.status !== "DELETED");
  const nonDemo = activeSchools.filter((s) => !isDemoSchoolEntry(s));
  const pool = nonDemo.length > 0 ? nonDemo : activeSchools;

  const findMatch = (q: string): PublicSchoolMeta | undefined => {
    const cleanQ = q.trim().toLowerCase();
    if (!cleanQ) return undefined;
    return pool.find(
      (s) =>
        s.id.toLowerCase() === cleanQ ||
        (s.code || "").toLowerCase() === cleanQ ||
        (s.websiteConfig?.customSlug || "").toLowerCase() === cleanQ
    );
  };

  let matchedByQuery = false;
  let resolved: PublicSchoolMeta | undefined;

  if (query) {
    resolved = findMatch(query);
    if (resolved) matchedByQuery = true;
  }

  if (!resolved) {
    resolved = pool.find((s) => s.isDefaultPublicWebsite === true);
  }
  if (!resolved) {
    resolved = pool.find(
      (s) =>
        s.id === DEFAULT_SCHOOL_ID ||
        s.name.toLowerCase().includes("life maker") ||
        (s.code || "").toUpperCase() === "LMPS"
    );
  }
  if (!resolved && pool.length > 0) {
    resolved = pool[0];
  }
  if (!resolved) {
    resolved = DEFAULT_FALLBACK_SCHOOL;
  }

  const schoolKey = matchedByQuery ? query : resolved.code || resolved.id;
  const querySuffix = matchedByQuery ? `?school=${encodeURIComponent(schoolKey)}` : "";

  const schoolName = resolved.name || "Life Maker Public School";
  const shortName = buildShortName(resolved);

  const lowerPath = cleanPath.toLowerCase();
  let title = `${schoolName} – Official School Portal & ERP`;
  if (lowerPath.startsWith("/admission")) {
    const sess = resolved.websiteConfig?.admissionSessionLabel || "2027-28";
    title = `Online Admission ${sess} | ${schoolName}`;
  } else if (lowerPath.startsWith("/verify")) {
    title = `Document Verification | ${schoolName}`;
  } else if (lowerPath.startsWith("/login")) {
    title = `Portal Login | ${schoolName}`;
  }

  const rawBannerOrTagline =
    resolved.websiteConfig?.heroSubheadline ||
    resolved.websiteConfig?.aboutSchool ||
    "";
  const baseTagline = resolved.tagline ? `${resolved.tagline}. ` : "";
  const addressSnippet = resolved.address ? `${resolved.address}. ` : "";
  const combinedDesc =
    rawBannerOrTagline && rawBannerOrTagline.length >= 60
      ? rawBannerOrTagline
      : `${baseTagline}${addressSnippet}Official School Portal — Online Admission, Fee Passbook, Live Attendance, Results & Smart Learning.`;
  const description = truncateText(combinedDesc, 160);

  const hasCustomLogo = isUsableImageUrl(resolved.logoUrl) && !isSvgUrl(resolved.logoUrl);
  const hasCustomBanner = isUsableImageUrl(resolved.websiteConfig?.heroBannerUrl) && !isSvgUrl(resolved.websiteConfig?.heroBannerUrl);

  const assetQueryBase = matchedByQuery
    ? `&school=${encodeURIComponent(schoolKey)}`
    : resolved.id && resolved.id !== DEFAULT_FALLBACK_SCHOOL.id
    ? `&school=${encodeURIComponent(resolved.id)}`
    : "";

  const needsServerProxy = (url: string) =>
    url.startsWith("data:") ||
    url.includes("api.telegram.org/file/bot") ||
    url.startsWith("/api/telegram/file");

  const ogImageUrl = hasCustomBanner
    ? needsServerProxy(resolved.websiteConfig!.heroBannerUrl!)
      ? `${origin}/api/school-asset?type=og${assetQueryBase}`
      : resolved.websiteConfig!.heroBannerUrl!.startsWith("/")
      ? `${origin}${resolved.websiteConfig!.heroBannerUrl}`
      : resolved.websiteConfig!.heroBannerUrl!
    : hasCustomLogo
    ? needsServerProxy(resolved.logoUrl!)
      ? `${origin}/api/school-asset?type=og${assetQueryBase}`
      : resolved.logoUrl!.startsWith("/")
      ? `${origin}${resolved.logoUrl}`
      : resolved.logoUrl!
    : `${origin}/opengraph.jpg`;

  const icon192Url = hasCustomLogo
    ? `/api/school-asset?type=icon${assetQueryBase}&size=192`
    : `/icons/icon-192.png?v=3`;
  const icon512Url = hasCustomLogo
    ? `/api/school-asset?type=icon${assetQueryBase}&size=512`
    : `/icons/icon-512.png?v=3`;
  const appleTouchIconUrl = hasCustomLogo
    ? `/api/school-asset?type=icon${assetQueryBase}&size=180`
    : `/icons/apple-touch-icon.png?v=3`;

  const splashLogoUrl = hasCustomLogo
    ? needsServerProxy(resolved.logoUrl!)
      ? `/api/school-asset?type=icon${assetQueryBase}&size=512`
      : resolved.logoUrl!
    : `/icons/icon-512.png?v=3`;
  const splashSubtitle = truncateText(
    resolved.tagline || resolved.address || "Official School Portal & Digital Campus",
    72
  );

  const themeColor =
    resolved.bannerColor && /^#[0-9a-fA-F]{6}$/.test(resolved.bannerColor)
      ? resolved.bannerColor
      : "#121212";

  const canonicalUrl = `${origin}${cleanPath}${querySuffix}`;
  const manifestHref = `/api/manifest${querySuffix}`;

  const isRootDefaultApp = !matchedByQuery;
  const displayBrandName = isRootDefaultApp ? "SCHOOL+" : schoolName;
  const displayShortName = isRootDefaultApp ? "SCHOOL+" : shortName;
  const displayTitle =
    isRootDefaultApp && !lowerPath.startsWith("/admission") && !lowerPath.startsWith("/verify") && !lowerPath.startsWith("/login")
      ? "SCHOOL+ – Official School Portal & ERP"
      : isRootDefaultApp && lowerPath.startsWith("/admission")
      ? `Online Admission ${resolved.websiteConfig?.admissionSessionLabel || "2027-28"} | SCHOOL+`
      : isRootDefaultApp && lowerPath.startsWith("/verify")
      ? "Document Verification | SCHOOL+"
      : isRootDefaultApp && lowerPath.startsWith("/login")
      ? "Portal Login | SCHOOL+"
      : title;

  return {
    school: resolved,
    matchedByQuery,
    queryKey: schoolKey,
    title: displayTitle,
    description,
    shortName: displayShortName,
    siteName: displayBrandName,
    themeColor,
    backgroundColor: "#121212",
    canonicalUrl,
    ogImageUrl,
    splashLogoUrl,
    splashTitle: displayBrandName,
    splashSubtitle,
    manifestHref,
    icon192Url,
    icon512Url,
    appleTouchIconUrl,
  };
}

export function buildSchoolWebManifest(branding: ResolvedSchoolBranding) {
  const startUrl = branding.matchedByQuery
    ? `/?school=${encodeURIComponent(branding.queryKey)}`
    : "/";
  const icons: Array<{ src: string; sizes: string; type: string; purpose: string }> = [
    { src: branding.icon192Url, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: branding.icon512Url, sizes: "512x512", type: "image/png", purpose: "any" },
  ];
  // Only include maskable/monochrome fallback icons when using local padded assets
  if (!branding.icon512Url.startsWith("/api/school-asset")) {
    icons.push(
      { src: "/icons/icon-maskable-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/badge-monochrome.png?v=4", sizes: "192x192", type: "image/png", purpose: "monochrome" }
    );
  }
  return {
    id: startUrl,
    name: branding.matchedByQuery ? (branding.school.name || "SCHOOL+") : "SCHOOL+",
    short_name: branding.matchedByQuery ? (branding.shortName || "SCHOOL+") : "SCHOOL+",
    description: branding.description,
    theme_color: branding.themeColor || "#121212",
    background_color: branding.backgroundColor || "#121212",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    orientation: "any",
    start_url: startUrl,
    scope: "/",
    icons,
  };
}

export function injectSchoolBrandingIntoHtml(
  rawHtml: string,
  branding: ResolvedSchoolBranding
): string {
  const safeTitle = escapeHtml(branding.title);
  const safeDesc = escapeHtml(branding.description);
  const safeSiteName = escapeHtml(branding.siteName);
  const safeShortName = escapeHtml(branding.shortName);
  const safeUrl = escapeHtml(branding.canonicalUrl);
  const safeOgImage = escapeHtml(branding.ogImageUrl);
  const safeManifest = escapeHtml(branding.manifestHref);
  const safeIcon192 = escapeHtml(branding.icon192Url);
  const safeIcon512 = escapeHtml(branding.icon512Url);
  const safeAppleIcon = escapeHtml(branding.appleTouchIconUrl);
  const safeSplashTitle = escapeHtml(branding.splashTitle);
  const safeSplashSub = escapeHtml(branding.splashSubtitle);
  const safeSplashLogo = escapeHtml(branding.splashLogoUrl);

  let html = rawHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  html = html.replace(
    /<meta\s+name="apple-mobile-web-app-title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="apple-mobile-web-app-title" content="${safeShortName}" />`
  );
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );

  // Replace or inject og:image, og:url, og:site_name, twitter:image
  if (/<meta\s+property="og:image"/i.test(html)) {
    html = html.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${safeOgImage}" />`
    );
  } else {
    html = html.replace(
      /<meta\s+property="og:type"[^>]*>/i,
      (m) => `${m}\n    <meta property="og:image" content="${safeOgImage}" />`
    );
  }

  if (/<meta\s+property="og:site_name"/i.test(html)) {
    html = html.replace(
      /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:site_name" content="${safeSiteName}" />`
    );
  } else {
    html = html.replace(
      /<meta\s+property="og:type"[^>]*>/i,
      (m) => `${m}\n    <meta property="og:site_name" content="${safeSiteName}" />`
    );
  }

  if (/<meta\s+property="og:url"/i.test(html)) {
    html = html.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${safeUrl}" />`
    );
  } else {
    html = html.replace(
      /<meta\s+property="og:type"[^>]*>/i,
      (m) => `${m}\n    <meta property="og:url" content="${safeUrl}" />`
    );
  }

  if (/<meta\s+name="twitter:image"/i.test(html)) {
    html = html.replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${safeOgImage}" />`
    );
  } else {
    html = html.replace(
      /<meta\s+name="twitter:card"[^>]*>/i,
      (m) => `${m}\n    <meta name="twitter:image" content="${safeOgImage}" />`
    );
  }

  // Manifest & icons
  if (/<link\s+[^>]*rel=["']manifest["'][^>]*>/i.test(html)) {
    html = html.replace(
      /<link\s+[^>]*rel=["']manifest["'][^>]*>/i,
      `<link rel="manifest" href="${safeManifest}" />`
    );
  } else {
    html = html.replace(/<\/head>/i, `    <link rel="manifest" href="${safeManifest}" />\n  </head>`);
  }
  html = html.replace(
    /<link\s+rel="apple-touch-icon"[^>]*href="[^"]*"\s*\/?>/i,
    `<link rel="apple-touch-icon" sizes="180x180" href="${safeAppleIcon}" />`
  );
  html = html.replace(
    /<link\s+rel="icon"[^>]*sizes="192x192"[^>]*href="[^"]*"\s*\/?>/i,
    `<link rel="icon" type="image/png" sizes="192x192" href="${safeIcon192}" />`
  );
  html = html.replace(
    /<link\s+rel="icon"[^>]*sizes="512x512"[^>]*href="[^"]*"\s*\/?>/i,
    `<link rel="icon" type="image/png" sizes="512x512" href="${safeIcon512}" />`
  );

  // Pre-React Splash Branding
  html = html.replace(
    /(<img[^>]*class="pre-react-splash-logo"[^>]*src=")[^"]*(")/i,
    `$1${safeSplashLogo}$2`
  );
  html = html.replace(
    /(<h1\s+class="pre-react-splash-title">)[\s\S]*?(<\/h1>)/i,
    `$1${safeSplashTitle}$2`
  );
  html = html.replace(
    /(<p\s+class="pre-react-splash-subtitle">)[\s\S]*?(<\/p>)/i,
    `$1${safeSplashSub}$2`
  );
  html = html.replace(
    /(<span\s+class="pre-react-splash-version">)[\s\S]*?(<\/span>)/i,
    `$1${safeShortName}$2`
  );

  // Inject Schema.org JSON-LD for School WebApplication
  const ldJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: branding.school.name,
    url: branding.canonicalUrl,
    logo: branding.ogImageUrl,
    description: branding.description,
    ...(branding.school.address ? { address: branding.school.address } : {}),
  });
  const ldTag = `<script id="nsta-school-ldjson" type="application/ld+json">${ldJson}</script>`;
  if (/<script\s+id="nsta-school-ldjson"[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(/<script\s+id="nsta-school-ldjson"[^>]*>[\s\S]*?<\/script>/i, ldTag);
  } else {
    html = html.replace(/<\/head>/i, `    ${ldTag}\n  </head>`);
  }

  return html;
}

export async function resolveSchoolAssetPayload(opts: {
  schoolQuery?: string;
  type?: "icon" | "og";
}): Promise<{ buffer: Buffer; contentType: string } | { redirectUrl: string }> {
  const assetType = opts.type === "og" ? "og" : "icon";
  const allSchools = await fetchAllPublicSchools(false);
  const activeSchools = allSchools.filter((s) => s.status !== "ARCHIVED" && s.status !== "DELETED");
  const nonDemo = activeSchools.filter((s) => !isDemoSchoolEntry(s));
  const pool = nonDemo.length > 0 ? nonDemo : activeSchools;

  const q = (opts.schoolQuery || "").trim().toLowerCase();
  let school: PublicSchoolMeta | undefined;
  if (q) {
    school = pool.find(
      (s) =>
        s.id.toLowerCase() === q ||
        (s.code || "").toLowerCase() === q ||
        (s.websiteConfig?.customSlug || "").toLowerCase() === q
    );
  }
  if (!school) {
    school =
      pool.find((s) => s.isDefaultPublicWebsite === true) ||
      pool.find(
        (s) =>
          s.id === DEFAULT_SCHOOL_ID ||
          s.name.toLowerCase().includes("life maker") ||
          (s.code || "").toUpperCase() === "LMPS"
      ) ||
      pool[0] ||
      DEFAULT_FALLBACK_SCHOOL;
  }

  const candidateUrl =
    assetType === "og"
      ? school?.websiteConfig?.heroBannerUrl || school?.logoUrl
      : school?.logoUrl;

  if (candidateUrl && candidateUrl.startsWith("data:image/")) {
    const match = candidateUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (match) {
      return {
        contentType: match[1],
        buffer: Buffer.from(match[2], "base64"),
      };
    }
  }

  if (candidateUrl && candidateUrl.startsWith("/api/telegram/file")) {
    try {
      const parsed = extractTelegramParamsFromUrl(candidateUrl);
      if (parsed && (parsed.fileId || parsed.path)) {
        const fetched = await fetchTelegramFileBuffer({
          fileId: parsed.fileId,
          filePath: parsed.path,
          fileName: parsed.name,
          timeoutMs: 4500,
        });
        if (fetched && fetched.contentType.startsWith("image/") && !fetched.contentType.includes("svg") && fetched.buffer.length > 64) {
          return { contentType: fetched.contentType, buffer: fetched.buffer };
        }
      }
    } catch {
      // Fall through to local fallback
    }
  }

  if (candidateUrl && (candidateUrl.startsWith("https://") || candidateUrl.startsWith("http://"))) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const r = await fetch(candidateUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        let ct = (r.headers.get("content-type") || "").toLowerCase();
        // Detect image type from magic bytes when CDN returns application/octet-stream (e.g. Telegram documents)
        if (!ct.startsWith("image/") || ct.includes("octet-stream")) {
          if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
            ct = "image/png";
          } else if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
            ct = "image/jpeg";
          } else if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
            ct = "image/webp";
          }
        }
        if (ct.startsWith("image/") && !ct.includes("svg") && buf.length > 64) {
          return { contentType: ct, buffer: buf };
        }
      }
    } catch {
      // Fall through to local fallback
    }
  }

  return {
    redirectUrl: assetType === "og" ? "/opengraph.jpg" : "/icons/icon-512.png?v=3",
  };
}
