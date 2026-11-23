import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { get, ref } from "firebase/database";
import {
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  BookOpen,
  UserCog,
  Building2,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { db, rtdb, subscribeToUsers } from "../../firebase";
import type {
  School,
  SchoolAccountant,
  SchoolStudent,
  SchoolTeacher,
  StaffEmployee,
} from "../../school-types";

export interface UnifiedAccountEntry {
  key: string;
  id: string;
  name: string;
  roleCategory: "STUDENT" | "TEACHER" | "ADMIN" | "STAFF" | "APP_USER";
  roleLabel: string;
  mobile: string;
  email: string;
  schoolId: string;
  schoolName: string;
  subInfo: string;
  hasRecovery: boolean;
  source: string;
}

interface AdminAccountsDirectoryProps {
  schoolId?: string;
  schoolName?: string;
  school?: School | null;
  schools?: School[];
  students?: SchoolStudent[];
  teachers?: SchoolTeacher[];
  accountants?: SchoolAccountant[];
  staffList?: StaffEmployee[];
  isSuperAdminMode?: boolean;
  theme?: "current" | "white" | "black";
}

const normalizeKeyPart = (v?: string | null) => String(v || "").trim().toLowerCase();

export const AdminAccountsDirectory: React.FC<AdminAccountsDirectoryProps> = ({
  schoolId,
  schoolName,
  school,
  schools = [],
  students = [],
  teachers = [],
  accountants = [],
  staffList = [],
  isSuperAdminMode = false,
  theme = "current",
}) => {
  const isWhite = theme === "white";
  const isBlack = theme === "black";

  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [schoolUsers, setSchoolUsers] = useState<any[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "STUDENT" | "TEACHER" | "ADMIN" | "STAFF" | "APP_USER">("ALL");
  const [schoolFilter, setSchoolFilter] = useState<string>("ALL");
  const [recoveryFilter, setRecoveryFilter] = useState<"ALL" | "SECURED" | "PENDING">("ALL");
  const [refreshTick, setRefreshTick] = useState(0);

  // 1. Live subscription to platform `users` collection
  useEffect(() => {
    setLoadingRemote(true);
    const unsub = subscribeToUsers((list) => {
      setLiveUsers(Array.isArray(list) ? list : []);
      setLoadingRemote(false);
    });
    const fallbackTimer = setTimeout(() => setLoadingRemote(false), 3000);
    return () => {
      clearTimeout(fallbackTimer);
      if (typeof unsub === "function") unsub();
    };
  }, [refreshTick]);

  // 2. Load `school_users` mapping collection (RTDB + Firestore merged)
  useEffect(() => {
    let active = true;
    const loadSchoolUsers = async () => {
      const mergedMap = new Map<string, any>();

      if (rtdb) {
        try {
          const snap = await get(ref(rtdb, "school_users")).catch(() => null);
          if (snap && snap.exists()) {
            const val = snap.val();
            if (val && typeof val === "object") {
              Object.values(val).forEach((item: any) => {
                if (item && (item.uid || item.email)) {
                  mergedMap.set(String(item.uid || item.email), item);
                }
              });
            }
          }
        } catch {}
      }

      if (db) {
        try {
          const fsSnap = await getDocs(collection(db, "school_users")).catch(() => null);
          if (fsSnap && !fsSnap.empty) {
            fsSnap.docs.forEach((docSnap) => {
              const item = docSnap.data();
              if (item) {
                mergedMap.set(String(item.uid || docSnap.id), { ...item, uid: item.uid || docSnap.id });
              }
            });
          }
        } catch {}
      }

      if (active) {
        setSchoolUsers(Array.from(mergedMap.values()));
      }
    };

    loadSchoolUsers();
    return () => {
      active = false;
    };
  }, [refreshTick]);

  const schoolNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (schoolId && (schoolName || school?.name)) {
      map.set(schoolId, schoolName || school?.name || schoolId);
    }
    schools.forEach((s) => {
      if (s.id) map.set(s.id, s.name || s.id);
    });
    return map;
  }, [schoolId, schoolName, school, schools]);

  // Build deduplicated master account directory
  const accounts = useMemo<UnifiedAccountEntry[]>(() => {
    const entries: UnifiedAccountEntry[] = [];
    const seenById = new Map<string, number>();
    const seenByPhone = new Map<string, number>();
    const seenByEmail = new Map<string, number>();

    const checkHasRecovery = (obj: any): boolean => {
      if (!obj) return false;
      const hasContact = Boolean(
        obj.recoveryMobile || obj.recoveryEmail || obj.mobile || obj.phone || obj.email
      );
      const hasSecret = Boolean(obj.securityAnswer || obj.recoveryPassword);
      return Boolean(hasContact && hasSecret);
    };

    const upsertEntry = (candidate: UnifiedAccountEntry) => {
      const idKey = normalizeKeyPart(candidate.id);
      const phoneKey = String(candidate.mobile || "").replace(/\D/g, "").slice(-10);
      const emailKey = normalizeKeyPart(candidate.email);

      let existingIdx: number | undefined;
      if (idKey && seenById.has(idKey)) existingIdx = seenById.get(idKey);
      else if (phoneKey && phoneKey.length === 10 && seenByPhone.has(phoneKey)) existingIdx = seenByPhone.get(phoneKey);
      else if (emailKey && !emailKey.endsWith("@nsta.app") && seenByEmail.has(emailKey)) existingIdx = seenByEmail.get(emailKey);

      if (existingIdx !== undefined) {
        const prev = entries[existingIdx];
        entries[existingIdx] = {
          ...prev,
          name: prev.name && prev.name !== "User" ? prev.name : candidate.name,
          mobile: prev.mobile || candidate.mobile,
          email: prev.email || candidate.email,
          hasRecovery: prev.hasRecovery || candidate.hasRecovery,
          subInfo: prev.subInfo || candidate.subInfo,
          schoolName: prev.schoolName || candidate.schoolName,
          source: prev.source.includes(candidate.source) ? prev.source : `${prev.source} + ${candidate.source}`,
        };
        return;
      }

      const nextIdx = entries.length;
      entries.push(candidate);
      if (idKey) seenById.set(idKey, nextIdx);
      if (phoneKey && phoneKey.length === 10) seenByPhone.set(phoneKey, nextIdx);
      if (emailKey && !emailKey.endsWith("@nsta.app")) seenByEmail.set(emailKey, nextIdx);
    };

    // Map live `users` by id/email/phone for cross-referencing recovery status
    const recoveryUserIndex = new Map<string, any>();
    liveUsers.forEach((u) => {
      const idK = normalizeKeyPart(u.id || u.uid || u.displayId);
      const emK = normalizeKeyPart(u.email || u.recoveryEmail);
      const phK = String(u.recoveryMobile || u.mobile || "").replace(/\D/g, "").slice(-10);
      if (idK) recoveryUserIndex.set(idK, u);
      if (emK) recoveryUserIndex.set(emK, u);
      if (phK.length === 10) recoveryUserIndex.set(phK, u);
    });

    // A. In School Admin mode: add school's Admin, Teachers, Students, Accountants, Staff
    if (!isSuperAdminMode && schoolId) {
      if (school) {
        const admEmail = normalizeKeyPart(school.adminEmail || school.email);
        const linkedAdm = recoveryUserIndex.get(admEmail);
        upsertEntry({
          key: `adm_${school.id}`,
          id: linkedAdm?.id || school.id,
          name: school.principalName || `${school.name} Admin`,
          roleCategory: "ADMIN",
          roleLabel: "School Admin / Principal",
          mobile: school.phone || linkedAdm?.recoveryMobile || linkedAdm?.mobile || "",
          email: school.adminEmail || school.email || linkedAdm?.email || "",
          schoolId: school.id,
          schoolName: school.name,
          subInfo: "School Management Owner",
          hasRecovery: checkHasRecovery(linkedAdm),
          source: "School Profile",
        });
      }

      teachers.forEach((t) => {
        const ph = String(t.phone || "").replace(/\D/g, "").slice(-10);
        const em = normalizeKeyPart(t.email);
        const linked = recoveryUserIndex.get(normalizeKeyPart(t.id)) || recoveryUserIndex.get(em) || recoveryUserIndex.get(ph);
        upsertEntry({
          key: `tch_${t.id}`,
          id: t.id,
          name: t.name || "Teacher",
          roleCategory: "TEACHER",
          roleLabel: t.designation || "Teacher",
          mobile: t.phone || linked?.mobile || "",
          email: t.email || linked?.email || "",
          schoolId,
          schoolName: school?.name || schoolName || "",
          subInfo: [Array.isArray(t.subjects) ? t.subjects.join(", ") : (t as any).subject, t.assignedClassName].filter(Boolean).join(" • ") || "Faculty",
          hasRecovery: checkHasRecovery(t) || checkHasRecovery(linked),
          source: "Teacher Roster",
        });
      });

      students.forEach((s) => {
        const ph = String(s.phone || "").replace(/\D/g, "").slice(-10);
        const em = normalizeKeyPart((s as any).email);
        const linked = recoveryUserIndex.get(normalizeKeyPart(s.id)) || recoveryUserIndex.get(em) || recoveryUserIndex.get(ph);
        upsertEntry({
          key: `std_${s.id}`,
          id: s.admissionNo || s.rollNo || s.id,
          name: s.name || "Student",
          roleCategory: "STUDENT",
          roleLabel: "Student",
          mobile: s.phone || linked?.mobile || "",
          email: (s as any).email || linked?.email || "",
          schoolId,
          schoolName: school?.name || schoolName || "",
          subInfo: [s.className, s.rollNo ? `Roll #${s.rollNo}` : ""].filter(Boolean).join(" • ") || "Student Account",
          hasRecovery: checkHasRecovery(s) || checkHasRecovery(linked),
          source: "Student Roster",
        });
      });

      accountants.forEach((a) => {
        const ph = String(a.phone || "").replace(/\D/g, "").slice(-10);
        const linked = recoveryUserIndex.get(normalizeKeyPart(a.id)) || recoveryUserIndex.get(ph);
        upsertEntry({
          key: `acc_${a.id}`,
          id: a.id,
          name: a.name || "Accountant",
          roleCategory: "STAFF",
          roleLabel: "Accountant",
          mobile: a.phone || linked?.mobile || "",
          email: (a as any).email || linked?.email || "",
          schoolId,
          schoolName: school?.name || schoolName || "",
          subInfo: "Fee & Accounts Desk",
          hasRecovery: checkHasRecovery(a) || checkHasRecovery(linked),
          source: "Accountant",
        });
      });

      staffList.forEach((st) => {
        const ph = String(st.phone || "").replace(/\D/g, "").slice(-10);
        const linked = recoveryUserIndex.get(normalizeKeyPart(st.id)) || recoveryUserIndex.get(ph);
        upsertEntry({
          key: `stf_${st.id}`,
          id: st.id,
          name: st.name || "Staff",
          roleCategory: "STAFF",
          roleLabel: st.designation || st.department || "School Staff",
          mobile: st.phone || linked?.mobile || "",
          email: st.email || linked?.email || "",
          schoolId,
          schoolName: school?.name || schoolName || "",
          subInfo: st.department || "Support Staff",
          hasRecovery: checkHasRecovery(st) || checkHasRecovery(linked),
          source: "Staff HRM",
        });
      });
    } else if (isSuperAdminMode) {
      // SuperAdmin: Include School Admin accounts from every registered school
      schools.forEach((sc) => {
        const admEmail = normalizeKeyPart(sc.adminEmail || sc.email);
        const linked = recoveryUserIndex.get(admEmail);
        upsertEntry({
          key: `sa_adm_${sc.id}`,
          id: linked?.id || sc.id,
          name: sc.principalName || `${sc.name} Admin`,
          roleCategory: "ADMIN",
          roleLabel: "School Admin",
          mobile: sc.phone || linked?.mobile || "",
          email: sc.adminEmail || sc.email || "",
          schoolId: sc.id,
          schoolName: sc.name,
          subInfo: sc.active ? "Active School" : "Suspended School",
          hasRecovery: checkHasRecovery(linked),
          source: "School Record",
        });
      });
    }

    // B. Merge `school_users`
    schoolUsers.forEach((su) => {
      const sid = String(su.schoolId || "");
      if (!isSuperAdminMode && schoolId && sid && sid !== schoolId) return;

      const r = String(su.role || "").toUpperCase();
      const cat: UnifiedAccountEntry["roleCategory"] =
        r.includes("ADMIN") ? "ADMIN" : r.includes("TEACHER") ? "TEACHER" : r.includes("STUDENT") ? "STUDENT" : "STAFF";

      upsertEntry({
        key: `su_${su.uid}`,
        id: su.uid || su.email || "",
        name: su.name || "School User",
        roleCategory: cat,
        roleLabel: r.replace(/_/g, " ") || "School User",
        mobile: su.recoveryMobile || su.phone || "",
        email: su.recoveryEmail || su.email || "",
        schoolId: sid,
        schoolName: schoolNameMap.get(sid) || sid || "School",
        subInfo: "School Portal Login",
        hasRecovery: checkHasRecovery(su),
        source: "School Users",
      });
    });

    // C. Merge App `users` collection
    liveUsers.forEach((u) => {
      const sid = String(u.schoolId || "");
      const uRole = String(u.role || "STUDENT").toUpperCase();

      if (!isSuperAdminMode && schoolId) {
        const matchesThisSchool = sid === schoolId;
        if (!matchesThisSchool) return;
      }

      const cat: UnifiedAccountEntry["roleCategory"] =
        uRole === "SUPERADMIN" || uRole === "ADMIN" || uRole === "SUB_ADMIN" || uRole === "SCHOOL_ADMIN" || uRole === "SCHOOL_SUB_ADMIN"
          ? "ADMIN"
          : uRole === "TEACHER"
          ? "TEACHER"
          : uRole === "SCHOOL_STUDENT" || uRole === "STUDENT"
          ? "STUDENT"
          : uRole.includes("STAFF") || uRole.includes("ACCOUNTANT")
          ? "STAFF"
          : "APP_USER";

      upsertEntry({
        key: `usr_${u.id || u.uid || u.displayId}`,
        id: u.displayId || u.id || u.uid || "",
        name: u.name || "App User",
        roleCategory: cat,
        roleLabel: uRole === "ADMIN" ? "Main Admin" : uRole.replace(/_/g, " "),
        mobile: u.recoveryMobile || u.mobile || u.phone || "",
        email: u.recoveryEmail || u.email || "",
        schoolId: sid,
        schoolName: schoolNameMap.get(sid) || u.schoolName || (sid ? sid : "NSTA Main App"),
        subInfo: u.classLevel ? `Class ${u.classLevel}` : "App Login Account",
        hasRecovery: checkHasRecovery(u),
        source: "App Users",
      });
    });

    return entries;
  }, [
    isSuperAdminMode,
    schoolId,
    school,
    schools,
    schoolName,
    schoolNameMap,
    students,
    teachers,
    accountants,
    staffList,
    schoolUsers,
    liveUsers,
  ]);

  const counts = useMemo(() => {
    const total = accounts.length;
    const studentCount = accounts.filter((a) => a.roleCategory === "STUDENT").length;
    const teacherCount = accounts.filter((a) => a.roleCategory === "TEACHER").length;
    const adminCount = accounts.filter((a) => a.roleCategory === "ADMIN").length;
    const staffCount = accounts.filter((a) => a.roleCategory === "STAFF").length;
    const appUserCount = accounts.filter((a) => a.roleCategory === "APP_USER").length;
    const securedCount = accounts.filter((a) => a.hasRecovery).length;
    return { total, studentCount, teacherCount, adminCount, staffCount, appUserCount, securedCount };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (roleFilter !== "ALL" && acc.roleCategory !== roleFilter) return false;
      if (isSuperAdminMode && schoolFilter !== "ALL" && acc.schoolId !== schoolFilter) return false;
      if (recoveryFilter === "SECURED" && !acc.hasRecovery) return false;
      if (recoveryFilter === "PENDING" && acc.hasRecovery) return false;
      if (!q) return true;
      return (
        acc.name.toLowerCase().includes(q) ||
        acc.id.toLowerCase().includes(q) ||
        acc.mobile.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.roleLabel.toLowerCase().includes(q) ||
        acc.schoolName.toLowerCase().includes(q)
      );
    });
  }, [accounts, roleFilter, schoolFilter, recoveryFilter, searchQuery, isSuperAdminMode]);

  const cardSurface = isWhite
    ? "bg-white border-slate-200 text-slate-900"
    : isBlack
    ? "bg-[#09090b] border-neutral-800 text-white"
    : "bg-[#0d1c3a] border-[#213d73] text-white";

  const subSurface = isWhite
    ? "bg-slate-50 border-slate-200 text-slate-800"
    : isBlack
    ? "bg-neutral-900 border-neutral-800 text-slate-100"
    : "bg-[#09152d] border-[#1c3566] text-slate-100";

  const muted = isWhite ? "text-slate-500" : "text-slate-400";

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Summary Banner */}
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4 ${cardSurface}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black">
                  {isSuperAdminMode ? "Platform All Accounts Directory" : "School Total Accounts Directory"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-black tabular-nums">
                  Total: {counts.total}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${muted}`}>
                {isSuperAdminMode
                  ? "सभी स्कूल एडमिन, शिक्षक, छात्र और ऐप यूज़र अकाउंट्स का लाइव डेटा"
                  : `${school?.name || schoolName || "School"} के कुल सक्रिय अकाउंट्स व रिकवरी स्थिति`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 ${subSurface}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRemote ? "animate-spin" : ""}`} />
            <span>Refresh Count</span>
          </button>
        </div>

        {/* Role Breakdown KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className={`rounded-xl border p-3 ${subSurface}`}>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Total Accounts</p>
            <p className="text-xl font-black text-indigo-500 tabular-nums mt-0.5">{counts.total}</p>
          </div>
          <div className={`rounded-xl border p-3 ${subSurface}`}>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Students</p>
            <p className="text-xl font-black text-sky-500 tabular-nums mt-0.5">{counts.studentCount}</p>
          </div>
          <div className={`rounded-xl border p-3 ${subSurface}`}>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Teachers</p>
            <p className="text-xl font-black text-emerald-500 tabular-nums mt-0.5">{counts.teacherCount}</p>
          </div>
          <div className={`rounded-xl border p-3 ${subSurface}`}>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Admins</p>
            <p className="text-xl font-black text-amber-500 tabular-nums mt-0.5">{counts.adminCount}</p>
          </div>
          <div className={`rounded-xl border p-3 ${subSurface}`}>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Staff / Acc</p>
            <p className="text-xl font-black text-purple-500 tabular-nums mt-0.5">{counts.staffCount}</p>
          </div>
          <div className={`rounded-xl border p-3 ${subSurface}`}>
            <p className={`text-[10px] font-bold uppercase ${muted}`}>Recovery Set</p>
            <p className="text-xl font-black text-teal-500 tabular-nums mt-0.5">
              {counts.securedCount}
              <span className={`text-xs font-semibold ml-1 ${muted}`}>/ {counts.total}</span>
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${muted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, mobile, email..."
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${subSurface}`}
            />
          </div>

          {isSuperAdminMode && schools.length > 0 && (
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${subSurface}`}
            >
              <option value="ALL">All Schools ({schools.length})</option>
              {schools.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={recoveryFilter}
            onChange={(e) => setRecoveryFilter(e.target.value as any)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${subSurface}`}
          >
            <option value="ALL">Recovery: All</option>
            <option value="SECURED">Recovery Set ({counts.securedCount})</option>
            <option value="PENDING">Recovery Pending ({Math.max(0, counts.total - counts.securedCount)})</option>
          </select>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "ALL", label: `All (${counts.total})` },
            { id: "STUDENT", label: `Students (${counts.studentCount})` },
            { id: "TEACHER", label: `Teachers (${counts.teacherCount})` },
            { id: "ADMIN", label: `Admins (${counts.adminCount})` },
            { id: "STAFF", label: `Staff / Acc (${counts.staffCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roleFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : `${subSurface} hover:border-indigo-400`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Directory List */}
      <div className={`rounded-2xl border overflow-hidden shadow-xs ${cardSurface}`}>
        <div className="px-4 py-3 border-b border-slate-200/20 flex items-center justify-between text-xs font-bold">
          <span>Showing {filteredAccounts.length} accounts</span>
          {loadingRemote && <span className={muted}>Syncing live accounts...</span>}
        </div>

        {filteredAccounts.length === 0 ? (
          <div className={`py-12 text-center text-xs ${muted}`}>
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-semibold">Koi account match nahi hua</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/15 max-h-[600px] overflow-y-auto">
            {filteredAccounts.slice(0, 250).map((acc) => {
              const RoleIcon =
                acc.roleCategory === "STUDENT"
                  ? BookOpen
                  : acc.roleCategory === "TEACHER"
                  ? GraduationCap
                  : acc.roleCategory === "ADMIN"
                  ? UserCog
                  : Building2;

              return (
                <div key={acc.key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        acc.roleCategory === "STUDENT"
                          ? "bg-sky-500/15 border-sky-500/30 text-sky-500"
                          : acc.roleCategory === "TEACHER"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                          : acc.roleCategory === "ADMIN"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-500"
                          : "bg-purple-500/15 border-purple-500/30 text-purple-500"
                      }`}
                    >
                      <RoleIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold truncate">{acc.name}</p>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-400">
                          {acc.roleLabel}
                        </span>
                        {acc.id && (
                          <span className={`text-[10px] font-mono ${muted}`}>#{acc.id}</span>
                        )}
                      </div>
                      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mt-1 ${muted}`}>
                        {acc.mobile && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3" /> {acc.mobile}
                          </span>
                        )}
                        {acc.email && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                            <Mail className="w-3 h-3" /> {acc.email}
                          </span>
                        )}
                        {acc.subInfo && <span>• {acc.subInfo}</span>}
                        {isSuperAdminMode && acc.schoolName && <span>• {acc.schoolName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${subSurface}`}>
                      {acc.source}
                    </span>
                    {acc.hasRecovery ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" /> Recovery Set
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" /> Not Set
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredAccounts.length > 250 && (
              <div className={`px-4 py-2.5 text-center text-xs font-semibold ${muted}`}>
                Showing top 250 of {filteredAccounts.length} accounts — refine search to filter specific accounts.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAccountsDirectory;
