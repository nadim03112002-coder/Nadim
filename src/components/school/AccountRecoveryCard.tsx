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

  const openEditModal = () => {
    setFormMobile(savedData.mobile || "");
    setFormEmail(savedData.email || "");
    setFormPassword(savedData.recoveryPassword || "");
    setFormQuestion(savedData.securityQuestion || RECOVERY_SECURITY_QUESTIONS[0]);
    setFormAnswer(savedData.securityAnswer || "");
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = formMobile.replace(/\D/g, "").slice(-10);
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
    ? "bg-white border-slate-200 text-slate-900"
    : isBlack
    ? "bg-[#09090b] border-neutral-800 text-white"
    : "bg-[#0d1c3a] border-[#213d73] text-white";

  const subRowBg = isWhite
    ? "bg-slate-50 border-slate-200/80"
    : isBlack
    ? "bg-neutral-900/80 border-neutral-800"
    : "bg-[#09152d] border-[#1c3566]";

  const mutedText = isWhite ? "text-slate-500" : "text-slate-400";

  return (
    <>
      <div className={`rounded-2xl border p-4 sm:p-5 space-y-3 shadow-xs ${cardBg}`}>
        {/* Top Row: RECOVERY DATA + Edit Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                isConfigured
                  ? isWhite
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                  : isWhite
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-amber-500/15 border-amber-500/35 text-amber-400"
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={`text-xs font-extrabold uppercase tracking-wider ${
                    isConfigured
                      ? isWhite
                        ? "text-emerald-800"
                        : "text-emerald-300"
                      : isWhite
                      ? "text-amber-800"
                      : "text-amber-300"
                  }`}
                >
                  RECOVERY DATA
                </h3>
                {isConfigured ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isWhite ? "bg-emerald-100 text-emerald-800" : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Secured
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isWhite ? "bg-amber-100 text-amber-800" : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" /> Setup Recommended
                  </span>
                )}
              </div>
              <p className={`text-[11px] truncate ${mutedText}`}>
                Password bhulne ya phone badalne par instant account recovery ke liye
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openEditModal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 active:scale-95 ${
              isWhite
                ? "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800"
                : "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

        {/* Recovery Details Rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Mobile */}
          <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${subRowBg}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <Phone className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>MOBILE</p>
                <p className={`text-xs font-bold truncate font-mono ${savedData.mobile ? "" : mutedText}`}>
                  {savedData.mobile || "Not set"}
                </p>
              </div>
            </div>
            {!savedData.mobile && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${isWhite ? "bg-slate-200 text-slate-600" : "bg-white/10 text-slate-400"}`}>
                Empty
              </span>
            )}
          </div>

          {/* Email */}
          <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${subRowBg}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <Mail className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>EMAIL</p>
                <p className={`text-xs font-bold truncate ${savedData.email ? "" : mutedText}`}>
                  {savedData.email || "Not set"}
                </p>
              </div>
            </div>
            {!savedData.email && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${isWhite ? "bg-slate-200 text-slate-600" : "bg-white/10 text-slate-400"}`}>
                Empty
              </span>
            )}
          </div>

          {/* Security Question */}
          <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${subRowBg}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <HelpCircle className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>SECURITY QUESTION</p>
                <p className={`text-xs font-semibold truncate ${savedData.securityQuestion ? "" : mutedText}`}>
                  {savedData.securityQuestion || "Not set"}
                </p>
              </div>
            </div>
            {savedData.securityAnswer ? (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${isWhite ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-300"}`}>
                Answer Set
              </span>
            ) : (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${isWhite ? "bg-slate-200 text-slate-600" : "bg-white/10 text-slate-400"}`}>
                Empty
              </span>
            )}
          </div>

          {/* Recovery Password */}
          <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${subRowBg}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <KeyRound className={`w-4 h-4 shrink-0 ${mutedText}`} />
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>RECOVERY PASSWORD</p>
                <p className={`text-xs font-bold tracking-wider ${savedData.recoveryPassword ? "" : mutedText}`}>
                  {savedData.recoveryPassword ? "••••••••" : "Not set"}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                savedData.recoveryPassword
                  ? isWhite
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-emerald-500/20 text-emerald-300"
                  : isWhite
                  ? "bg-slate-200 text-slate-600"
                  : "bg-white/10 text-slate-400"
              }`}
            >
              {savedData.recoveryPassword ? "Active" : "Empty"}
            </span>
          </div>
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
                  maxLength={13}
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
