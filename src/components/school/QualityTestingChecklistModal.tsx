import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getNativeCallerIdStatus, type NativeCallerIdStatus } from "../../utils/schoolCallerId";

export interface QaChecklistItem {
  id: number;
  title: string;
  category: "CALLER_ID" | "CALL_FLOW" | "VOICE_SECURITY" | "OFFLINE_AUDIT";
  description: string;
  nativeOnly?: boolean;
}

export const PHASE3_QA_CHECKLIST_ITEMS: QaChecklistItem[] = [
  {
    id: 1,
    title: "Incoming Parent Caller ID – Native APK",
    category: "CALLER_ID",
    description:
      "Real SIM incoming call aane par Parent ka naam, bacche ka naam, class aur total baki fee screen ke upar card me dikhna chahiye.",
    nativeOnly: true,
  },
  {
    id: 2,
    title: "Outgoing Parent Caller ID – Native APK",
    category: "CALLER_ID",
    description:
      "Dialer ya ERP se parent ko outgoing call karte waqt bhi verified parent card aur child summary dikhna chahiye.",
    nativeOnly: true,
  },
  {
    id: 3,
    title: "Unknown Number Handling",
    category: "CALLER_ID",
    description:
      "Jo number ERP directory me nahi hai us par galat student card na dikhe, balki clean Unknown Caller screen aur Save Enquiry option aaye.",
  },
  {
    id: 4,
    title: "Multiple Children – Same Parent Number",
    category: "CALLER_ID",
    description:
      "Ek hi pita ke 2 ya 3 bacche hone par sabhi bacchon ki alag-alag Paid aur Due fee breakup ek hi card me dikhna chahiye.",
  },
  {
    id: 5,
    title: "Audio Call aur Video Call",
    category: "CALL_FLOW",
    description:
      "NSTA Messenger ke andar Parent/Teacher/Staff Audio aur Video call connect hone aur Call History me record save hone ki jaanch.",
  },
  {
    id: 6,
    title: "Call katne ke baad Automatic Update",
    category: "CALL_FLOW",
    description:
      "Call samapt hote hi Post-Call screen khule, sabhi 9 Call Outcomes dikhein aur Remark + Next Call Date ke bina save na ho.",
  },
  {
    id: 7,
    title: "Missed Call History",
    category: "CALL_FLOW",
    description:
      "Missed call aane par Missed indicator, Call History list me entry aur 1-tap Callback button sahi kaam kare.",
  },
  {
    id: 8,
    title: "Promise Date Follow-up",
    category: "CALL_FLOW",
    description:
      "Aaj ki Promise Date wale parents priority tab me upar dikhein aur overdue promise wale automatically Overdue list me aayein.",
  },
  {
    id: 9,
    title: "Partial Payment aur Balance Update",
    category: "CALL_FLOW",
    description:
      "Partial Fee Jama Ki outcome select karne par jama rashi darj ho aur baki bachi balance calculation sahi update dikhe.",
  },
  {
    id: 10,
    title: "Full Payment par Follow-up Auto Close",
    category: "CALL_FLOW",
    description:
      "Full fee jama hote hi pending call follow-up automatically settled / closed mark ho jaye aur call queue se hat jaye.",
  },
  {
    id: 11,
    title: "Hindi Voice Announcement",
    category: "VOICE_SECURITY",
    description:
      "Staff Privacy Mode aur Parent Formal Hindi Reminder dono alag-alag test hon; privacy mode ON par speaker par ₹ fee amount na bole.",
  },
  {
    id: 12,
    title: "Staff Permission aur Access Control",
    category: "VOICE_SECURITY",
    description:
      "Accountant ke manual discount/cancel par Principal authorization aur Student Monitor sirf School Admin ke liye unlock ho.",
  },
  {
    id: 13,
    title: "Internet band hone par Data Handling",
    category: "OFFLINE_AUDIT",
    description:
      "Weak ya offline internet me follow-up local queue me surakshit save ho aur net aate hi automatic cloud sync ho jaye.",
  },
  {
    id: 14,
    title: "Duplicate Call Prevention",
    category: "OFFLINE_AUDIT",
    description:
      "Ek hi incoming call par baar-baar voice speech repeat na ho (debounce guard) aur duplicate SIM logs double save na hon.",
  },
  {
    id: 15,
    title: "Audit Log aur Backup",
    category: "OFFLINE_AUDIT",
    description:
      "Fee Discount, Receipt Cancel, Mark Solve (with reason) aur Wrong Phone Update har action ka timestamp aur staff naam audit log me darj ho.",
  },
];

interface QualityTestingChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  schoolName?: string;
}

interface QaItemState {
  checked: boolean;
  note?: string;
  updatedAt?: string;
}

const STORAGE_PREFIX = "nst_qa_checklist_v1_";

export const QualityTestingChecklistModal: React.FC<QualityTestingChecklistModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  schoolName,
}) => {
  const storageKey = `${STORAGE_PREFIX}${schoolId || "global"}`;
  const [checkedMap, setCheckedMap] = useState<Record<number, QaItemState>>({});
  const [filterMode, setFilterMode] = useState<"ALL" | "PENDING" | "PASSED">("ALL");
  const [nativeStatus, setNativeStatus] = useState<NativeCallerIdStatus>(() =>
    getNativeCallerIdStatus()
  );

  useEffect(() => {
    if (!isOpen) return;
    setNativeStatus(getNativeCallerIdStatus());
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setCheckedMap(parsed);
        }
      }
    } catch {}
  }, [isOpen, storageKey]);

  const persistMap = (next: Record<number, QaItemState>) => {
    setCheckedMap(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("nst-qa-checklist-updated", { detail: next }));
    } catch {}
  };

  const toggleItem = (id: number) => {
    const prev = checkedMap[id];
    const nextChecked = !prev?.checked;
    const next: Record<number, QaItemState> = {
      ...checkedMap,
      [id]: {
        checked: nextChecked,
        note: prev?.note || "",
        updatedAt: new Date().toISOString(),
      },
    };
    persistMap(next);
  };

  const updateItemNote = (id: number, note: string) => {
    const prev = checkedMap[id];
    const next: Record<number, QaItemState> = {
      ...checkedMap,
      [id]: {
        checked: Boolean(prev?.checked),
        note,
        updatedAt: new Date().toISOString(),
      },
    };
    persistMap(next);
  };

  const handleReset = () => {
    persistMap({});
    toast.success("QA Checklist 0/15 par reset kar di gayi.");
  };

  const completedCount = useMemo(
    () =>
      PHASE3_QA_CHECKLIST_ITEMS.reduce(
        (sum, item) => sum + (checkedMap[item.id]?.checked ? 1 : 0),
        0
      ),
    [checkedMap]
  );

  const visibleItems = useMemo(() => {
    return PHASE3_QA_CHECKLIST_ITEMS.filter((item) => {
      const isDone = Boolean(checkedMap[item.id]?.checked);
      if (filterMode === "PENDING") return !isDone;
      if (filterMode === "PASSED") return isDone;
      return true;
    });
  }, [checkedMap, filterMode]);

  if (!isOpen) return null;

  const progressPct = Math.round((completedCount / PHASE3_QA_CHECKLIST_ITEMS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-[130] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="SCHOOL+ Quality Testing Checklist"
    >
      <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1326] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0f1933] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                Phase 3 Quality Testing Checklist
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {schoolName || "SCHOOL+ ERP"} · Real Device aur Functional Verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition"
              aria-label="Close QA Checklist"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress + Environment Banner */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-[#0b1326]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                {completedCount}/15 Complete
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                ({progressPct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: "All (15)" },
                  { id: "PENDING", label: `Pending (${15 - completedCount})` },
                  { id: "PASSED", label: `Passed (${completedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-bold cursor-pointer transition whitespace-nowrap ${
                    filterMode === tab.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                completedCount === 15 ? "bg-emerald-500" : "bg-indigo-600"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div
            className={`rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2 border ${
              nativeStatus.isNativeApp
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
            }`}
          >
            {nativeStatus.isNativeApp ? (
              <>
                <Smartphone className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Native Android APK Detected — SIM Caller ID aur Call Log sync items live verify kar sakte hain.
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Browser Preview Mode: SIM Incoming/Outgoing aur Overlay permissions ko final PASS mark karne se pehle real Android APK me zaroor test karein.
                </span>
              </>
            )}
          </div>
        </div>

        {/* Checklist Items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {visibleItems.map((item) => {
            const state = checkedMap[item.id];
            const isChecked = Boolean(state?.checked);
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3.5 transition ${
                  isChecked
                    ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className={`mt-0.5 h-6 w-6 rounded-lg border flex items-center justify-center shrink-0 cursor-pointer transition ${
                      isChecked
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-500"
                    }`}
                    aria-label={`Toggle ${item.title}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="text-left text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                      >
                        <span className="font-mono tabular-nums text-slate-400 mr-1.5">
                          {String(item.id).padStart(2, "0")}.
                        </span>
                        <span className={isChecked ? "line-through text-emerald-800 dark:text-emerald-200" : ""}>
                          {item.title}
                        </span>
                      </button>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          item.nativeOnly
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.nativeOnly ? "Native APK Verify" : "ERP Verify"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                    <input
                      type="text"
                      value={state?.note || ""}
                      onChange={(e) => updateItemNote(item.id, e.target.value)}
                      placeholder="Optional tester note (device model / build / observation)..."
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0f1933] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Progress device browser me auto-save rehta hai.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold cursor-pointer transition whitespace-nowrap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export function getQaChecklistCompletedCount(schoolId?: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${schoolId || "global"}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return 0;
    return PHASE3_QA_CHECKLIST_ITEMS.reduce(
      (sum, item) => sum + (parsed[item.id]?.checked ? 1 : 0),
      0
    );
  } catch {
    return 0;
  }
}
