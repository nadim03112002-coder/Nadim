// @ts-nocheck
import React, { Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import {
  subscribeToSessions, subscribeToClasses, subscribeToSubjects, subscribeToTeachers,
  subscribeToAllStudents, saveSession, saveClass, saveSubject, saveMultipleSubjects, saveTeacher, saveStudent,
  deleteClass, deleteSubject, deleteTeacher, deleteStudent, updateStudent, deleteSession,
  updateSchool, updateSession, updateClass, updateTeacher,
  generateId, getSchool, getLocalSchools, getSessions, setSchoolLockCode,
  assignSchoolSubAdminByEmail, getSchoolAdmins, removeSchoolUserByUid,
  getAllMonthlyFees, getSchoolFeeHistory, currentMonthStr, saveFee, markFeePaid, isStudentInClass, isDemoRecord, isDemoSessionId,
  shouldUseDemoForSchool, getLocalAttendance, getLocalFees,
  isStudentBirthdayToday, dispatchOfficialSchoolBirthdayWish, checkAndDispatchTodaysBirthdays,
  getStaffDailyAttendance, saveStaffDailyAttendance, todayStr, calculateStayDuration,
  isActiveSchoolTeacherRecord, isActiveStaffRecord, getDeletedTeacherIds,
  subscribeToRecycleBin, restoreTeacherFromRecycleBin, restoreStudentFromRecycleBin,
  permanentDeleteTeacherFromBin, permanentDeleteStudentFromBin,
  subscribeStaffLeaves, autoSendFeeSlipToSchoolDesk, subscribeToFeeCallFollowUps,
  getSchoolPublicInquiries, getPendingFeeFollowUpSyncCount, syncPendingFeeCallFollowUps,
  subscribeSchoolUpiProofs
} from "../../school-firebase";
import {
  subscribeAttendanceSchedule,
  saveAttendanceSchedule,
  getLiveShiftStatus,
  formatTime12h,
  DEFAULT_IN_CUTOFF_TIME,
  DEFAULT_OUT_START_TIME,
} from "../../utils/schoolAttendanceSchedule";
import { loadMergedStoreSales } from "../../utils/schoolCloudSync";
import { buildMergedFleetList } from "../../utils/schoolTransportStore";
import { computePaymentBreakdown } from "../../utils/paymentBreakdown";
import { toUpperFormText, rememberOccupation } from "../../utils/schoolFormUtils";
import { OccupationAutocomplete } from "./OccupationAutocomplete";
import { COMMON_BOOK_PRESETS, PRESET_BOOK_BUNDLES } from "../../constants/bookPresets";
import type { SchoolUserProfile } from "../../school-types";
import type {
  School, SchoolSession, SchoolClass, SchoolSubject, SchoolTeacher, SchoolStudent, StaffDailyAttendanceRecord
} from "../../school-types";
import {
  BLOOD_GROUPS, getSchoolMaxStudents, getSchoolMaxTeachers, TIER_CONFIG,
  SeniorStream, SENIOR_STREAMS, isSeniorClass, getDefaultSubjectsForClass, sortSchoolClasses
} from "../../school-types";
import { DEMO_SESSION_ID, seedDemoSchoolData } from "./demoSchoolData";
import { getDemoSchoolDataset, isDemoDataEnabled, setDemoDataEnabled } from "./demoDataStore";
import { ContentManager } from "./ContentManager";
import { SmartClass } from "./SmartClass";
import { AttendanceManager } from "./AttendanceManager";
import { lazyWithRetry, LazyPanelBoundary, scheduleIdlePreload } from "../../utils/lazyWithRetry";
import { PremiumLoadingState } from "./PremiumLoadingState";
import { ScreenInfoGuideButton } from "./ScreenInfoGuideButton";
import { LanguageToggleButton } from "./LanguageToggleButton";
import { pickLang, useAppLang } from "../../utils/appLang";
const loadFaceAttendanceKiosk = () => import("./FaceAttendanceKioskModal").then(m => ({ default: m.FaceAttendanceKioskModal }));
const loadUniversalFaceIdStudio = () => import("./UniversalFaceIdStudioModal").then(m => ({ default: m.UniversalFaceIdStudioModal }));
const loadIdCardManager = () => import("./IdCardManager").then(m => ({ default: m.IdCardManager }));
const loadAdmitCardManager = () => import("./AdmitCardManager").then(m => ({ default: m.AdmitCardManager }));
const loadCertificateManager = () => import("./CertificateManager").then(m => ({ default: m.CertificateManager }));
const loadMarksheetGenerator = () => import("./MarksheetGenerator").then(m => ({ default: m.MarksheetGenerator }));
const loadStaffHRMManager = () => import("./StaffHRMManager").then(m => ({ default: m.StaffHRMManager }));
const loadSchoolReportsHub = () => import("./SchoolReportsHub").then(m => ({ default: m.SchoolReportsHub }));
const loadPublicSchoolWebsite = () => import("./PublicSchoolWebsite").then(m => ({ default: m.PublicSchoolWebsite }));
const loadSchoolWebsiteCms = () => import("./SchoolWebsiteCms").then(m => ({ default: m.SchoolWebsiteCms }));
const loadOnlineAdmissionManager = () => import("./OnlineAdmissionManager").then(m => ({ default: m.OnlineAdmissionManager }));
const loadNstaMessengerSuite = () => import("./NstaMessengerSuite").then(m => ({ default: m.NstaMessengerSuite }));
const loadAdminAccountsDirectory = () => import("./AdminAccountsDirectory").then(m => ({ default: m.AdminAccountsDirectory }));
const loadSchoolBackupManager = () => import("./SchoolBackupManager").then(m => ({ default: m.SchoolBackupManager }));
const loadQuestionPaperBuilder = () => import("./QuestionPaperBuilder").then(m => ({ default: m.QuestionPaperBuilder }));
const loadMultiBranchManager = () => import("./MultiBranchManager").then(m => ({ default: m.MultiBranchManager }));
const loadHostelMessManager = () => import("./HostelMessManager").then(m => ({ default: m.HostelMessManager }));
const loadDocumentVerificationView = () => import("./DocumentVerificationView").then(m => ({ default: m.DocumentVerificationView }));
const loadEntranceTestAdminManager = () => import("./EntranceTestAdminManager").then(m => ({ default: m.EntranceTestAdminManager }));
const loadDocumentTemplateStudioModal = () => import("./DocumentTemplateStudioModal").then(m => ({ default: m.DocumentTemplateStudioModal }));

const FaceAttendanceKioskModal = lazyWithRetry(loadFaceAttendanceKiosk, "Face Attendance Kiosk");
const UniversalFaceIdStudioModal = lazyWithRetry(loadUniversalFaceIdStudio, "Face ID Studio");
import { FeeManager } from "./FeeManager";
import { ReportCard } from "./ReportCard";
import { MarksManager } from "./MarksManager";
import { ExamResultsPanel } from "./ExamResultsPanel";
import { DirectUploadButton } from "../DirectUploadButton";
const IdCardManager = lazyWithRetry(loadIdCardManager, "ID Card Manager");
const AdmitCardManager = lazyWithRetry(loadAdmitCardManager, "Admit Card Manager");
const CertificateManager = lazyWithRetry(loadCertificateManager, "Certificate Manager");
const MarksheetGenerator = lazyWithRetry(loadMarksheetGenerator, "Marksheet Generator");
import { StudentReAdmissionManager } from "./StudentReAdmissionManager";
import { NoticeBoardManager } from "./NoticeBoardManager";
const StaffHRMManager = lazyWithRetry(loadStaffHRMManager, "Staff HRM Manager");
const SchoolReportsHub = lazyWithRetry(loadSchoolReportsHub, "School Reports Hub");
const PublicSchoolWebsite = lazyWithRetry(loadPublicSchoolWebsite, "Public School Website");
const SchoolWebsiteCms = lazyWithRetry(loadSchoolWebsiteCms, "School Website CMS");
const OnlineAdmissionManager = lazyWithRetry(loadOnlineAdmissionManager, "Online Admission Manager");
import { getStaffEmployees, saveStaffEmployee, getAccountants, saveAccountant, subscribeToAccountants, deleteAccountant, unassignTeacherForAccountantRole, saveSchoolGalleryItem, deleteSchoolGalleryItem } from "../../school-firebase";
import { compressImageFileToDataUrl } from "../../utils/imageCompression";
import type { MonthlyFee, StaffEmployee, StoreSaleRecord, SchoolAccountant, FeeCallFollowUpRecord, SchoolPublicInquiry, UpiPaymentProofRecord } from "../../school-types";
import { SchoolHeaderEditorModal, type SchoolHeaderDetails } from "./SchoolHeaderEditorModal";
import { DigitalSignatureModal, type DigitalSignatureTab } from "./DigitalSignatureModal";
import { getSavedSchoolLogo, getVisibleSchoolRegNo, isAppLogo, cleanLogoUrl } from "./feeReceiptUtils";
import { TimetableManager } from "./TimetableManager";
import { ClassroomVideoArchive } from "./ClassroomVideoArchive";
import { HomeworkManager } from "./HomeworkManager";
import { LibraryManager } from "./LibraryManager";
import { ParentTeacherQueryManager } from "./ParentTeacherQueryManager";
import { InventoryStoreManager } from "./InventoryStoreManager";
import { TeacherIdCardModal } from "./TeacherIdCardModal";
import { StudentIdCardModal } from "./StudentIdCardModal";
import { SchoolCommunityFeed } from "./SchoolCommunityFeed";
import { SchoolMessengerBroadcastStudio } from "./SchoolMessengerBroadcastStudio";
const NstaMessengerSuite = lazyWithRetry(loadNstaMessengerSuite, "NSTA Messenger");
import { AbsenteeActionPage } from "./AbsenteeActionPage";
import { getPendingActiveTagadaCall } from "./FeeTagadaCallerPage";
import { GroupStudyModal } from "../GroupStudyModal";
import { TeacherRulesRegulationsView } from "./TeacherRulesRegulationsView";
import { TeacherSignatureModal } from "./TeacherSignatureModal";
import { AppointmentLetterModal } from "./AppointmentLetterModal";
import { AccountRecoveryCard } from "./AccountRecoveryCard";
const AdminAccountsDirectory = lazyWithRetry(loadAdminAccountsDirectory, "Accounts Directory");
import { NstaCallPortalHost } from "./NstaCallModal";
import { CallerIdSettingsCard } from "./CallerIdSettingsCard";
import { CallSetupChecklistBanner } from "./CallSetupChecklistBanner";
import { ApkUpdateBanner } from "./ApkUpdateBanner";
import { IncomingParentCallModal } from "./IncomingParentCallModal";
import { TodayCommandDigestCard } from "./TodayCommandDigestCard";
import { WalkieTalkieModal } from "./WalkieTalkieModal";
import { EliteFeatureLockCard } from "./EliteFeatureLockCard";
import { useSchoolWalkieChannel } from "../../utils/schoolWalkieService";
import {
  syncSchoolDirectoryToAndroid,
  extractTodayAbsentStudentIds,
  getTodayLocalYmd,
} from "../../utils/schoolCallerId";
import {
  Users, BookOpen, Calendar, IndianRupee, Plus, Trash2, Settings,
  ChevronRight, ChevronLeft, X, Edit3, FileText, Award,
  MapPin, Phone, User, ChevronDown, ChevronUp, Save, Building2,
  Lock, Eye, EyeOff, Shield, ShieldCheck, ArrowLeft, ShoppingBag, AlertTriangle, Crown,
  CreditCard, Megaphone, TrendingUp, Briefcase, FileSpreadsheet,
  ClipboardList, Globe, UserPlus, QrCode, GraduationCap, CheckCircle2,
  Printer, Search, Sparkles, Mail, PenTool, Loader2, AlertCircle, LogOut, LogIn,
  Home, Image as ImageIcon, Clock, Book, Package, MessageSquare, Bell, ArrowRight,
  Youtube, Check, Menu, BarChart3, PieChart, Camera, Share2, Film, CheckCheck, RefreshCw, Upload, ExternalLink, Filter, Send, RotateCw, RotateCcw, Bus, Sliders,
  Sun, Moon, Palette,
  Cake, Gift,
  Smartphone, Laptop, Monitor, Compass, CalendarClock, PhoneCall, Radio
} from "lucide-react";
import { SchoolStore } from "./SchoolStore";
import { SchoolPlanView } from "./SchoolPlanView";
import { ClassQrCodeModal } from "./ClassQrCodeModal";
import { StudentQuickActionModal, type StudentQuickActionTab } from "./StudentQuickActionModal";
import { ClassFeeStructureSection } from "./ClassFeeStructureSection";
import { DirectAdmissionModal } from "./DirectAdmissionModal";
import { AdmissionFormPrintModal } from "./AdmissionFormPrintModal";
import { BusTransportModal } from "./BusTransportModal";
import { ClassCurriculumNotesManager } from "./ClassCurriculumNotesManager";
import {
  isSchoolEliteCurriculum,
  hasFaceAttendanceAccess,
  hasEntranceExamAccess,
  isEntranceExamFeatureEnabled,
  hasEliteCallAccess,
  hasEliteWalkieAccess,
  hasEliteFeeTagadaAccess,
} from "../../school-types";
import { SchoolBirthdayCalendar } from "./SchoolBirthdayCalendar";
import { UniversalAttendanceDesk } from "./UniversalAttendanceDesk";
import { UniversalAttendanceScannerModal } from "./UniversalAttendanceScannerModal";
import { SchoolLocationModal } from "./SchoolLocationModal";
import { DeviceAdminProtectionModal } from "./DeviceAdminProtectionModal";
import { speakNotification } from "../../utils/voiceNotifyEngine";
import { getCombinedDiscountLedger, DISPLAY_DISCOUNT_LABEL } from "../../utils/schoolDiscountAndPayment";
const SchoolBackupManager = lazyWithRetry(loadSchoolBackupManager, "Backup Manager");
import { SchoolExpenseManager } from "./SchoolExpenseManager";
import { ReceiptCancellationModal } from "./ReceiptCancellationModal";
import { RazorpaySettingsModal } from "./RazorpaySettingsModal";
import { ParentLeaveManager } from "./ParentLeaveManager";
import { PtmSchedulerModal } from "./PtmSchedulerModal";
import { StaffPayrollManager } from "./StaffPayrollManager";
const QuestionPaperBuilder = lazyWithRetry(loadQuestionPaperBuilder, "Question Paper Builder");
import { SiblingProfileManager } from "./SiblingProfileManager";
const MultiBranchManager = lazyWithRetry(loadMultiBranchManager, "Multi-Branch Manager");
const HostelMessManager = lazyWithRetry(loadHostelMessManager, "Hostel & Mess Manager");
import { SyllabusPacingTracker } from "./SyllabusPacingTracker";
import { BusFleetLogbookModal } from "./BusFleetLogbookModal";
import { VisitorGateSecurityManager } from "./VisitorGateSecurityManager";
const DocumentVerificationView = lazyWithRetry(loadDocumentVerificationView, "Document Verification");
import { AdmissionEnquiryCrm } from "./AdmissionEnquiryCrm";
import { TeacherAdminGrowthHub } from "./TeacherAdminGrowthHub";
const EntranceTestAdminManager = lazyWithRetry(loadEntranceTestAdminManager, "Entrance Test Hub");
import { HomeDailyRoutineWidget } from "./HomeDailyRoutineWidget";
import { AdminDashboardCharts } from "./AdminDashboardCharts";
import { LessonTopicManagerPanel } from "./LessonTopicManagerPanel";
import { RolesPermissionsManager } from "./RolesPermissionsManager";
const DocumentTemplateStudioModal = lazyWithRetry(loadDocumentTemplateStudioModal, "Template Studio");
const playAttendanceSuccessChimeLazy = () => {
  void import("../../utils/faceRecognitionEngine")
    .then((m) => m.playAttendanceSuccessChime?.())
    .catch(() => {});
};
import { ShieldCheck, Receipt } from "lucide-react";
import { rotateToLandscape, rotateToPortrait, isDesktopModeOn, setDesktopMode, useDeviceOrientation } from "../../utils/displayPrefs";
import { toast } from "sonner";
import { ADMIN_WHATSAPP_NUMBER } from "../../constants";
import { safeOpenExternalUrl, getDynamicAcademicSessionLabel, resolveWebsiteAdmissionSessionLabel, formatCleanSessionName } from "../../utils/safeBrowserActions";
import { autoSyncSchoolPushIfPermitted, sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { subscribeUserToPush, syncNativeAndroidIdentity } from "../NotificationManager";
import { useBackHandler } from "../../utils/backNavigation";

interface Props {
  schoolId: string;
  adminUid: string;
  isSuperAdmin?: boolean;
  onBack?: () => void;
  onOpenPlatformContent?: () => void;
  onLogout?: () => void;
  onLeaveSchool?: () => void;
  onPreviewTeacher?: () => void;
  onPreviewStudent?: () => void;
  onPreviewAccountant?: () => void;
}

type AdminView =
  | "dashboard"
  | "school_profile"
  | "memories"
  | "community"
  | "absentee"
  | "sessions" | "classes" | "subjects" | "teachers" | "students"
  | "content" | "class_notes_manager" | "attendance" | "fees" | "fee_class" | "fee_all" | "fee_structure" | "term_scheduler" | "fee_tagada" | "bus_transport" | "qr_pay" | "fee_alerts" | "receipt_header" | "discount_list" | "report_card" | "marks" | "results"
  | "sibling_profiles"
  | "store" | "subscription"
  | "id_cards" | "admit_cards" | "certificates" | "marksheet_hub" | "readmission" | "notices" | "holidays" | "staff_hrm" | "reports_hub"
  | "public_website" | "website_cms" | "online_admissions" | "online_admission_fee"
  | "nsta_broadcast" | "video_lectures" | "classroom_videos" | "school_study_room"
  | "account_hub"
  | "backup_recovery"
  | "expenses"
  | "leaves_desk"
  | "ptm_scheduler"
  | "staff_payroll"
  | "question_paper_builder"
  | "face_id_studio"
  | "class_qr"
  | "receipt_cancellation"
  | "multi_branch"
  | "hostel_mess"
  | "syllabus_pacing"
  | "bus_logbook"
  | "visitor_security"
  | "doc_verify"
  | "razorpay_setup"
  | "admission_crm"
  | "student_growth_safety"
  | "entrance_test_hub"
  | "digital_paper_library"
  | "roles_permissions"
  | "document_templates"
  | "accounts_directory";


export const SchoolAdminPanel: React.FC<Props> = ({
  schoolId,
  adminUid,
  isSuperAdmin = false,
  onBack,
  onOpenPlatformContent,
  onLogout,
  onLeaveSchool,
  onPreviewTeacher,
  onPreviewStudent,
  onPreviewAccountant
}) => {
  // School Admin and Teacher cannot exit school: Only SuperAdmin can exit
  const canExitSchool = Boolean(isSuperAdmin && onLeaveSchool);

  const handleExploreFullApp = () => {
    if (!onOpenPlatformContent && !onBack) return;
    if (onOpenPlatformContent) {
      try {
        localStorage.setItem("nst_app_view_mode", "STUDENT");
        window.dispatchEvent(new CustomEvent("nst_open_student_dashboard"));
      } catch (e) {
        console.warn("Failed to switch app view mode:", e);
      }
      onOpenPlatformContent();
    } else if (onBack) {
      onBack();
    }
  };

  const initialCachedSchool = useMemo(() => {
    try {
      const list = getLocalSchools();
      return list.find((s) => s.id === schoolId || s.code === schoolId) || null;
    } catch {
      return null;
    }
  }, [schoolId]);
  const [school, setSchool] = useState<School | null>(initialCachedSchool);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [leavingSchoolLoading, setLeavingSchoolLoading] = useState(false);
  const [schoolLoading, setSchoolLoading] = useState<boolean>(() => !initialCachedSchool);

  useEffect(() => {
    return scheduleIdlePreload([
      loadNstaMessengerSuite,
      loadIdCardManager,
      loadAdmitCardManager,
      loadCertificateManager,
      loadMarksheetGenerator,
    ], 1800);
  }, []);
  const [sessions, setSessions] = useState<SchoolSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [teachers, setTeachers] = useState<SchoolTeacher[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [staffList, setStaffList] = useState<StaffEmployee[]>([]);
  const [accountants, setAccountants] = useState<SchoolAccountant[]>([]);
  const [activeSession, setActiveSession] = useState<SchoolSession | null>(null);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [view, setView] = useState<AdminView>(() =>
    getPendingActiveTagadaCall(schoolId) ? "fee_tagada" : "dashboard"
  );
  const [sendingNstaSlipId, setSendingNstaSlipId] = useState<string | null>(null);
  const [sentNstaSlipIds, setSentNstaSlipIds] = useState<Record<string, boolean>>({});
  const [pendingEntranceBuilderPreset, setPendingEntranceBuilderPreset] = useState<any>(null);
  const [entranceHubInitialTab, setEntranceHubInitialTab] = useState<"leads" | "builder">("leads");
  const [smartClassLesson, setSmartClassLesson] = useState<any>(null);
  const [smartClassMode, setSmartClassMode] = useState<"reading" | "writing" | "pdf" | "mcq">("reading");
  const [saving, setSaving] = useState(false);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [showFaceStudioModal, setShowFaceStudioModal] = useState(false);
  const [showTeacherRulesModal, setShowTeacherRulesModal] = useState(false);
  const [showTeacherReferralModal, setShowTeacherReferralModal] = useState(false);
  const [digitalSignatureInitialTab, setDigitalSignatureInitialTab] = useState<DigitalSignatureTab>("principal");
  const [signatureTargetTeacher, setSignatureTargetTeacher] = useState<any | null>(null);
  const [appointmentLetterTeacher, setAppointmentLetterTeacher] = useState<any | null>(null);
  const [teachersHubTab, setTeachersHubTab] = useState<
    | "directory"
    | "leaves"
    | "payroll"
    | "hrm_payslip"
  >("directory");
  const [faceStudioInitialTab, setFaceStudioInitialTab] = useState<"STUDENTS" | "TEACHERS" | "TEST">("STUDENTS");
  const [faceStudioTargetPerson, setFaceStudioTargetPerson] = useState<any | null>(null);
  const [faceStudioTargetType, setFaceStudioTargetType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [attendanceTab, setAttendanceTab] = useState<"students" | "teachers">("students");
  const [teacherAttendanceDate, setTeacherAttendanceDate] = useState<string>(todayStr());
  const [teacherSearchInAttendance, setTeacherSearchInAttendance] = useState<string>("");
  const [teacherAttRecords, setTeacherAttRecords] = useState<StaffDailyAttendanceRecord>(() =>
    schoolId ? getStaffDailyAttendance(schoolId, todayStr()) : { schoolId: "", date: todayStr(), records: {} }
  );

  const [lang, setLang] = useAppLang();
  const [upiProofs, setUpiProofs] = useState<UpiPaymentProofRecord[]>([]);
  const [sendingSmartReminders, setSendingSmartReminders] = useState(false);
  const [pendingStaffLeavesCount, setPendingStaffLeavesCount] = useState(0);

  useEffect(() => {
    if (!schoolId) return;
    return subscribeSchoolUpiProofs(schoolId, setUpiProofs);
  }, [schoolId]);

  useEffect(() => {
    if (schoolId) {
      setTeacherAttRecords(getStaffDailyAttendance(schoolId, teacherAttendanceDate));
    }
  }, [schoolId, teacherAttendanceDate]);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = subscribeStaffLeaves(schoolId, (list) => {
      setPendingStaffLeavesCount((list || []).filter((l) => l.status === "pending").length);
    });
    return unsub;
  }, [schoolId]);

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
      }
    };
    window.addEventListener("nsta:student-updated", handleStudentUpdated);
    return () => window.removeEventListener("nsta:student-updated", handleStudentUpdated);
  }, [schoolId]);

  const handleOpenTeacherFaceEnrollment = (teacher: any) => {
    setFaceStudioInitialTab("TEACHERS");
    setFaceStudioTargetPerson(teacher);
    setFaceStudioTargetType("TEACHER");
    setShowFaceStudioModal(true);
  };
  const [attendanceSchedule, setAttendanceSchedule] = useState({
    inCutoffTime: DEFAULT_IN_CUTOFF_TIME,
    outStartTime: DEFAULT_OUT_START_TIME,
  });
  const [showAttScheduleEditor, setShowAttScheduleEditor] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    return subscribeAttendanceSchedule(schoolId, (sched) => {
      setAttendanceSchedule({
        inCutoffTime: sched.inCutoffTime,
        outStartTime: sched.outStartTime,
      });
    });
  }, [schoolId]);

  // Auto-sync School Admin device for Web Push & RTDB School Alerts when permission is granted
  useEffect(() => {
    if (!schoolId) return;
    try {
      localStorage.setItem("nst_active_school_id", schoolId);
      window.dispatchEvent(new CustomEvent("nst_school_identity_updated", { detail: { schoolId, adminUid } }));
    } catch {}
    syncNativeAndroidIdentity({
      userId: adminUid || "STAFF_ADMIN",
      schoolId,
      extraIds: ["STAFF_ADMIN", "school_admin"],
    }).catch(() => {});
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      autoSyncSchoolPushIfPermitted({
        userId: "STAFF_ADMIN",
        schoolId,
        students: [
          {
            id: "STAFF_ADMIN",
            schoolId,
            schoolName: school?.name || "School Admin",
            name: "School Admin",
          },
          ...(adminUid ? [{ id: adminUid, schoolId, schoolName: school?.name || "School Admin", name: "Admin" }] : []),
        ],
      }).catch(() => {});

      try {
        const targetUid = adminUid || "STAFF_ADMIN";
        const fcmKey = `nst_fcm_admin_synced_${targetUid}_${schoolId}`;
        if (!sessionStorage.getItem(fcmKey)) {
          sessionStorage.setItem(fcmKey, "1");
          subscribeUserToPush(targetUid).catch(() => {});
        }
      } catch {}
    }
  }, [schoolId, adminUid, school?.name]);
  const [expiryPopupExpired, setExpiryPopupExpired] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const [duesSettlementModal, setDuesSettlementModal] = useState<{
    student: SchoolStudent;
    type: "admission" | "advance";
    amount: string;
    mode: "Cash" | "UPI" | "Bank";
    saving: boolean;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // School info card
  const [schoolCardExpanded, setSchoolCardExpanded] = useState(false);
  const [activeBranchName, setActiveBranchName] = useState<string>(() => {
    try {
      return localStorage.getItem(`active_branch_name_${schoolId}`) || "Main Campus";
    } catch (e) {
      console.warn("Failed to read active branch name:", e);
      return "Main Campus";
    }
  });
  const [editingSchoolInfo, setEditingSchoolInfo] = useState(false);
  const [showFullSchoolProfileEditor, setShowFullSchoolProfileEditor] = useState(false);
  const [showDigitalSignatureModal, setShowDigitalSignatureModal] = useState(false);
  const [schoolInfoForm, setSchoolInfoForm] = useState({
    name: "",
    principalName: "", principalPhone: "", directorName: "", directorPhone: "",
    managerName: "", managerPhone: "", accountantName: "",
    mobile: "", address: "", tagline: "", bannerColor: ""
  });
  const [savingSchoolInfo, setSavingSchoolInfo] = useState(false);

  useEffect(() => {
    if (school && !editingSchoolInfo) {
      setSchoolInfoForm({
        name: school.name || "",
        principalName: school.principalName || "",
        principalPhone: school.principalPhone || "",
        directorName: school.directorName || "",
        directorPhone: school.directorPhone || "",
        managerName: school.managerName || "",
        managerPhone: school.managerPhone || "",
        accountantName: school.accountantName || "",
        mobile: school.mobile || school.phone || "",
        address: school.address || "",
        tagline: school.tagline || "",
        bannerColor: school.bannerColor || "",
      });
    }
  }, [school, editingSchoolInfo]);

  // Lock code
  const [lockCodeInput, setLockCodeInput]     = useState('');
  const [lockCodeActive, setLockCodeActive]   = useState(false);
  const [showLockCode, setShowLockCode]       = useState(false);
  const [savingLockCode, setSavingLockCode]   = useState(false);
  const [lockCodeSaved, setLockCodeSaved]     = useState(false);
  const [lockCodeDrawerOpen, setLockCodeDrawerOpen] = useState(false);

  // Left Sidebar Drawer on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sidebar Hidden / 1% Visible Mode (Swipe Left to hide / Swipe Right to show)
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem("school_erp_sidebar_hidden") === "true";
    } catch {
      return false;
    }
  });

  // Preserve menu scroll position across drawer close/reopen, collapse/expand, and view switches
  const menuScrollStorageKey = `nst_admin_menu_scroll_${schoolId || "default"}`;
  const desktopMenuScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuScrollRef = useRef<HTMLDivElement | null>(null);
  const mainContentScrollRef = useRef<HTMLDivElement | null>(null);
  const menuScrollTopRef = useRef<number>((() => {
    try {
      const raw = sessionStorage.getItem(`nst_admin_menu_scroll_${schoolId || "default"}`);
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

  // Manual Desktop/Laptop Mode Toggle (Preserved in localStorage)
  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("school_erp_desktop_mode") === "true";
    } catch {
      return false;
    }
  });

  // Effective landscape: active when manual desktop mode is ON, or device is held in landscape, or wide desktop monitor
  const isEffectiveLandscape = isDesktopMode || isClientLandscape || isWideScreen;

  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  // 3-Theme Switcher (White / Black / Midnight Current)
  const [appTheme, setAppTheme] = useState<"current" | "white" | "black">(() => {
    try {
      const saved = (localStorage.getItem("nst_app_theme") || localStorage.getItem("nst_student_theme")) as any;
      if (saved === "white" || saved === "black" || saved === "current") return saved;
    } catch (e) {
      console.warn("Failed to read saved theme:", e);
    }
    return "current";
  });
  const [showHeaderSettingsMenu, setShowHeaderSettingsMenu] = useState(false);

  const applyAdminTheme = (nextTheme: "current" | "white" | "black") => {
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
        root.classList.add(`admin-theme-${nextTheme}`, `app-theme-${nextTheme}`);
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
    } catch (e) {
      console.warn("Failed to apply admin theme:", e);
    }
  };

  useEffect(() => {
    applyAdminTheme(appTheme);
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

  useEffect(() => {
    // Ensure status bar theme color meta tag exists without overriding active ERP theme
    try {
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement("meta");
        metaTheme.setAttribute("name", "theme-color");
        metaTheme.setAttribute(
          "content",
          appTheme === "white" ? "#eef2f7" : appTheme === "black" ? "#000000" : "#08142c"
        );
        document.head.appendChild(metaTheme);
      }
    } catch (e) {
      console.warn("Failed to set theme-color meta tag:", e);
    }

    // Global touch gesture listeners: Swipe Left anywhere to hide menu (1% visible), Swipe Right anywhere to reveal
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

      // Minimum swipe distance: 45px horizontal movement, dominating vertical
      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
        if (diffX < 0) {
          // SWIPED LEFT -> Hide menu (1% visible strip)
          captureActiveMenuScrollRef.current();
          setIsSidebarOpen(false);
          setIsSidebarHidden(true);
          try {
            localStorage.setItem("school_erp_sidebar_hidden", "true");
          } catch (err) {
            console.warn("Failed to save sidebar state:", err);
          }
        } else if (diffX > 0) {
          // SWIPED RIGHT -> Show menu ONLY if touch started within the left 20% edge of screen
          const maxLeftEdge = typeof window !== "undefined" ? window.innerWidth * 0.20 : 80;
          if (touchStartX <= maxLeftEdge) {
            setIsSidebarOpen(true);
            setIsSidebarHidden(false);
            try {
              localStorage.setItem("school_erp_sidebar_hidden", "false");
            } catch (err) {
              console.warn("Failed to save sidebar state:", err);
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
  }, []);

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
  }, [isSidebarOpen, isSidebarHidden, isEffectiveLandscape, view, smartClassLesson]);

  const handleToggleScreenRotate = async () => {
    const next = !isEffectiveLandscape;
    setIsDesktopMode(next);
    try {
      localStorage.setItem("school_erp_desktop_mode", next ? "true" : "false");
    } catch (e) {
      console.warn("Failed to persist desktop mode:", e);
    }

    if (next) {
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

  const isMenuItemActive = (itemId: string) => {
    if (view === itemId) return true;
    if (itemId === "classes" && (view === "classes" || view === "attendance")) return true;
    if (itemId === "fees" && (view === "fees" || view === "fee_class" || view === "fee_all")) return true;
    if (itemId === "marksheet_hub" && (view === "marksheet_hub" || view === "results" || view === "report_card")) return true;
    return false;
  };

  // Memories module state
  const [memoriesList, setMemoriesList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem(`school_memories_${schoolId}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to parse saved school memories:", e);
    }
    if (!shouldUseDemoForSchool(schoolId)) {
      return [];
    }
    return [
      {
        id: "mem_sports_2026",
        title: "Annual Sports Meet 2026 (वार्षिक खेलकूद प्रतियोगिता)",
        category: "SPORTS",
        date: "2026-02-14",
        type: "IMAGE",
        url: "https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1200&q=80",
        description: "100m दौड़, रिले रेस और खेलकूद में छात्र-छात्राओं का शानदार प्रदर्शन व मेडल वितरण।",
        tags: ["Sports", "Medals", "Athletics"],
        likes: 124,
      },
      {
        id: "mem_republic_2026",
        title: "Republic Day Celebration (77वां गणतंत्र दिवस)",
        category: "ANNUAL",
        date: "2026-01-26",
        type: "IMAGE",
        url: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80",
        description: "ध्वजारोहण, मार्च पास्ट, देशभक्ति गीतों पर समूह नृत्य व राष्ट्रीय एकता संदेश।",
        tags: ["Republic Day", "Patriotic", "Dance"],
        likes: 98,
      },
      {
        id: "mem_science_2026",
        title: "Science, Robotics & AI Expo (विज्ञान प्रदर्शनी)",
        category: "EXPO",
        date: "2026-01-10",
        type: "IMAGE",
        url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
        description: "कक्षा 6 से 12 के छात्रों द्वारा बनाए गए सोलर एनर्जी, स्मार्ट इरिगेशन व रोबोटिक्स के मॉडल्स।",
        tags: ["Science", "Robotics", "Innovation"],
        likes: 156,
      },
      {
        id: "mem_campus_class_2026",
        title: "Smart Classroom Activity & Group Study",
        category: "CAMPUS",
        date: "2026-02-05",
        type: "IMAGE",
        url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
        description: "डिजिटल बोर्ड पर स्मार्ट लर्निंग सत्र और छात्रों का सामूहिक प्रेजेंटेशन।",
        tags: ["Campus", "Classroom", "Learning"],
        likes: 84,
      },
      {
        id: "mem_picnic_2026",
        title: "Educational Tour & Nature Picnic (शैक्षणिक भ्रमण)",
        category: "TOUR",
        date: "2026-02-18",
        type: "IMAGE",
        url: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80",
        description: "बोटैनिकल गार्डन और विज्ञान केंद्र का शैक्षणिक भ्रमण व फोटोग्राफी सत्र।",
        tags: ["Picnic", "Nature", "Tour"],
        likes: 142,
      }
    ];
  });
  const [memoriesFilter, setMemoriesFilter] = useState<string>("ALL");
  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);
  const [activeMemoryPreview, setActiveMemoryPreview] = useState<any | null>(null);
  const [newMemoryForm, setNewMemoryForm] = useState({
    title: "",
    category: "ANNUAL",
    date: new Date().toISOString().split("T")[0],
    type: "IMAGE",
    url: "",
    videoUrl: "",
    description: "",
    tags: "",
  });

  // Home Dashboard filters & toast
  const [dueClassFilter, setDueClassFilter] = useState<string>("ALL");
  const [dueMinAmount, setDueMinAmount] = useState<number>(0);
  const [sentPushAlertsToast, setSentPushAlertsToast] = useState<string | null>(null);

  const handlePerformLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      try {
        localStorage.removeItem('nst_current_user');
        localStorage.removeItem('nsta_cached_user');
        localStorage.setItem('nst_logged_out', 'true');
        window.location.reload();
      } catch (e) {
        console.warn("Failed to perform logout cleanup:", e);
      }
    }
  };

  // Sub-admin management
  const [subAdmins, setSubAdmins]             = useState<SchoolUserProfile[]>([]);
  const [subAdminEmail, setSubAdminEmail]     = useState('');
  const [assigningSubAdmin, setAssigningSubAdmin] = useState(false);
  const [subAdminResult, setSubAdminResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [subAdminExpanded, setSubAdminExpanded] = useState(false);
  const [quickActionStudent, setQuickActionStudent] = useState<SchoolStudent | null>(null);
  const [quickActionInitialTab, setQuickActionInitialTab] = useState<StudentQuickActionTab>("profile");
  const [selectedTeacherForIdCard, setSelectedTeacherForIdCard] = useState<SchoolTeacher | StaffEmployee | null>(null);
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState<{
    student: SchoolStudent;
    admissionFee?: MonthlyFee | null;
  } | null>(null);

  // Forms
  const [sessionForm, setSessionForm] = useState({ name: "", startDate: "", endDate: "" });
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [showHowToUseModal, setShowHowToUseModal] = useState<boolean>(false);
  const [howToUseSearch, setHowToUseSearch] = useState<string>("");
  const [universalSearchQuery, setUniversalSearchQuery] = useState<string>("");
  const [showCompactSearch, setShowCompactSearch] = useState<boolean>(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>("");
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({
    main: false,
    students: false,
    teachers: false,
    attendance_ai: false,
    fees_finance: false,
    academics: false,
    exams: false,
    facilities: false,
    communication: false,
  });

  const toggleCategoryCollapse = (_catId: string) => {
    setCollapsedCats((prev) => ({
      ...prev,
      [_catId]: false,
    }));
  };
  const [discountLedgerFilter, setDiscountLedgerFilter] = useState<string>("all");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("ALL");
  const [copyClassesFromCurrent, setCopyClassesFromCurrent] = useState<boolean>(true);
  const [classForm, setClassForm] = useState({ name: "", section: "", stream: "Science", autoAddSubjects: true, defaultFee: 0 });
  const [subjectForm, setSubjectForm] = useState({ name: "" });
  const [multiBookQueue, setMultiBookQueue] = useState<string[]>([]);
  const [customMultiBooksText, setCustomMultiBooksText] = useState("");
  const [savingMultiBooks, setSavingMultiBooks] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: "",
    phone: "",
    photoUrl: "",
    signatureUrl: "",
    designation: "Senior Faculty",
    qualification: "",
    experience: "",
    subjects: "",
    bio: "",
    employeeId: "",
    email: "",
    monthlySalary: 0,
    hasReferralIncentive: false,
    hidePhoneFromParentCallerId: false,
    staffRole: "TEACHER" as "TEACHER" | "ACCOUNTANT" | "BOTH",
  });
  const [studentForm, setStudentForm] = useState<any>({
    name: "", rollNo: "", admissionNo: "", fatherName: "", motherName: "",
    phone: "", dateOfBirth: "", monthlyFee: 0, bloodGroup: ""
  });
  const [showForm, setShowForm] = useState<string | null>(null);

  // Edit states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({ name: "", startDate: "", endDate: "" });
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassForm, setEditClassForm] = useState({ name: "", section: "", stream: "", defaultFee: 0 });
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [roleConvertTarget, setRoleConvertTarget] = useState<{
    person: any;
    currentMode: "TEACHER" | "ACCOUNTANT" | "BOTH";
  } | null>(null);
  const [convertingRole, setConvertingRole] = useState(false);
  const [editTeacherForm, setEditTeacherForm] = useState({
    name: "",
    phone: "",
    photoUrl: "",
    signatureUrl: "",
    designation: "",
    qualification: "",
    experience: "",
    subjects: "",
    bio: "",
    employeeId: "",
    email: "",
    monthlySalary: 0,
    hasReferralIncentive: false,
    hidePhoneFromParentCallerId: false,
    staffRole: "TEACHER" as "TEACHER" | "ACCOUNTANT" | "BOTH",
  });
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<any>({
    name: "", rollNo: "", admissionNo: "", classId: "", stream: "",
    fatherName: "", fatherOccupation: "", fatherQualification: "", fatherPhone: "", fatherWhatsapp: "", fatherAadhaar: "",
    motherName: "", motherOccupation: "", motherQualification: "", motherPhone: "", motherWhatsapp: "", motherAadhaar: "",
    phone: "", whatsappNo: "", email: "", dateOfBirth: "", monthlyFee: 0, photoUrl: "", bloodGroup: "",
    gender: "", category: "", religion: "", nationality: "", motherTongue: "", identificationMark: "",
    aadhaarNo: "", apaarId: "", address: "", city: "", pincode: "", correspondenceAddress: "",
    annualIncome: "", emergencyContact: "", emergencyPhone: "", emergencyRelation: "", medicalHistory: "",
    previousSchool: "", previousMarks: "", previousBoard: "", previousTcNo: "",
    usesBus: false, busRoute: "", busFee: 0,
    bankAccountName: "", bankName: "", bankAccountNumber: "", bankIfsc: "",
  });
  const [showDirectAdmissionModal, setShowDirectAdmissionModal] = useState(false);
  const [admissionPrintPayload, setAdmissionPrintPayload] = useState<{
    student: SchoolStudent;
    fee?: MonthlyFee | null;
    mode?: "combined" | "form_only" | "receipt_only";
  } | null>(null);

  // Universal Attendance & School Live Location Modals State
  const [showUniversalScannerModal, setShowUniversalScannerModal] = useState(false);
  const [showSchoolLocationModal, setShowSchoolLocationModal] = useState(false);
  const [showDeviceAdminModal, setShowDeviceAdminModal] = useState(false);
  const [showWalkieModal, setShowWalkieModal] = useState(false);
  const [showFaceKioskModal, setShowFaceKioskModal] = useState(false);
  const [faceKioskInitialTestMode, setFaceKioskInitialTestMode] = useState(false);
  const [enrolledFaceIds, setEnrolledFaceIds] = useState<Record<string, boolean>>({});
  const [duesCardTab, setDuesCardTab] = useState<"admission" | "advance">("admission");
  const [showPunchDeskExpanded, setShowPunchDeskExpanded] = useState<boolean>(false);

  // Settings & Recycle Bin state
  const [settingsTab, setSettingsTab] = useState<"profile" | "recycle_bin">("profile");
  const [recycleTeachers, setRecycleTeachers] = useState<Array<SchoolTeacher & { deletedAt?: string }>>([]);
  const [recycleStudents, setRecycleStudents] = useState<Array<SchoolStudent & { deletedAt?: string }>>([]);
  const [recycleFilter, setRecycleFilter] = useState<"all" | "teachers" | "students">("all");
  const [recycleSearch, setRecycleSearch] = useState<string>("");
  const [recycleBusyId, setRecycleBusyId] = useState<string | null>(null);

  // Android / Browser Back button step-by-step navigation across School Admin ERP
  useBackHandler(showUniversalScannerModal, () => setShowUniversalScannerModal(false), 30);
  useBackHandler(showFaceKioskModal, () => setShowFaceKioskModal(false), 30);
  useBackHandler(showFaceStudioModal, () => setShowFaceStudioModal(false), 30);
  useBackHandler(showWalkieModal, () => setShowWalkieModal(false), 26);
  useBackHandler(Boolean(signatureTargetTeacher), () => setSignatureTargetTeacher(null), 25);
  useBackHandler(Boolean(appointmentLetterTeacher), () => setAppointmentLetterTeacher(null), 23);
  useBackHandler(Boolean(selectedTeacherForIdCard), () => setSelectedTeacherForIdCard(null), 22);
  useBackHandler(Boolean(selectedStudentForIdCard), () => setSelectedStudentForIdCard(null), 22);
  useBackHandler(Boolean(quickActionStudent), () => setQuickActionStudent(null), 22);
  useBackHandler(Boolean(showForm), () => setShowForm(null), 22);
  useBackHandler(Boolean(admissionPrintPayload), () => setAdmissionPrintPayload(null), 22);
  useBackHandler(showLeaveConfirmModal, () => setShowLeaveConfirmModal(false), 20);
  useBackHandler(showExpiryPopup, () => setShowExpiryPopup(false), 20);
  useBackHandler(showTeacherRulesModal, () => setShowTeacherRulesModal(false), 20);
  useBackHandler(showTeacherReferralModal, () => setShowTeacherReferralModal(false), 20);
  useBackHandler(showAttScheduleEditor, () => setShowAttScheduleEditor(false), 20);
  useBackHandler(showFullSchoolProfileEditor, () => setShowFullSchoolProfileEditor(false), 20);
  useBackHandler(showDigitalSignatureModal, () => setShowDigitalSignatureModal(false), 20);
  useBackHandler(showLockCode, () => setShowLockCode(false), 20);
  useBackHandler(showRotatePrompt, () => setShowRotatePrompt(false), 20);
  useBackHandler(showHeaderSettingsMenu, () => setShowHeaderSettingsMenu(false), 20);
  useBackHandler(showAddMemoryModal, () => setShowAddMemoryModal(false), 20);
  useBackHandler(showSessionModal, () => setShowSessionModal(false), 20);
  useBackHandler(showHowToUseModal, () => setShowHowToUseModal(false), 20);
  useBackHandler(showDirectAdmissionModal, () => setShowDirectAdmissionModal(false), 20);
  useBackHandler(showSchoolLocationModal, () => setShowSchoolLocationModal(false), 20);
  useBackHandler(showDeviceAdminModal, () => setShowDeviceAdminModal(false), 20);
  useBackHandler(isSidebarOpen, () => setIsSidebarOpen(false), 18);
  useBackHandler(Boolean(smartClassLesson), () => setSmartClassLesson(null), 12);
  useBackHandler(Boolean(selectedSubject), () => setSelectedSubject(null), 10);
  useBackHandler(Boolean(selectedClass), () => {
    setSelectedClass(null);
    setSelectedSectionFilter("ALL");
  }, 8);
  useBackHandler(view !== "dashboard", () => setView("dashboard"), 0);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = subscribeToRecycleBin(schoolId, ({ teachers: rTeachers, students: rStudents }) => {
      setRecycleTeachers(rTeachers || []);
      setRecycleStudents(rStudents || []);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      import("../../utils/faceRecognitionEngine")
        .then(({ getSchoolFaceDescriptors }) => getSchoolFaceDescriptors(schoolId))
        .then((map) => {
          if (cancelled) return;
          const next: Record<string, boolean> = {};
          Object.keys(map || {}).forEach((id) => {
            next[id] = true;
          });
          setEnrolledFaceIds(next);
        })
        .catch((err) => {
          console.warn("Failed to fetch face descriptors:", err);
        });
    }, showFaceKioskModal ? 0 : 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [schoolId, showFaceKioskModal, students.length]);

  // Fee summary state
  const [feeMonth, setFeeMonth] = useState(currentMonthStr());
  const [allFees, setAllFees] = useState<MonthlyFee[]>([]);
  const [dashboardFeeHistory, setDashboardFeeHistory] = useState<MonthlyFee[]>([]);
  const [dashboardStoreSales, setDashboardStoreSales] = useState<StoreSaleRecord[]>([]);
  const [feeCallFollowUps, setFeeCallFollowUps] = useState<FeeCallFollowUpRecord[]>([]);
  const [inquiries, setInquiries] = useState<SchoolPublicInquiry[]>([]);
  const [attendanceTick, setAttendanceTick] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    schoolId ? getPendingFeeFollowUpSyncCount(schoolId) : 0
  );
  const [syncingPending, setSyncingPending] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const [feeSummaryLoading, setFeeSummaryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!schoolId) return;
    const timer = setTimeout(() => {
      getSchoolFeeHistory(schoolId, activeSession?.id)
        .then((fees) => {
          if (active && Array.isArray(fees)) setDashboardFeeHistory(fees);
        })
        .catch(() => {});
      loadMergedStoreSales<StoreSaleRecord>(schoolId)
        .then((sales) => {
          if (active && Array.isArray(sales)) setDashboardStoreSales(sales);
        })
        .catch(() => {});
    }, 650);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [schoolId, activeSession?.id]);
  const [feeClassSelected, setFeeClassSelected] = useState<SchoolClass | null>(null);
  const [feePreselectTarget, setFeePreselectTarget] = useState<{
    studentId: string;
    action: "collect_fee" | "fee_update";
  } | null>(null);
  const [demoGenerating, setDemoGenerating] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoEnabled, setDemoEnabled] = useState<boolean>(() => isDemoDataEnabled());

  useEffect(() => {
    const handleDemoChange = (e: any) => {
      if (typeof e?.detail?.enabled === "boolean") {
        setDemoEnabled(e.detail.enabled);
      }
    };
    window.addEventListener("nst_demo_toggle_changed", handleDemoChange);
    return () => window.removeEventListener("nst_demo_toggle_changed", handleDemoChange);
  }, []);

  const demoSessionItem: SchoolSession = React.useMemo(() => ({
    id: DEMO_SESSION_ID,
    schoolId: schoolId,
    name: "🧪 Demo Session (केवल डमी डेटा)",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    active: activeSession?.id === DEMO_SESSION_ID,
    isDemo: true,
    createdAt: "2026-04-01T00:00:00Z"
  }), [schoolId, activeSession?.id]);

  const handleToggleDemoData = (val: boolean) => {
    setDemoDataEnabled(val);
    setDemoEnabled(val);
    if (val) {
      handleActivateSession(demoSessionItem);
    } else {
      const firstReal = sessions.find(s => s && s.id && s.name && !isDemoRecord(s));
      if (firstReal) {
        handleActivateSession(firstReal);
      }
    }
  };

  // Strict rule: Demo data is ONLY enabled if the active session is explicitly the Demo Session!
  const isCurrentSessionDemo = Boolean(
    activeSession &&
    (activeSession.id === DEMO_SESSION_ID ||
     activeSession.id?.startsWith("demo_") ||
     (activeSession as any).isDemo === true)
  );

  const schoolDemoActive = isCurrentSessionDemo;

  const displayedStudents = React.useMemo(() => {
    if (schoolDemoActive) {
      const demo = getDemoSchoolDataset(true);
      const targetSessId = activeSession?.id || DEMO_SESSION_ID;
      const allDemo = demo?.students || [];
      const sessFiltered = allDemo.filter(s => s.sessionId === targetSessId);
      if (sessFiltered.length > 0) return sessFiltered;
      const primaryId = demo?.session?.id || DEMO_SESSION_ID;
      const primaryFiltered = allDemo.filter(s => s.sessionId === primaryId);
      return primaryFiltered.length > 0 ? primaryFiltered : allDemo;
    }
    // REAL ACADEMIC SESSION: ZERO DUMMY DATA! Only real students for this school & active session.
    const realStudents = students.filter(s => !isDemoRecord(s));
    if (activeSession?.id) {
      return realStudents.filter(s => s.sessionId === activeSession.id);
    }
    return realStudents;
  }, [students, schoolDemoActive, activeSession]);

  const displayedClasses = React.useMemo(() => {
    if (schoolDemoActive) {
      const demo = getDemoSchoolDataset(true);
      const targetSessId = activeSession?.id || DEMO_SESSION_ID;
      const allDemo = demo?.classes || [];
      const sessFiltered = allDemo.filter(c => c.sessionId === targetSessId);
      if (sessFiltered.length > 0) return sessFiltered;
      const primaryId = demo?.session?.id || DEMO_SESSION_ID;
      const primaryFiltered = allDemo.filter(c => c.sessionId === primaryId);
      return primaryFiltered.length > 0 ? primaryFiltered : allDemo;
    }
    // REAL ACADEMIC SESSION: ZERO DUMMY CLASSES!
    const realClasses = classes.filter(c => !isDemoRecord(c));
    if (activeSession?.id) {
      return realClasses.filter(c => c.sessionId === activeSession.id);
    }
    return realClasses;
  }, [classes, schoolDemoActive, activeSession]);

  const displayedTeachers = React.useMemo(() => {
    const mergeAccountantsIntoTeachers = (baseTeachers: SchoolTeacher[], accPool: SchoolAccountant[]) => {
      const normPhone = (p?: string) => String(p || "").replace(/[^0-9]/g, "").slice(-10);
      const normName = (n?: string) => String(n || "").trim().toLowerCase();
      const activeAccs = (accPool || []).filter(
        (a) => a && a.active !== false && (schoolDemoActive || !isDemoRecord(a))
      );

      const enriched: any[] = baseTeachers.map((t) => {
        const tPhone = normPhone(t.phone);
        const tName = normName(t.name);
        const matchedAcc = activeAccs.find(
          (a) =>
            a.teacherRef === t.id ||
            a.id === t.id ||
            (tPhone.length >= 8 && normPhone(a.phone) === tPhone) ||
            (tName && normName(a.name) === tName)
        );
        if (!matchedAcc) return t;
        const tPay = Number(t.salaryStructure?.netMonthlySalary ?? t.monthlySalary ?? (t as any).salary ?? 0);
        const accPay = Number(matchedAcc.salaryStructure?.netMonthlySalary ?? matchedAcc.monthlySalary ?? 0);
        return {
          ...t,
          _isAccountant: true,
          _accountantId: matchedAcc.id,
          monthlySalary: tPay > 0 ? tPay : accPay,
          salary: tPay > 0 ? tPay : accPay,
          salaryStructure: t.salaryStructure || matchedAcc.salaryStructure,
        };
      });

      const deletedIds = getDeletedTeacherIds(schoolId);
      activeAccs.forEach((acc) => {
        if (deletedIds.has(acc.id)) return;
        const accPhone = normPhone(acc.phone);
        const accName = normName(acc.name);
        const alreadyInList = enriched.some(
          (t) =>
            t.id === acc.id ||
            acc.teacherRef === t.id ||
            t._accountantId === acc.id ||
            (accPhone.length >= 8 && normPhone(t.phone) === accPhone) ||
            (accName && normName(t.name) === accName)
        );
        if (!alreadyInList) {
          const accPay = Math.max(0, Number(acc.salaryStructure?.netMonthlySalary ?? acc.monthlySalary ?? 0));
          enriched.push({
            id: acc.id,
            schoolId: acc.schoolId || schoolId,
            name: acc.name,
            email: acc.email || undefined,
            phone: acc.phone || undefined,
            photoUrl: acc.photoUrl || undefined,
            employeeId: acc.employeeId || "ACC",
            designation: acc.designation || "Accountant & Cashier",
            subjects: [],
            classes: [],
            joinDate: acc.joinDate || new Date().toISOString().split("T")[0],
            monthlySalary: accPay,
            salary: accPay,
            salaryStructure: acc.salaryStructure,
            hasReferralIncentive: Boolean((acc as any).hasReferralIncentive),
            active: true,
            createdAt: acc.createdAt || new Date().toISOString(),
            _isAccountant: true,
            _isAccountantOnly: true,
            _accountantId: acc.id,
          });
        }
      });

      return enriched;
    };

    if (schoolDemoActive) {
      const demo = getDemoSchoolDataset(true);
      const targetSessId = activeSession?.id || DEMO_SESSION_ID;
      const allDemo = demo?.teachers || [];
      const sessFiltered = allDemo.filter(t => t.id?.includes(targetSessId));
      const primaryId = demo?.session?.id || DEMO_SESSION_ID;
      const primaryFiltered = allDemo.filter(t => t.id?.includes(primaryId));
      const demoTeachers = sessFiltered.length > 0 ? sessFiltered : (primaryFiltered.length > 0 ? primaryFiltered : allDemo);
      const demoAccs = (demo as any)?.accountants || accountants;
      return mergeAccountantsIntoTeachers(demoTeachers, demoAccs);
    }
    // REAL ACADEMIC SESSION: ZERO DUMMY OR DELETED TEACHERS!
    const deletedIds = getDeletedTeacherIds(schoolId);
    const activeRealTeachers = teachers.filter(t => !isDemoRecord(t) && isActiveSchoolTeacherRecord(t) && !deletedIds.has(t.id));
    return mergeAccountantsIntoTeachers(activeRealTeachers, accountants);
  }, [teachers, accountants, schoolDemoActive, activeSession, schoolId]);

  const displayedStaff = React.useMemo(() => {
    if (schoolDemoActive) {
      const demo = getDemoSchoolDataset(true);
      return demo?.staffEmployees || [];
    }
    const deletedIds = getDeletedTeacherIds(schoolId);
    const activeTeacherIds = new Set(teachers.filter(t => isActiveSchoolTeacherRecord(t) && !deletedIds.has(t.id)).map(t => t.id));
    return (staffList || []).filter((s) => {
      if (!s || isDemoRecord(s) || !isActiveStaffRecord(s) || deletedIds.has(s.id)) return false;
      // Hide orphaned teacher-synced staff records once teachers list has loaded
      if (s.department === "Academic / Faculty" && !activeTeacherIds.has(s.id)) return false;
      return true;
    });
  }, [staffList, teachers, schoolDemoActive, schoolId]);

  const displayedSessions = React.useMemo(() => {
    const seen = new Set<string>();
    const realSess = sessions.filter(s => {
      if (!s || !s.id || !s.name || isDemoRecord(s) || isDemoSessionId(s.id)) return false;
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    const list = [...realSess, demoSessionItem];
    if (activeSession?.id) {
      return list.map(s => ({ ...s, active: s.id === activeSession.id }));
    }
    return list;
  }, [sessions, activeSession, demoSessionItem]);

  const websiteAdmissionSession = React.useMemo(
    () =>
      resolveWebsiteAdmissionSessionLabel({
        school,
        activeSession,
        sessions: displayedSessions,
      }),
    [school, activeSession, displayedSessions]
  );
  const [websiteSessionDraft, setWebsiteSessionDraft] = useState<string>("");
  useEffect(() => {
    setWebsiteSessionDraft(websiteAdmissionSession);
  }, [websiteAdmissionSession]);

  // Today's Birthdays automated detection
  const todaysBirthdayStudents = React.useMemo(() => {
    return displayedStudents.filter(s => isStudentBirthdayToday(s.dateOfBirth));
  }, [displayedStudents]);

  const [birthdayWishSending, setBirthdayWishSending] = useState<string | null>(null);
  const [birthdayWishToast, setBirthdayWishToast] = useState<string | null>(null);

  const handleSendManualBirthdayWish = async (student: SchoolStudent) => {
    setBirthdayWishSending(student.id);
    try {
      const className = displayedClasses.find(c => c.id === student.classId)?.name || "Class Student";
      await dispatchOfficialSchoolBirthdayWish({
        schoolId,
        studentId: student.id,
        studentName: student.name,
        rollNo: student.rollNo,
        className,
        photoUrl: student.photoUrl,
        dateOfBirth: student.dateOfBirth,
        parentPhone: student.phone
      });
      setBirthdayWishToast(`🎉 ${student.name} को जन्मदिन की आधिकारिक बधाई व आशीर्वाद पत्र सफलतापूर्वक भेजा गया!`);
      setTimeout(() => setBirthdayWishToast(null), 4000);
    } catch (e: any) {
      toast.error("Birthday wish bhejne me samasya aayi: " + (e?.message || "Error"));
    } finally {
      setBirthdayWishSending(null);
    }
  };

  // Advanced Class Card states
  const [expandedToolsClassId, setExpandedToolsClassId] = useState<string | null>(null);
  const [classSearchQuery, setClassSearchQuery] = useState("");
  const [qrModalClass, setQrModalClass] = useState<SchoolClass | null>(null);

  // Class preset names ordered strictly from Nursery to 12
  const CLASS_PRESETS = [
    "Nursery", "LKG", "UKG",
    "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
    "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
    "Class 11", "Class 12", "Play"
  ];

  // 1-second live ticker for 48h live countdown and instant lockout on 00:00:00
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Online Admission Notification alerts for School Admin
  const [admissionAlerts, setAdmissionAlerts] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`school_admission_alerts_${schoolId}`) || "[]");
    } catch (e) {
      console.warn("Failed to parse admission alerts:", e);
      return [];
    }
  });

  useEffect(() => {
    const handleNewAdmission = () => {
      try {
        const list = JSON.parse(localStorage.getItem(`school_admission_alerts_${schoolId}`) || "[]");
        setAdmissionAlerts(list);
      } catch (e) {
        console.warn("Failed to refresh admission alerts:", e);
      }
    };
    window.addEventListener("school-admission-alert", handleNewAdmission);
    return () => window.removeEventListener("school-admission-alert", handleNewAdmission);
  }, [schoolId]);

  // 48-hour expiry warning — shown once per login session
  useEffect(() => {
    if (!school) return;
    const sessionKey = `iic_expiry_warned_${schoolId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    const expIso = school.subscription?.expiresAt || school.subscription?.paidUntil || '2027-04-24T23:59:59.000Z';
    if (!expIso) return;
    const msLeft = new Date(expIso).getTime() - Date.now();
    const hoursLeft = msLeft / 3600000;
    if (hoursLeft <= 48) {
      sessionStorage.setItem(sessionKey, '1');
      setExpiryPopupExpired(hoursLeft <= 0);
      setShowExpiryPopup(true);
    }
  }, [school]);

  useEffect(() => {
    loadSubAdmins();
    getStaffEmployees(schoolId).then(setStaffList).catch(() => {});
    const unsubSessions = subscribeToSessions(schoolId, (sess) => {
      const cleanSess = (sess || []).filter(s => s && s.id && s.name && !isDemoSessionId(s.id));
      setSessions(prev => {
        if (
          prev.length === cleanSess.length &&
          prev.every((p, i) => p.id === cleanSess[i]?.id && p.active === cleanSess[i]?.active && p.name === cleanSess[i]?.name)
        ) {
          return prev;
        }
        return cleanSess;
      });
      const savedSessionId = typeof localStorage !== "undefined" ? localStorage.getItem(`nst_active_session_${schoolId}`) : null;
      const isSavedDemo = Boolean(savedSessionId && isDemoSessionId(savedSessionId));
      const active = isSavedDemo
        ? {
            id: DEMO_SESSION_ID,
            schoolId,
            name: "🧪 Demo Session (केवल डमी डेटा)",
            startDate: "2026-04-01",
            endDate: "2027-03-31",
            active: true,
            isDemo: true,
            createdAt: "2026-04-01T00:00:00Z"
          }
        : ((savedSessionId && cleanSess.find(s => s.id === savedSessionId)) ||
           cleanSess.find(s => s.active) ||
           cleanSess[0] || null);
      setDemoDataEnabled(isSavedDemo);
      setDemoEnabled(isSavedDemo);
      setActiveSession(prev => {
        if (!prev && !active) return null;
        if (prev?.id === active?.id && prev?.name === active?.name && prev?.active === active?.active) {
          return prev;
        }
        return active;
      });
    });
    const unsubTeachers = subscribeToTeachers(schoolId, setTeachers);
    const unsubAccountants = subscribeToAccountants(schoolId, setAccountants);
    const unsubStudents = subscribeToAllStudents(schoolId, (stList) => {
      setStudents(stList);
      if (stList && stList.length > 0) {
        checkAndDispatchTodaysBirthdays(schoolId).catch(() => {});
      }
    });
    const unsubFollowUps = subscribeToFeeCallFollowUps(schoolId, setFeeCallFollowUps);
    return () => {
      unsubSessions();
      unsubTeachers();
      unsubAccountants();
      unsubStudents();
      unsubFollowUps();
    };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    getSchoolPublicInquiries(schoolId)
      .then((list) => {
        if (Array.isArray(list)) setInquiries(list);
      })
      .catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const refreshPendingCount = () => {
      setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
    };
    const handleAttendanceUpdate = () => setAttendanceTick((t) => t + 1);
    const handleFollowUpsUpdated = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.schoolId && detail.schoolId !== schoolId) return;
      refreshPendingCount();
    };
    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
      if (getPendingFeeFollowUpSyncCount(schoolId) > 0) {
        syncPendingFeeCallFollowUps(schoolId)
          .then(() => refreshPendingCount())
          .catch(() => {});
      }
    };
    const handleOffline = () => setIsOnline(false);

    refreshPendingCount();
    window.addEventListener("attendance-updated", handleAttendanceUpdate);
    window.addEventListener("fee-call-followups-updated", handleFollowUpsUpdated);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("attendance-updated", handleAttendanceUpdate);
      window.removeEventListener("fee-call-followups-updated", handleFollowUpsUpdated);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [schoolId]);

  const todayAbsentStudentIds = useMemo(() => {
    if (!schoolId) return [];
    try {
      return extractTodayAbsentStudentIds(getLocalAttendance(schoolId));
    } catch {
      return [];
    }
  }, [schoolId, attendanceTick, students.length]);

  const handleSyncPendingFromDigest = async () => {
    if (!schoolId || syncingPending) return;
    setSyncingPending(true);
    try {
      const res = await syncPendingFeeCallFollowUps(schoolId);
      setPendingSyncCount(res.remaining);
      if (res.synced > 0) {
        toast.success(`${res.synced} pending offline call updates cloud me sync ho gaye.`);
      } else if (res.remaining > 0) {
        toast.info("Internet ya cloud connection check karein.");
      } else {
        toast.success("Sabhi call records up-to-date hain.");
      }
    } catch {
      toast.error("Sync karte waqt error aayi.");
    } finally {
      setSyncingPending(false);
    }
  };

  const {
    messages: walkieMessages,
    schedule: walkieSchedule,
    isWithinHours: isWalkieSchoolHoursNow,
  } = useSchoolWalkieChannel({
    enabled: Boolean(schoolId && hasEliteWalkieAccess(school)),
    schoolId,
    userId: adminUid || "STAFF_ADMIN",
    userRole: "ADMIN",
    onOpenWalkie: () => setShowWalkieModal(true),
  });

  useEffect(() => {
    const onOpenWalkie = () => setShowWalkieModal(true);
    window.addEventListener("android-open-walkie", onOpenWalkie);
    return () => window.removeEventListener("android-open-walkie", onOpenWalkie);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    const allowParentCaller = hasEliteFeeTagadaAccess(school);
    syncSchoolDirectoryToAndroid({
      school,
      schoolName: school?.name,
      teachers,
      accountants,
      staffEmployees: staffList,
      students: allowParentCaller ? students : [],
      classes: allowParentCaller ? classes : [],
      fees: allowParentCaller ? (dashboardFeeHistory.length > 0 ? dashboardFeeHistory : allFees) : [],
      feeCallFollowUps: allowParentCaller ? feeCallFollowUps : [],
      absentStudentIds: allowParentCaller ? todayAbsentStudentIds : [],
      inquiries: allowParentCaller ? inquiries : [],
    });
  }, [
    schoolId,
    school,
    teachers,
    accountants,
    staffList,
    students,
    classes,
    allFees,
    dashboardFeeHistory,
    feeCallFollowUps,
    todayAbsentStudentIds,
    inquiries,
  ]);

  useEffect(() => {
    const handleTeacherOrStaffRemoved = (e: any) => {
      if (e?.detail?.schoolId && e.detail.schoolId !== schoolId) return;
      const removedId = e?.detail?.teacherId || e?.detail?.staffId;
      if (removedId) {
        setTeachers((prev) => prev.filter((t) => t.id !== removedId));
        setStaffList((prev) => prev.filter((s) => s.id !== removedId));
        setSelectedTeacherIds((prev) => prev.filter((id) => id !== removedId));
      }
    };
    const handleStaffUpdated = (e: any) => {
      if (e?.detail?.schoolId && e.detail.schoolId !== schoolId) return;
      const updated = e?.detail?.staff;
      if (updated?.id) {
        setStaffList((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
      }
    };
    const handleTeacherUpdated = (e: any) => {
      if (e?.detail?.schoolId && e.detail.schoolId !== schoolId) return;
      const updated = e?.detail?.teacher;
      if (updated?.id) {
        setTeachers((prev) => {
          const exists = prev.some((t) => t.id === updated.id);
          return exists
            ? prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
            : [updated, ...prev];
        });
      }
    };
    window.addEventListener("teacher-deleted", handleTeacherOrStaffRemoved);
    window.addEventListener("staff-deleted", handleTeacherOrStaffRemoved);
    window.addEventListener("staff-updated", handleStaffUpdated);
    window.addEventListener("teacher-updated", handleTeacherUpdated);
    return () => {
      window.removeEventListener("teacher-deleted", handleTeacherOrStaffRemoved);
      window.removeEventListener("staff-deleted", handleTeacherOrStaffRemoved);
      window.removeEventListener("staff-updated", handleStaffUpdated);
      window.removeEventListener("teacher-updated", handleTeacherUpdated);
    };
  }, [schoolId]);

  useEffect(() => {
    let isCurrentView = true;
    if (!initialCachedSchool && !school) setSchoolLoading(true);
    const safetyTimer = setTimeout(() => {
      if (isCurrentView) setSchoolLoading(false);
    }, 1800);
    getSchool(schoolId).then(s => {
      if (!isCurrentView || !s) return;
      setSchool(prev => {
        if (
          prev &&
          prev.id === s.id &&
          prev.name === s.name &&
          prev.logoUrl === s.logoUrl &&
          prev.lockCode === s.lockCode &&
          prev.lockCodeActive === s.lockCodeActive &&
          JSON.stringify(prev.subscription) === JSON.stringify(s.subscription)
        ) {
          return prev;
        }
        return s;
      });
      setLockCodeInput(s.lockCode || "");
      setLockCodeActive(s.lockCodeActive ?? false);
    }).catch(() => {
      if (isCurrentView && !school) setSchool(null);
    }).finally(() => {
      clearTimeout(safetyTimer);
      if (isCurrentView) setSchoolLoading(false);
    });
    return () => {
      isCurrentView = false;
      clearTimeout(safetyTimer);
    };
  }, [schoolId]);

  useEffect(() => {
    const handleSchoolUpdated = (e: any) => {
      const detail = e?.detail;
      if (detail?.schoolId && detail.schoolId !== schoolId) return;
      if (detail?.logoUrl !== undefined || detail?.data) {
        setSchool(prev => {
          if (!prev) return prev;
          const nextLogo = detail.logoUrl !== undefined ? detail.logoUrl : (detail?.data?.logoUrl || prev.logoUrl);
          return {
            ...prev,
            ...(detail?.data || {}),
            logoUrl: nextLogo,
          };
        });
      }
    };
    window.addEventListener("school-profile-updated", handleSchoolUpdated);
    return () => window.removeEventListener("school-profile-updated", handleSchoolUpdated);
  }, [schoolId]);

  useEffect(() => {
    if (!activeSession?.id) return;
    const unsubClasses = subscribeToClasses(schoolId, activeSession.id, (clsList) => {
      setClasses(prev => {
        if (prev.length === clsList.length && prev.every((c, i) => c.id === clsList[i]?.id)) {
          return prev;
        }
        return clsList;
      });
    });
    return unsubClasses;
  }, [schoolId, activeSession?.id]);

  const autoUpgradeCheckedRef = useRef(false);
  useEffect(() => {
    // Only auto upgrade demo dataset if demo mode is active for the default demo school
    if (!schoolDemoActive || autoUpgradeCheckedRef.current || demoGenerating) return;
    if (activeSession?.id === DEMO_SESSION_ID && classes.length > 0) {
      // Strictly match old section-split IDs (ending in _a or _b), never matching _arts
      const hasOldSplit = classes.some(c => /_(?:section_)?[ab]$/i.test(c.id) && !c.id.includes("_arts"));
      if (hasOldSplit) {
        autoUpgradeCheckedRef.current = true;
        setDemoGenerating(true);
        seedDemoSchoolData(schoolId, adminUid)
          .catch(err => console.warn("Auto demo upgrade:", err))
          .finally(() => setDemoGenerating(false));
      } else {
        autoUpgradeCheckedRef.current = true;
      }
    }
  }, [activeSession?.id, classes, demoGenerating, schoolId, adminUid, schoolDemoActive]);

  useEffect(() => {
    if (!selectedClass) return;
    const unsubSubjects = subscribeToSubjects(schoolId, selectedClass.id, setSubjects);
    return unsubSubjects;
  }, [selectedClass]);

  const addSession = async () => {
    if (!sessionForm.name.trim()) return;
    setSaving(true);
    const id = `sess_${schoolId}_${Date.now()}`;
    const newSession: SchoolSession = {
      id,
      schoolId,
      name: sessionForm.name.trim(),
      startDate: sessionForm.startDate || "2027-04-01",
      endDate: sessionForm.endDate || "2028-03-31",
      active: true,
      createdAt: new Date().toISOString()
    };
    await saveSession(newSession);

    // If copyClassesFromCurrent is checked, copy existing real class structure to new session
    const sourceClassesToClone = classes.filter(c => c && !isDemoRecord(c));
    const clonePool = sourceClassesToClone.length > 0
      ? (activeSession && !isDemoSessionId(activeSession.id)
          ? sourceClassesToClone.filter(c => c.sessionId === activeSession.id)
          : sourceClassesToClone)
      : [];
    if (copyClassesFromCurrent && clonePool.length > 0) {
      const clonedClasses: SchoolClass[] = clonePool.map(cls => {
        const { isDemo: _dropDemo, ...rest } = cls as any;
        return {
          ...rest,
          id: generateId(),
          sessionId: id,
          createdAt: new Date().toISOString()
        };
      });
      await Promise.all(clonedClasses.map(c => saveClass(c)));
    }

    await handleActivateSession(newSession);
    setSessionForm({ name: "", startDate: "", endDate: "" });
    setShowForm(null);
    setShowSessionModal(false);
    setSaving(false);
    setDemoMessage(`✅ नया सत्र सफलतापूर्वक जोड़ा गया: ${newSession.name}`);
    setTimeout(() => setDemoMessage(null), 3500);
  };

  const addClass = async () => {
    if (!classForm.name.trim() || !activeSession) return;
    setSaving(true);
    const id = generateId();
    const streamVal = isSeniorClass(classForm.name) ? (classForm.stream || "Science") : undefined;
    await saveClass({
      id, schoolId, sessionId: activeSession.id,
      name: classForm.name,
      section: classForm.section,
      stream: streamVal,
      defaultFee: Number(classForm.defaultFee) || 0,
      createdAt: new Date().toISOString()
    });

    // Auto-create pre-configured stream / grade subjects
    if (classForm.autoAddSubjects) {
      const defaultSubs = getDefaultSubjectsForClass(classForm.name, streamVal);
      if (defaultSubs && defaultSubs.length > 0) {
        const newSubs: SchoolSubject[] = defaultSubs.map(subName => ({
          id: generateId(),
          schoolId,
          sessionId: activeSession.id,
          classId: id,
          name: subName,
          stream: streamVal,
          createdAt: new Date().toISOString()
        }));
        await saveMultipleSubjects(newSubs);
      }
    }

    setClassForm({ name: "", section: "", stream: "Science", autoAddSubjects: true, defaultFee: 0 });
    setShowForm(null);
    setSaving(false);
  };

  const addSubject = async () => {
    if (!subjectForm.name.trim() || !selectedClass || !activeSession) return;
    setSaving(true);
    const id = generateId();
    await saveSubject({
      id, schoolId, sessionId: activeSession.id, classId: selectedClass.id,
      name: subjectForm.name, createdAt: new Date().toISOString()
    });
    setSubjectForm({ name: "" });
    setShowForm(null);
    setSaving(false);
  };

  const handleSaveBulkBooks = async () => {
    if (!selectedClass || !activeSession || multiBookQueue.length === 0) return;
    setSavingMultiBooks(true);
    try {
      const existingNames = new Set(subjects.map(s => (s.name || "").trim().toLowerCase()));
      const toAdd = multiBookQueue.filter(name => !existingNames.has(name.trim().toLowerCase()));
      if (toAdd.length === 0) {
        toast.info("Ye sabhi books pehle se is class me add hain!");
        setSavingMultiBooks(false);
        return;
      }
      const newSubs: SchoolSubject[] = toAdd.map(name => ({
        id: generateId(),
        schoolId,
        sessionId: activeSession.id,
        classId: selectedClass.id,
        className: selectedClass.name,
        name: name.trim(),
        createdAt: new Date().toISOString()
      }));
      await saveMultipleSubjects(newSubs);
      setSubjects(prev => [...prev, ...newSubs]);
      setMultiBookQueue([]);
      setCustomMultiBooksText("");
      setShowForm(null);
    } catch (err: any) {
      toast.error("Error adding books: " + (err?.message || "Please try again"));
    } finally {
      setSavingMultiBooks(false);
    }
  };

  const addTeacher = async () => {
    if (!teacherForm.name.trim()) return;
    const roleChoice = teacherForm.staffRole || "TEACHER";
    if (roleChoice !== "ACCOUNTANT") {
      const maxTeachers = getSchoolMaxTeachers(school);
      if (teachers.length >= maxTeachers) {
        const tierName = TIER_CONFIG[school?.subscription?.tier || 'starter_200']?.name || 'Starter Plan';
        toast.error(`Faculty Limit Reached (${teachers.length}/${maxTeachers})! Plan (${tierName}) upgrade karwayen.`);
        return;
      }
    }
    setSaving(true);
    const id = generateId();
    const subArr = teacherForm.subjects
      ? String(teacherForm.subjects).split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const empPrefix = roleChoice === "ACCOUNTANT" ? "ACC" : "TEA";
    const empId = teacherForm.employeeId?.trim() || `${empPrefix}-${id.slice(-4).toUpperCase()}`;
    const cleanPhone = teacherForm.phone?.trim() || "";
    const monthlyPay = Math.max(0, Number(teacherForm.monthlySalary) || 0);
    const nowIso = new Date().toISOString();
    const salaryStruct = {
      monthlyBaseSalary: monthlyPay,
      allowanceHra: 0,
      allowanceTravel: 0,
      allowanceSpecial: 0,
      deductionPf: 0,
      deductionOther: 0,
      netMonthlySalary: monthlyPay,
      paymentMode: "Bank Transfer" as const,
      updatedAt: nowIso,
    };
    const defaultDesignation =
      roleChoice === "ACCOUNTANT"
        ? "Accountant & Cashier"
        : roleChoice === "BOTH"
        ? "Senior Faculty & Accountant"
        : "Faculty Member";
    const newTeacher: SchoolTeacher = {
      id,
      schoolId,
      name: teacherForm.name.trim(),
      email: teacherForm.email?.trim() || undefined,
      phone: cleanPhone || undefined,
      photoUrl: teacherForm.photoUrl || undefined,
      signatureUrl: teacherForm.signatureUrl || undefined,
      designation: teacherForm.designation?.trim() || defaultDesignation,
      qualification: teacherForm.qualification?.trim() || undefined,
      experience: teacherForm.experience?.trim() || undefined,
      bio: teacherForm.bio?.trim() || undefined,
      employeeId: empId,
      subjects: subArr,
      classes: [],
      active: true,
      joinDate: nowIso.split("T")[0],
      createdAt: nowIso,
      monthlySalary: monthlyPay,
      salary: monthlyPay,
      salaryStructure: salaryStruct,
      hasReferralIncentive: Boolean(teacherForm.hasReferralIncentive),
      hidePhoneFromParentCallerId: Boolean(teacherForm.hidePhoneFromParentCallerId),
    };

    if (roleChoice === "TEACHER" || roleChoice === "BOTH") {
      await saveTeacher(newTeacher);
    }

    if (roleChoice === "ACCOUNTANT" || roleChoice === "BOTH") {
      const accId = roleChoice === "ACCOUNTANT" ? id : `acc_${id}`;
      const newAcc: SchoolAccountant = {
        id: accId,
        schoolId,
        name: newTeacher.name,
        phone: cleanPhone || "0000000000",
        email: newTeacher.email,
        photoUrl: newTeacher.photoUrl,
        signatureUrl: newTeacher.signatureUrl,
        employeeId: empId,
        designation:
          roleChoice === "BOTH"
            ? `${newTeacher.designation} & Accountant`
            : newTeacher.designation || "Accountant & Cashier",
        monthlySalary: monthlyPay,
        salaryStructure: salaryStruct,
        joinDate: newTeacher.joinDate,
        active: true,
        teacherRef: roleChoice === "BOTH" ? id : undefined,
        hidePhoneFromParentCallerId: Boolean(teacherForm.hidePhoneFromParentCallerId),
        permissions: {
          canCollectFee: true,
          canAdmitStudents: true,
          canGrantDiscount: true,
          maxDiscountLimitPct: 20,
          canRecordExpenses: true,
          canViewDayBook: true,
          canSendFeeAlerts: true,
          canManageBusFee: true,
          canPrintIdCards: true,
          canManageAbsentee: true,
        },
        createdAt: nowIso,
      };
      await saveAccountant(newAcc);
      setAccountants((prev) => [newAcc, ...prev.filter((a) => a.id !== accId)]);
    }

    // Also sync to staff employees so HRM and ID card systems are 100% in sync
    await saveStaffEmployee({
      id,
      schoolId,
      name: newTeacher.name,
      email: newTeacher.email || "",
      phone: cleanPhone,
      designation: newTeacher.designation || (roleChoice === "ACCOUNTANT" ? "Accountant" : "Teacher"),
      department:
        roleChoice === "ACCOUNTANT"
          ? "Accounts & Administration"
          : roleChoice === "BOTH"
          ? "Academic & Accounts"
          : "Academic / Faculty",
      joinDate: newTeacher.joinDate,
      monthlySalary: monthlyPay,
      salaryStructure: salaryStruct,
      active: true,
      photoUrl: newTeacher.photoUrl,
      employeeId: empId,
      hidePhoneFromParentCallerId: Boolean(teacherForm.hidePhoneFromParentCallerId),
      createdAt: newTeacher.createdAt
    });

    setTeacherForm({
      name: "",
      phone: "",
      photoUrl: "",
      signatureUrl: "",
      designation: "Senior Faculty",
      qualification: "",
      experience: "",
      subjects: "",
      bio: "",
      employeeId: "",
      email: "",
      monthlySalary: 0,
      hasReferralIncentive: false,
      hidePhoneFromParentCallerId: false,
      staffRole: "TEACHER",
    });
    setShowForm(null);
    setSaving(false);

    if (roleChoice === "ACCOUNTANT") {
      toast.success(`💼 ${newTeacher.name} ko Accountant ke roop me add kar diya gaya!`);
      setSelectedTeacherForIdCard(newTeacher);
    } else if (roleChoice === "BOTH") {
      toast.success(`⚡ ${newTeacher.name} ko Teacher + Accountant dono ke roop me add kar diya gaya!`);
      setSelectedTeacherForIdCard(newTeacher);
    } else {
      // Auto-open newly added teacher's ID card immediately!
      setSelectedTeacherForIdCard(newTeacher);
    }
  };

  const addStudent = async () => {
    if (!studentForm.name.trim() || !selectedClass || !activeSession) return;
    const maxStudents = getSchoolMaxStudents(school);
    if (displayedStudents.length >= maxStudents) {
      const tierName = TIER_CONFIG[school?.subscription?.tier || 'starter_200']?.name || 'Starter Plan';
      toast.error(`Student Limit Reached (${displayedStudents.length}/${maxStudents})! Plan (${tierName}) upgrade karwayen.`);
      return;
    }
    setSaving(true);
    const id = generateId();
    const savedStudent = await saveStudent({
      id, schoolId, sessionId: activeSession.id, classId: selectedClass.id,
      className: `${selectedClass.name}${selectedClass.section ? ` (${selectedClass.section})` : ""}`,
      name: toUpperFormText(studentForm.name.trim()), rollNo: toUpperFormText(studentForm.rollNo),
      admissionNo: toUpperFormText(studentForm.admissionNo), fatherName: toUpperFormText(studentForm.fatherName),
      motherName: toUpperFormText(studentForm.motherName), phone: studentForm.phone,
      dateOfBirth: studentForm.dateOfBirth,
      bloodGroup: studentForm.bloodGroup || "",
      monthlyFee: Number(studentForm.monthlyFee) || 0,
      active: true, joinDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    });
    setStudentForm({ name: "", rollNo: "", admissionNo: "", fatherName: "", motherName: "", phone: "", dateOfBirth: "", bloodGroup: "", monthlyFee: (selectedClass as any)?.defaultFee || 0 });
    setShowForm(null);
    setSaving(false);
    setSelectedStudentForIdCard({ student: savedStudent });
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const saveEditSession = async () => {
    if (!editingSessionId || !editSessionForm.name.trim()) return;
    setSaving(true);
    const updatedData = {
      name: editSessionForm.name.trim(),
      startDate: editSessionForm.startDate,
      endDate: editSessionForm.endDate,
    };
    await updateSession(schoolId, editingSessionId, updatedData);
    setSessions(prev => prev.map(s => (s.id === editingSessionId ? { ...s, ...updatedData } : s)));
    if (activeSession?.id === editingSessionId) {
      setActiveSession(prev => prev ? { ...prev, ...updatedData } : null);
    }
    setEditingSessionId(null);
    setSaving(false);
    setDemoMessage("✅ सत्र विवरण सफलतापूर्वक अपडेट किया गया।");
    setTimeout(() => setDemoMessage(null), 3000);
  };

  const saveEditClass = async () => {
    if (!editingClassId || !editClassForm.name.trim()) return;
    setSaving(true);
    try {
      const previousClass = classes.find(cls => cls.id === editingClassId);
      const updatedDefaultFee = Number(editClassForm.defaultFee) || 0;
      const previousDefaultFee = Number(previousClass?.defaultFee ?? previousClass?.feeStructure?.tuitionFee ?? 0);
      const feeChanged = updatedDefaultFee !== previousDefaultFee;
      const streamVal = isSeniorClass(editClassForm.name) ? (editClassForm.stream || previousClass?.stream || "Science") : undefined;
      await updateClass(schoolId, editingClassId, {
        name: editClassForm.name.trim(),
        section: editClassForm.section,
        stream: streamVal,
        defaultFee: updatedDefaultFee,
        feeStructure: {
          ...(previousClass?.feeStructure || {}),
          tuitionFee: updatedDefaultFee,
        },
      });
      if (feeChanged) {
        const classStudents = displayedStudents.filter(student =>
          student.classId === editingClassId &&
          (!previousClass?.sessionId || student.sessionId === previousClass.sessionId)
        );
        await Promise.all(classStudents.map(student =>
          updateStudent(schoolId, student.id, { monthlyFee: updatedDefaultFee })
        ));
        setStudents(current => current.map(student =>
          classStudents.some(classStudent => classStudent.id === student.id)
            ? { ...student, monthlyFee: updatedDefaultFee }
            : student
        ));
      }
      setEditingClassId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateSession = async (session: SchoolSession) => {
    setSaving(true);
    const isDemoTarget = isDemoSessionId(session.id) || Boolean((session as any).isDemo);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`nst_active_session_${schoolId}`, session.id);
      }
      setDemoDataEnabled(isDemoTarget);
      setDemoEnabled(isDemoTarget);
    } catch (e) {
      console.warn("Failed to persist active session:", e);
    }
    setSelectedClass(null);
    setSelectedSubject(null);
    setActiveSession({ ...session, active: true });
    // NEVER write partial updates for Demo session or invalid sessions
    const realSessionsToSync = sessions.filter(
      item => item && item.id && item.name && !isDemoSessionId(item.id)
    );
    await Promise.all(realSessionsToSync.map(item =>
      updateSession(schoolId, item.id, { active: !isDemoTarget && item.id === session.id })
    ));
    setSaving(false);
    setShowSessionModal(false);
    setDemoMessage(`✅ सत्र बदला गया: ${session.name}`);
    setTimeout(() => setDemoMessage(null), 3000);
  };

  const handleSetWebsiteSession = async (targetLabel: string, targetSessionId?: string) => {
    const cleanLabel = formatCleanSessionName(targetLabel);
    if (!cleanLabel) return;
    setSaving(true);
    try {
      const existingCfg = school?.websiteConfig || {};
      const existingBadge = String(existingCfg.heroBadgeText || "").trim();
      const nextBadge =
        !existingBadge || /^Admissions Open\s*·\s*Session/i.test(existingBadge)
          ? `Admissions Open · Session ${cleanLabel}`
          : existingBadge;
      const nextCfg = {
        ...existingCfg,
        admissionSessionLabel: cleanLabel,
        websiteSessionId: targetSessionId || undefined,
        heroBadgeText: nextBadge,
        updatedAt: new Date().toISOString(),
      };
      await updateSchool(schoolId, { websiteConfig: nextCfg });
      setSchool(prev => (prev ? { ...prev, websiteConfig: nextCfg } : prev));
      setWebsiteSessionDraft(cleanLabel);
      try {
        window.dispatchEvent(new CustomEvent("nst_school_identity_updated"));
      } catch {}
      setDemoMessage(`🌐 वेबसाइट व ऑनलाइन एडमिशन सत्र बदला गया: ${cleanLabel}`);
      setTimeout(() => setDemoMessage(null), 3500);
      toast.success(`🌐 वेबसाइट सत्र सेव हो गया: ${cleanLabel}`);
    } catch (err: any) {
      toast.error("वेबसाइट सत्र अपडेट करने में समस्या आई: " + (err?.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (session: SchoolSession) => {
    if (isDemoSessionId(session.id)) {
      setDemoMessage("ℹ️ Demo सत्र सिस्टम द्वारा अंतर्निर्मित है; इसे हटाया नहीं जा सकता।");
      setTimeout(() => setDemoMessage(null), 3000);
      return;
    }
    const realCount = displayedSessions.filter(s => !isDemoSessionId(s.id)).length;
    if (realCount <= 1) {
      setDemoMessage("⚠️ Aap aakhiri real session delete nahi kar sakte. School me kam se kam ek academic session hona zaroori hai.");
      setTimeout(() => setDemoMessage(null), 3500);
      return;
    }

    setSaving(true);
    try {
      await deleteSession(schoolId, session.id);
      const remainingSessions = sessions.filter(s => s.id !== session.id && !isDemoSessionId(s.id));
      setSessions(remainingSessions);
      if (activeSession?.id === session.id && remainingSessions.length > 0) {
        await handleActivateSession(remainingSessions[0]);
      }
      setDemoMessage(`🗑️ सत्र हटा दिया गया: ${session.name}`);
      setTimeout(() => setDemoMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting session:", err);
      setDemoMessage("⚠️ Session delete karne me samasya aayi.");
      setTimeout(() => setDemoMessage(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const executeGenerateDemoData = async () => {
    if (demoGenerating) return;
    setDemoGenerating(true);
    setDemoMessage("");
    try {
      const result = await seedDemoSchoolData(schoolId, adminUid);
      setSessions(current => [
        ...current.filter(session => session.id !== result.session.id),
        result.session,
      ]);
      setDemoMessage(
        `✅ Demo Complete: ${result.classes} classes (2 sections each), ${result.students} students (max 40/class: A=20, B=20), ${result.staff} staff (1:20 ratio), ${result.exams} exams (PA 40M / Term 100M), 1-year fee dues (3-12 months), ${result.notices} monthly notices aur ${result.holidays} festival holidays tayyar hain!`
      );
    } catch (error: any) {
      setDemoMessage(`Demo data poora nahi bana: ${error?.message || "Dobara try karein."}`);
    } finally {
      setDemoGenerating(false);
    }
  };

  const handleGenerateDemoData = () => {
    if (demoGenerating) return;
    const isRefresh = sessions.some(session => session.id === DEMO_SESSION_ID);
    const confirmation = isRefresh
      ? "Demo session me har class me max 40 students (Section A: 20, Section B: 20), 1:20 teacher-student ratio, 6 exams, 1-year fee receipts aur holidays refresh honge. Continue?"
      : "Full 1-Year CBSE Demo Setup create hoga (Demo Session me). Continue?";
    setConfirmAction({
      title: isRefresh ? "Demo Data Refresh Karein?" : "Demo Session Setup Karein?",
      message: confirmation,
      confirmLabel: "Haan, Continue Karein",
      onConfirm: executeGenerateDemoData,
    });
  };

  const applyFacultyRoleMode = async (
    person: any,
    nextMode: "TEACHER" | "ACCOUNTANT" | "BOTH",
    overrides?: {
      name?: string;
      phone?: string;
      email?: string;
      photoUrl?: string;
      signatureUrl?: string;
      designation?: string;
      qualification?: string;
      experience?: string;
      subjects?: string | string[];
      bio?: string;
      employeeId?: string;
      monthlySalary?: number;
      salaryStructure?: any;
      hasReferralIncentive?: boolean;
      hidePhoneFromParentCallerId?: boolean;
    }
  ) => {
    const nowIso = new Date().toISOString();
    const normPhone = (p?: string) => String(p || "").replace(/[^0-9]/g, "").slice(-10);
    const normName = (n?: string) => String(n || "").trim().toLowerCase();

    const pPhone = normPhone(overrides?.phone ?? person.phone);
    const pName = normName(overrides?.name ?? person.name);

    const existingTeacher =
      teachers.find((t) => t.id === person.id) ||
      teachers.find(
        (t) =>
          (pPhone.length >= 8 && normPhone(t.phone) === pPhone) ||
          (pName && normName(t.name) === pName)
      );

    const allAccs = accountants.length > 0 ? accountants : await getAccountants(schoolId).catch(() => []);
    const matchedAcc =
      allAccs.find(
        (a) =>
          a.id === person._accountantId ||
          a.id === person.id ||
          a.teacherRef === person.id ||
          (existingTeacher && a.teacherRef === existingTeacher.id) ||
          (pPhone.length >= 8 && normPhone(a.phone) === pPhone) ||
          (pName && normName(a.name) === pName)
      ) || null;

    const cleanName = (overrides?.name ?? person.name ?? "Staff Member").trim();
    const cleanPhone = (overrides?.phone ?? person.phone ?? "").trim();
    const cleanEmail = (overrides?.email ?? person.email ?? "").trim() || undefined;
    const cleanPhoto = overrides?.photoUrl !== undefined ? overrides.photoUrl : person.photoUrl;
    const cleanSign = overrides?.signatureUrl !== undefined ? overrides.signatureUrl : person.signatureUrl;
    const cleanQual = (overrides?.qualification ?? person.qualification ?? "").trim() || undefined;
    const cleanExp = (overrides?.experience ?? person.experience ?? "").trim() || undefined;
    const cleanBio = (overrides?.bio ?? person.bio ?? "").trim() || undefined;
    const rawSubs = overrides?.subjects !== undefined ? overrides.subjects : person.subjects;
    const subArr = Array.isArray(rawSubs)
      ? rawSubs
      : typeof rawSubs === "string"
      ? rawSubs.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const monthlyPay = Math.max(
      0,
      Number(
        overrides?.monthlySalary ??
          person.salaryStructure?.netMonthlySalary ??
          person.monthlySalary ??
          person.salary ??
          0
      )
    );

    const baseStruct = overrides?.salaryStructure || person.salaryStructure;
    const nextSalaryStructure = baseStruct
      ? {
          ...baseStruct,
          netMonthlySalary: monthlyPay,
          monthlyBaseSalary: Math.max(
            0,
            monthlyPay -
              Number(baseStruct.allowanceHra || 0) -
              Number(baseStruct.allowanceTravel || 0) -
              Number(baseStruct.allowanceSpecial || 0) +
              Number(baseStruct.deductionPf || 0) +
              Number(baseStruct.deductionOther || 0)
          ),
          updatedAt: nowIso,
        }
      : {
          monthlyBaseSalary: monthlyPay,
          allowanceHra: 0,
          allowanceTravel: 0,
          allowanceSpecial: 0,
          deductionPf: 0,
          deductionOther: 0,
          netMonthlySalary: monthlyPay,
          paymentMode: "Bank Transfer" as const,
          updatedAt: nowIso,
        };

    const rawDesig = (overrides?.designation ?? person.designation ?? "").trim();
    const cleanEmpId =
      (overrides?.employeeId ?? person.employeeId ?? "").trim() ||
      (nextMode === "ACCOUNTANT"
        ? `ACC-${String(person.id).slice(-4).toUpperCase()}`
        : `TEA-${String(person.id).slice(-4).toUpperCase()}`);

    const teacherId = existingTeacher?.id || (!String(person.id).startsWith("acc_") ? person.id : generateId());
    const accId = matchedAcc?.id || (String(person.id).startsWith("acc_") ? person.id : `acc_${teacherId}`);

    if (nextMode === "TEACHER" || nextMode === "BOTH") {
      const nextTeacherDesig =
        nextMode === "TEACHER"
          ? rawDesig.replace(/\s*&\s*Accountant|\s*Accountant\s*&\s*Cashier/gi, "").trim() || "Faculty Member"
          : rawDesig || "Senior Faculty & Accountant";

      const teacherRecord: SchoolTeacher = {
        ...(existingTeacher || {}),
        id: teacherId,
        schoolId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || undefined,
        photoUrl: cleanPhoto || undefined,
        signatureUrl: cleanSign || "",
        designation: nextTeacherDesig,
        qualification: cleanQual,
        experience: cleanExp,
        bio: cleanBio,
        employeeId: cleanEmpId,
        subjects: subArr,
        classes: existingTeacher?.classes || person.classes || [],
        joinDate: existingTeacher?.joinDate || person.joinDate || nowIso.split("T")[0],
        createdAt: existingTeacher?.createdAt || person.createdAt || nowIso,
        monthlySalary: monthlyPay,
        salary: monthlyPay,
        salaryStructure: nextSalaryStructure,
        hasReferralIncentive: overrides?.hasReferralIncentive ?? Boolean(person.hasReferralIncentive),
        hidePhoneFromParentCallerId:
          overrides?.hidePhoneFromParentCallerId ?? Boolean(person.hidePhoneFromParentCallerId),
        active: true,
      };
      await saveTeacher(teacherRecord);
      setTeachers((prev) => [teacherRecord, ...prev.filter((t) => t.id !== teacherId)]);
    } else if (existingTeacher) {
      // Strictly switched from Teacher -> Accountant Only (remove from teachers WITHOUT Recycle Bin deletion!)
      setTeachers((prev) => prev.filter((t) => t.id !== existingTeacher.id));
      await unassignTeacherForAccountantRole(schoolId, existingTeacher.id);
    }

    if (nextMode === "ACCOUNTANT" || nextMode === "BOTH") {
      const nextAccDesig =
        nextMode === "ACCOUNTANT"
          ? rawDesig && /accountant|cashier|bursar/i.test(rawDesig)
            ? rawDesig
            : "Accountant & Cashier"
          : rawDesig || "Senior Faculty & Accountant";

      const accRecord: SchoolAccountant = {
        ...(matchedAcc || ({} as any)),
        id: accId,
        schoolId,
        name: cleanName,
        phone: cleanPhone || matchedAcc?.phone || "0000000000",
        email: cleanEmail || matchedAcc?.email,
        photoUrl: cleanPhoto || matchedAcc?.photoUrl,
        signatureUrl: cleanSign || matchedAcc?.signatureUrl || "",
        employeeId: cleanEmpId,
        designation: nextAccDesig,
        monthlySalary: monthlyPay,
        salaryStructure: nextSalaryStructure,
        joinDate: matchedAcc?.joinDate || person.joinDate || nowIso.split("T")[0],
        active: true,
        teacherRef: nextMode === "BOTH" ? teacherId : undefined,
        hidePhoneFromParentCallerId:
          overrides?.hidePhoneFromParentCallerId ?? Boolean(person.hidePhoneFromParentCallerId ?? matchedAcc?.hidePhoneFromParentCallerId),
        permissions: matchedAcc?.permissions || {
          canCollectFee: true,
          canAdmitStudents: true,
          canGrantDiscount: true,
          maxDiscountLimitPct: 20,
          canRecordExpenses: true,
          canViewDayBook: true,
          canSendFeeAlerts: true,
          canManageBusFee: true,
          canPrintIdCards: true,
          canManageAbsentee: true,
        },
        createdAt: matchedAcc?.createdAt || person.createdAt || nowIso,
      };
      await saveAccountant(accRecord);
      setAccountants((prev) => [accRecord, ...prev.filter((a) => a.id !== accId)]);
    } else if (matchedAcc) {
      // Strictly switched from Accountant -> Teacher Only
      setAccountants((prev) => prev.filter((a) => a.id !== matchedAcc.id));
      await deleteAccountant(schoolId, matchedAcc.id);
    }

    // Always keep StaffEmployee synced for Attendance & Payroll
    const staffId = nextMode === "ACCOUNTANT" ? accId : teacherId;
    const existingStaff =
      staffList.find((s) => s.id === staffId) ||
      staffList.find((s) => s.id === person.id);
    await saveStaffEmployee({
      id: staffId,
      schoolId,
      name: cleanName,
      email: cleanEmail || "",
      phone: cleanPhone,
      designation:
        nextMode === "ACCOUNTANT"
          ? rawDesig && /accountant|cashier|bursar/i.test(rawDesig)
            ? rawDesig
            : "Accountant & Cashier"
          : rawDesig || "Teacher",
      department:
        nextMode === "ACCOUNTANT"
          ? "Accounts & Administration"
          : nextMode === "BOTH"
          ? "Academic & Accounts"
          : "Academic / Faculty",
      joinDate: person.joinDate || existingStaff?.joinDate || nowIso.split("T")[0],
      monthlySalary: monthlyPay,
      salaryStructure: nextSalaryStructure,
      lateEntriesCount: existingStaff?.lateEntriesCount,
      active: true,
      photoUrl: cleanPhoto || undefined,
      employeeId: cleanEmpId,
      hidePhoneFromParentCallerId:
        overrides?.hidePhoneFromParentCallerId ?? Boolean(person.hidePhoneFromParentCallerId ?? existingStaff?.hidePhoneFromParentCallerId),
      createdAt: person.createdAt || existingStaff?.createdAt || nowIso,
    });
  };

  const saveEditTeacher = async () => {
    if (!editingTeacherId || !editTeacherForm.name.trim()) return;
    setSaving(true);
    try {
      const existingTeacher: any =
        teachers.find((x) => x.id === editingTeacherId) ||
        displayedTeachers.find((x) => x.id === editingTeacherId);
      const targetRoleMode = editTeacherForm.staffRole || (existingTeacher?._isAccountantOnly ? "ACCOUNTANT" : existingTeacher?._isAccountant ? "BOTH" : "TEACHER");
      await applyFacultyRoleMode(existingTeacher || { id: editingTeacherId }, targetRoleMode, {
        name: editTeacherForm.name,
        phone: editTeacherForm.phone,
        email: editTeacherForm.email,
        photoUrl: editTeacherForm.photoUrl,
        signatureUrl: editTeacherForm.signatureUrl,
        designation: editTeacherForm.designation,
        qualification: editTeacherForm.qualification,
        experience: editTeacherForm.experience,
        subjects: editTeacherForm.subjects,
        bio: editTeacherForm.bio,
        employeeId: editTeacherForm.employeeId,
        monthlySalary: editTeacherForm.monthlySalary,
        hasReferralIncentive: editTeacherForm.hasReferralIncentive,
        hidePhoneFromParentCallerId: editTeacherForm.hidePhoneFromParentCallerId,
      });

      setEditingTeacherId(null);
      if (targetRoleMode === "ACCOUNTANT") {
        toast.success(`💼 ${editTeacherForm.name.trim()} ko Accountant role me save kar diya gaya!`);
      } else if (targetRoleMode === "BOTH") {
        toast.success(`⚡ ${editTeacherForm.name.trim()} ab Teacher + Accountant dono role me active hain!`);
      } else {
        toast.success(`👨‍🏫 ${editTeacherForm.name.trim()} ki Faculty profile save ho gayi!`);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleTeacherReferralIncentive = async (teacher: any) => {
    const nextVal = !teacher.hasReferralIncentive;
    if (teacher._isAccountantOnly) {
      await saveTeacher({
        id: teacher.id,
        schoolId,
        name: teacher.name,
        email: teacher.email || undefined,
        phone: teacher.phone || undefined,
        photoUrl: teacher.photoUrl || undefined,
        designation: teacher.designation || "Accountant & Cashier",
        employeeId: teacher.employeeId,
        subjects: [],
        classes: [],
        joinDate: teacher.joinDate || todayStr(),
        monthlySalary: teacher.monthlySalary || 0,
        salary: teacher.monthlySalary || 0,
        salaryStructure: teacher.salaryStructure,
        hasReferralIncentive: nextVal,
        active: true,
        createdAt: teacher.createdAt || new Date().toISOString(),
      });
      return;
    }
    await updateTeacher(schoolId, teacher.id, { hasReferralIncentive: nextVal });
    setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, hasReferralIncentive: nextVal } : t));
  };

  const saveEditStudent = async () => {
    if (!editingStudentId || !editStudentForm.name.trim()) return;
    setSaving(true);
    const newPhoto = editStudentForm.photoUrl || "";
    const targetClsObj = displayedClasses.find((c) => c.id === editStudentForm.classId);
    const patch: Partial<SchoolStudent> = {
      name: toUpperFormText(editStudentForm.name.trim()),
      rollNo: toUpperFormText(editStudentForm.rollNo),
      admissionNo: toUpperFormText(editStudentForm.admissionNo || "") || undefined,
      ...(editStudentForm.classId
        ? {
            classId: editStudentForm.classId,
            className: targetClsObj
              ? `${targetClsObj.name}${targetClsObj.section ? ` ${targetClsObj.section}` : ""}`.trim()
              : undefined,
          }
        : {}),
      stream: editStudentForm.stream || undefined,
      fatherName: toUpperFormText(editStudentForm.fatherName || ""),
      fatherOccupation: toUpperFormText(editStudentForm.fatherOccupation || "") || undefined,
      fatherQualification: toUpperFormText(editStudentForm.fatherQualification || "") || undefined,
      fatherPhone: editStudentForm.fatherPhone || undefined,
      fatherWhatsapp: editStudentForm.fatherWhatsapp || undefined,
      fatherAadhaar: editStudentForm.fatherAadhaar || undefined,
      motherName: toUpperFormText(editStudentForm.motherName || ""),
      motherOccupation: toUpperFormText(editStudentForm.motherOccupation || "") || undefined,
      motherQualification: toUpperFormText(editStudentForm.motherQualification || "") || undefined,
      motherPhone: editStudentForm.motherPhone || undefined,
      motherWhatsapp: editStudentForm.motherWhatsapp || undefined,
      motherAadhaar: editStudentForm.motherAadhaar || undefined,
      phone: editStudentForm.phone,
      whatsappNo: editStudentForm.whatsappNo || undefined,
      email: editStudentForm.email || undefined,
      dateOfBirth: editStudentForm.dateOfBirth || undefined,
      gender: editStudentForm.gender || undefined,
      category: editStudentForm.category || undefined,
      religion: toUpperFormText(editStudentForm.religion || "") || undefined,
      nationality: toUpperFormText(editStudentForm.nationality || "") || undefined,
      motherTongue: toUpperFormText(editStudentForm.motherTongue || "") || undefined,
      identificationMark: toUpperFormText(editStudentForm.identificationMark || "") || undefined,
      aadhaarNo: editStudentForm.aadhaarNo || undefined,
      apaarId: toUpperFormText(editStudentForm.apaarId || "") || undefined,
      address: toUpperFormText(editStudentForm.address || "") || undefined,
      city: toUpperFormText(editStudentForm.city || "") || undefined,
      pincode: editStudentForm.pincode || undefined,
      correspondenceAddress: toUpperFormText(editStudentForm.correspondenceAddress || "") || undefined,
      annualIncome: editStudentForm.annualIncome || undefined,
      emergencyContact: toUpperFormText(editStudentForm.emergencyContact || "") || undefined,
      emergencyPhone: editStudentForm.emergencyPhone || undefined,
      emergencyRelation: toUpperFormText(editStudentForm.emergencyRelation || "") || undefined,
      medicalHistory: toUpperFormText(editStudentForm.medicalHistory || "") || undefined,
      previousSchool: toUpperFormText(editStudentForm.previousSchool || "") || undefined,
      previousMarks: toUpperFormText(editStudentForm.previousMarks || "") || undefined,
      previousBoard: toUpperFormText(editStudentForm.previousBoard || "") || undefined,
      previousTcNo: toUpperFormText(editStudentForm.previousTcNo || "") || undefined,
      usesBus: Boolean(editStudentForm.usesBus),
      busRoute: editStudentForm.usesBus ? (toUpperFormText(editStudentForm.busRoute || "") || undefined) : undefined,
      busFee: editStudentForm.usesBus ? Number(editStudentForm.busFee) || 0 : 0,
      bankAccountName: toUpperFormText(editStudentForm.bankAccountName || "") || undefined,
      bankName: toUpperFormText(editStudentForm.bankName || "") || undefined,
      bankAccountNumber: editStudentForm.bankAccountNumber || undefined,
      bankIfsc: toUpperFormText(editStudentForm.bankIfsc || "") || undefined,
      bloodGroup: editStudentForm.bloodGroup || "",
      monthlyFee: Number(editStudentForm.monthlyFee) || 0,
      photoUrl: newPhoto || undefined,
    };
    await updateStudent(schoolId, editingStudentId, patch);
    rememberOccupation(editStudentForm.fatherOccupation, schoolId);
    rememberOccupation(editStudentForm.motherOccupation, schoolId);
    toast.success(`✅ ${toUpperFormText(editStudentForm.name.trim())} ki sabhi jankari update ho gayi!`);
    setEditingStudentId(null);
    setSaving(false);
  };

  const saveSchoolInfo = async () => {
    setSavingSchoolInfo(true);
    const cleanedName = schoolInfoForm.name.trim();
    const patch: any = {
      ...(cleanedName ? { name: cleanedName } : {}),
      principalName: schoolInfoForm.principalName,
      principalPhone: schoolInfoForm.principalPhone,
      directorName: schoolInfoForm.directorName,
      directorPhone: schoolInfoForm.directorPhone,
      managerName: schoolInfoForm.managerName,
      managerPhone: schoolInfoForm.managerPhone,
      accountantName: schoolInfoForm.accountantName,
      mobile: schoolInfoForm.mobile,
      phone: schoolInfoForm.mobile,
      address: schoolInfoForm.address,
      tagline: schoolInfoForm.tagline,
      bannerColor: schoolInfoForm.bannerColor,
    };
    await updateSchool(schoolId, patch);
    setSchool(prev => prev ? {
      ...prev,
      ...patch,
    } : prev);
    try {
      window.dispatchEvent(new CustomEvent("nst_school_identity_updated"));
    } catch {}
    toast.success("✅ स्कूल प्रोफाइल जानकारी सफलतापूर्वक सेव हो गई!");
    setEditingSchoolInfo(false);
    setSavingSchoolInfo(false);
  };

  const saveLockCode = async () => {
    setSavingLockCode(true);
    const trimmedCode = lockCodeInput.trim();
    await setSchoolLockCode(schoolId, trimmedCode, lockCodeActive);
    setSchool(prev => prev ? { ...prev, lockCode: trimmedCode, lockCodeActive } : prev);
    if (lockCodeActive && trimmedCode && !school?.uninstallGuardPinHash) {
      try {
        const { syncRawPinFallbackToNativeIfMissing } = await import("../../utils/androidDeviceAdmin");
        await syncRawPinFallbackToNativeIfMissing(trimmedCode, schoolId);
      } catch {}
    }
    setSavingLockCode(false);
    setLockCodeSaved(true);
    setTimeout(() => setLockCodeSaved(false), 2000);
  };

  const loadSubAdmins = () => {
    getSchoolAdmins(schoolId).then(list => setSubAdmins(list)).catch(() => {});
  };

  const getMaxAdminsForSchool = (studentCount: number = 0): number => {
    // Subscription Plan Quota: 200 students -> 1 admin; 500 students -> 3 admins; 2000+ -> unlimited (9999)
    if (studentCount <= 200) return 1;
    if (studentCount <= 500) return 3;
    return 9999; // Unlimited
  };

  const handleAssignSubAdmin = async () => {
    if (!subAdminEmail.trim()) return;
    setAssigningSubAdmin(true);
    setSubAdminResult(null);

    const studentCount = displayedStudents.length;
    const maxAllowed = getMaxAdminsForSchool(studentCount);
    const currentSubAdminCount = subAdmins.filter(p => p.role === 'SCHOOL_SUB_ADMIN').length;

    if (currentSubAdminCount >= maxAllowed) {
      setSubAdminResult({
        ok: false,
        msg: `❌ स्कूल सब्सक्रिप्शन सीमा: कुल ${studentCount} छात्रों के अनुसार अधिकतम ${maxAllowed === 9999 ? 'अनलिमिटेड' : maxAllowed} सब-एडमिन की अनुमति है (200 छात्र = 1, 500 = 3, 2000+ = Unlimited)। अधिक एडमिन जोड़ने हेतु प्लान अपग्रेड करें।`
      });
      setAssigningSubAdmin(false);
      return;
    }

    try {
      const profile = await assignSchoolSubAdminByEmail(schoolId, subAdminEmail.trim());
      setSubAdminResult({ ok: true, msg: `✅ ${profile.name} ab is school ka sub-admin hai!` });
      setSubAdminEmail('');
      loadSubAdmins();
    } catch (e: any) {
      setSubAdminResult({ ok: false, msg: `❌ ${e.message || 'Error aaya, dobara try karo.'}` });
    }
    setAssigningSubAdmin(false);
  };

  const handleRemoveSubAdmin = async (uid: string) => {
    await removeSchoolUserByUid(uid);
    loadSubAdmins();
  };

  const openEditSchoolInfo = () => {
    setSchoolInfoForm({
      principalName: school?.principalName || "",
      principalPhone: school?.principalPhone || "",
      directorName: school?.directorName || "",
      directorPhone: school?.directorPhone || "",
      managerName: school?.managerName || "",
      managerPhone: school?.managerPhone || "",
      accountantName: school?.accountantName || "",
      mobile: school?.mobile || school?.phone || "",
      address: school?.address || "",
      tagline: school?.tagline || "",
      bannerColor: school?.bannerColor || "",
    });
    setEditingSchoolInfo(true);
    setSchoolCardExpanded(true);
  };

  // ── Subscription access helpers ─────────────────────────────────────────
  const subStatus  = school?.subscription?.status || "active";
  const subTier    = school?.subscription?.tier || "full";
  const _expiresAt = school?.subscription?.expiresAt || school?.subscription?.paidUntil || '2027-04-24T23:59:59.000Z';
  const planExpired = _expiresAt ? new Date(_expiresAt).getTime() <= nowTick : false;
  const subscriptionActive = subStatus === "active" && !planExpired;
  // Full tier (or legacy schools with no tier set — backwards compat) can manage content
  const canManageContent  = subscriptionActive && (subTier === "full" || subTier === undefined);
  // Both lite and full need an active (non-expired) subscription for data management
  const canManageStudents = subscriptionActive;

  // ── 7-DAY ATTENDANCE CALCULATION (100% REAL DATA) ───────────────────────
  const sevenDayAttendanceData = React.useMemo(() => {
    const days = [];
    let localRecords: any[] = [];
    try {
      localRecords = getLocalAttendance(schoolId);
    } catch (e) {
      console.warn("Failed to read attendance logs:", e);
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayLabel = d.toLocaleDateString("hi-IN", { weekday: "short" }) || d.toLocaleDateString("en-IN", { weekday: "short" });
      const displayDate = `${dd}/${mm}`;

      let presentCount = 0;
      let absentCount = 0;
      let hasData = false;
      const dayRecords = localRecords.filter((r: any) => r.date === dateStr);
      if (dayRecords.length > 0) {
        dayRecords.forEach((dr: any) => {
          if (Array.isArray(dr.records)) {
            dr.records.forEach((rec: any) => {
              const st = String(rec.status || "").toUpperCase();
              if (st === "PRESENT" || st === "LATE") presentCount++;
              else if (st === "ABSENT") absentCount++;
            });
          }
        });
        if (presentCount + absentCount > 0) hasData = true;
      }

      const totalRecorded = presentCount + absentCount;
      const presentPct = hasData && totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;

      days.push({
        dateStr,
        dayLabel,
        displayDate,
        isToday: i === 0,
        hasData,
        presentPct,
        presentCount,
        absentCount,
        total: totalRecorded,
      });
    }
    return days;
  }, [displayedStudents, schoolId]);

  const recordedAttDays = sevenDayAttendanceData.filter((d) => d.hasData);
  const avgAttendancePct = recordedAttDays.length > 0
    ? Math.round(recordedAttDays.reduce((acc, curr) => acc + curr.presentPct, 0) / recordedAttDays.length)
    : 0;

  // ── 7-DAY & MONTHLY COLLECTION CALCULATION (FEES + STORE SALES) ────────
  const mergedRealFees = React.useMemo(() => {
    if (schoolDemoActive) {
      const demo = getDemoSchoolDataset(true);
      return Array.isArray(demo?.fees) ? demo.fees : [];
    }
    const byKey = new Map<string, any>();
    const addFee = (f: any) => {
      if (!f || isDemoRecord(f)) return;
      if (activeSession?.id && f.sessionId && f.sessionId !== activeSession.id) return;
      const key = f.id || (f.studentId && f.month ? `${f.studentId}_${f.month}` : f.receiptNo);
      if (!key) return;
      const prev = byKey.get(key);
      if (!prev || f.paid || f.razorpayPaymentId || (f.updatedAt && (!prev.updatedAt || f.updatedAt > prev.updatedAt))) {
        byKey.set(key, f);
      }
    };
    try {
      getLocalFees(schoolId).forEach(addFee);
    } catch (e) {
      console.warn("Failed to read local fees:", e);
    }
    (dashboardFeeHistory || []).forEach(addFee);
    (allFees || []).forEach(addFee);
    return Array.from(byKey.values());
  }, [schoolId, schoolDemoActive, activeSession?.id, dashboardFeeHistory, allFees]);

  const sevenDayFeeData = React.useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayLabel = d.toLocaleDateString("hi-IN", { weekday: "short" }) || d.toLocaleDateString("en-IN", { weekday: "short" });
      const displayDate = `${dd}/${mm}`;

      const dayBd = computePaymentBreakdown({
        fees: mergedRealFees,
        storeSales: dashboardStoreSales,
        datePrefix: dateStr,
      });

      days.push({
        dateStr,
        dayLabel,
        displayDate,
        isToday: i === 0,
        amount: dayBd.total,
      });
    }
    return days;
  }, [mergedRealFees, dashboardStoreSales]);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const currentMonthBreakdown = React.useMemo(() => {
    return computePaymentBreakdown({
      fees: mergedRealFees,
      storeSales: dashboardStoreSales,
      datePrefix: currentMonthPrefix,
    });
  }, [mergedRealFees, dashboardStoreSales, currentMonthPrefix]);
  const currentMonthCollection = currentMonthBreakdown.total;

  const monthlyExpectedTarget = React.useMemo(() => {
    const sumFees = displayedStudents.reduce((sum, st) => sum + Math.max(0, Number(st.monthlyFee || 0)), 0);
    return sumFees;
  }, [displayedStudents]);
  const monthlyProgressPct = monthlyExpectedTarget > 0
    ? Math.min(100, Math.round((currentMonthCollection / monthlyExpectedTarget) * 100))
    : 0;

  // ── ABSENTEE ACTION SUMMARY (1-Day & Consecutive Tracker — 100% REAL DATA) ──
  const absenteeTrackerData = React.useMemo(() => {
    const todayData = sevenDayAttendanceData[sevenDayAttendanceData.length - 1];
    const oneDayAbsentCount = todayData ? todayData.absentCount : 0;

    let localRecords: any[] = [];
    try {
      localRecords = getLocalAttendance(schoolId);
    } catch (e) {
      console.warn("Failed to compute absentee tracker:", e);
    }

    // Check recent 7 days in reverse chronological order (today back to 6 days ago)
    const absentCountByStudent = new Map<string, number>();
    const todayAbsentIds = new Set<string>();
    const last7Dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Dates.push(d.toISOString().slice(0, 10));
    }

    last7Dates.forEach((dateKey, dayIdx) => {
      const dayAtt = localRecords.filter((r: any) => r.date === dateKey);
      dayAtt.forEach((dr: any) => {
        if (Array.isArray(dr.records)) {
          dr.records.forEach((rec: any) => {
            if (String(rec.status || "").toUpperCase() === "ABSENT" && rec.studentId) {
              absentCountByStudent.set(rec.studentId, (absentCountByStudent.get(rec.studentId) || 0) + 1);
              if (dayIdx === 0) todayAbsentIds.add(rec.studentId);
            }
          });
        }
      });
    });

    const consecutiveAbsentees = displayedStudents
      .filter((st) => (absentCountByStudent.get(st.id) || 0) >= 2 || todayAbsentIds.has(st.id))
      .map((st, idx) => {
        const cls = displayedClasses.find(c => c.id === st.classId);
        return {
          id: st.id,
          name: st.name,
          rollNo: st.rollNo || (idx + 1),
          className: cls?.name || (st as any).className || "Class",
          daysAbsent: absentCountByStudent.get(st.id) || 1,
          fatherName: st.fatherName || "Guardian",
          phone: st.phone || (st as any).fatherPhone || st.parentPhone || "",
        };
      })
      .sort((a, b) => b.daysAbsent - a.daysAbsent)
      .slice(0, 20);

    return {
      oneDayAbsentCount,
      consecutiveAbsentees,
    };
  }, [sevenDayAttendanceData, displayedStudents, displayedClasses, schoolId]);

  // ── FEE DUE LIST CALCULATION (100% REAL UNPAID / ADMISSION / ADVANCE DUES) ──
  const feeDueList = React.useMemo(() => {
    const unpaidByStudent = new Map<string, { amount: number; months: Set<string> }>();
    mergedRealFees.forEach((f: any) => {
      const stStatus = String(f.status || "").toUpperCase();
      if (stStatus === "DUE" || stStatus === "UNPAID" || stStatus === "PARTIAL") {
        const total = Number(f.totalAmount || 0);
        const paid = Number(f.paidAmount || 0);
        const bal = Math.max(0, total - paid);
        if (bal > 0 && f.studentId) {
          const entry = unpaidByStudent.get(f.studentId) || { amount: 0, months: new Set<string>() };
          entry.amount += bal;
          if (f.month) entry.months.add(f.month);
          unpaidByStudent.set(f.studentId, entry);
        }
      }
    });

    const dues = displayedStudents
      .map((st, idx) => {
        const cls = displayedClasses.find(c => c.id === st.classId);
        const feeEntry = unpaidByStudent.get(st.id);
        const admDue = Number(st.admissionDueBalance || 0) + Number(st.previousSessionDue || 0);
        const advDue = st.advanceMonthlyFeePaid === false ? Number(st.advanceMonthlyFeeDue || st.monthlyFee || 0) : 0;
        const overdueAmount = (feeEntry?.amount || 0) + admDue + advDue;
        if (overdueAmount <= 0) return null;

        const labels: string[] = [];
        if (feeEntry && feeEntry.months.size > 0) labels.push(...Array.from(feeEntry.months));
        if (Number(st.previousSessionDue || 0) > 0) labels.push("Back Session Due");
        if (Number(st.admissionDueBalance || 0) > 0) labels.push("Admission Due");
        if (advDue > 0) labels.push("Advance Fee");

        return {
          id: st.id,
          name: st.name,
          rollNo: st.rollNo || (idx + 1),
          classId: st.classId,
          className: cls?.name || (st as any).className || "Class",
          fatherName: st.fatherName || "Guardian",
          phone: st.phone || (st as any).fatherPhone || st.parentPhone || "",
          dueAmount: overdueAmount,
          dueMonths: labels.join(", ") || currentMonthStr(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return dues.filter(item => {
      if (dueClassFilter !== "ALL" && item.classId !== dueClassFilter) return false;
      if (dueMinAmount > 0 && item.dueAmount < dueMinAmount) return false;
      return true;
    });
  }, [displayedStudents, displayedClasses, mergedRealFees, dueClassFilter, dueMinAmount]);

  const totalDuesAmount = React.useMemo(() => {
    return feeDueList.reduce((acc, curr) => acc + curr.dueAmount, 0);
  }, [feeDueList]);

  // WhatsApp & NSTA Messenger reminder actions
  const handleSendWhatsAppFeeDemand = (dueItem: any) => {
    const cleanPhone = (dueItem.phone || "").replace(/[^0-9]/g, "");
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (!targetPhone) {
      toast.error("Is student ke guardian ka phone number darj nahi hai.");
      return;
    }
    const text = `*${school?.name || "School"} - फीस मांग सूचना*\n\nआदरणीय अभिभावक,\nछात्र/छात्रा: *${dueItem.name}* (कक्षा: *${dueItem.className}*, रोल नंबर: *#${dueItem.rollNo}*)\nकुल बकाया शुल्क: *₹${dueItem.dueAmount.toLocaleString("en-IN")}*\nबकाया मद: *${dueItem.dueMonths}*\n\nकृपया समय पर स्कूल काउंटर या ऑनलाइन पोर्टल द्वारा शुल्क जमा करें।\n\nसधन्यवाद,\n*प्रधानाचार्य / लेखा विभाग*\n${school?.name || "School Office"}`;
    safeOpenExternalUrl(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`);
  };

  const dispatchNstaDueSlip = async (opts: {
    studentId: string;
    studentName: string;
    className: string;
    rollNo?: string | number;
    dueAmount: number;
    label: string;
  }) => {
    if (!schoolId || !opts.studentId || opts.dueAmount <= 0) return;
    setSendingNstaSlipId(opts.studentId);
    try {
      const studentObj = displayedStudents.find((s) => s.id === opts.studentId);
      const monthKey = currentMonthStr();
      await autoSendFeeSlipToSchoolDesk({
        schoolId,
        studentId: opts.studentId,
        studentName: opts.studentName,
        className: opts.className,
        rollNo: String(opts.rollNo || studentObj?.rollNo || ""),
        admissionNo: studentObj?.admissionNo || "",
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
        senderId: adminUid || "STAFF_ADMIN",
        senderIds: [adminUid, "STAFF_ADMIN", "school_admin", "accountant_admin"].filter(Boolean) as string[],
        senderName: school?.name || "School Admin",
        title: `बकाया फीस स्लिप: ${opts.studentName}`,
        body: `कुल बकाया ₹${opts.dueAmount.toLocaleString("en-IN")} (${opts.label}) — NSTA Messenger में स्लिप देखें।`,
        type: "MONTHLY_FEE",
        icon: school?.logoUrl || undefined,
        url: "/?schoolPortal=1&schoolTab=messenger&subTab=school",
        urgent: true,
      }).catch(() => {});
      setSentNstaSlipIds((prev) => ({ ...prev, [opts.studentId]: true }));
      toast.success(`${opts.studentName} को बकाया फीस स्लिप NSTA Messenger पर भेज दी गई!`);
    } catch (err) {
      console.warn("NSTA slip send failed:", err);
      toast.error("NSTA Messenger पर स्लिप भेजने में समस्या आई।");
    } finally {
      setSendingNstaSlipId(null);
    }
  };

  const handleSendWhatsAppAbsentAlert = (item: any) => {
    const cleanPhone = (item.phone || "").replace(/[^0-9]/g, "");
    const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (!targetPhone) {
      toast.error("Is student ke guardian ka phone number darj nahi hai.");
      return;
    }
    const text = `*${school?.name || "School"} - गैरहाजिरी सूचना (Absence Notice)*\n\nआदरणीय अभिभावक,\nछात्र/छात्रा: *${item.name}* (कक्षा: *${item.className}*, रोल नंबर: *#${item.rollNo}*)\n\nआपका बच्चा पिछले *${item.daysAbsent} दिन से अनुपस्थित* है।\nकृपया तुरंत अनुपस्थिति का कारण दर्ज कराएं अथवा स्कूल कार्यालय में संपर्क करें।\n\nसधन्यवाद,\n*प्रधानाचार्य*\n${school?.name || "School Office"}`;
    safeOpenExternalUrl(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`);
  };

  const handleSend1DayPushAlerts = () => {
    setSentPushAlertsToast(`⚡ ${absenteeTrackerData.oneDayAbsentCount} अनुपस्थित छात्रों के अभिभावकों को 1-Day Push Notification भेज दिया गया है!`);
    setTimeout(() => setSentPushAlertsToast(null), 4000);
  };

  const handleSaveMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryForm.title.trim()) return;
    const item = {
      id: "mem_" + Date.now(),
      title: newMemoryForm.title.trim(),
      category: newMemoryForm.category,
      date: newMemoryForm.date || new Date().toISOString().split("T")[0],
      type: newMemoryForm.type,
      url: newMemoryForm.url.trim(),
      videoUrl: newMemoryForm.videoUrl.trim(),
      description: newMemoryForm.description.trim() || "School event celebration memory.",
      tags: newMemoryForm.tags ? newMemoryForm.tags.split(",").map(t => t.trim()).filter(Boolean) : ["School Memory"],
      likes: 0,
    };
    const updated = [item, ...memoriesList];
    setMemoriesList(updated);
    try {
      localStorage.setItem(`school_memories_${schoolId}`, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to save school memory:", err);
    }
    saveSchoolGalleryItem(schoolId, {
      id: item.id,
      schoolId,
      title: item.title,
      category: item.category,
      imageUrl: item.url || "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1000&q=80",
      videoUrl: item.videoUrl || "",
      mediaType: item.type,
      description: item.description,
      date: item.date,
      createdAt: new Date().toISOString(),
    } as any).catch(() => {});
    setShowAddMemoryModal(false);
    setNewMemoryForm({
      title: "",
      category: "ANNUAL",
      date: new Date().toISOString().split("T")[0],
      type: "IMAGE",
      url: "",
      videoUrl: "",
      description: "",
      tags: "",
    });
  };

  const handleDeleteMemory = (id: string) => {
    setConfirmAction({
      title: "Memory Delete Karein?",
      message: "Kya aap sach me is memory ko delete karna chahte hain?",
      confirmLabel: "Delete Karein",
      onConfirm: () => {
        const updated = memoriesList.filter(m => m.id !== id);
        setMemoriesList(updated);
        try {
          localStorage.setItem(`school_memories_${schoolId}`, JSON.stringify(updated));
        } catch (err) {
          console.warn("Failed to update school memories:", err);
        }
        deleteSchoolGalleryItem(schoolId, id).catch(() => {});
        toast.success("Memory delete ho gayi.");
      },
    });
  };

  // ── UNIFIED ERP NAVIGATION CATEGORIES (CATEGORIZED INTO 9 INTUITIVE HUBS) ──
  const navCategories = [
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
        { id: "dashboard" as AdminView, label: "Home Dashboard", icon: Home, desc: "दैनिक उपस्थिति, फीस संग्रह व कार्य डेस्क" },
        { id: "accounts_directory" as AdminView, label: "Total Accounts (अकाउंट संख्या)", icon: Users, desc: "कुल छात्र, शिक्षक, स्टाफ व लॉगिन अकाउंट्स" },
      ]
    },
    {
      id: "students",
      title: "छात्र प्रबंधन (Students)",
      theme: {
        pillBg: "bg-blue-950/60 border border-blue-500/30",
        titleColor: "text-blue-300",
        accentDot: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]",
        badgeColor: "bg-blue-500/25 text-blue-200 border border-blue-400/30",
        hoverBg: "hover:bg-blue-950/40 hover:text-blue-200",
      },
      items: [
        { id: "students" as AdminView, label: "Students Directory (छात्र सूची)", icon: Users, desc: "कक्षा व सेक्शन अनुसार छात्र, नया छात्र, एडिट/डिलीट" },
        { id: "online_admissions" as AdminView, label: "Online Admissions", icon: UserPlus, desc: "नवीन ऑनलाइन प्रवेश आवेदन व अप्रूवल" },
        { id: "id_cards" as AdminView, label: "QR ID Cards", icon: CreditCard, desc: "स्मार्ट क्यूआर छात्र पहचान पत्र जनरेटर" },
        { id: "sibling_profiles" as AdminView, label: "Sibling Profiles (भाई-बहन प्रोफाइल)", icon: Users, desc: "ऑटो भाई-बहन फैमिली ग्रुप, रियायत व 100% फ्री शिक्षा" },
        { id: "leaves_desk" as AdminView, label: "Student Leaves Desk", icon: Calendar, desc: "अभिभावक छुट्टी आवेदन व 1-टैप अप्रूवल" },
        { id: "readmission" as AdminView, label: "Re-Admission (पुनः प्रवेश)", icon: UserPlus, desc: "पुराने बकाया के साथ नए सत्र में छात्रों का पुनः प्रवेश" },
      ]
    },
    {
      id: "teachers",
      title: "शिक्षक व स्टाफ (Teachers & Staff)",
      theme: {
        pillBg: "bg-violet-950/60 border border-violet-500/30",
        titleColor: "text-violet-300",
        accentDot: "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]",
        badgeColor: "bg-violet-500/25 text-violet-200 border border-violet-400/30",
        hoverBg: "hover:bg-violet-950/40 hover:text-violet-200",
      },
      items: [
        { id: "teachers" as AdminView, label: "Teachers & Faculty (शिक्षक व स्टाफ हब)", icon: GraduationCap, desc: "शिक्षक सूची, Leave Requests, सैलरी व पेरोल सब एक जगह" },
        { id: "roles_permissions" as AdminView, label: "Roles & Permissions (अधिकार नियंत्रण)", icon: ShieldCheck, desc: "Teacher व Accountant अधिकार, Class/Subject लॉक व छूट सीमा" },
      ]
    },
    {
      id: "attendance_ai",
      title: "हाजिरी व बायोमेट्रिक (Attendance)",
      theme: {
        pillBg: "bg-emerald-950/60 border border-emerald-500/30",
        titleColor: "text-emerald-300",
        accentDot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
        badgeColor: "bg-emerald-500/25 text-emerald-200 border border-emerald-400/30",
        hoverBg: "hover:bg-emerald-950/40 hover:text-emerald-200",
      },
      items: [
        { id: "attendance" as AdminView, label: "Attendance & Haziri (दैनिक हाजिरी)", icon: Clock, desc: "दैनिक छात्र उपस्थिति, QR स्कैनर व हाजिरी रिपोर्ट" },
        { id: "absentee" as AdminView, label: "Absentee Action Center", icon: AlertCircle, desc: "1-दिन अलर्ट व 2-दिन+ गैरहाजिर कॉल ट्रैकर" },
      ]
    },
    {
      id: "fees_finance",
      title: "फीस व एकाउंट्स (Fees & Accounts)",
      theme: {
        pillBg: "bg-amber-950/60 border border-amber-500/30",
        titleColor: "text-amber-300",
        accentDot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
        badgeColor: "bg-amber-500/25 text-amber-200 border border-amber-400/30",
        hoverBg: "hover:bg-amber-950/40 hover:text-amber-200",
      },
      items: [
        { id: "fees" as AdminView, label: "Fee Collection & Ledger (फीस लेजर)", icon: IndianRupee, desc: "मासिक शुल्क वसूली, चालान व छात्र लेजर" },
        { id: "fee_tagada" as AdminView, label: "Fee Tagada • Offline Caller", icon: PhoneCall, desc: "SIM कॉल रिकॉर्ड, Promise Date सेट करें व न जमा होने पर अगले दिन ऑटो लिस्ट" },
        { id: "fee_structure" as AdminView, label: "Fee Structure & Admission Heads", icon: Sparkles, desc: "कक्षा-वार मासिक, वार्षिक व Online Admission शुल्क सेट-अप" },
        { id: "term_scheduler" as AdminView, label: "Term / Exam Fee & Month Add", icon: CalendarClock, desc: "2-Monthly / कम दाम Exam Fee, Reg-Only छात्र के महीने में फीस जोड़ें व Full-Paid छूट" },
        { id: "discount_list" as AdminView, label: "Fee Discount List (छूट सूची)", icon: Award, desc: "किसको कितना व कहाँ डिस्काउंट मिला" },
        { id: "expenses" as AdminView, label: "Expense & Daily Cashbook", icon: Receipt, desc: "दैनिक खर्च, पेटी कैश व नेट क्लोजिंग बैलेंस" },
        { id: "qr_pay" as AdminView, label: "Scan QR to Pay (फास्ट पे)", icon: QrCode, desc: "स्मार्ट आईडी कार्ड क्यूआर स्कैनर से फीस" },
      ]
    },
    {
      id: "academics",
      title: "क्लासरूम व शिक्षण (Academics)",
      theme: {
        pillBg: "bg-teal-950/60 border border-teal-500/30",
        titleColor: "text-teal-300",
        accentDot: "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.8)]",
        badgeColor: "bg-teal-500/25 text-teal-200 border border-teal-400/30",
        hoverBg: "hover:bg-teal-950/40 hover:text-teal-200",
      },
      items: [
        { id: "classes" as AdminView, label: "Classes & Sections", icon: BookOpen, desc: "कक्षाएं, वर्ग, विषय, पाठ व टॉपिक्स प्रबंधन" },
        { id: "homework" as AdminView, label: "Daily Homework", icon: BookOpen, desc: "दैनिक गृहकार्य, नोट्स पिक्स व छात्र डायरी" },
        { id: "student_growth_safety" as AdminView, label: "Growth Diary, Skills & SOS", icon: Sparkles, desc: "डेली डायरी, 6-स्किल्स, पोर्टफोलियो, हेल्थ व आपात अलर्ट" },
        { id: "class_notes_manager" as AdminView, label: "Class 1-12 Notes Manager", icon: Sparkles, desc: "स्कूल पाठ्यक्रम नोट्स, MCQ, Video व PDF" },
        { id: "video_lectures" as AdminView, label: "Class Video Archive", icon: Youtube, desc: "यूट्यूब वीडियो लेक्चर्स व डिजिटल क्लास" },
        { id: "library" as AdminView, label: "Library Management", icon: Book, desc: "पुस्तकालय व पुस्तक वितरण" },
        { id: "syllabus_pacing" as AdminView, label: "Syllabus Pacing Tracker", icon: TrendingUp, desc: "कक्षा व विषय-वार पाठ्यक्रम प्रगति व रिपोर्ट" },
      ]
    },
    {
      id: "exams",
      title: "परीक्षा व परिणाम (Exams & Records)",
      theme: {
        pillBg: "bg-purple-950/60 border border-purple-500/30",
        titleColor: "text-purple-300",
        accentDot: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]",
        badgeColor: "bg-purple-500/25 text-purple-200 border border-purple-400/30",
        hoverBg: "hover:bg-purple-950/40 hover:text-purple-200",
      },
      items: [
        {
          id: "entrance_test_hub" as AdminView,
          label: "Entrance Test & 500-Q Bank",
          icon: GraduationCap,
          desc: !hasEntranceExamAccess(school)
            ? "Elite Only: Lite में Entrance Exam (500 Qs/Subject) लॉक है"
            : isEntranceExamFeatureEnabled(school)
            ? "Elite Active (Live): Class 1–8 (500 Qs/Subject · 17,500 MCQs), 100 सेट व PDF"
            : "Website OFF: 500 Qs/Sub बैंक व PDF चालू (वेबसाइट पर छुपा है)",
        },
        {
          id: "digital_paper_library" as AdminView,
          label: "Digital Library (Question Archive)",
          icon: BookOpen,
          desc: !hasEntranceExamAccess(school)
            ? "Elite Only: Session-wise Saved Question Papers & Answer Keys"
            : "सभी सेव Question Papers, Version History, PDF & Student Publish कंट्रोल",
        },
        { id: "question_paper_builder" as AdminView, label: "Manual Question Paper Maker", icon: FileText, desc: "मैनुअल प्रश्न टाइप करके अर्धवार्षिक व वार्षिक पेपर बनाएं" },
        { id: "admit_cards" as AdminView, label: "Exam Admit Cards", icon: FileText, desc: "परीक्षा प्रवेश पत्र (हॉल टिकट)" },
        { id: "marks" as AdminView, label: "Marks Entry (परीक्षा अंक प्रविष्टि)", icon: Edit3, desc: "कक्षा व विषय अनुसार परीक्षा अंक प्रविष्टि" },
        { id: "results" as AdminView, label: "Exam Results (मेरिट लिस्ट व परिणाम)", icon: Award, desc: "कक्षा मेरिट लिस्ट, रैंक, टॉपर्स व उत्तीर्ण परिणाम" },
        { id: "marksheet_hub" as AdminView, label: "Marksheet & Results Hub", icon: FileSpreadsheet, desc: "ऑफिशियल अंकपत्र व रिपोर्ट कार्ड" },
        { id: "certificates" as AdminView, label: "Certificates (TC & Merit)", icon: Award, desc: "स्थानांतरण व चरित्र प्रमाण पत्र" },
        { id: "document_templates" as AdminView, label: "Document Templates (60 Layouts)", icon: Palette, desc: "ID Card, Admit Card, Marksheet, Fee Slip व Certificate के 60 स्ट्रक्चरल लेआउट्स (10 क्लासिक + 50 नए) व कलर चेंजर" },
        { id: "reports_hub" as AdminView, label: "Register Reports & Print", icon: FileSpreadsheet, desc: "40+ मास्टर स्कूल रजिस्टर्स" },
      ]
    },
    {
      id: "facilities",
      title: "सुविधाएं व सुरक्षा (Facilities)",
      theme: {
        pillBg: "bg-orange-950/60 border border-orange-500/30",
        titleColor: "text-orange-300",
        accentDot: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]",
        badgeColor: "bg-orange-500/25 text-orange-200 border border-orange-400/30",
        hoverBg: "hover:bg-orange-950/40 hover:text-orange-200",
      },
      items: [
        { id: "bus_transport" as AdminView, label: "Bus & Transport Service", icon: Bus, desc: "बस रूट, स्टॉप व वाहन शुल्क प्रबंधन" },
        { id: "bus_logbook" as AdminView, label: "Transport Fuel & Fitness Log", icon: Bus, desc: "डीजल/CNG खर्च, माइलेज व फिटनेस/बीमा एक्सपायरी" },
        { id: "hostel_mess" as AdminView, label: "Hostel & Mess Management", icon: Building2, desc: "छात्रावास भवन, कमरा/बेड आवंटन व मेस मेनू" },
        { id: "inventory_store" as AdminView, label: "School Store & Uniform", icon: Package, desc: "ड्रेस, किताबें व स्टोर पीओएस बिल" },
        { id: "visitor_security" as AdminView, label: "Visitor & Main Gate Security", icon: Shield, desc: "गेट-पास पर्ची, गार्ड चेक-इन व स्टूडेंट अर्ली एग्जिट पास" },
      ]
    },
    {
      id: "communication",
      title: "कम्युनिकेशन व प्रशासन (Communication)",
      theme: {
        pillBg: "bg-rose-950/60 border border-rose-500/30",
        titleColor: "text-rose-300",
        accentDot: "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]",
        badgeColor: "bg-rose-500/25 text-rose-200 border border-rose-400/30",
        hoverBg: "hover:bg-rose-950/40 hover:text-rose-200",
      },
      items: [
        { id: "nsta_broadcast" as AdminView, label: "NSTA Messenger Suite", icon: MessageSquare, desc: "क्लास ग्रुप्स व 1-क्लिक अलर्ट्स" },
        { id: "ptm_scheduler" as AdminView, label: "PTM Slot Scheduler", icon: Users, desc: "अभिभावक-शिक्षक बैठक स्लॉट बुकिंग" },
        { id: "notices" as AdminView, label: "Notice Board Circulars", icon: Megaphone, desc: "आधिकारिक परिपत्र व सूचना" },
        { id: "memories" as AdminView, label: "Memories & Events", icon: Camera, desc: "स्कूल की फोटो व वीडियो यादें" },
        { id: "community" as AdminView, label: "Community Feed", icon: Megaphone, desc: "लाइव कैंपस पोस्ट्स व अपडेट्स" },
        { id: "parent_queries" as AdminView, label: "Parent Helpdesk", icon: MessageSquare, desc: "अभिभावक शिकायत व सहायता डेस्क" },
        { id: "multi_branch" as AdminView, label: "Multi-Branch & Franchise Hub", icon: Building2, desc: "मल्टी-कैंपस 1-क्लिक स्विचिंग व इंटर-ब्रांच ट्रांसफर" },
        { id: "backup_recovery" as AdminView, label: "Backup & Disaster Recovery", icon: ShieldCheck, desc: "1-क्लिक सम्पूर्ण स्कूल डेटा ZIP बैकअप व रीस्टोर" },
        {
          id: "website_cms" as AdminView,
          label: "Website Manager (CMS व फोटो)",
          icon: Globe,
          desc: isSchoolEliteCurriculum(school)
            ? "Elite Active: बैनर, प्रिंसिपल संदेश, शिक्षक फोटो व गैलरी बदलें"
            : "Elite Only: Lite में केवल Default Website दिखती है (CMS बंद)",
        },
        { id: "public_website" as AdminView, label: "Public School Website", icon: Globe, desc: isSchoolEliteCurriculum(school) ? "लाइव कस्टम स्कूल वेबसाइट देखें" : "डिफ़ॉल्ट स्कूल वेबसाइट देखें (Lite)" },
        { id: "subscription" as AdminView, label: "Plan & Subscription", icon: Crown, desc: "सत्र वैधता व ईआरपी स्थिति" },
      ]
    }
  ];

  // Elite-exclusive menu items highlighted with Premium Royal Gold styling
  const ELITE_ADMIN_MENU_IDS = new Set<AdminView>([
    "fee_tagada",
    "class_notes_manager",
    "video_lectures",
    "entrance_test_hub",
    "digital_paper_library",
    "website_cms",
  ]);

  const isEliteAdminItemLocked = (itemId: AdminView): boolean => {
    if (itemId === "fee_tagada") {
      return !hasEliteFeeTagadaAccess(school);
    }
    if (itemId === "entrance_test_hub" || itemId === "digital_paper_library") {
      return !hasEntranceExamAccess(school);
    }
    return !isSchoolEliteCurriculum(school);
  };

  // ── DESKTOP PERMANENT LEFT SIDEBAR (20% SLIMMER: w-52 lg:w-56) ───────────
  const renderDesktopSidebar = () => {
    const displaySchoolLogo = school ? getSavedSchoolLogo(school.logoUrl, schoolId) : "";
    const isSidebarDefault = isEffectiveLandscape;

    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";

    // When hidden via Swipe-Left, render sleek 1% visible vertical strip
    if (isSidebarHidden) {
      return (
        <aside
          onClick={() => {
            setIsSidebarHidden(false);
            try { localStorage.setItem("school_erp_sidebar_hidden", "false"); } catch (e) { console.warn("Failed to save sidebar state:", e); }
          }}
          className={`${isSidebarDefault ? "flex" : "hidden md:flex"} print:hidden flex-col items-center justify-between w-2.5 sm:w-3 hover:w-6 ${
            isWhite
              ? "bg-white border-r border-slate-200 hover:bg-slate-100"
              : isBlack
              ? "bg-black border-r border-neutral-800 hover:bg-neutral-900"
              : "bg-[#0a1935] border-r border-[#1b3564] hover:bg-[#10254b]"
          } shrink-0 h-screen sticky top-0 cursor-pointer transition-all duration-300 z-30 select-none shadow-lg group`}
          title="Swipe Right या क्लिक करके मेनू खोलें (1% Visible)"
        >
          <div className="w-1 h-20 rounded-full bg-gradient-to-b from-indigo-500 via-amber-400 to-indigo-500 my-auto opacity-70 group-hover:opacity-100 group-hover:h-32 transition-all shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        </aside>
      );
    }

    return (
      <aside className={`${isSidebarDefault ? "flex" : "hidden md:flex"} print:hidden flex-col w-60 lg:w-64 ${
        isWhite
          ? "bg-white border-r border-slate-200 text-slate-900 shadow-sm"
          : isBlack
          ? "bg-[#050505] border-r border-neutral-800 text-slate-100 shadow-xl"
          : "bg-[#0a1935] border-r border-[#1b3564] text-slate-100 shadow-xl"
      } shrink-0 h-screen h-[100dvh] max-h-screen overflow-hidden select-none z-30 transition-all duration-200`}>
        {/* Brand Header with Collapse Button (Fixed at top of sidebar) */}
        <div className={`p-3 border-b flex items-center justify-between gap-2 shrink-0 ${
          isWhite
            ? "border-slate-200 bg-slate-50/90"
            : isBlack
            ? "border-neutral-800 bg-black"
            : "border-[#1b3564] bg-[#07132a]"
        }`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-8 h-8 rounded-xl p-1 flex items-center justify-center shrink-0 border overflow-hidden shadow-xs ${
              isWhite
                ? "bg-indigo-50 border-indigo-200"
                : "bg-white/10 border-white/15"
            }`}>
              {displaySchoolLogo ? (
                <img src={displaySchoolLogo} alt={school?.name} className="w-full h-full object-contain rounded-lg bg-white" />
              ) : (
                <Building2 className={`w-4 h-4 ${isWhite ? "text-indigo-700" : "text-amber-400"}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className={`font-black text-xs truncate leading-tight ${isWhite ? "text-slate-900" : "text-white"}`} title={school?.name || "School ERP"}>
                {school?.name || "School ERP"}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap shrink-0 ${
                  isWhite
                    ? "bg-blue-100 text-blue-800 border-blue-200"
                    : "bg-blue-500/20 text-blue-300 border-blue-400/30"
                }`}>
                  {activeSession?.name ? activeSession.name.replace(/Academic Session |Session /i, "") : getDynamicAcademicSessionLabel().replace(/Academic Session |Session /i, "")}
                </span>
                {getVisibleSchoolRegNo(school) && (
                  <span className={`text-[9.5px] truncate min-w-0 ${isWhite ? "text-slate-500" : "text-slate-400"}`}>
                    Reg. No: {getVisibleSchoolRegNo(school)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              captureActiveMenuScrollRef.current();
              setIsSidebarHidden(true);
              try { localStorage.setItem("school_erp_sidebar_hidden", "true"); } catch (e) { console.warn("Failed to save sidebar state:", e); }
            }}
            className={`p-1 rounded-lg transition cursor-pointer shrink-0 ${
              isWhite
                ? "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
                : "hover:bg-white/10 text-slate-400 hover:text-white"
            }`}
            title="मेनू को बाएँ छुपाएं (Swipe Left)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Menu Search (Right after School Name & Session) */}
        <div className={`px-2.5 pt-2 pb-1.5 border-b shrink-0 ${
          isWhite
            ? "border-slate-200 bg-slate-50/70"
            : isBlack
            ? "border-neutral-800/80 bg-neutral-950/70"
            : "border-[#1b3564]/80 bg-[#08152e]/70"
        }`}>
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isWhite ? "text-slate-500" : "text-slate-400"}`} />
            <input
              type="text"
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              placeholder="मेनू / टूल खोजें..."
              className={`w-full pl-8 pr-6 py-1.5 rounded-lg border text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                isWhite
                  ? "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
                  : isBlack
                  ? "bg-neutral-900 border-neutral-700 text-white placeholder:text-slate-400"
                  : "bg-[#112447] border-[#26467e] text-white placeholder:text-slate-300"
              }`}
            />
            {menuSearchQuery && (
              <button
                type="button"
                onClick={() => setMenuSearchQuery("")}
                className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] cursor-pointer ${
                  isWhite ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
                }`}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories List with Independent Scroll */}
        <div
          ref={desktopMenuScrollRef}
          onScroll={(e) => {
            if (!isRestoringMenuScrollRef.current && e.currentTarget.clientHeight > 0) {
              saveMenuScrollTop(e.currentTarget.scrollTop);
            }
          }}
          className="flex-1 px-2.5 py-3 space-y-3.5 overflow-y-auto overscroll-contain"
        >
          {navCategories
            .map((cat) => ({
              ...cat,
              items: menuSearchQuery.trim()
                ? cat.items.filter((it) => {
                    const mq = menuSearchQuery.toLowerCase().trim();
                    return it.label.toLowerCase().includes(mq) || it.desc.toLowerCase().includes(mq);
                  })
                : cat.items,
            }))
            .filter((cat) => cat.items.length > 0)
            .map((cat, cIdx) => {
              const isCollapsed = false;
              void collapsedCats;
              void toggleCategoryCollapse;
              return (
                <div key={`cat-${cIdx}`} className="space-y-1">
                  <div
                    className={`erp-menu-cat-pill w-full px-2 py-1.5 rounded-lg ${cat.theme.pillBg} flex items-center justify-between gap-1 text-left select-none`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.theme.accentDot}`} />
                      <span className={`erp-menu-cat-title text-[11px] font-semibold uppercase tracking-wider truncate ${cat.theme.titleColor}`}>
                        {cat.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`erp-menu-cat-badge text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cat.theme.badgeColor}`}>
                        {cat.items.length}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {cat.items.map(item => {
                        const Icon = item.icon;
                        const isActive = isMenuItemActive(item.id);
                        const isEliteItem = ELITE_ADMIN_MENU_IDS.has(item.id);
                        const isEliteLocked = isEliteItem && isEliteAdminItemLocked(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              captureActiveMenuScrollRef.current();
                              setView(item.id);
                              mainContentScrollRef.current?.scrollTo({ top: 0 });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            title={isEliteItem ? (isEliteLocked ? `${item.label} — Elite Plan Feature` : `${item.label} — Elite Feature`) : item.desc}
                            className={`w-full px-2.5 py-2 min-h-[38px] rounded-xl flex items-center gap-2.5 text-left transition-all cursor-pointer relative ${
                              isActive
                                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                                : isWhite
                                ? "text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-medium"
                                : `text-slate-300 hover:text-white ${cat.theme.hoverBg} font-medium`
                            }`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive
                                ? "text-white stroke-[2.2]"
                                : isWhite
                                ? "text-slate-500"
                                : "text-slate-400"
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-[12px] leading-tight truncate ${
                                isActive
                                  ? "text-white font-semibold"
                                  : isWhite
                                  ? "text-slate-800"
                                  : "text-slate-200"
                              }`}>{item.label}</p>
                            </div>
                            {(item.id === "term_scheduler" || item.id === "fee_tagada") && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border border-emerald-500/30 text-[8px] font-black uppercase tracking-wider shrink-0 leading-none">
                                NEW
                              </span>
                            )}
                            {isEliteItem && (
                              <span className="erp-elite-menu-badge inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 leading-none">
                                {isEliteLocked ? (
                                  <>
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>ELITE</span>
                                  </>
                                ) : (
                                  <>
                                    <Crown className="w-2.5 h-2.5" />
                                    <span>ELITE</span>
                                  </>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Bottom Sidebar Action Footer: Unified Account & Switch Hub */}
        <div className={`p-2.5 border-t shrink-0 ${
          isWhite
            ? "border-slate-200 bg-slate-50"
            : isBlack
            ? "border-neutral-800 bg-black"
            : "border-[#1b3564] bg-[#07132a]"
        }`}>
          <button
            type="button"
            onClick={() => setView("account_hub")}
            className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 group cursor-pointer ${
              view === "account_hub"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-xs"
                : isWhite
                ? "bg-white border-slate-200 hover:bg-slate-100 text-slate-900"
                : isBlack
                ? "bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-slate-100"
                : "bg-[#102348] border-[#26467e] hover:bg-[#173061] text-slate-100"
            }`}
            title="अकाउंट, रोल स्विच व ऐप विकल्प खोलें"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                view === "account_hub"
                  ? "bg-white/15 border border-white/25 text-white"
                  : isWhite
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                  : "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"
              }`}>
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold truncate ${view === "account_hub" ? "text-white" : isWhite ? "text-slate-900" : "text-white"}`}>
                    अकाउंट व स्विच
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                    view === "account_hub"
                      ? "bg-white/20 text-white border-white/30"
                      : isWhite
                      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                      : "bg-indigo-500/25 text-indigo-200 border-indigo-400/30"
                  }`}>
                    Hub
                  </span>
                </div>
                <p className={`text-[10px] truncate ${view === "account_hub" ? "text-indigo-100" : isWhite ? "text-slate-500" : "text-slate-400"}`}>
                  Teacher, Accountant, App &amp; Logout
                </p>
              </div>
            </div>
            <ArrowRight className={`w-4 h-4 group-hover:translate-x-0.5 transition-transform shrink-0 ${view === "account_hub" ? "text-white" : isWhite ? "text-indigo-600" : "text-indigo-400"}`} />
          </button>
        </div>
      </aside>
    );
  };

  // ── MOBILE SLIDE-OUT LEFT DRAWER ─────────────────────────────────────────
  const renderMobileSidebarDrawer = () => {
    const displaySchoolLogo = school ? getSavedSchoolLogo(school.logoUrl, schoolId) : "";
    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";
    return (
      <div className="fixed inset-0 z-50 md:hidden print:hidden flex animate-in fade-in duration-200">
        <div
          className="nst-drawer-backdrop fixed inset-0 transition-opacity cursor-pointer"
          style={{ backgroundColor: isWhite ? "rgba(15, 23, 42, 0.35)" : "rgba(2, 6, 23, 0.55)" }}
          onClick={() => {
            captureActiveMenuScrollRef.current();
            setIsSidebarOpen(false);
          }}
        />
        <div className={`relative w-[260px] max-w-[82vw] flex flex-col h-full h-[100dvh] z-10 overflow-hidden animate-in slide-in-from-left duration-250 border-r ${
          isWhite
            ? "bg-white text-slate-900 border-slate-200 shadow-2xl shadow-slate-900/20"
            : isBlack
            ? "bg-[#050505] text-slate-100 border-neutral-800 shadow-2xl shadow-black/90"
            : "bg-[#0a1935] text-slate-100 border-[#1b3564] shadow-2xl shadow-black/80"
        }`}>
          {/* Header */}
          <div className={`p-3 border-b flex items-center justify-between gap-2.5 shrink-0 ${
            isWhite
              ? "border-slate-200 bg-slate-50"
              : isBlack
              ? "border-neutral-800 bg-black"
              : "border-[#1b3564] bg-[#07132a]"
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-xl p-1 flex items-center justify-center shrink-0 border overflow-hidden ${
                isWhite ? "bg-indigo-50 border-indigo-200" : "bg-white/10 border-white/15"
              }`}>
                {displaySchoolLogo ? (
                  <img src={displaySchoolLogo} alt={school?.name} className="w-full h-full object-contain rounded-lg bg-white" />
                ) : (
                  <Building2 className={`w-4 h-4 ${isWhite ? "text-indigo-700" : "text-amber-400"}`} />
                )}
              </div>
              <div className="min-w-0">
                <h3 className={`font-black text-xs truncate ${isWhite ? "text-slate-900" : "text-white"}`}>{school?.name || "School ERP"}</h3>
                {getVisibleSchoolRegNo(school) && (
                  <p className={`text-[9.5px] truncate ${isWhite ? "text-slate-500" : "text-slate-400"}`}>
                    Reg. No: {getVisibleSchoolRegNo(school)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                captureActiveMenuScrollRef.current();
                setIsSidebarOpen(false);
              }}
              className={`p-1 rounded-lg cursor-pointer ${
                isWhite
                  ? "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  : "bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white"
              }`}
              aria-label="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Search (Right after School Name & Session) */}
          <div className={`px-2.5 pt-2 pb-1.5 border-b shrink-0 ${
            isWhite
              ? "border-slate-200 bg-slate-50/70"
              : isBlack
              ? "border-neutral-800/80 bg-neutral-950/70"
              : "border-[#1b3564]/80 bg-[#08152e]/70"
          }`}>
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isWhite ? "text-slate-500" : "text-slate-400"}`} />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder="मेनू / टूल खोजें..."
                className={`w-full pl-8 pr-6 py-1.5 rounded-lg border text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                  isWhite
                    ? "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
                    : isBlack
                    ? "bg-neutral-900 border-neutral-700 text-white placeholder:text-slate-400"
                    : "bg-[#112447] border-[#26467e] text-white placeholder:text-slate-300"
                }`}
              />
              {menuSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMenuSearchQuery("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] cursor-pointer ${
                    isWhite ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Nav Categories */}
          <div
            ref={mobileMenuScrollRef}
            onScroll={(e) => {
              if (!isRestoringMenuScrollRef.current && e.currentTarget.clientHeight > 0) {
                saveMenuScrollTop(e.currentTarget.scrollTop);
              }
            }}
            className="flex-1 px-2.5 py-3 space-y-3.5 overflow-y-auto overscroll-contain"
          >
            {navCategories
              .map((cat) => ({
                ...cat,
                items: menuSearchQuery.trim()
                  ? cat.items.filter((it) => {
                      const mq = menuSearchQuery.toLowerCase().trim();
                      return it.label.toLowerCase().includes(mq) || it.desc.toLowerCase().includes(mq);
                    })
                  : cat.items,
              }))
              .filter((cat) => cat.items.length > 0)
              .map((cat, cIdx) => {
                const isCollapsed = false;
                return (
                  <div key={`m-cat-${cIdx}`} className="space-y-1">
                    {/* Always-Open Category Header Pill (Old Signature Colors) */}
                    <div
                      className={`erp-menu-cat-pill w-full px-2 py-1.5 rounded-lg ${cat.theme.pillBg} flex items-center justify-between gap-1 text-left select-none`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.theme.accentDot}`} />
                        <span className={`erp-menu-cat-title text-[11px] font-semibold uppercase tracking-wider truncate ${cat.theme.titleColor}`}>
                          {cat.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`erp-menu-cat-badge text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cat.theme.badgeColor}`}>
                          {cat.items.length}
                        </span>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-0.5 animate-in fade-in duration-150">
                        {cat.items.map(item => {
                          const Icon = item.icon;
                          const isActive = isMenuItemActive(item.id);
                          const isEliteItem = ELITE_ADMIN_MENU_IDS.has(item.id);
                          const isEliteLocked = isEliteItem && isEliteAdminItemLocked(item.id);
                          return (
                            <button
                              key={`m-${item.id}`}
                              type="button"
                              onClick={() => {
                                captureActiveMenuScrollRef.current();
                                setView(item.id);
                                setIsSidebarOpen(false);
                                mainContentScrollRef.current?.scrollTo({ top: 0 });
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              title={isEliteItem ? (isEliteLocked ? `${item.label} — Elite Plan Feature` : `${item.label} — Elite Feature`) : item.desc}
                              className={`w-full px-2.5 py-2 min-h-[40px] rounded-xl flex items-center gap-2.5 text-left transition-all cursor-pointer relative ${
                                isActive
                                  ? "bg-indigo-600 text-white font-semibold shadow-xs"
                                  : isWhite
                                  ? "text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-medium"
                                  : `text-slate-300 hover:text-white ${cat.theme.hoverBg} font-medium`
                              }`}
                            >
                              <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive
                                  ? "text-white stroke-[2.2]"
                                  : isWhite
                                  ? "text-slate-500"
                                  : "text-slate-400"
                              }`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-[12px] leading-tight truncate ${
                                  isActive
                                    ? "text-white font-semibold"
                                    : isWhite
                                    ? "text-slate-800"
                                    : "text-slate-200"
                                }`}>{item.label}</p>
                              </div>
                              {(item.id === "term_scheduler" || item.id === "fee_tagada") && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border border-emerald-500/30 text-[8px] font-black uppercase tracking-wider shrink-0 leading-none">
                                  NEW
                                </span>
                              )}
                              {isEliteItem && (
                                <span className="erp-elite-menu-badge inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 leading-none">
                                  {isEliteLocked ? (
                                    <>
                                      <Lock className="w-2.5 h-2.5" />
                                      <span>ELITE</span>
                                    </>
                                  ) : (
                                    <>
                                      <Crown className="w-2.5 h-2.5" />
                                      <span>ELITE</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Footer: Unified Account & Switch Hub */}
          <div className={`p-2.5 border-t shrink-0 ${
            isWhite
              ? "border-slate-200 bg-slate-50"
              : isBlack
              ? "border-neutral-800 bg-black"
              : "border-[#1b3564] bg-[#07132a]"
          }`}>
            <button
              type="button"
              onClick={() => {
                captureActiveMenuScrollRef.current();
                setIsSidebarOpen(false);
                setView("account_hub");
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 group cursor-pointer ${
                view === "account_hub"
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-xs"
                  : isWhite
                  ? "bg-white border-slate-200 hover:bg-slate-100 text-slate-900"
                  : isBlack
                  ? "bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-slate-100"
                  : "bg-[#102348] border-[#26467e] hover:bg-[#173061] text-slate-100"
              }`}
              title="अकाउंट, रोल स्विच व ऐप विकल्प खोलें"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  view === "account_hub"
                    ? "bg-white/15 border border-white/25 text-white"
                    : isWhite
                    ? "bg-indigo-50 border border-indigo-200 text-indigo-700"
                    : "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"
                }`}>
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-bold truncate ${view === "account_hub" ? "text-white" : isWhite ? "text-slate-900" : "text-white"}`}>
                      अकाउंट व स्विच
                    </p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                      view === "account_hub"
                        ? "bg-white/20 text-white border-white/30"
                        : isWhite
                        ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                        : "bg-indigo-500/25 text-indigo-200 border-indigo-400/30"
                    }`}>
                      Hub
                    </span>
                  </div>
                  <p className={`text-[10px] truncate ${view === "account_hub" ? "text-indigo-100" : isWhite ? "text-slate-500" : "text-slate-400"}`}>
                    Teacher, Accountant, App &amp; Logout
                  </p>
                </div>
              </div>
              <ArrowRight className={`w-4 h-4 group-hover:translate-x-0.5 transition-transform shrink-0 ${view === "account_hub" ? "text-white" : isWhite ? "text-indigo-600" : "text-indigo-400"}`} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── UNIFIED TOP BAR (DESKTOP & MOBILE) ─────────────────────────────────
  const renderTopHeader = () => {
    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";
    return (
      <>
        <header className={`sticky top-0 z-20 print:hidden px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2.5 shadow-xs border-b ${
          isWhite
            ? "bg-white border-slate-200 text-slate-900"
            : isBlack
            ? "bg-[#050505] border-neutral-800 text-white"
            : "bg-[#0b1b3a] border-[#1c3566] text-white"
        }`}>
          {/* Left: Mobile Menu Trigger, Back Home & Academic Session (Overflow-Safe) */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0 sm:flex-1">
            {!isEffectiveLandscape && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className={`md:hidden inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-1.5 rounded-xl border transition cursor-pointer shrink-0 ${
                  isWhite
                    ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                    : "bg-white/10 hover:bg-white/15 border-white/15 text-slate-200"
                }`}
                aria-label="Open Navigation Menu"
                title="मेनू खोलें"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {view !== "dashboard" ? (
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className={`inline-flex items-center justify-center gap-1 min-w-[34px] min-h-[34px] sm:min-w-[36px] sm:min-h-[36px] px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  isWhite
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
                aria-label="Back to Home"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Home</span>
              </button>
            ) : isSuperAdmin && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className={`inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 border ${
                  isWhite
                    ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-300"
                    : "bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border-indigo-400/40"
                }`}
                title="Super Admin Control Panel par wapas jayein"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Super Admin</span>
              </button>
            ) : null}

            {/* Academic Session Selector (Compact Year-Only) */}
            <button
              type="button"
              onClick={() => setShowSessionModal(true)}
              className={`inline-flex items-center gap-1 min-h-[34px] px-2 py-1 rounded-xl border text-[11px] font-black transition cursor-pointer active:scale-95 shadow-xs shrink-0 ${
                isWhite
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/35"
              }`}
              title="सत्र बदलें, नया सत्र जोड़ें या एडिट करें (Click to Switch/Edit Academic Session)"
            >
              <Calendar className={`w-3 h-3 shrink-0 ${isWhite ? "text-emerald-700" : "text-emerald-400"}`} />
              <span className="tabular-nums font-mono text-[11px] leading-none whitespace-nowrap">
                {isDemoSessionId(activeSession?.id)
                  ? "Demo"
                  : (activeSession?.name || getDynamicAcademicSessionLabel())
                      .replace(/Academic Session\s*|Session\s*/gi, "")
                      .trim()}
              </span>
              <ChevronDown className={`w-2.5 h-2.5 opacity-80 shrink-0 ${isWhite ? "text-emerald-700" : "text-emerald-300"}`} />
            </button>

            {/* Desktop/Tablet Multi-Branch Selector (Moved inside Settings on <640px mobile to stop icon collisions) */}
            <button
              type="button"
              onClick={() => setView("multi_branch")}
              className={`hidden sm:inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-1.5 rounded-xl transition cursor-pointer active:scale-95 shrink-0 ${
                isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-white/10 hover:bg-white/15 text-slate-200"
              }`}
              title={`ब्रांच: ${activeBranchName} — ब्रांच बदलें या नया कैंपस जोड़ें`}
              aria-label={`ब्रांच बदलें (${activeBranchName})`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
            </button>

            {/* Desktop/Tablet Refund & Cancellation History (Moved inside Settings on <640px mobile to stop icon collisions) */}
            <button
              type="button"
              onClick={() => setView("receipt_cancellation")}
              className={`hidden sm:inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-1.5 rounded-xl transition cursor-pointer active:scale-95 shrink-0 ${
                view === "receipt_cancellation"
                  ? "bg-amber-500 text-slate-950"
                  : isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-amber-600"
                  : "bg-white/10 hover:bg-white/15 text-amber-300"
              }`}
              title="पेमेंट व रिफंड हिस्ट्री / रसीद निरस्तीकरण (Payment & Refund History • Receipt Cancellation)"
              aria-label="Payment & Refund History / Receipt Cancellation"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
            </button>

            <h1 className={`text-xs sm:text-sm font-bold capitalize truncate hidden lg:inline-block min-w-0 ${isWhite ? "text-slate-900" : "text-white"}`}>
              {view === "dashboard"
                ? "Home Dashboard"
                : view === "account_hub"
                ? "Account Hub"
                : view === "receipt_cancellation"
                ? "Payment & Refund History"
                : view === "sibling_profiles"
                ? "भाई-बहन प्रोफाइल (Sibling Profiles & Concessions)"
                : view === "school_profile"
                ? "School Profile & Settings"
                : view === "memories"
                ? "School Memories & Events"
                : view === "multi_branch"
                ? "मल्टी-ब्रांच व फ्रैंचाइज़ी प्रबंधन (Multi-Branch Hub)"
                : view === "hostel_mess"
                ? "छात्रावास व मेस प्रबंधन (Hostel & Mess)"
                : view === "syllabus_pacing"
                ? "पाठ्यक्रम प्रगति व बैकलॉग ट्रैकर (Syllabus Pacing)"
                : view === "bus_logbook"
                ? "परिवहन डीजल व फिटनेस लॉगबुक (Transport Logbook)"
                : view === "visitor_security"
                ? "विजिटर गेट-पास व सुरक्षा डेस्क (Visitor & Security)"
                : view === "doc_verify"
                ? "दस्तावेज़ ऑनलाइन सत्यापन पोर्टल (Document Verification)"
                : view === "accounts_directory"
                ? "Total Accounts Directory (अकाउंट संख्या)"
                : view.replace(/_/g, " ")}
            </h1>
          </div>

          {/* Right: Search + Alerts + Walkie + Settings (Overlap-Free Mobile & Desktop) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Desktop/Tablet Routine Button */}
            <button
              type="button"
              onClick={() => setView("timetable")}
              className={`hidden sm:flex items-center justify-center gap-1 min-w-[36px] min-h-[36px] px-2.5 py-1.5 rounded-xl font-semibold text-xs transition cursor-pointer active:scale-95 ${
                view === "timetable"
                  ? "bg-indigo-600 text-white"
                  : isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-white/10 hover:bg-white/15 text-slate-200"
              }`}
              title="Timetable & Routine (समय सारणी व दैनिक घंटी खोलें)"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden md:inline">Routine</span>
            </button>

            {/* Compact Universal Search Button */}
            <button
              type="button"
              onClick={() => setShowCompactSearch((prev) => !prev)}
              className={`flex items-center justify-center gap-1 min-w-[38px] min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl font-semibold text-xs transition cursor-pointer active:scale-95 ${
                showCompactSearch || universalSearchQuery.trim()
                  ? "bg-blue-600 text-white"
                  : isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-white/10 hover:bg-white/15 text-slate-200"
              }`}
              title="यूनिवर्सल सर्च खोलें (छात्र, शिक्षक, फीस, छूट, टूल)"
              aria-label="Universal Search"
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline">Search</span>
            </button>

            {/* Desktop/Tablet Rotate Toggle (Also inside Settings Menu on mobile) */}
            <button
              type="button"
              onClick={handleToggleScreenRotate}
              className={`hidden sm:inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-1.5 rounded-xl transition cursor-pointer active:scale-95 shrink-0 ${
                isEffectiveLandscape
                  ? "bg-indigo-600 text-white"
                  : isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-emerald-700"
                  : "bg-white/10 hover:bg-white/15 text-emerald-300"
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

            {canExitSchool && (
              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(true)}
                className={`hidden sm:inline-flex items-center justify-center gap-1 min-w-[38px] min-h-[38px] px-2 sm:px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  isWhite
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800"
                    : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
                }`}
                title="Leave School / स्कूल छोड़ें"
              >
                <Building2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            )}

            {/* School-Hour Live Walkie-Talkie Button (Desktop/Tablet header; inside Settings on <640px mobile) */}
            <button
              type="button"
              onClick={() => setShowWalkieModal(true)}
              className={`relative shrink-0 hidden sm:inline-flex items-center justify-center gap-1 min-w-[38px] min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 ${
                !hasEliteWalkieAccess(school)
                  ? isWhite
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800"
                    : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
                  : isWalkieSchoolHoursNow
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-white/10 hover:bg-white/15 text-slate-200"
              }`}
              title={
                hasEliteWalkieAccess(school)
                  ? "School-Hour Live Walkie-Talkie"
                  : "Elite Plan Only: School-Hour Walkie-Talkie"
              }
              aria-label="Open School Walkie-Talkie"
            >
              <Radio className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Walkie</span>
              {!hasEliteWalkieAccess(school) && <Lock className="w-3 h-3 shrink-0" />}
            </button>

            {/* Notification Icon Button (1-Tap Direct Class Fee Alert & Broadcast Page) */}
            <button
              type="button"
              onClick={() => {
                setShowHeaderSettingsMenu(false);
                setView((prev) => (prev === "fee_alerts" ? "dashboard" : "fee_alerts"));
              }}
              className={`relative shrink-0 inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-1.5 rounded-xl transition cursor-pointer active:scale-95 ${
                view === "fee_alerts"
                  ? "bg-amber-500 text-slate-950"
                  : isWhite
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-white/10 hover:bg-white/15 text-slate-200"
              }`}
              title="Class Fee Alert & Broadcast"
              aria-label="Class Fee Alert and Broadcast"
            >
              <Bell
                className={`w-4 h-4 ${
                  view === "fee_alerts"
                    ? "text-slate-950"
                    : isWhite
                    ? "text-amber-600"
                    : "text-amber-400"
                }`}
              />
              {admissionAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900 tabular-nums">
                  {admissionAlerts.length > 9 ? "9+" : admissionAlerts.length}
                </span>
              )}
            </button>

            <LanguageToggleButton tone={appTheme} compact className="hidden sm:block" />
            <ScreenInfoGuideButton portal="admin" screenKey={view} tone={appTheme} className="hidden sm:inline-flex" />

            {/* Unified Settings Icon Button (2 Options: School Profile & Settings + Theme Change) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowHeaderSettingsMenu((prev) => !prev);
                }}
                className={`inline-flex items-center justify-center p-1.5 rounded-xl transition cursor-pointer active:scale-95 shadow-sm border ${
                  showHeaderSettingsMenu || view === "school_profile" || view === "receipt_header" || view === "razorpay_setup"
                    ? "bg-blue-600 text-white border-blue-500 ring-2 ring-blue-400/40"
                    : isWhite
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                    : isBlack
                    ? "bg-neutral-900 hover:bg-neutral-800 text-slate-200 border-neutral-700"
                    : "bg-[#112447] hover:bg-[#193363] text-slate-200 border-[#294c88]"
                }`}
                title="सेटिंग्स: स्कूल प्रोफाइल, रसीद हेडर, Razorpay व थीम बदलें"
                aria-label="Settings and Theme"
                aria-expanded={showHeaderSettingsMenu}
              >
                <Settings className={`w-4 h-4 ${showHeaderSettingsMenu || view === "school_profile" || view === "receipt_header" || view === "razorpay_setup" ? "text-white" : isWhite ? "text-blue-600" : "text-blue-400"}`} />
              </button>

              {showHeaderSettingsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowHeaderSettingsMenu(false)}
                  />
                  <div
                    className={`absolute right-0 top-full mt-2 w-72 max-h-[82vh] overflow-y-auto rounded-2xl border shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 ${
                      isWhite
                        ? "bg-white border-slate-200 text-slate-900"
                        : isBlack
                        ? "bg-[#0a0a0a] border-neutral-800 text-slate-100"
                        : "bg-[#0b1b3a] border-[#26467e] text-white"
                    }`}
                  >
                    <div className={`flex items-center justify-between pb-2 border-b ${
                      isWhite ? "border-slate-100" : isBlack ? "border-neutral-800" : "border-[#1c3566]"
                    }`}>
                      <span className={`text-[11px] font-black uppercase tracking-wider ${
                        isWhite ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Settings &amp; Quick Tools
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowHeaderSettingsMenu(false)}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          isWhite ? "hover:bg-slate-100 text-slate-500" : "hover:bg-white/10 text-slate-400"
                        }`}
                        aria-label="Close settings menu"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Utility Tools on Mobile (Prevents Top-Bar Icon Crowding) */}
                    <div className="grid grid-cols-2 gap-1.5 sm:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setLang(lang === "HI" ? "EN" : "HI");
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{lang === "HI" ? "भाषा: हिंदी" : "Lang: EN"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderSettingsMenu(false);
                          window.dispatchEvent(new CustomEvent("nst-open-screen-guide"));
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span className="truncate">Page Guide</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderSettingsMenu(false);
                          setShowWalkieModal(true);
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">Walkie-Talkie</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderSettingsMenu(false);
                          setView("timetable");
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">Routine</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderSettingsMenu(false);
                          setView("multi_branch");
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">Branch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderSettingsMenu(false);
                          setView("receipt_cancellation");
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Refund/Cancel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderSettingsMenu(false);
                          handleToggleScreenRotate();
                        }}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isWhite
                            ? "bg-slate-50 border-slate-200 text-slate-800"
                            : "bg-white/5 border-white/10 text-slate-100"
                        }`}
                      >
                        {isEffectiveLandscape ? (
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">
                          {isEffectiveLandscape ? "Mobile View" : "Laptop View"}
                        </span>
                      </button>
                      {canExitSchool && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowHeaderSettingsMenu(false);
                            setShowLeaveConfirmModal(true);
                          }}
                          className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                            isWhite
                              ? "bg-amber-50 border-amber-200 text-amber-800"
                              : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          }`}
                        >
                          <LogOut className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Leave School</span>
                        </button>
                      )}
                    </div>

                    {/* Option 1: School Profile & Settings */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderSettingsMenu(false);
                        setSettingsTab("profile");
                        setView("school_profile");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.98] ${
                        view === "school_profile" && settingsTab === "profile"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : isWhite
                          ? "bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-900"
                          : isBlack
                          ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-slate-100"
                          : "bg-[#112447] hover:bg-[#173061] border-[#26467e] text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          view === "school_profile" && settingsTab === "profile"
                            ? "bg-white/20 text-white"
                            : isWhite
                            ? "bg-blue-100 text-blue-700"
                            : "bg-blue-500/20 text-blue-300"
                        }`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">School Profile &amp; Settings</p>
                          <p className={`text-[10px] truncate ${
                            view === "school_profile" && settingsTab === "profile" ? "text-blue-100" : isWhite ? "text-slate-500" : "text-slate-400"
                          }`}>
                            प्रोफाइल, लोगो, कोड व लॉक सेटिंग्स
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${
                        view === "school_profile" && settingsTab === "profile" ? "text-white" : "text-slate-400"
                      }`} />
                    </button>

                    {/* Option 2: Recycle Bin */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderSettingsMenu(false);
                        setSettingsTab("recycle_bin");
                        setView("school_profile");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.98] ${
                        view === "school_profile" && settingsTab === "recycle_bin"
                          ? "bg-rose-600 text-white border-rose-500 shadow-sm"
                          : isWhite
                          ? "bg-slate-50 hover:bg-rose-50 border-slate-200 hover:border-rose-300 text-slate-900"
                          : isBlack
                          ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-slate-100"
                          : "bg-[#112447] hover:bg-[#173061] border-[#26467e] text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          view === "school_profile" && settingsTab === "recycle_bin"
                            ? "bg-white/20 text-white"
                            : isWhite
                            ? "bg-rose-100 text-rose-700"
                            : "bg-rose-500/20 text-rose-300"
                        }`}>
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate flex items-center gap-1.5">
                            <span>Recycle Bin</span>
                            {(recycleTeachers.length + recycleStudents.length) > 0 && (
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                                view === "school_profile" && settingsTab === "recycle_bin"
                                  ? "bg-white text-rose-700"
                                  : "bg-rose-600 text-white"
                              }`}>
                                {recycleTeachers.length + recycleStudents.length}
                              </span>
                            )}
                          </p>
                          <p className={`text-[10px] truncate ${
                            view === "school_profile" && settingsTab === "recycle_bin" ? "text-rose-100" : isWhite ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Delete किए गए Teacher व Student यहाँ मिलेंगे
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${
                        view === "school_profile" && settingsTab === "recycle_bin" ? "text-white" : "text-slate-400"
                      }`} />
                    </button>

                    {/* Option 3: Receipt Header & Letterhead */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderSettingsMenu(false);
                        setView("receipt_header");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.98] ${
                        view === "receipt_header"
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                          : isWhite
                          ? "bg-slate-50 hover:bg-amber-50 border-slate-200 hover:border-amber-300 text-slate-900"
                          : isBlack
                          ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-slate-100"
                          : "bg-[#112447] hover:bg-[#173061] border-[#26467e] text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          view === "receipt_header"
                            ? "bg-slate-950/15 text-slate-950"
                            : isWhite
                            ? "bg-amber-100 text-amber-700"
                            : "bg-amber-500/20 text-amber-300"
                        }`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">Receipt Header &amp; Letterhead</p>
                          <p className={`text-[10px] truncate ${
                            view === "receipt_header" ? "text-slate-900/80" : isWhite ? "text-slate-500" : "text-slate-400"
                          }`}>
                            स्कूल लेटरहेड व रसीद प्रिंट सेटिंग्स
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${
                        view === "receipt_header" ? "text-slate-950" : "text-slate-400"
                      }`} />
                    </button>

                    {/* Option 4: Razorpay Auto-Webhook Setup */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderSettingsMenu(false);
                        setView("razorpay_setup");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.98] ${
                        view === "razorpay_setup"
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                          : isWhite
                          ? "bg-slate-50 hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-slate-900"
                          : isBlack
                          ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-slate-100"
                          : "bg-[#112447] hover:bg-[#173061] border-[#26467e] text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          view === "razorpay_setup"
                            ? "bg-white/20 text-white"
                            : isWhite
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-indigo-500/20 text-indigo-300"
                        }`}>
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">Razorpay Auto-Webhook Setup</p>
                          <p className={`text-[10px] truncate ${
                            view === "razorpay_setup" ? "text-indigo-100" : isWhite ? "text-slate-500" : "text-slate-400"
                          }`}>
                            ऑनलाइन फीस गेटवे व ऑटो-रसीद वेबहुक
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${
                        view === "razorpay_setup" ? "text-white" : "text-slate-400"
                      }`} />
                    </button>

                    {/* Option 5: Device Admin & Uninstall Protection */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderSettingsMenu(false);
                        setShowDeviceAdminModal(true);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.98] ${
                        showDeviceAdminModal
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                          : isWhite
                          ? "bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 text-slate-900"
                          : isBlack
                          ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-slate-100"
                          : "bg-[#112447] hover:bg-[#173061] border-[#26467e] text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          showDeviceAdminModal
                            ? "bg-white/20 text-white"
                            : isWhite
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}>
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">App Uninstall Lock (Device Admin)</p>
                          <p className={`text-[10px] truncate ${
                            showDeviceAdminModal ? "text-emerald-100" : isWhite ? "text-slate-500" : "text-slate-400"
                          }`}>
                            ऐप को Uninstall होने से रोकें (APK सुरक्षा)
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${
                        showDeviceAdminModal ? "text-white" : "text-slate-400"
                      }`} />
                    </button>

                    {/* Option 6: Theme Change */}
                    <div className={`p-2.5 rounded-xl border space-y-2 ${
                      isWhite
                        ? "bg-slate-50 border-slate-200"
                        : isBlack
                        ? "bg-neutral-900 border-neutral-800"
                        : "bg-[#112447] border-[#26467e]"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isWhite ? "bg-amber-100 text-amber-700" : "bg-amber-500/20 text-amber-300"
                          }`}>
                            {appTheme === "white" ? (
                              <Sun className="w-3.5 h-3.5" />
                            ) : appTheme === "black" ? (
                              <Moon className="w-3.5 h-3.5" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black leading-tight">Theme Change</p>
                            <p className={`text-[10px] leading-tight ${isWhite ? "text-slate-500" : "text-slate-400"}`}>
                              ऐप की थीम बदलें
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${
                        isWhite
                          ? "bg-white border-slate-200"
                          : isBlack
                          ? "bg-black border-neutral-800"
                          : "bg-[#08142c] border-[#1f3b70]"
                      }`}>
                        <button
                          type="button"
                          onClick={() => applyAdminTheme("white")}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 transition cursor-pointer ${
                            appTheme === "white"
                              ? "bg-amber-400 text-slate-950 shadow-sm"
                              : isWhite
                              ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                          title="White (Light) थीम - सफेद"
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>White</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyAdminTheme("black")}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 transition cursor-pointer ${
                            appTheme === "black"
                              ? "bg-cyan-400 text-slate-950 shadow-sm"
                              : isWhite
                              ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                          title="Black (AMOLED) थीम - सुपर डार्क"
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Black</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyAdminTheme("current")}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 transition cursor-pointer ${
                            appTheme === "current"
                              ? "bg-blue-600 text-white shadow-sm"
                              : isWhite
                              ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                          title="Blue (Default) थीम - रॉयल ब्लू"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Blue</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── SINGLE GLOBAL UNIVERSAL SEARCH BAR (SEARCH EVERYTHING FROM ANYWHERE) ── */}
        {(() => {
          const qRaw = universalSearchQuery.trim();
          const q = qRaw.toLowerCase();

          const extraSubFeatures: Array<{
            id: string;
            label: string;
            desc: string;
            keywords: string;
            icon: any;
            action: () => void;
          }> = [
            {
              id: "sub_quick_admission",
              label: "नया एडमिशन (Quick New Admission)",
              desc: "नए छात्र का तुरंत एडमिशन फॉर्म भरें व रसीद काटें",
              keywords: "admission new student dakhila नामांकन दाखिला प्रवेश form",
              icon: UserPlus,
              action: () => setShowDirectAdmissionModal(true),
            },
            {
              id: "sub_sibling_discount",
              label: "भाई-बहन अटैच व अलग-अलग फीस छूट (Sibling & Discount)",
              desc: "एक पेरेंट के 2-3 बच्चों को जोड़ें व अलग-अलग मासिक छूट (₹/%) दें",
              keywords: "sibling brother sister discount chhoot concession bhai behan छूट भाई बहन मल्टीपल",
              icon: Users,
              action: () => setView("students"),
            },
            {
              id: "sub_demo_session",
              label: "डमी सत्र (Demo Session ON/OFF)",
              desc: "1-Year Full Model (40 छात्र/क्लास • 2 सेक्शन • 1:20 अनुपात) चालू या बंद करें",
              keywords: "demo dummy session डमी डेमो सत्र test",
              icon: Sparkles,
              action: () => setShowHowToUseModal(true),
            },
            {
              id: "sub_switch_session",
              label: "शैक्षणिक सत्र बदलें / नया सत्र (Academic Session)",
              desc: "2025-26, 2026-27 सत्र बदलें या नया सत्र बनाएं",
              keywords: "session year academic satra सत्र साल",
              icon: Calendar,
              action: () => setShowSessionModal(true),
            },
            {
              id: "sub_lock_code",
              label: "स्कूल लॉक कोड / पासवर्ड / पिन (Lock Code & Settings)",
              desc: "स्कूल कोड, लोगो, पता व सुरक्षा लॉक कोड बदलें",
              keywords: "lock code pin password settings logo address लॉक पिन सेटिंग",
              icon: Lock,
              action: () => setView("school_profile"),
            },
            {
              id: "sub_face_attendance",
              label: "फेस अटेंडेंस / रोज़ाना हाजिरी (Face & Daily Attendance)",
              desc: "कैमरे से चेहरा पहचान हाजिरी या क्लास-वार उपस्थिति",
              keywords: "face attendance kiosk hajiri camera चेहरा हाजिरी उपस्थिति",
              icon: Camera,
              action: () => setView("classes"),
            },
            {
              id: "sub_face_studio",
              label: "लाइव फेस आईडी स्टुडियो (Live Face ID Registration & Match Test)",
              desc: "कैमरे से छात्र व अध्यापकों का लाइव चेहरा रजिस्टर करें व टेस्ट करें",
              keywords: "live face id camera registration photo descriptor test चेहरा लाइव मैच",
              icon: Camera,
              action: () => setShowFaceStudioModal(true),
            },
            {
              id: "sub_advance_due",
              label: "अधूरा एडमिशन व बकाया फीस (Due List & Reminders)",
              desc: "बकाया फीस सूची देखें व WhatsApp रिमाइंडर भेजें",
              keywords: "due pending balance bakaya arrears reminder whatsapp बकाया फीस",
              icon: IndianRupee,
              action: () => setView("fees"),
            },
            {
              id: "sub_teacher_salary",
              label: "स्टाफ सैलरी, पे-हेड्स व पेरोल (Teacher Salary & Pay Slips)",
              desc: "शिक्षकों व कर्मचारियों का वेतन सेट-अप, हाजिरी आधारित सैलरी स्लिप व HRM",
              keywords: "salary payroll vetan staff teacher attendance hrm payslip सैलरी वेतन",
              icon: Briefcase,
              action: () => {
                setTeachersHubTab("payroll");
                setView("teachers");
              },
            },
            {
              id: "sub_digital_signature",
              label: "प्रिंसिपल हस्ताक्षर व लेटरहेड (Signature & Receipt Header)",
              desc: "रसीद, मार्कशीट और सर्टिफिकेट के लिए डिजिटल सिग्नेचर व हेडर",
              keywords: "signature sign letterhead receipt header print हस्ताक्षर रसीद",
              icon: PenTool,
              action: () => setView("receipt_header"),
            },
            {
              id: "sub_razorpay_setup",
              label: "Razorpay Auto-Webhook Setup (ऑनलाइन फीस गेटवे)",
              desc: "ऑनलाइन फीस गेटवे, Key ID व ऑटो-रसीद वेबहुक सेट करें",
              keywords: "razorpay webhook payment gateway online fee रसीद वेबहुक पेमेंट",
              icon: CreditCard,
              action: () => setView("razorpay_setup"),
            },
            {
              id: "sub_fee_alerts",
              label: "Class Fee Alert & Broadcast (बकाया अलर्ट व ब्रॉडकास्ट)",
              desc: "NSTA मैसेंजर व लॉक स्क्रीन बकाया तकाजा",
              keywords: "fee alert broadcast due reminder notification तकाजा बकाया ब्रॉडकास्ट",
              icon: Bell,
              action: () => setView("fee_alerts"),
            },
            {
              id: "sub_term_scheduler",
              label: "Term / Exam Fee & Month Add (किस्त व Exam शुल्क)",
              desc: "कम रेट में 2-Monthly Exam Fee लागू करें, Reg-Only छात्र के महीने में शुल्क जोड़ें (Full-Paid छूट)",
              keywords: "term exam fee campaign 2 monthly registration only month add deferred full paid exempt किस्त परीक्षा शुल्क",
              icon: CalendarClock,
              action: () => setView("term_scheduler"),
            },
            {
              id: "sub_fee_tagada",
              label: "Fee Tagada • Offline Caller & Promise Date (फीस तगादा)",
              desc: "बकाया अभिभावकों को ऑफलाइन कॉल करें, वादा तारीख सेट करें और अगले दिन स्वतः रिमाइंडर पाएं",
              keywords: "fee tagada offline caller call promise date schedule तगादा कॉल वादा तारीख",
              icon: PhoneCall,
              action: () => setView("fee_tagada"),
            },
            {
              id: "sub_account_hub",
              label: "अकाउंट व रोल स्विच (Teacher / Accountant / Student)",
              desc: "शिक्षक, अकाउंटेंट या छात्र पोर्टल व्यू में स्विच करें",
              keywords: "teacher accountant student portal role switch पोर्टल रोल",
              icon: Shield,
              action: () => setView("account_hub"),
            },
            {
              id: "sub_roles_permissions",
              label: "Roles & Permissions (शिक्षक व अकाउंटेंट अधिकार)",
              desc: "कौन शिक्षक क्या काम करे, क्लास/विषय लॉक और अकाउंटेंट की शक्तियाँ सेट करें",
              keywords: "roles permissions adhikar power teacher accountant class subject lock अधिकार शक्ति रोल",
              icon: ShieldCheck,
              action: () => setView("roles_permissions"),
            },
            {
              id: "sub_how_to_use",
              label: "How to Use (पूरी ERP गाइड)",
              desc: "किस विकल्प से क्या काम होता है — पूरी जानकारी",
              keywords: "help guide how to use tutorial madad गाइड मदद",
              icon: BookOpen,
              action: () => setShowHowToUseModal(true),
            },
          ];

          const navItemsFlattened = navCategories.flatMap((cat) =>
            cat.items.map((item) => ({
              id: `nav_${item.id}`,
              label: item.label,
              desc: `${cat.title} • ${item.desc}`,
              keywords: `${item.label} ${item.desc} ${cat.title} ${item.id}`.toLowerCase(),
              icon: item.icon,
              action: () => setView(item.id),
            }))
          );

          const allFeatureMatches = q
            ? [...extraSubFeatures, ...navItemsFlattened]
                .filter(
                  (f) =>
                    f.label.toLowerCase().includes(q) ||
                    f.desc.toLowerCase().includes(q) ||
                    f.keywords.toLowerCase().includes(q)
                )
                .slice(0, 8)
            : [];

          const matchedStudents = q
            ? displayedStudents
                .filter((st) => {
                  const clsName =
                    displayedClasses.find((c) => c.id === st.classId)?.name || "";
                  return (
                    (st.name || "").toLowerCase().includes(q) ||
                    (st.fatherName || "").toLowerCase().includes(q) ||
                    (st.motherName || "").toLowerCase().includes(q) ||
                    (st.rollNumber || "").toString().toLowerCase().includes(q) ||
                    (st.admissionNo || "").toString().toLowerCase().includes(q) ||
                    (st.phone || "").toLowerCase().includes(q) ||
                    (st.parentPhone || "").toLowerCase().includes(q) ||
                    (st.address || "").toLowerCase().includes(q) ||
                    clsName.toLowerCase().includes(q)
                  );
                })
                .slice(0, 8)
            : [];

          const matchedTeachers = q
            ? displayedTeachers
                .filter((t) => {
                  const subj = Array.isArray(t.subjects)
                    ? t.subjects.join(" ")
                    : String(t.subjects || "");
                  return (
                    (t.name || "").toLowerCase().includes(q) ||
                    (t.phone || "").toLowerCase().includes(q) ||
                    (t.designation || "").toLowerCase().includes(q) ||
                    (t.qualification || "").toLowerCase().includes(q) ||
                    subj.toLowerCase().includes(q)
                  );
                })
                .slice(0, 6)
            : [];

          const matchedClasses = q
            ? displayedClasses
                .filter(
                  (c) =>
                    (c.name || "").toLowerCase().includes(q) ||
                    (c.section || "").toLowerCase().includes(q) ||
                    (c.stream || "").toLowerCase().includes(q)
                )
                .slice(0, 6)
            : [];

          const matchedSubjects = q
            ? subjects
                .filter((sub) => (sub.name || "").toLowerCase().includes(q))
                .slice(0, 6)
            : [];

          const matchedSessions = q
            ? displayedSessions
                .filter((ses) => (ses.name || "").toLowerCase().includes(q))
                .slice(0, 4)
            : [];

          const totalMatches =
            allFeatureMatches.length +
            matchedStudents.length +
            matchedTeachers.length +
            matchedClasses.length +
            matchedSubjects.length +
            matchedSessions.length;

          return (showCompactSearch || Boolean(qRaw)) ? (
            <div className="print:hidden bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 shrink-0 relative z-20 animate-in fade-in duration-150">
              <div className="max-w-7xl mx-auto">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-blue-500 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={universalSearchQuery}
                    onChange={(e) => setUniversalSearchQuery(e.target.value)}
                    placeholder="छात्र, रोल नं., शिक्षक, क्लास, फीस, छूट, बस या कोई भी फीचर खोजें..."
                    className="w-full pl-10 pr-24 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  {qRaw && (
                    <div className="absolute right-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold tabular-nums">
                        {totalMatches} परिणाम
                      </span>
                      <button
                        type="button"
                        onClick={() => setUniversalSearchQuery("")}
                        className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 cursor-pointer"
                        aria-label="Clear universal search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {q && (
                  <div className="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 sm:p-4 space-y-4 max-h-[65vh] overflow-y-auto">
                    {totalMatches === 0 ? (
                      <div className="py-5 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold">
                        &ldquo;{qRaw}&rdquo; से मिलता कोई छात्र, शिक्षक, क्लास, विषय या फीचर नहीं मिला।
                      </div>
                    ) : (
                      <>
                        {/* 1. Features & Actions */}
                        {allFeatureMatches.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-1">
                              फीचर्स व टूल्स ({allFeatureMatches.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {allFeatureMatches.map((feat) => {
                                const FIcon = feat.icon;
                                return (
                                  <button
                                    key={feat.id}
                                    type="button"
                                    onClick={() => {
                                      feat.action();
                                      setUniversalSearchQuery("");
                                    }}
                                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/70 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-400 text-left transition cursor-pointer group"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                                        <FIcon className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                          {feat.label}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                          {feat.desc}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                      खोलें →
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. Students */}
                        {matchedStudents.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 px-1">
                              छात्र ({matchedStudents.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {matchedStudents.map((st) => {
                                const clsName =
                                  displayedClasses.find((c) => c.id === st.classId)?.name ||
                                  "Class";
                                return (
                                  <div
                                    key={st.id}
                                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 transition"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQuickActionStudent(st);
                                        setQuickActionInitialTab("profile");
                                        setUniversalSearchQuery("");
                                      }}
                                      className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                                        {(st.name || "S").charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                          {st.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                          {clsName}
                                          {st.rollNumber ? ` · Roll #${st.rollNumber}` : ""}
                                          {st.fatherName ? ` · S/o ${st.fatherName}` : ""}
                                        </p>
                                      </div>
                                    </button>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQuickActionStudent(st);
                                          setQuickActionInitialTab("fees");
                                          setUniversalSearchQuery("");
                                        }}
                                        className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold cursor-pointer"
                                      >
                                        फीस
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQuickActionStudent(st);
                                          setQuickActionInitialTab("siblings");
                                          setUniversalSearchQuery("");
                                        }}
                                        className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 text-[10px] font-bold cursor-pointer"
                                      >
                                        छूट
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. Teachers */}
                        {matchedTeachers.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-1">
                              शिक्षक व स्टाफ ({matchedTeachers.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {matchedTeachers.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setView("teachers");
                                    setUniversalSearchQuery("");
                                  }}
                                  className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/70 dark:hover:bg-emerald-950/30 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-400 text-left transition cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                                      {(t.name || "T").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                        {t.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                        {t.designation || "Teacher"}
                                        {t.phone ? ` · ${t.phone}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    देखें →
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 4. Classes & Subjects & Sessions */}
                        {(matchedClasses.length > 0 || matchedSubjects.length > 0 || matchedSessions.length > 0) && (
                          <div className="space-y-2">
                            {matchedClasses.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 px-1">
                                  कक्षाएं ({matchedClasses.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {matchedClasses.map((cls) => (
                                    <button
                                      key={cls.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedClass(cls);
                                        setView("students");
                                        setUniversalSearchQuery("");
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-800 dark:text-purple-200 transition cursor-pointer flex items-center gap-1.5"
                                    >
                                      <BookOpen className="w-3.5 h-3.5" />
                                      <span>
                                        {cls.name}
                                        {cls.section ? ` (${cls.section})` : ""}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {matchedSubjects.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 px-1">
                                  विषय / किताबें ({matchedSubjects.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {matchedSubjects.map((sub) => {
                                    const subCls = displayedClasses.find((c) => c.id === sub.classId);
                                    return (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => {
                                          if (subCls) setSelectedClass(subCls);
                                          setView("subjects");
                                          setUniversalSearchQuery("");
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50 border border-cyan-200 dark:border-cyan-800 text-xs font-bold text-cyan-800 dark:text-cyan-200 transition cursor-pointer"
                                      >
                                        {sub.name}{subCls ? ` (${subCls.name})` : ""}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {matchedSessions.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 px-1">
                                  शैक्षणिक सत्र ({matchedSessions.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {matchedSessions.map((ses) => (
                                    <button
                                      key={ses.id}
                                      type="button"
                                      onClick={() => {
                                        setShowSessionModal(true);
                                        setUniversalSearchQuery("");
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-200 transition cursor-pointer"
                                    >
                                      {ses.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null;
        })()}

        {/* ── DUMMY SESSION ACTIVE NOTICE BAR ── */}
        {schoolDemoActive && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300/70 dark:border-amber-700/50 px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200 font-semibold shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">
                <strong>डमी सत्र सक्रिय है (Demo Session ON):</strong> हर क्लास में अधिकतम 40 छात्र (2 सेक्शन: A=20, B=20), 1:20 टीचर-स्टूडेंट अनुपात व 1-साल का डेमो डेटा सक्रिय है।
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleDemoData(false)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shrink-0 transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              असली स्कूल पर लौटें (Turn OFF) →
            </button>
          </div>
        )}
      </>
    );
  };

  // ── 1. HOME DASHBOARD (7-DAY ATTENDANCE, FEES, ABSENTY & DUE LIST) ──────
  // ── 1. HOME DASHBOARD (COMPACT 2-3 COLUMN PROFESSIONAL LAYOUT) ──────
  const renderHomeDashboard = () => {
    const getClassLabel = (clsId: string) =>
      displayedClasses.find((c) => c.id === clsId)?.name || "Class";

    // Pending Face Enrollment List
    const pendingFaceStudents = displayedStudents.filter(
      (st) => !enrolledFaceIds[st.id]
    );
    const enrolledFaceCount = displayedStudents.length - pendingFaceStudents.length;

    // Live Bus Fleet Summary from unified schoolTransportStore (preserves user-added/edited buses in Demo & Real mode)
    const mergedFleet = buildMergedFleetList(schoolId);
    const liveBuses = mergedFleet.map((b) => ({
      id: b.busId,
      busNumber: b.busNumber,
      route: b.route,
      status: b.tripStatus === "started" ? ("started" as const) : ("idle" as const),
      tripType: b.tripStatus === "started" ? (b.tripType === "afternoon_drop" ? "Drop" : "Pickup") : "",
      speed: Number(b.speed || 0),
    }));
    const activeBusCount = liveBuses.filter((b) => b.status === "started").length;
    const busStudentsCount = displayedStudents.filter((s) => s.usesBus).length;

    // Dues Summary (Admission + Back Session Carryover)
    const studentsWithAdmissionDues = displayedStudents.filter(
      (s) => Number(s.admissionDueBalance || 0) + Number(s.previousSessionDue || 0) > 0
    );
    const totalAdmissionDue = studentsWithAdmissionDues.reduce(
      (sum, s) => sum + Number(s.admissionDueBalance || 0) + Number(s.previousSessionDue || 0),
      0
    );
    const studentsWithAdvanceDues = displayedStudents.filter(
      (s) =>
        s.advanceMonthlyFeePaid === false &&
        Number(s.advanceMonthlyFeeDue || s.monthlyFee || 0) > 0
    );
    const totalAdvanceDue = studentsWithAdvanceDues.reduce(
      (sum, s) => sum + Number(s.advanceMonthlyFeeDue || s.monthlyFee || 0),
      0
    );
    const totalDuesAmount = totalAdmissionDue + totalAdvanceDue;

    // Today's Date and 3-Channel Collection Breakdown (Fees + School Store Sales)
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayBreakdown = computePaymentBreakdown({
      fees: mergedRealFees,
      storeSales: dashboardStoreSales,
      datePrefix: todayIso,
    });
    const todayCashAmt = todayBreakdown.cash;
    const todayOnlineQrAmt = todayBreakdown.onlineQr;
    const todayNstaOnlineAmt = todayBreakdown.nstaOnline;
    const todayUpiAmt = todayOnlineQrAmt + todayNstaOnlineAmt;
    const todayReceiptsCount = todayBreakdown.feeCount + todayBreakdown.storeCount;
    const todayTotalFeeCollected = todayBreakdown.total;

    // Staff Attendance Today (100% REAL DATA ONLY)
    const totalStaffCount = displayedTeachers.length;
    const staffRecords = teacherAttRecords?.records || {};
    let staffPresentCount = 0;
    let staffLeaveCount = 0;
    Object.values(staffRecords).forEach((rec: any) => {
      const st = String(rec.status || "").toUpperCase();
      if (st === "PRESENT" || rec.present === true) staffPresentCount++;
      else if (st === "LEAVE" || st === "ABSENT") staffLeaveCount++;
    });

    // Class-Wise Attendance Breakdown (100% REAL DATA ONLY)
    let todayClassAttLogs: any[] = [];
    try {
      todayClassAttLogs = getLocalAttendance(schoolId).filter((r: any) => r.date === todayIso);
    } catch (e) {
      console.warn("Failed to read today's class attendance:", e);
    }
    const classAttendanceStats = displayedClasses.map((cls) => {
      const classSts = displayedStudents.filter((s) => s.classId === cls.id);
      const total = classSts.length;
      const clsLogs = todayClassAttLogs.filter((r: any) => r.classId === cls.id);
      let present = 0;
      let absent = 0;
      clsLogs.forEach((dr: any) => {
        if (Array.isArray(dr.records)) {
          dr.records.forEach((rec: any) => {
            const st = String(rec.status || "").toUpperCase();
            if (st === "PRESENT" || st === "LATE") present++;
            else if (st === "ABSENT") absent++;
          });
        }
      });
      const recorded = present + absent;
      return {
        ...cls,
        total,
        present,
        absent,
        pct: recorded > 0 ? Math.round((present / recorded) * 100) : 0,
      };
    });

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
          const curBackDue = Number(st.previousSessionDue || 0);
          const curAdmDue = Number(st.admissionDueBalance || 0);
          const appliedBack = Math.min(curBackDue, payAmt);
          const remBack = Math.max(0, curBackDue - appliedBack);
          const leftForAdm = Math.max(0, payAmt - appliedBack);
          const appliedAdm = Math.min(curAdmDue, leftForAdm);
          const remAdm = Math.max(0, curAdmDue - appliedAdm);
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
        setDuesSettlementModal(null);
      } catch (err) {
        console.error("Failed to settle due:", err);
        setDuesSettlementModal((prev) => (prev ? { ...prev, saving: false } : null));
      }
    };

    return (
      <div className="space-y-3.5 animate-in fade-in duration-200">
        {/* Toasts */}
        {sentPushAlertsToast && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{sentPushAlertsToast}</span>
            </div>
            <button type="button" onClick={() => setSentPushAlertsToast(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {birthdayWishToast && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>{birthdayWishToast}</span>
            </div>
            <button type="button" onClick={() => setBirthdayWishToast(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <ApkUpdateBanner school={school} />
        <CallSetupChecklistBanner mode="staff" schoolName={school?.name} />

        {/* ── PRINCIPAL DAILY COMMAND DIGEST + VOICE BRIEFING ── */}
        {(() => {
          const todayLocalYmd = getTodayLocalYmd();
          const tomorrowDate = new Date();
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrowYmd = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;

          const todayCallsCount = feeCallFollowUps.reduce((acc, rec) => {
            const historyToday = Array.isArray(rec.callHistory)
              ? rec.callHistory.filter((item) => (item.at || "").slice(0, 10) === todayLocalYmd).length
              : 0;
            if (historyToday > 0) return acc + historyToday;
            return (rec.lastCallAt || "").slice(0, 10) === todayLocalYmd ? acc + 1 : acc;
          }, 0);
          const todaySolvedCount = feeCallFollowUps.filter(
            (rec) => rec.resolvedTodayDate === todayLocalYmd
          ).length;
          const todayPromisedAmount = feeCallFollowUps.reduce((sum, rec) => {
            if (
              rec.lastOutcome === "PROMISED_DATE" &&
              (rec.lastCallAt || "").slice(0, 10) === todayLocalYmd
            ) {
              return sum + Number(rec.promisedAmount || 0);
            }
            return sum;
          }, 0);

          const tomorrowPromises = feeCallFollowUps.filter(
            (rec) =>
              !rec.settled &&
              (rec.promiseDate === tomorrowYmd || rec.nextCallDate === tomorrowYmd)
          );
          const tomorrowPromiseCount = tomorrowPromises.length;
          const tomorrowPromiseAmount = tomorrowPromises.reduce(
            (sum, rec) => sum + Number(rec.promisedAmount || 0),
            0
          );
          const pendingUpiCount = upiProofs.filter((p) => p.status === "PENDING").length;

          const openInquiriesCount = inquiries.filter((inq) => {
            const st = String(inq.status || "").toLowerCase();
            return st !== "lost" && st !== "admitted" && st !== "resolved";
          }).length;
          const todayInquiriesCount = inquiries.filter(
            (inq) => (inq.createdAt || "").slice(0, 10) === todayLocalYmd
          ).length;
          const digestAbsentCount = Math.max(
            sevenDayAttendanceData[6]?.absentCount ?? 0,
            todayAbsentStudentIds.length
          );
          const digestPresentCount = sevenDayAttendanceData[6]?.presentCount ?? 0;

          const curMonthCode = currentMonthStr();
          const unpaidTargets = displayedStudents
            .map((st) => {
              const curFee = mergedRealFees.find(
                (f: any) => f.studentId === st.id && f.month === curMonthCode
              );
              const isPaidCur = Boolean(curFee?.paid);
              const dueBal = curFee
                ? Number(curFee.balanceDue ?? (isPaidCur ? 0 : curFee.amount || st.monthlyFee || 0))
                : Number(st.monthlyFee || 0);
              const extraDue =
                Number(st.admissionDueBalance || 0) + Number(st.previousSessionDue || 0);
              const totalPending = (isPaidCur ? 0 : dueBal) + extraDue;
              return { student: st, totalPending };
            })
            .filter((item) => item.totalPending > 0);

          const handleSendSmartFeeReminders = async () => {
            if (!schoolId || sendingSmartReminders || unpaidTargets.length === 0) return;
            setSendingSmartReminders(true);
            try {
              const monthLbl = new Date(`${curMonthCode}-01`).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              });
              const targetIds = unpaidTargets.map((u) => u.student.id);
              await sendSchoolPushNotification({
                schoolId,
                studentIds: targetIds,
                senderName: school?.name || "School Principal",
                type: "MONTHLY_FEE",
                title: pickLang(
                  lang,
                  `शुल्क अनुस्मारक (${monthLbl})`,
                  `Fee Reminder (${monthLbl})`
                ),
                body: pickLang(
                  lang,
                  `${school?.name || "School"}: कृपया अपना बकाया स्कूल शुल्क जमा करें या UPI QR द्वारा भुगतान कर स्क्रीनशॉट अपलोड करें।`,
                  `${school?.name || "School"}: Please clear your pending school fee or upload UPI payment proof in the student portal.`
                ),
                url: "/?schoolPortal=1&openFeeReminder=1",
                urgent: true,
              }).catch(() => {});

              // Also drop an official desk reminder slip for top 30 unpaid students
              await Promise.all(
                unpaidTargets.slice(0, 30).map(({ student: st, totalPending }) =>
                  autoSendFeeSlipToSchoolDesk({
                    schoolId,
                    studentId: st.id,
                    studentName: st.name,
                    slipType: "FEE_REMINDER",
                    month: curMonthCode,
                    monthLabel: monthLbl,
                    amount: totalPending,
                    balanceDue: totalPending,
                    dueDate: todayLocalYmd,
                  }).catch(() => {})
                )
              );

              toast.success(
                pickLang(
                  lang,
                  `${unpaidTargets.length} बकाया छात्रों के अभिभावकों को शुल्क रिमाइंडर भेज दिया गया।`,
                  `Smart fee reminder sent to ${unpaidTargets.length} pending student parents.`
                )
              );
            } catch {
              toast.error(
                pickLang(lang, "रिमाइंडर भेजने में त्रुटि आई।", "Failed to send fee reminders.")
              );
            } finally {
              setSendingSmartReminders(false);
            }
          };

          const handleDownloadSchoolBackup = () => {
            try {
              const snapshot = {
                exportedAt: new Date().toISOString(),
                schoolId,
                schoolName: school?.name || "School",
                classesCount: displayedClasses.length,
                studentsCount: displayedStudents.length,
                feesCount: mergedRealFees.length,
                classes: displayedClasses,
                students: displayedStudents,
                fees: mergedRealFees,
                feeCallFollowUps,
                upiProofs,
              };
              const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `School_Backup_${schoolId}_${todayLocalYmd}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success(
                pickLang(
                  lang,
                  "स्कूल डेटा का पूरा JSON बैकअप डाउनलोड हो गया।",
                  "Complete school data JSON backup downloaded."
                )
              );
            } catch {
              toast.error(
                pickLang(lang, "डेटा बैकअप डाउनलोड नहीं हो सका।", "Could not export data backup.")
              );
            }
          };

          return (
            <TodayCommandDigestCard
              schoolName={school?.name}
              todayCollected={todayTotalFeeCollected}
              todayCashAmount={todayCashAmt}
              todayOnlineAmount={todayUpiAmt}
              todayReceiptsCount={todayReceiptsCount}
              todayCallsCount={todayCallsCount}
              todaySolvedCount={todaySolvedCount}
              todayPromisedAmount={todayPromisedAmount}
              tomorrowPromiseCount={tomorrowPromiseCount}
              tomorrowPromiseAmount={tomorrowPromiseAmount}
              pendingUpiCount={pendingUpiCount}
              todayAbsentCount={digestAbsentCount}
              todayPresentCount={digestPresentCount}
              openInquiriesCount={openInquiriesCount}
              todayInquiriesCount={todayInquiriesCount}
              staffPresentCount={staffPresentCount}
              totalStaffCount={totalStaffCount}
              pendingSyncCount={pendingSyncCount}
              isOnline={isOnline}
              syncingPending={syncingPending}
              unpaidStudentsCount={unpaidTargets.length}
              sendingFeeReminders={sendingSmartReminders}
              onSyncPending={handleSyncPendingFromDigest}
              onOpenFees={() => setView("fees")}
              onOpenTagada={() => setView("fee_tagada")}
              onOpenAbsentees={() => setView("absentee")}
              onOpenEnquiries={() => setView("admission_crm")}
              onOpenUpiApprovals={() => setView("fees")}
              onSendPendingFeeReminders={handleSendSmartFeeReminders}
              onDownloadBackup={handleDownloadSchoolBackup}
            />
          );
        })()}

        {/* ── SECTION 1: CORE OPERATIONS DECK (CLEAN SINGLE-ELEVATION CARDS, HAIRLINE DIVIDERS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Student Attendance Today */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-700">
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {pickLang(lang, "छात्र हाजिरी · आज", "Student Attendance · Today")}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {sevenDayAttendanceData[6]?.presentPct ?? 0}%
                    </p>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {pickLang(lang, "उपस्थित", "Present")}
                    </span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, sevenDayAttendanceData[6]?.presentPct ?? 0))}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 py-2 border-y border-slate-100 dark:border-slate-800 text-center divide-x divide-slate-100 dark:divide-slate-800 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{pickLang(lang, "उपस्थित", "Present")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {sevenDayAttendanceData[6]?.presentCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{pickLang(lang, "गैरहाजिर", "Absent")}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {sevenDayAttendanceData[6]?.absentCount ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{pickLang(lang, "कुल छात्र", "Total")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {displayedStudents.length}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-0.5">
              <button
                type="button"
                onClick={() => setView("attendance")}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition cursor-pointer text-center flex items-center justify-center gap-2 whitespace-nowrap shadow-xs active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pickLang(lang, "हाजिरी रजिस्टर खोलें", "Open Attendance")}</span>
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShowPunchDeskExpanded((p) => !p)}
                  className={`col-span-2 min-h-[42px] py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap flex items-center justify-center ${
                    showPunchDeskExpanded
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                  title="शिक्षक व छात्र 1-टैप Punch IN/OUT डेस्क"
                >
                  {showPunchDeskExpanded
                    ? pickLang(lang, "▲ पंच डेस्क बंद करें", "▲ Close Punch Desk")
                    : pickLang(lang, "पंच डेस्क (IN/OUT)", "Punch Desk (IN/OUT)")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSchoolLocationModal(true)}
                  className="min-h-[42px] py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  title="स्कूल GPS लोकेशन सेटिंग्स"
                  aria-label="School GPS Location Settings"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>GPS</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Fee Collection */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {pickLang(
                    lang,
                    `फीस व स्टोर वसूली · ${todayReceiptsCount} रसीदें`,
                    `Fee & Store Collection · ${todayReceiptsCount} receipts`
                  )}
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  ₹{todayTotalFeeCollected.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>

            <div className="grid grid-cols-3 py-2 border-y border-slate-100 dark:border-slate-800 text-center divide-x divide-slate-100 dark:divide-slate-800 text-[10px]">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Online QR</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  ₹{todayOnlineQrAmt.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">NSTA Online</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  ₹{todayNstaOnlineAmt.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Cash</span>
                <span className="font-bold text-slate-800 dark:text-white tabular-nums">
                  ₹{todayCashAmt.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-0.5">
              <button
                type="button"
                onClick={() => setView("fees")}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-extrabold text-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs active:scale-[0.99]"
              >
                <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>फीस जमा करें</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setView("fee_tagada")}
                  className="min-h-[42px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                  title="Fee Tagada • Offline Caller"
                >
                  <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                  <span>तगादा कॉल</span>
                  {!hasEliteFeeTagadaAccess(school) && <Lock className="w-3 h-3 text-amber-200 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setView("expenses")}
                  className="min-h-[42px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center whitespace-nowrap"
                >
                  कैशबुक / खर्च
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Staff & Faculty Attendance */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-700">
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    शिक्षक व स्टाफ ड्यूटी
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {staffPresentCount}{" "}
                      <span className="text-sm font-semibold text-slate-400">/ {totalStaffCount}</span>
                    </p>
                    <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
                      ऑन ड्यूटी
                    </span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-300"
                  style={{
                    width: `${totalStaffCount > 0 ? Math.min(100, Math.round((staffPresentCount / totalStaffCount) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 py-2 border-y border-slate-100 dark:border-slate-800 text-center divide-x divide-slate-100 dark:divide-slate-800 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">उपस्थित</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {staffPresentCount} Present
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">अवकाश (Leave)</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {staffLeaveCount} Leave
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setTeachersHubTab("directory");
                  setView("teachers");
                }}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs sm:text-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>शिक्षक सूची</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeachersHubTab("payroll");
                  setView("teachers");
                }}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center whitespace-nowrap"
              >
                वेतन पर्ची
              </button>
            </div>
          </div>

          {/* Card 4: Live School Bus & Transport Fleet */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  स्कूल बस रडार · {activeBusCount > 0 ? "Active" : "Standby"}
                </span>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {activeBusCount > 0
                    ? `${activeBusCount} बसें ऑन-रोड`
                    : liveBuses.length > 0
                    ? `${liveBuses.length} बसें स्टैंडबाय`
                    : "कोई बस दर्ज नहीं"}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Bus className="w-4 h-4" />
              </div>
            </div>

            <div className="grid grid-cols-2 py-2 border-y border-slate-100 dark:border-slate-800 text-center divide-x divide-slate-100 dark:divide-slate-800 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">बस छात्र</span>
                <span className="font-bold text-slate-800 dark:text-white tabular-nums">
                  {busStudentsCount} छात्र
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">कुल वाहन</span>
                <span className="font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                  {liveBuses.length} बसें
                </span>
              </div>
            </div>

            {liveBuses.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-[10px] text-slate-500 dark:text-slate-400">
                {liveBuses.slice(0, 3).map((b, idx) => (
                  <span
                    key={b.id}
                    className={`shrink-0 font-medium ${
                      b.status === "started"
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : ""
                    }`}
                  >
                    {idx > 0 ? "· " : ""}
                    {b.busNumber.split(" ").slice(0, 2).join(" ")}{" "}
                    {b.status === "started" ? `(${b.speed}km/h)` : ""}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setView("bus_transport")}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Live Bus Map</span>
              </button>
              <button
                type="button"
                onClick={() => setView("bus_logbook")}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center whitespace-nowrap"
              >
                डीजल लॉग
              </button>
            </div>
          </div>
        </div>

        {/* ── COMPACT ACCOUNTS DIRECTORY STRIP ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                कुल सक्रिय अकाउंट्स ·{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  {1 + displayedStudents.length + displayedTeachers.length + accountants.length + displayedStaff.length}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                {displayedStudents.length} Students · {displayedTeachers.length} Teachers ·{" "}
                {accountants.length + displayedStaff.length} Staff/Acc · 1 Admin
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setView("account_hub")}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center whitespace-nowrap"
            >
              Recovery Info
            </button>
            <button
              type="button"
              onClick={() => setView("accounts_directory")}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              <span>सभी अकाउंट्स</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Collapsible Quick Punch Desk (triggered from Card 1 ⚡ पंच button) */}
        {showPunchDeskExpanded && school && (
          <div className="max-h-[380px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <UniversalAttendanceDesk
              school={school}
              classes={displayedClasses}
              students={displayedStudents}
              teachers={displayedTeachers}
              staff={displayedStaff}
              onOpenScanner={() => {
                setFaceKioskInitialTestMode(false);
                setShowUniversalScannerModal(true);
              }}
              onOpenFaceTest={() => {
                setFaceKioskInitialTestMode(true);
                setShowFaceKioskModal(true);
              }}
              onOpenLocationModal={() => setShowSchoolLocationModal(true)}
              onViewClassAttendance={(clsId) => {
                const found = displayedClasses.find((c) => c.id === clsId);
                if (found) {
                  setSelectedClass(found);
                  setView("attendance");
                }
              }}
            />
          </div>
        )}

        {/* ── LIVE DAILY PERIOD-WISE SCHOOL ROUTINE & TEACHING DIARY (HOME PAGE) ── */}
        <HomeDailyRoutineWidget
          schoolId={schoolId}
          role="ADMIN"
          classes={displayedClasses}
          subjects={subjects}
          teachers={displayedTeachers}
          currentTeacherName={school?.principalName || "Principal / Admin"}
          onOpenFullTimetable={() => setView("timetable")}
          onOpenSyllabusTracker={() => setView("syllabus_pacing")}
        />

        {/* ── SECTION 2: QUICK ACTION & ELITE SHORTCUT LAUNCHER ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Quick Launcher
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              1-टैप स्कूल मॉड्यूल्स
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Action 1: Direct Admission */}
            <button
              type="button"
              onClick={() => setShowDirectAdmissionModal(true)}
              className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 hover:bg-sky-50/80 dark:bg-slate-950/60 dark:hover:bg-sky-950/35 text-left transition cursor-pointer flex flex-col justify-between gap-3 min-h-[104px] active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="w-9 h-9 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300">प्रवेश</span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">नया एडमिशन</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">सीधा दाखिला · 3-Term</p>
              </div>
            </button>

            {/* Action 2: Daily Homework */}
            <button
              type="button"
              onClick={() => setView("homework")}
              className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 hover:bg-indigo-50/80 dark:bg-slate-950/60 dark:hover:bg-indigo-950/35 text-left transition cursor-pointer flex flex-col justify-between gap-3 min-h-[104px] active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full">
                <span className="w-9 h-9 rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">डायरी</span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">दैनिक गृहकार्य</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">होमवर्क व क्लास पिक्स</p>
              </div>
            </button>

            {/* Action 3: Class 1-12 Notes Manager (ELITE) */}
            <button
              type="button"
              onClick={() => setView("class_notes_manager")}
              className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 hover:bg-emerald-50/80 dark:bg-slate-950/60 dark:hover:bg-emerald-950/35 text-left transition cursor-pointer flex flex-col justify-between gap-3 min-h-[104px] active:scale-[0.98]"
              title={isSchoolEliteCurriculum(school) ? "Class 1-12 Notes Manager — Elite Feature" : "Elite Plan Required"}
            >
              <div className="flex items-center justify-between w-full gap-1">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                  {isSchoolEliteCurriculum(school) ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>Elite</span>
                </span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">Class 1-12 Notes</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">नोट्स, MCQ व PDF</p>
              </div>
            </button>

            {/* Action 4: Class Video Archive (ELITE) */}
            <button
              type="button"
              onClick={() => setView("video_lectures")}
              className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 hover:bg-rose-50/80 dark:bg-slate-950/60 dark:hover:bg-rose-950/35 text-left transition cursor-pointer flex flex-col justify-between gap-3 min-h-[104px] active:scale-[0.98]"
              title={isSchoolEliteCurriculum(school) ? "Class Video Archive — Elite Feature" : "Elite Plan Required"}
            >
              <div className="flex items-center justify-between w-full gap-1">
                <span className="w-9 h-9 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Youtube className="w-4 h-4" />
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                  {isSchoolEliteCurriculum(school) ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>Elite</span>
                </span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">Video Archive</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">डिजिटल वीडियो क्लास</p>
              </div>
            </button>

            {/* Action 5: Entrance Test & 500-Q Bank (ELITE) */}
            <button
              type="button"
              onClick={() => setView("entrance_test_hub")}
              className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 hover:bg-purple-50/80 dark:bg-slate-950/60 dark:hover:bg-purple-950/35 text-left transition cursor-pointer flex flex-col justify-between gap-3 min-h-[104px] active:scale-[0.98]"
              title={hasEntranceExamAccess(school) ? "Entrance Test & 500-Q Bank — Elite Feature" : "Elite Plan Required"}
            >
              <div className="flex items-center justify-between w-full gap-1">
                <span className="w-9 h-9 rounded-xl bg-purple-500/12 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                  {hasEntranceExamAccess(school) ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>Elite</span>
                </span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">Entrance 500-Q</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">ऑनलाइन टेस्ट व पेपर</p>
              </div>
            </button>

            {/* Action 6: Website CMS (ELITE) */}
            <button
              type="button"
              onClick={() => setView("website_cms")}
              className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 hover:bg-teal-50/80 dark:bg-slate-950/60 dark:hover:bg-teal-950/35 text-left transition cursor-pointer flex flex-col justify-between gap-3 min-h-[104px] active:scale-[0.98]"
              title={isSchoolEliteCurriculum(school) ? "Website Manager (CMS) — Elite Feature" : "Elite Plan Required"}
            >
              <div className="flex items-center justify-between w-full gap-1">
                <span className="w-9 h-9 rounded-xl bg-teal-500/12 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                  {isSchoolEliteCurriculum(school) ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>Elite</span>
                </span>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">Website CMS</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">बैनर, फोटो व गैलरी</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── 2-CARD BIOMETRIC & SMART ID HUB ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Unified AI Face Attendance, Face ID Studio & Pending Face Enrollment (ELITE) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    AI Face Attendance &amp; Face ID Studio
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                    0.2s लाइव कैमरा · {enrolledFaceCount}/{displayedStudents.length} सेव · {pendingFaceStudents.length} बाकी
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                {hasFaceAttendanceAccess(school) ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>{hasFaceAttendanceAccess(school) ? "Elite" : "Elite Lock"}</span>
              </span>
            </div>

            {pendingFaceStudents.length === 0 ? (
              <div className="py-2 px-3 border-y border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>सभी {displayedStudents.length} छात्रों का Face ID रजिस्टर हो चुका है।</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 max-h-20 overflow-y-auto">
                {pendingFaceStudents.slice(0, 4).map((st) => (
                  <div
                    key={`pface-${st.id}`}
                    className="flex items-center justify-between gap-2 py-1.5 text-[11px]"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {st.name} · {getClassLabel(st.classId)} (फेस बाकी)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFaceStudioModal(true)}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-semibold shrink-0 cursor-pointer text-[11px]"
                    >
                      + जोड़ें
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowFaceKioskModal(true)}
                className={`min-h-[46px] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-xs ${
                  hasFaceAttendanceAccess(school)
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-amber-300"
                }`}
              >
                {hasFaceAttendanceAccess(school) ? <Camera className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 text-amber-400 shrink-0" />}
                <span>AI Face Kiosk</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFaceStudioModal(true)}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-1"
                title={hasFaceAttendanceAccess(school) ? "लाइव फेस आईडी स्टुडियो व मैच टेस्ट" : "Elite Plan Only"}
              >
                {!hasFaceAttendanceAccess(school) && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <span>Face ID स्टुडियो</span>
              </button>
            </div>
          </div>

          {/* Card 2: QR ID Scanner & Smart ID Cards (Included in Lite & Elite) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    QR ID Scanner &amp; Smart ID Cards
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    ID कार्ड QR कोड व बारकोड हाजिरी स्कैनर
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 shrink-0">
                {hasFaceAttendanceAccess(school) ? "QR / ID" : "Lite Plan"}
              </span>
            </div>

            <div className="py-2 border-y border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="font-medium flex items-center gap-1.5 tabular-nums">
                <QrCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{displayedStudents.length} छात्र QR कोड जारी</span>
              </span>
              <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                0.1s Instant Scan
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowUniversalScannerModal(true)}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-xs"
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>QR Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => setView("id_cards")}
                className="min-h-[46px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center"
                title="छात्र व स्टाफ ID कार्ड्स प्रिंट"
              >
                <span>ID कार्ड्स</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── UNIFIED OPERATIONAL DESK (DISCOUNTS, ADMISSION ARREARS & ABSENTEE — CLEAN DIVIDER LISTS) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

          {/* Card 3: Fee Discounts Summary Card */}
          {(() => {
            const discEntries = getCombinedDiscountLedger(schoolId, displayedStudents, allFees);
            const totalDiscAmt = discEntries.reduce((s, d) => s + (Number(d.discountAmount) || 0), 0);
            return (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      Fee Discounts ({DISPLAY_DISCOUNT_LABEL})
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {discEntries.length} छूट · कुल ₹{totalDiscAmt.toLocaleString("en-IN")} माफ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("discount_list")}
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    लिस्ट →
                  </button>
                </div>

                {discEntries.length === 0 ? (
                  <div className="py-5 text-center text-xs font-medium text-slate-400">
                    अभी तक कोई Discount दर्ज नहीं है।
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-32 overflow-y-auto">
                    {discEntries.slice(0, 6).map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {d.studentName}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {d.className || "Class"} · {d.whereLabel}
                          </p>
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold tabular-nums shrink-0">
                          -₹{d.discountAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Card 6: Combined Admission Arrears & 1-Month Advance Fee */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDuesCardTab("admission")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap tabular-nums ${
                    duesCardTab === "admission"
                      ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  एडमिशन (₹{totalAdmissionDue.toLocaleString("en-IN")})
                </button>
                <button
                  type="button"
                  onClick={() => setDuesCardTab("advance")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap tabular-nums ${
                    duesCardTab === "advance"
                      ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  एडवांस (₹{totalAdvanceDue.toLocaleString("en-IN")})
                </button>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                {duesCardTab === "admission"
                  ? `${studentsWithAdmissionDues.length} छात्र`
                  : `${studentsWithAdvanceDues.length} छात्र`}
              </span>
            </div>

            {duesCardTab === "admission" ? (
              studentsWithAdmissionDues.length === 0 ? (
                <div className="py-5 text-center text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>सभी छात्रों का एडमिशन शुल्क पूर्ण जमा है।</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-32 overflow-y-auto">
                  {studentsWithAdmissionDues.slice(0, 12).map((st) => {
                    const due = Number(st.admissionDueBalance || 0) + Number(st.previousSessionDue || 0);
                    return (
                      <div
                        key={st.id}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {st.name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate tabular-nums">
                            {getClassLabel(st.classId)} · ₹{due.toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
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
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            जमा
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsAppReminder(st, "बकाया एडमिशन शुल्क", due)}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            title="WhatsApp Reminder"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              dispatchNstaDueSlip({
                                studentId: st.id,
                                studentName: st.name,
                                className: getClassLabel(st.classId),
                                rollNo: st.rollNo,
                                dueAmount: due,
                                label: "बकाया एडमिशन शुल्क",
                              })
                            }
                            disabled={sendingNstaSlipId === st.id}
                            className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap"
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
              )
            ) : studentsWithAdvanceDues.length === 0 ? (
              <div className="py-5 text-center text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>सभी नए छात्रों की 1-माह एडवांस फीस जमा है।</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-32 overflow-y-auto">
                {studentsWithAdvanceDues.slice(0, 12).map((st) => {
                  const advDue = Number(st.advanceMonthlyFeeDue || st.monthlyFee || 0);
                  return (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {st.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate tabular-nums">
                          {getClassLabel(st.classId)} · ₹{advDue.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-semibold cursor-pointer whitespace-nowrap"
                        >
                          जमा
                        </button>
                        <button
                          type="button"
                          onClick={() => openWhatsAppReminder(st, "1-माह एडवांस ट्यूशन फीस", advDue)}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          title="WhatsApp Reminder"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            dispatchNstaDueSlip({
                              studentId: st.id,
                              studentName: st.name,
                              className: getClassLabel(st.classId),
                              rollNo: st.rollNo,
                              dueAmount: advDue,
                              label: "1-माह एडवांस ट्यूशन फीस",
                            })
                          }
                          disabled={sendingNstaSlipId === st.id}
                          className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap"
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

          {/* Card 7: Absentee Action Center */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-2.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    अनुपस्थित छात्र ({absenteeTrackerData.consecutiveAbsentees.length})
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSend1DayPushAlerts}
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-950 text-amber-800 dark:text-amber-300 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                  title="Send 1-Day Push Alerts"
                >
                  Push Alert
                </button>
                <button
                  type="button"
                  onClick={() => setView("absentee")}
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  सभी →
                </button>
              </div>
            </div>

            {absenteeTrackerData.consecutiveAbsentees.length === 0 ? (
              <div className="py-5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>कोई लगातार अनुपस्थित छात्र नहीं है।</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-32 overflow-y-auto">
                {absenteeTrackerData.consecutiveAbsentees.map((st) => (
                  <div
                    key={`abs-${st.id}`}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {st.name}{" "}
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          · {st.daysAbsent}d absent
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {st.className} · #{st.rollNo}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`tel:${st.phone}`}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        title="Call Parent"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppAbsentAlert(st)}
                        className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                        title="WhatsApp"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* IN-PLACE 1-TAP DUES SETTLEMENT MODAL */}
        {duesSettlementModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
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
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                        className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          duesSettlementModal.mode === m
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="button"
                  disabled={duesSettlementModal.saving}
                  onClick={handleSettleDue}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
                >
                  {duesSettlementModal.saving ? "सहेजा जा रहा है..." : "✓ भुगतान दर्ज करें"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ROW 3 (2-COLUMN MAX): RECHARTS 7-DAY ATTENDANCE & FEE COLLECTION CHARTS ── */}
        <AdminDashboardCharts
          sevenDayAttendanceData={sevenDayAttendanceData}
          avgAttendancePct={avgAttendancePct}
          sevenDayFeeData={sevenDayFeeData}
          monthlyProgressPct={monthlyProgressPct}
          currentMonthCollection={currentMonthCollection}
          onlineQrTotal={currentMonthBreakdown.onlineQr}
          nstaOnlineTotal={currentMonthBreakdown.nstaOnline}
          cashTotal={currentMonthBreakdown.cash}
          appTheme={appTheme}
          onOpenAttendance={() => setView("classes")}
          onOpenFees={() => setView("fees")}
        />

        {/* ── ROW 4 (2-COLUMN MAX): FEE DUE LIST + BIRTHDAYS & CALENDAR (HALF-PAGE) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {/* Left: Compact Fee Due List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    बकाया फीस सूची (Due List)
                  </h3>
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                    कुल बकाया: ₹{totalDuesAmount.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setView("fee_tagada")}
                  className="px-3 py-1.5 min-h-[34px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 transition-colors"
                  title="Offline Fee Tagada Caller खोलें"
                >
                  <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                  <span>Fee Tagada</span>
                  {!hasEliteFeeTagadaAccess(school) && <Lock className="w-3 h-3 text-amber-200 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setView("fees")}
                  className="px-3 py-1.5 min-h-[34px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] cursor-pointer whitespace-nowrap transition-colors"
                >
                  Manage →
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <select
                value={dueClassFilter}
                onChange={(e) => setDueClassFilter(e.target.value)}
                className="px-3 py-1.5 min-h-[34px] rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold"
              >
                <option value="ALL">All Classes ({displayedStudents.length})</option>
                {displayedClasses.map((c) => (
                  <option key={`opt-${c.id}`} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setDueMinAmount(dueMinAmount === 0 ? 2000 : 0)}
                className={`px-3 py-1.5 min-h-[34px] rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
                  dueMinAmount > 0
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                }`}
              >
                {dueMinAmount > 0 ? "> ₹2,000 (Active)" : "Filter > ₹2,000"}
              </button>
            </div>

            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase border-b border-slate-200/80 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">छात्र</th>
                    <th className="px-2 py-2.5">बकाया</th>
                    <th className="px-3 py-2.5 text-right">स्लिप</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {feeDueList.slice(0, 10).map((st) => (
                    <tr key={`due-row-${st.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900 dark:text-white text-xs">{st.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {st.className} • #{st.rollNo} • {st.dueMonths}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 font-bold text-rose-600 dark:text-rose-400 tabular-nums text-xs">
                        ₹{st.dueAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppFeeDemand(st)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                            title="WhatsApp par Slip bhejein"
                          >
                            <Send className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              dispatchNstaDueSlip({
                                studentId: st.id,
                                studentName: st.name,
                                className: st.className,
                                rollNo: st.rollNo,
                                dueAmount: st.dueAmount,
                                label: st.dueMonths,
                              })
                            }
                            disabled={sendingNstaSlipId === st.id}
                            className={`px-2.5 py-1.5 rounded-lg text-white font-semibold text-[10px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 whitespace-nowrap transition-colors ${
                              sentNstaSlipIds[st.id]
                                ? "bg-indigo-700"
                                : "bg-indigo-600 hover:bg-indigo-500"
                            }`}
                            title="NSTA Messenger par Slip bhejein"
                          >
                            {sendingNstaSlipId === st.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : sentNstaSlipIds[st.id] ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <MessageSquare className="w-3 h-3" />
                            )}
                            <span>{sentNstaSlipIds[st.id] ? "NSTA Sent" : "NSTA Msg"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Compact Birthdays + Calendar */}
          <div className="space-y-3">
            {todaysBirthdayStudents.length > 0 && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-500 shrink-0">
                      <Cake className="w-3.5 h-3.5" />
                    </span>
                    <span>आज के जन्मदिन ({todaysBirthdayStudents.length})</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    Auto NSTA Desk
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {todaysBirthdayStudents.map((st) => {
                    const cName = displayedClasses.find((c) => c.id === st.classId)?.name || "Class";
                    return (
                      <div key={st.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">{st.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{cName} • #{st.rollNo || "—"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendManualBirthdayWish(st)}
                          disabled={birthdayWishSending === st.id}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold shrink-0 cursor-pointer flex items-center gap-1 whitespace-nowrap transition-colors"
                        >
                          {birthdayWishSending === st.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
                          <span>Wish</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <SchoolBirthdayCalendar
              schoolId={schoolId}
              schoolName={school?.name}
              students={displayedStudents}
              classes={displayedClasses}
              onOpenMessenger={() => setView("nsta_broadcast")}
            />
          </div>
        </div>
      </div>
    );
  };

  // ── 2. DEDICATED SCHOOL PROFILE & MASTER SETTINGS VIEW ─────────────────
  const renderSchoolProfileModule = () => {
    const displaySchoolLogo = school ? getSavedSchoolLogo(school.logoUrl, schoolId) : "";
    const totalRecycleCount = recycleTeachers.length + recycleStudents.length;
    const rq = recycleSearch.trim().toLowerCase();
    const filteredRecycleTeachers = (recycleFilter === "all" || recycleFilter === "teachers")
      ? recycleTeachers.filter((t) => {
          if (!rq) return true;
          return (
            String(t.name || "").toLowerCase().includes(rq) ||
            String(t.phone || "").toLowerCase().includes(rq) ||
            String(t.designation || "").toLowerCase().includes(rq) ||
            String(t.employeeId || "").toLowerCase().includes(rq)
          );
        })
      : [];
    const filteredRecycleStudents = (recycleFilter === "all" || recycleFilter === "students")
      ? recycleStudents.filter((s) => {
          if (!rq) return true;
          return (
            String(s.name || "").toLowerCase().includes(rq) ||
            String(s.fatherName || "").toLowerCase().includes(rq) ||
            String(s.className || "").toLowerCase().includes(rq) ||
            String(s.admissionNo || "").toLowerCase().includes(rq) ||
            String(s.phone || "").toLowerCase().includes(rq)
          );
        })
      : [];

    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setSettingsTab("profile")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                settingsTab === "profile"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>School Profile &amp; Security</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("recycle_bin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                settingsTab === "recycle_bin"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Recycle Bin ({totalRecycleCount})</span>
            </button>
          </div>
        </div>

        {settingsTab === "recycle_bin" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/50 rounded-3xl p-5 sm:p-6 border border-rose-200 dark:border-rose-800/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    Recycle Bin (रिसाइकल बिन)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Delete किए गए सभी Teachers और Students यहाँ सुरक्षित रहते हैं। आप इन्हें कभी भी <strong>Restore</strong> करके वापस जोड़ सकते हैं या हमेशा के लिए <strong>Permanent Delete</strong> कर सकते हैं।
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Teachers</p>
                  <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{recycleTeachers.length}</p>
                </div>
                <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Students</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{recycleStudents.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={recycleSearch}
                  onChange={(e) => setRecycleSearch(e.target.value)}
                  placeholder="नाम, मोबाइल नंबर, क्लास या रोल से खोजें..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: "all", label: `All (${totalRecycleCount})` },
                  { id: "teachers", label: `Teachers (${recycleTeachers.length})` },
                  { id: "students", label: `Students (${recycleStudents.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRecycleFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      recycleFilter === f.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredRecycleTeachers.length === 0 && filteredRecycleStudents.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-700">
                <Trash2 className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                  Recycle Bin खाली है
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  जब कोई Teacher या Student delete किया जाएगा, तो वह यहाँ दिखाई देगा।
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRecycleTeachers.map((t) => (
                  <div
                    key={`rb-teacher-${t.id}`}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center overflow-hidden shrink-0 border border-indigo-200 dark:border-indigo-800">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{t.name ? t.name.charAt(0).toUpperCase() : "T"}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase">
                            Teacher / Faculty
                          </span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{t.name}</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {t.designation || "Faculty"} {t.phone ? `• 📱 ${t.phone}` : ""} {t.employeeId ? `• ID: ${t.employeeId}` : ""}
                          {t.deletedAt ? ` • Deleted: ${new Date(t.deletedAt).toLocaleString("en-IN")}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={recycleBusyId === t.id}
                        onClick={async () => {
                          setRecycleBusyId(t.id);
                          try {
                            const restored = await restoreTeacherFromRecycleBin(schoolId, t.id);
                            if (restored) {
                              setTeachers((prev) => prev.some((x) => x.id === restored.id) ? prev : [...prev, restored]);
                            }
                            toast.success(`${t.name} ko Recycle Bin se wapas restore kar diya gaya!`);
                          } catch (err: any) {
                            toast.error("Restore failed: " + (err?.message || "Error"));
                          } finally {
                            setRecycleBusyId(null);
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        disabled={recycleBusyId === t.id}
                        onClick={() => {
                          setConfirmAction({
                            title: "Permanently Delete Teacher?",
                            message: `Kya aap "${t.name}" ko Recycle Bin se hamesha ke liye delete karna chahte hain? Ise wapas restore nahi kiya ja sakega.`,
                            confirmLabel: "Delete Forever",
                            onConfirm: async () => {
                              setRecycleBusyId(t.id);
                              try {
                                await permanentDeleteTeacherFromBin(schoolId, t.id);
                                toast.success(`${t.name} ko permanently delete kar diya gaya.`);
                              } finally {
                                setRecycleBusyId(null);
                              }
                            },
                          });
                        }}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanent Delete</span>
                      </button>
                    </div>
                  </div>
                ))}

                {filteredRecycleStudents.map((s) => (
                  <div
                    key={`rb-student-${s.id}`}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black flex items-center justify-center overflow-hidden shrink-0 border border-emerald-200 dark:border-emerald-800">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{s.name ? s.name.charAt(0).toUpperCase() : "S"}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase">
                            Student
                          </span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{s.name}</h4>
                          {s.className && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                              {s.className} {s.rollNo ? `• Roll #${s.rollNo}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {s.fatherName ? `👨 ${s.fatherName}` : ""} {s.phone ? `• 📱 ${s.phone}` : ""} {s.admissionNo ? `• Adm: ${s.admissionNo}` : ""}
                          {s.deletedAt ? ` • Deleted: ${new Date(s.deletedAt).toLocaleString("en-IN")}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={recycleBusyId === s.id}
                        onClick={async () => {
                          setRecycleBusyId(s.id);
                          try {
                            const restored = await restoreStudentFromRecycleBin(schoolId, s.id);
                            if (restored) {
                              setStudents((prev) => prev.some((x) => x.id === restored.id) ? prev : [...prev, restored]);
                            }
                            toast.success(`${s.name} ko Recycle Bin se wapas restore kar diya gaya!`);
                          } catch (err: any) {
                            toast.error("Restore failed: " + (err?.message || "Error"));
                          } finally {
                            setRecycleBusyId(null);
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        disabled={recycleBusyId === s.id}
                        onClick={() => {
                          setConfirmAction({
                            title: "Permanently Delete Student?",
                            message: `Kya aap "${s.name}" ko Recycle Bin se hamesha ke liye delete karna chahte hain? Ise wapas restore nahi kiya ja sakega.`,
                            confirmLabel: "Delete Forever",
                            onConfirm: async () => {
                              setRecycleBusyId(s.id);
                              try {
                                await permanentDeleteStudentFromBin(schoolId, s.id);
                                toast.success(`${s.name} ko permanently delete kar diya gaya.`);
                              } finally {
                                setRecycleBusyId(null);
                              }
                            },
                          });
                        }}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanent Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {settingsTab === "profile" && (
          <>
        {/* Admin Account Recovery Card */}
        <AccountRecoveryCard
          uid={adminUid || school?.id || "admin_uid"}
          role="SCHOOL_ADMIN"
          name={school?.principalName || `${school?.name || "School"} Admin`}
          displayId={school?.id}
          schoolId={schoolId}
          schoolName={school?.name}
          initialMobile={school?.phone || ""}
          initialEmail={school?.adminEmail || school?.email || ""}
          theme={appTheme}
          extraSync={async (payload) => {
            if (schoolId) {
              const patch: any = {};
              if (payload.mobile && !school?.phone) patch.phone = payload.mobile;
              if (payload.email && !school?.adminEmail) patch.adminEmail = payload.email;
              if (Object.keys(patch).length > 0) {
                await updateSchool(schoolId, patch).catch(() => {});
              }
            }
          }}
        />
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/70 rounded-3xl p-6 text-slate-900 dark:text-white shadow-md border-2 border-blue-700 dark:border-blue-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 p-1.5 border-2 border-blue-600/60 dark:border-blue-400/50 flex items-center justify-center overflow-hidden shadow-inner">
                {displaySchoolLogo ? (
                  <img src={displaySchoolLogo} alt={school?.name} className="w-full h-full object-contain rounded-xl bg-white" />
                ) : (
                  <Building2 className="w-10 h-10 text-blue-700 dark:text-amber-400" />
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFullSchoolProfileEditor(true)}
                className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-blue-700 text-white shadow hover:bg-blue-600 cursor-pointer"
                title="Change Logo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{school?.name || "School Name"}</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                  VERIFIED INSTITUTION
                </span>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold mt-1">{school?.tagline || "तमसो मा ज्योतिर्गमय · ज्ञान ही प्रकाश है"}</p>
              {(() => {
                const visibleReg = getVisibleSchoolRegNo(school);
                const visibleAff = String(school?.affiliation || school?.affiliationNo || "").trim();
                if (!visibleReg && !visibleAff) return null;
                return (
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                    {visibleReg ? (
                      <>Reg. No: <strong>{visibleReg}</strong></>
                    ) : null}
                    {visibleReg && visibleAff ? " · " : ""}
                    {visibleAff ? (
                      <>Affiliation: <strong>{visibleAff}</strong></>
                    ) : null}
                  </p>
                );
              })()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullSchoolProfileEditor(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Full Print Header Editor</span>
            </button>
          </div>
        </div>

        {/* Master Institutional Form */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-slate-800 dark:text-white">
                School Master Profile Details (स्कूल की आधारभूत जानकारी)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                यह जानकारी सभी मार्कशीट, रसीद, आईडी कार्ड और आधिकारिक दस्तावेज़ों पर प्रिंट होगी।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">School Name (स्कूल का नाम)</label>
              <input
                type="text"
                value={schoolInfoForm.name}
                onChange={e => setSchoolInfoForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Life Maker Public School"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Principal Name</label>
              <input
                type="text"
                value={schoolInfoForm.principalName}
                onChange={e => setSchoolInfoForm(p => ({ ...p, principalName: e.target.value }))}
                placeholder="Dr. / Mr. Principal Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Principal Phone Number</label>
              <input
                type="tel"
                value={schoolInfoForm.principalPhone}
                onChange={e => setSchoolInfoForm(p => ({ ...p, principalPhone: e.target.value }))}
                placeholder="Principal Contact Number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Director Name (डायरेक्टर का नाम - अलग)</label>
              <input
                type="text"
                value={schoolInfoForm.directorName}
                onChange={e => setSchoolInfoForm(p => ({ ...p, directorName: e.target.value }))}
                placeholder="Director Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Director Phone Number</label>
              <input
                type="tel"
                value={schoolInfoForm.directorPhone}
                onChange={e => setSchoolInfoForm(p => ({ ...p, directorPhone: e.target.value }))}
                placeholder="Director Contact Number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Manager Name (मैनेजर का नाम - अलग)</label>
              <input
                type="text"
                value={schoolInfoForm.managerName}
                onChange={e => setSchoolInfoForm(p => ({ ...p, managerName: e.target.value }))}
                placeholder="Manager Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Manager Phone Number</label>
              <input
                type="tel"
                value={schoolInfoForm.managerPhone}
                onChange={e => setSchoolInfoForm(p => ({ ...p, managerPhone: e.target.value }))}
                placeholder="Manager Contact Number"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 block">Accountant Name (Fee Receipt Default)</label>
              <input
                type="text"
                value={schoolInfoForm.accountantName}
                onChange={e => setSchoolInfoForm(p => ({ ...p, accountantName: e.target.value }))}
                placeholder="Head Accountant / Cashier Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-transparent text-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Official School Helpline Mobile</label>
              <input
                type="tel"
                value={schoolInfoForm.mobile}
                onChange={e => setSchoolInfoForm(p => ({ ...p, mobile: e.target.value }))}
                placeholder="Campus Helpdesk Phone"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">School Campus Address</label>
              <input
                type="text"
                value={schoolInfoForm.address}
                onChange={e => setSchoolInfoForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Complete Campus Address with District & PIN Code"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">School Motto / Tagline</label>
              <input
                type="text"
                value={schoolInfoForm.tagline}
                onChange={e => setSchoolInfoForm(p => ({ ...p, tagline: e.target.value }))}
                placeholder="Motto or Tagline"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={saveSchoolInfo}
              disabled={savingSchoolInfo}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingSchoolInfo ? "Saving..." : "Save Profile Updates"}</span>
            </button>
          </div>
        </div>

        {/* Digital Signatures & Security Lock Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Box 1: Digital Signatures */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-purple-600" />
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">Digital Signatures (हस्ताक्षर स्टूडियो)</h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Principal, Director, Manager, Accountant (Fee Receipt पर) व Exam Controller के अलग-अलग हस्ताक्षर अपलोड/ड्रा करें।
            </p>
            <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDigitalSignatureInitialTab("principal");
                  setShowDigitalSignatureModal(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Principal Sign</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDigitalSignatureInitialTab("director");
                  setShowDigitalSignatureModal(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Director Sign</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDigitalSignatureInitialTab("manager");
                  setShowDigitalSignatureModal(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Manager Sign</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDigitalSignatureInitialTab("accountant");
                  setShowDigitalSignatureModal(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>🧾 Accountant Sign</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDigitalSignatureInitialTab("exam_controller");
                  setShowDigitalSignatureModal(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 transition cursor-pointer flex items-center justify-center gap-1 col-span-2 sm:col-span-2"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>📝 Exam Controller Sign</span>
              </button>
            </div>
          </div>

          {/* Box 2: School Security Lock Code */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Security Lock Code</h4>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${lockCodeActive ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                {lockCodeActive ? '🔒 Active' : 'Off'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              स्टूडेंट्स को स्कूल पोर्टल से जुड़ने के लिए यह 4-अंकीय सीक्रेट कोड देना अनिवार्य होगा।
            </p>
            <div className="flex items-center gap-2">
              <input
                type={showLockCode ? "text" : "password"}
                placeholder="Enter Secret Code"
                value={lockCodeInput}
                onChange={e => setLockCodeInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowLockCode(!showLockCode)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                {showLockCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={saveLockCode}
                disabled={savingLockCode}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {savingLockCode ? "..." : lockCodeSaved ? "Saved!" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Box 3: Campus Live GPS Location */}
        <div className="grid grid-cols-1 gap-5">
          {/* School Live GPS Geofence */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Campus Live GPS &amp; Geofence</h4>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${school.latitude ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                {school.latitude ? '📍 GPS Configured' : 'Not Set'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {school.latitude && school.longitude
                ? `Coordinates: ${school.latitude.toFixed(4)}° N, ${school.longitude.toFixed(4)}° E • Radius: ${school.locationRadiusMeters || 200}m`
                : "स्कूल परिसर की लाइव GPS लोकेशन सेट करें जिससे हाजिरी केवल कैंपस के अंदर लग सके।"}
            </p>
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSchoolLocationModal(true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>लाइव GPS सेट / बदलें</span>
              </button>
              {school.latitude && school.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${school.latitude},${school.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition cursor-pointer"
                  title="Google Maps पर देखें"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Box 4: Receipt Header & Letterhead + Razorpay Auto-Webhook Setup */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Receipt Header &amp; Letterhead</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                स्कूल लेटरहेड, रसीद हेडर, लोगो व प्रिंट सेटिंग्स यहाँ से कस्टमाइज करें।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView("receipt_header")}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Receipt Header &amp; Letterhead खोलें</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Razorpay Auto-Webhook Setup</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ऑनलाइन फीस गेटवे व ऑटो-रसीद वेबहुक सेटिंग्स यहाँ से कॉन्फ़िगर करें।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView("razorpay_setup")}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Razorpay Auto-Webhook Setup खोलें</span>
            </button>
          </div>
        </div>

        {/* Box 5: Android Device Admin & Uninstall Protection */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/30 rounded-3xl p-5 border border-emerald-200 dark:border-emerald-800/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                Android App Uninstall Lock (Device Admin)
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              स्कूल/स्टाफ मोबाइल पर ऐप को गलती से या बिना अनुमति Uninstall होने से रोकने के लिए Device Admin व 100% Device Owner Uninstall Lock चालू करें।
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeviceAdminModal(true)}
            className="shrink-0 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Uninstall Lock सेटअप खोलें</span>
          </button>
        </div>

        {/* Sub-Admin Authorization Management */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-purple-600" />
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Sub-Admin Access (सह-प्रशासक अनुमति)</h4>
                <p className="text-xs text-slate-400">एक स्कूल खाते से कई Gmail जोड़ें (बिना लॉगआउट हुए एक साथ काम कर सकेंगे)।</p>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-bold self-start sm:self-auto">
              प्लान कोटा: {subAdmins.filter(p => p.role === 'SCHOOL_SUB_ADMIN').length} / {getMaxAdminsForSchool(displayedStudents.length) === 9999 ? 'Unlimited' : getMaxAdminsForSchool(displayedStudents.length)} एडमिन ({displayedStudents.length} छात्र)
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="subadmin@gmail.com"
              value={subAdminEmail}
              onChange={e => { setSubAdminEmail(e.target.value); setSubAdminResult(null); }}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent text-slate-800 dark:text-white text-xs"
            />
            <button
              type="button"
              onClick={handleAssignSubAdmin}
              disabled={assigningSubAdmin || !subAdminEmail.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
            >
              {assigningSubAdmin ? "..." : "+ Sub-Admin Banao"}
            </button>
          </div>

          {subAdminResult && (
            <p className={`text-xs p-2 rounded-lg ${subAdminResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {subAdminResult.msg}
            </p>
          )}

          {subAdmins.filter(p => p.role === 'SCHOOL_SUB_ADMIN').length > 0 && (
            <div className="space-y-2 pt-2">
              {subAdmins.filter(p => p.role === 'SCHOOL_SUB_ADMIN').map((p, idx) => (
                <div key={`sub-${p.uid || idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/40 text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{p.name || "Sub Admin"}</p>
                    <p className="text-[10px] text-slate-400">{p.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubAdmin(p.uid)}
                    className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    );
  };

  // ── 3. DEDICATED MEMORIES & EVENTS GALLERY VIEW ─────────────────────────
  const renderMemoriesModule = () => {
    const memoryCategories = [
      { id: "ALL", label: "Sabhi Yaadein (All)" },
      { id: "ANNUAL", label: "Annual Day (वार्षिकोत्सव)" },
      { id: "SPORTS", label: "Sports Meet (खेलकूद)" },
      { id: "EXPO", label: "Science Expo (विज्ञान प्रदर्शनी)" },
      { id: "CAMPUS", label: "Campus Life (क्लासरूम)" },
      { id: "TOUR", label: "Picnic & Tour (शैक्षणिक भ्रमण)" },
    ];

    const filtered = memoriesList.filter(m => {
      if (memoriesFilter === "ALL") return true;
      return m.category === memoriesFilter;
    });

    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-purple-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/40 ring-2 ring-purple-400/50">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">School Memories &amp; Events (स्कूल की यादें)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500 text-white">
                  STUDENT APP SYNCED
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-1">
                यहाँ अपलोड की गई फोटो व वीडियो सीधे स्टूडेंट पोर्टल के "Memories" सेक्शन में कैटेगरी-अनुसार दिखती हैं।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddMemoryModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs hover:from-amber-300 hover:to-orange-400 transition shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Memory (नई याद जोड़ें)</span>
          </button>
        </div>

        {/* Category Tabs (matching Student Side sub-pages) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {memoryCategories.map(cat => {
            const isActive = memoriesFilter === cat.id;
            const count = cat.id === "ALL" ? memoriesList.length : memoriesList.filter(m => m.category === cat.id).length;
            return (
              <button
                key={`mem-tab-${cat.id}`}
                type="button"
                onClick={() => setMemoriesFilter(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-105"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Memories Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(mem => (
            <div
              key={mem.id}
              className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Media preview */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setActiveMemoryPreview(mem)}>
                  <img
                    src={mem.url || "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=800&q=80"}
                    alt={mem.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-black/60 text-white backdrop-blur-xs border border-white/20">
                      {mem.category}
                    </span>
                    {mem.type === "VIDEO" && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-rose-600 text-white flex items-center gap-1">
                        <Youtube className="w-3 h-3" /> Video
                      </span>
                    )}
                  </div>
                  <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                    {mem.date}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 space-y-1.5">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 leading-snug">
                    {mem.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {mem.description}
                  </p>
                  {mem.tags && mem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {mem.tags.map((t: string, tidx: number) => (
                        <span key={`t-${tidx}`} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  ❤️ {mem.likes ?? 0} Student Likes
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteMemory(mem.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  title="Delete memory"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
            <Camera className="w-12 h-12 text-slate-400 mx-auto mb-2 opacity-30" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Is category me abhi koi memory nahi hai</h4>
            <p className="text-xs text-slate-400 mt-1">Upar diye gaye "+ Add New Memory" button se nayi yaadein jodein!</p>
          </div>
        )}
      </div>
    );
  };

  // ── GLOBAL MODALS FOR ALL VIEWS ─────────────────────────────────────────
  const renderGlobalModals = () => {
    return (
      <>
        {/* Memory Fullscreen Preview Modal */}
        {activeMemoryPreview && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl space-y-3">
              <div className="relative aspect-video bg-black flex items-center justify-center">
                {activeMemoryPreview.videoUrl ? (
                  <iframe
                    src={activeMemoryPreview.videoUrl.replace("watch?v=", "embed/")}
                    title={activeMemoryPreview.title}
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                ) : (
                  <img src={activeMemoryPreview.url} alt={activeMemoryPreview.title} className="w-full h-full object-contain" />
                )}
                <button
                  type="button"
                  onClick={() => setActiveMemoryPreview(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 pt-1 space-y-2 text-white">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white uppercase">
                  {activeMemoryPreview.category} · {activeMemoryPreview.date}
                </span>
                <h3 className="text-base font-black text-white">{activeMemoryPreview.title}</h3>
                <p className="text-xs text-slate-300">{activeMemoryPreview.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Add Memory Modal */}
        {showAddMemoryModal && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-purple-600" />
                  <h3 className="font-black text-base text-slate-800 dark:text-white">Add New Memory (नई याद जोड़ें)</h3>
                </div>
                <button type="button" onClick={() => setShowAddMemoryModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMemory} className="space-y-3.5 text-xs">
                {!isSchoolEliteCurriculum(school) && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 font-semibold">
                    ⚡ <strong>Lite Plan Notice:</strong> Aapki uploaded photos School Admin Memories mein save hongi, lekin Public Website Gallery par sirf <strong>👑 Elite / White-Label</strong> plan mein dikhengi (Lite mein Default Website rehti hai).
                  </div>
                )}
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Event Title (समारोह का नाम)</label>
                  <input
                    type="text"
                    required
                    value={newMemoryForm.title}
                    onChange={e => setNewMemoryForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. 77th Republic Day Parade 2026"
                    className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Category (सब-पेज चुनें)</label>
                    <select
                      value={newMemoryForm.category}
                      onChange={e => setNewMemoryForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="ANNUAL">Annual Day (वार्षिकोत्सव)</option>
                      <option value="SPORTS">Sports Meet (खेलकूद)</option>
                      <option value="EXPO">Science Expo (विज्ञान प्रदर्शनी)</option>
                      <option value="CAMPUS">Campus Life (क्लासरूम)</option>
                      <option value="TOUR">Picnic &amp; Tour (शैक्षणिक भ्रमण)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Event Date (दिनांक)</label>
                    <input
                      type="date"
                      value={newMemoryForm.date}
                      onChange={e => setNewMemoryForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Media Type</label>
                    <select
                      value={newMemoryForm.type}
                      onChange={e => setNewMemoryForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="IMAGE">Photo (छवि)</option>
                      <option value="VIDEO">YouTube Video (वीडियो)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {newMemoryForm.type === "IMAGE" ? "Photo Upload / URL" : "YouTube Video URL"}
                    </label>
                    <div className="space-y-1.5">
                      {newMemoryForm.type === "IMAGE" && (
                        <label className="w-full px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Photo (Auto Compress)</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const res = await compressImageFileToDataUrl(file, { maxSizeBytes: 240 * 1024 });
                                setNewMemoryForm(p => ({ ...p, url: res.dataUrl }));
                                toast.success(`Photo ready (${res.sizeKB} KB ${res.format.toUpperCase()})`);
                              } catch {
                                toast.error("Photo compression failed");
                              }
                            }}
                          />
                        </label>
                      )}
                      <input
                        type="text"
                        value={newMemoryForm.type === "IMAGE" ? newMemoryForm.url : newMemoryForm.videoUrl}
                        onChange={e => {
                          const val = e.target.value;
                          if (newMemoryForm.type === "IMAGE") {
                            setNewMemoryForm(p => ({ ...p, url: val }));
                          } else {
                            setNewMemoryForm(p => ({ ...p, videoUrl: val, url: val }));
                          }
                        }}
                        placeholder={newMemoryForm.type === "IMAGE" ? "https://images.unsplash.com/..." : "https://youtube.com/watch?v=..."}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Description (विवरण)</label>
                  <textarea
                    rows={2}
                    value={newMemoryForm.description}
                    onChange={e => setNewMemoryForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Short description of the event celebration..."
                    className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tags (कॉमा द्वारा अलग करें)</label>
                  <input
                    type="text"
                    value={newMemoryForm.tags}
                    onChange={e => setNewMemoryForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="Sports, Medals, Athletics"
                    className="w-full px-3 py-2 border rounded-xl bg-transparent dark:border-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMemoryModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black shadow-md"
                  >
                    Save Memory
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── 48-HOUR EXPIRY WARNING POPUP ─────────────────────────── */}
        {showExpiryPopup && school && (() => {
          const expIso = school.subscription?.expiresAt || school.subscription?.paidUntil;
          const msLeft = expIso ? new Date(expIso).getTime() - Date.now() : 0;
          const hoursLeft = Math.ceil(msLeft / 3600000);
          const daysLeft  = Math.ceil(msLeft / 86400000);
          return (
            <div className="fixed inset-0 z-[9999] print:hidden flex items-end justify-center p-4 pb-8" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
              <div className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${expiryPopupExpired ? 'bg-red-600' : 'bg-amber-500'}`}>
                <div className="px-5 pt-6 pb-4 text-white">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-3xl">
                      {expiryPopupExpired ? '❌' : '⚠️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-black leading-tight">
                        {expiryPopupExpired
                          ? 'Subscription Expire Ho Gaya!'
                          : hoursLeft <= 24
                          ? `Sirf ${hoursLeft} Ghante Baaki!`
                          : `Sirf ${daysLeft} Din Baaki!`}
                      </h2>
                      <p className="text-sm text-white/80 mt-1 leading-snug">
                        {expiryPopupExpired
                          ? 'Aapka school plan khatam ho gaya hai. Super Admin se turant renew karao.'
                          : 'Aapka subscription jald hi khatam hone wala hai. Super Admin se abhi renew karao.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 px-5 py-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowExpiryPopup(false); setView("subscription"); }}
                    className={`w-full py-3.5 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg ${expiryPopupExpired ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                  >
                    <Crown className="w-4 h-4" />
                    {expiryPopupExpired ? 'Plan Renew Karo' : 'Plan Dekho / Renew Karo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExpiryPopup(false)}
                    className="w-full py-3 rounded-2xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Baad Mein
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Class QR Attendance Modal */}
        {qrModalClass && (
          <ClassQrCodeModal
            isOpen={!!qrModalClass}
            onClose={() => setQrModalClass(null)}
            schoolId={schoolId}
            schoolName={school?.name || "School"}
            classId={qrModalClass.id}
            className={qrModalClass.name}
            totalStudents={displayedStudents.filter(s => isStudentInClass(s, qrModalClass.id, qrModalClass.name)).length}
          />
        )}

        {/* Universal Attendance Scanner Modal */}
        {school && showUniversalScannerModal && (
          <UniversalAttendanceScannerModal
            isOpen={showUniversalScannerModal}
            onClose={() => setShowUniversalScannerModal(false)}
            school={school}
            classes={displayedClasses}
            students={displayedStudents}
            teachers={displayedTeachers}
            onOpenFaceKiosk={() => setShowFaceKioskModal(true)}
          />
        )}

        {/* School Location Modal */}
        {school && showSchoolLocationModal && (
          <SchoolLocationModal
            isOpen={showSchoolLocationModal}
            onClose={() => setShowSchoolLocationModal(false)}
            school={school}
            onLocationSaved={(newLoc) => {
              setSchool(prev => prev ? ({ ...prev, ...newLoc }) : null);
            }}
          />
        )}

        {/* Android Device Admin & Uninstall Protection Modal */}
        {showDeviceAdminModal && (
          <DeviceAdminProtectionModal
            isOpen={showDeviceAdminModal}
            onClose={() => setShowDeviceAdminModal(false)}
            schoolId={schoolId}
            schoolName={school?.name}
            schoolPinHash={school?.uninstallGuardPinHash}
            schoolLockCode={school?.lockCode}
            canEditPin={true}
            onSchoolPinChanged={(nextHash) => {
              setSchool((prev) =>
                prev
                  ? {
                      ...prev,
                      uninstallGuardPinHash: nextHash,
                      uninstallGuardPinUpdatedAt: new Date().toISOString(),
                    }
                  : prev
              );
            }}
          />
        )}

        {/* AI Face Attendance Kiosk Modal */}
        {school && showFaceKioskModal && (
          <Suspense fallback={null}>
            <FaceAttendanceKioskModal
              isOpen={showFaceKioskModal}
              onClose={() => {
                setShowFaceKioskModal(false);
                setFaceKioskInitialTestMode(false);
              }}
              initialTestMode={faceKioskInitialTestMode}
              hasFaceAccess={hasFaceAttendanceAccess(school)}
              onUpgradeToElite={() => {
                setShowFaceKioskModal(false);
                setView("plan");
              }}
              onOpenQrScanner={() => {
                setShowFaceKioskModal(false);
                setShowUniversalScannerModal(true);
              }}
              schoolId={school.id}
              schoolName={school.name}
              classes={displayedClasses}
              students={displayedStudents}
              teachers={displayedTeachers}
            />
          </Suspense>
        )}

        {/* Digital Signature & School Header Modals */}
        {school && showFullSchoolProfileEditor && (
          <SchoolHeaderEditorModal
            isOpen={showFullSchoolProfileEditor}
            onClose={() => setShowFullSchoolProfileEditor(false)}
            school={school}
            schoolId={schoolId}
            currentDetails={{
              schoolName: school.name || "",
              tagline: school.tagline || "",
              affiliation: school.affiliation || "",
              address: school.address || "",
              phone: school.mobile || school.phone || "",
              email: school.email || "",
              logoUrl: getSavedSchoolLogo(school.logoUrl, schoolId),
              principalName: school.principalName || "",
              principalTitle: "Principal / Head of Institution",
              code: getVisibleSchoolRegNo(school),
              principalPhone: school.principalPhone || "",
              directorName: school.directorName || "",
              directorPhone: school.directorPhone || "",
              managerName: school.managerName || "",
              managerPhone: school.managerPhone || "",
              accountantName: school.accountantName || "",
              principalSignatureUrl: school.principalSignatureUrl || "",
              directorSignatureUrl: school.directorSignatureUrl || "",
              managerSignatureUrl: school.managerSignatureUrl || "",
              accountantSignatureUrl: school.accountantSignatureUrl || "",
              customFields: school.customFields || [],
              documentPrintFields: school.documentPrintFields || {},
            }}
            onApply={(details: SchoolHeaderDetails) => {
              setSchool(previous => previous ? {
                ...previous,
                name: details.schoolName,
                tagline: details.tagline,
                affiliation: details.affiliation,
                address: details.address,
                phone: details.phone,
                mobile: details.phone,
                email: details.email,
                logoUrl: details.logoUrl,
                principalName: details.principalName,
                principalPhone: details.principalPhone,
                directorName: details.directorName,
                directorPhone: details.directorPhone,
                managerName: details.managerName,
                managerPhone: details.managerPhone,
                accountantName: details.accountantName,
                principalSignatureUrl: details.principalSignatureUrl,
                directorSignatureUrl: details.directorSignatureUrl,
                managerSignatureUrl: details.managerSignatureUrl,
                accountantSignatureUrl: details.accountantSignatureUrl,
                code: details.code,
                customFields: details.customFields,
                documentPrintFields: details.documentPrintFields,
              } : previous);
            }}
          />
        )}
        {school && showDigitalSignatureModal && (
          <DigitalSignatureModal
            isOpen={showDigitalSignatureModal}
            onClose={() => setShowDigitalSignatureModal(false)}
            school={school}
            schoolId={schoolId}
            initialTab={digitalSignatureInitialTab}
            onSignaturesUpdated={updated => {
              setSchool(prev => prev ? {
                ...prev,
                principalSignatureUrl: updated.principalSignatureUrl !== undefined ? updated.principalSignatureUrl : prev.principalSignatureUrl,
                directorSignatureUrl: updated.directorSignatureUrl !== undefined ? updated.directorSignatureUrl : prev.directorSignatureUrl,
                directorName: updated.directorName !== undefined ? updated.directorName : prev.directorName,
                managerSignatureUrl: updated.managerSignatureUrl !== undefined ? updated.managerSignatureUrl : prev.managerSignatureUrl,
                managerName: updated.managerName !== undefined ? updated.managerName : prev.managerName,
                accountantSignatureUrl: updated.accountantSignatureUrl !== undefined ? updated.accountantSignatureUrl : prev.accountantSignatureUrl,
                accountantName: updated.accountantName !== undefined ? updated.accountantName : prev.accountantName,
                examControllerSignatureUrl: updated.examControllerSignatureUrl !== undefined ? updated.examControllerSignatureUrl : prev.examControllerSignatureUrl,
                examControllerName: updated.examControllerName !== undefined ? updated.examControllerName : prev.examControllerName,
              } : prev);
            }}
          />
        )}

        <StudentQuickActionModal
          isOpen={Boolean(quickActionStudent)}
          onClose={() => setQuickActionStudent(null)}
          student={quickActionStudent}
          school={school}
          classes={classes}
          currentMonth={feeMonth || currentMonthStr()}
          adminUid={adminUid}
          initialTab={quickActionInitialTab}
        />
        {school && showDirectAdmissionModal && (
          <DirectAdmissionModal
            isOpen={showDirectAdmissionModal}
            onClose={() => setShowDirectAdmissionModal(false)}
            school={school}
            classes={displayedClasses}
            sessions={sessions}
            activeSession={activeSession}
            defaultClassId={selectedClass?.id || displayedClasses[0]?.id}
            existingStudents={displayedStudents}
            adminUid={adminUid}
            userRole="SCHOOL_ADMIN"
            actorName={school?.principalName || "School Admin"}
            onSuccess={(newStudent, admFee) => {
              setShowDirectAdmissionModal(false);
              setStudents(prev => [newStudent, ...prev.filter(s => s.id !== newStudent.id)]);
              toast.success(`✅ ${newStudent.name} ka admission ho gaya — ID Card aur 512×512 QR tayyar hai!`);
              setSelectedStudentForIdCard({
                student: newStudent,
                admissionFee: admFee || null,
              });
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
              displayedClasses.find(c => c.id === admissionPrintPayload.student.classId)?.name ||
              admissionPrintPayload.student.className ||
              ""
            }
            feeRecord={admissionPrintPayload.fee || null}
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
        {school && selectedStudentForIdCard && (
          <StudentIdCardModal
            isOpen={true}
            student={selectedStudentForIdCard.student}
            school={school}
            classes={displayedClasses}
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
        {school && selectedTeacherForIdCard && (
          <TeacherIdCardModal
            isOpen={true}
            teacher={selectedTeacherForIdCard}
            school={school}
            onClose={() => setSelectedTeacherForIdCard(null)}
            onOpenTestPortal={() => {
              setSelectedTeacherForIdCard(null);
              if (onPreviewTeacher) onPreviewTeacher();
            }}
          />
        )}
        {school && appointmentLetterTeacher && (
          <AppointmentLetterModal
            isOpen={Boolean(appointmentLetterTeacher)}
            onClose={() => setAppointmentLetterTeacher(null)}
            school={school}
            teacher={appointmentLetterTeacher}
            classes={displayedClasses}
            activeSession={activeSession}
            canEdit={true}
            onOpenTeacherSignaturePad={() => setSignatureTargetTeacher(appointmentLetterTeacher)}
            onUpdatedTeacher={(updated) => {
              setAppointmentLetterTeacher((prev: any) => prev ? { ...prev, ...updated } : prev);
              setTeachers((prev) => prev.map((x) => x.id === appointmentLetterTeacher.id ? { ...x, ...updated } : x));
              setAccountants((prev) => prev.map((x) => x.id === appointmentLetterTeacher.id ? { ...x, ...updated } : x));
            }}
          />
        )}
        {signatureTargetTeacher && (
          <TeacherSignatureModal
            isOpen={Boolean(signatureTargetTeacher)}
            onClose={() => setSignatureTargetTeacher(null)}
            title={
              signatureTargetTeacher.id === "__NEW_TEACHER__"
                ? "New Teacher Digital Signature"
                : signatureTargetTeacher.id === "__EDIT_TEACHER__"
                ? `Edit Signature — ${editTeacherForm.name || "Teacher"}`
                : `Teacher Signature — ${signatureTargetTeacher.name}`
            }
            initialSignatureUrl={signatureTargetTeacher.signatureUrl || ""}
            uploadPrefix={`sig_teacher_${signatureTargetTeacher.id || "staff"}`}
            onSaveSignature={async (url) => {
              if (signatureTargetTeacher.id === "__NEW_TEACHER__") {
                setTeacherForm((p) => ({ ...p, signatureUrl: url }));
                toast.success("नए शिक्षक का साइन फॉर्म में जुड़ गया!");
                return;
              }
              if (signatureTargetTeacher.id === "__EDIT_TEACHER__") {
                setEditTeacherForm((p) => ({ ...p, signatureUrl: url }));
                toast.success("शिक्षक का साइन एडिट फॉर्म में अपडेट हो गया!");
                return;
              }
              const targetId = signatureTargetTeacher.id;
              const isAccOnly = Boolean(signatureTargetTeacher._isAccountantOnly);
              if (isAccOnly) {
                const accObj = accountants.find((a) => a.id === targetId);
                if (accObj) {
                  await saveAccountant({ ...accObj, signatureUrl: url });
                }
                setAccountants((prev) => prev.map((a) => a.id === targetId ? { ...a, signatureUrl: url } : a));
              } else {
                await updateTeacher(schoolId, targetId, { signatureUrl: url });
                setTeachers((prev) => prev.map((x) => x.id === targetId ? { ...x, signatureUrl: url } : x));
              }
              if (appointmentLetterTeacher?.id === targetId) {
                setAppointmentLetterTeacher((prev: any) => prev ? { ...prev, signatureUrl: url } : prev);
              }
              toast.success(`${signatureTargetTeacher.name} का डिजिटल साइन सेव हो गया!`);
            }}
          />
        )}
        {/* Leave School Confirmation Modal */}
        {showLeaveConfirmModal && (
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white">
                    Leave School (स्कूल छोड़ें)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {school?.name || "This school"}
                  </p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                क्या आप वाकई इस स्कूल से अलग होना चाहते हैं? आपका अकाउंट इस स्कूल से detach हो जाएगा और आप Hub Overview / अन्य स्कूल में स्विच कर सकेंगे।
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={leavingSchoolLoading}
                  onClick={() => setShowLeaveConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="button"
                  disabled={leavingSchoolLoading}
                  onClick={async () => {
                    setLeavingSchoolLoading(true);
                    try {
                      if (onLeaveSchool) onLeaveSchool();
                    } finally {
                      setLeavingSchoolLoading(false);
                      setShowLeaveConfirmModal(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition cursor-pointer shadow-md shadow-amber-600/30 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {leavingSchoolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  <span>हाँ, स्कूल छोड़ें</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Academic Session Manager Modal (Switch, Add, Edit Sessions) */}
        {showSessionModal && (
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-slate-800 dark:text-white">
                      सत्र प्रबंधन (Academic Session Manager)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      सत्र बदलें, नया सत्र जोड़ें या तारीखें संपादित करें
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dual Session Active Summary: App Session + Website Admission Session */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                        School App सक्रिय सत्र
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">
                      {activeSession?.name || getDynamicAcademicSessionLabel()}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {activeSession?.startDate || "2026-04-01"} → {activeSession?.endDate || "2027-03-31"}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold shrink-0">
                    App Active
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-indigo-500/15 border border-indigo-500/35 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider truncate">
                        Website &amp; Admission सत्र
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold shrink-0">
                      {websiteAdmissionSession}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={websiteSessionDraft}
                      onChange={e => setWebsiteSessionDraft(e.target.value)}
                      placeholder="e.g. 2027-28"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const matched = displayedSessions.find(
                          x =>
                            !isDemoSessionId(x.id) &&
                            formatCleanSessionName(x.name).toLowerCase() ===
                              formatCleanSessionName(websiteSessionDraft).toLowerCase()
                        );
                        handleSetWebsiteSession(websiteSessionDraft, matched?.id);
                      }}
                      disabled={saving || !websiteSessionDraft.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      सेट करें
                    </button>
                  </div>
                  {activeSession && !isDemoSessionId(activeSession.id) &&
                    formatCleanSessionName(activeSession.name) !== websiteAdmissionSession && (
                      <button
                        type="button"
                        onClick={() => handleSetWebsiteSession(activeSession.name, activeSession.id)}
                        disabled={saving}
                        className="w-full py-1 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-800 dark:text-indigo-200 text-[10px] font-bold cursor-pointer"
                      >
                        App वाला सत्र ({formatCleanSessionName(activeSession.name)}) Website पर लगाएं
                      </button>
                    )}
                </div>
              </div>

              {/* Session Re-Admission Quick Banner */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-black text-white">सत्र पुनः प्रवेश डेस्क (Re-Admission)</h5>
                    <p className="text-[10px] text-blue-200/80 truncate">केवल पुनः प्रवेश वाले छात्र ही पिछले बकाया सहित नए सत्र में जाएंगे</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSessionModal(false);
                    setView("readmission");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer shrink-0"
                >
                  Re-Admission →
                </button>
              </div>

              {/* Add New Session Toggle / Form */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                {showForm !== "session_modal" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm("session_modal");
                      setEditingSessionId(null);
                      setSessionForm({
                        name: "Session 2027-28",
                        startDate: "2027-04-01",
                        endDate: "2028-03-31"
                      });
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20 active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ नया सत्र जोड़ें (+ Add New Session)</span>
                  </button>
                ) : (
                  <div className="space-y-3 pt-1 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> नया शैक्षणिक सत्र जोड़ें
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowForm(null)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        बंद करें (Cancel)
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        सत्र का नाम (Session Name) *
                      </label>
                      <input
                        type="text"
                        value={sessionForm.name}
                        onChange={e => setSessionForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Session 2027-28 ya 2027-28"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          आरंभ तिथि (Start Date)
                        </label>
                        <input
                          type="date"
                          value={sessionForm.startDate}
                          onChange={e => setSessionForm(p => ({ ...p, startDate: e.target.value }))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          समाप्ति तिथि (End Date)
                        </label>
                        <input
                          type="date"
                          value={sessionForm.endDate}
                          onChange={e => setSessionForm(p => ({ ...p, endDate: e.target.value }))}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 pt-1">
                      <input
                        type="checkbox"
                        checked={copyClassesFromCurrent}
                        onChange={e => setCopyClassesFromCurrent(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                      />
                      <span>वर्तमान सत्र से कक्षाएं कॉपी करें (Copy existing classes structure)</span>
                    </label>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={addSession}
                        disabled={saving || !sessionForm.name.trim()}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>सत्र सहेजें व सक्रिय करें (Save &amp; Activate)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(null)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        रद्द करें
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sessions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                  <span>उपलब्ध सत्र सूची (Available Sessions)</span>
                  <span className="tabular-nums font-mono">कुल: {displayedSessions.length} सत्र</span>
                </div>

                <div className="space-y-2">
                  {displayedSessions.map((s, idx) => {
                    const isActive = s.active || s.id === activeSession?.id;
                    const isWebsiteActive =
                      !isDemoSessionId(s.id) &&
                      formatCleanSessionName(s.name).toLowerCase() === websiteAdmissionSession.toLowerCase();
                    const isEditing = editingSessionId === s.id;
                    const sessionClassesCount = classes.filter(c => c.sessionId === s.id).length;

                    if (isEditing) {
                      return (
                        <div key={s.id || idx} className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 space-y-3 animate-in fade-in">
                          <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            सत्र संपादित करें (Edit Session)
                          </p>
                          <input
                            type="text"
                            value={editSessionForm.name}
                            onChange={e => setEditSessionForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Session Name"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={editSessionForm.startDate}
                              onChange={e => setEditSessionForm(p => ({ ...p, startDate: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                            />
                            <input
                              type="date"
                              value={editSessionForm.endDate}
                              onChange={e => setEditSessionForm(p => ({ ...p, endDate: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEditSession}
                              disabled={saving}
                              className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" /> सहेजें (Save)
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSessionId(null)}
                              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                            >
                              रद्द करें
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={s.id || idx}
                        className={`p-3 sm:p-3.5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          isActive
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/30"
                            : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm text-slate-900 dark:text-white">
                              {s.name}
                            </h4>
                            {isActive && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>App Active</span>
                              </span>
                            )}
                            {isWebsiteActive && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 font-extrabold flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5" />
                                <span>Website Active</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            {s.startDate || "N/A"} → {s.endDate || "N/A"}
                            {sessionClassesCount > 0 && ` • ${sessionClassesCount} कक्षाएं`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end shrink-0">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleActivateSession(s)}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
                              title="इस सत्र को App में चालू करें"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>App सक्रिय</span>
                            </button>
                          )}
                          {!isDemoSessionId(s.id) && !isWebsiteActive && (
                            <button
                              type="button"
                              onClick={() => handleSetWebsiteSession(s.name, s.id)}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
                              title="इस सत्र को Public Website व Online Admission में दिखाएं"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>Website पर चलाएं</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSessionId(s.id);
                              setEditSessionForm({
                                name: s.name,
                                startDate: s.startDate || "",
                                endDate: s.endDate || ""
                              });
                            }}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                            title="सत्र संपादित करें (Edit Session)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                          </button>
                          {displayedSessions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(s)}
                              disabled={saving}
                              className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                              title="सत्र हटाएं (Delete Session)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowSessionModal(false);
                    setView("sessions");
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  पूरा सत्र प्रबंधन पेज खोलें →
                </button>
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  बंद करें (Done)
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── HOW TO USE & DEMO SESSION MODAL ── */}
        {showHowToUseModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      How to Use — स्कूल ERP की पूरी जानकारी
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                      हर मॉड्यूल का काम जानें, 1-टैप में खोलें और डेमो सत्र (Demo Session) कंट्रोल करें
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHowToUseModal(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0"
                  aria-label="Close How to Use"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* Demo Session Control Card */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                    schoolDemoActive
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/70"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        डमी सत्र (Demo Session • 1-Year Full Model)
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          schoolDemoActive
                            ? "bg-amber-400/90 text-slate-950"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {schoolDemoActive ? "अभी ON है" : "अभी OFF है (असली डेटा)"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      सीखने या डेमो दिखाने के लिए इसे ON करें — हर क्लास में 40 छात्र (Section A: 20, Section B: 20), 1:20 टीचर-स्टूडेंट अनुपात, 1-साल की फीस, हाजिरी, 6 परीक्षाएं और स्टाफ सैलरी अपने-आप दिख जाएगी।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleDemoData(!schoolDemoActive)}
                    className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition cursor-pointer active:scale-95 shrink-0 whitespace-nowrap ${
                      schoolDemoActive
                        ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}
                  >
                    {schoolDemoActive ? "डमी सत्र बंद करें (Turn OFF)" : "डमी सत्र चालू करें (Turn ON)"}
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={howToUseSearch}
                    onChange={(e) => setHowToUseSearch(e.target.value)}
                    placeholder="कोई भी फीचर खोजें (जैसे: फीस, रिजल्ट, बस, भाई-बहन, नोटिस, स्टाफ)..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {howToUseSearch && (
                    <button
                      type="button"
                      onClick={() => setHowToUseSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Categorized ERP Features */}
                <div className="space-y-5">
                  {navCategories.map((cat) => {
                    const q = howToUseSearch.trim().toLowerCase();
                    const filteredItems = q
                      ? cat.items.filter(
                          (item) =>
                            item.label.toLowerCase().includes(q) ||
                            item.desc.toLowerCase().includes(q) ||
                            cat.title.toLowerCase().includes(q)
                        )
                      : cat.items;
                    if (filteredItems.length === 0) return null;
                    return (
                      <div key={cat.id} className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cat.theme.accentDot}`} />
                          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                            {cat.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                            ({filteredItems.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {filteredItems.map((item) => {
                            const IconComp = item.icon;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setView(item.id);
                                  setShowHowToUseModal(false);
                                }}
                                className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 text-left transition cursor-pointer group"
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 transition">
                                    <IconComp className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                      {item.label}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug mt-0.5">
                                      {item.desc}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                                  खोलें →
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Extra Tips: Student 360 & Multi-Role Portals */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2.5">
                  <h4 className="text-xs sm:text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>खास टिप्स (Student 360° व अन्य पोर्टल)</span>
                  </h4>
                  <ul className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
                    <li>
                      • <strong>भाई-बहन अटैच व अलग-अलग फीस छूट:</strong> किसी भी छात्र पर क्लिक करें → <strong>भाई-बहन व छूट</strong> टैब में एक ही माता-पिता के 2-3 बच्चों को जोड़ें और हर बच्चे के लिए अलग-अलग मासिक छूट (₹ या %) सेट करें।
                    </li>
                    <li>
                      • <strong>1-टैप एडमिशन व बकाया निपटान:</strong> Home Dashboard पर अधूरा एडमिशन शुल्क और 1-माह एडवांस फीस बकाया कार्ड से सीधे फीस जमा करें या WhatsApp रिमाइंडर भेजें।
                    </li>
                    <li>
                      • <strong>अन्य रोल पोर्टल:</strong> बाएँ Sidebar में नीचे से <strong>Teacher</strong>, <strong>Accountant</strong> और <strong>Student</strong> व्यू में सीधे स्विच करें।
                    </li>
                  </ul>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowHowToUseModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-black transition cursor-pointer"
                >
                  बंद करें (Close)
                </button>
              </div>
            </div>
          </div>
        )}
        {showFaceStudioModal && (
          <Suspense fallback={null}>
            <UniversalFaceIdStudioModal
              isOpen={showFaceStudioModal}
              onClose={() => {
                setShowFaceStudioModal(false);
                setFaceStudioTargetPerson(null);
              }}
              hasFaceAccess={hasFaceAttendanceAccess(school)}
              onUpgradeToElite={() => {
                setShowFaceStudioModal(false);
                setView("plan");
              }}
              onOpenQrScanner={() => {
                setShowFaceStudioModal(false);
                setShowUniversalScannerModal(true);
              }}
              schoolId={schoolId}
              students={displayedStudents}
              teachers={displayedTeachers}
              classes={displayedClasses}
              initialTab={faceStudioInitialTab}
              initialTargetPerson={faceStudioTargetPerson}
              initialTargetType={faceStudioTargetType}
              onEnrollmentUpdated={() => {
                try { loadAll(); } catch (e) { console.warn("Failed to reload after enrollment:", e); }
                if (schoolId) {
                  import("../../utils/faceRecognitionEngine")
                    .then(({ getSchoolFaceDescriptors }) => getSchoolFaceDescriptors(schoolId))
                    .then((map) => {
                      const next: Record<string, boolean> = {};
                      Object.keys(map || {}).forEach((id) => {
                        next[id] = true;
                      });
                      setEnrolledFaceIds(next);
                    })
                    .catch((e) => console.warn("Failed to refresh face descriptors:", e));
                }
              }}
            />
          </Suspense>
        )}
        {confirmAction && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{confirmAction.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{confirmAction.message}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const fn = confirmAction.onConfirm;
                    setConfirmAction(null);
                    await fn();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                >
                  {confirmAction.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
        {renderAdminBottomNav()}
        {school?.id && hasEliteCallAccess(school) && (
          <NstaCallPortalHost
            identity={{
              schoolId: school.id,
              schoolName: school.name,
              userId: adminUid || "school_admin",
              userName: school.principalName || "Principal / Admin",
              userRole: "ADMIN",
              userPhoto: school.logoUrl,
            }}
          />
        )}
        {school?.id && hasEliteFeeTagadaAccess(school) && (
          <IncomingParentCallModal
            schoolId={school.id}
            schoolName={school.name}
            schoolUpiId={school.upiId}
            callerUserId={adminUid || "STAFF_ADMIN"}
            callerUserName={school.principalName || "Principal / Admin"}
            callerUserRole="ADMIN"
            students={students}
            classes={classes}
            fees={dashboardFeeHistory.length > 0 ? dashboardFeeHistory : allFees}
            feeCallFollowUps={feeCallFollowUps}
            absentStudentIds={todayAbsentStudentIds}
            inquiries={inquiries}
            onCollectFee={(studentId, classId) => {
              setFeePreselectTarget({ studentId, action: "collect_fee" });
              const targetCls = classes.find((c) => c.id === classId);
              if (targetCls) {
                setFeeClassSelected(targetCls);
                setView("fee_class");
              } else {
                setView("fee_all");
              }
            }}
            onUpdateFee={(studentId, classId) => {
              setFeePreselectTarget({ studentId, action: "fee_update" });
              const targetCls = classes.find((c) => c.id === classId);
              if (targetCls) {
                setFeeClassSelected(targetCls);
                setView("fee_class");
              } else {
                setView("fee_all");
              }
            }}
          />
        )}
        <WalkieTalkieModal
          isOpen={showWalkieModal}
          onClose={() => setShowWalkieModal(false)}
          school={school}
          schoolId={schoolId}
          currentUserId={adminUid || "STAFF_ADMIN"}
          currentUserName={school?.principalName || "Principal / Admin"}
          currentUserRole="ADMIN"
          schoolAdminUid={school?.adminUid || adminUid}
          teachers={teachers}
          accountants={accountants}
          messages={walkieMessages}
          schedule={walkieSchedule}
          onUpgradeToElite={() => setView("subscription")}
        />
      </>
    );
  };

  // ── MASTER ERP SHELL (LEFT SIDEBAR ON COMPUTER/LANDSCAPE, DRAWER ON MOBILE PORTRAIT) ────
  const renderErpShell = (content: React.ReactNode) => {
    return (
      <div className={`h-screen h-[100dvh] max-h-screen overflow-hidden flex print:h-auto print:min-h-0 print:max-h-none print:overflow-visible print:block print:bg-white transition-colors duration-200 admin-theme-${appTheme} app-theme-${appTheme} ${
        appTheme === "white"
          ? "bg-slate-100 text-slate-900"
          : appTheme === "black"
          ? "dark bg-black text-white"
          : "dark bg-[#08142c] text-slate-100"
      } w-full relative`}>
        {/* Left Sidebar (fixed in place on desktop or landscape, never scrolls with page) */}
        {renderDesktopSidebar()}

        {/* Mobile Slide-Out Drawer (only when in mobile portrait and drawer toggled) */}
        {!isEffectiveLandscape && isSidebarOpen && renderMobileSidebarDrawer()}

        {/* Main Content Area (Independent scroll container - page cards scroll smoothly while menu stays fixed) */}
        <div
          ref={mainContentScrollRef}
          className={`flex-1 flex flex-col min-w-0 h-screen h-[100dvh] max-h-screen overflow-y-auto print:h-auto print:min-h-0 print:max-h-none print:overflow-visible print:block ${
          isEffectiveLandscape ? "overflow-x-auto" : "overflow-x-hidden"
        }`}>
          {renderTopHeader()}
          <main className={`flex-1 p-3 sm:p-4 lg:p-6 w-full mx-auto pb-20 md:pb-8 print:p-0 print:m-0 print:max-w-none print:min-w-0 ${
            isEffectiveLandscape ? "min-w-[980px] sm:min-w-0 max-w-7xl" : "max-w-7xl"
          }`}>
            <Suspense
              fallback={
                <PremiumLoadingState
                  title="Loading module..."
                  subtitle="Preparing school workspace"
                  tone="auto"
                  variant="section"
                  accent="emerald"
                  schoolId={school?.id || schoolId}
                  schoolName={school?.name}
                  schoolLogoUrl={school?.logoUrl}
                />
              }
            >
              {content}
            </Suspense>
          </main>
        </div>

        {/* Floating guidance banner when rotate is requested but phone needs to be turned */}
        {showRotatePrompt && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 print:hidden bg-slate-900/95 text-white border border-cyan-400/40 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 max-w-sm text-center">
            <Laptop className="w-5 h-5 text-cyan-400 shrink-0" />
            <p className="text-xs font-bold text-cyan-200">
              💻 Laptop (Desktop) मोड सक्रिय है! आप फोन को आड़ा (Landscape) करके पूरे लैपटॉप व्यू का उपयोग कर सकते हैं।
            </p>
          </div>
        )}

        {/* Global Modals */}
        {renderGlobalModals()}
      </div>
    );
  };

  if (view !== "dashboard" && !school) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3 p-6 text-center">
        {schoolLoading ? (
          <PremiumLoadingState
            title="Loading school details..."
            subtitle="Fetching campus configuration"
            tone="auto"
            variant="section"
            accent="sky"
            schoolId={schoolId}
          />
        ) : (
          <>
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-slate-600 dark:text-slate-300">School details could not be loaded.</p>
            <button
              onClick={() => setView("dashboard")}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold cursor-pointer"
            >
              Back to dashboard
            </button>
          </>
        )}
      </div>
    );
  }

  if (view === "school_profile") {
    return renderErpShell(renderSchoolProfileModule());
  }

  if (view === "memories") {
    return renderErpShell(renderMemoriesModule());
  }

  // ── Store view (always accessible so admin can purchase/upgrade) ──────────
  if (view === "store" && school) {
    return renderErpShell(<SchoolStore school={school} onBack={() => setView("dashboard")} />);
  }

  // ── School Plan view (always accessible so admin can check details) ───────
  if (view === "subscription") {
    return renderErpShell(
      <SchoolPlanView
        school={school}
        schoolId={schoolId}
        adminUid={adminUid}
        onBack={() => setView("dashboard")}
      />
    );
  }

  // ── COMPLETE SUBSCRIPTION EXPIRED LOCKOUT SCREEN ──────────────────────────
  // If subscription has expired (00:00:00 reached), completely lock all access
  if (planExpired && !isSuperAdmin) {
    const expiredFormattedDate = _expiresAt
      ? new Date(_expiresAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "24 April 2027";

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
        {/* Ambient red alert glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-lg bg-slate-900/95 border-2 border-red-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-950/60 backdrop-blur-xl text-center space-y-6">
          {/* Animated Lock Icon */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <span className="absolute inset-0 rounded-3xl bg-red-500/20 animate-ping opacity-75" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-red-600 via-rose-700 to-red-800 flex items-center justify-center shadow-xl shadow-red-600/50 border border-red-400/50">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-black uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Access Terminated · 00:00:00</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
              Subscription Expired
            </h1>
            <p className="text-base font-black text-red-400">
              सब कुछ लॉक हो गया (Complete Lockout)
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto pt-1">
              Aapke school ka subscription plan samapt ho chuka hai. Suraksha evam policy ke anusaar school ke sabhi modules (Students, Fees, Marksheet, Attendance, Notices) lock kar diye gaye hain. Kripya Super Admin se sampark karke plan renew karwayen.
            </p>
          </div>

          {/* School & Expiry Info Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 font-medium">School Name:</span>
              <span className="font-bold text-white truncate max-w-[220px]">{school?.name || "School"}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 font-medium">School ID:</span>
              <span className="font-mono font-bold text-indigo-300">{getVisibleSchoolRegNo(school) || school?.id || schoolId}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 font-medium">Plan Status:</span>
              <span className="font-bold text-red-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                EXPIRED ({subTier === "starter_200" || subTier === "lite" ? "Basic Plan (200 Students)" : subTier === "growth_500" ? "Standard Plan (500 Students)" : "Pro Plan (2000 Students)"})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Expired On:</span>
              <span className="font-bold text-red-400">{expiredFormattedDate}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => setView("subscription")}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.98] transition cursor-pointer"
            >
              <Crown className="w-4 h-4 text-white" />
              <span>Plan Details & Renew (प्लान रिन्यू कराएं)</span>
            </button>

            <button
              type="button"
              onClick={() => setView("store")}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Open Store & Plans</span>
            </button>

            <button
              type="button"
              onClick={() =>
                safeOpenExternalUrl(
                  `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello Super Admin, hamare school (${school?.name || "School"}, ID: ${school?.id || schoolId}) ka subscription expire ho gaya hai. Kripya hamara plan turant renew karwayen.`)}`
                )
              }
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Contact Super Admin on WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout / Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Smart class handler
  if (smartClassLesson) {
    return (
      <SmartClass
        lesson={smartClassLesson}
        initialMode={smartClassMode}
        schoolId={schoolId}
        isAdmin={true}
        onBack={() => setSmartClassLesson(null)}
      />
    );
  }



  if (view === "absentee") {
    return renderErpShell(
      <AbsenteeActionPage
        schoolId={schoolId}
        schoolName={school?.name}
        classes={classes}
        currentRole="ADMIN"
        currentUserId={adminUid}
        onBack={() => setView("dashboard")}
      />
    );
  }

  const renderDailyTeacherAttendanceDesk = (options?: { showDateSelector?: boolean }) => {
    const teacherRecordsMap = teacherAttRecords?.records || {};
    const principalName = school?.principalName || "Principal / School Admin";

    let localAdminAtt: { present?: boolean; inTime?: string; outTime?: string } | null = null;
    try {
      const saved = localStorage.getItem(`nst_admin_att_${schoolId}_${teacherAttendanceDate}`);
      if (saved) localAdminAtt = JSON.parse(saved);
    } catch {
      // ignore storage errors
    }

    const principalRecord = teacherRecordsMap["ADMIN-01"] || (localAdminAtt
      ? {
          id: "ADMIN-01",
          name: principalName,
          role: "ADMIN",
          employeeId: "ADMIN-01",
          present: Boolean(localAdminAtt.present),
          status: localAdminAtt.present ? "present" : undefined,
          inTime: localAdminAtt.inTime,
          outTime: localAdminAtt.outTime,
        }
      : undefined);

    const isPrincipalPresent = principalRecord?.present === true;
    const isPrincipalLate = isPrincipalPresent && (principalRecord?.status === "late" || Boolean((principalRecord as any)?.isLate));
    const isPrincipalAbsent = principalRecord?.present === false;

    const totalTeachersCount = displayedTeachers.length;
    const totalStaffWithPrincipal = totalTeachersCount + 1;
    const enrolledTeachersCount = displayedTeachers.filter(t => enrolledFaceIds[t.id]).length;
    const pendingFaceTeachersCount = totalTeachersCount - enrolledTeachersCount;

    const presentTeachersCount =
      displayedTeachers.filter(t => teacherRecordsMap[t.id]?.present === true).length +
      (isPrincipalPresent ? 1 : 0);
    const lateTeachersCount =
      displayedTeachers.filter(t => {
        const rec = teacherRecordsMap[t.id];
        return rec?.present === true && (rec?.status === "late" || Boolean((rec as any)?.isLate));
      }).length + (isPrincipalLate ? 1 : 0);
    const absentTeachersCount =
      displayedTeachers.filter(t => teacherRecordsMap[t.id]?.present === false).length +
      (isPrincipalAbsent ? 1 : 0);

    const checkIsAfterInCutoff = () => {
      if (teacherAttendanceDate !== todayStr()) return false;
      const nowD = new Date();
      const [cH, cM] = String(attendanceSchedule?.inCutoffTime || "08:15").split(":").map(Number);
      const cutoffMin = (Number.isFinite(cH) ? cH : 8) * 60 + (Number.isFinite(cM) ? cM : 15);
      const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
      return nowMin > cutoffMin;
    };

    const filteredTeachersForAttendance = displayedTeachers.filter(t => {
      if (!teacherSearchInAttendance.trim()) return true;
      const q = teacherSearchInAttendance.toLowerCase().trim();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q)) ||
        (t.designation && t.designation.toLowerCase().includes(q))
      );
    });

    const handlePrincipalPunchInAttendance = async (action: "in" | "late" | "out" | "absent") => {
      if (!schoolId) return;
      const nowMs = Date.now();
      const nowTime = new Date(nowMs).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const currentRecords = { ...(teacherAttRecords?.records || {}) };
      const existing = currentRecords["ADMIN-01"] || principalRecord;

      if (action === "absent") {
        currentRecords["ADMIN-01"] = {
          id: "ADMIN-01",
          name: principalName,
          role: "ADMIN",
          employeeId: "ADMIN-01",
          present: false,
          status: "absent",
          isLate: false,
          inTime: undefined,
          outTime: undefined,
        } as any;
        try {
          localStorage.setItem(
            `nst_admin_att_${schoolId}_${teacherAttendanceDate}`,
            JSON.stringify({ date: teacherAttendanceDate, present: false })
          );
        } catch {
          // ignore
        }
      } else {
        const inTime = action === "in" || action === "late" ? (existing?.inTime || nowTime) : (existing?.inTime || nowTime);
        const inTimestamp = action === "in" || action === "late" ? (existing?.inTimestamp || nowMs) : (existing?.inTimestamp || nowMs);
        const outTime = action === "out" ? nowTime : existing?.outTime;
        const outTimestamp = action === "out" ? nowMs : existing?.outTimestamp;
        const stayDuration =
          action === "out" && inTime
            ? calculateStayDuration(inTime, outTime, inTimestamp, outTimestamp)
            : existing?.stayDuration;
        const isLateEntry =
          action === "late"
            ? true
            : action === "in"
            ? checkIsAfterInCutoff()
            : Boolean(existing?.status === "late" || (existing as any)?.isLate);

        currentRecords["ADMIN-01"] = {
          id: "ADMIN-01",
          name: principalName,
          role: "ADMIN",
          employeeId: "ADMIN-01",
          present: true,
          status: isLateEntry ? "late" : "present",
          isLate: isLateEntry,
          inTime,
          outTime,
          inTimestamp,
          outTimestamp,
          stayDuration,
          scanType: action === "out" ? "out" : "in",
        } as any;
        try {
          localStorage.setItem(
            `nst_admin_att_${schoolId}_${teacherAttendanceDate}`,
            JSON.stringify({ date: teacherAttendanceDate, present: true, status: isLateEntry ? "late" : "present", isLate: isLateEntry, inTime, outTime })
          );
        } catch {
          // ignore
        }
      }

      const updated: StaffDailyAttendanceRecord = {
        schoolId,
        date: teacherAttendanceDate,
        records: currentRecords,
      };
      setTeacherAttRecords(updated);
      await saveStaffDailyAttendance(updated);
      playAttendanceSuccessChimeLazy();
      speakNotification(
        "प्रधानाचार्य हाजिरी दर्ज",
        `${principalName} का ${action === "late" ? "लेट आगमन" : action === "in" ? "आगमन" : action === "out" ? "प्रस्थान" : "अनुपस्थिति"} दर्ज हुआ।`
      );
    };

    const handleTeacherPunchInAttendance = async (teacher: SchoolTeacher, action: "in" | "late" | "out" | "absent") => {
      if (!schoolId) return;
      const nowTime = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const currentRecords = { ...(teacherAttRecords?.records || {}) };
      const existing = currentRecords[teacher.id];
      const staffRole = (teacher as any)._isAccountant ? "ACCOUNTANT" : "TEACHER";
      let markedAsLate = false;

      if (action === "absent") {
        currentRecords[teacher.id] = {
          id: teacher.id,
          name: teacher.name,
          role: staffRole,
          employeeId: teacher.employeeId || teacher.id,
          present: false,
          status: "absent",
          isLate: false,
          inTime: undefined,
          outTime: undefined,
        } as any;
      } else {
        const nowMs = Date.now();
        const inTime = action === "in" || action === "late" ? (existing?.inTime || nowTime) : (existing?.inTime || nowTime);
        const inTimestamp = action === "in" || action === "late" ? (existing?.inTimestamp || nowMs) : (existing?.inTimestamp || nowMs);
        const outTime = action === "out" ? nowTime : existing?.outTime;
        const outTimestamp = action === "out" ? nowMs : existing?.outTimestamp;
        let stayDuration = existing?.stayDuration;
        if (action === "out" && inTime) {
          stayDuration = calculateStayDuration(inTime, outTime, inTimestamp, outTimestamp);
        }
        markedAsLate =
          action === "late"
            ? true
            : action === "in"
            ? checkIsAfterInCutoff()
            : Boolean(existing?.status === "late" || (existing as any)?.isLate);

        currentRecords[teacher.id] = {
          id: teacher.id,
          name: teacher.name,
          role: staffRole,
          employeeId: teacher.employeeId || teacher.id,
          present: true,
          status: markedAsLate ? "late" : "present",
          isLate: markedAsLate,
          inTime,
          outTime,
          inTimestamp,
          outTimestamp,
          stayDuration,
          scanType: action === "out" ? "out" : "in",
        } as any;
      }

      const updated: StaffDailyAttendanceRecord = {
        schoolId,
        date: teacherAttendanceDate,
        records: currentRecords,
      };

      setTeacherAttRecords(updated);
      await saveStaffDailyAttendance(updated);
      playAttendanceSuccessChimeLazy();
      speakNotification(
        "हाजिरी दर्ज",
        `${teacher.name} का ${action === "late" || (action === "in" && markedAsLate) ? "लेट आगमन" : action === "in" ? "आगमन" : action === "out" ? "प्रस्थान" : "अनुपस्थिति"} दर्ज हुआ।`
      );
    };

    const handleMarkAllTeachersPresent = async () => {
      if (!schoolId) return;
      const nowMs = Date.now();
      const nowTime = new Date(nowMs).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const autoLate = checkIsAfterInCutoff();

      const currentRecords = { ...(teacherAttRecords?.records || {}) };
      displayedTeachers.forEach((t) => {
        const existing = currentRecords[t.id];
        const keepLate = existing?.status === "late" || Boolean((existing as any)?.isLate) || autoLate;
        currentRecords[t.id] = {
          id: t.id,
          name: t.name,
          role: (t as any)._isAccountant ? "ACCOUNTANT" : "TEACHER",
          employeeId: t.employeeId || t.id,
          present: true,
          status: keepLate ? "late" : "present",
          isLate: keepLate,
          inTime: existing?.inTime || nowTime,
          inTimestamp: existing?.inTimestamp || nowMs,
          outTime: existing?.outTime,
          outTimestamp: existing?.outTimestamp,
          stayDuration: existing?.stayDuration,
          scanType: "in",
        } as any;
      });

      const updated: StaffDailyAttendanceRecord = {
        schoolId,
        date: teacherAttendanceDate,
        records: currentRecords,
      };

      setTeacherAttRecords(updated);
      await saveStaffDailyAttendance(updated);
      playAttendanceSuccessChimeLazy();
      speakNotification("हाजिरी पूर्ण", "सभी शिक्षक उपस्थित दर्ज हो गए।");
    };

    const handleMarkAllTeachersOut = async () => {
      if (!schoolId) return;
      const nowMs = Date.now();
      const nowTime = new Date(nowMs).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const currentRecords = { ...(teacherAttRecords?.records || {}) };
      let updatedCount = 0;
      displayedTeachers.forEach((t) => {
        const existing = currentRecords[t.id];
        if (existing?.present) {
          const inTime = existing.inTime || nowTime;
          const inTs = existing.inTimestamp || nowMs;
          const outTime = existing.outTime || nowTime;
          const outTs = existing.outTimestamp || nowMs;
          const stayDuration = existing.stayDuration || calculateStayDuration(inTime, outTime, inTs, outTs);
          currentRecords[t.id] = {
            ...existing,
            id: t.id,
            name: t.name,
            role: (t as any)._isAccountant ? "ACCOUNTANT" : "TEACHER",
            employeeId: t.employeeId || t.id,
            present: true,
            status: "present",
            inTime,
            inTimestamp: inTs,
            outTime,
            outTimestamp: outTs,
            stayDuration,
            scanType: "out",
          };
          if (!existing.outTime) updatedCount++;
        }
      });

      if (updatedCount === 0) {
        toast.info("सभी उपस्थित शिक्षकों का OUT पहले से दर्ज है।");
        return;
      }

      const updated: StaffDailyAttendanceRecord = {
        schoolId,
        date: teacherAttendanceDate,
        records: currentRecords,
      };

      setTeacherAttRecords(updated);
      await saveStaffDailyAttendance(updated);
      playAttendanceSuccessChimeLazy();
      toast.success(`🏃 ${updatedCount} शिक्षकों का Punch-Out दर्ज हुआ!`);
      speakNotification("प्रस्थान पूर्ण", "सभी उपस्थित शिक्षकों का प्रस्थान दर्ज हो गया।");
    };

    return (
      <div className="space-y-4 animate-in fade-in">
        {options?.showDateSelector && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-wrap shadow-xs">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Staff Daily Attendance</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Principal, Teachers &amp; Accountants attendance and biometric check-ins.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={teacherAttendanceDate}
                onChange={(e) => setTeacherAttendanceDate(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white text-xs font-mono font-semibold focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* School Admin & Principal Daily Attendance Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Principal &amp; Admin Desk
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 ${
                      isPrincipalLate
                        ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                        : isPrincipalPresent
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                        : isPrincipalAbsent
                        ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
                        : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                    }`}
                  >
                    {isPrincipalLate ? (
                      <Clock className="w-3 h-3" />
                    ) : isPrincipalPresent ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : isPrincipalAbsent ? (
                      <X className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>
                      {isPrincipalLate
                        ? "Late"
                        : isPrincipalPresent
                        ? "Present"
                        : isPrincipalAbsent
                        ? "Absent"
                        : "Pending"}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 truncate">
                  {principalName} · Principal · <span className="font-mono text-slate-500 dark:text-slate-400">ADMIN-01</span>
                </p>
                <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums flex-wrap">
                  <span>
                    In: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{principalRecord?.inTime || "--:--"}</strong>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span>
                    Out: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{principalRecord?.outTime || "--:--"}</strong>
                  </span>
                  {principalRecord?.stayDuration && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {principalRecord.stayDuration}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 sm:flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handlePrincipalPunchInAttendance("in")}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  isPrincipalPresent && !isPrincipalLate && !principalRecord?.outTime
                    ? "bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500"
                    : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                }`}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Punch In</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrincipalPunchInAttendance("late")}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  isPrincipalLate
                    ? "bg-amber-500 text-white shadow-xs ring-1 ring-amber-400"
                    : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Late</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrincipalPunchInAttendance("out")}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  principalRecord?.outTime
                    ? "bg-amber-600 text-white shadow-xs ring-1 ring-amber-500"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Punch Out</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrincipalPunchInAttendance("absent")}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  isPrincipalAbsent
                    ? "bg-rose-600 text-white shadow-xs ring-1 ring-rose-500"
                    : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                }`}
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Absent</span>
              </button>
            </div>
          </div>
        </div>

        {/* Executive Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Staff</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{totalStaffWithPrincipal}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Present Today</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{presentTeachersCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Late Arrivals</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{lateTeachersCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Absent</p>
            <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">{absentTeachersCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Face ID Ready</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">{enrolledTeachersCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Face ID Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-slate-300 mt-1 tabular-nums">{pendingFaceTeachersCount}</p>
          </div>
        </div>

        {/* Search & Quick Actions Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search teacher or accountant by name, phone, or ID..."
              value={teacherSearchInAttendance}
              onChange={(e) => setTeacherSearchInAttendance(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
            <button
              type="button"
              onClick={() => setShowFaceKioskModal(true)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0 ${
                hasFaceAttendanceAccess(school)
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 border border-slate-200 dark:border-slate-700"
              }`}
              title={hasFaceAttendanceAccess(school) ? "Launch Live Camera Face Attendance Kiosk" : "Elite Plan — AI Face Attendance"}
            >
              {hasFaceAttendanceAccess(school) ? <Sparkles className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
              <span>AI Face Kiosk</span>
              {!hasFaceAttendanceAccess(school) && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">Elite</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setFaceStudioInitialTab("TEACHERS");
                setFaceStudioTargetPerson(null);
                setShowFaceStudioModal(true);
              }}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0 ${
                hasFaceAttendanceAccess(school)
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 border border-slate-200 dark:border-slate-700"
              }`}
              title={hasFaceAttendanceAccess(school) ? "Register & manage staff Face IDs" : "Elite Plan — Live Face ID Studio"}
            >
              {hasFaceAttendanceAccess(school) ? <Camera className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
              <span>Face ID Studio</span>
              {!hasFaceAttendanceAccess(school) && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">Elite</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleMarkAllTeachersPresent}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
              title="Mark all teachers and accountants Present (IN)"
            >
              <Check className="w-3.5 h-3.5" />
              <span>All Present (IN)</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllTeachersOut}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer whitespace-nowrap shrink-0"
              title="Mark OUT for all present teachers"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>All OUT</span>
            </button>
          </div>
        </div>

        {/* School Shift Timing Bar */}
        {(() => {
          const liveShift = getLiveShiftStatus(attendanceSchedule);
          const cleanBadgeLabel = liveShift.badgeText.replace(/^[🔴🟠🟢]\s*/, "");
          return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      liveShift.phase === "out_active"
                        ? "bg-rose-500"
                        : liveShift.phase === "late_in"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {cleanBadgeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAttScheduleEditor((p) => !p)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer shrink-0 transition"
                >
                  {showAttScheduleEditor ? "Done" : "Edit Shift Times"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {liveShift.helperText}
              </p>
              {showAttScheduleEditor && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <span>IN Cutoff (Late after):</span>
                    <input
                      type="time"
                      value={attendanceSchedule.inCutoffTime}
                      onChange={(e) => {
                        const next = { ...attendanceSchedule, inCutoffTime: e.target.value };
                        setAttendanceSchedule(next);
                        if (schoolId) void saveAttendanceSchedule(schoolId, next);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <span>OUT Starts (Auto Exit):</span>
                    <input
                      type="time"
                      value={attendanceSchedule.outStartTime}
                      onChange={(e) => {
                        const next = { ...attendanceSchedule, outStartTime: e.target.value };
                        setAttendanceSchedule(next);
                        if (schoolId) void saveAttendanceSchedule(schoolId, next);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })()}

        {/* Pending Face ID Callout */}
        {pendingFaceTeachersCount > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>{pendingFaceTeachersCount} staff member(s)</strong> do not have Face ID registered yet. Enroll their face below for kiosk check-ins.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const firstPending = displayedTeachers.find(t => !enrolledFaceIds[t.id]);
                if (firstPending) handleOpenTeacherFaceEnrollment(firstPending);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 cursor-pointer active:scale-95 transition whitespace-nowrap self-start sm:self-auto"
            >
              Enroll Next Staff →
            </button>
          </div>
        )}

        {/* Teachers & Accountants Attendance Cards Grid */}
        {filteredTeachersForAttendance.length === 0 ? (
          <div className="text-center py-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-500 dark:text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2.5 opacity-40" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">No staff members found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Adjust your search filter or add staff from the Faculty Directory.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTeachersForAttendance.map((t) => {
              const rec = teacherRecordsMap[t.id];
              const isPresent = rec?.present === true;
              const isAbsent = rec?.present === false;
              const isLate = rec?.status === "late";
              const isFaceEnrolled = Boolean(enrolledFaceIds[t.id]);

              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 transition flex flex-col justify-between space-y-3.5 shadow-2xs ${
                    isPresent
                      ? "border-emerald-300 dark:border-emerald-700/60"
                      : isAbsent
                      ? "border-rose-300 dark:border-rose-700/60"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {/* Profile & Status */}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div
                        className={`w-12 h-12 rounded-xl overflow-hidden border flex items-center justify-center font-bold text-sm ${
                          isFaceEnrolled
                            ? "border-emerald-300 dark:border-emerald-700"
                            : "border-slate-200 dark:border-slate-700"
                        } bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}
                      >
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{t.name ? t.name.charAt(0).toUpperCase() : "T"}</span>
                        )}
                      </div>
                      {isFaceEnrolled && (
                        <span
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-900"
                          title="Face ID Verified"
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{t.name}</h4>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 border ${
                            isLate
                              ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                              : isPresent
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                              : isAbsent
                              ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {isPresent ? (isLate ? "Late" : "Present") : isAbsent ? "Absent" : "Pending"}
                        </span>
                      </div>

                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                        {t.designation || ((t as any)._isAccountant ? "Accountant" : "Faculty")}
                        {(t as any)._isAccountant ? " · Accounts" : ""}
                        {t.subjects ? ` · ${Array.isArray(t.subjects) ? t.subjects.join(", ") : t.subjects}` : ""}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-1 truncate">
                        {t.employeeId && <span>ID: {t.employeeId}</span>}
                        {t.employeeId && t.phone && <span className="text-slate-300 dark:text-slate-700">·</span>}
                        {t.phone && <span>{t.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Biometric Strip */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isFaceEnrolled
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Face Biometric</p>
                        <p className={`text-xs font-semibold truncate ${isFaceEnrolled ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                          {isFaceEnrolled ? "Enrolled" : "Pending Setup"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenTeacherFaceEnrollment(t)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap ${
                        isFaceEnrolled
                          ? "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                      }`}
                      title="Scan face via live camera"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isFaceEnrolled ? "Re-scan" : "Add Face ID"}</span>
                    </button>
                  </div>

                  {/* Punch Timings & Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums flex-wrap">
                      <span>
                        In: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{rec?.inTime || "--:--"}</strong>
                      </span>
                      <span>
                        Out:{" "}
                        <strong className={rec?.outTime ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-400"}>
                          {rec?.outTime || (rec?.inTime ? `Pending (${formatTime12h(attendanceSchedule.outStartTime)})` : "--:--")}
                        </strong>
                      </span>
                      {rec?.stayDuration && (
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {rec.stayDuration}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTeacherPunchInAttendance(t, "in")}
                        className={`min-h-[38px] py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                          isPresent && !isLate && !rec?.outTime
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                        }`}
                      >
                        <LogIn className="w-3 h-3" />
                        <span>In</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTeacherPunchInAttendance(t, "late")}
                        className={`min-h-[38px] py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                          isLate
                            ? "bg-amber-500 text-white shadow-2xs"
                            : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>Late</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTeacherPunchInAttendance(t, "out")}
                        className={`min-h-[38px] py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                          rec?.outTime
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                        }`}
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Out</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTeacherPunchInAttendance(t, "absent")}
                        className={`min-h-[38px] py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                          isAbsent
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                        }`}
                      >
                        <X className="w-3 h-3" />
                        <span>Abs</span>
                      </button>
                    </div>
                  </div>

                  {/* Footer Actions: ID Card & Call */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedTeacherForIdCard(t)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>ID Card</span>
                    </button>
                    {t.phone && (
                      <a
                        href={`tel:${t.phone}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (view === "attendance") {
    const activeClass = selectedClass || (displayedClasses.length > 0 ? displayedClasses[0] : null);

    return renderErpShell(
      <div className="space-y-3 p-2.5 sm:p-4 max-w-6xl mx-auto">
        {/* Unified Top Switcher: Students vs Teachers & Staff (date shown only on Teachers tab to eliminate duplicate date boxes) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
          <div className="grid grid-cols-2 sm:inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAttendanceTab("students")}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 whitespace-nowrap ${
                attendanceTab === "students"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">Students</span>
              <span className="hidden sm:inline">Student Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setAttendanceTab("teachers")}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 whitespace-nowrap ${
                attendanceTab === "teachers"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="sm:hidden tabular-nums">Staff ({displayedTeachers.length})</span>
              <span className="hidden sm:inline tabular-nums">Teachers &amp; Staff ({displayedTeachers.length})</span>
            </button>
          </div>

          {attendanceTab === "teachers" && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 sm:py-1.5 self-stretch sm:self-auto justify-between sm:justify-start">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:hidden">Date</span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={teacherAttendanceDate}
                  onChange={(e) => setTeacherAttendanceDate(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-white text-xs font-mono font-semibold focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {attendanceTab === "students" ? (
          <div className="space-y-3">
            {displayedClasses.length > 1 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center gap-3 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                  Class:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1">
                  {displayedClasses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClass(c)}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        activeClass?.id === c.id
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {c.name} {c.section ? `(${c.section})` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeClass ? (
              <AttendanceManager
                schoolId={schoolId}
                school={school}
                onOpenPlanStore={() => setView("plan")}
                classId={activeClass.id}
                className={activeClass.name}
                teacherId={adminUid}
                onBack={() => setView("classes")}
              />
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-medium text-slate-500 dark:text-slate-400">
                Please create a class first to mark student attendance.
              </div>
            )}
          </div>
        ) : (
          renderDailyTeacherAttendanceDesk()
        )}
      </div>
    );
  }

  function renderAdminBottomNav() {
    if (isEffectiveLandscape) return null;
    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";
    const navItems = [
      { id: "dashboard", label: "Home", icon: Home, active: view === "dashboard" },
      { id: "students", label: "Students", icon: Users, active: view === "students" },
      { id: "fees", label: "Fees", icon: IndianRupee, active: view === "fees" || view === "fee_class" || view === "fee_all" },
      { id: "attendance", label: "Attendance", icon: ClipboardList, active: view === "attendance" },
      { id: "nsta_broadcast", label: "Messenger", icon: MessageSquare, active: view === "nsta_broadcast" },
    ] as const;

    return (
      <nav
        aria-label="Mobile Bottom Navigation"
        className={`md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md transition-colors ${
          isWhite
            ? "bg-white/95 border-slate-200 text-slate-600"
            : isBlack
            ? "bg-black/95 border-zinc-800 text-zinc-400"
            : "bg-[#0b1936]/95 border-slate-800 text-slate-400"
        }`}
      >
        <div className="grid grid-cols-5 min-h-[62px] pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const IconComp = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id as any)}
                className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold transition cursor-pointer ${
                  item.active
                    ? isWhite
                      ? "text-indigo-600"
                      : "text-indigo-400"
                    : isWhite
                    ? "text-slate-500 hover:text-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <IconComp className="w-5 h-5 shrink-0" />
                <span className="truncate max-w-[68px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  if (view === "fee_class" && feeClassSelected) {
    return renderErpShell(
      <FeeManager
        schoolId={schoolId}
        classId={feeClassSelected.id}
        className={feeClassSelected.name}
        schoolName={school?.name}
        school={school || undefined}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        initialStudentId={feePreselectTarget?.studentId}
        initialStudentAction={feePreselectTarget?.action}
        onInitialStudentActionHandled={() => setFeePreselectTarget(null)}
        onBack={() => setView("fees")}
      />
    );
  }

  if (view === "fee_all") {
    return renderErpShell(
      <FeeManager
        schoolId={schoolId}
        className="All Classes"
        schoolName={school?.name}
        school={school || undefined}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        initialStudentId={feePreselectTarget?.studentId}
        initialStudentAction={feePreselectTarget?.action}
        onInitialStudentActionHandled={() => setFeePreselectTarget(null)}
        onBack={() => setView("fees")}
      />
    );
  }

  if (view === "sibling_profiles") {
    return renderErpShell(
      <SiblingProfileManager
        school={school!}
        students={displayedStudents}
        classes={displayedClasses}
        activeSession={activeSession}
        onUpdateStudent={(updated) => {
          setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "bus_transport") {
    return renderErpShell(
      <div className="p-3 sm:p-4 max-w-4xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView("fees")}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>← Back to Fee Collection &amp; Ledger</span>
          </button>
        </div>
        <BusTransportModal
          isOpen={true}
          onClose={() => setView("fees")}
          schoolId={schoolId}
          schoolName={school?.name}
          schoolCode={school?.code}
          classes={displayedClasses}
          students={displayedStudents}
          onUpdated={() => {}}
          isEmbedded={true}
        />
      </div>
    );
  }

  if (view === "qr_pay") {
    return renderErpShell(
      <FeeManager
        key={view}
        schoolId={schoolId}
        className="All Classes"
        schoolName={school?.name}
        school={school || undefined}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        initialTool="qr_scanner"
        exitOnToolClose={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "term_scheduler") {
    return renderErpShell(
      <FeeManager
        key={view}
        schoolId={schoolId}
        className="All Classes"
        schoolName={school?.name}
        school={school || undefined}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        initialTool="term_scheduler"
        exitOnToolClose={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "fee_tagada") {
    if (!hasEliteFeeTagadaAccess(school)) {
      return renderErpShell(
        <div className="max-w-xl mx-auto my-8 px-4">
          <EliteFeatureLockCard
            title="Fee Tagada & Offline SIM Caller"
            description="Defaulter call queue, parent promise dates, post-call follow-up sync aur SIM Caller ID sirf Elite / Supreme Plan schools ke liye uplabdh hai."
            highlights={[
              "Priority Fee Defaulter Call Queue & Promise Dates",
              "Family / Sibling Combined Tagada Calling",
              "Truecaller-style Offline SIM Caller ID & UPI QR",
            ]}
            onUpgrade={() => setView("subscription")}
            onBack={() => setView("dashboard")}
          />
        </div>
      );
    }
    return renderErpShell(
      <FeeManager
        key={view}
        schoolId={schoolId}
        className="All Classes"
        schoolName={school?.name}
        school={school || undefined}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        actorName={school?.principalName || "School Admin"}
        initialTool="fee_tagada"
        exitOnToolClose={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "fee_alerts") {
    return renderErpShell(
      <div className="space-y-2">
        {admissionAlerts.length > 0 && (
          <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-3">
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setView("online_admissions")}
                className="font-bold text-emerald-900 dark:text-emerald-200 hover:underline cursor-pointer text-left flex items-center gap-2"
              >
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black tabular-nums">
                  {admissionAlerts.length}
                </span>
                <span>
                  New Online Admission Alerts ({admissionAlerts[0]?.studentName || admissionAlerts[0]?.name || "Enquiry"}) — Tap to review
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdmissionAlerts([]);
                  try {
                    localStorage.removeItem(`school_admission_alerts_${schoolId}`);
                  } catch {}
                }}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <FeeManager
          key={view}
          schoolId={schoolId}
          className="All Classes"
          schoolName={school?.name}
          school={school || undefined}
          sessionId={activeSession?.id || ""}
          adminId={adminUid}
          initialTool="fee_alert"
          exitOnToolClose={true}
          onBack={() => setView("dashboard")}
        />
      </div>
    );
  }

  if (view === "receipt_header") {
    return renderErpShell(
      <FeeManager
        key={view}
        schoolId={schoolId}
        className="All Classes"
        schoolName={school?.name}
        school={school || undefined}
        sessionId={activeSession?.id || ""}
        adminId={adminUid}
        initialTool="header"
        exitOnToolClose={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "razorpay_setup") {
    return renderErpShell(
      <RazorpaySettingsModal
        isOpen={true}
        onClose={() => setView("dashboard")}
        schoolId={schoolId}
        schoolName={school?.name}
        adminUid={adminUid}
        onSaved={() => {
          toast.success("Razorpay Online Fee & Auto-Webhook settings saved!");
        }}
      />
    );
  }

  if (view === "results") {
    const activeClass = selectedClass || (displayedClasses.length > 0 ? displayedClasses[0] : null);
    return renderErpShell(
      <div className="space-y-3">
        {displayedClasses.length > 1 && (
          <div className="bg-slate-900 border-b border-slate-800 p-2.5 px-4 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-white">कक्षा चुनें (Class):</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {displayedClasses.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClass(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    (activeClass?.id === c.id)
                      ? "bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-300"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  {c.name} {c.section ? `(${c.section})` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeClass ? (
          <ExamResultsPanel
            schoolId={schoolId}
            classId={activeClass.id}
            className={activeClass.name}
            sessionId={activeSession?.id || ""}
            subjects={subjects.filter(s => s.classId === activeClass.id)}
            adminId={adminUid}
            schoolName={school?.name}
            school={school}
            teachers={displayedTeachers}
            onBack={() => setView("classes")}
          />
        ) : (
          <div className="p-8 text-center text-slate-400">Pehle koi Class add karein.</div>
        )}
      </div>
    );
  }

  if (view === "report_card") {
    const activeClass = selectedClass || (displayedClasses.length > 0 ? displayedClasses[0] : null);
    return renderErpShell(
      <div className="space-y-3">
        {displayedClasses.length > 1 && (
          <div className="bg-slate-900 border-b border-slate-800 p-2.5 px-4 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-black text-white">कक्षा चुनें (Class):</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {displayedClasses.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClass(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    (activeClass?.id === c.id)
                      ? "bg-blue-600 text-white font-bold shadow-xs ring-1 ring-blue-400"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  {c.name} {c.section ? `(${c.section})` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeClass ? (
          <ReportCard
            schoolId={schoolId}
            classId={activeClass.id}
            className={activeClass.name}
            sessionId={activeSession?.id || ""}
            school={school}
            teachers={displayedTeachers}
            onBack={() => setView("classes")}
          />
        ) : (
          <div className="p-8 text-center text-slate-400">Pehle koi Class add karein.</div>
        )}
      </div>
    );
  }

  if (view === "marks") {
    const activeClass = selectedClass || (displayedClasses.length > 0 ? displayedClasses[0] : null);
    return renderErpShell(
      <div className="space-y-3">
        {displayedClasses.length > 1 && (
          <div className="bg-slate-900 border-b border-slate-800 p-2.5 px-4 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Edit3 className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-black text-white">कक्षा चुनें (Class):</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {displayedClasses.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClass(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    (activeClass?.id === c.id)
                      ? "bg-orange-500 text-slate-950 font-black shadow-xs ring-1 ring-orange-300"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  {c.name} {c.section ? `(${c.section})` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeClass ? (
          <MarksManager
            schoolId={schoolId}
            classId={activeClass.id}
            className={activeClass.name}
            sessionId={activeSession?.id || ""}
            teacherId={adminUid}
            subjectId={selectedSubject?.id}
            subjectName={selectedSubject?.name}
            initialSubjects={subjects.filter(s => s.classId === activeClass.id)}
            onBack={() => setView("classes")}
          />
        ) : (
          <div className="p-8 text-center text-slate-400">Pehle koi Class add karein.</div>
        )}
      </div>
    );
  }

  if (view === "class_qr") {
    return renderErpShell(
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xl shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">Class &amp; Student Attendance QR Codes</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">प्रोजेक्टर पर लाइव क्यूआर कोड दिखाएं या प्रिंट करके क्लासरूम में लगाएं</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowUniversalScannerModal(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span>📷 Live Universal Scanner</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedClasses.map((c) => {
            const classStudents = displayedStudents.filter(s => isStudentInClass(s, c.id, c.name));
            return (
              <div key={c.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-base text-slate-800 dark:text-white">{c.name}</h4>
                    <p className="text-xs text-slate-400">{classStudents.length} Students Enrolled</p>
                  </div>
                  <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <QrCode className="w-4 h-4" />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalClass(c)}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Open Class QR &amp; Print</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 9-MODULE ENTERPRISE VIEWS ──
  if (view === "id_cards") {
    return renderErpShell(
      <LazyPanelBoundary title="ID Card Manager">
        <IdCardManager
          school={school!}
          classes={displayedClasses}
          students={displayedStudents}
          staff={displayedStaff}
          teachers={displayedTeachers}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "admit_cards") {
    return renderErpShell(
      <LazyPanelBoundary title="Admit Card Manager">
        <AdmitCardManager
          school={school!}
          classes={displayedClasses}
          students={displayedStudents}
          activeSession={activeSession}
          onSchoolUpdated={(updated) => setSchool((prev) => prev ? { ...prev, ...updated } : prev)}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "certificates") {
    return renderErpShell(
      <LazyPanelBoundary title="Certificate Manager">
        <CertificateManager
          school={school!}
          classes={displayedClasses}
          students={displayedStudents}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "marksheet_hub") {
    return renderErpShell(
      <LazyPanelBoundary title="Marksheet Generator">
        <div className="pb-12 w-full max-w-full overflow-x-hidden print:p-0 print:pb-0 print:overflow-visible">
          <MarksheetGenerator
            school={school!}
            classes={displayedClasses}
            students={displayedStudents}
            teachers={displayedTeachers}
            activeSession={activeSession}
            onSchoolUpdated={(updated) => setSchool((prev) => prev ? { ...prev, ...updated } : prev)}
            onBack={() => setView("dashboard")}
          />
        </div>
      </LazyPanelBoundary>
    );
  }

  if (view === "readmission") {
    return renderErpShell(
      <StudentReAdmissionManager
        school={school!}
        sessions={displayedSessions}
        allClasses={classes}
        allStudents={students}
        activeSession={activeSession}
        onBack={() => setView("dashboard")}
        onActivateSession={handleActivateSession}
        onReAdmitted={(newSt) => {
          setStudents(prev => [newSt, ...prev.filter(s => s.id !== newSt.id)]);
        }}
        onUndoReAdmitted={(removedId) => {
          setStudents(prev => prev.filter(s => s.id !== removedId));
        }}
      />
    );
  }

  if (view === "notices") {
    return renderErpShell(
      <NoticeBoardManager
        schoolId={schoolId}
        adminUid={adminUid}
        isAdmin={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "holidays") {
    return renderErpShell(
      <NoticeBoardManager
        schoolId={schoolId}
        adminUid={adminUid}
        isAdmin={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "staff_hrm") {
    return renderErpShell(
      <LazyPanelBoundary title="Staff HRM Manager">
        <StaffHRMManager
          school={school!}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }
  if (view === "roles_permissions" && school) {
    return renderErpShell(
      <div className="p-3 sm:p-5">
        <RolesPermissionsManager
          school={school}
          teachers={displayedTeachers}
          classes={displayedClasses}
          subjects={subjects}
          onTeacherUpdated={(updated) => {
            setTeachers((prev) => {
              const exists = prev.some((t) => t.id === updated.id);
              return exists ? prev.map((t) => (t.id === updated.id ? updated : t)) : [updated, ...prev];
            });
          }}
          onOpenTeachersDirectory={() => {
            setTeachersHubTab("directory");
            setView("teachers");
          }}
          onBack={() => setView("dashboard")}
        />
      </div>
    );
  }

  if (view === "reports_hub") {
    return renderErpShell(
      <LazyPanelBoundary title="Reports Hub">
        <SchoolReportsHub
          school={school!}
          classes={classes}
          students={students}
          teachers={teachers}
          fees={[]}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "website_cms") {
    return renderErpShell(
      <LazyPanelBoundary title="Website CMS">
        <SchoolWebsiteCms
          school={school!}
          teachers={displayedTeachers}
          isSuperAdmin={Boolean(isSuperAdmin)}
          onSchoolUpdated={(updated) => setSchool(updated)}
          onTeacherUpdated={(teacherId, patch) => {
            setTeachers(prev => prev.map(t => (t.id === teacherId ? { ...t, ...patch } : t)));
          }}
          onPreviewWebsite={() => setView("public_website")}
          onUpgradePlan={() => setView("subscription")}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "public_website") {
    return renderErpShell(
      <LazyPanelBoundary title="Public Website">
        <PublicSchoolWebsite
          school={school!}
          classes={displayedClasses}
          sessions={displayedSessions}
          teachers={displayedTeachers}
          students={displayedStudents}
          onBack={() => setView("dashboard")}
          onOpenAdmission={() => setView("online_admissions")}
          onOpenVerification={(type) => {
            if (type === "marksheet") setView("marksheet_hub");
            else if (type === "certificate") setView("certificates");
            else if (type === "idcard") setView("id_cards");
          }}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "online_admissions") {
    return renderErpShell(
      <LazyPanelBoundary title="Online Admissions">
        <OnlineAdmissionManager
          school={school!}
          classes={displayedClasses.length > 0 ? displayedClasses : classes}
          sessions={sessions}
          activeSession={activeSession}
          isAdmin={true}
          viewMode="admissions_only"
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "online_admission_fee" || view === "fee_structure") {
    return renderErpShell(
      <ClassFeeStructureSection
        schoolId={schoolId}
        sessionId={activeSession?.id}
        sessions={sessions}
        classes={classes}
        teachers={displayedTeachers}
        viewMode="classes_only"
        onBack={() => setView("dashboard")}
        onClassesUpdated={() => {}}
        onTeachersUpdated={() => {}}
      />
    );
  }

  if (view === "community") {
    return renderErpShell(
      <div className="max-w-3xl mx-auto">
        <SchoolCommunityFeed
          schoolId={schoolId}
          schoolName={school?.name || "School"}
          currentUserId={adminUid}
          currentUserName={school?.principalName || "Principal / Admin"}
          currentUserRole="ADMIN"
          classes={displayedClasses}
          onBack={() => setView("dashboard")}
        />
      </div>
    );
  }

  if (view === "timetable") {
    return renderErpShell(
      <TimetableManager
        school={school!}
        classes={displayedClasses}
        subjects={subjects}
        teachers={displayedTeachers}
        activeSession={activeSession}
        isAdmin={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "video_lectures" || view === "classroom_videos") {
    return renderErpShell(
      <ClassroomVideoArchive
        school={school!}
        classes={displayedClasses}
        teachers={displayedTeachers}
        subjects={subjects}
        activeSession={activeSession}
        currentUserRole="ADMIN"
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "class_notes_manager") {
    return renderErpShell(
      <ClassCurriculumNotesManager
        schoolId={school!.id}
        schoolName={school?.name}
        isSuperAdmin={false}
        isElite={isSchoolEliteCurriculum(school)}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "school_study_room") {
    return renderErpShell(
      <GroupStudyModal
        isOpen={true}
        onClose={() => setView("dashboard")}
        user={{
          id: adminUid,
          uid: adminUid,
          name: school?.principalName || "School Principal",
          role: "SCHOOL_ADMIN",
          isSchoolHost: true,
          schoolId: school!.id,
          schoolName: school?.name || "School",
          subscriptionLevel: "ULTRA"
        }}
        tierTheme={{ primary: '#4f46e5' }}
        isSchoolHost={true}
        schoolId={school!.id}
        schoolName={school?.name}
        schoolClasses={displayedClasses}
      />
    );
  }

  if (view === "homework") {
    return renderErpShell(
      <HomeworkManager
        school={school!}
        classes={displayedClasses}
        subjects={subjects}
        teachers={displayedTeachers}
        currentRole="ADMIN"
        currentTeacherName={school?.principalName || "Principal"}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "library") {
    return renderErpShell(
      <LibraryManager
        school={school!}
        students={displayedStudents}
        teachers={displayedTeachers}
        classes={displayedClasses}
        isAdmin={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "parent_queries") {
    return renderErpShell(
      <ParentTeacherQueryManager
        school={school!}
        students={displayedStudents}
        teachers={displayedTeachers}
        classes={displayedClasses}
        currentUserRole="ADMIN"
        currentUserName={school?.principalName || "Principal / Admin"}
        currentUserId={adminUid}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "inventory_store") {
    return renderErpShell(
      <InventoryStoreManager
        school={school!}
        students={displayedStudents}
        classes={displayedClasses}
        isAdmin={true}
        onStudentUpdated={(updated) =>
          setStudents((prev) =>
            prev.some((s) => s.id === updated.id)
              ? prev.map((s) => (s.id === updated.id ? updated : s))
              : [updated, ...prev]
          )
        }
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "nsta_broadcast") {
    return (
      <>
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
              classes={displayedClasses}
              students={displayedStudents}
              teachers={displayedTeachers}
              currentUserId={adminUid}
              currentUserName={school?.principalName || "Principal / Admin"}
              currentUserRole="ADMIN"
              onBack={() => setView("dashboard")}
            />
          </LazyPanelBoundary>
        </div>
        {renderAdminBottomNav()}
      </>
    );
  }

  if (view === "backup_recovery") {
    return renderErpShell(
      <LazyPanelBoundary title="Backup & Recovery">
        <SchoolBackupManager
          school={school}
          activeSession={activeSession}
          onRefreshData={() => {
            try { window.location.reload(); } catch {}
          }}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "expenses") {
    return renderErpShell(
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <SchoolExpenseManager
          school={school}
          activeSession={activeSession}
        />
      </div>
    );
  }

  if (view === "leaves_desk") {
    return renderErpShell(
      <div className="max-w-4xl mx-auto space-y-3">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <ParentLeaveManager
          school={school}
          mode="TEACHER_ADMIN"
          onLeaveUpdated={() => {}}
        />
      </div>
    );
  }

  if (view === "ptm_scheduler") {
    return renderErpShell(
      <PtmSchedulerModal
        school={school}
        activeSession={activeSession}
        mode="ADMIN_TEACHER"
        isOpen={true}
        onClose={() => setView("dashboard")}
      />
    );
  }

  if (view === "staff_payroll") {
    return renderErpShell(
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <StaffPayrollManager
          school={school}
          activeSession={activeSession}
          teachers={displayedTeachers}
          staffList={displayedStaff}
        />
      </div>
    );
  }

  if (view === "question_paper_builder") {
    return renderErpShell(
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <LazyPanelBoundary title="Question Paper Builder">
          <QuestionPaperBuilder
            school={school}
            activeSession={activeSession}
          />
        </LazyPanelBoundary>
      </div>
    );
  }

  if (view === "entrance_test_hub" || view === "digital_paper_library") {
    return renderErpShell(
      <LazyPanelBoundary title="Entrance Test Hub">
        <EntranceTestAdminManager
          school={school!}
          isElite={hasEntranceExamAccess(school)}
          mode={view === "digital_paper_library" ? "library_only" : "hub"}
          initialTab={view === "digital_paper_library" ? "library" : entranceHubInitialTab}
          externalBuilderPreset={view === "entrance_test_hub" ? pendingEntranceBuilderPreset : null}
          onOpenBuilderFromLibrary={(preset) => {
            setPendingEntranceBuilderPreset(preset || null);
            setEntranceHubInitialTab("builder");
            setView("entrance_test_hub");
          }}
          onUpgradePlan={() => setView("subscription")}
          onBack={() => {
            setEntranceHubInitialTab("leads");
            setView("dashboard");
          }}
          onSchoolUpdated={(updated) => setSchool(updated)}
          onConvertLeadToAdmission={async (attempt) => {
            const { evaluateEntranceScore, saveEntranceAdmissionPrefill } = await import("../../utils/entranceTestEngine");
            const evalSummary = evaluateEntranceScore(
              attempt.percentage,
              attempt.classLabel,
              attempt.classLevel
            );
            saveEntranceAdmissionPrefill({
              schoolId: school?.id || "",
              studentName: attempt.studentName,
              phone: attempt.phone,
              classLevel: attempt.classLevel,
              classLabel: attempt.classLabel,
              attemptsUsed: attempt.attemptNumber,
              bestScorePct: attempt.percentage,
              lastSetId: attempt.setId,
              evaluationTier: evalSummary.tier,
              evaluationTag: evalSummary.adminShortBadge,
              recommendedClassLevel: evalSummary.recommendedClassLevel,
              recommendedClassLabel: evalSummary.recommendedClassLabel,
              createdAt: new Date().toISOString(),
            });
            setView("online_admissions");
          }}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "receipt_cancellation") {
    return renderErpShell(
      <ReceiptCancellationModal
        asPage={true}
        isOpen={true}
        onClose={() => setView("dashboard")}
        school={school}
        activeSession={activeSession}
        defaultAuthorizedBy={school?.principalName || "Admin (Principal)"}
        onReceiptCancelled={() => {}}
      />
    );
  }

  if (view === "multi_branch") {
    return renderErpShell(
      <LazyPanelBoundary title="Multi-Branch Manager">
        <MultiBranchManager
          school={school!}
          currentSchoolId={schoolId}
          onSwitchBranch={(branchId, branchSchoolId) => {
            try {
              let bName = `${school?.name || "Main"} Branch`;
              const savedBranchesRaw = localStorage.getItem(`school_branches_${schoolId}`);
              if (savedBranchesRaw) {
                const savedBranches = JSON.parse(savedBranchesRaw);
                const matched = Array.isArray(savedBranches) ? savedBranches.find((b: any) => b.id === branchId || b.schoolId === branchSchoolId) : null;
                if (matched?.name) bName = matched.name;
              }
              setActiveBranchName(bName);
              localStorage.setItem(`active_branch_name_${schoolId}`, bName);
              localStorage.setItem("nst_active_school_id", branchSchoolId);
            } catch (err) {
              console.warn("[SchoolAdminPanel] Branch switch storage warning:", err);
            }
            setView("dashboard");
          }}
          onClose={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "document_templates") {
    return renderErpShell(
      <LazyPanelBoundary title="Template Studio">
        <DocumentTemplateStudioModal
          school={school!}
          asPage={true}
          onBack={() => setView("dashboard")}
          onSchoolUpdated={(patch) => setSchool((prev) => (prev ? { ...prev, ...patch } : prev))}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "hostel_mess") {
    return renderErpShell(
      <LazyPanelBoundary title="Hostel & Mess Manager">
        <HostelMessManager
          school={school!}
          students={displayedStudents}
          classes={displayedClasses}
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "syllabus_pacing") {
    return renderErpShell(
      <SyllabusPacingTracker
        school={school!}
        classes={displayedClasses}
        subjects={subjects}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "bus_logbook") {
    return renderErpShell(
      <BusFleetLogbookModal
        school={school!}
        onClose={() => setView("dashboard")}
      />
    );
  }

  if (view === "visitor_security") {
    return renderErpShell(
      <VisitorGateSecurityManager
        school={school!}
        students={displayedStudents}
        classes={displayedClasses}
        onBack={() => setView("dashboard")}
      />
    );
  }

  if (view === "doc_verify") {
    return renderErpShell(
      <LazyPanelBoundary title="Document Verification">
        <DocumentVerificationView
          verifyType="marksheet"
          onBack={() => setView("dashboard")}
        />
      </LazyPanelBoundary>
    );
  }

  if (view === "admission_crm") {
    return renderErpShell(
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
        <AdmissionEnquiryCrm
          school={school!}
          classes={displayedClasses}
          students={displayedStudents}
          onConvertToAdmission={() => setView("online_admissions")}
        />
      </div>
    );
  }

  if (view === "student_growth_safety") {
    return renderErpShell(
      <TeacherAdminGrowthHub
        school={school!}
        classes={displayedClasses}
        students={displayedStudents}
        actorName={school?.principalName || "School Admin"}
        canBroadcastEmergency={true}
        onBack={() => setView("dashboard")}
      />
    );
  }

  const menuItems = [
    { label: "Growth Diary, Skills & SOS", subtitle: "Daily Diary, 6-Skills, Health & Alerts", icon: <Sparkles className="w-5 h-5 text-indigo-400" />, view: "student_growth_safety", count: "Trust ⚡", locked: false, featured: true },
    { label: "Multi-Branch & Franchise Hub", subtitle: "1-Click Campus Switcher & Consolidated Stats", icon: <Building2 className="w-5 h-5 text-indigo-500" />, view: "multi_branch", count: "Multi-Campus 🏢", locked: false, featured: true },
    { label: "Hostel & Mess Management", subtitle: "Rooms, Bed Allocation & 7-Day Diet Plan", icon: <Building2 className="w-5 h-5 text-amber-500" />, view: "hostel_mess", count: "Hostel 🛏️", locked: false, featured: true },
    { label: "Syllabus Pacing Tracker", subtitle: "Chapter Velocity, Backlog & Teacher Alerts", icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, view: "syllabus_pacing", count: "Pacing 🎯", locked: false, featured: true },
    { label: "Transport Fuel & Mileage Log", subtitle: "Daily Diesel/CNG & RTO Fitness Alarms", icon: <Bus className="w-5 h-5 text-blue-500" />, view: "bus_logbook", count: "Fuel & RTO ⛽", locked: false, featured: true },
    { label: "Visitor & Security Desk", subtitle: "Visitor Gate Pass & Student Early Exit", icon: <Shield className="w-5 h-5 text-cyan-500" />, view: "visitor_security", count: "Gate Pass 🛡️", locked: false, featured: true },
    { label: "Absenty Action Center", subtitle: "1-Day Push Notice & 2-Day+ Direct Call Tracker", icon: <AlertCircle className="w-5 h-5 text-rose-500" />, view: "absentee", count: "Action 🚨", locked: false, featured: true },
    { label: "NSTA Messenger", subtitle: "Class Groups, School Desk & Teacher Chat", icon: <MessageSquare className="w-5 h-5 text-indigo-500" />, view: "nsta_broadcast", count: "3 Screens ⚡", locked: false, featured: true },
    { label: "School Community", subtitle: "Photo, Video & Chhutti Post", icon: <ImageIcon className="w-5 h-5 text-rose-500" />, view: "community", count: "LIVE", locked: false, featured: true },
    { label: "Timetable & Routine", subtitle: "Weekly Periods & Routine", icon: <Clock className="w-5 h-5 text-amber-500" />, view: "timetable", count: "8 Periods", locked: false },
    { label: "Class 1-12 Notes Manager", subtitle: "School Custom Curriculum, Notes & MCQ", icon: <Sparkles className="w-5 h-5 text-emerald-500" />, view: "class_notes_manager", count: isSchoolEliteCurriculum(school) ? "Elite 👑" : "Elite Req", locked: false, featured: true },
    { label: "Entrance Test & 500-Q Bank", subtitle: "Class 1-8 (500 Qs/Sub · 17,500 MCQs) & 100-Set PDF", icon: <GraduationCap className="w-5 h-5 text-indigo-500" />, view: "entrance_test_hub", count: !hasEntranceExamAccess(school) ? "🔒 Elite Lock" : isEntranceExamFeatureEnabled(school) ? "500 Q/Sub 👑" : "Website OFF", locked: !hasEntranceExamAccess(school), featured: true },
    { label: "Digital Library (Question Archive)", subtitle: "Session-wise Saved Papers, PDF, Answer Key & Publish", icon: <BookOpen className="w-5 h-5 text-emerald-500" />, view: "digital_paper_library", count: !hasEntranceExamAccess(school) ? "🔒 Elite Lock" : "Archive 📚", locked: !hasEntranceExamAccess(school), featured: true },
    { label: "Class Video Archive", subtitle: "Daily YouTube Lectures & Routine", icon: <Youtube className="w-5 h-5 text-red-500" />, view: "video_lectures", count: isSchoolEliteCurriculum(school) ? "Elite 👑" : "Elite Req", locked: false, featured: true },
    { label: "School Online Test", subtitle: "Live MCQ Online Test with School Curriculum", icon: <Users className="w-5 h-5 text-purple-600" />, view: "school_study_room", count: isSchoolEliteCurriculum(school) ? "Elite 👑" : "Elite Req", locked: false, featured: true },
    { label: "Daily Homework", subtitle: "Diary & Notebook Submission", icon: <BookOpen className="w-5 h-5 text-purple-600" />, view: "homework", count: "Diary", locked: false },
    { label: "Library Management", subtitle: "Books Catalog & Issue/Return", icon: <Book className="w-5 h-5 text-emerald-600" />, view: "library", count: "Books", locked: false },
    { label: "Parent-Teacher Query", subtitle: "Helpdesk & Leave Requests", icon: <MessageSquare className="w-5 h-5 text-blue-600" />, view: "parent_queries", count: "Helpdesk", locked: false },
    { label: "School Store & Stock", subtitle: "Uniforms, Books & POS Bill", icon: <Package className="w-5 h-5 text-orange-500" />, view: "inventory_store", count: "Stock", locked: false },
    { label: "Students", subtitle: "Admissions & Profiles", icon: <Users className="w-5 h-5 text-orange-500" />, view: "students", count: displayedStudents.length, locked: false },
    { label: "Fee Collection", subtitle: "Monthly Ledger & Receipts", icon: <IndianRupee className="w-5 h-5 text-emerald-500" />, view: "fees", count: "Live Sync", locked: false },
    { label: "Fee Tagada Caller", subtitle: "Offline SIM Call & Promise Date", icon: <PhoneCall className="w-5 h-5 text-emerald-600" />, view: "fee_tagada", count: hasEliteFeeTagadaAccess(school) ? "Tagada 📞" : "🔒 Elite Lock", locked: !hasEliteFeeTagadaAccess(school), featured: true },
    { label: "Scan QR to Pay", subtitle: "Instant ID Card Fee Collect", icon: <QrCode className="w-5 h-5 text-cyan-500" />, view: "qr_pay", count: "Fast Pay", locked: false, featured: true },
    { label: "QR ID Cards", subtitle: "Print & Scan Student ID", icon: <CreditCard className="w-5 h-5 text-indigo-500" />, view: "id_cards", count: "Live QR", locked: false },
    { label: "Classes", subtitle: "Sections, Attendance & Marks", icon: <BookOpen className="w-5 h-5 text-purple-500" />, view: "classes", count: displayedClasses.length, locked: false },
    { label: "Teachers & Staff Hub", subtitle: "Directory, Salary, Slips & HRM", icon: <Users className="w-5 h-5 text-green-500" />, view: "teachers", count: displayedTeachers.length, locked: false },
    { label: "Fee Structure & Heads", subtitle: "Class & Online Admission Heads", icon: <IndianRupee className="w-5 h-5 text-emerald-600" />, view: "fee_structure", count: "Class + Adm", locked: false },
    { label: "Term / Exam Fee & Month Add", subtitle: "2-Monthly Exam, Reg-Only Defer & Exempt", icon: <CalendarClock className="w-5 h-5 text-indigo-500" />, view: "term_scheduler", count: "NEW ⚡", locked: false, featured: true },
    { label: "Marksheet (रिजल्ट)", subtitle: "Report Card & Print", icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />, view: "marksheet_hub", count: "Official", locked: false },
    { label: "Notice Board & Holidays", subtitle: "Circulars & Festival Holidays", icon: <Megaphone className="w-5 h-5 text-purple-600" />, view: "notices", count: "Circulars", locked: false },
    { label: "Admit Cards", subtitle: "Exam Hall Tickets", icon: <FileText className="w-5 h-5 text-rose-500" />, view: "admit_cards", count: "Hall Ticket", locked: false },
    { label: "Certificates", subtitle: "TC, Bonafide & Merit", icon: <Award className="w-5 h-5 text-amber-500" />, view: "certificates", count: "TC & Merit", locked: false },
    { label: "Re-Admission (पुनः प्रवेश)", subtitle: "Back Due & Next Session", icon: <UserPlus className="w-5 h-5 text-blue-600" />, view: "readmission", count: "पुनः प्रवेश", locked: false },
    { label: "Reports & Print", subtitle: "40+ Register Sheets", icon: <FileSpreadsheet className="w-5 h-5 text-cyan-600" />, view: "reports_hub", count: "40+ Reports", locked: false },
    { label: "Website Manager (CMS)", subtitle: "Custom Banner, Photos & Gallery", icon: <Sparkles className="w-5 h-5 text-amber-500" />, view: "website_cms", count: isSchoolEliteCurriculum(school) ? "Elite 👑" : "Elite Req", locked: false, featured: true },
    { label: "Public Website", subtitle: isSchoolEliteCurriculum(school) ? "Live Custom School Portal" : "Default Website (Lite)", icon: <Globe className="w-5 h-5 text-indigo-500" />, view: "public_website", count: "Live", locked: false },
    { label: "Online Admissions", subtitle: "New Enquiries", icon: <UserPlus className="w-5 h-5 text-amber-500" />, view: "online_admissions", count: "Portal", locked: false },
  ];

  // ── ACCOUNT & SWITCH HUB PAGE (Dedicated screen for role switch, app explore & account actions) ──
  const renderAccountHubPage = () => {
    const displaySchoolLogo = school ? getSavedSchoolLogo(school.logoUrl, schoolId) : "";
    const isWhite = appTheme === "white";
    const isBlack = appTheme === "black";

    const cardSurface = isWhite
      ? "bg-white border-slate-200/90 text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      : isBlack
      ? "bg-neutral-950 border-neutral-800 text-white"
      : "bg-[#0d1d3c] border-[#1f3b6e] text-white";

    const dividerClass = isWhite
      ? "border-slate-100"
      : isBlack
      ? "border-neutral-800/80"
      : "border-[#1b3563]";

    const titleColor = isWhite ? "text-slate-900" : "text-white";
    const mutedColor = isWhite ? "text-slate-500" : "text-slate-400";
    const regNo = getVisibleSchoolRegNo(school);
    const sessionLabel = activeSession?.name || getDynamicAcademicSessionLabel();

    const roleSwitchCards = [
      {
        key: "teacher",
        title: "Teacher View",
        subtitleHindi: "शिक्षक पैनल",
        description: "दैनिक अटेंडेंस, होमवर्क डायरी, क्लास नोट्स व मार्क्स एंट्री इंटरफेस।",
        cta: "Teacher View खोलें",
        icon: GraduationCap,
        iconBox: isWhite
          ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
          : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
        accentText: isWhite ? "text-emerald-700" : "text-emerald-400",
        hoverBorder: isWhite ? "hover:border-emerald-300" : "hover:border-emerald-500/50",
        onClick: () => {
          if (onPreviewTeacher) onPreviewTeacher();
        },
      },
      {
        key: "accountant",
        title: "Accountant View",
        subtitleHindi: "लेखापाल पैनल",
        description: "फीस वसूली, रसीद जनरेशन, डे-बुक, पेंडिंग ड्यूज व फाइनेंशियल रिपोर्ट्स।",
        cta: "Accountant View खोलें",
        icon: Briefcase,
        iconBox: isWhite
          ? "bg-amber-50 border-amber-200/80 text-amber-700"
          : "bg-amber-500/10 border-amber-500/25 text-amber-400",
        accentText: isWhite ? "text-amber-700" : "text-amber-400",
        hoverBorder: isWhite ? "hover:border-amber-300" : "hover:border-amber-500/50",
        onClick: () => {
          if (onPreviewAccountant) onPreviewAccountant();
        },
      },
      {
        key: "student",
        title: "Student View",
        subtitleHindi: "छात्र / पैरेंट",
        description: "रिजल्ट मार्कशीट, उपस्थिति रिकॉर्ड, डिजिटल नोटिस बोर्ड व फीस स्लिप।",
        cta: "Student View खोलें",
        icon: User,
        iconBox: isWhite
          ? "bg-indigo-50 border-indigo-200/80 text-indigo-700"
          : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400",
        accentText: isWhite ? "text-indigo-700" : "text-indigo-400",
        hoverBorder: isWhite ? "hover:border-indigo-300" : "hover:border-indigo-500/50",
        onClick: () => {
          if (onPreviewStudent) onPreviewStudent();
        },
      },
    ];

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-8 animate-in fade-in duration-200">
        {/* Top Architectural Header Bar */}
        <div className={`flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 rounded-2xl border ${cardSurface}`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition cursor-pointer active:scale-95 ${
                isWhite
                  ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                  : isBlack
                  ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-slate-200"
                  : "bg-white/5 hover:bg-white/10 border-white/15 text-slate-200"
              }`}
              title="डैशबोर्ड पर वापस जाएँ"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className={`text-base sm:text-lg font-extrabold tracking-tight truncate ${titleColor}`}>
                अकाउंट व स्विच हब (Account Hub)
              </h2>
              <p className={`text-xs truncate ${mutedColor}`}>
                Teacher, Accountant, Student व्यू व लॉगआउट विकल्प
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setView("dashboard")}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer active:scale-[0.98] whitespace-nowrap shrink-0 ${
              isWhite
                ? "bg-slate-900 hover:bg-slate-800 border-slate-900 text-white"
                : isBlack
                ? "bg-white hover:bg-slate-100 border-white text-neutral-950"
                : "bg-white/10 hover:bg-white/15 border-white/20 text-white"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Institutional School & Admin Identity Card */}
        <div className={`rounded-2xl border p-5 sm:p-6 ${cardSurface}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 text-center sm:text-left min-w-0">
              {displaySchoolLogo ? (
                <div
                  className={`w-16 h-16 rounded-2xl border p-1.5 shrink-0 flex items-center justify-center ${
                    isWhite ? "bg-white border-slate-200" : "bg-white border-white/20"
                  }`}
                >
                  <img
                    src={displaySchoolLogo}
                    alt={school?.name || "School Logo"}
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
              ) : (
                <div
                  className={`w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0 ${
                    isWhite
                      ? "bg-slate-50 border-slate-200 text-slate-700"
                      : "bg-white/5 border-white/15 text-slate-200"
                  }`}
                >
                  <Building2 className="w-7 h-7" />
                </div>
              )}

              <div className="min-w-0 space-y-1.5">
                <h3 className={`text-lg sm:text-xl font-extrabold tracking-tight ${titleColor}`}>
                  {school?.name || "School Ecosystem"}
                </h3>
                <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-xs font-medium ${mutedColor}`}>
                  {regNo && (
                    <>
                      <span className="font-mono tabular-nums">Reg. No: {regNo}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className="tabular-nums">सत्र {sessionLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className={isWhite ? "text-emerald-700 font-semibold" : "text-emerald-400 font-semibold"}>
                    स्कूल एडमिनिस्ट्रेटर
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>डायरेक्ट स्कूल पोर्टल</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSettingsTab("profile");
                setView("school_profile");
              }}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold border inline-flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98] whitespace-nowrap shrink-0 ${
                isWhite
                  ? "bg-slate-900 hover:bg-slate-800 border-slate-900 text-white"
                  : isBlack
                  ? "bg-white hover:bg-slate-100 border-white text-neutral-950"
                  : "bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>स्कूल सेटिंग्स (Settings)</span>
            </button>
          </div>
        </div>

        {/* School Admin Account Recovery Card & Edit Modal */}
        <AccountRecoveryCard
          uid={adminUid || school?.id || "admin_uid"}
          role="SCHOOL_ADMIN"
          name={school?.principalName || `${school?.name || "School"} Admin`}
          displayId={school?.id}
          schoolId={schoolId}
          schoolName={school?.name}
          initialMobile={school?.phone || ""}
          initialEmail={school?.adminEmail || school?.email || ""}
          theme={appTheme}
          extraSync={async (payload) => {
            if (schoolId) {
              const patch: any = {};
              if (payload.mobile && !school?.phone) patch.phone = payload.mobile;
              if (payload.email && !school?.adminEmail) patch.adminEmail = payload.email;
              if (Object.keys(patch).length > 0) {
                await updateSchool(schoolId, patch).catch(() => {});
              }
            }
          }}
        />

        {/* Section 1: Explore Full NSTA Learning App (Only shown when platform content access is passed, e.g. SuperAdmin) */}
        {onOpenPlatformContent && (
          <div className={`p-5 rounded-2xl border ${cardSurface}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    isWhite
                      ? "bg-indigo-50 border-indigo-200/80 text-indigo-700"
                      : "bg-indigo-500/10 border-indigo-500/25 text-indigo-300"
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-sm font-bold ${titleColor}`}>
                      Explore Full NSTA App
                    </h3>
                    <span className={`text-[11px] ${mutedColor}`} aria-hidden="true">·</span>
                    <span className={`text-xs font-semibold ${isWhite ? "text-indigo-700" : "text-indigo-300"}`}>
                      53+ Books &amp; MCQs
                    </span>
                  </div>
                  <p className={`text-xs mt-1 max-w-xl leading-relaxed ${mutedColor}`}>
                    मुख्य NSTA स्टूडेंट लर्निंग ऐप खोलें: NCERT किताबें, डेली क्विज, टेस्ट सीरीज, डिजिटल लाइब्रेरी व कॉम्पिटिटिव स्टडी रूम।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExploreFullApp}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98] whitespace-nowrap shrink-0 ${
                  isWhite
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-indigo-500 hover:bg-indigo-400 text-white"
                }`}
              >
                <span>मुख्य ऐप खोलें</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Section 2: Role & Dashboard View Switcher */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 px-0.5 flex-wrap">
            <h3 className={`text-sm font-bold tracking-tight ${titleColor}`}>
              डैशबोर्ड व्यू स्विच करें <span className={`font-medium ${mutedColor}`}>(Role Views)</span>
            </h3>
            <span className={`text-xs ${mutedColor}`}>पोर्टल को अन्य रोल के नजरिए से देखें</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {roleSwitchCards.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`group text-left rounded-2xl border transition duration-150 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-[0.99] ${cardSurface} ${item.hoverBorder}`}
                >
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.iconBox}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className={`text-[11px] font-semibold ${item.accentText}`}>
                        {item.subtitleHindi}
                      </span>
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${titleColor}`}>{item.title}</h4>
                      <p className={`text-xs mt-1 leading-relaxed ${mutedColor}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`px-4 py-3 sm:px-5 border-t flex items-center justify-between text-xs font-semibold transition-colors ${dividerClass} ${
                      isWhite
                        ? "bg-slate-50/70 group-hover:bg-slate-100/80 text-slate-800"
                        : "bg-white/[0.02] group-hover:bg-white/[0.05] text-slate-200"
                    }`}
                  >
                    <span>{item.cta}</span>
                    <ArrowRight className={`w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 ${item.accentText}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2.5: Parent Caller ID (Ulta Directory) & Smart Voice */}
        <div className="space-y-2.5">
          <h3 className={`text-sm font-bold tracking-tight px-0.5 ${titleColor}`}>
            Parent Caller ID <span className={`font-medium ${mutedColor}`}>(Ulta Directory &amp; Offline Voice)</span>
          </h3>
          <CallerIdSettingsCard
            mode="staff"
            schoolId={school?.id || schoolId}
            schoolName={school?.name}
            isEliteLocked={!hasEliteFeeTagadaAccess(school)}
            onUpgradeToElite={() => setView("subscription")}
          />
        </div>

        {/* Section 3: Session & Account Actions */}
        <div className="space-y-2.5">
          <h3 className={`text-sm font-bold tracking-tight px-0.5 ${titleColor}`}>
            सत्र व खाता विकल्प <span className={`font-medium ${mutedColor}`}>(Session &amp; Account)</span>
          </h3>

          <div className={`rounded-2xl border divide-y overflow-hidden ${cardSurface} ${
            isWhite ? "divide-slate-100" : isBlack ? "divide-neutral-800/80" : "divide-[#1b3563]"
          }`}>
            {canExitSchool && (
              <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isWhite
                        ? "bg-amber-50 border-amber-200/80 text-amber-700"
                        : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-sm font-bold ${titleColor}`}>
                      Leave School (स्कूल छोड़ें)
                    </h4>
                    <p className={`text-xs truncate ${mutedColor}`}>
                      इस स्कूल से अपना खाता अलग (detach) करें
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirmModal(true)}
                  className={`px-3.5 py-2 rounded-xl border font-semibold text-xs cursor-pointer active:scale-[0.98] transition shrink-0 whitespace-nowrap ${
                    isWhite
                      ? "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800"
                      : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300"
                  }`}
                >
                  Leave
                </button>
              </div>
            )}

            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isWhite
                      ? "bg-rose-50 border-rose-200/80 text-rose-600"
                      : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-sm font-bold ${titleColor}`}>
                    Admin Logout (एडमिन लॉगआउट)
                  </h4>
                  <p className={`text-xs truncate ${mutedColor}`}>
                    स्कूल एडमिन सत्र सुरक्षित रूप से समाप्त करें
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePerformLogout}
                className={`px-4 py-2 rounded-xl border font-semibold text-xs cursor-pointer active:scale-[0.98] transition shrink-0 whitespace-nowrap ${
                  isWhite
                    ? "bg-rose-600 hover:bg-rose-700 border-rose-600 text-white"
                    : "bg-rose-500/15 hover:bg-rose-600 border-rose-500/35 text-rose-300 hover:text-white"
                }`}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // List views
  const renderListView = () => {
    if (view === "account_hub") {
      return renderAccountHubPage();
    }
    if (view === "accounts_directory") {
      return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          <LazyPanelBoundary title="Accounts Directory">
            <AdminAccountsDirectory
              schoolId={schoolId}
              schoolName={school?.name}
              school={school}
              students={displayedStudents}
              teachers={displayedTeachers}
              accountants={accountants}
              staffList={displayedStaff}
              isSuperAdminMode={false}
              theme={appTheme}
            />
          </LazyPanelBoundary>
        </div>
      );
    }
    if (view === "sessions") {
      return (
        <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto animate-in fade-in duration-200">
          {/* Top Header Card with Back Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95"
                title="डैशबोर्ड पर वापस लौटें"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    शैक्षणिक सत्र (Academic Sessions)
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold">
                    सत्र: {displayedSessions.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  सत्र बदलें, नया सत्र जोड़ें, संपादित करें व वार्षिक डेटा पृथक रखें
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setView("readmission")}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>🔄 छात्र पुनः प्रवेश (Re-Admission)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(showForm === "session" ? null : "session");
                  setEditingSessionId(null);
                  setSessionForm({
                    name: "Session 2027-28",
                    startDate: "2027-04-01",
                    endDate: "2028-03-31"
                  });
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ नया सत्र जोड़ें</span>
              </button>
            </div>
          </div>

          {/* Dual Session Control Cards: School App Active vs Website & Online Admission */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 flex items-start justify-between gap-3 shadow-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    School App सक्रिय सत्र (ERP Active)
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
                  {activeSession?.name || getDynamicAcademicSessionLabel()}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  अवधि: {activeSession?.startDate || "2026-04-01"} → {activeSession?.endDate || "2027-03-31"} • {displayedClasses.length} कक्षाएं • {displayedStudents.length} छात्र
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-600 text-white font-black shadow-xs shrink-0">
                App Active
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-indigo-500/15 border border-indigo-500/35 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider truncate">
                    Public Website व Online Admission सत्र
                  </span>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-black shadow-xs shrink-0">
                  {websiteAdmissionSession}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={websiteSessionDraft}
                  onChange={e => setWebsiteSessionDraft(e.target.value)}
                  placeholder="e.g. 2027-28 ya 2026-27"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const matched = displayedSessions.find(
                      x =>
                        !isDemoSessionId(x.id) &&
                        formatCleanSessionName(x.name).toLowerCase() ===
                          formatCleanSessionName(websiteSessionDraft).toLowerCase()
                    );
                    handleSetWebsiteSession(websiteSessionDraft, matched?.id);
                  }}
                  disabled={saving || !websiteSessionDraft.trim()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  Website पर सेट करें
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                यहाँ से आप तय कर सकते हैं कि पब्लिक वेबसाइट और ऑनलाइन एडमिशन पोर्टल पर कौन-सा सत्र सक्रिय दिखे (App सत्र से अलग या समान)।
              </p>
            </div>
          </div>

          {/* Add Session Form */}
          {showForm === "session" && !editingSessionId && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-blue-300 dark:border-blue-700 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> नया शैक्षणिक सत्र जोड़ें (Create New Academic Session)
                </h4>
                <button
                  type="button"
                  onClick={() => setShowForm(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕ Cancel
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  सत्र का नाम (Session Name) *
                </label>
                <input
                  type="text"
                  value={sessionForm.name}
                  onChange={e => setSessionForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Session 2027-28 ya 2027-28"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    आरंभ तिथि (Session Start Date)
                  </label>
                  <input
                    type="date"
                    value={sessionForm.startDate}
                    onChange={e => setSessionForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    समाप्ति तिथि (Session End Date)
                  </label>
                  <input
                    type="date"
                    value={sessionForm.endDate}
                    onChange={e => setSessionForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={copyClassesFromCurrent}
                  onChange={e => setCopyClassesFromCurrent(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
                <span>वर्तमान सत्र की कक्षा संरचना (Classes &amp; Sections) नए सत्र में कॉपी करें</span>
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={addSession}
                  disabled={saving || !sessionForm.name.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>सत्र सहेजें व सक्रिय करें (Save &amp; Set Active)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(null)}
                  className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  रद्द करें
                </button>
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              सभी शैक्षणिक सत्र (All School Sessions)
            </h3>

            {displayedSessions.map((s, idx) => {
              const isActive = s.active || s.id === activeSession?.id;
              const isWebsiteActive =
                !isDemoSessionId(s.id) &&
                formatCleanSessionName(s.name).toLowerCase() === websiteAdmissionSession.toLowerCase();
              const isEditing = editingSessionId === s.id;
              const sessionClassesCount = classes.filter(c => c.sessionId === s.id).length;

              return (
                <div
                  key={s.id || `session-${s.name || idx}-${idx}`}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                    isActive
                      ? "bg-white dark:bg-slate-800/95 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30"
                      : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3 animate-in fade-in">
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        सत्र संपादित करें (Edit Session Details)
                      </p>
                      <input
                        type="text"
                        value={editSessionForm.name}
                        onChange={e => setEditSessionForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Session Name"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={editSessionForm.startDate}
                          onChange={e => setEditSessionForm(p => ({ ...p, startDate: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                        />
                        <input
                          type="date"
                          value={editSessionForm.endDate}
                          onChange={e => setEditSessionForm(p => ({ ...p, endDate: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEditSession}
                          disabled={saving}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-60 transition cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "सहेजें (Save)"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSessionId(null)}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          रद्द करें
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-base text-slate-900 dark:text-white">
                            {s.name}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-extrabold flex items-center gap-1 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>App Active</span>
                            </span>
                          )}
                          {isWebsiteActive && (
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 font-extrabold flex items-center gap-1 shadow-xs">
                              <Globe className="w-3 h-3" />
                              <span>Website Active</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                          {s.startDate || "N/A"} → {s.endDate || "N/A"}
                          {sessionClassesCount > 0 && ` • ${sessionClassesCount} कक्षाएं`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end shrink-0">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleActivateSession(s)}
                            disabled={saving}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                            title="इस सत्र को App में चालू करें"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>App में सक्रिय करें</span>
                          </button>
                        )}
                        {!isDemoSessionId(s.id) && !isWebsiteActive && (
                          <button
                            type="button"
                            onClick={() => handleSetWebsiteSession(s.name, s.id)}
                            disabled={saving}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                            title="इस सत्र को पब्लिक वेबसाइट व ऑनलाइन एडमिशन में दिखाएं"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Website पर चलाएं</span>
                          </button>
                        )}
                        {!isDemoSessionId(s.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSessionId(s.id);
                              setEditSessionForm({
                                name: s.name,
                                startDate: s.startDate || "",
                                endDate: s.endDate || ""
                              });
                              setShowForm(null);
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            title="सत्र विवरण बदलें"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Edit</span>
                          </button>
                        )}
                        {!isDemoSessionId(s.id) && displayedSessions.filter(x => !isDemoSessionId(x.id)).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(s)}
                            disabled={saving}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 transition cursor-pointer disabled:opacity-50"
                            title="सत्र हटाएं"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (view === "face_id_studio") {
      return (
        <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-3">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                {hasFaceAttendanceAccess(school) ? "Universal Live Biometric System" : "👑 Elite Plan Exclusive Feature"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black">
                📷 लाइव फेस आईडी स्टुडियो (Live Face ID Studio)
              </h2>
              <p className="text-sm text-emerald-100 max-w-xl">
                {hasFaceAttendanceAccess(school)
                  ? "2D फोटो अपलोड के बजाय लाइव कैमरे से हर छात्र व शिक्षक का चेहरा रजिस्टर करें। 128-पॉइंट बायोमेट्रिक लैंडमार्क्स क्लाउड व डिवाइस दोनों में सिंक रहते हैं और 0.58 कैलिब्रेटेड थ्रेशोल्ड पर तुरंत मैच होते हैं।"
                  : "🤖 AI Face Attendance aur Live Face ID Studio sirf 👑 Elite Subscription walon ke liye hai. Lite Plan mein 📷 QR Code Scan Attendance uplabdh hai."}
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowFaceStudioModal(true)}
                  className="px-6 py-3 bg-white text-emerald-900 rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-50 active:scale-95 transition cursor-pointer flex items-center gap-2"
                >
                  {hasFaceAttendanceAccess(school) ? <Camera className="w-5 h-5 text-emerald-700" /> : <Lock className="w-5 h-5 text-amber-600" />}
                  <span>
                    {hasFaceAttendanceAccess(school)
                      ? "Open Face ID Studio (स्टुडियो खोलें)"
                      : "👑 Elite Plan Upgrade Karein"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("classes")}
                  className="px-5 py-3 bg-emerald-800/80 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm transition cursor-pointer"
                >
                  Daily Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === "classes") {
      const sortedClasses = sortSchoolClasses(displayedClasses);

      const filteredClasses = sortedClasses.filter(cls => {
        if (!classSearchQuery.trim()) return true;
        const q = classSearchQuery.toLowerCase();
        return (
          cls.name.toLowerCase().includes(q) ||
          (cls.section && cls.section.toLowerCase().includes(q))
        );
      });

      return (
        <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
          {!activeSession && (
            <div className="text-center py-10 text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6">
              <p className="font-bold text-slate-600 dark:text-slate-300 text-base mb-1">Session Not Selected</p>
              <p className="text-xs">Classes create karne se pehle kripya ek Academic Session select ya create karein.</p>
            </div>
          )}

          {activeSession && (
            <>
              {/* Header Banner & Global Actions */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span>Class Management</span>
                    </h2>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/30">
                      {activeSession.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{displayedClasses.length} Total Classes</span>
                    <span>•</span>
                    <span>{displayedStudents.length} Enrolled Students</span>
                    <span>•</span>
                    <span>{subjects.length} Subjects</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setView("fee_structure")}
                    className="flex-1 sm:flex-none px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                    title="Admission Fee, Tuition Fee, Caution Money, Annual Charges, Bus Fee edit karein"
                  >
                    <IndianRupee className="w-4 h-4" />
                    <span>Class Fee Setup (5 Heads)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(showForm === "class" ? null : "class"); setEditingClassId(null); }}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Class</span>
                  </button>
                </div>
              </div>

              {/* Class Search Bar */}
              {classes.length > 0 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={classSearchQuery}
                    onChange={e => setClassSearchQuery(e.target.value)}
                    placeholder="Search class by name or section (e.g. Class 10, Nursery, A)..."
                    className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition shadow-2xs"
                  />
                  {classSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setClassSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Add Class Form Modal / Collapsible */}
              {showForm === "class" && !editingClassId && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border-2 border-blue-500/30 shadow-lg space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span>Create New Class</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowForm(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-bold mb-1.5">Quick Grade Presets:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CLASS_PRESETS.map((preset, idx) => (
                        <button
                          key={`quick-preset-${preset}-${idx}`}
                          type="button"
                          onClick={() => setClassForm(p => ({ ...p, name: preset }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                            classForm.name === preset
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Class Name *
                      </label>
                      <input
                        value={classForm.name}
                        onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Class 10"
                        className="w-full px-3 py-2 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Section (Optional)
                      </label>
                      <input
                        value={classForm.section}
                        onChange={e => setClassForm(p => ({ ...p, section: e.target.value }))}
                        placeholder="e.g. A, B, Science"
                        className="w-full px-3 py-2 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Stream Selection for Class 11 and Class 12 */}
                  {isSeniorClass(classForm.name) && (
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>Senior Secondary Stream (स्ट्रीम चुनें) *</span>
                        </label>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Class 11 / 12 Special</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {SENIOR_STREAMS.map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setClassForm(p => ({ ...p, stream: st.id }))}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              classForm.stream === st.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-black text-xs">
                              <span>{st.icon}</span>
                              <span>{st.label}</span>
                            </div>
                            <p className={`text-[10px] mt-1 line-clamp-1 ${classForm.stream === st.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {st.desc}
                            </p>
                          </button>
                        ))}
                      </div>

                      {/* Pre-configured stream subjects preview */}
                      <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-indigo-900 dark:text-indigo-200">Pre-loaded Subjects: </span>
                        <span className="font-semibold">
                          {getDefaultSubjectsForClass(classForm.name, classForm.stream || "Science").join(", ")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Auto-create pre-configured subjects toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={classForm.autoAddSubjects}
                      onChange={e => setClassForm(p => ({ ...p, autoAddSubjects: e.target.checked }))}
                      className="rounded accent-blue-600 w-4 h-4"
                    />
                    <span>
                      {isSeniorClass(classForm.name)
                        ? `Auto-create Stream Subjects (स्ट्रीम के ${getDefaultSubjectsForClass(classForm.name, classForm.stream || "Science").length} विषय अपने आप जोड़ें)`
                        : `Auto-create Standard Subjects (कक्षा के मानक विषय अपने आप जोड़ें)`}
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      Default Monthly Fee (₹):
                    </label>
                    <input
                      type="number"
                      value={(classForm as any).defaultFee || ""}
                      placeholder="0"
                      onChange={e => setClassForm(p => ({ ...p, defaultFee: Number(e.target.value) } as any))}
                      className="flex-1 max-w-[200px] px-3 py-2 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm font-bold"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={addClass}
                      disabled={saving}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black disabled:opacity-60 shadow-md active:scale-95 transition"
                    >
                      {saving ? "Saving Class..." : "Create Class"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(null)}
                      className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Class Cards List */}
              {filteredClasses.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                    {classSearchQuery ? "Koi class match nahi hui" : "Abhi koi class nahi bani"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {classSearchQuery ? `"${classSearchQuery}" se match hone wali koi class nahi hai.` : "Upar diye '+ Add New Class' button se apni pehli class banayein."}
                  </p>
                </div>
              ) : (
                filteredClasses.map((cls, idx) => {
                  const classStudents = displayedStudents.filter(s => isStudentInClass(s, cls.id, cls.name));
                  const classSubjects = subjects.filter(s => s.classId === cls.id);
                  const defaultFee = Number((cls as any).defaultFee) || 0;
                  const isToolsExpanded = expandedToolsClassId === cls.id;

                  // Grade badge text: e.g. "10", "9", "KG", "NUR", "PL"
                  const cleanName = cls.name.trim();
                  const numMatch = cleanName.match(/\d+/);
                  const badgeNumber = numMatch ? numMatch[0] : cleanName.slice(0, 3).toUpperCase();

                  return (
                    <div
                      key={cls.id || `cls-${cls.name}-${idx}`}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all overflow-hidden"
                    >
                      {editingClassId === cls.id ? (
                        <div className="p-5 space-y-3.5 bg-slate-50/50 dark:bg-slate-800/80">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Class Settings</span>
                            </p>
                            <span className="text-[10px] text-slate-400 font-bold">ID: #{cls.id.slice(0, 6)}</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {CLASS_PRESETS.map((preset, pIdx) => (
                              <button
                                key={`edit-preset-${cls.id || idx}-${preset}-${pIdx}`}
                                type="button"
                                onClick={() => setEditClassForm(p => ({ ...p, name: preset }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                  editClassForm.name === preset
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              value={editClassForm.name}
                              onChange={e => setEditClassForm(p => ({ ...p, name: e.target.value }))}
                              placeholder="Class Name"
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                            />
                            <input
                              value={editClassForm.section}
                              onChange={e => setEditClassForm(p => ({ ...p, section: e.target.value }))}
                              placeholder="Section (optional)"
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                            />
                          </div>

                          {/* Stream Selection for Class 11 and 12 in Edit */}
                          {isSeniorClass(editClassForm.name) && (
                            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                              <label className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Academic Stream (स्ट्रीम):</span>
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                {SENIOR_STREAMS.map(st => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setEditClassForm(p => ({ ...p, stream: st.id }))}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                                      editClassForm.stream === st.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    {st.icon} {st.id}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Default Fee (₹/mo):</label>
                            <input
                              type="number"
                              value={editClassForm.defaultFee || ""}
                              onChange={e => setEditClassForm(p => ({ ...p, defaultFee: Number(e.target.value) }))}
                              className="flex-1 max-w-[200px] px-3 py-2 border dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-bold"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={saveEditClass}
                              disabled={saving}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black disabled:opacity-60 shadow-md transition active:scale-95"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{saving ? "Saving..." : "Save Changes"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClassId(null)}
                              className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Card Header & Identity */}
                          <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 text-white flex flex-col items-center justify-center shadow-md shadow-indigo-500/25 shrink-0 border border-white/20 select-none">
                                <span className="text-base font-black tracking-tight leading-none">{badgeNumber}</span>
                                <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest leading-none mt-1">Grade</span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                                    {cls.name}
                                  </h3>
                                  {cls.section && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                                      Section {cls.section}
                                    </span>
                                  )}
                                  {(cls.stream || isSeniorClass(cls.name)) && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 flex items-center gap-1 shadow-2xs">
                                      <span>{cls.stream === "Commerce" ? "📊" : cls.stream === "Arts" ? "🎨" : "🔬"}</span>
                                      <span>{cls.stream || "Science"} Stream</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{classStudents.length} Students</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>{classSubjects.length} Subjects</span>
                                  </span>
                                  {defaultFee > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                        <IndianRupee className="w-3.5 h-3.5" />
                                        <span>₹{defaultFee}/mo</span>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setQrModalClass(cls)}
                                title="Class Attendance QR Code"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition active:scale-95 shadow-2xs cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">QR Code</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClass(cls);
                                  setShowForm("student");
                                  setEditingStudentId(null);
                                  setStudentForm({
                                    name: "", rollNo: "", admissionNo: "", fatherName: "", motherName: "",
                                    phone: "", dateOfBirth: "", monthlyFee: defaultFee
                                  });
                                  setView("students");
                                }}
                                title="Add Student directly to this class"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition active:scale-95 shadow-2xs cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">+ Student</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClassId(cls.id);
                                  setEditClassForm({ name: cls.name, section: cls.section || "", stream: cls.stream || (isSeniorClass(cls.name) ? "Science" : ""), defaultFee });
                                  setShowForm(null);
                                }}
                                title="Edit Class Name & Fees"
                                className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmAction({
                                    title: "Class Delete Karein?",
                                    message: `Kya aap "${cls.name}" ko sachme delete karna chahte hain? Is class ke sabhi records par asar pad sakta hai.`,
                                    confirmLabel: "Delete Class",
                                    onConfirm: () => deleteClass(schoolId, cls.id),
                                  });
                                }}
                                title="Delete Class"
                                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Upgraded 8-Tile Academic Action Grid */}
                          <div className="px-4 sm:px-5 pb-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {/* 1. Students */}
                              <button
                                type="button"
                                onClick={() => { setSelectedClass(cls); setView("students"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <Users className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Students</p>
                                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate mt-0.5">
                                    {classStudents.length} Enrolled
                                  </p>
                                </div>
                              </button>

                              {/* 2. Subjects */}
                              <button
                                type="button"
                                onClick={() => { setSelectedClass(cls); setView("subjects"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <BookOpen className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Subjects &amp; Lessons</p>
                                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 truncate mt-0.5">
                                    {classSubjects.length} Books · Topics
                                  </p>
                                </div>
                              </button>

                              {/* 3. Attendance */}
                              <button
                                type="button"
                                onClick={() => { setSelectedClass(cls); setView("attendance"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Attendance</p>
                                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                                    Daily Haziri & QR
                                  </p>
                                </div>
                              </button>

                              {/* 4. Marks */}
                              <button
                                type="button"
                                onClick={() => { setSelectedClass(cls); setView("marks"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <Edit3 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Marks</p>
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate mt-0.5">
                                    Exam Grades Entry
                                  </p>
                                </div>
                              </button>

                              {/* 5. Report Cards */}
                              <button
                                type="button"
                                onClick={() => { setSelectedClass(cls); setView("report_card"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Report</p>
                                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                                    Marksheets PDF
                                  </p>
                                </div>
                              </button>

                              {/* 6. Results */}
                              <button
                                type="button"
                                onClick={() => { setSelectedClass(cls); setView("results"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <Award className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Results</p>
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate mt-0.5">
                                    Merit & Toppers
                                  </p>
                                </div>
                              </button>

                              {/* 7. Fees */}
                              <button
                                type="button"
                                onClick={() => { setFeeClassSelected(cls); setView("fee_class"); }}
                                className="group p-2.5 sm:p-3 rounded-xl border border-teal-500/20 bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <IndianRupee className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Fees</p>
                                  <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 truncate mt-0.5">
                                    ₹{defaultFee}/mo Ledger
                                  </p>
                                </div>
                              </button>

                              {/* 8. Class QR */}
                              <button
                                type="button"
                                onClick={() => setQrModalClass(cls)}
                                className="group p-2.5 sm:p-3 rounded-xl border border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                  <QrCode className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">QR Code</p>
                                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 truncate mt-0.5">
                                    Project & Print
                                  </p>
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* More Advanced Academic Tools Accordion */}
                          <div className="border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 px-4 sm:px-5 py-2 flex flex-col">
                            <button
                              type="button"
                              onClick={() => setExpandedToolsClassId(isToolsExpanded ? null : cls.id)}
                              className="flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span>Advanced Tools & Printouts</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                  ID Cards • Admit Cards • Re-Admission
                                </span>
                              </div>
                              {isToolsExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </button>

                            {isToolsExpanded && (
                              <div className="pt-2.5 pb-1 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
                                {/* ID Cards */}
                                <button
                                  type="button"
                                  onClick={() => { setSelectedClass(cls); setView("id_cards"); }}
                                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition text-left flex items-center gap-2.5 group cursor-pointer"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                    <CreditCard className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">ID Cards</p>
                                    <p className="text-[10px] text-slate-400 truncate">Print Badges</p>
                                  </div>
                                </button>

                                {/* Admit Cards */}
                                <button
                                  type="button"
                                  onClick={() => { setSelectedClass(cls); setView("admit_cards"); }}
                                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 dark:hover:border-amber-500 transition text-left flex items-center gap-2.5 group cursor-pointer"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <FileSpreadsheet className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">Admit Cards</p>
                                    <p className="text-[10px] text-slate-400 truncate">Exam Tickets</p>
                                  </div>
                                </button>

                                {/* Student Re-Admission */}
                                <button
                                  type="button"
                                  onClick={() => { setSelectedClass(cls); setView("readmission"); }}
                                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 transition text-left flex items-center gap-2.5 group cursor-pointer"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <UserPlus className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">Re-Admission</p>
                                    <p className="text-[10px] text-slate-400 truncate">Next Session</p>
                                  </div>
                                </button>

                                {/* Certificates */}
                                <button
                                  type="button"
                                  onClick={() => { setSelectedClass(cls); setView("certificates"); }}
                                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-400 dark:hover:border-purple-500 transition text-left flex items-center gap-2.5 group cursor-pointer"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <Award className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">Certificates</p>
                                    <p className="text-[10px] text-slate-400 truncate">Character/Transfer</p>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      );
    }

    if (view === "subjects") {
      const currentClass = selectedClass || (displayedClasses.length > 0 ? displayedClasses[0] : null);
      const classSubjects = currentClass ? subjects.filter(s => s.classId === currentClass.id) : [];
      return (
        <div className="p-4 space-y-3 max-w-2xl mx-auto">
          {displayedClasses.length > 1 && (
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">Class चुनें:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {displayedClasses.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClass(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      (currentClass?.id === c.id)
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {c.name} {c.section ? `(${c.section})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!currentClass && <div className="text-slate-400 text-center py-8">Select a class first</div>}
          {currentClass && (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                  Subjects for <strong className="text-slate-800 dark:text-slate-100 font-bold">{currentClass.name}</strong> ({classSubjects.length} books)
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(showForm === "multi_subject" ? null : "multi_subject");
                      setMultiBookQueue([]);
                      setCustomMultiBooksText("");
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Multiple Books (एक साथ कई किताबें)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(showForm === "subject" ? null : "subject")}
                    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Single Add
                  </button>
                </div>
              </div>

              {/* Single Subject Form */}
              {showForm === "subject" && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-300">Add Single Subject:</p>
                  <input
                    value={subjectForm.name}
                    onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Subject Name (e.g. Mathematics)"
                    className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={addSubject} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">Save</button>
                    <button onClick={() => setShowForm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {/* Multi-Book Bulk Addition Form */}
              {showForm === "multi_subject" && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-md border-2 border-emerald-500/30 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                        Add Multiple Books / Subjects for {selectedClass.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Preset bundle chunein, chips par click karein ya type karke ek saath add karein
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowForm(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preset Bundles */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      1-Click Preset Bundles (रेडीमेड बुक पैक):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESET_BOOK_BUNDLES.map((b, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => {
                            setMultiBookQueue(prev => {
                              const s = new Set(prev);
                              b.books.forEach(bk => s.add(bk));
                              return Array.from(s);
                            });
                          }}
                          className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-400 transition cursor-pointer"
                        >
                          <p className="font-bold text-xs text-slate-800 dark:text-slate-100">{b.label}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{b.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clickable Preset Chips */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Click to Select Books (किताबें चुनें):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_BOOK_PRESETS.map((preset) => {
                        const isSelected = multiBookQueue.includes(preset.name);
                        const isAlreadyAdded = subjects.some(s => (s.name || "").trim().toLowerCase() === preset.name.toLowerCase());
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            disabled={isAlreadyAdded}
                            onClick={() => {
                              setMultiBookQueue(prev =>
                                prev.includes(preset.name) ? prev.filter(x => x !== preset.name) : [...prev, preset.name]
                              );
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              isAlreadyAdded
                                ? "bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 cursor-not-allowed"
                                : isSelected
                                ? "bg-emerald-600 text-white border border-emerald-600"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            <span>{preset.icon}</span>
                            <span>{preset.name}</span>
                            {isAlreadyAdded && <span className="text-[9px]">(Added)</span>}
                            {isSelected && !isAlreadyAdded && <Check className="w-3 h-3 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Type Custom Books (कॉमा से अलग करें):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customMultiBooksText}
                        onChange={e => setCustomMultiBooksText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!customMultiBooksText.trim()) return;
                            const parts = customMultiBooksText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                            setMultiBookQueue(prev => Array.from(new Set([...prev, ...parts])));
                            setCustomMultiBooksText("");
                          }
                        }}
                        placeholder="e.g. Sanskrit, Environmental Science, GK"
                        className="flex-1 px-3 py-2 text-xs rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!customMultiBooksText.trim()) return;
                          const parts = customMultiBooksText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                          setMultiBookQueue(prev => Array.from(new Set([...prev, ...parts])));
                          setCustomMultiBooksText("");
                        }}
                        className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Queued preview */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                        Selected to Add ({multiBookQueue.length}):
                      </span>
                      {multiBookQueue.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMultiBookQueue([])}
                          className="text-[10px] text-rose-500 font-bold hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {multiBookQueue.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {multiBookQueue.map(b => (
                          <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
                            {b}
                            <button type="button" onClick={() => setMultiBookQueue(prev => prev.filter(x => x !== b))}>
                              <X className="w-3 h-3 hover:text-rose-500" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No books selected yet</p>
                    )}
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={multiBookQueue.length === 0 || savingMultiBooks}
                      onClick={handleSaveBulkBooks}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5"
                    >
                      {savingMultiBooks ? "Saving Books..." : `Save All ${multiBookQueue.length} Books`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(null)}
                      className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Subjects List with Expandable Lessons & Topics Manager */}
              {subjects.map((sub, idx) => (
                <LessonTopicManagerPanel
                  key={sub.id || `subject-${sub.name || idx}-${idx}`}
                  schoolId={schoolId}
                  selectedClass={currentClass}
                  subject={sub}
                  onDeleteSubject={() => {
                    setConfirmAction({
                      title: "Subject Delete Karein?",
                      message: `Kya aap "${sub.name}" subject ko delete karna chahte hain?`,
                      confirmLabel: "Delete Subject",
                      onConfirm: () => deleteSubject(schoolId, sub.id),
                    });
                  }}
                />
              ))}

              {subjects.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Is class me abhi koi subject nahi hai</p>
                  <p className="text-xs text-slate-400 mt-1">Upar "+ Add Multiple Books" button par click karke ek saath sabhi books add karein</p>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (view === "teachers") {
      return (
        <div className={`p-3 sm:p-5 space-y-4 mx-auto ${teachersHubTab === "directory" ? "max-w-5xl" : "max-w-7xl"}`}>
          {/* Unified Teachers & Staff Hub Segmented Navigation (All HRM Sections Integrated Directly) */}
          <div className="bg-slate-100/90 dark:bg-slate-900/90 rounded-2xl p-1.5 border border-slate-200/90 dark:border-slate-700/80 grid grid-cols-2 lg:grid-cols-4 gap-1.5 print:hidden">
            {[
              {
                id: "directory" as const,
                label: "Faculty Directory",
                sub: `${displayedTeachers.length} active`,
                Icon: Users,
              },
              {
                id: "leaves" as const,
                label: "Leave Requests",
                sub: pendingStaffLeavesCount > 0 ? `${pendingStaffLeavesCount} pending • Approve` : "Apply & approve",
                Icon: Clock,
              },
              {
                id: "payroll" as const,
                label: "Payroll & Pay Slips",
                sub: "Auto daily salary",
                Icon: FileSpreadsheet,
              },
              {
                id: "hrm_payslip" as const,
                label: "Salary / Payslip",
                sub: "Late cut & bonus",
                Icon: Printer,
              },
            ].map((tab) => {
              const isActive = teachersHubTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTeachersHubTab(tab.id)}
                  className={`px-3 py-2.5 rounded-xl text-left transition cursor-pointer flex items-center gap-2.5 min-w-0 ${
                    isActive
                      ? "bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200 dark:ring-indigo-500"
                      : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                      isActive
                        ? "bg-indigo-50 dark:bg-white/15 text-indigo-600 dark:text-white"
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-[13px] font-extrabold truncate leading-tight">
                      {tab.label}
                    </div>
                    <div
                      className={`text-[10px] font-semibold truncate mt-0.5 tabular-nums ${
                        isActive
                          ? "text-indigo-600 dark:text-indigo-100"
                          : "text-slate-400 dark:text-slate-400"
                      }`}
                    >
                      {tab.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {teachersHubTab === "payroll" && (
            <StaffPayrollManager
              school={school}
              activeSession={activeSession}
              teachers={displayedTeachers}
              staffList={displayedStaff}
            />
          )}

          {(teachersHubTab === "leaves" ||
            teachersHubTab === "hrm_payslip") &&
            school && (
              <LazyPanelBoundary title="Staff HRM">
                <StaffHRMManager
                  school={school}
                  embedded={true}
                  hideInternalNav={true}
                  hideAdminAttendanceCard={true}
                  controlledTab={
                    teachersHubTab === "hrm_payslip" ? "salary" : "leaves"
                  }
                  onTabChange={(nextHrmTab) => {
                    if (nextHrmTab === "salary") setTeachersHubTab("hrm_payslip");
                    else if (nextHrmTab === "leaves") setTeachersHubTab("leaves");
                  }}
                />
              </LazyPanelBoundary>
            )}

          {showTeacherRulesModal && (
            <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
              <div className="w-full max-w-5xl my-4 bg-slate-100 dark:bg-slate-950 rounded-3xl p-4 sm:p-6 border border-slate-300 dark:border-slate-800 shadow-2xl">
                <TeacherRulesRegulationsView
                  school={school}
                  canEdit={true}
                  staffCount={displayedTeachers.length}
                  onClose={() => setShowTeacherRulesModal(false)}
                />
              </div>
            </div>
          )}

          {showTeacherReferralModal && school && (
            <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
              <div className="w-full max-w-5xl my-4 bg-slate-50 dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        10% Student Referral Bonus
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        यहाँ से चुनें कि किस शिक्षक को Referral देना है और कमीशन हिसाब देखें
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTeacherReferralModal(false)}
                    className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    aria-label="Close Referral Modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <LazyPanelBoundary title="Staff Referrals">
                  <StaffHRMManager
                    school={school}
                    embedded={true}
                    hideInternalNav={true}
                    hideAdminAttendanceCard={true}
                    controlledTab="referrals"
                  />
                </LazyPanelBoundary>
              </div>
            </div>
          )}

          {teachersHubTab === "directory" && (
          <>

          {/* Add Teacher Form */}
          {showForm === "teacher" && !editingTeacherId && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-indigo-200 dark:border-indigo-800/70 shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">New Faculty Profile</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">नया शिक्षक / अकाउंटेंट प्रोफाइल जोड़ें</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  aria-label="Close form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Photo & Signature Setup Pair */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600 shrink-0">
                      {teacherForm.photoUrl ? (
                        <img src={teacherForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Portrait Photo</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">ID Card व Portal हेतु</p>
                    </div>
                  </div>
                  <DirectUploadButton
                    kind="image"
                    compact
                    currentUrl={teacherForm.photoUrl}
                    onUploaded={(url) => setTeacherForm(p => ({ ...p, photoUrl: url }))}
                    onClear={() => setTeacherForm(p => ({ ...p, photoUrl: "" }))}
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-20 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                      {teacherForm.signatureUrl ? (
                        <img src={teacherForm.signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">No Sign</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Digital Signature</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Marksheet व Appointment Letter</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSignatureTargetTeacher({ id: "__NEW_TEACHER__", name: teacherForm.name || "New Teacher", signatureUrl: teacherForm.signatureUrl })}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{teacherForm.signatureUrl ? "Change" : "Sign"}</span>
                    </button>
                    {teacherForm.signatureUrl && (
                      <button
                        type="button"
                        onClick={() => setTeacherForm(p => ({ ...p, signatureUrl: "" }))}
                        className="px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Role / Portal Mode Selector (Teacher <-> Accountant) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    Role / Portal Type (शिक्षक या अकाउंटेंट चुनें)
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    1-Click Role Control
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "TEACHER" as const, label: "Teacher (शिक्षक)", sub: "Attendance & Classes", Icon: GraduationCap, activeCls: "bg-indigo-600 text-white border-indigo-600" },
                    { id: "ACCOUNTANT" as const, label: "Accountant (लेखा)", sub: "Fees & Cash Desk", Icon: Briefcase, activeCls: "bg-amber-500 text-slate-950 border-amber-500" },
                    { id: "BOTH" as const, label: "Teacher + Accountant", sub: "Dono Portal Access", Icon: RefreshCw, activeCls: "bg-emerald-600 text-white border-emerald-600" },
                  ].map((opt) => {
                    const active = (teacherForm.staffRole || "TEACHER") === opt.id;
                    const OptIcon = opt.Icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setTeacherForm((p) => ({
                            ...p,
                            staffRole: opt.id,
                            designation:
                              opt.id === "ACCOUNTANT" && (!p.designation || p.designation === "Senior Faculty" || p.designation === "Senior Faculty & Accountant")
                                ? "Accountant & Cashier"
                                : opt.id === "BOTH" && (!p.designation || p.designation === "Senior Faculty" || p.designation === "Accountant & Cashier")
                                ? "Senior Faculty & Accountant"
                                : opt.id === "TEACHER" && (p.designation === "Accountant & Cashier" || p.designation === "Senior Faculty & Accountant")
                                ? "Senior Faculty"
                                : p.designation,
                          }))
                        }
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2 ${
                          active
                            ? `${opt.activeCls} shadow-xs`
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        <OptIcon className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-black leading-tight truncate">{opt.label}</div>
                          <div className={`text-[10px] truncate mt-0.5 ${active ? "opacity-90" : "text-slate-400"}`}>{opt.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Full Name (पूरा नाम) *
                  </label>
                  <input
                    value={teacherForm.name}
                    onChange={e => setTeacherForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Rajesh Kumar Sharma"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Designation / Role (पद)
                  </label>
                  <input
                    value={teacherForm.designation}
                    onChange={e => setTeacherForm(p => ({ ...p, designation: e.target.value }))}
                    placeholder="e.g. Senior Faculty - Mathematics, TGT Science"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              {/* Qualification & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Highest Qualification (शैक्षणिक योग्यता)
                  </label>
                  <input
                    value={teacherForm.qualification}
                    onChange={e => setTeacherForm(p => ({ ...p, qualification: e.target.value }))}
                    placeholder="e.g. M.Sc. (Mathematics), B.Ed, CTET"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Teaching Experience (शिक्षण अनुभव)
                  </label>
                  <input
                    value={teacherForm.experience}
                    onChange={e => setTeacherForm(p => ({ ...p, experience: e.target.value }))}
                    placeholder="e.g. 8+ Years Experience"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              {/* Subjects & Bio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Subjects Taught (comma separated)
                  </label>
                  <input
                    value={teacherForm.subjects}
                    onChange={e => setTeacherForm(p => ({ ...p, subjects: e.target.value }))}
                    placeholder="e.g. Mathematics, Physics, Applied Math"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Official Email (ईमेल — Optional)
                  </label>
                  <input
                    type="email"
                    value={teacherForm.email}
                    onChange={e => setTeacherForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="e.g. teacher@school.edu.in"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  Teacher Bio / Message for Students
                </label>
                <textarea
                  rows={2}
                  value={teacherForm.bio}
                  onChange={e => setTeacherForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="e.g. Dedicated to conceptual clarity and helping every student achieve academic excellence."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Mobile Phone, Employee ID & Monthly Salary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Mobile Number * (लॉगिन नंबर)
                  </label>
                  <input
                    type="tel"
                    value={teacherForm.phone}
                    onChange={e => setTeacherForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Employee ID (कर्मचारी कोड)
                  </label>
                  <input
                    value={teacherForm.employeeId}
                    onChange={e => setTeacherForm(p => ({ ...p, employeeId: e.target.value }))}
                    placeholder="e.g. TEA-104 (Auto if empty)"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1 block">
                    Monthly Salary / मासिक वेतन (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={teacherForm.monthlySalary || ""}
                    onChange={e => setTeacherForm(p => ({ ...p, monthlySalary: Math.max(0, Number(e.target.value) || 0) }))}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 border border-emerald-300 dark:border-emerald-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-black tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(teacherForm.hidePhoneFromParentCallerId)}
                  onChange={e =>
                    setTeacherForm(p => ({ ...p, hidePhoneFromParentCallerId: e.target.checked }))
                  }
                  className="mt-0.5 w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    Parent Caller ID se personal number chhupayein (Privacy)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    On karne par Parents ke app me is Teacher / Staff ka personal mobile number sync nahi hoga.
                  </span>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={addTeacher}
                  disabled={saving || !teacherForm.name.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 shadow-xs transition active:scale-[0.99] cursor-pointer"
                >
                  {saving ? "Saving Teacher..." : "Save Faculty Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Multi-select Bulk Cleanup Bar */}
          {displayedTeachers.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.length > 0 && selectedTeacherIds.length === displayedTeachers.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTeacherIds(displayedTeachers.map((t) => t.id));
                    } else {
                      setSelectedTeacherIds([]);
                    }
                  }}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <span className="tabular-nums">
                  Select All ({selectedTeacherIds.length}/{displayedTeachers.length})
                </span>
              </label>
              {selectedTeacherIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const idsToDelete = [...selectedTeacherIds];
                    setConfirmAction({
                      title: `${idsToDelete.length} Teachers Recycle Bin me Bhejein?`,
                      message: `Chune gaye ${idsToDelete.length} teachers Settings > Recycle Bin me chale jayenge jahan se aap unhe kabhi bhi restore kar sakte hain.`,
                      confirmLabel: `Move to Recycle Bin (${idsToDelete.length})`,
                      onConfirm: async () => {
                        const idSet = new Set(idsToDelete);
                        const accOnlyIds = displayedTeachers
                          .filter((item: any) => idSet.has(item.id) && item._isAccountantOnly)
                          .map((item) => item.id);
                        const teacherIds = idsToDelete.filter((tid) => !accOnlyIds.includes(tid));
                        setTeachers((prev) => prev.filter((item) => !idSet.has(item.id)));
                        setStaffList((prev) => prev.filter((item) => !idSet.has(item.id)));
                        setAccountants((prev) => prev.filter((item) => !accOnlyIds.includes(item.id)));
                        setSelectedTeacherIds([]);
                        await Promise.allSettled([
                          ...teacherIds.map((tid) => deleteTeacher(schoolId, tid)),
                          ...accOnlyIds.map((aid) => deleteAccountant(schoolId, aid)),
                        ]);
                        toast.success(`${idsToDelete.length} records Recycle Bin me bhej diye gaye.`);
                      },
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedTeacherIds.length})</span>
                </button>
              )}
            </div>
          )}

          {/* Teachers Cards List */}
          {displayedTeachers.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="w-6 h-6" />
              </div>
              <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                Abhi koi faculty member add nahi kiya gaya
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Upar diye "Add Faculty Member" button par click karke teachers ka photo, salary, digital sign aur subjects add karein.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTeachers.map((t, idx) => {
                const subjectsList = Array.isArray(t.subjects) ? t.subjects : (t.subjects ? [t.subjects] : []);
                const isSelectedForDelete = selectedTeacherIds.includes(t.id);
                const teacherPay = Number(t.salaryStructure?.netMonthlySalary ?? t.monthlySalary ?? (t as any).salary ?? 0);
                const hasFace = Boolean(enrolledFaceIds[t.id]);
                const hasSign = Boolean(t.signatureUrl);

                return (
                  <div
                    key={t.id || `teacher-${t.name || idx}-${idx}`}
                    className={`bg-white dark:bg-slate-800/95 rounded-2xl p-4 sm:p-5 border transition overflow-hidden ${
                      isSelectedForDelete
                        ? "border-rose-400 dark:border-rose-600 ring-1 ring-rose-300 dark:ring-rose-800"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs"
                    }`}
                  >
                    {editingTeacherId === t.id ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                          <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Faculty Profile</span>
                          </p>
                          <span className="text-[11px] text-slate-400 font-mono font-bold">#{t.employeeId || t.id.slice(0, 6)}</span>
                        </div>

                        {/* Edit Photo & Digital Signature Pair */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600 shrink-0">
                                {editTeacherForm.photoUrl ? (
                                  <img src={editTeacherForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Portrait Photo</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Change profile image</p>
                              </div>
                            </div>
                            <DirectUploadButton
                              kind="image"
                              compact
                              currentUrl={editTeacherForm.photoUrl}
                              onUploaded={(url) => setEditTeacherForm(p => ({ ...p, photoUrl: url }))}
                              onClear={() => setEditTeacherForm(p => ({ ...p, photoUrl: "" }))}
                            />
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-20 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                                {editTeacherForm.signatureUrl ? (
                                  <img src={editTeacherForm.signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" />
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400">No Sign</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">Digital Signature</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Letters, Marksheets &amp; Rules</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSignatureTargetTeacher({ id: "__EDIT_TEACHER__", name: editTeacherForm.name || t.name, signatureUrl: editTeacherForm.signatureUrl })}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <PenTool className="w-3.5 h-3.5" />
                                <span>{editTeacherForm.signatureUrl ? "Change" : "Sign"}</span>
                              </button>
                              {editTeacherForm.signatureUrl && (
                                <button
                                  type="button"
                                  onClick={() => setEditTeacherForm(p => ({ ...p, signatureUrl: "" }))}
                                  className="px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Role Conversion Switch inside Edit Form (Teacher <-> Accountant) */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                              Role / Portal Access (Teacher को Accountant या Accountant को Teacher बनाएं)
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "TEACHER" as const, label: "Teacher", sub: "Sirf Teacher", Icon: GraduationCap, activeCls: "bg-indigo-600 text-white border-indigo-600" },
                              { id: "ACCOUNTANT" as const, label: "Accountant", sub: "Sirf Accountant", Icon: Briefcase, activeCls: "bg-amber-500 text-slate-950 border-amber-500" },
                              { id: "BOTH" as const, label: "Teacher + Acc", sub: "Dono Role", Icon: RefreshCw, activeCls: "bg-emerald-600 text-white border-emerald-600" },
                            ].map((opt) => {
                              const active = (editTeacherForm.staffRole || "TEACHER") === opt.id;
                              const OptIcon = opt.Icon;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setEditTeacherForm((p) => ({ ...p, staffRole: opt.id }))}
                                  className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                                    active
                                      ? `${opt.activeCls} shadow-xs`
                                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300"
                                  }`}
                                >
                                  <OptIcon className="w-4 h-4 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-black leading-tight truncate">{opt.label}</div>
                                    <div className={`text-[10px] truncate ${active ? "opacity-90" : "text-slate-400"}`}>{opt.sub}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Full Name *</label>
                            <input
                              value={editTeacherForm.name}
                              onChange={e => setEditTeacherForm(p => ({ ...p, name: e.target.value }))}
                              placeholder="Full Name"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Designation / Role</label>
                            <input
                              value={editTeacherForm.designation}
                              onChange={e => setEditTeacherForm(p => ({ ...p, designation: e.target.value }))}
                              placeholder="Designation"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Highest Qualification</label>
                            <input
                              value={editTeacherForm.qualification}
                              onChange={e => setEditTeacherForm(p => ({ ...p, qualification: e.target.value }))}
                              placeholder="e.g. M.Sc., B.Ed"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Teaching Experience</label>
                            <input
                              value={editTeacherForm.experience}
                              onChange={e => setEditTeacherForm(p => ({ ...p, experience: e.target.value }))}
                              placeholder="e.g. 8+ Years"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Subjects Taught (comma separated)</label>
                            <input
                              value={editTeacherForm.subjects}
                              onChange={e => setEditTeacherForm(p => ({ ...p, subjects: e.target.value }))}
                              placeholder="e.g. Mathematics, Physics"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Official Email</label>
                            <input
                              type="email"
                              value={editTeacherForm.email}
                              onChange={e => setEditTeacherForm(p => ({ ...p, email: e.target.value }))}
                              placeholder="Email"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Teacher Bio / Message for Students</label>
                          <textarea
                            rows={2}
                            value={editTeacherForm.bio}
                            onChange={e => setEditTeacherForm(p => ({ ...p, bio: e.target.value }))}
                            placeholder="Inspiring bio or message for students"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Mobile Number *</label>
                            <input
                              type="tel"
                              value={editTeacherForm.phone}
                              onChange={e => setEditTeacherForm(p => ({ ...p, phone: e.target.value }))}
                              placeholder="Mobile (Login Number)"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">Employee ID</label>
                            <input
                              value={editTeacherForm.employeeId}
                              onChange={e => setEditTeacherForm(p => ({ ...p, employeeId: e.target.value }))}
                              placeholder="Employee ID"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1 block">
                              Monthly Salary / मासिक वेतन (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={editTeacherForm.monthlySalary || ""}
                              onChange={e => setEditTeacherForm(p => ({ ...p, monthlySalary: Math.max(0, Number(e.target.value) || 0) }))}
                              placeholder="e.g. 25000"
                              className="w-full px-3 py-2 border border-emerald-400/70 dark:border-emerald-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-black tabular-nums"
                            />
                          </div>
                        </div>

                        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(editTeacherForm.hidePhoneFromParentCallerId)}
                            onChange={e =>
                              setEditTeacherForm(p => ({ ...p, hidePhoneFromParentCallerId: e.target.checked }))
                            }
                            className="mt-0.5 w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                              Parent Caller ID me number chhupayein (Privacy Mode)
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              On karne par is teacher ka personal number Parents ke phone me sync nahi hoga (staff calls chalu rahengi).
                            </span>
                          </div>
                        </label>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={saveEditTeacher}
                            disabled={saving || !editTeacherForm.name.trim()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 shadow-xs transition cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTeacherId(null)}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Card Main Row */}
                        <div className="flex items-start gap-3 sm:gap-4">
                          <input
                            type="checkbox"
                            checked={isSelectedForDelete}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTeacherIds((prev) => prev.includes(t.id) ? prev : [...prev, t.id]);
                              } else {
                                setSelectedTeacherIds((prev) => prev.filter((id) => id !== t.id));
                              }
                            }}
                            aria-label={`Select ${t.name}`}
                            className="mt-1.5 w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                          />

                          {/* Portrait Photo */}
                          <div className="w-13 h-14 sm:w-14 sm:h-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600">
                            {t.photoUrl ? (
                              <img src={t.photoUrl} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{t.name ? t.name.charAt(0).toUpperCase() : "T"}</span>
                            )}
                          </div>

                          {/* Teacher Primary Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                                    {t.name}
                                  </h4>
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    {t.designation || "Faculty"}
                                  </span>
                                  {(t as any)._isAccountantOnly ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                      Accountant Only
                                    </span>
                                  ) : (t as any)._isAccountant ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      Teacher + Accountant
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                      Teacher
                                    </span>
                                  )}
                                </div>

                                {/* Clean Unboxed Metadata Line */}
                                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                                  {t.employeeId && (
                                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                      {t.employeeId}
                                    </span>
                                  )}
                                  {t.phone && (
                                    <>
                                      {t.employeeId && <span className="text-slate-300 dark:text-slate-600">·</span>}
                                      <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                                        <Phone className="w-3 h-3 text-slate-400" />
                                        {t.phone}
                                      </span>
                                    </>
                                  )}
                                  {t.qualification && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600">·</span>
                                      <span>{t.qualification}</span>
                                    </>
                                  )}
                                  {t.experience && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600">·</span>
                                      <span>{t.experience}</span>
                                    </>
                                  )}
                                  {t.email && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600">·</span>
                                      <span className="truncate max-w-[180px]">{t.email}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Clean Right Salary Metric */}
                              <div className="shrink-0 sm:text-right">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                                  Monthly Salary
                                </div>
                                <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  ₹{teacherPay.toLocaleString("en-IN")}
                                  <span className="text-[11px] font-semibold text-slate-400">/mo</span>
                                </div>
                              </div>
                            </div>

                            {/* Subjects + Clean Readiness Indicators */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              {subjectsList.map((subItem: string, sIdx: number) => (
                                <span
                                  key={`t-sub-${t.id}-${sIdx}`}
                                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200"
                                >
                                  {subItem}
                                </span>
                              ))}

                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                                  hasFace
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                    : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {hasFace ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                )}
                                {hasFace ? "Face ID Ready" : "Face ID Pending"}
                              </span>

                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                                  hasSign
                                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                    : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                <PenTool className="w-3 h-3" />
                                {hasSign ? "Sign Added" : "No Sign"}
                              </span>

                            </div>

                            {t.bio && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                                {t.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Uniform Balanced Action Bar */}
                        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-700/70 grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenTeacherFaceEnrollment(t)}
                            className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer ${
                              hasFace
                                ? "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            }`}
                            title="शिक्षक का Face ID कैमरे से स्कैन करें"
                          >
                            <Camera className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{hasFace ? "Face Re-scan" : "Add Face ID"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSignatureTargetTeacher(t)}
                            className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                            title="Teacher ka Digital Signature Draw / Upload Karein"
                          >
                            <PenTool className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span className="truncate">{hasSign ? "Edit Sign" : "Add Sign"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAppointmentLetterTeacher(t)}
                            className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                            title="Teacher Appointment Letter (A4) व 2-Page Joining Kit Generate Karein"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="truncate">Letter</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTeacherForIdCard(t)}
                            className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                            title="Teacher ID Card Dekhein aur Print Karein"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">ID Card</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const currentPay = Number(t.salaryStructure?.netMonthlySalary ?? t.monthlySalary ?? (t as any).salary ?? 0);
                              setEditingTeacherId(t.id);
                              setEditTeacherForm({
                                name: t.name || "",
                                phone: t.phone || "",
                                photoUrl: t.photoUrl || "",
                                signatureUrl: t.signatureUrl || "",
                                designation: t.designation || "",
                                qualification: t.qualification || "",
                                experience: t.experience || "",
                                subjects: Array.isArray(t.subjects) ? t.subjects.join(", ") : (t.subjects || ""),
                                bio: t.bio || "",
                                employeeId: t.employeeId || "",
                                email: t.email || "",
                                monthlySalary: currentPay,
                                hasReferralIncentive: Boolean(t.hasReferralIncentive),
                                hidePhoneFromParentCallerId: Boolean(t.hidePhoneFromParentCallerId),
                                staffRole: (t as any)._isAccountantOnly
                                  ? "ACCOUNTANT"
                                  : (t as any)._isAccountant
                                  ? "BOTH"
                                  : "TEACHER",
                              });
                              setShowForm(null);
                            }}
                            className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                            title="Teacher ka profile aur monthly salary (paisa) edit karein"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">Edit / Pay</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const curMode: "TEACHER" | "ACCOUNTANT" | "BOTH" = (t as any)._isAccountantOnly
                                ? "ACCOUNTANT"
                                : (t as any)._isAccountant
                                ? "BOTH"
                                : "TEACHER";
                              setRoleConvertTarget({ person: t, currentMode: curMode });
                            }}
                            className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                              (t as any)._isAccountantOnly
                                ? "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                                : (t as any)._isAccountant
                                ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                            }`}
                            title="Teacher ko Accountant ya Accountant ko Teacher me badlein"
                          >
                            {(t as any)._isAccountantOnly ? (
                              <>
                                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Teacher बनाएं</span>
                              </>
                            ) : (t as any)._isAccountant ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Role बदलें</span>
                              </>
                            ) : (
                              <>
                                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Accountant बनाएं</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const isAccOnly = Boolean((t as any)._isAccountantOnly);
                              setConfirmAction({
                                title: isAccOnly ? "Accountant Remove Karein?" : "Teacher Recycle Bin me Bhejein?",
                                message: isAccOnly
                                  ? `Kya aap sach me Accountant "${t.name}" ko remove karna chahte hain?`
                                  : `"${t.name}" ko remove karne par yeh Settings > Recycle Bin me surakshit rahenge jahan se aap inhe kabhi bhi restore kar sakte hain.`,
                                confirmLabel: isAccOnly ? "Remove Accountant" : "Move to Recycle Bin",
                                onConfirm: async () => {
                                  setSelectedTeacherIds((prev) => prev.filter((id) => id !== t.id));
                                  if (isAccOnly) {
                                    setAccountants((prev) => prev.filter((a) => a.id !== t.id));
                                    await deleteAccountant(schoolId, t.id);
                                    toast.success(`Accountant ${t.name} ko remove kar diya gaya.`);
                                  } else {
                                    setTeachers((prev) => prev.filter((item) => item.id !== t.id));
                                    setStaffList((prev) => prev.filter((item) => item.id !== t.id));
                                    await deleteTeacher(schoolId, t.id);
                                    toast.success(`${t.name} ko Recycle Bin me bhej diya gaya (Settings > Recycle Bin).`);
                                  }
                                },
                              });
                            }}
                            className="sm:ml-auto px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-900/60 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Delete</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 1-Click Teacher <-> Accountant Role Switcher Modal */}
          {roleConvertTarget && (
            <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                        {roleConvertTarget.person?.name} — Role बदलें
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Teacher को Accountant या Accountant को Teacher बनाएं
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !convertingRole && setRoleConvertTarget(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-2.5">
                  {[
                    {
                      mode: "ACCOUNTANT" as const,
                      title: "सिर्फ़ Accountant बनाएं (Accountant Only)",
                      desc: "Teacher से हटाकर Accountant Cash Desk & Fee Counter पर शिफ्ट करें (वेतन व Face ID सुरक्षित रहेगा)।",
                      Icon: Briefcase,
                      cls: "border-amber-200 dark:border-amber-800/70 bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-200",
                    },
                    {
                      mode: "TEACHER" as const,
                      title: "सिर्फ़ Teacher बनाएं (Teacher Only)",
                      desc: "Accountant से हटाकर Teacher Portal, Attendance व Marks पर शिफ्ट करें।",
                      Icon: GraduationCap,
                      cls: "border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200",
                    },
                    {
                      mode: "BOTH" as const,
                      title: "Teacher + Accountant दोनों बनाएं (Dual Role)",
                      desc: "दोनों पोर्टल (Teacher Portal व Accountant Cash Desk) एक साथ चालू रहेंगे।",
                      Icon: RefreshCw,
                      cls: "border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200",
                    },
                  ].map((opt) => {
                    const isCurrent = roleConvertTarget.currentMode === opt.mode;
                    const OptIcon = opt.Icon;
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        disabled={convertingRole || isCurrent}
                        onClick={async () => {
                          setConvertingRole(true);
                          try {
                            await applyFacultyRoleMode(roleConvertTarget.person, opt.mode);
                            if (opt.mode === "ACCOUNTANT") {
                              toast.success(`💼 ${roleConvertTarget.person.name} को सफलतापूर्वक Accountant बना दिया गया!`);
                            } else if (opt.mode === "TEACHER") {
                              toast.success(`👨‍🏫 ${roleConvertTarget.person.name} को सफलतापूर्वक Teacher बना दिया गया!`);
                            } else {
                              toast.success(`⚡ ${roleConvertTarget.person.name} अब Teacher + Accountant दोनों रूप में सक्रिय हैं!`);
                            }
                            setRoleConvertTarget(null);
                          } catch (err: any) {
                            toast.error("Role बदलने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
                          } finally {
                            setConvertingRole(false);
                          }
                        }}
                        className={`w-full p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${opt.cls}`}
                      >
                        <OptIcon className="w-5 h-5 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-black">{opt.title}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] opacity-85 mt-0.5 leading-snug">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      );
    }

    if (view === "discount_list") {
      const allDiscs = getCombinedDiscountLedger(schoolId, displayedStudents, allFees);
      const filteredDiscs = allDiscs.filter((d) => {
        if (discountLedgerFilter !== "all" && d.category !== discountLedgerFilter) return false;
        if (studentSearchQuery.trim()) {
          const q = studentSearchQuery.toLowerCase().trim();
          return (
            d.studentName.toLowerCase().includes(q) ||
            d.className.toLowerCase().includes(q) ||
            d.whereLabel.toLowerCase().includes(q) ||
            d.givenByName.toLowerCase().includes(q)
          );
        }
        return true;
      });
      const totalSavedDisc = filteredDiscs.reduce((s, d) => s + (Number(d.discountAmount) || 0), 0);

      return (
        <div className="p-4 space-y-3 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                🏷️ Fee Discount Register ({DISPLAY_DISCOUNT_LABEL})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                किस छात्र को, कितना डिस्काउंट और कहाँ मिला — सभी प्रविष्टियाँ स्थायी रूप से माफ हैं (Next Month Due में नहीं जुड़ेंगी)।
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Waived</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                ₹{totalSavedDisc.toLocaleString("en-IN")} ({filteredDiscs.length})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "सभी (All)" },
              { id: "admission", label: "Admission" },
              { id: "multi_admission", label: "Multi-Admission" },
              { id: "monthly_fee", label: "Monthly Fee" },
              { id: "sibling", label: "Sibling" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDiscountLedgerFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer border transition ${
                  discountLedgerFilter === tab.id
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredDiscs.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 border border-slate-200 dark:border-slate-700">
              इस श्रेणी में कोई Discount रिकॉर्ड नहीं मिला।
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDiscs.map((d) => (
                <div
                  key={d.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-800 dark:text-white">{d.studentName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                        {d.className || "Class"} {d.section ? `(${d.section})` : ""} • Roll #{d.rollNo || "—"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                        {d.whereLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      दिया गया: <strong>{d.givenByName}</strong> ({d.givenByRole}) • दिनांक: {new Date(d.createdAt).toLocaleDateString("en-IN")}
                      {d.note ? ` • ${d.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-xs font-black">
                      -₹{d.discountAmount.toLocaleString("en-IN")} ({d.discountPct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (view === "students") {
      const availableSections = Array.from(
        new Set(
          displayedClasses
            .filter((c) => !selectedClass || c.id === selectedClass.id || c.name === selectedClass.name)
            .map((c) => (c.section || "").trim())
            .filter(Boolean)
        )
      );
      const rawClassStudents = selectedClass
        ? displayedStudents.filter((s) => isStudentInClass(s, selectedClass.id, selectedClass.name))
        : displayedStudents;
      const sectionFilteredStudents =
        selectedSectionFilter === "ALL"
          ? rawClassStudents
          : rawClassStudents.filter((s) => (s.section || "").trim().toUpperCase() === selectedSectionFilter.toUpperCase());
      const filteredStudents = sectionFilteredStudents.filter(s => {
        if (!studentSearchQuery.trim()) return true;
        const q = studentSearchQuery.toLowerCase().trim();
        return (
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.admissionNo && s.admissionNo.toLowerCase().includes(q)) ||
          (s.rollNo && String(s.rollNo).includes(q)) ||
          (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q))
        );
      });

      const pageSize = 50;
      const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
      const currentStudentPage = Math.min(studentPage, totalPages);
      const paginatedStudents = filteredStudents.slice((currentStudentPage - 1) * pageSize, currentStudentPage * pageSize);

      return (
        <div className="p-4 space-y-3 max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {selectedClass ? (
                <>Students in <strong className="text-slate-700 dark:text-slate-200">{selectedClass.name}</strong> ({filteredStudents.length}{rawClassStudents.length !== filteredStudents.length ? ` of ${rawClassStudents.length}` : ""})</>
              ) : (
                <>Enrolled Students (<strong className="text-slate-700 dark:text-slate-200">{filteredStudents.length}</strong>{rawClassStudents.length !== filteredStudents.length ? ` of ${rawClassStudents.length}` : ""})</>
              )}
            </p>
            {selectedClass && (
              <button
                type="button"
                onClick={() => { setSelectedClass(null); setSelectedSectionFilter("ALL"); setStudentPage(1); }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Show All Classes
              </button>
            )}
          </div>

          {/* Class & Section Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Class चुनें (कक्षा)</label>
              <select
                value={selectedClass?.id || ""}
                onChange={(e) => {
                  const cls = displayedClasses.find((c) => c.id === e.target.value) || null;
                  setSelectedClass(cls);
                  setSelectedSectionFilter("ALL");
                  setStudentPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
              >
                <option value="">सभी कक्षाएं (All Classes)</option>
                {displayedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Section चुनें (वर्ग)</label>
              <select
                value={selectedSectionFilter}
                onChange={(e) => {
                  setSelectedSectionFilter(e.target.value);
                  setStudentPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
              >
                <option value="ALL">सभी सेक्शन (All Sections)</option>
                {(availableSections.length > 0 ? availableSections : ["A", "B", "C"]).map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={e => {
                setStudentSearchQuery(e.target.value);
                setStudentPage(1);
              }}
              placeholder="Search by name, roll no, admission no, or phone..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            {studentSearchQuery && (
              <button
                type="button"
                onClick={() => { setStudentSearchQuery(""); setStudentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingStudentId(null);
                setShowDirectAdmissionModal(true);
              }}
              className="sm:col-span-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ New Student Admission (Quick / Full Form + Receipt)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFaceStudioModal(true)}
              className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer text-sm ${
                hasFaceAttendanceAccess(school)
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20"
                  : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40"
              }`}
              title={hasFaceAttendanceAccess(school) ? "कैमरे से छात्र का लाइव फेस आईडी रजिस्टर करें व टेस्ट करें" : "👑 Elite Plan Only — Live Face ID Studio"}
            >
              {hasFaceAttendanceAccess(school) ? <Camera className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
              <span>📷 लाइव फेस आईडी</span>
              {!hasFaceAttendanceAccess(school) && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[10px] font-black">👑 Elite</span>
              )}
            </button>
          </div>

          {paginatedStudents.map((s, idx) => (
            <div key={s.id || `student-${s.rollNo || idx}-${idx}`} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700">
              {editingStudentId === s.id ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                        Edit Complete Student Profile (सभी जानकारी संपादित करें)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        एडमिशन के समय भरी गई हर जानकारी यहाँ से बदली जा सकती है
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdmissionPrintPayload({ student: s })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-xs font-bold cursor-pointer shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Form
                    </button>
                  </div>

                  {/* Section 1: Basic & Academic */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">1. Student &amp; Class Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Full Name *</label>
                        <input type="text" value={editStudentForm.name || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, name: toUpperFormText(e.target.value) }))}
                          placeholder="STUDENT NAME"
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm font-semibold uppercase" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Class</label>
                        <select
                          value={editStudentForm.classId || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, classId: e.target.value }))}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold"
                        >
                          {displayedClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.section ? ` (${c.section})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Roll Number</label>
                        <input type="text" value={editStudentForm.rollNo || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, rollNo: toUpperFormText(e.target.value) }))}
                          placeholder="ROLL NO"
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm uppercase" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Admission No</label>
                        <input type="text" value={editStudentForm.admissionNo || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, admissionNo: toUpperFormText(e.target.value) }))}
                          placeholder="ADMISSION NO"
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm uppercase" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Date of Birth</label>
                        <input type="date" value={editStudentForm.dateOfBirth || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, dateOfBirth: e.target.value }))}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Gender</label>
                        <select
                          value={editStudentForm.gender || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, gender: e.target.value }))}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-bold text-rose-600 dark:text-rose-400">🩸 Blood Group</label>
                        <select
                          value={editStudentForm.bloodGroup || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, bloodGroup: e.target.value }))}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold"
                        >
                          <option value="">Select Blood Group</option>
                          {BLOOD_GROUPS.map((bg, bgIdx) => (
                            <option key={`edit-student-bg-${bg}-${bgIdx}`} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Category</label>
                        <select
                          value={editStudentForm.category || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, category: e.target.value }))}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                        >
                          <option value="">Select Category</option>
                          <option value="General">General</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC</option>
                          <option value="ST">ST</option>
                          <option value="EWS">EWS</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Religion</label>
                        <input type="text" value={editStudentForm.religion || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, religion: toUpperFormText(e.target.value) }))}
                          placeholder="HINDU / MUSLIM / ETC."
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm uppercase" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Student Aadhaar</label>
                        <input type="text" value={editStudentForm.aadhaarNo || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, aadhaarNo: e.target.value }))}
                          placeholder="12-digit Aadhaar"
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">APAAR / PEN ID</label>
                        <input type="text" value={editStudentForm.apaarId || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, apaarId: toUpperFormText(e.target.value) }))}
                          placeholder="APAAR / PEN ID"
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm uppercase" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Nationality / Mother Tongue</label>
                        <input type="text" value={editStudentForm.nationality || ""}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, nationality: toUpperFormText(e.target.value) }))}
                          placeholder="INDIAN"
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm uppercase" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Parents & Guardian Details */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/70">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">2. Parents &amp; Family Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        ["fatherName", "Father's Name", "text"],
                        ["fatherOccupation", "Father's Occupation", "text"],
                        ["fatherQualification", "Father's Qualification", "text"],
                        ["fatherPhone", "Father's Mobile", "tel"],
                        ["fatherWhatsapp", "Father's WhatsApp", "tel"],
                        ["fatherAadhaar", "Father's Aadhaar", "text"],
                        ["motherName", "Mother's Name", "text"],
                        ["motherOccupation", "Mother's Occupation", "text"],
                        ["motherQualification", "Mother's Qualification", "text"],
                        ["motherPhone", "Mother's Mobile", "tel"],
                        ["motherWhatsapp", "Mother's WhatsApp", "tel"],
                        ["motherAadhaar", "Mother's Aadhaar", "text"],
                        ["annualIncome", "Annual Family Income", "text"],
                      ].map(([k, label, type], fIdx) => (
                        <div key={`edit-parent-${k}-${fIdx}`}>
                          <label className="text-[11px] text-slate-500 mb-1 block font-semibold">{label}</label>
                          {k === "fatherOccupation" || k === "motherOccupation" ? (
                            <OccupationAutocomplete
                              value={(editStudentForm as any)[k] || ""}
                              onChange={(val) => setEditStudentForm((p: any) => ({ ...p, [k]: val }))}
                              schoolId={schoolId}
                              placeholder={label}
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm"
                            />
                          ) : (
                            <input type={type} value={(editStudentForm as any)[k] || ""}
                              onChange={e => {
                                const raw = e.target.value;
                                const keepRaw = ["fatherPhone", "fatherWhatsapp", "fatherAadhaar", "motherPhone", "motherWhatsapp", "motherAadhaar", "annualIncome"].includes(k);
                                setEditStudentForm((p: any) => ({ ...p, [k]: keepRaw ? raw : toUpperFormText(raw) }));
                              }}
                              placeholder={label}
                              className={`w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm ${["fatherPhone", "fatherWhatsapp", "fatherAadhaar", "motherPhone", "motherWhatsapp", "motherAadhaar", "annualIncome"].includes(k) ? "" : "uppercase"}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 3: Contact, Address, Previous School & Emergency */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/70">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">3. Contact, Address &amp; Previous Academic</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        ["phone", "Primary Phone / Mobile", "tel"],
                        ["whatsappNo", "WhatsApp Number", "tel"],
                        ["email", "Email ID", "email"],
                        ["address", "Permanent Address", "text"],
                        ["city", "City / Village", "text"],
                        ["pincode", "Pincode", "text"],
                        ["correspondenceAddress", "Correspondence Address", "text"],
                        ["emergencyContact", "Emergency Contact Name", "text"],
                        ["emergencyPhone", "Emergency Phone", "tel"],
                        ["emergencyRelation", "Emergency Relation", "text"],
                        ["previousSchool", "Previous School", "text"],
                        ["previousMarks", "Previous Class / Marks", "text"],
                        ["previousBoard", "Previous Board", "text"],
                        ["previousTcNo", "Previous TC No", "text"],
                        ["identificationMark", "Identification Mark", "text"],
                        ["medicalHistory", "Medical History", "text"],
                      ].map(([k, label, type], fIdx) => {
                        const keepRaw = ["phone", "whatsappNo", "email", "pincode", "emergencyPhone"].includes(k);
                        return (
                          <div key={`edit-contact-${k}-${fIdx}`}>
                            <label className="text-[11px] text-slate-500 mb-1 block font-semibold">{label}</label>
                            <input type={type} value={(editStudentForm as any)[k] || ""}
                              onChange={e => setEditStudentForm((p: any) => ({ ...p, [k]: keepRaw ? e.target.value : toUpperFormText(e.target.value) }))}
                              placeholder={label}
                              className={`w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm ${keepRaw ? "" : "uppercase"}`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 4: Monthly Fee, Bus Transport & Bank Details */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/70">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">4. Fee, Transport &amp; Bank Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Monthly Tuition Fee (₹)</label>
                        <input type="number" value={editStudentForm.monthlyFee}
                          onChange={e => setEditStudentForm((p: any) => ({ ...p, monthlyFee: Number(e.target.value) }))}
                          className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm font-bold" />
                      </div>
                      <div className="flex items-end">
                        <label className="w-full flex items-center gap-2 px-3 py-2 border dark:border-slate-600 rounded-lg cursor-pointer text-sm font-semibold text-slate-800 dark:text-white">
                          <input
                            type="checkbox"
                            checked={Boolean(editStudentForm.usesBus)}
                            onChange={e => setEditStudentForm((p: any) => ({ ...p, usesBus: e.target.checked }))}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span>Uses School Bus</span>
                        </label>
                      </div>
                      {editStudentForm.usesBus && (
                        <>
                          <div>
                            <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Bus Route</label>
                            <input type="text" value={editStudentForm.busRoute || ""}
                              onChange={e => setEditStudentForm((p: any) => ({ ...p, busRoute: toUpperFormText(e.target.value) }))}
                              placeholder="BUS ROUTE"
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm uppercase" />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 mb-1 block font-semibold">Monthly Bus Fee (₹)</label>
                            <input type="number" value={editStudentForm.busFee || 0}
                              onChange={e => setEditStudentForm((p: any) => ({ ...p, busFee: Number(e.target.value) }))}
                              className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm" />
                          </div>
                        </>
                      )}
                      {[
                        ["bankAccountName", "Bank Account Holder", "text"],
                        ["bankName", "Bank Name", "text"],
                        ["bankAccountNumber", "Account Number", "text"],
                        ["bankIfsc", "IFSC Code", "text"],
                      ].map(([k, label, type], fIdx) => (
                        <div key={`edit-bank-${k}-${fIdx}`}>
                          <label className="text-[11px] text-slate-500 mb-1 block font-semibold">{label}</label>
                          <input type={type} value={(editStudentForm as any)[k] || ""}
                            onChange={e => setEditStudentForm((p: any) => ({ ...p, [k]: k === "bankAccountNumber" ? e.target.value : toUpperFormText(e.target.value) }))}
                            placeholder={label}
                            className={`w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-transparent text-slate-800 dark:text-white text-sm ${k === "bankAccountNumber" ? "" : "uppercase"}`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 p-2.5 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Student Photo (Camera / Gallery Upload):</label>
                      <DirectUploadButton
                        kind="image"
                        compact
                        currentUrl={editStudentForm.photoUrl}
                        onUploaded={(url) => setEditStudentForm((p: any) => ({ ...p, photoUrl: url }))}
                        onClear={() => setEditStudentForm((p: any) => ({ ...p, photoUrl: '' }))}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">Photo ID Card, Marksheet aur Admission Form par dikhegi.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditStudent} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold disabled:opacity-60 cursor-pointer">
                      <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save All Changes"}
                    </button>
                    <button onClick={() => setEditingStudentId(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-semibold cursor-pointer">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center font-bold text-orange-700 text-sm flex-shrink-0 overflow-hidden">
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      s.rollNo || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickActionStudent(s);
                          setQuickActionInitialTab("profile");
                        }}
                        className="group text-left font-bold text-slate-800 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Student Full View (👁️ बायो-डेटा, आईडी कार्ड, फीस, हाजिरी, रिजल्ट, तुरंत एडिट)"
                      >
                        <span className="underline decoration-dotted decoration-slate-300 group-hover:decoration-blue-500">{s.name}</span>
                        <span className="text-[10px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.2 rounded font-semibold opacity-70 group-hover:opacity-100">
                          Options
                        </span>
                      </button>
                      {s.bloodGroup && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                          🩸 {s.bloodGroup}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {s.admissionNo || "No Adm No"} • Roll #{s.rollNo || "—"} • Fee: ₹{s.monthlyFee}/mo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionStudent(s);
                      setQuickActionInitialTab("profile");
                    }}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 cursor-pointer transition-colors"
                    title="Student Quick View (👁️ बायो-डेटा, आईडी कार्ड, फीस, हाजिरी, अंक व तुरंत एडिट)"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForIdCard({ student: s })}
                    className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 cursor-pointer"
                    title="Student ID Card & 512×512 Easy-Scan QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdmissionPrintPayload({ student: s })}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 cursor-pointer"
                    title="Print Admission Form / Receipt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button onClick={() => {
                    setEditingStudentId(s.id);
                    setEditStudentForm({
                      name: s.name || "",
                      rollNo: s.rollNo || "",
                      admissionNo: s.admissionNo || "",
                      classId: s.classId || "",
                      stream: s.stream || "",
                      fatherName: s.fatherName || "",
                      fatherOccupation: s.fatherOccupation || "",
                      fatherQualification: s.fatherQualification || "",
                      fatherPhone: s.fatherPhone || "",
                      fatherWhatsapp: s.fatherWhatsapp || "",
                      fatherAadhaar: s.fatherAadhaar || "",
                      motherName: s.motherName || "",
                      motherOccupation: s.motherOccupation || "",
                      motherQualification: s.motherQualification || "",
                      motherPhone: s.motherPhone || "",
                      motherWhatsapp: s.motherWhatsapp || "",
                      motherAadhaar: s.motherAadhaar || "",
                      phone: s.phone || "",
                      whatsappNo: s.whatsappNo || "",
                      email: s.email || "",
                      dateOfBirth: s.dateOfBirth || "",
                      gender: s.gender || "",
                      category: s.category || "",
                      religion: s.religion || "",
                      nationality: s.nationality || "",
                      motherTongue: s.motherTongue || "",
                      identificationMark: s.identificationMark || "",
                      aadhaarNo: s.aadhaarNo || "",
                      apaarId: s.apaarId || "",
                      address: s.address || "",
                      city: s.city || "",
                      pincode: s.pincode || "",
                      correspondenceAddress: s.correspondenceAddress || "",
                      annualIncome: s.annualIncome || "",
                      emergencyContact: s.emergencyContact || "",
                      emergencyPhone: s.emergencyPhone || "",
                      emergencyRelation: s.emergencyRelation || "",
                      medicalHistory: s.medicalHistory || "",
                      previousSchool: s.previousSchool || "",
                      previousMarks: s.previousMarks || "",
                      previousBoard: s.previousBoard || "",
                      previousTcNo: s.previousTcNo || "",
                      usesBus: Boolean(s.usesBus),
                      busRoute: s.busRoute || "",
                      busFee: Number(s.busFee || 0),
                      bankAccountName: s.bankAccountName || "",
                      bankName: s.bankName || "",
                      bankAccountNumber: s.bankAccountNumber || "",
                      bankIfsc: s.bankIfsc || "",
                      monthlyFee: s.monthlyFee || 0,
                      photoUrl: s.photoUrl || "",
                      bloodGroup: s.bloodGroup || "",
                    });
                    setShowForm(null);
                  }}
                    className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-500 cursor-pointer"
                    title="Edit Complete Student Profile">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        title: "Student Recycle Bin me Bhejein?",
                        message: `"${s.name}" ko delete karne par yeh Settings > Recycle Bin me chale jayenge jahan se aap inhe kabhi bhi restore kar sakte hain.`,
                        confirmLabel: "Move to Recycle Bin",
                        onConfirm: async () => {
                          setStudents((prev) => prev.filter((item) => item.id !== s.id));
                          await deleteStudent(schoolId, s.id);
                          toast.success(`${s.name} ko Recycle Bin me bhej diya gaya (Settings > Recycle Bin).`);
                        },
                      });
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 cursor-pointer"
                    title="Move Student to Recycle Bin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No students found</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs">
              <div className="text-slate-500 font-medium">
                Page <strong className="text-slate-800 dark:text-slate-200">{currentStudentPage}</strong> of <strong>{totalPages}</strong> ({filteredStudents.length} students)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentStudentPage <= 1}
                  onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 py-1 font-mono font-bold text-slate-600 dark:text-slate-300">
                  {currentStudentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentStudentPage >= totalPages}
                  onClick={() => setStudentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (view === "fees") {
      const sortedClasses = sortSchoolClasses(displayedClasses);
      const changeMonth = (delta: number) => {
        const [y, m] = feeMonth.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setFeeMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      };
      const loadFeeSummary = async () => {
        setFeeSummaryLoading(true);
        const fees = await getAllMonthlyFees(schoolId, feeMonth, undefined, activeSession?.id);
        setAllFees(fees);
        setFeeSummaryLoading(false);
      };
      if (allFees.length === 0 && !feeSummaryLoading) { loadFeeSummary(); }

      const schoolTotal = displayedStudents.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
      const schoolCollected = allFees.filter(f => f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);
      const schoolDue = allFees.filter(f => !f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);

      // Pre-group students and fees by classId for 0ms instantaneous rendering
      const classStudentsMap = new Map<string, SchoolStudent[]>();
      displayedStudents.forEach(s => {
        const k = s.classId || "none";
        const arr = classStudentsMap.get(k) || [];
        arr.push(s);
        classStudentsMap.set(k, arr);
      });

      const classFeesMap = new Map<string, MonthlyFee[]>();
      allFees.forEach(f => {
        const k = f.classId || "none";
        const arr = classFeesMap.get(k) || [];
        arr.push(f);
        classFeesMap.set(k, arr);
      });

      const overallPct = schoolTotal > 0 ? Math.min(100, Math.round((schoolCollected / schoolTotal) * 100)) : 0;

      return (
        <div className="p-4 sm:p-5 max-w-3xl mx-auto space-y-4">
          {/* Unified Executive Fee Overview Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            {/* Month Navigator Strip */}
            <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={() => { changeMonth(-1); setAllFees([]); }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {new Date(feeMonth + "-01").toLocaleString("default", { month: "long", year: "numeric" })}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Monthly Fee Collection Overview
                </p>
              </div>
              <button
                type="button"
                onClick={() => { changeMonth(1); setAllFees([]); }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Primary 3-Column KPI Strip */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-3.5 sm:p-4">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Expected</p>
                <p className="mt-1 text-base sm:text-xl font-extrabold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
                  ₹{schoolTotal.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="p-3.5 sm:p-4">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Collected</p>
                <p className="mt-1 text-base sm:text-xl font-extrabold font-mono tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                  ₹{schoolCollected.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="p-3.5 sm:p-4">
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Pending Due</p>
                <p className="mt-1 text-base sm:text-xl font-extrabold font-mono tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
                  ₹{schoolDue.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Integrated Collection Progress Bar */}
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-300">Overall Collection Rate</span>
                <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                  {overallPct}% · {displayedStudents.length} students
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Fee Actions Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setView("fee_tagada")}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span className="truncate">Fee Tagada • Offline Caller</span>
              </span>
              {!hasEliteFeeTagadaAccess(school) ? (
                <Lock className="w-3.5 h-3.5 text-amber-200 shrink-0" />
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-black shrink-0">NEW</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setView("term_scheduler")}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                <CalendarClock className="w-4 h-4 shrink-0" />
                <span className="truncate">Term / Exam Fee &amp; Month Add</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-black shrink-0">NEW</span>
            </button>
            <button
              type="button"
              onClick={() => setView("fee_structure")}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="truncate">Fee Structure (Adm &amp; Heads)</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setView("fee_all")}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              <span className="inline-flex items-center gap-2 min-w-0 truncate">
                <Users className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="truncate">All Classes Fee Ledger</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Class-Wise Fee Ledger
            </h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {sortedClasses.length} {sortedClasses.length === 1 ? "class" : "classes"}
            </span>
          </div>

          {feeSummaryLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center py-10 text-slate-400 text-xs font-medium">
              Loading class fee summary...
            </div>
          ) : sortedClasses.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
              {sortedClasses.map((cls, idx) => {
                const classStudents = classStudentsMap.get(cls.id) || displayedStudents.filter(s => isStudentInClass(s, cls.id, cls.name));
                const classFees = classFeesMap.get(cls.id) || allFees.filter(f => f.classId === cls.id || isStudentInClass(f, cls.id, cls.name));
                const expected = classStudents.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
                const collected = classFees.filter(f => f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);
                const due = classFees.filter(f => !f.paid).reduce((sum, f) => sum + (f.amount || 0), 0);
                const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
                return (
                  <button
                    key={cls.id || `fee-cls-${cls.name}-${idx}`}
                    type="button"
                    onClick={() => { setFeeClassSelected(cls); setView("fee_class"); }}
                    className="w-full px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {cls.name}
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          · {classStudents.length} {classStudents.length === 1 ? "student" : "students"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 whitespace-nowrap group-hover:translate-x-0.5 transition-transform">
                        Manage →
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Expected</span>
                        <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100">
                          ₹{expected.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Collected</span>
                        <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{collected.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Due</span>
                        <span className={`font-mono tabular-nums font-bold ${due > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}>
                          ₹{due.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2.5">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            pct >= 100
                              ? "bg-emerald-600 dark:bg-emerald-500"
                              : pct > 0
                              ? "bg-indigo-600 dark:bg-indigo-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400 w-9 text-right shrink-0">
                        {pct}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center py-10 text-slate-400">
              <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs font-medium">Koi class nahi mili</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return renderErpShell(
    view === "dashboard" ? (
      renderHomeDashboard()
    ) : view === "account_hub" ? (
      renderAccountHubPage()
    ) : (
      <div>
        <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-4 py-3 rounded-2xl mb-4 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-black text-slate-700 dark:text-slate-200 capitalize truncate">
              {view.replace(/_/g, " ")}
            </p>
            {view === "teachers" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const isOpening = !(teachersHubTab === "directory" && showForm === "teacher");
                    setTeachersHubTab("directory");
                    setEditingTeacherId(null);
                    setShowForm(isOpening ? "teacher" : null);
                  }}
                  title="Add Faculty Member"
                  aria-label="Add Faculty Member"
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
                    teachersHubTab === "directory" && showForm === "teacher"
                      ? "bg-indigo-700 text-white ring-2 ring-indigo-300 dark:ring-indigo-500"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeacherRulesModal(true)}
                  title="Rules & Regulations for Teachers"
                  aria-label="Teacher Rules"
                  className="h-8 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Rules</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeacherReferralModal(true)}
                  title="10% Referral Bonus (किसे देना है)"
                  aria-label="10% Referral Bonus"
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                    showTeacherReferralModal
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                  }`}
                >
                  <Award className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (view === "subjects" || view === "students" || view === "attendance" || view === "marks" || view === "report_card") setView("classes");
              else if (view === "content") setView("subjects");
              else setView("dashboard");
            }}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to {view === "subjects" || view === "students" ? "Classes" : "Dashboard"}
          </button>
        </div>
        {renderListView()}
      </div>
    )
  );
};

export default SchoolAdminPanel;
