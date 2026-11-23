// Utility helpers for UPPERCASE normalization and Parent Occupation autocomplete across admission & student forms

export const toUpperFormText = (val: string): string => {
  if (!val) return "";
  return val.toUpperCase();
};

export const COMMON_OCCUPATIONS: string[] = [
  "FARMER",
  "TEACHER",
  "BUSINESS",
  "HOMEMAKER",
  "HOUSEWIFE",
  "GOVT SERVICE",
  "PRIVATE JOB",
  "DOCTOR",
  "ENGINEER",
  "ADVOCATE",
  "SHOPKEEPER",
  "DRIVER",
  "CONTRACTOR",
  "ARMY / DEFENCE",
  "POLICE",
  "BANKER",
  "ACCOUNTANT",
  "CARPENTER",
  "TAILOR",
  "ELECTRICIAN",
  "MECHANIC",
  "LABOUR",
  "DAILY WAGE",
  "RAILWAY EMPLOYEE",
  "NURSE",
  "PHARMACIST",
  "PROFESSOR",
  "LECTURER",
  "PRINCIPAL",
  "PRIEST / PUJARI",
  "SELF EMPLOYED",
  "AGRICULTURE",
  "DAIRY FARMING",
  "REAL ESTATE",
  "JEWELLER",
  "TEXTILE WORKER",
  "IT PROFESSIONAL",
  "SOFTWARE ENGINEER",
  "SALES EXECUTIVE",
  "SECURITY GUARD",
  "POSTAL SERVICE",
  "CLERICAL STAFF",
  "JOURNALIST",
  "PAINTER",
  "PLUMBER",
  "MASON",
  "FACTORY WORKER",
  "TRANSPORT OPERATOR",
  "MEDICAL PRACTITIONER",
  "ANM / ASHA WORKER",
  "ANGANWADI WORKER",
  "BEAUTICIAN",
  "ARTIST / DESIGNER",
  "CONSULTANT",
  "PENSIONER / RETIRED",
];

const occStorageKey = (schoolId?: string) =>
  `school_custom_occupations_${schoolId || "global"}`;

export const getSavedCustomOccupations = (schoolId?: string): string[] => {
  try {
    const raw = localStorage.getItem(occStorageKey(schoolId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x || "").trim().toUpperCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

export const rememberOccupation = (value?: string, schoolId?: string): void => {
  const clean = (value || "").trim().toUpperCase();
  if (clean.length < 2) return;
  if (COMMON_OCCUPATIONS.includes(clean)) return;
  try {
    const existing = getSavedCustomOccupations(schoolId);
    if (existing.includes(clean)) return;
    const next = [clean, ...existing].slice(0, 80);
    localStorage.setItem(occStorageKey(schoolId), JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
};

export const filterOccupationSuggestions = (
  query: string,
  schoolId?: string,
  maxResults = 8
): string[] => {
  const q = (query || "").trim().toUpperCase();
  if (q.length < 2) return [];

  const pool = Array.from(
    new Set([...getSavedCustomOccupations(schoolId), ...COMMON_OCCUPATIONS])
  );

  const prefixMatches: string[] = [];
  const wordMatches: string[] = [];
  const containsMatches: string[] = [];

  for (const item of pool) {
    if (item === q) continue;
    if (item.startsWith(q)) {
      prefixMatches.push(item);
    } else if (item.split(/[\s/]+/).some((part) => part.startsWith(q))) {
      wordMatches.push(item);
    } else if (item.includes(q)) {
      containsMatches.push(item);
    }
  }

  return [...prefixMatches, ...wordMatches, ...containsMatches].slice(0, maxResults);
};
