import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Loader2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Split,
  Trash2,
  Type,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ALL_ENTRANCE_CLASSES,
  formatEntranceClassLabel,
  type CbseBoardRulesMode,
  type EntranceClassNumber,
  type EntranceTestQuestion,
  type EntranceTestSubject,
  type ExamCategoryType,
  type PaperPrintOrientation,
  type SavedSchoolQuestionPaper,
  type School,
} from "../../school-types";
import {
  getCuratedQuestionsForClass,
  getSubjectiveQuestionsForClass,
} from "../../data/entranceTestQuestionBank";
import {
  FORMAT_DISPLAY_LABEL,
  TOTAL_PAPER_SETS,
  createSeededRng,
  deleteSavedSchoolQuestionPaper,
  getClassTestBlueprint,
  getSavedSchoolQuestionPapers,
  saveSchoolQuestionPaper,
  seededShuffle,
  togglePublishSchoolQuestionPaper,
} from "../../utils/entranceTestEngine";
import {
  buildCustomPaperHtmlBundle,
  computeBookletSpreadPlan,
  downloadCustomEntrancePaperPdf,
  estimateCustomPaperLayout,
  getSubjectiveWritingLineCount,
  resolveCbseBoardRules,
  resolveExamPaperMasthead,
  resolveItemGroupHeading,
  sanitizePaperText,
  type CustomNumberedItem,
  type PaperPrintTheme,
} from "../../utils/entrancePaperPdf";
import { mountAndPrintA4Sync } from "../../utils/a4PrintHelper";
import { A4PrintPreviewOverlay } from "./A4PrintPreviewOverlay";
import {
  BulkQuestionUploadModal,
  EXAM_CATEGORY_OPTIONS,
  type ImportedPaperMetadata,
} from "./BulkQuestionUploadModal";

export interface CustomBuilderPresetPayload {
  key: number;
  classLevel: EntranceClassNumber;
  paperTitle: string;
  durationMinutes: number;
  questionIds: string[];
  marksById?: Record<string, number>;
  extraQuestions?: EntranceTestQuestion[];
  importedMeta?: ImportedPaperMetadata;
  savedPaperToLoad?: SavedSchoolQuestionPaper;
}

interface Props {
  school: School;
  customQuestions: EntranceTestQuestion[];
  externalPreset?: CustomBuilderPresetPayload | null;
  onCustomQuestionsAdded?: (added: EntranceTestQuestion[]) => void;
  onSavedPapersChanged?: () => void;
  onOpenLibrary?: () => void;
  hideLibraryButton?: boolean;
}

const CLASSES: EntranceClassNumber[] = ALL_ENTRANCE_CLASSES;
const OPTION_LETTERS_UPPER = ["A", "B", "C", "D"] as const;
const OPTION_LETTERS_LOWER = ["a", "b", "c", "d"] as const;
const SENIOR_MAX_OBJECTIVE = 10;

const DEFAULT_INSTRUCTIONS_PRIMARY = [
  "All questions are compulsory. Write answers neatly in the space provided below each question.",
  "Read every question carefully before ticking (✓) the correct option or writing the answer.",
];

const DEFAULT_INSTRUCTIONS_SENIOR = [
  "All questions are compulsory. Figures to the right indicate full marks.",
  "Section A contains Objective MCQs (1 Mark each). Section B contains Short & Long Answer questions.",
];

type PickerTypeFilter = "all" | "objective" | "subjective" | "custom" | "selected";
type PreviewSheetTab = "all" | "key" | `page_${number}`;

function groupConsecutiveByHeading(
  items: CustomNumberedItem[],
  distinctSubjectCount: number
): Array<{ subject: string; items: CustomNumberedItem[] }> {
  const groups: Array<{ subject: string; items: CustomNumberedItem[] }> = [];
  for (const it of items) {
    const heading = resolveItemGroupHeading(it.q, distinctSubjectCount);
    const last = groups[groups.length - 1];
    if (last && last.subject === heading) {
      last.items.push(it);
    } else {
      groups.push({ subject: heading, items: [it] });
    }
  }
  return groups;
}

type OrOverrideEntry = { orQuestion: string; orModelAnswer?: string } | null;

function buildGeneratedSetPlan(params: {
  classLevel: EntranceClassNumber;
  quotas: Array<{ subject: EntranceTestSubject; count: number }>;
  allPool: EntranceTestQuestion[];
  preferredExamCategory?: ExamCategoryType;
  targetSubject?: "ALL" | EntranceTestSubject;
  setNumber?: number;
  enableInternalChoice?: boolean;
}): {
  pickedIds: string[];
  orOverrides: Record<string, OrOverrideEntry>;
} {
  const {
    classLevel,
    quotas,
    allPool,
    preferredExamCategory,
    targetSubject = "ALL",
    setNumber = 1,
    enableInternalChoice = false,
  } = params;

  const safeSet = Math.max(1, Math.min(TOTAL_PAPER_SETS, Math.round(setNumber || 1)));
  const rng = createSeededRng(
    `${classLevel}::${preferredExamCategory || "ENTRANCE"}::${targetSubject}::SET_${safeSet}`
  );

  // Partition into priority (matching examCategory / custom / temp) and general bank, shuffling each deterministically per setNumber
  const prioritizeAndShuffle = (list: EntranceTestQuestion[]) => {
    const shuffled = seededShuffle(list, rng);
    if (!preferredExamCategory || preferredExamCategory === "ENTRANCE") {
      return shuffled;
    }
    const matching = shuffled.filter((q) => q.examCategory === preferredExamCategory);
    const others = shuffled.filter((q) => q.examCategory !== preferredExamCategory);
    return [...matching, ...others];
  };

  const objBySub = new Map<EntranceTestSubject, EntranceTestQuestion[]>();
  const subjBySub = new Map<EntranceTestSubject, EntranceTestQuestion[]>();

  for (const q of allPool) {
    const targetMap = q.questionKind === "SUBJECTIVE" ? subjBySub : objBySub;
    const list = targetMap.get(q.subject) || [];
    list.push(q);
    targetMap.set(q.subject, list);
  }

  for (const [sub, list] of objBySub.entries()) {
    objBySub.set(sub, prioritizeAndShuffle(list));
  }
  for (const [sub, list] of subjBySub.entries()) {
    subjBySub.set(sub, prioritizeAndShuffle(list));
  }

  const pickedObjs: EntranceTestQuestion[] = [];
  const pickedSubjs: EntranceTestQuestion[] = [];
  const pickedIdSet = new Set<string>();

  if (targetSubject !== "ALL") {
    // Single-subject PA / Half Yearly / Final / Entrance paper
    const subObjs = objBySub.get(targetSubject) || [];
    const subSubjs = subjBySub.get(targetSubject) || [];
    const maxObj = classLevel <= 3 ? 6 : SENIOR_MAX_OBJECTIVE;
    const maxSubj = classLevel <= 3 ? 6 : 10;

    for (const q of subObjs.slice(0, maxObj)) {
      if (!pickedIdSet.has(q.id)) {
        pickedIdSet.add(q.id);
        pickedObjs.push(q);
      }
    }
    for (const q of subSubjs.slice(0, maxSubj)) {
      if (!pickedIdSet.has(q.id)) {
        pickedIdSet.add(q.id);
        pickedSubjs.push(q);
      }
    }
  } else if (classLevel <= 3) {
    // Pre-Primary (Nursery/LKG/UKG) & Class 1-3: Question-cum-Answer paper
    for (const qt of quotas) {
      for (const x of (objBySub.get(qt.subject) || []).slice(0, 2)) {
        if (!pickedIdSet.has(x.id)) {
          pickedIdSet.add(x.id);
          pickedObjs.push(x);
        }
      }
    }
    for (const qt of quotas) {
      for (const x of (subjBySub.get(qt.subject) || []).slice(0, 2)) {
        if (!pickedIdSet.has(x.id)) {
          pickedIdSet.add(x.id);
          pickedSubjs.push(x);
        }
      }
    }
  } else {
    // Class 4-10: Strict max 10 Objective + rest Subjective across all blueprint subjects
    let objRemaining = SENIOR_MAX_OBJECTIVE;
    quotas.forEach((qt, idx) => {
      if (objRemaining <= 0) return;
      const quotaPerSub = quotas.length <= 4 ? (idx < 2 ? 3 : 2) : 2;
      const take = Math.min(objRemaining, quotaPerSub);
      const chosen = (objBySub.get(qt.subject) || []).slice(0, take);
      chosen.forEach((x) => {
        if (!pickedIdSet.has(x.id)) {
          pickedIdSet.add(x.id);
          pickedObjs.push(x);
          objRemaining--;
        }
      });
    });
    const subjPerSub = quotas.length <= 4 ? 3 : 2;
    for (const qt of quotas) {
      for (const x of (subjBySub.get(qt.subject) || []).slice(0, subjPerSub)) {
        if (!pickedIdSet.has(x.id)) {
          pickedIdSet.add(x.id);
          pickedSubjs.push(x);
        }
      }
    }
  }

  // CBSE Internal Choice ("OR / अथवा") Auto-Pairing using unused same-subject subjective questions
  const generatedOrOverrides: Record<string, OrOverrideEntry> = {};
  if (enableInternalChoice && pickedSubjs.length > 0) {
    const maxOrPairs = targetSubject !== "ALL" ? (classLevel <= 3 ? 3 : 4) : classLevel <= 3 ? 2 : 4;
    let pairedCount = 0;

    // Prefer pairing longer / higher-mark subjective items first (reversed or long answers first)
    const candidateHosts = [...pickedSubjs].sort(
      (a, b) => (b.marks || 2) - (a.marks || 2)
    );

    for (const host of candidateHosts) {
      if (pairedCount >= maxOrPairs) break;
      if (host.orQuestion) {
        pairedCount++;
        continue;
      }
      const sameSubPool = (subjBySub.get(host.subject) || []).filter(
        (cand) => !pickedIdSet.has(cand.id) && cand.id !== host.id
      );
      if (sameSubPool.length === 0) continue;

      const sameMarksCand =
        sameSubPool.find((c) => (c.marks || 2) === (host.marks || 2)) || sameSubPool[0];
      pickedIdSet.add(sameMarksCand.id);
      generatedOrOverrides[host.id] = {
        orQuestion: sameMarksCand.question,
        orModelAnswer: sameMarksCand.modelAnswer || sameMarksCand.explanation,
      };
      pairedCount++;
    }
  }

  return {
    pickedIds: [...pickedObjs.map((x) => x.id), ...pickedSubjs.map((x) => x.id)],
    orOverrides: generatedOrOverrides,
  };
}

export const CustomPaperBuilderWorkspace: React.FC<Props> = ({
  school,
  customQuestions,
  externalPreset = null,
  onCustomQuestionsAdded,
  onSavedPapersChanged,
  onOpenLibrary,
  hideLibraryButton = false,
}) => {
  const [selectedClass, setSelectedClass] = useState<EntranceClassNumber>(
    externalPreset?.classLevel || 1
  );
  const [examCategory, setExamCategory] = useState<ExamCategoryType>("ENTRANCE");
  const [paperTitle, setPaperTitle] = useState<string>(
    externalPreset?.paperTitle || "Admission Entrance Examination"
  );
  const [sessionLabel, setSessionLabel] = useState<string>("2026-27");
  const [subjectLabel, setSubjectLabel] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(
    externalPreset?.durationMinutes || 60
  );

  // Editable Header / Metadata fields (5-part structured masthead — strictly no Trust name)
  const initialMasthead = useMemo(() => resolveExamPaperMasthead(school), [school]);
  const [showHeaderEditor, setShowHeaderEditor] = useState<boolean>(false);
  const [schoolNameOverride, setSchoolNameOverride] = useState<string>(initialMasthead.schoolName);
  const [schoolTaglineOverride, setSchoolTaglineOverride] = useState<string>(initialMasthead.tagline);
  const [schoolAddressOverride, setSchoolAddressOverride] = useState<string>(initialMasthead.address);
  const [schoolContactOverride, setSchoolContactOverride] = useState<string>(
    initialMasthead.contactLine
  );
  const [logoPosition, setLogoPosition] = useState<"left" | "center">("left");
  const [fullMarksOverrideInput, setFullMarksOverrideInput] = useState<string>("");
  const [examDate, setExamDate] = useState<string>("");
  const [paperCode, setPaperCode] = useState<string>("");
  const [showStudentStrip, setShowStudentStrip] = useState<boolean>(true);
  const [paperTheme, setPaperTheme] = useState<PaperPrintTheme>("classic_bw");
  const [cbseRulesMode, setCbseRulesMode] = useState<CbseBoardRulesMode>("auto");
  const [customBoardRulesHi, setCustomBoardRulesHi] = useState<string[]>([]);
  const [customBoardRulesEn, setCustomBoardRulesEn] = useState<string[]>([]);
  const [instructionsText, setInstructionsText] = useState<string>(
    (externalPreset?.classLevel ?? 1) <= 0
      ? DEFAULT_INSTRUCTIONS_PRIMARY.join("\n")
      : DEFAULT_INSTRUCTIONS_SENIOR.join("\n")
  );
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);

  // Picker filters
  const [typeFilter, setTypeFilter] = useState<PickerTypeFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pickerPage, setPickerPage] = useState<number>(1);
  const [peekAnswerIds, setPeekAnswerIds] = useState<Record<string, boolean>>({});

  // Selected ordered IDs, subjective marks, CBSE internal choice ("OR") & full Question Edits
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marksOverrides, setMarksOverrides] = useState<Record<string, number>>({});
  const [orOverrides, setOrOverrides] = useState<Record<string, OrOverrideEntry>>({});
  const [manualPageOverrides, setManualPageOverrides] = useState<Record<string, number>>({});
  const [questionEdits, setQuestionEdits] = useState<
    Record<string, Partial<EntranceTestQuestion>>
  >({});
  const [editingQuestion, setEditingQuestion] = useState<EntranceTestQuestion | null>(null);
  const [orEditorId, setOrEditorId] = useState<string | null>(null);
  const [orDraftQuestion, setOrDraftQuestion] = useState<string>("");
  const [orDraftAnswer, setOrDraftAnswer] = useState<string>("");

  // Session-wise Saved & Student-Published Question Bank Papers
  const [savedPapers, setSavedPapers] = useState<SavedSchoolQuestionPaper[]>([]);
  const [activeSavedPaperId, setActiveSavedPaperId] = useState<string | null>(null);
  const [showSavedPapersPanel, setShowSavedPapersPanel] = useState<boolean>(false);
  const [savingPaper, setSavingPaper] = useState<boolean>(false);
  const [savedSessionFilter, setSavedSessionFilter] = useState<string>("ALL");

  // Unique Set Generator (1..1000 per class & subject) & CBSE OR auto-pairing toggle
  const [targetSubject, setTargetSubject] = useState<"ALL" | EntranceTestSubject>("ALL");
  const [setNumber, setSetNumber] = useState<number>(1);
  const [enableInternalChoice, setEnableInternalChoice] = useState<boolean>(false);

  // Print-Only / Transient Session Questions (from JSON/File upload — NEVER persisted to storage/Firebase)
  const [sessionOnlyQuestions, setSessionOnlyQuestions] = useState<EntranceTestQuestion[]>([]);

  const skipNextAutoSeedRef = React.useRef<boolean>(Boolean(externalPreset));

  useEffect(() => {
    const sid = school?.id || "";
    if (!sid) return;
    let alive = true;
    getSavedSchoolQuestionPapers(sid).then((list) => {
      if (alive) setSavedPapers(list);
    });
    return () => {
      alive = false;
    };
  }, [school?.id]);

  // Live Typography & Layout controls (ONLY Nursery, LKG/KG-1, UKG/KG-2 get Answer Lines ON; Class 1–10 are Questions Only)
  const initialClass = externalPreset?.classLevel ?? 1;
  const [fontSizePx, setFontSizePx] = useState<number>(initialClass <= 0 ? 10.0 : 9.5);
  const [printOrientation, setPrintOrientation] = useState<PaperPrintOrientation>("portrait");
  const [twoColObjective, setTwoColObjective] = useState<boolean>(false);
  const [twoColSubjective, setTwoColSubjective] = useState<boolean>(false);
  const [showWritingLines, setShowWritingLines] = useState<boolean>(initialClass <= 0);
  const [previewSheet, setPreviewSheet] = useState<PreviewSheetTab>("all");
  const [showPickerAnswers, setShowPickerAnswers] = useState<boolean>(false);
  const [downloadingMode, setDownloadingMode] = useState<"full" | "questions_only" | null>(null);
  const [printPreviewData, setPrintPreviewData] = useState<{
    title: string;
    pagesHtml: string[];
    fullCss: string;
    docTitle: string;
    orientation: "portrait" | "landscape";
    mode: "full" | "questions_only";
  } | null>(null);

  const isPrimaryQuestionCumAnswer = selectedClass <= 0;
  const effectiveShowWritingLines = isPrimaryQuestionCumAnswer ? showWritingLines : false;
  const blueprint = useMemo(() => getClassTestBlueprint(selectedClass), [selectedClass]);

  const classPools = useMemo(() => {
    const objCurated = getCuratedQuestionsForClass(selectedClass).map((q) => ({
      ...q,
      questionKind: "OBJECTIVE" as const,
      marks: q.marks || 1,
    }));
    const subjCurated = getSubjectiveQuestionsForClass(selectedClass).map((q) => ({
      ...q,
      questionKind: "SUBJECTIVE" as const,
      marks: q.marks || (q.format === "LONG_ANSWER" ? 3 : 2),
    }));
    const classCustom = customQuestions
      .filter((q) => Number(q.classLevel) === selectedClass)
      .map((q) => ({
        ...q,
        questionKind: q.questionKind || ("OBJECTIVE" as const),
        marks: q.marks || (q.questionKind === "SUBJECTIVE" ? 2 : 1),
      }));
    const classTemp = sessionOnlyQuestions
      .filter((q) => Number(q.classLevel) === selectedClass)
      .map((q) => ({
        ...q,
        isTempSessionOnly: true,
        questionKind: q.questionKind || ("OBJECTIVE" as const),
        marks: q.marks || (q.questionKind === "SUBJECTIVE" ? 2 : 1),
      }));
    const presetExtras = (externalPreset?.extraQuestions || []).filter(
      (q) => Number(q.classLevel) === selectedClass
    );

    const raw = [...classTemp, ...classCustom, ...presetExtras, ...objCurated, ...subjCurated];
    const byId = new Map<string, EntranceTestQuestion>();
    for (const q of raw) {
      if (!byId.has(q.id)) byId.set(q.id, q);
    }
    const all = Array.from(byId.values());
    return {
      all,
      byId,
      objCount: all.filter((q) => q.questionKind !== "SUBJECTIVE").length,
      subjCount: all.filter((q) => q.questionKind === "SUBJECTIVE").length,
      customCount: new Set([...classCustom, ...classTemp].map((q) => q.id)).size,
      sessionOnlyCount: classTemp.length,
    };
  }, [selectedClass, customQuestions, sessionOnlyQuestions, externalPreset]);

  // Apply external preset when user clicks "Edit in Paper Builder", opens from Digital Library, or imports Print-Only from Custom tab
  useEffect(() => {
    if (!externalPreset) return;
    if (externalPreset.savedPaperToLoad) {
      const paper = externalPreset.savedPaperToLoad;
      const allQs = [...(paper.objectiveQuestions || []), ...(paper.subjectiveQuestions || [])];
      if (allQs.length > 0) {
        skipNextAutoSeedRef.current = paper.classLevel !== selectedClass;
        setActiveSavedPaperId(paper.id);
        setSelectedClass(paper.classLevel);
        setExamCategory(paper.examCategory || "PA1");
        setPaperTitle(paper.paperTitle);
        setSessionLabel(paper.sessionLabel || "2026-27");
        setSubjectLabel(paper.subjectLabel || "");
        setFullMarksOverrideInput(paper.fullMarks ? String(paper.fullMarks) : "");
        setDurationMinutes(paper.durationMinutes || 60);
        setPaperCode(paper.paperCode || "");
        setExamDate(paper.examDate || "");
        if (paper.generalInstructions && paper.generalInstructions.length > 0) {
          setInstructionsText(paper.generalInstructions.join("\n"));
        }
        setCbseRulesMode(paper.cbseRulesMode || "auto");
        setCustomBoardRulesHi(paper.customBoardRulesHi || []);
        setCustomBoardRulesEn(paper.customBoardRulesEn || []);
        setPrintOrientation(paper.printOrientation || "portrait");
        setTwoColObjective(Boolean(paper.twoColObjective));
        setTwoColSubjective(Boolean(paper.twoColSubjective));
        if (paper.showStudentStrip !== undefined) setShowStudentStrip(paper.showStudentStrip);
        if (paper.paperTheme) setPaperTheme(paper.paperTheme as PaperPrintTheme);
        setShowWritingLines(paper.classLevel <= 0);
        setFontSizePx(
          paper.fontSizePx
            ? Math.max(5.5, Math.min(13.5, paper.fontSizePx))
            : paper.classLevel <= 0
            ? 10.0
            : 9.5
        );
        setSessionOnlyQuestions((prev) => {
          const seen = new Set(allQs.map((q) => q.id));
          return [...allQs, ...prev.filter((p) => !seen.has(p.id))];
        });
        setSelectedIds(allQs.map((q) => q.id));
        const restoredMarks: Record<string, number> = {};
        allQs.forEach((q) => {
          if (q.marks) restoredMarks[q.id] = q.marks;
        });
        setMarksOverrides(restoredMarks);
        setOrOverrides({});
        setManualPageOverrides(paper.manualPageOverrides || {});
        setQuestionEdits({});
        setTypeFilter("selected");
        setPreviewSheet("all");
        setShowSavedPapersPanel(false);
        return;
      }
    }
    const meta = externalPreset.importedMeta;
    const cls = meta?.classLevel ?? externalPreset.classLevel;
    skipNextAutoSeedRef.current = cls !== selectedClass;
    setSelectedClass(cls);
    setPaperTitle(meta?.examTitle || externalPreset.paperTitle);
    setDurationMinutes(meta?.durationMinutes || externalPreset.durationMinutes);
    if (meta?.examCategory) setExamCategory(meta.examCategory);
    if (meta?.subjectLabel) setSubjectLabel(meta.subjectLabel);
    if (meta?.sessionLabel) setSessionLabel(meta.sessionLabel);
    if (meta?.maximumMarks) setFullMarksOverrideInput(String(meta.maximumMarks));
    if (meta?.cbseRulesMode) setCbseRulesMode(meta.cbseRulesMode);
    if (meta?.printOrientation) setPrintOrientation(meta.printOrientation);
    if (meta?.customBoardRulesHi || meta?.customBoardRulesEn) {
      setCustomBoardRulesHi(meta.customBoardRulesHi || []);
      setCustomBoardRulesEn(meta.customBoardRulesEn || []);
    }
    setShowWritingLines(cls <= 0);
    setTwoColSubjective(false);
    setFontSizePx(cls <= 0 ? 10.0 : 9.5);
    setInstructionsText(
      meta?.generalInstructions && meta.generalInstructions.length > 0
        ? meta.generalInstructions.join("\n")
        : cls <= 0
        ? DEFAULT_INSTRUCTIONS_PRIMARY.join("\n")
        : DEFAULT_INSTRUCTIONS_SENIOR.join("\n")
    );
    setOrOverrides({});
    setManualPageOverrides({});

    const isTempImport = Boolean(externalPreset.extraQuestions?.some((q) => q.isTempSessionOnly));
    if (isTempImport && externalPreset.extraQuestions) {
      const temps = externalPreset.extraQuestions.filter((q) => q.isTempSessionOnly);
      setSessionOnlyQuestions((prev) => {
        const seen = new Set(temps.map((t) => t.id));
        return [...temps, ...prev.filter((p) => !seen.has(p.id))];
      });
    }

    const uniquePresetIds = Array.from(new Set(externalPreset.questionIds));
    // Never cap externally imported JSON/file papers — keep all uploaded questions intact!
    if (cls >= 4 && !isTempImport && !meta) {
      const lookup = new Map<string, EntranceTestQuestion>();
      (externalPreset.extraQuestions || []).forEach((q) => lookup.set(q.id, q));
      let objSeen = 0;
      const capped: string[] = [];
      for (const id of uniquePresetIds) {
        const q = lookup.get(id) || classPools.byId.get(id);
        const isObj = q ? q.questionKind !== "SUBJECTIVE" : false;
        if (isObj) {
          if (objSeen >= SENIOR_MAX_OBJECTIVE) continue;
          objSeen++;
        }
        capped.push(id);
      }
      setSelectedIds(capped);
    } else {
      setSelectedIds(uniquePresetIds);
    }

    setMarksOverrides(externalPreset.marksById || {});
    setPreviewSheet("all");
    setSubjectFilter("all");
    setTypeFilter("selected");
    setPickerPage(1);
  }, [externalPreset?.key]);

  // Seed balanced unique set & apply class-appropriate defaults on class switch
  useEffect(() => {
    if (skipNextAutoSeedRef.current) {
      skipNextAutoSeedRef.current = false;
      return;
    }
    setSubjectFilter("all");
    setPickerPage(1);
    const validTarget =
      targetSubject === "ALL" || blueprint.quotas.some((qt) => qt.subject === targetSubject)
        ? targetSubject
        : "ALL";
    if (validTarget !== targetSubject) {
      setTargetSubject("ALL");
      setSubjectLabel("");
    }

    if (selectedClass <= 0) {
      setShowWritingLines(true);
      setTwoColSubjective(false);
      setFontSizePx(10.0);
      setInstructionsText(DEFAULT_INSTRUCTIONS_PRIMARY.join("\n"));
    } else {
      setShowWritingLines(false);
      setTwoColSubjective(false);
      setFontSizePx(9.5);
      setInstructionsText(DEFAULT_INSTRUCTIONS_SENIOR.join("\n"));
    }

    const plan = buildGeneratedSetPlan({
      classLevel: selectedClass,
      quotas: blueprint.quotas,
      allPool: classPools.all,
      preferredExamCategory: examCategory,
      targetSubject: validTarget,
      setNumber,
      enableInternalChoice,
    });
    setSelectedIds(plan.pickedIds);
    setOrOverrides(plan.orOverrides);
    setManualPageOverrides({});
    setPaperCode(`SET-${String(setNumber).padStart(setNumber >= 100 ? 3 : 2, "0")}`);
  }, [selectedClass]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const { selectedObjective, selectedSubjective } = useMemo(() => {
    const objs: EntranceTestQuestion[] = [];
    const subjs: EntranceTestQuestion[] = [];
    for (const id of selectedIds) {
      const rawBase = classPools.byId.get(id);
      if (!rawBase) continue;
      const editPatch = questionEdits[id];
      const base: EntranceTestQuestion = editPatch ? { ...rawBase, ...editPatch } : rawBase;
      const effectiveMarks = marksOverrides[id] ?? base.marks;
      const override = orOverrides[id];
      const item: EntranceTestQuestion = {
        ...base,
        marks: effectiveMarks,
        ...(override === null
          ? { orQuestion: undefined, orModelAnswer: undefined, orPassage: undefined }
          : override
          ? { orQuestion: override.orQuestion, orModelAnswer: override.orModelAnswer }
          : {}),
      };
      if (item.questionKind === "SUBJECTIVE") {
        subjs.push(item);
      } else {
        objs.push(item);
      }
    }
    return { selectedObjective: objs, selectedSubjective: subjs };
  }, [selectedIds, classPools.byId, marksOverrides, orOverrides, questionEdits]);

  const parsedInstructions = useMemo(
    () =>
      instructionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4),
    [instructionsText]
  );

  const parsedFullMarksOverride = useMemo(() => {
    const n = Number(fullMarksOverrideInput);
    return fullMarksOverrideInput.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }, [fullMarksOverrideInput]);

  const layout = useMemo(
    () =>
      estimateCustomPaperLayout({
        classLevel: selectedClass,
        durationMinutes,
        subjectLabel,
        objectiveQuestions: selectedObjective,
        subjectiveQuestions: selectedSubjective,
        fontSizePx,
        twoColObjective,
        twoColSubjective,
        showWritingLines: effectiveShowWritingLines,
        generalInstructions: parsedInstructions,
        cbseRulesMode,
        customBoardRulesHi,
        customBoardRulesEn,
        showStudentStrip,
        manualPageOverrides,
      }),
    [
      selectedClass,
      durationMinutes,
      subjectLabel,
      selectedObjective,
      selectedSubjective,
      fontSizePx,
      twoColObjective,
      twoColSubjective,
      effectiveShowWritingLines,
      parsedInstructions,
      cbseRulesMode,
      customBoardRulesHi,
      customBoardRulesEn,
      showStudentStrip,
      manualPageOverrides,
    ]
  );

  // If user moves the last question off a previewed page, keep preview tab valid
  useEffect(() => {
    if (previewSheet.startsWith("page_")) {
      const pgNum = Number(previewSheet.replace("page_", ""));
      if (!layout.pages.some((p) => p.pageNumber === pgNum)) {
        setPreviewSheet("all");
      }
    }
  }, [layout.pages, previewSheet]);

  const manualMoveCount = Object.keys(manualPageOverrides).length;

  const handleMoveQuestionToPage = (questionId: string, targetPage: number) => {
    const cleanTarget = Math.max(1, Math.min(20, Math.round(targetPage)));
    setManualPageOverrides((prev) => ({ ...prev, [questionId]: cleanTarget }));
    toast.success(
      `Question Page ${cleanTarget} par shift ho gaya — khali jagah aur serial numbers auto-adjust ho gaye!`
    );
  };

  const handleUnpinQuestionPage = (questionId: string) => {
    setManualPageOverrides((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    toast.info("Question ka manual page lock hata diya gaya (auto-flow restored).");
  };

  const handleResetAllPageMoves = () => {
    setManualPageOverrides({});
    toast.info("Sabhi manual page moves reset ho gaye — paper auto-pack mode me hai.");
  };

  const previewCbseRules = useMemo(
    () =>
      resolveCbseBoardRules({
        classLevel: selectedClass,
        cbseRulesMode,
        customBoardRulesHi,
        customBoardRulesEn,
        objectiveQuestions: selectedObjective,
        subjectiveQuestions: selectedSubjective,
        subjectLabel,
        totalPages: layout.questionPageCount,
        totalQuestions: selectedObjective.length + selectedSubjective.length,
        durationMinutes,
      }),
    [
      selectedClass,
      cbseRulesMode,
      customBoardRulesHi,
      customBoardRulesEn,
      selectedObjective,
      selectedSubjective,
      subjectLabel,
      layout.questionPageCount,
      durationMinutes,
    ]
  );

  const fullMarksDisplay = parsedFullMarksOverride ?? layout.totalMarks;

  const distinctSubjectCount = useMemo(() => {
    const s = new Set<string>();
    selectedObjective.forEach((q) => s.add(q.subject));
    selectedSubjective.forEach((q) => s.add(q.subject));
    return s.size;
  }, [selectedObjective, selectedSubjective]);

  const filteredPool = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return classPools.all.filter((item) => {
      const isSubj = item.questionKind === "SUBJECTIVE";
      if (typeFilter === "objective" && isSubj) return false;
      if (typeFilter === "subjective" && !isSubj) return false;
      if (typeFilter === "custom" && !item.isCustom) return false;
      if (typeFilter === "selected" && !selectedIdSet.has(item.id)) return false;
      if (subjectFilter !== "all" && item.subject !== subjectFilter) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        (item.topicTag || "").toLowerCase().includes(q) ||
        (item.modelAnswer || item.explanation || "").toLowerCase().includes(q)
      );
    });
  }, [classPools.all, typeFilter, subjectFilter, searchQuery, selectedIdSet]);

  const PAGE_SIZE = 20;
  const totalPickerPages = Math.max(1, Math.ceil(filteredPool.length / PAGE_SIZE));
  const safePickerPage = Math.min(pickerPage, totalPickerPages);
  const visiblePool = useMemo(
    () => filteredPool.slice((safePickerPage - 1) * PAGE_SIZE, safePickerPage * PAGE_SIZE),
    [filteredPool, safePickerPage]
  );

  const runGenerateSet = (
    nextSetNo: number,
    opts?: {
      nextSubject?: "ALL" | EntranceTestSubject;
      nextOrEnabled?: boolean;
      nextCategory?: ExamCategoryType;
      silent?: boolean;
    }
  ) => {
    const clampedSet = Math.max(1, Math.min(TOTAL_PAPER_SETS, Math.round(nextSetNo || 1)));
    const subjScope = opts?.nextSubject ?? targetSubject;
    const orEnabled = opts?.nextOrEnabled ?? enableInternalChoice;
    const catScope = opts?.nextCategory ?? examCategory;

    setSetNumber(clampedSet);
    const plan = buildGeneratedSetPlan({
      classLevel: selectedClass,
      quotas: blueprint.quotas,
      allPool: classPools.all,
      preferredExamCategory: catScope,
      targetSubject: subjScope,
      setNumber: clampedSet,
      enableInternalChoice: orEnabled,
    });
    setSelectedIds(plan.pickedIds);
    setOrOverrides(plan.orOverrides);
    setManualPageOverrides({});
    setPaperCode(`SET-${String(clampedSet).padStart(clampedSet >= 100 ? 3 : 2, "0")}`);
    if (subjScope !== "ALL") {
      setSubjectLabel(subjScope);
      setSubjectFilter(subjScope);
    } else if (opts?.nextSubject === "ALL") {
      setSubjectLabel("");
      setSubjectFilter("all");
    }

    if (selectedClass <= 3) {
      setShowWritingLines(true);
      setTwoColSubjective(false);
      setFontSizePx(10.0);
    } else {
      setShowWritingLines(false);
      setTwoColSubjective(false);
      setFontSizePx(9.5);
    }

    if (!opts?.silent) {
      const orCount = Object.values(plan.orOverrides).filter(Boolean).length;
      toast.success(
        `${formatEntranceClassLabel(selectedClass)} · Set-${String(clampedSet).padStart(2, "0")} (${
          subjScope === "ALL" ? "All Subjects" : subjScope
        }) तैयार! ${plan.pickedIds.length} Qs${orCount > 0 ? ` · ${orCount} CBSE OR Choices` : ""}`
      );
    }
  };

  const handleExamCategoryChange = (nextCat: ExamCategoryType) => {
    setExamCategory(nextCat);
    const meta = EXAM_CATEGORY_OPTIONS.find((x) => x.value === nextCat);
    if (meta) {
      setPaperTitle(meta.title);
    }
    const isSchoolPeriodicOrTerm =
      nextCat === "PA1" ||
      nextCat === "PA2" ||
      nextCat === "PA3" ||
      nextCat === "PA4" ||
      nextCat === "HALF_YEARLY" ||
      nextCat === "FINAL_YEAR";
    setEnableInternalChoice(isSchoolPeriodicOrTerm);

    if (nextCat === "PA1" || nextCat === "PA2" || nextCat === "PA3" || nextCat === "PA4") {
      setDurationMinutes(selectedClass <= 3 ? 45 : 60);
    } else if (nextCat === "HALF_YEARLY" || nextCat === "FINAL_YEAR") {
      setDurationMinutes(selectedClass <= 3 ? 90 : 120);
    }
    runGenerateSet(setNumber, {
      nextCategory: nextCat,
      nextOrEnabled: isSchoolPeriodicOrTerm,
      silent: true,
    });
  };

  const handleToggleInternalChoice = () => {
    const nextVal = !enableInternalChoice;
    setEnableInternalChoice(nextVal);
    if (!nextVal) {
      // Clear auto-generated OR choices cleanly
      setOrOverrides({});
      toast.info("CBSE Internal Choice (OR / अथवा) बंद किया गया।");
      return;
    }
    // Auto-pair OR choices onto current subjective selection (or generate if none)
    if (selectedSubjective.length === 0) {
      runGenerateSet(setNumber, { nextOrEnabled: true });
      return;
    }
    const usedIds = new Set(selectedIds);
    const nextOverrides: Record<string, OrOverrideEntry> = { ...orOverrides };
    let added = 0;
    const maxPairs = selectedClass <= 3 ? 2 : 4;
    for (const host of selectedSubjective) {
      if (added >= maxPairs) break;
      if (nextOverrides[host.id]?.orQuestion || host.orQuestion) {
        added++;
        continue;
      }
      const pool = classPools.all.filter(
        (c) =>
          c.questionKind === "SUBJECTIVE" &&
          c.subject === host.subject &&
          !usedIds.has(c.id) &&
          c.id !== host.id
      );
      if (pool.length === 0) continue;
      const pickedCand =
        pool.find((c) => (c.marks || 2) === (host.marks || 2)) || pool[0];
      usedIds.add(pickedCand.id);
      nextOverrides[host.id] = {
        orQuestion: pickedCand.question,
        orModelAnswer: pickedCand.modelAnswer || pickedCand.explanation,
      };
      added++;
    }
    setOrOverrides(nextOverrides);
    toast.success(`CBSE Internal Choice (OR) चालू — ${added} प्रश्नों में 'OR / अथवा' जोड़ा गया।`);
  };

  const handleAutoAssignOr = (host: EntranceTestQuestion) => {
    const currentOrText =
      orOverrides[host.id] === null
        ? ""
        : orOverrides[host.id]?.orQuestion || host.orQuestion || "";
    const candidates = classPools.all.filter(
      (c) =>
        c.questionKind === "SUBJECTIVE" &&
        c.subject === host.subject &&
        !selectedIdSet.has(c.id) &&
        c.id !== host.id &&
        c.question !== currentOrText
    );
    if (candidates.length === 0) {
      toast.info(`${host.subject} में कोई अन्य अतिरिक्त Subjective प्रश्न उपलब्ध नहीं है। आप 'Edit OR' से खुद लिख सकते हैं।`);
      return;
    }
    const sameMarks = candidates.filter((c) => (c.marks || 2) === (host.marks || 2));
    const pickPool = sameMarks.length > 0 ? sameMarks : candidates;
    const picked = pickPool[Math.floor(Math.random() * Math.min(pickPool.length, 40))];
    setOrOverrides((prev) => ({
      ...prev,
      [host.id]: {
        orQuestion: picked.question,
        orModelAnswer: picked.modelAnswer || picked.explanation,
      },
    }));
    toast.success("इस प्रश्न में नया 'OR / अथवा' विकल्प जोड़ दिया गया!");
  };

  const handleOpenOrEditor = (host: EntranceTestQuestion) => {
    const existing = orOverrides[host.id];
    const currentQ = existing === null ? "" : existing?.orQuestion ?? host.orQuestion ?? "";
    const currentAns =
      existing === null
        ? ""
        : existing?.orModelAnswer ?? host.orModelAnswer ?? "";
    setOrEditorId(host.id);
    setOrDraftQuestion(currentQ);
    setOrDraftAnswer(currentAns);
  };

  const handleSaveOrEditor = () => {
    if (!orEditorId) return;
    if (!orDraftQuestion.trim()) {
      setOrOverrides((prev) => ({ ...prev, [orEditorId]: null }));
      setOrEditorId(null);
      toast.info("OR Choice हटा दिया गया।");
      return;
    }
    setOrOverrides((prev) => ({
      ...prev,
      [orEditorId]: {
        orQuestion: orDraftQuestion.trim(),
        orModelAnswer: orDraftAnswer.trim() || undefined,
      },
    }));
    setOrEditorId(null);
    toast.success("'OR / अथवा' विकल्प सेव हो गया!");
  };

  const handleRemoveOr = (qId: string) => {
    setOrOverrides((prev) => ({ ...prev, [qId]: null }));
    if (orEditorId === qId) setOrEditorId(null);
  };

  const toggleSelectQuestion = (id: string) => {
    if (selectedIdSet.has(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    const target = classPools.byId.get(id);
    if (
      target &&
      target.questionKind !== "SUBJECTIVE" &&
      selectedClass >= 4 &&
      selectedObjective.length >= SENIOR_MAX_OBJECTIVE
    ) {
      toast.warning(
        `${formatEntranceClassLabel(selectedClass)} में अधिकतम ${SENIOR_MAX_OBJECTIVE} Objective प्रश्न ही रखे जा सकते हैं। बाकी प्रश्न Subjective जोड़ें।`
      );
      return;
    }
    setSelectedIds((prev) => [...prev, id]);
  };

  const moveSelectedInSection = (id: string, dir: -1 | 1, kind: "OBJECTIVE" | "SUBJECTIVE") => {
    setSelectedIds((prev) => {
      const sameSectionIds = prev.filter((xId) => {
        const item = classPools.byId.get(xId);
        return item && (item.questionKind || "OBJECTIVE") === kind;
      });
      const idxInSec = sameSectionIds.indexOf(id);
      const swapIdxInSec = idxInSec + dir;
      if (idxInSec < 0 || swapIdxInSec < 0 || swapIdxInSec >= sameSectionIds.length) return prev;
      const targetId = sameSectionIds[swapIdxInSec];
      const next = [...prev];
      const a = next.indexOf(id);
      const b = next.indexOf(targetId);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const handleQuickAdd = (kind: "OBJECTIVE" | "SUBJECTIVE", count: number) => {
    let effectiveCount = count;
    if (kind === "OBJECTIVE" && selectedClass >= 4) {
      const remaining = Math.max(0, SENIOR_MAX_OBJECTIVE - selectedObjective.length);
      if (remaining === 0) {
        toast.warning(
          `${formatEntranceClassLabel(selectedClass)} के लिए 10 Objective सीमा पूरी हो चुकी है। अब Subjective प्रश्न जोड़ें।`
        );
        return;
      }
      effectiveCount = Math.min(count, remaining);
    }

    const candidates = classPools.all.filter((q) => {
      const qk = q.questionKind || "OBJECTIVE";
      if (qk !== kind) return false;
      if (subjectFilter !== "all" && q.subject !== subjectFilter) return false;
      return !selectedIdSet.has(q.id);
    });
    if (candidates.length === 0) {
      toast.info("इस फ़िल्टर में और उपलब्ध प्रश्न पहले से चुने जा चुके हैं।");
      return;
    }
    const added = candidates.slice(0, effectiveCount).map((x) => x.id);
    setSelectedIds((prev) => [...prev, ...added]);
    toast.success(
      `${added.length} ${kind === "OBJECTIVE" ? "Objective" : "Subjective"} प्रश्न जोड़े गए।`
    );
  };

  const handleBalancedMixPreset = () => {
    runGenerateSet(setNumber);
  };

  const handleNextUniqueSet = () => {
    const nextSet = setNumber >= TOTAL_PAPER_SETS ? 1 : setNumber + 1;
    runGenerateSet(nextSet);
  };

  const handleBulkSaved = (
    saved: EntranceTestQuestion[],
    alsoAddToPaper: boolean,
    wasSavedToBank = true,
    importedMeta?: ImportedPaperMetadata
  ) => {
    if (wasSavedToBank !== false) {
      onCustomQuestionsAdded?.(saved);
    } else {
      // Transient Print-Only mode (JSON / File) — store ONLY in temporary session state, never localStorage/Firebase!
      setSessionOnlyQuestions((prev) => {
        const seen = new Set(saved.map((q) => q.id));
        const normalized = saved.map((q) => ({ ...q, isTempSessionOnly: true }));
        return importedMeta?.replacePaper
          ? normalized
          : [...normalized, ...prev.filter((p) => !seen.has(p.id))];
      });
    }

    if (!alsoAddToPaper || saved.length === 0) return;

    const firstCls = importedMeta?.classLevel ?? saved[0].classLevel;
    const sameClassItems = saved.filter((q) => Number(q.classLevel) === firstCls);

    if (firstCls !== selectedClass) {
      skipNextAutoSeedRef.current = true;
      setSelectedClass(firstCls);
      setShowWritingLines(firstCls <= 0);
      setTwoColSubjective(false);
      setFontSizePx(firstCls <= 0 ? 10.0 : 9.5);
    }

    // Apply any detected exam metadata from the uploaded JSON/file directly onto the paper!
    if (importedMeta?.examTitle) setPaperTitle(importedMeta.examTitle);
    if (importedMeta?.examCategory) setExamCategory(importedMeta.examCategory);
    if (importedMeta?.subjectLabel) setSubjectLabel(importedMeta.subjectLabel);
    if (importedMeta?.sessionLabel) setSessionLabel(importedMeta.sessionLabel);
    if (importedMeta?.durationMinutes) setDurationMinutes(importedMeta.durationMinutes);
    if (importedMeta?.maximumMarks) {
      setFullMarksOverrideInput(String(importedMeta.maximumMarks));
    } else if (importedMeta?.replacePaper) {
      setFullMarksOverrideInput("");
    }
    if (importedMeta?.generalInstructions && importedMeta.generalInstructions.length > 0) {
      setInstructionsText(importedMeta.generalInstructions.join("\n"));
    }
    if (importedMeta?.cbseRulesMode) {
      setCbseRulesMode(importedMeta.cbseRulesMode);
    }
    if (importedMeta?.printOrientation) {
      setPrintOrientation(importedMeta.printOrientation);
    }
    if (importedMeta?.customBoardRulesHi || importedMeta?.customBoardRulesEn) {
      setCustomBoardRulesHi(importedMeta.customBoardRulesHi || []);
      setCustomBoardRulesEn(importedMeta.customBoardRulesEn || []);
    } else if (importedMeta?.replacePaper) {
      setCustomBoardRulesHi([]);
      setCustomBoardRulesEn([]);
    }

    // Load ALL imported questions intact (NEVER drop Objective questions with SENIOR_MAX_OBJECTIVE cap!)
    const toAdd = sameClassItems.map((q) => q.id);
    const shouldReplace = Boolean(importedMeta?.replacePaper) || firstCls !== selectedClass;

    if (shouldReplace) {
      setSelectedIds(toAdd);
      setOrOverrides({});
      setManualPageOverrides({});
      const nextMarks: Record<string, number> = {};
      sameClassItems.forEach((q) => {
        if (q.marks) nextMarks[q.id] = q.marks;
      });
      setMarksOverrides(nextMarks);
    } else {
      setSelectedIds((prev) => {
        const seen = new Set(prev);
        const merged = [...prev];
        toAdd.forEach((id) => {
          if (!seen.has(id)) merged.push(id);
        });
        return merged;
      });
    }
    setPreviewSheet("all");
    setTypeFilter("selected");

    if (importedMeta?.autoPrintMode && sameClassItems.length > 0) {
      try {
        const printItems = shouldReplace
          ? sameClassItems
          : [
              ...selectedObjective,
              ...selectedSubjective,
              ...sameClassItems.filter((q) => !selectedIds.includes(q.id)),
            ];
        const nextObjective = printItems.filter((q) => q.questionKind !== "SUBJECTIVE");
        const nextSubjective = printItems.filter((q) => q.questionKind === "SUBJECTIVE");
        const nextTitle = importedMeta.examTitle || paperTitle || "School Examination";
        const nextSession = importedMeta.sessionLabel || sessionLabel;
        const nextSubject = importedMeta.subjectLabel || subjectLabel;
        const nextDuration = importedMeta.durationMinutes || durationMinutes;
        const nextFullMarks =
          importedMeta.maximumMarks && importedMeta.maximumMarks > 0
            ? importedMeta.maximumMarks
            : importedMeta.replacePaper
            ? undefined
            : parsedFullMarksOverride;
        const nextInstructions =
          importedMeta.generalInstructions && importedMeta.generalInstructions.length > 0
            ? importedMeta.generalInstructions
            : parsedInstructions;
        const nextFontPx = firstCls !== selectedClass ? (firstCls <= 0 ? 10.0 : 9.5) : fontSizePx;
        const nextShowLines = firstCls <= 0 ? (firstCls !== selectedClass ? true : showWritingLines) : false;

        const nextCbseRulesMode = importedMeta.cbseRulesMode || cbseRulesMode;
        const nextCustomRulesHi =
          importedMeta.customBoardRulesHi !== undefined
            ? importedMeta.customBoardRulesHi
            : importedMeta.replacePaper
            ? []
            : customBoardRulesHi;
        const nextCustomRulesEn =
          importedMeta.customBoardRulesEn !== undefined
            ? importedMeta.customBoardRulesEn
            : importedMeta.replacePaper
            ? []
            : customBoardRulesEn;

        const bundle = buildCustomPaperHtmlBundle({
          school,
          classLevel: firstCls,
          paperTitle: nextTitle,
          examName: nextTitle,
          sessionLabel: nextSession,
          subjectLabel: nextSubject,
          schoolNameOverride,
          schoolTaglineOverride,
          schoolAddressOverride,
          schoolContactOverride,
          logoPosition,
          fullMarksOverride: nextFullMarks,
          examDate,
          paperCode,
          generalInstructions: nextInstructions,
          cbseRulesMode: nextCbseRulesMode,
          customBoardRulesHi: nextCustomRulesHi,
          customBoardRulesEn: nextCustomRulesEn,
          printOrientation: importedMeta.printOrientation || printOrientation,
          showStudentStrip,
          paperTheme,
          durationMinutes: nextDuration,
          objectiveQuestions: nextObjective,
          subjectiveQuestions: nextSubjective,
          fontSizePx: nextFontPx,
          twoColObjective,
          twoColSubjective: false,
          showWritingLines: nextShowLines,
          mode: importedMeta.autoPrintMode,
        });

        setPrintPreviewData({
          title: `${nextTitle} · ${formatEntranceClassLabel(firstCls)}`,
          pagesHtml: bundle.pagesHtml,
          fullCss: bundle.fullCss,
          docTitle: bundle.docTitle,
          orientation: bundle.orientation,
          mode: importedMeta.autoPrintMode,
        });
        mountAndPrintA4Sync(bundle.pagesHtml, bundle.fullCss, bundle.docTitle, bundle.orientation);
      } catch (err: any) {
        toast.error("A4 Print में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
      }
    }
  };

  const getPaperBuildInput = (mode: "full" | "questions_only") => ({
    school,
    classLevel: selectedClass,
    paperTitle,
    examName: paperTitle,
    sessionLabel,
    subjectLabel,
    schoolNameOverride,
    schoolTaglineOverride,
    schoolAddressOverride,
    schoolContactOverride,
    logoPosition,
    fullMarksOverride: parsedFullMarksOverride,
    examDate,
    paperCode,
    generalInstructions: parsedInstructions,
    cbseRulesMode,
    customBoardRulesHi,
    customBoardRulesEn,
    printOrientation,
    showStudentStrip,
    paperTheme,
    durationMinutes,
    objectiveQuestions: selectedObjective,
    subjectiveQuestions: selectedSubjective,
    fontSizePx,
    twoColObjective,
    twoColSubjective,
    showWritingLines: effectiveShowWritingLines,
    manualPageOverrides,
    mode,
  });

  const handlePrintA4 = (mode: "full" | "questions_only") => {
    if (selectedObjective.length === 0 && selectedSubjective.length === 0) {
      toast.error("कृपया पहले कम से कम 1 प्रश्न चुनें।");
      return;
    }
    try {
      const bundle = buildCustomPaperHtmlBundle(getPaperBuildInput(mode));
      // Open dedicated full-screen A4 Print Preview Sheet immediately
      setPrintPreviewData({
        title: `${paperTitle || "Exam Paper"} · ${formatEntranceClassLabel(selectedClass)}`,
        pagesHtml: bundle.pagesHtml,
        fullCss: bundle.fullCss,
        docTitle: bundle.docTitle,
        orientation: bundle.orientation,
        mode,
      });
      // Synchronously invoke native print inside the active click gesture
      mountAndPrintA4Sync(bundle.pagesHtml, bundle.fullCss, bundle.docTitle, bundle.orientation);
    } catch (err: any) {
      toast.error("A4 Print में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const handleOpenFullQuestionEditor = (rawQ: EntranceTestQuestion) => {
    const merged: EntranceTestQuestion = {
      ...rawQ,
      ...(questionEdits[rawQ.id] || {}),
      marks:
        marksOverrides[rawQ.id] ??
        questionEdits[rawQ.id]?.marks ??
        rawQ.marks ??
        (rawQ.questionKind === "SUBJECTIVE" ? 2 : 1),
    };
    const orOv = orOverrides[rawQ.id];
    if (orOv === null) {
      merged.orQuestion = "";
      merged.orModelAnswer = "";
    } else if (orOv) {
      merged.orQuestion = orOv.orQuestion;
      merged.orModelAnswer = orOv.orModelAnswer;
    }
    setEditingQuestion(merged);
  };

  const handleCommitFullQuestionEdit = () => {
    if (!editingQuestion) return;
    if (!editingQuestion.question.trim()) {
      toast.error("प्रश्न खाली नहीं हो सकता।");
      return;
    }
    const cleanMarks = Math.max(1, Math.min(20, Number(editingQuestion.marks || 1)));
    const isSubj = editingQuestion.questionKind === "SUBJECTIVE";
    const cleanPatch: Partial<EntranceTestQuestion> = {
      subject: editingQuestion.subject,
      questionKind: editingQuestion.questionKind,
      marks: cleanMarks,
      question: editingQuestion.question.trim(),
      passage: editingQuestion.passage?.trim() || undefined,
      options: isSubj
        ? ["", "", "", ""]
        : [
            editingQuestion.options?.[0]?.trim() || "Option A",
            editingQuestion.options?.[1]?.trim() || "Option B",
            editingQuestion.options?.[2]?.trim() || "Option C",
            editingQuestion.options?.[3]?.trim() || "Option D",
          ],
      correctIndex: isSubj ? 0 : editingQuestion.correctIndex,
      modelAnswer: isSubj ? editingQuestion.modelAnswer?.trim() || "" : undefined,
      explanation: isSubj
        ? editingQuestion.modelAnswer?.trim() || editingQuestion.explanation || ""
        : editingQuestion.explanation?.trim() || "",
      orQuestion: isSubj ? editingQuestion.orQuestion?.trim() || undefined : undefined,
      orModelAnswer: isSubj ? editingQuestion.orModelAnswer?.trim() || undefined : undefined,
      topicTag: editingQuestion.topicTag?.trim() || undefined,
    };

    setQuestionEdits((prev) => ({ ...prev, [editingQuestion.id]: cleanPatch }));
    setMarksOverrides((prev) => ({ ...prev, [editingQuestion.id]: cleanMarks }));
    if (isSubj) {
      if (cleanPatch.orQuestion) {
        setOrOverrides((prev) => ({
          ...prev,
          [editingQuestion.id]: {
            orQuestion: cleanPatch.orQuestion!,
            orModelAnswer: cleanPatch.orModelAnswer,
          },
        }));
      } else {
        setOrOverrides((prev) => ({ ...prev, [editingQuestion.id]: null }));
      }
    }
    setEditingQuestion(null);
    toast.success("प्रश्न और Marks सफलतापूर्वक अपडेट हो गए!");
  };

  const activeSavedRecord = useMemo(
    () => (activeSavedPaperId ? savedPapers.find((p) => p.id === activeSavedPaperId) || null : null),
    [activeSavedPaperId, savedPapers]
  );

  const handleSaveCurrentPaper = async (publishNow: boolean, saveAsNewCopy = false) => {
    const sid = school?.id || "";
    if (!sid) {
      toast.error("School ID नहीं मिला।");
      return;
    }
    if (selectedObjective.length === 0 && selectedSubjective.length === 0) {
      toast.error("पेपर सेव करने से पहले कम से कम 1 प्रश्न चुनें।");
      return;
    }
    setSavingPaper(true);
    try {
      const resolvedSubj =
        subjectLabel.trim() ||
        (distinctSubjectCount === 1
          ? selectedObjective[0]?.subject || selectedSubjective[0]?.subject || "General"
          : "All Subjects (Combined)");
      const targetId = saveAsNewCopy ? undefined : activeSavedPaperId || undefined;
      const saved = await saveSchoolQuestionPaper(sid, {
        id: targetId,
        schoolCode: school?.code,
        schoolName: previewMasthead.schoolName,
        sessionLabel: sessionLabel.trim() || "2026-27",
        examCategory,
        paperTitle: paperTitle.trim() || "School Examination",
        classLevel: selectedClass,
        subjectLabel: resolvedSubj,
        fullMarks: fullMarksDisplay,
        durationMinutes,
        paperCode: paperCode.trim() || undefined,
        examDate: examDate.trim() || undefined,
        generalInstructions: parsedInstructions,
        cbseRulesMode,
        customBoardRulesHi: customBoardRulesHi.length > 0 ? customBoardRulesHi : undefined,
        customBoardRulesEn: customBoardRulesEn.length > 0 ? customBoardRulesEn : undefined,
        printOrientation,
        fontSizePx,
        twoColObjective,
        twoColSubjective,
        showStudentStrip,
        paperTheme,
        manualPageOverrides:
          Object.keys(manualPageOverrides).length > 0 ? manualPageOverrides : undefined,
        objectiveQuestions: selectedObjective,
        subjectiveQuestions: selectedSubjective,
        isPublished: publishNow,
        showAnswerKeyToStudents:
          !saveAsNewCopy && activeSavedRecord
            ? Boolean(activeSavedRecord.showAnswerKeyToStudents)
            : false,
      });
      setActiveSavedPaperId(saved.id);
      setSavedPapers((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      onSavedPapersChanged?.();
      toast.success(
        saveAsNewCopy
          ? `✅ नई कॉपी सेव हो गई (${saved.paperIdCode || saved.sessionLabel} · v1)!`
          : publishNow
          ? `✅ पेपर सेव & Publish हो गया (${saved.paperIdCode || saved.sessionLabel} · v${saved.version || 1}) — Students अब अपने Digital Library में देख सकते हैं!`
          : `✅ पेपर Archive में सेव हो गया (${saved.paperIdCode || saved.sessionLabel} · v${saved.version || 1}) — Version History सुरक्षित है!`
      );
    } catch (err: any) {
      toast.error("पेपर सेव करने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setSavingPaper(false);
    }
  };

  const handleLoadSavedPaperIntoBuilder = (paper: SavedSchoolQuestionPaper) => {
    const allQs = [...(paper.objectiveQuestions || []), ...(paper.subjectiveQuestions || [])];
    if (allQs.length === 0) return;
    skipNextAutoSeedRef.current = paper.classLevel !== selectedClass;
    setActiveSavedPaperId(paper.id);
    setSelectedClass(paper.classLevel);
    setExamCategory(paper.examCategory || "PA1");
    setPaperTitle(paper.paperTitle);
    setSessionLabel(paper.sessionLabel || "2026-27");
    setSubjectLabel(paper.subjectLabel || "");
    setFullMarksOverrideInput(paper.fullMarks ? String(paper.fullMarks) : "");
    setDurationMinutes(paper.durationMinutes || 60);
    setPaperCode(paper.paperCode || "");
    setExamDate(paper.examDate || "");
    if (paper.generalInstructions && paper.generalInstructions.length > 0) {
      setInstructionsText(paper.generalInstructions.join("\n"));
    }
    setCbseRulesMode(paper.cbseRulesMode || "auto");
    setCustomBoardRulesHi(paper.customBoardRulesHi || []);
    setCustomBoardRulesEn(paper.customBoardRulesEn || []);
    setPrintOrientation(paper.printOrientation || "portrait");
    setTwoColObjective(Boolean(paper.twoColObjective));
    setTwoColSubjective(Boolean(paper.twoColSubjective));
    if (paper.showStudentStrip !== undefined) setShowStudentStrip(paper.showStudentStrip);
    if (paper.paperTheme) setPaperTheme(paper.paperTheme as PaperPrintTheme);
    setShowWritingLines(paper.classLevel <= 0);
    setFontSizePx(
      paper.fontSizePx
        ? Math.max(5.5, Math.min(13.5, paper.fontSizePx))
        : paper.classLevel <= 0
        ? 10.0
        : 9.5
    );
    setSessionOnlyQuestions((prev) => {
      const seen = new Set(allQs.map((q) => q.id));
      return [...allQs, ...prev.filter((p) => !seen.has(p.id))];
    });
    setSelectedIds(allQs.map((q) => q.id));
    const restoredMarks: Record<string, number> = {};
    allQs.forEach((q) => {
      if (q.marks) restoredMarks[q.id] = q.marks;
    });
    setMarksOverrides(restoredMarks);
    setOrOverrides({});
    setManualPageOverrides(paper.manualPageOverrides || {});
    setQuestionEdits({});
    setTypeFilter("selected");
    setPreviewSheet("all");
    setShowSavedPapersPanel(false);
    toast.success(
      `"${paper.paperTitle}" (${paper.paperIdCode || paper.sessionLabel} · v${paper.version || 1}) Builder में लोड हो गया — हर प्रश्न व सेटिंग अपडेट करें!`
    );
  };

  const handleToggleSavedPaperPublish = async (
    paper: SavedSchoolQuestionPaper,
    nextPublished: boolean,
    nextShowKey?: boolean
  ) => {
    const sid = school?.id || "";
    if (!sid) return;
    const updated = await togglePublishSchoolQuestionPaper(
      sid,
      paper.id,
      nextPublished,
      nextShowKey
    );
    if (updated) {
      setSavedPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast.success(
        nextShowKey !== undefined
          ? nextShowKey
            ? "Students अब Answer Key भी देख पाएंगे।"
            : "Students के लिए Answer Key छुपा दी गई।"
          : nextPublished
          ? "Published! अब Students अपने Question Bank में यह पेपर देख सकते हैं।"
          : "Unpublished — Students के Question Bank से हटाया गया।"
      );
    }
  };

  const handleDeleteSavedPaper = async (paperId: string) => {
    const sid = school?.id || "";
    if (!sid) return;
    await deleteSavedSchoolQuestionPaper(sid, paperId);
    setSavedPapers((prev) => prev.filter((p) => p.id !== paperId));
    if (activeSavedPaperId === paperId) setActiveSavedPaperId(null);
    toast.success("Saved paper deleted.");
  };

  const handlePrintSavedPaper = (paper: SavedSchoolQuestionPaper) => {
    try {
      const bundle = buildCustomPaperHtmlBundle({
        school,
        classLevel: paper.classLevel,
        paperTitle: paper.paperTitle,
        examName: paper.paperTitle,
        sessionLabel: paper.sessionLabel,
        subjectLabel: paper.subjectLabel,
        fullMarksOverride: paper.fullMarks > 0 ? paper.fullMarks : undefined,
        examDate: paper.examDate,
        paperCode: paper.paperCode,
        generalInstructions: paper.generalInstructions,
        cbseRulesMode: paper.cbseRulesMode || "auto",
        customBoardRulesHi: paper.customBoardRulesHi,
        customBoardRulesEn: paper.customBoardRulesEn,
        printOrientation: paper.printOrientation || "portrait",
        showStudentStrip: paper.showStudentStrip ?? true,
        paperTheme: (paper.paperTheme as PaperPrintTheme) || "classic_bw",
        durationMinutes: paper.durationMinutes || 60,
        objectiveQuestions: paper.objectiveQuestions || [],
        subjectiveQuestions: paper.subjectiveQuestions || [],
        fontSizePx: paper.fontSizePx || (paper.classLevel <= 0 ? 10.0 : 9.5),
        twoColObjective: Boolean(paper.twoColObjective),
        twoColSubjective: Boolean(paper.twoColSubjective),
        manualPageOverrides: paper.manualPageOverrides,
        showWritingLines: paper.classLevel <= 0,
        mode: "questions_only",
      });
      setPrintPreviewData({
        title: `${paper.paperTitle} · ${formatEntranceClassLabel(paper.classLevel)}`,
        pagesHtml: bundle.pagesHtml,
        fullCss: bundle.fullCss,
        docTitle: bundle.docTitle,
        orientation: bundle.orientation,
        mode: "questions_only",
      });
      mountAndPrintA4Sync(bundle.pagesHtml, bundle.fullCss, bundle.docTitle, bundle.orientation);
    } catch (err: any) {
      toast.error("A4 Print में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const savedSessionsList = useMemo(() => {
    const s = new Set<string>();
    savedPapers.forEach((p) => {
      if (p.sessionLabel) s.add(p.sessionLabel);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [savedPapers]);

  const filteredSavedPapers = useMemo(
    () =>
      savedSessionFilter === "ALL"
        ? savedPapers
        : savedPapers.filter((p) => p.sessionLabel === savedSessionFilter),
    [savedPapers, savedSessionFilter]
  );

  const totalSelectedCount = selectedObjective.length + selectedSubjective.length;
  const p1Plan = layout.pages[0];
  const p2Plan = layout.pages[1];

  const previewMasthead = resolveExamPaperMasthead(school, {
    schoolNameOverride,
    schoolTaglineOverride,
    schoolAddressOverride,
    schoolContactOverride,
  });
  const previewSchoolName = previewMasthead.schoolName;
  const previewSubjectLabel =
    subjectLabel.trim() ||
    (distinctSubjectCount === 1
      ? selectedObjective[0]?.subject || selectedSubjective[0]?.subject || "Combined"
      : "All Subjects (Combined)");
  const previewTimeLabel =
    durationMinutes < 60
      ? `${durationMinutes} Mins`
      : durationMinutes % 60 === 0
      ? `${durationMinutes / 60} ${durationMinutes === 60 ? "Hour" : "Hours"}`
      : `${Math.floor(durationMinutes / 60)} Hr ${durationMinutes % 60} Mins`;

  return (
    <div className="space-y-4">
      {/* Top Paper Studio Control Strip */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>School Exam Paper Builder (Nursery – Class 10 · 1,000 Unique Sets)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isPrimaryQuestionCumAnswer ? (
                <>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatEntranceClassLabel(selectedClass)} (Question-cum-Answer Paper):
                  </strong>{" "}
                  Nursery / LKG / UKG के लिए पेपर में ही उत्तर लिखने की लाइनें (Writing Space) ऑन हैं।
                </>
              ) : (
                <>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatEntranceClassLabel(selectedClass)} (Questions-Only Paper):
                  </strong>{" "}
                  Class 1 से Class 10 तक पेपर में सिर्फ प्रश्न रहेंगे (Answer Writing Lines बंद) — Internal Choice ("OR") + Set 1–1000।
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="h-9 px-3.5 rounded-xl bg-[#070D19] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Upload / JSON Print</span>
            </button>
            <button
              type="button"
              disabled={savingPaper || totalSelectedCount === 0}
              onClick={() => void handleSaveCurrentPaper(false, false)}
              className="h-9 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
              title="Save or create next version in Digital Paper Library"
            >
              {savingPaper ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
              <span>
                {activeSavedRecord
                  ? `Save Version v${(activeSavedRecord.version || 1) + 1}`
                  : activeSavedPaperId
                  ? "Update Saved"
                  : "Save Paper"}
              </span>
            </button>
            {activeSavedPaperId && (
              <button
                type="button"
                disabled={savingPaper || totalSelectedCount === 0}
                onClick={() => void handleSaveCurrentPaper(false, true)}
                className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                title="पुराने पेपर को बिना बदले नई स्वतंत्र कॉपी सेव करें"
              >
                <Save className="w-3.5 h-3.5 shrink-0" />
                <span>Save as New Copy</span>
              </button>
            )}
            <button
              type="button"
              disabled={savingPaper || totalSelectedCount === 0}
              onClick={() => void handleSaveCurrentPaper(true, false)}
              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
              title="Save & Publish to Student Dashboard -> Digital Question Library"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>Publish to Students</span>
            </button>
            {!hideLibraryButton && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenLibrary) {
                    onOpenLibrary();
                  } else {
                    setShowSavedPapersPanel((v) => !v);
                  }
                }}
                className={`h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  showSavedPapersPanel
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                <span>Digital Library ({savedPapers.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNextUniqueSet}
              className="h-9 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              title="हर बार नया Unique Set (Set 1 -> Set 2 ... 1000 तक)"
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>Next Set (#{setNumber >= TOTAL_PAPER_SETS ? 1 : setNumber + 1})</span>
            </button>
            <div className="col-span-2 sm:col-span-auto grid grid-cols-3 sm:inline-flex items-center h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 overflow-hidden divide-x divide-slate-200 dark:divide-slate-800">
              <button
                type="button"
                onClick={() => handleQuickAdd("OBJECTIVE", selectedClass >= 4 ? 5 : 2)}
                className="h-full px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer whitespace-nowrap transition-colors"
              >
                +{selectedClass >= 4 ? 5 : 2} Obj
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd("SUBJECTIVE", 4)}
                className="h-full px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer whitespace-nowrap transition-colors"
              >
                +4 Subj
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds([]);
                  setOrOverrides({});
                  setManualPageOverrides({});
                  setQuestionEdits({});
                  setActiveSavedPaperId(null);
                  toast.info("सभी चुने हुए प्रश्न हटा दिए गए।");
                }}
                className="h-full px-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Session-Wise Saved Papers & Student Question Bank Manager */}
        {!hideLibraryButton && showSavedPapersPanel && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Saved Papers &amp; Student Question Bank (Session-wise)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Publish किए गए पेपर Students को उनके Dashboard → <strong>Question Bank</strong> में तुरंत दिखाई देंगे।
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={savedSessionFilter}
                  onChange={(e) => setSavedSessionFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <option value="ALL">All Sessions ({savedPapers.length})</option>
                  {savedSessionsList.map((s) => (
                    <option key={s} value={s}>
                      Session {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSavedPapersPanel(false)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {filteredSavedPapers.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                इस Session में अभी कोई पेपर सेव नहीं है। ऊपर <strong>Save Paper</strong> या <strong>Publish to Students</strong> दबाकर सेव करें।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredSavedPapers.map((sp) => {
                  const qTotal =
                    (sp.objectiveQuestions?.length || 0) + (sp.subjectiveQuestions?.length || 0);
                  return (
                    <div
                      key={sp.id}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-extrabold">
                              {sp.sessionLabel}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[10px] font-extrabold">
                              {formatEntranceClassLabel(sp.classLevel)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[10px] font-bold">
                              F.M.: {sp.fullMarks}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white ${
                                sp.isPublished ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                            >
                              {sp.isPublished ? "Published (Students)" : "Draft"}
                            </span>
                          </div>
                          <div className="text-xs font-extrabold text-slate-950 dark:text-white truncate mt-1">
                            {sp.paperTitle} · {sp.subjectLabel}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {qTotal} Qs ({sp.objectiveQuestions?.length || 0} Obj ·{" "}
                            {sp.subjectiveQuestions?.length || 0} Subj) · {sp.durationMinutes} Mins
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSavedPaper(sp.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                          title="Delete Saved Paper"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedPaperIntoBuilder(sp)}
                          className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Edit / Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSavedPaper(sp)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print A4</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleSavedPaperPublish(sp, !sp.isPublished)}
                          className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-bold cursor-pointer ${
                            sp.isPublished
                              ? "bg-amber-600 hover:bg-amber-500"
                              : "bg-emerald-600 hover:bg-emerald-500"
                          }`}
                        >
                          {sp.isPublished ? "Unpublish" : "Publish to Students"}
                        </button>
                        {sp.isPublished && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleSavedPaperPublish(
                                sp,
                                true,
                                !sp.showAnswerKeyToStudents
                              )
                            }
                            className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[10px] font-bold cursor-pointer"
                          >
                            Key: {sp.showAnswerKeyToStudents ? "ON" : "OFF"}
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

        {/* Row 1: Exam Type, Nursery-Class 10, Exam Name, Subject (Editable), Full Marks (Editable), Session, Duration */}
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800">
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Exam Type
            </label>
            <select
              value={examCategory}
              onChange={(e) => handleExamCategoryChange(e.target.value as ExamCategoryType)}
              className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              {EXAM_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Class (Nur–10)
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(Number(e.target.value) as EntranceClassNumber)}
              className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {formatEntranceClassLabel(c)} {c <= 0 ? "(Ans Space)" : "(Questions Only)"}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Exam Name on Paper
            </label>
            <input
              type="text"
              value={paperTitle}
              onChange={(e) => setPaperTitle(e.target.value)}
              placeholder="e.g. Annual Test / PA-1"
              className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
            />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Subject (Editable)
            </label>
            <input
              type="text"
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              placeholder="e.g. Science (विज्ञान)"
              className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            />
          </div>

          <div className="col-span-1 sm:col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              F.M. (Marks)
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={fullMarksOverrideInput}
              onChange={(e) => setFullMarksOverrideInput(e.target.value)}
              placeholder={String(layout.totalMarks)}
              className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-black font-mono text-center tabular-nums"
              title="Full Marks (auto-filled from JSON/text, or edit anytime)"
            />
          </div>

          <div className="col-span-1 sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Session
            </label>
            <input
              type="text"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="2026-27"
              className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
            />
          </div>

          <div className="col-span-1 sm:col-span-1">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Time (m)
            </label>
            <input
              type="number"
              min={15}
              max={240}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(15, Number(e.target.value || 45)))}
              className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono text-center tabular-nums"
            />
          </div>
        </div>

        {/* Row 2: Subject Scope, Set # 1-1000 Generator & CBSE Internal Choice ("OR") Switch */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 items-end">
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Subject Scope (1 Subject या Combined)
            </label>
            <select
              value={targetSubject}
              onChange={(e) => {
                const nextSub = e.target.value as "ALL" | EntranceTestSubject;
                setTargetSubject(nextSub);
                runGenerateSet(setNumber, { nextSubject: nextSub });
              }}
              className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              <option value="ALL">All Subjects Combined ({blueprint.quotas.length} Subjects)</option>
              {blueprint.quotas.map((q) => (
                <option key={q.subject} value={q.subject}>
                  Only {q.subject} Paper (Up to 1000 Sets)
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Unique Paper Set (1 – {TOTAL_PAPER_SETS})
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => runGenerateSet(setNumber <= 1 ? TOTAL_PAPER_SETS : setNumber - 1)}
                className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                title="Previous Set"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-500 pl-1">Set</span>
                <input
                  type="number"
                  min={1}
                  max={TOTAL_PAPER_SETS}
                  value={setNumber}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(TOTAL_PAPER_SETS, Number(e.target.value || 1)));
                    setSetNumber(n);
                  }}
                  className="w-20 h-9 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-black font-mono text-center tabular-nums"
                />
                <button
                  type="button"
                  onClick={handleBalancedMixPreset}
                  className="flex-1 h-9 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Load Set #{setNumber}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleNextUniqueSet}
                className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                title="Next Unique Set"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="sm:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleInternalChoice}
              className={`w-full h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                enableInternalChoice
                  ? "bg-violet-600 hover:bg-violet-500 text-white border-violet-600"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              }`}
              title="CBSE Internal Choice (X या Y में से कोई एक प्रश्न — OR / अथवा)"
            >
              <Split className="w-3.5 h-3.5 shrink-0" />
              <span>CBSE OR: {enableInternalChoice ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>

        {sessionOnlyQuestions.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Print-Only Temporary Questions Loaded ({sessionOnlyQuestions.length} Qs) — ये प्रश्न App Database में Save नहीं होंगे (केवल Print/Preview के लिए)।
            </span>
            <button
              type="button"
              onClick={() => {
                const tempIds = new Set(sessionOnlyQuestions.map((q) => q.id));
                setSelectedIds((prev) => prev.filter((id) => !tempIds.has(id)));
                setSessionOnlyQuestions([]);
                toast.info("Print-Only अस्थायी प्रश्न हटा दिए गए।");
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-400 text-amber-900 dark:text-amber-200 font-bold text-[11px] cursor-pointer hover:bg-amber-100"
            >
              Clear Temp Qs
            </button>
          </div>
        )}

        {/* Collapsible Header & Paper Metadata Editor */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowHeaderEditor((p) => !p)}
            className="text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              Edit Paper Header Details (School Name, Sub-header, Subject, F.M., Date, Code, Instructions)
            </span>
            {showHeaderEditor ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showHeaderEditor && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  School Full Name (Bold &amp; Capital)
                </label>
                <input
                  type="text"
                  value={schoolNameOverride}
                  onChange={(e) => setSchoolNameOverride(e.target.value)}
                  placeholder="LIFE MAKER PUBLIC SCHOOL"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold uppercase"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Curriculum / Board Tagline (No Trust Name)
                </label>
                <input
                  type="text"
                  value={schoolTaglineOverride}
                  onChange={(e) => setSchoolTaglineOverride(e.target.value)}
                  placeholder="(CBSE Pattern English Medium School)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setSchoolTaglineOverride("(CBSE Pattern English Medium School)")}
                    className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Use CBSE Pattern
                  </button>
                  <span className="text-[10px] text-slate-400">·</span>
                  <button
                    type="button"
                    onClick={() => setSchoolTaglineOverride("Bright Future... Together")}
                    className="text-[10px] font-semibold text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Use Motto
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  School Logo Position
                </label>
                <select
                  value={logoPosition}
                  onChange={(e) => setLogoPosition(e.target.value as "left" | "center")}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  <option value="left">Left of Header</option>
                  <option value="center">Center Above Name</option>
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  School Full Address
                </label>
                <input
                  type="text"
                  value={schoolAddressOverride}
                  onChange={(e) => setSchoolAddressOverride(e.target.value)}
                  placeholder="Dharaka Market, Affour, Nagra, Saran (Bihar)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Contact &amp; Website Info
                </label>
                <input
                  type="text"
                  value={schoolContactOverride}
                  onChange={(e) => setSchoolContactOverride(e.target.value)}
                  placeholder="Ph: 9525400122, 9835763641 | Web: lmps27.vercel.app"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Subject Label (Optional)
                </label>
                <input
                  type="text"
                  value={subjectLabel}
                  onChange={(e) => setSubjectLabel(e.target.value)}
                  placeholder="Auto / Science / Maths"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  F.M. (Blank=Auto)
                </label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={fullMarksOverrideInput}
                  onChange={(e) => setFullMarksOverrideInput(e.target.value)}
                  placeholder={`Auto (${layout.totalMarks})`}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Exam Date
                </label>
                <input
                  type="text"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  placeholder="e.g. 20 Nov 2026"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Paper Code
                </label>
                <input
                  type="text"
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  placeholder="SET-A"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Print Style Theme
                </label>
                <select
                  value={paperTheme}
                  onChange={(e) => setPaperTheme(e.target.value as PaperPrintTheme)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  <option value="classic_bw">Classic B&W Exam Print</option>
                  <option value="heritage_navy">Academic Navy Masthead</option>
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  General Instructions (1 line per instruction)
                </label>
                <textarea
                  rows={2}
                  value={instructionsText}
                  onChange={(e) => setInstructionsText(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  CBSE Board Rules (Page/Q Check)
                </label>
                <select
                  value={cbseRulesMode}
                  onChange={(e) => setCbseRulesMode(e.target.value as CbseBoardRulesMode)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  <option value="auto">Auto (Paper भाषा के अनुसार)</option>
                  <option value="hi">हिंदी केवल (Hindi)</option>
                  <option value="en">English Only</option>
                  <option value="bilingual">दोनों (Hindi + English 2-Col)</option>
                  <option value="none">बंद (Off)</option>
                </select>
                {(customBoardRulesHi.length > 0 || customBoardRulesEn.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBoardRulesHi([]);
                      setCustomBoardRulesEn([]);
                    }}
                    className="mt-1 text-[10px] font-bold text-sky-600 hover:underline cursor-pointer"
                  >
                    JSON Rules active · Default पर रीसेट करें
                  </button>
                )}
              </div>

              <div className="sm:col-span-3 flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStudentStrip}
                    onChange={(e) => setShowStudentStrip(e.target.checked)}
                    className="rounded accent-slate-900"
                  />
                  <span>Show Name / Roll No. Strip</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Workspace: Left Picker Pool + Right Live Real Paper Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (6/12): Question Picker */}
        <div className="xl:col-span-6 space-y-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
            {/* Kind Filter Tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 overflow-x-auto">
                <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {(
                    [
                      { id: "all", label: `All (${classPools.all.length})` },
                      { id: "objective", label: `Objective (${classPools.objCount})` },
                      { id: "subjective", label: `Subjective (${classPools.subjCount})` },
                      { id: "custom", label: `Custom (${classPools.customCount})` },
                      { id: "selected", label: `Selected (${totalSelectedCount})` },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTypeFilter(t.id);
                        setPickerPage(1);
                      }}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap inline-flex items-center justify-center ${
                        typeFilter === t.id
                          ? "bg-[#070D19] text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPickerAnswers((p) => !p)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                {showPickerAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPickerAnswers ? "Hide Ans" : "Show Ans"}</span>
              </button>
            </div>

            {/* Subject Pills + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="w-full sm:w-auto overflow-x-auto">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectFilter("all");
                      setPickerPage(1);
                    }}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap inline-flex items-center ${
                      subjectFilter === "all"
                        ? "bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    All Subjects
                  </button>
                  {blueprint.quotas.map((q) => (
                    <button
                      key={q.subject}
                      type="button"
                      onClick={() => {
                        setSubjectFilter(q.subject);
                        setPickerPage(1);
                      }}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap inline-flex items-center ${
                        subjectFilter === q.subject
                          ? "bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {q.subject}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative sm:w-52 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPickerPage(1);
                  }}
                  placeholder="Search topic or text..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Picker List */}
          <div className="space-y-2">
            {visiblePool.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                कोई प्रश्न नहीं मिला — फ़िल्टर बदलकर देखें या Bulk Upload Qs से नए प्रश्न जोड़ें।
              </div>
            ) : (
              visiblePool.map((rawQ) => {
                const q: EntranceTestQuestion = questionEdits[rawQ.id]
                  ? { ...rawQ, ...questionEdits[rawQ.id] }
                  : rawQ;
                const isSelected = selectedIdSet.has(q.id);
                const isSubj = q.questionKind === "SUBJECTIVE";
                const effectiveMarks = marksOverrides[q.id] ?? q.marks ?? (isSubj ? 2 : 1);
                const ansVisible = showPickerAnswers || Boolean(peekAnswerIds[q.id]);
                const resolvedOrObj =
                  orOverrides[q.id] === null
                    ? null
                    : orOverrides[q.id] ||
                      (q.orQuestion
                        ? { orQuestion: q.orQuestion, orModelAnswer: q.orModelAnswer }
                        : null);
                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? isSubj
                          ? "bg-violet-50/70 dark:bg-violet-950/30 border-violet-400 dark:border-violet-600"
                          : "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`font-extrabold tracking-wide ${
                              isSubj
                                ? "text-violet-700 dark:text-violet-300"
                                : "text-sky-700 dark:text-sky-300"
                            }`}
                          >
                            {isSubj ? "SUBJECTIVE" : "OBJECTIVE"}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {q.subject}
                          </span>
                          {q.topicTag && (
                            <span className="text-slate-500 dark:text-slate-400">
                              · {q.topicTag}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            · {FORMAT_DISPLAY_LABEL[q.format]}
                          </span>
                          {q.examCategory && (
                            <span className="font-bold text-[10px] text-emerald-700 dark:text-emerald-400">
                              · {q.examCategory}
                            </span>
                          )}
                          {q.isTempSessionOnly && (
                            <span className="font-bold text-[10px] text-amber-700 dark:text-amber-300">
                              · Print-Only (Temp)
                            </span>
                          )}
                          {q.isCustom && !q.isTempSessionOnly && !q.examCategory && (
                            <span className="font-bold text-[10px] text-amber-700 dark:text-amber-300">
                              · Custom
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-slate-950 dark:text-white leading-snug">
                          {q.question}
                        </p>

                        {isSubj && resolvedOrObj?.orQuestion && (
                          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2.5 py-1.5 text-[11px] text-violet-950 dark:text-violet-200">
                            <span className="font-black text-violet-700 dark:text-violet-300">
                              OR / अथवा:
                            </span>{" "}
                            {resolvedOrObj.orQuestion}
                          </div>
                        )}

                        {!isSubj && (
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-300 pt-0.5">
                            {q.options.map((opt, oi) => (
                              <div
                                key={oi}
                                className={`truncate px-2 py-0.5 rounded ${
                                  ansVisible && oi === q.correctIndex
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold"
                                    : "bg-slate-50 dark:bg-slate-950"
                                }`}
                              >
                                ({OPTION_LETTERS_UPPER[oi]}) {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        {isSubj && ansVisible && (
                          <div className="text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-emerald-800 dark:text-emerald-300 space-y-1">
                            <div>
                              <strong>Model Answer:</strong> {q.modelAnswer || q.explanation}
                            </div>
                            {resolvedOrObj?.orModelAnswer && (
                              <div>
                                <strong>OR Ans:</strong> {resolvedOrObj.orModelAnswer}
                              </div>
                            )}
                          </div>
                        )}

                        {isSelected && isSubj && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAutoAssignOr(q)}
                              className="px-2 py-0.5 rounded border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-violet-950/60 text-[10px] font-bold text-violet-700 dark:text-violet-300 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Split className="w-3 h-3" />
                              <span>{resolvedOrObj ? "Shuffle OR" : "+ Auto OR"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenOrEditor(q)}
                              className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-[10px] font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{resolvedOrObj ? "Edit OR" : "+ Custom OR"}</span>
                            </button>
                            {resolvedOrObj && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOr(q.id)}
                                className="px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-[10px] font-bold text-rose-700 dark:text-rose-300 inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Remove OR</span>
                              </button>
                            )}
                          </div>
                        )}

                        {orEditorId === q.id && (
                          <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-violet-300 dark:border-violet-700 space-y-2">
                            <div className="text-[11px] font-bold text-violet-800 dark:text-violet-300">
                              Custom Internal Choice ("OR / अथवा") Question:
                            </div>
                            <textarea
                              rows={2}
                              value={orDraftQuestion}
                              onChange={(e) => setOrDraftQuestion(e.target.value)}
                              placeholder="Type alternative OR question (blank to remove)..."
                              className="w-full px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                            />
                            <input
                              type="text"
                              value={orDraftAnswer}
                              onChange={(e) => setOrDraftAnswer(e.target.value)}
                              placeholder="Model Answer for OR question (Optional)..."
                              className="w-full px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setOrEditorId(null)}
                                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveOrEditor}
                                className="px-2.5 py-1 rounded bg-violet-600 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Save OR
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectQuestion(q.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap ${
                            isSelected
                              ? "bg-emerald-600 hover:bg-rose-600 text-white"
                              : "bg-[#070D19] hover:bg-slate-800 text-white"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Selected</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenFullQuestionEditor(q)}
                            className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            title="Edit Full Question, Options & Marks"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {isSelected && (
                            <>
                              <select
                                value={effectiveMarks}
                                onChange={(e) =>
                                  setMarksOverrides((prev) => ({
                                    ...prev,
                                    [q.id]: Number(e.target.value),
                                  }))
                                }
                                title="Adjust Marks"
                                className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[10px] font-bold font-mono"
                              >
                                {[1, 2, 3, 4, 5, 6, 8, 10].map((m) => (
                                  <option key={m} value={m}>
                                    {m}M
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  moveSelectedInSection(
                                    q.id,
                                    -1,
                                    isSubj ? "SUBJECTIVE" : "OBJECTIVE"
                                  )
                                }
                                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  moveSelectedInSection(
                                    q.id,
                                    1,
                                    isSubj ? "SUBJECTIVE" : "OBJECTIVE"
                                  )
                                }
                                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>

                        {!showPickerAnswers && (
                          <button
                            type="button"
                            onClick={() =>
                              setPeekAnswerIds((p) => ({ ...p, [q.id]: !p[q.id] }))
                            }
                            className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            {peekAnswerIds[q.id] ? "Hide Ans" : "View Ans"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {totalPickerPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500 tabular-nums">
                  Showing {(safePickerPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePickerPage * PAGE_SIZE, filteredPool.length)} of{" "}
                  {filteredPool.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePickerPage <= 1}
                    onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-mono font-bold tabular-nums px-1.5">
                    {safePickerPage} / {totalPickerPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePickerPage >= totalPickerPages}
                    onClick={() => setPickerPage((p) => Math.min(totalPickerPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (6/12): Live Authentic Printed Paper Preview & Export */}
        <div className="xl:col-span-6 space-y-3 xl:sticky xl:top-4">
          {/* Typography, Text Size & Export Toolbar */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            {/* Live Text Size Controller (5.5px Compact → 13.5px Large + Quick Presets) */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Paper Text Size:
                  </span>
                  <span className="font-mono text-xs font-black tabular-nums text-sky-700 dark:text-sky-300">
                    {fontSizePx.toFixed(1)}px
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setFontSizePx((v) => Math.max(5.5, Math.round((v - 0.5) * 10) / 10))
                    }
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Decrease text size"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min={5.5}
                    max={13.5}
                    step={0.5}
                    value={fontSizePx}
                    onChange={(e) => setFontSizePx(Number(e.target.value))}
                    className="flex-1 accent-sky-600 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFontSizePx((v) => Math.min(13.5, Math.round((v + 0.5) * 10) / 10))
                    }
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Increase text size"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSizePx(isPrimaryQuestionCumAnswer ? 10.0 : 9.5)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Reset font size"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { px: 6.0, label: "6px (Mini)" },
                    { px: 7.0, label: "7px (Compact)" },
                    { px: 8.0, label: "8px" },
                    { px: 9.0, label: "9px" },
                    { px: 10.0, label: "10px" },
                    { px: 11.0, label: "11px" },
                    { px: 12.0, label: "12px" },
                  ].map((preset) => {
                    const active = Math.abs(fontSizePx - preset.px) < 0.05;
                    return (
                      <button
                        key={preset.px}
                        type="button"
                        onClick={() => setFontSizePx(preset.px)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                          active
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  छोटा साइज = ज़्यादा प्रश्न एक पेज पर
                </span>
              </div>
            </div>

            {/* Layout Density Switches */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <div className="grid grid-cols-3 sm:inline-flex items-center h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 overflow-hidden divide-x divide-slate-200 dark:divide-slate-800 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setTwoColObjective((p) => !p)}
                  className={`h-full px-2.5 font-bold cursor-pointer whitespace-nowrap inline-flex items-center justify-center transition-colors ${
                    twoColObjective
                      ? "bg-[#070D19] text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Obj: {twoColObjective ? "2 Cols" : "1 Col"}
                </button>
                <button
                  type="button"
                  onClick={() => setTwoColSubjective((p) => !p)}
                  className={`h-full px-2.5 font-bold cursor-pointer whitespace-nowrap inline-flex items-center justify-center transition-colors ${
                    twoColSubjective
                      ? "bg-[#070D19] text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Subj: {twoColSubjective ? "2 Cols" : "1 Col"}
                </button>
                {isPrimaryQuestionCumAnswer ? (
                  <button
                    type="button"
                    onClick={() => setShowWritingLines((p) => !p)}
                    className={`h-full px-2.5 font-bold cursor-pointer whitespace-nowrap inline-flex items-center justify-center transition-colors ${
                      showWritingLines
                        ? "bg-amber-400 text-slate-950"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Ans Lines: {showWritingLines ? "ON" : "OFF"}
                  </button>
                ) : (
                  <span className="h-full px-2.5 font-bold whitespace-nowrap inline-flex items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900">
                    Questions Only
                  </span>
                )}
              </div>

              {selectedClass >= 4 && (
                <span
                  className={`font-bold tabular-nums text-right ${
                    selectedObjective.length >= SENIOR_MAX_OBJECTIVE
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-slate-500"
                  }`}
                >
                  Objective Cap: {selectedObjective.length} / {SENIOR_MAX_OBJECTIVE} Max
                </span>
              )}
            </div>

            {/* Print Orientation Switcher: Portrait A4 vs Landscape 2-Up / Booklet */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Print Layout:</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPrintOrientation("portrait")}
                  className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                    printOrientation === "portrait"
                      ? "bg-[#070D19] text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Portrait (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrientation("landscape_booklet")}
                  className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                    printOrientation === "landscape_booklet"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Landscape 2-Up / Booklet
                </button>
              </div>
            </div>

            {/* Live Page Fit Status Banner */}
            <div className="rounded-xl border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-start gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="tabular-nums">
                  {printOrientation === "landscape_booklet" ? (
                    (() => {
                      const bp = computeBookletSpreadPlan(layout.questionPageCount);
                      const isTwoUpCopy = bp.mode === "two_up_copy";
                      return (
                        <>
                          <div className="font-bold text-sky-900 dark:text-sky-200">
                            {isTwoUpCopy ? "Landscape 2-Copy Mode Ready" : "Booklet Fold Mode Ready"}:{" "}
                            {bp.physicalA4Sheets} A4 Sheet
                            {bp.physicalA4Sheets > 1 ? "s" : ""} ({bp.sides.length} Landscape Side
                            {bp.sides.length > 1 ? "s" : ""}) ·{" "}
                            {bp.sides
                              .map(
                                (s) =>
                                  `${s.side === "FRONT" ? "Front" : "Back"} [L:P${s.leftPageNo} | R:P${s.rightPageNo}]`
                              )
                              .join(" · ")}
                          </div>
                          <div className="text-[11px] opacity-90">
                            {isTwoUpCopy ? (
                              <>
                                ✂ 1 ही A4 शीट को बीच से काटने पर <strong>2 बच्चों के पूरे पेपर</strong> (50% कागज़ बचत · Front दोनों P1, Back दोनों P2) ·{" "}
                              </>
                            ) : (
                              <>
                                Double-Sided Print (Flip on Short Edge) → बीच से मोड़ने पर Page 1 Front, 2–3 अंदर, 4 Back ·{" "}
                              </>
                            )}
                            <strong>{totalSelectedCount} Qs · F.M. {fullMarksDisplay} Marks</strong>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <div className="font-bold">
                        Paper Ready: {layout.questionPageCount} A4 Page
                        {layout.questionPageCount > 1 ? "s" : ""} (
                        {layout.pages.map((pg) => `P${pg.pageNumber}: ${pg.utilizationPct}%`).join(" · ")}) + Page{" "}
                        {layout.answerKeyPageNumber}: Examiner Answer Key
                      </div>
                      <div className="text-[11px] opacity-90">
                        Sec A: {selectedObjective.length} Obj ({layout.objectiveMarks}M) · Sec B:{" "}
                        {selectedSubjective.length} Subj ({layout.subjectiveMarks}M) · Total:{" "}
                        <strong>{totalSelectedCount} Qs · F.M. {fullMarksDisplay} Marks</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!layout.fitsInTwoPages && layout.autoFitFontSizePx < fontSizePx && (
                <button
                  type="button"
                  onClick={() => setFontSizePx(layout.autoFitFontSizePx)}
                  className="h-7 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Fit 2P ({layout.autoFitFontSizePx}px)
                </button>
              )}
            </div>

            {/* A4 Direct Print Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <button
                type="button"
                disabled={downloadingMode !== null || totalSelectedCount === 0}
                onClick={() => void handlePrintA4("full")}
                className="sm:col-span-7 h-10 px-3 rounded-xl bg-[#070D19] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {downloadingMode === "full" ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Printer className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  {printOrientation === "landscape_booklet"
                    ? `Print Landscape + Key (${layout.questionPageCount}P)`
                    : `Print Paper + Key A4 (${layout.questionPageCount}P + Key)`}
                </span>
              </button>
              <button
                type="button"
                disabled={downloadingMode !== null || totalSelectedCount === 0}
                onClick={() => void handlePrintA4("questions_only")}
                className="sm:col-span-5 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {downloadingMode === "questions_only" ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {printOrientation === "landscape_booklet"
                    ? `Print Landscape (${layout.questionPageCount}P)`
                    : `Print Q-Paper A4 (${layout.questionPageCount}P)`}
                </span>
              </button>
            </div>
          </div>

          {/* Preview Sheet Selector (Dynamic for 1, 2, 3, ... N Pages + Key) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Authentic Print Paper Preview
              </span>
              {manualMoveCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllPageMoves}
                  className="h-6 px-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  title="सभी मैनुअल पेज मूव्स रीसेट करें"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Page Moves ({manualMoveCount})</span>
                </button>
              )}
            </div>
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] overflow-x-auto max-w-full">
              {(
                [
                  { id: "all" as PreviewSheetTab, label: `All (${layout.questionPageCount}P)` },
                  ...layout.pages.map((pg) => ({
                    id: `page_${pg.pageNumber}` as PreviewSheetTab,
                    label: `Page ${pg.pageNumber}`,
                  })),
                  { id: "key" as PreviewSheetTab, label: `Page ${layout.answerKeyPageNumber} (Key)` },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewSheet(tab.id)}
                  className={`h-7 px-2.5 rounded-lg font-bold cursor-pointer whitespace-nowrap inline-flex items-center ${
                    previewSheet === tab.id
                      ? "bg-[#070D19] text-white"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Authentic Printed Sheets Container */}
          {totalSelectedCount === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-xs text-slate-500">
              बाएँ तरफ से प्रश्न चुनें या <strong>Balanced Mix</strong> / <strong>Upload / JSON Print</strong> पर क्लिक करें — यहाँ तुरंत असली प्रिंटेड स्कूल परीक्षा पेपर दिखेगा।
            </div>
          ) : (
            <div className="space-y-4 max-h-[840px] overflow-y-auto pr-1">
              {(() => {
                const renderSheetCard = (
                  sheet: (typeof layout.pages)[number],
                  isCompactHalf = false,
                  cardKey?: string | number
                ) => {
                  const seenObjBefore = layout.pages.some(
                    (pg) => pg.pageNumber < sheet.pageNumber && pg.objectiveItems.length > 0
                  );
                  const seenSubjBefore = layout.pages.some(
                    (pg) => pg.pageNumber < sheet.pageNumber && pg.subjectiveItems.length > 0
                  );
                  const effectivePreviewFontPx = isCompactHalf
                    ? Math.max(5.0, Math.round(fontSizePx * 0.72 * 10) / 10)
                    : fontSizePx;
                  const renderGrouped = (
                    items: CustomNumberedItem[],
                    twoCol: boolean,
                    isSubjective: boolean
                  ) => {
                    const groups = groupConsecutiveByHeading(items, distinctSubjectCount);

                    return groups.map((grp, gIdx) => (
                      <div key={`${grp.subject}_${gIdx}`} className="mb-2">
                        {grp.subject && (
                          <div className="text-[1.02em] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-900/80 pb-0.5 mb-1.5">
                            {grp.subject}
                          </div>
                        )}
                        <div
                          className={`grid gap-x-4 gap-y-1.5 ${
                            twoCol ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                          }`}
                        >
                          {grp.items.map((item) => {
                            const cleanPrompt = sanitizePaperText(item.q.question);
                            const cleanPassage = item.q.passage
                              ? sanitizePaperText(item.q.passage)
                              : "";
                            const lineCount = isSubjective
                              ? getSubjectiveWritingLineCount(item.q, item.marks, effectiveShowWritingLines)
                              : 0;
                            const cleanOpts = item.q.options.map((o) => sanitizePaperText(o));
                            const maxOptLen = Math.max(...cleanOpts.map((o) => o.length), 0);
                            const fourColThreshold = fontSizePx <= 10.5 ? 20 : 15;
                            const fourColOpts = !twoCol && maxOptLen <= fourColThreshold;
                            const singleColOpts = maxOptLen > (twoCol ? 20 : 36);

                            const isManuallyPinned = manualPageOverrides[item.q.id] !== undefined;

                            return (
                              <div
                                key={item.q.id}
                                className={`group/qrow flex items-start gap-1.5 py-0.5 rounded transition-colors ${
                                  isManuallyPinned
                                    ? "bg-amber-50/70 ring-1 ring-amber-300/70 px-1 -mx-1"
                                    : "hover:bg-sky-50/40"
                                }`}
                              >
                                <span className="font-bold text-slate-950 shrink-0 tabular-nums min-w-[20px]">
                                  {item.displayNo}.
                                </span>
                                <div className="flex-1 min-w-0">
                                  {cleanPassage && (
                                    <div className="text-[0.9em] italic text-slate-700 border-l-2 border-slate-500 pl-2 mb-0.5 whitespace-pre-line">
                                      Read carefully: {cleanPassage}
                                    </div>
                                  )}
                                  <div className="font-medium text-slate-950 leading-snug whitespace-pre-line">
                                    {cleanPrompt}
                                  </div>
                                  {isSubjective && item.q.orQuestion && (
                                    <div className="mt-1">
                                      <div className="text-center font-black text-[0.82em] tracking-wider uppercase text-slate-700 my-0.5">
                                        — OR / अथवा —
                                      </div>
                                      {item.q.orPassage && (
                                        <div className="text-[0.9em] italic text-slate-700 border-l-2 border-slate-500 pl-2 mb-0.5 whitespace-pre-line">
                                          Read carefully: {sanitizePaperText(item.q.orPassage)}
                                        </div>
                                      )}
                                      <div className="font-medium text-slate-950 leading-snug whitespace-pre-line">
                                        {sanitizePaperText(item.q.orQuestion)}
                                      </div>
                                    </div>
                                  )}
                                  {!isSubjective && (
                                    <div
                                      className={`grid gap-x-2 gap-y-0.5 mt-0.5 text-[0.93em] text-slate-900 ${
                                        fourColOpts
                                          ? "grid-cols-2 sm:grid-cols-4"
                                          : singleColOpts
                                          ? "grid-cols-1"
                                          : "grid-cols-2"
                                      }`}
                                    >
                                      {cleanOpts.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-1">
                                          <span className="font-semibold">
                                            ({OPTION_LETTERS_LOWER[oi]})
                                          </span>
                                          {isPrimaryQuestionCumAnswer && (
                                            <span className="inline-block w-2.5 h-2.5 border border-slate-700 shrink-0" />
                                          )}
                                          <span className="truncate">{opt}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {lineCount > 0 && (
                                    <div className="mt-1.5 space-y-2.5">
                                      {Array.from({ length: lineCount }).map((_, li) => (
                                        <div
                                          key={li}
                                          className="border-b border-dotted border-slate-500 h-3.5 relative"
                                        >
                                          {li === 0 && (
                                            <span className="text-[0.82em] font-bold italic text-slate-700 pr-1 bg-white">
                                              Ans.
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-0.5 pl-1">
                                  <span className="font-bold text-slate-900 tabular-nums text-[0.9em]">
                                    [{item.marks}]
                                  </span>
                                  {/* Screen-only Move-to-Page Toolbar (Never printed on A4/PDF) */}
                                  <div
                                    className="font-sans inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white/95 px-0.5 py-0.5 shadow-2xs"
                                    style={{ fontSize: "9.5px", lineHeight: 1 }}
                                    title="इस प्रश्न को दूसरे पेज पर भेजें (बाकी प्रश्न और सीरियल नंबर ऑटोमैटिक एडजस्ट हो जाएंगे)"
                                  >
                                    {sheet.pageNumber > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveQuestionToPage(item.q.id, sheet.pageNumber - 1)
                                        }
                                        className="px-1 py-0.5 rounded bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-800 font-bold cursor-pointer"
                                        title={`Move to Page ${sheet.pageNumber - 1}`}
                                      >
                                        ←P{sheet.pageNumber - 1}
                                      </button>
                                    )}
                                    <select
                                      aria-label={`Move Question ${item.displayNo} to page`}
                                      value={sheet.pageNumber}
                                      onChange={(e) => {
                                        const nextPg = Number(e.target.value);
                                        if (nextPg !== sheet.pageNumber) {
                                          handleMoveQuestionToPage(item.q.id, nextPg);
                                        }
                                      }}
                                      className="bg-transparent text-slate-900 font-bold cursor-pointer outline-none px-0.5 py-0.5"
                                      style={{ fontSize: "9.5px" }}
                                    >
                                      {Array.from(
                                        { length: layout.questionPageCount },
                                        (_, pi) => pi + 1
                                      ).map((pgNo) => (
                                        <option key={pgNo} value={pgNo}>
                                          P{pgNo}
                                        </option>
                                      ))}
                                      <option value={layout.questionPageCount + 1}>
                                        +P{layout.questionPageCount + 1} (New)
                                      </option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleMoveQuestionToPage(item.q.id, sheet.pageNumber + 1)
                                      }
                                      className="px-1 py-0.5 rounded bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-800 font-bold cursor-pointer"
                                      title={`Move to Page ${sheet.pageNumber + 1}`}
                                    >
                                      P{sheet.pageNumber + 1}→
                                    </button>
                                    {isManuallyPinned && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnpinQuestionPage(item.q.id)}
                                        className="px-1 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-black cursor-pointer"
                                        title="Manual page pin हटाएँ (Auto-flow)"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  };

                  return (
                    <div
                      key={cardKey ?? sheet.pageNumber}
                      className={`bg-white text-slate-950 font-serif ${
                        isCompactHalf
                          ? "p-2 h-full"
                          : "border border-slate-400 shadow-sm p-4"
                      }`}
                      style={{ fontSize: `${effectivePreviewFontPx}px`, lineHeight: 1.34 }}
                    >
                      <div
                        className={`border-[1.5px] border-slate-900 flex flex-col justify-between space-y-2 h-full ${
                          isCompactHalf ? "p-2" : "p-3"
                        }`}
                      >
                        {/* Sheet Masthead */}
                        {sheet.pageNumber === 1 ? (
                          <div className="border-b-2 border-double border-slate-900 pb-2 space-y-1.5">
                            <div
                              className={`${
                                logoPosition === "center"
                                  ? "flex flex-col items-center text-center gap-1"
                                  : "flex items-center justify-between gap-2.5"
                              } ${
                                paperTheme === "heritage_navy"
                                  ? "bg-[#0f172a] text-white px-3 py-2 -mx-1 -mt-1"
                                  : ""
                              }`}
                            >
                              {logoPosition === "center" ? (
                                <>
                                  {previewMasthead.logoUrl && (
                                    <img
                                      src={previewMasthead.logoUrl}
                                      alt=""
                                      className={`w-11 h-11 object-contain shrink-0 ${
                                        paperTheme === "classic_bw"
                                          ? "grayscale contrast-125 brightness-95"
                                          : "bg-white rounded-full p-0.5"
                                      }`}
                                    />
                                  )}
                                  <div className="text-center w-full min-w-0">
                                    <div className="font-black uppercase tracking-wider text-[15px] leading-tight">
                                      {previewMasthead.schoolName}
                                    </div>
                                    {previewMasthead.tagline && (
                                      <div className="text-[9.5px] font-bold italic opacity-90 mt-0.5">
                                        {previewMasthead.tagline}
                                      </div>
                                    )}
                                    {previewMasthead.address && (
                                      <div className="text-[9px] opacity-90 mt-0.5">
                                        {previewMasthead.address}
                                      </div>
                                    )}
                                    {previewMasthead.contactLine && (
                                      <div className="text-[8.5px] font-bold opacity-95 mt-0.5">
                                        {previewMasthead.contactLine}
                                      </div>
                                    )}
                                    <div className="mt-1.5 inline-flex items-center gap-2 border border-current px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                                      <span>
                                        {paperTitle || "Examination"}
                                        {sessionLabel ? ` • SESSION ${sessionLabel}` : ""}
                                      </span>
                                      {paperCode && (
                                        <span className="font-mono">[{paperCode}]</span>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {previewMasthead.logoUrl ? (
                                    <img
                                      src={previewMasthead.logoUrl}
                                      alt=""
                                      className={`w-12 h-12 object-contain shrink-0 ${
                                        paperTheme === "classic_bw"
                                          ? "grayscale contrast-125 brightness-95"
                                          : "bg-white rounded-full p-0.5"
                                      }`}
                                    />
                                  ) : (
                                    <div className="w-12 shrink-0" />
                                  )}
                                  <div className="text-center flex-1 min-w-0">
                                    <div className="font-black uppercase tracking-wider text-[15px] leading-tight">
                                      {previewMasthead.schoolName}
                                    </div>
                                    {previewMasthead.tagline && (
                                      <div className="text-[9.5px] font-bold italic opacity-90 mt-0.5">
                                        {previewMasthead.tagline}
                                      </div>
                                    )}
                                    {previewMasthead.address && (
                                      <div className="text-[9px] opacity-90 mt-0.5">
                                        {previewMasthead.address}
                                      </div>
                                    )}
                                    {previewMasthead.contactLine && (
                                      <div className="text-[8.5px] font-bold opacity-95 mt-0.5">
                                        {previewMasthead.contactLine}
                                      </div>
                                    )}
                                    <div className="mt-1 inline-block border border-current px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                                      {paperTitle || "Examination"}
                                      {sessionLabel ? ` • SESSION ${sessionLabel}` : ""}
                                    </div>
                                  </div>
                                  {paperCode ? (
                                    <div className="border border-current px-1.5 py-0.5 text-center shrink-0">
                                      <div className="text-[7px] uppercase">Code</div>
                                      <div className="text-[10px] font-black font-mono">
                                        {paperCode}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-12 shrink-0" />
                                  )}
                                </>
                              )}
                            </div>

                            {/* Metadata Strip */}
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-b border-slate-700 py-1 text-[10px] tabular-nums">
                              <span>
                                <strong>Class:</strong> {formatEntranceClassLabel(selectedClass)}
                              </span>
                              <span>
                                <strong>Subject:</strong> {previewSubjectLabel}
                              </span>
                              {examDate && (
                                <span>
                                  <strong>Date:</strong> {examDate}
                                </span>
                              )}
                              <span>
                                <strong>Time:</strong> {previewTimeLabel}
                              </span>
                              <span>
                                <strong>F.M.:</strong> {fullMarksDisplay}
                              </span>
                            </div>

                            {/* Student Strip */}
                            {showStudentStrip && (
                              <div className="grid grid-cols-12 gap-2 pt-0.5 text-[9.5px]">
                                <div className="col-span-5 border-b border-dotted border-slate-500 pb-0.5">
                                  <strong>Name:</strong>
                                </div>
                                <div className="col-span-3 border-b border-dotted border-slate-500 pb-0.5">
                                  <strong>Roll No.:</strong>
                                </div>
                                <div className="col-span-1 border-b border-dotted border-slate-500 pb-0.5">
                                  <strong>Sec:</strong>
                                </div>
                                <div className="col-span-3 border border-slate-700 px-1.5 py-0.5 text-center font-bold tabular-nums">
                                  {isPrimaryQuestionCumAnswer
                                    ? `Marks Obt.: ____ / ${fullMarksDisplay}`
                                    : "Invigilator Sign:"}
                                </div>
                              </div>
                            )}

                            {/* CBSE Board Front-Page Verification Rules */}
                            {previewCbseRules.layout !== "none" && (
                              <div className="border border-slate-600 bg-slate-50/70 px-2 py-1 text-[7.8px] leading-snug text-slate-900">
                                {previewCbseRules.layout === "bilingual" ? (
                                  <div className="grid grid-cols-2 gap-2 divide-x divide-slate-300">
                                    <ul className="list-disc pl-3 space-y-0.5 pr-1">
                                      {previewCbseRules.hi.map((r, i) => (
                                        <li key={i}>{r}</li>
                                      ))}
                                    </ul>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                      {previewCbseRules.en.map((r, i) => (
                                        <li key={i}>{r}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <ul className="list-disc pl-3.5 space-y-0.5">
                                    {(previewCbseRules.hi.length > 0
                                      ? previewCbseRules.hi
                                      : previewCbseRules.en
                                    ).map((r, i) => (
                                      <li key={i}>{r}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}

                            {/* General Instructions */}
                            {parsedInstructions.length > 0 && (
                              <div className="text-[8.8px] text-slate-700 leading-snug pt-0.5">
                                <strong>General Instructions:</strong>{" "}
                                {parsedInstructions
                                  .map((line, i) => `(${i + 1}) ${sanitizePaperText(line)}`)
                                  .join("  ")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="border-b border-slate-900 pb-1 flex items-center justify-between text-[9.5px] font-bold">
                            <span className="uppercase">{previewSchoolName}</span>
                            <span>
                              {paperTitle} ({sessionLabel}) · {formatEntranceClassLabel(selectedClass)} ·{" "}
                              {previewSubjectLabel}
                            </span>
                            <span className="tabular-nums">
                              Page {sheet.pageNumber} of {layout.questionPageCount}
                            </span>
                          </div>
                        )}

                        {/* Section A: Objective */}
                        {sheet.objectiveItems.length > 0 && (
                          <div className="space-y-1.5">
                            <div
                              className={`flex items-center justify-between border-y py-0.5 px-1.5 text-[10px] font-black uppercase tracking-wide ${
                                paperTheme === "heritage_navy"
                                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                                  : "bg-slate-100 text-slate-950 border-slate-900"
                              }`}
                            >
                              <span>
                                SECTION – A : OBJECTIVE TYPE QUESTIONS
                                {seenObjBefore ? " (Continued)" : ""}
                              </span>
                              <span className="tabular-nums">
                                {seenObjBefore ? "[Continued]" : `[${layout.objectiveMarks} Marks]`}
                              </span>
                            </div>
                            {renderGrouped(sheet.objectiveItems, twoColObjective, false)}
                          </div>
                        )}

                        {/* Section B: Subjective */}
                        {sheet.subjectiveItems.length > 0 && (
                          <div className="space-y-1.5">
                            <div
                              className={`flex items-center justify-between border-y py-0.5 px-1.5 text-[10px] font-black uppercase tracking-wide ${
                                paperTheme === "heritage_navy"
                                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                                  : "bg-slate-100 text-slate-950 border-slate-900"
                              }`}
                            >
                              <span>
                                SECTION – B : SUBJECTIVE TYPE (SHORT & LONG ANSWER)
                                {seenSubjBefore ? " (Continued)" : ""}
                              </span>
                              <span className="tabular-nums">
                                {seenSubjBefore
                                  ? "[Continued]"
                                  : `[${layout.subjectiveMarks} Marks]`}
                              </span>
                            </div>
                            {renderGrouped(sheet.subjectiveItems, twoColSubjective, true)}
                          </div>
                        )}

                        {/* Sheet Footer */}
                        <div className="flex items-center justify-between border-t border-slate-400 pt-1 text-[9px] text-slate-600 tabular-nums">
                          <span>
                            <strong>{previewSchoolName}</strong> · {formatEntranceClassLabel(selectedClass)} (
                            {paperTitle})
                          </span>
                          <span>
                            {sheet.pageNumber === layout.questionPageCount
                              ? "*** Best of Luck ***  |  "
                              : "P.T.O.  |  "}
                            Page {sheet.pageNumber} of {layout.questionPageCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                };

                const renderRoughHalfCard = (
                  pageNo: number,
                  totalBookletPages: number,
                  cardKey: string
                ) => (
                  <div
                    key={cardKey}
                    className="bg-white text-slate-950 font-serif p-2 h-full"
                    style={{ fontSize: "7.5px", lineHeight: 1.35 }}
                  >
                    <div className="border-[1.5px] border-slate-900 p-2 h-full flex flex-col justify-between min-h-[300px]">
                      <div className="border-b border-slate-900 pb-1 flex items-center justify-between text-[7.5px] font-bold">
                        <span className="uppercase truncate">{previewSchoolName}</span>
                        <span className="tabular-nums shrink-0">
                          Page {pageNo} of {totalBookletPages}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center my-3 border border-dashed border-slate-300 rounded p-4 text-center">
                        <div className="font-sans font-extrabold text-[9.5px] text-slate-700 tracking-wide">
                          SPACE FOR ROUGH WORK / रफ़ कार्य के लिए स्थान
                        </div>
                        <div className="font-sans text-[8px] text-slate-500 mt-1">
                          Students may use this blank space for rough calculations.
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-400 pt-1 text-[7px] text-slate-600">
                        <span className="truncate">{previewSchoolName}</span>
                        <span>Rough Work · P{pageNo}/{totalBookletPages}</span>
                      </div>
                    </div>
                  </div>
                );

                // In Landscape mode + "All" tab: show authentic Side-by-Side 2-Up Landscape A4 Sheets!
                if (printOrientation === "landscape_booklet" && previewSheet === "all") {
                  const spreadPlan = computeBookletSpreadPlan(layout.questionPageCount);
                  const isTwoUpCopy = spreadPlan.mode === "two_up_copy";
                  const pageByNum = new Map(layout.pages.map((p) => [p.pageNumber, p]));
                  return spreadPlan.sides.map((spread, sIdx) => {
                    const leftSheet = pageByNum.get(spread.leftPageNo);
                    const rightSheet = pageByNum.get(spread.rightPageNo);
                    return (
                      <div
                        key={`spread_${sIdx}`}
                        className="rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-slate-900/60 p-2 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[10.5px] font-extrabold text-sky-950 dark:text-sky-200 tabular-nums">
                          <span>
                            A4 Landscape Sheet {spread.sheetNumber} ·{" "}
                            {spread.side === "FRONT" ? "FRONT SIDE (Side 1)" : "BACK SIDE (Side 2)"}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-[9.5px]">
                            Left: P{spread.leftPageNo}
                            {!leftSheet ? " (Rough)" : ""} &nbsp;|&nbsp;{" "}
                            {isTwoUpCopy ? "✂ Cut" : "Fold"} &nbsp;|&nbsp; Right: P{spread.rightPageNo}
                            {!rightSheet ? " (Rough)" : ""}
                          </span>
                        </div>
                        <div className="overflow-x-auto pb-1">
                          <div className="min-w-[620px] grid grid-cols-[1fr_14px_1fr] bg-white border border-slate-400 shadow-sm items-stretch">
                            <div className="min-w-0">
                              {leftSheet
                                ? renderSheetCard(leftSheet, true, `s${sIdx}_L_${spread.leftPageNo}`)
                                : renderRoughHalfCard(
                                    spread.leftPageNo,
                                    spreadPlan.paddedPageCount,
                                    `s${sIdx}_L_rough`
                                  )}
                            </div>
                            <div className="flex flex-col items-center justify-start pt-1.5 bg-white select-none">
                              <span className="text-[9px] font-bold text-slate-500 leading-none mb-1">
                                {isTwoUpCopy ? "✂" : "┆"}
                              </span>
                              <div className="flex-1 border-l border-dashed border-slate-400" />
                            </div>
                            <div className="min-w-0">
                              {rightSheet
                                ? renderSheetCard(rightSheet, true, `s${sIdx}_R_${spread.rightPageNo}`)
                                : renderRoughHalfCard(
                                    spread.rightPageNo,
                                    spreadPlan.paddedPageCount,
                                    `s${sIdx}_R_rough`
                                  )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                }

                // Portrait mode OR single-page tab: show full-size individual sheets
                return layout.pages
                  .filter((s) =>
                    previewSheet === "all"
                      ? true
                      : previewSheet === `page_${s.pageNumber}`
                  )
                  .map((sheet) => renderSheetCard(sheet, false));
              })()}

              {/* Examiner Marking Scheme & Combined Answer Key Preview */}
              {(previewSheet === "all" || previewSheet === "key") && (
                <div className="bg-white text-slate-950 border border-slate-400 shadow-sm p-4 font-serif text-[10px]">
                  <div className="border-[1.5px] border-slate-900 p-3 space-y-2.5">
                    <div className="border-b-2 border-slate-900 pb-1.5 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase">
                          {previewSchoolName} — EXAMINER MARKING SCHEME & ANSWER KEY
                        </div>
                        <div className="text-[9.5px] text-slate-600">
                          {paperTitle} ({sessionLabel}) · {formatEntranceClassLabel(selectedClass)} · F.M.:{" "}
                          {fullMarksDisplay} Marks
                        </div>
                      </div>
                      <span className="text-[9.5px] font-bold border border-slate-900 px-2 py-0.5 tabular-nums">
                        Page {layout.answerKeyPageNumber}
                      </span>
                    </div>

                    {(() => {
                      const orderedKeyObj = layout.pages.flatMap((p) => p.objectiveItems);
                      const orderedKeySubj = layout.pages.flatMap((p) => p.subjectiveItems);
                      return (
                        <>
                          {orderedKeyObj.length > 0 && (
                            <div className="space-y-1">
                              <div className="font-bold uppercase text-[9.5px] bg-slate-100 border border-slate-800 px-2 py-0.5">
                                Part A — Objective Answer Key ({orderedKeyObj.length} Qs · 1M Each)
                              </div>
                              <table className="w-full border-collapse text-[9.5px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-400 text-left">
                                    <th className="p-1 border border-slate-300 w-10 text-center">Q.No</th>
                                    <th className="p-1 border border-slate-300 w-24">Subject</th>
                                    <th className="p-1 border border-slate-300 w-10 text-center">Ans</th>
                                    <th className="p-1 border border-slate-300 w-36">Correct Option</th>
                                    <th className="p-1 border border-slate-300">Explanation / Key Hint</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderedKeyObj.map((item) => (
                                    <tr key={item.q.id} className="border-b border-slate-200">
                                      <td className="p-1 border border-slate-300 text-center font-bold tabular-nums">
                                        Q.{item.displayNo}
                                      </td>
                                      <td className="p-1 border border-slate-300 text-slate-700">
                                        {item.q.subject}
                                      </td>
                                      <td className="p-1 border border-slate-300 text-center font-black">
                                        ({OPTION_LETTERS_LOWER[item.q.correctIndex]})
                                      </td>
                                      <td className="p-1 border border-slate-300 font-bold">
                                        {sanitizePaperText(item.q.options[item.q.correctIndex] || "")}
                                      </td>
                                      <td className="p-1 border border-slate-300 text-slate-600">
                                        {sanitizePaperText(item.q.explanation || "")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {orderedKeySubj.length > 0 && (
                            <div className="space-y-1">
                              <div className="font-bold uppercase text-[9.5px] bg-slate-100 border border-slate-800 px-2 py-0.5">
                                Part B — Subjective Marking Scheme & Model Answers ({orderedKeySubj.length} Qs)
                              </div>
                              <table className="w-full border-collapse text-[9.5px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-400 text-left">
                                    <th className="p-1 border border-slate-300 w-10 text-center">Q.No</th>
                                    <th className="p-1 border border-slate-300 w-24">Subject</th>
                                    <th className="p-1 border border-slate-300">Question & Model Answer</th>
                                    <th className="p-1 border border-slate-300 w-12 text-center">Marks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderedKeySubj.map((item) => (
                                    <tr key={item.q.id} className="border-b border-slate-200">
                                      <td className="p-1 border border-slate-300 text-center font-bold tabular-nums">
                                        Q.{item.displayNo}
                                      </td>
                                      <td className="p-1 border border-slate-300 text-slate-700">
                                        {item.q.subject}
                                      </td>
                                      <td className="p-1 border border-slate-300">
                                        <div className="font-bold text-slate-900">
                                          {sanitizePaperText(item.q.question)}
                                        </div>
                                        <div className="text-emerald-900 mt-0.5">
                                          <strong>Model Ans:</strong>{" "}
                                          {sanitizePaperText(item.q.modelAnswer || item.q.explanation || "")}
                                        </div>
                                        {item.q.orQuestion && (
                                          <div className="mt-1 pt-1 border-t border-dotted border-slate-300">
                                            <div className="font-bold text-slate-800">
                                              [OR] {sanitizePaperText(item.q.orQuestion)}
                                            </div>
                                            {item.q.orModelAnswer && (
                                              <div className="text-emerald-900">
                                                <strong>[OR Ans]:</strong>{" "}
                                                {sanitizePaperText(item.q.orModelAnswer)}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-1 border border-slate-300 text-center font-bold tabular-nums">
                                        {item.marks}M
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Question & Marks Editor Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600" />
                <span>Edit Question &amp; Marks</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={editingQuestion.questionKind || "OBJECTIVE"}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        questionKind: e.target.value as "OBJECTIVE" | "SUBJECTIVE",
                      })
                    }
                    className="w-full h-9 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                  >
                    <option value="OBJECTIVE">Objective MCQ</option>
                    <option value="SUBJECTIVE">Subjective</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Marks (1–20M)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingQuestion.marks ?? 1}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        marks: Math.max(1, Math.min(20, Number(e.target.value || 1))),
                      })
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-black font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Section / Tag
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.topicTag || ""}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, topicTag: e.target.value })
                    }
                    placeholder="e.g. Section A - Biology"
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Passage / Case Study (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editingQuestion.passage || ""}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, passage: e.target.value })
                  }
                  placeholder="Optional reading passage / case study..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Full Question Text *
                </label>
                <textarea
                  rows={4}
                  value={editingQuestion.question}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, question: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                />
              </div>

              {editingQuestion.questionKind !== "SUBJECTIVE" ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {OPTION_LETTERS_UPPER.map((letter, idx) => (
                      <div key={letter}>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Option ({letter})
                        </label>
                        <input
                          type="text"
                          value={editingQuestion.options?.[idx] || ""}
                          onChange={(e) => {
                            const nextOpts: [string, string, string, string] = [
                              editingQuestion.options?.[0] || "",
                              editingQuestion.options?.[1] || "",
                              editingQuestion.options?.[2] || "",
                              editingQuestion.options?.[3] || "",
                            ];
                            nextOpts[idx] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: nextOpts });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Correct Option
                      </label>
                      <select
                        value={editingQuestion.correctIndex ?? 0}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            correctIndex: Number(e.target.value) as 0 | 1 | 2 | 3,
                          })
                        }
                        className="w-full h-9 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-xs font-bold"
                      >
                        {OPTION_LETTERS_UPPER.map((l, oi) => (
                          <option key={l} value={oi}>
                            Correct: ({l})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Answer Explanation (Answer Key)
                      </label>
                      <input
                        type="text"
                        value={editingQuestion.explanation || ""}
                        onChange={(e) =>
                          setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                        }
                        className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Model Answer / Marking Points
                    </label>
                    <textarea
                      rows={2}
                      value={editingQuestion.modelAnswer || editingQuestion.explanation || ""}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          modelAnswer: e.target.value,
                          explanation: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Optional OR / अथवा Alternative Question
                    </label>
                    <textarea
                      rows={2}
                      value={editingQuestion.orQuestion || ""}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, orQuestion: e.target.value })
                      }
                      placeholder="Leave blank if no OR alternative..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      OR Model Answer (Optional)
                    </label>
                    <input
                      type="text"
                      value={editingQuestion.orModelAnswer || ""}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, orModelAnswer: e.target.value })
                      }
                      className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitFullQuestionEdit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Question Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkQuestionUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        schoolId={school?.id || ""}
        defaultClass={selectedClass}
        defaultExamCategory={examCategory}
        allowAddToPaper={true}
        defaultSessionOnly={true}
        onQuestionsSaved={handleBulkSaved}
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
            ? () => downloadCustomEntrancePaperPdf(getPaperBuildInput(printPreviewData.mode))
            : undefined
        }
      />
    </div>
  );
};
