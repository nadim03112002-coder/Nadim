import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Printer,
  Trash2,
  Upload,
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
} from "../../school-types";
import {
  getClassTestBlueprint,
  saveBulkCustomEntranceQuestions,
} from "../../utils/entranceTestEngine";

export const EXAM_CATEGORY_OPTIONS: Array<{ value: ExamCategoryType; label: string; title: string }> = [
  { value: "ENTRANCE", label: "Entrance Exam", title: "Admission Entrance Examination" },
  { value: "PA1", label: "PA-1", title: "Periodic Assessment - 1 (PA-1)" },
  { value: "PA2", label: "PA-2", title: "Periodic Assessment - 2 (PA-2)" },
  { value: "PA3", label: "PA-3", title: "Periodic Assessment - 3 (PA-3)" },
  { value: "PA4", label: "PA-4", title: "Periodic Assessment - 4 (PA-4)" },
  { value: "HALF_YEARLY", label: "Half Yearly", title: "Half Yearly Examination" },
  { value: "FINAL_YEAR", label: "Final Year", title: "Annual / Final Year Examination" },
];

const ALL_SUBJECTS: EntranceTestSubject[] = [
  "English",
  "Mathematics",
  "Hindi",
  "Science",
  "EVS / GK",
  "Social Science",
  "Reasoning & GK",
];

const CLASSES: EntranceClassNumber[] = ALL_ENTRANCE_CLASSES;
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export interface ImportedPaperMetadata {
  schoolName?: string;
  examTitle?: string;
  classLevel?: EntranceClassNumber;
  subjectLabel?: string;
  examCategory?: ExamCategoryType;
  sessionLabel?: string;
  durationMinutes?: number;
  maximumMarks?: number;
  generalInstructions?: string[];
  cbseRulesMode?: CbseBoardRulesMode;
  customBoardRulesHi?: string[];
  customBoardRulesEn?: string[];
  printOrientation?: PaperPrintOrientation;
  replacePaper?: boolean;
  autoPrintMode?: "full" | "questions_only";
}

interface DraftRow {
  tempId: string;
  kind: "OBJECTIVE" | "SUBJECTIVE";
  subjectOverride?: EntranceTestSubject;
  sectionLabel?: string;
  passage?: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  modelAnswer: string;
  orQuestion?: string;
  orModelAnswer?: string;
  marks: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  defaultClass?: EntranceClassNumber;
  defaultExamCategory?: ExamCategoryType;
  allowAddToPaper?: boolean;
  defaultSessionOnly?: boolean;
  onQuestionsSaved: (
    saved: EntranceTestQuestion[],
    alsoAddToPaper: boolean,
    wasSavedToBank?: boolean,
    importedMeta?: ImportedPaperMetadata
  ) => void;
}

function makeTempId(idx: number): string {
  return `draft_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeEmptyRow(kind: "OBJECTIVE" | "SUBJECTIVE", idx = 0): DraftRow {
  return {
    tempId: makeTempId(idx),
    kind,
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    modelAnswer: "",
    orQuestion: "",
    orModelAnswer: "",
    marks: kind === "OBJECTIVE" ? 1 : 2,
  };
}

function parseCorrectLetterToIndex(raw: string): 0 | 1 | 2 | 3 {
  const c = String(raw || "").trim().toUpperCase().replace(/[^A-D1-4]/g, "");
  if (c.startsWith("B") || c === "2") return 1;
  if (c.startsWith("C") || c === "3") return 2;
  if (c.startsWith("D") || c === "4") return 3;
  return 0;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === "," || ch === "|") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseClassLevelFromRaw(raw: unknown): EntranceClassNumber | undefined {
  if (typeof raw === "number" && raw >= -2 && raw <= 10) {
    return raw as EntranceClassNumber;
  }
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("nursery") || s === "nur") return -2;
  if (s.includes("lkg") || s.includes("kg-1") || s.includes("kg 1")) return -1;
  if (s.includes("ukg") || s.includes("kg-2") || s.includes("kg 2")) return 0;

  const numMatch = s.match(/\b(10|[1-9])(?:st|nd|rd|th)?\b/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (n >= 1 && n <= 10) return n as EntranceClassNumber;
  }

  const romanMap: Record<string, EntranceClassNumber> = {
    x: 10,
    ix: 9,
    viii: 8,
    vii: 7,
    vi: 6,
    v: 5,
    iv: 4,
    iii: 3,
    ii: 2,
    i: 1,
  };
  const romanMatch = s.replace(/class|std|standard|grade|कक्षा/gi, "").trim();
  if (romanMap[romanMatch] !== undefined) return romanMap[romanMatch];
  return undefined;
}

function parseDurationMinutesFromRaw(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 10) {
    return Math.round(raw);
  }
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return undefined;
  const hrMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|घंटा|घंटे|घण्टे)/i);
  const minMatch = s.match(/(\d+)\s*(?:min|mins|minute|minutes|मिनट)/i);
  if (hrMatch || minMatch) {
    const hrs = hrMatch ? Number(hrMatch[1]) : 0;
    const mins = minMatch ? Number(minMatch[1]) : 0;
    const total = Math.round(hrs * 60 + mins);
    if (total >= 10 && total <= 360) return total;
  }
  const plainNum = Number(s.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(plainNum) && plainNum >= 15 && plainNum <= 360) {
    return Math.round(plainNum);
  }
  return undefined;
}

function detectExamCategoryFromTitle(title: string): ExamCategoryType | undefined {
  const t = String(title || "").toUpperCase();
  if (!t) return undefined;
  if (t.includes("PA-1") || t.includes("PA 1") || t.includes("PERIODIC ASSESSMENT - 1")) return "PA1";
  if (t.includes("PA-2") || t.includes("PA 2") || t.includes("PERIODIC ASSESSMENT - 2")) return "PA2";
  if (t.includes("PA-3") || t.includes("PA 3") || t.includes("PERIODIC ASSESSMENT - 3")) return "PA3";
  if (t.includes("PA-4") || t.includes("PA 4") || t.includes("PERIODIC ASSESSMENT - 4")) return "PA4";
  if (t.includes("HALF") || t.includes("अर्धवार्षिक")) return "HALF_YEARLY";
  if (t.includes("ANNUAL") || t.includes("FINAL") || t.includes("वार्षिक")) return "FINAL_YEAR";
  if (t.includes("ENTRANCE") || t.includes("ADMISSION")) return "ENTRANCE";
  return undefined;
}

function matchSubjectName(raw: unknown): EntranceTestSubject | undefined {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return undefined;
  const exact = ALL_SUBJECTS.find((sub) => sub.toLowerCase() === s);
  if (exact) return exact;
  if (s.includes("math") || s.includes("गणित")) return "Mathematics";
  if (s.includes("eng") || s.includes("अंग्रेजी")) return "English";
  if (s.includes("hin") || s.includes("हिंदी") || s.includes("हिन्दी")) return "Hindi";
  if (s.includes("social") || s === "sst" || s.includes("सामाजिक") || s.includes("history") || s.includes("geography") || s.includes("civics")) {
    return "Social Science";
  }
  if (s.includes("reason") || s.includes("aptitude")) return "Reasoning & GK";
  if (s.includes("evs") || s.includes("gk") || s.includes("general") || s.includes("पर्यावरण")) return "EVS / GK";
  if (
    s.includes("sci") ||
    s.includes("विज्ञान") ||
    s.includes("biology") ||
    s.includes("chemistry") ||
    s.includes("physics") ||
    s.includes("जीव") ||
    s.includes("रसायन") ||
    s.includes("भौतिक")
  ) {
    return "Science";
  }
  return undefined;
}

function extractOptionsFromJsonObj(obj: Record<string, any>): string[] {
  if (Array.isArray(obj.options)) {
    return obj.options.map((o: any) => {
      if (o && typeof o === "object") {
        return String(o.text ?? o.label ?? o.value ?? o.option ?? "").trim();
      }
      return String(o ?? "").trim();
    });
  }
  if (obj.options && typeof obj.options === "object") {
    const o = obj.options as Record<string, any>;
    const a = o.A ?? o.a ?? o["1"] ?? o["क"] ?? "";
    const b = o.B ?? o.b ?? o["2"] ?? o["ख"] ?? "";
    const c = o.C ?? o.c ?? o["3"] ?? o["ग"] ?? "";
    const d = o.D ?? o.d ?? o["4"] ?? o["घ"] ?? "";
    const vals = [a, b, c, d].map((x) => String(x ?? "").trim());
    if (vals.some(Boolean)) return vals;
    return Object.values(o).slice(0, 4).map((x) => String(x ?? "").trim());
  }
  if (Array.isArray(obj.choices)) {
    return obj.choices.map((o: any) => String(o ?? "").trim());
  }
  return [
    String(obj.optA ?? obj.optionA ?? obj.option_a ?? obj.a ?? obj.A ?? "").trim(),
    String(obj.optB ?? obj.optionB ?? obj.option_b ?? obj.b ?? obj.B ?? "").trim(),
    String(obj.optC ?? obj.optionC ?? obj.option_c ?? obj.c ?? obj.C ?? "").trim(),
    String(obj.optD ?? obj.optionD ?? obj.option_d ?? obj.d ?? obj.D ?? "").trim(),
  ];
}

function buildQuestionPromptFromJsonObj(obj: Record<string, any>): {
  prompt: string;
  passage?: string;
} {
  const rawBase = String(
    obj.question ?? obj.prompt ?? obj.q ?? obj.text ?? obj.statement ?? obj.title ?? ""
  ).trim();

  // Assertion-Reason format (CBSE standard: assertion + reason, often without a "question" key)
  const assertion = String(obj.assertion ?? obj.Assertion ?? "").trim();
  const reason = String(obj.reason ?? obj.Reason ?? "").trim();
  if (assertion || reason) {
    const lines: string[] = [];
    if (rawBase) lines.push(rawBase);
    if (assertion) lines.push(`Assertion (A): ${assertion}`);
    if (reason) lines.push(`Reason (R): ${reason}`);
    return { prompt: lines.join("\n") };
  }

  // Case-Based / Passage-Based format (caseText / passage + subQuestions)
  const caseText = String(obj.caseText ?? obj.passage ?? obj.paragraph ?? obj.caseStudy ?? "").trim();
  const subQuestions: any[] = Array.isArray(obj.subQuestions)
    ? obj.subQuestions
    : Array.isArray(obj.sub_questions)
    ? obj.sub_questions
    : [];
  const subPoints: any[] = Array.isArray(obj.subPoints)
    ? obj.subPoints
    : Array.isArray(obj.sub_points)
    ? obj.sub_points
    : Array.isArray(obj.points)
    ? obj.points
    : [];

  const romanIndices = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];

  if (caseText && subQuestions.length > 0) {
    const subLines = subQuestions
      .map((sq, i) => {
        if (typeof sq === "string") return `(${String.fromCharCode(97 + i)}) ${sq.trim()}`;
        const part = String(sq?.part ?? sq?.label ?? String.fromCharCode(97 + i)).trim();
        const sqText = String(sq?.question ?? sq?.text ?? sq?.q ?? "").trim();
        const sqMarks = sq?.marks ? ` [${sq.marks}M]` : "";
        return sqText ? `(${part}) ${sqText}${sqMarks}` : "";
      })
      .filter(Boolean);
    const promptLines = [rawBase, ...subLines].filter(Boolean);
    return {
      passage: caseText,
      prompt: promptLines.join("\n") || caseText,
    };
  }

  if (rawBase && subPoints.length > 0) {
    const pts = subPoints
      .map((pt, i) => {
        const txt = typeof pt === "string" ? pt.trim() : String(pt?.text ?? pt?.question ?? "").trim();
        return txt ? `(${romanIndices[i] || i + 1}) ${txt}` : "";
      })
      .filter(Boolean);
    return {
      passage: caseText || undefined,
      prompt: [rawBase, ...pts].join("\n"),
    };
  }

  if (rawBase && subQuestions.length > 0) {
    const subLines = subQuestions
      .map((sq, i) => {
        if (typeof sq === "string") return `(${String.fromCharCode(97 + i)}) ${sq.trim()}`;
        const part = String(sq?.part ?? String.fromCharCode(97 + i)).trim();
        const sqText = String(sq?.question ?? sq?.text ?? "").trim();
        const sqMarks = sq?.marks ? ` [${sq.marks}M]` : "";
        return sqText ? `(${part}) ${sqText}${sqMarks}` : "";
      })
      .filter(Boolean);
    return {
      passage: caseText || undefined,
      prompt: [rawBase, ...subLines].join("\n"),
    };
  }

  return {
    passage: caseText && rawBase ? caseText : undefined,
    prompt: rawBase || caseText,
  };
}

function cleanPossibleJsonEnvelope(rawText: string): string {
  let s = String(rawText || "").replace(/^\uFEFF/, "").trim();
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }
  // Extract substring from first { or [ to matching last } or ] if user pasted prose around JSON
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const firstObj = s.indexOf("{");
    const firstArr = s.indexOf("[");
    const startIdx =
      firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
    if (startIdx >= 0) {
      const openChar = s[startIdx];
      const closeChar = openChar === "{" ? "}" : "]";
      const endIdx = s.lastIndexOf(closeChar);
      if (endIdx > startIdx) {
        s = s.slice(startIdx, endIdx + 1).trim();
      }
    }
  }
  return s;
}

function tryParseJsonToDrafts(
  rawText: string,
  forceKind: "AUTO" | "OBJECTIVE" | "SUBJECTIVE"
): { isJson: boolean; drafts: DraftRow[]; meta?: ImportedPaperMetadata; jsonError?: string } {
  const cleaned = cleanPossibleJsonEnvelope(rawText);
  if (!cleaned.startsWith("[") && !cleaned.startsWith("{")) {
    return { isJson: false, drafts: [] };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    // Retry after fixing trailing commas (common in hand-edited JSON files)
    try {
      const relaxed = cleaned.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(relaxed);
    } catch {
      return {
        isJson: true,
        drafts: [],
        jsonError: err?.message || "Invalid JSON syntax",
      };
    }
  }

  const root =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed.paper && typeof parsed.paper === "object"
        ? parsed.paper
        : parsed.exam && typeof parsed.exam === "object"
        ? parsed.exam
        : parsed
      : parsed;

  // Extract Exam Metadata if present
  const rawMeta =
    root && typeof root === "object" && !Array.isArray(root)
      ? root.examMetadata || root.metadata || root.meta || root.header || root.paperInfo || root
      : null;

  let importedMeta: ImportedPaperMetadata | undefined;
  let rootSubjectOverride: EntranceTestSubject | undefined;

  const parseRulesLanguageMode = (raw: unknown): CbseBoardRulesMode | undefined => {
    const s = String(raw || "").trim().toLowerCase();
    if (!s) return undefined;
    if (s === "none" || s === "off" || s === "false" || s === "hide") return "none";
    if (s === "both" || s === "bilingual" || s === "hi+en" || s === "en+hi" || s === "hindi+english") {
      return "bilingual";
    }
    if (s === "hi" || s === "hindi" || s === "हिंदी" || s === "हिन्दी") return "hi";
    if (s === "en" || s === "eng" || s === "english") return "en";
    if (s === "auto") return "auto";
    return undefined;
  };

  const toStringList = (val: unknown): string[] => {
    if (Array.isArray(val)) {
      return val.map((x) => String(x ?? "").trim()).filter(Boolean);
    }
    if (typeof val === "string") {
      return val
        .split(/\r?\n+/)
        .map((x) => x.replace(/^[\u2022•\-*]+\s*/, "").trim())
        .filter(Boolean);
    }
    return [];
  };

  const isBoardChecklistRuleLine = (line: string): boolean => {
    return /(मुद्रित\s*पृष्ठ|printed\s*pages?|कोड\s*नम्बर|code\s*number|उत्तर[-\s]?पुस्तिका|answer[-\s]?book|10\.15|10\.30|15\s*(?:मिनट|minute)|serial\s*number|प्रश्न\s*का\s*क्रमांक)/i.test(
      line
    );
  };

  const splitByScript = (lines: string[]): { hi: string[]; en: string[] } => {
    const hi: string[] = [];
    const en: string[] = [];
    lines.forEach((line) => {
      if (/[\u0900-\u097F]/.test(line)) hi.push(line);
      else en.push(line);
    });
    return { hi, en };
  };

  if (rawMeta && typeof rawMeta === "object") {
    const examTitle = String(
      rawMeta.examTitle ?? rawMeta.paperTitle ?? rawMeta.title ?? rawMeta.examName ?? ""
    ).trim();
    const subjectLabel = String(rawMeta.subject ?? rawMeta.subjectName ?? "").trim();
    rootSubjectOverride = matchSubjectName(subjectLabel);
    const clsLevel = parseClassLevelFromRaw(rawMeta.class ?? rawMeta.classLevel ?? rawMeta.grade);
    const durMins = parseDurationMinutesFromRaw(
      rawMeta.timeAllowed ?? rawMeta.durationMinutes ?? rawMeta.duration ?? rawMeta.time
    );
    const maxMarksNum = Number(rawMeta.maximumMarks ?? rawMeta.maxMarks ?? rawMeta.fullMarks ?? 0);
    const sessionLabel = String(rawMeta.session ?? rawMeta.sessionLabel ?? "").trim();
    const schoolName = String(rawMeta.schoolName ?? "").trim();

    // Extract dedicated CBSE / Board rules from root OR rawMeta (supports object {hi,en}, array, or string)
    const rawBoardRulesSource =
      rawMeta.boardRules ??
      rawMeta.board_rules ??
      rawMeta.cbseRules ??
      rawMeta.cbse_rules ??
      rawMeta.paperRules ??
      rawMeta.paper_rules ??
      rawMeta.frontRules ??
      rawMeta.front_rules ??
      rawMeta.rules ??
      (root && typeof root === "object" && !Array.isArray(root)
        ? root.boardRules ??
          root.board_rules ??
          root.cbseRules ??
          root.cbse_rules ??
          root.paperRules ??
          root.rules
        : undefined);

    let customBoardRulesHi: string[] = [];
    let customBoardRulesEn: string[] = [];

    if (rawBoardRulesSource && typeof rawBoardRulesSource === "object" && !Array.isArray(rawBoardRulesSource)) {
      const rObj = rawBoardRulesSource as Record<string, unknown>;
      customBoardRulesHi = toStringList(rObj.hi ?? rObj.hindi ?? rObj.Hindi ?? rObj.HI);
      customBoardRulesEn = toStringList(rObj.en ?? rObj.english ?? rObj.English ?? rObj.EN);
    } else if (rawBoardRulesSource) {
      const split = splitByScript(toStringList(rawBoardRulesSource));
      customBoardRulesHi = split.hi;
      customBoardRulesEn = split.en;
    }

    const rawInstructions = toStringList(
      rawMeta.generalInstructions ?? rawMeta.general_instructions ?? rawMeta.instructions
    );
    const generalInstructionsClean: string[] = [];
    rawInstructions.forEach((line) => {
      if (isBoardChecklistRuleLine(line)) {
        if (/[\u0900-\u097F]/.test(line)) {
          if (!customBoardRulesHi.includes(line)) customBoardRulesHi.push(line);
        } else {
          if (!customBoardRulesEn.includes(line)) customBoardRulesEn.push(line);
        }
      } else {
        generalInstructionsClean.push(line);
      }
    });

    const explicitRulesMode = parseRulesLanguageMode(
      rawMeta.rulesLanguage ??
        rawMeta.rules_language ??
        rawMeta.boardRulesLanguage ??
        rawMeta.cbseRulesMode ??
        (root && typeof root === "object" && !Array.isArray(root)
          ? root.rulesLanguage ?? root.rules_language ?? root.cbseRulesMode
          : undefined)
    );

    const detectedRulesMode: CbseBoardRulesMode | undefined =
      explicitRulesMode ||
      (customBoardRulesHi.length > 0 && customBoardRulesEn.length > 0
        ? "bilingual"
        : customBoardRulesHi.length > 0
        ? "hi"
        : customBoardRulesEn.length > 0
        ? "en"
        : undefined);

    if (
      examTitle ||
      subjectLabel ||
      clsLevel !== undefined ||
      durMins ||
      maxMarksNum > 0 ||
      sessionLabel ||
      generalInstructionsClean.length > 0 ||
      customBoardRulesHi.length > 0 ||
      customBoardRulesEn.length > 0 ||
      detectedRulesMode
    ) {
      importedMeta = {
        schoolName: schoolName || undefined,
        examTitle: examTitle || undefined,
        classLevel: clsLevel,
        subjectLabel: subjectLabel || undefined,
        examCategory: detectExamCategoryFromTitle(examTitle),
        sessionLabel: sessionLabel || undefined,
        durationMinutes: durMins,
        maximumMarks: Number.isFinite(maxMarksNum) && maxMarksNum > 0 ? maxMarksNum : undefined,
        generalInstructions:
          generalInstructionsClean.length > 0 ? generalInstructionsClean : undefined,
        cbseRulesMode: detectedRulesMode,
        customBoardRulesHi: customBoardRulesHi.length > 0 ? customBoardRulesHi : undefined,
        customBoardRulesEn: customBoardRulesEn.length > 0 ? customBoardRulesEn : undefined,
        replacePaper: true,
      };
    }
  }

  // Collect question items from flat arrays OR nested sections/parts/groups
  type EnrichedJsonItem = Record<string, any> & {
    __defaultKind?: "OBJECTIVE" | "SUBJECTIVE";
    __sectionLabel?: string;
    __sectionSubject?: EntranceTestSubject;
  };
  const items: EnrichedJsonItem[] = [];

  const pushQuestionItem = (
    x: any,
    extra?: {
      defaultKind?: "OBJECTIVE" | "SUBJECTIVE";
      sectionLabel?: string;
      sectionSubject?: EntranceTestSubject;
    }
  ) => {
    if (!x || typeof x !== "object") return;
    items.push({
      ...x,
      __defaultKind: extra?.defaultKind,
      __sectionLabel: extra?.sectionLabel,
      __sectionSubject: extra?.sectionSubject,
    });
  };

  if (Array.isArray(root)) {
    root.forEach((x) => pushQuestionItem(x));
  } else if (root && typeof root === "object") {
    const sectionContainers = [root.sections, root.parts, root.groups, root.blocks].filter(
      Array.isArray
    );
    sectionContainers.forEach((secArr: any[]) => {
      secArr.forEach((sec: any) => {
        if (!sec || typeof sec !== "object") return;
        const secName = String(
          sec.sectionName ?? sec.title ?? sec.name ?? (sec.sectionId ? `Section ${sec.sectionId}` : "")
        ).trim();
        const secSubj = matchSubjectName(sec.subject || secName) || rootSubjectOverride;
        const secQs = Array.isArray(sec.questions)
          ? sec.questions
          : Array.isArray(sec.items)
          ? sec.items
          : [];
        secQs.forEach((q: any) =>
          pushQuestionItem(q, {
            sectionLabel: secName || undefined,
            sectionSubject: secSubj,
          })
        );
      });
    });

    if (Array.isArray(root.questions)) {
      root.questions.forEach((x: any) => pushQuestionItem(x, { sectionSubject: rootSubjectOverride }));
    }
    if (Array.isArray(root.items)) {
      root.items.forEach((x: any) => pushQuestionItem(x, { sectionSubject: rootSubjectOverride }));
    }
    if (Array.isArray(root.objectiveQuestions)) {
      root.objectiveQuestions.forEach((x: any) =>
        pushQuestionItem(x, { defaultKind: "OBJECTIVE", sectionSubject: rootSubjectOverride })
      );
    }
    if (Array.isArray(root.subjectiveQuestions)) {
      root.subjectiveQuestions.forEach((x: any) =>
        pushQuestionItem(x, { defaultKind: "SUBJECTIVE", sectionSubject: rootSubjectOverride })
      );
    }
    if (
      items.length === 0 &&
      (root.question || root.q || root.prompt || root.assertion || root.caseText)
    ) {
      pushQuestionItem(root, { sectionSubject: rootSubjectOverride });
    }
  }

  if (items.length === 0) {
    return { isJson: true, drafts: [], meta: importedMeta };
  }

  const drafts: DraftRow[] = [];
  items.forEach((obj, idx) => {
    const { prompt, passage } = buildQuestionPromptFromJsonObj(obj);
    if (!prompt) return;

    const rawOpts = extractOptionsFromJsonObj(obj);
    const nonEmptyOptCount = rawOpts.filter(Boolean).length;

    const rawKind = String(
      obj.questionKind ?? obj.kind ?? obj.type ?? obj.__defaultKind ?? ""
    ).toUpperCase();
    const detectedKind: "OBJECTIVE" | "SUBJECTIVE" =
      forceKind !== "AUTO"
        ? forceKind
        : rawKind.includes("SUBJ") ||
          rawKind.includes("SHORT") ||
          rawKind.includes("LONG") ||
          rawKind.includes("CASE") ||
          rawKind.includes("VERY SHORT") ||
          rawKind.includes("DESCRIPTIVE")
        ? "SUBJECTIVE"
        : rawKind.includes("OBJ") || rawKind.includes("MCQ") || rawKind.includes("ASSERTION")
        ? "OBJECTIVE"
        : nonEmptyOptCount >= 2
        ? "OBJECTIVE"
        : "SUBJECTIVE";

    const ansRaw =
      obj.correctIndex ??
      obj.answerIndex ??
      obj.correctAnswer ??
      obj.correctOption ??
      obj.rightAnswer ??
      obj.ans ??
      obj.answer ??
      obj.correct;
    let correctIndex: 0 | 1 | 2 | 3 = 0;
    if (typeof ansRaw === "number" && ansRaw >= 0 && ansRaw <= 3) {
      correctIndex = ansRaw as 0 | 1 | 2 | 3;
    } else if (typeof ansRaw === "string") {
      const matchedIdx = rawOpts.findIndex(
        (o: string) => o && o.toLowerCase() === ansRaw.trim().toLowerCase()
      );
      correctIndex =
        matchedIdx >= 0 && matchedIdx <= 3
          ? (matchedIdx as 0 | 1 | 2 | 3)
          : parseCorrectLetterToIndex(ansRaw);
    }

    const rawMarks = Number(obj.marks ?? obj.mark ?? (detectedKind === "OBJECTIVE" ? 1 : 2));
    const marks = Math.max(1, Math.min(10, Number.isFinite(rawMarks) ? rawMarks : 2));
    const modelAns = String(
      obj.modelAnswer ??
        obj.explanation ??
        obj.solution ??
        (detectedKind === "SUBJECTIVE" ? obj.answer ?? obj.ans ?? "" : "")
    ).trim();

    let orQ = "";
    if (typeof obj.orQuestion === "string") {
      orQ = obj.orQuestion.trim();
    } else if (obj.orQuestion && typeof obj.orQuestion === "object") {
      orQ = buildQuestionPromptFromJsonObj(obj.orQuestion).prompt;
    } else {
      orQ = String(obj.or ?? obj.alternativeQuestion ?? obj.choiceQuestion ?? "").trim();
    }
    const orAns = String(obj.orModelAnswer ?? obj.orAnswer ?? obj.alternativeAnswer ?? "").trim();

    drafts.push({
      tempId: makeTempId(idx),
      kind: detectedKind,
      subjectOverride:
        matchSubjectName(obj.subject) || obj.__sectionSubject || rootSubjectOverride,
      sectionLabel: obj.__sectionLabel,
      passage,
      question: prompt,
      options: [
        rawOpts[0] || "Option A",
        rawOpts[1] || "Option B",
        rawOpts[2] || "Option C",
        rawOpts[3] || "Option D",
      ],
      correctIndex,
      modelAnswer: detectedKind === "SUBJECTIVE" ? modelAns : "",
      orQuestion: detectedKind === "SUBJECTIVE" ? orQ : "",
      orModelAnswer: detectedKind === "SUBJECTIVE" ? orAns : "",
      marks,
    });
  });

  return { isJson: true, drafts, meta: importedMeta };
}

function parseBulkTextToDrafts(
  rawText: string,
  forceKind: "AUTO" | "OBJECTIVE" | "SUBJECTIVE"
): { drafts: DraftRow[]; isJson: boolean; meta?: ImportedPaperMetadata; jsonError?: string } {
  const jsonRes = tryParseJsonToDrafts(rawText, forceKind);
  if (jsonRes.isJson) {
    return {
      drafts: jsonRes.drafts,
      isJson: true,
      meta: jsonRes.meta,
      jsonError: jsonRes.jsonError,
    };
  }

  const text = String(rawText || "").replace(/\r\n/g, "\n").trim();
  if (!text) return { drafts: [], isJson: false };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Detect CSV / Pipe structured lines when majority of lines contain "|" or >= 3 commas
  const structuredLineCount = lines.filter(
    (l) => l.includes("|") || (l.match(/,/g) || []).length >= 3
  ).length;
  if (structuredLineCount > 0 && structuredLineCount >= Math.ceil(lines.length * 0.6)) {
    const rows: DraftRow[] = [];
    lines.forEach((line, idx) => {
      const cols = splitCsvLine(line);
      if (cols.length === 0) return;
      if (idx === 0 && /^question$/i.test(cols[0])) return;

      if (cols.length >= 6 && forceKind !== "SUBJECTIVE") {
        const [q, a, b, c, d, ansRaw, marksRaw] = cols;
        if (!q) return;
        rows.push({
          tempId: makeTempId(idx),
          kind: "OBJECTIVE",
          question: q,
          options: [a || "Option A", b || "Option B", c || "Option C", d || "Option D"],
          correctIndex: parseCorrectLetterToIndex(ansRaw),
          modelAnswer: "",
          marks: Math.max(1, Number(marksRaw || 1) || 1),
        });
      } else if (cols.length >= 1) {
        const [q, ans, marksRaw, orQ, orAns] = cols;
        if (!q) return;
        const marks = Math.max(1, Math.min(10, Number(marksRaw || 2) || 2));
        rows.push({
          tempId: makeTempId(idx),
          kind: "SUBJECTIVE",
          question: q,
          options: ["", "", "", ""],
          correctIndex: 0,
          modelAnswer: ans || "",
          orQuestion: orQ || "",
          orModelAnswer: orAns || "",
          marks,
        });
      }
    });
    return { drafts: rows, isJson: false };
  }

  // Block-based numbered or blank-line separated parsing (handles Hindi/English papers from Word/WhatsApp/AI)
  const rawBlocks: Array<{ sectionLabel?: string; lines: string[] }> = [];
  let currentBlock: string[] = [];
  let activeSectionLabel: string | undefined;
  const plainMeta: ImportedPaperMetadata = { replacePaper: true };
  let foundAnyPlainMeta = false;

  const isSectionHeaderLine = (l: string) =>
    /^(?:section|part|खंड|भाग)\s*[A-Z0-9\u0900-\u097F]+(?:\s*[:\-–—].*)?$/i.test(l) &&
    l.length <= 75;

  const tryExtractPlainHeaderMeta = (l: string): boolean => {
    let matched = false;
    const subjM = l.match(/(?:subject|विषय)\s*[:\-–]\s*([^|\n]+?)(?=\s*(?:\||time|समय|f\.?m\.?|full\s*marks|max|class|कक्षा|session|सत्र|$))/i);
    if (subjM && subjM[1].trim()) {
      plainMeta.subjectLabel = subjM[1].trim();
      matched = true;
    }
    const fmM = l.match(/(?:f\.?\s*m\.?|full\s*marks?|max(?:imum)?\s*marks?|total\s*marks?|पूर्णांक)\s*[:\-–=]?\s*(\d{1,3})/i);
    if (fmM) {
      const n = Number(fmM[1]);
      if (n > 0 && n <= 500) {
        plainMeta.maximumMarks = n;
        matched = true;
      }
    }
    const timeM = l.match(/(?:time|duration|समय)\s*[:\-–]\s*([^|\n]+)/i);
    if (timeM && timeM[1].trim()) {
      const mins = parseDurationMinutesFromRaw(timeM[1].trim());
      if (mins) {
        plainMeta.durationMinutes = mins;
        matched = true;
      }
    }
    const clsM = l.match(/(?:class|कक्षा)\s*[:\-–]?\s*([A-Za-z0-9\-\s]{1,12}?)(?=\s*(?:\||subject|विषय|time|f\.?m\.?|full\s*marks|session|$))/i);
    if (clsM && clsM[1].trim()) {
      const parsedCls = parseClassLevelFromRaw(clsM[1].trim());
      if (parsedCls !== undefined) {
        plainMeta.classLevel = parsedCls;
        matched = true;
      }
    }
    const sessM = l.match(/(?:session|सत्र)\s*[:\-–]\s*([0-9]{4}\s*[-–]\s*[0-9]{2,4})/i);
    if (sessM && sessM[1].trim()) {
      plainMeta.sessionLabel = sessM[1].replace(/\s+/g, "");
      matched = true;
    }
    const examM = l.match(/^(?:exam(?:ination)?|test|paper|परीक्षा)\s*[:\-–]\s*(.+)$/i);
    if (examM && examM[1].trim()) {
      plainMeta.examTitle = examM[1].trim();
      const cat = detectExamCategoryFromTitle(plainMeta.examTitle);
      if (cat) plainMeta.examCategory = cat;
      matched = true;
    }
    const isCbseRuleLine =
      /(मुद्रित\s*पृष्ठ|printed\s*pages?|कोड\s*नम्बर|code\s*number|उत्तर[-\s]?पुस्तिका|answer[-\s]?book|10\.15|10\.30|15\s*(?:मिनट|minute)|serial\s*number|प्रश्न\s*का\s*क्रमांक)/i.test(
        l
      );
    if (isCbseRuleLine) {
      const cleanRule = l.replace(/^[\u2022•\-*]+\s*/, "").trim();
      if (/[\u0900-\u097F]/.test(cleanRule)) {
        plainMeta.customBoardRulesHi = [...(plainMeta.customBoardRulesHi || []), cleanRule];
      } else {
        plainMeta.customBoardRulesEn = [...(plainMeta.customBoardRulesEn || []), cleanRule];
      }
      if (plainMeta.customBoardRulesHi?.length && plainMeta.customBoardRulesEn?.length) {
        plainMeta.cbseRulesMode = "bilingual";
      } else if (plainMeta.customBoardRulesHi?.length) {
        plainMeta.cbseRulesMode = "hi";
      } else if (plainMeta.customBoardRulesEn?.length) {
        plainMeta.cbseRulesMode = "en";
      }
      matched = true;
    }
    if (matched) foundAnyPlainMeta = true;
    return (
      matched ||
      /^(?:general\s*instructions|सामान्य\s*निर्देश|note\s*[:\-])/i.test(l)
    );
  };

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      rawBlocks.push({ sectionLabel: activeSectionLabel, lines: currentBlock });
      currentBlock = [];
    }
  };

  for (const rawLine of text.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushBlock();
      continue;
    }
    if (isSectionHeaderLine(trimmed)) {
      flushBlock();
      activeSectionLabel = trimmed;
      continue;
    }
    if (currentBlock.length === 0 && rawBlocks.length === 0 && tryExtractPlainHeaderMeta(trimmed)) {
      continue;
    }
    const startsNewQ =
      /^(?:(?:Q|Pr|प्र|प्रश्न)\.?\s*\d+\s*[\).:\-]\s*|\d+\s*[\).]\s+)/i.test(trimmed);
    if (startsNewQ && currentBlock.length > 0) {
      flushBlock();
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }
  flushBlock();

  const drafts: DraftRow[] = [];

  rawBlocks.forEach((blk, bIdx) => {
    let promptLines: string[] = [];
    const opts: [string, string, string, string] = ["", "", "", ""];
    let ansText = "";
    let orQText = "";
    let orAnsText = "";
    let marksOverride: number | null = null;
    let foundOptionCount = 0;
    let awaitingOrLine = false;

    for (const rawLine of blk.lines) {
      let line = rawLine;
      const marksMatch = line.match(
        /(?:\[|\()\s*(\d{1,2})\s*(?:M|Marks?|अंक)?\s*(?:\]|\))\s*$/i
      );
      if (marksMatch && /(?:M|Marks?|अंक|\[)/i.test(marksMatch[0])) {
        marksOverride = Math.max(1, Math.min(10, Number(marksMatch[1])));
        line = line.replace(marksMatch[0], "").trim();
      }

      // Standalone OR / अथवा line — next line becomes the OR alternative question
      if (/^(?:OR|OR\s*\/\s*अथवा|अथवा|—\s*OR\s*—)$/i.test(line)) {
        awaitingOrLine = true;
        continue;
      }

      if (awaitingOrLine) {
        orQText = orQText ? `${orQText}\n${line}` : line;
        awaitingOrLine = false;
        continue;
      }

      // 4 options on one line: (A) ... (B) ... (C) ... (D) ...
      const multiOptMatch = line.match(
        /\(?A\)?[.)\s]+(.+?)\s+\(?B\)?[.)\s]+(.+?)\s+\(?C\)?[.)\s]+(.+?)\s+\(?D\)?[.)\s]+(.+)$/i
      );
      if (multiOptMatch) {
        opts[0] = multiOptMatch[1].trim();
        opts[1] = multiOptMatch[2].trim();
        opts[2] = multiOptMatch[3].trim();
        opts[3] = multiOptMatch[4].trim();
        foundOptionCount = 4;
        continue;
      }

      // 2 options on one line: (A) ... (B) ... OR (C) ... (D) ...
      const twoOptAB = line.match(/^\(?A\)?[.)\s]+(.+?)\s{2,}\(?B\)?[.)\s]+(.+)$/i);
      if (twoOptAB) {
        opts[0] = twoOptAB[1].trim();
        opts[1] = twoOptAB[2].trim();
        foundOptionCount = Math.max(foundOptionCount, 2);
        continue;
      }
      const twoOptCD = line.match(/^\(?C\)?[.)\s]+(.+?)\s{2,}\(?D\)?[.)\s]+(.+)$/i);
      if (twoOptCD) {
        opts[2] = twoOptCD[1].trim();
        opts[3] = twoOptCD[2].trim();
        foundOptionCount = 4;
        continue;
      }

      // Single option line: (A) ... | A. ... | a) ... | (क) ...
      const singleOptMatch = line.match(/^\(?([A-Da-dकखगघ])\)?[.)\s]+(.+)$/);
      if (singleOptMatch) {
        const rawKey = singleOptMatch[1].toUpperCase();
        const hindiMap: Record<string, number> = { "क": 0, "ख": 1, "ग": 2, "घ": 3 };
        const oIdx =
          hindiMap[rawKey] !== undefined
            ? hindiMap[rawKey]
            : OPTION_LETTERS.indexOf(rawKey as (typeof OPTION_LETTERS)[number]);
        if (oIdx >= 0) {
          opts[oIdx] = singleOptMatch[2].trim();
          foundOptionCount++;
          continue;
        }
      }

      // Inline OR choice prompt: OR: ... | OR / अथवा: ...
      const orMatch = line.match(/^(?:OR(?:\s*\/\s*अथवा)?|अथवा)\s*[:\-–]\s*(.+)$/i);
      if (orMatch) {
        orQText = orMatch[1].trim();
        continue;
      }

      const orAnsMatch = line.match(/^OR\s*Ans(?:wer)?\s*[:\-–]\s*(.+)$/i);
      if (orAnsMatch) {
        orAnsText = orAnsMatch[1].trim();
        continue;
      }

      const ansMatch = line.match(
        /^(?:Ans(?:wer)?|Correct\s*Ans(?:wer)?|Model\s*Ans(?:wer)?|Key|Sol(?:ution)?|उत्तर|सही\s*उत्तर)\s*[:\-–]\s*(.+)$/i
      );
      if (ansMatch) {
        ansText = ansMatch[1].trim();
        continue;
      }

      const cleanedPromptLine =
        promptLines.length === 0
          ? line.replace(/^(?:(?:Q|Pr|प्र|प्रश्न)\.?\s*\d+\s*[\).:\-]\s*|\d+\s*[\).]\s*)/i, "").trim()
          : line;
      if (cleanedPromptLine) promptLines.push(cleanedPromptLine);
    }

    const questionText = promptLines.join("\n").trim();
    if (!questionText) return;

    const detectedKind: "OBJECTIVE" | "SUBJECTIVE" =
      forceKind !== "AUTO"
        ? forceKind
        : foundOptionCount >= 2
        ? "OBJECTIVE"
        : "SUBJECTIVE";

    if (detectedKind === "OBJECTIVE") {
      drafts.push({
        tempId: makeTempId(bIdx),
        kind: "OBJECTIVE",
        sectionLabel: blk.sectionLabel,
        subjectOverride: matchSubjectName(blk.sectionLabel),
        question: questionText,
        options: [
          opts[0] || "Option A",
          opts[1] || "Option B",
          opts[2] || "Option C",
          opts[3] || "Option D",
        ],
        correctIndex: parseCorrectLetterToIndex(ansText),
        modelAnswer: "",
        marks: marksOverride || 1,
      });
    } else {
      drafts.push({
        tempId: makeTempId(bIdx),
        kind: "SUBJECTIVE",
        sectionLabel: blk.sectionLabel,
        subjectOverride: matchSubjectName(blk.sectionLabel),
        question: questionText,
        options: ["", "", "", ""],
        correctIndex: 0,
        modelAnswer: ansText || "Key concept & clear steps required.",
        orQuestion: orQText || "",
        orModelAnswer: orAnsText || "",
        marks: marksOverride || 2,
      });
    }
  });

  return { drafts, isJson: false, meta: foundAnyPlainMeta ? plainMeta : undefined };
}

const SAMPLE_BULK_TEMPLATE = `1. What is the SI unit of Force? [1M]
(A) Joule
(B) Newton
(C) Watt
(D) Pascal
Ans: B

2. Which gas is released during photosynthesis? [1M]
(A) Carbon dioxide
(B) Nitrogen
(C) Oxygen
(D) Hydrogen
Ans: C

3. Define Photosynthesis and write its balanced word equation. [3M]
Ans: Photosynthesis is the process by which green plants convert sunlight, water, and carbon dioxide into glucose and oxygen in the presence of chlorophyll.

4. State two differences between speed and velocity. [2M]
Ans: Speed is scalar (distance/time, always positive); Velocity is vector (displacement/time, has direction and can be zero or negative).`;

const SAMPLE_JSON_TEMPLATE = `[
  {
    "subject": "Science",
    "kind": "OBJECTIVE",
    "question": "Which organelle is called the powerhouse of the cell?",
    "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
    "correctIndex": 1,
    "marks": 1
  },
  {
    "subject": "Science",
    "kind": "SUBJECTIVE",
    "question": "Explain Photosynthesis with its balanced word equation.",
    "modelAnswer": "Green plants synthesize glucose & oxygen from CO2 and water using sunlight & chlorophyll.",
    "orQuestion": "Write three differences between aerobic and anaerobic respiration.",
    "orModelAnswer": "Aerobic uses oxygen and releases complete energy; anaerobic occurs without oxygen with partial energy.",
    "marks": 3
  }
]`;

export const BulkQuestionUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  schoolId,
  defaultClass = 1,
  defaultExamCategory = "PA1",
  allowAddToPaper = false,
  defaultSessionOnly = false,
  onQuestionsSaved,
}) => {
  const [examCategory, setExamCategory] = useState<ExamCategoryType>(defaultExamCategory);
  const [classLevel, setClassLevel] = useState<EntranceClassNumber>(defaultClass);
  const [subject, setSubject] = useState<EntranceTestSubject>("English");
  const [entryMode, setEntryMode] = useState<"paste" | "grid">("paste");
  const [pasteForceKind, setPasteForceKind] = useState<"AUTO" | "OBJECTIVE" | "SUBJECTIVE">("AUTO");
  const [rawText, setRawText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<DraftRow[]>([]);
  const [detectedMeta, setDetectedMeta] = useState<ImportedPaperMetadata | null>(null);
  const [replaceCurrentPaper, setReplaceCurrentPaper] = useState<boolean>(true);
  const [includeAnswerKeyOnPrint, setIncludeAnswerKeyOnPrint] = useState<boolean>(false);
  const [gridRows, setGridRows] = useState<DraftRow[]>([
    makeEmptyRow("SUBJECTIVE", 1),
    makeEmptyRow("SUBJECTIVE", 2),
    makeEmptyRow("OBJECTIVE", 3),
  ]);
  const [alsoAddToPaper, setAlsoAddToPaper] = useState<boolean>(allowAddToPaper || defaultSessionOnly);
  const [saveToBank, setSaveToBank] = useState<boolean>(!defaultSessionOnly);
  const [cbseRulesMode, setCbseRulesMode] = useState<CbseBoardRulesMode>("auto");
  const [printOrientation, setPrintOrientation] = useState<PaperPrintOrientation>("portrait");
  const [saving, setSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setExamCategory(defaultExamCategory);
    setClassLevel(defaultClass);
    setAlsoAddToPaper(allowAddToPaper || defaultSessionOnly);
    setSaveToBank(!defaultSessionOnly);
    setReplaceCurrentPaper(true);
    setCbseRulesMode("auto");
    setPrintOrientation("portrait");
  }, [isOpen, defaultClass, defaultExamCategory, allowAddToPaper, defaultSessionOnly]);

  const subjectOptions = useMemo(() => {
    const bp = getClassTestBlueprint(classLevel).quotas.map((q) => q.subject);
    const extra = ALL_SUBJECTS.filter((s) => !bp.includes(s));
    return [...bp, ...extra];
  }, [classLevel]);

  useEffect(() => {
    if (!subjectOptions.includes(subject)) {
      setSubject(subjectOptions[0]);
    }
  }, [subjectOptions, subject]);

  if (!isOpen) return null;

  const activeDrafts = entryMode === "paste" ? parsedRows : gridRows;
  const validDrafts = activeDrafts.filter((r) => {
    if (!r.question.trim()) return false;
    if (r.kind === "OBJECTIVE") {
      return r.options.some((o) => o.trim().length > 0);
    }
    return true;
  });

  const applyDetectedMetaToForm = (meta?: ImportedPaperMetadata) => {
    if (!meta) {
      setDetectedMeta(null);
      return;
    }
    setDetectedMeta(meta);
    if (meta.classLevel !== undefined) setClassLevel(meta.classLevel);
    if (meta.examCategory) setExamCategory(meta.examCategory);
    const matchedSubj = matchSubjectName(meta.subjectLabel);
    if (matchedSubj) setSubject(matchedSubj);
    if (meta.replacePaper) setReplaceCurrentPaper(true);
    if (meta.cbseRulesMode) setCbseRulesMode(meta.cbseRulesMode);
  };

  const handleParseText = () => {
    const { drafts, isJson, meta, jsonError } = parseBulkTextToDrafts(rawText, pasteForceKind);
    if (jsonError) {
      toast.error(`JSON फॉर्मेट में त्रुटि: ${jsonError}`);
      return;
    }
    if (drafts.length === 0) {
      toast.error("कोई प्रश्न पहचान में नहीं आया। JSON या Sample Template देखकर फॉर्मेट जांचें।");
      return;
    }
    setParsedRows(drafts);
    applyDetectedMetaToForm(meta);
    if (isJson) {
      // JSON upload = Print-Only session mode by default (not saved in app)
      setSaveToBank(false);
      setAlsoAddToPaper(true);
      setReplaceCurrentPaper(true);
    }
    const objC = drafts.filter((d) => d.kind === "OBJECTIVE").length;
    const subjC = drafts.length - objC;
    toast.success(
      `${drafts.length} प्रश्न तैयार हैं (${objC} Objective · ${subjC} Subjective)${
        isJson ? " — Print-Only (App में Save नहीं होगा)" : ""
      }`
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isFileJson = lowerName.endsWith(".json");
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setRawText(content);
      // Uploaded files are strictly Print-Only (not persisted in app storage/DB)
      setSaveToBank(false);
      setAlsoAddToPaper(true);
      setReplaceCurrentPaper(true);

      const { drafts, meta, jsonError } = parseBulkTextToDrafts(content, pasteForceKind);
      if (jsonError) {
        toast.error(`JSON फ़ाइल में Syntax त्रुटि: ${jsonError}`);
        return;
      }
      if (drafts.length > 0) {
        setParsedRows(drafts);
        applyDetectedMetaToForm(meta);
        const objC = drafts.filter((d) => d.kind === "OBJECTIVE").length;
        const subjC = drafts.length - objC;
        toast.success(
          `${isFileJson ? "JSON" : "फ़ाइल"} से ${drafts.length} प्रश्न लोड हुए (${objC} Obj · ${subjC} Subj — केवल प्रिंट के लिए)!`
        );
      } else {
        toast.error("फ़ाइल से कोई प्रश्न पहचान में नहीं आया। कृपया फ़ाइल फॉर्मेट जांचें।");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateRow = (
    mode: "paste" | "grid",
    tempId: string,
    updater: (row: DraftRow) => DraftRow
  ) => {
    const setter = mode === "paste" ? setParsedRows : setGridRows;
    setter((prev) => prev.map((r) => (r.tempId === tempId ? updater(r) : r)));
  };

  const removeRow = (mode: "paste" | "grid", tempId: string) => {
    const setter = mode === "paste" ? setParsedRows : setGridRows;
    setter((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleSaveAll = async (autoPrintMode?: "full" | "questions_only") => {
    let workingDrafts = validDrafts;
    let effectiveMeta = detectedMeta || undefined;
    let effectiveClass = classLevel;
    let effectiveCategory = examCategory;
    let effectiveSubject = subject;
    let effectiveSaveToBank = saveToBank;

    // Auto-parse on the fly if user pasted JSON/text and clicked Load directly without clicking Parse first!
    if (entryMode === "paste" && workingDrafts.length === 0 && rawText.trim().length > 0) {
      const parsedNow = parseBulkTextToDrafts(rawText, pasteForceKind);
      if (parsedNow.jsonError) {
        toast.error(`JSON फॉर्मेट में त्रुटि: ${parsedNow.jsonError}`);
        return;
      }
      const autoValid = parsedNow.drafts.filter((r) => {
        if (!r.question.trim()) return false;
        if (r.kind === "OBJECTIVE") return r.options.some((o) => o.trim().length > 0);
        return true;
      });
      if (autoValid.length > 0) {
        workingDrafts = autoValid;
        setParsedRows(autoValid);
        if (parsedNow.meta) {
          effectiveMeta = parsedNow.meta;
          applyDetectedMetaToForm(parsedNow.meta);
          if (parsedNow.meta.classLevel !== undefined) effectiveClass = parsedNow.meta.classLevel;
          if (parsedNow.meta.examCategory) effectiveCategory = parsedNow.meta.examCategory;
          const mSubj = matchSubjectName(parsedNow.meta.subjectLabel);
          if (mSubj) effectiveSubject = mSubj;
        }
        if (parsedNow.isJson) {
          effectiveSaveToBank = false;
          setSaveToBank(false);
        }
      }
    }

    if (workingDrafts.length === 0) {
      toast.error(
        entryMode === "paste"
          ? "पहले JSON/टेक्स्ट पेस्ट करें या फ़ाइल चुनें।"
          : "कम से कम 1 प्रश्न लिखें।"
      );
      return;
    }

    setSaving(true);
    try {
      const examLabel =
        EXAM_CATEGORY_OPTIONS.find((x) => x.value === effectiveCategory)?.label || effectiveCategory;
      const clsLabel = formatEntranceClassLabel(effectiveClass);
      const payload = workingDrafts.map((d) => {
        const isSubj = d.kind === "SUBJECTIVE";
        const cleanOpts: [string, string, string, string] = isSubj
          ? ["", "", "", ""]
          : [
              d.options[0].trim() || "Option A",
              d.options[1].trim() || "Option B",
              d.options[2].trim() || "Option C",
              d.options[3].trim() || "Option D",
            ];
        const ansSummary = isSubj
          ? d.modelAnswer.trim() || "Evaluate on concept accuracy & presentation."
          : `Correct answer is (${OPTION_LETTERS[d.correctIndex]}) ${cleanOpts[d.correctIndex]}.`;
        const cleanOrQ = isSubj ? (d.orQuestion || "").trim() : "";
        const cleanOrAns = isSubj ? (d.orModelAnswer || "").trim() : "";
        return {
          classLevel: effectiveClass,
          subject: d.subjectOverride || effectiveSubject,
          questionKind: d.kind,
          examCategory: effectiveCategory,
          format: isSubj
            ? d.marks >= 3
              ? ("LONG_ANSWER" as const)
              : ("SHORT_ANSWER" as const)
            : ("MCQ" as const),
          question: d.question.trim(),
          ...(d.passage ? { passage: d.passage.trim() } : {}),
          options: cleanOpts,
          correctIndex: isSubj ? (0 as const) : d.correctIndex,
          explanation: ansSummary,
          modelAnswer: isSubj ? ansSummary : undefined,
          ...(cleanOrQ ? { orQuestion: cleanOrQ } : {}),
          ...(cleanOrQ && cleanOrAns ? { orModelAnswer: cleanOrAns } : {}),
          marks: Math.max(1, Math.min(10, Number(d.marks || (isSubj ? 2 : 1)))),
          topicTag:
            d.sectionLabel ||
            (effectiveSaveToBank ? `${examLabel} · Manual Upload` : `${examLabel} · Temp Print Import`),
        };
      });

      const finalMeta: ImportedPaperMetadata = {
        ...(effectiveMeta || {}),
        classLevel: effectiveClass,
        examCategory: effectiveCategory,
        cbseRulesMode,
        printOrientation,
        replacePaper: replaceCurrentPaper,
        ...(autoPrintMode ? { autoPrintMode } : {}),
      };

      if (!effectiveSaveToBank) {
        // Print-Only / Session-Only mode: NEVER save to localStorage or Firebase
        const nowIso = new Date().toISOString();
        const sessionItems: EntranceTestQuestion[] = payload.map((item, idx) => ({
          ...item,
          id: `tmp_print_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          isCustom: true,
          isTempSessionOnly: true,
          createdAt: nowIso,
        }));
        toast.success(
          autoPrintMode
            ? `${sessionItems.length} प्रश्न (${clsLabel}) A4 प्रिंट के लिए तैयार हैं — App में सेव नहीं किए गए।`
            : `${sessionItems.length} प्रश्न पेपर में लोड हो गए (${clsLabel}) — App में सेव नहीं किए गए। अब सीधे Print करें!`
        );
        onQuestionsSaved(sessionItems, true, false, finalMeta);
        onClose();
        return;
      }

      const saved = await saveBulkCustomEntranceQuestions(schoolId, payload);
      toast.success(
        `${saved.length} प्रश्न (${examLabel} · ${clsLabel} · ${effectiveSubject}) सेव हो गए!`
      );
      onQuestionsSaved(saved, alsoAddToPaper, true, finalMeta);
      onClose();
    } catch (err: any) {
      toast.error("प्रोसेस करने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-600" />
              <span>JSON / File / Bulk Question Import (Nursery to Class 10)</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              JSON, .TXT, .CSV फ़ाइल या Paste से प्रश्न जोड़ें — Print-Only मोड में प्रश्न App में सेव नहीं होंगे, सीधे प्रिंट पेपर में आएँगे।
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Exam / Class / Subject Selectors */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white dark:bg-slate-900">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Exam Tag
            </label>
            <select
              value={examCategory}
              onChange={(e) => setExamCategory(e.target.value as ExamCategoryType)}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              {EXAM_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Class (Nur–10)
            </label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(Number(e.target.value) as EntranceClassNumber)}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {formatEntranceClassLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as EntranceTestSubject)}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              {subjectOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEntryMode("paste")}
              className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                entryMode === "paste"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste / File Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("grid")}
              className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                entryMode === "grid"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Quick Batch Grid</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {entryMode === "paste" ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Parse As:
                    </span>
                    {(
                      [
                        { id: "AUTO", label: "Auto Detect (Obj + Subj)" },
                        { id: "OBJECTIVE", label: "All Objective MCQs" },
                        { id: "SUBJECTIVE", label: "All Subjective" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPasteForceKind(m.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                          pasteForceKind === m.id
                            ? "bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.txt,.csv,application/json,text/plain,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload .JSON / .TXT / .CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRawText(SAMPLE_JSON_TEMPLATE);
                        const res = parseBulkTextToDrafts(SAMPLE_JSON_TEMPLATE, pasteForceKind);
                        setParsedRows(res.drafts);
                        setSaveToBank(false);
                        setAlsoAddToPaper(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      Sample JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRawText(SAMPLE_BULK_TEMPLATE);
                        setParsedRows(parseBulkTextToDrafts(SAMPLE_BULK_TEMPLATE, pasteForceKind).drafts);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      Sample Text
                    </button>
                  </div>
                </div>

                <textarea
                  rows={7}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`यहाँ JSON, CSV या प्रश्नों का टेक्स्ट पेस्ट करें (JSON / File अपलोड करने पर App में Save नहीं होगा, सीधे Print Paper में लोड होगा)...\n\nJSON Example:\n[{"question":"What is 2+2?","options":["3","4","5","6"],"correctIndex":1}]\n\nText Example:\n1. Define Photosynthesis. [3M]\nOR: Write two uses of plants.\nAns: Green plants prepare food using sunlight...`}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono leading-relaxed"
                />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    Supports <strong>.JSON</strong>, numbered text + <code>OR:</code> choice, <code>[2M]</code>/<code>[3M]</code>, and CSV/pipe lines.
                  </span>
                  <button
                    type="button"
                    onClick={handleParseText}
                    className="px-4 py-2 rounded-lg bg-[#070D19] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Parse Questions ({parsedRows.length} Loaded)
                  </button>
                </div>
              </div>

              {detectedMeta && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold">Exam Metadata Auto-Detected:</span>
                  {detectedMeta.examTitle && <span>{detectedMeta.examTitle}</span>}
                  {detectedMeta.classLevel !== undefined && (
                    <span>· {formatEntranceClassLabel(detectedMeta.classLevel)}</span>
                  )}
                  {detectedMeta.subjectLabel && <span>· {detectedMeta.subjectLabel}</span>}
                  {detectedMeta.maximumMarks && <span>· {detectedMeta.maximumMarks} Marks</span>}
                  {detectedMeta.durationMinutes && <span>· {detectedMeta.durationMinutes} Mins</span>}
                  {detectedMeta.generalInstructions && (
                    <span>· {detectedMeta.generalInstructions.length} Instructions</span>
                  )}
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Parsed Preview — Review & Edit Before Loading ({parsedRows.length} Qs)
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedRows([]);
                        setDetectedMeta(null);
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear Preview
                    </button>
                  </div>

                  {parsedRows.map((row, idx) => (
                    <div
                      key={row.tempId}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                            Q.{idx + 1}
                          </span>
                          <select
                            value={row.kind}
                            onChange={(e) => {
                              const k = e.target.value as "OBJECTIVE" | "SUBJECTIVE";
                              updateRow("paste", row.tempId, (r) => ({
                                ...r,
                                kind: k,
                                marks: k === "OBJECTIVE" ? 1 : Math.max(2, r.marks),
                              }));
                            }}
                            className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
                          >
                            <option value="OBJECTIVE">Objective (MCQ)</option>
                            <option value="SUBJECTIVE">Subjective</option>
                          </select>
                          <select
                            value={row.marks}
                            onChange={(e) =>
                              updateRow("paste", row.tempId, (r) => ({
                                ...r,
                                marks: Number(e.target.value),
                              }))
                            }
                            className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold font-mono"
                          >
                            {[1, 2, 3, 4, 5].map((m) => (
                              <option key={m} value={m}>
                                {m}M
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRow("paste", row.tempId)}
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={row.question}
                        onChange={(e) =>
                          updateRow("paste", row.tempId, (r) => ({
                            ...r,
                            question: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                      />

                      {row.kind === "OBJECTIVE" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 items-center">
                          {OPTION_LETTERS.map((l, oi) => (
                            <input
                              key={l}
                              type="text"
                              value={row.options[oi]}
                              onChange={(e) =>
                                updateRow("paste", row.tempId, (r) => {
                                  const nextOpts: [string, string, string, string] = [...r.options];
                                  nextOpts[oi] = e.target.value;
                                  return { ...r, options: nextOpts };
                                })
                              }
                              placeholder={`Opt ${l}`}
                              className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
                            />
                          ))}
                          <select
                            value={row.correctIndex}
                            onChange={(e) =>
                              updateRow("paste", row.tempId, (r) => ({
                                ...r,
                                correctIndex: Number(e.target.value) as 0 | 1 | 2 | 3,
                              }))
                            }
                            className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-900 dark:text-emerald-200"
                          >
                            {OPTION_LETTERS.map((l, oi) => (
                              <option key={l} value={oi}>
                                Ans: {l}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={row.modelAnswer}
                            onChange={(e) =>
                              updateRow("paste", row.tempId, (r) => ({
                                ...r,
                                modelAnswer: e.target.value,
                              }))
                            }
                            placeholder="Model Answer / Marking Points (for Answer Key)"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
                          />
                          <input
                            type="text"
                            value={row.orQuestion || ""}
                            onChange={(e) =>
                              updateRow("paste", row.tempId, (r) => ({
                                ...r,
                                orQuestion: e.target.value,
                              }))
                            }
                            placeholder="Optional OR / अथवा alternative question (CBSE Internal Choice)..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  हर लाइन में सीधे प्रश्न टाइप करें — PA-1, PA-2, Half Yearly या Final Year के लिए तेज़ एंट्री।
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setGridRows((prev) => [...prev, makeEmptyRow("OBJECTIVE", prev.length + 1)])
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Objective Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGridRows((prev) => [...prev, makeEmptyRow("SUBJECTIVE", prev.length + 1)])
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Subjective Row</span>
                  </button>
                </div>
              </div>

              {gridRows.map((row, idx) => (
                <div
                  key={row.tempId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold tabular-nums">#{idx + 1}</span>
                      <select
                        value={row.kind}
                        onChange={(e) => {
                          const k = e.target.value as "OBJECTIVE" | "SUBJECTIVE";
                          updateRow("grid", row.tempId, (r) => ({
                            ...r,
                            kind: k,
                            marks: k === "OBJECTIVE" ? 1 : Math.max(2, r.marks),
                          }));
                        }}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
                      >
                        <option value="OBJECTIVE">Objective (MCQ)</option>
                        <option value="SUBJECTIVE">Subjective</option>
                      </select>
                      <select
                        value={row.marks}
                        onChange={(e) =>
                          updateRow("grid", row.tempId, (r) => ({
                            ...r,
                            marks: Number(e.target.value),
                          }))
                        }
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold font-mono"
                      >
                        {[1, 2, 3, 4, 5].map((m) => (
                          <option key={m} value={m}>
                            {m} Marks
                          </option>
                        ))}
                      </select>
                    </div>
                    {gridRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow("grid", row.tempId)}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={row.question}
                    onChange={(e) =>
                      updateRow("grid", row.tempId, (r) => ({ ...r, question: e.target.value }))
                    }
                    placeholder="Question text (English or Hindi)..."
                    className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                  />

                  {row.kind === "OBJECTIVE" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                      {OPTION_LETTERS.map((l, oi) => (
                        <input
                          key={l}
                          type="text"
                          value={row.options[oi]}
                          onChange={(e) =>
                            updateRow("grid", row.tempId, (r) => {
                              const nextOpts: [string, string, string, string] = [...r.options];
                              nextOpts[oi] = e.target.value;
                              return { ...r, options: nextOpts };
                            })
                          }
                          placeholder={`Option ${l}`}
                          className="px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
                        />
                      ))}
                      <select
                        value={row.correctIndex}
                        onChange={(e) =>
                          updateRow("grid", row.tempId, (r) => ({
                            ...r,
                            correctIndex: Number(e.target.value) as 0 | 1 | 2 | 3,
                          }))
                        }
                        className="px-2 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-900 dark:text-emerald-200"
                      >
                        {OPTION_LETTERS.map((l, oi) => (
                          <option key={l} value={oi}>
                            Correct: {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={row.modelAnswer}
                      onChange={(e) =>
                        updateRow("grid", row.tempId, (r) => ({
                          ...r,
                          modelAnswer: e.target.value,
                        }))
                      }
                      placeholder="Model Answer / Marking Value Points (Printed in Answer Key)..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={!saveToBank}
                  onChange={(e) => {
                    const nextPrintOnly = e.target.checked;
                    setSaveToBank(!nextPrintOnly);
                    if (nextPrintOnly) setAlsoAddToPaper(true);
                  }}
                  className="rounded accent-amber-600"
                />
                <span>Print-Only (App में Save NAHI होगा)</span>
              </label>

              {(alsoAddToPaper || !saveToBank) && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceCurrentPaper}
                    onChange={(e) => setReplaceCurrentPaper(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  <span>Replace Current Paper (सिर्फ यही प्रश्न पेपर में रखें)</span>
                </label>
              )}

              {!saveToBank && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAnswerKeyOnPrint}
                    onChange={(e) => setIncludeAnswerKeyOnPrint(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>Answer Key भी साथ प्रिंट करें</span>
                </label>
              )}

              {saveToBank && allowAddToPaper && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoAddToPaper}
                    onChange={(e) => setAlsoAddToPaper(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>Also add to active Paper</span>
                </label>
              )}

              <div className="inline-flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">CBSE Rules:</span>
                <select
                  value={cbseRulesMode}
                  onChange={(e) => setCbseRulesMode(e.target.value as CbseBoardRulesMode)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="auto">Auto (Smart)</option>
                  <option value="hi">हिंदी केवल</option>
                  <option value="en">English Only</option>
                  <option value="bilingual">दोनों (Hindi + English)</option>
                  <option value="none">बंद (Off)</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">Print Mode:</span>
                <select
                  value={printOrientation}
                  onChange={(e) => setPrintOrientation(e.target.value as PaperPrintOrientation)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="portrait">Portrait (A4)</option>
                  <option value="landscape_booklet">Landscape 2-Up / Booklet (1 Sheet)</option>
                </select>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {saveToBank ? (
                <span>App Question Bank में Save होगा · </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  केवल प्रिंट के लिए लोड होगा (Database में Save नहीं होगा) ·{" "}
                </span>
              )}
              <strong className="text-slate-900 dark:text-white">{validDrafts.length}</strong>{" "}
              questions ({validDrafts.filter((d) => d.kind === "OBJECTIVE").length} Obj ·{" "}
              {validDrafts.filter((d) => d.kind === "SUBJECTIVE").length} Subj)
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>

            {!saveToBank ? (
              <>
                <button
                  type="button"
                  disabled={
                    saving ||
                    (validDrafts.length === 0 &&
                      !(entryMode === "paste" && rawText.trim().length > 0))
                  }
                  onClick={() => void handleSaveAll()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {validDrafts.length > 0
                      ? `Preview Paper (${validDrafts.length} Qs)`
                      : "Parse & Preview"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    (validDrafts.length === 0 &&
                      !(entryMode === "paste" && rawText.trim().length > 0))
                  }
                  onClick={() =>
                    void handleSaveAll(includeAnswerKeyOnPrint ? "full" : "questions_only")
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  <span>
                    {validDrafts.length > 0
                      ? `Print Paper A4 (${validDrafts.length} Qs)`
                      : "Parse & Print A4"}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={
                  saving ||
                  (validDrafts.length === 0 &&
                    !(entryMode === "paste" && rawText.trim().length > 0))
                }
                onClick={() => void handleSaveAll()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {saving
                    ? "Processing..."
                    : `Save ${validDrafts.length} Questions to Bank`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
