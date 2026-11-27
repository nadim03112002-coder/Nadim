import type {
  BusLiveLocation,
  SchoolBusDriver,
  SchoolBusRoute,
  VehicleFitnessRecord,
} from "../school-types";
export type {
  BusLiveLocation,
  SchoolBusDriver,
  SchoolBusRoute,
  VehicleFitnessRecord,
};
import type { StudentHomePin } from "./busProximity";
import { shouldUseDemoForSchool, isDemoSchoolId } from "../school-firebase";
import { rtdb } from "../firebase";
import { ref as rtdbRef, set as rtdbSet, remove as rtdbRemove } from "firebase/database";
import { sbRtdbSet, sbRtdbRemove } from "../services/supabaseDbAdapter";
import {
  loadSchoolSubcollection,
  syncSchoolSubcollection,
  saveSchoolSubdoc,
  deleteSchoolSubdoc,
} from "./schoolCloudSync";

export const DRIVERS_LOCAL_KEY = (sid: string) => `nst_school_bus_drivers_${sid || "demo"}`;
export const ROUTES_LOCAL_KEY = (sid: string) => `nst_school_bus_routes_${sid || "demo"}`;
export const FITNESS_LOCAL_KEY = (sid: string) => `bus_fitness_${sid || "demo"}`;
export const BUS_LIVE_SHARE_LOCAL_KEY = (sid: string) => `nst_bus_live_share_${sid || "demo"}`;
const DEMO_SEEDED_FLAG = (sid: string) => `nst_transport_seeded_${sid || "demo"}`;

export function getAllBusLiveShareUrls(schoolId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(BUS_LIVE_SHARE_LOCAL_KEY(schoolId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getBusLiveShareUrl(schoolId: string, busId: string): string {
  if (!busId) return "";
  const map = getAllBusLiveShareUrls(schoolId);
  return String(map[busId] || "").trim();
}

export async function saveBusLiveShareUrl(
  schoolId: string,
  busId: string,
  url: string
): Promise<void> {
  if (!busId) return;
  const cleanUrl = String(url || "").trim();
  try {
    const map = getAllBusLiveShareUrls(schoolId);
    if (cleanUrl) {
      map[busId] = cleanUrl;
    } else {
      delete map[busId];
    }
    localStorage.setItem(BUS_LIVE_SHARE_LOCAL_KEY(schoolId), JSON.stringify(map));

    // Also update local cached live bus telemetry if present
    const liveKey = `nst_live_bus_${schoolId}_${busId}`;
    const prevRaw = localStorage.getItem(liveKey);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw);
      prev.liveShareUrl = cleanUrl;
      localStorage.setItem(liveKey, JSON.stringify(prev));
    }

    if (schoolId && !isDemoSchoolId(schoolId)) {
      if (cleanUrl) {
        void sbRtdbSet(`schools/${schoolId}/bus_live_share/${busId}`, {
          busId,
          liveShareUrl: cleanUrl,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
        if (rtdb) {
          void rtdbSet(rtdbRef(rtdb, `schools/${schoolId}/bus_live_share/${busId}`), {
            busId,
            liveShareUrl: cleanUrl,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      } else {
        void sbRtdbRemove(`schools/${schoolId}/bus_live_share/${busId}`).catch(() => {});
        if (rtdb) {
          void rtdbRemove(rtdbRef(rtdb, `schools/${schoolId}/bus_live_share/${busId}`)).catch(() => {});
        }
      }
    }
  } catch {}
  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
}

function buildDemoDrivers(schoolId: string): SchoolBusDriver[] {
  const now = new Date().toISOString();
  return [
    {
      id: "drv-01",
      schoolId,
      name: "Rajesh Yadav",
      phone: "9811223344",
      licenseNo: "DL-04-2019004821",
      licenseExpiry: "2028-09-30",
      aadhaarLast4: "4821",
      conductorName: "Sohan Lal",
      conductorPhone: "9811223300",
      assignedBusId: "bus-01",
      assignedBusNumber: "Bus #01 (DL-1PC-4521)",
      status: "ACTIVE",
      updatedAt: now,
    },
    {
      id: "drv-02",
      schoolId,
      name: "Suresh Singh",
      phone: "9822334455",
      licenseNo: "DL-07-2020007192",
      licenseExpiry: "2027-12-15",
      aadhaarLast4: "7192",
      conductorName: "Raju Sharma",
      conductorPhone: "9822334400",
      assignedBusId: "bus-02",
      assignedBusNumber: "Bus #02 (DL-1PC-8892)",
      status: "ACTIVE",
      updatedAt: now,
    },
    {
      id: "drv-03",
      schoolId,
      name: "Mukesh Kumar",
      phone: "9833445566",
      licenseNo: "DL-02-2021003314",
      licenseExpiry: "2029-05-20",
      aadhaarLast4: "3314",
      conductorName: "Deepak Kumar",
      conductorPhone: "9833445500",
      assignedBusId: "bus-03",
      assignedBusNumber: "Bus #03 (DL-1PC-2219)",
      status: "ACTIVE",
      updatedAt: now,
    },
  ];
}

function buildDemoRoutes(schoolId: string): SchoolBusRoute[] {
  const now = new Date().toISOString();
  return [
    {
      id: "route-01",
      schoolId,
      routeName: "Route 1 — North Sector & Station Road",
      routeCode: "R-01",
      routeColor: "#10b981",
      busId: "bus-01",
      busNumber: "Bus #01 (DL-1PC-4521)",
      driverId: "drv-01",
      driverName: "Rajesh Yadav",
      driverPhone: "9811223344",
      conductorName: "Sohan Lal",
      conductorPhone: "9811223300",
      monthlyFee: 850,
      stops: [
        { id: "stp-1", stopName: "Sector 14 Gate", pickupTime: "07:10", dropTime: "14:25", distanceKm: 6.5, lat: 28.4725, lng: 77.0432 },
        { id: "stp-2", stopName: "Station Chowk", pickupTime: "07:22", dropTime: "14:12", distanceKm: 4.2, lat: 28.4648, lng: 77.0324 },
        { id: "stp-3", stopName: "City Plaza", pickupTime: "07:35", dropTime: "13:58", distanceKm: 2.1, lat: 28.4582, lng: 77.0245 },
        { id: "stp-3b", stopName: "School Main Gate", pickupTime: "07:45", dropTime: "13:45", distanceKm: 0, lat: 28.4512, lng: 77.0188 },
      ],
      active: true,
      updatedAt: now,
    },
    {
      id: "route-02",
      schoolId,
      routeName: "Route 2 — Central Market & Green Park",
      routeCode: "R-02",
      routeColor: "#3b82f6",
      busId: "bus-02",
      busNumber: "Bus #02 (DL-1PC-8892)",
      driverId: "drv-02",
      driverName: "Suresh Singh",
      driverPhone: "9822334455",
      conductorName: "Raju Sharma",
      conductorPhone: "9822334400",
      monthlyFee: 950,
      stops: [
        { id: "stp-4", stopName: "Green Park Phase 2", pickupTime: "07:05", dropTime: "14:30", distanceKm: 8.0, lat: 28.4812, lng: 77.0551 },
        { id: "stp-5", stopName: "Central Market", pickupTime: "07:20", dropTime: "14:15", distanceKm: 5.0, lat: 28.4692, lng: 77.0411 },
        { id: "stp-6", stopName: "Hospital Square", pickupTime: "07:32", dropTime: "14:02", distanceKm: 2.8, lat: 28.4598, lng: 77.0315 },
        { id: "stp-6b", stopName: "School Main Gate", pickupTime: "07:45", dropTime: "13:45", distanceKm: 0, lat: 28.4512, lng: 77.0188 },
      ],
      active: true,
      updatedAt: now,
    },
    {
      id: "route-03",
      schoolId,
      routeName: "Route 3 — South Ring Road & Railway Colony",
      routeCode: "R-03",
      routeColor: "#f59e0b",
      busId: "bus-03",
      busNumber: "Bus #03 (DL-1PC-2219)",
      driverId: "drv-03",
      driverName: "Mukesh Kumar",
      driverPhone: "9833445566",
      conductorName: "Deepak Kumar",
      conductorPhone: "9833445500",
      monthlyFee: 1100,
      stops: [
        { id: "stp-7", stopName: "Railway Colony Gate", pickupTime: "07:00", dropTime: "14:35", distanceKm: 9.4, lat: 28.4425, lng: 77.0012 },
        { id: "stp-8", stopName: "Model Town Circle", pickupTime: "07:18", dropTime: "14:18", distanceKm: 5.5, lat: 28.4468, lng: 77.0114 },
        { id: "stp-9", stopName: "South Ring Road", pickupTime: "07:34", dropTime: "14:00", distanceKm: 3.1, lat: 28.4495, lng: 77.0159 },
        { id: "stp-9b", stopName: "School Main Gate", pickupTime: "07:45", dropTime: "13:45", distanceKm: 0, lat: 28.4512, lng: 77.0188 },
      ],
      active: true,
      updatedAt: now,
    },
  ];
}

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

export function ensureDemoSeeded(schoolId: string): void {
  if (!schoolId || !shouldUseDemoForSchool(schoolId)) return;
  try {
    if (localStorage.getItem(DEMO_SEEDED_FLAG(schoolId)) === "1") return;
    const existingDrivers = readJsonArray<SchoolBusDriver>(DRIVERS_LOCAL_KEY(schoolId));
    const existingRoutes = readJsonArray<SchoolBusRoute>(ROUTES_LOCAL_KEY(schoolId));
    const existingFitness = readJsonArray<any>(FITNESS_LOCAL_KEY(schoolId));

    if (existingDrivers.length === 0) {
      writeJsonArray(DRIVERS_LOCAL_KEY(schoolId), buildDemoDrivers(schoolId));
    }
    if (existingRoutes.length === 0) {
      writeJsonArray(ROUTES_LOCAL_KEY(schoolId), buildDemoRoutes(schoolId));
    }
    if (existingFitness.length === 0) {
      const demoRoutes = existingRoutes.length > 0 ? existingRoutes : buildDemoRoutes(schoolId);
      writeJsonArray(
        FITNESS_LOCAL_KEY(schoolId),
        demoRoutes.map((r) => ({
          id: r.busId || r.id,
          schoolId,
          vehicleNumber: r.busNumber,
          model: "Tata Starbus School",
          route: r.routeName,
          driverName: r.driverName,
          driverPhone: r.driverPhone,
          conductorName: r.conductorName || "",
          conductorPhone: r.conductorPhone || "",
          stops: r.stops.map((s) => s.stopName),
          fitnessExpiryDate: "2027-06-30",
          insuranceExpiryDate: "2027-03-31",
          pollutionPucExpiryDate: "2026-12-31",
          roadTaxExpiryDate: "2027-03-31",
        }))
      );
    }
    localStorage.setItem(DEMO_SEEDED_FLAG(schoolId), "1");
  } catch {}
}

export function getLocalDrivers(schoolId: string): SchoolBusDriver[] {
  ensureDemoSeeded(schoolId);
  return readJsonArray<SchoolBusDriver>(DRIVERS_LOCAL_KEY(schoolId));
}

export function getLocalRoutes(schoolId: string): SchoolBusRoute[] {
  ensureDemoSeeded(schoolId);
  return readJsonArray<SchoolBusRoute>(ROUTES_LOCAL_KEY(schoolId));
}

export function getLocalFitnessVehicles(schoolId: string): (VehicleFitnessRecord & {
  route?: string;
  stops?: string[];
  conductorName?: string;
  conductorPhone?: string;
})[] {
  ensureDemoSeeded(schoolId);
  return readJsonArray<any>(FITNESS_LOCAL_KEY(schoolId));
}

export async function loadTransportData(schoolId: string): Promise<{
  drivers: SchoolBusDriver[];
  routes: SchoolBusRoute[];
  vehicles: any[];
}> {
  ensureDemoSeeded(schoolId);
  const [drivers, routes] = await Promise.all([
    loadSchoolSubcollection<SchoolBusDriver>(schoolId, "bus_drivers", DRIVERS_LOCAL_KEY(schoolId)),
    loadSchoolSubcollection<SchoolBusRoute>(schoolId, "bus_routes", ROUTES_LOCAL_KEY(schoolId)),
  ]);
  const vehicles = getLocalFitnessVehicles(schoolId);
  return {
    drivers: drivers.length > 0 ? drivers : getLocalDrivers(schoolId),
    routes: routes.length > 0 ? routes : getLocalRoutes(schoolId),
    vehicles,
  };
}

export async function saveDriverRecord(schoolId: string, driver: SchoolBusDriver): Promise<SchoolBusDriver[]> {
  const current = getLocalDrivers(schoolId);
  const next = [driver, ...current.filter((d) => d.id !== driver.id)];
  writeJsonArray(DRIVERS_LOCAL_KEY(schoolId), next);
  await saveSchoolSubdoc(schoolId, "bus_drivers", driver);
  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  return next;
}

export async function deleteDriverRecord(schoolId: string, driverId: string): Promise<SchoolBusDriver[]> {
  const current = getLocalDrivers(schoolId);
  const next = current.filter((d) => d.id !== driverId);
  writeJsonArray(DRIVERS_LOCAL_KEY(schoolId), next);
  await deleteSchoolSubdoc(schoolId, "bus_drivers", driverId);
  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  return next;
}

export async function saveRouteRecord(schoolId: string, route: SchoolBusRoute): Promise<SchoolBusRoute[]> {
  const current = getLocalRoutes(schoolId);
  const next = [route, ...current.filter((r) => r.id !== route.id)];
  writeJsonArray(ROUTES_LOCAL_KEY(schoolId), next);
  await saveSchoolSubdoc(schoolId, "bus_routes", route);

  // Sync matching bus_fitness vehicle & live bus metadata if busId exists
  const busId = route.busId || `bus_${route.id}`;
  const fitnessList = getLocalFitnessVehicles(schoolId);
  const existingFit = fitnessList.find((v) => v.id === busId || v.vehicleNumber === route.busNumber);
  const updatedFit = {
    id: existingFit?.id || busId,
    schoolId,
    vehicleNumber: route.busNumber,
    model: existingFit?.model || "School Bus",
    route: route.routeName,
    driverName: route.driverName,
    driverPhone: route.driverPhone,
    conductorName: route.conductorName || "",
    conductorPhone: route.conductorPhone || "",
    stops: route.stops.map((s) => s.stopName),
    fitnessExpiryDate: existingFit?.fitnessExpiryDate || "2027-06-30",
    insuranceExpiryDate: existingFit?.insuranceExpiryDate || "2027-03-31",
    pollutionPucExpiryDate: existingFit?.pollutionPucExpiryDate || "2026-12-31",
    roadTaxExpiryDate: existingFit?.roadTaxExpiryDate || "2027-03-31",
  };
  writeJsonArray(FITNESS_LOCAL_KEY(schoolId), [
    updatedFit,
    ...fitnessList.filter((v) => v.id !== updatedFit.id),
  ]);

  try {
    const liveKey = `nst_live_bus_${schoolId}_${updatedFit.id}`;
    const existingLive = JSON.parse(localStorage.getItem(liveKey) || "null") || {};
    const liveEntry: BusLiveLocation = {
      latitude: existingLive.latitude || 28.6139,
      longitude: existingLive.longitude || 77.209,
      speed: existingLive.speed || 0,
      tripStatus: existingLive.tripStatus || "idle",
      tripType: existingLive.tripType || "morning_pickup",
      completedStops: existingLive.completedStops || [],
      ...existingLive,
      busId: updatedFit.id,
      busNumber: route.busNumber,
      route: route.routeName,
      driverName: route.driverName,
      driverPhone: route.driverPhone,
      currentStop: existingLive.currentStop || route.stops[0]?.stopName || "Depot",
      totalStops: route.stops.length,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(liveKey, JSON.stringify(liveEntry));
    if (!isDemoSchoolId(schoolId)) {
      const fleetPayload = {
        ...liveEntry,
        stops: route.stops.map((s) => s.stopName),
        stopCoords: route.stops.map((s) => ({
          id: s.id,
          stopName: s.stopName,
          pickupTime: s.pickupTime,
          dropTime: s.dropTime,
          ...(Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))
            ? { lat: Number(s.lat), lng: Number(s.lng) }
            : {}),
        })),
        routeColor: route.routeColor || "",
        conductorName: route.conductorName || "",
        conductorPhone: route.conductorPhone || "",
      };
      void sbRtdbSet(`schools/${schoolId}/bus_fleet/${updatedFit.id}`, fleetPayload).catch(() => {});
      if (rtdb) {
        void rtdbSet(rtdbRef(rtdb, `schools/${schoolId}/bus_fleet/${updatedFit.id}`), fleetPayload).catch(() => {});
      }
    }
  } catch {}

  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  return next;
}

export async function updateRouteStopCoordinate(
  schoolId: string,
  busId: string,
  stopName: string,
  lat: number,
  lng: number,
  options?: { appendIfMissing?: boolean; overwriteExisting?: boolean }
): Promise<SchoolBusRoute | null> {
  if (!schoolId || !stopName) return null;
  const routes = getLocalRoutes(schoolId);
  const cleanBusId = String(busId || "").trim();
  const targetRoute =
    routes.find(
      (r) =>
        cleanBusId &&
        (r.busId === cleanBusId || r.id === cleanBusId || r.id === `route_${cleanBusId}`)
    ) || (routes.length === 1 ? routes[0] : undefined);
  const cleanLat = Number(Number(lat).toFixed(6));
  const cleanLng = Number(Number(lng).toFixed(6));
  if (!targetRoute || !Number.isFinite(cleanLat) || !Number.isFinite(cleanLng)) return null;

  const stopNorm = stopName.trim().toLowerCase();
  const existingIdx = targetRoute.stops.findIndex(
    (s) => s.stopName.trim().toLowerCase() === stopNorm
  );

  let updatedStops = [...targetRoute.stops];
  if (existingIdx >= 0) {
    const cur = updatedStops[existingIdx];
    const alreadyHasCoords =
      Number.isFinite(Number(cur.lat)) && Number.isFinite(Number(cur.lng));
    if (alreadyHasCoords && options?.overwriteExisting === false) {
      return targetRoute;
    }
    updatedStops[existingIdx] = { ...cur, lat: cleanLat, lng: cleanLng };
  } else if (options?.appendIfMissing !== false) {
    const newStop = {
      id: `stp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      stopName: stopName.trim(),
      pickupTime: "07:30",
      dropTime: "14:15",
      distanceKm: 0,
      lat: cleanLat,
      lng: cleanLng,
    };
    // Keep School Main Gate at the end if present
    const schoolGateIdx = updatedStops.findIndex((s) =>
      /school|campus|gate|विद्यालय/i.test(s.stopName || "")
    );
    if (schoolGateIdx >= 0) {
      updatedStops.splice(schoolGateIdx, 0, newStop);
    } else {
      updatedStops.push(newStop);
    }
  } else {
    return targetRoute;
  }

  const updatedRoute: SchoolBusRoute = {
    ...targetRoute,
    stops: updatedStops,
    updatedAt: new Date().toISOString(),
  };
  await saveRouteRecord(schoolId, updatedRoute);
  return updatedRoute;
}

/**
 * Saves a student's stop/home GPS location and automatically attaches its coordinates
 * to the matching bus route stop (so adding student locations builds the stop map & auto-checkpoints).
 */
export async function saveStudentStopLocationPin(
  schoolId: string,
  pin: StudentHomePin,
  options?: { busId?: string; overwriteStopCoord?: boolean }
): Promise<StudentHomePin | null> {
  if (!schoolId || !pin?.studentId) return null;
  const lat = Number(Number(pin.homeLat).toFixed(6));
  const lng = Number(Number(pin.homeLng).toFixed(6));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)) {
    return null;
  }

  const normalizedPin: StudentHomePin = {
    ...pin,
    homeLat: lat,
    homeLng: lng,
    busStop: (pin.busStop || "").trim(),
    busRoute: (pin.busRoute || "").trim(),
    busNumber: (pin.busNumber || "").trim(),
    updatedAt: pin.updatedAt || new Date().toISOString(),
  };

  try {
    const k = `nst_student_home_pins_${schoolId}`;
    const existing = JSON.parse(localStorage.getItem(k) || "{}") || {};
    existing[normalizedPin.studentId] = normalizedPin;
    localStorage.setItem(k, JSON.stringify(existing));
  } catch {}

  try {
    void sbRtdbSet(`schools/${schoolId}/student_home_pins/${normalizedPin.studentId}`, normalizedPin).catch(() => {});
    if (rtdb) {
      await rtdbSet(
        rtdbRef(rtdb, `schools/${schoolId}/student_home_pins/${normalizedPin.studentId}`),
        normalizedPin
      ).catch(() => {});
    }
  } catch {}

  // Link to matching Route Stop so Driver Auto-Checkpoints & Map immediately reflect it
  const stopLabel = normalizedPin.busStop || `${normalizedPin.studentName.split(" ")[0]} Stop`;
  const routes = getLocalRoutes(schoolId);
  const routeLow = (normalizedPin.busRoute || "").toLowerCase();
  const busNumLow = (normalizedPin.busNumber || "").toLowerCase();
  const matchedRoute =
    routes.find((r) => options?.busId && (r.busId === options.busId || r.id === options.busId)) ||
    routes.find(
      (r) =>
        (routeLow &&
          (r.routeName.toLowerCase() === routeLow ||
            r.routeName.toLowerCase().includes(routeLow) ||
            routeLow.includes(r.routeName.toLowerCase()))) ||
        (busNumLow &&
          (r.busNumber.toLowerCase() === busNumLow ||
            r.busNumber.toLowerCase().includes(busNumLow)))
    ) ||
    routes[0];

  if (matchedRoute && stopLabel) {
    await updateRouteStopCoordinate(
      schoolId,
      matchedRoute.busId || matchedRoute.id,
      stopLabel,
      lat,
      lng,
      {
        appendIfMissing: Boolean(normalizedPin.busStop),
        overwriteExisting: Boolean(options?.overwriteStopCoord),
      }
    );
  }

  try {
    window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  } catch {}

  return normalizedPin;
}

export async function deleteRouteRecord(schoolId: string, routeId: string): Promise<SchoolBusRoute[]> {
  const current = getLocalRoutes(schoolId);
  const next = current.filter((r) => r.id !== routeId);
  writeJsonArray(ROUTES_LOCAL_KEY(schoolId), next);
  await deleteSchoolSubdoc(schoolId, "bus_routes", routeId);
  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  return next;
}

export async function saveVehicleRecord(schoolId: string, vehicle: any): Promise<any[]> {
  const list = getLocalFitnessVehicles(schoolId);
  const id = vehicle.id || `bus_${Date.now()}`;
  const entry = { ...vehicle, id, schoolId };
  const next = [entry, ...list.filter((v) => v.id !== id)];
  writeJsonArray(FITNESS_LOCAL_KEY(schoolId), next);

  try {
    const liveKey = `nst_live_bus_${schoolId}_${id}`;
    const prevLive = JSON.parse(localStorage.getItem(liveKey) || "null") || {};
    const liveEntry: BusLiveLocation = {
      latitude: prevLive.latitude || 28.6139,
      longitude: prevLive.longitude || 77.209,
      speed: prevLive.speed || 0,
      tripStatus: prevLive.tripStatus || "idle",
      tripType: prevLive.tripType || "morning_pickup",
      completedStops: prevLive.completedStops || [],
      ...prevLive,
      busId: id,
      busNumber: entry.vehicleNumber,
      route: entry.route || "Configured Route",
      driverName: entry.driverName || "—",
      driverPhone: entry.driverPhone || "",
      currentStop: prevLive.currentStop || (Array.isArray(entry.stops) ? entry.stops[0] : "") || "Depot",
      totalStops: Array.isArray(entry.stops) ? entry.stops.length : prevLive.totalStops || 0,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(liveKey, JSON.stringify(liveEntry));
    if (!isDemoSchoolId(schoolId)) {
      const fleetDoc = {
        ...liveEntry,
        stops: Array.isArray(entry.stops) ? entry.stops : [],
      };
      void sbRtdbSet(`schools/${schoolId}/bus_fleet/${id}`, fleetDoc).catch(() => {});
      if (rtdb) {
        void rtdbSet(rtdbRef(rtdb, `schools/${schoolId}/bus_fleet/${id}`), fleetDoc).catch(() => {});
      }
    }
  } catch {}

  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  return next;
}

export async function deleteVehicleRecord(schoolId: string, busId: string): Promise<any[]> {
  const list = getLocalFitnessVehicles(schoolId);
  const next = list.filter((v) => v.id !== busId);
  writeJsonArray(FITNESS_LOCAL_KEY(schoolId), next);
  try {
    localStorage.removeItem(`nst_live_bus_${schoolId}_${busId}`);
    if (!isDemoSchoolId(schoolId)) {
      void sbRtdbRemove(`schools/${schoolId}/bus_fleet/${busId}`).catch(() => {});
      if (rtdb) {
        void rtdbRemove(rtdbRef(rtdb, `schools/${schoolId}/bus_fleet/${busId}`)).catch(() => {});
      }
    }
  } catch {}
  window.dispatchEvent(new CustomEvent("school-transport-updated", { detail: { schoolId } }));
  return next;
}

/**
 * Builds the merged fleet list for AdminBusFleetRadar & SchoolAdminPanel without ever
 * clobbering user-added or edited vehicles in Demo Mode.
 */
export function buildMergedFleetList(schoolId: string): BusLiveLocation[] {
  ensureDemoSeeded(schoolId);
  const map = new Map<string, BusLiveLocation>();

  // 1. Vehicles from bus_fitness
  const vehicles = getLocalFitnessVehicles(schoolId);
  vehicles.forEach((v, idx) => {
    const busId = v.id || `bus_${idx + 1}`;
    map.set(busId, {
      busId,
      busNumber: v.vehicleNumber || `Bus #${idx + 1}`,
      route: v.route || "Configured Route",
      driverName: v.driverName || "—",
      driverPhone: v.driverPhone || "",
      latitude: Number((v as any).latitude || 28.6139),
      longitude: Number((v as any).longitude || 77.209),
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
  });

  // 2. Enrich with configured Routes
  const routes = getLocalRoutes(schoolId);
  routes.forEach((r) => {
    if (!r.busId) return;
    const prev = map.get(r.busId);
    map.set(r.busId, {
      latitude: prev?.latitude || 28.6139,
      longitude: prev?.longitude || 77.209,
      speed: prev?.speed || 0,
      heading: prev?.heading || 0,
      accuracy: prev?.accuracy || 0,
      tripStatus: prev?.tripStatus || "idle",
      tripType: prev?.tripType || "morning_pickup",
      lastUpdated: prev?.lastUpdated || new Date().toISOString(),
      completedStops: prev?.completedStops || [],
      ...(prev || {}),
      busId: r.busId,
      busNumber: r.busNumber || prev?.busNumber || r.busId,
      route: r.routeName || prev?.route || "Configured Route",
      driverName: r.driverName || prev?.driverName || "—",
      driverPhone: r.driverPhone || prev?.driverPhone || "",
      currentStop: prev?.currentStop || r.stops[0]?.stopName || "Depot",
      totalStops: r.stops.length || prev?.totalStops || 0,
    });
  });

  // 3. Overlay live telemetry keys
  if (schoolId) {
    try {
      const prefix = `nst_live_bus_${schoolId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as BusLiveLocation;
            const bid = parsed.busId || k.slice(prefix.length);
            // Only overlay telemetry if vehicle wasn't deleted (or if no fitness list exists yet)
            const prev = map.get(bid);
            if (prev || vehicles.length === 0) {
              map.set(bid, { ...(prev || {}), ...parsed, busId: bid });
            }
          }
        }
      }
    } catch {}
  }

  const shareUrls = getAllBusLiveShareUrls(schoolId);
  return Array.from(map.values()).map((b) => {
    const savedShare = shareUrls[b.busId] || b.liveShareUrl || "";
    return savedShare ? { ...b, liveShareUrl: savedShare } : b;
  });
}

export async function syncAllDriversAndRoutes(
  schoolId: string,
  drivers: SchoolBusDriver[],
  routes: SchoolBusRoute[]
): Promise<void> {
  writeJsonArray(DRIVERS_LOCAL_KEY(schoolId), drivers);
  writeJsonArray(ROUTES_LOCAL_KEY(schoolId), routes);
  await Promise.all([
    syncSchoolSubcollection(schoolId, "bus_drivers", drivers),
    syncSchoolSubcollection(schoolId, "bus_routes", routes),
  ]);
}
