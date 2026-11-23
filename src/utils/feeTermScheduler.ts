import type {
  AppliedTermFeeItem,
  DeferredScheduledFeeHead,
  FeeTermCampaign,
  MonthlyFee,
  SchoolClass,
  SchoolStudent,
  SettledFeeHeadRecord,
} from "../school-types";
import { getPosterFeeRowForClass } from "./schoolFeeChart2027";

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
    key: "kit",
    label: "Student Kit / Diary / I-Card / Tie-Belt",
    hindiLabel: "किट, डायरी, आई-कार्ड व टाई-बेल्ट",
    defaultTitle: "Student Kit & Diary Charge",
  },
  {
    key: "development",
    label: "Development Charge",
    hindiLabel: "विकास शुल्क (Development)",
    defaultTitle: "Development Fee (Term)",
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
    key: "custom",
    label: "Custom Fee Term",
    hindiLabel: "अन्य / कस्टम शुल्क (Custom)",
    defaultTitle: "Special Term Fee",
  },
];

export const canonicalizeFeeHeadKey = (idOrName?: string | null): string => {
  const raw = String(idOrName || "").trim().toLowerCase();
  if (!raw) return "custom";

  // Direct ID prefixes from DirectAdmissionModal / FeeManager / OnlineAdmission
  if (raw === "fs_adm" || raw === "def_1" || raw === "adm_1" || raw === "admission" || raw === "admissionfee") {
    return "admission";
  }
  if (raw === "fs_reg" || raw === "def_2" || raw === "adm_2" || raw === "registration" || raw === "registrationfee") {
    return "registration";
  }
  if (raw === "fs_exam" || raw === "def_5" || raw === "examination" || raw === "examinationfee" || raw === "exam" || raw === "examfund") {
    return "exam";
  }
  if (raw === "fs_kit" || raw === "def_3" || raw === "kit" || raw === "idkitfee" || raw === "diarycharge" || raw === "idcardcharge" || raw === "tiebeltcharge" || raw === "progressfoldercharge") {
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

  // Fuzzy label matching
  if (/registration|पंजीकरण|फॉर्म\s*शुल्क|form\s*fee/i.test(raw)) return "registration";
  if (/exam|परीक्षा/i.test(raw)) return "exam";
  if (/diary|i-?card|tie|belt|folder|किट|डायरी|kit/i.test(raw)) return "kit";
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

export const getConfiguredHeadAmountForClass = (
  cls: Pick<SchoolClass, "name" | "defaultFee" | "feeStructure"> | undefined | null,
  headKey: string
): number => {
  const fs = cls?.feeStructure;
  const poster = getPosterFeeRowForClass(cls?.name);

  switch (headKey) {
    case "admission":
      return Number(fs?.admissionFee ?? poster?.admissionFee ?? 0);
    case "registration":
      return Number(fs?.registrationFee ?? poster?.registrationFee ?? 0);
    case "exam":
      return Number(fs?.examinationFee ?? poster?.examinationFee ?? 0);
    case "development":
      return Number(fs?.developmentCharge ?? fs?.developmentFee ?? poster?.developmentCharge ?? 0);
    case "annual":
      return Number(fs?.annualCharges ?? 0);
    case "caution":
      return Number(fs?.cautionMoney ?? 0);
    case "kit": {
      if (fs) {
        const sum =
          Number(fs.idCardCharge ?? 0) +
          Number(fs.diaryCharge ?? 0) +
          Number(fs.tieBeltCharge ?? 0) +
          Number(fs.progressFolderCharge ?? 0);
        if (sum > 0) return sum;
      }
      return Number(poster?.diaryKitTotal ?? 0);
    }
    case "tuition_first_month":
      return Number(fs?.tuitionFee ?? cls?.defaultFee ?? poster?.tuitionFee ?? 0);
    default:
      return 0;
  }
};

export interface StudentHeadSettlementSummary {
  isFullAdmissionPackagePaid: boolean;
  settledByHead: Record<string, SettledFeeHeadRecord>;
  paidCampaignIds: Set<string>;
}

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
  const paidCampaignIds = new Set<string>();

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

  // Merge history sums into settledByHead
  const allHeadKeys = new Set<string>([
    ...Object.keys(settledByHead),
    ...Array.from(paidByHistoryHead.keys()),
    "admission",
    "registration",
    "exam",
    "kit",
    "development",
    "annual",
    "caution",
  ]);

  allHeadKeys.forEach((key) => {
    const explicit = settledByHead[key];
    const histPaid = paidByHistoryHead.get(key) || 0;
    const configuredCap = getConfiguredHeadAmountForClass(classObj, key);
    const totalPaid = Math.max(Number(explicit?.totalPaid || 0), histPaid);
    const targetCap = explicit?.targetCap ?? (configuredCap > 0 ? configuredCap : undefined);

    // If student explicitly has `settledFeeHeads[key]` saved at admission:
    // - If `explicit.fullPaid === true`, keep true.
    // - If `explicit.fullPaid === false`, ONLY promote to true if subsequent payments reached `targetCap`!
    //   This guarantees an unchecked/deferred head at admission stays exempt=false even under full_payment!
    let fullPaid = false;
    if (explicit) {
      fullPaid = explicit.fullPaid || Boolean(targetCap && targetCap > 0 && totalPaid >= targetCap);
    } else {
      fullPaid =
        isFullAdmissionPackagePaid ||
        Boolean(targetCap && targetCap > 0 && totalPaid >= targetCap);
    }

    settledByHead[key] = {
      fullPaid,
      totalPaid,
      ...(targetCap !== undefined ? { targetCap } : {}),
      ...(explicit?.updatedAt ? { updatedAt: explicit.updatedAt } : {}),
    };
  });

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
}

export const buildSettledHeadsFromAdmission = (params: {
  allDraftLines: AdmissionHeadDraftInput[];
  paidById: Map<string, number>;
  conById: Map<string, number>;
  paymentPlan: "registration_only" | "half_payment" | "full_payment";
  balanceDue: number;
  classObj?: Pick<SchoolClass, "name" | "defaultFee" | "feeStructure"> | null;
  nowIso?: string;
}): {
  settledFeeHeads: Record<string, SettledFeeHeadRecord>;
  deferredScheduledHeads: DeferredScheduledFeeHead[];
} => {
  const { allDraftLines, paidById, conById, paymentPlan, balanceDue, classObj, nowIso } = params;
  const stamp = nowIso || new Date().toISOString();
  const settledFeeHeads: Record<string, SettledFeeHeadRecord> = {};
  const deferredScheduledHeads: DeferredScheduledFeeHead[] = [];

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
    const conVal = Math.max(0, Number(conById.get(line.id) || 0));
    const prev = settledFeeHeads[headKey];
    const totalPaid = (prev?.totalPaid || 0) + paidVal;
    const settledInFull =
      (paymentPlan === "full_payment" && balanceDue <= 0) ||
      (dueVal > 0 && paidVal + conVal >= dueVal);

    settledFeeHeads[headKey] = {
      fullPaid: Boolean(prev?.fullPaid || settledInFull),
      totalPaid,
      targetCap,
      updatedAt: stamp,
    };
  });

  return { settledFeeHeads, deferredScheduledHeads };
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
  const activeCampaigns = (campaigns || []).filter(
    (c) => c && c.active !== false && c.targetMonth === month && Number(c.amount) > 0
  );

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

    // Already paid this exact campaign in another/earlier receipt?
    if (settlement.paidCampaignIds.has(camp.id)) {
      exemptedReasons.push(`${camp.title}: Already paid`);
      return;
    }

    // Filter: only partial / registration_only students?
    if (camp.onlyPartialOrRegStudents) {
      const isFullPlan =
        student.admissionPaymentPlan === "full_payment" || settlement.isFullAdmissionPackagePaid;
      if (isFullPlan) {
        exemptedReasons.push(`${camp.title}: Exempt (Full Payment Admission)`);
        return;
      }
    }

    const headSettled = settlement.settledByHead[camp.headKey];
    const hasExplicitHeadRecord = Boolean(student.settledFeeHeads?.[camp.headKey]);

    // Guard 1: Skip students who paid full admission package (unless this specific head was explicitly left unpaid at admission!)
    if (camp.skipFullPaidStudents && settlement.isFullAdmissionPackagePaid) {
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

    let billable = Math.max(0, Math.round(Number(camp.amount) || 0));

    // Guard 3: Respect configured class cap (e.g. Exam Fee ₹600 cap -> if ₹400 already paid, max ₹200 more)
    if (camp.respectHeadCap !== false && camp.headKey !== "custom") {
      const classCap = getConfiguredHeadAmountForClass(classObj, camp.headKey);
      const effectiveCap = headSettled?.targetCap && headSettled.targetCap > 0
        ? headSettled.targetCap
        : classCap;
      if (effectiveCap > 0) {
        const alreadyPaid =
          Number(headSettled?.totalPaid || 0) + (addedThisMonthByHead.get(camp.headKey) || 0);
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

  return {
    settledFeeHeads: nextSettled,
    ...(nextDeferred ? { deferredScheduledHeads: nextDeferred } : {}),
  };
};
