import React from "react";
import { FileCheck2, Sparkles } from "lucide-react";
import {
  DEFAULT_SCHOOL_SIGNATURE_ROUTING,
  type SchoolSignatureRoutingConfig,
} from "../../school-types";

interface Props {
  value?: SchoolSignatureRoutingConfig;
  onChange: (next: SchoolSignatureRoutingConfig) => void;
  saving?: boolean;
  compact?: boolean;
}

export const SignatureRoutingSettingsPanel: React.FC<Props> = ({
  value,
  onChange,
  saving = false,
  compact = false,
}) => {
  const cfg: Required<SchoolSignatureRoutingConfig> = {
    ...DEFAULT_SCHOOL_SIGNATURE_ROUTING,
    ...(value || {}),
  };

  const updateKey = <K extends keyof SchoolSignatureRoutingConfig>(
    key: K,
    val: SchoolSignatureRoutingConfig[K]
  ) => {
    onChange({
      ...cfg,
      [key]: val,
    });
  };

  const rows: Array<{
    key: keyof SchoolSignatureRoutingConfig;
    title: string;
    subtitle: string;
    options: Array<{ value: string; label: string }>;
  }> = [
    {
      key: "feeSlip",
      title: "1. Fee Slip (बकाया तकादा पर्ची)",
      subtitle: "Single signature slot on Due Demand Slip",
      options: [
        { value: "manager", label: "Manager (Default)" },
        { value: "principal", label: "Principal" },
        { value: "accountant", label: "Accountant" },
        { value: "director", label: "Director" },
      ],
    },
    {
      key: "feeReceipt",
      title: "2. Fee Receipt (फीस जमा रसीद)",
      subtitle: "Paid Monthly Receipt / POS Slip",
      options: [
        { value: "collector", label: "Jo Collect Kare (Accountant / Manager)" },
        { value: "collector_and_principal", label: "Collector + Principal Dono" },
        { value: "accountant", label: "Hamesha Accountant" },
        { value: "manager", label: "Hamesha Manager" },
        { value: "principal", label: "Hamesha Principal" },
        { value: "director", label: "Hamesha Director" },
      ],
    },
    {
      key: "admissionReceipt",
      title: "3. Admission Receipt (प्रवेश रसीद)",
      subtitle: "Admission Fee Payment Studio",
      options: [
        { value: "collector_and_principal", label: "Collector + Principal Dono (Default)" },
        { value: "collector", label: "Jo Collect Kare (Accountant / Manager)" },
        { value: "manager", label: "Manager" },
        { value: "principal", label: "Principal" },
        { value: "director", label: "Director" },
      ],
    },
    {
      key: "idCard",
      title: "4. ID Card (छात्र / स्टाफ कार्ड)",
      subtitle: "Issuing Authority Signature",
      options: [
        { value: "principal", label: "Principal (Default)" },
        { value: "manager", label: "Manager" },
        { value: "director", label: "Director" },
      ],
    },
    {
      key: "certificate",
      title: "5. Certificate / TC / Character",
      subtitle: "Authorized Signatory",
      options: [
        { value: "principal", label: "Principal (Default)" },
        { value: "manager", label: "Manager" },
        { value: "director", label: "Director" },
      ],
    },
    {
      key: "admitCard",
      title: "6. Admit Card (प्रवेश पत्र)",
      subtitle: "Center Supdt / Head Slot",
      options: [
        { value: "principal", label: "Principal (Default)" },
        { value: "manager", label: "Manager" },
        { value: "director", label: "Director" },
        { value: "exam_controller", label: "Exam Controller" },
      ],
    },
    {
      key: "marksheet",
      title: "7. Marksheet / Report Card",
      subtitle: "Head of Institution Slot",
      options: [
        { value: "principal", label: "Principal (Default)" },
        { value: "manager", label: "Manager" },
        { value: "director", label: "Director" },
        { value: "exam_controller", label: "Exam Controller" },
      ],
    },
  ];

  return (
    <div
      className={`rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/25 ${
        compact ? "p-3 space-y-2.5" : "p-3.5 space-y-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>कहाँ किसका Signature दिखेगा? (Document Signature Settings)</span>
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            हर डॉक्यूमेंट के लिए खुद तय करें कि उस पर किस पद का नाम और डिजिटल हस्ताक्षर छपेगा।
          </p>
        </div>
        {saving && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Saving...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((row) => (
          <label
            key={row.key}
            className="block p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                {row.title}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {row.subtitle}
            </p>
            <select
              value={String(cfg[row.key] || "")}
              disabled={saving}
              onChange={(e) =>
                updateKey(row.key, e.target.value as any)
              }
              className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] font-bold cursor-pointer"
            >
              {row.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
};
