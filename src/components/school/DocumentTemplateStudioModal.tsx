// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import {
  Palette,
  Plus,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Sparkles,
  X,
  ChevronLeft,
  Save,
  Layers,
  ShieldCheck,
  LayoutTemplate,
  Search,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import type { School } from "../../school-types";
import {
  type DocumentTemplateType,
  type DocumentTemplateConfig,
  type TemplatePalette,
  type TemplateLayoutVariant,
  type TemplateCategory,
  DOC_TYPE_META,
  LAYOUT_VARIANT_META,
  getLayoutArchitecture,
  getTemplatesForType,
  resolveActiveDocumentTemplate,
  setActiveTemplateForSchool,
  saveTemplateColorOverride,
  resetTemplateColors,
  saveCustomTemplate,
  deleteCustomTemplate,
  loadSchoolDocumentTemplatesState,
} from "../../utils/schoolDocumentTemplates";

interface Props {
  school: Partial<School> & { id?: string; name?: string };
  initialDocType?: DocumentTemplateType;
  asPage?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  onSchoolUpdated?: (patch: Partial<School>) => void;
  onTemplateApplied?: (docType: DocumentTemplateType, tpl: DocumentTemplateConfig) => void;
}

const COLOR_FIELDS: { key: keyof TemplatePalette; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Header / Main Color", hint: "मुख्य हेडर व टेबल बार" },
  { key: "accentColor", label: "Accent / Highlight", hint: "सब-हेडर व हाइलाइट पट्टी" },
  { key: "headerTextColor", label: "Header Text Color", hint: "हेडर के ऊपर लिखावट का रंग" },
  { key: "borderColor", label: "Border Color", hint: "कार्ड व शीट बॉर्डर" },
  { key: "badgeBg", label: "Badge / Pill BG", hint: "बैज व टैग बैकग्राउंड" },
  { key: "badgeText", label: "Badge Text Color", hint: "बैज अक्षरों का रंग" },
  { key: "surfaceTint", label: "Soft Surface Tint", hint: "बॉक्स व पट्टी का हल्का रंग" },
];

const CATEGORIES: ("ALL" | TemplateCategory)[] = [
  "ALL",
  "Royal & Heritage",
  "Modern & Tech",
  "Board & Official",
  "Minimal & Print",
  "Creative & Sports",
  "Diploma & Honor",
];

export const DocumentTemplateStudioModal: React.FC<Props> = ({
  school,
  initialDocType = "id_card",
  asPage = false,
  onClose,
  onBack,
  onSchoolUpdated,
  onTemplateApplied,
}) => {
  const schoolId = school?.id;
  const [docType, setDocType] = useState<DocumentTemplateType>(initialDocType);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"ALL" | TemplateCategory>("ALL");

  useEffect(() => {
    setDocType(initialDocType);
  }, [initialDocType]);

  const templates = useMemo(
    () => getTemplatesForType(schoolId, school, docType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schoolId, school, docType, refreshTick]
  );

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (activeCategory !== "ALL" && !tpl.isDefault && !tpl.isCustom) {
        const cat = tpl.category || (tpl.layoutVariant ? LAYOUT_VARIANT_META[tpl.layoutVariant]?.category : undefined);
        if (cat !== activeCategory) return false;
      }
      if (!q) return true;
      const lvLabel = tpl.layoutVariant ? LAYOUT_VARIANT_META[tpl.layoutVariant]?.label || "" : "";
      return (
        tpl.name.toLowerCase().includes(q) ||
        (tpl.hindiTag || "").toLowerCase().includes(q) ||
        (tpl.category || "").toLowerCase().includes(q) ||
        lvLabel.toLowerCase().includes(q)
      );
    });
  }, [templates, activeCategory, searchQuery]);

  const activeTemplate = useMemo(
    () => resolveActiveDocumentTemplate(schoolId, school, docType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schoolId, school, docType, refreshTick]
  );

  const [selectedTplId, setSelectedTplId] = useState<string>(activeTemplate.id);

  useEffect(() => {
    const resolved = resolveActiveDocumentTemplate(schoolId, school, docType);
    setSelectedTplId(resolved.id);
    setShowCreateForm(false);
  }, [docType, schoolId]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTplId) || activeTemplate,
    [templates, selectedTplId, activeTemplate]
  );

  const [draftColors, setDraftColors] = useState<TemplatePalette>(selectedTemplate.colors);
  useEffect(() => {
    setDraftColors({ ...selectedTemplate.colors });
  }, [selectedTemplate.id, selectedTemplate.colors]);

  // Custom Template Creation Form State
  const [newName, setNewName] = useState("");
  const [newLayoutVariant, setNewLayoutVariant] = useState<TemplateLayoutVariant>("classic_ribbon");
  const [newBorderStyle, setNewBorderStyle] = useState<"solid" | "double" | "dashed">("double");
  const [newLogoPos, setNewLogoPos] = useState<"left" | "center" | "right">("left");
  const [newShowWatermark, setNewShowWatermark] = useState(true);
  const [newWatermarkText, setNewWatermarkText] = useState(
    (school?.name || "OFFICIAL SCHOOL COPY").slice(0, 22).toUpperCase()
  );
  const [newFooterNote, setNewFooterNote] = useState(DOC_TYPE_META[docType].defaultFooter);
  const [newLeftSign, setNewLeftSign] = useState(DOC_TYPE_META[docType].defaultLeftSign);
  const [newRightSign, setNewRightSign] = useState(DOC_TYPE_META[docType].defaultRightSign);
  const [newColors, setNewColors] = useState<TemplatePalette>({ ...selectedTemplate.colors });

  useEffect(() => {
    setNewFooterNote(DOC_TYPE_META[docType].defaultFooter);
    setNewLeftSign(DOC_TYPE_META[docType].defaultLeftSign);
    setNewRightSign(DOC_TYPE_META[docType].defaultRightSign);
  }, [docType]);

  const syncAfterChange = (appliedTpl?: DocumentTemplateConfig) => {
    setRefreshTick((t) => t + 1);
    const nextState = loadSchoolDocumentTemplatesState(schoolId, school);
    if (onSchoolUpdated) {
      onSchoolUpdated({ documentTemplates: nextState } as any);
    }
    if (appliedTpl && onTemplateApplied) {
      onTemplateApplied(docType, appliedTpl);
    }
  };

  const handleApplyTemplate = async (tpl: DocumentTemplateConfig) => {
    await setActiveTemplateForSchool(schoolId, school, docType, tpl.id);
    setSelectedTplId(tpl.id);
    syncAfterChange(tpl);
    toast.success(`✅ "${tpl.name}" ${DOC_TYPE_META[docType].label} par apply ho gaya!`);
  };

  const handleColorLiveSave = async (field: keyof TemplatePalette, value: string) => {
    const nextColors = { ...draftColors, [field]: value };
    setDraftColors(nextColors);
    await saveTemplateColorOverride(schoolId, school, docType, selectedTemplate.id, { [field]: value });
    if (selectedTemplate.id === "default") {
      toast.info("Tip: App Original Default को बिना बदले रखना बेहतर है; कस्टम रंग के लिए 01–60 में से कोई भी Design चुनें।");
    }
    syncAfterChange();
  };

  const handleResetColors = async () => {
    await resetTemplateColors(schoolId, school, docType, selectedTemplate.id);
    syncAfterChange();
    toast.success("🎨 Template ke original colors wapas reset ho gaye!");
  };

  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim().toUpperCase();
    if (!cleanName) {
      toast.error("Kripya naye template ka naam likhein!");
      return;
    }
    const created: DocumentTemplateConfig = {
      id: `custom_${docType}_${Date.now()}`,
      name: cleanName,
      hindiTag: `${LAYOUT_VARIANT_META[newLayoutVariant].label} · Custom`,
      category: LAYOUT_VARIANT_META[newLayoutVariant].category,
      docType,
      layoutVariant: newLayoutVariant,
      isCustom: true,
      isDefault: false,
      borderStyle: newBorderStyle,
      logoPosition: newLogoPos,
      showWatermark: newShowWatermark,
      watermarkText: (newWatermarkText || "OFFICIAL").trim().toUpperCase(),
      footerNote: newFooterNote.trim() || DOC_TYPE_META[docType].defaultFooter,
      leftSignatoryLabel: newLeftSign.trim() || DOC_TYPE_META[docType].defaultLeftSign,
      rightSignatoryLabel: newRightSign.trim() || DOC_TYPE_META[docType].defaultRightSign,
      colors: { ...newColors },
    };
    await saveCustomTemplate(schoolId, school, created, true);
    setSelectedTplId(created.id);
    setShowCreateForm(false);
    setNewName("");
    syncAfterChange(created);
    toast.success(`🎉 Custom Template "${created.name}" banakar apply kar diya gaya!`);
  };

  const handleDeleteCustom = async (tpl: DocumentTemplateConfig) => {
    await deleteCustomTemplate(schoolId, school, docType, tpl.id);
    setSelectedTplId("default");
    syncAfterChange();
    toast.success(`🗑️ Custom template "${tpl.name}" delete ho gaya.`);
  };

  const previewColors = showCreateForm ? newColors : draftColors;
  const previewVariant: TemplateLayoutVariant | "default" = showCreateForm
    ? newLayoutVariant
    : selectedTemplate.id === "default"
    ? "default"
    : selectedTemplate.layoutVariant || "classic_ribbon";
  const previewBorderStyle = showCreateForm ? newBorderStyle : selectedTemplate.borderStyle;
  const previewLogoPos = showCreateForm ? newLogoPos : selectedTemplate.logoPosition;
  const previewShowWatermark = showCreateForm ? newShowWatermark : selectedTemplate.showWatermark;
  const previewWatermarkText = showCreateForm
    ? newWatermarkText || "OFFICIAL"
    : selectedTemplate.watermarkText || (school?.name || "SCHOOL").slice(0, 12).toUpperCase();
  const previewFooter = showCreateForm
    ? newFooterNote
    : selectedTemplate.footerNote || DOC_TYPE_META[docType].defaultFooter;
  const previewLeftSign = showCreateForm
    ? newLeftSign
    : selectedTemplate.leftSignatoryLabel || DOC_TYPE_META[docType].defaultLeftSign;
  const previewRightSign = showCreateForm
    ? newRightSign
    : selectedTemplate.rightSignatoryLabel || DOC_TYPE_META[docType].defaultRightSign;

  // Renders structurally distinct live miniature preview matching ALL 60 layoutVariants (10 classic + 50 new) + all docTypes
  const renderLiveStructuralPreview = () => {
    const scName = school?.name || "LIFE MAKER PUBLIC SCHOOL";
    const c = previewColors;
    const isCert = docType === "certificate";
    const arch =
      previewVariant === "default"
        ? { headerStyle: "solid_gradient" as const, frameStyle: "standard" as const }
        : getLayoutArchitecture(previewVariant);

    const badgeTitle =
      docType === "id_card"
        ? "STUDENT ID CARD"
        : docType === "admit_card"
        ? "EXAM ADMIT CARD"
        : docType === "marksheet"
        ? "FINAL MARKSHEET"
        : docType === "certificate"
        ? "CERTIFICATE OF MERIT"
        : "OFFICIAL FEE SLIP";

    const paperBg = arch.creamPaper ? "#fffdf4" : arch.frameStyle === "blueprint_grid" ? "#f8fbff" : "#ffffff";
    const isLeftSpine = arch.frameStyle === "left_spine" || arch.frameStyle === "left_wide";
    const isRightSpine = arch.frameStyle === "right_spine" || arch.frameStyle === "right_wide";
    const isWideSpine = arch.frameStyle === "left_wide" || arch.frameStyle === "right_wide";
    const isDualRails = arch.frameStyle === "dual_rails";
    const isBottomDock = arch.frameStyle === "bottom_dock";
    const isLanyard = arch.frameStyle === "lanyard_punch";
    const isPassport = arch.frameStyle === "passport_mrz";
    const isTicket = arch.frameStyle === "ticket_notch";
    const isBrackets = arch.frameStyle === "corner_brackets";
    const isBeveled = arch.frameStyle === "beveled";
    const isBlueprint = arch.frameStyle === "blueprint_grid";
    const isStacked = arch.frameStyle === "stacked_deck";
    const isArtDeco = arch.frameStyle === "art_deco";
    const isGuilloche = arch.frameStyle === "guilloche";
    const isMuseum = arch.frameStyle === "museum_plaque";
    const isDossier = arch.frameStyle === "dossier_tab";
    const isSwissCross = arch.frameStyle === "swiss_cross";
    const isDiamondCrest = arch.frameStyle === "diamond_crest";
    const isHeavyBars = arch.frameStyle === "heavy_bars";
    const isMonoStripe = arch.frameStyle === "mono_stripe";
    const isCheckered = arch.frameStyle === "checkered_rim";
    const isFolio = arch.frameStyle === "folio_ledger";
    const isLaurel = arch.frameStyle === "laurel_wreath";
    const isCyber = arch.frameStyle === "cyber_hud";
    const isPostage = arch.frameStyle === "postage_stamp";
    const isZen = arch.frameStyle === "zen_asymmetric";
    const isHalo = arch.frameStyle === "concentric_halo";
    const isBookmark = arch.frameStyle === "bookmark_ribbon";
    const isOrnate = arch.frameStyle === "ornate_filigree" || arch.frameStyle === "diploma_parchment" || arch.frameStyle === "seal_center" || isLaurel;
    const isTricolor = arch.frameStyle === "tricolor";
    const isMatrix = arch.frameStyle === "matrix_boxed" || isFolio;

    const fontCls = arch.serifFont ? "font-serif" : arch.monoAccent ? "font-mono" : "";

    // Render authentic miniature body tailored specifically to each Document Type (ID Card, Admit Card, Marksheet, Fee Slip, Certificate)
    const renderBodyContent = (compact = false) => {
      const isSharp = arch.sharpCorners || isMatrix || previewVariant === "cbse_board";
      const boxRadius =
        previewVariant === "modern_floating" || previewVariant === "corporate_badge_card"
          ? "rounded-xl shadow-xs"
          : isSharp
          ? "rounded-none"
          : "rounded-lg";
      const isMinimalInk = previewVariant === "ink_saver_classic" || previewVariant === "minimal_grid";
      const tableHdrStyle: React.CSSProperties = isMinimalInk
        ? { backgroundColor: c.surfaceTint, color: c.primaryColor, borderBottom: `1.5px solid ${c.borderColor}` }
        : { backgroundColor: c.primaryColor, color: c.headerTextColor };

      if (isCert) {
        return (
          <div className="space-y-1.5">
            <div className="text-center">
              <div
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-widest border"
                style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.accentColor }}
              >
                <Award className="w-2.5 h-2.5" /> {badgeTitle}
              </div>
            </div>
            <div
              className={`p-2 ${boxRadius} border text-center space-y-1 relative`}
              style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}
            >
              <div className="text-[7px] italic text-slate-600">This is to proudly certify that Master / Miss</div>
              <div
                className="font-serif font-black text-[11px] uppercase tracking-wide inline-block px-2 py-0.5 border-b-2"
                style={{ color: c.primaryColor, borderColor: c.accentColor }}
              >
                AARAV KUMAR SHARMA
              </div>
              <div className="text-[7.5px] text-slate-700 leading-snug">
                S/o Shri Rajesh Sharma • Class VIII-A (Roll #12) has secured <strong>1st Rank (94.6%)</strong>
              </div>
              {!compact && (
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <span className="text-[7px] font-bold px-1.5 py-0.2 rounded border bg-white" style={{ borderColor: c.borderColor }}>
                    Cert No: TC/2026/089
                  </span>
                  <span
                    className="w-7 h-7 rounded-full border border-dashed flex items-center justify-center text-[5.5px] font-black leading-tight"
                    style={{ borderColor: c.accentColor, color: c.primaryColor, backgroundColor: c.badgeBg }}
                  >
                    GOLD<br />SEAL
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }

      if (docType === "id_card") {
        return (
          <div className="space-y-1.5">
            <div
              className={`p-2 ${boxRadius} border flex items-center gap-2`}
              style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}
            >
              <div
                className={`${previewVariant === "compact_photo_focus" ? "w-11 h-13 border-2" : "w-9 h-11 border"} rounded-md bg-white flex flex-col items-center justify-center text-[6px] font-black text-slate-500 shrink-0`}
                style={{ borderColor: c.primaryColor }}
              >
                <span>STUDENT</span>
                <span>PHOTO</span>
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="font-black text-[10px] text-slate-900 truncate">AARAV KUMAR SHARMA</div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="px-1.5 py-0.2 rounded text-[6.5px] font-black" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                    Class VIII-A • Roll #12
                  </span>
                  <span className="px-1 py-0.2 rounded text-[6.5px] font-black bg-rose-100 text-rose-700">B+</span>
                </div>
                <div className="text-[7px] text-slate-600 truncate">Father: Shri Rajesh Sharma</div>
                <div className="text-[7px] text-slate-600 truncate">Adm: SCH/26/104 • Mob: 9876543210</div>
              </div>
              {!compact && (
                <div
                  className="w-9 h-9 border rounded bg-white p-0.5 grid grid-cols-3 gap-0.5 shrink-0"
                  style={{ borderColor: c.borderColor }}
                  title="QR Verify"
                >
                  <span className="bg-slate-900" /><span className="bg-white" /><span className="bg-slate-900" />
                  <span className="bg-white" /><span className="bg-slate-900" /><span className="bg-white" />
                  <span className="bg-slate-900" /><span className="bg-slate-900" /><span className="bg-slate-900" />
                </div>
              )}
            </div>
            {!compact && (
              <div className="px-2 py-1 rounded border bg-white flex items-center justify-between text-[7px]" style={{ borderColor: c.borderColor + "45" }}>
                <span className="text-slate-500 font-bold">DOB: <strong className="text-slate-800">14-Aug-2012</strong></span>
                <span className="font-black" style={{ color: c.primaryColor }}>VALID SESSION: 2026–27</span>
              </div>
            )}
          </div>
        );
      }

      if (docType === "admit_card") {
        return (
          <div className="space-y-1.5">
            <div
              className={`p-1.5 ${boxRadius} border flex items-center justify-between gap-2`}
              style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}
            >
              <div className="min-w-0">
                <div className="font-black text-[9.5px] text-slate-900 truncate">AARAV KUMAR SHARMA</div>
                <div className="text-[7px] text-slate-600">Class VIII-A • Roll No: <strong>10124</strong> • Center: Block-A</div>
              </div>
              <div
                className="w-7 h-8 border rounded bg-white flex items-center justify-center text-[5.5px] font-black text-slate-500 shrink-0"
                style={{ borderColor: c.primaryColor }}
              >
                PHOTO
              </div>
            </div>
            <div className={`overflow-hidden border ${boxRadius}`} style={{ borderColor: c.borderColor }}>
              <div className="px-2 py-0.5 text-[7px] font-black flex justify-between" style={tableHdrStyle}>
                <span>EXAM DATE &amp; SUBJECT</span>
                <span>TIMING / ROOM</span>
              </div>
              <div className="divide-y text-[7.5px] bg-white" style={{ borderColor: c.borderColor + "30" }}>
                <div className="px-2 py-0.5 flex justify-between">
                  <span><strong>12 Mar:</strong> Mathematics</span>
                  <span className="font-bold text-slate-700">09:00 AM • R-04</span>
                </div>
                {!compact && (
                  <>
                    <div className="px-2 py-0.5 flex justify-between" style={{ backgroundColor: c.surfaceTint }}>
                      <span><strong>15 Mar:</strong> Science &amp; Tech</span>
                      <span className="font-bold text-slate-700">09:00 AM • R-04</span>
                    </div>
                    <div className="px-2 py-0.5 flex justify-between">
                      <span><strong>18 Mar:</strong> English Core</span>
                      <span className="font-bold text-slate-700">09:00 AM • R-04</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      }

      if (docType === "marksheet") {
        return (
          <div className="space-y-1.5">
            <div
              className={`p-1.5 ${boxRadius} border flex items-center justify-between gap-2`}
              style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}
            >
              <div className="min-w-0">
                <div className="font-black text-[9.5px] text-slate-900 truncate">AARAV KUMAR SHARMA</div>
                <div className="text-[7px] text-slate-600">Class VIII-A • Roll #12 • Adm: SCH/26/104</div>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[6.5px] font-black shrink-0" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                GRADE: A+
              </span>
            </div>
            <div className={`overflow-hidden border ${boxRadius}`} style={{ borderColor: c.borderColor }}>
              <div className="px-2 py-0.5 text-[7px] font-black grid grid-cols-12" style={tableHdrStyle}>
                <span className="col-span-6">SUBJECT</span>
                <span className="col-span-2 text-center">MAX</span>
                <span className="col-span-2 text-center">OBT</span>
                <span className="col-span-2 text-right">GR</span>
              </div>
              <div className="divide-y text-[7.5px] bg-white" style={{ borderColor: c.borderColor + "30" }}>
                <div className="px-2 py-0.5 grid grid-cols-12">
                  <span className="col-span-6 font-semibold">Mathematics</span>
                  <span className="col-span-2 text-center">100</span>
                  <span className="col-span-2 text-center font-black">98</span>
                  <span className="col-span-2 text-right font-black" style={{ color: c.primaryColor }}>A+</span>
                </div>
                {!compact && (
                  <div className="px-2 py-0.5 grid grid-cols-12" style={{ backgroundColor: c.surfaceTint }}>
                    <span className="col-span-6 font-semibold">Science &amp; English</span>
                    <span className="col-span-2 text-center">200</span>
                    <span className="col-span-2 text-center font-black">186</span>
                    <span className="col-span-2 text-right font-black" style={{ color: c.primaryColor }}>A+</span>
                  </div>
                )}
              </div>
              <div className="px-2 py-1 text-[7.5px] font-black flex justify-between border-t" style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.borderColor }}>
                <span>TOTAL: 284 / 300 (94.6%)</span>
                <span>RESULT: PASS ✓</span>
              </div>
            </div>
          </div>
        );
      }

      // docType === "fee_slip" (Official School Fee Receipt Preview)
      return (
        <div className="space-y-1.5">
          <div
            className={`p-1.5 ${boxRadius} border flex items-center justify-between gap-2`}
            style={{ backgroundColor: c.surfaceTint, borderColor: c.borderColor + "55" }}
          >
            <div className="min-w-0">
              <div className="font-black text-[9.5px] text-slate-900 truncate">AARAV KUMAR SHARMA</div>
              <div className="text-[7px] text-slate-600">Receipt: <strong>#FEE-4092</strong> • Class VIII-A • 22 Nov 2026</div>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
              PAID ✓
            </span>
          </div>
          <div className={`overflow-hidden border ${boxRadius}`} style={{ borderColor: c.borderColor }}>
            <div className="px-2 py-0.5 text-[7px] font-black grid grid-cols-12" style={tableHdrStyle}>
              <span className="col-span-6">FEE PARTICULAR</span>
              <span className="col-span-3 text-right">DUE</span>
              <span className="col-span-3 text-right">PAID</span>
            </div>
            <div className="divide-y text-[7.5px] bg-white" style={{ borderColor: c.borderColor + "30" }}>
              <div className="px-2 py-0.5 grid grid-cols-12">
                <span className="col-span-6 font-semibold">Tuition Fee (Nov)</span>
                <span className="col-span-3 text-right">₹2,400</span>
                <span className="col-span-3 text-right font-black">₹2,400</span>
              </div>
              {!compact && (
                <div className="px-2 py-0.5 grid grid-cols-12" style={{ backgroundColor: c.surfaceTint }}>
                  <span className="col-span-6 font-semibold">Transport / Bus Fee</span>
                  <span className="col-span-3 text-right">₹800</span>
                  <span className="col-span-3 text-right font-black">₹800</span>
                </div>
              )}
            </div>
            <div className="px-2 py-1 text-[7.5px] font-black flex justify-between border-t" style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.borderColor }}>
              <span>TOTAL PAID: ₹3,200</span>
              <span>BAL DUE: ₹0 (UPI)</span>
            </div>
          </div>
        </div>
      );
    };

    // Left/Right Vertical Spine OR Wide 35% Profile Column (Layouts 02, 12, 41, 42)
    if (isLeftSpine || isRightSpine) {
      const spineBlock = (
        <div
          className={`${isWideSpine ? "w-24" : "w-18"} shrink-0 p-2 flex flex-col items-center justify-between text-center`}
          style={{ background: `linear-gradient(180deg, ${c.primaryColor}, ${c.accentColor})`, color: c.headerTextColor }}
        >
          <div className="w-8 h-8 rounded-lg bg-white text-slate-900 font-black text-xs flex items-center justify-center shadow">
            {scName.slice(0, 2).toUpperCase()}
          </div>
          {isWideSpine && (
            <div className="text-[6.5px] font-bold bg-white/15 px-1.5 py-1 rounded w-full">
              {docType === "fee_slip" ? "#FEE-4092" : "AARAV KUMAR"}<br />VIII-A • #12
            </div>
          )}
          <div className="text-[7px] font-black uppercase tracking-widest leading-tight">{badgeTitle}</div>
          <div className="px-1.5 py-0.5 rounded text-[6.5px] font-black" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
            2026-27
          </div>
        </div>
      );

      return (
        <div
          className={`rounded-xl overflow-hidden flex shadow-md relative ${isRightSpine ? "flex-row-reverse" : "flex-row"} ${fontCls}`}
          style={{ background: paperBg, border: `2px ${previewBorderStyle} ${c.borderColor}` }}
        >
          {spineBlock}
          <div className="flex-1 p-2 space-y-1.5 text-[9px] min-w-0">
            <div className="flex items-start justify-between border-b pb-1" style={{ borderColor: c.borderColor + "40" }}>
              <div className="min-w-0">
                <div className="font-black text-[11px] text-slate-900 uppercase leading-tight truncate">{scName}</div>
                <div className="text-[7.5px] text-slate-500">
                  {DOC_TYPE_META[docType].label} • {isWideSpine ? "35% Column Layout" : "Vertical Spine"}
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[6.5px] font-black shrink-0" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                {badgeTitle}
              </span>
            </div>
            {renderBodyContent(true)}
            <div className="flex justify-between items-end pt-1 border-t text-[7px] text-slate-600" style={{ borderColor: c.borderColor + "35" }}>
              <span className="font-bold truncate">{previewLeftSign}</span>
              <span className="font-black text-slate-900 truncate">{previewRightSign}</span>
            </div>
          </div>
        </div>
      );
    }

    // Twin Vertical Rails (Layout 23)
    if (isDualRails) {
      return (
        <div
          className={`rounded-xl overflow-hidden flex shadow-md relative ${fontCls}`}
          style={{ background: paperBg, border: `2px solid ${c.borderColor}` }}
        >
          <div className="w-3.5 shrink-0" style={{ background: `linear-gradient(180deg, ${c.primaryColor}, ${c.accentColor})` }} />
          <div className="flex-1 p-2.5 space-y-2 text-[9.5px] min-w-0">
            <div className="text-center border-b-2 pb-1.5" style={{ borderColor: c.accentColor }}>
              <div className="font-black text-xs uppercase" style={{ color: c.primaryColor }}>{scName}</div>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[7.5px] font-black" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>{badgeTitle}</span>
            </div>
            {renderBodyContent(false)}
            <div className="flex justify-between text-[7.5px] pt-1 border-t" style={{ borderColor: c.borderColor + "40" }}>
              <span className="font-bold">{previewLeftSign}</span>
              <span className="font-black">{previewRightSign}</span>
            </div>
          </div>
          <div className="w-3.5 shrink-0" style={{ background: `linear-gradient(180deg, ${c.accentColor}, ${c.primaryColor})` }} />
        </div>
      );
    }

    // Layout 09 & 18: 50/50 Dual-Tone Split or Dark Obsidian Executive
    if (previewVariant === "dual_tone_split" || previewVariant === "dark_executive_obsidian") {
      const isObsidian = previewVariant === "dark_executive_obsidian";
      return (
        <div
          className="rounded-xl overflow-hidden shadow-md relative"
          style={{ border: `${isObsidian ? "3px double" : "2px " + previewBorderStyle} ${c.borderColor}` }}
        >
          <div
            className="p-2.5 text-center space-y-1"
            style={{
              background: isObsidian
                ? `linear-gradient(135deg, #09090b, ${c.primaryColor})`
                : `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
              color: c.headerTextColor,
              borderBottom: isObsidian ? `2px solid ${c.accentColor}` : undefined,
            }}
          >
            <div className="flex items-center justify-between text-[8px]">
              <span className="font-black uppercase opacity-95 truncate">{scName}</span>
              <span className="px-1.5 py-0.5 rounded font-black shrink-0" style={{ backgroundColor: c.badgeBg, color: c.badgeText }}>
                {badgeTitle}
              </span>
            </div>
            <div className="text-[8px] opacity-90">
              {DOC_TYPE_META[docType].label} • Session 2026–27
            </div>
          </div>

          <div className="bg-white p-2.5 space-y-2 text-[9px]">
            {renderBodyContent(false)}
            <div className="flex justify-between items-center pt-1 border-t text-[7.5px] text-slate-600" style={{ borderColor: c.borderColor + "30" }}>
              <span>{previewLeftSign}</span>
              <span className="truncate max-w-[105px]">{previewFooter}</span>
              <span className="font-black text-slate-900">{previewRightSign}</span>
            </div>
          </div>
        </div>
      );
    }

    // Layout 07, 13, 20: Diploma / Heritage Ornate Filigree / Emblem Seal Centerpiece
    if (
      previewVariant === "certificate_diploma" ||
      previewVariant === "heritage_ornate_frame" ||
      previewVariant === "stamp_seal_watermark"
    ) {
      const isOrnateFrame = previewVariant === "heritage_ornate_frame";
      const isSealCenter = previewVariant === "stamp_seal_watermark";
      return (
        <div
          className="rounded-lg p-1.5 shadow-md relative"
          style={{
            background: isSealCenter ? "#ffffff" : "#fffdf4",
            border: `4px double ${c.borderColor}`,
          }}
        >
          <div className="p-2.5 rounded border relative space-y-2" style={{ borderColor: c.accentColor }}>
            {isOrnateFrame && (
              <>
                <span className="absolute top-0.5 left-1 text-[10px] opacity-60" style={{ color: c.accentColor }}>❧</span>
                <span className="absolute top-0.5 right-1 text-[10px] opacity-60" style={{ color: c.accentColor }}>❧</span>
                <span className="absolute bottom-0.5 left-1 text-[10px] opacity-60" style={{ color: c.accentColor }}>❧</span>
                <span className="absolute bottom-0.5 right-1 text-[10px] opacity-60" style={{ color: c.accentColor }}>❧</span>
              </>
            )}
            <div className="text-center border-b-2 pb-1.5" style={{ borderColor: c.borderColor }}>
              <div className="text-[7px] font-black tracking-[0.2em] uppercase" style={{ color: c.accentColor }}>
                ★ {isSealCenter ? "OFFICIAL SEAL & EMBLEM" : "INSTITUTIONAL HERITAGE DOCUMENT"} ★
              </div>
              <div className="font-serif text-xs font-black uppercase tracking-wide mt-0.5" style={{ color: c.primaryColor }}>
                {scName}
              </div>
              <span
                className="inline-block mt-1 px-3 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-widest border"
                style={{ backgroundColor: c.badgeBg, color: c.badgeText, borderColor: c.accentColor }}
              >
                {badgeTitle}
              </span>
            </div>

            {renderBodyContent(false)}

            <div className="border-t pt-1.5 flex justify-between text-[7.5px]" style={{ borderColor: c.borderColor + "40" }}>
              <span className="font-bold text-slate-700">{previewLeftSign}</span>
              <span className="italic text-slate-500 truncate max-w-[110px]">{previewFooter}</span>
              <span className="font-black text-slate-900">{previewRightSign}</span>
            </div>
          </div>
        </div>
      );
    }

    // Remaining 54 Structural Combinations (Headers: Wave, Arch, Chevron, Scallop, Prism, Horizon, Diagonal, Ribbon3D, FloatingPill, Scoreboard, DoubleDecker, Scroll, Gazette, Editorial, Obsidian; Frames: Lanyard, Passport MRZ, Ticket Notch, Corner Brackets, Beveled Octagon, Blueprint Grid, Stacked Deck, Art Deco, Guilloche, Museum Plaque, Dossier Tab, Swiss Cross, Diamond Crest, Heavy Bars, Mono Stripe, Checkered Rim, Folio, Laurel, Cyber HUD, Postage, Zen, Halo, Bookmark, Bottom Dock)
    const isLightHdrVariant =
      arch.headerStyle === "light_bar" ||
      arch.headerStyle === "gazette_double" ||
      arch.headerStyle === "editorial_split";

    const computeHeaderStyle = (): React.CSSProperties => {
      switch (arch.headerStyle) {
        case "diagonal":
          return { background: `linear-gradient(120deg, ${c.primaryColor} 63%, ${c.accentColor} 63.4%)`, color: c.headerTextColor };
        case "aurora":
          return { background: `linear-gradient(125deg, ${c.primaryColor}, ${c.accentColor}, #ec4899)`, color: c.headerTextColor };
        case "prism":
          return {
            background: `linear-gradient(135deg, ${c.primaryColor} 0%, ${c.accentColor} 45%, ${c.primaryColor} 46%, #0f172a 100%)`,
            color: c.headerTextColor,
          };
        case "horizon":
          return {
            background: `radial-gradient(circle at 50% 120%, ${c.accentColor}, ${c.primaryColor} 72%)`,
            color: c.headerTextColor,
            borderBottomLeftRadius: "50% 16px",
            borderBottomRightRadius: "50% 16px",
          };
        case "arch":
          return {
            background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
            borderBottomLeftRadius: "42% 18px",
            borderBottomRightRadius: "42% 18px",
          };
        case "wave":
          return {
            background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
            borderBottomLeftRadius: "60% 20px",
            borderBottomRightRadius: "20% 6px",
          };
        case "scallop":
          return {
            background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
            borderBottom: `4px dotted ${c.badgeBg}`,
          };
        case "chevron":
          return {
            background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
            clipPath: "polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)",
            paddingBottom: "16px",
          };
        case "obsidian":
          return {
            background: `linear-gradient(135deg, #09090b, ${c.primaryColor})`,
            color: c.headerTextColor,
            borderBottom: `2px solid ${c.accentColor}`,
          };
        case "scoreboard":
          return {
            background: "#0f172a",
            color: "#ffffff",
            borderBottom: `3px solid ${c.accentColor}`,
            letterSpacing: "0.08em",
          };
        case "ribbon_3d":
          return {
            background: `linear-gradient(90deg, ${c.primaryColor}, ${c.accentColor}, ${c.primaryColor})`,
            color: c.headerTextColor,
            margin: "6px -4px 0",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          };
        case "floating_pill":
          return {
            background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
            margin: "8px 10px 0",
            borderRadius: "9999px",
          };
        case "scroll_header":
          return {
            background: `linear-gradient(180deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
            borderRadius: "9999px",
            margin: "6px 8px 0",
            border: `2px solid ${c.borderColor}`,
          };
        case "double_decker":
          return {
            background: c.primaryColor,
            color: c.headerTextColor,
            borderBottom: `6px solid ${c.accentColor}`,
          };
        case "gazette_double":
          return {
            backgroundColor: "#ffffff",
            color: "#0f172a",
            borderBottom: `4px double ${c.borderColor}`,
          };
        case "editorial_split":
          return {
            backgroundColor: "#ffffff",
            color: "#0f172a",
            borderBottom: `2px solid ${c.accentColor}`,
          };
        case "light_bar":
          return {
            backgroundColor: "#ffffff",
            color: "#0f172a",
            borderBottom: `2px solid ${c.borderColor}`,
          };
        default:
          return {
            background: `linear-gradient(135deg, ${c.primaryColor}, ${c.accentColor})`,
            color: c.headerTextColor,
          };
      }
    };

    return (
      <div className={`relative ${isStacked ? "pb-1.5 pr-1.5" : ""} ${fontCls}`}>
        {isStacked && (
          <div
            className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-xl border-2"
            style={{ backgroundColor: c.accentColor + "30", borderColor: c.primaryColor }}
          />
        )}

        {/* Dossier Folder Tab */}
        {isDossier && (
          <div className="flex items-end pl-3 -mb-px relative z-10">
            <div
              className="px-3 py-0.5 rounded-t-lg text-[8px] font-black uppercase tracking-wider border-t-2 border-x-2"
              style={{ backgroundColor: c.primaryColor, color: "#ffffff", borderColor: c.borderColor }}
            >
              FILE NO: SCH-2026 • {badgeTitle}
            </div>
          </div>
        )}

        <div
          className="overflow-hidden text-slate-900 relative shadow-md"
          style={{
            borderRadius: isBeveled
              ? "18px 2px 18px 2px"
              : arch.sharpCorners || isPostage || isBlueprint || isArtDeco || isGuilloche
              ? "3px"
              : "14px",
            borderWidth: isHeavyBars ? "0px" : isGuilloche || isArtDeco || previewBorderStyle === "double" ? "4px" : "2px",
            borderStyle: isPostage || arch.frameStyle === "ink_dashed" ? "dashed" : isGuilloche || isArtDeco ? "double" : previewBorderStyle,
            borderColor: c.borderColor,
            borderTopWidth: isHeavyBars ? "8px" : undefined,
            borderBottomWidth: isHeavyBars ? "8px" : undefined,
            borderLeftWidth: isMonoStripe ? "6px" : undefined,
            backgroundColor: paperBg,
            backgroundImage: isBlueprint
              ? `linear-gradient(${c.primaryColor}12 1px, transparent 1px), linear-gradient(90deg, ${c.primaryColor}12 1px, transparent 1px)`
              : isCheckered
              ? `repeating-linear-gradient(45deg, ${c.surfaceTint}, ${c.surfaceTint} 6px, #ffffff 6px, #ffffff 12px)`
              : undefined,
            backgroundSize: isBlueprint ? "12px 12px" : undefined,
            boxShadow: isArtDeco
              ? `inset 0 0 0 3px ${paperBg}, inset 0 0 0 6px ${c.accentColor}`
              : isMuseum
              ? `inset 0 0 0 4px ${c.accentColor}50`
              : undefined,
          }}
        >
          {/* Lanyard Punch Slot */}
          {isLanyard && (
            <div className="pt-1.5 pb-0.5 flex justify-center relative z-20" style={{ backgroundColor: c.primaryColor }}>
              <div className="w-10 h-2 rounded-full bg-white/90 border border-slate-400 shadow-inner" />
            </div>
          )}

          {/* Ticket Perforated Side Notches */}
          {isTicket && (
            <>
              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 border-r-2 z-20" style={{ borderColor: c.borderColor }} />
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 border-l-2 z-20" style={{ borderColor: c.borderColor }} />
            </>
          )}

          {/* Hanging Bookmark Ribbon */}
          {isBookmark && (
            <div
              className="absolute top-0 right-4 w-7 h-11 z-20 flex flex-col items-center justify-center text-[7px] font-black text-white shadow"
              style={{
                backgroundColor: c.accentColor,
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)",
              }}
            >
              ★<br />26
            </div>
          )}

          {/* Corner Brackets / HUD / Museum Studs */}
          {(isBrackets || isCyber || isMuseum) && (
            <>
              <span className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 z-20" style={{ borderColor: c.accentColor }} />
              <span className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 z-20" style={{ borderColor: c.accentColor }} />
              <span className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 z-20" style={{ borderColor: c.accentColor }} />
              <span className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 z-20" style={{ borderColor: c.accentColor }} />
            </>
          )}

          {/* Diamond Crest Top Accent */}
          {isDiamondCrest && (
            <div className="flex justify-center -mb-2.5 pt-1.5 relative z-20">
              <div
                className="w-5 h-5 rotate-45 border-2 flex items-center justify-center text-[8px] font-black shadow"
                style={{ backgroundColor: c.accentColor, borderColor: "#ffffff", color: "#ffffff" }}
              >
                <span className="-rotate-45">❖</span>
              </div>
            </div>
          )}

          {/* Concentric Halo Background Rings */}
          {isHalo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <div className="w-32 h-32 rounded-full border-2 border-dashed opacity-15" style={{ borderColor: c.accentColor }} />
              <div className="absolute w-24 h-24 rounded-full border opacity-15" style={{ borderColor: c.primaryColor }} />
            </div>
          )}

          {previewShowWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.06] z-10">
              <span className="text-xl font-black uppercase tracking-widest -rotate-12" style={{ color: c.primaryColor }}>
                {previewWatermarkText}
              </span>
            </div>
          )}

          {/* Tricolor Top Band */}
          {isTricolor && (
            <div className="h-2 w-full flex">
              <div className="flex-1 bg-orange-500" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-emerald-600" />
            </div>
          )}

          {/* Top Accent Rule */}
          {arch.topAccentBar && !isTricolor && (
            <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${c.primaryColor}, ${c.accentColor})` }} />
          )}

          {/* Header */}
          <div
            className={`px-3 py-2.5 flex items-center gap-2 relative z-10 ${
              previewLogoPos === "center" || arch.headerStyle === "arch" || arch.headerStyle === "gazette_double"
                ? "justify-center text-center flex-col"
                : previewLogoPos === "right"
                ? "flex-row-reverse text-right justify-between"
                : "justify-between"
            }`}
            style={computeHeaderStyle()}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 font-black text-[10px] flex items-center justify-center shrink-0 border ${
                  arch.headerStyle === "arch" || isZen ? "rounded-full" : "rounded-lg"
                }`}
                style={{
                  backgroundColor: isLightHdrVariant ? c.primaryColor : "#ffffff",
                  color: isLightHdrVariant ? "#ffffff" : c.primaryColor,
                  borderColor: c.borderColor,
                }}
              >
                {scName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-black uppercase truncate ${arch.serifFont ? "font-serif tracking-wider" : ""}`}>
                  {scName}
                </div>
                <div className="text-[8px] opacity-80">
                  {previewVariant === "default"
                    ? `${DOC_TYPE_META[docType].label} • Session 2026-27`
                    : `${LAYOUT_VARIANT_META[previewVariant]?.label} • 2026-27`}
                </div>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 text-[8px] font-black uppercase shrink-0 ${
                arch.pillBadges
                  ? "rounded-full"
                  : arch.skewBadge
                  ? "-skew-x-12 rounded-xs"
                  : "rounded"
              }`}
              style={{ backgroundColor: c.badgeBg, color: c.badgeText }}
            >
              {badgeTitle}
            </span>
          </div>

          {/* Body */}
          <div className={`p-3 space-y-2 text-[9.5px] relative z-10 ${isSwissCross ? "border-l-4 ml-2" : ""}`} style={isSwissCross ? { borderColor: c.accentColor } : undefined}>
            {renderBodyContent(false)}

            {/* Passport MRZ Strip */}
            {isPassport && (
              <div className="px-2 py-1 bg-slate-900 text-emerald-300 font-mono text-[7px] tracking-widest rounded truncate">
                P&lt;IND&lt;AARAV&lt;KUMAR&lt;&lt;SCH2026104&lt;&lt;&lt;2026&lt;8A&lt;&lt;&lt;&lt;&lt;
              </div>
            )}

            {/* Footer */}
            {isBottomDock ? (
              <div
                className="-mx-3 -mb-3 mt-2 px-3 py-2 flex items-center justify-between text-[7.5px]"
                style={{ backgroundColor: c.primaryColor, color: c.headerTextColor }}
              >
                <span className="font-bold">{previewLeftSign}</span>
                <span className="px-2 py-0.5 rounded-full text-[7px] font-black" style={{ backgroundColor: c.accentColor, color: "#fff" }}>
                  VERIFIED
                </span>
                <span className="font-black">{previewRightSign}</span>
              </div>
            ) : (
              <div className="pt-1.5 border-t flex items-end justify-between text-[7.5px]" style={{ borderColor: c.borderColor + "40" }}>
                <span className="font-black text-slate-700">{previewLeftSign}</span>
                <span className="text-[7px] text-slate-500 max-w-[120px] truncate">{previewFooter}</span>
                <span className="font-black text-slate-900">{previewRightSign}</span>
              </div>
            )}
          </div>

          {/* Tricolor Bottom Band */}
          {isTricolor && (
            <div className="h-1.5 w-full flex">
              <div className="flex-1 bg-orange-500" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-emerald-600" />
            </div>
          )}
        </div>
      </div>
    );
  };

  const content = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[94vh] w-full">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {asPage && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
              Document Templates Studio (60 Structural Layouts × 5 Document Types)
            </h2>
            <p className="text-[11px] text-indigo-200 truncate">
              10 क्लासिक + 50 नए स्ट्रक्चरल लेआउट (कुल 60 अलग-अलग डिज़ाइन) — ID Card, Admit Card, Marksheet, Fee Slip व Certificate के लिए
            </p>
          </div>
        </div>
        {!asPage && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 5 DocType Tabs (including Certificate) */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(Object.keys(DOC_TYPE_META) as DocumentTemplateType[]).map((dt) => {
            const meta = DOC_TYPE_META[dt];
            const isTab = docType === dt;
            return (
              <button
                key={dt}
                type="button"
                onClick={() => setDocType(dt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shrink-0 border ${
                  isTab
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                <span className="text-[10px] opacity-80">({meta.hindiLabel})</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setNewColors({ ...selectedTemplate.colors });
            setNewLayoutVariant(selectedTemplate.layoutVariant || "classic_ribbon");
            setShowCreateForm((v) => !v);
          }}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showCreateForm ? "60 Layouts Gallery Dekhein" : "Naya Custom Template Banayein"}</span>
        </button>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: 50-Template Gallery OR Custom Creator */}
        <div className="lg:col-span-7 space-y-3">
          {showCreateForm ? (
            <form
              onSubmit={handleCreateCustomTemplate}
              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    Naya Custom {DOC_TYPE_META[docType].label} Template Banayein
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    60 अलग-अलग स्ट्रक्चरल लेआउट (10 पुराने + 50 नए) में से कोई भी चुनें, और अपना बॉर्डर, लोगो व रंग सेट करें।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Template Name (बड़े अक्षरों में) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.toUpperCase())}
                    placeholder="E.G. LMPS ROYAL CERTIFICATE 2027"
                    className="w-full px-3 py-2 text-xs font-black uppercase rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Layout Structure / Design Style (60 अलग-अलग स्ट्रक्चरल लेआउट चुनें: 10 Classic + 50 New)
                  </label>
                  <select
                    value={newLayoutVariant}
                    onChange={(e) => setNewLayoutVariant(e.target.value as TemplateLayoutVariant)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {(Object.keys(LAYOUT_VARIANT_META) as TemplateLayoutVariant[]).map((lv) => (
                      <option key={lv} value={lv}>
                        {LAYOUT_VARIANT_META[lv].code}: {LAYOUT_VARIANT_META[lv].label} — {LAYOUT_VARIANT_META[lv].hindiDesc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Border Style (बॉर्डर डिज़ाइन)
                  </label>
                  <select
                    value={newBorderStyle}
                    onChange={(e) => setNewBorderStyle(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="solid">Solid Clean Border</option>
                    <option value="double">Royal Double Border</option>
                    <option value="dashed">Classic Dashed Frame</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    School Logo Position
                  </label>
                  <select
                    value={newLogoPos}
                    onChange={(e) => setNewLogoPos(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="left">Left Side (Standard)</option>
                    <option value="center">Centered Crest</option>
                    <option value="right">Right Aligned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Left Signatory Title
                  </label>
                  <input
                    type="text"
                    value={newLeftSign}
                    onChange={(e) => setNewLeftSign(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Right Signatory Title
                  </label>
                  <input
                    type="text"
                    value={newRightSign}
                    onChange={(e) => setNewRightSign(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Custom Footer Note (नीचे की लाइन)
                  </label>
                  <input
                    type="text"
                    value={newFooterNote}
                    onChange={(e) => setNewFooterNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newShowWatermark}
                      onChange={(e) => setNewShowWatermark(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Show Watermark (हल्का वॉटरमार्क दिखाएं)</span>
                  </label>
                  {newShowWatermark && (
                    <input
                      type="text"
                      value={newWatermarkText}
                      onChange={(e) => setNewWatermarkText(e.target.value.toUpperCase())}
                      placeholder="WATERMARK TEXT"
                      className="flex-1 min-w-[160px] px-2.5 py-1 text-xs font-black uppercase rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  )}
                </div>
              </div>

              {/* Color Pickers for Custom Template */}
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Custom Colors चुनें:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COLOR_FIELDS.map((cf) => (
                    <label
                      key={cf.key}
                      className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <input
                        type="color"
                        value={newColors[cf.key]}
                        onChange={(e) => setNewColors((p) => ({ ...p, [cf.key]: e.target.value }))}
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-black text-slate-800 dark:text-white truncate">{cf.label}</div>
                        <div className="text-[9px] font-mono text-slate-400">{newColors[cf.key]}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save &amp; Apply Custom Template</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>
                    {DOC_TYPE_META[docType].label} Templates ({templates.length}: Default + 60 Unique Structural Layouts)
                  </span>
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 truncate max-w-[240px]">
                  Active: {activeTemplate.name}
                </span>
              </div>

              {/* Search & Category Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="डिज़ाइन खोजें (e.g. Royal, Arch, Sidebar, Tricolor, Gold, CBSE)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 border transition cursor-pointer ${
                        activeCategory === cat
                          ? "bg-slate-900 text-amber-300 border-slate-900 dark:bg-indigo-600 dark:text-white"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {cat === "ALL" ? `All (${templates.length})` : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[470px] overflow-y-auto pr-1">
                {filteredTemplates.map((tpl) => {
                  const isActive = activeTemplate.id === tpl.id;
                  const isSelected = selectedTemplate.id === tpl.id;
                  const lvMeta = tpl.layoutVariant ? LAYOUT_VARIANT_META[tpl.layoutVariant] : null;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTplId(tpl.id)}
                      className={`p-3 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-sm"
                          : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {tpl.name}
                            </span>
                            {tpl.isDefault && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-900 text-amber-300">
                                ORIGINAL DEFAULT
                              </span>
                            )}
                            {tpl.isCustom && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-600 text-white">
                                CUSTOM
                              </span>
                            )}
                            {lvMeta && (
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                                {lvMeta.code}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {tpl.hindiTag}
                          </p>
                          {tpl.category && !tpl.isDefault && (
                            <span className="inline-block mt-1 text-[8.5px] font-bold text-slate-400">
                              {tpl.category} • {lvMeta?.label || "Classic"}
                            </span>
                          )}
                        </div>

                        {tpl.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustom(tpl);
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                            title="Delete Custom Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Mini Color Swatches + Apply Button */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-1">
                          {[tpl.colors.primaryColor, tpl.colors.accentColor, tpl.colors.borderColor, tpl.colors.badgeBg].map((c, idx) => (
                            <span
                              key={idx}
                              className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shadow-2xs"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyTemplate(tpl);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black flex items-center gap-1 transition cursor-pointer ${
                            isActive
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-900 hover:bg-indigo-600 text-white"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Applied</span>
                            </>
                          ) : (
                            <span>Apply Karein</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredTemplates.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                    Koi design match nahi hua — Search clear karke dekhein.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Live Preview + Color Customizer for Selected Template */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-300 gap-2">
              <span className="truncate">Live Structural Preview ({DOC_TYPE_META[docType].label})</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                {previewVariant === "default" ? "APP DEFAULT" : LAYOUT_VARIANT_META[previewVariant].code.toUpperCase()}
              </span>
            </div>

            {renderLiveStructuralPreview()}

            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1">
              {previewVariant === "default"
                ? "ऐप का मूल डिफ़ॉल्ट डिज़ाइन (बिना किसी बदलाव के सुरक्षित)"
                : `Style: ${LAYOUT_VARIANT_META[previewVariant].label} — ${LAYOUT_VARIANT_META[previewVariant].hindiDesc}`}
            </div>
          </div>

          {!showCreateForm && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="truncate">Colors Badlein ({selectedTemplate.name})</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">इस डिज़ाइन के सभी रंग अपनी पसंद के अनुसार बदलें।</p>
                </div>
                <button
                  type="button"
                  onClick={handleResetColors}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1 cursor-pointer shrink-0"
                  title="Original template colors wapas layein"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              {selectedTemplate.id === "default" ? (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>App Original Default</strong> सुरक्षित रखा गया है। बाईं ओर <strong>10 पुराने + 50 नए स्ट्रक्चरल लेआउट (कुल 60 अलग डिज़ाइन)</strong> दिए गए हैं — कोई भी चुनें और रंग भी बदलें!
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOR_FIELDS.map((cf) => (
                      <label
                        key={cf.key}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 transition"
                      >
                        <input
                          type="color"
                          value={draftColors[cf.key]}
                          onChange={(e) => handleColorLiveSave(cf.key, e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-[10.5px] font-black text-slate-800 dark:text-white truncate">{cf.label}</div>
                          <div className="text-[9px] font-mono text-slate-400">{draftColors[cf.key]}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {activeTemplate.id !== selectedTemplate.id && (
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(selectedTemplate)}
                      className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Is Design Ko Apply Karein</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (asPage) {
    return <div className="max-w-6xl mx-auto py-2">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-6xl">{content}</div>
    </div>
  );
};
