// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Bus, Navigation, MapPin, Gauge, Phone, ExternalLink,
  RefreshCw, Radio, CheckCircle2, Clock, AlertCircle,
  Sliders, Shield, Play, Map as MapIcon, Plus, Copy, Link2, X, Home, Crosshair, QrCode, Edit3, Trash2, LocateFixed, Users, Search,
  ArrowLeft, Maximize2, Minimize2
} from "lucide-react";
import type { School, BusLiveLocation, SchoolStudent, SchoolBusRoute } from "../../school-types";
import { shouldUseDemoForSchool, updateStudent, getStudents, getLocalStudents, updateSchool, isDemoSchoolId } from "../../school-firebase";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { rtdb } from "../../firebase";
import { ref as dbRef, onValue, set as rtdbSet } from "firebase/database";
import { sbRtdbSet, sbRtdbSubscribe } from "../../services/supabaseDbAdapter";
import { toast } from "sonner";
import { syncSchoolSubcollection } from "../../utils/schoolCloudSync";
import {
  saveVehicleRecord,
  deleteVehicleRecord,
  saveDriverRecord,
  saveRouteRecord,
  buildMergedFleetList,
  getLocalRoutes,
  updateRouteStopCoordinate,
  saveStudentStopLocationPin,
  getBusLiveShareUrl,
  saveBusLiveShareUrl,
} from "../../utils/schoolTransportStore";
import {
  LiveBusGoogleMap,
  type MapRouteOverlay,
  type MapHomePinOverlay,
} from "./LiveBusGoogleMap";
import { ParentLiveBusMap } from "./ParentLiveBusMap";
import { DriverIdCardModal, type DriverIdCardData } from "./DriverIdCardModal";
import {
  type StudentHomePin,
  resolveGoogleMapsLocationInput,
  extractGoogleMapsUrl,
  haversineMeters,
  computeBearingDeg,
  formatDistanceShort,
  getProximityStatus,
} from "../../utils/busProximity";

interface Props {
  school: School;
  onOpenDriverConsole?: () => void;
  onClose?: () => void;
  currentStudent?: Partial<SchoolStudent> | null;
  isEmbedded?: boolean;
  initialFullscreen?: boolean;
}

const DEFAULT_BUS_FLEET = [
  {
    busId: "bus-01",
    busNumber: "DL-1PC-4590 (Bus #01)",
    route: "Route 1: City Center → Sector 45 → Campus",
    driverName: "Rameshwar Singh",
    driverPhone: "9818023450",
    latitude: 28.4595,
    longitude: 77.0266,
    speed: 34,
    heading: 45,
    accuracy: 6,
    tripStatus: "started",
    tripType: "morning_pickup",
    lastUpdated: new Date().toISOString(),
    currentStop: "Sector 45 Market",
    totalStops: 5,
    completedStops: ["City Center Metro", "Sector 43 Chowk", "Sector 45 Market"],
  },
  {
    busId: "bus-02",
    busNumber: "DL-1PC-8821 (Bus #02)",
    route: "Route 2: Railway Station → Civil Lines → Campus",
    driverName: "Suraj Pal Yadav",
    driverPhone: "9871109923",
    latitude: 28.4682,
    longitude: 77.0384,
    speed: 0,
    heading: 0,
    accuracy: 10,
    tripStatus: "idle",
    tripType: "morning_pickup",
    lastUpdated: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    currentStop: "Depot Parking",
    totalStops: 5,
    completedStops: [],
  },
  {
    busId: "bus-03",
    busNumber: "DL-1PC-3312 (Bus #03)",
    route: "Route 3: South Extension → DLF Phase 1 → Campus",
    driverName: "Dharmendra Kumar",
    driverPhone: "9823419088",
    latitude: 28.4750,
    longitude: 77.0450,
    speed: 42,
    heading: 120,
    accuracy: 5,
    tripStatus: "started",
    tripType: "morning_pickup",
    lastUpdated: new Date().toISOString(),
    currentStop: "DLF Ph 1 Roundabout",
    totalStops: 4,
    completedStops: ["South Ext Market", "DLF Ph 1 Roundabout"],
  },
];

export const AdminBusFleetRadar: React.FC<Props> = (props) => {
  // Strict privacy isolation: Parents/Students always get the dedicated Read-Only Private Live Map
  if (props.currentStudent?.id && !props.onOpenDriverConsole) {
    return (
      <ParentLiveBusMap
        school={props.school}
        student={props.currentStudent}
        onClose={props.onClose}
      />
    );
  }
  return <AdminBusFleetRadarInner {...props} />;
};

const AdminBusFleetRadarInner: React.FC<Props> = ({
  school,
  onOpenDriverConsole,
  onClose,
  currentStudent,
  isEmbedded = false,
  initialFullscreen = false,
}) => {
  const isDemo = shouldUseDemoForSchool(school?.id);
  const canManageFleet = Boolean(onOpenDriverConsole);
  const [buses, setBuses] = useState<BusLiveLocation[]>(() => (isDemo ? DEFAULT_BUS_FLEET : []));
  const [routesList, setRoutesList] = useState<SchoolBusRoute[]>(() => getLocalRoutes(school?.id || ""));
  const [rtdbStopCoordsByBus, setRtdbStopCoordsByBus] = useState<Record<string, any[]>>({});
  const [selectedBusId, setSelectedBusId] = useState<string>(() => (isDemo ? "bus-01" : ""));
  const [filterMode, setFilterMode] = useState<"all" | "active">("all");
  const [visualizerMode, setVisualizerMode] = useState<"map" | "radar">("map");
  const [isFullscreenMap, setIsFullscreenMap] = useState<boolean>(
    Boolean(initialFullscreen && !currentStudent?.id)
  );
  const [areaByBusId, setAreaByBusId] = useState<Record<string, string>>({});
  const [showHomePinsOnMap, setShowHomePinsOnMap] = useState<boolean>(true);
  const [pinningStopName, setPinningStopName] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [showAddBusModal, setShowAddBusModal] = useState<boolean>(false);
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [newBusNumber, setNewBusNumber] = useState("");
  const [newBusRoute, setNewBusRoute] = useState("");
  const [newBusStops, setNewBusStops] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newBusLiveShareUrl, setNewBusLiveShareUrl] = useState("");
  const [showMapsApiKeyModal, setShowMapsApiKeyModal] = useState(false);
  const [schoolMapsApiKey, setSchoolMapsApiKey] = useState<string>(() =>
    String(school?.googleMapsApiKey || "").trim()
  );
  const [mapsApiKeyDraft, setMapsApiKeyDraft] = useState<string>(() =>
    String(school?.googleMapsApiKey || "").trim()
  );
  const [savingMapsApiKey, setSavingMapsApiKey] = useState(false);
  const [liveShareByBusId, setLiveShareByBusId] = useState<Record<string, string>>({});
  const [homePins, setHomePins] = useState<StudentHomePin[]>([]);
  const [selfPinInput, setSelfPinInput] = useState<string>("");
  const [showSelfPinBox, setShowSelfPinBox] = useState<boolean>(false);
  const [selectedDriverForIdCard, setSelectedDriverForIdCard] = useState<DriverIdCardData | null>(null);

  useEffect(() => {
    if (initialFullscreen && !currentStudent?.id) {
      setIsFullscreenMap(true);
    }
  }, [initialFullscreen, currentStudent?.id]);

  // Admin Student-Stop Location Picker Modal state
  const [schoolStudents, setSchoolStudents] = useState<SchoolStudent[]>(() =>
    school?.id ? getLocalStudents(school.id) : []
  );
  const [showStudentPinModal, setShowStudentPinModal] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [selectedPinStudentId, setSelectedPinStudentId] = useState<string>("");
  const [customPinStudentName, setCustomPinStudentName] = useState<string>("");
  const [studentStopInput, setStudentStopInput] = useState<string>("");
  const [studentPinLinkInput, setStudentPinLinkInput] = useState<string>("");
  const [savingStudentPin, setSavingStudentPin] = useState<boolean>(false);
  const [pinningStudentTarget, setPinningStudentTarget] = useState<{
    studentId: string;
    studentName: string;
    rollNo?: string;
    className?: string;
    busStop: string;
    busRoute: string;
    busNumber: string;
    busId: string;
  } | null>(null);

  useEffect(() => {
    if (!canManageFleet || !school?.id) return;
    let active = true;
    const cached = getLocalStudents(school.id);
    if (cached.length > 0) setSchoolStudents(cached);
    getStudents(school.id)
      .then((list) => {
        if (active && Array.isArray(list) && list.length > 0) {
          setSchoolStudents(list);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canManageFleet, school?.id]);

  const buildDriverPortalUrl = (bus?: BusLiveLocation | null) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams();
    params.set("driverConsole", "1");
    if (school?.id) params.set("schoolId", school.id);
    if (school?.code) params.set("schoolCode", school.code);
    if (school?.name) params.set("schoolName", school.name);
    if (bus?.busId) params.set("busId", bus.busId);
    if (bus?.busNumber) params.set("busNumber", bus.busNumber);
    if (bus?.route) params.set("route", bus.route);
    if (bus?.driverName) params.set("driverName", bus.driverName);
    if (bus?.driverPhone) params.set("driverPhone", bus.driverPhone);
    return `${origin}/?${params.toString()}`;
  };

  const handleCopyDriverLink = async (bus?: BusLiveLocation | null) => {
    const url = buildDriverPortalUrl(bus);
    try {
      await navigator.clipboard?.writeText(url);
      toast.success(
        bus
          ? `${bus.busNumber} ka Driver Dashboard Link copy ho gaya! Driver ke WhatsApp par bhej dein.`
          : "Driver Dashboard Link copy ho gaya!"
      );
    } catch {
      toast.info(url);
    }
  };

  const handleAddQuickBus = async (e: React.FormEvent) => {
    e.preventDefault();
    const sid = school?.id || "default";
    if (!newBusNumber.trim()) {
      toast.error("Kripya Bus Number daalein.");
      return;
    }
    const stopsArr = newBusStops
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const resolvedStops = stopsArr.length > 0 ? stopsArr : ["Start Point", "Main Chowk", "School Main Gate"];
    const busId = editingBusId || `bus_${Date.now()}`;
    const newRecord: any = {
      id: busId,
      schoolId: sid,
      vehicleNumber: newBusNumber.trim(),
      model: "School Bus",
      route: newBusRoute.trim() || "Main School Route",
      stops: resolvedStops,
      driverName: newDriverName.trim() || "Driver",
      driverPhone: newDriverPhone.trim(),
      fitnessExpiryDate: "2027-06-30",
      insuranceExpiryDate: "2027-03-31",
      pollutionPucExpiryDate: "2026-12-31",
      roadTaxExpiryDate: "2027-03-31",
      permitExpiryDate: "",
    };

    await saveVehicleRecord(sid, newRecord);
    if (newDriverName.trim()) {
      await saveDriverRecord(sid, {
        id: `drv_${busId}`,
        schoolId: sid,
        name: newDriverName.trim(),
        phone: newDriverPhone.trim(),
        licenseNo: "VERIFIED",
        licenseExpiry: "2028-12-31",
        assignedBusId: busId,
        assignedBusNumber: newRecord.vehicleNumber,
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
      });
    }
    await saveRouteRecord(sid, {
      id: `route_${busId}`,
      schoolId: sid,
      routeName: newRecord.route,
      busId,
      busNumber: newRecord.vehicleNumber,
      driverName: newRecord.driverName,
      driverPhone: newRecord.driverPhone,
      monthlyFee: 900,
      stops: resolvedStops.map((s, idx) => ({
        id: `stp_${busId}_${idx}`,
        stopName: s,
        pickupTime: `07:${String(10 + idx * 10).padStart(2, "0")}`,
        dropTime: `14:${String(30 - Math.min(25, idx * 8)).padStart(2, "0")}`,
      })),
      active: true,
      updatedAt: new Date().toISOString(),
    });

    const cleanLiveShare = newBusLiveShareUrl.trim()
      ? extractGoogleMapsUrl(newBusLiveShareUrl.trim()) || newBusLiveShareUrl.trim()
      : "";
    await saveBusLiveShareUrl(sid, busId, cleanLiveShare);

    const liveEntry: BusLiveLocation = {
      busId,
      busNumber: newRecord.vehicleNumber,
      route: newRecord.route,
      driverName: newRecord.driverName,
      driverPhone: newRecord.driverPhone,
      latitude: 28.6139,
      longitude: 77.209,
      speed: 0,
      heading: 0,
      accuracy: 0,
      tripStatus: "idle",
      tripType: "morning_pickup",
      lastUpdated: new Date().toISOString(),
      currentStop: resolvedStops[0] || "Depot",
      totalStops: resolvedStops.length,
      completedStops: [],
      liveShareUrl: cleanLiveShare || undefined,
    };
    setBuses((prev) => [liveEntry, ...prev.filter((b) => b.busId !== busId)]);
    setSelectedBusId(busId);
    setEditingBusId(null);
    setNewBusNumber("");
    setNewBusRoute("");
    setNewBusStops("");
    setNewDriverName("");
    setNewDriverPhone("");
    setNewBusLiveShareUrl("");
    setShowAddBusModal(false);
    setSelectedDriverForIdCard({
      busId,
      busNumber: liveEntry.busNumber,
      route: liveEntry.route,
      driverName: liveEntry.driverName,
      driverPhone: liveEntry.driverPhone,
      stops: resolvedStops,
    });
    toast.success(editingBusId ? `Bus "${liveEntry.busNumber}" update ho gayi!` : `Bus "${liveEntry.busNumber}" add ho gayi aur Driver ID Card (QR) ban gaya!`);
  };

  const handleOpenEditBus = (bus: BusLiveLocation) => {
    setEditingBusId(bus.busId);
    setNewBusNumber(bus.busNumber || "");
    setNewBusRoute(bus.route || "");
    setNewDriverName(bus.driverName || "");
    setNewDriverPhone(bus.driverPhone || "");
    setNewBusLiveShareUrl(bus.liveShareUrl || liveShareByBusId[bus.busId] || getBusLiveShareUrl(school?.id || "", bus.busId) || "");
    setNewBusStops("");
    setShowAddBusModal(true);
  };

  const handleDeleteBus = async (busId: string) => {
    const sid = school?.id || "default";
    await deleteVehicleRecord(sid, busId);
    setBuses((prev) => {
      const remaining = prev.filter((b) => b.busId !== busId);
      if (selectedBusId === busId) setSelectedBusId(remaining[0]?.busId || "");
      return remaining;
    });
    toast.success("Bus vehicle record delete ho gaya.");
  };

  // Subscribe to live bus updates
  useEffect(() => {
    const sid = school?.id || "";

    // 1. Unified fleet loader (never clobbers newly added/edited buses in demo OR real schools)
    const loadLocalBuses = () => {
      const merged = buildMergedFleetList(sid);
      setBuses(merged);
      setRoutesList(getLocalRoutes(sid));
      setLastRefreshed(new Date());
    };

    loadLocalBuses();
    window.addEventListener("school-transport-updated", loadLocalBuses);

    // 2. Window event listener for instant local sync
    const handleBusUpdate = (e: any) => {
      const live = e?.detail as BusLiveLocation;
      if (live && live.busId) {
        setBuses((prev) => {
          const exists = prev.some((b) => b.busId === live.busId);
          if (!exists) return [...prev, live];
          return prev.map((b) => (b.busId === live.busId ? { ...b, ...live } : b));
        });
        setLastRefreshed(new Date());
      }
    };
    window.addEventListener("nst_bus_location_update", handleBusUpdate);

    // 3. Firebase RTDB live GPS + fleet listeners
    let unsubRtdbLoc1: any = null;
    let unsubRtdbLoc2: any = null;
    let unsubRtdbFleet: any = null;
    let unsubSbFleet: any = null;

    const mergeIncomingLocations = (busArr: BusLiveLocation[]) => {
      if (busArr.length === 0) return;
      setBuses((prev) => {
        const map = new Map(prev.map((p) => [p.busId, p]));
        busArr.forEach((b) => {
          if (b?.busId) map.set(b.busId, { ...map.get(b.busId), ...b });
        });
        return Array.from(map.values());
      });
      setLastRefreshed(new Date());
    };

    const mergeIncomingFleet = (rawFleet: Record<string, any>) => {
      const fleetArr = Object.values(rawFleet || {}) as any[];
      const stopMap: Record<string, any[]> = {};
      fleetArr.forEach((v: any) => {
        const bid = v?.busId || v?.id;
        if (bid && Array.isArray(v?.stopCoords) && v.stopCoords.length > 0) {
          stopMap[bid] = v.stopCoords;
        }
      });
      if (Object.keys(stopMap).length > 0) {
        setRtdbStopCoordsByBus(stopMap);
      }
      if (fleetArr.length > 0) {
        setBuses((prev) => {
          const map = new Map(prev.map((p) => [p.busId, p]));
          fleetArr.forEach((v: any) => {
            if (!v?.id) return;
            const existing = map.get(v.id);
            if (!existing) {
              map.set(v.id, {
                busId: v.id,
                busNumber: v.vehicleNumber || "School Bus",
                route: v.route || "Configured Route",
                driverName: v.driverName || "—",
                driverPhone: v.driverPhone || "",
                latitude: 0,
                longitude: 0,
                speed: 0,
                heading: 0,
                accuracy: 0,
                tripStatus: "idle",
                tripType: "morning_pickup",
                lastUpdated: new Date().toISOString(),
                currentStop: Array.isArray(v.stops) && v.stops[0] ? v.stops[0] : "Depot",
                totalStops: Array.isArray(v.stops) ? v.stops.length : 0,
                completedStops: [],
              });
            }
          });
          return Array.from(map.values());
        });
      }
    };

    const applyLiveShareMap = (val: any) => {
      if (!val || typeof val !== "object") return;
      const next: Record<string, string> = {};
      Object.entries(val).forEach(([bid, entry]: [string, any]) => {
        const u = String(entry?.liveShareUrl || entry || "").trim();
        if (bid && u) next[bid] = u;
      });
      setLiveShareByBusId(next);
    };

    const unsubSbShare = sid ? sbRtdbSubscribe(`schools/${sid}/bus_live_share`, applyLiveShareMap) : () => {};
    const unsubSbMapsKey = sid
      ? sbRtdbSubscribe(`schools/${sid}/maps_config`, (val: any) => {
          if (val && typeof val === "object" && typeof val.googleMapsApiKey === "string") {
            const k = val.googleMapsApiKey.trim();
            setSchoolMapsApiKey(k);
            setMapsApiKeyDraft(k);
          }
        })
      : () => {};

    let unsubRtdbShare: any = null;
    let unsubRtdbMapsKey: any = null;

    if (sid) {
      unsubSbFleet = sbRtdbSubscribe(`schools/${sid}/bus_fleet`, (val) => {
        if (val && typeof val === "object") {
          mergeIncomingFleet(val);
        }
      });
    }

    if (rtdb && sid) {
      try {
        unsubRtdbLoc1 = onValue(dbRef(rtdb, `school_bus_locations/${sid}`), (snap) => {
          if (snap.exists()) {
            mergeIncomingLocations(Object.values(snap.val()) as BusLiveLocation[]);
          }
        });
      } catch (e) {
        console.warn("[AdminBusFleetRadar] RTDB listen notice:", e);
      }

      try {
        unsubRtdbFleet = onValue(dbRef(rtdb, `schools/${sid}/bus_fleet`), (snap) => {
          if (snap.exists()) {
            mergeIncomingFleet(snap.val() || {});
          }
        });
      } catch {}

      try {
        unsubRtdbShare = onValue(dbRef(rtdb, `schools/${sid}/bus_live_share`), (snap) => {
          if (snap.exists()) applyLiveShareMap(snap.val());
        });
      } catch {}

      try {
        unsubRtdbMapsKey = onValue(dbRef(rtdb, `schools/${sid}/maps_config`), (snap) => {
          const val = snap.val();
          if (val && typeof val.googleMapsApiKey === "string") {
            const k = val.googleMapsApiKey.trim();
            setSchoolMapsApiKey(k);
            setMapsApiKeyDraft(k);
          }
        });
      } catch {}
    }

    const interval = setInterval(loadLocalBuses, 4000);

    return () => {
      window.removeEventListener("nst_bus_location_update", handleBusUpdate);
      window.removeEventListener("school-transport-updated", loadLocalBuses);
      clearInterval(interval);
      if (typeof unsubSbFleet === "function") unsubSbFleet();
      if (typeof unsubSbShare === "function") unsubSbShare();
      if (typeof unsubSbMapsKey === "function") unsubSbMapsKey();
      if (typeof unsubRtdbLoc1 === "function") unsubRtdbLoc1();
      if (typeof unsubRtdbLoc2 === "function") unsubRtdbLoc2();
      if (typeof unsubRtdbFleet === "function") unsubRtdbFleet();
      if (typeof unsubRtdbShare === "function") unsubRtdbShare();
      if (typeof unsubRtdbMapsKey === "function") unsubRtdbMapsKey();
    };
  }, [school?.id]);

  // Subscribe to saved Student Home GPS Pins (100% Free Haversine Proximity Tracking)
  useEffect(() => {
    const sid = school?.id || "";
    const loadLocalPins = () => {
      const list: StudentHomePin[] = [];
      if (sid) {
        try {
          const raw = localStorage.getItem(`nst_student_home_pins_${sid}`);
          if (raw) {
            const obj = JSON.parse(raw) || {};
            Object.values(obj).forEach((p: any) => {
              if (Number.isFinite(Number(p?.homeLat)) && Number.isFinite(Number(p?.homeLng))) {
                list.push({
                  ...p,
                  homeLat: Number(p.homeLat),
                  homeLng: Number(p.homeLng),
                });
              }
            });
          }
        } catch {}
      }
      if (isDemo && list.length === 0) {
        list.push(
          {
            studentId: "demo_st_1",
            studentName: "Aarav Sharma",
            className: "Class 5",
            rollNo: "04",
            busRoute: "Route 1",
            homeLat: 28.4604,
            homeLng: 77.0274,
          },
          {
            studentId: "demo_st_2",
            studentName: "Priya Verma",
            className: "Class 3",
            rollNo: "11",
            busRoute: "Route 1",
            homeLat: 28.4632,
            homeLng: 77.0305,
          },
          {
            studentId: "demo_st_3",
            studentName: "Rohan Gupta",
            className: "Class 7",
            rollNo: "18",
            busRoute: "Route 1",
            homeLat: 28.4685,
            homeLng: 77.0358,
          }
        );
      }
      if (list.length > 0) {
        setHomePins((prev) => {
          const map = new Map<string, StudentHomePin>(prev.map((p) => [p.studentId, p]));
          list.forEach((p) => map.set(p.studentId, p));
          return Array.from(map.values());
        });
      }
    };

    loadLocalPins();

    const applyPinsVal = (val: any) => {
      if (!val || typeof val !== "object") return;
      const arr = Object.values(val).filter(
        (p: any) => p?.studentId && Number.isFinite(Number(p?.homeLat)) && Number.isFinite(Number(p?.homeLng))
      ) as StudentHomePin[];
      if (arr.length > 0) {
        setHomePins(
          arr.map((p) => ({
            ...p,
            homeLat: Number(p.homeLat),
            homeLng: Number(p.homeLng),
          }))
        );
      }
    };

    const unsubSbPins = sid ? sbRtdbSubscribe(`schools/${sid}/student_home_pins`, applyPinsVal) : () => {};
    let unsubPins: any = null;
    if (rtdb && sid) {
      try {
        unsubPins = onValue(dbRef(rtdb, `schools/${sid}/student_home_pins`), (snap) => {
          if (snap.exists()) applyPinsVal(snap.val());
        });
      } catch {}
    }

    return () => {
      unsubSbPins();
      if (typeof unsubPins === "function") unsubPins();
    };
  }, [school?.id, isDemo]);

  const saveSelfHomePin = async (lat: number, lng: number) => {
    const sid = school?.id;
    const stId = currentStudent?.id;
    if (!sid || !stId) return;
    const pinRecord: StudentHomePin = {
      studentId: stId,
      studentName: currentStudent?.name || "Student",
      rollNo: currentStudent?.rollNo,
      className: currentStudent?.className,
      busRoute: currentStudent?.busRoute || "Route 1",
      homeLat: lat,
      homeLng: lng,
      homeAddress: currentStudent?.address || "",
      updatedAt: new Date().toISOString(),
    };
    setHomePins((prev) => [pinRecord, ...prev.filter((p) => p.studentId !== stId)]);
    try {
      const k = `nst_student_home_pins_${sid}`;
      const existing = JSON.parse(localStorage.getItem(k) || "{}");
      existing[stId] = pinRecord;
      localStorage.setItem(k, JSON.stringify(existing));
      void sbRtdbSet(`schools/${sid}/student_home_pins/${stId}`, pinRecord).catch(() => {});
      if (rtdb) {
        await rtdbSet(dbRef(rtdb, `schools/${sid}/student_home_pins/${stId}`), pinRecord);
      }
      await updateStudent(sid, stId, { homeLat: lat, homeLng: lng });
    } catch {}
    setShowSelfPinBox(false);
    setSelfPinInput("");
    toast.success("Aapke ghar ka GPS location save ho gaya! Ab bus door se hi live distance dikhegi.");
  };

  const handleCaptureSelfHomeGps = () => {
    if (!navigator.geolocation) {
      toast.error("Aapke mobile me GPS supported nahi hai.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveSelfHomePin(
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6))
        );
      },
      (err) => {
        toast.error(err?.message || "GPS permission allow karein ya Google Maps link paste karein.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveSelfPinLink = async () => {
    const parsed = await resolveGoogleMapsLocationInput(selfPinInput);
    if (!parsed) {
      toast.error("Valid Google Maps location link ya 'lat, lng' daalein.");
      return;
    }
    saveSelfHomePin(parsed.lat, parsed.lng);
  };

  const activeBuses = buses.filter((b) => b.tripStatus === "started");
  const displayList = filterMode === "active" ? activeBuses : buses;
  const currentSelectedBus = buses.find((b) => b.busId === selectedBusId) || buses[0] || null;

  const busHasValidCoords = Boolean(
    currentSelectedBus &&
      Number.isFinite(Number(currentSelectedBus.latitude)) &&
      Number.isFinite(Number(currentSelectedBus.longitude)) &&
      (Math.abs(Number(currentSelectedBus.latitude)) > 0.001 ||
        Math.abs(Number(currentSelectedBus.longitude)) > 0.001)
  );

  const proximityList = React.useMemo(() => {
    if (!busHasValidCoords || !currentSelectedBus) return [];
    const bLat = Number(currentSelectedBus.latitude);
    const bLng = Number(currentSelectedBus.longitude);
    return homePins
      .map((pin) => {
        const distM = haversineMeters(bLat, bLng, pin.homeLat, pin.homeLng);
        const bearingDeg = computeBearingDeg(bLat, bLng, pin.homeLat, pin.homeLng);
        return {
          ...pin,
          distanceMeters: distM,
          bearingDeg,
          status: getProximityStatus(distM),
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [busHasValidCoords, currentSelectedBus, homePins]);

  const mySelfProximity = currentStudent?.id
    ? proximityList.find((p) => p.studentId === currentStudent.id) || null
    : null;
  const mySavedPin = currentStudent?.id
    ? homePins.find((p) => p.studentId === currentStudent.id) || null
    : null;

  // Helper to construct Google Maps link
  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // Build planned route overlays for ALL displayed buses (color-coded lines + numbered stop pins)
  const mapRouteOverlays = React.useMemo<MapRouteOverlay[]>(() => {
    return displayList.map((bus) => {
      const matchedRoute = routesList.find(
        (r) => r.busId === bus.busId || r.busNumber === bus.busNumber
      );
      const rtdbStops = rtdbStopCoordsByBus[bus.busId];
      const sourceStops =
        matchedRoute?.stops?.some((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
          ? matchedRoute.stops
          : Array.isArray(rtdbStops)
            ? rtdbStops
            : [];

      const completedSet = new Set(
        (bus.completedStops || []).map((s) => String(s).trim().toLowerCase())
      );

      const stopsWithCoords = sourceStops
        .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
        .map((s) => ({
          id: s.id,
          stopName: s.stopName,
          pickupTime: s.pickupTime,
          dropTime: s.dropTime,
          lat: Number(s.lat),
          lng: Number(s.lng),
          completed: completedSet.has(String(s.stopName || "").trim().toLowerCase()),
        }));

      return {
        busId: bus.busId,
        busNumber: bus.busNumber,
        routeName: bus.route,
        color: matchedRoute?.routeColor,
        stops: stopsWithCoords,
      };
    }).filter((r) => r.stops.length > 0);
  }, [displayList, routesList, rtdbStopCoordsByBus]);

  const selectedBusRouteObj = React.useMemo(() => {
    if (!currentSelectedBus) return null;
    return (
      routesList.find(
        (r) =>
          r.busId === currentSelectedBus.busId ||
          r.busNumber === currentSelectedBus.busNumber
      ) || null
    );
  }, [currentSelectedBus, routesList]);

  const mapHomePinOverlays = React.useMemo<MapHomePinOverlay[]>(() => {
    if (!showHomePinsOnMap) return [];
    const distByStudentId = new Map(
      proximityList.map((p) => [p.studentId, formatDistanceShort(p.distanceMeters)])
    );
    return homePins.slice(0, 30).map((item) => ({
      id: item.studentId,
      label: item.busStop
        ? `${item.studentName.split(" ")[0]} (${item.busStop})`
        : item.studentName.split(" ")[0],
      sublabel: `${item.studentName}${item.className ? ` (${item.className})` : ""}${item.busStop ? ` • Stop: ${item.busStop}` : ""}`,
      lat: item.homeLat,
      lng: item.homeLng,
      distanceText: distByStudentId.get(item.studentId),
    }));
  }, [showHomePinsOnMap, homePins, proximityList]);

  const handleSaveStudentStopLocation = async (
    target: {
      studentId: string;
      studentName: string;
      rollNo?: string;
      className?: string;
      busStop: string;
      busRoute: string;
      busNumber: string;
      busId: string;
    },
    lat: number,
    lng: number
  ) => {
    if (!school?.id) return;
    setSavingStudentPin(true);
    try {
      const stopName = target.busStop.trim() || `${target.studentName.split(" ")[0]} Stop`;
      const saved = await saveStudentStopLocationPin(
        school.id,
        {
          studentId: target.studentId,
          studentName: target.studentName,
          rollNo: target.rollNo,
          className: target.className,
          busRoute: target.busRoute,
          busNumber: target.busNumber,
          busStop: stopName,
          homeLat: lat,
          homeLng: lng,
          updatedAt: new Date().toISOString(),
        },
        { busId: target.busId, overwriteStopCoord: true }
      );
      if (saved) {
        setHomePins((prev) => [saved, ...prev.filter((p) => p.studentId !== saved.studentId)]);
      }
      if (!target.studentId.startsWith("custom_stop_")) {
        await updateStudent(school.id, target.studentId, {
          usesBus: true,
          homeLat: lat,
          homeLng: lng,
          busStop: stopName,
          busRoute: target.busRoute,
          busNumber: target.busNumber,
        }).catch(() => {});
      }
      setRoutesList(getLocalRoutes(school.id));
      toast.success(
        `📍 ${target.studentName} (${stopName}) ki location save aur Stop Pin link ho gayi!`
      );
      setShowStudentPinModal(false);
      setPinningStudentTarget(null);
      setStudentPinLinkInput("");
    } finally {
      setSavingStudentPin(false);
    }
  };

  const handlePinStopOnMap = async (lat: number, lng: number) => {
    if (pinningStudentTarget) {
      await handleSaveStudentStopLocation(pinningStudentTarget, lat, lng);
      return;
    }
    if (!pinningStopName || !currentSelectedBus || !school?.id) return;
    const updated = await updateRouteStopCoordinate(
      school.id,
      currentSelectedBus.busId,
      pinningStopName,
      lat,
      lng
    );
    if (updated) {
      setRoutesList(getLocalRoutes(school.id));
      toast.success(`📍 "${pinningStopName}" का पिन मैप पर सेव हो गया (${lat.toFixed(4)}, ${lng.toFixed(4)})!`);
    } else {
      toast.error("Is bus ka route record nahi mila — pehle Edit Bus se stops save karein.");
    }
    setPinningStopName(null);
  };

  return (
    <div className={isEmbedded ? "space-y-3.5" : "bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-4"}>
      {/* 95% FULLSCREEN ADMIN LIVE FLEET MAP OVERLAY */}
      {isFullscreenMap && (
        <div className="fixed inset-2 sm:inset-3 z-[90] rounded-2xl bg-slate-950 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
          {/* Compact Top Bar with Prominent Back Button */}
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (initialFullscreen && onClose) {
                    onClose();
                  } else {
                    setIsFullscreenMap(false);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-black text-white truncate">
                    All Buses Live Map
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black shrink-0">
                    {activeBuses.length}/{buses.length} Live
                  </span>
                </div>
                {currentSelectedBus && (
                  <p className="text-[10px] text-slate-400 truncate">
                    {currentSelectedBus.busNumber}
                    {areaByBusId[currentSelectedBus.busId]
                      ? ` • 📍 ${areaByBusId[currentSelectedBus.busId]}`
                      : currentSelectedBus.currentStop
                        ? ` • ${currentSelectedBus.currentStop}`
                        : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-2 py-1 rounded-lg font-bold cursor-pointer transition ${
                    filterMode === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  All ({buses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("active")}
                  className={`px-2 py-1 rounded-lg font-bold cursor-pointer transition ${
                    filterMode === "active" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Live ({activeBuses.length})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreenMap(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Fleet Setup & Controls"
              >
                <Minimize2 size={13} /> <span className="hidden sm:inline">Manage / Setup</span>
              </button>
            </div>
          </div>

          {/* Main 95% Map Canvas */}
          <div className="flex-1 min-h-0 relative bg-slate-950">
            {displayList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center">
                  <Bus size={24} />
                </div>
                <p className="text-sm font-black text-white">
                  {filterMode === "active"
                    ? "अभी कोई बस लाइव ट्रिप पर नहीं है"
                    : "अभी कोई स्कूल बस दर्ज नहीं है"}
                </p>
                <div className="flex items-center gap-2">
                  {filterMode === "active" && buses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      All Buses देखें ({buses.length})
                    </button>
                  )}
                  {canManageFleet && (
                    <button
                      type="button"
                      onClick={() => setShowAddBusModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} /> Add Bus &amp; Driver
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <LiveBusGoogleMap
                buses={displayList.map((b) => {
                  const share = b.liveShareUrl || liveShareByBusId[b.busId] || "";
                  return share ? { ...b, liveShareUrl: share } : b;
                })}
                selectedBusId={currentSelectedBus?.busId}
                onSelectBus={(bid) => setSelectedBusId(bid)}
                routes={mapRouteOverlays}
                homePins={mapHomePinOverlays}
                heightClass="h-full"
                schoolId={school?.id}
                schoolCode={school?.code}
                googleMapsApiKey={schoolMapsApiKey || school?.googleMapsApiKey}
                pinPickLabel={
                  pinningStudentTarget
                    ? `${pinningStudentTarget.studentName} (${pinningStudentTarget.busStop || "Stop"})`
                    : pinningStopName
                }
                onPickLocation={handlePinStopOnMap}
                showOpenInMapsButton={true}
                fitAllOnLoad={true}
                onAreaNamesResolved={setAreaByBusId}
              />
            )}
          </div>

          {/* Bottom Compact Live Fleet Selector & Admin Actions Strip */}
          {buses.length > 0 && (
            <div className="px-2.5 py-2 sm:px-3.5 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
                {displayList.map((b) => {
                  const isSel = b.busId === currentSelectedBus?.busId;
                  const isLive = b.tripStatus === "started";
                  const areaLabel = areaByBusId[b.busId] || b.currentStop || "Depot";
                  return (
                    <button
                      key={b.busId}
                      type="button"
                      onClick={() => setSelectedBusId(b.busId)}
                      className={`px-2.5 py-1.5 rounded-xl border text-left transition cursor-pointer shrink-0 flex items-center gap-2 ${
                        isSel
                          ? "bg-amber-500/20 border-amber-400 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isLive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight whitespace-nowrap">
                          {b.busNumber.split("(")[0].trim()}
                          <span className="ml-1.5 font-mono text-[10px] text-emerald-300">
                            {isLive ? `${b.speed || 0} km/h` : "Idle"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[155px]">
                          📍 {areaLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentSelectedBus && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {currentSelectedBus.driverPhone && (
                    <a
                      href={`tel:${currentSelectedBus.driverPhone}`}
                      className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs"
                    >
                      <Phone size={12} /> <span className="hidden sm:inline">Call</span>
                    </a>
                  )}
                  {(() => {
                    const liveShare =
                      currentSelectedBus.tripStatus === "started" && currentSelectedBus.liveShareActive !== false
                        ? String(currentSelectedBus.liveShareUrl || liveShareByBusId[currentSelectedBus.busId] || "").trim()
                        : "";
                    const hasPin =
                      Number(currentSelectedBus.latitude) !== 0 &&
                      Number(currentSelectedBus.longitude) !== 0;
                    const targetUrl =
                      liveShare ||
                      (hasPin
                        ? getGoogleMapsUrl(currentSelectedBus.latitude, currentSelectedBus.longitude)
                        : "");
                    if (!targetUrl) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => safeOpenExternalUrl(targetUrl)}
                        className="px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs"
                        title={liveShare ? "Open Driver's Live Location Share in Google Maps" : "Open selected bus in Google Maps (Free)"}
                      >
                        <ExternalLink size={12} /> <span>{liveShare ? "Live G-Maps" : "Google Maps"}</span>
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
            <Bus size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide truncate">
                Live Bus Fleet Radar (लाइव बस ट्रैकर)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                {activeBuses.length} Active On Route
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Real-time GPS telemetry • Auto-syncing every 3-5 seconds
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageFleet && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMapsApiKeyDraft(schoolMapsApiKey || String(school?.googleMapsApiKey || "").trim());
                  setShowMapsApiKeyModal(true);
                }}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                  schoolMapsApiKey || school?.googleMapsApiKey
                    ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
                }`}
                title="Optional Google Maps API Key (Default Free Map)"
              >
                <Sliders size={14} />
                <span>{schoolMapsApiKey || school?.googleMapsApiKey ? "G-Maps API: ON" : "Map API Key"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddBusModal(true)}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={14} /> Add Bus &amp; Driver
              </button>
            </>
          )}
          {onOpenDriverConsole && (
            <button
              type="button"
              onClick={onOpenDriverConsole}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Navigation size={14} /> Driver Console
            </button>
          )}

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filterMode === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({buses.length})
            </button>
            <button
              onClick={() => setFilterMode("active")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filterMode === "active" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Active ({activeBuses.length})
            </button>
          </div>
        </div>
      </div>

      {/* School Admin Quick 3-Step Setup Strip (Hairline-divided, no nested box) */}
      {canManageFleet && (
        <div className="pb-3 border-b border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-slate-300 space-y-0.5">
            <p className="font-black text-amber-300 text-[11px] uppercase tracking-wider">
              School Bus Setup (3 Aasan Steps):
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              1) <strong className="text-white">Add Bus &amp; Driver</strong> dabakar bus jodein (saath hi <strong className="text-amber-300">Driver ID Card + QR</strong> ban jayega) → 2) Driver apne ID Card ka <strong className="text-white">QR Code scan</strong> karke app me login karega → 3) Driver <strong className="text-emerald-300">Start Trip</strong> dabayega aur live tracking chalu ho jayegi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {currentSelectedBus && (
              <button
                type="button"
                onClick={() =>
                  setSelectedDriverForIdCard({
                    busId: currentSelectedBus.busId,
                    busNumber: currentSelectedBus.busNumber,
                    route: currentSelectedBus.route,
                    driverName: currentSelectedBus.driverName || "Bus Driver",
                    driverPhone: currentSelectedBus.driverPhone || "",
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <QrCode size={14} />
                <span>Driver ID Card (QR)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleCopyDriverLink(currentSelectedBus)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Link2 size={14} />
              <span>{currentSelectedBus ? "Copy Driver Link" : "Copy Driver Portal Link"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid: Left List + Right Interactive Vector Radar */}
      {!currentSelectedBus ? (
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mx-auto">
            <Bus size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white">अभी कोई लाइव बस या रूट दर्ज नहीं है</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              पहले अपने स्कूल की बस और ड्राइवर का नाम जोड़ें, फिर ड्राइवर को उसका अलग Mobile GPS Link भेजें।
            </p>
          </div>
          {canManageFleet && (
            <button
              type="button"
              onClick={() => setShowAddBusModal(true)}
              className="mx-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs inline-flex items-center gap-2 cursor-pointer shadow"
            >
              <Plus size={16} /> Add First School Bus &amp; Driver
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Fleet List (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          {displayList.map((bus) => {
            const isSelected = bus.busId === currentSelectedBus.busId;
            const isLive = bus.tripStatus === "started";

            return (
              <div
                key={bus.busId}
                onClick={() => setSelectedBusId(bus.busId)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? "bg-slate-800/90 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{bus.busNumber}</span>
                  </div>

                  {isLive ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black animate-pulse">
                      <Radio size={12} className="animate-spin" /> LIVE • {bus.speed} km/h
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold">
                      Depot Idle
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 font-medium mb-2 line-clamp-1">{bus.route}</p>

                {/* Sub details */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span className="flex items-center gap-1 min-w-0">
                    <MapPin size={12} className="text-indigo-400 shrink-0" />
                    <span className="truncate max-w-[170px]">
                      {areaByBusId[bus.busId] || bus.currentStop || "Depot"}
                    </span>
                  </span>
                  <span className="font-mono text-slate-500 shrink-0">
                    {bus.lastUpdated ? new Date(bus.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Radar & Vehicle HUD (8 cols — Single Card Surface with Hairline Dividers) */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden space-y-3">
          {/* Top Info Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 z-10">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">
                Full Fleet Control Room Map
              </span>
              <h3 className="text-base font-black text-white truncate">{currentSelectedBus.busNumber}</h3>
              <p className="text-xs text-slate-400 truncate">
                {areaByBusId[currentSelectedBus.busId]
                  ? `📍 ${areaByBusId[currentSelectedBus.busId]} • ${currentSelectedBus.route}`
                  : currentSelectedBus.route}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setVisualizerMode("map")}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    visualizerMode === "map"
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <MapIcon size={12} /> Live Map
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizerMode("radar")}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    visualizerMode === "radar"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Radio size={12} /> 2 KM Radar
                </button>
              </div>
              {visualizerMode === "map" && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsFullscreenMap(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs transition"
                    title="Open 95% Fullscreen Map for All Buses"
                  >
                    <Maximize2 size={12} /> 95% Full Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHomePinsOnMap((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border cursor-pointer transition ${
                      showHomePinsOnMap
                        ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                    title="Show/Hide Student Home Pins on Map"
                  >
                    <Home size={12} /> Homes
                  </button>
                </>
              )}
              {(() => {
                const liveShare =
                  currentSelectedBus.tripStatus === "started" && currentSelectedBus.liveShareActive !== false
                    ? String(currentSelectedBus.liveShareUrl || liveShareByBusId[currentSelectedBus.busId] || "").trim()
                    : "";
                const hasPin =
                  Number(currentSelectedBus.latitude) !== 0 &&
                  Number(currentSelectedBus.longitude) !== 0;
                const targetUrl =
                  liveShare ||
                  (hasPin
                    ? getGoogleMapsUrl(currentSelectedBus.latitude, currentSelectedBus.longitude)
                    : "");
                if (!targetUrl) return null;
                return (
                  <button
                    type="button"
                    onClick={() => safeOpenExternalUrl(targetUrl)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                  >
                    <ExternalLink size={13} /> {liveShare ? "Live G-Maps" : "Google Maps"}
                  </button>
                );
              })()}
              {canManageFleet && currentSelectedBus && (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenEditBus(currentSelectedBus)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
                    title="Edit Bus & Driver"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBus(currentSelectedBus.busId)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 text-xs font-bold flex items-center gap-1 border border-rose-500/30 cursor-pointer"
                    title="Delete Bus"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </>
              )}
              {currentSelectedBus.driverPhone && (
                <a
                  href={`tel:${currentSelectedBus.driverPhone}`}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
                >
                  <Phone size={13} /> Call Driver
                </a>
              )}
            </div>
          </div>

          {/* Admin 1-Tap Stop Pinning Bar (Hairline-divided strip, no nested card box) */}
          {canManageFleet && visualizerMode === "map" && (
            <div className="pt-2.5 border-t border-slate-800/70 flex flex-wrap items-center gap-1.5 text-[11px]">
              {selectedBusRouteObj && selectedBusRouteObj.stops.length > 0 && (
                <>
                  <span className="font-black text-amber-300 flex items-center gap-1 mr-1">
                    <LocateFixed size={13} /> Pin Route Stops:
                  </span>
                  {selectedBusRouteObj.stops.map((st, idx) => {
                    const hasCoords = Number.isFinite(Number(st.lat)) && Number.isFinite(Number(st.lng));
                    const isPicking = pinningStopName === st.stopName && !pinningStudentTarget;
                    return (
                      <button
                        key={st.id || `${st.stopName}_${idx}`}
                        type="button"
                        onClick={() => {
                          setPinningStudentTarget(null);
                          setPinningStopName((prev) => (prev === st.stopName ? null : st.stopName));
                        }}
                        className={`px-2 py-1 rounded-lg font-bold border flex items-center gap-1 cursor-pointer transition ${
                          isPicking
                            ? "bg-amber-500 text-slate-950 border-white animate-pulse"
                            : hasCoords
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60"
                              : "bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/50"
                        }`}
                        title={
                          hasCoords
                            ? `Pinned (${Number(st.lat).toFixed(4)}, ${Number(st.lng).toFixed(4)}) — क्लिक करके लोकेशन बदलें`
                            : "क्लिक करें और फिर मैप पर इस स्टॉप की जगह टैप करें"
                        }
                      >
                        <span>{idx + 1}. {st.stopName}</span>
                        {hasCoords && <CheckCircle2 size={11} className="text-emerald-400" />}
                      </button>
                    );
                  })}
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setPinningStopName(null);
                  setPinningStudentTarget(null);
                  setShowStudentPinModal(true);
                }}
                className="ml-auto px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold border border-indigo-400/40 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Student Location (Stop) Add Karein
              </button>

              {(pinningStopName || pinningStudentTarget) && (
                <button
                  type="button"
                  onClick={() => {
                    setPinningStopName(null);
                    setPinningStudentTarget(null);
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-950/70 text-rose-300 border border-rose-500/30 font-bold cursor-pointer"
                >
                  Cancel Pin
                </button>
              )}
            </div>
          )}

          {/* Big Full-Fleet Interactive Map (Default) OR 2 KM Proximity Radar */}
          {visualizerMode === "map" ? (
            <div>
              <LiveBusGoogleMap
                buses={displayList.map((b) => {
                  const share = b.liveShareUrl || liveShareByBusId[b.busId] || "";
                  return share ? { ...b, liveShareUrl: share } : b;
                })}
                selectedBusId={currentSelectedBus?.busId}
                onSelectBus={(bid) => setSelectedBusId(bid)}
                routes={mapRouteOverlays}
                homePins={mapHomePinOverlays}
                heightClass="h-[360px] sm:h-[490px]"
                schoolId={school?.id}
                schoolCode={school?.code}
                googleMapsApiKey={schoolMapsApiKey || school?.googleMapsApiKey}
                pinPickLabel={
                  pinningStudentTarget
                    ? `${pinningStudentTarget.studentName} (${pinningStudentTarget.busStop || "Stop"})`
                    : pinningStopName
                }
                onPickLocation={handlePinStopOnMap}
                showOpenInMapsButton={true}
                fitAllOnLoad={true}
                onAreaNamesResolved={setAreaByBusId}
              />
            </div>
          ) : (
            <div className="my-4 relative w-full h-64 sm:h-72 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 flex items-center justify-center overflow-hidden">
              {/* Range Ring Labels (100% Free Haversine Radar) */}
              <span className="absolute top-2 left-3 text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-500/30 z-10">
                100% FREE LIVE GHAR RADAR • 2 KM RANGE
              </span>
              <span className="absolute bottom-2 right-3 text-[10px] text-slate-400 font-mono z-10">
                {homePins.length} Ghar Pins Tracked
              </span>

              {/* Concentric Range Circles */}
              <div className="absolute w-60 h-60 rounded-full border border-emerald-500/15"></div>
              <div className="absolute w-44 h-44 rounded-full border border-cyan-500/20"></div>
              <div className="absolute w-24 h-24 rounded-full border border-amber-500/25"></div>
              <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800"></div>
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800"></div>

              {/* Plotted Student Houses at True Bearing & Distance */}
              {proximityList.slice(0, 12).map((pin) => {
                const maxRadiusPx = 112;
                const clampedDist = Math.min(pin.distanceMeters, 2200);
                const radiusPx = Math.max(24, (clampedDist / 2200) * maxRadiusPx);
                const rad = ((pin.bearingDeg - 90) * Math.PI) / 180;
                const x = Math.cos(rad) * radiusPx;
                const y = Math.sin(rad) * radiusPx;
                const isNear = pin.distanceMeters <= 500;
                const isArrived = pin.distanceMeters <= 150;

                return (
                  <div
                    key={pin.studentId}
                    style={{
                      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
                    }}
                    className="absolute z-10 flex flex-col items-center pointer-events-auto"
                    title={`${pin.studentName} — ${formatDistanceShort(pin.distanceMeters)}`}
                  >
                    <div
                      className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black border shadow-md whitespace-nowrap flex items-center gap-1 ${
                        isArrived
                          ? "bg-emerald-500 text-slate-950 border-white animate-bounce"
                          : isNear
                            ? "bg-amber-500 text-slate-950 border-amber-200"
                            : "bg-slate-900/95 text-cyan-200 border-cyan-500/40"
                      }`}
                    >
                      <Home size={9} />
                      <span>{pin.studentName.split(" ")[0]}</span>
                      <span className="opacity-80 font-mono">
                        {formatDistanceShort(pin.distanceMeters)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Center Bus Pin */}
              <div className="relative z-20 flex flex-col items-center">
                <div className="relative">
                  <span className="absolute -inset-2 rounded-full bg-amber-400 opacity-30 animate-pulse"></span>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xl shadow-amber-500/30">
                    <Bus size={20} />
                  </div>
                </div>
                <div className="mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300 shadow-md">
                  {currentSelectedBus.speed} km/h •{" "}
                  {currentSelectedBus.tripStatus === "started" ? "LIVE" : "DEPOT"}
                </div>
              </div>
            </div>
          )}

          {/* LIVE FREE HOUSE PROXIMITY BOARD (Hairline-divided section, flat rows) */}
          <div className="pt-3 border-t border-slate-800/70 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                <Home size={14} /> किसके घर / स्टॉप के पास गाड़ी पहुँची (Student Stop Locations)
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">
                  {homePins.length} Locations
                </span>
                {canManageFleet && (
                  <button
                    type="button"
                    onClick={() => setShowStudentPinModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Student Location
                  </button>
                )}
              </div>
            </div>

            {homePins.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                अभी किसी बच्चे/स्टॉप का GPS Pin सेव नहीं है। ऊपर <strong>+ Add Student Location</strong> दबाकर हर बच्चे की लोकेशन जोड़ें — वही उसका स्टॉप लोकेशन बन जाएगी।
              </p>
            ) : proximityList.length === 0 ? (
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 pr-1">
                {homePins.slice(0, 15).map((item) => (
                  <div
                    key={item.studentId}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">
                        {item.studentName}
                        {item.className ? (
                          <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                            ({item.className})
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-amber-300 truncate">
                        📍 Stop: {item.busStop || "Home Stop"} • {item.homeLat.toFixed(4)}, {item.homeLng.toFixed(4)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        safeOpenExternalUrl(
                          `https://www.google.com/maps?q=${item.homeLat},${item.homeLng}`
                        )
                      }
                      className="text-[10px] text-indigo-300 hover:underline cursor-pointer shrink-0"
                    >
                      View Map ↗
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 pr-1">
                {proximityList.slice(0, 12).map((item) => (
                  <div
                    key={item.studentId}
                    className={`py-2 flex items-center justify-between gap-2 text-xs ${
                      item.studentId === currentStudent?.id
                        ? "bg-emerald-950/30 px-2 rounded-lg"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">
                        {item.studentName}
                        {item.busStop ? (
                          <span className="text-[10px] text-amber-300 font-semibold ml-1.5">
                            • {item.busStop}
                          </span>
                        ) : null}
                        {item.className ? (
                          <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                            ({item.className})
                          </span>
                        ) : null}
                      </p>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold ${item.status.badgeClass}`}
                      >
                        {item.status.label}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-amber-300 block">
                        {formatDistanceShort(item.distanceMeters)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          safeOpenExternalUrl(
                            `https://www.google.com/maps?q=${item.homeLat},${item.homeLng}`
                          )
                        }
                        className="text-[10px] text-indigo-300 hover:underline cursor-pointer"
                      >
                        Home Pin ↗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Telemetry Metrics Footer (Crisp hairline-divided cells, no nested card borders) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/70 text-center pt-3 border-t border-slate-800/70">
            <div className="p-2">
              <span className="text-[10px] text-slate-400 block font-semibold">ड्राइवर का नाम</span>
              <span className="text-xs font-bold text-white truncate block">{currentSelectedBus.driverName || "—"}</span>
            </div>
            <div className="p-2">
              <span className="text-[10px] text-slate-400 block font-semibold">करंट स्टॉप</span>
              <span className="text-xs font-bold text-indigo-400 truncate block">
                {currentSelectedBus.currentStop || "Depot"}
              </span>
            </div>
            <div className="p-2">
              <span className="text-[10px] text-slate-400 block font-semibold">GPS अक्षांश / देशांतर</span>
              <span className="text-xs font-bold font-mono text-slate-200 block truncate">
                {Number(currentSelectedBus.latitude || 0).toFixed(4)}, {Number(currentSelectedBus.longitude || 0).toFixed(4)}
              </span>
            </div>
            <div className="p-2">
              <span className="text-[10px] text-slate-400 block font-semibold">स्टॉप्स प्रगति</span>
              <span className="text-xs font-bold font-mono text-emerald-400 block">
                {currentSelectedBus.completedStops?.length || 0} / {currentSelectedBus.totalStops || 0}
              </span>
            </div>
          </div>

          {canManageFleet && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                Driver ke login ke liye ID Card QR ya direct link:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDriverForIdCard({
                      busId: currentSelectedBus.busId,
                      busNumber: currentSelectedBus.busNumber,
                      route: currentSelectedBus.route,
                      driverName: currentSelectedBus.driverName || "Bus Driver",
                      driverPhone: currentSelectedBus.driverPhone || "",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow"
                >
                  <QrCode size={13} /> Driver ID Card
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyDriverLink(currentSelectedBus)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Copy size={13} /> Copy Driver Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Quick Add Bus & Driver Modal */}
      {showAddBusModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Bus className="w-5 h-5 text-emerald-400" />
                <span>{editingBusId ? "Edit School Bus & Driver" : "Add School Bus & Driver"}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddBusModal(false);
                  setEditingBusId(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddQuickBus} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Bus / Vehicle Number *</label>
                <input
                  type="text"
                  required
                  value={newBusNumber}
                  onChange={(e) => setNewBusNumber(e.target.value)}
                  placeholder="e.g. DL-1PC-4590 (Bus #1)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Route Name</label>
                <input
                  type="text"
                  value={newBusRoute}
                  onChange={(e) => setNewBusRoute(e.target.value)}
                  placeholder="e.g. Route 1: Nagra → Affour → Dharaka Market → School"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Bus Stops (Comma separated)</label>
                <input
                  type="text"
                  value={newBusStops}
                  onChange={(e) => setNewBusStops(e.target.value)}
                  placeholder="e.g. Nagra Chowk, Affour Bazaar, Dharaka Market, School Gate"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Driver Name</label>
                  <input
                    type="text"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="e.g. Rameshwar Singh"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Driver Phone</label>
                  <input
                    type="tel"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    placeholder="e.g. 9818023450"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">
                  Google Maps Live Share Link (Optional — 1 Time Save)
                </label>
                <input
                  type="text"
                  value={newBusLiveShareUrl}
                  onChange={(e) => setNewBusLiveShareUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... (Start Drive par active hoga)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBusModal(false);
                    setEditingBusId(null);
                    setNewBusLiveShareUrl("");
                  }}
                  className="px-4 py-2 bg-slate-800 rounded-xl text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl cursor-pointer"
                >
                  {editingBusId ? "Update Bus & Driver" : "Save Bus & Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Optional School Google Maps API Key Settings Modal */}
      {showMapsApiKeyModal && (
        <div className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>Google Maps API Key (Optional)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMapsApiKeyModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[11px] text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-3 leading-relaxed">
                <strong>Default Free Mode:</strong> Bina API Key ke app 100% Free OpenStreetMap + Satellite chalata hai. Agar aapko app ke andar <strong>Asli Google Maps</strong> chahiye, to apne Google Cloud Project ki restricted API Key yahan daalein (HTTP referrer restriction zaroor lagayein).
              </p>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">
                  School Google Maps JS API Key
                </label>
                <input
                  type="text"
                  value={mapsApiKeyDraft}
                  onChange={(e) => setMapsApiKeyDraft(e.target.value)}
                  placeholder="AIzaSy... (khali chhodne par Free Map chalega)"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {schoolMapsApiKey && (
                  <button
                    type="button"
                    disabled={savingMapsApiKey}
                    onClick={async () => {
                      const sid = school?.id;
                      if (!sid) return;
                      setSavingMapsApiKey(true);
                      try {
                        setSchoolMapsApiKey("");
                        setMapsApiKeyDraft("");
                        if (!isDemoSchoolId(sid)) {
                          void sbRtdbSet(`schools/${sid}/maps_config`, {
                            googleMapsApiKey: "",
                            updatedAt: new Date().toISOString(),
                          }).catch(() => {});
                          if (rtdb) {
                            void rtdbSet(dbRef(rtdb, `schools/${sid}/maps_config`), {
                              googleMapsApiKey: "",
                              updatedAt: new Date().toISOString(),
                            }).catch(() => {});
                          }
                          await updateSchool(sid, { googleMapsApiKey: "" });
                        }
                        setShowMapsApiKeyModal(false);
                        toast.info("API Key hata di gayi — ab Free OpenStreetMap default chalega.");
                      } finally {
                        setSavingMapsApiKey(false);
                      }
                    }}
                    className="mr-auto px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 font-bold cursor-pointer"
                  >
                    Use Free Map
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMapsApiKeyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingMapsApiKey}
                  onClick={async () => {
                    const sid = school?.id;
                    if (!sid) return;
                    const cleanKey = mapsApiKeyDraft.trim();
                    setSavingMapsApiKey(true);
                    try {
                      setSchoolMapsApiKey(cleanKey);
                      if (!isDemoSchoolId(sid)) {
                        void sbRtdbSet(`schools/${sid}/maps_config`, {
                          googleMapsApiKey: cleanKey,
                          updatedAt: new Date().toISOString(),
                        }).catch(() => {});
                        if (rtdb) {
                          void rtdbSet(dbRef(rtdb, `schools/${sid}/maps_config`), {
                            googleMapsApiKey: cleanKey,
                            updatedAt: new Date().toISOString(),
                          }).catch(() => {});
                        }
                        await updateSchool(sid, { googleMapsApiKey: cleanKey });
                      }
                      setShowMapsApiKeyModal(false);
                      toast.success(
                        cleanKey
                          ? "Google Maps API Key save ho gayi! Admin, Driver aur Parents ke liye Google Maps active ho gaya."
                          : "Free Map mode active hai."
                      );
                    } finally {
                      setSavingMapsApiKey(false);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
                >
                  {savingMapsApiKey ? "Saving..." : "Save API Key"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Student / Stop Location Modal */}
      {showStudentPinModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <span>Add Student Location (Stop Pin)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowStudentPinModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[11px] text-slate-300 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                Har student ki location add karein — ye automatically unke <strong>Bus Stop ki location</strong> ban jayegi aur Driver Console par <strong>Auto-Checkpoint</strong> dikhayegi.
              </p>

              {/* Search & Select Student */}
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Student Chunein</label>
                <div className="relative mb-1.5">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Naam ya Roll No se khojein..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <select
                  value={selectedPinStudentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPinStudentId(id);
                    const found = schoolStudents.find((s) => s.id === id);
                    if (found) {
                      setStudentStopInput(found.busStop || `${found.name.split(" ")[0]} Stop`);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="">-- Select Student (ya niche custom naam likhein) --</option>
                  {schoolStudents
                    .filter((st) => {
                      const q = studentSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (st.name || "").toLowerCase().includes(q) ||
                        (st.rollNo || "").toLowerCase().includes(q) ||
                        (st.className || "").toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 60)
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} {st.className ? `(${st.className})` : ""}{" "}
                        {st.busStop ? `• ${st.busStop}` : ""}
                      </option>
                    ))}
                </select>
              </div>

              {!selectedPinStudentId && (
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">
                    Ya Direct Student Name Likhein
                  </label>
                  <input
                    type="text"
                    value={customPinStudentName}
                    onChange={(e) => setCustomPinStudentName(e.target.value)}
                    placeholder="e.g. Aarav Kumar (Class 4)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-bold">
                  Stop / Chauk ka Naam (Auto-Checkpoint Name)
                </label>
                <input
                  type="text"
                  value={studentStopInput}
                  onChange={(e) => setStudentStopInput(e.target.value)}
                  placeholder="e.g. Nagra Chowk / Station Road"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
                {selectedBusRouteObj && selectedBusRouteObj.stops.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedBusRouteObj.stops.slice(0, 6).map((sp) => (
                      <button
                        key={sp.id || sp.stopName}
                        type="button"
                        onClick={() => setStudentStopInput(sp.stopName)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer"
                      >
                        {sp.stopName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Location Input */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="block text-slate-300 font-bold">
                  Location Set Karein (3 Aasan Tarike):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={studentPinLinkInput}
                    onChange={(e) => setStudentPinLinkInput(e.target.value)}
                    placeholder="Google Maps link paste karein ya lat, lng"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                  <button
                    type="button"
                    disabled={savingStudentPin}
                    onClick={async () => {
                      const pickedStudent = schoolStudents.find(
                        (s) => s.id === selectedPinStudentId
                      );
                      const studentName =
                        pickedStudent?.name || customPinStudentName.trim();
                      if (!studentName) {
                        toast.error("Student chunein ya naam likhein.");
                        return;
                      }
                      const parsed = await resolveGoogleMapsLocationInput(studentPinLinkInput);
                      if (!parsed) {
                        toast.error("Valid Google Maps link ya 'lat, lng' daalein.");
                        return;
                      }
                      await handleSaveStudentStopLocation(
                        {
                          studentId:
                            pickedStudent?.id || `custom_stop_${Date.now()}`,
                          studentName,
                          rollNo: pickedStudent?.rollNo,
                          className: pickedStudent?.className,
                          busStop:
                            studentStopInput.trim() ||
                            pickedStudent?.busStop ||
                            `${studentName.split(" ")[0]} Stop`,
                          busRoute: currentSelectedBus?.route || pickedStudent?.busRoute || "",
                          busNumber: currentSelectedBus?.busNumber || pickedStudent?.busNumber || "",
                          busId: currentSelectedBus?.busId || "",
                        },
                        parsed.lat,
                        parsed.lng
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shrink-0"
                  >
                    Save
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={savingStudentPin}
                    onClick={() => {
                      const pickedStudent = schoolStudents.find(
                        (s) => s.id === selectedPinStudentId
                      );
                      const studentName =
                        pickedStudent?.name || customPinStudentName.trim();
                      if (!studentName) {
                        toast.error("Pehle Student chunein ya naam likhein.");
                        return;
                      }
                      if (!navigator.geolocation) {
                        toast.error("Device me GPS available nahi hai.");
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          void handleSaveStudentStopLocation(
                            {
                              studentId:
                                pickedStudent?.id || `custom_stop_${Date.now()}`,
                              studentName,
                              rollNo: pickedStudent?.rollNo,
                              className: pickedStudent?.className,
                              busStop:
                                studentStopInput.trim() ||
                                pickedStudent?.busStop ||
                                `${studentName.split(" ")[0]} Stop`,
                              busRoute:
                                currentSelectedBus?.route || pickedStudent?.busRoute || "",
                              busNumber:
                                currentSelectedBus?.busNumber || pickedStudent?.busNumber || "",
                              busId: currentSelectedBus?.busId || "",
                            },
                            Number(pos.coords.latitude.toFixed(6)),
                            Number(pos.coords.longitude.toFixed(6))
                          );
                        },
                        (err) => toast.error(err?.message || "GPS permission allow karein."),
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    }}
                    className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair size={13} /> My Current GPS
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const pickedStudent = schoolStudents.find(
                        (s) => s.id === selectedPinStudentId
                      );
                      const studentName =
                        pickedStudent?.name || customPinStudentName.trim();
                      if (!studentName) {
                        toast.error("Pehle Student chunein ya naam likhein.");
                        return;
                      }
                      setPinningStudentTarget({
                        studentId:
                          pickedStudent?.id || `custom_stop_${Date.now()}`,
                        studentName,
                        rollNo: pickedStudent?.rollNo,
                        className: pickedStudent?.className,
                        busStop:
                          studentStopInput.trim() ||
                          pickedStudent?.busStop ||
                          `${studentName.split(" ")[0]} Stop`,
                        busRoute:
                          currentSelectedBus?.route || pickedStudent?.busRoute || "",
                        busNumber:
                          currentSelectedBus?.busNumber || pickedStudent?.busNumber || "",
                        busId: currentSelectedBus?.busId || "",
                      });
                      setShowStudentPinModal(false);
                      setVisualizerMode("map");
                      toast.info("Ab Live Map par us jagah tap karein jahan student ka stop hai!");
                    }}
                    className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LocateFixed size={13} /> Map Par Tap Karein
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver Official ID Card & QR Generator Modal */}
      <DriverIdCardModal
        isOpen={Boolean(selectedDriverForIdCard)}
        onClose={() => setSelectedDriverForIdCard(null)}
        driver={selectedDriverForIdCard}
        school={school}
      />
    </div>
  );
};
