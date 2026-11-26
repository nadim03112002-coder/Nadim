import React, { useEffect, useMemo, useState } from "react";
import { BellRing, Check, Loader2, Search, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type {
  School,
  SchoolAccountant,
  SchoolTeacher,
  UpiAlertReceiverTarget,
} from "../../school-types";
import {
  getAccountants,
  getTeachers,
  resolveAuthorizedUpiReceivers,
  updateSchool,
} from "../../school-firebase";
import { pickLang, useAppLang } from "../../utils/appLang";

interface UpiAlertReceiverSelectorProps {
  school?: School | null;
  schoolId: string;
  teachers?: SchoolTeacher[];
  accountants?: SchoolAccountant[];
  onSchoolUpdated?: (updated: School) => void;
  compact?: boolean;
}

export const UpiAlertReceiverSelector: React.FC<UpiAlertReceiverSelectorProps> = ({
  school,
  schoolId,
  teachers: propTeachers,
  accountants: propAccountants,
  onSchoolUpdated,
  compact = false,
}) => {
  const [lang] = useAppLang();
  const t = (hi: string, en: string) => pickLang(lang, hi, en);

  const [teachers, setTeachers] = useState<SchoolTeacher[]>(propTeachers || []);
  const [accountants, setAccountants] = useState<SchoolAccountant[]>(propAccountants || []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Array.isArray(propTeachers) && propTeachers.length > 0) {
      setTeachers(propTeachers);
    } else if (schoolId) {
      getTeachers(schoolId).then((res) => setTeachers(res || [])).catch(() => {});
    }
  }, [schoolId, propTeachers]);

  useEffect(() => {
    if (Array.isArray(propAccountants) && propAccountants.length > 0) {
      setAccountants(propAccountants);
    } else if (schoolId) {
      getAccountants(schoolId).then((res) => setAccountants(res || [])).catch(() => {});
    }
  }, [schoolId, propAccountants]);

  const activeReceivers = useMemo(() => {
    return resolveAuthorizedUpiReceivers(school);
  }, [school]);

  const isSelected = (role: "admin" | "accountant" | "teacher", id: string) => {
    if (role === "admin") {
      return activeReceivers.some((r) => r.role === "admin");
    }
    if (role === "accountant") {
      return activeReceivers.some(
        (r) => r.role === "accountant" && (r.id === id || r.id === "accountant_admin")
      );
    }
    return activeReceivers.some((r) => r.role === "teacher" && r.id === id);
  };

  const candidates = useMemo(() => {
    const list: UpiAlertReceiverTarget[] = [
      {
        id: "admin",
        role: "admin",
        name: school?.principalName ? `${school.principalName} (Principal / Admin)` : "School Admin / Principal",
        phone: school?.phone || "",
      },
    ];
    for (const acc of accountants) {
      if (acc?.active === false) continue;
      list.push({
        id: acc.id,
        role: "accountant",
        name: acc.name || "Accountant",
        phone: acc.phone || "",
      });
    }
    for (const tch of teachers) {
      if (tch?.active === false) continue;
      list.push({
        id: tch.id,
        role: "teacher",
        name: tch.name || "Teacher",
        phone: tch.phone || "",
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q) ||
        String(item.phone || "").toLowerCase().includes(q)
    );
  }, [school?.principalName, school?.phone, accountants, teachers, search]);

  const handleToggle = async (target: UpiAlertReceiverTarget) => {
    if (!schoolId || saving) return;
    const currentlyChecked = isSelected(target.role, target.id);
    let nextReceivers: UpiAlertReceiverTarget[];

    if (currentlyChecked) {
      nextReceivers = activeReceivers.filter((r) => {
        if (target.role === "admin") return r.role !== "admin";
        if (target.role === "accountant") {
          return !(r.role === "accountant" && (r.id === target.id || r.id === "accountant_admin"));
        }
        return !(r.role === "teacher" && r.id === target.id);
      });
      if (nextReceivers.length === 0) {
        toast.warning(
          t(
            "कम से कम 1 व्यक्ति (Admin, Accountant या Teacher) UPI अलर्ट प्राप्त करने के लिए चुना होना ज़रूरी है।",
            "At least 1 receiver must remain selected for BharatPe / UPI alerts."
          )
        );
        return;
      }
    } else {
      const cleaned = activeReceivers.filter(
        (r) => !(r.role === target.role && r.id === target.id)
      );
      nextReceivers = [...cleaned, target];
    }

    setSaving(true);
    try {
      await updateSchool(schoolId, { upiAlertReceivers: nextReceivers });
      if (school) {
        onSchoolUpdated?.({ ...school, upiAlertReceivers: nextReceivers });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("school-upi-receivers-updated", {
            detail: { schoolId, upiAlertReceivers: nextReceivers },
          })
        );
      }
      toast.success(
        t(
          "BharatPe / UPI अलर्ट प्राप्तकर्ता लिस्ट अपडेट हो गई।",
          "UPI Alert Receiver list updated."
        )
      );
    } catch {
      toast.error(t("अपडेट करने में समस्या आई।", "Failed to update receivers."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/20 ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      } space-y-3`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BellRing className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {t(
                "BharatPe / UPI पेमेंट नोटिफिकेशन किसके मोबाइल पर जाए? (Admin Control)",
                "Who Receives BharatPe / UPI Payment Alerts? (Admin Control)"
              )}
            </span>
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {t(
              "जिसके मोबाइल में BharatPe ऐप या पेमेंट मैसेज आता है, केवल उन्हें चुनें (Admin, Accountant या कोई Teacher)। चुने गए व्यक्ति को ही स्क्रीनशॉट, UTR व कन्फर्म पॉप-अप मिलेगा।",
              "Select only the staff member(s) who check BharatPe payments (Admin, Accountant, or any Teacher). Only selected staff receive screenshot popups & alerts."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
          <span className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold tabular-nums inline-flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>
              {activeReceivers.length} {t("चुने गए", "Selected")}
            </span>
          </span>
        </div>
      </div>

      {candidates.length > 5 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("स्टाफ का नाम या फोन खोजें...", "Search staff name or phone...")}
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {candidates.map((cand) => {
          const selected = isSelected(cand.role, cand.id);
          const roleBadge =
            cand.role === "admin"
              ? "Admin"
              : cand.role === "accountant"
              ? "Accountant"
              : "Teacher";
          return (
            <button
              key={`${cand.role}_${cand.id}`}
              type="button"
              disabled={saving}
              onClick={() => void handleToggle(cand)}
              className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                selected
                  ? "bg-white dark:bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/40 shadow-xs"
                  : "bg-white/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {cand.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                      cand.role === "admin"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                        : cand.role === "accountant"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                    }`}
                  >
                    {roleBadge}
                  </span>
                  {cand.phone && (
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {cand.phone}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition ${
                  selected
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                }`}
              >
                {selected && <Check className="w-3.5 h-3.5" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          {t(
            "यह सेटिंग केवल School Admin ही बदल सकता है। चुने गए Teacher को ऑटोमैटिक 'UPI Payment Desk' और पॉप-अप मिल जाएगा।",
            "Only School Admin can change this. Selected Teachers automatically get the UPI Payment Desk & verification popup."
          )}
        </span>
      </div>
    </div>
  );
};
