import type {
  AccountantPermissions,
  AdminProfilePermissions,
  AdminProfileRole,
  SchoolAccountant,
  SchoolAdminProfile,
  SchoolClass,
  SchoolSubject,
  SchoolTeacher,
  TeacherAccessScope,
  TeacherPermissions,
  TeacherRolePreset,
} from "../school-types";

export const DEFAULT_CLASS_TEACHER_PERMISSIONS: TeacherPermissions = {
  canMarkAttendance: true,
  canEnterMarks: true,
  canEnterAllSubjectsMarks: true,
  canApproveLeaves: true,
  canEditStudentProfile: false,
  canAddAdmission: false,
  canViewAllStudents: false,
  canManageHomeworkAndDiary: true,
  canManageNotesAndVideos: true,
  canBuildQuestionPapers: true,
  canMessageParents: true,
  canManageAbsentee: true,
  canManageLibrary: false,
  canSchedulePtm: true,
};

export const DEFAULT_SUBJECT_TEACHER_PERMISSIONS: TeacherPermissions = {
  canMarkAttendance: false,
  canEnterMarks: true,
  canEnterAllSubjectsMarks: false,
  canApproveLeaves: false,
  canEditStudentProfile: false,
  canAddAdmission: false,
  canViewAllStudents: false,
  canManageHomeworkAndDiary: true,
  canManageNotesAndVideos: true,
  canBuildQuestionPapers: true,
  canMessageParents: false,
  canManageAbsentee: false,
  canManageLibrary: false,
  canSchedulePtm: false,
};

export const DEFAULT_COORDINATOR_PERMISSIONS: TeacherPermissions = {
  canMarkAttendance: true,
  canEnterMarks: true,
  canEnterAllSubjectsMarks: true,
  canApproveLeaves: true,
  canEditStudentProfile: true,
  canAddAdmission: true,
  canViewAllStudents: true,
  canManageHomeworkAndDiary: true,
  canManageNotesAndVideos: true,
  canBuildQuestionPapers: true,
  canMessageParents: true,
  canManageAbsentee: true,
  canManageLibrary: true,
  canSchedulePtm: true,
};

export const DEFAULT_ACCOUNTANT_SAFE_PERMISSIONS: AccountantPermissions = {
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

export interface TeacherPresetDefinition {
  id: TeacherRolePreset;
  label: string;
  hindiLabel: string;
  summary: string;
  accessScope: TeacherAccessScope;
  permissions: TeacherPermissions;
}

export const TEACHER_ROLE_PRESETS: TeacherPresetDefinition[] = [
  {
    id: "class_teacher",
    label: "Class Teacher",
    hindiLabel: "कक्षा अध्यापक",
    summary: "अपनी कक्षा की हाजिरी, सभी विषयों के अंक, छुट्टी अप्रूवल व अभिभावक संवाद",
    accessScope: "assigned_class",
    permissions: { ...DEFAULT_CLASS_TEACHER_PERMISSIONS },
  },
  {
    id: "subject_teacher",
    label: "Subject Teacher",
    hindiLabel: "विषय शिक्षक",
    summary: "सिर्फ अपने पढ़ाए जाने वाले विषयों के अंक, नोट्स, होमवर्क व पेपर",
    accessScope: "assigned_subjects",
    permissions: { ...DEFAULT_SUBJECT_TEACHER_PERMISSIONS },
  },
  {
    id: "coordinator",
    label: "Coordinator / Incharge",
    hindiLabel: "समन्वयक / इंचार्ज",
    summary: "पूरे विद्यालय के सभी छात्र, एडमिशन, अंक, लाइब्रेरी व रिपोर्ट कंट्रोल",
    accessScope: "full_school",
    permissions: { ...DEFAULT_COORDINATOR_PERMISSIONS },
  },
];

export type AccountantPresetId = "senior_accountant" | "cashier" | "admission_accountant";

export interface AccountantPresetDefinition {
  id: AccountantPresetId;
  label: string;
  hindiLabel: string;
  summary: string;
  permissions: AccountantPermissions;
}

export const ACCOUNTANT_ROLE_PRESETS: AccountantPresetDefinition[] = [
  {
    id: "senior_accountant",
    label: "Senior Accountant",
    hindiLabel: "मुख्य लेखाकार",
    summary: "फीस, एडमिशन, खर्च, कैशबुक, अलर्ट व रसीद निरस्तीकरण (20% तक छूट)",
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
      canCancelReceipts: true,
      canEditFeeStructure: false,
    },
  },
  {
    id: "cashier",
    label: "Fee Counter Cashier",
    hindiLabel: "फीस काउंटर कैशियर",
    summary: "केवल फीस जमा, POS रसीद व दैनिक कैशबुक (रसीद रद्द/रेट बदलाव बंद)",
    permissions: {
      canCollectFee: true,
      canAdmitStudents: false,
      canGrantDiscount: false,
      maxDiscountLimitPct: 0,
      canRecordExpenses: false,
      canViewDayBook: true,
      canSendFeeAlerts: true,
      canManageBusFee: true,
      canPrintIdCards: false,
      canManageAbsentee: false,
      canCancelReceipts: false,
      canEditFeeStructure: false,
    },
  },
  {
    id: "admission_accountant",
    label: "Admission & Fee Desk",
    hindiLabel: "प्रवेश व फीस डेस्क",
    summary: "नए एडमिशन, ID कार्ड, फीस संकलन व बकाया अलर्ट (10% तक छूट)",
    permissions: {
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
    },
  },
];

export interface ResolvedTeacherAccess {
  rolePreset: TeacherRolePreset;
  accessScope: TeacherAccessScope;
  permissions: TeacherPermissions;
  isConfigured: boolean;
}

export function resolveTeacherPermissions(teacher?: SchoolTeacher | null): ResolvedTeacherAccess {
  if (!teacher) {
    return {
      rolePreset: "class_teacher",
      accessScope: "full_school",
      permissions: { ...DEFAULT_CLASS_TEACHER_PERMISSIONS },
      isConfigured: false,
    };
  }

  const hasExplicitPermissions = Boolean(teacher.permissions);
  const hasAssignedClasses = Array.isArray(teacher.classes) && teacher.classes.length > 0;
  const hasPrimaryClass = Boolean(teacher.assignedClassId || teacher.assignedClassName);

  const inferredScope: TeacherAccessScope =
    teacher.accessScope ||
    (hasExplicitPermissions
      ? hasPrimaryClass || hasAssignedClasses
        ? "assigned_class"
        : "full_school"
      : hasPrimaryClass || hasAssignedClasses
      ? "assigned_class"
      : "full_school");

  const inferredPreset: TeacherRolePreset =
    teacher.rolePreset ||
    (inferredScope === "assigned_subjects"
      ? "subject_teacher"
      : inferredScope === "full_school"
      ? "coordinator"
      : "class_teacher");

  if (teacher.permissions) {
    return {
      rolePreset: inferredPreset,
      accessScope: inferredScope,
      permissions: {
        ...DEFAULT_CLASS_TEACHER_PERMISSIONS,
        ...teacher.permissions,
      },
      isConfigured: true,
    };
  }

  // Legacy teacher without explicit permission matrix yet:
  // Preserve teaching workflows while keeping master student profile edit & admission OFF by default
  const legacyFullView = inferredScope === "full_school";
  return {
    rolePreset: inferredPreset,
    accessScope: inferredScope,
    permissions: {
      ...DEFAULT_CLASS_TEACHER_PERMISSIONS,
      canViewAllStudents: legacyFullView,
      canManageLibrary: true,
      canEditStudentProfile: false,
      canAddAdmission: false,
      canEnterAllSubjectsMarks: inferredScope !== "assigned_subjects",
    },
    isConfigured: false,
  };
}

export function resolveAccountantPermissions(accountant?: SchoolAccountant | null): AccountantPermissions {
  const raw = accountant?.permissions;
  if (!raw) {
    return { ...DEFAULT_ACCOUNTANT_SAFE_PERMISSIONS };
  }
  return {
    ...DEFAULT_ACCOUNTANT_SAFE_PERMISSIONS,
    ...raw,
    maxDiscountLimitPct:
      raw.maxDiscountLimitPct !== undefined && raw.maxDiscountLimitPct !== null
        ? Math.max(0, Math.min(100, Number(raw.maxDiscountLimitPct) || 0))
        : 10,
    canCancelReceipts: Boolean(raw.canCancelReceipts),
    canEditFeeStructure: Boolean(raw.canEditFeeStructure),
  };
}

const normalizeToken = (val?: string | null) =>
  String(val || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export function getTeacherScopedClasses(
  teacher: SchoolTeacher | null | undefined,
  allClasses: SchoolClass[]
): SchoolClass[] {
  const { accessScope } = resolveTeacherPermissions(teacher);
  if (!teacher || accessScope === "full_school") {
    return allClasses;
  }

  const allowedTokens = new Set<string>();
  if (teacher.assignedClassId) allowedTokens.add(normalizeToken(teacher.assignedClassId));
  if (teacher.assignedClassName) allowedTokens.add(normalizeToken(teacher.assignedClassName));
  if (Array.isArray(teacher.classes)) {
    teacher.classes.forEach((c) => {
      const tok = normalizeToken(c);
      if (tok) allowedTokens.add(tok);
    });
  }

  // If teacher has no explicit permissions yet AND zero classes assigned, keep legacy fallback
  if (allowedTokens.size === 0) {
    return teacher.permissions ? [] : allClasses;
  }

  return allClasses.filter((cls) => {
    const idMatch = allowedTokens.has(normalizeToken(cls.id));
    const nameMatch = allowedTokens.has(normalizeToken(cls.name));
    const baseNameMatch = allowedTokens.has(
      normalizeToken(String(cls.name || "").replace(/\s*-\s*[A-Z0-9]+$/i, ""))
    );
    return idMatch || nameMatch || baseNameMatch;
  });
}

export function getTeacherAllowedSubjectTokens(teacher?: SchoolTeacher | null): string[] {
  if (!teacher || !Array.isArray(teacher.subjects)) return [];
  return teacher.subjects.map((s) => normalizeToken(s)).filter(Boolean);
}

export function isSubjectAllowedForTeacher(
  subject: Pick<SchoolSubject, "id" | "name"> | string,
  allowedSubjectNames?: string[]
): boolean {
  if (!allowedSubjectNames || allowedSubjectNames.length === 0) return true;
  const tokens = allowedSubjectNames.map((s) => normalizeToken(s)).filter(Boolean);
  if (tokens.length === 0) return true;
  if (typeof subject === "string") {
    const target = normalizeToken(subject);
    return tokens.some((t) => target === t || target.includes(t) || t.includes(target));
  }
  const idTok = normalizeToken(subject.id);
  const nameTok = normalizeToken(subject.name);
  return tokens.some(
    (t) => nameTok === t || idTok === t || nameTok.includes(t) || t.includes(nameTok)
  );
}

export const DEFAULT_ADMIN_FULL_PERMISSIONS: AdminProfilePermissions = {
  canManageFees: true,
  canGrantDiscount: true,
  maxDiscountLimitPct: 100,
  canCancelReceipts: true,
  canEditFeeStructure: true,
  canManageExpensesAndCashbook: true,
  canManageAdmissionsAndStudents: true,
  canDeleteStudents: true,
  canManageAttendanceAndLeaves: true,
  canManageExamsAndResults: true,
  canManageStaffAndRoles: true,
  canManageTransport: true,
  canEditSchoolProfileAndSettings: true,
};

export interface AdminRolePresetDefinition {
  id: AdminProfileRole;
  label: string;
  hindiLabel: string;
  defaultDesignation: string;
  summary: string;
  permissions: AdminProfilePermissions;
}

export const ADMIN_ROLE_PRESETS: AdminRolePresetDefinition[] = [
  {
    id: "principal",
    label: "Principal",
    hindiLabel: "प्रधानाचार्य",
    defaultDesignation: "Principal",
    summary: "पूरे विद्यालय का शैक्षणिक, छात्र, स्टाफ, परीक्षा व अनुमोदन नियंत्रण",
    permissions: { ...DEFAULT_ADMIN_FULL_PERMISSIONS },
  },
  {
    id: "manager",
    label: "Manager",
    hindiLabel: "मैनेजर",
    defaultDesignation: "Manager",
    summary: "प्रबंधन, फीस, खर्च, स्टाफ, बस व सेटिंग्स का पूरा अधिकार",
    permissions: { ...DEFAULT_ADMIN_FULL_PERMISSIONS },
  },
  {
    id: "director",
    label: "Director",
    hindiLabel: "डायरेक्टर",
    defaultDesignation: "Director",
    summary: "संस्थापक / डायरेक्टर — सभी मॉड्यूल व वित्तीय निर्णय का पूर्ण अधिकार",
    permissions: { ...DEFAULT_ADMIN_FULL_PERMISSIONS },
  },
  {
    id: "accountant",
    label: "Accountant",
    hindiLabel: "अकाउंटेंट",
    defaultDesignation: "Accountant / Cashier",
    summary: "फीस वसूली, खर्च/कैशबुक, एडमिशन व ट्रांसपोर्ट ड्यूज (रेट/डिलीट/सेटिंग्स बंद)",
    permissions: {
      canManageFees: true,
      canGrantDiscount: true,
      maxDiscountLimitPct: 10,
      canCancelReceipts: false,
      canEditFeeStructure: false,
      canManageExpensesAndCashbook: true,
      canManageAdmissionsAndStudents: true,
      canDeleteStudents: false,
      canManageAttendanceAndLeaves: false,
      canManageExamsAndResults: false,
      canManageStaffAndRoles: false,
      canManageTransport: true,
      canEditSchoolProfileAndSettings: false,
    },
  },
  {
    id: "vice_principal",
    label: "Vice Principal / Coordinator",
    hindiLabel: "उप-प्रधानाचार्य / इंचार्ज",
    defaultDesignation: "Vice Principal",
    summary: "हाजिरी, छात्र, प्रवेश, परीक्षा व कम्युनिकेशन कंट्रोल (रसीद रद्द/सेटिंग्स बंद)",
    permissions: {
      canManageFees: false,
      canGrantDiscount: false,
      maxDiscountLimitPct: 0,
      canCancelReceipts: false,
      canEditFeeStructure: false,
      canManageExpensesAndCashbook: false,
      canManageAdmissionsAndStudents: true,
      canDeleteStudents: false,
      canManageAttendanceAndLeaves: true,
      canManageExamsAndResults: true,
      canManageStaffAndRoles: false,
      canManageTransport: true,
      canEditSchoolProfileAndSettings: false,
    },
  },
  {
    id: "custom",
    label: "Custom Role",
    hindiLabel: "कस्टम एडमिन",
    defaultDesignation: "Office Admin",
    summary: "अपनी जरूरत के अनुसार हर पावर को अलग से चालू या बंद करें",
    permissions: {
      ...DEFAULT_ADMIN_FULL_PERMISSIONS,
      canCancelReceipts: false,
      canEditFeeStructure: false,
      canDeleteStudents: false,
      canEditSchoolProfileAndSettings: false,
    },
  },
];

export interface AdminPermissionItemMeta {
  key: Exclude<keyof AdminProfilePermissions, "maxDiscountLimitPct">;
  label: string;
  desc: string;
  safeguard?: boolean;
}

export const ADMIN_PERMISSION_ITEMS: AdminPermissionItemMeta[] = [
  {
    key: "canManageFees",
    label: "Fee Collection & Tagada (फीस वसूली)",
    desc: "फीस जमा, रसीद, QR पे, बकाया तगादा व अलर्ट",
  },
  {
    key: "canGrantDiscount",
    label: "Fee Discount Power (छूट देने का अधिकार)",
    desc: "तय सीमा के भीतर छात्र को फीस छूट देना",
  },
  {
    key: "canManageExpensesAndCashbook",
    label: "Expense & Cashbook (खर्च व कैशबुक)",
    desc: "दैनिक खर्च वाउचर, कैशबुक व स्कूल स्टोर",
  },
  {
    key: "canManageAdmissionsAndStudents",
    label: "Students & Admissions (छात्र व प्रवेश)",
    desc: "छात्र सूची, नया प्रवेश, भाई-बहन व ID कार्ड",
  },
  {
    key: "canManageAttendanceAndLeaves",
    label: "Attendance & Leaves (हाजिरी व छुट्टी)",
    desc: "दैनिक हाजिरी, गैरहाजिर कॉल, छुट्टी व गेट पास",
  },
  {
    key: "canManageExamsAndResults",
    label: "Classes, Exams & Results (परीक्षा व पढ़ाई)",
    desc: "कक्षा, होमवर्क, अंक, मार्कशीट, टीसी व कम्युनिकेशन",
  },
  {
    key: "canManageTransport",
    label: "Bus & Live GPS Tracking (बस व लोकेशन)",
    desc: "लाइव बस मैप, रूट, स्टॉप व डीजल/फिटनेस लॉग",
  },
  {
    key: "canCancelReceipts",
    label: "Cancel Fee Receipts (रसीद रद्द करना)",
    desc: "संवेदनशील: जमा रसीद निरस्त व रिफंड हिस्ट्री",
    safeguard: true,
  },
  {
    key: "canEditFeeStructure",
    label: "Edit Fee Structure & Rates (फीस रेट बदलाव)",
    desc: "संवेदनशील: मासिक/वार्षिक फीस दरें व टर्म शुल्क बदलना",
    safeguard: true,
  },
  {
    key: "canDeleteStudents",
    label: "Delete / Remove Students (छात्र हटाना)",
    desc: "संवेदनशील: छात्र प्रोफाइल डिलीट करना",
    safeguard: true,
  },
  {
    key: "canManageStaffAndRoles",
    label: "Staff, Salary & Roles (स्टाफ व अधिकार)",
    desc: "संवेदनशील: शिक्षक, अकाउंटेंट, सैलरी व पावर बदलना",
    safeguard: true,
  },
  {
    key: "canEditSchoolProfileAndSettings",
    label: "School Settings & Backup (सेटिंग्स व बैकअप)",
    desc: "संवेदनशील: स्कूल प्रोफाइल, लॉक कोड, बैकअप व वेबसाइट",
    safeguard: true,
  },
];

export function getAdminRoleLabel(role?: AdminProfileRole | string, designation?: string): string {
  if (designation && designation.trim()) return designation.trim();
  const preset = ADMIN_ROLE_PRESETS.find((p) => p.id === role);
  return preset ? preset.label : "School Admin";
}

export function resolveAdminProfilePermissions(
  profile?: SchoolAdminProfile | null
): AdminProfilePermissions {
  if (!profile) {
    return { ...DEFAULT_ADMIN_FULL_PERMISSIONS };
  }
  const raw = profile.permissions || ({} as Partial<AdminProfilePermissions>);
  return {
    ...DEFAULT_ADMIN_FULL_PERMISSIONS,
    ...raw,
    maxDiscountLimitPct:
      raw.maxDiscountLimitPct !== undefined && raw.maxDiscountLimitPct !== null
        ? Math.max(0, Math.min(100, Number(raw.maxDiscountLimitPct) || 0))
        : raw.canGrantDiscount === false
        ? 0
        : 100,
  };
}

export function isAdminProfileFullPower(profile?: SchoolAdminProfile | null): boolean {
  if (!profile) return true;
  const p = resolveAdminProfilePermissions(profile);
  return (
    p.canManageFees &&
    p.canGrantDiscount &&
    p.canCancelReceipts &&
    p.canEditFeeStructure &&
    p.canManageExpensesAndCashbook &&
    p.canManageAdmissionsAndStudents &&
    p.canDeleteStudents &&
    p.canManageAttendanceAndLeaves &&
    p.canManageExamsAndResults &&
    p.canManageStaffAndRoles &&
    p.canManageTransport &&
    p.canEditSchoolProfileAndSettings
  );
}

export function isAdminViewAllowedForProfile(
  viewId: string,
  profile?: SchoolAdminProfile | null
): { allowed: boolean; requiredPowerLabel?: string } {
  if (!profile || !profile.active) {
    return { allowed: true };
  }
  // Never block home dashboard, account hub, or public website preview
  if (
    viewId === "dashboard" ||
    viewId === "account_hub" ||
    viewId === "public_website"
  ) {
    return { allowed: true };
  }
  const p = resolveAdminProfilePermissions(profile);

  if (
    viewId === "fees" ||
    viewId === "fee_class" ||
    viewId === "fee_all" ||
    viewId === "fee_tagada" ||
    viewId === "qr_pay" ||
    viewId === "discount_list" ||
    viewId === "fee_alerts" ||
    viewId === "admission_kit"
  ) {
    return p.canManageFees
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Fee Collection & Tagada (फीस वसूली)" };
  }

  if (viewId === "receipt_cancellation") {
    return p.canCancelReceipts
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Cancel Fee Receipts (रसीद रद्द करना)" };
  }

  if (
    viewId === "fee_structure" ||
    viewId === "term_scheduler" ||
    viewId === "razorpay_setup" ||
    viewId === "receipt_header"
  ) {
    return p.canEditFeeStructure
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Edit Fee Structure & Rates (फीस रेट बदलाव)" };
  }

  if (viewId === "expenses" || viewId === "inventory_store") {
    return p.canManageExpensesAndCashbook
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Expense & Cashbook (खर्च व कैशबुक)" };
  }

  if (
    viewId === "students" ||
    viewId === "online_admissions" ||
    viewId === "id_cards" ||
    viewId === "sibling_profiles" ||
    viewId === "readmission" ||
    viewId === "enquiry_crm"
  ) {
    return p.canManageAdmissionsAndStudents
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Students & Admissions (छात्र व प्रवेश)" };
  }

  if (
    viewId === "attendance" ||
    viewId === "absentee" ||
    viewId === "leaves_desk" ||
    viewId === "face_kiosk" ||
    viewId === "visitor_security"
  ) {
    return p.canManageAttendanceAndLeaves
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Attendance & Leaves (हाजिरी व छुट्टी)" };
  }

  if (
    viewId === "teachers" ||
    viewId === "staff_hrm" ||
    viewId === "accounts_directory"
  ) {
    return p.canManageStaffAndRoles
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Staff, Salary & Roles (स्टाफ व अधिकार)" };
  }

  if (
    viewId === "bus_transport" ||
    viewId === "bus_logbook" ||
    viewId === "live_bus_map"
  ) {
    return p.canManageTransport
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Bus & Live GPS Tracking (बस व लोकेशन)" };
  }

  if (
    viewId === "school_profile" ||
    viewId === "backup_recovery" ||
    viewId === "multi_branch" ||
    viewId === "website_cms" ||
    viewId === "crash_reports" ||
    viewId === "sessions" ||
    viewId === "subscription"
  ) {
    return p.canEditSchoolProfileAndSettings
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "School Settings & Backup (सेटिंग्स व बैकअप)" };
  }

  // Remaining academic, exam, certificate, communication views
  if (
    viewId === "classes" ||
    viewId === "homework" ||
    viewId === "student_growth_safety" ||
    viewId === "class_notes_manager" ||
    viewId === "video_lectures" ||
    viewId === "library" ||
    viewId === "syllabus_pacing" ||
    viewId === "entrance_test_hub" ||
    viewId === "digital_paper_library" ||
    viewId === "question_paper_builder" ||
    viewId === "admit_cards" ||
    viewId === "marks" ||
    viewId === "results" ||
    viewId === "marksheet_hub" ||
    viewId === "certificates" ||
    viewId === "document_templates" ||
    viewId === "reports_hub" ||
    viewId === "doc_verify" ||
    viewId === "timetable" ||
    viewId === "hostel_mess" ||
    viewId === "nsta_broadcast" ||
    viewId === "ptm_scheduler" ||
    viewId === "notices" ||
    viewId === "memories" ||
    viewId === "community" ||
    viewId === "parent_queries"
  ) {
    return p.canManageExamsAndResults
      ? { allowed: true }
      : { allowed: false, requiredPowerLabel: "Classes, Exams & Results (परीक्षा व पढ़ाई)" };
  }

  return { allowed: true };
}

