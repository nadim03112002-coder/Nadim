import crypto from "crypto";
import nodemailer from "nodemailer";
import { escapeHtml, resolveSchoolBranding } from "./_schoolBranding.js";

const RTDB_BASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://nst2512-6a2e4-default-rtdb.asia-southeast1.firebasedatabase.app";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds
const OTP_MAX_ATTEMPTS = 5;

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32).toString("hex");

const BLOCKED_DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "throwawaymail.com",
  "mailinator.com",
  "yopmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "getairmail.com",
]);

interface EmailOtpRecord {
  challengeId: string;
  email: string;
  purpose: string;
  schoolId: string;
  salt: string;
  otpHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  used: boolean;
}

const memoryChallenges = new Map<string, EmailOtpRecord>();
const memoryEmailCooldowns = new Map<string, number>();

function pruneMemoryCaches(now = Date.now()) {
  if (memoryChallenges.size > 300) {
    for (const [key, rec] of memoryChallenges.entries()) {
      if (rec.expiresAt <= now || rec.used) memoryChallenges.delete(key);
    }
  }
  if (memoryEmailCooldowns.size > 300) {
    for (const [key, nextAllowedAt] of memoryEmailCooldowns.entries()) {
      if (nextAllowedAt <= now) memoryEmailCooldowns.delete(key);
    }
  }
}

function getSmtpConfig() {
  const user = String(process.env.SMTP_USER || "").replace(/[\r\n]+/g, "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/[\r\n\s]+/g, "").trim();
  const fromName = String(process.env.SMTP_FROM_NAME || "").replace(/[\r\n]+/g, "").trim();
  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").replace(/[\r\n]+/g, "").trim();
  const rawPort = Number(process.env.SMTP_PORT || 465);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 465;
  return {
    user,
    pass,
    fromName,
    host,
    port,
    secure: port === 465,
    configured: Boolean(user && pass),
  };
}

function getOtpSigningKey(): string {
  return (
    process.env.OTP_SIGNING_SECRET ||
    process.env.QR_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SMTP_PASS ||
    EPHEMERAL_FALLBACK_KEY
  );
}

function normalizeEmail(raw: unknown): string {
  return String(raw || "").replace(/[\r\n]+/g, "").trim().toLowerCase();
}

function isValidEmailAddress(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return false;
  const domain = email.split("@")[1] || "";
  if (BLOCKED_DISPOSABLE_DOMAINS.has(domain)) return false;
  return true;
}

function maskEmailAddress(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "";
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(6, Math.max(2, local.length - 2)))}@${domain}`;
}

function hashValue(input: string): string {
  return crypto.createHmac("sha256", getOtpSigningKey()).update(input).digest("hex");
}

function hashOtpCode(challengeId: string, email: string, salt: string, otp: string): string {
  return hashValue(`otp|${challengeId}|${email}|${salt}|${otp}`);
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function signChallengeToken(payload: { cid: string; email: string; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getOtpSigningKey()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyChallengeToken(
  token: string
): { cid: string; email: string; exp: number } | null {
  const clean = String(token || "").trim();
  const dotIdx = clean.indexOf(".");
  if (dotIdx <= 0) return null;
  const encoded = clean.slice(0, dotIdx);
  const sig = clean.slice(dotIdx + 1);
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", getOtpSigningKey()).update(encoded).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const cid = String(parsed.cid || "").trim();
    const email = normalizeEmail(parsed.email);
    const exp = Number(parsed.exp || 0);
    if (!cid || !email || !Number.isFinite(exp)) return null;
    return { cid, email, exp };
  } catch {
    return null;
  }
}

async function rtdbGetJson<T = any>(rtdbPath: string): Promise<T | null> {
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

function resolveEmailLogoUrl(origin: string, schoolId: string, directLogoUrl?: string): string {
  const cleanOrigin = String(origin || "").replace(/\/+$/, "");
  const cleanSchoolId = String(schoolId || "").trim();
  const schoolParam = cleanSchoolId ? `&school=${encodeURIComponent(cleanSchoolId)}` : "";

  if (cleanOrigin.startsWith("https://")) {
    return `${cleanOrigin}/api/school-asset?type=icon${schoolParam}`;
  }
  if (
    directLogoUrl &&
    directLogoUrl.startsWith("https://") &&
    !directLogoUrl.includes("api.telegram.org/file/bot")
  ) {
    return directLogoUrl;
  }
  return `https://lmps27.vercel.app/api/school-asset?type=icon${schoolParam}`;
}

function buildSchoolOtpEmailHtml(params: {
  otp: string;
  schoolName: string;
  schoolCode: string;
  schoolTagline: string;
  schoolAddress: string;
  schoolPhone: string;
  accentColor: string;
  logoUrl: string;
  recipientName?: string;
  purpose: string;
}): string {
  const safeSchoolName = escapeHtml(params.schoolName || "SCHOOL+ Digital Campus");
  const safeTagline = escapeHtml(params.schoolTagline || "Official Smart School Portal");
  const safeAddress = escapeHtml(params.schoolAddress || "");
  const safePhone = escapeHtml(params.schoolPhone || "");
  const safeRecipient = escapeHtml(params.recipientName || "Student / Parent");
  const safeLogoUrl = escapeHtml(params.logoUrl);
  const safeOtp = escapeHtml(params.otp);
  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(params.accentColor) ? params.accentColor : "#1e3a8a";
  const purposeLabel =
    params.purpose === "SIGNUP"
      ? "New Account Verification OTP"
      : params.purpose === "RECOVERY"
      ? "Account Recovery Verification OTP"
      : "Secure Login Verification OTP";

  const otpDigitsHtml = safeOtp
    .split("")
    .map(
      (digit) =>
        `<td align="center" style="width:42px;height:52px;background-color:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:1px;">${digit}</td>`
    )
    .join(`<td style="width:8px;"></td>`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSchoolName} - Verification OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eef2f7;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dbe3ef;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
          <!-- Premium School Branded Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#070B14 0%,${safeAccent} 100%);padding:28px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td align="center" style="background-color:#ffffff;padding:8px;border-radius:18px;box-shadow:0 6px 18px rgba(0,0,0,0.28);">
                    <img src="${safeLogoUrl}" alt="${safeSchoolName}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:12px;" />
                  </td>
                </tr>
              </table>
              <h1 style="margin:14px 0 4px 0;font-size:20px;line-height:1.3;font-weight:800;color:#ffffff;letter-spacing:0.3px;">
                ${safeSchoolName}
              </h1>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#cbd5e1;font-weight:500;">
                ${safeTagline}
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:30px 26px 24px 26px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${safeAccent};">
                ${escapeHtml(purposeLabel)}
              </p>
              <h2 style="margin:0 0 12px 0;font-size:21px;font-weight:800;color:#0f172a;">
                Namaste ${safeRecipient},
              </h2>
              <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#475569;">
                Aapke <strong>${safeSchoolName}</strong> portal login ko surakshit tarike se verify karne ke liye neeche diya gaya 6-digit One-Time Password (OTP) darj karein:
              </p>

              <!-- 6-Digit OTP Box -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px auto;">
                <tr>
                  ${otpDigitsHtml}
                </tr>
              </table>

              <p style="margin:0 0 20px 0;text-align:center;font-size:12px;color:#64748b;font-weight:600;">
                Yeh OTP <strong style="color:#0f172a;">10 minutes</strong> ke liye valid hai.
              </p>

              <!-- Security Notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;font-size:12px;line-height:1.5;color:#92400e;">
                    <strong>Suraksha Suchna:</strong> Apna OTP kisi bhi anjaan vyakti ya caller ke saath share na karein. Agar aapne yeh login request nahi bheji hai, to is email ko ignore karein.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 24px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#334155;">
                ${safeSchoolName}
              </p>
              ${
                safeAddress
                  ? `<p style="margin:0 0 3px 0;font-size:11px;color:#64748b;">${safeAddress}</p>`
                  : ""
              }
              ${
                safePhone
                  ? `<p style="margin:0;font-size:11px;color:#64748b;">Helpline: ${safePhone}</p>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getEmailOtpStatus(): {
  ok: true;
  configured: boolean;
  fromName: string | null;
} {
  const cfg = getSmtpConfig();
  return {
    ok: true,
    configured: cfg.configured,
    fromName: cfg.fromName || null,
  };
}

export async function sendSchoolEmailOtpServer(input: {
  email?: unknown;
  schoolId?: unknown;
  schoolCode?: unknown;
  purpose?: unknown;
  userName?: unknown;
  origin?: string;
}): Promise<{ status: number; body: Record<string, any> }> {
  const smtp = getSmtpConfig();
  if (!smtp.configured) {
    return {
      status: 503,
      body: {
        ok: false,
        configured: false,
        error:
          "Email OTP abhi server par configured nahi hai. Admin ko SMTP_USER aur SMTP_PASS environment variables set karne honge.",
      },
    };
  }

  const email = normalizeEmail(input?.email);
  if (!isValidEmailAddress(email)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Kripya ek valid Gmail / Email address darj karein.",
      },
    };
  }

  const now = Date.now();
  pruneMemoryCaches(now);

  const emailKey = hashValue(`cooldown|${email}`).slice(0, 32);
  const memCooldownUntil = memoryEmailCooldowns.get(emailKey) || 0;
  if (memCooldownUntil > now) {
    const waitSec = Math.max(1, Math.ceil((memCooldownUntil - now) / 1000));
    return {
      status: 429,
      body: {
        ok: false,
        retryAfterSeconds: waitSec,
        error: `Naya OTP bhejne ke liye ${waitSec} seconds intezaar karein.`,
      },
    };
  }

  const remoteCooldown = await rtdbGetJson<{ nextAllowedAt?: number }>(
    `auth_email_otp_cooldowns/${emailKey}`
  );
  if (remoteCooldown && Number(remoteCooldown.nextAllowedAt || 0) > now) {
    const waitSec = Math.max(1, Math.ceil((Number(remoteCooldown.nextAllowedAt) - now) / 1000));
    memoryEmailCooldowns.set(emailKey, Number(remoteCooldown.nextAllowedAt));
    return {
      status: 429,
      body: {
        ok: false,
        retryAfterSeconds: waitSec,
        error: `Naya OTP bhejne ke liye ${waitSec} seconds intezaar karein.`,
      },
    };
  }

  const schoolQuery = String(input?.schoolId || input?.schoolCode || "")
    .replace(/[\r\n]+/g, "")
    .trim();
  const origin = String(input?.origin || "https://lmps27.vercel.app").trim();
  const branding = await resolveSchoolBranding({ origin, schoolQuery });
  const school = branding.school;
  const schoolName = school.name || "Life Maker Public School";
  const fromDisplayName = (smtp.fromName || schoolName).replace(/["<>]/g, "");

  const purpose = String(input?.purpose || "LOGIN")
    .replace(/[^A-Za-z_]/g, "")
    .toUpperCase()
    .slice(0, 24) || "LOGIN";
  const recipientName = String(input?.userName || "")
    .replace(/[\r\n<>]+/g, " ")
    .trim()
    .slice(0, 80);

  const otp = crypto.randomInt(100000, 1000000).toString();
  const challengeId = `eotp_${crypto.randomBytes(12).toString("hex")}`;
  const salt = crypto.randomBytes(16).toString("hex");
  const expiresAt = now + OTP_TTL_MS;
  const otpHash = hashOtpCode(challengeId, email, salt, otp);

  const record: EmailOtpRecord = {
    challengeId,
    email,
    purpose,
    schoolId: school.id,
    salt,
    otpHash,
    createdAt: now,
    expiresAt,
    attempts: 0,
    used: false,
  };

  const nextAllowedAt = now + OTP_RESEND_COOLDOWN_MS;
  memoryChallenges.set(challengeId, record);
  memoryEmailCooldowns.set(emailKey, nextAllowedAt);

  const logoUrl = resolveEmailLogoUrl(origin, school.id, school.logoUrl);
  const html = buildSchoolOtpEmailHtml({
    otp,
    schoolName,
    schoolCode: school.code || "LMPS",
    schoolTagline: school.tagline || "Bright Future... Together",
    schoolAddress: school.address || "",
    schoolPhone: school.phone || "",
    accentColor: school.bannerColor || "#1e3a8a",
    logoUrl,
    recipientName,
    purpose,
  });

  const text = `${schoolName}\n\nNamaste${recipientName ? ` ${recipientName}` : ""},\nAapka portal verification OTP hai: ${otp}\nYeh OTP 10 minutes ke liye valid hai. Kisi ke saath share na karein.\n`;

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });

    await transporter.sendMail({
      from: `"${fromDisplayName}" <${smtp.user}>`,
      to: email,
      subject: `${otp} - ${schoolName} Verification OTP`,
      text,
      html,
    });
  } catch (err: any) {
    memoryChallenges.delete(challengeId);
    memoryEmailCooldowns.delete(emailKey);
    const errMsg = String(err?.message || "");
    console.error("[EmailOTP] SMTP send error:", errMsg);
    const isAuthError =
      err?.code === "EAUTH" ||
      errMsg.includes("535") ||
      errMsg.toLowerCase().includes("invalid login") ||
      errMsg.toLowerCase().includes("username and password not accepted");
    return {
      status: isAuthError ? 502 : 500,
      body: {
        ok: false,
        configured: true,
        error: isAuthError
          ? "Gmail App Password reject ho gaya hai. Kripya SMTP_USER aur naya 16-digit Gmail App Password check karein."
          : "OTP email bhejne me problem aayi. Kripya kuch der baad dubara koshish karein.",
      },
    };
  }

  await Promise.all([
    rtdbPutJson(`auth_email_otps/${challengeId}`, record),
    rtdbPutJson(`auth_email_otp_cooldowns/${emailKey}`, { nextAllowedAt }),
  ]);

  const challengeToken = signChallengeToken({
    cid: challengeId,
    email,
    exp: expiresAt,
  });

  return {
    status: 200,
    body: {
      ok: true,
      configured: true,
      challengeToken,
      maskedEmail: maskEmailAddress(email),
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      resendCooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
      schoolName,
    },
  };
}

export async function verifySchoolEmailOtpServer(input: {
  email?: unknown;
  otp?: unknown;
  challengeToken?: unknown;
}): Promise<{ status: number; body: Record<string, any> }> {
  const email = normalizeEmail(input?.email);
  const otp = String(input?.otp || "").replace(/\D/g, "").trim();
  const challengeToken = String(input?.challengeToken || "").trim();

  if (!isValidEmailAddress(email) || !/^\d{6}$/.test(otp) || !challengeToken) {
    return {
      status: 400,
      body: {
        ok: false,
        verified: false,
        error: "Valid Email, 6-digit OTP aur verification token zaroori hain.",
      },
    };
  }

  const verifiedToken = verifyChallengeToken(challengeToken);
  if (!verifiedToken) {
    return {
      status: 400,
      body: {
        ok: false,
        verified: false,
        error: "OTP session invalid ya tampered hai. Naya OTP mangwayein.",
      },
    };
  }

  if (verifiedToken.email !== email) {
    return {
      status: 400,
      body: {
        ok: false,
        verified: false,
        error: "Email address OTP session se match nahi ho raha.",
      },
    };
  }

  const now = Date.now();
  if (now > verifiedToken.exp) {
    return {
      status: 410,
      body: {
        ok: false,
        verified: false,
        error: "Yeh OTP expire ho chuka hai. Kripya naya OTP mangwayein.",
      },
    };
  }

  const memRec = memoryChallenges.get(verifiedToken.cid) || null;
  const remoteRec = await rtdbGetJson<EmailOtpRecord>(`auth_email_otps/${verifiedToken.cid}`);
  const record = remoteRec && Number(remoteRec.attempts || 0) >= Number(memRec?.attempts || 0)
    ? remoteRec
    : memRec || remoteRec;

  if (!record) {
    return {
      status: 410,
      body: {
        ok: false,
        verified: false,
        error: "OTP record expire ho chuka hai. Kripya naya OTP mangwayein.",
      },
    };
  }

  if (record.used || memRec?.used || remoteRec?.used) {
    return {
      status: 409,
      body: {
        ok: false,
        verified: false,
        error: "Yeh OTP pehle hi use ho chuka hai. Naya OTP mangwayein.",
      },
    };
  }

  if (now > Number(record.expiresAt || 0)) {
    return {
      status: 410,
      body: {
        ok: false,
        verified: false,
        error: "Yeh OTP expire ho chuka hai. Kripya naya OTP mangwayein.",
      },
    };
  }

  const currentAttempts = Math.max(Number(record.attempts || 0), Number(memRec?.attempts || 0));
  if (currentAttempts >= OTP_MAX_ATTEMPTS) {
    return {
      status: 429,
      body: {
        ok: false,
        verified: false,
        error: "Bahut baar galat OTP dala gaya. Suraksha ke liye naya OTP mangwayein.",
      },
    };
  }

  const candidateHash = hashOtpCode(record.challengeId, email, record.salt, otp);
  if (!safeEqualHex(candidateHash, record.otpHash)) {
    const nextAttempts = currentAttempts + 1;
    const updated: EmailOtpRecord = { ...record, attempts: nextAttempts };
    memoryChallenges.set(record.challengeId, updated);
    await rtdbPutJson(`auth_email_otps/${record.challengeId}`, updated);
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
    return {
      status: 401,
      body: {
        ok: false,
        verified: false,
        remainingAttempts: remaining,
        error:
          remaining > 0
            ? `Galat OTP hai. ${remaining} koshish bachi hai.`
            : "Bahut baar galat OTP dala gaya. Naya OTP mangwayein.",
      },
    };
  }

  const completed: EmailOtpRecord = {
    ...record,
    used: true,
    attempts: currentAttempts + 1,
  };
  memoryChallenges.set(record.challengeId, completed);
  await rtdbPutJson(`auth_email_otps/${record.challengeId}`, completed);

  const verificationProof = signChallengeToken({
    cid: `verified:${record.challengeId}`,
    email,
    exp: now + OTP_TTL_MS,
  });

  return {
    status: 200,
    body: {
      ok: true,
      verified: true,
      email,
      verificationProof,
    },
  };
}
