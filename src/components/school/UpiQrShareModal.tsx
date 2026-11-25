import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, ExternalLink, IndianRupee, MessageCircle, QrCode, X } from "lucide-react";
import { toast } from "sonner";

interface UpiQrShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  upiId?: string;
  schoolName?: string;
  amount: number;
  studentSummary: string;
  fatherName?: string;
  phone?: string;
}

export const UpiQrShareModal: React.FC<UpiQrShareModalProps> = ({
  isOpen,
  onClose,
  upiId,
  schoolName = "School",
  amount,
  studentSummary,
  fatherName,
  phone,
}) => {
  const [payAmount, setPayAmount] = useState<string>(amount > 0 ? String(amount) : "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPayAmount(amount > 0 ? String(amount) : "");
      setCopied(false);
    }
  }, [isOpen, amount]);

  if (!isOpen) return null;

  const cleanUpi = String(upiId || "").trim();
  const numericAmount = Math.max(0, Math.round(Number(payAmount) || 0));
  const noteStr = `${studentSummary} Fee`.slice(0, 50);

  const upiUri = cleanUpi
    ? `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(
        schoolName.slice(0, 40)
      )}${numericAmount > 0 ? `&am=${numericAmount}` : ""}&cu=INR&tn=${encodeURIComponent(
        noteStr
      )}`
    : "";

  const handleCopyUpi = async () => {
    if (!cleanUpi) return;
    try {
      await navigator.clipboard.writeText(cleanUpi);
      setCopied(true);
      toast.success(`UPI ID copied: ${cleanUpi}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy nahi ho saka, manually note karein.");
    }
  };

  const handleShareWhatsApp = () => {
    const digits = String(phone || "").replace(/\D/g, "");
    const intl = digits.length === 10 ? `91${digits}` : digits;
    const amtLine =
      numericAmount > 0 ? `Baki Fee Rashi: *₹${numericAmount.toLocaleString("en-IN")}*\n` : "";
    const upiLine = cleanUpi
      ? `School Official UPI ID: *${cleanUpi}*\nUPI App se Pay Link:\n${upiUri}`
      : "Kripya school office ya official UPI par fee jama karein.";
    const msg = encodeURIComponent(
      `Namaste ${fatherName || "Abhibhavak ji"},\n*${schoolName}* se fee payment reminder:\nStudent: *${studentSummary}*\n${amtLine}\n${upiLine}\n\nPayment ke baad screenshot WhatsApp par bhej dein. Dhanyavaad!`
    );
    window.location.href = intl ? `https://wa.me/${intl}?text=${msg}` : `https://wa.me/?text=${msg}`;
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="UPI QR & Pay Link"
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Exact ₹ UPI QR &amp; Pay Link
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {studentSummary}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-100"
            aria-label="Close UPI QR Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {!cleanUpi ? (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/35 p-4 text-center space-y-2">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                School Bank UPI ID Set Nahi Hai
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Exact ₹ QR code generate karne ke liye Admin → School Profile / Fee Receipt Settings me apna official UPI ID darj karein.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <label className="flex-1 block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Exact Amount (₹)
                  </span>
                  <div className="relative">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={0}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white"
                      placeholder="Amount"
                    />
                  </div>
                </label>

                <div className="pt-5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer hover:bg-slate-100"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy UPI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2.5">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <QRCode value={upiUri} size={172} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {cleanUpi}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {numericAmount > 0
                      ? `Scan karke ₹${numericAmount.toLocaleString("en-IN")} seedha jama karein`
                      : "Scan karke fee jama karein"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Pay Link</span>
                </button>
                <a
                  href={upiUri}
                  className="min-h-[44px] px-3 rounded-xl border border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open UPI App</span>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
