import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Users,
  Briefcase,
  Search,
  Check,
  Lock,
  BookOpen,
  GraduationCap,
  SlidersHorizontal,
  AlertTriangle,
  Plus,
  X,
  RefreshCw,
  Crown,
  UserCheck,
  Edit3,
  Trash2,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AccountantPermissions,
  AdminProfilePermissions,
  AdminProfileRole,
  School,
  SchoolAccountant,
  SchoolAdminProfile,
  SchoolClass,
  SchoolSubject,
  SchoolTeacher,
  TeacherAccessScope,
  TeacherPermissions,
  TeacherRolePreset,
} from "../../school-types";
import {
  generateId,
  getAccountants,
  saveAccountant,
  saveTeacher,
  updateSchool,
} from "../../school-firebase";
import {
  ACCOUNTANT_ROLE_PRESETS,
  ADMIN_PERMISSION_ITEMS,
  ADMIN_ROLE_PRESETS,
  DEFAULT_ADMIN_FULL_PERMISSIONS,
  TEACHER_ROLE_PRESETS,
  getAdminRoleLabel,
  resolveAccountantPermissions,
  resolveAdminProfilePermissions,
  resolveTeacherPermissions,
} from "../../utils/schoolRolePermissions";
import { UpiAlertReceiverSelector } from "./UpiAlertReceiverSelector";

interface Props {
  school: School;
  teachers: SchoolTeacher[];
  classes: SchoolClass[];
  subjects: SchoolSubject[];
  initialTab?: "admins" | "teachers" | "accountants";
  activeAdminProfileId?: string;
  onSelectActiveAdmin?: (profileId: string) => void;
  onSchoolUpdated?: (patch: Partial<School>) => void;
  onTeacherUpdated?: (updated: SchoolTeacher) => void;
  onOpenTeachersDirectory?: () => void;
  onBack?: () => void;
}

const TEACHER_PERMISSION_ITEMS: Array<{
  key: keyof TeacherPermissions;
  label: string;
  desc: string;
  category: "core" | "academic" | "admin_safeguard";
}> = [
  {
    key: "canMarkAttendance",
    label: "Daily Attendance (दैनिक हाजिरी)",
    desc: "छात्रों की उपस्थिति दर्ज करना",
    category: "core",
  },
  {
    key: "canEnterMarks",
    label: "Marks & Exam Entry (अंक प्रविष्टि)",
    desc: "परीक्षा व यूनिट टेस्ट अंक भरना",
    category: "core",
  },
  {
    key: "canEnterAllSubjectsMarks",
    label: "All Class Subjects Marks (पूरी कक्षा के अंक)",
    desc: "बंद रहने पर शिक्षक केवल अपने विषय के अंक भर सकेगा",
    category: "core",
  },
  {
    key: "canApproveLeaves",
    label: "Student Leave Approval (छुट्टी अप्रूवल)",
    desc: "छात्रों की छुट्टी मंजूर या अस्वीकार करना",
    category: "core",
  },
  {
    key: "canManageHomeworkAndDiary",
    label: "Homework, Diary & 6-Skills",
    desc: "दैनिक गृहकार्य व छात्र प्रगति डायरी",
    category: "academic",
  },
  {
    key: "canManageNotesAndVideos",
    label: "Class Notes, Videos & Online Test",
    desc: "नोट्स, स्मार्ट क्लास व ऑनलाइन टेस्ट प्रबंधन",
    category: "academic",
  },
  {
    key: "canBuildQuestionPapers",
    label: "Question Paper Builder (पेपर निर्माता)",
    desc: "अर्धवार्षिक व वार्षिक प्रश्न-पत्र तैयार करना",
    category: "academic",
  },
  {
    key: "canMessageParents",
    label: "Messenger & Parent Helpdesk",
    desc: "क्लास ब्रॉडकास्ट व अभिभावक संवाद",
    category: "academic",
  },
  {
    key: "canManageAbsentee",
    label: "Absentee Alert & Call Desk",
    desc: "गैरहाजिर छात्रों के अभिभावकों को कॉल/अलर्ट",
    category: "academic",
  },
  {
    key: "canSchedulePtm",
    label: "PTM Slot Scheduler",
    desc: "अभिभावक-शिक्षक बैठक समय तय करना",
    category: "academic",
  },
  {
    key: "canManageLibrary",
    label: "Library Management (पुस्तकालय)",
    desc: "किताबें जारी व जमा करना",
    category: "academic",
  },
  {
    key: "canViewAllStudents",
    label: "View Full School Directory (पूरा स्कूल देखें)",
    desc: "बंद रहने पर केवल आवंटित कक्षा के छात्र दिखेंगे",
    category: "admin_safeguard",
  },
  {
    key: "canEditStudentProfile",
    label: "Edit Student Master Profile (डेटा सुधार)",
    desc: "सुरक्षा हेतु डिफ़ॉल्ट बंद — केवल एडमिन अनुमोदित शिक्षक",
    category: "admin_safeguard",
  },
  {
    key: "canAddAdmission",
    label: "New Online / Direct Admission (नया प्रवेश)",
    desc: "सुरक्षा हेतु डिफ़ॉल्ट बंद — नया छात्र प्रवेश फॉर्म भरना",
    category: "admin_safeguard",
  },
];

const ACCOUNTANT_PERMISSION_ITEMS: Array<{
  key: keyof AccountantPermissions;
  label: string;
  desc: string;
  safeguard?: boolean;
}> = [
  {
    key: "canCollectFee",
    label: "Fee Collection & 3\" POS Receipt",
    desc: "छात्र फीस जमा करना व रसीद प्रिंट करना",
  },
  {
    key: "canAdmitStudents",
    label: "Online & Direct Admission",
    desc: "नया प्रवेश फॉर्म भरना व अप्रूव करना",
  },
  {
    key: "canGrantDiscount",
    label: "Fee Discount / Concession (छूट)",
    desc: "तय सीमा के भीतर शुल्क छूट लागू करना",
  },
  {
    key: "canViewDayBook",
    label: "Daily Cashbook (दैनिक रोकड़ बही)",
    desc: "शाम को नकद व UPI कलेक्शन मिलान",
  },
  {
    key: "canRecordExpenses",
    label: "School Expense Vouchers (खर्च वाउचर)",
    desc: "डीजल, स्टेशनरी व दैनिक खर्च दर्ज करना",
  },
  {
    key: "canSendFeeAlerts",
    label: "WhatsApp & Push Due Alerts",
    desc: "अभिभावकों को बकाया फीस रिमाइंडर भेजना",
  },
  {
    key: "canManageBusFee",
    label: "Bus & Transport Dues",
    desc: "वाहन रूट अनुसार परिवहन शुल्क संभालना",
  },
  {
    key: "canPrintIdCards",
    label: "ID Card Print & Verification",
    desc: "छात्र स्मार्ट ID कार्ड प्रिंट करना",
  },
  {
    key: "canManageAbsentee",
    label: "Absentee Desk & Parent Call",
    desc: "गैरहाजिर छात्रों की सूची व कॉल फॉलो-अप",
  },
  {
    key: "canCancelReceipts",
    label: "Receipt Cancellation & Refund (रसीद रद्द)",
    desc: "संवेदनशील: जमा रसीद रद्द व लेजर रिवर्स करना",
    safeguard: true,
  },
  {
    key: "canEditFeeStructure",
    label: "Edit Class Fee Rates (फीस रेट बदलाव)",
    desc: "संवेदनशील: कक्षा-वार मासिक/वार्षिक फीस दरें बदलना",
    safeguard: true,
  },
];

export const RolesPermissionsManager: React.FC<Props> = ({
  school,
  teachers,
  classes,
  subjects,
  initialTab = "admins",
  activeAdminProfileId,
  onSelectActiveAdmin,
  onSchoolUpdated,
  onTeacherUpdated,
  onOpenTeachersDirectory,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<"admins" | "teachers" | "accountants">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [presetFilter, setPresetFilter] = useState<"all" | TeacherRolePreset>("all");
  const [localTeachers, setLocalTeachers] = useState<SchoolTeacher[]>(teachers);
  const [accountants, setAccountants] = useState<SchoolAccountant[]>([]);
  const [loadingAccountants, setLoadingAccountants] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [customSubjectDraft, setCustomSubjectDraft] = useState<Record<string, string>>({});

  // Admin / Principal / Manager Profiles state
  const [adminProfiles, setAdminProfiles] = useState<SchoolAdminProfile[]>(
    Array.isArray(school.adminProfiles) ? school.adminProfiles : []
  );
  const [showAdminForm, setShowAdminForm] = useState<boolean>(
    !Array.isArray(school.adminProfiles) || school.adminProfiles.length === 0
  );
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const [confirmDeleteAdminId, setConfirmDeleteAdminId] = useState<string | null>(null);
  const [savingAdminForm, setSavingAdminForm] = useState(false);

  const [adminFormName, setAdminFormName] = useState("");
  const [adminFormPhone, setAdminFormPhone] = useState("");
  const [adminFormEmail, setAdminFormEmail] = useState("");
  const [adminFormRole, setAdminFormRole] = useState<AdminProfileRole>("principal");
  const [adminFormDesignation, setAdminFormDesignation] = useState("Principal");
  const [adminFormPermissions, setAdminFormPermissions] = useState<AdminProfilePermissions>({
    ...DEFAULT_ADMIN_FULL_PERMISSIONS,
  });
  const [adminFormActivateNow, setAdminFormActivateNow] = useState(true);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setAdminProfiles(Array.isArray(school.adminProfiles) ? school.adminProfiles : []);
  }, [school.adminProfiles]);

  useEffect(() => {
    setLocalTeachers(teachers);
  }, [teachers]);

  const loadAccountants = async () => {
    setLoadingAccountants(true);
    try {
      const list = await getAccountants(school.id);
      setAccountants(list || []);
    } catch (err) {
      console.error("[RolesPermissionsManager] Error loading accountants:", err);
    } finally {
      setLoadingAccountants(false);
    }
  };

  useEffect(() => {
    loadAccountants();
  }, [school.id]);

  // Unique subject names across the school
  const availableSubjectNames = useMemo(() => {
    const names = new Set<string>([
      "Hindi",
      "English",
      "Mathematics",
      "Science",
      "Social Science",
      "EVS",
      "Sanskrit",
      "Computer / IT",
      "General Knowledge (GK)",
      "Drawing & Art",
    ]);
    subjects.forEach((s) => {
      if (s?.name?.trim()) names.add(s.name.trim());
    });
    localTeachers.forEach((t) => {
      (t.subjects || []).forEach((s) => {
        if (s?.trim()) names.add(s.trim());
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [subjects, localTeachers]);

  // Real teachers (exclude accountant-only phantom entries if any)
  const realTeachers = useMemo(() => {
    return localTeachers.filter((t) => !(t as any)._isAccountantOnly);
  }, [localTeachers]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return realTeachers.filter((t) => {
      const resolved = resolveTeacherPermissions(t);
      if (presetFilter !== "all" && resolved.rolePreset !== presetFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (t.name || "").toLowerCase().includes(q) ||
        (t.phone || "").toLowerCase().includes(q) ||
        (t.employeeId || "").toLowerCase().includes(q) ||
        (t.designation || "").toLowerCase().includes(q) ||
        (t.subjects || []).some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [realTeachers, searchQuery, presetFilter]);

  const filteredAccountants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accountants.filter((a) => {
      if (!q) return true;
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.phone || "").toLowerCase().includes(q) ||
        (a.employeeId || "").toLowerCase().includes(q) ||
        (a.designation || "").toLowerCase().includes(q)
      );
    });
  }, [accountants, searchQuery]);

  const stats = useMemo(() => {
    let classTeachersCount = 0;
    let subjectTeachersCount = 0;
    let configuredCount = 0;
    realTeachers.forEach((t) => {
      const r = resolveTeacherPermissions(t);
      if (r.isConfigured) configuredCount++;
      if (r.rolePreset === "class_teacher") classTeachersCount++;
      else if (r.rolePreset === "subject_teacher") subjectTeachersCount++;
    });
    return {
      totalTeachers: realTeachers.length,
      configuredCount,
      classTeachersCount,
      subjectTeachersCount,
      totalAccountants: accountants.length,
    };
  }, [realTeachers, accountants]);

  const persistTeacher = async (updated: SchoolTeacher, message?: string) => {
    setSavingId(updated.id);
    setLocalTeachers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    try {
      await saveTeacher(updated);
      onTeacherUpdated?.(updated);
      if (message) toast.success(message);
    } catch (err: any) {
      console.error("[RolesPermissionsManager] Save teacher failed:", err);
      toast.error("अधिकार सेव करने में त्रुटि आई। कृपया पुनः प्रयास करें।");
    } finally {
      setSavingId(null);
    }
  };

  const applyTeacherPreset = async (teacher: SchoolTeacher, presetId: TeacherRolePreset) => {
    const preset = TEACHER_ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const updated: SchoolTeacher = {
      ...teacher,
      rolePreset: preset.id,
      accessScope: preset.accessScope,
      permissions: { ...preset.permissions },
    };
    await persistTeacher(updated, `${teacher.name}: ${preset.label} रोल लागू किया गया`);
  };

  const updateTeacherScope = async (teacher: SchoolTeacher, nextScope: TeacherAccessScope) => {
    const current = resolveTeacherPermissions(teacher);
    const nextPerms: TeacherPermissions = {
      ...current.permissions,
      canViewAllStudents: nextScope === "full_school" ? true : current.permissions.canViewAllStudents && nextScope !== "assigned_subjects",
      canEnterAllSubjectsMarks: nextScope === "assigned_subjects" ? false : current.permissions.canEnterAllSubjectsMarks,
    };
    const updated: SchoolTeacher = {
      ...teacher,
      rolePreset: "custom",
      accessScope: nextScope,
      permissions: nextPerms,
    };
    await persistTeacher(updated, `${teacher.name}: डेटा सीमा अपडेट की गई`);
  };

  const toggleTeacherPermission = async (
    teacher: SchoolTeacher,
    key: keyof TeacherPermissions
  ) => {
    const current = resolveTeacherPermissions(teacher);
    const nextValue = !Boolean(current.permissions[key]);
    const updated: SchoolTeacher = {
      ...teacher,
      rolePreset: "custom",
      accessScope: current.accessScope,
      permissions: {
        ...current.permissions,
        [key]: nextValue,
      },
    };
    await persistTeacher(updated);
  };

  const toggleTeacherClass = async (teacher: SchoolTeacher, cls: SchoolClass) => {
    const currentClasses = Array.isArray(teacher.classes) ? [...teacher.classes] : [];
    const exists = currentClasses.includes(cls.id);
    const nextClasses = exists
      ? currentClasses.filter((id) => id !== cls.id)
      : [...currentClasses, cls.id];
    const current = resolveTeacherPermissions(teacher);
    const updated: SchoolTeacher = {
      ...teacher,
      classes: nextClasses,
      assignedClassId:
        !exists && !teacher.assignedClassId
          ? cls.id
          : exists && teacher.assignedClassId === cls.id
          ? nextClasses[0] || ""
          : teacher.assignedClassId,
      assignedClassName:
        !exists && !teacher.assignedClassId
          ? cls.name
          : exists && teacher.assignedClassId === cls.id
          ? classes.find((c) => c.id === nextClasses[0])?.name || ""
          : teacher.assignedClassName,
      rolePreset: current.rolePreset,
      accessScope: current.accessScope,
      permissions: current.permissions,
    };
    await persistTeacher(updated);
  };

  const setPrimaryClassTeacher = async (teacher: SchoolTeacher, classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    const currentClasses = Array.isArray(teacher.classes) ? [...teacher.classes] : [];
    const nextClasses = classId && !currentClasses.includes(classId) ? [...currentClasses, classId] : currentClasses;
    const current = resolveTeacherPermissions(teacher);
    const updated: SchoolTeacher = {
      ...teacher,
      assignedClassId: classId || undefined,
      assignedClassName: cls?.name || undefined,
      classes: nextClasses,
      rolePreset: current.rolePreset,
      accessScope: current.accessScope,
      permissions: current.permissions,
    };
    await persistTeacher(updated, classId ? `${teacher.name} को ${cls?.name} का Class Teacher बनाया गया` : "Primary Class हटाई गई");
  };

  const toggleTeacherSubject = async (teacher: SchoolTeacher, subjectName: string) => {
    const currentSubs = Array.isArray(teacher.subjects) ? [...teacher.subjects] : [];
    const exists = currentSubs.some((s) => s.trim().toLowerCase() === subjectName.trim().toLowerCase());
    const nextSubs = exists
      ? currentSubs.filter((s) => s.trim().toLowerCase() !== subjectName.trim().toLowerCase())
      : [...currentSubs, subjectName.trim()];
    const updated: SchoolTeacher = {
      ...teacher,
      subjects: nextSubs,
    };
    await persistTeacher(updated);
  };

  const persistAccountant = async (updated: SchoolAccountant, message?: string) => {
    setSavingId(updated.id);
    setAccountants((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    try {
      await saveAccountant(updated);
      if (message) toast.success(message);
    } catch (err) {
      console.error("[RolesPermissionsManager] Save accountant failed:", err);
      toast.error("Accountant अधिकार सेव नहीं हो सके।");
    } finally {
      setSavingId(null);
    }
  };

  const resolvedActiveAdminId =
    activeAdminProfileId || school.activeAdminProfileId || adminProfiles[0]?.id || "";

  const filteredAdmins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return adminProfiles.filter((p) => {
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.designation || "").toLowerCase().includes(q) ||
        (p.role || "").toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q)
      );
    });
  }, [adminProfiles, searchQuery]);

  const resetAdminForm = (defaultRole: AdminProfileRole = "principal") => {
    const preset = ADMIN_ROLE_PRESETS.find((p) => p.id === defaultRole) || ADMIN_ROLE_PRESETS[0];
    setEditingAdminId(null);
    setAdminFormName("");
    setAdminFormPhone("");
    setAdminFormEmail("");
    setAdminFormRole(preset.id);
    setAdminFormDesignation(preset.defaultDesignation);
    setAdminFormPermissions({ ...preset.permissions });
    setAdminFormActivateNow(true);
  };

  const startEditAdmin = (profile: SchoolAdminProfile) => {
    setEditingAdminId(profile.id);
    setAdminFormName(profile.name || "");
    setAdminFormPhone(profile.phone || "");
    setAdminFormEmail(profile.email || "");
    setAdminFormRole(profile.role || "custom");
    setAdminFormDesignation(profile.designation || getAdminRoleLabel(profile.role));
    setAdminFormPermissions(resolveAdminProfilePermissions(profile));
    setAdminFormActivateNow(profile.id === resolvedActiveAdminId);
    setShowAdminForm(true);
  };

  const applyRolePresetToForm = (roleId: AdminProfileRole) => {
    const preset = ADMIN_ROLE_PRESETS.find((p) => p.id === roleId);
    if (!preset) return;
    setAdminFormRole(preset.id);
    setAdminFormDesignation(preset.defaultDesignation);
    setAdminFormPermissions({ ...preset.permissions });
  };

  const saveAdminProfilesToSchool = async (
    nextProfiles: SchoolAdminProfile[],
    nextActiveId?: string,
    extraSchoolPatch?: Partial<School>,
    toastMessage?: string
  ) => {
    const patch: Partial<School> = {
      adminProfiles: nextProfiles,
      ...(nextActiveId !== undefined ? { activeAdminProfileId: nextActiveId } : {}),
      ...(extraSchoolPatch || {}),
    };
    setAdminProfiles(nextProfiles);
    await updateSchool(school.id, patch);
    onSchoolUpdated?.(patch);
    if (nextActiveId) {
      onSelectActiveAdmin?.(nextActiveId);
    }
    if (toastMessage) toast.success(toastMessage);
  };

  const buildRoleSyncPatch = (profile: SchoolAdminProfile): Partial<School> => {
    const patch: Partial<School> = {};
    if (profile.role === "principal" && (!school.principalName || profile.isPrimaryHead)) {
      patch.principalName = profile.name;
      if (profile.phone) patch.principalPhone = profile.phone;
    } else if (profile.role === "manager" && (!school.managerName || profile.isPrimaryHead)) {
      patch.managerName = profile.name;
      if (profile.phone) patch.managerPhone = profile.phone;
    } else if (profile.role === "director" && (!school.directorName || profile.isPrimaryHead)) {
      patch.directorName = profile.name;
      if (profile.phone) patch.directorPhone = profile.phone;
    } else if (profile.role === "accountant" && (!school.accountantName || profile.isPrimaryHead)) {
      patch.accountantName = profile.name;
    }
    return patch;
  };

  const handleSaveAdminForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = adminFormName.trim();
    if (!cleanedName) {
      toast.error("कृपया Admin / Principal का नाम लिखें।");
      return;
    }
    setSavingAdminForm(true);
    try {
      const nowIso = new Date().toISOString();
      const existing = editingAdminId
        ? adminProfiles.find((p) => p.id === editingAdminId)
        : undefined;
      const profileId = existing?.id || generateId("adm");
      const nextProfile: SchoolAdminProfile = {
        id: profileId,
        schoolId: school.id,
        name: cleanedName,
        role: adminFormRole,
        designation: adminFormDesignation.trim() || getAdminRoleLabel(adminFormRole),
        phone: adminFormPhone.trim() || undefined,
        email: adminFormEmail.trim() || undefined,
        active: true,
        isPrimaryHead: existing?.isPrimaryHead ?? adminProfiles.length === 0,
        permissions: { ...adminFormPermissions },
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      const nextProfiles = existing
        ? adminProfiles.map((p) => (p.id === profileId ? nextProfile : p))
        : [nextProfile, ...adminProfiles];
      const nextActiveId = adminFormActivateNow
        ? profileId
        : resolvedActiveAdminId || profileId;
      const roleSyncPatch = buildRoleSyncPatch(nextProfile);

      await saveAdminProfilesToSchool(
        nextProfiles,
        nextActiveId,
        roleSyncPatch,
        existing
          ? `✅ ${nextProfile.name} (${nextProfile.designation}) की प्रोफाइल अपडेट हुई!`
          : `✅ ${nextProfile.name} (${nextProfile.designation}) Admin Profile जुड़ गई!`
      );
      setExpandedAdminId(profileId);
      setShowAdminForm(false);
      resetAdminForm("principal");
    } catch (err) {
      console.error("[RolesPermissionsManager] Failed to save admin profile:", err);
      toast.error("Admin Profile सेव करने में त्रुटि आई।");
    } finally {
      setSavingAdminForm(false);
    }
  };

  const persistAdminProfile = async (updated: SchoolAdminProfile, message?: string) => {
    setSavingId(updated.id);
    const nextProfiles = adminProfiles.map((p) =>
      p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p
    );
    try {
      await saveAdminProfilesToSchool(nextProfiles, undefined, undefined, message);
    } catch (err) {
      console.error("[RolesPermissionsManager] Save admin failed:", err);
      toast.error("Admin अधिकार सेव नहीं हो सके।");
    } finally {
      setSavingId(null);
    }
  };

  const handleActivateAdminProfile = async (profile: SchoolAdminProfile) => {
    setSavingId(profile.id);
    try {
      await saveAdminProfilesToSchool(
        adminProfiles,
        profile.id,
        undefined,
        `✅ अब सक्रिय एडमिन: ${profile.name} (${profile.designation})`
      );
    } catch (err) {
      console.error("[RolesPermissionsManager] Activate admin failed:", err);
      toast.error("Admin स्विच नहीं हो सका।");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteAdminProfile = async (profile: SchoolAdminProfile) => {
    setSavingId(profile.id);
    try {
      const nextProfiles = adminProfiles.filter((p) => p.id !== profile.id);
      const nextActiveId =
        resolvedActiveAdminId === profile.id ? nextProfiles[0]?.id || "" : resolvedActiveAdminId;
      await saveAdminProfilesToSchool(
        nextProfiles,
        nextActiveId,
        undefined,
        `🗑️ ${profile.name} की Admin Profile हटाई गई`
      );
      setConfirmDeleteAdminId(null);
    } catch (err) {
      console.error("[RolesPermissionsManager] Delete admin failed:", err);
      toast.error("Admin Profile हटाई नहीं जा सकी।");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header Surface */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>अधिकार नियंत्रण केंद्र · Role &amp; Access Governance</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Roles &amp; Permissions Matrix (शिक्षक व अकाउंटेंट अधिकार)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              यहाँ से तय करें कि कौन शिक्षक केवल अपनी कक्षा या अपने विषय का डेटा व अंक संभालेगा, और किस अकाउंटेंट को फीस, एडमिशन, छूट सीमा या रसीद रद्द करने की अनुमति होगी।
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenTeachersDirectory && (
              <button
                type="button"
                onClick={onOpenTeachersDirectory}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                Staff Directory खोलें
              </button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                Dashboard पर जाएं
              </button>
            )}
          </div>
        </div>

        {/* Clean 4-Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Admin / Principal Profiles</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
              {adminProfiles.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">कुल शिक्षक (Teachers)</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
              {stats.totalTeachers}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Class / Subject Teachers</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums mt-0.5">
              {stats.classTeachersCount} / {stats.subjectTeachersCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">कुल Accountants</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
              {stats.totalAccountants}
            </p>
          </div>
        </div>
      </div>

      {/* BharatPe / UPI Screenshot Alert Receiver Assignment */}
      <UpiAlertReceiverSelector
        school={school}
        schoolId={school.id}
        teachers={localTeachers}
        accountants={accountants}
      />

      {/* Controls Bar: Role Type Tabs + Search + Filter */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("admins")}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "admins"
                ? "bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Crown className="w-4 h-4 shrink-0" />
            <span>Admin / Principal ({adminProfiles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("teachers")}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "teachers"
                ? "bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>Teachers ({realTeachers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("accountants")}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "accountants"
                ? "bg-white dark:bg-amber-500 text-slate-900 dark:text-slate-950 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>Accountants ({accountants.length})</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 md:max-w-xl justify-end">
          {activeTab === "teachers" && (
            <select
              value={presetFilter}
              onChange={(e) => setPresetFilter(e.target.value as any)}
              aria-label="Filter by teacher role"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="all">All Roles (सभी शिक्षक)</option>
              <option value="class_teacher">Class Teacher</option>
              <option value="subject_teacher">Subject Teacher</option>
              <option value="coordinator">Coordinator / Full</option>
              <option value="custom">Custom Role</option>
            </select>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "admins"
                  ? "Admin का नाम, पद (Principal / Manager / Accountant) या फोन खोजें..."
                  : activeTab === "teachers"
                  ? "नाम, फोन, विषय या Emp ID से खोजें..."
                  : "Accountant का नाम या फोन खोजें..."
              }
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500"
            />
          </div>
          {activeTab === "admins" && (
            <button
              type="button"
              onClick={() => {
                if (showAdminForm && !editingAdminId) {
                  setShowAdminForm(false);
                } else {
                  resetAdminForm("principal");
                  setShowAdminForm(true);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>नई Admin / Principal Profile जोड़ें</span>
            </button>
          )}
        </div>
      </div>

      {/* ADMINS / PRINCIPAL / MANAGER PROFILES & POWERS */}
      {activeTab === "admins" && (
        <div className="space-y-4">
          {/* Info Strip */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Admin कौन चला रहा है? Principal, Manager, Director या Accountant तय करें</span>
              </p>
              <p className="text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80">
                यहाँ से अलग-अलग Admin प्रोफाइल जोड़ें — हर Admin का नाम, पद और उनके पास कौन-कौन से Powers (फीस, छूट सीमा, रसीद रद्द, स्टाफ, बस, सेटिंग्स) रहेंगे चुनें।
              </p>
            </div>
            {!showAdminForm && (
              <button
                type="button"
                onClick={() => {
                  resetAdminForm("principal");
                  setShowAdminForm(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Principal / Admin</span>
              </button>
            )}
          </div>

          {/* Add / Edit Admin Profile Form */}
          {showAdminForm && (
            <form
              onSubmit={handleSaveAdminForm}
              className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-600/40 p-4 sm:p-6 space-y-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-emerald-500" />
                    <span>
                      {editingAdminId
                        ? "Admin Profile अपडेट करें"
                        : "नई Admin / Principal / Manager Profile जोड़ें"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    नाम, पद (Principal / Manager / Accountant) और नीचे दिए गए Powers चुनें।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminForm(false);
                    setEditingAdminId(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Close form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Role Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  1. पद चुनें (Admin Role Type — यह व्यक्ति क्या हैं?)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {ADMIN_ROLE_PRESETS.map((preset) => {
                    const selected = adminFormRole === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyRolePresetToForm(preset.id)}
                        title={preset.summary}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          selected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400"
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">{preset.label}</div>
                        <div className={`text-[10px] mt-0.5 ${selected ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
                          {preset.hindiLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Admin का पूरा नाम *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminFormName}
                    onChange={(e) => setAdminFormName(e.target.value)}
                    placeholder="जैसे: डॉ. सुरेश वर्मा / अमित गुप्ता"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    कस्टम पद / Designation
                  </label>
                  <input
                    type="text"
                    value={adminFormDesignation}
                    onChange={(e) => setAdminFormDesignation(e.target.value)}
                    placeholder="जैसे: Principal / Manager / Accountant"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    मोबाइल नंबर (Optional)
                  </label>
                  <input
                    type="tel"
                    value={adminFormPhone}
                    onChange={(e) => setAdminFormPhone(e.target.value)}
                    placeholder="10-digit Mobile"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    ईमेल (Optional)
                  </label>
                  <input
                    type="email"
                    value={adminFormEmail}
                    onChange={(e) => setAdminFormEmail(e.target.value)}
                    placeholder="admin@school.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Max Discount Limit */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    अधिकतम फीस छूट सीमा (Max Discount Power %)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    इस Admin के पास कितने प्रतिशत तक फीस माफ/छूट करने का अधिकार होगा।
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {[0, 10, 20, 50, 100].map((pct) => {
                    const active = (adminFormPermissions.maxDiscountLimitPct ?? 100) === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setAdminFormPermissions((prev) => ({
                            ...prev,
                            canGrantDiscount: pct > 0,
                            maxDiscountLimitPct: pct,
                          }))
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer ${
                          active
                            ? "bg-emerald-600 text-white"
                            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Power Checklist */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    2. इस Admin के पास कौन-कौन सा Power रहेगा? (Powers Checklist)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdminFormPermissions({ ...DEFAULT_ADMIN_FULL_PERMISSIONS })}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    सभी Powers ON करें (Full Control)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {ADMIN_PERMISSION_ITEMS.map((item) => {
                    const enabled = Boolean(adminFormPermissions[item.key]);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setAdminFormPermissions((prev) => ({
                            ...prev,
                            [item.key]: !enabled,
                            ...(item.key === "canGrantDiscount" && enabled
                              ? { maxDiscountLimitPct: 0 }
                              : item.key === "canGrantDiscount" && !enabled && prev.maxDiscountLimitPct === 0
                              ? { maxDiscountLimitPct: 10 }
                              : {}),
                          }))
                        }
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                          enabled
                            ? item.safeguard
                              ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white"
                              : "bg-emerald-600/10 border-emerald-500/40 text-slate-900 dark:text-white"
                            : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                            enabled
                              ? item.safeguard
                                ? "bg-amber-500 text-slate-950"
                                : "bg-emerald-600 text-white"
                              : "bg-slate-200 dark:bg-slate-800 text-transparent"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold leading-snug flex items-center gap-1.5">
                            <span className="truncate">{item.label}</span>
                            {item.safeguard && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminFormActivateNow}
                    onChange={(e) => setAdminFormActivateNow(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                  <span>सेव करने के बाद अभी इसी Admin प्रोफाइल को Active करें</span>
                </label>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminForm(false);
                      setEditingAdminId(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    रद्द करें
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdminForm}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {savingAdminForm
                        ? "सेव हो रहा है..."
                        : editingAdminId
                        ? "Profile अपडेट करें"
                        : "Admin Profile सेव करें"}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Existing Admin Profiles List */}
          {filteredAdmins.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <Crown className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                अभी कोई अलग Admin / Principal Profile नहीं बनी है
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                ऊपर दिए फॉर्म से Principal, Manager, Director या Accountant की Profile जोड़ें ताकि पैनल को पता रहे कि अभी कौन Admin चला रहा है और उनके पास क्या Power है।
              </p>
            </div>
          ) : (
            filteredAdmins.map((profile) => {
              const perms = resolveAdminProfilePermissions(profile);
              const isActiveAdmin = profile.id === resolvedActiveAdminId;
              const isExpanded = expandedAdminId === profile.id || filteredAdmins.length <= 2;
              const isSaving = savingId === profile.id;
              const enabledPowerCount = ADMIN_PERMISSION_ITEMS.filter((it) => Boolean(perms[it.key])).length;

              return (
                <div
                  key={profile.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border transition overflow-hidden ${
                    isActiveAdmin
                      ? "border-emerald-500 dark:border-emerald-500/80 shadow-sm"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Card Summary */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                          isActiveAdmin
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 dark:bg-slate-700 text-white"
                        }`}
                      >
                        {(profile.name || "A").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {profile.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                            {profile.designation || getAdminRoleLabel(profile.role)}
                          </span>
                          {isActiveAdmin && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                              ACTIVE NOW
                            </span>
                          )}
                          {isSaving && (
                            <span className="text-[11px] font-medium text-emerald-500 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              सेव हो रहा है...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap mt-1">
                          {profile.phone && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Phone className="w-3 h-3" />
                              {profile.phone}
                            </span>
                          )}
                          {profile.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {profile.email}
                            </span>
                          )}
                          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                            Powers: {enabledPowerCount}/{ADMIN_PERMISSION_ITEMS.length}
                          </span>
                          <span className="tabular-nums">
                            छूट सीमा: {perms.canGrantDiscount ? `${perms.maxDiscountLimitPct}%` : "0%"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isActiveAdmin && (
                        <button
                          type="button"
                          onClick={() => handleActivateAdminProfile(profile)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>अभी Active करें</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditAdmin(profile)}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>नाम/पद बदलें</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedAdminId((prev) => (prev === profile.id ? null : profile.id))
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{isExpanded ? "Powers समेटें" : "Powers बदलें"}</span>
                      </button>
                      {confirmDeleteAdminId === profile.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteAdminProfile(profile)}
                            className="px-2.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                          >
                            Confirm हटाएं
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAdminId(null)}
                            className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            नहीं
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAdminId(profile.id)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title="Admin Profile हटाएं"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Live Power Matrix */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Role Preset बदलें (1-टैप):
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ADMIN_ROLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                persistAdminProfile(
                                  {
                                    ...profile,
                                    role: preset.id,
                                    designation: preset.defaultDesignation,
                                    permissions: { ...preset.permissions },
                                  },
                                  `${profile.name}: ${preset.label} रोल और Powers लागू हुए`
                                )
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                                profile.role === preset.id
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            अधिकतम फीस छूट सीमा (Discount Limit %)
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            फ़ीस जमा करते समय कितनी अधिकतम छूट दी जा सकती है।
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[0, 10, 20, 50, 100].map((pct) => {
                            const active = (perms.maxDiscountLimitPct ?? 100) === pct;
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() =>
                                  persistAdminProfile(
                                    {
                                      ...profile,
                                      permissions: {
                                        ...perms,
                                        canGrantDiscount: pct > 0,
                                        maxDiscountLimitPct: pct,
                                      },
                                    },
                                    `${profile.name}: छूट सीमा ${pct}% सेट की गई`
                                  )
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer ${
                                  active
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                }`}
                              >
                                {pct}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {ADMIN_PERMISSION_ITEMS.map((item) => {
                          const enabled = Boolean(perms[item.key]);
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
                                persistAdminProfile({
                                  ...profile,
                                  permissions: {
                                    ...perms,
                                    [item.key]: !enabled,
                                  },
                                })
                              }
                              className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                                enabled
                                  ? item.safeguard
                                    ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white"
                                    : "bg-emerald-600/10 border-emerald-500/40 text-slate-900 dark:text-white"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                  enabled
                                    ? item.safeguard
                                      ? "bg-amber-500 text-slate-950"
                                      : "bg-emerald-600 text-white"
                                    : "bg-slate-200 dark:bg-slate-800 text-transparent"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold leading-snug flex items-center gap-1.5">
                                  <span className="truncate">{item.label}</span>
                                  {item.safeguard && (
                                    <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                                  {item.desc}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TEACHERS MATRIX */}
      {activeTab === "teachers" && (
        <div className="space-y-4">
          {filteredTeachers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                कोई शिक्षक नहीं मिला
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                पहले Teachers &amp; Faculty से शिक्षक जोड़ें या खोज फ़िल्टर साफ़ करें।
              </p>
              {onOpenTeachersDirectory && (
                <button
                  type="button"
                  onClick={onOpenTeachersDirectory}
                  className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Teachers Directory में जाएं
                </button>
              )}
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const resolved = resolveTeacherPermissions(teacher);
              const isExpanded = expandedStaffId === teacher.id || filteredTeachers.length <= 4;
              const isSaving = savingId === teacher.id;
              const assignedClassObjs = classes.filter(
                (c) =>
                  (teacher.classes || []).includes(c.id) ||
                  teacher.assignedClassId === c.id
              );

              return (
                <div
                  key={teacher.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                  {/* Top Summary Bar */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden">
                        {teacher.photoUrl ? (
                          <img
                            src={teacher.photoUrl}
                            alt={teacher.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          (teacher.name || "T").charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {teacher.name}
                          </h3>
                          {isSaving && (
                            <span className="text-[11px] font-medium text-indigo-500 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              सेव हो रहा है...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap mt-0.5">
                          <span>{teacher.designation || "Faculty"}</span>
                          {teacher.employeeId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{teacher.employeeId}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>
                            {resolved.accessScope === "assigned_class"
                              ? `Class Scope (${assignedClassObjs.length || 0} Class)`
                              : resolved.accessScope === "assigned_subjects"
                              ? `Subject Scope (${teacher.subjects?.length || 0} Subjects)`
                              : "Full School Scope"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Role Presets */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                        {TEACHER_ROLE_PRESETS.map((preset) => {
                          const active = resolved.rolePreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyTeacherPreset(teacher, preset.id)}
                              title={preset.summary}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                                active
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStaffId((prev) => (prev === teacher.id ? null : teacher.id))
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{isExpanded ? "कंट्रोल समेटें" : "अधिकार बदलें"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Configuration Matrix */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-5 bg-slate-50/50 dark:bg-slate-950/30">
                      {/* Row 1: Data Scope + Primary Class Teacher */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                            1. डेटा व क्लास नियंत्रण सीमा (Data Access Scope)
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              {
                                id: "assigned_class" as TeacherAccessScope,
                                title: "Assigned Class",
                                sub: "केवल अपनी कक्षाएं",
                              },
                              {
                                id: "assigned_subjects" as TeacherAccessScope,
                                title: "Subject Only",
                                sub: "केवल अपने विषय",
                              },
                              {
                                id: "full_school" as TeacherAccessScope,
                                title: "Full School",
                                sub: "सभी कक्षाएं व विषय",
                              },
                            ].map((opt) => {
                              const selected = resolved.accessScope === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => updateTeacherScope(teacher, opt.id)}
                                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                    selected
                                      ? "bg-indigo-600/10 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="text-xs font-bold">{opt.title}</div>
                                  <div className="text-[11px] opacity-80 mt-0.5">{opt.sub}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                            2. मुख्य Class Teacher कक्षा (Primary Class)
                          </label>
                          <select
                            value={teacher.assignedClassId || ""}
                            onChange={(e) => setPrimaryClassTeacher(teacher, e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          >
                            <option value="">-- कोई मुख्य कक्षा नहीं (Subject Teacher / General) --</option>
                            {classes.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name} {cls.section ? `(Sec ${cls.section})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Classes & Subjects Assignment */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              3. आवंटित कक्षाएं (Allowed Classes: {assignedClassObjs.length})
                            </span>
                            {resolved.accessScope === "full_school" && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Full School सक्रिय — सभी कक्षाएं खुली हैं
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {classes.map((cls) => {
                              const checked =
                                (teacher.classes || []).includes(cls.id) ||
                                teacher.assignedClassId === cls.id;
                              return (
                                <button
                                  key={cls.id}
                                  type="button"
                                  onClick={() => toggleTeacherClass(teacher, cls)}
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                                    checked
                                      ? "bg-emerald-600 text-white border-emerald-600"
                                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                  <span>{cls.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              4. पढ़ाए जाने वाले विषय (Allowed Subjects: {teacher.subjects?.length || 0})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {availableSubjectNames.map((subName) => {
                              const checked = (teacher.subjects || []).some(
                                (s) => s.trim().toLowerCase() === subName.trim().toLowerCase()
                              );
                              return (
                                <button
                                  key={subName}
                                  type="button"
                                  onClick={() => toggleTeacherSubject(teacher, subName)}
                                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                                    checked
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                  <span>{subName}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={customSubjectDraft[teacher.id] || ""}
                              onChange={(e) =>
                                setCustomSubjectDraft((prev) => ({
                                  ...prev,
                                  [teacher.id]: e.target.value,
                                }))
                              }
                              placeholder="नया विषय जोड़ें (जैसे: Urdu, Physics)..."
                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const val = (customSubjectDraft[teacher.id] || "").trim();
                                if (!val) return;
                                await toggleTeacherSubject(teacher, val);
                                setCustomSubjectDraft((prev) => ({ ...prev, [teacher.id]: "" }));
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>जोड़ें</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Feature Toggles */}
                      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            5. कार्य और मॉड्यूल अधिकार (Module Permissions)
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            बंद किए गए विकल्प शिक्षक के मेनू से अपने आप हट जाएंगे
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {TEACHER_PERMISSION_ITEMS.map((item) => {
                            const enabled = Boolean(resolved.permissions[item.key]);
                            const isSafeguard = item.category === "admin_safeguard";
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => toggleTeacherPermission(teacher, item.key)}
                                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                                  enabled
                                    ? isSafeguard
                                      ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white"
                                      : "bg-indigo-600/10 border-indigo-500/40 text-slate-900 dark:text-white"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                    enabled
                                      ? isSafeguard
                                        ? "bg-amber-500 text-slate-950"
                                        : "bg-indigo-600 text-white"
                                      : "bg-slate-200 dark:bg-slate-800 text-transparent"
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold leading-snug flex items-center gap-1.5">
                                    <span className="truncate">{item.label}</span>
                                    {isSafeguard && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                                  </div>
                                  <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                                    {item.desc}
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                          {/* Referral Incentive Toggle */}
                          <button
                            type="button"
                            onClick={() =>
                              persistTeacher(
                                {
                                  ...teacher,
                                  hasReferralIncentive: !teacher.hasReferralIncentive,
                                },
                                `${teacher.name}: Referral Incentive ${
                                  !teacher.hasReferralIncentive ? "ON" : "OFF"
                                }`
                              )
                            }
                            className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                              teacher.hasReferralIncentive
                                ? "bg-emerald-600/10 border-emerald-500/40 text-slate-900 dark:text-white"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                teacher.hasReferralIncentive
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 dark:bg-slate-800 text-transparent"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold leading-snug">
                                10% Referral Incentive
                              </div>
                              <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                                नए छात्र प्रवेश पर 10% रेफरल इंसेंटिव डैशबोर्ड
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ACCOUNTANTS MATRIX */}
      {activeTab === "accountants" && (
        <div className="space-y-4">
          {loadingAccountants ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              Accountant प्रोफाइल लोड हो रही हैं...
            </div>
          ) : filteredAccountants.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
              <Briefcase className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                कोई Accountant प्रोफाइल नहीं मिली
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accountant जोड़ने के लिए Staff / Faculty Directory में नया अकाउंटेंट बनाएं या किसी शिक्षक को Accountant Role असाइन करें।
              </p>
              {onOpenTeachersDirectory && (
                <button
                  type="button"
                  onClick={onOpenTeachersDirectory}
                  className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Staff Directory खोलें
                </button>
              )}
            </div>
          ) : (
            filteredAccountants.map((acc) => {
              const perms = resolveAccountantPermissions(acc);
              const isSaving = savingId === acc.id;

              return (
                <div
                  key={acc.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
                >
                  {/* Top Header + Quick Presets */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden">
                        {acc.photoUrl ? (
                          <img
                            src={acc.photoUrl}
                            alt={acc.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          (acc.name || "A").charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {acc.name}
                          </h3>
                          {isSaving && (
                            <span className="text-[11px] font-medium text-amber-500 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              सेव हो रहा है...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap mt-0.5">
                          <span>{acc.designation || "Accountant & Cashier"}</span>
                          {acc.employeeId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{acc.employeeId}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            Discount Cap: {perms.canGrantDiscount ? `${perms.maxDiscountLimitPct ?? 10}%` : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ACCOUNTANT_ROLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            persistAccountant(
                              { ...acc, permissions: { ...preset.permissions } },
                              `${acc.name}: ${preset.label} सेटिंग लागू की गई`
                            )
                          }
                          title={preset.summary}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-500 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer whitespace-nowrap"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Discount Cap Control */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        अधिकतम फीस छूट सीमा (Max Discount Limit %)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Accountant बिना Admin की अनुमति के इस प्रतिशत से अधिक छूट नहीं दे पाएगा।
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {[0, 5, 10, 15, 20, 50].map((pct) => {
                        const active = (perms.maxDiscountLimitPct ?? 10) === pct;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              persistAccountant(
                                {
                                  ...acc,
                                  permissions: {
                                    ...perms,
                                    canGrantDiscount: pct > 0,
                                    maxDiscountLimitPct: pct,
                                  },
                                },
                                `${acc.name}: अधिकतम छूट सीमा ${pct}% सेट की गई`
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold tabular-nums transition cursor-pointer ${
                              active
                                ? "bg-amber-500 text-slate-950"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {pct === 0 ? "0%" : `${pct}%`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Accountant Permissions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {ACCOUNTANT_PERMISSION_ITEMS.map((item) => {
                      const enabled = Boolean(perms[item.key]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            persistAccountant({
                              ...acc,
                              permissions: {
                                ...perms,
                                [item.key]: !enabled,
                              },
                            })
                          }
                          className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                            enabled
                              ? item.safeguard
                                ? "bg-rose-500/10 border-rose-500/40 text-slate-900 dark:text-white"
                                : "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white"
                              : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                              enabled
                                ? item.safeguard
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-500 text-slate-950"
                                : "bg-slate-200 dark:bg-slate-800 text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-snug flex items-center gap-1.5">
                              <span className="truncate">{item.label}</span>
                              {item.safeguard && (
                                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] opacity-80 mt-0.5 leading-snug">
                              {item.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
