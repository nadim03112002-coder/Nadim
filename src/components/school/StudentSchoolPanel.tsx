// @ts-nocheck
import React, { Suspense, useState, useEffect, useMemo, useRef } from "react";
import {
  GraduationCap,
  Calendar,
  CalendarDays,
  CalendarCheck,
  CreditCard,
  Award,
  BookOpen,
  Bell,
  BellOff,
  QrCode,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Printer,
  ChevronRight,
  ShieldCheck,
  User,
  Phone,
  MapPin,
  Camera,
  FileText,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  LogOut,
  MessageCircle,
  Home,
  Users,
  Image as ImageIcon,
  Search,
  ReceiptText,
  Youtube,
  Palmtree,
  Sun,
  Moon,
  Palette,
  Play,
  Share2,
  Heart,
  Film,
  Filter,
  Layers,
  Eye,
  EyeOff,
  RefreshCw,
  UserPlus,
  Check,
  X,
  ShoppingBag,
  Zap,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { lazyWithRetry, LazyPanelBoundary, scheduleIdlePreload } from "../../utils/lazyWithRetry";
const loadStudentFaceIdModal = () => import("./StudentFaceIdModal").then(m => ({ default: m.StudentFaceIdModal }));
const loadClassroomVideoArchive = () => import("./ClassroomVideoArchive").then(m => ({ default: m.ClassroomVideoArchive }));
const loadSchoolLucentViewer = () => import("./SchoolLucentViewer").then(m => ({ default: m.SchoolLucentViewer }));
const loadGroupStudyModal = () => import("../GroupStudyModal").then(m => ({ default: m.GroupStudyModal }));
const loadNstaMessengerSuite = () => import("./NstaMessengerSuite").then(m => ({ default: m.NstaMessengerSuite }));
const loadStudentSchoolStore = () => import("./StudentSchoolStore").then(m => ({ default: m.StudentSchoolStore }));
const loadStudentQuestionBankView = () => import("./StudentQuestionBankView").then(m => ({ default: m.StudentQuestionBankView }));

const StudentFaceIdModal = lazyWithRetry(loadStudentFaceIdModal, "Face ID");
const ClassroomVideoArchive = lazyWithRetry(loadClassroomVideoArchive, "Classroom Videos");
import { StudentDatewiseNotesView } from "./StudentDatewiseNotesView";
const SchoolLucentViewer = lazyWithRetry(loadSchoolLucentViewer, "Lesson Viewer");
import type { LucentViewerTab } from "./SchoolLucentViewer";
import { DEFAULT_SUBJECTS_BY_CLASS } from "./ClassCurriculumNotesManager";
import { CustomPlayer } from "../CustomPlayer";
const GroupStudyModal = lazyWithRetry(loadGroupStudyModal, "Online Test");
import {
  subscribeToActiveRooms,
  doesRoomMatchStudentClass,
  type GroupStudyRoom,
} from "../../services/groupStudyService";
import { FULL_SYLLABUS } from "../../syllabus_data";
import {
  loadDailyTeachingLogs,
  SYLLABUS_LOG_EVENT,
  formatShortDisplayDate,
  getTodayIsoDate,
  normalizeKeyText,
  type DailyTeachingLog,
} from "../../utils/schoolSyllabusLogEngine";
import {
  getSchool,
  getLocalStudents,
  setLocalStudents,
  getLocalClasses,
  getStudentOrAdmissionRecord,
  getLocalAttendance,
  getMonthlyAttendance,
  todayStr,
  currentMonthStr,
  getLocalFees,
  getStudentFees,
  subscribeToStudentFees,
  getLocalExams,
  getExams,
  subscribeToExams,
  subscribeToStudent,
  updateStudent,
  updateStudentPhoto,
  getHomework,
  getNotices,
  getSchoolHolidays,
  subscribeToNotices,
  subscribeToSchoolHolidays,
  subscribeToSchoolCommunityPosts,
  subscribeToTeachers,
  getClasses,
  getStudents,
  getSessions,
  getLocalSchoolCurriculumNotes,
  subscribeToSchoolCurriculumNotes,
  isDemoRecord,
  shouldUseDemoForSchool,
  type SchoolCommunityPost,
  isStudentBirthdayToday,
  dispatchOfficialSchoolBirthdayWish,
  checkAndDispatchTodaysBirthdays,
  getAccountants,
  getStaffEmployees,
  saveFeeCallFollowUp,
} from "../../school-firebase";
import { loadSchoolSettingBlob } from "../../utils/schoolCloudSync";
import { getSessionMonthCodes } from "../../utils/reAdmissionUtils";
import { getSavedSchoolLogo, getVisibleSchoolRegNo, isAppLogo, maskSensitive2Chars } from "./feeReceiptUtils";
import { formatCoveredMonthsList, formatMonthNameOnly, formatCompactDayMonth } from "../../utils/familyFeeEngine";
import { buildStudentIdCardQrUrl } from "../../utils/qrVerifyUrl";
import { getDemoSchoolDataset, isHolidayDate, isDemoDataEnabled, setDemoDataEnabled } from "./demoDataStore";
import { OfficialFeeReceiptModal } from "./OfficialFeeReceiptModal";
import { AdmissionFormPrintModal } from "./AdmissionFormPrintModal";
import { AnnualBulkFeeStatementModal } from "./AnnualBulkFeeStatementModal";
import { QrAttendanceScannerModal } from "./QrAttendanceScannerModal";
import { SchoolCommunityFeed } from "./SchoolCommunityFeed";
import { SchoolClassChannelView } from "./SchoolClassChannelView";
const NstaMessengerSuite = lazyWithRetry(loadNstaMessengerSuite, "NSTA Messenger");
import { SchoolWelcomeModal } from "./SchoolWelcomeModal";
import { SchoolBirthdayModal } from "./SchoolBirthdayModal";
import { NstaCallPortalHost } from "./NstaCallModal";
import { CallerIdSettingsCard } from "./CallerIdSettingsCard";
import { syncSchoolDirectoryToAndroid } from "../../utils/schoolCallerId";
const StudentSchoolStore = lazyWithRetry(loadStudentSchoolStore, "School Store");
const StudentQuestionBankView = lazyWithRetry(loadStudentQuestionBankView, "Question Bank");
import { AccountRecoveryCard } from "./AccountRecoveryCard";
import { downloadFeeDocument, shareFeeReceiptOnWhatsApp } from "./feeDocument";
import {
  getSchoolPushEnabledState,
  enableSchoolPushForUser,
  disableSchoolPushForUser,
  autoSyncSchoolPushIfPermitted,
  syncStudentFeeDueForPush,
  sendSchoolPushNotification,
} from "../../utils/schoolPushClient";
import { subscribeUserToPush } from "../NotificationManager";
import { hasEliteCallAccess, type School, type SchoolStudent, type SchoolTeacher, type NstaWelcomeData, type NstaBirthdayData } from "../../school-types";
import { ParentLeaveManager } from "./ParentLeaveManager";
import { PtmSchedulerModal } from "./PtmSchedulerModal";
import { AdminBusFleetRadar } from "./AdminBusFleetRadar";
import { ParentTrustDashboardCard } from "./ParentTrustDashboardCard";
import { StudentGrowthAndPortfolioView } from "./StudentGrowthAndPortfolioView";
import { StudentHealthAndSafetyView } from "./StudentHealthAndSafetyView";
import { playBusArrivalAlarmChime, checkAndTriggerBusProximity } from "../../utils/busProximityAlarm";
import { rtdb } from "../../firebase";
import { ref as dbRef, onValue } from "firebase/database";
import { getDynamicAcademicSessionLabel } from "../../utils/safeBrowserActions";
import {
  fetchSchoolRazorpayConfig,
  startStudentRazorpayFeeCheckout,
  type PublicRazorpayConfig,
} from "../../utils/razorpayCheckout";
import {
  subscribeAttendanceSchedule,
  formatTime12h,
  getLiveShiftStatus,
  DEFAULT_IN_CUTOFF_TIME,
  DEFAULT_OUT_START_TIME,
} from "../../utils/schoolAttendanceSchedule";
import { useBackHandler } from "../../utils/backNavigation";

interface Props {
  uid?: string;
  schoolId?: string;
  studentId?: string;
  studentName?: string;
  classId?: string;
  sessionId?: string;
  linkedStudent?: any;
  allLinkedStudents?: any[];
  initialTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onAddAnotherStudentQr?: () => void;
  onRemoveLinkedStudent?: (studentKey: string) => void;
  onSwitchStudent?: (studentKey: string) => void;
  onOpenPlatformContent?: () => void;
  onVisitWebsite?: () => void;
  onBack?: () => void;
  onLogout?: () => void;
  // Backward compatibility props
  students?: any[];
  onAddStudent?: any;
  onSelectForFee?: any;
}

type TabType =
  | "overview"
  | "channel"
  | "attendance"
  | "fees"
  | "exams"
  | "homework"
  | "notices"
  | "community"
  | "idcard"
  | "teachers"
  | "videos"
  | "holidays"
  | "explore_plus"
  | "growth_hub"
  | "health_safety"
  | "store"
  | "question_bank"
  | "advance"
  | "profile";

export type StudentAppTheme = "current" | "white" | "black";

export const STUDENT_THEMES_META = [
  {
    id: "current" as StudentAppTheme,
    label: "Blue",
    labelHi: "रॉयल ब्लू",
    badge: "Default",
    desc: "रॉयल नेवी ब्लू व शार्प कॉन्ट्रास्ट थीम",
    dotColor: "bg-blue-500",
  },
  {
    id: "white" as StudentAppTheme,
    label: "White",
    labelHi: "सफेद / लाइट",
    badge: "Daylight",
    desc: "हल्के रंग व गहरे बॉर्डर के साथ साफ लाइट मोड",
    dotColor: "bg-amber-400",
  },
  {
    id: "black" as StudentAppTheme,
    label: "Black",
    labelHi: "AMOLED ब्लैक",
    badge: "OLED Dark",
    desc: "शुद्ध ब्लैक मोड - आंखों का आराम व बैटरी बचत",
    dotColor: "bg-cyan-400",
  },
];

export const StudentSchoolPanel: React.FC<Props> = ({
  uid,
  schoolId = "",
  studentId,
  studentName,
  classId,
  sessionId,
  linkedStudent,
  allLinkedStudents,
  initialTab,
  onTabChange,
  onAddAnotherStudentQr,
  onRemoveLinkedStudent,
  onSwitchStudent,
  onOpenPlatformContent,
  onVisitWebsite,
  onBack,
  onLogout,
}) => {
  useEffect(() => {
    return scheduleIdlePreload([loadNstaMessengerSuite], 1800);
  }, []);

  const normalizeTab = (t?: string): TabType => {
    if (!t) return "overview";
    if (t === "updates" || t === "messenger" || t === "chat" || t === "nsta_messenger") return "channel";
    if (t === "feed" || t === "community" || t === "notices") return "overview";
    if (t === "memories" || t === "events" || t === "events_memories") return "overview";
    if (t === "explore" || t === "explore_plus") return "overview";
    if (t === "store" || t === "shop" || t === "school_store") return "store";
    if (t === "question_bank" || t === "questionbank" || t === "papers") return "question_bank";
    if (t === "advance" || t === "classwork" || t === "class_work") return "advance";
    if (t === "profile" || t === "account" || t === "settings") return "profile";
    if ([
      "overview", "channel", "attendance", "fees", "exams", "homework",
      "idcard", "teachers", "videos", "holidays",
      "growth_hub", "health_safety", "store", "question_bank", "advance", "profile"
    ].includes(t)) {
      return t as TabType;
    }
    return "overview";
  };

  const [activeTab, setActiveTab] = useState<TabType>(() => normalizeTab(initialTab));
  const [advanceTab, setAdvanceTab] = useState<"classwork" | "academic" | "online_test" | "question_bank" | "videos">("classwork");
  const [classworkDateFilter, setClassworkDateFilter] = useState<string>("ALL");
  const [classworkSubjectFilter, setClassworkSubjectFilter] = useState<string>("ALL");
  const [communityInitialFilter, setCommunityInitialFilter] = useState<"ALL" | "HOLIDAY" | "NOTICE" | "EVENT_MEDIA" | "HOMEWORK">("ALL");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get("openFeeReminder") === "1") {
          setActiveTab("fees");
          sp.delete("openFeeReminder");
          const q = sp.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
          return;
        }
      } catch {}
    }
    if (initialTab) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [initialTab]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  const effectiveUid = useMemo(() => {
    if (uid) return uid;
    try {
      const raw = localStorage.getItem("nst_current_user") || localStorage.getItem("nsta_cached_user");
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.id || p?.uid) return String(p.id || p.uid);
      }
    } catch {}
    return studentId || "guest";
  }, [uid, studentId]);

  const [pushEnabled, setPushEnabled] = useState<boolean>(() => getSchoolPushEnabledState(effectiveUid));
  const [pushBusy, setPushBusy] = useState<boolean>(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showPtmModal, setShowPtmModal] = useState<boolean>(false);
  const [confirmRemoveLinkedKey, setConfirmRemoveLinkedKey] = useState<string | null>(null);
  const [busAlarmTriggered, setBusAlarmTriggered] = useState<boolean>(false);
  const [showBusLiveMapModal, setShowBusLiveMapModal] = useState<boolean>(false);
  const lastProximityBannerRef = useRef<number>(0);

  // Student 3-Theme Switcher (White / Black / Midnight Current)
  const [studentTheme, setStudentTheme] = useState<StudentAppTheme>(() => {
    try {
      const saved = localStorage.getItem("nst_student_theme") as StudentAppTheme;
      if (saved === "white" || saved === "black" || saved === "current") return saved;
    } catch {}
    return "current";
  });
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [maskSensitiveData, setMaskSensitiveData] = useState<boolean>(false);

  const applyStudentTheme = (nextTheme: StudentAppTheme) => {
    setStudentTheme(nextTheme);
    try {
      localStorage.setItem("nst_student_theme", nextTheme);
      localStorage.setItem("nst_app_theme", nextTheme);
      localStorage.setItem("nst_dark_mode", nextTheme === "white" ? "false" : "true");
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.classList.remove(
          "student-theme-white",
          "student-theme-black",
          "student-theme-current",
          "admin-theme-white",
          "admin-theme-black",
          "admin-theme-current",
          "teacher-theme-white",
          "teacher-theme-black",
          "teacher-theme-current",
          "app-theme-white",
          "app-theme-black",
          "app-theme-current",
          "dark-mode-black",
          "dark-mode-blue"
        );
        root.classList.add(`student-theme-${nextTheme}`, `app-theme-${nextTheme}`);
        root.dataset.nstErpTheme = nextTheme;
        if (nextTheme === "white") {
          root.classList.remove("dark", "dark-mode");
          document.body.classList.remove("dark-mode");
          document.body.style.backgroundColor = "#eef2f7";
        } else if (nextTheme === "black") {
          root.classList.add("dark", "dark-mode", "dark-mode-black");
          document.body.classList.add("dark-mode");
          document.body.style.backgroundColor = "#000000";
        } else {
          root.classList.add("dark", "dark-mode", "dark-mode-blue");
          document.body.classList.add("dark-mode");
          document.body.style.backgroundColor = "#08142c";
        }
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
          metaTheme = document.createElement("meta");
          metaTheme.setAttribute("name", "theme-color");
          document.head.appendChild(metaTheme);
        }
        metaTheme.setAttribute(
          "content",
          nextTheme === "white" ? "#eef2f7" : nextTheme === "black" ? "#000000" : "#08142c"
        );
      }
      window.dispatchEvent(new Event("nst-dark-theme-change"));
    } catch {}
  };

  useEffect(() => {
    if (!rtdb || !schoolId || !studentId) return;
    let homePin: { lat: number; lng: number; label: string } | null = null;

    const readCachedPin = () => {
      try {
        const raw = localStorage.getItem(`nst_student_home_pins_${schoolId}`);
        if (raw) {
          const obj = JSON.parse(raw) || {};
          const entry = obj[studentId];
          if (entry && Number.isFinite(Number(entry.homeLat)) && Number.isFinite(Number(entry.homeLng))) {
            homePin = {
              lat: Number(entry.homeLat),
              lng: Number(entry.homeLng),
              label: entry.homeAddress || "आपके घर/स्टॉप",
            };
          }
        }
      } catch {}
    };
    readCachedPin();

    const evaluateBusMap = (busMap: Record<string, any> | null) => {
      if (!busMap || !homePin) return;
      Object.values(busMap).forEach((bus: any) => {
        if (!bus || bus.tripStatus !== "started") return;
        const bLat = Number(bus.latitude);
        const bLng = Number(bus.longitude);
        if (!Number.isFinite(bLat) || !Number.isFinite(bLng) || (Math.abs(bLat) < 0.001 && Math.abs(bLng) < 0.001)) {
          return;
        }
        const prox = checkAndTriggerBusProximity(
          { lat: bLat, lng: bLng },
          { lat: homePin!.lat, lng: homePin!.lng },
          homePin!.label,
          bus.busNumber || "School Bus"
        );
        if (prox.isWithinRange) {
          setBusAlarmTriggered(true);
          setTimeout(() => setBusAlarmTriggered(false), 6000);
          if (Date.now() - lastProximityBannerRef.current > 60000) {
            lastProximityBannerRef.current = Date.now();
            toast.success(`🚌 ${bus.busNumber || "स्कूल बस"} आपके स्टॉप से सिर्फ ${prox.distanceKm} KM दूर है!`, {
              duration: 7000,
            });
          }
        }
      });
    };

    const unsubPin = onValue(
      dbRef(rtdb, `schools/${schoolId}/student_home_pins/${studentId}`),
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (Number.isFinite(Number(val?.homeLat)) && Number.isFinite(Number(val?.homeLng))) {
            homePin = {
              lat: Number(val.homeLat),
              lng: Number(val.homeLng),
              label: val.homeAddress || "आपके घर/स्टॉप",
            };
          }
        }
      }
    );

    const unsubLoc2 = onValue(dbRef(rtdb, `school_bus_locations/${schoolId}`), (snap) => {
      if (snap.exists()) evaluateBusMap(snap.val());
    });

    return () => {
      unsubPin();
      unsubLoc2();
    };
  }, [schoolId, studentId]);

  useEffect(() => {
    applyStudentTheme(studentTheme);
    return () => {
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.classList.remove(
          "student-theme-white",
          "student-theme-black",
          "student-theme-current",
          "admin-theme-white",
          "admin-theme-black",
          "admin-theme-current",
          "teacher-theme-white",
          "teacher-theme-black",
          "teacher-theme-current",
          "app-theme-white",
          "app-theme-black",
          "app-theme-current",
          "dark-mode-black",
          "dark-mode-blue"
        );
        delete root.dataset.nstErpTheme;
      }
    };
  }, []);

  const handleStudentLogout = () => {
    try {
      localStorage.removeItem("nst_current_user");
      localStorage.removeItem("nsta_cached_user");
      localStorage.removeItem("nst_is_guest");
      localStorage.setItem("nst_logged_out", "true");
    } catch (e) {}
    if (onLogout) {
      onLogout();
    } else if (onBack) {
      onBack();
    } else {
      window.location.reload();
    }
  };
  const [school, setSchool] = useState<School | null>(null);
  const [schoolSessions, setSchoolSessions] = useState<any[]>([]);
  const [allSchoolStudents, setAllSchoolStudents] = useState<SchoolStudent[]>(() =>
    schoolId ? getLocalStudents(schoolId) : []
  );
  const [selectedSessionStudentId, setSelectedSessionStudentId] = useState<string | null>(null);
  const [selectedFeeForReceipt, setSelectedFeeForReceipt] = useState<any | null>(null);
  const [feeModalFormat, setFeeModalFormat] = useState<"a6" | "pos">("pos");
  const [feeViewMode, setFeeViewMode] = useState<"cards" | "table">("cards");
  const [showPreAdmissionMonths, setShowPreAdmissionMonths] = useState<boolean>(false);
  const [selectedAdmissionModal, setSelectedAdmissionModal] = useState<{
    isOpen: boolean;
    mode: "receipt_only" | "form_only" | "combined";
    feeRecord?: any;
  } | null>(null);
  const [showBulkFeeModal, setShowBulkFeeModal] = useState(false);
  const [showQrAttendanceScanner, setShowQrAttendanceScanner] = useState(false);
  const [attendanceSuccessMsg, setAttendanceSuccessMsg] = useState<string | null>(null);
  const [liveFees, setLiveFees] = useState<any[]>([]);
  const [liveExams, setLiveExams] = useState<any[]>([]);
  const [liveAttendanceRecords, setLiveAttendanceRecords] = useState<any[]>([]);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [razorpayConfig, setRazorpayConfig] = useState<PublicRazorpayConfig | null>(null);
  const [payingFeeKey, setPayingFeeKey] = useState<string | null>(null);
  const [attendanceSchedule, setAttendanceSchedule] = useState({
    inCutoffTime: DEFAULT_IN_CUTOFF_TIME,
    outStartTime: DEFAULT_OUT_START_TIME,
  });

  // ── Holidays states
  const [holidaysFilter, setHolidaysFilter] = useState<string>("ALL");
  const [holidaysSearch, setHolidaysSearch] = useState<string>("");
  const [showAllHolidaysModal, setShowAllHolidaysModal] = useState<boolean>(false);

  // ── Notification and Student Switcher Modals
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);
  const [showStudentSwitcherModal, setShowStudentSwitcherModal] = useState<boolean>(false);
  const [welcomeModalData, setWelcomeModalData] = useState<NstaWelcomeData | null>(null);

  // ── Face ID 30-Day Biometric State
  const [showFaceIdModal, setShowFaceIdModal] = useState<boolean>(false);
  // ── Live Study Room & Academic Syllabus states
  const [liveOnlineRooms, setLiveOnlineRooms] = useState<GroupStudyRoom[]>([]);
  const [showClassSyllabusModal, setShowClassSyllabusModal] = useState<boolean>(false);
  const [selectedSyllabusSubject, setSelectedSyllabusSubject] = useState<string | null>(null);
  const [selectedChapterNotes, setSelectedChapterNotes] = useState<{ title: string; subject: string; classLevel: string; content?: string } | null>(null);
  const [lastFaceUpdate, setLastFaceUpdate] = useState<string | null>(() => {
    try {
      const stId = studentId || "student";
      return localStorage.getItem(`nst_face_last_update_${stId}`) || null;
    } catch {
      return null;
    }
  });

  const faceIdDaysRemaining = (() => {
    if (!lastFaceUpdate) return 0;
    try {
      const last = new Date(lastFaceUpdate).getTime();
      const elapsedDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
      return Math.max(0, Math.ceil(30 - elapsedDays));
    } catch {
      return 0;
    }
  })();

  // Check for newly created ID or scan-login welcome celebration trigger
  useEffect(() => {
    try {
      const pendingKey = `nst_show_welcome_popup_${studentId}`;
      const hasPopup = localStorage.getItem(pendingKey);
      if (hasPopup) {
        localStorage.removeItem(pendingKey);
        let parsed: NstaWelcomeData | null = null;
        try {
          parsed = JSON.parse(hasPopup);
        } catch {}
        if (!parsed || typeof parsed !== "object") {
          try {
            const rawStored = localStorage.getItem("nst_pending_welcome_student");
            if (rawStored) parsed = JSON.parse(rawStored);
          } catch {}
        }
        if (!parsed || !parsed.studentName) {
          parsed = {
            studentId: studentId || "std",
            studentName: studentName || "Student",
            admissionNo: "ADM-001",
            rollNo: "01",
            className: "Class 10",
            schoolName: "NSTA Digital School",
            issuedAt: new Date().toISOString(),
          };
        }
        setWelcomeModalData(parsed);
      }
    } catch {}
  }, [studentId, studentName]);

  useEffect(() => {
    const handleWelcomeEvent = (e: any) => {
      if (e?.detail) {
        setWelcomeModalData(e.detail);
      }
    };
    window.addEventListener("nst-school-welcome-received", handleWelcomeEvent);
    return () => window.removeEventListener("nst-school-welcome-received", handleWelcomeEvent);
  }, []);



  // Load demo dataset for fallback / syllabus / calendar
  const dataset = useMemo(() => getDemoSchoolDataset(), []);

  // Load all school sessions and local student lineage records (never download full school student roster for a student)
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    getSessions(schoolId)
      .then((sess) => {
        if (!cancelled && Array.isArray(sess)) {
          setSchoolSessions(sess.filter((s) => s && !s.isDemo));
        }
      })
      .catch(() => {});
    const localRoster = getLocalStudents(schoolId);
    if (Array.isArray(localRoster) && localRoster.length > 0) {
      setAllSchoolStudents(localRoster);
    }
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  useEffect(() => {
    setSelectedSessionStudentId(null);
  }, [studentId, linkedStudent?.id, linkedStudent?.admissionNo]);

  // Build complete multi-session lineage chain for the logged-in student (old + re-admitted sessions)
  const studentLineageRecords: SchoolStudent[] = useMemo(() => {
    let sessionUser: any = null;
    try {
      const rawUser = localStorage.getItem("nst_current_user") || localStorage.getItem("nsta_cached_user");
      if (rawUser) sessionUser = JSON.parse(rawUser);
    } catch {}

    const localStudents = getLocalStudents(schoolId);
    const poolMap = new Map<string, SchoolStudent>();
    [...localStudents, ...allSchoolStudents].forEach((s) => {
      if (s && s.id && s.active !== false && !(s as any).isDeleted) {
        poolMap.set(s.id, s);
      }
    });
    const pool = Array.from(poolMap.values());

    const matchId = studentId || linkedStudent?.id || sessionUser?.id || sessionUser?.studentId || sessionUser?.uid;
    const matchAdm = (linkedStudent?.admissionNo || sessionUser?.admissionNo || "").trim().toLowerCase();

    const matchedIds = new Set<string>();
    if (matchId) matchedIds.add(matchId);
    if (linkedStudent?.previousStudentId) matchedIds.add(linkedStudent.previousStudentId);

    // Expand linked IDs iteratively across previousStudentId <-> id and matching admissionNo
    let changed = true;
    for (let pass = 0; pass < 6 && changed; pass++) {
      changed = false;
      for (const s of pool) {
        const sAdm = (s.admissionNo || "").trim().toLowerCase();
        const isLinked =
          matchedIds.has(s.id) ||
          (s.previousStudentId && matchedIds.has(s.previousStudentId)) ||
          (matchAdm && sAdm && sAdm === matchAdm) ||
          pool.some((m) => matchedIds.has(m.id) && m.previousStudentId === s.id);
        if (isLinked && !matchedIds.has(s.id)) {
          matchedIds.add(s.id);
          changed = true;
        }
      }
    }

    const lineage = pool.filter((s) => matchedIds.has(s.id));
    if (lineage.length <= 1) return lineage;

    const prevIdSet = new Set(lineage.map((s) => s.previousStudentId).filter(Boolean));
    return [...lineage].sort((a, b) => {
      // Latest active node (not pointed to as a previousStudentId by another node) always first
      const aIsOld = prevIdSet.has(a.id) ? 1 : 0;
      const bIsOld = prevIdSet.has(b.id) ? 1 : 0;
      if (aIsOld !== bIsOld) return aIsOld - bIsOld;
      const aDate = a.reAdmissionDate || a.createdAt || a.joinDate || "";
      const bDate = b.reAdmissionDate || b.createdAt || b.joinDate || "";
      return bDate.localeCompare(aDate);
    });
  }, [schoolId, studentId, linkedStudent, allSchoolStudents]);

  // Find this student record from lineage, local school database, session cache, or dataset
  const currentStudent: SchoolStudent = useMemo(() => {
    // 0. Check cached logged in user from localStorage
    let sessionUser: any = null;
    try {
      const rawUser = localStorage.getItem("nst_current_user") || localStorage.getItem("nsta_cached_user");
      if (rawUser) sessionUser = JSON.parse(rawUser);
    } catch {}

    const localStudents = getLocalStudents(schoolId);
    const localClasses = getLocalClasses(schoolId);

    // Look up by studentId, admissionNo, linkedStudent, or sessionUser identity
    const matchId = studentId || linkedStudent?.id || sessionUser?.id || sessionUser?.studentId || sessionUser?.uid;
    const matchName = studentName || linkedStudent?.name || sessionUser?.name;
    const matchAdm = linkedStudent?.admissionNo || sessionUser?.admissionNo;
    const matchRoll = linkedStudent?.rollNo || sessionUser?.rollNo || sessionUser?.displayId?.replace("ROLL-", "");

    // Heal any student record whose className was previously polluted by rollNo (e.g. "01" instead of "Nursery")
    const healStudentRecord = (rec: any): SchoolStudent => {
      if (!rec) return rec;
      const healed = { ...rec };
      const rawClsName = typeof healed.className === "string" ? healed.className.trim() : "";
      const rawRoll = typeof healed.rollNo === "string" ? healed.rollNo.trim() : "";
      const isBogusRollClass =
        Boolean(rawClsName) &&
        ((rawRoll && rawClsName === rawRoll && /^0?\d+$/.test(rawClsName) && (healed.classId || "").toLowerCase().includes("nursery")) ||
          /^0\d+$/.test(rawClsName) ||
          /^class\s+0\d+$/i.test(rawClsName));

      if (isBogusRollClass) {
        const clsObj = localClasses.find((c) => c.id === healed.classId);
        const linkedCls =
          linkedStudent?.className &&
          !/^0\d+$/.test(String(linkedStudent.className).trim()) &&
          !/^class\s+0\d+$/i.test(String(linkedStudent.className).trim())
            ? linkedStudent.className
            : undefined;
        healed.className =
          clsObj?.name ||
          linkedCls ||
          ((healed.classId || "").toLowerCase().includes("nursery") ? "Nursery" : undefined);

        try {
          const targetSid = healed.schoolId || schoolId;
          const pool = getLocalStudents(targetSid);
          if (pool.some((p) => p.id === healed.id)) {
            setLocalStudents(
              targetSid,
              pool.map((p) => (p.id === healed.id ? { ...p, className: healed.className } : p))
            );
          }
        } catch {}
      }

      if (linkedStudent) {
        if (!healed.className && linkedStudent.className && !/^0\d+$/.test(String(linkedStudent.className).trim())) {
          healed.className = linkedStudent.className;
        }
        if (!healed.fatherName && linkedStudent.fatherName) healed.fatherName = linkedStudent.fatherName;
        if (!healed.motherName && linkedStudent.motherName) healed.motherName = linkedStudent.motherName;
        if (!healed.schoolName && linkedStudent.schoolName) healed.schoolName = linkedStudent.schoolName;
        if ((!healed.monthlyFee || healed.monthlyFee <= 0) && Number(linkedStudent.monthlyFee) > 0) {
          healed.monthlyFee = Number(linkedStudent.monthlyFee);
        }
      }
      return healed;
    };

    // 0. Prioritize multi-session lineage resolution (defaults to newest re-admitted session, or user-selected session)
    if (studentLineageRecords.length > 0) {
      const chosenFromLineage =
        (selectedSessionStudentId
          ? studentLineageRecords.find((s) => s.id === selectedSessionStudentId)
          : null) || studentLineageRecords[0];
      if (chosenFromLineage) return healStudentRecord(chosenFromLineage);
    }

    // 1. Match in current school's local student pool by unique ID or unique Admission No
    if (matchId) {
      const foundLocal = localStudents.find(
        (s) => s.id === matchId || (s.admissionNo && matchAdm && s.admissionNo.toLowerCase() === matchAdm.toLowerCase())
      );
      if (foundLocal) return healStudentRecord(foundLocal);
    }
    if (matchAdm) {
      const foundByAdm = localStudents.find(
        (s) => s.admissionNo && s.admissionNo.toLowerCase() === matchAdm.toLowerCase()
      );
      if (foundByAdm) return healStudentRecord(foundByAdm);
    }
    if (matchName) {
      const foundLocalByName = localStudents.find(
        (s) => s.name && s.name.trim().toLowerCase() === matchName.trim().toLowerCase()
      );
      if (foundLocalByName) return healStudentRecord(foundLocalByName);
    }

    // 2. If linkedStudent was passed directly from SchoolEcosystem QR/ID login, use it directly
    if (linkedStudent && (linkedStudent.id || linkedStudent.admissionNo || linkedStudent.name)) {
      return healStudentRecord(linkedStudent);
    }

    // 3. Check demo dataset ONLY when demo data is enabled for the default demo school
    const studentsList = (shouldUseDemoForSchool(schoolId) && Array.isArray(dataset?.students)) ? dataset.students : [];
    if (matchId) {
      const found = studentsList.find(
        (s) => s.id === matchId || (s.admissionNo && matchAdm && s.admissionNo.toLowerCase() === matchAdm.toLowerCase())
      );
      if (found) return found;
    }
    if (matchAdm) {
      const found = studentsList.find(
        (s) => s.admissionNo && s.admissionNo.toLowerCase() === matchAdm.toLowerCase()
      );
      if (found) return found;
    }
    if (matchName) {
      const foundByName = studentsList.find(
        (s) => s.name && s.name.trim().toLowerCase() === matchName.trim().toLowerCase()
      );
      if (foundByName) return foundByName;
    }

    // 5. CRITICAL: If student is logged in or provided by name/props, construct their authentic record!
    if (matchName || matchAdm || matchId) {
      const rawSessionCls = String(
        (sessionUser as any)?.className || sessionUser?.classLevel || linkedStudent?.className || ""
      ).trim();
      const matchedClsObj = localClasses.find(
        (c) => c.id === ((sessionUser as any)?.classId || classId)
      );
      const cleanSessionCls =
        matchedClsObj?.name ||
        (rawSessionCls &&
        !/^0\d+$/.test(rawSessionCls) &&
        !/^class\s+0\d+$/i.test(rawSessionCls)
          ? rawSessionCls
          : undefined);

      const safeStudent: SchoolStudent = {
        id: matchId || `std_${Date.now()}`,
        schoolId: sessionUser?.schoolId || schoolId,
        schoolName: sessionUser?.schoolName || (sessionUser as any)?.school || "School",
        sessionId: sessionId || "",
        classId: (sessionUser as any)?.classId || classId || sessionUser?.classLevel || "",
        className: cleanSessionCls,
        name: matchName || sessionUser?.name || "Student",
        rollNo: matchRoll || (matchId?.startsWith("ROLL-") ? matchId.replace("ROLL-", "") : ""),
        admissionNo: matchAdm || sessionUser?.admissionNo || `ADM-${(matchId || "26").slice(-6).toUpperCase()}`,
        fatherName: sessionUser?.fatherName || "",
        motherName: sessionUser?.motherName || "",
        phone: sessionUser?.mobile || sessionUser?.phone || "",
        bloodGroup: sessionUser?.bloodGroup || undefined,
        dateOfBirth: (sessionUser as any)?.dateOfBirth || undefined,
        address: (sessionUser as any)?.address || undefined,
        monthlyFee: (typeof sessionUser?.monthlyFee === "number" && sessionUser.monthlyFee > 0)
          ? sessionUser.monthlyFee
          : 0,
        photoUrl: sessionUser?.photoURL || sessionUser?.photoUrl || "",
        active: true,
        createdAt: new Date().toISOString(),
      };

      try {
        const cur = getLocalStudents(safeStudent.schoolId);
        if (!cur.some(s => s.id === safeStudent.id || (s.admissionNo && s.admissionNo === safeStudent.admissionNo))) {
          setLocalStudents(safeStudent.schoolId, [safeStudent, ...cur]);
        }
      } catch (err) {
        console.warn("[StudentSchoolPanel] Failed syncing student cache:", err);
      }

      return safeStudent;
    }

    // Fallback demo student ONLY when demo mode is active for this school
    const fallbackPool = Array.isArray(dataset?.students) ? dataset.students : [];
    const class10Student = shouldUseDemoForSchool(schoolId)
      ? fallbackPool.find(
          (s) =>
            s.classId === "demo_class_c10_sec_a" ||
            (s.classId?.includes("c10") && (!s.section || s.section === "A")) ||
            (s.classId === "cls_10" && s.section === "A")
        ) || fallbackPool[0]
      : null;

    return (
      class10Student || {
        id: studentId || "student_guest",
        schoolId,
        sessionId: sessionId || "",
        classId: classId || "",
        name: studentName || "Student",
        rollNo: "",
        admissionNo: "",
        fatherName: "",
        motherName: "",
        phone: "",
        monthlyFee: 0,
        active: true,
        createdAt: new Date().toISOString(),
      }
    );
  }, [studentId, studentName, classId, sessionId, schoolId, linkedStudent, dataset, studentLineageRecords, selectedSessionStudentId]);

  // Synchronize background details from remote Firestore or Admissions
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [liveStudentData, setLiveStudentData] = useState<Partial<SchoolStudent> | null>(null);

  useEffect(() => {
    setEnrichedData(null);
    setLiveStudentData(null);
    setLiveFees([]);
  }, [currentStudent?.id]);

  useEffect(() => {
    if (!currentStudent) return;
    if (!currentStudent.fatherName || !(currentStudent as any).className || !currentStudent.motherName) {
      getStudentOrAdmissionRecord(schoolId, {
        id: currentStudent.id,
        admissionNo: currentStudent.admissionNo,
        name: currentStudent.name,
        phone: currentStudent.phone
      }).then((extra) => {
        if (extra) {
          setEnrichedData(extra);
        }
      }).catch(() => {});
    }
  }, [schoolId, currentStudent?.id, currentStudent?.admissionNo, currentStudent?.name]);

  // ── REAL-TIME LIVE SYNC WITH SCHOOL ADMIN DATABASE ──────────────────────────
  useEffect(() => {
    if (!schoolId || !currentStudent?.id) return;
    const unsub = subscribeToStudent(schoolId, currentStudent.id, (freshStudent) => {
      if (freshStudent) {
        const stStatus = typeof (freshStudent as any).status === "string" ? (freshStudent as any).status.trim().toLowerCase() : "";
        if (
          freshStudent.active === false ||
          (freshStudent as any).isDeleted === true ||
          stStatus === "deleted"
        ) {
          if (onRemoveLinkedStudent) {
            const key = `${freshStudent.schoolId || schoolId}__${freshStudent.id}`;
            onRemoveLinkedStudent(key);
          }
          toast.info(`${freshStudent.name || currentStudent.name} का डेटा स्कूल से हटाया जा चुका है।`);
          return;
        }
        setLiveStudentData((prev: any) => ({
          ...prev,
          ...freshStudent,
          // Preserve authentic monthlyFee when admin updates it in School Admin ERP
          monthlyFee:
            typeof freshStudent.monthlyFee === "number" && freshStudent.monthlyFee > 0
              ? freshStudent.monthlyFee
              : (prev?.monthlyFee ?? currentStudent.monthlyFee),
        }));
      }
    });
    return () => unsub();
  }, [schoolId, currentStudent?.id, currentStudent?.monthlyFee]);

  const activeStudent: SchoolStudent = useMemo(() => {
    return {
      ...currentStudent,
      ...(enrichedData || {}),
      ...(liveStudentData || {})
    };
  }, [currentStudent, enrichedData, liveStudentData]);

  const activePhoto = studentPhoto || activeStudent.photoUrl || (activeStudent as any).photoURL || "";

  const studentInitials = useMemo(() => {
    const n = activeStudent.name || "Student";
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [activeStudent.name]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setStudentPhoto(dataUrl);
      const finalUrl = await updateStudentPhoto(schoolId, activeStudent.id, dataUrl);
      const resolvedUrl = finalUrl || dataUrl;
      setStudentPhoto(resolvedUrl);
      activeStudent.photoUrl = resolvedUrl;
      const cur = getLocalStudents(schoolId);
      setLocalStudents(
        schoolId,
        cur.map((s) => (s.id === activeStudent.id || s.admissionNo === activeStudent.admissionNo ? { ...s, photoUrl: resolvedUrl } : s))
      );
      if (resolvedUrl && !resolvedUrl.startsWith("data:image/")) {
        try {
          const u = localStorage.getItem("nst_current_user");
          if (u) {
            const parsed = JSON.parse(u);
            parsed.photoURL = resolvedUrl;
            localStorage.setItem("nst_current_user", JSON.stringify(parsed));
          }
        } catch {}
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExploreFullApp = () => {
    if (!onOpenPlatformContent) return;
    try {
      localStorage.setItem("nst_app_view_mode", "STUDENT");
      window.dispatchEvent(new CustomEvent("nst_open_student_dashboard"));
    } catch {}
    onOpenPlatformContent();
  };

  const [classesList, setClassesList] = useState<any[]>(() => schoolId ? getLocalClasses(schoolId) : []);
  const [demoEnabled, setDemoEnabled] = useState<boolean>(() => isDemoDataEnabled());
  const schoolDemoActive = demoEnabled && shouldUseDemoForSchool(schoolId);

  useEffect(() => {
    const handleDemoChange = (e: any) => {
      if (typeof e?.detail?.enabled === "boolean") {
        setDemoEnabled(e.detail.enabled);
      }
    };
    window.addEventListener("nst_demo_toggle_changed", handleDemoChange);
    return () => window.removeEventListener("nst_demo_toggle_changed", handleDemoChange);
  }, []);

  const handleToggleDemo = (newVal: boolean) => {
    setDemoDataEnabled(newVal);
    setDemoEnabled(newVal);
  };

  useEffect(() => {
    if (!schoolId) return;
    getClasses(schoolId).then((cls) => {
      if (cls && cls.length > 0) setClassesList(cls);
    }).catch(() => {});
  }, [schoolId]);

  const allStudentsInSchool = useMemo(() => {
    const local = getLocalStudents(schoolId) || [];
    const demo = (shouldUseDemoForSchool(schoolId) && Array.isArray(dataset?.students)) ? dataset.students : [];
    const combined = [...local];
    demo.forEach((d) => {
      if (d && !combined.some((c) => c && (c.id === d.id || (c.admissionNo && c.admissionNo === d.admissionNo)))) {
        combined.push(d);
      }
    });
    if (activeStudent && !combined.some((c) => c && c.id === activeStudent.id)) {
      combined.unshift(activeStudent);
    }
    return combined;
  }, [schoolId, dataset?.students, activeStudent]);

  const studentClassLabel = useMemo(() => {
    const isBogusZeroRoll = (val?: string) => {
      if (!val || typeof val !== "string") return true;
      const t = val.trim();
      if (!t || t.startsWith("cls_")) return true;
      if (/^0\d+$/.test(t) || /^class\s+0\d+$/i.test(t)) return true;
      return false;
    };

    // 1. Check available School Admin classes first by exact classId so Admin renames/assignments win
    const localSchoolClasses = schoolId ? getLocalClasses(schoolId) : [];
    const schoolClasses = school?.classes || [];
    const datasetClasses = (schoolDemoActive && Array.isArray(dataset?.classes)) ? dataset.classes : [];
    const allClasses = [...classesList, ...localSchoolClasses, ...schoolClasses, ...datasetClasses];

    const targetClassId = activeStudent?.classId || (activeStudent as any)?.classLevel || linkedStudent?.classId;
    if (targetClassId) {
      const foundCls = allClasses.find(
        (c) => c.id === targetClassId || c.name?.toLowerCase() === String(targetClassId).toLowerCase()
      );
      if (foundCls?.name) {
        return foundCls.name.trim();
      }
    }

    // 2. Direct human-readable class name if present on student or linkedStudent
    const directName =
      (activeStudent as any)?.className ||
      linkedStudent?.className ||
      (activeStudent as any)?.classGrade ||
      (currentStudent as any)?.className;

    if (directName && typeof directName === "string" && !isBogusZeroRoll(directName) && directName.length < 24) {
      return directName.trim();
    }

    // 3. Check if targetClassId encodes Nursery / LKG / UKG / standard class
    if (targetClassId && typeof targetClassId === "string") {
      const lowerId = targetClassId.toLowerCase();
      if (lowerId.includes("pre_nursery") || lowerId.includes("prenursery")) return "Pre-Nursery";
      if (lowerId.includes("nursery")) return "Nursery";
      if (lowerId.includes("lkg")) return "LKG";
      if (lowerId.includes("ukg")) return "UKG";

      const isCrypticId = targetClassId.length >= 14 && /[A-Z]/.test(targetClassId) && /[0-9]/.test(targetClassId);
      if (!isCrypticId) {
        const clean = targetClassId
          .replace(/^cls_/i, "")
          .replace(/_/g, " ")
          .trim();
        if (clean && clean.toLowerCase() !== "demo class c10 sec a") {
          return clean.charAt(0).toUpperCase() + clean.slice(1);
        }
      }
    }

    // 4. Check session user in localStorage if valid
    try {
      const rawUser = localStorage.getItem("nst_current_user") || localStorage.getItem("nsta_cached_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.className && !isBogusZeroRoll(parsed.className)) {
          return parsed.className.trim();
        }
      }
    } catch {}

    return "Nursery";
  }, [activeStudent, linkedStudent, dataset, school, schoolId, classesList, demoEnabled, currentStudent]);

  // Format label so it never displays duplicate "Class Class 9" or "Class Nursery"
  const formatClassLabel = (label?: string): string => {
    if (!label) return "Nursery";
    const clean = label.trim();
    if (/^Class\s+/i.test(clean)) return clean;
    if (/^(Nursery|Pre-?Nursery|LKG|UKG|KG|Play|Prep)/i.test(clean)) return clean;
    return `Class ${clean}`;
  };


  // Load school info
  useEffect(() => {
    getSchool(schoolId)
      .then((s) => {
        if (s) setSchool(s);
      })
      .catch(() => {});
  }, [schoolId]);

  // ── Strict Class Lock for Student Portal (Nursery, LKG, UKG, Class 1–12) ──
  const cleanClassNum = useMemo(() => {
    const raw = formatClassLabel(studentClassLabel) || "";
    if (/nursery|play/i.test(raw)) return "Nursery";
    if (/l\.?k\.?g|kg[\s-]?1/i.test(raw)) return "LKG";
    if (/u\.?k\.?g|kg[\s-]?2/i.test(raw)) return "UKG";
    const match = raw.match(/\d+/);
    if (match) return match[0];
    return "Nursery";
  }, [studentClassLabel]);

  // Student is strictly locked to their enrolled class (zero class switching allowed)
  const selectedClassLevel = cleanClassNum;
  const isSelectedBoardClass = selectedClassLevel === '10' || selectedClassLevel === '12';

  // Subscribe to live Online Tests and auto-filter by student's school & enrolled class
  useEffect(() => {
    const unsub = subscribeToActiveRooms((rooms) => {
      setLiveOnlineRooms(Array.isArray(rooms) ? rooms : []);
    });
    return () => unsub();
  }, []);

  const matchedClassOnlineRooms = useMemo(() => {
    const stuClassId = linkedStudent?.classId || currentStudent?.classId || "";
    return liveOnlineRooms
      .filter((r) => doesRoomMatchStudentClass(r, schoolId, selectedClassLevel, stuClassId))
      .sort((a, b) => {
        const aSchool = a.schoolId && schoolId && a.schoolId === schoolId ? 1 : 0;
        const bSchool = b.schoolId && schoolId && b.schoolId === schoolId ? 1 : 0;
        if (aSchool !== bSchool) return bSchool - aSchool;
        return (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0);
      });
  }, [liveOnlineRooms, schoolId, selectedClassLevel, linkedStudent?.classId, currentStudent?.classId]);

  const classEmojis: Record<string, string> = {
    'Nursery': '🧸',
    'LKG': '🖍️',
    'UKG': '🎈',
    '1': '🌱',
    '2': '✏️',
    '3': '🎨',
    '4': '🧩',
    '5': '🔬',
    '6': '📖',
    '7': '🧪',
    '8': '🌍',
    '9': '📚',
    '10': '🏆',
    '11': '🚀',
    '12': '🎓',
  };

  const [showSchoolSyllabusModal, setShowSchoolSyllabusModal] = useState<boolean>(false);
  const [selectedSchoolSubject, setSelectedSchoolSubject] = useState<string | null>(null);
  const [selectedSchoolNote, setSelectedSchoolNote] = useState<any | null>(null);
  const [selectedNoteInitialTab, setSelectedNoteInitialTab] = useState<LucentViewerTab>("reading");

  // School-specific curriculum notes (strictly for this schoolId) — live-synced from IndexedDB + Cloud
  const [schoolCurriculumNotes, setSchoolCurriculumNotes] = useState<any[]>(() => {
    if (!schoolId) return [];
    return getLocalSchoolCurriculumNotes(schoolId);
  });

  useEffect(() => {
    if (!schoolId) {
      setSchoolCurriculumNotes([]);
      return;
    }
    const unsub = subscribeToSchoolCurriculumNotes(schoolId, (notes) => {
      setSchoolCurriculumNotes(Array.isArray(notes) ? notes : []);
    });
    return () => unsub();
  }, [schoolId]);

  // Notes filtered strictly to this school and the selected class
  const schoolClassNotes = useMemo(() => {
    const normalizeLvl = (val: any) =>
      String(val || '')
        .replace(/^(cls_|class\s*)/i, '')
        .trim()
        .toLowerCase();
    const targetLvl = normalizeLvl(selectedClassLevel);
    return schoolCurriculumNotes.filter((n: any) => {
      if (!n) return false;
      const noteClass = normalizeLvl(n.classLevel || n.classId);
      return noteClass === targetLvl;
    });
  }, [schoolCurriculumNotes, selectedClassLevel]);

  // Helper to extract unified pages, plain text summary, media attachments & MCQs from either LucentNoteEntry (pages[]) or flat legacy note objects
  const extractNoteDetails = (note: any) => {
    if (!note) {
      return {
        title: 'Class Note',
        pages: [] as any[],
        mcqs: [] as any[],
        summaryText: '',
        hasPdf: false,
        mediaItems: [] as Array<{ pageNo: string; pdfUrl?: string; videoUrl?: string; audioUrl?: string }>,
      };
    }
    const pages: any[] = Array.isArray(note.pages) ? note.pages : [];
    const stripTags = (html: string) =>
      String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h1|h2|h3|h4)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const pageTexts = pages
      .map((p: any) => (p?.chunkNotes || p?.content || stripTags(p?.htmlNotes || '')).trim())
      .filter(Boolean);
    const flatText = String(note.content || note.description || note.chunkNotes || stripTags(note.htmlNotes || '')).trim();
    const summaryText = pageTexts[0] || flatText || '';

    const mcqs: any[] = [
      ...(Array.isArray(note.mcqs) ? note.mcqs : Array.isArray(note.questions) ? note.questions : []),
      ...pages.flatMap((p: any) => (Array.isArray(p?.mcqs) ? p.mcqs : [])),
    ];

    const mediaItems: Array<{ pageNo: string; pdfUrl?: string; videoUrl?: string; audioUrl?: string }> = [];
    if (note.pdfUrl || note.attachmentUrl || note.videoUrl || note.audioUrl) {
      mediaItems.push({
        pageNo: 'Main',
        pdfUrl: note.pdfUrl || note.attachmentUrl,
        videoUrl: note.videoUrl,
        audioUrl: note.audioUrl,
      });
    }
    pages.forEach((p: any, i: number) => {
      if (p?.pdfUrl || p?.attachmentUrl || p?.videoUrl || p?.audioUrl) {
        mediaItems.push({
          pageNo: String(p?.pageNo || i + 1),
          pdfUrl: p?.pdfUrl || p?.attachmentUrl,
          videoUrl: p?.videoUrl,
          audioUrl: p?.audioUrl,
        });
      }
    });

    return {
      title: note.lessonTitle || note.title || note.chapterName || 'Class Note',
      pages,
      mcqs,
      summaryText,
      hasPdf: mediaItems.some((m) => Boolean(m.pdfUrl)),
      mediaItems,
    };
  };

  // Resolve clean display label for a school subject id/slug (e.g. "hindi" -> "Hindi (हिंदी)")
  const resolveSchoolSubjectLabel = (rawSubj: any): string => {
    const raw = String(rawSubj || 'School Notes').trim();
    if (!raw) return 'School Notes';
    const clsKey = String(selectedClassLevel || '6').replace(/^(cls_|class\s*)/i, '').trim();
    const list = DEFAULT_SUBJECTS_BY_CLASS[clsKey] || [];
    const low = raw.toLowerCase();
    const found = list.find(
      (s) => s.id.toLowerCase() === low || s.name.toLowerCase() === low || s.name.toLowerCase().startsWith(`${low} `)
    );
    if (found) return found.name;
    // Also check across all class subject maps if teacher reused another class's subject id
    for (const arr of Object.values(DEFAULT_SUBJECTS_BY_CLASS)) {
      const alt = arr.find((s) => s.id.toLowerCase() === low || s.name.toLowerCase() === low);
      if (alt) return alt.name;
    }
    return raw.length <= 24 ? raw.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase()) : raw;
  };

  // Group notes by normalized subject key for this school
  const schoolClassSubjectsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    schoolClassNotes.forEach((n: any) => {
      const subjName = resolveSchoolSubjectLabel(n.subjectName || n.subject || 'School Notes');
      if (!map.has(subjName)) {
        map.set(subjName, []);
      }
      map.get(subjName)!.push(n);
    });
    return map;
  }, [schoolClassNotes, selectedClassLevel]);

  const schoolSubjectsCount = schoolClassSubjectsMap.size;
  const schoolLessonsCount = schoolClassNotes.length;
  const schoolMcqCount = useMemo(() => {
    let count = 0;
    schoolClassNotes.forEach((n: any) => {
      const details = extractNoteDetails(n);
      count += details.mcqs.length;
    });
    return count;
  }, [schoolClassNotes]);

  const handleOpenClassSyllabus = (_targetClass?: string) => {
    // Strictly opens only the student's own locked class syllabus (Step 1: Subject -> Lesson -> Page -> Notes)
    setSelectedSchoolSubject(null);
    setSelectedSchoolNote(null);
    setShowSchoolSyllabusModal(true);
  };

  const isBoardClass = cleanClassNum === "10" || cleanClassNum === "12";
  const classDisplayTitle = formatClassLabel(studentClassLabel) || `Class ${cleanClassNum}`;

  const classSyllabusSubjects = useMemo(() => {
    const subjectsMap: Record<string, string[]> = {};
    if (typeof FULL_SYLLABUS === "object" && FULL_SYLLABUS !== null) {
      Object.keys(FULL_SYLLABUS).forEach((k) => {
        const parts = k.split("-");
        if (parts.length >= 3) {
          const cls = parts[1];
          const subj = parts.slice(2).join(" ");
          if (cls === cleanClassNum) {
            if (!subjectsMap[subj] || subjectsMap[subj].length < (FULL_SYLLABUS[k]?.length || 0)) {
              subjectsMap[subj] = FULL_SYLLABUS[k];
            }
          }
        }
      });
    }

    if (Object.keys(subjectsMap).length === 0) {
      if (cleanClassNum === "Nursery" || cleanClassNum === "LKG" || cleanClassNum === "UKG") {
        subjectsMap["English Alphabet & Phonics"] = ["Alphabet A to Z", "Phonics Sounds", "Letter Tracing", "Simple Words"];
        subjectsMap["Hindi Varnamala"] = ["स्वर (अ से अः)", "व्यंजन (क से ज्ञ)", "चित्र पहचान", "सरल शब्द"];
        subjectsMap["Mathematics & Numbers"] = ["Numbers 1 to 50", "Counting Objects", "Shapes & Patterns", "Big & Small"];
        subjectsMap["General Awareness & Rhymes"] = ["My Body & Senses", "Animals & Birds", "Nursery Rhymes", "Colors & Fruits"];
        subjectsMap["Art & Drawing"] = ["Color Filling", "Basic Shapes Drawing", "Finger Painting"];
      } else {
        subjectsMap["Mathematics"] = ["Number Systems", "Polynomials", "Linear Equations", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Trigonometry", "Circles", "Statistics", "Probability"];
        subjectsMap["Science"] = ["Chemical Reactions & Equations", "Acids, Bases & Salts", "Metals & Non-metals", "Life Processes", "Control & Coordination", "Electricity", "Magnetic Effects of Electric Current", "Light Reflection & Refraction"];
        subjectsMap["Social Science"] = ["The Rise of Nationalism in Europe", "Nationalism in India", "Resources & Development", "Power Sharing", "Federalism", "Development", "Sectors of the Indian Economy"];
        subjectsMap["English Language & Literature"] = ["A Letter to God", "Nelson Mandela: Long Walk to Freedom", "Two Stories about Flying", "From the Diary of Anne Frank", "The Hundred Dresses", "Grammar & Composition"];
        subjectsMap["Hindi"] = ["सूरदास के पद", "राम-लक्ष्मण-परशुराम संवाद", "नेताजी का चश्मा", "बालगोबिन भगत", "व्याकरण एवं रचना"];
      }
    }

    if (Array.isArray(schoolCurriculumNotes)) {
      schoolCurriculumNotes.forEach((note: any) => {
        if (!note) return;
        const noteLvl = String(note.classLevel || note.classId || '')
          .replace(/^(cls_|class\s*)/i, '')
          .trim()
          .toLowerCase();
        if (noteLvl === String(cleanClassNum || '').toLowerCase() || note.classId === activeStudent.classId) {
          const subjName = note.subjectName || note.subject || "Teacher Notes";
          if (!subjectsMap[subjName]) {
            subjectsMap[subjName] = [];
          }
          const title = note.lessonTitle || note.title || note.chapterName;
          if (title && !subjectsMap[subjName].includes(title)) {
            subjectsMap[subjName].push(title);
          }
        }
      });
    }

    return subjectsMap;
  }, [cleanClassNum, activeStudent.classId, schoolCurriculumNotes]);

  const syllabusSubjectsCount = Object.keys(classSyllabusSubjects).length;
  const syllabusLessonsCount = Object.values(classSyllabusSubjects).reduce((sum, chapters) => sum + chapters.length, 0);
  const syllabusMcqCount = syllabusLessonsCount * 10;

  // Load real attendance logs
  useEffect(() => {
    const localAtt = getLocalAttendance(schoolId);
    setLiveAttendanceRecords(localAtt);

    const curMonth = todayStr().slice(0, 7);
    getMonthlyAttendance(schoolId, currentStudent.classId || "cls_10", curMonth)
      .then((recs) => {
        if (recs && recs.length > 0) {
          setLiveAttendanceRecords((prev) => {
            const map = new Map();
            [...prev, ...recs].forEach((r) => map.set(`${r.classId}_${r.date}`, r));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, [schoolId, currentStudent.classId]);

  useEffect(() => {
    if (!schoolId) return;
    return subscribeAttendanceSchedule(schoolId, (sched) => {
      setAttendanceSchedule({
        inCutoffTime: sched.inCutoffTime,
        outStartTime: sched.outStartTime,
      });
    });
  }, [schoolId]);

  // Combined attendance entries for currentStudent
  const studentAttendanceLogs = useMemo(() => {
    const logs: Array<{ date: string; status: string; inTime?: string; outTime?: string; stayDuration?: string }> = [];

    // 1. From live attendance
    liveAttendanceRecords.forEach((rec) => {
      if (rec.students && rec.students[currentStudent.id]) {
        const entry = rec.students[currentStudent.id];
        logs.push({
          date: rec.date,
          status: entry.status || (entry.present ? "present" : "absent"),
          inTime: entry.inTime,
          outTime: entry.outTime,
          stayDuration: entry.stayDuration,
        });
      }
    });

    // 2. From demo dataset (only if this student is one of the demo students)
    if (currentStudent.id?.startsWith("demo_std_")) {
      const demoAtt = Array.isArray((dataset as any)?.attendance) ? (dataset as any).attendance : [];
      demoAtt
        .filter((a: any) => a?.studentId === currentStudent.id)
        .forEach((a: any) => {
          if (!logs.some((l) => l.date === a.date)) {
            logs.push({
              date: a.date,
              status: a.status || "present",
            });
          }
        });
    }

    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }, [liveAttendanceRecords, currentStudent.id, dataset]);

  // Today's attendance state
  const todayEntry = useMemo(() => {
    const today = todayStr();
    return studentAttendanceLogs.find((l) => l.date === today);
  }, [studentAttendanceLogs]);

  const [realHolidays, setRealHolidays] = useState<any[]>([]);
  const [realNotices, setRealNotices] = useState<any[]>([]);
  const [realHomework, setRealHomework] = useState<any[]>([]);
  const [dailyTeachingLogs, setDailyTeachingLogs] = useState<DailyTeachingLog[]>([]);
  const [liveCommunityPosts, setLiveCommunityPosts] = useState<SchoolCommunityPost[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    let mounted = true;
    const loadHomework = () => {
      getHomework(schoolId, activeStudent?.classId)
        .then((hws) => {
          if (mounted) setRealHomework(Array.isArray(hws) ? hws : []);
        })
        .catch(() => {});
    };
    const loadTeachingLogs = () => {
      loadDailyTeachingLogs(schoolId)
        .then((logs) => {
          if (mounted) setDailyTeachingLogs(Array.isArray(logs) ? logs : []);
        })
        .catch(() => {});
    };

    getSchoolHolidays(schoolId)
      .then((hols) => {
        if (mounted && Array.isArray(hols) && hols.length > 0) setRealHolidays(hols);
      })
      .catch(() => {});
    getNotices(schoolId)
      .then((nts) => {
        if (mounted && Array.isArray(nts) && nts.length > 0) setRealNotices(nts);
      })
      .catch(() => {});
    loadHomework();
    loadTeachingLogs();

    const unsubNotices = subscribeToNotices(schoolId, (nts) => {
      if (mounted) setRealNotices(Array.isArray(nts) ? nts : []);
    });
    const unsubHolidays = subscribeToSchoolHolidays(schoolId, (hols) => {
      if (mounted) setRealHolidays(Array.isArray(hols) ? hols : []);
    });
    const unsubCommunity = subscribeToSchoolCommunityPosts(schoolId, (posts) => {
      if (mounted) setLiveCommunityPosts(Array.isArray(posts) ? posts : []);
    });

    window.addEventListener("homework-updated", loadHomework);
    window.addEventListener(SYLLABUS_LOG_EVENT, loadTeachingLogs);
    return () => {
      mounted = false;
      unsubNotices();
      unsubHolidays();
      unsubCommunity();
      window.removeEventListener("homework-updated", loadHomework);
      window.removeEventListener(SYLLABUS_LOG_EVENT, loadTeachingLogs);
    };
  }, [schoolId, activeStudent?.classId, demoEnabled]);

  const [schoolTeachers, setSchoolTeachers] = useState<SchoolTeacher[]>([]);
  const [teacherSearch, setTeacherSearch] = useState<string>("");
  const [teacherRosterScope, setTeacherRosterScope] = useState<"ROUTINE" | "ALL">("ROUTINE");
  const [requestedTeacherChatId, setRequestedTeacherChatId] = useState<string | null>(null);
  const [studentTimetableSchedules, setStudentTimetableSchedules] = useState<Record<string, Record<string, any[]>>>({});

  useEffect(() => {
    if (!schoolId) return;
    let mounted = true;
    const unsub = subscribeToTeachers(schoolId, (list) => {
      if (mounted && Array.isArray(list)) {
        setSchoolTeachers(list.filter((t) => t.active !== false));
      }
    });
    loadSchoolSettingBlob<Record<string, Record<string, any[]>>>(
      schoolId,
      "timetable_schedules",
      `nst_school_timetable_${schoolId}`,
      {}
    )
      .then((sched) => {
        if (mounted && sched && typeof sched === "object") {
          setStudentTimetableSchedules(sched);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (typeof unsub === "function") unsub();
    };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    Promise.all([
      getAccountants(schoolId).catch(() => []),
      getStaffEmployees(schoolId).catch(() => []),
    ])
      .then(([accs, stfs]) => {
        if (!active) return;
        syncSchoolDirectoryToAndroid({
          school,
          schoolName: schoolDisplayName,
          teachers: schoolTeachers,
          accountants: accs || [],
          staffEmployees: stfs || [],
        });
      })
      .catch(() => {
        if (!active) return;
        syncSchoolDirectoryToAndroid({
          school,
          schoolName: schoolDisplayName,
          teachers: schoolTeachers,
        });
      });
    return () => {
      active = false;
    };
  }, [schoolId, school, schoolDisplayName, schoolTeachers]);

  const routineTeachersSummary = useMemo(() => {
    const normCls = (v?: string) =>
      String(v || "")
        .toLowerCase()
        .replace(/^(cls_|class_|c_|demo_class_)/i, "")
        .replace(/\b(class|std|standard|grade)\b/gi, "")
        .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const targetClsId = String(activeStudent?.classId || "").trim();
    const targetClsName = String(studentClassLabel || activeStudent?.className || "").trim();
    const targetClsNorm = normCls(targetClsName) || normCls(targetClsId);
    const targetSec = String(activeStudent?.section || "").trim().toUpperCase();

    const matchedClassObj = classesList.find(
      (c) =>
        (targetClsId && c.id === targetClsId) ||
        (targetClsName && c.name?.toLowerCase() === targetClsName.toLowerCase()) ||
        (targetClsNorm && normCls(c.name) === targetClsNorm)
    );

    const byId = new Map<string, Set<string>>();
    const byName = new Map<string, { id?: string; name: string; subjects: Set<string> }>();

    Object.entries(studentTimetableSchedules || {}).forEach(([schedKey, dayDict]) => {
      if (!dayDict || typeof dayDict !== "object") return;
      const [basePart, secPart] = schedKey.split("__sec_");
      const secMatch = schedKey.match(/\bSection\s+([A-Z])/i);
      const keySec = (secPart || secMatch?.[1] || "").trim().toUpperCase();
      if (targetSec && keySec && keySec !== targetSec) return;

      const baseNorm = normCls(basePart.replace(/\s*-\s*Section\s+[A-Z]$/i, ""));
      const classMatched =
        (targetClsId && basePart === targetClsId) ||
        (targetClsName && basePart.toLowerCase() === targetClsName.toLowerCase()) ||
        (targetClsNorm && baseNorm && targetClsNorm === baseNorm);

      if (!classMatched) return;

      Object.values(dayDict).forEach((dayPeriods) => {
        if (!Array.isArray(dayPeriods)) return;
        dayPeriods.forEach((p: any) => {
          if (!p || p.isBreak) return;
          const tName = String(p.teacherName || "").trim();
          const tId = String(p.teacherId || "").trim();
          const subj = String(p.subjectName || p.subject || "").trim();
          if (!tName && !tId) return;
          if (tName.toLowerCase() === "unassigned") return;

          if (tId) {
            const set = byId.get(tId) || new Set<string>();
            if (subj) set.add(subj);
            byId.set(tId, set);
          }
          if (tName) {
            const nKey = tName.toLowerCase().replace(/\s+/g, " ");
            const cur = byName.get(nKey) || { id: tId || undefined, name: tName, subjects: new Set<string>() };
            if (subj) cur.subjects.add(subj);
            byName.set(nKey, cur);
          }
        });
      });
    });

    const routineMatched: Array<SchoolTeacher & { _routineSubjects?: string[]; _isClassTeacher?: boolean }> = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    schoolTeachers.forEach((t) => {
      const nKey = String(t.name || "").trim().toLowerCase().replace(/\s+/g, " ");
      const idSubs = t.id ? byId.get(t.id) : undefined;
      const nameSubs = nKey ? byName.get(nKey)?.subjects : undefined;
      const isClassTeacher = Boolean(matchedClassObj?.classTeacherId && t.id === matchedClassObj.classTeacherId);
      const inClassesArr =
        Array.isArray(t.classes) &&
        t.classes.some(
          (c) =>
            (targetClsId && c === targetClsId) ||
            (targetClsName && c.toLowerCase() === targetClsName.toLowerCase()) ||
            (targetClsNorm && normCls(c) === targetClsNorm)
        );
      if (idSubs || nameSubs || isClassTeacher || inClassesArr) {
        const merged = new Set<string>();
        idSubs?.forEach((s) => merged.add(s));
        nameSubs?.forEach((s) => merged.add(s));
        routineMatched.push({
          ...t,
          _routineSubjects: Array.from(merged),
          _isClassTeacher: isClassTeacher,
        });
        if (t.id) seenIds.add(t.id);
        if (nKey) seenNames.add(nKey);
      }
    });

    byName.forEach((entry, nKey) => {
      if (seenNames.has(nKey)) return;
      if (entry.id && seenIds.has(entry.id)) return;
      const synthId = entry.id || `routine_tch_${nKey.replace(/[^a-z0-9]+/g, "_")}`;
      routineMatched.push({
        id: synthId,
        schoolId,
        name: entry.name,
        subjects: Array.from(entry.subjects),
        designation: "Subject Teacher",
        active: true,
        _routineSubjects: Array.from(entry.subjects),
        _isClassTeacher: false,
      } as any);
    });

    return {
      routineTeachers: routineMatched,
      hasRoutine: routineMatched.length > 0,
    };
  }, [schoolTeachers, studentTimetableSchedules, activeStudent?.classId, activeStudent?.className, activeStudent?.section, studentClassLabel, classesList, schoolId]);

  const displayedFaculty = useMemo(() => {
    const baseList =
      teacherRosterScope === "ROUTINE" && routineTeachersSummary.hasRoutine
        ? routineTeachersSummary.routineTeachers
        : schoolTeachers;
    if (!teacherSearch.trim()) return baseList;
    const q = teacherSearch.toLowerCase().trim();
    return baseList.filter((t) => {
      const matchName = t.name?.toLowerCase().includes(q);
      const matchDesig = t.designation?.toLowerCase().includes(q);
      const matchQual = t.qualification?.toLowerCase().includes(q);
      const matchSubs = Array.isArray(t.subjects)
        ? t.subjects.some((s) => s.toLowerCase().includes(q))
        : (typeof t.subjects === "string" ? (t.subjects as string).toLowerCase().includes(q) : false);
      return matchName || matchDesig || matchQual || matchSubs;
    });
  }, [schoolTeachers, routineTeachersSummary, teacherRosterScope, teacherSearch]);

  // Check if today is Sunday or holiday
  const todayHolidayInfo = useMemo(() => {
    const today = todayStr();
    const d = new Date();
    const isSunday = d.getDay() === 0;
    if (isSunday) return { isHoliday: true, name: "Sunday (रविवार - साप्ताहिक अवकाश)" };
    const matchedSchoolHoliday = realHolidays.find(
      (h: any) => h.startDate && today >= h.startDate && today <= (h.endDate || h.startDate)
    );
    if (matchedSchoolHoliday) {
      return { isHoliday: true, name: matchedSchoolHoliday.name || "School Holiday (अवकाश)" };
    }
    if (schoolDemoActive && isHolidayDate(today)) return { isHoliday: true, name: "Festival / Institutional Holiday (अवकाश)" };
    return { isHoliday: false, name: "" };
  }, [realHolidays, schoolDemoActive]);

  const attendanceStats = useMemo(() => {
    if (studentAttendanceLogs.length > 0) {
      const total = studentAttendanceLogs.length;
      const present = studentAttendanceLogs.filter((a) => a.status === "present" || a.status === "late").length;
      const absent = studentAttendanceLogs.filter((a) => a.status === "absent").length;
      const late = studentAttendanceLogs.filter((a) => a.status === "late").length;
      const leave = studentAttendanceLogs.filter((a) => a.status === "leave").length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 100;
      return { total, present, absent, late, leave, percentage, hasRealLogs: true };
    }
    return { total: 0, present: 0, absent: 0, late: 0, leave: 0, percentage: 100, hasRealLogs: false };
  }, [studentAttendanceLogs]);

  // Load real fees with Live Realtime Subscription
  useEffect(() => {
    if (!schoolId || !currentStudent.id) return;

    // Immediate local cache read
    try {
      const local = getLocalFees(schoolId).filter((f: any) => f.studentId === currentStudent.id);
      if (local && local.length > 0) {
        setLiveFees(local);
      }
    } catch {}

    const unsub = subscribeToStudentFees(schoolId, currentStudent.id, (freshFees) => {
      if (freshFees) {
        setLiveFees((prev) => {
          const map = new Map();
          prev.forEach((f) => {
            const k = f.feeType === "admission" || f.receiptCategory === "admission"
              ? `adm_${f.studentId}`
              : `${f.studentId}_${f.month || f.id}`;
            map.set(k, f);
          });
          freshFees.forEach((f) => {
            const k = f.feeType === "admission" || f.receiptCategory === "admission"
              ? `adm_${f.studentId}`
              : `${f.studentId}_${f.month || f.id}`;
            map.set(k, f);
          });
          return Array.from(map.values());
        });
      }
    });

    // Also fetch any remote fees from Firestore
    getStudentFees(schoolId, currentStudent.id)
      .then((remote) => {
        if (remote && remote.length > 0) {
          setLiveFees((prev) => {
            const map = new Map();
            prev.forEach((f) => {
              const k = f.feeType === "admission" || f.receiptCategory === "admission"
                ? `adm_${f.studentId}`
                : `${f.studentId}_${f.month || f.id}`;
              map.set(k, f);
            });
            remote.forEach((f) => {
              const k = f.feeType === "admission" || f.receiptCategory === "admission"
                ? `adm_${f.studentId}`
                : `${f.studentId}_${f.month || f.id}`;
              map.set(k, f);
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    return () => unsub();
  }, [schoolId, currentStudent.id, currentStudent.admissionNo, currentStudent.rollNo]);

  // Load school Razorpay online fee config
  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    fetchSchoolRazorpayConfig(schoolId).then((cfg) => {
      if (active && cfg) setRazorpayConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, [schoolId]);

  const handlePayFeeViaRazorpay = async (feeItem: any, payableAmount: number, monthLabel: string) => {
    if (!schoolId || !activeStudent?.id || payableAmount <= 0) return;
    const key = String(feeItem?.id || feeItem?.month || "fee");
    setPayingFeeKey(key);
    await startStudentRazorpayFeeCheckout({
      schoolId,
      schoolName: schoolDisplayName,
      student: {
        id: activeStudent.id,
        name: activeStudent.name,
        classId: activeStudent.classId,
        className: formatClassLabel(studentClassLabel),
        rollNo: activeStudent.rollNo,
        admissionNo: activeStudent.admissionNo,
        phone: activeStudent.phone || activeStudent.mobile,
      },
      fee: feeItem,
      payableAmount,
      monthLabel,
      onSuccess: ({ receiptNo, fee: updatedFee }) => {
        setPayingFeeKey(null);
        toast.success(`✅ Fee jama ho gayi! Receipt: ${receiptNo}`);
        if (updatedFee) {
          setLiveFees((prev) => {
            const next = prev.filter(
              (x) => !(x.studentId === updatedFee.studentId && x.month === updatedFee.month)
            );
            return [updatedFee, ...next];
          });
          setFeeModalFormat("pos");
          setSelectedFeeForReceipt(updatedFee);
        }
      },
      onError: (msg) => {
        setPayingFeeKey(null);
        toast.error(msg || "Online fee payment failed");
      },
      onDismiss: () => {
        setPayingFeeKey(null);
      },
    });
  };

  // Student monthly fee dynamically determined
  const studentMonthlyFee = useMemo(() => {
    if (typeof activeStudent.monthlyFee === "number" && activeStudent.monthlyFee > 0) {
      return activeStudent.monthlyFee;
    }
    const localSchoolClasses = schoolId ? getLocalClasses(schoolId) : [];
    const schoolClasses = school?.classes || [];
    const datasetClasses = Array.isArray(dataset?.classes) ? dataset.classes : [];
    const allClasses = [...localSchoolClasses, ...schoolClasses, ...datasetClasses];
    const cls = allClasses.find((c) => c.id === activeStudent.classId || c.name?.toLowerCase() === studentClassLabel.toLowerCase());
    if (cls && typeof cls.defaultFee === "number" && cls.defaultFee > 0) {
      return cls.defaultFee;
    }
    return 1800;
  }, [activeStudent, dataset, school, schoolId, studentClassLabel]);

  const tuitionFee = Math.round(studentMonthlyFee * 0.7);
  const computerFee = Math.round(studentMonthlyFee * 0.15);
  const sportsFee = Math.max(0, studentMonthlyFee - tuitionFee - computerFee);

  // Student fees list: complete academic session passbook merged with real live payments (100% synced with School Admin)
  const activeStudentSessionObj = useMemo(() => {
    const targetSid = activeStudent?.sessionId || currentStudent?.sessionId || sessionId;
    return schoolSessions.find((s) => s.id === targetSid) || null;
  }, [schoolSessions, activeStudent?.sessionId, currentStudent?.sessionId, sessionId]);

  const allStudentFees = useMemo(() => {
    const dynamicSessionMonths = activeStudentSessionObj
      ? getSessionMonthCodes(activeStudentSessionObj).map((m) => ({
          code: m.code,
          name: m.label,
        }))
      : [
          { code: "2026-04", name: "April 2026" },
          { code: "2026-05", name: "May 2026" },
          { code: "2026-06", name: "June 2026" },
          { code: "2026-07", name: "July 2026" },
          { code: "2026-08", name: "August 2026" },
          { code: "2026-09", name: "September 2026" },
          { code: "2026-10", name: "October 2026" },
          { code: "2026-11", name: "November 2026" },
          { code: "2026-12", name: "December 2026" },
          { code: "2027-01", name: "January 2027" },
          { code: "2027-02", name: "February 2027" },
          { code: "2027-03", name: "March 2027" },
        ];
    const sessionMonths = dynamicSessionMonths;

    const activeMonth = currentMonthStr();
    const filteredLiveFees = !schoolDemoActive ? liveFees.filter((f: any) => !isDemoRecord(f)) : liveFees;

    // Detect parent receipt numbers that already distributed lump-sum payments into FIFO-* child months
    const fifoParentReceipts = new Set<string>();
    filteredLiveFees.forEach((f: any) => {
      if (typeof f?.receiptNo === "string" && f.receiptNo.startsWith("FIFO-")) {
        const m = f.receiptNo.match(/^FIFO-\d{4}-\d{2}-(.+)$/);
        if (m?.[1]) fifoParentReceipts.add(m[1]);
      }
    });

    const liveMonthMap = new Map<string, any>();
    const extraFees: any[] = [];

    // 1. Identify authentic admission date & month of this student
    const studentJoinDate =
      (activeStudent as any)?.joinDate ||
      (currentStudent as any)?.joinDate ||
      (activeStudent as any)?.admissionDate ||
      (currentStudent as any)?.admissionDate ||
      (typeof activeStudent?.createdAt === "string" ? activeStudent.createdAt.slice(0, 10) : "") ||
      (typeof currentStudent?.createdAt === "string" ? currentStudent.createdAt.slice(0, 10) : "") ||
      (enrichedData as any)?.joinDate ||
      (enrichedData as any)?.admissionDate;

    // Find admission fee record if present
    const rawAdmissionFee = filteredLiveFees.find(
      (f: any) =>
        f.feeType === "admission" ||
        f.receiptCategory === "admission" ||
        (typeof f.receiptNo === "string" && f.receiptNo.startsWith("ADM-"))
    );

    const admissionDateFromFee =
      rawAdmissionFee?.paidDate ||
      rawAdmissionFee?.paymentDate ||
      (typeof rawAdmissionFee?.createdAt === "string" ? rawAdmissionFee.createdAt.slice(0, 10) : "");

    const effectiveJoinDate = studentJoinDate || admissionDateFromFee || "";
    let admissionMonthCode = "";
    if (effectiveJoinDate && /^\d{4}-\d{2}/.test(effectiveJoinDate)) {
      admissionMonthCode = effectiveJoinDate.slice(0, 7);
    } else if (rawAdmissionFee?.month && /^\d{4}-\d{2}$/.test(rawAdmissionFee.month)) {
      admissionMonthCode = rawAdmissionFee.month;
    } else if (!schoolDemoActive && !currentStudent.id?.startsWith("demo_std_")) {
      admissionMonthCode = activeMonth;
    }

    filteredLiveFees.forEach((rawFee: any) => {
      let f = rawFee;
      if (
        f.receiptNo &&
        !String(f.receiptNo).startsWith("FIFO-") &&
        fifoParentReceipts.has(String(f.receiptNo))
      ) {
        const billed = Number(f.monthlyAmount ?? f.amount ?? studentMonthlyFee);
        const rawPaid = Number(f.paidAmount ?? 0);
        const balDue = Number(f.balanceDue ?? (f.paid ? 0 : billed));
        if (!f.paid && rawPaid > billed) {
          const normalizedPaid = Math.max(0, billed - balDue);
          f = {
            ...f,
            lastReceiptPaidAmount: f.lastReceiptPaidAmount ?? rawPaid,
            paidAmount: normalizedPaid,
            balanceDue: balDue,
            status: normalizedPaid > 0 ? "partial" : "due",
          };
        }
      }

      const isAdm =
        f.feeType === "admission" ||
        f.receiptCategory === "admission" ||
        (typeof f.receiptNo === "string" && f.receiptNo.startsWith("ADM-"));

      if (isAdm) {
        // Ensure admission fee billed amount reflects total admission payable/paid rather than single monthly fee
        const admBilled = Number(f.grossTotal ?? f.grossAmount ?? f.amount ?? f.paidAmount ?? 0);
        f = {
          ...f,
          feeType: "admission",
          receiptCategory: "admission",
          amount: admBilled > 0 ? admBilled : (f.amount || studentMonthlyFee),
          monthlyAmount: admBilled > 0 ? admBilled : (f.monthlyAmount || studentMonthlyFee),
        };
        extraFees.push(f);
      } else if (f.month) {
        liveMonthMap.set(f.month, f);
      } else {
        extraFees.push(f);
      }
    });

    if (filteredLiveFees.length === 0 && schoolDemoActive && currentStudent.id?.startsWith("demo_std_")) {
      const rawFees = Array.isArray(dataset?.fees) ? dataset.fees : [];
      const filtered = rawFees.filter((f: any) => f?.studentId === currentStudent.id);
      if (filtered.length > 0) return filtered;
    }

    const sessionList = sessionMonths.map((m, idx) => {
      const recorded = liveMonthMap.get(m.code);
      if (recorded) {
        return recorded;
      }

      // Pre-admission months: Any session month strictly prior to student's admission date
      const isPreAdmission = Boolean(admissionMonthCode && m.code < admissionMonthCode);
      if (isPreAdmission) {
        return {
          id: `fee_pre_${m.code}_${currentStudent.id}`,
          schoolId,
          sessionId: currentStudent.sessionId || "session_2026_27",
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          rollNo: currentStudent.rollNo,
          classId: currentStudent.classId,
          month: m.code,
          amount: 0,
          monthlyAmount: 0,
          paid: false,
          paidAmount: 0,
          balanceDue: 0,
          isPreAdmission: true,
          status: "pre_admission",
          receiptNo: "—",
          paidDate: undefined,
          paymentMode: "Pre-Admission (नामांकन पूर्व)",
        };
      }

      const isUpcoming = m.code > activeMonth;
      if (isUpcoming) {
        return {
          id: `fee_${m.code}_${currentStudent.id}`,
          schoolId,
          sessionId: currentStudent.sessionId || "session_2026_27",
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          rollNo: currentStudent.rollNo,
          classId: currentStudent.classId,
          month: m.code,
          amount: studentMonthlyFee,
          monthlyAmount: studentMonthlyFee,
          paid: false,
          paidAmount: 0,
          balanceDue: 0,
          isUpcoming: true,
          status: "upcoming",
          receiptNo: "—",
          paidDate: undefined,
          paymentMode: "Upcoming",
        };
      }

      const isPastMonth = idx <= 5;
      const defaultStatus = schoolDemoActive && isPastMonth ? "paid" : "due";
      const isPaid = defaultStatus === "paid";

      return {
        id: `fee_${m.code}_${currentStudent.id}`,
        schoolId,
        sessionId: currentStudent.sessionId || "session_2026_27",
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        rollNo: currentStudent.rollNo,
        classId: currentStudent.classId,
        month: m.code,
        amount: studentMonthlyFee,
        monthlyAmount: studentMonthlyFee,
        paid: isPaid,
        paidAmount: isPaid ? studentMonthlyFee : 0,
        balanceDue: isPaid ? 0 : studentMonthlyFee,
        status: defaultStatus,
        receiptNo: isPaid ? `LMPS-27-${String(idx + 1).padStart(4, "0")}` : "—",
        paidDate: isPaid ? `${m.code}-05` : undefined,
        paymentMode: isPaid ? "UPI / Counter" : "Pending",
      };
    });

    const carryEntries: any[] = [];
    const backSessionRem = Math.max(0, Number((activeStudent as any)?.previousSessionDue ?? (currentStudent as any)?.previousSessionDue ?? 0));
    if (backSessionRem > 0) {
      carryEntries.push({
        id: `back_due_${currentStudent.id}`,
        schoolId,
        sessionId: currentStudent.sessionId || sessionId || "",
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        rollNo: currentStudent.rollNo,
        classId: currentStudent.classId,
        month: "0000-BACK-DUE",
        amount: backSessionRem,
        monthlyAmount: backSessionRem,
        paid: false,
        paidAmount: 0,
        balanceDue: backSessionRem,
        status: "due",
        receiptNo: "BACK-DUE",
        paymentMode: "Carry Forward",
        note: `पिछला सत्र (${(activeStudent as any)?.previousSessionName || "Back Session"}) बकाया`,
      });
    }
    const admBalRem = Math.max(0, Number((activeStudent as any)?.admissionDueBalance ?? (currentStudent as any)?.admissionDueBalance ?? 0));
    if (admBalRem > 0) {
      carryEntries.push({
        id: `adm_due_${currentStudent.id}`,
        schoolId,
        sessionId: currentStudent.sessionId || sessionId || "",
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        rollNo: currentStudent.rollNo,
        classId: currentStudent.classId,
        month: "0001-ADM-DUE",
        amount: admBalRem,
        monthlyAmount: admBalRem,
        paid: false,
        paidAmount: 0,
        balanceDue: admBalRem,
        status: "due",
        receiptNo: "ADM-DUE",
        paymentMode: "Admission Balance",
        note: "बकाया प्रवेश शुल्क (Admission Arrears)",
      });
    }

    return [...carryEntries, ...extraFees, ...sessionList];
  }, [liveFees, currentStudent, dataset, studentMonthlyFee, schoolId, schoolDemoActive, activeStudent, enrichedData, sessionId, activeStudentSessionObj]);

  const feeSummary = useMemo(() => {
    let totalBilled = 0;
    let totalDeposited = 0;
    let totalRemaining = 0;

    allStudentFees.forEach((f: any) => {
      // Exclude pre-admission session months completely from pending dues & billed totals
      if (f.isPreAdmission || f.status === "pre_admission") return;

      const isUpcoming = Boolean(f.isUpcoming || f.status === "upcoming");
      const isPaid = typeof f.paid === "boolean" ? f.paid : f.status === "paid";
      const isAdm =
        f.feeType === "admission" ||
        f.receiptCategory === "admission" ||
        String(f.receiptNo || "").startsWith("ADM-");

      const billed = isAdm
        ? Number(f.grossTotal ?? f.grossAmount ?? f.amount ?? f.paidAmount ?? studentMonthlyFee)
        : Number(f.monthlyAmount ?? f.amount ?? studentMonthlyFee);

      const paid = Number(f.paidAmount !== undefined ? f.paidAmount : (isPaid ? billed : 0));
      const remaining = isUpcoming
        ? 0
        : Number(f.balanceDue !== undefined ? f.balanceDue : (isPaid ? 0 : Math.max(0, billed - paid)));

      totalBilled += billed;
      totalDeposited += paid;
      totalRemaining += remaining;
    });

    return { totalBilled, totalDeposited, totalRemaining };
  }, [allStudentFees, studentMonthlyFee]);

  const studentAdmissionFeeRecord = useMemo(() => {
    return (
      allStudentFees.find(
        (f: any) =>
          f.feeType === "admission" ||
          f.receiptCategory === "admission" ||
          (typeof f.receiptNo === "string" && f.receiptNo.startsWith("ADM-"))
      ) || null
    );
  }, [allStudentFees]);

  const pendingDues = feeSummary.totalRemaining;

  const [downloadingFeeId, setDownloadingFeeId] = useState<string | null>(null);
  const [quickPromisePreset, setQuickPromisePreset] = useState<"TOMORROW" | "IN_3_DAYS" | "CUSTOM">("IN_3_DAYS");
  const [quickPromiseCustomDate, setQuickPromiseCustomDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [quickPromiseNote, setQuickPromiseNote] = useState<string>("");
  const [sendingQuickPromise, setSendingQuickPromise] = useState<boolean>(false);
  const [quickPromiseSentMsg, setQuickPromiseSentMsg] = useState<string | null>(null);

  const handleSendParentQuickPromise = async () => {
    if (!activeStudent?.id || !schoolId || pendingDues <= 0 || sendingQuickPromise) return;
    const addDaysStr = (baseYmd: string, days: number) => {
      const parts = baseYmd.split("-").map(Number);
      const dt = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      dt.setDate(dt.getDate() + days);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const todayLocal = todayStr();
    const promiseYmd =
      quickPromisePreset === "TOMORROW"
        ? addDaysStr(todayLocal, 1)
        : quickPromisePreset === "IN_3_DAYS"
          ? addDaysStr(todayLocal, 3)
          : quickPromiseCustomDate || addDaysStr(todayLocal, 3);
    const nextCallYmd = addDaysStr(promiseYmd, 1);
    const nowIso = new Date().toISOString();
    const noteBody =
      quickPromiseNote.trim() ||
      `[Parent Quick Reply] ${promiseYmd} ko ₹${pendingDues.toLocaleString("en-IN")} jama karenge.`;

    setSendingQuickPromise(true);
    try {
      await saveFeeCallFollowUp({
        id: activeStudent.id,
        schoolId,
        studentId: activeStudent.id,
        studentName: activeStudent.name || "Student",
        fatherName: activeStudent.fatherName || "",
        classId: activeStudent.classId || "",
        className: studentClassLabel || "",
        rollNo: activeStudent.rollNo || "",
        phone: activeStudent.phone || activeStudent.fatherPhone || "",
        lastCallAt: nowIso,
        lastCallOutcome: "PROMISED_DATE",
        lastCallDurationSec: 0,
        lastCallBy: "Parent Quick Reply",
        lastNote: noteBody,
        promisedAmount: pendingDues,
        promiseDate: promiseYmd,
        nextCallDate: nextCallYmd,
        totalCallsCount: 1,
        callHistory: [
          {
            id: `pqr_${Date.now()}`,
            calledAt: nowIso,
            phone: activeStudent.phone || activeStudent.fatherPhone || "",
            outcome: "PROMISED_DATE",
            durationSec: 0,
            promisedAmount: pendingDues,
            promiseDate: promiseYmd,
            nextCallDate: nextCallYmd,
            dueAtCallTime: pendingDues,
            note: noteBody,
            calledBy: "Parent Quick Reply",
            callMode: "MANUAL_LOG",
          },
        ],
        settled: false,
        updatedAt: nowIso,
      });

      void sendSchoolPushNotification({
        schoolId,
        targetRoles: ["STAFF_ADMIN"],
        studentIds: [activeStudent.id],
        senderName: activeStudent.fatherName || activeStudent.name || "Parent",
        title: `💬 Parent Fee Promise • ${activeStudent.name}`,
        body: `${activeStudent.name} (${studentClassLabel || "Class"}) ke parent ne ₹${pendingDues.toLocaleString("en-IN")} fee ${promiseYmd} ko jama karne ka promise bheja hai.`,
        type: "GENERAL",
        voiceSpeak: true,
        url: `/?schoolPortal=1&schoolId=${encodeURIComponent(schoolId)}`,
      }).catch(() => {});

      const okMsg = `School Fee Desk ko ${promiseYmd} ki Promise Date bhej di gayi!`;
      setQuickPromiseSentMsg(okMsg);
      setQuickPromiseNote("");
      toast.success(okMsg);
    } catch {
      toast.error("Promise reply bhejne me samasya aayi, dobara koshish karein.");
    } finally {
      setSendingQuickPromise(false);
    }
  };

  const formatPaymentDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: "—", time: "" };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: "" };
      const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const hasTime = dateStr.includes("T") || dateStr.includes(":");
      const time = hasTime
        ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "";
      return { date, time };
    } catch {
      return { date: dateStr, time: "" };
    }
  };

  const handleDownloadStudentPdf = async (f: any) => {
    setDownloadingFeeId(f.id || f.month || "active");
    try {
      await downloadFeeDocument({
        fee: f,
        student: activeStudent,
        schoolName: school?.name || schoolDisplayName || "School",
        className: formatClassLabel(studentClassLabel),
        schoolDetails: {
          schoolName: school?.name || schoolDisplayName || "School",
          address: school?.address || "",
          phone: school?.mobile || school?.phone || "",
          email: school?.email || "",
          affiliation: school?.affiliation || "",
          code: getVisibleSchoolRegNo(school),
          logoUrl: getSavedSchoolLogo(school?.logoUrl, schoolId),
          principalSignatureUrl: school?.principalSignatureUrl || "",
          directorSignatureUrl: school?.directorSignatureUrl || "",
          managerSignatureUrl: school?.managerSignatureUrl || "",
          managerName: school?.managerName || "",
          accountantSignatureUrl: school?.accountantSignatureUrl || "",
          accountantName: school?.accountantName || "",
          principalName: school?.principalName || "",
        },
      });
    } catch (err) {
      console.error("Error downloading student PDF:", err);
    } finally {
      setDownloadingFeeId(null);
    }
  };

  const handleShareStudentWhatsApp = async (f: any) => {
    const isPaid = typeof f.paid === "boolean" ? f.paid : f.status === "paid";
    try {
      await shareFeeReceiptOnWhatsApp({
        fee: f,
        student: activeStudent,
        schoolName: school?.name || schoolDisplayName || "School",
        className: formatClassLabel(studentClassLabel),
        schoolDetails: {
          schoolName: school?.name || "School",
          address: school?.address || "",
          phone: school?.mobile || school?.phone || "",
          email: school?.email || "",
          affiliation: school?.affiliation || "",
          code: getVisibleSchoolRegNo(school),
          logoUrl: getSavedSchoolLogo(school?.logoUrl, schoolId),
          principalSignatureUrl: school?.principalSignatureUrl || "",
          directorSignatureUrl: school?.directorSignatureUrl || "",
          managerSignatureUrl: school?.managerSignatureUrl || "",
          managerName: school?.managerName || "",
          accountantSignatureUrl: school?.accountantSignatureUrl || "",
          accountantName: school?.accountantName || "",
          principalName: school?.principalName || "",
        },
        isDueDemand: !isPaid,
      });
    } catch (err) {
      console.error("Error sharing fee on WhatsApp:", err);
    }
  };

  // Load real exams with Live Realtime Subscription
  useEffect(() => {
    if (!schoolId) return;
    const targetClass = currentStudent.classId || "cls_10";
    const unsub = subscribeToExams(schoolId, targetClass, (exams) => {
      if (exams) {
        setLiveExams((prev) => {
          const map = new Map();
          [...prev, ...exams].forEach((e) => map.set(e.id, e));
          return Array.from(map.values());
        });
      }
    });

    getExams(schoolId, targetClass)
      .then((remote) => {
        if (remote && remote.length > 0) {
          setLiveExams((prev) => {
            const map = new Map();
            [...prev, ...remote].forEach((e) => map.set(e.id, e));
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    return () => unsub();
  }, [schoolId, currentStudent.classId]);

  // Check student marks across exams (strictly respects Demo OFF / Real Only mode and per-school isolation)
  const studentExams = useMemo(() => {
    const cleanLive = !schoolDemoActive ? liveExams.filter((e: any) => !isDemoRecord(e)) : liveExams;
    const combined = [...cleanLive];
    if (schoolDemoActive && currentStudent.id?.startsWith("demo_std_") && Array.isArray(dataset?.exams)) {
      dataset.exams.forEach((de) => {
        if (!combined.some((ce) => ce.id === de.id)) combined.push(de);
      });
    }

    const extracted: any[] = [];
    combined.forEach((e: any) => {
      if (!e) return;
      if (e.studentId === currentStudent?.id) {
        extracted.push(e);
        return;
      }
      if (e.studentMarks && currentStudent?.id && e.studentMarks[currentStudent.id]) {
        const markEntry = e.studentMarks[currentStudent.id];
        let cycleKey = e.examType || "";
        if (!cycleKey && typeof e.id === "string") {
          if (e.id.endsWith("_pa1") || e.name?.includes("PA-1")) cycleKey = "PA-1";
          else if (e.id.endsWith("_pa2") || e.name?.includes("PA-2")) cycleKey = "PA-2";
          else if (e.id.endsWith("_half_yearly") || e.name?.toLowerCase().includes("half")) cycleKey = "Half-Yearly";
          else if (e.id.endsWith("_pa3") || e.name?.includes("PA-3")) cycleKey = "PA-3";
          else if (e.id.endsWith("_pa4") || e.name?.includes("PA-4")) cycleKey = "PA-4";
          else if (e.id.endsWith("_final") || e.name?.toLowerCase().includes("final")) cycleKey = "Final-Annual";
        }
        extracted.push({
          ...e,
          examType: cycleKey || "Half-Yearly",
          subjectName: e.subjectName || e.name || "Subject",
          marksObtained: markEntry.absent ? 0 : Number(markEntry.marks) || 0,
          maxMarks: Number(e.maxMarks) || 100,
          absent: Boolean(markEntry.absent),
        });
      }
    });

    return extracted;
  }, [liveExams, dataset, currentStudent?.id, schoolDemoActive]);

  const examCycles = useMemo(() => {
    const cycles = [
      { id: "PA-1", name: "Periodic Assessment 1 (PA-1)", maxMarks: 40, term: "Term 1" },
      { id: "PA-2", name: "Periodic Assessment 2 (PA-2)", maxMarks: 40, term: "Term 1" },
      { id: "Half-Yearly", name: "Half Yearly Examination", maxMarks: 100, term: "Term 1" },
      { id: "PA-3", name: "Periodic Assessment 3 (PA-3)", maxMarks: 40, term: "Term 2" },
      { id: "PA-4", name: "Periodic Assessment 4 (Pre-Board)", maxMarks: 40, term: "Term 2" },
      { id: "Final-Annual", name: "Final Annual Board Exam", maxMarks: 100, term: "Term 2" },
    ];

    return cycles.map((c) => {
      const records = studentExams.filter((e) => e.examType === c.id || e.id?.includes(c.id.toLowerCase()));
      const hasMarks = records.length > 0;
      const totalObtained = records.reduce((sum, r) => sum + (r.marksObtained || 0), 0);
      const totalMax = records.reduce((sum, r) => sum + (r.maxMarks || c.maxMarks), 0) || (c.maxMarks * 5);
      const percentage = hasMarks && totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      return {
        ...c,
        records,
        hasMarks,
        totalObtained,
        totalMax,
        percentage,
        grade: !hasMarks ? "Pending" : percentage >= 90 ? "A1" : percentage >= 80 ? "A2" : percentage >= 70 ? "B1" : percentage >= 60 ? "B2" : "C",
      };
    });
  }, [studentExams]);

  const latestExamSummary = useMemo(() => {
    const halfYearly = examCycles.find((c) => c.id === "Half-Yearly");
    if (halfYearly && halfYearly.hasMarks) return halfYearly;
    const withMarks = examCycles.find((c) => c.hasMarks);
    if (withMarks) return withMarks;
    return {
      id: "Half-Yearly",
      name: "Half Yearly Examination",
      hasMarks: false,
      totalObtained: 0,
      totalMax: 500,
      percentage: 0,
      grade: "Pending",
      records: [],
    };
  }, [examCycles]);

  const [selectedExamCycle, setSelectedExamCycle] = useState("Half-Yearly");

  // Strict per-class daily teaching logs (Aaj kya padhaya gaya — session-wide)
  const studentClassLogs = useMemo(() => {
    const targetClsNorm = normalizeKeyText(cleanClassNum);
    const targetLabelNorm = normalizeKeyText(studentClassLabel);
    const targetId = String(activeStudent?.classId || "").trim();
    return dailyTeachingLogs
      .filter((l) => {
        if (!l) return false;
        if (targetId && l.classId && l.classId === targetId) return true;
        const logClsNorm = normalizeKeyText(String(l.className || "").replace(/^class\s*/i, ""));
        const logLabelNorm = normalizeKeyText(l.className);
        return (
          (targetClsNorm && (logClsNorm === targetClsNorm || logLabelNorm === targetClsNorm)) ||
          (targetLabelNorm && (logLabelNorm === targetLabelNorm || logClsNorm === targetLabelNorm))
        );
      })
      .sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
  }, [dailyTeachingLogs, activeStudent?.classId, cleanClassNum, studentClassLabel]);

  // Unified Daily Teaching & Homework Diary (combines daily teaching logs + standalone homework, filtered to student's class)
  const homeworkList = useMemo(() => {
    const seenIds = new Set<string>();
    const items: Array<{
      id: string;
      date: string;
      subject: string;
      title: string;
      assignedBy: string;
      dueDate: string;
      status: string;
      description: string;
      topics: string[];
      homeworkText?: string;
      picsCount: number;
      isTeachingLog: boolean;
      logMode?: string;
    }> = [];

    studentClassLogs.forEach((lg) => {
      const hwMirrorId = `hw_from_log_${lg.id}`;
      seenIds.add(lg.id);
      seenIds.add(hwMirrorId);
      items.push({
        id: lg.id,
        date: lg.date || getTodayIsoDate(),
        subject: lg.subjectName || "Class Work",
        title: lg.lessonTitle || lg.subjectName || "Daily Teaching",
        assignedBy: lg.teacherName || "Teacher",
        dueDate: formatShortDisplayDate(lg.date),
        status: "pending",
        description: lg.exerciseNote || lg.homeworkText || (lg.selectedTopicTitles?.length ? `${lg.selectedTopicTitles.length} Topic(s) taught in class` : "Daily classwork covered"),
        topics: Array.isArray(lg.selectedTopicTitles) ? lg.selectedTopicTitles : [],
        homeworkText: lg.homeworkText,
        picsCount: Array.isArray(lg.noteImages) ? lg.noteImages.length : 0,
        isTeachingLog: true,
        logMode: lg.logMode,
      });
    });

    const targetClsNorm = normalizeKeyText(cleanClassNum);
    const targetId = String(activeStudent?.classId || "").trim();
    realHomework.forEach((hw: any) => {
      if (!hw || seenIds.has(hw.id)) return;
      const hwClsId = String(hw.classId || "").trim();
      const hwClsNorm = normalizeKeyText(String(hw.className || "").replace(/^class\s*/i, ""));
      if (targetId && hwClsId && hwClsId !== targetId && hwClsNorm && hwClsNorm !== targetClsNorm) {
        return;
      }
      seenIds.add(hw.id);
      items.push({
        id: hw.id,
        date: hw.assignedDate || (hw.createdAt ? String(hw.createdAt).slice(0, 10) : getTodayIsoDate()),
        subject: hw.subjectName || hw.subject || "Homework",
        title: hw.title || "Class Assignment",
        assignedBy: hw.teacherName || hw.assignedBy || "Class Teacher",
        dueDate: hw.dueDate ? `Due: ${hw.dueDate}` : "Assigned",
        status: "pending",
        description: hw.description || "",
        topics: [],
        homeworkText: hw.description || hw.title,
        picsCount: hw.attachmentUrl ? 1 : 0,
        isTeachingLog: false,
      });
    });

    if (items.length > 0) {
      return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    if (!schoolDemoActive) return [];
    return [
      {
        id: "hw-1",
        date: getTodayIsoDate(),
        subject: "Mathematics",
        title: "Quadratic Equations - NCERT Exercise 4.3",
        assignedBy: "Mr. R. K. Verma (Math HOD)",
        dueDate: "Kal Subah 09:00 AM",
        status: "pending",
        description: "Solve Question 1 to 10 in the fair register. Show step-by-step formula derivation.",
        topics: ["Discriminant Method", "Roots of Quadratic Equation"],
        homeworkText: "Solve Question 1 to 5 in fair notebook.",
        picsCount: 0,
        isTeachingLog: true,
      },
      {
        id: "hw-2",
        date: getTodayIsoDate(),
        subject: "Science",
        title: "Chemical Reactions & Equations - Lab Notes",
        assignedBy: "Dr. Anjali Sen",
        dueDate: "3 Days Remaining",
        status: "completed",
        description: "Write displacement and double displacement reaction observations with balanced equations.",
        topics: ["Displacement Reaction", "Double Displacement"],
        picsCount: 0,
        isTeachingLog: true,
      },
    ];
  }, [studentClassLogs, realHomework, activeStudent?.classId, cleanClassNum, schoolDemoActive]);

  const noticesList = useMemo(() => {
    if (realNotices.length > 0) {
      return realNotices.map((n: any) => ({
        id: n.id,
        title: n.title || "School Notice",
        date: n.date || (n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""),
        category: n.category || n.type || "Official",
        body: n.content || n.body || n.message || "",
      }));
    }
    if (!schoolDemoActive) return [];
    return [
      {
        id: "demo-n1",
        title: "Annual Sports Meet & Athletic Championship 2026",
        date: "18 Oct 2026",
        category: "Sports",
        body: "Inter-house athletic meet will be organized in November. House Captains and sports teachers will conduct selection trials next week.",
      },
      {
        id: "demo-n2",
        title: "Parent-Teacher Meeting (PTM) for Half-Yearly Results",
        date: "12 Oct 2026",
        category: "Academic",
        body: "PTM will be conducted on Saturday between 08:30 AM to 12:30 PM. Parents must accompany students in complete school uniform.",
      },
    ];
  }, [realNotices, schoolDemoActive]);

  const holidaysList = useMemo(() => {
    if (realHolidays.length > 0) {
      return realHolidays.map((h: any) => ({
        id: h.id || h.name,
        name: h.name,
        date: h.endDate && h.endDate !== h.startDate ? `${h.startDate} to ${h.endDate}` : h.startDate,
        type: h.type || "holiday",
        days: h.description || (h.type ? String(h.type).toUpperCase() : "School Holiday"),
      }));
    }
    if (!schoolDemoActive) return [];
    return [
      { id: "h1", name: "Diwali (दीपावली)", date: "31 Oct 2026", type: "festival", days: "Vacation 29 Oct - 04 Nov" },
      { id: "h2", name: "Chhath Puja (छठ पूजा)", date: "06 Nov - 08 Nov 2026", type: "festival", days: "3 Days Holiday" },
      { id: "h3", name: "Guru Nanak Jayanti", date: "24 Nov 2026", type: "national", days: "1 Day Holiday" },
      { id: "h4", name: "Christmas & Winter Break", date: "25 Dec 2026 - 05 Jan 2027", type: "vacation", days: "Winter Vacation" },
      { id: "h5", name: "Republic Day (गणतंत्र दिवस)", date: "26 Jan 2027", type: "national", days: "Celebration at Campus" },
      { id: "h6", name: "Holi (होली)", date: "22 Mar - 24 Mar 2027", type: "festival", days: "3 Days Holiday" },
    ];
  }, [realHolidays, schoolDemoActive]);

  const [homeworkStatusMap, setHomeworkStatusMap] = useState<Record<string, string>>({});

  const toggleHomeworkStatus = (hwId: string) => {
    setHomeworkStatusMap((prev) => ({
      ...prev,
      [hwId]: prev[hwId] === "completed" ? "pending" : "completed",
    }));
  };

  // Student QR payload for digital Chrome verification + instant Attendance/App Login
  const qrStudentPayload = buildStudentIdCardQrUrl({
    schoolId,
    studentId: activeStudent.id,
    rollNo: activeStudent.rollNo,
    classId: activeStudent.classId || "cls_nursery",
    studentName: activeStudent.name,
    admissionNo: activeStudent.admissionNo || "",
    phone: activeStudent.phone || "",
    fatherName: activeStudent.fatherName || "",
    motherName: activeStudent.motherName || "",
    bloodGroup: activeStudent.bloodGroup || "",
    dob: activeStudent.dateOfBirth || "",
    address: activeStudent.address || "",
    monthlyFee: activeStudent.monthlyFee ?? "",
    className: studentClassLabel,
    schoolName: school?.name || (activeStudent as any)?.schoolName || "",
  });

  const schoolDisplayName = useMemo(() => {
    // 1. Loaded school profile for THIS schoolId takes highest priority for multi-school accuracy
    if (school?.name && school.name.trim() && school.name.trim().toLowerCase() !== "delhi public school" && school.name.trim() !== "School") {
      return school.name.trim();
    }

    // 2. Explicit student record schoolName
    const studentRecordSchoolName =
      (activeStudent as any)?.schoolName ||
      linkedStudent?.schoolName ||
      (currentStudent as any)?.schoolName ||
      enrichedData?.schoolName;

    if (studentRecordSchoolName && studentRecordSchoolName.trim() && studentRecordSchoolName.trim().toLowerCase() !== "delhi public school") {
      return studentRecordSchoolName.trim();
    }

    // 3. Logged-in session user schoolName ONLY if it matches this schoolId
    try {
      const rawUser = localStorage.getItem("nst_current_user") || localStorage.getItem("nsta_cached_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (
          (!parsed?.schoolId || parsed.schoolId === schoolId) &&
          parsed?.schoolName &&
          typeof parsed.schoolName === "string" &&
          parsed.schoolName.trim() &&
          parsed.schoolName.trim().toLowerCase() !== "delhi public school"
        ) {
          return parsed.schoolName.trim();
        }
      }
    } catch {}

    // 4. Fallback to school?.name or student's school or Life Maker Public School
    return (school?.name && school.name.trim()) || (studentRecordSchoolName && studentRecordSchoolName.trim()) || "Life Maker Public School";
  }, [school?.name, schoolId, activeStudent, linkedStudent, currentStudent, enrichedData]);

  const schoolInitials = (schoolDisplayName || "LM").slice(0, 2).toUpperCase();
  const resolvedSchoolLogo = getSavedSchoolLogo(school?.logoUrl || (activeStudent as any)?.schoolLogo, schoolId);

  const [birthdayModalData, setBirthdayModalData] = useState<NstaBirthdayData | null>(null);

  // Android / Browser Back button step-by-step navigation across Student Portal
  useBackHandler(showQrAttendanceScanner, () => setShowQrAttendanceScanner(false), 30);
  useBackHandler(showFaceIdModal, () => setShowFaceIdModal(false), 30);
  useBackHandler(Boolean(selectedFeeForReceipt), () => setSelectedFeeForReceipt(null), 28);
  useBackHandler(Boolean(welcomeModalData), () => setWelcomeModalData(null), 25);
  useBackHandler(Boolean(birthdayModalData), () => setBirthdayModalData(null), 25);
  useBackHandler(Boolean(selectedChapterNotes), () => setSelectedChapterNotes(null), 24);
  useBackHandler(Boolean(selectedSchoolNote), () => setSelectedSchoolNote(null), 24);
  useBackHandler(Boolean(selectedSyllabusSubject), () => setSelectedSyllabusSubject(null), 22);
  useBackHandler(Boolean(selectedSchoolSubject), () => setSelectedSchoolSubject(null), 22);
  useBackHandler(showClassSyllabusModal, () => setShowClassSyllabusModal(false), 20);
  useBackHandler(showSchoolSyllabusModal, () => setShowSchoolSyllabusModal(false), 20);
  useBackHandler(showPtmModal, () => setShowPtmModal(false), 20);
  useBackHandler(showBusLiveMapModal, () => setShowBusLiveMapModal(false), 20);
  useBackHandler(showThemeModal, () => setShowThemeModal(false), 20);
  useBackHandler(showNotificationModal, () => setShowNotificationModal(false), 20);
  useBackHandler(showStudentSwitcherModal, () => setShowStudentSwitcherModal(false), 20);
  useBackHandler(showAllHolidaysModal, () => setShowAllHolidaysModal(false), 20);
  useBackHandler(showBulkFeeModal, () => setShowBulkFeeModal(false), 20);
  useBackHandler(Boolean(selectedAdmissionModal), () => setSelectedAdmissionModal(null), 20);
  useBackHandler(showPreAdmissionMonths, () => setShowPreAdmissionMonths(false), 20);
  useBackHandler(Boolean(confirmRemoveLinkedKey), () => setConfirmRemoveLinkedKey(null), 20);
  useBackHandler(activeTab !== "overview", () => setActiveTab("overview"), 0);

  // Automated Birthday Detection & School Dispatch
  useEffect(() => {
    if (!studentId) return;
    const currentYear = new Date().getFullYear();
    const sentKey = `nst_birthday_wish_sent_${schoolId || "school"}_${studentId}_${currentYear}`;
    const pendingPopupKey = `nst_show_birthday_popup_${studentId}`;

    // 1. Check if pending popup flag was already queued
    try {
      const hasPopup = localStorage.getItem(pendingPopupKey);
      if (hasPopup) {
        localStorage.removeItem(pendingPopupKey);
        let parsed: NstaBirthdayData | null = null;
        try {
          parsed = JSON.parse(hasPopup);
        } catch {}
        if (parsed && parsed.studentName) {
          setBirthdayModalData(parsed);
          return;
        }
      }
    } catch {}

    // 2. Check if today is student's birthday!
    const targetStudent = activeStudent || currentStudent;
    if (targetStudent && targetStudent.dateOfBirth && isStudentBirthdayToday(targetStudent.dateOfBirth)) {
      try {
        const alreadyWished = localStorage.getItem(sentKey);
        void dispatchOfficialSchoolBirthdayWish(targetStudent, {
          force: false,
          triggerPopup: true,
          schoolName: schoolDisplayName || school?.name || undefined,
          schoolLogo: resolvedSchoolLogo || undefined,
        }).then((msg) => {
          if (msg?.birthdayData) {
            setBirthdayModalData(msg.birthdayData);
          } else if (!alreadyWished) {
            setBirthdayModalData({
              studentId: targetStudent.id,
              studentName: targetStudent.name,
              admissionNo: targetStudent.admissionNo,
              rollNo: targetStudent.rollNo,
              className: targetStudent.className || formatClassLabel(studentClassLabel),
              schoolName: schoolDisplayName || school?.name || "NSTA Digital School",
              schoolLogo: resolvedSchoolLogo || undefined,
              dateOfBirth: targetStudent.dateOfBirth,
              wishedYear: currentYear,
              issuedAt: new Date().toISOString(),
            });
          }
        });
      } catch {}
    }
  }, [studentId, activeStudent, currentStudent, schoolId, schoolDisplayName, school?.name, resolvedSchoolLogo, studentClassLabel]);

  // Listen for real-time birthday wish event
  useEffect(() => {
    const handleBirthdayEvent = (e: any) => {
      if (e?.detail) {
        setBirthdayModalData(e.detail);
      }
    };
    window.addEventListener("nst-school-birthday-received", handleBirthdayEvent);
    return () => window.removeEventListener("nst-school-birthday-received", handleBirthdayEvent);
  }, []);

  // Sync active student's pending fee balance to the Web Push server so monthly auto-reminders always have exact ₹ due!
  useEffect(() => {
    if (!activeStudent?.id || !schoolId) return;
    void syncStudentFeeDueForPush({
      studentId: activeStudent.id,
      schoolId,
      schoolName: schoolDisplayName,
      studentName: activeStudent.name,
      classId: activeStudent.classId,
      className: formatClassLabel(studentClassLabel),
      rollNo: activeStudent.rollNo,
      pendingDues,
      monthlyFee: studentMonthlyFee,
    });
  }, [activeStudent?.id, activeStudent?.name, activeStudent?.classId, activeStudent?.rollNo, schoolId, schoolDisplayName, studentClassLabel, pendingDues, studentMonthlyFee]);

  const buildPushStudentList = () => {
    const baseList = Array.isArray(allLinkedStudents) && allLinkedStudents.length > 0
      ? allLinkedStudents
      : [activeStudent];
    return baseList.map((st: any) => ({
      id: st.id,
      schoolId: st.schoolId || schoolId,
      schoolName: st.id === activeStudent.id ? schoolDisplayName : (st.schoolName || schoolDisplayName),
      classId: st.classId || "cls_nursery",
      className: st.id === activeStudent.id ? formatClassLabel(studentClassLabel) : (st.className || ""),
      name: st.name || "Student",
      rollNo: st.rollNo || "01",
      admissionNo: st.admissionNo || "",
      pendingDues: st.id === activeStudent.id ? pendingDues : undefined,
      monthlyFee: st.id === activeStudent.id ? studentMonthlyFee : st.monthlyFee,
    }));
  };

  // Persist active student/school metadata so NotificationManager, FCM tokens, and App Web Push always know exact schoolId + classId + studentId
  useEffect(() => {
    if (!activeStudent?.id || !schoolId) return;
    const resolvedClassName = formatClassLabel(studentClassLabel) || (activeStudent as any).className || "";
    try {
      const cachedPayload = {
        id: activeStudent.id,
        schoolId,
        schoolName: schoolDisplayName,
        classId: activeStudent.classId || "",
        className: resolvedClassName,
        section: activeStudent.section || "",
        name: activeStudent.name || "Student",
        rollNo: activeStudent.rollNo || "",
        admissionNo: activeStudent.admissionNo || "",
      };
      localStorage.setItem("nst_active_student", JSON.stringify(cachedPayload));
      localStorage.setItem("nst_active_school_id", schoolId);
      if (activeStudent.classId || resolvedClassName) {
        localStorage.setItem("nst_user_class", resolvedClassName || activeStudent.classId);
      }
      window.dispatchEvent(
        new CustomEvent("nst_school_identity_updated", {
          detail: { studentId: activeStudent.id, schoolId, classId: activeStudent.classId, className: resolvedClassName },
        })
      );
    } catch {}

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      autoSyncSchoolPushIfPermitted({
        userId: effectiveUid,
        schoolId,
        students: buildPushStudentList(),
      })
        .then((ok) => {
          if (ok) setPushEnabled(true);
        })
        .catch(() => {});

      try {
        const fcmSyncKey = `nst_fcm_student_synced_${activeStudent.id}_${activeStudent.classId || ""}`;
        if (!sessionStorage.getItem(fcmSyncKey)) {
          const targetPushUid = effectiveUid && effectiveUid !== "guest" ? effectiveUid : activeStudent.id;
          subscribeUserToPush(targetPushUid)
            .then((tok) => {
              if (tok) {
                try {
                  sessionStorage.setItem(fcmSyncKey, "1");
                } catch {}
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
  }, [activeStudent?.id, activeStudent?.classId, activeStudent?.name, schoolId, schoolDisplayName, studentClassLabel, effectiveUid, allLinkedStudents?.length]);

  const handleTogglePushAlerts = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushFeedback(null);
    try {
      if (pushEnabled) {
        await disableSchoolPushForUser(effectiveUid);
        setPushEnabled(false);
        setPushFeedback({ type: "ok", text: "Push notifications band kar diye gaye hain." });
      } else {
        const res = await enableSchoolPushForUser({
          userId: effectiveUid,
          students: buildPushStudentList(),
          replaceStudents: true,
        });
        if (res.ok) {
          setPushEnabled(true);
          const targetPushUid = effectiveUid && effectiveUid !== "guest" ? effectiveUid : activeStudent.id;
          subscribeUserToPush(targetPushUid).catch(() => {});
          const count = Array.isArray(allLinkedStudents) && allLinkedStudents.length > 1 ? allLinkedStudents.length : 1;
          setPushFeedback({
            type: "ok",
            text: `🔔 Lock Screen Alerts ON! ${count > 1 ? `Sabhi ${count} students` : activeStudent.name} ka monthly fee due aur school notice ab app band hone par bhi aayega.`,
          });
        } else {
          setPushFeedback({ type: "err", text: res.error || "Notification allow nahi ho paya." });
        }
      }
    } finally {
      setPushBusy(false);
      setTimeout(() => setPushFeedback(null), 7000);
    }
  };

  const handleSendTestLockScreenPush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const dueStr = pendingDues > 0
        ? `कुल शेष देय शुल्क ₹${pendingDues.toLocaleString("en-IN")} है।`
        : "इस माह तक कोई शुल्क बकाया नहीं है (No Dues)।";
      const res = await sendSchoolPushNotification({
        userId: effectiveUid,
        studentIds: [activeStudent.id],
        schoolId,
        allowSelf: true,
        type: "MONTHLY_FEE",
        title: `🏫 ${schoolDisplayName} • शुल्क व नोटिस अलर्ट`,
        body: `${activeStudent.name} (${formatClassLabel(studentClassLabel)}, Roll #${activeStudent.rollNo}): ${dueStr}`,
        url: `/?schoolPortal=1&studentId=${encodeURIComponent(activeStudent.id)}&schoolTab=fees`,
        urgent: true,
      });
      if (res.delivered > 0) {
        setPushFeedback({
          type: "ok",
          text: "✅ Push bhej diya gaya! Phone lock karke ya notification tray kholkar dekhein.",
        });
      } else {
        setPushFeedback({
          type: "err",
          text: "Push deliver nahi hua — kripya ek baar Alerts OFF karke dobara ON karein.",
        });
      }
    } finally {
      setPushBusy(false);
      setTimeout(() => setPushFeedback(null), 6000);
    }
  };

  // Check if school subscription is expired
  const schoolExpIso = school?.subscription?.expiresAt || school?.subscription?.paidUntil;
  const isSchoolSubExpired = schoolExpIso ? new Date(schoolExpIso).getTime() <= Date.now() : false;

  if (isSchoolSubExpired && school) {
    const expiredFormattedDate = schoolExpIso
      ? new Date(schoolExpIso).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "24 April 2027";

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-md w-full bg-slate-900/90 border-2 border-red-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-4xl shadow-xl shadow-red-600/40 border border-red-400/40">
            🔒
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-[11px] font-black uppercase mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>School Modules Locked</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Subscription Expired
            </h2>
            <p className="text-xs text-red-400 font-bold mt-1">
              Access Terminated (स्कूल मॉड्यूल लॉक हो गए हैं)
            </p>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Aapke school ({school.name}) ka subscription plan samapt ho chuka hai. Kripya school administration ya principal se contact karein taaki plan renew ho sake.
            </p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-xs text-left space-y-1.5 text-slate-400">
            <div className="flex justify-between">
              <span>School:</span>
              <span className="font-bold text-white">{school.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Expired On:</span>
              <span className="font-bold text-red-400">{expiredFormattedDate}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Logout / Switch Student
              </button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 student-theme-${studentTheme} app-theme-${studentTheme} ${
      studentTheme === "white"
        ? "bg-slate-100 text-slate-900"
        : studentTheme === "black"
        ? "dark bg-black text-white"
        : "dark bg-[#08142c] text-slate-100"
    }`}>
      {/* ── COMPACT HOME HEADER & CAMPUS SNAPSHOT (CLEAN DAILY VIEW) ── */}
      {activeTab === "overview" && (
        <div className={`border-b px-4 sm:px-6 py-3.5 ${
          studentTheme === "white"
            ? "bg-white border-slate-200 text-slate-900"
            : studentTheme === "black"
            ? "bg-[#060606] border-neutral-800 text-white"
            : "bg-[#0d2042]/95 border-[#1e3a6e] text-white"
        }`}>
          <div className="max-w-6xl mx-auto space-y-3">
            {/* School Name & Official Notification Row */}
            <div className={`flex items-center justify-between gap-3 pb-2.5 border-b ${
              studentTheme === "white"
                ? "border-slate-200"
                : studentTheme === "black"
                ? "border-neutral-800"
                : "border-[#1d396b]"
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {resolvedSchoolLogo && !isAppLogo(resolvedSchoolLogo) ? (
                  <img
                    src={resolvedSchoolLogo}
                    alt="Logo"
                    className={`w-8 h-8 rounded-xl object-contain bg-white p-0.5 border shadow-sm shrink-0 ${
                      studentTheme === "white" ? "border-slate-300" : "border-slate-700"
                    }`}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-black text-white text-xs shrink-0">
                    {schoolInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className={`text-xs sm:text-sm font-black tracking-tight truncate ${
                      studentTheme === "white" ? "text-slate-900" : "text-white"
                    }`}>
                      {schoolDisplayName}
                    </h2>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${
                      studentTheme === "white"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-400/35"
                    }`}>
                      Student Portal
                    </span>
                  </div>
                  <p className={`text-[10px] ${studentTheme === "white" ? "text-slate-600" : "text-slate-300"}`}>Official Student &amp; Parent Digital Campus</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNotificationModal(true)}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                    pushEnabled
                      ? studentTheme === "white"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : studentTheme === "black"
                        ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-emerald-500/15 border-emerald-400/35 text-emerald-300 hover:bg-emerald-500/25"
                      : studentTheme === "white"
                      ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                      : studentTheme === "black"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                      : "bg-[#112447] border-[#274882] text-slate-400 hover:bg-[#16305f]"
                  }`}
                  aria-label={pushEnabled ? "Notifications ON" : "Notifications OFF"}
                  title={pushEnabled ? "Notifications ON · Tap to manage" : "Notifications OFF · Tap to enable"}
                >
                  {pushEnabled ? (
                    <Bell className="w-5 h-5" />
                  ) : (
                    <BellOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Slim Student Greeting Strip + 3 Quick Stats */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-[0.99] flex-1 min-w-0 ${
                  studentTheme === "white"
                    ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                    : studentTheme === "black"
                    ? "bg-neutral-950 hover:bg-neutral-900 border-neutral-800"
                    : "bg-[#091833] hover:bg-[#0e2247] border-[#213f75]"
                }`}
                title="Open Student Profile, ID Card & Settings"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {activePhoto ? (
                    <img
                      src={activePhoto}
                      alt={activeStudent.name}
                      className="w-10 h-10 rounded-xl object-cover border border-emerald-500/50 shrink-0"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${
                      studentTheme === "white"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                        : "bg-[#12264d] border-[#294c88] text-white"
                    }`}>
                      {studentInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-black truncate ${studentTheme === "white" ? "text-slate-900" : "text-white"}`}>
                      {activeStudent.name}
                    </p>
                    <p className={`text-[11px] truncate ${studentTheme === "white" ? "text-slate-600" : "text-slate-300"}`}>
                      {formatClassLabel(studentClassLabel)} · Roll #{activeStudent.rollNo}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 flex items-center gap-1 ${
                  studentTheme === "white"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-indigo-500/20 text-indigo-200 border-indigo-400/35"
                }`}>
                  <User className="w-3 h-3" />
                  <span>Profile</span>
                </span>
              </button>

              {/* Key Stat Summary */}
              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  className={`p-2 rounded-xl border hover:border-emerald-500/50 text-center min-w-[84px] cursor-pointer transition active:scale-95 group shadow-xs ${
                    studentTheme === "white"
                      ? "bg-slate-50 border-slate-200"
                      : studentTheme === "black"
                      ? "bg-neutral-950 border-neutral-800"
                      : "bg-[#091833] border-[#213f75]"
                  }`}
                  title="View full attendance details"
                >
                  <span className={`text-[10px] block ${studentTheme === "white" ? "text-slate-600" : "text-slate-300"}`}>Attendance</span>
                  <span className={`text-sm font-bold tabular-nums block ${studentTheme === "white" ? "text-emerald-700" : "text-emerald-400"}`}>
                    {attendanceStats.percentage}%
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("fees")}
                  className={`p-2 rounded-xl border hover:border-amber-500/50 text-center min-w-[84px] cursor-pointer transition active:scale-95 group shadow-xs ${
                    studentTheme === "white"
                      ? "bg-slate-50 border-slate-200"
                      : studentTheme === "black"
                      ? "bg-neutral-950 border-neutral-800"
                      : "bg-[#091833] border-[#213f75]"
                  }`}
                  title="View full fee passbook & dues"
                >
                  <span className={`text-[10px] block ${studentTheme === "white" ? "text-slate-600" : "text-slate-300"}`}>Fee Dues</span>
                  <span className={`text-sm font-bold tabular-nums block ${
                    pendingDues === 0
                      ? studentTheme === "white" ? "text-emerald-700" : "text-emerald-400"
                      : studentTheme === "white" ? "text-amber-700" : "text-amber-400"
                  }`}>
                    {pendingDues === 0 ? "Cleared" : `₹${pendingDues.toLocaleString("en-IN")}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("exams")}
                  className={`p-2 rounded-xl border hover:border-indigo-500/50 text-center min-w-[84px] cursor-pointer transition active:scale-95 group shadow-xs ${
                    studentTheme === "white"
                      ? "bg-slate-50 border-slate-200"
                      : studentTheme === "black"
                      ? "bg-neutral-950 border-neutral-800"
                      : "bg-[#091833] border-[#213f75]"
                  }`}
                  title="View exam results & report card"
                >
                  <span className={`text-[10px] block ${studentTheme === "white" ? "text-slate-600" : "text-slate-300"}`}>Result</span>
                  <span className={`text-sm font-bold tabular-nums block ${studentTheme === "white" ? "text-indigo-700" : "text-indigo-300"}`}>
                    {latestExamSummary.hasMarks ? `${latestExamSummary.percentage}%` : "Active"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE / PUSH FEEDBACK TOAST ────────────────────────────────── */}
      {attendanceSuccessMsg && (
        <div className="mx-4 mt-3 max-w-6xl mx-auto p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{attendanceSuccessMsg}</span>
          </div>
          <button onClick={() => setAttendanceSuccessMsg(null)} className="text-emerald-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {pushFeedback && (
        <div
          className={`mx-4 mt-3 max-w-6xl mx-auto p-3 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in border ${
            pushFeedback.type === "ok"
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
              : "bg-rose-500/20 border-rose-500/40 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 shrink-0" />
            <span>{pushFeedback.text}</span>
          </div>
          <button onClick={() => setPushFeedback(null)} className="hover:text-white font-bold ml-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ── MAIN TAB CONTENT CONTAINER ─────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-28 space-y-6">
        {/* TAB 1: UNIFIED APP LAUNCHPAD HOME & PROFILE ──────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* ── UNIFIED PARENT TRUST DASHBOARD & LIVE BUS / SAFETY SNAPSHOT ── */}
            <ParentTrustDashboardCard
              schoolId={schoolId}
              student={activeStudent}
              attendanceStats={attendanceStats}
              todayAttendanceStatus={todayEntry?.status}
              todayInTime={todayEntry?.inTime}
              homeworkList={homeworkList}
              latestExamSummary={{
                hasMarks: latestExamSummary.hasMarks,
                percentage: latestExamSummary.percentage,
                grade: latestExamSummary.grade,
                examType: latestExamSummary.name,
              }}
              upcomingNotices={noticesList}
              pendingDues={pendingDues}
              onOpenGrowthHub={() => setActiveTab("growth_hub")}
              onOpenHealthSafety={() => setActiveTab("health_safety")}
              onOpenBusMap={() => setShowBusLiveMapModal(true)}
              onOpenAttendance={() => setActiveTab("attendance")}
              onOpenHomework={() => setActiveTab("homework")}
              onOpenExams={() => setActiveTab("exams")}
            />

            {/* ── DAILY CLASS DIARY ("AAJ KYA PADHAYA GAYA" — QUICK HOME SUMMARY) ── */}
            <div
              className={`rounded-2xl p-4 sm:p-5 border shadow-xs space-y-3 ${
                studentTheme === "white"
                  ? "bg-white border-slate-200"
                  : studentTheme === "black"
                  ? "bg-neutral-950 border-neutral-800"
                  : "bg-slate-900 border-slate-800"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${
                    studentTheme === "white" ? "text-slate-900" : "text-white"
                  }`}>
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <span>Daily Class Diary · Aaj Kya Padhaya Gaya</span>
                  </h3>
                  <p className={`text-[11px] mt-0.5 ${
                    studentTheme === "white" ? "text-slate-500" : "text-slate-400"
                  }`}>
                    {formatClassLabel(selectedClassLevel)} ka daily padhaya gaya syllabus aur optional homework
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("homework")}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      studentTheme === "white"
                        ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    Full Diary ({homeworkList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClassworkDateFilter("ALL");
                      setClassworkSubjectFilter("ALL");
                      setAdvanceTab("classwork");
                      setActiveTab("advance");
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black transition cursor-pointer shadow-xs"
                  >
                    📸 Class Work &amp; Pics
                  </button>
                </div>
              </div>

              {homeworkList.length === 0 ? (
                <div className={`p-4 rounded-xl border text-center ${
                  studentTheme === "white"
                    ? "bg-slate-50 border-slate-200 text-slate-600"
                    : "bg-slate-950/60 border-slate-800 text-slate-400"
                }`}>
                  <p className="text-xs font-bold">
                    Abhi {formatClassLabel(selectedClassLevel)} ke liye aaj ki teaching diary update nahi hui hai
                  </p>
                  <p className="text-[11px] mt-0.5 opacity-80">
                    Teacher jaise hi period me topics aur class notes update karenge, yahan turant dikhega.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {homeworkList.slice(0, 4).map((item) => {
                    const isDone = homeworkStatusMap[item.id] === "completed";
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border space-y-2 transition ${
                          studentTheme === "white"
                            ? "bg-slate-50/80 border-slate-200"
                            : "bg-slate-950/70 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 text-[10px] font-black">
                            {item.subject}
                          </span>
                          <span className={`text-[10px] font-bold ${
                            studentTheme === "white" ? "text-slate-500" : "text-slate-400"
                          }`}>
                            {item.dueDate}
                          </span>
                        </div>
                        <p className={`text-xs font-black leading-snug ${
                          studentTheme === "white" ? "text-slate-900" : "text-white"
                        } ${isDone ? "line-through opacity-70" : ""}`}>
                          {item.title}
                        </p>
                        {item.topics && item.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.topics.slice(0, 4).map((tp, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[10px] font-bold"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                <span>{tp}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {item.homeworkText && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                            📝 Homework: {item.homeworkText}
                          </p>
                        )}
                        <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500 truncate">
                            {item.assignedBy}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {item.picsCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClassworkDateFilter(item.date || "ALL");
                                  setClassworkSubjectFilter("ALL");
                                  setAdvanceTab("classwork");
                                  setActiveTab("advance");
                                }}
                                className="px-2 py-1 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-600 dark:text-indigo-300 text-[10px] font-black cursor-pointer"
                              >
                                📸 {item.picsCount} Pic(s)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleHomeworkStatus(item.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                                isDone
                                  ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400"
                                  : "bg-emerald-600 text-white hover:bg-emerald-500"
                              }`}
                            >
                              {isDone ? "Done ✓" : "Mark Done"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SCHOOL HOLIDAYS & VACATIONS (ADJUSTED ON HOME PAGE) ── */}
            <div
              className={`rounded-2xl p-4 sm:p-5 border shadow-xs space-y-3 ${
                studentTheme === "white"
                  ? "bg-white border-slate-200"
                  : studentTheme === "black"
                  ? "bg-neutral-950 border-neutral-800"
                  : "bg-slate-900 border-slate-800"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${
                    studentTheme === "white" ? "text-slate-900" : "text-white"
                  }`}>
                    <CalendarDays className="w-4 h-4 text-rose-500" />
                    <span>School Holidays &amp; Calendar</span>
                  </h3>
                  <p className={`text-[11px] mt-0.5 ${
                    studentTheme === "white" ? "text-slate-500" : "text-slate-400"
                  }`}>
                    Aane wali school chhuttiyan, festivals aur vacations
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllHolidaysModal(true)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black border flex items-center gap-1 transition cursor-pointer ${
                    studentTheme === "white"
                      ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                      : "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/35"
                  }`}
                >
                  <span>All Holidays ({holidaysList.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {holidaysList.length === 0 ? (
                <div className={`p-4 rounded-xl border text-center ${
                  studentTheme === "white"
                    ? "bg-slate-50 border-slate-200 text-slate-600"
                    : "bg-slate-950/60 border-slate-800 text-slate-400"
                }`}>
                  <p className="text-xs font-bold">Abhi koi upcoming holiday list nahi hai</p>
                  <p className="text-[11px] mt-0.5 opacity-80">School Admin holiday update karne par yahan turant dikhega.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {holidaysList.slice(0, 3).map((h, i) => {
                    const isFestival = h.type === "festival" || h.name?.includes("पूजा") || h.name?.includes("दिवाली") || h.name?.includes("होली");
                    const isNational = h.type === "national" || h.name?.includes("दिवस") || h.name?.includes("Jayanti");
                    const isVacation = h.type === "vacation" || h.days?.toLowerCase().includes("vacation") || h.days?.toLowerCase().includes("break");
                    return (
                      <div
                        key={h.id || `home_hol_${i}`}
                        className={`p-3 rounded-xl border flex items-start gap-3 ${
                          studentTheme === "white"
                            ? "bg-slate-50/80 border-slate-200"
                            : "bg-slate-950/70 border-slate-800"
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border text-center font-bold ${
                          isFestival
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"
                            : isNational
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                            : isVacation
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300"
                        }`}>
                          <span className="text-[9px] uppercase font-mono opacity-80">
                            {h.date?.split(" ")[1] || "HOL"}
                          </span>
                          <span className="text-xs font-black leading-none mt-0.5">
                            {h.date?.split(" ")[0]?.slice(0, 5) || i + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs font-black truncate ${studentTheme === "white" ? "text-slate-900" : "text-white"}`}>
                            {h.name}
                          </h4>
                          <p className={`text-[11px] mt-0.5 truncate ${studentTheme === "white" ? "text-slate-600" : "text-slate-400"}`}>
                            {h.date}
                          </p>
                          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isFestival
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : isNational
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : isVacation
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          }`}>
                            {h.days || h.type || "Holiday"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clean Campus Quick Access (Non-Profile Campus Links) */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className={`text-sm font-bold ${studentTheme === "white" ? "text-slate-900" : "text-white"}`}>
                  Campus Quick Services
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`text-xs font-bold cursor-pointer ${studentTheme === "white" ? "text-indigo-600 hover:text-indigo-800" : "text-indigo-300 hover:text-white"}`}
                >
                  ID Card &amp; Documents → Profile
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("store")}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 text-left transition cursor-pointer flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">School Store</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Books · Dress · Stationery</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("teachers")}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/40 text-left transition cursor-pointer flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Our Teachers</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Faculty Directory</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 text-left transition cursor-pointer flex items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">My Profile &amp; Docs</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">ID Card · Receipts · Settings</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: NSTA MESSENGER SUITE (CLASS | SCHOOL | TEACHER) ─────────── */}
        {activeTab === "channel" && (
          <div className="fixed top-0 inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 bg-slate-950 flex flex-col overflow-hidden">
            <LazyPanelBoundary title="NSTA Messenger">
              <NstaMessengerSuite
                school={{
                  ...(school || {}),
                  id: schoolId,
                  name: schoolDisplayName,
                  logoUrl: resolvedSchoolLogo,
                  address: school?.address || "Institutional Academic Campus, Educational Zone",
                  affiliation: school?.affiliation || "Affiliated School Campus",
                  code: getVisibleSchoolRegNo(school),
                } as any}
                currentUserRole="STUDENT"
                currentUserId={activeStudent?.id || studentId || "std_current"}
                currentUserName={activeStudent?.name || studentName || "Student"}
                student={activeStudent || undefined}
                classes={classesList}
                teachers={schoolTeachers}
                students={allStudentsInSchool}
                fees={allStudentFees}
                initialTeacherId={requestedTeacherChatId}
                onClearInitialTeacher={() => setRequestedTeacherChatId(null)}
                onBack={() => setActiveTab("overview")}
                onOpenFeeReceipt={(f) => {
                  const isA6Demand = f?.type === "A6_DEMAND_SLIP" || f?.slipType === "A6_DEMAND_SLIP" || f?.isDueDemand || (f?.paid === false && Number(f?.paidAmount || 0) === 0);
                  setFeeModalFormat(isA6Demand ? "a6" : "pos");
                  setSelectedFeeForReceipt(f);
                }}
                onOpenWhatsAppPay={(f) => {
                  setPendingWhatsAppFee(f);
                  setShowWhatsAppModal(true);
                }}
              />
            </LazyPanelBoundary>
          </div>
        )}

        {/* ── TAB: CLASSROOM VIDEO LECTURES & REVISION ARCHIVE ────────────────── */}
        {activeTab === "videos" && activeStudent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setAdvanceTab("videos");
                  setActiveTab("advance");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>वापस (Back to Advance)</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-black flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span>Class: {activeStudent.className || "My Class"}</span>
                </span>
              </div>
            </div>

            <LazyPanelBoundary title="Classroom Videos">
              <ClassroomVideoArchive
                school={{
                  ...(school || {}),
                  id: schoolId,
                  name: schoolDisplayName,
                  logoUrl: resolvedSchoolLogo,
                  address: school?.address || "Institutional Academic Campus, Educational Zone",
                  affiliation: school?.affiliation || "Affiliated School Campus",
                  code: getVisibleSchoolRegNo(school),
                } as any}
                classes={classesList}
                teachers={schoolTeachers}
                currentUserRole="STUDENT"
                studentClassId={activeStudent.classId}
                studentClassName={studentClassLabel || activeStudent.className}
                onBack={() => {
                  setAdvanceTab("videos");
                  setActiveTab("advance");
                }}
              />
            </LazyPanelBoundary>
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE ────────────────────────────────────────────── */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            {/* Today's IN / OUT Live Status & School Shift Timing Card */}
            {(() => {
              const liveShift = getLiveShiftStatus(attendanceSchedule);
              return (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        आज की हाजिरी (Today IN / OUT Status)
                      </h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/35 text-cyan-700 dark:text-cyan-300 text-[11px] font-semibold">
                      {liveShift.badgeText}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                        IN (प्रवेश समय)
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5 block">
                        {todayEntry?.inTime || (todayEntry?.status === "absent" ? "अनुपस्थित (Absent)" : "अभी दर्ज नहीं")}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        स्कूल समय: {formatTime12h(attendanceSchedule.inCutoffTime)} तक समय पर
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                        OUT (प्रस्थान / छुट्टी)
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5 block">
                        {todayEntry?.outTime
                          ? todayEntry.outTime
                          : todayEntry?.inTime
                          ? `बाकी (${formatTime12h(attendanceSchedule.outStartTime)} से)`
                          : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        ऑटो OUT {formatTime12h(attendanceSchedule.outStartTime)} के बाद सक्रिय होता है
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-400 block">
                        कुल स्कूल समय (Stay)
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5 block">
                        {todayEntry?.stayDuration || (todayEntry?.inTime ? "स्कूल में उपस्थित" : "—")}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Status: {todayEntry?.status ? todayEntry.status.toUpperCase() : "WAITING"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Attendance Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Total Days</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{attendanceStats.total}</span>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">Present</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{attendanceStats.present}</span>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold uppercase block">Absent</span>
                <span className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{attendanceStats.absent}</span>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold uppercase block">Late Entry</span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{attendanceStats.late}</span>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center col-span-2 sm:col-span-1 shadow-xs">
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold uppercase block">Percentage</span>
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{attendanceStats.percentage}%</span>
              </div>
            </div>

            {/* Recent Daily IN/OUT Log */}
            {studentAttendanceLogs.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                  दैनिक आगमन व प्रस्थान रिकॉर्ड (Recent IN / OUT Log)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-2 px-3 rounded-l-lg">Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-emerald-700 dark:text-emerald-400">IN Time</th>
                        <th className="py-2 px-3 text-amber-700 dark:text-amber-400">OUT Time</th>
                        <th className="py-2 px-3 text-right rounded-r-lg">Total Stay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono tabular-nums">
                      {studentAttendanceLogs.slice(0, 10).map((log, idx) => (
                        <tr key={`att-log-${log.date}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{log.date}</td>
                          <td className="py-2 px-3 uppercase text-[10px] font-bold">
                            <span className={
                              log.status === "absent"
                                ? "text-rose-600 dark:text-rose-400"
                                : log.status === "late"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-emerald-700 dark:text-emerald-300">{log.inTime || "—"}</td>
                          <td className="py-2 px-3 text-amber-700 dark:text-amber-300">
                            {log.outTime || (log.inTime ? "Pending" : "—")}
                          </td>
                          <td className="py-2 px-3 text-right text-indigo-700 dark:text-indigo-300">{log.stayDuration || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Attendance Monthly Breakdown */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Monthly Attendance Summary (Session {getDynamicAcademicSessionLabel()})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Month</th>
                      <th className="py-2.5 px-3">Recorded Days</th>
                      <th className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400">Present</th>
                      <th className="py-2.5 px-3 text-rose-700 dark:text-rose-400">Absent</th>
                      <th className="py-2.5 px-3 text-amber-700 dark:text-amber-400">Late Entry</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium tabular-nums">
                    {studentAttendanceLogs.length > 0 ? (
                      (() => {
                        const monthMap: Record<string, { days: number; present: number; absent: number; late: number }> = {};
                        studentAttendanceLogs.forEach((l) => {
                          const mKey = l.date.slice(0, 7);
                          if (!monthMap[mKey]) monthMap[mKey] = { days: 0, present: 0, absent: 0, late: 0 };
                          monthMap[mKey].days++;
                          if (l.status === "present") monthMap[mKey].present++;
                          else if (l.status === "late") { monthMap[mKey].present++; monthMap[mKey].late++; }
                          else if (l.status === "absent") monthMap[mKey].absent++;
                        });
                        return Object.entries(monthMap).map(([mKey, s], mIdx) => {
                          let mDisplay = mKey;
                          const d = new Date(`${mKey}-01T00:00:00`);
                          if (!isNaN(d.getTime())) {
                            mDisplay = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                          }
                          const pct = s.days > 0 ? `${Math.round((s.present / s.days) * 100)}%` : "100%";
                          return (
                            <tr key={`month-attd-${mKey}-${mIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{mDisplay}</td>
                              <td className="py-2.5 px-3">{s.days}</td>
                              <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{s.present}</td>
                              <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400">{s.absent}</td>
                              <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">{s.late}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{pct}</td>
                            </tr>
                          );
                        });
                      })()
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          <Calendar className="w-7 h-7 text-emerald-500/60 mx-auto mb-2" />
                          <p className="font-bold text-slate-900 dark:text-white text-sm">New Student Admission • Attendance Tracking Active</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Jaise hi attendance register me haziri lagegi ya QR scan hoga, yahan mahinawaar attendance update ho jayegi.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parent Digital Leave Application Section */}
            <div className="pt-2">
              <ParentLeaveManager
                school={school}
                mode="PARENT_STUDENT"
                currentStudent={activeStudent}
              />
            </div>
          </div>
        )}

        {/* TAB 3: FEES & RECEIPTS ─────────────────────────────────────────── */}
        {activeTab === "fees" && (() => {
          // Separate active fees from pre-admission months
          const activeFeesList = allStudentFees.filter(
            (f: any) => !f.isPreAdmission && f.status !== "pre_admission"
          );
          const preAdmissionFeesList = allStudentFees.filter(
            (f: any) => f.isPreAdmission || f.status === "pre_admission"
          );
          const displayedFees = showPreAdmissionMonths
            ? [...activeFeesList, ...preAdmissionFeesList]
            : activeFeesList;

          return (
            <div className="space-y-4 sm:space-y-5">
              {/* Executive 3-Column KPI Summary Ribbon */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                      कुल देय (Billed)
                    </span>
                    <span className="text-base sm:text-2xl font-black text-white font-mono tabular-nums mt-0.5 sm:mt-1 block">
                      ₹{feeSummary.totalBilled.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium block truncate">
                      Session {getDynamicAcademicSessionLabel()}
                    </span>
                  </div>
                  <div className="hidden sm:flex w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 items-center justify-center text-slate-300 shrink-0">
                    <CreditCard className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>

                <div className="p-3 sm:p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 shadow-sm flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 uppercase tracking-wider block truncate">
                      कुल जमा (Paid)
                    </span>
                    <span className="text-base sm:text-2xl font-black text-emerald-400 font-mono tabular-nums mt-0.5 sm:mt-1 block">
                      ₹{feeSummary.totalDeposited.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-emerald-500/80 font-medium block truncate">
                      सफलतापूर्वक प्राप्त
                    </span>
                  </div>
                  <div className="hidden sm:flex w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>

                <div className={`p-3 sm:p-4 rounded-2xl border shadow-sm flex items-center justify-between ${
                  feeSummary.totalRemaining === 0
                    ? "bg-emerald-950/20 border-emerald-500/25"
                    : "bg-amber-950/20 border-amber-500/25"
                }`}>
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 uppercase tracking-wider block truncate">
                      शेष बकाया (Due)
                    </span>
                    <span className={`text-base sm:text-2xl font-black font-mono tabular-nums mt-0.5 sm:mt-1 block ${
                      feeSummary.totalRemaining === 0 ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {feeSummary.totalRemaining === 0 ? "₹0" : `₹${feeSummary.totalRemaining.toLocaleString("en-IN")}`}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium block truncate">
                      {feeSummary.totalRemaining === 0 ? "पूर्ण चुकता" : "लंबित देय राशि"}
                    </span>
                  </div>
                  <div className={`hidden sm:flex w-10 h-10 rounded-xl border items-center justify-center shrink-0 ${
                    feeSummary.totalRemaining === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {pendingDues > 0 && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-xs font-extrabold text-white">
                        School Fee Desk ko Quick Promise Reply bhejein
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 tabular-nums">
                      Due: ₹{pendingDues.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "TOMORROW", label: "Kal jama kar dunga" },
                      { id: "IN_3_DAYS", label: "3 din me" },
                      { id: "CUSTOM", label: "Custom Date" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQuickPromisePreset(opt.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                          quickPromisePreset === opt.id
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {quickPromisePreset === "CUSTOM" && (
                    <input
                      type="date"
                      value={quickPromiseCustomDate}
                      min={todayStr()}
                      onChange={(e) => setQuickPromiseCustomDate(e.target.value)}
                      className="w-full sm:w-56 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                    />
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={quickPromiseNote}
                      onChange={(e) => setQuickPromiseNote(e.target.value)}
                      placeholder="Optional note (e.g. Salary aane par shaam ko denge)..."
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
                    />
                    <button
                      type="button"
                      disabled={sendingQuickPromise}
                      onClick={() => void handleSendParentQuickPromise()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {sendingQuickPromise ? "Sending..." : "Send Promise Date"}
                    </button>
                  </div>
                  {quickPromiseSentMsg && (
                    <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{quickPromiseSentMsg}</span>
                    </p>
                  )}
                </div>
              )}

              {/* School Info Header + View Toggle + Single A4 Passbook Button */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{schoolDisplayName}</span>
                      <span className="text-xs text-slate-400 font-normal hidden sm:inline">• छात्र शुल्क पासबुक</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      छात्र: <strong className="text-slate-200">{activeStudent.name}</strong> • रोल: <strong className="text-slate-200">{activeStudent.rollNo || "—"}</strong> • कक्षा: <strong className="text-slate-200">{formatClassLabel(studentClassLabel)}</strong>
                      {activeStudent.isSiblingMarked && (
                        <span className="ml-2 text-indigo-300 font-bold">• 👨‍👩‍👧‍👦 Sibling Account Linked</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                  {/* View Mode Toggle: Cards (Mobile-friendly) vs Table */}
                  <div className="inline-flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFeeViewMode("cards")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        feeViewMode === "cards"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>कार्ड दृश्य</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeeViewMode("table")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        feeViewMode === "table"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>तालिका दृश्य</span>
                    </button>
                  </div>

                  {/* Single Clean Consolidated A4 Passbook Print Button */}
                  <button
                    type="button"
                    onClick={() => setShowBulkFeeModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-indigo-950/40 active:scale-95 cursor-pointer"
                    title="सभी 12 महीनों का Fee Demand + Fee Receipt एक A4 शीट पर डाउनलोड व प्रिंट करें"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    <span>वार्षिक पासबुक A4</span>
                  </button>
                </div>
              </div>

              {/* Informative Pre-Admission Banner (Collapsible to eliminate empty '---' rows) */}
              {preAdmissionFeesList.length > 0 && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                    <span>
                      सत्र 2026-27: छात्र का नामांकन सत्र के दौरान हुआ। <strong className="text-slate-300">{preAdmissionFeesList.length} सत्र-पूर्व माह</strong> शुल्क मुक्त हैं।
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreAdmissionMonths(!showPreAdmissionMonths)}
                    className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 transition cursor-pointer flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{showPreAdmissionMonths ? "सत्र-पूर्व माह छुपाएं" : `सत्र-पूर्व माह देखें (${preAdmissionFeesList.length})`}</span>
                  </button>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────────── */}
              {/* MODE 1: MOBILE-FIRST ALL-IN-ONE CARD VIEW                       */}
              {/* Month name, Price, Status & Receipt/Slip are ALWAYS VISIBLE     */}
              {/* ────────────────────────────────────────────────────────────── */}
              {feeViewMode === "cards" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayedFees.map((f: any, idx: number) => {
                    const isPreAdmission = Boolean(f.isPreAdmission || f.status === "pre_admission");
                    const isUpcoming = !isPreAdmission && Boolean(f.isUpcoming || f.status === "upcoming");
                    const isPaid = !isPreAdmission && (typeof f.paid === "boolean" ? f.paid : f.status === "paid");
                    const isAdmissionFee =
                      f.feeType === "admission" ||
                      f.receiptCategory === "admission" ||
                      String(f.receiptNo || "").startsWith("ADM-");

                    const monthCode = f.month || "2026-04";
                    let monthDisplay = monthCode;
                    if (isAdmissionFee) {
                      monthDisplay = "प्रवेश शुल्क व किट (Admission & Kit)";
                    } else if (/^\d{4}-\d{2}$/.test(monthCode)) {
                      const d = new Date(`${monthCode}-01T00:00:00`);
                      if (!isNaN(d.getTime())) {
                        monthDisplay = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                      }
                    }

                    const billed = isPreAdmission
                      ? 0
                      : isAdmissionFee
                      ? Number(f.grossTotal ?? f.grossAmount ?? f.amount ?? f.paidAmount ?? studentMonthlyFee)
                      : Number(f.monthlyAmount ?? f.amount ?? studentMonthlyFee);

                    const paid = isPreAdmission
                      ? 0
                      : Number(f.paidAmount !== undefined ? f.paidAmount : (isPaid ? billed : 0));

                    const remaining = isPreAdmission || isUpcoming
                      ? 0
                      : Number(f.balanceDue !== undefined ? f.balanceDue : (isPaid ? 0 : Math.max(0, billed - paid)));

                    const isPartial = !isPreAdmission && !isPaid && !isUpcoming && paid > 0 && remaining > 0;
                    const rNo = isPreAdmission ? "—" : (isPaid || paid > 0 ? (f.receiptNo || `DPS-26-${String(idx + 1).padStart(4, "0")}`) : "—");
                    const dtInfo = formatPaymentDateTime(f.paidDate || f.paymentDate);

                    return (
                      <div
                        key={`f-card-${f.id || f.receiptNo || monthCode || "mo"}-${idx}`}
                        className={`p-4 rounded-2xl border transition shadow-sm flex flex-col justify-between ${
                          isAdmissionFee
                            ? "bg-gradient-to-br from-emerald-950/40 via-slate-900 to-indigo-950/40 border-emerald-500/35"
                            : isPreAdmission
                            ? "bg-slate-900/40 border-slate-800 opacity-70"
                            : isPaid
                            ? "bg-slate-900/95 border-emerald-500/30 hover:border-emerald-500/50"
                            : isPartial
                            ? "bg-slate-900/95 border-amber-500/35 hover:border-amber-500/55"
                            : isUpcoming
                            ? "bg-slate-900/60 border-slate-800"
                            : "bg-slate-900/95 border-rose-500/35 hover:border-rose-500/55"
                        }`}
                      >
                        <div>
                          {/* Top Row: Month Name & Status Badge */}
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3 mb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isAdmissionFee
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : isPreAdmission
                                  ? "bg-slate-800 text-slate-500"
                                  : isPaid
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : isPartial
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : isUpcoming
                                  ? "bg-slate-800 text-slate-400"
                                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              }`}>
                                {isAdmissionFee ? (
                                  <Sparkles className="w-4 h-4" />
                                ) : isPaid ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : isPartial ? (
                                  <Clock className="w-4 h-4" />
                                ) : isUpcoming ? (
                                  <Calendar className="w-4 h-4" />
                                ) : isPreAdmission ? (
                                  <span className="text-xs font-mono font-bold">N/A</span>
                                ) : (
                                  <AlertTriangle className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white flex items-center gap-1.5 leading-tight truncate">
                                  <span>{monthDisplay}</span>
                                </h4>
                                <span className="text-[11px] text-slate-400 font-mono block mt-0.5 truncate">
                                  {isAdmissionFee ? (
                                    <span className="text-emerald-400 font-semibold">{f.receiptNo || "ADM-DOSSIER"}</span>
                                  ) : isPreAdmission ? (
                                    "सत्र-पूर्व अवधि (शुल्क लागू नहीं)"
                                  ) : isPaid && rNo !== "—" ? (
                                    <span>रसीद: <strong className="text-slate-300">{rNo}</strong></span>
                                  ) : isUpcoming ? (
                                    "आगामी सत्र माह"
                                  ) : (
                                    <span className="text-rose-400/90 font-medium">माह शुल्क देय (Pending)</span>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="shrink-0">
                              {isPreAdmission ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                  सत्र पूर्व
                                </span>
                              ) : isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>पूर्ण जमा</span>
                                </span>
                              ) : isPartial ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/35">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>आंशिक</span>
                                </span>
                              ) : isUpcoming ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                  आगामी
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/35">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>बकाया</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3 Price Columns - GUARANTEED VISIBLE TOGETHER AT ALL TIMES */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 mb-3 text-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                कुल देय (Billed)
                              </span>
                              <span className="text-sm font-black text-slate-200 font-mono tabular-nums mt-0.5 block">
                                {isPreAdmission ? "—" : `₹${billed.toLocaleString("en-IN")}`}
                              </span>
                            </div>
                            <div className="border-x border-slate-800/80">
                              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                                जमा (Paid)
                              </span>
                              <span className="text-sm font-black text-emerald-400 font-mono tabular-nums mt-0.5 block">
                                {isPreAdmission ? "—" : `₹${paid.toLocaleString("en-IN")}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                                शेष (Due)
                              </span>
                              <span className={`text-sm font-black font-mono tabular-nums mt-0.5 block ${
                                remaining > 0 ? "text-amber-400" : "text-slate-500"
                              }`}>
                                {isPreAdmission || isUpcoming ? "—" : remaining > 0 ? `₹${remaining.toLocaleString("en-IN")}` : "₹0"}
                              </span>
                            </div>
                          </div>

                          {/* Payment Timestamp Details */}
                          {(isPaid || paid > 0) && dtInfo.date !== "—" && (
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 px-1">
                              <div className="flex items-center gap-1.5 font-medium">
                                <Clock className="w-3 h-3 text-emerald-400" />
                                <span>जमा: <strong className="text-slate-200">{dtInfo.date}</strong> {dtInfo.time && `(${dtInfo.time})`}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {f.payModeInfo?.payMode || f.paymentMode || "Cash / Counter"}
                              </span>
                            </div>
                          )}

                          {/* Advance Paid / Next Slip / Partial Due / Family Note */}
                          {((Array.isArray(f.advanceCoveredMonths) && f.advanceCoveredMonths.length > 0) || isPartial || f.familyReceiptNo) && (
                            <div className="text-[11px] mb-2.5 px-2.5 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800/80 space-y-0.5">
                              {Array.isArray(f.advanceCoveredMonths) && f.advanceCoveredMonths.length > 0 && (
                                <p className="text-emerald-300 font-bold">
                                  ✓ {formatCoveredMonthsList(f.advanceCoveredMonths)} Paid
                                  {f.advancePaidAt ? ` at ${formatCompactDayMonth(f.advancePaidAt)}` : ""}
                                  {f.nextFeeSlipMonth ? ` · अगली स्लिप: ${formatMonthNameOnly(f.nextFeeSlipMonth)}` : ""}
                                </p>
                              )}
                              {isPartial && remaining > 0 && (
                                <p className="text-amber-300 font-bold">
                                  ⚠ आंशिक बकाया ₹{remaining.toLocaleString("en-IN")} (अगले माह में जुड़कर आएगा)
                                </p>
                              )}
                              {f.familyReceiptNo && (
                                <p className="text-indigo-300 font-medium text-[10px]">
                                  👨‍👩‍👧‍👦 Combined Sibling Receipt: {f.familyReceiptNo}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Direct Action Buttons: Always in the card, never scrolled out */}
                        <div className="pt-2 border-t border-slate-800/70">
                          {isPreAdmission ? (
                            <div className="text-center py-1 text-slate-600 text-xs font-medium">
                              सत्र-पूर्व माह • कोई दस्तावेज आवश्यक नहीं
                            </div>
                          ) : isAdmissionFee ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedAdmissionModal({ isOpen: true, mode: "receipt_only", feeRecord: f })}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                                title="प्रवेश शुल्क रसीद देखें व प्रिंट करें"
                              >
                                <ReceiptText className="w-3.5 h-3.5" />
                                <span>प्रवेश रसीद</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedAdmissionModal({ isOpen: true, mode: "form_only", feeRecord: f })}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                                title="नामांकन फॉर्म विवरण देखें"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>फॉर्म विवरण</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadStudentPdf(f)}
                                disabled={downloadingFeeId === (f.id || f.month)}
                                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                                title="आधिकारिक PDF डाउनलोड करें"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>PDF</span>
                              </button>
                            </div>
                          ) : isPaid ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setFeeModalFormat("pos");
                                  setSelectedFeeForReceipt(f);
                                }}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                                title="3-इंच (80mm) थर्मल फीस रसीद देखें"
                              >
                                <ReceiptText className="w-3.5 h-3.5" />
                                <span>रसीद (Receipt)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFeeModalFormat("a6");
                                  setSelectedFeeForReceipt(f);
                                }}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                                title="A6 फीस स्लिप देखें"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>फीस स्लिप</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadStudentPdf(f)}
                                disabled={downloadingFeeId === (f.id || f.month)}
                                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                                title="PDF डाउनलोड करें"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>PDF</span>
                              </button>
                            </div>
                          ) : isUpcoming ? (
                            <div className="w-full text-center py-1 text-slate-500 text-xs italic">
                              सत्र अनुसार आगामी माह (अभी देय नहीं)
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {razorpayConfig?.enabled && remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handlePayFeeViaRazorpay(f, remaining, monthDisplay)}
                                  disabled={payingFeeKey === (f.id || f.month)}
                                  className="flex-1 min-w-[120px] py-2 px-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm disabled:opacity-50"
                                  title="Razorpay UPI / Card se turant online fee jama karein"
                                >
                                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                                  <span>
                                    {payingFeeKey === (f.id || f.month)
                                      ? "Opening..."
                                      : `Pay ₹${remaining.toLocaleString("en-IN")}`}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setFeeModalFormat("a6");
                                  setSelectedFeeForReceipt(f);
                                }}
                                className="flex-1 py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                                title="आधिकारिक फीस मांग पर्ची (Demand Slip) देखें"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-950" />
                                <span>फीस मांग पर्ची (Slip)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadStudentPdf(f)}
                                disabled={downloadingFeeId === (f.id || f.month)}
                                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                                title="मांग पर्ची PDF डाउनलोड करें"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>PDF स्लिप</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────────── */}
              {/* MODE 2: TABLE VIEW WITH STICKY MONTH COLUMN                    */}
              {/* When scrolling horizontally, Month column NEVER disappears     */}
              {/* ────────────────────────────────────────────────────────────── */}
              {feeViewMode === "table" && (
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto relative">
                    <table className="w-full text-xs text-left text-slate-300 border-collapse">
                      <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] font-bold">
                        <tr>
                          {/* Sticky first column so month name NEVER hides */}
                          <th className="py-3 px-3.5 sticky left-0 z-20 bg-slate-800/95 backdrop-blur-md shadow-[2px_0_5px_rgba(0,0,0,0.5)] border-r border-slate-700">
                            विवरण / माह
                          </th>
                          <th className="py-3 px-3">जमा तिथि व समय</th>
                          <th className="py-3 px-3">रसीद सं.</th>
                          <th className="py-3 px-3 text-right">कुल देय (Billed)</th>
                          <th className="py-3 px-3 text-right">जमा (Paid)</th>
                          <th className="py-3 px-3 text-right">शेष (Due)</th>
                          <th className="py-3 px-3 text-center">स्थिति</th>
                          <th className="py-3 px-3 text-right">आधिकारिक दस्तावेज</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {displayedFees.map((f: any, idx: number) => {
                          const isPreAdmission = Boolean(f.isPreAdmission || f.status === "pre_admission");
                          const isUpcoming = !isPreAdmission && Boolean(f.isUpcoming || f.status === "upcoming");
                          const isPaid = !isPreAdmission && (typeof f.paid === "boolean" ? f.paid : f.status === "paid");
                          const isAdmissionFee =
                            f.feeType === "admission" ||
                            f.receiptCategory === "admission" ||
                            String(f.receiptNo || "").startsWith("ADM-");

                          const monthCode = f.month || "2026-04";
                          let monthDisplay = monthCode;
                          if (isAdmissionFee) {
                            monthDisplay = "प्रवेश शुल्क व किट (Admission & Kit)";
                          } else if (/^\d{4}-\d{2}$/.test(monthCode)) {
                            const d = new Date(`${monthCode}-01T00:00:00`);
                            if (!isNaN(d.getTime())) {
                              monthDisplay = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                            }
                          }

                          const billed = isPreAdmission
                            ? 0
                            : isAdmissionFee
                            ? Number(f.grossTotal ?? f.grossAmount ?? f.amount ?? f.paidAmount ?? studentMonthlyFee)
                            : Number(f.monthlyAmount ?? f.amount ?? studentMonthlyFee);

                          const paid = isPreAdmission
                            ? 0
                            : Number(f.paidAmount !== undefined ? f.paidAmount : (isPaid ? billed : 0));

                          const remaining = isPreAdmission || isUpcoming
                            ? 0
                            : Number(f.balanceDue !== undefined ? f.balanceDue : (isPaid ? 0 : Math.max(0, billed - paid)));

                          const isPartial = !isPreAdmission && !isPaid && !isUpcoming && paid > 0 && remaining > 0;
                          const rNo = isPreAdmission ? "—" : (isPaid || paid > 0 ? (f.receiptNo || `DPS-26-${String(idx + 1).padStart(4, "0")}`) : "—");
                          const dtInfo = formatPaymentDateTime(f.paidDate || f.paymentDate);

                          return (
                            <tr key={`f-row-${f.id || f.receiptNo || monthCode || "mo"}-${idx}`} className="hover:bg-slate-800/40 transition">
                              {/* Sticky Month Name Column */}
                              <td className="py-3 px-3.5 sticky left-0 z-10 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.5)] border-r border-slate-800 min-w-[150px]">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  {isAdmissionFee && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                  <span>{monthDisplay}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono block">
                                  {isPreAdmission
                                    ? "सत्र पूर्व (लागू नहीं)"
                                    : isUpcoming
                                    ? "आगामी माह"
                                    : (f.payModeInfo?.payMode || f.paymentMode || (isPaid ? "Cash / Counter" : "Fee Counter"))}
                                </span>
                                {Array.isArray(f.advanceCoveredMonths) && f.advanceCoveredMonths.length > 0 && (
                                  <span className="text-[10px] text-emerald-400 font-bold block">
                                    Adv: {formatCoveredMonthsList(f.advanceCoveredMonths)}
                                    {f.nextFeeSlipMonth ? ` · Next: ${formatMonthNameOnly(f.nextFeeSlipMonth)}` : ""}
                                  </span>
                                )}
                                {isPartial && remaining > 0 && (
                                  <span className="text-[10px] text-amber-400 font-bold block">
                                    आंशिक ₹{remaining.toLocaleString("en-IN")} (अगले माह)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                {isPreAdmission ? (
                                  <span className="text-slate-600 font-mono">—</span>
                                ) : isPaid || paid > 0 ? (
                                  <div>
                                    <span className="font-medium text-slate-200 block">{dtInfo.date}</span>
                                    {dtInfo.time ? (
                                      <span className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" /> {dtInfo.time}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 font-mono">Official Hours</span>
                                    )}
                                  </div>
                                ) : isUpcoming ? (
                                  <span className="text-slate-500 italic">आगामी माह</span>
                                ) : (
                                  <span className="text-slate-500 italic">देय (Unpaid)</span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-400 font-bold whitespace-nowrap">{rNo}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-300 tabular-nums whitespace-nowrap">
                                {isPreAdmission ? "—" : `₹${billed.toLocaleString("en-IN")}`}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 tabular-nums whitespace-nowrap">
                                {isPreAdmission ? "—" : `₹${paid.toLocaleString("en-IN")}`}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-black tabular-nums whitespace-nowrap">
                                <span className={remaining > 0 ? "text-amber-400" : "text-slate-500"}>
                                  {isPreAdmission || isUpcoming ? "—" : `₹${remaining.toLocaleString("en-IN")}`}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {isPreAdmission ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                    सत्र पूर्व
                                  </span>
                                ) : isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> पूर्ण जमा
                                  </span>
                                ) : isPartial ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <Clock className="w-2.5 h-2.5" /> आंशिक
                                  </span>
                                ) : isUpcoming ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                    आगामी
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    बकाया
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                {isPreAdmission ? (
                                  <span className="text-[11px] text-slate-600 font-medium">लागू नहीं</span>
                                ) : isAdmissionFee ? (
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAdmissionModal({ isOpen: true, mode: "receipt_only", feeRecord: f })}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="प्रवेश शुल्क रसीद देखें व प्रिंट करें"
                                    >
                                      <ReceiptText className="w-3 h-3 text-emerald-400" />
                                      <span>प्रवेश रसीद</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAdmissionModal({ isOpen: true, mode: "form_only", feeRecord: f })}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="छात्र नामांकन फॉर्म व विवरण देखें"
                                    >
                                      <FileText className="w-3 h-3 text-indigo-400" />
                                      <span>फॉर्म विवरण</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadStudentPdf(f)}
                                      disabled={downloadingFeeId === (f.id || f.month)}
                                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                      title="Download Official PDF Document"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>PDF</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {isPaid ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFeeModalFormat("pos");
                                            setSelectedFeeForReceipt(f);
                                          }}
                                          className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                          title="3-इंच (80mm) थर्मल फीस रसीद देखें"
                                        >
                                          <ReceiptText className="w-3 h-3 text-emerald-400" />
                                          <span>रसीद</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFeeModalFormat("a6");
                                            setSelectedFeeForReceipt(f);
                                          }}
                                          className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                          title="A6 फीस डिमांड स्लिप (मांग पर्ची) देखें"
                                        >
                                          <FileText className="w-3 h-3 text-blue-400" />
                                          <span>स्लिप</span>
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        {razorpayConfig?.enabled && remaining > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handlePayFeeViaRazorpay(f, remaining, monthDisplay)}
                                            disabled={payingFeeKey === (f.id || f.month)}
                                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                            title="Razorpay Online Fee Payment"
                                          >
                                            <Zap className="w-3 h-3 text-amber-300" />
                                            <span>Pay ₹{remaining.toLocaleString("en-IN")}</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFeeModalFormat("a6");
                                            setSelectedFeeForReceipt(f);
                                          }}
                                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/40 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                          title="आधिकारिक फीस डिमांड स्लिप देखें (कुल बकाया राशि सहित)"
                                        >
                                          <FileText className="w-3 h-3 text-amber-400" />
                                          <span>मांग पर्ची</span>
                                        </button>
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDownloadStudentPdf(f)}
                                      disabled={downloadingFeeId === (f.id || f.month)}
                                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-xs"
                                      title="Download Official PDF Document"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>PDF</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 4: EXAMS & REPORT CARD ──────────────────────────────────────── */}
        {activeTab === "exams" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  Examination Performance &amp; Marksheets (Session {getDynamicAcademicSessionLabel()})
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  6-Stage Examination System: PA-1 (40), PA-2 (40), Half Yearly (100), PA-3 (40), PA-4 (40), Annual Exam (100)
                </p>
              </div>

              <button
                onClick={async () => {
                  const mEl = document.getElementById("student-marksheet-card-section");
                  if (!mEl) return;
                  try {
                    const html2canvas = (await import("html2canvas")).default;
                    const canvas = await html2canvas(mEl, { scale: 2, useCORS: true, backgroundColor: "#0f172a" });
                    const a = document.createElement("a");
                    a.download = `Marksheet_${selectedExamCycle}_${(activeStudent.name || "Student").replace(/\s+/g, "_")}.png`;
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                  } catch (e) {
                    console.warn("Marksheet download error:", e);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Marksheet
              </button>
            </div>

            {/* Exam Cycle Selector Chips */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {examCycles.map((cycle) => (
                <button
                  key={cycle.id}
                  onClick={() => setSelectedExamCycle(cycle.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition ${
                    selectedExamCycle === cycle.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {cycle.name}
                </button>
              ))}
            </div>

            {/* Subject-Wise Marks Table for Selected Exam */}
            {(() => {
              const currentCycle = examCycles.find((c) => c.id === selectedExamCycle) || examCycles[0];
              return (
                <div id="student-marksheet-card-section" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-base font-black text-white">{currentCycle.name} Result Card</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatClassLabel(studentClassLabel)} • Roll #{activeStudent.rollNo} • Admission: {activeStudent.admissionNo}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Total:</span>
                      <span className="text-lg font-black text-indigo-400">
                        {currentCycle.hasMarks ? `${currentCycle.totalObtained} / ${currentCycle.totalMax} (${currentCycle.percentage}%)` : "Pending"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs">
                        {currentCycle.hasMarks ? `Grade ${currentCycle.grade}` : "Under Evaluation"}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2.5 px-3 rounded-l-lg">Subject Name</th>
                          <th className="py-2.5 px-3">Max Marks</th>
                          <th className="py-2.5 px-3 text-emerald-400">Marks Obtained</th>
                          <th className="py-2.5 px-3">Grade</th>
                          <th className="py-2.5 px-3 text-right rounded-r-lg">Teacher Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {currentCycle.hasMarks && currentCycle.records.length > 0 ? (
                          currentCycle.records.map((row: any) => {
                            const subName = row.subjectName || row.name || "Subject";
                            const max = row.maxMarks || (selectedExamCycle.includes("PA") ? 40 : 100);
                            const obt = row.marksObtained;
                            const pct = max > 0 ? (obt / max) * 100 : 0;
                            const grade = pct >= 90 ? "A1" : pct >= 80 ? "A2" : pct >= 70 ? "B1" : pct >= 60 ? "B2" : "C";
                            return (
                              <tr key={subName} className="hover:bg-slate-800/40">
                                <td className="py-3 px-3 font-bold text-white">{subName}</td>
                                <td className="py-3 px-3 font-mono">{max}</td>
                                <td className="py-3 px-3 font-black text-emerald-400 text-sm">{obt}</td>
                                <td className="py-3 px-3 font-bold text-indigo-400">{grade}</td>
                                <td className="py-3 px-3 text-right text-slate-400">{pct >= 85 ? "Excellent Performance" : pct >= 70 ? "Good Performance" : "Satisfactory"}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-slate-400">
                              <Award className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
                              <p className="font-bold text-white text-sm">Abhi is pariksha ke marks teacher dwaara upload nahi kiye gaye hain</p>
                              <p className="text-xs text-slate-500 mt-1">
                                Jaise hi subject teachers answer sheet evaluate karke marks submit karenge, yahan official marksheet generate ho jayegi.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 5: HOMEWORK & DAILY TEACHING DIARY (AAJ KYA PADHAYA GAYA) ────── */}
        {activeTab === "homework" && (
          <div className="space-y-5">
            <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              studentTheme === "white"
                ? "bg-white border-slate-200 text-slate-900"
                : "bg-slate-900 border-slate-800 text-white"
            }`}>
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  <span>Daily Teaching Diary &amp; Homework (Aaj Kya Padhaya Gaya)</span>
                </h3>
                <p className={`text-xs mt-1 ${
                  studentTheme === "white" ? "text-slate-500" : "text-slate-400"
                }`}>
                  {formatClassLabel(selectedClassLevel)} me har din kaunse topics padhaye gaye aur koi homework ho toh yahan dikhega. Notes pics dekhne ke liye Class Work kholein.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setClassworkDateFilter("ALL");
                  setClassworkSubjectFilter("ALL");
                  setAdvanceTab("classwork");
                  setActiveTab("advance");
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Class Work Notes &amp; Pics →</span>
              </button>
            </div>

            {homeworkList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {homeworkList.map((hw) => {
                  const isDone = homeworkStatusMap[hw.id] === "completed";
                  return (
                    <div
                      key={hw.id}
                      className={`p-5 rounded-2xl border transition-all space-y-3 ${
                        studentTheme === "white"
                          ? isDone
                            ? "bg-slate-50 border-slate-200 opacity-85"
                            : "bg-white border-slate-200 hover:border-indigo-300 shadow-xs"
                          : isDone
                          ? "bg-slate-900/60 border-slate-800/80 opacity-80"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25">
                          {hw.subject}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isDone
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        }`}>
                          {hw.dueDate}
                        </span>
                      </div>

                      <h4 className={`text-sm font-black ${
                        studentTheme === "white" ? "text-slate-900" : "text-white"
                      } ${isDone ? "line-through opacity-70" : ""}`}>
                        {hw.title}
                      </h4>

                      {hw.topics && hw.topics.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            Topics Taught:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {hw.topics.map((tp, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-bold"
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>{tp}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {hw.homeworkText ? (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200">
                          <span className="font-black">📝 Homework: </span>
                          <span>{hw.homeworkText}</span>
                        </div>
                      ) : hw.description ? (
                        <p className={`text-xs leading-relaxed ${
                          studentTheme === "white" ? "text-slate-600" : "text-slate-400"
                        }`}>
                          {hw.description}
                        </p>
                      ) : null}

                      <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
                        studentTheme === "white" ? "border-slate-200" : "border-slate-800"
                      }`}>
                        <span className="text-[11px] text-slate-500">{hw.assignedBy}</span>
                        <div className="flex items-center gap-2">
                          {hw.isTeachingLog && (
                            <button
                              type="button"
                              onClick={() => {
                                setClassworkDateFilter(hw.date || "ALL");
                                setClassworkSubjectFilter("ALL");
                                setAdvanceTab("classwork");
                                setActiveTab("advance");
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 text-xs font-black cursor-pointer"
                            >
                              📸 Notes &amp; Pics {hw.picsCount > 0 ? `(${hw.picsCount})` : ""}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleHomeworkStatus(hw.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                              isDone
                                ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/25"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isDone ? "Completed ✓" : "Mark as Done"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`p-8 rounded-2xl border text-center ${
                studentTheme === "white"
                  ? "bg-white border-slate-200 text-slate-900"
                  : "bg-slate-900 border-slate-800 text-white"
              }`}>
                <FileText className="w-8 h-8 text-amber-400/60 mx-auto mb-2" />
                <p className="text-sm font-bold">Abhi {formatClassLabel(selectedClassLevel)} ke liye koi daily update darj nahi hai</p>
                <p className="text-xs text-slate-400 mt-1">
                  Jaise hi Teacher apne period me Topics aur Class Notes upload karenge, yahan turant sync ho jayega.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: SCHOOL HOLIDAYS HUB ────────────────────────────────────────── */}
        {activeTab === "holidays" && (() => {
          const parsedHolidays = holidaysList.map((h, idx) => ({
            ...h,
            key: h.id || `hol_${idx}`,
          }));

          const filteredHols = parsedHolidays.filter((h) => {
            if (holidaysSearch) {
              const q = holidaysSearch.toLowerCase();
              return h.name?.toLowerCase().includes(q) || h.date?.toLowerCase().includes(q) || h.days?.toLowerCase().includes(q);
            }
            if (holidaysFilter === "FESTIVAL") return h.type === "festival" || h.name.includes("पूजा") || h.name.includes("दिवाली") || h.name.includes("होली");
            if (holidaysFilter === "NATIONAL") return h.type === "national" || h.name.includes("दिवस") || h.name.includes("Jayanti");
            if (holidaysFilter === "VACATION") return h.type === "vacation" || h.days?.toLowerCase().includes("vacation") || h.days?.toLowerCase().includes("break");
            return true;
          });

          const nextHoliday = parsedHolidays[0];

          return (
            <div className="space-y-6">


              {/* Search & Category Filter Pills */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: "ALL", label: `All Holidays (${holidaysList.length})` },
                    { id: "FESTIVAL", label: "Festivals (त्यौहार)" },
                    { id: "NATIONAL", label: "National (राष्ट्रीय)" },
                    { id: "VACATION", label: "Vacations (अवकाश)" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setHolidaysFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                        holidaysFilter === f.id
                          ? "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={holidaysSearch}
                    onChange={(e) => setHolidaysSearch(e.target.value)}
                    placeholder="Search holiday or date..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
              </div>

              {/* Holidays Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredHols.map((h, i) => {
                  const isFestival = h.type === "festival" || h.name.includes("पूजा") || h.name.includes("दिवाली") || h.name.includes("होली");
                  const isNational = h.type === "national" || h.name.includes("दिवस") || h.name.includes("Jayanti");
                  const isVacation = h.type === "vacation" || h.days?.toLowerCase().includes("vacation") || h.days?.toLowerCase().includes("break");
                  
                  return (
                    <div
                      key={h.key || i}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-start gap-3.5 group shadow-sm hover:shadow-md"
                    >
                      {/* Date Badge */}
                      <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border text-center font-bold ${
                        isFestival
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : isNational
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : isVacation
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      }`}>
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                          {h.date?.split(" ")[1] || "HOL"}
                        </span>
                        <span className="text-base font-black leading-none mt-0.5">
                          {h.date?.split(" ")[0]?.slice(0, 5) || (i + 1)}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isFestival
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : isNational
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : isVacation
                              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                          }`}>
                            {h.type || "Holiday"}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">{h.days}</span>
                        </div>

                        <h4 className="text-sm font-black text-white group-hover:text-rose-300 transition-colors">
                          {h.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{h.date}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Session Leave Statistics */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-around gap-4 text-center">
                <div>
                  <span className="text-xs text-slate-400">Total School Holidays</span>
                  <p className="text-lg font-black text-white mt-0.5">{holidaysList.length} दिन</p>
                </div>
                <div className="w-px h-8 bg-slate-800 hidden sm:block" />
                <div>
                  <span className="text-xs text-slate-400">Major Festival Leaves</span>
                  <p className="text-lg font-black text-amber-400 mt-0.5">दिवाली, छठ, होली, ईद</p>
                </div>
                <div className="w-px h-8 bg-slate-800 hidden sm:block" />
                <div>
                  <span className="text-xs text-slate-400">Summer &amp; Winter Vacation</span>
                  <p className="text-lg font-black text-blue-400 mt-0.5">ग्रीष्मकालीन व शीतकालीन</p>
                </div>
              </div>
            </div>
          );
        })()}





        {/* ── BACKWARD COMPATIBILITY: COMMUNITY / NOTICES TAB ────────────────── */}
        {(activeTab === "community" || activeTab === "notices") && (
          <SchoolCommunityFeed
            schoolId={schoolId}
            schoolName={schoolDisplayName}
            currentUserId={activeStudent.id || effectiveUid}
            currentUserName={activeStudent.name}
            currentUserRole="STUDENT"
            studentClassId={activeStudent.classId}
            studentClassName={formatClassLabel(studentClassLabel)}
            initialFilter={communityInitialFilter}
          />
        )}

        {/* TAB 7: DIGITAL ID CARD ──────────────────────────────────────────── */}
        {activeTab === "idcard" && (
          <div className="space-y-6">
              {/* Back button on Digital ID Card */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    studentTheme === "white"
                      ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                      : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Profile</span>
                </button>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-400" />
                  Official Student Digital ID Card
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  CR80 landscape standard identity card with verified QR security token
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    const card = document.getElementById("student-id-card-cr80-element");
                    if (!card) return;
                    const tId = toast.loading("Student ID Card PDF taiyar ho raha hai...");
                    try {
                      const { exportElementToPdf } = await import("../../utils/universalPdfExport");
                      await exportElementToPdf(card, {
                        filename: `Student_ID_Card_${activeStudent.name || "Student"}_${activeStudent.admissionNo || ""}`,
                        format: "cr80",
                        orientation: "landscape",
                        widthPx: 360,
                        scale: 4,
                      });
                      toast.success("ID Card PDF download ho gaya!", { id: tId });
                    } catch (e) {
                      console.warn("ID Card PDF error:", e);
                      toast.error("PDF download nahi ho paya, Print option try karein.", { id: tId });
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const card = document.getElementById("student-id-card-cr80-element");
                    if (!card) return;
                    const { printElementInIframe } = await import("./AdmissionFormPrintModal");
                    printElementInIframe(card, `ID Card - ${activeStudent.name || "Student"}`, "", "landscape");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Card</span>
                </button>
              </div>
            </div>

            {/* Rendered CR80 Card */}
            <div className="flex justify-center p-4 sm:p-8 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div
                id="student-id-card-cr80-element"
                className="w-[360px] min-h-[225px] bg-white text-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-600 flex flex-col overflow-hidden relative"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-3 py-2 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    {resolvedSchoolLogo && !isAppLogo(resolvedSchoolLogo) ? (
                      <img src={resolvedSchoolLogo} alt="Logo" className="w-6 h-6 rounded-full bg-white object-contain p-0.5" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white text-emerald-900 flex items-center justify-center font-black text-[9px]">
                        {schoolInitials}
                      </div>
                    )}
                    <div>
                      <h3 className="font-black text-[11px] leading-tight text-white">{schoolDisplayName}</h3>
                      <p className="text-[7px] text-emerald-200">{school?.tagline || school?.affiliation || "Affiliated School Campus"}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[7px] font-black uppercase tracking-wider">
                    STUDENT ID • 2026-27
                  </span>
                </div>

                {/* Body: QR on Left, Details Center, Photo Right */}
                <div className="p-3 flex items-center justify-between gap-2.5 bg-white flex-1">
                  {/* QR */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-[84px]">
                    <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-sm flex items-center justify-center">
                      <QRCode value={qrStudentPayload} size={72} level="L" />
                    </div>
                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-tight mt-1 flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" /> Verify QR
                    </span>
                    <span className="text-[6.5px] font-mono text-slate-500 font-bold">
                      {activeStudent.admissionNo}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 text-[9.5px] leading-tight space-y-0.5">
                    <h4 className="font-black text-xs text-slate-900 truncate">{activeStudent.name}</h4>
                    <p className="text-[8.5px] font-black text-emerald-700">{formatClassLabel(studentClassLabel)}</p>
                    <div className="pt-1 space-y-0.5 border-t border-slate-100 text-[8px] text-slate-700">
                      <p><strong>Roll:</strong> #{activeStudent.rollNo} • <strong>Adm:</strong> {activeStudent.admissionNo}</p>
                      <p><strong>Father:</strong> {maskSensitiveData ? maskSensitive2Chars(activeStudent.fatherName, true) : (activeStudent.fatherName || "—")}</p>
                      {activeStudent.motherName && <p><strong>Mother:</strong> {maskSensitiveData ? maskSensitive2Chars(activeStudent.motherName, true) : activeStudent.motherName}</p>}
                      <p><strong>Mobile:</strong> {maskSensitiveData ? maskSensitive2Chars(activeStudent.phone, true) : (activeStudent.phone || "—")}</p>
                      <p><strong>Blood:</strong> <span className="text-rose-700 font-bold">🩸 {activeStudent.bloodGroup || "O+"}</span>{activeStudent.dateOfBirth ? ` • DOB: ${activeStudent.dateOfBirth}` : ''}</p>
                      {activeStudent.address && <p><strong>Address:</strong> {activeStudent.address}</p>}
                    </div>
                  </div>

                  {/* Photo */}
                  <div className="shrink-0">
                    <div className="w-[68px] h-[80px] rounded-xl border border-slate-300 overflow-hidden shadow-sm bg-slate-100 flex items-center justify-center">
                      {activePhoto ? (
                        <img
                          src={activePhoto}
                          alt={activeStudent.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-emerald-700 via-teal-800 to-indigo-900 flex flex-col items-center justify-center text-white select-none">
                          <span className="text-sm font-black">{studentInitials}</span>
                          <span className="text-[6.5px] uppercase font-bold text-emerald-200 mt-0.5">STUDENT</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[7px] text-slate-500 shrink-0">
                  <span>Valid for Academic Session {getDynamicAcademicSessionLabel()}</span>
                  <span className="font-bold text-slate-800">Principal Signature ✓</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: OUR TEACHERS & FACULTY DIRECTORY ─────────────────────────── */}
        {activeTab === "teachers" && (
          <div className="space-y-5 animate-in fade-in">
            {/* Faculty Header Card */}
            <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        Our Esteemed Faculty (हमारे सम्मानीय शिक्षक)
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 tabular-nums">
                        {displayedFaculty.length} Educators
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      हमारे विद्यालय के सुयोग्य, अनुभवी एवं समर्पित मार्गदर्शकों का परिचय
                    </p>
                  </div>
                </div>

                {/* Privacy Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Privacy Protected • Teachers ke personal numbers private hain</span>
                </div>
              </div>

              {/* Search Bar & Routine Scope Toggle */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    placeholder="Search by teacher name, subject, or qualification..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                  {teacherSearch && (
                    <button
                      type="button"
                      onClick={() => setTeacherSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {routineTeachersSummary.hasRoutine && (
                    <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTeacherRosterScope("ROUTINE")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          teacherRosterScope === "ROUTINE"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        My Class Routine ({routineTeachersSummary.routineTeachers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeacherRosterScope("ALL")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          teacherRosterScope === "ALL"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        All Faculty ({schoolTeachers.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Teachers Cards Grid */}
            {schoolTeachers.length === 0 ? (
              <div className="text-center py-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-3 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  शिक्षक सूची अभी अपडेट की जा रही है (No Faculty Added Yet)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  जैसे ही स्कूल प्रशासन द्वारा शिक्षकों का प्रोफाइल और विषय विवरण दर्ज किया जाएगा, यहाँ सभी सम्मानीय शिक्षकों की सूची प्रदर्शित होगी।
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>स्कूल एडमिन पैनल से टीचर जोड़े जाने पर यहाँ लाइव दिखेगा</span>
                </div>
              </div>
            ) : displayedFaculty.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                <GraduationCap className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">Koi teacher match nahi hua</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  "{teacherSearch}" se match hone wala koi teacher nahi mila. Search query badalkar dekhein.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedFaculty.map((t, idx) => {
                  const subjectsList = Array.isArray(t.subjects)
                    ? t.subjects
                    : (typeof t.subjects === "string" ? t.subjects.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
                  return (
                    <div
                      key={t.id || `faculty-${t.name}-${idx}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/90 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-xs relative overflow-hidden group"
                    >
                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />

                      <div className="space-y-3.5">
                        {/* Header: Photo + Name + Designation */}
                        <div className="flex items-start gap-3.5">
                          {/* Portrait Photo */}
                          <div className="w-14 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shrink-0 flex items-center justify-center">
                            {t.photoUrl ? (
                              <img
                                src={t.photoUrl}
                                alt={t.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-indigo-600 flex flex-col items-center justify-center text-white select-none">
                                <span className="text-lg font-bold">{t.name ? t.name.charAt(0).toUpperCase() : "T"}</span>
                                <span className="text-[7px] font-bold text-indigo-100">FACULTY</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                {t.name}
                              </h3>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" title="Verified Faculty" />
                            </div>

                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                              {t.designation || "Senior Faculty Member"}
                            </p>

                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              {t.qualification && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  <span>{t.qualification}</span>
                                </span>
                              )}
                              {t.experience && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{t.experience}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Subjects Taught Badges */}
                        {subjectsList.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                              Subjects Taught (विषय):
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {subjectsList.map((sub: string, sIdx: number) => (
                                <span
                                  key={`t-sub-${t.id}-${sIdx}`}
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  {sub}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bio / Teacher Quote */}
                        {t.bio && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 italic relative">
                            <span className="text-blue-600 dark:text-blue-400 font-serif font-bold mr-1 text-sm">“</span>
                            {t.bio}
                            <span className="text-blue-600 dark:text-blue-400 font-serif font-bold ml-1 text-sm">”</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Direct Routine Teacher Chat Button (No Class-Teacher-Only Limit) */}
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/70 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 min-w-0 truncate">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">
                            {(t as any)._isClassTeacher
                              ? "Class Teacher"
                              : Array.isArray((t as any)._routineSubjects) && (t as any)._routineSubjects.length > 0
                              ? `Routine: ${(t as any)._routineSubjects.join(", ")}`
                              : "Academic Mentor"}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRequestedTeacherChatId(t.id);
                            setActiveTab("channel");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Baat Karein</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: STUDENT GROWTH, DIARY, SKILLS & AI LEARNING INSIGHTS ────────────── */}
        {activeTab === "growth_hub" && (
          <StudentGrowthAndPortfolioView
            schoolId={schoolId}
            student={activeStudent}
            studentExams={liveExams}
            attendanceStats={attendanceStats}
            homeworkCompletedCount={homeworkList.filter((h) => h.status === "completed").length}
            homeworkTotalCount={homeworkList.length}
            onBack={() => setActiveTab("overview")}
          />
        )}

        {/* TAB: HEALTH RECORD, AUTHORIZED PICKUP & PARENT HELPDESK ────────────── */}
        {activeTab === "health_safety" && (
          <StudentHealthAndSafetyView
            schoolId={schoolId}
            schoolName={schoolDisplayName}
            student={activeStudent}
            onBack={() => setActiveTab("overview")}
          />
        )}

        {/* TAB: ADVANCE LEARNING HUB (CLASS WORK | ACADEMIC CLASS | ONLINE TEST | QUESTION PAPER | LIBRARY) */}
        {activeTab === "advance" && (() => {
          const activeSessLabel =
            schoolSessions.find((s: any) => s?.id === (activeStudent?.sessionId || sessionId))?.name ||
            schoolSessions.find((s: any) => s?.isActive)?.name ||
            getDynamicAcademicSessionLabel();
          const lockedClassDisplay = formatClassLabel(selectedClassLevel);
          const classEmoji = classEmojis[selectedClassLevel] || "🎓";
          return (
            <div className="space-y-4 animate-in fade-in">
              {/* Advance Header Banner */}
              <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                studentTheme === "white"
                  ? "bg-white border-slate-200 text-slate-900"
                  : studentTheme === "black"
                  ? "bg-neutral-950 border-neutral-800 text-white"
                  : "bg-slate-900 border-slate-800 text-white"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                    {classEmoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black">
                        Advance Learning Hub
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                        {lockedClassDisplay} · Locked
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${
                      studentTheme === "white" ? "text-slate-500" : "text-slate-400"
                    }`}>
                      Class Work Notes, Academic Class, Online Test, Question Paper &amp; Daily Class Videos ({activeSessLabel})
                    </p>
                  </div>
                </div>
              </div>

              {/* 5-Tab Navigation Strip inside Advance */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "classwork" as const, label: "Class Work", icon: ImageIcon },
                  { id: "academic" as const, label: "Academic Class", icon: GraduationCap },
                  { id: "online_test" as const, label: "Online Test", icon: Users },
                  { id: "question_bank" as const, label: "Question Paper", icon: FileText },
                  { id: "videos" as const, label: "Class Videos", icon: Youtube },
                ].map((sub) => {
                  const SubIcon = sub.icon;
                  const active = advanceTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setAdvanceTab(sub.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition cursor-pointer border ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                          : studentTheme === "white"
                          ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <SubIcon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                      {sub.id === "online_test" && matchedClassOnlineRooms.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white animate-pulse">
                          {matchedClassOnlineRooms.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sub-tab 1: Class Work (Session-wide Date-wise Notes, Topics & Telegram Pics) */}
              {advanceTab === "classwork" && (
                <StudentDatewiseNotesView
                  schoolId={schoolId}
                  classId={activeStudent.classId}
                  className={studentClassLabel}
                  sessionLabel={activeSessLabel}
                  initialDateFilter={classworkDateFilter}
                  initialSubjectFilter={classworkSubjectFilter}
                  darkSurface={studentTheme !== "white"}
                />
              )}

              {/* Sub-tab 2: Academic Class (Strictly Locked to Student's Class — Nursery, LKG, UKG, 1-12) */}
              {advanceTab === "academic" && (
                <div className={`rounded-2xl p-5 border shadow-xs space-y-4 ${
                  studentTheme === "white"
                    ? "bg-white border-slate-200 text-slate-900"
                    : "bg-slate-900 border-slate-800 text-white"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          studentTheme === "white"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-indigo-500/15 text-indigo-300 border-indigo-500/35"
                        }`}>
                          {lockedClassDisplay} · School Academic Syllabus
                        </span>
                        {isSelectedBoardClass && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            <span>Board Class</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black">
                        {lockedClassDisplay}
                      </h3>
                      <p className={`text-xs mt-1 ${
                        studentTheme === "white" ? "text-slate-500" : "text-slate-400"
                      }`}>
                        {schoolDisplayName} — Aapki apni kaksha ke subjects, chapter notes, PDF, audio aur MCQs (Class switch locked).
                      </p>
                      <div className="flex items-center flex-wrap gap-2 mt-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                          studentTheme === "white"
                            ? "bg-slate-50 border-slate-200 text-slate-700"
                            : "bg-slate-800 border-slate-700 text-slate-200"
                        }`}>
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{schoolSubjectsCount} Subjects</span>
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                          studentTheme === "white"
                            ? "bg-slate-50 border-slate-200 text-slate-700"
                            : "bg-slate-800 border-slate-700 text-slate-200"
                        }`}>
                          <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{schoolLessonsCount} Lessons</span>
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                          studentTheme === "white"
                            ? "bg-slate-50 border-slate-200 text-slate-700"
                            : "bg-slate-800 border-slate-700 text-slate-200"
                        }`}>
                          <Zap className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{schoolMcqCount} MCQs</span>
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-2xl shrink-0">
                      {classEmoji}
                    </div>
                  </div>

                  {schoolLessonsCount === 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {lockedClassDisplay} ke chapter E-Notes teacher upload karne par yahan turant dikhenge.
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenClassSyllabus(selectedClassLevel)}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-[0.99]"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Open {lockedClassDisplay} Academic Syllabus &amp; Notes</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Sub-tab 3: Online Test (Embedded Inline — No 2nd Page Redirect) */}
              {advanceTab === "online_test" && (
                <LazyPanelBoundary title="Online Test">
                  <GroupStudyModal
                    isOpen={true}
                    embedded={true}
                    preferredTheme={studentTheme === "white" ? "white" : studentTheme === "black" ? "black" : "blue"}
                    onClose={() => setAdvanceTab("classwork")}
                    user={{
                      id: activeStudent.id,
                      uid: activeStudent.id,
                      name: activeStudent.name,
                      role: "STUDENT",
                      isSchoolHost: false,
                      schoolId: schoolId,
                      schoolName: schoolDisplayName,
                      classLevel: selectedClassLevel,
                      className: formatClassLabel(selectedClassLevel),
                      classId: activeStudent.classId,
                      subscriptionLevel: "ULTRA",
                    }}
                    tierTheme={{ primary: "#0d9488" }}
                    isSchoolHost={false}
                    schoolId={schoolId}
                    schoolName={schoolDisplayName}
                    studentClassLevel={selectedClassLevel}
                    studentClassLabel={formatClassLabel(selectedClassLevel)}
                    studentClassId={activeStudent.classId}
                  />
                </LazyPanelBoundary>
              )}

              {/* Sub-tab 4: Question Paper Library (Strictly Locked to Student's Class) */}
              {advanceTab === "question_bank" && (
                <LazyPanelBoundary title="Question Bank">
                  <StudentQuestionBankView
                    school={{
                      ...(school || {}),
                      id: schoolId,
                      name: schoolDisplayName,
                      logoUrl: resolvedSchoolLogo,
                    }}
                    studentClassLabel={studentClassLabel}
                    activeSessionLabel={activeSessLabel}
                    onBack={() => setAdvanceTab("classwork")}
                  />
                </LazyPanelBoundary>
              )}

              {/* Sub-tab 5: Daily Class Video Lectures (YouTube Archive moved from Attendance) */}
              {advanceTab === "videos" && activeStudent && (
                <div className="space-y-3">
                  <LazyPanelBoundary title="Classroom Videos">
                    <ClassroomVideoArchive
                      school={{
                        ...(school || {}),
                        id: schoolId,
                        name: schoolDisplayName,
                        logoUrl: resolvedSchoolLogo,
                        address: school?.address || "Institutional Academic Campus, Educational Zone",
                        affiliation: school?.affiliation || "Affiliated School Campus",
                        code: getVisibleSchoolRegNo(school),
                      } as any}
                      classes={classesList}
                      teachers={schoolTeachers}
                      currentUserRole="STUDENT"
                      studentClassId={activeStudent.classId}
                      studentClassName={studentClassLabel || activeStudent.className}
                      onBack={() => setAdvanceTab("classwork")}
                    />
                  </LazyPanelBoundary>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB: QUESTION BANK (PUBLISHED SESSION-WISE SCHOOL PAPERS — LEGACY DEEP LINK) ─────────── */}
        {activeTab === "question_bank" && (
          <LazyPanelBoundary title="Question Bank">
            <StudentQuestionBankView
              school={{
                ...(school || {}),
                id: schoolId,
                name: schoolDisplayName,
                logoUrl: resolvedSchoolLogo,
              }}
              studentClassLabel={studentClassLabel}
              activeSessionLabel={
                schoolSessions.find((s: any) => s?.id === (activeStudent?.sessionId || sessionId))?.name ||
                schoolSessions.find((s: any) => s?.isActive)?.name ||
                getDynamicAcademicSessionLabel()
              }
              onBack={() => setActiveTab("overview")}
            />
          </LazyPanelBoundary>
        )}

        {/* TAB: SCHOOL STORE & 24-HOUR ITEM BOOKING ──────────────────────────── */}
        {activeTab === "store" && (
          <div className="space-y-4 animate-in fade-in">
            <LazyPanelBoundary title="School Store">
              <StudentSchoolStore
                school={{
                  ...(school || {}),
                  id: schoolId,
                  name: schoolDisplayName,
                  logoUrl: resolvedSchoolLogo,
                } as any}
                student={activeStudent}
                onBack={() => setActiveTab("overview")}
              />
            </LazyPanelBoundary>
          </div>
        )}
        {/* TAB: DEDICATED STUDENT PROFILE, DOCUMENTS, TOOLS & ACCOUNT ────────── */}
        {activeTab === "profile" && (() => {
          const isWhite = studentTheme === "white";
          const isBlack = studentTheme === "black";
          const surfaceCard = isWhite
            ? "bg-white border-slate-200/90 text-slate-900 shadow-xs"
            : isBlack
            ? "bg-[#0b0b0b] border-neutral-800 text-white"
            : "bg-[#0e1f3d] border-[#1f3b6e] text-white";
          const subtleCell = isWhite
            ? "bg-slate-50/90 border-slate-200/80 text-slate-900"
            : isBlack
            ? "bg-neutral-900/75 border-neutral-800 text-white"
            : "bg-[#091630]/85 border-[#1c3563] text-white";
          const actionTile = isWhite
            ? "bg-slate-50/70 hover:bg-slate-100 border-slate-200/90 text-slate-900"
            : isBlack
            ? "bg-neutral-900/70 hover:bg-neutral-800/80 border-neutral-800 text-white"
            : "bg-[#091630]/80 hover:bg-[#12264d] border-[#1e3a6e] text-white";
          const dividerBorder = isWhite
            ? "border-slate-200/80"
            : isBlack
            ? "border-neutral-800"
            : "border-[#1d396b]";
          const mutedText = isWhite
            ? "text-slate-500"
            : isBlack
            ? "text-neutral-400"
            : "text-slate-300/80";

          return (
            <div className="space-y-4 animate-in fade-in">
              {/* 1. Executive Student Identity & Family Dossier */}
              <div className={`rounded-2xl border overflow-hidden ${surfaceCard}`}>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3.5 sm:gap-4">
                    {/* Portrait Avatar + Camera Upload */}
                    <div className="relative shrink-0">
                      {activePhoto ? (
                        <img
                          src={activePhoto}
                          alt={activeStudent.name}
                          className="w-[70px] h-[86px] sm:w-20 sm:h-24 rounded-xl object-cover border border-emerald-500/40"
                        />
                      ) : (
                        <div className={`w-[70px] h-[86px] sm:w-20 sm:h-24 rounded-xl border flex flex-col items-center justify-center select-none ${
                          isWhite
                            ? "bg-slate-100 border-slate-200 text-slate-800"
                            : isBlack
                            ? "bg-neutral-900 border-neutral-700 text-white"
                            : "bg-[#12264d] border-[#294c88] text-white"
                        }`}>
                          <span className="text-lg font-bold tracking-wider">{studentInitials}</span>
                          <span className={`text-[10px] font-medium mt-0.5 ${mutedText}`}>Student</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 border-2 flex items-center justify-center text-white transition cursor-pointer shadow-sm ${
                          isWhite ? "border-white" : isBlack ? "border-[#0b0b0b]" : "border-[#0e1f3d]"
                        }`}
                        title="Change or upload student photo"
                        aria-label="Upload student photo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </div>

                    {/* Identity Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`flex items-center gap-1.5 text-[11px] font-medium ${mutedText}`}>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">Verified Student · {schoolDisplayName}</span>
                          </div>
                          <h2 className="text-lg sm:text-xl font-bold tracking-tight truncate mt-0.5">
                            {activeStudent.name}
                          </h2>
                        </div>

                        <button
                          type="button"
                          onClick={() => setMaskSensitiveData((prev) => !prev)}
                          className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer whitespace-nowrap shrink-0 ${
                            maskSensitiveData
                              ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500"
                              : isWhite
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                              : isBlack
                              ? "bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700"
                              : "bg-[#112447] hover:bg-[#17315e] text-slate-200 border-[#274882]"
                          }`}
                        >
                          {maskSensitiveData ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{maskSensitiveData ? "Privacy ON" : "Hide"}</span>
                        </button>
                      </div>

                      <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-1.5 tabular-nums ${mutedText}`}>
                        <span className={isWhite ? "font-semibold text-slate-700" : "font-semibold text-slate-200"}>
                          {formatClassLabel(studentClassLabel)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Roll #{activeStudent.rollNo}</span>
                        <span aria-hidden="true">·</span>
                        <span>Adm: {activeStudent.admissionNo}</span>
                        {activeStudent.bloodGroup && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Blood: {activeStudent.bloodGroup}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Family & Contact Grid (Compact, Balanced, No Empty Gaps) */}
                  <div className={`grid gap-2.5 pt-3.5 border-t ${dividerBorder} ${
                    activeStudent.aadhaarNo ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
                  }`}>
                    <div className={`px-3 py-2.5 rounded-xl border ${subtleCell}`}>
                      <span className={`block text-[11px] font-medium ${mutedText}`}>Father&apos;s Name</span>
                      <span className="block text-xs sm:text-sm font-semibold truncate mt-0.5">
                        {maskSensitiveData ? maskSensitive2Chars(activeStudent.fatherName, true) : (activeStudent.fatherName || "—")}
                      </span>
                    </div>

                    <div className={`px-3 py-2.5 rounded-xl border ${subtleCell}`}>
                      <span className={`block text-[11px] font-medium ${mutedText}`}>Mother&apos;s Name</span>
                      <span className="block text-xs sm:text-sm font-semibold truncate mt-0.5">
                        {maskSensitiveData ? maskSensitive2Chars(activeStudent.motherName, true) : (activeStudent.motherName || "—")}
                      </span>
                    </div>

                    <div className={`px-3 py-2.5 rounded-xl border ${subtleCell} ${
                      activeStudent.aadhaarNo ? "" : "col-span-2 sm:col-span-1"
                    }`}>
                      <span className={`block text-[11px] font-medium ${mutedText}`}>Mobile Number</span>
                      <span className={`block text-xs sm:text-sm font-semibold tabular-nums truncate mt-0.5 ${
                        isWhite ? "text-emerald-700" : "text-emerald-300"
                      }`}>
                        {maskSensitiveData ? maskSensitive2Chars(activeStudent.phone, true) : (activeStudent.phone || "—")}
                      </span>
                    </div>

                    {activeStudent.aadhaarNo && (
                      <div className={`px-3 py-2.5 rounded-xl border ${subtleCell}`}>
                        <span className={`block text-[11px] font-medium ${mutedText}`}>Aadhaar Number</span>
                        <span className="block text-xs sm:text-sm font-semibold font-mono tabular-nums truncate mt-0.5">
                          {maskSensitiveData ? maskSensitive2Chars(activeStudent.aadhaarNo, true) : activeStudent.aadhaarNo}
                        </span>
                      </div>
                    )}
                  </div>

                  {studentLineageRecords.length > 1 && (
                    <div className={`pt-3 border-t flex items-center justify-between gap-3 flex-wrap ${dividerBorder}`}>
                      <span className={`text-xs font-semibold ${mutedText}`}>
                        Academic Session
                      </span>
                      <select
                        value={currentStudent.id}
                        onChange={(e) => setSelectedSessionStudentId(e.target.value)}
                        className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-300 text-slate-900"
                            : isBlack
                            ? "bg-neutral-900 border-neutral-700 text-white"
                            : "bg-[#112447] border-[#294c88] text-white"
                        }`}
                      >
                        {studentLineageRecords.map((rec, idx) => {
                          const sessLabel =
                            schoolSessions.find((ss) => ss.id === rec.sessionId)?.name ||
                            (idx === 0 ? "Active Session" : rec.previousSessionName || `Session ${idx + 1}`);
                          return (
                            <option key={rec.id} value={rec.id}>
                              {sessLabel} ({rec.className || "Class"}) {idx === 0 ? "· Active" : "· Old"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 1B. Account Recovery Card & Edit Modal */}
              <AccountRecoveryCard
                uid={uid || currentStudent.id}
                role="SCHOOL_STUDENT"
                name={currentStudent.name}
                displayId={currentStudent.admissionNo || currentStudent.rollNo || currentStudent.id}
                schoolId={schoolId}
                schoolName={school?.name}
                initialMobile={currentStudent.phone || ""}
                initialEmail={(currentStudent as any).email || ""}
                initialRecoveryPassword={(currentStudent as any).recoveryPassword || ""}
                initialSecurityQuestion={(currentStudent as any).securityQuestion || ""}
                initialSecurityAnswer={(currentStudent as any).securityAnswer || ""}
                theme={studentTheme}
                extraSync={async (payload) => {
                  if (schoolId && currentStudent?.id) {
                    const patch: any = {
                      recoveryMobile: payload.mobile,
                      recoveryEmail: payload.email,
                      recoveryPassword: payload.recoveryPassword,
                      securityQuestion: payload.securityQuestion,
                      securityAnswer: payload.securityAnswer,
                    };
                    if (payload.mobile && !currentStudent.phone) patch.phone = payload.mobile;
                    if (payload.email) patch.email = payload.email;
                    await updateStudent(schoolId, currentStudent.id, patch).catch(() => {});
                  }
                }}
              />

              {/* 2. Official Documents & Fee Records (Featured ID + Symmetric 2x2 Grid) */}
              <div className={`rounded-2xl p-4 sm:p-5 border space-y-3 ${surfaceCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold tracking-tight">
                      Official Documents &amp; Fee Records
                    </h3>
                    <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                      Instant digital pass, fee receipts aur official A4 forms
                    </p>
                  </div>
                </div>

                {/* Primary Featured Row: Digital ID Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab("idcard")}
                  className={`w-full min-h-[64px] p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition active:scale-[0.99] cursor-pointer ${
                    isWhite
                      ? "bg-slate-900 hover:bg-slate-800 border-slate-900 text-white"
                      : isBlack
                      ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white"
                      : "bg-indigo-600/25 hover:bg-indigo-600/35 border-indigo-400/40 text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-white/15 text-amber-300"
                        : "bg-amber-500/20 border border-amber-400/30 text-amber-300"
                    }`}>
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">Digital Student ID Card</p>
                      <p className={`text-[11px] truncate ${isWhite ? "text-slate-300" : mutedText}`}>
                        Smart QR Identity · Print &amp; Instant Verification
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold shrink-0 whitespace-nowrap">
                    <span>Open</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Symmetric 2x2 / 4-Column Grid (Equal Size & Height) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedAdmissionModal({ isOpen: true, mode: "receipt_only", feeRecord: studentAdmissionFeeRecord })}
                    className={`min-h-[76px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    }`}>
                      <ReceiptText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">प्रवेश शुल्क रसीद</p>
                      <p className={`text-[11px] truncate ${mutedText}`}>मदवार रसीद</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAdmissionModal({ isOpen: true, mode: "form_only", feeRecord: studentAdmissionFeeRecord })}
                    className={`min-h-[76px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                    }`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">A4 फॉर्म विवरण</p>
                      <p className={`text-[11px] truncate ${mutedText}`}>नामांकन फॉर्म</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBulkFeeModal(true)}
                    className={`min-h-[76px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-violet-50 border-violet-200 text-violet-700"
                        : "bg-violet-500/15 border-violet-500/30 text-violet-300"
                    }`}>
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">पासबुक A4</p>
                      <p className={`text-[11px] truncate ${mutedText}`}>12 माह लेजर</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("fees")}
                    className={`min-h-[76px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-teal-50 border-teal-200 text-teal-700"
                        : "bg-teal-500/15 border-teal-500/30 text-teal-300"
                    }`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">Fee Statements</p>
                      <p className={`text-[11px] truncate ${mutedText}`}>मासिक मांग</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Smart Campus Tools & App Theme (Uniform Grid — Every Button Identical Size) */}
              <div className={`rounded-2xl p-4 sm:p-5 border space-y-4 ${surfaceCard}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold tracking-tight">
                      Campus Tools &amp; Preferences
                    </h3>
                    <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                      Smart attendance, transport tracking aur app appearance
                    </p>
                  </div>

                  {/* Balanced 3-Theme Segmented Switcher */}
                  <div className={`grid grid-cols-3 p-1 rounded-xl border w-full sm:w-auto sm:min-w-[230px] ${
                    isWhite
                      ? "bg-slate-100 border-slate-200"
                      : isBlack
                      ? "bg-neutral-900 border-neutral-800"
                      : "bg-[#091630] border-[#1f3b6e]"
                  }`}>
                    <button
                      type="button"
                      onClick={() => applyStudentTheme("white")}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        isWhite
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>White</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStudentTheme("black")}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        isBlack
                          ? "bg-neutral-800 text-white shadow-xs"
                          : isWhite
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Black</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStudentTheme("current")}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        studentTheme === "current"
                          ? "bg-blue-600 text-white shadow-xs"
                          : isWhite
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Blue</span>
                    </button>
                  </div>
                </div>

                {/* Uniform Equal-Sized Campus Tools Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowFaceIdModal(true)}
                    className={`min-h-[64px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-teal-50 border-teal-200 text-teal-700"
                        : "bg-teal-500/15 border-teal-500/30 text-teal-300"
                    }`}>
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">अपडेट फेस आईडी</p>
                      <p className={`text-[11px] truncate tabular-nums ${mutedText}`}>
                        {faceIdDaysRemaining > 0 ? `${faceIdDaysRemaining}d remaining` : "Free Update"}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPtmModal(true)}
                    className={`min-h-[64px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                    }`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">PTM स्लॉट</p>
                      <p className={`text-[11px] truncate ${mutedText}`}>Parent Meeting</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBusLiveMapModal(true)}
                    className={`min-h-[64px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">Live Bus Map</p>
                      <p className={`text-[11px] truncate ${mutedText}`}>GPS Tracking</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playBusArrivalAlarmChime();
                      setBusAlarmTriggered(true);
                      setTimeout(() => setBusAlarmTriggered(false), 3000);
                    }}
                    className={`min-h-[64px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${
                      busAlarmTriggered
                        ? "bg-amber-500 text-slate-950 border-amber-400"
                        : actionTile
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      busAlarmTriggered
                        ? "bg-slate-950/15 border-slate-950/20 text-slate-950"
                        : isWhite
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    }`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {busAlarmTriggered ? "सायरन बज रहा है!" : "बस 1KM सायरन"}
                      </p>
                      <p className={`text-[11px] truncate ${busAlarmTriggered ? "text-slate-900" : mutedText}`}>
                        Arrival Alert
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNotificationModal(true)}
                    className={`min-h-[64px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${
                      !onVisitWebsite ? "col-span-2 sm:col-span-1" : ""
                    } ${actionTile}`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      pushEnabled
                        ? isWhite
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : isWhite
                        ? "bg-slate-100 border-slate-200 text-slate-500"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}>
                      {pushEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">Notifications</p>
                      <p className={`text-[11px] truncate ${
                        pushEnabled
                          ? isWhite ? "text-emerald-700 font-semibold" : "text-emerald-400 font-semibold"
                          : mutedText
                      }`}>
                        {pushEnabled ? "Alerts ON" : "Alerts OFF"}
                      </p>
                    </div>
                  </button>

                  {onVisitWebsite && (
                    <button
                      type="button"
                      onClick={onVisitWebsite}
                      className={`min-h-[64px] p-3 rounded-xl border text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-2.5 ${actionTile}`}
                    >
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                        isWhite
                          ? "bg-sky-50 border-sky-200 text-sky-700"
                          : "bg-sky-500/15 border-sky-500/30 text-sky-300"
                      }`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">School Website</p>
                        <p className={`text-[11px] truncate ${mutedText}`}>Official Portal</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Linked Student Accounts, QR Switcher & Logout */}
              <div className={`rounded-2xl p-4 sm:p-5 border space-y-4 ${surfaceCard}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold tracking-tight">
                      Linked Student Accounts
                    </h3>
                    <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                      Family ke dusre students link karein ya switch karein
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onAddAnotherStudentQr) {
                        onAddAnotherStudentQr();
                      } else {
                        setShowStudentSwitcherModal(true);
                      }
                    }}
                    className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                      isWhite
                        ? "bg-slate-900 hover:bg-slate-800 border-slate-900 text-white"
                        : isBlack
                        ? "bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white"
                        : "bg-indigo-600/30 hover:bg-indigo-600/45 border-indigo-400/50 text-white"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Student QR</span>
                  </button>
                </div>

                {(() => {
                  const list = Array.isArray(allLinkedStudents) && allLinkedStudents.length > 0
                    ? allLinkedStudents
                    : [activeStudent];
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {list.map((st: any) => {
                        const isSelected = st.id === activeStudent.id || st.admissionNo === activeStudent.admissionNo;
                        const chipClass = st.className
                          ? (/^(Nursery|LKG|UKG|Class)/i.test(st.className) ? st.className : `Class ${st.className}`)
                          : (formatClassLabel(studentClassLabel) || "");
                        const stKey = st.id || st.admissionNo;
                        const stInitials = String(st.name || "S")
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <div
                            key={stKey || st.name}
                            className={`min-h-[60px] p-3 rounded-xl border flex items-center justify-between gap-2.5 transition ${
                              isSelected
                                ? isWhite
                                  ? "bg-emerald-50/70 border-emerald-300"
                                  : "bg-emerald-500/10 border-emerald-500/40"
                                : subtleCell
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!isSelected) {
                                  try {
                                    localStorage.setItem("nst_current_user", JSON.stringify(st));
                                    if (onSwitchStudent) {
                                      onSwitchStudent(stKey);
                                    } else {
                                      window.location.reload();
                                    }
                                  } catch {}
                                }
                              }}
                              className="flex-1 flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                                isSelected
                                  ? isWhite
                                    ? "bg-emerald-600 text-white"
                                    : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/35"
                                  : isWhite
                                  ? "bg-slate-200 text-slate-700"
                                  : "bg-slate-800 text-slate-300"
                              }`}>
                                {stInitials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{st.name}</p>
                                <p className={`text-[11px] truncate tabular-nums ${mutedText}`}>
                                  {chipClass} · Roll #{st.rollNo}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[11px] font-semibold ${
                                isSelected
                                  ? isWhite ? "text-emerald-700" : "text-emerald-400"
                                  : mutedText
                              }`}>
                                {isSelected ? "Active" : "Switch"}
                              </span>
                              {list.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirmRemoveLinkedKey !== stKey) {
                                      setConfirmRemoveLinkedKey(stKey);
                                      setTimeout(() => {
                                        setConfirmRemoveLinkedKey((cur) => (cur === stKey ? null : cur));
                                      }, 3500);
                                      return;
                                    }
                                    setConfirmRemoveLinkedKey(null);
                                    if (onRemoveLinkedStudent) {
                                      onRemoveLinkedStudent(stKey);
                                    }
                                    try {
                                      const remaining = list.filter((x: any) => (x.id || x.admissionNo) !== stKey);
                                      localStorage.setItem("nst_linked_students", JSON.stringify(remaining));
                                      if (uid) {
                                        localStorage.setItem(
                                          `nst_user_linked_students_${uid}`,
                                          JSON.stringify({ students: remaining, activeStudentKey: remaining[0]?.id || "" })
                                        );
                                      }
                                      if (isSelected && remaining.length > 0) {
                                        localStorage.setItem("nst_current_user", JSON.stringify(remaining[0]));
                                        if (onSwitchStudent) {
                                          onSwitchStudent(remaining[0].id || remaining[0].admissionNo);
                                        } else {
                                          window.location.reload();
                                        }
                                      }
                                    } catch {}
                                  }}
                                  className="min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer text-[11px] font-bold"
                                  title="Remove linked ID"
                                >
                                  {confirmRemoveLinkedKey === stKey ? "हटाएं?" : <X className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className={`pt-3.5 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${dividerBorder}`}>
                  <p className={`text-[11px] ${mutedText}`}>
                    Logout karne par aapka linked data aur ID card surakshit rahega
                  </p>
                  <button
                    type="button"
                    onClick={handleStudentLogout}
                    className={`w-full sm:w-auto min-h-[44px] px-5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap ${
                      isWhite
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                        : "bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Full App Logout</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* ── FIXED BOTTOM NAVIGATION BAR (STUDENT PORTAL) ────────────────────── */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] backdrop-blur-md border-t px-2 py-1 print:hidden ${
        studentTheme === "white"
          ? "bg-white/95 border-slate-200"
          : studentTheme === "black"
          ? "bg-black/95 border-neutral-800"
          : "bg-[#091630]/95 border-[#1e3a6e]"
      }`}>
        <div className="max-w-xl mx-auto grid grid-cols-5 gap-1 h-full items-center">
          {[
            { id: "overview", label: "Home", icon: Home },
            { id: "attendance", label: "Attendance", icon: CalendarCheck },
            { id: "channel", label: "Updates", icon: Bell },
            { id: "advance", label: "Advance", icon: Sparkles },
            { id: "profile", label: "Profile", icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id as TabType);
                }}
                className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                  isActive
                    ? studentTheme === "white"
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : studentTheme === "black"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm"
                      : "bg-blue-500/25 text-sky-200 border border-sky-400/45 font-bold shadow-sm"
                    : studentTheme === "white"
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] sm:text-[11px] leading-tight font-medium truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── OFFICIAL FEE RECEIPT MODAL ─────────────────────────────────────── */}
      {selectedFeeForReceipt && (
        <OfficialFeeReceiptModal
          isOpen={true}
          onClose={() => setSelectedFeeForReceipt(null)}
          school={{
            ...(school || {}),
            id: schoolId,
            name: schoolDisplayName,
            logoUrl: resolvedSchoolLogo,
            address: school?.address || "Institutional Academic Campus, Educational Zone",
            affiliation: school?.affiliation || "Affiliated School Campus",
            code: getVisibleSchoolRegNo(school)
          } as any}
          fee={selectedFeeForReceipt}
          student={activeStudent}
          className={formatClassLabel(studentClassLabel)}
          sessionName="2026-2027"
          initialFormat={feeModalFormat}
          isStudentView={true}
          defaultMasked={maskSensitiveData}
        />
      )}

      {/* ── OFFICIAL ADMISSION FORM & RECEIPT MODAL ───────────────────────── */}
      {selectedAdmissionModal && (
        <AdmissionFormPrintModal
          key={`adm_modal_${selectedAdmissionModal.mode}`}
          isOpen={true}
          onClose={() => setSelectedAdmissionModal(null)}
          school={{
            ...(school || {}),
            id: schoolId,
            name: schoolDisplayName,
            logoUrl: resolvedSchoolLogo,
            address: school?.address || "",
            affiliation: school?.affiliation || "",
            code: getVisibleSchoolRegNo(school),
            email: school?.email || "",
            mobile: school?.mobile || school?.phone || "",
          } as any}
          student={activeStudent}
          application={enrichedData || activeStudent}
          className={formatClassLabel(studentClassLabel)}
          sessionName={activeStudent.sessionId || "2026-27"}
          feeRecord={selectedAdmissionModal.feeRecord || studentAdmissionFeeRecord}
          initialMode={selectedAdmissionModal.mode}
          isStudentView={true}
          defaultMasked={maskSensitiveData}
        />
      )}

      {/* ── ANNUAL BULK FEE STATEMENT (A4 DOSSIER) MODAL ─────────────────── */}
      {showBulkFeeModal && (
        <AnnualBulkFeeStatementModal
          isOpen={true}
          onClose={() => setShowBulkFeeModal(false)}
          school={{
            ...(school || {}),
            id: schoolId,
            name: schoolDisplayName,
            logoUrl: resolvedSchoolLogo,
            address: school?.address || "",
            affiliation: school?.affiliation || "",
            code: getVisibleSchoolRegNo(school),
            email: school?.email || "",
            mobile: school?.mobile || school?.phone || "",
            upiId: school?.upiId || "",
            principalName: school?.principalName || "Principal",
            principalSignatureUrl: school?.principalSignatureUrl || "",
          } as any}
          student={activeStudent}
          className={formatClassLabel(studentClassLabel)}
          sessionName={activeStudent.sessionId || "2026-2027"}
          allFees={allStudentFees}
          feeSummary={feeSummary}
          isStudentView={true}
        />
      )}

      {/* ── QR ATTENDANCE SCANNER MODAL ────────────────────────────────────── */}
      {showQrAttendanceScanner && (
        <QrAttendanceScannerModal
          isOpen={true}
          onClose={() => setShowQrAttendanceScanner(false)}
          currentStudent={{
            id: activeStudent.id,
            name: activeStudent.name,
            rollNo: activeStudent.rollNo,
            classId: activeStudent.classId || "cls_nursery",
            className: formatClassLabel(studentClassLabel),
            schoolId: schoolId,
            schoolName: schoolDisplayName,
          }}
          isTeacherMode={false}
          onStudentMarked={(res) => {
            setShowQrAttendanceScanner(false);
            setAttendanceSuccessMsg(`🎉 Shabaash ${activeStudent.name}! Aapki attendance safaltapoorvak darj ho gayi hai.`);
            setTimeout(() => setAttendanceSuccessMsg(null), 6000);
          }}
        />
      )}

      {/* ── ALL HOLIDAYS & SCHOOL CALENDAR MODAL (OPENED FROM HOME) ─────────── */}
      {showAllHolidaysModal && (() => {
        const parsedHolidays = holidaysList.map((h, idx) => ({
          ...h,
          key: h.id || `hol_modal_${idx}`,
        }));
        const filteredHols = parsedHolidays.filter((h) => {
          if (holidaysSearch) {
            const q = holidaysSearch.toLowerCase();
            return h.name?.toLowerCase().includes(q) || h.date?.toLowerCase().includes(q) || h.days?.toLowerCase().includes(q);
          }
          if (holidaysFilter === "FESTIVAL") return h.type === "festival" || h.name?.includes("पूजा") || h.name?.includes("दिवाली") || h.name?.includes("होली");
          if (holidaysFilter === "NATIONAL") return h.type === "national" || h.name?.includes("दिवस") || h.name?.includes("Jayanti");
          if (holidaysFilter === "VACATION") return h.type === "vacation" || h.days?.toLowerCase().includes("vacation") || h.days?.toLowerCase().includes("break");
          return true;
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className={`w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border ${
              studentTheme === "white"
                ? "bg-white border-slate-200 text-slate-900"
                : studentTheme === "black"
                ? "bg-black border-neutral-800 text-white"
                : "bg-slate-900 border-slate-800 text-white"
            }`}>
              <div className={`px-4 py-3.5 border-b flex items-center justify-between sticky top-0 z-10 ${
                studentTheme === "white" ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">School Holidays &amp; Calendar</h3>
                    <p className={`text-[10px] ${studentTheme === "white" ? "text-slate-500" : "text-slate-400"}`}>
                      Total {holidaysList.length} School Holidays
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllHolidaysModal(false)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition ${
                    studentTheme === "white"
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {[
                      { id: "ALL", label: `All (${holidaysList.length})` },
                      { id: "FESTIVAL", label: "Festivals" },
                      { id: "NATIONAL", label: "National" },
                      { id: "VACATION", label: "Vacations" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setHolidaysFilter(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                          holidaysFilter === f.id
                            ? "bg-rose-600 text-white border-rose-500 shadow-sm"
                            : studentTheme === "white"
                            ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={holidaysSearch}
                      onChange={(e) => setHolidaysSearch(e.target.value)}
                      placeholder="Search holiday or date..."
                      className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none focus:border-rose-500 ${
                        studentTheme === "white"
                          ? "bg-slate-50 border-slate-200 text-slate-900"
                          : "bg-slate-950 border-slate-800 text-white"
                      }`}
                    />
                  </div>
                </div>

                {filteredHols.length === 0 ? (
                  <p className={`text-center py-8 text-xs font-semibold ${studentTheme === "white" ? "text-slate-500" : "text-slate-400"}`}>
                    Koi holiday nahi mili.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredHols.map((h, i) => {
                      const isFestival = h.type === "festival" || h.name?.includes("पूजा") || h.name?.includes("दिवाली") || h.name?.includes("होली");
                      const isNational = h.type === "national" || h.name?.includes("दिवस") || h.name?.includes("Jayanti");
                      const isVacation = h.type === "vacation" || h.days?.toLowerCase().includes("vacation") || h.days?.toLowerCase().includes("break");
                      return (
                        <div
                          key={h.key || i}
                          className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                            studentTheme === "white"
                              ? "bg-slate-50 border-slate-200"
                              : "bg-slate-950/70 border-slate-800"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border text-center font-bold ${
                            isFestival
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"
                              : isNational
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                              : isVacation
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300"
                          }`}>
                            <span className="text-[9px] uppercase font-mono opacity-80">
                              {h.date?.split(" ")[1] || "HOL"}
                            </span>
                            <span className="text-sm font-black leading-none mt-0.5">
                              {h.date?.split(" ")[0]?.slice(0, 5) || i + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase mb-1 ${
                              isFestival
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : isNational
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : isVacation
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }`}>
                              {h.days || h.type || "Holiday"}
                            </span>
                            <h4 className="text-xs font-black leading-snug">{h.name}</h4>
                            <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${studentTheme === "white" ? "text-slate-500" : "text-slate-400"}`}>
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{h.date}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── NOTIFICATION CENTER & NOTICES HISTORY MODAL ───────────────────── */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications &amp; Alerts</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">स्कूल सूचनाएं, मासिक फीस व अवकाश अपडेट</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Push Alerts Toggle Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${pushEnabled ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Lock Screen Push Alerts:{" "}
                      <span className={pushEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                        {pushEnabled ? "Active (चालू)" : "Inactive (बंद)"}
                      </span>
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  {pushEnabled
                    ? `हर माह देय फीस (वर्तमान: ₹${pendingDues.toLocaleString("en-IN")}), छुट्टी और कम्युनिटी पोस्ट फ़ोन लॉक होने पर भी अपने आप दिखेंगे।`
                    : "1 टैप में चालू करें — मासिक फीस, छुट्टी व स्कूल कम्युनिटी अपडेट Lock Screen पर पाएं।"}
                </p>
                <div className="flex items-center gap-2">
                  {pushEnabled ? (
                    <button
                      type="button"
                      onClick={handleSendTestLockScreenPush}
                      disabled={pushBusy}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Test Lock Screen Push
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTogglePushAlerts}
                      disabled={pushBusy}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{pushBusy ? "Activating..." : "1-Tap Enable Alerts"}</span>
                    </button>
                  )}
                  {pushEnabled && (
                    <button
                      type="button"
                      onClick={handleTogglePushAlerts}
                      disabled={pushBusy}
                      className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      Turn Off
                    </button>
                  )}
                </div>
              </div>

              {/* Smart Caller Name Voice & Offline School Caller ID */}
              <CallerIdSettingsCard schoolName={schoolDisplayName} compact={true} />

              {/* Notification History Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Notification History (ताज़ा अलर्ट व सर्कुलर)</span>
                </h4>

                <div className="space-y-2.5">
                  {/* Automated Fee Due Alert */}
                  {pendingDues > 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                          Fee Due Notice
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Current Session</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                        मासिक शिक्षण शुल्क देय: ₹{pendingDues.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        कृपया समय पर शुल्क भुगतान करें ताकि परीक्षा व रिपोर्ट कार्ड में व्यवधान न हो।
                      </p>
                      <div className="mt-2.5 pt-2.5 border-t border-amber-200 dark:border-amber-500/30 space-y-2">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>💬 Fee Desk ko Quick Promise Reply bhejein:</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "TOMORROW", label: "Kal jama kar dunga" },
                            { id: "IN_3_DAYS", label: "3 din me" },
                            { id: "CUSTOM", label: "Custom Date" },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setQuickPromisePreset(opt.id as any)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition ${
                                quickPromisePreset === opt.id
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {quickPromisePreset === "CUSTOM" && (
                          <input
                            type="date"
                            value={quickPromiseCustomDate}
                            min={todayStr()}
                            onChange={(e) => setQuickPromiseCustomDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={quickPromiseNote}
                            onChange={(e) => setQuickPromiseNote(e.target.value)}
                            placeholder="Optional message..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            disabled={sendingQuickPromise}
                            onClick={() => void handleSendParentQuickPromise()}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {sendingQuickPromise ? "..." : "Send Promise"}
                          </button>
                        </div>
                        {quickPromiseSentMsg && (
                          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            ✓ {quickPromiseSentMsg}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                          Fee Status
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Up to date</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        सभी देय शुल्क पूर्ण रूप से चुकता हैं।
                      </p>
                    </div>
                  )}

                  {/* Automated Attendance Alert */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                        Attendance Status
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Today</span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                      कुल उपस्थिति: {attendanceStats.percentage}% ({attendanceStats.presentCount} दिन उपस्थित)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      नियमित उपस्थिति के लिए धन्यवाद।
                    </p>
                  </div>

                  {/* School Circulars / Notices */}
                  {noticesList && noticesList.length > 0 ? (
                    noticesList.map((ntc: any) => (
                      <div key={ntc.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25">
                            {ntc.category || "School Notice"}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{ntc.date}</span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">{ntc.title}</h5>
                        {ntc.body && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-3">
                            {ntc.body}
                          </p>
                        )}
                      </div>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MULTI-STUDENT SWITCHER & ADD ID MODAL ───────────────────────── */}
      {showStudentSwitcherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Student Account Switcher</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">छात्र आईडी चुनें या नई आईडी जोड़ें</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentSwitcherModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                एक ही डिवाइस में परिवार के सभी बच्चों की आईडी लिंक करें और कभी भी स्विच करें:
              </p>

              <div className="space-y-2">
                {/* Active Student */}
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600/20 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-emerald-800 dark:text-white font-bold text-xs shrink-0">
                      {studentInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{activeStudent.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Class: {formatClassLabel(studentClassLabel)} • Roll #{activeStudent.rollNo}
                      </p>
                      <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                        ID: {activeStudent.admissionNo}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" />
                    <span>Active</span>
                  </span>
                </div>

                {/* Sibling / Other Linked Students */}
                {allLinkedStudents &&
                  allLinkedStudents
                    .filter((s: any) => s.id !== activeStudent.id && s.admissionNo !== activeStudent.admissionNo)
                    .map((sib: any) => (
                      <button
                        key={sib.id || sib.admissionNo}
                        type="button"
                        onClick={() => {
                          try {
                            localStorage.setItem("nst_current_user", JSON.stringify(sib));
                            window.location.reload();
                          } catch {}
                        }}
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-left flex items-center justify-between gap-3 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs shrink-0">
                            {(sib.name || "S").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{sib.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              Class: {sib.className || sib.classId} • Roll #{sib.rollNo}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              ID: {sib.admissionNo || sib.id}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
                          Switch
                        </span>
                      </button>
                    ))}
              </div>

              {/* Add New Student ID Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentSwitcherModal(false);
                    if (onAddAnotherStudentQr) {
                      onAddAnotherStudentQr();
                    } else {
                      setActiveTab("idcard");
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add New Student ID Card (QR Scan)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CELEBRATORY SCHOOL WELCOME MODAL ── */}
      <SchoolWelcomeModal
        isOpen={Boolean(welcomeModalData)}
        onClose={() => setWelcomeModalData(null)}
        welcomeData={welcomeModalData}
        onOpenSchoolDesk={() => setActiveTab("channel")}
      />

      {/* ── CELEBRATORY SCHOOL BIRTHDAY MODAL ── */}
      <SchoolBirthdayModal
        isOpen={Boolean(birthdayModalData)}
        onClose={() => setBirthdayModalData(null)}
        birthdayData={birthdayModalData}
        onOpenSchoolDesk={() => setActiveTab("channel")}
      />

      {/* ── 30-DAY SELF-SERVICE FACE ID BIOMETRIC MODAL ── */}
      {showFaceIdModal && (
        <Suspense fallback={null}>
          <StudentFaceIdModal
            isOpen={showFaceIdModal}
            onClose={() => setShowFaceIdModal(false)}
            student={activeStudent}
            schoolId={schoolId}
            lastFaceUpdate={lastFaceUpdate}
            onFaceUpdated={(newPhoto) => {
              setLastFaceUpdate(new Date().toISOString());
              setStudentPhoto(newPhoto);
              setLiveStudentData((prev: any) => ({ ...(prev || {}), photoUrl: newPhoto }));
            }}
          />
        </Suspense>
      )}

      {/* ── PTM SLOT BOOKING MODAL FOR PARENTS ── */}
      {showPtmModal && (
        <PtmSchedulerModal
          school={school}
          activeSession={null}
          mode="PARENT_STUDENT"
          currentStudent={activeStudent}
          isOpen={showPtmModal}
          onClose={() => setShowPtmModal(false)}
        />
      )}

      {/* ── 3-THEME CUSTOMIZER MODAL FOR STUDENTS ── */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    App Theme Switcher (ऐप थीम)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    अपनी पसंद के अनुसार 3 में से कोई भी थीम चुनें
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {STUDENT_THEMES_META.map((t) => {
                const isActive = studentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      applyStudentTheme(t.id);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition cursor-pointer active:scale-98 ${
                      isActive
                        ? "bg-indigo-50 dark:bg-purple-950/40 border-indigo-600 dark:border-purple-500 ring-2 ring-indigo-500/20 dark:ring-purple-500/30 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        t.id === "white"
                          ? "bg-white text-amber-500 border-slate-300 shadow-xs"
                          : t.id === "black"
                          ? "bg-black text-slate-200 border-neutral-700"
                          : "bg-blue-950 text-blue-300 border-blue-500/60"
                      }`}>
                        {t.id === "white" ? <Sun className="w-4 h-4" /> : t.id === "black" ? <Moon className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {t.labelHi} ({t.label})
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {t.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {t.desc}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isActive ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                चयनित थीम डिवाइस में हमेशा सुरक्षित रहेगी
              </span>
              <button
                type="button"
                onClick={() => setShowThemeModal(false)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shadow-sm"
              >
                हो गया (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE BUS MAP MODAL (STRICT READ-ONLY PRIVATE VIEW FOR PARENTS & STUDENTS) ── */}
      {showBusLiveMapModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-1.5 sm:p-3">
          <div className="relative w-full max-w-5xl h-[94vh] bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    🚌 मेरे बच्चे की लाइव स्कूल बस
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {schoolDisplayName} • प्राइवेट लाइव लोकेशन (Read-Only)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBusLiveMapModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex-1 min-h-0 flex flex-col overflow-hidden">
              <AdminBusFleetRadar
                school={school || ({ id: schoolId, name: schoolDisplayName } as any)}
                currentStudent={activeStudent}
                onClose={() => setShowBusLiveMapModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── SCHOOL ACADEMIC SYLLABUS & NOTES (FULL SCREEN) ── */}
      {showSchoolSyllabusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col w-full h-full animate-in fade-in">
          <div className="relative w-full h-full bg-slate-900 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {selectedSchoolSubject ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSchoolSubject(null)}
                    className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-white shrink-0 cursor-pointer transition"
                    title="Back to All Subjects"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-xl shrink-0">
                    📚
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white truncate">
                      {selectedSchoolSubject
                        ? `${selectedSchoolSubject} · ${formatClassLabel(selectedClassLevel)}`
                        : `${formatClassLabel(selectedClassLevel)} Subjects & Notes`}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                      🏫 {schoolDisplayName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {selectedSchoolSubject
                      ? `${(schoolClassSubjectsMap.get(selectedSchoolSubject) || []).length} Lesson(s) • Lesson tap karein notes ya pages dekhne ke liye`
                      : `${schoolSubjectsCount} Subjects • ${schoolLessonsCount} Lessons • ${schoolMcqCount} MCQs • Subject select karein`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSchoolSyllabusModal(false);
                  setSelectedSchoolNote(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body: Step 1 (Subjects) -> Step 2 (Lessons of Subject) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {schoolClassNotes.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-3xl mx-auto">
                    🏫
                  </div>
                  <h4 className="text-base font-black text-white">
                    {formatClassLabel(selectedClassLevel)} के नोट्स अभी अपलोड नहीं हुए हैं
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    {schoolDisplayName} के शिक्षकों द्वारा इस कक्षा के नोट्स, PDF, Video या MCQ अपलोड करने पर वे यहाँ सीधे उपलब्ध होंगे।
                  </p>
                </div>
              ) : !selectedSchoolSubject ? (
                /* ── STEP 1: SUBJECT CARDS GRID ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      1. Subject Chunein ({formatClassLabel(selectedClassLevel)})
                    </h4>
                    <span className="text-[11px] font-bold text-indigo-300">
                      {schoolClassSubjectsMap.size} {schoolClassSubjectsMap.size === 1 ? 'Subject' : 'Subjects'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {Array.from(schoolClassSubjectsMap.entries()).map(([subjLabel, subjNotes]) => {
                      let subjPages = 0;
                      let subjMcqs = 0;
                      let hasPdf = false;
                      let hasVideo = false;
                      let hasAudio = false;
                      subjNotes.forEach((n: any) => {
                        const d = extractNoteDetails(n);
                        subjPages += Math.max(1, d.pages.length);
                        subjMcqs += d.mcqs.length;
                        if (d.hasPdf) hasPdf = true;
                        if (d.mediaItems.some((m) => m.videoUrl)) hasVideo = true;
                        if (d.mediaItems.some((m) => m.audioUrl)) hasAudio = true;
                      });
                      return (
                        <button
                          key={subjLabel}
                          type="button"
                          onClick={() => setSelectedSchoolSubject(subjLabel)}
                          className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/60 text-left transition flex flex-col justify-between gap-4 group cursor-pointer shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                                <BookOpen className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm sm:text-base font-black text-white group-hover:text-indigo-300 transition-colors truncate">
                                  {subjLabel}
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {formatClassLabel(selectedClassLevel)} Curriculum
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                                📖 {subjNotes.length} {subjNotes.length === 1 ? 'Lesson' : 'Lessons'}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                📄 {subjPages} {subjPages === 1 ? 'Page' : 'Pages'}
                              </span>
                              {subjMcqs > 0 && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ⚡ {subjMcqs} MCQs
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                              {hasPdf && <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">PDF</span>}
                              {hasVideo && <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Video</span>}
                              {hasAudio && <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300">Audio</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* ── STEP 2: LESSONS LIST OF SELECTED SUBJECT ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedSchoolSubject(null)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      <span>All Subjects</span>
                    </button>
                    <span className="text-[11px] font-bold text-slate-400">
                      Lesson tap karein • Multi-page lessons pehle Pages dikhayenge
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {(schoolClassSubjectsMap.get(selectedSchoolSubject) || []).map((note: any, idx: number) => {
                      const d = extractNoteDetails(note);
                      const mcqsCount = d.mcqs.length;
                      const pageCount = Math.max(1, d.pages.length);

                      return (
                        <div
                          key={note.id || idx}
                          className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3 group"
                        >
                          <div
                            onClick={() => {
                              setSelectedNoteInitialTab("pages");
                              setSelectedSchoolNote(note);
                            }}
                            className="space-y-2 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                Lesson {idx + 1} • {selectedSchoolSubject}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black border bg-violet-500/20 text-violet-200 border-violet-500/40">
                                  📄 {pageCount} {pageCount === 1 ? 'Page' : 'Pages'} →
                                </span>
                                {d.hasPdf && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    PDF
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-sm sm:text-base font-black text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                              {note.lessonTitle || note.title || note.chapterName || `Lesson ${idx + 1}`}
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-2">
                              {d.summaryText || 'School curated study material.'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span>📄 {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}</span>
                              {mcqsCount > 0 && <span>⚡ {mcqsCount} MCQs</span>}
                              <span>📅 {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : 'Active'}</span>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-800/80 grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNoteInitialTab("reading");
                                setSelectedSchoolNote(note);
                              }}
                              className="w-full h-9 px-2 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-100 border border-indigo-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                            >
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Notes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNoteInitialTab("premium");
                                setSelectedSchoolNote(note);
                              }}
                              className="w-full h-9 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                            >
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Premium</span>
                            </button>
                            {mcqsCount > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedNoteInitialTab("mcq");
                                    setSelectedSchoolNote(note);
                                  }}
                                  className="w-full h-9 px-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                                >
                                  <Zap className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">MCQ ({mcqsCount})</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedNoteInitialTab("flashcard");
                                    setSelectedSchoolNote(note);
                                  }}
                                  className="w-full h-9 px-2 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 text-cyan-200 border border-cyan-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                                >
                                  <Layers className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">Flashcard</span>
                                </button>
                              </>
                            )}
                            {d.hasPdf && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedNoteInitialTab("pdf");
                                  setSelectedSchoolNote(note);
                                }}
                                className="w-full h-9 px-2 rounded-lg bg-orange-600/25 hover:bg-orange-600/45 text-orange-200 border border-orange-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">PDF</span>
                              </button>
                            )}
                            {d.mediaItems.some((m) => m.videoUrl) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedNoteInitialTab("video");
                                  setSelectedSchoolNote(note);
                                }}
                                className="w-full h-9 px-2 rounded-lg bg-rose-600/25 hover:bg-rose-600/45 text-rose-200 border border-rose-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                              >
                                <Play className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Video</span>
                              </button>
                            )}
                            {d.mediaItems.some((m) => m.audioUrl) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedNoteInitialTab("audio");
                                  setSelectedSchoolNote(note);
                                }}
                                className="w-full h-9 px-2 rounded-lg bg-teal-600/25 hover:bg-teal-600/45 text-teal-200 border border-teal-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 truncate"
                              >
                                <span className="truncate">🎧 Audio</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                School Curriculum Portal • {schoolDisplayName}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowSchoolSyllabusModal(false);
                  setSelectedSchoolNote(null);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── FULL A-TO-Z LUCENT LESSON & MCQ VIEWER ── */}
      {selectedSchoolNote && (
        <Suspense fallback={null}>
          <SchoolLucentViewer
            note={selectedSchoolNote}
            activeStudent={activeStudent}
            schoolId={schoolId}
            schoolDisplayName={schoolDisplayName}
            classLevel={selectedClassLevel}
            initialTab={selectedNoteInitialTab}
            onBack={() => setSelectedSchoolNote(null)}
            onOpenStudyRoom={() => {
              setSelectedSchoolNote(null);
              setShowSchoolSyllabusModal(false);
              setActiveTab("advance");
              setAdvanceTab("online_test");
            }}
          />
        </Suspense>
      )}
      {schoolId && school && hasEliteCallAccess(school) && (
        <NstaCallPortalHost
          identity={{
            schoolId,
            schoolName: schoolDisplayName,
            userId: activeStudent?.id || studentId || "std_current",
            userName: activeStudent?.name || studentName || "Student",
            userRole: "STUDENT",
            userPhoto: activeStudent?.photoUrl || resolvedSchoolLogo,
            classId: activeStudent?.classId,
            className: activeStudent?.className,
            studentId: activeStudent?.id || studentId,
          }}
        />
      )}
    </div>
  );
};

export default StudentSchoolPanel;
