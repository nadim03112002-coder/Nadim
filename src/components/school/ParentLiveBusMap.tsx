// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import {
  Bus,
  Phone,
  Bell,
  BellRing,
  Home,
  Crosshair,
  ExternalLink,
  Radio,
  MapPin,
  Gauge,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { School, BusLiveLocation, SchoolStudent, SchoolBusRoute } from "../../school-types";
import { shouldUseDemoForSchool, updateStudent } from "../../school-firebase";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { rtdb } from "../../firebase";
import { ref as dbRef, onValue, set as rtdbSet } from "firebase/database";
import { sbRtdbSet, sbRtdbSubscribe } from "../../services/supabaseDbAdapter";
import { toast } from "sonner";
import {
  buildMergedFleetList,
  getLocalRoutes,
} from "../../utils/schoolTransportStore";
import {
  LiveBusGoogleMap,
  type MapRouteOverlay,
  type MapHomePinOverlay,
} from "./LiveBusGoogleMap";
import {
  type StudentHomePin,
  resolveGoogleMapsLocationInput,
  haversineMeters,
  formatDistanceShort,
  getProximityStatus,
} from "../../utils/busProximity";

interface ParentLiveBusMapProps {
  school: School;
  student: Partial<SchoolStudent>;
  onClose?: () => void;
}

const DEMO_FALLBACK_BUS: BusLiveLocation = {
  busId: "bus-01",
  busNumber: "Bus #01 (DL-1PC-4521)",
  route: "Route 1 — North Sector & Station Road",
  driverName: "Rajesh Yadav",
  driverPhone: "9811223344",
  latitude: 28.4648,
  longitude: 77.0324,
  speed: 32,
  heading: 45,
  accuracy: 6,
  tripStatus: "started",
  tripType: "morning_pickup",
  lastUpdated: new Date().toISOString(),
  currentStop: "Station Chowk",
  totalStops: 4,
  completedStops: ["Sector 14 Gate", "Station Chowk"],
};

function matchesStudentBus(
  bus: BusLiveLocation,
  student: Partial<SchoolStudent>,
  routes: SchoolBusRoute[]
): boolean {
  const stBusId = String((student as any)?.busId || "").trim().toLowerCase();
  const stBusNum = String((student as any)?.busNumber || "").trim().toLowerCase();
  const stRoute = String(student?.busRoute || "").trim().toLowerCase();
  const stStop = String((student as any)?.busStop || (student as any)?.pickupStop || "").trim().toLowerCase();

  const bId = String(bus.busId || "").trim().toLowerCase();
  const bNum = String(bus.busNumber || "").trim().toLowerCase();
  const bRoute = String(bus.route || "").trim().toLowerCase();

  if (stBusId && bId === stBusId) return true;
  if (stBusNum && (bNum === stBusNum || bNum.includes(stBusNum) || stBusNum.includes(bNum))) {
    return true;
  }

  if (stRoute) {
    if (
      bRoute === stRoute ||
      bRoute.includes(stRoute) ||
      stRoute.includes(bRoute) ||
      bNum.includes(stRoute) ||
      stRoute.includes(bNum)
    ) {
      return true;
    }
    // Match route code / number tokens like "Route 1" or "R-01" or "Bus 1"
    const routeObj = routes.find((r) => r.busId === bus.busId || r.busNumber === bus.busNumber);
    if (routeObj) {
      const rCode = String(routeObj.routeCode || "").trim().toLowerCase();
      const rName = String(routeObj.routeName || "").trim().toLowerCase();
      if (rCode && (stRoute === rCode || stRoute.includes(rCode))) return true;
      if (rName && (rName.includes(stRoute) || stRoute.includes(rName))) return true;
      if (
        Array.isArray(routeObj.stops) &&
        routeObj.stops.some((s) => {
          const sn = String(s.stopName || "").trim().toLowerCase();
          return sn && (sn === stRoute || sn.includes(stRoute) || (stStop && sn.includes(stStop)));
        })
      ) {
        return true;
      }
    }
  }

  if (stStop) {
    const routeObj = routes.find((r) => r.busId === bus.busId || r.busNumber === bus.busNumber);
    if (
      routeObj?.stops?.some((s) =>
        String(s.stopName || "").trim().toLowerCase().includes(stStop)
      )
    ) {
      return true;
    }
  }

  return false;
}

export const ParentLiveBusMap: React.FC<ParentLiveBusMapProps> = ({
  school,
  student,
}) => {
  const isDemo = shouldUseDemoForSchool(school?.id);
  const [fleetBuses, setFleetBuses] = useState<BusLiveLocation[]>([]);
  const [routes, setRoutes] = useState<SchoolBusRoute[]>([]);
  const [rtdbStopCoordsByBus, setRtdbStopCoordsByBus] = useState<Record<string, any[]>>({});
  const [myHomePin, setMyHomePin] = useState<StudentHomePin | null>(null);
  const [showPinEditor, setShowPinEditor] = useState<boolean>(false);
  const [pinLinkInput, setPinLinkInput] = useState<string>("");
  const [savingPin, setSavingPin] = useState<boolean>(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    try {
      return typeof Notification !== "undefined" ? Notification.permission : "default";
    } catch {
      return "default";
    }
  });

  // 1. Load & Subscribe to Live Bus Fleet + Route Stops
  useEffect(() => {
    const sid = school?.id || "";

    const loadLocal = () => {
      const merged = buildMergedFleetList(sid);
      setFleetBuses(merged.length > 0 ? merged : isDemo ? [DEMO_FALLBACK_BUS] : []);
      setRoutes(getLocalRoutes(sid));
    };

    loadLocal();
    window.addEventListener("school-transport-updated", loadLocal);

    const handleBusUpdate = (e: any) => {
      const live = e?.detail as BusLiveLocation;
      if (live && live.busId) {
        setFleetBuses((prev) => {
          const exists = prev.some((b) => b.busId === live.busId);
          if (!exists) return [...prev, live];
          return prev.map((b) => (b.busId === live.busId ? { ...b, ...live } : b));
        });
      }
    };
    window.addEventListener("nst_bus_location_update", handleBusUpdate);

    let unsubLoc1: any = null;
    let unsubLoc2: any = null;
    let unsubFleet: any = null;

    const mergeIncoming = (arr: BusLiveLocation[]) => {
      if (arr.length === 0) return;
      setFleetBuses((prev) => {
        const map = new Map(prev.map((p) => [p.busId, p]));
        arr.forEach((b) => {
          if (b?.busId) map.set(b.busId, { ...map.get(b.busId), ...b });
        });
        return Array.from(map.values());
      });
    };

    const mergeFleetMeta = (val: Record<string, any>) => {
      const stopMap: Record<string, any[]> = {};
      const fleetArr = Object.values(val || {}) as any[];
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
        setFleetBuses((prev) => {
          const map = new Map(prev.map((p) => [p.busId, p]));
          fleetArr.forEach((v: any) => {
            const bid = v?.busId || v?.id;
            if (!bid) return;
            if (!map.has(bid)) {
              map.set(bid, {
                busId: bid,
                busNumber: v.busNumber || v.vehicleNumber || "School Bus",
                route: v.route || "School Route",
                driverName: v.driverName || "Driver",
                driverPhone: v.driverPhone || "",
                latitude: Number(v.latitude || 0),
                longitude: Number(v.longitude || 0),
                speed: Number(v.speed || 0),
                heading: Number(v.heading || 0),
                accuracy: Number(v.accuracy || 0),
                tripStatus: v.tripStatus || "idle",
                tripType: v.tripType || "morning_pickup",
                lastUpdated: v.lastUpdated || new Date().toISOString(),
                currentStop: v.currentStop || "Depot",
                totalStops: Array.isArray(v.stops) ? v.stops.length : Number(v.totalStops || 0),
                completedStops: Array.isArray(v.completedStops) ? v.completedStops : [],
              });
            }
          });
          return Array.from(map.values());
        });
      }
    };

    const unsubSbLoc = sid
      ? sbRtdbSubscribe(`school_bus_locations/${sid}`, (val) => {
          if (val && typeof val === "object") {
            mergeIncoming(Object.values(val) as BusLiveLocation[]);
          }
        })
      : () => {};

    const unsubSbFleet = sid
      ? sbRtdbSubscribe(`schools/${sid}/bus_fleet`, (val) => {
          if (val && typeof val === "object") {
            mergeFleetMeta(val);
          }
        })
      : () => {};

    if (rtdb && sid) {
      try {
        unsubLoc1 = onValue(dbRef(rtdb, `school_bus_locations/${sid}`), (snap) => {
          if (snap.exists()) mergeIncoming(Object.values(snap.val()) as BusLiveLocation[]);
        });
      } catch {}

      try {
        unsubFleet = onValue(dbRef(rtdb, `schools/${sid}/bus_fleet`), (snap) => {
          if (snap.exists()) mergeFleetMeta(snap.val() || {});
        });
      } catch {}
    }

    return () => {
      window.removeEventListener("school-transport-updated", loadLocal);
      window.removeEventListener("nst_bus_location_update", handleBusUpdate);
      if (typeof unsubSbLoc === "function") unsubSbLoc();
      if (typeof unsubSbFleet === "function") unsubSbFleet();
      if (typeof unsubLoc1 === "function") unsubLoc1();
      if (typeof unsubLoc2 === "function") unsubLoc2();
      if (typeof unsubFleet === "function") unsubFleet();
    };
  }, [school?.id, isDemo]);

  // 2. Load ONLY THIS STUDENT'S Home Pin (Strict Privacy — zero other students loaded)
  useEffect(() => {
    const sid = school?.id || "";
    const stId = student?.id || "";
    if (!sid || !stId) return;

    // Seed from student profile fields if present
    if (
      Number.isFinite(Number((student as any)?.homeLat)) &&
      Number.isFinite(Number((student as any)?.homeLng)) &&
      (Math.abs(Number((student as any)?.homeLat)) > 0.001 ||
        Math.abs(Number((student as any)?.homeLng)) > 0.001)
    ) {
      setMyHomePin({
        studentId: stId,
        studentName: student?.name || "My Child",
        className: student?.className,
        busRoute: student?.busRoute,
        homeLat: Number((student as any).homeLat),
        homeLng: Number((student as any).homeLng),
      });
    }

    try {
      const raw = localStorage.getItem(`nst_student_home_pins_${sid}`);
      if (raw) {
        const obj = JSON.parse(raw) || {};
        const p = obj[stId];
        if (p && Number.isFinite(Number(p.homeLat)) && Number.isFinite(Number(p.homeLng))) {
          setMyHomePin({
            ...p,
            homeLat: Number(p.homeLat),
            homeLng: Number(p.homeLng),
          });
        }
      }
    } catch {}

    const unsubSbMyPin = sbRtdbSubscribe(`schools/${sid}/student_home_pins/${stId}`, (p) => {
      if (p && Number.isFinite(Number(p.homeLat)) && Number.isFinite(Number(p.homeLng))) {
        setMyHomePin({
          ...p,
          studentId: stId,
          homeLat: Number(p.homeLat),
          homeLng: Number(p.homeLng),
        });
      }
    });

    let unsubMyPin: any = null;
    if (rtdb) {
      try {
        const rawUnsubPin = onValue(dbRef(rtdb, `schools/${sid}/student_home_pins/${stId}`), (snap) => {
          if (!snap.exists()) return;
          const p = snap.val();
          if (p && Number.isFinite(Number(p.homeLat)) && Number.isFinite(Number(p.homeLng))) {
            setMyHomePin({
              ...p,
              studentId: stId,
              homeLat: Number(p.homeLat),
              homeLng: Number(p.homeLng),
            });
          }
        });
        unsubMyPin = () => {
          unsubSbMyPin();
          if (typeof rawUnsubPin === "function") rawUnsubPin();
        };
      } catch {
        unsubMyPin = unsubSbMyPin;
      }
    } else {
      unsubMyPin = unsubSbMyPin;
    }

    if (isDemo && !myHomePin) {
      // Provide demo home pin only for demo school preview
      setMyHomePin((prev) =>
        prev || {
          studentId: stId,
          studentName: student?.name || "Student",
          className: student?.className,
          busRoute: student?.busRoute || "Route 1",
          homeLat: 28.4596,
          homeLng: 77.0268,
        }
      );
    }

    return () => {
      if (typeof unsubMyPin === "function") unsubMyPin();
    };
  }, [school?.id, student?.id, isDemo]);

  // 3. Strictly Resolve ONLY the Student's Assigned Bus
  const assignedBus = useMemo<BusLiveLocation | null>(() => {
    if (fleetBuses.length === 0) return null;
    const matched = fleetBuses.find((b) => matchesStudentBus(b, student, routes));
    if (matched) return matched;
    // If school operates only 1 single bus, that is automatically the child's bus
    if (fleetBuses.length === 1) return fleetBuses[0];
    // In Demo preview mode without busRoute configured on demo student, show Bus #01
    if (isDemo) return fleetBuses[0];
    return null;
  }, [fleetBuses, student, routes, isDemo]);

  // 4. Build Route Overlay ONLY for Assigned Bus
  const assignedRouteOverlay = useMemo<MapRouteOverlay[]>(() => {
    if (!assignedBus) return [];
    const matchedRoute = routes.find(
      (r) => r.busId === assignedBus.busId || r.busNumber === assignedBus.busNumber
    );
    const rtdbStops = rtdbStopCoordsByBus[assignedBus.busId];
    const sourceStops =
      matchedRoute?.stops?.some((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
        ? matchedRoute.stops
        : Array.isArray(rtdbStops)
          ? rtdbStops
          : [];

    const completedSet = new Set(
      (assignedBus.completedStops || []).map((s) => String(s).trim().toLowerCase())
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

    if (stopsWithCoords.length === 0) return [];
    return [
      {
        busId: assignedBus.busId,
        busNumber: assignedBus.busNumber,
        routeName: assignedBus.route,
        color: matchedRoute?.routeColor || "#10b981",
        stops: stopsWithCoords,
      },
    ];
  }, [assignedBus, routes, rtdbStopCoordsByBus]);

  // 5. Compute Live Distance between Child's Bus & Child's Home
  const busHasValidCoords = Boolean(
    assignedBus &&
      Number.isFinite(Number(assignedBus.latitude)) &&
      Number.isFinite(Number(assignedBus.longitude)) &&
      (Math.abs(Number(assignedBus.latitude)) > 0.001 ||
        Math.abs(Number(assignedBus.longitude)) > 0.001)
  );

  const liveDistanceMeters = useMemo(() => {
    if (!busHasValidCoords || !assignedBus || !myHomePin) return null;
    return haversineMeters(
      Number(assignedBus.latitude),
      Number(assignedBus.longitude),
      myHomePin.homeLat,
      myHomePin.homeLng
    );
  }, [busHasValidCoords, assignedBus, myHomePin]);

  const proximityStatus =
    liveDistanceMeters !== null ? getProximityStatus(liveDistanceMeters) : null;

  const homePinOverlay = useMemo<MapHomePinOverlay[]>(() => {
    if (!myHomePin) return [];
    return [
      {
        id: myHomePin.studentId,
        label: "मेरा घर",
        sublabel: student?.name || "Student Home",
        lat: myHomePin.homeLat,
        lng: myHomePin.homeLng,
        isOwnHome: true,
        distanceText:
          liveDistanceMeters !== null ? formatDistanceShort(liveDistanceMeters) : undefined,
        show1KmRadius: true,
      },
    ];
  }, [myHomePin, student?.name, liveDistanceMeters]);

  const saveHomePin = async (lat: number, lng: number) => {
    const sid = school?.id;
    const stId = student?.id;
    if (!sid || !stId) return;
    setSavingPin(true);
    try {
      const pinRecord: StudentHomePin = {
        studentId: stId,
        studentName: student?.name || "Student",
        rollNo: student?.rollNo,
        className: student?.className,
        busRoute: student?.busRoute || assignedBus?.route || "Route 1",
        homeLat: lat,
        homeLng: lng,
        homeAddress: student?.address || "",
        updatedAt: new Date().toISOString(),
      };
      setMyHomePin(pinRecord);
      const k = `nst_student_home_pins_${sid}`;
      const existing = JSON.parse(localStorage.getItem(k) || "{}");
      existing[stId] = pinRecord;
      localStorage.setItem(k, JSON.stringify(existing));
      await sbRtdbSet(`schools/${sid}/student_home_pins/${stId}`, pinRecord).catch(() => {});
      if (rtdb) {
        await rtdbSet(dbRef(rtdb, `schools/${sid}/student_home_pins/${stId}`), pinRecord);
      }
      await updateStudent(sid, stId, { homeLat: lat, homeLng: lng });
      setShowPinEditor(false);
      setPinLinkInput("");
      toast.success("आपके घर का GPS Pin सेव हो गया! अब 1 KM के अंदर बस आते ही अलर्ट मिलेगा।");
    } catch {
      toast.error("Home Pin save karne me dikkat aayi, dobara koshish karein.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      toast.error("आपके फोन में GPS उपलब्ध नहीं है।");
      return;
    }
    setSavingPin(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveHomePin(
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6))
        );
      },
      (err) => {
        setSavingPin(false);
        toast.error(err?.message || "GPS permission allow karein ya Google Maps link paste karein.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLink = async () => {
    setSavingPin(true);
    try {
      const parsed = await resolveGoogleMapsLocationInput(pinLinkInput);
      if (!parsed) {
        toast.error("सही Google Maps location link या 'lat, lng' डालें।");
        return;
      }
      await saveHomePin(parsed.lat, parsed.lng);
    } finally {
      setSavingPin(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      if (typeof Notification === "undefined") {
        toast.info("आपके ब्राउज़र में पुश नोटिफिकेशन सपोर्ट नहीं है।");
        return;
      }
      const res = await Notification.requestPermission();
      setNotifPermission(res);
      if (res === "granted") {
        toast.success("🔔 1 KM Bus Auto Alert चालू हो गया!");
      } else {
        toast.error("Notification permission block hai — browser settings se Allow karein.");
      }
    } catch {}
  };

  // No bus assigned yet (strict privacy: do NOT expose other buses)
  if (!assignedBus) {
    return (
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center p-6 text-center bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Bus size={30} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-base font-black text-white">
            अभी आपके बच्चे का बस रूट असाइन नहीं हुआ है
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            प्राइवेसी के लिए यहाँ सिर्फ आपके बच्चे की असाइन की गई बस ही दिखती है। कृपया स्कूल ऑफिस या एडमिन से{" "}
            <strong className="text-amber-300">{student?.name || "बच्चे"}</strong> का बस रूट जुड़वाएं।
          </p>
        </div>
      </div>
    );
  }

  const isLive = assignedBus.tripStatus === "started";

  return (
    <div className="flex flex-col h-full min-h-[76vh] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
      {/* Compact Read-Only Top Status Strip */}
      <div className="px-3.5 py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black shrink-0">
              <Radio size={12} className="animate-pulse" /> LIVE • {assignedBus.speed || 0} km/h
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold shrink-0">
              <Bus size={12} /> Depot Idle
            </span>
          )}
          <span className="text-xs font-bold text-slate-200 truncate">
            {assignedBus.currentStop ? `Near ${assignedBus.currentStop}` : assignedBus.busNumber}
          </span>
        </div>

        {/* 1 KM Auto Alert Status Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {notifPermission === "granted" && myHomePin ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-[11px] font-black">
              <BellRing size={12} /> 1 KM Auto Alert: ON
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-black cursor-pointer transition"
            >
              <Bell size={12} /> 1 KM Alert Allow करें
            </button>
          )}
        </div>
      </div>

      {/* First-Time Only Home Pin Setup Strip (Hides automatically once saved!) */}
      {(!myHomePin || showPinEditor) && (
        <div className="px-3.5 py-2.5 bg-emerald-950/50 border-b border-emerald-500/30 space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-emerald-200 flex items-center gap-1.5">
              <Home size={14} className="text-emerald-400 shrink-0" />
              <span>
                {myHomePin
                  ? "अपने घर का लोकेशन अपडेट करें:"
                  : "1 KM ऑटो अलर्ट के लिए एक बार अपने घर का GPS पिन सेव करें:"}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={savingPin}
                onClick={handleCaptureGps}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                <Crosshair size={12} /> Use My Home GPS
              </button>
              {myHomePin && (
                <button
                  type="button"
                  onClick={() => setShowPinEditor(false)}
                  className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={pinLinkInput}
              onChange={(e) => setPinLinkInput(e.target.value)}
              placeholder="या Google Maps link paste करें (e.g. maps.app.goo.gl/...)"
              className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            <button
              type="button"
              disabled={savingPin || !pinLinkInput.trim()}
              onClick={handleSaveLink}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs cursor-pointer shrink-0"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* 80% VIEWPORT: BIG READ-ONLY INTERACTIVE LIVE MAP */}
      <div className="flex-1 min-h-[380px] sm:min-h-[480px] relative p-2 bg-slate-950">
        <LiveBusGoogleMap
          buses={[assignedBus]}
          selectedBusId={assignedBus.busId}
          routes={assignedRouteOverlay}
          homePins={homePinOverlay}
          heightClass="h-full min-h-[380px] sm:min-h-[480px]"
          schoolId={school?.id}
          schoolCode={school?.code}
          readOnly={true}
          showOpenInMapsButton={true}
          connectBusToHome={true}
        />
      </div>

      {/* Compact Bottom Live Distance + Driver Call Dock */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Distance & Bus Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-amber-500/30 text-center shrink-0 min-w-[92px]">
              <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400">
                घर से दूरी
              </span>
              <span className="text-base font-black font-mono text-amber-300">
                {liveDistanceMeters !== null
                  ? formatDistanceShort(liveDistanceMeters)
                  : isLive
                    ? "Live"
                    : "Idle"}
              </span>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black text-white truncate">
                  {assignedBus.busNumber}
                </p>
                {proximityStatus && (
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${proximityStatus.badgeClass}`}
                  >
                    {proximityStatus.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {assignedBus.route} • ड्राइवर: <strong className="text-slate-200">{assignedBus.driverName || "—"}</strong>
              </p>
              {myHomePin && !showPinEditor && (
                <button
                  type="button"
                  onClick={() => setShowPinEditor(true)}
                  className="text-[10px] text-emerald-400/80 hover:text-emerald-300 underline cursor-pointer"
                >
                  घर पिन सेव है ✓ (बदलें)
                </button>
              )}
            </div>
          </div>

          {/* 1-Tap Call Driver & Open Maps */}
          <div className="flex items-center gap-2 shrink-0">
            {assignedBus.driverPhone && (
              <a
                href={`tel:${assignedBus.driverPhone}`}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
              >
                <Phone size={14} /> Call Driver
              </a>
            )}
            {busHasValidCoords && (
              <button
                type="button"
                onClick={() =>
                  safeOpenExternalUrl(
                    `https://www.google.com/maps?q=${assignedBus.latitude},${assignedBus.longitude}`
                  )
                }
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
              >
                <ExternalLink size={14} /> Google Maps
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
