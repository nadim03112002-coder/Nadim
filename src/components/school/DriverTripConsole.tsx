// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  Bus, Play, Square, Navigation, Phone,
  CheckCircle2, Clock, MapPin, Gauge, AlertTriangle,
  Radio, ArrowLeft, RefreshCw, Smartphone, Map as MapIcon,
  Home, Link2, LogOut, ExternalLink, Sun, Sunset,
  Satellite, ShieldCheck, Users, ChevronDown, ChevronUp
} from "lucide-react";
import type { School, BusLiveLocation } from "../../school-types";
import { shouldUseDemoForSchool } from "../../school-firebase";
import { speakNotification } from "../../utils/voiceNotifyEngine";
import { rtdb, auth, ensureFirebaseAuthSession } from "../../firebase";
import { ref as dbRef, set, onValue } from "firebase/database";
import { sbRtdbSubscribe } from "../../services/supabaseDbAdapter";
import { setErrorLoggerContext, setErrorLoggerModule } from "../../utils/errorLogger";
import { toast } from "sonner";
import {
  getLocalRoutes,
  getLocalFitnessVehicles,
  updateRouteStopCoordinate,
  getBusLiveShareUrl,
  saveBusLiveShareUrl,
} from "../../utils/schoolTransportStore";
import {
  LiveBusGoogleMap,
  type MapRouteOverlay,
  type MapHomePinOverlay,
} from "./LiveBusGoogleMap";
import {
  resolveGoogleMapsLocationInput,
  extractGoogleMapsUrl,
  isGoogleMapsLiveShareLink,
  haversineMeters,
  formatDistanceShort,
  getProximityStatus,
  type StudentHomePin,
} from "../../utils/busProximity";
import { BusGpsTrackerFilter } from "../../utils/busLocationIntel";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { ScreenInfoGuideButton } from "./ScreenInfoGuideButton";
import { LanguageToggleButton } from "./LanguageToggleButton";

function getNativeAndroidBridge(): any {
  try {
    return typeof window !== "undefined" ? (window as any).LifeMakerAndroid : null;
  } catch {
    return null;
  }
}

function isValidCoordPair(lat: any, lng: any): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    (Math.abs(nLat) > 0.001 || Math.abs(nLng) > 0.001) &&
    Math.abs(nLat) <= 90 &&
    Math.abs(nLng) <= 180
  );
}

function isSyntheticGurgaonDefault(lat: any, lng: any): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    Math.abs(nLat - 28.4595) < 0.00025 &&
    Math.abs(nLng - 77.0266) < 0.00025
  );
}

export interface DriverBusConfig {
  id: string;
  busNumber: string;
  route: string;
  driverName: string;
  driverPhone: string;
  stops: string[];
}

interface Props {
  school: School;
  onBack?: () => void;
  onLogout?: () => void;
  initialBusId?: string;
  initialBusMeta?: Partial<DriverBusConfig>;
  standaloneMode?: boolean;
}

const DEFAULT_BUSES = [
  {
    id: "bus-01",
    busNumber: "DL-1PC-4590 (Bus #01)",
    route: "Route 1: City Center → Sector 45 → Institutional Area",
    driverName: "Rameshwar Singh (ड्राइवर)",
    driverPhone: "9818023450",
    stops: ["City Center Metro", "Sector 43 Chowk", "Sector 45 Market", "Green Valley Gate", "School Main Gate"]
  },
  {
    id: "bus-02",
    busNumber: "DL-1PC-8821 (Bus #02)",
    route: "Route 2: Railway Station → Civil Lines → School Campus",
    driverName: "Suraj Pal Yadav (ड्राइवर)",
    driverPhone: "9871109923",
    stops: ["Railway Colony", "Civil Lines Crossing", "Model Town Gate 2", "Vikas Marg", "School Main Gate"]
  },
  {
    id: "bus-03",
    busNumber: "DL-1PC-3312 (Bus #03)",
    route: "Route 3: South Extension → DLF Phase 1 → Campus",
    driverName: "Dharmendra Kumar (ड्राइवर)",
    driverPhone: "9823419088",
    stops: ["South Ext Market", "DLF Ph 1 Roundabout", "Cyber Hub Road", "School Main Gate"]
  }
];

function loadConfiguredFleetForDriver(sid: string, initialBusId?: string, initialBusMeta?: Partial<DriverBusConfig>, isDemo?: boolean): DriverBusConfig[] {
  const byId = new Map<string, DriverBusConfig>();
  if (sid) {
    getLocalFitnessVehicles(sid).forEach((v: any, idx: number) => {
      const id = v.id || `bus_${idx + 1}`;
      byId.set(id, {
        id,
        busNumber: v.vehicleNumber || `Bus #${idx + 1}`,
        route: v.route || v.model || "Campus Route",
        driverName: v.driverName || "Driver",
        driverPhone: v.driverPhone || "",
        stops: Array.isArray(v.stops) && v.stops.length > 0 ? v.stops : ["Start Point", "Main Chowk", "School Main Gate"],
      });
    });

    getLocalRoutes(sid).forEach((r) => {
      const id = r.busId || r.id;
      const stopNames = r.stops.map((s) => s.stopName).filter(Boolean);
      byId.set(id, {
        id,
        busNumber: r.busNumber || byId.get(id)?.busNumber || r.routeName,
        route: r.routeName,
        driverName: r.driverName || byId.get(id)?.driverName || "Driver",
        driverPhone: r.driverPhone || byId.get(id)?.driverPhone || "",
        stops: stopNames.length > 0 ? stopNames : ["Start Point", "Main Chowk", "School Main Gate"],
      });
    });
  }

  if (initialBusMeta?.id || initialBusId) {
    const targetId = initialBusMeta?.id || initialBusId || "bus_direct";
    if (!byId.has(targetId) && (initialBusMeta?.busNumber || initialBusMeta?.route)) {
      byId.set(targetId, {
        id: targetId,
        busNumber: initialBusMeta.busNumber || "School Bus",
        route: initialBusMeta.route || "School Bus Route",
        driverName: initialBusMeta.driverName || "Bus Driver",
        driverPhone: initialBusMeta.driverPhone || "",
        stops: Array.isArray(initialBusMeta.stops) && initialBusMeta.stops.length > 0 ? initialBusMeta.stops : ["Start Point", "Main Chowk", "School Main Gate"],
      });
    }
  }

  const list = Array.from(byId.values());
  if (list.length === 0 && isDemo) return DEFAULT_BUSES;
  return list;
}

export const DriverTripConsole: React.FC<Props> = ({
  school,
  onBack,
  onLogout,
  initialBusId,
  initialBusMeta,
  standaloneMode = false,
}) => {
  const isDemo = shouldUseDemoForSchool(school?.id);
  const [fleetBuses, setFleetBuses] = useState<DriverBusConfig[]>(() =>
    loadConfiguredFleetForDriver(school?.id || "", initialBusId, initialBusMeta, isDemo)
  );

  useEffect(() => {
    const sid = school?.id || "";
    const refreshFleet = () => {
      setFleetBuses(loadConfiguredFleetForDriver(sid, initialBusId, initialBusMeta, isDemo));
      setRoutesVersion((v) => v + 1);
    };
    window.addEventListener("school-transport-updated", refreshFleet);
    return () => window.removeEventListener("school-transport-updated", refreshFleet);
  }, [school?.id, initialBusId, isDemo]);

  // Hydrate school's configured bus fleet from Supabase Realtime & RTDB
  useEffect(() => {
    const sid = school?.id;
    if (!sid) return;
    const applyFleetVal = (val: any) => {
      if (!val || typeof val !== "object") return;
      const arr = Object.values(val) as any[];
      if (arr.length === 0) return;
      const mapped: DriverBusConfig[] = arr
        .filter((v: any) => v && v.id)
        .map((v: any, idx: number) => ({
          id: v.id || `bus_${idx + 1}`,
          busNumber: v.vehicleNumber || v.busNumber || `Bus #${idx + 1}`,
          route: v.route || v.model || "Campus Route",
          driverName: v.driverName || "Driver",
          driverPhone: v.driverPhone || "",
          stops:
            Array.isArray(v.stops) && v.stops.length > 0
              ? v.stops
              : ["Start Point", "Main Chowk", "School Main Gate"],
        }));
      if (mapped.length > 0) {
        setFleetBuses((prev) => {
          const byId = new Map<string, DriverBusConfig>(prev.map((b) => [b.id, b]));
          mapped.forEach((b) => byId.set(b.id, b));
          return Array.from(byId.values());
        });
      }
    };

    const unsubSb = sbRtdbSubscribe(`schools/${sid}/bus_fleet`, applyFleetVal);
    let unsub: any = null;
    if (rtdb) {
      try {
        unsub = onValue(dbRef(rtdb, `schools/${sid}/bus_fleet`), (snap) => {
          if (snap.exists()) applyFleetVal(snap.val());
        });
      } catch {}
    }
    return () => {
      unsubSb();
      if (typeof unsub === "function") unsub();
    };
  }, [school?.id]);

  const [selectedBusId, setSelectedBusId] = useState(
    initialBusId || fleetBuses[0]?.id || DEFAULT_BUSES[0].id
  );
  useEffect(() => {
    if (fleetBuses.length > 0 && !fleetBuses.some((b) => b.id === selectedBusId)) {
      setSelectedBusId(initialBusId && fleetBuses.some((b) => b.id === initialBusId) ? initialBusId : fleetBuses[0].id);
    }
  }, [fleetBuses, initialBusId, selectedBusId]);

  const selectedBus: DriverBusConfig =
    fleetBuses.find((b) => b.id === selectedBusId) ||
    fleetBuses[0] || {
      id: initialBusId || "bus_unconfigured",
      busNumber: initialBusMeta?.busNumber || "No Bus Added Yet",
      route: initialBusMeta?.route || "School Admin se bus add karwayein",
      driverName: initialBusMeta?.driverName || "Driver",
      driverPhone: initialBusMeta?.driverPhone || "",
      stops: ["Start Point", "Main Chowk", "School Main Gate"],
    };

  const [tripType, setTripType] = useState<"morning_pickup" | "afternoon_drop">("morning_pickup");
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [completedStops, setCompletedStops] = useState<string[]>([]);
  const [tripDuration, setTripDuration] = useState(0); // in seconds
  const [distanceKm, setDistanceKm] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<
    "idle" | "searching" | "active" | "network_fallback" | "denied" | "error"
  >("idle");
  const [showLiveMap, setShowLiveMap] = useState<boolean>(true);
  const [showBackupLinkBox, setShowBackupLinkBox] = useState<boolean>(false);
  const [routesVersion, setRoutesVersion] = useState<number>(0);
  const [manualLocationText, setManualLocationText] = useState<string>("");
  const [resolvingLocationLink, setResolvingLocationLink] = useState<boolean>(false);
  const [savedLiveShareUrl, setSavedLiveShareUrl] = useState<string>(() =>
    getBusLiveShareUrl(school?.id || "", initialBusId || fleetBuses[0]?.id || "")
  );
  const [liveShareInput, setLiveShareInput] = useState<string>("");
  const [savingLiveShare, setSavingLiveShare] = useState<boolean>(false);
  const [schoolMapsApiKey, setSchoolMapsApiKey] = useState<string>(() =>
    String(school?.googleMapsApiKey || "").trim()
  );
  const [visitedStudentIds, setVisitedStudentIds] = useState<string[]>([]);
  const [studentHomePins, setStudentHomePins] = useState<StudentHomePin[]>([]);
  const [nativeBgGpsActive, setNativeBgGpsActive] = useState<boolean>(() => {
    try {
      const bridge = getNativeAndroidBridge();
      return Boolean(bridge?.isBusGpsServiceRunning?.());
    } catch {
      return false;
    }
  });

  const isEmbeddedIframe = React.useMemo(() => {
    try {
      return typeof window !== "undefined" && window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const standaloneDriverTabUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "/?driverConsole=1";
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("driverConsole", "1");
      if (school?.id) url.searchParams.set("schoolId", school.id);
      if (school?.code) url.searchParams.set("schoolCode", school.code);
      if (school?.name) url.searchParams.set("schoolName", school.name);
      if (selectedBus?.id) url.searchParams.set("busId", selectedBus.id);
      if (selectedBus?.busNumber) url.searchParams.set("busNumber", selectedBus.busNumber);
      if (selectedBus?.route) url.searchParams.set("route", selectedBus.route);
      if (selectedBus?.driverName) url.searchParams.set("driverName", selectedBus.driverName);
      if (selectedBus?.driverPhone) url.searchParams.set("driverPhone", selectedBus.driverPhone);
      return url.toString();
    } catch {
      return "/?driverConsole=1";
    }
  }, [
    school?.id,
    school?.code,
    school?.name,
    selectedBus?.id,
    selectedBus?.busNumber,
    selectedBus?.route,
    selectedBus?.driverName,
    selectedBus?.driverPhone,
  ]);

  useEffect(() => {
    setErrorLoggerModule(`Driver GPS Console → ${selectedBus.busNumber}`);
    setErrorLoggerContext({
      schoolId: school?.id || null,
      schoolName: school?.name || null,
    });
  }, [school?.id, school?.name, selectedBus.busNumber]);

  useEffect(() => {
    const sid = school?.id || "";
    try {
      const raw = sid ? localStorage.getItem(`nst_student_home_pins_${sid}`) : null;
      if (raw) {
        const obj = JSON.parse(raw) || {};
        const arr = Object.values(obj).filter(
          (p: any) => Number.isFinite(Number(p?.homeLat)) && Number.isFinite(Number(p?.homeLng))
        ) as StudentHomePin[];
        if (arr.length > 0) setStudentHomePins(arr);
      }
    } catch {}

    if (!sid) return;
    const applyPinsVal = (val: any) => {
      if (!val || typeof val !== "object") return;
      const arr = Object.values(val).filter(
        (p: any) => p?.studentId && Number.isFinite(Number(p?.homeLat)) && Number.isFinite(Number(p?.homeLng))
      ) as StudentHomePin[];
      if (arr.length > 0) {
        setStudentHomePins(
          arr.map((p) => ({
            ...p,
            homeLat: Number(p.homeLat),
            homeLng: Number(p.homeLng),
          }))
        );
      }
    };

    const unsubSbPins = sbRtdbSubscribe(`schools/${sid}/student_home_pins`, applyPinsVal);
    let unsub: any = null;
    if (rtdb) {
      try {
        unsub = onValue(dbRef(rtdb, `schools/${sid}/student_home_pins`), (snap) => {
          if (snap.exists()) applyPinsVal(snap.val());
        });
      } catch {}
    }
    return () => {
      unsubSbPins();
      if (typeof unsub === "function") unsub();
    };
  }, [school?.id]);

  useEffect(() => {
    const sid = school?.id || "";
    const localUrl = getBusLiveShareUrl(sid, selectedBus.id);
    setSavedLiveShareUrl(localUrl);
    setLiveShareInput(localUrl);
    if (!sid) return;

    const unsubSbShare = sbRtdbSubscribe(
      `schools/${sid}/bus_live_share/${selectedBus.id}`,
      (val: any) => {
        const u = String(val?.liveShareUrl || val || "").trim();
        if (u) {
          setSavedLiveShareUrl(u);
          setLiveShareInput(u);
        }
      }
    );
    const unsubSbMaps = sbRtdbSubscribe(`schools/${sid}/maps_config`, (val: any) => {
      if (val && typeof val === "object" && typeof val.googleMapsApiKey === "string") {
        setSchoolMapsApiKey(val.googleMapsApiKey.trim());
      }
    });
    let unsubRtdbShare: any = null;
    let unsubRtdbMaps: any = null;
    if (rtdb) {
      try {
        unsubRtdbShare = onValue(
          dbRef(rtdb, `schools/${sid}/bus_live_share/${selectedBus.id}`),
          (snap) => {
            const v = snap.val();
            const u = String(v?.liveShareUrl || v || "").trim();
            if (u) {
              setSavedLiveShareUrl(u);
              setLiveShareInput(u);
            }
          }
        );
      } catch {}
      try {
        unsubRtdbMaps = onValue(dbRef(rtdb, `schools/${sid}/maps_config`), (snap) => {
          const v = snap.val();
          if (v && typeof v.googleMapsApiKey === "string") {
            setSchoolMapsApiKey(v.googleMapsApiKey.trim());
          }
        });
      } catch {}
    }
    return () => {
      if (typeof unsubSbShare === "function") unsubSbShare();
      if (typeof unsubSbMaps === "function") unsubSbMaps();
      if (typeof unsubRtdbShare === "function") unsubRtdbShare();
      if (typeof unsubRtdbMaps === "function") unsubRtdbMaps();
    };
  }, [school?.id, selectedBus.id]);

  const busFilteredPins = React.useMemo(() => {
    const busNumLow = (selectedBus.busNumber || "").toLowerCase();
    const busRouteLow = (selectedBus.route || "").toLowerCase();
    return studentHomePins.filter((p) => {
      const pRoute = (p.busRoute || "").trim().toLowerCase();
      const pBusNum = (p.busNumber || "").trim().toLowerCase();
      if (!pRoute && !pBusNum) return true;
      if (fleetBuses.length <= 1) return true;
      if (pBusNum && busNumLow && (busNumLow.includes(pBusNum) || pBusNum.includes(busNumLow))) {
        return true;
      }
      if (
        pRoute &&
        (busRouteLow.includes(pRoute) ||
          pRoute.includes(busRouteLow) ||
          busNumLow.includes(pRoute) ||
          pRoute.includes(busNumLow))
      ) {
        return true;
      }
      return false;
    });
  }, [studentHomePins, selectedBus.busNumber, selectedBus.route, fleetBuses.length]);

  const nearestHomes = React.useMemo(() => {
    const base = busFilteredPins.length > 0 ? busFilteredPins : studentHomePins;
    const visitedSet = new Set(visitedStudentIds);
    const pending = base.filter((p) => !visitedSet.has(p.studentId));
    if (!coords) {
      return pending.slice(0, 6).map((p) => ({
        ...p,
        distanceMeters: -1,
        status: getProximityStatus(5000),
      }));
    }
    return pending
      .map((p) => {
        const meters = haversineMeters(coords.lat, coords.lng, p.homeLat, p.homeLng);
        return {
          ...p,
          distanceMeters: meters,
          status: getProximityStatus(meters),
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 6);
  }, [coords, busFilteredPins, studentHomePins, visitedStudentIds]);

  const nextUpcomingStudent = nearestHomes[0] || null;
  const driverVoiceNotifiedRef = useRef<Set<string>>(new Set());

  // Driver Voice Announcement + Auto-Advance when approaching/arriving at next student's stop
  useEffect(() => {
    if (!isTripActive || !coords || !nextUpcomingStudent) return;
    const dist = nextUpcomingStudent.distanceMeters;
    if (dist < 0) return;

    const stId = nextUpcomingStudent.studentId;
    const approachKey = `approach_${stId}`;
    const arriveKey = `arrive_${stId}`;

    if (dist <= 500 && dist > 150 && !driverVoiceNotifiedRef.current.has(approachKey)) {
      driverVoiceNotifiedRef.current.add(approachKey);
      const stopText = nextUpcomingStudent.busStop ? ` (${nextUpcomingStudent.busStop})` : "";
      speakNotification(
        "अगला स्टॉप नजदीक",
        `अगला स्टॉप ${nextUpcomingStudent.studentName}${stopText}, ${formatDistanceShort(dist)} आगे है।`
      );
      toast.info(`🚌 अगला स्टॉप: ${nextUpcomingStudent.studentName} (${formatDistanceShort(dist)})`);
    }

    if (dist <= 150 && !driverVoiceNotifiedRef.current.has(arriveKey)) {
      driverVoiceNotifiedRef.current.add(arriveKey);
      speakNotification(
        "स्टॉप आ गया",
        `${nextUpcomingStudent.studentName} का स्टॉप आ गया है।`
      );
      toast.success(`🏠 ${nextUpcomingStudent.studentName} के स्टॉप पर पहुँच गए!`);
      setVisitedStudentIds((prev) => (prev.includes(stId) ? prev : [...prev, stId]));
    }
  }, [isTripActive, coords?.lat, coords?.lng, nextUpcomingStudent]);

  const watchIdRef = useRef<number | null>(null);
  const fallbackWatchIdRef = useRef<number | null>(null);
  const tripIntervalRef = useRef<any>(null);
  const gpsFilterRef = useRef<BusGpsTrackerFilter>(new BusGpsTrackerFilter());
  const lastCoordsRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const bestFixRef = useRef<{
    lat: number;
    lng: number;
    accuracy: number;
    time: number;
    isCoarse: boolean;
  } | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const currentHeadingRef = useRef<number>(0);
  const isTripActiveRef = useRef<boolean>(false);
  const completedStopsRef = useRef<string[]>([]);
  const autoCompletedStopsRef = useRef<Set<string>>(new Set());
  const notifiedProximityRef = useRef<Map<string, number>>(new Map());
  const wakeLockRef = useRef<any>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  coordsRef.current = coords;
  isTripActiveRef.current = isTripActive;
  completedStopsRef.current = completedStops;

  // Screen Wake Lock: keeps driver's phone screen awake while trip is active so Android doesn't pause GPS
  useEffect(() => {
    let cancelled = false;

    const acquireWakeLock = async () => {
      if (!isTripActive) return;
      try {
        const nav: any = typeof navigator !== "undefined" ? navigator : null;
        if (nav?.wakeLock?.request) {
          const sentinel = await nav.wakeLock.request("screen");
          if (cancelled) {
            sentinel.release().catch(() => {});
            return;
          }
          wakeLockRef.current = sentinel;
          setWakeLockActive(true);
          sentinel.addEventListener?.("release", () => {
            if (!cancelled) setWakeLockActive(false);
          });
        }
      } catch {
        if (!cancelled) setWakeLockActive(false);
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
      }
      setWakeLockActive(false);
    };

    if (isTripActive) {
      void acquireWakeLock();
    } else {
      void releaseWakeLock();
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isTripActive) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void releaseWakeLock();
    };
  }, [isTripActive]);

  // Sync bus live state key
  const storageKey = `nst_live_bus_${school?.id || "default"}_${selectedBus.id}`;

  // Sync native Android Background Bus GPS location broadcasts & permission changes
  useEffect(() => {
    const bridge = getNativeAndroidBridge();
    try {
      if (bridge?.isBusGpsServiceRunning?.()) {
        setNativeBgGpsActive(true);
        setIsTripActive(true);
      }
    } catch {}

    const onNativeLoc = (ev: any) => {
      try {
        const data = ev?.detail;
        if (!data || !Number.isFinite(Number(data.latitude)) || !Number.isFinite(Number(data.longitude))) return;
        const rawLat = Number(data.latitude);
        const rawLng = Number(data.longitude);
        const rawKmh = Number.isFinite(Number(data.speed)) ? Math.round(Number(data.speed)) : null;
        const rawAcc = Number.isFinite(Number(data.accuracy)) ? Math.round(Number(data.accuracy)) : 12;
        const rawHeading = Number.isFinite(Number(data.heading)) ? Number(data.heading) : null;

        const filtered = gpsFilterRef.current.evaluate({
          lat: rawLat,
          lng: rawLng,
          accuracy: rawAcc,
          speedKmhOverride: rawKmh,
          headingDeg: rawHeading,
          isCoarse: rawAcc > 65,
        });
        if (!filtered.accepted) return;

        setCoords({ lat: filtered.lat, lng: filtered.lng });
        coordsRef.current = { lat: filtered.lat, lng: filtered.lng };
        setCurrentSpeed(filtered.speedKmh);
        setCurrentHeading(filtered.heading);
        currentHeadingRef.current = filtered.heading;
        setGpsAccuracy(filtered.accuracy);
        setGpsError(null);
        setNativeBgGpsActive(true);
        setGpsState(filtered.accuracy > 65 ? "network_fallback" : "active");

        if (filtered.stepKm > 0) {
          setDistanceKm((prev) => Number((prev + filtered.stepKm).toFixed(2)));
        }
        lastCoordsRef.current = { lat: filtered.lat, lng: filtered.lng, time: Date.now() };
      } catch {}
    };

    const onNativePerm = (ev: any) => {
      const granted = Boolean(ev?.detail?.granted);
      if (granted) {
        try {
          setNativeBgGpsActive(Boolean(getNativeAndroidBridge()?.isBusGpsServiceRunning?.()));
        } catch {}
        toast.success("Location permission allow ho gayi — background GPS active!");
      }
    };

    window.addEventListener("android-bus-gps-location", onNativeLoc);
    window.addEventListener("android-location-permission", onNativePerm);
    return () => {
      window.removeEventListener("android-bus-gps-location", onNativeLoc);
      window.removeEventListener("android-location-permission", onNativePerm);
    };
  }, []);

  // Keep Firebase Auth token fresh in Android Background Service during long trips
  useEffect(() => {
    if (!isTripActive) return;
    const bridge = getNativeAndroidBridge();
    if (!bridge?.updateNativeBusGpsAuthToken) return;

    const pushFreshToken = async () => {
      try {
        await ensureFirebaseAuthSession();
        const tok = await auth?.currentUser?.getIdToken?.();
        if (tok) bridge.updateNativeBusGpsAuthToken(tok);
      } catch {}
    };
    void pushFreshToken();
    const timer = setInterval(() => {
      void pushFreshToken();
    }, 25 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isTripActive]);

  // Trip duration timer & active-trip wake-up (saved trip restore moved into GPS tracking section below)

  // Trip duration timer
  useEffect(() => {
    if (isTripActive) {
      tripIntervalRef.current = setInterval(() => {
        setTripDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (tripIntervalRef.current) clearInterval(tripIntervalRef.current);
    }
    return () => {
      if (tripIntervalRef.current) clearInterval(tripIntervalRef.current);
    };
  }, [isTripActive]);

  const lastRtdbWriteRef = useRef<{ time: number; lat: number; lng: number }>({ time: 0, lat: 0, lng: 0 });

  // Broadcast location updates to Realtime Database & LocalStorage (never fakes 28.4595/77.0266)
  const broadcastLocation = (update: Partial<BusLiveLocation> & { gpsFixed?: boolean }) => {
    const hasExplicitCoords = isValidCoordPair(update.latitude, update.longitude);
    const activeCoords = coordsRef.current || coords;
    const resolvedLat = hasExplicitCoords
      ? Number(update.latitude)
      : activeCoords
        ? activeCoords.lat
        : 0;
    const resolvedLng = hasExplicitCoords
      ? Number(update.longitude)
      : activeCoords
        ? activeCoords.lng
        : 0;
    const hasRealCoords = isValidCoordPair(resolvedLat, resolvedLng);

    const effectiveTripStatus = update.tripStatus ?? (isTripActiveRef.current ? "started" : "idle");
    const resolvedShareUrl = String(update.liveShareUrl ?? savedLiveShareUrl ?? "").trim();
    const payload: BusLiveLocation & { gpsFixed?: boolean } = {
      busId: selectedBus.id,
      busNumber: selectedBus.busNumber,
      route: selectedBus.route,
      driverName: selectedBus.driverName,
      driverPhone: selectedBus.driverPhone,
      latitude: resolvedLat,
      longitude: resolvedLng,
      speed: update.speed ?? currentSpeed,
      heading: update.heading ?? currentHeadingRef.current ?? 0,
      accuracy: update.accuracy ?? gpsAccuracy ?? (hasRealCoords ? 15 : 0),
      tripStatus: effectiveTripStatus,
      tripType: tripType,
      lastUpdated: new Date().toISOString(),
      currentStop: update.currentStop || (completedStops[completedStops.length - 1] || "Starting Depot"),
      totalStops: selectedBus.stops.length,
      completedStops: update.completedStops ?? completedStops,
      liveShareUrl: resolvedShareUrl || undefined,
      liveShareActive:
        update.liveShareActive !== undefined
          ? update.liveShareActive
          : effectiveTripStatus === "started" && Boolean(resolvedShareUrl),
      gpsFixed: hasRealCoords,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      localStorage.setItem(`nst_last_active_bus_${school?.id || "default"}`, selectedBus.id);
      window.dispatchEvent(new CustomEvent("nst_bus_location_update", { detail: payload }));

      // Sync to RTDB with 10s throttle (immediate on trip start/end or stop completion)
      if (school?.id) {
        const nowMs = Date.now();
        const prevRtdb = lastRtdbWriteRef.current;
        const elapsedMs = nowMs - prevRtdb.time;
        const movedMeters =
          prevRtdb.time > 0 && hasRealCoords && isValidCoordPair(prevRtdb.lat, prevRtdb.lng)
            ? haversineMeters(prevRtdb.lat, prevRtdb.lng, payload.latitude, payload.longitude)
            : 9999;
        const isCriticalStateChange =
          update.tripStatus === "started" ||
          update.tripStatus === "ended" ||
          Array.isArray(update.completedStops) ||
          (hasRealCoords && !isValidCoordPair(prevRtdb.lat, prevRtdb.lng));

        if (isCriticalStateChange || elapsedMs >= 10_000 || (elapsedMs >= 4_000 && movedMeters >= 120)) {
          lastRtdbWriteRef.current = { time: nowMs, lat: payload.latitude, lng: payload.longitude };
          const rtdbPayload = {
            ...payload,
            lat: payload.latitude,
            lng: payload.longitude,
          };
          // High-frequency live bus GPS syncs exclusively via Firebase RTDB (avoiding Supabase kv_documents egress)
          if (rtdb) {
            set(dbRef(rtdb, `school_bus_locations/${school.id}/${selectedBus.id}`), rtdbPayload).catch(() => {});
            set(dbRef(rtdb, `schools/${school.id}/bus_live_locations/${selectedBus.id}`), rtdbPayload).catch(() => {});
          }
        }
      }

      // Automatic 1 KM & Gate Arrival Lock-Screen Push Notification to Parents/Students
      if (
        payload.tripStatus === "started" &&
        school?.id &&
        Number.isFinite(payload.latitude) &&
        Number.isFinite(payload.longitude) &&
        (Math.abs(payload.latitude) > 0.001 || Math.abs(payload.longitude) > 0.001) &&
        studentHomePins.length > 0
      ) {
        const nowMs = Date.now();
        const cooldownMs = 15 * 60 * 1000;
        const busNumLow = (selectedBus.busNumber || "").toLowerCase();
        const busRouteLow = (selectedBus.route || "").toLowerCase();
        let triggeredNames: string[] = [];

        studentHomePins.forEach((pin) => {
          if (!pin?.studentId || !Number.isFinite(pin.homeLat) || !Number.isFinite(pin.homeLng)) return;
          // If pin specifies a bus/route that clearly names a different bus number, skip only when other bus specified
          const pinRouteLow = (pin.busRoute || "").trim().toLowerCase();
          if (
            pinRouteLow &&
            fleetBuses.length > 1 &&
            !busNumLow.includes(pinRouteLow) &&
            !pinRouteLow.includes(busNumLow) &&
            !busRouteLow.includes(pinRouteLow) &&
            !pinRouteLow.includes(busRouteLow)
          ) {
            return;
          }

          const distM = haversineMeters(payload.latitude, payload.longitude, pin.homeLat, pin.homeLng);
          if (distM > 1000) return;

          const stage = distM <= 200 ? "gate" : "under_1km";
          const alertKey = `${selectedBus.id}__${pin.studentId}__${stage}`;
          const lastSent = notifiedProximityRef.current.get(alertKey) || 0;
          if (nowMs - lastSent < cooldownMs) return;

          notifiedProximityRef.current.set(alertKey, nowMs);
          if (stage === "gate") {
            // Also suppress subsequent 1km alert on same trip once gate alert fires
            notifiedProximityRef.current.set(`${selectedBus.id}__${pin.studentId}__under_1km`, nowMs);
          }

          triggeredNames.push(pin.studentName || "Student");
          const distLabel = formatDistanceShort(distM);
          const title =
            stage === "gate"
              ? `🏠 ${selectedBus.busNumber} आपके घर/स्टॉप पर पहुँच गई है!`
              : `🚌 स्कूल बस 1 KM के अंदर आ गई (${distLabel})!`;
          const body = `${selectedBus.busNumber} (${selectedBus.route}) ${pin.studentName ? `${pin.studentName} के स्टॉप से ` : "आपके स्टॉप से "}सिर्फ ${distLabel} दूर है। कृपया तैयार रहें।`;

          void sendSchoolPushNotification({
            schoolId: school.id,
            studentIds: [pin.studentId],
            senderId: `bus_driver_${selectedBus.id}`,
            senderName: selectedBus.busNumber,
            title,
            body,
            type: "DEFAULT",
            url: "/?schoolPortal=1",
            urgent: true,
          });
        });

        if (triggeredNames.length > 0) {
          toast.info(`🔔 ${triggeredNames.slice(0, 2).join(", ")}${triggeredNames.length > 2 ? ` +${triggeredNames.length - 2}` : ""} को 1 KM बस अलर्ट भेजा गया!`);
        }
      }
    } catch (e) {
      console.warn("[DriverTripConsole] Broadcast error:", e);
    }
  };

  const clearBrowserGpsWatches = () => {
    if (watchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    }
    if (fallbackWatchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(fallbackWatchIdRef.current);
      } catch {}
      fallbackWatchIdRef.current = null;
    }
  };

  const applyIncomingGpsPosition = (
    pos: GeolocationPosition,
    opts?: { isCoarse?: boolean; forceBroadcast?: boolean }
  ) => {
    const { latitude, longitude, speed, accuracy, heading } = pos.coords;
    if (!isValidCoordPair(latitude, longitude)) return;

    const nowMs = Date.now();
    const filtered = gpsFilterRef.current.evaluate({
      lat: latitude,
      lng: longitude,
      accuracy,
      speedMps: speed,
      headingDeg: heading,
      isCoarse: opts?.isCoarse,
      nowMs,
    });
    if (!filtered.accepted) return;

    bestFixRef.current = {
      lat: filtered.lat,
      lng: filtered.lng,
      accuracy: filtered.accuracy,
      time: nowMs,
      isCoarse: Boolean(opts?.isCoarse) || filtered.accuracy > 65,
    };
    coordsRef.current = { lat: filtered.lat, lng: filtered.lng };
    setCoords({ lat: filtered.lat, lng: filtered.lng });
    setGpsAccuracy(filtered.accuracy);
    setGpsError(null);
    setGpsState(opts?.isCoarse || filtered.accuracy > 65 ? "network_fallback" : "active");

    if (isTripActiveRef.current && filtered.stepKm > 0) {
      setDistanceKm((prev) => Number((prev + filtered.stepKm).toFixed(2)));
    }

    lastCoordsRef.current = { lat: filtered.lat, lng: filtered.lng, time: nowMs };
    setCurrentSpeed(filtered.speedKmh);
    setCurrentHeading(filtered.heading);
    currentHeadingRef.current = filtered.heading;

    if (opts?.forceBroadcast || isTripActiveRef.current) {
      broadcastLocation({
        latitude: filtered.lat,
        longitude: filtered.lng,
        speed: filtered.speedKmh,
        heading: filtered.heading,
        accuracy: filtered.accuracy,
        tripStatus: "started",
      });
    }
  };

  const describeGeoPermissionError = (err: GeolocationPositionError | any): string => {
    const rawMsg = String(err?.message || "");
    if (err?.code === 1 || /denied|permissions policy/i.test(rawMsg)) {
      if (isEmbeddedIframe || /permissions policy/i.test(rawMsg)) {
        return "Preview frame ne GPS block kiya hai. Chrome me 'Open Fullscreen' dabayein ya browser location allow karein.";
      }
      return "Location permission band hai. Chrome address bar me lock icon par click karke Location Allow karein.";
    }
    if (err?.code === 2) {
      return "Phone GPS / Network location unavailable hai. Mobile Location (GPS) ON karein.";
    }
    if (err?.code === 3) {
      return "GPS signal weak hone se timeout hua — Network location se retry kiya ja raha hai.";
    }
    return rawMsg || "GPS Signal Weak — Refresh Location dabayein.";
  };

  // One-shot fast coarse + high-accuracy dual lookup (resolves in ~1-2s on mobile Chrome)
  const requestQuickLocationFix = (opts?: { activateTrip?: boolean; showToast?: boolean }) => {
    if (!navigator.geolocation) {
      setGpsState("error");
      setGpsError("Is browser me GPS geolocation supported nahi hai.");
      if (opts?.showToast) toast.error("Device me GPS available nahi hai.");
      return;
    }

    if (!coordsRef.current) {
      setGpsState("searching");
    }

    let gotFix = false;
    let toastShown = false;
    let failureCount = 0;

    const onSuccess = (pos: GeolocationPosition, isCoarse: boolean) => {
      gotFix = true;
      if (opts?.activateTrip) {
        isTripActiveRef.current = true;
        setIsTripActive(true);
      }
      applyIncomingGpsPosition(pos, {
        isCoarse,
        forceBroadcast: Boolean(opts?.activateTrip || isTripActiveRef.current),
      });
      if (opts?.showToast && !toastShown) {
        toastShown = true;
        toast.success(
          `Live GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}) update ho gaya!`
        );
      }
    };

    const onFailure = (err: GeolocationPositionError) => {
      failureCount += 1;
      const isDenied = err?.code === 1 || /denied|permissions policy/i.test(err?.message || "");
      if (isDenied) {
        setGpsState("denied");
        const msg = describeGeoPermissionError(err);
        setGpsError(msg);
        if (opts?.showToast && !toastShown) {
          toastShown = true;
          toast.error(msg);
        }
        return;
      }
      if (!gotFix && failureCount >= 2 && !coordsRef.current) {
        setGpsState("error");
        const msg = describeGeoPermissionError(err);
        setGpsError(msg);
        if (opts?.showToast && !toastShown) {
          toastShown = true;
          toast.error(msg);
        }
      }
    };

    try {
      // 1) Fast Wi-Fi/Cell-Tower fix so user immediately sees their real city/road
      navigator.geolocation.getCurrentPosition(
        (pos) => onSuccess(pos, true),
        onFailure,
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
      );
      // 2) Precision GPS satellite fix in parallel
      navigator.geolocation.getCurrentPosition(
        (pos) => onSuccess(pos, false),
        onFailure,
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
      );
    } catch {}
  };

  // Continuous GPS watch with automatic low-accuracy network fallback on timeout
  const startBrowserGpsWatch = (opts?: { skipQuickFix?: boolean }) => {
    if (!navigator.geolocation) return;
    clearBrowserGpsWatches();
    if (!coordsRef.current) {
      setGpsState("searching");
    }

    if (!opts?.skipQuickFix) {
      requestQuickLocationFix({ activateTrip: false, showToast: false });
    }

    const startNetworkFallbackWatch = () => {
      if (fallbackWatchIdRef.current !== null || !navigator.geolocation) return;
      try {
        fallbackWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => applyIncomingGpsPosition(pos, { isCoarse: true, forceBroadcast: true }),
          (err) => {
            if (err?.code === 1) {
              setGpsState("denied");
              setGpsError(describeGeoPermissionError(err));
            }
          },
          { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 }
        );
      } catch {}
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => applyIncomingGpsPosition(pos, { isCoarse: false, forceBroadcast: true }),
        (err) => {
          console.warn("[DriverTripConsole] GPS Watch warning:", err);
          if (getNativeAndroidBridge()?.isBusGpsServiceRunning?.()) return;
          if (err?.code === 1) {
            setGpsState("denied");
            setGpsError(describeGeoPermissionError(err));
          } else {
            // Timeout or signal unavailable -> activate continuous network/cell fallback instead of stalling
            startNetworkFallbackWatch();
            if (!coordsRef.current) {
              setGpsError(describeGeoPermissionError(err));
            }
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2_000,
          timeout: 15_000,
        }
      );
    } catch {}
  };

  // Pre-warm driver's real location on mount + cleanup watches on unmount
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (!coordsRef.current) {
      requestQuickLocationFix({ activateTrip: false, showToast: false });
    }
    return () => {
      clearBrowserGpsWatches();
    };
  }, []);

  // Restore saved active trip and ALWAYS resume live GPS watch after page reload
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tripStatus === "started") {
          setIsTripActive(true);
          isTripActiveRef.current = true;
          setTripType(parsed.tripType || "morning_pickup");
          const savedLat = Number(parsed.latitude);
          const savedLng = Number(parsed.longitude);
          const isPoisonedOldDefault =
            isSyntheticGurgaonDefault(savedLat, savedLng) && parsed.gpsFixed !== true;
          if (isValidCoordPair(savedLat, savedLng) && !isPoisonedOldDefault) {
            coordsRef.current = { lat: savedLat, lng: savedLng };
            setCoords({ lat: savedLat, lng: savedLng });
          } else {
            coordsRef.current = null;
            setCoords(null);
          }
          if (parsed.completedStops) {
            setCompletedStops(parsed.completedStops);
          }
          if (!getNativeAndroidBridge()?.isBusGpsServiceRunning?.()) {
            startBrowserGpsWatch();
          }
        }
      }
    } catch {}
  }, [storageKey]);

  // Start Trip Handler
  const handleStartTrip = async () => {
    const bridge = getNativeAndroidBridge();
    if (!navigator.geolocation && !bridge?.startNativeBusGps) {
      setGpsState("error");
      setGpsError("GPS is not supported on this device.");
      toast.error("आपके मोबाइल में GPS उपलब्ध नहीं है।");
      return;
    }

    setGpsError(null);
    setIsTripActive(true);
    isTripActiveRef.current = true;
    setTripDuration(0);
    setDistanceKm(0);
    setCompletedStops([]);
    completedStopsRef.current = [];
    autoCompletedStopsRef.current.clear();
    notifiedProximityRef.current.clear();
    setVisitedStudentIds([]);
    driverVoiceNotifiedRef.current.clear();

    speakNotification("यात्रा शुरू", `${selectedBus.busNumber} की लाइव लोकेशन और ऑटो स्टॉप डिटेक्शन शुरू हो चुकी है।`);

    // Start Native Android Background Foreground GPS Service if running inside APK
    if (bridge?.startNativeBusGps) {
      try {
        let authToken = "";
        try {
          await ensureFirebaseAuthSession();
          authToken = (await auth?.currentUser?.getIdToken?.()) || "";
        } catch {}

        const startedNative = bridge.startNativeBusGps(
          JSON.stringify({
            schoolId: school?.id || "",
            busId: selectedBus.id,
            busNumber: selectedBus.busNumber,
            route: selectedBus.route,
            driverName: selectedBus.driverName,
            driverPhone: selectedBus.driverPhone,
            tripType,
            totalStops: selectedBus.stops.length,
            currentStop: "Starting Depot",
            completedStops: [],
            authToken,
          })
        );
        setNativeBgGpsActive(Boolean(startedNative));
      } catch (nativeErr) {
        console.warn("[DriverTripConsole] Native GPS start warning:", nativeErr);
      }
    }

    // Start Browser continuous GPS + fast network fallback
    if (navigator.geolocation) {
      startBrowserGpsWatch();
    }

    // Initial trip-started broadcast (uses real coords if pre-warmed, and activates saved Google Maps share link)
    broadcastLocation({
      tripStatus: "started",
      liveShareUrl: savedLiveShareUrl || undefined,
      liveShareActive: Boolean(savedLiveShareUrl),
    });
    if (savedLiveShareUrl) {
      toast.success("🔴 Saved Google Maps Live Link bhi ab Parents & Admin ke liye active ho gaya!");
    }
  };

  // End Trip Handler
  const handleEndTrip = () => {
    clearBrowserGpsWatches();
    try {
      getNativeAndroidBridge()?.stopNativeBusGps?.();
    } catch {}
    setNativeBgGpsActive(false);
    setIsTripActive(false);
    isTripActiveRef.current = false;
    setCurrentSpeed(0);

    speakNotification("यात्रा समाप्त", `${selectedBus.busNumber} की यात्रा सफलतापूर्वक समाप्त हो गई है।`);

    broadcastLocation({
      tripStatus: "ended",
      speed: 0,
      liveShareActive: false,
    });
  };

  // Mark stop completed (and auto-capture stop GPS pin if not yet mapped!)
  const toggleStop = (stopName: string) => {
    const isNowDone = !completedStops.includes(stopName);
    const next = isNowDone
      ? [...completedStops, stopName]
      : completedStops.filter((s) => s !== stopName);
    setCompletedStops(next);
    try {
      getNativeAndroidBridge()?.updateNativeBusGpsStops?.(stopName, JSON.stringify(next));
    } catch {}
    broadcastLocation({ completedStops: next, currentStop: stopName });
    if (isNowDone && coords && school?.id) {
      const routeObj = getLocalRoutes(school.id).find(
        (r) => r.busId === selectedBus.id || r.busNumber === selectedBus.busNumber
      );
      const stopObj = routeObj?.stops?.find(
        (s) => s.stopName.trim().toLowerCase() === stopName.trim().toLowerCase()
      );
      if (stopObj && (!Number.isFinite(Number(stopObj.lat)) || !Number.isFinite(Number(stopObj.lng)))) {
        void updateRouteStopCoordinate(school.id, selectedBus.id, stopName, coords.lat, coords.lng);
      }
    }
    speakNotification("स्टॉप पार हुआ", `${stopName} चेकपॉइंट दर्ज किया गया।`);
  };

  // Unified Route Checkpoints: merges Route Stops + Student Stop Locations so adding students builds stops automatically
  const resolvedCheckpoints = React.useMemo(() => {
    const sid = school?.id || "";
    const routeObj = getLocalRoutes(sid).find(
      (r) => r.busId === selectedBus.id || r.busNumber === selectedBus.busNumber
    );
    const busNumLow = (selectedBus.busNumber || "").toLowerCase();
    const busRouteLow = (selectedBus.route || "").toLowerCase();

    const busStudentPins = studentHomePins.filter((p) => {
      const pRoute = (p.busRoute || "").trim().toLowerCase();
      const pBusNum = (p.busNumber || "").trim().toLowerCase();
      if (!pRoute && !pBusNum) return true;
      if (fleetBuses.length <= 1) return true;
      if (pBusNum && busNumLow && (busNumLow.includes(pBusNum) || pBusNum.includes(busNumLow))) {
        return true;
      }
      if (
        pRoute &&
        (busRouteLow.includes(pRoute) ||
          pRoute.includes(busRouteLow) ||
          busNumLow.includes(pRoute) ||
          pRoute.includes(busNumLow))
      ) {
        return true;
      }
      return false;
    });

    interface ResolvedCp {
      stopName: string;
      lat: number | null;
      lng: number | null;
      pickupTime?: string;
      dropTime?: string;
      studentNames: string[];
      distanceMeters: number | null;
      source: "route" | "student" | "unpinned";
    }

    const list: ResolvedCp[] = [];
    const seenStopLow = new Set<string>();

    selectedBus.stops.forEach((rawName) => {
      const stopName = String(rawName || "").trim();
      if (!stopName) return;
      const stopLow = stopName.toLowerCase();
      seenStopLow.add(stopLow);

      const rStop = routeObj?.stops?.find(
        (s) => s.stopName.trim().toLowerCase() === stopLow
      );
      const matchingPins = busStudentPins.filter(
        (p) => (p.busStop || "").trim().toLowerCase() === stopLow
      );
      const hasRouteCoords =
        rStop && isValidCoordPair(rStop.lat, rStop.lng);
      const lat = hasRouteCoords
        ? Number(rStop.lat)
        : matchingPins[0]
          ? Number(matchingPins[0].homeLat)
          : null;
      const lng = hasRouteCoords
        ? Number(rStop.lng)
        : matchingPins[0]
          ? Number(matchingPins[0].homeLng)
          : null;

      const distM =
        coords && isValidCoordPair(lat, lng)
          ? haversineMeters(coords.lat, coords.lng, Number(lat), Number(lng))
          : null;

      list.push({
        stopName,
        lat,
        lng,
        pickupTime: rStop?.pickupTime,
        dropTime: rStop?.dropTime,
        studentNames: matchingPins.map((p) => p.studentName),
        distanceMeters: distM,
        source: hasRouteCoords ? "route" : matchingPins[0] ? "student" : "unpinned",
      });
    });

    // Also include Student Locations that weren't in selectedBus.stops yet (grouped by busStop or student stop)
    const extraGroups = new Map<string, { stopName: string; pins: StudentHomePin[] }>();
    busStudentPins.forEach((p) => {
      const label = (p.busStop || "").trim() || `${p.studentName} Stop`;
      const key = label.toLowerCase();
      if (seenStopLow.has(key)) return;
      const existing = extraGroups.get(key);
      if (existing) {
        existing.pins.push(p);
      } else {
        extraGroups.set(key, { stopName: label, pins: [p] });
      }
    });

    extraGroups.forEach((grp) => {
      const first = grp.pins[0];
      const lat = Number(first.homeLat);
      const lng = Number(first.homeLng);
      const distM =
        coords && isValidCoordPair(lat, lng)
          ? haversineMeters(coords.lat, coords.lng, lat, lng)
          : null;
      const insertIdx = list.findIndex((c) =>
        /school|campus|gate|विद्यालय/i.test(c.stopName)
      );
      const item: ResolvedCp = {
        stopName: grp.stopName,
        lat,
        lng,
        studentNames: grp.pins.map((p) => p.studentName),
        distanceMeters: distM,
        source: "student",
      };
      if (insertIdx >= 0) {
        list.splice(insertIdx, 0, item);
      } else {
        list.push(item);
      }
    });

    return list;
  }, [
    school?.id,
    selectedBus.id,
    selectedBus.busNumber,
    selectedBus.route,
    selectedBus.stops,
    studentHomePins,
    fleetBuses.length,
    coords,
    routesVersion,
  ]);

  // AUTOMATIC STOP PASSING ENGINE: Detects when live bus GPS enters 160m of any Stop / Student Stop Pin
  useEffect(() => {
    if (!isTripActive || !coords) return;
    const STOP_ARRIVAL_RADIUS_M = 160;
    const currentSet = new Set(
      completedStopsRef.current.map((s) => s.trim().toLowerCase())
    );

    const newlyPassed = resolvedCheckpoints.filter((cp) => {
      const key = cp.stopName.trim().toLowerCase();
      if (currentSet.has(key) || autoCompletedStopsRef.current.has(key)) return false;
      if (!isValidCoordPair(cp.lat, cp.lng) || cp.distanceMeters === null) return false;
      return cp.distanceMeters <= STOP_ARRIVAL_RADIUS_M;
    });

    if (newlyPassed.length === 0) return;

    const nextStops = [...completedStopsRef.current];
    newlyPassed.forEach((cp) => {
      autoCompletedStopsRef.current.add(cp.stopName.trim().toLowerCase());
      if (!nextStops.includes(cp.stopName)) {
        nextStops.push(cp.stopName);
      }
    });

    const latestStop = newlyPassed[newlyPassed.length - 1].stopName;
    completedStopsRef.current = nextStops;
    setCompletedStops(nextStops);

    try {
      getNativeAndroidBridge()?.updateNativeBusGpsStops?.(
        latestStop,
        JSON.stringify(nextStops)
      );
    } catch {}

    broadcastLocation({
      completedStops: nextStops,
      currentStop: latestStop,
      totalStops: Math.max(selectedBus.stops.length, resolvedCheckpoints.length),
    });

    speakNotification(
      "स्टॉप पार हुआ",
      `${latestStop} पर बस पहुँच गई है — स्टॉप ऑटो अपडेट हो गया।`
    );
    toast.success(`🚌 Auto Stop Passed: ${latestStop}`);
  }, [isTripActive, coords?.lat, coords?.lng, resolvedCheckpoints]);

  // Build route overlay & nearest home overlays for Driver's Live Map
  const driverRouteOverlay = React.useMemo<MapRouteOverlay[]>(() => {
    const sid = school?.id || "";
    const routeObj = getLocalRoutes(sid).find(
      (r) => r.busId === selectedBus.id || r.busNumber === selectedBus.busNumber
    );
    const completedSet = new Set(completedStops.map((s) => s.trim().toLowerCase()));
    const stopsWithCoords = resolvedCheckpoints
      .filter((s) => isValidCoordPair(s.lat, s.lng))
      .map((s, idx) => ({
        id: `cp_${idx}_${s.stopName}`,
        stopName: s.stopName,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        lat: Number(s.lat),
        lng: Number(s.lng),
        completed: completedSet.has(s.stopName.trim().toLowerCase()),
      }));
    if (stopsWithCoords.length === 0) return [];
    return [
      {
        busId: selectedBus.id,
        busNumber: selectedBus.busNumber,
        routeName: selectedBus.route,
        color: routeObj?.routeColor || "#10b981",
        stops: stopsWithCoords,
      },
    ];
  }, [school?.id, selectedBus.id, selectedBus.busNumber, selectedBus.route, completedStops, resolvedCheckpoints]);

  const driverHomePinOverlays = React.useMemo<MapHomePinOverlay[]>(() => {
    return nearestHomes.map((h) => ({
      id: h.studentId,
      label: h.busStop ? `${h.studentName.split(" ")[0]} (${h.busStop})` : h.studentName.split(" ")[0],
      sublabel: h.studentName,
      lat: h.homeLat,
      lng: h.homeLng,
      distanceText: formatDistanceShort(h.distanceMeters),
    }));
  }, [nearestHomes]);

  // Format time (HH:MM:SS)
  const formatTripTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  // SVG 240-degree speedometer arc calculations (radius 86, circumference ~540.35, 240deg sweep = 360.23)
  const speedRatio = Math.min(1, Math.max(0, currentSpeed / 100));
  const totalCheckpoints = resolvedCheckpoints.length || selectedBus.stops.length;
  const nextPendingStop =
    resolvedCheckpoints.find((cp) => !completedStops.includes(cp.stopName)) || null;
  const gpsStatusLabel =
    gpsState === "denied"
      ? "Blocked"
      : gpsAccuracy !== null
        ? `±${gpsAccuracy}m`
        : gpsState === "searching"
          ? "Locating..."
          : "Standby";

  const rawPrincipalPhone = String(school?.principalPhone || "").trim();
  const principalHelpline =
    rawPrincipalPhone && (isDemo || rawPrincipalPhone !== "9811023450")
      ? rawPrincipalPhone
      : "";

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 flex flex-col select-none pb-10">
      {/* Compact Single-Row Cockpit Top Bar (56px, zero wrapping, zero overflow) */}
      <header className="sticky top-0 z-30 h-14 bg-[#070B12]/92 backdrop-blur-xl border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
            <Bus size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap truncate">
              Driver Console
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isTripActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold whitespace-nowrap">
              <Radio size={12} className="text-emerald-400 shrink-0" />
              <span>LIVE</span>
            </span>
          )}
          <LanguageToggleButton tone="black" compact />
          <ScreenInfoGuideButton portal="driver" screenKey="driver_console" tone="black" />
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={14} className="shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Cockpit Container */}
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* Clean Unboxed Fleet Context Strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-semibold text-slate-200 truncate">
              {school?.name || "School Bus Fleet"}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="truncate">{selectedBus.driverName}</span>
            {standaloneMode && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-emerald-400 font-medium">Driver Portal</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums shrink-0">
            <span className={isTripActive ? "text-emerald-400 font-semibold" : "text-slate-400"}>
              {isTripActive ? "Broadcasting Live" : "Standby in Depot"}
            </span>
          </div>
        </div>

        {/* Prominent Next Student Stop Highlight Card (Visible without scrolling during trip!) */}
        {studentHomePins.length > 0 && (
          <section
            className={`rounded-3xl p-4 border transition-all ${
              nextUpcomingStudent
                ? isTripActive
                  ? "bg-gradient-to-r from-emerald-950/90 via-[#0E1826] to-amber-950/50 border-emerald-400/40 shadow-lg"
                  : "bg-[#0E1420] border-white/[0.1]"
                : "bg-[#0E1420] border-emerald-500/30"
            }`}
          >
            {nextUpcomingStudent ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-amber-300 flex items-center justify-center shrink-0">
                    <Home size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        अगला स्टॉप (NEXT STUDENT)
                      </span>
                      {nextUpcomingStudent.distanceMeters >= 0 && (
                        <span className="text-xs font-mono font-bold text-emerald-300">
                          {formatDistanceShort(nextUpcomingStudent.distanceMeters)} दूर
                        </span>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-white truncate mt-1">
                      {nextUpcomingStudent.studentName}
                      {nextUpcomingStudent.className ? (
                        <span className="text-xs font-semibold text-slate-300 ml-1.5">
                          ({nextUpcomingStudent.className})
                        </span>
                      ) : null}
                    </h2>
                    <p className="text-xs text-slate-300 truncate">
                      {nextUpcomingStudent.busStop
                        ? `📍 स्टॉप: ${nextUpcomingStudent.busStop}`
                        : "📍 Student Home Pin Saved"}{" "}
                      · {nextUpcomingStudent.distanceMeters >= 0 ? nextUpcomingStudent.status.label : "GPS लॉक होते ही दूरी दिखेगी"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      safeOpenExternalUrl(
                        `https://www.google.com/maps/dir/?api=1&destination=${nextUpcomingStudent.homeLat},${nextUpcomingStudent.homeLng}`
                      )
                    }
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Navigation size={14} />
                    <span>Navigate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVisitedStudentIds((prev) =>
                        prev.includes(nextUpcomingStudent.studentId)
                          ? prev
                          : [...prev, nextUpcomingStudent.studentId]
                      );
                      toast.success(`✓ ${nextUpcomingStudent.studentName} Done — अगला स्टॉप अपडेट हुआ`);
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <CheckCircle2 size={14} />
                    <span>Picked / Done</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} /> सभी {busFilteredPins.length || studentHomePins.length} छात्रों के स्टॉप पूरे हो चुके हैं!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setVisitedStudentIds([]);
                    driverVoiceNotifiedRef.current.clear();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                >
                  Reset List
                </button>
              </div>
            )}
          </section>
        )}

        {/* 12-Column Responsive Cockpit Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* LEFT COLUMN: Telemetry HUD, Primary Action, Bus & Shift Selection */}
          <div className="lg:col-span-5 space-y-4">
            {/* Precision Speedometer & Telemetry Card */}
            <section className="bg-[#0E1420] border border-white/[0.08] rounded-3xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="px-5 pt-4 flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                  <Gauge size={14} className="text-amber-400" />
                  <span>Speedometer</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-200 font-semibold">
                  <Clock size={13} className="text-sky-400" />
                  <span>{formatTripTime(tripDuration)}</span>
                </span>
              </div>

              {/* 240-Degree Automotive Arc Speedometer */}
              <div className="relative flex flex-col items-center justify-center pt-3 pb-4 px-4">
                <svg
                  viewBox="0 0 220 175"
                  className="w-56 h-44 overflow-visible"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="driverSpeedArc" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={isTripActive ? "#10B981" : "#F59E0B"} />
                      <stop offset="100%" stopColor={currentSpeed > 60 ? "#EF4444" : "#38BDF8"} />
                    </linearGradient>
                  </defs>
                  {/* Background 240-deg track (radius 82 -> circumference = 515.22, 240deg = 343.48) */}
                  <circle
                    cx="110"
                    cy="110"
                    r="82"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="343.48 515.22"
                    transform="rotate(150 110 110)"
                  />
                  {/* Active speed fill */}
                  <circle
                    cx="110"
                    cy="110"
                    r="82"
                    fill="none"
                    stroke="url(#driverSpeedArc)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(4, speedRatio * 343.48)} 515.22`}
                    transform="rotate(150 110 110)"
                    className="transition-all duration-300 ease-out"
                  />
                  {/* Inner subtle calibration ring */}
                  <circle
                    cx="110"
                    cy="110"
                    r="66"
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                    strokeDasharray="2 8"
                  />
                </svg>

                {/* Centered Digital Speed Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-4 pointer-events-none">
                  <span className="text-6xl font-bold font-mono tabular-nums tracking-tight text-white leading-none">
                    {currentSpeed}
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.2em] text-amber-400 mt-1.5">
                    KM / H
                  </span>
                  <span className="text-[11px] text-slate-400 mt-2 max-w-[170px] truncate">
                    {nextPendingStop ? `Next: ${nextPendingStop.stopName}` : "All stops completed"}
                  </span>
                </div>
              </div>

              {/* Single-Level Hairline Telemetry Strip (Zero nested bordered boxes) */}
              <div className="border-t border-white/[0.07] grid grid-cols-3 divide-x divide-white/[0.07] bg-[#0B101A]">
                <div className="py-3.5 px-2 text-center">
                  <span className="text-[11px] text-slate-400 block">Trip Distance</span>
                  <span className="text-sm font-bold text-white font-mono tabular-nums mt-0.5 block">
                    {distanceKm} km
                  </span>
                </div>
                <div className="py-3.5 px-2 text-center">
                  <span className="text-[11px] text-slate-400 block">GPS Accuracy</span>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 block ${
                      gpsState === "denied"
                        ? "text-rose-400"
                        : gpsAccuracy !== null
                          ? "text-emerald-400"
                          : "text-amber-300"
                    }`}
                  >
                    {gpsStatusLabel}
                  </span>
                </div>
                <div className="py-3.5 px-2 text-center">
                  <span className="text-[11px] text-slate-400 block">Stops (Auto)</span>
                  <span className="text-sm font-bold text-sky-400 font-mono tabular-nums mt-0.5 block">
                    {completedStops.length} / {totalCheckpoints}
                  </span>
                </div>
              </div>
            </section>

            {/* Primary Start / End Trip Action CTA */}
            <div className="space-y-2.5">
              {!isTripActive ? (
                <button
                  type="button"
                  onClick={handleStartTrip}
                  className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base tracking-wide shadow-lg shadow-emerald-950/50 active:scale-[0.985] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Play size={20} fill="currentColor" />
                  <span>यात्रा शुरू करें (Start Live Trip)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEndTrip}
                  className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-base tracking-wide shadow-lg shadow-rose-950/50 active:scale-[0.985] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Square size={18} fill="currentColor" />
                  <span>यात्रा समाप्त करें (End Trip)</span>
                </button>
              )}

              {isTripActive && (
                <div
                  className={`px-3.5 py-2.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                    nativeBgGpsActive || wakeLockActive
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200"
                      : "bg-amber-950/35 border-amber-500/30 text-amber-200"
                  }`}
                >
                  {nativeBgGpsActive ? (
                    <Satellite size={16} className="text-emerald-400 shrink-0" />
                  ) : wakeLockActive ? (
                    <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Smartphone size={16} className="text-amber-400 shrink-0" />
                  )}
                  <p className="text-[11px] leading-snug">
                    {nativeBgGpsActive
                      ? "Android Background GPS सक्रिय है — स्क्रीन लॉक या कॉल पर भी लाइव लोकेशन चलती रहेगी।"
                      : wakeLockActive
                        ? "Screen Wake Lock सक्रिय है — कृपया ट्रिप के दौरान स्क्रीन लॉक न करें।"
                        : "लाइव लोकेशन चालू रखने के लिए ट्रिप के समय स्क्रीन ऑन रखें।"}
                  </p>
                </div>
              )}
            </div>

            {/* Vehicle & Shift Assignment Card */}
            <section className="bg-[#0E1420] border border-white/[0.08] rounded-3xl p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="driver-bus-selector"
                  className="text-xs font-semibold text-slate-300"
                >
                  वाहन व रूट चुनें (Bus &amp; Route)
                </label>
                {isTripActive && (
                  <span className="text-[11px] text-slate-400">Locked during trip</span>
                )}
              </div>

              {fleetBuses.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  Abhi is school me koi bus add nahi hui hai. School Admin se <strong>Bus Radar → Add Bus &amp; Driver</strong> me bus add karne ko kahein.
                </div>
              )}

              <select
                id="driver-bus-selector"
                value={selectedBusId}
                disabled={isTripActive || fleetBuses.length === 0}
                onChange={(e) => setSelectedBusId(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full min-h-[46px] bg-[#070B12] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-400/60 disabled:opacity-65 cursor-pointer"
              >
                {fleetBuses.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#0B111E] text-white">
                    {b.busNumber} — {b.driverName}
                  </option>
                ))}
              </select>

              <div className="flex items-start gap-2.5 text-xs text-slate-300 pt-1">
                <Navigation size={15} className="text-sky-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{selectedBus.route}</span>
              </div>

              {/* Clean Segmented Shift Selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#070B12] border border-white/[0.07]">
                <button
                  type="button"
                  disabled={isTripActive}
                  onClick={() => setTripType("morning_pickup")}
                  className={`min-h-[42px] py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                    tripType === "morning_pickup"
                      ? "bg-amber-500/15 border border-amber-400/35 text-amber-300"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Sun size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">सुबह पिकअप</span>
                </button>
                <button
                  type="button"
                  disabled={isTripActive}
                  onClick={() => setTripType("afternoon_drop")}
                  className={`min-h-[42px] py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                    tripType === "afternoon_drop"
                      ? "bg-sky-500/15 border border-sky-400/35 text-sky-300"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Sunset size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">दोपहर ड्रॉप</span>
                </button>
              </div>
            </section>

            {/* Principal Helpline */}
            <div className="bg-[#0E1420] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Phone size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Principal Helpline</p>
                  <p className="text-[11px] text-slate-400 truncate font-mono tabular-nums">
                    {principalHelpline
                      ? principalHelpline
                      : "School Profile से नंबर जोड़ें"}
                  </p>
                </div>
              </div>
              {principalHelpline && (
                <a
                  href={`tel:${principalHelpline}`}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white text-xs font-semibold flex items-center justify-center transition-colors shrink-0 whitespace-nowrap"
                >
                  कॉल करें
                </a>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Live Map Viewport, Student Stop Proximity, Auto Route Checkpoints */}
          <div className="lg:col-span-7 space-y-4">
            {/* Live Interactive Map Card */}
            <section className="bg-[#0E1420] border border-white/[0.08] rounded-3xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <MapIcon size={14} className="text-amber-400 shrink-0" />
                    <span>Live Route Map</span>
                  </h2>
                  {coords ? (
                    <button
                      type="button"
                      onClick={() =>
                        safeOpenExternalUrl(
                          `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
                        )
                      }
                      className="text-left text-[11px] font-mono tabular-nums text-sky-300 hover:text-sky-200 mt-0.5 flex items-center gap-1 truncate cursor-pointer"
                      title="Tap karein Google Maps par yahi location kholne ke liye"
                    >
                      <span className="truncate">
                        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} ·{" "}
                        {gpsState === "network_fallback" ? "Network GPS" : "Satellite GPS"} · ±
                        {gpsAccuracy ?? 15}m
                      </span>
                      <ExternalLink size={11} className="shrink-0 text-sky-400" />
                    </button>
                  ) : (
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5 truncate">
                      {gpsState === "denied"
                        ? "Location permission required"
                        : "Acquiring live GPS fix..."}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  {(coords || (savedLiveShareUrl && isTripActive)) && (
                    <button
                      type="button"
                      onClick={() =>
                        safeOpenExternalUrl(
                          coords
                            ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
                            : savedLiveShareUrl
                        )
                      }
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shadow-sm"
                      title="Google Maps par exact live location kholein"
                    >
                      <ExternalLink size={12} />
                      <span>Google Maps</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      requestQuickLocationFix({
                        activateTrip: isTripActive,
                        showToast: true,
                      });
                      if (isTripActive) startBrowserGpsWatch({ skipQuickFix: true });
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    title="Fetch live GPS coordinates"
                  >
                    <RefreshCw size={12} className={gpsState === "searching" ? "animate-spin" : ""} />
                    <span>लोकेशन अपडेट</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLiveMap((prev) => !prev)}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-slate-200 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {showLiveMap ? "Hide Map" : "Show Map"}
                  </button>
                </div>
              </div>

              {/* Single Consolidated Actionable GPS Notice (shown only when location isn't locked yet) */}
              {!coords && (gpsState === "denied" || gpsError) && (
                <div className="m-3 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-rose-100">
                        लाइव GPS लोकेशन अभी प्राप्त नहीं हुई
                      </p>
                      <p className="text-[11px] text-rose-200/85 leading-relaxed">
                        {gpsError ||
                          "Browser ne location permission block ki hai. GPS Allow karein ya Fullscreen tab me kholein."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        requestQuickLocationFix({ activateTrip: isTripActive, showToast: true });
                        if (isTripActive) startBrowserGpsWatch({ skipQuickFix: true });
                      }}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Navigation size={13} /> Retry GPS
                    </button>
                    {isEmbeddedIframe && (
                      <a
                        href={standaloneDriverTabUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={13} /> Open Fullscreen GPS
                      </a>
                    )}
                  </div>
                </div>
              )}

              {showLiveMap && (
                <div className="p-2.5 pt-2">
                  <LiveBusGoogleMap
                    buses={[
                      {
                        busId: selectedBus.id,
                        busNumber: selectedBus.busNumber,
                        route: selectedBus.route,
                        driverName: selectedBus.driverName,
                        driverPhone: selectedBus.driverPhone,
                        latitude: coords?.lat ?? 0,
                        longitude: coords?.lng ?? 0,
                        speed: currentSpeed,
                        heading: currentHeading,
                        accuracy: gpsAccuracy ?? 0,
                        tripStatus: isTripActive ? "started" : "idle",
                        tripType,
                        lastUpdated: new Date().toISOString(),
                        currentStop: completedStops[completedStops.length - 1] || "Depot",
                        totalStops: selectedBus.stops.length,
                        completedStops,
                        liveShareUrl: savedLiveShareUrl || undefined,
                        liveShareActive: isTripActive && Boolean(savedLiveShareUrl),
                      },
                    ]}
                    selectedBusId={selectedBus.id}
                    routes={driverRouteOverlay}
                    homePins={driverHomePinOverlays}
                    schoolPin={
                      isValidCoordPair(school?.latitude, school?.longitude)
                        ? {
                            name: school?.name || "School Campus",
                            lat: Number(school.latitude),
                            lng: Number(school.longitude),
                          }
                        : null
                    }
                    heightClass="h-[280px] sm:h-[330px]"
                    schoolId={school?.id}
                    schoolCode={school?.code}
                    googleMapsApiKey={schoolMapsApiKey || school?.googleMapsApiKey}
                    showOpenInMapsButton={true}
                  />
                </div>
              )}
            </section>

            {/* Saved Google Maps Live Link (1-Time Save — Auto Active on Start Drive, Auto Hidden on End Trip) */}
            <div className="bg-[#0E1420] border border-white/[0.08] rounded-2xl px-4 py-3 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowBackupLinkBox((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                <span className="flex items-center gap-2 font-medium min-w-0 truncate">
                  <Link2 size={14} className="text-sky-400 shrink-0" />
                  <span className="truncate">
                    Google Maps Live Link (1-Time Save / Backup)
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[11px] font-medium shrink-0">
                  {savedLiveShareUrl ? (
                    <span className={isTripActive ? "text-emerald-400" : "text-amber-300"}>
                      {isTripActive ? "Live Link Active ✓" : "Link Saved (Idle)"}
                    </span>
                  ) : (
                    <span className="text-emerald-400">Auto GPS Active</span>
                  )}
                  {showBackupLinkBox || gpsState === "denied" ? (
                    <ChevronUp size={15} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={15} className="text-slate-400" />
                  )}
                </span>
              </button>

              {(showBackupLinkBox || gpsState === "denied") && (
                <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Google Maps ka <strong>Share Location</strong> link (<code className="text-amber-300">maps.app.goo.gl/...</code> ya <code className="text-amber-300">location-sharing-fdl</code>) ya <code className="text-amber-300">lat, lng</code> yahan paste karein. Live Share link 1 baar save karne par jab bhi <strong>Start Drive</strong> dabayenge wo automatic active ho jayega aur <strong>End Trip</strong> par hide hoga.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={manualLocationText || liveShareInput}
                      onChange={(e) => {
                        setManualLocationText(e.target.value);
                        setLiveShareInput(e.target.value);
                      }}
                      placeholder="https://maps.app.goo.gl/... ya Google Maps live share link"
                      className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#070B12] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400/60"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={resolvingLocationLink || savingLiveShare}
                        onClick={async () => {
                          const rawVal = (manualLocationText || liveShareInput).trim();
                          if (!rawVal) {
                            toast.error("Google Maps share link ya 'lat, lng' daalein.");
                            return;
                          }
                          setResolvingLocationLink(true);
                          setSavingLiveShare(true);
                          try {
                            const gmapsUrl = extractGoogleMapsUrl(rawVal);
                            if (gmapsUrl && isGoogleMapsLiveShareLink(gmapsUrl)) {
                              await saveBusLiveShareUrl(school?.id || "", selectedBus.id, gmapsUrl);
                              setSavedLiveShareUrl(gmapsUrl);
                              setLiveShareInput(gmapsUrl);
                              setManualLocationText("");
                              broadcastLocation({
                                liveShareUrl: gmapsUrl,
                                liveShareActive: isTripActiveRef.current,
                                tripStatus: isTripActiveRef.current ? "started" : "idle",
                              });
                              toast.success(
                                isTripActiveRef.current
                                  ? "Google Maps Live Link save & LIVE active ho gaya!"
                                  : "Google Maps Live Link save ho gaya! Start Drive dabate hi active hoga."
                              );
                              return;
                            }

                            const parsed = await resolveGoogleMapsLocationInput(rawVal);
                            if (parsed) {
                              coordsRef.current = { lat: parsed.lat, lng: parsed.lng };
                              setCoords({ lat: parsed.lat, lng: parsed.lng });
                              setIsTripActive(true);
                              isTripActiveRef.current = true;
                              setGpsError(null);
                              broadcastLocation({
                                latitude: parsed.lat,
                                longitude: parsed.lng,
                                tripStatus: "started",
                              });
                              setManualLocationText("");
                              toast.success(
                                `Location (${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}) attach aur live broadcast ho gayi!`
                              );
                              return;
                            }

                            if (gmapsUrl) {
                              await saveBusLiveShareUrl(school?.id || "", selectedBus.id, gmapsUrl);
                              setSavedLiveShareUrl(gmapsUrl);
                              setLiveShareInput(gmapsUrl);
                              setManualLocationText("");
                              broadcastLocation({
                                liveShareUrl: gmapsUrl,
                                liveShareActive: isTripActiveRef.current,
                                tripStatus: isTripActiveRef.current ? "started" : "idle",
                              });
                              toast.success("Google Maps Link save ho gaya!");
                              return;
                            }

                            toast.error("Valid Google Maps link ya 'lat, lng' coordinates daalein.");
                          } finally {
                            setResolvingLocationLink(false);
                            setSavingLiveShare(false);
                          }
                        }}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold text-xs cursor-pointer transition-colors"
                      >
                        {resolvingLocationLink ? "Saving..." : "Save & Use Link"}
                      </button>
                      {savedLiveShareUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => safeOpenExternalUrl(savedLiveShareUrl)}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Google Maps App mein Live Link khol kar check karein"
                          >
                            <ExternalLink size={13} />
                            <span>Open G-Maps</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await saveBusLiveShareUrl(school?.id || "", selectedBus.id, "");
                              setSavedLiveShareUrl("");
                              setLiveShareInput("");
                              setManualLocationText("");
                              broadcastLocation({ liveShareUrl: "", liveShareActive: false });
                              toast.info("Saved Google Maps Link hata diya gaya.");
                            }}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 font-semibold text-xs cursor-pointer transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Automatic Route Checkpoints Timeline */}
            <section className="bg-[#0E1420] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                <h2 className="text-xs font-semibold text-white flex items-center gap-2">
                  <MapPin size={14} className="text-amber-400" />
                  <span>Route Checkpoints</span>
                </h2>
                <span className="text-[11px] text-emerald-400 font-medium">
                  Auto-GPS (160m)
                </span>
              </div>

              <div className="mt-3 relative">
                {resolvedCheckpoints.map((cp, idx) => {
                  const isDone = completedStops.includes(cp.stopName);
                  const hasGeo = isValidCoordPair(cp.lat, cp.lng);
                  const isLast = idx === resolvedCheckpoints.length - 1;
                  const isNext = !isDone && nextPendingStop?.stopName === cp.stopName;

                  return (
                    <div
                      key={`${cp.stopName}_${idx}`}
                      onClick={() => isTripActive && toggleStop(cp.stopName)}
                      title={
                        isTripActive
                          ? "Auto detect hota hai — zaroorat par tap karke bhi mark kar sakte hain"
                          : "Trip start hone par auto-detect chalu hoga"
                      }
                      className={`relative flex items-center justify-between gap-3 py-3 px-2 rounded-xl transition-colors ${
                        isTripActive
                          ? "cursor-pointer hover:bg-white/[0.04]"
                          : "cursor-default"
                      }`}
                    >
                      {/* Vertical Connecting Rail */}
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[19px] top-9 bottom-[-12px] w-px ${
                            isDone ? "bg-emerald-500/50" : "bg-white/10"
                          }`}
                        />
                      )}

                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono shrink-0 border ${
                            isDone
                              ? "bg-emerald-500 border-emerald-400 text-slate-950"
                              : isNext
                                ? "bg-amber-500/20 border-amber-400 text-amber-300"
                                : "bg-[#070B12] border-white/15 text-slate-400"
                          }`}
                        >
                          {isDone ? <CheckCircle2 size={14} /> : idx + 1}
                        </span>

                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isDone ? "text-emerald-300" : "text-white"
                            }`}
                          >
                            {cp.stopName}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                            {cp.studentNames.length > 0 ? (
                              <>
                                <Users size={11} className="text-slate-500 shrink-0" />
                                <span className="truncate">
                                  {cp.studentNames.slice(0, 2).join(", ")}
                                  {cp.studentNames.length > 2 ? ` +${cp.studentNames.length - 2}` : ""}
                                </span>
                              </>
                            ) : hasGeo ? (
                              <span>Stop GPS linked</span>
                            ) : (
                              <span className="text-amber-400/85">Location pending</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2.5">
                        {!isDone && cp.distanceMeters !== null && (
                          <span className="text-xs font-mono tabular-nums font-semibold text-amber-300">
                            {formatDistanceShort(cp.distanceMeters)}
                          </span>
                        )}
                        {isDone ? (
                          <span className="text-[11px] font-semibold text-emerald-400">
                            Passed
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500">
                            {hasGeo ? "Auto" : "Manual"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Nearest Student Homes Ahead (Clean Hairline List) */}
            {studentHomePins.length > 0 && (
              <section className="bg-[#0E1420] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                  <h2 className="text-xs font-semibold text-white flex items-center gap-2">
                    <Home size={14} className="text-emerald-400" />
                    <span>Upcoming Student Stops</span>
                  </h2>
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {studentHomePins.length} Locations
                  </span>
                </div>

                {nearestHomes.length === 0 ? (
                  <p className="text-xs text-slate-400 pt-3">
                    यात्रा शुरू होते ही बच्चों के स्टॉप की लाइव दूरी यहाँ दिखेगी।
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06] mt-1">
                    {nearestHomes.map((h) => (
                      <div
                        key={h.studentId}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">
                            {h.studentName}
                            {h.busStop && (
                              <span className="text-slate-400 font-normal"> · {h.busStop}</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {h.status.label}
                          </p>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-sm text-amber-300 shrink-0">
                          {formatDistanceShort(h.distanceMeters)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
