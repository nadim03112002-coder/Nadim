// @ts-nocheck
import React, { useState } from "react";
import {
  ArrowLeft, Crown, Shield, Lock, CheckCircle2, XCircle,
  MessageSquare, ChevronDown, ChevronUp, BookOpen, Users, FileText,
  IndianRupee, Sparkles, Zap, X, Flame, Clock, Camera, QrCode, Globe,
  Smartphone, Building2, Star, Check, Layers
} from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import {
  ELITE_YEARLY_PRICING,
  LITE_YEARLY_PRICES,
  SUPREME_YEARLY_PRICING,
  YEARLY_STUDENT_SLABS,
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

const FEATURES = [
  { id: "students",       icon: <Users size={14} />,       label: "Student Capacity",                          lite: "Up to 2,000 Students",          elite: "Up to 5,000 Students",            supreme: "5,000+ Students" },
  { id: "branches",       icon: <Building2 size={14} />,   label: "Multi-Branch Management",                   lite: "1 Branch Only",                 elite: "Up to 3 Branches",                supreme: "Unlimited Branches" },
  { id: "teachers",       icon: <Users size={14} />,       label: "Staff, Roles & Sub-Admins",               lite: "Included",                      elite: "Unlimited Role Permissions",      supreme: "Unlimited Branch Admins" },
  { id: "attendance",     icon: <QrCode size={14} />,      label: "QR Code Scan Attendance",                   lite: "⚡ Included",                   elite: "✅ Included",                     supreme: "✅ Included" },
  { id: "faceattendance", icon: <Camera size={14} />,      label: "AI Face Attendance (0.2s Kiosk)",           lite: false,                           elite: "👑 Included",                     supreme: "👑 Kiosk + On-Site Setup" },
  { id: "templates",      icon: <FileText size={14} />,    label: "60+ ID/Admit/Marksheet/Certificate/Fee Layouts", lite: "Default Format",     elite: "👑 60 Layouts (10 Classic + 50 New)",    supreme: "👑 Bespoke Custom Design" },
  { id: "entrance",       icon: <BookOpen size={14} />,    label: "Entrance Exam (17,500+ Qs) & 1–12 Notes",   lite: false,                           elite: "👑 Included",                     supreme: "👑 Full Suite Included" },
  { id: "customwebsite",  icon: <Globe size={14} />,       label: "Custom Website CMS, Photos & Gallery",      lite: "Default Website Only",          elite: "👑 Full Custom CMS",              supreme: "🌐 Custom .com/.in + CMS" },
  { id: "fees",           icon: <IndianRupee size={14} />, label: "Fee Collection, POS & WhatsApp Slips",      lite: "Core Register + Slips",         elite: "Full Ledger + Bulk WhatsApp",     supreme: "Multi-Branch Ledger" },
  { id: "walkie",         icon: <Smartphone size={14} />,  label: "School-Hour Walkie-Talkie & Audio/Video Calls", lite: false,                        elite: "👑 Live Intercom + HD Calls",     supreme: "👑 Full Staff & Class Suite" },
  { id: "tagada",         icon: <Smartphone size={14} />,  label: "Fee Tagada Caller & Parent Caller ID",      lite: false,                           elite: "👑 Ulta Directory + 1-Tap UPI",   supreme: "👑 Full Campus Tagada Suite" },
  { id: "playstoreapp",   icon: <Smartphone size={14} />,  label: "Play Store App (Own School Name & Logo)", lite: false,                           elite: false,                             supreme: "💎 White-Label APK/AAB" },
  { id: "onsite",         icon: <Layers size={14} />,      label: "On-Site Staff Training & Data Migration",   lite: false,                           elite: false,                             supreme: "💎 100% Campus Setup" },
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

type DecoyEdition = "lite" | "elite" | "supreme";

export const SchoolPlanView: React.FC<Props> = ({ school, schoolId, adminUid, onBack }) => {
  const [showCompare, setShowCompare] = useState(false);
  const [contactMsg, setContactMsg]   = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);

  const [selectedSlab, setSelectedSlab] = useState<number>(100);
  const [eliteMode, setEliteMode] = useState<"new" | "renewal">("new");

  const [buyingPlan, setBuyingPlan] = useState<{
    edition: DecoyEdition;
    tier: SubscriptionTier;
    isElite: boolean;
    isRenewal: boolean;
    maxStudents: number;
    maxBranches: number;
    amount: number;
    title: string;
  } | null>(null);

  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutDone, setCheckoutDone] = useState(false);

  const sub = school?.subscription;
  const isActive = sub?.status === "active";
  const tier = sub?.tier;
  const isSchoolElite = isSchoolEliteCurriculum(school);
  const isSupreme = tier === "whitelabel_5000";
  const planLevel: "none" | "lite" | "elite" | "supreme" =
    !isActive ? "none" : isSupreme ? "supreme" : isSchoolElite ? "elite" : "lite";

  const activeStudentsCap = getSchoolMaxStudents(school);
  const activeBranchesCap = getSchoolMaxBranches(school);
  const expiresAt = sub?.expiresAt || sub?.paidUntil;
  const days = daysRemaining(expiresAt);
  const expiringSoon = isActive && days > 0 && days <= 30;

  const planCfg = {
    none: {
      label: "No Yearly Plan Active",
      badge: "INACTIVE",
      color: "from-slate-400 to-slate-500",
      bg: "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700",
      icon: <Lock size={20} className="text-slate-400" />,
      desc: "School yearly subscription active nahi hai. Neeche se Lite, Elite ya Supreme plan chunein.",
    },
    lite: {
      label: `Lite Yearly Plan (${activeStudentsCap} Students · 1 Branch)`,
      badge: "⚡ LITE YEARLY",
      color: "from-blue-600 to-indigo-600",
      bg: "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
      icon: <Shield size={20} className="text-blue-500" />,
      desc: `Up to ${activeStudentsCap} Students · 1 Branch Max · QR Attendance & Default School Website`,
    },
    elite: {
      label: `Elite Yearly Suite (${activeStudentsCap >= 5000 ? "5,000" : activeStudentsCap} Students · ${activeBranchesCap} Branches)`,
      badge: "👑 ELITE YEARLY",
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50/60 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800",
      icon: <Crown size={20} className="text-amber-500" />,
      desc: "3 Branches · Custom Website CMS + AI Face Attendance + 60 Document Layouts (10 Classic + 50 New) + Entrance Exam & Notes",
    },
    supreme: {
      label: "Supreme White-Label Yearly (5,000+ Students · Unlimited Branches)",
      badge: "💎 SUPREME",
      color: "from-rose-500 via-amber-500 to-orange-500",
      bg: "bg-gradient-to-r from-amber-50/80 to-rose-50/60 dark:from-amber-950/30 dark:to-rose-950/20 border-amber-400 dark:border-amber-700",
      icon: <Crown size={20} className="text-rose-500" />,
      desc: "Unlimited Branches · Play Store App + On-Site Training + 100% Data Migration + Custom .com Website",
    },
  }[planLevel];

  const liteUnavailable = selectedSlab > 2000;
  const litePrice = liteUnavailable ? LITE_YEARLY_PRICES[2000] : getLitePriceForSlab(selectedSlab);
  const elitePrice = eliteMode === "renewal" ? ELITE_YEARLY_PRICING.renewal : ELITE_YEARLY_PRICING.firstYear;
  const supremePrice = SUPREME_YEARLY_PRICING.price;

  const handleInitiateBuy = (edition: DecoyEdition) => {
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
        title: `⚡ Lite Yearly (${selectedSlab} Students · 1 Branch)`,
      });
    } else if (edition === "elite") {
      setBuyingPlan({
        edition: "elite",
        tier: "enterprise_2000",
        isElite: true,
        isRenewal: eliteMode === "renewal",
        maxStudents: 5000,
        maxBranches: 3,
        amount: elitePrice,
        title: `👑 Elite Yearly (${eliteMode === "renewal" ? "Annual Renewal" : "1st Year Offer"} · 3 Branches)`,
      });
    } else {
      setBuyingPlan({
        edition: "supreme",
        tier: "whitelabel_5000",
        isElite: true,
        isRenewal: false,
        maxStudents: 5000,
        maxBranches: 9999,
        amount: supremePrice,
        title: "💎 Supreme White-Label Yearly (Unlimited Branches)",
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
        duration: "1_year",
        amount: buyingPlan.amount,
        planTitle: buyingPlan.title,
        message: `School: ${school?.name}${visibleReg ? ` (${visibleReg})` : ""} ne ${buyingPlan.title} ₹${buyingPlan.amount.toLocaleString("en-IN")}/Year select kiya hai.`,
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
      `💰 *Amount:* ₹${buyingPlan.amount.toLocaleString("en-IN")}\n\n` +
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
      <div className="sticky top-0 z-30 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xs font-black text-white tracking-wide truncate flex items-center gap-1.5">
                <span>Yearly Subscription Plans</span>
                {getVisibleSchoolRegNo(school) && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
                    {getVisibleSchoolRegNo(school)}
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-slate-400 truncate">{school?.name || "School ERP"}</p>
            </div>
          </div>

          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            isActive
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/30"
          }`}>
            {isActive ? "Active · Yearly" : "Expired"}
          </span>
        </div>
      </div>

      <div className="px-3.5 py-4 space-y-4 max-w-5xl mx-auto">
        {/* Current Active Plan Card */}
        <div className={`rounded-xl border p-3.5 ${planCfg.bg} shadow-xs transition-all`}>
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${planCfg.color} flex items-center justify-center text-white shadow-xs shrink-0`}>
                {planCfg.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">{planCfg.label}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded border bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700">
                    {planCfg.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{planCfg.desc}</p>
              </div>
            </div>

            {isActive && expiresAt && (
              <div className="text-right shrink-0">
                <span className={`text-[10px] font-black tabular-nums px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                  expiringSoon
                    ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse"
                    : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300"
                }`}>
                  <Clock size={11} /> {days}d left
                </span>
              </div>
            )}
          </div>

          {isActive && expiresAt && (
            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Valid till: <strong className="text-slate-700 dark:text-slate-200 tabular-nums">{fmtDate(expiresAt)}</strong>
              </span>
              {expiringSoon ? (
                <span className="font-black text-red-600 dark:text-red-400 flex items-center gap-1">
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

        {/* Yearly Student Capacity Selector */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                <Zap size={14} className="text-amber-500" /> Student Capacity Chunein (Yearly Plans Only)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lite ₹5,000/yr se shuru (+50% per slab, max 2,000 Std, 1 Branch) · Elite mein 5,000 Std &amp; 3 Branches · Supreme mein Unlimited Branches.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {YEARLY_STUDENT_SLABS.map((slab) => (
              <button
                key={slab}
                type="button"
                onClick={() => setSelectedSlab(slab)}
                className={`p-2 rounded-xl border-2 text-center transition cursor-pointer ${
                  selectedSlab === slab
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-xs"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                }`}
              >
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {slab >= 5000 ? "5,000+" : slab} Std
                </p>
                <p className={`text-[10px] font-bold mt-0.5 ${slab > 2000 ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
                  {slab > 2000 ? "Elite / Supreme" : `Lite ₹${LITE_YEARLY_PRICES[slab].toLocaleString("en-IN")}`}
                </p>
              </button>
            ))}
          </div>

          {/* 3-TIER DECOY GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
            {/* LITE */}
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    ⚡ LITE YEARLY
                  </span>
                  <span className="text-[10px] font-black text-slate-500">1 Branch Max</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Lite ({liteUnavailable ? "Max 2,000" : selectedSlab} Students)
                  </h3>
                  {liteUnavailable ? (
                    <p className="text-xs font-black text-rose-600 mt-1">
                      5,000+ ke liye Elite ya Supreme plan lein
                    </p>
                  ) : (
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                      ₹{litePrice.toLocaleString("en-IN")}
                      <span className="text-xs font-bold text-slate-500"> / Year</span>
                    </p>
                  )}
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-500 shrink-0" /> 1 Branch Management</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-500 shrink-0" /> QR Scan Attendance &amp; Fees</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-emerald-500 shrink-0" /> Default School Website Only</li>
                  <li className="flex items-center gap-1.5 text-slate-400"><Lock size={12} className="shrink-0" /> No Custom CMS / Face ID</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={liteUnavailable}
                onClick={() => handleInitiateBuy("lite")}
                className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-black transition cursor-pointer"
              >
                {liteUnavailable ? "Max 2,000 Students Only" : `Select Lite (₹${litePrice.toLocaleString("en-IN")})`}
              </button>
            </div>

            {/* ELITE (HERO) */}
            <div className="rounded-2xl border-2 border-amber-500 p-4 flex flex-col justify-between bg-gradient-to-b from-amber-50 via-white to-white dark:from-amber-950/35 dark:via-slate-900 dark:to-slate-900 shadow-lg ring-2 ring-amber-500/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center gap-1">
                    <Star size={11} className="fill-slate-950" /> BEST SELLER · ELITE
                  </span>
                  <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">3 Branches Max</span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Crown size={16} className="text-amber-500" /> Elite Yearly Suite
                  </h3>
                  <div className="mt-1.5 bg-amber-500/10 border border-amber-400/50 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-600 dark:text-slate-300">12 Months Price:</span>
                      <span className="line-through text-rose-600 dark:text-rose-400 font-black">₹1,20,000</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEliteMode("new")}
                        className={`p-1.5 rounded-lg border text-left transition cursor-pointer ${
                          eliteMode === "new"
                            ? "bg-amber-500 text-slate-950 border-amber-600 font-black"
                            : "bg-white dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="text-[9px] font-black uppercase">1st Year Offer</div>
                        <div className="text-xs font-black">₹1,00,000 मात्र</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEliteMode("renewal")}
                        className={`p-1.5 rounded-lg border text-left transition cursor-pointer ${
                          eliteMode === "renewal"
                            ? "bg-emerald-600 text-white border-emerald-700 font-black"
                            : "bg-white dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="text-[9px] font-black uppercase">Renewal Fee</div>
                        <div className="text-xs font-black">₹80,000 / yr</div>
                      </button>
                    </div>
                  </div>
                </div>

                <ul className="space-y-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> <strong>Up to 5,000 Students &amp; 3 Branches</strong></li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> AI Face ID + Custom Website CMS</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> 60+ Document Template Studio (10 Classic + 50 New)</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-600 shrink-0" /> Entrance Exam Bank &amp; Notes</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleInitiateBuy("elite")}
                className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-black transition cursor-pointer shadow-md"
              >
                Kharidein Elite (₹{elitePrice.toLocaleString("en-IN")}/yr)
              </button>
            </div>

            {/* SUPREME */}
            <div className="rounded-2xl border-2 border-rose-500/70 p-4 flex flex-col justify-between bg-slate-900 text-white">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-600 text-white">
                    💎 SUPREME 5000+
                  </span>
                  <span className="text-[10px] font-black text-rose-300">Unlimited Branches</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Supreme White-Label</h3>
                  <p className="text-2xl font-black text-amber-300 mt-1">
                    ₹2,00,000 <span className="text-xs font-bold text-slate-300">/ Year Fixed</span>
                  </p>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-200">
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> 5,000+ Students &amp; Unlimited Branches</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> Play Store App (Own Name &amp; Logo)</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> On-Site Training &amp; Data Migration</li>
                  <li className="flex items-center gap-1.5"><Check size={13} className="text-amber-400 shrink-0" /> Custom .com/.in + All Elite Powers</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => handleInitiateBuy("supreme")}
                className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white text-xs font-black transition cursor-pointer"
              >
                Book Supreme (₹2,00,000/yr)
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Table Accordion */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowCompare(v => !v)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
          >
            <p className="text-xs font-black text-slate-800 dark:text-slate-200">
              Full Yearly Comparison: ⚡ Lite vs 👑 Elite vs 💎 Supreme
            </p>
            {showCompare ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </button>

          {showCompare && (
            <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-[11px] border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-2 text-left font-black">Feature / Yearly Plan</th>
                    <th className="p-2 text-center font-black text-blue-600">⚡ Lite Yearly</th>
                    <th className="p-2 text-center font-black text-amber-600">👑 Elite (Hero)</th>
                    <th className="p-2 text-center font-black text-rose-600">💎 Supreme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr>
                    <td className="p-2 font-bold">Annual Price</td>
                    <td className="p-2 text-center font-black text-blue-600">₹5,000 – ₹25,313</td>
                    <td className="p-2 text-center font-black text-amber-600">
                      <span className="line-through text-slate-400 mr-1">₹1,20,000</span>₹1,00,000 (Renew ₹80k)
                    </td>
                    <td className="p-2 text-center font-black text-rose-600">₹2,00,000 Fixed</td>
                  </tr>
                  {FEATURES.map(f => (
                    <tr key={f.id}>
                      <td className="p-2 text-slate-600 dark:text-slate-400 font-medium">{f.label}</td>
                      <td className="p-2 text-center">
                        {typeof f.lite === "string" ? <span className="font-bold">{f.lite}</span> : f.lite ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" /> : <XCircle size={13} className="text-slate-300 mx-auto" />}
                      </td>
                      <td className="p-2 text-center bg-amber-50/30 dark:bg-amber-950/10">
                        {typeof f.elite === "string" ? <span className="font-black text-amber-700 dark:text-amber-300">{f.elite}</span> : f.elite ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" /> : <XCircle size={13} className="text-slate-300 mx-auto" />}
                      </td>
                      <td className="p-2 text-center">
                        {typeof f.supreme === "string" ? <span className="font-black text-rose-600 dark:text-rose-400">{f.supreme}</span> : f.supreme ? <CheckCircle2 size={13} className="text-emerald-500 mx-auto" /> : <XCircle size={13} className="text-slate-300 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Custom Message Box */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 shadow-xs">
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
                onChange={e => setContactMsg(e.target.value)}
                placeholder="Jaise: Hamare 2 branches hain, Elite Yearly plan activate karna hai."
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
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
                ? "bg-gradient-to-r from-amber-600 to-orange-600"
                : buyingPlan.edition === "supreme"
                ? "bg-gradient-to-r from-rose-600 to-pink-600"
                : "bg-gradient-to-r from-blue-700 to-indigo-700"
            }`}>
              <div className="flex items-center gap-2">
                {buyingPlan.isElite ? <Crown size={18} /> : <Zap size={18} />}
                <div>
                  <h3 className="text-xs font-black leading-tight">{buyingPlan.title}</h3>
                  <p className="text-[10px] opacity-90">Yearly Session Plan (12 Months)</p>
                </div>
              </div>
              <button
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
                    onClick={openWhatsAppCheckout}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare size={15} /> WhatsApp for Activation
                  </button>
                  <button
                    onClick={() => setBuyingPlan(null)}
                    className="w-full py-1 text-slate-500 text-[11px] font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">School:</span>
                      <span className="font-bold truncate max-w-[170px]">{school?.name || "School"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Students Limit:</span>
                      <span className="font-bold">{buyingPlan.maxStudents >= 5000 ? "5,000+" : buyingPlan.maxStudents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branches Limit:</span>
                      <span className="font-bold">{buyingPlan.maxBranches >= 9999 ? "Unlimited" : `${buyingPlan.maxBranches} Branch(es)`}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between items-center">
                      <span className="font-black">Yearly Fee:</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ₹{buyingPlan.amount.toLocaleString("en-IN")}
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
