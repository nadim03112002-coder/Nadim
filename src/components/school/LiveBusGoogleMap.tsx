// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
} from "@vis.gl/react-google-maps";
import {
  Bus,
  Phone,
  Navigation,
  ExternalLink,
  Layers,
  Crosshair,
  Maximize2,
  MapPin,
  Radio,
  Loader2,
  Home,
  School as SchoolIcon,
  LocateFixed,
} from "lucide-react";
import type { BusLiveLocation } from "../../school-types";
import { safeOpenExternalUrl } from "../../utils/safeBrowserActions";
import { haversineMeters, formatDistanceShort } from "../../utils/busProximity";
import {
  fetchNearbyStreetLabels,
  getCachedAreaName,
  resolveFreeAreaName,
  snapTrailPointsToRoad,
  type LocalStreetPlaceLabel,
} from "../../utils/busLocationIntel";

export interface MapRouteStopOverlay {
  id?: string;
  stopName: string;
  pickupTime?: string;
  dropTime?: string;
  lat: number;
  lng: number;
  completed?: boolean;
}

export interface MapRouteOverlay {
  busId: string;
  busNumber?: string;
  routeName?: string;
  color?: string;
  stops: MapRouteStopOverlay[];
}

export interface MapHomePinOverlay {
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  isOwnHome?: boolean;
  distanceText?: string;
  show1KmRadius?: boolean;
}

export interface LiveBusGoogleMapProps {
  buses: BusLiveLocation[];
  selectedBusId?: string;
  onSelectBus?: (busId: string) => void;
  heightClass?: string;
  schoolId?: string;
  schoolCode?: string;
  routes?: MapRouteOverlay[];
  homePins?: MapHomePinOverlay[];
  schoolPin?: { name: string; lat: number; lng: number } | null;
  readOnly?: boolean;
  pinPickLabel?: string | null;
  onPickLocation?: (lat: number, lng: number) => void;
  showOpenInMapsButton?: boolean;
  connectBusToHome?: boolean;
  fitAllOnLoad?: boolean;
  onAreaNamesResolved?: (areaByBusId: Record<string, string>) => void;
  googleMapsApiKey?: string;
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

const DEFAULT_FALLBACK_CENTER: LatLngPoint = { lat: 22.5937, lng: 78.9629 };

const ROUTE_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ef4444", // red
];

function getRouteColor(index: number, customColor?: string): string {
  if (customColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(customColor.trim())) {
    return customColor.trim();
  }
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function isValidLatLng(lat: any, lng: any): boolean {
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

function hasValidCoords(bus?: BusLiveLocation | null): boolean {
  if (!bus) return false;
  return isValidLatLng(bus.latitude, bus.longitude);
}

function getPreferredGoogleMapsUrl(bus?: BusLiveLocation | null): string {
  if (!bus) return "";
  const liveShare = String(bus.liveShareUrl || "").trim();
  if (liveShare && bus.tripStatus === "started" && bus.liveShareActive !== false) {
    return liveShare;
  }
  if (hasValidCoords(bus)) {
    return `https://www.google.com/maps?q=${Number(bus.latitude)},${Number(bus.longitude)}`;
  }
  return "";
}

function getShortBusLabel(busNumber?: string): string {
  const raw = String(busNumber || "Bus").trim();
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) return parenMatch[1];
  return raw.split(" ")[0] || "Bus";
}

function escapeHtml(text?: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function build3DSchoolVanSvg(opts: {
  idKey: string;
  isLive: boolean;
  isSelected: boolean;
  size?: number;
}): string {
  const uid = String(opts.idKey || "van").replace(/[^a-zA-Z0-9_-]/g, "") || "van";
  const w = opts.size || (opts.isSelected ? 64 : 56);
  const h = Math.round(w * 0.82);
  const bodyTop = opts.isSelected ? "#fde047" : "#fbbf24";
  const bodySide = opts.isSelected ? "#f59e0b" : "#d97706";
  const bodyFront = opts.isSelected ? "#fcd34d" : "#f59e0b";
  const bodyDark = "#b45309";
  const strokeMain = opts.isSelected ? "#ffffff" : "#fef3c7";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 120 98" style="overflow:visible;filter:drop-shadow(0 8px 10px rgba(2,6,23,0.48));">
      <defs>
        <linearGradient id="roof_${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="65%" stop-color="${bodyTop}"/>
          <stop offset="100%" stop-color="${bodySide}"/>
        </linearGradient>
        <linearGradient id="side_${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${bodyFront}"/>
          <stop offset="100%" stop-color="${bodyDark}"/>
        </linearGradient>
        <linearGradient id="glass_${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#bae6fd"/>
          <stop offset="40%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="beam_${uid}" x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0%" stop-color="rgba(254,240,138,0.75)"/>
          <stop offset="100%" stop-color="rgba(254,240,138,0)"/>
        </linearGradient>
      </defs>

      <!-- 3D Ground Contact Shadow -->
      <ellipse cx="58" cy="84" rx="44" ry="11" fill="rgba(2,6,23,0.42)"/>
      ${opts.isLive ? `<ellipse cx="58" cy="83" rx="48" ry="13" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.7"/>` : ""}

      <!-- Live Headlight Cones -->
      ${opts.isLive ? `
        <polygon points="97,65 128,74 122,86 91,71" fill="url(#beam_${uid})"/>
        <polygon points="108,58 134,65 129,74 103,64" fill="url(#beam_${uid})"/>
      ` : ""}

      <!-- Far/Back Wheels Hint -->
      <ellipse cx="32" cy="73" rx="7" ry="9" fill="#0f172a"/>

      <!-- Left Isometric Body Wall (Side) -->
      <path d="M16,36 L58,56 L58,77 L16,57 Q12,55 12,50 L12,41 Q12,37 16,36 Z" fill="url(#side_${uid})" stroke="${strokeMain}" stroke-width="1.2" stroke-linejoin="round"/>

      <!-- Front Isometric Nose & Hood -->
      <path d="M58,56 L102,38 L108,46 Q111,51 110,57 L109,62 L76,77 Q66,81 58,77 Z" fill="${bodyFront}" stroke="${strokeMain}" stroke-width="1.2" stroke-linejoin="round"/>

      <!-- Front Lower Bumper -->
      <path d="M58,74 L109,57 L110,63 L75,80 Q65,83 58,79 Z" fill="#1e293b" stroke="#94a3b8" stroke-width="0.9"/>

      <!-- 3D Roof Top Plane -->
      <path d="M14,35 L58,16 Q63,14 68,16 L96,29 L58,51 Q54,53 49,50 L14,35 Z" fill="url(#roof_${uid})" stroke="${strokeMain}" stroke-width="1.4" stroke-linejoin="round"/>

      <!-- Roof School Van AC Vent & Amber Beacon -->
      <path d="M40,29 L56,22 L66,27 L50,34 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.9"/>
      <ellipse cx="75" cy="24" rx="4.5" ry="2.5" fill="${opts.isLive ? "#10b981" : "#f97316"}" stroke="#ffffff" stroke-width="1"/>

      <!-- Panoramic Front Windshield (Tilted 3D) -->
      <path d="M59,49 L95,31 L104,40 L66,58 Z" fill="url(#glass_${uid})" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/>
      <!-- Windshield Glass Reflection -->
      <polygon points="67,48 77,43 81,50 71,55" fill="rgba(255,255,255,0.42)"/>

      <!-- Side Windows (3D Recessed Glass Strip) -->
      <polygon points="18,40 31,46 31,55 18,49" fill="url(#glass_${uid})" stroke="#0f172a" stroke-width="1"/>
      <polygon points="34,47 47,53 47,62 34,56" fill="url(#glass_${uid})" stroke="#0f172a" stroke-width="1"/>
      <polygon points="49,54 56,57 56,66 49,63" fill="url(#glass_${uid})" stroke="#0f172a" stroke-width="1"/>

      <!-- Navy Safety Stripe along Side -->
      <polygon points="14,52 57,72 57,75 14,55" fill="#1e3a8a"/>

      <!-- Front Grille & Headlights -->
      <polygon points="82,61 101,53 101,59 82,67" fill="#0f172a" stroke="#64748b" stroke-width="0.8"/>
      <line x1="86" y1="60" x2="86" y2="65" stroke="#94a3b8" stroke-width="1"/>
      <line x1="91" y1="58" x2="91" y2="63" stroke="#94a3b8" stroke-width="1"/>
      <line x1="96" y1="56" x2="96" y2="61" stroke="#94a3b8" stroke-width="1"/>

      <!-- Dual Headlights -->
      <ellipse cx="75" cy="67" rx="4" ry="2.8" fill="${opts.isLive ? "#fef08a" : "#fde68a"}" stroke="#ffffff" stroke-width="0.9"/>
      <ellipse cx="105" cy="54" rx="3.4" ry="2.4" fill="${opts.isLive ? "#fef08a" : "#fde68a"}" stroke="#ffffff" stroke-width="0.9"/>

      <!-- Side Mirror -->
      <rect x="57" y="45" width="4" height="6" rx="1.2" fill="#0f172a" stroke="#e2e8f0" stroke-width="0.7"/>

      <!-- 3D Rear Tire -->
      <g transform="translate(26,64)">
        <ellipse cx="0" cy="0" rx="7.5" ry="9.5" fill="#090d16" stroke="#334155" stroke-width="1.2"/>
        <ellipse cx="1" cy="0" rx="3.8" ry="5.2" fill="#cbd5e1"/>
        <ellipse cx="1.5" cy="0" rx="1.6" ry="2.2" fill="#475569"/>
      </g>

      <!-- 3D Front Tire -->
      <g transform="translate(50,75)">
        <ellipse cx="0" cy="0" rx="8" ry="10" fill="#090d16" stroke="#334155" stroke-width="1.2"/>
        <ellipse cx="1" cy="0" rx="4.2" ry="5.5" fill="#cbd5e1"/>
        <ellipse cx="1.6" cy="0" rx="1.8" ry="2.4" fill="#475569"/>
      </g>
    </svg>
  `;
}

/* ============================================================================
 * 1. INTERACTIVE LEAFLET + OPENSTREETMAP + SATELLITE HYBRID ENGINE (ZERO COST)
 * ============================================================================ */

interface LeafletMapProps {
  busesWithCoords: BusLiveLocation[];
  selectedBus: BusLiveLocation | null;
  routes: MapRouteOverlay[];
  homePins: MapHomePinOverlay[];
  schoolPin?: { name: string; lat: number; lng: number } | null;
  trailByBus: Record<string, LatLngPoint[]>;
  onSelectBus?: (busId: string) => void;
  heightClass: string;
  readOnly?: boolean;
  pinPickLabel?: string | null;
  onPickLocation?: (lat: number, lng: number) => void;
  showOpenInMapsButton?: boolean;
  connectBusToHome?: boolean;
  fitAllOnLoad?: boolean;
  areaNameByBusId?: Record<string, string>;
  stoppedLabelByBusId?: Record<string, string>;
  canSwitchToGoogle?: boolean;
  onSwitchEngine?: () => void;
}

const LeafletFleetMap: React.FC<LeafletMapProps> = ({
  busesWithCoords,
  selectedBus,
  routes,
  homePins,
  schoolPin,
  trailByBus,
  onSelectBus,
  heightClass,
  readOnly = false,
  pinPickLabel,
  onPickLocation,
  showOpenInMapsButton = true,
  connectBusToHome = false,
  fitAllOnLoad = false,
  areaNameByBusId = {},
  stoppedLabelByBusId = {},
  canSwitchToGoogle = false,
  onSwitchEngine,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const placesLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const trailsLayerRef = useRef<L.LayerGroup | null>(null);
  const homesLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const initialFitDoneRef = useRef<boolean>(false);
  const onPickRef = useRef(onPickLocation);
  const pinPickActiveRef = useRef(Boolean(pinPickLabel));

  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [followSelected, setFollowSelected] = useState<boolean>(!fitAllOnLoad);
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [nearbyPlaces, setNearbyPlaces] = useState<LocalStreetPlaceLabel[]>([]);
  const [snappedTrailByBus, setSnappedTrailByBus] = useState<Record<string, LatLngPoint[]>>({});
  const lastPlaceFetchKeyRef = useRef<string>("");
  const lastSnapAtRef = useRef<Record<string, number>>({});

  onPickRef.current = onPickLocation;
  pinPickActiveRef.current = Boolean(pinPickLabel);

  // Build route color map per busId
  const colorByBusId = useMemo(() => {
    const map = new Map<string, string>();
    routes.forEach((r, idx) => {
      map.set(r.busId, getRouteColor(idx, r.color));
    });
    busesWithCoords.forEach((b, idx) => {
      if (!map.has(b.busId)) {
        map.set(b.busId, getRouteColor(idx));
      }
    });
    return map;
  }, [routes, busesWithCoords]);

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const firstRouteStop = routes
      .flatMap((r) => r.stops || [])
      .find((s) => isValidLatLng(s.lat, s.lng));

    const hasRealStartAnchor = Boolean(
      (selectedBus && hasValidCoords(selectedBus)) ||
        busesWithCoords[0] ||
        firstRouteStop ||
        (homePins[0] && isValidLatLng(homePins[0].lat, homePins[0].lng)) ||
        (schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng))
    );

    const startCenter: [number, number] =
      selectedBus && hasValidCoords(selectedBus)
        ? [Number(selectedBus.latitude), Number(selectedBus.longitude)]
        : busesWithCoords[0]
          ? [Number(busesWithCoords[0].latitude), Number(busesWithCoords[0].longitude)]
          : firstRouteStop
            ? [Number(firstRouteStop.lat), Number(firstRouteStop.lng)]
            : homePins[0] && isValidLatLng(homePins[0].lat, homePins[0].lng)
              ? [homePins[0].lat, homePins[0].lng]
              : schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng)
                ? [schoolPin.lat, schoolPin.lng]
                : [DEFAULT_FALLBACK_CENTER.lat, DEFAULT_FALLBACK_CENTER.lng];

    const map = L.map(el, {
      center: startCenter,
      zoom: !hasRealStartAnchor ? 5 : busesWithCoords.length > 1 ? 13 : 15,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    tileLayerGroupRef.current = L.layerGroup().addTo(map);
    placesLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    trailsLayerRef.current = L.layerGroup().addTo(map);
    homesLayerRef.current = L.layerGroup().addTo(map);
    busesLayerRef.current = L.layerGroup().addTo(map);

    map.on("dragstart", () => {
      setFollowSelected(false);
    });

    map.on("moveend", () => {
      try {
        const c = map.getCenter();
        const key = `${(Math.round(c.lat * 45) / 45).toFixed(3)}_${(Math.round(c.lng * 45) / 45).toFixed(3)}`;
        if (lastPlaceFetchKeyRef.current !== key) {
          lastPlaceFetchKeyRef.current = key;
          void fetchNearbyStreetLabels(c.lat, c.lng).then((items) => {
            if (items.length > 0) setNearbyPlaces(items);
          });
        }
      } catch {}
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (pinPickActiveRef.current && onPickRef.current) {
        onPickRef.current(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        );
      }
    });

    mapRef.current = map;

    if (hasRealStartAnchor) {
      const cKey = `${(Math.round(startCenter[0] * 45) / 45).toFixed(3)}_${(Math.round(startCenter[1] * 45) / 45).toFixed(3)}`;
      lastPlaceFetchKeyRef.current = cKey;
      void fetchNearbyStreetLabels(startCenter[0], startCenter[1]).then((items) => {
        if (items.length > 0) setNearbyPlaces(items);
      });
    }

    // Auto-fix tile sizing whenever modal/panel opens or resizes
    const ro = new ResizeObserver(() => {
      try {
        map.invalidateSize({ animate: false });
      } catch {}
    });
    ro.observe(el);
    const t1 = setTimeout(() => {
      try {
        map.invalidateSize({ animate: false });
      } catch {}
    }, 250);

    return () => {
      clearTimeout(t1);
      ro.disconnect();
      busMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Switch Google-Style Street Map (Carto Voyager + OSM Fallback) vs Satellite Hybrid
  useEffect(() => {
    const group = tileLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (mapType === "roadmap") {
      // Crisp Google-Maps-style Voyager roads & neighborhood labels (100% Free)
      const carto = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }
      );
      let fellBackToOsm = false;
      carto.on("tileerror", () => {
        if (fellBackToOsm) return;
        fellBackToOsm = true;
        try {
          group.clearLayers();
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap",
          }).addTo(group);
        } catch {}
      });
      carto.addTo(group);
    } else {
      // Free Esri World Satellite Imagery + Road & Place Labels
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "&copy; Esri World Imagery",
        }
      ).addTo(group);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          opacity: 0.85,
        }
      ).addTo(group);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
        }
      ).addTo(group);
    }
  }, [mapType]);

  // 2b. Plot Free Local Village / Mohalla / Landmark Labels on Street View
  useEffect(() => {
    const layer = placesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (nearbyPlaces.length === 0) return;

    nearbyPlaces.forEach((p) => {
      const isTown = p.kind === "town";
      const isVillage = p.kind === "village";
      const bg =
        mapType === "hybrid"
          ? "rgba(2,6,23,0.78)"
          : isTown
            ? "rgba(255,255,255,0.92)"
            : "rgba(255,255,255,0.86)";
      const textClr =
        mapType === "hybrid"
          ? isTown
            ? "#fde68a"
            : "#e2e8f0"
          : isTown
            ? "#1e1b4b"
            : isVillage
              ? "#0f172a"
              : "#334155";
      const borderClr =
        mapType === "hybrid"
          ? "rgba(255,255,255,0.22)"
          : "rgba(15,23,42,0.16)";
      const icon = L.divIcon({
        className: "nsta-local-place-label",
        html: `<div style="transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap;font-size:${isTown ? "11px" : "10px"};font-weight:${isTown || isVillage ? "800" : "700"};color:${textClr};background:${bg};border:1px solid ${borderClr};padding:1px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.14);letter-spacing:0.01em;">${isVillage || isTown ? "📍 " : ""}${escapeHtml(p.name)}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([p.lat, p.lng], {
        icon,
        interactive: false,
        zIndexOffset: isTown ? 80 : 40,
      }).addTo(layer);
    });
  }, [nearbyPlaces, mapType]);

  // 3. Draw Planned Routes & Stop Pins + School Campus Pin
  useEffect(() => {
    const layer = routesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    routes.forEach((route, rIdx) => {
      const validStops = (route.stops || []).filter((s) =>
        isValidLatLng(s.lat, s.lng)
      );
      if (validStops.length === 0) return;

      const color = colorByBusId.get(route.busId) || getRouteColor(rIdx, route.color);
      const isSelectedRoute = !selectedBus || selectedBus.busId === route.busId;

      if (validStops.length >= 2) {
        const latlngs = validStops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]);
        // Soft casing line for clarity on satellite & road maps
        L.polyline(latlngs, {
          color: "#0f172a",
          weight: isSelectedRoute ? 7 : 5,
          opacity: isSelectedRoute ? 0.55 : 0.3,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layer);

        L.polyline(latlngs, {
          color,
          weight: isSelectedRoute ? 4 : 2.5,
          opacity: isSelectedRoute ? 0.92 : 0.55,
          dashArray: isSelectedRoute ? undefined : "6, 6",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layer);
      }

      // Draw each Stop Pin with Number & Readable Name Badge
      validStops.forEach((stop, sIdx) => {
        const isLastSchoolStop =
          sIdx === validStops.length - 1 &&
          /school|campus|gate|विद्यालय/i.test(stop.stopName || "");
        const bg = stop.completed
          ? "#10b981"
          : isLastSchoolStop
            ? "#4f46e5"
            : color;
        const badgeText = stop.completed ? "✓" : isLastSchoolStop ? "🏫" : String(sIdx + 1);
        const icon = L.divIcon({
          className: "nsta-stop-div-icon",
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-85%);pointer-events:auto;">
              <div style="background:rgba(15,23,42,0.92);color:#f8fafc;border:1px solid ${bg};padding:2px 6px;border-radius:8px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.45);margin-bottom:3px;letter-spacing:0.01em;">
                ${escapeHtml(stop.stopName)}${stop.pickupTime ? ` <span style="color:#94a3b8;font-weight:600;">${escapeHtml(stop.pickupTime)}</span>` : ""}
              </div>
              <div style="width:22px;height:22px;border-radius:999px;background:${bg};color:${stop.completed ? "#052e16" : "#ffffff"};border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;box-shadow:0 3px 8px rgba(0,0,0,0.5);">
                ${badgeText}
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([Number(stop.lat), Number(stop.lng)], {
          icon,
          zIndexOffset: isSelectedRoute ? 250 : 120,
        });
        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:160px;color:#0f172a;">
            <div style="font-weight:900;font-size:13px;">Stop #${sIdx + 1}: ${escapeHtml(stop.stopName)}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;">${escapeHtml(route.busNumber || route.routeName || "")}</div>
            ${stop.pickupTime ? `<div style="font-size:11px;margin-top:4px;">🌅 Pickup: <b>${escapeHtml(stop.pickupTime)}</b>${stop.dropTime ? ` • 🌇 Drop: <b>${escapeHtml(stop.dropTime)}</b>` : ""}</div>` : ""}
            <div style="font-size:11px;margin-top:4px;font-weight:700;color:${stop.completed ? "#059669" : "#d97706"};">
              ${stop.completed ? "✓ स्टॉप पार हो गया" : "⏳ आने वाला स्टॉप"}
            </div>
          </div>
        `);
        marker.addTo(layer);
      });
    });

    // Optional School Campus Pin
    if (schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng)) {
      const sIcon = L.divIcon({
        className: "nsta-school-div-icon",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-85%);">
            <div style="background:#312e81;color:#fde68a;border:1.5px solid #fbbf24;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);margin-bottom:3px;">
              🏫 ${escapeHtml(schoolPin.name)}
            </div>
            <div style="width:28px;height:28px;border-radius:10px;background:#4f46e5;color:#ffffff;border:2px solid #fbbf24;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px rgba(0,0,0,0.5);">
              🏫
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([schoolPin.lat, schoolPin.lng], { icon: sIcon, zIndexOffset: 300 }).addTo(layer);
    }
  }, [routes, selectedBus?.busId, schoolPin, colorByBusId]);

  // 4. Draw Home Pins (+ 1 KM Geofence Circle + Optional Bus-to-Home Live Connector)
  useEffect(() => {
    const layer = homesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    homePins.forEach((pin) => {
      if (!isValidLatLng(pin.lat, pin.lng)) return;

      if (pin.show1KmRadius) {
        L.circle([pin.lat, pin.lng], {
          radius: 1000,
          color: "#10b981",
          weight: 1.5,
          dashArray: "6, 6",
          fillColor: "#10b981",
          fillOpacity: 0.08,
        }).addTo(layer);
      }

      const bg = pin.isOwnHome ? "#059669" : "#0ea5e9";
      const icon = L.divIcon({
        className: "nsta-home-div-icon",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-90%);">
            <div style="background:${pin.isOwnHome ? "#064e3b" : "#0f172a"};color:#ffffff;border:1.5px solid ${bg};padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);margin-bottom:3px;">
              🏠 ${escapeHtml(pin.label)}${pin.distanceText ? ` • <span style="color:#fcd34d;">${escapeHtml(pin.distanceText)}</span>` : ""}
            </div>
            <div style="width:30px;height:30px;border-radius:999px;background:${bg};color:#ffffff;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.55);">
              🏠
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pin.lat, pin.lng], {
        icon,
        zIndexOffset: pin.isOwnHome ? 450 : 280,
      });
      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:150px;color:#0f172a;">
          <div style="font-weight:900;font-size:13px;">🏠 ${escapeHtml(pin.label)}</div>
          ${pin.sublabel ? `<div style="font-size:11px;color:#475569;margin-top:2px;">${escapeHtml(pin.sublabel)}</div>` : ""}
          ${pin.distanceText ? `<div style="font-size:12px;font-weight:800;color:#059669;margin-top:4px;">बस से दूरी: ${escapeHtml(pin.distanceText)}</div>` : ""}
          ${pin.show1KmRadius ? `<div style="font-size:10px;color:#047857;margin-top:3px;">🔔 हरा घेरा = 1 KM ऑटो अलर्ट ज़ोन</div>` : ""}
        </div>
      `);
      marker.addTo(layer);

      // Connect selected bus directly to Own Home with dashed live distance line
      if (connectBusToHome && pin.isOwnHome && selectedBus && hasValidCoords(selectedBus)) {
        const bLat = Number(selectedBus.latitude);
        const bLng = Number(selectedBus.longitude);
        const distM = haversineMeters(bLat, bLng, pin.lat, pin.lng);
        L.polyline(
          [
            [bLat, bLng],
            [pin.lat, pin.lng],
          ],
          {
            color: distM <= 1000 ? "#10b981" : "#fbbf24",
            weight: 3,
            dashArray: "8, 8",
            opacity: 0.9,
          }
        ).addTo(layer);
      }
    });
  }, [homePins, connectBusToHome, selectedBus?.latitude, selectedBus?.longitude, selectedBus?.busId]);

  // 5. Snap Active Bus Trails onto Real Roads (Free OSRM) + Render Clean Polylines
  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    Object.entries(trailByBus).forEach(([busId, pts]) => {
      if (!pts || pts.length < 3) return;
      const lastSnap = lastSnapAtRef.current[busId] || 0;
      if (now - lastSnap < 10_000) return;
      lastSnapAtRef.current[busId] = now;
      void snapTrailPointsToRoad(pts).then((snapped) => {
        if (!cancelled && snapped && snapped.length >= 2) {
          setSnappedTrailByBus((prev) => ({ ...prev, [busId]: snapped }));
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [trailByBus]);

  useEffect(() => {
    const layer = trailsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    Object.entries(trailByBus).forEach(([busId, rawPts]) => {
      const snapped = snappedTrailByBus[busId];
      const pts = snapped && snapped.length >= 2 ? snapped : rawPts;
      if (!pts || pts.length < 2) return;
      const isSelected = selectedBus?.busId === busId;
      const color = colorByBusId.get(busId) || "#f59e0b";
      L.polyline(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: "#0f172a",
          weight: isSelected ? 7 : 5,
          opacity: 0.4,
          lineCap: "round",
          lineJoin: "round",
        }
      ).addTo(layer);
      L.polyline(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: isSelected ? "#fbbf24" : color,
          weight: isSelected ? 4.5 : 3,
          opacity: isSelected ? 0.96 : 0.72,
          lineCap: "round",
          lineJoin: "round",
        }
      ).addTo(layer);
    });
  }, [trailByBus, snappedTrailByBus, selectedBus?.busId, colorByBusId]);

  // 6. Smoothly Create / Update All Live Bus Markers
  useEffect(() => {
    const layer = busesLayerRef.current;
    if (!layer) return;

    const activeIds = new Set(busesWithCoords.map((b) => b.busId));

    // Remove stale bus markers
    busMarkersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        layer.removeLayer(marker);
        busMarkersRef.current.delete(id);
      }
    });

    busesWithCoords.forEach((bus, idx) => {
      const isLive = bus.tripStatus === "started";
      const isSelected = selectedBus?.busId === bus.busId;
      const color = colorByBusId.get(bus.busId) || getRouteColor(idx);
      const pillBg = isSelected ? "#f59e0b" : isLive ? color : "#334155";
      const pillText = isSelected ? "#020617" : "#ffffff";
      const shortName = getShortBusLabel(bus.busNumber);
      const speedText = isLive
        ? stoppedLabelByBusId[bus.busId]
          ? ` • ⏸ ${stoppedLabelByBusId[bus.busId]}`
          : ` • ${bus.speed || 0} km/h`
        : " • Idle";
      const areaLabel = areaNameByBusId[bus.busId] || "";
      const stoppedNote = isLive ? stoppedLabelByBusId[bus.busId] || "" : "";
      const headingDeg = Number.isFinite(Number(bus.heading)) ? Number(bus.heading) : 0;

      const vanSvg = build3DSchoolVanSvg({
        idKey: bus.busId || String(idx),
        isLive,
        isSelected,
        size: isSelected ? 64 : 56,
      });

      const icon = L.divIcon({
        className: "nsta-bus-div-icon",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-82%);cursor:pointer;user-select:none;">
            <div style="background:${pillBg};color:${pillText};border:2px solid #ffffff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.45);display:flex;align-items:center;gap:5px;margin-bottom:2px;">
              ${isLive ? `<span style="width:7px;height:7px;border-radius:999px;background:#ffffff;display:inline-block;box-shadow:0 0 8px #ffffff;"></span>` : ""}
              <span>${escapeHtml(shortName)}${escapeHtml(speedText)}</span>
              ${isLive && !stoppedNote && headingDeg > 0 ? `<span style="display:inline-block;transform:rotate(${headingDeg}deg);font-size:10px;line-height:1;">▲</span>` : ""}
            </div>
            ${areaLabel ? `<div style="background:rgba(2,6,23,0.88);color:#fde68a;border:1px solid rgba(251,191,36,0.45);padding:1px 6px;border-radius:6px;font-size:9px;font-weight:800;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;box-shadow:0 2px 6px rgba(0,0,0,0.45);">📍 ${escapeHtml(areaLabel)}</div>` : ""}
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              ${vanSvg}
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const preferredMapsUrl = getPreferredGoogleMapsUrl(bus);
      const canOpenExternalMaps = Boolean(showOpenInMapsButton) && Boolean(preferredMapsUrl);
      const isLiveShareUrl = Boolean(bus.liveShareUrl && isLive && bus.liveShareActive !== false);
      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:210px;color:#0f172a;line-height:1.4;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <div style="font-weight:900;font-size:13px;">${escapeHtml(bus.busNumber)}</div>
              <div style="font-size:11px;color:#475569;">${escapeHtml(bus.route)}</div>
            </div>
            <span style="padding:2px 7px;border-radius:999px;font-size:10px;font-weight:900;background:${isLive ? (stoppedNote ? "#fef3c7" : "#d1fae5") : "#e2e8f0"};color:${isLive ? (stoppedNote ? "#92400e" : "#065f46") : "#475569"};white-space:nowrap;">
              ${isLive ? (stoppedNote ? `⏸ ${escapeHtml(stoppedNote)}` : `LIVE • ${bus.speed || 0} km/h`) : "Idle"}
            </span>
          </div>
          <div style="background:#f1f5f9;border-radius:8px;padding:7px;margin-top:8px;font-size:11px;">
            ${areaLabel ? `<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:3px;"><span style="color:#64748b;">मौजूदा एरिया:</span><span style="font-weight:800;color:#b45309;">📍 ${escapeHtml(areaLabel)}</span></div>` : ""}
            ${stoppedNote ? `<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:3px;"><span style="color:#64748b;">स्थिति:</span><span style="font-weight:800;color:#b45309;">⏸ यहाँ ${escapeHtml(stoppedNote)}</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;gap:8px;">
              <span style="color:#64748b;">ड्राइवर:</span>
              <span style="font-weight:800;">${escapeHtml(bus.driverName || "—")}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:8px;margin-top:3px;">
              <span style="color:#64748b;">करंट स्टॉप:</span>
              <span style="font-weight:800;color:#4338ca;">${escapeHtml(bus.currentStop || "Depot")}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:8px;margin-top:3px;">
              <span style="color:#64748b;">स्टॉप्स प्रगति:</span>
              <span style="font-weight:800;color:#059669;">${bus.completedStops?.length || 0} / ${bus.totalStops || 0}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            ${
              bus.driverPhone
                ? `<a href="tel:${escapeHtml(bus.driverPhone)}" style="flex:1;padding:6px 8px;border-radius:8px;background:#059669;color:#ffffff;font-weight:800;font-size:11px;text-align:center;text-decoration:none;">📞 Call Driver</a>`
                : ""
            }
            ${
              canOpenExternalMaps
                ? `<a href="${escapeHtml(preferredMapsUrl)}" target="_blank" rel="noopener noreferrer" style="flex:1;padding:6px 8px;border-radius:8px;background:#4f46e5;color:#ffffff;font-weight:800;font-size:11px;text-align:center;text-decoration:none;">${isLiveShareUrl ? "🔴 Live G-Maps" : "🗺️ Google Maps"}</a>`
                : ""
            }
          </div>
        </div>
      `;

      const existing = busMarkersRef.current.get(bus.busId);
      const pos: [number, number] = [Number(bus.latitude), Number(bus.longitude)];

      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(icon);
        existing.setZIndexOffset(isSelected ? 1000 : isLive ? 600 : 350);
        existing.setPopupContent(popupHtml);
      } else {
        const marker = L.marker(pos, {
          icon,
          zIndexOffset: isSelected ? 1000 : isLive ? 600 : 350,
        });
        marker.bindPopup(popupHtml, { maxWidth: 260 });
        marker.on("click", () => {
          if (!readOnly && onSelectBus) {
            onSelectBus(bus.busId);
          }
        });
        marker.addTo(layer);
        busMarkersRef.current.set(bus.busId, marker);
      }
    });
  }, [busesWithCoords, selectedBus?.busId, colorByBusId, onSelectBus, readOnly, showOpenInMapsButton, areaNameByBusId, stoppedLabelByBusId]);

  const hadSelectedCoordsRef = useRef<boolean>(hasValidCoords(selectedBus));

  // 7. Smooth Auto-Follow Selected Bus (skipped during initial fitAllOnLoad so all fleet buses stay visible)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (fitAllOnLoad && !followSelected) return;
    const validNow = Boolean(selectedBus && hasValidCoords(selectedBus));
    if (!validNow) {
      hadSelectedCoordsRef.current = false;
      return;
    }
    if (pinPickLabel) return; // Don't steal camera while admin is pinning a stop

    const justAcquiredFirstFix = !hadSelectedCoordsRef.current;
    hadSelectedCoordsRef.current = true;
    if (justAcquiredFirstFix && !followSelected && !fitAllOnLoad) {
      setFollowSelected(true);
    }
    if (!followSelected && (!justAcquiredFirstFix || fitAllOnLoad)) return;

    const target: [number, number] = [Number(selectedBus.latitude), Number(selectedBus.longitude)];
    const currentZoom = map.getZoom();
    if (justAcquiredFirstFix || currentZoom < 14) {
      map.setView(target, Math.max(currentZoom, 16), { animate: true });
    } else {
      map.panTo(target, { animate: true, duration: 0.45 });
    }
  }, [
    followSelected,
    fitAllOnLoad,
    selectedBus?.busId,
    selectedBus?.latitude,
    selectedBus?.longitude,
    pinPickLabel,
    busesWithCoords.length,
  ]);

  // 8. Fit Bounds on First Load or "All" Click (includes Buses + Home Pins + Route Stops)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (initialFitDoneRef.current && fitTrigger === 0) return;

    const points: [number, number][] = [];
    busesWithCoords.forEach((b) => points.push([Number(b.latitude), Number(b.longitude)]));
    homePins.forEach((h) => {
      if (isValidLatLng(h.lat, h.lng)) points.push([h.lat, h.lng]);
    });
    if (points.length <= 1) {
      routes.forEach((r) => {
        (r.stops || []).forEach((s) => {
          if (isValidLatLng(s.lat, s.lng)) points.push([s.lat, s.lng]);
        });
      });
    }
    if (schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng)) {
      points.push([schoolPin.lat, schoolPin.lng]);
    }

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      initialFitDoneRef.current = true;
      return;
    }

    try {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 16 });
      initialFitDoneRef.current = true;
    } catch {}
  }, [fitTrigger, busesWithCoords.length, homePins.length, routes.length]);

  const openTarget =
    selectedBus && hasValidCoords(selectedBus)
      ? { lat: Number(selectedBus.latitude), lng: Number(selectedBus.longitude) }
      : busesWithCoords[0]
        ? { lat: Number(busesWithCoords[0].latitude), lng: Number(busesWithCoords[0].longitude) }
        : homePins[0] && isValidLatLng(homePins[0].lat, homePins[0].lng)
          ? { lat: homePins[0].lat, lng: homePins[0].lng }
          : null;

  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-700/40 bg-slate-900`}
    >
      {/* Leaflet Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full z-0 ${pinPickLabel ? "cursor-crosshair" : ""}`}
      />

      {/* Pin-Picker Mode Banner (Admin) */}
      {pinPickLabel && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[450] px-4 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs shadow-2xl border-2 border-white flex items-center gap-2 whitespace-nowrap max-w-[92%] truncate">
          <LocateFixed size={15} className="shrink-0 animate-pulse" />
          <span className="truncate">
            मैप पर टैप करें: "{pinPickLabel}" की लोकेशन सेट करने के लिए
          </span>
        </div>
      )}

      {/* Top-Left Live Bus / Area Pill */}
      {!pinPickLabel && (
        <div className="absolute top-2.5 left-2.5 z-[400] flex flex-wrap items-center gap-1.5 pointer-events-none max-w-[60%]">
          {selectedBus && hasValidCoords(selectedBus) ? (
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5 backdrop-blur-md">
              {selectedBus.tripStatus === "started" ? (
                <Radio size={12} className="text-emerald-400 animate-pulse shrink-0" />
              ) : (
                <MapPin size={12} className="text-amber-400 shrink-0" />
              )}
              <span className="truncate">{getShortBusLabel(selectedBus.busNumber)}</span>
              {selectedBus.tripStatus === "started" && stoppedLabelByBusId[selectedBus.busId] ? (
                <span className="text-amber-300 font-mono shrink-0">
                  ⏸ {stoppedLabelByBusId[selectedBus.busId]}
                </span>
              ) : (
                <span className="text-amber-300 font-mono shrink-0">
                  {selectedBus.speed || 0} km/h
                </span>
              )}
              {areaNameByBusId[selectedBus.busId] && (
                <span className="hidden sm:inline text-emerald-300 truncate max-w-[140px]">
                  • {areaNameByBusId[selectedBus.busId]}
                </span>
              )}
            </div>
          ) : (
            <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-500/40 text-[11px] font-bold text-amber-200 shadow-lg flex items-center gap-1.5 backdrop-blur-md">
              <Navigation size={12} className="text-amber-400 shrink-0" />
              <span>Driver GPS का इंतज़ार है...</span>
            </div>
          )}
        </div>
      )}

      {/* Top-Right Interactive Map Controls */}
      <div className="absolute top-2.5 right-2.5 z-[400] flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() =>
            setMapType((prev) => (prev === "roadmap" ? "hybrid" : "roadmap"))
          }
          className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition"
          title="Switch Street / Satellite Hybrid View"
        >
          <Layers size={13} className="text-sky-400" />
          <span>{mapType === "roadmap" ? "Satellite" : "Street Map"}</span>
        </button>

        {selectedBus && hasValidCoords(selectedBus) && (
          <button
            type="button"
            onClick={() => {
              const nextFollow = !followSelected;
              setFollowSelected(nextFollow);
              if (nextFollow && mapRef.current) {
                mapRef.current.setView(
                  [Number(selectedBus.latitude), Number(selectedBus.longitude)],
                  Math.max(mapRef.current.getZoom(), 16),
                  { animate: true }
                );
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition ${
              followSelected
                ? "bg-amber-500 text-slate-950 border-amber-300"
                : "bg-slate-950/90 hover:bg-slate-800 text-slate-200 border-slate-700"
            }`}
            title="Auto-Follow Live Bus"
          >
            <Crosshair size={13} />
            <span className="hidden sm:inline">
              {followSelected ? "Following" : "Follow"}
            </span>
          </button>
        )}

        {(busesWithCoords.length > 1 || homePins.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setFollowSelected(false);
              setFitTrigger((c) => c + 1);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition"
            title="Fit All on Map"
          >
            <Maximize2 size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">
              {busesWithCoords.length > 1 ? "All Buses" : "Fit View"}
            </span>
          </button>
        )}

        {showOpenInMapsButton && selectedBus && getPreferredGoogleMapsUrl(selectedBus) && (
          <button
            type="button"
            onClick={() =>
              safeOpenExternalUrl(getPreferredGoogleMapsUrl(selectedBus))
            }
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50 text-[11px] font-bold flex items-center gap-1 shadow-lg cursor-pointer transition"
            title={
              selectedBus.liveShareUrl && selectedBus.tripStatus === "started" && selectedBus.liveShareActive !== false
                ? "Open Driver's Live Location Share in Google Maps"
                : "Open exact live pin in Google Maps app (100% Free)"
            }
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">
              {selectedBus.liveShareUrl && selectedBus.tripStatus === "started" && selectedBus.liveShareActive !== false
                ? "Live G-Maps"
                : "Google Maps"}
            </span>
          </button>
        )}

        {canSwitchToGoogle && onSwitchEngine && (
          <button
            type="button"
            onClick={onSwitchEngine}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-[11px] font-bold shadow-lg backdrop-blur-md cursor-pointer transition"
            title="Switch to Google Maps Engine"
          >
            G-Maps
          </button>
        )}
      </div>

      {/* Subtle Bottom-Left Legend Strip */}
      <div className="absolute bottom-2.5 left-2.5 z-[400] pointer-events-none hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950/85 border border-slate-800 text-[10px] font-bold text-slate-300 backdrop-blur-md">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          OpenStreetMap Live (₹0 Free)
        </span>
        {routes.some((r) => r.stops?.length > 0) && (
          <span className="text-slate-400">• Route Stops Shown</span>
        )}
        {homePins.some((h) => h.show1KmRadius) && (
          <span className="text-emerald-300">• 1 KM Alert Ring</span>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. OPTIONAL GOOGLE MAPS ENGINE (WHEN API KEY IS CONFIGURED)
 * ============================================================================ */

interface BusMarkerProps {
  bus: BusLiveLocation;
  isSelected: boolean;
  isInfoOpen: boolean;
  onSelect: (busId: string) => void;
  onCloseInfo: () => void;
  showOpenInMapsButton?: boolean;
  readOnly?: boolean;
  stoppedLabel?: string;
}

const BusAdvancedMarker: React.FC<BusMarkerProps> = ({
  bus,
  isSelected,
  isInfoOpen,
  onSelect,
  onCloseInfo,
  showOpenInMapsButton = true,
  readOnly = false,
  stoppedLabel = "",
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isLive = bus.tripStatus === "started";
  const preferredUrl = getPreferredGoogleMapsUrl(bus);
  const pos: LatLngPoint = {
    lat: Number(bus.latitude),
    lng: Number(bus.longitude),
  };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={pos}
        zIndex={isSelected ? 1000 : isLive ? 500 : 100}
        title={`${bus.busNumber} • ${isLive ? (stoppedLabel ? `⏸ ${stoppedLabel}` : `${bus.speed} km/h LIVE`) : "Depot Idle"}`}
        onClick={() => onSelect(bus.busId)}
      >
        <div
          className="flex flex-col items-center cursor-pointer select-none"
          style={{ transform: "translateY(-4px)" }}
        >
          <div
            className={`mb-1 px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg border flex items-center gap-1 whitespace-nowrap transition-transform ${
              isSelected
                ? "bg-amber-400 text-slate-950 border-white scale-105"
                : isLive
                  ? "bg-emerald-600 text-white border-emerald-200"
                  : "bg-slate-800 text-slate-200 border-slate-500"
            }`}
          >
            {isLive && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            )}
            <span>{getShortBusLabel(bus.busNumber)}</span>
            {isLive && (
              <span>{stoppedLabel ? `• ⏸ ${stoppedLabel}` : `• ${bus.speed} km/h`}</span>
            )}
          </div>

          <div
            className="relative flex items-center justify-center"
            dangerouslySetInnerHTML={{
              __html: build3DSchoolVanSvg({
                idKey: `gm_${bus.busId}`,
                isLive,
                isSelected,
                size: isSelected ? 64 : 56,
              }),
            }}
          />
        </div>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={270}
          onCloseClick={onCloseInfo}
        >
          <div className="p-1 text-slate-900 space-y-2 min-w-[210px]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-xs text-slate-900 leading-tight">
                  {bus.busNumber}
                </p>
                <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  {bus.route}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  isLive
                    ? stoppedLabel
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {isLive ? (stoppedLabel ? `⏸ ${stoppedLabel}` : `LIVE • ${bus.speed} km/h`) : "Idle"}
              </span>
            </div>

            <div className="bg-slate-100 rounded-lg p-2 space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">ड्राइवर:</span>
                <span className="font-bold text-slate-900 truncate">
                  {bus.driverName || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">करंट स्टॉप:</span>
                <span className="font-bold text-indigo-700 truncate">
                  {bus.currentStop || "Depot"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              {bus.driverPhone && (
                <a
                  href={`tel:${bus.driverPhone}`}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                >
                  <Phone size={12} /> Call Driver
                </a>
              )}
              {showOpenInMapsButton && preferredUrl && (
                <button
                  type="button"
                  onClick={() => safeOpenExternalUrl(preferredUrl)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink size={12} />{" "}
                  {bus.liveShareUrl && isLive && bus.liveShareActive !== false ? "Live Maps" : "Open Maps"}
                </button>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface GoogleMapContentProps {
  busesWithCoords: BusLiveLocation[];
  selectedBus: BusLiveLocation | null;
  routes: MapRouteOverlay[];
  homePins: MapHomePinOverlay[];
  schoolPin?: { name: string; lat: number; lng: number } | null;
  followSelected: boolean;
  trailByBus: Record<string, LatLngPoint[]>;
  fitTrigger: number;
  openInfoBusId: string | null;
  onSelectBus: (busId: string) => void;
  onCloseInfo: () => void;
  connectBusToHome?: boolean;
  showOpenInMapsButton?: boolean;
  readOnly?: boolean;
  stoppedLabelByBusId?: Record<string, string>;
}

const GoogleMapContent: React.FC<GoogleMapContentProps> = ({
  busesWithCoords,
  selectedBus,
  routes,
  homePins,
  schoolPin,
  followSelected,
  trailByBus,
  fitTrigger,
  openInfoBusId,
  onSelectBus,
  onCloseInfo,
  connectBusToHome,
  showOpenInMapsButton = true,
  readOnly = false,
  stoppedLabelByBusId = {},
}) => {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const initialFitDoneRef = useRef<boolean>(false);

  const hadSelectedCoordsRef = useRef<boolean>(hasValidCoords(selectedBus));

  useEffect(() => {
    if (!map) return;
    const validNow = Boolean(selectedBus && hasValidCoords(selectedBus));
    if (!validNow) {
      hadSelectedCoordsRef.current = false;
      return;
    }
    const justAcquiredFirstFix = !hadSelectedCoordsRef.current;
    hadSelectedCoordsRef.current = true;
    if (!followSelected && !justAcquiredFirstFix) return;

    map.panTo({
      lat: Number(selectedBus.latitude),
      lng: Number(selectedBus.longitude),
    });
    const currentZoom = map.getZoom();
    if (!currentZoom || currentZoom < 14 || justAcquiredFirstFix) {
      map.setZoom(Math.max(currentZoom || 0, 16));
    }
  }, [map, followSelected, selectedBus?.busId, selectedBus?.latitude, selectedBus?.longitude]);

  useEffect(() => {
    if (!map) return;
    if (initialFitDoneRef.current && fitTrigger === 0) return;

    const pts: LatLngPoint[] = [];
    busesWithCoords.forEach((b) => pts.push({ lat: Number(b.latitude), lng: Number(b.longitude) }));
    homePins.forEach((h) => {
      if (isValidLatLng(h.lat, h.lng)) pts.push({ lat: h.lat, lng: h.lng });
    });
    if (pts.length === 0) return;

    if (pts.length === 1) {
      map.panTo(pts[0]);
      map.setZoom(15);
      initialFitDoneRef.current = true;
      return;
    }

    if (typeof google !== "undefined" && google.maps?.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 56);
      initialFitDoneRef.current = true;
    }
  }, [map, fitTrigger, busesWithCoords.length, homePins.length]);

  // Draw Planned Route Polylines + Breadcrumb Trails + 1 KM Home Circle
  useEffect(() => {
    if (!map || typeof google === "undefined" || !google.maps?.Polyline) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];

    routes.forEach((route, idx) => {
      const pts = (route.stops || [])
        .filter((s) => isValidLatLng(s.lat, s.lng))
        .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }));
      if (pts.length >= 2) {
        const line = new google.maps.Polyline({
          path: pts,
          geodesic: true,
          strokeColor: getRouteColor(idx, route.color),
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        });
        polylinesRef.current.push(line);
      }
    });

    const trailPath = selectedBus ? trailByBus[selectedBus.busId] || [] : [];
    if (trailPath.length >= 2) {
      polylinesRef.current.push(
        new google.maps.Polyline({
          path: trailPath,
          geodesic: true,
          strokeColor: "#f59e0b",
          strokeOpacity: 0.95,
          strokeWeight: 4,
          map,
        })
      );
    }

    homePins.forEach((h) => {
      if (h.show1KmRadius && isValidLatLng(h.lat, h.lng) && google.maps?.Circle) {
        circlesRef.current.push(
          new google.maps.Circle({
            center: { lat: h.lat, lng: h.lng },
            radius: 1000,
            strokeColor: "#10b981",
            strokeOpacity: 0.7,
            strokeWeight: 1.5,
            fillColor: "#10b981",
            fillOpacity: 0.08,
            map,
          })
        );
      }
      if (connectBusToHome && h.isOwnHome && selectedBus && hasValidCoords(selectedBus)) {
        polylinesRef.current.push(
          new google.maps.Polyline({
            path: [
              { lat: Number(selectedBus.latitude), lng: Number(selectedBus.longitude) },
              { lat: h.lat, lng: h.lng },
            ],
            geodesic: true,
            strokeColor: "#10b981",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map,
          })
        );
      }
    });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];
    };
  }, [map, routes, selectedBus?.busId, selectedBus?.latitude, selectedBus?.longitude, trailByBus, homePins, connectBusToHome]);

  return (
    <>
      {routes.map((route, rIdx) =>
        (route.stops || [])
          .filter((s) => isValidLatLng(s.lat, s.lng))
          .map((stop, sIdx) => (
            <AdvancedMarker
              key={`${route.busId}_stop_${sIdx}`}
              position={{ lat: Number(stop.lat), lng: Number(stop.lng) }}
              zIndex={200}
              title={stop.stopName}
            >
              <div className="flex flex-col items-center">
                <div className="px-1.5 py-0.5 rounded-md bg-slate-950/90 text-white border border-slate-600 text-[9px] font-bold whitespace-nowrap shadow mb-0.5">
                  {stop.stopName}
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 border-white text-white text-[9px] font-black flex items-center justify-center shadow"
                  style={{
                    backgroundColor: stop.completed
                      ? "#10b981"
                      : getRouteColor(rIdx, route.color),
                  }}
                >
                  {stop.completed ? "✓" : sIdx + 1}
                </div>
              </div>
            </AdvancedMarker>
          ))
      )}

      {schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng) && (
        <AdvancedMarker position={{ lat: schoolPin.lat, lng: schoolPin.lng }} zIndex={300}>
          <div className="flex flex-col items-center">
            <div className="px-2 py-0.5 rounded-full bg-indigo-950 text-amber-300 border border-amber-400 text-[10px] font-black whitespace-nowrap shadow mb-0.5">
              🏫 {schoolPin.name}
            </div>
            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white border-2 border-amber-400 flex items-center justify-center shadow">
              <SchoolIcon size={14} />
            </div>
          </div>
        </AdvancedMarker>
      )}

      {homePins
        .filter((h) => isValidLatLng(h.lat, h.lng))
        .map((h) => (
          <AdvancedMarker key={h.id} position={{ lat: h.lat, lng: h.lng }} zIndex={450}>
            <div className="flex flex-col items-center">
              <div className="px-2 py-0.5 rounded-full bg-emerald-950 text-white border border-emerald-400 text-[10px] font-black whitespace-nowrap shadow mb-0.5">
                🏠 {h.label} {h.distanceText ? `• ${h.distanceText}` : ""}
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white border-2 border-white flex items-center justify-center shadow-lg">
                <Home size={14} />
              </div>
            </div>
          </AdvancedMarker>
        ))}

      {busesWithCoords.map((bus) => (
        <BusAdvancedMarker
          key={bus.busId}
          bus={bus}
          isSelected={selectedBus?.busId === bus.busId}
          isInfoOpen={openInfoBusId === bus.busId}
          onSelect={onSelectBus}
          onCloseInfo={onCloseInfo}
          showOpenInMapsButton={showOpenInMapsButton}
          readOnly={readOnly}
          stoppedLabel={stoppedLabelByBusId[bus.busId] || ""}
        />
      ))}
    </>
  );
};

interface GoogleViewportProps {
  busesWithCoords: BusLiveLocation[];
  selectedBus: BusLiveLocation | null;
  routes: MapRouteOverlay[];
  homePins: MapHomePinOverlay[];
  schoolPin?: { name: string; lat: number; lng: number } | null;
  trailByBus: Record<string, LatLngPoint[]>;
  onSelectBus?: (busId: string) => void;
  heightClass: string;
  readOnly?: boolean;
  pinPickLabel?: string | null;
  onPickLocation?: (lat: number, lng: number) => void;
  showOpenInMapsButton?: boolean;
  connectBusToHome?: boolean;
  stoppedLabelByBusId?: Record<string, string>;
  onFallbackToLeaflet: () => void;
}

const GoogleMapViewportInner: React.FC<GoogleViewportProps> = ({
  busesWithCoords,
  selectedBus,
  routes,
  homePins,
  schoolPin,
  trailByBus,
  onSelectBus,
  heightClass,
  readOnly,
  pinPickLabel,
  onPickLocation,
  showOpenInMapsButton,
  connectBusToHome,
  stoppedLabelByBusId = {},
  onFallbackToLeaflet,
}) => {
  const apiStatus = useApiLoadingStatus();
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [followSelected, setFollowSelected] = useState<boolean>(true);
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [openInfoBusId, setOpenInfoBusId] = useState<string | null>(null);

  useEffect(() => {
    if (
      apiStatus === APILoadingStatus.FAILED ||
      apiStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      if (apiStatus === APILoadingStatus.AUTH_FAILURE) {
        window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
      }
      onFallbackToLeaflet();
    }
  }, [apiStatus, onFallbackToLeaflet]);

  const handleSelectMarker = useCallback(
    (busId: string) => {
      setOpenInfoBusId(busId);
      setFollowSelected(true);
      if (!readOnly && onSelectBus) onSelectBus(busId);
    },
    [onSelectBus, readOnly]
  );

  const initialCenter: LatLngPoint =
    selectedBus && hasValidCoords(selectedBus)
      ? { lat: Number(selectedBus.latitude), lng: Number(selectedBus.longitude) }
      : busesWithCoords[0]
        ? { lat: Number(busesWithCoords[0].latitude), lng: Number(busesWithCoords[0].longitude) }
        : schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng)
          ? { lat: schoolPin.lat, lng: schoolPin.lng }
          : DEFAULT_FALLBACK_CENTER;

  const hasInitialPin = Boolean(
    (selectedBus && hasValidCoords(selectedBus)) ||
      busesWithCoords[0] ||
      (schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng))
  );

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-inner`}
    >
      {apiStatus === APILoadingStatus.LOADING && (
        <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span className="text-xs font-bold">Live Map load ho raha hai...</span>
        </div>
      )}

      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={initialCenter}
        defaultZoom={!hasInitialPin ? 5 : busesWithCoords.length > 1 ? 13 : 15}
        mapTypeId={mapType}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        style={{ width: "100%", height: "100%" }}
        onDragstart={() => setFollowSelected(false)}
        onClick={(ev) => {
          if (pinPickLabel && onPickLocation && ev.detail?.latLng) {
            onPickLocation(
              Number(ev.detail.latLng.lat.toFixed(6)),
              Number(ev.detail.latLng.lng.toFixed(6))
            );
          }
        }}
      >
        <GoogleMapContent
          busesWithCoords={busesWithCoords}
          selectedBus={selectedBus}
          routes={routes}
          homePins={homePins}
          schoolPin={schoolPin}
          followSelected={followSelected}
          trailByBus={trailByBus}
          fitTrigger={fitTrigger}
          openInfoBusId={openInfoBusId}
          onSelectBus={handleSelectMarker}
          onCloseInfo={() => setOpenInfoBusId(null)}
          connectBusToHome={connectBusToHome}
          showOpenInMapsButton={showOpenInMapsButton}
          readOnly={readOnly}
          stoppedLabelByBusId={stoppedLabelByBusId}
        />
      </GoogleMap>

      {/* Top-Right Controls */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() =>
            setMapType((prev) => (prev === "roadmap" ? "hybrid" : "roadmap"))
          }
          className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition"
        >
          <Layers size={13} className="text-sky-400" />
          <span>{mapType === "roadmap" ? "Satellite" : "Road Map"}</span>
        </button>

        <button
          type="button"
          onClick={() => setFollowSelected((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition ${
            followSelected
              ? "bg-amber-500 text-slate-950 border-amber-300"
              : "bg-slate-950/90 hover:bg-slate-800 text-slate-200 border-slate-700"
          }`}
        >
          <Crosshair size={13} />
          <span className="hidden sm:inline">
            {followSelected ? "Following" : "Follow"}
          </span>
        </button>

        {busesWithCoords.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setFollowSelected(false);
              setFitTrigger((c) => c + 1);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md cursor-pointer transition"
          >
            <Maximize2 size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">All</span>
          </button>
        )}

        <button
          type="button"
          onClick={onFallbackToLeaflet}
          className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold shadow-lg backdrop-blur-md cursor-pointer transition"
          title="Switch to Free OpenStreetMap Engine"
        >
          OSM Free
        </button>

        {showOpenInMapsButton && selectedBus && getPreferredGoogleMapsUrl(selectedBus) && (
          <button
            type="button"
            onClick={() =>
              safeOpenExternalUrl(getPreferredGoogleMapsUrl(selectedBus))
            }
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50 text-[11px] font-bold flex items-center gap-1 shadow-lg cursor-pointer transition"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">
              {selectedBus.liveShareUrl && selectedBus.tripStatus === "started" && selectedBus.liveShareActive !== false
                ? "Live G-Maps"
                : "Maps App"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. UNIFIED HYBRID MAP WRAPPER (FREE LEAFLET DEFAULT + GOOGLE MAPS UPGRADE)
 * ============================================================================ */

export const LiveBusGoogleMap: React.FC<LiveBusGoogleMapProps> = ({
  buses,
  selectedBusId,
  onSelectBus,
  heightClass = "h-[420px] sm:h-[520px]",
  schoolId,
  schoolCode,
  routes = [],
  homePins = [],
  schoolPin = null,
  readOnly = false,
  pinPickLabel = null,
  onPickLocation,
  showOpenInMapsButton = true,
  connectBusToHome = false,
  fitAllOnLoad = false,
  onAreaNamesResolved,
  googleMapsApiKey,
}) => {
  const envKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const schoolCustomKey = String(googleMapsApiKey || "").trim();
  const normalizedSchoolId = (schoolId || "").trim();
  const normalizedSchoolCode = (schoolCode || "").trim();
  const hasSchoolLookup = Boolean(normalizedSchoolId || normalizedSchoolCode);

  const [apiKey, setApiKey] = useState<string>(schoolCustomKey || (hasSchoolLookup ? "" : envKey));
  const [engine, setEngine] = useState<"leaflet" | "google">(schoolCustomKey ? "google" : "leaflet");
  const [googleFailed, setGoogleFailed] = useState<boolean>(false);
  const [trailByBus, setTrailByBus] = useState<Record<string, LatLngPoint[]>>({});
  const [areaNameByBusId, setAreaNameByBusId] = useState<Record<string, string>>({});
  const stoppedSinceByBusRef = useRef<Record<string, { since: number; lat: number; lng: number }>>({});
  const [haltTick, setHaltTick] = useState<number>(0);

  // Refresh halt duration clock every 15s while live buses are present
  useEffect(() => {
    const t = setInterval(() => setHaltTick((c) => c + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Check if an active Google Maps key is configured (School custom key takes top priority; else server lookup; Free Leaflet remains instant default!)
  useEffect(() => {
    if (schoolCustomKey) {
      setApiKey(schoolCustomKey);
      setGoogleFailed(false);
      return;
    }
    if (!hasSchoolLookup && envKey) {
      setApiKey(envKey);
      return;
    }
    let active = true;
    const params = new URLSearchParams();
    if (normalizedSchoolId) params.set("schoolId", normalizedSchoolId);
    if (normalizedSchoolCode) params.set("schoolCode", normalizedSchoolCode);
    const queryStr = params.toString();

    fetch(`/api/public-config/maps-key${queryStr ? `?${queryStr}` : ""}`)
      .then((r) => (r.ok ? r.json() : { apiKey: "" }))
      .then((data) => {
        if (!active) return;
        const serverKey = String(data?.apiKey || "").trim();
        setApiKey(serverKey || envKey);
      })
      .catch(() => {
        if (!active) return;
        setApiKey(envKey);
      });

    return () => {
      active = false;
    };
  }, [schoolCustomKey, envKey, hasSchoolLookup, normalizedSchoolId, normalizedSchoolCode]);

  // Listen to global Google Maps quota failure -> auto-fallback to Leaflet seamlessly
  useEffect(() => {
    const onQuota = () => {
      setGoogleFailed(true);
      setEngine("leaflet");
    };
    window.addEventListener("gmp-quota-exceeded", onQuota);
    return () => window.removeEventListener("gmp-quota-exceeded", onQuota);
  }, []);

  const busesWithCoords = useMemo(
    () => buses.filter((b) => hasValidCoords(b)),
    [buses]
  );

  const selectedBus =
    buses.find((b) => b.busId === selectedBusId) || buses[0] || null;

  // Record clean, outlier-filtered live GPS breadcrumb trail per bus (up to 80 points)
  useEffect(() => {
    if (busesWithCoords.length === 0) return;
    setTrailByBus((prev) => {
      let changed = false;
      const next: Record<string, LatLngPoint[]> = { ...prev };
      for (const b of busesWithCoords) {
        const pt = { lat: Number(b.latitude), lng: Number(b.longitude) };
        const existing = next[b.busId] || [];
        const last = existing[existing.length - 1];
        if (!last) {
          next[b.busId] = [pt];
          changed = true;
          continue;
        }
        const distM = haversineMeters(last.lat, last.lng, pt.lat, pt.lng);
        // Ignore stationary < 8m GPS wobble, and reset trail if bus teleported > 1.5km instantaneously
        if (distM >= 8 && distM < 1500) {
          next[b.busId] = [...existing.slice(-79), pt];
          changed = true;
        } else if (distM >= 1500) {
          next[b.busId] = [pt];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [busesWithCoords]);

  // Free live reverse-geocoding for every bus ("कौन गाड़ी किस Area में है")
  useEffect(() => {
    if (busesWithCoords.length === 0) return;
    let cancelled = false;

    const immediate: Record<string, string> = {};
    busesWithCoords.forEach((b) => {
      const c = getCachedAreaName(Number(b.latitude), Number(b.longitude));
      if (c) immediate[b.busId] = c;
    });
    if (Object.keys(immediate).length > 0) {
      setAreaNameByBusId((prev) => ({ ...prev, ...immediate }));
    }

    const resolveAll = async () => {
      const updates: Record<string, string> = {};
      for (const b of busesWithCoords) {
        const name = await resolveFreeAreaName(Number(b.latitude), Number(b.longitude));
        if (name) updates[b.busId] = name;
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setAreaNameByBusId((prev) => ({ ...prev, ...updates }));
      }
    };
    void resolveAll();

    return () => {
      cancelled = true;
    };
  }, [busesWithCoords]);

  useEffect(() => {
    if (Object.keys(areaNameByBusId).length > 0) {
      onAreaNamesResolved?.(areaNameByBusId);
    }
  }, [areaNameByBusId, onAreaNamesResolved]);

  const stoppedLabelByBusId = useMemo(() => {
    const out: Record<string, string> = {};
    const now = Date.now();
    busesWithCoords.forEach((b) => {
      if (b.tripStatus !== "started") {
        delete stoppedSinceByBusRef.current[b.busId];
        return;
      }
      const lat = Number(b.latitude);
      const lng = Number(b.longitude);
      const speed = Number(b.speed || 0);
      if (speed >= 3) {
        delete stoppedSinceByBusRef.current[b.busId];
        return;
      }
      const existing = stoppedSinceByBusRef.current[b.busId];
      if (!existing || haversineMeters(existing.lat, existing.lng, lat, lng) > 25) {
        stoppedSinceByBusRef.current[b.busId] = { since: now, lat, lng };
        return;
      }
      const elapsedSec = Math.floor((now - existing.since) / 1000);
      if (elapsedSec >= 35) {
        const mins = Math.floor(elapsedSec / 60);
        out[b.busId] = mins >= 1 ? `Stopped ${mins}m` : `Stopped ${elapsedSec}s`;
      }
    });
    return out;
  }, [busesWithCoords, haltTick]);

  const canUseGoogle = Boolean(apiKey) && !googleFailed;

  if (engine === "google" && canUseGoogle) {
    return (
      <APIProvider
        key={apiKey}
        apiKey={apiKey}
        libraries={["marker"]}
        language="en"
        region="IN"
      >
        <GoogleMapViewportInner
          busesWithCoords={busesWithCoords}
          selectedBus={selectedBus}
          routes={routes}
          homePins={homePins}
          schoolPin={schoolPin}
          trailByBus={trailByBus}
          onSelectBus={onSelectBus}
          heightClass={heightClass}
          readOnly={readOnly}
          pinPickLabel={pinPickLabel}
          onPickLocation={onPickLocation}
          showOpenInMapsButton={showOpenInMapsButton}
          connectBusToHome={connectBusToHome}
          stoppedLabelByBusId={stoppedLabelByBusId}
          onFallbackToLeaflet={() => {
            setGoogleFailed(true);
            setEngine("leaflet");
          }}
        />
      </APIProvider>
    );
  }

  return (
    <LeafletFleetMap
      busesWithCoords={busesWithCoords}
      selectedBus={selectedBus}
      routes={routes}
      homePins={homePins}
      schoolPin={schoolPin}
      trailByBus={trailByBus}
      onSelectBus={onSelectBus}
      heightClass={heightClass}
      readOnly={readOnly}
      pinPickLabel={pinPickLabel}
      onPickLocation={onPickLocation}
      showOpenInMapsButton={showOpenInMapsButton}
      connectBusToHome={connectBusToHome}
      fitAllOnLoad={fitAllOnLoad}
      areaNameByBusId={areaNameByBusId}
      stoppedLabelByBusId={stoppedLabelByBusId}
      canSwitchToGoogle={canUseGoogle}
      onSwitchEngine={() => setEngine("google")}
    />
  );
};
