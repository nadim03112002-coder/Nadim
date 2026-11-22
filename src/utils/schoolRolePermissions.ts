import type {
  AccountantPermissions,
  SchoolAccountant,
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
