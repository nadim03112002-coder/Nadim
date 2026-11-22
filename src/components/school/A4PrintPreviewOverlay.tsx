import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Info, Loader2, Printer, X } from "lucide-react";
import { toast } from "sonner";
import {
  isRunningInsideIframe,
  mountAndPrintA4Sync,
  scopeCssToContainer,
} from "../../utils/a4PrintHelper";

interface Props {
  isOpen: boolean;
  title: string;
  pagesHtml: string[];
  scopedCss: string;
  docTitle: string;
  orientation?: "portrait" | "landscape";
  onClose: () => void;
  onDownloadPdfFallback?: () => Promise<void>;
}

export const A4PrintPreviewOverlay: React.FC<Props> = ({
  isOpen,
  title,
  pagesHtml,
  scopedCss,
  docTitle,
  orientation = "portrait",
  onClose,
  onDownloadPdfFallback,
}) => {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const insideIframe = useMemo(() => (isOpen ? isRunningInsideIframe() : false), [isOpen]);
  const isLandscape = orientation === "landscape";
  const pageWidthPx = isLandscape ? 1122 : 794;
  const pageHeightPx = isLandscape ? 794 : 1122;

  const compiledPreviewCss = useMemo(
    () => (isOpen && scopedCss ? scopeCssToContainer(scopedCss, ".lmps-a4-preview-stage") : ""),
    [isOpen, scopedCss]
  );

  useEffect(() => {
    if (!isOpen) return;
    const updateScale = () => {
      const el = stageContainerRef.current;
      if (!el) return;
      const availableW = Math.max(280, el.clientWidth - 24);
      const nextScale = Math.min(1, availableW / pageWidthPx);
      setScale(nextScale);
    };
    updateScale();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateScale()) : null;
    if (ro && stageContainerRef.current) {
      ro.observe(stageContainerRef.current);
    }
    window.addEventListener("resize", updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [isOpen, pageWidthPx]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrintNowSync = () => {
    try {
      const res = mountAndPrintA4Sync(pagesHtml, scopedCss, docTitle, orientation);
      if (res.insideIframe) {
        toast.info(
          "अगर Print डायलॉग Preview बॉक्स में न खुले, तो ऊपर दिया Download PDF बटन दबाएँ या App Link सीधे Chrome में खोलें।"
        );
      }
    } catch (err: any) {
      toast.error("Print शुरू करने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const handleDownloadFallback = async () => {
    if (!onDownloadPdfFallback) return;
    setDownloadingPdf(true);
    try {
      await onDownloadPdfFallback();
      toast.success("A4 PDF डाउनलोड हो गया!");
    } catch (err: any) {
      toast.error("PDF बनाने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-200 dark:bg-slate-950 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="A4 Print Preview"
    >
      {compiledPreviewCss && <style>{compiledPreviewCss}</style>}

      {/* Top Action Header */}
      <div className="bg-[#070D19] text-white px-3 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold truncate">{title}</div>
            <div className="text-[11px] text-slate-300 tabular-nums">
              {isLandscape
                ? `A4 Landscape Booklet (297mm × 210mm · 2-Up Fold) · ${pagesHtml.length} Side${
                    pagesHtml.length > 1 ? "s" : ""
                  } (${Math.ceil(pagesHtml.length / 2)} A4 Sheet${
                    Math.ceil(pagesHtml.length / 2) > 1 ? "s" : ""
                  })`
                : `A4 Portrait (210mm × 297mm) · ${pagesHtml.length} Page${
                    pagesHtml.length > 1 ? "s" : ""
                  }`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handlePrintNowSync}
            className="flex-1 sm:flex-initial h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>{isLandscape ? "Print Booklet (A4 Landscape)" : "Print Now (A4)"}</span>
          </button>

          {onDownloadPdfFallback && (
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={() => void handleDownloadFallback()}
              className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{isLandscape ? "Save Booklet PDF" : "Save A4 PDF"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close print preview"
            className="hidden sm:inline-flex h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLandscape && (
        <div className="bg-sky-50 dark:bg-sky-950/60 border-b border-sky-200 dark:border-sky-800 px-3 sm:px-5 py-2 text-[11px] text-sky-950 dark:text-sky-100 flex items-center gap-2 shrink-0">
          <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>
            <strong>Landscape Print Tip:</strong> Printer/Phone में{" "}
            <strong>Paper Size: ISO A4</strong> + <strong>Orientation: Landscape</strong> +{" "}
            <strong>Double-Sided (Short Edge)</strong> चुनें। 1–2 पेज पेपर में बीच से{" "}
            <strong>काटकर (✂) 2 कॉपी</strong> मिलेंगी, और 3–4 पेज पेपर में बीच से{" "}
            <strong>मोड़ने पर 4-पेज बुकलेट</strong> बनेगी! (सीधे तैयार PDF के लिए{" "}
            <strong>Save Booklet PDF</strong> दबाएँ)
          </span>
        </div>
      )}

      {insideIframe && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-5 py-2 text-[11px] text-amber-950 dark:text-amber-100 flex items-center gap-2 shrink-0">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            <strong>Print Tip:</strong> अगर Preview बॉक्स में Chrome Print dialog न खुले, तो{" "}
            <strong>Save A4 PDF</strong> दबाएँ या App Link को अलग Chrome tab में खोलकर{" "}
            <strong>Print Now (A4)</strong> दबाएँ।
          </span>
        </div>
      )}

      {/* Responsive A4 Sheets Scroll Stage */}
      <div ref={stageContainerRef} className="flex-1 overflow-y-auto py-4 px-3 sm:px-6 space-y-5">
        {pagesHtml.map((html, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 tabular-nums">
              {isLandscape
                ? `A4 Sheet ${Math.floor(idx / 2) + 1} · ${
                    idx % 2 === 0 ? "FRONT SIDE (Side 1)" : "BACK SIDE (Side 2)"
                  } · ${idx + 1} of ${pagesHtml.length}`
                : `Sheet ${idx + 1} of ${pagesHtml.length} (A4)`}
            </div>
            <div
              className="overflow-hidden shadow-xl border border-slate-300 bg-white"
              style={{
                width: `${Math.round(pageWidthPx * scale)}px`,
                minHeight: `${Math.round(pageHeightPx * scale)}px`,
              }}
            >
              <div
                className="lmps-a4-preview-stage origin-top-left bg-white text-slate-900"
                style={{
                  width: `${pageWidthPx}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
