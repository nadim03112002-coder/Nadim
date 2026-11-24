import { safeOpenExternalUrl } from "./safeBrowserActions";

/**
 * Native A4 Portrait & Landscape Vector Print Utility.
 * Supports:
 * 1. Isolated hidden-iframe vector printing (zero app UI / zero Tailwind interference)
 * 2. Standalone Chrome tab / external Chrome browser printing via /api/print-document
 * 3. Android WebView PrintManager with explicit A4 Landscape / Portrait PrintAttributes
 * 4. Fallback #lmps-a4-print-portal on document.body for Ctrl+P / browser menu print
 */

const PORTAL_ID = "lmps-a4-print-portal";
const STYLE_ID = "lmps-a4-print-style";
const HIDDEN_IFRAME_ID = "lmps-hidden-print-iframe";

let activeCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let activeAfterPrintHandler: (() => void) | null = null;
let activeFocusHandler: (() => void) | null = null;

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

function clearPendingCleanupListeners() {
  if (activeCleanupTimer) {
    clearTimeout(activeCleanupTimer);
    activeCleanupTimer = null;
  }
  if (activeAfterPrintHandler && typeof window !== "undefined") {
    window.removeEventListener("afterprint", activeAfterPrintHandler);
    activeAfterPrintHandler = null;
  }
  if (activeFocusHandler && typeof window !== "undefined") {
    window.removeEventListener("focus", activeFocusHandler);
    activeFocusHandler = null;
  }
}

export function unmountA4PrintPortal(prevTitle?: string) {
  clearPendingCleanupListeners();
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

export function isNativeAndroidWebView(): boolean {
  try {
    return typeof window !== "undefined" && Boolean((window as any).LifeMakerAndroid);
  } catch {
    return false;
  }
}

export interface A4PrintPortalOptions {
  managedByOverlay?: boolean;
  preferChromeTabInIframe?: boolean;
}

function getOrientationPrintRules(
  orientation: "portrait" | "landscape",
  scopePrefix: string
): string {
  const prefix = scopePrefix ? `${scopePrefix} ` : "";
  if (orientation === "landscape") {
    return `
      ${prefix}.booklet-sheet {
        width: 100% !important;
        max-width: 289mm !important;
        height: 196mm !important;
        min-height: 0 !important;
        max-height: 198mm !important;
        padding: 0 !important;
        margin: 0 auto !important;
        background: #ffffff !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      ${prefix}.booklet-sheet:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      ${prefix}.booklet-spread-tbl {
        width: 100% !important;
        height: 194mm !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }
      ${prefix}.booklet-half-cell {
        width: 49% !important;
        height: 194mm !important;
        vertical-align: top !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      ${prefix}.booklet-fold-gutter {
        width: 2% !important;
        height: 194mm !important;
        vertical-align: middle !important;
        text-align: center !important;
        padding: 0 !important;
        position: relative !important;
      }
      ${prefix}.booklet-fold-line {
        height: 190mm !important;
        border-left: 1px dashed #64748b !important;
        margin: 0 auto !important;
      }
      ${prefix}.booklet-slot {
        width: 100% !important;
        max-width: 135mm !important;
        height: 192mm !important;
        overflow: hidden !important;
        margin: 0 auto !important;
        position: relative !important;
      }
      ${prefix}.booklet-slot-scaler {
        width: 794px !important;
        height: 1122px !important;
        transform: scale(0.642) !important;
        transform-origin: top left !important;
      }
      ${prefix}.booklet-sheet .qp-sheet {
        width: 794px !important;
        height: 1122px !important;
        min-height: 1122px !important;
        padding: 14px 20px !important;
        page-break-after: auto !important;
        break-after: auto !important;
      }
      ${prefix}.booklet-sheet .qp-page-frame-tbl {
        width: 100% !important;
        height: 1090px !important;
        min-height: 1090px !important;
      }
      ${prefix}.booklet-sheet .exam-sheet {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    `;
  }

  return `
    ${prefix}.exam-sheet {
      width: 100% !important;
      min-height: 0 !important;
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      background: #ffffff !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    ${prefix}.exam-sheet:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    ${prefix}.qp-sheet {
      width: 100% !important;
      height: auto !important;
      min-height: 266mm !important;
      padding: 0 !important;
    }
    ${prefix}.ak-sheet {
      height: auto !important;
      min-height: 262mm !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    ${prefix}.qp-page-frame-tbl {
      width: 100% !important;
      height: 266mm !important;
      min-height: 266mm !important;
    }
    ${prefix}.ak-sheet .qp-page-frame-tbl {
      height: auto !important;
      min-height: 262mm !important;
    }
  `;
}

export function mountA4PrintPortal(
  pagesHtml: string[],
  rawCss: string,
  documentTitle?: string,
  orientation: "portrait" | "landscape" = "portrait",
  options?: A4PrintPortalOptions
): { previousTitle: string } {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Print is only supported in browser environment.");
  }
  if (!pagesHtml || pagesHtml.length === 0) {
    throw new Error("No pages generated to print.");
  }

  (window as any).__lmNextPrintOrientation = orientation;
  (window as any).__lmNextPrintTitle = documentTitle || document.title || "";

  const existingPortal = document.getElementById(PORTAL_ID);
  const existingStyle = document.getElementById(STYLE_ID);
  const previousTitle =
    existingPortal?.dataset.prevTitle !== undefined
      ? existingPortal.dataset.prevTitle
      : document.title;

  const signature = `${orientation}:${documentTitle || ""}:${pagesHtml.length}:${pagesHtml[0]?.length || 0}`;
  if (existingPortal && existingStyle && existingPortal.dataset.signature === signature) {
    clearPendingCleanupListeners();
    if (options?.managedByOverlay) {
      existingPortal.dataset.managedByOverlay = "1";
    }
    return { previousTitle };
  }

  unmountA4PrintPortal();

  const scopedCss = scopeCssToContainer(rawCss, `#${PORTAL_ID}`);
  const isLandscape = orientation === "landscape";

  const topLevelPageRule = isLandscape
    ? `@page { size: A4 landscape; margin: 4mm; }`
    : `@page { size: A4 portrait; margin: 5mm; }`;

  const orientationSpecificRules = getOrientationPrintRules(orientation, `#${PORTAL_ID}`);

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
      #root,
      #pre-react-splash,
      body > *:not(#${PORTAL_ID}),
      [role="dialog"],
      [data-sonner-toaster],
      [data-sonner-toast],
      .no-print {
        display: none !important;
        visibility: hidden !important;
      }
      #${PORTAL_ID} {
        display: block !important;
        visibility: visible !important;
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
  portalEl.dataset.prevTitle = previousTitle;
  portalEl.dataset.managedByOverlay = options?.managedByOverlay ? "1" : "0";
  portalEl.dataset.signature = signature;
  portalEl.innerHTML = pagesHtml.join("\n");

  document.head.appendChild(styleEl);
  document.body.appendChild(portalEl);

  if (documentTitle) {
    document.title = documentTitle;
  }

  return { previousTitle };
}

function buildIsolatedIframeHtml(
  pagesHtml: string[],
  rawCss: string,
  documentTitle: string,
  orientation: "portrait" | "landscape"
): string {
  const isLandscape = orientation === "landscape";
  const safeTitle = String(documentTitle || "Question_Paper_A4")
    .replace(/[<>&"]/g, " ")
    .trim();
  const pageRule = isLandscape
    ? `@page { size: A4 landscape; margin: 4mm; }`
    : `@page { size: A4 portrait; margin: 5mm; }`;
  const orientationRules = getOrientationPrintRules(orientation, "");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      ${pageRule}
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      ${rawCss}
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        background: #ffffff !important;
        color: #0f172a !important;
        color-scheme: light !important;
        font-family: Arial, Helvetica, "Noto Sans Devanagari", sans-serif;
      }
      @media print {
        html, body {
          overflow: visible !important;
        }
        ${orientationRules}
      }
    </style>
  </head>
  <body>
    ${pagesHtml.join("\n")}
  </body>
</html>`;
}

/**
 * Prints cleanly from an isolated off-screen iframe so #root, Tailwind CSS v4,
 * and A4PrintPreviewOverlay chrome NEVER appear in the printed output.
 */
function printCleanA4InIframe(
  pagesHtml: string[],
  rawCss: string,
  documentTitle: string,
  orientation: "portrait" | "landscape"
): boolean {
  if (typeof document === "undefined") return false;
  try {
    const existing = document.getElementById(HIDDEN_IFRAME_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const iframe = document.createElement("iframe");
    iframe.id = HIDDEN_IFRAME_ID;
    iframe.title = documentTitle || "A4 Print Document";
    iframe.style.position = "fixed";
    iframe.style.left = "-14000px";
    iframe.style.top = "0";
    iframe.style.width = orientation === "landscape" ? "1180px" : "840px";
    iframe.style.height = orientation === "landscape" ? "840px" : "1180px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    const win = iframe.contentWindow;
    if (!doc || !win) return false;

    const htmlDoc = buildIsolatedIframeHtml(pagesHtml, rawCss, documentTitle, orientation);
    doc.open();
    doc.write(htmlDoc);
    doc.close();

    const cleanup = () => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch {}
    };

    let triggered = false;
    const invokePrint = () => {
      if (triggered) return;
      triggered = true;
      try {
        win.onafterprint = () => {
          setTimeout(cleanup, 600);
        };
        win.focus();
        win.print();
      } catch {
        // fallback handled by caller
      } finally {
        setTimeout(cleanup, 90000);
      }
    };

    const imgs = Array.from(doc.images || []);
    const allImgsReady = imgs.length === 0 || imgs.every((img) => img.complete);

    if (allImgsReady) {
      // Synchronous call preserves mobile Chrome user gesture
      invokePrint();
    } else {
      Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
        )
      ).finally(invokePrint);
      setTimeout(invokePrint, 350);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the clean standalone A4 paper directly in Chrome (new browser tab via synchronous form POST,
 * or external Chrome Intent inside Android WebView APK) so the user gets full vector Chrome Print / Save as PDF.
 */
export async function openA4PrintInChrome(
  pagesHtml: string[],
  rawCss: string,
  documentTitle?: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<{ opened: boolean; mode: "android_chrome" | "form_tab" | "failed" }> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { opened: false, mode: "failed" };
  }
  if (!pagesHtml || pagesHtml.length === 0) {
    return { opened: false, mode: "failed" };
  }

  const title = documentTitle || "Question_Paper_A4";
  const payloadObj = {
    pagesHtml,
    css: rawCss,
    title,
    orientation,
    autoPrint: true,
  };

  // Android WebView APK: upload payload to get a clean URL and launch Chrome browser Intent
  if (isNativeAndroidWebView()) {
    try {
      const res = await fetch("/api/print-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadObj),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        const absoluteUrl = new URL(data.url, window.location.origin).toString();
        const bridge = (window as any).LifeMakerAndroid;
        if (typeof bridge?.openInChrome === "function") {
          bridge.openInChrome(absoluteUrl);
          return { opened: true, mode: "android_chrome" };
        }
        const ok = safeOpenExternalUrl(absoluteUrl);
        return { opened: ok, mode: ok ? "android_chrome" : "failed" };
      }
    } catch {
      // fall through to form POST attempt
    }
  }

  // Browser / PWA / Preview Iframe: synchronous <form target="_blank" method="POST"> never trips popup blockers
  try {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/print-document?direct=1";
    form.target = "_blank";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payloadObj);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
      try {
        if (form.parentNode) form.parentNode.removeChild(form);
      } catch {}
    }, 300);
    return { opened: true, mode: "form_tab" };
  } catch {
    return { opened: false, mode: "failed" };
  }
}

/**
 * Synchronous print trigger inside user click stack.
 * - Native Android APK: calls printCurrentPageWithOptions(orientation, docTitle) with portal mounted
 * - Preview Iframe (when preferChromeTabInIframe !== false): opens clean Chrome print tab so Print always works
 * - Regular Browser / Chrome / PWA: prints via isolated off-screen iframe (zero app UI)
 */
export function mountAndPrintA4Sync(
  pagesHtml: string[],
  rawCss: string,
  documentTitle?: string,
  orientation: "portrait" | "landscape" = "portrait",
  options?: A4PrintPortalOptions
): { invoked: boolean; insideIframe: boolean; openedChromeTab?: boolean } {
  const { previousTitle } = mountA4PrintPortal(
    pagesHtml,
    rawCss,
    documentTitle,
    orientation,
    options
  );

  const isOverlayManaged = Boolean(options?.managedByOverlay);
  const insideIframe = isRunningInsideIframe();
  const inNativeApk = isNativeAndroidWebView();
  const invokedAt = Date.now();
  let cleaned = false;

  const finishCleanup = () => {
    if (cleaned || isOverlayManaged) return;
    const portal = document.getElementById(PORTAL_ID);
    if (portal?.dataset.managedByOverlay === "1") return;
    cleaned = true;
    unmountA4PrintPortal(previousTitle);
  };

  if (!isOverlayManaged) {
    activeAfterPrintHandler = () => {
      const elapsed = Date.now() - invokedAt;
      if (elapsed < 2500) {
        if (activeCleanupTimer) clearTimeout(activeCleanupTimer);
        activeCleanupTimer = setTimeout(finishCleanup, 5000);
        return;
      }
      finishCleanup();
    };
    window.addEventListener("afterprint", activeAfterPrintHandler);

    activeFocusHandler = () => {
      const elapsed = Date.now() - invokedAt;
      if (elapsed >= 2500) {
        if (activeCleanupTimer) clearTimeout(activeCleanupTimer);
        activeCleanupTimer = setTimeout(finishCleanup, 1200);
      }
    };
    window.addEventListener("focus", activeFocusHandler);

    activeCleanupTimer = setTimeout(finishCleanup, 120000);
  }

  if (inNativeApk) {
    try {
      const bridge = (window as any).LifeMakerAndroid;
      if (typeof bridge?.printCurrentPageWithOptions === "function") {
        bridge.printCurrentPageWithOptions(orientation, documentTitle || "SCHOOL+ Document");
        return { invoked: true, insideIframe };
      }
      window.print();
      return { invoked: true, insideIframe };
    } catch {
      return { invoked: false, insideIframe };
    }
  }

  // Inside sandboxed preview iframes, window.print() is commonly ignored; open clean Chrome tab when allowed
  if (insideIframe && options?.preferChromeTabInIframe) {
    void openA4PrintInChrome(pagesHtml, rawCss, documentTitle, orientation);
    return { invoked: true, insideIframe: true, openedChromeTab: true };
  }

  // Desktop / Mobile Chrome / PWA: isolated hidden iframe guarantees 0% app UI bleed
  const iframeInvoked = printCleanA4InIframe(
    pagesHtml,
    rawCss,
    documentTitle || "Question_Paper_A4",
    orientation
  );
  if (iframeInvoked) {
    return { invoked: true, insideIframe };
  }

  let invoked = false;
  try {
    window.print();
    invoked = true;
  } catch {
    invoked = false;
  }

  return { invoked, insideIframe };
}

export async function printHtmlPagesA4(
  pagesHtml: string[],
  rawCss: string,
  documentTitle?: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<void> {
  mountAndPrintA4Sync(pagesHtml, rawCss, documentTitle, orientation);
}
