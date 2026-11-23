// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  ShoppingBag, Plus, Search, Tag, AlertTriangle, Printer, Trash2,
  Edit3, CheckCircle2, Check, IndianRupee, QrCode, Filter, ChevronLeft,
  Package, Receipt, ArrowRight, Sparkles, RefreshCw, Clock,
  Camera, Upload, ImageIcon, X, UserCheck, BookOpen, GraduationCap
} from "lucide-react";
import type {
  School, SchoolStudent, SchoolClass,
  StoreInventoryItem, StoreSaleRecord, StoreReservationBooking,
  MonthlyFee, PostAdmissionPurchaseRecord, SettledFeeHeadRecord, WaivedFeeHeadRecord
} from "../../school-types";
import { speakNotification } from "../../utils/voiceNotifyEngine";
import {
  loadSchoolSubcollection,
  syncSchoolSubcollection,
  loadMergedStoreSales,
  loadMergedStoreReservations,
} from "../../utils/schoolCloudSync";
import { computePaymentBreakdown, formatStorePaymentModeLabel } from "../../utils/paymentBreakdown";
import { printElementInIframe } from "./AdmissionFormPrintModal";
import {
  shouldUseDemoForSchool,
  updateStudent,
  saveFee,
  getLocalFees,
  getSchoolFeeHistory,
  getLocalStudents,
  setLocalStudents,
} from "../../school-firebase";
import {
  getStudentStorePendingBreakdown,
  canonicalizeFeeHeadKey,
  getConfiguredHeadAmountForClass,
  type StorePendingFeeHead,
} from "../../utils/feeTermScheduler";
import {
  normalizeClassNameForChart,
  resolveEffectiveClassForAdmission,
} from "../../utils/schoolFeeChart2027";

interface Props {
  school: School;
  students?: SchoolStudent[];
  classes?: SchoolClass[];
  isAdmin?: boolean;
  onBack?: () => void;
  onStudentUpdated?: (updated: SchoolStudent) => void;
}

interface BillCartLine {
  lineId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  categoryType: "store_item" | "kit_item" | "fee_head" | "exam_term";
  headKey?: string;
  campaignId?: string;
  targetMonth?: string;
}

const STORE_CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "uniform", label: "Uniforms (वर्दी)" },
  { id: "books", label: "Books & Notebooks (किताबें)" },
  { id: "accessories", label: "Tie, Belt & Badges (टाई, बेल्ट)" },
  { id: "stationery", label: "Stationery (स्टेशनरी)" },
  { id: "sports", label: "Sports & Activity (खेलकूद)" }
];

export const InventoryStoreManager: React.FC<Props> = ({
  school,
  students = [],
  classes = [],
  isAdmin = true,
  onBack,
  onStudentUpdated
}) => {
  const invStorageKey = useMemo(() => `nst_school_store_items_${school?.id || "default"}`, [school?.id]);
  const salesStorageKey = useMemo(() => `nst_school_store_sales_${school?.id || "default"}`, [school?.id]);
  const resStorageKey = useMemo(() => `nst_school_store_reservations_${school?.id || "default"}`, [school?.id]);

  const isDemo = shouldUseDemoForSchool(school?.id);
  // Inventory Items List
  const [items, setItems] = useState<StoreInventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(invStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn("[InventoryStoreManager] Failed reading store items:", err);
    }
    if (!isDemo) return [];
    return [
      {
        id: "item-1",
        schoolId: school?.id || "",
        itemCode: "UNIF-01",
        name: "School Uniform Shirt (White)",
        category: "uniform",
        sizeOrVariant: "Size 32",
        purchasePrice: 280,
        salePrice: 380,
        stockQuantity: 45,
        lowStockAlert: 10,
        unit: "Pcs",
        updatedAt: new Date().toISOString()
      },
      {
        id: "item-2",
        schoolId: school?.id || "",
        itemCode: "UNIF-02",
        name: "School Uniform Trouser / Pant (Navy Blue)",
        category: "uniform",
        sizeOrVariant: "Size 32",
        purchasePrice: 350,
        salePrice: 480,
        stockQuantity: 30,
        lowStockAlert: 8,
        unit: "Pcs",
        updatedAt: new Date().toISOString()
      },
      {
        id: "item-3",
        schoolId: school?.id || "",
        itemCode: "ACC-01",
        name: "School Belt & Tie Combo Set",
        category: "accessories",
        sizeOrVariant: "Standard",
        purchasePrice: 110,
        salePrice: 180,
        stockQuantity: 6,
        lowStockAlert: 10, // Low stock trigger
        unit: "Set",
        updatedAt: new Date().toISOString()
      },
      {
        id: "item-4",
        schoolId: school?.id || "",
        itemCode: "BK-10",
        name: "Complete NCERT Class 10 Textbook Set",
        category: "books",
        sizeOrVariant: "Full Set (6 Books)",
        purchasePrice: 950,
        salePrice: 1150,
        stockQuantity: 22,
        lowStockAlert: 5,
        unit: "Set",
        updatedAt: new Date().toISOString()
      },
      {
        id: "item-5",
        schoolId: school?.id || "",
        itemCode: "STAT-01",
        name: "Four-Line Notebook Bundle (Pack of 6)",
        category: "stationery",
        sizeOrVariant: "172 Pages",
        purchasePrice: 150,
        salePrice: 220,
        stockQuantity: 80,
        lowStockAlert: 15,
        unit: "Pack",
        updatedAt: new Date().toISOString()
      }
    ];
  });

  // Sales Records List
  const [sales, setSales] = useState<StoreSaleRecord[]>(() => {
    try {
      const saved = localStorage.getItem(salesStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn("[InventoryStoreManager] Failed reading store sales:", err);
    }
    return [];
  });

  // Online Student 24-Hour Reservations List
  const [reservations, setReservations] = useState<StoreReservationBooking[]>(() => {
    try {
      const saved = localStorage.getItem(resStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn("[InventoryStoreManager] Failed reading store reservations:", err);
    }
    return [];
  });

  // Local synced fee history & student overrides so Store immediately knows Paid vs Pending heads
  const [feeHistory, setFeeHistory] = useState<MonthlyFee[]>(() => {
    try {
      return getLocalFees(school?.id || "");
    } catch {
      return [];
    }
  });
  const [studentOverrides, setStudentOverrides] = useState<Record<string, SchoolStudent>>({});
  const effectiveStudents = useMemo(() => {
    const mergedMap = new Map<string, SchoolStudent>();
    students.forEach((s) => s?.id && mergedMap.set(s.id, s));
    try {
      getLocalStudents(school?.id || "").forEach((ls) => {
        if (ls?.id) {
          const prev = mergedMap.get(ls.id);
          mergedMap.set(ls.id, prev ? { ...prev, ...ls } : ls);
        }
      });
    } catch {}
    Object.values(studentOverrides).forEach((ov) => {
      if (ov?.id) mergedMap.set(ov.id, ov);
    });
    return Array.from(mergedMap.values());
  }, [students, studentOverrides, school?.id]);

  // Clock ticker for countdown
  const [currentEpoch, setCurrentEpoch] = useState(Date.now());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentEpoch(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Hydrate from Firestore + RTDB
  useEffect(() => {
    let active = true;
    const sid = school?.id;
    if (!sid) return;
    loadSchoolSubcollection<StoreInventoryItem>(sid, "store_items", invStorageKey).then((data) => {
      if (active && data.length > 0) setItems(data);
    });
    loadMergedStoreSales<StoreSaleRecord>(sid, salesStorageKey).then((data) => {
      if (active && data.length > 0) setSales(data);
    });
    loadMergedStoreReservations<StoreReservationBooking>(sid, resStorageKey).then((data) => {
      if (active && data.length > 0) setReservations(data);
    });
    getSchoolFeeHistory(sid).then((fees) => {
      if (active && Array.isArray(fees) && fees.length > 0) setFeeHistory(fees);
    }).catch(() => {});
    return () => { active = false; };
  }, [school?.id, invStorageKey, salesStorageKey, resStorageKey]);

  // Sync with LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(invStorageKey, JSON.stringify(items));
    } catch {}
  }, [items, invStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(salesStorageKey, JSON.stringify(sales));
    } catch {}
  }, [sales, salesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(resStorageKey, JSON.stringify(reservations));
    } catch {}
  }, [reservations, resStorageKey]);

  // Check auto-expiry of unpaid bookings and restore stock
  useEffect(() => {
    let stockChanged = false;
    let invCopy = [...items];

    const updatedRes = reservations.map((res) => {
      if (res.status === "reserved" && !res.razorpayPaymentId && new Date(res.expiresAt).getTime() <= currentEpoch) {
        stockChanged = true;
        res.items.forEach((booked) => {
          const itm = invCopy.find((i) => i.id === booked.itemId);
          if (itm) {
            itm.stockQuantity += booked.quantity;
          }
        });
        return { ...res, status: "expired" as const };
      }
      return res;
    });

    if (stockChanged) {
      setItems(invCopy);
      setReservations(updatedRes);
      try {
        localStorage.setItem(invStorageKey, JSON.stringify(invCopy));
        localStorage.setItem(resStorageKey, JSON.stringify(updatedRes));
      } catch {}
      syncSchoolSubcollection(school?.id, "store_items", invCopy);
      syncSchoolSubcollection(school?.id, "store_reservations", updatedRes);
    }
  }, [currentEpoch]);

  // Tab View: "inventory" vs "bookings" vs "sales_history"
  const [activeTab, setActiveTab] = useState<"inventory" | "bookings" | "sales_history">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");

  // Fulfill a reservation (Mark Handed Over & Paid)
  const handleFulfillReservation = (res: StoreReservationBooking) => {
    const receiptNo = `STR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const saleRecord: StoreSaleRecord = {
      id: `sale-${Date.now()}`,
      schoolId: school.id,
      receiptNo,
      studentId: res.studentId,
      studentName: res.studentName,
      className: res.className,
      rollNo: res.rollNo,
      items: res.items.map((line) => ({
        itemId: line.itemId,
        itemName: `${line.itemName} ${line.sizeOrVariant ? `(${line.sizeOrVariant})` : ""}`,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
      })),
      totalAmount: res.totalAmount,
      paymentMode: "cash",
      date: new Date().toISOString().split("T")[0],
      soldBy: "Store Manager",
    };

    const nextSales = [saleRecord, ...sales];
    const nextReservations = reservations.map((r) =>
      r.id === res.id ? { ...r, status: "collected" as const, collectedAt: new Date().toISOString() } : r
    );

    setSales(nextSales);
    setReservations(nextReservations);
    localStorage.setItem(salesStorageKey, JSON.stringify(nextSales));
    localStorage.setItem(resStorageKey, JSON.stringify(nextReservations));
    syncSchoolSubcollection(school?.id, "store_sales", nextSales);
    syncSchoolSubcollection(school?.id, "store_reservations", nextReservations);

    setPrintableReceipt(saleRecord);
    speakNotification(
      "स्टोर रसीद जारी",
      `${res.studentName} का आर्डर ${res.id} का सामान सौंप दिया गया और रसीद जारी हो गई।`
    );
  };

  // Cancel reservation and restore stock
  const handleCancelReservation = (res: StoreReservationBooking) => {
    const nextItems = items.map((itm) => {
      const match = res.items.find((i) => i.itemId === itm.id);
      if (match) {
        return { ...itm, stockQuantity: itm.stockQuantity + match.quantity };
      }
      return itm;
    });

    const nextReservations = reservations.map((r) =>
      r.id === res.id ? { ...r, status: "cancelled" as const } : r
    );

    setItems(nextItems);
    setReservations(nextReservations);
    localStorage.setItem(invStorageKey, JSON.stringify(nextItems));
    localStorage.setItem(resStorageKey, JSON.stringify(nextReservations));
    syncSchoolSubcollection(school?.id, "store_items", nextItems);
    syncSchoolSubcollection(school?.id, "store_reservations", nextReservations);
    speakNotification("बुकिंग रद्द", `ऑर्डर ${res.id} रद्द करके स्टॉक वापस जोड़ दिया गया।`);
  };

  const activeReservationsCount = useMemo(() => {
    return reservations.filter((r) => r.status === "reserved" && new Date(r.expiresAt).getTime() > currentEpoch).length;
  }, [reservations, currentEpoch]);

  // Add Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemFormName, setItemFormName] = useState("");
  const [itemFormCode, setItemFormCode] = useState(`ITM-${items.length + 101}`);
  const [itemFormCategory, setItemFormCategory] = useState<StoreInventoryItem["category"]>("uniform");
  const [itemFormVariant, setItemFormVariant] = useState("");
  const [itemFormPurchasePrice, setItemFormPurchasePrice] = useState(200);
  const [itemFormSalePrice, setItemFormSalePrice] = useState(300);
  const [itemFormStock, setItemFormStock] = useState(25);
  const [itemFormLowAlert, setItemFormLowAlert] = useState(5);
  const [itemFormUnit, setItemFormUnit] = useState("Pcs");
  const [itemFormImageUrl, setItemFormImageUrl] = useState("");
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  const handleItemImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Kripya 3MB se kam size ki photo chunein.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setItemFormImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Quick Sale / Unified Student Store & Fee Checkout Modal
  const [showBillModal, setShowBillModal] = useState(false);
  const [billStudentId, setBillStudentId] = useState("");
  const [billStudentSearch, setBillStudentSearch] = useState("");
  const [billStudentFilter, setBillStudentFilter] = useState<"all" | "reg_only">("all");
  const [billCatalogSearch, setBillCatalogSearch] = useState("");
  const [billLines, setBillLines] = useState<BillCartLine[]>([]);
  const [billPaymentMode, setBillPaymentMode] = useState<"cash" | "online_upi" | "card">("cash");
  const [billSaving, setBillSaving] = useState(false);

  // Printable Receipt State & Slip Filter Mode (combined vs fee_only vs store_only vs single_item)
  const [printableReceipt, setPrintableReceipt] = useState<StoreSaleRecord | null>(null);
  const [receiptPrintScope, setReceiptPrintScope] = useState<"combined" | "fee_only" | "store_only" | string>("combined");

  // Statistics
  const totalStockValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.stockQuantity * item.salePrice), 0);
  }, [items]);

  const lowStockItems = useMemo(() => {
    return items.filter(item => item.stockQuantity <= item.lowStockAlert);
  }, [items]);

  const storeBreakdown = useMemo(() => {
    return computePaymentBreakdown({ storeSales: sales });
  }, [sales]);

  const totalSalesRevenue = storeBreakdown.storeTotal;

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedCat !== "all" && item.category !== selectedCat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.itemCode.toLowerCase().includes(q) ||
          (item.sizeOrVariant && item.sizeOrVariant.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, selectedCat, searchQuery]);

  // Add Item
  const handleSaveItem = () => {
    if (!itemFormName.trim()) {
      toast.error("Kripya Item ka naam enter karein.");
      return;
    }

    const newItem: StoreInventoryItem = {
      id: `item-${Date.now()}`,
      schoolId: school.id,
      itemCode: itemFormCode.trim() || `ITM-${Math.floor(100 + Math.random() * 900)}`,
      name: itemFormName.trim(),
      category: itemFormCategory,
      sizeOrVariant: itemFormVariant.trim() || undefined,
      purchasePrice: Number(itemFormPurchasePrice) || 0,
      salePrice: Number(itemFormSalePrice) || 0,
      stockQuantity: Number(itemFormStock) || 0,
      lowStockAlert: Number(itemFormLowAlert) || 5,
      unit: itemFormUnit || "Pcs",
      imageUrl: itemFormImageUrl.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    const nextItems = [newItem, ...items];
    setItems(nextItems);
    syncSchoolSubcollection(school?.id, "store_items", nextItems);
    setShowAddItemModal(false);
    setItemFormName("");
    setItemFormVariant("");
    setItemFormImageUrl("");
    toast.success(`"${newItem.name}" store inventory me add ho gaya.`);
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    const nextItems = items.filter(i => i.id !== id);
    setItems(nextItems);
    syncSchoolSubcollection(school?.id, "store_items", nextItems);
    setConfirmDeleteId(null);
    toast.success("Item inventory se hata diya gaya.");
  };

  // Student Search Results inside Store Checkout
  const selectedBillStudent = useMemo(
    () => effectiveStudents.find((s) => s.id === billStudentId) || null,
    [effectiveStudents, billStudentId]
  );

  const selectedBillStudentClass = useMemo(() => {
    if (!selectedBillStudent) return null;
    const stdClassNorm = normalizeClassNameForChart(selectedBillStudent.className);
    const rawCls =
      classes.find((c) => c.id === selectedBillStudent.classId) ||
      classes.find(
        (c) =>
          selectedBillStudent.className &&
          c.name.trim().toLowerCase() === selectedBillStudent.className.trim().toLowerCase()
      ) ||
      (stdClassNorm
        ? classes.find((c) => normalizeClassNameForChart(c.name) === stdClassNorm)
        : undefined) ||
      null;
    if (rawCls) {
      return resolveEffectiveClassForAdmission(rawCls, school);
    }
    if (selectedBillStudent.className) {
      return resolveEffectiveClassForAdmission(
        {
          id: selectedBillStudent.classId || "fallback_class",
          schoolId: school?.id || "",
          sessionId: selectedBillStudent.sessionId || "",
          name: selectedBillStudent.className,
          defaultFee: Number(selectedBillStudent.monthlyFee || 0),
          sortOrder: 0,
          active: true,
          createdAt: "",
        } as SchoolClass,
        school
      );
    }
    return null;
  }, [selectedBillStudent, classes, school]);

  const studentPendingBreakdown = useMemo(() => {
    if (!selectedBillStudent) return null;
    return getStudentStorePendingBreakdown({
      student: selectedBillStudent,
      classObj: selectedBillStudentClass,
      school,
      feeHistory,
    });
  }, [selectedBillStudent, selectedBillStudentClass, school, feeHistory]);

  const filteredBillStudents = useMemo(() => {
    const q = billStudentSearch.trim().toLowerCase();
    return effectiveStudents
      .filter((s) => {
        if (billStudentFilter === "reg_only") {
          const isRegPending =
            s.admissionPaymentPlan === "registration_only" ||
            s.admissionPaymentPlan === "half_payment" ||
            Number(s.admissionDueBalance || 0) > 0;
          if (!isRegPending) return false;
        }
        if (!q) return true;
        return (
          (s.name || "").toLowerCase().includes(q) ||
          (s.admissionNo || "").toLowerCase().includes(q) ||
          (s.rollNo || "").toLowerCase().includes(q) ||
          (s.phone || "").toLowerCase().includes(q) ||
          (s.fatherName || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 25);
  }, [effectiveStudents, billStudentSearch, billStudentFilter]);

  const filteredBillCatalogItems = useMemo(() => {
    const q = billCatalogSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (i.stockQuantity <= 0) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.itemCode.toLowerCase().includes(q) ||
        (i.sizeOrVariant && i.sizeOrVariant.toLowerCase().includes(q))
      );
    });
  }, [items, billCatalogSearch]);

  // Add physical store item line to bill
  const handleAddBillLine = (itemId: string) => {
    const itm = items.find((i) => i.id === itemId);
    if (!itm) return;
    setBillLines((prev) => {
      const exist = prev.find((p) => p.categoryType === "store_item" && p.itemId === itemId);
      if (exist) {
        return prev.map((p) =>
          p.lineId === exist.lineId ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [
        ...prev,
        {
          lineId: `store_${itemId}_${Date.now()}`,
          itemId: itm.id,
          itemName: `${itm.name}${itm.sizeOrVariant ? ` (${itm.sizeOrVariant})` : ""}`,
          quantity: 1,
          unitPrice: Number(itm.salePrice) || 0,
          discountAmount: 0,
          categoryType: "store_item",
        },
      ];
    });
  };

  // Add Student Fee / Kit / Exam Term head to bill (no duplicate head/campaign!)
  const handleAddFeeHeadToBill = (head: StorePendingFeeHead) => {
    if (head.isSettled || head.remainingAmount <= 0) {
      toast.info(`${head.label} pehle se Paid / Waived hai.`);
      return;
    }
    setBillLines((prev) => {
      const already = prev.find(
        (p) =>
          (head.campaignId && p.campaignId === head.campaignId) ||
          (!head.campaignId && p.headKey === head.headKey && p.categoryType !== "store_item")
      );
      if (already) return prev;
      return [
        ...prev,
        {
          lineId: head.id,
          itemId: head.id,
          itemName: head.label,
          quantity: 1,
          unitPrice: head.remainingAmount,
          discountAmount: 0,
          categoryType: head.categoryType,
          headKey: head.headKey,
          campaignId: head.campaignId,
          targetMonth: head.targetMonth,
        },
      ];
    });
  };

  const handleAddAllPendingKitToBill = () => {
    if (!studentPendingBreakdown) return;
    const pendingKit = studentPendingBreakdown.kitItems.filter((k) => !k.isSettled && k.remainingAmount > 0);
    if (pendingKit.length === 0) {
      toast.info("Sabhi Kit items (Diary, Smart ID Card, Tie-Belt) pehle se settled hain.");
      return;
    }
    pendingKit.forEach((k) => handleAddFeeHeadToBill(k));
    toast.success(`${pendingKit.length} pending kit item(s) bill me add ho gaye.`);
  };

  // Calculate bill totals
  const billSummary = useMemo(() => {
    let grossTotal = 0;
    let discountTotal = 0;
    let netTotal = 0;
    billLines.forEach((line) => {
      const lineGross = Math.max(0, Number(line.unitPrice || 0) * Math.max(1, Number(line.quantity || 1)));
      const lineDisc = Math.min(lineGross, Math.max(0, Number(line.discountAmount || 0)));
      grossTotal += lineGross;
      discountTotal += lineDisc;
      netTotal += Math.max(0, lineGross - lineDisc);
    });
    return { grossTotal, discountTotal, netTotal };
  }, [billLines]);

  // Complete Sale + Sync Fee Ledger + Update Student Live Form Data
  const handleCompleteSale = async () => {
    if (billLines.length === 0) {
      toast.error("Kripya kam se kam ek item ya fee mad select karein.");
      return;
    }
    setBillSaving(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const nowIso = new Date().toISOString();
      const currentMonthStr = todayStr.slice(0, 7);
      const selectedStd = selectedBillStudent;
      const cls = selectedBillStudentClass;
      const receiptNo = `STR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const feeLinkedLines = billLines.filter(
        (l) => l.categoryType === "fee_head" || l.categoryType === "exam_term" || l.categoryType === "kit_item"
      );
      const linkedFeeReceiptNo =
        selectedStd && feeLinkedLines.length > 0
          ? `STRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
          : undefined;

      const saleItems = billLines.map((line) => {
        const lineGross = Math.max(0, Number(line.unitPrice || 0) * Math.max(1, Number(line.quantity || 1)));
        const lineDisc = Math.min(lineGross, Math.max(0, Number(line.discountAmount || 0)));
        const linePaid = Math.max(0, lineGross - lineDisc);
        return {
          itemId: line.itemId,
          itemName: line.itemName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          subtotal: linePaid,
          ...(line.headKey ? { headKey: line.headKey } : {}),
          ...(line.campaignId ? { campaignId: line.campaignId } : {}),
          categoryType: line.categoryType,
          ...(lineDisc > 0 ? { discountAmount: lineDisc } : {}),
          paidAmount: linePaid,
        };
      });

      const saleRecord: StoreSaleRecord = {
        id: `sale-${Date.now()}`,
        schoolId: school.id,
        receiptNo,
        studentId: selectedStd?.id,
        studentName: selectedStd?.name || "Counter Customer",
        className: cls?.name,
        rollNo: selectedStd?.rollNo,
        items: saleItems,
        grossAmount: billSummary.grossTotal,
        discountAmount: billSummary.discountTotal,
        totalAmount: billSummary.netTotal,
        ...(linkedFeeReceiptNo ? { linkedFeeReceiptNo } : {}),
        paymentMode: billPaymentMode,
        date: todayStr,
        soldBy: isAdmin ? "School Admin / Store" : "Store Manager",
      };

      // 1. Deduct stock from physical store inventory
      const nextItems = items.map((item) => {
        const soldQty = billLines
          .filter((b) => b.categoryType === "store_item" && b.itemId === item.id)
          .reduce((s, b) => s + Number(b.quantity || 0), 0);
        if (soldQty > 0) {
          return {
            ...item,
            stockQuantity: Math.max(0, item.stockQuantity - soldQty),
          };
        }
        return item;
      });
      const nextSales = [saleRecord, ...sales];
      setItems(nextItems);
      setSales(nextSales);
      syncSchoolSubcollection(school?.id, "store_items", nextItems);
      syncSchoolSubcollection(school?.id, "store_sales", nextSales);

      // 2. Sync linked MonthlyFee record for any Fee/Kit/Exam heads collected so Monthly Fee Manager never double-charges
      if (selectedStd && feeLinkedLines.length > 0 && linkedFeeReceiptNo) {
        const feeGross = feeLinkedLines.reduce((s, l) => s + Number(l.unitPrice || 0) * l.quantity, 0);
        const feeDisc = feeLinkedLines.reduce((s, l) => s + Math.min(Number(l.unitPrice || 0) * l.quantity, Number(l.discountAmount || 0)), 0);
        const feePaid = Math.max(0, feeGross - feeDisc);

        const appliedTermFees = feeLinkedLines
          .filter((l) => l.categoryType === "exam_term" && l.campaignId)
          .map((l) => ({
            campaignId: l.campaignId!,
            headKey: l.headKey || "exam",
            title: l.itemName,
            amount: Number(l.unitPrice || 0),
            source: "term_campaign" as const,
          }));

        const feeRec: MonthlyFee = {
          schoolId: school.id,
          sessionId: selectedStd.sessionId || "2026-27",
          studentId: selectedStd.id,
          studentName: selectedStd.name,
          rollNo: selectedStd.rollNo,
          classId: selectedStd.classId,
          month: currentMonthStr,
          amount: feePaid,
          monthlyAmount: Number(selectedStd.monthlyFee || 0),
          paid: true,
          paidDate: nowIso,
          collectedByName: saleRecord.soldBy,
          receiptNo: linkedFeeReceiptNo,
          paidAmount: feePaid,
          balanceDue: 0,
          concession: feeDisc,
          feeType: "store_fee_sync",
          receiptCategory: "store_fee_sync",
          note: `School Store Receipt #${receiptNo}`,
          appliedTermFees: appliedTermFees.length > 0 ? appliedTermFees : undefined,
          payModeInfo: {
            payMode: billPaymentMode === "online_upi" ? "Online / UPI" : billPaymentMode === "card" ? "Card" : "Cash",
            date: todayStr,
            bank: "School Store Counter",
            number: receiptNo,
          },
          items: feeLinkedLines.map((l, idx) => {
            const dVal = Number(l.unitPrice || 0) * l.quantity;
            const cVal = Math.min(dVal, Number(l.discountAmount || 0));
            return {
              id: l.itemId,
              slNo: idx + 1,
              description: l.itemName,
              due: dVal,
              con: cVal,
              paid: Math.max(0, dVal - cVal),
              headKey: l.headKey || canonicalizeFeeHeadKey(l.itemName),
            };
          }),
        };

        const savedFee = await saveFee(feeRec).catch(() => feeRec);
        setFeeHistory((prev) => [savedFee, ...prev]);
      }

      // 3. Update Student Record (settledFeeHeads, waivedFeeHeads, paidCampaignIds, advanceMonthlyFeePaid, admissionDueBalance, postAdmissionPurchases)
      if (selectedStd) {
        const nextSettled: Record<string, SettledFeeHeadRecord> = {
          ...(selectedStd.settledFeeHeads || {}),
        };
        const nextWaived: Record<string, WaivedFeeHeadRecord> = {
          ...(selectedStd.waivedFeeHeads || {}),
        };
        const nextPaidCampaignIds = new Set<string>(selectedStd.paidCampaignIds || []);
        let nextAdvanceTuitionPaid = Boolean(selectedStd.advanceMonthlyFeePaid);
        let nextAdvanceTuitionDue = selectedStd.advanceMonthlyFeeDue;
        let nextAdmDueBalance = Math.max(0, Number(selectedStd.admissionDueBalance || 0));

        feeLinkedLines.forEach((l) => {
          const hk = l.headKey || canonicalizeFeeHeadKey(l.itemName);
          const dVal = Number(l.unitPrice || 0) * l.quantity;
          const cVal = Math.min(dVal, Number(l.discountAmount || 0));
          const pVal = Math.max(0, dVal - cVal);
          const prevRec = nextSettled[hk];
          const cap = prevRec?.targetCap ?? (getConfiguredHeadAmountForClass(cls, hk) || dVal);
          const totalPaid = (prevRec?.totalPaid || 0) + pVal;
          const totalWaived = (prevRec?.waivedAmount || 0) + cVal;
          const isFull = Boolean(prevRec?.fullPaid) || totalPaid + totalWaived >= cap || dVal > 0;

          nextSettled[hk] = {
            fullPaid: isFull,
            totalPaid,
            ...(totalWaived > 0 ? { waivedAmount: totalWaived } : {}),
            targetCap: cap,
            source: "school_store",
            updatedAt: nowIso,
          };

          if (cVal > 0) {
            nextWaived[hk] = {
              waivedAmount: totalWaived,
              fullWaived: cVal >= dVal,
              label: l.itemName,
              reason: cVal >= dVal ? "Waived at School Store" : "Discount at School Store",
              date: todayStr,
              by: saleRecord.soldBy,
            };
          }

          if (l.campaignId) {
            nextPaidCampaignIds.add(l.campaignId);
          }

          if (hk === "tuition_first_month" && isFull) {
            nextAdvanceTuitionPaid = true;
            nextAdvanceTuitionDue = 0;
          }

          if (hk !== "tuition_first_month" && nextAdmDueBalance > 0) {
            nextAdmDueBalance = Math.max(0, nextAdmDueBalance - dVal);
          }
        });

        const purchaseEntry: PostAdmissionPurchaseRecord = {
          id: `pur_${Date.now()}`,
          date: todayStr,
          receiptNo,
          source: "store",
          items: billLines.map((l) => {
            const g = Number(l.unitPrice || 0) * l.quantity;
            const d = Math.min(g, Number(l.discountAmount || 0));
            return {
              name: l.itemName,
              ...(l.headKey ? { headKey: l.headKey } : {}),
              ...(l.campaignId ? { campaignId: l.campaignId } : {}),
              categoryType: l.categoryType,
              quantity: l.quantity,
              grossAmount: g,
              discountAmount: d,
              paidAmount: Math.max(0, g - d),
            };
          }),
          totalGross: billSummary.grossTotal,
          totalDiscount: billSummary.discountTotal,
          totalPaid: billSummary.netTotal,
          paymentMode: formatStorePaymentModeLabel(saleRecord),
          ...(linkedFeeReceiptNo ? { linkedFeeReceiptNo } : {}),
          updatedAt: nowIso,
        };

        const nextPurchases = [...(selectedStd.postAdmissionPurchases || []), purchaseEntry];
        const studentPatch: Partial<SchoolStudent> = {
          settledFeeHeads: nextSettled,
          ...(Object.keys(nextWaived).length > 0 ? { waivedFeeHeads: nextWaived } : {}),
          ...(nextPaidCampaignIds.size > 0 ? { paidCampaignIds: Array.from(nextPaidCampaignIds) } : {}),
          advanceMonthlyFeePaid: nextAdvanceTuitionPaid,
          ...(nextAdvanceTuitionDue !== undefined ? { advanceMonthlyFeeDue: nextAdvanceTuitionDue } : {}),
          admissionDueBalance: nextAdmDueBalance,
          postAdmissionPurchases: nextPurchases,
        };

        await updateStudent(school.id, selectedStd.id, studentPatch).catch((err) => {
          console.warn("[InventoryStoreManager] Student update note:", err);
        });

        const updatedStd: SchoolStudent = { ...selectedStd, ...studentPatch };
        setStudentOverrides((prev) => ({ ...prev, [updatedStd.id]: updatedStd }));
        try {
          const curLocals = getLocalStudents(school.id);
          setLocalStudents(school.id, [updatedStd, ...curLocals.filter((s) => s.id !== updatedStd.id)]);
          window.dispatchEvent(
            new CustomEvent("nsta:student-updated", { detail: { schoolId: school.id, student: updatedStd } })
          );
        } catch {}
        onStudentUpdated?.(updatedStd);
      }

      setShowBillModal(false);
      setBillLines([]);
      setBillStudentId("");
      setBillStudentSearch("");
      setReceiptPrintScope("combined");
      setPrintableReceipt(saleRecord);
      toast.success(`Sale & Student Ledger synced! Receipt #${saleRecord.receiptNo}`);
    } finally {
      setBillSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-900 via-orange-950 to-slate-900 text-white px-4 py-4 sm:py-6 shadow-md border-b border-amber-800/40 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-black uppercase tracking-wider border border-amber-400/30">
                  School Stationery & Uniform Store
                </span>
                <span className="text-slate-300 text-xs font-semibold">
                  Inventory & POS Billing
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-amber-400" />
                <span>School Store & Inventory (स्टॉक व बिलिंग)</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBillModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>+ Student Reg / Fee &amp; Store Bill</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddItemModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black flex items-center gap-1.5 transition border border-white/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Item</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Stock Value</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">₹{totalStockValue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{items.length} Products in Stock</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Low Stock Alert</p>
            <p className={`text-2xl font-black mt-1 ${lowStockItems.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {lowStockItems.length} Items
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Need Reordering</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Store Sales</p>
              <span className="text-[10px] font-bold text-slate-500">{sales.length} Bills</span>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">₹{totalSalesRevenue.toLocaleString("en-IN")}</p>
            <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[10px]">
              <div>
                <span className="text-slate-400 block">QR Code</span>
                <span className="font-black text-blue-600 dark:text-blue-400">₹{storeBreakdown.storeOnlineQr.toLocaleString("en-IN")}</span>
              </div>
              <div className="border-l border-slate-100 dark:border-slate-700 pl-1.5">
                <span className="text-slate-400 block">NSTA Online</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">₹{storeBreakdown.storeNstaOnline.toLocaleString("en-IN")}</span>
              </div>
              <div className="border-l border-slate-100 dark:border-slate-700 pl-1.5">
                <span className="text-slate-400 block">Cash</span>
                <span className="font-black text-slate-700 dark:text-slate-200">₹{storeBreakdown.storeCash.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "inventory"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Store Catalog ({items.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "bookings"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Online Bookings ({reservations.length})</span>
            {activeReservationsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black animate-pulse">
                {activeReservationsCount} Active
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sales_history")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "sales_history"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Sales &amp; Receipts ({sales.length})</span>
          </button>
        </div>

        {/* ── 1. INVENTORY CATALOG TAB ── */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            {/* Search and Category Filter */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search item by name, code (e.g. UNIF-01)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-700 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                {STORE_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCat(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedCat === cat.id
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      <th className="p-3 font-black">Code</th>
                      <th className="p-3 font-black">Item Name & Variant</th>
                      <th className="p-3 font-black">Category</th>
                      <th className="p-3 font-black">Sale Price</th>
                      <th className="p-3 font-black">Stock Status</th>
                      <th className="p-3 font-black text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredItems.map(item => {
                      const isLow = item.stockQuantity <= item.lowStockAlert;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition">
                          <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                            {item.itemCode}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/80 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-5 h-5 text-amber-500/70" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 dark:text-white truncate">{item.name}</p>
                                {item.sizeOrVariant && (
                                  <p className="text-[10px] text-slate-400 font-medium truncate">Variant: {item.sizeOrVariant}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="capitalize px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 font-black text-emerald-600 dark:text-emerald-400">
                            ₹{item.salePrice} <span className="text-[10px] font-normal text-slate-400">/ {item.unit}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-black ${isLow ? "text-rose-600" : "text-slate-800 dark:text-white"}`}>
                                {item.stockQuantity} {item.unit}
                              </span>
                              {isLow && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                                  Low Stock
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddBillLine(item.id);
                                  setShowBillModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                              >
                                Sell
                              </button>
                              {isAdmin && (
                                confirmDeleteId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(item.id)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. ONLINE 24-HOUR STUDENT BOOKINGS TAB ── */}
        {activeTab === "bookings" && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Student Online Bookings (24-Hour Reservations)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  छात्रों द्वारा 24 घंटे के लिए बुक की गई सामग्री। समय समाप्त होने पर स्टॉक अपने आप वापस रिस्टोर हो जाएगा।
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {activeReservationsCount} Pending Collection
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <th className="p-3 font-black">Order ID</th>
                    <th className="p-3 font-black">Student</th>
                    <th className="p-3 font-black">Items Booked</th>
                    <th className="p-3 font-black">Booked Time</th>
                    <th className="p-3 font-black">24H Window Timer</th>
                    <th className="p-3 font-black text-right">Amount</th>
                    <th className="p-3 font-black text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        अभी कोई ऑनलाइन बुकिंग प्राप्त नहीं हुई है।
                      </td>
                    </tr>
                  ) : (
                    reservations.map((booking) => {
                      const isReserved = booking.status === "reserved";
                      const isCollected = booking.status === "collected";
                      const isExpired = booking.status === "expired" || (isReserved && new Date(booking.expiresAt).getTime() <= currentEpoch);

                      const diffMs = new Date(booking.expiresAt).getTime() - currentEpoch;
                      let timeRemaining = "EXPIRED";
                      if (diffMs > 0) {
                        const totalSecs = Math.floor(diffMs / 1000);
                        const h = Math.floor(totalSecs / 3600);
                        const m = Math.floor((totalSecs % 3600) / 60);
                        const s = totalSecs % 60;
                        timeRemaining = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                      }

                      return (
                        <tr key={booking.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition">
                          <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {booking.id}
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-white">
                            <p>{booking.studentName}</p>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {booking.className} • Roll {booking.rollNo || "--"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">
                            {booking.items.map((i) => `${i.itemName} (x${i.quantity})`).join(", ")}
                          </td>
                          <td className="p-3 font-mono text-slate-500">
                            {new Date(booking.bookedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3">
                            {isCollected ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-black text-[10px]">
                                ✓ {booking.paymentMode === "nsta_online" || booking.razorpayPaymentId ? "NSTA Online Paid" : "Collected & Paid"}
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                                Expired (Stock Restored)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-500 font-mono font-black text-xs animate-pulse">
                                ⏳ {timeRemaining} remaining
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-black text-right text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            ₹{booking.totalAmount}
                          </td>
                          <td className="p-3 text-center">
                            {isReserved && !isExpired && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleFulfillReservation(booking)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Hand Over &amp; Paid
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelReservation(booking)}
                                  className="p-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-[11px] cursor-pointer"
                                  title="Cancel Booking & Restore Stock"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 3. SALES HISTORY TAB ── */}
        {activeTab === "sales_history" && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <th className="p-3 font-black">Receipt No</th>
                    <th className="p-3 font-black">Date</th>
                    <th className="p-3 font-black">Student / Customer</th>
                    <th className="p-3 font-black">Items Summary</th>
                    <th className="p-3 font-black">Mode</th>
                    <th className="p-3 font-black text-right">Amount</th>
                    <th className="p-3 font-black text-right">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Abhi koi sale nahi hui hai. Upar diye "+ New Sale / Quick Bill" button se pehli bikri karein.
                      </td>
                    </tr>
                  ) : (
                    sales.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition">
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {sale.receiptNo}
                        </td>
                        <td className="p-3 font-mono text-slate-500">{sale.date}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-white">
                          <p>{sale.studentName}</p>
                          {sale.className && <span className="text-[10px] text-slate-400 font-normal">{sale.className}</span>}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {sale.items.map(i => `${i.itemName} (x${i.quantity})`).join(", ")}
                        </td>
                        <td className="p-3 font-bold text-[10px]">
                          <span className={`px-2 py-0.5 rounded ${
                            sale.paymentMode === "nsta_online" || sale.razorpayPaymentId
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                              : sale.paymentMode === "online_upi" || sale.paymentMode === "card"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          }`}>
                            {formatStorePaymentModeLabel(sale)}
                          </span>
                        </td>
                        <td className="p-3 font-black text-right text-emerald-600 dark:text-emerald-400">
                          ₹{sale.totalAmount}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptPrintScope("combined");
                              setPrintableReceipt(sale);
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── ADD ITEM MODAL ── */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                <span>Add Store Item to Catalog</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                Item Name (वस्तु का नाम) *
              </label>
              <input
                type="text"
                value={itemFormName}
                onChange={e => setItemFormName(e.target.value)}
                placeholder="e.g. School Track Pant, Maths Notebook"
                className="w-full px-3 py-2 border rounded-xl dark:border-slate-600 dark:bg-slate-700 text-sm font-bold text-slate-800 dark:text-white"
              />
            </div>

            {/* ── PHOTO UPLOAD OPTION ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Item Photo (वस्तु की फोटो)
                </label>
                {itemFormImageUrl && (
                  <button
                    type="button"
                    onClick={() => setItemFormImageUrl("")}
                    className="text-[11px] text-rose-500 hover:text-rose-600 font-bold cursor-pointer"
                  >
                    हटाएं (Remove)
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={itemFileInputRef}
                accept="image/*"
                onChange={handleItemImageUpload}
                className="hidden"
              />

              {itemFormImageUrl ? (
                <div className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 h-28 flex items-center justify-center">
                  <img
                    src={itemFormImageUrl}
                    alt="Product Preview"
                    className="w-full h-full object-contain p-1"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => itemFileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-white text-slate-900 text-xs font-bold shadow-md cursor-pointer hover:bg-slate-100"
                    >
                      फोटो बदलें
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemFormImageUrl("")}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-md cursor-pointer hover:bg-rose-700"
                    >
                      हटाएं
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => itemFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-amber-500 dark:hover:border-amber-400 rounded-2xl p-3 text-center cursor-pointer transition bg-slate-50/60 dark:bg-slate-700/30 hover:bg-amber-50/40 dark:hover:bg-slate-700/60 flex items-center justify-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                      फोटो अपलोड करें (Click to Upload Photo)
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Camera से खींचें या Gallery से फोटो चुनें (Max 3MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Category
                </label>
                <select
                  value={itemFormCategory}
                  onChange={e => setItemFormCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-600 dark:bg-slate-700 text-xs font-bold"
                >
                  <option value="uniform">Uniforms</option>
                  <option value="books">Books & Notebooks</option>
                  <option value="accessories">Tie & Belts</option>
                  <option value="stationery">Stationery</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Size / Variant
                </label>
                <input
                  type="text"
                  value={itemFormVariant}
                  onChange={e => setItemFormVariant(e.target.value)}
                  placeholder="e.g. Size 34, 180 Pgs"
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-600 dark:bg-slate-700 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Sale Price (₹) *
                </label>
                <input
                  type="number"
                  value={itemFormSalePrice}
                  onChange={e => setItemFormSalePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-600 dark:bg-slate-700 text-xs font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Initial Stock Qty
                </label>
                <input
                  type="number"
                  value={itemFormStock}
                  onChange={e => setItemFormStock(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl dark:border-slate-600 dark:bg-slate-700 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveItem}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                Save Product
              </button>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNIFIED STORE + STUDENT REG / KIT / FEE / EXAM CHECKOUT MODAL ── */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="shrink-0 px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 dark:from-slate-900 dark:to-slate-800">
              <div>
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <span>School Store, Kit &amp; Fee Checkout (स्टोर व फीस बिलिंग)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  छात्र खोजें — Books/Dress, Smart ID Card, School Diary, Tie-Belt, Development Fee, 1st Month Tuition और Exam Terms एक साथ या अलग बिल करें
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBillModal(false)}
                className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-200 cursor-pointer border border-slate-200 dark:border-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* 1. Search & Select Student (Admitted / Registration-Only / Walk-in) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>1. Search Student / Registration (नाम, रोल या Adm No से खोजें)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBillStudentFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer border ${
                        billStudentFilter === "all"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      All ({effectiveStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillStudentFilter("reg_only")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer border ${
                        billStudentFilter === "reg_only"
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      Reg-Only / Due Only
                    </button>
                    {selectedBillStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          setBillStudentId("");
                          setBillLines((prev) => prev.filter((l) => l.categoryType === "store_item"));
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        Walk-in / Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={billStudentSearch}
                    onChange={(e) => setBillStudentSearch(e.target.value)}
                    placeholder="Search Name, Adm No, Roll No, Father Name or Phone..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {!selectedBillStudent ? (
                  <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredBillStudents.length === 0 ? (
                      <p className="text-[11px] text-slate-400 col-span-full py-2 text-center">
                        कोई छात्र नहीं मिला — Walk-in Counter Customer के रूप में भी बिल बना सकते हैं।
                      </p>
                    ) : (
                      filteredBillStudents.map((st) => {
                        const isReg =
                          st.admissionPaymentPlan === "registration_only" ||
                          st.admissionPaymentPlan === "half_payment" ||
                          Number(st.admissionDueBalance || 0) > 0;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setBillStudentId(st.id);
                              setBillLines((prev) => prev.filter((l) => l.categoryType === "store_item"));
                            }}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 text-left transition cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {st.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {st.className || "Class"} • Roll {st.rollNo || "—"} • {st.admissionNo || "No Adm#"}
                              </p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                isReg
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {st.admissionPaymentPlan === "registration_only"
                                ? "Reg Only"
                                : Number(st.admissionDueBalance || 0) > 0
                                ? `Due ₹${st.admissionDueBalance}`
                                : "Admitted"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-950 dark:text-emerald-100">
                          {selectedBillStudent.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                          {selectedBillStudent.className || selectedBillStudentClass?.name} • Roll {selectedBillStudent.rollNo || "—"}
                        </span>
                        {studentPendingBreakdown?.isRegOnly && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                            {selectedBillStudent.admissionPaymentPlan === "registration_only" ? "Reg-Only / Pending" : "Partial / Due"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                        Adm No: <strong className="font-mono">{selectedBillStudent.admissionNo}</strong> • Father: {selectedBillStudent.fatherName || "—"} • 📞 {selectedBillStudent.phone || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBillStudentId("");
                        setBillLines((prev) => prev.filter((l) => l.categoryType === "store_item"));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Change Student
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Student Pending Kit, Fee Heads & Saved Exam Terms (only when a student is selected) */}
              {selectedBillStudent && studentPendingBreakdown && (
                <div className="space-y-3">
                  {/* 2A. Individual Kit Items: Smart QR ID Card, School Diary, Tie & Belt */}
                  <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span>Smart QR ID Card, School Diary &amp; Tie-Belt Set (अलग-अलग या एक साथ)</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddAllPendingKitToBill}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black cursor-pointer"
                      >
                        + Add All Pending Kit
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {studentPendingBreakdown.kitItems.map((kh) => {
                        const inCart = billLines.some((l) => l.itemId === kh.id);
                        return (
                          <div
                            key={kh.id}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                              kh.isSettled
                                ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-75"
                                : "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-700"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">{kh.label}</p>
                              <p className="text-[10px] text-slate-500">
                                Class Rate: <strong>₹{kh.amount}</strong> •{" "}
                                <span className={kh.isSettled ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                                  {kh.sourceLabel}
                                </span>
                              </p>
                            </div>
                            {kh.isSettled ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black shrink-0">
                                ✓ Settled
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddFeeHeadToBill(kh)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${
                                  inCart
                                    ? "bg-emerald-600 text-white"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                }`}
                              >
                                {inCart ? "✓ Added" : `+ Add ₹${kh.remainingAmount}`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2B. Development Fee, 1st Month Tuition & Pending Examination Terms */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <IndianRupee className="w-4 h-4 text-amber-600" />
                        <span>Development Fee, 1st Month Tuition &amp; Adm Fee</span>
                      </span>
                      <div className="space-y-1.5">
                        {studentPendingBreakdown.feeHeads.map((fh) => {
                          const inCart = billLines.some((l) => l.itemId === fh.id);
                          return (
                            <div
                              key={fh.id}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                                fh.isSettled
                                  ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-75"
                                  : "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-700"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{fh.label}</p>
                                <p className="text-[10px] text-slate-500">
                                  ₹{fh.amount} •{" "}
                                  <span className={fh.isSettled ? "text-emerald-600 font-bold" : "text-amber-700 font-bold"}>
                                    {fh.sourceLabel}
                                  </span>
                                </p>
                              </div>
                              {fh.isSettled ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black shrink-0">
                                  ✓ Settled
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddFeeHeadToBill(fh)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${
                                    inCart ? "bg-emerald-600 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"
                                  }`}
                                >
                                  {inCart ? "✓ Added" : `+ Add ₹${fh.remainingAmount}`}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 space-y-2">
                      <span className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-purple-600" />
                        <span>Examination Fee Terms (यहाँ दें या Monthly Fee में)</span>
                      </span>
                      <div className="space-y-1.5">
                        {studentPendingBreakdown.examTerms.length === 0 ? (
                          <p className="text-[11px] text-slate-500">कोई Exam Fee Term सेट नहीं है।</p>
                        ) : (
                          studentPendingBreakdown.examTerms.map((et) => {
                            const inCart = billLines.some((l) => l.itemId === et.id);
                            return (
                              <div
                                key={et.id}
                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                                  et.isSettled
                                    ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-75"
                                    : "bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-700"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">{et.label}</p>
                                  <p className="text-[10px] text-slate-500">
                                    ₹{et.amount} •{" "}
                                    <span className={et.isSettled ? "text-emerald-600 font-bold" : "text-purple-700 font-bold"}>
                                      {et.sourceLabel}
                                    </span>
                                  </p>
                                </div>
                                {et.isSettled ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-black shrink-0">
                                    ✓ Paid
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddFeeHeadToBill(et)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer shrink-0 ${
                                      inCart ? "bg-emerald-600 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
                                    }`}
                                  >
                                    {inCart ? "✓ Added" : `+ Pay ₹${et.remainingAmount}`}
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <p className="text-[10px] text-purple-800/80 dark:text-purple-300/80">
                        नोट: यदि छात्र यहाँ Exam Fee जमा कर देता है तो Monthly Fee Slip में यह Term स्वतः Skip हो जाएगा।
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. School Store Catalog (Books, Uniform/Dress, Notebooks, Tie-Belt Inventory) */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                    <span>Books, Uniform / Dress &amp; Store Catalog Items</span>
                  </span>
                  <input
                    type="text"
                    value={billCatalogSearch}
                    onChange={(e) => setBillCatalogSearch(e.target.value)}
                    placeholder="Filter books, uniform, dress..."
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  {filteredBillCatalogItems.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-2">कोई उपलब्ध स्टॉक आइटम नहीं मिला।</p>
                  ) : (
                    filteredBillCatalogItems.map((i) => {
                      const inBill = billLines.find((b) => b.categoryType === "store_item" && b.itemId === i.id);
                      return (
                        <div key={i.id} className="flex items-center justify-between text-xs py-1 px-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 dark:text-white">{i.name}</span>
                            {i.sizeOrVariant && <span className="text-[10px] text-slate-500 ml-1">({i.sizeOrVariant})</span>}
                            <span className="text-[10px] text-emerald-600 ml-1.5 font-mono font-bold">₹{i.salePrice}</span>
                            <span className="text-[10px] text-slate-400 ml-1">[{i.stockQuantity} left]</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {inBill && (
                              <span className="font-black text-emerald-600 text-xs">
                                x{inBill.quantity}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAddBillLine(i.id)}
                              className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 4. Active Bill Cart (with Qty, Per-Line Maaf/Discount, Final Summary) */}
              {billLines.length > 0 && (
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/25 rounded-2xl border border-emerald-300 dark:border-emerald-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                      Bill Cart ({billLines.length} Items)
                    </span>
                    <button
                      type="button"
                      onClick={() => setBillLines([])}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {billLines.map((line) => {
                      const lineGross = Number(line.unitPrice || 0) * Math.max(1, line.quantity);
                      const lineDisc = Math.min(lineGross, Math.max(0, Number(line.discountAmount || 0)));
                      const lineNet = Math.max(0, lineGross - lineDisc);
                      return (
                        <div key={line.lineId} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex-1 min-w-[140px]">
                            <p className="font-black text-slate-900 dark:text-white">{line.itemName}</p>
                            <p className="text-[10px] text-slate-500">
                              ₹{line.unitPrice} × {line.quantity} = ₹{lineGross}
                              {lineDisc > 0 && <span className="text-emerald-600 font-bold ml-1.5">(-₹{lineDisc} Maaf/Disc)</span>}
                            </p>
                          </div>

                          {line.categoryType === "store_item" && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setBillLines((prev) =>
                                    prev.map((p) =>
                                      p.lineId === line.lineId ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p
                                    )
                                  )
                                }
                                className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 font-black cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-mono font-bold">{line.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setBillLines((prev) =>
                                    prev.map((p) =>
                                      p.lineId === line.lineId ? { ...p, quantity: p.quantity + 1 } : p
                                    )
                                  )
                                }
                                className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 font-black cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          )}

                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={lineGross}
                                value={lineDisc || ""}
                                placeholder="Disc ₹"
                                title="Maaf / Discount ₹"
                                onChange={(e) => {
                                  const nextD = Math.min(lineGross, Math.max(0, Number(e.target.value) || 0));
                                  setBillLines((prev) =>
                                    prev.map((p) =>
                                      p.lineId === line.lineId ? { ...p, discountAmount: nextD } : p
                                    )
                                  );
                                }}
                                className="w-16 px-1.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 text-[11px] font-mono text-right font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const nextD = lineDisc >= lineGross ? 0 : lineGross;
                                  setBillLines((prev) =>
                                    prev.map((p) =>
                                      p.lineId === line.lineId ? { ...p, discountAmount: nextD } : p
                                    )
                                  );
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                  lineDisc >= lineGross
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                }`}
                              >
                                {lineDisc >= lineGross ? "✓ Maaf" : "Maaf"}
                              </button>
                            </div>
                          )}

                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 w-16 text-right">
                            ₹{lineNet}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBillLines((prev) => prev.filter((p) => p.lineId !== line.lineId))}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200/80 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-slate-600 dark:text-slate-300">Payment:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={billPaymentMode === "cash"} onChange={() => setBillPaymentMode("cash")} />
                        <span>Cash</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={billPaymentMode === "online_upi"} onChange={() => setBillPaymentMode("online_upi")} />
                        <span>Online QR / UPI</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" checked={billPaymentMode === "card"} onChange={() => setBillPaymentMode("card")} />
                        <span>Card</span>
                      </label>
                    </div>
                    <div className="text-right">
                      {billSummary.discountTotal > 0 && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mr-3">
                          Gross ₹{billSummary.grossTotal} • Maaf/Disc -₹{billSummary.discountTotal}
                        </span>
                      )}
                      <span className="font-black text-base text-emerald-700 dark:text-emerald-300">
                        Payable: ₹{billSummary.netTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-2">
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={billLines.length === 0 || billSaving}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {billSaving ? "Saving & Syncing Admission Form..." : "Complete Sale, Update Admission Form & Print Receipt"}
              </button>
              <button
                type="button"
                onClick={() => setShowBillModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE STORE / FEE RECEIPT MODAL (Combined OR Alag-Alag Slips!) ── */}
      {printableReceipt && (() => {
        const feeTypes = new Set(["fee_head", "exam_term", "kit_item"]);
        const scopedItems = printableReceipt.items.filter((it, idx) => {
          if (receiptPrintScope === "combined") return true;
          if (receiptPrintScope === "fee_only") return feeTypes.has(it.categoryType || "");
          if (receiptPrintScope === "store_only") return !feeTypes.has(it.categoryType || "");
          return `${it.itemId}_${idx}` === receiptPrintScope;
        });
        const displayItems = scopedItems.length > 0 ? scopedItems : printableReceipt.items;
        const displayDiscount = displayItems.reduce((s, it) => s + Number(it.discountAmount || 0), 0);
        const displayPaid = displayItems.reduce((s, it) => s + Number(it.paidAmount ?? it.subtotal ?? 0), 0);
        const hasFeeAndStoreMix =
          printableReceipt.items.some((i) => feeTypes.has(i.categoryType || "")) &&
          printableReceipt.items.some((i) => !feeTypes.has(i.categoryType || ""));

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border space-y-3">
              {/* Slip Filter Bar (No-Print) */}
              <div className="no-print flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setReceiptPrintScope("combined")}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                    receiptPrintScope === "combined" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  All-in-One Bill
                </button>
                {hasFeeAndStoreMix && (
                  <>
                    <button
                      type="button"
                      onClick={() => setReceiptPrintScope("fee_only")}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                        receiptPrintScope === "fee_only" ? "bg-purple-700 text-white" : "bg-purple-50 text-purple-800"
                      }`}
                    >
                      Fee &amp; Kit Slip Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptPrintScope("store_only")}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                        receiptPrintScope === "store_only" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      Books / Dress Slip
                    </button>
                  </>
                )}
                {printableReceipt.items.length > 1 && printableReceipt.items.map((it, idx) => (
                  <button
                    key={`${it.itemId}_${idx}`}
                    type="button"
                    onClick={() => setReceiptPrintScope(`${it.itemId}_${idx}`)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer truncate max-w-[140px] ${
                      receiptPrintScope === `${it.itemId}_${idx}` ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    Alag: {it.itemName}
                  </button>
                ))}
              </div>

              <div ref={receiptRef} className="space-y-3 font-mono">
                <div className="text-center border-b pb-3">
                  <h3 className="font-black text-lg uppercase">{school?.name || "School Store"}</h3>
                  <p className="text-[10px] text-slate-500">{school?.address}</p>
                  <p className="text-xs font-bold mt-1">
                    {receiptPrintScope === "fee_only"
                      ? "FEE / EXAM / KIT RECEIPT"
                      : receiptPrintScope === "store_only"
                      ? "STORE BOOKS & UNIFORM RECEIPT"
                      : "OFFICIAL STORE & FEE RECEIPT"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Invoice: #{printableReceipt.receiptNo}
                    {printableReceipt.linkedFeeReceiptNo ? ` • Fee Ref: ${printableReceipt.linkedFeeReceiptNo}` : ""}
                  </p>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{printableReceipt.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Student / Customer:</span>
                    <span className="font-bold">{printableReceipt.studentName}</span>
                  </div>
                  {printableReceipt.className && (
                    <div className="flex justify-between">
                      <span>Class / Roll:</span>
                      <span>{printableReceipt.className} {printableReceipt.rollNo ? `(Roll ${printableReceipt.rollNo})` : ""}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-b py-2 text-xs space-y-1.5">
                  {displayItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-bold">{it.itemName} {it.quantity > 1 ? `(x${it.quantity})` : ""}</span>
                        {Number(it.discountAmount || 0) > 0 && (
                          <span className="block text-[10px] text-emerald-700 font-bold">
                            Maaf/Disc: -₹{it.discountAmount}
                          </span>
                        )}
                      </div>
                      <span className="font-bold">₹{it.paidAmount ?? it.subtotal}</span>
                    </div>
                  ))}
                </div>

                {displayDiscount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Total Discount / Maaf:</span>
                    <span>-₹{displayDiscount}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-sm">
                  <span>TOTAL PAID:</span>
                  <span>₹{displayPaid}</span>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-2 border-t">
                  <p>Mode: {formatStorePaymentModeLabel(printableReceipt)}</p>
                  <p className="mt-1">Synced with Student Admission Form &amp; Fee Ledger ✓</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 no-print print:hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (receiptRef.current) {
                      printElementInIframe(
                        receiptRef.current,
                        `Store Receipt #${printableReceipt.receiptNo}`,
                        `.no-print { display: none !important; }`
                      );
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableReceipt(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
