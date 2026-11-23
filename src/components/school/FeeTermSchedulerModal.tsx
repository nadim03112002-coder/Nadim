import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  CalendarClock,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Users,
  Search,
  Loader2,
} from "lucide-react";
import type {
  DeferredScheduledFeeHead,
  FeeTermCampaign,
  MonthlyFee,
  School,
  SchoolClass,
  SchoolStudent,
} from "../../school-types";
import { updateSchool, updateStudent } from "../../school-firebase";
import {
  FEE_HEAD_OPTIONS,
  computeStudentHeadSettlement,
  getConfiguredHeadAmountForClass,
  previewCampaignImpact,
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
  onCampaignsUpdated: (nextCampaigns: FeeTermCampaign[]) => void;
  onStudentDeferredUpdated: (studentId: string, patch: Partial<SchoolStudent>) => void;
}

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
  onCampaignsUpdated,
  onStudentDeferredUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"campaign" | "student_defer">("campaign");

  // ── Tab 1: Campaign Form State ──
  const [headKey, setHeadKey] = useState<string>("exam");
  const [title, setTitle] = useState<string>("2-Monthly Exam Fee (Term 1)");
  const [amountInput, setAmountInput] = useState<string>("250");
  const [targetMonth, setTargetMonth] = useState<string>(currentMonth);
  const [scopeAllClasses, setScopeAllClasses] = useState<boolean>(!initialClassId);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    initialClassId ? [initialClassId] : []
  );
  const [skipFullPaidStudents, setSkipFullPaidStudents] = useState<boolean>(true);
  const [skipSettledHeadStudents, setSkipSettledHeadStudents] = useState<boolean>(true);
  const [respectHeadCap, setRespectHeadCap] = useState<boolean>(true);
  const [onlyPartialOrRegStudents, setOnlyPartialOrRegStudents] = useState<boolean>(false);
  const [showImpactDetails, setShowImpactDetails] = useState<boolean>(false);
  const [savingCampaign, setSavingCampaign] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<FeeTermCampaign[]>(
    () => school?.feeTermCampaigns || []
  );

  // ── Tab 2: Student Individual Month Assigner State ──
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [stuHeadKey, setStuHeadKey] = useState<string>("admission");
  const [stuCustomDesc, setStuCustomDesc] = useState<string>("Admission Fee Balance");
  const [stuAmount, setStuAmount] = useState<string>("500");
  const [stuTargetMonth, setStuTargetMonth] = useState<string>(currentMonth);
  const [savingStudentDefer, setSavingStudentDefer] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setCampaigns(school?.feeTermCampaigns || []);
    setTargetMonth(currentMonth);
    setStuTargetMonth(currentMonth);
    setFeedbackMsg(null);
    setErrorMsg(null);
    if (initialClassId) {
      setScopeAllClasses(false);
      setSelectedClassIds([initialClassId]);
    } else {
      setScopeAllClasses(true);
    }
    if (!selectedStudentId && students.length > 0) {
      const regFirst = students.find(
        (s) =>
          s.admissionPaymentPlan === "registration_only" ||
          s.admissionPaymentPlan === "half_payment" ||
          Number(s.admissionDueBalance || 0) > 0
      );
      setSelectedStudentId((regFirst || students[0]).id);
    }
  }, [isOpen, school?.feeTermCampaigns, currentMonth, initialClassId]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // Reference class rate for chosen headKey
  const referenceRateInfo = useMemo(() => {
    const scopeClasses = scopeAllClasses
      ? classes
      : classes.filter((c) => selectedClassIds.includes(c.id));
    const rates = scopeClasses
      .map((c) => getConfiguredHeadAmountForClass(c, headKey))
      .filter((n) => n > 0);
    if (rates.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...rates), max: Math.max(...rates) };
  }, [classes, scopeAllClasses, selectedClassIds, headKey]);

  const draftCampaign = useMemo<FeeTermCampaign>(
    () => ({
      id: "draft_preview",
      schoolId,
      sessionId,
      title: title.trim() || "Term Fee",
      headKey,
      amount: Math.max(0, Math.round(Number(amountInput) || 0)),
      targetMonth: targetMonth || currentMonth,
      classIds: scopeAllClasses ? "ALL" : selectedClassIds,
      skipFullPaidStudents,
      skipSettledHeadStudents,
      respectHeadCap,
      onlyPartialOrRegStudents,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: actorName,
    }),
    [
      schoolId,
      sessionId,
      title,
      headKey,
      amountInput,
      targetMonth,
      currentMonth,
      scopeAllClasses,
      selectedClassIds,
      skipFullPaidStudents,
      skipSettledHeadStudents,
      respectHeadCap,
      onlyPartialOrRegStudents,
      actorName,
    ]
  );

  const impactPreview = useMemo(
    () =>
      previewCampaignImpact({
        campaign: draftCampaign,
        students,
        classes,
        feeHistory,
      }),
    [draftCampaign, students, classes, feeHistory]
  );

  const handleHeadKeyChange = (nextKey: string) => {
    setHeadKey(nextKey);
    const opt = FEE_HEAD_OPTIONS.find((o) => o.key === nextKey);
    const existingCount = campaigns.filter((c) => c.headKey === nextKey).length;
    if (opt) {
      setTitle(
        nextKey === "exam"
          ? `Exam Fee (Term ${existingCount + 1})`
          : opt.defaultTitle
      );
    }
    const sampleClass =
      (!scopeAllClasses && selectedClassIds[0] && classMap.get(selectedClassIds[0])) ||
      classes[0];
    const stdAmt = getConfiguredHeadAmountForClass(sampleClass, nextKey);
    if (stdAmt > 0) {
      setAmountInput(nextKey === "exam" && stdAmt >= 500 ? String(Math.round(stdAmt / 2)) : String(stdAmt));
    }
  };

  const handleSaveCampaign = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    const amt = Math.max(0, Math.round(Number(amountInput) || 0));
    if (!title.trim()) {
      setErrorMsg("कृपया Term Fee का नाम (Title) दर्ज करें।");
      return;
    }
    if (amt <= 0) {
      setErrorMsg("कृपया ₹0 से अधिक राशि दर्ज करें।");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      setErrorMsg("कृपया सही महीना (YYYY-MM) चुनें।");
      return;
    }
    if (!scopeAllClasses && selectedClassIds.length === 0) {
      setErrorMsg("कृपया कम से कम एक Class चुनें या 'All Classes' चुनें।");
      return;
    }

    setSavingCampaign(true);
    try {
      const newCampaign: FeeTermCampaign = {
        ...draftCampaign,
        id: `camp_${headKey}_${Date.now().toString(36)}`,
        amount: amt,
        createdAt: new Date().toISOString(),
      };
      const nextCampaigns = [newCampaign, ...campaigns];
      await updateSchool(schoolId, { feeTermCampaigns: nextCampaigns });
      setCampaigns(nextCampaigns);
      onCampaignsUpdated(nextCampaigns);
      setFeedbackMsg(
        `✅ "${newCampaign.title}" (${formatMonthLabel(newCampaign.targetMonth)}) लागू हो गया — ${impactPreview.billedCount} छात्रों के बिल में ₹${amt} जुड़ा और ${impactPreview.exemptedCount} Full-Paid छात्र सुरक्षित (₹0) रहे।`
      );
      if (headKey === "exam") {
        setTitle(`Exam Fee (Term ${nextCampaigns.filter((c) => c.headKey === "exam").length + 1})`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Term Fee सेव करने में समस्या आई।");
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleToggleCampaignActive = async (campId: string) => {
    const nextCampaigns = campaigns.map((c) =>
      c.id === campId ? { ...c, active: c.active === false } : c
    );
    setCampaigns(nextCampaigns);
    try {
      await updateSchool(schoolId, { feeTermCampaigns: nextCampaigns });
      onCampaignsUpdated(nextCampaigns);
    } catch (err: any) {
      setErrorMsg(err?.message || "Update failed.");
    }
  };

  const handleDeleteCampaign = async (campId: string) => {
    const nextCampaigns = campaigns.filter((c) => c.id !== campId);
    setCampaigns(nextCampaigns);
    try {
      await updateSchool(schoolId, { feeTermCampaigns: nextCampaigns });
      onCampaignsUpdated(nextCampaigns);
      setFeedbackMsg("Term Fee हटाया गया (पहले से जमा हो चुकी रसीदें सुरक्षित हैं)।");
    } catch (err: any) {
      setErrorMsg(err?.message || "Delete failed.");
    }
  };

  // Tab 2 helpers
  const filteredStudentsForDefer = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = q
      ? students.filter(
          (s) =>
            (s.name || "").toLowerCase().includes(q) ||
            (s.rollNo || "").toLowerCase().includes(q) ||
            (s.admissionNo || "").toLowerCase().includes(q)
        )
      : students;
    return list.slice(0, 60);
  }, [students, studentSearch]);

  const activeDeferStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const activeStudentSettlement = useMemo(() => {
    if (!activeDeferStudent) return null;
    return computeStudentHeadSettlement({
      student: activeDeferStudent,
      classObj: classMap.get(activeDeferStudent.classId),
      feeHistory,
    });
  }, [activeDeferStudent, classMap, feeHistory]);

  const handleSelectStudentHeadPreset = (key: string) => {
    setStuHeadKey(key);
    const opt = FEE_HEAD_OPTIONS.find((o) => o.key === key);
    setStuCustomDesc(opt ? opt.label : "Custom Fee");
    if (activeDeferStudent) {
      const cls = classMap.get(activeDeferStudent.classId);
      const stdAmt = getConfiguredHeadAmountForClass(cls, key);
      if (stdAmt > 0) setStuAmount(String(stdAmt));
    }
  };

  const handleAssignStudentMonthFee = async () => {
    if (!activeDeferStudent) {
      setErrorMsg("कृपया पहले एक छात्र चुनें।");
      return;
    }
    const amt = Math.max(0, Math.round(Number(stuAmount) || 0));
    if (!stuCustomDesc.trim() || amt <= 0) {
      setErrorMsg("कृपया शुल्क का नाम और ₹0 से अधिक राशि दर्ज करें।");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(stuTargetMonth)) {
      setErrorMsg("कृपया सही Target Month चुनें।");
      return;
    }

    setSavingStudentDefer(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const newHead: DeferredScheduledFeeHead = {
        id: `stu_def_${stuHeadKey}_${stuTargetMonth}_${Date.now().toString(36)}`,
        headKey: stuHeadKey,
        description: stuCustomDesc.trim(),
        amount: amt,
        targetMonth: stuTargetMonth,
        settled: false,
        paidAmount: 0,
      };
      const nextList = [...(activeDeferStudent.deferredScheduledHeads || []), newHead];
      await updateStudent(schoolId, activeDeferStudent.id, {
        deferredScheduledHeads: nextList,
      });
      onStudentDeferredUpdated(activeDeferStudent.id, {
        deferredScheduledHeads: nextList,
      });
      setFeedbackMsg(
        `✅ ${activeDeferStudent.name} के ${formatMonthLabel(stuTargetMonth)} बिल में "${newHead.description}" (₹${amt.toLocaleString("en-IN")}) जोड़ दिया गया!`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "छात्र का मासिक शुल्क जोड़ने में समस्या आई।");
    } finally {
      setSavingStudentDefer(false);
    }
  };

  const handleRemoveStudentDeferredHead = async (headId: string) => {
    if (!activeDeferStudent) return;
    const nextList = (activeDeferStudent.deferredScheduledHeads || []).filter(
      (h) => h.id !== headId
    );
    try {
      await updateStudent(schoolId, activeDeferStudent.id, {
        deferredScheduledHeads: nextList,
      });
      onStudentDeferredUpdated(activeDeferStudent.id, {
        deferredScheduledHeads: nextList,
      });
      setFeedbackMsg("चयनित छात्र शुल्क हटाया गया।");
    } catch (err: any) {
      setErrorMsg(err?.message || "हटाने में समस्या आई।");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Term / Exam Fee &amp; Month-Wise Head Scheduler
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                कम Price में बार-बार Exam / Admission / Custom Term लागू करें — Full-Paid छात्र स्वतः सुरक्षित रहेंगे
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab("campaign");
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                activeTab === "campaign"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              1. Multi-Term Exam / Class Fee Launcher
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("student_defer");
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                activeTab === "student_defer"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              2. Single Student (Reg-Only → Month Add)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {activeTab === "campaign" ? (
            <>
              {/* Create Campaign Form */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    नया Term Fee / Exam Fee लागू करें
                  </h4>
                  {referenceRateInfo.max > 0 && (
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Class Full Rate:{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {referenceRateInfo.min === referenceRateInfo.max
                          ? `₹${referenceRateInfo.max}`
                          : `₹${referenceRateInfo.min}–₹${referenceRateInfo.max}`}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Fee Head चुनें
                    </label>
                    <select
                      value={headKey}
                      onChange={(e) => handleHeadKeyChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {FEE_HEAD_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.hindiLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Term / Receipt Line Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 2-Monthly Exam Fee (Term 1)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      लागू करने की राशि / Price (₹) — कम या ज्यादा रखें
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      किस महीने के बिल में जुड़ेगा (Target Month)
                    </label>
                    <input
                      type="month"
                      value={targetMonth}
                      onChange={(e) => setTargetMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Class Scope */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Classes (किन कक्षाओं पर लागू होगा)
                    </span>
                    <button
                      type="button"
                      onClick={() => setScopeAllClasses((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                        scopeAllClasses
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {scopeAllClasses ? "✓ All Classes Selected" : "Select All Classes"}
                    </button>
                  </div>

                  {!scopeAllClasses && (
                    <div className="flex flex-wrap gap-1.5">
                      {classes.map((cls) => {
                        const checked = selectedClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() =>
                              setSelectedClassIds((prev) =>
                                checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                              checked
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {cls.name}
                            {cls.section ? ` (${cls.section})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Full Payment Protection Guards */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/25 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Full-Payment Protection Guard (दोहरे शुल्क से सुरक्षा)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={skipFullPaidStudents}
                        onChange={(e) => setSkipFullPaidStudents(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                      />
                      <span>Full-Payment छात्रों पर लागू न करें (Exempt 100% Paid)</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={skipSettledHeadStudents}
                        onChange={(e) => setSkipSettledHeadStudents(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                      />
                      <span>जो यह Fee Head पहले पूरा दे चुके हैं उन्हें छोड़ें</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={respectHeadCap}
                        onChange={(e) => setRespectHeadCap(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                      />
                      <span>Class Cap Limit रखें (अधिकतम तय राशि से ऊपर न जाए)</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={onlyPartialOrRegStudents}
                        onChange={(e) => setOnlyPartialOrRegStudents(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                      />
                      <span>केवल Registration-Only / Partial छात्रों पर लगाएं</span>
                    </label>
                  </div>
                </div>

                {/* Live Impact Summary */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        Scope: <strong>{impactPreview.totalInScope}</strong> students
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Billed: {impactPreview.billedCount} (₹
                        {impactPreview.totalBillableAmount.toLocaleString("en-IN")})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Exempted (Full Paid): {impactPreview.exemptedCount}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowImpactDetails((p) => !p)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {showImpactDetails ? "Hide List" : "Check Names"}
                    </button>
                  </div>

                  {showImpactDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <div>
                        <p className="font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                          Will Be Billed ({impactPreview.billedCount}):
                        </p>
                        {impactPreview.billedSamples.length === 0 ? (
                          <p className="text-slate-400">कोई छात्र नहीं</p>
                        ) : (
                          <ul className="space-y-0.5 text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                            {impactPreview.billedSamples.map((s, idx) => (
                              <li key={idx}>
                                #{s.rollNo} {s.name} — ₹{s.amount}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                          Exempted / Protected ({impactPreview.exemptedCount}):
                        </p>
                        {impactPreview.exemptedSamples.length === 0 ? (
                          <p className="text-slate-400">कोई छात्र नहीं</p>
                        ) : (
                          <ul className="space-y-0.5 text-slate-600 dark:text-slate-300">
                            {impactPreview.exemptedSamples.map((s, idx) => (
                              <li key={idx}>
                                #{s.rollNo} {s.name} ({s.reason})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={savingCampaign}
                  onClick={handleSaveCampaign}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {savingCampaign ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>
                    Save &amp; Apply Term Fee for {formatMonthLabel(targetMonth)}
                  </span>
                </button>
              </div>

              {/* Active Campaigns History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Launched Term Campaigns ({campaigns.length})
                </h4>
                {campaigns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-5 text-center text-xs text-slate-400">
                    अभी तक कोई Term Fee Campaign लागू नहीं किया गया है। ऊपर से नया Term Fee बनाएं।
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    {campaigns.map((camp) => (
                      <div
                        key={camp.id}
                        className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {camp.title}
                            </span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                              ₹{Number(camp.amount).toLocaleString("en-IN")}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              · {formatMonthLabel(camp.targetMonth)}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                camp.active !== false ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              · {camp.active !== false ? "Active" : "Paused"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Scope:{" "}
                            {camp.classIds === "ALL"
                              ? "All Classes"
                              : `${camp.classIds.length} Class(es)`}{" "}
                            · Guard: {camp.skipFullPaidStudents ? "Skip Full-Paid ✓" : "All"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCampaignActive(camp.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            {camp.active !== false ? (
                              <>
                                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Resume</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(camp.id)}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 cursor-pointer"
                            title="Delete campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Tab 2: Single Student Month-Wise Defer / Add */
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    छात्र खोजें और चुनें (Registration-Only / Partial छात्रों को प्राथमिकता)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="नाम, रोल नंबर या Adm No..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {filteredStudentsForDefer.map((st) => (
                        <option key={st.id} value={st.id}>
                          #{st.rollNo} {st.name}
                          {st.admissionPaymentPlan === "registration_only"
                            ? " (Reg Only)"
                            : st.admissionPaymentPlan === "full_payment"
                            ? " (Full Paid)"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {activeDeferStudent && activeStudentSettlement && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          {activeDeferStudent.name}
                        </span>
                        <span className="text-slate-500">
                          · {classMap.get(activeDeferStudent.classId)?.name || activeDeferStudent.className}
                        </span>
                      </div>
                      <span
                        className={`font-semibold ${
                          activeStudentSettlement.isFullAdmissionPackagePaid
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {activeStudentSettlement.isFullAdmissionPackagePaid
                          ? "Full-Payment Admission ✓"
                          : activeDeferStudent.admissionPaymentPlan === "registration_only"
                          ? "Registration Only"
                          : "Partial / Standard"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {["registration", "admission", "exam", "kit", "development", "annual"].map((k) => {
                        const rec = activeStudentSettlement.settledByHead[k];
                        return (
                          <span key={k} className="font-mono">
                            {k}:{" "}
                            <strong
                              className={
                                rec?.fullPaid ? "text-emerald-600" : "text-slate-700 dark:text-slate-200"
                              }
                            >
                              {rec?.fullPaid ? "Full ✓" : `₹${rec?.totalPaid || 0}`}
                            </strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Fee Head चुनें
                    </label>
                    <select
                      value={stuHeadKey}
                      onChange={(e) => handleSelectStudentHeadPreset(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {FEE_HEAD_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.hindiLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Receipt Line Description
                    </label>
                    <input
                      type="text"
                      value={stuCustomDesc}
                      onChange={(e) => setStuCustomDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      राशि (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={stuAmount}
                      onChange={(e) => setStuAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      किस महीने के बिल में जुड़ेगा
                    </label>
                    <input
                      type="month"
                      value={stuTargetMonth}
                      onChange={(e) => setStuTargetMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingStudentDefer || !activeDeferStudent}
                  onClick={handleAssignStudentMonthFee}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {savingStudentDefer ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>
                    Assign to {activeDeferStudent?.name || "Student"} ({formatMonthLabel(stuTargetMonth)})
                  </span>
                </button>
              </div>

              {activeDeferStudent &&
                Array.isArray(activeDeferStudent.deferredScheduledHeads) &&
                activeDeferStudent.deferredScheduledHeads.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Scheduled Month Heads for {activeDeferStudent.name}
                    </h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      {activeDeferStudent.deferredScheduledHeads.map((dh) => (
                        <div
                          key={dh.id}
                          className="p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {dh.description}
                            </span>
                            <span className="ml-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              ₹{Number(dh.amount).toLocaleString("en-IN")}
                            </span>
                            <span className="ml-2 text-slate-500">
                              · {formatMonthLabel(dh.targetMonth)}
                            </span>
                            <span
                              className={`ml-2 font-semibold ${
                                dh.settled ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              · {dh.settled ? "Paid ✓" : "Pending"}
                            </span>
                          </div>
                          {!dh.settled && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentDeferredHead(dh.id)}
                              className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Remove scheduled fee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
