import type {
  ClassAdmissionHeadToggles,
  ClassFeeGroup,
  ClassFeeHead,
  ClassFeeStructure,
  FeeSectionBucket,
  SchoolClass,
} from "../school-types";
import {
  calculateFeeGroupsTotals,
  getMonthlyFeeFromStructure,
  isGroupShownInAdmission,
  makeFeeUid,
  normalizeFeeGroups,
  syncStructureFromFeeGroups,
} from "./feeStructureUtils";
import {
  LIFE_MAKER_CHART_VERSION,
  normalizeClassNameForChart,
} from "./schoolFeeChart2027";

export interface SimpleFeeValues {
  tuitionFee: number;
  registrationFee: number;
  admissionFee: number;
  examinationFee: number;
  diaryKitFee: number;
  developmentCharge: number;
  annualCharges: number;
  busFee: number;
  includeMonthlyInAdmission: boolean;
  examOriginalFee?: number;
  examDiscountPct?: number;
}

const getLegacyActiveAmount = (
  groups: ClassFeeGroup[],
  keys: (keyof ClassAdmissionHeadToggles)[]
): number => {
  let sum = 0;
  for (const g of groups) {
    if (g.enabled === false) continue;
    for (const it of g.items || []) {
      if (it.enabled === false) continue;
      if (it.legacyKey && keys.includes(it.legacyKey)) {
        sum += Math.max(0, Number(it.amount || 0));
      }
    }
  }
  return sum;
};

export const extractSimpleFeeValues = (
  structure?: ClassFeeStructure | null
): SimpleFeeValues => {
  const groups = normalizeFeeGroups(structure, Number(structure?.tuitionFee || 0));
  const synced = syncStructureFromFeeGroups(groups, structure || undefined);

  const tuitionFee = getMonthlyFeeFromStructure(synced, Number(synced.tuitionFee || 0));
  const registrationFee = getLegacyActiveAmount(groups, ["registrationFee"]);
  const admissionFee = getLegacyActiveAmount(groups, ["admissionFee"]);
  const examinationFee = getLegacyActiveAmount(groups, ["examinationFee"]);
  const diaryKitFee = getLegacyActiveAmount(groups, [
    "diaryCharge",
    "idCardCharge",
    "tieBeltCharge",
    "progressFolderCharge",
    "cautionMoney",
  ]);
  const developmentCharge = getLegacyActiveAmount(groups, ["developmentCharge"]);
  const annualCharges = getLegacyActiveAmount(groups, ["annualCharges"]);
  const busFee = getLegacyActiveAmount(groups, ["busFee"]);

  const monthlyGroups = groups.filter(
    (g) =>
      g.enabled !== false &&
      (g.billingSection === "monthly" ||
        (g.items || []).some((it) => it.legacyKey === "tuitionFee"))
  );
  const includeMonthlyInAdmission =
    monthlyGroups.length > 0
      ? monthlyGroups.some((g) => isGroupShownInAdmission(g))
      : synced.enabledHeads?.tuitionFee !== false;

  return {
    tuitionFee,
    registrationFee,
    admissionFee,
    examinationFee,
    diaryKitFee,
    developmentCharge,
    annualCharges,
    busFee,
    includeMonthlyInAdmission,
    examOriginalFee: structure?.examOriginalFee,
    examDiscountPct: structure?.examDiscountPct,
  };
};

const upsertLegacyItemInGroups = (
  groups: ClassFeeGroup[],
  opts: {
    legacyKey: keyof ClassAdmissionHeadToggles;
    itemName: string;
    groupTitle: string;
    billingSection: FeeSectionBucket;
    amount: number;
    showInAdmission: boolean;
    isUserOptional?: boolean;
  }
): ClassFeeGroup[] => {
  const nextAmount = Math.max(0, Math.round(Number(opts.amount || 0)));
  let found = false;

  const updated = groups.map((g) => {
    const hasKey = (g.items || []).some((it) => it.legacyKey === opts.legacyKey);
    if (!hasKey) return g;
    found = true;
    return {
      ...g,
      enabled: true,
      items: (g.items || []).map((it) =>
        it.legacyKey === opts.legacyKey
          ? {
              ...it,
              amount: nextAmount,
              enabled: nextAmount > 0 || opts.legacyKey === "busFee",
              showInAdmission: opts.showInAdmission,
            }
          : it
      ),
    };
  });

  if (found) return updated;

  // Check if an appropriate group already exists by billingSection
  const targetIdx = updated.findIndex(
    (g) => g.billingSection === opts.billingSection && g.enabled !== false
  );
  const newItem: ClassFeeHead = {
    id: makeFeeUid(`it_${opts.legacyKey}`),
    name: opts.itemName,
    amount: nextAmount,
    enabled: nextAmount > 0 || opts.legacyKey === "busFee",
    showInAdmission: opts.showInAdmission,
    billingSection: opts.billingSection,
    targetSection: "ALL",
    legacyKey: opts.legacyKey,
    isUserOptional: Boolean(opts.isUserOptional),
  };

  if (targetIdx >= 0) {
    return updated.map((g, idx) =>
      idx === targetIdx ? { ...g, items: [...(g.items || []), newItem] } : g
    );
  }

  return [
    ...updated,
    {
      id: makeFeeUid(`grp_${opts.legacyKey}`),
      title: opts.groupTitle,
      billingSection: opts.billingSection,
      targetSection: "ALL",
      enabled: true,
      showInAdmission: opts.showInAdmission,
      items: [newItem],
    },
  ];
};

export const applySimpleFeePatchToStructure = (
  current: ClassFeeStructure | undefined,
  patch: Partial<SimpleFeeValues>
): ClassFeeStructure => {
  let groups = normalizeFeeGroups(current, Number(current?.tuitionFee || 0));

  if (patch.admissionFee !== undefined) {
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "admissionFee",
      itemName: "Admission Fee (प्रवेश शुल्क)",
      groupTitle: "Admission & Registration (प्रवेश एवं पंजीकरण)",
      billingSection: "admission",
      amount: patch.admissionFee,
      showInAdmission: true,
    });
  }

  if (patch.registrationFee !== undefined) {
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "registrationFee",
      itemName: "Registration / Form Fee (पंजीकरण शुल्क)",
      groupTitle: "Admission & Registration (प्रवेश एवं पंजीकरण)",
      billingSection: "admission",
      amount: patch.registrationFee,
      showInAdmission: true,
    });
  }

  if (patch.tuitionFee !== undefined) {
    // Also scale/set primary tuitionFee item cleanly and keep extra monthly custom items intact if any
    const hasLegacyTuition = groups.some((g) =>
      (g.items || []).some((it) => it.legacyKey === "tuitionFee")
    );
    if (hasLegacyTuition) {
      let extraMonthly = 0;
      groups.forEach((g) => {
        if (g.enabled === false) return;
        (g.items || []).forEach((it) => {
          if (
            it.enabled !== false &&
            (it.billingSection || g.billingSection) === "monthly" &&
            it.legacyKey !== "tuitionFee" &&
            !it.isUserOptional
          ) {
            extraMonthly += Math.max(0, Number(it.amount || 0));
          }
        });
      });
      const baseTuitionOnly = Math.max(0, Math.round(patch.tuitionFee) - extraMonthly);
      groups = upsertLegacyItemInGroups(groups, {
        legacyKey: "tuitionFee",
        itemName: "Monthly Tuition Fee",
        groupTitle: "Monthly Tuition Fee (मासिक शिक्षण शुल्क)",
        billingSection: "monthly",
        amount: baseTuitionOnly,
        showInAdmission:
          patch.includeMonthlyInAdmission ??
          extractSimpleFeeValues(current).includeMonthlyInAdmission,
      });
    } else {
      groups = upsertLegacyItemInGroups(groups, {
        legacyKey: "tuitionFee",
        itemName: "Monthly Tuition Fee",
        groupTitle: "Monthly Tuition Fee (मासिक शिक्षण शुल्क)",
        billingSection: "monthly",
        amount: patch.tuitionFee,
        showInAdmission:
          patch.includeMonthlyInAdmission ??
          extractSimpleFeeValues(current).includeMonthlyInAdmission,
      });
    }
  }

  if (patch.includeMonthlyInAdmission !== undefined) {
    const showAdm = Boolean(patch.includeMonthlyInAdmission);
    groups = groups.map((g) => {
      const isMonthly =
        g.billingSection === "monthly" ||
        (g.items || []).some((it) => it.legacyKey === "tuitionFee");
      if (!isMonthly) return g;
      return {
        ...g,
        showInAdmission: showAdm,
        items: (g.items || []).map((it) => ({
          ...it,
          showInAdmission: showAdm,
        })),
      };
    });
  }

  if (patch.examinationFee !== undefined) {
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "examinationFee",
      itemName: "Examination Fee",
      groupTitle: "Examination Fee (परीक्षा शुल्क)",
      billingSection: "exam",
      amount: patch.examinationFee,
      showInAdmission: true,
    });
  }

  if (patch.developmentCharge !== undefined) {
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "developmentCharge",
      itemName: "Development Charge (विकास शुल्क)",
      groupTitle: "Annual & Development Fee (वार्षिक एवं विकास शुल्क)",
      billingSection: "annual",
      amount: patch.developmentCharge,
      showInAdmission: true,
    });
  }

  if (patch.annualCharges !== undefined) {
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "annualCharges",
      itemName: "Annual Charges (वार्षिक शुल्क)",
      groupTitle: "Annual & Development Fee (वार्षिक एवं विकास शुल्क)",
      billingSection: "annual",
      amount: patch.annualCharges,
      showInAdmission: true,
    });
  }

  if (patch.diaryKitFee !== undefined) {
    const totalKit = Math.max(0, Math.round(Number(patch.diaryKitFee || 0)));
    const diaryAmt = totalKit === 500 ? 100 : Math.round(totalKit * 0.2);
    const idAmt = totalKit === 500 ? 100 : Math.round(totalKit * 0.2);
    const tieAmt = totalKit === 500 ? 150 : Math.round(totalKit * 0.3);
    const folderAmt = Math.max(0, totalKit - diaryAmt - idAmt - tieAmt);

    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "cautionMoney",
      itemName: "Caution / Security Fee",
      groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
      billingSection: "admission",
      amount: 0,
      showInAdmission: true,
    });
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "diaryCharge",
      itemName: "School Diary Charge",
      groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
      billingSection: "admission",
      amount: diaryAmt,
      showInAdmission: true,
    });
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "idCardCharge",
      itemName: "ID Card Charge",
      groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
      billingSection: "admission",
      amount: idAmt,
      showInAdmission: true,
    });
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "tieBeltCharge",
      itemName: "Tie & Belt Charge",
      groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
      billingSection: "admission",
      amount: tieAmt,
      showInAdmission: true,
    });
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "progressFolderCharge",
      itemName: "Report Card, Badge & Folder",
      groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
      billingSection: "admission",
      amount: folderAmt,
      showInAdmission: true,
    });
  }

  if (patch.busFee !== undefined) {
    groups = upsertLegacyItemInGroups(groups, {
      legacyKey: "busFee",
      itemName: "Monthly Bus / Transport Fee",
      groupTitle: "Transport / Bus Fee (वाहन शुल्क — User Optional)",
      billingSection: "optional",
      amount: patch.busFee,
      showInAdmission: true,
      isUserOptional: true,
    });
  }

  return syncStructureFromFeeGroups(groups, {
    ...(current || {}),
    ...(patch.examOriginalFee !== undefined ? { examOriginalFee: patch.examOriginalFee } : {}),
    ...(patch.examDiscountPct !== undefined ? { examDiscountPct: patch.examDiscountPct } : {}),
    chartVersion: LIFE_MAKER_CHART_VERSION,
  });
};

export interface JsonSimpleClassPayload {
  monthlyFee: number;
  registrationFee: number;
  admissionFee: number;
  examFee: number;
  diaryKitFee: number;
  developmentFee: number;
  annualCharges: number;
  busFee: number;
  includeMonthlyInAdmission: boolean;
  customHeads?: {
    name: string;
    amount: number;
    section: FeeSectionBucket;
    showInAdmission: boolean;
  }[];
}

export const exportClassesToJson = (
  classes: SchoolClass[],
  feeForms: Record<string, ClassFeeStructure>,
  format: "simple" | "full",
  targetClassId = "ALL"
): string => {
  const list =
    targetClassId !== "ALL"
      ? classes.filter((c) => c.id === targetClassId)
      : classes;

  const buildOne = (cls: SchoolClass) => {
    const struct =
      feeForms[cls.id] ||
      syncStructureFromFeeGroups(
        normalizeFeeGroups(cls.feeStructure, Number(cls.defaultFee || 0)),
        cls.feeStructure
      );

    if (format === "full") {
      return {
        feeGroups: (struct.feeGroups || []).map((g) => ({
          title: g.title,
          billingSection: g.billingSection,
          targetSection: g.targetSection || "ALL",
          enabled: g.enabled !== false,
          showInAdmission: isGroupShownInAdmission(g),
          ...(g.discountEnabled || Number(g.discountValue || 0) > 0
            ? {
                discountEnabled: g.discountEnabled !== false,
                discountType: g.discountType || "flat",
                discountValue: Number(g.discountValue || 0),
                discountLabel: g.discountLabel || "",
              }
            : {}),
          items: (g.items || []).map((it) => ({
            name: it.name,
            amount: Number(it.amount || 0),
            enabled: it.enabled !== false,
            showInAdmission:
              typeof it.showInAdmission === "boolean"
                ? it.showInAdmission
                : isGroupShownInAdmission(g),
            billingSection: it.billingSection || g.billingSection,
            ...(it.legacyKey ? { legacyKey: it.legacyKey } : {}),
            ...(it.isUserOptional ? { isUserOptional: true } : {}),
          })),
        })),
      };
    }

    const simple = extractSimpleFeeValues(struct);
    const nonLegacyCustoms = (struct.customHeads || [])
      .filter((h) => h.enabled !== false && Number(h.amount || 0) > 0)
      .map((h) => ({
        name: h.name,
        amount: Number(h.amount || 0),
        section: (h.billingSection || "annual") as FeeSectionBucket,
        showInAdmission: h.showInAdmission !== false,
      }));

    const out: JsonSimpleClassPayload = {
      monthlyFee: simple.tuitionFee,
      registrationFee: simple.registrationFee,
      admissionFee: simple.admissionFee,
      examFee: simple.examinationFee,
      diaryKitFee: simple.diaryKitFee,
      developmentFee: simple.developmentCharge,
      annualCharges: simple.annualCharges,
      busFee: simple.busFee,
      includeMonthlyInAdmission: simple.includeMonthlyInAdmission,
    };
    if (nonLegacyCustoms.length > 0) {
      out.customHeads = nonLegacyCustoms;
    }
    return out;
  };

  if (targetClassId !== "ALL" && list.length === 1) {
    return JSON.stringify(buildOne(list[0]), null, 2);
  }

  const map: Record<string, any> = {};
  list.forEach((cls) => {
    map[cls.name] = buildOne(cls);
  });
  return JSON.stringify(map, null, 2);
};

const pickNumber = (obj: Record<string, any>, keys: string[]): number | undefined => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      const n = Number(obj[k]);
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        return Math.max(0, Math.round(n));
      }
    }
  }
  return undefined;
};

const pickBoolean = (obj: Record<string, any>, keys: string[]): boolean | undefined => {
  for (const k of keys) {
    if (typeof obj[k] === "boolean") return obj[k];
  }
  return undefined;
};

const findMatchingClass = (
  keyOrName: string,
  classes: SchoolClass[]
): SchoolClass | undefined => {
  const raw = String(keyOrName || "").trim();
  if (!raw) return undefined;
  const byId = classes.find((c) => c.id === raw);
  if (byId) return byId;

  const lower = raw.toLowerCase();
  const byExact = classes.find((c) => c.name.trim().toLowerCase() === lower);
  if (byExact) return byExact;

  const normKey = normalizeClassNameForChart(raw);
  if (normKey) {
    const byChart = classes.find(
      (c) => normalizeClassNameForChart(c.name) === normKey
    );
    if (byChart) return byChart;
  }
  return undefined;
};

const normalizeRawJsonGroups = (rawGroups: any[]): ClassFeeGroup[] => {
  return rawGroups
    .filter((g) => g && typeof g === "object")
    .map((g, gIdx) => {
      const grpId = String(g.id || makeFeeUid(`jgrp${gIdx}`));
      const rawSec = String(g.billingSection || g.section || "admission").toLowerCase();
      const billingSection: FeeSectionBucket = (
        ["admission", "monthly", "annual", "exam", "optional"].includes(rawSec)
          ? rawSec
          : "admission"
      ) as FeeSectionBucket;
      const showInAdmission =
        typeof g.showInAdmission === "boolean"
          ? g.showInAdmission
          : billingSection !== "monthly";

      const rawItems = Array.isArray(g.items)
        ? g.items
        : Array.isArray(g.subItems)
        ? g.subItems
        : Array.isArray(g.heads)
        ? g.heads
        : [];

      const items: ClassFeeHead[] =
        rawItems.length > 0
          ? rawItems
              .filter((it: any) => it && typeof it === "object")
              .map((it: any, iIdx: number) => {
                const itRawSec = String(
                  it.billingSection || it.section || billingSection
                ).toLowerCase();
                const itSec: FeeSectionBucket = (
                  ["admission", "monthly", "annual", "exam", "optional"].includes(itRawSec)
                    ? itRawSec
                    : billingSection
                ) as FeeSectionBucket;
                return {
                  id: String(it.id || makeFeeUid(`jit${iIdx}`)),
                  name: String(it.name || it.title || `Fee Item ${iIdx + 1}`),
                  amount: Math.max(0, Math.round(Number(it.amount ?? it.fee ?? 0) || 0)),
                  enabled: it.enabled !== false,
                  showInAdmission:
                    typeof it.showInAdmission === "boolean"
                      ? it.showInAdmission
                      : showInAdmission,
                  billingSection: itSec,
                  targetSection: String(it.targetSection || g.targetSection || "ALL"),
                  ...(it.legacyKey ? { legacyKey: it.legacyKey } : {}),
                  ...(it.isUserOptional ? { isUserOptional: true } : {}),
                };
              })
          : typeof g.amount === "number"
          ? [
              {
                id: makeFeeUid(`jit_${gIdx}`),
                name: String(g.title || g.name || `Fee Item ${gIdx + 1}`),
                amount: Math.max(0, Math.round(g.amount)),
                enabled: g.enabled !== false,
                showInAdmission,
                billingSection,
                targetSection: String(g.targetSection || "ALL"),
              },
            ]
          : [];

      return {
        id: grpId,
        title: String(g.title || g.name || `Fee Group ${gIdx + 1}`),
        billingSection,
        targetSection: String(g.targetSection || "ALL"),
        enabled: g.enabled !== false,
        showInAdmission,
        discountEnabled: Boolean(g.discountEnabled || Number(g.discountValue || 0) > 0),
        discountType: g.discountType === "percent" ? "percent" : "flat",
        discountValue: Math.max(0, Number(g.discountValue || 0)),
        discountLabel: String(g.discountLabel || ""),
        items,
      };
    });
};

const buildStructureFromJsonEntry = (
  entry: any,
  current?: ClassFeeStructure
): ClassFeeStructure => {
  // Case 1: Array of groups directly
  if (Array.isArray(entry)) {
    const groups = normalizeRawJsonGroups(entry);
    return syncStructureFromFeeGroups(groups, {
      ...(current || {}),
      chartVersion: LIFE_MAKER_CHART_VERSION,
    });
  }

  if (!entry || typeof entry !== "object") {
    return current || syncStructureFromFeeGroups([], undefined);
  }

  // Case 2: Explicit feeGroups / groups array
  const explicitGroups = Array.isArray(entry.feeGroups)
    ? entry.feeGroups
    : Array.isArray(entry.groups)
    ? entry.groups
    : null;

  if (explicitGroups) {
    const groups = normalizeRawJsonGroups(explicitGroups);
    return syncStructureFromFeeGroups(groups, {
      ...(current || {}),
      ...(entry.examOriginalFee !== undefined
        ? { examOriginalFee: Number(entry.examOriginalFee || 0) }
        : {}),
      ...(entry.examDiscountPct !== undefined
        ? { examDiscountPct: Number(entry.examDiscountPct || 0) }
        : {}),
      chartVersion: LIFE_MAKER_CHART_VERSION,
    });
  }

  // Case 3: Simple JSON keys + optional customHeads
  const patch: Partial<SimpleFeeValues> = {};
  const tuition = pickNumber(entry, ["monthlyFee", "tuitionFee", "tuition", "monthly"]);
  const registration = pickNumber(entry, ["registrationFee", "registration", "regFee"]);
  const admission = pickNumber(entry, ["admissionFee", "admission"]);
  const exam = pickNumber(entry, ["examFee", "examinationFee", "exam"]);
  const diaryKit = pickNumber(entry, ["diaryKitFee", "diaryKitTotal", "kitFee", "diaryKit"]);
  const development = pickNumber(entry, [
    "developmentFee",
    "developmentCharge",
    "development",
  ]);
  const annual = pickNumber(entry, ["annualCharges", "annualFee", "annual"]);
  const bus = pickNumber(entry, ["busFee", "transportFee", "transport"]);
  const includeMonthly = pickBoolean(entry, [
    "includeMonthlyInAdmission",
    "showMonthlyInAdmission",
  ]);
  const examOriginalFee = pickNumber(entry, ["examOriginalFee", "examFeeOriginal"]);
  const examDiscountPct = pickNumber(entry, ["examDiscountPct", "examDiscountPercent"]);

  if (tuition !== undefined) patch.tuitionFee = tuition;
  if (registration !== undefined) patch.registrationFee = registration;
  if (admission !== undefined) patch.admissionFee = admission;
  if (exam !== undefined) patch.examinationFee = exam;
  if (diaryKit !== undefined) patch.diaryKitFee = diaryKit;
  if (development !== undefined) patch.developmentCharge = development;
  if (annual !== undefined) patch.annualCharges = annual;
  if (bus !== undefined) patch.busFee = bus;
  if (includeMonthly !== undefined) patch.includeMonthlyInAdmission = includeMonthly;
  if (examOriginalFee !== undefined) patch.examOriginalFee = examOriginalFee;
  if (examDiscountPct !== undefined) patch.examDiscountPct = examDiscountPct;

  // Handle granular diary / idCard / tieBelt if passed without diaryKitFee
  let nextStruct = applySimpleFeePatchToStructure(current, patch);

  const indDiary = pickNumber(entry, ["diaryCharge", "diaryFee"]);
  const indIdCard = pickNumber(entry, ["idCardCharge", "idCardFee"]);
  const indTieBelt = pickNumber(entry, ["tieBeltCharge", "tieBeltFee"]);
  const indFolder = pickNumber(entry, ["progressFolderCharge", "progressCardFee", "folderCharge"]);
  if (
    diaryKit === undefined &&
    (indDiary !== undefined ||
      indIdCard !== undefined ||
      indTieBelt !== undefined ||
      indFolder !== undefined)
  ) {
    let groups = nextStruct.feeGroups || [];
    if (indDiary !== undefined) {
      groups = upsertLegacyItemInGroups(groups, {
        legacyKey: "diaryCharge",
        itemName: "School Diary Charge",
        groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
        billingSection: "admission",
        amount: indDiary,
        showInAdmission: true,
      });
    }
    if (indIdCard !== undefined) {
      groups = upsertLegacyItemInGroups(groups, {
        legacyKey: "idCardCharge",
        itemName: "ID Card Charge",
        groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
        billingSection: "admission",
        amount: indIdCard,
        showInAdmission: true,
      });
    }
    if (indTieBelt !== undefined) {
      groups = upsertLegacyItemInGroups(groups, {
        legacyKey: "tieBeltCharge",
        itemName: "Tie & Belt Charge",
        groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
        billingSection: "admission",
        amount: indTieBelt,
        showInAdmission: true,
      });
    }
    if (indFolder !== undefined) {
      groups = upsertLegacyItemInGroups(groups, {
        legacyKey: "progressFolderCharge",
        itemName: "Report Card, Badge & Folder",
        groupTitle: "Caution, Kit & Misc (धरोहर एवं किट)",
        billingSection: "admission",
        amount: indFolder,
        showInAdmission: true,
      });
    }
    nextStruct = syncStructureFromFeeGroups(groups, nextStruct);
  }

  // Handle customHeads / heads if provided
  const rawCustomHeads = Array.isArray(entry.customHeads)
    ? entry.customHeads
    : Array.isArray(entry.extraHeads)
    ? entry.extraHeads
    : Array.isArray(entry.heads)
    ? entry.heads
    : null;

  if (rawCustomHeads) {
    // Replace non-legacy custom items with the exact customHeads from JSON
    const keptGroups = (nextStruct.feeGroups || [])
      .map((g) => ({
        ...g,
        items: (g.items || []).filter((it) => Boolean(it.legacyKey)),
      }))
      .filter((g) => g.items.length > 0);

    if (rawCustomHeads.length > 0) {
      const customItems: ClassFeeHead[] = rawCustomHeads
        .filter((h: any) => h && typeof h === "object" && (h.name || h.title))
        .map((h: any, idx: number) => {
          const rawSec = String(h.section || h.billingSection || "annual").toLowerCase();
          const sec: FeeSectionBucket = (
            ["admission", "monthly", "annual", "exam", "optional"].includes(rawSec)
              ? rawSec
              : "annual"
          ) as FeeSectionBucket;
          return {
            id: String(h.id || makeFeeUid(`jch${idx}`)),
            name: String(h.name || h.title),
            amount: Math.max(0, Math.round(Number(h.amount || 0) || 0)),
            enabled: h.enabled !== false,
            showInAdmission: h.showInAdmission !== false,
            billingSection: sec,
            targetSection: String(h.targetSection || "ALL"),
          };
        });

      if (customItems.length > 0) {
        keptGroups.push({
          id: makeFeeUid("grp_json_custom"),
          title: "Custom Fee Heads (JSON)",
          billingSection: customItems[0].billingSection || "annual",
          targetSection: "ALL",
          enabled: true,
          showInAdmission: true,
          items: customItems,
        });
      }
    }

    nextStruct = syncStructureFromFeeGroups(keptGroups, nextStruct);
  }

  return nextStruct;
};

export type FeeJsonParseResult =
  | {
      ok: true;
      updates: Record<string, ClassFeeStructure>;
      matchedClasses: { id: string; name: string; monthly: number; admissionTotal: number; activeTotal: number }[];
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export const parseFeeJsonInput = (
  rawText: string,
  classes: SchoolClass[],
  currentForms: Record<string, ClassFeeStructure>,
  targetClassId = "ALL"
): FeeJsonParseResult => {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) {
    return { ok: false, error: "JSON box khaali hai. Pehle JSON paste karein ya 'Load Current Fees' dabayein." };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    return {
      ok: false,
      error: `Invalid JSON Syntax: ${err?.message || "JSON format check karein"}`,
    };
  }

  const updates: Record<string, ClassFeeStructure> = {};
  const matchedClasses: {
    id: string;
    name: string;
    monthly: number;
    admissionTotal: number;
    activeTotal: number;
  }[] = [];
  const warnings: string[] = [];

  const recordMatch = (cls: SchoolClass, entry: any) => {
    const nextStruct = buildStructureFromJsonEntry(entry, currentForms[cls.id]);
    const totals = calculateFeeGroupsTotals(nextStruct.feeGroups || []);
    updates[cls.id] = nextStruct;
    matchedClasses.push({
      id: cls.id,
      name: cls.name,
      monthly: getMonthlyFeeFromStructure(nextStruct, nextStruct.tuitionFee || 0),
      admissionTotal: totals.admissionTotal,
      activeTotal: totals.withoutOptional,
    });
  };

  // Single-class target mode
  if (targetClassId !== "ALL") {
    const cls = classes.find((c) => c.id === targetClassId);
    if (!cls) {
      return { ok: false, error: "Selected class nahi mili." };
    }
    // Check if user pasted a { "Nursery": { ... } } wrapper even in single-class mode
    if (
      parsed &&
      !Array.isArray(parsed) &&
      typeof parsed === "object" &&
      !parsed.feeGroups &&
      !parsed.groups &&
      parsed.monthlyFee === undefined &&
      parsed.tuitionFee === undefined &&
      parsed.admissionFee === undefined &&
      parsed.registrationFee === undefined &&
      parsed.examFee === undefined &&
      parsed.developmentFee === undefined
    ) {
      const keys = Object.keys(parsed);
      const matchingKey = keys.find((k) => findMatchingClass(k, [cls]));
      if (matchingKey) {
        recordMatch(cls, parsed[matchingKey]);
        return { ok: true, updates, matchedClasses, warnings };
      }
    }
    recordMatch(cls, parsed);
    return { ok: true, updates, matchedClasses, warnings };
  }

  // Multi-class mode ("ALL")
  const unwrapped =
    parsed && !Array.isArray(parsed) && typeof parsed === "object"
      ? Array.isArray(parsed.classes)
        ? parsed.classes
        : parsed.feeStructure && typeof parsed.feeStructure === "object"
        ? parsed.feeStructure
        : parsed
      : parsed;

  if (Array.isArray(unwrapped)) {
    unwrapped.forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      const clsKey = String(
        item.classId || item.className || item.class || item.name || ""
      ).trim();
      const cls = findMatchingClass(clsKey, classes);
      if (!cls) {
        warnings.push(`Row #${idx + 1} ("${clsKey || "unnamed"}") kisi class se match nahi hui.`);
        return;
      }
      recordMatch(cls, item);
    });
  } else if (unwrapped && typeof unwrapped === "object") {
    // Check if user pasted a single flat object meant to apply or single class
    const topKeys = Object.keys(unwrapped);
    const looksLikeSingleFeeObj = topKeys.some((k) =>
      [
        "feeGroups",
        "groups",
        "monthlyFee",
        "tuitionFee",
        "admissionFee",
        "registrationFee",
        "examFee",
        "diaryKitFee",
        "developmentFee",
      ].includes(k)
    );

    if (looksLikeSingleFeeObj) {
      return {
        ok: false,
        error:
          "Aapne ek single class ka JSON dala hai. Kripya upar se kisi ek class ko chunein ya { \"Nursery\": { ... }, \"L.K.G.\": { ... } } format me dalein.",
      };
    }

    topKeys.forEach((key) => {
      const cls = findMatchingClass(key, classes);
      if (!cls) {
        warnings.push(`Class "${key}" school ki classes list me nahi mili.`);
        return;
      }
      recordMatch(cls, unwrapped[key]);
    });
  } else {
    return {
      ok: false,
      error: "JSON ek valid Object { \"Nursery\": {...} } ya Array [...] hona chahiye.",
    };
  }

  if (matchedClasses.length === 0) {
    return {
      ok: false,
      error:
        "JSON se koi bhi valid class match nahi hui. Class names jaise \"Nursery\", \"L.K.G.\", \"Class I\" check karein.",
    };
  }

  return { ok: true, updates, matchedClasses, warnings };
};
