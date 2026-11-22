import type {
  AdmissionOfferConfig,
  ClassAdmissionHeadToggles,
  ClassFeeHead,
  ClassFeeStructure,
  SchoolClass,
} from "../school-types";
import { getGroupNetItems, isItemShownInAdmission } from "./feeStructureUtils";
import {
  getDevelopmentFeeBreakup,
  getExamDiscountMeta,
  getPosterFeeRowForClass,
  getRegistrationDiscountMeta,
  resolveEffectiveClassForAdmission,
  type DevelopmentBreakupItem,
} from "./schoolFeeChart2027";

export interface AdmissionPackageLineItem {
  key: string;
  label: string;
  hint?: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  isAdmissionPrimary: boolean;
  prePrimaryExamOriginalFee?: number;
  prePrimaryExamDiscountPct?: number;
  registrationOriginalFee?: number;
  registrationDiscountPct?: number;
  developmentBreakup?: DevelopmentBreakupItem[];
}

export interface AdmissionOfferPackageBreakdown {
  items: AdmissionPackageLineItem[];
  originalTotal: number;
  offerDiscountTotal: number;
  discountedTotal: number;
  discountPercent: number;
  busFee: number;
  busAvailable: boolean;
  monthlyTuition: number;
  registrationFeeAmount: number;
  firstMonthTuitionAmount: number;
  totalExclTuition: number;
}

export const isAdmissionOfferActive = (offer?: AdmissionOfferConfig | null): boolean => {
  if (!offer || offer.enabled !== true) return false;
  const pct = Math.max(0, Math.min(90, Number(offer.discountPercent || 0)));
  const hasImages = Array.isArray(offer.images) && offer.images.some((im) => Boolean(im?.url));
  return pct > 0 || hasImages;
};

/**
 * Normalizes legacy/modern ClassFeeStructure consistently with OnlineAdmissionManager's buildClassFeeDraft.
 * Uses canonical 2027-28 poster defaults for unconfigured classes.
 */
const buildDraftFromClass = (cls?: SchoolClass | null): ClassFeeStructure => {
  const fs = cls?.feeStructure;
  const poster = getPosterFeeRowForClass(cls?.name);

  const rawRegistrationFee =
    fs?.registrationFee !== undefined
      ? Math.max(0, Number(fs.registrationFee))
      : (cls as any)?.registrationFee !== undefined
      ? Math.max(0, Number((cls as any).registrationFee))
      : poster?.registrationFee ?? 500;

  const rawExaminationFee =
    fs?.examinationFee !== undefined
      ? Math.max(0, Number(fs.examinationFee))
      : poster?.examinationFee ?? 600;

  const rawRepublicDayCharge =
    fs?.republicDayCharge !== undefined ? Math.max(0, Number(fs.republicDayCharge)) : 0;

  const rawIndependenceDayCharge =
    fs?.independenceDayCharge !== undefined ? Math.max(0, Number(fs.independenceDayCharge)) : 0;

  const rawDiaryCharge =
    fs?.diaryCharge !== undefined
      ? Math.max(0, Number(fs.diaryCharge))
      : poster?.diaryCharge ?? 100;

  const rawIdCardCharge =
    fs?.idCardCharge !== undefined
      ? Math.max(0, Number(fs.idCardCharge))
      : poster?.idCardCharge ?? 100;

  const rawTieBeltCharge =
    fs?.tieBeltCharge !== undefined
      ? Math.max(0, Number(fs.tieBeltCharge))
      : poster?.tieBeltCharge ?? 150;

  const rawProgressFolderCharge =
    fs?.progressFolderCharge !== undefined
      ? Math.max(0, Number(fs.progressFolderCharge))
      : poster?.progressFolderCharge ?? 150;

  const rawDevelopmentCharge =
    fs?.developmentCharge !== undefined
      ? Math.max(0, Number(fs.developmentCharge))
      : fs?.developmentFee !== undefined
      ? Math.max(0, Number(fs.developmentFee))
      : poster?.developmentCharge ?? 500;

  const rawAdmissionFee =
    fs?.admissionFee !== undefined
      ? Math.max(0, Number(fs.admissionFee))
      : (cls as any)?.admissionFee !== undefined
      ? Math.max(0, Number((cls as any).admissionFee))
      : poster?.admissionFee ?? 0;

  const rawAnnualCharges =
    fs?.annualCharges !== undefined ? Math.max(0, Number(fs.annualCharges)) : 0;

  const rawTuitionFee =
    fs?.tuitionFee !== undefined
      ? Math.max(0, Number(fs.tuitionFee))
      : cls?.defaultFee !== undefined
      ? Math.max(0, Number(cls.defaultFee))
      : poster?.tuitionFee ?? 0;

  const rawCautionMoney =
    fs?.cautionMoney !== undefined ? Math.max(0, Number(fs.cautionMoney)) : 0;

  const rawBusFee =
    fs?.busFee !== undefined
      ? Math.max(0, Number(fs.busFee))
      : (cls as any)?.busFee !== undefined
      ? Math.max(0, Number((cls as any).busFee))
      : 350;

  const savedToggles = fs?.enabledHeads;
  const enabledHeads: ClassAdmissionHeadToggles = {
    registrationFee:
      typeof savedToggles?.registrationFee === "boolean" ? savedToggles.registrationFee : true,
    examinationFee:
      typeof savedToggles?.examinationFee === "boolean" ? savedToggles.examinationFee : true,
    republicDayCharge:
      typeof savedToggles?.republicDayCharge === "boolean"
        ? savedToggles.republicDayCharge
        : rawRepublicDayCharge > 0,
    independenceDayCharge:
      typeof savedToggles?.independenceDayCharge === "boolean"
        ? savedToggles.independenceDayCharge
        : rawIndependenceDayCharge > 0,
    diaryCharge:
      typeof savedToggles?.diaryCharge === "boolean" ? savedToggles.diaryCharge : true,
    idCardCharge:
      typeof savedToggles?.idCardCharge === "boolean" ? savedToggles.idCardCharge : true,
    tieBeltCharge:
      typeof savedToggles?.tieBeltCharge === "boolean" ? savedToggles.tieBeltCharge : true,
    progressFolderCharge:
      typeof savedToggles?.progressFolderCharge === "boolean"
        ? savedToggles.progressFolderCharge
        : true,
    developmentCharge:
      typeof savedToggles?.developmentCharge === "boolean" ? savedToggles.developmentCharge : true,
    admissionFee:
      typeof savedToggles?.admissionFee === "boolean" ? savedToggles.admissionFee : rawAdmissionFee > 0,
    annualCharges:
      typeof savedToggles?.annualCharges === "boolean" ? savedToggles.annualCharges : rawAnnualCharges > 0,
    tuitionFee:
      typeof savedToggles?.tuitionFee === "boolean" ? savedToggles.tuitionFee : rawTuitionFee > 0,
    cautionMoney:
      typeof savedToggles?.cautionMoney === "boolean" ? savedToggles.cautionMoney : rawCautionMoney > 0,
    busFee: typeof savedToggles?.busFee === "boolean" ? savedToggles.busFee : true,
  };

  const customHeads: ClassFeeHead[] = Array.isArray(fs?.customHeads)
    ? fs!.customHeads.map((h) => ({
        id: h.id || String(Date.now()),
        name: h.name || "Extra Charge",
        amount: Math.max(0, Number(h.amount || 0)),
        enabled: h.enabled !== false,
      }))
    : [];

  return {
    admissionFee: rawAdmissionFee,
    registrationFee: rawRegistrationFee,
    examinationFee: rawExaminationFee,
    republicDayCharge: rawRepublicDayCharge,
    independenceDayCharge: rawIndependenceDayCharge,
    diaryCharge: rawDiaryCharge,
    idCardCharge: rawIdCardCharge,
    tieBeltCharge: rawTieBeltCharge,
    progressFolderCharge: rawProgressFolderCharge,
    developmentCharge: rawDevelopmentCharge,
    annualCharges: rawAnnualCharges,
    tuitionFee: rawTuitionFee,
    cautionMoney: rawCautionMoney,
    busFee: rawBusFee,
    enabledHeads,
    customHeads,
    examOriginalFee: fs?.examOriginalFee ?? poster?.examOriginalFee,
    examDiscountPct: fs?.examDiscountPct ?? poster?.examDiscountPct,
  };
};

/**
 * Computes itemized Admission Package breakdown + Admission Offer % OFF for any class.
 */
export const computeClassAdmissionOfferBreakdown = (
  cls?: SchoolClass | null,
  offer?: AdmissionOfferConfig | null,
  options?: { includeBus?: boolean; customBusFee?: number; excludeTuition?: boolean }
): AdmissionOfferPackageBreakdown => {
  if (!cls) {
    return {
      items: [],
      originalTotal: 0,
      offerDiscountTotal: 0,
      discountedTotal: 0,
      discountPercent: 0,
      busFee: 0,
      busAvailable: false,
      monthlyTuition: 0,
      registrationFeeAmount: 0,
      firstMonthTuitionAmount: 0,
      totalExclTuition: 0,
    };
  }

  const effectiveCls = resolveEffectiveClassForAdmission(cls);
  const fs = effectiveCls.feeStructure;
  const rawItems: Array<{
    key: string;
    label: string;
    hint?: string;
    originalAmount: number;
    isAdmissionPrimary: boolean;
    prePrimaryExamOriginalFee?: number;
    prePrimaryExamDiscountPct?: number;
    registrationOriginalFee?: number;
    registrationDiscountPct?: number;
    developmentBreakup?: DevelopmentBreakupItem[];
  }> = [];

  let busAvailable = false;
  let resolvedBusFee = 0;
  let registrationFeeAmount = 0;
  let firstMonthTuitionAmount = 0;

  if (fs?.feeGroups && Array.isArray(fs.feeGroups) && fs.feeGroups.length > 0) {
    fs.feeGroups.forEach((grp) => {
      if (grp.enabled === false) return;
      const { summary: grpSummary, itemsWithNet } = getGroupNetItems(grp);
      const offNote =
        grpSummary.discount > 0
          ? ` (${grp.discountLabel ? `${grp.discountLabel} • ` : ""}${grpSummary.badgeText})`
          : "";
      itemsWithNet.forEach(({ item: it, netAmount, itemDiscount }) => {
        if (it.enabled === false) return;
        if (!isItemShownInAdmission(it, grp)) return;
        const isBus = Boolean(it.isUserOptional || it.legacyKey === "busFee");
        if (isBus) {
          busAvailable = true;
          resolvedBusFee +=
            options?.customBusFee !== undefined ? Math.max(0, Number(options.customBusFee)) : netAmount;
          return;
        }
        const rawAmt = Math.max(0, Number(it.amount || 0));
        if (rawAmt <= 0 && netAmount <= 0) return;
        const sec = it.billingSection || grp.billingSection || "admission";
        const isTuition = it.legacyKey === "tuitionFee" || sec === "monthly" || /tuition/i.test(it.name);
        if (it.legacyKey === "registrationFee" || /registration/i.test(it.name)) {
          registrationFeeAmount += netAmount;
        }
        if (isTuition) {
          firstMonthTuitionAmount += netAmount;
          if (options?.excludeTuition) return;
        }

        const isReg = it.legacyKey === "registrationFee" || /registration/i.test(it.name);
        const regMeta = isReg ? getRegistrationDiscountMeta(cls.name, netAmount) : null;
        const isExam = it.legacyKey === "examinationFee" || sec === "exam" || /exam/i.test(it.name);
        const examMeta = isExam ? getExamDiscountMeta(cls.name, netAmount, fs) : null;
        const isDev = it.legacyKey === "developmentCharge" || /development/i.test(it.name);
        const devBreakup = isDev ? getDevelopmentFeeBreakup(cls.name, netAmount) : undefined;

        rawItems.push({
          key: `fg_${it.id}`,
          label: it.name,
          hint: regMeta?.hasDiscount
            ? `Special ${regMeta.discountPct}% OFF (Actual ₹${regMeta.originalAmount.toLocaleString("en-IN")} → ₹${regMeta.netAmount.toLocaleString("en-IN")})`
            : `${grp.title}${itemDiscount > 0 ? `${offNote} — Saved ₹${itemDiscount}` : ""}`,
          originalAmount: netAmount,
          isAdmissionPrimary:
            it.legacyKey === "admissionFee" ||
            it.legacyKey === "registrationFee" ||
            sec === "admission",
          ...(regMeta?.hasDiscount
            ? {
                registrationOriginalFee: regMeta.originalAmount,
                registrationDiscountPct: regMeta.discountPct,
              }
            : {}),
          ...(examMeta?.hasDiscount
            ? {
                prePrimaryExamOriginalFee: examMeta.originalAmount,
                prePrimaryExamDiscountPct: examMeta.discountPct,
              }
            : {}),
          ...(devBreakup && devBreakup.length > 0 ? { developmentBreakup: devBreakup } : {}),
        });
      });
    });
  } else {
    const draft = buildDraftFromClass(effectiveCls);
    const toggles = draft.enabledHeads!;
    busAvailable = Boolean(toggles.busFee);
    resolvedBusFee =
      options?.customBusFee !== undefined
        ? Math.max(0, Number(options.customBusFee))
        : Math.max(0, Number(draft.busFee || 0));

    if (toggles.registrationFee) {
      registrationFeeAmount = Math.max(0, Number(draft.registrationFee || 0));
    }
    if (toggles.tuitionFee) {
      firstMonthTuitionAmount = Math.max(0, Number(draft.tuitionFee || 0));
    }

    const pushIf = (
      cond: boolean | undefined,
      key: string,
      label: string,
      hint: string,
      amount: number | undefined,
      isAdmissionPrimary: boolean,
      extra?: {
        prePrimaryExamOriginalFee?: number;
        prePrimaryExamDiscountPct?: number;
        registrationOriginalFee?: number;
        registrationDiscountPct?: number;
        developmentBreakup?: DevelopmentBreakupItem[];
      }
    ) => {
      const val = Math.max(0, Number(amount || 0));
      if (cond && val > 0) {
        rawItems.push({
          key,
          label,
          hint,
          originalAmount: val,
          isAdmissionPrimary,
          ...extra,
        });
      }
    };

    const regMeta = getRegistrationDiscountMeta(cls.name, draft.registrationFee);
    pushIf(
      toggles.registrationFee,
      "registrationFee",
      "Registration Fee (पंजीकरण शुल्क)",
      regMeta.hasDiscount
        ? `Special ${regMeta.discountPct}% OFF (Actual ₹${regMeta.originalAmount.toLocaleString("en-IN")} → ₹${regMeta.netAmount.toLocaleString("en-IN")})`
        : "प्रवेश पंजीकरण व फॉर्म शुल्क",
      draft.registrationFee,
      true,
      regMeta.hasDiscount
        ? {
            registrationOriginalFee: regMeta.originalAmount,
            registrationDiscountPct: regMeta.discountPct,
          }
        : undefined
    );
    pushIf(
      toggles.admissionFee,
      "admissionFee",
      "Admission Charge (प्रवेश शुल्क)",
      "कक्षा के लिए एकमुश्त प्रवेश शुल्क",
      draft.admissionFee,
      true
    );

    const examMeta = getExamDiscountMeta(cls.name, draft.examinationFee, draft);
    pushIf(
      toggles.examinationFee,
      "examinationFee",
      "Examination Fee (वार्षिक 6 परीक्षा शुल्क)",
      examMeta.hasDiscount
        ? `Pre-Primary 50% Concession (Actual ₹${examMeta.originalAmount} → ₹${examMeta.netAmount})`
        : "P.A-1, P.A-2, HYE, P.A-3, P.A-4 व Annual Exam",
      draft.examinationFee,
      false,
      examMeta.hasDiscount
        ? {
            prePrimaryExamOriginalFee: examMeta.originalAmount,
            prePrimaryExamDiscountPct: examMeta.discountPct,
          }
        : undefined
    );

    const devAmount = Math.max(0, Number(draft.developmentCharge || 0));
    const hasSplitCelebrationRows =
      (toggles.republicDayCharge && Number(draft.republicDayCharge || 0) > 0) ||
      (toggles.independenceDayCharge && Number(draft.independenceDayCharge || 0) > 0);
    const devBreakup = !hasSplitCelebrationRows
      ? getDevelopmentFeeBreakup(cls.name, devAmount)
      : undefined;

    pushIf(
      toggles.developmentCharge,
      "developmentCharge",
      "Development Fee (विकास एवं गतिविधि कोष)",
      "वार्षिक समारोह, खेलकूद, लैब व कैंपस विकास कोष (Breakup पर क्लिक कर विवरण देखें)",
      draft.developmentCharge,
      false,
      devBreakup && devBreakup.length > 0 ? { developmentBreakup: devBreakup } : undefined
    );
    pushIf(
      toggles.diaryCharge,
      "diaryCharge",
      "School Diary (स्कूल डायरी)",
      "आधिकारिक छात्र डायरी व सिलेबस",
      draft.diaryCharge,
      false
    );
    pushIf(
      toggles.idCardCharge,
      "idCardCharge",
      "Smart QR ID Card (पहचान पत्र)",
      "क्यूआर कोड युक्त छात्र पहचान पत्र",
      draft.idCardCharge,
      false
    );
    pushIf(
      toggles.tieBeltCharge,
      "tieBeltCharge",
      "Tie & Belt Set (टाई व बेल्ट)",
      "आधिकारिक स्कूल टाई व बेल्ट",
      draft.tieBeltCharge,
      false
    );
    pushIf(
      toggles.progressFolderCharge,
      "progressFolderCharge",
      "Report Card, Badge & Folder (रिपोर्ट कार्ड, बैज व फोल्डर)",
      "प्रोग्रेस रिपोर्ट कार्ड, स्कूल बैज व होमवर्क फोल्डर",
      draft.progressFolderCharge,
      false
    );
    pushIf(
      toggles.republicDayCharge,
      "republicDayCharge",
      "Republic Day Celebration (26 जनवरी)",
      "गणतंत्र दिवस समारोह व कार्यक्रम",
      draft.republicDayCharge,
      false
    );
    pushIf(
      toggles.independenceDayCharge,
      "independenceDayCharge",
      "Independence Day Celebration (15 अगस्त)",
      "स्वतंत्रता दिवस समारोह व मिठाई",
      draft.independenceDayCharge,
      false
    );
    pushIf(
      toggles.annualCharges,
      "annualCharges",
      "Other Annual Charges (अन्य वार्षिक शुल्क)",
      "वार्षिक खेल व सांस्कृतिक कार्यक्रम",
      draft.annualCharges,
      false
    );
    if (!options?.excludeTuition) {
      pushIf(
        toggles.tuitionFee,
        "tuitionFee",
        "1st Month Tuition Fee (प्रथम माह शिक्षण शुल्क)",
        "प्रवेश माह का मासिक शुल्क",
        draft.tuitionFee,
        false
      );
    }
    pushIf(
      toggles.cautionMoney,
      "cautionMoney",
      "Caution / Security Deposit",
      "वापसी योग्य धरोहर राशि",
      draft.cautionMoney,
      false
    );

    (draft.customHeads || [])
      .filter((h) => h.enabled !== false && Number(h.amount || 0) > 0)
      .forEach((h) => {
        rawItems.push({
          key: `custom_${h.id}`,
          label: h.name,
          hint: "अतिरिक्त निर्धारित शुल्क",
          originalAmount: Math.max(0, Number(h.amount || 0)),
          isAdmissionPrimary: false,
        });
      });
  }

  if (options?.includeBus && busAvailable && resolvedBusFee > 0) {
    rawItems.push({
      key: "busFee",
      label: "School Bus / Transport Fee (1st Month)",
      hint: "वैकल्पिक स्कूल वाहन सुविधा",
      originalAmount: resolvedBusFee,
      isAdmissionPrimary: false,
    });
  }

  const offerEnabled = Boolean(offer?.enabled);
  const discountPercent = offerEnabled
    ? Math.max(0, Math.min(90, Math.round(Number(offer?.discountPercent || 0))))
    : 0;
  const applyScope = offer?.applyScope === "admission_only" ? "admission_only" : "all";

  const items: AdmissionPackageLineItem[] = rawItems.map((it) => {
    const isBusItem = it.key === "busFee";
    const eligible =
      discountPercent > 0 &&
      !isBusItem &&
      (applyScope === "all" || it.isAdmissionPrimary);
    const disc = eligible ? Math.round((it.originalAmount * discountPercent) / 100) : 0;
    const boundedDisc = Math.min(it.originalAmount, disc);
    return {
      ...it,
      discountAmount: boundedDisc,
      finalAmount: Math.max(0, it.originalAmount - boundedDisc),
    };
  });

  const originalTotal = items.reduce((s, it) => s + it.originalAmount, 0);
  const offerDiscountTotal = items.reduce((s, it) => s + it.discountAmount, 0);
  const discountedTotal = Math.max(0, originalTotal - offerDiscountTotal);
  const monthlyTuition = Number(
    fs?.tuitionFee ?? effectiveCls.defaultFee ?? getPosterFeeRowForClass(effectiveCls.name)?.tuitionFee ?? 0
  );
  const tuitionItemFinal =
    items.find((it) => it.key === "tuitionFee" || /tuition/i.test(it.label))?.finalAmount ?? 0;
  const totalExclTuition = options?.excludeTuition
    ? discountedTotal
    : Math.max(0, discountedTotal - tuitionItemFinal);

  return {
    items,
    originalTotal,
    offerDiscountTotal,
    discountedTotal,
    discountPercent,
    busFee: resolvedBusFee,
    busAvailable,
    monthlyTuition,
    registrationFeeAmount,
    firstMonthTuitionAmount,
    totalExclTuition,
  };
};
