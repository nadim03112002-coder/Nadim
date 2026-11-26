// @ts-nocheck
import React, { useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, MessageCircle, Users, Crown, Lock,
  Building2, Star, Check, Layers, Sparkles, ShieldCheck, ChevronDown, ChevronUp,
  UserCheck, Globe, Smartphone, Cpu
} from "lucide-react";
import {
  LITE_YEARLY_PRICES,
  ULTRA_YEARLY_PRICING,
  ULTRA_AGENT_SCHEDULE,
  YEARLY_STUDENT_SLABS,
  getElitePricingForSlab,
  getLitePriceForSlab,
  getSchoolMaxBranches,
  getSchoolMaxStudents,
  type School,
} from "../../school-types";
import { ADMIN_WHATSAPP_NUMBER } from "../../constants";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";

export { ADMIN_WHATSAPP_NUMBER };

interface Props {
  school: School;
  onBack: () => void;
}

const fmtINR = (amt: number) => `₹${Math.round(amt || 0).toLocaleString("en-IN")}`;

export const SchoolStore: React.FC<Props> = ({ school, onBack }) => {
  const [selectedSlab, setSelectedSlab] = useState<number>(500);
  const [eliteBillingMode, setEliteBillingMode] = useState<"new" | "renewal">("new");
  const [ultraBillingMode, setUltraBillingMode] = useState<"new" | "renewal">("new");
  const [includeAgentAddon, setIncludeAgentAddon] = useState<boolean>(false);
  const [showAgentSchedule, setShowAgentSchedule] = useState<boolean>(false);

  const currentTier = school.subscription?.tier;
  const isEliteActive = Boolean(school.isElite || school.subscription?.isElite || currentTier === "whitelabel_5000");
  const isUltraActive = currentTier === "whitelabel_5000";
  const isActive = school.subscription?.status === "active";
  const expiresAt = school.subscription?.expiresAt;
  const currentMaxStudents = getSchoolMaxStudents(school);
  const currentMaxBranches = getSchoolMaxBranches(school);

  const liteUnavailableForSlab = selectedSlab > 2000;
  const litePrice = liteUnavailableForSlab
    ? LITE_YEARLY_PRICES[2000]
    : getLitePriceForSlab(selectedSlab);

  const elitePricing = useMemo(() => getElitePricingForSlab(selectedSlab), [selectedSlab]);
  const elitePrice = eliteBillingMode === "renewal" ? elitePricing.renewal : elitePricing.firstYear;
  const eliteDiscount = Math.max(0, elitePricing.mrp - elitePricing.firstYear);

  const ultraLockedForSlab = selectedSlab < ULTRA_YEARLY_PRICING.minStudents;
  const ultraErpPrice =
    ultraBillingMode === "renewal" ? ULTRA_YEARLY_PRICING.renewal : ULTRA_YEARLY_PRICING.firstYear;
  const ultraAgentYr1OrYr2 = ultraBillingMode === "renewal" ? 250000 : 200000;
  const ultraTotalPrice = ultraErpPrice + (includeAgentAddon ? ultraAgentYr1OrYr2 : 0);

  const perStudentMonth = (annualAmt: number, stdCount: number) => {
    const denom = Math.max(100, stdCount) * 12;
    return Math.max(1, Math.round(annualAmt / denom));
  };

  const sendWhatsApp = (edition: "lite" | "elite" | "ultra") => {
    const slabLabel = selectedSlab >= 5000 ? "5,000+" : String(selectedSlab);
    const planText =
      edition === "ultra"
        ? `💎 ULTRA White-Label (2,000+ Students · Unlimited Branches · Custom Domain & Own APK) — ${
            ultraBillingMode === "renewal" ? "Annual Renewal ₹2,00,000" : "1st Year ₹3,00,000"
          }${includeAgentAddon ? ` + Dedicated ERP Agent (${fmtINR(ultraAgentYr1OrYr2)}/yr) = Total ${fmtINR(ultraTotalPrice)}/yr` : ""}`
        : edition === "elite"
        ? `👑 ELITE Yearly (${slabLabel} Students · Up to 3 Branches) — ${
            eliteBillingMode === "renewal"
              ? `Annual Renewal ${fmtINR(elitePricing.renewal)}/yr`
              : `1st Year Offer ${fmtINR(elitePricing.firstYear)} (MRP ${fmtINR(elitePricing.mrp)})`
          }`
        : `⚡ LITE Yearly (${slabLabel} Students · 1 Branch Max) — ${fmtINR(litePrice)}/Year`;

    const msg = encodeURIComponent(
      `Namaste! 🙏\n\nMain *${school.name}* ka School Admin hoon.\n\nMujhe *${planText}* yearly subscription chahiye.\n\n📋 School Details:\n• School: ${school.name}\n• School Code: ${school.code}\n• Admin Email: ${school.adminEmail}\n\nKripya yearly plan activate karein. Dhanyawad!`
    );
    safeOpenExternalUrl(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${msg}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 dark:bg-black px-4 py-6 border-b border-slate-800 text-white">
        <div className="max-w-6xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-bold mb-3 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <p className="text-amber-400 text-[11px] font-black uppercase tracking-widest mb-1">
            Official Yearly ERP Store · Lite · Elite · Ultra White-Label
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            School Yearly Subscription Plans
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            100 se 5,000+ Students tak transparent yearly pricing · Elite mein complete AI automation + 60 document designs included
          </p>
        </div>
      </header>

      <div className="p-4 max-w-6xl mx-auto space-y-5">
        {/* Active Subscription Status Line */}
        {isActive ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-black text-emerald-950 dark:text-emerald-100 truncate">
                  {isUltraActive
                    ? "💎 ULTRA White-Label Active"
                    : isEliteActive
                    ? "👑 ELITE Yearly Plan Active"
                    : "⚡ LITE Yearly Plan Active"}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 ml-2 text-xs tabular-nums">
                    {currentMaxStudents >= 5000 ? "5,000+" : currentMaxStudents} Students ·{" "}
                    {currentMaxBranches >= 9999
                      ? "Unlimited Branches"
                      : `${currentMaxBranches} Branch${currentMaxBranches > 1 ? "es" : ""}`}
                  </span>
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {expiresAt
                    ? `Valid till ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                    : "Yearly Subscription Active"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/70 rounded-xl px-4 py-3 flex items-center gap-3">
            <Lock className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">Subscription Inactive</p>
              <p className="text-xs text-rose-600 dark:text-rose-300">
                Apne school ki strength ke hisab se neeche se Yearly plan select karein.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Student Strength Slab Selector */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                Step 1: School Student Capacity Chunein
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lite ₹20k se ₹1L (max 2,000 Std) · Elite ₹75k se ₹2L (all 6 slabs, 3 Branches) · ULTRA sirf 2,000+ Students ke liye fixed ₹3L/yr
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Annual Billing Only
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {YEARLY_STUDENT_SLABS.map((slab) => {
              const active = selectedSlab === slab;
              const slabElite = getElitePricingForSlab(slab);
              const isUltraEligible = slab >= ULTRA_YEARLY_PRICING.minStudents;
              return (
                <button
                  key={slab}
                  type="button"
                  onClick={() => setSelectedSlab(slab)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    active
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/35 ring-2 ring-amber-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                    {slab >= 5000 ? "5,000+" : slab.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Students</p>
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
                    Elite {fmtINR(slabElite.firstYear)}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {slab <= 2000 ? `Lite ${fmtINR(LITE_YEARLY_PRICES[slab])}` : isUltraEligible ? "ULTRA Eligible" : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: 3-Tier Pricing Grid (Lite | Elite HERO | ULTRA 2000+) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* 1. LITE YEARLY */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider">
                <span className="text-blue-600 dark:text-blue-400">⚡ LITE YEARLY</span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> 1 Branch Max
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Starter ERP ({liteUnavailableForSlab ? "Max 2,000" : selectedSlab.toLocaleString("en-IN")} Std)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Chhote single-branch schools ke liye core register, QR attendance aur default website.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                {liteUnavailableForSlab ? (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    5,000+ Students ke liye Lite uplabdh nahi hai (Max 2,000 Students). 👑 Elite ya 💎 ULTRA chunein.
                  </p>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                        {fmtINR(litePrice)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">/ Year</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      ≈ ₹{perStudentMonth(litePrice, selectedSlab)} / student / month · Renewal same slab tariff
                    </p>
                  </>
                )}
              </div>

              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> 100 – 2,000 Students (Slab-wise)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> 1 Branch Management Only</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> QR Code Scan Attendance &amp; Core Fees</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Default School Website (Fixed Layout)</li>
                <li className="flex items-center gap-2 text-slate-400"><Lock className="w-3.5 h-3.5 shrink-0" /> Fee Tagada Caller &amp; Parent Caller ID (Elite)</li>
                <li className="flex items-center gap-2 text-slate-400"><Lock className="w-3.5 h-3.5 shrink-0" /> AI Face ID, 60 Doc Designs &amp; Custom CMS</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={liteUnavailableForSlab}
              onClick={() => sendWhatsApp("lite")}
              className="mt-6 w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              {liteUnavailableForSlab ? "Max 2,000 Students Only" : `Select Lite (${fmtINR(litePrice)}/yr)`}
            </button>
          </div>

          {/* 2. ELITE YEARLY (HERO / BEST SELLER) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-500 p-5 flex flex-col justify-between shadow-lg relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider">
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> BEST SELLER · ELITE
                </span>
                <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Up to 3 Branches
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Crown className="w-5 h-5 text-amber-500" />
                  Elite Yearly Suite ({selectedSlab >= 5000 ? "5,000+" : selectedSlab.toLocaleString("en-IN")} Std)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Full automation suite: AI Face Attendance, Fee Tagada Caller, Custom CMS &amp; 60 Print Layouts.
                </p>
              </div>

              {/* Slab-Synced Offer + Renewal Toggle */}
              <div className="pt-3 border-t border-amber-200/70 dark:border-amber-900/50 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Standard MRP:</span>
                  <span className="line-through text-rose-600 dark:text-rose-400 font-black tabular-nums">
                    {fmtINR(elitePricing.mrp)}/yr
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEliteBillingMode("new")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      eliteBillingMode === "new"
                        ? "bg-amber-500 text-slate-950 border-amber-600"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">1st Year Offer</p>
                    <p className="text-lg font-black leading-tight tabular-nums">{fmtINR(elitePricing.firstYear)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEliteBillingMode("renewal")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      eliteBillingMode === "renewal"
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">Yearly Renewal</p>
                    <p className="text-lg font-black leading-tight tabular-nums">{fmtINR(elitePricing.renewal)}</p>
                  </button>
                </div>

                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                  {eliteBillingMode === "new"
                    ? `Save ${fmtINR(eliteDiscount)} in 1st Year · Only ₹${perStudentMonth(elitePricing.firstYear, selectedSlab)}/student/mo`
                    : `Annual Renewal ${fmtINR(elitePricing.renewal)}/yr · Only ₹${perStudentMonth(elitePricing.renewal, selectedSlab)}/student/mo`}
                </p>
              </div>

              <ul className="space-y-2 text-xs text-slate-800 dark:text-slate-200 font-medium pt-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> <strong>Up to 3 Branches + Full Multi-Role Access</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 📞 Fee Tagada Caller, Parent Caller ID &amp; NSTA Messenger</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🤖 AI Face Attendance (0.2s Kiosk + Face ID)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🎨 60+ ID, Admit, Marksheet (A4 2-Side) &amp; Fee Layouts</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🌐 Custom Website CMS + Online Entrance Exam (17,500+ Qs)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🛡️ Principal Discount Approval + Immutable Audit Logs</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => sendWhatsApp("elite")}
              className="mt-6 w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <Crown className="w-4 h-4" />
              Activate Elite ({fmtINR(elitePrice)}/yr)
            </button>
          </div>

          {/* 3. ULTRA WHITE-LABEL (2,000+ ONLY + OPTIONAL AGENT) */}
          <div className="bg-slate-900 dark:bg-black text-white rounded-2xl border border-slate-700 dark:border-slate-800 p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wider">
                <span className="text-rose-400">💎 ULTRA WHITE-LABEL</span>
                <span className="text-slate-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> 2,000+ Std Only
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-white">
                  Own Brand Domain + APK Edition
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Sirf 2,000+ Students wale bade schools &amp; groups ke liye apna domain, apna Play Store App icon aur Unlimited Branches.
                </p>
              </div>

              {/* ULTRA Tariff Switch (1st Year ₹3L / Renewal ₹2L) */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUltraBillingMode("new")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      ultraBillingMode === "new"
                        ? "bg-rose-600 text-white border-rose-500"
                        : "bg-slate-800/70 border-slate-700 text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">1st Year ERP</p>
                    <p className="text-base font-black leading-tight tabular-nums">₹3,00,000</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUltraBillingMode("renewal")}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      ultraBillingMode === "renewal"
                        ? "bg-emerald-600 text-white border-emerald-500"
                        : "bg-slate-800/70 border-slate-700 text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">Yearly Renewal</p>
                    <p className="text-base font-black leading-tight tabular-nums">₹2,00,000</p>
                  </button>
                </div>

                {/* Optional Dedicated Agent Add-On */}
                <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 space-y-2">
                  <label className="flex items-start justify-between gap-2 cursor-pointer">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={includeAgentAddon}
                        onChange={(e) => setIncludeAgentAddon(e.target.checked)}
                        className="mt-0.5 rounded accent-amber-500"
                      />
                      <div>
                        <p className="text-xs font-black text-amber-300 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Add Dedicated ERP Agent
                        </p>
                        <p className="text-[11px] text-slate-300 tabular-nums">
                          {ultraBillingMode === "renewal" ? "Year 2 Agent: +₹2,50,000/yr" : "Year 1 Agent: +₹2,00,000/yr"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-white tabular-nums">
                      {fmtINR(ultraTotalPrice)}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowAgentSchedule((v) => !v)}
                    className="w-full flex items-center justify-between text-[11px] font-bold text-slate-300 hover:text-white pt-1 border-t border-slate-700/80 cursor-pointer"
                  >
                    <span>5-Year Agent Cap Schedule (Max ₹4L/yr)</span>
                    {showAgentSchedule ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showAgentSchedule && (
                    <div className="space-y-1 pt-1 text-[11px] tabular-nums">
                      {ULTRA_AGENT_SCHEDULE.map((row) => (
                        <div key={row.year} className="flex items-center justify-between text-slate-300">
                          <span>{row.label}</span>
                          <span>
                            ERP {fmtINR(row.erp)} + Agent {fmtINR(row.agent)} ={" "}
                            <strong className="text-amber-300">{fmtINR(row.total)}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {ultraLockedForSlab && (
                  <p className="text-[11px] font-semibold text-amber-300">
                    Note: Selected slab {selectedSlab} Std hai — ULTRA 2,000+ Students package par hi activate hota hai.
                  </p>
                )}
              </div>

              <ul className="space-y-2 text-xs text-slate-200 pt-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> <strong>2,000+ Students · Unlimited Branches</strong></li>
                <li className="flex items-center gap-2"><Globe className="w-4 h-4 text-amber-400 shrink-0" /> Own Custom Domain (.com / .in / .org)</li>
                <li className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-amber-400 shrink-0" /> Own Brand Play Store APK + School Icon</li>
                <li className="flex items-center gap-2"><Cpu className="w-4 h-4 text-amber-400 shrink-0" /> 100% Old Data Migration + On-Site Training</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" /> All Elite Automation + Priority Account Manager</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => sendWhatsApp("ultra")}
              className="mt-6 w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              Book ULTRA ({fmtINR(ultraTotalPrice)}/yr)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
