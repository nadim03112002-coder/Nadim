// @ts-nocheck
import React, { Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { setErrorLoggerModule, setErrorLoggerContext } from "../../utils/errorLogger";
import {
  subscribeToClasses, subscribeToSubjects, subscribeToStudents,
  subscribeToAllStudents, subscribeToLessons, getSchool, getSessions,
  getSubjects, getStudents, shouldUseDemoForSchool, isDemoRecord,
  saveSubject, saveMultipleSubjects, generateId, deleteSubject,
  getSchoolFeeHistory, getReferralPayouts, getSchoolReferralSettings,
  subscribeToTeachers,
  updateTeacher,
  saveStaffLeave,
  subscribeStaffLeaves,
  todayStr,
  isStudentBirthdayToday, dispatchOfficialSchoolBirthdayWish, subscribeToFeeCallFollowUps,
  getLocalAttendance, getSchoolPublicInquiries,
  subscribeSchoolUpiProofs, isUserAuthorizedUpiReceiver
} from "../../school-firebase";
import { getDemoSchoolDataset } from "./demoDataStore";
import type {
  School, SchoolClass, SchoolSubject, SchoolLesson, SchoolStudent, SchoolSession,
  MonthlyFee, TeacherReferralPayout, SchoolReferralSettings, SchoolTeacher, StaffLeave,
  FeeCallFollowUpRecord, SchoolPublicInquiry, UpiPaymentProofRecord
} from "../../school-types";
import { sortSchoolClasses } from "../../school-types";
import {
  calculateTeacherReferralLedger,
  formatReferralDurationLabel,
  normalizePersonName
} from "../../utils/schoolReferralSiblingEngine";
import { lazyWithRetry, LazyPanelBoundary, scheduleIdlePreload } from "../../utils/lazyWithRetry";
import { COMMON_BOOK_PRESETS } from "../../constants/bookPresets";
const AttendanceManager = lazyWithRetry(() => import("./AttendanceManager").then(m => ({ default: m.AttendanceManager })), "Attendance Manager");
const MarksManager = lazyWithRetry(() => import("./MarksManager").then(m => ({ default: m.MarksManager })), "Marks Manager");
const SmartClass = lazyWithRetry(() => import("./SmartClass").then(m => ({ default: m.SmartClass })), "Smart Class");
const ContentManager = lazyWithRetry(() => import("./ContentManager").then(m => ({ default: m.ContentManager })), "Content Manager");
const SchoolCommunityFeed = lazyWithRetry(() => import("./SchoolCommunityFeed").then(m => ({ default: m.SchoolCommunityFeed })), "Community Feed");
import {
  BookOpen, Users, ClipboardList, LayoutDashboard,
  ChevronRight, ChevronLeft, Edit3, FileText, HelpCircle, Play,
  Search, Phone, User, Calendar, Award, Sparkles, Filter, CheckCircle2,
  GraduationCap, LogOut, Home, Megaphone, Image as ImageIcon,
  Clock, Book, MessageSquare, Plus, X, Trash2, Check, Layers, IndianRupee, Wallet, Bell,
  Youtube, RotateCw, Menu, Building2, AlertCircle, UserPlus, Crown, ArrowRight,
  Sun, Moon, Palette,
  Cake, Gift,
  Smartphone, Laptop, Monitor,
  Camera, Lock, ShieldCheck, PenTool, Radio, EyeOff,
  MoreVertical, Globe, Info
} from "lucide-react";
const TimetableManager = lazyWithRetry(() => import("./TimetableManager").then(m => ({ default: m.TimetableManager })), "Timetable Manager");
const loadClassroomVideoArchive = () => import("./ClassroomVideoArchive").then(m => ({ default: m.ClassroomVideoArchive }));
const loadNstaMessengerSuite = () => import("./NstaMessengerSuite").then(m => ({ default: m.NstaMessengerSuite }));
const loadOnlineAdmissionManager = () => import("./OnlineAdmissionManager").then(m => ({ default: m.OnlineAdmissionManager }));
const loadGroupStudyModal = () => import("../GroupStudyModal").then(m => ({ default: m.GroupStudyModal }));
const loadUniversalFaceIdStudioModal = () => import("./UniversalFaceIdStudioModal").then(m => ({ default: m.UniversalFaceIdStudioModal }));
const loadQuestionPaperBuilder = () => import("./QuestionPaperBuilder").then(m => ({ default: m.QuestionPaperBuilder }));

const ClassroomVideoArchive = lazyWithRetry(loadClassroomVideoArchive, "Classroom Video Archive");
const HomeworkManager = lazyWithRetry(() => import("./HomeworkManager").then(m => ({ default: m.HomeworkManager })), "Homework Manager");
const LibraryManager = lazyWithRetry(() => import("./LibraryManager").then(m => ({ default: m.LibraryManager })), "Library Manager");
const ParentTeacherQueryManager = lazyWithRetry(() => import("./ParentTeacherQueryManager").then(m => ({ default: m.ParentTeacherQueryManager })), "Parent Queries");
const NstaMessengerSuite = lazyWithRetry(loadNstaMessengerSuite, "NSTA Messenger");
const AbsenteeActionPage = lazyWithRetry(() => import("./AbsenteeActionPage").then(m => ({ default: m.AbsenteeActionPage })), "Absentee Desk");
const OnlineAdmissionManager = lazyWithRetry(loadOnlineAdmissionManager, "Online Admission Manager");
const DirectAdmissionModal = lazyWithRetry(() => import("./DirectAdmissionModal").then(m => ({ default: m.DirectAdmissionModal })), "Direct Admission");
const AdmissionFormPrintModal = lazyWithRetry(() => import("./AdmissionFormPrintModal").then(m => ({ default: m.AdmissionFormPrintModal })), "Admission Form Print");
const StudentIdCardModal = lazyWithRetry(() => import("./StudentIdCardModal").then(m => ({ default: m.StudentIdCardModal })), "Student ID Card");
import { getSavedSchoolLogo } from "./feeReceiptUtils";
const ClassCurriculumNotesManager = lazyWithRetry(() => import("./ClassCurriculumNotesManager").then(m => ({ default: m.ClassCurriculumNotesManager })), "Curriculum Notes");
import {
  isSchoolEliteCurriculum,
  hasFaceAttendanceAccess,
  hasEliteCallAccess,
  hasEliteWalkieAccess,
  hasEliteFeeTagadaAccess,
} from "../../school-types";
const GroupStudyModal = lazyWithRetry(loadGroupStudyModal, "Study Room");
const ParentLeaveManager = lazyWithRetry(() => import("./ParentLeaveManager").then(m => ({ default: m.ParentLeaveManager })), "Parent Leaves");
const PtmSchedulerModal = lazyWithRetry(() => import("./PtmSchedulerModal").then(m => ({ default: m.PtmSchedulerModal })), "PTM Scheduler");
const UniversalFaceIdStudioModal = lazyWithRetry(loadUniversalFaceIdStudioModal, "Face ID Studio");
const QuestionPaperBuilder = lazyWithRetry(loadQuestionPaperBuilder, "Question Paper Builder");
const TeacherAdminGrowthHub = lazyWithRetry(() => import("./TeacherAdminGrowthHub").then(m => ({ default: m.TeacherAdminGrowthHub })), "Growth Hub");
const TeacherRulesRegulationsView = lazyWithRetry(() => import("./TeacherRulesRegulationsView").then(m => ({ default: m.TeacherRulesRegulationsView })), "Staff Rules");
const TeacherSignatureModal = lazyWithRetry(() => import("./TeacherSignatureModal").then(m => ({ default: m.TeacherSignatureModal })), "Teacher Signature");
const AppointmentLetterModal = lazyWithRetry(() => import("./AppointmentLetterModal").then(m => ({ default: m.AppointmentLetterModal })), "Appointment Letter");
const HomeDailyRoutineWidget = lazyWithRetry(() => import("./HomeDailyRoutineWidget").then(m => ({ default: m.HomeDailyRoutineWidget })), "Daily Routine");
import { AccountRecoveryCard } from "./AccountRecoveryCard";
import { rotateToLandscape, rotateToPortrait, setDesktopMode, useDeviceOrientation } from "../../utils/displayPrefs";
import { autoSyncSchoolPushIfPermitted } from "../../utils/schoolPushClient";
import { subscribeUserToPush, syncNativeAndroidIdentity } from "../NotificationManager";
import { resolveTeacherPermissions, getTeacherScopedClasses } from "../../utils/schoolRolePermissions";
import { useBackHandler } from "../../utils/backNavigation";
import { NstaCallPortalHost } from "./NstaCallModal";
import { CallerIdSettingsCard } from "./CallerIdSettingsCard";
import { CallSetupChecklistBanner } from "./CallSetupChecklistBanner";
import { ApkUpdateBanner } from "./ApkUpdateBanner";
import { IncomingParentCallModal } from "./IncomingParentCallModal";
import { ScreenInfoGuideButton } from "./ScreenInfoGuideButton";
import { useAppLang } from "../../utils/appLang";
import { syncSchoolDirectoryToAndroid, extractTodayAbsentStudentIds } from "../../utils/schoolCallerId";
import { useSchoolWalkieChannel } from "../../utils/schoolWalkieService";
const WalkieTalkieModal = lazyWithRetry(() => import("./WalkieTalkieModal").then(m => ({ default: m.WalkieTalkieModal })), "Walkie Talkie");
const PendingUpiApprovalsPanel = lazyWithRetry(() => import("./PendingUpiApprovalsPanel").then(m => ({ default: m.PendingUpiApprovalsPanel })), "UPI Approvals");
const UpiProofVerificationPopup = lazyWithRetry(() => import("./UpiProofVerificationPopup").then(m => ({ default: m.UpiProofVerificationPopup })), "UPI Popup");
const OfficialFeeReceiptModal = lazyWithRetry(() => import("./OfficialFeeReceiptModal").then(m => ({ default: m.OfficialFeeReceiptModal })), "Fee Receipt");

interface Props {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  onBack?: () => void;
  onLogout?: () => void;
  onOpenPlatformContent?: () => void;
}

type TeacherView =
  | "dashboard"
  | "community"
  | "absentee"
  | "all_students"
  | "classes"
  | "class_students"
  | "subjects"
  | "lessons"
  | "attendance"
  | "marks"
  | "class_notes_manager"
  | "smart_class"
  | "content_manage"
  | "timetable"
  | "video_lectures"
  | "homework"
  | "library"
  | "parent_queries"
  | "referrals"
  | "messenger_broadcast"
  | "online_admission"
  | "school_study_room"
  | "leaves_desk"
  | "question_paper_builder"
  | "ptm_scheduler"
  | "growth_diary"
  | "rules_regulations"
  | "my_leaves"
  | "upi_verification"
  | "profile";

export { COMMON_BOOK_PRESETS, PRESET_BOOK_BUNDLES } from "../../constants/bookPresets";

export const TeacherPanel: React.FC<Props> = ({
  schoolId,
  teacherId,
  teacherName,
  onBack,
  onLogout,
  onOpenPlatformContent
}) => {
  useEffect(() => {
    return scheduleIdlePreload([loadNstaMessengerSuite], 4500);
  }, []);

  const handleExploreFullApp = () => {
    if (!onOpenPlatformContent && !onBack) return;
    if (onOpenPlatformContent) {
      try {
        localStorage.setItem("nst_app_view_mode", "STUDENT");
        window.dispatchEvent(new CustomEvent("nst_open_student_dashboard"));
      } catch (err) {
        console.warn("[TeacherPanel] Explore full app switch warning:", err);
      }
      onOpenPlatformContent();
    } else if (onBack) {
      onBack();
    }
  };

  const [school, setSchool] = useState<School | null>(null);
  const [sessions, setSessions] = useState<SchoolSession[]>([]);
  const [activeSession, setActiveSession] = useState<SchoolSession | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<SchoolSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [lessons, setLessons] = useState<SchoolLesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<SchoolLesson | null>(null);
  const [feeCallFollowUps, setFeeCallFollowUps] = useState<FeeCallFollowUpRecord[]>([]);
  const [inquiries, setInquiries] = useState<SchoolPublicInquiry[]>([]);
  const [attendanceTick, setAttendanceTick] = useState(0);
  const [smartMode, setSmartMode] = useState<"reading" | "writing" | "pdf" | "mcq">("reading");
  const [view, setView] = useState<TeacherView>("dashboard");

  useEffect(() => {
    setErrorLoggerModule(`Teacher Portal → ${view}`);
    if (schoolId) setErrorLoggerContext({ schoolId, schoolName: school?.name || null });
  }, [view, schoolId, school?.name]);

  // Navigation Sidebar & Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem("school_teacher_sidebar_hidden") === "true";
    } catch {
      return false;
    }
  });

  // Preserve menu scroll position across drawer close/reopen, collapse/expand, and view switches
  const menuScrollStorageKey = `nst_teacher_menu_scroll_${schoolId || "default"}`;
  const desktopMenuScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuScrollRef = useRef<HTMLDivElement | null>(null);
  const mainContentScrollRef = useRef<HTMLDivElement | null>(null);
  const menuScrollTopRef = useRef<number>((() => {
    try {
      const raw = sessionStorage.getItem(`nst_teacher_menu_scroll_${schoolId || "default"}`);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  })());
  const isRestoringMenuScrollRef = useRef(false);

  const saveMenuScrollTop = (scrollTop: number) => {
    if (isRestoringMenuScrollRef.current) return;
    const safe = Math.max(0, Math.round(scrollTop));
    menuScrollTopRef.current = safe;
    try {
      sessionStorage.setItem(menuScrollStorageKey, String(safe));
    } catch {}
  };

  const captureActiveMenuScrollRef = useRef<() => void>(() => {});
  captureActiveMenuScrollRef.current = () => {
    const candidates = [mobileMenuScrollRef.current, desktopMenuScrollRef.current];
    for (const el of candidates) {
      if (el && el.clientHeight > 0) {
        saveMenuScrollTop(el.scrollTop);
        return;
      }
    }
  };

  // Continuous Device Orientation & Screen Width Hook
  const { isLandscape: isClientLandscape, isWideScreen } = useDeviceOrientation();

  // Desktop/Laptop Mode state (Manual Toggle Preserved in localStorage)
  const [isRotatedLandscape, setIsRotatedLandscape] = useState<boolean>(() => {
    try {
      return localStorage.getItem("school_erp_rotated_landscape") === "true";
    } catch {
      return false;
    }
  });

  // Effective landscape: active when manual desktop mode is ON, or device is held in landscape, or wide desktop monitor
  const isEffectiveLandscape = isRotatedLandscape || isClientLandscape || isWideScreen;
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [showTopMoreMenu, setShowTopMoreMenu] = useState(false);
  const topMoreMenuRef = useRef<HTMLDivElement | null>(null);
  const [appLang, setAppLang] = useAppLang();

  useEffect(() => {
    if (!showTopMoreMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (topMoreMenuRef.current && !topMoreMenuRef.current.contains(e.target as Node)) {
        setShowTopMoreMenu(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTopMoreMenu(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [showTopMoreMenu]);

  // 3-Theme Switcher (White / Black / Midnight Current)
  const [appTheme, setAppTheme] = useState<"current" | "white" | "black">(() => {
    try {
      const saved = (localStorage.getItem("nst_app_theme") || localStorage.getItem("nst_student_theme")) as any;
      if (saved === "white" || saved === "black" || saved === "current") return saved;
    } catch (err) {
      console.warn("[TeacherPanel] Theme load warning:", err);
    }
    return "current";
  });

  const applyTeacherTheme = (nextTheme: "current" | "white" | "black") => {
    setAppTheme(nextTheme);
    try {
      localStorage.setItem("nst_app_theme", nextTheme);
      localStorage.setItem("nst_student_theme", nextTheme);
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
        root.classList.add(`teacher-theme-${nextTheme}`, `app-theme-${nextTheme}`);
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
    } catch (err) {
      console.warn("[TeacherPanel] Theme apply warning:", err);
    }
  };

  useEffect(() => {
    applyTeacherTheme(appTheme);
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

  // Students state
  const [allStudents, setAllStudents] = useState<SchoolStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("ALL");
  const [showFaceStudio, setShowFaceStudio] = useState(false);
  const [showDirectAdmissionModal, setShowDirectAdmissionModal] = useState(false);
  const [admissionPrintPayload, setAdmissionPrintPayload] = useState<{
    student: SchoolStudent;
    fee: MonthlyFee | null;
    mode: "combined" | "form_only";
  } | null>(null);
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState<{
    student: SchoolStudent;
    admissionFee?: MonthlyFee | null;
  } | null>(null);
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);

  // Multi-book addition state
  const [showAddBooksModal, setShowAddBooksModal] = useState(false);
  const [customBooksInput, setCustomBooksInput] = useState("");
  const [selectedBooksQueue, setSelectedBooksQueue] = useState<string[]>([]);
  const [savingBooks, setSavingBooks] = useState(false);
  const [booksFeedback, setBooksFeedback] = useState<string | null>(null);

  // Current logged in Teacher record
  const [currentTeacher, setCurrentTeacher] = useState<SchoolTeacher | null>(null);
  const [teachersList, setTeachersList] = useState<SchoolTeacher[]>([]);
  const [showWalkieModal, setShowWalkieModal] = useState(false);
  const [showMySignatureModal, setShowMySignatureModal] = useState(false);
  const [showMyAppointmentLetter, setShowMyAppointmentLetter] = useState(false);

  // Teacher 10% Referral Incentive state
  const [schoolFees, setSchoolFees] = useState<MonthlyFee[]>([]);
  const [referralPayouts, setReferralPayouts] = useState<TeacherReferralPayout[]>([]);
  const [referralSettings, setReferralSettings] = useState<SchoolReferralSettings | null>(null);

  // Teacher Self Leave Requests (Teacher -> Admin Leave Requests Hub)
  const [myStaffLeaves, setMyStaffLeaves] = useState<StaffLeave[]>([]);
  const [teacherLeaveForm, setTeacherLeaveForm] = useState<{
    leaveType: StaffLeave["leaveType"];
    fromDate: string;
    toDate: string;
    reason: string;
  }>({
    leaveType: "casual",
    fromDate: todayStr(),
    toDate: todayStr(),
    reason: "",
  });
  const [submittingTeacherLeave, setSubmittingTeacherLeave] = useState(false);

  // Delegated BharatPe / UPI Screenshot Verification (Admin-assigned teachers only)
  const [upiProofs, setUpiProofs] = useState<UpiPaymentProofRecord[]>([]);
  const [approvedUpiReceiptFee, setApprovedUpiReceiptFee] = useState<MonthlyFee | null>(null);
  const isUpiReceiver = useMemo(
    () => isUserAuthorizedUpiReceiver({ school, role: "teacher", userId: teacherId }),
    [school, teacherId]
  );
  const pendingUpiCount = useMemo(
    () => upiProofs.filter((p) => p.status === "PENDING").length,
    [upiProofs]
  );

  // Android / Browser Back button step-by-step navigation across Teacher Portal
  useBackHandler(showFaceStudio, () => setShowFaceStudio(false), 30);
  useBackHandler(showWalkieModal, () => setShowWalkieModal(false), 26);
  useBackHandler(showTopMoreMenu, () => setShowTopMoreMenu(false), 26);
  useBackHandler(Boolean(admissionPrintPayload), () => setAdmissionPrintPayload(null), 22);
  useBackHandler(Boolean(selectedStudentForIdCard), () => setSelectedStudentForIdCard(null), 22);
  useBackHandler(Boolean(confirmDeleteSubjectId), () => setConfirmDeleteSubjectId(null), 22);
  useBackHandler(showMySignatureModal, () => setShowMySignatureModal(false), 22);
  useBackHandler(showMyAppointmentLetter, () => setShowMyAppointmentLetter(false), 20);
  useBackHandler(showDirectAdmissionModal, () => setShowDirectAdmissionModal(false), 20);
  useBackHandler(showAddBooksModal, () => setShowAddBooksModal(false), 20);
  useBackHandler(showRotatePrompt, () => setShowRotatePrompt(false), 20);
  useBackHandler(isSidebarOpen, () => setIsSidebarOpen(false), 18);
  useBackHandler(view === "smart_class", () => setView("lessons"), 10);
  useBackHandler(view === "lessons", () => {
    setSelectedLesson(null);
    setView("subjects");
  }, 8);
  useBackHandler(view === "class_students", () => {
    setSelectedClass(null);
    setView("classes");
  }, 8);
  useBackHandler(view === "subjects" && Boolean(selectedClass), () => {
    setSelectedSubject(null);
    setSelectedClass(null);
    setView("classes");
  }, 6);
  useBackHandler(view !== "dashboard", () => {
    setSelectedLesson(null);
    setSelectedSubject(null);
    setSelectedClass(null);
    setView("dashboard");
  }, 0);

  // Initial load
  const latestSchoolRef = useRef<School | null>(null);
  const latestTeachersRef = useRef<SchoolTeacher[]>([]);
  useEffect(() => {
    getSchool(schoolId).then((s) => {
      setSchool(s);
      latestSchoolRef.current = s;
      syncSchoolDirectoryToAndroid({
        school: s,
        schoolName: s?.name,
        teachers: latestTeachersRef.current,
      });
    });

    getSessions(schoolId).then((sess) => {
      setSessions(sess);
      const active = sess.find((s) => s.active) || sess[0] || null;
      setActiveSession(active);
    });

    const useDemo = shouldUseDemoForSchool(schoolId);

    const unsubStudents = subscribeToAllStudents(schoolId, (stds) => {
      if (stds && stds.length > 0) {
        const clean = !useDemo ? stds.filter((s) => !isDemoRecord(s)) : stds;
        setAllStudents(clean);
      } else if (useDemo) {
        const demo = getDemoSchoolDataset();
        if (demo && demo.students) setAllStudents(demo.students);
      } else {
        setAllStudents([]);
      }
    });

    const unsubTeachers = subscribeToTeachers(schoolId, (tchs) => {
      if (tchs && tchs.length > 0) {
        latestTeachersRef.current = tchs;
        setTeachersList(tchs);
        const me = tchs.find(
          (t) => t.id === teacherId || (t.name && teacherName && normalizePersonName(t.name) === normalizePersonName(teacherName))
        );
        if (me) setCurrentTeacher(me);
        const curSchool = latestSchoolRef.current || school;
        syncSchoolDirectoryToAndroid({
          school: curSchool,
          schoolName: curSchool?.name,
          teachers: tchs,
        });
      }
    });

    getSubjects(schoolId).then((subs) => {
      if (subs && subs.length > 0) {
        const clean = !useDemo ? subs.filter((s) => !isDemoRecord(s)) : subs;
        setAllSubjects(clean);
      } else if (useDemo) {
        const demo = getDemoSchoolDataset();
        if (demo && demo.subjects) setAllSubjects(demo.subjects);
      } else {
        setAllSubjects([]);
      }
    });

    Promise.all([
      getSchoolFeeHistory(schoolId),
      getReferralPayouts(schoolId),
      getSchoolReferralSettings(schoolId),
      getSchoolPublicInquiries(schoolId),
    ])
      .then(([fees, payouts, refCfg, inqList]) => {
        setSchoolFees(fees || []);
        setReferralPayouts(payouts || []);
        setReferralSettings(refCfg || null);
        setInquiries(Array.isArray(inqList) ? inqList : []);
      })
      .catch(() => {});

    const unsubFollowUps = subscribeToFeeCallFollowUps(schoolId, setFeeCallFollowUps);
    const handleAttendanceUpdate = () => setAttendanceTick((t) => t + 1);
    window.addEventListener("attendance-updated", handleAttendanceUpdate);

    return () => {
      if (typeof unsubStudents === "function") unsubStudents();
      if (typeof unsubTeachers === "function") unsubTeachers();
      if (typeof unsubFollowUps === "function") unsubFollowUps();
      window.removeEventListener("attendance-updated", handleAttendanceUpdate);
    };
  }, [schoolId, teacherId, teacherName]);

  const todayAbsentStudentIds = useMemo(() => {
    if (!schoolId) return [];
    try {
      return extractTodayAbsentStudentIds(getLocalAttendance(schoolId));
    } catch {
      return [];
    }
  }, [schoolId, attendanceTick, allStudents.length]);

  const {
    messages: walkieMessages,
    schedule: walkieSchedule,
    isWithinHours: isWalkieSchoolHoursNow,
  } = useSchoolWalkieChannel({
    enabled: Boolean(schoolId && hasEliteWalkieAccess(school)),
    schoolId,
    userId: teacherId,
    userRole: "TEACHER",
    onOpenWalkie: () => setShowWalkieModal(true),
  });

  useEffect(() => {
    const onOpenWalkie = () => setShowWalkieModal(true);
    window.addEventListener("android-open-walkie", onOpenWalkie);
    return () => window.removeEventListener("android-open-walkie", onOpenWalkie);
  }, []);

  useEffect(() => {
    const onReceiversUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.schoolId === schoolId && Array.isArray(detail?.upiAlertReceivers)) {
        setSchool((prev) =>
          prev ? { ...prev, upiAlertReceivers: detail.upiAlertReceivers } : prev
        );
      }
    };
    window.addEventListener("school-upi-receivers-updated", onReceiversUpdated);
    return () => window.removeEventListener("school-upi-receivers-updated", onReceiversUpdated);
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !isUpiReceiver) {
      setUpiProofs([]);
      return;
    }
    return subscribeSchoolUpiProofs(schoolId, setUpiProofs);
  }, [schoolId, isUpiReceiver]);

  useEffect(() => {
    if (!schoolId || (!school && allStudents.length === 0 && latestTeachersRef.current.length === 0)) {
      return;
    }
    const timer = window.setTimeout(() => {
      const targetSchool = school || latestSchoolRef.current;
      const allowParentCaller = hasEliteFeeTagadaAccess(targetSchool);
      syncSchoolDirectoryToAndroid({
        school: targetSchool,
        schoolName: targetSchool?.name,
        teachers: teachersList.length > 0 ? teachersList : latestTeachersRef.current,
        students: allowParentCaller ? allStudents : [],
        classes: allowParentCaller ? classes : [],
        fees: allowParentCaller ? schoolFees : [],
        feeCallFollowUps: allowParentCaller ? feeCallFollowUps : [],
        absentStudentIds: allowParentCaller ? todayAbsentStudentIds : [],
        inquiries: allowParentCaller ? inquiries : [],
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [
    schoolId,
    school,
    currentTeacher,
    teachersList,
    allStudents,
    classes,
    schoolFees,
    feeCallFollowUps,
    todayAbsentStudentIds,
    inquiries,
  ]);

  // Auto-sync Teacher device for Web Push & RTDB School Alerts when permission is granted
  useEffect(() => {
    if (!schoolId || !teacherId) return;
    try {
      localStorage.setItem("nst_active_school_id", schoolId);
      window.dispatchEvent(new CustomEvent("nst_school_identity_updated", { detail: { schoolId, teacherId } }));
    } catch {}
    syncNativeAndroidIdentity({
      userId: teacherId,
      schoolId,
      extraIds: [teacherId],
    }).catch(() => {});
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      autoSyncSchoolPushIfPermitted({
        userId: teacherId,
        schoolId,
        students: [
          {
            id: teacherId,
            schoolId,
            schoolName: school?.name || "School",
            classId: currentTeacher?.assignedClassId || "",
            className: currentTeacher?.assignedClassName || "",
            name: teacherName || "Teacher",
          },
        ],
      }).catch(() => {});

      try {
        const fcmKey = `nst_fcm_teacher_synced_${teacherId}_${schoolId}`;
        if (!sessionStorage.getItem(fcmKey)) {
          sessionStorage.setItem(fcmKey, "1");
          subscribeUserToPush(teacherId).catch(() => {});
        }
      } catch {}
    }
  }, [schoolId, teacherId, teacherName, school?.name, currentTeacher?.assignedClassId, currentTeacher?.assignedClassName]);

  // Orientation listener
  useEffect(() => {
    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        setShowRotatePrompt(false);
      }
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Global touch gestures: Swipe Left to hide menu, Swipe Right to reveal
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const onGlobalTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const onGlobalTouchEnd = (e: TouchEvent) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
        if (diffX < 0) {
          // Swipe Left -> Hide menu (1% visible strip)
          captureActiveMenuScrollRef.current();
          setIsSidebarOpen(false);
          setIsSidebarHidden(true);
          try {
            localStorage.setItem("school_teacher_sidebar_hidden", "true");
          } catch (err) {
            console.warn("[TeacherPanel] Sidebar pref warning:", err);
          }
        } else if (diffX > 0) {
          // Swipe Right -> Reveal menu ONLY if drag started from left 20% edge of screen
          const maxLeftEdge = typeof window !== "undefined" ? window.innerWidth * 0.20 : 80;
          if (touchStartX <= maxLeftEdge) {
            if (isEffectiveLandscape) {
              setIsSidebarHidden(false);
              try {
                localStorage.setItem("school_teacher_sidebar_hidden", "false");
              } catch (err) {
                console.warn("[TeacherPanel] Sidebar pref warning:", err);
              }
            } else {
              setIsSidebarOpen(true);
            }
          }
        }
      }
    };

    window.addEventListener("touchstart", onGlobalTouchStart, { passive: true });
    window.addEventListener("touchend", onGlobalTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onGlobalTouchStart);
      window.removeEventListener("touchend", onGlobalTouchEnd);
    };
  }, [isEffectiveLandscape]);

  useLayoutEffect(() => {
    const saved = menuScrollTopRef.current;
    if (saved <= 0) return;
    const visibleTargets = [mobileMenuScrollRef.current, desktopMenuScrollRef.current].filter(
      (el): el is HTMLDivElement => Boolean(el && el.clientHeight > 0)
    );
    if (visibleTargets.length === 0) return;
    isRestoringMenuScrollRef.current = true;
    visibleTargets.forEach((el) => {
      el.scrollTop = saved;
    });
    const raf = window.requestAnimationFrame(() => {
      visibleTargets.forEach((el) => {
        if (el.clientHeight > 0 && Math.abs(el.scrollTop - saved) > 1) {
          el.scrollTop = saved;
        }
      });
      isRestoringMenuScrollRef.current = false;
    });
    return () => {
      window.cancelAnimationFrame(raf);
      isRestoringMenuScrollRef.current = false;
    };
  }, [isSidebarOpen, isSidebarHidden, isEffectiveLandscape, view, selectedLesson]);

  useEffect(() => {
    if (view !== "referrals") return;
    Promise.all([
      getSchoolFeeHistory(schoolId),
      getReferralPayouts(schoolId),
      getSchoolReferralSettings(schoolId),
    ])
      .then(([fees, payouts, refCfg]) => {
        setSchoolFees(fees || []);
        setReferralPayouts(payouts || []);
        setReferralSettings(refCfg || null);
      })
      .catch(() => {});
  }, [view, schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const normMe = normalizePersonName(teacherName);
    const unsub = subscribeStaffLeaves(schoolId, (allLeaves) => {
      const mine = (allLeaves || []).filter(
        (l) =>
          l.staffId === teacherId ||
          (Boolean(normMe) && normalizePersonName(l.staffName) === normMe)
      );
      setMyStaffLeaves(mine);
    });
    return unsub;
  }, [schoolId, teacherId, teacherName]);

  const handleSubmitTeacherLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherLeaveForm.reason.trim()) {
      toast.error("कृपया छुट्टी का कारण (Reason) लिखें।");
      return;
    }
    const fromMs = new Date(teacherLeaveForm.fromDate || todayStr()).getTime();
    const toMs = new Date(teacherLeaveForm.toDate || teacherLeaveForm.fromDate || todayStr()).getTime();
    const days =
      Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs >= fromMs
        ? Math.max(1, Math.round((toMs - fromMs) / 86400000) + 1)
        : 1;
    setSubmittingTeacherLeave(true);
    try {
      const newLeave: StaffLeave = {
        id: `tleave_${generateId()}`,
        schoolId,
        staffId: teacherId,
        staffName: currentTeacher?.name || teacherName || "Teacher",
        designation: currentTeacher?.designation || "Teacher",
        leaveType: teacherLeaveForm.leaveType,
        fromDate: teacherLeaveForm.fromDate || todayStr(),
        toDate: teacherLeaveForm.toDate || teacherLeaveForm.fromDate || todayStr(),
        days,
        reason: teacherLeaveForm.reason.trim(),
        status: "pending",
        appliedAt: new Date().toISOString(),
      };
      await saveStaffLeave(newLeave);
      setTeacherLeaveForm((prev) => ({ ...prev, reason: "" }));
      toast.success("✓ छुट्टी आवेदन स्कूल एडमिन (Leave Requests) को भेज दिया गया है!");
    } catch (err: any) {
      toast.error("आवेदन भेजने में समस्या: " + (err?.message || "Unknown error"));
    } finally {
      setSubmittingTeacherLeave(false);
    }
  };

  const myReferralSummary = useMemo(() => {
    const normMe = normalizePersonName(teacherName);
    const normalizedStudents = allStudents.map((st) => {
      const matchesMe =
        st.referredByTeacherId === teacherId ||
        (Boolean(normMe) && normalizePersonName(st.referredByTeacherName) === normMe);
      return matchesMe ? { ...st, referredByTeacherId: teacherId, referredByTeacherName: teacherName } : st;
    });
    const normalizedPayouts = referralPayouts.map((p) => {
      const matchesMe =
        p.teacherId === teacherId ||
        (Boolean(normMe) && normalizePersonName(p.teacherName) === normMe);
      return matchesMe ? { ...p, teacherId, teacherName } : p;
    });

    const ledger = calculateTeacherReferralLedger({
      students: normalizedStudents.filter((s) => s.referredByTeacherId === teacherId),
      fees: schoolFees,
      payouts: normalizedPayouts.filter((p) => p.teacherId === teacherId),
      referrers: [{ id: teacherId, name: teacherName, designation: "Faculty", source: "teacher" }],
      settings: referralSettings || undefined,
    });

    return (
      ledger.teachers[0] || {
        teacherId,
        teacherName,
        designation: "Faculty",
        studentsCount: 0,
        totalEligibleFeeCollected: 0,
        totalEarnedCommission: 0,
        totalPendingCommission: 0,
        totalPaidOut: 0,
        balancePayable: 0,
        students: [],
        payouts: [],
      }
    );
  }, [allStudents, schoolFees, referralPayouts, referralSettings, teacherId, teacherName]);

  // Subscribe to classes
  useEffect(() => {
    const useDemo = shouldUseDemoForSchool(schoolId, activeSession?.id);
    const unsub = subscribeToClasses(schoolId, activeSession?.id || "", (clsList) => {
      if (clsList && clsList.length > 0) {
        const clean = !useDemo ? clsList.filter((c) => !isDemoRecord(c)) : clsList;
        setClasses(clean);
      } else if (useDemo) {
        const demo = getDemoSchoolDataset();
        if (demo && demo.classes) setClasses(demo.classes);
      } else {
        setClasses([]);
      }
    });
    return unsub;
  }, [schoolId, activeSession]);

  // Subscribe to subjects
  useEffect(() => {
    if (!selectedClass) return;
    const useDemo = shouldUseDemoForSchool(schoolId, activeSession?.id);
    const unsub = subscribeToSubjects(schoolId, selectedClass.id, (subs) => {
      if (subs && subs.length > 0) {
        const clean = !useDemo ? subs.filter((s) => !isDemoRecord(s)) : subs;
        setSubjects(clean);
      } else if (useDemo) {
        const demo = getDemoSchoolDataset();
        const found = demo.subjects.filter((s) => s.classId === selectedClass.id || s.className === selectedClass.name);
        setSubjects(found.length > 0 ? found : demo.subjects.slice(0, 6));
      } else {
        setSubjects([]);
      }
    });
    return unsub;
  }, [schoolId, selectedClass]);

  // Subscribe to lessons
  useEffect(() => {
    if (!selectedSubject) return;
    const useDemo = shouldUseDemoForSchool(schoolId, activeSession?.id);
    const unsub = subscribeToLessons(schoolId, selectedSubject.id, (lesList) => {
      if (lesList && lesList.length > 0) {
        setLessons(lesList);
      } else if (useDemo) {
        setLessons([
          {
            id: `les_${selectedSubject.id}_1`,
            schoolId,
            subjectId: selectedSubject.id,
            title: `Chapter 1: ${selectedSubject.name} - Fundamentals & Concepts`,
            order: 1,
            features: { readingEnabled: true, writingEnabled: true, pdfEnabled: true, mcqEnabled: true },
            readingContent: `# ${selectedSubject.name}\n\n## Chapter 1: Comprehensive Study Notes\n\nWelcome to this chapter. Here you will learn the core curriculum syllabus, solved examples, and revision formulas.`,
            writingPrompt: `Explain the fundamental importance of ${selectedSubject.name} in daily life.`,
            mcqQuestions: [
              {
                id: "q1",
                question: `What is the core focus of ${selectedSubject.name}?`,
                options: ["Conceptual mastery & understanding", "Random guessing", "No practical value", "None of these"],
                correctOption: 0,
                explanation: "Foundational conceptual understanding is the primary curriculum goal."
              }
            ],
            createdAt: new Date().toISOString()
          }
        ]);
      } else {
        setLessons([]);
      }
    });
    return unsub;
  }, [schoolId, selectedSubject, activeSession?.id]);

  const teacherAccess = useMemo(() => resolveTeacherPermissions(currentTeacher), [currentTeacher]);
  const teacherPerms = teacherAccess.permissions;
  const scopedClasses = useMemo(
    () => getTeacherScopedClasses(currentTeacher, classes),
    [currentTeacher, classes]
  );
  const scopedClassIds = useMemo(() => new Set(scopedClasses.map((c) => c.id)), [scopedClasses]);
  const scopedClassNames = useMemo(
    () => new Set(scopedClasses.map((c) => String(c.name || "").trim().toLowerCase())),
    [scopedClasses]
  );

  useEffect(() => {
    if (scopedClasses.length === 0) return;
    if (!selectedClass || !scopedClassIds.has(selectedClass.id)) {
      setSelectedClass(scopedClasses[0]);
    }
  }, [scopedClasses, scopedClassIds, selectedClass]);

  const scopedStudents = useMemo(() => {
    if (teacherPerms.canViewAllStudents || teacherAccess.accessScope === "full_school") {
      return allStudents;
    }
    if (scopedClasses.length === 0 && currentTeacher?.permissions) {
      return [];
    }
    return allStudents.filter(
      (s) =>
        scopedClassIds.has(s.classId) ||
        scopedClassNames.has(String(s.className || "").trim().toLowerCase())
    );
  }, [allStudents, teacherPerms.canViewAllStudents, teacherAccess.accessScope, scopedClasses.length, currentTeacher?.permissions, scopedClassIds, scopedClassNames]);

  const filteredStudents = useMemo(() => {
    return scopedStudents.filter((s) => {
      const q = studentSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.rollNo && s.rollNo.toString().toLowerCase().includes(q)) ||
        (s.admissionNo && s.admissionNo.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q));
      const matchClass = selectedClassFilter === "ALL" || s.classId === selectedClassFilter;
      return matchSearch && matchClass;
    });
  }, [scopedStudents, studentSearch, selectedClassFilter]);

  const studentCountByClass = useMemo(() => {
    const map: Record<string, number> = {};
    scopedStudents.forEach((st) => {
      if (st.classId) map[st.classId] = (map[st.classId] || 0) + 1;
    });
    return map;
  }, [scopedStudents]);

  const todaysTeacherBirthdays = useMemo(() => {
    return scopedStudents.filter((s) => isStudentBirthdayToday(s.dateOfBirth));
  }, [scopedStudents]);

  const handleToggleScreenRotate = async () => {
    const nextIsRotated = !isEffectiveLandscape;
    setIsRotatedLandscape(nextIsRotated);
    try {
      localStorage.setItem("school_erp_rotated_landscape", nextIsRotated ? "true" : "false");
    } catch (err) {
      console.warn("[TeacherPanel] Orientation save warning:", err);
    }

    if (nextIsRotated) {
      await rotateToLandscape();
      setDesktopMode(true, false);
      setShowRotatePrompt(true);
      setTimeout(() => setShowRotatePrompt(false), 3500);
    } else {
      await rotateToPortrait();
      setDesktopMode(false, false);
      setShowRotatePrompt(false);
    }
  };

  const handlePerformLogout = () => {
    try {
      localStorage.removeItem("nst_current_user");
      localStorage.removeItem("nsta_cached_user");
      localStorage.removeItem("nst_is_guest");
      localStorage.setItem("nst_logged_out", "true");
    } catch (e) {}
    if (onLogout) onLogout();
    else if (onBack) onBack();
    else window.location.reload();
  };

  const handleSaveAllBooks = async () => {
    if (!selectedClass || selectedBooksQueue.length === 0) return;
    setSavingBooks(true);
    setBooksFeedback(null);
    try {
      const existingNames = new Set(subjects.map((s) => (s.name || "").trim().toLowerCase()));
      const toAdd = selectedBooksQueue.filter((name) => !existingNames.has(name.trim().toLowerCase()));

      if (toAdd.length === 0) {
        setBooksFeedback("Ye sabhi books pehle se is class me add hain!");
        setSavingBooks(false);
        return;
      }

      const newSubs: SchoolSubject[] = toAdd.map((name) => ({
        id: generateId(),
        schoolId,
        sessionId: activeSession?.id || "",
        classId: selectedClass.id,
        className: selectedClass.name,
        name: name.trim(),
        createdAt: new Date().toISOString()
      }));

      await saveMultipleSubjects(newSubs);

      setSubjects((prev) => [...prev, ...newSubs]);
      setAllSubjects((prev) => [...prev, ...newSubs]);
      setSelectedBooksQueue([]);
      setCustomBooksInput("");
      setShowAddBooksModal(false);
      setBooksFeedback(`✅ ${newSubs.length} books safaltapoorvak add kar di gayi hain!`);
      setTimeout(() => setBooksFeedback(null), 4000);
    } catch (err: any) {
      setBooksFeedback(`❌ Error adding books: ${err?.message || "Kripya dobara try karein"}`);
    } finally {
      setSavingBooks(false);
    }
  };

  const handleDeleteSubject = async (sub: SchoolSubject) => {
    try {
      await deleteSubject(schoolId, sub.id);
      setSubjects((prev) => prev.filter((s) => s.id !== sub.id));
      setAllSubjects((prev) => prev.filter((s) => s.id !== sub.id));
      setConfirmDeleteSubjectId(null);
      toast.success(`"${sub.name}" delete ho gaya.`);
    } catch (err) {
      console.error("[TeacherPanel] Delete subject error:", err);
      toast.error("Subject delete karne me samasya aayi.");
    }
  };

  // Full-screen smart class mode
  if (view === "smart_class" && selectedLesson) {
    return (
      <Suspense fallback={null}>
        <SmartClass
          lesson={selectedLesson}
          initialMode={smartMode}
          schoolId={schoolId}
          teacherId={teacherId}
          onBack={() => setView("lessons")}
        />
      </Suspense>
    );
  }

  // ── TEACHER NAVIGATION CATEGORIES (DYNAMICALLY FILTERED BY ADMIN PERMISSIONS) ──
  const isReferralEligible = Boolean(currentTeacher?.hasReferralIncentive);

  const isTeacherViewAllowed = (targetView: TeacherView): boolean => {
    switch (targetView) {
      case "online_admission":
        return Boolean(teacherPerms.canAddAdmission);
      case "attendance":
        return Boolean(teacherPerms.canMarkAttendance);
      case "leaves_desk":
        return Boolean(teacherPerms.canApproveLeaves);
      case "marks":
        return Boolean(teacherPerms.canEnterMarks);
      case "question_paper_builder":
        return Boolean(teacherPerms.canBuildQuestionPapers);
      case "homework":
      case "growth_diary":
        return Boolean(teacherPerms.canManageHomeworkAndDiary);
      case "class_notes_manager":
      case "subjects":
      case "video_lectures":
      case "school_study_room":
      case "lessons":
      case "content_manage":
      case "smart_class":
        return Boolean(teacherPerms.canManageNotesAndVideos);
      case "library":
        return Boolean(teacherPerms.canManageLibrary);
      case "absentee":
        return Boolean(teacherPerms.canManageAbsentee);
      case "messenger_broadcast":
      case "parent_queries":
        return Boolean(teacherPerms.canMessageParents);
      case "ptm_scheduler":
        return Boolean(teacherPerms.canSchedulePtm);
      case "referrals":
        return isReferralEligible;
      case "upi_verification":
        return isUpiReceiver;
      default:
        return true;
    }
  };

  const rawNavCategories = [
    {
      id: "main",
      title: "मुख्य मेनू (Main)",
      theme: {
        pillBg: "bg-indigo-950/60 border border-indigo-500/30",
        titleColor: "text-indigo-300",
        accentDot: "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]",
        badgeColor: "bg-indigo-500/25 text-indigo-200 border border-indigo-400/30",
        hoverBg: "hover:bg-indigo-950/40 hover:text-indigo-200",
      },
      items: [
        { id: "dashboard" as TeacherView, label: "Teacher Dashboard", icon: Home, desc: "कक्षा समरी व लाइव मेट्रिक्स" },
        { id: "profile" as TeacherView, label: "My Profile & Recovery", icon: User, desc: "प्रोफाइल, सिग्नेचर व अकाउंट रिकवरी" },
        { id: "my_leaves" as TeacherView, label: "My Leave Requests", icon: Calendar, desc: "Admin को छुट्टी आवेदन भेजें" },
        { id: "rules_regulations" as TeacherView, label: "School Rules & Bonus", icon: ShieldCheck, desc: "13 नियम, +2 दिन बोनस व सैलरी" },
        { id: "community" as TeacherView, label: "Classroom Community", icon: Megaphone, desc: "फोटो, वीडियो व सर्कुलर्स" },
      ]
    },
    {
      id: "academics",
      title: "छात्र व शिक्षा (Academics & Teaching)",
      theme: {
        pillBg: "bg-emerald-950/60 border border-emerald-500/30",
        titleColor: "text-emerald-300",
        accentDot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
        badgeColor: "bg-emerald-500/25 text-emerald-200 border border-emerald-400/30",
        hoverBg: "hover:bg-emerald-950/40 hover:text-emerald-200",
      },
      items: [
        { id: "online_admission" as TeacherView, label: "Online Admission", icon: UserPlus, desc: "नया छात्र प्रवेश फॉर्म भरें" },
        { id: "classes" as TeacherView, label: "My Classes & Sections", icon: BookOpen, desc: "कक्षाएं व छात्र रोस्टर" },
        { id: "all_students" as TeacherView, label: "Students Directory", icon: Users, desc: teacherPerms.canViewAllStudents ? "पूरा स्कूल छात्र डायरेक्टरी" : "मेरी आवंटित कक्षा के छात्र" },
        { id: "attendance" as TeacherView, label: "Daily Attendance", icon: ClipboardList, desc: "दैनिक रोल-कॉल व उपस्थिति" },
        { id: "leaves_desk" as TeacherView, label: "Student Leaves Desk", icon: Calendar, desc: "छुट्टी आवेदन व 1-टैप अप्रूवल" },
        { id: "marks" as TeacherView, label: "Marks & Exam Entry", icon: Edit3, desc: teacherPerms.canEnterAllSubjectsMarks ? "कक्षा के सभी विषयों के अंक" : "केवल आवंटित विषय के अंक" },
        { id: "question_paper_builder" as TeacherView, label: "Question Paper Builder", icon: FileText, desc: "अर्धवार्षिक व वार्षिक परीक्षा पेपर" },
        { id: "homework" as TeacherView, label: "Daily Homework & Diary", icon: BookOpen, desc: "दैनिक गृहकार्य, नोट्स व डायरी" },
        { id: "growth_diary" as TeacherView, label: "Student Growth & 6-Skills", icon: Sparkles, desc: "दैनिक डायरी, 6-स्किल्स व हेल्थ" },
      ]
    },
    {
      id: "digital_classroom",
      title: "डिजिटल क्लासरूम व लाइब्रेरी (Digital Study)",
      theme: {
        pillBg: "bg-cyan-950/60 border border-cyan-500/30",
        titleColor: "text-cyan-300",
        accentDot: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]",
        badgeColor: "bg-cyan-500/25 text-cyan-200 border border-cyan-400/30",
        hoverBg: "hover:bg-cyan-950/40 hover:text-cyan-200",
      },
      items: [
        { id: "class_notes_manager" as TeacherView, label: "Class 1-12 Notes Manager", icon: Sparkles, desc: "स्कूल नोट्स, MCQ, Video व PDF" },
        { id: "subjects" as TeacherView, label: "Smart Class & Subjects", icon: Play, desc: "स्मार्ट क्लास, पाठ व एमसीक्यू" },
        { id: "video_lectures" as TeacherView, label: "Class Video Archive", icon: Youtube, desc: "यूट्यूब वीडियो लेक्चर्स संग्रह" },
        { id: "school_study_room" as TeacherView, label: "School Online Test", icon: Users, desc: "लाइव ऑनलाइन टेस्ट (School MCQs)" },
        { id: "library" as TeacherView, label: "Library Management", icon: Book, desc: "पुस्तकालय व पुस्तक विवरण" },
      ]
    },
    {
      id: "communication",
      title: "कम्युनिकेशन व सुरक्षा (Communication)",
      theme: {
        pillBg: "bg-rose-950/60 border border-rose-500/30",
        titleColor: "text-rose-300",
        accentDot: "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]",
        badgeColor: "bg-rose-500/25 text-rose-200 border border-rose-400/30",
        hoverBg: "hover:bg-rose-950/40 hover:text-rose-200",
      },
      items: [
        { id: "absentee" as TeacherView, label: "Absentee Action Center", icon: AlertCircle, desc: "1-दिन अलर्ट व 2-दिन+ कॉल" },
        { id: "messenger_broadcast" as TeacherView, label: "Messenger & Broadcast", icon: MessageSquare, desc: "क्लास ग्रुप्स व 1-वे पुश अलर्ट्स" },
        { id: "parent_queries" as TeacherView, label: "Parent Helpdesk & Leaves", icon: MessageSquare, desc: "अभिभावक संवाद व लीव आवेदन" },
        { id: "ptm_scheduler" as TeacherView, label: "PTM Slot Scheduler", icon: Calendar, desc: "अभिभावक-शिक्षक बैठक समय सारणी" },
        ...(isUpiReceiver
          ? [
              {
                id: "upi_verification" as TeacherView,
                label:
                  pendingUpiCount > 0
                    ? `UPI Payment Desk (${pendingUpiCount})`
                    : "UPI Payment Desk",
                icon: Wallet,
                desc: "BharatPe / UPI स्क्रीनशॉट जांचें व Confirm करें",
              },
            ]
          : []),
      ]
    },
    ...(isReferralEligible
      ? [
          {
            id: "earnings",
            title: "वेतन व इंसेंटिव (Incentives & Pay)",
            theme: {
              pillBg: "bg-purple-950/60 border border-purple-500/30",
              titleColor: "text-purple-300",
              accentDot: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]",
              badgeColor: "bg-purple-500/25 text-purple-200 border border-purple-400/30",
              hoverBg: "hover:bg-purple-950/40 hover:text-purple-200",
            },
            items: [
              { id: "referrals" as TeacherView, label: "10% Referral Incentive", icon: Award, desc: "रेफरल इंसेंटिव व लेजर" },
            ]
          }
        ]
      : [])
  ];

  const navCategories = rawNavCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => isTeacherViewAllowed(item.id)),
    }))
    .filter((cat) => cat.items.length > 0);

  // Elite-exclusive menu items highlighted with Premium Royal Gold styling
  const ELITE_TEACHER_MENU_IDS = new Set<TeacherView>([
    "class_notes_manager",
    "video_lectures",
    "school_study_room",
  ]);
  const isSchoolElite = isSchoolEliteCurriculum(school);

  const isMenuItemActive = (itemId: TeacherView): boolean => {
    if (view === itemId) return true;
    if (itemId === "classes" && (view === "class_students" || view === "lessons" || view === "content_manage")) return true;
    if (itemId === "subjects" && (view === "subjects" || view === "lessons" || view === "smart_class")) return true;
    return false;
  };

  const handleSelectNavView = (targetView: TeacherView) => {
    if (!isTeacherViewAllowed(targetView)) {
      toast.error("यह मॉड्यूल School Admin द्वारा आपके रोल के लिए बंद किया गया है।");
      return;
    }
    if (targetView === "attendance") {
      const target = (selectedClass && scopedClassIds.has(selectedClass.id) ? selectedClass : scopedClasses[0]) || null;
      if (target) setSelectedClass(target);
      setView("attendance");
    } else if (targetView === "marks") {
      const target = (selectedClass && scopedClassIds.has(selectedClass.id) ? selectedClass : scopedClasses[0]) || null;
      if (target) setSelectedClass(target);
      setView("marks");
    } else if (targetView === "subjects") {
      const target = (selectedClass && scopedClassIds.has(selectedClass.id) ? selectedClass : scopedClasses[0]) || null;
      if (target) setSelectedClass(target);
      setView("subjects");
    } else {
      setView(targetView);
    }
    captureActiveMenuScrollRef.current();
    if (targetView === "students" || targetView === "attendance" || targetView === "marks" || targetView === "subjects") {
      // handled above; no-op
    }
    setIsSidebarOpen(false);
    mainContentScrollRef.current?.scrollTo({ top: 0 });
  };

  // ── DESKTOP PERMANENT LEFT SIDEBAR ───────────
  const renderDesktopSidebar = () => {
    const displaySchoolLogo = school ? getSavedSchoolLogo(school.logoUrl, schoolId) : "";
    const isSidebarDefault = isEffectiveLandscape;
    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";

    if (isSidebarHidden) {
      return (
        <aside
          onClick={() => {
            setIsSidebarHidden(false);
            try {
              localStorage.setItem("school_teacher_sidebar_hidden", "false");
            } catch (err) {
              console.warn("[TeacherPanel] Sidebar reveal warning:", err);
            }
          }}
          className={`hidden md:flex flex-col w-2 hover:w-3 shrink-0 h-screen h-[100dvh] max-h-screen cursor-pointer transition-all duration-200 z-30 group relative border-r ${
            isWhite
              ? "bg-slate-200 border-slate-300 hover:bg-indigo-100"
              : isBlack
              ? "bg-zinc-950 border-zinc-800 hover:bg-indigo-950"
              : "bg-slate-900 border-slate-800 hover:bg-indigo-950"
          }`}
          title="मेनू खोलें (Click to expand)"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-16 rounded-r-full bg-indigo-500 opacity-70 group-hover:opacity-100" />
        </aside>
      );
    }

    return (
      <aside className={`${isSidebarDefault ? "flex" : "hidden md:flex"} flex-col w-60 lg:w-64 border-r shrink-0 h-screen h-[100dvh] max-h-screen overflow-hidden select-none z-30 transition-colors duration-200 ${
        isWhite
          ? "bg-white border-slate-200 text-slate-800"
          : isBlack
          ? "bg-black border-zinc-800 text-zinc-100"
          : "bg-slate-900 border-slate-800 text-slate-100"
      }`}>
        {/* Brand Header */}
        <div className={`p-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
          isWhite ? "border-slate-200 bg-slate-50/70" : isBlack ? "border-zinc-800 bg-zinc-950" : "border-slate-800 bg-slate-950/60"
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`w-8 h-8 rounded-xl p-1 flex items-center justify-center shrink-0 border overflow-hidden ${
              isWhite ? "bg-white border-slate-200" : "bg-white/10 border-white/15"
            }`}>
              {displaySchoolLogo ? (
                <img src={displaySchoolLogo} alt={school?.name} className="w-full h-full object-contain rounded-lg bg-white" />
              ) : (
                <GraduationCap className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className={`font-bold text-xs truncate leading-tight ${isWhite ? "text-slate-900" : "text-white"}`}>
                {school?.name || "Teacher Portal"}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                  isWhite
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                }`}>
                  {teacherName.split(" ")[0]} (Faculty)
                </span>
                <span className="text-[10px] text-slate-400 truncate tabular-nums">
                  {activeSession?.name || "2026-27"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              captureActiveMenuScrollRef.current();
              setIsSidebarHidden(true);
              try {
                localStorage.setItem("school_teacher_sidebar_hidden", "true");
              } catch (err) {
                console.warn("[TeacherPanel] Sidebar hide warning:", err);
              }
            }}
            className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
              isWhite ? "hover:bg-slate-200 text-slate-500 hover:text-slate-900" : "hover:bg-white/10 text-slate-400 hover:text-white"
            }`}
            title="मेनू को बाएँ छुपाएं"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Categories List with Independent Scroll */}
        <div
          ref={desktopMenuScrollRef}
          onScroll={(e) => {
            if (!isRestoringMenuScrollRef.current && e.currentTarget.clientHeight > 0) {
              saveMenuScrollTop(e.currentTarget.scrollTop);
            }
          }}
          className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto overscroll-contain"
        >
          {navCategories.map((cat, cIdx) => (
            <div key={`cat-${cIdx}`} className="space-y-1">
              <div className="px-2 py-1 flex items-center justify-between gap-1">
                <span className={`text-[11px] font-semibold tracking-wide truncate ${
                  isWhite ? "text-slate-500" : "text-slate-400"
                }`}>
                  {cat.title}
                </span>
                <span className={`text-[10px] font-semibold tabular-nums ${
                  isWhite ? "text-slate-400" : "text-slate-500"
                }`}>
                  {cat.items.length}
                </span>
              </div>

              <div className="space-y-0.5">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isMenuItemActive(item.id);
                  const isEliteItem = ELITE_TEACHER_MENU_IDS.has(item.id);
                  const isEliteLocked = isEliteItem && !isSchoolElite;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNavView(item.id)}
                      title={isEliteItem ? (isEliteLocked ? `${item.label} — Elite Plan Feature` : `${item.label} — Elite Feature`) : item.desc}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors cursor-pointer relative ${
                        isActive
                          ? "bg-indigo-600 text-white font-semibold shadow-xs"
                          : isWhite
                          ? "text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
                          : "text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? "text-white"
                          : isWhite
                          ? "text-slate-500"
                          : "text-slate-400"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-tight truncate">{item.label}</p>
                      </div>
                      {isEliteItem && !isActive && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0 ${
                          isEliteLocked
                            ? isWhite
                              ? "bg-slate-100 text-slate-600"
                              : "bg-slate-800 text-slate-400"
                            : isWhite
                            ? "bg-amber-50 text-amber-700"
                            : "bg-amber-500/20 text-amber-300"
                        }`}>
                          {isEliteLocked ? <Lock className="w-2.5 h-2.5" /> : <Crown className="w-2.5 h-2.5" />}
                          <span>ELITE</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Sidebar Action Footer */}
        <div className={`p-2.5 border-t space-y-2 shrink-0 ${
          isWhite ? "border-slate-200 bg-slate-50/80" : isBlack ? "border-zinc-800 bg-zinc-950" : "border-slate-800 bg-slate-950/70"
        }`}>
          {onOpenPlatformContent && (
            <button
              type="button"
              onClick={handleExploreFullApp}
              className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 group cursor-pointer ${
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
                  <p className={`text-xs font-bold truncate ${isWhite ? "text-slate-900" : "text-white"}`}>
                    Explore Full NSTA App
                  </p>
                  <p className={`text-[10px] font-medium truncate ${isWhite ? "text-indigo-700" : "text-indigo-300/80"}`}>
                    53+ Books, MCQs &amp; Online Test
                  </p>
                </div>
              </div>
              <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isWhite ? "text-indigo-600" : "text-indigo-400"}`} />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSelectNavView("profile")}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer ${
              isWhite
                ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-emerald-300"
            }`}
            title="प्रोफाइल व अकाउंट रिकवरी खोलें"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold truncate">{teacherName}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>
          <button
            type="button"
            onClick={handlePerformLogout}
            className={`w-full py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isWhite
                ? "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700"
                : "bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300 hover:text-rose-100"
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Teacher Logout</span>
          </button>
        </div>
      </aside>
    );
  };

  // ── MOBILE SLIDE-OUT LEFT DRAWER ────
  const renderMobileSidebarDrawer = () => {
    const displaySchoolLogo = school ? getSavedSchoolLogo(school.logoUrl, schoolId) : "";
    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";

    return (
      <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer"
          onClick={() => {
            captureActiveMenuScrollRef.current();
            setIsSidebarOpen(false);
          }}
        />
        <div className={`relative w-[260px] max-w-[82vw] flex flex-col h-full h-[100dvh] shadow-2xl z-10 overflow-hidden animate-in slide-in-from-left duration-250 border-r ${
          isWhite
            ? "bg-white border-slate-200 text-slate-800"
            : isBlack
            ? "bg-black border-zinc-800 text-zinc-100"
            : "bg-slate-900 border-slate-800 text-slate-100"
        }`}>
          {/* Header */}
          <div className={`p-3.5 border-b flex items-center justify-between gap-2.5 shrink-0 ${
            isWhite ? "border-slate-200 bg-slate-50/70" : isBlack ? "border-zinc-800 bg-zinc-950" : "border-slate-800 bg-slate-950/60"
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl p-1 flex items-center justify-center shrink-0 border overflow-hidden ${
                isWhite ? "bg-white border-slate-200" : "bg-white/10 border-white/15"
              }`}>
                {displaySchoolLogo ? (
                  <img src={displaySchoolLogo} alt={school?.name} className="w-full h-full object-contain rounded-lg bg-white" />
                ) : (
                  <GraduationCap className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className={`font-bold text-xs truncate ${isWhite ? "text-slate-900" : "text-white"}`}>{teacherName}</h3>
                <p className={`text-[10px] font-semibold ${isWhite ? "text-emerald-700" : "text-emerald-300"}`}>Faculty Member</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                captureActiveMenuScrollRef.current();
                setIsSidebarOpen(false);
              }}
              className={`p-1.5 rounded-lg cursor-pointer ${
                isWhite ? "bg-slate-100 hover:bg-slate-200 text-slate-600" : "bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
              }`}
              aria-label="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Categories */}
          <div
            ref={mobileMenuScrollRef}
            onScroll={(e) => {
              if (!isRestoringMenuScrollRef.current && e.currentTarget.clientHeight > 0) {
                saveMenuScrollTop(e.currentTarget.scrollTop);
              }
            }}
            className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto overscroll-contain"
          >
            {navCategories.map((cat, cIdx) => (
              <div key={`m-cat-${cIdx}`} className="space-y-1">
                <div className="px-2 py-1 flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-semibold tracking-wide truncate ${
                    isWhite ? "text-slate-500" : "text-slate-400"
                  }`}>
                    {cat.title}
                  </span>
                  <span className={`text-[10px] font-semibold tabular-nums ${
                    isWhite ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {cat.items.length}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isMenuItemActive(item.id);
                    const isEliteItem = ELITE_TEACHER_MENU_IDS.has(item.id);
                    const isEliteLocked = isEliteItem && !isSchoolElite;
                    return (
                      <button
                        key={`m-${item.id}`}
                        type="button"
                        onClick={() => handleSelectNavView(item.id)}
                        title={isEliteItem ? (isEliteLocked ? `${item.label} — Elite Plan Feature` : `${item.label} — Elite Feature`) : item.desc}
                        className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-left transition-colors cursor-pointer relative ${
                          isActive
                            ? "bg-indigo-600 text-white font-semibold shadow-xs"
                            : isWhite
                            ? "text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
                            : "text-slate-300 hover:bg-slate-800/70 hover:text-white font-medium"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? "text-white"
                            : isWhite
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-tight truncate">{item.label}</p>
                        </div>
                        {isEliteItem && !isActive && (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0 ${
                            isEliteLocked
                              ? isWhite
                                ? "bg-slate-100 text-slate-600"
                                : "bg-slate-800 text-slate-400"
                              : isWhite
                              ? "bg-amber-50 text-amber-700"
                              : "bg-amber-500/20 text-amber-300"
                          }`}>
                            {isEliteLocked ? <Lock className="w-2.5 h-2.5" /> : <Crown className="w-2.5 h-2.5" />}
                            <span>ELITE</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className={`p-2.5 border-t space-y-2 shrink-0 ${
            isWhite ? "border-slate-200 bg-slate-50/80" : isBlack ? "border-zinc-800 bg-zinc-950" : "border-slate-800 bg-slate-950/70"
          }`}>
            {onOpenPlatformContent && (
              <button
                type="button"
                onClick={() => {
                  captureActiveMenuScrollRef.current();
                  setIsSidebarOpen(false);
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
                    <p className={`text-xs font-bold truncate ${isWhite ? "text-slate-900" : "text-white"}`}>
                      Explore Full NSTA App
                    </p>
                    <p className={`text-[10px] font-medium truncate ${isWhite ? "text-indigo-700" : "text-indigo-300/80"}`}>
                      53+ Books, MCQs &amp; Online Test
                    </p>
                  </div>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isWhite ? "text-indigo-600" : "text-indigo-400"}`} />
              </button>
            )}

            <button
              type="button"
              onClick={handlePerformLogout}
              className={`w-full py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isWhite
                  ? "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700"
                  : "bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300 hover:text-rose-100"
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Teacher Logout</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── UNIFIED TOP BAR ────────────────────────────────────────────────────────
  const renderTopHeader = () => {
    const isLightHeader = appTheme === "white";
    return (
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-2xs">
        {/* Left: Mobile Menu Trigger + View Name & Navigation */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!isEffectiveLandscape && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer"
              aria-label="Open Teacher Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0 flex items-center gap-2 flex-1">
            {view !== "dashboard" && (
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}

            {/* Academic Session Badge on Left */}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-semibold shrink-0 whitespace-nowrap">
              <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="tabular-nums font-mono">
                सत्र: {activeSession?.name ? activeSession.name.replace(/Academic Session |Session /i, "") : "2026-27"}
              </span>
            </span>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white capitalize truncate">
              {view === "dashboard"
                ? "Teacher Dashboard"
                : view === "classes"
                ? "My Classes & Sections"
                : view === "all_students"
                ? "Students Directory"
                : view === "attendance"
                ? "Daily Attendance (छात्र उपस्थिति)"
                : view === "marks"
                ? "Marks & Exam Entry (परीक्षा अंक)"
                : view === "homework"
                ? "Daily Homework & Diary"
                : view === "timetable"
                ? "Timetable & Routine"
                : view === "video_lectures"
                ? "Class Video Archive"
                : view === "library"
                ? "Library Management"
                : view === "absentee"
                ? "Absentee Action Center"
                : view === "messenger_broadcast"
                ? "Class Messenger Broadcast"
                : view === "parent_queries"
                ? "Parent Helpdesk & Queries"
                : view === "leaves_desk"
                ? "Student Leaves Desk"
                : view === "question_paper_builder"
                ? "Question Paper Generator"
                : view === "ptm_scheduler"
                ? "PTM Slot Scheduler"
                : view === "growth_diary"
                ? "Student Growth & Diary"
                : view === "online_admission"
                ? "Online Student Admission"
                : view === "referrals"
                ? "10% Student Referral Incentive"
                : view === "rules_regulations"
                ? "School Rules & Regulations"
                : view === "my_leaves"
                ? "My Leave Requests"
                : view === "profile"
                ? "Teacher Profile & Recovery"
                : view.replace(/_/g, " ")}
            </h1>
          </div>
        </div>

        {/* Right: Quick Walkie + Desktop Profile Badge + 3-Dot More Controls Popup */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowWalkieModal(true)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border whitespace-nowrap ${
              !hasEliteWalkieAccess(school)
                ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                : isWalkieSchoolHoursNow
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
            title={
              hasEliteWalkieAccess(school)
                ? "School-Hour Live Walkie-Talkie"
                : "Elite Plan Only: School-Hour Walkie-Talkie"
            }
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Walkie</span>
            {!hasEliteWalkieAccess(school) && <Lock className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={() => setView("timetable")}
            className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border whitespace-nowrap ${
              view === "timetable"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
            }`}
            title="Timetable & Routine (समय सारणी खोलें)"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Routine</span>
          </button>

          <button
            type="button"
            onClick={() => setView("profile")}
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
              view === "profile"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
            }`}
            title="Teacher Profile & Account Recovery"
          >
            <User className="w-3 h-3" />
            <span>{teacherName.split(" ")[0]} (Faculty)</span>
          </button>

          {/* Hidden ScreenInfoGuideButton modal host (triggered via 3-dot popup) */}
          <ScreenInfoGuideButton portal="teacher" screenKey={view} tone={appTheme} className="hidden" />

          {/* 3-Dot More Controls Button & Popup */}
          <div ref={topMoreMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowTopMoreMenu((prev) => !prev)}
              className={`min-w-[38px] min-h-[38px] rounded-xl border flex items-center justify-center transition cursor-pointer active:scale-95 ${
                showTopMoreMenu
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
              title="More Controls (Theme, Language, Routine, Guide)"
              aria-label="Open Top Controls Menu"
              aria-expanded={showTopMoreMenu}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showTopMoreMenu && (
              <div
                className={`absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border shadow-2xl z-[120] p-3 space-y-3 ${
                  isLightHeader
                    ? "bg-white border-slate-200 text-slate-900"
                    : appTheme === "black"
                    ? "bg-neutral-950 border-neutral-800 text-white"
                    : "bg-slate-900 border-slate-700 text-white"
                }`}
                role="menu"
                aria-label="Teacher Header Controls"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-black tracking-tight">Quick Controls &amp; Settings</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Theme, भाषा, Routine, Screen View &amp; Guide
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTopMoreMenu(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Close Controls Menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Theme Switcher */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    App Theme (थीम)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => applyTeacherTheme("white")}
                      className={`px-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        appTheme === "white"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>White</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTeacherTheme("black")}
                      className={`px-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        appTheme === "black"
                          ? "bg-zinc-900 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Black</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTeacherTheme("current")}
                      className={`px-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        appTheme === "current"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Blue</span>
                    </button>
                  </div>
                </div>

                {/* 2. Language Toggle */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Language (भाषा चुनें)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAppLang("HI")}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        appLang === "HI"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>हिंदी</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppLang("EN")}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        appLang === "EN"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>English</span>
                    </button>
                  </div>
                </div>

                {/* 3. Action Buttons */}
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTopMoreMenu(false);
                      setView("timetable");
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer border ${
                      view === "timetable"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      <span>Timetable &amp; Routine (समय सारणी)</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTopMoreMenu(false);
                      handleToggleScreenRotate();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer border bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      {isEffectiveLandscape ? (
                        <Laptop className="w-4 h-4 text-sky-500" />
                      ) : (
                        <Smartphone className="w-4 h-4 text-sky-500" />
                      )}
                      <span>
                        {isEffectiveLandscape
                          ? "Mobile Portrait Mode me Badlein"
                          : "Laptop / Desktop Mode me Badlein"}
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                      {isEffectiveLandscape ? "Desktop" : "Mobile"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTopMoreMenu(false);
                      window.dispatchEvent(new CustomEvent("nst-open-screen-guide"));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer border bg-sky-50/70 hover:bg-sky-100 dark:bg-sky-950/35 dark:hover:bg-sky-900/45 border-sky-200 dark:border-sky-800/60 text-sky-800 dark:text-sky-200"
                  >
                    <span className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>Page Guide &amp; Help (इस पेज की जानकारी)</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTopMoreMenu(false);
                      setView("profile");
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer border ${
                      view === "profile"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:hover:bg-emerald-900/45 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{teacherName} (Faculty Profile)</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  };

  // ── VIEW CONTENT DISPATCHER ────────────────────────────────────────────────
  const renderViewContent = () => {
    if (!isTeacherViewAllowed(view)) {
      return (
        <div className="max-w-lg mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            अधिकार प्रतिबंधित (Access Restricted)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            यह मॉड्यूल School Admin द्वारा आपके Role &amp; Permissions सेटिंग से बंद रखा गया है। आवश्यकता होने पर Admin से Roles &amp; Permissions में इसे चालू करने का अनुरोध करें।
          </p>
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
          >
            Teacher Dashboard पर लौटें
          </button>
        </div>
      );
    }

    // 0. Teacher Profile & Account Recovery View
    if (view === "profile") {
      const tUid = currentTeacher?.id || teacherId;
      return (
        <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-200">
          {/* Teacher Identity Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-sm">
                  {(currentTeacher?.name || teacherName || "T").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                      {currentTeacher?.name || teacherName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                      {currentTeacher?.designation || "Faculty Member"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {school?.name || "School"} {currentTeacher?.assignedClassName ? `• Class: ${currentTeacher.assignedClassName}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMySignatureModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{currentTeacher?.signatureUrl ? "Update Sign" : "Add Sign"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMyAppointmentLetter(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Appointment Letter</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Teacher ID</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{tUid}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Subject / Dept</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {Array.isArray(currentTeacher?.subjects) && currentTeacher.subjects.length > 0
                    ? currentTeacher.subjects.join(", ")
                    : "All Subjects"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Registered Phone</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentTeacher?.phone || "Not set"}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <EyeOff className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Parent Caller ID se mera number chhupayein
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentTeacher?.hidePhoneFromParentCallerId
                      ? "Abhi chhupa hua hai — Parents ke app me aapka number sync nahi hoga."
                      : "Abhi chalu hai — School call par Parents ko aapka verified card dikhega."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nextVal = !currentTeacher?.hidePhoneFromParentCallerId;
                  setCurrentTeacher((prev) => (prev ? { ...prev, hidePhoneFromParentCallerId: nextVal } : prev));
                  setTeachersList((prev) =>
                    prev.map((item) => (item.id === tUid ? { ...item, hidePhoneFromParentCallerId: nextVal } : item))
                  );
                  if (schoolId && tUid) {
                    try {
                      await updateTeacher(schoolId, tUid, { hidePhoneFromParentCallerId: nextVal });
                      toast.success(
                        nextVal
                          ? "Privacy On: Aapka number Parents ke Caller ID se hata diya gaya."
                          : "Privacy Off: Parents ko aapka verified call card dikhega."
                      );
                    } catch {
                      toast.error("Privacy setting save nahi ho saki.");
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                  currentTeacher?.hidePhoneFromParentCallerId
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                {currentTeacher?.hidePhoneFromParentCallerId ? "Hidden (On)" : "Visible (Off)"}
              </button>
            </div>
          </div>

          {/* Account Recovery Card & Modal */}
          <AccountRecoveryCard
            uid={tUid}
            role="TEACHER"
            name={currentTeacher?.name || teacherName}
            displayId={tUid}
            schoolId={schoolId}
            schoolName={school?.name}
            initialMobile={currentTeacher?.phone || ""}
            initialEmail={currentTeacher?.email || ""}
            initialRecoveryPassword={(currentTeacher as any)?.recoveryPassword || ""}
            initialSecurityQuestion={(currentTeacher as any)?.securityQuestion || ""}
            initialSecurityAnswer={(currentTeacher as any)?.securityAnswer || ""}
            theme={appTheme}
            extraSync={async (payload) => {
              if (schoolId && tUid) {
                const patch: any = {
                  recoveryMobile: payload.mobile,
                  recoveryEmail: payload.email,
                  recoveryPassword: payload.recoveryPassword,
                  securityQuestion: payload.securityQuestion,
                  securityAnswer: payload.securityAnswer,
                };
                if (payload.mobile && !currentTeacher?.phone) patch.phone = payload.mobile;
                if (payload.email) patch.email = payload.email;
                await updateTeacher(schoolId, tUid, patch).catch(() => {});
              }
            }}
          />

          <CallerIdSettingsCard
            mode="staff"
            schoolId={school?.id || schoolId}
            schoolName={school?.name}
            isEliteLocked={!hasEliteFeeTagadaAccess(school)}
          />
        </div>
      );
    }

    // 1. Absentee Action Center
    if (view === "absentee") {
      return (
        <AbsenteeActionPage
          schoolId={schoolId}
          schoolName={school?.name}
          classes={scopedClasses}
          currentRole="TEACHER"
          currentUserId={teacherId}
          currentUserName={teacherName}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // 2. Attendance Manager
    if (view === "attendance") {
      const activeClass = (selectedClass && scopedClassIds.has(selectedClass.id) ? selectedClass : scopedClasses[0]) || null;
      if (!activeClass) {
        return (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">कोई आवंटित कक्षा उपलब्ध नहीं है</h3>
            <p className="text-xs text-slate-500 mt-1">Attendance लेने के लिए कृपया Admin से Roles &amp; Permissions में कक्षा आवंटित कराएं।</p>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          {scopedClasses.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-slate-500 shrink-0">Class chunein:</span>
              {scopedClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeClass.id === cls.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
          <AttendanceManager
            schoolId={schoolId}
            school={school}
            classId={activeClass.id}
            className={activeClass.name}
            teacherId={teacherId}
            onBack={() => setView("dashboard")}
          />
        </div>
      );
    }

    // 3. Marks Manager
    if (view === "marks") {
      const activeClass = (selectedClass && scopedClassIds.has(selectedClass.id) ? selectedClass : scopedClasses[0]) || null;
      if (!activeClass) {
        return (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <Edit3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">कोई आवंटित कक्षा उपलब्ध नहीं है</h3>
            <p className="text-xs text-slate-500 mt-1">Marks entry के लिए Admin से कक्षा आवंटित कराएं।</p>
          </div>
        );
      }
      const lockSubjects = Boolean(!teacherPerms.canEnterAllSubjectsMarks && currentTeacher?.subjects && currentTeacher.subjects.length > 0);
      return (
        <div className="space-y-4">
          {scopedClasses.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-slate-500 shrink-0">Class chunein:</span>
              {scopedClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeClass.id === cls.id
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
          <MarksManager
            schoolId={schoolId}
            classId={activeClass.id}
            className={activeClass.name}
            sessionId={activeSession?.id || ""}
            teacherId={teacherId}
            subjectId={selectedSubject?.id}
            subjectName={selectedSubject?.name}
            allowedSubjectNames={lockSubjects ? currentTeacher?.subjects : undefined}
            lockToAssignedSubjects={lockSubjects}
            onBack={() => setView("dashboard")}
          />
        </div>
      );
    }

    // 4. Content Manager
    if (view === "content_manage" && selectedClass && selectedSubject) {
      return (
        <ContentManager
          schoolId={schoolId}
          sessionId={activeSession?.id || ""}
          classId={selectedClass.id}
          subjectId={selectedSubject.id}
          subjectName={selectedSubject.name}
          className={selectedClass.name}
          authorId={teacherId}
          subscription={school?.subscription || { reading: true, writing: true, pdf: true, mcq: true }}
          onBack={() => setView("subjects")}
          onOpenLesson={(lesson, mode) => {
            setSelectedLesson(lesson);
            setSmartMode(mode);
            setView("smart_class");
          }}
        />
      );
    }

    // 5. Timetable Manager
    if (view === "timetable") {
      return (
        <TimetableManager
          school={school!}
          classes={classes}
          subjects={allSubjects}
          teachers={[{ id: teacherId, name: teacherName, schoolId } as any]}
          activeSession={activeSession}
          isTeacher={true}
          currentTeacherId={teacherId}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // 6. Classroom Video Archive
    if (view === "video_lectures") {
      return (
        <LazyPanelBoundary title="Classroom Videos">
          <ClassroomVideoArchive
            school={school!}
            classes={classes}
            subjects={allSubjects}
            teachers={[{ id: teacherId, name: teacherName, schoolId } as any]}
            activeSession={activeSession}
            currentUserRole="TEACHER"
            currentTeacherName={teacherName}
            currentTeacherId={teacherId}
            onBack={() => setView("dashboard")}
          />
        </LazyPanelBoundary>
      );
    }

    // Class 6-12 Notes Manager
    if (view === "class_notes_manager") {
      return (
        <ClassCurriculumNotesManager
          schoolId={schoolId}
          schoolName={school?.name}
          isSuperAdmin={false}
          isElite={isSchoolEliteCurriculum(school)}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // School Live Study Room
    if (view === "school_study_room") {
      return (
        <LazyPanelBoundary title="Live Study Room">
          <GroupStudyModal
            isOpen={true}
            onClose={() => setView("dashboard")}
            user={{
              id: teacherId,
              uid: teacherId,
              name: teacherName,
              role: "TEACHER",
              isSchoolHost: true,
              schoolId: school!.id,
              schoolName: school?.name || "School",
              subscriptionLevel: "ULTRA"
            }}
            tierTheme={{ primary: '#4f46e5' }}
            isSchoolHost={true}
            schoolId={school!.id}
            schoolName={school?.name}
            schoolClasses={classes}
          />
        </LazyPanelBoundary>
      );
    }

    // 7. Homework Manager
    if (view === "homework") {
      return (
        <HomeworkManager
          school={school!}
          classes={classes}
          subjects={allSubjects}
          teachers={[{ id: teacherId, name: teacherName, schoolId } as any]}
          currentRole="TEACHER"
          currentTeacherId={teacherId}
          currentTeacherName={teacherName}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // 8. Library Manager
    if (view === "library") {
      return (
        <LibraryManager
          school={school!}
          students={allStudents}
          teachers={[{ id: teacherId, name: teacherName, schoolId } as any]}
          classes={classes}
          isAdmin={true}
          currentTeacherId={teacherId}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // 9. Parent Queries Helpdesk
    if (view === "parent_queries") {
      return (
        <ParentTeacherQueryManager
          school={school!}
          students={allStudents}
          teachers={[{ id: teacherId, name: teacherName, schoolId } as any]}
          classes={classes}
          currentUserRole="TEACHER"
          currentUserName={teacherName}
          currentUserId={teacherId}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // 10. Messenger Broadcast Studio
    if (view === "messenger_broadcast") {
      return (
        <div
          className={`fixed ${
            isEffectiveLandscape
              ? "inset-0"
              : "top-0 inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] md:inset-0"
          } z-30 bg-slate-950 flex flex-col overflow-hidden`}
        >
          <LazyPanelBoundary title="NSTA Messenger">
            <NstaMessengerSuite
              school={school!}
              classes={classes}
              students={allStudents}
              teachers={[{ id: teacherId, name: teacherName, schoolId } as any]}
              currentUserId={teacherId}
              currentUserName={teacherName}
              currentUserRole="TEACHER"
              onBack={() => setView("dashboard")}
            />
          </LazyPanelBoundary>
        </div>
      );
    }

    // 11. Community Feed
    if (view === "community") {
      return (
        <SchoolCommunityFeed
          schoolId={schoolId}
          schoolName={school?.name || "School"}
          currentUserId={teacherId}
          currentUserName={teacherName}
          currentUserRole="TEACHER"
          classes={classes}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // 12. Student Leaves Desk
    if (view === "leaves_desk") {
      return (
        <div className="space-y-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>
          <ParentLeaveManager school={school} mode="TEACHER_ADMIN" />
        </div>
      );
    }

    // 13. Question Paper & Blueprint Builder
    if (view === "question_paper_builder") {
      return (
        <div className="space-y-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>
          <LazyPanelBoundary title="Question Paper Builder">
            <QuestionPaperBuilder school={school} activeSession={activeSession} />
          </LazyPanelBoundary>
        </div>
      );
    }

    // 14. PTM Slot Scheduler
    if (view === "ptm_scheduler") {
      return (
        <PtmSchedulerModal
          isOpen={true}
          onClose={() => setView("dashboard")}
          school={school}
          activeSession={activeSession}
          mode="ADMIN_TEACHER"
        />
      );
    }

    // 14.5 Student Growth, Diary & 6-Skills Hub
    if (view === "growth_diary" && school) {
      return (
        <TeacherAdminGrowthHub
          school={school}
          classes={classes}
          students={allStudents}
          actorName={teacherName || "Teacher"}
          canBroadcastEmergency={false}
          onBack={() => setView("dashboard")}
        />
      );
    }

    if (view === "rules_regulations") {
      return (
        <TeacherRulesRegulationsView
          school={school}
          canEdit={false}
          currentTeacherId={teacherId}
          currentTeacherName={teacherName}
          currentTeacherRole={currentTeacher?.designation || "Teacher"}
          teacherSignatureUrl={currentTeacher?.signatureUrl}
          onBack={() => setView("dashboard")}
        />
      );
    }

    // Teacher Self Leave Application View (Teacher -> Admin Leave Requests)
    if (view === "my_leaves") {
      const pendingCount = myStaffLeaves.filter((l) => l.status === "pending").length;
      const approvedCount = myStaffLeaves.filter((l) => l.status === "approved").length;
      const rejectedCount = myStaffLeaves.filter((l) => l.status === "rejected").length;
      const calcFrom = new Date(teacherLeaveForm.fromDate || todayStr()).getTime();
      const calcTo = new Date(teacherLeaveForm.toDate || teacherLeaveForm.fromDate || todayStr()).getTime();
      const previewDays =
        Number.isFinite(calcFrom) && Number.isFinite(calcTo) && calcTo >= calcFrom
          ? Math.max(1, Math.round((calcTo - calcFrom) / 86400000) + 1)
          : 1;

      return (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Pending: {pendingCount}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Approved: {approvedCount}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                Rejected: {rejectedCount}
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSubmitTeacherLeave}
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  छुट्टी के लिए आवेदन भेजें (Send Leave Request to Admin)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  आपका आवेदन सीधे स्कूल एडमिन / प्रिंसिपल के <strong>Leave Requests</strong> पेज पर दिखेगा।
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                {previewDays} दिन की छुट्टी
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  छुट्टी का प्रकार (Leave Type)
                </label>
                <select
                  value={teacherLeaveForm.leaveType}
                  onChange={(e) =>
                    setTeacherLeaveForm((prev) => ({
                      ...prev,
                      leaveType: e.target.value as StaffLeave["leaveType"],
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <option value="casual">Casual Leave (CL)</option>
                  <option value="sick">Medical / Sick Leave</option>
                  <option value="earned">Earned Leave (EL)</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  कब से (From Date)
                </label>
                <input
                  type="date"
                  value={teacherLeaveForm.fromDate}
                  onChange={(e) =>
                    setTeacherLeaveForm((prev) => ({ ...prev, fromDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  कब तक (To Date)
                </label>
                <input
                  type="date"
                  value={teacherLeaveForm.toDate}
                  min={teacherLeaveForm.fromDate}
                  onChange={(e) =>
                    setTeacherLeaveForm((prev) => ({ ...prev, toDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                छुट्टी का कारण / संदेश (Reason &amp; Message for Admin)
              </label>
              <textarea
                rows={3}
                value={teacherLeaveForm.reason}
                onChange={(e) =>
                  setTeacherLeaveForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="उदाहरण: घर में आवश्यक कार्य / बुखार के कारण 2 दिन की छुट्टी चाहिए..."
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                शिक्षक: <strong>{currentTeacher?.name || teacherName}</strong> ({currentTeacher?.designation || "Teacher"})
              </span>
              <button
                type="submit"
                disabled={submittingTeacherLeave}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black shadow cursor-pointer transition"
              >
                {submittingTeacherLeave ? "भेजा जा रहा है..." : "Admin को Leave Request भेजें"}
              </button>
            </div>
          </form>

          {/* My Sent Leave Requests List */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">
              मेरे भेजे गए आवेदन ({myStaffLeaves.length})
            </h3>
            {myStaffLeaves.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500 border border-slate-200 dark:border-slate-700">
                अभी तक कोई छुट्टी आवेदन नहीं भेजा गया है। ऊपर फॉर्म भरकर Admin को आवेदन भेजें।
              </div>
            ) : (
              myStaffLeaves.map((l) => (
                <div
                  key={l.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {l.leaveType}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                        {l.fromDate} → {l.toDate} ({l.days} दिन)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{l.reason}</p>
                    {l.remarks && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-300 font-semibold">
                        Admin Note: {l.remarks}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 ${
                      l.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : l.status === "rejected"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    }`}
                  >
                    {l.status === "approved"
                      ? "✓ Approved"
                      : l.status === "rejected"
                      ? "✕ Rejected"
                      : "⏳ Pending Approval"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // Online Student Admission View (Teachers can register/admit new students)
    if (view === "online_admission") {
      if (!school) {
        return (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">School details load ho rahi hain...</p>
          </div>
        );
      }
      return (
        <LazyPanelBoundary title="Online Admission">
          <OnlineAdmissionManager
            school={school}
            classes={classes}
            sessions={sessions}
            activeSession={activeSession}
            isAdmin={true}
            viewMode="admissions_only"
            initialTab="new_form"
            onBack={() => setView("dashboard")}
          />
        </LazyPanelBoundary>
      );
    }

    // Delegated UPI / BharatPe Screenshot Verification Desk (Admin-assigned Teachers)
    if (view === "upi_verification") {
      if (!isUpiReceiver) {
        return (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
            <Lock className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              UPI Verification Access Restricted
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Admin द्वारा BharatPe / UPI अलर्ट प्राप्त करने के लिए चुने गए शिक्षक ही इस डेस्क को देख सकते हैं।
            </p>
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
            >
              Dashboard पर लौटें
            </button>
          </div>
        );
      }
      return (
        <div className="max-w-4xl mx-auto">
          <PendingUpiApprovalsPanel
            schoolId={schoolId}
            proofs={upiProofs}
            approverName={currentTeacher?.name || teacherName}
            approverRole="teacher"
            approverId={teacherId}
            isAdmin={false}
            school={school}
            onClose={() => setView("dashboard")}
            onApprovedReceipt={(approvedFee) => {
              setSchoolFees((prev) => {
                const next = prev.filter(
                  (f) => !(f.studentId === approvedFee.studentId && f.month === approvedFee.month)
                );
                return [approvedFee, ...next];
              });
              setApprovedUpiReceiptFee(approvedFee);
            }}
          />
        </div>
      );
    }

    // 12. 10% Referral Incentive View (Permission protected: only shown if Admin enabled)
    if (view === "referrals") {
      if (!isReferralEligible) {
        return (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md mx-auto text-center border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto text-2xl">
              🔒
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              10% Referral Incentive Feature
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              यह सुविधा केवल स्कूल एडमिन द्वारा अनुमति प्राप्त शिक्षकों के लिए उपलब्ध है। यदि आपको रेफरल इंसेंटिव का लाभ चाहिए तो कृपया अपने स्कूल एडमिन/प्रिंसिपल से संपर्क करें।
            </p>
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition shadow-sm"
            >
              ← Back to Teacher Dashboard
            </button>
          </div>
        );
      }
      return (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                My Student Admissions &amp; {referralSettings?.defaultCommissionPct ?? 10}% Referral Ledger
              </h2>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                Policy: {formatReferralDurationLabel(referralSettings?.commissionDuration || "1_year")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Aapke reference se aane wale har student ki jama (paid) fee par {referralSettings?.defaultCommissionPct ?? 10}% incentive banta hai.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>My Admissions</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white mt-1">
                {myReferralSummary.studentsCount}
              </p>
              <span className="text-[10px] text-slate-400">Active students</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Paid Fee</span>
                <IndianRupee className="w-4 h-4 text-teal-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-teal-600 dark:text-teal-400 mt-1">
                ₹{myReferralSummary.totalEligibleFeeCollected.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-slate-400">Excl. Bus fee</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Earned Bonus</span>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{myReferralSummary.totalEarnedCommission.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                Pending: ₹{myReferralSummary.totalPendingCommission.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Balance Due</span>
                <Wallet className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                ₹{myReferralSummary.balancePayable.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] text-slate-400 tabular-nums">
                Received: ₹{myReferralSummary.totalPaidOut.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Referred Students Breakdown
              </h3>
              <span className="text-[11px] font-bold tabular-nums text-slate-400">
                {myReferralSummary.students.length} records
              </span>
            </div>

            {myReferralSummary.students.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Abhi aapke naam se koi student referral darj nahi hai.
                </p>
                <p>
                  Naye admission ke samay Admin ya Online Admission Form mein apna naam &ldquo;Referred By Teacher&rdquo; mein select karwayein.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300">
                    <tr>
                      <th className="p-3 font-bold">Student</th>
                      <th className="p-3 font-bold">Class</th>
                      <th className="p-3 font-bold text-right">Paid Fee</th>
                      <th className="p-3 font-bold text-right">Earned ({referralSettings?.defaultCommissionPct ?? 10}%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 tabular-nums">
                    {myReferralSummary.students.map((st) => (
                      <tr key={st.studentId}>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          <div>{st.studentName}</div>
                          <div className="text-[10px] text-slate-400">Adm #{st.admissionNo}</div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{st.className}</td>
                        <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200">
                          ₹{st.eligiblePaidExclBus.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                          ₹{st.earnedCommission.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 13. All Students Directory View
    if (view === "all_students") {
      return (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Students Directory</h2>
              <p className="text-xs text-slate-500">Total {filteredStudents.length} students found</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {teacherPerms.canAddAdmission && (
                <button
                  type="button"
                  onClick={() => setShowDirectAdmissionModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  title="छात्र को सीधे जोड़ें (3-Term Payment Option के साथ)"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Direct Admission</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFaceStudio(true)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer ${
                  hasFaceAttendanceAccess(school)
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40"
                }`}
                title={hasFaceAttendanceAccess(school) ? "लाइव फेस आईडी" : "👑 Elite Plan Only"}
              >
                {hasFaceAttendanceAccess(school) ? <Camera className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                <span>📷 लाइव फेस आईडी</span>
                {!hasFaceAttendanceAccess(school) && (
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950 text-[9px] font-black">👑 Elite</span>
                )}
              </button>
              <button
                onClick={() => setView("classes")}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition cursor-pointer"
              >
                View by Class
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, roll no, admission no, or mobile..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-blue-500 transition shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedClassFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                selectedClassFilter === "ALL"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              }`}
            >
              All Classes ({scopedStudents.length})
            </button>
            {(teacherPerms.canViewAllStudents ? classes : scopedClasses).map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassFilter(cls.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedClassFilter === cls.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredStudents.slice(0, 100).map((st) => (
              <div
                key={st.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-400 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                    {st.rollNo || "•"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{st.name}</p>
                      <span className="px-2 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        {st.className || classes.find((c) => c.id === st.classId)?.name || "Class"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                      <span>Adm: <strong className="text-slate-600 dark:text-slate-300">{st.admissionNo}</strong></span>
                      {st.fatherName && <span>Father: <strong className="text-slate-600 dark:text-slate-300">{st.fatherName}</strong></span>}
                      {st.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{st.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {teacherPerms.canMarkAttendance && (
                    <button
                      onClick={() => {
                        const matchedClass = classes.find((c) => c.id === st.classId || c.name === st.className) || scopedClasses[0] || classes[0];
                        if (matchedClass) {
                          setSelectedClass(matchedClass);
                          setView("attendance");
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-300 font-bold text-xs border border-green-200 dark:border-green-800 hover:bg-green-100 transition cursor-pointer"
                    >
                      Attendance
                    </button>
                  )}
                  {teacherPerms.canEnterMarks && (
                    <button
                      onClick={() => {
                        const matchedClass = classes.find((c) => c.id === st.classId || c.name === st.className) || scopedClasses[0] || classes[0];
                        if (matchedClass) {
                          setSelectedClass(matchedClass);
                          setView("marks");
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition cursor-pointer"
                    >
                      Marks
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 14. Classes View
    if (view === "classes") {
      return (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">Select a Class to Manage:</p>
            <button
              onClick={() => setView("all_students")}
              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>All Students ({scopedStudents.length})</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {scopedClasses.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800 dark:text-white">अभी कोई कक्षा आवंटित नहीं है</p>
                <p className="text-xs text-slate-500 mt-1">Admin → Roles &amp; Permissions से आपकी कक्षाएं/विषय सेट करवाएं।</p>
              </div>
            ) : sortSchoolClasses(scopedClasses).map((cls) => {
              const count = studentCountByClass[cls.id] || 0;
              return (
                <div
                  key={cls.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-400 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-black text-lg flex items-center justify-center shrink-0 border border-emerald-500/20">
                      {cls.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-white">{cls.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{count} Enrolled Students</span>
                        {cls.section && <span>• Section {cls.section}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {teacherPerms.canMarkAttendance && (
                      <button
                        onClick={() => {
                          setSelectedClass(cls);
                          setView("attendance");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition cursor-pointer"
                      >
                        Attendance
                      </button>
                    )}
                    {teacherPerms.canEnterMarks && (
                      <button
                        onClick={() => {
                          setSelectedClass(cls);
                          setView("marks");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 text-xs font-bold transition cursor-pointer"
                      >
                        Marks
                      </button>
                    )}
                    {teacherPerms.canManageNotesAndVideos && (
                      <button
                        onClick={() => {
                          setSelectedClass(cls);
                          setView("subjects");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-sm"
                      >
                        Books &amp; Smart Class →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 15. Subjects View
    if (view === "subjects") {
      const activeClass = selectedClass || scopedClasses[0] || null;
      if (!activeClass) {
        return (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Pehle Class Select Karein</h3>
            <button
              onClick={() => setView("classes")}
              className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
            >
              Go to Classes
            </button>
          </div>
        );
      }
      return (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {activeClass.name} — Subjects &amp; Curriculum Books
              </h2>
              <p className="text-xs text-slate-500">Digital chapters, reading and smart writing board</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddBooksModal(true);
                setSelectedBooksQueue([]);
                setCustomBooksInput("");
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer self-start"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Books</span>
            </button>
          </div>

          {booksFeedback && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200">
              {booksFeedback}
            </div>
          )}

          {/* Add Books Modal */}
          {showAddBooksModal && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Quick Add Subjects in {activeClass.name}
                </h3>
                <button onClick={() => setShowAddBooksModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {COMMON_BOOK_PRESETS.map((p) => {
                  const isQueued = selectedBooksQueue.includes(p.name);
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setSelectedBooksQueue((prev) =>
                          isQueued ? prev.filter((b) => b !== p.name) : [...prev, p.name]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        isQueued
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedBooksQueue.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveAllBooks}
                    disabled={savingBooks}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                  >
                    {savingBooks ? "Saving..." : `Save ${selectedBooksQueue.length} Books`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBooksQueue([])}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subjects List */}
          <div className="space-y-2.5">
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-black text-sm flex items-center justify-center shrink-0 border border-purple-200/50">
                    <Book className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-base truncate">{sub.name}</p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✓ Enrolled Book</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubject(sub);
                      setView("lessons");
                    }}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Lessons / Chapters</span>
                  </button>
                  {confirmDeleteSubjectId === sub.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub)}
                        className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSubjectId(null)}
                        className="px-2 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSubjectId(sub.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition cursor-pointer"
                      title="Delete Book"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {subjects.length === 0 && (
              <div className="text-center py-12 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="font-black text-base text-slate-700 dark:text-slate-200">
                  {activeClass.name} me abhi tak koi subject / book add nahi hai
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBooksModal(true);
                    setSelectedBooksQueue([]);
                  }}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Books Now</span>
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 16. Lessons View
    if (view === "lessons" && selectedSubject) {
      return (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">
              Lessons — <strong className="text-slate-800 dark:text-slate-100 font-bold">{selectedSubject.name}</strong>
            </p>
            <button
              onClick={() => setView("subjects")}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              ← Back to Subjects
            </button>
          </div>

          {lessons.map((lesson) => (
            <div key={lesson.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-300">{lesson.order}</span>
                </div>
                <p className="flex-1 font-bold text-slate-900 dark:text-white text-sm">{lesson.title}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {lesson.features?.readingEnabled && (
                  <button
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setSmartMode("reading");
                      setView("smart_class");
                    }}
                    className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Reading Mode
                  </button>
                )}
                {lesson.features?.writingEnabled && (
                  <button
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setSmartMode("writing");
                      setView("smart_class");
                    }}
                    className="py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Writing Mode
                  </button>
                )}
                {lesson.features?.pdfEnabled && (
                  <button
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setSmartMode("pdf");
                      setView("smart_class");
                    }}
                    className="py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF Viewer
                  </button>
                )}
                {lesson.features?.mcqEnabled && (
                  <button
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setSmartMode("mcq");
                      setView("smart_class");
                    }}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Live MCQs
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── DEFAULT: HOME DASHBOARD VIEW ─────────────────────────────────────────
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <ApkUpdateBanner school={school} />
        <CallSetupChecklistBanner mode="staff" schoolName={school?.name} />
        {/* Active Role & Scope Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Active Role:</strong>{" "}
              {teacherAccess.rolePreset === "class_teacher"
                ? "Class Teacher"
                : teacherAccess.rolePreset === "subject_teacher"
                ? "Subject Teacher"
                : teacherAccess.rolePreset === "coordinator"
                ? "Coordinator / Full Access"
                : "Custom Teacher Role"}
              {" · "}
              <span className="text-slate-500 dark:text-slate-400">
                {teacherAccess.accessScope === "full_school"
                  ? "पूरा स्कूल डेटा"
                  : teacherAccess.accessScope === "assigned_subjects"
                  ? `विषय: ${currentTeacher?.subjects?.join(", ") || "All"}`
                  : `कक्षाएं: ${scopedClasses.map((c) => c.name).join(", ") || "None"}`}
              </span>
            </span>
          </div>
          {!teacherPerms.canEnterAllSubjectsMarks && currentTeacher?.subjects && currentTeacher.subjects.length > 0 && (
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              Marks Entry: केवल आपके आवंटित विषय
            </span>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setView("classes")}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">My Classes</span>
              <BookOpen className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">{scopedClasses.length || 0}</p>
            <span className="text-[10px] text-slate-400">Allowed class sections</span>
          </div>

          <div
            onClick={() => setView("all_students")}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-indigo-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Students</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">{scopedStudents.length || 0}</p>
            <span className="text-[10px] text-slate-400">{teacherPerms.canViewAllStudents ? "School total" : "In my classes"}</span>
          </div>

          <div
            onClick={() => setView("classes")}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-purple-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Subjects</span>
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400 mt-1">
              {allSubjects.length}
            </p>
            <span className="text-[10px] text-slate-400">Curriculum books</span>
          </div>

          <div
            onClick={() => setView("community")}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-rose-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Community</span>
              <Megaphone className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">Live</p>
            <span className="text-[10px] text-slate-400">Photos, Videos &amp; Notices</span>
          </div>
        </div>

        {/* ── TODAY'S PERSONAL PERIOD-WISE ROUTINE & TEACHING DIARY ── */}
        <HomeDailyRoutineWidget
          schoolId={schoolId}
          role="TEACHER"
          classes={classes}
          subjects={allSubjects}
          currentTeacherId={teacherId}
          currentTeacherName={teacherName}
          onOpenFullTimetable={() => setView("timetable")}
        />

        {/* ── TODAY'S BIRTHDAYS (TEACHER NO-PUNISHMENT ALERT) ── */}
        {todaysTeacherBirthdays.length > 0 && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/50 flex items-center justify-center shrink-0">
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                    <ShieldCheck className="w-3 h-3" />
                    <span>No Punishment Policy</span>
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
                    आज {todaysTeacherBirthdays.length} छात्र का जन्मदिन है
                  </span>
                </div>
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-1">
                  आज जन्मदिन: {todaysTeacherBirthdays.map((s) => s.name).join(", ")}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  शिक्षकों से अनुरोध: आज इन बच्चों को किसी भी बात पर डांटें या दंडित (punish) न करें। स्कूल की ओर से उन्हें जन्मदिन का शुभाशीर्वाद दें।
                </p>
              </div>
            </div>

            {teacherPerms.canMarkAttendance && (
              <button
                type="button"
                onClick={() => {
                  const target = selectedClass || scopedClasses[0] || null;
                  if (target) setSelectedClass(target);
                  setView("attendance");
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shrink-0 transition cursor-pointer self-start sm:self-center whitespace-nowrap"
              >
                उपस्थिति में देखें →
              </button>
            )}
          </div>
        )}

        {/* Broadcast Studio Quick Card */}
        {teacherPerms.canSendBroadcast && (
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/50 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Class Messenger &amp; Push Alerts</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50">1-Way Broadcast</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Apni class ke sabhi students/parents ko instant 1-way broadcast, homework aur notice alerts bhejein.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("messenger_broadcast")}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <span>Broadcast Studio</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* School Rules & +2 Days Bonus Policy Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  School Rules &amp; Regulations for Teachers (13 नियम)
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50">
                  +2 DAYS BONUS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                पूरा महीना पढ़ाने पर +2 दिन बोनस • सैलरी 15–20 तारीख • 1st Child Tuition Free • Mobile Account Office में जमा • Zero Punishment
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMySignatureModal(true)}
              className={`py-2 px-3 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                currentTeacher?.signatureUrl
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{currentTeacher?.signatureUrl ? "My Sign (Saved)" : "My Sign जोड़ें"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMyAppointmentLetter(true)}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Appointment Letter</span>
            </button>
            <button
              type="button"
              onClick={() => setView("rules_regulations")}
              className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>सभी 13 नियम देखें</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Launchpad Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Teacher Actions &amp; Modules
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Real-Time Sync Active
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Mark Attendance */}
            {teacherPerms.canMarkAttendance && (
              <button
                type="button"
                onClick={() => {
                  const target = selectedClass || scopedClasses[0] || null;
                  if (target) setSelectedClass(target);
                  setView("attendance");
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-emerald-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Mark Attendance</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Present, Absent &amp; Late</p>
                </div>
              </button>
            )}

            {/* Live Face ID Studio (ELITE) */}
            {teacherPerms.canMarkAttendance && (
              <button
                type="button"
                onClick={() => setShowFaceStudio(true)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 hover:border-emerald-500 flex flex-col justify-between gap-3 transition text-left cursor-pointer"
                title={hasFaceAttendanceAccess(school) ? "Live Face ID Studio — Elite Feature" : "Elite Plan Required"}
              >
                <div className="flex items-center justify-between w-full gap-1.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    {hasFaceAttendanceAccess(school) ? <Camera className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50 shrink-0">
                    {hasFaceAttendanceAccess(school) ? <Crown className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                    <span>ELITE</span>
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Live Face ID</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {hasFaceAttendanceAccess(school) ? "Enroll & Match Test" : "Elite Subscription Required"}
                  </p>
                </div>
              </button>
            )}

            {/* Absentee Action Center */}
            {teacherPerms.canManageAbsentee && (
              <button
                type="button"
                onClick={() => setView("absentee")}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-rose-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">1-Day &amp; 2-Day</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Absentee Center</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Push Alert &amp; Call</p>
                </div>
              </button>
            )}

            {/* Marks & Exam Entry */}
            {teacherPerms.canEnterMarks && (
              <button
                type="button"
                onClick={() => {
                  const target = selectedClass || scopedClasses[0] || null;
                  if (target) setSelectedClass(target);
                  setView("marks");
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-purple-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Exam Marks Entry</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Unit Test, Half Yearly &amp; Annual</p>
                </div>
              </button>
            )}

            {/* Daily Homework */}
            {teacherPerms.canManageHomeworkAndDiary && (
              <button
                type="button"
                onClick={() => setView("homework")}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-amber-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">DIARY</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Daily Homework</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Daily class diary &amp; notes</p>
                </div>
              </button>
            )}

            {/* Class 1-12 Notes Manager (ELITE) */}
            {teacherPerms.canManageNotesAndVideos && (
              <button
                type="button"
                onClick={() => setView("class_notes_manager")}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-emerald-500 transition text-left cursor-pointer"
                title={isSchoolElite ? "Class 1-12 Notes Manager — Elite Feature" : "Elite Plan Required"}
              >
                <div className="flex items-center justify-between w-full gap-1.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50 shrink-0">
                    {isSchoolElite ? <Crown className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                    <span>ELITE</span>
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Class 1-12 Notes</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">School Notes, MCQ &amp; PDF</p>
                </div>
              </button>
            )}

            {/* Video Archive (ELITE) */}
            {teacherPerms.canManageNotesAndVideos && (
              <button
                type="button"
                onClick={() => setView("video_lectures")}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-red-500 transition text-left cursor-pointer"
                title={isSchoolElite ? "Class Video Archive — Elite Feature" : "Elite Plan Required"}
              >
                <div className="flex items-center justify-between w-full gap-1.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                    <Youtube className="w-4 h-4" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50 shrink-0">
                    {isSchoolElite ? <Crown className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                    <span>ELITE</span>
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Video Archive</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">YouTube lecture links</p>
                </div>
              </button>
            )}

            {/* Parent Queries */}
            {teacherPerms.canMessageParents && (
              <button
                type="button"
                onClick={() => setView("parent_queries")}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-cyan-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Parent Queries &amp; Leaves</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Leaves &amp; chat queries</p>
                </div>
              </button>
            )}

            {/* Direct Student Admission (Instant Add with 3-Term Payment Plan) */}
            {teacherPerms.canAddAdmission && (
              <button
                type="button"
                onClick={() => setShowDirectAdmissionModal(true)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-emerald-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Direct Add
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Direct Admission</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">सीधा दाखिला · 3-Term Payment</p>
                </div>
              </button>
            )}

            {/* My Leave Requests (Teacher -> Admin) */}
            <button
              type="button"
              onClick={() => setView("my_leaves")}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-indigo-500 transition text-left cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 tabular-nums">
                  {myStaffLeaves.filter((l) => l.status === "pending").length > 0
                    ? `${myStaffLeaves.filter((l) => l.status === "pending").length} PENDING`
                    : "APPLY"}
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">My Leave Requests</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Admin को छुट्टी आवेदन भेजें</p>
              </div>
            </button>

            {/* 10% Referrals (Only shown if Admin explicitly enabled for this teacher) */}
            {isReferralEligible && (
              <button
                type="button"
                onClick={() => setView("referrals")}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-purple-500 transition text-left cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 tabular-nums">
                    {myReferralSummary.studentsCount > 0
                      ? `₹${myReferralSummary.totalEarnedCommission.toLocaleString("en-IN")}`
                      : "10% BONUS"}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">10% Referral Ledger</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Student referral bonus</p>
                </div>
              </button>
            )}
            {/* My Profile & Account Recovery */}
            <button
              type="button"
              onClick={() => setView("profile")}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-amber-500 transition text-left cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  RECOVERY
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">My Profile &amp; Recovery</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">Mobile, Email &amp; Security Question</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── MASTER TEACHER ERP SHELL (LEFT SIDEBAR & MOBILE DRAWER) ────────────────
  const renderTeacherShell = (content: React.ReactNode) => {
    return (
      <div className={`h-screen h-[100dvh] max-h-screen overflow-hidden flex transition-colors duration-200 teacher-theme-${appTheme} app-theme-${appTheme} ${
        appTheme === "white"
          ? "bg-slate-100 text-slate-900"
          : appTheme === "black"
          ? "dark bg-black text-white"
          : "dark bg-[#08142c] text-slate-100"
      } w-full relative`}>
        {/* Left Sidebar (fixed on desktop or landscape, never scrolls with page) */}
        {renderDesktopSidebar()}

        {/* Mobile Slide-Out Drawer (only when in portrait and drawer toggled) */}
        {!isEffectiveLandscape && isSidebarOpen && renderMobileSidebarDrawer()}

        {/* Main Content Area (Independent scroll container) */}
        <div
          ref={mainContentScrollRef}
          className={`flex-1 flex flex-col min-w-0 h-screen h-[100dvh] max-h-screen overflow-y-auto ${
          isEffectiveLandscape ? "overflow-x-auto" : "overflow-x-hidden"
        }`}>
          {renderTopHeader()}
          <main className={`flex-1 p-3 sm:p-4 lg:p-6 w-full mx-auto pb-20 md:pb-8 ${
            isEffectiveLandscape ? "min-w-[980px] sm:min-w-0 max-w-7xl" : "max-w-7xl"
          }`}>
            {content}
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        {!isEffectiveLandscape && (
          <nav
            aria-label="Teacher Mobile Navigation"
            className={`md:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md transition-colors ${
              appTheme === "white"
                ? "bg-white/95 border-slate-200 text-slate-600"
                : appTheme === "black"
                ? "bg-black/95 border-zinc-800 text-zinc-400"
                : "bg-[#0b1936]/95 border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-center justify-around min-h-[56px] pb-[env(safe-area-inset-bottom)]">
              {[
                { id: "dashboard", label: "Home", icon: Home, active: view === "dashboard" },
                { id: "classes", label: "Classes", icon: BookOpen, active: view === "classes" || view === "class_students" },
                { id: "attendance", label: "Attendance", icon: ClipboardList, active: view === "attendance" },
                { id: "marks", label: "Marks", icon: Edit3, active: view === "marks" },
                { id: "messenger_broadcast", label: "Messenger", icon: MessageSquare, active: view === "messenger_broadcast" },
              ]
                .filter((item) => isTeacherViewAllowed(item.id as TeacherView))
                .map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNavView(item.id as TeacherView)}
                    className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition cursor-pointer ${
                      item.active
                        ? appTheme === "white"
                          ? "text-indigo-600"
                          : "text-indigo-400"
                        : appTheme === "white"
                        ? "text-slate-500 hover:text-slate-800"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <IconComp className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[64px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Screen rotate floating prompt if needed */}
        {showRotatePrompt && (
          <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white border border-cyan-400/40 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 max-w-sm text-center">
            <Laptop className="w-5 h-5 text-cyan-400 shrink-0" />
            <p className="text-xs font-semibold text-cyan-200">
              Laptop (Desktop) मोड सक्रिय है! आप फोन को आड़ा (Landscape) करके पूरे लैपटॉप व्यू का उपयोग कर सकते हैं।
            </p>
          </div>
        )}
      </div>
    );
  };

  const schoolExpIso = school?.subscription?.expiresAt || school?.subscription?.paidUntil;
  const isSchoolSubExpired = schoolExpIso ? new Date(schoolExpIso).getTime() <= Date.now() : false;

  if (isSchoolSubExpired && school) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-600 flex items-center justify-center text-3xl">
            🔒
          </div>
          <h2 className="text-xl font-black text-white">School Subscription Expired</h2>
          <p className="text-xs text-red-400 font-bold">Access Terminated (स्कूल मॉड्यूल लॉक हैं)</p>
          <p className="text-xs text-slate-300">
            Aapke school ({school.name}) ka subscription plan samapt ho chuka hai. Kripya school administration ya principal se contact karein.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      {renderTeacherShell(renderViewContent())}
      {school?.id && hasEliteCallAccess(school) && (
        <NstaCallPortalHost
          identity={{
            schoolId: school.id,
            schoolName: school.name,
            userId: teacherId,
            userName: currentTeacher?.name || teacherName,
            userRole: "TEACHER",
            userPhoto: currentTeacher?.photoUrl || school.logoUrl,
            teacherId,
          }}
        />
      )}
      {showFaceStudio && (
        <LazyPanelBoundary title="Face ID Studio">
          <UniversalFaceIdStudioModal
            isOpen={showFaceStudio}
            onClose={() => setShowFaceStudio(false)}
            hasFaceAccess={hasFaceAttendanceAccess(school)}
            onOpenQrScanner={() => {
              setShowFaceStudio(false);
              setView("attendance");
            }}
            schoolId={schoolId}
            students={allStudents}
            teachers={currentTeacher ? [currentTeacher] : []}
            classes={classes}
            onEnrollmentUpdated={() => {}}
          />
        </LazyPanelBoundary>
      )}
      {showMySignatureModal && (
        <TeacherSignatureModal
          isOpen={showMySignatureModal}
          onClose={() => setShowMySignatureModal(false)}
          title={`My Digital Signature — ${currentTeacher?.name || teacherName}`}
          subtitle="यह साइन आपके Appointment Letter, 13 Rules Sheet व Marksheet पर ऑटो-प्रिंट होगा"
          initialSignatureUrl={currentTeacher?.signatureUrl || ""}
          uploadPrefix={`sig_teacher_${currentTeacher?.id || teacherId}`}
          onSaveSignature={async (url) => {
            const targetId = currentTeacher?.id || teacherId;
            await updateTeacher(schoolId, targetId, { signatureUrl: url });
            setCurrentTeacher((prev) =>
              prev
                ? { ...prev, signatureUrl: url }
                : ({
                    id: targetId,
                    schoolId,
                    name: teacherName,
                    subjects: [],
                    classes: [],
                    active: true,
                    createdAt: new Date().toISOString(),
                    signatureUrl: url,
                  } as SchoolTeacher)
            );
            toast.success("आपका डिजिटल साइन सफलतापूर्वक सेव हो गया!");
          }}
        />
      )}
      {school && showMyAppointmentLetter && (
        <AppointmentLetterModal
          isOpen={showMyAppointmentLetter}
          onClose={() => setShowMyAppointmentLetter(false)}
          school={school}
          canEdit={false}
          teacher={
            currentTeacher || {
              id: teacherId,
              schoolId,
              name: teacherName,
              designation: "Teacher",
              subjects: [],
              classes: [],
              active: true,
              createdAt: new Date().toISOString(),
            }
          }
          classes={classes}
          activeSession={activeSession}
          onOpenTeacherSignaturePad={() => setShowMySignatureModal(true)}
        />
      )}
      {school && teacherPerms.canAddAdmission && showDirectAdmissionModal && (
        <DirectAdmissionModal
          isOpen={showDirectAdmissionModal}
          onClose={() => setShowDirectAdmissionModal(false)}
          school={school}
          classes={scopedClasses.length > 0 ? scopedClasses : classes}
          sessions={sessions}
          activeSession={activeSession}
          defaultClassId={selectedClass?.id || scopedClasses[0]?.id || classes[0]?.id}
          existingStudents={allStudents}
          adminUid={teacherId}
          userRole="TEACHER"
          actorName={currentTeacher?.name || teacherName}
          onSuccess={(newStudent, admFee) => {
            setShowDirectAdmissionModal(false);
            setAllStudents((prev) => [newStudent, ...prev.filter((s) => s.id !== newStudent.id)]);
            toast.success(`✅ ${newStudent.name} का सीधा दाखिला हो गया (Roll #${newStudent.rollNo})!`);
            setSelectedStudentForIdCard({
              student: newStudent,
              admissionFee: admFee || null,
            });
          }}
        />
      )}
      {school && selectedStudentForIdCard && (
        <StudentIdCardModal
          isOpen={true}
          student={selectedStudentForIdCard.student}
          school={school}
          classes={classes}
          admissionFee={selectedStudentForIdCard.admissionFee || null}
          onClose={() => setSelectedStudentForIdCard(null)}
          onOpenAdmissionForm={() => {
            const curCard = selectedStudentForIdCard;
            setSelectedStudentForIdCard(null);
            if (curCard?.student) {
              setAdmissionPrintPayload({
                student: curCard.student,
                fee: curCard.admissionFee || null,
                mode: curCard.admissionFee ? "combined" : "form_only",
              });
            }
          }}
        />
      )}
      {school && admissionPrintPayload && (
        <AdmissionFormPrintModal
          isOpen={Boolean(admissionPrintPayload)}
          onClose={() => setAdmissionPrintPayload(null)}
          school={school}
          student={admissionPrintPayload.student}
          className={
            classes.find((c) => c.id === admissionPrintPayload.student.classId)?.name ||
            admissionPrintPayload.student.className ||
            ""
          }
          feeRecord={admissionPrintPayload.fee}
          initialMode={admissionPrintPayload.mode}
          onOpenStudentIdCard={() => {
            const curPayload = admissionPrintPayload;
            setAdmissionPrintPayload(null);
            if (curPayload?.student) {
              setSelectedStudentForIdCard({
                student: curPayload.student,
                admissionFee: curPayload.fee || null,
              });
            }
          }}
        />
      )}
      {school?.id && hasEliteFeeTagadaAccess(school) && (
        <IncomingParentCallModal
          schoolId={school.id}
          schoolName={school.name}
          schoolUpiId={school.upiId}
          callerUserId={teacherId}
          callerUserName={currentTeacher?.name || teacherName}
          callerUserRole="TEACHER"
          students={allStudents}
          classes={classes}
          fees={schoolFees}
          feeCallFollowUps={feeCallFollowUps}
          absentStudentIds={todayAbsentStudentIds}
          inquiries={inquiries}
        />
      )}
      <WalkieTalkieModal
        isOpen={showWalkieModal}
        onClose={() => setShowWalkieModal(false)}
        school={school}
        schoolId={schoolId}
        currentUserId={teacherId}
        currentUserName={currentTeacher?.name || teacherName}
        currentUserRole="TEACHER"
        schoolAdminUid={school?.adminUid}
        teachers={teachersList}
        messages={walkieMessages}
        schedule={walkieSchedule}
      />
      <UpiProofVerificationPopup
        schoolId={schoolId}
        school={school}
        proofs={upiProofs}
        authorized={isUpiReceiver}
        approverName={currentTeacher?.name || teacherName}
        approverRole="teacher"
        approverId={teacherId}
        onApprovedReceipt={(approvedFee) => {
          setSchoolFees((prev) => {
            const next = prev.filter(
              (f) => !(f.studentId === approvedFee.studentId && f.month === approvedFee.month)
            );
            return [approvedFee, ...next];
          });
          setApprovedUpiReceiptFee(approvedFee);
        }}
      />
      {approvedUpiReceiptFee && school && (
        <OfficialFeeReceiptModal
          isOpen={Boolean(approvedUpiReceiptFee)}
          onClose={() => setApprovedUpiReceiptFee(null)}
          school={school}
          fee={approvedUpiReceiptFee}
          className={approvedUpiReceiptFee.className || "Class"}
          initialFormat="pos"
        />
      )}
    </Suspense>
  );
};

export default TeacherPanel;
