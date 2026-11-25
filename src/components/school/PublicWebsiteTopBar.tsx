import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Megaphone,
  Phone,
  User as UserIcon,
  UserPlus,
  ChevronDown,
  Building2,
  X,
} from "lucide-react";
import type { School, SchoolSession } from "../../school-types";
import { getSavedSchoolLogo, isAppLogo } from "../../utils/schoolLogoUtils";
import {
  buildDefaultSchoolTickerItems,
  parseCustomTickerItems,
} from "../../utils/schoolTickerUtils";
import { resolveWebsiteAdmissionSessionLabel } from "../../utils/safeBrowserActions";
import AndroidBatteryIndicator from "../AndroidBatteryIndicator";
import { LanguageToggleButton } from "./LanguageToggleButton";

export type WebsiteTopNavSection =
  | "home"
  | "campus"
  | "gallery"
  | "admissions"
  | "verify"
  | "contact"
  | "account";

interface Props {
  school: School | null | undefined;
  schools?: School[];
  sessions?: SchoolSession[];
  activeSection: WebsiteTopNavSection;
  isAuthenticated?: boolean;
  portalButtonLabel?: string;
  onSelectSection: (section: Exclude<WebsiteTopNavSection, "account">) => void;
  onOpenAccount?: () => void;
  onSwitchToPortal?: () => void;
  onOpenAdmission?: () => void;
  onSelectSchool?: (schoolId: string) => void;
}

const NAV_ITEMS: {
  id: Exclude<WebsiteTopNavSection, "account">;
  label: string;
  mobileLabel?: string;
}[] = [
  { id: "home", label: "Home" },
  { id: "campus", label: "Campus & Fees", mobileLabel: "Fees" },
  { id: "gallery", label: "Memories" },
  { id: "admissions", label: "Admissions" },
  { id: "verify", label: "Verify" },
  { id: "contact", label: "Contact" },
];

export const PublicWebsiteTopBar: React.FC<Props> = ({
  school,
  schools = [],
  sessions = [],
  activeSection,
  isAuthenticated = false,
  portalButtonLabel = "Switch to Student Portal",
  onSelectSection,
  onOpenAccount,
  onSwitchToPortal,
  onOpenAdmission,
  onSelectSchool,
}) => {
  const fixedBarRef = useRef<HTMLDivElement | null>(null);
  const tickerScrollRef = useRef<HTMLDivElement | null>(null);
  const tickerPausedRef = useRef<boolean>(false);
  const [barHeight, setBarHeight] = useState<number>(126);
  const [isSchoolPickerOpen, setIsSchoolPickerOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const savedLogo = school?.id ? getSavedSchoolLogo(school.logoUrl, school.id) : school?.logoUrl || "";
  const hasValidLogo = Boolean(savedLogo && !isAppLogo(savedLogo) && !logoFailed);

  useEffect(() => {
    setLogoFailed(false);
  }, [savedLogo, school?.id]);
  const primaryPhone = String(school?.phone || "").trim();
  const admissionsOpen = school?.websiteConfig?.admissionsOpen !== false;
  const topTickerEnabled = school?.websiteConfig?.topTickerEnabled !== false;

  const activeSessionObj = useMemo(
    () => sessions.find((s: any) => s?.active) || sessions[0] || null,
    [sessions]
  );
  const sessionLabel = useMemo(
    () =>
      resolveWebsiteAdmissionSessionLabel({
        school,
        activeSession: activeSessionObj,
        sessions,
      }),
    [school, activeSessionObj, sessions]
  );

  const topTickerItems = useMemo(() => {
    const customItems = parseCustomTickerItems(school?.websiteConfig?.topTickerText);
    if (customItems.length > 0) return customItems;
    if (!school) return ["Admissions Open · Online Portal Active"];
    return buildDefaultSchoolTickerItems({ school, sessionLabel, admissionsOpen });
  }, [school, sessionLabel, admissionsOpen]);

  // Keep spacer height perfectly synchronized with the fixed top bar
  useLayoutEffect(() => {
    const el = fixedBarRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setBarHeight(h);
    };
    updateHeight();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [topTickerEnabled, school?.name]);

  // Smooth slow horizontal auto-scroll for ticker
  useEffect(() => {
    if (!topTickerEnabled) return;
    const container = tickerScrollRef.current;
    if (!container) return;
    let rafId = 0;
    let lastTs = 0;
    const speedPxPerSec = 26;
    const step = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(64, ts - lastTs);
      lastTs = ts;
      if (!tickerPausedRef.current && container.scrollWidth > container.clientWidth) {
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0) {
          container.scrollLeft += (speedPxPerSec * dt) / 1000;
          if (container.scrollLeft >= halfWidth) {
            container.scrollLeft -= halfWidth;
          }
        }
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [topTickerEnabled, topTickerItems]);

  const hasMultipleSchools = schools.length > 1 && Boolean(onSelectSchool);

  return (
    <>
      {/* Fixed Pinned Top Bar — Stays Visible on Every Website Page & Never Scrolls Away */}
      <div
        ref={fixedBarRef}
        className="fixed top-0 left-0 right-0 z-40 shadow-xs"
      >
        {/* Dark Ticker Strip */}
        {topTickerEnabled && (
          <div className="bg-[#070D19] text-slate-200 text-[11px] sm:text-xs border-b border-white/10">
            <div className="max-w-6xl mx-auto flex items-center gap-1.5 px-2 sm:px-3">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-amber-400 font-bold whitespace-nowrap shrink-0 border-r border-white/10">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Campus Updates</span>
              </div>

              <div
                ref={tickerScrollRef}
                onMouseEnter={() => {
                  tickerPausedRef.current = true;
                }}
                onMouseLeave={() => {
                  tickerPausedRef.current = false;
                }}
                onTouchStart={() => {
                  tickerPausedRef.current = true;
                }}
                onTouchEnd={() => {
                  tickerPausedRef.current = false;
                }}
                style={{
                  maskImage:
                    "linear-gradient(to right, transparent 0%, black 18px, black calc(100% - 18px), transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0%, black 18px, black calc(100% - 18px), transparent 100%)",
                }}
                className="flex-1 min-w-0 overflow-x-auto no-scrollbar touch-pan-x select-none py-2 px-3"
              >
                <div className="inline-flex items-center whitespace-nowrap w-max pl-3">
                  {[0, 1].map((dupIdx) => (
                    <div key={dupIdx} className="inline-flex items-center gap-4 pr-6">
                      {topTickerItems.map((itemText, idx) => {
                        const isPhoneItem = Boolean(
                          primaryPhone && itemText.includes(primaryPhone)
                        );
                        return (
                          <React.Fragment key={`${dupIdx}-${idx}`}>
                            {isPhoneItem ? (
                              <a
                                href={`tel:${primaryPhone}`}
                                className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 font-semibold whitespace-nowrap tabular-nums"
                              >
                                <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{itemText}</span>
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-white/90 font-medium whitespace-nowrap">
                                {itemText}
                              </span>
                            )}
                            <span
                              className="text-amber-400/80 font-bold select-none"
                              aria-hidden="true"
                            >
                              ✦
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {admissionsOpen && onOpenAdmission && (
                <button
                  type="button"
                  onClick={onOpenAdmission}
                  className="hidden md:inline-flex items-center px-3 py-2 text-amber-400 hover:text-amber-300 font-bold whitespace-nowrap shrink-0 border-l border-white/10 bg-[#070D19] cursor-pointer transition-colors"
                >
                  Apply {sessionLabel} →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Primary White/Dark Navigation Header */}
        <header className="bg-white/95 dark:bg-[#0B1324]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/90">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
            {/* Brand Logo + School Name */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 lg:flex-initial">
              <button
                type="button"
                onClick={() => onSelectSection("home")}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
              >
                {hasValidLogo ? (
                  <img
                    src={savedLogo}
                    alt={school?.name || "School"}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoFailed(true)}
                    className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-lg bg-white p-0.5 border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {(school?.name || "SC").slice(0, 2).toUpperCase()}
                  </div>
                )}

                <span className="text-xs sm:text-[15px] font-bold tracking-tight text-slate-950 dark:text-white truncate max-w-[165px] sm:max-w-[240px]">
                  {school?.name || "School Campus"}
                </span>
              </button>

              {hasMultipleSchools && (
                <button
                  type="button"
                  onClick={() => setIsSchoolPickerOpen((p) => !p)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer shrink-0"
                  title="Switch School Campus"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Desktop Nav Tabs */}
            <nav className="hidden lg:flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={`py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    activeSection === item.id
                      ? "border-slate-950 text-slate-950 dark:border-amber-400 dark:text-white"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right Controls: Account/Portal + Apply */}
            <div className="flex items-center gap-2 shrink-0">
              <LanguageToggleButton tone="auto" compact />
              <AndroidBatteryIndicator tone="auto" />
              {isAuthenticated && onSwitchToPortal ? (
                <button
                  type="button"
                  onClick={onSwitchToPortal}
                  className="px-3 py-1.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{portalButtonLabel}</span>
                  <span className="sm:hidden">Portal</span>
                </button>
              ) : (
                onOpenAccount && (
                  <button
                    type="button"
                    onClick={onOpenAccount}
                    className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border font-semibold text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeSection === "account"
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-500"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Account</span>
                  </button>
                )
              )}

              {admissionsOpen && onOpenAdmission && (
                <button
                  type="button"
                  onClick={onOpenAdmission}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 hidden sm:inline" />
                  <span className="hidden sm:inline">Apply Online</span>
                  <span className="sm:hidden">Apply</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Single-Line Nav Strip */}
          <div className="lg:hidden border-t border-slate-200/70 dark:border-slate-800 px-3 pr-5 flex items-center justify-between sm:justify-start sm:gap-5 gap-3 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  activeSection === item.id
                    ? "border-slate-950 text-slate-950 dark:border-amber-400 dark:text-white"
                    : "border-transparent text-slate-600 dark:text-slate-400"
                }`}
              >
                {item.mobileLabel || item.label}
              </button>
            ))}
          </div>
        </header>

        {/* Optional Quick Campus Switcher Dropdown */}
        {isSchoolPickerOpen && hasMultipleSchools && onSelectSchool && (
          <div className="bg-white dark:bg-[#0B1324] border-b border-slate-200 dark:border-slate-800 shadow-lg px-4 py-3">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Select School Campus</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsSchoolPickerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {schools.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSchool(s.id);
                      setIsSchoolPickerOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      s.id === school?.id
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exact-Height Spacer so Page Content Starts Cleanly Below Fixed Top Bar */}
      <div style={{ height: `${barHeight}px` }} aria-hidden="true" className="shrink-0" />
    </>
  );
};
