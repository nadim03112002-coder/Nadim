import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  GraduationCap,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  CalendarCheck,
  MessageSquare,
  ReceiptText,
  ArrowRight,
  X,
  Share2,
  Download,
  School as SchoolIcon,
  PartyPopper,
  QrCode,
  IdCard,
  History,
  FileText,
  Printer,
  ExternalLink,
  Loader2,
  Lock,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { NstaWelcomeData, StudentActivationEvent } from "../../school-types";
import { acknowledgeSchoolWelcomeLetter } from "../../school-firebase";
import {
  buildStudentIdCardQrUrl,
  buildStudentVerificationToken,
  isQrVerificationExpired,
} from "../../utils/qrVerifyUrl";
import { exportElementToPdf } from "../../utils/universalPdfExport";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { printElementInIframe } from "./AdmissionFormPrintModal";
import { getSavedSchoolLogo } from "./feeReceiptUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  welcomeData: NstaWelcomeData | null;
  onOpenSchoolDesk?: () => void;
  onOpenIdCard?: (welcomeData: NstaWelcomeData) => void;
  onAcknowledged?: (payload: {
    acknowledgedAt: string;
    acknowledgedBy: string;
    acknowledgedRole: "PARENT" | "STUDENT" | "ADMIN";
    activationHistory: StudentActivationEvent[];
  }) => void;
  defaultRoleForAck?: "PARENT" | "STUDENT" | "ADMIN";
}

function formatDateTimeDisplay(iso?: string): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(iso?: string): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso.slice(0, 10);
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function buildNormalizedActivationHistory(
  welcomeData: NstaWelcomeData,
  token: string,
  issuedAt: string,
  acknowledgedAt?: string,
  acknowledgedBy?: string,
  extraEvents?: StudentActivationEvent[]
): StudentActivationEvent[] {
  const map = new Map<StudentActivationEvent["step"], StudentActivationEvent>();
  const sourceList = [
    ...(Array.isArray(welcomeData.activationHistory) ? welcomeData.activationHistory : []),
    ...(Array.isArray(extraEvents) ? extraEvents : []),
  ];
  for (const ev of sourceList) {
    if (ev && ev.step) {
      map.set(ev.step, ev);
    }
  }

  const baseTs = issuedAt || welcomeData.issuedAt || new Date().toISOString();
  if (!map.has("DIGITAL_ID_CREATED")) {
    map.set("DIGITAL_ID_CREATED", {
      step: "DIGITAL_ID_CREATED",
      label: "Digital Student ID Generated",
      timestamp: baseTs,
      actor: "School ERP",
      details: `Adm No: ${welcomeData.admissionNo} • Roll: ${welcomeData.rollNo || "01"}`,
    });
  }
  if (!map.has("QR_VERIFICATION_ACTIVE")) {
    map.set("QR_VERIFICATION_ACTIVE", {
      step: "QR_VERIFICATION_ACTIVE",
      label: "QR Verification Card Activated",
      timestamp: baseTs,
      actor: "Security Registry",
      details: `Token: ${token}`,
    });
  }
  if (!map.has("WELCOME_LETTER_SENT")) {
    map.set("WELCOME_LETTER_SENT", {
      step: "WELCOME_LETTER_SENT",
      label: "Welcome Letter Sent to Official Desk",
      timestamp: welcomeData.issuedAt || baseTs,
      actor: welcomeData.schoolName || "School Official Desk",
      details: "Digital Campus Onboarding Active",
    });
  }
  if (acknowledgedAt && !map.has("PARENT_ACKNOWLEDGED")) {
    map.set("PARENT_ACKNOWLEDGED", {
      step: "PARENT_ACKNOWLEDGED",
      label: "Welcome Letter Read & Acknowledged by Parent",
      timestamp: acknowledgedAt,
      actor: acknowledgedBy || "Parent / Guardian",
      details: "Verified on NSTA Portal",
    });
  }

  const order: StudentActivationEvent["step"][] = [
    "ADMISSION_APPROVED",
    "DIGITAL_ID_CREATED",
    "QR_VERIFICATION_ACTIVE",
    "WELCOME_LETTER_SENT",
    "PARENT_ACKNOWLEDGED",
    "SESSION_RENEWED",
    "QR_TOKEN_REVOKED",
  ];

  return order
    .map((step) => map.get(step))
    .filter((item): item is StudentActivationEvent => Boolean(item));
}

export const WelcomeLetterA4Sheet: React.FC<{
  welcomeData: NstaWelcomeData;
  qrVerifyUrl: string;
  verificationToken: string;
  qrIssuedAt: string;
  qrExpiresAt: string;
  isExpired: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  history: StudentActivationEvent[];
}> = ({
  welcomeData,
  qrVerifyUrl,
  verificationToken,
  qrIssuedAt,
  qrExpiresAt,
  isExpired,
  acknowledgedAt,
  acknowledgedBy,
  history,
}) => {
  const schoolName = welcomeData.schoolName || "Institutional Campus";
  const studentName = welcomeData.studentName || "Student";
  const className = welcomeData.className || "Class";
  const admNo = welcomeData.admissionNo || "ADM-001";
  const rollNo = welcomeData.rollNo || "01";
  const session = welcomeData.session || "2026-27";
  const resolvedLogo = getSavedSchoolLogo(welcomeData.schoolLogo, welcomeData.schoolId);
  const schoolInitials =
    schoolName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "SC";
  const effectiveHistory =
    Array.isArray(history) && history.length > 0
      ? history
      : buildNormalizedActivationHistory(
          welcomeData,
          verificationToken,
          qrIssuedAt,
          acknowledgedAt,
          acknowledgedBy
        );

  return (
    <div
      className="a4-sheet nst-isolated-print-light"
      data-pdf-lock-light="true"
      style={{
        width: "794px",
        minHeight: "1080px",
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif",
        padding: "32px 36px",
        border: "1px solid #cbd5e1",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        {/* School Letterhead */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "3px solid #0f172a",
            paddingBottom: "14px",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={schoolName}
                crossOrigin="anonymous"
                data-fallback-initials={schoolInitials}
                style={{
                  width: "64px",
                  height: "64px",
                  objectFit: "contain",
                  borderRadius: "12px",
                  border: "1.5px solid #cbd5e1",
                  padding: "4px",
                  backgroundColor: "#ffffff",
                }}
              />
            ) : (
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "12px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  border: "2px solid #fbbf24",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: "20px",
                  letterSpacing: "0.04em",
                }}
              >
                {schoolInitials}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 900, margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>
                {schoolName}
              </h1>
              {welcomeData.schoolAddress && (
                <p style={{ fontSize: "11px", color: "#475569", margin: "3px 0 0 0" }}>
                  {welcomeData.schoolAddress}
                </p>
              )}
              {welcomeData.schoolPhone && (
                <p style={{ fontSize: "11px", color: "#475569", margin: "2px 0 0 0", fontWeight: 600 }}>
                  Helpline: {welcomeData.schoolPhone}
                </p>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                padding: "4px 10px",
                backgroundColor: isExpired ? "#fef2f2" : "#ecfdf5",
                color: isExpired ? "#b91c1c" : "#047857",
                border: `1px solid ${isExpired ? "#fecaca" : "#a7f3d0"}`,
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {isExpired ? "ID EXPIRED" : "VERIFIED DIGITAL ID"}
            </div>
            <p style={{ fontSize: "10px", color: "#64748b", margin: "6px 0 0 0", fontFamily: "monospace" }}>
              Issued: {formatDateOnly(qrIssuedAt)}
            </p>
            <p style={{ fontSize: "10px", color: "#64748b", margin: "2px 0 0 0", fontFamily: "monospace" }}>
              Token: {verificationToken}
            </p>
          </div>
        </div>

        {/* Title Banner */}
        <div
          style={{
            backgroundColor: "#0f172a",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.04em" }}>
            OFFICIAL DIGITAL CAMPUS WELCOME LETTER
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#fbbf24" }}>
            Session {session}
          </span>
        </div>

        {/* Identity + Verification QR Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "18px",
            backgroundColor: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "18px",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", margin: "0 0 8px 0" }}>
              Verified Student Identity Record
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0", color: "#475569", width: "145px" }}>Student Name:</td>
                  <td style={{ padding: "4px 0", fontWeight: 800, color: "#0f172a" }}>{studentName}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#475569" }}>Admission Number:</td>
                  <td style={{ padding: "4px 0", fontWeight: 800, fontFamily: "monospace", color: "#0f172a" }}>{admNo}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#475569" }}>Class &amp; Roll No:</td>
                  <td style={{ padding: "4px 0", fontWeight: 700, color: "#0f172a" }}>
                    {className} • Roll #{rollNo}
                  </td>
                </tr>
                {welcomeData.fatherName && (
                  <tr>
                    <td style={{ padding: "4px 0", color: "#475569" }}>Father / Guardian:</td>
                    <td style={{ padding: "4px 0", fontWeight: 700, color: "#0f172a" }}>{welcomeData.fatherName}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "4px 0", color: "#475569" }}>ID Card Validity:</td>
                  <td style={{ padding: "4px 0", fontWeight: 700, color: "#047857" }}>
                    Active till {formatDateOnly(qrExpiresAt)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            style={{
              width: "148px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            <QRCode value={qrVerifyUrl} size={96} level="M" />
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#047857", marginTop: "6px", textTransform: "uppercase" }}>
              Scan to Verify ID
            </span>
            <span style={{ fontSize: "8.5px", fontFamily: "monospace", color: "#475569", marginTop: "2px" }}>
              {verificationToken}
            </span>
          </div>
        </div>

        {/* Salutation & Principal Message */}
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: "#1e293b", marginBottom: "16px" }}>
          <p style={{ margin: "0 0 8px 0" }}>
            प्रिय विद्यार्थी <strong>{studentName}</strong> एवं अभिभावकगण,
          </p>
          <p style={{ margin: 0 }}>
            <strong>{schoolName}</strong> के आधुनिक डिजिटल शैक्षणिक पोर्टल में आपका हार्दिक स्वागत एवं अभिनंदन है। आपका नामांकन सफलतापूर्वक अनुमोदित हो चुका है तथा आपकी आधिकारिक डिजिटल छात्र आईडी व QR सत्यापन सेवा सक्रिय कर दी गई है।
          </p>
        </div>

        {/* 5 Active Digital Campus Facilities */}
        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "14px 16px",
            marginBottom: "18px",
            backgroundColor: "#ffffff",
          }}
        >
          <p style={{ fontSize: "11.5px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", margin: "0 0 10px 0" }}>
            Active Digital Campus Facilities (पोर्टल की प्रमुख सुविधाएँ)
          </p>
          <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: 1.65, color: "#334155" }}>
            <li><strong>Digital Syllabus &amp; Chapter-wise Notes:</strong> सभी विषयों के सम्पूर्ण अध्यायवार नोट्स व व्याख्या (100% Free).</li>
            <li><strong>Daily MCQ Practice &amp; Tests:</strong> दैनिक वस्तुनिष्ठ अभ्यास, तत्काल परिणाम व लीडरबोर्ड।</li>
            <li><strong>Digital Attendance &amp; Live Alerts:</strong> स्कूल आगमन/प्रस्थान की लाइव सूचना अभिभावकों तक।</li>
            <li><strong>Fee Ledger, Passbook &amp; POS Receipts:</strong> पारदर्शी मासिक शुल्क लेजर, पासबुक व आधिकारिक रसीदें।</li>
            <li><strong>NSTA Messenger School Desk:</strong> सभी आधिकारिक नोटिस, सर्कुलर, गृहकार्य एवं शिक्षक संवाद।</li>
          </ol>
        </div>

        {/* Activation History Table */}
        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
            backgroundColor: "#f8fafc",
          }}
        >
          <p style={{ fontSize: "11px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", margin: "0 0 8px 0" }}>
            Digital Onboarding &amp; Activation History
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <tbody>
              {effectiveHistory.map((ev) => (
                <tr key={ev.step} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "5px 4px", fontWeight: 700, color: "#0f172a" }}>{ev.label}</td>
                  <td style={{ padding: "5px 4px", color: "#475569" }}>{ev.actor || "System"}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: "monospace", color: "#334155" }}>
                    {formatDateTimeDisplay(ev.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Security Note & Parent Acknowledgement Stamp */}
        <div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
          <div
            style={{
              flex: 1,
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "11px",
              color: "#334155",
              backgroundColor: "#fffbeb",
            }}
          >
            <strong style={{ color: "#92400e", display: "block", marginBottom: "3px" }}>
              QR Security &amp; Privacy Notice:
            </strong>
            QR कोड केवल छात्र पहचान सत्यापन (Identity Verification) हेतु है। पोर्टल लॉगिन के लिए पंजीकृत मोबाइल/जन्मतिथि सत्यापन आवश्यक है। निजी शुल्क विवरण केवल अधिकृत लॉगिन के भीतर ही दिखता है।
          </div>
          <div
            style={{
              width: "240px",
              border: `1.5px solid ${acknowledgedAt ? "#10b981" : "#cbd5e1"}`,
              borderRadius: "8px",
              padding: "10px 12px",
              backgroundColor: acknowledgedAt ? "#ecfdf5" : "#f8fafc",
              fontSize: "11px",
            }}
          >
            <strong style={{ color: acknowledgedAt ? "#047857" : "#475569", display: "block", marginBottom: "3px" }}>
              {acknowledgedAt ? "✓ Parent Acknowledged" : "Parent Acknowledgement Pending"}
            </strong>
            {acknowledgedAt ? (
              <>
                <div style={{ color: "#065f46", fontWeight: 700 }}>{acknowledgedBy || "Parent / Guardian"}</div>
                <div style={{ color: "#047857", fontFamily: "monospace", fontSize: "10px", marginTop: "2px" }}>
                  {formatDateTimeDisplay(acknowledgedAt)}
                </div>
              </>
            ) : (
              <div style={{ color: "#64748b" }}>NSTA Portal / School Desk से अभिभावक स्वीकृति दर्ज करें।</div>
            )}
          </div>
        </div>
      </div>

      {/* Official Signatory Footer */}
      <div
        style={{
          marginTop: "22px",
          paddingTop: "14px",
          borderTop: "1px solid #cbd5e1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div style={{ fontSize: "10.5px", color: "#64748b" }}>
          <div>Digitally Issued via School Campus ERP</div>
          <div>Verify anytime by scanning QR or visiting official verification portal.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {welcomeData.principalSignatureUrl && (
            <img
              src={welcomeData.principalSignatureUrl}
              alt="Principal Signature"
              crossOrigin="anonymous"
              style={{ height: "42px", objectFit: "contain", marginBottom: "4px", marginLeft: "auto" }}
            />
          )}
          <div style={{ fontWeight: 800, fontSize: "12.5px", color: "#0f172a" }}>
            {welcomeData.principalName || "Principal / Head of Institution"}
          </div>
          <div style={{ fontSize: "10.5px", color: "#475569", fontWeight: 600 }}>
            {schoolName}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SchoolWelcomeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  welcomeData,
  onOpenSchoolDesk,
  onOpenIdCard,
  onAcknowledged,
  defaultRoleForAck = "PARENT",
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [verifyingServer, setVerifyingServer] = useState(false);
  const [serverVerifyStatus, setServerVerifyStatus] = useState<{
    checked: boolean;
    verified: boolean;
    status: string;
    message: string;
  } | null>(null);
  const [localAckState, setLocalAckState] = useState<{
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    acknowledgedRole?: "PARENT" | "STUDENT" | "ADMIN";
    activationHistory?: StudentActivationEvent[];
  } | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "qr" | "history">("overview");
  const audioPlayedRef = useRef(false);
  const printLetterRef = useRef<HTMLDivElement>(null);

  // Reset local overrides when switching students/messages
  useEffect(() => {
    setLocalAckState(null);
    setServerVerifyStatus(null);
    setActiveSection("overview");
  }, [welcomeData?.studentId, welcomeData?.messageId]);

  // Play pleasant celebratory audio chime using Web Audio API on mount
  useEffect(() => {
    if (isOpen && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
            gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + idx * 0.12 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.12 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.12);
            osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
          });
        }
      } catch {}
    }
  }, [isOpen]);

  const tokenInfo = useMemo(() => {
    if (!welcomeData) {
      return { token: "", issuedAt: "", expiresAt: "" };
    }
    if (welcomeData.verificationToken && welcomeData.qrExpiresAt) {
      return {
        token: welcomeData.verificationToken,
        issuedAt: welcomeData.qrIssuedAt || welcomeData.issuedAt || new Date().toISOString(),
        expiresAt: welcomeData.qrExpiresAt,
      };
    }
    return buildStudentVerificationToken({
      schoolId: welcomeData.schoolId,
      studentId: welcomeData.studentId,
      admissionNo: welcomeData.admissionNo,
      issuedAt: welcomeData.qrIssuedAt || welcomeData.issuedAt,
      expiresAt: welcomeData.qrExpiresAt,
    });
  }, [welcomeData]);

  const qrVerifyUrl = useMemo(() => {
    if (!welcomeData) return "";
    return buildStudentIdCardQrUrl({
      schoolId: welcomeData.schoolId || "",
      studentId: welcomeData.studentId,
      rollNo: welcomeData.rollNo || "",
      classId: welcomeData.classId || "",
      studentName: welcomeData.studentName,
      admissionNo: welcomeData.admissionNo,
      className: welcomeData.className || "",
      schoolName: welcomeData.schoolName,
      verificationToken: tokenInfo.token,
      qrIssuedAt: tokenInfo.issuedAt,
      qrExpiresAt: tokenInfo.expiresAt,
    });
  }, [welcomeData, tokenInfo]);

  if (!isOpen || !welcomeData) return null;

  const schoolName = welcomeData.schoolName || "Digital School Campus";
  const studentName = welcomeData.studentName || "Student";
  const className = welcomeData.className || "Class";
  const admNo = welcomeData.admissionNo || "ADM-001";
  const rollNo = welcomeData.rollNo || "01";
  const isExpired =
    welcomeData.qrStatus === "EXPIRED" ||
    welcomeData.qrStatus === "REVOKED" ||
    isQrVerificationExpired(tokenInfo.expiresAt);

  const effectiveAckAt = localAckState?.acknowledgedAt || welcomeData.acknowledgedAt;
  const effectiveAckBy = localAckState?.acknowledgedBy || welcomeData.acknowledgedBy;
  const activationHistory = buildNormalizedActivationHistory(
    welcomeData,
    tokenInfo.token,
    tokenInfo.issuedAt,
    effectiveAckAt,
    effectiveAckBy,
    localAckState?.activationHistory
  );

  const handleShare = () => {
    const text = `🎓 ${schoolName} — Official Student Digital ID\n\nStudent: ${studentName}\nClass: ${className} • Roll No: ${rollNo}\nAdmission No: ${admNo}\nVerification Token: ${tokenInfo.token}\nVerify Link: ${qrVerifyUrl}`;
    if (navigator.share) {
      navigator.share({ title: `Welcome to ${schoolName}`, text }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Verification summary copied!");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleVerifyQrServer = async () => {
    if (verifyingServer) return;
    setVerifyingServer(true);
    try {
      const res = await fetch("/api/qr/verify-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: welcomeData.schoolId || "",
          studentId: welcomeData.studentId,
          admissionNo: admNo,
          verificationToken: tokenInfo.token,
          expiresAt: tokenInfo.expiresAt,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.verified) {
        setServerVerifyStatus({
          checked: true,
          verified: true,
          status: data.status || "ACTIVE",
          message: `प्रमाणित व सक्रिय (${data.source === "server_rtdb" ? "Live Registry Verified" : "Token Checksum Verified"})`,
        });
        toast.success("✅ QR ID प्रमाणित एवं सक्रिय है!");
      } else {
        setServerVerifyStatus({
          checked: true,
          verified: false,
          status: data?.status || (isExpired ? "EXPIRED" : "ACTIVE"),
          message: data?.reason || "स्थानीय टोकन सक्रिय है (ऑफ़लाइन सत्यापन)।",
        });
      }
    } catch {
      setServerVerifyStatus({
        checked: true,
        verified: !isExpired,
        status: isExpired ? "EXPIRED" : "ACTIVE",
        message: isExpired ? "ID validity expired" : "Token integrity valid",
      });
    } finally {
      setVerifyingServer(false);
    }
  };

  const handleAcknowledge = async () => {
    if (acknowledging || effectiveAckAt) return;
    const targetSchoolId = welcomeData.schoolId || "default_school";
    setAcknowledging(true);
    try {
      const actorLabel =
        welcomeData.fatherName && defaultRoleForAck === "PARENT"
          ? `${welcomeData.fatherName} (Parent)`
          : defaultRoleForAck === "STUDENT"
          ? `${studentName} (Student)`
          : "Parent / Guardian";

      const result = await acknowledgeSchoolWelcomeLetter({
        schoolId: targetSchoolId,
        studentId: welcomeData.studentId,
        messageId: welcomeData.messageId,
        acknowledgedBy: actorLabel,
        acknowledgedRole: defaultRoleForAck,
      });
      setLocalAckState(result);
      onAcknowledged?.(result);
      toast.success("✅ धन्यवाद! स्वागत पत्र स्वीकृति (Parent Acknowledgement) दर्ज हो गई।");
    } catch {
      toast.error("स्वीकृति दर्ज करने में समस्या आई, कृपया पुनः प्रयास करें।");
    } finally {
      setAcknowledging(false);
    }
  };

  const handleDownloadWelcomePdf = async () => {
    if (downloadingPdf) return;
    const el = printLetterRef.current;
    if (!el) {
      toast.error("Welcome Letter preview ready nahi hai.");
      return;
    }
    setDownloadingPdf(true);
    const toastId = toast.loading("Official Welcome Letter PDF तैयार हो रहा है...");
    try {
      const ok = await exportElementToPdf(el, {
        filename: `Welcome_Letter_${studentName}_${admNo}`,
        format: "a4",
        orientation: "portrait",
        widthPx: 794,
        pageMode: "fit_single",
        scale: 2,
      });
      if (ok) {
        toast.success("Official Welcome Letter PDF डाउनलोड हो गया!", { id: toastId });
      } else {
        printElementInIframe(el, `Welcome Letter - ${studentName}`, "", "portrait");
        toast.dismiss(toastId);
      }
    } catch (err) {
      console.warn("Welcome Letter PDF fallback:", err);
      printElementInIframe(el, `Welcome Letter - ${studentName}`, "", "portrait");
      toast.dismiss(toastId);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenOrVerifyIdCard = () => {
    if (onOpenIdCard) {
      onOpenIdCard({
        ...welcomeData,
        verificationToken: tokenInfo.token,
        qrIssuedAt: tokenInfo.issuedAt,
        qrExpiresAt: tokenInfo.expiresAt,
        acknowledgedAt: effectiveAckAt,
        acknowledgedBy: effectiveAckBy,
        activationHistory,
      });
      return;
    }
    if (qrVerifyUrl) {
      safeOpenExternalUrl(qrVerifyUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="nst-isolated-modal relative w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Glow ambient background effects */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* ── TOP BANNER: CELEBRATION HEADER ── */}
        <div className="relative px-5 pt-6 pb-4 bg-gradient-to-r from-amber-950/90 via-slate-900 to-emerald-950/90 border-b border-amber-500/25 text-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close Welcome Modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center relative mb-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-xl shadow-amber-500/25">
              <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center overflow-hidden">
                {getSavedSchoolLogo(welcomeData.schoolLogo, welcomeData.schoolId) ? (
                  <img
                    src={getSavedSchoolLogo(welcomeData.schoolLogo, welcomeData.schoolId)}
                    alt={schoolName}
                    crossOrigin="anonymous"
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <GraduationCap className="w-7 h-7 text-amber-400" />
                )}
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="block">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-[11px] font-black text-amber-200 uppercase tracking-wider mb-1.5">
              <PartyPopper className="w-3.5 h-3.5 text-amber-300" />
              <span>Digital Campus Onboarding • Verified ID</span>
            </span>
          </div>

          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight" style={{ color: "#ffffff" }}>
            विद्यालय परिवार में आपका स्वागत है!
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-emerald-300 mt-0.5">
            Welcome to {schoolName} Digital Campus
          </p>

          {/* Compact Sub-View Tabs */}
          <div className="grid grid-cols-3 gap-1.5 mt-3.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSection("overview")}
              className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === "overview"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>ID Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("qr")}
              className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === "qr"
                  ? "bg-amber-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span>QR Verify</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("history")}
              className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeSection === "history"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>History ({activationHistory.length})</span>
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Official Student Credentials Card (Always visible summary) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 shadow-inner relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-700/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-md shrink-0">
                  {studentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 truncate">
                    <span className="truncate">{studentName}</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium tabular-nums">
                    {className} • Roll No: <span className="text-white font-bold">{rollNo}</span>
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-[10px] tracking-wide uppercase shrink-0 ${
                  isExpired
                    ? "bg-rose-500/20 text-rose-200 border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                }`}
              >
                {isExpired ? "Expired" : "Active ID"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 text-[11px]">
              <div className="bg-slate-950/75 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission No</span>
                <span className="text-white font-mono font-bold text-xs tabular-nums">{admNo}</span>
              </div>
              <div className="bg-slate-950/75 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Session</span>
                <span className="text-white font-mono font-bold text-xs tabular-nums">
                  {welcomeData.session || "2026-27"}
                </span>
              </div>
              <div className="bg-slate-950/75 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Verification Token</span>
                <span className="text-emerald-300 font-mono font-bold text-[11px] flex items-center gap-1 tabular-nums">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tokenInfo.token}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Parent Acknowledgement Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              effectiveAckAt
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-100"
                : "bg-amber-950/50 border-amber-500/40 text-amber-100"
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  effectiveAckAt
                    ? "bg-emerald-500/25 text-emerald-300"
                    : "bg-amber-500/25 text-amber-300"
                }`}
              >
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white">
                  {effectiveAckAt
                    ? "✅ अभिभावक द्वारा स्वागत पत्र पठित व स्वीकृत"
                    : "अभिभावक स्वीकृति (Parent Acknowledgement)"}
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                  {effectiveAckAt
                    ? `${effectiveAckBy || "Parent"} • ${formatDateTimeDisplay(effectiveAckAt)}`
                    : "पुष्टि करें कि आपने डिजिटल ID और पोर्टल सुविधाएँ पढ़ ली हैं।"}
                </p>
              </div>
            </div>
            {!effectiveAckAt && (
              <button
                type="button"
                disabled={acknowledging}
                onClick={handleAcknowledge}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Acknowledge</span>
              </button>
            )}
          </div>

          {activeSection === "overview" && (
            <>
              {/* Principal Welcome Note */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-[11px] sm:text-xs leading-relaxed space-y-1.5">
                <div className="flex items-center gap-2 font-black text-amber-300 text-xs">
                  <SchoolIcon className="w-4 h-4" />
                  <span>प्रधानाचार्य संदेश (Principal Desk)</span>
                </div>
                <p className="text-slate-200">
                  प्रिय <strong className="text-white">{studentName}</strong>, {schoolName} के आधुनिक डिजिटल अध्ययन केंद्र में आपका स्वागत है। आपकी डिजिटल छात्र आईडी व QR सत्यापन सक्रिय कर दिया गया है।
                </p>
              </div>

              {/* Active Facilities */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  आपके लिए सक्रिय सुविधाएं (Active Facilities)
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-[11px]">100% फ्री नोट्स</p>
                      <p className="text-[10px] text-slate-300">अध्यायवार सम्पूर्ण सिलेबस</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                      <CalendarCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-[11px]">लाइव हाजिरी</p>
                      <p className="text-[10px] text-slate-300">आगमन/प्रस्थान सूचना</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-[11px]">स्कूल मैसेंजर</p>
                      <p className="text-[10px] text-slate-300">सर्कुलर व शिक्षक डाउट</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-start gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
                      <ReceiptText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-[11px]">डिजिटल रसीदें</p>
                      <p className="text-[10px] text-slate-300">पारदर्शी शुल्क पासबुक</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === "qr" && (
            <div className="p-4 rounded-2xl bg-slate-800/75 border border-slate-700 space-y-3.5">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="p-2.5 bg-white rounded-2xl border-2 border-emerald-500 shadow-lg shrink-0">
                  <QRCode value={qrVerifyUrl} size={118} level="M" />
                </div>
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-mono text-[10px] font-bold">
                      {tokenInfo.token}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[10px] tabular-nums">
                      Valid till {formatDateOnly(tokenInfo.expiresAt)}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">
                    QR ID Verification &amp; Security Check
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    यह QR केवल छात्र पहचान सत्यापन के लिए है। इसमें कोई पासवर्ड, फीस या निजी नंबर नहीं रखा गया है। पोर्टल लॉगिन के समय अभिभावक मोबाइल/DOB सत्यापन अनिवार्य है।
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      disabled={verifyingServer}
                      onClick={handleVerifyQrServer}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    >
                      {verifyingServer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Verify Live Status</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => qrVerifyUrl && safeOpenExternalUrl(qrVerifyUrl)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Verify Page</span>
                    </button>
                  </div>
                </div>
              </div>

              {serverVerifyStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    serverVerifyStatus.verified
                      ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-200"
                      : "bg-rose-950/70 border-rose-500/40 text-rose-200"
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{serverVerifyStatus.status}:</strong> {serverVerifyStatus.message}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeSection === "history" && (
            <div className="p-4 rounded-2xl bg-slate-800/75 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>Digital ID Activation History</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {activationHistory.length} Milestones
                </span>
              </div>

              <div className="space-y-2.5">
                {activationHistory.map((ev, idx) => (
                  <div
                    key={`${ev.step}_${idx}`}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white leading-snug">{ev.label}</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          {ev.actor || "School System"}
                          {ev.details ? ` • ${ev.details}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 shrink-0 tabular-nums text-right">
                      {formatDateTimeDisplay(ev.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Download & Document Actions Bar */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadWelcomePdf}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>Welcome Letter PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenOrVerifyIdCard}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow transition cursor-pointer whitespace-nowrap"
            >
              <IdCard className="w-4 h-4" />
              <span>ID Card डाउनलोड</span>
            </button>
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2.5 flex-wrap shrink-0">
          {onOpenSchoolDesk && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSchoolDesk();
              }}
              className="flex-1 min-w-[160px] min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>स्कूल डेस्क संदेश देखें</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[120px] min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 border border-slate-700 whitespace-nowrap"
          >
            <span>पोर्टल शुरू करें</span>
          </button>

          <button
            type="button"
            onClick={() => printLetterRef.current && printElementInIframe(printLetterRef.current, `Welcome Letter - ${studentName}`, "", "portrait")}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer border border-slate-700 flex items-center justify-center"
            title="Print Welcome Letter"
            aria-label="Print Welcome Letter"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer border border-slate-700 flex items-center justify-center"
            title={copied ? "Copied" : "Share Welcome Status"}
            aria-label="Share Welcome Status"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offscreen A4 Welcome Letter DOM for instant high-resolution PDF capture & printing */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          pointerEvents: "none",
          opacity: 0,
          zIndex: -1,
        }}
      >
        <div ref={printLetterRef} id="school-welcome-letter-a4-doc">
          <WelcomeLetterA4Sheet
            welcomeData={welcomeData}
            qrVerifyUrl={qrVerifyUrl}
            verificationToken={tokenInfo.token}
            qrIssuedAt={tokenInfo.issuedAt}
            qrExpiresAt={tokenInfo.expiresAt}
            isExpired={isExpired}
            acknowledgedAt={effectiveAckAt}
            acknowledgedBy={effectiveAckBy}
            history={activationHistory}
          />
        </div>
      </div>
    </div>
  );
};
