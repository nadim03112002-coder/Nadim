import type {
  AppliedTermFeeItem,
  DeferredScheduledFeeHead,
  FeeTermCampaign,
  FeeTypeSchedulePlan,
  MonthlyFee,
  School,
  SchoolClass,
  SchoolStudent,
  SettledFeeHeadRecord,
  WaivedFeeHeadRecord,
} from "../school-types";
import { getPosterFeeRowForClass } from "./schoolFeeChart2027";
import { getGroupNetItems, inferLegacyKeyFromFeeHeadName } from "./feeStructureUtils";

export const FEE_HEAD_OPTIONS: Array<{
  key: string;
  label: string;
  hindiLabel: string;
  defaultTitle: string;
}> = [
  {
    key: "exam",
    label: "Examination Fee",
    hindiLabel: "परीक्षा शुल्क (Exam Fee)",
    defaultTitle: "Exam Fee (Term Charge)",
  },
  {
    key: "admission",
    label: "Admission Fee",
    hindiLabel: "प्रवेश शुल्क (Admission Fee)",
    defaultTitle: "Admission Fee (Deferred / Term)",
  },
  {
    key: "registration",
    label: "Registration / Form Fee",
    hindiLabel: "पंजीकरण / फॉर्म शुल्क",
    defaultTitle: "Registration Fee Balance",
  },
  {
    key: "smart_id_card",
    label: "Smart QR ID Card",
    hindiLabel: "स्मार्ट QR आई-कार्ड",
    defaultTitle: "Smart QR ID Card Fee",
  },
  {
    key: "school_diary",
    label: "School Diary",
    hindiLabel: "स्कूल डायरी",
    defaultTitle: "School Diary Charge",
  },
  {
    key: "tie_belt_set",
    label: "Tie & Belt Set",
    hindiLabel: "टाई व बेल्ट सेट",
    defaultTitle: "Tie & Belt Set Charge",
  },
  {
    key: "progress_folder",
    label: "Progress Folder",
    hindiLabel: "प्रोग्रेस फोल्डर",
    defaultTitle: "Progress Folder Charge",
  },
  {
    key: "development",
    label: "Development Fee",
    hindiLabel: "विकास शुल्क (Development)",
    defaultTitle: "Development Fee (Term)",
  },
  {
    key: "tuition_first_month",
    label: "1st Month Tuition Fee",
    hindiLabel: "प्रथम माह ट्यूशन शुल्क",
    defaultTitle: "1st Month Tuition Fee",
  },
  {
    key: "annual",
    label: "Annual Charges",
    hindiLabel: "वार्षिक शुल्क (Annual Charges)",
    defaultTitle: "Annual Charges",
  },
  {
    key: "caution",
    label: "Caution Money",
    hindiLabel: "कॉशन मनी (Security Deposit)",
    defaultTitle: "Caution Money",
  },
  {
    key: "kit",
    label: "Combined Kit (Legacy All-in-One)",
    hindiLabel: "संयुक्त किट (पुराना पैक)",
    defaultTitle: "Student Kit & Diary Charge",
  },
  {
    key: "custom",
    label: "Custom Fee Term",
    hindiLabel: "अन्य / कस्टम शुल्क (Custom)",
    defaultTitle: "Special Term Fee",
  },
];

export const canonicalizeFeeHeadKey = (idOrName?: string | null): string => {
  const raw = String(idOrName || "").trim().toLowerCase();
  if (!raw) return "custom";

  // Direct ID prefixes from DirectAdmissionModal / FeeManager / OnlineAdmission / Store
  if (raw === "fs_adm" || raw === "def_1" || raw === "adm_1" || raw === "admission" || raw === "admissionfee") {
    return "admission";
  }
  if (raw === "fs_reg" || raw === "def_2" || raw === "adm_2" || raw === "registration" || raw === "registrationfee") {
    return "registration";
  }
  if (raw === "fs_exam" || raw === "def_5" || raw === "examination" || raw === "examinationfee" || raw === "exam" || raw === "examfund") {
    return "exam";
  }
  if (raw === "fs_idcard" || raw === "def_idcard" || raw === "smart_id_card" || raw === "idcardcharge" || raw === "id_card") {
    return "smart_id_card";
  }
  if (raw === "fs_diary" || raw === "def_diary" || raw === "school_diary" || raw === "diarycharge" || raw === "diary") {
    return "school_diary";
  }
  if (raw === "fs_tiebelt" || raw === "def_tiebelt" || raw === "tie_belt_set" || raw === "tiebeltcharge" || raw === "tie_belt") {
    return "tie_belt_set";
  }
  if (raw === "fs_folder" || raw === "def_folder" || raw === "progress_folder" || raw === "progressfoldercharge") {
    return "progress_folder";
  }
  if (raw === "fs_kit" || raw === "def_3" || raw === "kit" || raw === "idkitfee") {
    return "kit";
  }
  if (raw === "fs_dev" || raw === "def_6" || raw === "development" || raw === "developmentcharge" || raw === "developmentfee") {
    return "development";
  }
  if (raw === "fs_ann" || raw === "annual" || raw === "annualcharges") {
    return "annual";
  }
  if (raw === "fs_cau" || raw === "caution" || raw === "cautionmoney") {
    return "caution";
  }
  if (raw === "fs_tui" || raw === "def_4" || raw === "def_tui" || raw === "tuition" || raw === "tuitionfee" || raw === "tuition_first_month") {
    return "tuition_first_month";
  }
  if (raw === "fs_bus" || raw === "def_bus" || raw === "adm_bus" || raw === "bus" || raw === "busfee") {
    return "bus";
  }
  if (raw === "readm_back_due" || raw === "back_due") {
    return "back_due";
  }

  // Fuzzy label matching — check specific split kit items before legacy combined kit!
  if (/registration|पंजीकरण|फॉर्म\s*शुल्क|form\s*fee/i.test(raw)) return "registration";
  if (/exam|परीक्षा/i.test(raw)) return "exam";
  if (/smart\s*qr|qr\s*id|i-?card|id\s*card|आई-?कार्ड/i.test(raw)) return "smart_id_card";
  if (/school\s*diary|diary|डायरी/i.test(raw)) return "school_diary";
  if (/tie\s*[&+]?\s*belt|belt\s*[&+]?\s*tie|टाई|बेल्ट/i.test(raw)) return "tie_belt_set";
  if (/progress\s*folder|प्रोग्रेस\s*फोल्डर/i.test(raw)) return "progress_folder";
  if (/किट|kit/i.test(raw)) return "kit";
  if (/development|विकास/i.test(raw)) return "development";
  if (/annual|वार्षिक/i.test(raw)) return "annual";
  if (/caution|कॉशन|security/i.test(raw)) return "caution";
  if (/1st\s*month\s*tuition|tuition\s*fee|मासिक\s*शिक्षण|प्रथम\s*माह/i.test(raw)) return "tuition_first_month";
  if (/transport|bus\s*fee|वाहन/i.test(raw)) return "bus";
  if (/admission\s*fee|प्रवेश\s*शुल्क|नामांकन/i.test(raw)) return "admission";
  if (/back\s*session|पिछला\s*सत्र|arrears/i.test(raw)) return "back_due";

  const slug = raw
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug ? `custom_${slug}` : "custom";
};

const legacyKeyToCanonicalHeadKey = (legacyKey?: string): string | null => {
  switch (legacyKey) {
    case "admissionFee":
      return "admission";
    case "registrationFee":
      return "registration";
    case "examinationFee":
      return "exam";
    case "developmentCharge":
      return "development";
    case "annualCharges":
      return "annual";
    case "cautionMoney":
      return "caution";
    case "idCardCharge":
      return "smart_id_card";
    case "diaryCharge":
      return "school_diary";
    case "tieBeltCharge":
      return "tie_belt_set";
    case "progressFolderCharge":
      return "progress_folder";
    case "tuitionFee":
      return "tuition_first_month";
    case "busFee":
      return "bus";
    default:
      return null;
  }
};

export const getConfiguredHeadAmountForClass = (
  cls: Pick<SchoolClass, "name" | "defaultFee" | "feeStructure"> | undefined | null,
  headKey: string
): number => {
  const fs = cls?.feeStructure;
  const poster = getPosterFeeRowForClass(cls?.name);

  if (headKey === "kit") {
    const kitSum =
      getConfiguredHeadAmountForClass(cls, "smart_id_card") +
      getConfiguredHeadAmountForClass(cls, "school_diary") +
      getConfiguredHeadAmountForClass(cls, "tie_belt_set") +
      getConfiguredHeadAmountForClass(cls, "progress_folder");
    if (kitSum > 0) return kitSum;
    return Number(poster?.diaryKitTotal ?? 0);
  }

  // 1. Check modern feeGroups first (supports group discounts & items without legacyKey)
  if (fs?.feeGroups && Array.isArray(fs.feeGroups) && fs.feeGroups.length > 0) {
    let foundInGroups = false;
    let anyEnabledInGroups = false;
    let groupAmountSum = 0;

    for (const grp of fs.feeGroups) {
      const { itemsWithNet } = getGroupNetItems(grp);
      const isDevGroup = /development|विकास/i.test(grp.title || "");
      for (const { item: it, netAmount } of itemsWithNet) {
        const inferredLegacy = inferLegacyKeyFromFeeHeadName(it.name, it.legacyKey);
        let itemHeadKey =
          legacyKeyToCanonicalHeadKey(inferredLegacy) || canonicalizeFeeHeadKey(it.id || it.name);
        if (itemHeadKey.startsWith("custom_") && isDevGroup) {
          itemHeadKey = "development";
        }
        if (itemHeadKey === headKey) {
          foundInGroups = true;
          if (grp.enabled !== false && it.enabled !== false) {
            anyEnabledInGroups = true;
            groupAmountSum += Math.max(0, Number(netAmount || 0));
          }
        }
      }
    }

    if (foundInGroups) {
      if (!anyEnabledInGroups) return 0;
      if (groupAmountSum > 0) return groupAmountSum;
    }
  }

  // 2. Check legacy customHeads
  if (Array.isArray(fs?.customHeads) && fs.customHeads.length > 0) {
    let customSum = 0;
    for (const h of fs.customHeads) {
      if (h && h.enabled !== false) {
        const hKey = canonicalizeFeeHeadKey(h.id || h.name);
        if (hKey === headKey) {
          customSum += Math.max(0, Number(h.amount || 0));
        }
      }
    }
    if (customSum > 0) return customSum;
  }

  // 3. Legacy scalar fields with enabledHeads & 2027-28 Poster fallback
  const toggles = fs?.enabledHeads;
  const resolveScalarWithFallback = (
    toggleKey: keyof NonNullable<typeof toggles>,
    scalarVal: number | undefined | null,
    posterVal: number | undefined | null,
    hardDefault = 0
  ): number => {
    const toggleVal = toggles?.[toggleKey];
    const hasScalar = scalarVal !== undefined && scalarVal !== null;
    const numScalar = hasScalar ? Math.max(0, Number(scalarVal) || 0) : 0;

    // If explicitly disabled in toggles with positive scalar (or explicitly off without poster rescue needed)
    if (toggleVal === false) {
      return 0;
    }
    if (numScalar > 0) return numScalar;
    // If scalar is undefined/null OR scalar was accidentally saved as 0 while toggle is NOT false
    if (!hasScalar || toggleVal === true || toggleVal === undefined) {
      return Math.max(0, Number(posterVal ?? hardDefault) || 0);
    }
    return 0;
  };

  switch (headKey) {
    case "admission":
      return resolveScalarWithFallback("admissionFee", fs?.admissionFee, poster?.admissionFee, 0);
    case "registration":
      return resolveScalarWithFallback("registrationFee", fs?.registrationFee, poster?.registrationFee, 0);
    case "exam":
      return resolveScalarWithFallback("examinationFee", fs?.examinationFee, poster?.examinationFee, 0);
    case "development": {
      const rawDev = fs?.developmentCharge ?? fs?.developmentFee;
      return resolveScalarWithFallback("developmentCharge", rawDev, poster?.developmentCharge, 0);
    }
    case "annual":
      return resolveScalarWithFallback("annualCharges", fs?.annualCharges, 0, 0);
    case "caution":
      return resolveScalarWithFallback("cautionMoney", fs?.cautionMoney, 0, 0);
    case "smart_id_card":
      return resolveScalarWithFallback("idCardCharge", fs?.idCardCharge, poster?.idCardCharge, 100);
    case "school_diary":
      return resolveScalarWithFallback("diaryCharge", fs?.diaryCharge, poster?.diaryCharge, 100);
    case "tie_belt_set":
      return resolveScalarWithFallback("tieBeltCharge", fs?.tieBeltCharge, poster?.tieBeltCharge, 150);
    case "progress_folder":
      return resolveScalarWithFallback("progressFolderCharge", fs?.progressFolderCharge, poster?.progressFolderCharge, 0);
    case "tuition_first_month": {
      const rawTui = fs?.tuitionFee ?? cls?.defaultFee;
      return resolveScalarWithFallback("tuitionFee", rawTui, poster?.tuitionFee, 0);
    }
    default:
      return 0;
  }
};

export interface StudentHeadSettlementSummary {
  isFullAdmissionPackagePaid: boolean;
  settledByHead: Record<string, SettledFeeHeadRecord>;
  paidCampaignIds: Set<string>;
}

const SPLIT_KIT_HEAD_KEYS = ["smart_id_card", "school_diary", "tie_belt_set", "progress_folder"] as const;

export const computeStudentHeadSettlement = (params: {
  student: SchoolStudent;
  classObj?: Pick<SchoolClass, "name" | "defaultFee" | "feeStructure"> | null;
  feeHistory: MonthlyFee[];
}): StudentHeadSettlementSummary => {
  const { student, classObj, feeHistory } = params;
  const studentFees = (feeHistory || []).filter(
    (f) => f && f.studentId === student.id && !f.cancelled
  );

  // Determine whether student completed full admission package with 0 due
  const admRecords = studentFees.filter(
    (f) => f.feeType === "admission" || f.receiptCategory === "admission"
  );
  const admDueBalance = Math.max(0, Number(student.admissionDueBalance || 0));

  const explicitFullPlan =
    student.admissionPaymentPlan === "full_payment" && admDueBalance === 0;

  const admRecordFullPaid = admRecords.some((f) => {
    if (f.paymentPlan === "registration_only" || f.paymentPlan === "half_payment") return false;
    const dueRem = f.balanceDue !== undefined ? Number(f.balanceDue) : (f.paid ? 0 : Number(f.amount || 0));
    const amt = Number(f.amount || 0);
    const paid = Number(f.paidAmount || 0);
    return Boolean(f.paid) && dueRem <= 0 && paid >= amt && amt > 0;
  });

  const isFullAdmissionPackagePaid = Boolean(
    (explicitFullPlan || admRecordFullPaid) && admDueBalance <= 0
  );

  const settledByHead: Record<string, SettledFeeHeadRecord> = {};
  if (student.settledFeeHeads) {
    Object.entries(student.settledFeeHeads).forEach(([k, v]) => {
      if (v) {
        settledByHead[k] = { ...v };
      }
    });
  }

  const paidByHistoryHead = new Map<string, number>();
  const waivedByRecordHead = new Map<string, number>();
  const fullWaivedHeads = new Set<string>();
  const paidCampaignIds = new Set<string>(student.paidCampaignIds || []);

  if (student.waivedFeeHeads) {
    Object.entries(student.waivedFeeHeads).forEach(([k, w]) => {
      if (!w) return;
      const wAmt = Math.max(0, Number(w.waivedAmount || 0));
      if (wAmt > 0) {
        waivedByRecordHead.set(k, (waivedByRecordHead.get(k) || 0) + wAmt);
      }
      if (w.fullWaived) {
        fullWaivedHeads.add(k);
      }
    });
  }

  studentFees.forEach((f) => {
    const isFeePaid = Boolean(f.paid && Number(f.balanceDue || 0) === 0);

    if (Array.isArray(f.appliedTermFees) && (isFeePaid || Number(f.paidAmount || 0) > 0)) {
      f.appliedTermFees.forEach((tf) => {
        if (isFeePaid) {
          paidCampaignIds.add(tf.campaignId);
          paidByHistoryHead.set(
            tf.headKey,
            (paidByHistoryHead.get(tf.headKey) || 0) + Number(tf.amount || 0)
          );
        }
      });
    }

    if (Array.isArray(f.items) && f.items.length > 0) {
      f.items.forEach((it) => {
        const key = it.headKey || canonicalizeFeeHeadKey(it.id || it.description);
        if (key === "back_due") return;
        const effectiveSettledAmt = isFeePaid
          ? Math.max(Number(it.paid || 0) + Number(it.con || 0), Number(it.due || 0))
          : Number(it.paid || 0) + Number(it.con || 0);
        if (effectiveSettledAmt > 0) {
          paidByHistoryHead.set(key, (paidByHistoryHead.get(key) || 0) + effectiveSettledAmt);
        }
      });
    } else if (isFeePaid) {
      if (f.includeAdmissionFee) {
        const adm = getConfiguredHeadAmountForClass(classObj, "admission");
        if (adm > 0) paidByHistoryHead.set("admission", (paidByHistoryHead.get("admission") || 0) + adm);
      }
      if (f.includeAnnualCharges) {
        const ann = getConfiguredHeadAmountForClass(classObj, "annual");
        if (ann > 0) paidByHistoryHead.set("annual", (paidByHistoryHead.get("annual") || 0) + ann);
      }
      if (f.includeCautionMoney) {
        const cau = getConfiguredHeadAmountForClass(classObj, "caution");
        if (cau > 0) paidByHistoryHead.set("caution", (paidByHistoryHead.get("caution") || 0) + cau);
      }
    }
  });

  // Merge history & waivers into settledByHead
  const allHeadKeys = new Set<string>([
    ...Object.keys(settledByHead),
    ...Array.from(paidByHistoryHead.keys()),
    ...Array.from(waivedByRecordHead.keys()),
    ...Array.from(fullWaivedHeads),
    "admission",
    "registration",
    "exam",
    "smart_id_card",
    "school_diary",
    "tie_belt_set",
    "progress_folder",
    "kit",
    "development",
    "tuition_first_month",
    "annual",
    "caution",
  ]);

  allHeadKeys.forEach((key) => {
    const explicit = settledByHead[key];
    const histPaid = paidByHistoryHead.get(key) || 0;
    const recWaived = waivedByRecordHead.get(key) || 0;
    const waivedAmount = Math.max(Number(explicit?.waivedAmount || 0), recWaived);
    const configuredCap = getConfiguredHeadAmountForClass(classObj, key);
    const totalPaid = Math.max(Number(explicit?.totalPaid || 0), histPaid);
    const targetCap = explicit?.targetCap ?? (configuredCap > 0 ? configuredCap : undefined);

    let fullPaid = false;
    if (fullWaivedHeads.has(key)) {
      fullPaid = true;
    } else if (explicit) {
      fullPaid =
        explicit.fullPaid ||
        Boolean(targetCap && targetCap > 0 && totalPaid + waivedAmount >= targetCap);
    } else {
      fullPaid =
        isFullAdmissionPackagePaid ||
        Boolean(targetCap && targetCap > 0 && totalPaid + waivedAmount >= targetCap);
    }

    if (key === "tuition_first_month" && student.advanceMonthlyFeePaid && admDueBalance === 0) {
      if (!explicit || explicit.fullPaid !== false) {
        fullPaid = true;
      }
    }

    settledByHead[key] = {
      fullPaid,
      totalPaid,
      ...(waivedAmount > 0 ? { waivedAmount } : {}),
      ...(targetCap !== undefined ? { targetCap } : {}),
      ...(explicit?.source ? { source: explicit.source } : {}),
      ...(explicit?.updatedAt ? { updatedAt: explicit.updatedAt } : {}),
    };
  });

  // Backward compatibility: if legacy combined "kit" was fullPaid, cover split kit items unless explicitly marked false
  if (settledByHead["kit"]?.fullPaid) {
    SPLIT_KIT_HEAD_KEYS.forEach((subKey) => {
      const explicitSub = student.settledFeeHeads?.[subKey];
      if (!explicitSub || explicitSub.fullPaid !== false) {
        const subCap = getConfiguredHeadAmountForClass(classObj, subKey);
        settledByHead[subKey] = {
          ...(settledByHead[subKey] || { totalPaid: subCap }),
          fullPaid: true,
          totalPaid: Math.max(settledByHead[subKey]?.totalPaid || 0, subCap),
          ...(subCap > 0 ? { targetCap: subCap } : {}),
        };
      }
    });
  }

  return {
    isFullAdmissionPackagePaid,
    settledByHead,
    paidCampaignIds,
  };
};

export interface AdmissionHeadDraftInput {
  id: string;
  description: string;
  due: number;
  included?: boolean;
  deferToMonth?: string;
  headKey?: string;
  conAmount?: number;
}

export const buildSettledHeadsFromAdmission = (params: {
  allDraftLines: AdmissionHeadDraftInput[];
  paidById: Map<string, number>;
  conById: Map<string, number>;
  paymentPlan: "registration_only" | "half_payment" | "full_payment";
  balanceDue: number;
  classObj?: Pick<SchoolClass, "name" | "defaultFee" | "feeStructure"> | null;
  nowIso?: string;
  actorName?: string;
}): {
  settledFeeHeads: Record<string, SettledFeeHeadRecord>;
  deferredScheduledHeads: DeferredScheduledFeeHead[];
  waivedFeeHeads: Record<string, WaivedFeeHeadRecord>;
} => {
  const { allDraftLines, paidById, conById, paymentPlan, balanceDue, classObj, nowIso, actorName } = params;
  const stamp = nowIso || new Date().toISOString();
  const dateOnly = stamp.slice(0, 10);
  const settledFeeHeads: Record<string, SettledFeeHeadRecord> = {};
  const deferredScheduledHeads: DeferredScheduledFeeHead[] = [];
  const waivedFeeHeads: Record<string, WaivedFeeHeadRecord> = {};

  allDraftLines.forEach((line, idx) => {
    const headKey = line.headKey || canonicalizeFeeHeadKey(line.id || line.description);
    if (headKey === "back_due" || headKey === "bus") return;

    const configuredCap = getConfiguredHeadAmountForClass(classObj, headKey);
    const dueVal = Math.max(0, Number(line.due) || 0);
    const targetCap = configuredCap > 0 ? Math.max(configuredCap, dueVal) : dueVal;

    // Deferred to a specific month
    if (line.deferToMonth && /^\d{4}-\d{2}$/.test(line.deferToMonth) && dueVal > 0) {
      deferredScheduledHeads.push({
        id: `def_${headKey}_${line.deferToMonth}_${idx}_${Date.now().toString(36)}`,
        headKey,
        description: line.description.trim() || headKey,
        amount: dueVal,
        targetMonth: line.deferToMonth,
        settled: false,
        paidAmount: 0,
      });
      settledFeeHeads[headKey] = {
        fullPaid: false,
        totalPaid: 0,
        targetCap,
        updatedAt: stamp,
      };
      return;
    }

    // Explicitly unchecked / excluded
    if (line.included === false) {
      settledFeeHeads[headKey] = {
        fullPaid: false,
        totalPaid: 0,
        targetCap,
        updatedAt: stamp,
      };
      return;
    }

    const paidVal = Math.max(0, Number(paidById.get(line.id) || 0));
    const conVal = Math.max(0, Number(conById.get(line.id) ?? line.conAmount ?? 0));
    const prev = settledFeeHeads[headKey];
    const totalPaid = (prev?.totalPaid || 0) + paidVal;
    const totalWaived = (prev?.waivedAmount || 0) + conVal;
    const settledInFull =
      (paymentPlan === "full_payment" && balanceDue <= 0) ||
      (dueVal > 0 && paidVal + conVal >= dueVal);

    settledFeeHeads[headKey] = {
      fullPaid: Boolean(prev?.fullPaid || settledInFull),
      totalPaid,
      ...(totalWaived > 0 ? { waivedAmount: totalWaived } : {}),
      targetCap,
      updatedAt: stamp,
    };

    if (conVal > 0) {
      waivedFeeHeads[headKey] = {
        waivedAmount: totalWaived,
        fullWaived: dueVal > 0 && conVal >= dueVal,
        label: line.description.trim() || headKey,
        reason: conVal >= dueVal ? "100% Waived at Admission" : "Admission Head Discount",
        date: dateOnly,
        ...(actorName ? { by: actorName } : {}),
      };
    }
  });

  return { settledFeeHeads, deferredScheduledHeads, waivedFeeHeads };
};

export interface ScheduledMonthFeesResult {
  items: AppliedTermFeeItem[];
  totalTermCampaignAmount: number;
  totalDeferredAdmissionAmount: number;
  totalExtraHeadsAmount: number;
  exemptedReasons: string[];
}

export const resolveScheduledFeesForStudentMonth = (params: {
  student: SchoolStudent;
  month: string; // "YYYY-MM"
  classObj?: SchoolClass | null;
  campaigns: FeeTermCampaign[];
  feeHistory: MonthlyFee[];
}): ScheduledMonthFeesResult => {
  const { student, month, classObj, campaigns, feeHistory } = params;
  const items: AppliedTermFeeItem[] = [];
  const exemptedReasons: string[] = [];

  const settlement = computeStudentHeadSettlement({
    student,
    classObj,
    feeHistory,
  });

  // 1. Student-specific Deferred Admission Heads scheduled for this month
  if (Array.isArray(student.deferredScheduledHeads)) {
    student.deferredScheduledHeads.forEach((defHead) => {
      if (!defHead || defHead.settled) return;
      if (defHead.targetMonth !== month) return;
      const rem = Math.max(0, Number(defHead.amount || 0) - Number(defHead.paidAmount || 0));
      if (rem <= 0) return;
      items.push({
        campaignId: defHead.id,
        headKey: defHead.headKey || canonicalizeFeeHeadKey(defHead.description),
        title: `${defHead.description} (Deferred Admission)`,
        amount: rem,
        source: "deferred_admission",
      });
    });
  }

  // 2. School-wide / Class-wide Term Fee Campaigns scheduled for this month
  const activeCampaigns = (campaigns || []).filter((c) => {
    if (!c || c.active === false || c.targetMonth !== month) return false;
    const hasPositiveClassAmt =
      c.classAmounts && Object.values(c.classAmounts).some((v) => Number(v) > 0);
    return Number(c.amount) > 0 || Boolean(hasPositiveClassAmt);
  });

  // Also track running added amounts per head within the same month so respectHeadCap stays exact
  const addedThisMonthByHead = new Map<string, number>();
  items.forEach((it) => {
    addedThisMonthByHead.set(it.headKey, (addedThisMonthByHead.get(it.headKey) || 0) + it.amount);
  });

  activeCampaigns.forEach((camp) => {
    // Check class scope
    const matchesClass =
      camp.classIds === "ALL" ||
      (Array.isArray(camp.classIds) && camp.classIds.includes(student.classId));
    if (!matchesClass) return;

    const hasClassOverride = Boolean(
      camp.classAmounts && Object.prototype.hasOwnProperty.call(camp.classAmounts, student.classId)
    );
    const configuredClassAmount = hasClassOverride
      ? Math.max(0, Math.round(Number(camp.classAmounts![student.classId]) || 0))
      : Math.max(0, Math.round(Number(camp.amount) || 0));
    if (configuredClassAmount <= 0) return;

    // Already paid this exact campaign in another/earlier receipt?
    if (settlement.paidCampaignIds.has(camp.id)) {
      exemptedReasons.push(`${camp.title}: Already paid`);
      return;
    }

    // Filter: only partial / registration_only students?
    const hasPartialOrRegPlan =
      student.admissionPaymentPlan === "registration_only" ||
      student.admissionPaymentPlan === "half_payment" ||
      Number(student.admissionDueBalance || 0) > 0;

    if (camp.onlyPartialOrRegStudents) {
      const isFullPlan =
        !hasPartialOrRegPlan &&
        (student.admissionPaymentPlan === "full_payment" || settlement.isFullAdmissionPackagePaid);
      if (isFullPlan) {
        exemptedReasons.push(`${camp.title}: Exempt (Full Payment Admission)`);
        return;
      }
    }

    const headSettled = settlement.settledByHead[camp.headKey];
    const hasExplicitHeadRecord = Boolean(student.settledFeeHeads?.[camp.headKey]);

    // Guard 1: Skip students who paid full admission package (unless this specific head was explicitly left unpaid at admission!)
    if (camp.skipFullPaidStudents && settlement.isFullAdmissionPackagePaid && !hasPartialOrRegPlan) {
      if (!hasExplicitHeadRecord || headSettled?.fullPaid !== false) {
        exemptedReasons.push(`${camp.title}: Exempt (Full Admission Paid)`);
        return;
      }
    }

    // Guard 2: Skip students who already settled this specific fee head in full
    if (camp.skipSettledHeadStudents && headSettled?.fullPaid) {
      exemptedReasons.push(`${camp.title}: Exempt (${camp.headKey} 100% Paid)`);
      return;
    }

    let billable = configuredClassAmount;

    // Guard 3: Respect configured class cap (e.g. Exam Fee ₹600 cap -> if ₹400 already paid, max ₹200 more)
    if (camp.respectHeadCap !== false && camp.headKey !== "custom" && !camp.headKey.startsWith("custom_")) {
      const classCap = getConfiguredHeadAmountForClass(classObj, camp.headKey);
      const effectiveCap = headSettled?.targetCap && headSettled.targetCap > 0
        ? headSettled.targetCap
        : classCap;
      if (effectiveCap > 0) {
        const alreadyPaid =
          Number(headSettled?.totalPaid || 0) +
          Number(headSettled?.waivedAmount || 0) +
          (addedThisMonthByHead.get(camp.headKey) || 0);
        const remainingCap = Math.max(0, effectiveCap - alreadyPaid);
        if (remainingCap <= 0) {
          exemptedReasons.push(`${camp.title}: Exempt (Cap ₹${effectiveCap} reached)`);
          return;
        }
        billable = Math.min(billable, remainingCap);
      }
    }

    if (billable <= 0) return;

    addedThisMonthByHead.set(camp.headKey, (addedThisMonthByHead.get(camp.headKey) || 0) + billable);
    items.push({
      campaignId: camp.id,
      headKey: camp.headKey,
      title: camp.title,
      amount: billable,
      source: "term_campaign",
    });
  });

  const totalTermCampaignAmount = items
    .filter((i) => i.source === "term_campaign")
    .reduce((s, i) => s + i.amount, 0);
  const totalDeferredAdmissionAmount = items
    .filter((i) => i.source === "deferred_admission")
    .reduce((s, i) => s + i.amount, 0);

  return {
    items,
    totalTermCampaignAmount,
    totalDeferredAdmissionAmount,
    totalExtraHeadsAmount: totalTermCampaignAmount + totalDeferredAdmissionAmount,
    exemptedReasons,
  };
};

export const previewCampaignImpact = (params: {
  campaign: FeeTermCampaign;
  students: SchoolStudent[];
  classes: SchoolClass[];
  feeHistory: MonthlyFee[];
}): {
  totalInScope: number;
  billedCount: number;
  exemptedCount: number;
  totalBillableAmount: number;
  billedSamples: Array<{ name: string; rollNo: string; amount: number }>;
  exemptedSamples: Array<{ name: string; rollNo: string; reason: string }>;
} => {
  const { campaign, students, classes, feeHistory } = params;
  const classMap = new Map(classes.map((c) => [c.id, c]));

  let totalInScope = 0;
  let billedCount = 0;
  let exemptedCount = 0;
  let totalBillableAmount = 0;
  const billedSamples: Array<{ name: string; rollNo: string; amount: number }> = [];
  const exemptedSamples: Array<{ name: string; rollNo: string; reason: string }> = [];

  students.forEach((st) => {
    const inClass =
      campaign.classIds === "ALL" ||
      (Array.isArray(campaign.classIds) && campaign.classIds.includes(st.classId));
    if (!inClass) return;

    totalInScope++;
    const res = resolveScheduledFeesForStudentMonth({
      student: st,
      month: campaign.targetMonth,
      classObj: classMap.get(st.classId),
      campaigns: [campaign],
      feeHistory,
    });
    const matched = res.items.find((it) => it.campaignId === campaign.id);
    if (matched && matched.amount > 0) {
      billedCount++;
      totalBillableAmount += matched.amount;
      if (billedSamples.length < 8) {
        billedSamples.push({ name: st.name, rollNo: st.rollNo, amount: matched.amount });
      }
    } else {
      exemptedCount++;
      if (exemptedSamples.length < 8) {
        exemptedSamples.push({
          name: st.name,
          rollNo: st.rollNo,
          reason: res.exemptedReasons[0] || "Already Paid in Full",
        });
      }
    }
  });

  return {
    totalInScope,
    billedCount,
    exemptedCount,
    totalBillableAmount,
    billedSamples,
    exemptedSamples,
  };
};

export const mergeSettlementAfterPayment = (params: {
  student: SchoolStudent;
  appliedItems: AppliedTermFeeItem[];
  isMonthFullyPaid: boolean;
  month: string;
  classObj?: SchoolClass | null;
  paidDate?: string;
  receiptNo?: string;
}): Partial<SchoolStudent> => {
  const { student, appliedItems, isMonthFullyPaid, month, classObj, paidDate, receiptNo } = params;
  if (!isMonthFullyPaid || !appliedItems || appliedItems.length === 0) return {};

  const nowIso = paidDate || new Date().toISOString();
  const nextSettled: Record<string, SettledFeeHeadRecord> = {
    ...(student.settledFeeHeads || {}),
  };

  appliedItems.forEach((it) => {
    const key = it.headKey;
    const prev = nextSettled[key];
    const configuredCap = getConfiguredHeadAmountForClass(classObj, key);
    const targetCap = prev?.targetCap ?? (configuredCap > 0 ? configuredCap : undefined);
    const nextTotal = (prev?.totalPaid || 0) + Number(it.amount || 0);
    const fullPaid =
      Boolean(prev?.fullPaid) ||
      Boolean(targetCap && targetCap > 0 && nextTotal >= targetCap) ||
      it.source === "deferred_admission";

    nextSettled[key] = {
      fullPaid,
      totalPaid: nextTotal,
      ...(targetCap !== undefined ? { targetCap } : {}),
      updatedAt: nowIso,
    };
  });

  let nextDeferred = student.deferredScheduledHeads;
  if (Array.isArray(student.deferredScheduledHeads) && student.deferredScheduledHeads.length > 0) {
    nextDeferred = student.deferredScheduledHeads.map((dh) => {
      if (dh.targetMonth === month && !dh.settled) {
        return {
          ...dh,
          settled: true,
          paidAmount: dh.amount,
          settledDate: nowIso,
          ...(receiptNo ? { receiptNo } : {}),
        };
      }
      return dh;
    });
  }

  const nextPaidCampaignIds = Array.from(
    new Set([
      ...(student.paidCampaignIds || []),
      ...appliedItems.filter((it) => it.source === "term_campaign").map((it) => it.campaignId),
    ])
  );

  return {
    settledFeeHeads: nextSettled,
    ...(nextPaidCampaignIds.length > 0 ? { paidCampaignIds: nextPaidCampaignIds } : {}),
    ...(nextDeferred ? { deferredScheduledHeads: nextDeferred } : {}),
  };
};

export const isStudentRegOnlyOrPending = (params: {
  student: SchoolStudent;
  feeHistory: MonthlyFee[];
  classObj?: Pick<SchoolClass, "id" | "name" | "defaultFee" | "feeStructure"> | null;
}): boolean => {
  const { student, feeHistory, classObj } = params;
  if (
    student.admissionPaymentPlan === "registration_only" ||
    student.admissionPaymentPlan === "half_payment" ||
    Number(student.admissionDueBalance || 0) > 0
  ) {
    return true;
  }
  const settlement = computeStudentHeadSettlement({ student, classObj, feeHistory });
  return !settlement.isFullAdmissionPackagePaid && student.admissionPaymentPlan !== "full_payment";
};

export const addMonthsToYYYYMM = (baseMonth: string, offset: number): string => {
  const parts = String(baseMonth || "").split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const mon = parts[1] || (new Date().getMonth() + 1);
  const dt = new Date(year, mon - 1 + offset, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

export const buildCampaignsFromSchedulePlan = (params: {
  schoolId: string;
  plan: FeeTypeSchedulePlan;
  sessionId?: string;
  actorName?: string;
}): FeeTermCampaign[] => {
  const { schoolId, plan, sessionId, actorName } = params;
  if (!plan.enabled) return [];
  const planId = `plan_${plan.headKey}`;
  const nowIso = new Date().toISOString();

  return (plan.terms || [])
    .filter((t) => t && t.active !== false && /^\d{4}-\d{2}$/.test(t.targetMonth))
    .map((term, idx, arr) => {
      const positiveClassAmounts: Record<string, number> = {};
      Object.entries(term.classAmounts || {}).forEach(([cid, val]) => {
        const clean = Math.max(0, Math.round(Number(val) || 0));
        positiveClassAmounts[cid] = clean;
      });
      const fallbackAmt = Math.max(
        0,
        Math.round(Number(term.defaultAmount) || 0),
        ...Object.values(positiveClassAmounts).filter((v) => v > 0).slice(0, 1)
      );
      return {
        id: `${planId}_t${term.termNumber}_${term.targetMonth}`,
        schoolId,
        sessionId,
        planId,
        termIndex: idx + 1,
        termTotal: arr.length,
        title: term.title?.trim() || `${plan.headLabel} (Term ${idx + 1}/${arr.length})`,
        headKey: plan.headKey,
        amount: fallbackAmt,
        classAmounts: positiveClassAmounts,
        targetMonth: term.targetMonth,
        classIds: "ALL" as const,
        skipFullPaidStudents: true,
        skipSettledHeadStudents: true,
        respectHeadCap: plan.respectHeadCap,
        onlyPartialOrRegStudents: plan.targetMode === "reg_only_or_unpaid",
        active: true,
        createdAt: nowIso,
        createdBy: actorName,
      };
    })
    .filter((c) => c.amount > 0 || Object.values(c.classAmounts || {}).some((v) => v > 0));
};

export const syncCampaignsWithPlan = (params: {
  existingCampaigns: FeeTermCampaign[];
  schoolId: string;
  plan: FeeTypeSchedulePlan;
  sessionId?: string;
  actorName?: string;
}): FeeTermCampaign[] => {
  const { existingCampaigns, schoolId, plan, sessionId, actorName } = params;
  const planId = `plan_${plan.headKey}`;
  const kept = (existingCampaigns || []).filter((c) => c.planId !== planId);
  const generated = buildCampaignsFromSchedulePlan({ schoolId, plan, sessionId, actorName });
  return [...generated, ...kept];
};

export const previewSchedulePlanImpact = (params: {
  plan: FeeTypeSchedulePlan;
  schoolId: string;
  students: SchoolStudent[];
  classes: SchoolClass[];
  feeHistory: MonthlyFee[];
  sessionId?: string;
}): {
  campaigns: FeeTermCampaign[];
  billedStudentCount: number;
  exemptStudentCount: number;
  totalExpectedAmount: number;
  termSummaries: Array<{
    termId: string;
    title: string;
    targetMonth: string;
    billedCount: number;
    exemptedCount: number;
    totalAmount: number;
  }>;
  classBreakdown: Array<{
    classId: string;
    className: string;
    totalStudents: number;
    billedStudents: number;
    exemptStudents: number;
    perStudentPlanTotal: number;
    classTotalExpected: number;
  }>;
} => {
  const { plan, schoolId, students, classes, feeHistory, sessionId } = params;
  const campaigns = buildCampaignsFromSchedulePlan({ schoolId, plan, sessionId });
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const termSummaries = campaigns.map((camp, idx) => {
    const res = previewCampaignImpact({
      campaign: camp,
      students,
      classes,
      feeHistory,
    });
    return {
      termId: plan.terms[idx]?.id || camp.id,
      title: camp.title,
      targetMonth: camp.targetMonth,
      billedCount: res.billedCount,
      exemptedCount: res.exemptedCount,
      totalAmount: res.totalBillableAmount,
    };
  });

  const billedStudentIds = new Set<string>();
  const exemptStudentIds = new Set<string>();
  let totalExpectedAmount = 0;

  const classStats = new Map<
    string,
    {
      totalStudents: number;
      billedIds: Set<string>;
      exemptIds: Set<string>;
      classTotalExpected: number;
    }
  >();

  students.forEach((st) => {
    const stClass = classMap.get(st.classId);
    if (!classStats.has(st.classId)) {
      classStats.set(st.classId, {
        totalStudents: 0,
        billedIds: new Set(),
        exemptIds: new Set(),
        classTotalExpected: 0,
      });
    }
    const stat = classStats.get(st.classId)!;
    stat.totalStudents++;

    let studentPlanSum = 0;
    campaigns.forEach((camp) => {
      const res = resolveScheduledFeesForStudentMonth({
        student: st,
        month: camp.targetMonth,
        classObj: stClass,
        campaigns: [camp],
        feeHistory,
      });
      const hit = res.items.find((it) => it.campaignId === camp.id);
      if (hit && hit.amount > 0) {
        studentPlanSum += hit.amount;
      }
    });

    if (studentPlanSum > 0) {
      billedStudentIds.add(st.id);
      stat.billedIds.add(st.id);
      stat.classTotalExpected += studentPlanSum;
      totalExpectedAmount += studentPlanSum;
    } else {
      exemptStudentIds.add(st.id);
      stat.exemptIds.add(st.id);
    }
  });

  const classBreakdown = classes.map((cls) => {
    const stat = classStats.get(cls.id);
    const perStudentPlanTotal = (plan.terms || [])
      .filter((t) => t.active !== false)
      .reduce((sum, t) => sum + Math.max(0, Math.round(Number(t.classAmounts?.[cls.id] ?? t.defaultAmount ?? 0))), 0);
    return {
      classId: cls.id,
      className: cls.name,
      totalStudents: stat?.totalStudents || 0,
      billedStudents: stat?.billedIds.size || 0,
      exemptStudents: stat?.exemptIds.size || 0,
      perStudentPlanTotal,
      classTotalExpected: stat?.classTotalExpected || 0,
    };
  });

  return {
    campaigns,
    billedStudentCount: billedStudentIds.size,
    exemptStudentCount: exemptStudentIds.size,
    totalExpectedAmount,
    termSummaries,
    classBreakdown,
  };
};

export interface StorePendingFeeHead {
  id: string;
  headKey: string;
  label: string;
  hindiLabel: string;
  amount: number;
  paidSoFar: number;
  waivedSoFar: number;
  remainingAmount: number;
  isSettled: boolean;
  categoryType: "fee_head" | "kit_item" | "exam_term";
  campaignId?: string;
  targetMonth?: string;
  sourceLabel?: string;
}

export const getStudentStorePendingBreakdown = (params: {
  student: SchoolStudent;
  classObj?: Pick<SchoolClass, "id" | "name" | "defaultFee" | "feeStructure"> | null;
  school?: Pick<School, "feeTermCampaigns" | "feeTypeSchedulePlans"> | null;
  feeHistory: MonthlyFee[];
}): {
  kitItems: StorePendingFeeHead[];
  feeHeads: StorePendingFeeHead[];
  examTerms: StorePendingFeeHead[];
  allCollectible: StorePendingFeeHead[];
  isRegOnly: boolean;
  settlement: StudentHeadSettlementSummary;
} => {
  const { student, classObj, school, feeHistory } = params;
  const settlement = computeStudentHeadSettlement({
    student,
    classObj,
    feeHistory,
  });
  const isRegOnly = isStudentRegOnlyOrPending({ student, feeHistory, classObj });

  const makeEntry = (
    headKey: string,
    label: string,
    hindiLabel: string,
    categoryType: "fee_head" | "kit_item" | "exam_term",
    explicitAmount?: number
  ): StorePendingFeeHead | null => {
    const baseAmt =
      explicitAmount !== undefined
        ? Math.max(0, Math.round(explicitAmount))
        : Math.max(0, Math.round(getConfiguredHeadAmountForClass(classObj, headKey)));
    if (baseAmt <= 0) return null;
    const rec = settlement.settledByHead[headKey];
    const paidSoFar = Math.max(0, Math.round(Number(rec?.totalPaid || 0)));
    const waivedSoFar = Math.max(0, Math.round(Number(rec?.waivedAmount || 0)));
    const cap = rec?.targetCap && rec.targetCap > 0 ? Math.max(baseAmt, rec.targetCap) : baseAmt;
    const isSettled = Boolean(rec?.fullPaid) || paidSoFar + waivedSoFar >= cap;
    const remainingAmount = isSettled ? 0 : Math.max(0, cap - paidSoFar - waivedSoFar);
    return {
      id: `store_head_${headKey}`,
      headKey,
      label,
      hindiLabel,
      amount: cap,
      paidSoFar,
      waivedSoFar,
      remainingAmount,
      isSettled,
      categoryType,
      sourceLabel: isSettled
        ? waivedSoFar >= cap
          ? "Maaf / Waived"
          : "Paid"
        : remainingAmount < cap
        ? `Partial (₹${paidSoFar + waivedSoFar} settled)`
        : "Pending",
    };
  };

  const kitItems: StorePendingFeeHead[] = [
    makeEntry("smart_id_card", "Smart QR ID Card", "स्मार्ट QR आई-कार्ड", "kit_item"),
    makeEntry("school_diary", "School Diary", "स्कूल डायरी", "kit_item"),
    makeEntry("tie_belt_set", "Tie & Belt Set", "टाई व बेल्ट सेट", "kit_item"),
    makeEntry("progress_folder", "Progress Folder", "प्रोग्रेस फोल्डर", "kit_item"),
  ].filter((x): x is StorePendingFeeHead => Boolean(x));

  const tuitionBase = Math.max(
    0,
    Number(student.monthlyFee || 0) || getConfiguredHeadAmountForClass(classObj, "tuition_first_month")
  );
  const feeHeads: StorePendingFeeHead[] = [
    makeEntry("development", "Development Fee", "विकास शुल्क (Development Fee)", "fee_head"),
    makeEntry("tuition_first_month", "1st Month Tuition Fee", "प्रथम माह ट्यूशन शुल्क", "fee_head", tuitionBase),
    makeEntry("admission", "Admission Fee", "प्रवेश शुल्क (Admission Fee)", "fee_head"),
    makeEntry("annual", "Annual Charges", "वार्षिक शुल्क", "fee_head"),
    makeEntry("caution", "Caution Money", "कॉशन मनी", "fee_head"),
  ].filter((x): x is StorePendingFeeHead => Boolean(x));

  // Include any additional active non-bus, non-exam, non-monthly heads defined in feeGroups/customHeads
  const coveredHeadKeys = new Set<string>([
    "smart_id_card",
    "school_diary",
    "tie_belt_set",
    "progress_folder",
    "kit",
    "development",
    "tuition_first_month",
    "admission",
    "annual",
    "caution",
    "exam",
    "registration",
    "bus",
    "back_due",
  ]);

  const extraCustomTotals = new Map<string, { label: string; amount: number }>();
  const fs = classObj?.feeStructure;
  if (fs?.feeGroups && Array.isArray(fs.feeGroups) && fs.feeGroups.length > 0) {
    fs.feeGroups.forEach((grp) => {
      if (grp.enabled === false) return;
      const { itemsWithNet } = getGroupNetItems(grp);
      const isDevGroup = /development|विकास/i.test(grp.title || "");
      itemsWithNet.forEach(({ item: it, netAmount }) => {
        if (it.enabled === false || netAmount <= 0) return;
        if (it.isUserOptional || it.legacyKey === "busFee") return;
        const sec = it.billingSection || grp.billingSection || "admission";
        if (sec === "monthly" || sec === "exam" || sec === "optional") return;
        const inferred = inferLegacyKeyFromFeeHeadName(it.name, it.legacyKey);
        let hKey = legacyKeyToCanonicalHeadKey(inferred) || canonicalizeFeeHeadKey(it.id || it.name);
        if (hKey.startsWith("custom_") && isDevGroup) hKey = "development";
        if (coveredHeadKeys.has(hKey)) return;
        const prev = extraCustomTotals.get(hKey);
        extraCustomTotals.set(hKey, {
          label: prev?.label || it.name,
          amount: (prev?.amount || 0) + Math.round(netAmount),
        });
      });
    });
  } else if (Array.isArray(fs?.customHeads) && fs.customHeads.length > 0) {
    fs.customHeads.forEach((h) => {
      if (!h || h.enabled === false || Number(h.amount || 0) <= 0) return;
      const hKey = canonicalizeFeeHeadKey(h.id || h.name);
      if (coveredHeadKeys.has(hKey)) return;
      const prev = extraCustomTotals.get(hKey);
      extraCustomTotals.set(hKey, {
        label: prev?.label || h.name,
        amount: (prev?.amount || 0) + Math.round(Number(h.amount || 0)),
      });
    });
  }

  extraCustomTotals.forEach((val, hKey) => {
    const entry = makeEntry(hKey, val.label, val.label, "fee_head", val.amount);
    if (entry) feeHeads.push(entry);
  });

  // Build Scheduled Examination Fee Terms (from saved Campaigns & Plans)
  const examTerms: StorePendingFeeHead[] = [];
  const seenCampaignIds = new Set<string>();
  const rawCampaigns: FeeTermCampaign[] = [...(school?.feeTermCampaigns || [])];

  // Also ensure any enabled Exam Plan terms from school.feeTypeSchedulePlans?.exam appear cleanly
  const examPlan = school?.feeTypeSchedulePlans?.exam;
  if (examPlan?.enabled && Array.isArray(examPlan.terms)) {
    const generated = buildCampaignsFromSchedulePlan({
      schoolId: student.schoolId,
      plan: examPlan,
      sessionId: student.sessionId,
    });
    generated.forEach((gc) => {
      if (!rawCampaigns.some((rc) => rc.id === gc.id)) {
        rawCampaigns.push(gc);
      }
    });
  }

  rawCampaigns
    .filter((c) => c && c.active !== false && c.headKey === "exam")
    .forEach((camp) => {
      if (seenCampaignIds.has(camp.id)) return;
      const inClass =
        camp.classIds === "ALL" ||
        (Array.isArray(camp.classIds) && camp.classIds.includes(student.classId));
      if (!inClass) return;

      const hasClassAmt =
        camp.classAmounts && Object.prototype.hasOwnProperty.call(camp.classAmounts, student.classId);
      const amt = hasClassAmt
        ? Math.max(0, Math.round(Number(camp.classAmounts![student.classId]) || 0))
        : Math.max(0, Math.round(Number(camp.amount) || 0));
      if (amt <= 0) return;

      seenCampaignIds.add(camp.id);
      const examHeadSettled = settlement.settledByHead["exam"];
      const alreadyPaidThisCamp =
        settlement.paidCampaignIds.has(camp.id) || Boolean(examHeadSettled?.fullPaid);

      examTerms.push({
        id: `store_exam_${camp.id}`,
        headKey: "exam",
        campaignId: camp.id,
        targetMonth: camp.targetMonth,
        label: camp.title,
        hindiLabel: `परीक्षा टर्म (${camp.targetMonth})`,
        amount: amt,
        paidSoFar: alreadyPaidThisCamp ? amt : 0,
        waivedSoFar: 0,
        remainingAmount: alreadyPaidThisCamp ? 0 : amt,
        isSettled: alreadyPaidThisCamp,
        categoryType: "exam_term",
        sourceLabel: alreadyPaidThisCamp ? "Paid / Settled" : `Month: ${camp.targetMonth}`,
      });
    });

  // Fallback generic Examination Fee if no term campaign/plan exists yet
  if (examTerms.length === 0) {
    const fallbackExam = makeEntry("exam", "Examination Fee (Term 1)", "परीक्षा शुल्क", "exam_term");
    if (fallbackExam) {
      examTerms.push(fallbackExam);
    }
  }

  return {
    kitItems,
    feeHeads,
    examTerms,
    allCollectible: [...kitItems, ...feeHeads, ...examTerms],
    isRegOnly,
    settlement,
  };
};


