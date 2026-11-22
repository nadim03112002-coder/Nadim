/**
 * Native A4 Portrait Print Utility (Synchronous User-Gesture Safe — Vector HTML Print).
 * Mounts #lmps-a4-print-portal on document.body visible ONLY in @media print,
 * calls window.print() synchronously inside the user click stack so mobile & desktop
 * browsers never drop the print gesture, and cleans up after printing.
 */

const PORTAL_ID = "lmps-a4-print-portal";
const STYLE_ID = "lmps-a4-print-style";

export function scopeCssToContainer(rawCss: string, containerSelector: string): string {
  const withoutComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: string[] = [];
  let cursor = 0;

  while (cursor < withoutComments.length) {
    const openIdx = withoutComments.indexOf("{", cursor);
    if (openIdx === -1) break;
    const closeIdx = withoutComments.indexOf("}", openIdx);
    if (closeIdx === -1) break;

    const rawSelectors = withoutComments.slice(cursor, openIdx).trim();
    const body = withoutComments.slice(openIdx + 1, closeIdx);
    cursor = closeIdx + 1;

    if (!rawSelectors || rawSelectors.startsWith("@")) continue;

    const scopedSelectors = rawSelectors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sel) => {
        if (sel === "*" || sel === "html" || sel === "body" || sel === "html, body") {
          return sel === "*"
            ? `${containerSelector}, ${containerSelector} *`
            : containerSelector;
        }
        if (sel.startsWith("body ")) {
          return `${containerSelector} ${sel.slice(5)}`;
        }
        return `${containerSelector} ${sel}`;
      })
      .join(", ");

    if (scopedSelectors) {
      rules.push(`${scopedSelectors} {${body}}`);
    }
  }

  return rules.join("\n");
}

function cleanupPrintPortal(prevTitle?: string) {
  try {
    const portal = document.getElementById(PORTAL_ID);
    if (portal && portal.parentNode) portal.parentNode.removeChild(portal);
    const style = document.getElementById(STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
    if (typeof prevTitle === "string") {
      document.title = prevTitle;
    }
  } catch {
    // ignore cleanup errors
  }
}

export function isRunningInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * SYNCHRONOUSLY mounts the A4 print portal and calls window.print() inside the
 * active click gesture. Critical for Android Chrome / Safari / Desktop Chrome.
 */
export function mountAndPrintA4Sync(
  pagesHtml: string[],
  rawCss: string,
  documentTitle?: string,
  orientation: "portrait" | "landscape" = "portrait"
): { invoked: boolean; insideIframe: boolean } {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Print is only supported in browser environment.");
  }
  if (!pagesHtml || pagesHtml.length === 0) {
    throw new Error("No pages generated to print.");
  }

  cleanupPrintPortal();

  const previousTitle = document.title;
  const scopedCss = scopeCssToContainer(rawCss, `#${PORTAL_ID}`);
  const isLandscape = orientation === "landscape";

  const topLevelPageRule = isLandscape
    ? `@page { size: A4 landscape; margin: 4mm; }`
    : `@page { size: A4 portrait; margin: 6mm; }`;

  const orientationSpecificRules = isLandscape
    ? `
      @page {
        size: A4 landscape;
        margin: 4mm;
      }
      #${PORTAL_ID} .booklet-sheet {
        width: 100% !important;
        max-width: 289mm !important;
        height: 200mm !important;
        min-height: 200mm !important;
        padding: 0 !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      #${PORTAL_ID} .booklet-sheet:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      #${PORTAL_ID} .booklet-spread-tbl {
        width: 100% !important;
        height: 200mm !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }
      #${PORTAL_ID} .booklet-half-cell {
        width: 49% !important;
        height: 200mm !important;
        vertical-align: top !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      #${PORTAL_ID} .booklet-fold-gutter {
        width: 2% !important;
        height: 200mm !important;
        vertical-align: middle !important;
        text-align: center !important;
        padding: 0 !important;
        position: relative !important;
      }
      #${PORTAL_ID} .booklet-fold-line {
        height: 196mm !important;
        border-left: 1px dashed #64748b !important;
        margin: 0 auto !important;
      }
      #${PORTAL_ID} .booklet-slot {
        width: 138mm !important;
        height: 198mm !important;
        overflow: hidden !important;
        margin: 0 auto !important;
        position: relative !important;
      }
      #${PORTAL_ID} .booklet-slot-scaler {
        width: 794px !important;
        height: 1122px !important;
        transform: scale(0.655) !important;
        transform-origin: top left !important;
      }
      #${PORTAL_ID} .booklet-sheet .qp-sheet {
        width: 794px !important;
        height: 1122px !important;
        min-height: 1122px !important;
        padding: 16px 22px 16px 22px !important;
        page-break-after: auto !important;
        break-after: auto !important;
      }
      #${PORTAL_ID} .booklet-sheet .qp-page-frame-tbl {
        width: 100% !important;
        height: 1088px !important;
        min-height: 1088px !important;
      }
      #${PORTAL_ID} .booklet-sheet .exam-sheet {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    `
    : `
      @page {
        size: A4 portrait;
        margin: 6mm;
      }
      #${PORTAL_ID} .exam-sheet {
        width: 100% !important;
        min-height: 281mm !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      #${PORTAL_ID} .exam-sheet:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      #${PORTAL_ID} .qp-sheet {
        width: 100% !important;
        height: 281mm !important;
        min-height: 281mm !important;
        padding: 0 !important;
      }
      #${PORTAL_ID} .ak-sheet {
        height: auto !important;
        min-height: 281mm !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      #${PORTAL_ID} .qp-page-frame-tbl {
        width: 100% !important;
        height: 280mm !important;
        min-height: 280mm !important;
      }
      #${PORTAL_ID} .ak-sheet .qp-page-frame-tbl {
        height: 279mm !important;
      }
    `;

  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    ${topLevelPageRule}
    #${PORTAL_ID} {
      display: none !important;
    }
    @media print {
      html, body {
        display: block !important;
        overflow: visible !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        color-scheme: light !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#${PORTAL_ID}) {
        display: none !important;
      }
      #${PORTAL_ID} {
        display: block !important;
        position: static !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
      }
      #${PORTAL_ID}, #${PORTAL_ID} * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box;
      }
      ${scopedCss}
      ${orientationSpecificRules}
    }
  `;

  const portalEl = document.createElement("div");
  portalEl.id = PORTAL_ID;
  portalEl.innerHTML = pagesHtml.join("\n");

  document.head.appendChild(styleEl);
  document.body.appendChild(portalEl);

  if (documentTitle) {
    document.title = documentTitle;
  }

  let cleaned = false;
  const finishCleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("afterprint", finishCleanup);
    cleanupPrintPortal(previousTitle);
  };

  window.addEventListener("afterprint", finishCleanup);

  let invoked = false;
  try {
    window.print();
    invoked = true;
  } catch {
    invoked = false;
  } finally {
    setTimeout(finishCleanup, 60000);
  }

  return { invoked, insideIframe: isRunningInsideIframe() };
}

export async function printHtmlPagesA4(
  pagesHtml: string[],
  rawCss: string,
  documentTitle?: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<void> {
  mountAndPrintA4Sync(pagesHtml, rawCss, documentTitle, orientation);
}
