// @ts-nocheck
import React, { useMemo, useState } from "react";
import {
  ArrowLeft, Crown, Shield, Lock, CheckCircle2, XCircle,
  MessageSquare, ChevronDown, ChevronUp, BookOpen, Users, FileText,
  IndianRupee, Zap, X, Flame, Clock, Camera, QrCode, Globe,
  Smartphone, Building2, Star, Check, Layers, UserCheck
} from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import {
  LITE_YEARLY_PRICES,
  ULTRA_YEARLY_PRICING,
  ULTRA_AGENT_SCHEDULE,
  YEARLY_STUDENT_SLABS,
  getElitePricingForSlab,
  getLitePriceForSlab,
  getSchoolMaxBranches,
  getSchoolMaxStudents,
  isSchoolEliteCurriculum,
  type School,
  type SubscriptionTier,
} from "../../school-types";
import { ADMIN_WHATSAPP_NUMBER, SUPPORT_PHONE } from "../../constants";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { getVisibleSchoolRegNo } from "./feeReceiptUtils";

interface Props {
  school: School | null;
  schoolId: string;
  adminUid: string;
  onBack: () => void;
}

const fmtINR = (amt: number) => `₹${Math.round(amt || 0).toLocaleString("en-IN")}`;

const FEATURES = [
  { id: "students",       icon: <Users size={14} />,       label: "Student Capacity",                          lite: "100 – 2,000 Students",          elite: "100 – 5,000+ Students",           ultra: "2,000+ Students Only" },
  { id: "branches",       icon: <Building2 size={14} />,   label: "Multi-Branch Management",                   lite: "1 Branch Only",                 elite: "Up to 3 Branches",                ultra: "Unlimited Branches" },
  { id: "teachers",       icon: <Users size={14} />,       label: "Staff, Roles & Sub-Admins",               lite: "Included",                      elite: "Full Role Permissions",           ultra: "Unlimited Branch Admins" },
  { id: "attendance",     icon: <QrCode size={14} />,      label: "QR Code Scan Attendance",                   lite: "Included",                      elite: "Included",                        ultra: "Included" },
  { id: "faceattendance", icon: <Camera size={14} />,      label: "AI Face Attendance (0.2s Kiosk)",           lite: false,                           elite: "Included",                        ultra: "Kiosk + On-Site Setup" },
  { id: "templates",      icon: <FileText size={14} />,    label: "60+ ID/Admit/Marksheet/Certificate/Fee Layouts", lite: "Default Format",           elite: "60 Layouts (A4 2-Side & Cards)",  ultra: "Bespoke Custom Design" },
  { id: "entrance",       icon: <BookOpen size={14} />,    label: "Entrance Exam (17,500+ Qs) & 1–12 Notes",   lite: false,                           elite: "Included",                        ultra: "Full Suite Included" },
  { id: "customwebsite",  icon: <Globe size={14} />,       label: "Custom Website CMS, Photos & Gallery",      lite: "Default Website Only",          elite: "Full Custom CMS",                 ultra: "Own Domain (.com/.in) + CMS" },
  { id: "fees",           icon: <IndianRupee size={14} />, label: "Fee Collection, Audit Logs & Approval",     lite: "Core Register + Slips",         elite: "Full Ledger + Principal Approval", ultra: "Multi-Branch Audit Suite" },
  { id: "walkie",         icon: <Smartphone size={14} />,  label: "NSTA Messenger, Walkie-Talkie & Calls",     lite: false,                           elite: "Audio/Video + Intercom",          ultra: "Full Campus Suite" },
  { id: "tagada",         icon: <Smartphone size={14} />,  label: "Fee Tagada Caller & Smart Parent Caller ID",lite: false,                           elite: "9 Outcomes + Sibling Detection",  ultra: "Full Tagada + Priority Support" },
  { id: "playstoreapp",   icon: <Smartphone size={14} />,  label: "Own Brand Play Store APK & App Icon",       lite: false,                           elite: false,                             ultra: "White-Label APK/AAB" },
  { id: "agent",          icon: <UserCheck size={14} />,   label: "Dedicated ERP Agent (Optional Add-On)",     lite: false,                           elite: false,                             ultra: "₹2L Yr 1 → ₹4L Yr 5 Cap" },
];

const daysRemaining = (isoDate?: string): number => {
  if (!isoDate) return 0;
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

type PlanEdition = "lite" | "elite" | "ultra";

export const SchoolPlanView: React.FC<Props> = ({ school, schoolId, adminUid, onBack }) => {
  const [showCompare, setShowCompare] = useState(false);
  const [contactMsg, setContactMsg]   = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);

  const [selectedSlab, setSelectedSlab] = useState<number>(500);
  const [eliteMode, setEliteMode] = useState<"new" | "renewal">("new");
  const [ultraMode, setUltraMode] = useState<"new" | "renewal">("new");
  const [ultraWithAgent, setUltraWithAgent] = useState<boolean>(false);

  const [buyingPlan, setBuyingPlan] = useState<{
    edition: PlanEdition;
    tier: SubscriptionTier;
    isElite: boolean;
    isRenewal: boolean;
    maxStudents: number;
    maxBranches: number;
    amount: number;
    agentAddOn?: boolean;
    title: string;
  } | null>(null);

  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);

  const sub = school?.subscription;
  const isActive = sub?.status === "active";
  const tier = sub?.tier;
  const isSchoolElite = isSchoolEliteCurriculum(school);
  const isUltra = tier === "whitelabel_5000";
  const planLevel: "none" | "lite" | "elite" | "ultra" =
    !isActive ? "none" : isUltra ? "ultra" : isSchoolElite ? "elite" : "lite";

  const activeStudentsCap = getSchoolMaxStudents(school);
  const activeBranchesCap = getSchoolMaxBranches(school);
  const expiresAt = sub?.expiresAt || sub?.paidUntil;
  const days = daysRemaining(expiresAt);
  const expiringSoon = isActive && days > 0 && days <= 30;

  const planCfg = {
    none: {
      label: "No Yearly Plan Active",
      statusText: "INACTIVE",
      color: "from-slate-500 to-slate-600",
      bg: "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800",
      icon: <Lock size={20} className="text-slate-400" />,
      desc: "School yearly subscription active nahi hai. Neeche se Lite, Elite ya ULTRA plan chunein.",
    },
    lite: {
      label: `Lite Yearly Plan (${activeStudentsCap} Students · 1 Branch)`,
      statusText: "LITE YEARLY",
      color: "from-blue-600 to-indigo-600",
      bg: "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
      icon: <Shield size={20} className="text-blue-500" />,
      desc: `Up to ${activeStudentsCap} Students · 1 Branch Max · QR Attendance & Default School Website`,
    },
    elite: {
      label: `Elite Yearly Suite (${activeStudentsCap >= 5000 ? "5,000+" : activeStudentsCap} Students · ${activeBranchesCap} Branches)`,
      statusText: "ELITE YEARLY",
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800",
      icon: <Crown size={20} className="text-amber-500" />,
      desc: "3 Branches · AI Face Attendance + Fee Tagada Caller + 60 Document Layouts + Custom CMS",
    },
    ultra: {
      label: "ULTRA White-Label (2,000+ Students · Unlimited Branches)",
      statusText: "ULTRA 2000+",
      color: "from-rose-600 to-amber-500",
      bg: "bg-slate-900 text-white border-rose-500/60",
      icon: <Crown size={20} className="text-rose-400" />,
      desc: "Unlimited Branches · Own Domain + Own Brand Play Store APK + On-Site Training + Data Migration",
    },
  }[planLevel];

  const liteUnavailable = selectedSlab > 2000;
  const litePrice = liteUnavailable ? LITE_YEARLY_PRICES[2000] : getLitePriceForSlab(selectedSlab);
  const elitePricing = useMemo(() => getElitePricingForSlab(selectedSlab), [selectedSlab]);
  const elitePrice = eliteMode === "renewal" ? elitePricing.renewal : elitePricing.firstYear;

  const ultraBase = ultraMode === "renewal" ? ULTRA_YEARLY_PRICING.renewal : ULTRA_YEARLY_PRICING.firstYear;
  const ultraAgent = ultraMode === "renewal" ? 250000 : 200000;
  const ultraTotal = ultraBase + (ultraWithAgent ? ultraAgent : 0);

  const handleInitiateBuy = (edition: PlanEdition) => {
    if (edition === "lite") {
      if (liteUnavailable) return;
      const t: SubscriptionTier =
        selectedSlab <= 300 ? "starter_200" : selectedSlab <= 500 ? "growth_500" : "lite";
      setBuyingPlan({
        edition: "lite",
        tier: t,
        isElite: false,
        isRenewal: false,
        maxStudents: selectedSlab,
        maxBranches: 1,
        amount: litePrice,
        title: `⚡ LITE Yearly (${selectedSlab} Students · 1 Branch)`,
      });
    } else if (edition === "elite") {
      setBuyingPlan({
        edition: "elite",
        tier: "enterprise_2000",
        isElite: true,
        isRenewal: eliteMode === "renewal",
        maxStudents: selectedSlab,
        maxBranches: 3,
        amount: elitePrice,
        title: `👑 ELITE Yearly (${selectedSlab >= 5000 ? "5,000+" : selectedSlab} Std · ${eliteMode === "renewal" ? "Renewal" : "1st Year Offer"} · 3 Branches)`,
      });
    } else {
      setBuyingPlan({
        edition: "ultra",
        tier: "whitelabel_5000",
        isElite: true,
        isRenewal: ultraMode === "renewal",
        maxStudents: 5000,
        maxBranches: 9999,
        amount: ultraTotal,
        agentAddOn: ultraWithAgent,
        title: `💎 ULTRA White-Label (2,000+ Std · ${ultraMode === "renewal" ? "Renewal ₹2L" : "1st Year ₹3L"}${ultraWithAgent ? " + Dedicated Agent" : ""})`,
      });
    }
    setCheckoutDone(false);
  };

  const handleConfirmCheckout = async () => {
    if (!buyingPlan) return;
    setCheckoutSubmitting(true);
    try {
      const id = `${schoolId}_${Date.now()}`;
      const visibleReg = getVisibleSchoolRegNo(school);
      await setDoc(doc(db, "schoolPlanRequests", id), {
        schoolId,
        schoolName: school?.name || "",
        schoolCode: visibleReg,
        adminUid,
        targetTier: buyingPlan.tier,
        isElite: buyingPlan.isElite,
        isRenewal: buyingPlan.isRenewal,
        maxStudents: buyingPlan.maxStudents,
        maxBranches: buyingPlan.maxBranches,
        agentAddOn: Boolean(buyingPlan.agentAddOn),
        duration: "1_year",
        amount: buyingPlan.amount,
        planTitle: buyingPlan.title,
        message: `School: ${school?.name}${visibleReg ? ` (${visibleReg})` : ""} ne ${buyingPlan.title} ${fmtINR(buyingPlan.amount)}/Year select kiya hai.`,
        requestedAt: serverTimestamp(),
        status: "pending",
      });
      setCheckoutDone(true);
    } catch (e) {
      console.error("Checkout request error:", e);
    }
    setCheckoutSubmitting(false);
  };

  const openWhatsAppCheckout = () => {
    if (!buyingPlan) return;
    const visibleReg = getVisibleSchoolRegNo(school);
    const text = encodeURIComponent(
      `*School Yearly Plan Request*\n\n` +
      `🏫 *School:* ${school?.name || "School"}\n` +
      (visibleReg ? `🔑 *Reg. No:* ${visibleReg}\n` : "") +
      `📦 *Selected Plan:* ${buyingPlan.title}\n` +
      `🏢 *Branches Allowed:* ${buyingPlan.maxBranches >= 9999 ? "Unlimited" : buyingPlan.maxBranches}\n` +
      `🗓️ *Billing:* Yearly Session (12 Months)\n` +
      `💰 *Amount:* ${fmtINR(buyingPlan.amount)}\n\n` +
      `Kripya hamare school ke liye ye yearly plan activate karein.`
    );
    safeOpenExternalUrl(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${text}`);
  };

  const sendRequest = async () => {
    if (!contactMsg.trim()) return;
    setSending(true);
    try {
      const id = `${schoolId}_${Date.now()}`;
      await setDoc(doc(db, "schoolPlanRequests", id), {
        schoolId,
        schoolName: school?.name || "",
        adminUid,
        currentPlan: planLevel,
        message: contactMsg.trim(),
        requestedAt: serverTimestamp(),
        status: "pending",
      });
      setSent(true);
      setContactMsg("");
    } catch (e) {
      console.error("Plan request error:", e);
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16 text-slate-800 dark:text-slate-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-slate-900/95 dark:bg-black/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xs font-black text-white tracking-wide truncate flex items-center gap-2">
                <span>Yearly Subscription Plans</span>
                {getVisibleSchoolRegNo(school) && (
                  <span className="text-[10px] text-indigo-300 font-mono font-bold">
                    · {getVisibleSchoolRegNo(school)}
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-slate-400 truncate">{school?.name || "School ERP"}</p>
            </div>
          </div>

          <span className={`text-[11px] font-black whitespace-nowrap ${isActive ? "text-emerald-400" : "text-rose-400"}`}>
            {isActive ? "Active · Yearly" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="px-3.5 py-4 space-y-4 max-w-6xl mx-auto">
        {/* Current Active Plan Summary */}
        <div className={`rounded-xl border p-3.5 ${planCfg.bg}`}>
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${planCfg.color} flex items-center justify-center text-white shrink-0`}>
                {planCfg.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black truncate">{planCfg.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
                    · {planCfg.statusText}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">{planCfg.desc}</p>
              </div>
            </div>

            {isActive && expiresAt && (
              <div className="text-right shrink-0">
                <span className={`text-[10px] font-black tabular-nums inline-flex items-center gap-1 ${
                  expiringSoon ? "text-rose-500 animate-pulse" : "opacity-80"
                }`}>
                  <Clock size={11} /> {days}d left
                </span>
              </div>
            )}
          </div>

          {isActive && expiresAt && (
            <div className="mt-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
              <span className="opacity-80">
                Valid till: <strong className="tabular-nums">{fmtDate(expiresAt)}</strong>
              </span>
              {expiringSoon ? (
                <span className="font-black text-rose-500 flex items-center gap-1">
                  <Flame size={12} /> Jaldi renew karein!
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={11} /> System Online
                </span>
              )}
            </div>
          )}
        </div>

        {/* Slab Selector + 3-Tier Cards */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                <Zap size={14} className="text-amber-500" /> Student Capacity Chunein (100 – 5,000+ Students)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lite ₹20k–₹1L (Max 2,000 Std) · Elite ₹75k–₹2L (Best Value, 3 Branches) · ULTRA ₹3L/yr (2,000+ Only, Own Domain &amp; APK)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {YEARLY_STUDENT_SLABS.map((slab) => {
              const eSlab = getElitePricingForSlab(slab);
              return (
                <button
                  key={slab}
                  type="button"
                  onClick={() => setSelectedSlab(slab)}
                  className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                    selectedSlab === slab
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/35 ring-2 ring-amber-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  }`}
                >
                  <p className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                    {slab >= 5000 ? "5,000+" : slab.toLocaleString("en-IN")} Std
                  </p>
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-0.5 tabular-nums">
                    Elite {fmtINR(eSlab.firstYear)}
                  </p>
                  <p className="text-[9px] text-slate-400 tabular-nums">
                    {slab <= 2000 ? `Lite ${fmtINR(LITE_YEARLY_PRICES[slab])}` : "ULTRA Eligible"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 3-TIER GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* LITE */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between bg-slate-50/70 dark:bg-slate-950/40">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-blue-600 dark:text-blue-400">⚡ LITE YEARLY</span>
                  <span className="text-slate-500">1 Branch Max</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Lite ({liteUnavailable ? "Max 2,000" : selectedSlab.toLocaleString("en-IN")} Students)
                  </h3>
                  {liteUnavailable ? (
                    <p className="text-xs font-bold text-rose-600 mt-1">
                      5,000+ ke liye Elite ya ULTRA plan lein
                    </p>
                  ) : (
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                      {fmtINR(litePrice)}
                      <span className="text-xs font-semibold text-slate-500"> / Year</span>
                    </p>
                  )}
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-500 shrink-0" /> 1 Branch Management Only</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-500 shrink-0" /> QR Scan Attendance &amp; Core Fees</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-500 shrink-0" /> Default School Website Only</li>
                  <li className="flex items-center gap-1.5 text-slate-400"><Lock size={12} className="shrink-0" /> No Fee Tagada Caller / Face ID / CMS</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={liteUnavailable}
                onClick={() => handleInitiateBuy("lite")}
                className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-black transition cursor-pointer whitespace-nowrap"
              >
                {liteUnavailable ? "Max 2,000 Students Only" : `Select Lite (${fmtINR(litePrice)})`}
              </button>
            </div>

            {/* ELITE (HERO) */}
            <div className="rounded-2xl border-2 border-amber-500 p-4 flex flex-col justify-between bg-amber-50/40 dark:bg-amber-950/15 shadow-md">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Star size={11} className="fill-amber-500 text-amber-500" /> BEST SELLER · ELITE
                  </span>
                  <span className="text-amber-700 dark:text-amber-300">3 Branches Max</span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Crown size={16} className="text-amber-500" />
                    Elite Suite ({selectedSlab >= 5000 ? "5,000+" : selectedSlab.toLocaleString("en-IN")} Std)
                  </h3>

                  <div className="mt-2 pt-2 border-t border-amber-300/50 dark:border-amber-800/50 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-600 dark:text-slate-300">Standard MRP:</span>
                      <span className="line-through text-rose-600 dark:text-rose-400 font-black tabular-nums">
                        {fmtINR(elitePricing.mrp)}/yr
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEliteMode("new")}
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          eliteMode === "new"
                            ? "bg-amber-500 text-slate-950 border-amber-600 font-black"
                            : "bg-white dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="text-[9px] font-black uppercase">1st Year Offer</div>
                        <div className="text-xs font-black tabular-nums">{fmtINR(elitePricing.firstYear)}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEliteMode("renewal")}
                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                          eliteMode === "renewal"
                            ? "bg-emerald-600 text-white border-emerald-700 font-black"
                            : "bg-white dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="text-[9px] font-black uppercase">Yearly Renewal</div>
                        <div className="text-xs font-black tabular-nums">{fmtINR(elitePricing.renewal)}/yr</div>
                      </button>
                    </div>
                  </div>
                </div>

                <ul className="space-y-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> 3 Branches + Full Multi-Role Security</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> Fee Tagada Caller + Smart Parent Caller ID</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> AI Face ID + Custom Website CMS</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> 60 Document Layouts (A4 2-Side &amp; Slips)</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleInitiateBuy("elite")}
                className="mt-4 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition cursor-pointer whitespace-nowrap"
              >
                Kharidein Elite ({fmtINR(elitePrice)}/yr)
              </button>
            </div>

            {/* ULTRA WHITE-LABEL */}
            <div className="rounded-2xl border border-slate-700 p-4 flex flex-col justify-between bg-slate-900 dark:bg-black text-white">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-rose-400">💎 ULTRA · 2,000+ ONLY</span>
                  <span className="text-slate-300">Unlimited Branches</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">ULTRA White-Label (Domain + APK)</h3>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setUltraMode("new")}
                      className={`p-1.5 rounded-lg border text-left cursor-pointer ${
                        ultraMode === "new" ? "bg-rose-600 border-rose-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="text-[9px] font-black uppercase">1st Year ERP</div>
                      <div className="text-xs font-black tabular-nums">₹3,00,000</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUltraMode("renewal")}
                      className={`p-1.5 rounded-lg border text-left cursor-pointer ${
                        ultraMode === "renewal" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="text-[9px] font-black uppercase">Yearly Renewal</div>
                      <div className="text-xs font-black tabular-nums">₹2,00,000</div>
                    </button>
                  </div>
                  <label className="mt-2 flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] cursor-pointer">
                    <span className="flex items-center gap-1.5 font-bold text-amber-300">
                      <input
                        type="checkbox"
                        checked={ultraWithAgent}
                        onChange={(e) => setUltraWithAgent(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Dedicated Agent (+{fmtINR(ultraAgent)}/yr)
                    </span>
                    <span className="font-black tabular-nums">{fmtINR(ultraTotal)}</span>
                  </label>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-200">
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> 2,000+ Students &amp; Unlimited Branches</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> Own Domain + Brand Play Store APK</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> On-Site Training &amp; 100% Data Migration</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> Agent Scale: ₹2L Yr1 → ₹4L Yr5+ Cap</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleInitiateBuy("ultra")}
                className="mt-4 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition cursor-pointer whitespace-nowrap"
              >
                Book ULTRA ({fmtINR(ultraTotal)}/yr)
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Table Accordion */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCompare((v) => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
          >
            <p className="text-xs font-black text-slate-800 dark:text-slate-200">
              Full Yearly Comparison: ⚡ Lite vs 👑 Elite vs 💎 ULTRA (with Agent Schedule)
            </p>
            {showCompare ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </button>

          {showCompare && (
            <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-[11px] border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-2.5 text-left font-black">Feature / Yearly Plan</th>
                    <th className="p-2.5 text-center font-black text-blue-600">⚡ Lite Yearly</th>
                    <th className="p-2.5 text-center font-black text-amber-600">👑 Elite (Hero)</th>
                    <th className="p-2.5 text-center font-black text-rose-600">💎 ULTRA (2,000+)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 tabular-nums">
                  <tr>
                    <td className="p-2.5 font-bold">Annual Tariff</td>
                    <td className="p-2.5 text-center font-black text-blue-600">₹20,000 – ₹1,00,000</td>
                    <td className="p-2.5 text-center font-black text-amber-600">
                      ₹75,000 – ₹2,00,000 (500 Std: ₹1.2L · Renew ₹1L)
                    </td>
                    <td className="p-2.5 text-center font-black text-rose-600">₹3,00,000 (Renew ₹2,00,000)</td>
                  </tr>
                  {FEATURES.map((f) => (
                    <tr key={f.id}>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400 font-medium">{f.label}</td>
                      <td className="p-2.5 text-center">
                        {typeof f.lite === "string" ? <span className="font-bold">{f.lite}</span> : f.lite ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" /> : <XCircle size={13} className="text-slate-300 mx-auto" />}
                      </td>
                      <td className="p-2.5 text-center bg-amber-50/30 dark:bg-amber-950/10">
                        {typeof f.elite === "string" ? <span className="font-black text-amber-700 dark:text-amber-300">{f.elite}</span> : f.elite ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" /> : <XCircle size={13} className="text-slate-300 mx-auto" />}
                      </td>
                      <td className="p-2.5 text-center">
                        {typeof f.ultra === "string" ? <span className="font-black text-rose-600 dark:text-rose-400">{f.ultra}</span> : f.ultra ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" /> : <XCircle size={13} className="text-slate-300 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-slate-800/40">
                    <td colSpan={4} className="p-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>ULTRA Optional Dedicated Agent Schedule:</strong>{" "}
                      {ULTRA_AGENT_SCHEDULE.map((r) => `${r.label}: ERP ${fmtINR(r.erp)} + Agent ${fmtINR(r.agent)} (${fmtINR(r.total)})`).join("  ·  ")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Custom Message Box */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare size={14} className="text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs font-black text-slate-800 dark:text-slate-100">
              Koi Sawal ya Custom Quotation Chahiye?
            </p>
          </div>
          {sent ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-2.5 py-2 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-200 font-bold">
                Message bhej diya gaya hai! Super Admin jald reply karenge.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={contactMsg}
                onChange={(e) => setContactMsg(e.target.value)}
                placeholder="Jaise: Hamare 500 students hain, Elite Yearly plan activate karna hai."
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={sendRequest}
                disabled={sending || !contactMsg.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare size={13} />
                <span>{sending ? "Bhej rahe hain…" : "Super Admin ko Message Bhejo"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {buyingPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className={`p-3.5 text-white flex items-center justify-between ${
              buyingPlan.edition === "elite"
                ? "bg-amber-600"
                : buyingPlan.edition === "ultra"
                ? "bg-rose-600"
                : "bg-blue-700"
            }`}>
              <div className="flex items-center gap-2">
                {buyingPlan.isElite ? <Crown size={18} /> : <Zap size={18} />}
                <div>
                  <h3 className="text-xs font-black leading-tight">{buyingPlan.title}</h3>
                  <p className="text-[10px] opacity-90">Yearly Session Plan (12 Months)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBuyingPlan(null)}
                className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 space-y-3">
              {checkoutDone ? (
                <div className="text-center py-3 space-y-2.5">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={26} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-white">Yearly Request Sent!</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Request Super Admin ko bhej di gayi hai. Instant activation ke liye WhatsApp par share karein.
                  </p>
                  <button
                    type="button"
                    onClick={openWhatsAppCheckout}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare size={15} /> WhatsApp for Activation
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyingPlan(null)}
                    className="w-full py-1 text-slate-500 text-[11px] font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-500">School:</span>
                      <span className="font-bold truncate max-w-[170px]">{school?.name || "School"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Students Limit:</span>
                      <span className="font-bold">{buyingPlan.maxStudents >= 5000 ? "5,000+" : buyingPlan.maxStudents.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branches Limit:</span>
                      <span className="font-bold">{buyingPlan.maxBranches >= 9999 ? "Unlimited" : `${buyingPlan.maxBranches} Branch(es)`}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between items-center">
                      <span className="font-black">Yearly Fee:</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {fmtINR(buyingPlan.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={openWhatsAppCheckout}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare size={15} /> WhatsApp (+91 {SUPPORT_PHONE}) se Buy Karein
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCheckout}
                      disabled={checkoutSubmitting}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>{checkoutSubmitting ? "Submitting…" : "In-App Activation Request Bhejein"}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolPlanView;
