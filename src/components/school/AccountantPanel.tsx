// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import AndroidBatteryIndicator from "../AndroidBatteryIndicator";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import {
  IndianRupee,
  Receipt,
  Users,
  Search,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  UserPlus,
  Bus,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Plus,
  ChevronLeft,
  RefreshCw,
  Sliders,
  DollarSign,
  Share2,
  CreditCard,
  QrCode,
  Lock,
  RotateCw,
  LogOut,
  Building2,
  Phone,
  MessageCircle,
  Briefcase,
  X,
  Clock,
  BookOpen,
  Check,
  Percent,
  Wallet,
  Home,
  UserX,
  CalendarDays,
  PhoneCall,
  Sparkles,
  Laptop,
  Smartphone,
  Bell,
  RotateCcw,
  Menu,
  MessageSquare,
  Send,
  Loader2,
  CalendarClock
} from "lucide-react";
import { rotateToLandscape, rotateToPortrait, setDesktopMode, useDeviceOrientation } from "../../utils/displayPrefs";
import type {
  School,
  SchoolStudent,
  SchoolClass,
  SchoolSession,
  MonthlyFee,
  SchoolAccountant,
  AccountantPermissions,
  SchoolExpenseVoucher,
  AdmissionApplication,
  StoreSaleRecord
} from "../../school-types";
import {
  getSchool,
  getClasses,
  getSessions,
  getStudents,
  getMonthlyFees,
  getSchoolFeeHistory,
  saveFee,
  currentMonthStr,
  getAccountants,
  saveAccountant,
  getSchoolExpenseVouchers,
  saveSchoolExpenseVoucher,
  deleteSchoolExpenseVoucher,
  getAdmissions,
  saveStudent,
  updateStudent,
  getAttendance,
  todayStr as getTodayDateStr,
  getTeachers,
  isDemoSessionId,
  isDemoRecord,
  autoSendFeeSlipToSchoolDesk
} from "../../school-firebase";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { DEMO_SESSION_ID, setDemoDataEnabled } from "./demoDataStore";
import { loadMergedStoreSales } from "../../utils/schoolCloudSync";
import { computePaymentBreakdown } from "../../utils/paymentBreakdown";
import { toast } from "sonner";
import { FeeManager } from "./FeeManager";
import { OnlineAdmissionManager } from "./OnlineAdmissionManager";
import { AbsenteeActionPage } from "./AbsenteeActionPage";
import { SiblingProfileManager } from "./SiblingProfileManager";
import { NstaMessengerSuite } from "./NstaMessengerSuite";
import { ReceiptCancellationModal } from "./ReceiptCancellationModal";
import { RazorpaySettingsModal } from "./RazorpaySettingsModal";
import { StudentReAdmissionManager } from "./StudentReAdmissionManager";
import { printHtmlInIframe } from "./AdmissionFormPrintModal";
import { TeacherRulesRegulationsView } from "./TeacherRulesRegulationsView";
import { resolveAccountantPermissions } from "../../utils/schoolRolePermissions";
import {
  printPosSlipDirect,
  printA6SlipDirect,
  printDpsReceiptDirect,
  cleanLogoUrl,
  getSavedSchoolLogo
} from "./feeReceiptUtils";

interface Props {
  schoolId: string;
  accountantId?: string;
  onBack?: () => void;
  onLogout?: () => void;
  onOpenPlatformContent?: () => void;
}

type AccountantTab =
  | "home"
  | "counter"
  | "absentee"
  | "fee_collection"
  | "sibling_profiles"
  | "admissions"
  | "readmission"
  | "dues_defaulters"
  | "daybook"
  | "expenses"
  | "bus_fees"
  | "qr_pay"
  | "fee_alerts"
  | "class_rates"
  | "term_scheduler"
  | "receipt_header"
  | "receipt_cancellation"
  | "razorpay_setup"
  | "messenger"
  | "rules_regulations";

const DEFAULT_PERMISSIONS: AccountantPermissions = {
  canCollectFee: true,
  canAdmitStudents: true,
  canGrantDiscount: true,
  maxDiscountLimitPct: 10,
  canRecordExpenses: true,
  canViewDayBook: true,
  canSendFeeAlerts: true,
  canManageBusFee: true,
  canPrintIdCards: true,
  canManageAbsentee: true,
  canCancelReceipts: false,
  canEditFeeStructure: false,
};

export const AccountantPanel: React.FC<Props> = ({
  schoolId,
  accountantId,
  onBack,
  onLogout,
  onOpenPlatformContent
}) => {
  const handleExploreFullApp = () => {
    if (!onOpenPlatformContent && !onBack) return;
    if (onOpenPlatformContent) {
      try {
        localStorage.setItem("nst_app_view_mode", "STUDENT");
        window.dispatchEvent(new CustomEvent("nst_open_student_dashboard"));
      } catch {}
      onOpenPlatformContent();
    } else if (onBack) {
      onBack();
    }
  };

  const [activeTab, setActiveTab] = useState<AccountantTab>("home");
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allClasses, setAllClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<SchoolSession[]>([]);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [allStudents, setAllStudents] = useState<SchoolStudent[]>([]);
  const [fees, setFees] = useState<MonthlyFee[]>([]);
  const [allHistoryFees, setAllHistoryFees] = useState<MonthlyFee[]>([]);
  const [storeSales, setStoreSales] = useState<StoreSaleRecord[]>([]);
  const [expenses, setExpenses] = useState<SchoolExpenseVoucher[]>([]);
  const [accountants, setAccountants] = useState<SchoolAccountant[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [activeAccountant, setActiveAccountant] = useState<SchoolAccountant | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<{
    presentCount: number;
    absentCount: number;
    totalMarked: number;
    attendancePct: number;
  }>({
    presentCount: 0,
    absentCount: 0,
    totalMarked: 0,
    attendancePct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sendingNstaSlipId, setSendingNstaSlipId] = useState<string | null>(null);
  const [sentNstaSlipIds, setSentNstaSlipIds] = useState<Record<string, boolean>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [appTheme, setAppTheme] = useState<"current" | "white" | "black">(() => {
    try {
      const saved = (localStorage.getItem("nst_app_theme") || localStorage.getItem("nst_student_theme")) as any;
      if (saved === "white" || saved === "black" || saved === "current") return saved;
    } catch {}
    return "current";
  });

  useEffect(() => {
    const syncTheme = () => {
      try {
        const saved = (localStorage.getItem("nst_app_theme") || localStorage.getItem("nst_student_theme")) as any;
        if (saved === "white" || saved === "black" || saved === "current") {
          setAppTheme(saved);
        }
      } catch {}
    };
    window.addEventListener("nst-dark-theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("nst-dark-theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  useEffect(() => {
    const handleStudentUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.student?.id && (!detail.schoolId || detail.schoolId === schoolId)) {
        const updated: SchoolStudent = detail.student;
        setStudents((prev) =>
          prev.some((s) => s.id === updated.id)
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : [updated, ...prev]
        );
        setAllStudents((prev) =>
          prev.some((s) => s.id === updated.id)
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : [updated, ...prev]
        );
      }
    };
    window.addEventListener("nsta:student-updated", handleStudentUpdated);
    return () => window.removeEventListener("nsta:student-updated", handleStudentUpdated);
  }, [schoolId]);

  // Quick Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState<{
    category: SchoolExpenseVoucher["category"];
    amount: number | "";
    paidTo: string;
    paymentMode: "Cash" | "UPI" | "Bank Transfer" | "Cheque";
    description: string;
  }>({
    category: "Stationery",
    amount: "",
    paidTo: "",
    paymentMode: "Cash",
    description: ""
  });

  // Fast Quick Collect modal state
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [selectedStudentForDues, setSelectedStudentForDues] = useState<SchoolStudent | null>(null);
  const [duesSettlementModal, setDuesSettlementModal] = useState<{
    student: SchoolStudent;
    type: "admission" | "advance";
    amount: string;
    mode: "Cash" | "UPI" | "Bank";
    saving: boolean;
  } | null>(null);

  // Continuous Device Orientation & Screen Width Hook
  const { isLandscape: isClientLandscape, isWideScreen } = useDeviceOrientation();
  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("accountant_desktop_mode") === "true";
    } catch {
      return false;
    }
  });
  const isEffectiveLandscape = isDesktopMode || isClientLandscape || isWideScreen;

  // Screen rotation helper
  const handleToggleOrientation = async () => {
    const next = !isEffectiveLandscape;
    setIsDesktopMode(next);
    try {
      localStorage.setItem("accountant_desktop_mode", next ? "true" : "false");
    } catch {}

    if (next) {
      await rotateToLandscape();
      setDesktopMode(true, false);
    } else {
      await rotateToPortrait();
      setDesktopMode(false, false);
    }
  };

  // Load core school and finance data
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      try {
        const [schData, sessData, expData, accData, tchData] = await Promise.all([
          getSchool(schoolId),
          getSessions(schoolId),
          getSchoolExpenseVouchers(schoolId),
          getAccountants(schoolId),
          getTeachers(schoolId)
        ]);

        const savedSessionId = typeof localStorage !== "undefined" ? localStorage.getItem(`nst_active_session_${schoolId}`) : null;
        const cleanSess = (sessData || []).filter((s: any) => s && s.id && s.name && !isDemoSessionId(s.id));
        const isSavedDemo = Boolean(savedSessionId && isDemoSessionId(savedSessionId));
        setDemoDataEnabled(isSavedDemo);
        const currentSess = isSavedDemo
          ? { id: DEMO_SESSION_ID, schoolId, name: "🧪 Demo Session (केवल डमी डेटा)", startDate: "2026-04-01", endDate: "2027-03-31", active: true, isDemo: true }
          : ((savedSessionId && cleanSess.find((s: any) => s.id === savedSessionId)) || cleanSess.find((s: any) => s.active) || cleanSess[0]);
        const targetSessionId = currentSess?.id;

        const [clsDataAll, stdDataAll, feeData, histFeeData, storeSalesData] = await Promise.all([
          getClasses(schoolId),
          getStudents(schoolId),
          getMonthlyFees(schoolId, currentMonthStr(), undefined, targetSessionId),
          getSchoolFeeHistory(schoolId, targetSessionId).catch(() => []),
          loadMergedStoreSales<StoreSaleRecord>(schoolId).catch(() => [])
        ]);
        const clsData = targetSessionId && !isDemoSessionId(targetSessionId)
          ? (clsDataAll || []).filter((c: any) => c.sessionId === targetSessionId)
          : (clsDataAll || []);
        const stdData = targetSessionId && !isDemoSessionId(targetSessionId)
          ? (stdDataAll || []).filter((s: any) => !s.sessionId || s.sessionId === targetSessionId)
          : (stdDataAll || []);

        if (!mounted) return;
        setSchool(schData);
        setAllClasses(clsDataAll || []);
        setClasses(targetSessionId && !isDemoSessionId(targetSessionId) ? (clsData || []).filter(c => c.sessionId === targetSessionId) : (clsData || []));
        setSessions(cleanSess);
        setAllStudents(stdDataAll || []);
        setStudents(isDemoSessionId(targetSessionId) ? (stdData || []) : (stdData || []).filter(s => !isDemoRecord(s) && (!targetSessionId || s.sessionId === targetSessionId)));
        setFees(isDemoSessionId(targetSessionId) ? (feeData || []) : (feeData || []).filter(f => !isDemoRecord(f)));
        setAllHistoryFees(Array.isArray(histFeeData) ? (isDemoSessionId(targetSessionId) ? histFeeData : histFeeData.filter(f => !isDemoRecord(f))) : []);
        setStoreSales(Array.isArray(storeSalesData) ? storeSalesData : []);
        setExpenses(expData || []);
        setAccountants(accData || []);
        setTeachers(tchData || []);

        // Load today's attendance summary across classes
        const todayDateStr = getTodayDateStr();
        const attTargetClasses = targetSessionId && !isDemoSessionId(targetSessionId) ? (clsData || []).filter(c => c.sessionId === targetSessionId) : (clsData || []);
        if (attTargetClasses && attTargetClasses.length > 0) {
          try {
            let pCount = 0;
            let aCount = 0;
            let tMarked = 0;
            const attResults = await Promise.allSettled(
              attTargetClasses.map(c => getAttendance(schoolId, c.id, todayDateStr))
            );
            attResults.forEach(res => {
              if (res.status === "fulfilled" && res.value?.students) {
                Object.values(res.value.students).forEach((s: any) => {
                  tMarked++;
                  if (s.present) pCount++;
                  else aCount++;
                });
              }
            });
            const pct = tMarked > 0 ? Math.round((pCount / tMarked) * 100) : 0;
            setAttendanceSummary({
              presentCount: pCount,
              absentCount: aCount,
              totalMarked: tMarked,
              attendancePct: pct,
            });
          } catch (attErr) {
            console.warn("[AccountantPanel] Failed loading attendance summary:", attErr);
          }
        }

        if (accData && accData.length > 0) {
          const found = accountantId ? accData.find(a => a.id === accountantId) : accData[0];
          setActiveAccountant(found || accData[0]);
        } else {
          // Fallback accountant profile
          const defaultAcc: SchoolAccountant = {
            id: accountantId || "acc_head_01",
            schoolId,
            name: "Head Accountant",
            phone: "",
            employeeId: "ACC-01",
            designation: "Senior School Accountant & Cashier",
            joinDate: "2026-04-01",
            active: true,
            permissions: DEFAULT_PERMISSIONS,
            createdAt: new Date().toISOString()
          };
          setActiveAccountant(defaultAcc);
        }
      } catch (err) {
        console.error("Failed to load accountant panel data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAll();
    return () => {
      mounted = false;
    };
  }, [schoolId, accountantId, refreshTrigger]);

  const permissions: AccountantPermissions = resolveAccountantPermissions(activeAccountant);

  // Active Session (respecting localStorage active session, including Demo Session)
  const activeSession = useMemo(() => {
    const savedSessionId = typeof localStorage !== "undefined" ? localStorage.getItem(`nst_active_session_${schoolId}`) : null;
    if (savedSessionId && isDemoSessionId(savedSessionId)) {
      return { id: DEMO_SESSION_ID, schoolId, name: "🧪 Demo Session (केवल डमी डेटा)", active: true, isDemo: true } as SchoolSession;
    }
    return (savedSessionId && sessions.find(s => s.id === savedSessionId)) || sessions.find(s => s.active) || sessions[0] || { id: "2026-27", name: "2026-27", active: true };
  }, [sessions, schoolId, refreshTrigger]);

  // Today's Date String YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // Today's Financial Summary (3-Channel: Cash / Online QR Code / NSTA Online across Fees + Store)
  const financialSummary = useMemo(() => {
    const feePool = allHistoryFees.length > 0 ? allHistoryFees : fees;
    const todayBreakdown = computePaymentBreakdown({
      fees: feePool,
      storeSales,
      datePrefix: todayStr,
    });
    const monthPrefix = todayStr.slice(0, 7);
    const monthBreakdown = computePaymentBreakdown({
      fees: feePool,
      storeSales,
      datePrefix: monthPrefix,
    });

    let monthPendingDues = 0;
    fees.forEach(f => {
      if (!f.paid) {
        monthPendingDues += Number(f.balanceDue !== undefined ? f.balanceDue : f.amount || 0);
      }
    });

    let todayExpenseCash = 0;
    let todayExpenseUpi = 0;
    let todayExpenseTotal = 0;

    expenses.forEach(e => {
      if (e.date && e.date.startsWith(todayStr)) {
        const amt = Number(e.amount || 0);
        todayExpenseTotal += amt;
        if (e.paymentMode === "Cash") {
          todayExpenseCash += amt;
        } else {
          todayExpenseUpi += amt;
        }
      }
    });

    const netCashInHand = todayBreakdown.cash - todayExpenseCash;

    return {
      todayCashFee: todayBreakdown.cash,
      todayQrFee: todayBreakdown.onlineQr,
      todayNstaOnlineFee: todayBreakdown.nstaOnline,
      todayUpiFee: todayBreakdown.onlineQr + todayBreakdown.nstaOnline,
      todayTotalFee: todayBreakdown.total,
      todayFeeOnlyTotal: todayBreakdown.feeTotal,
      todayStoreTotal: todayBreakdown.storeTotal,
      monthTotalFee: monthBreakdown.total,
      monthCash: monthBreakdown.cash,
      monthOnlineQr: monthBreakdown.onlineQr,
      monthNstaOnline: monthBreakdown.nstaOnline,
      monthPendingDues: monthPendingDues || 0,
      totalDuesAmount: monthPendingDues || 0,
      todayExpenseTotal: todayExpenseTotal || 0,
      todayExpenseCash: todayExpenseCash || 0,
      todayExpenseUpi: todayExpenseUpi || 0,
      netCashInHand: netCashInHand || 0,
    };
  }, [fees, allHistoryFees, storeSales, expenses, todayStr]);

  // Defaulters List - O(N) optimized with hash map lookups
  const defaultersList = useMemo(() => {
    const studentMap = new Map<string, SchoolStudent>();
    students.forEach(s => studentMap.set(s.id, s));

    const unpaidMap = new Map<string, { student: SchoolStudent; unpaidAmount: number; unpaidMonths: string[] }>();
    fees.forEach(f => {
      const isDue = !f.paid || (f.balanceDue !== undefined && Number(f.balanceDue) > 0);
      if (isDue) {
        const student = studentMap.get(f.studentId);
        if (student) {
          const due = f.balanceDue !== undefined ? Number(f.balanceDue) : Number(f.amount || 0);
          const existing = unpaidMap.get(f.studentId);
          if (existing) {
            existing.unpaidAmount += due;
            if (f.month && !existing.unpaidMonths.includes(f.month)) {
              existing.unpaidMonths.push(f.month);
            }
          } else {
            unpaidMap.set(f.studentId, {
              student,
              unpaidAmount: due,
              unpaidMonths: f.month ? [f.month] : []
            });
          }
        }
      }
    });
    // Include Re-Admission Back-Due & Admission Balance on defaulters list
    students.forEach(st => {
      const carryDue = Number(st.previousSessionDue || 0) + Number(st.admissionDueBalance || 0);
      if (carryDue > 0) {
        const existing = unpaidMap.get(st.id);
        const tag = Number(st.previousSessionDue || 0) > 0 ? "Back Session Due" : "Admission Due";
        if (existing) {
          existing.unpaidAmount += carryDue;
          if (!existing.unpaidMonths.includes(tag)) existing.unpaidMonths.unshift(tag);
        } else {
          unpaidMap.set(st.id, {
            student: st,
            unpaidAmount: carryDue,
            unpaidMonths: [tag]
          });
        }
      }
    });
    return Array.from(unpaidMap.values()).sort((a, b) => b.unpaidAmount - a.unpaidAmount);
  }, [students, fees]);

  // Handle adding expense voucher
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.amount || Number(newExpense.amount) <= 0 || !newExpense.paidTo.trim()) {
      toast.error("कृपया मान्य राशि व प्राप्तकर्ता का नाम दर्ज करें।");
      return;
    }

    try {
      const voucher: SchoolExpenseVoucher = {
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        schoolId,
        voucherNo: `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        date: todayStr,
        category: newExpense.category,
        amount: Number(newExpense.amount),
        paidTo: newExpense.paidTo.trim(),
        paymentMode: newExpense.paymentMode,
        recordedBy: activeAccountant?.name || "Accountant",
        description: newExpense.description.trim(),
        createdAt: new Date().toISOString()
      };

      await saveSchoolExpenseVoucher(voucher);
      setExpenses(prev => [voucher, ...prev]);
      setShowExpenseModal(false);
      setNewExpense({
        category: "Stationery",
        amount: "",
        paidTo: "",
        paymentMode: "Cash",
        description: ""
      });
      toast.success(`वाउचर #${voucher.voucherNo} सफलता पूर्वक सहेजा गया!`);
    } catch (err) {
      console.error("Expense save failed:", err);
      toast.error("वाउचर सुरक्षित करने में त्रुटि हुई। पुनः प्रयास करें।");
    }
  };

  // Quick print expense voucher (iframe-safe, never blocked by popup blockers)
  const handlePrintExpenseVoucher = (voucher: SchoolExpenseVoucher) => {
    const schoolLogo = getSavedSchoolLogo() || cleanLogoUrl(school?.logoUrl || "");
    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Expense Voucher - ${voucher.voucherNo}</title>
        <style>
          @page { size: A5 landscape; margin: 8mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 16px; color: #1e293b; background: #fff; }
          .voucher-box { border: 2px solid #0f172a; border-radius: 8px; padding: 20px; max-width: 600px; margin: auto; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          .school-name { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
          .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
          .title-tag { display: inline-block; background: #0f172a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-top: 8px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          .label { font-weight: 600; color: #64748b; }
          .val { font-weight: 700; color: #0f172a; }
          .amount-box { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 6px; text-align: center; margin: 16px 0; }
          .amount-val { font-size: 24px; font-weight: 900; color: #047857; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; border-top: 1px dashed #94a3b8; font-size: 12px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="voucher-box">
          <div class="header">
            ${schoolLogo ? `<img src="${schoolLogo}" style="height: 40px; margin-bottom: 4px;" />` : ""}
            <div class="school-name">${school?.name || "School"}</div>
            <div class="sub">${school?.address || "Official Payment Voucher"}</div>
            <div class="title-tag">DEBIT EXPENSE VOUCHER</div>
          </div>
          <div class="row">
            <div><span class="label">Voucher No:</span> <span class="val">${voucher.voucherNo}</span></div>
            <div><span class="label">Date:</span> <span class="val">${voucher.date}</span></div>
          </div>
          <div class="row">
            <div><span class="label">Paid To:</span> <span class="val">${voucher.paidTo}</span></div>
            <div><span class="label">Payment Mode:</span> <span class="val">${voucher.paymentMode}</span></div>
          </div>
          <div class="row">
            <div><span class="label">Category:</span> <span class="val">${voucher.category}</span></div>
            <div><span class="label">Prepared By:</span> <span class="val">${voucher.recordedBy}</span></div>
          </div>
          <div class="amount-box">
            <div class="label">AMOUNT PAID</div>
            <div class="amount-val">₹ ${(Number(voucher?.amount) || 0).toLocaleString("en-IN")}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">(${voucher.description || "School Operational Expense"})</div>
          </div>
          <div class="signatures">
            <div>Receiver's Signature</div>
            <div>Accountant Signature</div>
            <div>Principal / Admin Seal</div>
          </div>
        </div>
      </body>
      </html>
    `;
    printHtmlInIframe(htmlDoc, `Expense_Voucher_${voucher.voucherNo}`);
  };

  const isWhite = appTheme === "white";
  const isBlack = appTheme === "black";
  const navInactiveCls = isWhite
    ? "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
    : "text-slate-300 hover:bg-slate-800/70 hover:text-white";
  const mobileNavInactiveCls = isWhite ? "text-slate-700 hover:bg-slate-100" : "text-slate-300";

  return (
    <div className={`min-h-screen flex flex-col font-sans app-theme-${appTheme} ${
      isWhite ? "bg-[#eef2f7] text-slate-900" : isBlack ? "dark bg-black text-white" : "dark bg-[#08142c] text-slate-100"
    }`}>
      {/* ── TOP NAV HEADER ── */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 shadow-2xs ${
        isWhite
          ? "bg-white/95 border-slate-200 text-slate-900"
          : isBlack
          ? "bg-black/95 border-neutral-800 text-white"
          : "bg-[#0a1935]/95 border-[#1b3564] text-white"
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {!isEffectiveLandscape && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`md:hidden min-w-[40px] min-h-[40px] rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                isWhite
                  ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
              }`}
              aria-label="Open Accountant Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* School Badge & Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              isWhite
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-amber-500/15 border-amber-500/30 text-amber-400"
            }`}>
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className={`font-bold text-sm md:text-base truncate max-w-[180px] sm:max-w-md ${isWhite ? "text-slate-900" : "text-white"}`}>
                  {school?.name || "School ERP"}
                </h1>
                <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${
                  isWhite
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}>
                  Accountant
                </span>
              </div>
              <div className={`flex items-center gap-1.5 text-[11px] ${isWhite ? "text-slate-600" : "text-slate-400"}`}>
                <span className={`font-semibold truncate ${isWhite ? "text-amber-700" : "text-amber-400"}`}>{activeSession.name}</span>
                <span>•</span>
                <span className={`font-medium truncate max-w-[140px] ${isWhite ? "text-slate-700" : "text-slate-300"}`}>
                  {activeAccountant?.name || "Accountant"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <AndroidBatteryIndicator tone={isWhite ? "light" : "dark"} />
          <button
            type="button"
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className={`px-2.5 py-2 rounded-xl border transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              isWhite
                ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500" : ""}`} />
            <span className="hidden sm:inline">रीफ्रेश</span>
          </button>

          <button
            type="button"
            onClick={handleToggleOrientation}
            className={`inline-flex items-center justify-center p-2 rounded-xl transition cursor-pointer border shrink-0 ${
              isEffectiveLandscape
                ? "bg-indigo-600 text-white border-indigo-500"
                : isWhite
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            }`}
            title={
              isEffectiveLandscape
                ? "Mobile (Portrait) Mode me wapas layein"
                : "Laptop (Desktop) Mode me badlein"
            }
            aria-label={
              isEffectiveLandscape
                ? "Switch to Mobile Mode"
                : "Switch to Desktop Mode"
            }
          >
            {isEffectiveLandscape ? (
              <Laptop className="w-4 h-4" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden xs:inline">Back to Admin ERP</span>
              <span className="xs:hidden">Admin</span>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isWhite
                  ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                  : "bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25"
              }`}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN WORKSPACE WITH SIDEBAR ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION (Desktop) */}
        <aside className={`hidden md:flex flex-col w-64 border-r p-4 space-y-6 shrink-0 overflow-y-auto ${
          isWhite
            ? "bg-white border-slate-200 text-slate-900"
            : isBlack
            ? "bg-[#050505] border-neutral-800 text-slate-100"
            : "bg-[#0a1935] border-[#1b3564] text-slate-100"
        }`}>
          {/* Cash In Hand Mini Counter */}
          <div className={`p-3.5 rounded-2xl border ${
            isWhite
              ? "bg-amber-50/60 border-amber-200"
              : "bg-slate-900 border-slate-800"
          }`}>
            <div className={`flex items-center justify-between text-xs font-semibold mb-1 ${isWhite ? "text-amber-800" : "text-amber-400"}`}>
              <span>आज का नकद (Cash In Hand)</span>
              <Wallet className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-bold tabular-nums ${isWhite ? "text-slate-900" : "text-white"}`}>
              ₹ {(Number(financialSummary.netCashInHand) || 0).toLocaleString("en-IN")}
            </div>
            <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[11px] tabular-nums ${
              isWhite ? "border-amber-200 text-slate-600" : "border-slate-800 text-slate-400"
            }`}>
              <span>आज फीस: ₹{(Number(financialSummary.todayTotalFee) || 0).toLocaleString("en-IN")}</span>
              <span className={isWhite ? "text-rose-700 font-semibold" : "text-rose-400"}>खर्च: ₹{(Number(financialSummary.todayExpenseTotal) || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Menu Sections */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1">
              मुख्य अवलोकन (Dashboard)
            </div>

            <button
              onClick={() => setActiveTab("home")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "home"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Home Dashboard (होम)</span>
            </button>

            <button
              onClick={() => setActiveTab("counter")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "counter"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <IndianRupee className="w-4 h-4 shrink-0" />
              <span>Cash Counter &amp; Overview</span>
            </button>

            {permissions.canManageAbsentee !== false && (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1 pt-2">
                  छात्र उपस्थिति (Attendance)
                </div>

                <button
                  onClick={() => setActiveTab("absentee")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                    activeTab === "absentee"
                      ? "bg-rose-600 text-white font-semibold shadow-xs"
                      : `${navInactiveCls} font-medium`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UserX className={`w-4 h-4 shrink-0 ${activeTab === "absentee" ? "text-white" : "text-rose-500"}`} />
                    <span>Absentee Desk (अनुपस्थिति)</span>
                  </div>
                  {attendanceSummary.absentCount > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                      activeTab === "absentee" ? "bg-white/20 text-white" : "bg-rose-500/15 text-rose-500"
                    }`}>
                      {attendanceSummary.absentCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1 pt-2">
              वित्त व काउंटर (Finance)
            </div>

            {permissions.canCollectFee && (
              <button
                onClick={() => setActiveTab("fee_collection")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "fee_collection"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <Receipt className="w-4 h-4 shrink-0" />
                <span>Fee Collection &amp; 3&quot; POS Slip</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("sibling_profiles")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "sibling_profiles"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <Users className={`w-4 h-4 shrink-0 ${activeTab === "sibling_profiles" ? "text-white" : "text-indigo-400"}`} />
              <span>Sibling Profiles (भाई-बहन)</span>
            </button>

            {permissions.canAdmitStudents && (
              <button
                onClick={() => setActiveTab("admissions")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "admissions"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Online &amp; Direct Admission</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("dues_defaulters")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "dues_defaulters"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className={`w-4 h-4 shrink-0 ${activeTab === "dues_defaulters" ? "text-white" : "text-rose-500"}`} />
                <span>Fee Dues &amp; Defaulters</span>
              </div>
              {defaultersList.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                  activeTab === "dues_defaulters" ? "bg-white/20 text-white" : "bg-rose-500/15 text-rose-500"
                }`}>
                  {defaultersList.length}
                </span>
              )}
            </button>

            {permissions.canViewDayBook && (
              <button
                onClick={() => setActiveTab("daybook")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "daybook"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Daily Cashbook &amp; Settlement</span>
              </button>
            )}

            {permissions.canRecordExpenses && (
              <button
                onClick={() => setActiveTab("expenses")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "expenses"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                <span>School Expense Vouchers</span>
              </button>
            )}

            {permissions.canManageBusFee && (
              <button
                onClick={() => setActiveTab("bus_fees")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "bus_fees"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <Bus className="w-4 h-4 shrink-0" />
                <span>Bus &amp; Transport Dues</span>
              </button>
            )}

            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1 pt-2">
              फीस टूल्स व सेटिंग्स (Tools)
            </div>

            {permissions.canCollectFee && (
              <button
                onClick={() => setActiveTab("qr_pay")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "qr_pay"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <QrCode className={`w-4 h-4 shrink-0 ${activeTab === "qr_pay" ? "text-white" : "text-amber-500"}`} />
                <span>Scan ID Card QR (फास्ट पे)</span>
              </button>
            )}

            {permissions.canSendFeeAlerts && (
              <button
                onClick={() => setActiveTab("fee_alerts")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "fee_alerts"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <Bell className={`w-4 h-4 shrink-0 ${activeTab === "fee_alerts" ? "text-white" : "text-purple-400"}`} />
                <span>Class Fee Alerts &amp; Push</span>
              </button>
            )}

            {permissions.canEditFeeStructure && (
              <>
                <button
                  onClick={() => setActiveTab("class_rates")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                    activeTab === "class_rates"
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : `${navInactiveCls} font-medium`
                  }`}
                >
                  <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === "class_rates" ? "text-white" : "text-blue-400"}`} />
                  <span>Class Fee Rates &amp; Structure</span>
                </button>
                <button
                  onClick={() => setActiveTab("term_scheduler")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                    activeTab === "term_scheduler"
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : `${navInactiveCls} font-medium`
                  }`}
                >
                  <CalendarClock className={`w-4 h-4 shrink-0 ${activeTab === "term_scheduler" ? "text-white" : "text-emerald-400"}`} />
                  <span className="flex-1 truncate">Term / Exam Fee &amp; Month Add</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">NEW</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab("receipt_header")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "receipt_header"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <Building2 className={`w-4 h-4 shrink-0 ${activeTab === "receipt_header" ? "text-white" : isWhite ? "text-slate-500" : "text-slate-300"}`} />
              <span>Receipt Header &amp; Print Settings</span>
            </button>

            {permissions.canCancelReceipts && (
              <button
                onClick={() => setActiveTab("receipt_cancellation")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                  activeTab === "receipt_cancellation"
                    ? "bg-rose-600 text-white font-semibold shadow-xs"
                    : `${navInactiveCls} font-medium`
                }`}
              >
                <RotateCcw className={`w-4 h-4 shrink-0 ${activeTab === "receipt_cancellation" ? "text-white" : "text-rose-500"}`} />
                <span>Receipt Cancellation &amp; Refund</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("razorpay_setup")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "razorpay_setup"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <CreditCard className={`w-4 h-4 shrink-0 ${activeTab === "razorpay_setup" ? "text-white" : "text-indigo-400"}`} />
              <span>Razorpay Auto-Webhook Setup</span>
            </button>

            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1 pt-2">
              कम्युनिकेशन (Communication)
            </div>

            <button
              onClick={() => setActiveTab("messenger")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "messenger"
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <MessageCircle className={`w-4 h-4 shrink-0 ${activeTab === "messenger" ? "text-white" : "text-emerald-400"}`} />
              <span>NSTA Messenger (मेसेंजर)</span>
            </button>

            <button
              onClick={() => setActiveTab("rules_regulations")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left cursor-pointer ${
                activeTab === "rules_regulations"
                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                  : `${navInactiveCls} font-medium`
              }`}
            >
              <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === "rules_regulations" ? "text-white" : "text-amber-500"}`} />
              <span>School &amp; Teacher Rules (13)</span>
            </button>
          </div>

          {/* Quick Expense Action Button */}
          {permissions.canRecordExpenses && (
            <div className="pt-2">
              <button
                onClick={() => setShowExpenseModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>नया खर्च वाउचर दर्ज करें</span>
              </button>
            </div>
          )}

          {/* Explore Full NSTA Learning App */}
          {onOpenPlatformContent && (
            <button
              type="button"
              onClick={handleExploreFullApp}
              className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                isWhite
                  ? "bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100/70"
                  : "bg-slate-900 border-indigo-500/30 hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                  isWhite
                    ? "bg-white border-indigo-200 text-indigo-600"
                    : "bg-indigo-500/20 border-indigo-400/30 text-indigo-300"
                }`}>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate ${
                    isWhite ? "text-slate-900" : "text-white"
                  }`}>
                    Explore Full NSTA App
                  </p>
                  <p className={`text-[10px] font-medium truncate ${
                    isWhite ? "text-indigo-700" : "text-indigo-300/80"
                  }`}>
                    53+ Books, MCQs &amp; Online Test
                  </p>
                </div>
              </div>
              <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${
                isWhite ? "text-indigo-600" : "text-indigo-400"
              }`} />
            </button>
          )}

          {/* Security & Boundary Notice */}
          <div className={`mt-auto p-3 rounded-xl border text-[11px] space-y-1 ${
            isWhite
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : isBlack
              ? "bg-neutral-900 border-neutral-800 text-slate-400"
              : "bg-slate-900/90 border-[#1b3564] text-slate-300"
          }`}>
            <div className={`flex items-center gap-1.5 font-semibold ${isWhite ? "text-emerald-700" : "text-emerald-400"}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Role Security: Accountant</span>
            </div>
            <p className="text-[10px] leading-relaxed">
              आपको केवल फीस, रसीद, प्रवेश व खर्च की अधिकृत शक्तियां दी गई हैं। परीक्षा अंक या शिक्षण डायरी Admin व शिक्षकों के अधीन है।
            </p>
          </div>
        </aside>

        {/* MOBILE DRAWER NAVIGATION */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className={`relative w-[260px] max-w-[82vw] p-4 flex flex-col space-y-4 z-10 border-r h-full overflow-y-auto ${
              isWhite
                ? "bg-white border-slate-200 text-slate-900"
                : isBlack
                ? "bg-[#050505] border-neutral-800 text-slate-100"
                : "bg-[#0a1935] border-[#1b3564] text-slate-100"
            }`}>
              <div className={`flex items-center justify-between pb-3 border-b ${
                isWhite ? "border-slate-200" : isBlack ? "border-neutral-800" : "border-[#1b3564]"
              }`}>
                <div className={`font-bold text-sm ${isWhite ? "text-slate-900" : "text-white"}`}>Accountant Menu</div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    isWhite
                      ? "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("home");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "home" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span>Home Dashboard (होम)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("counter");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "counter" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <IndianRupee className="w-4 h-4 shrink-0" />
                  <span>Cash Counter &amp; Overview</span>
                </button>

                {permissions.canManageAbsentee !== false && (
                  <button
                    onClick={() => {
                      setActiveTab("absentee");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "absentee" ? "bg-rose-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserX className={`w-4 h-4 shrink-0 ${activeTab === "absentee" ? "text-white" : "text-rose-500"}`} />
                      <span>Absentee Desk (अनुपस्थिति)</span>
                    </div>
                    {attendanceSummary.absentCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400 tabular-nums">
                        {attendanceSummary.absentCount}
                      </span>
                    )}
                  </button>
                )}

                {permissions.canCollectFee && (
                  <button
                    onClick={() => {
                      setActiveTab("fee_collection");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "fee_collection" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <Receipt className="w-4 h-4 shrink-0" />
                    <span>Fee Collection &amp; 3&quot; POS</span>
                  </button>
                )}

                {permissions.canAdmitStudents && (
                  <button
                    onClick={() => {
                      setActiveTab("admissions");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "admissions" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span>Online &amp; Direct Admission</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveTab("dues_defaulters");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "dues_defaulters" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`w-4 h-4 shrink-0 ${activeTab === "dues_defaulters" ? "text-white" : "text-rose-500"}`} />
                    <span>Fee Dues &amp; Defaulters</span>
                  </div>
                  {defaultersList.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400 tabular-nums">
                      {defaultersList.length}
                    </span>
                  )}
                </button>

                {permissions.canViewDayBook && (
                  <button
                    onClick={() => {
                      setActiveTab("daybook");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "daybook" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>Daily Cashbook &amp; Settlement</span>
                  </button>
                )}

                {permissions.canRecordExpenses && (
                  <button
                    onClick={() => {
                      setActiveTab("expenses");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "expenses" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>School Expense Vouchers</span>
                  </button>
                )}

                {permissions.canManageBusFee && (
                  <button
                    onClick={() => {
                      setActiveTab("bus_fees");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "bus_fees" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <Bus className="w-4 h-4 shrink-0" />
                    <span>Bus &amp; Transport Dues</span>
                  </button>
                )}

                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1 pt-2">
                  फीस टूल्स व सेटिंग्स (Tools)
                </div>

                {permissions.canCollectFee && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab("readmission");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                        activeTab === "readmission" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                      }`}
                    >
                      <UserPlus className={`w-4 h-4 shrink-0 ${activeTab === "readmission" ? "text-white" : "text-blue-400"}`} />
                      <span>Re-Admission (सत्र पुनः प्रवेश)</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab("qr_pay");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                        activeTab === "qr_pay" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                      }`}
                    >
                      <QrCode className={`w-4 h-4 shrink-0 ${activeTab === "qr_pay" ? "text-white" : "text-amber-500"}`} />
                      <span>Scan ID Card QR (फास्ट पे)</span>
                    </button>
                  </>
                )}

                {permissions.canSendFeeAlerts && (
                  <button
                    onClick={() => {
                      setActiveTab("fee_alerts");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "fee_alerts" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <Bell className={`w-4 h-4 shrink-0 ${activeTab === "fee_alerts" ? "text-white" : "text-purple-400"}`} />
                    <span>Class Fee Alerts &amp; Push</span>
                  </button>
                )}

                {permissions.canEditFeeStructure && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab("class_rates");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                        activeTab === "class_rates" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                      }`}
                    >
                      <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === "class_rates" ? "text-white" : "text-blue-400"}`} />
                      <span>Class Fee Rates &amp; Structure</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("term_scheduler");
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                        activeTab === "term_scheduler" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                      }`}
                    >
                      <CalendarClock className={`w-4 h-4 shrink-0 ${activeTab === "term_scheduler" ? "text-white" : "text-emerald-400"}`} />
                      <span className="flex-1 truncate">Term / Exam Fee &amp; Month Add</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">NEW</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setActiveTab("receipt_header");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "receipt_header" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${activeTab === "receipt_header" ? "text-white" : isWhite ? "text-slate-500" : "text-slate-300"}`} />
                  <span>Receipt Header &amp; Print Settings</span>
                </button>

                {permissions.canCancelReceipts && (
                  <button
                    onClick={() => {
                      setActiveTab("receipt_cancellation");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                      activeTab === "receipt_cancellation" ? "bg-rose-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                    }`}
                  >
                    <RotateCcw className={`w-4 h-4 shrink-0 ${activeTab === "receipt_cancellation" ? "text-white" : "text-rose-500"}`} />
                    <span>Receipt Cancellation &amp; Refund</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveTab("razorpay_setup");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "razorpay_setup" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <CreditCard className={`w-4 h-4 shrink-0 ${activeTab === "razorpay_setup" ? "text-white" : "text-indigo-400"}`} />
                  <span>Razorpay Auto-Webhook Setup</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("messenger");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "messenger" ? "bg-emerald-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <MessageCircle className={`w-4 h-4 shrink-0 ${activeTab === "messenger" ? "text-white" : "text-emerald-400"}`} />
                  <span>NSTA Messenger (मेसेंजर)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("rules_regulations");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition text-left ${
                    activeTab === "rules_regulations" ? "bg-indigo-600 text-white font-semibold" : `${mobileNavInactiveCls} font-medium`
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === "rules_regulations" ? "text-white" : "text-amber-500"}`} />
                  <span>School &amp; Teacher Rules (13)</span>
                </button>

                {/* Explore Full NSTA Learning App */}
                {onOpenPlatformContent && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleExploreFullApp();
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                        isWhite
                          ? "bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100/70"
                          : "bg-slate-900 border-indigo-500/30 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                          isWhite
                            ? "bg-white border-indigo-200 text-indigo-600"
                            : "bg-indigo-500/20 border-indigo-400/30 text-indigo-300"
                        }`}>
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${
                            isWhite ? "text-slate-900" : "text-white"
                          }`}>
                            Explore Full NSTA App
                          </p>
                          <p className={`text-[10px] font-medium truncate ${
                            isWhite ? "text-indigo-700" : "text-indigo-300/80"
                          }`}>
                            53+ Books, MCQs &amp; Online Test
                          </p>
                        </div>
                      </div>
                      <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${
                        isWhite ? "text-indigo-600" : "text-indigo-400"
                      }`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 ${
          isWhite ? "bg-[#eef2f7] text-slate-900" : isBlack ? "bg-black text-white" : "bg-[#08142c] text-slate-100"
        }`}>
          {/* TAB 0: HOME DASHBOARD (मुख्य विद्यालय व वित्तीय अवलोकन) */}
          {activeTab === "home" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Hero Banner */}
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                    <Briefcase className="w-4 h-4" />
                    <span>Accountant Home Dashboard • {school?.name || "School ERP"}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    नमस्ते, {activeAccountant?.name || "Accountant"}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-xl font-medium">
                    दैनिक रोकड़ बही, 3-इंच POS थर्मल फीस रसीद, प्रवेश व छात्र अनुपस्थिति (Absentee Management) का समग्र अवलोकन।
                  </p>
                  <div className="flex items-center gap-2.5 pt-1 text-xs flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                      सत्र: <strong className="text-indigo-700 dark:text-amber-400">{activeSession.name}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                      दिनांक: <strong className="text-slate-900 dark:text-white tabular-nums">{todayStr}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold">
                      Emp ID: {activeAccountant?.employeeId || "ACC-01"}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-semibold tabular-nums">
                      {permissions.canGrantDiscount
                        ? `छूट सीमा: Max ${permissions.maxDiscountLimitPct ?? 10}%`
                        : "छूट (Discount): Disabled"}
                    </span>
                  </div>
                </div>

                {/* Cash in Hand Big Highlight */}
                <div className="w-full md:w-auto p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-center md:text-right shrink-0">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block mb-1">
                    वर्तमान नकद गल्ला (Cash In Hand)
                  </span>
                  <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹ {(Number(financialSummary.netCashInHand) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-2 flex items-center justify-center md:justify-end gap-3 text-xs text-slate-600 dark:text-slate-400 font-semibold tabular-nums">
                    <span>आज की फीस: <strong className="text-emerald-700 dark:text-emerald-400">₹{(Number(financialSummary.todayTotalFee) || 0).toLocaleString("en-IN")}</strong></span>
                    <span>खर्च: <strong className="text-rose-700 dark:text-rose-400">₹{(Number(financialSummary.todayExpenseTotal) || 0).toLocaleString("en-IN")}</strong></span>
                  </div>
                </div>
              </div>

              {/* ── 4 KPI CARDS ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Students */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <span>कुल नामांकित छात्र</span>
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {students.length}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    कुल {classes.length} कक्षाएं सक्रिय हैं
                  </p>
                </div>

                {/* 2. Today's Attendance & Absentee */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <span>आज की उपस्थिति (Attendance)</span>
                    <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {attendanceSummary.attendancePct}%
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      ({attendanceSummary.presentCount} उपस्थित)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${attendanceSummary.attendancePct}%` }}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${100 - attendanceSummary.attendancePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">{attendanceSummary.absentCount} छात्र अनुपस्थित</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("absentee")}
                      className="text-indigo-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer whitespace-nowrap"
                    >
                      कॉल व नोटिस &rarr;
                    </button>
                  </div>
                </div>

                {/* 3. Today's Total Collections (3-Channel Breakdown) */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <span>आज का कुल संकलन</span>
                    <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹ {(Number(financialSummary.todayTotalFee) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Online QR</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">₹{(Number(financialSummary.todayQrFee) || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-1.5">
                      <span className="text-slate-500 dark:text-slate-400 block">NSTA Online</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">₹{(Number(financialSummary.todayNstaOnlineFee) || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-1.5">
                      <span className="text-slate-500 dark:text-slate-400 block">Cash</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">₹{(Number(financialSummary.todayCashFee) || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Total Dues & Defaulters */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <span>बकाया फीस छात्र</span>
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {defaultersList.length}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    कुल अनुमानित बकाया: ₹{(Number(financialSummary.totalDuesAmount ?? financialSummary.monthPendingDues) || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* ── ADMISSION BALANCE & 1-MONTH ADVANCE FEE DUES CARDS ──────── */}
              {(() => {
                const studentsWithAdmissionDues = students.filter(
                  (s) => Number(s.admissionDueBalance || 0) + Number(s.previousSessionDue || 0) > 0
                );
                const totalAdmissionDue = studentsWithAdmissionDues.reduce(
                  (sum, s) => sum + Number(s.admissionDueBalance || 0) + Number(s.previousSessionDue || 0),
                  0
                );

                const studentsWithAdvanceDues = students.filter(
                  (s) =>
                    s.advanceMonthlyFeePaid === false &&
                    Number(s.advanceMonthlyFeeDue || s.monthlyFee || 0) > 0
                );
                const totalAdvanceDue = studentsWithAdvanceDues.reduce(
                  (sum, s) => sum + Number(s.advanceMonthlyFeeDue || s.monthlyFee || 0),
                  0
                );

                const getClassLabel = (clsId: string) =>
                  classes.find((c) => c.id === clsId)?.name || "Class";

                const openWhatsAppReminder = (
                  st: SchoolStudent,
                  headLabel: string,
                  dueAmt: number
                ) => {
                  const phone = (st.parentPhone || st.phone || "").replace(/\D/g, "");
                  const targetPhone = phone.length === 10 ? `91${phone}` : phone;
                  const msg = encodeURIComponent(
                    `नमस्ते ${st.fatherName || "अभिभावक जी"},\n${school?.name || "School"} से सूचना:\nछात्र/छात्रा: *${st.name}* (${getClassLabel(st.classId)}, Roll #${st.rollNo || "—"})\nबकाया शीर्षक: *${headLabel}*\nबकाया राशि: *₹${dueAmt.toLocaleString("en-IN")}*\nकृपया शीघ्र शुल्क जमा कराने की कृपा करें। धन्यवाद!`
                  );
                  const url = targetPhone
                    ? `https://wa.me/${targetPhone}?text=${msg}`
                    : `https://wa.me/?text=${msg}`;
                  safeOpenExternalUrl(url);
                };

                const dispatchNstaDueSlip = async (opts: {
                  studentId: string;
                  studentName: string;
                  className: string;
                  rollNo?: string | number;
                  admissionNo?: string;
                  dueAmount: number;
                  label: string;
                }) => {
                  if (!schoolId || !opts.studentId || opts.dueAmount <= 0) return;
                  setSendingNstaSlipId(opts.studentId);
                  try {
                    const monthKey = currentMonthStr();
                    await autoSendFeeSlipToSchoolDesk({
                      schoolId,
                      studentId: opts.studentId,
                      studentName: opts.studentName,
                      className: opts.className,
                      rollNo: String(opts.rollNo || ""),
                      admissionNo: opts.admissionNo || "",
                      slipType: "A6_DEMAND_SLIP",
                      month: monthKey,
                      monthLabel: opts.label || monthKey,
                      amount: opts.dueAmount,
                      balanceDue: opts.dueAmount,
                      monthlyAmount: opts.dueAmount,
                      oldArrears: 0,
                      dueDate: "शीघ्र जमा करें",
                      payLink: school?.bankUpiId
                        ? `upi://pay?pa=${school.bankUpiId}&pn=${encodeURIComponent(school?.name || "School")}&am=${opts.dueAmount}`
                        : undefined,
                    });
                    void sendSchoolPushNotification({
                      schoolId,
                      studentIds: [opts.studentId],
                      senderId: activeAccountant?.id || accountantId || "accountant_admin",
                      senderIds: [activeAccountant?.id, accountantId, "STAFF_ADMIN", "school_admin", "accountant_admin"].filter(Boolean) as string[],
                      senderName: activeAccountant?.name || school?.name || "School Accounts",
                      title: `बकाया फीस स्लिप: ${opts.studentName}`,
                      body: `कुल बकाया ₹${opts.dueAmount.toLocaleString("en-IN")} (${opts.label}) — NSTA Messenger में स्लिप देखें।`,
                      type: "MONTHLY_FEE",
                      icon: school?.logoUrl || undefined,
                      url: "/?schoolPortal=1&schoolTab=messenger&subTab=school",
                      urgent: true,
                    }).catch(() => {});
                    setSentNstaSlipIds((prev) => ({ ...prev, [opts.studentId]: true }));
                    toast.success(`${opts.studentName} को फीस स्लिप NSTA Messenger पर भेज दी गई!`);
                  } catch (err) {
                    console.warn("NSTA slip send error:", err);
                    toast.error("NSTA Messenger पर स्लिप भेजने में समस्या आई।");
                  } finally {
                    setSendingNstaSlipId(null);
                  }
                };

                const handleSettleDue = async () => {
                  if (!duesSettlementModal || !schoolId) return;
                  const { student: st, type, amount, mode } = duesSettlementModal;
                  const payAmt = Math.max(0, Number(amount) || 0);
                  if (payAmt <= 0) return;

                  setDuesSettlementModal((prev) => (prev ? { ...prev, saving: true } : null));
                  const todayIso = new Date().toISOString().slice(0, 10);
                  const receiptNo = `ADM-${Date.now().toString().slice(-6)}`;

                  try {
                    let patch: Partial<SchoolStudent> = {};
                    if (type === "admission") {
                      const curBack = Number(st.previousSessionDue || 0);
                      const curAdm = Number(st.admissionDueBalance || 0);
                      const appliedBack = Math.min(curBack, payAmt);
                      const remBack = Math.max(0, curBack - appliedBack);
                      const leftForAdm = Math.max(0, payAmt - appliedBack);
                      const appliedAdm = Math.min(curAdm, leftForAdm);
                      const remAdm = Math.max(0, curAdm - appliedAdm);
                      patch = {
                        previousSessionDue: remBack,
                        admissionDueBalance: remAdm,
                        admissionPaidAmount: Number(st.admissionPaidAmount || 0) + appliedAdm,
                        admissionBalanceHistory: [
                          ...(st.admissionBalanceHistory || []),
                          {
                            date: todayIso,
                            paidAmount: appliedBack + appliedAdm,
                            remainingDue: remBack + remAdm,
                            receiptNo,
                            paymentMode: mode,
                          },
                        ],
                      };
                    } else {
                      patch = {
                        advanceMonthlyFeePaid: true,
                        advanceMonthlyFeeDue: 0,
                      };
                    }

                    await updateStudent(schoolId, st.id, patch);
                    setStudents((prev) =>
                      prev.map((item) => (item.id === st.id ? { ...item, ...patch } : item))
                    );
                    toast.success("भुगतान सफलतापूर्वक दर्ज किया गया!");
                    setDuesSettlementModal(null);
                  } catch (err) {
                    console.error("Accountant settle due failed:", err);
                    toast.error("भुगतान सहेजने में त्रुटि हुई।");
                    setDuesSettlementModal((prev) => (prev ? { ...prev, saving: false } : null));
                  }
                };

                return (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* CARD 1: PENDING ADMISSION BALANCE */}
                      <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 shadow-xs p-5 flex flex-col justify-between gap-3">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                              Pending Admission Balance
                            </span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                              अधूरा एडमिशन शुल्क (Admission Arrears)
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                              ₹{totalAdmissionDue.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[11px] font-semibold font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {studentsWithAdmissionDues.length} Students
                            </p>
                          </div>
                        </div>

                        {studentsWithAdmissionDues.length === 0 ? (
                          <div className="py-5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                            सभी छात्रों का एडमिशन शुल्क पूर्ण जमा है।
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {studentsWithAdmissionDues.slice(0, 12).map((st) => {
                              const due = Number(st.admissionDueBalance || 0) + Number(st.previousSessionDue || 0);
                              return (
                                <div
                                  key={st.id}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{st.name}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {getClassLabel(st.classId)} • Roll #{st.rollNo || "—"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mr-1">
                                      ₹{due.toLocaleString("en-IN")}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDuesSettlementModal({
                                          student: st,
                                          type: "admission",
                                          amount: String(due),
                                          mode: "Cash",
                                          saving: false,
                                        })
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                                    >
                                      जमा करें
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openWhatsAppReminder(st, "बकाया एडमिशन शुल्क", due)
                                      }
                                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                                      title="WhatsApp Reminder"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        dispatchNstaDueSlip({
                                          studentId: st.id,
                                          studentName: st.name,
                                          className: getClassLabel(st.classId),
                                          rollNo: st.rollNo,
                                          admissionNo: st.admissionNo,
                                          dueAmount: due,
                                          label: "बकाया एडमिशन शुल्क",
                                        })
                                      }
                                      disabled={sendingNstaSlipId === st.id}
                                      className="px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                                      title="NSTA Messenger par Fee Slip bhejein"
                                    >
                                      {sendingNstaSlipId === st.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : sentNstaSlipIds[st.id] ? (
                                        <Check className="w-3 h-3" />
                                      ) : (
                                        <MessageSquare className="w-3 h-3" />
                                      )}
                                      <span>NSTA</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* CARD 2: 1-MONTH ADVANCE FEE UNPAID */}
                      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-900 shadow-xs p-5 flex flex-col justify-between gap-3">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              Unpaid 1-Month Advance Fee
                            </span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                              1-माह एडवांस फीस बकाया (Advance Tuition)
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                              ₹{totalAdvanceDue.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[11px] font-semibold font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {studentsWithAdvanceDues.length} Students
                            </p>
                          </div>
                        </div>

                        {studentsWithAdvanceDues.length === 0 ? (
                          <div className="py-5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                            सभी नए छात्रों की 1-माह एडवांस फीस जमा है।
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {studentsWithAdvanceDues.slice(0, 12).map((st) => {
                              const advDue = Number(st.advanceMonthlyFeeDue || st.monthlyFee || 0);
                              return (
                                <div
                                  key={st.id}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{st.name}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {getClassLabel(st.classId)} • Roll #{st.rollNo || "—"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mr-1">
                                      ₹{advDue.toLocaleString("en-IN")}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDuesSettlementModal({
                                          student: st,
                                          type: "advance",
                                          amount: String(advDue),
                                          mode: "Cash",
                                          saving: false,
                                        })
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                                    >
                                      जमा करें
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openWhatsAppReminder(st, "1-माह एडवांस ट्यूशन फीस", advDue)
                                      }
                                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                                      title="WhatsApp Reminder"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        dispatchNstaDueSlip({
                                          studentId: st.id,
                                          studentName: st.name,
                                          className: getClassLabel(st.classId),
                                          rollNo: st.rollNo,
                                          admissionNo: st.admissionNo,
                                          dueAmount: advDue,
                                          label: "1-माह एडवांस ट्यूशन फीस",
                                        })
                                      }
                                      disabled={sendingNstaSlipId === st.id}
                                      className="px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                                      title="NSTA Messenger par Fee Slip bhejein"
                                    >
                                      {sendingNstaSlipId === st.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : sentNstaSlipIds[st.id] ? (
                                        <Check className="w-3 h-3" />
                                      ) : (
                                        <MessageSquare className="w-3 h-3" />
                                      )}
                                      <span>NSTA</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 1-TAP DUES SETTLEMENT MODAL */}
                    {duesSettlementModal && (
                      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <div>
                              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                {duesSettlementModal.type === "admission"
                                  ? "अधूरा एडमिशन शुल्क जमा करें"
                                  : "1-माह एडवांस फीस जमा करें"}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {duesSettlementModal.student.name} ({getClassLabel(duesSettlementModal.student.classId)})
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDuesSettlementModal(null)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                जमा राशि (Amount in ₹)
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={duesSettlementModal.amount}
                                onChange={(e) =>
                                  setDuesSettlementModal((prev) =>
                                    prev ? { ...prev, amount: e.target.value } : null
                                  )
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                भुगतान माध्यम (Payment Mode)
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {(["Cash", "UPI", "Bank"] as const).map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() =>
                                      setDuesSettlementModal((prev) =>
                                        prev ? { ...prev, mode: m } : null
                                      )
                                    }
                                    className={`py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                      duesSettlementModal.mode === m
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                    }`}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setDuesSettlementModal(null)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              रद्द करें
                            </button>
                            <button
                              type="button"
                              disabled={duesSettlementModal.saving}
                              onClick={handleSettleDue}
                              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
                            >
                              {duesSettlementModal.saving ? "सहेजा जा रहा है..." : "भुगतान दर्ज करें"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── URGENT ABSENTEE ALERT BANNER ──────────────────────────────── */}
              {permissions.canManageAbsentee !== false && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        छात्र अनुपस्थिति व कॉल एक्शन (Absentee Desk)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
                      Accountant व Admin सीधे अभिभावकों से बात कर सकते हैं। कारण (बीमारी, शादी, गाँव जाना) और संभावित वापसी की तारीख दर्ज करें। तय अवधि तक सिस्टम उन्हें परेशान नहीं करेगा।
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("absentee")}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition shrink-0 whitespace-nowrap"
                  >
                    <UserX className="w-4 h-4" />
                    <span>अनुपस्थिति डेस्क खोलें &rarr;</span>
                  </button>
                </div>
              )}

              {/* ── 6 QUICK ACTION CARDS ─────────────────────────────────────── */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  त्वरित कार्य (Quick Actions)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Action 1: Fee Collection */}
                  {permissions.canCollectFee && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("fee_collection")}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/40 text-left transition flex items-start gap-3.5 cursor-pointer group shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                          3" POS फीस संकलन
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          छात्र खोजें, बकाया देखें और 3-इंच थर्मल रसीद प्रिंट करें।
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Action 2: Absentee Desk */}
                  {permissions.canManageAbsentee !== false && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("absentee")}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500/40 text-left transition flex items-start gap-3.5 cursor-pointer group shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <PhoneCall className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                          Absentee Desk (अनुपस्थिति)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Day 1 Notice, Day 2 Call व छुट्टी-वापसी ट्रैकर।
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Action 3: Online & Direct Admission */}
                  {permissions.canAdmitStudents && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("admissions")}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/40 text-left transition flex items-start gap-3.5 cursor-pointer group shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          Online &amp; Direct Admission
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          नए छात्र का फॉर्म भरें व प्रवेश रसीद जारी करें।
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Action 4: Daily Cashbook */}
                  {permissions.canViewDayBook && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("daybook")}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 text-left transition flex items-start gap-3.5 cursor-pointer group shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          दैनिक रोकड़ बही (Cashbook)
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          शाम का नकद गल्ला, UPI संकलन व दिन का हिसाब।
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Action 5: Expense Voucher */}
                  {permissions.canRecordExpenses && (
                    <button
                      type="button"
                      onClick={() => setShowExpenseModal(true)}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-500/40 text-left transition flex items-start gap-3.5 cursor-pointer group shadow-xs"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                          नया खर्च वाउचर दर्ज करें
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          स्टेशनरी, डीजल, बिजली व रिपेयरिंग वाउचर बनाएं।
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Action 6: Dues Defaulters */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("dues_defaulters")}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500/40 text-left transition flex items-start gap-3.5 cursor-pointer group shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                        बकाया फीस सूची (Defaulters)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        कक्षा अनुसार बकाया देखें व WhatsApp तकादा भेजें।
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ABSENTEE DESK (अनुपस्थिति प्रबंधन) */}
          {activeTab === "absentee" && (
            permissions.canManageAbsentee !== false ? (
              <div className="max-w-6xl mx-auto space-y-4">
                <AbsenteeActionPage
                  schoolId={schoolId}
                  schoolName={school?.name}
                  classes={classes}
                  currentRole="ACCOUNTANT"
                  currentUserId={activeAccountant?.id || accountantId}
                  currentUserName={activeAccountant?.name || "Accountant"}
                  onBack={() => setActiveTab("home")}
                />
              </div>
            ) : (
              <div className="max-w-lg mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Absentee Desk Restricted</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Admin ने आपके अकाउंट के लिए Absentee Desk की अनुमति बंद रखी है।
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("home")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Home पर लौटें
                </button>
              </div>
            )
          )}

          {/* TAB 1: CASH COUNTER & OVERVIEW */}
          {activeTab === "counter" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Welcome & Fast Search */}
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider tabular-nums">
                    <span>आज का लेखा-जोखा • {todayStr}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                    Accountant काउंटर (Accounts Desk)
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 font-medium">
                    त्वरित फीस संकलन, 3-इंच थर्मल रसीद, प्रवेश सत्यापन व दैनिक रोकड़ बही (Cashbook).
                  </p>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                  {permissions.canCollectFee && (
                    <button
                      onClick={() => setActiveTab("fee_collection")}
                      className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>फीस काउंटर खोलें (POS)</span>
                    </button>
                  )}
                  {permissions.canRecordExpenses && (
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>खर्च वाउचर</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 STAT CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Today's Total Collections */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>आज कुल संकलन (Fee + Store)</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ₹ {(Number(financialSummary.todayTotalFee) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-1 text-[10px]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Online QR</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">₹{(Number(financialSummary.todayQrFee) || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-1">
                      <span className="text-slate-500 dark:text-slate-400 block">NSTA Online</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">₹{(Number(financialSummary.todayNstaOnlineFee) || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-l border-slate-200 dark:border-slate-800 pl-1">
                      <span className="text-slate-500 dark:text-slate-400 block">Cash</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">₹{(Number(financialSummary.todayCashFee) || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Today's Expenses */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>आज का कुल खर्च</span>
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    ₹ {(Number(financialSummary.todayExpenseTotal) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {expenses.filter(e => e.date === todayStr).length} वाउचर दर्ज
                  </div>
                </div>

                {/* 3. Net Cash in Hand */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <span>नकद हाथ में (Cash in Hand)</span>
                    <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹ {(Number(financialSummary.netCashInHand) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                    शाम को Admin को जमा करने हेतु
                  </div>
                </div>

                {/* 4. Total Dues */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>मासिक बकाया (Pending Dues)</span>
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    ₹ {(Number(financialSummary.monthPendingDues) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {defaultersList.length} छात्र बकाया सूची में
                  </div>
                </div>
              </div>

              {/* QUICK STUDENT SEARCH & ACTIONS */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>त्वरित छात्र खोज व बकाया जांच (Quick Student Lookup)</span>
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    नाम, रोल नं, या प्रवेश क्रमांक से खोजें
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={quickSearchQuery}
                    onChange={e => setQuickSearchQuery(e.target.value)}
                    placeholder="छात्र का नाम / Admission No / Roll No दर्ज करें..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {quickSearchQuery.trim().length > 1 && (
                  <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    {students
                      .filter(s => {
                        const q = quickSearchQuery.toLowerCase();
                        return (
                          (s.name || "").toLowerCase().includes(q) ||
                          (s.admissionNo || "").toLowerCase().includes(q) ||
                          (s.rollNo || "").toLowerCase().includes(q) ||
                          (s.fatherName || "").toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 10)
                      .map(s => {
                        const studentFees = fees.filter(f => f.studentId === s.id);
                        const hasUnpaid = studentFees.some(f => !f.paid);
                        return (
                          <div
                            key={s.id}
                            className="p-3 bg-slate-50/70 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span>{s.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                                  Roll: {s.rollNo || "N/A"}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                                  Adm: {s.admissionNo || "N/A"}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                पिता: {s.fatherName || "N/A"} • कक्षा: {s.className || "N/A"} • शुल्क: ₹{s.monthlyFee || 0}/माह
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {hasUnpaid ? (
                                <span className="px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold text-[10px] whitespace-nowrap">
                                  बकाया है
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] whitespace-nowrap">
                                  पूर्ण चुकता
                                </span>
                              )}
                              <button
                                onClick={() => setActiveTab("fee_collection")}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                              >
                                फीस जमा करें &rarr;
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* RECENT EXPENSES PREVIEW */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>हालिया दैनिक खर्च वाउचर (Recent Expense Vouchers)</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab("expenses")}
                    className="text-xs text-indigo-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer whitespace-nowrap"
                  >
                    सभी वाउचर देखें &rarr;
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                    कोई खर्च वाउचर दर्ज नहीं किया गया है।
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    {expenses.slice(0, 5).map(exp => (
                      <div
                        key={exp.id}
                        className="p-3.5 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span>{exp.paidTo}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                              {exp.voucherNo}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                              {exp.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            दिनांक: {exp.date} • माध्यम: {exp.paymentMode} • दर्जकर्ता: {exp.recordedBy}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                            - ₹{(Number(exp?.amount) || 0).toLocaleString("en-IN")}
                          </span>
                          <button
                            onClick={() => handlePrintExpenseVoucher(exp)}
                            className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
                            title="Print Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FEE COLLECTION & POS SLIP */}
          {activeTab === "fee_collection" && (
            permissions.canCollectFee ? (
              <div className="h-full">
                <FeeManager
                  schoolId={schoolId}
                  school={school || undefined}
                  sessionId={activeSession.id}
                  adminId={activeAccountant?.id || "accountant"}
                  userRole="ACCOUNTANT"
                  actorName={activeAccountant?.name || "Accountant"}
                  allowDiscountOverride={Boolean(permissions.canGrantDiscount)}
                  maxDiscountLimitPct={permissions.maxDiscountLimitPct}
                  onBack={() => setActiveTab("counter")}
                />
              </div>
            ) : (
              <div className="max-w-lg mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Fee Collection Restricted</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Admin ने आपके लिए Fee Collection की अनुमति बंद रखी है।
                </p>
              </div>
            )
          )}

          {/* SESSION RE-ADMISSION TAB */}
          {activeTab === "readmission" && school && (
            <div className="h-full p-2 sm:p-4">
              <StudentReAdmissionManager
                school={school}
                sessions={sessions}
                allClasses={allClasses}
                allStudents={allStudents}
                activeSession={activeSession}
                onBack={() => setActiveTab("counter")}
                onReAdmitted={(newSt) => {
                  setAllStudents(prev => [newSt, ...prev.filter(s => s.id !== newSt.id)]);
                  if (newSt.sessionId === activeSession?.id) {
                    setStudents(prev => [newSt, ...prev.filter(s => s.id !== newSt.id)]);
                  }
                  setRefreshTrigger(t => t + 1);
                }}
              />
            </div>
          )}

          {/* FEE TOOL MENU TABS (MOVED FROM FEE TOOLS DROPDOWN) */}
          {(activeTab === "qr_pay" ||
            activeTab === "fee_alerts" ||
            activeTab === "class_rates" ||
            activeTab === "term_scheduler" ||
            activeTab === "receipt_header") && (
            (activeTab === "class_rates" || activeTab === "term_scheduler") && !permissions.canEditFeeStructure ? (
              <div className="max-w-lg mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Fee Structure Locked (Admin Only)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Class Fee Rates व Tuition Structure में बदलाव केवल Admin या अधिकृत Accountant ही कर सकते हैं।
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("home")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Home पर लौटें
                </button>
              </div>
            ) : (
              <div className="h-full">
                <FeeManager
                  key={activeTab}
                  schoolId={schoolId}
                  school={school || undefined}
                  sessionId={activeSession.id}
                  adminId={activeAccountant?.id || "accountant"}
                  userRole="ACCOUNTANT"
                  actorName={activeAccountant?.name || "Accountant"}
                  allowDiscountOverride={Boolean(permissions.canGrantDiscount)}
                  maxDiscountLimitPct={permissions.maxDiscountLimitPct}
                  initialTool={
                    activeTab === "qr_pay"
                      ? "qr_scanner"
                      : activeTab === "fee_alerts"
                        ? "fee_alert"
                        : activeTab === "class_rates"
                          ? "class_rates"
                          : activeTab === "term_scheduler"
                            ? "term_scheduler"
                            : "header"
                  }
                  onBack={() => setActiveTab("fee_collection")}
                />
              </div>
            )
          )}

          {activeTab === "receipt_cancellation" && (
            permissions.canCancelReceipts ? (
              <ReceiptCancellationModal
                asPage={true}
                isOpen={true}
                onClose={() => setActiveTab("fee_collection")}
                school={school || { id: schoolId, name: "School" } as any}
                activeSession={activeSession}
                onReceiptCancelled={() => setRefreshTrigger((t) => t + 1)}
              />
            ) : (
              <div className="max-w-lg mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <Lock className="w-8 h-8 text-rose-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Receipt Cancellation Locked (Admin Only)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  रसीद रद्द करना या रिफंड जारी करना केवल Admin या अधिकृत Accountant के लिए अनुमत है।
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("home")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Home पर लौटें
                </button>
              </div>
            )
          )}

          {activeTab === "razorpay_setup" && (
            <RazorpaySettingsModal
              isOpen={true}
              onClose={() => setActiveTab("fee_collection")}
              schoolId={schoolId}
              schoolName={school?.name}
              adminUid={activeAccountant?.id || "accountant"}
              onSaved={() => toast.success("Razorpay Online Fee & Auto-Webhook settings saved!")}
            />
          )}

          {/* TAB 3: ONLINE & DIRECT ADMISSION */}
          {activeTab === "admissions" && (
            permissions.canAdmitStudents ? (
              <div className="h-full">
                {school && (
                  <OnlineAdmissionManager
                    school={school}
                    classes={classes}
                    sessions={sessions}
                    activeSession={activeSession}
                    isAdmin={true}
                    viewMode="admissions_only"
                    onBack={() => setActiveTab("counter")}
                  />
                )}
              </div>
            ) : (
              <div className="max-w-lg mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Admission Module Restricted</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Admin ने आपके अकाउंट के लिए Admission अनुमति बंद रखी है।
                </p>
              </div>
            )
          )}

          {/* SIBLING PROFILES TAB */}
          {activeTab === "sibling_profiles" && school && (
            <div className="max-w-6xl mx-auto space-y-4">
              <SiblingProfileManager
                school={school}
                students={students}
                classes={classes}
                activeSession={activeSession}
                onUpdateStudent={(updated) => {
                  setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                }}
                onBack={() => setActiveTab("counter")}
              />
            </div>
          )}

          {/* TAB 4: FEE DUES & DEFAULTERS */}
          {activeTab === "dues_defaulters" && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                    <span>बकाया फीस सूची • DUES ACTION CENTER</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    छात्र बकाया सूची ({defaultersList.length} Students)
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    जिन विद्यार्थियों का मासिक शुल्क लंबित है, उन्हें तुरंत व्हाट्सएप अथवा पुश अलर्ट भेजें।
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">कुल बकाया राशि</div>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    ₹ {(Number(financialSummary.monthPendingDues) || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {defaultersList.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shadow-xs">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <div className="text-base font-bold text-slate-900 dark:text-white">कोई बकाया शुल्क नहीं है!</div>
                  <div className="text-xs mt-1">सभी विद्यार्थियों ने अपना मासिक शुल्क समय पर जमा कर दिया है।</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                  {defaultersList.map(({ student, unpaidAmount, unpaidMonths }) => (
                    <div
                      key={student.id}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                          <span>{student.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            कक्षा: {student.className || "N/A"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                            Roll: {student.rollNo || "N/A"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          पिता: {student.fatherName || "N/A"} • मो.: {student.phone || "N/A"}
                        </div>
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-semibold">
                          लंबित माह: {unpaidMonths.join(", ") || "वर्तमान माह"}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">बकाया</div>
                          <div className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                            ₹ {(Number(unpaidAmount) || 0).toLocaleString("en-IN")}
                          </div>
                        </div>

                        {student.phone && (
                          <a
                            href={`https://wa.me/${student.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `प्रिय अभिभावक, ${school?.name || "विद्यालय"} में ${student.name} (कक्षा ${student.className || ""}) का मासिक शुल्क ₹${unpaidAmount} बकाया है। कृपया शीघ्र अति शीघ्र विद्यालय कार्यालय अथवा ऑनलाइन जमा करें। धन्यवाद।`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            if (!schoolId || !student.id) return;
                            setSendingNstaSlipId(student.id);
                            try {
                              const monthKey = currentMonthStr();
                              const amt = Number(unpaidAmount) || 0;
                              await autoSendFeeSlipToSchoolDesk({
                                schoolId,
                                studentId: student.id,
                                studentName: student.name,
                                className: student.className || "Class",
                                rollNo: String(student.rollNo || ""),
                                admissionNo: student.admissionNo || "",
                                slipType: "A6_DEMAND_SLIP",
                                month: monthKey,
                                monthLabel: unpaidMonths.join(", ") || monthKey,
                                amount: amt,
                                balanceDue: amt,
                                monthlyAmount: amt,
                                oldArrears: 0,
                                dueDate: "शीघ्र जमा करें",
                                payLink: school?.bankUpiId
                                  ? `upi://pay?pa=${school.bankUpiId}&pn=${encodeURIComponent(school?.name || "School")}&am=${amt}`
                                  : undefined,
                              });
                              void sendSchoolPushNotification({
                                schoolId,
                                studentIds: [student.id],
                                senderId: activeAccountant?.id || accountantId || "accountant_admin",
                                senderIds: [activeAccountant?.id, accountantId, "STAFF_ADMIN", "school_admin", "accountant_admin"].filter(Boolean) as string[],
                                senderName: activeAccountant?.name || school?.name || "School Accounts",
                                title: `बकाया फीस स्लिप: ${student.name}`,
                                body: `कुल बकाया ₹${amt.toLocaleString("en-IN")} — NSTA Messenger में स्लिप देखें।`,
                                type: "MONTHLY_FEE",
                                icon: school?.logoUrl || undefined,
                                url: "/?schoolPortal=1&schoolTab=messenger&subTab=school",
                                urgent: true,
                              }).catch(() => {});
                              setSentNstaSlipIds((prev) => ({ ...prev, [student.id]: true }));
                              toast.success(`${student.name} को बकाया फीस स्लिप NSTA Messenger पर भेज दी गई!`);
                            } catch {
                              toast.error("NSTA Messenger पर स्लिप भेजने में समस्या आई।");
                            } finally {
                              setSendingNstaSlipId(null);
                            }
                          }}
                          disabled={sendingNstaSlipId === student.id}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          title="NSTA Messenger par Fee Slip bhejein"
                        >
                          {sendingNstaSlipId === student.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : sentNstaSlipIds[student.id] ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <MessageSquare className="w-3.5 h-3.5" />
                          )}
                          <span>{sentNstaSlipIds[student.id] ? "NSTA Sent" : "NSTA Msg"}</span>
                        </button>

                        <button
                          onClick={() => setActiveTab("fee_collection")}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                        >
                          जमा करें
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DAILY CASHBOOK & SETTLEMENT */}
          {activeTab === "daybook" && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <span>दैनिक रोकड़ बही • DAYBOOK SETTLEMENT</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    दैनिक रोकड़ बही (Cash &amp; UPI Settlement)
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    आज के सभी नकदी व डिजिटल लेनदेन का मिलान व लेखा-जोखा।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    <span>प्रिंट डेबुक</span>
                  </button>
                </div>
              </div>

              {/* Daybook Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">1. कुल नकद आमदनी (Cash In)</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                    ₹ {(Number(financialSummary.todayCashFee) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    फीस व प्रवेश काउंटर से प्राप्त नकद
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 shadow-xs">
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400">2. कुल नकद निकासी/खर्च (Cash Out)</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                    ₹ {(Number(financialSummary.todayExpenseCash) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-1">
                    दैनिक वाउचरों के माध्यम से दिया गया नकद
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/40 shadow-xs">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-400">3. शुद्ध नकद शेष (Closing Cash In Hand)</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1 tabular-nums">
                    ₹ {(Number(financialSummary.netCashInHand) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">
                    तिजोरी / गल्ले में मौजूद नकद राशि
                  </div>
                </div>
              </div>

              {/* Digital Online Statement (Online QR Code vs NSTA Online) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-500/30 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Online QR Code (Counter UPI / Bank)</span>
                    </h3>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 text-lg tabular-nums">
                      ₹ {(Number(financialSummary.todayQrFee) || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    स्कूल काउंटर QR कोड / PhonePe / GPay / बैंक ट्रांसफर से प्राप्त डिजिटल राशि।
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>NSTA Online (Razorpay Gateway)</span>
                    </h3>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg tabular-nums">
                      ₹ {(Number(financialSummary.todayNstaOnlineFee) || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    अभिभावक व छात्र पोर्टल से Razorpay द्वारा ऑनलाइन जमा की गई फीस व स्कूल स्टोर राशि।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SCHOOL EXPENSE VOUCHERS */}
          {activeTab === "expenses" && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                    <span>विद्यालय खर्च लेखा • EXPENSE MANAGER</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    दैनिक खर्च वाउचर (Daily Expense Vouchers)
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    स्टेशनरी, वाहन ईंधन, मेंटेनेंस व अन्य विद्यालय खर्चों का आधिकारिक वाउचर व प्रिंट।
                  </p>
                </div>

                {permissions.canRecordExpenses && (
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>नया वाउचर बनाएं</span>
                  </button>
                )}
              </div>

              {expenses.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shadow-xs">
                  <DollarSign className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                  <div className="text-base font-bold text-slate-900 dark:text-white">कोई खर्च दर्ज नहीं किया गया है</div>
                  <div className="text-xs mt-1">पहला वाउचर दर्ज करने के लिए ऊपर "नया वाउचर बनाएं" बटन दबाएं।</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                  {expenses.map(exp => (
                    <div
                      key={exp.id}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                          <span>{exp.paidTo}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                            #{exp.voucherNo}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-medium">
                            {exp.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          दिनांक: {exp.date} • भुगतान माध्यम: {exp.paymentMode} • दर्जकर्ता: {exp.recordedBy}
                        </div>
                        {exp.description && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 italic">
                            "{exp.description}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">राशि</div>
                          <div className="font-bold text-rose-600 dark:text-rose-400 text-base tabular-nums">
                            - ₹{(Number(exp?.amount) || 0).toLocaleString("en-IN")}
                          </div>
                        </div>

                        <button
                          onClick={() => handlePrintExpenseVoucher(exp)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>प्रिंट वाउचर</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: BUS & TRANSPORT DUES */}
          {activeTab === "bus_fees" && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <span>वाहन व परिवहन शुल्क • TRANSPORT SERVICE</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    बस व वाहन शुल्क प्रबंधन (Bus &amp; Transport Fees)
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    स्कूल बस अथवा वैन सेवा लेने वाले विद्यार्थियों का शुल्क संकलन व रूट विवरण।
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                {students
                  .filter(s => s.usesBus)
                  .map(s => (
                    <div
                      key={s.id}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                          <span>{s.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium">
                            बस सेवा एक्टिव
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            कक्षा: {s.className || "N/A"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          रूट: {s.busRoute || "General Route"} • स्टॉप: {s.busStop || "School Bus Stop"} • पिता: {s.fatherName || "N/A"}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">मासिक बस शुल्क</div>
                          <div className="font-bold text-amber-600 dark:text-amber-400 text-sm tabular-nums">
                            ₹ {s.busFee || 0} / माह
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveTab("fee_collection")}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                        >
                          फीस रसीद काटें &rarr;
                        </button>
                      </div>
                    </div>
                  ))}

                {students.filter(s => s.usesBus).length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    वर्तमान में किसी विद्यार्थी के लिए बस सेवा चिह्नित नहीं है।
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: NSTA MESSENGER SUITE */}
          {activeTab === "messenger" && school && (
            <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-screen w-screen overflow-hidden">
              <NstaMessengerSuite
                school={school}
                classes={classes}
                students={students}
                teachers={teachers}
                currentUserId={accountantId || "accountant_admin"}
                currentUserName={activeAccountant?.name || "School Accountant"}
                currentUserRole="ADMIN"
                onBack={() => setActiveTab("home")}
              />
            </div>
          )}

          {/* TAB 9: SCHOOL & TEACHER RULES */}
          {activeTab === "rules_regulations" && (
            <TeacherRulesRegulationsView
              school={school}
              canEdit={false}
              currentTeacherId={accountantId || "accountant_staff"}
              currentTeacherName={activeAccountant?.name || "School Accountant"}
              currentTeacherRole={activeAccountant?.designation || "Accountant"}
              onBack={() => setActiveTab("home")}
            />
          )}
        </main>
      </div>

      {/* ── MOBILE PORTRAIT BOTTOM NAVIGATION ── */}
      {!isEffectiveLandscape && (
        <nav
          aria-label="Accountant mobile navigation"
          className={`fixed bottom-0 inset-x-0 z-40 md:hidden border-t backdrop-blur-md grid grid-cols-5 min-h-[56px] pb-[env(safe-area-inset-bottom)] ${
            isWhite
              ? "bg-white/95 border-slate-200 text-slate-600"
              : isBlack
              ? "bg-black/95 border-neutral-800 text-slate-400"
              : "bg-[#0a1935]/95 border-[#1b3564] text-slate-300"
          }`}
        >
          {[
            { id: "home", label: "Home", icon: Home },
            {
              id: permissions.canCollectFee ? "fee_collection" : "counter",
              label: permissions.canCollectFee ? "Collect Fee" : "Counter",
              icon: Receipt,
            },
            { id: "dues_defaulters", label: "Dues", icon: AlertCircle },
            {
              id: permissions.canViewDayBook ? "daybook" : "expenses",
              label: permissions.canViewDayBook ? "Cashbook" : "Expenses",
              icon: FileText,
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition cursor-pointer ${
                  isActive
                    ? isWhite
                      ? "text-indigo-600"
                      : "text-amber-400"
                    : "hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition cursor-pointer hover:text-slate-900 dark:hover:text-white"
          >
            <Menu className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </nav>
      )}

      {/* ── RECORD EXPENSE MODAL ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">नया खर्च वाउचर दर्ज करें</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">विद्यालय का दैनिक खर्च रिकॉर्ड करें</p>
                </div>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              {/* Category */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">खर्च की श्रेणी (Category)</label>
                <select
                  value={newExpense.category}
                  onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="Stationery">Stationery &amp; Paper (कागज, रजिस्टर, पेन)</option>
                  <option value="Electricity / Utilities">Electricity / Utilities (बिजली, पानी बिल)</option>
                  <option value="Maintenance & Repair">Maintenance &amp; Repair (मरम्मत, रंग-रोगन)</option>
                  <option value="Vehicle Fuel & Bus">Vehicle Fuel &amp; Bus (बस/वैन डीजल, पेट्रोल)</option>
                  <option value="Events & Functions">Events &amp; Functions (समारोह, खेलकूद)</option>
                  <option value="Staff Welfare / Refreshment">Staff Welfare / Refreshment (चाय, नाश्ता)</option>
                  <option value="Other">Other Miscellaneous (अन्य विविध खर्च)</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">खर्च राशि (₹ Amount)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="उदा. 450"
                  value={newExpense.amount}
                  onChange={e => setNewExpense({ ...newExpense, amount: e.target.value ? Number(e.target.value) : "" })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:border-indigo-500 tabular-nums"
                />
              </div>

              {/* Paid To */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">प्राप्तकर्ता का नाम (Paid To)</label>
                <input
                  type="text"
                  required
                  placeholder="उदा. श्री राम स्टेशनर्स / चालक राजू"
                  value={newExpense.paidTo}
                  onChange={e => setNewExpense({ ...newExpense, paidTo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">भुगतान माध्यम (Payment Mode)</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Cash", "UPI", "Bank Transfer", "Cheque"] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setNewExpense({ ...newExpense, paymentMode: mode })}
                      className={`py-2 px-3 rounded-xl font-semibold transition text-center cursor-pointer border ${
                        newExpense.paymentMode === mode
                          ? "bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">विवरण / टिप्पणी (Description)</label>
                <input
                  type="text"
                  placeholder="उदा. 5 रिम A4 पेपर व 10 रजिस्टर"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold transition cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-xs transition cursor-pointer"
                >
                  वाउचर सुरक्षित करें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
