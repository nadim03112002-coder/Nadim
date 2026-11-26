import { rtdb } from '../firebase';
import { ref, push, serverTimestamp, get, remove, query, orderByChild, limitToFirst } from 'firebase/database';
import { APP_VERSION, BUILD_NUMBER } from '../constants';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
  id?: string;
  message: string;
  reason?: string;
  stack?: string;
  componentStack?: string;
  component?: string;
  functionName?: string;
  activeModule?: string;
  type: 'react' | 'runtime' | 'promise' | 'network' | 'manual';
  severity: ErrorSeverity;
  url: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  userPhone?: string;
  schoolId?: string;
  schoolName?: string;
  studentName?: string;
  className?: string;
  device: string;
  appVersion?: string;
  buildNumber?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  deviceModel?: string;
  timestamp: number;
  ts?: object;
  dismissed?: boolean;
}

export interface ErrorLoggerContext {
  schoolId?: string | null;
  schoolName?: string | null;
  studentName?: string | null;
  className?: string | null;
  userPhone?: string | null;
  activeModule?: string | null;
}

let _currentUserId: string | null = null;
let _currentUserName: string | null = null;
let _currentUserRole: string | null = null;
let _currentUserPhone: string | null = null;
let _currentSchoolId: string | null = null;
let _currentSchoolName: string | null = null;
let _currentStudentName: string | null = null;
let _currentClassName: string | null = null;
let _currentModule: string | null = null;

export function setErrorLoggerUser(
  id: string | null,
  name: string | null,
  role: string | null,
  phone?: string | null
) {
  _currentUserId = id;
  _currentUserName = name;
  _currentUserRole = role;
  if (phone !== undefined) {
    _currentUserPhone = phone;
  }
}

export function setErrorLoggerContext(ctx: ErrorLoggerContext) {
  if (ctx.schoolId !== undefined) _currentSchoolId = ctx.schoolId;
  if (ctx.schoolName !== undefined) _currentSchoolName = ctx.schoolName;
  if (ctx.studentName !== undefined) _currentStudentName = ctx.studentName;
  if (ctx.className !== undefined) _currentClassName = ctx.className;
  if (ctx.userPhone !== undefined) _currentUserPhone = ctx.userPhone;
  if (ctx.activeModule !== undefined) _currentModule = ctx.activeModule;
}

export function setErrorLoggerModule(moduleName: string | null) {
  _currentModule = moduleName ? String(moduleName).trim() : null;
}

export function getErrorLoggerContextSnapshot() {
  return {
    userId: _currentUserId,
    userName: _currentUserName,
    userRole: _currentUserRole,
    userPhone: _currentUserPhone,
    schoolId: _currentSchoolId,
    schoolName: _currentSchoolName,
    studentName: _currentStudentName,
    className: _currentClassName,
    activeModule: _currentModule,
  };
}

function hydrateContextFromStorage(): {
  userId?: string;
  userName?: string;
  userRole?: string;
  userPhone?: string;
  schoolId?: string;
  schoolName?: string;
  studentName?: string;
  className?: string;
} {
  const out: Record<string, string | undefined> = {};
  try {
    if (typeof localStorage === 'undefined') return out;
    const rawUser = localStorage.getItem('nst_current_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u) {
        out.userId = u.uid || u.id || undefined;
        out.userName = u.name || u.displayName || undefined;
        out.userRole = u.role || u.schoolRole || undefined;
        out.userPhone = u.mobile || u.phone || undefined;
        if (u.schoolId) out.schoolId = String(u.schoolId);
        if (u.schoolName) out.schoolName = String(u.schoolName);
      }
    }
    const storedSchoolId = localStorage.getItem('nst_active_school_id');
    if (!out.schoolId && storedSchoolId) out.schoolId = storedSchoolId;
    const storedSchoolName = localStorage.getItem('nst_last_school_name');
    if (!out.schoolName && storedSchoolName) out.schoolName = storedSchoolName;

    const stRaw = localStorage.getItem('nst_active_student') || localStorage.getItem('nst_cached_student');
    if (stRaw) {
      const st = JSON.parse(stRaw);
      if (st) {
        if (st.name) out.studentName = String(st.name);
        if (st.className) out.className = String(st.className);
        if (!out.userPhone && (st.phone || st.fatherPhone)) out.userPhone = String(st.phone || st.fatherPhone);
        if (!out.schoolId && st.schoolId) out.schoolId = String(st.schoolId);
        if (!out.schoolName && st.schoolName) out.schoolName = String(st.schoolName);
      }
    }
  } catch {}
  return out;
}

export function extractFunctionName(stack?: string, componentStack?: string): string | undefined {
  if (stack) {
    const lines = stack.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Skip generic error header or logger internals
      if (
        line.startsWith('Error') ||
        line.startsWith('TypeError') ||
        line.startsWith('ReferenceError') ||
        line.includes('errorLogger') ||
        line.includes('ErrorBoundary')
      ) {
        continue;
      }
      // Chrome / Android WebView format: "at FunctionName (file:line:col)" or "at Object.fn (...)"
      const chromeMatch = line.match(/^at\s+(?:async\s+)?([A-Za-z0-9_$.<>]+)\s*(?:\(|$)/);
      if (chromeMatch?.[1] && chromeMatch[1] !== 'anonymous' && !chromeMatch[1].startsWith('http')) {
        return chromeMatch[1];
      }
      // Firefox / Safari format: "FunctionName@https://..."
      const safariMatch = line.match(/^([A-Za-z0-9_$.]+)@/);
      if (safariMatch?.[1]) {
        return safariMatch[1];
      }
    }
  }
  if (componentStack) {
    const compMatch = componentStack.match(/\bat\s+([A-Z][A-Za-z0-9_]+)/);
    if (compMatch?.[1]) return compMatch[1];
  }
  return undefined;
}

export function deriveErrorReason(message: string, type: AppError['type']): string {
  const lower = (message || '').toLowerCase();
  if (lower.includes('cannot read properties of null') || lower.includes('cannot read property') || lower.includes('of undefined') || lower.includes('of null')) {
    return 'Null/Undefined Data Error (Koi zaroori data empty ya missing tha)';
  }
  if (lower.includes('is not a function')) {
    return 'Function Call Error (Kisi variable ko function samajh kar call kiya gaya)';
  }
  if (lower.includes('invalid hook call') || lower.includes('usestate')) {
    return 'React Hook State Error (Module load mismatch)';
  }
  if (lower.includes('chunkloaderror') || lower.includes('dynamically imported module') || lower.includes('loading chunk')) {
    return 'Network / Module Load Delay (Slow internet ya naya update deploy hua)';
  }
  if (lower.includes('permission') || lower.includes('unauthorized')) {
    return 'Permission / Auth Error (Database ya device permission block hai)';
  }
  if (lower.includes('quota') || lower.includes('storage')) {
    return 'Storage / Memory Limit Reached (Phone/Browser storage full)';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network Connection Failure (Internet signal toot gaya)';
  }
  if (type === 'promise') {
    return 'Unhandled Async Promise Failure (Background API ya save operation fail hua)';
  }
  if (type === 'react') {
    return 'UI Component Render Crash (Screen draw karte samay runtime exception aaya)';
  }
  return 'Runtime JavaScript Exception';
}

function getDetailedDeviceInfo(): {
  device: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceModel: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browserName = 'Unknown';
  let browserVersion = '';
  if (/wv\)/i.test(ua) && /Android/i.test(ua)) {
    browserName = 'Android WebView';
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
  } else if (/SamsungBrowser\/(\d+)/.test(ua)) {
    browserName = 'Samsung';
    browserVersion = ua.match(/SamsungBrowser\/(\d+)/)?.[1] || '';
  } else if (/EdgA?\/(\d+)/.test(ua)) {
    browserName = 'Edge';
    browserVersion = ua.match(/EdgA?\/(\d+)/)?.[1] || '';
  } else if (/OPR\/(\d+)/.test(ua)) {
    browserName = 'Opera';
    browserVersion = ua.match(/OPR\/(\d+)/)?.[1] || '';
  } else if (/Firefox\/(\d+)/.test(ua)) {
    browserName = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || '';
  } else if (/Chrome\/(\d+)/.test(ua)) {
    browserName = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
  } else if (/Safari\//.test(ua)) {
    browserName = 'Safari';
    browserVersion = ua.match(/Version\/(\d+)/)?.[1] || '';
  }

  let osName = 'Unknown';
  let osVersion = '';
  if (/Android ([\d.]+)/.test(ua)) {
    osName = 'Android';
    osVersion = ua.match(/Android ([\d.]+)/)?.[1] || '';
  } else if (/iPhone OS ([\d_]+)/.test(ua)) {
    osName = 'iOS';
    osVersion = (ua.match(/iPhone OS ([\d_]+)/)?.[1] || '').replace(/_/g, '.');
  } else if (/iPad; CPU OS ([\d_]+)/.test(ua)) {
    osName = 'iPadOS';
    osVersion = (ua.match(/iPad; CPU OS ([\d_]+)/)?.[1] || '').replace(/_/g, '.');
  } else if (/Windows NT ([\d.]+)/.test(ua)) {
    osName = 'Windows';
    const nt = ua.match(/Windows NT ([\d.]+)/)?.[1] || '';
    osVersion = ({ '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' } as Record<string, string>)[nt] || nt;
  } else if (/Mac OS X ([\d_]+)/.test(ua)) {
    osName = 'macOS';
    osVersion = (ua.match(/Mac OS X ([\d_]+)/)?.[1] || '').replace(/_/g, '.');
  } else if (/Linux/.test(ua)) {
    osName = 'Linux';
  }

  let deviceModel = '';
  if (osName === 'Android') {
    const m = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s*Build|[;)])/);
    deviceModel = m?.[1]?.trim() || '';
  }

  return { device, browserName, browserVersion, osName, osVersion, deviceModel };
}

function classifyError(message: string): ErrorSeverity {
  const lower = message.toLowerCase();
  if (lower.includes('chunkloaderror') || lower.includes('loading chunk') || lower.includes('network error')) return 'low';
  if (lower.includes('firestore') || lower.includes('firebase') || lower.includes('permission')) return 'high';
  if (lower.includes('cannot read') || lower.includes('is not a function') || lower.includes('undefined is not')) return 'high';
  if (lower.includes('out of memory') || lower.includes('stack overflow') || lower.includes('quota')) return 'critical';
  return 'medium';
}

const _recentErrors = new Set<string>();
const MAX_LOG_RETENTION = 300;
const MIN_SEVERITY_TO_LOG: ErrorSeverity = 'low';
const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

let _sessionErrorCount = 0;
const MAX_SESSION_ERRORS = 100;

const LOCAL_STORAGE_KEY = 'nst_local_error_logs';

export function getLocalErrors(): Array<AppError & { id: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalError(err: AppError & { id: string }): void {
  try {
    const list = getLocalErrors();
    const updated = [err, ...list.filter(item => item.id !== err.id)].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nsta-new-error', { detail: err }));
    }
  } catch {}
}

export function markLocalErrorDismissed(id: string): void {
  try {
    const list = getLocalErrors();
    const updated = list.map(item => item.id === id ? { ...item, dismissed: true } : item);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearLocalErrors(schoolId?: string): void {
  try {
    if (schoolId) {
      const remaining = getLocalErrors().filter(item => item.schoolId !== schoolId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nsta-new-error', { detail: null }));
    }
  } catch {}
}

async function pruneOldLogs(): Promise<void> {
  try {
    const logsRef = ref(rtdb, 'error_logs');
    const snap = await get(query(logsRef, orderByChild('timestamp'), limitToFirst(50)));
    if (!snap.exists()) return;

    const allSnap = await get(logsRef);
    if (!allSnap.exists()) return;
    const total = Object.keys(allSnap.val()).length;
    if (total <= MAX_LOG_RETENTION) return;

    const excess = total - MAX_LOG_RETENTION;
    let pruned = 0;
    snap.forEach(child => {
      if (pruned < excess) {
        remove(child.ref).catch(() => {});
        pruned++;
      }
    });
  } catch {
  }
}

export async function logErrorToFirebase(
  error: Error | string,
  opts: {
    type?: AppError['type'];
    componentStack?: string;
    severity?: ErrorSeverity;
    moduleName?: string;
    functionName?: string;
    reason?: string;
    schoolId?: string;
  } = {}
): Promise<AppError | null> {
  try {
    const message = typeof error === 'string' ? error : (error?.message || String(error || 'Unknown Error'));
    const stack = typeof error === 'string' ? undefined : error?.stack;

    const lowerMsg = message.toLowerCase();
    if (
      lowerMsg.includes('could not reach cloud firestore backend') ||
      lowerMsg.includes('client will operate in offline mode') ||
      lowerMsg.includes("backend didn't respond within") ||
      lowerMsg.includes('client is offline') ||
      lowerMsg.includes('failed to get document because the client is offline') ||
      lowerMsg.includes('resizeobserver loop') ||
      lowerMsg.includes('websocket')
    ) {
      return null;
    }

    const severity = opts.severity ?? classifyError(message);

    if (SEVERITY_RANK[severity] < SEVERITY_RANK[MIN_SEVERITY_TO_LOG]) return null;

    const dedupeKey = `${opts.moduleName || _currentModule || ''}_${message.slice(0, 120)}`;
    if (_recentErrors.has(dedupeKey)) return null;
    _recentErrors.add(dedupeKey);
    setTimeout(() => _recentErrors.delete(dedupeKey), 5_000);

    if (_sessionErrorCount >= MAX_SESSION_ERRORS) return null;
    _sessionErrorCount++;

    const fallbackCtx = hydrateContextFromStorage();
    const resolvedType = opts.type ?? 'runtime';
    const componentMatch = opts.componentStack?.match(/\bat\s+([A-Za-z0-9_]+)/);
    const component = componentMatch?.[1] || undefined;
    const functionName = opts.functionName || extractFunctionName(stack, opts.componentStack);
    const reason = opts.reason || deriveErrorReason(message, resolvedType);

    const { device, browserName, browserVersion, osName, osVersion, deviceModel } = getDetailedDeviceInfo();

    const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const resolvedSchoolId = opts.schoolId || _currentSchoolId || fallbackCtx.schoolId || undefined;
    const resolvedModule = opts.moduleName || _currentModule || (typeof window !== 'undefined' ? window.location.pathname : '/');

    const payload: AppError & { id: string } = {
      id: errorId,
      message: message.slice(0, 500),
      reason,
      stack: stack?.slice(0, 1200),
      componentStack: opts.componentStack?.slice(0, 800),
      component,
      functionName,
      activeModule: resolvedModule || undefined,
      type: resolvedType,
      severity,
      url: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/',
      userId: (_currentUserId ?? fallbackCtx.userId) || undefined,
      userName: (_currentUserName ?? fallbackCtx.userName) || undefined,
      userRole: (_currentUserRole ?? fallbackCtx.userRole) || undefined,
      userPhone: (_currentUserPhone ?? fallbackCtx.userPhone) || undefined,
      schoolId: resolvedSchoolId,
      schoolName: (_currentSchoolName ?? fallbackCtx.schoolName) || undefined,
      studentName: (_currentStudentName ?? fallbackCtx.studentName) || undefined,
      className: (_currentClassName ?? fallbackCtx.className) || undefined,
      device,
      appVersion: APP_VERSION,
      buildNumber: BUILD_NUMBER,
      browserName: browserName || undefined,
      browserVersion: browserVersion || undefined,
      osName: osName || undefined,
      osVersion: osVersion || undefined,
      deviceModel: deviceModel || undefined,
      timestamp: Date.now(),
      ts: serverTimestamp() as object,
      dismissed: false,
    };

    Object.keys(payload).forEach(k => {
      const rec = payload as unknown as Record<string, unknown>;
      if (rec[k] === undefined) delete rec[k];
    });

    // 1. ALWAYS persist locally immediately (guarantees notice board shows it even if Firebase RTDB fails)
    saveLocalError(payload);

    // 2. Push to global error_logs (Super Admin) & school-scoped error_logs (School Admin)
    try {
      await push(ref(rtdb, 'error_logs'), payload);
    } catch (rtdbErr) {
      console.warn('[errorLogger] Global RTDB push failed, kept in local storage:', rtdbErr);
    }

    if (resolvedSchoolId) {
      try {
        await push(ref(rtdb, `schools/${resolvedSchoolId}/error_logs`), payload);
      } catch (schoolRtdbErr) {
        console.warn('[errorLogger] School RTDB push failed:', schoolRtdbErr);
      }
    }

    if (_sessionErrorCount % 10 === 0) {
      pruneOldLogs().catch(() => {});
    }

    return payload;
  } catch (err) {
    console.warn('[errorLogger] Failed to log error:', err);
    return null;
  }
}

export async function triggerTestError(customMsg?: string, schoolId?: string): Promise<void> {
  const testMsg = customMsg || `[Test Error] Diagnostic Check from Admin Crash Notice Board (${new Date().toLocaleTimeString('en-IN')})`;
  await logErrorToFirebase(new Error(testMsg), {
    type: 'manual',
    severity: 'high',
    moduleName: _currentModule || 'Crash Diagnostics Test',
    functionName: 'triggerTestError',
    reason: 'Admin Diagnostic Test Alert — Crash Monitoring Active',
    schoolId,
  });
}

export async function cleanupErrorLogs(): Promise<{ removed: number }> {
  try {
    const logsRef = ref(rtdb, 'error_logs');
    const allSnap = await get(logsRef);
    if (!allSnap.exists()) return { removed: 0 };

    const entries = Object.entries(allSnap.val() as Record<string, AppError>);
    const total = entries.length;
    if (total <= MAX_LOG_RETENTION) return { removed: 0 };

    const sorted = entries
      .sort(([, a], [, b]) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      .slice(0, total - MAX_LOG_RETENTION);

    await Promise.all(
      sorted.map(([key]) => remove(ref(rtdb, `error_logs/${key}`)).catch(() => {}))
    );
    return { removed: sorted.length };
  } catch {
    return { removed: 0 };
  }
}
