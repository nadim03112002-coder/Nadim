import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Package,
  Search,
  CheckCircle2,
  Clock,
  IndianRupee,
  Printer,
  FileJson,
  Copy,
  Save,
  Loader2,
  CalendarClock,
  Check,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpRight,
  Eye,
  Ban,
  RotateCcw,
  ShoppingBag,
  X,
  CheckSquare,
} from "lucide-react";
import type {
  ClassFeeStructure,
  FeeTermCampaign,
  FeeTypeSchedulePlan,
  KitDeliveryStatusRecord,
  MonthlyFee,
  PostAdmissionPurchaseRecord,
  School,
  SchoolClass,
  SchoolStudent,
  SettledFeeHeadRecord,
  WaivedFeeHeadRecord,
} from "../../school-types";
import { sortSchoolClasses } from "../../school-types";
import {
  getLocalFees,
  getLocalStudents,
  getSchoolFeeHistory,
  saveFee,
  setLocalStudents,
  updateClassFeeStructure,
  updateSchool,
  updateStudent,
} from "../../school-firebase";
import {
  ADMISSION_KIT_ITEMS,
  buildRecommended12MonthSchoolJson,
  canonicalizeFeeHeadKey,
  computeStudentHeadSettlement,
  exportCurrentPlansToJson,
  getOneTimeKitRateForClass,
  getStudentStorePendingBreakdown,
  isStudentRegOnlyOrPending,
  parseScheduleJsonInput,
  stripUndefinedDeep,
  type StorePendingFeeHead,
} from "../../utils/feeTermScheduler";
import { formatMonthLabel } from "../../utils/feeFifoAllocation";
import { printElementInIframe } from "./AdmissionFormPrintModal";

interface Props {
  school: School;
  students?: SchoolStudent[];
  classes?: SchoolClass[];
  sessionId?: string;
  actorName?: string;
  isAdmin?: boolean;
  onBack?: () => void;
  onOpenTermPlanner?: () => void;
  onSchoolUpdated?: (patch: Partial<School>) => void;
  onClassUpdated?: (classId: string, feeStructure: ClassFeeStructure) => void;
  onStudentUpdated?: (updated: SchoolStudent) => void;
}

type KitWorkspaceTab = "tracker" | "one_time" | "term_json";
type TrackerFilter =
  | "all"
  | "taken_any"
  | "credit_taken"
  | "due"
  | "delivery_pending"
  | "full_paid"
  | "reg_only";
type ItemFocusFilter = "ALL" | "smart_id_card" | "school_diary" | "tie_belt_set" | "progress_folder" | "store_extra";
type ItemFocusMode = "taken" | "not_taken";

interface KitReceiptSnapshot {
  receiptNo: string;
  linkedFeeReceiptNo: string;
  date: string;
  studentName: string;
  className: string;
  rollNo: string;
  admissionNo: string;
  paymentMode: string;
  deliveredImmediately: boolean;
  items: Array<{ label: string; amount: number }>;
  totalAmount: number;
  collectedBy: string;
}

export const AdmissionKitManager: React.FC<Props> = ({
  school,
  students = [],
  classes = [],
  sessionId,
  actorName = "Admin",
  onBack,
  onOpenTermPlanner,
  onSchoolUpdated,
  onClassUpdated,
  onStudentUpdated,
}) => {
  const sortedClasses = useMemo(() => sortSchoolClasses(classes || []), [classes]);
  const classMap = useMemo(() => new Map(sortedClasses.map((c) => [c.id, c])), [sortedClasses]);

  const [activeTab, setActiveTab] = useState<KitWorkspaceTab>("tracker");
  const [feeHistory, setFeeHistory] = useState<MonthlyFee[]>(() => {
    try {
      return getLocalFees(school?.id) || [];
    } catch {
      return [];
    }
  });
  const [studentOverrides, setStudentOverrides] = useState<Record<string, SchoolStudent>>({});
  const [liveSchool, setLiveSchool] = useState<School>(school);

  useEffect(() => {
    setLiveSchool(school);
  }, [school]);

  useEffect(() => {
    if (!school?.id) return;
    let active = true;
    getSchoolFeeHistory(school.id)
      .then((list) => {
        if (active && Array.isArray(list)) {
          setFeeHistory(list);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [school?.id]);

  const mergedStudents = useMemo(
    () => students.map((st) => studentOverrides[st.id] || st),
    [students, studentOverrides]
  );

  // ── TAB 1: STUDENT KIT TRACKER STATE ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilterId, setClassFilterId] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<TrackerFilter>("all");
  const [itemFocusFilter, setItemFocusFilter] = useState<ItemFocusFilter>("ALL");
  const [itemFocusMode, setItemFocusMode] = useState<ItemFocusMode>("taken");
  const [trackerPage, setTrackerPage] = useState<number>(1);
  const [updatingDeliveryKey, setUpdatingDeliveryKey] = useState<string | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [bulkKitHeadKey, setBulkKitHeadKey] = useState<string>(ADMISSION_KIT_ITEMS[0].headKey);
  const [bulkDelivering, setBulkDelivering] = useState<boolean>(false);
  const registerPrintRef = useRef<HTMLDivElement>(null);
  const studentDetailPrintRef = useRef<HTMLDivElement>(null);

  const studentKitRows = useMemo(() => {
    const kitHeadSet = new Set<string>(ADMISSION_KIT_ITEMS.map((k) => k.headKey));
    return mergedStudents.map((st) => {
      const cls = classMap.get(st.classId);
      const settlement = computeStudentHeadSettlement({
        student: st,
        classObj: cls,
        feeHistory,
      });
      const isRegOnly = isStudentRegOnlyOrPending({ student: st, feeHistory, classObj: cls });

      let totalConfigured = 0;
      let totalPaid = 0;
      let totalDue = 0;
      let allPaid = true;
      let allDelivered = true;
      let anyDeliveryPendingAfterPaid = false;
      let anyCreditTaken = false;
      let deliveredKitCount = 0;

      const itemsStatus = ADMISSION_KIT_ITEMS.map((kit) => {
        const rate = getOneTimeKitRateForClass(cls, kit.headKey, liveSchool);
        const rec = settlement.settledByHead[kit.headKey];
        const waivedRec = st.waivedFeeHeads?.[kit.headKey];
        const isWaived = Boolean(waivedRec?.fullWaived);
        const settledAmt = Math.min(
          rate,
          Math.max(0, Math.round(Number(rec?.totalPaid || 0) + Number(rec?.waivedAmount || 0)))
        );
        const isPaid = rate === 0 || isWaived || Boolean(rec?.fullPaid) || settledAmt >= rate;
        const dueAmt = isPaid ? 0 : Math.max(0, rate - settledAmt);
        const deliveryRec = st.kitDeliveryStatus?.[kit.headKey];
        const delivered = Boolean(deliveryRec?.delivered);
        const deliveredOnCredit = delivered && !isPaid && dueAmt > 0;

        if (!isWaived) {
          totalConfigured += rate;
          totalPaid += isPaid ? rate : settledAmt;
          totalDue += dueAmt;
        }
        if (!isPaid) allPaid = false;
        if (rate > 0 && !isWaived && !delivered) allDelivered = false;
        if (isPaid && !isWaived && rate > 0 && !delivered) anyDeliveryPendingAfterPaid = true;
        if (deliveredOnCredit) anyCreditTaken = true;
        if (delivered) deliveredKitCount++;

        return {
          headKey: kit.headKey,
          shortLabel: kit.shortLabel,
          label: kit.label,
          rate,
          isWaived,
          isPaid,
          dueAmt,
          delivered,
          deliveredOnCredit,
          deliveredDate: deliveryRec?.deliveredDate,
          deliveredBy: deliveryRec?.deliveredBy,
        };
      });

      const storePurchases = [...(st.postAdmissionPurchases || [])].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
      const extraTakenMap = new Map<string, { name: string; qty: number; paid: number; lastDate: string }>();
      storePurchases.forEach((pur) => {
        (pur.items || []).forEach((it) => {
          const hk = it.headKey || canonicalizeFeeHeadKey(it.name);
          if (kitHeadSet.has(hk)) return;
          const prev = extraTakenMap.get(it.name) || {
            name: it.name,
            qty: 0,
            paid: 0,
            lastDate: pur.date || "",
          };
          extraTakenMap.set(it.name, {
            name: it.name,
            qty: prev.qty + Math.max(1, Number(it.quantity || 1)),
            paid: prev.paid + Number(it.paidAmount || 0),
            lastDate: pur.date || prev.lastDate,
          });
        });
      });
      const extraTakenItems = Array.from(extraTakenMap.values());
      const takenKitLabels = itemsStatus.filter((i) => i.delivered).map((i) => i.shortLabel);
      const takenAnyItem = deliveredKitCount > 0 || extraTakenItems.length > 0;

      return {
        student: st,
        classObj: cls,
        className: cls?.name || st.className || "Class",
        isRegOnly,
        itemsStatus,
        storePurchases,
        extraTakenItems,
        takenKitLabels,
        deliveredKitCount,
        takenAnyItem,
        totalConfigured,
        totalPaid,
        totalDue,
        allPaid,
        allDelivered,
        anyDeliveryPendingAfterPaid,
        anyCreditTaken,
      };
    });
  }, [mergedStudents, classMap, feeHistory, liveSchool]);

  const trackerMetrics = useMemo(() => {
    let fullPaidCount = 0;
    let dueStudentsCount = 0;
    let deliveryPendingCount = 0;
    let creditTakenCount = 0;
    let takenAnyCount = 0;
    let totalDueRupees = 0;
    let totalCollectedRupees = 0;

    const itemCounts: Record<string, { taken: number; udhaar: number; paidPendingDelivery: number }> = {};
    ADMISSION_KIT_ITEMS.forEach((k) => {
      itemCounts[k.headKey] = { taken: 0, udhaar: 0, paidPendingDelivery: 0 };
    });
    let storeExtraStudentsCount = 0;

    studentKitRows.forEach((row) => {
      if (row.allPaid && row.totalConfigured > 0) fullPaidCount++;
      if (row.totalDue > 0) dueStudentsCount++;
      if (row.anyDeliveryPendingAfterPaid) deliveryPendingCount++;
      if (row.anyCreditTaken) creditTakenCount++;
      if (row.takenAnyItem) takenAnyCount++;
      if (row.extraTakenItems.length > 0) storeExtraStudentsCount++;
      totalDueRupees += row.totalDue;
      totalCollectedRupees += row.totalPaid;

      row.itemsStatus.forEach((it) => {
        if (it.delivered) itemCounts[it.headKey].taken++;
        if (it.deliveredOnCredit) itemCounts[it.headKey].udhaar++;
        if (it.isPaid && !it.isWaived && it.rate > 0 && !it.delivered) {
          itemCounts[it.headKey].paidPendingDelivery++;
        }
      });
    });

    return {
      totalStudents: studentKitRows.length,
      fullPaidCount,
      dueStudentsCount,
      deliveryPendingCount,
      creditTakenCount,
      takenAnyCount,
      storeExtraStudentsCount,
      itemCounts,
      totalDueRupees,
      totalCollectedRupees,
    };
  }, [studentKitRows]);

  const filteredTrackerRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentKitRows.filter((row) => {
      if (classFilterId !== "ALL" && row.student.classId !== classFilterId) return false;
      if (statusFilter === "taken_any" && !row.takenAnyItem) return false;
      if (statusFilter === "credit_taken" && !row.anyCreditTaken) return false;
      if (statusFilter === "due" && row.totalDue <= 0) return false;
      if (statusFilter === "full_paid" && (!row.allPaid || row.totalConfigured <= 0)) return false;
      if (statusFilter === "delivery_pending" && !row.anyDeliveryPendingAfterPaid) return false;
      if (statusFilter === "reg_only" && !row.isRegOnly) return false;

      if (itemFocusFilter !== "ALL") {
        if (itemFocusFilter === "store_extra") {
          const hasExtra = row.extraTakenItems.length > 0;
          if (itemFocusMode === "taken" ? !hasExtra : hasExtra) return false;
        } else {
          const matchIt = row.itemsStatus.find((i) => i.headKey === itemFocusFilter);
          const hasIt = Boolean(matchIt?.delivered);
          if (itemFocusMode === "taken" ? !hasIt : hasIt) return false;
        }
      }

      if (!q) return true;
      return (
        (row.student.name || "").toLowerCase().includes(q) ||
        (row.student.rollNo || "").toLowerCase().includes(q) ||
        (row.student.admissionNo || "").toLowerCase().includes(q) ||
        (row.student.fatherName || "").toLowerCase().includes(q) ||
        row.extraTakenItems.some((ex) => ex.name.toLowerCase().includes(q))
      );
    });
  }, [studentKitRows, classFilterId, statusFilter, itemFocusFilter, itemFocusMode, searchQuery]);

  useEffect(() => {
    setTrackerPage(1);
  }, [classFilterId, statusFilter, itemFocusFilter, itemFocusMode, searchQuery]);

  const PAGE_SIZE = 50;
  const totalTrackerPages = Math.max(1, Math.ceil(filteredTrackerRows.length / PAGE_SIZE));
  const paginatedTrackerRows = useMemo(() => {
    const safePage = Math.min(trackerPage, totalTrackerPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTrackerRows.slice(start, start + PAGE_SIZE);
  }, [filteredTrackerRows, trackerPage, totalTrackerPages]);

  const detailRow = useMemo(
    () => (detailStudentId ? studentKitRows.find((r) => r.student.id === detailStudentId) || null : null),
    [studentKitRows, detailStudentId]
  );

  const persistStudentPatch = async (st: SchoolStudent, patch: Partial<SchoolStudent>) => {
    const cleanPatch = stripUndefinedDeep(patch);
    await updateStudent(liveSchool.id, st.id, cleanPatch);
    const updatedSt: SchoolStudent = { ...st, ...cleanPatch };
    setStudentOverrides((prev) => ({ ...prev, [st.id]: updatedSt }));
    try {
      const locals = getLocalStudents(liveSchool.id);
      setLocalStudents(liveSchool.id, [updatedSt, ...locals.filter((x) => x.id !== st.id)]);
      window.dispatchEvent(
        new CustomEvent("nsta:student-updated", {
          detail: { schoolId: liveSchool.id, student: updatedSt },
        })
      );
    } catch {}
    onStudentUpdated?.(updatedSt);
    return updatedSt;
  };

  const handleToggleItemDelivery = async (
    student: SchoolStudent,
    headKey: string,
    nextDelivered: boolean
  ) => {
    const opKey = `${student.id}_${headKey}`;
    setUpdatingDeliveryKey(opKey);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nextStatus: Record<string, KitDeliveryStatusRecord> = {
        ...(student.kitDeliveryStatus || {}),
        [headKey]: {
          delivered: nextDelivered,
          ...(nextDelivered ? { deliveredDate: todayStr, deliveredBy: actorName } : {}),
        },
      };
      await persistStudentPatch(student, { kitDeliveryStatus: nextStatus });
      toast.success(
        nextDelivered
          ? `${student.name} को सामान Delivered (लिया ✓) मार्क किया गया।`
          : `${student.name} का Delivery Status अपडेट हुआ।`
      );
    } catch (err: any) {
      toast.error(err?.message || "Delivery status save नहीं हो सका।");
    } finally {
      setUpdatingDeliveryKey(null);
    }
  };

  const handleToggleWaiveKitItem = async (
    student: SchoolStudent,
    headKey: string,
    label: string,
    rate: number,
    nextWaive: boolean
  ) => {
    const opKey = `${student.id}_waive_${headKey}`;
    setUpdatingDeliveryKey(opKey);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nextWaived: Record<string, WaivedFeeHeadRecord> = {
        ...(student.waivedFeeHeads || {}),
      };
      const nextSettled: Record<string, SettledFeeHeadRecord> = {
        ...(student.settledFeeHeads || {}),
      };
      if (nextWaive) {
        nextWaived[headKey] = {
          waivedAmount: Math.max(0, rate),
          fullWaived: true,
          label,
          reason: "Not Opted / Waived in Kit Tracker",
          date: todayStr,
          by: actorName,
        };
        nextSettled[headKey] = {
          ...(nextSettled[headKey] || { totalPaid: 0 }),
          fullPaid: true,
          waivedAmount: Math.max(0, rate),
          targetCap: Math.max(0, rate),
          source: "kit_waived",
          updatedAt: new Date().toISOString(),
        };
      } else {
        delete nextWaived[headKey];
        if (nextSettled[headKey]?.source === "kit_waived") {
          delete nextSettled[headKey];
        } else if (nextSettled[headKey]) {
          nextSettled[headKey] = {
            ...nextSettled[headKey],
            waivedAmount: 0,
            fullPaid: Boolean(
              nextSettled[headKey].targetCap &&
                nextSettled[headKey].totalPaid >= (nextSettled[headKey].targetCap || 0)
            ),
          };
        }
      }
      await persistStudentPatch(student, {
        waivedFeeHeads: nextWaived,
        settledFeeHeads: nextSettled,
      });
      toast.success(
        nextWaive
          ? `${student.name} के लिए "${label}" Exempt/Waive हो गया।`
          : `${student.name} के लिए "${label}" वापस सक्रिय किया गया।`
      );
    } catch (err: any) {
      toast.error(err?.message || "Waive अपडेट नहीं हो सका।");
    } finally {
      setUpdatingDeliveryKey(null);
    }
  };

  const handleBulkDeliverFilteredItem = async () => {
    const targetRows = filteredTrackerRows.filter((row) => {
      const item = row.itemsStatus.find((i) => i.headKey === bulkKitHeadKey);
      return item && item.rate > 0 && !item.isWaived && !item.delivered;
    });
    if (targetRows.length === 0) {
      toast.info("फ़िल्टर किए गए सभी छात्रों को यह आइटम पहले से मिल चुका है।");
      return;
    }
    setBulkDelivering(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      let updatedCount = 0;
      for (const row of targetRows) {
        const nextStatus: Record<string, KitDeliveryStatusRecord> = {
          ...(row.student.kitDeliveryStatus || {}),
          [bulkKitHeadKey]: {
            delivered: true,
            deliveredDate: todayStr,
            deliveredBy: actorName,
          },
        };
        await persistStudentPatch(row.student, { kitDeliveryStatus: nextStatus });
        updatedCount++;
      }
      const kitLabel =
        ADMISSION_KIT_ITEMS.find((k) => k.headKey === bulkKitHeadKey)?.shortLabel || bulkKitHeadKey;
      toast.success(`${updatedCount} छात्रों को "${kitLabel}" Delivered मार्क किया गया!`);
    } catch (err: any) {
      toast.error(err?.message || "Bulk delivery में समस्या आई।");
    } finally {
      setBulkDelivering(false);
    }
  };

  const handleMarkAllDeliveredForStudent = async (student: SchoolStudent) => {
    const opKey = `${student.id}_ALL`;
    setUpdatingDeliveryKey(opKey);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nextStatus: Record<string, KitDeliveryStatusRecord> = {
        ...(student.kitDeliveryStatus || {}),
      };
      ADMISSION_KIT_ITEMS.forEach((kit) => {
        if (!student.waivedFeeHeads?.[kit.headKey]?.fullWaived) {
          nextStatus[kit.headKey] = {
            delivered: true,
            deliveredDate: todayStr,
            deliveredBy: actorName,
          };
        }
      });
      await persistStudentPatch(student, { kitDeliveryStatus: nextStatus });
      toast.success(`${student.name} के सभी Kit आइटम Delivered हो गए।`);
    } catch (err: any) {
      toast.error(err?.message || "Update failed.");
    } finally {
      setUpdatingDeliveryKey(null);
    }
  };

  // ── TAB 2: ONE-TIME PAYMENT & CLASS DEFAULT KIT RATES ────────────────────────
  const [rateDraft, setRateDraft] = useState<Record<string, Record<string, number>>>({});
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    const init: Record<string, Record<string, number>> = {};
    ADMISSION_KIT_ITEMS.forEach((kit) => {
      init[kit.headKey] = {};
      sortedClasses.forEach((cls) => {
        init[kit.headKey][cls.id] = getOneTimeKitRateForClass(cls, kit.headKey, liveSchool);
      });
    });
    setRateDraft(init);
  }, [sortedClasses, liveSchool]);

  const handleSaveOneTimeClassRates = async () => {
    if (!liveSchool?.id) return;
    setSavingRates(true);
    try {
      const cleanRates = stripUndefinedDeep(rateDraft);
      await updateSchool(liveSchool.id, { admissionKitRates: cleanRates });

      // Also sync ClassFeeStructure fields so DirectAdmission, OnlineAdmission & Fee Ledger stay identical
      for (const cls of sortedClasses) {
        const fs: ClassFeeStructure = {
          admissionFee: cls.feeStructure?.admissionFee ?? 0,
          tuitionFee: cls.feeStructure?.tuitionFee ?? cls.defaultFee ?? 0,
          cautionMoney: cls.feeStructure?.cautionMoney ?? 0,
          annualCharges: cls.feeStructure?.annualCharges ?? 0,
          busFee: cls.feeStructure?.busFee ?? 350,
          ...(cls.feeStructure || {}),
          idCardCharge: cleanRates.smart_id_card?.[cls.id] ?? cls.feeStructure?.idCardCharge ?? 100,
          diaryCharge: cleanRates.school_diary?.[cls.id] ?? cls.feeStructure?.diaryCharge ?? 100,
          tieBeltCharge: cleanRates.tie_belt_set?.[cls.id] ?? cls.feeStructure?.tieBeltCharge ?? 150,
          progressFolderCharge:
            cleanRates.progress_folder?.[cls.id] ?? cls.feeStructure?.progressFolderCharge ?? 150,
          enabledHeads: {
            ...(cls.feeStructure?.enabledHeads || {}),
            idCardCharge: (cleanRates.smart_id_card?.[cls.id] ?? 100) > 0,
            diaryCharge: (cleanRates.school_diary?.[cls.id] ?? 100) > 0,
            tieBeltCharge: (cleanRates.tie_belt_set?.[cls.id] ?? 150) > 0,
            progressFolderCharge: (cleanRates.progress_folder?.[cls.id] ?? 150) > 0,
          },
        };
        await updateClassFeeStructure(liveSchool.id, cls.id, stripUndefinedDeep(fs)).catch(() => {});
        onClassUpdated?.(cls.id, fs);
      }

      const nextSchool = { ...liveSchool, admissionKitRates: cleanRates };
      setLiveSchool(nextSchool);
      onSchoolUpdated?.({ admissionKitRates: cleanRates });
      toast.success("सभी कक्षाओं के One-Time Admission Kit रेट सेव हो गए!");
    } catch (err: any) {
      toast.error(err?.message || "Kit रेट सेव करने में समस्या आई।");
    } finally {
      setSavingRates(false);
    }
  };

  // Counter One-Time Collection State
  const [counterStudentId, setCounterStudentId] = useState<string>("");
  const [counterSearch, setCounterSearch] = useState<string>("");
  const [selectedHeadKeys, setSelectedHeadKeys] = useState<Record<string, boolean>>({});
  const [paymentMode, setPaymentMode] = useState<"cash" | "online_upi" | "card">("cash");
  const [counterDiscount, setCounterDiscount] = useState<number>(0);
  const [markDeliveredNow, setMarkDeliveredNow] = useState<boolean>(true);
  const [collectingFee, setCollectingFee] = useState<boolean>(false);
  const [lastReceipt, setLastReceipt] = useState<KitReceiptSnapshot | null>(null);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  const counterStudent = useMemo(
    () => mergedStudents.find((s) => s.id === counterStudentId) || null,
    [mergedStudents, counterStudentId]
  );
  const counterStudentClass = counterStudent ? classMap.get(counterStudent.classId) : undefined;

  const counterBreakdown = useMemo(() => {
    if (!counterStudent) return null;
    return getStudentStorePendingBreakdown({
      student: counterStudent,
      classObj: counterStudentClass,
      school: liveSchool,
      feeHistory,
    });
  }, [counterStudent, counterStudentClass, liveSchool, feeHistory]);

  const counterCandidateList = useMemo(() => {
    const q = counterSearch.trim().toLowerCase();
    return mergedStudents
      .filter((st) => {
        if (!q) return true;
        return (
          (st.name || "").toLowerCase().includes(q) ||
          (st.rollNo || "").toLowerCase().includes(q) ||
          (st.admissionNo || "").toLowerCase().includes(q) ||
          (st.fatherName || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [mergedStudents, counterSearch]);

  const openStudentInCollector = (st: SchoolStudent) => {
    setCounterStudentId(st.id);
    setSelectedHeadKeys({});
    setCounterDiscount(0);
    setActiveTab("one_time");
  };

  const selectedCounterHeads = useMemo(() => {
    if (!counterBreakdown) return [];
    const pool: StorePendingFeeHead[] = [
      ...counterBreakdown.kitItems,
      ...counterBreakdown.feeHeads,
      ...counterBreakdown.examTerms,
    ];
    return pool.filter((h) => !h.isSettled && h.remainingAmount > 0 && selectedHeadKeys[h.id]);
  }, [counterBreakdown, selectedHeadKeys]);

  const selectedCounterGross = useMemo(
    () => selectedCounterHeads.reduce((sum, h) => sum + Number(h.remainingAmount || 0), 0),
    [selectedCounterHeads]
  );
  const effectiveDiscount = Math.min(selectedCounterGross, Math.max(0, Math.round(counterDiscount || 0)));
  const selectedCounterTotal = Math.max(0, selectedCounterGross - effectiveDiscount);

  const handleSelectAllPendingKitForStudent = () => {
    if (!counterBreakdown) return;
    const next: Record<string, boolean> = { ...selectedHeadKeys };
    counterBreakdown.kitItems.forEach((k) => {
      if (!k.isSettled && k.remainingAmount > 0) {
        next[k.id] = true;
      }
    });
    setSelectedHeadKeys(next);
  };

  const handleCompleteOneTimeKitPayment = async () => {
    if (!counterStudent || selectedCounterHeads.length === 0) {
      toast.error("कृपया कम से कम 1 बकाया आइटम चुनें।");
      return;
    }
    setCollectingFee(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nowIso = new Date().toISOString();
      const monthStr = todayStr.slice(0, 7);
      const receiptNo = `KIT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const linkedFeeReceiptNo = `KITF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Distribute optional discount proportionally across selected items
      let remDisc = effectiveDiscount;
      const itemAllocations = selectedCounterHeads.map((h, idx) => {
        const dueAmt = Number(h.remainingAmount || 0);
        let itemDisc = 0;
        if (remDisc > 0 && selectedCounterGross > 0) {
          itemDisc =
            idx === selectedCounterHeads.length - 1
              ? Math.min(dueAmt, remDisc)
              : Math.min(dueAmt, Math.round((dueAmt / selectedCounterGross) * effectiveDiscount));
          remDisc = Math.max(0, remDisc - itemDisc);
        }
        const paidAmt = Math.max(0, dueAmt - itemDisc);
        return { head: h, dueAmt, itemDisc, paidAmt };
      });

      const appliedTermFees = selectedCounterHeads
        .filter((h) => h.categoryType === "exam_term" && h.campaignId)
        .map((h) => ({
          campaignId: h.campaignId!,
          headKey: h.headKey || "exam",
          title: h.label,
          amount: h.remainingAmount,
          source: "term_campaign" as const,
        }));

      const feeRec: MonthlyFee = stripUndefinedDeep({
        schoolId: liveSchool.id,
        sessionId: sessionId || counterStudent.sessionId || "2026-27",
        studentId: counterStudent.id,
        studentName: counterStudent.name,
        rollNo: counterStudent.rollNo,
        classId: counterStudent.classId,
        month: monthStr,
        amount: selectedCounterGross,
        monthlyAmount: Number(counterStudent.monthlyFee || 0),
        paid: true,
        paidDate: nowIso,
        collectedByName: actorName,
        receiptNo: linkedFeeReceiptNo,
        paidAmount: selectedCounterTotal,
        balanceDue: 0,
        concession: effectiveDiscount,
        feeType: "store_fee_sync",
        receiptCategory: "store_fee_sync",
        note: `Admission Kit Counter #${receiptNo}${effectiveDiscount > 0 ? ` (Discount ₹${effectiveDiscount})` : ""}`,
        ...(appliedTermFees.length > 0 ? { appliedTermFees } : {}),
        payModeInfo: {
          payMode:
            paymentMode === "online_upi" ? "Online / UPI" : paymentMode === "card" ? "Card" : "Cash",
          date: todayStr,
          bank: "Admission Kit Counter",
          number: receiptNo,
        },
        items: itemAllocations.map(({ head: h, dueAmt, itemDisc, paidAmt }, idx) => ({
          id: h.id,
          slNo: idx + 1,
          description: h.label,
          due: dueAmt,
          con: itemDisc,
          paid: paidAmt,
          headKey: h.headKey,
        })),
      });

      await saveFee(feeRec).catch(() => undefined);
      setFeeHistory((prev) => [feeRec, ...prev]);

      const nextSettled: Record<string, SettledFeeHeadRecord> = {
        ...(counterStudent.settledFeeHeads || {}),
      };
      const nextDelivery: Record<string, KitDeliveryStatusRecord> = {
        ...(counterStudent.kitDeliveryStatus || {}),
      };
      const nextPaidCampaignIds = new Set<string>(counterStudent.paidCampaignIds || []);
      let nextAdvancePaid = Boolean(counterStudent.advanceMonthlyFeePaid);
      let nextAdvanceDue = counterStudent.advanceMonthlyFeeDue;
      let nextAdmDue = Math.max(0, Number(counterStudent.admissionDueBalance || 0));

      itemAllocations.forEach(({ head: h, dueAmt, itemDisc, paidAmt }) => {
        const hk = h.headKey || canonicalizeFeeHeadKey(h.label);
        const prev = nextSettled[hk];
        const totalPaid = (prev?.totalPaid || 0) + paidAmt;
        const totalWaived = (prev?.waivedAmount || 0) + itemDisc;
        const cap = Math.max(h.amount, prev?.targetCap || h.amount);
        nextSettled[hk] = {
          fullPaid: true,
          totalPaid,
          ...(totalWaived > 0 ? { waivedAmount: totalWaived } : {}),
          targetCap: cap,
          source: "admission_kit_hub",
          updatedAt: nowIso,
        };
        if (markDeliveredNow && h.categoryType === "kit_item") {
          nextDelivery[hk] = {
            delivered: true,
            deliveredDate: todayStr,
            deliveredBy: actorName,
          };
        }
        if (h.campaignId) {
          nextPaidCampaignIds.add(h.campaignId);
        }
        if (hk === "tuition_first_month") {
          nextAdvancePaid = true;
          nextAdvanceDue = 0;
        } else if (nextAdmDue > 0) {
          nextAdmDue = Math.max(0, nextAdmDue - dueAmt);
        }
      });

      const purchaseRecord: PostAdmissionPurchaseRecord = stripUndefinedDeep({
        id: `pur_${Date.now()}`,
        date: todayStr,
        receiptNo,
        source: "fee_desk",
        items: itemAllocations.map(({ head: h, dueAmt, itemDisc, paidAmt }) => ({
          name: h.label,
          headKey: h.headKey,
          ...(h.campaignId ? { campaignId: h.campaignId } : {}),
          categoryType: h.categoryType,
          quantity: 1,
          grossAmount: dueAmt,
          discountAmount: itemDisc,
          paidAmount: paidAmt,
        })),
        totalGross: selectedCounterGross,
        totalDiscount: effectiveDiscount,
        totalPaid: selectedCounterTotal,
        paymentMode:
          paymentMode === "online_upi" ? "Online / UPI" : paymentMode === "card" ? "Card" : "Cash",
        linkedFeeReceiptNo,
        updatedAt: nowIso,
      });

      const patch: Partial<SchoolStudent> = {
        settledFeeHeads: nextSettled,
        kitDeliveryStatus: nextDelivery,
        ...(nextPaidCampaignIds.size > 0 ? { paidCampaignIds: Array.from(nextPaidCampaignIds) } : {}),
        advanceMonthlyFeePaid: nextAdvancePaid,
        ...(nextAdvanceDue !== undefined ? { advanceMonthlyFeeDue: nextAdvanceDue } : {}),
        admissionDueBalance: nextAdmDue,
        postAdmissionPurchases: [...(counterStudent.postAdmissionPurchases || []), purchaseRecord],
      };

      await persistStudentPatch(counterStudent, patch);

      setLastReceipt({
        receiptNo,
        linkedFeeReceiptNo,
        date: todayStr,
        studentName: counterStudent.name,
        className: counterStudentClass?.name || counterStudent.className || "Class",
        rollNo: counterStudent.rollNo || "—",
        admissionNo: counterStudent.admissionNo || "—",
        paymentMode:
          paymentMode === "online_upi" ? "Online / UPI" : paymentMode === "card" ? "Card" : "Cash",
        deliveredImmediately: markDeliveredNow,
        items: itemAllocations.map(({ head: h, paidAmt }) => ({ label: h.label, amount: paidAmt })),
        totalAmount: selectedCounterTotal,
        collectedBy: actorName,
      });
      setSelectedHeadKeys({});
      setCounterDiscount(0);
      toast.success(`₹${selectedCounterTotal.toLocaleString("en-IN")} जमा व रसीद तैयार!`);
    } catch (err: any) {
      toast.error(err?.message || "Payment सेव करने में समस्या आई।");
    } finally {
      setCollectingFee(false);
    }
  };

  // ── TAB 3: TERM-WISE JSON CONTROL ────────────────────────────────────────────
  const [jsonInput, setJsonInput] = useState<string>(() => {
    const existing = liveSchool?.feeTypeSchedulePlans || {};
    if (Object.keys(existing).length > 0) {
      return JSON.stringify(
        exportCurrentPlansToJson({
          plans: existing,
          classes: sortedClasses,
          school: liveSchool,
        }),
        null,
        2
      );
    }
    return JSON.stringify(
      buildRecommended12MonthSchoolJson({ classes: sortedClasses, school: liveSchool }),
      null,
      2
    );
  });
  const [savingJson, setSavingJson] = useState(false);

  const jsonPreview = useMemo(() => {
    return parseScheduleJsonInput({
      rawJson: jsonInput,
      schoolId: liveSchool?.id || "",
      classes: sortedClasses,
      sessionId,
      actorName,
      existingPlans: liveSchool?.feeTypeSchedulePlans || {},
      existingCampaigns: liveSchool?.feeTermCampaigns || [],
      existingKitRates: liveSchool?.admissionKitRates || {},
      mergeWithExisting: true,
    });
  }, [jsonInput, liveSchool, sortedClasses, sessionId, actorName]);

  const handleLoad12MonthPreset = () => {
    const preset = buildRecommended12MonthSchoolJson({
      classes: sortedClasses,
      school: liveSchool,
    });
    setJsonInput(JSON.stringify(preset, null, 2));
    toast.success("12-Month School Calendar JSON लोड हो गया — नीचे Validate & Save दबाएं!");
  };

  const handleLoadCurrentSavedJson = () => {
    const doc = exportCurrentPlansToJson({
      plans: liveSchool?.feeTypeSchedulePlans || {},
      classes: sortedClasses,
      school: liveSchool,
    });
    setJsonInput(JSON.stringify(doc, null, 2));
    toast.info("वर्तमान सेव सेटअप JSON में लोड हो गया।");
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonInput);
      toast.success("JSON कॉपी हो गया!");
    } catch {
      toast.error("Copy नहीं हो पाया।");
    }
  };

  const handleApplyAndSaveJson = async () => {
    if (!jsonPreview.ok) {
      toast.error(jsonPreview.error || "JSON मान्य नहीं है।");
      return;
    }
    if (!liveSchool?.id) {
      toast.error("School ID नहीं मिला।");
      return;
    }
    setSavingJson(true);
    try {
      const cleanPlans = stripUndefinedDeep(jsonPreview.plans);
      const cleanCampaigns = stripUndefinedDeep(jsonPreview.campaigns);
      const cleanKitRates = stripUndefinedDeep(jsonPreview.oneTimeKitRates);

      await updateSchool(liveSchool.id, {
        feeTypeSchedulePlans: cleanPlans,
        feeTermCampaigns: cleanCampaigns,
        admissionKitRates: cleanKitRates,
      });

      // Also sync One-Time kit rates into each ClassFeeStructure if JSON defined them
      if (jsonPreview.summary.kitItemsUpdatedCount > 0) {
        for (const cls of sortedClasses) {
          const fs: ClassFeeStructure = {
            admissionFee: cls.feeStructure?.admissionFee ?? 0,
            tuitionFee: cls.feeStructure?.tuitionFee ?? cls.defaultFee ?? 0,
            cautionMoney: cls.feeStructure?.cautionMoney ?? 0,
            annualCharges: cls.feeStructure?.annualCharges ?? 0,
            busFee: cls.feeStructure?.busFee ?? 350,
            ...(cls.feeStructure || {}),
            idCardCharge:
              cleanKitRates.smart_id_card?.[cls.id] ?? cls.feeStructure?.idCardCharge ?? 100,
            diaryCharge:
              cleanKitRates.school_diary?.[cls.id] ?? cls.feeStructure?.diaryCharge ?? 100,
            tieBeltCharge:
              cleanKitRates.tie_belt_set?.[cls.id] ?? cls.feeStructure?.tieBeltCharge ?? 150,
            progressFolderCharge:
              cleanKitRates.progress_folder?.[cls.id] ??
              cls.feeStructure?.progressFolderCharge ??
              150,
          };
          await updateClassFeeStructure(liveSchool.id, cls.id, stripUndefinedDeep(fs)).catch(
            () => {}
          );
          onClassUpdated?.(cls.id, fs);
        }
      }

      const patch: Partial<School> = {
        feeTypeSchedulePlans: cleanPlans,
        feeTermCampaigns: cleanCampaigns,
        admissionKitRates: cleanKitRates,
      };
      setLiveSchool((prev) => ({ ...prev, ...patch }));
      onSchoolUpdated?.(patch);
      toast.success(
        `${jsonPreview.summary.feePagesCount} Fee Pages और ${jsonPreview.summary.totalTermsCount} Monthly Terms लागू हो गए!`
      );
    } catch (err: any) {
      toast.error(err?.message || "JSON रूल्स सेव करने में समस्या आई।");
    } finally {
      setSavingJson(false);
    }
  };

  const activeSavedPlansList = useMemo(
    () =>
      Object.values(liveSchool?.feeTypeSchedulePlans || {}).filter(
        (p): p is FeeTypeSchedulePlan => Boolean(p && p.enabled)
      ),
    [liveSchool?.feeTypeSchedulePlans]
  );

  // Month-by-Month Calendar Rollup for Display
  const calendarTimeline = useMemo(() => {
    const byMonth = new Map<string, Array<{ title: string; targetMode: string }>>();
    activeSavedPlansList.forEach((p) => {
      (p.terms || [])
        .filter((t) => t.active !== false)
        .forEach((t) => {
          const list = byMonth.get(t.targetMonth) || [];
          list.push({
            title: t.title || p.headLabel,
            targetMode: p.targetMode === "reg_only_or_unpaid" ? "Reg/Due Only" : "All Unpaid",
          });
          byMonth.set(t.targetMonth, list);
        });
    });
    return Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeSavedPlansList]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
                aria-label="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Admission Kit &amp; Term Control
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{sortedClasses.length} Classes</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{mergedStudents.length} Students</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{activeSavedPlansList.length} Term Rules Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenTermPlanner && (
              <button
                type="button"
                onClick={onOpenTermPlanner}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Fee Term Pages</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("term_json")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>JSON Term Setup</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Segmented Workspace Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto no-scrollbar print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("tracker")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === "tracker"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Student Kit Tracker (किसका क्या मिला / बाकी)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("one_time")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === "one_time"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Type 1 · One-Time Payment &amp; Kit Rates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("term_json")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === "term_json"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Type 2 · Term-Wise JSON Schedule (12-Month)
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: ALL-STUDENT KIT & ITEMS TAKEN TRACKER MATRIX
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "tracker" && (
          <div className="space-y-4">
            {/* Compact Tabular KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">Kuch Liya (Taken)</div>
                <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {trackerMetrics.takenAnyCount} / {trackerMetrics.totalStudents}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">Liya · Paisa Baki</div>
                <div className="text-xl font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400 mt-0.5">
                  {trackerMetrics.creditTakenCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">Full Kit Paid</div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {trackerMetrics.fullPaidCount} / {trackerMetrics.totalStudents}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">Paid · Delivery Baki</div>
                <div className="text-xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-0.5">
                  {trackerMetrics.deliveryPendingCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 col-span-2 sm:col-span-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Kit Baki (₹)</div>
                <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                  ₹{trackerMetrics.totalDueRupees.toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Item-Wise Summary Strip: Click any item to see who took it / who didn't */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  किस आइटम को कितने छात्रों ने लिया (Click करके लिस्ट फ़िल्टर करें):
                </span>
                {itemFocusFilter !== "ALL" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setItemFocusMode("taken")}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        itemFocusMode === "taken"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      जिन्होंने लिया
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemFocusMode("not_taken")}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        itemFocusMode === "not_taken"
                          ? "bg-amber-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      जिन्होंने नहीं लिया
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemFocusFilter("ALL")}
                      className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      Clear ×
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {ADMISSION_KIT_ITEMS.map((k) => {
                  const stat = trackerMetrics.itemCounts[k.headKey] || { taken: 0, udhaar: 0 };
                  const active = itemFocusFilter === k.headKey;
                  return (
                    <button
                      key={k.headKey}
                      type="button"
                      onClick={() =>
                        setItemFocusFilter((prev) => (prev === k.headKey ? "ALL" : k.headKey))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition cursor-pointer ${
                        active
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-400"
                      }`}
                    >
                      <span className="font-semibold">{k.shortLabel}</span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          active ? "text-white" : "text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        {stat.taken}/{trackerMetrics.totalStudents}
                      </span>
                      {stat.udhaar > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300"
                          }`}
                        >
                          {stat.udhaar} Udhaar
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setItemFocusFilter((prev) => (prev === "store_extra" ? "ALL" : "store_extra"))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition cursor-pointer ${
                    itemFocusFilter === "store_extra"
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-400"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span className="font-semibold">Store / Other Items</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      itemFocusFilter === "store_extra"
                        ? "text-white"
                        : "text-indigo-600 dark:text-indigo-400"
                    }`}
                  >
                    {trackerMetrics.storeExtraStudentsCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Filter, Bulk Deliver & Print Register Toolbar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="छात्र का नाम, Roll No, Adm No या लिया गया आइटम खोजें..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <select
                  value={classFilterId}
                  onChange={(e) => setClassFilterId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">All Classes ({mergedStudents.length})</option>
                  {sortedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Bulk Mark Delivered Control */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                  <select
                    value={bulkKitHeadKey}
                    onChange={(e) => setBulkKitHeadKey(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 px-1.5 py-1 outline-none"
                  >
                    {ADMISSION_KIT_ITEMS.map((k) => (
                      <option key={k.headKey} value={k.headKey}>
                        {k.shortLabel}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkDelivering || filteredTrackerRows.length === 0}
                    onClick={handleBulkDeliverFilteredItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 dark:bg-slate-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                  >
                    {bulkDelivering ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckSquare className="w-3 h-3" />
                    )}
                    <span>Bulk Give ({filteredTrackerRows.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={filteredTrackerRows.length === 0}
                  onClick={() => {
                    if (registerPrintRef.current) {
                      printElementInIframe(
                        registerPrintRef.current,
                        `Kaun Kya Liya Register (${filteredTrackerRows.length} Students)`,
                        "",
                        "landscape"
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-100 text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print List ({filteredTrackerRows.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto no-scrollbar">
                {[
                  { id: "all", label: "Sabhi" },
                  { id: "taken_any", label: `Kuch Liya (${trackerMetrics.takenAnyCount})` },
                  { id: "credit_taken", label: `Liya · Paisa Baki (${trackerMetrics.creditTakenCount})` },
                  { id: "due", label: `Kit Baki (${trackerMetrics.dueStudentsCount})` },
                  { id: "delivery_pending", label: `Delivery Baki (${trackerMetrics.deliveryPendingCount})` },
                  { id: "full_paid", label: "Full Paid" },
                  { id: "reg_only", label: "Reg-Only" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id as TrackerFilter)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      statusFilter === f.id
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {filteredTrackerRows.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Package className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    इस फ़िल्टर में कोई छात्र नहीं मिला
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    फ़िल्टर बदलें या "Type 1 · One-Time Payment" से नया भुगतान दर्ज करें।
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-semibold">
                          <th className="py-3 px-3.5 whitespace-nowrap">Student</th>
                          {ADMISSION_KIT_ITEMS.map((k) => (
                            <th key={k.headKey} className="py-3 px-2.5 whitespace-nowrap">
                              {k.shortLabel}
                            </th>
                          ))}
                          <th className="py-3 px-2.5 whitespace-nowrap">Store / Other Items</th>
                          <th className="py-3 px-3 text-right whitespace-nowrap">Paid / Baki</th>
                          <th className="py-3 px-3.5 text-right whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paginatedTrackerRows.map((row) => (
                          <tr
                            key={row.student.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {row.student.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {row.className} · Roll {row.student.rollNo || "—"} ·{" "}
                                {row.student.admissionPaymentPlan === "registration_only"
                                  ? "Reg-Only"
                                  : row.student.admissionPaymentPlan === "half_payment"
                                  ? "Half-Paid"
                                  : row.student.admissionPaymentPlan === "full_payment"
                                  ? "Full-Paid"
                                  : "Standard"}
                              </div>
                            </td>

                            {row.itemsStatus.map((it) => {
                              const busy =
                                updatingDeliveryKey === `${row.student.id}_${it.headKey}`;
                              return (
                                <td key={it.headKey} className="py-2.5 px-2.5 whitespace-nowrap">
                                  {it.rate === 0 ? (
                                    <span className="text-slate-400">—</span>
                                  ) : it.isWaived ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-medium text-slate-400">
                                        Nahi Chahiye
                                      </span>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleToggleWaiveKitItem(
                                            row.student,
                                            it.headKey,
                                            it.shortLabel,
                                            it.rate,
                                            false
                                          )
                                        }
                                        className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                                        title="Restore item charge"
                                      >
                                        Undo
                                      </button>
                                    </div>
                                  ) : it.isPaid ? (
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`font-semibold ${
                                          it.delivered
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-sky-600 dark:text-sky-400"
                                        }`}
                                        title={
                                          it.deliveredDate
                                            ? `Given on ${it.deliveredDate}${it.deliveredBy ? ` by ${it.deliveredBy}` : ""}`
                                            : undefined
                                        }
                                      >
                                        {it.delivered ? "Paid · Mil Gaya ✓" : "Paid · Dena Baki"}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleToggleItemDelivery(
                                            row.student,
                                            it.headKey,
                                            !it.delivered
                                          )
                                        }
                                        className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                                      >
                                        {busy ? "..." : it.delivered ? "Undo" : "Give ✓"}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`font-mono tabular-nums font-semibold ${
                                          it.delivered
                                            ? "text-orange-600 dark:text-orange-400"
                                            : "text-amber-600 dark:text-amber-400"
                                        }`}
                                        title={
                                          it.deliveredDate
                                            ? `Given on ${it.deliveredDate} (Payment pending)`
                                            : undefined
                                        }
                                      >
                                        {it.delivered ? `Liya · Baki ₹${it.dueAmt}` : `Baki ₹${it.dueAmt}`}
                                      </span>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleToggleItemDelivery(
                                            row.student,
                                            it.headKey,
                                            !it.delivered
                                          )
                                        }
                                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                          it.delivered
                                            ? "border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        }`}
                                        title={
                                          it.delivered
                                            ? "Mark as Not Taken"
                                            : "Mark Delivered on Credit (Samaan de diya, paisa baki)"
                                        }
                                      >
                                        {busy ? "..." : it.delivered ? "Undo" : "Give"}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            {/* Store / Extra Items Column */}
                            <td className="py-2.5 px-2.5 max-w-[200px]">
                              {row.extraTakenItems.length === 0 ? (
                                <span className="text-slate-400 text-[11px]">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {row.extraTakenItems.slice(0, 2).map((ex) => (
                                    <span
                                      key={ex.name}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 truncate max-w-[140px]"
                                      title={`${ex.name} ×${ex.qty} (₹${ex.paid})`}
                                    >
                                      {ex.name} ×{ex.qty}
                                    </span>
                                  ))}
                                  {row.extraTakenItems.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => setDetailStudentId(row.student.id)}
                                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                    >
                                      +{row.extraTakenItems.length - 2} more
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                              <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Paid ₹{row.totalPaid.toLocaleString("en-IN")}
                              </div>
                              {row.totalDue > 0 ? (
                                <div className="text-rose-600 dark:text-rose-400 font-bold">
                                  Baki ₹{row.totalDue.toLocaleString("en-IN")}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400">No Due</div>
                              )}
                            </td>

                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDetailStudentId(row.student.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                                  title="Dekhein is student ne kya-kya liya"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Details</span>
                                </button>
                                {row.totalDue > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openStudentInCollector(row.student)}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Collect
                                  </button>
                                )}
                                {row.allPaid && row.anyDeliveryPendingAfterPaid && (
                                  <button
                                    type="button"
                                    disabled={updatingDeliveryKey === `${row.student.id}_ALL`}
                                    onClick={() => handleMarkAllDeliveredForStudent(row.student)}
                                    className="px-2 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Give All
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {totalTrackerPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        Showing {(trackerPage - 1) * PAGE_SIZE + 1}–
                        {Math.min(trackerPage * PAGE_SIZE, filteredTrackerRows.length)} of{" "}
                        {filteredTrackerRows.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={trackerPage <= 1}
                          onClick={() => setTrackerPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          Prev
                        </button>
                        <span className="font-mono tabular-nums px-2">
                          {trackerPage} / {totalTrackerPages}
                        </span>
                        <button
                          type="button"
                          disabled={trackerPage >= totalTrackerPages}
                          onClick={() => setTrackerPage((p) => Math.min(totalTrackerPages, p + 1))}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: TYPE 1 — ONE-TIME PAYMENT & DEFAULT ADMISSION KIT RATES
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "one_time" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left / Top: Default Admission Kit Class-Wise Rate Table */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    One-Time Kit Rate Chart (Default)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    यहाँ से पूरे स्कूल के Admission Kit का Default रेट बदलें (JSON से भी सिंक होता है)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveOneTimeClassRates}
                  disabled={savingRates}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {savingRates ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Rates</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      <th className="py-2.5 px-3 whitespace-nowrap">Class</th>
                      {ADMISSION_KIT_ITEMS.map((k) => (
                        <th key={k.headKey} className="py-2.5 px-2 whitespace-nowrap">
                          {k.shortLabel}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedClasses.map((cls) => {
                      const rowSum = ADMISSION_KIT_ITEMS.reduce(
                        (s, k) => s + Number(rateDraft[k.headKey]?.[cls.id] ?? 0),
                        0
                      );
                      return (
                        <tr key={cls.id}>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {cls.name}
                          </td>
                          {ADMISSION_KIT_ITEMS.map((k) => (
                            <td key={k.headKey} className="py-1.5 px-1.5">
                              <input
                                type="number"
                                min={0}
                                value={rateDraft[k.headKey]?.[cls.id] ?? 0}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                                  setRateDraft((prev) => ({
                                    ...prev,
                                    [k.headKey]: {
                                      ...(prev[k.headKey] || {}),
                                      [cls.id]: val,
                                    },
                                  }));
                                }}
                                className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white"
                              />
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            ₹{rowSum}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right / Bottom: Counter One-Time Student Collection & Issue */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    One-Time Counter Payment &amp; Kit Issue
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    छात्र चुनें — केवल बाकी Kit/शुल्क का One-Time भुगतान लें, जो जमा होगा वह Term-Wise में ₹0 हो जाएगा
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={counterSearch}
                  onChange={(e) => setCounterSearch(e.target.value)}
                  placeholder="छात्र खोजें (Name, Roll No, Adm No, Father Name)..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              {!counterStudent ? (
                <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {counterCandidateList.map((st) => {
                    const cls = classMap.get(st.classId);
                    const isReg = isStudentRegOnlyOrPending({
                      student: st,
                      feeHistory,
                      classObj: cls,
                    });
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => openStudentInCollector(st)}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-indigo-500 text-left flex items-center justify-between gap-2 cursor-pointer transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {st.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {cls?.name || st.className} · Roll {st.rollNo || "—"}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ${
                            isReg
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {st.admissionPaymentPlan === "registration_only"
                            ? "Reg-Only"
                            : isReg
                            ? "Due Pending"
                            : "Full-Paid"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Student Header */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {counterStudent.name}{" "}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          · {counterStudentClass?.name || counterStudent.className} · Roll{" "}
                          {counterStudent.rollNo || "—"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Father: {counterStudent.fatherName || "—"} · Adm#:{" "}
                        {counterStudent.admissionNo || "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCounterStudentId("");
                        setSelectedHeadKeys({});
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer"
                    >
                      Change Student
                    </button>
                  </div>

                  {counterBreakdown && (
                    <>
                      {/* 1. Kit Items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Admission Kit (Smart ID Card, Diary, Tie-Belt, Report Card &amp; Folder)
                          </span>
                          <button
                            type="button"
                            onClick={handleSelectAllPendingKitForStudent}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            + Select All Pending Kit
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {counterBreakdown.kitItems.map((kh) => {
                            const checked = Boolean(selectedHeadKeys[kh.id]);
                            return (
                              <label
                                key={kh.id}
                                className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                                  kh.isSettled
                                    ? "bg-slate-100/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-70"
                                    : checked
                                    ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 cursor-pointer"
                                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 cursor-pointer"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {!kh.isSettled && (
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setSelectedHeadKeys((prev) => ({
                                          ...prev,
                                          [kh.id]: e.target.checked,
                                        }))
                                      }
                                      className="rounded accent-indigo-600"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                      {kh.label}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                      Rate ₹{kh.amount} · {kh.sourceLabel}
                                    </div>
                                  </div>
                                </div>
                                {kh.isSettled ? (
                                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    Paid ✓
                                  </span>
                                ) : (
                                  <span className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white shrink-0">
                                    ₹{kh.remainingAmount}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Other Pending Fee & Event Heads (1st Month Tuition, Campus, Sports, 15 Aug, 26 Jan, Exam) */}
                      {(counterBreakdown.feeHeads.length > 0 ||
                        counterBreakdown.examTerms.length > 0) && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Optional One-Time Fee / Events / Exam Payment (चाहें तो साथ में जमा करें)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
                            {[...counterBreakdown.feeHeads, ...counterBreakdown.examTerms].map(
                              (fh) => {
                                const checked = Boolean(selectedHeadKeys[fh.id]);
                                return (
                                  <label
                                    key={fh.id}
                                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                                      fh.isSettled
                                        ? "bg-slate-100/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-65"
                                        : checked
                                        ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 cursor-pointer"
                                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 cursor-pointer"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {!fh.isSettled && (
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) =>
                                            setSelectedHeadKeys((prev) => ({
                                              ...prev,
                                              [fh.id]: e.target.checked,
                                            }))
                                          }
                                          className="rounded accent-indigo-600"
                                        />
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                          {fh.label}
                                        </div>
                                        <div className="text-[10px] text-slate-500 truncate">
                                          {fh.sourceLabel}
                                        </div>
                                      </div>
                                    </div>
                                    {fh.isSettled ? (
                                      <span className="text-[11px] font-semibold text-emerald-600 shrink-0">
                                        Paid ✓
                                      </span>
                                    ) : (
                                      <span className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white shrink-0">
                                        ₹{fh.remainingAmount}
                                      </span>
                                    )}
                                  </label>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                      {/* Checkout Controls */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={markDeliveredNow}
                              onChange={(e) => setMarkDeliveredNow(e.target.checked)}
                              className="rounded accent-indigo-600"
                            />
                            <span>सामान हाथ में दे दिया (Mark Kit Delivered Now)</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                              Discount (₹):
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={selectedCounterGross}
                              value={counterDiscount || ""}
                              onChange={(e) =>
                                setCounterDiscount(Math.max(0, Math.round(Number(e.target.value) || 0)))
                              }
                              placeholder="0"
                              className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs font-semibold text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {(["cash", "online_upi", "card"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setPaymentMode(mode)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  paymentMode === mode
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                }`}
                              >
                                {mode === "cash" ? "Cash" : mode === "online_upi" ? "UPI" : "Card"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            Total Payable:{" "}
                            <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400 text-lg">
                              ₹{selectedCounterTotal.toLocaleString("en-IN")}
                            </span>
                            {effectiveDiscount > 0 && (
                              <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                                (Chhoot ₹{effectiveDiscount})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={collectingFee || selectedCounterHeads.length === 0}
                            onClick={handleCompleteOneTimeKitPayment}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                          >
                            {collectingFee ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <IndianRupee className="w-4 h-4" />
                            )}
                            <span>Collect Payment &amp; Generate Receipt</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Printable Receipt Preview after Payment */}
              {lastReceipt && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Receipt #{lastReceipt.receiptNo} Ready</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (receiptPrintRef.current) {
                          printElementInIframe(receiptPrintRef.current, `Receipt ${lastReceipt.receiptNo}`);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Receipt</span>
                    </button>
                  </div>

                  <div
                    ref={receiptPrintRef}
                    className="p-4 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <div className="font-bold text-sm">{liveSchool.name || "School"}</div>
                        <div className="text-[11px] text-slate-500">
                          Admission Kit &amp; Fee Receipt · {lastReceipt.date}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <div>#{lastReceipt.receiptNo}</div>
                        <div className="text-slate-500">Ledger: {lastReceipt.linkedFeeReceiptNo}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                      <div>
                        Student: <strong>{lastReceipt.studentName}</strong> ({lastReceipt.className} ·
                        Roll {lastReceipt.rollNo})
                      </div>
                      <div>
                        Mode: <strong>{lastReceipt.paymentMode}</strong> ·{" "}
                        {lastReceipt.deliveredImmediately ? "Items Delivered ✓" : "Payment Recorded"}
                      </div>
                    </div>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-1 text-left">Particulars</th>
                          <th className="py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastReceipt.items.map((it, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="py-1">{it.label}</td>
                            <td className="py-1 text-right font-mono tabular-nums">
                              ₹{it.amount.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                        <tr className="font-bold">
                          <td className="py-1.5">Total Paid</td>
                          <td className="py-1.5 text-right font-mono tabular-nums">
                            ₹{lastReceipt.totalAmount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3: TYPE 2 — TERM-WISE JSON SCHEDULE (12-MONTH SCHOOL CALENDAR)
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "term_json" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* JSON Editor Panel */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    JSON Auto-Setup (One-Time Kit Rates + 12-Month Term Schedule)
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    1 क्लिक में रेडी 12-महीने का कैलेंडर (हर 2 महीने पर Exam + Kit + Events) लोड करें या JSON एडिट करके Save दबाएं
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoad12MonthPreset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Load 12-Month School Calendar Preset</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadCurrentSavedJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <span>Load Current Saved Setup</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </button>
              </div>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />

              {/* Validation Feedback */}
              {jsonPreview.ok ? (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="tabular-nums">
                      Ready: {jsonPreview.summary.feePagesCount} Fee Pages ·{" "}
                      {jsonPreview.summary.totalTermsCount} Monthly Terms ·{" "}
                      {jsonPreview.summary.kitItemsUpdatedCount} Kit Rates ·{" "}
                      {jsonPreview.summary.matchedClassesCount} Classes Matched
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAndSaveJson}
                    disabled={savingJson}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                  >
                    {savingJson ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Validate &amp; Save All Rules</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{jsonPreview.error}</span>
                </div>
              )}
            </div>

            {/* Right: Live Month-by-Month Calendar View */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Active 12-Month Fee Schedule
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    किस महीने में कौन सा शुल्क अपने-आप जुड़ेगा (One-Time Paid छात्रों पर ₹0 रहेगा)
                  </p>
                </div>
              </div>

              {calendarTimeline.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <Clock className="w-6 h-6 mx-auto text-slate-400" />
                  <p>अभी कोई Term Rule सेव नहीं है। बाईं ओर से "Load 12-Month School Calendar Preset" और फिर "Validate &amp; Save All Rules" दबाएं।</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto pr-1">
                  {calendarTimeline.map(([mKey, list]) => (
                    <div key={mKey} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap pt-0.5">
                        {/^\d{4}-\d{2}$/.test(mKey) ? formatMonthLabel(mKey) : mKey}
                      </div>
                      <div className="flex-1 space-y-1 text-right">
                        {list.map((entry, i) => (
                          <div key={i} className="text-slate-800 dark:text-slate-200">
                            <span className="font-semibold">{entry.title}</span>{" "}
                            <span className="text-[10px] text-slate-500">({entry.targetMode})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          STUDENT "KAUN KYA LIYA" FULL ITEMS & PURCHASE HISTORY MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {detailRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 print:hidden">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {detailRow.student.name} — क्या-क्या लिया है (Items Ledger)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {detailRow.className} · Roll {detailRow.student.rollNo || "—"} · Father:{" "}
                  {detailRow.student.fatherName || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (studentDetailPrintRef.current) {
                      printElementInIframe(
                        studentDetailPrintRef.current,
                        `${detailRow.student.name} Kit Slip`
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailStudentId(null)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs" ref={studentDetailPrintRef}>
              {/* Summary Strip */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Kit Items Taken</div>
                  <div className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {detailRow.deliveredKitCount} / {ADMISSION_KIT_ITEMS.length}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Kit Paid</div>
                  <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{detailRow.totalPaid.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Kit Baki</div>
                  <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                    ₹{detailRow.totalDue.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* Section 1: Admission Kit Items */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  1. Admission Kit आइटम्स (ID Card, Diary, Tie-Belt, Folder)
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {detailRow.itemsStatus.map((it) => {
                    const busy =
                      updatingDeliveryKey === `${detailRow.student.id}_${it.headKey}` ||
                      updatingDeliveryKey === `${detailRow.student.id}_waive_${it.headKey}`;
                    return (
                      <div
                        key={it.headKey}
                        className="p-3 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {it.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Rate: ₹{it.rate} ·{" "}
                            {it.isWaived
                              ? "Waived / Nahi Chahiye"
                              : it.isPaid
                              ? "Payment Paid ✓"
                              : `Payment Baki ₹${it.dueAmt}`}
                            {it.deliveredDate
                              ? ` · Given: ${it.deliveredDate}${it.deliveredBy ? ` (${it.deliveredBy})` : ""}`
                              : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 print:hidden">
                          {!it.isWaived && it.rate > 0 && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleToggleItemDelivery(
                                  detailRow.student,
                                  it.headKey,
                                  !it.delivered
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                                it.delivered
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                                  : "bg-indigo-600 border-indigo-600 text-white"
                              }`}
                            >
                              {it.delivered
                                ? "Mil Gaya ✓ (Undo)"
                                : it.isPaid
                                ? "Give ✓"
                                : "Give (Udhaar)"}
                            </button>
                          )}
                          {!it.isPaid || it.isWaived ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleToggleWaiveKitItem(
                                  detailRow.student,
                                  it.headKey,
                                  it.shortLabel,
                                  it.rate,
                                  !it.isWaived
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {it.isWaived ? (
                                <>
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3 h-3" />
                                  <span>Nahi Chahiye</span>
                                </>
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Store & Post-Admission Purchases */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  2. School Store / Post-Admission से लिए गए अन्य आइटम्स (Uniform, Books, आदि)
                </div>
                {detailRow.storePurchases.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500">
                    अभी तक Store या अलग से कोई अन्य सामान/रसीद दर्ज नहीं है।
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailRow.storePurchases.map((pur) => (
                      <div
                        key={pur.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            #{pur.receiptNo} · {pur.date} ({pur.source === "store" ? "School Store" : "Kit Counter"})
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            Paid ₹{Number(pur.totalPaid || 0).toLocaleString("en-IN")} ({pur.paymentMode})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(pur.items || []).map((pi, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-800 dark:text-slate-200"
                            >
                              {pi.name} ×{pi.quantity} (₹{pi.paidAmount})
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden A4 Landscape Register for Printing "Kaun-Kaun Student Kya-Kya Liya Hai" */}
      <div className="hidden">
        <div ref={registerPrintRef} className="p-4 bg-white text-slate-900 text-xs">
          <div className="border-b-2 border-slate-900 pb-2 mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">{liveSchool.name || "School"}</h2>
              <p className="text-[11px] text-slate-600">
                Student Kit &amp; Items Taken Register (कौन-कौन छात्र क्या-क्या लिया है)
              </p>
            </div>
            <div className="text-right text-[11px]">
              <div>Date: {new Date().toISOString().split("T")[0]}</div>
              <div>Total Students: {filteredTrackerRows.length}</div>
            </div>
          </div>
          <table className="w-full border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1.5 text-left">Roll / Adm</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left">Student &amp; Class</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left">Kit Items Taken (क्या मिला)</th>
                <th className="border border-slate-300 px-2 py-1.5 text-left">Store / Other Items</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right">Paid (₹)</th>
                <th className="border border-slate-300 px-2 py-1.5 text-right">Baki (₹)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrackerRows.map((row) => {
                const kitTakenLabels = row.itemsStatus
                  .filter((i) => i.delivered)
                  .map((i) => `${i.shortLabel}${i.deliveredOnCredit ? " (Udhaar)" : ""}`);
                const storeLabels = row.extraTakenItems.map((ex) => `${ex.name} ×${ex.qty}`);
                return (
                  <tr key={row.student.id}>
                    <td className="border border-slate-300 px-2 py-1">
                      {row.student.rollNo || "—"} / {row.student.admissionNo || "—"}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      <strong>{row.student.name}</strong> ({row.className})
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      {kitTakenLabels.length > 0 ? kitTakenLabels.join(", ") : "Kuch Nahi"}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      {storeLabels.length > 0 ? storeLabels.join(", ") : "—"}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                      ₹{row.totalPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                      ₹{row.totalDue.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
