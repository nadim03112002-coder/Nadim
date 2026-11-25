import React, { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { QrCode, Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface EasyScanQrPanelProps {
  qrValue: string;
  personName: string;
  personRoleLabel: string;
  identifierLabel: string;
  scanInstruction?: string;
  downloadFileName?: string;
  accent?: "purple" | "blue" | "amber";
}

const ACCENT_STYLES: Record<
  "purple" | "blue" | "amber",
  {
    iconBg: string;
    btnBg: string;
    border: string;
    highlightText: string;
  }
> = {
  purple: {
    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    btnBg: "bg-purple-600 hover:bg-purple-700 text-white",
    border: "border-purple-200 dark:border-purple-800/40",
    highlightText: "text-purple-700 dark:text-purple-300",
  },
  blue: {
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    btnBg: "bg-indigo-600 hover:bg-indigo-700 text-white",
    border: "border-indigo-200 dark:border-indigo-800/40",
    highlightText: "text-indigo-700 dark:text-indigo-300",
  },
  amber: {
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    btnBg: "bg-amber-500 hover:bg-amber-400 text-slate-950",
    border: "border-amber-200 dark:border-amber-800/40",
    highlightText: "text-amber-700 dark:text-amber-300",
  },
};

export const EasyScanQrPanel: React.FC<EasyScanQrPanelProps> = ({
  qrValue,
  personName,
  personRoleLabel,
  identifierLabel,
  scanInstruction = "Phone ya Scanner se bina zoom kiye seedha scan karein",
  downloadFileName,
  accent = "blue",
}) => {
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const palette = ACCENT_STYLES[accent];

  const handleCopyUrl = () => {
    if (!qrValue) return;
    navigator.clipboard?.writeText(qrValue);
    setCopied(true);
    toast.success("QR Verification Link copy ho gaya!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQrPng = async () => {
    const svgEl = svgWrapperRef.current?.querySelector("svg");
    if (!svgEl || downloading) return;
    setDownloading(true);
    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;
      cloned.setAttribute("width", "512");
      cloned.setAttribute("height", "512");
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(cloned);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("QR render error"));
        img.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);
      const pad = 20;
      ctx.drawImage(img, pad, pad, 512 - pad * 2, 512 - pad * 2);

      URL.revokeObjectURL(svgUrl);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeName = (downloadFileName || `${personName || "id"}_QR_512x512`).replace(/[^a-zA-Z0-9_-]+/g, "_");
      link.download = `${safeName}.png`;
      link.href = pngUrl;
      link.click();
      toast.success("512×512 QR Code PNG download ho gaya!");
    } catch (err) {
      console.error("Failed to download 512x512 QR PNG:", err);
      toast.error("QR PNG download karne me samasya aayi.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="print:hidden bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${palette.iconBg}`}>
            <QrCode className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                Easy-Scan QR Code
              </h4>
              <span className="text-[11px] font-mono font-bold tabular-nums text-slate-500 dark:text-slate-400">
                512×512 px
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {scanInstruction}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadQrPng}
            disabled={downloading}
            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${palette.btnBg}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download 512×512 PNG</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div
          ref={svgWrapperRef}
          className="w-full max-w-[512px] aspect-square mx-auto bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center"
        >
          <QRCode
            value={qrValue}
            size={512}
            level="L"
            style={{ width: "100%", height: "100%", maxWidth: "512px", maxHeight: "512px" }}
          />
        </div>

        <div className={`mt-3 w-full max-w-[512px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border ${palette.border} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs`}>
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 min-w-0 truncate">
            <span className="font-bold truncate">{personName}</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className={`font-semibold shrink-0 ${palette.highlightText}`}>{personRoleLabel}</span>
          </div>
          <span className="font-mono font-bold text-[11px] text-slate-600 dark:text-slate-300 tabular-nums truncate">
            {identifierLabel}
          </span>
        </div>

        <p className="mt-2 text-[11px] text-center text-slate-500 dark:text-slate-400">
          Note: Print aur PDF ke time ID Card aur uska QR code apne original compact CR80 size me hi print honge.
        </p>
      </div>
    </div>
  );
};
