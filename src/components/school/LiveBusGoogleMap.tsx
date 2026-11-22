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
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

const DEFAULT_FALLBACK_CENTER: LatLngPoint = { lat: 28.4595, lng: 77.0266 };

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
  canSwitchToGoogle = false,
  onSwitchEngine,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const trailsLayerRef = useRef<L.LayerGroup | null>(null);
  const homesLayerRef = useRef<L.LayerGroup | null>(null);
  const busesLayerRef = useRef<L.LayerGroup | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const initialFitDoneRef = useRef<boolean>(false);
  const onPickRef = useRef(onPickLocation);
  const pinPickActiveRef = useRef(Boolean(pinPickLabel));

  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [followSelected, setFollowSelected] = useState<boolean>(true);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

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

    const startCenter: [number, number] =
      selectedBus && hasValidCoords(selectedBus)
        ? [Number(selectedBus.latitude), Number(selectedBus.longitude)]
        : busesWithCoords[0]
          ? [Number(busesWithCoords[0].latitude), Number(busesWithCoords[0].longitude)]
          : homePins[0] && isValidLatLng(homePins[0].lat, homePins[0].lng)
            ? [homePins[0].lat, homePins[0].lng]
            : schoolPin && isValidLatLng(schoolPin.lat, schoolPin.lng)
              ? [schoolPin.lat, schoolPin.lng]
              : [DEFAULT_FALLBACK_CENTER.lat, DEFAULT_FALLBACK_CENTER.lng];

    const map = L.map(el, {
      center: startCenter,
      zoom: busesWithCoords.length > 1 ? 13 : 15,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    tileLayerGroupRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    trailsLayerRef.current = L.layerGroup().addTo(map);
    homesLayerRef.current = L.layerGroup().addTo(map);
    busesLayerRef.current = L.layerGroup().addTo(map);

    map.on("dragstart", () => {
      setFollowSelected(false);
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

  // 2. Switch Street Map (OSM) vs Satellite Hybrid (Esri Imagery + Place & Road Labels)
  useEffect(() => {
    const group = tileLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (mapType === "roadmap") {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(group);
    } else {
      // Free Esri World Satellite Imagery
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "&copy; Esri World Imagery",
        }
      ).addTo(group);
      // Free Road Lines + Village / Town / City / Landmark Name Labels Overlay
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

  // 5. Draw Live Breadcrumb Trails for Active Buses
  useEffect(() => {
    const layer = trailsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    Object.entries(trailByBus).forEach(([busId, pts]) => {
      if (!pts || pts.length < 2) return;
      const isSelected = selectedBus?.busId === busId;
      const color = colorByBusId.get(busId) || "#f59e0b";
      L.polyline(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: isSelected ? "#fbbf24" : color,
          weight: isSelected ? 4.5 : 3,
          opacity: isSelected ? 0.95 : 0.6,
        }
      ).addTo(layer);
    });
  }, [trailByBus, selectedBus?.busId, colorByBusId]);

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
      const speedText = isLive ? ` • ${bus.speed || 0} km/h` : " • Idle";

      const icon = L.divIcon({
        className: "nsta-bus-div-icon",
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-88%);cursor:pointer;user-select:none;">
            <div style="background:${pillBg};color:${pillText};border:2px solid #ffffff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.55);display:flex;align-items:center;gap:5px;margin-bottom:4px;">
              ${isLive ? `<span style="width:7px;height:7px;border-radius:999px;background:#ffffff;display:inline-block;box-shadow:0 0 8px #ffffff;"></span>` : ""}
              <span>${escapeHtml(shortName)}${escapeHtml(speedText)}</span>
            </div>
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              ${isLive ? `<span style="position:absolute;inset:-6px;border-radius:999px;background:${pillBg};opacity:0.35;"></span>` : ""}
              <div style="width:38px;height:38px;border-radius:14px;background:${pillBg};color:${pillText};border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 6px 16px rgba(0,0,0,0.55);">
                🚌
              </div>
            </div>
            <div style="width:10px;height:10px;background:${pillBg};border-right:2px solid #ffffff;border-bottom:2px solid #ffffff;transform:rotate(45deg);margin-top:-5px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const popupHtml = `
        <div style="font-family:system-ui,sans-serif;min-width:210px;color:#0f172a;line-height:1.4;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <div style="font-weight:900;font-size:13px;">${escapeHtml(bus.busNumber)}</div>
              <div style="font-size:11px;color:#475569;">${escapeHtml(bus.route)}</div>
            </div>
            <span style="padding:2px 7px;border-radius:999px;font-size:10px;font-weight:900;background:${isLive ? "#d1fae5" : "#e2e8f0"};color:${isLive ? "#065f46" : "#475569"};white-space:nowrap;">
              ${isLive ? `LIVE • ${bus.speed || 0} km/h` : "Idle"}
            </span>
          </div>
          <div style="background:#f1f5f9;border-radius:8px;padding:7px;margin-top:8px;font-size:11px;">
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
            <a href="https://www.google.com/maps?q=${Number(bus.latitude)},${Number(bus.longitude)}" target="_blank" rel="noopener noreferrer" style="flex:1;padding:6px 8px;border-radius:8px;background:#4f46e5;color:#ffffff;font-weight:800;font-size:11px;text-align:center;text-decoration:none;">🗺️ Google Maps</a>
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
  }, [busesWithCoords, selectedBus?.busId, colorByBusId, onSelectBus, readOnly]);

  // 7. Smooth Auto-Follow Selected Bus
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followSelected || !selectedBus || !hasValidCoords(selectedBus)) return;
    if (pinPickLabel) return; // Don't steal camera while admin is pinning a stop
    const target: [number, number] = [Number(selectedBus.latitude), Number(selectedBus.longitude)];
    const currentZoom = map.getZoom();
    map.panTo(target, { animate: true, duration: 0.5 });
    if (currentZoom < 14 && busesWithCoords.length <= 1) {
      map.setZoom(15);
    }
  }, [
    followSelected,
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
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-inner`}
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

      {/* Top-Left Live Bus / Waiting Pill */}
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
              <span className="text-amber-300 font-mono shrink-0">
                {selectedBus.speed || 0} km/h
              </span>
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
            onClick={() => setFollowSelected((prev) => !prev)}
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

        {showOpenInMapsButton && openTarget && (
          <button
            type="button"
            onClick={() =>
              safeOpenExternalUrl(
                `https://www.google.com/maps?q=${openTarget.lat},${openTarget.lng}`
              )
            }
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50 text-[11px] font-bold flex items-center gap-1 shadow-lg cursor-pointer transition"
            title="Open exact live pin in Google Maps app (100% Free)"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">Google Maps</span>
          </button>
        )}

        {canSwitchToGoogle && onSwitchEngine && !readOnly && (
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
}

const BusAdvancedMarker: React.FC<BusMarkerProps> = ({
  bus,
  isSelected,
  isInfoOpen,
  onSelect,
  onCloseInfo,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isLive = bus.tripStatus === "started";
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
        title={`${bus.busNumber} • ${isLive ? `${bus.speed} km/h LIVE` : "Depot Idle"}`}
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
            {isLive && <span>• {bus.speed} km/h</span>}
          </div>

          <div className="relative flex items-center justify-center">
            {isLive && (
              <span className="absolute -inset-1.5 rounded-full bg-emerald-400/40 animate-pulse" />
            )}
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-transform ${
                isSelected
                  ? "bg-amber-500 text-slate-950 border-white scale-110"
                  : isLive
                    ? "bg-emerald-500 text-slate-950 border-white"
                    : "bg-slate-700 text-slate-100 border-slate-300"
              }`}
            >
              <Bus size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div
            className={`w-2 h-2 rotate-45 -mt-1 border-r border-b ${
              isSelected
                ? "bg-amber-500 border-white"
                : isLive
                  ? "bg-emerald-500 border-white"
                  : "bg-slate-700 border-slate-300"
            }`}
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
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {isLive ? `LIVE • ${bus.speed} km/h` : "Idle"}
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
              <button
                type="button"
                onClick={() =>
                  safeOpenExternalUrl(
                    `https://www.google.com/maps?q=${bus.latitude},${bus.longitude}`
                  )
                }
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <ExternalLink size={12} /> Open Maps
              </button>
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
}) => {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const initialFitDoneRef = useRef<boolean>(false);

  useEffect(() => {
    if (!map || !followSelected || !selectedBus || !hasValidCoords(selectedBus)) {
      return;
    }
    map.panTo({
      lat: Number(selectedBus.latitude),
      lng: Number(selectedBus.longitude),
    });
    const currentZoom = map.getZoom();
    if (!currentZoom || currentZoom < 14) {
      map.setZoom(15);
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
        : DEFAULT_FALLBACK_CENTER;

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
        defaultZoom={busesWithCoords.length > 1 ? 13 : 15}
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

        {!readOnly && (
          <button
            type="button"
            onClick={onFallbackToLeaflet}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold shadow-lg backdrop-blur-md cursor-pointer transition"
            title="Switch to Free OpenStreetMap Engine"
          >
            OSM Free
          </button>
        )}

        {showOpenInMapsButton && selectedBus && hasValidCoords(selectedBus) && (
          <button
            type="button"
            onClick={() =>
              safeOpenExternalUrl(
                `https://www.google.com/maps?q=${selectedBus.latitude},${selectedBus.longitude}`
              )
            }
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50 text-[11px] font-bold flex items-center gap-1 shadow-lg cursor-pointer transition"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">Maps App</span>
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
}) => {
  const envKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const normalizedSchoolId = (schoolId || "").trim();
  const normalizedSchoolCode = (schoolCode || "").trim();
  const hasSchoolLookup = Boolean(normalizedSchoolId || normalizedSchoolCode);

  const [apiKey, setApiKey] = useState<string>(hasSchoolLookup ? "" : envKey);
  const [engine, setEngine] = useState<"leaflet" | "google">("leaflet");
  const [googleFailed, setGoogleFailed] = useState<boolean>(false);
  const [trailByBus, setTrailByBus] = useState<Record<string, LatLngPoint[]>>({});

  // Check if an active Google Maps key is configured (runs in background without blocking Free Leaflet Map!)
  useEffect(() => {
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
  }, [envKey, hasSchoolLookup, normalizedSchoolId, normalizedSchoolCode]);

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

  // Record live GPS breadcrumb trail per bus (up to 80 points)
  useEffect(() => {
    if (busesWithCoords.length === 0) return;
    setTrailByBus((prev) => {
      let changed = false;
      const next: Record<string, LatLngPoint[]> = { ...prev };
      for (const b of busesWithCoords) {
        const pt = { lat: Number(b.latitude), lng: Number(b.longitude) };
        const existing = next[b.busId] || [];
        const last = existing[existing.length - 1];
        if (
          !last ||
          Math.abs(last.lat - pt.lat) > 0.00003 ||
          Math.abs(last.lng - pt.lng) > 0.00003
        ) {
          next[b.busId] = [...existing.slice(-79), pt];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [busesWithCoords]);

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
      canSwitchToGoogle={canUseGoogle}
      onSwitchEngine={() => setEngine("google")}
    />
  );
};
