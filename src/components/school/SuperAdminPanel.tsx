// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  subscribeToAllSchools, saveSchool, updateSchool, generateId, setSchoolLockCode,
  assignSchoolAdminByEmail, checkEmailSchoolAllotment, lockSchool, deleteSchool
} from "../../school-firebase";
import {
  isSchoolEliteCurriculum,
  LITE_YEARLY_PRICES,
  ELITE_YEARLY_PRICING,
  ULTRA_YEARLY_PRICING,
  ULTRA_AGENT_SCHEDULE,
  YEARLY_STUDENT_SLABS,
  getElitePricingForSlab,
  getLitePriceForSlab,
  type School,
  type SchoolSubscription,
} from "../../school-types";
import { SchoolAdminPanel } from "./SchoolAdminPanel";
import { AdminAccountsDirectory } from "./AdminAccountsDirectory";
import { db, rtdb } from "../../firebase";
import { ref, set } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";
import {
  School as SchoolIcon, Plus, Pause, Play,
  Users, IndianRupee, Settings, X, Zap, Tag, Lock, Eye, EyeOff, Shield, Trash2, Unlock, ArrowLeft,
  CreditCard, CheckCircle, AlertCircle, Clock, ChevronRight, FileText, StickyNote, Calendar, Crown,
  Bell, Sliders, Smartphone, Check, Sparkles, Camera, Upload, Code2, Globe, Loader2, LogOut, ClipboardCheck, Bug
} from "lucide-react";
import { toast } from "sonner";
import { ErrorNoticeBoard } from "../admin/ErrorNoticeBoard";
import { setErrorLoggerModule } from "../../utils/errorLogger";
import { compressImageFileToDataUrl } from "../../utils/imageCompression";
import {
  DEFAULT_GLOBAL_DEVELOPER,
  saveGlobalDeveloperConfig,
  subscribeToGlobalDeveloperConfig,
  type GlobalWebsiteDeveloperConfig,
} from "../../utils/globalDeveloperConfig";
import { useBackHandler } from "../../utils/backNavigation";
import { ScreenInfoGuideButton } from "./ScreenInfoGuideButton";
import { LanguageToggleButton } from "./LanguageToggleButton";
import { QualityTestingChecklistModal, getQaChecklistCompletedCount } from "./QualityTestingChecklistModal";

interface Props {
  adminUid: string;
  onBack?: () => void;
  onLogout?: () => void;
}

// ── YEARLY-ONLY PRICING CONFIG (LITE · ELITE · ULTRA) ─────────────────────────
type SuperEdition = "lite" | "elite" | "ultra";

const isCombo = (s: SchoolSubscription) =>
  Boolean(s.isElite || s.customCurriculumEnabled || s.tier === "whitelabel_5000");

const calcAmount = (s: SchoolSubscription): number => {
  if (typeof s.yearlyAmount === "number" && s.yearlyAmount > 0) return s.yearlyAmount;
  if (typeof s.monthlyAmount === "number" && s.monthlyAmount > 0) return s.monthlyAmount;
  if (s.tier === "whitelabel_5000") {
    const base = s.isRenewal ? ULTRA_YEARLY_PRICING.renewal : ULTRA_YEARLY_PRICING.firstYear;
    return base + (s.agentAddOn ? (s.agentAnnualFee || (s.isRenewal ? 250000 : 200000)) : 0);
  }
  if (s.isElite || s.customCurriculumEnabled || s.tier === "enterprise_2000" || s.tier === "full") {
    const slab = getElitePricingForSlab(s.maxStudents || 500);
    return s.isRenewal ? slab.renewal : slab.firstYear;
  }
  return getLitePriceForSlab(s.maxStudents || 100);
};

const defaultSub: SchoolSubscription = {
  reading: true,
  writing: true,
  pdf: true,
  mcq: true,
  tier: "enterprise_2000",
  maxStudents: 500,
  maxTeachers: 9999,
  maxBranches: 3,
  isElite: true,
  customCurriculumEnabled: true,
  monthlyAmount: ELITE_YEARLY_PRICING.firstYear,
  yearlyAmount: ELITE_YEARLY_PRICING.firstYear,
  mrpAmount: ELITE_YEARLY_PRICING.mrp,
  renewalAmount: ELITE_YEARLY_PRICING.renewal,
  isRenewal: false,
  planDuration: "1_year",
  status: "active",
};

// ── REUSABLE YEARLY 3-TIER SUBSCRIPTION EDITOR ───────────────────────────────
const resolveSuperEdition = (sub?: SchoolSubscription | null): SuperEdition => {
  if (!sub) return "elite";
  if (sub.tier === "whitelabel_5000") return "ultra";
  if (sub.isElite || sub.customCurriculumEnabled || sub.tier === "enterprise_2000" || sub.tier === "full") return "elite";
  return "lite";
};

const SubEditor = ({
  value,
  onChange,
  label = "School Management Yearly Subscription",
}: {
  value: SchoolSubscription;
  onChange: (s: SchoolSubscription) => void;
  label?: string;
}) => {
  const edition = resolveSuperEdition(value);
  const currentSlab = value.maxStudents || (edition === "lite" ? 100 : edition === "ultra" ? 5000 : 500);
  const isRenewal = Boolean(value.isRenewal);
  const agentAddOn = Boolean(value.agentAddOn);
  const agentYear = Math.min(5, Math.max(1, Number(value.agentYear || (isRenewal ? 2 : 1))));
  const displayedAmount = calcAmount(value);

  const applyConfig = (
    nextEdition: SuperEdition,
    slab: number,
    nextRenewal: boolean,
    nextAgent = agentAddOn,
    nextAgentYr = agentYear
  ) => {
    if (nextEdition === "lite") {
      const clampedSlab = slab > 2000 ? 2000 : slab;
      const amt = getLitePriceForSlab(clampedSlab);
      onChange({
        ...value,
        tier: clampedSlab <= 300 ? "starter_200" : clampedSlab <= 500 ? "growth_500" : "lite",
        maxStudents: clampedSlab,
        maxTeachers: 9999,
        maxBranches: 1,
        isElite: false,
        customCurriculumEnabled: false,
        isRenewal: false,
        agentAddOn: false,
        monthlyAmount: amt,
        yearlyAmount: amt,
        planDuration: "1_year",
        reading: true,
        writing: true,
        pdf: true,
        mcq: true,
        status: "active",
      });
    } else if (nextEdition === "ultra") {
      const schedRow = ULTRA_AGENT_SCHEDULE.find((r) => r.year === nextAgentYr) || ULTRA_AGENT_SCHEDULE[0];
      const baseAmt = nextRenewal ? ULTRA_YEARLY_PRICING.renewal : ULTRA_YEARLY_PRICING.firstYear;
      const agentAmt = nextAgent ? schedRow.agent : 0;
      const totalAmt = baseAmt + agentAmt;
      onChange({
        ...value,
        tier: "whitelabel_5000",
        maxStudents: 5000,
        maxTeachers: 9999,
        maxBranches: 9999,
        isElite: true,
        customCurriculumEnabled: true,
        isRenewal: nextRenewal,
        agentAddOn: nextAgent,
        agentYear: nextAgentYr,
        agentAnnualFee: agentAmt,
        renewalAmount: ULTRA_YEARLY_PRICING.renewal,
        monthlyAmount: totalAmt,
        yearlyAmount: totalAmt,
        planDuration: "1_year",
        reading: true,
        writing: true,
        pdf: true,
        mcq: true,
        status: "active",
      });
    } else {
      const eSlab = getElitePricingForSlab(slab);
      const amt = nextRenewal ? eSlab.renewal : eSlab.firstYear;
      onChange({
        ...value,
        tier: "enterprise_2000",
        maxStudents: slab,
        maxTeachers: 9999,
        maxBranches: ELITE_YEARLY_PRICING.maxBranches,
        isElite: true,
        customCurriculumEnabled: true,
        isRenewal: nextRenewal,
        agentAddOn: false,
        mrpAmount: eSlab.mrp,
        renewalAmount: eSlab.renewal,
        monthlyAmount: amt,
        yearlyAmount: amt,
        planDuration: "1_year",
        reading: true,
        writing: true,
        pdf: true,
        mcq: true,
        status: "active",
      });
    }
  };

  const eliteSlab = getElitePricingForSlab(currentSlab);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3.5 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{label}</h3>
        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
          ₹{displayedAmount.toLocaleString("en-IN")}/year
        </span>
      </div>

      {/* 3 Yearly Plan Editions */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl">
        <button
          type="button"
          onClick={() => applyConfig("lite", currentSlab > 2000 ? 100 : currentSlab, false, false)}
          className={`py-2 px-1.5 rounded-lg text-xs font-black transition cursor-pointer text-center ${
            edition === "lite"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
          }`}
        >
          <p className="leading-tight">⚡ Lite Yearly</p>
          <span className="text-[10px] opacity-90">1 Branch · ₹20k–₹1L</span>
        </button>

        <button
          type="button"
          onClick={() => applyConfig("elite", currentSlab || 500, isRenewal, false)}
          className={`py-2 px-1.5 rounded-lg text-xs font-black transition cursor-pointer text-center ${
            edition === "elite"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
          }`}
        >
          <p className="leading-tight">👑 Elite Yearly</p>
          <span className="text-[10px] opacity-90">3 Branches · ₹75k–₹2L</span>
        </button>

        <button
          type="button"
          onClick={() => applyConfig("ultra", 5000, isRenewal, agentAddOn, agentYear)}
          className={`py-2 px-1.5 rounded-lg text-xs font-black transition cursor-pointer text-center ${
            edition === "ultra"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
          }`}
        >
          <p className="leading-tight">💎 ULTRA 2000+</p>
          <span className="text-[10px] opacity-90">Unlim · ₹3L / Renew ₹2L</span>
        </button>
      </div>

      {/* Student Capacity Slabs */}
      {edition !== "ultra" && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            Student Capacity Slab (Yearly):
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {YEARLY_STUDENT_SLABS.filter((slab) => (edition === "lite" ? slab <= 2000 : true)).map((slab) => (
              <button
                key={slab}
                type="button"
                onClick={() => applyConfig(edition, slab, isRenewal)}
                className={`py-1.5 px-2 rounded-lg border text-[11px] font-black transition cursor-pointer tabular-nums ${
                  currentSlab === slab
                    ? edition === "elite"
                      ? "bg-amber-500 text-slate-950 border-amber-500"
                      : "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                }`}
              >
                {slab >= 5000 ? "5000+" : slab}
                <span className="block text-[9px] font-bold opacity-85">
                  {edition === "lite"
                    ? `₹${(LITE_YEARLY_PRICES[slab] || 20000).toLocaleString("en-IN")}`
                    : `₹${(isRenewal ? getElitePricingForSlab(slab).renewal : getElitePricingForSlab(slab).firstYear).toLocaleString("en-IN")}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Elite 1st Year Offer vs Renewal Fee Toggle */}
      {edition === "elite" && (
        <div className="grid grid-cols-2 gap-2 tabular-nums">
          <button
            type="button"
            onClick={() => applyConfig("elite", currentSlab, false)}
            className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
              !isRenewal
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                : "border-slate-200 dark:border-slate-600"
            }`}
          >
            <p className="text-[11px] font-black text-amber-800 dark:text-amber-300">✨ New 1st Year Offer</p>
            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
              <span className="line-through text-slate-400 mr-1.5 font-normal">
                ₹{eliteSlab.mrp.toLocaleString("en-IN")}
              </span>
              ₹{eliteSlab.firstYear.toLocaleString("en-IN")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => applyConfig("elite", currentSlab, true)}
            className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
              isRenewal
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-slate-200 dark:border-slate-600"
            }`}
          >
            <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">🔄 Yearly Renewal Fee</p>
            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
              ₹{eliteSlab.renewal.toLocaleString("en-IN")} / Year
            </p>
          </button>
        </div>
      )}

      {/* ULTRA ERP + Optional Dedicated Agent */}
      {edition === "ultra" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 tabular-nums">
            <button
              type="button"
              onClick={() => applyConfig("ultra", 5000, false, agentAddOn, 1)}
              className={`p-2.5 rounded-xl border-2 text-left cursor-pointer ${
                !isRenewal ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30" : "border-slate-200 dark:border-slate-600"
              }`}
            >
              <p className="text-[11px] font-black text-rose-700 dark:text-rose-300">💎 1st Year ULTRA</p>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹3,00,000 / Year</p>
            </button>
            <button
              type="button"
              onClick={() => applyConfig("ultra", 5000, true, agentAddOn, Math.max(2, agentYear))}
              className={`p-2.5 rounded-xl border-2 text-left cursor-pointer ${
                isRenewal ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-600"
              }`}
            >
              <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">🔄 ULTRA Renewal</p>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹2,00,000 / Year</p>
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 text-xs">
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={agentAddOn}
                onChange={(e) => applyConfig("ultra", 5000, isRenewal, e.target.checked, agentYear)}
                className="accent-rose-600"
              />
              <span>Dedicated Agent Add-On (Yr {agentYear}{agentYear >= 5 ? "+ Max Cap" : ""})</span>
            </label>
            {agentAddOn && (
              <select
                value={agentYear}
                onChange={(e) => applyConfig("ultra", 5000, Number(e.target.value) > 1, true, Number(e.target.value))}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
              >
                {ULTRA_AGENT_SCHEDULE.map((r) => (
                  <option key={r.year} value={r.year}>
                    {r.label}: +₹{r.agent.toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Summary + Custom Yearly Override */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center bg-slate-50 dark:bg-slate-700/40 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
        <div className="text-xs space-y-0.5">
          <p className="font-black text-slate-800 dark:text-white">
            {edition === "ultra"
              ? "💎 ULTRA (2,000+ · Unlimited Branches)"
              : edition === "elite"
              ? `👑 Elite (${currentSlab >= 5000 ? "5,000+" : currentSlab} Std · 3 Branches)`
              : `⚡ Lite (${currentSlab} Std · 1 Branch Max)`}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-300">
            {edition === "lite"
              ? "Default Website + QR Attendance (No Face ID / Tagada Caller)"
              : edition === "elite"
              ? "Fee Tagada Caller + Face ID + Custom CMS + 60 Templates"
              : "Own Domain + Brand Play Store APK + On-Site Training + Agent Option"}
          </p>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-1">
            Final Assigned Yearly Fee (₹ Editable)
          </label>
          <input
            type="number"
            min={0}
            value={displayedAmount}
            onChange={(e) => {
              const num = Math.max(0, Number(e.target.value) || 0);
              onChange({
                ...value,
                monthlyAmount: num,
                yearlyAmount: num,
              });
            }}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white tabular-nums"
          />
        </div>
      </div>
    </div>
  );
};

// ── YEARLY PLAN ASSIGNER COMPONENT ───────────────────────────────────────────
type PlanDur = "1_year" | "2_years" | "lifetime";

const DURATION_DAYS: Record<PlanDur, number> = {
  "1_year": 365,
  "2_years": 730,
  lifetime: 7300,
};
const DURATION_LABEL: Record<PlanDur, string> = {
  "1_year": "1 Year Session (365 Days)",
  "2_years": "2 Years (2 साल)",
  lifetime: "Lifetime (लाइफटाइम)",
};

const PlanAssigner: React.FC<{
  school: School;
  onAssigned: (updatedSub: SchoolSubscription) => void;
}> = ({ school, onAssigned }) => {
  const [edition, setEdition] = useState<SuperEdition>(() => resolveSuperEdition(school?.subscription));
  const [studentSlab, setStudentSlab] = useState<number>(() => {
    const ms = school?.subscription?.maxStudents;
    if (ms && YEARLY_STUDENT_SLABS.includes(ms as any)) return ms;
    return edition === "lite" ? 100 : edition === "ultra" ? 5000 : 500;
  });
  const [isRenewal, setIsRenewal] = useState<boolean>(() => Boolean(school?.subscription?.isRenewal));
  const [agentAddOn, setAgentAddOn] = useState<boolean>(() => Boolean(school?.subscription?.agentAddOn));
  const [agentYear, setAgentYear] = useState<number>(() => school?.subscription?.agentYear || 1);
  const [duration, setDur] = useState<PlanDur>("1_year");
  const [customFinalFee, setCustomFinalFee] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const eliteSlabPricing = getElitePricingForSlab(studentSlab);
  const ultraAgentRow = ULTRA_AGENT_SCHEDULE.find((r) => r.year === agentYear) || ULTRA_AGENT_SCHEDULE[0];

  const computedBaseYearly =
    edition === "ultra"
      ? (isRenewal ? ULTRA_YEARLY_PRICING.renewal : ULTRA_YEARLY_PRICING.firstYear) +
        (agentAddOn ? ultraAgentRow.agent : 0)
      : edition === "elite"
      ? isRenewal
        ? eliteSlabPricing.renewal
        : eliteSlabPricing.firstYear
      : getLitePriceForSlab(studentSlab > 2000 ? 2000 : studentSlab);

  const durationMultiplier = duration === "2_years" ? 2 : duration === "lifetime" ? 4 : 1;
  const recommendedTotal = computedBaseYearly * durationMultiplier;
  const price = customFinalFee !== "" ? Math.max(0, Number(customFinalFee) || 0) : recommendedTotal;

  const computeExpiry = (dur: PlanDur): string => {
    const d = new Date();
    if (dur === "lifetime") {
      d.setFullYear(d.getFullYear() + 25);
    } else {
      d.setDate(d.getDate() + (DURATION_DAYS[dur] || 365));
    }
    return d.toISOString().split("T")[0];
  };

  const handleAssign = async () => {
    setSaving(true);
    setSuccess(false);
    const expiresAt = computeExpiry(duration);
    const effectiveSlab = edition === "lite" ? Math.min(2000, studentSlab) : edition === "ultra" ? 5000 : studentSlab;
    const maxBranches = edition === "ultra" ? 9999 : edition === "elite" ? 3 : 1;
    const tier =
      edition === "ultra"
        ? "whitelabel_5000"
        : edition === "elite"
        ? "enterprise_2000"
        : effectiveSlab <= 300
        ? "starter_200"
        : effectiveSlab <= 500
        ? "growth_500"
        : "lite";
    const effectiveElite = edition !== "lite";

    const newSub: SchoolSubscription = {
      ...school.subscription,
      tier,
      maxStudents: effectiveSlab,
      maxTeachers: 9999,
      maxBranches,
      status: "active",
      isElite: effectiveElite,
      customCurriculumEnabled: effectiveElite,
      isRenewal: edition === "lite" ? false : isRenewal,
      agentAddOn: edition === "ultra" ? agentAddOn : false,
      agentYear: edition === "ultra" && agentAddOn ? agentYear : undefined,
      agentAnnualFee: edition === "ultra" && agentAddOn ? ultraAgentRow.agent : undefined,
      mrpAmount: edition === "elite" ? eliteSlabPricing.mrp : undefined,
      renewalAmount:
        edition === "elite"
          ? eliteSlabPricing.renewal
          : edition === "ultra"
          ? ULTRA_YEARLY_PRICING.renewal
          : undefined,
      expiresAt,
      paidUntil: expiresAt,
      reading: true,
      writing: true,
      pdf: true,
      mcq: true,
      monthlyAmount: price,
      yearlyAmount: price,
      planDuration: duration,
      assignedAt: new Date().toISOString(),
      lastPaidDate: new Date().toISOString(),
      lastPaidAmount: price,
      paymentNotes:
        edition === "ultra"
          ? `💎 ULTRA White-Label (2,000+ Std, Unlimited Branches, Own Domain + APK${agentAddOn ? ` + Dedicated Agent Yr ${agentYear}` : ""})`
          : edition === "elite"
          ? `👑 Elite Yearly ${isRenewal ? `Renewal (₹${eliteSlabPricing.renewal.toLocaleString("en-IN")})` : `1st Year (₹${eliteSlabPricing.firstYear.toLocaleString("en-IN")})`} (${effectiveSlab} Std, 3 Branches)`
          : `⚡ Lite Yearly Active (${effectiveSlab} Std, 1 Branch Max, Default Website + QR Scan)`,
    };
    await updateSchool(school.id, {
      subscription: newSub,
      isElite: effectiveElite,
      customCurriculumEnabled: effectiveElite,
      active: true,
    });
    onAssigned(newSub);
    setSaving(false);
    setSuccess(true);
    toast.success(`Yearly subscription ₹${price.toLocaleString("en-IN")} assign ho gaya!`);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-indigo-500" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Yearly Plan Assign Karo</h3>
        {school.subscription.expiresAt && (
          <span className="ml-auto text-[10px] text-slate-400">
            Expires: {new Date(school.subscription.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {/* 3 Plan Selector */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setEdition("lite");
            if (studentSlab > 2000) setStudentSlab(2000);
            setCustomFinalFee("");
          }}
          className={`py-2 px-1.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
            edition === "lite" ? "bg-blue-600 text-white shadow" : "text-slate-500 dark:text-slate-300"
          }`}
        >
          ⚡ Lite Yearly
          <span className="block text-[9px] opacity-85">1 Branch · ≤2k Std</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEdition("elite");
            if (!YEARLY_STUDENT_SLABS.includes(studentSlab as any)) setStudentSlab(500);
            setCustomFinalFee("");
          }}
          className={`py-2 px-1.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
            edition === "elite"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          👑 Elite (Hero)
          <span className="block text-[9px] opacity-85">3 Branches · ₹75k–₹2L</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEdition("ultra");
            setStudentSlab(5000);
            setCustomFinalFee("");
          }}
          className={`py-2 px-1.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
            edition === "ultra" ? "bg-rose-600 text-white shadow" : "text-slate-500 dark:text-slate-300"
          }`}
        >
          💎 ULTRA 2000+
          <span className="block text-[9px] opacity-85">Unlim · ₹3L / Renew ₹2L</span>
        </button>
      </div>

      {/* Student Slabs */}
      {edition !== "ultra" && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            Student Capacity Chunein ({edition === "lite" ? "Lite: ₹20k–₹1L up to 2,000 Std" : "Elite: Slab-based up to 5,000+ Std"}):
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 tabular-nums">
            {YEARLY_STUDENT_SLABS.filter((s) => (edition === "lite" ? s <= 2000 : true)).map((slab) => (
              <button
                key={slab}
                type="button"
                onClick={() => {
                  setStudentSlab(slab);
                  setCustomFinalFee("");
                }}
                className={`py-1.5 px-2 rounded-lg border text-xs font-black transition cursor-pointer ${
                  studentSlab === slab
                    ? edition === "elite"
                      ? "bg-amber-500 text-slate-950 border-amber-500"
                      : "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                }`}
              >
                {slab >= 5000 ? "5000+" : slab}
                <span className="block text-[9px] opacity-85">
                  {edition === "lite"
                    ? `₹${LITE_YEARLY_PRICES[slab].toLocaleString("en-IN")}`
                    : `₹${(isRenewal ? getElitePricingForSlab(slab).renewal : getElitePricingForSlab(slab).firstYear).toLocaleString("en-IN")}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Elite Offer vs Renewal Toggle */}
      {edition === "elite" && (
        <div className="grid grid-cols-2 gap-2 tabular-nums">
          <button
            type="button"
            onClick={() => {
              setIsRenewal(false);
              setCustomFinalFee("");
            }}
            className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
              !isRenewal
                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                : "border-slate-200 dark:border-slate-600"
            }`}
          >
            <p className="text-[11px] font-black text-amber-800 dark:text-amber-300">✨ 1st Year Offer</p>
            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
              <span className="line-through text-slate-400 mr-1.5 font-normal">
                ₹{eliteSlabPricing.mrp.toLocaleString("en-IN")}
              </span>
              ₹{eliteSlabPricing.firstYear.toLocaleString("en-IN")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRenewal(true);
              setCustomFinalFee("");
            }}
            className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
              isRenewal
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-slate-200 dark:border-slate-600"
            }`}
          >
            <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">🔄 Annual Renewal Fee</p>
            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
              ₹{eliteSlabPricing.renewal.toLocaleString("en-IN")} / Year
            </p>
          </button>
        </div>
      )}

      {/* ULTRA 1st Yr vs Renewal + Optional Agent */}
      {edition === "ultra" && (
        <div className="space-y-2 tabular-nums">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsRenewal(false);
                setAgentYear(1);
                setCustomFinalFee("");
              }}
              className={`p-2.5 rounded-xl border-2 text-left cursor-pointer ${
                !isRenewal ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30" : "border-slate-200 dark:border-slate-600"
              }`}
            >
              <p className="text-[11px] font-black text-rose-700 dark:text-rose-300">💎 1st Year ULTRA</p>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹3,00,000</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRenewal(true);
                if (agentYear < 2) setAgentYear(2);
                setCustomFinalFee("");
              }}
              className={`p-2.5 rounded-xl border-2 text-left cursor-pointer ${
                isRenewal ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-600"
              }`}
            >
              <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">🔄 Yearly Renewal</p>
              <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹2,00,000</p>
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 text-xs">
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={agentAddOn}
                onChange={(e) => {
                  setAgentAddOn(e.target.checked);
                  setCustomFinalFee("");
                }}
                className="accent-rose-600"
              />
              <span>Dedicated Agent Add-On</span>
            </label>
            {agentAddOn && (
              <select
                value={agentYear}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  setAgentYear(yr);
                  setIsRenewal(yr > 1);
                  setCustomFinalFee("");
                }}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
              >
                {ULTRA_AGENT_SCHEDULE.map((r) => (
                  <option key={r.year} value={r.year}>
                    {r.label}: +₹{r.agent.toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Yearly Duration Selector (No Monthly!) */}
      <div className="grid grid-cols-3 gap-2">
        {(["1_year", "2_years", "lifetime"] as PlanDur[]).map((d) => {
          const dMult = d === "2_years" ? 2 : d === "lifetime" ? 4 : 1;
          const p = computedBaseYearly * dMult;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDur(d);
                setCustomFinalFee("");
              }}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition cursor-pointer text-center ${
                duration === d
                  ? edition === "elite"
                    ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30"
                    : edition === "ultra"
                    ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30"
                    : "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "border-slate-200 dark:border-slate-600"
              }`}
            >
              <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">
                {DURATION_LABEL[d].split(" (")[0]}
              </span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                ₹{p.toLocaleString("en-IN")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Editable Final Fee + Summary */}
      <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-400">Yearly Plan Summary</p>
            <p className="text-sm font-black text-slate-800 dark:text-white">
              {edition === "ultra"
                ? `💎 ULTRA White-Label · Unlimited Branches${agentAddOn ? ` · +Agent Yr ${agentYear}` : ""}`
                : edition === "elite"
                ? `👑 Elite ${isRenewal ? "Renewal" : "1st Year"} · ${studentSlab >= 5000 ? "5000+" : studentSlab} Std · 3 Branches`
                : `⚡ Lite Yearly · ${studentSlab} Std · 1 Branch Max`}
            </p>
            <p className="text-[10px] text-slate-400">Valid till: {computeExpiry(duration)}</p>
          </div>
          <div className="text-right tabular-nums">
            <p className={`text-xl font-black ${edition === "elite" ? "text-amber-600 dark:text-amber-400" : edition === "ultra" ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"}`}>
              ₹{price.toLocaleString("en-IN")}
            </p>
            {edition === "elite" && !isRenewal && (
              <p className="text-[10px] text-slate-400 line-through">MRP ₹{eliteSlabPricing.mrp.toLocaleString("en-IN")}</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 block mb-1">
            Custom Final Yearly Amount Override (Optional ₹)
          </label>
          <input
            type="number"
            min={0}
            placeholder={String(recommendedTotal)}
            value={customFinalFee}
            onChange={(e) => setCustomFinalFee(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white tabular-nums"
          />
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2.5 text-green-700 dark:text-green-300 text-sm font-bold">
          <CheckCircle className="w-4 h-4" /> Yearly Plan assign ho gaya! ✅
        </div>
      )}

      <button
        onClick={handleAssign}
        disabled={saving}
        className={`w-full py-3.5 disabled:opacity-60 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-md ${
          edition === "elite"
            ? "bg-amber-600 hover:bg-amber-700"
            : edition === "ultra"
            ? "bg-rose-600 hover:bg-rose-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {saving ? (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Crown className="w-4 h-4" />
        )}
        {saving
          ? "Assigning Yearly Plan..."
          : `Assign ${edition === "ultra" ? "💎 ULTRA" : edition === "elite" ? "👑 Elite" : "⚡ Lite"} Yearly (₹${price.toLocaleString("en-IN")})`}
      </button>
    </div>
  );
};

// ── SUBSCRIPTION HELPERS ──────────────────────────────────────────────────────

// Get payment status for a school
function getPaymentStatus(school: School): "overdue" | "due_soon" | "paid" | "no_date" {
  const paidUntil = school.subscription.paidUntil;
  if (!paidUntil) return "no_date";
  const daysLeft = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "due_soon";
  return "paid";
}

function daysLeftLabel(paidUntil?: string): string {
  if (!paidUntil) return "Date not set";
  const days = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days <= 7) return `Due in ${days} days`;
  return `Valid till ${new Date(paidUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

// Extend paidUntil by N months from today or from paidUntil (whichever is later)
function extendPaidUntil(current?: string, months = 1): string {
  const base = current && new Date(current) > new Date() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().split("T")[0];
}

// ── SUBSCRIPTION MANAGEMENT PANEL ────────────────────────────────────────────
const SubscriptionHub: React.FC<{ schools: School[]; onRefresh: () => void }> = ({ schools }) => {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [editPaidUntil, setEditPaidUntil] = useState("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "overdue" | "due_soon" | "paid">("all");

  const now = new Date();
  const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });

  const overdueSchools  = schools.filter(s => s.active && getPaymentStatus(s) === "overdue");
  const dueSoonSchools  = schools.filter(s => s.active && getPaymentStatus(s) === "due_soon");
  const paidSchools     = schools.filter(s => s.active && getPaymentStatus(s) === "paid");
  const noDateSchools   = schools.filter(s => s.active && getPaymentStatus(s) === "no_date");
  const totalExpected   = schools.filter(s => s.active).reduce((sum, s) => sum + s.subscription.monthlyAmount, 0);
  const totalOverdue    = overdueSchools.reduce((sum, s) => sum + s.subscription.monthlyAmount, 0);

  const sortedSchools = [...schools].filter(s => s.active).sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, no_date: 2, paid: 3 };
    return order[getPaymentStatus(a)] - order[getPaymentStatus(b)];
  });

  const filtered = filter === "all" ? sortedSchools
    : sortedSchools.filter(s => getPaymentStatus(s) === filter);

  const openEdit = (school: School) => {
    setSelectedSchool(school);
    setEditPaidUntil(school.subscription.paidUntil || "");
    setNotes(school.subscription.paymentNotes || "");
    setCustomAmount(String(school.subscription.monthlyAmount));
    setMarkingPaid(null);
  };

  const handleMarkPaid = async (school: School, months = 1) => {
    setMarkingPaid(school.id);
    const newPaidUntil = extendPaidUntil(school.subscription.paidUntil, months);
    const amount = Number(customAmount) || school.subscription.monthlyAmount;
    await updateSchool(school.id, {
      subscription: {
        ...school.subscription,
        paidUntil: newPaidUntil,
        lastPaidDate: new Date().toISOString(),
        lastPaidAmount: amount,
        paymentNotes: notes || school.subscription.paymentNotes,
        status: "active",
        monthlyAmount: amount,
      },
      active: true,
    });
    setMarkingPaid(null);
    setSelectedSchool(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedSchool) return;
    setSaving(true);
    await updateSchool(selectedSchool.id, {
      subscription: {
        ...selectedSchool.subscription,
        paidUntil: editPaidUntil || undefined,
        paymentNotes: notes,
        monthlyAmount: Number(customAmount) || selectedSchool.subscription.monthlyAmount,
      },
    });
    setSaving(false);
    setSelectedSchool(null);
  };

  return (
    <div className="space-y-4">
      {/* Revenue Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm col-span-3 flex gap-4 items-center">
          <div className="flex-1">
            <p className="text-[11px] text-slate-400 font-medium">Monthly Expected</p>
            <p className="text-2xl font-black text-green-600">₹{totalExpected.toLocaleString()}</p>
          </div>
          <div className="flex-1 border-l pl-4 dark:border-slate-600">
            <p className="text-[11px] text-slate-400 font-medium">Overdue</p>
            <p className="text-2xl font-black text-red-500">₹{totalOverdue.toLocaleString()}</p>
            <p className="text-[10px] text-red-400">{overdueSchools.length} schools</p>
          </div>
          <div className="flex-1 border-l pl-4 dark:border-slate-600">
            <p className="text-[11px] text-slate-400 font-medium">Clear</p>
            <p className="text-2xl font-black text-blue-500">{paidSchools.length}</p>
            <p className="text-[10px] text-slate-400">schools paid</p>
          </div>
        </div>
      </div>

      {/* Alert strips */}
      {overdueSchools.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
            {overdueSchools.length} school{overdueSchools.length > 1 ? "s" : ""} overdue — ₹{totalOverdue.toLocaleString()} pending
          </p>
        </div>
      )}
      {dueSoonSchools.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">
            {dueSoonSchools.length} school{dueSoonSchools.length > 1 ? "s" : ""} due within 7 days
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {([
          ["all", "All", schools.filter(s => s.active).length],
          ["overdue", "⚠️ Overdue", overdueSchools.length],
          ["due_soon", "⏰ Due Soon", dueSoonSchools.length],
          ["paid", "✅ Clear", paidSchools.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filter === key
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border dark:border-slate-700"
            }`}
          >
            {label} <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Schools List */}
      {filtered.map(school => {
        const status = getPaymentStatus(school);
        const statusColors = {
          overdue:  { bg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900", badge: "bg-red-100 text-red-700", icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
          due_soon: { bg: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900", badge: "bg-amber-100 text-amber-700", icon: <Clock className="w-4 h-4 text-amber-500" /> },
          paid:     { bg: "bg-white dark:bg-slate-800 border-transparent", badge: "bg-green-100 text-green-700", icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
          no_date:  { bg: "bg-white dark:bg-slate-800 border-transparent", badge: "bg-slate-100 text-slate-500", icon: <Calendar className="w-4 h-4 text-slate-400" /> },
        }[status];

        const isExpanded = selectedSchool?.id === school.id;

        return (
          <div key={school.id} className={`rounded-xl border shadow-sm overflow-hidden ${statusColors.bg}`}>
            {/* School row */}
            <button
              onClick={() => isExpanded ? setSelectedSchool(null) : openEdit(school)}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
            >
              <div className="flex-shrink-0">{statusColors.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{school.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{daysLeftLabel(school.subscription.paidUntil)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-slate-700 dark:text-slate-200 text-sm">₹{school.subscription.monthlyAmount.toLocaleString()}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${statusColors.badge}`}>
                  {status === "overdue" ? "OVERDUE" : status === "due_soon" ? "DUE SOON" : status === "paid" ? "CLEAR" : "NO DATE"}
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>

            {/* Expanded payment panel */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t dark:border-slate-700 space-y-3 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">

                {/* Last payment info */}
                {school.subscription.lastPaidDate && (
                  <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                    Last paid: <span className="font-semibold text-slate-600 dark:text-slate-300">
                      ₹{school.subscription.lastPaidAmount?.toLocaleString() || school.subscription.monthlyAmount.toLocaleString()}
                    </span> on {new Date(school.subscription.lastPaidDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-semibold">Monthly Amount (₹)</label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold"
                  />
                </div>

                {/* Paid until */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-semibold">Paid Until Date</label>
                  <input
                    type="date"
                    value={editPaidUntil}
                    onChange={e => setEditPaidUntil(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                  />
                </div>

                {/* Payment notes */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-semibold">Payment Notes</label>
                  <input
                    type="text"
                    placeholder="UPI ID, receipt no., remarks..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkPaid(school, 1)}
                    disabled={markingPaid === school.id}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black disabled:opacity-60 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {markingPaid === school.id ? "Saving..." : "Mark Paid (+1 Month)"}
                  </button>
                  <button
                    onClick={() => handleMarkPaid(school, 3)}
                    disabled={markingPaid === school.id}
                    className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-transform"
                  >
                    +3M
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-3 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-transform"
                  >
                    {saving ? "..." : "Save"}
                  </button>
                </div>

                {/* Subscription plan badge */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {school.subscription.reading && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">📖 Reading</span>}
                  {school.subscription.writing && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-bold">✏️ Writing</span>}
                  {school.subscription.pdf     && <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold">📄 PDF</span>}
                  {school.subscription.mcq     && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">❓ MCQ</span>}
                  {school.subscription.tier === "lite" && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">📦 Lite</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No schools in this category</p>
        </div>
      )}
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const SuperAdminPanel: React.FC<Props> = ({ adminUid, onBack, onLogout }) => {
  const handlePerformLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      localStorage.removeItem("nst_current_user");
      localStorage.removeItem("nst_app_view_mode");
      window.location.reload();
    } catch {}
  };
  const [schools, setSchools]           = useState<School[]>([]);
  const [view, setView]                 = useState<"dashboard" | "new" | "manage">("dashboard");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [directManageSchool, setDirectManageSchool] = useState<School | null>(null);
  const [saving, setSaving]             = useState(false);
  const [dashTab, setDashTab]           = useState<"schools" | "subscriptions" | "accounts" | "policies" | "developer" | "crashes">("schools");

  useEffect(() => {
    setErrorLoggerModule(`Super Admin → ${dashTab}`);
  }, [dashTab]);
  const [showQaChecklist, setShowQaChecklist] = useState(false);
  const [qaCompletedCount, setQaCompletedCount] = useState<number>(() => getQaChecklistCompletedCount("global"));

  useEffect(() => {
    const syncQa = () => setQaCompletedCount(getQaChecklistCompletedCount("global"));
    window.addEventListener("nst-qa-checklist-updated", syncQa);
    return () => window.removeEventListener("nst-qa-checklist-updated", syncQa);
  }, []);

  // Global Website Developer Config (Managed strictly by Life Maker Super Admin across ALL schools)
  const [devForm, setDevForm] = useState<GlobalWebsiteDeveloperConfig>(() => ({ ...DEFAULT_GLOBAL_DEVELOPER }));
  const [savingDev, setSavingDev] = useState(false);
  const [uploadingDevPhoto, setUploadingDevPhoto] = useState(false);

  useEffect(() => {
    const unsub = subscribeToGlobalDeveloperConfig((cfg) => {
      setDevForm(cfg);
    });
    return unsub;
  }, []);

  const handleUploadGlobalDevPhoto = async (file?: File) => {
    if (!file) return;
    setUploadingDevPhoto(true);
    try {
      const res = await compressImageFileToDataUrl(file, {
        maxWidth: 600,
        maxHeight: 600,
        maxSizeBytes: 140 * 1024,
      });
      setDevForm((prev) => ({ ...prev, photoUrl: res.dataUrl }));
      toast.success(`Developer photo compressed (${res.sizeKB} KB)`);
    } catch {
      toast.error("फोटो प्रोसेस नहीं हो पाई। कृपया दूसरी इमेज चुनें।");
    } finally {
      setUploadingDevPhoto(false);
    }
  };

  const handleSaveGlobalDeveloper = async () => {
    if (!devForm.name.trim()) {
      toast.error("कृपया Developer का नाम लिखें।");
      return;
    }
    setSavingDev(true);
    try {
      const saved = await saveGlobalDeveloperConfig(
        {
          name: devForm.name.trim(),
          roleTitle: devForm.roleTitle.trim() || DEFAULT_GLOBAL_DEVELOPER.roleTitle,
          organization: devForm.organization.trim() || DEFAULT_GLOBAL_DEVELOPER.organization,
          photoUrl: (devForm.photoUrl || "").trim(),
        },
        adminUid || "Life Maker Super Admin"
      );
      setDevForm(saved);
      toast.success("Global Developer अपडेट हो गया! अब सभी स्कूलों की वेबसाइट पर यही दिखेगा।");
    } catch {
      toast.error("Global Developer सेव करने में समस्या आई।");
    } finally {
      setSavingDev(false);
    }
  };

  // Notification Gate Bypass Policy (Default: true — "defuot me bypass rahega", managed by Super Admin)
  const [notificationGateBypass, setNotificationGateBypass] = useState<boolean>(() => {
    try {
      const sysRaw = localStorage.getItem('nst_system_settings');
      if (sysRaw) {
        const parsed = JSON.parse(sysRaw);
        if (typeof parsed?.notificationGateBypass === 'boolean') {
          return parsed.notificationGateBypass;
        }
      }
      const direct = localStorage.getItem('nst_notification_gate_bypass');
      if (direct !== null) return direct === 'true';
    } catch (err) {
      console.warn('[SuperAdminPanel] Policy load warning:', err);
    }
    return true; // Default is bypass enabled
  });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyFeedback, setPolicyFeedback] = useState<string | null>(null);

  const handleToggleNotificationPolicy = async (newVal: boolean) => {
    setSavingPolicy(true);
    setNotificationGateBypass(newVal);
    try {
      // 1. Direct local storage key
      localStorage.setItem('nst_notification_gate_bypass', String(newVal));
      
      // 2. Sync inside system settings cache
      try {
        const raw = localStorage.getItem('nst_system_settings');
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.notificationGateBypass = newVal;
        localStorage.setItem('nst_system_settings', JSON.stringify(parsed));
      } catch (err) {
        console.warn('[SuperAdminPanel] Settings cache update warning:', err);
      }

      // 3. Sync to RTDB and Firestore
      try {
        if (rtdb) {
          await set(ref(rtdb, 'system_settings/notificationGateBypass'), newVal).catch(() => {});
        }
        if (db) {
          await setDoc(doc(db, 'config', 'system_settings'), { notificationGateBypass: newVal }, { merge: true }).catch(() => {});
        }
      } catch (e) {
        console.warn('Firebase policy sync error:', e);
      }

      // 4. Dispatch event so active app components update immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nst_system_settings_updated', {
          detail: { notificationGateBypass: newVal }
        }));
      }

      setPolicyFeedback(newVal
        ? '✅ बाईपास चालू: छात्र व अभिभावक अब नोटिफिकेशन अनुमति स्किप कर सकते हैं और बाद में ऑन कर सकते हैं।'
        : '🔒 अनिवार्य मोड: बिना नोटिफिकेशन अनुमति दिए कोई यूजर आगे नहीं बढ़ सकेगा।');
      setTimeout(() => setPolicyFeedback(null), 5000);
    } finally {
      setSavingPolicy(false);
    }
  };

  // Lock code state
  const [lockCodeInput, setLockCodeInput]       = useState('');
  const [lockCodeActive, setLockCodeActive]     = useState(false);
  const [showLockCode, setShowLockCode]         = useState(false);
  const [savingLockCode, setSavingLockCode]     = useState(false);

  // Assign school admin state
  const [assignEmail, setAssignEmail]           = useState('');
  const [assigningAdmin, setAssigningAdmin]     = useState(false);
  const [assignResult, setAssignResult]         = useState<{ ok: boolean; msg: string } | null>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm]       = useState(false);
  const [deleting, setDeleting]                 = useState(false);

  const [form, setForm] = useState({
    name: "", code: "", email: "", adminEmail: "", phone: "", address: ""
  });
  const [sub, setSub] = useState<SchoolSubscription>({ ...defaultSub });

  useEffect(() => {
    const unsub = subscribeToAllSchools(setSchools);
    return unsub;
  }, []);

  const activeSchools   = schools.filter(s => s.active && s.subscription?.status === "active");
  const inactiveSchools = schools.filter(s => !s.active || s.subscription?.status !== "active");
  const monthlyRevenue  = activeSchools.reduce((sum, s) => sum + (s.subscription ? calcAmount(s.subscription) : 0), 0);
  const comboSchools    = activeSchools.filter(s => s.subscription && isCombo(s.subscription));
  const comboRevenue    = comboSchools.reduce((sum, s) => sum + (s.subscription ? calcAmount(s.subscription) : 0), 0);

  const [createError, setCreateError] = useState<string | null>(null);

  useBackHandler(deleteConfirm, () => setDeleteConfirm(false), 22);
  useBackHandler(showLockCode, () => setShowLockCode(false), 20);
  useBackHandler(Boolean(directManageSchool), () => setDirectManageSchool(null), -5);
  useBackHandler(view !== "dashboard", () => {
    setView("dashboard");
    setSelectedSchool(null);
  }, 0);
  useBackHandler(dashTab !== "schools" && view === "dashboard" && !directManageSchool, () => {
    setDashTab("schools");
  }, 0);

  const createSchool = async () => {
    const cleanName = (form.name || "").trim();
    if (!cleanName) {
      setCreateError("Kripya School ka Naam (School Name) enter karein.");
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const id = generateId();
      const schoolCode = form.code.trim() ? form.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_") : "";
      const emailSlug = (schoolCode || cleanName.slice(0, 6)).toLowerCase().replace(/[^a-z0-9]/g, "") || "school";
      const cleanEmail = form.email.trim() || `${emailSlug}@school.internal`;
      const cleanAdminEmail = (form.adminEmail.trim() || cleanEmail).toLowerCase();

      // Enforce 1 Email = 1 School Rule for Super Admin allotment
      if (form.adminEmail.trim()) {
        const check = await checkEmailSchoolAllotment(cleanAdminEmail);
        if (check.isAllotted) {
          setCreateError(`❌ Yeh Email (${cleanAdminEmail}) pehle se "${check.schoolName}" school ko allot hai! Ek email/ID par sirf 1 hi school allot ho sakta hai.`);
          setSaving(false);
          return;
        }
      }

      const school: School = {
        id,
        name: cleanName,
        code: schoolCode,
        email: cleanEmail,
        adminEmail: cleanAdminEmail,
        phone: form.phone.trim(),
        address: form.address.trim(),
        subscription: { ...sub, monthlyAmount: calcAmount(sub) },
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: adminUid,
        totalStudents: 0,
        totalTeachers: 0,
      };

      // 1. Instantly update UI (0ms) so user is never blocked
      setSchools(prev => [school, ...prev.filter(s => s.id !== school.id)]);
      setForm({ name: "", code: "", email: "", adminEmail: "", phone: "", address: "" });
      setSub({ ...defaultSub });
      setView("dashboard");

      // 2. Save school in DB
      await saveSchool(school);

      // 3. Automatically grant Admin power to cleanAdminEmail!
      if (cleanAdminEmail) {
        assignSchoolAdminByEmail(school.id, cleanAdminEmail).catch(e => {
          console.warn("[SuperAdminPanel] auto assign school admin notice:", e);
        });
      }
    } catch (e: any) {
      setCreateError(e?.message || "School create karne mein error aaya. Dobara try karo.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSchoolStatus = async (school: School) => {
    await updateSchool(school.id, {
      active: !school.active,
      subscription: { ...school.subscription, status: school.active ? "suspended" : "active" },
    });
  };

  const openManage = (school: School) => {
    setSelectedSchool(school);
    setLockCodeInput(school.lockCode || '');
    setLockCodeActive(school.lockCodeActive ?? false);
    setShowLockCode(false);
    setView("manage");
  };

  const saveLockCode = async () => {
    if (!selectedSchool) return;
    setSavingLockCode(true);
    await setSchoolLockCode(selectedSchool.id, lockCodeInput.trim(), lockCodeActive);
    setSelectedSchool({ ...selectedSchool, lockCode: lockCodeInput.trim(), lockCodeActive });
    setSavingLockCode(false);
  };

  const handleAssignAdmin = async () => {
    if (!selectedSchool || !assignEmail.trim()) return;
    const cleanEmail = assignEmail.trim().toLowerCase();
    setAssigningAdmin(true);
    setAssignResult(null);

    // Strict 1 Email / ID = 1 School Rule Check
    const check = await checkEmailSchoolAllotment(cleanEmail, selectedSchool.id);
    if (check.isAllotted) {
      setAssignResult({
        ok: false,
        msg: `❌ Yeh Email (${cleanEmail}) pehle se "${check.schoolName}" school ko allot hai! Ek email/ID par sirf 1 hi school allot ho sakta hai.`
      });
      setAssigningAdmin(false);
      return;
    }

    try {
      const profile = await assignSchoolAdminByEmail(selectedSchool.id, cleanEmail);
      setAssignResult({ ok: true, msg: `✅ ${profile.name} (${profile.email}) ab is school ka admin hai!` });
      setSelectedSchool(prev => prev ? ({ ...prev, adminEmail: cleanEmail }) : null);
      setSchools(prev => prev.map(s => s.id === selectedSchool.id ? { ...s, adminEmail: cleanEmail } : s));
      setAssignEmail('');
    } catch (e: any) {
      setAssignResult({ ok: false, msg: `❌ ${e.message || 'Error aaya, dobara try karo.'}` });
    }
    setAssigningAdmin(false);
  };

  const updateSubscription = async (school: School, newSub: SchoolSubscription) => {
    const isElite = Boolean(newSub.isElite || newSub.customCurriculumEnabled);
    const updated = {
      ...newSub,
      isElite,
      customCurriculumEnabled: isElite,
      monthlyAmount: calcAmount(newSub)
    };
    await updateSchool(school.id, {
      subscription: updated,
      isElite,
      customCurriculumEnabled: isElite,
    });
    setSelectedSchool({
      ...school,
      subscription: updated,
      isElite,
      customCurriculumEnabled: isElite,
    });
  };

  const handleToggleLock = async () => {
    if (!selectedSchool) return;
    const newLocked = !selectedSchool.locked;
    await lockSchool(selectedSchool.id, newLocked);
    setSelectedSchool({ ...selectedSchool, locked: newLocked });
  };

  const handleDelete = async () => {
    if (!selectedSchool) return;
    const targetId = selectedSchool.id;
    setDeleting(true);
    await deleteSchool(targetId);
    setSchools(prev => prev.filter(s => s.id !== targetId));
    setDeleting(false);
    setDeleteConfirm(false);
    setView("dashboard");
    setSelectedSchool(null);
  };

  // ── DIRECT SCHOOL ADMIN ACCESS ──
  if (directManageSchool) {
    return (
      <SchoolAdminPanel
        schoolId={directManageSchool.id}
        adminUid={adminUid}
        isSuperAdmin={true}
        onBack={() => setDirectManageSchool(null)}
        onLeaveSchool={() => setDirectManageSchool(null)}
      />
    );
  }

  // ── NEW SCHOOL FORM ──────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView("dashboard")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white">Add New School</h2>
          <button
            onClick={createSchool}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {createError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300 font-medium">
              ❌ {createError}
            </div>
          )}
          {/* School Details */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">School Details</h3>
            {([
              ["name",       "School Name *",                   "text"],
              ["code",       "Registration / School Code (Optional)", "text"],
              ["email",      "School Email (optional)",          "email"],
              ["adminEmail", "Admin Email (optional)",           "email"],
              ["phone",      "Phone Number",                     "tel"],
              ["address",    "Address",                          "text"],
            ] as const).map(([k, lbl, t]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 mb-1 block">{lbl}</label>
                <input
                  type={t}
                  value={(form as any)[k]}
                  onChange={e => setForm(prev => ({ ...prev, [k]: e.target.value }))}
                  className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
                />
              </div>
            ))}
          </div>

          <SubEditor
            value={sub}
            onChange={s => setSub({ ...s, monthlyAmount: calcAmount(s) })}
          />

          <button
            onClick={createSchool}
            disabled={saving || !form.name.trim()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl text-base font-bold shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all"
          >
            {saving ? "School Create Ho Raha Hai..." : "🏫 Create & Save School Now"}
          </button>
        </div>
      </div>
    );
  }

  // ── MANAGE SCHOOL ────────────────────────────────────────────────────────
  if (view === "manage" && selectedSchool) {
    const s = selectedSchool;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 flex items-center gap-2">
          <button onClick={() => { setView("dashboard"); setDeleteConfirm(false); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white truncate">{s.name}</h2>
          {s.locked && (
            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
          <button
            onClick={() => toggleSchoolStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${s.active ? "bg-red-100 text-red-700 dark:bg-red-900/40" : "bg-green-100 text-green-700 dark:bg-green-900/40"}`}
          >
            {s.active ? <><Pause className="w-3.5 h-3.5" /> Suspend</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
          </button>
        </div>
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* School Info */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">School Info</h3>
            <div className="space-y-2 text-sm">
              {[["Email", s.email], ["Admin Email", s.adminEmail], ["Code", s.code]].map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between">
                  <span className="text-slate-400">{lbl}</span>
                  <span className="text-slate-700 dark:text-slate-200 font-mono text-xs">{val}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className={`font-medium ${s.active ? "text-green-500" : "text-red-400"}`}>{s.subscription.status}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700/60">
                <span className="text-slate-400">Edition</span>
                {isSchoolEliteCurriculum(s) ? (
                  <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                    <Crown size={12} className="text-amber-500" /> 👑 Elite Plan (Class 1-12 Notes Active)
                  </span>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs">
                    Standard Plan (Core ERP)
                  </span>
                )}
              </div>
            </div>
          </div>

          <PlanAssigner
            school={s}
            onAssigned={newSub => setSelectedSchool({ ...s, subscription: newSub })}
          />

          <SubEditor
            value={s.subscription}
            onChange={newSub => updateSubscription(s, newSub)}
            label="Advanced: Manual Override"
          />

          {/* ── ASSIGN SCHOOL ADMIN ──────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">School Admin Assign Karo</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/60 px-3 py-1.5 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Strict Rule: 1 Email / ID = Sirf 1 School Allot Hoga</span>
            </div>
            <p className="text-xs text-slate-400">
              Jis IIC user ko is school ka admin banana hai, uska email enter karo. Ek email par sirf 1 hi school allot ho sakta hai.
            </p>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Admin ka Email</label>
              <input
                type="email"
                placeholder="schooladmin@example.com"
                value={assignEmail}
                onChange={e => { setAssignEmail(e.target.value); setAssignResult(null); }}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
              />
            </div>
            {assignResult && (
              <div className={`text-xs px-3 py-2 rounded-lg font-medium ${assignResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {assignResult.msg}
              </div>
            )}
            <button
              onClick={handleAssignAdmin}
              disabled={assigningAdmin || !assignEmail.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {assigningAdmin ? 'Searching...' : '👤 School Admin Banao'}
            </button>
          </div>

          {/* Lock Code Management */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Lock Code</h3>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${lockCodeActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {lockCodeActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Jab active hoga, students ko join karne ke liye yeh code enter karna padega.</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lockCodeActive}
                onChange={e => setLockCodeActive(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Lock Code Enable Karo</span>
            </label>

            <div className="relative">
              <label className="text-xs text-slate-500 mb-1 block">Lock Code</label>
              <input
                type={showLockCode ? "text" : "password"}
                placeholder="School ka secret code"
                value={lockCodeInput}
                onChange={e => setLockCodeInput(e.target.value)}
                className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowLockCode(!showLockCode)}
                className="absolute right-3 top-7 text-slate-400 hover:text-slate-600"
              >
                {showLockCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={saveLockCode}
              disabled={savingLockCode}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold disabled:opacity-60"
            >
              {savingLockCode ? 'Saving...' : 'Lock Code Save Karo'}
            </button>
          </div>

          {/* ── DANGER ZONE ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3 border border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-red-700 dark:text-red-400">Danger Zone</h3>
            </div>

            {/* Lock / Unlock school */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {s.locked ? '🔒 School Locked' : '🔓 School Unlocked'}
                </p>
                <p className="text-xs text-slate-400">
                  {s.locked
                    ? 'Students is school mein login nahi kar sakte.'
                    : 'Students is school mein freely login kar sakte hain.'}
                </p>
              </div>
              <button
                onClick={handleToggleLock}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${s.locked
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300'}`}
              >
                {s.locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
              </button>
            </div>

            {/* Delete school */}
            <div className="pt-2 border-t dark:border-slate-700">
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> School Delete Karo
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium text-center">
                    ⚠️ Yeh action permanent hai! School ka saara data delete ho jayega.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-60"
                    >
                      {deleting ? 'Deleting...' : 'Haan, Delete Karo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 dark:from-slate-900 dark:to-blue-900 px-4 py-5 border-b-2 border-indigo-700 dark:border-indigo-500/40">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black mb-3 shadow-lg shadow-amber-400/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer ring-1 ring-amber-600/40 dark:ring-amber-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← NSTA Master Admin Console Par Wapas Jayein</span>
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-indigo-700 dark:text-blue-300 text-xs font-black uppercase tracking-wider mb-1">Super Admin</p>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">IIC×NSTA Control Panel</h1>
            <p className="text-slate-700 dark:text-slate-400 text-sm font-medium mt-1">Manage all schools in the ecosystem</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowQaChecklist(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer tabular-nums whitespace-nowrap"
              title="Phase 3 Quality Testing Checklist (15-Point Verification)"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>QA Checklist ({qaCompletedCount}/15)</span>
            </button>
            <LanguageToggleButton tone="auto" compact />
            <ScreenInfoGuideButton portal="super_admin" screenKey={dashTab || "super_admin"} tone="auto" />
            <button
              type="button"
              onClick={handlePerformLogout}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/25 active:scale-95 transition-all cursor-pointer"
              title="Account Log Out karein"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {/* Revenue cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm col-span-2 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <IndianRupee className="w-4 h-4 text-green-500" />
                <span className="text-xs text-slate-500">Yearly Revenue</span>
              </div>
              <p className="text-3xl font-bold text-green-600">₹{monthlyRevenue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{activeSchools.length} active schools</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-600 font-medium">Elite / ULTRA schools</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{comboSchools.length}</p>
              <p className="text-xs text-slate-400">₹{comboRevenue.toLocaleString("en-IN")}/yr</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Total Schools</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{schools.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-500">{activeSchools.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Inactive/Suspended</p>
            <p className="text-2xl font-bold text-red-400">{inactiveSchools.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Total Students</p>
            <p className="text-2xl font-bold text-blue-500">{schools.reduce((s, sc) => s + (sc.totalStudents || 0), 0)}</p>
          </div>
        </div>

        {/* Elite Yearly offer info strip */}
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <Tag className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-sm tabular-nums">
            <span className="font-bold text-amber-700 dark:text-amber-300">Elite Yearly (500 Std Flagship): </span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              ₹{ELITE_YEARLY_PRICING.firstYear.toLocaleString("en-IN")}/yr
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
              (MRP ₹{ELITE_YEARLY_PRICING.mrp.toLocaleString("en-IN")} · Renewal ₹{ELITE_YEARLY_PRICING.renewal.toLocaleString("en-IN")}/yr · ULTRA 2000+ ₹3,00,000/yr)
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 sm:flex gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          <button
            onClick={() => setDashTab("schools")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              dashTab === "schools" ? "bg-blue-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <SchoolIcon className="w-4 h-4" /> Schools
          </button>
          <button
            onClick={() => setDashTab("subscriptions")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${
              dashTab === "subscriptions" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Subscriptions
            {schools.filter(s => s.active && (getPaymentStatus(s) === "overdue" || getPaymentStatus(s) === "due_soon")).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {schools.filter(s => s.active && (getPaymentStatus(s) === "overdue" || getPaymentStatus(s) === "due_soon")).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setDashTab("accounts")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              dashTab === "accounts" ? "bg-emerald-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <Users className="w-4 h-4" /> Accounts
          </button>
          <button
            onClick={() => setDashTab("policies")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${
              dashTab === "policies" ? "bg-amber-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <Bell className="w-4 h-4" /> नोटिफिकेशन नीति
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${notificationGateBypass ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {notificationGateBypass ? "Bypass ON" : "Lock"}
            </span>
          </button>
          <button
            onClick={() => setDashTab("developer")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              dashTab === "developer" ? "bg-slate-900 dark:bg-emerald-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            <Code2 className="w-4 h-4" /> Developer
          </button>
          <button
            onClick={() => setDashTab("crashes")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              dashTab === "crashes" ? "bg-rose-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-rose-600"
            }`}
          >
            <Bug className="w-4 h-4" /> Crash Logs
          </button>
        </div>

        {/* Crash Logs Tab */}
        {dashTab === "crashes" && (
          <ErrorNoticeBoard onBack={() => setDashTab("schools")} />
        )}

        {/* All Accounts Directory Tab */}
        {dashTab === "accounts" && (
          <AdminAccountsDirectory
            isSuperAdminMode={true}
            schools={schools}
            theme="current"
          />
        )}

        {/* Policies & Notification Bypass Tab */}
        {dashTab === "policies" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Feedback notification toast if saved */}
            {policyFeedback && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{policyFeedback}</span>
              </div>
            )}

            {/* Notification Gate Bypass Policy Management Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start gap-3.5 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Bell className="w-6 h-6 animate-[wiggle_1s_ease-in-out_infinite]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-800 dark:text-white">
                      नोटिफिकेशन परमिशन गेट बाईपास नियंत्रण (Bypass Control)
                    </h3>
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                      notificationGateBypass
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700"
                        : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700"
                    }`}>
                      {notificationGateBypass ? "🟢 बाईपास चालू (Bypass Active - Default)" : "🔒 अनिवार्य लॉक (Mandatory Mode)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    यह तय करें कि छात्र या अभिभावक जब ऐप खोलें तो क्या वे नोटिफिकेशन अनुमति को <strong>स्किप (Skip)</strong> करके बाद में चालू कर सकते हैं, या इसे चालू करना 100% अनिवार्य रहेगा।
                  </p>
                </div>
              </div>

              {/* Mode Selection Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                {/* Option 1: Bypass Mode (Default) */}
                <div
                  onClick={() => !savingPolicy && handleToggleNotificationPolicy(true)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    notificationGateBypass
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 shadow-md"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                      <span>🟢 बाईपास चालू (अनुशंसित / डिफ़ॉल्ट)</span>
                    </span>
                    <input
                      type="radio"
                      name="notifBypassRadio"
                      checked={notificationGateBypass}
                      onChange={() => handleToggleNotificationPolicy(true)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong>डिफ़ॉल्ट मोड:</strong> यूज़र को नोटिफिकेशन का प्रॉम्प्ट दिखेगा, लेकिन वे &quot;बाद में चालू करेंगे / अभी छोड़ें&quot; दबाकर सीधे ऐप उपयोग कर सकेंगे। वे बाद में सेटिंग्स या ऊपर घंटी आइकॉन से कभी भी नोटिफिकेशन चालू कर सकेंगे।
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> यूज़र फ्रेंडली • कोई रुकावट नहीं
                  </div>
                </div>

                {/* Option 2: Mandatory Lock Mode */}
                <div
                  onClick={() => !savingPolicy && handleToggleNotificationPolicy(false)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    !notificationGateBypass
                      ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/20 shadow-md"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                      <span>🔒 अनिवार्य लॉक (Strict Mandatory)</span>
                    </span>
                    <input
                      type="radio"
                      name="notifBypassRadio"
                      checked={!notificationGateBypass}
                      onChange={() => handleToggleNotificationPolicy(false)}
                      className="w-4 h-4 accent-rose-600"
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong>कठोर मोड:</strong> स्किप करने का विकल्प छिपा दिया जाएगा। जब तक छात्र/अभिभावक फोन में नोटिफिकेशन अनुमति &quot;Allow&quot; नहीं करेंगे, तब तक वे ऐप के किसी भी पेज को नहीं खोल सकेंगे।
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    <Lock className="w-3.5 h-3.5" /> 100% सूचना डिलीवरी अनिवार्य
                  </div>
                </div>
              </div>

              {/* Action Buttons for Super Admin */}
              <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleToggleNotificationPolicy(!notificationGateBypass)}
                  disabled={savingPolicy}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                    notificationGateBypass
                      ? "bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-500"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{notificationGateBypass ? "अनिवार्य मोड में बदलें (Set Mandatory)" : "डिफ़ॉल्ट बाईपास चालू करें (Enable Bypass)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-popup-settings-guide'));
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>👁️ परमिशन गेट का लाइव टेस्ट/प्रीव्यू देखें</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('nst_notif_gate_skipped');
                    sessionStorage.removeItem('nst_notif_gate_skipped');
                    toast.success("स्किप स्थिति रीसेट कर दी गई है! नए यूज़र की तरह परमिशन गेट देखने के लिए पेज रीफ्रेश करें।");
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                >
                  <span>🔄 टेस्ट हेतु स्किप रीसेट करें</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Website Developer Tab (Exclusive to Life Maker Super Admin) */}
        {dashTab === "developer" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-5">
              <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100 dark:border-slate-700/60">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                  <Code2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-800 dark:text-white">
                      Global Website Developer (Life Maker Only)
                    </h3>
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      Applies to All Schools ({schools.length})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    डिफ़ॉल्ट रूप से हर स्कूल की वेबसाइट पर यही <strong>Developer Name व Photo</strong> दिखेगा। कोई भी स्कूल एडमिन इसे नहीं बदल सकता — केवल <strong>Life Maker (Super Admin)</strong> यहाँ से बदल सकते हैं और यह सभी स्कूलों में एक साथ अपडेट हो जाएगा।
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start text-xs">
                {/* Photo Upload Column */}
                <div className="md:col-span-4 flex flex-col items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    {devForm.photoUrl ? (
                      <img src={devForm.photoUrl} alt={devForm.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-indigo-600 dark:text-amber-400">
                        {(devForm.name || "DV").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <label className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                    {uploadingDevPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>{uploadingDevPhoto ? "Processing..." : "Upload Developer Pic"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadGlobalDevPhoto(e.target.files?.[0])}
                    />
                  </label>
                  {devForm.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setDevForm((prev) => ({ ...prev, photoUrl: "" }))}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {/* Form Fields Column */}
                <div className="md:col-span-8 space-y-3">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Developer Name *
                    </label>
                    <input
                      type="text"
                      value={devForm.name}
                      onChange={(e) => setDevForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Nadim Anwar"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Role / Designation
                      </label>
                      <input
                        type="text"
                        value={devForm.roleTitle}
                        onChange={(e) => setDevForm((prev) => ({ ...prev, roleTitle: e.target.value }))}
                        placeholder="Platform Developer & Architect"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Organization / Brand
                      </label>
                      <input
                        type="text"
                        value={devForm.organization}
                        onChange={(e) => setDevForm((prev) => ({ ...prev, organization: e.target.value }))}
                        placeholder="Life Maker"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      Developer Photo URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={devForm.photoUrl}
                      onChange={(e) => setDevForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      Live across every school website automatically
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveGlobalDeveloper}
                      disabled={savingDev}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black inline-flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      {savingDev ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>{savingDev ? "Updating All Schools..." : "Save Global Developer"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {dashTab === "subscriptions" && (
          <SubscriptionHub schools={schools} onRefresh={() => {}} />
        )}

        {/* Schools Tab */}
        {dashTab === "schools" && <>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white">All Schools</h3>
          <button onClick={() => setView("new")}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add School
          </button>
        </div>

        {schools.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <SchoolIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No schools yet. Add your first school.</p>
          </div>
        )}

        {schools.map(school => {
          const combo = isCombo(school.subscription);
          return (
            <div key={school.id} className={`rounded-xl p-4 shadow-sm border ${combo ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" : "bg-white dark:bg-slate-800 border-transparent"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${combo ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                  {combo ? <Zap className="w-5 h-5 text-amber-500" /> : <SchoolIcon className="w-5 h-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 dark:text-white truncate">{school.name}</p>
                    {combo && (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> COMBO
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${school.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {school.active ? "Active" : "Suspended"}
                    </span>
                    {school.locked && (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{school.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {school.subscription.reading && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Reading</span>}
                    {school.subscription.writing && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Writing</span>}
                    {school.subscription.pdf     && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">PDF</span>}
                    {school.subscription.mcq     && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">MCQ</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${combo ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      ₹{(school.subscription.yearlyAmount || school.subscription.monthlyAmount || 0).toLocaleString("en-IN")}/yr
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setDirectManageSchool(school)}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                    title="School Admin Panel Kholein"
                  >
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>Manage</span>
                  </button>
                  <button onClick={() => openManage(school)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Settings className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </>}
      </div>

      <QualityTestingChecklistModal
        isOpen={showQaChecklist}
        onClose={() => {
          setShowQaChecklist(false);
          setQaCompletedCount(getQaChecklistCompletedCount("global"));
        }}
        schoolId="global"
        schoolName="SCHOOL+ Platform QA"
      />
    </div>
  );
};

export default SuperAdminPanel;
