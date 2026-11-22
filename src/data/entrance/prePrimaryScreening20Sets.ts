// ═════════════════════════════════════════════════════════════════════════════
// PRE-PRIMARY VISUAL SCREENING & LEVEL PLACEMENT BANK (NURSERY / LKG / UKG)
// 20 Distinct Printable Sets (PP-Set-01 .. PP-Set-20)
// Evaluates exact child readiness across:
//   Level 1 (Nursery Foundation) -> 16 Marks
//   Level 2 (LKG / KG-1 Readiness) -> 16 Marks
//   Level 3 (UKG / KG-2 Readiness) -> 18 Marks
//   Total: 50 Marks
// Placement Rules (Default):
//   0% – 39%   -> Nursery
//   40% – 69%  -> LKG (KG-1)
//   70% – 100% -> UKG (KG-2)
// ═════════════════════════════════════════════════════════════════════════════

export type PrePrimaryLevelBand = "NURSERY" | "LKG" | "UKG";

export type PrePrimaryQuestionType =
  | "count_write"
  | "box_addition"
  | "color_match"
  | "color_fill"
  | "circle_correct"
  | "missing_box"
  | "compare_tick"
  | "word_join";

export type PrePrimaryIconKey =
  | "apple"
  | "mango"
  | "ball"
  | "star"
  | "sun"
  | "leaf"
  | "fish"
  | "flower"
  | "house"
  | "kite"
  | "balloon"
  | "cup"
  | "pencil"
  | "circle"
  | "triangle"
  | "square"
  | "heart"
  | "car";

export interface PrePrimaryColorPair {
  colorName: string;
  hindiName: string;
  hex: string;
  objectLabel: string;
  icon: PrePrimaryIconKey;
}

export interface PrePrimaryQuestion {
  id: string;
  qNo: number;
  levelBand: PrePrimaryLevelBand;
  levelLabel: string;
  subject: "Number & Math" | "English & Phonics" | "Hindi Akshar" | "Colours & Shapes" | "EVS & Logic";
  type: PrePrimaryQuestionType;
  marks: number;
  instruction: string;
  instructionHi?: string;
  // Type-specific payloads:
  countIcon?: PrePrimaryIconKey;
  countValue?: number;
  countColorHex?: string;

  addLeft?: number;
  addRight?: number;
  addOp?: "+" | "-";
  addIcon?: PrePrimaryIconKey;
  addColorHex?: string;

  matchColors?: PrePrimaryColorPair[];
  matchRightOrder?: number[]; // shuffled indices of matchColors

  fillIcon?: PrePrimaryIconKey;
  fillTotalShapes?: number;
  fillTargetCount?: number;
  fillTargetColorName?: string;
  fillTargetColorHex?: string;

  circleChoices?: Array<{
    label: string;
    icon?: PrePrimaryIconKey;
    colorHex?: string;
  }>;
  circlePictureHint?: { icon: PrePrimaryIconKey; colorHex: string; label?: string };
  circleCorrectIndex?: number;

  missingSequence?: Array<string | null>; // null = empty printable box
  missingAnswers?: string[];

  compareLeft?: { icon: PrePrimaryIconKey; size: "big" | "small"; count: number; colorHex: string; label?: string };
  compareRight?: { icon: PrePrimaryIconKey; size: "big" | "small"; count: number; colorHex: string; label?: string };
  compareAnswerSide?: "LEFT" | "RIGHT";

  wordParts?: string[];
  wordPromptIcon?: PrePrimaryIconKey;
  wordPromptColor?: string;

  answerSummary: string;
}

export interface PrePrimaryPaperSet {
  setNumber: number;
  setId: string; // e.g. "PP-Set-01"
  totalMarks: number;
  durationMinutes: number;
  levelMarks: {
    NURSERY: number;
    LKG: number;
    UKG: number;
  };
  questions: PrePrimaryQuestion[];
  oralChecklist: Array<{ item: string; note: string }>;
}

export interface PrePrimaryPlacementResult {
  level: PrePrimaryLevelBand;
  classLabel: string;
  shortTag: string;
  hindiRemark: string;
  percentage: number;
}

export const TOTAL_PRE_PRIMARY_SETS = 20;

export function formatPrePrimarySetId(setNumber: number): string {
  const n = Math.max(1, Math.min(TOTAL_PRE_PRIMARY_SETS, Math.round(setNumber || 1)));
  return `PP-Set-${String(n).padStart(2, "0")}`;
}

export function evaluatePrePrimaryScore(
  scoredMarks: number,
  maxMarks: number,
  lkgThresholdPct = 40,
  ukgThresholdPct = 70
): PrePrimaryPlacementResult {
  const safeMax = Math.max(1, maxMarks || 50);
  const pct = Math.max(0, Math.min(100, Math.round((Math.max(0, scoredMarks) / safeMax) * 100)));
  if (pct >= ukgThresholdPct) {
    return {
      level: "UKG",
      classLabel: "UKG (KG-2)",
      shortTag: `UKG / KG-2 Ready (${pct}%)`,
      hindiRemark: `${ukgThresholdPct}%+ अंक: बच्चा Addition, 3-Letter Words और 1–50 गिनती में दक्ष है — UKG (KG-2) में नामांकन दें।`,
      percentage: pct,
    };
  }
  if (pct >= lkgThresholdPct) {
    return {
      level: "LKG",
      classLabel: "LKG (KG-1)",
      shortTag: `LKG / KG-1 Ready (${pct}%)`,
      hindiRemark: `${lkgThresholdPct}%–${ukgThresholdPct - 1}% अंक: बच्चा अक्षर, रंग व शुरुआती गिनती पहचानता है — LKG (KG-1) के लिए बिल्कुल सही है।`,
      percentage: pct,
    };
  }
  return {
    level: "NURSERY",
    classLabel: "Nursery",
    shortTag: `Nursery Level (${pct}%)`,
    hindiRemark: `${lkgThresholdPct}% से कम अंक: बच्चे को शुरुआती अक्षर, पेंसिल ग्रिप व 1–10 गिनती की नींव चाहिए — Nursery में नामांकन दें।`,
    percentage: pct,
  };
}

// ── Deterministic Seeded PRNG ────────────────────────────────────────────────
function createRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Clean Self-Contained Inline SVG Library (Works 100% Offline in HTML/PDF) ──
export function renderPrePrimaryIconSvg(
  icon: PrePrimaryIconKey,
  options?: { size?: number; color?: string; bw?: boolean; hollow?: boolean }
): string {
  const size = options?.size ?? 24;
  const bw = Boolean(options?.bw);
  const hollow = Boolean(options?.hollow);
  const fill = hollow ? "#ffffff" : bw ? "#e2e8f0" : options?.color || "#ef4444";
  const stroke = "#0f172a";
  const sw = bw || hollow ? 2.2 : 1.7;

  switch (icon) {
    case "apple":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 9 C16 5, 19 3, 21 3" stroke="${stroke}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M16 8 C19 4, 24 5, 22 9 C20 10, 17 9, 16 8 Z" fill="${hollow ? "#fff" : bw ? "#cbd5e1" : "#22c55e"}" stroke="${stroke}" stroke-width="1.3"/><path d="M16 9 C11 8, 6 12, 7 19 C8 25, 12 28, 15 27 C16 26.7, 16 26.7, 17 27 C20 28, 24 25, 25 19 C26 12, 21 8, 16 9 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    case "mango":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M17 5 L19 2" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/><path d="M16 6 C23 6, 26 12, 23 20 C20 27, 13 29, 10 25 C7 22, 10 19, 10 15 C10 10, 12 6, 16 6 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    case "ball":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><path d="M6 12 Q16 17 26 12" fill="none" stroke="${stroke}" stroke-width="1.4"/><path d="M6 20 Q16 15 26 20" fill="none" stroke="${stroke}" stroke-width="1.4"/><line x1="16" y1="4" x2="16" y2="28" stroke="${stroke}" stroke-width="1.4"/></svg>`;
    case "star":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="16,3 20,11 29,12 22,18 24,27 16,23 8,27 10,18 3,12 12,11" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
    case "sun":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="7" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><g stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"><line x1="16" y1="2" x2="16" y2="6"/><line x1="16" y1="26" x2="16" y2="30"/><line x1="2" y1="16" x2="6" y2="16"/><line x1="26" y1="16" x2="30" y2="16"/><line x1="6" y1="6" x2="9" y2="9"/><line x1="23" y1="23" x2="26" y2="26"/><line x1="26" y1="6" x2="23" y2="9"/><line x1="9" y1="23" x2="6" y2="26"/></g></svg>`;
    case "leaf":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M6 26 C6 12, 14 5, 26 6 C26 18, 19 26, 6 26 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><path d="M5 27 L21 11" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case "fish":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M4 16 C8 8, 19 8, 23 16 C19 24, 8 24, 4 16 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><polygon points="22,16 29,10 29,22" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/><circle cx="10" cy="14" r="1.6" fill="${stroke}"/></svg>`;
    case "flower":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="8" r="4.5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="24" cy="16" r="4.5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="16" cy="24" r="4.5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="8" cy="16" r="4.5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="16" cy="16" r="4" fill="${hollow ? "#fff" : bw ? "#94a3b8" : "#facc15"}" stroke="${stroke}" stroke-width="1.6"/></svg>`;
    case "house":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="4,15 16,4 28,15" fill="${hollow ? "#fff" : bw ? "#cbd5e1" : "#fb923c"}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/><rect x="7" y="15" width="18" height="13" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><rect x="13" y="20" width="6" height="8" fill="#fff" stroke="${stroke}" stroke-width="1.5"/></svg>`;
    case "kite":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="16,3 27,13 16,25 5,13" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/><line x1="16" y1="3" x2="16" y2="25" stroke="${stroke}" stroke-width="1.3"/><line x1="5" y1="13" x2="27" y2="13" stroke="${stroke}" stroke-width="1.3"/><path d="M16 25 Q13 28 19 30" fill="none" stroke="${stroke}" stroke-width="1.6"/></svg>`;
    case "balloon":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><ellipse cx="16" cy="12" rx="8.5" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><polygon points="14,22 18,22 16,25" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><path d="M16 25 Q14 28 17 31" fill="none" stroke="${stroke}" stroke-width="1.5"/></svg>`;
    case "cup":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M6 10 H22 V20 C22 25, 6 25, 6 20 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/><path d="M22 12 H25 C27 12, 27 19, 25 19 H22" fill="none" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    case "pencil":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="6,26 8,19 22,5 27,10 13,24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/><line x1="19" y1="8" x2="24" y2="13" stroke="${stroke}" stroke-width="1.5"/></svg>`;
    case "circle":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="11.5" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    case "triangle":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="16,4 28,27 4,27" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`;
    case "square":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="22" height="22" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    case "heart":
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 27 C16 27 4 19 4 11 C4 7 7 4 10.5 4 C13 4 15 5.5 16 7.5 C17 5.5 19 4 21.5 4 C25 4 28 7 28 11 C28 19 16 27 16 27 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    case "car":
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M5 17 L8 10 H23 L27 17 V23 H5 Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/><circle cx="10" cy="24" r="3" fill="#0f172a"/><circle cx="22" cy="24" r="3" fill="#0f172a"/></svg>`;
  }
}

// ── Curated Pre-Primary Data Pools ───────────────────────────────────────────
const COUNT_ITEMS: Array<{ icon: PrePrimaryIconKey; name: string; color: string }> = [
  { icon: "apple", name: "Apples", color: "#ef4444" },
  { icon: "star", name: "Stars", color: "#facc15" },
  { icon: "ball", name: "Balls", color: "#38bdf8" },
  { icon: "mango", name: "Mangoes", color: "#f59e0b" },
  { icon: "flower", name: "Flowers", color: "#ec4899" },
  { icon: "leaf", name: "Leaves", color: "#22c55e" },
  { icon: "balloon", name: "Balloons", color: "#a855f7" },
  { icon: "kite", name: "Kites", color: "#fb923c" },
  { icon: "fish", name: "Fish", color: "#0ea5e9" },
  { icon: "cup", name: "Cups", color: "#f43f5e" },
];

const COLOR_MATCH_BANK: PrePrimaryColorPair[] = [
  { colorName: "RED", hindiName: "लाल", hex: "#ef4444", objectLabel: "Apple", icon: "apple" },
  { colorName: "YELLOW", hindiName: "पीला", hex: "#facc15", objectLabel: "Sun", icon: "sun" },
  { colorName: "GREEN", hindiName: "हरा", hex: "#22c55e", objectLabel: "Leaf", icon: "leaf" },
  { colorName: "BLUE", hindiName: "नीला", hex: "#3b82f6", objectLabel: "Fish", icon: "fish" },
  { colorName: "ORANGE", hindiName: "नारंगी", hex: "#f97316", objectLabel: "Mango", icon: "mango" },
  { colorName: "PINK", hindiName: "गुलाबी", hex: "#ec4899", objectLabel: "Flower", icon: "flower" },
];

const PHONICS_PICTURES: Array<{
  letter: string;
  word: string;
  icon: PrePrimaryIconKey;
  color: string;
  distractors: [string, string, string];
}> = [
  { letter: "A", word: "Apple", icon: "apple", color: "#ef4444", distractors: ["B", "M", "T"] },
  { letter: "B", word: "Ball", icon: "ball", color: "#3b82f6", distractors: ["D", "P", "S"] },
  { letter: "C", word: "Cup", icon: "cup", color: "#f43f5e", distractors: ["G", "K", "L"] },
  { letter: "F", word: "Fish", icon: "fish", color: "#0ea5e9", distractors: ["E", "H", "R"] },
  { letter: "H", word: "House", icon: "house", color: "#f59e0b", distractors: ["A", "N", "W"] },
  { letter: "K", word: "Kite", icon: "kite", color: "#f97316", distractors: ["R", "V", "Z"] },
  { letter: "L", word: "Leaf", icon: "leaf", color: "#22c55e", distractors: ["I", "J", "T"] },
  { letter: "M", word: "Mango", icon: "mango", color: "#facc15", distractors: ["N", "W", "B"] },
  { letter: "P", word: "Pencil", icon: "pencil", color: "#eab308", distractors: ["B", "D", "Q"] },
  { letter: "S", word: "Star", icon: "star", color: "#facc15", distractors: ["C", "G", "Z"] },
];

const HINDI_SWAR_PICS: Array<{
  swar: string;
  word: string;
  icon: PrePrimaryIconKey;
  color: string;
  distractors: [string, string, string];
}> = [
  { swar: "अ", word: "अनार", icon: "apple", color: "#ef4444", distractors: ["इ", "उ", "क"] },
  { swar: "आ", word: "आम", icon: "mango", color: "#f59e0b", distractors: ["अ", "ओ", "म"] },
  { swar: "फ", word: "फूल", icon: "flower", color: "#ec4899", distractors: ["प", "ब", "क"] },
  { swar: "प", word: "पतंग", icon: "kite", color: "#f97316", distractors: ["म", "न", "ज"] },
  { swar: "घ", word: "घर", icon: "house", color: "#fb923c", distractors: ["च", "ध", "त"] },
  { swar: "म", word: "मछली", icon: "fish", color: "#0ea5e9", distractors: ["भ", "र", "स"] },
];

const UKG_JOIN_WORDS: Array<{ parts: string[]; answer: string; icon: PrePrimaryIconKey; color: string }> = [
  { parts: ["C", "A", "T"], answer: "CAT", icon: "star", color: "#f59e0b" },
  { parts: ["S", "U", "N"], answer: "SUN", icon: "sun", color: "#facc15" },
  { parts: ["C", "U", "P"], answer: "CUP", icon: "cup", color: "#f43f5e" },
  { parts: ["C", "A", "R"], answer: "CAR", icon: "car", color: "#3b82f6" },
  { parts: ["B", "A", "L", "L"], answer: "BALL", icon: "ball", color: "#0ea5e9" },
  { parts: ["K", "I", "T", "E"], answer: "KITE", icon: "kite", color: "#f97316" },
  { parts: ["F", "I", "S", "H"], answer: "FISH", icon: "fish", color: "#38bdf8" },
  { parts: ["S", "T", "A", "R"], answer: "STAR", icon: "star", color: "#eab308" },
];

const HINDI_JOIN_WORDS: Array<{ parts: string[]; answer: string }> = [
  { parts: ["क", "म", "ल"], answer: "कमल" },
  { parts: ["घ", "र"], answer: "घर" },
  { parts: ["फ", "ल"], answer: "फल" },
  { parts: ["न", "ल"], answer: "नल" },
  { parts: ["ब", "स"], answer: "बस" },
  { parts: ["क", "ल", "म"], answer: "कलम" },
  { parts: ["म", "ग", "र"], answer: "मगर" },
  { parts: ["न", "म", "क"], answer: "नमक" },
];

// ── Generate Deterministic 50-Mark Visual Screening Set (PP-Set-01..20) ─────
export function generatePrePrimaryPaperSet(setNumberInput: number): PrePrimaryPaperSet {
  const setNumber = Math.max(1, Math.min(TOTAL_PRE_PRIMARY_SETS, Math.round(setNumberInput || 1)));
  const setId = formatPrePrimarySetId(setNumber);
  const rng = createRng(`lmps_preprimary_v1_${setId}`);

  const questions: PrePrimaryQuestion[] = [];
  let qNo = 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 1: NURSERY FOUNDATION (16 Marks — 4 Questions × 4 Marks)
  // ═══════════════════════════════════════════════════════════════════════════

  // Q1 (Nursery · 4M): Count Objects & Write Number in Box
  const cObj = COUNT_ITEMS[(setNumber * 3 + Math.floor(rng() * 5)) % COUNT_ITEMS.length];
  const cVal = 3 + ((setNumber + Math.floor(rng() * 4)) % 6); // 3 to 8
  questions.push({
    id: `${setId}_q1`,
    qNo: qNo++,
    levelBand: "NURSERY",
    levelLabel: "Level 1 · Nursery",
    subject: "Number & Math",
    type: "count_write",
    marks: 4,
    instruction: `Count the ${cObj.name} and write the number in the box:`,
    instructionHi: "चित्र गिनें और सही संख्या बॉक्स में लिखें:",
    countIcon: cObj.icon,
    countValue: cVal,
    countColorHex: cObj.color,
    answerSummary: `${cVal}`,
  });

  // Q2 (Nursery · 4M): Match the Color with the Correct Picture
  const shuffledColorPool = shuffleWithRng(COLOR_MATCH_BANK, rng).slice(0, 4);
  const rightOrder = shuffleWithRng([0, 1, 2, 3], rng);
  questions.push({
    id: `${setId}_q2`,
    qNo: qNo++,
    levelBand: "NURSERY",
    levelLabel: "Level 1 · Nursery",
    subject: "Colours & Shapes",
    type: "color_match",
    marks: 4,
    instruction: "Match each Colour Name / Dot to its matching Picture (Draw lines):",
    instructionHi: "रंग के नाम को उसके सही चित्र से मिलाएं:",
    matchColors: shuffledColorPool,
    matchRightOrder: rightOrder,
    answerSummary: shuffledColorPool.map((c) => `${c.colorName} → ${c.objectLabel}`).join(", "),
  });

  // Q3 (Nursery · 4M): Circle the Correct Shape / Colour Target
  const shapeChoices: Array<{ label: string; icon: PrePrimaryIconKey; color: string }> = [
    { label: "Circle", icon: "circle", color: "#38bdf8" },
    { label: "Triangle", icon: "triangle", color: "#f97316" },
    { label: "Square", icon: "square", color: "#22c55e" },
    { label: "Star", icon: "star", color: "#facc15" },
  ];
  const targetShapeIdx = setNumber % shapeChoices.length;
  const targetShape = shapeChoices[targetShapeIdx];
  const shuffledShapes = shuffleWithRng(shapeChoices, rng);
  const correctShapePos = shuffledShapes.findIndex((s) => s.label === targetShape.label);
  questions.push({
    id: `${setId}_q3`,
    qNo: qNo++,
    levelBand: "NURSERY",
    levelLabel: "Level 1 · Nursery",
    subject: "Colours & Shapes",
    type: "circle_correct",
    marks: 4,
    instruction: `Circle the ${targetShape.label.toUpperCase()} shape:`,
    instructionHi: `${targetShape.label} आकृति पर गोला (⭕) लगाएं:`,
    circleChoices: shuffledShapes.map((s) => ({ label: s.label, icon: s.icon, colorHex: s.color })),
    circleCorrectIndex: correctShapePos,
    answerSummary: `Circle ${targetShape.label}`,
  });

  // Q4 (Nursery · 4M): Colour exactly N hollow shapes
  const fillItem = (["apple", "star", "balloon", "circle", "heart"] as PrePrimaryIconKey[])[
    setNumber % 5
  ];
  const fillColorChoice = COLOR_MATCH_BANK[setNumber % 4];
  const fillTotal = 6;
  const fillNeed = 2 + (setNumber % 3); // 2, 3, or 4
  questions.push({
    id: `${setId}_q4`,
    qNo: qNo++,
    levelBand: "NURSERY",
    levelLabel: "Level 1 · Nursery",
    subject: "Colours & Shapes",
    type: "color_fill",
    marks: 4,
    instruction: `Colour any ${fillNeed} shapes with ${fillColorChoice.colorName} (${fillColorChoice.hindiName}):`,
    instructionHi: `किन्हीं ${fillNeed} चित्रों में ${fillColorChoice.hindiName} रंग भरें:`,
    fillIcon: fillItem,
    fillTotalShapes: fillTotal,
    fillTargetCount: fillNeed,
    fillTargetColorName: fillColorChoice.colorName,
    fillTargetColorHex: fillColorChoice.hex,
    answerSummary: `Any ${fillNeed} out of ${fillTotal} coloured ${fillColorChoice.colorName}`,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 2: LKG / KG-1 READINESS (16 Marks — 4 Questions × 4 Marks)
  // ═══════════════════════════════════════════════════════════════════════════

  // Q5 (LKG · 4M): Circle the First Letter of the Picture
  const phPic = PHONICS_PICTURES[(setNumber - 1 + Math.floor(rng() * 3)) % PHONICS_PICTURES.length];
  const letterOpts = shuffleWithRng([phPic.letter, ...phPic.distractors], rng);
  questions.push({
    id: `${setId}_q5`,
    qNo: qNo++,
    levelBand: "LKG",
    levelLabel: "Level 2 · LKG (KG-1)",
    subject: "English & Phonics",
    type: "circle_correct",
    marks: 4,
    instruction: `Look at the picture (${phPic.word}) and Circle its first letter:`,
    instructionHi: "चित्र देखकर पहले अक्षर पर गोला (⭕) लगाएं:",
    circlePictureHint: { icon: phPic.icon, colorHex: phPic.color, label: phPic.word },
    circleChoices: letterOpts.map((l) => ({ label: l })),
    circleCorrectIndex: letterOpts.indexOf(phPic.letter),
    answerSummary: `${phPic.letter} (for ${phPic.word})`,
  });

  // Q6 (LKG · 4M): Fill Missing Alphabets / Numbers in Boxes
  const isAlphaMissing = setNumber % 2 === 1;
  if (isAlphaMissing) {
    const startCharCode = 65 + (setNumber % 14); // A..N
    const seq = Array.from({ length: 5 }, (_, k) => String.fromCharCode(startCharCode + k));
    const missingIdx1 = 1;
    const missingIdx2 = 3;
    questions.push({
      id: `${setId}_q6`,
      qNo: qNo++,
      levelBand: "LKG",
      levelLabel: "Level 2 · LKG (KG-1)",
      subject: "English & Phonics",
      type: "missing_box",
      marks: 4,
      instruction: "Write the missing Capital Letters in the empty boxes:",
      instructionHi: "खाली बॉक्स में छूटे हुए अक्षर लिखें:",
      missingSequence: seq.map((ch, idx) => (idx === missingIdx1 || idx === missingIdx2 ? null : ch)),
      missingAnswers: [seq[missingIdx1], seq[missingIdx2]],
      answerSummary: `${seq[missingIdx1]}, ${seq[missingIdx2]} (${seq.join("-")})`,
    });
  } else {
    const numBase = 11 + (setNumber % 7) * 5;
    const seq = Array.from({ length: 5 }, (_, k) => String(numBase + k));
    questions.push({
      id: `${setId}_q6`,
      qNo: qNo++,
      levelBand: "LKG",
      levelLabel: "Level 2 · LKG (KG-1)",
      subject: "Number & Math",
      type: "missing_box",
      marks: 4,
      instruction: "Write the missing Numbers in the empty boxes:",
      instructionHi: "खाली बॉक्स में छूटी हुई संख्या लिखें:",
      missingSequence: seq.map((n, idx) => (idx === 1 || idx === 3 ? null : n)),
      missingAnswers: [seq[1], seq[3]],
      answerSummary: `${seq[1]}, ${seq[3]} (${seq.join(", ")})`,
    });
  }

  // Q7 (LKG · 4M): Visual Comparison Tick (BIGGER / MORE)
  const cmpItem = COUNT_ITEMS[(setNumber + 2) % COUNT_ITEMS.length];
  const askMore = setNumber % 2 === 0;
  const bigOnLeft = setNumber % 3 !== 0;
  if (askMore) {
    const moreCnt = 5 + (setNumber % 3);
    const lessCnt = 2;
    questions.push({
      id: `${setId}_q7`,
      qNo: qNo++,
      levelBand: "LKG",
      levelLabel: "Level 2 · LKG (KG-1)",
      subject: "EVS & Logic",
      type: "compare_tick",
      marks: 4,
      instruction: `Tick (✓) the box with MORE ${cmpItem.name}:`,
      instructionHi: `जिस बॉक्स में ज़्यादा ${cmpItem.name} हैं उस पर (✓) लगाएं:`,
      compareLeft: {
        icon: cmpItem.icon,
        size: "small",
        count: bigOnLeft ? moreCnt : lessCnt,
        colorHex: cmpItem.color,
      },
      compareRight: {
        icon: cmpItem.icon,
        size: "small",
        count: bigOnLeft ? lessCnt : moreCnt,
        colorHex: cmpItem.color,
      },
      compareAnswerSide: bigOnLeft ? "LEFT" : "RIGHT",
      answerSummary: `${bigOnLeft ? "Left Box" : "Right Box"} (${moreCnt} > ${lessCnt})`,
    });
  } else {
    questions.push({
      id: `${setId}_q7`,
      qNo: qNo++,
      levelBand: "LKG",
      levelLabel: "Level 2 · LKG (KG-1)",
      subject: "EVS & Logic",
      type: "compare_tick",
      marks: 4,
      instruction: "Tick (✓) the BIGGER object box:",
      instructionHi: "बड़े चित्र वाले बॉक्स पर (✓) निशान लगाएं:",
      compareLeft: {
        icon: cmpItem.icon,
        size: bigOnLeft ? "big" : "small",
        count: 1,
        colorHex: cmpItem.color,
        label: bigOnLeft ? "Big" : "Small",
      },
      compareRight: {
        icon: cmpItem.icon,
        size: bigOnLeft ? "small" : "big",
        count: 1,
        colorHex: cmpItem.color,
        label: bigOnLeft ? "Small" : "Big",
      },
      compareAnswerSide: bigOnLeft ? "LEFT" : "RIGHT",
      answerSummary: `${bigOnLeft ? "Left Box" : "Right Box"} (Bigger object)`,
    });
  }

  // Q8 (LKG · 4M): Circle the Correct Hindi Akshar for Picture
  const hiPic = HINDI_SWAR_PICS[(setNumber + Math.floor(rng() * 2)) % HINDI_SWAR_PICS.length];
  const hiOpts = shuffleWithRng([hiPic.swar, ...hiPic.distractors], rng);
  questions.push({
    id: `${setId}_q8`,
    qNo: qNo++,
    levelBand: "LKG",
    levelLabel: "Level 2 · LKG (KG-1)",
    subject: "Hindi Akshar",
    type: "circle_correct",
    marks: 4,
    instruction: `चित्र (${hiPic.word}) के पहले हिंदी अक्षर पर गोला (⭕) लगाएं:`,
    circlePictureHint: { icon: hiPic.icon, colorHex: hiPic.color, label: hiPic.word },
    circleChoices: hiOpts.map((h) => ({ label: h })),
    circleCorrectIndex: hiOpts.indexOf(hiPic.swar),
    answerSummary: `${hiPic.swar} (${hiPic.word})`,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVEL 3: UKG / KG-2 READINESS (18 Marks — Box Addition, Circle Max/Vowel, Word Join)
  // ═══════════════════════════════════════════════════════════════════════════

  // Q9 (UKG · 5M): Box Visual Addition ([🍎🍎🍎] + [🍎🍎] = [   ])
  const addObj = COUNT_ITEMS[(setNumber + 4) % COUNT_ITEMS.length];
  const aL = 2 + (setNumber % 4); // 2..5
  const aR = 1 + ((setNumber + 2) % 4); // 1..4
  questions.push({
    id: `${setId}_q9`,
    qNo: qNo++,
    levelBand: "UKG",
    levelLabel: "Level 3 · UKG (KG-2)",
    subject: "Number & Math",
    type: "box_addition",
    marks: 5,
    instruction: "Count the pictures in both boxes, ADD (+) them, and write total in the last box:",
    instructionHi: "दोनों बॉक्स के चित्र जोड़ें (+) और कुल संख्या आखिरी बॉक्स में लिखें:",
    addLeft: aL,
    addRight: aR,
    addOp: "+",
    addIcon: addObj.icon,
    addColorHex: addObj.color,
    answerSummary: `${aL} + ${aR} = ${aL + aR}`,
  });

  // Q10 (UKG · 4M): Circle the BIGGEST Number / VOWEL Letter
  const askBiggest = setNumber % 2 === 1;
  if (askBiggest) {
    const base = 12 + (setNumber % 6) * 7;
    const nums = [base, base + 9, base - 4, base + 3];
    const maxVal = Math.max(...nums);
    const shuffledNums = shuffleWithRng(nums, rng);
    questions.push({
      id: `${setId}_q10`,
      qNo: qNo++,
      levelBand: "UKG",
      levelLabel: "Level 3 · UKG (KG-2)",
      subject: "Number & Math",
      type: "circle_correct",
      marks: 4,
      instruction: "Circle the BIGGEST number:",
      instructionHi: "सबसे बड़ी संख्या पर गोला (⭕) लगाएं:",
      circleChoices: shuffledNums.map((n) => ({ label: String(n) })),
      circleCorrectIndex: shuffledNums.indexOf(maxVal),
      answerSummary: `${maxVal}`,
    });
  } else {
    const vowels = ["A", "E", "I", "O", "U"];
    const cons = ["B", "K", "M", "P", "R", "T", "D", "G"];
    const pickedV = vowels[setNumber % vowels.length];
    const pickedCons = shuffleWithRng(cons, rng).slice(0, 3);
    const choices = shuffleWithRng([pickedV, ...pickedCons], rng);
    questions.push({
      id: `${setId}_q10`,
      qNo: qNo++,
      levelBand: "UKG",
      levelLabel: "Level 3 · UKG (KG-2)",
      subject: "English & Phonics",
      type: "circle_correct",
      marks: 4,
      instruction: "Circle the VOWEL letter (a, e, i, o, u):",
      instructionHi: "इनमें से Vowel (स्वर) अक्षर पर गोला लगाएं:",
      circleChoices: choices.map((c) => ({ label: c })),
      circleCorrectIndex: choices.indexOf(pickedV),
      answerSummary: `${pickedV} (Vowel)`,
    });
  }

  // Q11 (UKG · 4M): Odd One Out Circle (Picture Logic)
  const useShapesGroup = setNumber % 2 === 1;
  const sameGroup: Array<{ label: string; icon: PrePrimaryIconKey; color: string }> = useShapesGroup
    ? [
        { label: "Circle", icon: "circle", color: "#38bdf8" },
        { label: "Triangle", icon: "triangle", color: "#f97316" },
        { label: "Square", icon: "square", color: "#22c55e" },
      ]
    : [
        { label: "Apple", icon: "apple", color: "#ef4444" },
        { label: "Mango", icon: "mango", color: "#f59e0b" },
        { label: "Flower", icon: "flower", color: "#ec4899" },
      ];
  const oddObj: { label: string; icon: PrePrimaryIconKey; color: string } = useShapesGroup
    ? { label: "Apple", icon: "apple", color: "#ef4444" }
    : setNumber % 4 === 0
    ? { label: "Car", icon: "car", color: "#3b82f6" }
    : { label: "Pencil", icon: "pencil", color: "#eab308" };
  const oddOptions = shuffleWithRng([...sameGroup, oddObj], rng);
  questions.push({
    id: `${setId}_q11`,
    qNo: qNo++,
    levelBand: "UKG",
    levelLabel: "Level 3 · UKG (KG-2)",
    subject: "EVS & Logic",
    type: "circle_correct",
    marks: 4,
    instruction: "Circle the ODD ONE OUT (अलग चित्र पर गोला लगाएं):",
    circleChoices: oddOptions.map((o) => ({ label: o.label, icon: o.icon, colorHex: o.color })),
    circleCorrectIndex: oddOptions.findIndex((o) => o.label === oddObj.label),
    answerSummary: `${oddObj.label} (Odd one out)`,
  });

  // Q12 (UKG · 5M): Join Letters to Make Word + Hindi Shabd (Split readiness check)
  const isHindiWord = setNumber % 3 === 0;
  if (isHindiWord) {
    const hw = HINDI_JOIN_WORDS[setNumber % HINDI_JOIN_WORDS.length];
    questions.push({
      id: `${setId}_q12`,
      qNo: qNo++,
      levelBand: "UKG",
      levelLabel: "Level 3 · UKG (KG-2)",
      subject: "Hindi Akshar",
      type: "word_join",
      marks: 5,
      instruction: "अक्षरों को जोड़कर शब्द बॉक्स में लिखें (Join & Write Word):",
      wordParts: hw.parts,
      answerSummary: `${hw.parts.join(" + ")} = ${hw.answer}`,
    });
  } else {
    const ew = UKG_JOIN_WORDS[setNumber % UKG_JOIN_WORDS.length];
    questions.push({
      id: `${setId}_q12`,
      qNo: qNo++,
      levelBand: "UKG",
      levelLabel: "Level 3 · UKG (KG-2)",
      subject: "English & Phonics",
      type: "word_join",
      marks: 5,
      instruction: "Join the letters and write the full word in the box:",
      instructionHi: "अक्षरों को जोड़कर पूरा शब्द लिखें:",
      wordParts: ew.parts,
      wordPromptIcon: ew.icon,
      wordPromptColor: ew.color,
      answerSummary: `${ew.parts.join(" + ")} = ${ew.answer}`,
    });
  }

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const levelMarks = {
    NURSERY: questions.filter((q) => q.levelBand === "NURSERY").reduce((s, q) => s + q.marks, 0),
    LKG: questions.filter((q) => q.levelBand === "LKG").reduce((s, q) => s + q.marks, 0),
    UKG: questions.filter((q) => q.levelBand === "UKG").reduce((s, q) => s + q.marks, 0),
  };

  return {
    setNumber,
    setId,
    totalMarks,
    durationMinutes: 30,
    levelMarks,
    questions,
    oralChecklist: [
      { item: "Pencil Grip & Sitting Comfort", note: "Observe if child holds crayon/pencil naturally" },
      { item: "Name & Parents Name (Oral)", note: "Can state own name and respond politely" },
      { item: "Rhyme / Counting Oral (1–20)", note: "Recite any 1 short English/Hindi poem or counting" },
      { item: "Body Parts / Fruits Recognition", note: "Eyes, Nose, Hands + Apple/Mango identification" },
    ],
  };
}
