import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Link2, Crosshair, Loader2, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { resolveGoogleMapsLocationInput } from "../../utils/busProximity";
import { getLocalRoutes, type SchoolBusRoute } from "../../utils/schoolTransportStore";
import { toUpperFormText } from "../../utils/schoolFormUtils";

interface StudentStopLocationFieldsProps {
  schoolId?: string;
  busRoute: string;
  busStop: string;
  homeLat?: number;
  homeLng?: number;
  busFee?: number;
  showBusFee?: boolean;
  onChange: (patch: {
    busRoute?: string;
    busStop?: string;
    busFee?: number;
    homeLat?: number;
    homeLng?: number;
    busNumber?: string;
    driverName?: string;
    driverPhone?: string;
  }) => void;
  compact?: boolean;
}

export const StudentStopLocationFields: React.FC<StudentStopLocationFieldsProps> = ({
  schoolId,
  busRoute,
  busStop,
  homeLat,
  homeLng,
  busFee,
  showBusFee = false,
  onChange,
  compact = false,
}) => {
  const routes: SchoolBusRoute[] = useMemo(
    () => (schoolId ? getLocalRoutes(schoolId) : []),
    [schoolId]
  );

  const selectedRoute = useMemo(() => {
    const q = (busRoute || "").trim().toLowerCase();
    if (!q) return undefined;
    return routes.find(
      (r) =>
        r.routeName.toLowerCase() === q ||
        q.startsWith(r.routeName.toLowerCase()) ||
        r.routeName.toLowerCase().includes(q)
    );
  }, [routes, busRoute]);

  const hasCoords =
    typeof homeLat === "number" &&
    typeof homeLng === "number" &&
    Number.isFinite(homeLat) &&
    Number.isFinite(homeLng) &&
    (Math.abs(homeLat) > 0.001 || Math.abs(homeLng) > 0.001);

  const [pinInput, setPinInput] = useState<string>(() =>
    hasCoords ? `${homeLat}, ${homeLng}` : ""
  );
  const [resolving, setResolving] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (hasCoords) {
      setPinInput(`${homeLat}, ${homeLng}`);
    } else {
      setPinInput("");
    }
  }, [homeLat, homeLng, hasCoords]);

  const handleApplyLink = async () => {
    const raw = pinInput.trim();
    if (!raw) {
      toast.error("Google Maps share link ya 'lat, lng' daalein (jaise: 28.4595, 77.0266)");
      return;
    }
    setResolving(true);
    try {
      const parsed = await resolveGoogleMapsLocationInput(raw);
      if (!parsed) {
        toast.error("Valid Google Maps link ya 'lat, lng' coordinates daalein.");
        return;
      }
      onChange({ homeLat: parsed.lat, homeLng: parsed.lng });
      setPinInput(`${parsed.lat}, ${parsed.lng}`);
      toast.success(`Stop GPS (${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}) set ho gaya!`);
    } finally {
      setResolving(false);
    }
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      toast.error("Is device par GPS supported nahi hai.");
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChange({ homeLat: lat, homeLng: lng });
        setPinInput(`${lat}, ${lng}`);
        setCapturing(false);
        toast.success(`Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) capture ho gaya!`);
      },
      (err) => {
        setCapturing(false);
        toast.error(err?.message || "GPS location capture nahi ho saki.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const routeMatchExact = routes.some((r) => r.routeName === busRoute);

  return (
    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/80 space-y-2.5 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            Bus Route (रूट चुनें)
          </label>
          {routes.length > 0 ? (
            <select
              value={routeMatchExact ? busRoute : "__custom__"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__custom__") {
                  if (routeMatchExact) onChange({ busRoute: "" });
                  return;
                }
                const found = routes.find((r) => r.routeName === val);
                onChange({
                  busRoute: val,
                  ...(found && Number(found.monthlyFee) > 0 && showBusFee
                    ? { busFee: Number(found.monthlyFee) }
                    : {}),
                  ...(found
                    ? {
                        busNumber: found.busNumber,
                        driverName: found.driverName,
                        driverPhone: found.driverPhone,
                      }
                    : {}),
                });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white"
            >
              <option value="__custom__">-- Custom Route / Stop --</option>
              {routes.map((r) => (
                <option key={r.id} value={r.routeName}>
                  {r.routeName} {r.busNumber ? `(${r.busNumber})` : ""}
                  {showBusFee && r.monthlyFee ? ` · ₹${r.monthlyFee}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={busRoute}
              onChange={(e) => onChange({ busRoute: toUpperFormText(e.target.value) })}
              placeholder="ROUTE NAME"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold uppercase text-slate-800 dark:text-white"
            />
          )}
        </div>

        {routes.length > 0 && !routeMatchExact && (
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Custom Route Name
            </label>
            <input
              type="text"
              value={busRoute}
              onChange={(e) => onChange({ busRoute: toUpperFormText(e.target.value) })}
              placeholder="ROUTE NAME"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold uppercase text-slate-800 dark:text-white"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
            Pickup Stop Name (स्टॉप का नाम)
          </label>
          <input
            type="text"
            value={busStop}
            onChange={(e) => onChange({ busStop: toUpperFormText(e.target.value) })}
            placeholder="E.G. NAGRA CHOWK / MAIN MARKET"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-semibold uppercase text-slate-800 dark:text-white"
          />
        </div>

        {showBusFee && (
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Monthly Bus Fee (₹)
            </label>
            <input
              type="number"
              min={0}
              value={busFee ?? 0}
              onChange={(e) => onChange({ busFee: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Quick Stop Chips from Selected Route */}
      {selectedRoute && Array.isArray(selectedRoute.stops) && selectedRoute.stops.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Route Stops:
          </span>
          {selectedRoute.stops.map((st, idx) => {
            const active = busStop.trim().toLowerCase() === (st.stopName || "").trim().toLowerCase();
            const hasGps =
              typeof st.lat === "number" &&
              typeof st.lng === "number" &&
              (Math.abs(st.lat) > 0.001 || Math.abs(st.lng) > 0.001);
            return (
              <button
                key={`${st.id || st.stopName}_${idx}`}
                type="button"
                onClick={() => {
                  onChange({
                    busStop: toUpperFormText(st.stopName || ""),
                    ...(hasGps ? { homeLat: st.lat, homeLng: st.lng } : {}),
                  });
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                  active
                    ? "bg-amber-500 border-amber-500 text-slate-950"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-400"
                }`}
              >
                {idx + 1}. {st.stopName}
                {hasGps ? " 📍" : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Stop GPS Coordinates / Google Maps Link */}
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>Stop GPS Location (गूगल मैप लिंक / लाइव GPS पिन)</span>
          </label>
          {hasCoords && (
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300">
              <span>
                Pin: {homeLat!.toFixed(4)}, {homeLng!.toFixed(4)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${homeLat},${homeLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
              >
                <ExternalLink className="w-3 h-3" /> Map
              </a>
              <button
                type="button"
                onClick={() => {
                  onChange({ homeLat: undefined, homeLng: undefined });
                  setPinInput("");
                }}
                className="text-rose-500 hover:text-rose-600 cursor-pointer"
                title="Clear GPS Pin"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Google Maps link paste karein ya lat, lng (e.g. 28.4595, 77.0266)"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-white"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyLink}
              disabled={resolving}
              className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>Link Set</span>
            </button>
            <button
              type="button"
              onClick={handleCaptureGps}
              disabled={capturing}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {capturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
              <span>My GPS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
