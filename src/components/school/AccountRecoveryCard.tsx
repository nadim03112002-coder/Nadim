import React, { useEffect, useState } from "react";
import { Shield, Lock, Edit3, Eye, EyeOff, Phone, Mail, HelpCircle, KeyRound, CheckCircle2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { getFreshUserData, getUserData, saveUserToLive } from "../../firebase";
import { getSchoolUserProfile, saveSchoolUserProfile } from "../../school-firebase";

export const RECOVERY_SECURITY_QUESTIONS = [
  "Aapka favorite subject kaunsa hai?",
  "Aapka favorite sport ya game kya hai?",
  "Aapka favorite teacher kaun hai?",
  "Aapka birth city / gaon kaunsa hai?",
  "Aapka pehla school kaunsa tha?",
];

export interface RecoverySyncPayload {
  mobile: string;
  email: string;
  recoveryPassword: string;
  securityQuestion: string;
  securityAnswer: string;
}

interface AccountRecoveryCardProps {
  uid?: string;
  role: "SCHOOL_STUDENT" | "TEACHER" | "SCHOOL_ADMIN";
  name?: string;
  displayId?: string;
  schoolId?: string;
  schoolName?: string;
  initialMobile?: string;
  initialEmail?: string;
  initialRecoveryPassword?: string;
  initialSecurityQuestion?: string;
  initialSecurityAnswer?: string;
  theme?: "current" | "white" | "black";
  extraSync?: (payload: RecoverySyncPayload) => Promise<void> | void;
}

export const AccountRecoveryCard: React.FC<AccountRecoveryCardProps> = ({
  uid = "",
  role,
  name = "",
  displayId = "",
  schoolId = "",
  schoolName = "",
  initialMobile = "",
  initialEmail = "",
  initialRecoveryPassword = "",
  initialSecurityQuestion = "",
  initialSecurityAnswer = "",
  theme = "current",
  extraSync,
}) => {
  const isWhite = theme === "white";
  const isBlack = theme === "black";

  const [savedData, setSavedData] = useState<RecoverySyncPayload>({
    mobile: initialMobile || "",
    email: initialEmail || "",
    recoveryPassword: initialRecoveryPassword || "",
    securityQuestion: initialSecurityQuestion || "",
    securityAnswer: initialSecurityAnswer || "",
  });

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formMobile, setFormMobile] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formQuestion, setFormQuestion] = useState(RECOVERY_SECURITY_QUESTIONS[0]);
  const [formAnswer, setFormAnswer] = useState("");

  const effectiveUid = (uid || displayId || "").trim();

  // Load saved recovery details from localStorage, users, and school_users
  useEffect(() => {
    let active = true;

    const loadRecoveryInfo = async () => {
      let mergedMobile = initialMobile || "";
      let mergedEmail = initialEmail || "";
      let mergedPassword = initialRecoveryPassword || "";
      let mergedQuestion = initialSecurityQuestion || "";
      let mergedAnswer = initialSecurityAnswer || "";

      try {
        const curRaw = localStorage.getItem("nst_current_user");
        if (curRaw) {
          const cur = JSON.parse(curRaw);
          if (!effectiveUid || cur.id === effectiveUid || cur.uid === effectiveUid || cur.displayId === effectiveUid) {
            mergedMobile = cur.recoveryMobile || cur.mobile || cur.phone || mergedMobile;
            mergedEmail = cur.recoveryEmail || cur.email || mergedEmail;
            mergedPassword = cur.recoveryPassword || cur.password || mergedPassword;
            mergedQuestion = cur.securityQuestion || mergedQuestion;
            mergedAnswer = cur.securityAnswer || mergedAnswer;
          }
        }
        if (effectiveUid) {
          const cachedRaw = localStorage.getItem(`nst_user_profile_${effectiveUid}`);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            mergedMobile = cached.recoveryMobile || cached.mobile || mergedMobile;
            mergedEmail = cached.recoveryEmail || cached.email || mergedEmail;
            mergedPassword = cached.recoveryPassword || cached.password || mergedPassword;
            mergedQuestion = cached.securityQuestion || mergedQuestion;
            mergedAnswer = cached.securityAnswer || mergedAnswer;
          }
        }
      } catch {}

      if (effectiveUid) {
        try {
          const [liveUser, schoolUser] = await Promise.all([
            getFreshUserData(effectiveUid).catch(() => getUserData(effectiveUid).catch(() => null)),
            getSchoolUserProfile(effectiveUid, mergedEmail || undefined).catch(() => null),
          ]);

          if (liveUser) {
            mergedMobile = liveUser.recoveryMobile || liveUser.mobile || mergedMobile;
            mergedEmail = liveUser.recoveryEmail || liveUser.email || mergedEmail;
            mergedPassword = liveUser.recoveryPassword || liveUser.password || mergedPassword;
            mergedQuestion = liveUser.securityQuestion || mergedQuestion;
            mergedAnswer = liveUser.securityAnswer || mergedAnswer;
          }
          if (schoolUser) {
            const su = schoolUser as any;
            mergedMobile = su.recoveryMobile || su.phone || mergedMobile;
            mergedEmail = su.recoveryEmail || su.email || mergedEmail;
            mergedPassword = su.recoveryPassword || mergedPassword;
            mergedQuestion = su.securityQuestion || mergedQuestion;
            mergedAnswer = su.securityAnswer || mergedAnswer;
          }
        } catch {}
      }

      if (!active) return;
      setSavedData({
        mobile: mergedMobile || "",
        email: mergedEmail || "",
        recoveryPassword: mergedPassword || "",
        securityQuestion: mergedQuestion || "",
        securityAnswer: mergedAnswer || "",
      });
    };

    loadRecoveryInfo();
    return () => {
      active = false;
    };
  }, [effectiveUid, initialMobile, initialEmail, initialRecoveryPassword, initialSecurityQuestion, initialSecurityAnswer]);

  const extractPrimaryTenDigitMobile = (raw: string): string => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    // Prefer the first valid 10-digit Indian mobile token when comma/space-separated numbers are present
    const tokenMatch = trimmed.match(/(?:\+?91[\s-]*)?([6-9]\d{9})\b/);
    if (tokenMatch?.[1]) return tokenMatch[1];
    const firstChunk = trimmed.split(/[,/|]+/)[0] || trimmed;
    const digits = firstChunk.replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const openEditModal = () => {
    const rawMobile = savedData.mobile || "";
    const parsedPrimary = extractPrimaryTenDigitMobile(rawMobile);
    setFormMobile(parsedPrimary.length === 10 ? parsedPrimary : rawMobile);
    setFormEmail(savedData.email || "");
    setFormPassword(savedData.recoveryPassword || "");
    setFormQuestion(savedData.securityQuestion || RECOVERY_SECURITY_QUESTIONS[0]);
    setFormAnswer(savedData.securityAnswer || "");
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = extractPrimaryTenDigitMobile(formMobile);
    const cleanEmail = formEmail.trim().toLowerCase();
    const cleanPassword = formPassword.trim();
    const cleanQuestion = formQuestion.trim() || RECOVERY_SECURITY_QUESTIONS[0];
    const cleanAnswer = formAnswer.trim().toLowerCase();

    if (cleanMobile && cleanMobile.length !== 10) {
      toast.error("Kripya 10-digit ka sahi Mobile Number daalein.");
      return;
    }
    if (!cleanMobile && !cleanEmail) {
      toast.error("Kam se kam Mobile Number ya Email zaroori hai.");
      return;
    }
    if (cleanPassword && cleanPassword.length < 4) {
      toast.error("Recovery Password kam se kam 4 akshar ka hona chahiye.");
      return;
    }
    if (!cleanAnswer) {
      toast.error("Security Answer bharna zaroori hai (taaki password bhulne par account recover ho sake).");
      return;
    }

    setSaving(true);
    try {
      const targetUid = effectiveUid || `${role.toLowerCase()}_${schoolId || "default"}_${cleanMobile || cleanEmail.replace(/[^a-z0-9]/g, "")}`;

      // 1. Sync into main users collection (for Login & Auth Recovery)
      let existingUser: any = null;
      try {
        existingUser = await getFreshUserData(targetUid).catch(() => getUserData(targetUid).catch(() => null));
      } catch {}

      let currentSessionUser: any = null;
      try {
        const rawCur = localStorage.getItem("nst_current_user");
        if (rawCur) {
          const parsed = JSON.parse(rawCur);
          if (parsed && (parsed.id === targetUid || parsed.uid === targetUid || parsed.displayId === targetUid)) {
            currentSessionUser = parsed;
          }
        }
      } catch {}

      const mergedUser = {
        ...(currentSessionUser || {}),
        ...(existingUser || {}),
        id: existingUser?.id || currentSessionUser?.id || targetUid,
        uid: existingUser?.uid || currentSessionUser?.uid || targetUid,
        displayId: displayId || existingUser?.displayId || currentSessionUser?.displayId || targetUid,
        name: name || existingUser?.name || currentSessionUser?.name || "User",
        role: existingUser?.role || currentSessionUser?.role || role,
        schoolId: schoolId || existingUser?.schoolId || currentSessionUser?.schoolId || "",
        schoolName: schoolName || existingUser?.schoolName || currentSessionUser?.schoolName || "",
        mobile: cleanMobile || existingUser?.mobile || currentSessionUser?.mobile || "",
        recoveryMobile: cleanMobile,
        email: cleanEmail || existingUser?.email || currentSessionUser?.email || "",
        recoveryEmail: cleanEmail,
        recoveryPassword: cleanPassword || existingUser?.recoveryPassword || "",
        password: cleanPassword || existingUser?.password || currentSessionUser?.password || "",
        securityQuestion: cleanQuestion,
        securityAnswer: cleanAnswer,
        recoveryUpdatedAt: new Date().toISOString(),
      };

      await saveUserToLive(mergedUser, { immediate: true }).catch(() => {});

      // Update active browser session cache if matched
      try {
        if (currentSessionUser) {
          localStorage.setItem("nst_current_user", JSON.stringify(mergedUser));
        }
      } catch {}

      // 2. Sync into school_users profile
      try {
        const existingSchoolProfile = await getSchoolUserProfile(targetUid, cleanEmail || undefined).catch(() => null);
        await saveSchoolUserProfile({
          ...(existingSchoolProfile || {}),
          uid: targetUid,
          schoolId: schoolId || existingSchoolProfile?.schoolId || "default_school",
          role: (existingSchoolProfile?.role as any) || role,
          name: name || existingSchoolProfile?.name || "User",
          email: cleanEmail || existingSchoolProfile?.email || "",
          phone: cleanMobile || (existingSchoolProfile as any)?.phone || "",
          recoveryMobile: cleanMobile,
          recoveryEmail: cleanEmail,
          recoveryPassword: cleanPassword || (existingSchoolProfile as any)?.recoveryPassword || "",
          securityQuestion: cleanQuestion,
          securityAnswer: cleanAnswer,
          recoveryUpdatedAt: new Date().toISOString(),
        } as any);
      } catch {}

      // 3. Role-specific table sync (Student / Teacher record)
      if (extraSync) {
        await extraSync({
          mobile: cleanMobile,
          email: cleanEmail,
          recoveryPassword: cleanPassword,
          securityQuestion: cleanQuestion,
          securityAnswer: cleanAnswer,
        });
      }

      setSavedData({
        mobile: cleanMobile,
        email: cleanEmail,
        recoveryPassword: cleanPassword,
        securityQuestion: cleanQuestion,
        securityAnswer: cleanAnswer,
      });

      toast.success("Account Recovery info save ho gayi! Ab aap kabhi bhi login recover kar sakte hain.");
      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Recovery info save karne me samasya aayi.");
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = Boolean((savedData.mobile || savedData.email) && savedData.securityAnswer);

  const cardBg = isWhite
    ? "bg-white border-slate-200/90 text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    : isBlack
    ? "bg-neutral-950 border-neutral-800 text-white"
    : "bg-[#0d1d3c] border-[#1f3b6e] text-white";

  const dividerColor = isWhite
    ? "border-slate-100 divide-slate-100"
    : isBlack
    ? "border-neutral-800/80 divide-neutral-800/80"
    : "border-[#1b3563] divide-[#1b3563]";

  const mutedText = isWhite ? "text-slate-500" : "text-slate-400";
  const valueText = isWhite ? "text-slate-900" : "text-slate-100";

  return (
    <>
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        {/* Top Row: Account Recovery Header + Edit Button */}
        <div className="px-4 py-4 sm:px-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${
                isConfigured
                  ? isWhite
                    ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
                    : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : isWhite
                  ? "bg-amber-50 border-amber-200/80 text-amber-700"
                  : "bg-amber-500/10 border-amber-500/25 text-amber-400"
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-bold tracking-tight ${valueText}`}>
                  Account Recovery &amp; Security
                </h3>
                <span className={`text-[11px] ${mutedText}`} aria-hidden="true">·</span>
                {isConfigured ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      isWhite ? "text-emerald-700" : "text-emerald-400"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Secured
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      isWhite ? "text-amber-700" : "text-amber-400"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Setup Recommended
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${mutedText}`}>
                Password bhulne ya phone badalne par instant account recovery ke liye
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openEditModal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shrink-0 active:scale-[0.98] whitespace-nowrap ${
              isWhite
                ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                : isBlack
                ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-slate-200"
                : "bg-white/5 hover:bg-white/10 border-white/15 text-slate-100"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {/* Recovery Details Hairline Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 border-t ${dividerColor}`}>
          {/* Mobile */}
          <button
            type="button"
            onClick={openEditModal}
            className={`w-full text-left px-4 py-3 sm:px-5 flex items-center justify-between gap-3 border-b sm:border-r transition cursor-pointer ${dividerColor} ${
              isWhite ? "hover:bg-slate-50/80" : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Phone className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[11px] font-medium ${mutedText}`}>Mobile</p>
                <p className={`text-xs font-semibold truncate font-mono tabular-nums mt-0.5 ${savedData.mobile ? valueText : mutedText}`}>
                  {savedData.mobile || "Not set"}
                </p>
              </div>
            </div>
            {!savedData.mobile && (
              <span className={`text-[11px] font-medium shrink-0 ${mutedText}`}>Add</span>
            )}
          </button>

          {/* Email */}
          <button
            type="button"
            onClick={openEditModal}
            className={`w-full text-left px-4 py-3 sm:px-5 flex items-center justify-between gap-3 border-b transition cursor-pointer ${dividerColor} ${
              isWhite ? "hover:bg-slate-50/80" : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Mail className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[11px] font-medium ${mutedText}`}>Email</p>
                <p className={`text-xs font-semibold truncate mt-0.5 ${savedData.email ? valueText : mutedText}`}>
                  {savedData.email || "Not set"}
                </p>
              </div>
            </div>
            {!savedData.email && (
              <span className={`text-[11px] font-medium shrink-0 ${mutedText}`}>Add</span>
            )}
          </button>

          {/* Security Question */}
          <button
            type="button"
            onClick={openEditModal}
            className={`w-full text-left px-4 py-3 sm:px-5 flex items-center justify-between gap-3 border-b sm:border-b-0 sm:border-r transition cursor-pointer ${dividerColor} ${
              isWhite ? "hover:bg-slate-50/80" : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <HelpCircle className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[11px] font-medium ${mutedText}`}>Security Question</p>
                <p className={`text-xs font-semibold truncate mt-0.5 ${savedData.securityQuestion ? valueText : mutedText}`}>
                  {savedData.securityQuestion || "Not set"}
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold shrink-0 ${
                savedData.securityAnswer
                  ? isWhite
                    ? "text-emerald-700"
                    : "text-emerald-400"
                  : mutedText
              }`}
            >
              {savedData.securityAnswer ? "Answer Set" : "Setup"}
            </span>
          </button>

          {/* Recovery Password */}
          <button
            type="button"
            onClick={openEditModal}
            className={`w-full text-left px-4 py-3 sm:px-5 flex items-center justify-between gap-3 transition cursor-pointer ${dividerColor} ${
              isWhite ? "hover:bg-slate-50/80" : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <KeyRound className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[11px] font-medium ${mutedText}`}>Recovery Password</p>
                <p className={`text-xs font-semibold tracking-wider mt-0.5 ${savedData.recoveryPassword ? valueText : mutedText}`}>
                  {savedData.recoveryPassword ? "••••••••" : "Not set"}
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold shrink-0 ${
                savedData.recoveryPassword
                  ? isWhite
                    ? "text-emerald-700"
                    : "text-emerald-400"
                  : mutedText
              }`}
            >
              {savedData.recoveryPassword ? "Active" : "Set"}
            </span>
          </button>
        </div>
      </div>

      {/* Edit Recovery Info Modal (Matching user's reference screenshot) */}
      {showModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 border-t-4 border-t-orange-500">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-orange-500 shrink-0" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Edit Recovery Info
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Mobile Number */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  MOBILE NUMBER
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={25}
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  EMAIL
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                />
              </div>

              {/* Recovery Password */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  RECOVERY PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Security Question */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  SECURITY QUESTION
                </label>
                <select
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 cursor-pointer"
                >
                  {RECOVERY_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Answer */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  SECURITY ANSWER
                </label>
                <input
                  type="text"
                  required
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                  placeholder="Your Answer"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-black shadow-md shadow-orange-500/25 transition cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Recovery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountRecoveryCard;
