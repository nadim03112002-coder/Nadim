import { computeBearingDeg, haversineMeters } from "./busProximity";

export interface GpsFixSample {
  lat: number;
  lng: number;
  accuracy: number;
  time: number;
  isCoarse: boolean;
  speedKmh: number;
  heading: number;
}

export interface GpsEvaluationResult {
  accepted: boolean;
  reason?: string;
  lat: number;
  lng: number;
  accuracy: number;
  speedKmh: number;
  heading: number;
  stepKm: number;
}

/**
 * Stateful GPS smoother & outlier filter for moving school buses.
 * Eliminates cell-tower ping-pong jumps, stationary jitter scribbles,
 * and impossible teleportation spikes while preserving real road motion.
 */
export class BusGpsTrackerFilter {
  private lastAccepted: GpsFixSample | null = null;
  private lastSatelliteTimeMs = 0;

  reset() {
    this.lastAccepted = null;
    this.lastSatelliteTimeMs = 0;
  }

  seed(lat: number, lng: number, accuracy = 15, heading = 0) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.lastAccepted = {
      lat,
      lng,
      accuracy,
      time: Date.now(),
      isCoarse: false,
      speedKmh: 0,
      heading,
    };
  }

  evaluate(raw: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    speedMps?: number | null;
    speedKmhOverride?: number | null;
    headingDeg?: number | null;
    isCoarse?: boolean;
    nowMs?: number;
  }): GpsEvaluationResult {
    const nowMs = raw.nowMs ?? Date.now();
    const acc = Math.max(1, Math.round(Number(raw.accuracy) || (raw.isCoarse ? 140 : 12)));
    const isCoarse = Boolean(raw.isCoarse) || acc > 65;

    if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) {
      return {
        accepted: false,
        reason: "invalid_coords",
        lat: raw.lat,
        lng: raw.lng,
        accuracy: acc,
        speedKmh: 0,
        heading: 0,
        stepKm: 0,
      };
    }

    const prev = this.lastAccepted;

    // 1. Block coarse / network fixes for 25s whenever satellite GPS is active
    if (
      isCoarse &&
      this.lastSatelliteTimeMs > 0 &&
      nowMs - this.lastSatelliteTimeMs < 25_000
    ) {
      return {
        accepted: false,
        reason: "coarse_suppressed_by_gps",
        lat: prev?.lat ?? raw.lat,
        lng: prev?.lng ?? raw.lng,
        accuracy: acc,
        speedKmh: prev?.speedKmh ?? 0,
        heading: prev?.heading ?? 0,
        stepKm: 0,
      };
    }

    // 2. Reject noisy fixes when we already have a fresh precise fix (< 25s)
    if (
      prev &&
      !prev.isCoarse &&
      nowMs - prev.time < 25_000 &&
      acc > 50 &&
      prev.accuracy <= 25
    ) {
      return {
        accepted: false,
        reason: "low_accuracy_spike",
        lat: prev.lat,
        lng: prev.lng,
        accuracy: acc,
        speedKmh: prev.speedKmh,
        heading: prev.heading,
        stepKm: 0,
      };
    }

    if (!isCoarse && acc <= 40) {
      this.lastSatelliteTimeMs = nowMs;
    }

    let rawSpeedKmh =
      raw.speedKmhOverride !== null && raw.speedKmhOverride !== undefined && Number.isFinite(raw.speedKmhOverride)
        ? Math.round(raw.speedKmhOverride)
        : raw.speedMps !== null && raw.speedMps !== undefined && Number.isFinite(raw.speedMps) && raw.speedMps >= 0
          ? Math.round(raw.speedMps * 3.6)
          : 0;

    let stepMeters = 0;
    let dtSec = 0;
    let computedHeading =
      raw.headingDeg !== null && raw.headingDeg !== undefined && Number.isFinite(raw.headingDeg) && raw.headingDeg >= 0
        ? Math.round(raw.headingDeg) % 360
        : prev?.heading ?? 0;

    if (prev) {
      dtSec = Math.max(0.4, (nowMs - prev.time) / 1000);
      stepMeters = haversineMeters(prev.lat, prev.lng, raw.lat, raw.lng);

      // 3. Reject impossible teleportation jumps (e.g., cell tower bounce)
      const impliedKmh = (stepMeters / 1000) / (dtSec / 3600);
      if (dtSec < 18 && stepMeters > 120 && impliedKmh > 135) {
        return {
          accepted: false,
          reason: "teleport_jump",
          lat: prev.lat,
          lng: prev.lng,
          accuracy: acc,
          speedKmh: prev.speedKmh,
          heading: prev.heading,
          stepKm: 0,
        };
      }

      // Calculate bearing from movement vector if GPS sensor didn't provide one
      if (
        (raw.headingDeg === null ||
          raw.headingDeg === undefined ||
          !Number.isFinite(raw.headingDeg) ||
          raw.headingDeg === 0) &&
        stepMeters >= 6
      ) {
        computedHeading = Math.round(computeBearingDeg(prev.lat, prev.lng, raw.lat, raw.lng));
      }

      if (rawSpeedKmh === 0 && stepMeters >= 5 && dtSec <= 45) {
        const est = Math.round(impliedKmh);
        if (est <= 110) rawSpeedKmh = est;
      }
    }

    if (rawSpeedKmh > 120 || rawSpeedKmh < 0) rawSpeedKmh = 0;

    // 4. Light smoothing to remove stationary GPS jitter while keeping driving responsiveness
    let finalLat = raw.lat;
    let finalLng = raw.lng;
    let acceptedStepKm = 0;

    if (prev) {
      const jitterThreshold = Math.min(18, Math.max(4, acc * 0.45));
      if (rawSpeedKmh <= 3 && stepMeters < jitterThreshold) {
        // Stationary / parked jitter clamp
        finalLat = prev.lat * 0.72 + raw.lat * 0.28;
        finalLng = prev.lng * 0.72 + raw.lng * 0.28;
      } else if (stepMeters < 60) {
        // Gentle moving smoothing
        const alpha = rawSpeedKmh >= 12 ? 0.82 : 0.65;
        finalLat = prev.lat * (1 - alpha) + raw.lat * alpha;
        finalLng = prev.lng * (1 - alpha) + raw.lng * alpha;
      }

      const movedKm = haversineMeters(prev.lat, prev.lng, finalLat, finalLng) / 1000;
      if (movedKm > 0.005 && movedKm < 2) {
        acceptedStepKm = movedKm;
      }
    }

    const roundedLat = Number(finalLat.toFixed(6));
    const roundedLng = Number(finalLng.toFixed(6));

    this.lastAccepted = {
      lat: roundedLat,
      lng: roundedLng,
      accuracy: acc,
      time: nowMs,
      isCoarse,
      speedKmh: rawSpeedKmh,
      heading: computedHeading,
    };

    return {
      accepted: true,
      lat: roundedLat,
      lng: roundedLng,
      accuracy: acc,
      speedKmh: rawSpeedKmh,
      heading: computedHeading,
      stepKm: acceptedStepKm,
    };
  }
}

/* ============================================================================
 * FREE REVERSE GEOCODING ("कौन गाड़ी किस Area में है") + STREET PLACE LABELS
 * ============================================================================ */

const AREA_CACHE_PREFIX = "nsta_area_geo_v1_";
const areaMemoryCache = new Map<string, string>();
const areaInFlight = new Map<string, Promise<string>>();

function getAreaGridKey(lat: number, lng: number): string {
  // ~110m grid cell so buses moving on the same stretch reuse cache instantaneously
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

function formatIndianAreaLabel(addr: Record<string, any> | undefined, displayName?: string): string {
  if (!addr && !displayName) return "";
  const primary =
    addr?.road ||
    addr?.neighbourhood ||
    addr?.suburb ||
    addr?.hamlet ||
    addr?.village ||
    addr?.quarter ||
    addr?.locality ||
    addr?.town ||
    "";
  const secondary =
    addr?.village ||
    addr?.suburb ||
    addr?.town ||
    addr?.city_district ||
    addr?.city ||
    addr?.county ||
    "";

  const cleanPrimary = String(primary || "").trim();
  const cleanSecondary = String(secondary || "").trim();

  if (cleanPrimary && cleanSecondary && cleanPrimary.toLowerCase() !== cleanSecondary.toLowerCase()) {
    return `${cleanPrimary}, ${cleanSecondary}`.slice(0, 48);
  }
  if (cleanPrimary) return cleanPrimary.slice(0, 48);
  if (cleanSecondary) return cleanSecondary.slice(0, 48);

  if (displayName) {
    return displayName
      .split(",")
      .slice(0, 2)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ")
      .slice(0, 48);
  }
  return "";
}

export function getCachedAreaName(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const key = getAreaGridKey(lat, lng);
  if (areaMemoryCache.has(key)) return areaMemoryCache.get(key) || "";
  try {
    const stored = sessionStorage.getItem(`${AREA_CACHE_PREFIX}${key}`);
    if (stored) {
      areaMemoryCache.set(key, stored);
      return stored;
    }
  } catch {}
  return "";
}

export async function resolveFreeAreaName(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)) {
    return "";
  }
  const key = getAreaGridKey(lat, lng);
  const cached = getCachedAreaName(lat, lng);
  if (cached) return cached;

  const existingPromise = areaInFlight.get(key);
  if (existingPromise) return existingPromise;

  const work = (async () => {
    let label = "";

    // 1. Primary: Free BigDataCloud Client Reverse Geocode (fast, CORS-friendly, no key)
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4500);
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}&localityLanguage=en`,
        { signal: ctrl.signal }
      );
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        const loc = String(data?.locality || "").trim();
        const city = String(data?.city || data?.principalSubdivision || "").trim();
        if (loc && city && loc.toLowerCase() !== city.toLowerCase()) {
          label = `${loc}, ${city}`.slice(0, 46);
        } else {
          label = (loc || city).slice(0, 46);
        }
      }
    } catch {}

    // 2. Secondary/Enrich: OpenStreetMap Nominatim (has road + village + mohalla names in India)
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=16&accept-language=hi,en`,
        {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        }
      );
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        const osmLabel = formatIndianAreaLabel(data?.address, data?.display_name);
        if (osmLabel) label = osmLabel;
      }
    } catch {}

    if (label) {
      areaMemoryCache.set(key, label);
      try {
        sessionStorage.setItem(`${AREA_CACHE_PREFIX}${key}`, label);
      } catch {}
    }
    return label;
  })().finally(() => {
    areaInFlight.delete(key);
  });

  areaInFlight.set(key, work);
  return work;
}

/* ============================================================================
 * FREE LOCAL STREET & VILLAGE PLACE LABELS OVERLAY (OVERPASS / OSM)
 * ============================================================================ */

export interface LocalStreetPlaceLabel {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "village" | "town" | "landmark" | "road";
}

const placeTileCache = new Map<string, LocalStreetPlaceLabel[]>();
const placeTileInFlight = new Map<string, Promise<LocalStreetPlaceLabel[]>>();

function getPlaceTileKey(lat: number, lng: number): string {
  // ~2.2km grid tile
  return `${(Math.round(lat * 45) / 45).toFixed(3)}_${(Math.round(lng * 45) / 45).toFixed(3)}`;
}

export async function fetchNearbyStreetLabels(
  lat: number,
  lng: number
): Promise<LocalStreetPlaceLabel[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)) {
    return [];
  }
  const tileKey = getPlaceTileKey(lat, lng);
  if (placeTileCache.has(tileKey)) return placeTileCache.get(tileKey) || [];

  try {
    const raw = sessionStorage.getItem(`nsta_places_${tileKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        placeTileCache.set(tileKey, parsed);
        return parsed;
      }
    }
  } catch {}

  const existing = placeTileInFlight.get(tileKey);
  if (existing) return existing;

  const req = (async () => {
    const results: LocalStreetPlaceLabel[] = [];
    const seen = new Set<string>();
    const addItem = (item: LocalStreetPlaceLabel) => {
      const norm = item.name.trim().toLowerCase();
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      results.push(item);
    };

    try {
      const query = `[out:json][timeout:6];(node["place"~"village|town|suburb|neighbourhood|hamlet|locality|quarter"](around:3500,${lat.toFixed(4)},${lng.toFixed(4)});node["amenity"~"school|college|hospital|bus_station|marketplace|place_of_worship|bank"](around:2500,${lat.toFixed(4)},${lng.toFixed(4)}););out body 45;`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6500);
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        const json = await res.json();
        const elements = Array.isArray(json?.elements) ? json.elements : [];
        for (const el of elements) {
          const tags = el?.tags || {};
          const name = String(tags["name:hi"] || tags.name || tags["name:en"] || "").trim();
          if (!name || !Number.isFinite(el?.lat) || !Number.isFinite(el?.lon)) continue;
          const placeTag = String(tags.place || "");
          const kind: LocalStreetPlaceLabel["kind"] =
            placeTag === "town" || placeTag === "suburb"
              ? "town"
              : placeTag
                ? "village"
                : "landmark";
          addItem({
            id: String(el.id),
            name: name.slice(0, 28),
            lat: Number(el.lat),
            lng: Number(el.lon),
            kind,
          });
        }
      }
    } catch {}

    // Always ensure at least the current area name appears if Overpass had sparse data
    if (results.length < 3) {
      const centerArea = await resolveFreeAreaName(lat, lng).catch(() => "");
      if (centerArea) {
        addItem({
          id: `area_${tileKey}`,
          name: centerArea,
          lat,
          lng,
          kind: "village",
        });
      }
    }

    const finalList = results.slice(0, 32);
    placeTileCache.set(tileKey, finalList);
    try {
      sessionStorage.setItem(`nsta_places_${tileKey}`, JSON.stringify(finalList));
    } catch {}
    return finalList;
  })().finally(() => {
    placeTileInFlight.delete(tileKey);
  });

  placeTileInFlight.set(tileKey, req);
  return req;
}

/* ============================================================================
 * FREE OSRM ROAD-SNAPPING FOR MOVING BUS BREADCRUMB TRAILS
 * ============================================================================ */

const osrmSnapCache = new Map<string, Array<{ lat: number; lng: number }>>();

export async function snapTrailPointsToRoad(
  points: Array<{ lat: number; lng: number }>
): Promise<Array<{ lat: number; lng: number }> | null> {
  if (!points || points.length < 3) return null;
  const recent = points.slice(-22);
  const last = recent[recent.length - 1];
  const first = recent[0];
  const cacheKey = `${recent.length}_${first.lat.toFixed(4)}_${first.lng.toFixed(4)}_${last.lat.toFixed(4)}_${last.lng.toFixed(4)}`;
  if (osrmSnapCache.has(cacheKey)) {
    return osrmSnapCache.get(cacheKey) || null;
  }

  try {
    const coordsStr = recent.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
    const radiuses = recent.map(() => "35").join(";");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(
      `https://router.project-osrm.org/match/v1/driving/${coordsStr}?overview=full&geometries=geojson&radiuses=${radiuses}&tidy=true`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const matchings = Array.isArray(data?.matchings) ? data.matchings : [];
    if (matchings.length === 0) return null;

    const snapped: Array<{ lat: number; lng: number }> = [];
    for (const m of matchings) {
      const coords = m?.geometry?.coordinates;
      if (Array.isArray(coords)) {
        for (const c of coords) {
          if (Array.isArray(c) && c.length >= 2 && Number.isFinite(c[1]) && Number.isFinite(c[0])) {
            snapped.push({ lat: Number(c[1]), lng: Number(c[0]) });
          }
        }
      }
    }
    if (snapped.length >= 2) {
      osrmSnapCache.set(cacheKey, snapped);
      if (osrmSnapCache.size > 40) {
        const firstKey = osrmSnapCache.keys().next().value;
        if (firstKey) osrmSnapCache.delete(firstKey);
      }
      return snapped;
    }
    return null;
  } catch {
    return null;
  }
}
