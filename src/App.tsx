// @ts-nocheck
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  GraduationCap,
  School,
  Shield,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  LogOut,
  User as UserIcon,
  Globe
} from 'lucide-react';
import { auth, logoutUser, getFreshUserData, getUserData, getUserByEmail, getUserByLinkedGoogleUid, saveUserToLive, ensureFirebaseAuthSession } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { DevelopedByCredit } from './components/school/DevelopedByFooter';
import {
  DEFAULT_LIFE_MAKER_SCHOOL,
  DEFAULT_SCHOOL_ID,
  getAllSchools,
  getLocalSchools,
  getClasses,
  getLocalClasses,
  getSessions,
  isDemoDataEnabled,
  isDemoRecord,
  shouldUseDemoForSchool,
} from './school-firebase';
import { buildDefaultClassesFrom2027Chart } from './utils/schoolFeeChart2027';
import type { School as SchoolEntity, SchoolClass, SchoolSession } from './school-types';
import { resolveWebsiteAdmissionSessionLabel } from './utils/safeBrowserActions';
import { getSavedSchoolLogo } from './utils/schoolLogoUtils';
import {
  initGlobalBackNavigation,
  syncCurrentUrlForBackNavigation,
  useBackHandler,
} from './utils/backNavigation';

// Resilient dynamic import helper that retries transient network or dev-server warm-up blips
function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  moduleName: string = 'Module'
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        console.warn(`[lazyWithRetry] Attempt ${attempt + 1}/5 for ${moduleName} failed:`, err);
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
    console.error(`[lazyWithRetry] All attempts failed for ${moduleName}:`, lastError);
    try {
      const reloadKey = '__nsta_lazy_chunk_reload';
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
      if (Date.now() - lastReload > 8000) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
      }
    } catch {}
    // Return a self-contained fallback screen instead of throwing to avoid crashing the whole root app
    const FailureFallback: React.FC<any> = (props) => (
      <div className="flex-1 min-h-screen min-h-[100dvh] w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mb-4 text-amber-400">
          ⚠️
        </div>
        <h3 className="text-lg font-bold mb-2">Notice: {moduleName} Load Delay</h3>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          The connection was momentarily interrupted while fetching this section. Please retry or refresh.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            Reload Page
          </button>
          {props?.onBack && (
            <button
              onClick={props.onBack}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-colors border border-slate-700 cursor-pointer"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
    return { default: FailureFallback as unknown as T };
  });
}

// Dynamic lazy imports for smooth chunk loading & performance
const SchoolEcosystem = lazyWithRetry(
  () => import('./components/school/SchoolEcosystem').then(m => ({ default: m.SchoolEcosystem || (m as any).default })),
  'School ERP'
);

const Auth = lazyWithRetry(
  () => import('./components/Auth').then(m => ({ default: m.Auth || (m as any).default })),
  'Auth Portal'
);

const DocumentVerificationView = lazyWithRetry(
  () => import('./components/school/DocumentVerificationView').then(m => ({ default: m.DocumentVerificationView || (m as any).default })),
  'Document Verification Portal'
);

const DriverTripConsole = lazyWithRetry(
  () => import('./components/school/DriverTripConsole').then(m => ({ default: m.DriverTripConsole || (m as any).default })),
  'Driver GPS Dashboard'
);

const PublicSchoolWebsite = lazyWithRetry(
  () => import('./components/school/PublicSchoolWebsite').then(m => ({ default: m.PublicSchoolWebsite || (m as any).default })),
  'School Website'
);

const OnlineAdmissionManager = lazyWithRetry(
  () => import('./components/school/OnlineAdmissionManager').then(m => ({ default: m.OnlineAdmissionManager || (m as any).default })),
  'Online Admission 2027-28'
);

const PwaInstallPrompt = lazy(() =>
  import('./components/PwaInstallPrompt').then(m => ({ default: m.PwaInstallPrompt || (m as any).default }))
);
const NotificationPrompt = lazy(() =>
  import('./components/NotificationPrompt').then(m => ({ default: m.NotificationPrompt || (m as any).default }))
);
const NotificationPermissionGate = lazy(() =>
  import('./components/NotificationPermissionGate').then(m => ({ default: m.NotificationPermissionGate || (m as any).default }))
);

import { PublicWebsiteTopBar, type WebsiteTopNavSection } from './components/school/PublicWebsiteTopBar';

export type AppViewMode = 'SCHOOL_ERP' | 'DRIVER';
export type PublicRoutePath = '/' | '/admission' | '/login' | '/verify';

const normalizeRoutePath = (pathname?: string): PublicRoutePath => {
  const clean = (pathname || '/').trim().toLowerCase();
  if (clean.startsWith('/admission')) return '/admission';
  if (clean.startsWith('/login')) return '/login';
  if (clean.startsWith('/verify')) return '/verify';
  return '/';
};

const getSchoolParamFromUrl = (): string => {
  try {
    const p = new URLSearchParams(window.location.search);
    return (p.get('school') || p.get('schoolId') || p.get('s') || '').trim();
  } catch {
    return '';
  }
};

export const isSuperAdminEmail = (emailStr?: string | null): boolean => {
  if (!emailStr) return false;
  const clean = emailStr.trim().toLowerCase();
  return (
    clean === 'nsbdhdh70@gmail.com' ||
    clean === 'nadimanwar794@gmail.com' ||
    clean === 'nadimanwar794@gmsil.com' ||
    clean === 'nsdimanwar794@gmail.com' ||
    clean === 'nadiman0636indo@gmail.com' ||
    clean === 'n44438403@gmail.com' ||
    clean === 'fgkfgffhgg@gmail.com' ||
    clean === 'ghduug6@gmail.com' ||
    clean === 'nadim841414s@gmail.com' ||
    clean.startsWith('nadimanwar') ||
    clean.startsWith('nadim841414') ||
    clean.startsWith('nsbdhdh') ||
    clean === 'superadmin' ||
    clean === 'admin'
  );
};

export const isSchoolAdminEmail = (emailStr?: string | null): boolean => {
  if (!emailStr) return false;
  const clean = emailStr.trim().toLowerCase();
  if (isSuperAdminEmail(clean)) return false;
  return (
    clean === 'admin@dps.edu.in' ||
    clean === 'dpsgurgaon45@dps.edu.in' ||
    clean === 'principal@dps.edu.in' ||
    clean.includes('schooladmin') ||
    clean.includes('school_admin') ||
    clean.startsWith('school.') ||
    clean.startsWith('admin@')
  );
};

export const isSchoolAdminRole = (u?: any): boolean => {
  if (!u) return false;
  if (isSuperAdminEmail(u.email)) return false;
  const r = (u.role || '').toString().trim().toUpperCase();
  const sr = (u.schoolRole || '').toString().trim().toUpperCase();
  const ut = (u.userType || '').toString().trim().toUpperCase();
  return (
    r === 'SCHOOL_ADMIN' ||
    r === 'SCHOOLADMIN' ||
    r === 'PRINCIPAL' ||
    r === 'SCHOOL_SUB_ADMIN' ||
    sr === 'ADMIN' ||
    sr === 'SCHOOL_ADMIN' ||
    ut === 'SCHOOL_ADMIN' ||
    isSchoolAdminEmail(u.email) ||
    u.provider === 'admin_login' ||
    u.provider === 'school_admin_quick_login' ||
    u.provider === 'school_admin_direct_login' ||
    u.id === 'admin_uid' ||
    u.uid === 'admin_uid'
  );
};

export const isAdminUser = (u?: any): boolean => {
  if (!u) return false;
  if (isSchoolAdminRole(u)) return false;
  const r = (u.role || '').toString().trim().toUpperCase();
  if (r === 'SCHOOL_ADMIN' || r === 'SCHOOLADMIN' || r === 'PRINCIPAL' || r === 'TEACHER' || r === 'ACCOUNTANT') {
    return false;
  }
  if (isSchoolAdminEmail(u.email)) return false;
  if (u.email && u.email.toLowerCase().endsWith('.edu.in')) return false;

  if (isSuperAdminEmail(u.email)) return true;
  if (r === 'SUPERADMIN' || r === 'SUPER_ADMIN' || r === 'ADMIN') return true;
  if (u.isAdmin === true || u.isSuperAdmin === true || u.userType === 'ADMIN') return true;
  if (
    u.provider === 'superadmin_master_login' ||
    u.provider === 'superadmin_login' ||
    u.provider === 'firebase_admin_login' ||
    u.provider === 'admin_console_login'
  ) return true;
  if (u.id === 'super_admin_nadim' || u.uid === 'super_admin_nadim') return true;
  return false;
};

export const isSchoolPortalUser = (u?: any): boolean => {
  if (!u) return false;
  if (isSuperAdminEmail(u.email) || u.id === 'super_admin_nadim' || u.uid === 'super_admin_nadim') return false;
  if (isSchoolAdminRole(u)) return true;
  const r = (u.role || '').toString().trim().toUpperCase();
  const sr = (u.schoolRole || '').toString().trim().toUpperCase();
  const ut = (u.userType || '').toString().trim().toUpperCase();
  const prov = (u.provider || '').toString().trim().toLowerCase();
  const emailLower = (u.email || '').toString().trim().toLowerCase();
  if (r === 'DRIVER' || isAdminUser(u)) return false;
  return Boolean(
    ut === 'SCHOOL_STUDENT' ||
    r === 'SCHOOL_STUDENT' ||
    r === 'TEACHER' ||
    r === 'ACCOUNTANT' ||
    sr === 'TEACHER' ||
    sr === 'ACCOUNTANT' ||
    sr === 'STUDENT' ||
    Boolean(u.schoolRole) ||
    Boolean(u.admissionNo) ||
    Boolean(u.studentId) ||
    Boolean(u.teacherId) ||
    emailLower.endsWith('.edu.in') ||
    emailLower.includes('@student.') ||
    emailLower.includes('@teacher.') ||
    prov === 'qr_student_id' ||
    prov === 'qr_teacher_id' ||
    prov === 'face_recognition_login' ||
    prov === 'student_record' ||
    prov === 'teacher_record' ||
    prov === 'accountant_record' ||
    (Boolean(u.schoolId) && String(u.schoolId).trim() !== '')
  );
};

export const DEFAULT_SUPERADMIN_USER = {
  id: 'super_admin_nadim',
  uid: 'super_admin_nadim',
  displayId: 'SUPERADMIN',
  name: 'Nadim Anwar (Super Admin)',
  email: 'ghduug6@gmail.com',
  mobile: '9525400122',
  role: 'SUPERADMIN',
  schoolId: '',
  credits: 99999,
  diamonds: 99999,
  streak: 100,
  totalScore: 9999,
  profileCompleted: true,
  subscriptionTier: 'PRO',
  provider: 'superadmin_master_login',
  isAdmin: true,
  isSuperAdmin: true,
};

const getInitialUser = () => {
  try {
    if (localStorage.getItem('nst_logged_out') === 'true') {
      return null;
    }
    const raw = localStorage.getItem('nst_current_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.uid)) {
        if (isSuperAdminEmail(parsed.email) || parsed.id === 'super_admin_nadim' || parsed.uid === 'super_admin_nadim') {
          parsed.role = 'SUPERADMIN';
          parsed.isAdmin = true;
          parsed.isSuperAdmin = true;
          parsed.schoolId = '';
          parsed.schoolName = null;
          parsed.schoolRole = null;
          parsed.schoolCode = null;
        } else if (isSchoolAdminRole(parsed)) {
          parsed.role = 'SCHOOL_ADMIN';
          parsed.schoolRole = 'SCHOOL_ADMIN';
          if (!parsed.schoolId || parsed.schoolId === 'dps_gurgaon_sector45') {
            const storedActive = localStorage.getItem('nst_active_school_id');
            parsed.schoolId =
              storedActive && storedActive !== 'dps_gurgaon_sector45'
                ? storedActive
                : DEFAULT_SCHOOL_ID;
          }
        } else if (isAdminUser(parsed)) {
          parsed.role = 'ADMIN';
        }
        return parsed;
      }
    }
  } catch (e) {}

  return null;
};

const getInitialSettings = () => {
  try {
    const raw = localStorage.getItem('nst_system_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        const legacyNames = ['School ERP', 'LIFE MAKER', 'Life Maker', 'LIFE MAKER PUBLIC SCHOOL', 'Life Maker Public School'];
        if (!parsed.appName || legacyNames.includes(String(parsed.appName).trim())) {
          parsed.appName = 'SCHOOL+';
        }
        if (!parsed.appShortName || ['ERP', 'LMPS'].includes(String(parsed.appShortName).trim())) {
          parsed.appShortName = 'SCHOOL+';
        }
        return parsed;
      }
    }
  } catch (e) {}

  return {
    appName: 'SCHOOL+',
    appShortName: 'SCHOOL+',
    appVersion: '2.0',
    contactNumber: '9876543210',
    contactEmail: 'support@nsta.app',
    websiteUrl: 'https://nsta.app',
    maintenanceMode: false,
    hiddenFeatures: [],
    splashFontId: 'default',
  };
};

export function App() {
  const [user, setUser] = useState<any>(getInitialUser);
  const [view, setView] = useState<AppViewMode>(() => {
    try {
      const u = getInitialUser();
      if (u && (u?.role || '').toString().trim().toUpperCase() === 'DRIVER') return 'DRIVER';
    } catch {}
    return 'SCHOOL_ERP';
  });

  const handleSetView = (newView: AppViewMode) => {
    setView(newView);
    try {
      localStorage.setItem('nst_app_view_mode', newView);
    } catch {}
  };
  const [settings, setSettings] = useState<any>(getInitialSettings);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nst_dark_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [erpTheme, setErpTheme] = useState<'white' | 'black' | 'current'>(() => {
    try {
      const t = localStorage.getItem('nst_app_theme') || localStorage.getItem('nst_student_theme');
      if (t === 'white' || t === 'black' || t === 'current') return t;
    } catch {}
    return 'current';
  });
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);
  const [routePath, setRoutePath] = useState<PublicRoutePath>(() => {
    try {
      return normalizeRoutePath(window.location.pathname);
    } catch {
      return '/';
    }
  });
  const [urlSchoolParam, setUrlSchoolParam] = useState<string>(() => getSchoolParamFromUrl());
  const [showPublicWebsite, setShowPublicWebsite] = useState<boolean>(() => {
    try {
      const path = normalizeRoutePath(window.location.pathname);
      if (path === '/login') return false;
      const sp = new URLSearchParams(window.location.search);
      const isPortalLink = sp.get('schoolPortal') === '1' || Boolean(sp.get('schoolTab'));
      if (isPortalLink && getInitialUser()) return false;
      return true;
    } catch {
      return true;
    }
  });
  const [publicSchools, setPublicSchools] = useState<SchoolEntity[]>(() => {
    try {
      const local = getLocalSchools();
      return Array.isArray(local) ? local : [];
    } catch {
      return [];
    }
  });
  const [selectedPublicSchoolId, setSelectedPublicSchoolId] = useState<string>(() => {
    try {
      const fromUrl = getSchoolParamFromUrl();
      if (fromUrl) return fromUrl;
      const stored = localStorage.getItem('selectedPublicSchoolId') || '';
      return stored === 'dps_gurgaon_sector45' ? '' : stored;
    } catch {
      return '';
    }
  });
  const [publicAdmClasses, setPublicAdmClasses] = useState<SchoolClass[]>([]);
  const [publicAdmSessions, setPublicAdmSessions] = useState<SchoolSession[]>([]);

  const navigateToPath = (
    targetPath: PublicRoutePath,
    options?: { searchParams?: Record<string, string>; clearSearch?: boolean }
  ) => {
    try {
      const url = new URL(window.location.href);
      url.pathname = targetPath;
      if (options?.clearSearch) {
        url.search = '';
        url.hash = '';
      }
      if (options?.searchParams) {
        Object.entries(options.searchParams).forEach(([k, v]) => {
          if (v) url.searchParams.set(k, v);
          else url.searchParams.delete(k);
        });
      }
      const nextRelative = `${url.pathname}${url.search}${url.hash}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextRelative) {
        window.history.pushState({ routePath: targetPath }, '', nextRelative);
        syncCurrentUrlForBackNavigation();
      }
      setUrlSchoolParam(url.searchParams.get('school') || url.searchParams.get('schoolId') || url.searchParams.get('s') || '');
    } catch {}
    setRoutePath(targetPath);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  useBackHandler(
    Boolean(user && showPublicWebsite && routePath === '/'),
    () => {
      setShowPublicWebsite(false);
    },
    0
  );

  useEffect(() => {
    return initGlobalBackNavigation(() => {
      const nextRoute = normalizeRoutePath(window.location.pathname);
      setRoutePath(nextRoute);
      setUrlSchoolParam(getSchoolParamFromUrl());
      if (nextRoute === '/login') {
        setShowPublicWebsite(false);
        setShowBootSplash(false);
      } else if (nextRoute === '/admission') {
        setShowBootSplash(false);
        setShowPublicWebsite(true);
      } else if (nextRoute === '/') {
        setShowBootSplash(false);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    const loadSchools = async () => {
      try {
        const list = await getAllSchools();
        if (active && Array.isArray(list) && list.length > 0) {
          setPublicSchools(list);
        }
      } catch {}
    };
    loadSchools();
    const onSchoolListRefresh = () => {
      loadSchools();
    };
    const onSchoolProfileUpdated = (e: any) => {
      const sid = e?.detail?.schoolId;
      const patch = e?.detail?.data;
      if (sid && patch && typeof patch === 'object') {
        setPublicSchools((prev) =>
          prev.map((s) => (s.id === sid ? ({ ...s, ...patch } as SchoolEntity) : s))
        );
      } else {
        loadSchools();
      }
    };
    window.addEventListener('nst_school_identity_updated', onSchoolListRefresh);
    window.addEventListener('school-profile-updated', onSchoolProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener('nst_school_identity_updated', onSchoolListRefresh);
      window.removeEventListener('school-profile-updated', onSchoolProfileUpdated);
    };
  }, []);

  const visiblePublicSchools = useMemo(() => {
    const activeList = (publicSchools || []).filter(
      (s: any) =>
        s &&
        s.status !== 'ARCHIVED' &&
        s.status !== 'DELETED' &&
        s.id !== 'dps_gurgaon_sector45' &&
        s.id !== 'demo_school'
    );
    const nonDemo = activeList.filter((s: any) => !isDemoRecord(s));
    if (nonDemo.length > 0) return nonDemo;
    if (activeList.length > 0) return activeList;
    return [DEFAULT_LIFE_MAKER_SCHOOL as SchoolEntity];
  }, [publicSchools]);

  const activePublicSchool: SchoolEntity = useMemo(() => {
    const matchSchool = (query?: string) => {
      const q = (query || '').trim().toLowerCase();
      if (!q || q === 'dps_gurgaon_sector45') return undefined;
      return visiblePublicSchools.find(
        (s) =>
          (s.id || '').toLowerCase() === q ||
          (s.code || '').toLowerCase() === q ||
          (s.websiteConfig?.customSlug || '').toLowerCase() === q
      );
    };

    // Priority: URL ?school= > localStorage/selectedPublicSchoolId > isDefaultPublicWebsite > Life Maker Public School > first active school
    if (urlSchoolParam) {
      const fromUrl = matchSchool(urlSchoolParam);
      if (fromUrl) return fromUrl;
    }
    const fromSelected = matchSchool(selectedPublicSchoolId);
    if (fromSelected) return fromSelected;

    try {
      const storedId = localStorage.getItem('selectedPublicSchoolId');
      if (storedId && storedId.toLowerCase() !== 'nstz' && storedId !== 'dps_gurgaon_sector45') {
        const fromStorage = matchSchool(storedId);
        if (fromStorage) return fromStorage;
      }
    } catch {}

    const explicitDefault = visiblePublicSchools.find((s) => s.isDefaultPublicWebsite === true);
    if (explicitDefault) return explicitDefault;

    const lifeMakerDefault = visiblePublicSchools.find(
      (s) =>
        s.id === DEFAULT_SCHOOL_ID ||
        (s.name || '').toLowerCase().includes('life maker') ||
        (s.code || '').toUpperCase() === 'LMPS'
    );
    if (lifeMakerDefault) return lifeMakerDefault;

    return visiblePublicSchools[0];
  }, [visiblePublicSchools, urlSchoolParam, selectedPublicSchoolId]);

  const handleSelectPublicSchool = (schoolId: string) => {
    setSelectedPublicSchoolId(schoolId);
    try {
      localStorage.setItem('selectedPublicSchoolId', schoolId);
      const url = new URL(window.location.href);
      if (url.searchParams.has('school') || url.searchParams.has('schoolId') || url.searchParams.has('s')) {
        url.searchParams.set('school', schoolId);
        url.searchParams.delete('schoolId');
        url.searchParams.delete('s');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        setUrlSchoolParam(schoolId);
      }
    } catch {}
  };

  useEffect(() => {
    const authTimer = setTimeout(() => {
      ensureFirebaseAuthSession().catch(() => {});
    }, 1200);
    try {
      if (!isDemoDataEnabled()) {
        const cleanedFlag = 'nst_real_school_demo_cleanup_v1';
        if (!localStorage.getItem(cleanedFlag)) {
          const keysToPurge: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (
              k.includes('dps_gurgaon_sector45') ||
              k.startsWith('nst_demo_school_all_sessions_dataset') ||
              k.startsWith('nst_crm_demo_seeded_')
            ) {
              keysToPurge.push(k);
            }
          }
          keysToPurge.forEach((k) => {
            try { localStorage.removeItem(k); } catch {}
          });
          localStorage.setItem(cleanedFlag, '1');
        }
      }
    } catch {}
    return () => clearTimeout(authTimer);
  }, []);

  useEffect(() => {
    if (!activePublicSchool?.id) return;
    let active = true;
    const sid = activePublicSchool.id;
    const isLifeMaker =
      sid === DEFAULT_SCHOOL_ID ||
      (activePublicSchool.name || '').toLowerCase().includes('life maker');
    const allowDemo = shouldUseDemoForSchool(sid);
    const localCls = getLocalClasses(sid).filter((c: any) => allowDemo || !isDemoRecord(c));
    setPublicAdmClasses(
      localCls.length > 0
        ? localCls
        : isLifeMaker
        ? buildDefaultClassesFrom2027Chart(sid)
        : []
    );
    getClasses(sid)
      .then((cls) => {
        if (!active) return;
        const real = (cls || []).filter((c: any) => allowDemo || !isDemoRecord(c));
        if (real.length > 0) {
          setPublicAdmClasses(real);
        } else if (allowDemo) {
          import('./components/school/demoDataStore')
            .then(({ getDemoSchoolDataset }) => {
              if (active) setPublicAdmClasses(getDemoSchoolDataset()?.classes || []);
            })
            .catch(() => {});
        } else if (isLifeMaker) {
          setPublicAdmClasses(buildDefaultClassesFrom2027Chart(sid));
        } else {
          setPublicAdmClasses([]);
        }
      })
      .catch(() => {});
    getSessions(sid)
      .then((sess) => {
        if (!active) return;
        const cleanSess = (Array.isArray(sess) ? sess : []).filter(
          (s: any) => allowDemo || (!isDemoRecord(s) && !String(s?.id || '').toLowerCase().startsWith('demo_'))
        );
        if (cleanSess.length > 0) {
          setPublicAdmSessions(cleanSess);
        } else if (allowDemo) {
          import('./components/school/demoDataStore')
            .then(({ getDemoSchoolDataset }) => {
              if (active) setPublicAdmSessions(getDemoSchoolDataset()?.sessions || []);
            })
            .catch(() => {});
        } else {
          setPublicAdmSessions([
            {
              id: 'sess_default_2027_28',
              schoolId: sid,
              name: 'Academic Session 2027-28',
              startDate: '2027-04-01',
              endDate: '2028-03-31',
              active: true,
              createdAt: new Date().toISOString(),
            } as SchoolSession,
          ]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activePublicSchool?.id, activePublicSchool?.name]);

  // Keep browser document title, manifest link, and PWA meta synced with SCHOOL+ / active school
  useEffect(() => {
    if (!activePublicSchool?.name || typeof document === 'undefined') return;
    const schoolName = activePublicSchool.name.trim();
    const isDefaultAppHome = activePublicSchool.id === DEFAULT_SCHOOL_ID && !urlSchoolParam;
    const brandTitleName = isDefaultAppHome ? 'SCHOOL+' : schoolName;
    const shortName = isDefaultAppHome
      ? 'SCHOOL+'
      : (activePublicSchool.code || '').trim().slice(0, 12) || schoolName.slice(0, 12);
    const schoolDesc = isDefaultAppHome
      ? 'SCHOOL+ Official Digital Campus — Online Admission, Fee Passbook, Live Attendance, Exam Results & Smart Learning.'
      : activePublicSchool.websiteConfig?.heroSubheadline ||
        activePublicSchool.websiteConfig?.aboutSchool ||
        activePublicSchool.tagline ||
        `Official Digital Campus of ${schoolName} — Online Admission, Fee Passbook, Attendance & Results.`;

    const pageTitle =
      routePath === '/admission'
        ? `Online Admission | ${brandTitleName}`
        : routePath === '/verify'
        ? `Document Verification | ${brandTitleName}`
        : isDefaultAppHome
        ? `SCHOOL+ – Official School Portal & ERP`
        : `${schoolName} · SCHOOL+`;

    document.title = pageTitle;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', schoolDesc);
    setMeta('meta[property="og:title"]', pageTitle);
    setMeta('meta[property="og:description"]', schoolDesc);
    setMeta('meta[property="og:site_name"]', brandTitleName);
    setMeta('meta[name="twitter:title"]', pageTitle);
    setMeta('meta[name="twitter:description"]', schoolDesc);
    setMeta('meta[name="apple-mobile-web-app-title"]', shortName);

    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      const schoolParam = urlSchoolParam || activePublicSchool.code || activePublicSchool.id;
      const isDefaultFallback = activePublicSchool.id === DEFAULT_SCHOOL_ID && !urlSchoolParam;
      manifestLink.setAttribute(
        'href',
        !isDefaultFallback && schoolParam
          ? `/api/manifest?school=${encodeURIComponent(schoolParam)}`
          : '/api/manifest'
      );
    }
  }, [activePublicSchool, routePath, urlSchoolParam]);

  const [bootSplashMode, setBootSplashMode] = useState<'boot' | 'to_app' | 'to_website'>('boot');
  const [bootSplashKey, setBootSplashKey] = useState<number>(1);
  // Play the 5-second 3D boot splash on app launch (excluding standalone verification / driver console)
  const [showBootSplash, setShowBootSplash] = useState<boolean>(() => {
    try {
      const path = (window.location.pathname || '').toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (path.startsWith('/verify') || params.get('driverConsole') === '1' || params.get('driver') === '1') {
        return false;
      }
    } catch {}
    return true;
  });

  const triggerSplash = (mode: 'boot' | 'to_app' | 'to_website') => {
    setBootSplashMode(mode);
    setBootSplashKey((k) => k + 1);
    setShowBootSplash(true);
  };

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Real-time synchronization when school notes or settings are updated
  useEffect(() => {
    const handleSettingsUpdated = () => {
      try {
        const raw = localStorage.getItem('nst_system_settings');
        if (raw) setSettings(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('nst_system_settings_updated', handleSettingsUpdated);
    window.addEventListener('nst-school-curriculum-notes-updated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);
    return () => {
      window.removeEventListener('nst_system_settings_updated', handleSettingsUpdated);
      window.removeEventListener('nst-school-curriculum-notes-updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
    };
  }, []);

  // Guarantee pre-react splash screen dismissal immediately
  useEffect(() => {
    const splash = document.getElementById('pre-react-splash');
    if (splash) {
      try { splash.remove(); } catch {}
    }
    if (typeof (window as any).hidePreReactSplash === 'function') {
      (window as any).hidePreReactSplash();
    }
  }, []);

  const [schoolIdentityRev, setSchoolIdentityRev] = useState(0);

  useEffect(() => {
    const bumpIdentity = () => setSchoolIdentityRev((r) => r + 1);
    window.addEventListener('nst_school_identity_updated', bumpIdentity);
    window.addEventListener('storage', bumpIdentity);
    return () => {
      window.removeEventListener('nst_school_identity_updated', bumpIdentity);
      window.removeEventListener('storage', bumpIdentity);
    };
  }, []);

  // Automatic Web Push Registration & Re-sync (Chrome Browser + Installed PWA):
  // Whenever Notification.permission === 'granted', silently ensure the device's
  // Web Push subscription & school/class metadata stay registered on the server.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const rebindTimer = setTimeout(() => {
      import('./utils/schoolPushClient').then(({ autoSyncSchoolPushIfPermitted }) => {
        const studentList: any[] = [];
        let resolvedSchoolId = '';
        try {
          resolvedSchoolId = localStorage.getItem('nst_active_school_id') || '';
          const activeStdRaw =
            localStorage.getItem('nst_active_student') || localStorage.getItem('nst_cached_student');
          if (activeStdRaw) {
            const parsed = JSON.parse(activeStdRaw);
            if (parsed?.id) {
              studentList.push(parsed);
              if (!resolvedSchoolId && parsed.schoolId) resolvedSchoolId = String(parsed.schoolId);
            }
          }
          const linkedRaw = localStorage.getItem('nst_linked_students');
          if (linkedRaw) {
            const parsedLinked = JSON.parse(linkedRaw);
            if (Array.isArray(parsedLinked)) {
              parsedLinked.forEach((st: any) => {
                if (st?.id && !studentList.some((s) => s.id === st.id)) {
                  studentList.push(st);
                  if (!resolvedSchoolId && st.schoolId) resolvedSchoolId = String(st.schoolId);
                }
              });
            }
          }
          const curUserRaw = localStorage.getItem('nst_current_user');
          if (curUserRaw) {
            const cu = JSON.parse(curUserRaw);
            if (!resolvedSchoolId && cu?.schoolId) resolvedSchoolId = String(cu.schoolId);
          }
        } catch (_) {}

        autoSyncSchoolPushIfPermitted({
          userId: user?.uid || user?.id || studentList[0]?.id || 'guest',
          schoolId: resolvedSchoolId || undefined,
          students: studentList,
        }).catch(() => {});
      });
    }, 1200);
    return () => clearTimeout(rebindTimer);
  }, [user?.id, user?.uid, schoolIdentityRev]);

  // Sync settings updates to storage
  const handleUpdateSettings = (updatedSettings: any) => {
    setSettings(updatedSettings);
    try {
      localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));
    } catch (e) {}
  };

  const handleLogin = (newUser: any, options?: { keepWebsiteOpen?: boolean }) => {
    if (!options?.keepWebsiteOpen) {
      setShowPublicWebsite(false);
      setShowBootSplash(false);
      try {
        const curPath = normalizeRoutePath(window.location.pathname);
        if (curPath === '/login' || curPath === '/admission') {
          navigateToPath('/', { clearSearch: true });
        }
      } catch {}
    }
    // 0. Bus Driver: DIRECT TO DEDICATED DRIVER GPS DASHBOARD!
    if (newUser && (newUser.role || '').toString().trim().toUpperCase() === 'DRIVER') {
      newUser.role = 'DRIVER';
      try {
        localStorage.removeItem('nst_logged_out');
        localStorage.setItem('nst_current_user', JSON.stringify(newUser));
        localStorage.setItem('nst_app_view_mode', 'DRIVER');
        if (newUser.schoolId) {
          localStorage.setItem('nst_active_school_id', newUser.schoolId);
        }
      } catch (e) {}
      setUser(newUser);
      setView('DRIVER');
      return;
    }

    // 1. Super Admin: DIRECT TO SCHOOL ERP SUPERADMIN HUB!
    if (newUser && (isSuperAdminEmail(newUser.email) || newUser.id === 'super_admin_nadim' || newUser.uid === 'super_admin_nadim' || newUser.role === 'SUPERADMIN')) {
      newUser.role = 'SUPERADMIN';
      newUser.isAdmin = true;
      newUser.isSuperAdmin = true;
      newUser.schoolId = '';
      try {
        localStorage.removeItem('nst_logged_out');
        localStorage.setItem('nst_current_user', JSON.stringify(newUser));
        localStorage.setItem('nst_app_view_mode', 'SCHOOL_ERP');
      } catch (e) {}
      setUser(newUser);
      setView('SCHOOL_ERP');
      return;
    }

    // 2. School Admin (Principal / School Incharge): DIRECT TO SCHOOL ADMIN DASHBOARD!
    if (isSchoolAdminRole(newUser)) {
      newUser.role = 'SCHOOL_ADMIN';
      newUser.schoolRole = 'SCHOOL_ADMIN';
      const rawTargetSchool = newUser.schoolId || localStorage.getItem('nst_active_school_id') || '';
      const targetSchool = !rawTargetSchool || rawTargetSchool === 'dps_gurgaon_sector45' ? DEFAULT_SCHOOL_ID : rawTargetSchool;
      newUser.schoolId = targetSchool;
      try {
        localStorage.removeItem('nst_logged_out');
        localStorage.setItem('nst_current_user', JSON.stringify(newUser));
        localStorage.setItem('nst_active_school_id', targetSchool);
        localStorage.setItem('nst_app_view_mode', 'SCHOOL_ERP');
        localStorage.setItem('nst_school_admin_active_tab', 'home');
      } catch (e) {}
      setUser(newUser);
      setView('SCHOOL_ERP');
      return;
    }

    // 3. All other School Roles (Teacher, Accountant, School Student, Parent): DIRECT TO SCHOOL ERP PORTAL!
    try {
      localStorage.removeItem('nst_logged_out');
      localStorage.setItem('nst_current_user', JSON.stringify(newUser));
      localStorage.setItem('nst_app_view_mode', 'SCHOOL_ERP');
      if (newUser?.schoolId) {
        localStorage.setItem('nst_active_school_id', newUser.schoolId);
      }
    } catch (e) {}
    setUser(newUser);
    setView('SCHOOL_ERP');
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.warn('[App] logoutUser error:', e);
    }
    try {
      localStorage.removeItem('nst_current_user');
      localStorage.removeItem('nsta_cached_user');
      localStorage.removeItem('nst_is_guest');
      localStorage.setItem('nst_logged_out', 'true');
      document.documentElement.classList.remove(
        'student-theme-white', 'student-theme-black', 'student-theme-current',
        'admin-theme-white', 'admin-theme-black', 'admin-theme-current',
        'teacher-theme-white', 'teacher-theme-black', 'teacher-theme-current',
        'app-theme-white', 'app-theme-black', 'app-theme-current',
        'dark-mode-black', 'dark-mode-blue'
      );
      delete document.documentElement.dataset.nstErpTheme;
    } catch (e) {}
    try {
      const bridge = (window as any).LifeMakerAndroid;
      if (bridge && typeof bridge.syncIdentity === 'function') {
        bridge.syncIdentity(JSON.stringify({ userId: '', schoolId: '', studentIds: [] }));
      }
    } catch {}
    setUser(null);
    setShowBootSplash(false);
    setShowPublicWebsite(true);
    navigateToPath('/', { clearSearch: true });
  };

  const logActivity = (action: string, details: string) => {
    console.log(`[Activity Log] ${action}:`, details);
  };

  useEffect(() => {
    const syncThemeFromStorage = () => {
      try {
        const t = localStorage.getItem('nst_app_theme') || localStorage.getItem('nst_student_theme');
        if (t === 'white' || t === 'black' || t === 'current') {
          setErpTheme(t);
        }
        const dm = localStorage.getItem('nst_dark_mode');
        if (dm === 'true' || dm === 'false') {
          setIsDarkMode(dm === 'true');
        }
      } catch {}
    };
    window.addEventListener('nst-dark-theme-change', syncThemeFromStorage);
    window.addEventListener('storage', syncThemeFromStorage);
    return () => {
      window.removeEventListener('nst-dark-theme-change', syncThemeFromStorage);
      window.removeEventListener('storage', syncThemeFromStorage);
    };
  }, []);

  const isSchoolErpActive = Boolean(user && view !== 'DRIVER');

  // Dynamic theme classes synced with active view (ERP 3-theme vs Main App Light/Dark)
  const appBgClass = isSchoolErpActive
    ? erpTheme === 'white'
      ? 'bg-[#eef2f7] text-slate-900'
      : erpTheme === 'black'
      ? 'bg-black text-white dark dark-mode'
      : 'bg-[#08142c] text-slate-100 dark dark-mode'
    : isDarkMode
    ? 'bg-slate-950 text-slate-100 dark dark-mode'
    : 'bg-slate-50 text-slate-900';

  useEffect(() => {
    if (isSchoolErpActive) {
      return;
    }
    document.documentElement.classList.remove(
      'student-theme-white', 'student-theme-black', 'student-theme-current',
      'admin-theme-white', 'admin-theme-black', 'admin-theme-current',
      'teacher-theme-white', 'teacher-theme-black', 'teacher-theme-current',
      'app-theme-white', 'app-theme-black', 'app-theme-current',
      'dark-mode-black', 'dark-mode-blue'
    );
    try { delete document.documentElement.dataset.nstErpTheme; } catch {}
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark-mode');
      document.body.style.backgroundColor = '#020617';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark-mode');
      document.body.style.backgroundColor = '#f8fafc';
    }
    try {
      localStorage.setItem('nst_dark_mode', String(isDarkMode));
    } catch {}
  }, [isDarkMode, isSchoolErpActive]);

  // Sync with Firebase Auth state so Google / Redirect sign-ins immediately transition to Dashboard
  useEffect(() => {
    if (user && !user.isGuest) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !firebaseUser.isAnonymous) {
        // If explicitly logged out recently, don't auto re-login unless actively on /login
        const isLoginRoute = normalizeRoutePath(window.location.pathname) === '/login';
        const sp = new URLSearchParams(window.location.search);
        const isPortalDeepLink = sp.get('schoolPortal') === '1' || Boolean(sp.get('schoolTab'));
        const shouldOpenPortal = isLoginRoute || isPortalDeepLink;
        if (localStorage.getItem('nst_logged_out') === 'true' && !isLoginRoute) {
          return;
        }

        const cachedRaw = localStorage.getItem('nst_current_user');
        let parsedCached: any = null;
        if (cachedRaw) {
          try { parsedCached = JSON.parse(cachedRaw); } catch {}
        }

        // Query Supabase / Firestore for fresh user data including role & isAdmin flags
        let fresh: any = null;
        try {
          fresh = await getFreshUserData(firebaseUser.uid);
          if (!fresh) fresh = await getUserData(firebaseUser.uid);
          if (!fresh) fresh = await getUserByLinkedGoogleUid(firebaseUser.uid);
          if (!fresh && firebaseUser.email) fresh = await getUserByEmail(firebaseUser.email);
        } catch (e) {
          console.warn('[App] Error getting fresh user data on auth change:', e);
        }

        const cleanEmail = (firebaseUser.email || parsedCached?.email || fresh?.email || '').toLowerCase().trim();
        const isSuperAdm = isSuperAdminEmail(cleanEmail);
        const isFbAdmin =
          fresh?.role === 'ADMIN' ||
          fresh?.role === 'SUPERADMIN' ||
          fresh?.isAdmin === true ||
          fresh?.userType === 'ADMIN' ||
          parsedCached?.role === 'ADMIN' ||
          parsedCached?.role === 'SUPERADMIN' ||
          parsedCached?.isAdmin === true;

        if (isSuperAdm || isFbAdmin) {
          const resolvedAdminId = fresh?.id || fresh?.uid || firebaseUser.uid;
          const adminUser = {
            ...(parsedCached || {}),
            ...(fresh || {}),
            id: resolvedAdminId,
            uid: resolvedAdminId,
            linkedGoogleUid: fresh?.linkedGoogleUid || firebaseUser.uid,
            displayId: isSuperAdm ? 'SUPERADMIN' : 'ADMIN',
            name: fresh?.name || parsedCached?.name || firebaseUser.displayName || (isSuperAdm ? 'Nadim Anwar (Super Admin)' : 'Admin User'),
            email: fresh?.email || firebaseUser.email || cleanEmail,
            photoURL: fresh?.photoURL || firebaseUser.photoURL || '',
            role: isSuperAdm ? 'SUPERADMIN' : 'ADMIN',
            schoolId: '',
            isGuest: false,
            credits: 99999,
            diamonds: 99999,
            streak: fresh?.streak || 1,
            totalScore: fresh?.totalScore || 0,
            profileCompleted: true,
            subscriptionTier: 'PRO',
            provider: isSuperAdm ? 'superadmin_login' : 'firebase_admin_login'
          };
          if (!fresh) {
            saveUserToLive(adminUser, { immediate: true }).catch(() => {});
          }
          handleLogin(adminUser, { keepWebsiteOpen: !shouldOpenPortal });
          return;
        }

        if (parsedCached && (parsedCached.uid === firebaseUser.uid || parsedCached.id === firebaseUser.uid || parsedCached.linkedGoogleUid === firebaseUser.uid)) {
          if (isSchoolAdminEmail(parsedCached.email)) {
            parsedCached.role = 'SCHOOL_ADMIN';
          }
          handleLogin(parsedCached, { keepWebsiteOpen: !shouldOpenPortal });
        } else {
          const isSuperAdm = isSuperAdminEmail(cleanEmail);
          const isSchoolAdm = !isSuperAdm && isSchoolAdminEmail(cleanEmail);
          const resolvedId = fresh?.id || fresh?.uid || firebaseUser.uid;
          const resolvedUser = {
            ...(fresh || {}),
            id: resolvedId,
            uid: resolvedId,
            linkedGoogleUid: fresh?.linkedGoogleUid || firebaseUser.uid,
            displayId: isSuperAdm ? 'SUPERADMIN' : isSchoolAdm ? 'ADMIN-LMPS' : (fresh?.displayId || `NSTA-${resolvedId.slice(-6).toUpperCase()}`),
            name: fresh?.name || firebaseUser.displayName || (isSuperAdm ? 'Super Admin' : isSchoolAdm ? 'SHAHID KHAN SIR (Principal & School Admin)' : 'Student'),
            email: fresh?.email || firebaseUser.email || '',
            photoURL: fresh?.photoURL || firebaseUser.photoURL || '',
            role: isSuperAdm ? 'SUPERADMIN' : isSchoolAdm ? 'SCHOOL_ADMIN' : (fresh?.role || 'STUDENT'),
            schoolId: isSuperAdm ? '' : (isSchoolAdm ? DEFAULT_SCHOOL_ID : (fresh?.schoolId === 'dps_gurgaon_sector45' ? DEFAULT_SCHOOL_ID : (fresh?.schoolId || ''))),
            isGuest: false,
            provider: isSuperAdm ? 'superadmin_login' : isSchoolAdm ? 'admin_login' : (fresh?.provider || 'google'),
            credits: isSuperAdm ? 99999 : isSchoolAdm ? 10000 : (fresh?.credits || 50),
            diamonds: isSuperAdm ? 99999 : (fresh?.diamonds || 0),
            streak: fresh?.streak || 1,
            totalScore: fresh?.totalScore || 0,
            profileCompleted: true,
            board: fresh?.board || 'CBSE',
            classLevel: fresh?.classLevel || '10',
            subscriptionTier: isSuperAdm ? 'PRO' : isSchoolAdm ? 'PRO' : (fresh?.subscriptionTier || 'FREE'),
            studyMode: fresh?.studyMode || 'CREDIT'
          };
          if (!fresh || !fresh.linkedGoogleUid) {
            saveUserToLive(resolvedUser, { immediate: true }).catch(() => {});
          }
          handleLogin(resolvedUser, { keepWebsiteOpen: !shouldOpenPortal });
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time Push & In-App Notification Listeners (Heads-Up Pop-Up Banner)
  useEffect(() => {
    let cancelled = false;
    let unsubForeground: any = null;
    let unsubUserNotifs: any = null;

    let activeStudentId = '';
    let activeSchoolId = '';
    try {
      activeSchoolId = localStorage.getItem('nst_active_school_id') || '';
      const stRaw = localStorage.getItem('nst_active_student') || localStorage.getItem('nst_cached_student');
      if (stRaw) {
        const parsed = JSON.parse(stRaw);
        if (parsed?.id) activeStudentId = String(parsed.id);
        if (!activeSchoolId && parsed?.schoolId) activeSchoolId = String(parsed.schoolId);
      }
    } catch {}

    const uid = user?.uid || user?.id || activeStudentId;

    import('./components/NotificationManager')
      .then(({
        subscribeToUserNotifications,
        listenToForegroundMessages,
        syncNativeAndroidIdentity,
        registerNativeAndroidBridgeToken,
      }) => {
        if (cancelled) return;
        listenToForegroundMessages((payload) => {
          console.log('[App] Received FCM foreground message:', payload);
        }).then((unsub) => {
          if (cancelled && typeof unsub === 'function') {
            unsub();
          } else {
            unsubForeground = unsub;
          }
        }).catch(() => {});

        if (uid) {
          unsubUserNotifs = subscribeToUserNotifications(
            uid,
            (notif) => {
              console.log('[App] Received RTDB notification:', notif);
            },
            {
              studentId: activeStudentId || undefined,
              schoolId: activeSchoolId || undefined,
            }
          );
          void syncNativeAndroidIdentity(uid);
        }

        (window as any).__onLifeMakerNativeFcmToken = (token: string) => {
          void registerNativeAndroidBridgeToken(token, uid || undefined);
        };
      })
      .catch(() => {});

    // Handle tap-to-speak when parent taps a lock-screen notification (both cold start & warm window)
    try {
      const sp = new URLSearchParams(window.location.search);
      const speakTitle = (sp.get('speakTitle') || '').trim();
      const speakBody = (sp.get('speakBody') || '').trim();
      const speakId = (sp.get('speakId') || '').trim();
      if (speakTitle || speakBody) {
        if (user && (sp.get('schoolPortal') === '1' || sp.get('schoolTab'))) {
          setShowPublicWebsite(false);
        }
        sp.delete('speakTitle');
        sp.delete('speakBody');
        sp.delete('speakId');
        const cleanedSearch = sp.toString();
        const cleanedUrl = `${window.location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}${window.location.hash}`;
        window.history.replaceState(window.history.state, '', cleanedUrl);

        import('./utils/voiceNotifyEngine').then(({ speakNotification }) => {
          const dedupeKey = speakId || `launch_${speakTitle}_${speakBody}`;
          const spoke = speakNotification(speakTitle || 'स्कूल सूचना', speakBody, { dedupeKey });
          if (!spoke) {
            const onFirstGesture = () => {
              speakNotification(speakTitle || 'स्कूल सूचना', speakBody, { dedupeKey: `${dedupeKey}_tap` });
            };
            window.addEventListener('click', onFirstGesture, { once: true, passive: true });
            window.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });
          }
        }).catch(() => {});
      }
    } catch {}

    const onSwNavigate = (event: MessageEvent) => {
      const data = event?.data;
      if (data?.type === 'SCHOOL_PUSH_NAVIGATE' && user) {
        setShowPublicWebsite(false);
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwNavigate);
    }

    return () => {
      cancelled = true;
      if (typeof unsubForeground === 'function') unsubForeground();
      if (typeof unsubUserNotifs === 'function') unsubUserNotifs();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwNavigate);
      }
    };
  }, [user?.uid, user?.id, schoolIdentityRev]);

  // Public QR Document Verification Route (Live check for TC, Marksheet & ID Card scans without requiring login)
  const isPublicDocVerify = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const docTypeParam = p.get('type') || '';
      return Boolean(
        p.get('verify') ||
        p.get('verify-certificate') ||
        p.get('cNo') ||
        p.get('certNo') ||
        p.get('dispatchNo') ||
        (p.get('v') === 'id') ||
        ['certificate', 'marksheet', 'idcard', 'driver_id', 'fee_receipt', 'admit_card', 'admission', 'gate_pass'].includes(docTypeParam) ||
        routePath === '/verify' ||
        window.location.pathname.startsWith('/verify')
      );
    } catch {
      return false;
    }
  })();

  const navigateToWebsiteSection = (section: Exclude<WebsiteTopNavSection, 'account'>) => {
    try {
      sessionStorage.setItem('nst_website_target_section', section);
    } catch {}
    setShowBootSplash(false);
    setShowPublicWebsite(true);
    navigateToPath('/', { clearSearch: true });
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  if (isPublicDocVerify) {
    const isLoggedIn = Boolean(user);
    const verifyPortalLabel =
      user && (isSchoolAdminRole(user) || isAdminUser(user) || ['TEACHER', 'ACCOUNTANT'].includes((user.role || '').toString().toUpperCase()))
        ? 'Switch to ERP Portal'
        : 'Switch to Student Portal';
    return (
      <div className="min-h-screen min-h-[100dvh] w-full flex flex-col bg-slate-900">
        <PublicWebsiteTopBar
          school={activePublicSchool}
          schools={visiblePublicSchools}
          sessions={publicAdmSessions}
          activeSection="verify"
          isAuthenticated={isLoggedIn}
          portalButtonLabel={verifyPortalLabel}
          onSelectSection={navigateToWebsiteSection}
          onSelectSchool={handleSelectPublicSchool}
          onOpenAccount={handleOpenAccountSection}
          onSwitchToPortal={() => {
            setShowPublicWebsite(false);
            triggerSplash('to_app');
            navigateToPath('/', { clearSearch: true });
          }}
          onOpenAdmission={() => {
            setShowBootSplash(false);
            setShowPublicWebsite(true);
            navigateToPath('/admission', { clearSearch: true });
          }}
        />
        <div className="flex-1 flex flex-col">
          <Suspense
            fallback={
              <div className="flex-1 min-h-full w-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-white">
                <img
                  src="/branding/schoolplus-splash-logo.png?v=7"
                  alt="SCHOOL+"
                  width={512}
                  height={512}
                  className="w-[min(86vw,512px)] aspect-square object-contain bg-transparent mb-5 drop-shadow-[0_16px_36px_rgba(0,0,0,0.65)]"
                />
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Verifying Official Document...</span>
                </div>
                <DevelopedByCredit tone="dark" />
              </div>
            }
          >
            <DocumentVerificationView
              onBack={() => {
                navigateToPath('/', { clearSearch: true });
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  // Dedicated Standalone Driver GPS Dashboard (?driverConsole=1&schoolId=...&busId=...)
  const driverConsoleParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('driverConsole') === '1' || p.get('driver') === '1') {
        return {
          schoolId: (p.get('schoolId') || '').trim(),
          schoolCode: (p.get('schoolCode') || '').trim(),
          schoolName: (p.get('schoolName') || 'School Bus Fleet').trim(),
          busId: (p.get('busId') || '').trim(),
          busNumber: (p.get('busNumber') || '').trim(),
          route: (p.get('route') || '').trim(),
          driverName: (p.get('driverName') || '').trim(),
          driverPhone: (p.get('driverPhone') || '').trim(),
        };
      }
      return null;
    } catch {
      return null;
    }
  })();

  if (driverConsoleParams) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full flex flex-col bg-slate-950">
        {gmpQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <Suspense
          fallback={
            <div className="min-h-screen min-h-[100dvh] w-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-white">
              <img
                src="/branding/schoolplus-splash-logo.png?v=7"
                alt="SCHOOL+"
                width={512}
                height={512}
                className="w-[min(86vw,512px)] aspect-square object-contain bg-transparent mb-5 drop-shadow-[0_16px_36px_rgba(0,0,0,0.65)]"
              />
              <div className="flex items-center gap-2 text-sm font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading Driver GPS Dashboard...</span>
              </div>
              <DevelopedByCredit tone="dark" />
            </div>
          }
        >
          <DriverTripConsole
            school={{
              id: driverConsoleParams.schoolId,
              code: driverConsoleParams.schoolCode,
              name: driverConsoleParams.schoolName,
            } as any}
            initialBusId={driverConsoleParams.busId || undefined}
            initialBusMeta={
              driverConsoleParams.busId || driverConsoleParams.busNumber
                ? {
                    id: driverConsoleParams.busId || 'bus_direct',
                    busNumber: driverConsoleParams.busNumber || 'School Bus',
                    route: driverConsoleParams.route || 'School Bus Route',
                    driverName: driverConsoleParams.driverName || 'Driver',
                    driverPhone: driverConsoleParams.driverPhone || '',
                  }
                : undefined
            }
            standaloneMode={true}
          />
        </Suspense>
      </div>
    );
  }

  const renderBootSplash = () => {
    if (!showBootSplash || isPublicDocVerify || driverConsoleParams) return null;
    const userSchool =
      user?.schoolId
        ? visiblePublicSchools.find(
            (s) => s.id === user.schoolId || (user.schoolCode && s.code === user.schoolCode)
          ) || activePublicSchool
        : activePublicSchool;
    const resolvedSplashLogo =
      getSavedSchoolLogo(userSchool?.logoUrl, userSchool?.id) ||
      userSchool?.logoUrl ||
      '/branding/schoolplus-splash-logo.png?v=7';

    return (
      <AppLoadingScreen
        key={bootSplashKey}
        transitionMode={bootSplashMode}
        onComplete={() => setShowBootSplash(false)}
        userId={user?.uid || user?.id}
        userRole={user?.role}
        schoolId={userSchool?.id}
        schoolName={userSchool?.name || user?.schoolName}
        schoolLogoUrl={resolvedSplashLogo}
        schoolTagline={userSchool?.tagline || userSchool?.websiteConfig?.heroSubheadline}
        schoolCode={userSchool?.code || user?.schoolCode}
        schoolAddress={userSchool?.address}
        loadingScreenSlotAssignments={user?.loadingScreenSlotAssignments}
        loadingScreenSlotUnlocks={user?.loadingScreenSlotUnlocks}
        loadingScreenUnlocks={user?.loadingScreenUnlocks}
        loadingScreenVideoUrl={settings?.loadingScreenVideoUrl}
      />
    );
  };

  const renderSchoolLoader = (subtitle: string, lightBg = false) => {
    const customSchoolLogo = getSavedSchoolLogo(activePublicSchool?.logoUrl, activePublicSchool?.id);
    const showFullAppLogo = !customSchoolLogo;
    const fallbackLogo = customSchoolLogo || '/branding/schoolplus-splash-logo.png?v=7';
    const fallbackName = customSchoolLogo ? (activePublicSchool?.name || 'SCHOOL+') : 'SCHOOL+';
    return (
      <div
        className={`flex-1 w-full min-h-full flex flex-col items-center justify-center p-6 sm:p-8 text-center ${
          lightBg ? 'bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white' : 'bg-slate-950 text-white'
        }`}
      >
        {showFullAppLogo ? (
          <img
            src={fallbackLogo}
            alt="SCHOOL+"
            width={512}
            height={512}
            className="w-[min(86vw,512px)] aspect-square object-contain bg-transparent mb-5 drop-shadow-[0_18px_40px_rgba(0,0,0,0.65)]"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl p-1.5 bg-white/95 border border-amber-400/40 shadow-[0_0_24px_rgba(245,158,11,0.28)] flex items-center justify-center mb-4">
            <img
              src={fallbackLogo}
              alt={fallbackName}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackApplied) {
                  img.dataset.fallbackApplied = '1';
                  img.src = '/branding/schoolplus-splash-logo.png?v=7';
                }
              }}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
        )}
        {!showFullAppLogo && (
          <h3 className="text-base font-black tracking-wide uppercase mb-1">{fallbackName}</h3>
        )}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold opacity-80">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>{subtitle}</span>
        </div>
        <DevelopedByCredit tone={lightBg ? 'auto' : 'dark'} />
      </div>
    );
  };

  const handleVisitWebsiteFromPortal = (targetSchoolId?: string) => {
    if (targetSchoolId) {
      handleSelectPublicSchool(targetSchoolId);
    }
    triggerSplash('to_website');
    setShowPublicWebsite(true);
    navigateToPath('/');
  };

  const handleOpenAccountSection = () => {
    setShowPublicWebsite(false);
    triggerSplash('to_app');
    navigateToPath('/login');
  };

  const renderPublicAdmissionShell = (loggedInMode: boolean) => {
    const portalBtnLabel =
      user && (isSchoolAdminRole(user) || isAdminUser(user) || ['TEACHER', 'ACCOUNTANT'].includes((user.role || '').toString().toUpperCase()))
        ? 'Switch to ERP Portal'
        : 'Switch to Student Portal';
    const activeAdmSessObj = publicAdmSessions.find((s: any) => s?.active) || publicAdmSessions[0] || null;
    const nextYearNum = resolveWebsiteAdmissionSessionLabel({
      school: activePublicSchool,
      activeSession: activeAdmSessObj,
      sessions: publicAdmSessions,
    });
    return (
      <>
      <div className="min-h-screen min-h-[100dvh] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <PublicWebsiteTopBar
          school={activePublicSchool}
          schools={visiblePublicSchools}
          sessions={publicAdmSessions}
          activeSection="admissions"
          isAuthenticated={loggedInMode}
          portalButtonLabel={portalBtnLabel}
          onSelectSection={navigateToWebsiteSection}
          onSelectSchool={handleSelectPublicSchool}
          onOpenAccount={handleOpenAccountSection}
          onSwitchToPortal={() => {
            setShowPublicWebsite(false);
            triggerSplash('to_app');
            navigateToPath('/');
          }}
          onOpenAdmission={() => {
            try {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch {}
          }}
        />
        <div className="flex-1 flex flex-col">
          <Suspense fallback={renderSchoolLoader(`Loading Online Admission ${nextYearNum}...`, true)}>
            <OnlineAdmissionManager
              key={activePublicSchool?.id || 'public-adm'}
              school={activePublicSchool}
              classes={publicAdmClasses}
              sessions={publicAdmSessions}
              activeSession={activeAdmSessObj}
              admissionSessionLabel={nextYearNum}
              isAdmin={false}
              viewMode="admissions_only"
              hideTopNavbar={true}
              onBack={() => navigateToPath('/')}
            />
          </Suspense>
        </div>
      </div>
      {renderBootSplash()}
      </>
    );
  };

  // If user is logged out, render Website-First Public Experience (/ , /admission , /login)
  if (!user) {
    if (routePath === '/login') {
      return (
        <>
          <div className={`min-h-screen min-h-[100dvh] w-full flex flex-col ${appBgClass}`}>
            {gmpQuotaExceeded && (
              <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
                <span>
                  Google Maps Platform quota reached. If you are the app owner, visit{' '}
                  <a
                    href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold text-amber-950 hover:text-amber-800"
                  >
                    maps developer site
                  </a>{' '}
                  for instructions to update your account.
                </span>
              </div>
            )}
            <Suspense fallback={renderSchoolLoader('Loading School Account Portal...', !isDarkMode)}>
              <Auth
                onLogin={handleLogin}
                appSettings={settings}
                logActivity={logActivity}
                onBackToWebsite={() => {
                  triggerSplash('to_website');
                  setShowPublicWebsite(true);
                  navigateToPath('/');
                }}
              />
            </Suspense>

            <Suspense fallback={null}>
              <NotificationPermissionGate userId="" />
            </Suspense>
          </div>
          {renderBootSplash()}
        </>
      );
    }

    if (routePath === '/admission') {
      return renderPublicAdmissionShell(false);
    }

    return (
      <>
      <div className="min-h-screen min-h-[100dvh] w-full flex flex-col bg-[#F8F9FB]">
        <Suspense fallback={renderSchoolLoader('Loading School Campus Website...')}>
          <PublicSchoolWebsite
            school={activePublicSchool}
            schools={visiblePublicSchools}
            selectedSchoolId={activePublicSchool?.id}
            onSelectSchool={handleSelectPublicSchool}
            classes={publicAdmClasses}
            sessions={publicAdmSessions}
            isAuthenticated={false}
            onOpenAccount={handleOpenAccountSection}
            onOpenAdmission={() => {
              setShowBootSplash(false);
              setShowPublicWebsite(true);
              navigateToPath('/admission');
            }}
            onOpenVerification={(type, data) => {
              navigateToPath('/verify', {
                searchParams: {
                  ...(type ? { type } : {}),
                  ...(data ? { data } : {}),
                  ...(activePublicSchool?.id ? { school: activePublicSchool.id } : {}),
                },
              });
            }}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PwaInstallPrompt
            schoolName={activePublicSchool?.name}
            schoolLogoUrl={activePublicSchool?.logoUrl}
          />
        </Suspense>
      </div>
      {renderBootSplash()}
      </>
    );
  }

  // Logged-in user browsing Public School Website or Online Admission (/admission)
  if (showPublicWebsite || routePath === '/admission') {
    if (routePath === '/admission') {
      return renderPublicAdmissionShell(true);
    }
    const portalLabel =
      isSchoolAdminRole(user) || isAdminUser(user) || ['TEACHER', 'ACCOUNTANT'].includes((user.role || '').toString().toUpperCase())
        ? 'Switch to ERP Portal'
        : 'Switch to Student Portal';
    return (
      <>
      <div className="min-h-screen min-h-[100dvh] w-full flex flex-col bg-[#F8F9FB]">
        <Suspense fallback={renderSchoolLoader('Loading School Campus Website...')}>
          <PublicSchoolWebsite
            school={activePublicSchool}
            schools={visiblePublicSchools}
            selectedSchoolId={activePublicSchool?.id}
            onSelectSchool={handleSelectPublicSchool}
            classes={publicAdmClasses}
            sessions={publicAdmSessions}
            isAuthenticated={true}
            portalButtonLabel={portalLabel}
            onSwitchToPortal={() => {
              if (isSchoolPortalUser(user)) {
                setView('SCHOOL_ERP');
                try {
                  localStorage.setItem('nst_app_view_mode', 'SCHOOL_ERP');
                } catch {}
              }
              setShowPublicWebsite(false);
              triggerSplash('to_app');
              navigateToPath('/');
            }}
            onOpenAdmission={() => {
              setShowBootSplash(false);
              setShowPublicWebsite(true);
              navigateToPath('/admission');
            }}
            onOpenVerification={(type, data) => {
              navigateToPath('/verify', {
                searchParams: {
                  ...(type ? { type } : {}),
                  ...(data ? { data } : {}),
                  ...(activePublicSchool?.id ? { school: activePublicSchool.id } : {}),
                },
              });
            }}
          />
        </Suspense>
        <Suspense fallback={null}>
          <PwaInstallPrompt
            schoolName={activePublicSchool?.name}
            schoolLogoUrl={activePublicSchool?.logoUrl}
          />
        </Suspense>
      </div>
      {renderBootSplash()}
      </>
    );
  }

  return (
    <>
    <div className={`min-h-screen min-h-[100dvh] w-full flex flex-col ${appBgClass}`}>
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {/* ── MAIN DASHBOARD VIEWPORT WITH SUSPENSE ───────────────────────── */}
      <div className="flex-1 flex flex-col">
        <Suspense fallback={renderSchoolLoader(`Loading ${view === 'DRIVER' ? 'Driver GPS' : 'School ERP'}...`)}>
          {view === 'DRIVER' ? (
            <DriverTripConsole
              school={{
                id: user.schoolId || '',
                code: user.schoolCode || '',
                name: user.schoolName || 'School Bus Fleet',
              } as any}
              initialBusId={user.busId || undefined}
              initialBusMeta={
                user.busId || user.busNumber
                  ? {
                      id: user.busId || 'bus_driver',
                      busNumber: user.busNumber || 'School Bus',
                      route: user.busRoute || 'School Bus Route',
                      driverName: user.name || 'Driver',
                      driverPhone: user.mobile || '',
                      stops: Array.isArray(user.busStops) ? user.busStops : undefined,
                    }
                  : undefined
              }
              standaloneMode={true}
              onLogout={handleLogout}
            />
          ) : (
            <SchoolEcosystem
              key={user.uid || user.id || 'school-ecosystem'}
              uid={user.uid || user.id || 'admin_uid'}
              email={user.email || ''}
              displayName={user.name || (user.role === 'TEACHER' ? 'Teacher' : isSchoolAdminEmail(user.email) || user.role === 'SCHOOL_ADMIN' ? 'SHAHID KHAN SIR (Principal & School Admin)' : 'Student')}
              isSuperAdmin={Boolean(isSuperAdminEmail(user.email) || user.role === 'SUPERADMIN')}
              userRole={user.role || (isSchoolAdminEmail(user.email) ? 'SCHOOL_ADMIN' : 'STUDENT')}
              user={user}
              defaultSchoolId={user.schoolId || ''}
              forceAdminView={isSchoolAdminEmail(user.email) || user.role === 'SCHOOL_ADMIN' || user.role === 'ADMIN' || user.role === 'SUPERADMIN' || user.role === 'PRINCIPAL'}
              onVisitWebsite={handleVisitWebsiteFromPortal}
              onOpenPublicAdmission={(sid) => {
                if (sid) handleSelectPublicSchool(sid);
                setShowBootSplash(false);
                setShowPublicWebsite(true);
                navigateToPath('/admission');
              }}
              onLogout={handleLogout}
            />
          )}
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <PwaInstallPrompt
          schoolName={user?.schoolName || activePublicSchool?.name}
          schoolLogoUrl={activePublicSchool?.logoUrl}
        />
        <NotificationPrompt userId={user?.uid || user?.id || ''} />
        <NotificationPermissionGate userId={user?.uid || user?.id || ''} />
      </Suspense>
    </div>
    {renderBootSplash()}
    </>
  );
}

export default App;

