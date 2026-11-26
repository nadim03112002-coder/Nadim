import { rtdb } from "../firebase";
import { ref as dbRef, get as rtdbGet } from "firebase/database";
import { sbRtdbGet } from "../services/supabaseDbAdapter";
import { DEFAULT_SCHOOL_ID, getAllSchools, getLocalSchools } from "../school-firebase";
import {
  getLocalDrivers,
  getLocalFitnessVehicles,
  getLocalRoutes,
  loadTransportData,
} from "./schoolTransportStore";

export const normalizePhone10 = (p?: string | null): string =>
  String(p || "").replace(/\D/g, "").slice(-10);

export const looksLikeDriverIdString = (raw?: string | null): boolean => {
  const s = String(raw || "").trim();
  if (!s) return false;
  return (
    /^(drv|driver)[-_]/i.test(s) ||
    /^DRV-\w+/i.test(s) ||
    s.includes("NSTA-SCHOOL-DRIVER") ||
    s.includes("NSTA-DRIVER") ||
    /[?&]type=driver_id(?:&|#|$)/i.test(s) ||
    /[?&]driverConsole=1(?:&|#|$)/i.test(s)
  );
};

export const isDriverUser = (u?: any): boolean => {
  if (!u || typeof u !== "object") return false;
  const r = String(u.role || "").trim().toUpperCase();
  const sr = String(u.schoolRole || "").trim().toUpperCase();
  const ut = String(u.userType || "").trim().toUpperCase();
  if (r === "DRIVER" || sr === "DRIVER" || ut === "DRIVER") return true;

  const prov = String(u.provider || "").trim().toLowerCase();
  if (prov === "qr_driver_id" || prov === "driver_record") return true;

  if (["ADMIN", "SUPERADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "SCHOOL_SUB_ADMIN", "TEACHER", "ACCOUNTANT", "CASHIER"].includes(r)) {
    return false;
  }

  const uidStr = String(u.id || u.uid || "").trim();
  if (/^(driver|drv)[-_]/i.test(uidStr)) return true;

  if (u.busId && !u.admissionNo && !u.studentId) return true;
  return false;
};

export const isCorruptedDriverStudentRecord = (rec?: any): boolean => {
  if (!rec || typeof rec !== "object") return false;
  const typeUpper = String(rec.type || "").trim().toUpperCase();
  const roleUpper = String(rec.role || "").trim().toUpperCase();
  if (typeUpper === "DRIVER" || roleUpper === "DRIVER") return true;

  const idStr = String(rec.id || "").trim();
  const stuIdStr = String(rec.studentId || "").trim();
  const classIdStr = String(rec.classId || "").trim();
  const classNameStr = String(rec.className || "").trim();
  const admStr = String(rec.admissionNo || "").trim();
  const rollStr = String(rec.rollNo || "").trim();
  const schoolIdStr = String(rec.schoolId || "").trim();

  if (/^(std_)?(drv|driver)[-_]/i.test(idStr)) return true;
  if (/^(drv|driver)[-_]/i.test(stuIdStr)) return true;
  if (/^(drv|driver)[-_]/i.test(classIdStr)) return true;
  if (/^drv[\s_-]+\d+/i.test(classNameStr)) return true;
  if (/^DRV[-_]/i.test(admStr)) return true;
  if (rollStr && schoolIdStr && rollStr === schoolIdStr) return true;
  if (
    idStr.includes("NSTA-SCHOOL-DRIVER") ||
    admStr.includes("NSTA-SCHOOL-DRIVER") ||
    schoolIdStr.includes("NSTA-SCHOOL") ||
    classIdStr.includes("NSTA-SCHOOL")
  ) {
    return true;
  }
  return false;
};

export const promoteCorruptedUserToDriverIfApplicable = (u: any): any | null => {
  if (!u || typeof u !== "object") return null;

  const r = String(u.role || "").trim().toUpperCase();
  if (["ADMIN", "SUPERADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "SCHOOL_SUB_ADMIN", "TEACHER", "ACCOUNTANT", "CASHIER"].includes(r)) {
    return null;
  }

  if (isDriverUser(u)) {
    const busId = String(u.busId || u.driverId || u.id || u.uid || "").replace(/^driver_/, "") || `bus_${Date.now()}`;
    const sid = u.schoolId && !String(u.schoolId).includes("NSTA-SCHOOL") ? u.schoolId : DEFAULT_SCHOOL_ID;
    const phone10 = normalizePhone10(u.mobile || u.phone || u.driverPhone);
    const cleaned = {
      ...u,
      id: String(u.id || "").startsWith("driver_") ? u.id : `driver_${busId}`,
      uid: String(u.uid || u.id || "").startsWith("driver_") ? (u.uid || u.id) : `driver_${busId}`,
      displayId: u.displayId && String(u.displayId).toUpperCase().startsWith("DRV-")
        ? u.displayId
        : `DRV-${(phone10 || busId).slice(-5).toUpperCase()}`,
      name: u.name || u.driverName || "Bus Driver",
      mobile: phone10 || u.mobile || u.phone || "",
      role: "DRIVER",
      schoolRole: "DRIVER",
      schoolId: sid,
      busId,
      busNumber: u.busNumber || u.vehicleNumber || "School Bus",
      busRoute: u.busRoute || u.route || "School Bus Route",
      provider: u.provider === "qr_driver_id" ? "qr_driver_id" : "driver_record",
    };
    delete cleaned.userType;
    delete cleaned.studentId;
    delete cleaned.admissionNo;
    delete cleaned.rollNo;
    delete cleaned.classId;
    delete cleaned.className;
    return cleaned;
  }

  if (isCorruptedDriverStudentRecord(u)) {
    const candidateBusId = [u.busId, u.classId, u.studentId, u.id]
      .map((v) => String(v || "").trim())
      .find((v) => /^(std_)?(drv|driver)[-_]/i.test(v));

    if (candidateBusId) {
      const cleanBusId = candidateBusId.replace(/^std_/i, "").replace(/^driver_/i, "");
      const candidateSid =
        u.schoolId && !String(u.schoolId).includes("NSTA-SCHOOL")
          ? u.schoolId
          : (u.rollNo && String(u.rollNo).length >= 12 ? u.rollNo : DEFAULT_SCHOOL_ID);
      const phone10 = normalizePhone10(u.mobile || u.phone);
      const promoted = {
        ...u,
        id: `driver_${cleanBusId}`,
        uid: `driver_${cleanBusId}`,
        displayId: `DRV-${(phone10 || cleanBusId).slice(-5).toUpperCase()}`,
        name: u.name && u.name !== "Student" ? u.name : "Bus Driver",
        mobile: phone10 || u.mobile || u.phone || "",
        role: "DRIVER",
        schoolRole: "DRIVER",
        schoolId: candidateSid,
        busId: cleanBusId,
        busNumber: u.busNumber || (u.name && u.name.length <= 12 && u.name !== "Student" ? u.name : "School Bus"),
        busRoute: u.busRoute || u.route || "School Bus Route",
        provider: "driver_record",
      };
      delete promoted.userType;
      delete promoted.studentId;
      delete promoted.admissionNo;
      delete promoted.rollNo;
      delete promoted.classId;
      delete promoted.className;
      return promoted;
    }
  }

  return null;
};

export const purgeCorruptedDriverEntriesFromLocalCache = (uidHint?: string): void => {
  if (typeof window === "undefined") return;
  try {
    const cleanArrayKey = (key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => !isCorruptedDriverStudentRecord(item));
        if (filtered.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      } else if (parsed && Array.isArray(parsed.students)) {
        const filtered = parsed.students.filter((item: any) => !isCorruptedDriverStudentRecord(item));
        if (filtered.length !== parsed.students.length) {
          localStorage.setItem(
            key,
            JSON.stringify({
              ...parsed,
              students: filtered,
              activeStudentKey: filtered[0]?.id ? `${filtered[0].schoolId || ""}__${filtered[0].id}` : "",
              activeStudentId: filtered[0]?.id || "",
            })
          );
        }
      }
    };

    cleanArrayKey("nst_linked_students");
    if (uidHint) cleanArrayKey(`nst_user_linked_students_${uidHint}`);

    ["nst_active_student", "nst_cached_student"].forEach((k) => {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (isCorruptedDriverStudentRecord(parsed)) {
          localStorage.removeItem(k);
        }
      } catch {}
    });

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("nst_user_linked_students_") || k.startsWith("nst_school_students_")) {
        try {
          cleanArrayKey(k);
        } catch {}
      }
    }
  } catch {}
};

function buildDriverResult({
  driverId,
  busId,
  busNumber,
  route,
  driverName,
  driverPhone,
  stops,
  schoolId,
  schoolCode = "",
  schoolName = "",
}: {
  driverId?: string;
  busId?: string;
  busNumber?: string;
  route?: string;
  driverName?: string;
  driverPhone?: string;
  stops?: string[];
  schoolId: string;
  schoolCode?: string;
  schoolName?: string;
}) {
  const bPhone = normalizePhone10(driverPhone || "");
  const resolvedBusId = String(busId || driverId || `bus_${bPhone || Date.now()}`).trim();
  const resolvedDriverId = String(driverId || resolvedBusId).trim();
  const entityId = resolvedBusId.startsWith("driver_") ? resolvedBusId : `driver_${resolvedBusId}`;
  const displayCode = `DRV-${(bPhone || resolvedBusId || resolvedDriverId).slice(-5).toUpperCase()}`;

  return {
    id: entityId,
    uid: entityId,
    driverId: resolvedDriverId,
    displayId: displayCode,
    name: driverName || "Bus Driver",
    driverName: driverName || "Bus Driver",
    email: `driver.${bPhone || resolvedBusId}@school.internal`,
    mobile: bPhone || driverPhone || "",
    driverPhone: bPhone || driverPhone || "",
    role: "DRIVER",
    schoolRole: "DRIVER",
    schoolId,
    schoolCode,
    schoolName: schoolName || "School Bus Fleet",
    busId: resolvedBusId,
    busNumber: busNumber || "School Bus",
    busRoute: route || "School Bus Route",
    route: route || "School Bus Route",
    busStops: Array.isArray(stops) ? stops : undefined,
    profileCompleted: true,
    provider: "driver_record",
  };
}

function matchAgainstPool(
  qLower: string,
  cleanPhone: string,
  schoolId: string,
  schoolCode: string,
  schoolName: string,
  drivers: any[],
  routes: any[],
  vehicles: any[]
) {
  const findRouteFor = (drv: any) =>
    routes.find(
      (r: any) =>
        (drv.assignedBusId && r.busId === drv.assignedBusId) ||
        (drv.id && r.driverId === drv.id) ||
        (drv.phone && normalizePhone10(r.driverPhone) === normalizePhone10(drv.phone))
    );

  // 1. Check dedicated bus_drivers records (BusTransportModal)
  for (const d of drivers) {
    if (!d || String(d.status || "").toUpperCase() === "INACTIVE") continue;
    const dPhone = normalizePhone10(d.phone || "");
    const dId = String(d.id || "").trim();
    const aBusId = String(d.assignedBusId || "").trim();
    const drvCode = `DRV-${(dPhone || aBusId || dId).slice(-5).toUpperCase()}`.toLowerCase();
    const drvCodeAlt = `DRV-${(dId).slice(-5).toUpperCase()}`.toLowerCase();
    const drvCode4 = `DRV-${(dPhone || aBusId || dId).slice(-4).toUpperCase()}`.toLowerCase();
    const lic = String(d.licenseNo || "").trim().toLowerCase();

    const phoneMatch = cleanPhone.length >= 10 && dPhone === cleanPhone;
    const idMatch =
      (dId && (dId.toLowerCase() === qLower || `driver_${dId}`.toLowerCase() === qLower)) ||
      (aBusId && aBusId.toLowerCase() === qLower) ||
      qLower === drvCode ||
      qLower === drvCodeAlt ||
      qLower === drvCode4 ||
      (lic && lic !== "pending" && lic.length >= 6 && lic === qLower);

    if (phoneMatch || idMatch) {
      const routeRec = findRouteFor(d);
      const busRec = vehicles.find(
        (v: any) =>
          (d.assignedBusId && v.id === d.assignedBusId) ||
          (dPhone && normalizePhone10(v.driverPhone) === dPhone)
      );
      return buildDriverResult({
        driverId: dId,
        busId: routeRec?.busId || d.assignedBusId || dId,
        busNumber: routeRec?.busNumber || d.assignedBusNumber || busRec?.vehicleNumber || "School Bus",
        route: routeRec?.routeName || busRec?.route || "School Bus Route",
        driverName: d.name || routeRec?.driverName,
        driverPhone: d.phone || routeRec?.driverPhone,
        stops: Array.isArray(routeRec?.stops)
          ? routeRec.stops.map((s: any) => s?.stopName || s).filter(Boolean)
          : Array.isArray(busRec?.stops)
          ? busRec.stops
          : undefined,
        schoolId,
        schoolCode,
        schoolName,
      });
    }
  }

  // 2. Check bus_routes records
  for (const r of routes) {
    if (!r || r.active === false) continue;
    const rPhone = normalizePhone10(r.driverPhone || "");
    const rBusId = String(r.busId || r.id || "").trim();
    const rDrvId = String(r.driverId || "").trim();
    const drvCode = `DRV-${(rPhone || rBusId || rDrvId).slice(-5).toUpperCase()}`.toLowerCase();
    const drvCode4 = `DRV-${(rPhone || rBusId || rDrvId).slice(-4).toUpperCase()}`.toLowerCase();

    const phoneMatch = cleanPhone.length >= 10 && rPhone === cleanPhone;
    const idMatch =
      (rDrvId && (rDrvId.toLowerCase() === qLower || `driver_${rDrvId}`.toLowerCase() === qLower)) ||
      (rBusId && (rBusId.toLowerCase() === qLower || `driver_${rBusId}`.toLowerCase() === qLower)) ||
      qLower === drvCode ||
      qLower === drvCode4;

    if (phoneMatch || idMatch) {
      return buildDriverResult({
        driverId: rDrvId || rBusId,
        busId: rBusId || rDrvId,
        busNumber: r.busNumber || "School Bus",
        route: r.routeName || "School Bus Route",
        driverName: r.driverName,
        driverPhone: r.driverPhone,
        stops: Array.isArray(r.stops) ? r.stops.map((s: any) => s?.stopName || s).filter(Boolean) : undefined,
        schoolId,
        schoolCode,
        schoolName,
      });
    }
  }

  // 3. Check bus_fitness / bus_fleet vehicle records
  for (const bus of vehicles) {
    if (!bus) continue;
    const bPhone = normalizePhone10(bus.driverPhone || "");
    const bId = String(bus.id || bus.busId || "").trim();
    const drvCode = `DRV-${(bPhone || bId).slice(-5).toUpperCase()}`.toLowerCase();
    const drvCode4 = `DRV-${(bPhone || bId).slice(-4).toUpperCase()}`.toLowerCase();

    const phoneMatch = cleanPhone.length >= 10 && bPhone === cleanPhone;
    const idMatch =
      (bId && (bId.toLowerCase() === qLower || `driver_${bId}`.toLowerCase() === qLower)) ||
      qLower === drvCode ||
      qLower === drvCode4;

    if (phoneMatch || idMatch) {
      return buildDriverResult({
        driverId: bId,
        busId: bId,
        busNumber: bus.vehicleNumber || bus.busNumber || "School Bus",
        route: bus.route || "School Bus Route",
        driverName: bus.driverName,
        driverPhone: bus.driverPhone,
        stops: Array.isArray(bus.stops) ? bus.stops : undefined,
        schoolId,
        schoolCode,
        schoolName,
      });
    }
  }

  return null;
}

export async function resolveDriverFromLocalAndCloudStores(
  rawQuery: string,
  schoolHintId?: string,
  extraSchools: Array<{ id?: string; code?: string; name?: string }> = []
): Promise<any | null> {
  const q = String(rawQuery || "").trim();
  if (!q) return null;
  const qLower = q.toLowerCase();
  const cleanPhone = normalizePhone10(q);

  const schoolMetaMap = new Map<string, { code: string; name: string }>();
  const registerSchool = (id?: string, code = "", name = "") => {
    const cleanId = String(id || "").trim();
    if (!cleanId) return;
    const prev = schoolMetaMap.get(cleanId);
    schoolMetaMap.set(cleanId, {
      code: code || prev?.code || "",
      name: name || prev?.name || "",
    });
  };

  if (schoolHintId) registerSchool(schoolHintId);
  extraSchools.forEach((s) => registerSchool(s?.id, s?.code || "", s?.name || ""));
  try {
    getLocalSchools().forEach((s: any) => registerSchool(s?.id, s?.code || "", s?.name || ""));
  } catch {}
  registerSchool(DEFAULT_SCHOOL_ID);

  try {
    if (typeof localStorage !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("nst_school_bus_drivers_")) registerSchool(k.replace("nst_school_bus_drivers_", ""));
        if (k.startsWith("nst_school_bus_routes_")) registerSchool(k.replace("nst_school_bus_routes_", ""));
        if (k.startsWith("bus_fitness_")) registerSchool(k.replace("bus_fitness_", ""));
      }
    }
  } catch {}

  // Pass 1: fast local check across all known schools
  for (const [sid, meta] of schoolMetaMap.entries()) {
    try {
      const localDrivers = getLocalDrivers(sid);
      const localRoutes = getLocalRoutes(sid);
      const localVehicles = getLocalFitnessVehicles(sid);
      const hit = matchAgainstPool(
        qLower,
        cleanPhone,
        sid,
        meta.code,
        meta.name,
        localDrivers,
        localRoutes,
        localVehicles
      );
      if (hit) return hit;
    } catch {}
  }

  // Pass 2: cloud check across schools (bus_drivers, bus_routes, bus_fleet)
  try {
    const cloudSchools = await getAllSchools().catch(() => []);
    cloudSchools.forEach((s: any) => registerSchool(s?.id, s?.code || "", s?.name || ""));

    for (const [sid, meta] of schoolMetaMap.entries()) {
      try {
        const { drivers, routes, vehicles } = await loadTransportData(sid);
        let fleetArr = vehicles;
        if (fleetArr.length === 0) {
          let fleet: any = await sbRtdbGet(`schools/${sid}/bus_fleet`).catch(() => null);
          if (!fleet && rtdb) {
            try {
              const fSnap = await rtdbGet(dbRef(rtdb, `schools/${sid}/bus_fleet`));
              if (fSnap.exists()) fleet = fSnap.val();
            } catch {}
          }
          if (fleet && typeof fleet === "object") {
            fleetArr = Object.values(fleet);
          }
        }
        const hit = matchAgainstPool(
          qLower,
          cleanPhone,
          sid,
          meta.code,
          meta.name,
          drivers,
          routes,
          fleetArr
        );
        if (hit) return hit;
      } catch {}
    }
  } catch {}

  return null;
}
