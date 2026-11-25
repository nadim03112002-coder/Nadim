// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import type { School, SchoolClass, SchoolStudent, StaffEmployee, SchoolTeacher } from "../../school-types";
import { schoolPrintFieldEnabled } from "../../school-types";
import {
  CreditCard, Printer, Download, Eye, ChevronLeft, User, Phone, MapPin,
  Calendar, Award, Sparkles, Filter, CheckSquare, Square, Layers, RefreshCw,
  Building2, UserPlus, Sliders, CheckCircle2, QrCode, FileText, Image as ImageIcon,
  Edit2, AlertTriangle, ArrowRightLeft, ShieldCheck, HelpCircle, ChevronDown, ChevronUp, Save, Search, Palette, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { SchoolHeaderEditorModal, type SchoolHeaderDetails } from "./SchoolHeaderEditorModal";
import { QuickAddStudentModal } from "./QuickAddStudentModal";
import { DirectUploadButton } from "../DirectUploadButton";
import { updateSchool, isStudentInClass, isActiveSchoolTeacherRecord, isActiveStaffRecord, getDeletedTeacherIds } from "../../school-firebase";
import { cleanLogoUrl, isAppLogo, getSavedSchoolLogo, getVisibleSchoolRegNo, formatAcademicSession } from "./feeReceiptUtils";
import { buildStudentIdCardQrUrl, buildStaffIdCardQrUrl } from "../../utils/qrVerifyUrl";
import { DocumentTemplateStudioModal } from "./DocumentTemplateStudioModal";
import { resolveActiveDocumentTemplate, DOCUMENT_TEMPLATE_EVENT, getLayoutArchitecture } from "../../utils/schoolDocumentTemplates";
import { printElementInIframe } from "./AdmissionFormPrintModal";
import { exportElementToPdf, exportMultiPageElementsToPdf } from "../../utils/universalPdfExport";

interface Props {
  school: School;
  classes: SchoolClass[];
  students: SchoolStudent[];
  staff: StaffEmployee[];
  teachers?: SchoolTeacher[];
  initialTab?: "students" | "staff";
  onBack: () => void;
}

type CardTheme = "modern_indigo" | "royal_maroon" | "golden_dark" | "emerald_green";

export const IdCardManager: React.FC<Props> = ({
  school,
  classes = [],
  students: initialStudents = [],
  staff = [],
  teachers = [],
  initialTab = "students",
  onBack,
}) => {
  const safeInitialStudents = Array.isArray(initialStudents)
    ? initialStudents.filter((student): student is SchoolStudent => Boolean(student && typeof student === "object"))
    : [];
  const [students, setStudents] = useState<SchoolStudent[]>(safeInitialStudents);

  // Merge staff and teachers into unifiedStaff so all active faculty have immediate ID cards
  const unifiedStaff: StaffEmployee[] = React.useMemo(() => {
    const deletedIds = getDeletedTeacherIds(school?.id || "");
    const cleanTeachers = (teachers || []).filter(
      (t) => t && isActiveSchoolTeacherRecord(t) && !deletedIds.has(t.id)
    );
    const activeTeacherIds = new Set(cleanTeachers.map((t) => t.id));
    const cleanStaff = (staff || []).filter((s) => {
      if (!s || !isActiveStaffRecord(s) || deletedIds.has(s.id)) return false;
      if (s.department === "Academic / Faculty" && !activeTeacherIds.has(s.id)) return false;
      return true;
    });
    const existingIds = new Set(cleanStaff.map(s => s.id));
    const teacherStaff: StaffEmployee[] = cleanTeachers
      .filter(t => !existingIds.has(t.id))
      .map(t => ({
        id: t.id,
        schoolId: t.schoolId || school?.id,
        name: t.name || "Teacher",
        email: t.email || "",
        phone: t.phone || "",
        designation: t.designation || (t.subjects?.length ? `${t.subjects.join(", ")} Teacher` : "Teacher"),
        department: "Academic / Faculty",
        joinDate: t.joinDate || new Date().toISOString().split("T")[0],
        monthlySalary: 0,
        active: t.active ?? true,
        photoUrl: t.photoUrl,
        employeeId: t.employeeId || `TEA-${(t.id || Date.now().toString()).slice(-4).toUpperCase()}`,
        createdAt: t.createdAt || new Date().toISOString(),
      }));

    const adminStaffMember: StaffEmployee = {
      id: "admin_principal_head",
      schoolId: school?.id || "",
      name: school?.principalName || "Principal / School Admin",
      email: school?.email || school?.adminEmail || "",
      phone: school?.phone || school?.mobile || "",
      designation: "👑 School Administrator & Principal",
      department: "Administration & Institutional Head",
      joinDate: new Date().toISOString().split("T")[0],
      monthlySalary: 75000,
      active: true,
      photoUrl: school?.logoUrl,
      employeeId: "ADMIN-01",
      createdAt: new Date().toISOString(),
    };
    return [adminStaffMember, ...cleanStaff, ...teacherStaff];
  }, [staff, teachers, school?.id, school?.principalName, school?.email, school?.phone, school?.mobile, school?.logoUrl]);

  const [activeTab, setActiveTab] = useState<"students" | "staff">(initialTab);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<SchoolStudent | null>(safeInitialStudents[0] || null);
  const [selectedStaff, setSelectedStaff] = useState<StaffEmployee | null>(unifiedStaff[0] || null);

  useEffect(() => {
    if (selectedStaff && !unifiedStaff.some((s) => s.id === selectedStaff.id)) {
      setSelectedStaff(unifiedStaff[0] || null);
    }
  }, [unifiedStaff, selectedStaff]);
  const [theme, setTheme] = useState<CardTheme>("modern_indigo");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cardOrientation, setCardOrientation] = useState<"landscape" | "portrait">("landscape");
  const [cardsPerPage, setCardsPerPage] = useState<4 | 8>(8);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const singleCardRef = useRef<HTMLDivElement>(null);

  // School Details & Customization State
  const [showSchoolHeaderModal, setShowSchoolHeaderModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showQuickSchoolEditor, setShowQuickSchoolEditor] = useState(false);
  const [showAutoMappingOptions, setShowAutoMappingOptions] = useState(false);
  const [showTemplateStudio, setShowTemplateStudio] = useState(false);
  const [templateTick, setTemplateTick] = useState(0);
  const [savingDefault, setSavingDefault] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  useEffect(() => {
    const handler = () => setTemplateTick(t => t + 1);
    window.addEventListener(DOCUMENT_TEMPLATE_EVENT, handler);
    return () => window.removeEventListener(DOCUMENT_TEMPLATE_EVENT, handler);
  }, []);

  const activeIdTemplate = React.useMemo(
    () => resolveActiveDocumentTemplate(school?.id, school, "id_card"),
    [school, templateTick]
  );
  const useCustomTpl = activeIdTemplate.id !== "default";

  const [schoolDetails, setSchoolDetails] = useState<SchoolHeaderDetails & { session: string }>({
    schoolName: school?.name || "",
    tagline: school?.tagline || "",
    affiliation: school?.affiliation || "",
    address: school?.address || "",
    phone: school?.mobile || school?.phone || "",
    email: school?.email || "",
    logoUrl: getSavedSchoolLogo(school?.logoUrl, school?.id),
    principalName: school?.principalName || "",
    principalTitle: "Principal",
    code: getVisibleSchoolRegNo(school),
    principalPhone: school?.principalPhone || "",
    directorName: school?.directorName || "",
    directorPhone: school?.directorPhone || "",
    principalSignatureUrl: school?.principalSignatureUrl || "",
    directorSignatureUrl: school?.directorSignatureUrl || "",
    customFields: school?.customFields || [],
    documentPrintFields: school?.documentPrintFields || {},
    session: "2026-27",
  });

  useEffect(() => {
    setSchoolDetails(previous => ({
      ...previous,
      schoolName: school.name || "",
      tagline: school.tagline || "",
      affiliation: school.affiliation || "",
      address: school.address || "",
      phone: school.mobile || school.phone || "",
      email: school.email || "",
      logoUrl: getSavedSchoolLogo(school.logoUrl || previous.logoUrl, school.id),
      principalName: school.principalName || "",
      code: getVisibleSchoolRegNo(school),
      principalPhone: school.principalPhone || "",
      directorName: school.directorName || "",
      directorPhone: school.directorPhone || "",
      principalSignatureUrl: school.principalSignatureUrl || "",
      directorSignatureUrl: school.directorSignatureUrl || "",
      customFields: school.customFields || [],
      documentPrintFields: school.documentPrintFields || {},
    }));
  }, [school]);

  // Smart Auto-Data Mapping (Automatically places every field in its optimal card position)
  const [autoDataMapping, setAutoDataMapping] = useState(true);
  const [fieldSettings, setFieldSettings] = useState(() => ({
    showFatherName: school?.idCardFieldSettings?.showFatherName ?? true,
    showMotherName: school?.idCardFieldSettings?.showMotherName ?? true,
    showRollNo: school?.idCardFieldSettings?.showRollNo ?? true,
    showAdmissionNo: school?.idCardFieldSettings?.showAdmissionNo ?? true,
    showPhone: school?.idCardFieldSettings?.showPhone ?? true,
    showBloodGroup: school?.idCardFieldSettings?.showBloodGroup ?? true,
    showDateOfBirth: school?.idCardFieldSettings?.showDateOfBirth ?? true,
    showStudentAddress: school?.idCardFieldSettings?.showStudentAddress ?? true,
    showStudentEmail: school?.idCardFieldSettings?.showStudentEmail ?? false,
    showSession: school?.idCardFieldSettings?.showSession ?? true,
    showAddress: school?.idCardFieldSettings?.showAddress ?? true,
    showSignatory: school?.idCardFieldSettings?.showSignatory ?? true,
    showSchoolCode: school?.idCardFieldSettings?.showSchoolCode ?? true,
  }));

  // Filtered lists
  const filteredStudents = students.filter(s => {
    const classMatch = selectedClassId === "all" || isStudentInClass(s, selectedClassId);
    const searchMatch = !search.trim() ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.rollNo && s.rollNo.toLowerCase().includes(search.toLowerCase())) ||
      (s.admissionNo && s.admissionNo.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search));
    return classMatch && searchMatch;
  });

  useEffect(() => {
    if (!selectedStaff && unifiedStaff.length > 0) {
      setSelectedStaff(unifiedStaff[0]);
    }
  }, [unifiedStaff, selectedStaff]);

  const filteredStaff = unifiedStaff.filter(st => {
    const q = search.trim().toLowerCase();
    return !q ||
      st.name.toLowerCase().includes(q) ||
      (st.designation && st.designation.toLowerCase().includes(q)) ||
      (st.department && st.department.toLowerCase().includes(q)) ||
      (st.phone && st.phone.includes(q)) ||
      (st.employeeId && st.employeeId.toLowerCase().includes(q));
  });

  const currentList = activeTab === "students" ? filteredStudents : filteredStaff;

  const toggleSelectAll = () => {
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePrint = () => {
    const activeSingleItem = activeTab === "students" ? selectedStudent : selectedStaff;
    if (bulkMode && printAreaRef.current) {
      const bulkCss = `
        @page { size: A4 portrait; margin: 4mm; }
        .idcard-page {
          width: 100% !important;
          max-width: 198mm !important;
          padding: 2mm !important;
          margin: 0 auto !important;
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          grid-template-rows: repeat(${cardsPerPage === 4 ? 2 : 4}, auto) !important;
          gap: 3mm !important;
          align-items: center !important;
          justify-items: center !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .idcard-page:last-child { page-break-after: auto !important; break-after: auto !important; }
        .idcard-print-cell { width: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; }
        .print-card-box { box-shadow: none !important; margin: 0 !important; transform: scale(${cardsPerPage === 8 && cardOrientation === "portrait" ? 0.78 : 1}) !important; }
      `;
      printElementInIframe(printAreaRef.current, `${schoolDetails.schoolName || "School"} - Bulk ID Cards`, bulkCss, "portrait");
      return;
    }

    const singleCardEl = (singleCardRef.current?.firstElementChild as HTMLElement) || singleCardRef.current;
    if (singleCardEl) {
      printElementInIframe(
        singleCardEl,
        `${activeSingleItem?.name || "Student"} - ID Card`,
        "",
        cardOrientation
      );
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      if (bulkMode && printAreaRef.current) {
        const pageEls = Array.from(printAreaRef.current.querySelectorAll(".idcard-page")) as HTMLElement[];
        const targetPages = pageEls.length > 0 ? pageEls : [printAreaRef.current];
        await exportMultiPageElementsToPdf(targetPages, {
          filename: `${schoolDetails.schoolName || "School"}_${activeTab === "students" ? "Students" : "Staff"}_ID_Cards_Bulk`,
          orientation: "portrait",
          widthPx: 794,
          marginMm: 5,
          scale: 2,
        });
        toast.success("Bulk ID Cards PDF download ho gaya!");
        return;
      }

      const activeSingleItem = activeTab === "students" ? selectedStudent : selectedStaff;
      const singleCardEl = (singleCardRef.current?.firstElementChild as HTMLElement) || singleCardRef.current;
      if (!singleCardEl || !activeSingleItem) {
        toast.error("Pehle koi student ya staff ID card select karein.");
        return;
      }
      await exportElementToPdf(singleCardEl, {
        filename: `ID_Card_${activeSingleItem.name || "Member"}`,
        format: "cr80",
        orientation: cardOrientation,
        widthPx: cardOrientation === "landscape" ? 360 : 240,
        heightPx: cardOrientation === "landscape" ? 224 : 380,
        scale: 4,
      });
      toast.success("ID Card PDF download ho gaya!");
    } catch (err) {
      console.error("ID Card PDF export error:", err);
      toast.error("PDF download fail hua, Print / Save PDF try karein.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveSchoolDefaults = async () => {
    setSavingDefault(true);
    try {
      await updateSchool(school.id, {
        name: schoolDetails.schoolName,
        tagline: schoolDetails.tagline,
        affiliation: schoolDetails.affiliation,
        address: schoolDetails.address,
        phone: schoolDetails.phone,
        mobile: schoolDetails.phone,
        email: schoolDetails.email,
        logoUrl: schoolDetails.logoUrl,
        principalName: schoolDetails.principalName,
        principalPhone: schoolDetails.principalPhone || "",
        directorName: schoolDetails.directorName || "",
        directorPhone: schoolDetails.directorPhone || "",
        customFields: schoolDetails.customFields || [],
        documentPrintFields: schoolDetails.documentPrintFields || {},
        idCardFieldSettings: fieldSettings,
        code: (schoolDetails.code || "").trim(),
      });
      setSaveSuccessMsg("School details default profile mein save ho gaye!");
      setTimeout(() => setSaveSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Failed to save school defaults:", err);
    } finally {
      setSavingDefault(false);
    }
  };

  const updateCardFieldSetting = (key: keyof typeof fieldSettings, value: boolean) => {
    const nextSettings = { ...fieldSettings, [key]: value };
    setFieldSettings(nextSettings);
    updateSchool(school.id, { idCardFieldSettings: nextSettings }).catch(error => {
      console.error("Failed to save ID card field settings:", error);
    });
  };
  const showSchoolDetail = (field: Parameters<typeof schoolPrintFieldEnabled>[2]) =>
    schoolPrintFieldEnabled(schoolDetails.documentPrintFields, "idCard", field);

  // Theme styling presets
  const themeStyles: Record<CardTheme, { headerBg: string; border: string; accent: string; badge: string; textAccent: string }> = {
    modern_indigo: {
      headerBg: "bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-900",
      border: "border-indigo-400",
      accent: "#4f46e5",
      badge: "bg-indigo-100 text-indigo-800",
      textAccent: "text-indigo-700",
    },
    royal_maroon: {
      headerBg: "bg-gradient-to-r from-red-800 via-rose-900 to-amber-950",
      border: "border-rose-400",
      accent: "#9f1239",
      badge: "bg-rose-100 text-rose-800",
      textAccent: "text-rose-700",
    },
    golden_dark: {
      headerBg: "bg-gradient-to-r from-slate-900 via-zinc-900 to-amber-950",
      border: "border-amber-500",
      accent: "#d97706",
      badge: "bg-amber-100 text-amber-900",
      textAccent: "text-amber-700",
    },
    emerald_green: {
      headerBg: "bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900",
      border: "border-emerald-400",
      accent: "#059669",
      badge: "bg-emerald-100 text-emerald-800",
      textAccent: "text-emerald-700",
    },
  };

  const currentTheme = themeStyles[theme];

  // Helper to render single ID Card
  // PRINT SAFE LAYOUT:
  // 1. QR Code on the LEFT with white protective boundary (No clipping!)
  // 2. Student Details in the CENTER (Auto-placed data)
  // 3. Student Photo on the RIGHT (No cutting, safe right margin)
  const renderCard = (item: any, isStaff: boolean) => {
    const className = !isStaff ? (classes.find(c => c.id === item.classId)?.name || "Class") : item.designation;

    const cleanStudentName = (item.name || "").slice(0, 32);
    const cleanSchoolId = school?.id || "";
    const cleanStudentId = item.id || "";
    const cleanRollNo = item.rollNo || item.employeeId || "";
    const cleanClassId = item.classId || "";
    const customSchoolDetails = showSchoolDetail("customFields")
      ? (schoolDetails.customFields || [])
        .filter(field => field.label?.trim() && field.value?.trim())
        .map(field => `${field.label}: ${field.value}`)
        .join(" • ")
      : "";

    // Keep the printed QR payload compact and self-contained with full student identity
    const cleanAdmissionNo = item.admissionNo || "";
    const cleanPhone = item.phone || item.mobile || "";
    const cleanFatherName = item.fatherName || "";
    const cleanMotherName = item.motherName || "";
    const cleanBloodGroup = item.bloodGroup || "";
    const cleanDob = item.dateOfBirth || item.dob || "";
    const cleanAddress = item.address || item.city || "";
    const cleanMonthlyFee = item.monthlyFee !== undefined && item.monthlyFee !== null ? String(item.monthlyFee) : "";
    const cleanClassName = className || item.className || "";
    const cleanSchoolName = schoolDetails.schoolName || school?.name || "";

    const qrVerifyUrl = isStaff
      ? buildStaffIdCardQrUrl({
          isAdmin: false,
          schoolId: cleanSchoolId,
          staffId: cleanStudentId,
          empId: cleanRollNo,
          department: cleanClassId,
          name: cleanStudentName,
          admNo: cleanAdmissionNo,
          phone: cleanPhone,
          fatherName: cleanFatherName,
          motherName: cleanMotherName,
          bloodGroup: cleanBloodGroup,
          dob: cleanDob,
          address: cleanAddress,
          designation: cleanClassName,
          schoolName: cleanSchoolName,
        })
      : buildStudentIdCardQrUrl({
          schoolId: cleanSchoolId,
          studentId: cleanStudentId,
          rollNo: cleanRollNo,
          classId: cleanClassId,
          studentName: cleanStudentName,
          admissionNo: cleanAdmissionNo,
          phone: cleanPhone,
          fatherName: cleanFatherName,
          motherName: cleanMotherName,
          bloodGroup: cleanBloodGroup,
          dob: cleanDob,
          address: cleanAddress,
          monthlyFee: cleanMonthlyFee,
          className: cleanClassName,
          schoolName: cleanSchoolName,
        });
    const isLandscape = cardOrientation === "landscape";

    const cleanSessionLabel = formatAcademicSession(schoolDetails.session || "2026-27");
    const resolvedSignatoryTitle = useCustomTpl && activeIdTemplate.rightSignatoryLabel
      ? activeIdTemplate.rightSignatoryLabel
      : schoolDetails.principalTitle && !/auth\.?\s*signatory/i.test(schoolDetails.principalTitle)
        ? schoolDetails.principalTitle
        : "Principal";

    const tplColors = activeIdTemplate.colors;
    const cardContainerStyle: React.CSSProperties = useCustomTpl
      ? {
          fontFamily: "'Inter', sans-serif",
          boxSizing: "border-box",
          borderColor: tplColors.borderColor,
          borderStyle: activeIdTemplate.borderStyle,
          borderWidth: activeIdTemplate.borderStyle === "double" ? "3px" : "2px",
        }
      : { fontFamily: "'Inter', sans-serif", boxSizing: "border-box" };

    const cardHeaderStyle: React.CSSProperties | undefined = useCustomTpl
      ? {
          background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`,
          color: tplColors.headerTextColor,
        }
      : undefined;

    const cardBadgeStyle: React.CSSProperties | undefined = useCustomTpl
      ? {
          backgroundColor: tplColors.badgeBg,
          color: tplColors.badgeText,
        }
      : undefined;

    const renderWatermarkOverlay = () =>
      useCustomTpl && activeIdTemplate.showWatermark ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.06] z-0">
          <span
            className="text-lg font-black uppercase tracking-widest -rotate-12"
            style={{ color: tplColors.primaryColor }}
          >
            {activeIdTemplate.watermarkText || cleanSchoolName.slice(0, 12)}
          </span>
        </div>
      ) : null;

    if (useCustomTpl) {
      const variant = activeIdTemplate.layoutVariant || "classic_ribbon";
      const arch = getLayoutArchitecture(variant);
      const schoolLogo = getSavedSchoolLogo(schoolDetails.logoUrl, school?.id);
      const idRoleBadge = isStaff ? "STAFF ID" : "STUDENT ID";
      const subClassLabel = isStaff ? item.designation : className;
      const isOrnateFrame =
        arch.frameStyle === "ornate_filigree" ||
        arch.frameStyle === "diploma_parchment" ||
        arch.frameStyle === "seal_center" ||
        arch.frameStyle === "laurel_wreath" ||
        arch.frameStyle === "museum_plaque" ||
        arch.frameStyle === "art_deco" ||
        arch.frameStyle === "guilloche";
      const paperBg = arch.creamPaper ? "#fffdf4" : arch.frameStyle === "blueprint_grid" ? "#f8fbff" : "#ffffff";
      const isLightTop =
        arch.headerStyle === "light_bar" ||
        arch.headerStyle === "gazette_double" ||
        arch.headerStyle === "editorial_split";
      const isLeftSpine = arch.frameStyle === "left_spine" || arch.frameStyle === "left_wide";
      const isRightSpine = arch.frameStyle === "right_spine" || arch.frameStyle === "right_wide";
      const isWideSpine = arch.frameStyle === "left_wide" || arch.frameStyle === "right_wide";
      const isDualRails = arch.frameStyle === "dual_rails";
      const isBottomDock = arch.frameStyle === "bottom_dock";
      const isLanyard = arch.frameStyle === "lanyard_punch";
      const isPassport = arch.frameStyle === "passport_mrz";
      const isTicket = arch.frameStyle === "ticket_notch";
      const isBrackets = arch.frameStyle === "corner_brackets" || arch.frameStyle === "cyber_hud";
      const isBeveled = arch.frameStyle === "beveled";
      const isBlueprint = arch.frameStyle === "blueprint_grid";
      const isObsidian = arch.headerStyle === "obsidian";
      const isTricolor = arch.frameStyle === "tricolor";
      const isHeavyBars = arch.frameStyle === "heavy_bars";
      const isMonoStripe = arch.frameStyle === "mono_stripe";
      const isBookmark = arch.frameStyle === "bookmark_ribbon";
      const isSwissCross = arch.frameStyle === "swiss_cross";
      const sizeClasses = isLandscape
        ? "w-[350px] min-h-[220px] max-h-[220px] print:w-[85.6mm] print:h-[54mm] print:min-h-[54mm] print:max-h-[54mm]"
        : "w-[260px] min-h-[390px] max-h-[390px] print:w-[54mm] print:h-[85.6mm] print:min-h-[85.6mm] print:max-h-[85.6mm]";

      const renderDetailsLines = (compact: boolean) => (
        <div className={`${compact ? "text-[7.5px] space-y-0.5" : "text-[8px] space-y-0.5"} text-slate-700 leading-tight`}>
          {!isStaff ? (
            <>
              {fieldSettings.showRollNo && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Roll:</span><span className="font-black text-slate-900">#{item.rollNo || "—"}</span></div>
              )}
              {fieldSettings.showAdmissionNo && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Adm:</span><span className="font-mono font-black text-slate-900 truncate">{item.admissionNo || "—"}</span></div>
              )}
              {fieldSettings.showFatherName && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Father:</span><span className="font-semibold text-slate-800 truncate max-w-[115px]">{item.fatherName || "—"}</span></div>
              )}
              {fieldSettings.showPhone && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Mobile:</span><span className="font-semibold text-slate-800">{item.phone || "—"}</span></div>
              )}
              {fieldSettings.showDateOfBirth && item.dateOfBirth && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">DOB:</span><span className="font-semibold text-slate-800">{item.dateOfBirth}</span></div>
              )}
              {!isLandscape && fieldSettings.showMotherName && item.motherName && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Mother:</span><span className="font-semibold text-slate-800 truncate max-w-[110px]">{item.motherName}</span></div>
              )}
              {!isLandscape && fieldSettings.showStudentAddress && item.address && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Addr:</span><span className="font-semibold text-slate-800 truncate max-w-[110px]">{item.address}</span></div>
              )}
              {fieldSettings.showSession && (
                <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Session:</span><span className="font-black" style={{ color: tplColors.primaryColor }}>{cleanSessionLabel}</span></div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Emp ID:</span><span className="font-mono font-black text-slate-900">{item.employeeId || item.id.slice(0, 6).toUpperCase()}</span></div>
              <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Dept:</span><span className="font-bold text-slate-800 truncate">{item.department || "Academic"}</span></div>
              <div className="flex justify-between gap-1"><span className="text-slate-400 font-bold">Contact:</span><span className="font-semibold text-slate-800">{item.phone || "—"}</span></div>
            </>
          )}
        </div>
      );

      const renderFooterStrip = () => (
        <div
          className="px-2 py-1 border-t flex items-center justify-between gap-1.5 text-[5.8px] shrink-0 relative z-10 mt-auto"
          style={{ backgroundColor: tplColors.surfaceTint, borderColor: tplColors.borderColor + "50" }}
        >
          <div className="min-w-0 flex-1 leading-tight text-slate-600 truncate">
            {showSchoolDetail("address") && schoolDetails.address && <span className="font-bold text-slate-700">{schoolDetails.address}</span>}
            {showSchoolDetail("phone") && schoolDetails.phone && <span className="ml-1 font-semibold">• {schoolDetails.phone}</span>}
            {activeIdTemplate.footerNote && <span className="ml-1 text-slate-500">• {activeIdTemplate.footerNote}</span>}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end">
            {schoolDetails.principalSignatureUrl ? (
              <img src={schoolDetails.principalSignatureUrl} alt="Sign" className="h-3.5 max-w-[55px] object-contain" />
            ) : schoolDetails.principalName ? (
              <span className="font-serif italic font-bold text-slate-900 text-[6.5px] leading-none">{schoolDetails.principalName}</span>
            ) : null}
            <span className="text-[5.8px] font-black uppercase text-slate-800">{resolvedSignatoryTitle}</span>
          </div>
        </div>
      );

      // VERTICAL LEFT OR RIGHT SIDEBAR SPINE / WIDE 35% PROFILE COLUMN (Layouts 02, 12, 41, 42)
      if (isLeftSpine || isRightSpine) {
        return (
          <div
            key={item.id}
            className={`${sizeClasses} bg-white rounded-xl shadow-lg flex ${isRightSpine ? "flex-row-reverse" : "flex-row"} relative print-card-box print:shadow-none print:m-1.5 print:break-inside-avoid print:inline-flex overflow-hidden`}
            style={{ ...cardContainerStyle, backgroundColor: paperBg }}
          >
            {renderWatermarkOverlay()}
            {/* Vertical Colored Spine */}
            <div
              className={`${isWideSpine ? (isLandscape ? "w-[82px]" : "w-[68px]") : (isLandscape ? "w-[58px]" : "w-[50px]")} shrink-0 flex flex-col items-center justify-between py-2 px-1 text-center relative z-10`}
              style={{ background: `linear-gradient(180deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor }}
            >
              {schoolLogo ? (
                <img src={cleanLogoUrl(schoolLogo)} alt="Logo" className="w-8 h-8 rounded-lg bg-white p-0.5 object-contain shadow" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white text-slate-900 font-black text-[10px] flex items-center justify-center">{(cleanSchoolName || "SC").slice(0, 2).toUpperCase()}</div>
              )}
              <div className="text-[7px] font-black uppercase tracking-widest leading-tight -rotate-90 whitespace-nowrap">
                {idRoleBadge}
              </div>
              <span className="px-1 py-0.5 rounded text-[6px] font-black" style={cardBadgeStyle}>{cleanSessionLabel}</span>
            </div>

            {/* Main Panel */}
            <div className="flex-1 min-w-0 flex flex-col justify-between relative z-10">
              <div className="px-2.5 pt-1.5 pb-1 border-b" style={{ borderColor: tplColors.borderColor + "40" }}>
                <h3 className="font-black text-[10px] uppercase tracking-tight truncate" style={{ color: tplColors.primaryColor }}>{schoolDetails.schoolName}</h3>
                {schoolDetails.affiliation && <p className="text-[6px] text-slate-500 truncate">{schoolDetails.affiliation}</p>}
              </div>

              {isLandscape ? (
                <div className="px-2.5 py-1 flex-1 flex items-center justify-between gap-2 min-h-0">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-[11px] text-slate-900 truncate">{item.name}</h4>
                    <div className="flex items-center gap-1 my-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[7px] font-black uppercase" style={cardBadgeStyle}>{subClassLabel}</span>
                      {fieldSettings.showBloodGroup && item.bloodGroup && <span className="px-1 rounded text-[7px] font-black bg-rose-50 text-rose-700 border border-rose-200">{item.bloodGroup}</span>}
                    </div>
                    {renderDetailsLines(true)}
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-[50px] h-[60px] rounded-lg border-2 overflow-hidden bg-slate-100 flex items-center justify-center" style={{ borderColor: tplColors.primaryColor }}>
                      {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div className="p-0.5 bg-white border rounded"><QRCode value={qrVerifyUrl} size={42} level="L" /></div>
                  </div>
                </div>
              ) : (
                <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-between min-h-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-[62px] h-[74px] rounded-lg border-2 overflow-hidden bg-slate-100 flex items-center justify-center" style={{ borderColor: tplColors.primaryColor }}>
                      {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="p-1 bg-white border rounded"><QRCode value={qrVerifyUrl} size={56} level="L" /></div>
                  </div>
                  <div className="p-1.5 rounded-lg border my-1" style={{ backgroundColor: tplColors.surfaceTint, borderColor: tplColors.borderColor + "40" }}>
                    <h4 className="font-black text-[11px] text-slate-900 truncate">{item.name}</h4>
                    <span className="inline-block px-1.5 py-0.2 rounded text-[7.5px] font-black mt-0.5" style={cardBadgeStyle}>{subClassLabel}</span>
                  </div>
                  {renderDetailsLines(false)}
                </div>
              )}
              {renderFooterStrip()}
            </div>
          </div>
        );
      }

      // DESIGN 09 & 18: 50/50 DUAL-TONE SPLIT / DARK OBSIDIAN GOLD
      if (variant === "dual_tone_split" || isObsidian) {
        return (
          <div
            key={item.id}
            className={`${sizeClasses} bg-white rounded-2xl shadow-lg flex flex-col relative print-card-box print:shadow-none print:m-1.5 print:break-inside-avoid print:inline-flex overflow-hidden`}
            style={cardContainerStyle}
          >
            {renderWatermarkOverlay()}
            {/* Top Colored Hero Half */}
            <div
              className={`${isLandscape ? "px-3 py-2" : "px-3 pt-3 pb-2.5"} relative z-10`}
              style={{
                background: isObsidian
                  ? `linear-gradient(135deg, #09090b, ${tplColors.primaryColor})`
                  : `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`,
                color: tplColors.headerTextColor,
                borderBottom: isObsidian ? `2px solid ${tplColors.accentColor}` : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {schoolLogo && <img src={cleanLogoUrl(schoolLogo)} alt="Logo" className="w-5 h-5 rounded-full bg-white p-0.5 object-contain shrink-0" />}
                  <h3 className="font-black text-[9.5px] uppercase truncate" style={{ color: tplColors.headerTextColor }}>{schoolDetails.schoolName}</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[6.5px] font-black shrink-0" style={cardBadgeStyle}>{cleanSessionLabel}</span>
              </div>
              <div className={`flex ${isLandscape ? "items-center gap-2.5" : "flex-col items-center text-center gap-1.5"}`}>
                <div className={`${isLandscape ? "w-[52px] h-[60px]" : "w-[74px] h-[84px]"} rounded-xl border-2 bg-white overflow-hidden shadow shrink-0 flex items-center justify-center`} style={{ borderColor: isObsidian ? tplColors.accentColor : "#ffffff" }}>
                  {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-slate-400" />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-[12px] leading-tight truncate" style={{ color: tplColors.headerTextColor }}>{item.name}</h4>
                  <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[7.5px] font-black bg-white/20 backdrop-blur-xs">{subClassLabel}</span>
                </div>
              </div>
            </div>

            {/* Bottom Crisp White Details + QR Half */}
            <div className="flex-1 bg-white px-2.5 py-1.5 flex items-center justify-between gap-2 min-h-0 relative z-10">
              <div className="flex-1 min-w-0">{renderDetailsLines(true)}</div>
              <div className="flex flex-col items-center shrink-0">
                <div className="p-0.5 border rounded bg-white"><QRCode value={qrVerifyUrl} size={isLandscape ? 54 : 62} level="L" /></div>
                <span className="text-[5.5px] font-black text-slate-500 mt-0.5">SCAN VERIFY</span>
              </div>
            </div>
            {renderFooterStrip()}
          </div>
        );
      }

      // DESIGN 07, 13 & 20: DIPLOMA / HERITAGE ORNATE / EMBLEM SEAL FRAME
      if (isOrnateFrame) {
        return (
          <div
            key={item.id}
            className={`${sizeClasses} p-1 shadow-lg flex flex-col relative print-card-box print:shadow-none print:m-1.5 print:break-inside-avoid print:inline-flex overflow-hidden rounded-lg`}
            style={{ ...cardContainerStyle, backgroundColor: paperBg, border: `3px double ${tplColors.borderColor}` }}
          >
            <div className="w-full h-full border rounded flex flex-col justify-between overflow-hidden relative" style={{ borderColor: tplColors.accentColor }}>
              {renderWatermarkOverlay()}
              <div className="px-2.5 py-1 text-center border-b relative z-10" style={{ borderColor: tplColors.borderColor + "60", backgroundColor: tplColors.surfaceTint }}>
                <div className="text-[6px] font-black tracking-[0.2em] uppercase" style={{ color: tplColors.accentColor }}>★ OFFICIAL ACADEMIC IDENTITY ★</div>
                <h3 className="font-serif font-black text-[10.5px] uppercase truncate" style={{ color: tplColors.primaryColor }}>{schoolDetails.schoolName}</h3>
              </div>

              <div className={`px-2.5 py-1 flex-1 flex ${isLandscape ? "items-center justify-between gap-2" : "flex-col items-center justify-between gap-1"} relative z-10 min-h-0`}>
                <div className={`${isLandscape ? "w-[56px] h-[68px]" : "w-[68px] h-[78px]"} rounded-full border-2 overflow-hidden bg-white shadow-xs shrink-0 flex items-center justify-center`} style={{ borderColor: tplColors.accentColor }}>
                  {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-slate-400" />}
                </div>
                <div className={`flex-1 min-w-0 ${isLandscape ? "" : "w-full text-center"}`}>
                  <h4 className="font-serif font-black text-[11px] text-slate-900 truncate">{item.name}</h4>
                  <span className="inline-block px-2 py-0.2 rounded-full text-[7px] font-black border mb-1" style={{ ...cardBadgeStyle, borderColor: tplColors.accentColor }}>{subClassLabel}</span>
                  {renderDetailsLines(true)}
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <div className="p-0.5 bg-white border rounded" style={{ borderColor: tplColors.borderColor }}><QRCode value={qrVerifyUrl} size={isLandscape ? 54 : 52} level="L" /></div>
                </div>
              </div>
              {renderFooterStrip()}
            </div>
          </div>
        );
      }

      // REMAINING 50+ STRUCTURAL VARIANTS (Wave, Arch, Chevron, Scallop, Prism, Horizon, Diagonal, Obsidian, Lanyard, Passport MRZ, Ticket Notch, Dual Rails, Bottom Dock, Brackets, Beveled, Blueprint, Checkered, Bookmark, Swiss Cross, Mono Stripe, Heavy Bars, etc.)
      const getCardHeaderBgStyle = (): React.CSSProperties => {
        if (isLightTop) {
          return {
            backgroundColor: "#ffffff",
            color: "#0f172a",
            borderBottom: arch.headerStyle === "gazette_double" ? `3px double ${tplColors.borderColor}` : `2px solid ${tplColors.borderColor}`,
          };
        }
        switch (arch.headerStyle) {
          case "diagonal":
            return { background: `linear-gradient(122deg, ${tplColors.primaryColor} 64%, ${tplColors.accentColor} 64%)`, color: tplColors.headerTextColor };
          case "aurora":
            return { background: `linear-gradient(125deg, ${tplColors.primaryColor}, ${tplColors.accentColor}, #ec4899)`, color: tplColors.headerTextColor };
          case "prism":
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor} 0%, ${tplColors.accentColor} 45%, ${tplColors.primaryColor} 46%, #0f172a 100%)`, color: tplColors.headerTextColor };
          case "horizon":
            return { background: `radial-gradient(circle at 50% 120%, ${tplColors.accentColor}, ${tplColors.primaryColor} 72%)`, color: tplColors.headerTextColor, borderBottomLeftRadius: "50% 12px", borderBottomRightRadius: "50% 12px" };
          case "arch":
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor, borderBottomLeftRadius: "42% 12px", borderBottomRightRadius: "42% 12px" };
          case "wave":
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor, borderBottomLeftRadius: "60% 14px", borderBottomRightRadius: "20% 4px" };
          case "scallop":
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor, borderBottom: `3px dotted ${tplColors.badgeBg}` };
          case "chevron":
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor, clipPath: "polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)", paddingBottom: "8px" };
          case "scoreboard":
            return { background: "#0f172a", color: "#ffffff", borderBottom: `3px solid ${tplColors.accentColor}` };
          case "double_decker":
            return { background: tplColors.primaryColor, color: tplColors.headerTextColor, borderBottom: `4px solid ${tplColors.accentColor}` };
          case "floating_pill":
          case "scroll_header":
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor, margin: "4px 6px 0", borderRadius: "9999px" };
          default:
            return { background: `linear-gradient(135deg, ${tplColors.primaryColor}, ${tplColors.accentColor})`, color: tplColors.headerTextColor };
        }
      };

      const showBigHeroPhoto = arch.frameStyle === "hero_photo";
      const isMinimalGrid = arch.sharpCorners || arch.frameStyle === "matrix_boxed" || arch.frameStyle === "blueprint_grid";
      const isArchShape = arch.headerStyle === "arch" || arch.headerStyle === "wave" || arch.headerStyle === "scallop";

      return (
        <div
          key={item.id}
          className={`${sizeClasses} ${isBeveled ? "rounded-none" : arch.sharpCorners ? "rounded-md" : "rounded-xl"} shadow-lg flex ${isDualRails ? "flex-row" : "flex-col"} relative print-card-box print:shadow-none print:m-1.5 print:break-inside-avoid print:inline-flex overflow-hidden`}
          style={{
            ...cardContainerStyle,
            backgroundColor: paperBg,
            backgroundImage: isBlueprint
              ? `linear-gradient(${tplColors.primaryColor}10 1px, transparent 1px), linear-gradient(90deg, ${tplColors.primaryColor}10 1px, transparent 1px)`
              : undefined,
            backgroundSize: isBlueprint ? "10px 10px" : undefined,
            borderRadius: isBeveled ? "14px 2px 14px 2px" : undefined,
            borderTopWidth: isHeavyBars ? "6px" : cardContainerStyle.borderWidth,
            borderBottomWidth: isHeavyBars ? "6px" : cardContainerStyle.borderWidth,
            borderLeftWidth: isMonoStripe ? "5px" : isSwissCross ? "8px" : cardContainerStyle.borderWidth,
            fontFamily: arch.serifFont ? "Georgia, serif" : arch.monoAccent ? "'JetBrains Mono', monospace" : undefined,
          }}
        >
          {isDualRails && <div className="w-2.5 shrink-0" style={{ background: `linear-gradient(180deg, ${tplColors.primaryColor}, ${tplColors.accentColor})` }} />}
          {isSwissCross && (
            <div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded-xs flex items-center justify-center text-[10px] font-black shadow-xs" style={{ backgroundColor: tplColors.accentColor, color: "#ffffff" }}>
              ✚
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0 relative">
          {renderWatermarkOverlay()}
          {/* Lanyard Punch Slot */}
          {isLanyard && (
            <div className="py-1 flex justify-center shrink-0 relative z-20" style={{ backgroundColor: tplColors.primaryColor }}>
              <div className="w-8 h-1.5 rounded-full bg-white/90 border border-slate-400" />
            </div>
          )}
          {/* Ticket Side Notches */}
          {isTicket && (
            <>
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-100 border-r z-20" style={{ borderColor: tplColors.borderColor }} />
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-100 border-l z-20" style={{ borderColor: tplColors.borderColor }} />
            </>
          )}
          {/* Hanging Bookmark Flag */}
          {isBookmark && (
            <div
              className="absolute top-0 right-3 w-4 h-7 z-20 flex items-center justify-center text-[6px] font-black text-white shadow"
              style={{ backgroundColor: tplColors.accentColor, clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)" }}
            >
              ★
            </div>
          )}
          {/* Corner Brackets / Cyber HUD */}
          {isBrackets && (
            <>
              <span className="absolute top-0.5 left-0.5 w-2.5 h-2.5 border-t-2 border-l-2 z-20" style={{ borderColor: tplColors.accentColor }} />
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 border-t-2 border-r-2 z-20" style={{ borderColor: tplColors.accentColor }} />
              <span className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 border-b-2 border-l-2 z-20" style={{ borderColor: tplColors.accentColor }} />
              <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 z-20" style={{ borderColor: tplColors.accentColor }} />
            </>
          )}
          {/* Tricolor Heritage Top Band */}
          {isTricolor && (
            <div className="h-1.5 w-full flex shrink-0 relative z-10">
              <div className="flex-1 bg-orange-500" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-emerald-600" />
            </div>
          )}
          {/* Top Accent Rule */}
          {(isLightTop || arch.topAccentBar) && !isTricolor && (
            <div className="h-1.5 w-full shrink-0 relative z-10" style={{ background: `linear-gradient(90deg, ${tplColors.primaryColor}, ${tplColors.accentColor})` }} />
          )}

          {/* Card Header */}
          <div
            className={`px-2.5 ${isLandscape ? "py-1.5" : "py-2"} flex items-center gap-1.5 shrink-0 relative z-10 ${
              activeIdTemplate.logoPosition === "center"
                ? "justify-center text-center"
                : activeIdTemplate.logoPosition === "right"
                ? "flex-row-reverse justify-between"
                : "justify-between"
            }`}
            style={getCardHeaderBgStyle()}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {schoolLogo ? (
                <img src={cleanLogoUrl(schoolLogo)} alt="Logo" className={`w-5 h-5 ${isArchShape ? "rounded-full" : "rounded-md"} bg-white object-contain p-0.5 border shrink-0`} />
              ) : (
                <div className={`w-5 h-5 ${isArchShape ? "rounded-full" : "rounded-md"} font-black text-[8px] flex items-center justify-center shrink-0`} style={{ backgroundColor: isLightTop ? tplColors.primaryColor : "#fff", color: isLightTop ? "#fff" : tplColors.primaryColor }}>
                  {(cleanSchoolName || "SC").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className={`font-black text-[10px] uppercase tracking-tight truncate max-w-[195px] ${arch.serifFont ? "font-serif" : ""}`} style={isLightTop ? { color: tplColors.primaryColor } : { color: tplColors.headerTextColor }}>
                  {schoolDetails.schoolName}
                </h3>
                {showSchoolDetail("affiliation") && (schoolDetails.affiliation || schoolDetails.tagline) && (
                  <p className="text-[6px] opacity-80 truncate max-w-[195px]">{schoolDetails.affiliation || schoolDetails.tagline}</p>
                )}
              </div>
            </div>
            {activeIdTemplate.logoPosition !== "center" && (
              <span
                className={`px-1.5 py-0.5 text-[6.5px] font-black uppercase shrink-0 ${arch.pillBadges ? "rounded-full" : arch.skewBadge ? "-skew-x-12" : "rounded-xs"}`}
                style={cardBadgeStyle}
              >
                {idRoleBadge}
              </span>
            )}
          </div>

          {/* Body Architecture */}
          {isLandscape ? (
            <div className={`px-2.5 py-1.5 flex-1 flex items-center justify-between gap-2 bg-white relative z-10 min-h-0 ${isMinimalGrid ? "divide-x divide-slate-200" : ""}`}>
              <div className={`shrink-0 flex flex-col items-center ${variant === "modern_floating" ? "-mt-3" : ""}`}>
                <div
                  className={`${showBigHeroPhoto ? "w-[70px] h-[86px]" : "w-[58px] h-[72px]"} ${variant === "modern_floating" ? "rounded-2xl shadow-md" : variant === "cbse_board" || variant === "checker_ledger_grid" ? "rounded-xs" : "rounded-lg"} border-2 overflow-hidden bg-slate-100 flex items-center justify-center`}
                  style={{ borderColor: tplColors.primaryColor }}
                >
                  {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-slate-400" />}
                </div>
              </div>

              <div className={`flex-1 min-w-0 ${isMinimalGrid ? "pl-2" : ""}`}>
                <h4 className="font-black text-[11px] text-slate-900 truncate">{item.name}</h4>
                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                  <span className={`text-[7px] font-black px-1.5 py-0.2 ${variant === "modern_floating" || variant === "corporate_badge_card" ? "rounded-full" : "rounded-xs"}`} style={cardBadgeStyle}>{subClassLabel}</span>
                  {fieldSettings.showBloodGroup && item.bloodGroup && <span className="text-[7px] font-black px-1 rounded bg-rose-50 text-rose-700 border border-rose-200">{item.bloodGroup}</span>}
                </div>
                {renderDetailsLines(true)}
              </div>

              <div className={`shrink-0 flex flex-col items-center justify-center ${isMinimalGrid ? "pl-2" : ""}`}>
                <div className="p-0.5 bg-white border rounded" style={{ borderColor: tplColors.borderColor }}><QRCode value={qrVerifyUrl} size={58} level="L" /></div>
                <span className="text-[5.5px] font-mono font-bold text-slate-500 mt-0.5">{item.admissionNo || item.rollNo || "ID"}</span>
              </div>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-between bg-white relative z-10 min-h-0">
              <div className={`flex ${showBigHeroPhoto ? "flex-col items-center gap-1" : "items-center justify-between gap-2"} ${variant === "modern_floating" ? "-mt-3" : ""}`}>
                <div
                  className={`${showBigHeroPhoto ? "w-[82px] h-[94px]" : "w-[66px] h-[78px]"} ${variant === "modern_floating" ? "rounded-2xl shadow-md" : "rounded-lg"} border-2 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0`}
                  style={{ borderColor: tplColors.primaryColor }}
                >
                  {item.photoUrl ? <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-slate-400" />}
                </div>
                {!showBigHeroPhoto && (
                  <div className="p-1 bg-white border rounded shrink-0" style={{ borderColor: tplColors.borderColor }}><QRCode value={qrVerifyUrl} size={58} level="L" /></div>
                )}
              </div>

              <div className="px-2 py-1 rounded-lg border text-center my-0.5" style={{ backgroundColor: tplColors.surfaceTint, borderColor: tplColors.borderColor + "40" }}>
                <h4 className="font-black text-[11px] text-slate-900 truncate">{item.name}</h4>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="px-2 py-0.2 rounded-full text-[7.5px] font-black" style={cardBadgeStyle}>{subClassLabel}</span>
                  {fieldSettings.showBloodGroup && item.bloodGroup && <span className="px-1.5 py-0.2 rounded text-[7px] font-black bg-rose-50 text-rose-700 border border-rose-200">{item.bloodGroup}</span>}
                </div>
              </div>

              <div className="flex items-end justify-between gap-2 flex-1 min-h-0">
                <div className="flex-1 min-w-0">{renderDetailsLines(false)}</div>
                {showBigHeroPhoto && (
                  <div className="p-0.5 bg-white border rounded shrink-0" style={{ borderColor: tplColors.borderColor }}><QRCode value={qrVerifyUrl} size={46} level="L" /></div>
                )}
              </div>
            </div>
          )}

          {/* Passport MRZ Strip */}
          {isPassport && (
            <div className="px-2 py-0.5 bg-slate-900 text-emerald-300 font-mono text-[5.5px] tracking-widest truncate">
              ID&lt;IND&lt;{(item.name || "STUDENT").toUpperCase().replace(/\s+/g, "&lt;")}&lt;&lt;{item.admissionNo || item.rollNo || "01"}
            </div>
          )}

          {isBottomDock ? (
            <div
              className="px-2 py-1 flex items-center justify-between text-[6px] font-black mt-auto"
              style={{ backgroundColor: tplColors.primaryColor, color: tplColors.headerTextColor }}
            >
              <span>{schoolDetails.phone || cleanSessionLabel}</span>
              <span>{resolvedSignatoryTitle}</span>
            </div>
          ) : (
            renderFooterStrip()
          )}
          {isTricolor && (
            <div className="h-1 w-full flex shrink-0 relative z-10">
              <div className="flex-1 bg-orange-500" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-emerald-600" />
            </div>
          )}
          </div>
          {isDualRails && <div className="w-2.5 shrink-0" style={{ background: `linear-gradient(180deg, ${tplColors.accentColor}, ${tplColors.primaryColor})` }} />}
        </div>
      );
    }

    if (isLandscape) {
      // ──────────────────────────────────────────────────────────────────────────
      // LANDSCAPE CR80 ID CARD (85.6mm x 54mm)
      // STANDARD IDENTITY LAYOUT:
      // - Student Photo on the LEFT (Face noticed first)
      // - Full Student Details in the CENTER (No Adm No truncation, no duplicate Blood Group)
      // - Scannable Attendance QR on the RIGHT (Balanced size with crisp quiet-zone)
      // ──────────────────────────────────────────────────────────────────────────
      return (
        <div
          key={item.id}
          className={`w-[350px] min-h-[220px] max-h-[220px] bg-white rounded-xl shadow-lg ${useCustomTpl ? "" : `border-2 ${currentTheme.border}`} flex flex-col relative print-card-box print:w-[85.6mm] print:h-[54mm] print:min-h-[54mm] print:max-h-[54mm] print:shadow-none print:m-1.5 print:break-inside-avoid print:inline-block overflow-hidden`}
          style={cardContainerStyle}
        >
          {renderWatermarkOverlay()}
          {/* Top School Brand Header */}
          <div
            className={`${useCustomTpl ? "" : `${currentTheme.headerBg} text-white`} px-2.5 py-1 flex items-center justify-between shrink-0 relative z-10 ${useCustomTpl && activeIdTemplate.logoPosition === "right" ? "flex-row-reverse" : ""}`}
            style={cardHeaderStyle}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {getSavedSchoolLogo(schoolDetails.logoUrl, school?.id) ? (
                <img
                  src={cleanLogoUrl(getSavedSchoolLogo(schoolDetails.logoUrl, school?.id))}
                  alt="School Logo"
                  className="w-5 h-5 rounded-full bg-white object-contain p-0.5 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const fb = (e.target as HTMLElement).parentElement?.querySelector('.id-h-logo-fallback') as HTMLElement;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-5 h-5 rounded-full bg-white/20 items-center justify-center font-black text-[8.5px] text-white shrink-0 id-h-logo-fallback ${getSavedSchoolLogo(schoolDetails.logoUrl, school?.id) ? 'hidden' : 'flex'}`}>
                {(schoolDetails.schoolName || "SC").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                {showSchoolDetail("schoolName") && <h3 className="font-black text-[10.5px] tracking-tight truncate max-w-[205px]" style={useCustomTpl ? { color: tplColors.headerTextColor } : undefined}>{schoolDetails.schoolName}</h3>}
                {showSchoolDetail("affiliation") && (schoolDetails.affiliation || schoolDetails.tagline) && (
                  <p className={`text-[6.5px] truncate max-w-[205px] ${useCustomTpl ? "opacity-85" : "text-indigo-100"}`}>
                    {(schoolDetails.affiliation || schoolDetails.tagline).replace(/affiliation\s*code/gi, "School Code")}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`inline-block px-1.5 py-0.5 rounded-sm ${useCustomTpl ? "" : "bg-amber-400 text-slate-950"} text-[7px] font-black uppercase tracking-wider`}
                style={cardBadgeStyle}
              >
                {isStaff ? "STAFF ID" : "STUDENT ID"}
              </span>
              <p className={`text-[6.5px] font-bold mt-0.5 text-right ${useCustomTpl ? "opacity-90" : "text-amber-200"}`}>{cleanSessionLabel}</p>
            </div>
          </div>

          {/* Body: 3-Column Standard Layout (1. Photo LEFT, 2. Info CENTER, 3. Attendance QR RIGHT) */}
          <div className="px-2.5 py-1.5 flex-1 flex items-center justify-between gap-2 bg-white">
            {/* 1. LEFT COLUMN: Student Photo (Primary Face Recognition on Left) */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="w-[62px] h-[78px] rounded-lg border-2 border-slate-300 overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center shadow-xs">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                    <User className="w-7 h-7" />
                    <span className="text-[6.5px] text-slate-400 mt-0.5 font-bold">Photo</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. CENTER COLUMN: Clean Student Details (Full Adm No, Single Blood Badge) */}
            <div className="flex-1 min-w-0 text-[9px] leading-tight space-y-0.5">
              <div className="border-b border-slate-100 pb-0.5">
                <h4 className="font-black text-[11.5px] text-slate-900 truncate">{item.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span
                    className={`text-[7.5px] font-black px-1.5 py-0.2 rounded-full ${useCustomTpl ? "" : currentTheme.badge} uppercase tracking-wider`}
                    style={cardBadgeStyle}
                  >
                    {isStaff ? item.designation : className}
                  </span>
                  {fieldSettings.showBloodGroup && item.bloodGroup && (
                    <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      {item.bloodGroup}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[8px] text-slate-700 pt-0.5">
                {!isStaff ? (
                  <>
                    {fieldSettings.showRollNo && (
                      <p className="whitespace-nowrap">
                        <strong className="text-slate-400 font-bold">Roll:</strong>{" "}
                        <span className="font-black text-slate-900">#{item.rollNo || "—"}</span>
                      </p>
                    )}
                    {fieldSettings.showDateOfBirth && item.dateOfBirth && (
                      <p className="truncate">
                        <strong className="text-slate-400 font-bold">DOB:</strong>{" "}
                        <span className="font-semibold text-slate-800">{item.dateOfBirth}</span>
                      </p>
                    )}
                    {fieldSettings.showAdmissionNo && (
                      <p className="col-span-2 whitespace-nowrap text-[7.8px] leading-tight">
                        <strong className="text-slate-400 font-bold">Adm:</strong>{" "}
                        <span className="font-mono font-black text-slate-900 tracking-tight">{item.admissionNo || "—"}</span>
                      </p>
                    )}
                    {fieldSettings.showFatherName && (
                      <p className="col-span-2 truncate">
                        <strong className="text-slate-400 font-bold">Father:</strong>{" "}
                        <span className="font-semibold text-slate-800">{item.fatherName || "—"}</span>
                      </p>
                    )}
                    {fieldSettings.showPhone && (
                      <p className="col-span-2 truncate">
                        <strong className="text-slate-400 font-bold">Mobile:</strong>{" "}
                        <span className="font-semibold text-slate-800">{item.phone || "—"}</span>
                      </p>
                    )}
                    {fieldSettings.showMotherName && item.motherName && (
                      <p className="col-span-2 truncate"><strong className="text-slate-400 font-bold">Mother:</strong>{" "}{item.motherName}</p>
                    )}
                    {fieldSettings.showStudentAddress && item.address && (
                      <p className="col-span-2 truncate"><strong className="text-slate-400 font-bold">Addr:</strong>{" "}{item.address}</p>
                    )}
                    {fieldSettings.showStudentEmail && item.email && (
                      <p className="col-span-2 truncate"><strong className="text-slate-400 font-bold">Email:</strong>{" "}{item.email}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="col-span-2 whitespace-nowrap">
                      <strong className="text-slate-400 font-bold">Emp ID:</strong>{" "}
                      <span className="font-mono font-black text-slate-900">{item.employeeId || item.id.slice(0, 6).toUpperCase()}</span>
                    </p>
                    <p className="col-span-2 truncate">
                      <strong className="text-slate-400 font-bold">Dept:</strong>{" "}
                      <span className="font-bold text-slate-800">{item.department || "Academic"}</span>
                    </p>
                    <p className="col-span-2 truncate">
                      <strong className="text-slate-400 font-bold">Contact:</strong>{" "}
                      <span className="font-medium text-slate-800">{item.phone || "—"}</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* 3. RIGHT COLUMN: High-Contrast Attendance QR Code (Balanced ~22% width, Fast Scan) */}
            <div className="flex flex-col items-center justify-center shrink-0 w-[78px]">
              <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center justify-center">
                <QRCode value={qrVerifyUrl} size={66} level="L" />
              </div>
              <span className="text-[6px] font-black text-slate-600 uppercase tracking-tighter mt-0.5 flex items-center gap-0.5 whitespace-nowrap">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 inline shrink-0" /> Scan ID
              </span>
              <span className="text-[5.8px] text-slate-600 font-mono font-bold whitespace-nowrap">
                {item.admissionNo || item.rollNo || item.id.slice(0, 6)}
              </span>
            </div>
          </div>

          {/* Bottom Card Footer: School Office Helpline & Principal Signatory (No Personal Phones) */}
          <div
            className="px-2.5 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-[6px] text-slate-600 shrink-0 relative z-10"
            style={useCustomTpl ? { backgroundColor: tplColors.surfaceTint, borderColor: tplColors.borderColor + "40" } : undefined}
          >
            <div className="min-w-0 flex-1 leading-tight break-words">
              {showSchoolDetail("address") && schoolDetails.address && <span className="font-bold text-slate-700">{schoolDetails.address}</span>}
              {showSchoolDetail("phone") && schoolDetails.phone && <span className="ml-1 text-slate-600 font-semibold">• Helpline: {schoolDetails.phone}</span>}
              {showSchoolDetail("email") && schoolDetails.email && <span className="ml-1 text-slate-500">• {schoolDetails.email}</span>}
              {showSchoolDetail("code") && getVisibleSchoolRegNo(school, schoolDetails.code) && <span className="ml-1 text-slate-500">• Reg. No: {getVisibleSchoolRegNo(school, schoolDetails.code)}</span>}
              {customSchoolDetails && <span className="ml-1 text-slate-500">• {customSchoolDetails}</span>}
              {useCustomTpl && activeIdTemplate.footerNote && <span className="ml-1 font-semibold text-slate-700">• {activeIdTemplate.footerNote}</span>}
            </div>
            <div className="text-right shrink-0 flex flex-col items-end justify-end">
              {schoolDetails.principalSignatureUrl ? (
                <img
                  src={schoolDetails.principalSignatureUrl}
                  alt="Principal Signature"
                  className="h-4 max-w-[65px] object-contain block mb-0.5"
                />
              ) : (
                showSchoolDetail("principalName") && schoolDetails.principalName ? (
                  <span className="font-serif italic font-bold text-slate-900 text-[7px] block leading-none mb-0.5">
                    {schoolDetails.principalName}
                  </span>
                ) : null
              )}
              <p className="text-[6px] font-black uppercase tracking-wider text-slate-700">{resolvedSignatoryTitle}</p>
            </div>
          </div>
        </div>
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PORTRAIT CR80 ID CARD (54mm x 85.6mm)
    // STANDARD IDENTITY LAYOUT:
    // - Top header with Lanyard slot & school details
    // - Student Photo on the LEFT & Scannable Attendance QR on the RIGHT
    // - Center Details (Full Admission No, Single Blood Badge)
    // - Bottom School Helpline & Principal Signature (No Personal Phones)
    // ──────────────────────────────────────────────────────────────────────────
    return (
      <div
        key={item.id}
        className={`w-[260px] min-h-[390px] max-h-[390px] bg-white rounded-2xl shadow-xl ${useCustomTpl ? "" : `border-2 ${currentTheme.border}`} flex flex-col relative print-card-box print:w-[54mm] print:h-[85.6mm] print:min-h-[85.6mm] print:max-h-[85.6mm] print:shadow-none print:m-1.5 print:break-inside-avoid print:inline-block overflow-hidden`}
        style={cardContainerStyle}
      >
        {renderWatermarkOverlay()}
        {/* Lanyard Hole Guide */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-full bg-white/40 z-20 print:border print:border-slate-300"></div>

        {/* Header with School Branding */}
        <div
          className={`${useCustomTpl ? "" : `${currentTheme.headerBg} text-white`} pt-3 pb-1.5 px-2 text-center relative shrink-0 z-10`}
          style={cardHeaderStyle}
        >
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            {getSavedSchoolLogo(schoolDetails.logoUrl, school?.id) ? (
              <img
                src={cleanLogoUrl(getSavedSchoolLogo(schoolDetails.logoUrl, school?.id))}
                alt="School Logo"
                className="w-5 h-5 rounded-full bg-white p-0.5 object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fb = (e.target as HTMLElement).parentElement?.querySelector('.id-logo-fallback') as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div className={`w-5 h-5 rounded-full bg-white/20 items-center justify-center font-black text-[8px] text-white shrink-0 id-logo-fallback ${getSavedSchoolLogo(schoolDetails.logoUrl, school?.id) ? 'hidden' : 'flex'}`}>
              {(schoolDetails.schoolName || "SC").slice(0, 2).toUpperCase()}
            </div>
            {showSchoolDetail("schoolName") && <h3 className="font-black text-[11px] tracking-tight leading-tight line-clamp-1">{schoolDetails.schoolName}</h3>}
          </div>
          {showSchoolDetail("affiliation") && (schoolDetails.affiliation || schoolDetails.tagline) && (
            <p className={`text-[6.5px] truncate mb-1 ${useCustomTpl ? "opacity-85" : "text-indigo-100"}`}>
              {(schoolDetails.affiliation || schoolDetails.tagline).replace(/affiliation\s*code/gi, "School Code")}
            </p>
          )}
          <div
            className={`inline-block px-2 py-0.2 rounded-full ${useCustomTpl ? "" : "bg-amber-400 text-slate-950"} text-[7px] font-black uppercase tracking-widest`}
            style={cardBadgeStyle}
          >
            {isStaff ? "STAFF ID CARD" : "STUDENT ID CARD"} • {cleanSessionLabel}
          </div>
        </div>

        {/* Identity Row: Student Photo on the LEFT and Attendance QR on the RIGHT */}
        <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-2 shrink-0 bg-white">
          {/* Student Photo on LEFT */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="w-[68px] h-[80px] rounded-xl border-2 border-slate-300 overflow-hidden shadow-xs bg-slate-50 flex items-center justify-center">
              {item.photoUrl ? (
                <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
                  <User className="w-8 h-8" />
                  <span className="text-[6.5px] text-slate-400 mt-0.5 font-bold">No Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Scannable Attendance QR on RIGHT */}
          <div className="flex flex-col items-center justify-center shrink-0 w-[76px]">
            <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center justify-center">
              <QRCode value={qrVerifyUrl} size={62} level="L" />
            </div>
            <span className="text-[6.5px] text-slate-600 font-black uppercase tracking-tighter mt-0.5">
              Scan ID
            </span>
            <span className="text-[6px] text-slate-600 font-mono font-bold whitespace-nowrap">
              {item.admissionNo || item.rollNo || item.id.slice(0, 6)}
            </span>
          </div>
        </div>

        {/* Student Name & Designation Band */}
        <div
          className="px-3 py-1 text-center bg-slate-50/70 border-y border-slate-100 shrink-0 relative z-10"
          style={useCustomTpl ? { backgroundColor: tplColors.surfaceTint, borderColor: tplColors.borderColor + "40" } : undefined}
        >
          <h2 className="text-xs font-black text-slate-900 leading-tight truncate">
            {item.name}
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span
              className={`text-[8.5px] font-black px-2 py-0.2 rounded-full ${useCustomTpl ? "" : currentTheme.badge}`}
              style={cardBadgeStyle}
            >
              {isStaff ? item.designation : className}
            </span>
            {fieldSettings.showBloodGroup && item.bloodGroup && (
              <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {item.bloodGroup}
              </span>
            )}
          </div>
        </div>

        {/* Auto-Placed Details Table (Full Admission No, No Duplicate Blood Row) */}
        <div className="px-3 py-1 flex-1 text-[8.5px] text-slate-700 space-y-0.5 leading-tight overflow-hidden">
          {!isStaff ? (
            <>
              {fieldSettings.showRollNo && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 font-bold">Roll No:</span>
                  <span className="font-black text-slate-900">{item.rollNo || "—"}</span>
                </div>
              )}
              {fieldSettings.showAdmissionNo && (
                <div className="flex justify-between gap-1 border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 font-bold shrink-0">Adm No:</span>
                  <span className="font-mono font-black text-slate-900 whitespace-nowrap">{item.admissionNo || "—"}</span>
                </div>
              )}
              {fieldSettings.showFatherName && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 font-bold">Father's Name:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[125px]">{item.fatherName || "—"}</span>
                </div>
              )}
              {fieldSettings.showPhone && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="text-slate-400 font-bold">Mobile:</span>
                  <span className="font-bold text-slate-800">{item.phone || "—"}</span>
                </div>
              )}
              {fieldSettings.showMotherName && item.motherName && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span className="text-slate-400 font-bold">Mother's Name:</span><span className="font-bold text-slate-800 truncate max-w-[125px]">{item.motherName}</span></div>
              )}
              {fieldSettings.showDateOfBirth && item.dateOfBirth && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span className="text-slate-400 font-bold">Date of Birth:</span><span className="font-bold text-slate-800">{item.dateOfBirth}</span></div>
              )}
              {fieldSettings.showStudentAddress && item.address && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span className="text-slate-400 font-bold">Address:</span><span className="font-bold text-slate-800 truncate max-w-[125px]">{item.address}</span></div>
              )}
              {fieldSettings.showStudentEmail && item.email && (
                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span className="text-slate-400 font-bold">Email:</span><span className="font-bold text-slate-800 truncate max-w-[125px]">{item.email}</span></div>
              )}
              {fieldSettings.showSession && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Academic Session:</span>
                  <span className="font-black text-emerald-700">{cleanSessionLabel}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between border-b border-slate-100 pb-0.5">
                <span className="text-slate-400 font-bold">Emp ID:</span>
                <span className="font-mono font-black text-slate-900">{item.employeeId || item.id.slice(0, 6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-0.5">
                <span className="text-slate-400 font-bold">Department:</span>
                <span className="font-bold text-slate-800">{item.department || "Academic"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-0.5">
                <span className="text-slate-400 font-bold">Contact:</span>
                <span className="font-bold text-slate-800">{item.phone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Valid Till:</span>
                <span className="font-black text-emerald-700">{cleanSessionLabel}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer: Campus Address, Office Helpline & Principal Signature (No Personal Phones) */}
        <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[7px] text-slate-600 shrink-0 mt-auto">
          <div className="min-w-0 flex-1 text-[6px] leading-tight break-words space-y-0.5">
            {showSchoolDetail("address") && schoolDetails.address && <span className="font-bold text-slate-700 truncate block">{schoolDetails.address}</span>}
            {showSchoolDetail("phone") && schoolDetails.phone && <span className="text-slate-600 font-semibold text-[6px] block">Helpline: {schoolDetails.phone}</span>}
            {showSchoolDetail("email") && schoolDetails.email && <span className="text-slate-500 text-[6px] block">{schoolDetails.email}</span>}
            {showSchoolDetail("code") && getVisibleSchoolRegNo(school, schoolDetails.code) && <span className="text-slate-500 text-[6px]">Reg. No: {getVisibleSchoolRegNo(school, schoolDetails.code)}</span>}
            {customSchoolDetails && <span className="text-slate-500 text-[6px] block truncate">{customSchoolDetails}</span>}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end justify-end">
            {schoolDetails.principalSignatureUrl ? (
              <img
                src={schoolDetails.principalSignatureUrl}
                alt="Principal Signature"
                className="h-4.5 max-w-[70px] object-contain block mb-0.5"
              />
            ) : (
              showSchoolDetail("principalName") && schoolDetails.principalName ? (
                <span className="font-serif italic font-black text-slate-900 text-[7px] block leading-none mb-0.5">{schoolDetails.principalName}</span>
              ) : null
            )}
            {fieldSettings.showSignatory && <span className="text-[6px] font-black text-slate-700 uppercase tracking-wider">{resolvedSignatoryTitle}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-16 print:min-h-0 print:pb-0 print:bg-white">
      {/* Print Safe CSS: prevents clipping, keeps QR code & student picture within page margins */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 5mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden, .print\\:hidden {
            display: none !important;
          }
          .print-card-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            margin: 0 !important;
            display: inline-block !important;
            transform-origin: center center !important;
          }
          .idcard-page {
            width: 100% !important;
            max-width: 198mm !important;
            height: auto !important;
            max-height: none !important;
            padding: 2mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(${cardsPerPage === 4 ? 2 : 4}, auto) !important;
            gap: 3mm !important;
            align-items: center !important;
            justify-items: center !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .idcard-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .idcard-print-cell {
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .idcard-print-cell .print-card-box {
            transform: scale(${cardsPerPage === 8 && cardOrientation === "portrait" ? 0.78 : 1}) !important;
          }
          #pre-react-splash {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Navbar (Compact Premium 2-Tier Mobile-First Header) */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2.5 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 shadow-xs sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-black transition cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-xs sm:text-sm font-black tracking-tight truncate">
                QR ID Card Studio
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowTemplateStudio(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition cursor-pointer shrink-0"
                title="10 Auto-Build Templates + Custom Designer + Colors Badlein"
              >
                <Palette className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Templates (10+)</span>
                <span className="sm:hidden">Templates</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition cursor-pointer shrink-0"
              >
                {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadingPdf ? "PDF..." : "Download PDF"}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition cursor-pointer shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Compact 4-Button Action Strip (Always 1 Row) */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setShowQuickSchoolEditor(!showQuickSchoolEditor)}
              className={`px-1.5 py-1.5 rounded-xl text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer min-w-0 ${
                showQuickSchoolEditor
                  ? "bg-amber-400/20 text-amber-800 dark:text-amber-300 border-amber-400 shadow-2xs"
                  : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
              title="School Details Likhein"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
              <span className="truncate">Details</span>
              {showQuickSchoolEditor ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />}
            </button>

            <button
              type="button"
              onClick={() => setShowAutoMappingOptions(!showAutoMappingOptions)}
              className={`px-1.5 py-1.5 rounded-xl text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer min-w-0 ${
                showAutoMappingOptions || autoDataMapping
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                  : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
              title="Card mein data automatically sahi jagah fit ho jata hai"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">Auto-Fit</span>
            </button>

            <button
              type="button"
              onClick={() => setCardOrientation(prev => prev === "landscape" ? "portrait" : "landscape")}
              className="px-1.5 py-1.5 rounded-xl text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700/60 transition-all cursor-pointer min-w-0"
              title="Card shape badlein (CR80)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{cardOrientation === "landscape" ? "Landscape" : "Portrait"}</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkMode(!bulkMode)}
              className={`px-1.5 py-1.5 rounded-xl text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer min-w-0 ${
                bulkMode
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
              title="Bulk Sheet ya Single Card Mode"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{bulkMode ? "Single" : "Bulk Sheet"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 py-5 print:p-0">
        {/* Success toast notification */}
        {saveSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow print:hidden animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* 1. Quick School Details Inline Editor Drawer */}
        {showQuickSchoolEditor && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-lg border border-indigo-200 dark:border-indigo-900 mb-6 print:hidden animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    School Details Likhne Ka Form (Live Card Updates)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Yahan se school details likhein, card me sabhi jagah apne aap fit ho jayenge.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSchoolHeaderModal(true)}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" /> Full Modal
                </button>
                <button
                  onClick={handleSaveSchoolDefaults}
                  disabled={savingDefault}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs"
                >
                  <Save className="w-3 h-3" /> {savingDefault ? "Saving..." : "Save Default"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  School Ka Naam *
                </label>
                <input
                  type="text"
                  value={schoolDetails.schoolName}
                  onChange={e => setSchoolDetails(p => ({ ...p, schoolName: e.target.value }))}
                  placeholder="e.g. National Academy"
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Tagline / Board Line
                </label>
                <input
                  type="text"
                  value={schoolDetails.affiliation}
                  onChange={e => setSchoolDetails(p => ({ ...p, affiliation: e.target.value }))}
                  placeholder="e.g. Affiliated to CBSE / State Board"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  School Code / Reg No
                </label>
                <input
                  type="text"
                  value={schoolDetails.code}
                  onChange={e => setSchoolDetails(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. SCH-001"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Academic Session (Year)
                </label>
                <input
                  type="text"
                  value={schoolDetails.session}
                  onChange={e => setSchoolDetails(p => ({ ...p, session: e.target.value }))}
                  placeholder="e.g. 2026-27"
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  School Address (Print footer me aayega)
                </label>
                <input
                  type="text"
                  value={schoolDetails.address}
                  onChange={e => setSchoolDetails(p => ({ ...p, address: e.target.value }))}
                  placeholder="e.g. Dharaka Market, Affour, Nagra, Saran (Bihar)"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Helpline / Mobile Number
                </label>
                <input
                  type="text"
                  value={schoolDetails.phone}
                  onChange={e => setSchoolDetails(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Principal / Head Signatory Name
                </label>
                <input
                  type="text"
                  value={schoolDetails.principalName}
                  onChange={e => setSchoolDetails(p => ({ ...p, principalName: e.target.value }))}
                  placeholder="e.g. Dr. Rajeshwar Sharma"
                  className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Logo direct upload */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">School Logo:</span>
                <DirectUploadButton
                  kind="image"
                  compact
                  currentUrl={schoolDetails.logoUrl}
                  onUploaded={url => {
                    const cleaned = cleanLogoUrl(url);
                    setSchoolDetails(p => ({ ...p, logoUrl: cleaned }));
                    if (cleaned && !isAppLogo(cleaned) && typeof localStorage !== 'undefined') {
                      localStorage.setItem("nst_active_school_logo", cleaned);
                      localStorage.setItem("nst_school_logo", cleaned);
                    }
                    if (school?.id) {
                      updateSchool(school.id, { logoUrl: cleaned }).catch(() => {});
                    }
                  }}
                  onClear={() => {
                    setSchoolDetails(p => ({ ...p, logoUrl: "" }));
                    if (typeof localStorage !== 'undefined') {
                      localStorage.removeItem("nst_active_school_logo");
                      localStorage.removeItem("nst_school_logo");
                    }
                    if (school?.id) {
                      updateSchool(school.id, { logoUrl: "" }).catch(() => {});
                    }
                  }}
                  label="Upload School Logo"
                />
                {schoolDetails.logoUrl && !isAppLogo(schoolDetails.logoUrl) && (
                  <img src={cleanLogoUrl(schoolDetails.logoUrl)} alt="Logo preview" className="w-6 h-6 rounded-full object-contain p-0.5 bg-white border border-slate-300" />
                )}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Ye details sabhi cards pe live reflect ho rahi hain!
              </p>
            </div>
          </div>
        )}

        {/* 2. Auto-Data Mapping Customizer Drawer */}
        {showAutoMappingOptions && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-4 border border-emerald-300 dark:border-emerald-800 mb-6 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                  ⚡ Smart Auto-Data Mapping (Apne Aap Fit Hone Ka Option)
                </h4>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDataMapping}
                  onChange={e => setAutoDataMapping(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                  Auto-Placement Enable Rakhein
                </span>
              </label>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mb-3">
              Jab ye option active hota hai, har student ka <strong>Photo LEFT me</strong>, <strong>pura Admission No + Details CENTER me</strong> aur <strong>Attendance QR Code RIGHT me</strong> automatically map ho jata hai!
            </p>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-900">
              {Object.entries({
                showRollNo: "Roll Number",
                showAdmissionNo: "Admission Number",
                showFatherName: "Father's Name",
                showMotherName: "Mother's Name",
                showPhone: "Mobile / Phone",
                showBloodGroup: "Blood Group",
                showDateOfBirth: "Date of Birth",
                showStudentAddress: "Student Address",
                showStudentEmail: "Student Email",
                showSession: "Academic Session",
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs">
                  <input
                    type="checkbox"
                    checked={fieldSettings[key as keyof typeof fieldSettings]}
                    onChange={e => updateCardFieldSetting(key as keyof typeof fieldSettings, e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Controls Card (Compact & Premium Redesign) */}
        <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-sm mb-4 space-y-3 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </span>
                <span>QR Code ID Card Generator</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Standard layout: Photo Left • Attendance QR Right
              </p>
            </div>

            {/* Segmented Tab Switcher: Students vs Staff */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900/70 rounded-xl border border-slate-200/70 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => { setActiveTab("students"); setSelectedIds([]); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate ${
                  activeTab === "students"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Students ({students.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("staff"); setSelectedIds([]); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer truncate ${
                  activeTab === "staff"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Staff ({unifiedStaff.length})
              </button>
            </div>
          </div>

          {/* Theme Swatches (Single Compact Row) */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/80 space-y-2.5">
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { id: "modern_indigo", label: "Indigo", dot: "bg-indigo-600" },
                { id: "royal_maroon", label: "Maroon", dot: "bg-rose-800" },
                { id: "golden_dark", label: "Gold", dot: "bg-amber-500" },
                { id: "emerald_green", label: "Emerald", dot: "bg-emerald-600" },
              ] as { id: CardTheme; label: string; dot: string }[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer min-w-0 ${
                    theme === t.id
                      ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 ring-1 ring-indigo-500/40 shadow-2xs font-black"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.dot}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>

            {/* Clean Responsive Class Filter + Add Student + Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {activeTab === "students" && (
                <div className="grid grid-cols-[1fr_auto] gap-1.5 sm:w-auto shrink-0">
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full sm:w-36 px-2.5 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-900/80 text-slate-800 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">Sabhi Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-xs active:scale-95 transition cursor-pointer whitespace-nowrap"
                    title="Naya student turant add karein"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>+ Student</span>
                  </button>
                </div>
              )}

              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name, roll, adm..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-900/80 text-slate-800 dark:text-white placeholder:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Compact Layout Safety Notice */}
        <div className="mb-4 px-3 py-2 bg-indigo-50/80 dark:bg-indigo-950/35 border border-indigo-200/80 dark:border-indigo-800/70 rounded-xl flex items-center justify-between gap-2 text-[11px] text-indigo-900 dark:text-indigo-200 print:hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate font-semibold">
              Photo Left • Adm No Center • Attendance QR Right
            </span>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 shrink-0 tracking-wide">
            {cardOrientation.toUpperCase()} CR80
          </span>
        </div>

        {/* Bulk Mode View vs Single Live Preview */}
        {bulkMode ? (
          <div>
            {/* Bulk Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm mb-4 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  {selectedIds.length === currentList.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selectedIds.length === currentList.length ? "Deselect All" : "Select All"} ({currentList.length})
                </button>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {selectedIds.length > 0 ? `${selectedIds.length} ready` : "Cards select karein"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={cardsPerPage}
                  onChange={event => setCardsPerPage(Number(event.target.value) as 4 | 8)}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
                >
                  <option value={4}>4 / page · Large</option>
                  <option value={8}>8 / page · Standard</option>
                </select>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf || currentList.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow flex items-center gap-1.5 cursor-pointer"
                >
                  {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{downloadingPdf ? "Saving PDF..." : `Download PDF (${selectedIds.length || currentList.length})`}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={currentList.length === 0}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print ({selectedIds.length || currentList.length})
                </button>
              </div>
            </div>

            {/* A4 Sheet Print Grid with Cut Guides */}
            {(() => {
              const printItems = selectedIds.length > 0
                ? currentList.filter(item => selectedIds.includes(item.id))
                : currentList;
              const pages = Array.from({ length: Math.ceil(printItems.length / cardsPerPage) }, (_, pageIndex) =>
                printItems.slice(pageIndex * cardsPerPage, (pageIndex + 1) * cardsPerPage)
              );
              return (
                <div ref={printAreaRef} className="space-y-6 print:space-y-0">
                  {pages.map((pageItems, pageIndex) => (
                    <div key={`page-${pageIndex}`} className="idcard-page grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center print:gap-0">
                      {pageItems.map(item => (
                        <div key={item.id} className="idcard-print-cell relative group">
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 rounded-lg shadow text-indigo-600 hover:scale-110 transition-transform print:hidden"
                          >
                            {selectedIds.includes(item.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-slate-400" />}
                          </button>
                          {renderCard(item, activeTab === "staff")}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Single Card Live Studio */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Student/Staff Selector List */}
            <div className="md:col-span-5 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm space-y-2 max-h-[550px] overflow-y-auto print:hidden">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                Card Chunne ke liye click karein:
              </p>
              {currentList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Koi record nahi mila. Pehle student ya staff add karein.
                </div>
              ) : (
                currentList.map(item => {
                  const isSelected = activeTab === "students"
                    ? selectedStudent?.id === item.id
                    : selectedStaff?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => activeTab === "students" ? setSelectedStudent(item) : setSelectedStaff(item)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-900/30 shadow-sm"
                          : "border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 overflow-hidden">
                          {item.photoUrl ? (
                            <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            item.name.slice(0, 1)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-white text-sm">{item.name}</p>
                          <p className="text-xs text-slate-400">
                            {activeTab === "students" ? `Roll: #${item.rollNo || "—"} • Adm: ${item.admissionNo || "—"}` : item.designation}
                          </p>
                        </div>
                      </div>
                      <Eye className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-300"}`} />
                    </button>
                  );
                })
              )}
            </div>

            {/* Right Column: Live Printable Preview */}
            <div className="md:col-span-7 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 print:border-0 print:bg-white print:p-0 print:rounded-none">
              <div className="mb-4 text-center print:hidden flex items-center gap-2 flex-wrap justify-center">
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full uppercase tracking-wider">
                  Live Card Preview (CR80 Standard Dimensions)
                </span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  ✓ Photo: Left | Attendance QR: Right
                </span>
              </div>

              {(activeTab === "students" ? selectedStudent : selectedStaff) ? (
                <>
                  <div ref={singleCardRef} className="p-3 bg-white/70 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 print:border-0 print:bg-white print:p-0 print:rounded-none">
                    {renderCard(activeTab === "students" ? selectedStudent : selectedStaff, activeTab === "staff")}
                  </div>

                  <div className="mt-5 flex gap-3 print:hidden flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-transform cursor-pointer"
                    >
                      {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{downloadingPdf ? "Generating PDF..." : "Download PDF"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-transform cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Is Card ko Print Karein
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickSchoolEditor(true)}
                      className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-indigo-500" /> School Details Edit
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  Koi record select nahi hai.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSchoolHeaderModal && (
        <SchoolHeaderEditorModal
          isOpen={true}
          school={school}
          schoolId={school.id}
          currentDetails={schoolDetails}
          initialDetails={schoolDetails}
          onClose={() => setShowSchoolHeaderModal(false)}
          onApply={(updated) => setSchoolDetails(p => ({ ...p, ...updated }))}
          onSave={(updated) => setSchoolDetails(p => ({ ...p, ...updated }))}
        />
      )}

      {showAddStudentModal && (
        <QuickAddStudentModal
          schoolId={school.id}
          classes={classes}
          defaultClassId={selectedClassId === "all" ? classes[0]?.id : selectedClassId}
          onClose={() => setShowAddStudentModal(false)}
          onStudentAdded={(newStu) => {
            setStudents(prev => [newStu, ...prev]);
            setSelectedStudent(newStu);
          }}
        />
      )}

      {showTemplateStudio && (
        <DocumentTemplateStudioModal
          school={school}
          initialDocType="id_card"
          onClose={() => setShowTemplateStudio(false)}
          onTemplateApplied={() => setTemplateTick(t => t + 1)}
        />
      )}
    </div>
  );
};
