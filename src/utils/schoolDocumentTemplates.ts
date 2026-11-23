import type { School } from "../school-types";
import { updateSchool } from "../school-firebase";

export type DocumentTemplateType =
  | "id_card"
  | "admit_card"
  | "marksheet"
  | "fee_slip"
  | "certificate";

// 10 Classic Layouts (01-10) + 50 New Structural Layouts (11-60) = 60 Distinct Structural Layouts
export type TemplateLayoutVariant =
  // 01 - 10: Core Classic Layouts
  | "classic_ribbon"
  | "split_sidebar"
  | "modern_floating"
  | "cbse_board"
  | "diagonal_sport"
  | "minimal_grid"
  | "certificate_diploma"
  | "compact_photo_focus"
  | "dual_tone_split"
  | "ink_saver_classic"
  // 11 - 20: Heritage & Modern Expansion
  | "top_banner_arch"
  | "right_sidebar_spine"
  | "heritage_ornate_frame"
  | "corporate_badge_card"
  | "newspaper_gazette"
  | "gradient_aurora_glass"
  | "tricolor_patriot_band"
  | "dark_executive_obsidian"
  | "checker_ledger_grid"
  | "stamp_seal_watermark"
  // 21 - 30: Architectural Headers & Pass Editions
  | "wave_crest_header"
  | "chevron_shield_banner"
  | "dual_vertical_rails"
  | "bottom_dock_bar"
  | "lanyard_punch_badge"
  | "passport_mrz_edition"
  | "ticket_stub_notch"
  | "corner_bracket_frame"
  | "beveled_octagon_frame"
  | "blueprint_tech_grid"
  // 31 - 40: Tactile, Editorial & Sports Editions
  | "stacked_deck_shadow"
  | "ribbon_fold_3d"
  | "art_deco_stepped"
  | "guilloche_banknote"
  | "magazine_editorial"
  | "stadium_scoreboard"
  | "museum_plaque_gold"
  | "scroll_parchment_curl"
  | "split_diagonal_duotone"
  | "floating_pill_island"
  // 41 - 50: Columnar, Dossier & Sovereign Editions
  | "vertical_left_wide"
  | "vertical_right_wide"
  | "dossier_folder_tab"
  | "swiss_cross_asymmetric"
  | "horizon_sunset_curve"
  | "diamond_crest_frame"
  | "top_bottom_heavy_bars"
  | "minimal_mono_stripe"
  | "checkered_classic_border"
  | "royal_canopy_scallop"
  // 51 - 60: Prestige, Cyber & Grand Honor Editions
  | "emerald_folio_ledger"
  | "prism_mosaic_header"
  | "chancellor_laurel_wreath"
  | "cyber_circuit_neon"
  | "vintage_postage_stamp"
  | "zen_minimal_frame"
  | "concentric_rings_crest"
  | "vertical_ribbon_bookmark"
  | "double_decker_split"
  | "sovereign_imperial_gold";

export type TemplateCategory =
  | "Royal & Heritage"
  | "Modern & Tech"
  | "Board & Official"
  | "Minimal & Print"
  | "Creative & Sports"
  | "Diploma & Honor";

export interface TemplatePalette {
  primaryColor: string;
  accentColor: string;
  headerTextColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  surfaceTint: string;
}

export interface DocumentTemplateConfig {
  id: string;
  name: string;
  hindiTag: string;
  category?: TemplateCategory;
  docType: DocumentTemplateType;
  layoutVariant?: TemplateLayoutVariant;
  isDefault?: boolean;
  isCustom?: boolean;
  borderStyle: "solid" | "double" | "dashed";
  logoPosition: "left" | "center" | "right";
  showWatermark: boolean;
  watermarkText: string;
  footerNote: string;
  leftSignatoryLabel: string;
  rightSignatoryLabel: string;
  colors: TemplatePalette;
}

export interface SchoolDocumentTemplatesState {
  activeIds?: Partial<Record<DocumentTemplateType, string>>;
  colorOverrides?: Record<string, Partial<TemplatePalette>>;
  customTemplates?: DocumentTemplateConfig[];
}

export const DOCUMENT_TEMPLATE_EVENT = "school-doc-template-updated";

export type ArchHeaderStyle =
  | "solid_gradient"
  | "arch"
  | "wave"
  | "chevron"
  | "diagonal"
  | "split_duotone"
  | "aurora"
  | "obsidian"
  | "prism"
  | "horizon"
  | "scallop"
  | "light_bar"
  | "gazette_double"
  | "editorial_split"
  | "ribbon_3d"
  | "floating_pill"
  | "scoreboard"
  | "double_decker"
  | "scroll_header";

export type ArchFrameStyle =
  | "standard"
  | "left_spine"
  | "right_spine"
  | "left_wide"
  | "right_wide"
  | "dual_rails"
  | "bottom_dock"
  | "lanyard_punch"
  | "passport_mrz"
  | "ticket_notch"
  | "corner_brackets"
  | "beveled"
  | "blueprint_grid"
  | "stacked_deck"
  | "art_deco"
  | "guilloche"
  | "museum_plaque"
  | "dossier_tab"
  | "swiss_cross"
  | "diamond_crest"
  | "heavy_bars"
  | "mono_stripe"
  | "checkered_rim"
  | "folio_ledger"
  | "laurel_wreath"
  | "cyber_hud"
  | "postage_stamp"
  | "zen_asymmetric"
  | "concentric_halo"
  | "bookmark_ribbon"
  | "ornate_filigree"
  | "diploma_parchment"
  | "seal_center"
  | "matrix_boxed"
  | "metro_blocks"
  | "tricolor"
  | "ink_dashed"
  | "hero_photo";

export interface LayoutArchitectureSpec {
  headerStyle: ArchHeaderStyle;
  frameStyle: ArchFrameStyle;
  serifFont?: boolean;
  monoAccent?: boolean;
  sharpCorners?: boolean;
  creamPaper?: boolean;
  pillBadges?: boolean;
  skewBadge?: boolean;
  topAccentBar?: boolean;
  bottomAccentBar?: boolean;
  cornerSymbol?: string;
}

export const LAYOUT_VARIANT_META: Record<
  TemplateLayoutVariant,
  {
    code: string;
    label: string;
    hindiDesc: string;
    category: TemplateCategory;
    arch: LayoutArchitectureSpec;
  }
> = {
  // 01 - 10: Core Classic Layouts
  classic_ribbon: {
    code: "Layout 01",
    label: "Royal Crest & Ribbon",
    hindiDesc: "सेंटर्ड शाही हेडर, रिबन बैज व डबल-लेयर गोल्डन फ्रेम",
    category: "Royal & Heritage",
    arch: { headerStyle: "solid_gradient", frameStyle: "standard", cornerSymbol: "⚜" },
  },
  split_sidebar: {
    code: "Layout 02",
    label: "Vertical Left Sidebar",
    hindiDesc: "बाईं तरफ खड़ी रंगीन पट्टी (Sidebar Strip) व दाईं ओर डेटा कार्ड",
    category: "Modern & Tech",
    arch: { headerStyle: "light_bar", frameStyle: "left_spine" },
  },
  modern_floating: {
    code: "Layout 03",
    label: "Modern Floating Hero",
    hindiDesc: "गोल फ्लोटिंग कार्ड्स, स्मार्ट पिल बैज व ज़ेबरा ग्रिड",
    category: "Modern & Tech",
    arch: { headerStyle: "solid_gradient", frameStyle: "standard", pillBadges: true },
  },
  cbse_board: {
    code: "Layout 04",
    label: "Official CBSE / Board Box",
    hindiDesc: "बोर्ड परीक्षा पैटर्न — सफ़ेद ऑफिशियल हेडर व शार्प बॉक्स ग्रिड",
    category: "Board & Official",
    arch: { headerStyle: "light_bar", frameStyle: "matrix_boxed", sharpCorners: true, topAccentBar: true },
  },
  diagonal_sport: {
    code: "Layout 05",
    label: "Angular / Geometric Cut",
    hindiDesc: "तिरछा (Diagonal) मॉडर्न हेडर व बोल्ड कॉन्ट्रास्ट स्ट्रिप",
    category: "Creative & Sports",
    arch: { headerStyle: "diagonal", frameStyle: "standard", skewBadge: true },
  },
  minimal_grid: {
    code: "Layout 06",
    label: "Swiss Minimalist White",
    hindiDesc: "साफ़ सफ़ेद बैकग्राउंड, ऊपर मोटी रंगीन लाइन व हेयरलाइन ग्रिड",
    category: "Minimal & Print",
    arch: { headerStyle: "light_bar", frameStyle: "standard", sharpCorners: true, topAccentBar: true },
  },
  certificate_diploma: {
    code: "Layout 07",
    label: "Diploma / Parchment Seal",
    hindiDesc: "क्रीम पार्चमेंट पेपर, डबल डिप्लोमा बॉर्डर व क्लासिक सील",
    category: "Diploma & Honor",
    arch: { headerStyle: "light_bar", frameStyle: "diploma_parchment", serifFont: true, creamPaper: true, cornerSymbol: "❧" },
  },
  compact_photo_focus: {
    code: "Layout 08",
    label: "Big Hero Photo & Stamp",
    hindiDesc: "बड़ा प्रमुख फ़ोटो फोकस / हाइलाइट स्टाम्प व स्पॉटलाइट बैज",
    category: "Creative & Sports",
    arch: { headerStyle: "light_bar", frameStyle: "hero_photo", topAccentBar: true },
  },
  dual_tone_split: {
    code: "Layout 09",
    label: "50/50 Dual-Tone Split",
    hindiDesc: "आधा डार्क + आधा लाइट स्प्लिट डिज़ाइन व दो-रंगी बॉक्स",
    category: "Modern & Tech",
    arch: { headerStyle: "split_duotone", frameStyle: "standard", pillBadges: true },
  },
  ink_saver_classic: {
    code: "Layout 10",
    label: "Ink-Saver Print Ledger",
    hindiDesc: "कम स्याही वाला क्रिस्प प्रिंट-फ्रेंडली क्लासिक लेज़र डिज़ाइन",
    category: "Minimal & Print",
    arch: { headerStyle: "light_bar", frameStyle: "ink_dashed", sharpCorners: true },
  },

  // 11 - 60: 50 NEW Structural Layouts
  top_banner_arch: {
    code: "Layout 11",
    label: "Curved Arch & Crown",
    hindiDesc: "ऊपर कर्व्ड आर्च बैनर, शाही क्राउन व सेंटर्ड क्रेस्ट डिज़ाइन",
    category: "Royal & Heritage",
    arch: { headerStyle: "arch", frameStyle: "standard", pillBadges: true },
  },
  right_sidebar_spine: {
    code: "Layout 12",
    label: "Vertical Right Spine",
    hindiDesc: "दाईं तरफ खड़ी रंगीन एक्सेंट पट्टी व बाईं ओर साफ़ जानकारी",
    category: "Modern & Tech",
    arch: { headerStyle: "light_bar", frameStyle: "right_spine" },
  },
  heritage_ornate_frame: {
    code: "Layout 13",
    label: "Heritage Ornate Filigree",
    hindiDesc: "पारंपरिक कॉर्नर ऑर्नामेंट, लेयर्ड फ्रेम व क्लासिक सील",
    category: "Diploma & Honor",
    arch: { headerStyle: "light_bar", frameStyle: "ornate_filigree", serifFont: true, creamPaper: true, cornerSymbol: "❦" },
  },
  corporate_badge_card: {
    code: "Layout 14",
    label: "Smart Corporate Metro",
    hindiDesc: "मॉडर्न मेट्रो कार्ड ब्लॉक्स, शार्प पिल्स व टेक स्ट्रिप",
    category: "Modern & Tech",
    arch: { headerStyle: "solid_gradient", frameStyle: "metro_blocks", pillBadges: true },
  },
  newspaper_gazette: {
    code: "Layout 15",
    label: "Academic Gazette Press",
    hindiDesc: "क्लासिक गज़ट हेडलाइन, डबल-रूल बॉर्डर व सेरिफ एडिशन",
    category: "Board & Official",
    arch: { headerStyle: "gazette_double", frameStyle: "standard", serifFont: true, sharpCorners: true },
  },
  gradient_aurora_glass: {
    code: "Layout 16",
    label: "Aurora Multi-Gradient",
    hindiDesc: "चमकदार मल्टी-टोन ऑरोरा हेडर व सॉफ्ट फ्रॉस्टेड बॉक्स",
    category: "Creative & Sports",
    arch: { headerStyle: "aurora", frameStyle: "standard", pillBadges: true },
  },
  tricolor_patriot_band: {
    code: "Layout 17",
    label: "Tri-Band Heritage Ribbon",
    hindiDesc: "तीन-रंगी टॉप व बॉटम रिबन पट्टी और ऑफिशियल बैज",
    category: "Royal & Heritage",
    arch: { headerStyle: "light_bar", frameStyle: "tricolor" },
  },
  dark_executive_obsidian: {
    code: "Layout 18",
    label: "Dark Obsidian & Foil",
    hindiDesc: "गहरा ओब्सिडियन हेडर, मैटेलिक फॉइल हाइलाइट व प्रीमियम लुक",
    category: "Royal & Heritage",
    arch: { headerStyle: "obsidian", frameStyle: "standard", pillBadges: true },
  },
  checker_ledger_grid: {
    code: "Layout 19",
    label: "Precision Boxed Matrix",
    hindiDesc: "हर डेटा फ़ील्ड के लिए अलग शार्प बॉक्स व बोर्ड मैट्रिक्स ग्रिड",
    category: "Board & Official",
    arch: { headerStyle: "light_bar", frameStyle: "matrix_boxed", sharpCorners: true, topAccentBar: true },
  },
  stamp_seal_watermark: {
    code: "Layout 20",
    label: "Emblem Seal Centerpiece",
    hindiDesc: "सेंटर एम्बलम वॉटरमार्क, गोल मोहर व वेरिफाइड रिबन",
    category: "Diploma & Honor",
    arch: { headerStyle: "light_bar", frameStyle: "seal_center", serifFont: true, cornerSymbol: "★" },
  },
  wave_crest_header: {
    code: "Layout 21",
    label: "Flowing Ocean Wave Header",
    hindiDesc: "लहरदार (Curved Wave) टॉप बैनर व स्मूद फ्लोटिंग लेआउट",
    category: "Creative & Sports",
    arch: { headerStyle: "wave", frameStyle: "standard", pillBadges: true },
  },
  chevron_shield_banner: {
    code: "Layout 22",
    label: "V-Chevron Shield Crest",
    hindiDesc: "वी-शेप शेवरॉन शील्ड हेडर व बोल्ड एथलेटिक बॉर्डर",
    category: "Creative & Sports",
    arch: { headerStyle: "chevron", frameStyle: "standard", skewBadge: true },
  },
  dual_vertical_rails: {
    code: "Layout 23",
    label: "Twin Left-Right Pillars",
    hindiDesc: "बाएँ और दाएँ दोनों तरफ रंगीन खड़ी पिलर रेल पट्टियाँ",
    category: "Royal & Heritage",
    arch: { headerStyle: "light_bar", frameStyle: "dual_rails", serifFont: true },
  },
  bottom_dock_bar: {
    code: "Layout 24",
    label: "Inverted Footer-First Bar",
    hindiDesc: "सफ़ेद क्लीन टॉप + नीचे बड़ा गहरा रंगीन डॉक बार पैनल",
    category: "Modern & Tech",
    arch: { headerStyle: "light_bar", frameStyle: "bottom_dock", topAccentBar: true },
  },
  lanyard_punch_badge: {
    code: "Layout 25",
    label: "Conference Lanyard Punch",
    hindiDesc: "ऊपर डोरी/लैनयार्ड पंच स्लॉट नॉच व इवेंट पास स्ट्रक्चर",
    category: "Modern & Tech",
    arch: { headerStyle: "solid_gradient", frameStyle: "lanyard_punch", pillBadges: true },
  },
  passport_mrz_edition: {
    code: "Layout 26",
    label: "International Passport & MRZ",
    hindiDesc: "पासपोर्ट स्टाइल टॉप कोट व नीचे मशीन-रीडेबल कोड (MRZ) स्ट्रिप",
    category: "Board & Official",
    arch: { headerStyle: "solid_gradient", frameStyle: "passport_mrz", monoAccent: true, sharpCorners: true },
  },
  ticket_stub_notch: {
    code: "Layout 27",
    label: "Perforated Ticket Pass Notch",
    hindiDesc: "दोनों किनारों पर हाफ़-सर्कल टिकट कट-नॉच व डैश्ड डिवाइडर",
    category: "Creative & Sports",
    arch: { headerStyle: "solid_gradient", frameStyle: "ticket_notch", monoAccent: true },
  },
  corner_bracket_frame: {
    code: "Layout 28",
    label: "Precision Corner Brackets",
    hindiDesc: "चारों कोनों पर मोटे L-शेप आर्किटेक्ट ब्रैकेट और क्लीन सेंटर",
    category: "Minimal & Print",
    arch: { headerStyle: "light_bar", frameStyle: "corner_brackets", sharpCorners: true },
  },
  beveled_octagon_frame: {
    code: "Layout 29",
    label: "Cut-Corner Octagonal Plaque",
    hindiDesc: "कटे हुए 45° बेवेल्ड कोनों वाला अष्टकोणीय पट्टिका डिज़ाइन",
    category: "Diploma & Honor",
    arch: { headerStyle: "solid_gradient", frameStyle: "beveled", serifFont: true },
  },
  blueprint_tech_grid: {
    code: "Layout 30",
    label: "Engineering Blueprint Grid",
    hindiDesc: "टेक्निकल ब्लूप्रिंट ग्राफ़ ग्रिड बैकग्राउंड व मोनोस्पेस टेक्स्ट",
    category: "Modern & Tech",
    arch: { headerStyle: "light_bar", frameStyle: "blueprint_grid", monoAccent: true, sharpCorners: true },
  },
  stacked_deck_shadow: {
    code: "Layout 31",
    label: "Layered Stacked Card Deck",
    hindiDesc: "एक के पीछे एक लेयर्ड डबल-डेक शैडो कार्ड इफ़ेक्ट",
    category: "Creative & Sports",
    arch: { headerStyle: "floating_pill", frameStyle: "stacked_deck", pillBadges: true },
  },
  ribbon_fold_3d: {
    code: "Layout 32",
    label: "3D Folded Sash Ribbon",
    hindiDesc: "बॉर्डर के बाहर निकला हुआ 3D फ़ोल्डेड बैनर रिबन सैश",
    category: "Royal & Heritage",
    arch: { headerStyle: "ribbon_3d", frameStyle: "standard", cornerSymbol: "✦" },
  },
  art_deco_stepped: {
    code: "Layout 33",
    label: "Art Deco Stepped Ziggurat",
    hindiDesc: "1920s आर्ट डेको स्टेप्ड कॉर्नर व गोल्डन जियोमेट्रिक फ्रेम",
    category: "Royal & Heritage",
    arch: { headerStyle: "obsidian", frameStyle: "art_deco", serifFont: true, sharpCorners: true },
  },
  guilloche_banknote: {
    code: "Layout 34",
    label: "Treasury Guilloché Border",
    hindiDesc: "बैंकनोट व ट्रेज़री सुरक्षा स्टाइल ट्रिपल-रिंग माइक्रो बॉर्डर",
    category: "Board & Official",
    arch: { headerStyle: "gazette_double", frameStyle: "guilloche", serifFont: true, creamPaper: true },
  },
  magazine_editorial: {
    code: "Layout 35",
    label: "Editorial Magazine Masthead",
    hindiDesc: "मैगज़ीन मास्टहेड बड़ा टाइटल + असिमिट्रिक टू-कॉलम बॉडी",
    category: "Minimal & Print",
    arch: { headerStyle: "editorial_split", frameStyle: "standard", serifFont: true, sharpCorners: true },
  },
  stadium_scoreboard: {
    code: "Layout 36",
    label: "Varsity Scoreboard Header",
    hindiDesc: "स्पोर्ट्स व चैम्पियनशिप के लिए बोल्ड ऑल-कैप्स स्कोरबोर्ड लुक",
    category: "Creative & Sports",
    arch: { headerStyle: "scoreboard", frameStyle: "heavy_bars", skewBadge: true },
  },
  museum_plaque_gold: {
    code: "Layout 37",
    label: "Gallery Brass Plaque Inset",
    hindiDesc: "म्यूज़ियम पीतल पट्टिका इनसेट फ्रेम व चारों कोनों पर पिन स्टड",
    category: "Diploma & Honor",
    arch: { headerStyle: "light_bar", frameStyle: "museum_plaque", serifFont: true, creamPaper: true },
  },
  scroll_parchment_curl: {
    code: "Layout 38",
    label: "Imperial Scroll Roll Banner",
    hindiDesc: "प्राचीन शाही स्क्रॉल रोल हेडर + फुटर बार व पार्चमेंट शीट",
    category: "Diploma & Honor",
    arch: { headerStyle: "scroll_header", frameStyle: "diploma_parchment", serifFont: true, creamPaper: true },
  },
  split_diagonal_duotone: {
    code: "Layout 39",
    label: "55° Split Two-Tone Diagonal",
    hindiDesc: "55° कटाव वाला टू-टोन डायगोनल बैनर व हाई कॉन्ट्रास्ट डेटा",
    category: "Creative & Sports",
    arch: { headerStyle: "diagonal", frameStyle: "metro_blocks", skewBadge: true },
  },
  floating_pill_island: {
    code: "Layout 40",
    label: "Detached Floating Pill Island",
    hindiDesc: "अलग तैरता हुआ राउंडेड पिल हेडर आइलैंड व सॉफ्ट टिंट",
    category: "Modern & Tech",
    arch: { headerStyle: "floating_pill", frameStyle: "standard", pillBadges: true },
  },
  vertical_left_wide: {
    code: "Layout 41",
    label: "Wide 35% Left Profile Column",
    hindiDesc: "बाईं तरफ चौड़ा 35% डार्क प्रोफाइल पैनल व दाईं ओर मुख्य विवरण",
    category: "Modern & Tech",
    arch: { headerStyle: "light_bar", frameStyle: "left_wide", pillBadges: true },
  },
  vertical_right_wide: {
    code: "Layout 42",
    label: "Wide 35% Right Profile Column",
    hindiDesc: "दाईं तरफ चौड़ा 35% रंगीन प्रोफाइल पैनल व बाईं ओर रिकॉर्ड",
    category: "Modern & Tech",
    arch: { headerStyle: "light_bar", frameStyle: "right_wide", pillBadges: true },
  },
  dossier_folder_tab: {
    code: "Layout 43",
    label: "Official Index Dossier Tab",
    hindiDesc: "फ़ाइल फोल्डर इंडेक्स टैब हेडर व ऑफिशियल रिकॉर्ड स्टाइल",
    category: "Board & Official",
    arch: { headerStyle: "light_bar", frameStyle: "dossier_tab", monoAccent: true },
  },
  swiss_cross_asymmetric: {
    code: "Layout 44",
    label: "Swiss Cross Asymmetric Grid",
    hindiDesc: "स्विस टाइपोग्राफी क्रॉस-लाइन असिमिट्रिक क्लीन ग्रिड",
    category: "Minimal & Print",
    arch: { headerStyle: "editorial_split", frameStyle: "swiss_cross", sharpCorners: true },
  },
  horizon_sunset_curve: {
    code: "Layout 45",
    label: "Horizon Curved Sunrise Glow",
    hindiDesc: "सनराइज़ क्षितिज कर्व्ड ग्रेडिएंट हेडर व चमकीला गोल्ड एक्सेंट",
    category: "Creative & Sports",
    arch: { headerStyle: "horizon", frameStyle: "standard", pillBadges: true },
  },
  diamond_crest_frame: {
    code: "Layout 46",
    label: "Diamond Medallion Crest",
    hindiDesc: "शीर्ष पर डायमंड शेप क्रेस्ट मेडल व डबल-लाइन सम्मान बॉर्डर",
    category: "Diploma & Honor",
    arch: { headerStyle: "solid_gradient", frameStyle: "diamond_crest", serifFont: true, cornerSymbol: "❖" },
  },
  top_bottom_heavy_bars: {
    code: "Layout 47",
    label: "Heavy Top & Bottom Pillars",
    hindiDesc: "ऊपर और नीचे मोटी रंगीन पट्टियाँ — बिना साइड बॉर्डर वाला क्लीन लुक",
    category: "Board & Official",
    arch: { headerStyle: "solid_gradient", frameStyle: "heavy_bars", topAccentBar: true, bottomAccentBar: true },
  },
  minimal_mono_stripe: {
    code: "Layout 48",
    label: "Mono Stripe Ultra-Clean",
    hindiDesc: "पतली सिंगल रंगीन वर्टिकल लाइन व जीरो-क्लटर प्रिंट लेआउट",
    category: "Minimal & Print",
    arch: { headerStyle: "light_bar", frameStyle: "mono_stripe", sharpCorners: true },
  },
  checkered_classic_border: {
    code: "Layout 49",
    label: "Heritage Checkered Mosaic Rim",
    hindiDesc: "चेकर्ड मोज़ेक बॉर्डर पट्टी व क्लासिक एकेडमिक प्रमाण फ्रेम",
    category: "Royal & Heritage",
    arch: { headerStyle: "gazette_double", frameStyle: "checkered_rim", serifFont: true },
  },
  royal_canopy_scallop: {
    code: "Layout 50",
    label: "Scalloped Royal Canopy",
    hindiDesc: "छतरदार स्केलॉप्ड शाही कैनोपी हेडर व दरबारी फ्रेम",
    category: "Royal & Heritage",
    arch: { headerStyle: "scallop", frameStyle: "ornate_filigree", serifFont: true, cornerSymbol: "👑" },
  },
  emerald_folio_ledger: {
    code: "Layout 51",
    label: "Double-Rule Accountancy Folio",
    hindiDesc: "डबल-रूल अकाउंटेंसी लेज़र कॉलम और स्पष्ट टैबुलर बॉर्डर",
    category: "Board & Official",
    arch: { headerStyle: "gazette_double", frameStyle: "folio_ledger", monoAccent: true, sharpCorners: true },
  },
  prism_mosaic_header: {
    code: "Layout 52",
    label: "Geometric Prism Facet Header",
    hindiDesc: "प्रिज़्म क्रिस्टल मल्टी-पॉलीगॉन हेडर व आधुनिक कॉन्ट्रास्ट",
    category: "Creative & Sports",
    arch: { headerStyle: "prism", frameStyle: "standard", skewBadge: true },
  },
  chancellor_laurel_wreath: {
    code: "Layout 53",
    label: "Laurel Wreath Honors Frame",
    hindiDesc: "लॉरेल माल्यार्पण मेडलियन, एलीट सेरिफ टाइप और सम्मान बॉर्डर",
    category: "Diploma & Honor",
    arch: { headerStyle: "solid_gradient", frameStyle: "laurel_wreath", serifFont: true, creamPaper: true, cornerSymbol: "🌿" },
  },
  cyber_circuit_neon: {
    code: "Layout 54",
    label: "Cyber Tech HUD Frame",
    hindiDesc: "फ्यूचरिस्टिक साइबर HUD कॉर्नर मार्क व डिजिटल टेक स्ट्रिप",
    category: "Modern & Tech",
    arch: { headerStyle: "obsidian", frameStyle: "cyber_hud", monoAccent: true },
  },
  vintage_postage_stamp: {
    code: "Layout 55",
    label: "Vintage Perforated Stamp",
    hindiDesc: "डाक टिकट (Postage Stamp) जैसा डैश्ड पर्फ़ोरेटेड बॉर्डर व विंटेज लुक",
    category: "Minimal & Print",
    arch: { headerStyle: "light_bar", frameStyle: "postage_stamp", serifFont: true, creamPaper: true },
  },
  zen_minimal_frame: {
    code: "Layout 56",
    label: "Zen Asymmetric White",
    hindiDesc: "अति-संतुलित ज़ेन मिनिमल फ्रेम व पर्याप्त व्हाइटस्पेस के साथ",
    category: "Minimal & Print",
    arch: { headerStyle: "editorial_split", frameStyle: "zen_asymmetric" },
  },
  concentric_rings_crest: {
    code: "Layout 57",
    label: "Concentric Halo Emblem",
    hindiDesc: "केन्द्र में डबल हेलो रिंग वॉटरमार्क व सममित सम्मान कार्ड",
    category: "Diploma & Honor",
    arch: { headerStyle: "arch", frameStyle: "concentric_halo", serifFont: true },
  },
  vertical_ribbon_bookmark: {
    code: "Layout 58",
    label: "Hanging Bookmark Ribbon",
    hindiDesc: "ऊपर से नीचे लटकता हुआ V-कट बुकमार्क रिबन बैज फ्लैग",
    category: "Royal & Heritage",
    arch: { headerStyle: "light_bar", frameStyle: "bookmark_ribbon", serifFont: true },
  },
  double_decker_split: {
    code: "Layout 59",
    label: "Dual-Tier Split Subheader",
    hindiDesc: "दो मंजिला अलग-अलग रंग का हेडर व सब-बैनर स्ट्रिप",
    category: "Board & Official",
    arch: { headerStyle: "double_decker", frameStyle: "matrix_boxed", sharpCorners: true },
  },
  sovereign_imperial_gold: {
    code: "Layout 60",
    label: "Grand Imperial Sovereign Seal",
    hindiDesc: "सर्वोच्च शाही सम्राट गोल्ड-ओब्सिडियन फ्रेम व ग्रांड सील",
    category: "Diploma & Honor",
    arch: { headerStyle: "obsidian", frameStyle: "ornate_filigree", serifFont: true, creamPaper: true, cornerSymbol: "⚜" },
  },
};

export function getLayoutArchitecture(variant?: TemplateLayoutVariant): LayoutArchitectureSpec {
  if (!variant || !LAYOUT_VARIANT_META[variant]) {
    return LAYOUT_VARIANT_META.classic_ribbon.arch;
  }
  return LAYOUT_VARIANT_META[variant].arch;
}

export const DOC_TYPE_META: Record<
  DocumentTemplateType,
  {
    label: string;
    hindiLabel: string;
    emoji: string;
    defaultLeftSign: string;
    defaultRightSign: string;
    defaultFooter: string;
  }
> = {
  id_card: {
    label: "ID Card",
    hindiLabel: "पहचान पत्र",
    emoji: "🪪",
    defaultLeftSign: "Class Teacher / Coordinator",
    defaultRightSign: "Principal",
    defaultFooter: "If found, kindly return to school office.",
  },
  admit_card: {
    label: "Admit Card",
    hindiLabel: "प्रवेश पत्र",
    emoji: "🎫",
    defaultLeftSign: "Exam Controller",
    defaultRightSign: "Principal / Center Supdt.",
    defaultFooter: "Carry this Admit Card daily to the examination hall.",
  },
  marksheet: {
    label: "Marksheet",
    hindiLabel: "अंकपत्र / रिजल्ट",
    emoji: "📊",
    defaultLeftSign: "Class Teacher",
    defaultRightSign: "Principal",
    defaultFooter: "Computer generated official academic transcript.",
  },
  fee_slip: {
    label: "Fee Slip",
    hindiLabel: "शुल्क रसीद / तकादा",
    emoji: "🧾",
    defaultLeftSign: "Accountant / Cashier",
    defaultRightSign: "Principal",
    defaultFooter: "Keep this fee receipt safe for future reference.",
  },
  certificate: {
    label: "Certificate",
    hindiLabel: "प्रमाण पत्र / TC",
    emoji: "🏆",
    defaultLeftSign: "Exam Controller / Class Teacher",
    defaultRightSign: "Principal / Head of Institution",
    defaultFooter: "Official Institutional Certificate • Verified by School Records.",
  },
};

interface ThemeSpec {
  key: string;
  name: string;
  hindiTag: string;
  category: TemplateCategory;
  layoutVariant: TemplateLayoutVariant;
  borderStyle: "solid" | "double" | "dashed";
  logoPosition: "left" | "center" | "right";
  showWatermark?: boolean;
  colors: TemplatePalette;
}

// 60 Unique Designs = 10 Classic Layouts (01-10) + 50 New Structural Layouts (11-60)
export const SIXTY_PRESET_THEMES: ThemeSpec[] = [
  // 01 - 10 (10 Classic Core Structural Layouts)
  {
    key: "royal_navy_gold",
    name: "Royal Crest Heritage",
    hindiTag: "शाही नेवी व गोल्डन डबल क्रेस्ट फ्रेम",
    category: "Royal & Heritage",
    layoutVariant: "classic_ribbon",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#0f2744", accentColor: "#d97706", headerTextColor: "#ffffff", borderColor: "#b45309", badgeBg: "#fef3c7", badgeText: "#92400e", surfaceTint: "#fffbeb" },
  },
  {
    key: "emerald_sidebar",
    name: "Executive Emerald Spine",
    hindiTag: "बाईं एमराल्ड वर्टिकल साइडबार पट्टी",
    category: "Modern & Tech",
    layoutVariant: "split_sidebar",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#065f46", accentColor: "#10b981", headerTextColor: "#ffffff", borderColor: "#047857", badgeBg: "#d1fae5", badgeText: "#064e3b", surfaceTint: "#ecfdf5" },
  },
  {
    key: "indigo_floating",
    name: "Modern Floating Capsule",
    hindiTag: "इंडिगो फ्लोटिंग कार्ड व कर्व्ड हीरो",
    category: "Modern & Tech",
    layoutVariant: "modern_floating",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#312e81", accentColor: "#6366f1", headerTextColor: "#ffffff", borderColor: "#4338ca", badgeBg: "#e0e7ff", badgeText: "#312e81", surfaceTint: "#eef2ff" },
  },
  {
    key: "cbse_official_board",
    name: "Official CBSE Oxford Box",
    hindiTag: "बोर्ड परीक्षा स्टाइल फॉर्मल बॉक्स ग्रिड",
    category: "Board & Official",
    layoutVariant: "cbse_board",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#1e3a8a", accentColor: "#1d4ed8", headerTextColor: "#0f172a", borderColor: "#1e3a8a", badgeBg: "#dbeafe", badgeText: "#1e3a8a", surfaceTint: "#f8fafc" },
  },
  {
    key: "saffron_diagonal",
    name: "Saffron Angular Pro",
    hindiTag: "केसरिया तिरछा डायगोनल स्पोर्ट कट",
    category: "Creative & Sports",
    layoutVariant: "diagonal_sport",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#9a3412", accentColor: "#f97316", headerTextColor: "#ffffff", borderColor: "#c2410c", badgeBg: "#ffedd5", badgeText: "#9a3412", surfaceTint: "#fff7ed" },
  },
  {
    key: "teal_swiss_minimal",
    name: "Swiss Teal Minimalist",
    hindiTag: "साफ़ सफ़ेद स्विस मिनिमल टॉप बार",
    category: "Minimal & Print",
    layoutVariant: "minimal_grid",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0f766e", accentColor: "#14b8a6", headerTextColor: "#0f172a", borderColor: "#0f766e", badgeBg: "#ccfbf1", badgeText: "#115e59", surfaceTint: "#f0fdfa" },
  },
  {
    key: "rosewood_diploma",
    name: "Rosewood Parchment Seal",
    hindiTag: "क्रीम पार्चमेंट पेपर व गोल्डन डिप्लोमा सील",
    category: "Diploma & Honor",
    layoutVariant: "certificate_diploma",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#78350f", accentColor: "#b45309", headerTextColor: "#fef3c7", borderColor: "#78350f", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fffdf3" },
  },
  {
    key: "crimson_photo_hero",
    name: "Crimson Hero Spotlight",
    hindiTag: "क्रिमसन बड़ा फ़ोटो व स्टाम्प स्पॉटलाइट",
    category: "Creative & Sports",
    layoutVariant: "compact_photo_focus",
    borderStyle: "solid",
    logoPosition: "right",
    showWatermark: true,
    colors: { primaryColor: "#881337", accentColor: "#e11d48", headerTextColor: "#ffffff", borderColor: "#9f1239", badgeBg: "#ffe4e6", badgeText: "#881337", surfaceTint: "#fff1f2" },
  },
  {
    key: "purple_dual_tone",
    name: "Amethyst 50/50 Split",
    hindiTag: "आधा गहरा पर्पल + आधा सफ़ेद स्प्लिट",
    category: "Modern & Tech",
    layoutVariant: "dual_tone_split",
    borderStyle: "solid",
    logoPosition: "center",
    colors: { primaryColor: "#581c87", accentColor: "#9333ea", headerTextColor: "#ffffff", borderColor: "#6b21a8", badgeBg: "#f3e8ff", badgeText: "#581c87", surfaceTint: "#faf5ff" },
  },
  {
    key: "classic_ink_saver",
    name: "Ink-Saver Mono Ledger",
    hindiTag: "कम स्याही वाला क्रिस्प प्रिंट-फ्रेंडली लेज़र",
    category: "Minimal & Print",
    layoutVariant: "ink_saver_classic",
    borderStyle: "dashed",
    logoPosition: "left",
    colors: { primaryColor: "#111827", accentColor: "#374151", headerTextColor: "#111827", borderColor: "#111827", badgeBg: "#f3f4f6", badgeText: "#111827", surfaceTint: "#ffffff" },
  },

  // 11 - 20 (New Structural Layouts 11-20)
  {
    key: "imperial_arch_gold",
    name: "Imperial Crown Arch",
    hindiTag: "ऊपर कर्व्ड आर्च व रॉयल क्राउन मेडल",
    category: "Royal & Heritage",
    layoutVariant: "top_banner_arch",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#1e1b4b", accentColor: "#eab308", headerTextColor: "#ffffff", borderColor: "#ca8a04", badgeBg: "#fef9c3", badgeText: "#854d0e", surfaceTint: "#fefce8" },
  },
  {
    key: "cobalt_right_spine",
    name: "Cobalt Right Spine",
    hindiTag: "दाईं तरफ़ कोबाल्ट ब्लू वर्टिकल पट्टी",
    category: "Modern & Tech",
    layoutVariant: "right_sidebar_spine",
    borderStyle: "solid",
    logoPosition: "right",
    colors: { primaryColor: "#0369a1", accentColor: "#06b6d4", headerTextColor: "#ffffff", borderColor: "#0284c7", badgeBg: "#e0f2fe", badgeText: "#075985", surfaceTint: "#f0f9ff" },
  },
  {
    key: "maharaja_ornate_ivory",
    name: "Maharaja Ornate Filigree",
    hindiTag: "कॉर्नर ऑर्नामेंट बॉर्डर व शाही मेहराब",
    category: "Diploma & Honor",
    layoutVariant: "heritage_ornate_frame",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#7c2d12", accentColor: "#d97706", headerTextColor: "#fffbeb", borderColor: "#92400e", badgeBg: "#fde68a", badgeText: "#78350f", surfaceTint: "#fffbeb" },
  },
  {
    key: "metro_slate_corporate",
    name: "Metro Slate Corporate",
    hindiTag: "स्मार्ट मेट्रो ब्लॉक्स व कॉर्पोरेट बैज",
    category: "Modern & Tech",
    layoutVariant: "corporate_badge_card",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0f172a", accentColor: "#0ea5e9", headerTextColor: "#ffffff", borderColor: "#334155", badgeBg: "#e0f2fe", badgeText: "#0369a1", surfaceTint: "#f8fafc" },
  },
  {
    key: "oxford_gazette_press",
    name: "Oxford Academic Gazette",
    hindiTag: "गज़ट स्टाइल डबल-रूल सेरिफ कॉलम",
    category: "Board & Official",
    layoutVariant: "newspaper_gazette",
    borderStyle: "double",
    logoPosition: "center",
    colors: { primaryColor: "#1f2937", accentColor: "#991b1b", headerTextColor: "#111827", borderColor: "#1f2937", badgeBg: "#fee2e2", badgeText: "#991b1b", surfaceTint: "#f9fafb" },
  },
  {
    key: "aurora_peacock_glass",
    name: "Aurora Peacock Gradient",
    hindiTag: "मल्टी-ग्रेडिएंट ऑरोरा हेडर व सॉफ्ट ग्लास",
    category: "Creative & Sports",
    layoutVariant: "gradient_aurora_glass",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0d9488", accentColor: "#6366f1", headerTextColor: "#ffffff", borderColor: "#0f766e", badgeBg: "#ccfbf1", badgeText: "#134e4a", surfaceTint: "#f0fdfa" },
  },
  {
    key: "tricolor_national_crest",
    name: "Tricolor Sovereign Crest",
    hindiTag: "केसरिया-सफ़ेद-हरा राष्ट्रीय गौरव रिबन",
    category: "Royal & Heritage",
    layoutVariant: "tricolor_patriot_band",
    borderStyle: "solid",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#ea580c", accentColor: "#15803d", headerTextColor: "#0f172a", borderColor: "#1e3a8a", badgeBg: "#ffedd5", badgeText: "#9a3412", surfaceTint: "#fffbeb" },
  },
  {
    key: "obsidian_gold_foil",
    name: "Obsidian & Gold Foil",
    hindiTag: "गहरा ब्लैक ओब्सिडियन व गोल्ड फॉइल चमक",
    category: "Royal & Heritage",
    layoutVariant: "dark_executive_obsidian",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#18181b", accentColor: "#f59e0b", headerTextColor: "#fde68a", borderColor: "#d97706", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fafafa" },
  },
  {
    key: "precision_navy_matrix",
    name: "Precision Matrix Ledger",
    hindiTag: "हर जानकारी के लिए शार्प बॉक्स्ड मैट्रिक्स",
    category: "Board & Official",
    layoutVariant: "checker_ledger_grid",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#1d4ed8", accentColor: "#2563eb", headerTextColor: "#0f172a", borderColor: "#1e40af", badgeBg: "#dbeafe", badgeText: "#1e3a8a", surfaceTint: "#eff6ff" },
  },
  {
    key: "emblem_seal_maroon",
    name: "Royal Seal Centerpiece",
    hindiTag: "सेंटर एम्बलम वॉटरमार्क व शाही लाल मोहर",
    category: "Diploma & Honor",
    layoutVariant: "stamp_seal_watermark",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#7f1d1d", accentColor: "#d97706", headerTextColor: "#ffffff", borderColor: "#991b1b", badgeBg: "#fee2e2", badgeText: "#7f1d1d", surfaceTint: "#fef2f2" },
  },

  // 21 - 30 (New Structural Layouts 21-30)
  {
    key: "ocean_wave_crest",
    name: "Pacific Wave Crest",
    hindiTag: "लहरदार वेव हेडर व कूल ओशन फिनिश",
    category: "Creative & Sports",
    layoutVariant: "wave_crest_header",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0284c7", accentColor: "#06b6d4", headerTextColor: "#ffffff", borderColor: "#0369a1", badgeBg: "#e0f2fe", badgeText: "#0c4a6e", surfaceTint: "#f0f9ff" },
  },
  {
    key: "chevron_shield_crimson",
    name: "Spartan V-Chevron Shield",
    hindiTag: "वी-शेप शेवरॉन शील्ड व एथलेटिक कट",
    category: "Creative & Sports",
    layoutVariant: "chevron_shield_banner",
    borderStyle: "solid",
    logoPosition: "center",
    colors: { primaryColor: "#991b1b", accentColor: "#f59e0b", headerTextColor: "#ffffff", borderColor: "#7f1d1d", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fef2f2" },
  },
  {
    key: "twin_pillars_emerald",
    name: "Twin Pillars Heritage",
    hindiTag: "दोनों तरफ़ वर्टिकल पिलर रेल बॉर्डर",
    category: "Royal & Heritage",
    layoutVariant: "dual_vertical_rails",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#064e3b", accentColor: "#d97706", headerTextColor: "#064e3b", borderColor: "#065f46", badgeBg: "#d1fae5", badgeText: "#064e3b", surfaceTint: "#ecfdf5" },
  },
  {
    key: "bottom_dock_slate",
    name: "Inverted Slate Dock",
    hindiTag: "क्लीन टॉप + नीचे गहरा डॉक बार पैनल",
    category: "Modern & Tech",
    layoutVariant: "bottom_dock_bar",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#1e293b", accentColor: "#3b82f6", headerTextColor: "#ffffff", borderColor: "#334155", badgeBg: "#dbeafe", badgeText: "#1e40af", surfaceTint: "#f8fafc" },
  },
  {
    key: "lanyard_event_indigo",
    name: "Summit Lanyard Pass",
    hindiTag: "डोरी पंच स्लॉट नॉच व कॉर्पोरेट समिट लुक",
    category: "Modern & Tech",
    layoutVariant: "lanyard_punch_badge",
    borderStyle: "solid",
    logoPosition: "center",
    colors: { primaryColor: "#3730a3", accentColor: "#8b5cf6", headerTextColor: "#ffffff", borderColor: "#4f46e5", badgeBg: "#ede9fe", badgeText: "#4c1d95", surfaceTint: "#f5f3ff" },
  },
  {
    key: "diplomatic_passport_navy",
    name: "Diplomatic Passport MRZ",
    hindiTag: "पासपोर्ट स्टाइल कोट व नीचे MRZ कोड स्ट्रिप",
    category: "Board & Official",
    layoutVariant: "passport_mrz_edition",
    borderStyle: "solid",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#0c2461", accentColor: "#c28e2b", headerTextColor: "#ffffff", borderColor: "#0c2461", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#f8fafc" },
  },
  {
    key: "event_ticket_coral",
    name: "Perforated Gala Pass",
    hindiTag: "साइड कट-नॉच टिकट पास व डैश्ड डिवाइडर",
    category: "Creative & Sports",
    layoutVariant: "ticket_stub_notch",
    borderStyle: "dashed",
    logoPosition: "left",
    colors: { primaryColor: "#be123c", accentColor: "#fb7185", headerTextColor: "#ffffff", borderColor: "#e11d48", badgeBg: "#ffe4e6", badgeText: "#9f1239", surfaceTint: "#fff1f2" },
  },
  {
    key: "architect_brackets_mono",
    name: "Architect Corner Brackets",
    hindiTag: "चारों कोनों पर L-ब्रैकेट व मिनिमल सेंटर",
    category: "Minimal & Print",
    layoutVariant: "corner_bracket_frame",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0f766e", accentColor: "#14b8a6", headerTextColor: "#0f172a", borderColor: "#0f766e", badgeBg: "#ccfbf1", badgeText: "#115e59", surfaceTint: "#f0fdfa" },
  },
  {
    key: "octagon_plaque_bronze",
    name: "Octagonal Bronze Plaque",
    hindiTag: "कटे कोनों वाला बेवेल्ड अष्टकोणीय फ्रेम",
    category: "Diploma & Honor",
    layoutVariant: "beveled_octagon_frame",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#7c2d12", accentColor: "#d97706", headerTextColor: "#ffffff", borderColor: "#9a3412", badgeBg: "#ffedd5", badgeText: "#7c2d12", surfaceTint: "#fff7ed" },
  },
  {
    key: "blueprint_cad_cobalt",
    name: "Engineering CAD Blueprint",
    hindiTag: "टेक्निकल ब्लूप्रिंट ग्राफ़ ग्रिड व कोबाल्ट लाइन",
    category: "Modern & Tech",
    layoutVariant: "blueprint_tech_grid",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#1e40af", accentColor: "#38bdf8", headerTextColor: "#0f172a", borderColor: "#1d4ed8", badgeBg: "#dbeafe", badgeText: "#1e3a8a", surfaceTint: "#eff6ff" },
  },

  // 31 - 40 (New Structural Layouts 31-40)
  {
    key: "stacked_deck_plum",
    name: "Layered Card Deck Plum",
    hindiTag: "डबल-लेयर्ड स्टैक्ड कार्ड व फ्लोटिंग पिल हेडर",
    category: "Creative & Sports",
    layoutVariant: "stacked_deck_shadow",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#6b21a8", accentColor: "#ec4899", headerTextColor: "#ffffff", borderColor: "#7e22ce", badgeBg: "#fae8ff", badgeText: "#701a75", surfaceTint: "#fdf4ff" },
  },
  {
    key: "sash_ribbon_3d_maroon",
    name: "3D Folded Royal Sash",
    hindiTag: "3D फ़ोल्डेड बैनर रिबन व क्राउन क्रेस्ट",
    category: "Royal & Heritage",
    layoutVariant: "ribbon_fold_3d",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#881337", accentColor: "#f59e0b", headerTextColor: "#ffffff", borderColor: "#9f1239", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fff1f2" },
  },
  {
    key: "art_deco_gatsby_gold",
    name: "Gatsby Art Deco Ziggurat",
    hindiTag: "आर्ट डेको स्टेप्ड कॉर्नर व ब्लैक-गोल्ड क्लासिक",
    category: "Royal & Heritage",
    layoutVariant: "art_deco_stepped",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#18181b", accentColor: "#eab308", headerTextColor: "#fef08a", borderColor: "#ca8a04", badgeBg: "#fef9c3", badgeText: "#713f12", surfaceTint: "#fefce8" },
  },
  {
    key: "treasury_guilloche_mint",
    name: "Treasury Mint Guilloché",
    hindiTag: "बैंकनोट ट्रिपल-रूल सुरक्षा फ्रेम व आइवरी शीट",
    category: "Board & Official",
    layoutVariant: "guilloche_banknote",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#14532d", accentColor: "#15803d", headerTextColor: "#14532d", borderColor: "#166534", badgeBg: "#dcfce7", badgeText: "#14532d", surfaceTint: "#f0fdf4" },
  },
  {
    key: "editorial_masthead_ink",
    name: "Vogue Academic Masthead",
    hindiTag: "बोल्ड मैगज़ीन मास्टहेड व असिमिट्रिक टू-कॉलम",
    category: "Minimal & Print",
    layoutVariant: "magazine_editorial",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#111827", accentColor: "#dc2626", headerTextColor: "#111827", borderColor: "#1f2937", badgeBg: "#fee2e2", badgeText: "#991b1b", surfaceTint: "#f9fafb" },
  },
  {
    key: "varsity_scoreboard_amber",
    name: "Varsity Athletic Scoreboard",
    hindiTag: "बोल्ड ऑल-कैप्स स्पोर्ट्स स्कोरबोर्ड बैनर",
    category: "Creative & Sports",
    layoutVariant: "stadium_scoreboard",
    borderStyle: "solid",
    logoPosition: "center",
    colors: { primaryColor: "#0f172a", accentColor: "#f97316", headerTextColor: "#ffffff", borderColor: "#ea580c", badgeBg: "#ffedd5", badgeText: "#9a3412", surfaceTint: "#fff7ed" },
  },
  {
    key: "museum_brass_plaque",
    name: "Museum Brass Plaque",
    hindiTag: "पीतल पट्टिका इनसेट बॉर्डर व कॉर्नर स्टड्स",
    category: "Diploma & Honor",
    layoutVariant: "museum_plaque_gold",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#713f12", accentColor: "#ca8a04", headerTextColor: "#422006", borderColor: "#a16207", badgeBg: "#fef9c3", badgeText: "#713f12", surfaceTint: "#fefce8" },
  },
  {
    key: "imperial_scroll_parchment",
    name: "Imperial Parchment Scroll",
    hindiTag: "प्राचीन शाही स्क्रॉल रोल बैनर व क्रीम पेपर",
    category: "Diploma & Honor",
    layoutVariant: "scroll_parchment_curl",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#5c2b12", accentColor: "#d97706", headerTextColor: "#fffbeb", borderColor: "#78350f", badgeBg: "#fde68a", badgeText: "#5c2b12", surfaceTint: "#fffdf5" },
  },
  {
    key: "diagonal_duotone_cyber",
    name: "55° Cyber Two-Tone Cut",
    hindiTag: "55° डायगोनल टू-टोन बैनर व मेट्रो कार्ड ब्लॉक्स",
    category: "Creative & Sports",
    layoutVariant: "split_diagonal_duotone",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#4c1d95", accentColor: "#06b6d4", headerTextColor: "#ffffff", borderColor: "#5b21b6", badgeBg: "#cffafe", badgeText: "#164e63", surfaceTint: "#f5f3ff" },
  },
  {
    key: "floating_island_sky",
    name: "Sky Floating Pill Island",
    hindiTag: "डिटैच्ड फ्लोटिंग पिल हेडर आइलैंड व सॉफ्ट ब्लू",
    category: "Modern & Tech",
    layoutVariant: "floating_pill_island",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0369a1", accentColor: "#38bdf8", headerTextColor: "#ffffff", borderColor: "#0284c7", badgeBg: "#e0f2fe", badgeText: "#0369a1", surfaceTint: "#f0f9ff" },
  },

  // 41 - 50 (New Structural Layouts 41-50)
  {
    key: "wide_left_profile_navy",
    name: "35% Left Profile Column",
    hindiTag: "बाईं ओर चौड़ा 35% नेवी प्रोफाइल पैनल",
    category: "Modern & Tech",
    layoutVariant: "vertical_left_wide",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#172554", accentColor: "#2563eb", headerTextColor: "#ffffff", borderColor: "#1e40af", badgeBg: "#dbeafe", badgeText: "#1e3a8a", surfaceTint: "#eff6ff" },
  },
  {
    key: "wide_right_profile_wine",
    name: "35% Right Profile Column",
    hindiTag: "दाईं ओर चौड़ा 35% वाइन रेड प्रोफाइल पैनल",
    category: "Modern & Tech",
    layoutVariant: "vertical_right_wide",
    borderStyle: "solid",
    logoPosition: "right",
    colors: { primaryColor: "#500724", accentColor: "#db2777", headerTextColor: "#ffffff", borderColor: "#831843", badgeBg: "#fce7f3", badgeText: "#831843", surfaceTint: "#fdf2f8" },
  },
  {
    key: "dossier_index_tab_olive",
    name: "Archive Dossier Folder Tab",
    hindiTag: "ऑफिशियल फ़ाइल फोल्डर इंडेक्स टैब डिज़ाइन",
    category: "Board & Official",
    layoutVariant: "dossier_folder_tab",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#365314", accentColor: "#65a30d", headerTextColor: "#1a2e05", borderColor: "#3f6212", badgeBg: "#ecfccb", badgeText: "#365314", surfaceTint: "#f7fee7" },
  },
  {
    key: "swiss_cross_graphite",
    name: "Swiss Cross Asymmetric",
    hindiTag: "ग्रेफाइट स्विस क्रॉस असिमिट्रिक ग्रिड",
    category: "Minimal & Print",
    layoutVariant: "swiss_cross_asymmetric",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#18181b", accentColor: "#ef4444", headerTextColor: "#18181b", borderColor: "#27272a", badgeBg: "#fee2e2", badgeText: "#991b1b", surfaceTint: "#fafafa" },
  },
  {
    key: "sunrise_horizon_orange",
    name: "Horizon Sunrise Curve",
    hindiTag: "सनराइज़ क्षितिज कर्व्ड गोल्डन-ऑरेंज हेडर",
    category: "Creative & Sports",
    layoutVariant: "horizon_sunset_curve",
    borderStyle: "solid",
    logoPosition: "center",
    colors: { primaryColor: "#c2410c", accentColor: "#f59e0b", headerTextColor: "#ffffff", borderColor: "#ea580c", badgeBg: "#ffedd5", badgeText: "#9a3412", surfaceTint: "#fff7ed" },
  },
  {
    key: "diamond_crest_sapphire",
    name: "Sapphire Diamond Medallion",
    hindiTag: "शीर्ष पर डायमंड क्रेस्ट मेडल व शाही फ्रेम",
    category: "Diploma & Honor",
    layoutVariant: "diamond_crest_frame",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#1e3a8a", accentColor: "#0ea5e9", headerTextColor: "#ffffff", borderColor: "#1d4ed8", badgeBg: "#e0f2fe", badgeText: "#0369a1", surfaceTint: "#f0f9ff" },
  },
  {
    key: "heavy_pillars_charcoal",
    name: "Heavy Top-Bottom Pillars",
    hindiTag: "ऊपर-नीचे मोटी रंगीन पट्टियाँ — क्लीन साइडलेस लुक",
    category: "Board & Official",
    layoutVariant: "top_bottom_heavy_bars",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#0f172a", accentColor: "#0d9488", headerTextColor: "#ffffff", borderColor: "#0f172a", badgeBg: "#ccfbf1", badgeText: "#115e59", surfaceTint: "#f0fdfa" },
  },
  {
    key: "mono_stripe_pure",
    name: "Nordic Mono Hairline Stripe",
    hindiTag: "पतली सिंगल वर्टिकल एक्सेंट लाइन व अल्ट्रा-क्लीन",
    category: "Minimal & Print",
    layoutVariant: "minimal_mono_stripe",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#334155", accentColor: "#64748b", headerTextColor: "#0f172a", borderColor: "#475569", badgeBg: "#f1f5f9", badgeText: "#1e293b", surfaceTint: "#f8fafc" },
  },
  {
    key: "checkered_heritage_crimson",
    name: "Checkered Mosaic Heritage",
    hindiTag: "चेकर्ड मोज़ेक बॉर्डर पट्टी व क्लासिक सम्मान फ्रेम",
    category: "Royal & Heritage",
    layoutVariant: "checkered_classic_border",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#7f1d1d", accentColor: "#d97706", headerTextColor: "#7f1d1d", borderColor: "#991b1b", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fef2f2" },
  },
  {
    key: "scallop_canopy_purple",
    name: "Darbar Scalloped Canopy",
    hindiTag: "स्केलॉप्ड शाही दरबारी कैनोपी हेडर",
    category: "Royal & Heritage",
    layoutVariant: "royal_canopy_scallop",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#4c1d95", accentColor: "#eab308", headerTextColor: "#ffffff", borderColor: "#6d28d9", badgeBg: "#fef9c3", badgeText: "#713f12", surfaceTint: "#f5f3ff" },
  },

  // 51 - 60 (New Structural Layouts 51-60)
  {
    key: "accountancy_folio_forest",
    name: "Emerald Double-Rule Folio",
    hindiTag: "डबल-रूल अकाउंटेंसी लेज़र कॉलम व बॉक्स",
    category: "Board & Official",
    layoutVariant: "emerald_folio_ledger",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#065f46", accentColor: "#059669", headerTextColor: "#064e3b", borderColor: "#047857", badgeBg: "#d1fae5", badgeText: "#064e3b", surfaceTint: "#ecfdf5" },
  },
  {
    key: "prism_facet_magenta",
    name: "Crystal Prism Mosaic",
    hindiTag: "प्रिज़्म क्रिस्टल मल्टी-पॉलीगॉन हेडर",
    category: "Creative & Sports",
    layoutVariant: "prism_mosaic_header",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#a21caf", accentColor: "#0ea5e9", headerTextColor: "#ffffff", borderColor: "#86198f", badgeBg: "#fae8ff", badgeText: "#86198f", surfaceTint: "#fdf4ff" },
  },
  {
    key: "laurel_chancellor_gold",
    name: "Chancellor Laurel Wreath",
    hindiTag: "लॉरेल माल्यार्पण सम्मान मेडल व आइवरी पेपर",
    category: "Diploma & Honor",
    layoutVariant: "chancellor_laurel_wreath",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#14532d", accentColor: "#d97706", headerTextColor: "#ffffff", borderColor: "#166534", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#f0fdf4" },
  },
  {
    key: "cyber_hud_neon_teal",
    name: "Cyber HUD Tech Matrix",
    hindiTag: "फ्यूचरिस्टिक साइबर HUD कॉर्नर मार्क व डार्क हेडर",
    category: "Modern & Tech",
    layoutVariant: "cyber_circuit_neon",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#09090b", accentColor: "#06b6d4", headerTextColor: "#67e8f9", borderColor: "#0891b2", badgeBg: "#cffafe", badgeText: "#164e63", surfaceTint: "#ecfeff" },
  },
  {
    key: "postage_stamp_sepia",
    name: "Vintage Sepia Postage Stamp",
    hindiTag: "डाक टिकट पर्फ़ोरेटेड बॉर्डर व सेपिया विंटेज",
    category: "Minimal & Print",
    layoutVariant: "vintage_postage_stamp",
    borderStyle: "dashed",
    logoPosition: "center",
    colors: { primaryColor: "#78350f", accentColor: "#b45309", headerTextColor: "#451a03", borderColor: "#92400e", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fffbeb" },
  },
  {
    key: "zen_asymmetric_slate",
    name: "Kyoto Zen Asymmetric",
    hindiTag: "ज़ेन मिनिमल सफ़ेद स्पेस व साइड एक्सेंट बार",
    category: "Minimal & Print",
    layoutVariant: "zen_minimal_frame",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#1e293b", accentColor: "#10b981", headerTextColor: "#0f172a", borderColor: "#cbd5e1", badgeBg: "#d1fae5", badgeText: "#065f46", surfaceTint: "#f8fafc" },
  },
  {
    key: "concentric_halo_indigo",
    name: "Concentric Halo Crest",
    hindiTag: "केन्द्र में डबल हेलो रिंग वॉटरमार्क व आर्च हेडर",
    category: "Diploma & Honor",
    layoutVariant: "concentric_rings_crest",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#312e81", accentColor: "#f59e0b", headerTextColor: "#ffffff", borderColor: "#4338ca", badgeBg: "#e0e7ff", badgeText: "#312e81", surfaceTint: "#eef2ff" },
  },
  {
    key: "bookmark_ribbon_garnet",
    name: "Garnet Bookmark Flag",
    hindiTag: "ऊपर से लटकता V-कट बुकमार्क रिबन फ्लैग",
    category: "Royal & Heritage",
    layoutVariant: "vertical_ribbon_bookmark",
    borderStyle: "double",
    logoPosition: "left",
    showWatermark: true,
    colors: { primaryColor: "#881337", accentColor: "#d97706", headerTextColor: "#881337", borderColor: "#9f1239", badgeBg: "#ffe4e6", badgeText: "#881337", surfaceTint: "#fff1f2" },
  },
  {
    key: "double_decker_cobalt",
    name: "Dual-Tier Board Subheader",
    hindiTag: "दो अलग रंग की हेडर + सब-हेडर बैनर पट्टियाँ",
    category: "Board & Official",
    layoutVariant: "double_decker_split",
    borderStyle: "solid",
    logoPosition: "left",
    colors: { primaryColor: "#1e3a8a", accentColor: "#0284c7", headerTextColor: "#ffffff", borderColor: "#1d4ed8", badgeBg: "#dbeafe", badgeText: "#1e3a8a", surfaceTint: "#eff6ff" },
  },
  {
    key: "sovereign_imperial_obsidian",
    name: "Sovereign Imperial Crown",
    hindiTag: "सर्वोच्च सम्राट ब्लैक-गोल्ड फ्रेम व ऑर्नामेंट क्रेस्ट",
    category: "Diploma & Honor",
    layoutVariant: "sovereign_imperial_gold",
    borderStyle: "double",
    logoPosition: "center",
    showWatermark: true,
    colors: { primaryColor: "#111827", accentColor: "#d97706", headerTextColor: "#fde68a", borderColor: "#b45309", badgeBg: "#fef3c7", badgeText: "#78350f", surfaceTint: "#fffbeb" },
  },
];

// Backward-compatible export alias
export const FIFTY_PRESET_THEMES = SIXTY_PRESET_THEMES;

/**
 * Maps any of the 60 TemplateLayoutVariants to one of the 20 core layout archetypes
 * for any lightweight consumer while still keeping all 60 variants directly addressable via getLayoutArchitecture().
 */
export function mapToCoreLayoutVariant(variant?: TemplateLayoutVariant): TemplateLayoutVariant {
  if (!variant) return "classic_ribbon";
  const arch = getLayoutArchitecture(variant);
  if (arch.frameStyle === "left_spine" || arch.frameStyle === "left_wide") return "split_sidebar";
  if (arch.frameStyle === "right_spine" || arch.frameStyle === "right_wide") return "right_sidebar_spine";
  if (arch.frameStyle === "ornate_filigree" || arch.frameStyle === "laurel_wreath") return "heritage_ornate_frame";
  if (arch.frameStyle === "diploma_parchment" || arch.frameStyle === "museum_plaque") return "certificate_diploma";
  if (arch.frameStyle === "seal_center" || arch.frameStyle === "concentric_halo" || arch.frameStyle === "diamond_crest") return "stamp_seal_watermark";
  if (arch.frameStyle === "ink_dashed" || arch.frameStyle === "postage_stamp") return "ink_saver_classic";
  if (arch.frameStyle === "matrix_boxed" || arch.frameStyle === "passport_mrz" || arch.frameStyle === "dossier_tab" || arch.frameStyle === "folio_ledger") return "checker_ledger_grid";
  if (arch.frameStyle === "tricolor") return "tricolor_patriot_band";
  if (arch.headerStyle === "obsidian" || arch.frameStyle === "cyber_hud") return "dark_executive_obsidian";
  if (arch.headerStyle === "arch" || arch.headerStyle === "wave" || arch.headerStyle === "scallop") return "top_banner_arch";
  if (arch.headerStyle === "aurora" || arch.headerStyle === "prism" || arch.headerStyle === "horizon") return "gradient_aurora_glass";
  if (arch.headerStyle === "diagonal" || arch.headerStyle === "chevron" || arch.headerStyle === "scoreboard") return "diagonal_sport";
  if (arch.headerStyle === "gazette_double" || arch.headerStyle === "editorial_split") return "newspaper_gazette";
  if (arch.headerStyle === "split_duotone" || arch.headerStyle === "double_decker") return "dual_tone_split";
  if (arch.headerStyle === "floating_pill" || arch.frameStyle === "metro_blocks" || arch.frameStyle === "stacked_deck" || arch.frameStyle === "lanyard_punch") return "modern_floating";
  if (arch.frameStyle === "mono_stripe" || arch.frameStyle === "zen_asymmetric" || arch.frameStyle === "corner_brackets" || arch.frameStyle === "swiss_cross") return "minimal_grid";
  return "classic_ribbon";
}

export function buildDefaultTemplate(docType: DocumentTemplateType): DocumentTemplateConfig {
  const meta = DOC_TYPE_META[docType];
  return {
    id: "default",
    name: "App Original Default (पहले वाला डिफ़ॉल्ट)",
    hindiTag: "ऐप का मूल डिज़ाइन — बिना किसी बदलाव के",
    category: "Royal & Heritage",
    docType,
    layoutVariant: undefined,
    isDefault: true,
    borderStyle: "solid",
    logoPosition: "left",
    showWatermark: false,
    watermarkText: "",
    footerNote: "",
    leftSignatoryLabel: meta.defaultLeftSign,
    rightSignatoryLabel: meta.defaultRightSign,
    colors: {
      primaryColor: "#0f172a",
      accentColor: "#4f46e5",
      headerTextColor: "#ffffff",
      borderColor: "#0f172a",
      badgeBg: "#e0e7ff",
      badgeText: "#312e81",
      surfaceTint: "#f8fafc",
    },
  };
}

export function getBuiltInPresetTemplates(docType: DocumentTemplateType): DocumentTemplateConfig[] {
  const meta = DOC_TYPE_META[docType];
  const presetList: DocumentTemplateConfig[] = SIXTY_PRESET_THEMES.map((theme, idx) => ({
    id: `preset_${docType}_${theme.key}`,
    name: `${String(idx + 1).padStart(2, "0")}. ${theme.name}`,
    hindiTag: theme.hindiTag,
    category: theme.category,
    docType,
    layoutVariant: theme.layoutVariant,
    isDefault: false,
    isCustom: false,
    borderStyle: theme.borderStyle,
    logoPosition: theme.logoPosition,
    showWatermark: Boolean(theme.showWatermark || docType === "certificate"),
    watermarkText: docType === "certificate" ? "VERIFIED CERTIFICATE" : "OFFICIAL COPY",
    footerNote: meta.defaultFooter,
    leftSignatoryLabel: meta.defaultLeftSign,
    rightSignatoryLabel: meta.defaultRightSign,
    colors: { ...theme.colors },
  }));

  return [buildDefaultTemplate(docType), ...presetList];
}

function getStorageKey(schoolId?: string): string {
  return `school_doc_templates_${schoolId || "default_school"}`;
}

export function getColorOverrideKey(docType: DocumentTemplateType, templateId: string): string {
  return `${docType}:${templateId}`;
}

export function loadSchoolDocumentTemplatesState(
  schoolId?: string,
  school?: Partial<School> | null
): SchoolDocumentTemplatesState {
  let localState: SchoolDocumentTemplatesState = {};
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(getStorageKey(schoolId || school?.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          localState = parsed;
        }
      }
    }
  } catch {
    localState = {};
  }

  const cloudState = ((school as any)?.documentTemplates || {}) as SchoolDocumentTemplatesState;
  const merged: SchoolDocumentTemplatesState = {
    activeIds: {
      ...(cloudState.activeIds || {}),
      ...(localState.activeIds || {}),
    },
    colorOverrides: {
      ...(cloudState.colorOverrides || {}),
      ...(localState.colorOverrides || {}),
    },
    customTemplates:
      Array.isArray(localState.customTemplates) && localState.customTemplates.length > 0
        ? localState.customTemplates
        : Array.isArray(cloudState.customTemplates)
        ? cloudState.customTemplates
        : [],
  };
  return merged;
}

export async function saveSchoolDocumentTemplatesState(
  schoolId: string | undefined,
  nextState: SchoolDocumentTemplatesState,
  syncCloud: boolean = true
): Promise<void> {
  const sid = schoolId || "default_school";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(getStorageKey(sid), JSON.stringify(nextState));
    }
  } catch (err) {
    console.warn("[DocumentTemplates] Local save error:", err);
  }

  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(DOCUMENT_TEMPLATE_EVENT, { detail: { schoolId: sid, state: nextState } })
      );
    }
  } catch {
    // ignore event dispatch errors
  }

  if (syncCloud && schoolId) {
    try {
      await updateSchool(schoolId, { documentTemplates: nextState } as any);
    } catch (err) {
      console.warn("[DocumentTemplates] Cloud sync warning (saved locally):", err);
    }
  }
}

export function applyColorOverridesToTemplate(
  tpl: DocumentTemplateConfig,
  state: SchoolDocumentTemplatesState
): DocumentTemplateConfig {
  const key = getColorOverrideKey(tpl.docType, tpl.id);
  const override = state.colorOverrides?.[key] || state.colorOverrides?.[tpl.id];
  if (!override) return tpl;
  return {
    ...tpl,
    colors: {
      ...tpl.colors,
      ...override,
    },
  };
}

export function getTemplatesForType(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  docType: DocumentTemplateType
): DocumentTemplateConfig[] {
  const state = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const builtIns = getBuiltInPresetTemplates(docType);
  const customs = (state.customTemplates || [])
    .filter((t) => t && t.docType === docType)
    .map((t) => ({ ...t, layoutVariant: t.layoutVariant || "classic_ribbon" }));
  return [...builtIns, ...customs].map((tpl) => applyColorOverridesToTemplate(tpl, state));
}

export function resolveActiveDocumentTemplate(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  docType: DocumentTemplateType
): DocumentTemplateConfig {
  const state = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const activeId = state.activeIds?.[docType] || "default";
  const all = getTemplatesForType(schoolId, school, docType);
  return all.find((t) => t.id === activeId) || all[0] || buildDefaultTemplate(docType);
}

export async function setActiveTemplateForSchool(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  docType: DocumentTemplateType,
  templateId: string
): Promise<SchoolDocumentTemplatesState> {
  const cur = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const next: SchoolDocumentTemplatesState = {
    ...cur,
    activeIds: {
      ...(cur.activeIds || {}),
      [docType]: templateId,
    },
  };
  await saveSchoolDocumentTemplatesState(schoolId || school?.id, next, true);
  return next;
}

export async function saveTemplateColorOverride(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  docType: DocumentTemplateType,
  templateId: string,
  partialColors: Partial<TemplatePalette>
): Promise<SchoolDocumentTemplatesState> {
  const cur = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const key = getColorOverrideKey(docType, templateId);
  const next: SchoolDocumentTemplatesState = {
    ...cur,
    colorOverrides: {
      ...(cur.colorOverrides || {}),
      [key]: {
        ...(cur.colorOverrides?.[key] || {}),
        ...partialColors,
      },
    },
  };
  await saveSchoolDocumentTemplatesState(schoolId || school?.id, next, true);
  return next;
}

export async function resetTemplateColors(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  docType: DocumentTemplateType,
  templateId: string
): Promise<SchoolDocumentTemplatesState> {
  const cur = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const key = getColorOverrideKey(docType, templateId);
  const nextOverrides = { ...(cur.colorOverrides || {}) };
  delete nextOverrides[key];
  delete nextOverrides[templateId];
  const next: SchoolDocumentTemplatesState = {
    ...cur,
    colorOverrides: nextOverrides,
  };
  await saveSchoolDocumentTemplatesState(schoolId || school?.id, next, true);
  return next;
}

export async function saveCustomTemplate(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  template: DocumentTemplateConfig,
  activateImmediately: boolean = true
): Promise<SchoolDocumentTemplatesState> {
  const cur = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const existing = (cur.customTemplates || []).filter((t) => t.id !== template.id);
  const next: SchoolDocumentTemplatesState = {
    ...cur,
    customTemplates: [{ ...template, isCustom: true, isDefault: false }, ...existing],
    activeIds: activateImmediately
      ? { ...(cur.activeIds || {}), [template.docType]: template.id }
      : cur.activeIds,
  };
  await saveSchoolDocumentTemplatesState(schoolId || school?.id, next, true);
  return next;
}

export async function deleteCustomTemplate(
  schoolId: string | undefined,
  school: Partial<School> | null | undefined,
  docType: DocumentTemplateType,
  templateId: string
): Promise<SchoolDocumentTemplatesState> {
  const cur = loadSchoolDocumentTemplatesState(schoolId || school?.id, school);
  const remaining = (cur.customTemplates || []).filter((t) => t.id !== templateId);
  const nextActiveIds = { ...(cur.activeIds || {}) };
  if (nextActiveIds[docType] === templateId) {
    nextActiveIds[docType] = "default";
  }
  const next: SchoolDocumentTemplatesState = {
    ...cur,
    customTemplates: remaining,
    activeIds: nextActiveIds,
  };
  await saveSchoolDocumentTemplatesState(schoolId || school?.id, next, true);
  return next;
}
