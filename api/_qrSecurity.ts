import crypto from "crypto";
import dns from "dns";
import net from "net";

const RTDB_BASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://nst2512-6a2e4-default-rtdb.asia-southeast1.firebasedatabase.app";

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32).toString("hex");

function getSigningSecret(): string {
  return (
    process.env.QR_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSCODE ||
    EPHEMERAL_FALLBACK_KEY
  );
}

const usedLoginNonces = new Map<string, number>();

function pruneNonceCache(now = Date.now()) {
  if (usedLoginNonces.size < 500) return;
  for (const [k, exp] of usedLoginNonces.entries()) {
    if (exp <= now) usedLoginNonces.delete(k);
  }
}

function cleanPart(val: unknown): string {
  return String(val ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

export function maskAdmissionNumber(adm?: string | null): string {
  const s = String(adm || "").trim();
  if (!s) return "";
  if (s.length <= 4) return s;
  return `${"*".repeat(Math.min(6, Math.max(2, s.length - 4)))}${s.slice(-4)}`;
}

export function maskPhoneNumber(phone?: string | null): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function buildDeterministicVerificationToken(input: {
  schoolId?: string;
  studentId?: string;
  admissionNo?: string;
  issuedAt?: string;
  expiresAt?: string;
}): { token: string; issuedAt: string; expiresAt: string } {
  const issuedAt = cleanPart(input.issuedAt) || new Date().toISOString();
  const defaultExpMs = (Date.parse(issuedAt) || Date.now()) + 365 * 24 * 60 * 60 * 1000;
  const expiresAt = cleanPart(input.expiresAt) || new Date(defaultExpMs).toISOString();
  const rawSeed = [
    cleanPart(input.schoolId || "school"),
    cleanPart(input.studentId || "std"),
    cleanPart(input.admissionNo || ""),
    issuedAt.slice(0, 10),
    expiresAt.slice(0, 10),
  ].join("|");

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < rawSeed.length; i++) {
    const ch = rawSeed.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const token = `VT2-${(h1 >>> 0).toString(36).toUpperCase().padStart(6, "0")}${(h2 >>> 0)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")}`;
  return { token, issuedAt, expiresAt };
}

export function createServerSignedProof(payload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 24);
}

async function rtdbFetchJson<T = any>(rtdbPath: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${RTDB_BASE_URL}/${rtdbPath}.json`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function rtdbPutJson(rtdbPath: string, payload: unknown): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    await fetch(`${RTDB_BASE_URL}/${rtdbPath}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {}
}

function isStudentActiveRecord(rec: any): boolean {
  if (!rec || typeof rec !== "object") return false;
  if (rec.active === false || rec.isDeleted === true || rec.tcIssued === true) return false;
  const st = String(rec.status || "").trim().toLowerCase();
  if (st === "deleted" || st === "disabled" || st === "inactive" || st === "revoked") return false;
  if (String(rec.qrStatus || "").trim().toUpperCase() === "REVOKED") return false;
  return true;
}

function parseDateIso(val?: string | null): number {
  if (!val) return NaN;
  const s = String(val).trim();
  const parsed = Date.parse(s.length === 10 ? `${s}T23:59:59.999Z` : s);
  return parsed;
}

function normalizeDobDigits(dob?: string | null): string {
  const s = String(dob || "").trim();
  if (!s) return "";
  const parts = s.split(/[-/]/).map((p) => p.trim());
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return s.replace(/\D/g, "");
}

export async function verifyStudentIdServer(body: any): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  const schoolId = cleanPart(body?.schoolId || body?.s);
  let studentId = cleanPart(body?.studentId || body?.u);
  const admissionNo = cleanPart(body?.admissionNo);
  const providedToken = cleanPart(body?.t || body?.verificationToken || body?.vt);
  const providedExp = cleanPart(body?.expiresAt || body?.exp);

  if (!schoolId && !studentId && !providedToken) {
    return {
      status: 400,
      body: { ok: false, verified: false, status: "INVALID", reason: "Missing verification parameters" },
    };
  }

  const expTs = parseDateIso(providedExp);
  if (Number.isFinite(expTs) && Date.now() > expTs) {
    return {
      status: 200,
      body: {
        ok: true,
        verified: false,
        status: "EXPIRED",
        reason: "QR Verification Card has expired. Please reissue from school office.",
        qrExpiresAt: providedExp,
      },
    };
  }

  // Step 1: Opaque token registry check (supports ?verify=doc&type=idcard&t=VTR-...&s=... with zero PII in QR)
  const safeTokenPath = providedToken ? providedToken.replace(/[.#$[\]/]/g, "_") : "";
  const tokenRec =
    schoolId && safeTokenPath
      ? await rtdbFetchJson<any>(`schools/${schoolId}/qr_tokens/${safeTokenPath}`)
      : null;

  if (tokenRec) {
    if (String(tokenRec.status || "").toUpperCase() === "REVOKED") {
      return {
        status: 200,
        body: {
          ok: true,
          verified: false,
          status: "REVOKED",
          reason:
            tokenRec.revokedReason === "SESSION_RENEWED_OR_ROTATED"
              ? "Old session QR token has been invalidated after session renewal. Please scan the new session ID card."
              : "This QR verification token has been revoked by school administration.",
        },
      };
    }
    if (!studentId && tokenRec.studentId) {
      studentId = cleanPart(tokenRec.studentId);
    }
  }

  // Fallback lookup by scanning qr_verifications / students in that school when only token is supplied
  if (!studentId && schoolId && providedToken) {
    const [allVerifications, allStudents] = await Promise.all([
      rtdbFetchJson<Record<string, any>>(`schools/${schoolId}/qr_verifications`),
      rtdbFetchJson<Record<string, any>>(`schools/${schoolId}/students`),
    ]);
    if (allVerifications && typeof allVerifications === "object") {
      for (const [sid, rec] of Object.entries(allVerifications)) {
        if (rec && cleanPart(rec.verificationToken) === providedToken) {
          studentId = sid;
          break;
        }
      }
    }
    if (!studentId && allStudents && typeof allStudents === "object") {
      for (const [sid, rec] of Object.entries(allStudents)) {
        if (rec && cleanPart(rec.verificationToken) === providedToken) {
          studentId = sid;
          break;
        }
      }
    }
  }

  const [qrRegistry, studentRec, schoolRec] = await Promise.all([
    schoolId && studentId ? rtdbFetchJson<any>(`schools/${schoolId}/qr_verifications/${studentId}`) : null,
    schoolId && studentId ? rtdbFetchJson<any>(`schools/${schoolId}/students/${studentId}`) : null,
    schoolId ? rtdbFetchJson<any>(`schools/${schoolId}/info`) : null,
  ]);

  const effectiveRec = studentRec || qrRegistry;

  if (effectiveRec) {
    if (!isStudentActiveRecord(effectiveRec) || (qrRegistry && String(qrRegistry.qrStatus || "").toUpperCase() === "REVOKED")) {
      return {
        status: 200,
        body: {
          ok: true,
          verified: false,
          status: "REVOKED",
          reason: "This Student Digital ID is inactive or revoked by school administration.",
        },
      };
    }

    const dbExp = cleanPart(effectiveRec.qrExpiresAt || qrRegistry?.qrExpiresAt || tokenRec?.expiresAt || providedExp);
    const dbExpTs = parseDateIso(dbExp);
    if (Number.isFinite(dbExpTs) && Date.now() > dbExpTs) {
      return {
        status: 200,
        body: {
          ok: true,
          verified: false,
          status: "EXPIRED",
          reason: "Student Digital ID validity period has expired.",
          qrExpiresAt: dbExp,
        },
      };
    }

    const expectedToken =
      cleanPart(effectiveRec.verificationToken || qrRegistry?.verificationToken || tokenRec?.token) ||
      buildDeterministicVerificationToken({
        schoolId,
        studentId,
        admissionNo: effectiveRec.admissionNo || admissionNo,
        issuedAt: effectiveRec.qrIssuedAt || effectiveRec.createdAt,
        expiresAt: dbExp || undefined,
      }).token;

    if (providedToken && expectedToken && providedToken !== expectedToken) {
      const prevTokens: string[] = Array.isArray(effectiveRec.previousVerificationTokens)
        ? effectiveRec.previousVerificationTokens
        : [];
      if (prevTokens.includes(providedToken)) {
        return {
          status: 200,
          body: {
            ok: true,
            verified: false,
            status: "REVOKED",
            reason: "This previous-session QR token has been invalidated. Please use the renewed ID card.",
          },
        };
      }
      const recomputed = buildDeterministicVerificationToken({
        schoolId,
        studentId,
        admissionNo: effectiveRec.admissionNo || admissionNo,
        issuedAt: effectiveRec.qrIssuedAt || effectiveRec.createdAt,
        expiresAt: providedExp || dbExp || undefined,
      }).token;
      if (providedToken !== recomputed) {
        return {
          status: 200,
          body: {
            ok: true,
            verified: false,
            status: "TOKEN_MISMATCH",
            reason: "Verification token mismatch or superseded. Please scan the latest official ID card.",
          },
        };
      }
    }

    // Return ONLY non-sensitive public verification metadata (mask admission no & phone; omit DOB/address/fees)
    return {
      status: 200,
      body: {
        ok: true,
        verified: true,
        status: "ACTIVE",
        source: "server_rtdb",
        schoolId,
        schoolName: cleanPart(schoolRec?.name || effectiveRec.schoolName || ""),
        studentId,
        studentName: cleanPart(effectiveRec.name || effectiveRec.studentName || ""),
        admissionNo: maskAdmissionNumber(effectiveRec.admissionNo || admissionNo),
        maskedAdmissionNo: maskAdmissionNumber(effectiveRec.admissionNo || admissionNo),
        rollNo: cleanPart(effectiveRec.rollNo || ""),
        className: cleanPart(effectiveRec.className || ""),
        session: cleanPart(effectiveRec.sessionId || schoolRec?.session || ""),
        verificationToken: expectedToken,
        qrIssuedAt: cleanPart(effectiveRec.qrIssuedAt || qrRegistry?.qrIssuedAt || tokenRec?.issuedAt || effectiveRec.createdAt || ""),
        qrExpiresAt: dbExp,
        welcomeAcknowledgedAt: cleanPart(effectiveRec.welcomeAcknowledgedAt || qrRegistry?.welcomeAcknowledgedAt || ""),
        welcomeAcknowledgedBy: cleanPart(effectiveRec.welcomeAcknowledgedBy || qrRegistry?.welcomeAcknowledgedBy || ""),
        activationHistory: Array.isArray(effectiveRec.activationHistory)
          ? effectiveRec.activationHistory
          : Array.isArray(qrRegistry?.activationHistory)
          ? qrRegistry.activationHistory
          : [],
        maskedPhone: maskPhoneNumber(effectiveRec.phone || effectiveRec.whatsappNo),
        requiresSecondFactorForLogin: true,
      },
    };
  }

  // Fallback when student record is local/offline only: validate VT2/VTR format & expiry
  if (providedToken && /^(VT2-[A-Z0-9]{10,14}|VTR-[A-Z0-9]{8,16})$/.test(providedToken)) {
    return {
      status: 200,
      body: {
        ok: true,
        verified: true,
        status: "ACTIVE",
        source: "token_format_verified",
        schoolId,
        studentId,
        maskedAdmissionNo: maskAdmissionNumber(admissionNo),
        verificationToken: providedToken,
        qrExpiresAt: providedExp,
        requiresSecondFactorForLogin: true,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      verified: false,
      status: "NOT_FOUND",
      reason: "Student record not found in central registry.",
      requiresSecondFactorForLogin: true,
    },
  };
}

export async function validateLoginQrServer(body: any): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  const uid = cleanPart(body?.uid);
  const ts = Number(body?.ts || 0);
  const exp = Number(body?.exp || 0);
  const nonce = cleanPart(body?.nonce);
  const now = Date.now();

  if (!uid || !exp || !Number.isFinite(exp)) {
    return {
      status: 400,
      body: { ok: false, valid: false, reason: "Missing uid or expiration timestamp in login QR." },
    };
  }

  // Reject expired tokens (with small 30s clock tolerance)
  if (now > exp + 30_000) {
    return {
      status: 200,
      body: { ok: true, valid: false, status: "EXPIRED", reason: "Login QR code has expired. Generate a fresh QR code." },
    };
  }

  // Enforce max 24h TTL on dynamic session login QRs
  if (ts > 0 && exp - ts > 24 * 60 * 60 * 1000 + 60_000) {
    return {
      status: 200,
      body: { ok: true, valid: false, status: "INVALID_TTL", reason: "Login QR expiry window exceeds maximum allowed duration." },
    };
  }

  if (nonce) {
    pruneNonceCache(now);
    const replayKey = `${uid}_${nonce}`;
    if (usedLoginNonces.has(replayKey)) {
      return {
        status: 200,
        body: { ok: true, valid: false, status: "REPLAYED", reason: "This one-time login QR was already used. Generate a new QR." },
      };
    }
    const remoteUsed = await rtdbFetchJson<any>(`qr_login_nonces/${replayKey.replace(/[.#$[\]/]/g, "_")}`);
    if (remoteUsed && remoteUsed.usedAt) {
      return {
        status: 200,
        body: { ok: true, valid: false, status: "REPLAYED", reason: "This one-time login QR was already used. Generate a new QR." },
      };
    }
    usedLoginNonces.set(replayKey, exp + 60_000);
    void rtdbPutJson(`qr_login_nonces/${replayKey.replace(/[.#$[\]/]/g, "_")}`, {
      uid,
      usedAt: new Date().toISOString(),
      exp,
    });
  }

  const sessionProof = createServerSignedProof(`${uid}:${ts}:${exp}:${nonce}`);
  return {
    status: 200,
    body: {
      ok: true,
      valid: true,
      status: "VALID",
      uid,
      sessionProof,
      expiresAt: new Date(exp).toISOString(),
    },
  };
}

export async function verifyStudentSecondFactorServer(body: any): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  const schoolId = cleanPart(body?.schoolId);
  const studentId = cleanPart(body?.studentId);
  const factorValue = cleanPart(body?.factorValue);
  const deviceId = cleanPart(body?.deviceId);

  if (!factorValue) {
    return {
      status: 400,
      body: { ok: false, verified: false, reason: "Verification code (Mobile or DOB) is required." },
    };
  }

  if (!schoolId || !studentId) {
    return {
      status: 200,
      body: { ok: true, verified: false, requireClientMatch: true },
    };
  }

  const studentRec = await rtdbFetchJson<any>(`schools/${schoolId}/students/${studentId}`);
  if (!studentRec) {
    return {
      status: 200,
      body: { ok: true, verified: false, requireClientMatch: true },
    };
  }

  if (!isStudentActiveRecord(studentRec)) {
    return {
      status: 200,
      body: {
        ok: true,
        verified: false,
        status: "REVOKED",
        reason: "Student ID is inactive or revoked.",
      },
    };
  }

  const factorDigits = factorValue.replace(/\D/g, "");
  const candidatePhones = [
    studentRec.phone,
    studentRec.whatsappNo,
    studentRec.fatherPhone,
    studentRec.motherPhone,
    studentRec.emergencyPhone,
  ]
    .map((p) => String(p || "").replace(/\D/g, ""))
    .filter((p) => p.length >= 4);

  const phoneMatched =
    factorDigits.length >= 4 &&
    candidatePhones.some((p) =>
      factorDigits.length >= 10 ? p.slice(-10) === factorDigits.slice(-10) : p.slice(-4) === factorDigits.slice(-4)
    );

  const normalizedFactorDob = normalizeDobDigits(factorValue);
  const studentDob = normalizeDobDigits(studentRec.dateOfBirth || studentRec.dob);
  const dobMatched = Boolean(normalizedFactorDob && studentDob && normalizedFactorDob === studentDob);

  if (!phoneMatched && !dobMatched) {
    return {
      status: 200,
      body: {
        ok: true,
        verified: false,
        reason: "मोबाइल नंबर (या अंतिम 4 अंक) या जन्मतिथि रिकॉर्ड से मेल नहीं खाती।",
      },
    };
  }

  const deviceChallengeToken = createServerSignedProof(`${schoolId}:${studentId}:${deviceId || "web"}:${Date.now()}`);
  return {
    status: 200,
    body: {
      ok: true,
      verified: true,
      method: phoneMatched ? "mobile" : "dob",
      deviceChallengeToken,
    },
  };
}

function isDisallowedIpAddress(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase().split("%")[0];
  const version = net.isIP(cleanIp);
  if (version === 4) {
    const parts = cleanIp.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    if (cleanIp === "::1" || cleanIp === "::" || cleanIp.startsWith("fc") || cleanIp.startsWith("fd") || cleanIp.startsWith("fe80")) {
      return true;
    }
    if (cleanIp.startsWith("::ffff:")) {
      return isDisallowedIpAddress(cleanIp.slice(7));
    }
    return false;
  }
  return true;
}

export async function fetchSafeRemoteImage(rawUrl: string): Promise<{
  status: number;
  contentType?: string;
  buffer?: Buffer;
  error?: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    return { status: 400, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return { status: 400, error: "Only clean HTTPS URLs are supported" };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return { status: 403, error: "Restricted host" };
  }

  if (net.isIP(host) && isDisallowedIpAddress(host)) {
    return { status: 403, error: "Restricted IP address" };
  }

  try {
    const resolved = await dns.promises.lookup(host, { all: true });
    if (!Array.isArray(resolved) || resolved.length === 0 || resolved.some((r) => isDisallowedIpAddress(r.address))) {
      return { status: 403, error: "Host resolves to non-public address" };
    }
  } catch {
    return { status: 400, error: "Unable to resolve host" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return { status: 404, error: "Image unavailable" };
    }

    const ct = String(upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ct.startsWith("image/") || ct === "image/svg+xml") {
      return { status: 415, error: "Unsupported image content type" };
    }

    const arrBuf = await upstream.arrayBuffer();
    if (arrBuf.byteLength > 2.5 * 1024 * 1024) {
      return { status: 413, error: "Image exceeds maximum allowed size" };
    }

    return {
      status: 200,
      contentType: ct,
      buffer: Buffer.from(arrBuf),
    };
  } catch {
    return { status: 502, error: "Failed to fetch image" };
  }
}
