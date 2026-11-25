import React from "react";
import {
  CheckCircle2,
  CloudUpload,
  IndianRupee,
  PhoneCall,
  RefreshCw,
  UserPlus,
  Users,
  UserX,
  Volume2,
} from "lucide-react";
import { speakRawTextWithNativeOrBrowser } from "../../utils/schoolCallerId";

interface TodayCommandDigestCardProps {
  schoolName?: string;
  todayCollected: number;
  todayReceiptsCount: number;
  todayCallsCount: number;
  todaySolvedCount: number;
  todayPromisedAmount: number;
  todayAbsentCount: number;
  todayPresentCount: number;
  openInquiriesCount: number;
  todayInquiriesCount: number;
  staffPresentCount: number;
  totalStaffCount: number;
  pendingSyncCount: number;
  isOnline: boolean;
  syncingPending?: boolean;
  onSyncPending?: () => void;
  onOpenTagada?: () => void;
  onOpenAbsentees?: () => void;
  onOpenEnquiries?: () => void;
}

export const TodayCommandDigestCard: React.FC<TodayCommandDigestCardProps> = ({
  schoolName = "School",
  todayCollected,
  todayReceiptsCount,
  todayCallsCount,
  todaySolvedCount,
  todayPromisedAmount,
  todayAbsentCount,
  todayPresentCount,
  openInquiriesCount,
  todayInquiriesCount,
  staffPresentCount,
  totalStaffCount,
  pendingSyncCount,
  isOnline,
  syncingPending = false,
  onSyncPending,
  onOpenTagada,
  onOpenAbsentees,
  onOpenEnquiries,
}) => {
  const handleSpeakDigest = () => {
    const parts: string[] = [
      `${schoolName} ki aaj ki report.`,
      todayCollected > 0
        ? `Aaj kul ₹${todayCollected.toLocaleString("en-IN")} fee jama hui hai, ${todayReceiptsCount} raseedein kati hain.`
        : "Aaj abhi tak koi fee raseed nahi kati hai.",
      todayCallsCount > 0 || todaySolvedCount > 0
        ? `Fee tagada me ${todayCallsCount} calls aur ${todaySolvedCount} cases solve hue hain.`
        : "Aaj fee tagada calls abhi shuru honi baaki hain.",
      `Haaziri me ${todayPresentCount} chhatra upasthit aur ${todayAbsentCount} chhatra absent hain.`,
      totalStaffCount > 0
        ? `${totalStaffCount} me se ${staffPresentCount} staff present hain.`
        : "",
      openInquiriesCount > 0
        ? `Total ${openInquiriesCount} admission enquiries active hain.`
        : "",
    ];
    speakRawTextWithNativeOrBrowser(
      parts.filter(Boolean).join(" "),
      `principal_digest_${Date.now()}`,
      true
    );
  };

  return (
    <section
      aria-label="Principal Today's Command Digest"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Aaj Ka Command Digest
            </h3>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              · Live Operational Summary
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Fee collection, tagada follow-up, absent students, enquiries aur offline sync status ek saath.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Unified Offline Sync Queue Indicator */}
          {pendingSyncCount > 0 ? (
            <button
              type="button"
              disabled={syncingPending || !isOnline}
              onClick={onSyncPending}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 disabled:opacity-60 transition"
              title={
                isOnline
                  ? "Queued offline updates cloud me sync karein"
                  : "Internet aate hi auto-sync hoga"
              }
            >
              {syncingPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="font-mono tabular-nums">{pendingSyncCount} Pending Sync</span>
            </button>
          ) : (
            <span className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isOnline ? "Cloud Synced" : "Offline Ready"}</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleSpeakDigest}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Sunao (Digest)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Aaj Fee Vasooli</span>
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            ₹{todayCollected.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {todayReceiptsCount} receipts aaj
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenTagada}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 hover:border-indigo-400/70 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Fee Tagada Aaj</span>
            <PhoneCall className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {todayCallsCount} Calls · {todaySolvedCount} Solve
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {todayPromisedAmount > 0
              ? `Promise: ₹${todayPromisedAmount.toLocaleString("en-IN")}`
              : "Tap to open Tagada"}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenAbsentees}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 hover:border-rose-400/70 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Aaj Absent Chhatra</span>
            <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {todayAbsentCount} Absent
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {todayPresentCount} present recorded
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenEnquiries}
          className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 hover:border-sky-400/70 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Admission Enquiry</span>
            <UserPlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-1">
            {openInquiriesCount} Active
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {todayInquiriesCount > 0 ? `+${todayInquiriesCount} aaye aaj` : "Caller ID synced"}
          </p>
        </button>

        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Staff Present Aaj</span>
            <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {staffPresentCount} / {totalStaffCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Active teaching &amp; office staff
          </p>
        </div>
      </div>
    </section>
  );
};
