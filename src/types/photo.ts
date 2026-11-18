export const BRAND_NAME = "SUN-NOVA PRINT SERVICE";
export const BRAND_ICON_URL = "/assets/aistudio/Sun-Nova_Print_Service_Icon_0e46cdd8.png";
export const OFFICIAL_SITE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) || "";
export const OFFICIAL_SUPPORT_EMAIL = "sopport.sunnovaprintservice@gmail.com";
export const DEFAULT_SUPPORT_EMAIL = OFFICIAL_SUPPORT_EMAIL;
export const PRINT_PPI = 300;

export type PresetKey =
  | "inch_1_2x1_5"
  | "india_passport_print"
  | "india_passport_digital"
  | "us_visa_oci"
  | "pan_card"
  | "custom_inch";

export interface PhotoPreset {
  id: PresetKey;
  label: string;
  shortLabel: string;
  physicalLabel: string;
  w: number;
  h: number;
  printW: number;
  printH: number;
  aspect: number;
}

export const PHOTO_PRESETS: Record<PresetKey, PhotoPreset> = {
  inch_1_2x1_5: {
    id: "inch_1_2x1_5",
    label: "1.2 × 1.5 inch (300 PPI · 360×450 px)",
    shortLabel: "1.2 × 1.5 in",
    physicalLabel: "1.2 × 1.5 in",
    w: 360,
    h: 450,
    printW: 360,
    printH: 450,
    aspect: 1.2 / 1.5,
  },
  india_passport_print: {
    id: "india_passport_print",
    label: "India Passport / Visa (35×45 mm · 413×531 px)",
    shortLabel: "35 × 45 mm",
    physicalLabel: "35 × 45 mm",
    w: 413,
    h: 531,
    printW: 413,
    printH: 531,
    aspect: 35 / 45,
  },
  india_passport_digital: {
    id: "india_passport_digital",
    label: "Passport Seva Digital (630×810 px)",
    shortLabel: "630 × 810 px",
    physicalLabel: "35 × 45 mm print",
    w: 630,
    h: 810,
    printW: 413,
    printH: 531,
    aspect: 630 / 810,
  },
  us_visa_oci: {
    id: "us_visa_oci",
    label: "US Visa / OCI Card (2×2 in · 600×600 px)",
    shortLabel: "2 × 2 in",
    physicalLabel: "2 × 2 in",
    w: 600,
    h: 600,
    printW: 600,
    printH: 600,
    aspect: 1,
  },
  pan_card: {
    id: "pan_card",
    label: "PAN Card NSDL / UTIITSL (25×35 mm · 295×413 px)",
    shortLabel: "25 × 35 mm",
    physicalLabel: "25 × 35 mm",
    w: 295,
    h: 413,
    printW: 295,
    printH: 413,
    aspect: 25 / 35,
  },
  custom_inch: {
    id: "custom_inch",
    label: "Custom Size (Inches @ 300 PPI)",
    shortLabel: "Custom Inch",
    physicalLabel: "Custom in",
    w: 360,
    h: 450,
    printW: 360,
    printH: 450,
    aspect: 1.2 / 1.5,
  },
};

export type PaperKey = "4x6" | "5x7" | "6x8" | "a4" | "a5";

export interface PaperSize {
  id: PaperKey;
  label: string;
  shortLabel: string;
  dimensionsText: string;
  w: number;
  h: number;
}

export const PAPER_SIZES: Record<PaperKey, PaperSize> = {
  "4x6": {
    id: "4x6",
    label: "4 × 6 inch (4R)",
    shortLabel: "4 × 6 in",
    dimensionsText: "1200 × 1800 px",
    w: 1200,
    h: 1800,
  },
  "5x7": {
    id: "5x7",
    label: "5 × 7 inch (5R)",
    shortLabel: "5 × 7 in",
    dimensionsText: "1500 × 2100 px",
    w: 1500,
    h: 2100,
  },
  "6x8": {
    id: "6x8",
    label: "6 × 8 inch",
    shortLabel: "6 × 8 in",
    dimensionsText: "1800 × 2400 px",
    w: 1800,
    h: 2400,
  },
  a5: {
    id: "a5",
    label: "A5 Sheet (148×210 mm)",
    shortLabel: "A5",
    dimensionsText: "1748 × 2480 px",
    w: 1748,
    h: 2480,
  },
  a4: {
    id: "a4",
    label: "A4 Sheet (210×297 mm)",
    shortLabel: "A4",
    dimensionsText: "2480 × 3508 px",
    w: 2480,
    h: 3508,
  },
};

export const GAP_OPTIONS_MM = [
  { mm: 0, label: "0 mm (No Gap)" },
  { mm: 2, label: "2 mm (24 px)" },
  { mm: 3, label: "3 mm (35 px · Standard)" },
  { mm: 4, label: "4 mm (47 px)" },
  { mm: 5, label: "5 mm (59 px)" },
];

export const BG_COLORS = [
  { name: "Pure White", hex: "#FFFFFF" },
  { name: "Light Blue", hex: "#DCE9F5" },
  { name: "Sky Blue", hex: "#CBE4F9" },
  { name: "Light Grey", hex: "#E5E7EB" },
];

export type CutBorderStyle = "light" | "dark" | "none";

export type OutlineStyle = "solid" | "dashed" | "dotted";

export const OUTLINE_STYLES: { id: OutlineStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
];

export type SheetOrientation = "auto" | "portrait" | "landscape";

export type DressCategory =
  | "All"
  | "Student"
  | "Officer"
  | "Men"
  | "Women"
  | "Formal";

export type DressStyleId =
  | "none"
  | "student_white_tie"
  | "student_navy_uniform"
  | "student_graduation"
  | "officer_khaki"
  | "officer_ias_suit"
  | "officer_defence_navy"
  | "officer_doctor_coat"
  | "black_suit_tie"
  | "navy_blazer_white"
  | "white_formal_shirt"
  | "womens_black_blazer"
  | "womens_navy_blazer"
  | "nehru_jacket";

export interface DressPreset {
  id: DressStyleId;
  label: string;
  category: Exclude<DressCategory, "All"> | "None";
}

export const DRESS_PRESETS: DressPreset[] = [
  { id: "none", label: "Original Outfit", category: "None" },
  {
    id: "student_white_tie",
    label: "Student White Shirt & Tie",
    category: "Student",
  },
  {
    id: "student_navy_uniform",
    label: "Student Navy Blazer & Crest",
    category: "Student",
  },
  {
    id: "student_graduation",
    label: "Graduation Gown & Stole",
    category: "Student",
  },
  {
    id: "officer_khaki",
    label: "Police / Khaki Officer Uniform",
    category: "Officer",
  },
  {
    id: "officer_ias_suit",
    label: "IAS / Civil Officer Executive Suit",
    category: "Officer",
  },
  {
    id: "officer_defence_navy",
    label: "Defence / Navy White Ceremonial Coat",
    category: "Officer",
  },
  {
    id: "officer_doctor_coat",
    label: "Medical Officer / Doctor White Coat",
    category: "Officer",
  },
  { id: "black_suit_tie", label: "Executive Black Suit & Tie", category: "Men" },
  { id: "navy_blazer_white", label: "Navy Blazer & Blue Tie", category: "Men" },
  {
    id: "white_formal_shirt",
    label: "Crisp White Formal Shirt",
    category: "Formal",
  },
  {
    id: "womens_black_blazer",
    label: "Women's Tailored Black Blazer",
    category: "Women",
  },
  {
    id: "womens_navy_blazer",
    label: "Women's Tailored Navy Suit",
    category: "Women",
  },
  {
    id: "nehru_jacket",
    label: "Dark Bandhgala / Nehru Coat",
    category: "Formal",
  },
];

export type StudioAccentKey = "royal" | "amber" | "emerald" | "slate";

export const DEFAULT_STUDIO_ACCENT: StudioAccentKey = "royal";

export const STUDIO_ACCENTS: Record<
  StudioAccentKey,
  {
    label: string;
    swatch: string;
    secondarySwatch: string;
    primaryBtn: string;
    activeTab: string;
    ringText: string;
  }
> = {
  royal: {
    label: "Electric Cyan + Violet",
    swatch: "#00E5FF",
    secondarySwatch: "#8B5CF6",
    primaryBtn: "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] hover:brightness-110",
    activeTab: "border-[#00E5FF]/50 bg-[#00E5FF]/15 text-[#F5F7FA]",
    ringText: "text-[#00E5FF]",
  },
  amber: {
    label: "Cyber Gold",
    swatch: "#F59E0B",
    secondarySwatch: "#00E5FF",
    primaryBtn: "bg-amber-400 text-[#080B12] hover:bg-amber-300",
    activeTab: "border-amber-400/50 bg-amber-400/15 text-[#F5F7FA]",
    ringText: "text-amber-300",
  },
  emerald: {
    label: "Neon Emerald",
    swatch: "#10B981",
    secondarySwatch: "#00E5FF",
    primaryBtn: "bg-emerald-400 text-[#080B12] hover:bg-emerald-300",
    activeTab: "border-emerald-400/50 bg-emerald-400/15 text-[#F5F7FA]",
    ringText: "text-emerald-300",
  },
  slate: {
    label: "Platinum Monolith",
    swatch: "#F5F7FA",
    secondarySwatch: "#8B5CF6",
    primaryBtn: "bg-[#F5F7FA] text-[#080B12] hover:bg-slate-200",
    activeTab: "border-slate-300/50 bg-white/10 text-[#F5F7FA]",
    ringText: "text-[#F5F7FA]",
  },
};

export const BORDER_COLOR_PRESETS = [
  { name: "Light Gray", hex: "#CBD5E1" },
  { name: "Slate", hex: "#475569" },
  { name: "Black", hex: "#0F172A" },
  { name: "White", hex: "#FFFFFF" },
];

export type ImageFilterKey =
  | "none"
  | "grayscale"
  | "sepia"
  | "high_contrast"
  | "warm"
  | "cool_studio";

export interface ImageFilterPreset {
  id: ImageFilterKey;
  label: string;
  description: string;
}

export const IMAGE_FILTER_PRESETS: ImageFilterPreset[] = [
  { id: "none", label: "Original", description: "Natural color" },
  { id: "grayscale", label: "Grayscale", description: "Monochrome B&W" },
  { id: "sepia", label: "Sepia", description: "Warm archival" },
  { id: "high_contrast", label: "High Contrast", description: "Crisp detail" },
  { id: "warm", label: "Warm Tone", description: "Soft studio warmth" },
  { id: "cool_studio", label: "Cool Studio", description: "Crisp daylight" },
];

export interface PhotoEditState {
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  exposure: number;
  sharpness: number;
  saturation: number;
  naturalColor: boolean;
}

export const DEFAULT_PHOTO_EDIT_STATE: PhotoEditState = {
  crop: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  exposure: 0,
  sharpness: 0,
  saturation: 100,
  naturalColor: false,
};

export interface SheetQueueItem {
  id: string;
  label: string;
  dataUrl: string;
  copies: number;
  bgColor?: string;
  rotation?: number;
  sourceUrl?: string;
  sourceFile?: Blob;
}

export interface SheetLayoutResult {
  sheetW: number;
  sheetH: number;
  cols: number;
  rows: number;
  maxCount: number;
  count: number;
  activeRows: number;
  orientation: "Portrait" | "Landscape";
  startX: number;
  startY: number;
  usedW: number;
  usedH: number;
}
