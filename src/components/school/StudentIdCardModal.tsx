// @ts-nocheck
import React, { useState, useRef } from "react";
import QRCode from "react-qr-code";
import {
  X,
  Printer,
  Shield,
  User,
  Share2,
  Check,
  Copy,
  Download,
  Loader2,
  FileText,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { resolveSchoolSignatory, type MonthlyFee, type School, type SchoolClass, type SchoolStudent } from "../../school-types";
import { getSavedSchoolLogo, cleanLogoUrl, formatAcademicSession } from "./feeReceiptUtils";
import { printElementInIframe } from "./AdmissionFormPrintModal";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { buildStudentIdCardQrUrl } from "../../utils/qrVerifyUrl";
import { exportElementToPdf } from "../../utils/universalPdfExport";
import { EasyScanQrPanel } from "./EasyScanQrPanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  student: SchoolStudent | null;
  school: School | null;
  classes?: SchoolClass[];
  admissionFee?: MonthlyFee | null;
  onOpenAdmissionForm?: () => void;
}

export const StudentIdCardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  student,
  school,
  classes = [],
  admissionFee,
  onOpenAdmissionForm,
}) => {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !student) return null;

  const schoolName = school?.name || "Institutional Campus";
  const schoolLogo = getSavedSchoolLogo(school?.logoUrl, school?.id);
  const affiliation = school?.affiliation || school?.tagline || "Affiliated Educational Center";
  const sessionLabel = formatAcademicSession(school?.session || "2026-27");
  const idSig = resolveSchoolSignatory(
    school,
    school?.signatureRouting?.idCard || "principal",
    school?.principalTitle || "Principal / Head of Institution"
  );
  const principalName = idSig.name;
  const principalTitle = idSig.role === "principal"
    ? (school?.principalTitle || "Principal / Head of Institution")
    : idSig.roleLabel;
  const signatureUrl = idSig.signatureUrl;

  const matchedClass = classes.find((c) => c.id === student.classId);
  const className =
    student.className ||
    (matchedClass
      ? `${matchedClass.name}${matchedClass.section ? ` (${matchedClass.section})` : ""}`
      : "Student");

  const studentName = student.name || "Student";
  const studentId = student.id || `stu_${Date.now()}`;
  const rollNo = student.rollNo || "—";
  const admNo = student.admissionNo || `ADM-${studentId.slice(-4).toUpperCase()}`;
  const fatherName = student.fatherName || "—";
  const motherName = student.motherName || "";
  const phone = student.phone || (student as any).whatsappNo || (student as any).emergencyPhone || "";
  const dob = student.dateOfBirth || "";
  const bloodGroup = student.bloodGroup || "";
  const photoUrl = student.photoUrl;

  const schoolInitials = (schoolName || "SC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "SC";
  const verificationTokenLabel =
    student.verificationToken || `ID-${(admNo || studentId).slice(-8).toUpperCase()}`;

  const qrVerifyUrl = buildStudentIdCardQrUrl({
    schoolId: school?.id || student.schoolId || "",
    studentId,
    rollNo: student.rollNo || "",
    classId: student.classId || "",
    studentName,
    admissionNo: student.admissionNo || "",
    phone,
    fatherName: student.fatherName || "",
    motherName,
    bloodGroup,
    dob,
    address: student.address || "",
    monthlyFee: student.monthlyFee ?? 0,
    className,
    schoolName,
    verificationToken: student.verificationToken,
    qrIssuedAt: student.qrIssuedAt,
    qrExpiresAt: student.qrExpiresAt,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrint = () => {
    printElementInIframe(printAreaRef.current, `${studentName} - Student ID Card`, "", orientation);
  };

  const handleDownloadPdf = async () => {
    const cardEl = (printAreaRef.current?.firstElementChild as HTMLElement) || printAreaRef.current;
    if (!cardEl || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const targetWidth = orientation === "landscape" ? 372 : 254;
      const measuredHeight = Math.max(
        cardEl.scrollHeight || 0,
        cardEl.offsetHeight || 0,
        orientation === "landscape" ? 236 : 394
      );
      await exportElementToPdf(cardEl, {
        filename: `Student_ID_Card_${studentName}_${admNo}`,
        format: "cr80",
        orientation,
        widthPx: targetWidth,
        heightPx: measuredHeight,
        backgroundColor: "#ffffff",
        scale: 4,
      });
      toast.success("Student ID Card PDF download ho gaya!");
    } catch (err) {
      console.error("Student ID Card PDF error:", err);
      toast.error("PDF generate karne me error aaya, Print / Save PDF try karein.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text =
      `*🏫 ${schoolName.toUpperCase()}*\n` +
      `*🪪 OFFICIAL STUDENT IDENTITY CARD*\n\n` +
      `👤 *Student Name:* ${studentName}\n` +
      `📚 *Class:* ${className}\n` +
      `🔢 *Roll No:* ${rollNo}\n` +
      `🆔 *Admission No:* ${admNo}\n` +
      `👨 *Father's Name:* ${fatherName}\n` +
      `📱 *Parent Mobile:* ${phone || "Not set"}\n` +
      `📅 *Academic Session:* ${sessionLabel}\n\n` +
      `🔑 *Student App Login & Attendance:* App open karein aur is ID card ka QR Code scan karke seedha Student Dashboard & Haziri access karein.`;

    const encoded = encodeURIComponent(text);
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    safeOpenExternalUrl(waUrl);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-800/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight">
                  Student Identity Card (छात्र पहचान पत्र)
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs whitespace-nowrap">
                  ID Ready
                </span>
              </div>
              <p className="text-[11px] text-blue-200 truncate">
                Attendance QR scan, gate pass aur Student Portal login ke liye official ID card
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Orientation Toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setOrientation("landscape")}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0 ${
                orientation === "landscape"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Horizontal (85.6 × 54mm)
            </button>
            <button
              type="button"
              onClick={() => setOrientation("portrait")}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0 ${
                orientation === "portrait"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Vertical (54 × 85.6mm)
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenAdmissionForm && (
              <button
                type="button"
                onClick={onOpenAdmissionForm}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{admissionFee ? "Form & Fee Receipt" : "Admission Form"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
              title="Parent ke WhatsApp par Student ID Card details bhejein"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share via WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadingPdf ? "Saving PDF..." : "Download PDF"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print ID Card</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-100/50 dark:bg-slate-950/40">
          {/* Card Presentation Container (Original CR80 Size for Print/PDF) */}
          <div className="flex justify-center items-center py-2">
            <div ref={printAreaRef} className="print-card-wrapper">
              {orientation === "landscape" ? (
                /* LANDSCAPE CR80 STUDENT ID CARD */
                <div
                  data-pdf-lock-light="true"
                  className="cr80-id-card nst-isolated-print-light w-[372px] min-h-[236px] bg-white text-slate-900 rounded-2xl shadow-xl border-2 border-indigo-700 flex flex-col relative overflow-hidden select-none print:w-[85.6mm] print:min-h-[54mm] print:shadow-none print:m-0"
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif",
                    lineHeight: 1.35,
                  }}
                >
                  {/* Top School Header */}
                  <div
                    className="px-3 py-2 text-white flex items-center justify-between shrink-0"
                    style={{
                      background: "linear-gradient(90deg, #1e3a8a 0%, #312e81 55%, #0f172a 100%)",
                      color: "#ffffff",
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {schoolLogo ? (
                        <img
                          src={cleanLogoUrl(schoolLogo)}
                          alt="Logo"
                          crossOrigin="anonymous"
                          data-fallback-initials={schoolInitials}
                          className="w-7 h-7 rounded-full bg-white object-contain p-0.5 shrink-0 border border-amber-300"
                          style={{ backgroundColor: "#ffffff" }}
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] shrink-0"
                          style={{
                            backgroundColor: "#0f172a",
                            color: "#ffffff",
                            border: "1.5px solid #fbbf24",
                          }}
                        >
                          {schoolInitials}
                        </div>
                      )}
                      <div className="min-w-0" style={{ lineHeight: 1.28 }}>
                        <h4
                          className="font-black text-[11px] tracking-tight text-white"
                          style={{ color: "#ffffff", wordBreak: "break-word" }}
                        >
                          {schoolName}
                        </h4>
                        <p
                          className="text-[7.5px] text-blue-200"
                          style={{ color: "#bfdbfe", wordBreak: "break-word" }}
                        >
                          {affiliation}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-wider"
                        style={{ backgroundColor: "#fbbf24", color: "#0f172a" }}
                      >
                        STUDENT ID
                      </span>
                      <p className="text-[7px] font-bold mt-0.5 text-right" style={{ color: "#e0e7ff" }}>
                        {sessionLabel}
                      </p>
                    </div>
                  </div>

                  {/* Body Columns: Photo Left | Info Center | Compact Print QR Right */}
                  <div
                    className="px-3 py-2.5 flex-1 flex items-center justify-between gap-2.5 bg-white"
                    style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                  >
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <div
                        className="w-[64px] h-[80px] rounded-xl border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center"
                        style={{ backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={studentName}
                            crossOrigin="anonymous"
                            data-fallback-initials={studentName.slice(0, 2).toUpperCase()}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: "#f8fafc", color: "#64748b" }}>
                            <User className="w-7 h-7" style={{ color: "#94a3b8" }} />
                            <span className="text-[7px] font-bold mt-0.5" style={{ color: "#64748b" }}>Student</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-[9px] space-y-1" style={{ lineHeight: 1.35 }}>
                      <div className="pb-1" style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <h3
                          className="font-black text-[12px]"
                          style={{ color: "#0f172a", lineHeight: 1.3, wordBreak: "break-word" }}
                        >
                          {studentName}
                        </h3>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span
                            className="inline-block text-[7.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{ backgroundColor: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" }}
                          >
                            {className}
                          </span>
                          {bloodGroup && (
                            <span
                              className="inline-block text-[7.5px] font-black px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}
                            >
                              {bloodGroup}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-0.5 space-y-1 text-[8.5px]" style={{ color: "#334155", lineHeight: 1.35 }}>
                        <div className="flex justify-between items-baseline pb-0.5 gap-1.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <span className="font-bold shrink-0" style={{ color: "#64748b" }}>Roll / Adm:</span>
                          <span className="font-mono font-black text-right" style={{ color: "#3730a3", wordBreak: "break-word" }}>
                            #{rollNo} • {admNo}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline pb-0.5 gap-1.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <span className="font-bold shrink-0" style={{ color: "#64748b" }}>Father:</span>
                          <span className="font-bold text-right" style={{ color: "#0f172a", wordBreak: "break-word" }}>
                            {fatherName}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline pb-0.5 gap-1.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <span className="font-bold shrink-0" style={{ color: "#64748b" }}>Mobile:</span>
                          <span className="font-bold text-right tabular-nums" style={{ color: "#0f172a" }}>
                            {phone || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline gap-1.5">
                          <span className="font-bold shrink-0" style={{ color: "#64748b" }}>{dob ? "DOB:" : "Valid Till:"}</span>
                          <span className="font-black text-right tabular-nums" style={{ color: "#047857" }}>
                            {dob || sessionLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Compact CR80 Print QR */}
                    <div className="flex flex-col items-center justify-center shrink-0 w-[80px]">
                      <div
                        className="p-1.5 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1" }}
                      >
                        <QRCode value={qrVerifyUrl} size={64} level="L" />
                      </div>
                      <span className="text-[7px] font-black uppercase tracking-tight mt-1" style={{ color: "#3730a3" }}>
                        Scan to Verify
                      </span>
                      <span className="text-[6.5px] font-mono font-bold whitespace-nowrap tabular-nums" style={{ color: "#475569" }}>
                        {verificationTokenLabel}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Footer */}
                  <div
                    className="px-3 py-1.5 flex items-center justify-between gap-2 text-[7px] shrink-0"
                    style={{
                      backgroundColor: "#f8fafc",
                      borderTop: "1px solid #cbd5e1",
                      color: "#334155",
                      lineHeight: 1.35,
                    }}
                  >
                    <div className="min-w-0 flex-1" style={{ wordBreak: "break-word" }}>
                      <span className="font-bold" style={{ color: "#1e293b" }}>{school?.address || "School Campus"}</span>
                      {school?.phone && <span className="ml-1" style={{ color: "#475569" }}>• Helpline: {school.phone}</span>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end justify-end">
                      {signatureUrl ? (
                        <img
                          src={signatureUrl}
                          alt="Signature"
                          crossOrigin="anonymous"
                          className="h-3.5 max-w-[65px] object-contain block mb-0.5"
                        />
                      ) : (
                        <span className="font-serif italic font-bold text-[7.5px] block mb-0.5" style={{ color: "#0f172a", lineHeight: 1.2 }}>
                          {principalName}
                        </span>
                      )}
                      <p className="text-[6.5px] font-black uppercase tracking-wider" style={{ color: "#334155" }}>
                        {principalTitle}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* PORTRAIT CR80 STUDENT ID CARD */
                <div
                  data-pdf-lock-light="true"
                  className="cr80-id-card nst-isolated-print-light w-[254px] min-h-[394px] bg-white text-slate-900 rounded-2xl shadow-xl border-2 border-indigo-700 flex flex-col relative overflow-hidden select-none print:w-[54mm] print:min-h-[85.6mm] print:shadow-none print:m-0"
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif",
                    lineHeight: 1.35,
                  }}
                >
                  <div className="py-1 flex items-center justify-center shrink-0" style={{ backgroundColor: "#172554" }}>
                    <div className="w-10 h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
                  </div>

                  <div
                    className="px-3 py-2 text-center text-white shrink-0"
                    style={{
                      background: "linear-gradient(180deg, #1e3a8a 0%, #312e81 100%)",
                      color: "#ffffff",
                    }}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {schoolLogo ? (
                        <img
                          src={cleanLogoUrl(schoolLogo)}
                          alt="Logo"
                          crossOrigin="anonymous"
                          data-fallback-initials={schoolInitials}
                          className="w-6 h-6 rounded-full bg-white object-contain p-0.5 shrink-0 border border-amber-300"
                          style={{ backgroundColor: "#ffffff" }}
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px] shrink-0"
                          style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1.5px solid #fbbf24" }}
                        >
                          {schoolInitials}
                        </div>
                      )}
                      <h4 className="font-black text-[11px] tracking-tight" style={{ color: "#ffffff", lineHeight: 1.25 }}>
                        {schoolName}
                      </h4>
                    </div>
                    <p className="text-[7px] mt-0.5" style={{ color: "#bfdbfe" }}>{affiliation}</p>
                    <div
                      className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest"
                      style={{ backgroundColor: "#fbbf24", color: "#0f172a" }}
                    >
                      STUDENT ID CARD • {sessionLabel}
                    </div>
                  </div>

                  {/* Photo & Compact QR Row */}
                  <div
                    className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 shrink-0"
                    style={{ backgroundColor: "#ffffff" }}
                  >
                    <div
                      className="w-[68px] h-[82px] rounded-xl border-2 overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1" }}
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={studentName}
                          crossOrigin="anonymous"
                          data-fallback-initials={studentName.slice(0, 2).toUpperCase()}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8" style={{ color: "#94a3b8" }} />
                      )}
                    </div>

                    <div className="flex flex-col items-center justify-center shrink-0 w-[82px]">
                      <div
                        className="p-1.5 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1" }}
                      >
                        <QRCode value={qrVerifyUrl} size={62} level="L" />
                      </div>
                      <span className="text-[6.5px] font-black uppercase tracking-tight mt-0.5" style={{ color: "#3730a3" }}>
                        Scan to Verify
                      </span>
                      <span className="text-[6px] font-mono font-bold whitespace-nowrap tabular-nums" style={{ color: "#475569" }}>
                        {verificationTokenLabel}
                      </span>
                    </div>
                  </div>

                  <div
                    className="px-3 py-1.5 text-center shrink-0"
                    style={{ backgroundColor: "#eef2ff", borderTop: "1px solid #e0e7ff", borderBottom: "1px solid #e0e7ff" }}
                  >
                    <h3 className="text-xs font-black" style={{ color: "#0f172a", lineHeight: 1.3, wordBreak: "break-word" }}>
                      {studentName}
                    </h3>
                    <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                      <span
                        className="inline-block text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ backgroundColor: "#4f46e5", color: "#ffffff" }}
                      >
                        {className}
                      </span>
                      {bloodGroup && (
                        <span
                          className="inline-block text-[7.5px] font-black px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}
                        >
                          {bloodGroup}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-3 py-2 flex-1 text-[8.5px] space-y-1" style={{ color: "#334155", lineHeight: 1.35, backgroundColor: "#ffffff" }}>
                    <div className="flex justify-between gap-1.5 pb-0.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <span className="font-bold shrink-0" style={{ color: "#64748b" }}>Roll / Adm:</span>
                      <span className="font-mono font-black text-right" style={{ color: "#3730a3" }}>#{rollNo} • {admNo}</span>
                    </div>
                    <div className="flex justify-between gap-1.5 pb-0.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <span className="font-bold shrink-0" style={{ color: "#64748b" }}>Father:</span>
                      <span className="font-bold text-right" style={{ color: "#0f172a", wordBreak: "break-word" }}>{fatherName}</span>
                    </div>
                    <div className="flex justify-between gap-1.5 pb-0.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <span className="font-bold shrink-0" style={{ color: "#64748b" }}>Mobile:</span>
                      <span className="font-bold text-right tabular-nums" style={{ color: "#0f172a" }}>{phone || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-1.5">
                      <span className="font-bold shrink-0" style={{ color: "#64748b" }}>{dob ? "DOB:" : "Valid Till:"}</span>
                      <span className="font-black text-right tabular-nums" style={{ color: "#047857" }}>{dob || sessionLabel}</span>
                    </div>
                  </div>

                  <div
                    className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[6.5px] shrink-0 mt-auto"
                    style={{ backgroundColor: "#f8fafc", borderTop: "1px solid #cbd5e1", color: "#334155", lineHeight: 1.3 }}
                  >
                    <div className="min-w-0 flex-1" style={{ wordBreak: "break-word" }}>
                      <span className="font-bold" style={{ color: "#1e293b" }}>{school?.address || "School Campus"}</span>
                    </div>
                    <div className="text-right shrink-0">
                      {signatureUrl ? (
                        <img
                          src={signatureUrl}
                          alt="Signature"
                          crossOrigin="anonymous"
                          className="h-3 max-w-[60px] object-contain block mb-0.5 ml-auto"
                        />
                      ) : (
                        <span className="font-serif italic font-black text-[7px] block mb-0.5" style={{ color: "#0f172a", lineHeight: 1.2 }}>
                          {principalName}
                        </span>
                      )}
                      <p className="text-[6px] font-black uppercase tracking-wider" style={{ color: "#334155" }}>
                        {principalTitle}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 512x512 Easy-Scan On-Screen QR Panel (Strictly Excluded from Print / PDF) */}
          <EasyScanQrPanel
            qrValue={qrVerifyUrl}
            personName={studentName}
            personRoleLabel={className}
            identifierLabel={`Roll #${rollNo} · Adm: ${admNo}`}
            scanInstruction="Naye student ka attendance ya portal login scan karne ke liye 512×512 Easy-Scan QR"
            downloadFileName={`Student_QR_512x512_${studentName}_${admNo}`}
            accent="blue"
          />

          {/* Student Quick Credentials Card */}
          <div className="print:hidden bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-800 dark:text-white">
                  Student Login &amp; Identity Details (छात्र जानकारी)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Is QR Code, Admission Number ya Mobile Number se Student App me login aur Attendance mark ki ja sakti hai
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Admission No / Roll:</span>
                  <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {admNo} (#{rollNo})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(admNo, "admNo")}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer"
                  title="Copy Admission No"
                >
                  {copiedField === "admNo" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Parent Mobile:</span>
                  <span className="font-mono font-black text-sm text-slate-800 dark:text-slate-200 tabular-nums">
                    {phone || "Not Set"}
                  </span>
                </div>
                {phone && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(phone, "phone")}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer"
                    title="Copy Phone"
                  >
                    {copiedField === "phone" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            School ERP • Student ID Card &amp; 512×512 Easy-Scan QR
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{downloadingPdf ? "Generating PDF..." : "Download Official PDF"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print ID Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
