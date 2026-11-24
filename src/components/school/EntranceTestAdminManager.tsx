import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BadgePercent,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  Power,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Type,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ALL_ENTRANCE_CLASSES,
  formatEntranceClassLabel,
  hasEntranceExamAccess,
  isEntranceExamFeatureEnabled,
  type EntranceClassNumber,
  type EntranceDiscountConfig,
  type EntranceDiscountSlab,
  type EntranceTestAttempt,
  type EntranceTestQuestion,
  type EntranceTestQuestionFormat,
  type EntranceTestSubject,
  type ExamCategoryType,
  type School,
} from "../../school-types";
import { generateId, updateSchool } from "../../school-firebase";
import {
  DEFAULT_SAMPLE_ENTRANCE_SLABS,
  EntranceEvaluationTier,
  FORMAT_DISPLAY_LABEL,
  MAX_FREE_ATTEMPTS_PER_CLASS,
  TOTAL_PAPER_SETS,
  calculateEntranceScoreDiscount,
  deleteCustomEntranceQuestion,
  evaluateEntranceScore,
  formatSetId,
  generateEntrancePaperSet,
  generateMixedOfflinePaperSet,
  getClassTestBlueprint,
  getCustomEntranceQuestions,
  getEntranceTestAttempts,
  normalizeEntranceDiscountConfig,
  saveCustomEntranceQuestion,
} from "../../utils/entranceTestEngine";
import {
  getCuratedQuestionsForClass,
  getEntranceBankStats,
  getSubjectiveBankStats,
  getSubjectiveQuestionsForClass,
  getTotalCuratedBankCount,
  getTotalSubjectiveBankCount,
} from "../../data/entranceTestQuestionBank";
import {
  CustomPaperBuilderWorkspace,
  type CustomBuilderPresetPayload,
} from "./CustomPaperBuilderWorkspace";
import { AdminQuestionPaperLibrary } from "./AdminQuestionPaperLibrary";
import {
  BulkQuestionUploadModal,
  EXAM_CATEGORY_OPTIONS,
} from "./BulkQuestionUploadModal";
import { PrePrimaryScreeningPanel } from "./PrePrimaryScreeningPanel";
import {
  buildCustomPaperHtmlBundle,
  buildStandardPaperHtmlBundle,
  downloadCustomEntrancePaperPdf,
  downloadEntrancePaperPdf,
  estimateCustomPaperLayout,
} from "../../utils/entrancePaperPdf";
import { mountAndPrintA4Sync } from "../../utils/a4PrintHelper";
import { A4PrintPreviewOverlay } from "./A4PrintPreviewOverlay";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";

interface Props {
  school: School;
  isElite?: boolean;
  mode?: "hub" | "library_only";
  initialTab?: "leads" | "discounts" | "pre_primary" | "papers" | "builder" | "library" | "bank" | "custom";
  externalBuilderPreset?: CustomBuilderPresetPayload | null;
  onOpenBuilderFromLibrary?: (preset?: CustomBuilderPresetPayload) => void;
  onUpgradePlan?: () => void;
  onBack?: () => void;
  onConvertLeadToAdmission?: (attempt: EntranceTestAttempt) => void;
  onSchoolUpdated?: (updated: School) => void;
}

const CLASSES: EntranceClassNumber[] = ALL_ENTRANCE_CLASSES;
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const FORMAT_OPTIONS: EntranceTestQuestionFormat[] = [
  "MCQ",
  "FILL_BLANK",
  "ODD_ONE_OUT",
  "TRUE_FALSE",
  "SERIES_PUZZLE",
  "MINI_PASSAGE",
];

export const EntranceTestAdminManager: React.FC<Props> = ({
  school,
  isElite,
  mode = "hub",
  initialTab,
  externalBuilderPreset = null,
  onOpenBuilderFromLibrary,
  onUpgradePlan,
  onBack,
  onConvertLeadToAdmission,
  onSchoolUpdated,
}) => {
  const schoolId = school?.id || "";
  const effectiveElite = isElite ?? hasEntranceExamAccess(school);
  const isLibraryOnly = mode === "library_only";
  const resolvedInitialTab = isLibraryOnly
    ? "library"
    : initialTab && initialTab !== "library"
    ? initialTab
    : "leads";
  const [activeTab, setActiveTab] = useState<
    "leads" | "discounts" | "pre_primary" | "papers" | "builder" | "library" | "bank" | "custom"
  >(resolvedInitialTab);

  useEffect(() => {
    if (isLibraryOnly) {
      setActiveTab("library");
    } else if (initialTab && initialTab !== "library") {
      setActiveTab(initialTab);
    } else if (activeTab === "library") {
      setActiveTab("leads");
    }
  }, [initialTab, isLibraryOnly]);
  const [attempts, setAttempts] = useState<EntranceTestAttempt[]>([]);
  const [customQuestions, setCustomQuestions] = useState<EntranceTestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderPreset, setBuilderPreset] = useState<CustomBuilderPresetPayload | null>(externalBuilderPreset);
  const [libraryRefreshSignal, setLibraryRefreshSignal] = useState<number>(0);
  const [savedLibraryCount, setSavedLibraryCount] = useState<number>(0);

  useEffect(() => {
    if (externalBuilderPreset) {
      setBuilderPreset(externalBuilderPreset);
      if (!isLibraryOnly) {
        setActiveTab("builder");
      }
    }
  }, [externalBuilderPreset, isLibraryOnly]);

  // Entrance Exam Score Percentage Fee Off Slabs
  const [discountConfig, setDiscountConfig] = useState<EntranceDiscountConfig>(() =>
    normalizeEntranceDiscountConfig(school?.websiteConfig?.entranceDiscountConfig)
  );
  const [savingDiscounts, setSavingDiscounts] = useState(false);
  const [editingSlabId, setEditingSlabId] = useState<string | null>(null);
  const [slabMinPct, setSlabMinPct] = useState<string>("80");
  const [slabMaxPct, setSlabMaxPct] = useState<string>("100");
  const [slabType, setSlabType] = useState<"fixed" | "percent">("fixed");
  const [slabValue, setSlabValue] = useState<string>("500");
  const [slabLabel, setSlabLabel] = useState<string>("");

  const [entranceExamEnabled, setEntranceExamEnabled] = useState<boolean>(() =>
    isEntranceExamFeatureEnabled(school)
  );
  const [togglingWebsiteExam, setTogglingWebsiteExam] = useState(false);

  useEffect(() => {
    setDiscountConfig(
      normalizeEntranceDiscountConfig(school?.websiteConfig?.entranceDiscountConfig)
    );
  }, [school?.websiteConfig?.entranceDiscountConfig]);

  useEffect(() => {
    setEntranceExamEnabled(isEntranceExamFeatureEnabled(school));
  }, [school?.websiteConfig?.entranceExamEnabled]);

  const handleToggleEntranceExamWebsite = async () => {
    const nextVal = !entranceExamEnabled;
    setEntranceExamEnabled(nextVal);
    setTogglingWebsiteExam(true);
    try {
      const nextWebsiteConfig = {
        ...(school.websiteConfig || {}),
        entranceExamEnabled: nextVal,
        updatedAt: new Date().toISOString(),
      };
      await updateSchool(schoolId, { websiteConfig: nextWebsiteConfig });
      onSchoolUpdated?.({
        ...school,
        websiteConfig: nextWebsiteConfig,
      });
      toast.success(
        nextVal
          ? "Entrance Exam वेबसाइट पर चालू (ON) कर दिया गया!"
          : "Entrance Exam वेबसाइट से छुपा दिया (OFF) गया — वेबसाइट का लुक पूरी तरह संतुलित रहेगा।"
      );
    } catch (err: any) {
      setEntranceExamEnabled(!nextVal);
      toast.error("सेटिंग अपडेट करने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setTogglingWebsiteExam(false);
    }
  };

  // Leads filters
  const [leadSearch, setLeadSearch] = useState("");
  const [leadClassFilter, setLeadClassFilter] = useState<"all" | EntranceClassNumber>("all");
  const [leadTierFilter, setLeadTierFilter] = useState<"all" | EntranceEvaluationTier>("all");
  const [onlyFiveCompleted, setOnlyFiveCompleted] = useState(false);

  // Offline Mixed Sets (Obj+Subj) & Online 100-Set Browser
  const [paperMode, setPaperMode] = useState<"mixed_offline" | "online_mcq">("mixed_offline");
  const [paperClass, setPaperClass] = useState<EntranceClassNumber>(1);
  const [paperSetNumber, setPaperSetNumber] = useState<number>(1);
  const [mixedFontSizePx, setMixedFontSizePx] = useState<number>(9.5);
  const [mixedShowLines, setMixedShowLines] = useState<boolean>(false);
  const [showAnswersInPreview, setShowAnswersInPreview] = useState<boolean>(true);
  const [downloadingPdfMode, setDownloadingPdfMode] = useState<"full" | "questions_only" | null>(
    null
  );
  const [printPreviewData, setPrintPreviewData] = useState<{
    title: string;
    pagesHtml: string[];
    fullCss: string;
    docTitle: string;
    orientation?: "portrait" | "landscape";
    mode: "full" | "questions_only";
    isMixed: boolean;
    customDownloadFn?: () => Promise<void>;
  } | null>(null);

  // Expanded Curated Question Bank Explorer (500 Obj + 200 Subj per Subject / Class)
  const [bankClass, setBankClass] = useState<EntranceClassNumber>(1);
  const [bankKind, setBankKind] = useState<"OBJECTIVE" | "SUBJECTIVE">("OBJECTIVE");
  const [bankSubjectFilter, setBankSubjectFilter] = useState<string>("all");
  const [bankSearch, setBankSearch] = useState("");
  const [bankShowAnswers, setBankShowAnswers] = useState(true);
  const [bankPage, setBankPage] = useState(1);

  // Custom Question Creator (Objective MCQ or Subjective Short/Long)
  const [qClass, setQClass] = useState<EntranceClassNumber>(1);
  const [qSubject, setQSubject] = useState<EntranceTestSubject>("English");
  const [qExamCategory, setQExamCategory] = useState<ExamCategoryType>("ENTRANCE");
  const [qKind, setQKind] = useState<"OBJECTIVE" | "SUBJECTIVE">("OBJECTIVE");
  const [qFormat, setQFormat] = useState<EntranceTestQuestionFormat>("MCQ");
  const [qMarks, setQMarks] = useState<number>(2);
  const [qPassage, setQPassage] = useState("");
  const [qPrompt, setQPrompt] = useState("");
  const [qOpt0, setQOpt0] = useState("");
  const [qOpt1, setQOpt1] = useState("");
  const [qOpt2, setQOpt2] = useState("");
  const [qOpt3, setQOpt3] = useState("");
  const [qCorrectIdx, setQCorrectIdx] = useState<0 | 1 | 2 | 3>(0);
  const [qExplanation, setQExplanation] = useState("");
  const [qModelAnswer, setQModelAnswer] = useState("");
  const [qOrQuestion, setQOrQuestion] = useState("");
  const [qOrModelAnswer, setQOrModelAnswer] = useState("");
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [showCustomBulkModal, setShowCustomBulkModal] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let alive = true;
    setLoading(true);
    Promise.all([getEntranceTestAttempts(schoolId), getCustomEntranceQuestions(schoolId)])
      .then(([att, cq]) => {
        if (!alive) return;
        setAttempts(att);
        setCustomQuestions(cq);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [schoolId]);

  const totalCuratedBankCount = useMemo(() => getTotalCuratedBankCount(), []);
  const totalSubjectiveBankCount = useMemo(() => getTotalSubjectiveBankCount(), []);
  const totalCombinedBankCount = totalCuratedBankCount + totalSubjectiveBankCount;
  const paperBankStats = useMemo(() => getEntranceBankStats(paperClass), [paperClass]);
  const bankStats = useMemo(
    () =>
      bankKind === "SUBJECTIVE"
        ? getSubjectiveBankStats(bankClass)
        : getEntranceBankStats(bankClass),
    [bankClass, bankKind]
  );
  const bankAllQuestions = useMemo(
    () =>
      bankKind === "SUBJECTIVE"
        ? getSubjectiveQuestionsForClass(bankClass)
        : getCuratedQuestionsForClass(bankClass),
    [bankClass, bankKind]
  );

  const bankFilteredQuestions = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    return bankAllQuestions.filter((item) => {
      if (bankSubjectFilter !== "all" && item.subject !== bankSubjectFilter) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        (item.topicTag || "").toLowerCase().includes(q) ||
        (item.modelAnswer || "").toLowerCase().includes(q) ||
        (item.explanation || "").toLowerCase().includes(q)
      );
    });
  }, [bankAllQuestions, bankSubjectFilter, bankSearch]);

  const BANK_PAGE_SIZE = 25;
  const bankTotalPages = Math.max(1, Math.ceil(bankFilteredQuestions.length / BANK_PAGE_SIZE));
  const safeBankPage = Math.min(bankPage, bankTotalPages);
  const bankVisibleQuestions = useMemo(
    () =>
      bankFilteredQuestions.slice(
        (safeBankPage - 1) * BANK_PAGE_SIZE,
        safeBankPage * BANK_PAGE_SIZE
      ),
    [bankFilteredQuestions, safeBankPage]
  );

  useEffect(() => {
    setBankSubjectFilter("all");
    setBankPage(1);
  }, [bankClass, bankKind]);

  const previewPaper = useMemo(
    () =>
      generateEntrancePaperSet({
        schoolId,
        classLevel: paperClass,
        setNumber: paperSetNumber,
        customQuestions,
      }),
    [schoolId, paperClass, paperSetNumber, customQuestions]
  );

  const mixedOfflinePaper = useMemo(
    () =>
      generateMixedOfflinePaperSet({
        schoolId,
        classLevel: paperClass,
        setNumber: paperSetNumber,
        customQuestions,
      }),
    [schoolId, paperClass, paperSetNumber, customQuestions]
  );

  useEffect(() => {
    setMixedShowLines(paperClass <= 0);
    setMixedFontSizePx(paperClass <= 0 ? 10.0 : 9.5);
  }, [paperClass]);

  const mixedOfflineLayout = useMemo(
    () =>
      estimateCustomPaperLayout({
        objectiveQuestions: mixedOfflinePaper.objectiveQuestions,
        subjectiveQuestions: mixedOfflinePaper.subjectiveQuestions,
        fontSizePx: mixedFontSizePx,
        twoColObjective: false,
        twoColSubjective: false,
        showWritingLines: mixedShowLines,
      }),
    [mixedOfflinePaper, mixedFontSizePx, mixedShowLines, paperClass]
  );

  const leadStats = useMemo(() => {
    const totalAttempts = attempts.length;
    const uniquePhones = new Set(attempts.map((a) => `${a.phone}_${a.classLevel}`)).size;
    const avgPct =
      totalAttempts > 0
        ? Math.round(attempts.reduce((s, a) => s + Number(a.percentage || 0), 0) / totalAttempts)
        : 0;
    const funnelReady = attempts.filter((a) => a.attemptNumber >= MAX_FREE_ATTEMPTS_PER_CLASS).length;
    return { totalAttempts, uniquePhones, avgPct, funnelReady };
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return attempts.filter((a) => {
      if (leadClassFilter !== "all" && Number(a.classLevel) !== leadClassFilter) return false;
      if (onlyFiveCompleted && a.attemptNumber < MAX_FREE_ATTEMPTS_PER_CLASS) return false;
      if (leadTierFilter !== "all") {
        const tier = evaluateEntranceScore(a.percentage, a.classLabel).tier;
        if (tier !== leadTierFilter) return false;
      }
      if (!q) return true;
      return (
        (a.studentName || "").toLowerCase().includes(q) ||
        (a.phone || "").toLowerCase().includes(q) ||
        (a.setId || "").toLowerCase().includes(q) ||
        (a.classLabel || "").toLowerCase().includes(q)
      );
    });
  }, [attempts, leadSearch, leadClassFilter, leadTierFilter, onlyFiveCompleted]);

  const qBlueprint = useMemo(() => getClassTestBlueprint(qClass), [qClass]);
  useEffect(() => {
    const allowed = qBlueprint.quotas.map((x) => x.subject);
    if (!allowed.includes(qSubject)) {
      setQSubject(allowed[0]);
    }
  }, [qBlueprint, qSubject]);

  const handlePrintPaperA4 = (mode: "full" | "questions_only") => {
    try {
      const isMixed = paperMode === "mixed_offline";
      const bundle = isMixed
        ? buildCustomPaperHtmlBundle({
            school,
            classLevel: paperClass,
            paperTitle: `Offline Entrance Assessment (${mixedOfflinePaper.setId})`,
            examName: `Admission Entrance Assessment · ${mixedOfflinePaper.setId}`,
            sessionLabel: "2026-27",
            durationMinutes: mixedOfflinePaper.durationMinutes,
            objectiveQuestions: mixedOfflinePaper.objectiveQuestions,
            subjectiveQuestions: mixedOfflinePaper.subjectiveQuestions,
            fontSizePx: mixedFontSizePx,
            twoColObjective: false,
            twoColSubjective: false,
            showWritingLines: mixedShowLines,
            mode,
          })
        : buildStandardPaperHtmlBundle({
            school,
            paper: previewPaper,
            mode,
          });

      const resolvedOrientation: "portrait" | "landscape" =
        "orientation" in bundle && bundle.orientation === "landscape"
          ? "landscape"
          : "portrait";

      setPrintPreviewData({
        title: isMixed
          ? `${mixedOfflinePaper.classLabel} (${mixedOfflinePaper.setId}) · Mixed Offline`
          : `${previewPaper.classLabel} (${previewPaper.setId})`,
        pagesHtml: bundle.pagesHtml,
        fullCss: bundle.fullCss,
        docTitle: bundle.docTitle,
        orientation: resolvedOrientation,
        mode,
        isMixed,
      });

      mountAndPrintA4Sync(
        bundle.pagesHtml,
        bundle.fullCss,
        bundle.docTitle,
        resolvedOrientation
      );
    } catch (err: any) {
      toast.error("A4 Print में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const handleOpenMixedSetInBuilder = () => {
    const combined = [
      ...mixedOfflinePaper.objectiveQuestions,
      ...mixedOfflinePaper.subjectiveQuestions,
    ];
    const marksMap: Record<string, number> = {};
    combined.forEach((q) => {
      if (q.marks) marksMap[q.id] = q.marks;
    });
    setBuilderPreset({
      key: Date.now(),
      classLevel: mixedOfflinePaper.classLevel,
      paperTitle: `Offline Entrance Exam (${mixedOfflinePaper.setId})`,
      durationMinutes: mixedOfflinePaper.durationMinutes,
      questionIds: Array.from(new Set(combined.map((q) => q.id))),
      marksById: marksMap,
      extraQuestions: combined,
    });
    setActiveTab("builder");
    toast.success(`${mixedOfflinePaper.classLabel} (${mixedOfflinePaper.setId}) Paper Builder में लोड हो गया!`);
  };

  const handleSaveCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qPrompt.trim()) {
      toast.error("कृपया प्रश्न दर्ज करें।");
      return;
    }
    if (qKind === "OBJECTIVE") {
      if (!qOpt0.trim() || !qOpt1.trim() || !qOpt2.trim() || !qOpt3.trim()) {
        toast.error("Objective प्रश्न के लिए चारों विकल्प (A, B, C, D) भरना अनिवार्य है।");
        return;
      }
    } else if (!qModelAnswer.trim()) {
      toast.error("Subjective प्रश्न का Model Answer / Key Points दर्ज करें (Answer Key PDF के लिए)।");
      return;
    }

    setSavingCustom(true);
    try {
      const effectiveFormat: EntranceTestQuestionFormat =
        qKind === "SUBJECTIVE"
          ? qFormat === "LONG_ANSWER" || qMarks >= 3
            ? "LONG_ANSWER"
            : "SHORT_ANSWER"
          : qFormat === "SHORT_ANSWER" || qFormat === "LONG_ANSWER"
          ? "MCQ"
          : qFormat;

      const saved = await saveCustomEntranceQuestion(schoolId, {
        id: editingCustomId || undefined,
        classLevel: qClass,
        subject: qSubject,
        questionKind: qKind,
        examCategory: qExamCategory,
        format: effectiveFormat,
        passage: qPassage.trim() ? qPassage.trim() : undefined,
        question: qPrompt.trim(),
        options:
          qKind === "OBJECTIVE"
            ? [qOpt0.trim(), qOpt1.trim(), qOpt2.trim(), qOpt3.trim()]
            : ["", "", "", ""],
        correctIndex: qKind === "OBJECTIVE" ? qCorrectIdx : 0,
        explanation:
          qKind === "SUBJECTIVE"
            ? qModelAnswer.trim()
            : qExplanation.trim() ||
              `Correct answer is (${OPTION_LETTERS[qCorrectIdx]}) ${
                [qOpt0, qOpt1, qOpt2, qOpt3][qCorrectIdx].trim()
              }.`,
        modelAnswer: qKind === "SUBJECTIVE" ? qModelAnswer.trim() : undefined,
        orQuestion: qKind === "SUBJECTIVE" && qOrQuestion.trim() ? qOrQuestion.trim() : undefined,
        orModelAnswer:
          qKind === "SUBJECTIVE" && qOrQuestion.trim() && qOrModelAnswer.trim()
            ? qOrModelAnswer.trim()
            : undefined,
        marks: Math.max(1, Math.min(20, Number(qMarks || (qKind === "SUBJECTIVE" ? 2 : 1)))),
      });
      setCustomQuestions((prev) => [saved, ...prev.filter((q) => q.id !== saved.id)]);
      const wasEditing = Boolean(editingCustomId);
      setEditingCustomId(null);
      setQPrompt("");
      setQPassage("");
      setQOpt0("");
      setQOpt1("");
      setQOpt2("");
      setQOpt3("");
      setQExplanation("");
      setQModelAnswer("");
      setQOrQuestion("");
      setQOrModelAnswer("");
      toast.success(
        wasEditing
          ? `प्रश्न सफलतापूर्वक अपडेट हो गया!`
          : qKind === "SUBJECTIVE"
          ? `Subjective प्रश्न सेव हो गया! अब आप इसे 'Paper Builder (Obj + Subj)' में चुन सकते हैं।`
          : `Custom Objective MCQ सेव हो गया! ${formatEntranceClassLabel(qClass)} Sets और Paper Builder दोनों में उपलब्ध।`
      );
    } finally {
      setSavingCustom(false);
    }
  };

  const handleStartEditCustom = (cq: EntranceTestQuestion) => {
    const isSubj = cq.questionKind === "SUBJECTIVE";
    setEditingCustomId(cq.id);
    setQClass(cq.classLevel);
    setQSubject(cq.subject);
    setQExamCategory(cq.examCategory || "ENTRANCE");
    setQKind(isSubj ? "SUBJECTIVE" : "OBJECTIVE");
    setQFormat(cq.format || (isSubj ? "SHORT_ANSWER" : "MCQ"));
    setQMarks(Number(cq.marks || (isSubj ? 2 : 1)));
    setQPassage(cq.passage || "");
    setQPrompt(cq.question || "");
    setQOpt0(cq.options?.[0] || "");
    setQOpt1(cq.options?.[1] || "");
    setQOpt2(cq.options?.[2] || "");
    setQOpt3(cq.options?.[3] || "");
    setQCorrectIdx((cq.correctIndex ?? 0) as 0 | 1 | 2 | 3);
    setQExplanation(cq.explanation || "");
    setQModelAnswer(cq.modelAnswer || cq.explanation || "");
    setQOrQuestion(cq.orQuestion || "");
    setQOrModelAnswer(cq.orModelAnswer || "");
    toast.info("प्रश्न Edit मोड में खुल गया — बदलाव करके Update Question दबाएँ।");
  };

  const handleCancelEditCustom = () => {
    setEditingCustomId(null);
    setQPrompt("");
    setQPassage("");
    setQOpt0("");
    setQOpt1("");
    setQOpt2("");
    setQOpt3("");
    setQExplanation("");
    setQModelAnswer("");
    setQOrQuestion("");
    setQOrModelAnswer("");
  };

  const handleDeleteCustom = async (qId: string) => {
    if (editingCustomId === qId) handleCancelEditCustom();
    await deleteCustomEntranceQuestion(schoolId, qId);
    setCustomQuestions((prev) => prev.filter((q) => q.id !== qId));
    toast.success("Custom question deleted.");
  };

  // Persist Entrance Discount Slabs Config
  const persistDiscountConfig = async (nextCfg: EntranceDiscountConfig, successMsg: string) => {
    const normalized = normalizeEntranceDiscountConfig(nextCfg);
    setDiscountConfig(normalized);
    setSavingDiscounts(true);
    try {
      const nextWebsiteConfig = {
        ...(school.websiteConfig || {}),
        entranceDiscountConfig: normalized,
        updatedAt: new Date().toISOString(),
      };
      await updateSchool(schoolId, { websiteConfig: nextWebsiteConfig });
      onSchoolUpdated?.({
        ...school,
        websiteConfig: nextWebsiteConfig,
      });
      toast.success(successMsg);
    } catch (err: any) {
      toast.error("सेव करने में समस्या: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setSavingDiscounts(false);
    }
  };

  const resetSlabForm = () => {
    setEditingSlabId(null);
    setSlabMinPct("80");
    setSlabMaxPct("100");
    setSlabType("fixed");
    setSlabValue("500");
    setSlabLabel("");
  };

  const handleAddOrUpdateSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    const minP = Math.max(0, Math.min(100, Math.round(Number(slabMinPct || 0))));
    const maxP = Math.max(0, Math.min(100, Math.round(Number(slabMaxPct || 0))));
    const val = Math.max(0, Math.round(Number(slabValue || 0)));

    if (minP > maxP) {
      toast.error("Minimum % कभी Maximum % से ज़्यादा नहीं हो सकता।");
      return;
    }
    if (val <= 0) {
      toast.error("कृपया 0 से बड़ा Discount Value (₹ या %) दर्ज करें।");
      return;
    }
    if (slabType === "percent" && val > 100) {
      toast.error("Percentage छूट 100% से अधिक नहीं हो सकती।");
      return;
    }

    const newSlab: EntranceDiscountSlab = {
      id: editingSlabId || generateId("eslab"),
      minPercentage: minP,
      maxPercentage: maxP,
      discountType: slabType,
      discountValue: val,
      label: slabLabel.trim() || `${minP}%–${maxP}% Merit Fee Off`,
      enabled: true,
    };

    const nextSlabs = editingSlabId
      ? discountConfig.slabs.map((s) => (s.id === editingSlabId ? newSlab : s))
      : [newSlab, ...discountConfig.slabs];

    const nextCfg: EntranceDiscountConfig = {
      ...discountConfig,
      enabled: true,
      slabs: nextSlabs,
    };

    resetSlabForm();
    await persistDiscountConfig(
      nextCfg,
      editingSlabId
        ? `Slab (${minP}%–${maxP}%) अपडेट हो गया!`
        : `नया Slab (${minP}%–${maxP}% → ${slabType === "percent" ? `${val}%` : `₹${val}`} OFF) जुड़ गया!`
    );
  };

  const handleEditSlabClick = (s: EntranceDiscountSlab) => {
    setEditingSlabId(s.id);
    setSlabMinPct(String(s.minPercentage));
    setSlabMaxPct(String(s.maxPercentage));
    setSlabType(s.discountType);
    setSlabValue(String(s.discountValue));
    setSlabLabel(s.label || "");
  };

  const handleToggleSlabActive = async (slabId: string) => {
    const nextSlabs = discountConfig.slabs.map((s) =>
      s.id === slabId ? { ...s, enabled: s.enabled === false } : s
    );
    await persistDiscountConfig(
      { ...discountConfig, slabs: nextSlabs },
      "Slab status updated."
    );
  };

  const handleDeleteSlab = async (slabId: string) => {
    const nextSlabs = discountConfig.slabs.filter((s) => s.id !== slabId);
    if (editingSlabId === slabId) resetSlabForm();
    await persistDiscountConfig(
      { ...discountConfig, slabs: nextSlabs },
      "Slab cancelled & removed."
    );
  };

  const handleToggleMasterDiscounts = async () => {
    const nextEnabled = !discountConfig.enabled;
    await persistDiscountConfig(
      {
        ...discountConfig,
        enabled: nextEnabled,
        slabs:
          nextEnabled && discountConfig.slabs.length === 0
            ? DEFAULT_SAMPLE_ENTRANCE_SLABS
            : discountConfig.slabs,
      },
      nextEnabled
        ? "✅ Entrance Exam Merit Fee Off चालू (Active) कर दिया गया!"
        : "⛔ सभी Entrance Exam Fee Off रद्द / बंद (Cancelled) कर दिए गए।"
    );
  };

  const handleLoadDefaultSlabs = async () => {
    await persistDiscountConfig(
      {
        enabled: true,
        applyScope: discountConfig.applyScope || "all",
        slabs: DEFAULT_SAMPLE_ENTRANCE_SLABS,
      },
      "✅ Default Merit Slabs (90%+ ₹500, 80–89% ₹300, 60–79% ₹200) लोड हो गए!"
    );
  };

  if (!effectiveElite) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
          ) : (
            <div />
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-black">
            <Lock className="w-3.5 h-3.5" />
            <span>Elite Feature Locked</span>
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white">
              Entrance Exam &amp; {totalCuratedBankCount.toLocaleString("en-IN")}-MCQ Bank — 👑 Elite Plan Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              आपका स्कूल अभी <strong>⚡ Lite Plan</strong> पर है। Lite प्लान में Entrance Exam सेक्शन लॉक रहता है —
              Class 1 से 8 तक <strong>हर विषय के 500 प्रश्न (कुल {totalCuratedBankCount.toLocaleString("en-IN")} MCQs)</strong>, 100-Set PDF पेपर, Merit Fee Off Slabs और Public Website Online Test अनलॉक करने के लिए <strong>👑 Elite Plan</strong> अपग्रेड करें।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <p className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>⚡ Lite Plan (Locked)</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Entrance Exam पैनल और वेबसाइट टेस्ट दिखता है पर लॉक रहता है (उपयोग नहीं कर सकते)।
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-700 space-y-1">
              <p className="font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                <span>👑 Elite / White-Label Plan</span>
              </p>
              <p className="text-amber-900/85 dark:text-amber-200/85">
                500 Qs/Subject ({totalCuratedBankCount.toLocaleString("en-IN")} MCQs), 100-Set 2-Part PDF, Merit Discount &amp; Live Admission Leads अनलॉक।
              </p>
            </div>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
            {onUpgradePlan && (
              <button
                type="button"
                onClick={onUpgradePlan}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm inline-flex items-center gap-2 shadow-md cursor-pointer transition active:scale-95"
              >
                <Crown className="w-4 h-4" />
                <span>👑 Upgrade to Elite Plan</span>
              </button>
            )}
            <button
              type="button"
              disabled={togglingWebsiteExam}
              onClick={handleToggleEntranceExamWebsite}
              className={`px-4 py-3 rounded-xl border text-xs font-black inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60 ${
                entranceExamEnabled
                  ? "bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {entranceExamEnabled
                  ? "Hide Locked Test from Website (Turn OFF)"
                  : "Show Locked Preview on Website (Turn ON)"}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryOnly) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-start gap-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white leading-snug">
                Digital Library (Question Archive)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                Session-wise Saved Question Papers, PDF Print, Answer Keys &amp; Student Publish Control
                {savedLibraryCount > 0 ? ` · ${savedLibraryCount} Saved Papers` : ""}
              </p>
            </div>
          </div>
        </div>

        <AdminQuestionPaperLibrary
          school={school}
          refreshSignal={libraryRefreshSignal}
          onPapersCountChange={setSavedLibraryCount}
          onEditPaperInBuilder={(paper) => {
            const allQs = [...(paper.objectiveQuestions || []), ...(paper.subjectiveQuestions || [])];
            const preset: CustomBuilderPresetPayload = {
              key: Date.now(),
              classLevel: paper.classLevel,
              paperTitle: paper.paperTitle,
              durationMinutes: paper.durationMinutes || 60,
              questionIds: allQs.map((q) => q.id),
              extraQuestions: allQs,
              savedPaperToLoad: paper,
            };
            if (onOpenBuilderFromLibrary) {
              onOpenBuilderFromLibrary(preset);
            } else {
              setBuilderPreset(preset);
              setActiveTab("builder");
            }
          }}
          onCreateNewPaper={(cls) => {
            const preset: CustomBuilderPresetPayload | undefined =
              cls !== undefined
                ? {
                    key: Date.now(),
                    classLevel: cls,
                    paperTitle: "School Examination",
                    durationMinutes: cls <= 0 ? 45 : 60,
                    questionIds: [],
                  }
                : undefined;
            if (onOpenBuilderFromLibrary) {
              onOpenBuilderFromLibrary(preset);
            } else {
              if (preset) setBuilderPreset(preset);
              setActiveTab("builder");
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white leading-snug">
                Exam Paper Builder &amp; {totalCombinedBankCount.toLocaleString("en-IN")}-Question Bank (Nursery – Class 10)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                500 Objective + 200 Subjective / Subject · PA-1..4, Half Yearly, Final Year &amp; Entrance · Up to 1,000 Sets
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={togglingWebsiteExam}
            onClick={handleToggleEntranceExamWebsite}
            className={`h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
              entranceExamEnabled
                ? "bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                : "bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700"
            }`}
            title="Public Website par Entrance Exam ON ya OFF karein"
          >
            <Power className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{entranceExamEnabled ? "Web: ON" : "Web: OFF"}</span>
            <span className="hidden sm:inline">
              {entranceExamEnabled ? "Website Test: ON (Live)" : "Website Test: OFF (Hidden)"}
            </span>
          </button>
        </div>

        {/* Full-Width Scrollable Navigation Tab Rail (never clips left/right) */}
        <div className="w-full overflow-x-auto pb-0.5">
          <div className="inline-flex min-w-full items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {(
              [
                { id: "leads", label: `Test Leads (${attempts.length})` },
                {
                  id: "discounts",
                  label: `Merit Fee Off (${discountConfig.enabled ? "ON" : "OFF"})`,
                },
                { id: "pre_primary", label: "Nur / LKG / UKG (20 Sets)" },
                { id: "papers", label: "Offline Mixed Sets (Nur–10)" },
                { id: "builder", label: "Paper Builder (PA / Exam)" },
                { id: "bank", label: `Question Bank (${totalCombinedBankCount.toLocaleString("en-IN")})` },
                { id: "custom", label: `Custom & Bulk (${customQuestions.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={(e) => {
                  setActiveTab(t.id);
                  e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
                className={`h-8 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap inline-flex items-center justify-center shrink-0 ${
                  activeTab === t.id
                    ? "bg-[#070D19] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-900/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!entranceExamEnabled && (
        <div className="rounded-2xl bg-slate-900 text-white border border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs">
            <EyeOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">
                Public Website पर Entrance Exam अभी बंद (OFF) है
              </p>
              <p className="text-slate-300 mt-0.5">
                अभिभावकों को वेबसाइट पर Entrance Test बटन नहीं दिखेगा और वेबसाइट का लेआउट पूरी तरह संतुलित रहेगा। आप यहाँ से फिर भी पुराने Leads देख सकते हैं और 100-Set PDF डाउनलोड कर सकते हैं।
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={togglingWebsiteExam}
            onClick={handleToggleEntranceExamWebsite}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Turn ON on Website</span>
          </button>
        </div>
      )}

      {/* TAB 1: STUDENT TEST ATTEMPT LEADS */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Total Online Attempts</div>
              <div className="text-2xl font-black text-slate-950 dark:text-white font-mono tabular-nums mt-1">
                {leadStats.totalAttempts}
              </div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Unique Students</div>
              <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono tabular-nums mt-1">
                {leadStats.uniquePhones}
              </div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">Average Score %</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
                {leadStats.avgPct}%
              </div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="text-[11px] font-semibold text-slate-500">5/5 Admission Funnel Ready</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1">
                {leadStats.funnelReady}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Search student name, mobile, Class, or Set-04..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={leadClassFilter}
                onChange={(e) =>
                  setLeadClassFilter(e.target.value === "all" ? "all" : (Number(e.target.value) as EntranceClassNumber))
                }
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                <option value="all">All Classes</option>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {formatEntranceClassLabel(c)}
                  </option>
                ))}
              </select>
              <select
                value={leadTierFilter}
                onChange={(e) =>
                  setLeadTierFilter(e.target.value as "all" | EntranceEvaluationTier)
                }
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                <option value="all">All Evaluation Tiers</option>
                <option value="MERIT">Merit / 90%+ Discovery (80–100%)</option>
                <option value="QUALIFIED">Qualified Next Class (50–79%)</option>
                <option value="FOUNDATION_SUPPORT">Conditional Next Class (33–49%)</option>
                <option value="COUNSELING">Keep Same Class / Counseling (&lt;33%)</option>
              </select>
              <button
                type="button"
                onClick={() => setOnlyFiveCompleted((p) => !p)}
                className={`px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                  onlyFiveCompleted
                    ? "bg-amber-400 text-slate-950 border-amber-400"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                5/5 Funnel Leads Only
              </button>
            </div>
          </div>

          {/* 4-Tier Principal Evaluation Guide Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
              <div className="font-black text-emerald-800 dark:text-emerald-300">80–100% · Merit (90%+ Step-Up)</div>
              <div className="text-emerald-700/90 dark:text-emerald-200/80">Next Class + Scholarship (90%+ Discovery Offer)</div>
            </div>
            <div className="rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-3 py-2">
              <div className="font-black text-sky-800 dark:text-sky-300">50–79% · Qualified</div>
              <div className="text-sky-700/90 dark:text-sky-200/80">Direct Admission in Next Class</div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <div className="font-black text-amber-800 dark:text-amber-300">33–49% · Guided Next Class</div>
              <div className="text-amber-700/90 dark:text-amber-200/80">Next Class + 1-Month Foundation Support</div>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-2">
              <div className="font-black text-rose-800 dark:text-rose-300">&lt;33% · Same Class</div>
              <div className="text-rose-700/90 dark:text-rose-200/80">Suggest Same Exam Class / Bridge Plan</div>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading test attempts...
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                अभी कोई टेस्ट अटेम्प्ट रिकॉर्ड नहीं है
              </p>
              <p className="text-xs text-slate-500">
                जैसे ही अभिभावक या छात्र Public Website से Free Entrance Test देंगे, उनका नाम, नंबर, पेपर सेट और स्कोर यहाँ दिखेगा।
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAttempts.map((att) => {
                const evalInfo = evaluateEntranceScore(att.percentage, att.classLabel, att.classLevel);
                const feeOffInfo = calculateEntranceScoreDiscount(att.percentage, discountConfig);
                const badgeCls =
                  evalInfo.tier === "MERIT"
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                    : evalInfo.tier === "QUALIFIED"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : evalInfo.tier === "FOUNDATION_SUPPORT"
                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
                return (
                  <div
                    key={att.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-950 dark:text-white">
                          {att.studentName}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold font-mono">
                          Exam: {att.classLabel} · {att.setId}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[11px] font-bold tabular-nums">
                          Attempt #{att.attemptNumber}/5
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-extrabold tabular-nums ${badgeCls}`}
                          title={evalInfo.adminRuleNote}
                        >
                          {evalInfo.adminShortBadge}
                        </span>
                        {feeOffInfo.eligible && (
                          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-extrabold tabular-nums">
                            🎁 {feeOffInfo.displayBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex flex-wrap gap-3">
                        <span>📱 {att.phone}</span>
                        <span>
                          Score:{" "}
                          <strong
                            className={
                              evalInfo.isDirectEligible
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {att.score}/{att.totalQuestions} ({att.percentage}%)
                          </strong>
                        </span>
                        <span>{new Date(att.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong>{evalInfo.adminTag}:</strong> {evalInfo.adminRuleNote}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={`tel:${att.phone}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const waText = evalInfo.isDirectEligible
                            ? `नमस्ते ${att.studentName} जी, बधाई हो! ${school.name} के ${att.classLabel} ऑनलाइन एंट्रेंस टेस्ट (${att.setId}) में आपने ${att.score}/${att.totalQuestions} (${att.percentage}%) अंक प्राप्त किए हैं। आप ${att.classLabel} में सीधे प्रवेश के लिए योग्य हैं। कृपया स्कूल ऑफिस या ऑनलाइन पोर्टल से दाखिला कन्फर्म करें।`
                            : `नमस्ते ${att.studentName} जी, ${school.name} के ${att.classLabel} ऑनलाइन फाउंडेशन असेसमेंट (${att.setId}) में शामिल होने के लिए धन्यवाद! प्रिंसिपल सर के साथ फ्री काउंसलिंग व सीट बुकिंग के लिए कृपया स्कूल ऑफिस आएं या संपर्क करें।`;
                          safeOpenExternalUrl(`https://wa.me/91${att.phone}?text=${encodeURIComponent(waText)}`);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      {onConvertLeadToAdmission && (
                        <button
                          type="button"
                          onClick={() => onConvertLeadToAdmission(att)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Admit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MERIT FEE OFF SLABS (PERCENTAGE -> ADMISSION OFF) */}
      {activeTab === "discounts" && (
        <div className="space-y-4">
          {/* Master ON/OFF & Scope Bar */}
          <div className="rounded-2xl bg-[#070D19] text-white border border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <BadgePercent className="w-4 h-4 text-amber-400" />
                <span className="text-sm sm:text-base font-extrabold">
                  Entrance Exam Merit Fee Off Settings
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    discountConfig.enabled
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {discountConfig.enabled ? "ACTIVE ON ADMISSIONS" : "CANCELLED / OFF"}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                तय करें कि एंट्रेंस टेस्ट में कितने प्रतिशत (%) नंबर आने पर एडमिशन फीस में कितनी छूट (₹ Fixed या % Off) मिलेगी।{" "}
                <strong className="text-amber-300">यह छूट केवल अभी के Current Pay (चुने गए Payment Term की Pay Now राशि) पर लागू होती है — Term 2 या बाद के शुल्क पर नहीं।</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={discountConfig.applyScope || "all"}
                disabled={savingDiscounts}
                onChange={(e) =>
                  void persistDiscountConfig(
                    {
                      ...discountConfig,
                      applyScope:
                        e.target.value === "admission_only" ? "admission_only" : "all",
                    },
                    "Fee scope updated."
                  )
                }
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-100"
              >
                <option value="all">Apply On: All Admission Heads (Excl. Bus)</option>
                <option value="admission_only">Apply On: Admission &amp; Reg. Fee Only</option>
              </select>

              <button
                type="button"
                disabled={savingDiscounts}
                onClick={handleLoadDefaultSlabs}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Default Slabs</span>
              </button>

              <button
                type="button"
                disabled={savingDiscounts}
                onClick={handleToggleMasterDiscounts}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 ${
                  discountConfig.enabled
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>
                  {discountConfig.enabled ? "Cancel All Off (Turn OFF)" : "Enable Fee Off (Turn ON)"}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Add / Edit Slab Form */}
            <form
              onSubmit={handleAddOrUpdateSlab}
              className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  {editingSlabId ? (
                    <>
                      <Edit2 className="w-4 h-4 text-amber-500" />
                      <span>Edit Percentage Fee Off Slab</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-emerald-500" />
                      <span>Add Percentage Fee Off Slab</span>
                    </>
                  )}
                </h3>
                {editingSlabId && (
                  <button
                    type="button"
                    onClick={resetSlabForm}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Min Score % *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={slabMinPct}
                    onChange={(e) => setSlabMinPct(e.target.value)}
                    placeholder="e.g. 90"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Max Score % *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={slabMaxPct}
                    onChange={(e) => setSlabMaxPct(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={slabType}
                    onChange={(e) =>
                      setSlabType(e.target.value === "percent" ? "percent" : "fixed")
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                  >
                    <option value="fixed">₹ Fixed Rupees OFF</option>
                    <option value="percent">% Percent Fee OFF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {slabType === "percent" ? "Off Percentage (%)" : "Off Amount (₹)"} *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={slabType === "percent" ? 100 : 100000}
                    value={slabValue}
                    onChange={(e) => setSlabValue(e.target.value)}
                    placeholder={slabType === "percent" ? "e.g. 25" : "e.g. 500"}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Badge / Label (Optional)
                </label>
                <input
                  type="text"
                  value={slabLabel}
                  onChange={(e) => setSlabLabel(e.target.value)}
                  placeholder="e.g. 90%+ Scholar Merit Off"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={savingDiscounts}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {savingDiscounts ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {editingSlabId ? "Save Slab Changes" : "+ Add Fee Off Slab"}
                </span>
              </button>
            </form>

            {/* Right: Configured Slabs List */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Configured Percentage Fee Off Slabs ({discountConfig.slabs.length})</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  Highest matching % slab auto-applies
                </span>
              </div>

              {discountConfig.slabs.length === 0 ? (
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    अभी कोई Percentage Fee Off Slab सेट नहीं है।
                  </p>
                  <p className="text-[11px] text-slate-500">
                    बाएं फॉर्म से नया स्लैब जोड़ें या ऊपर "Load Default Slabs" पर क्लिक करें।
                  </p>
                </div>
              ) : (
                discountConfig.slabs.map((slab) => {
                  const isActive = discountConfig.enabled && slab.enabled !== false;
                  const offText =
                    slab.discountType === "percent"
                      ? `${slab.discountValue}% OFF`
                      : `₹${slab.discountValue.toLocaleString("en-IN")} OFF`;
                  return (
                    <div
                      key={slab.id}
                      className={`rounded-xl bg-white dark:bg-slate-900 border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isActive
                          ? "border-emerald-300 dark:border-emerald-800"
                          : "border-slate-200 dark:border-slate-800 opacity-75"
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-[#070D19] text-amber-400 text-xs font-black font-mono tabular-nums">
                            {slab.minPercentage}% – {slab.maxPercentage}%
                          </span>
                          <span className="px-2.5 py-0.5 rounded bg-emerald-600 text-white text-xs font-black tabular-nums">
                            {offText}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isActive
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                          >
                            {!discountConfig.enabled
                              ? "MASTER OFF"
                              : slab.enabled !== false
                              ? "ACTIVE"
                              : "PAUSED"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {slab.label || `${slab.minPercentage}%–${slab.maxPercentage}% Merit Off`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditSlabClick(slab)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={savingDiscounts}
                          onClick={() => void handleToggleSlabActive(slab.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                            slab.enabled !== false
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {slab.enabled !== false ? "Pause" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={savingDiscounts}
                          onClick={() => void handleDeleteSlab(slab.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PRE-PRIMARY SCREENING (NURSERY / LKG / UKG · 20 VISUAL SETS) */}
      {activeTab === "pre_primary" && <PrePrimaryScreeningPanel school={school} />}

      {/* TAB 3: OFFLINE MIXED SETS (OBJ + SUBJ) & ONLINE 100-SET PAPER BROWSER */}
      {activeTab === "papers" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  {paperMode === "mixed_offline"
                    ? "Offline Ready-Made Mixed Sets (Nursery – Class 10 · Objective + Subjective)"
                    : `Online Entrance MCQ Bank Sets (Set-01 to Set-${TOTAL_PAPER_SETS})`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {paperMode === "mixed_offline"
                    ? `1–2 Pages Student Paper (${mixedOfflinePaper.objectiveMarks}M Obj + ${mixedOfflinePaper.subjectiveMarks}M Subj = ${mixedOfflinePaper.maxMarks} Marks) + Page ${mixedOfflineLayout.answerKeyPageNumber} Combined Key`
                    : "Online Student Portal Exam Sets (100% MCQ — 1 Mark each)"}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setPaperMode("mixed_offline")}
                  className={`px-3 py-1.5 rounded-md font-bold cursor-pointer whitespace-nowrap ${
                    paperMode === "mixed_offline"
                      ? "bg-[#070D19] text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Offline Mixed (Obj + Subj)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperMode("online_mcq")}
                  className={`px-3 py-1.5 rounded-md font-bold cursor-pointer whitespace-nowrap ${
                    paperMode === "online_mcq"
                      ? "bg-[#070D19] text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Online MCQ Sets
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Select Class (Nursery – Class 10)
                </label>
                <select
                  value={paperClass}
                  onChange={(e) => setPaperClass(Number(e.target.value) as EntranceClassNumber)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-bold"
                >
                  {CLASSES.map((c) => {
                    const bp = getClassTestBlueprint(c);
                    return (
                      <option key={c} value={c}>
                        {paperMode === "mixed_offline"
                          ? `${formatEntranceClassLabel(c)} (${c <= 0 ? "16 Qs · 28M · Ans Space" : c <= 3 ? "16 Qs · 28M · Questions Only" : c <= 5 ? "22 Qs · 38M · Questions Only" : "25 Qs · 60M · Questions Only"})`
                          : `${formatEntranceClassLabel(c)} (${bp.durationMinutes} Min · ${bp.totalQuestions} Qs)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Paper Set (1 – {TOTAL_PAPER_SETS} Unique Sets)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPaperSetNumber((n) => (n <= 1 ? TOTAL_PAPER_SETS : n - 1))
                    }
                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                    title="Previous Set"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={TOTAL_PAPER_SETS}
                    value={paperSetNumber}
                    onChange={(e) =>
                      setPaperSetNumber(
                        Math.max(1, Math.min(TOTAL_PAPER_SETS, Number(e.target.value || 1)))
                      )
                    }
                    className="w-full h-10 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-black font-mono text-center tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPaperSetNumber((n) => (n >= TOTAL_PAPER_SETS ? 1 : n + 1))
                    }
                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                    title="Next Set"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5 text-center">
                  {paperMode === "mixed_offline"
                    ? `Mix-${formatSetId(paperSetNumber)} (${mixedOfflinePaper.totalQuestions} Qs · ${mixedOfflinePaper.maxMarks}M)`
                    : `${formatSetId(paperSetNumber)} (${getClassTestBlueprint(paperClass).totalQuestions} Qs)`}
                </div>
              </div>

              <div className="sm:col-span-5 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <button
                  type="button"
                  disabled={downloadingPdfMode !== null}
                  onClick={() => handlePrintPaperA4("full")}
                  className="sm:col-span-7 h-10 px-3 rounded-xl bg-[#070D19] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {downloadingPdfMode === "full" ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Printer className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span>
                    {paperMode === "mixed_offline"
                      ? `Print ${mixedOfflineLayout.questionPageCount}P + Key (A4)`
                      : "Print Paper + Key (A4)"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={downloadingPdfMode !== null}
                  onClick={() => handlePrintPaperA4("questions_only")}
                  className="sm:col-span-5 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {downloadingPdfMode === "questions_only" ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 shrink-0" />
                  )}
                  <span>Print Q-Paper (A4)</span>
                </button>
              </div>
            </div>

            {paperMode === "mixed_offline" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2">
                    <Type className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span className="font-bold">PDF Text Size:</span>
                    <input
                      type="range"
                      min={7.0}
                      max={13.5}
                      step={0.5}
                      value={mixedFontSizePx}
                      onChange={(e) => setMixedFontSizePx(Number(e.target.value))}
                      className="w-24 accent-sky-600 cursor-pointer"
                    />
                    <span className="font-mono font-bold tabular-nums text-sky-700 dark:text-sky-400">
                      {mixedFontSizePx.toFixed(1)}px
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  {paperClass <= 0 && (
                    <button
                      type="button"
                      onClick={() => setMixedShowLines((p) => !p)}
                      className={`h-8 px-3 rounded-lg border font-bold cursor-pointer whitespace-nowrap inline-flex items-center justify-center ${
                        mixedShowLines
                          ? "bg-amber-400 text-slate-950 border-amber-400"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Answer Lines: {mixedShowLines ? "ON" : "OFF"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenMixedSetInBuilder}
                    className="h-8 px-3 rounded-lg bg-[#070D19] hover:bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Open in Builder</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                {paperMode === "mixed_offline" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600 dark:text-slate-300 tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {mixedOfflinePaper.setId} Mix ({mixedOfflinePaper.totalQuestions} Qs · {mixedOfflinePaper.maxMarks}M):
                      </span>
                      {mixedOfflinePaper.subjectBreakdown.map((b, i) => (
                        <React.Fragment key={b.subject}>
                          {i > 0 && <span className="text-slate-400" aria-hidden="true">·</span>}
                          <span>
                            {b.subject} ({b.objectiveCount} Obj + {b.subjectiveCount} Subj = {b.marks}M)
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      Auto-fit Preview: Questions fill {mixedOfflineLayout.questionPageCount} A4 Page(s) (Auto PDF fit: {mixedOfflineLayout.autoFitFontSizePx}px) · Combined Answer Key on Page {mixedOfflineLayout.answerKeyPageNumber}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600 dark:text-slate-300 tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Set Mix ({previewPaper.totalQuestions} Qs):
                      </span>
                      {previewPaper.subjectBreakdown.map((b, i) => (
                        <React.Fragment key={b.subject}>
                          {i > 0 && <span className="text-slate-400" aria-hidden="true">·</span>}
                          <span>
                            {b.subject} <strong className="font-mono">{b.count}</strong>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-semibold text-sky-700 dark:text-sky-400">
                        {formatEntranceClassLabel(paperClass)} Pool ({paperBankStats.totalQuestions} Qs):
                      </span>
                      {paperBankStats.bySubject.map((s, i) => (
                        <React.Fragment key={s.subject}>
                          {i > 0 && <span aria-hidden="true">·</span>}
                          <span>
                            {s.subject} {s.count}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowAnswersInPreview((p) => !p)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {showAnswersInPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showAnswersInPreview ? "Hide Answer Key" : "Show Answer Key"}</span>
              </button>
            </div>
          </div>

          {/* Paper Question Cards */}
          {paperMode === "mixed_offline" ? (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200 px-1 tabular-nums">
                  Section A — Objective Questions ({mixedOfflinePaper.objectiveQuestions.length} Qs · {mixedOfflinePaper.objectiveMarks} Marks)
                </div>
                {mixedOfflinePaper.objectiveQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        Q.{idx + 1} · {q.subject} · 1 Mark
                      </span>
                      <span className="font-mono text-[11px]">
                        {FORMAT_DISPLAY_LABEL[q.format]}
                      </span>
                    </div>
                    {q.passage && (
                      <p className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-slate-700 dark:text-slate-300">
                        <strong>Passage:</strong> {q.passage}
                      </p>
                    )}
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{q.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {q.options.map((opt, oi) => {
                        const isCorrect = oi === q.correctIndex && showAnswersInPreview;
                        return (
                          <div
                            key={oi}
                            className={`px-3 py-1.5 rounded-lg border ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold"
                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            ({OPTION_LETTERS[oi]}) {opt}
                          </div>
                        );
                      })}
                    </div>
                    {showAnswersInPreview && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        <strong>Answer ({OPTION_LETTERS[q.correctIndex]}):</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200 px-1 tabular-nums">
                  Section B — Subjective Questions ({mixedOfflinePaper.subjectiveQuestions.length} Qs · {mixedOfflinePaper.subjectiveMarks} Marks)
                </div>
                {mixedOfflinePaper.subjectiveQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        Q.{idx + 1} · {q.subject} · {q.marks || 2} Marks
                      </span>
                      <span className="font-mono text-[11px]">
                        {FORMAT_DISPLAY_LABEL[q.format]}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{q.question}</p>
                    {showAnswersInPreview && (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                        <strong>Model Answer:</strong> {q.modelAnswer || q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {previewPaper.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      Q.{idx + 1} · {q.subject}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-[11px]">
                      {FORMAT_DISPLAY_LABEL[q.format]}
                      {q.isCustom ? " · Custom" : ""}
                    </span>
                  </div>
                  {q.passage && (
                    <p className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-slate-700 dark:text-slate-300">
                      <strong>Passage:</strong> {q.passage}
                    </p>
                  )}
                  <p className="text-sm font-bold text-slate-950 dark:text-white">{q.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctIndex && showAnswersInPreview;
                      return (
                        <div
                          key={oi}
                          className={`px-3 py-1.5 rounded-lg border ${
                            isCorrect
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          ({OPTION_LETTERS[oi]}) {opt}
                        </div>
                      );
                    })}
                  </div>
                  {showAnswersInPreview && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      <strong>Answer ({OPTION_LETTERS[q.correctIndex]}):</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: CUSTOM PAPER BUILDER (OBJECTIVE + SUBJECTIVE + LIVE PREVIEW + FONT SIZE) */}
      {activeTab === "builder" && (
        <CustomPaperBuilderWorkspace
          school={school}
          customQuestions={customQuestions}
          externalPreset={builderPreset}
          onCustomQuestionsAdded={(added) =>
            setCustomQuestions((prev) => {
              const seen = new Set(added.map((q) => q.id));
              return [...added, ...prev.filter((q) => !seen.has(q.id))];
            })
          }
          onSavedPapersChanged={() => setLibraryRefreshSignal((v) => v + 1)}
          hideLibraryButton={true}
        />
      )}

      {/* TAB 3: CURATED BANK EXPLORER (500 OBJECTIVE + 200 SUBJECTIVE PER SUBJECT) */}
      {activeTab === "bank" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  {formatEntranceClassLabel(bankClass)} {bankKind === "SUBJECTIVE" ? "Subjective Bank" : "Objective MCQ Bank"} ·{" "}
                  {bankStats.totalQuestions} Questions ({bankKind === "SUBJECTIVE" ? "200" : "500"} / Subject)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  {bankKind === "SUBJECTIVE"
                    ? `200 subjective questions per subject (${totalSubjectiveBankCount.toLocaleString("en-IN")} total across Nursery–Class 10)`
                    : `500 objective MCQs per subject (${totalCuratedBankCount.toLocaleString("en-IN")} total across Nursery–Class 10)`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setBankKind("OBJECTIVE")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      bankKind === "OBJECTIVE"
                        ? "bg-sky-600 text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Objective (500/Sub)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankKind("SUBJECTIVE")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      bankKind === "SUBJECTIVE"
                        ? "bg-violet-600 text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Subjective (200/Sub)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setBankShowAnswers((p) => !p)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {bankShowAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{bankShowAnswers ? "Hide Answers" : "Show Answers"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
              {CLASSES.map((cls) => {
                const count =
                  bankKind === "SUBJECTIVE"
                    ? getSubjectiveBankStats(cls).totalQuestions
                    : getEntranceBankStats(cls).totalQuestions;
                const active = bankClass === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setBankClass(cls)}
                    className={`py-2 px-2 rounded-lg border text-center cursor-pointer transition-colors ${
                      active
                        ? "bg-[#070D19] text-white border-[#070D19] dark:border-amber-400"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <div className="text-xs font-bold whitespace-nowrap">{formatEntranceClassLabel(cls)}</div>
                    <div className={`text-[11px] font-mono tabular-nums ${active ? "text-amber-400" : "text-slate-500"}`}>
                      {count} Qs
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBankSubjectFilter("all");
                    setBankPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                    bankSubjectFilter === "all"
                      ? "bg-[#070D19] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  All ({bankStats.totalQuestions})
                </button>
                {bankStats.bySubject.map((sub) => (
                  <button
                    key={sub.subject}
                    type="button"
                    onClick={() => {
                      setBankSubjectFilter(sub.subject);
                      setBankPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                      bankSubjectFilter === sub.subject
                        ? "bg-[#070D19] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {sub.subject} ({sub.count})
                  </button>
                ))}
              </div>

              <div className="relative sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => {
                    setBankSearch(e.target.value);
                    setBankPage(1);
                  }}
                  placeholder="Search topic or keyword..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
            </div>
          </div>

          {bankVisibleQuestions.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
              No questions matched your filter in {formatEntranceClassLabel(bankClass)}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {bankVisibleQuestions.map((q, idx) => {
                const absNumber = (safeBankPage - 1) * BANK_PAGE_SIZE + idx + 1;
                const isSubj = q.questionKind === "SUBJECTIVE" || bankKind === "SUBJECTIVE";
                return (
                  <div
                    key={q.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                        #{absNumber} · {q.subject} · {q.topicTag}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSubj && (
                          <span className="px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 font-bold text-[11px]">
                            {q.marks || 2} Marks
                          </span>
                        )}
                        <span className="font-mono text-[11px]">
                          {FORMAT_DISPLAY_LABEL[q.format]}
                        </span>
                      </div>
                    </div>
                    {q.passage && (
                      <p className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-slate-700 dark:text-slate-300">
                        <strong>Passage:</strong> {q.passage}
                      </p>
                    )}
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{q.question}</p>
                    {!isSubj ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                          {q.options.map((opt, oi) => {
                            const isCorrect = bankShowAnswers && oi === q.correctIndex;
                            return (
                              <div
                                key={oi}
                                className={`px-3 py-1.5 rounded-lg border ${
                                  isCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold"
                                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                ({OPTION_LETTERS[oi]}) {opt}
                              </div>
                            );
                          })}
                        </div>
                        {bankShowAnswers && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            <strong>Answer ({OPTION_LETTERS[q.correctIndex]}):</strong> {q.explanation}
                          </p>
                        )}
                      </>
                    ) : (
                      bankShowAnswers && (
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                          <strong>Model Answer:</strong> {q.modelAnswer || q.explanation}
                        </div>
                      )
                    )}
                  </div>
                );
              })}

              {bankTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Showing {(safeBankPage - 1) * BANK_PAGE_SIZE + 1}–
                    {Math.min(safeBankPage * BANK_PAGE_SIZE, bankFilteredQuestions.length)} of{" "}
                    {bankFilteredQuestions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeBankPage <= 1}
                      onClick={() => setBankPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-mono font-bold tabular-nums">
                      Page {safeBankPage} / {bankTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeBankPage >= bankTotalPages}
                      onClick={() => setBankPage((p) => Math.min(bankTotalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CUSTOM SCHOOL QUESTION MANAGER (SINGLE + BULK UPLOAD FOR PA / HALF YEARLY / FINAL) */}
      {activeTab === "custom" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Custom School Questions &amp; Bulk Upload (PA-1 to PA-4 / Half Yearly / Final Year)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                एक-एक करके या Bulk / JSON Upload से प्रश्न Nursery से Class 10 के किसी भी परीक्षा के लिए जोड़ें।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomBulkModal(true)}
              className="px-4 py-2 rounded-xl bg-[#070D19] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Bulk / JSON Upload (PA / Half Yearly / Final)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleSaveCustomQuestion}
            className="lg:col-span-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                <span>Add Custom Question</span>
              </h3>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setQKind("OBJECTIVE");
                    setQFormat("MCQ");
                  }}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                    qKind === "OBJECTIVE"
                      ? "bg-sky-600 text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Objective (MCQ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQKind("SUBJECTIVE");
                    setQFormat("SHORT_ANSWER");
                  }}
                  className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                    qKind === "SUBJECTIVE"
                      ? "bg-violet-600 text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Subjective
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Exam Tag</label>
                <select
                  value={qExamCategory}
                  onChange={(e) => setQExamCategory(e.target.value as ExamCategoryType)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  {EXAM_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Class</label>
                <select
                  value={qClass}
                  onChange={(e) => setQClass(Number(e.target.value) as EntranceClassNumber)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {formatEntranceClassLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1">Subject</label>
                <select
                  value={qSubject}
                  onChange={(e) => setQSubject(e.target.value as EntranceTestSubject)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  {qBlueprint.quotas.map((q) => (
                    <option key={q.subject} value={q.subject}>
                      {q.subject}
                    </option>
                  ))}
                </select>
              </div>

              {qKind === "OBJECTIVE" ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Type</label>
                    <select
                      value={qFormat}
                      onChange={(e) => setQFormat(e.target.value as EntranceTestQuestionFormat)}
                      className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                    >
                      {FORMAT_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {FORMAT_DISPLAY_LABEL[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Marks</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={qMarks}
                      onChange={(e) => setQMarks(Math.max(1, Math.min(20, Number(e.target.value || 1))))}
                      className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-center"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Marks (1–20M)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={qMarks}
                    onChange={(e) => {
                      const m = Math.max(1, Math.min(20, Number(e.target.value || 2)));
                      setQMarks(m);
                      setQFormat(m >= 3 ? "LONG_ANSWER" : "SHORT_ANSWER");
                    }}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                  />
                </div>
              )}
            </div>

            {editingCustomId && (
              <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <span>Editing Saved Question — बदलाव करके Update दबाएँ</span>
                <button
                  type="button"
                  onClick={handleCancelEditCustom}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-amber-400 text-[11px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {(qFormat === "MINI_PASSAGE" || qPassage.trim().length > 0) && (
              <div>
                <label className="block text-[11px] font-semibold mb-1">Passage / Case Study Text (Optional)</label>
                <textarea
                  rows={2}
                  value={qPassage}
                  onChange={(e) => setQPassage(e.target.value)}
                  placeholder="Enter short passage for the student to read..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold mb-1">Question *</label>
              <textarea
                rows={2}
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
                placeholder={
                  qKind === "SUBJECTIVE"
                    ? "Write subjective question in English or Hindi (e.g. Define Photosynthesis / संज्ञा की परिभाषा लिखें)..."
                    : "Write MCQ question in English or Hindi..."
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            {qKind === "OBJECTIVE" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { val: qOpt0, set: setQOpt0, label: "Option A *" },
                    { val: qOpt1, set: setQOpt1, label: "Option B *" },
                    { val: qOpt2, set: setQOpt2, label: "Option C *" },
                    { val: qOpt3, set: setQOpt3, label: "Option D *" },
                  ].map((opt, idx) => (
                    <div key={idx}>
                      <label className="block text-[11px] font-semibold mb-1">{opt.label}</label>
                      <input
                        type="text"
                        value={opt.val}
                        onChange={(e) => opt.set(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Correct Option</label>
                    <select
                      value={qCorrectIdx}
                      onChange={(e) => setQCorrectIdx(Number(e.target.value) as 0 | 1 | 2 | 3)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                    >
                      {OPTION_LETTERS.map((l, idx) => (
                        <option key={l} value={idx}>
                          Option {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold mb-1">
                      1-Line Answer Explanation (For Answer Key)
                    </label>
                    <input
                      type="text"
                      value={qExplanation}
                      onChange={(e) => setQExplanation(e.target.value)}
                      placeholder="Short solution printed on Answer Key PDF..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    Model Answer / Marking Points * (Answer Key PDF में प्रिंट होगा)
                  </label>
                  <textarea
                    rows={3}
                    value={qModelAnswer}
                    onChange={(e) => setQModelAnswer(e.target.value)}
                    placeholder="Write ideal answer or key points for the Subjective Answer Key..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    Optional OR / अथवा Alternative Question
                  </label>
                  <textarea
                    rows={2}
                    value={qOrQuestion}
                    onChange={(e) => setQOrQuestion(e.target.value)}
                    placeholder="Optional CBSE Internal Choice (OR / अथवा) question..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {editingCustomId && (
                <button
                  type="button"
                  onClick={handleCancelEditCustom}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={savingCustom}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {savingCustom
                    ? "Saving..."
                    : editingCustomId
                    ? "Update Edited Question"
                    : qKind === "SUBJECTIVE"
                    ? "Save Subjective Question (For Paper Builder)"
                    : "Save Objective MCQ to School Pool"}
                </span>
              </button>
            </div>
          </form>

          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-500" />
                <span>Saved School Custom Questions ({customQuestions.length})</span>
              </h3>
            </div>

            {customQuestions.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                अभी कोई कस्टम प्रश्न नहीं जोड़ा गया है। ऊपर से Objective या Subjective प्रश्न जोड़ें — वे Paper Builder में तुरंत चुनने के लिए उपलब्ध होंगे।
              </div>
            ) : (
              customQuestions.map((cq) => {
                const isSubj = cq.questionKind === "SUBJECTIVE";
                return (
                  <div
                    key={cq.id}
                    className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white ${
                            isSubj ? "bg-violet-600" : "bg-sky-600"
                          }`}
                        >
                          {isSubj ? `SUBJECTIVE · ${cq.marks || 2}M` : `OBJECTIVE · ${cq.marks || 1}M`}
                        </span>
                        <span className="font-bold text-sky-700 dark:text-sky-300">
                          {formatEntranceClassLabel(cq.classLevel)} · {cq.subject} · {FORMAT_DISPLAY_LABEL[cq.format] || cq.format}
                          {cq.examCategory ? ` · ${cq.examCategory}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditCustom(cq)}
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 cursor-pointer"
                          aria-label="Edit custom question"
                          title="Edit Question & Marks"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(cq.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          aria-label="Delete custom question"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{cq.question}</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      {isSubj
                        ? `Model Answer: ${cq.modelAnswer || cq.explanation}`
                        : `Answer: (${OPTION_LETTERS[cq.correctIndex]}) ${cq.options[cq.correctIndex]}`}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      )}

      <BulkQuestionUploadModal
        isOpen={showCustomBulkModal}
        onClose={() => setShowCustomBulkModal(false)}
        schoolId={schoolId}
        defaultClass={qClass}
        defaultExamCategory={qExamCategory}
        allowAddToPaper={true}
        defaultSessionOnly={true}
        onQuestionsSaved={(saved, _, wasSaved, importedMeta) => {
          if (wasSaved === false) {
            if (saved.length === 0) return;
            const firstCls = importedMeta?.classLevel ?? saved[0].classLevel;
            const sameClassQs = saved.filter((q) => Number(q.classLevel) === firstCls);
            const catMeta = EXAM_CATEGORY_OPTIONS.find(
              (o) => o.value === (importedMeta?.examCategory || saved[0].examCategory || qExamCategory)
            );
            const marksMap: Record<string, number> = {};
            sameClassQs.forEach((q) => {
              if (q.marks) marksMap[q.id] = q.marks;
            });
            const resolvedTitle =
              importedMeta?.examTitle || catMeta?.title || "School Examination";
            const resolvedDuration = importedMeta?.durationMinutes || (firstCls <= 3 ? 60 : 90);

            setBuilderPreset({
              key: Date.now(),
              classLevel: firstCls,
              paperTitle: resolvedTitle,
              durationMinutes: resolvedDuration,
              questionIds: sameClassQs.map((q) => q.id),
              marksById: marksMap,
              extraQuestions: sameClassQs.map((q) => ({ ...q, isTempSessionOnly: true })),
              importedMeta,
            });
            setActiveTab("builder");

            if (importedMeta?.autoPrintMode && sameClassQs.length > 0) {
              try {
                const nextObj = sameClassQs.filter((q) => q.questionKind !== "SUBJECTIVE");
                const nextSubj = sameClassQs.filter((q) => q.questionKind === "SUBJECTIVE");
                const buildInput = {
                  school,
                  classLevel: firstCls,
                  paperTitle: resolvedTitle,
                  examName: resolvedTitle,
                  sessionLabel: importedMeta.sessionLabel || "2026-27",
                  subjectLabel: importedMeta.subjectLabel,
                  fullMarksOverride: importedMeta.maximumMarks,
                  generalInstructions: importedMeta.generalInstructions,
                  cbseRulesMode: importedMeta.cbseRulesMode || "auto",
                  customBoardRulesHi: importedMeta.customBoardRulesHi,
                  customBoardRulesEn: importedMeta.customBoardRulesEn,
                  printOrientation: importedMeta.printOrientation || "portrait",
                  durationMinutes: resolvedDuration,
                  objectiveQuestions: nextObj,
                  subjectiveQuestions: nextSubj,
                  fontSizePx: firstCls <= 0 ? 10.0 : 9.5,
                  twoColObjective: false,
                  twoColSubjective: false,
                  showWritingLines: firstCls <= 0,
                  mode: importedMeta.autoPrintMode,
                } as const;
                const bundle = buildCustomPaperHtmlBundle(buildInput);
                setPrintPreviewData({
                  title: `${resolvedTitle} · ${formatEntranceClassLabel(firstCls)}`,
                  pagesHtml: bundle.pagesHtml,
                  fullCss: bundle.fullCss,
                  docTitle: bundle.docTitle,
                  orientation: bundle.orientation,
                  mode: importedMeta.autoPrintMode,
                  isMixed: true,
                  customDownloadFn: () => downloadCustomEntrancePaperPdf(buildInput),
                });
                mountAndPrintA4Sync(
                  bundle.pagesHtml,
                  bundle.fullCss,
                  bundle.docTitle,
                  bundle.orientation
                );
              } catch (err: any) {
                toast.error("A4 Print में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
              }
            }
            return;
          }
          setCustomQuestions((prev) => {
            const seen = new Set(saved.map((q) => q.id));
            return [...saved, ...prev.filter((q) => !seen.has(q.id))];
          });
        }}
      />

      <A4PrintPreviewOverlay
        isOpen={Boolean(printPreviewData)}
        title={printPreviewData?.title || "A4 Print Sheet"}
        pagesHtml={printPreviewData?.pagesHtml || []}
        scopedCss={printPreviewData?.fullCss || ""}
        docTitle={printPreviewData?.docTitle || "Question_Paper_A4"}
        orientation={printPreviewData?.orientation || "portrait"}
        onClose={() => setPrintPreviewData(null)}
        onDownloadPdfFallback={
          printPreviewData
            ? () =>
                printPreviewData.customDownloadFn
                  ? printPreviewData.customDownloadFn()
                  : printPreviewData.isMixed
                  ? downloadCustomEntrancePaperPdf({
                      school,
                      classLevel: paperClass,
                      paperTitle: `Offline Entrance Assessment (${mixedOfflinePaper.setId})`,
                      examName: `Admission Entrance Assessment · ${mixedOfflinePaper.setId}`,
                      sessionLabel: "2026-27",
                      durationMinutes: mixedOfflinePaper.durationMinutes,
                      objectiveQuestions: mixedOfflinePaper.objectiveQuestions,
                      subjectiveQuestions: mixedOfflinePaper.subjectiveQuestions,
                      fontSizePx: mixedFontSizePx,
                      twoColObjective: false,
                      twoColSubjective: false,
                      showWritingLines: mixedShowLines,
                      mode: printPreviewData.mode,
                    })
                  : downloadEntrancePaperPdf({
                      school,
                      paper: previewPaper,
                      mode: printPreviewData.mode,
                    })
            : undefined
        }
      />
    </div>
  );
};
