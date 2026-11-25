import React, { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  Search,
  CheckCircle2,
  Sparkles,
  Award,
  UserPlus,
  UserMinus,
  GraduationCap,
  IndianRupee,
  Phone,
  CreditCard,
  MapPin,
  HeartHandshake,
  Check,
  Layers,
  ReceiptText,
  Printer,
  Calendar,
  X,
  Loader2,
} from "lucide-react";
import type { MonthlyFee, School, SchoolClass, SchoolSession, SchoolStudent } from "../../school-types";
import { groupAllSchoolSiblings, SiblingFamilyGroup } from "../../utils/schoolReferralSiblingEngine";
import {
  updateStudent,
  getMonthlyFees,
  getSchoolFeeHistory,
  getLocalFees,
  saveFee,
  markFeePaid,
  autoSettleFeeCallFollowUp,
  currentMonthStr,
} from "../../school-firebase";
import { OfficialFeeReceiptModal } from "./OfficialFeeReceiptModal";
import { formatMonthLabel, type MonthDueItem } from "../../utils/feeFifoAllocation";
import {
  calculateFamilyHorizontalSettlement,
  computePermanentSiblingDiscount,
  resolveAdvanceMetadataForFee,
  formatCoveredMonthsList,
  formatMonthNameOnly,
  formatCompactDayMonth,
  type FamilySiblingInput,
} from "../../utils/familyFeeEngine";
import { formatAcademicSession } from "./feeReceiptUtils";

interface Props {
  school: School;
  students: SchoolStudent[];
  classes: SchoolClass[];
  activeSession: SchoolSession | null;
  fees?: MonthlyFee[];
  feeHistory?: MonthlyFee[];
  onUpdateStudent?: (student: SchoolStudent) => void;
  onBack?: () => void;
}

export const SiblingProfileManager: React.FC<Props> = ({
  school,
  students,
  classes,
  activeSession,
  fees: propFees,
  feeHistory: propFeeHistory,
  onUpdateStudent,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"families" | "discounted" | "free" | "singles">("families");
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [saveSuccessStudentId, setSaveSuccessStudentId] = useState<string | null>(null);

  // Manual Link modal state
  const [linkTargetFamily, setLinkTargetFamily] = useState<SiblingFamilyGroup | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [confirmActionKey, setConfirmActionKey] = useState<string | null>(null);

  // Live Fee & Sibling Selection + Combined Slip / Payment State
  const [activeMonth, setActiveMonth] = useState<string>(() => currentMonthStr());
  const [liveFees, setLiveFees] = useState<MonthlyFee[]>(() => propFees || []);
  const [liveHistory, setLiveHistory] = useState<MonthlyFee[]>(() => propFeeHistory || []);
  const [selectedByFamily, setSelectedByFamily] = useState<Record<string, string[]>>({});
  const [orderByFamily, setOrderByFamily] = useState<Record<string, string[]>>({});

  // Combined Family Collection Modal & Receipt Preview State
  const [collectFamilyTarget, setCollectFamilyTarget] = useState<SiblingFamilyGroup | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<string>("");
  const [collectPayMode, setCollectPayMode] = useState<string>("Cash");
  const [collectPayDate, setCollectPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [savingFamilyFee, setSavingFamilyFee] = useState<boolean>(false);
  const [previewFamilyReceipt, setPreviewFamilyReceipt] = useState<{
    fee: MonthlyFee;
    student: SchoolStudent;
    initialFormat: "4in1" | "a6" | "pos";
  } | null>(null);

  const reloadFeeData = useCallback(async () => {
    if (!school?.id) return;
    try {
      const [mFees, hist] = await Promise.all([
        getMonthlyFees(school.id, activeMonth, undefined, activeSession?.id),
        getSchoolFeeHistory(school.id, activeSession?.id),
      ]);
      setLiveFees(Array.isArray(mFees) ? mFees : []);
      setLiveHistory(Array.isArray(hist) ? hist : []);
    } catch {
      const local = getLocalFees(school.id);
      setLiveFees(local.filter((f) => f.month === activeMonth));
      setLiveHistory(local);
    }
  }, [school?.id, activeMonth, activeSession?.id]);

  useEffect(() => {
    if (propFees && propFees.length > 0) setLiveFees(propFees);
    if (propFeeHistory && propFeeHistory.length > 0) setLiveHistory(propFeeHistory);
  }, [propFees, propFeeHistory]);

  useEffect(() => {
    void reloadFeeData();
  }, [reloadFeeData]);

  // Group all students automatically using the intelligent engine
  const { families, singleStudents, stats } = useMemo(() => {
    return groupAllSchoolSiblings(students);
  }, [students]);

  const feeByStudentId = useMemo(() => {
    const map = new Map<string, MonthlyFee>();
    for (const f of liveFees) {
      if (f?.studentId) map.set(f.studentId, f);
    }
    return map;
  }, [liveFees]);

  const classById = useMemo(() => {
    const map = new Map<string, SchoolClass>();
    for (const c of classes) {
      if (c?.id) map.set(c.id, c);
    }
    return map;
  }, [classes]);

  const getChildFeeSnapshot = useCallback(
    (st: SchoolStudent) => {
      const mf = feeByStudentId.get(st.id);
      const cls = classById.get(st.classId);
      const struct = cls?.feeStructure;
      const baseTuition = Number(mf?.monthlyAmount ?? st.baseMonthlyFee ?? st.monthlyFee ?? struct?.tuitionFee ?? cls?.defaultFee ?? 0);
      const permDisc = computePermanentSiblingDiscount(st, baseTuition);
      const busAmt = mf?.includeBusFee || st.usesBus ? Number(mf?.busFeeAmount || st.busFee || struct?.busFee || 0) : 0;
      const netRate = Math.max(0, baseTuition - permDisc + busAmt);

      const arrearsMonthsFromHist = liveHistory
        .filter((h) => h?.studentId === st.id && h.month && h.month < activeMonth && (!h.paid || Number(h.balanceDue || 0) > 0))
        .map((h) => h.month);
      const mSet = new Set<string>([...(mf?.arrearsMonths || []), ...arrearsMonthsFromHist]);
      if (Number(st.previousSessionDue || 0) > 0) mSet.add("0000-BACK-DUE");
      if (Number(st.admissionDueBalance || 0) > 0) mSet.add("0001-ADM-DUE");

      const currentDue = mf
        ? mf.paid && (!mf.balanceDue || mf.balanceDue <= 0)
          ? 0
          : Math.max(0, Number(mf.balanceDue ?? Math.max(0, Number(mf.amount || netRate) - Number(mf.arrearsAmount || 0))))
        : netRate;

      const sortedPrior = Array.from(mSet).filter((m) => m !== activeMonth).sort();
      const priorDueSum = sortedPrior.reduce((s, m) => {
        if (m === "0000-BACK-DUE") return s + Math.max(0, Number(st.previousSessionDue || 0));
        if (m === "0001-ADM-DUE") return s + Math.max(0, Number(st.admissionDueBalance || 0));
        const h = liveHistory.find((x) => x.studentId === st.id && x.month === m);
        if (h) return s + Math.max(0, Number(h.balanceDue !== undefined ? h.balanceDue : h.paid ? 0 : netRate));
        return s + netRate;
      }, 0);

      const totalDue = currentDue + Math.max(Number(mf?.arrearsAmount || 0), priorDueSum);
      const advMeta = resolveAdvanceMetadataForFee({
        studentId: st.id,
        currentMonth: activeMonth,
        currentFee: mf,
        feeHistory: liveHistory,
      });

      return {
        mf,
        baseTuition,
        permDisc,
        busAmt,
        netRate,
        currentDue,
        totalDue,
        isPaid: Boolean(mf?.paid && totalDue === 0),
        isPartial: Boolean(mf && !mf.paid && Number(mf.paidAmount || 0) > 0 && totalDue > 0),
        advMeta,
        sortedPrior,
      };
    },
    [feeByStudentId, classById, liveHistory, activeMonth]
  );

  const getOrderedSelectedForFamily = useCallback(
    (family: SiblingFamilyGroup) => {
      const defaultOrder = family.students.map((s) => s.id);
      const savedOrder = orderByFamily[family.id];
      const orderedIds =
        savedOrder && savedOrder.length > 0
          ? [
              ...savedOrder.filter((id) => defaultOrder.includes(id)),
              ...defaultOrder.filter((id) => !savedOrder.includes(id)),
            ]
          : defaultOrder;
      const savedSel = selectedByFamily[family.id];
      const selectedIds = savedSel ? orderedIds.filter((id) => savedSel.includes(id)) : orderedIds;
      return { orderedIds, selectedIds };
    },
    [orderByFamily, selectedByFamily]
  );

  const buildFamilySiblingInputs = useCallback(
    (family: SiblingFamilyGroup, targetIds: string[]): FamilySiblingInput[] => {
      return targetIds
        .map((sid) => family.students.find((s) => s.id === sid))
        .filter((s): s is SchoolStudent => Boolean(s))
        .map((st) => {
          const snap = getChildFeeSnapshot(st);
          const allM = Array.from(new Set([...snap.sortedPrior, activeMonth])).sort();
          const unpaidMonths: MonthDueItem[] = allM
            .map((m) => {
              if (m === activeMonth) {
                return {
                  month: m,
                  label: formatMonthLabel(m),
                  monthlyAmount: snap.baseTuition,
                  totalDue: snap.currentDue,
                  alreadyPaid: Number(snap.mf?.paidAmount || 0),
                  totalBill: snap.currentDue,
                };
              }
              if (m === "0000-BACK-DUE") {
                const v = Math.max(0, Number(st.previousSessionDue || 0));
                return { month: m, label: formatMonthLabel(m), monthlyAmount: v, totalDue: v, alreadyPaid: 0, totalBill: v };
              }
              if (m === "0001-ADM-DUE") {
                const v = Math.max(0, Number(st.admissionDueBalance || 0));
                return { month: m, label: formatMonthLabel(m), monthlyAmount: v, totalDue: v, alreadyPaid: 0, totalBill: v };
              }
              const h = liveHistory.find((x) => x.studentId === st.id && x.month === m);
              const dVal = h ? Math.max(0, Number(h.balanceDue !== undefined ? h.balanceDue : h.paid ? 0 : snap.netRate)) : snap.netRate;
              return {
                month: m,
                label: formatMonthLabel(m),
                monthlyAmount: snap.baseTuition,
                totalDue: dVal,
                alreadyPaid: Number(h?.paidAmount || 0),
                totalBill: dVal,
              };
            })
            .filter((u) => u.totalDue > 0 || (u.month === activeMonth && snap.currentDue > 0));

          return {
            student: st,
            className: classById.get(st.classId)?.name || st.className || "Class",
            unpaidMonths,
            upcomingMonthRate: snap.netRate,
            concessionThisCycle: Number(snap.mf?.concession ?? snap.permDisc),
          };
        });
    },
    [getChildFeeSnapshot, activeMonth, liveHistory, classById]
  );

  const collectFamilySettlementPreview = useMemo(() => {
    if (!collectFamilyTarget) return null;
    const { selectedIds } = getOrderedSelectedForFamily(collectFamilyTarget);
    const sibInputs = buildFamilySiblingInputs(collectFamilyTarget, selectedIds);
    if (sibInputs.length === 0) return null;
    const amt = Math.max(0, Number(collectAmountInput) || 0);
    return calculateFamilyHorizontalSettlement({
      siblings: sibInputs,
      paymentAmount: amt,
      currentMonth: activeMonth,
      paidAtIso: collectPayDate,
      feeHistory: liveHistory,
    });
  }, [collectFamilyTarget, getOrderedSelectedForFamily, buildFamilySiblingInputs, collectAmountInput, activeMonth, collectPayDate, liveHistory]);

  const handleOpenFamilyCollectModal = (family: SiblingFamilyGroup) => {
    const { selectedIds } = getOrderedSelectedForFamily(family);
    const activeIds = selectedIds.length > 0 ? selectedIds : family.students.map((s) => s.id);
    const totalDue = activeIds.reduce((sum, id) => {
      const st = family.students.find((x) => x.id === id);
      return sum + (st ? getChildFeeSnapshot(st).totalDue : 0);
    }, 0);
    setCollectFamilyTarget(family);
    setCollectAmountInput(String(totalDue));
    setCollectPayMode("Cash");
    setCollectPayDate(new Date().toISOString().slice(0, 10));
  };

  const handleOpenCombinedFamilySlip = (family: SiblingFamilyGroup) => {
    const { selectedIds } = getOrderedSelectedForFamily(family);
    const activeIds = selectedIds.length > 0 ? selectedIds : family.students.map((s) => s.id);
    const sibInputs = buildFamilySiblingInputs(family, activeIds);
    if (sibInputs.length === 0) {
      toast.info("Kam se kam 1 baccha chunein.");
      return;
    }

    const primaryStu = sibInputs[0].student;
    const snaps = sibInputs.map((inp) => ({
      inp,
      snap: getChildFeeSnapshot(inp.student),
    }));
    const anyUnpaid = snaps.some((x) => x.snap.totalDue > 0);
    const totalDueBefore = snaps.reduce((s, x) => s + x.snap.totalDue, 0);
    const totalPaidAlready = snaps.reduce((s, x) => s + Number(x.snap.mf?.paidAmount || 0), 0);
    const advMonthsSet = new Set<string>();
    const nextSlipSet = new Set<string>();
    let lastBakayaTotal = 0;

    const famSummary = snaps.map(({ inp, snap }) => {
      snap.advMeta.advanceCoveredMonths.forEach((m) => advMonthsSet.add(m));
      if (snap.advMeta.nextFeeSlipMonth) nextSlipSet.add(snap.advMeta.nextFeeSlipMonth);
      lastBakayaTotal += snap.advMeta.lastBakayaAmount;
      const paidNow = snap.isPaid ? Math.max(snap.netRate, Number(snap.mf?.paidAmount || 0)) : Number(snap.mf?.paidAmount || 0);
      return {
        studentId: inp.student.id,
        studentName: inp.student.name,
        className: inp.className,
        rollNo: inp.student.rollNo,
        admissionNo: inp.student.admissionNo,
        monthlyRate: snap.netRate,
        grossDue: snap.totalDue + inp.concessionThisCycle,
        concession: inp.concessionThisCycle,
        alreadyPaid: Number(snap.mf?.paidAmount || 0),
        dueBefore: snap.totalDue,
        netDueBefore: snap.totalDue,
        paidNow,
        paidThisTime: paidNow,
        balanceAfter: snap.totalDue,
        status: (snap.isPaid ? "FULL_PAID" : snap.isPartial ? "PARTIAL" : "UNPAID") as "FULL_PAID" | "PARTIAL" | "UNPAID",
        statusLabel: snap.isPaid ? "✓ Full Paid" : snap.isPartial ? `आंशिक ₹${snap.totalDue}` : `बकाया ₹${snap.totalDue}`,
        advanceMonths: snap.advMeta.advanceCoveredMonths,
        advanceCoveredMonths: snap.advMeta.advanceCoveredMonths,
        advancePaidAt: snap.advMeta.advancePaidAt,
        nextSlipMonth: snap.advMeta.nextFeeSlipMonth,
        nextFeeSlipMonth: snap.advMeta.nextFeeSlipMonth,
      };
    });

    const items = snaps.map(({ inp, snap }, idx) => ({
      id: `fam_slip_${inp.student.id}`,
      slNo: idx + 1,
      description: `${inp.student.name} (${inp.className})${snap.advMeta.advanceCoveredMonths.length > 0 ? ` · Adv (${formatCoveredMonthsList(snap.advMeta.advanceCoveredMonths)})` : ""}`,
      due: snap.totalDue > 0 ? snap.totalDue + inp.concessionThisCycle : snap.baseTuition,
      con: inp.concessionThisCycle,
      paid: snap.isPaid ? Math.max(snap.netRate, Number(snap.mf?.paidAmount || 0)) : Number(snap.mf?.paidAmount || 0),
    }));

    const combinedFee: MonthlyFee = {
      schoolId: school.id,
      sessionId: activeSession?.id || "2026-27",
      studentId: primaryStu.id,
      studentName: `${sibInputs.map((x) => x.student.name).join(" + ")} (${sibInputs.length} Siblings)`,
      classId: primaryStu.classId,
      className: Array.from(new Set(sibInputs.map((x) => x.className))).join(" / "),
      rollNo: sibInputs.map((x) => x.student.rollNo).filter(Boolean).join(", "),
      month: activeMonth,
      monthlyAmount: totalDueBefore,
      amount: totalDueBefore,
      paid: !anyUnpaid,
      paidAmount: anyUnpaid ? totalPaidAlready : snaps.reduce((s, x) => s + Math.max(x.snap.netRate, Number(x.snap.mf?.paidAmount || 0)), 0),
      balanceDue: totalDueBefore,
      receiptNo: anyUnpaid ? `FAM-SLIP-${activeMonth}` : (snaps.find((x) => x.snap.mf?.receiptNo)?.snap.mf?.receiptNo || `FAM-RCP-${activeMonth}`),
      familyGroupId: family.id,
      familyReceiptNo: `FAM-${activeMonth}`,
      familyMembersSummary: famSummary,
      advanceCoveredMonths: Array.from(advMonthsSet).sort(),
      advancePaidAt: snaps.find((x) => x.snap.advMeta.advancePaidAt)?.snap.advMeta.advancePaidAt,
      nextFeeSlipMonth: Array.from(nextSlipSet).sort()[0],
      lastBakayaAmount: lastBakayaTotal,
      items,
      paidDate: anyUnpaid ? undefined : (snaps.find((x) => x.snap.mf?.paidDate)?.snap.mf?.paidDate || new Date().toISOString()),
    };

    setPreviewFamilyReceipt({
      fee: combinedFee,
      student: primaryStu,
      initialFormat: anyUnpaid ? "a6" : "4in1",
    });
  };

  const handleSaveCombinedFamilyPayment = async (openReceiptAfter: boolean) => {
    if (!collectFamilyTarget || savingFamilyFee) return;
    const { selectedIds } = getOrderedSelectedForFamily(collectFamilyTarget);
    const activeIds = selectedIds.length > 0 ? selectedIds : collectFamilyTarget.students.map((s) => s.id);
    const sibInputs = buildFamilySiblingInputs(collectFamilyTarget, activeIds);
    if (sibInputs.length === 0) return;

    const paidNum = Math.max(0, Number(collectAmountInput) || 0);
    if (paidNum <= 0) {
      toast.error("Kripya ₹0 se zyada fee rashi darj karein.");
      return;
    }

    setSavingFamilyFee(true);
    try {
      const famReceiptNo = `FAM-RCP-${Math.floor(10000 + Math.random() * 90000)}`;
      const paidIso = new Date().toISOString();
      const settled = calculateFamilyHorizontalSettlement({
        siblings: sibInputs,
        paymentAmount: paidNum,
        currentMonth: activeMonth,
        paidAtIso: collectPayDate,
        familyReceiptNo: famReceiptNo,
        feeHistory: liveHistory,
      });

      const payModeInfo = {
        payMode: collectPayMode,
        date: collectPayDate,
        bank: collectPayMode,
        number: "",
      };

      for (const childRes of settled.perSiblingResults) {
        const sibStudent = childRes.student;
        const sibSnap = getChildFeeSnapshot(sibStudent);
        const sibFee = sibSnap.mf;

        for (const alloc of childRes.allocations) {
          if (alloc.month === "0000-BACK-DUE" || alloc.month === "0001-ADM-DUE" || alloc.month === "0002-DEFERRED-TUITION") continue;
          const existingRec = liveHistory.find((h) => h.studentId === childRes.studentId && h.month === alloc.month);
          const isCur = alloc.month === activeMonth;
          const rec: MonthlyFee = {
            ...(existingRec || (isCur && sibFee ? sibFee : {})),
            schoolId: school.id,
            sessionId: sibStudent.sessionId || activeSession?.id || "2026-27",
            studentId: childRes.studentId,
            studentName: childRes.studentName,
            rollNo: sibStudent.rollNo || "",
            classId: sibStudent.classId,
            month: alloc.month,
            monthlyAmount: isCur ? sibSnap.baseTuition : (existingRec?.monthlyAmount ?? sibSnap.baseTuition),
            includeBusFee: Boolean(sibFee?.includeBusFee || sibStudent.usesBus),
            busFeeAmount: sibSnap.busAmt,
            amount: isCur ? (sibFee?.amount ?? alloc.originalDue) : (existingRec?.amount ?? alloc.originalDue),
            paid: alloc.status === "PAID",
            paidAmount: alloc.totalPaidAfter,
            balanceDue: alloc.balanceDueAfter,
            paidDate: alloc.allocatedThisTime > 0 ? paidIso : existingRec?.paidDate,
            paidBy: alloc.allocatedThisTime > 0 ? "accountant" : existingRec?.paidBy,
            receiptNo: alloc.allocatedThisTime > 0 ? (isCur ? famReceiptNo : `FIFO-${alloc.month}-${famReceiptNo}`) : existingRec?.receiptNo,
            payModeInfo: alloc.allocatedThisTime > 0 ? payModeInfo : existingRec?.payModeInfo,
            familyGroupId: collectFamilyTarget.id,
            familyReceiptNo: famReceiptNo,
            lastBakayaAmount: childRes.summaryItem.dueBefore,
            lastReceiptPaidAmount: alloc.allocatedThisTime > 0 ? childRes.totalPaidNow : existingRec?.lastReceiptPaidAmount,
            advanceCoveredMonths: childRes.advanceMonths,
            advancePaidAt: childRes.advanceMonths.length > 0 ? paidIso : existingRec?.advancePaidAt,
            nextFeeSlipMonth: childRes.nextSlipMonth,
            note: alloc.status === "PAID"
              ? `Family Paid (${famReceiptNo})${childRes.advanceMonths.length > 0 ? ` · Adv: ${formatCoveredMonthsList(childRes.advanceMonths)}` : ""}`
              : alloc.status === "PARTIAL"
              ? `आंशिक बकाया ₹${alloc.balanceDueAfter} (${famReceiptNo})`
              : "Unpaid Due",
          } as MonthlyFee;
          await saveFee(rec).catch(() => {});
          if (isCur && alloc.status === "PAID") {
            await markFeePaid(school.id, childRes.studentId, activeMonth, "accountant").catch(() => {});
          }
        }

        for (const adv of childRes.advanceMonthAllocations) {
          const existingFuture = liveHistory.find((h) => h.studentId === childRes.studentId && h.month === adv.month);
          const advRec: MonthlyFee = {
            ...(existingFuture || {}),
            schoolId: school.id,
            sessionId: sibStudent.sessionId || activeSession?.id || "2026-27",
            studentId: childRes.studentId,
            studentName: childRes.studentName,
            rollNo: sibStudent.rollNo || "",
            classId: sibStudent.classId,
            month: adv.month,
            monthlyAmount: sibSnap.baseTuition,
            includeBusFee: Boolean(sibStudent.usesBus),
            busFeeAmount: sibSnap.busAmt,
            amount: adv.dueBefore,
            paid: adv.status === "PAID",
            paidAmount: adv.paidNow,
            balanceDue: adv.balanceAfter,
            paidDate: paidIso,
            paidBy: "accountant",
            receiptNo: `ADV-${adv.month}-${famReceiptNo}`,
            payModeInfo,
            familyGroupId: collectFamilyTarget.id,
            familyReceiptNo: famReceiptNo,
            advanceCoveredMonths: childRes.advanceMonths,
            advancePaidAt: paidIso,
            nextFeeSlipMonth: childRes.nextSlipMonth,
            lastBakayaAmount: childRes.summaryItem.dueBefore,
            lastReceiptPaidAmount: adv.paidNow,
            note: adv.status === "PAID"
              ? `Advance Paid at ${formatCompactDayMonth(paidIso)} (${famReceiptNo})`
              : `Advance Credit ₹${adv.paidNow} (आंशिक बकाया ₹${adv.balanceAfter})`,
          } as MonthlyFee;
          await saveFee(advRec).catch(() => {});
        }

        const sp: Partial<SchoolStudent> = {};
        const backAlloc = childRes.allocations.find((a) => a.month === "0000-BACK-DUE");
        if (backAlloc) sp.previousSessionDue = Math.max(0, Number(backAlloc.balanceDueAfter || 0));
        const admAlloc = childRes.allocations.find((a) => a.month === "0001-ADM-DUE");
        if (admAlloc) sp.admissionDueBalance = Math.max(0, Number(admAlloc.balanceDueAfter || 0));
        if (Object.keys(sp).length > 0) {
          await updateStudent(school.id, sibStudent.id, sp).catch(() => {});
          if (onUpdateStudent) onUpdateStudent({ ...sibStudent, ...sp });
        }

        if (childRes.totalPaidNow > 0) {
          void autoSettleFeeCallFollowUp(school.id, childRes.studentId, {
            receiptNo: famReceiptNo,
            amountPaid: childRes.totalPaidNow,
            remainingDue: childRes.remainingBalanceAfter,
            actorName: "Accountant",
            studentName: childRes.studentName,
            fatherName: sibStudent.fatherName,
            classId: sibStudent.classId,
            className: childRes.className,
            rollNo: sibStudent.rollNo,
            phone: sibStudent.phone || sibStudent.whatsappNo || "",
          });
        }
      }

      const primaryStu = sibInputs[0].student;
      const combinedSnapshot: MonthlyFee = {
        schoolId: school.id,
        sessionId: activeSession?.id || "2026-27",
        studentId: primaryStu.id,
        classId: primaryStu.classId,
        rollNo: sibInputs.map((x) => x.student.rollNo).filter(Boolean).join(", "),
        month: activeMonth,
        receiptNo: famReceiptNo,
        familyGroupId: collectFamilyTarget.id,
        familyReceiptNo: famReceiptNo,
        studentName: `${settled.familyMembersSummary.map((m) => m.studentName).join(" + ")} (${settled.familyMembersSummary.length} Siblings)`,
        className: Array.from(new Set(settled.familyMembersSummary.map((m) => m.className))).join(" / "),
        amount: settled.totalFamilyDueBefore,
        paid: settled.totalFamilyRemainingAfter === 0 && settled.totalPaidNow > 0,
        paidAmount: settled.totalPaidNow,
        lastReceiptPaidAmount: settled.totalPaidNow,
        balanceDue: settled.totalFamilyRemainingAfter,
        arrearsAmount: 0,
        paidDate: paidIso,
        payModeInfo,
        items: settled.receiptItems,
        lastBakayaAmount: settled.totalFamilyDueBefore,
        advanceCoveredMonths: settled.advanceCoveredMonths,
        advancePaidAt: settled.advanceCoveredMonths.length > 0 ? paidIso : undefined,
        nextFeeSlipMonth: settled.nextFeeSlipMonth,
        familyMembersSummary: settled.familyMembersSummary,
        note: settled.summaryHindi,
      } as MonthlyFee;

      setCollectFamilyTarget(null);
      await reloadFeeData();

      toast.success(
        settled.advanceCoveredMonths.length > 0
          ? `Family Fee & Advance Saved! Next Slip: ${formatMonthNameOnly(settled.nextFeeSlipMonth)}`
          : settled.totalFamilyRemainingAfter > 0
          ? `आंशिक बकाया ₹${settled.totalFamilyRemainingAfter.toLocaleString("en-IN")} (अगले माह जुड़ेगा) • Saved!`
          : `Combined Family Fee Paid ✓ (${famReceiptNo})`
      );

      if (openReceiptAfter) {
        setPreviewFamilyReceipt({
          fee: combinedSnapshot,
          student: primaryStu,
          initialFormat: "4in1",
        });
      }
    } catch (err) {
      console.error("Family payment save failed:", err);
      toast.error("Combined family fee save karne me dikkat aayi.");
    } finally {
      setSavingFamilyFee(false);
    }
  };

  // Filtered families based on search and active tab
  const filteredFamilies = useMemo(() => {
    let list = families;

    if (activeTab === "discounted") {
      list = list.filter((f) => f.hasDiscount);
    } else if (activeTab === "free") {
      list = list.filter((f) => f.hasFreeEducation);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => {
        const matchesName = f.familyName.toLowerCase().includes(q);
        const matchesFather = f.fatherName?.toLowerCase().includes(q);
        const matchesMother = f.motherName?.toLowerCase().includes(q);
        const matchesPhone = f.phone?.includes(q) || f.whatsappNo?.includes(q);
        const matchesAadhaar = f.fatherAadhaar?.includes(q) || f.motherAadhaar?.includes(q);
        const matchesChild = f.students.some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.admissionNo?.toLowerCase().includes(q) ||
            s.rollNo?.toLowerCase().includes(q) ||
            s.className?.toLowerCase().includes(q)
        );
        return matchesName || matchesFather || matchesMother || matchesPhone || matchesAadhaar || matchesChild;
      });
    }

    return list;
  }, [families, activeTab, searchQuery]);

  // Handle individual child discount change
  const handleUpdateStudentDiscount = async (
    targetStudent: SchoolStudent,
    discountType: "FREE" | "50_PCT" | "25_PCT" | "CUSTOM_AMT" | "NONE",
    customAmt?: number,
    familyGroupId?: string
  ) => {
    setSavingStudentId(targetStudent.id);
    try {
      const baseFee = Number(targetStudent.baseMonthlyFee ?? targetStudent.monthlyFee ?? 0);
      let isFreeEducation = false;
      let siblingDiscountPct: number | undefined = undefined;
      let siblingDiscountAmount: number | undefined = undefined;
      let concessionType: any = "NONE";
      let concessionReason = "";

      if (discountType === "FREE") {
        isFreeEducation = true;
        siblingDiscountPct = 100;
        siblingDiscountAmount = baseFee;
        concessionType = "FREE_EDUCATION";
        concessionReason = "भाई-बहन 100% नि:शुल्क शिक्षा (Sibling Full Free)";
      } else if (discountType === "50_PCT") {
        siblingDiscountPct = 50;
        siblingDiscountAmount = Math.round((baseFee * 50) / 100);
        concessionType = "SIBLING_DISCOUNT";
        concessionReason = "भाई-बहन 50% छूट (Sibling 50% Concession)";
      } else if (discountType === "25_PCT") {
        siblingDiscountPct = 25;
        siblingDiscountAmount = Math.round((baseFee * 25) / 100);
        concessionType = "SIBLING_DISCOUNT";
        concessionReason = "भाई-बहन 25% छूट (Sibling 25% Concession)";
      } else if (discountType === "CUSTOM_AMT" && customAmt !== undefined) {
        siblingDiscountAmount = Math.max(0, customAmt);
        siblingDiscountPct = baseFee > 0 ? Math.round((customAmt / baseFee) * 100) : 0;
        concessionType = "SIBLING_DISCOUNT";
        concessionReason = `भाई-बहन ₹${customAmt} मासिक छूट`;
      } else {
        isFreeEducation = false;
        siblingDiscountPct = undefined;
        siblingDiscountAmount = undefined;
        concessionType = "NONE";
        concessionReason = "";
      }

      const updatePayload: Partial<SchoolStudent> = {
        isSiblingMarked: true,
        familyGroupId: familyGroupId || targetStudent.familyGroupId,
        isFreeEducation,
        siblingDiscountPct,
        siblingDiscountAmount,
        concessionType,
        concessionReason,
      };

      await updateStudent(school.id, targetStudent.id, updatePayload);

      if (onUpdateStudent) {
        onUpdateStudent({ ...targetStudent, ...updatePayload });
      }

      setSaveSuccessStudentId(targetStudent.id);
      setTimeout(() => setSaveSuccessStudentId(null), 2500);
    } catch (err) {
      console.error("Failed to update student sibling concession:", err);
      toast.error("छूट अपडेट करने में त्रुटि हुई। कृपया पुनः प्रयास करें।");
    } finally {
      setSavingStudentId(null);
    }
  };

  // 1-Tap Smart Preset: 1st Child Normal, 2nd Child 50% Off, 3rd Child 100% Free
  const handleApplyFamilyStandardPreset = async (family: SiblingFamilyGroup) => {
    const key = `preset:${family.id}`;
    if (confirmActionKey !== key) {
      setConfirmActionKey(key);
      return;
    }
    setConfirmActionKey(null);
    for (let idx = 0; idx < family.students.length; idx++) {
      const st = family.students[idx];
      if (idx === 0) {
        await handleUpdateStudentDiscount(st, "NONE", undefined, family.id);
      } else if (idx === 1) {
        await handleUpdateStudentDiscount(st, "50_PCT", undefined, family.id);
      } else {
        await handleUpdateStudentDiscount(st, "FREE", undefined, family.id);
      }
    }
    toast.success(`${family.familyName} पर मानक छूट नियम लागू किया गया!`);
  };

  // 1-Tap Make All 100% Free
  const handleMakeAllSiblingsFree = async (family: SiblingFamilyGroup) => {
    const key = `free:${family.id}`;
    if (confirmActionKey !== key) {
      setConfirmActionKey(key);
      return;
    }
    setConfirmActionKey(null);
    for (const st of family.students) {
      await handleUpdateStudentDiscount(st, "FREE", undefined, family.id);
    }
    toast.success(`${family.familyName} के सभी बच्चों को 100% नि:शुल्क किया गया!`);
  };

  // 1-Tap Reset to Normal
  const handleResetFamilyToNormal = async (family: SiblingFamilyGroup) => {
    const key = `reset:${family.id}`;
    if (confirmActionKey !== key) {
      setConfirmActionKey(key);
      return;
    }
    setConfirmActionKey(null);
    for (const st of family.students) {
      await handleUpdateStudentDiscount(st, "NONE", undefined, family.id);
    }
    toast.success(`${family.familyName} की फीस सामान्य कर दी गई।`);
  };

  // Unlink a student from a family group
  const handleUnlinkStudent = async (student: SchoolStudent) => {
    const key = `unlink:${student.id}`;
    if (confirmActionKey !== key) {
      setConfirmActionKey(key);
      return;
    }
    setConfirmActionKey(null);
    try {
      const unlinkPayload: Partial<SchoolStudent> = {
        isSiblingMarked: false,
        familyGroupId: "",
        siblingStudentIds: [],
        siblingDiscountPct: undefined,
        siblingDiscountAmount: undefined,
        isFreeEducation: false,
        concessionType: "NONE",
        concessionReason: "",
      };

      await updateStudent(school.id, student.id, unlinkPayload);

      if (onUpdateStudent) {
        onUpdateStudent({ ...student, ...unlinkPayload });
      }
      toast.success(`${student.name} को परिवार समूह से अलग किया गया।`);
    } catch (err) {
      console.error("Failed to unlink student:", err);
      toast.error("छात्र को अलग करने में त्रुटि हुई।");
    } finally {
      setSavingStudentId(null);
    }
  };

  // Manual link student into target family
  const handleLinkStudentIntoFamily = async (studentToLink: SchoolStudent, targetFamily: SiblingFamilyGroup) => {
    try {
      setLinkingLoading(true);
      const existingStudentIds = targetFamily.students.map((s) => s.id);
      const updatedSiblingIds = Array.from(new Set([...existingStudentIds, studentToLink.id]));

      const linkPayload: Partial<SchoolStudent> = {
        isSiblingMarked: true,
        familyGroupId: targetFamily.id,
        siblingStudentIds: existingStudentIds,
        fatherName: studentToLink.fatherName || targetFamily.fatherName,
        motherName: studentToLink.motherName || targetFamily.motherName,
        fatherAadhaar: studentToLink.fatherAadhaar || targetFamily.fatherAadhaar,
        motherAadhaar: studentToLink.motherAadhaar || targetFamily.motherAadhaar,
        address: studentToLink.address || targetFamily.address,
      };

      // Update student to link
      await updateStudent(school.id, studentToLink.id, linkPayload);

      // Also link target family students to include this new sibling
      for (const st of targetFamily.students) {
        await updateStudent(school.id, st.id, {
          isSiblingMarked: true,
          familyGroupId: targetFamily.id,
          siblingStudentIds: updatedSiblingIds.filter((id) => id !== st.id),
        });
      }

      if (onUpdateStudent) {
        onUpdateStudent({ ...studentToLink, ...linkPayload });
      }

      setLinkTargetFamily(null);
      setLinkSearchQuery("");
      toast.success(`${studentToLink.name} को ${targetFamily.familyName} में जोड़ा गया!`);
    } catch (err) {
      console.error("Failed to link student:", err);
      toast.error("छात्र को लिंक करने में त्रुटि हुई।");
    } finally {
      setLinkingLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 pb-16">
      {/* ── TOP BANNER & HEADER ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 rounded-3xl p-5 sm:p-6 text-slate-900 dark:text-white border-2 border-indigo-700 dark:border-indigo-500 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 border-2 border-indigo-600 dark:border-indigo-400/40 text-indigo-700 dark:text-amber-300">
                <Users className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    भाई-बहन प्रोफाइल (Sibling Profile &amp; Concessions)
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-700 dark:border-emerald-400/40 text-emerald-800 dark:text-emerald-300">
                    Auto-Group Engine
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-indigo-200/90 font-medium">
                  समान माता-पिता, आधार कार्ड, मोबाइल व पते के आधार पर स्वतः निर्मित फैमिली प्रोफाइल • 1-क्लिक डिस्काउंट व 100% फ्री शिक्षा
                </p>
              </div>
            </div>

            {/* Smart Detection Rules Ribbon */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-indigo-900 dark:text-indigo-200">
              <span className="font-bold text-slate-700 dark:text-slate-300">ऑटो पहचान नियम:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400/30 font-semibold">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>समान माता-पिता का नाम</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400/30 font-semibold">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>समान आधार कार्ड (माता/पिता/छात्र)</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400/30 font-semibold">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>समान मोबाइल / व्हाट्सएप</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-indigo-950/60 border border-indigo-400 dark:border-indigo-400/30 font-semibold">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>समान निवास पता</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-indigo-400 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <input
                type="month"
                value={activeMonth}
                onChange={(e) => setActiveMonth(e.target.value || currentMonthStr())}
                className="bg-transparent font-bold text-slate-800 dark:text-white outline-none text-xs cursor-pointer"
                aria-label="Fee Month"
              />
            </div>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 rounded-xl bg-white dark:bg-white/10 hover:bg-indigo-100 dark:hover:bg-white/20 text-indigo-900 dark:text-white font-bold text-xs transition cursor-pointer border-2 border-indigo-600 dark:border-white/10 shadow-xs"
              >
                ← वापस डैशबोर्ड
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STATS DASHBOARD SUMMARY ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-indigo-400 mb-1">
            <span className="text-[11px] font-bold">कुल भाई-बहन परिवार</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{stats.totalFamilies}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">ऑटो डिटेक्टेड परिवार</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-blue-400 mb-1">
            <span className="text-[11px] font-bold">कुल नामांकित छात्र</span>
            <GraduationCap className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-300">{stats.totalSiblingStudents}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">परिवारों में शामिल बच्चे</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[11px] font-bold">छूट प्राप्त छात्र</span>
            <Award className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-300">{stats.discountedStudents}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">25% से 100% छूट एक्टिव</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[11px] font-bold">100% नि:शुल्क छात्र</span>
            <HeartHandshake className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400">{stats.freeEducationStudents}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">₹0 ट्यूशन फीस</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-50 to-indigo-50 dark:from-indigo-950/70 dark:to-slate-900 border-2 border-emerald-700 dark:border-indigo-500/40 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1">
            <span className="text-[11px] font-bold">मासिक कुल छूट</span>
            <IndianRupee className="w-4 h-4" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
            ₹{stats.totalMonthlySavings.toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-indigo-800 dark:text-indigo-300 mt-0.5 font-medium">प्रति माह कुल रियायत</p>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("families")}
            className={`px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "families"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400"
                : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>सभी भाई-बहन परिवार ({families.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("discounted")}
            className={`px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "discounted"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400"
                : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>छूट प्राप्त परिवार ({families.filter((f) => f.hasDiscount).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("free")}
            className={`px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "free"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400"
                : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750"
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>100% फ्री शिक्षा ({families.filter((f) => f.hasFreeEducation).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("singles")}
            className={`px-3 py-2 rounded-xl text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "singles"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400"
                : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>अकेले छात्र / अन-लिंक्ड ({singleStudents.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="छात्र, पिता, माता, आधार या मोबाइल खोजें..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── UNLINKED / SINGLE STUDENTS TAB ─────────────────────────────────── */}
      {activeTab === "singles" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>अकेले छात्र (Single Students Not Linked to Any Sibling)</span>
              </h3>
              <p className="text-xs text-slate-400">
                ये छात्र अभी किसी परिवार में ऑटो-डिटेक्ट नहीं हुए हैं। आप इन्हें किसी भी परिवार में 1-क्लिक से जोड़ सकते हैं।
              </p>
            </div>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-800 px-2.5 py-1 rounded-xl">
              {singleStudents.length} Students
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {singleStudents
              .filter((st) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase().trim();
                return (
                  st.name.toLowerCase().includes(q) ||
                  st.admissionNo?.toLowerCase().includes(q) ||
                  st.rollNo?.toLowerCase().includes(q) ||
                  st.fatherName?.toLowerCase().includes(q) ||
                  st.motherName?.toLowerCase().includes(q) ||
                  st.phone?.includes(q) ||
                  st.fatherAadhaar?.includes(q)
                );
              })
              .map((st) => (
                <div
                  key={st.id}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{st.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {st.className || "Class"} • Roll {st.rollNo || "—"} • Adm {st.admissionNo || "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      पिता: {st.fatherName || "—"} • माता: {st.motherName || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-400 font-mono block">
                      ₹{st.monthlyFee || 0}/माह
                    </span>
                    <span className="text-[9px] text-slate-400">सामान्य फीस</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── SIBLING FAMILIES LIST ───────────────────────────────────────────── */}
      {activeTab !== "singles" && (
        <div className="space-y-4">
          {filteredFamilies.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-base font-bold text-slate-200">कोई भाई-बहन परिवार नहीं मिला</p>
              <p className="text-xs max-w-md mx-auto text-slate-500">
                खोज शब्द बदलें या सुनिश्चित करें कि छात्रों के नामांकन फॉर्म में माता, पिता का नाम या आधार कार्ड दर्ज है।
              </p>
            </div>
          ) : (
            filteredFamilies.map((family, fIdx) => (
              <div
                key={family.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-700 dark:border-slate-800 hover:border-indigo-900 dark:hover:border-slate-700 shadow-lg overflow-hidden transition"
              >
                {/* Family Header Strip */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/70 border-b-2 border-indigo-700/30 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 border border-indigo-700/40 dark:border-transparent flex items-center justify-center text-xs font-black font-mono">
                        #{fIdx + 1}
                      </span>
                      <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>👨‍👩‍👧‍👦 {family.familyName}</span>
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 border border-indigo-700/50 dark:border-indigo-500/30">
                        {family.totalStudents} भाई-बहन
                      </span>
                      {family.hasFreeEducation && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-700/50 dark:border-emerald-500/30">
                          100% नि:शुल्क एक्टिव
                        </span>
                      )}
                      {family.hasDiscount && !family.hasFreeEducation && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-700/50 dark:border-amber-500/30">
                          छूट एक्टिव
                        </span>
                      )}
                    </div>

                    {/* Parents, Contact, Aadhaar & Match Reason */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {family.fatherName && (
                        <span className="flex items-center gap-1">
                          <span className="text-slate-500 font-bold">पिता:</span>
                          <span className="text-slate-200 font-semibold">{family.fatherName}</span>
                        </span>
                      )}
                      {family.motherName && (
                        <span className="flex items-center gap-1">
                          <span className="text-slate-500 font-bold">माता:</span>
                          <span className="text-slate-200 font-semibold">{family.motherName}</span>
                        </span>
                      )}
                      {(family.phone || family.whatsappNo) && (
                        <span className="flex items-center gap-1 font-mono text-emerald-400">
                          <Phone className="w-3 h-3" />
                          <span>{family.phone || family.whatsappNo}</span>
                        </span>
                      )}
                      {(family.fatherAadhaar || family.motherAadhaar) && (
                        <span className="flex items-center gap-1 font-mono text-blue-300">
                          <CreditCard className="w-3 h-3" />
                          <span>आधार: {family.fatherAadhaar || family.motherAadhaar}</span>
                        </span>
                      )}
                      {family.address && (
                        <span className="flex items-center gap-1 text-slate-400 truncate max-w-xs">
                          <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{family.address}</span>
                        </span>
                      )}
                    </div>

                    {/* Matching Reason Tag */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-bold">ऑटो मैच आधार:</span>
                      {family.matchReasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-slate-800 text-indigo-300 border border-slate-700"
                        >
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 1-Tap Family Preset Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {confirmActionKey === `preset:${family.id}` ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleApplyFamilyStandardPreset(family)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-500 text-white font-black text-[11px] cursor-pointer"
                        >
                          Confirm मानक नियम
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmActionKey(null)}
                          className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-[11px] cursor-pointer"
                        >
                          रद्द
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApplyFamilyStandardPreset(family)}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1 cursor-pointer"
                        title="पहला बच्चा सामान्य, दूसरा 50% छूट, तीसरा 100% फ्री"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>मानक नियम (2nd: 50%, 3rd+: Free)</span>
                      </button>
                    )}

                    {confirmActionKey === `free:${family.id}` ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMakeAllSiblingsFree(family)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px] cursor-pointer"
                        >
                          Confirm सभी 100% फ्री
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmActionKey(null)}
                          className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-[11px] cursor-pointer"
                        >
                          रद्द
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMakeAllSiblingsFree(family)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition flex items-center gap-1 cursor-pointer"
                        title="परिवार के सभी बच्चों को 100% फ्री करें"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>सभी 100% फ्री</span>
                      </button>
                    )}

                    {confirmActionKey === `reset:${family.id}` ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleResetFamilyToNormal(family)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-600 text-white font-black text-[11px] cursor-pointer"
                        >
                          Confirm रीसेट
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmActionKey(null)}
                          className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-[11px] cursor-pointer"
                        >
                          रद्द
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResetFamilyToNormal(family)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                        title="सभी बच्चों की छूट हटाकर सामान्य फीस करें"
                      >
                        <span>रीसेट</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setLinkTargetFamily(family)}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                      title="इस परिवार में अन्य भाई/बहन जोड़ें"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ भाई/बहन जोड़ें</span>
                    </button>
                  </div>
                </div>

                {/* Children Breakdown Cards (With Checkboxes, Priority Order & Live Dues/Advance Status) */}
                <div className="p-4 sm:p-5 space-y-3">
                  {(() => {
                    const { orderedIds, selectedIds } = getOrderedSelectedForFamily(family);
                    const orderedStudents = orderedIds
                      .map((id) => family.students.find((s) => s.id === id))
                      .filter((s): s is SchoolStudent => Boolean(s));
                    const selectedDueTotal = orderedStudents
                      .filter((s) => selectedIds.includes(s.id))
                      .reduce((sum, s) => sum + getChildFeeSnapshot(s).totalDue, 0);

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-xs">
                          <span className="text-slate-400 font-bold">
                            चुनें (☑) किस-किस बच्चे की फीस जमा/स्लिप बनानी है ({selectedIds.length}/{orderedStudents.length} Selected):
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedByFamily((prev) => ({
                                  ...prev,
                                  [family.id]: orderedIds,
                                }))
                              }
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-600">·</span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedByFamily((prev) => ({
                                  ...prev,
                                  [family.id]: orderedIds.slice(0, 1),
                                }))
                              }
                              className="text-[11px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                              1st Only
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                          {orderedStudents.map((student, sIdx) => {
                            const baseTuition = Number(student.baseMonthlyFee ?? student.monthlyFee ?? 0);
                            const isFree = Boolean(student.isFreeEducation);
                            const currentPct = Number(student.siblingDiscountPct || 0);
                            const currentAmt = Number(student.siblingDiscountAmount || 0);

                            let effectiveMonthlyFee = baseTuition;
                            if (isFree) {
                              effectiveMonthlyFee = 0;
                            } else if (currentPct > 0) {
                              effectiveMonthlyFee = Math.max(0, baseTuition - Math.round((baseTuition * currentPct) / 100));
                            } else if (currentAmt > 0) {
                              effectiveMonthlyFee = Math.max(0, baseTuition - currentAmt);
                            }

                            const childSnap = getChildFeeSnapshot(student);
                            const isSelected = selectedIds.includes(student.id);
                            const isChildSaving = savingStudentId === student.id;
                            const isChildSuccess = saveSuccessStudentId === student.id;

                            return (
                              <div
                                key={student.id}
                                className={`p-3.5 rounded-2xl border transition relative ${
                                  isSelected ? "ring-2 ring-indigo-500/70 " : "opacity-80 "
                                }${
                                  isFree
                                    ? "bg-emerald-950/20 border-emerald-600/40"
                                    : currentPct > 0 || currentAmt > 0
                                    ? "bg-amber-950/20 border-amber-600/40"
                                    : "bg-slate-950/70 border-slate-800"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3 mb-2.5">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedByFamily((prev) => {
                                          const cur = prev[family.id] || orderedIds;
                                          const next = cur.includes(student.id)
                                            ? cur.filter((x) => x !== student.id)
                                            : [...cur, student.id];
                                          return { ...prev, [family.id]: next.length > 0 ? next : cur };
                                        });
                                      }}
                                      className="h-4 w-4 accent-indigo-500 rounded cursor-pointer shrink-0"
                                      aria-label={`Select ${student.name}`}
                                    />
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                      {student.photoUrl ? (
                                        <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-base font-black text-slate-400">
                                          {student.name.slice(0, 1).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-xs sm:text-sm font-black text-white truncate">{student.name}</p>
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                                          {sIdx === 0 ? "1st" : sIdx === 1 ? "2nd" : `${sIdx + 1}th`}
                                        </span>
                                        {childSnap.advMeta.advanceCoveredMonths.length > 0 ? (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            ✓ Adv: {formatCoveredMonthsList(childSnap.advMeta.advanceCoveredMonths)} · Next: {formatMonthNameOnly(childSnap.advMeta.nextFeeSlipMonth)}
                                          </span>
                                        ) : childSnap.isPaid ? (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                            ✓ Clear ({activeMonth})
                                          </span>
                                        ) : childSnap.isPartial ? (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                            आंशिक बकाया ₹{childSnap.totalDue.toLocaleString("en-IN")}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                                            Due ₹{childSnap.totalDue.toLocaleString("en-IN")}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-400 font-medium">
                                        {student.className || "Class"} • Roll {student.rollNo || "—"} • Adm {student.admissionNo || "—"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {sIdx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOrderByFamily((prev) => {
                                            const arr = [...orderedIds];
                                            [arr[sIdx - 1], arr[sIdx]] = [arr[sIdx], arr[sIdx - 1]];
                                            return { ...prev, [family.id]: arr };
                                          });
                                        }}
                                        className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
                                        title="Priority up"
                                      >
                                        ▲
                                      </button>
                                    )}
                                    {confirmActionKey === `unlink:${student.id}` ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleUnlinkStudent(student)}
                                          className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                        >
                                          Confirm Unlink
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmActionKey(null)}
                                          className="px-1.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                                        >
                                          रद्द
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlinkStudent(student)}
                                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                                        title="इस छात्र को परिवार से अलग करें"
                                      >
                                        <UserMinus className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Fee Status Strip */}
                                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs mb-3">
                                  <div>
                                    <span className="text-[10px] text-slate-400 block">बेस ट्यूशन फीस</span>
                                    <span className="font-mono font-bold text-slate-300">₹{baseTuition}/माह</span>
                                  </div>
                                  <div className="text-center">
                                    <span className="text-[10px] text-slate-400 block">सक्रिय रियायत</span>
                                    <span
                                      className={`font-mono font-black ${
                                        isFree
                                          ? "text-emerald-400"
                                          : currentPct > 0 || currentAmt > 0
                                          ? "text-amber-400"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {isFree
                                        ? "100% Free (नि:शुल्क)"
                                        : currentPct > 0
                                        ? `${currentPct}% छूट (-₹${Math.round((baseTuition * currentPct) / 100)})`
                                        : currentAmt > 0
                                        ? `-₹${currentAmt}/माह`
                                        : "कोई छूट नहीं"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block">देय मासिक / बकाया</span>
                                    <span className="font-mono font-black text-white text-sm">
                                      ₹{effectiveMonthlyFee}/माह
                                    </span>
                                  </div>
                                </div>

                                {/* Quick Discount Buttons */}
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 block">
                                    छूट चयन करें (1-क्लिक से लागू करें):
                                  </span>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isChildSaving}
                                      onClick={() => handleUpdateStudentDiscount(student, "FREE", undefined, family.id)}
                                      className={`px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                        isFree
                                          ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-1 ring-emerald-300"
                                          : "bg-slate-900 text-emerald-400 border-slate-800 hover:bg-emerald-950/50 hover:border-emerald-600/50"
                                      }`}
                                    >
                                      <span>100% Free</span>
                                      <span className="text-[9px] opacity-80">नि:शुल्क</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isChildSaving}
                                      onClick={() => handleUpdateStudentDiscount(student, "50_PCT", undefined, family.id)}
                                      className={`px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                        !isFree && currentPct === 50
                                          ? "bg-amber-600 text-white border-amber-400 shadow-md ring-1 ring-amber-300"
                                          : "bg-slate-900 text-amber-400 border-slate-800 hover:bg-amber-950/50 hover:border-amber-600/50"
                                      }`}
                                    >
                                      <span>50% OFF</span>
                                      <span className="text-[9px] opacity-80">आधा शुल्क</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isChildSaving}
                                      onClick={() => handleUpdateStudentDiscount(student, "25_PCT", undefined, family.id)}
                                      className={`px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                        !isFree && currentPct === 25
                                          ? "bg-blue-600 text-white border-blue-400 shadow-md ring-1 ring-blue-300"
                                          : "bg-slate-900 text-blue-400 border-slate-800 hover:bg-blue-950/50 hover:border-blue-600/50"
                                      }`}
                                    >
                                      <span>25% OFF</span>
                                      <span className="text-[9px] opacity-80">चौथाई छूट</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isChildSaving}
                                      onClick={() => handleUpdateStudentDiscount(student, "NONE", undefined, family.id)}
                                      className={`px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                        !isFree && currentPct === 0 && currentAmt === 0
                                          ? "bg-slate-700 text-white border-slate-500 shadow-md"
                                          : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
                                      }`}
                                    >
                                      <span>Normal</span>
                                      <span className="text-[9px] opacity-80">सामान्य</span>
                                    </button>
                                  </div>
                                </div>

                                {isChildSuccess && (
                                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] shadow-lg flex items-center gap-1 animate-in fade-in">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>सेव हो गया ✓</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Family Financial Total & Combined Collection / Combined Slip Footer */}
                        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs text-slate-300">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>
                              कुल मासिक फीस: <strong className="font-mono text-white">₹{family.netPayableMonthly}/माह</strong>
                              <span className="text-emerald-400 font-mono ml-1">(छूट -₹{family.totalMonthlyDiscount})</span>
                            </span>
                            <span>
                              चयनित {selectedIds.length} बच्चों का वर्तमान बकाया:{" "}
                              <strong className={`font-mono text-sm ${selectedDueTotal > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                                ₹{selectedDueTotal.toLocaleString("en-IN")}
                              </strong>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenCombinedFamilySlip(family)}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-indigo-500/40 text-indigo-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                              title="चुने गए भाई-बहनों की 1 संयुक्त फीस स्लिप / रसीद देखें व प्रिंट करें"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-300" />
                              <span>Combined Family Slip ({selectedIds.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenFamilyCollectModal(family)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                              title="चुने गए भाई-बहनों की फीस एक साथ जमा करें (कम होने पर आंशिक, ज्यादा होने पर एडवांस)"
                            >
                              <IndianRupee className="w-3.5 h-3.5" />
                              <span>Collect Selected Family Fee</span>
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MANUAL LINK SIBLING MODAL ───────────────────────────────────────── */}
      {linkTargetFamily && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <span>भाई-बहन जोड़ें (Link Sibling to Family)</span>
                </h3>
                <p className="text-xs text-indigo-300 truncate max-w-sm">
                  {linkTargetFamily.familyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLinkTargetFamily(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={linkSearchQuery}
                onChange={(e) => setLinkSearchQuery(e.target.value)}
                placeholder="छात्र का नाम, रोल नंबर या एडमिशन नंबर टाइप करें..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Candidate Students List */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {students
                .filter((st) => {
                  if (linkTargetFamily.students.some((s) => s.id === st.id)) return false;
                  if (!linkSearchQuery.trim()) return false;
                  const q = linkSearchQuery.toLowerCase().trim();
                  return (
                    st.name.toLowerCase().includes(q) ||
                    st.admissionNo?.toLowerCase().includes(q) ||
                    st.rollNo?.toLowerCase().includes(q) ||
                    st.fatherName?.toLowerCase().includes(q) ||
                    st.className?.toLowerCase().includes(q)
                  );
                })
                .slice(0, 15)
                .map((st) => (
                  <div
                    key={st.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{st.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {st.className} • Roll {st.rollNo || "—"} • Adm {st.admissionNo || "—"} • पिता: {st.fatherName || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={linkingLoading}
                      onClick={() => handleLinkStudentIntoFamily(st, linkTargetFamily)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      + परिवार में जोड़ें
                    </button>
                  </div>
                ))}

              {linkSearchQuery.trim() &&
                students.filter((st) => {
                  if (linkTargetFamily.students.some((s) => s.id === st.id)) return false;
                  const q = linkSearchQuery.toLowerCase().trim();
                  return (
                    st.name.toLowerCase().includes(q) ||
                    st.admissionNo?.toLowerCase().includes(q) ||
                    st.rollNo?.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <p className="text-xs text-center text-slate-500 py-6">कोई मिलान छात्र नहीं मिला</p>
                )}

              {!linkSearchQuery.trim() && (
                <p className="text-xs text-center text-slate-500 py-6">
                  ऊपर छात्र का नाम या रोल नंबर टाइप करके खोजें
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COMBINED SIBLING FAMILY FEE COLLECTION MODAL ───────────────────── */}
      {collectFamilyTarget && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
                  <ReceiptText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Combined Family Fee Collect • {collectFamilyTarget.familyName}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  माह: {formatMonthLabel(activeMonth)} • कम होने पर आंशिक बकाया, ज्यादा होने पर अगले माह Advance जमा होगा
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectFamilyTarget(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    जमा राशि (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={collectAmountInput}
                    onChange={(e) => setCollectAmountInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono font-black text-sm text-emerald-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">भुगतान माध्यम</label>
                  <select
                    value={collectPayMode}
                    onChange={(e) => setCollectPayMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white outline-none"
                  >
                    <option value="Cash">Cash / Counter</option>
                    <option value="Online / UPI">Online / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">जमा तिथि</label>
                  <input
                    type="date"
                    value={collectPayDate}
                    onChange={(e) => setCollectPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white outline-none"
                  />
                </div>
              </div>

              {collectFamilySettlementPreview && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-indigo-300">
                      Horizontal Family Settlement ({collectFamilySettlementPreview.familyMembersSummary.length} Siblings)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCollectAmountInput(String(collectFamilySettlementPreview.totalFamilyDueBefore))}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] cursor-pointer"
                      >
                        Full ₹{collectFamilySettlementPreview.totalFamilyDueBefore.toLocaleString("en-IN")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollectAmountInput(String(Math.floor(collectFamilySettlementPreview.totalFamilyDueBefore / 2)))}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px] cursor-pointer"
                      >
                        Half
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-800 text-slate-300 text-[10px]">
                        <tr>
                          <th className="p-2">Student</th>
                          <th className="p-2 text-right">Due</th>
                          <th className="p-2 text-right">Paid</th>
                          <th className="p-2 text-right">Status / Adv / बकाया</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 tabular-nums font-mono">
                        {collectFamilySettlementPreview.familyMembersSummary.map((fm) => (
                          <tr key={fm.studentId}>
                            <td className="p-2 font-sans font-bold text-white">
                              {fm.studentName} <span className="text-[10px] font-normal text-slate-400">({fm.className})</span>
                            </td>
                            <td className="p-2 text-right text-slate-300">₹{fm.dueBefore.toLocaleString("en-IN")}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">₹{fm.paidNow.toLocaleString("en-IN")}</td>
                            <td className="p-2 text-right font-sans font-bold">
                              {fm.balanceAfter > 0 ? (
                                <span className="text-amber-300">आंशिक बकाया ₹{fm.balanceAfter.toLocaleString("en-IN")}</span>
                              ) : fm.advanceMonths && fm.advanceMonths.length > 0 ? (
                                <span className="text-emerald-300">Adv ({formatCoveredMonthsList(fm.advanceMonths)})</span>
                              ) : (
                                <span className="text-emerald-400">✓ Full Paid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-950/70 border border-indigo-500/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-indigo-200">Total Paid:</span>
                      <strong className="font-mono text-emerald-300 text-sm">
                        ₹{collectFamilySettlementPreview.totalPaidNow.toLocaleString("en-IN")}
                      </strong>
                    </div>
                    {collectFamilySettlementPreview.advanceCoveredMonths.length > 0 ? (
                      <div className="flex items-center justify-between text-emerald-300 text-[11px]">
                        <span>
                          🎉 {formatCoveredMonthsList(collectFamilySettlementPreview.advanceCoveredMonths)} Paid at {formatCompactDayMonth(collectPayDate)}
                        </span>
                        <strong>Next Slip: {formatMonthNameOnly(collectFamilySettlementPreview.nextFeeSlipMonth)}</strong>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-indigo-200">
                          {collectFamilySettlementPreview.totalFamilyRemainingAfter > 0
                            ? "आंशिक बकाया (अगले माह जुड़ेगा):"
                            : "Next Slip:"}
                        </span>
                        <strong className="text-amber-300 font-mono">
                          {collectFamilySettlementPreview.totalFamilyRemainingAfter > 0
                            ? `₹${collectFamilySettlementPreview.totalFamilyRemainingAfter.toLocaleString("en-IN")}`
                            : formatMonthNameOnly(collectFamilySettlementPreview.nextFeeSlipMonth)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCollectFamilyTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingFamilyFee}
                onClick={() => handleSaveCombinedFamilyPayment(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Save Only
              </button>
              <button
                type="button"
                disabled={savingFamilyFee}
                onClick={() => handleSaveCombinedFamilyPayment(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingFamilyFee && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save &amp; Combined Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMBINED FAMILY SLIP / RECEIPT MODAL ───────────────────────────── */}
      {previewFamilyReceipt && (
        <OfficialFeeReceiptModal
          isOpen={Boolean(previewFamilyReceipt)}
          onClose={() => setPreviewFamilyReceipt(null)}
          school={school}
          fee={previewFamilyReceipt.fee}
          student={previewFamilyReceipt.student}
          className={previewFamilyReceipt.fee.className || "Family"}
          sessionName={formatAcademicSession(activeSession?.name || activeSession?.id || "2026-27")}
          feeHistory={liveHistory}
          initialFormat={previewFamilyReceipt.initialFormat}
        />
      )}
    </div>
  );
};
