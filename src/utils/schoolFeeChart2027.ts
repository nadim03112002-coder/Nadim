import type {
  ClassAdmissionHeadToggles,
  ClassFeeStructure,
  School,
  SchoolClass,
} from "../school-types";

export type AdmissionPaymentPlanType =
  | "registration_only"
  | "half_payment"
  | "full_payment";

export interface PosterClassFeeRow {
  canonicalKey: string;
  displayName: string;
  aliases: string[];
  admissionFee: number;
  examOriginalFee: number;
  examDiscountPct: number;
  examinationFee: number;
  diaryCharge: number;
  idCardCharge: number;
  tieBeltCharge: number;
  progressFolderCharge: number;
  diaryKitTotal: number;
  developmentCharge: number;
  tuitionFee: number;
  registrationOriginalFee: number;
  registrationDiscountPct: number;
  registrationFee: number;
  totalExclTuition: number;
  totalWithTuition: number;
}

export interface DevelopmentBreakupItem {
  id: string;
  label: string;
  hindiLabel: string;
  amount: number;
}

export interface TwoTermPaymentSummary {
  paymentPlan: AdmissionPaymentPlanType;
  planTitle: string;
  planSubtitle: string;
  planBadge: string;
  includeAdvanceTuition: boolean;
  fullPackageWithTuition: number;
  packageExclTuition: number;
  activePackageTotal: number;
  activePackageBeforeEntrance: number;
  registrationFeeAmount: number;
  firstMonthTuitionAmount: number;
  deferredTuitionAmount: number;
  term1PayNow: number;
  term1PayNowBeforeEntrance: number;
  term2Balance: number;
  entranceMeritDiscountApplied: number;
  entranceMeritBadge: string;
  entranceMeritLabel: string;
  totalScheduledAfterJoining: number;
}

export interface EntrancePlanDiscountInput {
  eligible: boolean;
  discountType: "fixed" | "percent";
  rawValue: number;
  label?: string;
  badge?: string;
  fixedAmountOverride?: number;
  cancelled?: boolean;
  eligiblePackagePool?: number;
}

export const LIFE_MAKER_CHART_VERSION = "2027-28-v4";
export const LIFE_MAKER_SCHOOL_ID = "MySyHGP5AguNdisdPKRu";

export const LIFE_MAKER_2027_28_FEE_CHART: PosterClassFeeRow[] = [
  {
    canonicalKey: "NURSERY",
    displayName: "Nursery",
    aliases: ["nur", "nur.", "nursery", "nursary", "nc", "playgroup", "pg"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 50,
    examinationFee: 300,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 350,
    registrationOriginalFee: 500,
    registrationDiscountPct: 40,
    registrationFee: 300,
    totalExclTuition: 1600,
    totalWithTuition: 1950,
  },
  {
    canonicalKey: "LKG",
    displayName: "L.K.G.",
    aliases: ["lkg", "l.k.g", "l.k.g.", "kg1", "kg-1", "kg 1", "lower kg"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 50,
    examinationFee: 300,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 400,
    registrationOriginalFee: 500,
    registrationDiscountPct: 40,
    registrationFee: 300,
    totalExclTuition: 1600,
    totalWithTuition: 2000,
  },
  {
    canonicalKey: "UKG",
    displayName: "U.K.G.",
    aliases: ["ukg", "u.k.g", "u.k.g.", "kg2", "kg-2", "kg 2", "upper kg", "kg"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 50,
    examinationFee: 300,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 450,
    registrationOriginalFee: 500,
    registrationDiscountPct: 40,
    registrationFee: 300,
    totalExclTuition: 1600,
    totalWithTuition: 2050,
  },
  {
    canonicalKey: "1",
    displayName: "Class I",
    aliases: ["1", "i", "class 1", "class i", "std 1", "1st"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 0,
    examinationFee: 600,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 500,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2100,
    totalWithTuition: 2600,
  },
  {
    canonicalKey: "2",
    displayName: "Class II",
    aliases: ["2", "ii", "class 2", "class ii", "std 2", "2nd"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 0,
    examinationFee: 600,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 600,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2100,
    totalWithTuition: 2700,
  },
  {
    canonicalKey: "3",
    displayName: "Class III",
    aliases: ["3", "iii", "class 3", "class iii", "std 3", "3rd"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 0,
    examinationFee: 600,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 700,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2100,
    totalWithTuition: 2800,
  },
  {
    canonicalKey: "4",
    displayName: "Class IV",
    aliases: ["4", "iv", "class 4", "class iv", "std 4", "4th"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 0,
    examinationFee: 600,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 800,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2100,
    totalWithTuition: 2900,
  },
  {
    canonicalKey: "5",
    displayName: "Class V",
    aliases: ["5", "v", "class 5", "class v", "std 5", "5th"],
    admissionFee: 0,
    examOriginalFee: 600,
    examDiscountPct: 0,
    examinationFee: 600,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 900,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2100,
    totalWithTuition: 3000,
  },
  {
    canonicalKey: "6",
    displayName: "Class VI",
    aliases: ["6", "vi", "class 6", "class vi", "std 6", "6th"],
    admissionFee: 0,
    examOriginalFee: 800,
    examDiscountPct: 0,
    examinationFee: 800,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 1000,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2300,
    totalWithTuition: 3300,
  },
  {
    canonicalKey: "7",
    displayName: "Class VII",
    aliases: ["7", "vii", "class 7", "class vii", "std 7", "7th"],
    admissionFee: 0,
    examOriginalFee: 800,
    examDiscountPct: 0,
    examinationFee: 800,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 1100,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2300,
    totalWithTuition: 3400,
  },
  {
    canonicalKey: "8",
    displayName: "Class VIII",
    aliases: ["8", "viii", "class 8", "class viii", "std 8", "8th"],
    admissionFee: 0,
    examOriginalFee: 800,
    examDiscountPct: 0,
    examinationFee: 800,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 500,
    tuitionFee: 1200,
    registrationOriginalFee: 1000,
    registrationDiscountPct: 50,
    registrationFee: 500,
    totalExclTuition: 2300,
    totalWithTuition: 3500,
  },
  {
    canonicalKey: "9",
    displayName: "Class IX",
    aliases: ["9", "ix", "class 9", "class ix", "std 9", "9th"],
    admissionFee: 5000,
    examOriginalFee: 2000,
    examDiscountPct: 0,
    examinationFee: 2000,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 1000,
    tuitionFee: 1800,
    registrationOriginalFee: 2000,
    registrationDiscountPct: 50,
    registrationFee: 1000,
    totalExclTuition: 9500,
    totalWithTuition: 11300,
  },
  {
    canonicalKey: "10",
    displayName: "Class X",
    aliases: ["10", "x", "class 10", "class x", "std 10", "10th"],
    admissionFee: 5000,
    examOriginalFee: 2000,
    examDiscountPct: 0,
    examinationFee: 2000,
    diaryCharge: 100,
    idCardCharge: 100,
    tieBeltCharge: 150,
    progressFolderCharge: 150,
    diaryKitTotal: 500,
    developmentCharge: 1000,
    tuitionFee: 2000,
    registrationOriginalFee: 2000,
    registrationDiscountPct: 50,
    registrationFee: 1000,
    totalExclTuition: 9500,
    totalWithTuition: 11500,
  },
];

const ROMAN_TO_NUM: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};

export const normalizeClassNameForChart = (className?: string | null): string => {
  if (!className) return "";
  let s = String(className)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/section\s*[a-z0-9]+/g, " ")
    .replace(/\bsec\s*[a-z0-9]+/g, " ")
    .replace(/class|std|grade/g, " ")
    .replace(/[^a-z0-9.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";
  const compact = s.replace(/[\s.]/g, "");
  if (
    compact.includes("nursery") ||
    compact.includes("nursary") ||
    compact === "nur" ||
    compact.startsWith("nur") ||
    compact === "nc" ||
    compact === "pg" ||
    compact.includes("playgroup")
  ) {
    return "NURSERY";
  }
  if (compact === "lkg" || compact === "kg1" || compact === "kgi" || compact === "lowerkg") {
    return "LKG";
  }
  if (
    compact === "ukg" ||
    compact === "kg2" ||
    compact === "kgii" ||
    compact === "upperkg" ||
    compact === "kg"
  ) {
    return "UKG";
  }
  const firstToken = s.split(" ")[0].replace(/\./g, "");
  if (ROMAN_TO_NUM[firstToken]) return ROMAN_TO_NUM[firstToken];
  if (firstToken === "xi") return "11";
  if (firstToken === "xii") return "12";
  const numMatch = s.match(/\b(1[0-2]|[1-9])\b/);
  if (numMatch) return numMatch[1];
  return compact.toUpperCase();
};

export const getPosterFeeRowForClass = (
  className?: string | null
): PosterClassFeeRow | null => {
  const key = normalizeClassNameForChart(className);
  if (!key) return null;
  return LIFE_MAKER_2027_28_FEE_CHART.find((r) => r.canonicalKey === key) || null;
};

export const isPrePrimaryClass = (className?: string | null): boolean => {
  const key = normalizeClassNameForChart(className);
  return key === "NURSERY" || key === "LKG" || key === "UKG";
};

export const isLifeMakerSchool = (school?: Pick<School, "name" | "code" | "id"> | null): boolean => {
  if (!school) return false;
  if (school.id === LIFE_MAKER_SCHOOL_ID) return true;
  const hay = `${school.name || ""} ${school.code || ""} ${school.id || ""}`.toLowerCase();
  return hay.includes("life maker") || hay.includes("lifemaker") || hay.includes("affour");
};

export const getDevelopmentFeeBreakup = (
  className?: string | null,
  totalDevAmount?: number
): DevelopmentBreakupItem[] => {
  const key = normalizeClassNameForChart(className);
  const amt = Number(totalDevAmount ?? (key === "9" || key === "10" ? 1000 : 500));
  if (amt <= 0) return [];

  if (amt === 500) {
    return [
      {
        id: "ind_day",
        label: "Independence Day (15 Aug) Celebration",
        hindiLabel: "15 अगस्त स्वतंत्रता दिवस समारोह व मिठाई",
        amount: 100,
      },
      {
        id: "rep_day",
        label: "Republic Day (26 Jan) Celebration",
        hindiLabel: "26 जनवरी गणतंत्र दिवस समारोह",
        amount: 100,
      },
      {
        id: "sports_cultural",
        label: "Annual Sports, Cultural & Activity Events",
        hindiLabel: "वार्षिक खेलकूद व सांस्कृतिक प्रतियोगिता",
        amount: 150,
      },
      {
        id: "campus_smart",
        label: "Campus Maintenance, Drinking Water & Smart Facility",
        hindiLabel: "कैंपस रखरखाव, शुद्ध पेयजल व स्मार्ट सुविधा",
        amount: 150,
      },
    ];
  }

  if (amt === 1000) {
    return [
      {
        id: "celebrations",
        label: "15 August & 26 January Celebrations",
        hindiLabel: "15 अगस्त व 26 जनवरी समारोह एवं मिठाई",
        amount: 200,
      },
      {
        id: "labs_practical",
        label: "Science, Computer Lab & Practical Materials",
        hindiLabel: "साइंस, कंप्यूटर लैब व प्रैक्टिकल सामग्री",
        amount: 350,
      },
      {
        id: "sports_lib",
        label: "Library, Sports & Annual Cultural Function",
        hindiLabel: "पुस्तकालय, खेलकूद व वार्षिक सांस्कृतिक समारोह",
        amount: 250,
      },
      {
        id: "board_smart",
        label: "Board Exam Prep & Smart Classroom Setup",
        hindiLabel: "बोर्ड परीक्षा तैयारी व स्मार्ट क्लासरूम सुविधा",
        amount: 200,
      },
    ];
  }

  if (amt === 2000) {
    return [
      {
        id: "celebrations",
        label: "15 August & 26 January Celebrations",
        hindiLabel: "15 अगस्त व 26 जनवरी समारोह एवं मिठाई",
        amount: 200,
      },
      {
        id: "labs_practical",
        label: "Science, Computer Lab & Practical Materials",
        hindiLabel: "साइंस, कंप्यूटर लैब व प्रैक्टिकल सामग्री",
        amount: 800,
      },
      {
        id: "sports_lib",
        label: "Library, Sports & Annual Cultural Function",
        hindiLabel: "पुस्तकालय, खेलकूद व वार्षिक सांस्कृतिक समारोह",
        amount: 500,
      },
      {
        id: "board_smart",
        label: "Board Exam Prep & Smart Classroom Setup",
        hindiLabel: "बोर्ड परीक्षा तैयारी व स्मार्ट क्लासरूम सुविधा",
        amount: 500,
      },
    ];
  }

  if (key === "9" || key === "10") {
    const celebAmt = Math.min(200, Math.round(amt * 0.1));
    const remainder = Math.max(0, amt - celebAmt);
    const labAmt = Math.round(remainder * (800 / 1800));
    const sportsAmt = Math.round(remainder * (500 / 1800));
    const boardAmt = Math.max(0, remainder - labAmt - sportsAmt);
    return [
      {
        id: "celebrations",
        label: "15 August & 26 January Celebrations",
        hindiLabel: "15 अगस्त व 26 जनवरी समारोह",
        amount: celebAmt,
      },
      {
        id: "labs_practical",
        label: "Science, Computer Lab & Practical Materials",
        hindiLabel: "साइंस व कंप्यूटर लैब एवं प्रैक्टिकल सामग्री",
        amount: labAmt,
      },
      {
        id: "sports_lib",
        label: "Library, Sports & Annual Cultural Function",
        hindiLabel: "पुस्तकालय, खेलकूद व वार्षिक समारोह",
        amount: sportsAmt,
      },
      {
        id: "board_smart",
        label: "Board Exam Prep & Smart Classroom Setup",
        hindiLabel: "बोर्ड परीक्षा तैयारी व स्मार्ट क्लास सुविधा",
        amount: boardAmt,
      },
    ].filter((it) => it.amount > 0);
  }

  const indAmt = Math.min(100, Math.round(amt * 0.2));
  const repAmt = Math.min(100, Math.round(amt * 0.2));
  const activityAmt = Math.round((amt - indAmt - repAmt) / 2);
  const campusAmt = Math.max(0, amt - indAmt - repAmt - activityAmt);
  return [
    {
      id: "ind_day",
      label: "Independence Day (15 Aug) Celebration",
      hindiLabel: "15 अगस्त स्वतंत्रता दिवस",
      amount: indAmt,
    },
    {
      id: "rep_day",
      label: "Republic Day (26 Jan) Celebration",
      hindiLabel: "26 जनवरी गणतंत्र दिवस",
      amount: repAmt,
    },
    {
      id: "sports_cultural",
      label: "Annual Sports & Cultural Events",
      hindiLabel: "वार्षिक खेल एवं कार्यक्रम",
      amount: activityAmt,
    },
    {
      id: "campus_smart",
      label: "Campus & Smart Classroom Maintenance",
      hindiLabel: "कैंपस व स्मार्ट सुविधा विकास",
      amount: campusAmt,
    },
  ].filter((it) => it.amount > 0);
};

export const buildClassFeeStructureFromPoster = (
  cls?: Pick<SchoolClass, "name" | "feeStructure" | "defaultFee"> | null
): ClassFeeStructure | null => {
  const row = getPosterFeeRowForClass(cls?.name);
  if (!row) return null;

  const prevBusFee = Number(cls?.feeStructure?.busFee ?? 350);
  const prevBusEnabled =
    typeof cls?.feeStructure?.enabledHeads?.busFee === "boolean"
      ? cls.feeStructure.enabledHeads.busFee
      : true;

  const enabledHeads: ClassAdmissionHeadToggles = {
    admissionFee: row.admissionFee > 0,
    registrationFee: true,
    examinationFee: true,
    republicDayCharge: false,
    independenceDayCharge: false,
    diaryCharge: true,
    idCardCharge: true,
    tieBeltCharge: true,
    progressFolderCharge: true,
    developmentCharge: true,
    annualCharges: false,
    tuitionFee: true,
    cautionMoney: false,
    busFee: prevBusEnabled,
  };

  return {
    admissionFee: row.admissionFee,
    registrationFee: row.registrationFee,
    examinationFee: row.examinationFee,
    republicDayCharge: 0,
    independenceDayCharge: 0,
    diaryCharge: row.diaryCharge,
    idCardCharge: row.idCardCharge,
    tieBeltCharge: row.tieBeltCharge,
    progressFolderCharge: row.progressFolderCharge,
    developmentCharge: row.developmentCharge,
    developmentFee: row.developmentCharge,
    annualCharges: 0,
    tuitionFee: row.tuitionFee,
    cautionMoney: 0,
    busFee: prevBusFee,
    enabledHeads,
    customHeads: [],
    examOriginalFee: row.examOriginalFee,
    examDiscountPct: row.examDiscountPct,
    chartVersion: LIFE_MAKER_CHART_VERSION,
  };
};

/**
 * Ensures any Life Maker Public School class whose feeStructure hasn't been stamped
 * with LIFE_MAKER_CHART_VERSION resolves directly from the official 2027-28 poster chart
 * (guaranteeing Nursery fees, Registration Fee, Exam 50% OFF, Diary/Kit, Development, and Tuition).
 */
export const resolveEffectiveClassForAdmission = <T extends SchoolClass>(
  cls: T,
  school?: Pick<School, "name" | "code" | "id"> | null
): T => {
  if (!cls) return cls;
  const shouldApplyPoster =
    isLifeMakerSchool(school) || cls.schoolId === LIFE_MAKER_SCHOOL_ID;
  if (!shouldApplyPoster) return cls;

  const posterRow = getPosterFeeRowForClass(cls.name);
  if (!posterRow) return cls;

  if (cls.feeStructure?.chartVersion === LIFE_MAKER_CHART_VERSION) {
    return cls;
  }

  const posterFee = buildClassFeeStructureFromPoster(cls);
  if (!posterFee) return cls;

  return {
    ...cls,
    defaultFee: Number(cls.defaultFee || 0) > 0 && cls.feeStructure?.chartVersion === LIFE_MAKER_CHART_VERSION
      ? cls.defaultFee
      : posterRow.tuitionFee,
    feeStructure: posterFee,
  };
};

export const calculateAdmissionPaymentPlan = (params: {
  fullPackageTotal: number; // Full package BEFORE Entrance Merit discount
  firstMonthTuitionAmount: number;
  registrationFeeAmount: number;
  includeAdvanceTuition: boolean;
  paymentPlan: AdmissionPaymentPlanType;
  extraDueAdded?: number; // e.g. Re-Admission carried back due
  entranceDiscount?: EntrancePlanDiscountInput | null;
}): TwoTermPaymentSummary => {
  const fullPkg = Math.max(0, Math.round(Number(params.fullPackageTotal || 0)));
  const tuitionAmt = Math.max(
    0,
    Math.min(fullPkg, Math.round(Number(params.firstMonthTuitionAmount || 0)))
  );
  const regAmt = Math.max(0, Math.round(Number(params.registrationFeeAmount || 0)));
  const extraDue = Math.max(0, Math.round(Number(params.extraDueAdded || 0)));

  const packageExclTuition = Math.max(0, fullPkg - tuitionAmt);
  const fullWithExtra = fullPkg + extraDue;
  const exclWithExtra = packageExclTuition + extraDue;

  const activePackageBeforeEntrance = params.includeAdvanceTuition
    ? fullWithExtra
    : exclWithExtra;
  const deferredTuitionAmount = params.includeAdvanceTuition ? 0 : tuitionAmt;

  let baseTerm1PayNow = activePackageBeforeEntrance;
  let planTitle = "Complete Admission Plan (100% Full)";
  let planSubtitle = "Clear full admission package in one convenient payment.";
  let planBadge = "Full Clearance";

  if (params.paymentPlan === "registration_only") {
    // Registration seat booking pays registration fee (or full active total if lower)
    baseTerm1PayNow =
      regAmt > 0
        ? Math.min(activePackageBeforeEntrance, regAmt)
        : Math.min(
            activePackageBeforeEntrance,
            Math.max(300, Math.round(activePackageBeforeEntrance * 0.2))
          );
    planTitle = "Seat Reservation (Registration Only — Term 1)";
    planSubtitle = "Confirm your child's seat now; complete Term 2 balance at joining.";
    planBadge = "Term 1 Seat Booking";
  } else if (params.paymentPlan === "half_payment") {
    baseTerm1PayNow = Math.ceil(activePackageBeforeEntrance / 2);
    planTitle = "2-Term Flexible Plan (50% Term 1 + 50% Term 2)";
    planSubtitle = "Pay half today to confirm seat; settle remaining half at joining.";
    planBadge = "2-Term Plan (50%)";
  }

  // Term 2 joining balance is strictly computed BEFORE Entrance Merit discount (NO discount on Term 2 or later fees!)
  const term2Balance = Math.max(0, activePackageBeforeEntrance - baseTerm1PayNow);

  // Entrance Merit Discount applies strictly on the chosen Current Pay (baseTerm1PayNow) ONLY
  let entranceMeritDiscountApplied = 0;
  let entranceMeritBadge = "";
  let entranceMeritLabel = "";
  const ent = params.entranceDiscount;

  if (ent && !ent.cancelled) {
    const eligibleCurrentPayCap =
      ent.eligiblePackagePool !== undefined
        ? Math.min(baseTerm1PayNow, Math.max(0, Math.round(Number(ent.eligiblePackagePool))))
        : baseTerm1PayNow;

    if (ent.eligible && ent.rawValue > 0 && eligibleCurrentPayCap > 0) {
      const computed =
        ent.discountType === "percent"
          ? Math.round((eligibleCurrentPayCap * ent.rawValue) / 100)
          : Math.round(ent.rawValue);
      entranceMeritDiscountApplied = Math.min(
        baseTerm1PayNow,
        eligibleCurrentPayCap,
        Math.max(0, computed)
      );
      entranceMeritBadge =
        ent.badge ||
        (ent.discountType === "percent"
          ? `${ent.rawValue}% OFF`
          : `₹${ent.rawValue.toLocaleString("en-IN")} OFF`);
      entranceMeritLabel = ent.label || "Entrance Merit Off (Current Pay Only)";
    } else if (
      !ent.eligible &&
      ent.fixedAmountOverride !== undefined &&
      ent.fixedAmountOverride > 0 &&
      eligibleCurrentPayCap > 0
    ) {
      entranceMeritDiscountApplied = Math.min(
        baseTerm1PayNow,
        eligibleCurrentPayCap,
        Math.round(Number(ent.fixedAmountOverride))
      );
      entranceMeritBadge =
        ent.badge || `₹${entranceMeritDiscountApplied.toLocaleString("en-IN")} OFF`;
      entranceMeritLabel = ent.label || "Entrance Merit Off (Current Pay Only)";
    }
  }

  const term1PayNowBeforeEntrance = baseTerm1PayNow;
  const term1PayNow = Math.max(0, baseTerm1PayNow - entranceMeritDiscountApplied);
  const activePackageTotal = Math.max(
    0,
    activePackageBeforeEntrance - entranceMeritDiscountApplied
  );
  const totalScheduledAfterJoining = term2Balance + deferredTuitionAmount;

  return {
    paymentPlan: params.paymentPlan,
    planTitle,
    planSubtitle,
    planBadge,
    includeAdvanceTuition: params.includeAdvanceTuition,
    fullPackageWithTuition: fullWithExtra,
    packageExclTuition: exclWithExtra,
    activePackageTotal,
    activePackageBeforeEntrance,
    registrationFeeAmount: regAmt,
    firstMonthTuitionAmount: tuitionAmt,
    deferredTuitionAmount,
    term1PayNow,
    term1PayNowBeforeEntrance,
    term2Balance,
    entranceMeritDiscountApplied,
    entranceMeritBadge,
    entranceMeritLabel,
    totalScheduledAfterJoining,
  };
};

export const getExamDiscountMeta = (
  className?: string | null,
  currentExamAmount?: number,
  fs?: ClassFeeStructure | null
): {
  hasDiscount: boolean;
  originalAmount: number;
  netAmount: number;
  discountPct: number;
} => {
  const amt = Math.max(0, Number(currentExamAmount || 0));
  const posterRow = getPosterFeeRowForClass(className);
  const explicitOrig = Number(fs?.examOriginalFee || 0);
  const explicitPct = Number(fs?.examDiscountPct || 0);

  if (explicitOrig > amt && explicitPct > 0) {
    return {
      hasDiscount: true,
      originalAmount: explicitOrig,
      netAmount: amt,
      discountPct: explicitPct,
    };
  }

  if (isPrePrimaryClass(className) && amt > 0 && amt <= 350) {
    const orig = posterRow?.examOriginalFee || 600;
    const pct = orig > amt ? Math.round(((orig - amt) / orig) * 100) : 50;
    return {
      hasDiscount: true,
      originalAmount: orig,
      netAmount: amt,
      discountPct: pct,
    };
  }

  return {
    hasDiscount: false,
    originalAmount: amt,
    netAmount: amt,
    discountPct: 0,
  };
};

export const getRegistrationDiscountMeta = (
  className?: string | null,
  currentRegAmount?: number
): {
  hasDiscount: boolean;
  originalAmount: number;
  netAmount: number;
  discountPct: number;
} => {
  const amt = Math.max(0, Number(currentRegAmount || 0));
  if (amt <= 0) {
    return { hasDiscount: false, originalAmount: 0, netAmount: 0, discountPct: 0 };
  }
  const posterRow = getPosterFeeRowForClass(className);
  const key = normalizeClassNameForChart(className);

  let orig = posterRow?.registrationOriginalFee || 0;
  let defaultPct = posterRow?.registrationDiscountPct || 0;

  if (!orig) {
    if (key === "NURSERY" || key === "LKG" || key === "UKG") {
      orig = 500;
      defaultPct = 40;
    } else if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(key)) {
      orig = 1000;
      defaultPct = 50;
    } else if (key === "9" || key === "10") {
      orig = 2000;
      defaultPct = 50;
    }
  }

  if (orig > amt) {
    const pct =
      posterRow && amt === posterRow.registrationFee && defaultPct > 0
        ? defaultPct
        : Math.round(((orig - amt) / orig) * 100);
    return {
      hasDiscount: pct > 0,
      originalAmount: orig,
      netAmount: amt,
      discountPct: pct,
    };
  }

  return {
    hasDiscount: false,
    originalAmount: amt,
    netAmount: amt,
    discountPct: 0,
  };
};

export const buildDefaultClassesFrom2027Chart = (
  schoolId: string,
  sessionId = "sess_default_2027_28"
): SchoolClass[] => {
  return LIFE_MAKER_2027_28_FEE_CHART.map((row, idx) => {
    const builtFee = buildClassFeeStructureFromPoster({
      name: row.displayName,
      feeStructure: undefined,
      defaultFee: row.tuitionFee,
    });
    return {
      id: `cls_lmps_${row.canonicalKey.toLowerCase()}`,
      schoolId,
      sessionId,
      name: row.displayName,
      section: "A",
      defaultFee: row.tuitionFee,
      feeStructure: builtFee || {
        admissionFee: row.admissionFee,
        registrationFee: row.registrationFee,
        examinationFee: row.examinationFee,
        republicDayCharge: 0,
        independenceDayCharge: 0,
        diaryCharge: row.diaryCharge,
        idCardCharge: row.idCardCharge,
        tieBeltCharge: row.tieBeltCharge,
        progressFolderCharge: row.progressFolderCharge,
        developmentCharge: row.developmentCharge,
        developmentFee: row.developmentCharge,
        annualCharges: 0,
        tuitionFee: row.tuitionFee,
        cautionMoney: 0,
        busFee: 350,
      },
      sortOrder: idx + 1,
      active: true,
      createdAt: "2027-04-01T00:00:00.000Z",
    };
  });
};

