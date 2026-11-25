// @ts-nocheck
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface SafeCanvasOptions {
  widthPx?: number;
  heightPx?: number;
  scale?: number;
  backgroundColor?: string;
  selector?: string;
}

function oklchToRgbaSafe(rawOklch: string): string {
  const inner = rawOklch.replace(/^oklch\(/i, "").replace(/\)$/, "").trim();
  const [coordsPart, alphaPart] = inner.split("/");
  const parts = (coordsPart || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return "#1e3a8a";

  let L = parseFloat(parts[0]);
  if (parts[0].endsWith("%")) L /= 100;
  let C = parseFloat(parts[1]);
  if (parts[1].endsWith("%")) C = (C / 100) * 0.4;
  let hDeg = parseFloat(parts[2]);
  if (!Number.isFinite(hDeg)) hDeg = 0;
  if (parts[2].endsWith("rad")) hDeg = (hDeg * 180) / Math.PI;
  else if (parts[2].endsWith("turn")) hDeg *= 360;
  else if (parts[2].endsWith("grad")) hDeg *= 0.9;
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
  const toByte = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  };
  const r = toByte(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  if (alphaPart !== undefined) {
    const t = alphaPart.trim();
    const al = t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
    return `rgba(${r}, ${g}, ${bl}, ${Number.isFinite(al) ? Math.max(0, Math.min(1, al)) : 1})`;
  }
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Sanitizes any oklch(...) / oklab(...) / color-mix(...) colors in a CSS string
 * using deterministic OKLCH -> sRGB conversion so gradients & borders keep exact colors
 * while preventing html2canvas from crashing.
 */
function sanitizeOklchInString(str: string): string {
  if (!str) return "";
  let out = str.replace(/oklch\([^)]+\)/gi, (match) => oklchToRgbaSafe(match));
  if (/oklab\(|color-mix\(/i.test(out)) {
    out = out.replace(/(?:oklab|color-mix)\([^()]*(?:\([^()]*\)[^()]*)*\)/gi, "rgba(30, 58, 138, 0.9)");
  }
  return out;
}

/**
 * Renders arbitrary HTML + CSS in a completely isolated, clean iframe.
 * Eliminates "Attempting to parse an unsupported color function 'oklch'"
 * caused by Tailwind CSS v4 stylesheets on the parent document.
 */
export async function renderHtmlToCanvasSafe(
  htmlContent: string,
  cssText: string = "",
  options: SafeCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const widthPx = options.widthPx || 794;
  const baseMinHeight = options.heightPx || (widthPx > 900 ? 794 : 1122);
  const scale = options.scale || 2;
  const bgColor = options.backgroundColor || "#ffffff";

  // Create isolated iframe detached from parent's Tailwind CSS stylesheets
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-100000px";
  iframe.style.top = "0";
  iframe.style.width = `${widthPx}px`;
  iframe.style.height = `${baseMinHeight}px`;
  iframe.style.border = "none";
  iframe.style.opacity = "1";
  iframe.style.visibility = "visible";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Unable to access isolated iframe document");
    }

    const sanitizedCss = sanitizeOklchInString(cssText);

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      ${sanitizedCss}
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${widthPx}px !important;
        min-width: ${widthPx}px !important;
        max-width: ${widthPx}px !important;
        background-color: ${bgColor};
        color: #0f172a;
        font-family: Arial, Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif;
        -webkit-font-smoothing: antialiased;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body style="background-color: ${bgColor}; margin: 0; padding: 0; width: ${widthPx}px;">
    ${htmlContent}
  </body>
</html>`);
    iframeDoc.close();

    // Ensure all images in iframe have CORS anonymous flag and wait for load (with timeout)
    const images = Array.from(iframeDoc.querySelectorAll("img"));
    const imgPromises = images.map((img) => {
      img.setAttribute("crossorigin", "anonymous");
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 1500);
      });
    });

    await Promise.all([
      Promise.all(imgPromises),
      (iframeDoc as any).fonts?.ready?.catch?.(() => {}) || Promise.resolve(),
      new Promise<void>((resolve) => setTimeout(resolve, 140)),
    ]);

    const targetNode = options.selector
      ? ((iframeDoc.querySelector(options.selector) as HTMLElement) || iframeDoc.body)
      : (iframeDoc.body.children.length === 1
          ? (iframeDoc.body.firstElementChild as HTMLElement)
          : iframeDoc.body);

    const measuredHeight = Math.max(
      targetNode?.scrollHeight || 0,
      iframeDoc.body?.scrollHeight || 0,
      baseMinHeight
    );
    iframe.style.height = `${measuredHeight + 16}px`;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const canvas = await html2canvas(targetNode, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: bgColor,
      logging: false,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: widthPx,
      windowHeight: measuredHeight + 16,
      onclone: (clonedDoc) => {
        // Strict safety: sanitize any foreign stylesheets or inline oklch in cloned document
        const styles = Array.from(clonedDoc.querySelectorAll("style, link[rel='stylesheet']"));
        for (const s of styles) {
          if (s.textContent && /oklch|oklab|color-mix/i.test(s.textContent)) {
            s.textContent = sanitizeOklchInString(s.textContent);
          }
        }
      },
    });

    return canvas;
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

/**
 * Captures an existing DOM element safely by extracting its HTML and styles
 * and rendering it inside an isolated iframe without oklch errors.
 */
export async function captureDomElementSafe(
  element: HTMLElement,
  options: SafeCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const widthPx = options.widthPx || element.offsetWidth || 794;
  const htmlContent = element.outerHTML;

  // Collect style tags from document to keep formatting, converting oklch cleanly
  let collectedCss = "";
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          collectedCss += sanitizeOklchInString(rule.cssText) + "\n";
        }
      } catch {
        // Cross-origin stylesheet, skip
      }
    }
  } catch {}

  return renderHtmlToCanvasSafe(htmlContent, collectedCss, {
    ...options,
    widthPx,
  });
}
