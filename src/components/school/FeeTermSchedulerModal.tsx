import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  CalendarClock,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Loader2,
  Save,
  Sparkles,
  Layers,
  UserCheck,
  Wand2,
} from "lucide-react";
import type {
  DeferredScheduledFeeHead,
  FeeTermCampaign,
  FeeTypeSchedulePlan,
  FeeTypeScheduleTerm,
  MonthlyFee,
  School,
  SchoolClass,
  SchoolStudent,
} from "../../school-types";
import { sortSchoolClasses } from "../../school-types";
import { updateSchool, updateStudent } from "../../school-firebase";
import {
  FEE_HEAD_OPTIONS,
  addMonthsToYYYYMM,
  canonicalizeFeeHeadKey,
  computeStudentHeadSettlement,
  getConfiguredHeadAmountForClass,
  isStudentRegOnlyOrPending,
  previewSchedulePlanImpact,
  syncCampaignsWithPlan,
} from "../../utils/feeTermScheduler";
import { formatMonthLabel } from "../../utils/feeFifoAllocation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  school?: School | null;
  classes: SchoolClass[];
  students: SchoolStudent[];
  feeHistory: MonthlyFee[];
  currentMonth: string;
  sessionId?: string;
  actorName?: string;
  initialClassId?: string;
  initialHeadKey?: string;
  asPage?: boolean;
  onCampaignsUpdated: (nextCampaigns: FeeTermCampaign[]) => void;
  onPlansUpdated?: (
    nextPlans: Record<string, FeeTypeSchedulePlan>,
    nextCampaigns: FeeTermCampaign[]
  ) => void;
  onStudentDeferredUpdated: (studentId: string, patch: Partial<SchoolStudent>) => void;
}

const createInitialPlanForHead = (params: {
  headKey: string;
  headLabel: string;
  currentMonth: string;
  classes: SchoolClass[];
  existingPlan?: FeeTypeSchedulePlan;
  existingCampaigns?: FeeTermCampaign[];
}): FeeTypeSchedulePlan => {
  const { headKey, headLabel, currentMonth, classes, existingPlan, existingCampaigns } = params;
  if (existingPlan) {
    return {
      ...existingPlan,
      terms: (existingPlan.terms || []).map((t, idx) => ({
        ...t,
        termNumber: idx + 1,
        classAmounts: { ...(t.classAmounts || {}) },
      })),
    };
  }

  // Reconstruct from existing campaigns if any were created before plans existed
  const matchingCamps = (existingCampaigns || []).filter((c) => c.headKey === headKey);
  if (matchingCamps.length > 0) {
    return {
      headKey,
      headLabel,
      enabled: matchingCamps.some((c) => c.active !== false),
      targetMode: matchingCamps.some((c) => c.onlyPartialOrRegStudents)
        ? "reg_only_or_unpaid"
        : headKey === "exam"
          ? "all_except_full_paid"
          : "reg_only_or_unpaid",
      respectHeadCap: matchingCamps[0]?.respectHeadCap !== false,
      termCount: matchingCamps.length,
      terms: matchingCamps.map((c, idx) => {
        const classAmts: Record<string, number> = {};
        classes.forEach((cls) => {
          classAmts[cls.id] =
            c.classAmounts && Object.prototype.hasOwnProperty.call(c.classAmounts, cls.id)
              ? Number(c.classAmounts[cls.id] || 0)
              : Number(c.amount || 0);
        });
        return {
          id: c.id || `term_${headKey}_${idx + 1}`,
          termNumber: idx + 1,
          title: c.title || `${headLabel} (Term ${idx + 1})`,
          targetMonth: c.targetMonth || addMonthsToYYYYMM(currentMonth, idx),
          defaultAmount: Number(c.amount || 0),
          classAmounts: classAmts,
          active: c.active !== false,
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  // Fresh default: 2 terms for exam/admission, 1 term for others
  const defaultTermsCount = headKey === "exam" || headKey === "admission" ? 2 : 1;
  const isRegOnlyDefault = headKey !== "exam";
  const terms: FeeTypeScheduleTerm[] = Array.from({ length: defaultTermsCount }, (_, idx) => {
    const classAmts: Record<string, number> = {};
    let sampleVal = 0;
    classes.forEach((cls) => {
      const fullRate = getConfiguredHeadAmountForClass(cls, headKey);
      const splitVal =
        fullRate > 0
          ? idx === defaultTermsCount - 1
            ? Math.max(0, fullRate - Math.floor(fullRate / defaultTermsCount) * (defaultTermsCount - 1))
            : Math.floor(fullRate / defaultTermsCount)
          : 0;
      classAmts[cls.id] = splitVal;
      if (sampleVal === 0 && splitVal > 0) sampleVal = splitVal;
    });
    return {
      id: `term_${headKey}_${idx + 1}_${Date.now().toString(36)}`,
      termNumber: idx + 1,
      title:
        defaultTermsCount > 1
          ? `${headLabel} (Term ${idx + 1}/${defaultTermsCount})`
          : headLabel,
      targetMonth: addMonthsToYYYYMM(currentMonth, idx * (headKey === "exam" ? 2 : 1)),
      defaultAmount: sampleVal,
      classAmounts: classAmts,
      active: true,
    };
  });

  return {
    headKey,
    headLabel,
    enabled: false,
    targetMode: isRegOnlyDefault ? "reg_only_or_unpaid" : "all_except_full_paid",
    respectHeadCap: true,
    termCount: defaultTermsCount,
    terms,
    updatedAt: new Date().toISOString(),
  };
};

export const FeeTermSchedulerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  schoolId,
  school,
  classes,
  students,
  feeHistory,
  currentMonth,
  sessionId,
  actorName,
  initialClassId,
  initialHeadKey,
  asPage = false,
  onCampaignsUpdated,
  onPlansUpdated,
  onStudentDeferredUpdated,
}) => {
  const sortedClasses = useMemo(() => sortSchoolClasses(classes || []), [classes]);

  const [savedPlans, setSavedPlans] = useState<Record<string, FeeTypeSchedulePlan>>(
    () => school?.feeTypeSchedulePlans || {}
  );
  const [campaigns, setCampaigns] = useState<FeeTermCampaign[]>(
    () => school?.feeTermCampaigns || []
  );

  // Page navigation: either a headKey ("exam", "admission", "kit", ..., "custom_xyz") OR "__reg_students__"
  const [activePageKey, setActivePageKey] = useState<string>(initialHeadKey || "admission");
  const [draftPlan, setDraftPlan] = useState<FeeTypeSchedulePlan>(() =>
    createInitialPlanForHead({
      headKey: initialHeadKey || "admission",
      headLabel:
        FEE_HEAD_OPTIONS.find((o) => o.key === (initialHeadKey || "admission"))?.label ||
        "Admission Fee",
      currentMonth,
      classes: sortedClasses,
      existingPlan: school?.feeTypeSchedulePlans?.[initialHeadKey || "admission"],
      existingCampaigns: school?.feeTermCampaigns,
    })
  );

  // Custom Fee Type creator
  const [showAddCustomHead, setShowAddCustomHead] = useState<boolean>(false);
  const [newCustomHeadName, setNewCustomHeadName] = useState<string>("");

  // Quick fill per-term input state
  const [quickFillAmounts, setQuickFillAmounts] = useState<Record<string, string>>({});
  const [showImpactDetails, setShowImpactDetails] = useState<boolean>(false);
  const [savingPlan, setSavingPlan] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Registration-Only Students Page & 1-Student Defer State
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [classFilterId, setClassFilterId] = useState<string>(initialClassId || "ALL");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [stuHeadKey, setStuHeadKey] = useState<string>("admission");
  const [stuCustomDesc, setStuCustomDesc] = useState<string>("Admission Fee Balance");
  const [stuAmount, setStuAmount] = useState<string>("500");
  const [stuTargetMonth, setStuTargetMonth] = useState<string>(currentMonth);
  const [savingStudentDefer, setSavingStudentDefer] = useState<boolean>(false);

  // Merge built-in heads + any saved custom heads
  const feeHeadPages = useMemo(() => {
    const base = FEE_HEAD_OPTIONS.filter((o) => o.key !== "custom").map((o) => ({
      key: o.key,
      label: o.label,
      hindiLabel: o.hindiLabel,
      isCustom: false,
    }));
    const knownKeys = new Set(base.map((b) => b.key));
    Object.values(savedPlans || {}).forEach((p) => {
      if (p && !knownKeys.has(p.headKey)) {
        knownKeys.add(p.headKey);
        base.push({
          key: p.headKey,
          label: p.headLabel || p.headKey,
          hindiLabel: "कस्टम शुल्क पेज",
          isCustom: true,
        });
      }
    });
    return base;
  }, [savedPlans]);

  // Sync incoming school updates when opened
  useEffect(() => {
    if (!isOpen) return;
    const plans = school?.feeTypeSchedulePlans || {};
    const camps = school?.feeTermCampaigns || [];
    setSavedPlans(plans);
    setCampaigns(camps);
    setFeedbackMsg(null);
    setErrorMsg(null);
    setStuTargetMonth(currentMonth);
    if (initialClassId) setClassFilterId(initialClassId);
    const startKey = initialHeadKey || activePageKey || "admission";
    if (startKey !== "__reg_students__") {
      const meta = FEE_HEAD_OPTIONS.find((o) => o.key === startKey);
      setDraftPlan(
        createInitialPlanForHead({
          headKey: startKey,
          headLabel: plans[startKey]?.headLabel || meta?.label || startKey,
          currentMonth,
          classes: sortedClasses,
          existingPlan: plans[startKey],
          existingCampaigns: camps,
        })
      );
    }
  }, [isOpen, school?.feeTypeSchedulePlans, school?.feeTermCampaigns, currentMonth, initialClassId, initialHeadKey]);

  const switchFeePage = (nextKey: string) => {
    setActivePageKey(nextKey);
    setFeedbackMsg(null);
    setErrorMsg(null);
    if (nextKey === "__reg_students__") return;
    const meta = feeHeadPages.find((f) => f.key === nextKey);
    setDraftPlan(
      createInitialPlanForHead({
        headKey: nextKey,
        headLabel: savedPlans[nextKey]?.headLabel || meta?.label || nextKey,
        currentMonth,
        classes: sortedClasses,
        existingPlan: savedPlans[nextKey],
        existingCampaigns: campaigns,
      })
    );
  };

  const classMap = useMemo(() => new Map(sortedClasses.map((c) => [c.id, c])), [sortedClasses]);

  // Precompute Registration-Only / Pending students list + per-class count
  const regOnlyAnalysis = useMemo(() => {
    const regOnlyList: SchoolStudent[] = [];
    const byClassCount = new Map<string, number>();

    students.forEach((st) => {
      const cls = classMap.get(st.classId);
      const isReg = isStudentRegOnlyOrPending({ student: st, feeHistory, classObj: cls });
      if (isReg) {
        regOnlyList.push(st);
        byClassCount.set(st.classId, (byClassCount.get(st.classId) || 0) + 1);
      }
    });

    return { regOnlyList, byClassCount };
  }, [students, feeHistory, classMap]);

  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId((regOnlyAnalysis.regOnlyList[0] || students[0]).id);
    }
  }, [regOnlyAnalysis.regOnlyList, students, selectedStudentId]);

  const handleCreateCustomHeadPage = () => {
    const cleanName = newCustomHeadName.trim();
    if (!cleanName) return;
    const key = canonicalizeFeeHeadKey(cleanName);
    const finalKey = key.startsWith("custom_") ? key : `custom_${key}`;
    const newPlan = createInitialPlanForHead({
      headKey: finalKey,
      headLabel: cleanName,
      currentMonth,
      classes: sortedClasses,
      existingPlan: savedPlans[finalKey],
    });
    setSavedPlans((prev) => ({ ...prev, [finalKey]: newPlan }));
    setActivePageKey(finalKey);
    setDraftPlan(newPlan);
    setNewCustomHeadName("");
    setShowAddCustomHead(false);
    setFeedbackMsg(
      `"${cleanName}" का नया अलग पेज बन गया है — अब नीचे Term, Month व Class-wise राशि सेट करके Save दबाएँ।`
    );
  };

  const handleTermCountChange = (nextCount: number) => {
    const clamped = Math.max(1, Math.min(6, nextCount));
    setDraftPlan((prev) => {
      const nextTerms: FeeTypeScheduleTerm[] = [];
      for (let i = 0; i < clamped; i++) {
        if (prev.terms[i]) {
          nextTerms.push({
            ...prev.terms[i],
            termNumber: i + 1,
            title:
              clamped > 1 && prev.terms[i].title.includes("(Term")
                ? `${prev.headLabel} (Term ${i + 1}/${clamped})`
                : prev.terms[i].title,
          });
        } else {
          const prevMonth = nextTerms[i - 1]?.targetMonth || currentMonth;
          const prevAmts = nextTerms[i - 1]?.classAmounts || {};
          nextTerms.push({
            id: `term_${prev.headKey}_${i + 1}_${Date.now().toString(36)}`,
            termNumber: i + 1,
            title: `${prev.headLabel} (Term ${i + 1}/${clamped})`,
            targetMonth: addMonthsToYYYYMM(prevMonth, prev.headKey === "exam" ? 2 : 1),
            defaultAmount: nextTerms[i - 1]?.defaultAmount || 0,
            classAmounts: { ...prevAmts },
            active: true,
          });
        }
      }
      return {
        ...prev,
        termCount: clamped,
        terms: nextTerms,
      };
    });
  };

  const handleUpdateTermField = (
    termIndex: number,
    patch: Partial<FeeTypeScheduleTerm>
  ) => {
    setDraftPlan((prev) => ({
      ...prev,
      terms: prev.terms.map((t, i) => (i === termIndex ? { ...t, ...patch } : t)),
    }));
  };

  const handleUpdateClassTermAmount = (
    termIndex: number,
    clsId: string,
    rawVal: string
  ) => {
    const clean = Math.max(0, Math.round(Number(rawVal) || 0));
    setDraftPlan((prev) => ({
      ...prev,
      terms: prev.terms.map((t, i) =>
        i === termIndex
          ? {
              ...t,
              classAmounts: {
                ...(t.classAmounts || {}),
                [clsId]: clean,
              },
            }
          : t
      ),
    }));
  };

  const handleAutoSplitFromClassStructure = () => {
    const count = Math.max(1, draftPlan.terms.length);
    setDraftPlan((prev) => {
      const nextTerms = prev.terms.map((t, idx) => {
        const nextClassAmts: Record<string, number> = { ...(t.classAmounts || {}) };
        let sampleDefault = t.defaultAmount;
        sortedClasses.forEach((cls) => {
          const fullRate = getConfiguredHeadAmountForClass(cls, prev.headKey);
          if (fullRate > 0) {
            const base = Math.floor(fullRate / count);
            const rem = fullRate - base * count;
            const splitAmt = idx === count - 1 ? base + rem : base;
            nextClassAmts[cls.id] = splitAmt;
            if (!sampleDefault && splitAmt > 0) sampleDefault = splitAmt;
          }
        });
        return {
          ...t,
          defaultAmount: sampleDefault,
          classAmounts: nextClassAmts,
        };
      });
      return { ...prev, terms: nextTerms };
    });
    setFeedbackMsg(
      `सभी कक्षाओं का Class Fee Rate (${count} Terms में) अपने-आप बाँट दिया गया है — आप किसी भी कक्षा की राशि बदलकर Save कर सकते हैं।`
    );
  };

  const handleApplyUniformToTerm = (termIndex: number) => {
    const term = draftPlan.terms[termIndex];
    if (!term) return;
    const raw = quickFillAmounts[term.id] ?? "";
    const val = Math.max(0, Math.round(Number(raw) || 0));
    const nextClassAmts: Record<string, number> = {};
    sortedClasses.forEach((cls) => {
      nextClassAmts[cls.id] = val;
    });
    handleUpdateTermField(termIndex, {
      defaultAmount: val,
      classAmounts: nextClassAmts,
    });
  };

  // Live impact preview of current draftPlan (forcing enabled=true in preview so admin sees what saving will do!)
  const planPreview = useMemo(() => {
    const previewDraft: FeeTypeSchedulePlan = {
      ...draftPlan,
      enabled: true,
    };
    return previewSchedulePlanImpact({
      plan: previewDraft,
      schoolId,
      students,
      classes: sortedClasses,
      feeHistory,
      sessionId,
    });
  }, [draftPlan, schoolId, students, sortedClasses, feeHistory, sessionId]);

  const handleSaveFeeTypePlan = async (enableOnSave = true) => {
    setErrorMsg(null);
    setFeedbackMsg(null);

    const activeTerms = (draftPlan.terms || []).filter((t) => t.active !== false);
    if (activeTerms.length === 0) {
      setErrorMsg("कम से कम 1 Term चालू रखें।");
      return;
    }
    for (let i = 0; i < activeTerms.length; i++) {
      if (!/^\d{4}-\d{2}$/.test(activeTerms[i].targetMonth)) {
        setErrorMsg(`Term ${i + 1} के लिए सही महीना (YYYY-MM) चुनें।`);
        return;
      }
      const hasPositive =
        Number(activeTerms[i].defaultAmount || 0) > 0 ||
        Object.values(activeTerms[i].classAmounts || {}).some((v) => Number(v) > 0);
      if (!hasPositive) {
        setErrorMsg(
          `Term ${i + 1} (${formatMonthLabel(activeTerms[i].targetMonth)}) में कम से कम एक कक्षा की फीस ₹0 से अधिक भरें।`
        );
        return;
      }
    }

    setSavingPlan(true);
    try {
      const finalPlan: FeeTypeSchedulePlan = {
        ...draftPlan,
        enabled: enableOnSave ? true : draftPlan.enabled,
        termCount: draftPlan.terms.length,
        updatedAt: new Date().toISOString(),
        updatedBy: actorName,
      };
      const nextPlans: Record<string, FeeTypeSchedulePlan> = {
        ...savedPlans,
        [finalPlan.headKey]: finalPlan,
      };
      const nextCampaigns = syncCampaignsWithPlan({
        existingCampaigns: campaigns,
        schoolId,
        plan: finalPlan,
        sessionId,
        actorName,
      });

      await updateSchool(schoolId, {
        feeTypeSchedulePlans: nextPlans,
        feeTermCampaigns: nextCampaigns,
      });

      setSavedPlans(nextPlans);
      setDraftPlan(finalPlan);
      setCampaigns(nextCampaigns);
      onCampaignsUpdated(nextCampaigns);
      if (onPlansUpdated) onPlansUpdated(nextPlans, nextCampaigns);
      window.dispatchEvent(
        new CustomEvent("school-profile-updated", {
          detail: {
            schoolId,
            data: {
              feeTypeSchedulePlans: nextPlans,
              feeTermCampaigns: nextCampaigns,
            },
          },
        })
      );

      if (finalPlan.enabled) {
        setFeedbackMsg(
          `✅ "${finalPlan.headLabel}" का ${activeTerms.length}-Term प्लान सेव और लागू हो गया! ${planPreview.billedStudentCount} ${
            finalPlan.targetMode === "reg_only_or_unpaid" ? "Registration-Only / Pending" : "Unpaid"
          } छात्रों के तय महीनों के बिल में स्वतः जुड़ेगा (${planPreview.exemptStudentCount} Full-Paid छात्र ₹0 Exempt हैं)।`
        );
      } else {
        setFeedbackMsg(
          `⏸️ "${finalPlan.headLabel}" प्लान रोका गया (Paused) और सेव किया गया।`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Fee Type Plan सेव करने में समस्या आई।");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleTogglePlanEnabled = async () => {
    const nextEnabled = !draftPlan.enabled;
    const updatedDraft = { ...draftPlan, enabled: nextEnabled };
    setDraftPlan(updatedDraft);
    // If already saved previously, persist pause/resume right away
    if (savedPlans[draftPlan.headKey]) {
      setSavingPlan(true);
      try {
        const finalPlan: FeeTypeSchedulePlan = {
          ...updatedDraft,
          updatedAt: new Date().toISOString(),
          updatedBy: actorName,
        };
        const nextPlans = { ...savedPlans, [finalPlan.headKey]: finalPlan };
        const nextCampaigns = syncCampaignsWithPlan({
          existingCampaigns: campaigns,
          schoolId,
          plan: finalPlan,
          sessionId,
          actorName,
        });
        await updateSchool(schoolId, {
          feeTypeSchedulePlans: nextPlans,
          feeTermCampaigns: nextCampaigns,
        });
        setSavedPlans(nextPlans);
        setCampaigns(nextCampaigns);
        onCampaignsUpdated(nextCampaigns);
        if (onPlansUpdated) onPlansUpdated(nextPlans, nextCampaigns);
        window.dispatchEvent(
          new CustomEvent("school-profile-updated", {
            detail: {
              schoolId,
              data: {
                feeTypeSchedulePlans: nextPlans,
                feeTermCampaigns: nextCampaigns,
              },
            },
          })
        );
        setFeedbackMsg(
          nextEnabled
            ? `▶️ "${finalPlan.headLabel}" नियम अब चालू (Active) है।`
            : `⏸️ "${finalPlan.headLabel}" नियम रोका गया (Paused)।`
        );
      } catch (err: any) {
        setErrorMsg(err?.message || "Status update failed.");
      } finally {
        setSavingPlan(false);
      }
    }
  };

  const handleDeletePlan = async (targetHeadKey: string) => {
    setSavingPlan(true);
    setErrorMsg(null);
    try {
      const nextPlans = { ...savedPlans };
      delete nextPlans[targetHeadKey];
      const nextCampaigns = campaigns.filter(
        (c) => c.planId !== `plan_${targetHeadKey}` && c.headKey !== targetHeadKey
      );
      await updateSchool(schoolId, {
        feeTypeSchedulePlans: nextPlans,
        feeTermCampaigns: nextCampaigns,
      });
      setSavedPlans(nextPlans);
      setCampaigns(nextCampaigns);
      onCampaignsUpdated(nextCampaigns);
      if (onPlansUpdated) onPlansUpdated(nextPlans, nextCampaigns);
      window.dispatchEvent(
        new CustomEvent("school-profile-updated", {
          detail: {
            schoolId,
            data: {
              feeTypeSchedulePlans: nextPlans,
              feeTermCampaigns: nextCampaigns,
            },
          },
        })
      );

      if (targetHeadKey === activePageKey) {
        const meta = FEE_HEAD_OPTIONS.find((o) => o.key === targetHeadKey);
        setDraftPlan(
          createInitialPlanForHead({
            headKey: targetHeadKey,
            headLabel: meta?.label || targetHeadKey,
            currentMonth,
            classes: sortedClasses,
          })
        );
      }
      setFeedbackMsg("नियम हटाया गया (पहले से जमा रसीदें सुरक्षित हैं)।");
    } catch (err: any) {
      setErrorMsg(err?.message || "Delete failed.");
    } finally {
      setSavingPlan(false);
    }
  };

  // Single-student deferred helpers
  const filteredRegStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilterId !== "ALL" && s.classId !== classFilterId) return false;
      if (!q) return true;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.rollNo || "").toLowerCase().includes(q) ||
        (s.admissionNo || "").toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch, classFilterId]);

  const selectedStudentObj = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const selectedStudentClass = selectedStudentObj
    ? classMap.get(selectedStudentObj.classId)
    : undefined;

  const selectedStudentSettlement = useMemo(() => {
    if (!selectedStudentObj) return null;
    return computeStudentHeadSettlement({
      student: selectedStudentObj,
      classObj: selectedStudentClass,
      feeHistory,
    });
  }, [selectedStudentObj, selectedStudentClass, feeHistory]);

  const handleStuHeadChange = (nextKey: string) => {
    setStuHeadKey(nextKey);
    const opt = FEE_HEAD_OPTIONS.find((o) => o.key === nextKey);
    if (opt) setStuCustomDesc(opt.defaultTitle);
    const clsAmt = getConfiguredHeadAmountForClass(selectedStudentClass, nextKey);
    if (clsAmt > 0) setStuAmount(String(clsAmt));
  };

  const handleSaveStudentDeferredHead = async () => {
    if (!selectedStudentObj) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    const amt = Math.max(0, Math.round(Number(stuAmount) || 0));
    if (amt <= 0) {
      setErrorMsg("कृपया ₹0 से अधिक राशि दर्ज करें।");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(stuTargetMonth)) {
      setErrorMsg("सही महीना (YYYY-MM) चुनें।");
      return;
    }

    setSavingStudentDefer(true);
    try {
      const existing = Array.isArray(selectedStudentObj.deferredScheduledHeads)
        ? selectedStudentObj.deferredScheduledHeads
        : [];
      const newHead: DeferredScheduledFeeHead = {
        id: `def_${stuHeadKey}_${stuTargetMonth}_${Date.now().toString(36)}`,
        headKey: stuHeadKey,
        description: stuCustomDesc.trim() || stuHeadKey,
        amount: amt,
        targetMonth: stuTargetMonth,
        settled: false,
        paidAmount: 0,
      };
      const nextDeferred = [...existing, newHead];
      const nextSettled = { ...(selectedStudentObj.settledFeeHeads || {}) };
      const cap = getConfiguredHeadAmountForClass(selectedStudentClass, stuHeadKey);
      nextSettled[stuHeadKey] = {
        fullPaid: false,
        totalPaid: Number(nextSettled[stuHeadKey]?.totalPaid || 0),
        ...(cap > 0 ? { targetCap: cap } : {}),
        updatedAt: new Date().toISOString(),
      };

      const patch: Partial<SchoolStudent> = {
        deferredScheduledHeads: nextDeferred,
        settledFeeHeads: nextSettled,
      };
      await updateStudent(schoolId, selectedStudentObj.id, patch);
      onStudentDeferredUpdated(selectedStudentObj.id, patch);
      setFeedbackMsg(
        `✅ ${selectedStudentObj.name} के लिए "${newHead.description}" (₹${amt}) को ${formatMonthLabel(stuTargetMonth)} में जोड़ दिया गया है।`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "छात्र का शुल्क सेव करने में त्रुटि हुई।");
    } finally {
      setSavingStudentDefer(false);
    }
  };

  const handleRemoveStudentDeferredHead = async (defId: string) => {
    if (!selectedStudentObj) return;
    const nextDeferred = (selectedStudentObj.deferredScheduledHeads || []).filter(
      (d) => d.id !== defId
    );
    try {
      await updateStudent(schoolId, selectedStudentObj.id, { deferredScheduledHeads: nextDeferred });
      onStudentDeferredUpdated(selectedStudentObj.id, {
        deferredScheduledHeads: nextDeferred,
      });
      setFeedbackMsg("छात्र का निर्धारित शुल्क हटाया गया।");
    } catch (err: any) {
      setErrorMsg(err?.message || "Remove failed.");
    }
  };

  if (!isOpen) return null;

  const activeSavedCount = Object.values(savedPlans).filter((p) => p?.enabled).length;

  const workspaceBody = (
    <div
      className={
        asPage
          ? "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20"
          : "relative w-full max-w-5xl max-h-[93vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      }
    >
      {/* Top Sticky Header */}
      <div
        className={`${
          asPage ? "sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur" : "bg-slate-50 dark:bg-slate-950/60"
        } px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {asPage && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              aria-label="Back to Fee Ledger"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                Fee Types &amp; Term Planner (हर शुल्क का अलग पेज)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                {activeSavedCount} Rules Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              हर Fee Type का अलग पेज • Class-wise अलग दर, Term/किस्त, Month और Registration-Only Auto-Add सेव करें
            </p>
          </div>
        </div>

        {!asPage && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dedicated Page Tabs Bar for Every Fee Type */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-2.5 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {feeHeadPages.map((hp) => {
            const isSelected = activePageKey === hp.key;
            const saved = savedPlans[hp.key];
            const isLive = Boolean(saved?.enabled);
            return (
              <button
                key={hp.key}
                type="button"
                onClick={() => switchFeePage(hp.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                }`}
              >
                <span>{hp.label}</span>
                {isLive && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                      isSelected
                        ? "bg-white/25 text-white"
                        : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {saved.terms.filter((t) => t.active !== false).length}T
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => switchFeePage("__reg_students__")}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
              activePageKey === "__reg_students__"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:border-amber-400"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Reg-Only Students ({regOnlyAnalysis.regOnlyList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddCustomHead((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border border-dashed border-indigo-400 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Naya Fee Page</span>
          </button>
        </div>

        {showAddCustomHead && (
          <div className="max-w-5xl mx-auto mt-2.5 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newCustomHeadName}
              onChange={(e) => setNewCustomHeadName(e.target.value)}
              placeholder="Naya Fee Type likhein (e.g. Computer Fee, Practical, Tour Fee)..."
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleCreateCustomHeadPage}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
            >
              + Create Page
            </button>
            <button
              type="button"
              onClick={() => setShowAddCustomHead(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className={`${asPage ? "max-w-5xl mx-auto" : "overflow-y-auto flex-1"} p-4 sm:p-5 space-y-4`}>
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {feedbackMsg && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {activePageKey !== "__reg_students__" ? (
          /* ═══════════════════════════════════════════════════════════════
             DEDICATED FEE TYPE PAGE (e.g. Admission Fee / Exam Fee / Kit...)
             ═══════════════════════════════════════════════════════════════ */
          <div className="space-y-4">
            {/* Page Title + Status + Quick Save Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {draftPlan.headLabel} — Schedule Page
                  </h3>
                  {savedPlans[draftPlan.headKey]?.enabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Saved &amp; Auto-Applying
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                      Draft / Not Saved Yet
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  तय करें कि <strong>{draftPlan.headLabel}</strong> किस महीने, कितने Term में और किस कक्षा में कितना पैसा लगेगा — Save करने पर रजिस्ट्रेशन-ओनली/बकाया छात्रों में अपने आप जुड़ जाएगा।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {savedPlans[draftPlan.headKey] && (
                  <>
                    <button
                      type="button"
                      onClick={handleTogglePlanEnabled}
                      disabled={savingPlan}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        draftPlan.enabled
                          ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                      }`}
                    >
                      {draftPlan.enabled ? "Pause Rule" : "Resume Rule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(draftPlan.headKey)}
                      disabled={savingPlan}
                      className="p-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
                      title="Delete Saved Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveFeeTypePlan(true)}
                  disabled={savingPlan}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-black shadow-sm cursor-pointer active:scale-95"
                >
                  {savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Rule &amp; Auto-Apply</span>
                </button>
              </div>
            </div>

            {/* Step 1: Target Audience & Protection Guard */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Step 1 • किन छात्रों के बिल में जुड़ेगा? (Target Students)
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Full-Paid Exempt Always ON
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setDraftPlan((p) => ({ ...p, targetMode: "reg_only_or_unpaid" }))
                  }
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    draftPlan.targetMode === "reg_only_or_unpaid"
                      ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      सिर्फ Registration-Only / बाकी फीस वाले छात्र
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black tabular-nums">
                      {regOnlyAnalysis.regOnlyList.length} Students
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    जिन्होंने केवल Registration कराया है और बाकी फीस जमा नहीं की — उनके चुने हुए महीनों में अपने-आप जुड़ जाएगा। Full-Payment वाले छात्रों पर नहीं लगेगा।
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDraftPlan((p) => ({ ...p, targetMode: "all_except_full_paid" }))
                  }
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    draftPlan.targetMode === "all_except_full_paid"
                      ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      सभी सक्रिय छात्र (जिन्होंने यह शुल्क नहीं दिया)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 text-[10px] font-black tabular-nums">
                      {students.length} Total
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    2-Monthly Exam Fee या सभी छात्रों की किस्त के लिए — जिन्होंने Full Admission या यह शुल्क पहले से दे दिया है, उन पर ₹0 रहेगा।
                  </p>
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={draftPlan.respectHeadCap}
                  onChange={(e) =>
                    setDraftPlan((p) => ({ ...p, respectHeadCap: e.target.checked }))
                  }
                  className="rounded accent-indigo-600"
                />
                <span>
                  Class Full Rate Cap सुरक्षित रखें (यदि छात्र ने पहले कुछ राशि दे दी है, तो कुल दर से अधिक कभी न जुड़े)
                </span>
              </label>
            </div>

            {/* Step 2: Number of Terms & Months */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Step 2 • कितने Term (किस्तें) व किस Month में माँगा जाएगा?
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {[1, 2, 3, 4, 5, 6].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleTermCountChange(cnt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                        draftPlan.terms.length === cnt
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {cnt} {cnt === 1 ? "Term" : "Terms"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {draftPlan.terms.map((term, idx) => (
                  <div
                    key={term.id}
                    className={`rounded-xl border p-3 space-y-2 transition ${
                      term.active !== false
                        ? "border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40"
                        : "border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                        Term {idx + 1}
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={term.active !== false}
                          onChange={(e) =>
                            handleUpdateTermField(idx, { active: e.target.checked })
                          }
                          className="rounded accent-indigo-600"
                        />
                        <span>Active</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Term Title (रसीद नाम)
                        </label>
                        <input
                          type="text"
                          value={term.title}
                          onChange={(e) =>
                            handleUpdateTermField(idx, { title: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Kis Month Me Add Hoga
                        </label>
                        <input
                          type="month"
                          value={term.targetMonth}
                          onChange={(e) =>
                            handleUpdateTermField(idx, { targetMonth: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                        />
                      </div>
                    </div>

                    {/* Quick All-Class Fill */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        type="number"
                        min={0}
                        placeholder={`Sabhi classes me ₹... (Term ${idx + 1})`}
                        value={quickFillAmounts[term.id] ?? ""}
                        onChange={(e) =>
                          setQuickFillAmounts((prev) => ({
                            ...prev,
                            [term.id]: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyUniformToTerm(idx)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-indigo-600 text-white text-[11px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        All Class Fill
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Class-Wise Fee Table (Every class can have a different rate!) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/40">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    Step 3 • Class-Wise Per Term Fee (हर कक्षा का अलग-अलग शुल्क सेट करें)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    हर कक्षा के सामने प्रत्येक Term की राशि लिखें (₹0 रखने पर उस कक्षा में वह Term नहीं जुड़ेगा)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoSplitFromClassStructure}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer active:scale-95"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Split Class Rate ÷ {draftPlan.terms.length}</span>
                </button>
              </div>

              {sortedClasses.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  कोई कक्षा नहीं मिली। पहले Classes बनाएं।
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3 whitespace-nowrap">Class</th>
                        <th className="py-2.5 px-2.5 whitespace-nowrap">Std Rate</th>
                        <th className="py-2.5 px-2.5 whitespace-nowrap">Reg-Only</th>
                        {draftPlan.terms.map((t, tIdx) => (
                          <th key={t.id} className="py-2.5 px-2.5 whitespace-nowrap min-w-[110px]">
                            <div>Term {tIdx + 1} (₹)</div>
                            <div className="text-[10px] font-normal text-slate-400">
                              {/^\d{4}-\d{2}$/.test(t.targetMonth)
                                ? formatMonthLabel(t.targetMonth)
                                : t.targetMonth}
                            </div>
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Plan Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedClasses.map((cls) => {
                        const stdRate = getConfiguredHeadAmountForClass(cls, draftPlan.headKey);
                        const regCnt = regOnlyAnalysis.byClassCount.get(cls.id) || 0;
                        const rowTotal = draftPlan.terms
                          .filter((t) => t.active !== false)
                          .reduce(
                            (sum, t) =>
                              sum +
                              Math.max(
                                0,
                                Math.round(
                                  Number(t.classAmounts?.[cls.id] ?? t.defaultAmount ?? 0)
                                )
                              ),
                            0
                          );
                        return (
                          <tr
                            key={cls.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-2 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {cls.name}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {stdRate > 0 ? `₹${stdRate.toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                                  regCnt > 0
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                }`}
                              >
                                {regCnt}
                              </span>
                            </td>
                            {draftPlan.terms.map((t, tIdx) => {
                              const cellVal =
                                t.classAmounts &&
                                Object.prototype.hasOwnProperty.call(t.classAmounts, cls.id)
                                  ? t.classAmounts[cls.id]
                                  : t.defaultAmount ?? 0;
                              return (
                                <td key={t.id} className="py-1.5 px-2">
                                  <input
                                    type="number"
                                    min={0}
                                    disabled={t.active === false}
                                    value={cellVal}
                                    onChange={(e) =>
                                      handleUpdateClassTermAmount(tIdx, cls.id, e.target.value)
                                    }
                                    className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                  />
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-mono font-black text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                              ₹{rowTotal.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Step 4: Live Impact Preview */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/25 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Live Impact Preview (लागू होने से पहले पूरा हिसाब)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImpactDetails((v) => !v)}
                  className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 underline cursor-pointer"
                >
                  {showImpactDetails ? "Class Breakdown छुपाएं" : "Class-Wise Breakdown देखें"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-indigo-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Billed Students</div>
                  <div className="text-base sm:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {planPreview.billedStudentCount}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-emerald-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Full-Paid Exempt</div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {planPreview.exemptStudentCount} (₹0)
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-indigo-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total Scheduled</div>
                  <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                    ₹{planPreview.totalExpectedAmount.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {planPreview.termSummaries.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {planPreview.termSummaries.map((ts) => (
                    <div
                      key={ts.termId}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 text-[11px]"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {formatMonthLabel(ts.targetMonth)}:
                      </span>{" "}
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {ts.billedCount} छात्रों पर ₹{ts.totalAmount.toLocaleString("en-IN")}
                      </span>{" "}
                      <span className="text-slate-400">({ts.exemptedCount} Exempt)</span>
                    </div>
                  ))}
                </div>
              )}

              {showImpactDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {planPreview.classBreakdown.map((cb) => (
                    <div
                      key={cb.classId}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-[11px]"
                    >
                      <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{cb.className}</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400">
                          ₹{cb.perStudentPlanTotal}/stu
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-between">
                        <span>Billed: {cb.billedStudents}/{cb.totalStudents}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          ₹{cb.classTotalExpected.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar on Mobile */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Save करते ही इन महीनों में खुलने वाले Fee Ledger, Demand Slip व Online Payment में ये शुल्क अपने-आप जुड़ जाएंगे।
              </div>
              <button
                type="button"
                onClick={() => handleSaveFeeTypePlan(true)}
                disabled={savingPlan}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs sm:text-sm font-black shadow-md cursor-pointer active:scale-95"
              >
                {savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save {draftPlan.headLabel} Schedule &amp; Apply</span>
              </button>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════
             REGISTRATION-ONLY STUDENTS & INDIVIDUAL MONTH OVERRIDE PAGE
             ═══════════════════════════════════════════════════════════════ */
          <div className="space-y-4">
            {/* Summary Banner of All Saved Auto-Applied Plans */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>Registration-Only व Pending Fee छात्रों पर लागू Saved Rules</span>
                </h3>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  {regOnlyAnalysis.regOnlyList.length} Reg-Only / Partial Students
                </span>
              </div>

              {activeSavedCount === 0 ? (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
                  अभी कोई Fee Type Schedule सेव नहीं है। ऊपर किसी भी शुल्क पेज (जैसे <strong>Admission Fee</strong>, <strong>Exam Fee</strong>, <strong>Kit</strong>) पर जाकर Term, Month और Class-Wise दर Save करें — उसके बाद वह सभी Registration-Only छात्रों पर अपने-आप लागू हो जाएगा।
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.values(savedPlans)
                    .filter((p) => p?.enabled)
                    .map((p) => (
                      <button
                        key={p.headKey}
                        type="button"
                        onClick={() => switchFeePage(p.headKey)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-left text-[11px] hover:border-indigo-400 cursor-pointer"
                      >
                        <div className="font-bold text-indigo-800 dark:text-indigo-200">
                          {p.headLabel} ({p.terms.filter((t) => t.active !== false).length} Terms)
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {p.terms
                            .filter((t) => t.active !== false)
                            .map((t) => formatMonthLabel(t.targetMonth))
                            .join(" • ")}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Individual Student Selector & Custom Month Defer */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                किसी 1 छात्र की बाकी फीस देखें या अलग महीने में जोड़ें
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="छात्र का नाम, Roll No या Admission No खोजें..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </div>
                <select
                  value={classFilterId}
                  onChange={(e) => setClassFilterId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="ALL">All Classes ({students.length})</option>
                  {sortedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({regOnlyAnalysis.byClassCount.get(c.id) || 0} Reg-Only)
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
              >
                {filteredRegStudents.length === 0 ? (
                  <option value="">कोई छात्र नहीं मिला</option>
                ) : (
                  filteredRegStudents.map((st) => {
                    const cName = classMap.get(st.classId)?.name || "";
                    const planTag =
                      st.admissionPaymentPlan === "registration_only"
                        ? "Reg-Only"
                        : st.admissionPaymentPlan === "half_payment"
                          ? "Half-Paid"
                          : st.admissionPaymentPlan === "full_payment"
                            ? "Full-Paid"
                            : "Standard";
                    return (
                      <option key={st.id} value={st.id}>
                        {st.name} • {cName} (Roll {st.rollNo}) — [{planTag}]
                        {Number(st.admissionDueBalance || 0) > 0
                          ? ` • Adm Due ₹${st.admissionDueBalance}`
                          : ""}
                      </option>
                    );
                  })
                )}
              </select>

              {selectedStudentObj && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-black text-slate-900 dark:text-white">
                        {selectedStudentObj.name}
                      </span>{" "}
                      <span className="text-slate-500">
                        ({selectedStudentClass?.name || "Class"} • Roll {selectedStudentObj.rollNo})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStudentSettlement?.isFullAdmissionPackagePaid ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                          100% Full Paid (Exempt)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Pending / Registration-Only Eligible
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Single-Student Custom Month Add Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      value={stuHeadKey}
                      onChange={(e) => handleStuHeadChange(e.target.value)}
                      className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                    >
                      {FEE_HEAD_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={stuCustomDesc}
                      onChange={(e) => setStuCustomDesc(e.target.value)}
                      placeholder="Fee Description"
                      className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                    />
                    <input
                      type="number"
                      min={1}
                      value={stuAmount}
                      onChange={(e) => setStuAmount(e.target.value)}
                      placeholder="Amount ₹"
                      className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono font-bold"
                    />
                    <input
                      type="month"
                      value={stuTargetMonth}
                      onChange={(e) => setStuTargetMonth(e.target.value)}
                      className="px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveStudentDeferredHead}
                      disabled={savingStudentDefer}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer active:scale-95"
                    >
                      {savingStudentDefer ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>इस छात्र के इस महीने में जोड़ें</span>
                    </button>
                  </div>

                  {Array.isArray(selectedStudentObj.deferredScheduledHeads) &&
                    selectedStudentObj.deferredScheduledHeads.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          इस छात्र के लिए अलग से निर्धारित शुल्क:
                        </div>
                        {selectedStudentObj.deferredScheduledHeads.map((dh) => (
                          <div
                            key={dh.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {dh.description}
                              </span>{" "}
                              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                ₹{dh.amount}
                              </span>{" "}
                              <span className="text-slate-500">• {formatMonthLabel(dh.targetMonth)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  dh.settled
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {dh.settled ? "Paid" : "Pending"}
                              </span>
                              {!dh.settled && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStudentDeferredHead(dh.id)}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (asPage) {
    return workspaceBody;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {workspaceBody}
    </div>
  );
};
