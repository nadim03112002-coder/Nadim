// @ts-nocheck
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { renderHtmlToCanvasSafe } from "./safePdfCapture";

export type PdfExportFormat = "a4" | "cr80";
export type PdfExportOrientation = "portrait" | "landscape";

export interface ExportElementPdfOptions {
  filename: string;
  format?: PdfExportFormat;
  orientation?: PdfExportOrientation;
  /** Fixed logical capture width in CSS px (auto-detected if omitted) */
  widthPx?: number;
  /** Fixed logical capture height in CSS px (optional, mainly for CR80 cards) */
  heightPx?: number;
  /** Margin in mm (defaults to 0 for cr80, 6 for a4) */
  marginMm?: number;
  /** Scale factor for crisp text & QR codes (defaults to 3 for cr80, 2 for a4) */
  scale?: number;
  /** How tall A4 documents split: "fit_single" shrinks onto 1 page; "auto_slice" splits tall docs across pages */
  pageMode?: "fit_single" | "auto_slice";
  backgroundColor?: string;
}

export interface MultiPagePdfOptions {
  filename: string;
  orientation?: PdfExportOrientation;
  widthPx?: number;
  marginMm?: number;
  scale?: number;
  backgroundColor?: string;
}

const imageDataUriCache = new Map<string, string>();

export function isNativeAndroidApp(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as any).LifeMakerAndroid;
  return Boolean(
    bridge &&
      (typeof bridge.isNativeApp === "function" ? bridge.isNativeApp() : true)
  );
}

/**
 * Pure deterministic CSS Color 4 OKLCH -> sRGB converter (handles Tailwind v4 color tokens cleanly).
 */
export function oklchFunctionToRgba(rawOklch: string): string {
  const inner = rawOklch
    .replace(/^oklch\(/i, "")
    .replace(/\)$/, "")
    .trim();
  const [coordsPart, alphaPart] = inner.split("/");
  const parts = (coordsPart || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return "#1e3a8a";

  const lRaw = parts[0];
  const cRaw = parts[1];
  const hRaw = parts[2];

  let L = parseFloat(lRaw);
  if (lRaw.endsWith("%")) L = L / 100;
  let C = parseFloat(cRaw);
  if (cRaw.endsWith("%")) C = (C / 100) * 0.4;
  let hDeg = parseFloat(hRaw);
  if (!Number.isFinite(hDeg)) hDeg = 0;
  if (hRaw.endsWith("rad")) hDeg = (hDeg * 180) / Math.PI;
  else if (hRaw.endsWith("turn")) hDeg = hDeg * 360;
  else if (hRaw.endsWith("grad")) hDeg = hDeg * 0.9;

  if (!Number.isFinite(L) || !Number.isFinite(C)) return "#1e3a8a";

  const hRad = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linR = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toSrgbByte = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  };

  const r = toSrgbByte(linR);
  const g = toSrgbByte(linG);
  const bl = toSrgbByte(linB);

  if (alphaPart !== undefined) {
    const aTrim = alphaPart.trim();
    const alpha = aTrim.endsWith("%") ? parseFloat(aTrim) / 100 : parseFloat(aTrim);
    const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    return `rgba(${r}, ${g}, ${bl}, ${Number(safeAlpha.toFixed(3))})`;
  }
  return `rgb(${r}, ${g}, ${bl})`;
}

let cachedNormalizeCtx: CanvasRenderingContext2D | null = null;
function getColorCanvasCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (cachedNormalizeCtx) return cachedNormalizeCtx;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    cachedNormalizeCtx = canvas.getContext("2d");
  } catch {
    cachedNormalizeCtx = null;
  }
  return cachedNormalizeCtx;
}

/**
 * Replaces oklch(...) / oklab(...) / color-mix(...) / lab(...) functions inside any CSS string
 * with crisp rgb(...) / rgba(...) strings compatible with html2canvas v1.4.
 */
export function normalizeCssColorFunctions(value: string): string {
  if (!value) return "";
  let out = value.replace(/oklch\([^)]+\)/gi, (match) => {
    const ctx = getColorCanvasCtx();
    if (ctx) {
      try {
        ctx.fillStyle = "#010203";
        ctx.fillStyle = match;
        const resolved = ctx.fillStyle;
        if (resolved && !/oklch|oklab|color\(/i.test(resolved)) {
          return resolved;
        }
      } catch {}
    }
    return oklchFunctionToRgba(match);
  });

  // Fallback for oklab / lch / lab / color-mix nested functions
  if (/oklab\(|color-mix\(|lab\(|lch\(/i.test(out)) {
    out = out.replace(/(?:oklab|color-mix|lab|lch)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, (match) => {
      const ctx = getColorCanvasCtx();
      if (ctx) {
        try {
          ctx.fillStyle = "#010203";
          ctx.fillStyle = match;
          const resolved = ctx.fillStyle;
          if (resolved && !/oklch|oklab|color-mix|lab\(|lch\(/i.test(resolved)) {
            return resolved;
          }
        } catch {}
      }
      return "rgba(30, 58, 138, 0.9)";
    });
  }
  return out;
}

const COMPUTED_PROPS_TO_COPY: string[] = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "float",
  "clear",
  "box-sizing",
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "align-content",
  "justify-content",
  "justify-items",
  "justify-self",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "overflow",
  "overflow-x",
  "overflow-y",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration",
  "vertical-align",
  "white-space",
  "word-break",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "box-shadow",
  "opacity",
  "object-fit",
  "object-position",
  "border-collapse",
  "table-layout",
];

const SVG_PROPS_TO_COPY: string[] = ["fill", "stroke", "stroke-width", "opacity", "color"];

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (imageDataUriCache.has(url)) return imageDataUriCache.get(url) || null;

  const readBlobAsDataUrl = (blob: Blob) =>
    new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

  const tryFetch = async (targetUrl: string, mode: RequestMode): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const resp = await fetch(targetUrl, { mode, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (!blob.type.startsWith("image/")) return null;
      return await readBlobAsDataUrl(blob);
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  let dataUrl = await tryFetch(url, "cors");
  if (!dataUrl && /^https:\/\//i.test(url)) {
    dataUrl = await tryFetch(`/api/image-proxy?url=${encodeURIComponent(url)}`, "same-origin");
  }
  if (dataUrl) {
    if (imageDataUriCache.size > 120) imageDataUriCache.clear();
    imageDataUriCache.set(url, dataUrl);
  }
  return dataUrl;
}

/**
 * Deeply clones a live DOM subtree and materializes all computed CSS styles inline with
 * color functions normalized so an isolated, Tailwind-free iframe renders pixel-identical output.
 */
export async function cloneElementWithMaterializedStyles(sourceRoot: HTMLElement): Promise<HTMLElement> {
  const clonedRoot = sourceRoot.cloneNode(true) as HTMLElement;
  const srcNodes: Element[] = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll("*"))];
  const dstNodes: Element[] = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll("*"))];
  const isPdfLockLightRoot =
    sourceRoot.getAttribute("data-pdf-lock-light") === "true" ||
    sourceRoot.classList.contains("nst-isolated-print-light") ||
    sourceRoot.classList.contains("cr80-id-card");

  const imgTasks: Promise<void>[] = [];

  for (let i = 0; i < srcNodes.length && i < dstNodes.length; i++) {
    const src = srcNodes[i] as HTMLElement;
    const dst = dstNodes[i] as HTMLElement;

    try {
      const cs = window.getComputedStyle(src);
      const dstStyle = (dst as HTMLElement).style;
      if (dstStyle) {
        const isSvg = dst instanceof SVGElement;
        const propList = isSvg ? SVG_PROPS_TO_COPY : COMPUTED_PROPS_TO_COPY;
        for (const prop of propList) {
          // Inside light-locked printable cards, avoid copying horizontal/vertical ellipsis overflow on text tags so html2canvas never clips glyph descenders
          if (
            isPdfLockLightRoot &&
            (prop === "overflow" || prop === "overflow-x" || prop === "overflow-y") &&
            /^(H1|H2|H3|H4|H5|H6|P|SPAN|STRONG|TD|TH)$/i.test(dst.tagName)
          ) {
            dstStyle.setProperty(prop, "visible");
            continue;
          }
          const val = cs.getPropertyValue(prop);
          if (!val || val === "none" || val === "normal" || val === "auto") {
            if (prop === "display" || prop === "position" || prop === "background-image") {
              dstStyle.setProperty(prop, val);
            }
            continue;
          }
          dstStyle.setProperty(prop, normalizeCssColorFunctions(val));
        }

        // Preserve explicit transforms only when non-identity (e.g. rotated watermark)
        const transform = cs.getPropertyValue("transform");
        if (transform && transform !== "none") {
          dstStyle.setProperty("transform", transform);
        }

        // Hide screen-only controls marked print:hidden / no-print
        const cls = typeof src.className === "string" ? src.className : "";
        if (/\b(?:print:hidden|no-print)\b/.test(cls)) {
          dstStyle.setProperty("display", "none", "important");
        }
      }

      if (dst instanceof HTMLImageElement && src instanceof HTMLImageElement) {
        const rawSrc = src.currentSrc || src.src || dst.getAttribute("src") || "";
        const fallbackInitials = src.getAttribute("data-fallback-initials") || "";
        dst.setAttribute("crossorigin", "anonymous");
        if (rawSrc && !rawSrc.startsWith("data:") && !rawSrc.startsWith("blob:")) {
          imgTasks.push(
            fetchImageAsDataUrl(rawSrc).then((dataUri) => {
              if (dataUri) {
                dst.src = dataUri;
              } else if (fallbackInitials && dst.parentElement) {
                const badge = document.createElement("div");
                badge.textContent = fallbackInitials.slice(0, 3).toUpperCase();
                badge.style.width = dst.style.width || `${src.clientWidth || 32}px`;
                badge.style.height = dst.style.height || `${src.clientHeight || 32}px`;
                badge.style.borderRadius = dst.style.borderRadius || "9999px";
                badge.style.backgroundColor = "#0f172a";
                badge.style.color = "#ffffff";
                badge.style.border = "2px solid #fbbf24";
                badge.style.display = "flex";
                badge.style.alignItems = "center";
                badge.style.justifyContent = "center";
                badge.style.fontWeight = "900";
                badge.style.fontSize = src.clientWidth >= 48 ? "16px" : "10px";
                badge.style.flexShrink = "0";
                dst.parentElement.replaceChild(badge, dst);
              } else {
                // Keep clean alt placeholder instead of letting tainted canvas crash pdf.output
                dst.removeAttribute("src");
                dst.style.background = "#f1f5f9";
                dst.style.color = "#64748b";
                dst.style.fontSize = "8px";
              }
            })
          );
        }
      }
    } catch {
      // Skip restricted node
    }
  }

  if (imgTasks.length > 0) {
    await Promise.race([
      Promise.allSettled(imgTasks),
      new Promise<void>((resolve) => setTimeout(resolve, 6000)),
    ]);
  }

  return clonedRoot;
}

/**
 * Captures a live React-rendered DOM element into a crisp HTMLCanvasElement
 * inside an isolated, oklch-safe iframe at exact logical width/height (independent of mobile zoom!).
 */
export async function captureElementCrispCanvas(
  element: HTMLElement,
  options: {
    widthPx?: number;
    heightPx?: number;
    scale?: number;
    backgroundColor?: string;
  } = {}
): Promise<HTMLCanvasElement> {
  const rect = element.getBoundingClientRect();
  const widthPx = Math.max(200, Math.round(options.widthPx || rect.width || element.offsetWidth || 794));
  const bgColor = options.backgroundColor || "#ffffff";
  const scale = options.scale || 2;

  const materializedClone = await cloneElementWithMaterializedStyles(element);
  materializedClone.style.margin = "0";
  materializedClone.style.boxShadow = "none";
  if (options.widthPx) {
    materializedClone.style.width = `${widthPx}px`;
    materializedClone.style.maxWidth = `${widthPx}px`;
  }
  if (options.heightPx) {
    materializedClone.style.height = `${options.heightPx}px`;
    materializedClone.style.minHeight = `${options.heightPx}px`;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-100000px";
  iframe.style.top = "0";
  iframe.style.width = `${widthPx + 32}px`;
  iframe.style.height = `${Math.max(400, Math.round(options.heightPx || rect.height || 800) + 40)}px`;
  iframe.style.border = "0";
  iframe.style.opacity = "1";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iDoc) throw new Error("Unable to create PDF capture stage");

    iDoc.open();
    iDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: ${bgColor} !important;
        width: ${widthPx}px !important;
        -webkit-font-smoothing: antialiased;
      }
    </style>
  </head>
  <body></body>
</html>`);
    iDoc.close();

    iDoc.body.appendChild(materializedClone);

    const imgs = Array.from(iDoc.images || []);
    await Promise.all([
      Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
              setTimeout(() => resolve(), 1500);
            })
        )
      ),
      (iDoc as any).fonts?.ready?.catch?.(() => {}) || Promise.resolve(),
      new Promise<void>((r) => setTimeout(r, 90)),
    ]);

    const measuredH = Math.max(
      options.heightPx || 0,
      materializedClone.scrollHeight || 0,
      Math.round(rect.height) || 0,
      200
    );
    iframe.style.height = `${measuredH + 24}px`;

    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    return await html2canvas(materializedClone, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: bgColor,
      logging: false,
      width: widthPx,
      height: measuredH,
      windowWidth: widthPx,
      windowHeight: measuredH + 24,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

function sanitizePdfFilename(filename: string): string {
  const cleaned = String(filename || "SCHOOL_Document")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

/**
 * Saves a jsPDF instance cleanly on BOTH Desktop/Mobile Web AND Native Android APK
 * (via LifeMakerAndroid.saveBase64Download into Downloads/).
 */
export function saveJsPdfDocument(pdf: jsPDF, filename: string): void {
  const safeName = sanitizePdfFilename(filename);
  const bridge = typeof window !== "undefined" ? (window as any).LifeMakerAndroid : null;
  if (bridge && typeof bridge.saveBase64Download === "function") {
    const dataUri = pdf.output("datauristring");
    bridge.saveBase64Download(dataUri, safeName, "application/pdf");
    return;
  }
  pdf.save(safeName);
}

/**
 * Exports any single DOM element (ID card, Admit card, Certificate, Marksheet, Report, Receipt)
 * to a crisp, uncropped PDF file.
 */
export async function exportElementToPdf(
  element: HTMLElement | null,
  options: ExportElementPdfOptions
): Promise<boolean> {
  if (!element) return false;
  const format = options.format || "a4";
  const orientation = options.orientation || (format === "cr80" ? "landscape" : "portrait");
  const isCr80 = format === "cr80";

  const rect = element.getBoundingClientRect();
  const defaultWidth = isCr80
    ? orientation === "landscape"
      ? Math.max(340, Math.round(rect.width) || 360)
      : Math.max(230, Math.round(rect.width) || 240)
    : orientation === "landscape"
    ? 1122
    : 794;

  const canvas = await captureElementCrispCanvas(element, {
    widthPx: options.widthPx || defaultWidth,
    heightPx: options.heightPx,
    scale: options.scale ?? (isCr80 ? 3.5 : 2),
    backgroundColor: options.backgroundColor || "#ffffff",
  });

  if (isCr80) {
    const cardWmm = orientation === "landscape" ? 85.6 : 54;
    const cardHmm = orientation === "landscape" ? 54 : 85.6;
    const margin = options.marginMm ?? 0;
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [cardWmm + margin * 2, cardHmm + margin * 2],
      compress: true,
    });
    const ratio = Math.min(cardWmm / canvas.width, cardHmm / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = margin + (cardWmm - drawW) / 2;
    const y = margin + (cardHmm - drawH) / 2;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, drawW, drawH, undefined, "FAST");
    saveJsPdfDocument(pdf, options.filename);
    return true;
  }

  const pageWmm = orientation === "landscape" ? 297 : 210;
  const pageHmm = orientation === "landscape" ? 210 : 297;
  const margin = options.marginMm ?? 6;
  const printableW = pageWmm - margin * 2;
  const printableH = pageHmm - margin * 2;

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageMode = options.pageMode || "auto_slice";
  const naturalHeightMm = (canvas.height * printableW) / canvas.width;

  if (pageMode === "fit_single" || naturalHeightMm <= printableH * 1.04) {
    const ratio = Math.min(printableW / canvas.width, printableH / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageWmm - drawW) / 2;
    const y = margin;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, drawW, drawH, undefined, "FAST");
  } else {
    // Auto-slice across multiple A4 pages cleanly without distortion
    const sliceHeightPx = Math.floor((canvas.width * printableH) / printableW);
    let offsetPx = 0;
    let pageIdx = 0;

    while (offsetPx < canvas.height) {
      const currentSliceH = Math.min(sliceHeightPx, canvas.height - offsetPx);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceH;
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          offsetPx,
          canvas.width,
          currentSliceH,
          0,
          0,
          canvas.width,
          currentSliceH
        );
      }
      if (pageIdx > 0) pdf.addPage("a4", orientation);
      const drawH = (currentSliceH * printableW) / canvas.width;
      pdf.addImage(
        sliceCanvas.toDataURL("image/png"),
        "PNG",
        margin,
        margin,
        printableW,
        drawH,
        undefined,
        "FAST"
      );
      offsetPx += currentSliceH;
      pageIdx++;
    }
  }

  saveJsPdfDocument(pdf, options.filename);
  return true;
}

/**
 * Exports an array of separate DOM page elements (e.g., bulk ID card sheets, bulk Admit cards,
 * bulk Marksheets) into one unified multi-page A4 PDF.
 */
export async function exportMultiPageElementsToPdf(
  pageElements: HTMLElement[],
  options: MultiPagePdfOptions
): Promise<boolean> {
  const valid = (pageElements || []).filter(Boolean);
  if (valid.length === 0) return false;

  const orientation = options.orientation || "portrait";
  const pageWmm = orientation === "landscape" ? 297 : 210;
  const pageHmm = orientation === "landscape" ? 210 : 297;
  const margin = options.marginMm ?? 6;
  const printableW = pageWmm - margin * 2;
  const printableH = pageHmm - margin * 2;
  const widthPx = options.widthPx || (orientation === "landscape" ? 1122 : 794);

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  for (let i = 0; i < valid.length; i++) {
    const el = valid[i];
    const canvas = await captureElementCrispCanvas(el, {
      widthPx,
      scale: options.scale ?? 1.8,
      backgroundColor: options.backgroundColor || "#ffffff",
    });
    if (i > 0) pdf.addPage("a4", orientation);
    const ratio = Math.min(printableW / canvas.width, printableH / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageWmm - drawW) / 2;
    const y = margin;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, drawW, drawH, undefined, "FAST");
  }

  saveJsPdfDocument(pdf, options.filename);
  return true;
}

/**
 * Exports a self-contained HTML + CSS document string directly into a multi-page A4 PDF
 * via the isolated safe renderer (used by StudentQuickActionModal ID card & report cards).
 */
export async function exportHtmlDocumentToPdf(
  htmlBody: string,
  cssText: string,
  options: {
    filename: string;
    format?: PdfExportFormat;
    orientation?: PdfExportOrientation;
    widthPx?: number;
    heightPx?: number;
    marginMm?: number;
  }
): Promise<boolean> {
  const format = options.format || "a4";
  const orientation = options.orientation || "portrait";
  const isCr80 = format === "cr80";
  const widthPx =
    options.widthPx ||
    (isCr80
      ? orientation === "landscape"
        ? 360
        : 240
      : orientation === "landscape"
      ? 1122
      : 794);

  const canvas = await renderHtmlToCanvasSafe(htmlBody, cssText, {
    widthPx,
    heightPx: options.heightPx,
    scale: isCr80 ? 3.5 : 2,
    backgroundColor: "#ffffff",
  });

  if (isCr80) {
    const cardWmm = orientation === "landscape" ? 85.6 : 54;
    const cardHmm = orientation === "landscape" ? 54 : 85.6;
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [cardWmm, cardHmm],
      compress: true,
    });
    const ratio = Math.min(cardWmm / canvas.width, cardHmm / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      (cardWmm - drawW) / 2,
      (cardHmm - drawH) / 2,
      drawW,
      drawH,
      undefined,
      "FAST"
    );
    saveJsPdfDocument(pdf, options.filename);
    return true;
  }

  const pageWmm = orientation === "landscape" ? 297 : 210;
  const pageHmm = orientation === "landscape" ? 210 : 297;
  const margin = options.marginMm ?? 6;
  const printableW = pageWmm - margin * 2;
  const printableH = pageHmm - margin * 2;
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const sliceHeightPx = Math.floor((canvas.width * printableH) / printableW);
  let offsetPx = 0;
  let pageIdx = 0;

  while (offsetPx < canvas.height) {
    const currentSliceH = Math.min(sliceHeightPx, canvas.height - offsetPx);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = currentSliceH;
    const ctx = sliceCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, currentSliceH, 0, 0, canvas.width, currentSliceH);
    }
    if (pageIdx > 0) pdf.addPage("a4", orientation);
    const drawH = (currentSliceH * printableW) / canvas.width;
    pdf.addImage(
      sliceCanvas.toDataURL("image/png"),
      "PNG",
      margin,
      margin,
      printableW,
      drawH,
      undefined,
      "FAST"
    );
    offsetPx += currentSliceH;
    pageIdx++;
  }

  saveJsPdfDocument(pdf, options.filename);
  return true;
}

/**
 * Splits a full standalone HTML document into head <style> CSS + <body> content
 * so it can be sent cleanly to `/api/print-document` for uncropped Chrome printing inside Android APK.
 */
function parseHtmlDocParts(htmlDocument: string): { css: string; bodyHtml: string } {
  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(htmlDocument, "text/html");
    const stylesCss = Array.from(parsed.querySelectorAll("style"))
      .map((s) => s.textContent || "")
      .filter(Boolean)
      .join("\n");
    const bodyHtml = parsed.body ? parsed.body.innerHTML : htmlDocument;
    return { css: stylesCss, bodyHtml };
  } catch {
    return { css: "", bodyHtml: htmlDocument };
  }
}

/**
 * Routes print requests cleanly:
 * - On Native Android APK: uploads clean document HTML to `/api/print-document` and launches Chrome
 *   (which renders at full A4 desktop width instead of zoomed 360px mobile WebView!).
 * - On Desktop / Mobile Browser: prints inside an offscreen isolated iframe with explicit width & `@page`.
 */
export async function smartPrintHtmlDocument(
  htmlDocument: string,
  title = "SCHOOL_Document",
  orientation: PdfExportOrientation = "portrait"
): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const bridge = (window as any).LifeMakerAndroid;
  const inNativeApk = isNativeAndroidApp();

  if (inNativeApk && bridge) {
    try {
      const { css, bodyHtml } = parseHtmlDocParts(htmlDocument);
      const res = await fetch("/api/print-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagesHtml: [bodyHtml],
          css,
          title,
          orientation,
          autoPrint: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        const absoluteUrl = new URL(data.url, window.location.origin).toString();
        if (typeof bridge.openInChrome === "function") {
          bridge.openInChrome(absoluteUrl);
          return true;
        }
      }
    } catch {
      // Offline / network fallback -> generate binary PDF directly into Downloads!
    }

    try {
      const { css, bodyHtml } = parseHtmlDocParts(htmlDocument);
      await exportHtmlDocumentToPdf(bodyHtml, css, {
        filename: title,
        format: "a4",
        orientation,
      });
      return true;
    } catch {
      // Last-resort WebView native print with orientation flag
      (window as any).__lmNextPrintOrientation = orientation;
      (window as any).__lmNextPrintTitle = title;
      if (typeof bridge.printCurrentPageWithOptions === "function") {
        bridge.printCurrentPageWithOptions(orientation, title);
        return true;
      }
    }
  }

  return false;
}
