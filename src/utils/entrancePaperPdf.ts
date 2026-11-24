import jsPDF from "jspdf";
import { renderHtmlToCanvasSafe } from "./safePdfCapture";
import { mountAndPrintA4Sync } from "./a4PrintHelper";
import { FORMAT_DISPLAY_LABEL } from "./entranceTestEngine";
import {
  renderPrePrimaryIconSvg,
  type PrePrimaryPaperSet,
  type PrePrimaryQuestion,
} from "../data/entrance/prePrimaryScreening20Sets";
import {
  formatEntranceClassLabel,
  type CbseBoardRulesMode,
  type EntranceClassNumber,
  type EntranceTestPaperSet,
  type EntranceTestQuestion,
  type PaperPrintOrientation,
  type School,
} from "../school-types";

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TRUST_NAME_PATTERN = /\b(trust|society|foundation|welfare|samiti|charitable|ngo|parishad)\b/i;

export interface ResolvedPaperMasthead {
  logoUrl: string;
  schoolName: string;
  tagline: string;
  address: string;
  contactLine: string;
}

export interface PaperMastheadOverrides {
  schoolNameOverride?: string;
  schoolTaglineOverride?: string;
  schoolAddressOverride?: string;
  schoolContactOverride?: string;
  schoolSubHeaderOverride?: string;
}

function normalizeAddressDisplay(raw: string): string {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  // Format known all-caps address cleanly with punctuation & state
  if (/^dharaka\s+market[\s,]+affour[\s,]+nagra[\s,]+saran$/i.test(cleaned)) {
    return "Dharaka Market, Affour, Nagra, Saran (Bihar)";
  }
  return cleaned;
}

function normalizePhoneDisplay(raw: string): string {
  return String(raw || "")
    .split(/[,;/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
}

const NON_WEBSITE_URL_PATTERN = /(mediafire\.com|\.apk\b|drive\.google\.com|dropbox\.com|mega\.nz|localhost|127\.0\.0\.1)/i;

function normalizeWebsiteDisplay(raw?: string, isLifeMaker = false): string {
  const val = String(raw || "").trim();
  if (!val || NON_WEBSITE_URL_PATTERN.test(val)) {
    return isLifeMaker ? "lmps27.vercel.app" : "";
  }
  return val.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function resolveExamPaperMasthead(
  school?: Partial<School> | null,
  overrides?: PaperMastheadOverrides
): ResolvedPaperMasthead {
  const rawSchoolName = String(school?.name || "").trim();
  const isLifeMaker = !rawSchoolName || /life\s*maker/i.test(rawSchoolName);

  const schoolName = (
    overrides?.schoolNameOverride?.trim() ||
    rawSchoolName ||
    "LIFE MAKER PUBLIC SCHOOL"
  ).toUpperCase();

  // Strictly exclude Trust / Society / Welfare names from Question Paper header
  const rawAff = String(school?.affiliation || "").trim();
  const safeAffiliation = rawAff && !TRUST_NAME_PATTERN.test(rawAff) ? rawAff : "";
  const rawTagline = String(school?.tagline || "").trim();
  const safeSchoolTagline = rawTagline && !TRUST_NAME_PATTERN.test(rawTagline) ? rawTagline : "";

  const defaultTagline =
    safeAffiliation || safeSchoolTagline || "(CBSE Pattern English Medium School)";
  const tagline =
    overrides?.schoolTaglineOverride !== undefined
      ? overrides.schoolTaglineOverride.trim()
      : defaultTagline;

  const fallbackAddress = isLifeMaker ? "Dharaka Market, Affour, Nagra, Saran (Bihar)" : "";
  const rawAddress =
    overrides?.schoolAddressOverride !== undefined
      ? overrides.schoolAddressOverride.trim()
      : normalizeAddressDisplay(school?.address || fallbackAddress);

  const fallbackPhone = isLifeMaker ? "9525400122, 9835763641" : "";
  const phoneFormatted = normalizePhoneDisplay(school?.phone || school?.mobile || fallbackPhone);
  // NEVER use school.erpAppUrl (which stores MediaFire APK download link) as the school website!
  const rawWebsite = String((school as any)?.website || (school as any)?.websiteUrl || "").trim();
  const webFormatted = normalizeWebsiteDisplay(rawWebsite, isLifeMaker);
  const defaultContactLine = [
    phoneFormatted ? `Ph: ${phoneFormatted}` : "",
    webFormatted ? `Web: ${webFormatted}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  const contactLine =
    overrides?.schoolContactOverride !== undefined
      ? overrides.schoolContactOverride.trim()
      : defaultContactLine;

  return {
    logoUrl: String(school?.logoUrl || "").trim(),
    schoolName,
    tagline,
    address: rawAddress,
    contactLine,
  };
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const SHARED_PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    background: #ffffff;
    color: #0f172a;
    width: 794px;
  }
  .exam-sheet {
    width: 794px;
    min-height: 1120px;
    padding: 14px 18px 12px 18px;
    background: #ffffff;
    color: #0f172a;
    position: relative;
  }
  .page-header {
    border: 1.5px solid #0f172a;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 8px;
    background: #ffffff;
  }
  .std-masthead-tbl {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .std-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
    display: block;
    filter: grayscale(100%) contrast(1.25) brightness(0.96);
  }
  .school-title {
    font-size: 16.5px;
    font-weight: 900;
    letter-spacing: 0.45px;
    color: #0f172a;
    text-align: center;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .school-tagline {
    font-size: 9.5px;
    font-weight: 700;
    font-style: italic;
    color: #1e293b;
    text-align: center;
    margin-top: 1.5px;
    line-height: 1.25;
  }
  .school-sub {
    font-size: 8.8px;
    font-weight: 600;
    color: #334155;
    text-align: center;
    margin-top: 1.5px;
    line-height: 1.28;
  }
  .school-contact {
    font-size: 8.5px;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
    margin-top: 1.5px;
    line-height: 1.28;
  }
  .meta-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    padding-top: 5px;
    border-top: 1px dashed #94a3b8;
    font-size: 9.5px;
    font-weight: 700;
    color: #0f172a;
  }
  .student-strip {
    display: flex;
    gap: 12px;
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid #cbd5e1;
    font-size: 9px;
    color: #1e293b;
  }
  .student-field { flex: 1; border-bottom: 1px dotted #94a3b8; padding-bottom: 1px; }
  .cont-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1.2px solid #0f172a;
    border-radius: 5px;
    background: #f8fafc;
    padding: 5px 10px;
    margin-bottom: 8px;
    font-size: 9.5px;
    font-weight: 700;
    color: #0f172a;
  }
  .cont-school {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.25px;
  }
  .columns-wrap {
    display: table;
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }
  .exam-col {
    display: table-cell;
    width: 50%;
    vertical-align: top;
  }
  .exam-col-left {
    padding-right: 10px;
    border-right: 1px solid #cbd5e1;
  }
  .exam-col-right {
    padding-left: 10px;
  }
  .side-label {
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475569;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 2px;
    margin-bottom: 4px;
  }
  .q-card {
    border-bottom: 1px dashed #e2e8f0;
    padding: 3px 2px 5px 2px;
    margin-bottom: 4px;
    background: #ffffff;
  }
  .q-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
    font-size: 8px;
    font-weight: 700;
    color: #475569;
  }
  .q-num {
    font-size: 9.5px;
    font-weight: 800;
    color: #0f172a;
  }
  .q-tag {
    background: #f1f5f9;
    color: #334155;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #cbd5e1;
    font-size: 7.5px;
  }
  .q-passage {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 8.5px;
    line-height: 1.3;
    color: #334155;
    margin-bottom: 3px;
  }
  .q-text {
    font-size: 9.5px;
    font-weight: 700;
    line-height: 1.3;
    color: #0f172a;
    margin-bottom: 3px;
  }
  .opt-grid {
    width: 100%;
    font-size: 0;
  }
  .opt-grid .opt-item {
    display: inline-block;
    vertical-align: top;
    width: 48.8%;
    margin-right: 2.2%;
    margin-bottom: 2px;
  }
  .opt-grid .opt-item:nth-child(2n) {
    margin-right: 0;
  }
  .opt-grid-single {
    width: 100%;
  }
  .opt-grid-single .opt-item {
    display: block;
    width: 100%;
    margin-bottom: 2px;
  }
  .opt-item {
    font-size: 8.6px;
    line-height: 1.25;
    color: #1e293b;
    padding: 2px 4px;
    border-radius: 3px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .opt-letter {
    font-weight: 800;
    color: #0f172a;
    margin-right: 3px;
  }
  .key-banner {
    background: #0f172a;
    color: #ffffff;
    border-radius: 6px;
    padding: 9px 14px;
    margin-bottom: 9px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .key-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }
  .key-table th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 800;
    text-align: left;
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
  }
  .key-table td {
    padding: 3.5px 6px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    line-height: 1.28;
    color: #1e293b;
  }
  .key-badge {
    display: inline-block;
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
    border-radius: 3px;
    padding: 0.5px 5px;
    font-weight: 800;
    font-size: 9px;
  }
  .footer-note {
    margin-top: 8px;
    padding-top: 5px;
    border-top: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.5px;
    font-weight: 600;
    color: #475569;
  }
`;

function renderQuestionHtml(q: EntranceTestQuestion, index: number): string {
  const maxOptLen = Math.max(...q.options.map((o) => String(o || "").length));
  const useSingleColOpts = maxOptLen > 30;
  return `
    <div class="q-card">
      <div class="q-top">
        <span class="q-num">Q.${index + 1} <span style="font-weight:600;font-size:8px;color:#475569;">(${escapeHtml(q.subject)})</span></span>
        <span class="q-tag">${escapeHtml(FORMAT_DISPLAY_LABEL[q.format] || q.format)} · 1M</span>
      </div>
      ${
        q.passage
          ? `<div class="q-passage"><strong>Passage:</strong> ${escapeHtml(q.passage)}</div>`
          : ""
      }
      <div class="q-text">${escapeHtml(q.question)}</div>
      <div class="${useSingleColOpts ? "opt-grid-single" : "opt-grid"}">
        ${q.options
          .map(
            (opt, oi) =>
              `<div class="opt-item"><span class="opt-letter">(${OPTION_LETTERS[oi]})</span>${escapeHtml(
                opt
              )}</div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function estimateQuestionWeight(q: EntranceTestQuestion): number {
  const maxOptLen = Math.max(...q.options.map((o) => String(o || "").length));
  let w = 1.0;
  if (q.passage) w += Math.ceil(q.passage.length / 80) * 0.45 + 0.3;
  if (q.question.length > 75) w += 0.35;
  if (q.question.length > 140) w += 0.35;
  if (maxOptLen > 30) w += 0.45;
  return w;
}

function paginateQuestionsForA4(questions: EntranceTestQuestion[]): EntranceTestQuestion[][] {
  // Page 1 (with full school masthead): ~20 to 24 MCQs across Side 1 & Side 2
  // Page 2+ (compact school header): ~25 to 30 MCQs across Side 1 & Side 2
  const pages: EntranceTestQuestion[][] = [];
  let current: EntranceTestQuestion[] = [];
  let weight = 0;

  questions.forEach((q, idx) => {
    const isFirstPage = pages.length === 0;
    const maxWeight = isFirstPage ? 24.5 : 29.5;
    const maxCount = isFirstPage ? 24 : 30;
    const itemWeight = estimateQuestionWeight(q);

    if (
      current.length > 0 &&
      (current.length >= maxCount || weight + itemWeight > maxWeight)
    ) {
      pages.push(current);
      current = [];
      weight = 0;
    }
    current.push(q);
    weight += itemWeight;
    if (idx === questions.length - 1 && current.length > 0) {
      pages.push(current);
    }
  });

  return pages;
}

function chunkAnswerRows<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export interface StandardEntrancePaperExportParams {
  school?: Partial<School> | null;
  paper: EntranceTestPaperSet;
  mode: "full" | "questions_only";
  studentName?: string;
  scoreSummary?: {
    score: number;
    total: number;
    percentage: number;
    badge: string;
    headline: string;
    isDirectEligible: boolean;
  };
}

function buildEntrancePaperPagesHtml(params: StandardEntrancePaperExportParams): {
  pagesHtml: string[];
  docTitle: string;
} {
  const { school, paper, mode, studentName, scoreSummary } = params;
  const masthead = resolveExamPaperMasthead(school);
  const schoolName = masthead.schoolName;
  const stdLogoHtml = masthead.logoUrl
    ? `<img src="${escapeHtml(masthead.logoUrl)}" alt="" class="std-logo" onerror="this.style.display='none'" />`
    : "";

  const questionPages = paginateQuestionsForA4(paper.questions);
  const totalPart1Pages = questionPages.length;
  const pagesHtml: string[] = [];

  let runningIndex = 0;
  for (let pIdx = 0; pIdx < questionPages.length; pIdx++) {
    const chunk = questionPages[pIdx];
    const startNumber = runningIndex + 1;
    const endNumber = runningIndex + chunk.length;
    const leftCount = Math.ceil(chunk.length / 2);
    const leftItems = chunk.slice(0, leftCount);
    const rightItems = chunk.slice(leftCount);

    const scoreBannerHtml = scoreSummary
      ? `
          <div style="margin-top:6px;padding:5px 8px;border-radius:4px;border:1px solid ${
            scoreSummary.isDirectEligible ? "#16a34a" : "#d97706"
          };background:${
            scoreSummary.isDirectEligible ? "#f0fdf4" : "#fffbeb"
          };display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:8.5px;">
            <div>
              <strong style="color:${
                scoreSummary.isDirectEligible ? "#166534" : "#92400e"
              };">${escapeHtml(scoreSummary.badge)}</strong>
              <span style="color:#1e293b;margin-left:6px;">${escapeHtml(scoreSummary.headline)}</span>
            </div>
            <div style="font-weight:800;color:#0f172a;white-space:nowrap;">
              Score: ${scoreSummary.score}/${scoreSummary.total} (${scoreSummary.percentage}%)
            </div>
          </div>
        `
      : "";

    const headerHtml =
      pIdx === 0
        ? `
        <div class="page-header">
          <table class="std-masthead-tbl">
            <tr>
              <td style="width:54px;vertical-align:middle;text-align:left;">${stdLogoHtml}</td>
              <td style="vertical-align:middle;text-align:center;">
                <div class="school-title">${escapeHtml(masthead.schoolName)}</div>
                ${masthead.tagline ? `<div class="school-tagline">${escapeHtml(masthead.tagline)}</div>` : ""}
                ${masthead.address ? `<div class="school-sub">${escapeHtml(masthead.address)}</div>` : ""}
                ${masthead.contactLine ? `<div class="school-contact">${escapeHtml(masthead.contactLine)}</div>` : ""}
              </td>
              <td style="width:54px;vertical-align:middle;text-align:right;"></td>
            </tr>
          </table>
          <div class="meta-bar">
            <span>ENTRANCE &amp; SCHOLARSHIP EXAM · ${escapeHtml(paper.classLabel.toUpperCase())}</span>
            <span>Code: ${escapeHtml(paper.setId)} · Page 1/${totalPart1Pages}</span>
            <span>Time: ${paper.durationMinutes} Min · Qs: ${paper.totalQuestions} · Marks: ${paper.maxMarks}</span>
          </div>
          <div class="student-strip">
            <div class="student-field"><strong>Student Name:</strong> ${escapeHtml(studentName || "")}</div>
            <div class="student-field"><strong>Mobile / Roll No:</strong> </div>
            <div class="student-field"><strong>Date:</strong> </div>
          </div>
          ${scoreBannerHtml}
        </div>
      `
        : `
        <div class="cont-bar">
          <span class="cont-school">${escapeHtml(schoolName)}</span>
          <span>${escapeHtml(paper.classLabel)} Entrance Test · ${escapeHtml(paper.setId)} (Q.${startNumber}–Q.${endNumber})</span>
          <span>Page ${pIdx + 1} of ${totalPart1Pages}</span>
        </div>
      `;

    const leftHtml = leftItems
      .map((q) => {
        const html = renderQuestionHtml(q, runningIndex);
        runningIndex += 1;
        return html;
      })
      .join("");

    const rightHtml = rightItems
      .map((q) => {
        const html = renderQuestionHtml(q, runningIndex);
        runningIndex += 1;
        return html;
      })
      .join("");

    pagesHtml.push(`
      <div class="exam-sheet">
        ${headerHtml}
        <div class="columns-wrap">
          <div class="exam-col exam-col-left">
            <div class="side-label">Side 1 · Q.${startNumber} – Q.${startNumber + leftItems.length - 1}</div>
            ${leftHtml}
          </div>
          <div class="exam-col exam-col-right">
            ${
              rightItems.length > 0
                ? `<div class="side-label">Side 2 · Q.${startNumber + leftItems.length} – Q.${endNumber}</div>${rightHtml}`
                : ""
            }
          </div>
        </div>
        <div class="footer-note">
          <span><strong>${escapeHtml(schoolName)}</strong> · ${escapeHtml(paper.classLabel)} (${escapeHtml(paper.setId)})</span>
          <span>All Qs carry 1 mark · No negative marking · Page ${pIdx + 1}/${totalPart1Pages}</span>
        </div>
      </div>
    `);
  }

  if (mode === "full") {
    const keyedItems = paper.questions.map((q, idx) => ({ q, qNo: idx + 1 }));
    const keyChunks = chunkAnswerRows(keyedItems, 28);

    for (let kIdx = 0; kIdx < keyChunks.length; kIdx++) {
      const rows = keyChunks[kIdx];
      pagesHtml.push(`
        <div class="exam-sheet">
          <div class="key-banner">
            <div>
              <div style="font-size:13px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;color:#fde68a;">${escapeHtml(schoolName)}</div>
              <div style="font-size:11.5px;font-weight:800;margin-top:2px;">PART 2: OFFICIAL ANSWER KEY &amp; SOLUTIONS · ${escapeHtml(paper.classLabel)} (${escapeHtml(paper.setId)})</div>
            </div>
            <div style="text-align:right;font-size:9.5px;color:#e2e8f0;font-weight:700;">
              Sheet ${kIdx + 1} / ${keyChunks.length}<br/>Total Qs: ${paper.totalQuestions} · ${paper.durationMinutes} Min
            </div>
          </div>

          <table class="key-table">
            <thead>
              <tr>
                <th style="width:38px;">Q.No</th>
                <th style="width:82px;">Subject</th>
                <th style="width:42px;">Ans</th>
                <th style="width:150px;">Correct Option</th>
                <th>Brief Explanation / Solution</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(({ q, qNo }) => {
                  const letter = OPTION_LETTERS[q.correctIndex] || "A";
                  const optText = q.options[q.correctIndex] || "";
                  return `
                    <tr>
                      <td style="font-weight:800;text-align:center;">Q.${qNo}</td>
                      <td style="font-weight:600;color:#334155;">${escapeHtml(q.subject)}</td>
                      <td style="text-align:center;"><span class="key-badge">${letter}</span></td>
                      <td style="font-weight:700;color:#0f172a;">${escapeHtml(optText)}</td>
                      <td>${escapeHtml(q.explanation)}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>

          <div class="footer-note">
            <span><strong>${escapeHtml(schoolName)}</strong> · Official Answer Key</span>
            <span>${escapeHtml(paper.classLabel)} (${escapeHtml(paper.setId)}) · Sheet ${kIdx + 1}/${keyChunks.length}</span>
          </div>
        </div>
      `);
    }
  }

  const safeCode = (school?.code || schoolName || "SCHOOL")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 18);
  const suffix = mode === "full" ? "Question_And_AnswerKey" : "QuestionPaper";
  const clsSlug = formatEntranceClassLabel(paper.classLevel).replace(/\s+/g, "");
  const docTitle = `${safeCode}_${clsSlug}_${paper.setId}_${suffix}`;

  return { pagesHtml, docTitle };
}

export function buildStandardPaperHtmlBundle(
  params: StandardEntrancePaperExportParams
): { pagesHtml: string[]; fullCss: string; docTitle: string } {
  const { pagesHtml, docTitle } = buildEntrancePaperPagesHtml(params);
  return { pagesHtml, fullCss: SHARED_PDF_CSS, docTitle };
}

export function printEntrancePaperA4(
  params: StandardEntrancePaperExportParams
): { invoked: boolean; insideIframe: boolean } {
  const { pagesHtml, docTitle } = buildEntrancePaperPagesHtml(params);
  return mountAndPrintA4Sync(pagesHtml, SHARED_PDF_CSS, docTitle);
}

export async function downloadEntrancePaperPdf(
  params: StandardEntrancePaperExportParams
): Promise<void> {
  const { pagesHtml, docTitle } = buildEntrancePaperPagesHtml(params);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = await renderHtmlToCanvasSafe(pagesHtml[i], SHARED_PDF_CSS, {
      widthPx: 794,
      heightPx: 1122,
      scale: 2,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.94);
    const ratio = canvas.height / Math.max(1, canvas.width);
    const rawHeightMm = pageWidthMm * ratio;
    const fitScale = rawHeightMm > pageHeightMm ? pageHeightMm / rawHeightMm : 1;
    const drawW = pageWidthMm * fitScale;
    const drawH = rawHeightMm * fitScale;
    const offsetX = (pageWidthMm - drawW) / 2;
    const offsetY = (pageHeightMm - drawH) / 2;
    pdf.addImage(imgData, "JPEG", offsetX, offsetY, drawW, drawH);
  }

  pdf.save(`${docTitle}.pdf`);
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTHENTIC SCHOOL QUESTION PAPER ENGINE (ENTRANCE / PA 1-4 / HALF YEARLY / FINAL)
// - Class 1–3: 2-Page Question-cum-Answer Booklet with ruled writing space inside
// - Class 4–10: Max 10 Objective + Subjective Board-Style 2-Page Paper
// - Page 3+: Ink-friendly Examiner Marking Scheme & Combined Answer Key
// ═════════════════════════════════════════════════════════════════════════════

export type PaperPrintTheme = "classic_bw" | "heritage_navy";

export interface CustomPaperBuildInput {
  school: School;
  classLevel: EntranceClassNumber;
  paperTitle: string;
  examName?: string;
  sessionLabel?: string;
  subjectLabel?: string;
  schoolNameOverride?: string;
  schoolTaglineOverride?: string;
  schoolAddressOverride?: string;
  schoolContactOverride?: string;
  schoolSubHeaderOverride?: string;
  logoPosition?: "left" | "center";
  fullMarksOverride?: number | null;
  examDate?: string;
  paperCode?: string;
  generalInstructions?: string[];
  cbseRulesMode?: CbseBoardRulesMode;
  customBoardRulesHi?: string[];
  customBoardRulesEn?: string[];
  printOrientation?: PaperPrintOrientation;
  showStudentStrip?: boolean;
  paperTheme?: PaperPrintTheme;
  durationMinutes: number;
  objectiveQuestions: EntranceTestQuestion[];
  subjectiveQuestions: EntranceTestQuestion[];
  fontSizePx: number; // e.g., 5.5 to 14.0
  twoColObjective?: boolean;
  twoColSubjective?: boolean;
  showWritingLines?: boolean;
  manualPageOverrides?: Record<string, number>;
  mode?: "full" | "questions_only";
}

export interface BookletSpreadSide {
  sheetNumber: number; // Physical A4 sheet # (1, 2, 3...)
  side: "FRONT" | "BACK";
  leftPageNo: number; // 1-indexed page number placed on Left half
  rightPageNo: number; // 1-indexed page number placed on Right half
}

export type LandscapeImpositionMode = "two_up_copy" | "booklet_fold";

export interface BookletSpreadPlan {
  mode: LandscapeImpositionMode;
  paddedPageCount: number;
  physicalA4Sheets: number;
  sides: BookletSpreadSide[];
}

/**
 * Smart Landscape 2-Up / Booklet Imposition:
 * - 1-Page Paper ("two_up_copy" — 2 Copies from 1 A4 Sheet, Cut down center):
 *     Side 1 (Front): Left = Page 1 | Right = Page 1
 * - 2-Page Paper ("two_up_copy" — 2 Complete Papers from 1 A4 Sheet Front+Back, Cut down center):
 *     Side 1 (Front): Left = Page 1 (Pg-4 slot) | Right = Page 1 (Pg-1 slot)  [SAME]
 *     Side 2 (Back):  Left = Page 2 (Pg-2 slot) | Right = Page 2 (Pg-3 slot)  [SAME]
 * - 3–4+ Page Paper ("booklet_fold" — Saddle-Stitch Folded Booklet):
 *     4 Pages (1 A4 sheet): Front [Left: P4 (or Rough Work if 3P) | Right: P1], Back [Left: P2 | Right: P3]
 *     8 Pages (2 A4 sheets): Sheet 1 [8|1], [2|7]; Sheet 2 [6|3], [4|5], etc.
 */
export function computeBookletSpreadPlan(totalPages: number): BookletSpreadPlan {
  const safePages = Math.max(1, Math.round(totalPages || 1));

  if (safePages === 1) {
    return {
      mode: "two_up_copy",
      paddedPageCount: 1,
      physicalA4Sheets: 1,
      sides: [
        {
          sheetNumber: 1,
          side: "FRONT",
          leftPageNo: 1,
          rightPageNo: 1,
        },
      ],
    };
  }

  if (safePages === 2) {
    return {
      mode: "two_up_copy",
      paddedPageCount: 2,
      physicalA4Sheets: 1,
      sides: [
        {
          sheetNumber: 1,
          side: "FRONT",
          leftPageNo: 1,
          rightPageNo: 1,
        },
        {
          sheetNumber: 1,
          side: "BACK",
          leftPageNo: 2,
          rightPageNo: 2,
        },
      ],
    };
  }

  const paddedPageCount = Math.max(4, Math.ceil(safePages / 4) * 4);
  const physicalA4Sheets = paddedPageCount / 4;
  const sides: BookletSpreadSide[] = [];

  for (let s = 0; s < physicalA4Sheets; s++) {
    // Front side of physical sheet (s + 1): Left = N - 2s, Right = 2s + 1
    sides.push({
      sheetNumber: s + 1,
      side: "FRONT",
      leftPageNo: paddedPageCount - 2 * s,
      rightPageNo: 2 * s + 1,
    });
    // Back side of physical sheet (s + 1): Left = 2s + 2, Right = N - 2s - 1
    sides.push({
      sheetNumber: s + 1,
      side: "BACK",
      leftPageNo: 2 * s + 2,
      rightPageNo: paddedPageCount - 2 * s - 1,
    });
  }

  return { mode: "booklet_fold", paddedPageCount, physicalA4Sheets, sides };
}

function buildRoughWorkBookletPageHtml(params: {
  schoolName: string;
  examName: string;
  sessionLabel: string;
  classLabel: string;
  pageNo: number;
  totalBookletPages: number;
}): string {
  const { schoolName, examName, sessionLabel, classLabel, pageNo, totalBookletPages } = params;
  return `
    <div class="exam-sheet qp-sheet">
      <table class="qp-tbl qp-page-frame-tbl">
        <tr>
          <td class="qp-frame-top-cell">
            <table class="qp-tbl qp-cont-header-tbl">
              <tr>
                <td style="width:32%;text-align:left;" class="qp-cont-school">${escapeHtml(schoolName)}</td>
                <td style="width:48%;text-align:center;">${escapeHtml(examName)} (${escapeHtml(sessionLabel)}) &middot; ${escapeHtml(classLabel)}</td>
                <td style="width:20%;text-align:right;">Page ${pageNo} of ${totalBookletPages}</td>
              </tr>
            </table>
            <div class="qp-rough-wrap">
              <div class="qp-rough-title">SPACE FOR ROUGH WORK / रफ़ कार्य के लिए स्थान</div>
              <div class="qp-rough-sub">Students may use this space for rough calculations. Do not tear this sheet.</div>
              <div class="qp-rough-box"></div>
            </div>
          </td>
        </tr>
        <tr>
          <td class="qp-frame-foot-cell">
            <table class="qp-tbl qp-footer-tbl">
              <tr>
                <td style="text-align:left;"><strong>${escapeHtml(schoolName)}</strong> &middot; ${escapeHtml(classLabel)} (${escapeHtml(examName)})</td>
                <td style="text-align:right;">Rough Work &nbsp;|&nbsp; Page ${pageNo} of ${totalBookletPages}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function imposeLandscapeBookletSheets(params: {
  logicalPagesHtml: string[];
  schoolName: string;
  examName: string;
  sessionLabel: string;
  classLabel: string;
}): string[] {
  const { logicalPagesHtml, schoolName, examName, sessionLabel, classLabel } = params;
  const plan = computeBookletSpreadPlan(logicalPagesHtml.length);

  const getSlotHtml = (pageNo: number): string => {
    const idx = pageNo - 1;
    if (idx >= 0 && idx < logicalPagesHtml.length) {
      return logicalPagesHtml[idx];
    }
    return buildRoughWorkBookletPageHtml({
      schoolName,
      examName,
      sessionLabel,
      classLabel,
      pageNo,
      totalBookletPages: plan.paddedPageCount,
    });
  };

  return plan.sides.map((spread) => {
    const leftHtml = getSlotHtml(spread.leftPageNo);
    const rightHtml = getSlotHtml(spread.rightPageNo);
    const isCutCopy = plan.mode === "two_up_copy";
    return `
      <div class="booklet-sheet">
        <table class="booklet-spread-tbl">
          <tr>
            <td class="booklet-half-cell">
              <div class="booklet-slot">
                <div class="booklet-slot-scaler">${leftHtml}</div>
              </div>
            </td>
            <td class="booklet-fold-gutter">
              <div class="booklet-fold-line${isCutCopy ? " booklet-cut-line" : ""}"></div>
              ${isCutCopy ? `<div class="booklet-cut-mark">&#9986;</div>` : ""}
            </td>
            <td class="booklet-half-cell">
              <div class="booklet-slot">
                <div class="booklet-slot-scaler">${rightHtml}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
  });
}

export interface ResolvedCbseBoardRules {
  layout: "none" | "single" | "bilingual";
  hi: string[];
  en: string[];
}

const DEVANAGARI_CHAR_RE = /[\u0900-\u097F]/g;

function isPredominantlyHindiPaper(
  objectiveQuestions: EntranceTestQuestion[],
  subjectiveQuestions: EntranceTestQuestion[],
  subjectLabel?: string
): boolean {
  const sampleText = [
    subjectLabel || "",
    ...objectiveQuestions.slice(0, 8).map((q) => q.question || ""),
    ...subjectiveQuestions.slice(0, 8).map((q) => q.question || ""),
  ].join(" ");
  const devMatches = sampleText.match(DEVANAGARI_CHAR_RE);
  return Boolean(devMatches && devMatches.length >= 12);
}

function hydrateDynamicCountsInRule(
  rule: string,
  totalPages: number,
  totalQuestions: number
): string {
  let out = sanitizePaperText(rule);
  if (!out) return "";
  out = out
    .replace(/\{\s*(?:total_?pages|pages|printed_?pages)\s*\}/gi, String(totalPages))
    .replace(/\{\s*(?:total_?questions|questions|question_?count)\s*\}/gi, String(totalQuestions));
  if (totalPages > 0) {
    out = out
      .replace(/(मुद्रित\s*पृष्ठ\s*)\d+(\s*हैं)/gi, `$1${totalPages}$2`)
      .replace(/(contains\s+)\d+(\s+printed\s+pages?)/gi, `$1${totalPages}$2`);
  }
  if (totalQuestions > 0) {
    out = out
      .replace(/(इस\s*प्रश्न[- ]?पत्र\s*में\s*)\d+(\s*प्रश्न\s*हैं)/gi, `$1${totalQuestions}$2`)
      .replace(/(contains\s+)\d+(\s+questions?)/gi, `$1${totalQuestions}$2`);
  }
  return out;
}

export function buildDefaultCbseBoardRulesHi(params: {
  totalPages: number;
  totalQuestions: number;
  durationMinutes?: number;
}): string[] {
  const pages = Math.max(1, Math.round(params.totalPages || 1));
  const qs = Math.max(1, Math.round(params.totalQuestions || 1));
  const rules = [
    `कृपया जाँच कर लें कि इस प्रश्न-पत्र में मुद्रित पृष्ठ ${pages} हैं।`,
    `प्रश्न-पत्र में दाहिने हाथ की ओर दिए गए कोड नम्बर को छात्र उत्तर-पुस्तिका के मुख पृष्ठ पर लिखें।`,
    `कृपया जाँच कर लें कि इस प्रश्न-पत्र में ${qs} प्रश्न हैं।`,
    `कृपया प्रश्न का उत्तर लिखना शुरू करने से पहले, प्रश्न का क्रमांक अवश्य लिखें।`,
  ];
  if (Number(params.durationMinutes ?? 180) >= 90) {
    rules.push(
      `इस प्रश्न-पत्र को पढ़ने के लिए 15 मिनट का समय दिया गया है। प्रश्न-पत्र का वितरण पूर्वाह्न में 10.15 बजे किया जाएगा। 10.15 बजे से 10.30 बजे तक छात्र केवल प्रश्न-पत्र को पढ़ेंगे और इस अवधि के दौरान वे उत्तर-पुस्तिका पर कोई उत्तर नहीं लिखेंगे।`
    );
  }
  return rules;
}

export function buildDefaultCbseBoardRulesEn(params: {
  totalPages: number;
  totalQuestions: number;
  durationMinutes?: number;
}): string[] {
  const pages = Math.max(1, Math.round(params.totalPages || 1));
  const qs = Math.max(1, Math.round(params.totalQuestions || 1));
  const rules = [
    `Please check that this question paper contains ${pages} printed ${pages === 1 ? "page" : "pages"}.`,
    `Code number given on the right hand side of the question paper should be written on the title page of the answer-book by the candidate.`,
    `Please check that this question paper contains ${qs} ${qs === 1 ? "question" : "questions"}.`,
    `Please write down the Serial Number of the question before attempting it.`,
  ];
  if (Number(params.durationMinutes ?? 180) >= 90) {
    rules.push(
      `15 minute time has been allotted to read this question paper. The question paper will be distributed at 10.15 a.m. From 10.15 a.m. to 10.30 a.m., the students will read the question paper only and will not write any answer on the answer-book during this period.`
    );
  }
  return rules;
}

export function resolveCbseBoardRules(params: {
  classLevel?: EntranceClassNumber;
  cbseRulesMode?: CbseBoardRulesMode;
  customBoardRulesHi?: string[];
  customBoardRulesEn?: string[];
  objectiveQuestions: EntranceTestQuestion[];
  subjectiveQuestions: EntranceTestQuestion[];
  subjectLabel?: string;
  totalPages: number;
  totalQuestions: number;
  durationMinutes?: number;
}): ResolvedCbseBoardRules {
  const mode: CbseBoardRulesMode = params.cbseRulesMode || "auto";
  if (mode === "none") {
    return { layout: "none", hi: [], en: [] };
  }

  const cleanHiCustom = (params.customBoardRulesHi || [])
    .map((r) => hydrateDynamicCountsInRule(r, params.totalPages, params.totalQuestions))
    .filter(Boolean);
  const cleanEnCustom = (params.customBoardRulesEn || [])
    .map((r) => hydrateDynamicCountsInRule(r, params.totalPages, params.totalQuestions))
    .filter(Boolean);

  const defaultHi = () =>
    buildDefaultCbseBoardRulesHi({
      totalPages: params.totalPages,
      totalQuestions: params.totalQuestions,
      durationMinutes: params.durationMinutes,
    });
  const defaultEn = () =>
    buildDefaultCbseBoardRulesEn({
      totalPages: params.totalPages,
      totalQuestions: params.totalQuestions,
      durationMinutes: params.durationMinutes,
    });

  if (mode === "bilingual") {
    return {
      layout: "bilingual",
      hi: cleanHiCustom.length > 0 ? cleanHiCustom : defaultHi(),
      en: cleanEnCustom.length > 0 ? cleanEnCustom : defaultEn(),
    };
  }
  if (mode === "hi") {
    return {
      layout: "single",
      hi: cleanHiCustom.length > 0 ? cleanHiCustom : defaultHi(),
      en: [],
    };
  }
  if (mode === "en") {
    return {
      layout: "single",
      hi: [],
      en: cleanEnCustom.length > 0 ? cleanEnCustom : defaultEn(),
    };
  }

  // mode === "auto"
  if (cleanHiCustom.length > 0 && cleanEnCustom.length > 0) {
    return { layout: "bilingual", hi: cleanHiCustom, en: cleanEnCustom };
  }
  if (cleanHiCustom.length > 0) {
    return { layout: "single", hi: cleanHiCustom, en: [] };
  }
  if (cleanEnCustom.length > 0) {
    return { layout: "single", hi: [], en: cleanEnCustom };
  }

  // Nursery / LKG / UKG do not need Board Answer-Book rules by default unless explicitly requested
  if (params.classLevel !== undefined && params.classLevel <= 0) {
    return { layout: "none", hi: [], en: [] };
  }

  const hindiPaper = isPredominantlyHindiPaper(
    params.objectiveQuestions,
    params.subjectiveQuestions,
    params.subjectLabel
  );
  if (hindiPaper) {
    return { layout: "single", hi: defaultHi(), en: [] };
  }
  return { layout: "single", hi: [], en: defaultEn() };
}

function estimateCbseRulesBoxPx(resolved: ResolvedCbseBoardRules): number {
  if (resolved.layout === "none") return 0;
  const lineHeightPx = 10.6;
  const calcColHeight = (rules: string[], charsPerLine: number) =>
    rules.reduce((sum, r) => {
      const lines = Math.max(1, Math.ceil((r.length + 4) / charsPerLine));
      return sum + lines * lineHeightPx + 1.8;
    }, 0);

  if (resolved.layout === "bilingual") {
    const hiH = calcColHeight(resolved.hi, 52);
    const enH = calcColHeight(resolved.en, 56);
    return Math.ceil(Math.max(hiH, enH) + 18);
  }
  const list = resolved.hi.length > 0 ? resolved.hi : resolved.en;
  const charsPerLine = resolved.hi.length > 0 ? 102 : 112;
  return Math.ceil(calcColHeight(list, charsPerLine) + 16);
}

export interface CustomNumberedItem {
  q: EntranceTestQuestion;
  section: "A" | "B";
  displayNo: number; // Continuous Q.1 .. Q.N across the paper
  marks: number;
}

export interface CustomPaperSheetPlan {
  pageNumber: number;
  objectiveItems: CustomNumberedItem[];
  subjectiveItems: CustomNumberedItem[];
  usedHeightPx: number;
  capacityPx: number;
  utilizationPct: number;
}

export interface CustomPaperLayoutSummary {
  fontSizePx: number;
  pages: CustomPaperSheetPlan[];
  questionPageCount: number; // 1, 2, 3, ... N pages
  overflowItems: CustomNumberedItem[];
  fitsInTwoPages: boolean;
  autoFitFontSizePx: number;
  totalMarks: number;
  objectiveMarks: number;
  subjectiveMarks: number;
  answerKeyPageNumber: number; // e.g., Page 2, Page 3, Page 5, etc.
}

/**
 * Strips decorative pictographs / emojis from formal printed exam paper text
 * while preserving intentional line breaks (for Assertion-Reason, Case-Based & subPoints).
 */
export function sanitizePaperText(raw: string): string {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/\(\s*\)/g, "").trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join("\n")
    .trim();
}

function escapeHtmlMultiline(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function estimateMultilineWrappedLines(text: string, charsPerLine: number): number {
  const clean = sanitizePaperText(text || "");
  if (!clean) return 0;
  return clean.split("\n").reduce((sum, line) => {
    const trimmed = line.trim();
    if (!trimmed) return sum + 0.5;
    return sum + Math.max(1, Math.ceil((trimmed.length + 4) / charsPerLine));
  }, 0);
}

function formatDurationDisplay(mins: number): string {
  const m = Math.max(15, Math.round(Number(mins || 60)));
  if (m < 60) return `${m} Mins`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} ${h === 1 ? "Hour" : "Hours"}` : `${h} Hr ${rem} Mins`;
}

export function getSubjectiveWritingLineCount(
  q: EntranceTestQuestion,
  marks: number,
  showWritingLines: boolean
): number {
  if (!showWritingLines) return 0;
  return q.format === "LONG_ANSWER" || Number(marks || 2) >= 3 ? 4 : 3;
}

export function resolveItemGroupHeading(
  q: EntranceTestQuestion,
  distinctSubjectCount: number
): string {
  const tag = String(q.topicTag || "").trim();
  if (/^(?:section|part|खंड|भाग)\b/i.test(tag)) {
    return tag;
  }
  if (distinctSubjectCount > 1) {
    return String(q.subject || "General").trim();
  }
  return "";
}

function estimateObjectiveRowPx(
  pair: CustomNumberedItem[],
  fontSizePx: number,
  twoCol: boolean
): number {
  const charsPerLine = twoCol
    ? Math.max(36, Math.round(46 * (9.5 / fontSizePx)))
    : Math.max(76, Math.round(104 * (9.5 / fontSizePx)));
  const lineH = Math.max(7.2, fontSizePx * 1.32);
  const optLineH = Math.max(7.6, fontSizePx * 0.92 * 1.32 + 1.4);
  const fourColThreshold = fontSizePx <= 8.0 ? 25 : fontSizePx <= 10.5 ? 20 : 15;

  const itemHeight = (item: CustomNumberedItem): number => {
    const q = item.q;
    const promptLines = Math.max(1, estimateMultilineWrappedLines(q.question || "", charsPerLine));
    const passageLines = q.passage
      ? estimateMultilineWrappedLines(q.passage, Math.round(charsPerLine * 1.1)) + 0.35
      : 0;
    const maxOptLen = Math.max(
      ...q.options.map((o) => sanitizePaperText(String(o || "")).length),
      4
    );
    const optRows =
      !twoCol && maxOptLen <= fourColThreshold ? 1 : maxOptLen > (twoCol ? 20 : 36) ? 4 : 2;
    const optHeight = optRows * optLineH + 1.2;
    const pad = Math.max(2.5, fontSizePx * 0.52);
    return (promptLines + passageLines) * lineH + optHeight + pad;
  };

  if (pair.length === 1) return itemHeight(pair[0]);
  return Math.max(itemHeight(pair[0]), itemHeight(pair[1]));
}

function estimateSubjectiveRowPx(
  pair: CustomNumberedItem[],
  fontSizePx: number,
  twoCol: boolean,
  showWritingLines: boolean
): number {
  const charsPerLine = twoCol
    ? Math.max(36, Math.round(46 * (9.5 / fontSizePx)))
    : Math.max(76, Math.round(104 * (9.5 / fontSizePx)));
  const lineH = Math.max(7.2, fontSizePx * 1.32);

  const itemHeight = (item: CustomNumberedItem): number => {
    const q = item.q;
    const promptLines = Math.max(1, estimateMultilineWrappedLines(q.question || "", charsPerLine));
    const passageLines = q.passage
      ? estimateMultilineWrappedLines(q.passage, Math.round(charsPerLine * 1.1)) + 0.35
      : 0;
    const cleanOrQ = q.orQuestion ? sanitizePaperText(q.orQuestion) : "";
    const orLines = cleanOrQ
      ? Math.max(1, estimateMultilineWrappedLines(cleanOrQ, charsPerLine)) +
        (q.orPassage
          ? estimateMultilineWrappedLines(q.orPassage, Math.round(charsPerLine * 1.1)) + 0.35
          : 0) +
        1.15
      : 0;
    const answerLineCount = getSubjectiveWritingLineCount(q, item.marks, showWritingLines);
    const answerLinesHeight = answerLineCount > 0 ? answerLineCount * 22 + 5 : 0;
    const pad = Math.max(3.5, fontSizePx * 0.68);
    return (promptLines + passageLines + orLines) * lineH + answerLinesHeight + pad;
  };

  if (pair.length === 1) return itemHeight(pair[0]);
  return Math.max(itemHeight(pair[0]), itemHeight(pair[1]));
}

function estimateItemsSectionHeight(params: {
  items: CustomNumberedItem[];
  isSubjective: boolean;
  fontSizePx: number;
  twoCol: boolean;
  showWritingLines: boolean;
  includeBanner: boolean;
  distinctSubjectCount: number;
}): number {
  const {
    items,
    isSubjective,
    fontSizePx,
    twoCol,
    showWritingLines,
    includeBanner,
    distinctSubjectCount,
  } = params;
  if (items.length === 0) return 0;
  const SECTION_BANNER_H = 26;
  const SUBJ_GROUP_H = 19;
  let total = includeBanner ? SECTION_BANNER_H : 0;
  const step = twoCol ? 2 : 1;
  let lastGroup = "";
  for (let i = 0; i < items.length; i += step) {
    const row = items.slice(i, i + step);
    const firstGroup = resolveItemGroupHeading(row[0].q, distinctSubjectCount);
    if (firstGroup && firstGroup !== lastGroup) {
      total += SUBJ_GROUP_H;
    }
    total += isSubjective
      ? estimateSubjectiveRowPx(row, fontSizePx, twoCol, showWritingLines)
      : estimateObjectiveRowPx(row, fontSizePx, twoCol);
    lastGroup = resolveItemGroupHeading(row[row.length - 1].q, distinctSubjectCount) || firstGroup;
  }
  return total;
}

function packIntoPagesInternal(params: {
  objectiveQuestions: EntranceTestQuestion[];
  subjectiveQuestions: EntranceTestQuestion[];
  fontSizePx: number;
  twoColObjective: boolean;
  twoColSubjective: boolean;
  showWritingLines: boolean;
  hasInstructions?: boolean;
  hasStudentStrip?: boolean;
  cbseRulesOverheadPx?: number;
  manualPageOverrides?: Record<string, number>;
}): {
  pages: CustomPaperSheetPlan[];
  overflowItems: CustomNumberedItem[];
} {
  const {
    objectiveQuestions,
    subjectiveQuestions,
    fontSizePx,
    twoColObjective,
    twoColSubjective,
    showWritingLines,
    hasInstructions = true,
    hasStudentStrip = true,
    cbseRulesOverheadPx = 0,
    manualPageOverrides,
  } = params;

  const mastheadOverhead =
    (hasStudentStrip ? 36 : 0) + cbseRulesOverheadPx + (hasInstructions ? 32 : 0);
  const PAGE1_CAPACITY = Math.max(420, 890 - mastheadOverhead);
  const CONT_PAGE_CAPACITY = 993;
  const SECTION_BANNER_H = 26;
  const SUBJ_GROUP_H = 19;

  const distinctSubjectCount = new Set(
    [...objectiveQuestions, ...subjectiveQuestions].map((q) => String(q.subject || "").trim())
  ).size;

  const objItems: CustomNumberedItem[] = objectiveQuestions.map((q, idx) => ({
    q,
    section: "A",
    displayNo: idx + 1,
    marks: Number(q.marks || 1),
  }));
  const subjItems: CustomNumberedItem[] = subjectiveQuestions.map((q, idx) => ({
    q,
    section: "B",
    displayNo: objItems.length + idx + 1,
    marks: Number(q.marks || (q.format === "LONG_ANSWER" ? 3 : 2)),
  }));

  const makePage = (pageNum: number): CustomPaperSheetPlan => ({
    pageNumber: pageNum,
    objectiveItems: [],
    subjectiveItems: [],
    usedHeightPx: 0,
    capacityPx: pageNum === 1 ? PAGE1_CAPACITY : CONT_PAGE_CAPACITY,
    utilizationPct: 0,
  });

  const activeOverrides = manualPageOverrides || {};
  const hasManualOverrides = Object.keys(activeOverrides).some((id) => {
    const pg = Number(activeOverrides[id]);
    return Number.isFinite(pg) && pg >= 1;
  });

  const getPinnedPage = (id: string): number | null => {
    const raw = Number(activeOverrides[id]);
    return Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : null;
  };

  const flowObjItems: CustomNumberedItem[] = [];
  const pinnedObjByPage = new Map<number, CustomNumberedItem[]>();
  objItems.forEach((it) => {
    const pin = getPinnedPage(it.q.id);
    if (pin !== null) {
      const list = pinnedObjByPage.get(pin) || [];
      list.push(it);
      pinnedObjByPage.set(pin, list);
    } else {
      flowObjItems.push(it);
    }
  });

  const flowSubjItems: CustomNumberedItem[] = [];
  const pinnedSubjByPage = new Map<number, CustomNumberedItem[]>();
  subjItems.forEach((it) => {
    const pin = getPinnedPage(it.q.id);
    if (pin !== null) {
      const list = pinnedSubjByPage.get(pin) || [];
      list.push(it);
      pinnedSubjByPage.set(pin, list);
    } else {
      flowSubjItems.push(it);
    }
  });

  const maxPinnedPage = Math.max(
    1,
    ...Array.from(pinnedObjByPage.keys()),
    ...Array.from(pinnedSubjByPage.keys())
  );

  const pages: CustomPaperSheetPlan[] = [];
  for (let p = 1; p <= maxPinnedPage; p++) {
    pages.push(makePage(p));
  }

  // Reserve height on each target page for pinned questions so flowing items leave room cleanly
  const reservedHeightByPageIdx = new Map<number, number>();
  for (let p = 1; p <= maxPinnedPage; p++) {
    const pObj = pinnedObjByPage.get(p) || [];
    const pSubj = pinnedSubjByPage.get(p) || [];
    const rH =
      estimateItemsSectionHeight({
        items: pObj,
        isSubjective: false,
        fontSizePx,
        twoCol: twoColObjective,
        showWritingLines: false,
        includeBanner: pObj.length > 0,
        distinctSubjectCount,
      }) +
      estimateItemsSectionHeight({
        items: pSubj,
        isSubjective: true,
        fontSizePx,
        twoCol: twoColSubjective,
        showWritingLines,
        includeBanner: pSubj.length > 0,
        distinctSubjectCount,
      });
    reservedHeightByPageIdx.set(p - 1, rH);
  }

  let pageIdx = 0;

  // Pack flowing Section A rows across pages (vacated spaces automatically fill with remaining questions!)
  if (flowObjItems.length > 0) {
    const step = twoColObjective ? 2 : 1;
    const bannerAddedOnPage = new Set<number>();
    const lastGroupOnPage = new Map<number, string>();

    for (let i = 0; i < flowObjItems.length; i += step) {
      const row = flowObjItems.slice(i, i + step);
      const rowH = estimateObjectiveRowPx(row, fontSizePx, twoColObjective);
      const firstGroup = resolveItemGroupHeading(row[0].q, distinctSubjectCount);

      while (true) {
        const cur = pages[pageIdx];
        const reserved = reservedHeightByPageIdx.get(pageIdx) || 0;
        const extraBanner = !bannerAddedOnPage.has(pageIdx) ? SECTION_BANNER_H : 0;
        const prevGroup = lastGroupOnPage.get(pageIdx) || "";
        const groupExtra = firstGroup && firstGroup !== prevGroup ? SUBJ_GROUP_H : 0;
        const isPageEmpty =
          cur.objectiveItems.length === 0 &&
          cur.subjectiveItems.length === 0 &&
          reserved === 0;

        if (
          cur.usedHeightPx + reserved + extraBanner + groupExtra + rowH <= cur.capacityPx ||
          isPageEmpty
        ) {
          if (extraBanner > 0) {
            cur.usedHeightPx += SECTION_BANNER_H;
            bannerAddedOnPage.add(pageIdx);
          }
          cur.objectiveItems.push(...row);
          cur.usedHeightPx += groupExtra + rowH;
          const tailGroup = resolveItemGroupHeading(row[row.length - 1].q, distinctSubjectCount);
          lastGroupOnPage.set(pageIdx, tailGroup || firstGroup);
          break;
        }
        pageIdx++;
        if (!pages[pageIdx]) {
          pages.push(makePage(pageIdx + 1));
        }
      }
    }
  }

  // Pack flowing Section B rows across pages
  if (flowSubjItems.length > 0) {
    const step = twoColSubjective ? 2 : 1;
    const bannerAddedOnPage = new Set<number>();
    const lastGroupOnPage = new Map<number, string>();

    for (let i = 0; i < flowSubjItems.length; i += step) {
      const row = flowSubjItems.slice(i, i + step);
      const rowH = estimateSubjectiveRowPx(row, fontSizePx, twoColSubjective, showWritingLines);
      const firstGroup = resolveItemGroupHeading(row[0].q, distinctSubjectCount);

      while (true) {
        const cur = pages[pageIdx];
        const reserved = reservedHeightByPageIdx.get(pageIdx) || 0;
        const extraBanner = !bannerAddedOnPage.has(pageIdx) ? SECTION_BANNER_H : 0;
        const prevGroup = lastGroupOnPage.get(pageIdx) || "";
        const groupExtra = firstGroup && firstGroup !== prevGroup ? SUBJ_GROUP_H : 0;
        const isPageEmpty =
          cur.objectiveItems.length === 0 &&
          cur.subjectiveItems.length === 0 &&
          reserved === 0;

        if (
          cur.usedHeightPx + reserved + extraBanner + groupExtra + rowH <= cur.capacityPx ||
          isPageEmpty
        ) {
          if (extraBanner > 0) {
            cur.usedHeightPx += SECTION_BANNER_H;
            bannerAddedOnPage.add(pageIdx);
          }
          cur.subjectiveItems.push(...row);
          cur.usedHeightPx += groupExtra + rowH;
          const tailGroup = resolveItemGroupHeading(row[row.length - 1].q, distinctSubjectCount);
          lastGroupOnPage.set(pageIdx, tailGroup || firstGroup);
          break;
        }
        pageIdx++;
        if (!pages[pageIdx]) {
          pages.push(makePage(pageIdx + 1));
        }
      }
    }
  }

  // Place pinned questions directly onto their target pages
  pinnedObjByPage.forEach((items, targetPageNum) => {
    const idx = Math.max(0, targetPageNum - 1);
    while (pages.length <= idx) {
      pages.push(makePage(pages.length + 1));
    }
    pages[idx].objectiveItems.push(...items);
  });

  pinnedSubjByPage.forEach((items, targetPageNum) => {
    const idx = Math.max(0, targetPageNum - 1);
    while (pages.length <= idx) {
      pages.push(makePage(pages.length + 1));
    }
    pages[idx].subjectiveItems.push(...items);
  });

  // Remove any completely empty pages after manual moves
  const nonEmptyPages = pages.filter(
    (pg) => pg.objectiveItems.length > 0 || pg.subjectiveItems.length > 0
  );
  const finalPages = nonEmptyPages.length > 0 ? nonEmptyPages : [makePage(1)];

  // Subject-cohesion pass for 2-page papers ONLY when no manual page overrides are active
  if (
    !hasManualOverrides &&
    finalPages.length === 2 &&
    finalPages[0].subjectiveItems.length > 0 &&
    finalPages[1].subjectiveItems.length > 0
  ) {
    const p1 = finalPages[0];
    const p2 = finalPages[1];
    const tailSubj = resolveItemGroupHeading(
      p1.subjectiveItems[p1.subjectiveItems.length - 1].q,
      distinctSubjectCount
    );
    const headP2Subj = resolveItemGroupHeading(p2.subjectiveItems[0].q, distinctSubjectCount);
    if (tailSubj && headP2Subj && tailSubj === headP2Subj) {
      let splitIdx = p1.subjectiveItems.length;
      while (
        splitIdx > 0 &&
        resolveItemGroupHeading(p1.subjectiveItems[splitIdx - 1].q, distinctSubjectCount) === tailSubj
      ) {
        splitIdx--;
      }
      if (splitIdx > 0 || p1.objectiveItems.length > 0) {
        const candP1Subj = p1.subjectiveItems.slice(0, splitIdx);
        const candP2Subj = [...p1.subjectiveItems.slice(splitIdx), ...p2.subjectiveItems];
        const newP2H =
          estimateItemsSectionHeight({
            items: p2.objectiveItems,
            isSubjective: false,
            fontSizePx,
            twoCol: twoColObjective,
            showWritingLines: false,
            includeBanner: p2.objectiveItems.length > 0,
            distinctSubjectCount,
          }) +
          estimateItemsSectionHeight({
            items: candP2Subj,
            isSubjective: true,
            fontSizePx,
            twoCol: twoColSubjective,
            showWritingLines,
            includeBanner: true,
            distinctSubjectCount,
          });

        if (newP2H <= CONT_PAGE_CAPACITY * 0.92) {
          p1.subjectiveItems = candP1Subj;
          p2.subjectiveItems = candP2Subj;
        }
      }
    }
  }

  // Re-index pages, recalculate utilization, and assign continuous serial numbers 1..N across all pages!
  let serialCounter = 1;
  finalPages.forEach((pg, idx) => {
    pg.pageNumber = idx + 1;
    pg.capacityPx = idx === 0 ? PAGE1_CAPACITY : CONT_PAGE_CAPACITY;
    pg.objectiveItems.forEach((it) => {
      it.displayNo = serialCounter++;
    });
    pg.subjectiveItems.forEach((it) => {
      it.displayNo = serialCounter++;
    });
    pg.usedHeightPx =
      estimateItemsSectionHeight({
        items: pg.objectiveItems,
        isSubjective: false,
        fontSizePx,
        twoCol: twoColObjective,
        showWritingLines: false,
        includeBanner: pg.objectiveItems.length > 0,
        distinctSubjectCount,
      }) +
      estimateItemsSectionHeight({
        items: pg.subjectiveItems,
        isSubjective: true,
        fontSizePx,
        twoCol: twoColSubjective,
        showWritingLines,
        includeBanner: pg.subjectiveItems.length > 0,
        distinctSubjectCount,
      });
    pg.utilizationPct = Math.min(100, Math.round((pg.usedHeightPx / pg.capacityPx) * 100));
  });

  return { pages: finalPages, overflowItems: [] };
}

export function findAutoFitFontSize(params: {
  objectiveQuestions: EntranceTestQuestion[];
  subjectiveQuestions: EntranceTestQuestion[];
  twoColObjective?: boolean;
  twoColSubjective?: boolean;
  showWritingLines?: boolean;
  preferredFontSizePx?: number;
  cbseRulesOverheadPx?: number;
}): number {
  const start = Math.min(13.5, Math.max(5.5, params.preferredFontSizePx ?? 10.5));
  for (let fs = start; fs >= 5.5; fs = Math.round((fs - 0.5) * 10) / 10) {
    const res = packIntoPagesInternal({
      objectiveQuestions: params.objectiveQuestions,
      subjectiveQuestions: params.subjectiveQuestions,
      fontSizePx: fs,
      twoColObjective: params.twoColObjective ?? false,
      twoColSubjective: params.twoColSubjective ?? false,
      showWritingLines: params.showWritingLines ?? false,
      cbseRulesOverheadPx: params.cbseRulesOverheadPx ?? 0,
    });
    if (res.pages.length <= 2) return fs;
  }
  return start;
}

export function estimateCustomPaperLayout(
  input: Omit<
    CustomPaperBuildInput,
    "school" | "classLevel" | "paperTitle" | "durationMinutes" | "mode"
  > & {
    classLevel?: EntranceClassNumber;
    durationMinutes?: number;
  }
): CustomPaperLayoutSummary {
  const twoColObjective = input.twoColObjective ?? false;
  const twoColSubjective = input.twoColSubjective ?? false;
  const showWritingLines = input.showWritingLines ?? false;
  const fontSizePx = Math.min(14, Math.max(5.5, Number(input.fontSizePx || 10.0)));

  const resolvedCbseRules = resolveCbseBoardRules({
    classLevel: input.classLevel,
    cbseRulesMode: input.cbseRulesMode,
    customBoardRulesHi: input.customBoardRulesHi,
    customBoardRulesEn: input.customBoardRulesEn,
    objectiveQuestions: input.objectiveQuestions,
    subjectiveQuestions: input.subjectiveQuestions,
    subjectLabel: input.subjectLabel,
    totalPages: 4,
    totalQuestions: input.objectiveQuestions.length + input.subjectiveQuestions.length,
    durationMinutes: input.durationMinutes,
  });
  const cbseRulesOverheadPx = estimateCbseRulesBoxPx(resolvedCbseRules);

  const { pages, overflowItems } = packIntoPagesInternal({
    objectiveQuestions: input.objectiveQuestions,
    subjectiveQuestions: input.subjectiveQuestions,
    fontSizePx,
    twoColObjective,
    twoColSubjective,
    showWritingLines,
    hasInstructions: (input.generalInstructions?.length ?? 2) > 0,
    hasStudentStrip: input.showStudentStrip !== false,
    cbseRulesOverheadPx,
    manualPageOverrides: input.manualPageOverrides,
  });

  const fitsInTwoPages = pages.length <= 2;
  const autoFitFontSizePx = fitsInTwoPages
    ? fontSizePx
    : findAutoFitFontSize({
        objectiveQuestions: input.objectiveQuestions,
        subjectiveQuestions: input.subjectiveQuestions,
        twoColObjective,
        twoColSubjective,
        showWritingLines,
        preferredFontSizePx: fontSizePx,
        cbseRulesOverheadPx,
      });

  const objectiveMarks = input.objectiveQuestions.reduce((s, q) => s + Number(q.marks || 1), 0);
  const subjectiveMarks = input.subjectiveQuestions.reduce(
    (s, q) => s + Number(q.marks || (q.format === "LONG_ANSWER" ? 3 : 2)),
    0
  );

  const qPageCount = pages.length;
  return {
    fontSizePx,
    pages,
    questionPageCount: qPageCount,
    overflowItems,
    fitsInTwoPages,
    autoFitFontSizePx,
    totalMarks: objectiveMarks + subjectiveMarks,
    objectiveMarks,
    subjectiveMarks,
    answerKeyPageNumber: qPageCount + 1,
  };
}

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

function buildCustomQuestionPageHtml(params: {
  school: School;
  classLevel: EntranceClassNumber;
  paperTitle: string;
  examName?: string;
  sessionLabel?: string;
  subjectLabel?: string;
  schoolNameOverride?: string;
  schoolTaglineOverride?: string;
  schoolAddressOverride?: string;
  schoolContactOverride?: string;
  schoolSubHeaderOverride?: string;
  logoPosition?: "left" | "center";
  fullMarksDisplay: number;
  examDate?: string;
  paperCode?: string;
  generalInstructions: string[];
  cbseBoardRules?: ResolvedCbseBoardRules;
  showStudentStrip: boolean;
  paperTheme: PaperPrintTheme;
  durationMinutes: number;
  totalQuestionsCount: number;
  objectiveMarks: number;
  subjectiveMarks: number;
  sheet: CustomPaperSheetPlan;
  totalQuestionPages: number;
  fontSizePx: number;
  twoColObjective: boolean;
  twoColSubjective: boolean;
  showWritingLines: boolean;
  continuedObjFromPrevPage: boolean;
  continuedSubjFromPrevPage: boolean;
  distinctSubjectCount: number;
}): string {
  const {
    school,
    classLevel,
    paperTitle,
    examName,
    sessionLabel,
    subjectLabel,
    schoolNameOverride,
    schoolTaglineOverride,
    schoolAddressOverride,
    schoolContactOverride,
    schoolSubHeaderOverride,
    logoPosition = "left",
    fullMarksDisplay,
    examDate,
    paperCode,
    generalInstructions,
    cbseBoardRules,
    showStudentStrip,
    paperTheme,
    durationMinutes,
    objectiveMarks,
    subjectiveMarks,
    sheet,
    totalQuestionPages,
    fontSizePx,
    twoColObjective,
    twoColSubjective,
    showWritingLines,
    continuedObjFromPrevPage,
    continuedSubjFromPrevPage,
    distinctSubjectCount,
  } = params;

  const masthead = resolveExamPaperMasthead(school, {
    schoolNameOverride,
    schoolTaglineOverride,
    schoolAddressOverride,
    schoolContactOverride,
    schoolSubHeaderOverride,
  });
  const schoolName = masthead.schoolName;
  const displayExamName = (examName || paperTitle || "Academic Assessment").trim();
  const displaySession = (sessionLabel || "2026-27").trim();
  const displaySubject = (
    subjectLabel && subjectLabel.trim()
      ? subjectLabel.trim()
      : distinctSubjectCount === 1 && sheet.objectiveItems[0]?.q.subject
      ? sheet.objectiveItems[0].q.subject
      : distinctSubjectCount === 1 && sheet.subjectiveItems[0]?.q.subject
      ? sheet.subjectiveItems[0].q.subject
      : "All Subjects (Combined)"
  ).trim();
  const displayTime = formatDurationDisplay(durationMinutes);
  const logoClass =
    paperTheme === "classic_bw" ? "qp-logo qp-logo-mono" : "qp-logo";
  const logoHtml = masthead.logoUrl
    ? `<img src="${escapeHtml(masthead.logoUrl)}" alt="" class="${logoClass}" onerror="this.style.display='none'" />`
    : "";

  const centerTextBlockHtml = `
    ${logoPosition === "center" && logoHtml ? `<div class="qp-logo-center-wrap">${logoHtml}</div>` : ""}
    <div class="qp-school-name">${escapeHtml(masthead.schoolName)}</div>
    ${masthead.tagline ? `<div class="qp-school-tagline">${escapeHtml(masthead.tagline)}</div>` : ""}
    ${masthead.address ? `<div class="qp-school-address">${escapeHtml(masthead.address)}</div>` : ""}
    ${masthead.contactLine ? `<div class="qp-school-contact">${escapeHtml(masthead.contactLine)}</div>` : ""}
    <div class="qp-exam-banner-wrap">
      <span class="qp-exam-banner">${escapeHtml(displayExamName.toUpperCase())}${
        displaySession ? ` &bull; SESSION ${escapeHtml(displaySession)}` : ""
      }</span>
    </div>
  `;

  const headerHtml =
    sheet.pageNumber === 1
      ? `
        <div class="qp-masthead ${paperTheme === "heritage_navy" ? "qp-masthead-navy" : ""}">
          <table class="qp-tbl qp-masthead-top-tbl">
            <tr>
              <td style="width:62px;vertical-align:middle;text-align:left;">
                ${logoPosition === "left" ? logoHtml : ""}
              </td>
              <td style="vertical-align:middle;text-align:center;">
                ${centerTextBlockHtml}
              </td>
              <td style="width:62px;vertical-align:middle;text-align:right;">
                ${
                  paperCode
                    ? `<div class="qp-code-box"><span>CODE</span><strong>${escapeHtml(paperCode)}</strong></div>`
                    : ""
                }
              </td>
            </tr>
          </table>

          <table class="qp-tbl qp-meta-tbl">
            <tr>
              <td style="text-align:left;"><strong>Class:</strong> ${escapeHtml(formatEntranceClassLabel(classLevel))}</td>
              <td style="text-align:center;"><strong>Subject:</strong> ${escapeHtml(displaySubject)}</td>
              ${examDate ? `<td style="text-align:center;"><strong>Date:</strong> ${escapeHtml(examDate)}</td>` : ""}
              <td style="text-align:center;"><strong>Time:</strong> ${escapeHtml(displayTime)}</td>
              <td style="text-align:right;"><strong>F.M.:</strong> ${fullMarksDisplay}</td>
            </tr>
          </table>

          ${
            showStudentStrip
              ? `
            <table class="qp-tbl qp-student-tbl">
              <tr>
                <td style="width:39%;padding-right:10px;vertical-align:middle;">
                  <table class="qp-tbl"><tr>
                    <td style="width:36px;font-weight:700;white-space:nowrap;vertical-align:bottom;">Name:</td>
                    <td class="qp-dotted-fill"></td>
                  </tr></table>
                </td>
                <td style="width:22%;padding-right:10px;vertical-align:middle;">
                  <table class="qp-tbl"><tr>
                    <td style="width:46px;font-weight:700;white-space:nowrap;vertical-align:bottom;">Roll No.:</td>
                    <td class="qp-dotted-fill"></td>
                  </tr></table>
                </td>
                <td style="width:13%;padding-right:10px;vertical-align:middle;">
                  <table class="qp-tbl"><tr>
                    <td style="width:26px;font-weight:700;white-space:nowrap;vertical-align:bottom;">Sec:</td>
                    <td class="qp-dotted-fill"></td>
                  </tr></table>
                </td>
                <td style="width:26%;vertical-align:middle;text-align:right;">
                  <div class="qp-marks-obt">${
                    classLevel <= 0
                      ? `Marks Obt.: _____ / ${fullMarksDisplay}`
                      : `Invigilator Sign: __________`
                  }</div>
                </td>
              </tr>
            </table>
          `
              : ""
          }

          ${
            cbseBoardRules && cbseBoardRules.layout !== "none"
              ? cbseBoardRules.layout === "bilingual"
                ? `
            <div class="qp-cbse-rules-box">
              <table class="qp-tbl qp-cbse-rules-tbl">
                <tr>
                  <td class="qp-cbse-rules-col qp-cbse-rules-col-left">
                    <ul class="qp-cbse-rules-list">
                      ${cbseBoardRules.hi
                        .map((rule) => `<li>${escapeHtml(rule)}</li>`)
                        .join("")}
                    </ul>
                  </td>
                  <td class="qp-cbse-rules-col qp-cbse-rules-col-right">
                    <ul class="qp-cbse-rules-list">
                      ${cbseBoardRules.en
                        .map((rule) => `<li>${escapeHtml(rule)}</li>`)
                        .join("")}
                    </ul>
                  </td>
                </tr>
              </table>
            </div>
          `
                : `
            <div class="qp-cbse-rules-box">
              <ul class="qp-cbse-rules-list">
                ${(cbseBoardRules.hi.length > 0 ? cbseBoardRules.hi : cbseBoardRules.en)
                  .map((rule) => `<li>${escapeHtml(rule)}</li>`)
                  .join("")}
              </ul>
            </div>
          `
              : ""
          }

          ${
            generalInstructions.length > 0
              ? `
            <div class="qp-instructions">
              <strong>General Instructions:</strong>
              <span>${generalInstructions.map((line, i) => `(${i + 1}) ${escapeHtml(sanitizePaperText(line))}`).join(" &nbsp; ")}</span>
            </div>
          `
              : ""
          }
        </div>
      `
      : `
        <table class="qp-tbl qp-cont-header-tbl">
          <tr>
            <td style="width:28%;text-align:left;" class="qp-cont-school">${escapeHtml(schoolName)}</td>
            <td style="width:52%;text-align:center;">${escapeHtml(displayExamName)} (${escapeHtml(displaySession)}) &middot; ${escapeHtml(formatEntranceClassLabel(classLevel))} &middot; ${escapeHtml(displaySubject)}</td>
            <td style="width:20%;text-align:right;">Page ${sheet.pageNumber} of ${totalQuestionPages}</td>
          </tr>
        </table>
      `;

  const svgTickBox = `<svg width="9" height="9" viewBox="0 0 10 10" style="display:inline-block;vertical-align:-1px;margin:0 4px 0 3px;"><rect x="0.8" y="0.8" width="8.4" height="8.4" fill="#ffffff" stroke="#334155" stroke-width="1.2"/></svg>`;

  const renderObjectiveItem = (item: CustomNumberedItem) => {
    const q = item.q;
    const cleanQuestion = sanitizePaperText(q.question);
    const cleanPassage = q.passage ? sanitizePaperText(q.passage) : "";
    const optLettersLower = ["a", "b", "c", "d"] as const;
    const cleanOpts = q.options.map((o) => sanitizePaperText(o));
    const maxOptLen = Math.max(...cleanOpts.map((o) => o.length), 0);
    const fourColThreshold = fontSizePx <= 10.5 ? 20 : 15;
    const fourColOpts = !twoColObjective && maxOptLen <= fourColThreshold;
    const singleColOpts = maxOptLen > (twoColObjective ? 20 : 36);

    const optCellHtml = (opt: string, oi: number) =>
      `<span class="qp-opt-key">(${optLettersLower[oi]})</span>${
        classLevel <= 0 ? svgTickBox : " "
      }${escapeHtml(opt)}`;

    const optsHtml = fourColOpts
      ? `<table class="qp-tbl qp-opt-tbl">
          <tr>
            ${cleanOpts
              .map(
                (opt, oi) =>
                  `<td class="qp-opt-td" style="width:25%;padding-right:6px;">${optCellHtml(opt, oi)}</td>`
              )
              .join("")}
          </tr>
        </table>`
      : singleColOpts
      ? `<table class="qp-tbl qp-opt-tbl">
          ${cleanOpts
            .map((opt, oi) => `<tr><td class="qp-opt-td">${optCellHtml(opt, oi)}</td></tr>`)
            .join("")}
        </table>`
      : `<table class="qp-tbl qp-opt-tbl">
          <tr>
            <td class="qp-opt-td" style="width:50%;padding-right:8px;">${
              cleanOpts[0] !== undefined ? optCellHtml(cleanOpts[0], 0) : ""
            }</td>
            <td class="qp-opt-td" style="width:50%;">${
              cleanOpts[1] !== undefined ? optCellHtml(cleanOpts[1], 1) : ""
            }</td>
          </tr>
          <tr>
            <td class="qp-opt-td" style="width:50%;padding-right:8px;">${
              cleanOpts[2] !== undefined ? optCellHtml(cleanOpts[2], 2) : ""
            }</td>
            <td class="qp-opt-td" style="width:50%;">${
              cleanOpts[3] !== undefined ? optCellHtml(cleanOpts[3], 3) : ""
            }</td>
          </tr>
        </table>`;

    return `
      <table class="qp-tbl qp-item-tbl">
        <tr>
          <td class="qp-q-num">${item.displayNo}.</td>
          <td class="qp-q-body">
            ${cleanPassage ? `<div class="qp-passage"><em>Read carefully:</em> ${escapeHtmlMultiline(cleanPassage)}</div>` : ""}
            <div class="qp-q-prompt">${escapeHtmlMultiline(cleanQuestion)}</div>
            ${optsHtml}
          </td>
          <td class="qp-q-marks">[${item.marks}]</td>
        </tr>
      </table>
    `;
  };

  const renderSubjectiveItem = (item: CustomNumberedItem) => {
    const q = item.q;
    const cleanQuestion = sanitizePaperText(q.question);
    const cleanPassage = q.passage ? sanitizePaperText(q.passage) : "";
    const cleanOrQ = q.orQuestion ? sanitizePaperText(q.orQuestion) : "";
    const cleanOrPassage = q.orPassage ? sanitizePaperText(q.orPassage) : "";
    const lineCount = getSubjectiveWritingLineCount(q, item.marks, showWritingLines);
    const linesHtml =
      lineCount > 0
        ? `<div class="qp-ans-lines">
            ${Array.from({ length: lineCount })
              .map((_, li) =>
                li === 0
                  ? `<div class="qp-ans-line qp-ans-line-first"><span class="qp-ans-prefix">Ans.</span></div>`
                  : `<div class="qp-ans-line"></div>`
              )
              .join("")}
          </div>`
        : "";
    return `
      <table class="qp-tbl qp-item-tbl qp-subj-item-tbl">
        <tr>
          <td class="qp-q-num">${item.displayNo}.</td>
          <td class="qp-q-body">
            ${cleanPassage ? `<div class="qp-passage"><em>Read carefully:</em> ${escapeHtmlMultiline(cleanPassage)}</div>` : ""}
            <div class="qp-q-prompt">${escapeHtmlMultiline(cleanQuestion)}</div>
            ${
              cleanOrQ
                ? `<div class="qp-or-sep"><span>OR / अथवा</span></div>
                   ${cleanOrPassage ? `<div class="qp-passage"><em>Read carefully:</em> ${escapeHtmlMultiline(cleanOrPassage)}</div>` : ""}
                   <div class="qp-q-prompt">${escapeHtmlMultiline(cleanOrQ)}</div>`
                : ""
            }
            ${linesHtml}
          </td>
          <td class="qp-q-marks">[${item.marks}]</td>
        </tr>
      </table>
    `;
  };

  const renderItemsGridTable = (
    items: CustomNumberedItem[],
    twoCol: boolean,
    renderer: (item: CustomNumberedItem) => string
  ) => {
    if (!twoCol) {
      return items.map((it) => `<div class="qp-row-1col">${renderer(it)}</div>`).join("");
    }
    const rows: string[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i];
      const right = items[i + 1];
      rows.push(`
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:10px;padding-bottom:4px;">
            ${left ? renderer(left) : ""}
          </td>
          <td style="width:50%;vertical-align:top;padding-left:6px;padding-bottom:4px;">
            ${right ? renderer(right) : ""}
          </td>
        </tr>
      `);
    }
    return `<table class="qp-tbl qp-grid-tbl">${rows.join("")}</table>`;
  };

  const renderGroupedSection = (
    items: CustomNumberedItem[],
    twoCol: boolean,
    renderer: (item: CustomNumberedItem) => string
  ) => {
    const groups = groupConsecutiveByHeading(items, distinctSubjectCount);
    const hasAnyHeading = groups.some((g) => Boolean(g.subject));
    if (!hasAnyHeading) {
      return renderItemsGridTable(items, twoCol, renderer);
    }
    return groups
      .map(
        (grp) => `
          <div class="qp-subj-group">
            ${grp.subject ? `<div class="qp-subj-heading">${escapeHtml(grp.subject.toUpperCase())}</div>` : ""}
            ${renderItemsGridTable(grp.items, twoCol, renderer)}
          </div>
        `
      )
      .join("");
  };

  const secAHtml =
    sheet.objectiveItems.length > 0
      ? `
        <div class="qp-sec-wrap">
          <table class="qp-tbl qp-sec-header-tbl ${paperTheme === "heritage_navy" ? "qp-sec-header-navy" : ""}">
            <tr>
              <td style="text-align:left;">SECTION &ndash; A : OBJECTIVE TYPE QUESTIONS${continuedObjFromPrevPage ? " (Continued)" : ""}</td>
              <td style="text-align:right;white-space:nowrap;">${continuedObjFromPrevPage ? "[Continued]" : `[${objectiveMarks} Marks]`}</td>
            </tr>
          </table>
          ${renderGroupedSection(sheet.objectiveItems, twoColObjective, renderObjectiveItem)}
        </div>
      `
      : "";

  const secBHtml =
    sheet.subjectiveItems.length > 0
      ? `
        <div class="qp-sec-wrap">
          <table class="qp-tbl qp-sec-header-tbl ${paperTheme === "heritage_navy" ? "qp-sec-header-navy" : ""}">
            <tr>
              <td style="text-align:left;">SECTION &ndash; B : SUBJECTIVE TYPE (SHORT &amp; LONG ANSWER)${continuedSubjFromPrevPage ? " (Continued)" : ""}</td>
              <td style="text-align:right;white-space:nowrap;">${continuedSubjFromPrevPage ? "[Continued]" : `[${subjectiveMarks} Marks]`}</td>
            </tr>
          </table>
          ${renderGroupedSection(sheet.subjectiveItems, twoColSubjective, renderSubjectiveItem)}
        </div>
      `
      : "";

  const isLastQPage = sheet.pageNumber === totalQuestionPages;

  return `
    <div class="exam-sheet qp-sheet" style="--qfs:${fontSizePx}px;">
      <table class="qp-tbl qp-page-frame-tbl">
        <tr>
          <td class="qp-frame-top-cell">
            ${headerHtml}
            <div class="qp-body">
              ${secAHtml}
              ${secBHtml}
            </div>
          </td>
        </tr>
        <tr>
          <td class="qp-frame-foot-cell">
            <table class="qp-tbl qp-footer-tbl">
              <tr>
                <td style="text-align:left;"><strong>${escapeHtml(schoolName)}</strong> &middot; ${escapeHtml(formatEntranceClassLabel(classLevel))} (${escapeHtml(displayExamName)})</td>
                <td style="text-align:right;">${isLastQPage ? "*** Best of Luck ***  |  " : "P.T.O.  |  "}Page ${sheet.pageNumber} of ${totalQuestionPages}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildCustomAnswerKeyPagesHtml(params: {
  school: School;
  classLevel: EntranceClassNumber;
  examName: string;
  sessionLabel: string;
  fullMarksDisplay: number;
  objectiveQuestions: EntranceTestQuestion[];
  subjectiveQuestions: EntranceTestQuestion[];
  orderedObjectiveItems?: CustomNumberedItem[];
  orderedSubjectiveItems?: CustomNumberedItem[];
  startPageNumber: number;
}): string[] {
  const {
    school,
    classLevel,
    examName,
    sessionLabel,
    fullMarksDisplay,
    objectiveQuestions,
    subjectiveQuestions,
    orderedObjectiveItems,
    orderedSubjectiveItems,
    startPageNumber,
  } = params;
  const schoolName = resolveExamPaperMasthead(school).schoolName;
  const indexedObj = orderedObjectiveItems
    ? orderedObjectiveItems.map((it) => ({ q: it.q, qNo: it.displayNo }))
    : objectiveQuestions.map((q, idx) => ({ q, qNo: idx + 1 }));
  const objOffset = indexedObj.length;

  // Paginate subjective model answers cleanly so Key Page 1 never overflows when MCQs are numerous
  const MAX_SUBJ_PER_FIRST_KEY_PAGE =
    indexedObj.length >= 16
      ? 0
      : indexedObj.length > 0
      ? Math.max(4, 14 - Math.ceil(indexedObj.length * 0.6))
      : 14;
  const MAX_SUBJ_PER_CONT_KEY_PAGE = 14;

  const subjChunks: Array<Array<{ q: EntranceTestQuestion; qNo: number }>> = [];
  const indexedSubj = orderedSubjectiveItems
    ? orderedSubjectiveItems.map((it) => ({ q: it.q, qNo: it.displayNo }))
    : subjectiveQuestions.map((q, idx) => ({ q, qNo: objOffset + idx + 1 }));
  if (indexedSubj.length > 0) {
    if (MAX_SUBJ_PER_FIRST_KEY_PAGE > 0) {
      subjChunks.push(indexedSubj.slice(0, MAX_SUBJ_PER_FIRST_KEY_PAGE));
    } else if (indexedObj.length > 0) {
      subjChunks.push([]);
    }
    let cursor = MAX_SUBJ_PER_FIRST_KEY_PAGE;
    while (cursor < indexedSubj.length) {
      subjChunks.push(indexedSubj.slice(cursor, cursor + MAX_SUBJ_PER_CONT_KEY_PAGE));
      cursor += MAX_SUBJ_PER_CONT_KEY_PAGE;
    }
  } else {
    subjChunks.push([]);
  }

  const totalKeyPages = subjChunks.length;
  const pagesHtml: string[] = [];

  for (let kIdx = 0; kIdx < totalKeyPages; kIdx++) {
    const pageNo = startPageNumber + kIdx;
    const isFirstKeyPage = kIdx === 0;
    const subjSlice = subjChunks[kIdx];

    const objTableHtml =
      isFirstKeyPage && indexedObj.length > 0
        ? `
          <div class="ak-block">
            <div class="ak-heading">PART A &mdash; OBJECTIVE ANSWER KEY (${indexedObj.length} Questions &bull; 1 Mark Each)</div>
            <table class="ak-table">
              <thead>
                <tr>
                  <th style="width:44px;text-align:center;">Q.No</th>
                  <th style="width:90px;">Subject</th>
                  <th style="width:42px;text-align:center;">Ans</th>
                  <th style="width:170px;">Correct Option</th>
                  <th>Explanation / Key Hint</th>
                </tr>
              </thead>
              <tbody>
                ${indexedObj
                  .map(({ q, qNo }) => {
                    const letter = ["a", "b", "c", "d"][q.correctIndex] || "a";
                    const optText = sanitizePaperText(q.options[q.correctIndex] || "");
                    const expText = sanitizePaperText(q.explanation || "");
                    return `
                      <tr>
                        <td style="font-weight:800;text-align:center;">Q.${qNo}</td>
                        <td style="font-weight:600;color:#334155;">${escapeHtml(q.subject)}</td>
                        <td style="text-align:center;"><span class="ak-opt-badge">(${letter})</span></td>
                        <td style="font-weight:700;color:#0f172a;">${escapeHtml(optText)}</td>
                        <td>${escapeHtml(expText)}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : "";

    const subjTableHtml =
      subjSlice.length > 0
        ? `
          <div class="ak-block" style="margin-top:${isFirstKeyPage && objectiveQuestions.length > 0 ? "12px" : "0"};">
            <div class="ak-heading">PART B &mdash; SUBJECTIVE MARKING SCHEME &amp; MODEL ANSWERS${kIdx > 0 ? " (Continued)" : ""}</div>
            <table class="ak-table">
              <thead>
                <tr>
                  <th style="width:44px;text-align:center;">Q.No</th>
                  <th style="width:86px;">Subject</th>
                  <th style="width:225px;">Question</th>
                  <th>Model Answer / Marking Value Points</th>
                  <th style="width:44px;text-align:center;">Marks</th>
                </tr>
              </thead>
              <tbody>
                ${subjSlice
                  .map(({ q, qNo }) => {
                    const m = Number(q.marks || (q.format === "LONG_ANSWER" ? 3 : 2));
                    const ans = sanitizePaperText(
                      q.modelAnswer || q.explanation || "Evaluate on key concept & clarity."
                    );
                    const orQText = q.orQuestion ? sanitizePaperText(q.orQuestion) : "";
                    const orAnsText = q.orModelAnswer
                      ? sanitizePaperText(q.orModelAnswer)
                      : "Evaluate alternative option on key concept accuracy.";
                    return `
                      <tr>
                        <td style="font-weight:800;text-align:center;">Q.${qNo}</td>
                        <td style="font-weight:600;color:#334155;">${escapeHtml(q.subject)}</td>
                        <td style="color:#1e293b;">
                          <div>${escapeHtml(sanitizePaperText(q.question))}</div>
                          ${
                            orQText
                              ? `<div style="margin-top:4px;padding-top:3px;border-top:1px dashed #cbd5e1;color:#334155;"><strong>[OR]:</strong> ${escapeHtml(orQText)}</div>`
                              : ""
                          }
                        </td>
                        <td style="color:#065f46;font-weight:600;">
                          <div>${escapeHtml(ans)}</div>
                          ${
                            orQText
                              ? `<div style="margin-top:4px;padding-top:3px;border-top:1px dashed #cbd5e1;color:#047857;"><strong>[OR Ans]:</strong> ${escapeHtml(orAnsText)}</div>`
                              : ""
                          }
                        </td>
                        <td style="text-align:center;font-weight:800;">[${m}]</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        : "";

    pagesHtml.push(`
      <div class="exam-sheet qp-sheet ak-sheet">
        <table class="qp-tbl qp-page-frame-tbl">
          <tr>
            <td class="qp-frame-top-cell">
              <table class="qp-tbl ak-masthead-tbl">
                <tr>
                  <td style="text-align:left;vertical-align:middle;">
                    <div class="ak-school">${escapeHtml(schoolName)}</div>
                    <div class="ak-title">OFFICIAL ANSWER KEY &amp; MARKING SCHEME &bull; ${escapeHtml(formatEntranceClassLabel(classLevel).toUpperCase())}</div>
                  </td>
                  <td style="text-align:right;vertical-align:middle;" class="ak-meta">
                    <div><strong>${escapeHtml(examName)}</strong> (${escapeHtml(sessionLabel)})</div>
                    <div>F.M.: ${fullMarksDisplay} Marks &bull; Key Page ${pageNo}</div>
                  </td>
                </tr>
              </table>
              <div class="qp-body">
                ${objTableHtml}
                ${subjTableHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td class="qp-frame-foot-cell">
              <table class="qp-tbl qp-footer-tbl">
                <tr>
                  <td style="text-align:left;"><strong>${escapeHtml(schoolName)}</strong> &middot; Confidential Examiner Copy</td>
                  <td style="text-align:right;">Page ${pageNo} &middot; ${escapeHtml(formatEntranceClassLabel(classLevel))}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `);
  }

  return pagesHtml;
}

const CUSTOM_PDF_EXTRA_CSS = `
  .qp-tbl {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .qp-sheet {
    width: 794px;
    height: 1122px;
    min-height: 1122px;
    padding: 16px 22px 16px 22px;
    background: #ffffff;
    color: #0f172a;
    font-family: Georgia, 'Times New Roman', 'Noto Sans Devanagari', serif;
  }
  .qp-page-frame-tbl {
    width: 100%;
    height: 1088px;
    border: 1.5px solid #1e293b;
  }
  .qp-frame-top-cell {
    vertical-align: top;
    padding: 10px 14px 4px 14px;
  }
  .qp-frame-foot-cell {
    vertical-align: bottom;
    height: 24px;
    padding: 3px 14px 7px 14px;
  }
  .qp-body {
    width: 100%;
  }
  .qp-masthead {
    border-bottom: 2px double #0f172a;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .qp-masthead-navy {
    border-bottom: 2px solid #0f294a;
  }
  .qp-masthead-top-tbl td {
    padding: 0;
  }
  .qp-logo {
    width: 52px;
    height: 52px;
    object-fit: contain;
    display: block;
  }
  .qp-logo-mono {
    filter: grayscale(100%) contrast(1.28) brightness(0.95);
  }
  .qp-logo-center-wrap {
    margin-bottom: 3px;
  }
  .qp-logo-center-wrap .qp-logo {
    margin: 0 auto;
    width: 44px;
    height: 44px;
  }
  .qp-school-name {
    font-family: Georgia, 'Times New Roman', 'Noto Sans Devanagari', serif;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #0f172a;
    line-height: 1.2;
  }
  .qp-masthead-navy .qp-school-name {
    color: #0f294a;
  }
  .qp-school-tagline {
    font-family: Georgia, 'Times New Roman', 'Noto Sans Devanagari', serif;
    font-size: 9.8px;
    font-weight: 700;
    font-style: italic;
    color: #1e293b;
    margin-top: 2px;
    line-height: 1.25;
  }
  .qp-school-address {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 8.8px;
    font-weight: 600;
    color: #334155;
    margin-top: 2px;
    line-height: 1.3;
  }
  .qp-school-contact {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 8.5px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 1.5px;
    line-height: 1.3;
  }
  .qp-school-sub {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 8.5px;
    color: #475569;
    margin-top: 2px;
    line-height: 1.3;
  }
  .qp-exam-banner-wrap {
    margin-top: 5px;
  }
  .qp-exam-banner {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.55px;
    color: #0f172a;
    background: #f8fafc;
    border: 1px solid #64748b;
    padding: 4px 12px;
    display: inline-block;
    line-height: 1.35;
  }
  .qp-masthead-navy .qp-exam-banner {
    background: #0f294a;
    color: #ffffff;
    border-color: #0f294a;
  }
  .qp-code-box {
    border: 1.2px solid #0f172a;
    padding: 4px 6px;
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8px;
    line-height: 1.3;
    display: inline-block;
  }
  .qp-code-box span { display: block; color: #475569; font-weight: 700; }
  .qp-code-box strong { font-size: 10px; color: #0f172a; }
  .qp-meta-tbl {
    margin-top: 7px;
    border-top: 1px solid #94a3b8;
    border-bottom: 1px solid #94a3b8;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 9.5px;
    color: #0f172a;
  }
  .qp-meta-tbl td {
    padding: 5px 2px;
    vertical-align: middle;
    line-height: 1.35;
  }
  .qp-student-tbl {
    margin-top: 6px;
    border: 1px solid #94a3b8;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 9px;
    color: #0f172a;
  }
  .qp-student-tbl > tbody > tr > td,
  .qp-student-tbl > tr > td {
    padding: 5px 7px;
  }
  .qp-dotted-fill {
    border-bottom: 1px dotted #475569;
    height: 12px;
  }
  .qp-marks-obt {
    border: 1.2px solid #0f172a;
    padding: 4px 8px;
    font-weight: 800;
    font-size: 8.5px;
    line-height: 1.35;
    display: inline-block;
    white-space: nowrap;
    background: #f8fafc;
  }
  .qp-cbse-rules-box {
    margin-top: 5px;
    border: 1px solid #475569;
    background: #fafbfc;
    padding: 4px 7px;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 7.5px;
    color: #0f172a;
    line-height: 1.28;
  }
  .qp-cbse-rules-tbl {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .qp-cbse-rules-col {
    width: 50%;
    vertical-align: top;
  }
  .qp-cbse-rules-col-left {
    padding-right: 7px;
    border-right: 1px solid #cbd5e1;
  }
  .qp-cbse-rules-col-right {
    padding-left: 7px;
  }
  .qp-cbse-rules-list {
    margin: 0;
    padding-left: 11px;
    list-style-type: disc;
  }
  .qp-cbse-rules-list li {
    margin-bottom: 1.5px;
  }
  .qp-cbse-rules-list li:last-child {
    margin-bottom: 0;
  }
  .qp-instructions {
    margin-top: 5px;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 8.3px;
    color: #334155;
    line-height: 1.4;
  }
  .qp-cont-header-tbl {
    border-bottom: 1.5px double #0f172a;
    margin-bottom: 8px;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 9px;
    font-weight: 700;
    color: #1e293b;
  }
  .qp-cont-header-tbl td {
    padding: 2px 0 6px 0;
    vertical-align: middle;
    line-height: 1.35;
  }
  .qp-cont-school {
    font-weight: 800;
    text-transform: uppercase;
    color: #0f172a;
  }
  .qp-sec-wrap {
    margin-bottom: 5px;
  }
  .qp-sec-header-tbl {
    border-top: 1.4px solid #0f172a;
    border-bottom: 1.4px solid #0f172a;
    background: #f1f5f9;
    color: #0f172a;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.35px;
    margin: 3px 0 5px 0;
  }
  .qp-sec-header-tbl td {
    padding: 3.5px 8px;
    vertical-align: middle;
    line-height: 1.3;
  }
  .qp-sec-header-navy {
    background: #0f294a;
    border-color: #0f294a;
    color: #ffffff;
  }
  .qp-subj-group {
    margin-bottom: 4px;
  }
  .qp-subj-heading {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 8.8px;
    font-weight: 800;
    letter-spacing: 0.45px;
    color: #0f172a;
    border-bottom: 1px solid #94a3b8;
    padding: 1px 0 2px 0;
    margin: 2px 0 3.5px 0;
    line-height: 1.25;
  }
  .qp-grid-tbl td {
    vertical-align: top;
  }
  .qp-row-1col {
    margin-bottom: 3px;
  }
  .qp-item-tbl {
    font-family: Georgia, 'Times New Roman', 'Noto Sans Devanagari', serif;
    font-size: var(--qfs, 10px);
    line-height: 1.36;
    break-inside: avoid;
  }
  .qp-subj-item-tbl {
    margin-bottom: 4px;
  }
  .qp-q-num {
    width: 24px;
    font-weight: 800;
    color: #0f172a;
    vertical-align: top;
    padding-top: 1px;
  }
  .qp-q-body {
    vertical-align: top;
    padding-right: 4px;
  }
  .qp-q-marks {
    width: 34px;
    text-align: right;
    vertical-align: top;
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 800;
    font-size: calc(var(--qfs, 10px) * 0.88);
    color: #0f172a;
    white-space: nowrap;
    padding-top: 1px;
  }
  .qp-passage {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: calc(var(--qfs, 10px) * 0.88);
    color: #334155;
    border-left: 2px solid #94a3b8;
    padding-left: 6px;
    margin-bottom: 3px;
  }
  .qp-q-prompt {
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 2.5px;
    line-height: 1.36;
  }
  .qp-opt-tbl {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: calc(var(--qfs, 10px) * 0.92);
    color: #1e293b;
    line-height: 1.34;
  }
  .qp-opt-td {
    padding: 1.25px 0;
    vertical-align: middle;
  }
  .qp-opt-key {
    font-weight: 700;
    color: #0f172a;
  }
  .qp-or-sep {
    text-align: center;
    margin: 3px 0;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: calc(var(--qfs, 10px) * 0.82);
    font-weight: 800;
    letter-spacing: 0.55px;
    color: #0f172a;
  }
  .qp-or-sep span {
    display: inline-block;
    padding: 0 8px;
    border-top: 1px dashed #94a3b8;
    border-bottom: 1px dashed #94a3b8;
    background: #f8fafc;
  }
  .qp-ans-lines {
    margin-top: 4px;
  }
  .qp-ans-line {
    border-bottom: 1px dashed #64748b;
    height: 22px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5px;
    color: #334155;
  }
  .qp-ans-line-first {
    padding-top: 7px;
    line-height: 1.1;
  }
  .qp-ans-prefix {
    font-weight: 700;
    font-style: italic;
    background: #ffffff;
    padding-right: 5px;
  }
  .qp-footer-tbl {
    border-top: 1px solid #94a3b8;
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 8.5px;
    color: #334155;
  }
  .qp-footer-tbl td {
    padding-top: 6px;
    vertical-align: middle;
    line-height: 1.35;
  }
  .ak-sheet {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
  }
  .ak-masthead-tbl {
    border-bottom: 2px double #0f172a;
    margin-bottom: 10px;
  }
  .ak-masthead-tbl td {
    padding-bottom: 7px;
  }
  .ak-school {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    color: #0f172a;
    line-height: 1.3;
  }
  .ak-title {
    font-size: 10px;
    font-weight: 800;
    color: #334155;
    margin-top: 2px;
    line-height: 1.3;
  }
  .ak-meta {
    font-size: 8.8px;
    color: #1e293b;
    line-height: 1.4;
  }
  .ak-heading {
    font-size: 9px;
    font-weight: 800;
    color: #0f172a;
    background: #f1f5f9;
    border: 1px solid #94a3b8;
    padding: 5px 8px;
    margin-bottom: 6px;
    text-transform: uppercase;
    line-height: 1.35;
  }
  .ak-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5px;
  }
  .ak-table th {
    background: #f8fafc;
    color: #0f172a;
    font-weight: 800;
    text-align: left;
    padding: 5px 6px;
    border: 1px solid #94a3b8;
    line-height: 1.35;
    vertical-align: middle;
  }
  .ak-table td {
    padding: 5px 6px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
    line-height: 1.35;
    color: #1e293b;
  }
  .ak-opt-badge {
    display: inline-block;
    font-weight: 800;
    color: #0f172a;
  }
  .qp-rough-wrap {
    padding: 8px 6px 4px 6px;
    text-align: center;
  }
  .qp-rough-title {
    font-family: Arial, Helvetica, 'Segoe UI', 'Noto Sans Devanagari', sans-serif;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.6px;
    color: #334155;
    border-bottom: 1px dashed #94a3b8;
    padding-bottom: 5px;
    margin-bottom: 4px;
  }
  .qp-rough-sub {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5px;
    color: #64748b;
    margin-bottom: 10px;
  }
  .qp-rough-box {
    width: 100%;
    height: 920px;
    border: 1px dashed #cbd5e1;
    border-radius: 4px;
  }
  .booklet-sheet {
    width: 1122px;
    height: 794px;
    min-height: 794px;
    padding: 12px 12px;
    background: #ffffff;
    color: #0f172a;
    overflow: hidden;
  }
  .booklet-spread-tbl {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .booklet-half-cell {
    width: 538px;
    vertical-align: top;
    padding: 0;
  }
  .booklet-fold-gutter {
    width: 22px;
    vertical-align: middle;
    text-align: center;
    padding: 0;
    position: relative;
  }
  .booklet-fold-line {
    width: 0;
    height: 750px;
    margin: 0 auto;
    border-left: 1px dashed #94a3b8;
  }
  .booklet-cut-line {
    border-left: 1.2px dashed #64748b;
  }
  .booklet-cut-mark {
    position: absolute;
    top: 4px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 11px;
    line-height: 1;
    color: #64748b;
    background: #ffffff;
  }
  .booklet-slot {
    width: 538px;
    height: 766px;
    overflow: hidden;
    position: relative;
  }
  .booklet-slot-scaler {
    width: 794px;
    height: 1122px;
    transform: scale(0.668);
    transform-origin: top left;
  }
`;

function buildCustomPaperPagesHtml(input: CustomPaperBuildInput): {
  pagesHtml: string[];
  fullCss: string;
  docTitle: string;
  orientation: "portrait" | "landscape";
} {
  const {
    school,
    classLevel,
    paperTitle,
    examName,
    sessionLabel = "2026-27",
    subjectLabel,
    schoolNameOverride,
    schoolTaglineOverride,
    schoolAddressOverride,
    schoolContactOverride,
    schoolSubHeaderOverride,
    logoPosition = "left",
    fullMarksOverride,
    examDate,
    paperCode,
    generalInstructions = [
      "All questions are compulsory.",
      "Read every question carefully before answering.",
      "Marks are indicated against each question.",
    ],
    cbseRulesMode = "auto",
    customBoardRulesHi,
    customBoardRulesEn,
    printOrientation = "portrait",
    showStudentStrip = true,
    paperTheme = "classic_bw",
    durationMinutes,
    objectiveQuestions,
    subjectiveQuestions,
    fontSizePx,
    twoColObjective = false,
    twoColSubjective = false,
    showWritingLines: rawShowWritingLines,
    manualPageOverrides,
    mode = "full",
  } = input;

  // Answer writing lines on the question paper are strictly for Nursery (-2), LKG/KG-1 (-1), and UKG/KG-2 (0).
  // Class 1 to Class 10 always print clean Questions-Only papers.
  const showWritingLines = classLevel <= 0 ? (rawShowWritingLines ?? true) : false;

  if (objectiveQuestions.length === 0 && subjectiveQuestions.length === 0) {
    throw new Error("Please select at least one question before printing.");
  }

  const hasManualOverrides = Boolean(
    manualPageOverrides && Object.keys(manualPageOverrides).length > 0
  );

  let layout = estimateCustomPaperLayout({
    classLevel,
    durationMinutes,
    subjectLabel,
    objectiveQuestions,
    subjectiveQuestions,
    fontSizePx,
    twoColObjective,
    twoColSubjective,
    showWritingLines,
    generalInstructions,
    cbseRulesMode,
    customBoardRulesHi,
    customBoardRulesEn,
    showStudentStrip,
    manualPageOverrides,
  });

  // Only gently auto-fit onto 2 pages when no manual page overrides are active
  if (
    !hasManualOverrides &&
    layout.pages.length === 3 &&
    objectiveQuestions.length + subjectiveQuestions.length <= 22 &&
    layout.autoFitFontSizePx >= 8.5 &&
    layout.autoFitFontSizePx < layout.fontSizePx
  ) {
    layout = estimateCustomPaperLayout({
      classLevel,
      durationMinutes,
      subjectLabel,
      objectiveQuestions,
      subjectiveQuestions,
      fontSizePx: layout.autoFitFontSizePx,
      twoColObjective,
      twoColSubjective,
      showWritingLines,
      generalInstructions,
      cbseRulesMode,
      customBoardRulesHi,
      customBoardRulesEn,
      showStudentStrip,
    });
  }

  const fullMarksDisplay =
    fullMarksOverride && fullMarksOverride > 0 ? fullMarksOverride : layout.totalMarks;
  const distinctSubjects = new Set(
    [...objectiveQuestions, ...subjectiveQuestions].map((q) => String(q.subject || "").trim())
  );

  // Resolve final CBSE Board Rules with the EXACT computed totalQuestionPages & totalQuestionsCount!
  const finalCbseBoardRules = resolveCbseBoardRules({
    classLevel,
    cbseRulesMode,
    customBoardRulesHi,
    customBoardRulesEn,
    objectiveQuestions,
    subjectiveQuestions,
    subjectLabel,
    totalPages: layout.questionPageCount,
    totalQuestions: objectiveQuestions.length + subjectiveQuestions.length,
    durationMinutes,
  });

  const fullCss = `${SHARED_PDF_CSS}\n${CUSTOM_PDF_EXTRA_CSS}`;
  const pagesHtml: string[] = [];
  let seenObjEarlier = false;
  let seenSubjEarlier = false;

  for (let i = 0; i < layout.pages.length; i++) {
    const sheet = layout.pages[i];
    pagesHtml.push(
      buildCustomQuestionPageHtml({
        school,
        classLevel,
        paperTitle,
        examName,
        sessionLabel,
        subjectLabel,
        schoolNameOverride,
        schoolTaglineOverride,
        schoolAddressOverride,
        schoolContactOverride,
        schoolSubHeaderOverride,
        logoPosition,
        fullMarksDisplay,
        examDate,
        paperCode,
        generalInstructions,
        cbseBoardRules: i === 0 ? finalCbseBoardRules : undefined,
        showStudentStrip,
        paperTheme,
        durationMinutes,
        totalQuestionsCount: objectiveQuestions.length + subjectiveQuestions.length,
        objectiveMarks: layout.objectiveMarks,
        subjectiveMarks: layout.subjectiveMarks,
        sheet,
        totalQuestionPages: layout.questionPageCount,
        fontSizePx: layout.fontSizePx,
        twoColObjective,
        twoColSubjective,
        showWritingLines,
        continuedObjFromPrevPage: seenObjEarlier && sheet.objectiveItems.length > 0,
        continuedSubjFromPrevPage: seenSubjEarlier && sheet.subjectiveItems.length > 0,
        distinctSubjectCount: distinctSubjects.size,
      })
    );
    if (sheet.objectiveItems.length > 0) seenObjEarlier = true;
    if (sheet.subjectiveItems.length > 0) seenSubjEarlier = true;
  }

  const keyPagesHtml: string[] = [];
  if (mode === "full") {
    const orderedObjItems = layout.pages.flatMap((pg) => pg.objectiveItems);
    const orderedSubjItems = layout.pages.flatMap((pg) => pg.subjectiveItems);
    const keyPages = buildCustomAnswerKeyPagesHtml({
      school,
      classLevel,
      examName: examName || paperTitle,
      sessionLabel,
      fullMarksDisplay,
      objectiveQuestions,
      subjectiveQuestions,
      orderedObjectiveItems: orderedObjItems,
      orderedSubjectiveItems: orderedSubjItems,
      startPageNumber: layout.answerKeyPageNumber,
    });
    keyPagesHtml.push(...keyPages);
  }

  const isLandscapeBooklet = printOrientation === "landscape_booklet";
  const resolvedMasthead = resolveExamPaperMasthead(school, {
    schoolNameOverride,
    schoolTaglineOverride,
    schoolAddressOverride,
    schoolContactOverride,
    schoolSubHeaderOverride,
  });

  // In Landscape mode, ALWAYS impose student question pages separately from Examiner Answer Key
  // so 2-page papers get clean [P1|P1] + [P2|P2] sheets without Answer Key bleeding onto student copies!
  const finalOutputPagesHtml = isLandscapeBooklet
    ? [
        ...imposeLandscapeBookletSheets({
          logicalPagesHtml: pagesHtml,
          schoolName: resolvedMasthead.schoolName,
          examName: examName || paperTitle || "School Examination",
          sessionLabel,
          classLabel: formatEntranceClassLabel(classLevel),
        }),
        ...(keyPagesHtml.length > 0
          ? imposeLandscapeBookletSheets({
              logicalPagesHtml: keyPagesHtml,
              schoolName: resolvedMasthead.schoolName,
              examName: `${examName || paperTitle || "School Examination"} (Answer Key)`,
              sessionLabel,
              classLabel: formatEntranceClassLabel(classLevel),
            })
          : []),
      ]
    : [...pagesHtml, ...keyPagesHtml];

  const schoolName = schoolNameOverride || school?.name || "SCHOOL";
  const safeCode = (school?.code || schoolName)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 18);
  const safeExam = (examName || paperTitle || "ExamPaper")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  const bookletTag = isLandscapeBooklet ? "_Booklet" : "";
  const suffix =
    mode === "full"
      ? `${safeExam}${bookletTag}_With_Key`
      : `${safeExam}${bookletTag}_QuestionPaper`;
  const clsSlug = formatEntranceClassLabel(classLevel).replace(/\s+/g, "");

  return {
    pagesHtml: finalOutputPagesHtml,
    fullCss,
    docTitle: `${safeCode}_${clsSlug}_${suffix}`,
    orientation: isLandscapeBooklet ? "landscape" : "portrait",
  };
}

export function buildCustomPaperHtmlBundle(input: CustomPaperBuildInput): {
  pagesHtml: string[];
  fullCss: string;
  docTitle: string;
  orientation: "portrait" | "landscape";
} {
  return buildCustomPaperPagesHtml(input);
}

export function printCustomEntrancePaperA4(
  input: CustomPaperBuildInput
): { invoked: boolean; insideIframe: boolean } {
  const { pagesHtml, fullCss, docTitle, orientation } = buildCustomPaperPagesHtml(input);
  return mountAndPrintA4Sync(pagesHtml, fullCss, docTitle, orientation);
}

export async function downloadCustomEntrancePaperPdf(input: CustomPaperBuildInput): Promise<void> {
  const { pagesHtml, fullCss, docTitle, orientation } = buildCustomPaperPagesHtml(input);
  const isLandscape = orientation === "landscape";
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const a4W = isLandscape ? 297 : 210;
  const a4H = isLandscape ? 210 : 297;
  const captureWidthPx = isLandscape ? 1122 : 794;
  const captureHeightPx = isLandscape ? 794 : 1122;

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) pdf.addPage("a4", isLandscape ? "landscape" : "portrait");
    const canvas = await renderHtmlToCanvasSafe(pagesHtml[i], fullCss, {
      widthPx: captureWidthPx,
      heightPx: captureHeightPx,
      scale: 2.5,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/png");
    const ratio = canvas.height / Math.max(1, canvas.width);
    const rawHeightMm = a4W * ratio;
    const fitScale = rawHeightMm > a4H ? a4H / rawHeightMm : 1;
    const drawW = a4W * fitScale;
    const drawH = rawHeightMm * fitScale;
    const offsetX = (a4W - drawW) / 2;
    const offsetY = (a4H - drawH) / 2;
    pdf.addImage(imgData, "PNG", offsetX, offsetY, drawW, drawH, undefined, "FAST");
  }

  pdf.save(`${docTitle}.pdf`);
}

// ═════════════════════════════════════════════════════════════════════════════
// PRE-PRIMARY VISUAL SCREENING PDF (NURSERY / LKG / UKG · 20 SETS)
// - Page 1 & Page 2: Visual Kid-Friendly Activity Paper (Colour or B/W)
// - Page 3: Examiner Answer Key + Placement Rubric (Nursery / LKG / UKG)
// ═════════════════════════════════════════════════════════════════════════════

const PRE_PRIMARY_PDF_CSS = `
  .pp-sheet {
    padding: 13px 18px 16px 18px;
    font-size: var(--ppfs, 10.5px);
  }
  .pp-header {
    border: 2px solid #0f172a;
    border-radius: 7px;
    padding: 8px 12px;
    background: #f8fafc;
    margin-bottom: 8px;
  }
  .pp-placement-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    padding: 5px 8px;
    border: 1.5px dashed #334155;
    border-radius: 5px;
    background: #ffffff;
    font-size: 9px;
    font-weight: 700;
  }
  .pp-chk-box {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1.5px solid #0f172a;
    border-radius: 2px;
    vertical-align: middle;
    margin-right: 3px;
  }
  .pp-q-card {
    border: 1.5px solid #cbd5e1;
    border-radius: 7px;
    padding: 7px 10px;
    margin-bottom: 7px;
    background: #ffffff;
    break-inside: avoid;
  }
  .pp-q-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
  }
  .pp-q-title {
    font-size: var(--ppfs, 10.5px);
    font-weight: 800;
    color: #0f172a;
  }
  .pp-q-subhi {
    font-size: calc(var(--ppfs, 10.5px) * 0.88);
    font-weight: 600;
    color: #475569;
    margin-top: 1px;
  }
  .pp-q-meta {
    font-size: 8.5px;
    font-weight: 800;
    color: #0f172a;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
  }
  .pp-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding-top: 2px;
  }
  .pp-picture-box {
    border: 1.5px solid #0f172a;
    border-radius: 6px;
    padding: 6px 10px;
    background: #f8fafc;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pp-answer-box {
    width: 54px;
    height: 40px;
    border: 2px solid #0f172a;
    border-radius: 6px;
    background: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .pp-op-sign {
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
  }
  .pp-circle-opt {
    min-width: 66px;
    padding: 6px 12px;
    border: 1.5px dashed #94a3b8;
    border-radius: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: calc(var(--ppfs, 10.5px) * 1.25);
    font-weight: 800;
    color: #0f172a;
    background: #ffffff;
  }
  .pp-match-grid {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 20px;
    padding: 2px 16px;
  }
  .pp-match-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pp-match-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1.2px solid #cbd5e1;
    border-radius: 5px;
    padding: 4px 10px;
    background: #f8fafc;
    font-size: 9.5px;
    font-weight: 800;
  }
  .pp-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0f172a;
    display: inline-block;
  }
  .pp-seq-box {
    width: 44px;
    height: 40px;
    border: 1.8px solid #0f172a;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    background: #f8fafc;
  }
  .pp-seq-empty {
    background: #ffffff;
    border-style: dashed;
    border-width: 2px;
  }
  .pp-cmp-box {
    flex: 1;
    border: 1.5px solid #0f172a;
    border-radius: 6px;
    padding: 7px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8fafc;
    min-height: 54px;
  }
  .pp-word-pill {
    padding: 5px 10px;
    border: 1.5px solid #0f172a;
    border-radius: 5px;
    font-size: 14px;
    font-weight: 800;
    background: #f8fafc;
  }
  .pp-word-ans {
    min-width: 115px;
    height: 36px;
    border: 2px solid #0f172a;
    border-radius: 6px;
    background: #ffffff;
  }
`;

function renderPrePrimaryQuestionBodyHtml(q: PrePrimaryQuestion, bw: boolean): string {
  switch (q.type) {
    case "count_write": {
      const icons = Array.from({ length: q.countValue || 4 })
        .map(() =>
          renderPrePrimaryIconSvg(q.countIcon || "apple", {
            size: 26,
            color: q.countColorHex,
            bw,
          })
        )
        .join("");
      return `
        <div class="pp-row">
          <div class="pp-picture-box">${icons}</div>
          <span class="pp-op-sign">=</span>
          <div class="pp-answer-box"></div>
        </div>
      `;
    }
    case "box_addition": {
      const leftIcons = Array.from({ length: q.addLeft || 2 })
        .map(() =>
          renderPrePrimaryIconSvg(q.addIcon || "apple", {
            size: 24,
            color: q.addColorHex,
            bw,
          })
        )
        .join("");
      const rightIcons = Array.from({ length: q.addRight || 2 })
        .map(() =>
          renderPrePrimaryIconSvg(q.addIcon || "apple", {
            size: 24,
            color: q.addColorHex,
            bw,
          })
        )
        .join("");
      return `
        <div class="pp-row">
          <div class="pp-picture-box">${leftIcons}</div>
          <span class="pp-op-sign">+</span>
          <div class="pp-picture-box">${rightIcons}</div>
          <span class="pp-op-sign">=</span>
          <div class="pp-answer-box"></div>
        </div>
      `;
    }
    case "color_match": {
      const pairs = q.matchColors || [];
      const rOrder = q.matchRightOrder || pairs.map((_, i) => i);
      const leftCol = pairs
        .map(
          (p) => `
          <div class="pp-match-item">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              <span style="width:14px;height:14px;border-radius:50%;display:inline-block;border:1.5px solid #0f172a;background:${
                bw ? "#ffffff" : p.hex
              };"></span>
              <span>${escapeHtml(p.colorName)} (${escapeHtml(p.hindiName)})</span>
            </span>
            <span class="pp-dot"></span>
          </div>
        `
        )
        .join("");
      const rightCol = rOrder
        .map((idx) => {
          const p = pairs[idx];
          if (!p) return "";
          return `
            <div class="pp-match-item">
              <span class="pp-dot"></span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                ${renderPrePrimaryIconSvg(p.icon, { size: 22, color: p.hex, bw })}
                <span>${escapeHtml(p.objectLabel)}</span>
              </span>
            </div>
          `;
        })
        .join("");
      return `
        <div class="pp-match-grid">
          <div class="pp-match-col">${leftCol}</div>
          <div class="pp-match-col">${rightCol}</div>
        </div>
      `;
    }
    case "color_fill": {
      const shapes = Array.from({ length: q.fillTotalShapes || 6 })
        .map(() =>
          renderPrePrimaryIconSvg(q.fillIcon || "star", {
            size: 32,
            hollow: true,
            bw: true,
          })
        )
        .join("");
      return `
        <div class="pp-row" style="justify-content:space-between;">
          <div class="pp-picture-box" style="gap:12px;">${shapes}</div>
          <div style="font-size:9px;font-weight:700;color:#334155;">
            Target: <strong>${q.fillTargetCount}</strong> (${escapeHtml(q.fillTargetColorName || "")})
          </div>
        </div>
      `;
    }
    case "circle_correct": {
      const hintHtml = q.circlePictureHint
        ? `
          <div class="pp-picture-box" style="margin-right:6px;">
            ${renderPrePrimaryIconSvg(q.circlePictureHint.icon, {
              size: 32,
              color: q.circlePictureHint.colorHex,
              bw,
            })}
            ${
              q.circlePictureHint.label
                ? `<span style="font-size:10px;font-weight:800;">${escapeHtml(q.circlePictureHint.label)}</span>`
                : ""
            }
          </div>
        `
        : "";
      const choicesHtml = (q.circleChoices || [])
        .map((ch) => {
          const iconSvg = ch.icon
            ? renderPrePrimaryIconSvg(ch.icon, { size: 24, color: ch.colorHex, bw })
            : "";
          return `<div class="pp-circle-opt">${iconSvg}<span>${escapeHtml(ch.label)}</span></div>`;
        })
        .join("");
      return `<div class="pp-row">${hintHtml}${choicesHtml}</div>`;
    }
    case "missing_box": {
      const seqHtml = (q.missingSequence || [])
        .map((val) =>
          val === null
            ? `<div class="pp-seq-box pp-seq-empty"></div>`
            : `<div class="pp-seq-box">${escapeHtml(val)}</div>`
        )
        .join(`<span style="font-weight:800;color:#64748b;">→</span>`);
      return `<div class="pp-row">${seqHtml}</div>`;
    }
    case "compare_tick": {
      const renderSide = (side?: PrePrimaryQuestion["compareLeft"]) => {
        if (!side) return "";
        const iconSize = side.size === "big" ? 36 : 19;
        const icons = Array.from({ length: side.count })
          .map(() =>
            renderPrePrimaryIconSvg(side.icon, {
              size: iconSize,
              color: side.colorHex,
              bw,
            })
          )
          .join("");
        return `
          <div class="pp-cmp-box">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">${icons}</div>
            <div style="width:24px;height:24px;border:2px solid #0f172a;border-radius:4px;background:#ffffff;shrink:0;"></div>
          </div>
        `;
      };
      return `<div class="pp-row" style="gap:14px;">${renderSide(q.compareLeft)}${renderSide(q.compareRight)}</div>`;
    }
    case "word_join": {
      const iconHtml = q.wordPromptIcon
        ? `<div class="pp-picture-box">${renderPrePrimaryIconSvg(q.wordPromptIcon, {
            size: 28,
            color: q.wordPromptColor,
            bw,
          })}</div>`
        : "";
      const partsHtml = (q.wordParts || [])
        .map((p) => `<span class="pp-word-pill">${escapeHtml(p)}</span>`)
        .join(`<span class="pp-op-sign">+</span>`);
      return `
        <div class="pp-row">
          ${iconHtml}
          ${partsHtml}
          <span class="pp-op-sign">=</span>
          <div class="pp-word-ans"></div>
        </div>
      `;
    }
    default:
      return "";
  }
}

export interface PrePrimaryScreeningBuildParams {
  school?: Partial<School> | null;
  paper: PrePrimaryPaperSet;
  mode: "full" | "questions_only";
  bwPrint?: boolean;
  fontSizePx?: number;
  lkgThresholdPct?: number;
  ukgThresholdPct?: number;
}

export function buildPrePrimaryScreeningHtmlBundle(
  params: PrePrimaryScreeningBuildParams
): { pagesHtml: string[]; fullCss: string; docTitle: string } {
  const {
    school,
    paper,
    mode,
    bwPrint = false,
    fontSizePx = 10.5,
    lkgThresholdPct = 40,
    ukgThresholdPct = 70,
  } = params;

  const masthead = resolveExamPaperMasthead(school);
  const schoolName = masthead.schoolName;
  const ppLogoHtml = masthead.logoUrl
    ? `<img src="${escapeHtml(masthead.logoUrl)}" alt="" class="std-logo" style="${
        bwPrint ? "filter:grayscale(100%) contrast(1.3);" : "filter:grayscale(100%) contrast(1.22);"
      }" onerror="this.style.display='none'" />`
    : "";

  const p1Questions = paper.questions.slice(0, 6);
  const p2Questions = paper.questions.slice(6);

  const renderQCard = (q: PrePrimaryQuestion) => `
    <div class="pp-q-card">
      <div class="pp-q-head">
        <div>
          <div class="pp-q-title">Q.${q.qNo}. ${escapeHtml(q.instruction)}</div>
          ${q.instructionHi ? `<div class="pp-q-subhi">${escapeHtml(q.instructionHi)}</div>` : ""}
        </div>
        <div class="pp-q-meta">${escapeHtml(q.levelLabel)} · ${q.marks}M</div>
      </div>
      ${renderPrePrimaryQuestionBodyHtml(q, bwPrint)}
    </div>
  `;

  const page1Html = `
    <div class="exam-sheet pp-sheet" style="--ppfs:${fontSizePx}px;">
      <div class="pp-header">
        <table class="std-masthead-tbl">
          <tr>
            <td style="width:54px;vertical-align:middle;text-align:left;">${ppLogoHtml}</td>
            <td style="vertical-align:middle;text-align:center;">
              <div class="school-title">${escapeHtml(masthead.schoolName)}</div>
              ${masthead.tagline ? `<div class="school-tagline">${escapeHtml(masthead.tagline)}</div>` : ""}
              ${masthead.address ? `<div class="school-sub">${escapeHtml(masthead.address)}</div>` : ""}
              ${masthead.contactLine ? `<div class="school-contact">${escapeHtml(masthead.contactLine)}</div>` : ""}
            </td>
            <td style="width:54px;vertical-align:middle;text-align:right;"></td>
          </tr>
        </table>
        <div class="meta-bar">
          <span>PRE-PRIMARY LEVEL SCREENING TEST (NURSERY / LKG / UKG)</span>
          <span>Code: ${escapeHtml(paper.setId)} · Time: ${paper.durationMinutes} Min</span>
          <span>Max Marks: ${paper.totalMarks}</span>
        </div>
        <div class="student-strip">
          <div class="student-field"><strong>Child Name:</strong> </div>
          <div class="student-field"><strong>Father's Name:</strong> </div>
          <div class="student-field" style="max-width:85px;"><strong>Age:</strong> </div>
          <div class="student-field" style="max-width:110px;"><strong>Date:</strong> </div>
        </div>
        <div class="pp-placement-bar">
          <span>MARKS: _____ / ${paper.totalMarks} (____%)</span>
          <span>
            PLACEMENT:
            <span style="margin-left:6px;"><span class="pp-chk-box"></span>Nursery (&lt;${lkgThresholdPct}%)</span>
            <span style="margin-left:8px;"><span class="pp-chk-box"></span>LKG / KG-1 (${lkgThresholdPct}–${ukgThresholdPct - 1}%)</span>
            <span style="margin-left:8px;"><span class="pp-chk-box"></span>UKG / KG-2 (${ukgThresholdPct}%+)</span>
          </span>
        </div>
      </div>

      ${p1Questions.map(renderQCard).join("")}

      <div class="footer-note">
        <span><strong>${escapeHtml(schoolName)}</strong> · ${escapeHtml(paper.setId)} (Nursery / LKG / UKG Screening)</span>
        <span>Page 1 of 2 · Help child read instructions gently</span>
      </div>
    </div>
  `;

  const page2Html = `
    <div class="exam-sheet pp-sheet" style="--ppfs:${fontSizePx}px;">
      <div class="cont-bar">
        <span class="cont-school">${escapeHtml(schoolName)}</span>
        <span>Pre-Primary Activity Paper · ${escapeHtml(paper.setId)} (Q.${p1Questions.length + 1}–Q.${paper.questions.length})</span>
        <span>Page 2 of 2</span>
      </div>

      ${p2Questions.map(renderQCard).join("")}

      <div style="margin-top:8px;border:1.5px solid #0f172a;border-radius:6px;padding:7px 10px;background:#f8fafc;">
        <div style="font-size:9.5px;font-weight:800;color:#0f172a;margin-bottom:4px;">
          TEACHER / EXAMINER OBSERVATION &amp; FINAL CLASS ALLOTMENT
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:8.5px;color:#334155;">
          ${paper.oralChecklist
            .map(
              (c) =>
                `<div><span class="pp-chk-box"></span><strong>${escapeHtml(c.item)}</strong></div>`
            )
            .join("")}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:5px;border-top:1px dashed #94a3b8;font-size:9px;font-weight:800;">
          <span>Allotted Class: ______________________</span>
          <span>Examiner Signature: ______________________</span>
        </div>
      </div>

      <div class="footer-note">
        <span><strong>${escapeHtml(schoolName)}</strong> · ${escapeHtml(paper.setId)}</span>
        <span>Page 2 of 2 · Student Sheet Complete</span>
      </div>
    </div>
  `;

  const pagesHtml: string[] = [page1Html, page2Html];

  if (mode === "full") {
    const keyPageHtml = `
      <div class="exam-sheet pp-sheet">
        <div class="key-banner">
          <div>
            <div style="font-size:12.5px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;color:#fde68a;">${escapeHtml(schoolName)}</div>
            <div style="font-size:11px;font-weight:800;margin-top:2px;">PAGE 3: EXAMINER ANSWER KEY &amp; LEVEL PLACEMENT GUIDE · ${escapeHtml(paper.setId)}</div>
          </div>
          <div style="text-align:right;font-size:9px;color:#e2e8f0;font-weight:700;">
            Max Marks: ${paper.totalMarks}<br/>Nursery · LKG (KG-1) · UKG (KG-2)
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
          <div style="border:1.5px solid #e2e8f0;border-radius:6px;padding:7px 9px;background:#fff1f2;">
            <div style="font-size:10px;font-weight:800;color:#be123c;">0% – ${lkgThresholdPct - 1}% → NURSERY</div>
            <div style="font-size:8.5px;color:#334155;margin-top:2px;">Up to ${Math.floor(((lkgThresholdPct - 0.1) * paper.totalMarks) / 100)}/${paper.totalMarks} Marks · Child needs initial pencil control &amp; basic identification.</div>
          </div>
          <div style="border:1.5px solid #bae6fd;border-radius:6px;padding:7px 9px;background:#f0f9ff;">
            <div style="font-size:10px;font-weight:800;color:#0369a1;">${lkgThresholdPct}% – ${ukgThresholdPct - 1}% → LKG (KG-1)</div>
            <div style="font-size:8.5px;color:#334155;margin-top:2px;">${Math.ceil((lkgThresholdPct * paper.totalMarks) / 100)}–${Math.floor(((ukgThresholdPct - 0.1) * paper.totalMarks) / 100)}/${paper.totalMarks} Marks · Recognizes letters, colours, comparison &amp; counting.</div>
          </div>
          <div style="border:1.5px solid #bbf7d0;border-radius:6px;padding:7px 9px;background:#f0fdf4;">
            <div style="font-size:10px;font-weight:800;color:#15803d;">${ukgThresholdPct}% – 100% → UKG (KG-2)</div>
            <div style="font-size:8.5px;color:#334155;margin-top:2px;">${Math.ceil((ukgThresholdPct * paper.totalMarks) / 100)}–${paper.totalMarks}/${paper.totalMarks} Marks · Confident with box addition, vowels &amp; 3-letter words.</div>
          </div>
        </div>

        <table class="key-table">
          <thead>
            <tr>
              <th style="width:42px;">Q.No</th>
              <th style="width:110px;">Target Level</th>
              <th style="width:95px;">Subject</th>
              <th style="width:42px;">Marks</th>
              <th>Official Answer &amp; Checking Note</th>
            </tr>
          </thead>
          <tbody>
            ${paper.questions
              .map(
                (q) => `
              <tr>
                <td style="font-weight:800;text-align:center;">Q.${q.qNo}</td>
                <td style="font-weight:700;">${escapeHtml(q.levelLabel)}</td>
                <td>${escapeHtml(q.subject)}</td>
                <td style="text-align:center;font-weight:800;">${q.marks}</td>
                <td><span class="key-badge">${escapeHtml(q.answerSummary)}</span> — <span style="color:#475569;">${escapeHtml(q.instruction)}</span></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="footer-note">
          <span><strong>${escapeHtml(schoolName)}</strong> · Official Pre-Primary Screening Key</span>
          <span>${escapeHtml(paper.setId)} · Nursery (${paper.levelMarks.NURSERY}M) + LKG (${paper.levelMarks.LKG}M) + UKG (${paper.levelMarks.UKG}M) = ${paper.totalMarks}M</span>
        </div>
      </div>
    `;
    pagesHtml.push(keyPageHtml);
  }

  const fullCss = `${SHARED_PDF_CSS}\n${PRE_PRIMARY_PDF_CSS}`;
  const safeCode = (school?.code || schoolName)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 18);
  const suffix = mode === "full" ? "PrePrimary_Screening_And_Key" : "PrePrimary_StudentSheet";
  const docTitle = `${safeCode}_Nursery_LKG_UKG_${paper.setId}_${suffix}`;

  return { pagesHtml, fullCss, docTitle };
}

export function printPrePrimaryScreeningA4(
  params: PrePrimaryScreeningBuildParams
): { invoked: boolean; insideIframe: boolean } {
  const { pagesHtml, fullCss, docTitle } = buildPrePrimaryScreeningHtmlBundle(params);
  return mountAndPrintA4Sync(pagesHtml, fullCss, docTitle);
}

export async function downloadPrePrimaryScreeningPdf(
  params: PrePrimaryScreeningBuildParams
): Promise<void> {
  const { pagesHtml, fullCss, docTitle } = buildPrePrimaryScreeningHtmlBundle(params);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const a4W = pdf.internal.pageSize.getWidth();
  const a4H = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = await renderHtmlToCanvasSafe(pagesHtml[i], fullCss, {
      widthPx: 794,
      heightPx: 1122,
      scale: 2,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.94);
    const ratio = canvas.height / Math.max(1, canvas.width);
    const rawHeightMm = a4W * ratio;
    const fitScale = rawHeightMm > a4H ? a4H / rawHeightMm : 1;
    const drawW = a4W * fitScale;
    const drawH = rawHeightMm * fitScale;
    const offsetX = (a4W - drawW) / 2;
    const offsetY = (a4H - drawH) / 2;
    pdf.addImage(imgData, "JPEG", offsetX, offsetY, drawW, drawH);
  }

  pdf.save(`${docTitle}.pdf`);
}


