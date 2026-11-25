import type {
  FamilySlipMemberSummary,
  MonthlyFee,
  SchoolStudent,
} from "../school-types";
import {
  calculateFifoAllocation,
  type FifoMonthAllocation,
  type FifoPaymentResult,
  type MonthDueItem,
} from "./feeFifoAllocation";
import { groupAllSchoolSiblings } from "./schoolReferralSiblingEngine";

export function addMonthsYm(ym: string, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthShort(ym?: string | null): string {
  if (!ym) return "";
  if (ym === "0000-BACK-DUE") return "Back Due";
  if (ym === "0001-ADM-DUE") return "Adm Due";
  if (ym === "0002-DEFERRED-TUITION") return "1st Mo Tuition";
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function formatMonthNameFull(ym?: string | null): string {
  if (!ym) return "";
  if (!/^\d{4}-\d{2}$/.test(ym)) return formatMonthShort(ym);
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function formatMonthNameOnly(ym?: string | null): string {
  if (!ym) return "";
  if (!/^\d{4}-\d{2}$/.test(ym)) return formatMonthShort(ym);
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString("en-IN", { month: "long" });
}

export function formatCompactDayMonth(dateInput?: string | null): string {
  if (!dateInput) return "";
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? new Date(`${dateInput}T00:00:00`)
      : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return dateInput;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateInput;
  }
}

export function formatCoveredMonthsList(months?: string[] | null): string {
  if (!Array.isArray(months) || months.length === 0) return "";
  const sorted = Array.from(new Set(months.filter((m) => /^\d{4}-\d{2}$/.test(m)))).sort();
  if (sorted.length === 0) return "";
  if (sorted.length <= 3) {
    return sorted.map((m) => formatMonthNameOnly(m)).join(", ");
  }
  return `${formatMonthNameOnly(sorted[0])} – ${formatMonthNameOnly(sorted[sorted.length - 1])} (${sorted.length}M)`;
}

export interface AdvanceMonthAllocation {
  month: string;
  dueBefore: number;
  paidNow: number;
  balanceAfter: number;
  status: "PAID" | "PARTIAL";
}

export interface SingleAdvancePlanResult {
  fifoResult: FifoPaymentResult;
  advanceMonths: AdvanceMonthAllocation[];
  advanceCoveredMonths: string[];
  nextFeeSlipMonth: string;
  advancePaidAt: string;
  lastBakayaAmount: number;
  receiptItems: {
    id: string;
    slNo: number;
    description: string;
    due: number;
    con: number;
    paid: number;
  }[];
}

export function computePermanentSiblingDiscount(
  student: Partial<SchoolStudent> | null | undefined,
  baseTuition: number
): number {
  if (!student) return 0;
  if (student.isFreeEducation) return Math.max(0, baseTuition);
  const pct = Number(student.siblingDiscountPct || 0);
  const pctAmt = pct > 0 ? Math.round((baseTuition * pct) / 100) : 0;
  const fixedAmt = Number(student.siblingDiscountAmount || 0);
  return Math.min(Math.max(0, baseTuition), Math.max(fixedAmt, pctAmt));
}

export function computeSingleStudentAdvancePlan(params: {
  studentId?: string;
  unpaidMonths: MonthDueItem[];
  paymentAmount: number;
  upcomingMonthRate: number;
  currentMonth: string;
  paidAtIso: string;
  initialArrears?: number;
  feeHistory?: MonthlyFee[];
  maxFutureMonths?: number;
}): SingleAdvancePlanResult {
  const {
    studentId,
    unpaidMonths,
    paymentAmount,
    upcomingMonthRate,
    currentMonth,
    paidAtIso,
    initialArrears,
    feeHistory = [],
    maxFutureMonths = 18,
  } = params;

  const fifoResult = calculateFifoAllocation({
    unpaidMonths,
    paymentAmount,
    upcomingMonthRate,
  });

  const priorMonthsSum = unpaidMonths
    .filter((u) => u.month !== currentMonth)
    .reduce((sum, u) => sum + Math.max(0, Number(u.totalDue || 0)), 0);
  const lastBakayaAmount = Math.max(priorMonthsSum, Math.max(0, Number(initialArrears || 0)));

  let extra = Math.max(0, Number(fifoResult.unallocatedSurplus || 0));
  const advanceMonths: AdvanceMonthAllocation[] = [];
  const advanceCoveredMonths: string[] = [];

  const stuHistMap = new Map<string, MonthlyFee>();
  if (studentId) {
    for (const h of feeHistory) {
      if (h?.studentId === studentId && h.month) stuHistMap.set(h.month, h);
    }
  }

  if (extra > 0 && upcomingMonthRate > 0 && /^\d{4}-\d{2}$/.test(currentMonth)) {
    for (let step = 1; step <= maxFutureMonths && extra > 0; step++) {
      const fm = addMonthsYm(currentMonth, step);
      const existing = stuHistMap.get(fm);
      if (existing && existing.paid && (!existing.balanceDue || existing.balanceDue <= 0)) {
        continue;
      }
      const alreadyPaidBefore = Number(existing?.paidAmount || 0);
      const effectiveDue =
        existing?.balanceDue !== undefined
          ? Math.max(0, Number(existing.balanceDue))
          : Math.max(0, upcomingMonthRate - alreadyPaidBefore);
      if (effectiveDue <= 0) continue;

      const applied = Math.min(extra, effectiveDue);
      const balAfter = Math.max(0, effectiveDue - applied);
      const isFullPaid = balAfter === 0;
      extra -= applied;

      advanceMonths.push({
        month: fm,
        dueBefore: effectiveDue,
        paidNow: applied,
        balanceAfter: balAfter,
        status: isFullPaid ? "PAID" : "PARTIAL",
      });
      if (isFullPaid) {
        advanceCoveredMonths.push(fm);
      }
    }
  }

  let nextFeeSlipMonth = addMonthsYm(currentMonth, 1);
  if (fifoResult.totalOutstandingDueAfter === 0) {
    const partialFuture = advanceMonths.find((a) => a.balanceAfter > 0);
    if (partialFuture) {
      nextFeeSlipMonth = partialFuture.month;
    } else if (advanceCoveredMonths.length > 0) {
      nextFeeSlipMonth = addMonthsYm(advanceCoveredMonths[advanceCoveredMonths.length - 1], 1);
    }
    if (/^\d{4}-\d{2}$/.test(nextFeeSlipMonth) && stuHistMap.size > 0) {
      let guard = 0;
      while (guard < 12) {
        const h = stuHistMap.get(nextFeeSlipMonth);
        if (advanceCoveredMonths.includes(nextFeeSlipMonth) || (h && h.paid && (!h.balanceDue || h.balanceDue <= 0))) {
          nextFeeSlipMonth = addMonthsYm(nextFeeSlipMonth, 1);
          guard++;
        } else {
          break;
        }
      }
    }
  }

  const receiptItems = [...fifoResult.receiptItems];
  let sl = receiptItems.length + 1;
  for (const adv of advanceMonths) {
    receiptItems.push({
      id: `adv_${adv.month}`,
      slNo: sl++,
      description: `${formatMonthShort(adv.month)} (Advance Paid)`,
      due: adv.dueBefore,
      con: 0,
      paid: adv.paidNow,
    });
  }

  return {
    fifoResult,
    advanceMonths,
    advanceCoveredMonths,
    nextFeeSlipMonth,
    advancePaidAt: formatCompactDayMonth(paidAtIso),
    lastBakayaAmount,
    receiptItems,
  };
}

export interface FamilySiblingInput {
  student: SchoolStudent;
  className: string;
  unpaidMonths: MonthDueItem[];
  upcomingMonthRate: number;
  concessionThisCycle: number;
}

export interface FamilyChildSettlementResult {
  studentId: string;
  studentName: string;
  student: SchoolStudent;
  className: string;
  allocations: FifoMonthAllocation[];
  advanceMonthAllocations: AdvanceMonthAllocation[];
  advanceMonths: string[];
  nextSlipMonth: string;
  totalDueBefore: number;
  totalPaidNow: number;
  remainingBalanceAfter: number;
  lastBakayaAmount: number;
  summaryItem: FamilySlipMemberSummary;
}

export interface FamilySettlementResult {
  perSiblingResults: FamilyChildSettlementResult[];
  familyMembersSummary: FamilySlipMemberSummary[];
  totalFamilyDueBefore: number;
  totalFamilyRemainingAfter: number;
  totalPaidNow: number;
  lastBakayaAmount: number;
  advanceCoveredMonths: string[];
  advancePaidAt: string;
  nextFeeSlipMonth: string;
  receiptItems: {
    id: string;
    slNo: number;
    description: string;
    due: number;
    con: number;
    paid: number;
  }[];
  summaryHindi: string;
}

/**
 * Multi-Sibling Family Horizontal Settlement Engine:
 * 1) Clears each selected child's overdue + current dues in chosen order (FIFO).
 *    If payment < total due -> earlier children/months become FULL PAID,
 *    and remaining shortfall is marked explicitly as "आंशिक बकाया" (carries forward to next month).
 * 2) If extra payment remains after clearing all selected children's current & overdue dues,
 *    distributes extra money MONTH-BY-MONTH HORIZONTALLY across selected siblings,
 *    suppressing demand slips for 100%-paid future months and reporting "Next Slip in <Month>".
 */
export function calculateFamilyHorizontalSettlement(params: {
  siblings: FamilySiblingInput[];
  paymentAmount: number;
  currentMonth: string;
  paidAtIso: string;
  familyReceiptNo?: string;
  feeHistory?: MonthlyFee[];
  maxFutureMonths?: number;
}): FamilySettlementResult {
  const {
    siblings,
    paymentAmount,
    currentMonth,
    paidAtIso,
    familyReceiptNo = "",
    feeHistory = [],
    maxFutureMonths = 18,
  } = params;

  let remainingMoney = Math.max(0, Number(paymentAmount) || 0);
  const advancePaidAt = formatCompactDayMonth(paidAtIso);

  const childWork = siblings.map((sib) => {
    const fifo = calculateFifoAllocation({
      unpaidMonths: sib.unpaidMonths,
      paymentAmount: remainingMoney,
      upcomingMonthRate: sib.upcomingMonthRate,
    });
    remainingMoney = Math.max(0, remainingMoney - fifo.totalAllocated);

    const lastBakaya = sib.unpaidMonths
      .filter((u) => u.month !== currentMonth)
      .reduce((sum, u) => sum + Math.max(0, Number(u.totalDue || 0)), 0);

    return {
      input: sib,
      fifo,
      lastBakaya,
      advanceMonthAllocations: [] as AdvanceMonthAllocation[],
      advanceMonths: [] as string[],
    };
  });

  if (remainingMoney > 0 && /^\d{4}-\d{2}$/.test(currentMonth)) {
    const anyRatePositive = childWork.some((cw) => Number(cw.input.upcomingMonthRate || 0) > 0);
    if (anyRatePositive) {
      for (let step = 1; step <= maxFutureMonths && remainingMoney > 0; step++) {
        const fm = addMonthsYm(currentMonth, step);
        for (const cw of childWork) {
          if (remainingMoney <= 0) break;
          const rate = Math.max(0, Number(cw.input.upcomingMonthRate || 0));
          if (rate <= 0) continue;

          const existing = feeHistory.find(
            (h) => h.studentId === cw.input.student.id && h.month === fm
          );
          if (existing && existing.paid && (!existing.balanceDue || existing.balanceDue <= 0)) {
            continue;
          }
          const alreadyPaidBefore = Number(existing?.paidAmount || 0);
          const effectiveDue =
            existing?.balanceDue !== undefined
              ? Math.max(0, Number(existing.balanceDue))
              : Math.max(0, rate - alreadyPaidBefore);
          if (effectiveDue <= 0) continue;

          const applied = Math.min(remainingMoney, effectiveDue);
          const balAfter = Math.max(0, effectiveDue - applied);
          const isFullPaid = balAfter === 0;
          remainingMoney -= applied;

          cw.advanceMonthAllocations.push({
            month: fm,
            dueBefore: effectiveDue,
            paidNow: applied,
            balanceAfter: balAfter,
            status: isFullPaid ? "PAID" : "PARTIAL",
          });
          if (isFullPaid) {
            cw.advanceMonths.push(fm);
          }
        }
      }
    }
  }

  const receiptItems: FamilySettlementResult["receiptItems"] = [];
  let slNo = 1;

  const perSiblingResults: FamilyChildSettlementResult[] = childWork.map((cw) => {
    const sib = cw.input;
    const paidCurrentAndArrears = cw.fifo.totalAllocated;
    const paidAdvance = cw.advanceMonthAllocations.reduce((s, a) => s + a.paidNow, 0);
    const totalPaidNow = paidCurrentAndArrears + paidAdvance;
    const remainingBalanceAfter = cw.fifo.totalOutstandingDueAfter;
    const totalDueBefore = cw.fifo.totalDueBefore;

    let nextSlipMonth = addMonthsYm(currentMonth, 1);
    if (remainingBalanceAfter === 0) {
      const partialAdv = cw.advanceMonthAllocations.find((a) => a.balanceAfter > 0);
      if (partialAdv) {
        nextSlipMonth = partialAdv.month;
      } else if (cw.advanceMonths.length > 0) {
        nextSlipMonth = addMonthsYm(cw.advanceMonths[cw.advanceMonths.length - 1], 1);
      }
    }

    let status: FamilySlipMemberSummary["status"] = "UNPAID";
    let statusLabel = `बकाया ₹${remainingBalanceAfter.toLocaleString("en-IN")}`;
    if (cw.advanceMonths.length > 0 && remainingBalanceAfter === 0) {
      status = "FULL_PAID";
      statusLabel = `Adv (${formatCoveredMonthsList(cw.advanceMonths)})`;
    } else if (remainingBalanceAfter === 0 && totalDueBefore >= 0) {
      status = "FULL_PAID";
      statusLabel = totalPaidNow > 0 || sib.student.isFreeEducation ? "✓ Full Paid" : "✓ Clear";
    } else if (totalPaidNow > 0 && remainingBalanceAfter > 0) {
      status = "PARTIAL";
      statusLabel = `आंशिक बकाया ₹${remainingBalanceAfter.toLocaleString("en-IN")}`;
    }

    const grossThisChild = totalDueBefore + Math.max(0, Number(sib.concessionThisCycle || 0));

    const summaryItem: FamilySlipMemberSummary = {
      studentId: sib.student.id,
      studentName: sib.student.name,
      className: sib.className,
      rollNo: sib.student.rollNo,
      admissionNo: sib.student.admissionNo,
      monthlyRate: sib.upcomingMonthRate,
      grossDue: grossThisChild,
      concession: Number(sib.concessionThisCycle || 0),
      alreadyPaid: cw.fifo.allocations.reduce((s, a) => s + Number(a.alreadyPaidBefore || 0), 0),
      dueBefore: totalDueBefore,
      netDueBefore: totalDueBefore,
      paidNow: totalPaidNow,
      paidThisTime: totalPaidNow,
      balanceAfter: remainingBalanceAfter,
      status,
      statusLabel,
      advanceMonths: cw.advanceMonths,
      advanceCoveredMonths: cw.advanceMonths,
      advancePaidAt: paidAdvance > 0 ? advancePaidAt : undefined,
      nextSlipMonth,
      nextFeeSlipMonth: nextSlipMonth,
    };

    const advNote = cw.advanceMonths.length > 0 ? ` + Adv (${formatCoveredMonthsList(cw.advanceMonths)})` : "";
    const partialNote =
      status === "PARTIAL" ? ` • आंशिक बकाया ₹${remainingBalanceAfter.toLocaleString("en-IN")}` : "";

    receiptItems.push({
      id: `fam_stu_${sib.student.id}`,
      slNo: slNo++,
      description: `${sib.student.name} (${sib.className})${advNote}${partialNote}`,
      due: grossThisChild + paidAdvance,
      con: Number(sib.concessionThisCycle || 0),
      paid: totalPaidNow,
    });

    return {
      studentId: sib.student.id,
      studentName: sib.student.name,
      student: sib.student,
      className: sib.className,
      allocations: cw.fifo.allocations,
      advanceMonthAllocations: cw.advanceMonthAllocations,
      advanceMonths: cw.advanceMonths,
      nextSlipMonth,
      totalDueBefore,
      totalPaidNow,
      remainingBalanceAfter,
      lastBakayaAmount: cw.lastBakaya,
      summaryItem,
    };
  });

  const allAdvanceMonthsSet = new Set<string>();
  perSiblingResults.forEach((m) => m.advanceMonths.forEach((mo) => allAdvanceMonthsSet.add(mo)));
  const advanceCoveredMonths = Array.from(allAdvanceMonthsSet).sort();

  const totalFamilyDueBefore = perSiblingResults.reduce((s, m) => s + m.totalDueBefore, 0);
  const totalPaidNow = perSiblingResults.reduce((s, m) => s + m.totalPaidNow, 0);
  const totalFamilyRemainingAfter = perSiblingResults.reduce((s, m) => s + m.remainingBalanceAfter, 0);
  const lastBakayaAmount = perSiblingResults.reduce((s, m) => s + m.lastBakayaAmount, 0);

  let nextFeeSlipMonth = addMonthsYm(currentMonth, 1);
  if (totalFamilyRemainingAfter === 0) {
    const earliestNext = perSiblingResults
      .map((m) => m.nextSlipMonth)
      .filter((x) => /^\d{4}-\d{2}$/.test(x))
      .sort()[0];
    if (earliestNext) nextFeeSlipMonth = earliestNext;
  }

  const paidCount = perSiblingResults.filter((m) => m.summaryItem.status === "FULL_PAID").length;
  const partialCount = perSiblingResults.filter((m) => m.summaryItem.status === "PARTIAL").length;

  let summaryHindi = `${paidCount}/${perSiblingResults.length} बच्चे Full Paid`;
  if (partialCount > 0 && totalFamilyRemainingAfter > 0) {
    summaryHindi += ` • आंशिक बकाया ₹${totalFamilyRemainingAfter.toLocaleString("en-IN")} (अगले माह जुड़ेगा)`;
  }
  if (advanceCoveredMonths.length > 0) {
    summaryHindi += ` • ${formatCoveredMonthsList(advanceCoveredMonths)} Paid at ${advancePaidAt} · Next Slip: ${formatMonthNameOnly(nextFeeSlipMonth)}`;
  }
  if (familyReceiptNo) {
    summaryHindi += ` (${familyReceiptNo})`;
  }

  return {
    perSiblingResults,
    familyMembersSummary: perSiblingResults.map((m) => m.summaryItem),
    totalFamilyDueBefore,
    totalFamilyRemainingAfter,
    totalPaidNow,
    lastBakayaAmount,
    advanceCoveredMonths,
    advancePaidAt,
    nextFeeSlipMonth,
    receiptItems,
    summaryHindi,
  };
}

/**
 * Resolves advance coverage & next slip metadata for a student fee record
 * using historical/future records so cards & slips show accurate mini-statement.
 */
export function resolveAdvanceMetadataForFee(params: {
  studentId: string;
  currentMonth: string;
  currentFee?: Partial<MonthlyFee> | null;
  feeHistory: MonthlyFee[];
}): {
  advanceCoveredMonths: string[];
  advancePaidAt: string;
  nextFeeSlipMonth: string;
  lastBakayaAmount: number;
} {
  const { studentId, currentMonth, currentFee, feeHistory } = params;

  const explicitAdvance = Array.isArray(currentFee?.advanceCoveredMonths)
    ? currentFee!.advanceCoveredMonths!.filter((m) => /^\d{4}-\d{2}$/.test(m))
    : [];
  const stuFuturePaid = feeHistory
    .filter(
      (f) =>
        f?.studentId === studentId &&
        f.month &&
        /^\d{4}-\d{2}$/.test(f.month) &&
        f.month > currentMonth &&
        f.paid &&
        (!f.balanceDue || f.balanceDue <= 0)
    )
    .map((f) => f.month);

  const advanceCoveredMonths = Array.from(new Set([...explicitAdvance, ...stuFuturePaid])).sort();

  const futurePaidRec = feeHistory.find(
    (f) =>
      f?.studentId === studentId &&
      f.month &&
      advanceCoveredMonths.includes(f.month) &&
      (f.advancePaidAt || f.paidDate)
  );
  const advancePaidAt =
    currentFee?.advancePaidAt ||
    futurePaidRec?.advancePaidAt ||
    (futurePaidRec?.paidDate ? formatCompactDayMonth(futurePaidRec.paidDate) : "") ||
    (currentFee?.paidDate && advanceCoveredMonths.length > 0
      ? formatCompactDayMonth(currentFee.paidDate)
      : "");

  let nextFeeSlipMonth = currentFee?.nextFeeSlipMonth || "";
  if (!nextFeeSlipMonth && /^\d{4}-\d{2}$/.test(currentMonth)) {
    const isCurrentSettled = Boolean(currentFee?.paid && (!currentFee.balanceDue || currentFee.balanceDue <= 0));
    if (isCurrentSettled) {
      let candidate = addMonthsYm(currentMonth, 1);
      let guard = 0;
      while (guard < 12 && advanceCoveredMonths.includes(candidate)) {
        candidate = addMonthsYm(candidate, 1);
        guard++;
      }
      nextFeeSlipMonth = candidate;
    } else {
      nextFeeSlipMonth = addMonthsYm(currentMonth, 1);
    }
  }

  const lastBakayaAmount = Number(
    currentFee?.lastBakayaAmount !== undefined
      ? currentFee.lastBakayaAmount
      : currentFee?.lastDueAmount !== undefined
      ? currentFee.lastDueAmount
      : currentFee?.arrearsAmount || 0
  );

  return {
    advanceCoveredMonths,
    advancePaidAt,
    nextFeeSlipMonth,
    lastBakayaAmount,
  };
}

/**
 * Groups an array of MonthlyFee items by Sibling Family for Bulk Slip Printing / PDF Download.
 * Every family with 2+ children in the batch produces ONE combined Family DpsReceiptData slip.
 */
export function mergeBatchReceiptsByFamily<T extends {
  schoolName: string;
  schoolAddress: string;
  schoolId?: string;
  receiptNo: string;
  admissionNo: string;
  studentName: string;
  fatherName?: string;
  motherName?: string;
  studentId?: string;
  rollNo?: string;
  phone?: string;
  installment: string;
  receiptDate: string;
  session: string;
  className: string;
  counterNo: string;
  receiptTitle?: string;
  items: { id: string; slNo: number; description: string; due: number; con: number; paid: number }[];
  balanceDue?: number;
  lastPaidAmount?: number;
  lastPaidDate?: string;
  lastDueAmount?: number;
  lastDueDate?: string;
  lastBakayaAmount?: number;
  advanceCoveredMonths?: string[];
  advancePaidAt?: string;
  nextFeeSlipMonth?: string;
  familyGroupId?: string;
  familyReceiptNo?: string;
  familyMembersSummary?: FamilySlipMemberSummary[];
  payModeInfo: any;
  note?: string;
}>(params: {
  receiptFees: MonthlyFee[];
  allStudents: SchoolStudent[];
  buildReceipt: (fee: MonthlyFee) => T;
  mergeFamilies?: boolean;
}): T[] {
  const { receiptFees, allStudents, buildReceipt, mergeFamilies = true } = params;
  if (!receiptFees.length) return [];
  if (!mergeFamilies) {
    return receiptFees.map(buildReceipt);
  }

  const { families } = groupAllSchoolSiblings(allStudents);
  const studentToFamilyId = new Map<string, { id: string; fatherName?: string; familyName: string }>();
  families.forEach((fam) => {
    fam.students.forEach((st) => {
      studentToFamilyId.set(st.id, {
        id: fam.id,
        fatherName: fam.fatherName,
        familyName: fam.familyName,
      });
    });
  });

  const bucketMap = new Map<string, MonthlyFee[]>();
  const orderedKeys: string[] = [];

  for (const fee of receiptFees) {
    const famMeta = studentToFamilyId.get(fee.studentId);
    const famKey = fee.familyGroupId
      ? `fam_${fee.familyGroupId}`
      : famMeta
      ? `fam_${famMeta.id}`
      : `stu_${fee.studentId}`;

    if (!bucketMap.has(famKey)) {
      bucketMap.set(famKey, []);
      orderedKeys.push(famKey);
    }
    bucketMap.get(famKey)!.push(fee);
  }

  const mergedReceipts: T[] = [];

  for (const key of orderedKeys) {
    const groupFees = bucketMap.get(key) || [];
    if (groupFees.length === 1) {
      mergedReceipts.push(buildReceipt(groupFees[0]));
      continue;
    }

    const childReceipts = groupFees.map((f) => ({ fee: f, receipt: buildReceipt(f) }));
    const primary = childReceipts[0].receipt;
    const allDueDemand = childReceipts.every(
      (cr) =>
        cr.receipt.counterNo === "DUE-DEMAND" ||
        (!cr.fee.paid && Number(cr.fee.paidAmount || 0) === 0)
    );

    let sl = 1;
    const combinedItems: T["items"] = [];
    const familyMembersSummary: FamilySlipMemberSummary[] = [];

    let totalBalanceDue = 0;
    let totalLastPaid = 0;
    let totalLastDue = 0;
    let totalLastBakaya = 0;
    let latestPaidDate = primary.lastPaidDate || "";
    let latestDueDate = primary.lastDueDate || "";
    const advMonthsSet = new Set<string>();
    let advPaidAt = "";
    const nextSlipSet = new Set<string>();

    childReceipts.forEach(({ fee, receipt }) => {
      const childTotalDue = receipt.items.reduce((s, it) => s + Number(it.due || 0), 0);
      const childTotalCon = receipt.items.reduce((s, it) => s + Number(it.con || 0), 0);
      const childNetDue = Math.max(0, childTotalDue - childTotalCon);
      const childPaid = receipt.items.reduce((s, it) => s + Number(it.paid || 0), 0);
      const childBal =
        receipt.balanceDue !== undefined
          ? Number(receipt.balanceDue)
          : Math.max(0, childNetDue - childPaid);

      totalBalanceDue += childBal;
      totalLastPaid += Number(receipt.lastPaidAmount || 0);
      totalLastDue += Number(receipt.lastDueAmount || 0);
      totalLastBakaya += Number(receipt.lastBakayaAmount ?? receipt.lastDueAmount ?? fee.arrearsAmount ?? 0);
      if (!latestPaidDate && receipt.lastPaidDate) latestPaidDate = receipt.lastPaidDate;
      if (!latestDueDate && receipt.lastDueDate) latestDueDate = receipt.lastDueDate;
      if (!advPaidAt && receipt.advancePaidAt) advPaidAt = receipt.advancePaidAt;
      (receipt.advanceCoveredMonths || []).forEach((m) => advMonthsSet.add(m));
      if (receipt.nextFeeSlipMonth) nextSlipSet.add(receipt.nextFeeSlipMonth);

      const isChildPaid = fee.paid && childBal === 0;
      const isChildPartial = !isChildPaid && (childPaid > 0 || Number(fee.paidAmount || 0) > 0) && childBal > 0;
      let status: FamilySlipMemberSummary["status"] = "UNPAID";
      let statusLabel = `बकाया ₹${childBal.toLocaleString("en-IN")}`;
      if ((receipt.advanceCoveredMonths?.length || 0) > 0 && isChildPaid) {
        status = "FULL_PAID";
        statusLabel = `Adv (${formatCoveredMonthsList(receipt.advanceCoveredMonths)})`;
      } else if (isChildPaid) {
        status = "FULL_PAID";
        statusLabel = "✓ Full Paid";
      } else if (isChildPartial) {
        status = "PARTIAL";
        statusLabel = `आंशिक ₹${childBal.toLocaleString("en-IN")}`;
      }

      familyMembersSummary.push({
        studentId: fee.studentId,
        studentName: receipt.studentName,
        className: receipt.className,
        rollNo: receipt.rollNo,
        admissionNo: receipt.admissionNo,
        monthlyRate: Number(fee.monthlyAmount || 0),
        grossDue: childTotalDue,
        concession: childTotalCon,
        alreadyPaid: Number(fee.paidAmount || 0),
        dueBefore: childNetDue,
        netDueBefore: childNetDue,
        paidNow: childPaid,
        paidThisTime: childPaid,
        balanceAfter: childBal,
        status,
        statusLabel,
        advanceMonths: receipt.advanceCoveredMonths,
        advanceCoveredMonths: receipt.advanceCoveredMonths,
        advancePaidAt: receipt.advancePaidAt,
        nextSlipMonth: receipt.nextFeeSlipMonth,
        nextFeeSlipMonth: receipt.nextFeeSlipMonth,
      });

      const conciseHead = receipt.items
        .map((it) => it.description.replace(/\s*\([^)]*\)/g, "").trim())
        .slice(0, 2)
        .join(" + ");
      combinedItems.push({
        id: `fam_${fee.studentId}`,
        slNo: sl++,
        description: `${receipt.studentName} (${receipt.className})${conciseHead ? ` — ${conciseHead}` : ""}`,
        due: childTotalDue,
        con: childTotalCon,
        paid: childPaid,
      });
    });

    const advCovered = Array.from(advMonthsSet).sort();
    const sortedNextSlip = Array.from(nextSlipSet).sort()[0] || "";
    const uniqueClasses = Array.from(new Set(childReceipts.map((c) => c.receipt.className).filter(Boolean)));
    const combinedNames = childReceipts.map((c) => c.receipt.studentName).join(" + ");
    const combinedAdm = childReceipts.map((c) => c.receipt.admissionNo).filter(Boolean).join(", ");
    const combinedRolls = childReceipts.map((c) => c.receipt.rollNo).filter(Boolean).join(", ");

    mergedReceipts.push({
      ...primary,
      receiptTitle: allDueDemand
        ? `FAMILY FEE DEMAND SLIP (${childReceipts.length} Siblings) • परिवार बकाया पर्ची`
        : `FAMILY FEE RECEIPT (${childReceipts.length} Siblings) • संयुक्त रसीद`,
      studentName: `${combinedNames} (${childReceipts.length} Siblings)`,
      className: uniqueClasses.join(" / "),
      admissionNo: combinedAdm || primary.admissionNo,
      rollNo: combinedRolls || primary.rollNo,
      installment: `${primary.installment} • FAMILY`,
      items: combinedItems,
      balanceDue: totalBalanceDue,
      lastPaidAmount: totalLastPaid,
      lastPaidDate: latestPaidDate,
      lastDueAmount: totalLastDue,
      lastDueDate: latestDueDate,
      lastBakayaAmount: totalLastBakaya,
      advanceCoveredMonths: advCovered,
      advancePaidAt: advPaidAt || undefined,
      nextFeeSlipMonth: sortedNextSlip || undefined,
      familyGroupId: key.replace(/^fam_/, ""),
      familyMembersSummary,
    });
  }

  return mergedReceipts;
}
