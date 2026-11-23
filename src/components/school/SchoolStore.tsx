// @ts-nocheck
import React, { useState } from "react";
import {
  ArrowLeft, CheckCircle2, MessageCircle, Users, Crown, Lock, Shield,
  Sparkles, Camera, QrCode, Building2, Star, Check, Layers
} from "lucide-react";
import {
  ELITE_YEARLY_PRICING,
  LITE_YEARLY_PRICES,
  SUPREME_YEARLY_PRICING,
  YEARLY_STUDENT_SLABS,
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

export const SchoolStore: React.FC<Props> = ({ school, onBack }) => {
  const [selectedSlab, setSelectedSlab] = useState<number>(100);
  const [eliteBillingMode, setEliteBillingMode] = useState<"new" | "renewal">("new");

  const currentTier = school.subscription?.tier;
  const isEliteActive = Boolean(school.isElite || school.subscription?.isElite || currentTier === "whitelabel_5000");
  const isSupremeActive = currentTier === "whitelabel_5000";
  const isActive = school.subscription?.status === "active";
  const expiresAt = school.subscription?.expiresAt;
  const currentMaxStudents = getSchoolMaxStudents(school);
  const currentMaxBranches = getSchoolMaxBranches(school);

  const liteUnavailableForSlab = selectedSlab > 2000;
  const litePrice = liteUnavailableForSlab
    ? LITE_YEARLY_PRICES[2000]
    : getLitePriceForSlab(selectedSlab);
  const elitePrice =
    eliteBillingMode === "renewal" ? ELITE_YEARLY_PRICING.renewal : ELITE_YEARLY_PRICING.firstYear;
  const supremePrice = SUPREME_YEARLY_PRICING.price;

  const sendWhatsApp = (edition: "lite" | "elite" | "supreme") => {
    const planText =
      edition === "supreme"
        ? `💎 Supreme White-Label Yearly (5,000+ Students · Unlimited Branches) — ₹${supremePrice.toLocaleString("en-IN")}/Year Fixed`
        : edition === "elite"
        ? `👑 Elite Yearly (${eliteBillingMode === "renewal" ? "Renewal ₹80,000/yr" : "1st Year Offer ₹1,00,000 मात्र (MRP ₹1,20,000)"} · Up to 5,000 Students · 3 Branches)`
        : `⚡ Lite Yearly (${selectedSlab} Students · 1 Branch Max) — ₹${litePrice.toLocaleString("en-IN")}/Year`;

    const msg = encodeURIComponent(
      `Namaste! 🙏\n\nMain *${school.name}* ka School Admin hoon.\n\nMujhe *${planText}* yearly subscription chahiye.\n\n📋 School Details:\n• School: ${school.name}\n• School Code: ${school.code}\n• Admin Email: ${school.adminEmail}\n\nKripya yearly plan activate karein. Dhanyawad!`
    );
    safeOpenExternalUrl(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${msg}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-14">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-5 shadow-md border-b border-indigo-800/60 text-white">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-indigo-200 hover:text-white text-sm font-black mb-3 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <p className="text-amber-300 text-xs font-black uppercase tracking-wider mb-1">
            Official Yearly ERP Store · No Monthly Billing Hassle
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            School Yearly Subscription Plans
          </h1>
          <p className="text-indigo-200 text-xs sm:text-sm font-medium mt-1">
            Yearly-Only Transparent Plans · Apne School ki Student Strength aur Branch Quota ke hisab se best plan chunein
          </p>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto space-y-5">
        {/* Active Status Banner */}
        {isActive ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                  {isSupremeActive
                    ? "💎 Supreme White-Label Active"
                    : isEliteActive
                    ? "👑 Elite Yearly Plan Active"
                    : "⚡ Lite Yearly Plan Active"}
                  {" "}({currentMaxStudents >= 5000 ? "5,000+" : currentMaxStudents} Students · {currentMaxBranches >= 9999 ? "Unlimited Branches" : `${currentMaxBranches} Branch${currentMaxBranches > 1 ? "es" : ""}`})
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                  {expiresAt
                    ? `Valid till: ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                    : "Yearly Subscription Active"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <Lock className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">Subscription Inactive</p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Neeche se apna Yearly plan select karke WhatsApp par activate karwayen.
              </p>
            </div>
          </div>
        )}

        {/* Interactive Student Capacity Slab Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Step 1: Student Capacity Slab Chunein (Yearly Rate Calculator)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lite plan ₹5,000/year se shuru hota hai aur har slab par +50% badhta hai (max 2,000 students, 1 branch). Elite mein up to 5,000 students &amp; 3 branches milte hain!
              </p>
            </div>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
              Yearly Plans Only
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {YEARLY_STUDENT_SLABS.map((slab) => {
              const active = selectedSlab === slab;
              const isOverLite = slab > 2000;
              return (
                <button
                  key={slab}
                  type="button"
                  onClick={() => setSelectedSlab(slab)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    active
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-sm scale-[1.02]"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {slab >= 5000 ? "5,000+" : slab}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Students</p>
                  <p className={`text-[10px] font-black mt-1 ${isOverLite ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
                    {isOverLite ? "Elite / Supreme" : `Lite ₹${LITE_YEARLY_PRICES[slab].toLocaleString("en-IN")}`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Tier Decoy Pricing Grid: Lite (Anchor) | Elite (HERO) | Supreme (Anchor) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* 1. LITE YEARLY PLAN */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-black">
                  ⚡ LITE YEARLY
                </span>
                <span className="text-[11px] font-black text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> 1 Branch Max
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Basic School ERP ({liteUnavailableForSlab ? "Max 2,000" : selectedSlab} Std)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Chhote single-branch schools ke liye basic management aur default website.
                </p>
              </div>

              <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-xl p-3.5 border border-blue-100 dark:border-blue-900">
                {liteUnavailableForSlab ? (
                  <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                    5,000 Students ke liye Lite uplabdh nahi hai (Max 2,000 Students). 👑 Elite ya 💎 Supreme chunein!
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        ₹{litePrice.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-bold text-slate-500">/ Year</span>
                    </div>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 font-bold mt-1">
                      Slab ({selectedSlab} Students) · Har slab par +50% increment
                    </p>
                  </>
                )}
              </div>

              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Up to 2,000 Students Capacity</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <strong>1 Branch Management Only</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> QR Code Scan Attendance &amp; Fees</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Default School Website (No Custom Edit)</li>
                <li className="flex items-center gap-2 text-slate-400"><Lock className="w-3.5 h-3.5 shrink-0" /> Custom Website CMS (Elite Only)</li>
                <li className="flex items-center gap-2 text-slate-400"><Lock className="w-3.5 h-3.5 shrink-0" /> AI Face Attendance &amp; Entrance Exam (Elite Only)</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={liteUnavailableForSlab}
              onClick={() => sendWhatsApp("lite")}
              className="mt-5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              {liteUnavailableForSlab ? "Max 2,000 Students Only" : `Select Lite (₹${litePrice.toLocaleString("en-IN")}/yr)`}
            </button>
          </div>

          {/* 2. ELITE YEARLY PLAN (HERO / BEST SELLER) */}
          <div className="bg-gradient-to-b from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 rounded-2xl border-2 border-amber-500 p-5 flex flex-col justify-between shadow-xl ring-4 ring-amber-500/15 relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-xs">
                  <Star className="w-3.5 h-3.5 fill-slate-950" /> BEST SELLER · ELITE
                </span>
                <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Up to 3 Branches
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Crown className="w-5 h-5 text-amber-500" /> Elite Yearly Suite
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Complete Automation: 5,000 Students, 3 Branches, AI Face ID, Custom CMS &amp; Document Templates!
                </p>
              </div>

              {/* 12 Month MRP Cut -> 1,00,000 Matra + Renewal 80k */}
              <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400 dark:border-amber-700 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] font-black">
                  <span className="text-slate-600 dark:text-slate-300">12 Months Price:</span>
                  <span className="line-through text-rose-600 dark:text-rose-400 text-sm font-black">₹1,20,000</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEliteBillingMode("new")}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      eliteBillingMode === "new"
                        ? "bg-amber-500 text-slate-950 border-amber-600 shadow-xs"
                        : "bg-white/70 dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">1st Year Offer</p>
                    <p className="text-base font-black leading-tight">₹1,00,000 मात्र</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEliteBillingMode("renewal")}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      eliteBillingMode === "renewal"
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                        : "bg-white/70 dark:bg-slate-800 border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase">2nd Yr Renewal</p>
                    <p className="text-base font-black leading-tight">₹80,000 / yr</p>
                  </button>
                </div>

                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  {eliteBillingMode === "new"
                    ? "🎉 Save ₹20,000 on 1st Year (Agle saal se Renewal sirf ₹80,000/yr)"
                    : "🔄 Annual Renewal Rate: ₹80,000 / Year (₹40,000 Discount vs MRP)"}
                </p>
              </div>

              <ul className="space-y-2 text-xs text-slate-800 dark:text-slate-200 font-semibold">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> <strong>Up to 5,000 Active Students</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> <strong>3 Branches Manage karne ka Power</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🤖 AI Face Attendance (0.2s Kiosk + Face ID)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🌐 Custom Website CMS (Photos, Gallery, Staff)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🎨 Custom ID/Admit/Marksheet/Fee Templates Studio</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-600 shrink-0" /> 🎓 Online Entrance Exam (17,500+ Qs) &amp; Class 1–12 Notes</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => sendWhatsApp("elite")}
              className="mt-5 w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              Activate Elite (₹{elitePrice.toLocaleString("en-IN")}/yr)
            </button>
          </div>

          {/* 3. SUPREME WHITE-LABEL PLAN */}
          <div className="bg-slate-900 text-white rounded-2xl border-2 border-rose-500/70 p-5 flex flex-col justify-between shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black">
                  💎 SUPREME WHITE-LABEL
                </span>
                <span className="text-[11px] font-black text-rose-300 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Unlimited Branches
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-white">
                  Supreme 5,000+ White-Label
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Bade school groups ke liye Play Store App, Data Migration aur On-Site Setup ke sath.
                </p>
              </div>

              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-amber-300">
                    ₹2,00,000
                  </span>
                  <span className="text-xs font-bold text-slate-300">/ Year (Fixed)</span>
                </div>
                <p className="text-[11px] text-rose-300 font-bold mt-1">
                  All-Inclusive Fixed Yearly Enterprise Package
                </p>
              </div>

              <ul className="space-y-2 text-xs text-slate-200">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> <strong>5,000+ Students &amp; Unlimited Staff</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> <strong>Unlimited Branches &amp; Franchise Desk</strong></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> 📱 Play Store App (School Name &amp; Logo)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> 🏫 On-Site Campus Training &amp; Setup</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> 📂 100% Old Register/Excel Data Migration</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> 🌐 Custom .com/.in Domain + All Elite Features</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => sendWhatsApp("supreme")}
              className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              Book Supreme (₹2,00,000/yr)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
