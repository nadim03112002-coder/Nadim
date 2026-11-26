// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import type { School, SchoolClass, SchoolStudent, SchoolSession } from "../../school-types";
import {
  FileText, Printer, ChevronLeft, Plus, Trash2, Calendar, Clock,
  CheckSquare, Square, Award, AlertCircle, Building2, Layers, Edit3, User, Shield, Sparkles, UserPlus, PenTool, Palette, Download, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { SchoolHeaderEditorModal, type SchoolHeaderDetails } from "./SchoolHeaderEditorModal";
import { QuickAddStudentModal } from "./QuickAddStudentModal";
import { TeacherSignatureModal } from "./TeacherSignatureModal";
import { updateSchool } from "../../school-firebase";
import { cleanLogoUrl, isAppLogo, getSavedSchoolLogo, getVisibleSchoolRegNo, formatAcademicSession } from "./feeReceiptUtils";
import { buildAdmitCardQrUrl } from "../../utils/qrVerifyUrl";
import { DocumentTemplateStudioModal } from "./DocumentTemplateStudioModal";
import { resolveActiveDocumentTemplate, DOCUMENT_TEMPLATE_EVENT, getLayoutArchitecture } from "../../utils/schoolDocumentTemplates";
import { printElementInIframe } from "./AdmissionFormPrintModal";
import { exportElementToPdf, exportMultiPageElementsToPdf } from "../../utils/universalPdfExport";

interface Props {
  school: School;
  classes: SchoolClass[];
  students: SchoolStudent[];
  activeSession: SchoolSession | null;
  onSchoolUpdated?: (updated: Partial<School>) => void;
  onBack: () => void;
}

export interface TimetableItem {
  id: string;
  subject: string;
  date: string;
  time: string;
  room?: string;
}

export const AdmitCardManager: React.FC<Props> = ({
  school,
  classes,
  students: initialStudents,
  activeSession,
  onSchoolUpdated,
  onBack,
}) => {
  const [studentList, setStudentList] = useState<SchoolStudent[]>(initialStudents);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const classStudents = studentList.filter(s => !selectedClassId || s.classId === selectedClassId);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(classStudents[0]?.id || studentList[0]?.id || "");
  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentStudent = classStudents.find(s => s.id === selectedStudentId) || classStudents[0] || null;

  // Modals state
  const [showSchoolHeaderModal, setShowSchoolHeaderModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showExamControllerSignModal, setShowExamControllerSignModal] = useState(false);
  const [showTemplateStudio, setShowTemplateStudio] = useState(false);
  const [templateTick, setTemplateTick] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setTemplateTick(t => t + 1);
    window.addEventListener(DOCUMENT_TEMPLATE_EVENT, handler);
    return () => window.removeEventListener(DOCUMENT_TEMPLATE_EVENT, handler);
  }, []);

  const activeAdmitTemplate = React.useMemo(
    () => resolveActiveDocumentTemplate(school?.id, school, "admit_card"),
    [school, templateTick]
  );
  const useCustomAdmitTpl = activeAdmitTemplate.id !== "default";

  // School Header Customization State
  const [schoolDetails, setSchoolDetails] = useState<SchoolHeaderDetails>({
    schoolName: school?.name || "National Academy",
    tagline: school?.tagline || "",
    affiliation: school?.affiliation || school?.tagline || "CBSE Pattern Curriculum",
    address: school?.address || "",
    phone: school?.mobile || school?.phone || "",
    email: school?.email || "",
    logoUrl: getSavedSchoolLogo(school?.logoUrl, school?.id),
    principalName: school?.principalName || "Principal",
    principalTitle: "Principal",
    code: getVisibleSchoolRegNo(school),
    principalSignatureUrl: school?.principalSignatureUrl || "",
    directorSignatureUrl: school?.directorSignatureUrl || "",
  });

  useEffect(() => {
    if (!school) return;
    setSchoolDetails(prev => ({
      ...prev,
      schoolName: school.name || prev.schoolName,
      tagline: school.tagline || prev.tagline,
      affiliation: school.affiliation || prev.affiliation,
      address: school.address || prev.address,
      phone: school.mobile || school.phone || prev.phone,
      email: school.email || prev.email,
      logoUrl: getSavedSchoolLogo(school.logoUrl || prev.logoUrl, school.id),
      principalName: school.principalName || prev.principalName,
      code: getVisibleSchoolRegNo(school),
      principalSignatureUrl: school.principalSignatureUrl || "",
      directorSignatureUrl: school.directorSignatureUrl || "",
    }));
    if (school.principalName) setPrincipalName(school.principalName);
  }, [school]);

  // Exam & Center Info
  const [examName, setExamName] = useState("Annual Examination 2026-27");
  const [sessionName, setSessionName] = useState(() => formatAcademicSession(activeSession?.name || "2026-27"));
  const [centerName, setCenterName] = useState(schoolDetails.schoolName + ", Main Campus Examination Hall");

  // Signatory & Authority
  const [examController, setExamController] = useState(school?.examControllerName || "Exam Controller");
  const [examControllerSignatureUrl, setExamControllerSignatureUrl] = useState(school?.examControllerSignatureUrl || "");
  const [centerSuperintendent, setCenterSuperintendent] = useState("Center Superintendent");
  const [principalTitle, setPrincipalTitle] = useState("Principal / Center Superintendent");
  const [principalName, setPrincipalName] = useState(school?.principalName || "Principal");

  useEffect(() => {
    if (!school) return;
    if (school.examControllerName) setExamController(school.examControllerName);
    if (school.examControllerSignatureUrl !== undefined) {
      setExamControllerSignatureUrl(school.examControllerSignatureUrl || "");
    }
  }, [school]);

  // Candidate Details Editable State (Allows overriding student details for print)
  const [candidateName, setCandidateName] = useState("");
  const [candidateRoll, setCandidateRoll] = useState("");
  const [candidateAdmNo, setCandidateAdmNo] = useState("");
  const [candidateFather, setCandidateFather] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [candidatePhoto, setCandidatePhoto] = useState("");
  const [candidateClass, setCandidateClass] = useState("");

  // Sync candidate fields when student or class changes
  const syncFromCurrentStudent = () => {
    if (currentStudent) {
      setCandidateName(currentStudent.name || "");
      setCandidateRoll(currentStudent.rollNo || "101");
      setCandidateAdmNo(currentStudent.admissionNo || "ADM-" + (currentStudent.rollNo || "101"));
      setCandidateFather(currentStudent.fatherName || "Shri Parent");
      setCandidatePhone(currentStudent.phone || "");
      setCandidatePhoto(currentStudent.photoUrl || "");
      setCandidateClass(currentClass?.name || "Class 10");
    }
  };

  useEffect(() => {
    syncFromCurrentStudent();
  }, [selectedStudentId, selectedClassId]);

  // Timetable Rows (Fully Editable)
  const [timetable, setTimetable] = useState<TimetableItem[]>([
    { id: "tt_1", subject: "Mathematics", date: "2026-11-10", time: "09:30 AM - 12:30 PM", room: "Hall A" },
    { id: "tt_2", subject: "General Science", date: "2026-11-12", time: "09:30 AM - 12:30 PM", room: "Hall A" },
    { id: "tt_3", subject: "Social Science", date: "2026-11-15", time: "09:30 AM - 12:30 PM", room: "Hall B" },
    { id: "tt_4", subject: "English Language & Lit.", date: "2026-11-18", time: "09:30 AM - 12:30 PM", room: "Hall B" },
    { id: "tt_5", subject: "Hindi / Regional Lang.", date: "2026-11-21", time: "09:30 AM - 12:30 PM", room: "Hall A" },
  ]);

  // Load Exam Presets
  const loadTimetablePreset = (presetType: "class10" | "class12sci" | "class12com" | "midterm" | "termend") => {
    if (presetType === "class10") {
      setExamName("Annual Examination (Class X) 2026-27");
      setTimetable([
        { id: "tt_1", subject: "Mathematics", date: "2026-11-10", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_2", subject: "Science (Theory & Pract.)", date: "2026-11-12", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_3", subject: "Social Science", date: "2026-11-15", time: "09:30 AM - 12:30 PM", room: "Hall B" },
        { id: "tt_4", subject: "English Language & Literature", date: "2026-11-18", time: "09:30 AM - 12:30 PM", room: "Hall B" },
        { id: "tt_5", subject: "Hindi / Regional Lang.", date: "2026-11-21", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_6", subject: "Information Technology (ICT)", date: "2026-11-24", time: "09:30 AM - 11:30 AM", room: "Lab 1" },
      ]);
    } else if (presetType === "class12sci") {
      setExamName("Annual Examination (Class XII Science) 2026-27");
      setTimetable([
        { id: "tt_1", subject: "English Core (301)", date: "2026-11-10", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_2", subject: "Physics (042)", date: "2026-11-13", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_3", subject: "Chemistry (043)", date: "2026-11-17", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_4", subject: "Mathematics (041)", date: "2026-11-20", time: "09:30 AM - 12:30 PM", room: "Hall B" },
        { id: "tt_5", subject: "Biology (044)", date: "2026-11-23", time: "09:30 AM - 12:30 PM", room: "Hall B" },
        { id: "tt_6", subject: "Computer Science (083)", date: "2026-11-26", time: "09:30 AM - 12:30 PM", room: "Lab 2" },
      ]);
    } else if (presetType === "class12com") {
      setExamName("Annual Examination (Class XII Commerce) 2026-27");
      setTimetable([
        { id: "tt_1", subject: "English Core (301)", date: "2026-11-10", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_2", subject: "Accountancy (055)", date: "2026-11-14", time: "09:30 AM - 12:30 PM", room: "Hall A" },
        { id: "tt_3", subject: "Business Studies (054)", date: "2026-11-18", time: "09:30 AM - 12:30 PM", room: "Hall B" },
        { id: "tt_4", subject: "Economics (030)", date: "2026-11-21", time: "09:30 AM - 12:30 PM", room: "Hall B" },
        { id: "tt_5", subject: "Applied Mathematics / IP", date: "2026-11-25", time: "09:30 AM - 12:30 PM", room: "Hall A" },
      ]);
    } else if (presetType === "termend") {
      setExamName("Term-End Examination 2026-27");
      setTimetable([
        { id: "tt_1", subject: "English", date: "2026-11-10", time: "09:30 AM - 12:30 PM", room: "Room 101" },
        { id: "tt_2", subject: "Mathematics", date: "2026-11-12", time: "09:30 AM - 12:30 PM", room: "Room 101" },
        { id: "tt_3", subject: "General Science / EVS", date: "2026-11-14", time: "09:30 AM - 12:30 PM", room: "Room 102" },
        { id: "tt_4", subject: "Social Studies", date: "2026-11-17", time: "09:30 AM - 12:30 PM", room: "Room 102" },
        { id: "tt_5", subject: "Hindi / Regional Lang.", date: "2026-11-19", time: "09:30 AM - 12:30 PM", room: "Room 101" },
      ]);
    } else {
      setExamName("Half-Yearly Examination 2026-27");
      setTimetable([
        { id: "tt_1", subject: "English", date: "2026-09-15", time: "09:00 AM - 12:00 PM", room: "Room 101" },
        { id: "tt_2", subject: "Mathematics", date: "2026-09-17", time: "09:00 AM - 12:00 PM", room: "Room 101" },
        { id: "tt_3", subject: "Science / EVS", date: "2026-09-19", time: "09:00 AM - 12:00 PM", room: "Room 102" },
        { id: "tt_4", subject: "Social Studies", date: "2026-09-22", time: "09:00 AM - 12:00 PM", room: "Room 102" },
        { id: "tt_5", subject: "Hindi / Second Lang.", date: "2026-09-24", time: "09:00 AM - 12:00 PM", room: "Room 101" },
      ]);
    }
  };

  // Rules & Instructions (Fully Editable)
  const DEFAULT_RULES = [
    "Candidates must arrive at the examination hall at least 30 minutes before commencement.",
    "Possession of mobile phones, smartwatches, or any unauthorized material is strictly prohibited.",
    "This Admit Card must be preserved and presented upon entry along with the Student ID card.",
    "No candidate will be allowed to leave the examination hall before the completion of the exam duration.",
    "Use of blue or black ballpoint pen only for writing answers and darkening OMR bubbles."
  ];

  const [rules, setRules] = useState<string[]>(DEFAULT_RULES);
  const [newRule, setNewRule] = useState("");

  // Bulk Mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"preview" | "timetable" | "candidate" | "rules">("preview");

  const addTimetableRow = () => {
    const newId = "tt_" + Date.now();
    setTimetable(prev => [
      ...prev,
      { id: newId, subject: "New Subject", date: "2026-11-25", time: "09:30 AM - 12:30 PM", room: "Hall A" }
    ]);
  };

  const updateTimetableRow = (id: string, field: keyof TimetableItem, value: string) => {
    setTimetable(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTimetableRow = (id: string) => {
    if (timetable.length <= 1) return;
    setTimetable(prev => prev.filter(t => t.id !== id));
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    setRules(prev => [...prev, newRule.trim()]);
    setNewRule("");
  };

  const updateRule = (index: number, val: string) => {
    setRules(prev => prev.map((r, i) => i === index ? val : r));
  };

  const removeRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === classStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(classStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePrint = () => {
    if (printAreaRef.current) {
      const admitCss = `
        @page { size: A4 portrait; margin: 6mm; }
        .admitcard-print-page {
          width: 100% !important;
          max-width: 196mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          display: block !important;
          page-break-after: ${bulkMode ? "always" : "auto"} !important;
          break-after: ${bulkMode ? "page" : "auto"} !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          background: #ffffff !important;
        }
        .admitcard-print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
      `;
      const docTitle = bulkMode
        ? `Admit_Cards_${currentClass?.name || "Class"}`
        : `Admit_Card_${candidateName || currentStudent?.name || "Student"}`;
      printElementInIframe(printAreaRef.current, docTitle, admitCss, "portrait");
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const pages = Array.from(printAreaRef.current.querySelectorAll(".admitcard-print-page")) as HTMLElement[];
      if (pages.length > 1) {
        await exportMultiPageElementsToPdf(pages, {
          filename: `Admit_Cards_${currentClass?.name || "Class"}_Bulk`,
          orientation: "portrait",
          widthPx: 794,
          marginMm: 6,
          scale: 1.9,
        });
      } else {
        const target = pages[0] || printAreaRef.current;
        await exportElementToPdf(target, {
          filename: `Admit_Card_${candidateName || currentStudent?.name || "Student"}`,
          format: "a4",
          orientation: "portrait",
          widthPx: 794,
          pageMode: "fit_single",
          marginMm: 6,
          scale: 2.2,
        });
      }
      toast.success("Admit Card PDF download ho gaya!");
    } catch (err) {
      console.error("Admit Card PDF error:", err);
      toast.error("PDF download fail hua, Print try karein.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Render single Hall Ticket / Admit Card
  const renderAdmitCard = (student?: SchoolStudent) => {
    const isSingle = !bulkMode || !student || (currentStudent && student.id === currentStudent.id);
    const sName = isSingle ? (candidateName || student?.name || "Candidate Name") : (student?.name || "Candidate Name");
    const sRoll = isSingle ? (candidateRoll || student?.rollNo || "101") : (student?.rollNo || "101");
    const sAdm = isSingle ? (candidateAdmNo || student?.admissionNo || `ADM-${sRoll}`) : (student?.admissionNo || `ADM-${sRoll}`);
    const sFather = isSingle ? (candidateFather || student?.fatherName || "Shri Parent") : (student?.fatherName || "Shri Parent");
    const sPhone = isSingle ? (candidatePhone || student?.phone || "—") : (student?.phone || "—");
    const sPhoto = isSingle ? (candidatePhoto || student?.photoUrl || "") : (student?.photoUrl || "");
    const sClass = isSingle ? (candidateClass || currentClass?.name || "Class 10") : (currentClass?.name || "Class 10");

    const qrData = buildAdmitCardQrUrl({
      schoolId: school?.id || "",
      schoolName: schoolDetails.schoolName,
      schoolCode: getVisibleSchoolRegNo(school, schoolDetails.code),
      schoolAddress: schoolDetails.address,
      schoolPhone: schoolDetails.phone,
      examName,
      session: formatAcademicSession(sessionName),
      studentId: student?.id || "",
      rollNo: sRoll,
      admNo: sAdm,
      name: sName,
      fatherName: sFather,
      phone: sPhone,
      className: sClass,
      centerName,
      examController,
      principalTitle,
      timetable,
    });

    const admitColors = activeAdmitTemplate.colors;
    const admitVariant = useCustomAdmitTpl ? (activeAdmitTemplate.layoutVariant || "classic_ribbon") : "default";
    const cleanExamTitle = examName.replace(/\bBOARD\s+/gi, "");
    const cleanSess = formatAcademicSession(sessionName);
    const schoolInitials = (schoolDetails.schoolName || "SC").slice(0, 2).toUpperCase();
    const savedLogo = getSavedSchoolLogo(schoolDetails.logoUrl);
    const regNoVisible = getVisibleSchoolRegNo(school, schoolDetails.code);
    const leftSignLabel = (useCustomAdmitTpl && activeAdmitTemplate.leftSignatoryLabel) ? activeAdmitTemplate.leftSignatoryLabel : (examController || "Exam Controller");
    const rightSignLabel = (useCustomAdmitTpl && activeAdmitTemplate.rightSignatoryLabel) ? activeAdmitTemplate.rightSignatoryLabel : principalTitle;

    if (useCustomAdmitTpl) {
      const watermarkOverlay = activeAdmitTemplate.showWatermark ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.05] z-0">
          <span
            className="text-6xl font-black uppercase tracking-widest -rotate-12"
            style={{ color: admitColors.primaryColor }}
          >
            {activeAdmitTemplate.watermarkText || schoolDetails.schoolName.slice(0, 12)}
          </span>
        </div>
      ) : null;

      const renderLogoEl = (sizeCls = "w-13 h-13", roundCls = "rounded-xl") => (
        <>
          {savedLogo ? (
            <img
              src={cleanLogoUrl(savedLogo)}
              alt="School Logo"
              className={`${sizeCls} object-contain ${roundCls} border border-slate-300 bg-white p-0.5 shrink-0`}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
                const fb = (e.target as HTMLElement).parentElement?.querySelector(".admit-logo-fallback") as HTMLElement;
                if (fb) fb.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`${sizeCls} ${roundCls} font-black text-lg items-center justify-center shrink-0 admit-logo-fallback ${savedLogo ? "hidden" : "flex"}`}
            style={{ backgroundColor: admitColors.badgeBg, color: admitColors.badgeText }}
          >
            {schoolInitials}
          </div>
        </>
      );

      const renderPhotoEl = (boxCls = "w-24 h-28 rounded-xl border-2") => (
        <div className={`${boxCls} overflow-hidden bg-slate-100 flex items-center justify-center shrink-0`} style={{ borderColor: admitColors.borderColor }}>
          {sPhoto ? (
            <img src={sPhoto} alt={sName} className="w-full h-full object-cover object-top" />
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
              <User className="w-7 h-7 mb-1" />
              <span className="text-[9px] font-bold">Affix Photo</span>
            </div>
          )}
        </div>
      );

      const renderQrEl = (sz = 50) => (
        <div className="p-1 bg-white border border-slate-300 rounded shadow-xs inline-flex items-center justify-center shrink-0">
          <QRCode value={qrData} size={sz} level="L" />
        </div>
      );

      const renderTimetableBlock = (mode: "solid" | "light_header" | "hairline" | "striped" = "solid", sharp = false) => {
        const isLightHdr = mode === "light_header" || mode === "hairline";
        return (
          <div className="mb-3.5 relative z-10">
            <h4 className="text-[11px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: admitColors.primaryColor }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: admitColors.accentColor }} /> Exam Schedule &amp; Timetable:
            </h4>
            <div
              className={`overflow-hidden border ${sharp ? "rounded-none" : "rounded-lg"}`}
              style={{ borderColor: mode === "hairline" ? "#cbd5e1" : admitColors.borderColor }}
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead
                  className="font-bold"
                  style={
                    isLightHdr
                      ? {
                          backgroundColor: mode === "hairline" ? "#ffffff" : admitColors.surfaceTint,
                          color: admitColors.primaryColor,
                          borderBottom: `2px solid ${admitColors.primaryColor}`,
                        }
                      : {
                          backgroundColor: admitColors.primaryColor,
                          color: admitColors.headerTextColor,
                        }
                  }
                >
                  <tr>
                    <th className="p-1.5 border-r w-9 text-center" style={{ borderColor: isLightHdr ? "#e2e8f0" : "rgba(255,255,255,0.22)" }}>#</th>
                    <th className="p-1.5 border-r" style={{ borderColor: isLightHdr ? "#e2e8f0" : "rgba(255,255,255,0.22)" }}>Subject Name</th>
                    <th className="p-1.5 border-r w-28" style={{ borderColor: isLightHdr ? "#e2e8f0" : "rgba(255,255,255,0.22)" }}>Exam Date</th>
                    <th className="p-1.5 border-r w-40" style={{ borderColor: isLightHdr ? "#e2e8f0" : "rgba(255,255,255,0.22)" }}>Exam Timing</th>
                    <th className="p-1.5 w-20">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {timetable.map((row, idx) => (
                    <tr
                      key={row.id}
                      style={{
                        backgroundColor:
                          mode === "striped" && idx % 2 === 1
                            ? admitColors.surfaceTint
                            : idx % 2 === 0
                            ? "#ffffff"
                            : "#f8fafc",
                      }}
                    >
                      <td className="p-1.5 font-bold text-slate-500 border-r border-slate-200 text-center tabular-nums">{idx + 1}</td>
                      <td className="p-1.5 font-black text-slate-900 border-r border-slate-200">{row.subject}</td>
                      <td className="p-1.5 font-bold text-slate-700 border-r border-slate-200 tabular-nums">{row.date}</td>
                      <td className="p-1.5 font-semibold text-slate-700 border-r border-slate-200 tabular-nums">{row.time}</td>
                      <td className="p-1.5 font-bold text-slate-700">{row.room || "Room 1"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      };

      const renderRulesBlock = (sharp = false) => (
        <div
          className={`p-2.5 border text-[10px] space-y-0.5 mb-4 relative z-10 ${sharp ? "rounded-none" : "rounded-lg"}`}
          style={{ backgroundColor: admitColors.surfaceTint, borderColor: admitColors.borderColor + "55", color: "#1e293b" }}
        >
          <p className="font-black uppercase tracking-tight" style={{ color: admitColors.primaryColor }}>
            Important Rules &amp; Guidelines for Candidates:
          </p>
          {rules.map((rule, idx) => (
            <p key={idx} className="leading-snug">&bull; {rule}</p>
          ))}
        </div>
      );

      const renderSignaturesBlock = () => (
        <div className="relative z-10">
          <div className="grid grid-cols-3 gap-5 pt-3 border-t text-center text-xs" style={{ borderColor: admitColors.borderColor + "66" }}>
            <div>
              <div className="h-7 border-b border-slate-400 mb-1"></div>
              <p className="font-bold text-slate-700">Candidate Signature</p>
              <p className="text-[9.5px] text-slate-500">(परीक्षार्थी हस्ताक्षर)</p>
            </div>
            <div>
              <div className="h-7 border-b border-slate-400 mb-1 flex items-end justify-center">
                {examControllerSignatureUrl ? (
                  <img src={examControllerSignatureUrl} alt="Exam Controller Signature" className="max-h-6 max-w-[100px] object-contain mb-0.5" />
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">Sign / Stamp</span>
                )}
              </div>
              <p className="font-bold text-slate-800">{leftSignLabel}</p>
              <p className="text-[9.5px] text-slate-500">(परीक्षा नियंत्रक)</p>
            </div>
            <div>
              <div className="h-7 border-b border-slate-400 mb-1 flex items-end justify-center">
                {schoolDetails.principalSignatureUrl ? (
                  <img src={schoolDetails.principalSignatureUrl} alt="Principal Signature" className="max-h-6 max-w-[100px] object-contain mb-0.5" />
                ) : (
                  <span className="italic font-serif font-black text-sm" style={{ color: admitColors.primaryColor }}>{principalName}</span>
                )}
              </div>
              <p className="font-black text-slate-900 uppercase tracking-wider text-[10.5px]">{rightSignLabel}</p>
              <p className="text-[9.5px] text-slate-500">(केन्द्राधीक्षक / मुहर)</p>
            </div>
          </div>
          {activeAdmitTemplate.footerNote && (
            <p className="text-[9.5px] font-semibold text-center text-slate-500 mt-2 pt-1 border-t border-slate-200">
              {activeAdmitTemplate.footerNote}
            </p>
          )}
        </div>
      );

      const candidateDataGrid = (boxStyle: "boxed" | "clean" = "boxed") => (
        <div
          className={`grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs ${boxStyle === "boxed" ? "p-2.5 rounded-lg border" : "py-2 border-y"}`}
          style={
            boxStyle === "boxed"
              ? { backgroundColor: admitColors.surfaceTint, borderColor: admitColors.borderColor + "45" }
              : { borderColor: "#cbd5e1" }
          }
        >
          <div><span className="text-slate-500 font-bold">Candidate: </span><span className="font-black text-slate-900 text-[13px]">{sName}</span></div>
          <div><span className="text-slate-500 font-bold">Roll Number: </span><span className="font-black text-[13px] tabular-nums" style={{ color: admitColors.primaryColor }}>{sRoll}</span></div>
          <div><span className="text-slate-500 font-bold">Class &amp; Sec: </span><span className="font-bold text-slate-800">{sClass}</span></div>
          <div><span className="text-slate-500 font-bold">Adm / Reg: </span><span className="font-bold text-slate-800 tabular-nums">{sAdm}</span></div>
          <div><span className="text-slate-500 font-bold">Father&apos;s Name: </span><span className="font-bold text-slate-800">{sFather}</span></div>
          <div><span className="text-slate-500 font-bold">Phone: </span><span className="font-bold text-slate-800 tabular-nums">{sPhone}</span></div>
        </div>
      );

      const admitArch = getLayoutArchitecture(admitVariant);

      const customBorderStyle = {
        borderColor: admitColors.borderColor,
        borderStyle: admitArch.frameStyle === "postage_stamp" || admitArch.frameStyle === "ink_dashed" ? "dashed" : activeAdmitTemplate.borderStyle,
        borderWidth: admitArch.frameStyle === "heavy_bars" ? "0px" : activeAdmitTemplate.borderStyle === "double" ? "4px" : "2px",
        borderTopWidth: admitArch.frameStyle === "heavy_bars" ? "10px" : undefined,
        borderBottomWidth: admitArch.frameStyle === "heavy_bars" ? "10px" : undefined,
        borderLeftWidth: admitArch.frameStyle === "mono_stripe" ? "8px" : undefined,
        borderRadius: admitArch.frameStyle === "beveled" ? "26px 4px 26px 4px" : undefined,
      };

      // Vertical Left or Right Sidebar Spine / Wide Column (Layouts 02, 12, 41, 42)
      if (
        admitArch.frameStyle === "left_spine" ||
        admitArch.frameStyle === "right_spine" ||
        admitArch.frameStyle === "left_wide" ||
        admitArch.frameStyle === "right_wide"
      ) {
        const isRightSpine = admitArch.frameStyle === "right_spine" || admitArch.frameStyle === "right_wide";
        const isWide = admitArch.frameStyle === "left_wide" || admitArch.frameStyle === "right_wide";
        return (
          <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
            <div
              className={`admitcard-sheet-box w-full max-w-[790px] bg-white rounded-2xl shadow-xl overflow-hidden text-slate-900 print:shadow-none print:m-0 print:max-w-none print:rounded-none relative flex items-stretch ${isRightSpine ? "flex-row-reverse" : "flex-row"}`}
              style={{ fontFamily: admitArch.serifFont ? "Georgia, serif" : "'Inter', sans-serif", ...customBorderStyle }}
            >
              {watermarkOverlay}
              {/* Vertical Colored Spine */}
              <div
                className={`${isWide ? "w-[245px]" : "w-[215px]"} shrink-0 p-4 flex flex-col items-center justify-between text-center relative z-10`}
                style={{
                  background: `linear-gradient(180deg, ${admitColors.primaryColor}, ${admitColors.accentColor})`,
                  color: admitColors.headerTextColor,
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  {renderLogoEl("w-14 h-14", "rounded-2xl")}
                  <div>
                    <div className="text-[12px] font-black uppercase tracking-wide leading-tight">{schoolDetails.schoolName}</div>
                    {regNoVisible && <div className="text-[9px] opacity-80 mt-0.5">Code: {regNoVisible}</div>}
                  </div>
                  <div
                    className="px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mt-1"
                    style={{ backgroundColor: admitColors.badgeBg, color: admitColors.badgeText }}
                  >
                    ADMIT CARD
                  </div>
                </div>

                <div className="my-3 flex flex-col items-center gap-2 w-full">
                  {renderPhotoEl("w-28 h-32 rounded-xl border-2 bg-white")}
                  <div className="w-full rounded-lg py-1.5 px-2 bg-black/25 backdrop-blur-xs">
                    <div className="text-[9px] uppercase opacity-80 font-bold">Exam Roll No</div>
                    <div className="text-lg font-black tracking-wider tabular-nums">{sRoll}</div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  {renderQrEl(56)}
                  <span className="text-[8.5px] font-bold opacity-85 uppercase tracking-wider">{cleanSess}</span>
                </div>
              </div>

              {/* Right Main Content Panel */}
              <div className="flex-1 p-5 flex flex-col justify-between relative z-10 min-w-0">
                <div>
                  <div className="flex items-start justify-between gap-2 pb-2.5 mb-3 border-b-2" style={{ borderColor: admitColors.primaryColor }}>
                    <div>
                      <h2 className="text-base font-black uppercase tracking-wide" style={{ color: admitColors.primaryColor }}>
                        {cleanExamTitle}
                      </h2>
                      <p className="text-[10.5px] text-slate-600 font-medium">
                        {schoolDetails.address || schoolDetails.affiliation || "Official Examination Hall Ticket"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold uppercase text-slate-500 block">Exam Center</span>
                      <span className="text-[11px] font-black text-slate-900">{centerName}</span>
                    </div>
                  </div>

                  <div className="mb-3.5">{candidateDataGrid("boxed")}</div>
                  {renderTimetableBlock("striped", false)}
                  {renderRulesBlock(false)}
                </div>
                {renderSignaturesBlock()}
              </div>
            </div>
          </div>
        );
      }

      // 50/50 Dual-Tone Split Hero / Dark Obsidian Gold Foil
      if (admitArch.headerStyle === "split_duotone" || admitArch.headerStyle === "obsidian") {
        const isObsidian = admitArch.headerStyle === "obsidian";
        return (
          <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
            <div
              className="admitcard-sheet-box w-full max-w-[780px] bg-white rounded-2xl shadow-xl overflow-hidden text-slate-900 print:shadow-none print:m-0 print:max-w-none print:rounded-none relative flex flex-col justify-between"
              style={{ fontFamily: "'Inter', sans-serif", ...customBorderStyle }}
            >
              {watermarkOverlay}
              {/* Dark Top Zone: School Brand + Integrated Candidate Hero */}
              <div
                className="p-5 relative z-10"
                style={{
                  background: isObsidian
                    ? `linear-gradient(135deg, #09090b, ${admitColors.primaryColor})`
                    : `linear-gradient(135deg, ${admitColors.primaryColor}, ${admitColors.accentColor})`,
                  color: admitColors.headerTextColor,
                  borderBottom: isObsidian ? `3px solid ${admitColors.accentColor}` : undefined,
                }}
              >
                <div className={`flex items-center justify-between gap-3 pb-3 border-b border-white/25 ${activeAdmitTemplate.logoPosition === "right" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex items-center gap-3 ${activeAdmitTemplate.logoPosition === "right" ? "flex-row-reverse text-right" : ""}`}>
                    {renderLogoEl("w-12 h-12", "rounded-xl")}
                    <div>
                      <h1 className="text-lg font-black uppercase tracking-wider leading-tight">{schoolDetails.schoolName}</h1>
                      <p className="text-[10.5px] opacity-85">{schoolDetails.address || schoolDetails.affiliation}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest inline-block" style={{ backgroundColor: admitColors.badgeBg, color: admitColors.badgeText }}>
                      HALL TICKET • {cleanSess}
                    </span>
                    <div className="text-[11px] font-bold mt-1 opacity-95">{cleanExamTitle}</div>
                  </div>
                </div>

                {/* Candidate Spotlight inside Dark Zone */}
                <div className="grid grid-cols-12 gap-4 items-center pt-3.5">
                  <div className="col-span-3 flex items-center gap-2">
                    {renderPhotoEl("w-22 h-26 rounded-xl border-2 bg-white")}
                  </div>
                  <div className="col-span-6 space-y-1 text-xs">
                    <div className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Candidate Name</div>
                    <div className="text-lg font-black uppercase tracking-tight leading-none">{sName}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1.5 text-[11px]">
                      <div><span className="opacity-75">Class: </span><strong>{sClass}</strong></div>
                      <div><span className="opacity-75">Adm No: </span><strong className="tabular-nums">{sAdm}</strong></div>
                      <div><span className="opacity-75">Father: </span><strong>{sFather}</strong></div>
                      <div><span className="opacity-75">Phone: </span><strong className="tabular-nums">{sPhone}</strong></div>
                    </div>
                  </div>
                  <div className="col-span-3 flex flex-col items-end gap-1.5">
                    <div className="w-full rounded-xl px-3 py-2 text-center bg-black/25 border border-white/25">
                      <div className="text-[9px] uppercase tracking-wider opacity-85 font-bold">Roll Number</div>
                      <div className="text-xl font-black tabular-nums">{sRoll}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean White Bottom Half */}
              <div className="p-5 bg-white relative z-10 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border mb-3.5" style={{ backgroundColor: admitColors.surfaceTint, borderColor: admitColors.borderColor + "45" }}>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Examination Center / Venue</span>
                      <span className="text-xs font-black text-slate-900">{centerName}</span>
                    </div>
                    {renderQrEl(46)}
                  </div>
                  {renderTimetableBlock("light_header", false)}
                  {renderRulesBlock(false)}
                </div>
                {renderSignaturesBlock()}
              </div>
            </div>
          </div>
        );
      }

      // Diploma / Parchment Seal / Heritage Ornate Filigree / Emblem Seal / Guilloche / Art Deco / Museum Plaque / Laurel Wreath
      if (
        admitArch.frameStyle === "diploma_parchment" ||
        admitArch.frameStyle === "ornate_filigree" ||
        admitArch.frameStyle === "seal_center" ||
        admitArch.frameStyle === "art_deco" ||
        admitArch.frameStyle === "guilloche" ||
        admitArch.frameStyle === "museum_plaque" ||
        admitArch.frameStyle === "laurel_wreath"
      ) {
        return (
          <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
            <div
              className="admitcard-sheet-box w-full max-w-[780px] rounded-none shadow-xl overflow-hidden p-6 text-slate-900 print:shadow-none print:m-0 print:max-w-none relative flex flex-col justify-between"
              style={{
                backgroundColor: admitVariant === "stamp_seal_watermark" ? "#ffffff" : "#fffdf4",
                fontFamily: "Georgia, 'Times New Roman', serif",
                border: `4px double ${admitColors.borderColor}`,
                boxShadow: `inset 0 0 0 4px #fffdf4, inset 0 0 0 6px ${admitColors.accentColor}`,
              }}
            >
              {watermarkOverlay}
              <div className="relative z-10">
                <div className="text-center pb-3 mb-3.5 border-b-2" style={{ borderColor: admitColors.borderColor }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="shrink-0">{renderLogoEl("w-14 h-14", "rounded-full")}</div>
                    <div className="flex-1 text-center">
                      <h1 className="text-xl font-black uppercase tracking-wider leading-tight" style={{ color: admitColors.primaryColor }}>
                        {schoolDetails.schoolName}
                      </h1>
                      <p className="text-[11px] text-slate-700 mt-0.5">{schoolDetails.address || schoolDetails.affiliation}</p>
                      <div className="inline-block mt-2 px-5 py-1 border-y-2 text-xs font-black uppercase tracking-[0.2em]" style={{ borderColor: admitColors.accentColor, color: admitColors.primaryColor, backgroundColor: admitColors.surfaceTint }}>
                        OFFICIAL ADMISSION PERMIT &bull; {cleanSess}
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-full border-2 border-dashed flex flex-col items-center justify-center shrink-0 text-center p-1" style={{ borderColor: admitColors.accentColor, backgroundColor: "#fef3c7", color: "#92400e" }}>
                      <span className="text-[7.5px] font-black uppercase leading-tight">VERIFIED</span>
                      <span className="text-[11px] font-black leading-none my-0.5">SEAL</span>
                      <span className="text-[7px] font-bold leading-tight">{cleanSess}</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold mt-1.5 uppercase tracking-wide" style={{ color: admitColors.accentColor }}>
                    {cleanExamTitle} &bull; Center: {centerName}
                  </p>
                </div>

                <div className="grid grid-cols-12 gap-4 mb-3.5 items-center" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <div className="col-span-9">{candidateDataGrid("boxed")}</div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    {renderPhotoEl("w-22 h-26 rounded-md border-2")}
                    {renderQrEl(48)}
                  </div>
                </div>

                <div style={{ fontFamily: "'Inter', sans-serif" }}>
                  {renderTimetableBlock("light_header", true)}
                  {renderRulesBlock(true)}
                </div>
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif" }}>{renderSignaturesBlock()}</div>
            </div>
          </div>
        );
      }

      // DESIGN 08: Big Hero Photo & Roll Number Stamp
      if (admitArch.frameStyle === "hero_photo") {
        return (
          <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
            <div
              className="admitcard-sheet-box w-full max-w-[780px] bg-white rounded-2xl shadow-xl overflow-hidden text-slate-900 print:shadow-none print:m-0 print:max-w-none print:rounded-none relative flex flex-col justify-between"
              style={{ fontFamily: "'Inter', sans-serif", ...customBorderStyle }}
            >
              {watermarkOverlay}
              {/* Top Accent Strip */}
              <div className="h-2.5 w-full relative z-10" style={{ background: `linear-gradient(90deg, ${admitColors.primaryColor}, ${admitColors.accentColor})` }} />
              <div className="p-5 relative z-10 flex-1 flex flex-col justify-between">
                <div>
                  {/* Spotlight Hero Photo + School + Stamp Roll */}
                  <div className="flex items-stretch gap-4 p-3.5 rounded-2xl border-2 mb-3.5" style={{ backgroundColor: admitColors.surfaceTint, borderColor: admitColors.borderColor }}>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      {renderPhotoEl("w-28 h-34 rounded-xl border-3 bg-white shadow-sm")}
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: admitColors.primaryColor, color: admitColors.headerTextColor }}>
                        Verified Candidate
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-2 border-b pb-2" style={{ borderColor: admitColors.borderColor + "40" }}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderLogoEl("w-11 h-11", "rounded-xl")}
                          <div className="min-w-0">
                            <h1 className="text-base font-black uppercase tracking-wide leading-tight truncate" style={{ color: admitColors.primaryColor }}>
                              {schoolDetails.schoolName}
                            </h1>
                            <p className="text-[10px] text-slate-600 truncate">{schoolDetails.address || schoolDetails.affiliation}</p>
                            <p className="text-[10.5px] font-extrabold uppercase mt-0.5" style={{ color: admitColors.accentColor }}>{cleanExamTitle} ({cleanSess})</p>
                          </div>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl border-2 text-center shrink-0 bg-white" style={{ borderColor: admitColors.primaryColor }}>
                          <div className="text-[8.5px] font-bold uppercase text-slate-500">Roll No</div>
                          <div className="text-xl font-black leading-none tabular-nums" style={{ color: admitColors.primaryColor }}>{sRoll}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
                        <div><span className="text-slate-500 font-bold">Name: </span><strong className="text-sm text-slate-950">{sName}</strong></div>
                        <div><span className="text-slate-500 font-bold">Class: </span><strong>{sClass}</strong></div>
                        <div><span className="text-slate-500 font-bold">Father: </span><strong>{sFather}</strong></div>
                        <div><span className="text-slate-500 font-bold">Adm No: </span><strong className="tabular-nums">{sAdm}</strong></div>
                        <div className="col-span-2 flex items-center justify-between pt-1">
                          <div><span className="text-slate-500 font-bold">Center: </span><strong className="text-slate-900">{centerName}</strong></div>
                          <div><span className="text-slate-500 font-bold">Phone: </span><strong className="tabular-nums">{sPhone}</strong></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center shrink-0 pl-2 border-l" style={{ borderColor: admitColors.borderColor + "40" }}>
                      {renderQrEl(58)}
                      <span className="text-[8px] font-bold uppercase text-slate-500 mt-1">Scan Verify</span>
                    </div>
                  </div>

                  {renderTimetableBlock("solid", false)}
                  {renderRulesBlock(false)}
                </div>
                {renderSignaturesBlock()}
              </div>
            </div>
          </div>
        );
      }

      // Editorial Light Headers: CBSE Box, Swiss Minimalist White, Ink-Saver, Gazette Press, Matrix, Folio, Corner Brackets, Mono Stripe, Zen, Blueprint
      if (
        admitArch.headerStyle === "light_bar" ||
        admitArch.headerStyle === "gazette_double" ||
        admitArch.headerStyle === "editorial_split"
      ) {
        const isCbse = admitArch.frameStyle === "matrix_boxed" || admitArch.frameStyle === "folio_ledger" || admitArch.frameStyle === "dossier_tab";
        const isInkSaver = admitArch.frameStyle === "ink_dashed" || admitArch.frameStyle === "postage_stamp";
        const isMinimal = admitArch.frameStyle === "mono_stripe" || admitArch.frameStyle === "zen_asymmetric" || admitArch.frameStyle === "corner_brackets" || admitVariant === "minimal_grid";
        const isGazette = admitArch.headerStyle === "gazette_double" || admitArch.headerStyle === "editorial_split";
        return (
          <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
            <div
              className={`admitcard-sheet-box w-full max-w-[780px] bg-white shadow-xl overflow-hidden text-slate-900 print:shadow-none print:m-0 print:max-w-none print:rounded-none relative flex flex-col justify-between ${isMinimal || isCbse || isGazette ? "rounded-none" : "rounded-lg"}`}
              style={{
                fontFamily: isGazette ? "Georgia, 'Times New Roman', serif" : "'Inter', sans-serif",
                borderColor: admitColors.borderColor,
                borderStyle: isInkSaver ? "dashed" : isGazette ? "double" : activeAdmitTemplate.borderStyle,
                borderWidth: isMinimal ? "1.5px" : isGazette ? "4px" : "2px",
              }}
            >
              {watermarkOverlay}
              {/* Top Color Accent Strip for CBSE & Minimal */}
              {(isCbse || isMinimal) && (
                <div className="h-2 w-full relative z-10" style={{ backgroundColor: admitColors.primaryColor }} />
              )}

              <div className="p-5 relative z-10 flex-1 flex flex-col justify-between">
                <div>
                  {/* Clean Crisp White Editorial Header */}
                  <div className={`flex items-center justify-between gap-4 pb-3 mb-3 ${isMinimal ? "border-b" : isGazette ? "border-b-4 border-double" : "border-b-2"}`} style={{ borderColor: admitColors.primaryColor }}>
                    <div className={`flex items-center gap-3 ${activeAdmitTemplate.logoPosition === "right" ? "flex-row-reverse" : ""}`}>
                      {renderLogoEl("w-13 h-13", isCbse ? "rounded-none" : "rounded-lg")}
                      <div>
                        <h1 className="text-lg font-black uppercase tracking-wide leading-tight" style={{ color: admitColors.primaryColor }}>
                          {schoolDetails.schoolName}
                        </h1>
                        <p className="text-[10.5px] text-slate-600 font-medium">{schoolDetails.address}</p>
                        <p className="text-[9.5px] font-bold uppercase text-slate-500">
                          {schoolDetails.affiliation || "CBSE Pattern Curriculum"}
                          {regNoVisible ? ` • Reg/Code: ${regNoVisible}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border ${isCbse ? "rounded-none" : "rounded-md"}`}
                        style={{
                          backgroundColor: isCbse ? admitColors.badgeBg : "#ffffff",
                          color: admitColors.primaryColor,
                          borderColor: admitColors.primaryColor,
                        }}
                      >
                        {isCbse ? "OFFICIAL ADMIT CARD" : isInkSaver ? "EXAM ADMIT SLIP" : "HALL TICKET"}
                      </div>
                      <div className="text-[10.5px] font-bold text-slate-700 mt-1">{cleanExamTitle}</div>
                      <div className="text-[9.5px] text-slate-500 font-semibold">Session: {cleanSess}</div>
                    </div>
                  </div>

                  {/* CBSE Dedicated Roll Number Strip */}
                  {isCbse && (
                    <div className="grid grid-cols-3 border mb-3 text-xs" style={{ borderColor: admitColors.borderColor, backgroundColor: admitColors.surfaceTint }}>
                      <div className="p-2 border-r" style={{ borderColor: admitColors.borderColor }}>
                        <span className="text-[9.5px] font-bold uppercase text-slate-500 block">Examination Roll No.</span>
                        <span className="text-base font-black tabular-nums" style={{ color: admitColors.primaryColor }}>{sRoll}</span>
                      </div>
                      <div className="p-2 border-r" style={{ borderColor: admitColors.borderColor }}>
                        <span className="text-[9.5px] font-bold uppercase text-slate-500 block">Admission / Reg. No.</span>
                        <span className="text-sm font-black text-slate-900 tabular-nums">{sAdm}</span>
                      </div>
                      <div className="p-2">
                        <span className="text-[9.5px] font-bold uppercase text-slate-500 block">Examination Center</span>
                        <span className="text-xs font-bold text-slate-900">{centerName}</span>
                      </div>
                    </div>
                  )}

                  {/* Candidate Particulars + Photo/QR */}
                  <div className="grid grid-cols-12 gap-4 mb-3.5 items-center">
                    <div className="col-span-9 space-y-2">
                      {candidateDataGrid(isMinimal ? "clean" : "boxed")}
                      {!isCbse && (
                        <div className="flex items-center justify-between text-xs px-2.5 py-1.5 border rounded" style={{ borderColor: "#cbd5e1", backgroundColor: isInkSaver ? "#ffffff" : admitColors.surfaceTint }}>
                          <span className="font-bold text-slate-600">Examination Center:</span>
                          <span className="font-black text-slate-900">{centerName}</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-3 flex flex-col items-center gap-1.5">
                      {renderPhotoEl(`w-24 h-28 ${isCbse ? "rounded-none" : "rounded-lg"} border-2`)}
                      {isCbse && <span className="text-[8.5px] font-bold uppercase text-slate-500">Affix Sign Below Photo</span>}
                      {renderQrEl(46)}
                    </div>
                  </div>

                  {renderTimetableBlock(isMinimal ? "hairline" : "light_header", isCbse)}
                  {renderRulesBlock(isCbse)}
                </div>
                {renderSignaturesBlock()}
              </div>
            </div>
          </div>
        );
      }

      // Remaining Rich Banner Layouts: All 60 Header & Frame Architectures
      const isDiagonal = admitArch.headerStyle === "diagonal" || admitArch.headerStyle === "split_duotone";
      const isFloating = admitArch.pillBadges || admitArch.headerStyle === "floating_pill" || admitArch.frameStyle === "stacked_deck";
      const isArch = admitArch.headerStyle === "arch";
      const isWave = admitArch.headerStyle === "wave";
      const isChevron = admitArch.headerStyle === "chevron";
      const isScallop = admitArch.headerStyle === "scallop";
      const isAurora = admitArch.headerStyle === "aurora";
      const isPrism = admitArch.headerStyle === "prism";
      const isHorizon = admitArch.headerStyle === "horizon";
      const isScoreboard = admitArch.headerStyle === "scoreboard";
      const isDoubleDecker = admitArch.headerStyle === "double_decker";
      const isTricolor = admitArch.frameStyle === "tricolor";
      const isDualRails = admitArch.frameStyle === "dual_rails";
      const isPassport = admitArch.frameStyle === "passport_mrz";
      const isTicket = admitArch.frameStyle === "ticket_notch";
      const isBookmark = admitArch.frameStyle === "bookmark_ribbon";
      const isBottomDock = admitArch.frameStyle === "bottom_dock";
      const isLanyard = admitArch.frameStyle === "lanyard_punch";
      const isBrackets = admitArch.frameStyle === "corner_brackets" || admitArch.frameStyle === "cyber_hud" || admitArch.frameStyle === "museum_plaque";
      const isDossier = admitArch.frameStyle === "dossier_tab";
      const isSwissCross = admitArch.frameStyle === "swiss_cross";
      const isDiamondCrest = admitArch.frameStyle === "diamond_crest";
      const isHalo = admitArch.frameStyle === "concentric_halo";
      const isBlueprint = admitArch.frameStyle === "blueprint_grid";
      const isStacked = admitArch.frameStyle === "stacked_deck";
      const isBeveled = admitArch.frameStyle === "beveled";
      const isHeavyBars = admitArch.frameStyle === "heavy_bars";
      const isMonoStripe = admitArch.frameStyle === "mono_stripe";
      const isFolio = admitArch.frameStyle === "folio_ledger";
      const isPostage = admitArch.frameStyle === "postage_stamp" || admitArch.frameStyle === "checkered_rim";

      return (
        <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
          <div
            className={`admitcard-sheet-box w-full max-w-[780px] shadow-xl overflow-hidden text-slate-900 print:shadow-none print:m-0 print:max-w-none print:rounded-none relative flex ${isDualRails ? "flex-row" : "flex-col"} justify-between ${
              isBeveled || admitArch.sharpCorners || isBlueprint || isFolio ? "rounded-sm" : isFloating ? "rounded-3xl" : "rounded-2xl"
            }`}
            style={{
              fontFamily: admitArch.serifFont ? "Georgia, serif" : admitArch.monoAccent ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
              backgroundColor: admitArch.creamPaper ? "#fffdf4" : isBlueprint ? "#f8fbff" : isFolio ? "#fafdf7" : isFloating ? admitColors.surfaceTint : "#ffffff",
              backgroundImage: isBlueprint
                ? `linear-gradient(${admitColors.primaryColor}12 1px, transparent 1px), linear-gradient(90deg, ${admitColors.primaryColor}12 1px, transparent 1px)`
                : undefined,
              backgroundSize: isBlueprint ? "16px 16px" : undefined,
              ...customBorderStyle,
              borderRadius: isBeveled ? "28px 4px 28px 4px" : undefined,
              borderStyle: isPostage ? "dashed" : customBorderStyle.borderStyle,
              borderTopWidth: isHeavyBars ? "10px" : undefined,
              borderBottomWidth: isHeavyBars ? "10px" : undefined,
              borderLeftWidth: isMonoStripe ? "9px" : isSwissCross ? "14px" : undefined,
              borderLeftColor: isSwissCross ? admitColors.accentColor : undefined,
              boxShadow: isStacked
                ? `6px 6px 0 ${admitColors.accentColor}, 12px 12px 0 ${admitColors.primaryColor}`
                : admitArch.frameStyle === "museum_plaque"
                ? `inset 0 0 0 4px ${admitColors.accentColor}40`
                : undefined,
            }}
          >
            {isDualRails && <div className="w-5 shrink-0" style={{ background: `linear-gradient(180deg, ${admitColors.primaryColor}, ${admitColors.accentColor})` }} />}
            <div className="flex-1 p-5 flex flex-col justify-between relative min-w-0">
            {watermarkOverlay}
            {isLanyard && (
              <div className="mx-auto mb-2 w-16 h-3 rounded-full border-2 bg-white shadow-inner relative z-20" style={{ borderColor: admitColors.accentColor }} />
            )}
            {isDossier && (
              <div className="-mx-5 -mt-5 mb-3 px-4 py-1 flex items-center justify-between text-[10px] font-mono font-black relative z-20" style={{ backgroundColor: admitColors.primaryColor, color: admitColors.headerTextColor }}>
                <span>📁 HALL TICKET DOSSIER • ROLL #{sRoll}</span>
                <span>{cleanSess}</span>
              </div>
            )}
            {isBrackets && (
              <>
                <div className="pointer-events-none absolute top-2 left-2 w-5 h-5 border-t-[3px] border-l-[3px] z-20" style={{ borderColor: admitColors.accentColor }} />
                <div className="pointer-events-none absolute top-2 right-2 w-5 h-5 border-t-[3px] border-r-[3px] z-20" style={{ borderColor: admitColors.accentColor }} />
                <div className="pointer-events-none absolute bottom-2 left-2 w-5 h-5 border-b-[3px] border-l-[3px] z-20" style={{ borderColor: admitColors.accentColor }} />
                <div className="pointer-events-none absolute bottom-2 right-2 w-5 h-5 border-b-[3px] border-r-[3px] z-20" style={{ borderColor: admitColors.accentColor }} />
              </>
            )}
            {isDiamondCrest && (
              <div className="flex justify-center -mt-2 mb-1 relative z-20">
                <div className="w-6 h-6 rotate-45 border-2 flex items-center justify-center text-[10px] font-black text-white shadow" style={{ backgroundColor: admitColors.accentColor, borderColor: admitColors.primaryColor }}>
                  <span className="-rotate-45">❖</span>
                </div>
              </div>
            )}
            {isHalo && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15 z-0">
                <div className="w-60 h-60 rounded-full border-4 border-dashed flex items-center justify-center" style={{ borderColor: admitColors.accentColor }}>
                  <div className="w-44 h-44 rounded-full border-2" style={{ borderColor: admitColors.primaryColor }} />
                </div>
              </div>
            )}
            {isTicket && (
              <>
                <div className="hidden sm:block absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-100 border-r-2 z-20" style={{ borderColor: admitColors.borderColor }} />
                <div className="hidden sm:block absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-100 border-l-2 z-20" style={{ borderColor: admitColors.borderColor }} />
              </>
            )}
            {isBookmark && (
              <div
                className="absolute top-0 right-6 w-9 h-14 z-20 flex items-center justify-center text-xs font-black text-white shadow"
                style={{ backgroundColor: admitColors.accentColor, clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)" }}
              >
                ★
              </div>
            )}
            {isTricolor && (
              <div className="h-2.5 w-full flex mb-3 rounded overflow-hidden relative z-10">
                <div className="flex-1 bg-orange-500" />
                <div className="flex-1 bg-white border-y border-slate-200" />
                <div className="flex-1 bg-emerald-600" />
              </div>
            )}

            {/* Distinct Header Style per Variant */}
            <div
              className={`relative z-10 ${isFloating ? "rounded-2xl p-4 mb-3 shadow-sm" : "rounded-xl p-3.5 mb-4"}`}
              style={{
                background: isDiagonal
                  ? `linear-gradient(122deg, ${admitColors.primaryColor} 60%, ${admitColors.accentColor} 60.4%)`
                  : isAurora
                  ? `linear-gradient(125deg, ${admitColors.primaryColor}, ${admitColors.accentColor}, #ec4899)`
                  : isPrism
                  ? `linear-gradient(135deg, ${admitColors.primaryColor} 0%, ${admitColors.accentColor} 45%, ${admitColors.primaryColor} 46%, #0f172a 100%)`
                  : isHorizon
                  ? `radial-gradient(circle at 50% 120%, ${admitColors.accentColor}, ${admitColors.primaryColor} 72%)`
                  : isScoreboard
                  ? "#0f172a"
                  : isDoubleDecker
                  ? admitColors.primaryColor
                  : `linear-gradient(135deg, ${admitColors.primaryColor}, ${admitColors.accentColor})`,
                color: admitColors.headerTextColor,
                borderBottomLeftRadius: isArch ? "42% 24px" : isWave ? "60% 24px" : isHorizon ? "50% 20px" : undefined,
                borderBottomRightRadius: isArch ? "42% 24px" : isWave ? "20% 8px" : isHorizon ? "50% 20px" : undefined,
                clipPath: isChevron ? "polygon(0 0, 100% 0, 100% 84%, 50% 100%, 0 84%)" : undefined,
                paddingBottom: isChevron ? "24px" : undefined,
                borderBottom: isScallop
                  ? `4px dotted ${admitColors.badgeBg}`
                  : isDoubleDecker || isScoreboard
                  ? `5px solid ${admitColors.accentColor}`
                  : undefined,
                borderRadius: admitArch.headerStyle === "floating_pill" || admitArch.headerStyle === "scroll_header" ? "9999px" : undefined,
              }}
            >
              <div
                className={`flex items-center justify-between gap-3 ${
                  activeAdmitTemplate.logoPosition === "center"
                    ? "flex-col text-center"
                    : activeAdmitTemplate.logoPosition === "right"
                    ? "flex-row-reverse"
                    : ""
                }`}
              >
                <div className={`flex items-center gap-3 ${activeAdmitTemplate.logoPosition === "center" ? "flex-col" : activeAdmitTemplate.logoPosition === "right" ? "flex-row-reverse text-right" : ""}`}>
                  {renderLogoEl("w-13 h-13", isFloating ? "rounded-full" : "rounded-xl")}
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-wider leading-tight">{schoolDetails.schoolName}</h1>
                    {schoolDetails.address && <p className="text-[11px] opacity-90">{schoolDetails.address}</p>}
                    <p className="text-[10px] font-semibold tracking-wide uppercase opacity-85">
                      {schoolDetails.affiliation || "CBSE Pattern Curriculum"}
                      {schoolDetails.phone ? ` • Helpline: ${schoolDetails.phone}` : ""}
                      {regNoVisible ? ` • Code: ${regNoVisible}` : ""}
                    </p>
                  </div>
                </div>
                <div className={activeAdmitTemplate.logoPosition === "center" ? "text-center mt-1" : "text-right shrink-0"}>
                  <span
                    className={`inline-block px-3.5 py-1 font-black text-[10.5px] uppercase tracking-widest ${isDiagonal || admitArch.skewBadge ? "-skew-x-12" : "rounded-lg"}`}
                    style={{ backgroundColor: admitColors.badgeBg, color: admitColors.badgeText }}
                  >
                    EXAM ADMIT CARD
                  </span>
                  <p className="text-[11px] font-bold mt-1 opacity-95 uppercase">{cleanExamTitle} &bull; {cleanSess}</p>
                </div>
              </div>
            </div>

            {/* Candidate + Photo/QR */}
            <div className={`grid grid-cols-12 gap-4 mb-3.5 items-center relative z-10 ${isFloating ? "bg-white p-3 rounded-2xl border shadow-xs" : ""}`} style={isFloating ? { borderColor: admitColors.borderColor + "40" } : undefined}>
              <div className="col-span-9 space-y-2 text-xs">
                {candidateDataGrid(isFloating ? "clean" : "boxed")}
                <div
                  className={`p-2 flex items-center justify-between border ${isDiagonal ? "rounded-none font-black" : "rounded-xl"}`}
                  style={{ backgroundColor: admitColors.badgeBg, borderColor: admitColors.accentColor + "60", color: admitColors.badgeText }}
                >
                  <span className="font-bold">Examination Center:</span>
                  <span className="font-black text-right">{centerName}</span>
                </div>
              </div>
              <div className="col-span-3 flex flex-col items-center justify-center gap-2">
                {renderPhotoEl(`w-24 h-28 ${isFloating ? "rounded-2xl" : isDiagonal ? "rounded-none" : "rounded-xl"} border-2 bg-white`)}
                {renderQrEl(48)}
              </div>
            </div>

            <div className={isFloating ? "bg-white p-3 rounded-2xl border shadow-xs mb-3 relative z-10" : "relative z-10"} style={isFloating ? { borderColor: admitColors.borderColor + "40" } : undefined}>
              {renderTimetableBlock(isDiagonal ? "striped" : "solid", isDiagonal)}
              {renderRulesBlock(isDiagonal)}
            </div>

            {isPassport && (
              <div className="mb-2 px-3 py-1 rounded bg-slate-950 text-emerald-300 font-mono text-[10px] tracking-[0.18em] text-center">
                EXAM&lt;IND&lt;{sName.toUpperCase().replace(/\s+/g, "&lt;")}&lt;&lt;{sRoll}&lt;&lt;{cleanSess}
              </div>
            )}

            {isBottomDock ? (
              <div className="-mx-5 -mb-5 mt-3 px-5 py-2.5 flex items-center justify-between text-xs font-black" style={{ backgroundColor: admitColors.primaryColor, color: admitColors.headerTextColor }}>
                <span>{centerName}</span>
                <span>{cleanExamTitle}</span>
                <span>{activeAdmitTemplate.rightSignatoryLabel || "Principal"}</span>
              </div>
            ) : (
              renderSignaturesBlock()
            )}
            </div>
            {isDualRails && <div className="w-5 shrink-0" style={{ background: `linear-gradient(180deg, ${admitColors.accentColor}, ${admitColors.primaryColor})` }} />}
          </div>
        </div>
      );
    }

    const sheetBoxStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif" };

    return (
      <div key={student?.id || "single"} className="admitcard-print-page w-full flex justify-center">
      <div
        className="admitcard-sheet-box w-full max-w-[780px] bg-white rounded-2xl border-2 border-slate-900 print:border-2 print:border-black shadow-xl overflow-hidden p-6 text-slate-900 print:shadow-none print:m-0 print:max-w-none print:rounded-none relative flex flex-col justify-between"
        style={sheetBoxStyle}
      >
        {/* School Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center relative z-10">
          <div className="flex items-center justify-center gap-3.5 mb-1">
            {getSavedSchoolLogo(schoolDetails.logoUrl) ? (
              <img
                src={cleanLogoUrl(getSavedSchoolLogo(schoolDetails.logoUrl))}
                alt="School Logo"
                className="w-14 h-14 object-contain rounded-xl border border-slate-300 bg-white p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fb = (e.target as HTMLElement).parentElement?.querySelector('.admit-logo-fallback') as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-14 h-14 rounded-xl bg-slate-900 text-amber-300 font-black text-xl items-center justify-center admit-logo-fallback ${getSavedSchoolLogo(schoolDetails.logoUrl) ? 'hidden' : 'flex'}`}
            >
              {(schoolDetails.schoolName || "SC").slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left">
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-950 leading-tight">{schoolDetails.schoolName}</h1>
              {schoolDetails.address && <p className="text-xs text-slate-600">{schoolDetails.address}</p>}
              <p className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase">
                {schoolDetails.affiliation || "CBSE Pattern Curriculum"}
                {schoolDetails.phone ? ` • Helpline: ${schoolDetails.phone}` : ""}
                {getVisibleSchoolRegNo(school, schoolDetails.code) ? ` • Center / Reg Code: ${getVisibleSchoolRegNo(school, schoolDetails.code)}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-2">
            <span className="inline-block px-4 py-1 rounded-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest">
              EXAMINATION ADMIT CARD / HALL TICKET
            </span>
            <p className="text-xs font-bold text-indigo-950 mt-1 uppercase tracking-wide">
              {examName.replace(/\bBOARD\s+/gi, "")} &bull; Session: {formatAcademicSession(sessionName)}
            </p>
          </div>
        </div>

        {/* Student Profile & Details Table */}
        <div className="grid grid-cols-12 gap-4 mb-4 items-center">
          <div className="col-span-9 space-y-1.5 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 font-bold">Candidate Name: </span>
                <span className="font-black text-slate-900 text-sm">{sName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Roll Number: </span>
                <span className="font-black text-indigo-700 text-sm">{sRoll}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Class &amp; Section: </span>
                <span className="font-bold text-slate-800">{sClass}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Admission / Reg No: </span>
                <span className="font-bold text-slate-800">{sAdm}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Father's Name: </span>
                <span className="font-bold text-slate-800">{sFather}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Contact / Phone: </span>
                <span className="font-bold text-slate-800">{sPhone}</span>
              </div>
            </div>
            <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between">
              <span className="font-bold text-indigo-900">Examination Center:</span>
              <span className="font-bold text-slate-800 text-right">{centerName}</span>
            </div>
          </div>

          {/* Photo and QR Box */}
          <div className="col-span-3 flex flex-col items-center justify-center gap-2">
            <div className="w-24 h-28 border-2 border-slate-300 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
              {sPhoto ? (
                <img src={sPhoto} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                  <User className="w-8 h-8 mb-1" />
                  <span className="text-[9px] font-bold">Affix Candidate Photo</span>
                </div>
              )}
            </div>
            <div className="p-1 bg-white border border-slate-300 rounded shadow-sm">
              <QRCode value={qrData} size={52} level="L" />
            </div>
          </div>
        </div>

        {/* Timetable Schedule Table (Fully dynamic) */}
        <div className="mb-4 relative z-10">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Exam Schedule &amp; Timetable:
          </h4>
          <div className="overflow-hidden border border-slate-300 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2 border-r border-slate-700 w-10 text-center">#</th>
                  <th className="p-2 border-r border-slate-700">Subject Name</th>
                  <th className="p-2 border-r border-slate-700 w-28">Exam Date</th>
                  <th className="p-2 border-r border-slate-700 w-44">Exam Timing</th>
                  <th className="p-2 w-24">Room No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {timetable.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-2 font-bold text-slate-500 border-r border-slate-200 text-center">{idx + 1}</td>
                    <td className="p-2 font-black text-slate-900 border-r border-slate-200">{row.subject}</td>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-200">{row.date}</td>
                    <td className="p-2 font-semibold text-slate-700 border-r border-slate-200">{row.time}</td>
                    <td className="p-2 font-bold text-slate-700">{row.room || "Room 1"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rules & Instructions (Editable) */}
        <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-[10px] text-amber-950 space-y-1 mb-5 relative z-10">
          <p className="font-black text-amber-950 uppercase tracking-tight">Important Rules &amp; Guidelines for Candidates:</p>
          {rules.map((rule, idx) => (
            <p key={idx} className="leading-snug">&bull; {rule}</p>
          ))}
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-300 text-center text-xs relative z-10">
          <div>
            <div className="h-8 border-b border-slate-400 mb-1"></div>
            <p className="font-bold text-slate-700">Candidate Signature</p>
            <p className="text-[10px] text-slate-500">(परीक्षार्थी हस्ताक्षर)</p>
          </div>
          <div>
            <div className="h-8 border-b border-slate-400 mb-1 flex items-end justify-center">
              {examControllerSignatureUrl ? (
                <img
                  src={examControllerSignatureUrl}
                  alt="Exam Controller Signature"
                  className="max-h-7 max-w-[110px] object-contain mb-0.5"
                />
              ) : (
                <span className="text-[11px] font-semibold text-slate-400">Sign / Stamp</span>
              )}
            </div>
            <p className="font-bold text-slate-700">{examController || "Exam Controller"}</p>
            <p className="text-[10px] text-slate-500">(परीक्षा नियंत्रक)</p>
          </div>
          <div>
            <div className="h-8 border-b border-slate-400 mb-1 flex items-end justify-center">
              {schoolDetails.principalSignatureUrl ? (
                <img
                  src={schoolDetails.principalSignatureUrl}
                  alt="Principal Signature"
                  className="max-h-7 max-w-[110px] object-contain mb-0.5"
                />
              ) : (
                <span className="italic font-serif font-black text-indigo-800 text-sm">{principalName}</span>
              )}
            </div>
            <p className="font-black text-slate-900 uppercase tracking-wider text-[11px]">{principalTitle}</p>
            <p className="text-[10px] text-slate-500">(केन्द्राधीक्षक / मुहर)</p>
          </div>
        </div>
      </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-16 print:min-h-0 print:pb-0 print:bg-white">
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 6mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: auto !important;
          }
          .admitcard-print-page {
            width: 100% !important;
            max-width: 196mm !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            display: block !important;
            page-break-after: ${bulkMode ? "always" : "auto"} !important;
            break-after: ${bulkMode ? "page" : "auto"} !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
          }
          .admitcard-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .admitcard-sheet-box {
            width: 100% !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      {/* Top Navbar */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 px-4 py-4 text-slate-900 dark:text-white border-b-2 border-indigo-700 dark:border-indigo-500 shadow-md sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-indigo-800 dark:text-blue-200 hover:text-indigo-950 dark:hover:text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> School Dashboard
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowTemplateStudio(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 bg-slate-900 hover:bg-indigo-700 text-white shadow transition-all cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-amber-300" /> Templates (10+)
            </button>
            <button
              onClick={() => setShowSchoolHeaderModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-300" /> 🏫 School Details Edit
            </button>
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                bulkMode
                  ? "bg-amber-500 text-slate-950 border-amber-700 shadow"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-white border-indigo-600 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> {bulkMode ? "Single Mode" : "Bulk Class Print"}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow active:scale-95 transition-transform cursor-pointer"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadingPdf ? "Saving PDF..." : "Download PDF"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow active:scale-95 transition-transform cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 print:p-0">
        {/* Full Interactive Customization Console (Hidden on Print) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm mb-6 space-y-4 print:hidden border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-indigo-600" />
                Admit Card (Hall Ticket) Live Editor
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Exam Title, Timetable Dates & Times, Rules, aur Candidate Details ko live edit karein.
              </p>
            </div>

            {/* Navigation Tabs for Editors */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "preview" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                General &amp; Exam
              </button>
              <button
                onClick={() => setActiveTab("timetable")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "timetable" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Timetable ({timetable.length})
              </button>
              <button
                onClick={() => setActiveTab("candidate")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "candidate" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Candidate Info
              </button>
              <button
                onClick={() => setActiveTab("rules")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "rules" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Exam Rules ({rules.length})
              </button>
            </div>
          </div>

          {/* TAB 1: General & Exam Metadata */}
          {activeTab === "preview" && (
            <div className="space-y-3 pt-2 border-t dark:border-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Class Select Karein:</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Exam Title:</label>
                  <input
                    type="text"
                    value={examName}
                    onChange={e => setExamName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Academic Session:</label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Exam Center Name:</label>
                  <input
                    type="text"
                    value={centerName}
                    onChange={e => setCenterName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Exam Controller Title &amp; Sign:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={examController}
                      onChange={e => setExamController(e.target.value)}
                      placeholder="Exam Controller"
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowExamControllerSignModal(true)}
                      className="px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Exam Controller (Exam लेने वाला) का डिजिटल साइन जोड़ें"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{examControllerSignatureUrl ? "Edit Sign" : "Add Sign"}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Principal / Signatory Name:</label>
                  <input
                    type="text"
                    value={principalName}
                    onChange={e => setPrincipalName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Signatory Title:</label>
                  <input
                    type="text"
                    value={principalTitle}
                    onChange={e => setPrincipalTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl border-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Full Timetable Interactive Editor */}
          {activeTab === "timetable" && (
            <div className="space-y-3 pt-2 border-t dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  Har Row ka Subject, Date, Time, aur Room live edit karein:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addTimetableRow}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Naya Subject Jodein
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 text-xs">
                <span className="font-bold text-slate-500 text-[11px] mr-1">Quick Presets:</span>
                <button
                  onClick={() => loadTimetablePreset("class10")}
                  className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg font-bold border border-slate-300 dark:border-slate-500 shadow-xs"
                >
                  📘 Class 10 Annual Exam
                </button>
                <button
                  onClick={() => loadTimetablePreset("termend")}
                  className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg font-bold border border-slate-300 dark:border-slate-500 shadow-xs"
                >
                  📋 Term-End Exam
                </button>
                <button
                  onClick={() => loadTimetablePreset("class12sci")}
                  className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg font-bold border border-slate-300 dark:border-slate-500 shadow-xs"
                >
                  🔬 Class 12 Science
                </button>
                <button
                  onClick={() => loadTimetablePreset("class12com")}
                  className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg font-bold border border-slate-300 dark:border-slate-500 shadow-xs"
                >
                  📊 Class 12 Commerce
                </button>
                <button
                  onClick={() => loadTimetablePreset("midterm")}
                  className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg font-bold border border-slate-300 dark:border-slate-500 shadow-xs"
                >
                  📝 Half-Yearly Exam
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2">Subject Name</th>
                      <th className="p-2 w-36">Exam Date</th>
                      <th className="p-2 w-48">Exam Timing</th>
                      <th className="p-2 w-28">Room No</th>
                      <th className="p-2 w-12 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {timetable.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="p-2 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.subject}
                            onChange={e => updateTimetableRow(row.id, "subject", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-bold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => updateTimetableRow(row.id, "date", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.time}
                            onChange={e => updateTimetableRow(row.id, "time", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.room || "Hall 1"}
                            onChange={e => updateTimetableRow(row.id, "room", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeTimetableRow(row.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            title="Hatao"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Candidate Info Editor */}
          {activeTab === "candidate" && (
            <div className="space-y-3 pt-2 border-t dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  Student Select Karein ya Details Manual Edit Karein:
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  >
                    {classStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Roll: {s.rollNo})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                    title="Naya student turant add karein"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> + Student Data
                  </button>
                  <button
                    onClick={syncFromCurrentStudent}
                    className="px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                    title="Student details wapas reload karein"
                  >
                    🔄 Reset Details
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Candidate Name:</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={e => setCandidateName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Roll Number:</label>
                  <input
                    type="text"
                    value={candidateRoll}
                    onChange={e => setCandidateRoll(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Admission / Reg No:</label>
                  <input
                    type="text"
                    value={candidateAdmNo}
                    onChange={e => setCandidateAdmNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Father's Name:</label>
                  <input
                    type="text"
                    value={candidateFather}
                    onChange={e => setCandidateFather(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Contact Phone:</label>
                  <input
                    type="text"
                    value={candidatePhone}
                    onChange={e => setCandidatePhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Class &amp; Section Name:</label>
                  <input
                    type="text"
                    value={candidateClass}
                    onChange={e => setCandidateClass(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Photo URL (Optional):</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={candidatePhoto}
                    onChange={e => setCandidatePhoto(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl border-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Rules & Instructions Editor */}
          {activeTab === "rules" && (
            <div className="space-y-3 pt-2 border-t dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  Admit Card par aane wale Rules &amp; Guidelines ko edit karein:
                </span>
                <button
                  onClick={() => setRules(DEFAULT_RULES)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                >
                  🔄 Reset to Standard Rules
                </button>
              </div>

              <div className="space-y-2">
                {rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-5 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={rule}
                      onChange={e => updateRule(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                    />
                    <button
                      onClick={() => removeRule(idx)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                      title="Hatao"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t dark:border-slate-700">
                <input
                  type="text"
                  placeholder="Naya rule / guideline likhein..."
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                />
                <button
                  onClick={addRule}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Rule Jodein
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Display (Print-ready) */}
        {bulkMode ? (
          <div>
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm mb-4 print:hidden border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {selectedStudentIds.length === classStudents.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selectedStudentIds.length === classStudents.length ? "Deselect All" : "Select All Class"}
                </button>
                <span className="text-xs text-slate-500">
                  ({selectedStudentIds.length > 0 ? selectedStudentIds.length : classStudents.length} of {classStudents.length} Students Selected)
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-600">Print Ready</span>
            </div>

            <div ref={printAreaRef} className="space-y-6 print:space-y-0">
              {(selectedStudentIds.length > 0
                ? classStudents.filter(s => selectedStudentIds.includes(s.id))
                : classStudents
              ).map(student => renderAdmitCard(student))}
            </div>
          </div>
        ) : (
          <div ref={printAreaRef} className="flex justify-center print:block">
            {renderAdmitCard(currentStudent || undefined)}
          </div>
        )}
      </div>

      {showSchoolHeaderModal && (
        <SchoolHeaderEditorModal
          initialDetails={schoolDetails}
          schoolId={school.id}
          onClose={() => setShowSchoolHeaderModal(false)}
          onSave={(updated) => setSchoolDetails(updated)}
        />
      )}

      {showAddStudentModal && (
        <QuickAddStudentModal
          isOpen={true}
          schoolId={school.id}
          classes={classes}
          defaultClassId={selectedClassId}
          onClose={() => setShowAddStudentModal(false)}
          onStudentAdded={(newStu) => {
            setStudentList(prev => [newStu, ...prev]);
            setSelectedStudentId(newStu.id);
          }}
        />
      )}

      {showExamControllerSignModal && (
        <TeacherSignatureModal
          isOpen={showExamControllerSignModal}
          onClose={() => setShowExamControllerSignModal(false)}
          title="Exam Controller Signature (परीक्षा नियंत्रक साइन)"
          subtitle="Admit Card व Marksheet पर Exam Controller स्थान पर प्रिंट होगा"
          initialSignatureUrl={examControllerSignatureUrl}
          uploadPrefix={`sig_exam_controller_${school.id}`}
          onSaveSignature={async (url) => {
            setExamControllerSignatureUrl(url);
            await updateSchool(school.id, {
              examControllerSignatureUrl: url,
              examControllerName: examController || "Exam Controller",
            });
            onSchoolUpdated?.({
              examControllerSignatureUrl: url,
              examControllerName: examController || "Exam Controller",
            });
          }}
        />
      )}

      {showTemplateStudio && (
        <DocumentTemplateStudioModal
          school={school}
          initialDocType="admit_card"
          onClose={() => setShowTemplateStudio(false)}
          onTemplateApplied={() => setTemplateTick(t => t + 1)}
          onSchoolUpdated={onSchoolUpdated}
        />
      )}
    </div>
  );
};
