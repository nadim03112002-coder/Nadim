import crypto from "crypto";
import { getKvDocFromSupabase, upsertKvDocInSupabase } from "./_supabaseServer.js";

export type PrintDocOrientation = "portrait" | "landscape";

export interface PrintDocumentPayload {
  pagesHtml: string[];
  css?: string;
  title?: string;
  orientation?: PrintDocOrientation;
  autoPrint?: boolean;
}

interface StoredPrintDocument {
  html: string;
  nonce: string;
  title: string;
  orientation: PrintDocOrientation;
  createdAt: number;
}

const MEMORY_PRINT_TTL_MS = 30 * 60 * 1000;
const MEMORY_PRINT_MAX_ITEMS = 120;
const memoryPrintDocs = new Map<string, StoredPrintDocument>();

function pruneMemoryPrintDocs() {
  const now = Date.now();
  for (const [key, entry] of memoryPrintDocs.entries()) {
    if (now - entry.createdAt > MEMORY_PRINT_TTL_MS) {
      memoryPrintDocs.delete(key);
    }
  }
  while (memoryPrintDocs.size > MEMORY_PRINT_MAX_ITEMS) {
    const oldestKey = memoryPrintDocs.keys().next().value;
    if (!oldestKey) break;
    memoryPrintDocs.delete(oldestKey);
  }
}

function escapeHtmlAttr(val: string): string {
  return String(val || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizePrintFragmentHtml(rawHtml: string): string {
  let out = String(rawHtml || "");
  // Strip any script/iframe/object/embed/base/meta/link tags
  out = out
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(?:script|iframe|object|embed|applet|base|meta|link|form)\b[^>]*>/gi, "");
  // Preserve only the harmless image fallback onerror="this.style.display='none'", strip all other inline event handlers
  out = out.replace(/\son([a-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (match, evt, dq, sq, bare) => {
    const evtName = String(evt || "").toLowerCase();
    const val = String(dq ?? sq ?? bare ?? "").trim();
    if (evtName === "error" && /^this\.style\.display\s*=\s*['"]none['"]\s*;?$/i.test(val)) {
      return ` onerror="this.style.display='none'"`;
    }
    return "";
  });
  // Neutralize javascript: / vbscript: / data:text/html URLs
  out = out.replace(/(?:javascript|vbscript)\s*:/gi, "blocked:");
  out = out.replace(/data\s*:\s*text\/html/gi, "blocked:text/html");
  return out;
}

function sanitizePrintCss(rawCss: string): string {
  return String(rawCss || "")
    .replace(/<\/style/gi, "/* style */")
    .replace(/expression\s*\(/gi, "/* expr */(")
    .replace(/(?:javascript|vbscript)\s*:/gi, "blocked:");
}

export function buildCleanStandalonePrintDocument(input: PrintDocumentPayload): {
  html: string;
  nonce: string;
  title: string;
  orientation: PrintDocOrientation;
} {
  const orientation: PrintDocOrientation =
    input.orientation === "landscape" ? "landscape" : "portrait";
  const isLandscape = orientation === "landscape";
  const safeTitle = String(input.title || "SCHOOL+ A4 Question Paper")
    .replace(/[\r\n<>]/g, " ")
    .trim()
    .slice(0, 140);
  const autoPrint = input.autoPrint !== false;
  const nonce = crypto.randomBytes(16).toString("base64");

  const safeCss = sanitizePrintCss(input.css || "");
  const safePages = (Array.isArray(input.pagesHtml) ? input.pagesHtml : [])
    .slice(0, 120)
    .map((p) => sanitizePrintFragmentHtml(p));

  const orientationRules = isLandscape
    ? `
      .booklet-sheet {
        width: 1122px;
        height: 794px;
        min-height: 794px;
        padding: 12px;
        margin: 0 auto;
        background: #ffffff;
        color: #0f172a;
        overflow: hidden;
      }
      @media screen {
        .lm-print-pages {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 16px 12px 40px;
        }
        .booklet-sheet {
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
          border: 1px solid #cbd5e1;
        }
      }
      @media print {
        @page {
          size: A4 landscape;
          margin: 4mm;
        }
        .booklet-sheet {
          width: 100% !important;
          max-width: 289mm !important;
          height: 196mm !important;
          min-height: 0 !important;
          max-height: 198mm !important;
          padding: 0 !important;
          margin: 0 auto !important;
          background: #ffffff !important;
          overflow: hidden !important;
          box-shadow: none !important;
          border: none !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .booklet-sheet:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .booklet-spread-tbl {
          width: 100% !important;
          height: 194mm !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
        }
        .booklet-half-cell {
          width: 49% !important;
          height: 194mm !important;
          vertical-align: top !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .booklet-fold-gutter {
          width: 2% !important;
          height: 194mm !important;
          vertical-align: middle !important;
          text-align: center !important;
          padding: 0 !important;
          position: relative !important;
        }
        .booklet-fold-line {
          height: 190mm !important;
          border-left: 1px dashed #64748b !important;
          margin: 0 auto !important;
        }
        .booklet-slot {
          width: 100% !important;
          max-width: 135mm !important;
          height: 192mm !important;
          overflow: hidden !important;
          margin: 0 auto !important;
          position: relative !important;
        }
        .booklet-slot-scaler {
          width: 794px !important;
          height: 1122px !important;
          transform: scale(0.642) !important;
          transform-origin: top left !important;
        }
        .booklet-sheet .qp-sheet {
          width: 794px !important;
          height: 1122px !important;
          min-height: 1122px !important;
          padding: 14px 20px !important;
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .booklet-sheet .qp-page-frame-tbl {
          width: 100% !important;
          height: 1090px !important;
          min-height: 1090px !important;
        }
        .booklet-sheet .exam-sheet {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      }
    `
    : `
      @media screen {
        .lm-print-pages {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 16px 12px 40px;
        }
        .exam-sheet {
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
          border: 1px solid #cbd5e1;
        }
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 5mm;
        }
        .exam-sheet {
          width: 100% !important;
          min-height: 0 !important;
          height: auto !important;
          padding: 0 !important;
          margin: 0 auto !important;
          background: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .exam-sheet:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .qp-sheet {
          width: 100% !important;
          height: auto !important;
          min-height: 266mm !important;
          padding: 0 !important;
        }
        .ak-sheet {
          height: auto !important;
          min-height: 262mm !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
        .qp-page-frame-tbl {
          width: 100% !important;
          height: 266mm !important;
          min-height: 266mm !important;
        }
        .ak-sheet .qp-page-frame-tbl {
          height: auto !important;
          min-height: 262mm !important;
        }
      }
    `;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${isLandscape ? "1160" : "830"}, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escapeHtmlAttr(safeTitle)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&display=swap" rel="stylesheet" />
    <style>
      ${safeCss}
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        background: #e2e8f0;
        color: #0f172a;
        color-scheme: light;
        font-family: Arial, Helvetica, "Noto Sans Devanagari", sans-serif;
      }
      .lm-print-toolbar {
        position: sticky;
        top: 0;
        z-index: 50;
        background: #070d19;
        color: #ffffff;
        padding: 10px 16px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border-bottom: 1px solid #1e293b;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .lm-print-toolbar-title {
        font-size: 13px;
        font-weight: 800;
        line-height: 1.25;
      }
      .lm-print-toolbar-sub {
        font-size: 11px;
        color: #cbd5e1;
        margin-top: 2px;
      }
      .lm-print-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lm-btn {
        border: 0;
        border-radius: 10px;
        padding: 9px 15px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .lm-btn-primary {
        background: #fbbf24;
        color: #020617;
      }
      .lm-btn-secondary {
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #334155;
      }
      .lm-print-pages {
        width: 100%;
      }
      ${orientationRules}
      @media print {
        html, body {
          background: #ffffff !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }
        .no-print, .lm-print-toolbar {
          display: none !important;
          visibility: hidden !important;
        }
        .lm-print-pages {
          display: block !important;
          padding: 0 !important;
          margin: 0 !important;
          gap: 0 !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="lm-print-toolbar no-print">
      <div>
        <div class="lm-print-toolbar-title">${escapeHtmlAttr(safeTitle)}</div>
        <div class="lm-print-toolbar-sub">
          ${
            isLandscape
              ? "A4 Landscape (297mm × 210mm · 2-Up Booklet) — Chrome Print / Save as PDF में Layout: Landscape चुनें"
              : "A4 Portrait (210mm × 297mm) — Chrome Print या Save as PDF के लिए तैयार"
          }
        </div>
      </div>
      <div class="lm-print-toolbar-actions">
        <button type="button" id="lm-trigger-print-btn" class="lm-btn lm-btn-primary">
          Print / Save Vector PDF (${isLandscape ? "A4 Landscape" : "A4 Portrait"})
        </button>
        <button type="button" id="lm-close-print-btn" class="lm-btn lm-btn-secondary">
          Close
        </button>
      </div>
    </div>

    <div class="lm-print-pages">
      ${safePages.join("\n")}
    </div>

    <script nonce="${nonce}">
      (function() {
        var btn = document.getElementById("lm-trigger-print-btn");
        if (btn) {
          btn.addEventListener("click", function() {
            try { window.focus(); window.print(); } catch (e) {}
          });
        }
        var closeBtn = document.getElementById("lm-close-print-btn");
        if (closeBtn) {
          closeBtn.addEventListener("click", function() {
            try { window.close(); } catch (e) {}
            if (window.history && window.history.length > 1) {
              window.history.back();
            }
          });
        }
        ${
          autoPrint
            ? `
        var printedOnce = false;
        function runAutoPrint() {
          if (printedOnce) return;
          printedOnce = true;
          setTimeout(function() {
            try { window.focus(); window.print(); } catch (e) {}
          }, 260);
        }
        if (document.readyState === "complete") {
          Promise.all([
            document.fonts && document.fonts.ready ? document.fonts.ready.catch(function(){}) : Promise.resolve(),
          ]).then(runAutoPrint);
          setTimeout(runAutoPrint, 650);
        } else {
          window.addEventListener("load", function() {
            setTimeout(runAutoPrint, 280);
          });
          setTimeout(runAutoPrint, 1200);
        }
        `
            : ""
        }
      })();
    </script>
  </body>
</html>`;

  return { html, nonce, title: safeTitle, orientation };
}

export function parsePrintPayloadBody(rawBody: any): PrintDocumentPayload | null {
  let obj: any = rawBody;
  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (trimmed.startsWith("{")) {
      try {
        obj = JSON.parse(trimmed);
      } catch {
        obj = null;
      }
    } else {
      const params = new URLSearchParams(trimmed);
      const payloadStr = params.get("payload");
      if (payloadStr) {
        try {
          obj = JSON.parse(payloadStr);
        } catch {
          obj = null;
        }
      }
    }
  } else if (obj && typeof obj === "object" && typeof obj.payload === "string") {
    try {
      obj = JSON.parse(obj.payload);
    } catch {
      obj = null;
    }
  }

  if (!obj || typeof obj !== "object" || !Array.isArray(obj.pagesHtml) || obj.pagesHtml.length === 0) {
    return null;
  }

  return {
    pagesHtml: obj.pagesHtml.map((x: any) => String(x || "")),
    css: typeof obj.css === "string" ? obj.css : "",
    title: typeof obj.title === "string" ? obj.title : "Question_Paper_A4",
    orientation: obj.orientation === "landscape" ? "landscape" : "portrait",
    autoPrint: obj.autoPrint !== false,
  };
}

export async function storePrintDocument(payload: PrintDocumentPayload): Promise<{
  id: string;
  doc: StoredPrintDocument;
}> {
  pruneMemoryPrintDocs();
  const built = buildCleanStandalonePrintDocument(payload);
  const id = `prn_${crypto.randomBytes(8).toString("hex")}`;
  const doc: StoredPrintDocument = {
    html: built.html,
    nonce: built.nonce,
    title: built.title,
    orientation: built.orientation,
    createdAt: Date.now(),
  };

  memoryPrintDocs.set(id, doc);
  if (doc.html.length <= 1_800_000) {
    await upsertKvDocInSupabase(`print_docs/${id}`, doc as unknown as Record<string, any>, undefined, 3500).catch(
      () => false
    );
  }
  return { id, doc };
}

export async function getStoredPrintDocument(id: string): Promise<StoredPrintDocument | null> {
  const cleanId = String(id || "").trim();
  if (!/^prn_[a-f0-9]{10,32}$/i.test(cleanId)) return null;

  pruneMemoryPrintDocs();
  const mem = memoryPrintDocs.get(cleanId);
  if (mem) return mem;

  const kvDoc = await getKvDocFromSupabase<StoredPrintDocument>(`print_docs/${cleanId}`, 4500);
  if (kvDoc?.html && typeof kvDoc.html === "string") {
    if (Date.now() - Number(kvDoc.createdAt || 0) <= MEMORY_PRINT_TTL_MS * 2) {
      memoryPrintDocs.set(cleanId, kvDoc);
      return kvDoc;
    }
  }
  return null;
}
