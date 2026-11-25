import React, { useState } from "react";
import { jsPDF } from "jspdf";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Download,
  FileDown,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { speakRawTextWithNativeOrBrowser } from "../../utils/schoolCallerId";
import { pickLang, useAppLang } from "../../utils/appLang";

interface TodayCommandDigestCardProps {
  schoolName?: string;
  todayCollected: number;
  todayCashAmount?: number;
  todayOnlineAmount?: number;
  todayReceiptsCount: number;
  todayCallsCount: number;
  todaySolvedCount: number;
  todayPromisedAmount: number;
  tomorrowPromiseCount?: number;
  tomorrowPromiseAmount?: number;
  pendingUpiCount?: number;
  todayAbsentCount: number;
  todayPresentCount: number;
  openInquiriesCount: number;
  todayInquiriesCount: number;
  staffPresentCount: number;
  totalStaffCount: number;
  pendingSyncCount: number;
  isOnline: boolean;
  syncingPending?: boolean;
  unpaidStudentsCount?: number;
  sendingFeeReminders?: boolean;
  onSyncPending?: () => void;
  onOpenFees?: () => void;
  onOpenTagada?: () => void;
  onOpenAbsentees?: () => void;
  onOpenEnquiries?: () => void;
  onOpenUpiApprovals?: () => void;
  onSendPendingFeeReminders?: () => void;
  onDownloadBackup?: () => void;
}

export const TodayCommandDigestCard: React.FC<TodayCommandDigestCardProps> = ({
  schoolName = "School",
  todayCollected,
  todayCashAmount = 0,
  todayOnlineAmount = 0,
  todayReceiptsCount,
  todayCallsCount,
  todaySolvedCount,
  todayPromisedAmount,
  tomorrowPromiseCount = 0,
  tomorrowPromiseAmount = 0,
  pendingUpiCount = 0,
  todayAbsentCount,
  todayPresentCount,
  openInquiriesCount,
  todayInquiriesCount,
  staffPresentCount,
  totalStaffCount,
  pendingSyncCount,
  isOnline,
  syncingPending = false,
  unpaidStudentsCount = 0,
  sendingFeeReminders = false,
  onSyncPending,
  onOpenFees,
  onOpenTagada,
  onOpenAbsentees,
  onOpenEnquiries,
  onOpenUpiApprovals,
  onSendPendingFeeReminders,
  onDownloadBackup,
}) => {
  const [lang] = useAppLang();
  const t = (hi: string, en: string) => pickLang(lang, hi, en);
  const [showClosingCard, setShowClosingCard] = useState(false);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleSpeakDigest = () => {
    const parts: string[] = [
      `${schoolName} ${t("की आज की रिपोर्ट।", "today's report.")}`,
      todayCollected > 0
        ? t(
            `आज कुल ₹${todayCollected.toLocaleString("en-IN")} शुल्क जमा हुआ है, ${todayReceiptsCount} रसीदें कटी हैं।`,
            `Today total ₹${todayCollected.toLocaleString("en-IN")} collected across ${todayReceiptsCount} receipts.`
          )
        : t("आज अभी तक कोई शुल्क रसीद नहीं कटी है।", "No fee receipts recorded yet today."),
      todayCallsCount > 0 || todaySolvedCount > 0
        ? t(
            `फीस तकादा में ${todayCallsCount} कॉल्स और ${todaySolvedCount} मामले हल हुए हैं।`,
            `${todayCallsCount} fee calls made and ${todaySolvedCount} cases resolved today.`
          )
        : t("आज फीस तकादा कॉल्स अभी शुरू होनी बाकी हैं।", "Fee follow-up calls are yet to begin today."),
      tomorrowPromiseCount > 0
        ? t(
            `कल के लिए ${tomorrowPromiseCount} अभिभावकों ने ₹${tomorrowPromiseAmount.toLocaleString("en-IN")} शुल्क जमा करने का वादा किया है।`,
            `${tomorrowPromiseCount} parents promised ₹${tomorrowPromiseAmount.toLocaleString("en-IN")} for tomorrow.`
          )
        : "",
      t(
        `हाज़िरी में ${todayPresentCount} छात्र उपस्थित और ${todayAbsentCount} छात्र अनुपस्थित हैं।`,
        `Attendance stands at ${todayPresentCount} present and ${todayAbsentCount} absent students.`
      ),
      totalStaffCount > 0
        ? t(
            `${totalStaffCount} में से ${staffPresentCount} स्टाफ उपस्थित हैं।`,
            `${staffPresentCount} of ${totalStaffCount} staff members are present.`
          )
        : "",
      openInquiriesCount > 0
        ? t(
            `कुल ${openInquiriesCount} एडमिशन पूछताछ सक्रिय हैं।`,
            `${openInquiriesCount} admission enquiries are currently active.`
          )
        : "",
    ];
    speakRawTextWithNativeOrBrowser(
      parts.filter(Boolean).join(" "),
      `principal_digest_${Date.now()}`,
      true
    );
  };

  const handleShareClosingWhatsApp = () => {
    const text =
      lang === "HI"
        ? [
            `*${schoolName} — दैनिक क्लोजिंग रिपोर्ट*`,
            `दिनांक: ${todayLabel}`,
            ``,
            `1. *आज का कुल शुल्क संकलन:* ₹${todayCollected.toLocaleString("en-IN")} (${todayReceiptsCount} रसीदें)`,
            `   • नकद (Cash): ₹${todayCashAmount.toLocaleString("en-IN")}`,
            `   • ऑनलाइन / UPI: ₹${todayOnlineAmount.toLocaleString("en-IN")}`,
            ``,
            `2. *छात्र व स्टाफ उपस्थिति:*`,
            `   • छात्र उपस्थित: ${todayPresentCount} | अनुपस्थित: ${todayAbsentCount}`,
            `   • स्टाफ उपस्थित: ${staffPresentCount}/${totalStaffCount}`,
            ``,
            `3. *फीस तकादा व कल की वादा सूची:*`,
            `   • आज कॉल्स: ${todayCallsCount} | हल: ${todaySolvedCount}`,
            `   • कल के वादा कॉल्स: ${tomorrowPromiseCount} (₹${tomorrowPromiseAmount.toLocaleString("en-IN")})`,
            pendingUpiCount > 0 ? `   • लंबित UPI सत्यापन: ${pendingUpiCount}` : "",
            ``,
            `4. *सक्रिय एडमिशन पूछताछ:* ${openInquiriesCount} (+${todayInquiriesCount} आज)`,
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `*${schoolName} — Principal Daily Closing Summary*`,
            `Date: ${todayLabel}`,
            ``,
            `1. *Today's Fee Collection:* Rs. ${todayCollected.toLocaleString("en-IN")} (${todayReceiptsCount} receipts)`,
            `   - Cash: Rs. ${todayCashAmount.toLocaleString("en-IN")}`,
            `   - Online / UPI: Rs. ${todayOnlineAmount.toLocaleString("en-IN")}`,
            ``,
            `2. *Attendance Summary:*`,
            `   - Students Present: ${todayPresentCount} | Absent: ${todayAbsentCount}`,
            `   - Staff Present: ${staffPresentCount}/${totalStaffCount}`,
            ``,
            `3. *Fee Follow-ups & Tomorrow Promises:*`,
            `   - Today's Calls: ${todayCallsCount} | Solved: ${todaySolvedCount}`,
            `   - Tomorrow's Promise Calls: ${tomorrowPromiseCount} (Expected Rs. ${tomorrowPromiseAmount.toLocaleString("en-IN")})`,
            pendingUpiCount > 0 ? `   - Pending UPI Approvals: ${pendingUpiCount}` : "",
            ``,
            `4. *Open Admission Enquiries:* ${openInquiriesCount} (+${todayInquiriesCount} today)`,
          ]
            .filter(Boolean)
            .join("\n");

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  const handleSaveClosingPdf = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      let y = 52;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 595, 96, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(schoolName.slice(0, 48), 40, 44);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Principal Daily Closing Summary  |  ${todayLabel}`, 40, 68);

      y = 128;
      doc.setTextColor(15, 23, 42);

      const drawSection = (title: string, rows: [string, string][]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(title, 40, y);
        y += 8;
        doc.setDrawColor(226, 232, 240);
        doc.line(40, y, 555, y);
        y += 20;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        for (const [label, value] of rows) {
          doc.setTextColor(71, 85, 105);
          doc.text(label, 48, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(value, 545, y, { align: "right" });
          doc.setFont("helvetica", "normal");
          y += 22;
        }
        y += 14;
      };

      drawSection("1. Today's Fee & Store Collection", [
        ["Total Collection Today", `Rs. ${todayCollected.toLocaleString("en-IN")}`],
        ["Total Receipts Issued", `${todayReceiptsCount}`],
        ["Cash Counter Collection", `Rs. ${todayCashAmount.toLocaleString("en-IN")}`],
        ["Online / UPI Collection", `Rs. ${todayOnlineAmount.toLocaleString("en-IN")}`],
        ["Pending UPI Verifications", `${pendingUpiCount}`],
      ]);

      drawSection("2. Attendance Summary", [
        ["Students Present Today", `${todayPresentCount}`],
        ["Students Absent Today", `${todayAbsentCount}`],
        ["Staff Present Today", `${staffPresentCount} / ${totalStaffCount}`],
      ]);

      drawSection("3. Fee Follow-up & Tomorrow's Promises", [
        ["Fee Tagada Calls Made Today", `${todayCallsCount}`],
        ["Fee Cases Settled Today", `${todaySolvedCount}`],
        ["Amount Promised Today", `Rs. ${todayPromisedAmount.toLocaleString("en-IN")}`],
        ["Tomorrow's Scheduled Promise Calls", `${tomorrowPromiseCount} students`],
        ["Expected Tomorrow Promise Amount", `Rs. ${tomorrowPromiseAmount.toLocaleString("en-IN")}`],
      ]);

      drawSection("4. Admissions & Sync Status", [
        ["Active Open Enquiries", `${openInquiriesCount}`],
        ["New Enquiries Today", `${todayInquiriesCount}`],
        ["Pending Offline Sync Items", `${pendingSyncCount}`],
      ]);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated at ${new Date().toLocaleTimeString("en-IN")} | Principal Sign-off Report`,
        40,
        790
      );

      const safeDate = new Date().toISOString().slice(0, 10);
      doc.save(`Daily_Closing_${safeDate}.pdf`);
      toast.success(
        t("दैनिक क्लोजिंग PDF डाउनलोड हो गई।", "Daily closing PDF downloaded.")
      );
    } catch {
      toast.error(t("PDF बन नहीं सकी।", "Could not generate closing PDF."));
    }
  };

  return (
    <section
      aria-label={t("प्रधानाचार्य दैनिक कमांड सारांश", "Principal Today's Command Digest")}
      className="rounded-2xl bg-slate-900 dark:bg-slate-950 text-white border border-slate-800/90 shadow-sm overflow-hidden"
    >
      {/* Top Executive Header */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-400">
            <span className="text-slate-200 font-semibold truncate max-w-[180px] sm:max-w-xs">
              {schoolName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{todayLabel}</span>
            <span aria-hidden="true">·</span>
            {pendingSyncCount > 0 ? (
              <button
                type="button"
                disabled={syncingPending || !isOnline}
                onClick={onSyncPending}
                className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer disabled:opacity-60"
              >
                {syncingPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <CloudUpload className="w-3 h-3" />
                )}
                <span className="tabular-nums">
                  {pendingSyncCount} {t("सिंक लंबित", "Pending Sync")}
                </span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {isOnline ? t("क्लाउड सिंक", "Cloud Synced") : t("ऑफलाइन तैयार", "Offline Ready")}
                </span>
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
            {t("दैनिक स्कूल कमांड सारांश", "Daily School Command Brief")}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowClosingCard((p) => !p)}
            className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0 ${
              showClosingCard
                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                : "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
            }`}
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>{t("दैनिक क्लोजिंग कार्ड", "Closing Summary")}</span>
            {showClosingCard ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={handleSpeakDigest}
            className="min-h-[44px] px-4 sm:px-5 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition active:scale-[0.98] whitespace-nowrap shrink-0 shadow-xs"
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>{t("रिपोर्ट सुनें", "Voice Report")}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Hairline KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-800 divide-y lg:divide-y-0 divide-x divide-slate-800 bg-slate-900/50">
        <button
          type="button"
          onClick={onOpenFees}
          className="text-left px-4 py-4 sm:px-5 sm:py-5 min-h-[98px] hover:bg-white/[0.05] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
            <span>{t("आज का शुल्क संकलन", "Today's Collection")}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-white mt-1.5">
            ₹{todayCollected.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
            {todayReceiptsCount} {t("रसीदें आज", "receipts today")}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenTagada}
          className="text-left px-4 py-4 sm:px-5 sm:py-5 min-h-[98px] hover:bg-white/[0.05] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
            <span>{t("फीस तकादा कॉल्स", "Fee Tagada")}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-white mt-1.5">
            {todayCallsCount}{" "}
            <span className="text-xs font-medium text-slate-400">
              {t(`कॉल्स · ${todaySolvedCount} हल`, `Calls · ${todaySolvedCount} Solved`)}
            </span>
          </p>
          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
            {tomorrowPromiseCount > 0
              ? t(
                  `कल वादा: ${tomorrowPromiseCount} (₹${tomorrowPromiseAmount.toLocaleString("en-IN")})`,
                  `Tomorrow: ${tomorrowPromiseCount} (₹${tomorrowPromiseAmount.toLocaleString("en-IN")})`
                )
              : todayPromisedAmount > 0
              ? t(
                  `वादा राशि ₹${todayPromisedAmount.toLocaleString("en-IN")}`,
                  `Promised ₹${todayPromisedAmount.toLocaleString("en-IN")}`
                )
              : t("फीस कॉलर खोलें", "Open fee caller")}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenAbsentees}
          className="text-left px-4 py-4 sm:px-5 sm:py-5 min-h-[98px] hover:bg-white/[0.05] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
            <span>{t("अनुपस्थित छात्र", "Absentees")}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-rose-400 mt-1.5">
            {todayAbsentCount}
          </p>
          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
            {todayPresentCount} {t("आज उपस्थित", "present today")}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenEnquiries}
          className="text-left px-4 py-4 sm:px-5 sm:py-5 min-h-[98px] hover:bg-white/[0.05] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
            <span>{t("पूछताछ व स्टाफ", "Enquiries & Staff")}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-sky-400 mt-1.5">
            {openInquiriesCount}{" "}
            <span className="text-xs font-medium text-slate-400">
              · {t("स्टाफ", "Staff")} {staffPresentCount}/{totalStaffCount}
            </span>
          </p>
          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
            {todayInquiriesCount > 0
              ? `+${todayInquiriesCount} ${t("नई आज", "new today")}`
              : t("कॉलर आईडी सिंक", "Caller ID synced")}
          </p>
        </button>
      </div>

      {/* Expandable Principal Daily Closing Summary Card */}
      {showClosingCard && (
        <div className="border-t border-slate-800 bg-slate-950/90 px-4 py-4 sm:px-6 sm:py-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                {t("प्रधानाचार्य दैनिक क्लोजिंग सारांश", "Principal Daily Closing Summary")}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t(
                  "शाम को स्कूल बंद करते समय आज के हिसाब, अनुपस्थिति व कल के वादों की त्वरित रिपोर्ट",
                  "End-of-day snapshot of collections, attendance, pending UPI proofs & tomorrow fee promises"
                )}
              </p>
            </div>

            {pendingUpiCount > 0 && onOpenUpiApprovals && (
              <button
                type="button"
                onClick={onOpenUpiApprovals}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>
                  {pendingUpiCount} {t("लंबित UPI जाँचें", "Pending UPI Verify")}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">
                {t("नकद बनाम ऑनलाइन / UPI", "Cash vs Online / UPI")}
              </span>
              <p className="text-lg font-extrabold text-emerald-400 tabular-nums">
                ₹{todayCollected.toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-slate-300 tabular-nums">
                {t("नकद:", "Cash:")} ₹{todayCashAmount.toLocaleString("en-IN")} · UPI: ₹
                {todayOnlineAmount.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">
                {t("कल के फीस वादा कॉल्स", "Tomorrow Fee Promise Calls")}
              </span>
              <p className="text-lg font-extrabold text-amber-300 tabular-nums">
                {tomorrowPromiseCount}{" "}
                <span className="text-xs font-semibold text-slate-400">
                  {t("अभिभावक", "parents")}
                </span>
              </p>
              <p className="text-[11px] text-slate-300 tabular-nums">
                {t("अपेक्षित राशि:", "Expected:")} ₹{tomorrowPromiseAmount.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">
                {t("उपस्थिति और पूछताछ", "Attendance & Enquiries")}
              </span>
              <p className="text-lg font-extrabold text-rose-400 tabular-nums">
                {todayAbsentCount}{" "}
                <span className="text-xs font-semibold text-slate-400">
                  {t("अनुपस्थित", "absent")}
                </span>
              </p>
              <p className="text-[11px] text-slate-300 tabular-nums">
                {t("उपस्थित:", "Present:")} {todayPresentCount} · {t("पूछताछ:", "Enquiries:")}{" "}
                {openInquiriesCount}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {onSendPendingFeeReminders && (
              <button
                type="button"
                disabled={sendingFeeReminders || unpaidStudentsCount === 0}
                onClick={onSendPendingFeeReminders}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              >
                {sendingFeeReminders ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BellRing className="w-4 h-4" />
                )}
                <span>
                  {t(
                    `बकाया रिमाइंडर (${unpaidStudentsCount})`,
                    `Fee Reminder (${unpaidStudentsCount})`
                  )}
                </span>
              </button>
            )}
            {onDownloadBackup && (
              <button
                type="button"
                onClick={onDownloadBackup}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Download className="w-4 h-4" />
                <span>{t("डेटा बैकअप", "Backup Data")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleShareClosingWhatsApp}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t("WhatsApp पर साझा करें", "Share on WhatsApp")}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveClosingPdf}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
            >
              <FileDown className="w-4 h-4" />
              <span>{t("क्लोजिंग PDF सहेजें", "Save Closing PDF")}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
