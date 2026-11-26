import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Award, Maximize2, Minimize2, Sparkles, User, X } from "lucide-react";
import type { School } from "../../school-types";
import {
  DOC_TYPE_META,
  LAYOUT_VARIANT_META,
  getLayoutArchitecture,
  type ArchFrameStyle,
  type ArchHeaderStyle,
  type DocumentTemplateType,
  type LayoutArchitectureSpec,
  type TemplateLayoutVariant,
  type TemplatePalette,
} from "../../utils/schoolDocumentTemplates";
import { cleanLogoUrl, getSavedSchoolLogo } from "./feeReceiptUtils";

export type MarksheetPreviewMode =
  | "portrait"
  | "landscape"
  | "two_side_p1"
  | "two_side_p2"
  | "two_side_both";

export type FeeSlipPreviewMode = "a4_paid" | "a4_demand" | "pos_80mm";

interface DocumentStudioRealPreviewProps {
  docType: DocumentTemplateType;
  school?: School | null;
  variant: TemplateLayoutVariant | "default";
  colors: TemplatePalette;
  borderStyle: "solid" | "double" | "dashed";
  logoPosition: "left" | "center" | "right";
  showWatermark: boolean;
  watermarkText: string;
  footerNote: string;
  leftSignatoryLabel: string;
  rightSignatoryLabel: string;
}

const SAMPLE_SUBJECTS = [
  { code: "041", name: "Mathematics", th: 74, mcq: 16, pr: 8, max: 100, pa1: 37, pa2: 34, hy: 86, pa3: 38, pa4: 39, ann: 98, high: 99, grade: "A+" },
  { code: "086", name: "Science & Tech", th: 68, mcq: 14, pr: 10, max: 100, pa1: 35, pa2: 32, hy: 84, pa3: 36, pa4: 37, ann: 92, high: 96, grade: "A+" },
  { code: "184", name: "English Core", th: 71, mcq: 15, pr: 8, max: 100, pa1: 36, pa2: 35, hy: 88, pa3: 37, pa4: 38, ann: 94, high: 97, grade: "A+" },
  { code: "087", name: "Social Science", th: 64, mcq: 14, pr: 9, max: 100, pa1: 33, pa2: 30, hy: 80, pa3: 34, pa4: 36, ann: 87, high: 94, grade: "A" },
  { code: "002", name: "Hindi Course-A", th: 69, mcq: 15, pr: 9, max: 100, pa1: 34, pa2: 33, hy: 85, pa3: 36, pa4: 37, ann: 93, high: 96, grade: "A+" },
  { code: "165", name: "Computer App", th: 44, mcq: 18, pr: 30, max: 100, pa1: 38, pa2: 36, hy: 90, pa3: 38, pa4: 39, ann: 92, high: 98, grade: "A+" },
];

const SAMPLE_TIMETABLE = [
  { date: "10 Mar 2027", day: "Wed", subject: "English Core (184)", time: "09:00 AM – 12:00 PM", room: "Hall A-02" },
  { date: "12 Mar 2027", day: "Fri", subject: "Mathematics (041)", time: "09:00 AM – 12:00 PM", room: "Hall A-02" },
  { date: "15 Mar 2027", day: "Mon", subject: "Science & Tech (086)", time: "09:00 AM – 12:00 PM", room: "Hall A-02" },
  { date: "17 Mar 2027", day: "Wed", subject: "Social Science (087)", time: "09:00 AM – 12:00 PM", room: "Hall A-02" },
  { date: "19 Mar 2027", day: "Fri", subject: "Hindi Course-A (002)", time: "09:00 AM – 12:00 PM", room: "Hall A-02" },
];

const SAMPLE_THOUGHTS = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Dream is not that which you see while sleeping; it is something that does not let you sleep.", author: "Dr. A.P.J. Abdul Kalam" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Arise, awake, and stop not until the goal is reached.", author: "Swami Vivekananda" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
];

export const DocumentStudioRealPreview: React.FC<DocumentStudioRealPreviewProps> = ({
  docType,
  school,
  variant,
  colors,
  borderStyle,
  logoPosition,
  showWatermark,
  watermarkText,
  footerNote,
  leftSignatoryLabel,
  rightSignatoryLabel,
}) => {
  const [msMode, setMsMode] = useState<MarksheetPreviewMode>("portrait");
  const [feeMode, setFeeMode] = useState<FeeSlipPreviewMode>("a4_paid");
  const [isZoomed, setIsZoomed] = useState(false);

  const scName = school?.name || "ST. XAVIER'S PUBLIC ACADEMY";
  const scAddress = school?.address || "Sector-14, Institutional Campus, New Delhi";
  const scPhone = school?.mobile || school?.phone || "+91 98765 43210";
  const scAff = school?.affiliation || "Affiliated to CBSE Pattern • ISO Certified Campus";
  const scLogo = getSavedSchoolLogo(school?.logoUrl, school?.id);
  const scInitials = scName.slice(0, 2).toUpperCase();
  const c = colors;

  const isDefault = variant === "default";
  const arch: LayoutArchitectureSpec = isDefault
    ? { headerStyle: "solid_gradient", frameStyle: "standard" }
    : getLayoutArchitecture(variant);

  const fStyle: ArchFrameStyle = arch.frameStyle;
  const hStyle: ArchHeaderStyle = arch.headerStyle;

  const isLeftSpine = fStyle === "left_spine" || fStyle === "left_wide";
  const isRightSpine = fStyle === "right_spine" || fStyle === "right_wide";
  const isWideSpine = fStyle === "left_wide" || fStyle === "right_wide";
  const isDualRails = fStyle === "dual_rails";
  const isBottomDock = fStyle === "bottom_dock";
  const isLanyard = fStyle === "lanyard_punch";
  const isPassport = fStyle === "passport_mrz";
  const isTicket = fStyle === "ticket_notch";
  const isBrackets = fStyle === "corner_brackets" || fStyle === "cyber_hud" || fStyle === "museum_plaque";
  const isBeveled = fStyle === "beveled";
  const isBlueprint = fStyle === "blueprint_grid";
  const isStacked = fStyle === "stacked_deck";
  const isArtDeco = fStyle === "art_deco";
  const isGuilloche = fStyle === "guilloche";
  const isDossier = fStyle === "dossier_tab";
  const isSwissCross = fStyle === "swiss_cross";
  const isDiamondCrest = fStyle === "diamond_crest";
  const isHeavyBars = fStyle === "heavy_bars";
  const isMonoStripe = fStyle === "mono_stripe";
  const isCheckered = fStyle === "checkered_rim";
  const isFolio = fStyle === "folio_ledger";
  const isLaurel = fStyle === "laurel_wreath";
  const isPostage = fStyle === "postage_stamp";
  const isZen = fStyle === "zen_asymmetric";
  const isHalo = fStyle === "concentric_halo";
  const isBookmark = fStyle === "bookmark_ribbon";
  const isTricolor = fStyle === "tricolor";
  const isOrnate = fStyle === "ornate_filigree" || fStyle === "diploma_parchment" || fStyle === "seal_center" || isLaurel;
  const isMatrix = fStyle === "matrix_boxed" || isFolio || variant === "cbse_board";
  const isInkSaver = fStyle === "ink_dashed" || variant === "minimal_grid" || isZen;
  const isFloating = Boolean(arch.pillBadges) || hStyle === "floating_pill" || isStacked;
  const isLightHeader = hStyle === "light_bar" || hStyle === "gazette_double" || hStyle === "editorial_split";

  const fontStyle: React.CSSProperties = {
    fontFamily: arch.serifFont ? "Georgia, 'Times New Roman', serif" : arch.monoAccent ? "'JetBrains Mono', monospace" : "'Plus Jakarta Sans', 'Inter', sans-serif",
  };

  const paperBg = arch.creamPaper ? "#fffdf4" : isBlueprint ? "#f8fbff" : isFolio ? "#fafdf7" : "#ffffff";

  const computeHeaderStyle = (): React.CSSProperties => {
    if (isDefault) {
      return { background: "#0f172a", color: "#ffffff" };
    }
    switch (hStyle) {
      case "diagonal":
        return { background: `linear-gradient(122deg, ${c.primaryColor} 60%, ${c.accentColor} 60.4%)`, color: c.headerTextColor };
      case "split_duotone":
        return { background: `linear-gradient(115deg, ${c.primaryColor} 54%, ${c.accentColor} 54.4%)`, color: c.headerTextColor };
      case "aurora":
        return { background: `linear-gradient(125deg, ${c.primaryColor}, ${c.accentColor}, #ec4899)`, color: c.headerTextColor };
      case "prism":
        return { background: `linear-gradient(135deg, ${c.primaryColor} 0%, ${c.accentColor} 45%, ${c.primaryColor} 46%, #0f172a 100%)`, color: c.headerTextColor };
      case "horizon":
        return { background: `radial-gradient(circle at 50% 125%, ${c.accentColor}, ${c.primaryColor} 72%)`, color: c.headerTextColor, borderBottomLeftRadius: "46% 18px", borderBottomRightRadius: "46% 18px" };
      case "arch":
        return { background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, borderBottomLeftRadius: "44% 20px", borderBottomRightRadius: "44% 20px" };
      case "wave":
        return { background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, borderBottomLeftRadius: "62% 22px", borderBottomRightRadius: "18% 6px" };
      case "scallop":
        return { background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, borderBottom: `4px dotted ${c.badgeBg}` };
      case "chevron":
        return { background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, clipPath: "polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)", paddingBottom: "18px" };
      case "obsidian":
        return { background: `linear-gradient(135deg, #09090b, ${c.primaryColor})`, color: c.headerTextColor, borderBottom: `3px solid ${c.accentColor}` };
      case "scoreboard":
        return { background: "#0f172a", color: "#ffffff", borderBottom: `4px solid ${c.accentColor}`, letterSpacing: "0.04em" };
      case "ribbon_3d":
        return { background: `linear-gradient(90deg, ${c.primaryColor}, ${c.accentColor}, ${c.primaryColor})`, color: c.headerTextColor, boxShadow: `0 4px 0 ${c.borderColor}` };
      case "floating_pill":
        return { background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, borderRadius: "9999px", margin: "6px 8px 4px" };
      case "scroll_header":
        return { background: `linear-gradient(180deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, borderRadius: "24px 24px 8px 8px", border: `2px double ${c.badgeBg}` };
      case "double_decker":
        return { background: c.primaryColor, color: c.headerTextColor, borderBottom: `6px solid ${c.accentColor}` };
      case "gazette_double":
        return { background: "#ffffff", color: c.primaryColor, borderTop: `3px double ${c.primaryColor}`, borderBottom: `3px double ${c.primaryColor}` };
      case "editorial_split":
        return { background: c.surfaceTint, color: c.primaryColor, borderLeft: `6px solid ${c.accentColor}`, borderBottom: `2px solid ${c.primaryColor}` };
      case "light_bar":
        return { background: isOrnate ? "#fffdf4" : "#ffffff", color: c.primaryColor, borderBottom: `2px solid ${c.borderColor}` };
      default:
        return { background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor };
    }
  };

  const renderLogo = (cls = "w-10 h-10", round = "rounded-xl") => (
    scLogo ? (
      <img
        src={cleanLogoUrl(scLogo)}
        alt="Logo"
        className={`${cls} ${round} object-contain bg-white border p-0.5 shrink-0`}
        style={{ borderColor: c.borderColor }}
      />
    ) : (
      <div
        className={`${cls} ${round} font-black text-xs flex items-center justify-center shrink-0 border shadow-2xs`}
        style={{
          backgroundColor: isLightHeader ? c.primaryColor : "#ffffff",
          color: isLightHeader ? "#ffffff" : c.primaryColor,
          borderColor: c.borderColor,
        }}
      >
        {scInitials}
      </div>
    )
  );

  // Outer Frame Shell wrapping ANY document sheet for all 60 variants
  const renderFramedSheet = (
    children: React.ReactNode,
    docTag: string,
    extraClass = "",
    compact = false
  ) => {
    const outerRadius = isBeveled
      ? "24px 4px 24px 4px"
      : arch.sharpCorners || isPostage || isBlueprint || isArtDeco || isGuilloche || isMatrix
      ? "2px"
      : isFloating
      ? "16px"
      : "10px";

    const baseFrameBw = isDefault ? "2px" : isHeavyBars ? "0px" : isGuilloche || isArtDeco || isOrnate || borderStyle === "double" ? "4px" : "2px";
    const frameStyleObj: React.CSSProperties = {
      ...fontStyle,
      borderRadius: outerRadius,
      borderColor: isDefault ? "#0f172a" : c.borderColor,
      borderStyle: isPostage || fStyle === "ink_dashed" ? "dashed" : isGuilloche || isArtDeco || isOrnate ? "double" : borderStyle,
      borderTopWidth: isHeavyBars ? "9px" : baseFrameBw,
      borderRightWidth: baseFrameBw,
      borderBottomWidth: isHeavyBars ? "9px" : baseFrameBw,
      borderLeftWidth: isMonoStripe ? "8px" : baseFrameBw,
      backgroundColor: isDefault ? "#ffffff" : paperBg,
      backgroundImage: isBlueprint
        ? `linear-gradient(${c.primaryColor}14 1px, transparent 1px), linear-gradient(90deg, ${c.primaryColor}14 1px, transparent 1px)`
        : isCheckered
        ? `repeating-linear-gradient(45deg, ${c.surfaceTint}, ${c.surfaceTint} 8px, #ffffff 8px, #ffffff 16px)`
        : undefined,
      backgroundSize: isBlueprint ? "14px 14px" : undefined,
      boxShadow: isArtDeco || isGuilloche || isOrnate
        ? `inset 0 0 0 3px ${paperBg}, inset 0 0 0 5px ${c.accentColor}`
        : fStyle === "museum_plaque"
        ? `inset 0 0 0 4px ${c.accentColor}45`
        : undefined,
    };

    const spineEl = (isLeftSpine || isRightSpine) && !isDefault ? (
      <div
        className={`${isWideSpine ? "w-[130px]" : "w-[74px]"} shrink-0 p-2.5 flex flex-col items-center justify-between text-center`}
        style={{ background: `linear-gradient(180deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor }}
      >
        <div className="flex flex-col items-center gap-1.5">
          {renderLogo(isWideSpine ? "w-11 h-11" : "w-9 h-9", "rounded-xl")}
          <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
            2026–27
          </span>
        </div>
        {isWideSpine && (
          <div className="w-full rounded-lg bg-white/15 p-1.5 text-[7.5px] font-bold space-y-0.5">
            <div className="uppercase tracking-wider opacity-80">Candidate</div>
            <div className="font-black truncate">Aarav Sharma</div>
            <div className="opacity-90">VIII-A • Roll #12</div>
          </div>
        )}
        <div className="text-[8px] font-black uppercase tracking-widest leading-tight opacity-95">
          {docTag}
        </div>
      </div>
    ) : null;

    return (
      <div className={`relative ${isStacked && !isDefault ? "pb-2 pr-2" : ""}`}>
        {isStacked && !isDefault && (
          <div
            className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl border-2"
            style={{ backgroundColor: c.accentColor + "30", borderColor: c.primaryColor }}
          />
        )}

        {isDossier && !isDefault && (
          <div className="flex items-end pl-3 -mb-px relative z-10">
            <div
              className="px-3 py-0.5 rounded-t-lg text-[8px] font-black uppercase tracking-wider border-t-2 border-x-2"
              style={{ backgroundColor: c.primaryColor, color: "#ffffff", borderColor: c.borderColor }}
            >
              RECORD FILE • {docTag}
            </div>
          </div>
        )}

        <div
          className={`relative overflow-hidden text-slate-900 shadow-lg flex ${
            isRightSpine && !isDefault ? "flex-row-reverse" : "flex-row"
          } ${extraClass}`}
          style={frameStyleObj}
        >
          {isDualRails && !isDefault && (
            <div className="w-3.5 shrink-0" style={{ background: `linear-gradient(180deg, ${c.primaryColor}, ${c.accentColor})` }} />
          )}
          {spineEl}

          <div className="flex-1 min-w-0 flex flex-col justify-between relative">
            {isLanyard && !isDefault && (
              <div className="py-1 flex justify-center" style={{ backgroundColor: c.primaryColor }}>
                <div className="w-12 h-2 rounded-full bg-white/90 border border-slate-400" />
              </div>
            )}

            {isTricolor && !isDefault && (
              <div className="h-2 w-full flex shrink-0">
                <div className="flex-1 bg-orange-500" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-emerald-600" />
              </div>
            )}

            {arch.topAccentBar && !isTricolor && !isDefault && (
              <div className="h-1.5 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${c.primaryColor}, ${c.accentColor})` }} />
            )}

            {isTicket && !isDefault && (
              <>
                <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 border-r-2 z-20" style={{ borderColor: c.borderColor }} />
                <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 border-l-2 z-20" style={{ borderColor: c.borderColor }} />
              </>
            )}

            {isBookmark && !isDefault && (
              <div
                className="absolute top-0 right-5 w-7 h-11 z-20 flex flex-col items-center justify-center text-[7px] font-black text-white shadow"
                style={{ backgroundColor: c.accentColor, clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)" }}
              >
                ★<br />26
              </div>
            )}

            {isBrackets && !isDefault && (
              <>
                <span className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 z-20 pointer-events-none" style={{ borderColor: c.accentColor }} />
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 z-20 pointer-events-none" style={{ borderColor: c.accentColor }} />
                <span className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 z-20 pointer-events-none" style={{ borderColor: c.accentColor }} />
                <span className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 z-20 pointer-events-none" style={{ borderColor: c.accentColor }} />
              </>
            )}

            {!isBrackets && arch.cornerSymbol && !isDefault && (
              <>
                <span className="absolute top-1 left-1.5 text-[11px] opacity-55 z-20 pointer-events-none" style={{ color: c.accentColor }}>{arch.cornerSymbol}</span>
                <span className="absolute top-1 right-1.5 text-[11px] opacity-55 z-20 pointer-events-none" style={{ color: c.accentColor }}>{arch.cornerSymbol}</span>
                <span className="absolute bottom-1 left-1.5 text-[11px] opacity-55 z-20 pointer-events-none" style={{ color: c.accentColor }}>{arch.cornerSymbol}</span>
                <span className="absolute bottom-1 right-1.5 text-[11px] opacity-55 z-20 pointer-events-none" style={{ color: c.accentColor }}>{arch.cornerSymbol}</span>
              </>
            )}

            {isDiamondCrest && !isDefault && (
              <div className="flex justify-center pt-1.5 -mb-2 relative z-20">
                <div className="w-5 h-5 rotate-45 border-2 flex items-center justify-center text-[8px] font-black shadow" style={{ backgroundColor: c.accentColor, borderColor: "#fff", color: "#fff" }}>
                  <span className="-rotate-45">❖</span>
                </div>
              </div>
            )}

            {isHalo && !isDefault && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <div className="w-44 h-44 rounded-full border-2 border-dashed opacity-15" style={{ borderColor: c.accentColor }} />
                <div className="absolute w-32 h-32 rounded-full border opacity-15" style={{ borderColor: c.primaryColor }} />
              </div>
            )}

            {showWatermark && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.055] z-0">
                <span className="text-4xl font-black uppercase tracking-widest -rotate-12" style={{ color: isDefault ? "#0f172a" : c.primaryColor }}>
                  {watermarkText || scName.slice(0, 10).toUpperCase()}
                </span>
              </div>
            )}

            <div className={`relative z-10 flex-1 flex flex-col justify-between ${isSwissCross && !isDefault ? "border-l-4 ml-1.5" : ""} ${compact ? "p-2.5" : "p-3"}`} style={isSwissCross && !isDefault ? { borderColor: c.accentColor } : undefined}>
              {children}

              {isPassport && !isDefault && (
                <div className="mt-2 px-2 py-0.5 rounded bg-slate-950 text-emerald-300 font-mono text-[7px] tracking-[0.16em] text-center truncate">
                  DOC&lt;IND&lt;AARAV&lt;SHARMA&lt;&lt;2026&lt;SCH104&lt;&lt;VERIFIED
                </div>
              )}
            </div>

            {isBottomDock && !isDefault && (
              <div className="px-3 py-1.5 flex items-center justify-between text-[7.5px] font-black relative z-10" style={{ backgroundColor: c.primaryColor, color: c.headerTextColor }}>
                <span>{leftSignatoryLabel}</span>
                <span className="px-2 py-0.5 rounded-full text-[6.5px]" style={{ backgroundColor: c.accentColor, color: "#fff" }}>
                  OFFICIAL VERIFIED
                </span>
                <span>{rightSignatoryLabel}</span>
              </div>
            )}

            {isTricolor && !isDefault && (
              <div className="h-1.5 w-full flex shrink-0">
                <div className="flex-1 bg-orange-500" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-emerald-600" />
              </div>
            )}
          </div>

          {isDualRails && !isDefault && (
            <div className="w-3.5 shrink-0" style={{ background: `linear-gradient(180deg, ${c.accentColor}, ${c.primaryColor})` }} />
          )}
        </div>
      </div>
    );
  };

  // Shared School Banner Header inside Real Documents
  const renderDocHeader = (badgeText: string, subLine: string, compact = false) => (
    <div
      className={`${compact ? "px-2.5 py-2 mb-2" : "px-3 py-2.5 mb-2.5"} relative z-10 ${
        isFloating && !isDefault ? "rounded-xl shadow-xs" : arch.sharpCorners ? "rounded-none" : "rounded-lg"
      }`}
      style={computeHeaderStyle()}
    >
      <div
        className={`flex items-center justify-between gap-2 ${
          logoPosition === "center" || hStyle === "arch" || hStyle === "gazette_double"
            ? "flex-col text-center"
            : logoPosition === "right"
            ? "flex-row-reverse text-right"
            : ""
        }`}
      >
        <div className={`flex items-center gap-2 min-w-0 ${logoPosition === "center" ? "flex-col" : logoPosition === "right" ? "flex-row-reverse text-right" : ""}`}>
          {renderLogo(compact ? "w-8 h-8" : "w-10 h-10", isFloating ? "rounded-full" : arch.sharpCorners ? "rounded-none" : "rounded-lg")}
          <div className="min-w-0">
            <div className={`${compact ? "text-[11px]" : "text-xs sm:text-[13px]"} font-black uppercase tracking-tight leading-tight truncate`}>
              {scName}
            </div>
            <div className="text-[7.5px] opacity-85 truncate">{scAddress}</div>
            <div className="text-[7px] font-bold uppercase opacity-80 truncate">{scAff}</div>
          </div>
        </div>
        <div className={logoPosition === "center" ? "text-center" : "text-right shrink-0"}>
          <span
            className={`inline-block px-2 py-0.5 text-[7.5px] font-black uppercase tracking-wider ${
              arch.pillBadges ? "rounded-full" : arch.skewBadge ? "-skew-x-10 rounded-xs" : "rounded"
            }`}
            style={{
              backgroundColor: isDefault ? "#f59e0b" : c.badgeBg,
              color: isDefault ? "#0f172a" : c.badgeText,
            }}
          >
            {badgeText}
          </span>
          <div className="text-[7px] font-bold opacity-90 mt-0.5">{subLine}</div>
        </div>
      </div>
    </div>
  );

  // Shared Table Header Style
  const tableHeaderStyle: React.CSSProperties = isDefault
    ? { backgroundColor: "#0f172a", color: "#ffffff" }
    : isInkSaver || isMatrix
    ? { backgroundColor: isInkSaver ? "#ffffff" : c.surfaceTint, color: c.primaryColor, borderBottom: `2px solid ${c.primaryColor}` }
    : { backgroundColor: c.primaryColor, color: c.headerTextColor };

  // ═══════════════════════════════════════════════════════════════════════
  // 1. REAL FEE SLIP PREVIEW (Official A6/A4 Paid, Demand Slip & 80mm POS)
  // ═══════════════════════════════════════════════════════════════════════
  const renderFeeSlipDocument = (wideZoom = false) => {
    if (feeMode === "pos_80mm") {
      const posBaseBw = isDefault ? "1px" : isOrnate || isGuilloche ? "3px" : "2px";
      return (
        <div className="flex justify-center py-1">
          <div
            className="w-[270px] bg-white text-slate-950 p-3 shadow-lg text-[9px] font-mono relative"
            style={{
              borderTopWidth: posBaseBw,
              borderBottomWidth: posBaseBw,
              borderLeftWidth: isLeftSpine || isDualRails || isMonoStripe ? "6px" : posBaseBw,
              borderRightWidth: isRightSpine || isDualRails ? "6px" : posBaseBw,
              borderStyle: isInkSaver || isTicket || isPostage ? "dashed" : isOrnate || isGuilloche ? "double" : borderStyle,
              borderColor: isDefault ? "#0f172a" : c.borderColor,
              backgroundColor: arch.creamPaper ? "#fffdf4" : "#ffffff",
            }}
          >
            <div
              className="text-center p-2 mb-1.5"
              style={
                isLightHeader
                  ? { borderBottom: `2px solid ${c.primaryColor}`, color: c.primaryColor }
                  : { background: isDefault ? "#0f172a" : `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor, borderRadius: hStyle === "floating_pill" ? "999px" : hStyle === "arch" ? "0 0 40% 40%" : "4px" }
              }
            >
              <div className="font-black text-[10.5px] uppercase">{scName}</div>
              <div className="text-[7px] opacity-85 truncate">{scAddress}</div>
              <div className="text-[7px] opacity-85">Helpline: {scPhone}</div>
            </div>
            <div className="text-center font-black text-[8.5px] py-0.5 mb-1.5 border-y" style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.borderColor }}>
              OFFICIAL FEE RECEIPT (80mm POS)
            </div>
            <div className="space-y-0.5 text-[8px] border-b border-dashed border-slate-400 pb-1.5 mb-1.5">
              <div className="flex justify-between"><span>Receipt No:</span><strong>#FEE-26-4092</strong></div>
              <div className="flex justify-between"><span>Date:</span><span>22 Nov 2026</span></div>
              <div className="flex justify-between"><span>Student:</span><strong className="uppercase">Aarav Kumar Sharma</strong></div>
              <div className="flex justify-between"><span>Class / Roll:</span><strong>VIII-A | Roll #12</strong></div>
              <div className="flex justify-between"><span>Pay Mode:</span><strong>UPI / GPay</strong></div>
            </div>
            <table className="w-full text-[8px] mb-1.5">
              <thead>
                <tr className="border-b border-slate-900">
                  <th className="text-left py-0.5">Particulars</th>
                  <th className="text-right py-0.5">Due</th>
                  <th className="text-right py-0.5">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-300">
                <tr><td className="py-0.5">Tuition Fee (Nov)</td><td className="text-right">2,400</td><td className="text-right font-bold">2,400</td></tr>
                <tr><td className="py-0.5">Bus / Transport</td><td className="text-right">800</td><td className="text-right font-bold">800</td></tr>
                <tr><td className="py-0.5">Exam &amp; Lab</td><td className="text-right">300</td><td className="text-right font-bold">300</td></tr>
              </tbody>
            </table>
            <div className="flex justify-between items-center px-2 py-1 font-black text-[9.5px] rounded" style={{ backgroundColor: c.primaryColor, color: c.headerTextColor }}>
              <span>TOTAL PAID:</span>
              <span className="tabular-nums">₹3,500</span>
            </div>
            <div className="flex flex-col items-center my-2">
              <div className="p-1 border border-slate-300 bg-white">
                <QRCode value="https://school.edu/verify/FEE-26-4092" size={44} level="L" />
              </div>
              <span className="text-[7px] font-bold mt-0.5">SCAN TO VERIFY RECEIPT</span>
            </div>
            <div className="border-t border-dashed border-slate-400 pt-1 flex justify-between text-[7.5px]">
              <span>{leftSignatoryLabel}</span>
              <span className="font-bold">{rightSignatoryLabel}</span>
            </div>
          </div>
        </div>
      );
    }

    const isDemand = feeMode === "a4_demand";
    return renderFramedSheet(
      <div className={`space-y-2 ${wideZoom ? "text-[11px]" : "text-[9px]"}`}>
        {renderDocHeader(
          isDemand ? "FEE DEMAND SLIP" : "OFFICIAL FEE RECEIPT",
          isDemand ? "Payment Due Notice • 2026–27" : "Student Copy • Session 2026–27",
          !wideZoom
        )}

        {/* Shaded Copy Banner */}
        <div
          className="px-2.5 py-1 border flex items-center justify-between font-black text-[8px] uppercase tracking-wide"
          style={{
            backgroundColor: isDefault ? "#e2e8f0" : c.badgeBg,
            color: isDefault ? "#0f172a" : c.badgeText,
            borderColor: isDefault ? "#0f172a" : c.borderColor,
            borderRadius: hStyle === "floating_pill" || arch.pillBadges ? "999px" : hStyle === "diagonal" ? "2px" : "4px",
            transform: arch.skewBadge ? "skewX(-6deg)" : undefined,
          }}
        >
          <span>{isDemand ? "FEE DEMAND SLIP • बकाया शुल्क तकादा" : "OFFICIAL FEE PAYMENT RECEIPT • शुल्क रसीद"}</span>
          <span>[ STUDENT COPY ]</span>
        </div>

        {/* 2-Column Student & Slip Metadata */}
        <div
          className={`grid grid-cols-2 gap-2 p-2 border ${isMatrix ? "rounded-none divide-x" : "rounded-lg"}`}
          style={{
            backgroundColor: isInkSaver ? "#ffffff" : isDefault ? "#f8fafc" : c.surfaceTint,
            borderColor: isDefault ? "#0f172a" : c.borderColor,
          }}
        >
          <div className="space-y-0.5 pr-1">
            <div><span className="text-slate-500 font-bold">Student: </span><strong className="text-slate-950 uppercase">AARAV KUMAR SHARMA</strong></div>
            <div><span className="text-slate-500 font-bold">Father: </span><strong>SHRI RAJESH SHARMA</strong></div>
            <div><span className="text-slate-500 font-bold">Class: </span><strong>VIII-A (Roll #12)</strong></div>
            <div><span className="text-slate-500 font-bold">Adm No: </span><strong className="font-mono tabular-nums">SCH/26/104</strong></div>
          </div>
          <div className="space-y-0.5 pl-1">
            <div><span className="text-slate-500 font-bold">{isDemand ? "Slip No: " : "Receipt No: "}</span><strong className="font-mono tabular-nums">#FEE-4092</strong></div>
            <div><span className="text-slate-500 font-bold">Date: </span><strong className="tabular-nums">22 Nov 2026</strong></div>
            <div><span className="text-slate-500 font-bold">Month: </span><strong>NOVEMBER 2026</strong></div>
            <div><span className="text-slate-500 font-bold">Mobile: </span><strong className="font-mono tabular-nums">9876543210</strong></div>
          </div>
        </div>

        {/* Itemized Fee Heads Table */}
        <div className={`overflow-hidden border ${isMatrix ? "rounded-none" : "rounded-lg"}`} style={{ borderColor: isDefault ? "#0f172a" : c.borderColor }}>
          <table className="w-full text-left border-collapse text-[8.5px]">
            <thead>
              <tr style={tableHeaderStyle}>
                <th className="py-1 px-1.5 w-6 text-center border-r border-white/20">Sl.</th>
                <th className="py-1 px-1.5 border-r border-white/20">Fee Particulars / शुल्क विवरण</th>
                <th className="py-1 px-1.5 text-right border-r border-white/20">Due</th>
                <th className="py-1 px-1.5 text-right border-r border-white/20">Con.</th>
                <th className="py-1 px-1.5 text-right">{isDemand ? "Payable" : "Paid"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr>
                <td className="py-1 px-1.5 text-center font-bold">1</td>
                <td className="py-1 px-1.5 font-semibold">Tuition Fee (November)</td>
                <td className="py-1 px-1.5 text-right tabular-nums">₹2,400</td>
                <td className="py-1 px-1.5 text-right tabular-nums">₹0</td>
                <td className="py-1 px-1.5 text-right font-black tabular-nums">₹2,400</td>
              </tr>
              <tr style={{ backgroundColor: isInkSaver ? "#ffffff" : c.surfaceTint }}>
                <td className="py-1 px-1.5 text-center font-bold">2</td>
                <td className="py-1 px-1.5 font-semibold">Transport / School Bus</td>
                <td className="py-1 px-1.5 text-right tabular-nums">₹800</td>
                <td className="py-1 px-1.5 text-right tabular-nums">₹0</td>
                <td className="py-1 px-1.5 text-right font-black tabular-nums">₹800</td>
              </tr>
              <tr>
                <td className="py-1 px-1.5 text-center font-bold">3</td>
                <td className="py-1 px-1.5 font-semibold">Computer &amp; Smart Lab</td>
                <td className="py-1 px-1.5 text-right tabular-nums">₹300</td>
                <td className="py-1 px-1.5 text-right tabular-nums">₹0</td>
                <td className="py-1 px-1.5 text-right font-black tabular-nums">₹300</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Grand Total Bar */}
        <div
          className="px-2.5 py-1.5 rounded border flex items-center justify-between font-black text-[9.5px]"
          style={
            isDemand
              ? { backgroundColor: "#fff1f2", color: "#9f1239", borderColor: "#f43f5e" }
              : hStyle === "obsidian" || variant === "compact_photo_focus"
              ? { backgroundColor: c.primaryColor, color: c.headerTextColor, borderColor: c.accentColor }
              : { backgroundColor: c.surfaceTint, color: c.primaryColor, borderColor: c.borderColor }
          }
        >
          <span>{isDemand ? "कुल देय राशि • NET PAYABLE DUE :" : "कुल प्राप्त राशि • TOTAL PAID :"}</span>
          <span className="text-[11px] tabular-nums">₹3,500</span>
        </div>

        <div className="px-2 py-1 border rounded text-[7.5px] bg-white" style={{ borderColor: c.borderColor + "66" }}>
          <strong>In Words:</strong> Three Thousand Five Hundred Rupees Only • Pay Mode: {isDemand ? "Pending (Cash/UPI)" : "UPI Verified"}
        </div>

        {/* QR + Signatures */}
        <div className="flex items-end justify-between pt-1.5 border-t" style={{ borderColor: c.borderColor + "55" }}>
          <div className="flex items-center gap-1.5">
            <div className="p-0.5 border border-slate-300 bg-white rounded">
              <QRCode value="https://school.edu/verify/FEE-4092" size={32} level="L" />
            </div>
            <div className="text-[7px] leading-tight">
              <strong className="block text-slate-900">{isDemand ? "Scan UPI & Pay" : "Verify QR"}</strong>
              <span className="text-slate-500">{footerNote.slice(0, 32)}</span>
            </div>
          </div>
          <div className="flex items-end gap-4 text-[7.5px] text-center">
            <div>
              <div className="w-16 border-b border-slate-400 h-3 mb-0.5" />
              <span className="font-bold text-slate-700">{leftSignatoryLabel}</span>
            </div>
            <div>
              <div className="w-16 border-b border-slate-400 h-3 mb-0.5" />
              <span className="font-black text-slate-950">{rightSignatoryLabel}</span>
            </div>
          </div>
        </div>
      </div>,
      "OFFICIAL FEE SLIP"
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 2. REAL MARKSHEET PREVIEW (A4 Portrait / A4 Landscape / 2-Side P1 & P2)
  // ═══════════════════════════════════════════════════════════════════════
  const renderMarksheetPortrait = (compact = false) =>
    renderFramedSheet(
      <div className={`space-y-1.5 ${compact ? "text-[8px]" : "text-[9px]"}`}>
        {renderDocHeader("FINAL MARKSHEET", "Annual Exam • Session 2026–27", compact)}

        {/* Student Card + Photo */}
        <div
          className={`p-2 border flex items-center justify-between gap-2 ${isMatrix ? "rounded-none" : "rounded-lg"}`}
          style={{ backgroundColor: isInkSaver ? "#ffffff" : c.surfaceTint, borderColor: isDefault ? "#cbd5e1" : c.borderColor + "80" }}
        >
          <div className={`flex-1 grid grid-cols-2 gap-x-2 gap-y-0.5 ${compact ? "text-[7px]" : "text-[8px]"}`}>
            <div><span className="text-slate-500 font-bold">Student: </span><strong className="text-slate-950">AARAV KUMAR SHARMA</strong></div>
            <div><span className="text-slate-500 font-bold">Roll No: </span><strong style={{ color: c.primaryColor }}>12</strong> • Adm: <strong>SCH/26/104</strong></div>
            <div><span className="text-slate-500 font-bold">Father: </span><strong>Shri Rajesh Sharma</strong></div>
            <div><span className="text-slate-500 font-bold">Class: </span><strong>Class VIII (Sec A)</strong></div>
            <div className="col-span-2 flex items-center gap-1.5 pt-0.5 flex-wrap">
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-black text-[7px]">PASSED WITH DISTINCTION</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-50 border border-amber-300 text-amber-900 font-black text-[7px]">🏅 Class Rank: 01/85</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-50 border border-sky-300 text-sky-900 font-black text-[7px]">🎖️ Sec Rank: 01/32</span>
            </div>
          </div>
          <div
            className={`${compact ? "w-10 h-12" : "w-12 h-14"} border-2 bg-white flex flex-col items-center justify-center shrink-0 ${
              isOrnate || hStyle === "arch" || hStyle === "floating_pill" ? "rounded-full" : isMatrix ? "rounded-none" : "rounded-md"
            }`}
            style={{ borderColor: isDefault ? "#0f172a" : c.primaryColor }}
          >
            <User className="w-5 h-5 text-slate-400" />
            <span className="text-[5.5px] font-black text-slate-500 uppercase">PHOTO</span>
          </div>
        </div>

        {/* 6-Subject Marks Table */}
        <div className={`overflow-hidden border ${isMatrix ? "rounded-none" : "rounded-lg"}`} style={{ borderColor: isDefault ? "#0f172a" : c.borderColor }}>
          <table className="w-full text-left border-collapse text-[7.5px]">
            <thead>
              <tr style={tableHeaderStyle}>
                <th className="py-1 px-1 text-center w-6 border-r border-white/20">Code</th>
                <th className="py-1 px-1.5 border-r border-white/20">Subject Name</th>
                <th className="py-1 px-1 text-center border-r border-white/20">Th</th>
                <th className="py-1 px-1 text-center border-r border-white/20">IA/Pr</th>
                <th className="py-1 px-1 text-center border-r border-white/20">Total</th>
                <th className="py-1 px-1 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {SAMPLE_SUBJECTS.map((s, idx) => (
                <tr key={s.code} style={{ backgroundColor: idx % 2 === 1 && !isInkSaver ? c.surfaceTint : "#ffffff" }}>
                  <td className="py-0.5 px-1 text-center font-mono text-slate-500 border-r border-slate-200">{s.code}</td>
                  <td className="py-0.5 px-1.5 font-bold text-slate-900 border-r border-slate-200">{s.name}</td>
                  <td className="py-0.5 px-1 text-center tabular-nums border-r border-slate-200">{s.th}</td>
                  <td className="py-0.5 px-1 text-center tabular-nums border-r border-slate-200">{s.mcq + s.pr}</td>
                  <td className="py-0.5 px-1 text-center font-black tabular-nums border-r border-slate-200" style={{ color: c.primaryColor }}>{s.ann}</td>
                  <td className="py-0.5 px-1 text-center font-black text-emerald-700">{s.grade}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className="font-black text-[7.5px]"
                style={
                  isInkSaver
                    ? { backgroundColor: "#ffffff", color: c.primaryColor, borderTop: `2px solid ${c.primaryColor}` }
                    : { backgroundColor: isDefault ? "#0f172a" : c.badgeBg, color: isDefault ? "#ffffff" : c.badgeText, borderTop: `1.5px solid ${c.borderColor}` }
                }
              >
                <td colSpan={4} className="py-1 px-1.5 text-right uppercase">Grand Total &amp; Percentage</td>
                <td className="py-1 px-1 text-center tabular-nums">556/600</td>
                <td className="py-1 px-1 text-center">92.7% (A+)</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Attendance + Summary + QR */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <div className="col-span-9 p-1.5 rounded border text-[7.5px] flex items-center justify-between" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "66" }}>
            <div>
              <span className="text-slate-500 font-bold block text-[6.5px]">Attendance</span>
              <strong className="tabular-nums">204 / 220 (93%)</strong>
            </div>
            <div>
              <span className="text-slate-500 font-bold block text-[6.5px]">Division / Result</span>
              <strong style={{ color: c.primaryColor }}>First Div. (Promoted to IX)</strong>
            </div>
          </div>
          <div className="col-span-3 flex items-center justify-end gap-1">
            <div className="p-0.5 border border-slate-300 rounded bg-white">
              <QRCode value="https://school.edu/verify/MS-104" size={28} level="L" />
            </div>
          </div>
        </div>

        {/* 3 Signatures */}
        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t text-center text-[7px]" style={{ borderColor: c.borderColor + "60" }}>
          <div><div className="h-2.5" /><span className="font-bold text-slate-700">{leftSignatoryLabel}</span></div>
          <div><div className="h-2.5" /><span className="font-bold text-slate-700">Exam Controller</span></div>
          <div><div className="h-2.5" /><span className="font-black text-slate-950">{rightSignatoryLabel}</span></div>
        </div>
      </div>,
      "FINAL MARKSHEET"
    );

  const renderMarksheetLandscapePage1 = () =>
    renderFramedSheet(
      <div className="grid grid-cols-12 gap-2.5 items-stretch text-[7.5px]">
        {/* LEFT COLUMN (50%): Term-Wise Matrix + Attendance Correlation + Charts */}
        <div className="col-span-6 pr-2 border-r-2 space-y-1.5 flex flex-col justify-between" style={{ borderColor: isDefault ? "#0f172a" : c.borderColor }}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b pb-1" style={{ borderColor: c.borderColor }}>
              <div>
                <div className="font-black text-[8.5px] uppercase" style={{ color: c.primaryColor }}>
                  Continuous &amp; Comprehensive Evaluation
                </div>
                <div className="text-[6.5px] text-slate-500 font-bold">PA-1, PA-2, Half-Yr, PA-3, PA-4 &amp; Annual Progress</div>
              </div>
              <span className="px-1.5 py-0.5 rounded font-mono text-[6.5px] font-black" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                2026–27
              </span>
            </div>

            {/* Multi-Term Matrix */}
            <div className="border rounded overflow-hidden" style={{ borderColor: c.borderColor }}>
              <div className="px-1.5 py-0.5 text-[7px] font-black flex justify-between" style={tableHeaderStyle}>
                <span>TERM-WISE MARKS MATRIX</span>
                <span>PA1–ANN</span>
              </div>
              <table className="w-full text-[6.5px] border-collapse">
                <thead className="bg-slate-100 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-0.5 text-left">Subject</th>
                    <th className="p-0.5 text-center">PA1</th>
                    <th className="p-0.5 text-center">PA2</th>
                    <th className="p-0.5 text-center">HY</th>
                    <th className="p-0.5 text-center">PA3</th>
                    <th className="p-0.5 text-center">ANN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {SAMPLE_SUBJECTS.slice(0, 5).map((s) => (
                    <tr key={s.code}>
                      <td className="p-0.5 font-bold truncate max-w-[64px]">{s.name}</td>
                      <td className="p-0.5 text-center tabular-nums">{s.pa1}</td>
                      <td className="p-0.5 text-center tabular-nums">{s.pa2}</td>
                      <td className="p-0.5 text-center font-bold tabular-nums">{s.hy}</td>
                      <td className="p-0.5 text-center tabular-nums">{s.pa3}</td>
                      <td className="p-0.5 text-center font-black tabular-nums" style={{ color: c.primaryColor }}>{s.ann}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Donut + Score Timeline */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-1.5 rounded border bg-white flex items-center gap-1.5" style={{ borderColor: c.borderColor + "70" }}>
                <svg className="w-9 h-9 -rotate-90 shrink-0" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="15" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                  <circle cx="20" cy="20" r="15" fill="none" stroke={c.primaryColor} strokeWidth="5" strokeDasharray="82 95" />
                </svg>
                <div className="text-[6.5px] leading-tight">
                  <strong className="block text-slate-900">Mastery: 92.7%</strong>
                  <span className="text-emerald-700 font-bold">5 Strong • 1 Avg</span>
                </div>
              </div>
              <div className="p-1.5 rounded border bg-white" style={{ borderColor: c.borderColor + "70" }}>
                <div className="text-[6.5px] font-black mb-1" style={{ color: c.primaryColor }}>Score Timeline</div>
                <div className="flex items-end gap-1 h-6">
                  {[78, 72, 86, 89, 93].map((pct, i) => (
                    <div key={i} className="flex-1 rounded-t-xs" style={{ height: `${pct}%`, backgroundColor: i === 4 ? c.accentColor : c.primaryColor }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Part B Co-Scholastic */}
            <div className="border rounded overflow-hidden" style={{ borderColor: c.borderColor }}>
              <div className="px-1.5 py-0.5 text-[6.5px] font-black" style={tableHeaderStyle}>
                PART-B: CO-SCHOLASTIC &amp; LIFE SKILLS
              </div>
              <div className="p-1 grid grid-cols-2 gap-1 text-[6.5px] bg-white">
                <div className="flex justify-between"><span>Work Education</span><strong>A+</strong></div>
                <div className="flex justify-between"><span>Discipline</span><strong>A+</strong></div>
                <div className="flex justify-between"><span>Yoga &amp; Sports</span><strong>A+</strong></div>
                <div className="flex justify-between"><span>Art &amp; Craft</span><strong>A</strong></div>
              </div>
            </div>
          </div>

          <div className="border-t pt-1 flex justify-between text-[6.5px] text-slate-500" style={{ borderColor: c.borderColor + "55" }}>
            <span>Scale: 5.0 Grading</span>
            <span>Verified Audit</span>
          </div>
        </div>

        {/* RIGHT COLUMN (50%): Official Final Marksheet */}
        <div className="col-span-6 space-y-1.5 flex flex-col justify-between">
          <div className="space-y-1.5">
            {renderDocHeader("ACADEMIC TRANSCRIPT", "Session 2026–27", true)}

            <div className="p-1.5 rounded border flex items-center justify-between gap-1.5 text-[7px]" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "70" }}>
              <div className="space-y-0.5 min-w-0">
                <div className="font-black text-slate-950 truncate">AARAV KUMAR SHARMA</div>
                <div className="text-slate-600">Class VIII-A • Roll #12 • Adm SCH/26/104</div>
                <div className="flex gap-1">
                  <span className="px-1 rounded bg-emerald-100 text-emerald-800 font-black text-[6.5px]">PASS ✓</span>
                  <span className="px-1 rounded bg-amber-50 border border-amber-300 text-amber-900 font-black text-[6.5px]">Rank #01</span>
                </div>
              </div>
              <div className="w-9 h-11 border rounded bg-white flex items-center justify-center shrink-0 text-[5.5px] font-bold text-slate-400" style={{ borderColor: c.primaryColor }}>
                PHOTO
              </div>
            </div>

            <div className="border rounded overflow-hidden" style={{ borderColor: c.borderColor }}>
              <table className="w-full text-[6.5px] border-collapse">
                <thead>
                  <tr style={tableHeaderStyle}>
                    <th className="p-0.5 text-left">Subject</th>
                    <th className="p-0.5 text-center">Max</th>
                    <th className="p-0.5 text-center">Obt</th>
                    <th className="p-0.5 text-center">Grd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {SAMPLE_SUBJECTS.map((s, idx) => (
                    <tr key={s.code} style={{ backgroundColor: idx % 2 === 1 && !isInkSaver ? c.surfaceTint : "#ffffff" }}>
                      <td className="p-0.5 font-bold truncate max-w-[80px]">{s.name}</td>
                      <td className="p-0.5 text-center">100</td>
                      <td className="p-0.5 text-center font-black">{s.ann}</td>
                      <td className="p-0.5 text-center font-black text-emerald-700">{s.grade}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: c.badgeBg, color: c.badgeText }} className="font-black">
                    <td className="p-0.5">TOTAL</td>
                    <td className="p-0.5 text-center">600</td>
                    <td className="p-0.5 text-center">556</td>
                    <td className="p-0.5 text-center">92.7%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-1 border-t text-center text-[6.5px]" style={{ borderColor: c.borderColor + "60" }}>
            <span className="font-bold">{leftSignatoryLabel}</span>
            <span className="font-bold">Controller</span>
            <span className="font-black">{rightSignatoryLabel}</span>
          </div>
        </div>
      </div>,
      "2-SIDE MARKSHEET • PAGE 1 (FRONT)",
      "",
      true
    );

  const renderMarksheetLandscapePage2 = () =>
    renderFramedSheet(
      <div className="grid grid-cols-12 gap-2.5 items-stretch text-[7.5px]">
        {/* LEFT HALF: Student Cutout & 6 English Thoughts + ERP App QR */}
        <div className="col-span-6 pr-2 border-r-2 space-y-1.5 flex flex-col justify-between" style={{ borderColor: isDefault ? "#0f172a" : c.borderColor }}>
          <div className="rounded-md p-1.5 text-center" style={computeHeaderStyle()}>
            <div className="text-[6.5px] font-black uppercase tracking-widest opacity-85">Student Honor Profile</div>
            <div className="text-[9.5px] font-black uppercase tracking-wide">TOP RANKER &amp; DISTINCTION</div>
            <div className="grid grid-cols-3 border-t border-white/25 pt-1 mt-1 text-[7px]">
              <div><span className="opacity-80 block text-[6px]">AARAV SHARMA</span><strong>Roll #12</strong></div>
              <div className="border-x border-white/25"><span className="opacity-80 block text-[6px]">RANK</span><strong>#01</strong></div>
              <div><span className="opacity-80 block text-[6px]">OVERALL</span><strong>92.7%</strong></div>
            </div>
          </div>

          {/* 6 English Thoughts around Student Photo Cutout */}
          <div className="grid grid-cols-3 gap-1 items-center">
            <div className="space-y-1">
              {SAMPLE_THOUGHTS.slice(0, 2).map((t, i) => (
                <div key={i} className="p-1 rounded-lg border text-[6px] leading-tight" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}>
                  <p className="italic line-clamp-3">&ldquo;{t.text}&rdquo;</p>
                  <span className="font-black block text-right mt-0.5">— {t.author}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-20 rounded-md border-2 bg-white flex flex-col items-center justify-center shadow-xs" style={{ borderColor: c.primaryColor }}>
                <User className="w-8 h-8 text-slate-400" />
                <span className="text-[5.5px] font-black uppercase text-slate-500">Student Cutout</span>
              </div>
              <span className="text-[6.5px] font-black mt-0.5 uppercase">AARAV SHARMA</span>
            </div>
            <div className="space-y-1">
              {SAMPLE_THOUGHTS.slice(2, 4).map((t, i) => (
                <div key={i} className="p-1 rounded-lg border text-[6px] leading-tight" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}>
                  <p className="italic line-clamp-3">&ldquo;{t.text}&rdquo;</p>
                  <span className="font-black block text-right mt-0.5">— {t.author}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Thoughts 5 & 6 + Principal & Director */}
          <div className="grid grid-cols-4 gap-1 items-center">
            <div className="p-1 border rounded text-center bg-white">
              <User className="w-4 h-4 mx-auto text-slate-400" />
              <span className="text-[5.5px] font-black block mt-0.5">PRINCIPAL</span>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              {SAMPLE_THOUGHTS.slice(4, 6).map((t, i) => (
                <div key={i} className="p-1 rounded border text-[5.8px] leading-tight" style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.accentColor }}>
                  <p className="italic line-clamp-2">&ldquo;{t.text}&rdquo;</p>
                </div>
              ))}
            </div>
            <div className="p-1 border rounded text-center bg-white">
              <User className="w-4 h-4 mx-auto text-slate-400" />
              <span className="text-[5.5px] font-black block mt-0.5">DIRECTOR</span>
            </div>
          </div>

          {/* ERP Mobile App Strip */}
          <div className="rounded-lg border p-1.5 flex items-center gap-2 bg-white" style={{ borderColor: c.borderColor }}>
            <div className="p-0.5 border rounded bg-white shrink-0">
              <QRCode value="https://school.edu/app" size={30} level="L" />
            </div>
            <div className="min-w-0 flex-1 text-[6px]">
              <div className="font-black uppercase" style={{ color: c.primaryColor }}>SCHOOL ERP PARENT APP</div>
              <div className="text-slate-600 truncate">Live Attendance • Fee Receipts • Digital Marksheet • Bus Track</div>
            </div>
          </div>
        </div>

        {/* RIGHT HALF: School Promotional Poster Half Card */}
        <div className="col-span-6 space-y-1.5 flex flex-col justify-between">
          <div className="rounded-md p-2 text-center" style={computeHeaderStyle()}>
            <div className="flex items-center justify-between text-[6px] mb-1">
              <span className="px-1.5 py-0.2 rounded-full font-black" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                ✨ Discipline &amp; Excellence
              </span>
              <span className="px-1.5 py-0.2 rounded-full font-black bg-amber-400 text-slate-950">
                ADMISSIONS OPEN 2027
              </span>
            </div>
            <div className="flex items-center gap-2 text-left">
              {renderLogo("w-8 h-8", "rounded-lg")}
              <div className="min-w-0">
                <div className="font-black text-[9.5px] uppercase truncate">{scName}</div>
                <div className="text-[6.5px] opacity-85 truncate">{scAddress}</div>
              </div>
            </div>
          </div>

          <div className="px-2 py-0.5 rounded text-center font-black text-[7px] uppercase" style={{ backgroundColor: c.primaryColor, color: c.headerTextColor }}>
            KEY SCHOOL HIGHLIGHTS • हमारी विशेषताएँ
          </div>

          <div className="grid grid-cols-2 gap-1 text-[6.2px] flex-1 content-start">
            {[
              "Smart Interactive Classrooms",
              "100% CBSE Academic Focus",
              "CCTV Secured Campus & Bus",
              "Computer, Robotics & AI Lab",
              "Experienced Qualified Faculty",
              "Parent Mobile App & Alerts",
              "Sports, Yoga & Olympiad Prep",
              "Personal Attention & Doubt Care",
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-1 p-1 rounded border" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "45" }}>
                <span className="w-3 h-3 rounded-full text-[5.5px] font-black flex items-center justify-center shrink-0" style={{ backgroundColor: c.primaryColor, color: c.headerTextColor }}>
                  {idx + 1}
                </span>
                <span className="font-bold text-slate-800 truncate">{item}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-1 flex items-center justify-between text-[6.5px]" style={{ borderColor: c.borderColor }}>
            <div>
              <span className="px-1.5 py-0.5 rounded font-black text-[6px]" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                Shaping Bright Futures
              </span>
              <div className="text-slate-600 font-bold mt-0.5">📞 {scPhone}</div>
            </div>
            <div className="p-0.5 border border-slate-300 rounded bg-white">
              <QRCode value="https://school.edu/portal" size={24} level="L" />
            </div>
          </div>
        </div>
      </div>,
      "2-SIDE MARKSHEET • PAGE 2 (BACKSIDE)",
      "",
      true
    );

  // ═══════════════════════════════════════════════════════════════════════
  // 3. REAL ADMIT CARD PREVIEW
  // ═══════════════════════════════════════════════════════════════════════
  const renderAdmitCardDocument = (wideZoom = false) =>
    renderFramedSheet(
      <div className={`space-y-2 ${wideZoom ? "text-[10px]" : "text-[8.5px]"}`}>
        {renderDocHeader("EXAM ADMIT CARD", "Annual Exam • Session 2026–27", !wideZoom)}

        {/* Candidate Particulars + Photo/QR */}
        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-9 space-y-1.5">
            <div
              className={`grid grid-cols-2 gap-x-2 gap-y-0.5 p-2 border ${isMatrix ? "rounded-none" : "rounded-lg"} ${wideZoom ? "text-[9.5px]" : "text-[7.5px]"}`}
              style={{ backgroundColor: isInkSaver ? "#ffffff" : c.surfaceTint, borderColor: c.borderColor + "66" }}
            >
              <div><span className="text-slate-500 font-bold">Candidate: </span><strong className="text-slate-950">AARAV KUMAR SHARMA</strong></div>
              <div><span className="text-slate-500 font-bold">Roll No: </span><strong className="tabular-nums" style={{ color: c.primaryColor }}>10124</strong></div>
              <div><span className="text-slate-500 font-bold">Class &amp; Sec: </span><strong>Class VIII-A</strong></div>
              <div><span className="text-slate-500 font-bold">Adm No: </span><strong className="font-mono tabular-nums">SCH/26/104</strong></div>
              <div><span className="text-slate-500 font-bold">Father: </span><strong>Shri Rajesh Sharma</strong></div>
              <div><span className="text-slate-500 font-bold">Phone: </span><strong className="tabular-nums">9876543210</strong></div>
            </div>
            <div className="px-2 py-1 rounded border flex items-center justify-between text-[7.5px]" style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.accentColor + "70" }}>
              <span className="font-bold">Examination Center:</span>
              <span className="font-black">Main Campus Block-A • Room 04</span>
            </div>
          </div>

          <div className="col-span-3 flex flex-col items-center gap-1">
            <div
              className={`w-13 h-15 border-2 bg-white flex flex-col items-center justify-center ${
                hStyle === "arch" || isFloating ? "rounded-xl" : isMatrix ? "rounded-none" : "rounded-lg"
              }`}
              style={{ borderColor: c.primaryColor }}
            >
              <User className="w-5 h-5 text-slate-400" />
              <span className="text-[5.5px] font-black text-slate-500 uppercase">PHOTO</span>
            </div>
            <div className="p-0.5 border border-slate-300 bg-white rounded">
              <QRCode value="https://school.edu/admit/10124" size={28} level="L" />
            </div>
          </div>
        </div>

        {/* 5-Subject Exam Timetable */}
        <div className={`overflow-hidden border ${isMatrix ? "rounded-none" : "rounded-lg"}`} style={{ borderColor: isDefault ? "#0f172a" : c.borderColor }}>
          <table className="w-full text-left border-collapse text-[7.5px]">
            <thead>
              <tr style={tableHeaderStyle}>
                <th className="py-1 px-1.5 border-r border-white/20">Date</th>
                <th className="py-1 px-1.5 border-r border-white/20">Subject Name</th>
                <th className="py-1 px-1.5 border-r border-white/20">Timing</th>
                <th className="py-1 px-1.5 text-center">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {SAMPLE_TIMETABLE.map((row, idx) => (
                <tr key={row.date} style={{ backgroundColor: idx % 2 === 1 && !isInkSaver ? c.surfaceTint : "#ffffff" }}>
                  <td className="py-0.5 px-1.5 font-bold tabular-nums border-r border-slate-200">{row.date}</td>
                  <td className="py-0.5 px-1.5 font-black text-slate-900 border-r border-slate-200">{row.subject}</td>
                  <td className="py-0.5 px-1.5 tabular-nums border-r border-slate-200">{row.time}</td>
                  <td className="py-0.5 px-1.5 text-center font-bold">{row.room}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Exam Rules */}
        <div className="p-1.5 rounded border text-[6.8px] text-slate-700 space-y-0.5" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}>
          <strong className="uppercase block" style={{ color: c.primaryColor }}>Important Instructions:</strong>
          <div>• Bring Admit Card &amp; School ID daily; electronic gadgets/calculators strictly prohibited.</div>
          <div>• Report at Examination Hall 20 minutes before commencement time.</div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t text-center text-[7px]" style={{ borderColor: c.borderColor + "60" }}>
          <div><div className="h-2.5" /><span className="font-bold text-slate-600">Candidate Sign</span></div>
          <div><div className="h-2.5" /><span className="font-bold text-slate-800">{leftSignatoryLabel}</span></div>
          <div><div className="h-2.5" /><span className="font-black text-slate-950">{rightSignatoryLabel}</span></div>
        </div>
      </div>,
      "HALL TICKET"
    );

  // ═══════════════════════════════════════════════════════════════════════
  // 4. REAL CERTIFICATE PREVIEW
  // ═══════════════════════════════════════════════════════════════════════
  const renderCertificateDocument = (wideZoom = false) =>
    renderFramedSheet(
      <div className={`space-y-2.5 ${wideZoom ? "text-[10.5px]" : "text-[8.5px]"}`}>
        {renderDocHeader("CERTIFICATE OF MERIT", "Dispatch: CERT/2026/089 • Date: 22 Nov 2026", !wideZoom)}

        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border"
            style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.accentColor }}
          >
            <Award className="w-3 h-3" /> CERTIFICATE OF ACADEMIC EXCELLENCE
          </div>
        </div>

        <div
          className={`p-3 border text-center space-y-1.5 ${isMatrix ? "rounded-none" : "rounded-xl"}`}
          style={{ backgroundColor: isInkSaver ? "#ffffff" : c.surfaceTint, borderColor: c.borderColor + "70" }}
        >
          <p className="text-[8px] italic text-slate-600">This is to proudly certify that Master / Miss</p>
          <div
            className="inline-block font-serif font-black text-sm uppercase tracking-wide px-3 py-0.5 border-b-2 rounded"
            style={{ color: c.primaryColor, borderColor: c.accentColor, backgroundColor: "#ffffff" }}
          >
            AARAV KUMAR SHARMA
          </div>
          <p className="text-[7.5px] text-slate-700 leading-relaxed">
            Son / Daughter of <strong>Shri Rajesh Sharma</strong>, regular student of <strong>Class VIII-A</strong> (Roll No: <strong>12</strong>, Adm No: <strong>SCH/26/104</strong>) has demonstrated exemplary academic excellence during Academic Session <strong>2026–27</strong>.
          </p>

          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full font-black text-[7.5px] border" style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.accentColor }}>
              🏆 1st Rank (Gold Medalist)
            </span>
            <span className="px-2.5 py-0.5 rounded-full font-black text-[7.5px]" style={{ backgroundColor: c.primaryColor, color: c.headerTextColor }}>
              Score: 92.7% • First Division
            </span>
          </div>
        </div>

        {isMatrix && (
          <div className="grid grid-cols-4 border text-[7px] font-mono bg-white" style={{ borderColor: c.borderColor }}>
            <div className="p-1 border-r" style={{ borderColor: c.borderColor }}>Roll: <strong>12</strong></div>
            <div className="p-1 border-r" style={{ borderColor: c.borderColor }}>Adm: <strong>104</strong></div>
            <div className="p-1 border-r" style={{ borderColor: c.borderColor }}>Cls: <strong>VIII-A</strong></div>
            <div className="p-1">Sess: <strong>26-27</strong></div>
          </div>
        )}

        <div className="grid grid-cols-4 items-end text-center pt-2 border-t text-[7px]" style={{ borderColor: c.borderColor + "60" }}>
          <div>
            <div className="h-4 border-b border-slate-400 mb-0.5" />
            <span className="font-bold text-slate-700">{leftSignatoryLabel}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="p-0.5 bg-white border border-slate-300 rounded">
              <QRCode value="https://school.edu/cert/089" size={28} level="L" />
            </div>
            <span className="text-[6px] text-slate-500 font-bold mt-0.5">Verify QR</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-[6px] font-black leading-tight" style={{ borderColor: c.accentColor, color: c.primaryColor, backgroundColor: c.badgeBg }}>
              GOLD<br />SEAL
            </div>
          </div>
          <div>
            <div className="h-4 border-b border-slate-400 mb-0.5" />
            <span className="font-black text-slate-950">{rightSignatoryLabel}</span>
          </div>
        </div>
      </div>,
      "HONOR CERTIFICATE"
    );

  // ═══════════════════════════════════════════════════════════════════════
  // 5. REAL ID CARD PREVIEW (CR80 Student Card)
  // ═══════════════════════════════════════════════════════════════════════
  const renderIdCardDocument = () => (
    <div className="flex justify-center py-1">
      <div className="w-full max-w-[330px]">
        {renderFramedSheet(
          <div className="space-y-2 text-[8.5px]">
            {renderDocHeader("STUDENT ID CARD", "Session 2026–27", true)}
            <div className="p-2 rounded-lg border flex items-center gap-2.5" style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "60" }}>
              <div
                className={`${variant === "compact_photo_focus" ? "w-14 h-16 border-2" : "w-12 h-14 border"} rounded-lg bg-white flex flex-col items-center justify-center shrink-0`}
                style={{ borderColor: c.primaryColor }}
              >
                <User className="w-6 h-6 text-slate-400" />
                <span className="text-[6px] font-black text-slate-500">PHOTO</span>
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="font-black text-[10.5px] text-slate-950 truncate">AARAV KUMAR SHARMA</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="px-1.5 py-0.2 rounded text-[6.5px] font-black" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                    Class VIII-A • Roll #12
                  </span>
                  <span className="px-1 py-0.2 rounded text-[6.5px] font-black bg-rose-100 text-rose-700">B+</span>
                </div>
                <div className="text-[7px] text-slate-600 truncate">Father: Shri Rajesh Sharma</div>
                <div className="text-[7px] text-slate-600 truncate">Adm: SCH/26/104 • Mob: 9876543210</div>
              </div>
              <div className="p-0.5 bg-white border border-slate-300 rounded shrink-0">
                <QRCode value="https://school.edu/id/104" size={34} level="L" />
              </div>
            </div>
            <div className="px-2 py-1 rounded border bg-white flex items-center justify-between text-[7px]" style={{ borderColor: c.borderColor + "45" }}>
              <span className="text-slate-500 font-bold">DOB: <strong className="text-slate-800">14-Aug-2012</strong></span>
              <span className="font-black" style={{ color: c.primaryColor }}>VALID SESSION: 2026–27</span>
            </div>
            <div className="pt-1 border-t flex items-end justify-between text-[7px]" style={{ borderColor: c.borderColor + "45" }}>
              <span className="font-bold text-slate-700">{leftSignatoryLabel}</span>
              <span className="text-[6.5px] text-slate-500 truncate max-w-[110px]">{footerNote}</span>
              <span className="font-black text-slate-950">{rightSignatoryLabel}</span>
            </div>
          </div>,
          "STUDENT ID CARD",
          "",
          true
        )}
      </div>
    </div>
  );

  const renderActivePreviewContent = (wideZoom = false) => {
    if (docType === "fee_slip") return renderFeeSlipDocument(wideZoom);
    if (docType === "admit_card") return renderAdmitCardDocument(wideZoom);
    if (docType === "certificate") return renderCertificateDocument(wideZoom);
    if (docType === "id_card") return renderIdCardDocument();

    // Marksheet Modes
    if (msMode === "portrait") return renderMarksheetPortrait(!wideZoom);
    if (msMode === "landscape" || msMode === "two_side_p1") return renderMarksheetLandscapePage1();
    if (msMode === "two_side_p2") return renderMarksheetLandscapePage2();
    return (
      <div className="space-y-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
            <span>📄 PAGE 1 (FRONT — Analysis + Official Marksheet)</span>
          </div>
          {renderMarksheetLandscapePage1()}
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
            <span>🖼️ PAGE 2 (BACKSIDE — Student Cutout &amp; 6 Thoughts + School Poster)</span>
          </div>
          {renderMarksheetLandscapePage2()}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Top Interactive Mode Switchers + Full Zoom Trigger */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {docType === "marksheet" ? (
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: "portrait", label: "A4 Portrait" },
              { id: "landscape", label: "A4 Landscape" },
              { id: "two_side_p1", label: "2-Side Page 1" },
              { id: "two_side_p2", label: "2-Side Page 2" },
              { id: "two_side_both", label: "Both Pages (P1+P2)" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMsMode(m.id as MarksheetPreviewMode)}
                className={`px-2 py-1 rounded-lg text-[9.5px] font-black border transition cursor-pointer ${
                  msMode === m.id
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : docType === "fee_slip" ? (
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { id: "a4_paid", label: "A6/A4 Paid Slip" },
              { id: "a4_demand", label: "Demand Due Slip" },
              { id: "pos_80mm", label: "80mm Thermal POS" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFeeMode(m.id as FeeSlipPreviewMode)}
                className={`px-2 py-1 rounded-lg text-[9.5px] font-black border transition cursor-pointer ${
                  feeMode === m.id
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            Real {DOC_TYPE_META[docType].label} Sheet Preview
          </span>
        )}

        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-indigo-600 text-amber-300 hover:text-white text-[9.5px] font-black flex items-center gap-1 transition cursor-pointer shrink-0"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Full Zoom Preview</span>
        </button>
      </div>

      {/* Live Preview Stage */}
      <div className="rounded-xl bg-slate-200/80 dark:bg-slate-900 p-2 sm:p-2.5 border border-slate-300 dark:border-slate-700 max-h-[430px] overflow-y-auto">
        {renderActivePreviewContent(false)}
      </div>

      {/* Full-Screen Zoom Modal */}
      {isZoomed && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-5xl max-h-[94vh] bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-black truncate">
                    Real Document Full Preview — {DOC_TYPE_META[docType].label} (
                    {isDefault ? "App Original Default" : `${LAYOUT_VARIANT_META[variant].code}: ${LAYOUT_VARIANT_META[variant].label}`}
                    )
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    Yahan dikhne wala layout aur structure print/PDF mein apply hoga
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Close Zoom</span>
                <X className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {docType === "marksheet" && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {[
                    { id: "portrait", label: "A4 Portrait" },
                    { id: "landscape", label: "A4 Landscape" },
                    { id: "two_side_p1", label: "2-Side Page 1 (Front)" },
                    { id: "two_side_p2", label: "2-Side Page 2 (Backside)" },
                    { id: "two_side_both", label: "2-Side Both Pages (Page 1 + Page 2)" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMsMode(m.id as MarksheetPreviewMode)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                        msMode === m.id
                          ? "bg-indigo-600 text-white border-indigo-500 shadow"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {docType === "fee_slip" && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {[
                    { id: "a4_paid", label: "Official A6/A4 Paid Receipt" },
                    { id: "a4_demand", label: "Fee Demand / Dues Slip" },
                    { id: "pos_80mm", label: "80mm Thermal POS Slip" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFeeMode(m.id as FeeSlipPreviewMode)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                        feeMode === m.id
                          ? "bg-indigo-600 text-white border-indigo-500 shadow"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="max-w-4xl mx-auto">
                {renderActivePreviewContent(true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
