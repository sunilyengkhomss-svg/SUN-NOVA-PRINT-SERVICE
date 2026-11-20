import { BRAND_NAME } from "../types/photo";

export type StudioAssistantActionId =
  | "open_passport"
  | "open_sheet_preview"
  | "open_enhance"
  | "jump_size"
  | "jump_bg_cut"
  | "jump_outfit"
  | "jump_info"
  | "jump_export"
  | "open_xerox"
  | "open_converters"
  | "open_resume"
  | "open_mail_desk";

export interface StudioAssistantAction {
  id: StudioAssistantActionId;
  label: string;
  mailSubject?: string;
  mailBody?: string;
}

export interface StudioLiveSnapshot {
  workspaceMode: "passport" | "enhance" | "xerox" | "converters" | "resume";
  hasImage: boolean;
  presetLabel: string;
  dimensionsText: string;
  paperLabel: string;
  sheetCount: number;
  gapMm: number;
  bgColor: string;
  bgRemoved: boolean;
  dressLabel: string;
  queueCount: number;
  targetKB: number;
  supportEmail: string;
}

export interface AssistantReply {
  text: string;
  actions?: StudioAssistantAction[];
  followUps?: string[];
}

export const STARTER_ASSISTANT_PROMPTS: readonly string[] = [
  "Which size fits Passport Seva or SSC forms?",
  "How do I upscale to HD/4K or unblur a photo?",
  "How to put 6 different photos in 1 A4 row?",
  "How to align Student or Officer outfits?",
  "How to make Aadhaar Front & Back Up-Down Xerox?",
  "Check my current studio settings",
];

const WORKSPACE_NAMES: Record<StudioLiveSnapshot["workspaceMode"], string> = {
  passport: "Passport Photo Studio",
  enhance: "AI Photo Enhance Studio",
  xerox: "Aadhaar / PAN / ID Xerox",
  converters: "PDF, XML & Text Converters",
  resume: "Resume Maker",
};

interface TopicRule {
  id: string;
  phrases: readonly string[];
  keywords: readonly string[];
  weight?: number;
  build: (snapshot: StudioLiveSnapshot, rawQuestion: string) => AssistantReply;
}

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’"`]/g, "")
    .replace(/[^a-z0-9.+×x/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatBgColorLabel(hex: string): string {
  const upper = hex.trim().toUpperCase();
  const known: Record<string, string> = {
    "#FFFFFF": "Pure White (#FFFFFF)",
    "#E0F2FE": "Light Blue (#E0F2FE)",
    "#BAE6FD": "Sky Blue (#BAE6FD)",
    "#E2E8F0": "Light Grey (#E2E8F0)",
  };
  return known[upper] ?? upper;
}

function buildLiveStatusLines(s: StudioLiveSnapshot): string {
  const kbText = s.targetKB > 0 ? `< ${s.targetKB} KB` : "Best Quality (No Limit)";
  return [
    `• Workspace: ${WORKSPACE_NAMES[s.workspaceMode]}`,
    `• Photo Loaded: ${s.hasImage ? "Yes (ready to edit & export)" : "Not yet — upload or capture a photo"}`,
    `• Crop Size: ${s.presetLabel} (${s.dimensionsText} @ 300 PPI)`,
    `• Print Sheet: ${s.paperLabel} · ${s.sheetCount} photos · ${s.gapMm} mm gap`,
    `• Background: ${formatBgColorLabel(s.bgColor)}${s.bgRemoved ? " (AI BG Removed)" : ""}`,
    `• Outfit Overlay: ${s.dressLabel}`,
    `• Multi-Photo Queue: ${s.queueCount} ${s.queueCount === 1 ? "person" : "people"} queued`,
    `• Single Photo KB Target: ${kbText}`,
  ].join("\n");
}

const TOPIC_RULES: readonly TopicRule[] = [
  {
    id: "current_settings",
    phrases: [
      "current setting",
      "my setting",
      "studio setting",
      "check my",
      "current status",
      "what is selected",
      "what am i using",
      "my current",
      "ready to export",
      "ready to download",
    ],
    keywords: [
      "current",
      "settings",
      "status",
      "summary",
      "selected",
      "active",
      "check",
    ],
    weight: 2,
    build: (s) => {
      const nextStep = !s.hasImage
        ? "Next step: Upload a photo or use Camera Capture in Passport Studio to start cropping."
        : s.queueCount > 0
          ? `Next step: You have ${s.queueCount} photo(s) in the Multi-Photo Queue — switch to Sheet Preview to inspect and download your 300 PPI print sheet.`
          : "Next step: Use the right panel steps (01–02 Size → 03 BG & Cut → 03b Outfit → 04–05 Info → Export) or preview your print sheet.";

      const actions: StudioAssistantAction[] = s.hasImage
        ? [
            { id: "open_sheet_preview", label: "Open Sheet Preview" },
            { id: "jump_export", label: "Jump to Export" },
          ]
        : [
            { id: "open_passport", label: "Open Passport Studio" },
            { id: "jump_size", label: "01–02 Size Settings" },
          ];

      return {
        text: `Here is your live ${BRAND_NAME} studio snapshot:\n\n${buildLiveStatusLines(s)}\n\n${nextStep}`,
        actions,
        followUps: [
          "Which size fits Passport Seva or SSC forms?",
          "How do I upscale to HD/4K or unblur a photo?",
          "How do I compress under 50 KB?",
        ],
      };
    },
  },
  {
    id: "photo_sizes",
    phrases: [
      "passport seva",
      "which size",
      "photo size",
      "crop size",
      "ssc form",
      "us visa",
      "pan card photo",
      "pan photo",
      "custom size",
      "300 ppi",
      "300 dpi",
      "35x45",
      "35 x 45",
      "2x2",
      "2 x 2",
      "1.2x1.5",
      "1.2 x 1.5",
      "govt exam",
    ],
    keywords: [
      "size",
      "sizes",
      "passport",
      "seva",
      "ssc",
      "upsc",
      "neet",
      "jee",
      "rrb",
      "railway",
      "visa",
      "oci",
      "nsdl",
      "utiitsl",
      "dimension",
      "dimensions",
      "pixel",
      "pixels",
      "inch",
      "inches",
      "mm",
      "ppi",
      "dpi",
      "exam",
      "form",
      "forms",
    ],
    build: (s) => ({
      text: [
        "Official 300 PPI Crop Presets in 01. Crop Size:",
        "• Passport Seva Online Digital: 630×810 px (also set 05. Max Size to < 50 KB if required).",
        "• India Passport / Visa / SSC / UPSC: 35×45 mm (413×531 px).",
        "• Standard Studio Print (Indian 1.2×1.5 in): 360×450 px (fits 42 photos on A4 or 9 on 4×6 with 3 mm gap).",
        "• US Visa / OCI / Green Card: 2×2 inch (600×600 px).",
        "• PAN Card (NSDL / UTIITSL): 25×35 mm (295×413 px · set Max Size to < 50 KB).",
        "• Custom Inch Size: Enter any width (0.5–6 in) × height (0.5–8 in) at exact 300 PPI.",
        "",
        `Currently selected in your studio: ${s.presetLabel} (${s.dimensionsText}).`,
      ].join("\n"),
      actions: [
        { id: "jump_size", label: "Jump to 01–02 Size" },
        { id: "jump_info", label: "Set 05. Max KB Size" },
      ],
      followUps: [
        "How do I add Name & DOP strip for SSC?",
        "How do I compress under 50 KB?",
        "How to put 6 different photos in 1 A4 row?",
      ],
    }),
  },
  {
    id: "multi_photo_a4_row",
    phrases: [
      "6 different",
      "six different",
      "1 a4 row",
      "one a4 row",
      "1 line",
      "one line",
      "multi photo",
      "multi-photo",
      "multiple photo",
      "upload multiple",
      "different photo",
      "different people",
      "photo queue",
      "sheet queue",
    ],
    keywords: [
      "6",
      "six",
      "different",
      "multi",
      "multiple",
      "queue",
      "family",
      "batch",
      "copies",
      "row",
      "line",
    ],
    weight: 2,
    build: (s) => ({
      text: [
        "To place 6 different photos in 1 single A4 row (300 PPI):",
        "1. Under the photo editor (Left Panel → Multi-Photo Sheet Queue), click A4 1-Line (6 Different).",
        "2. Click + Upload Multiple Photos and select up to 6 portraits at once — each is auto-cropped to 300 PPI with 1 copy.",
        "3. Or crop each person individually, choose Copies, and click Add to Multi-Photo Sheet.",
        "4. Switch to Sheet Preview to check the 6-photo row and download A4 300 PPI JPG, PNG, or PDF.",
        "",
        `Live queue status: ${s.queueCount} ${s.queueCount === 1 ? "photo" : "photos"} currently queued · Paper: ${s.paperLabel}.`,
      ].join("\n"),
      actions: [
        { id: "open_passport", label: "Open Passport Studio" },
        { id: "open_sheet_preview", label: "Open Sheet Preview" },
      ],
      followUps: [
        "How do I change paper size and photo gap?",
        "How do I add cut borders around photos?",
        "Check my current studio settings",
      ],
    }),
  },
  {
    id: "ai_photo_enhance",
    phrases: [
      "photo enhance",
      "ai enhance",
      "hd upscale",
      "4k upscale",
      "upscale photo",
      "super resolution",
      "real esrgan",
      "blur removal",
      "unblur photo",
      "remove blur",
      "face retouch",
      "colour correction",
      "color correction",
      "lighting correction",
      "before after",
      "before and after",
    ],
    keywords: [
      "enhance",
      "upscale",
      "upscaling",
      "4k",
      "hd",
      "esrgan",
      "blur",
      "blurry",
      "unblur",
      "deblur",
      "sharpen",
      "sharpness",
      "denoise",
      "noise",
      "face",
      "retouch",
      "blemish",
      "blemishes",
      "smooth",
      "skin",
      "exposure",
      "white balance",
      "vibrance",
      "lighting",
      "restore",
    ],
    weight: 2,
    build: () => ({
      text: [
        "AI Photo Enhance Studio (100% browser-private · Zero API key):",
        "• A. AI HD / 4K Upscaling: Open-source ESRGAN 2× (HD) & 4× (4K) neural super-resolution via tiled TensorFlow.js inference.",
        "• B. Blur Removal & Sharpening: Iterative deconvolution deblurring, edge-preserving noise reduction, and natural texture sharpening.",
        "• C. Background Removal & Replacement: Neural cutout preserving fine hair edges with Transparent, White, Blue, Grey, or Custom colour fills.",
        "• D. Natural Face Retouching: Subtle skin smoothing, minor blemish cleanup, and facial/eye clarity without artificial filters.",
        "• E. Colour & Lighting Correction: Auto exposure, white balance, brightness, contrast, and vibrance + interactive draggable Before/After split slider & 300 PPI JPG/PNG export.",
        "• One-tap Send to Passport Studio & Sheet Layout lets you crop and sheet-print your enhanced photo right away!",
      ].join("\n"),
      actions: [
        { id: "open_enhance", label: "Open AI Photo Enhance Studio" },
        { id: "open_passport", label: "Open Passport Studio" },
      ],
      followUps: [
        "How do I remove and change the background color?",
        "Which size fits Passport Seva or SSC forms?",
        "Does this app need an API key or upload my photo?",
      ],
    }),
  },
  {
    id: "remove_bg_and_colors",
    phrases: [
      "remove bg",
      "remove background",
      "background color",
      "change background",
      "white background",
      "blue background",
      "sky blue",
      "light grey",
      "cutout",
    ],
    keywords: [
      "bg",
      "background",
      "backdrop",
      "cutout",
      "transparent",
      "eraser",
      "white",
      "blue",
      "grey",
      "gray",
      "color",
      "colour",
    ],
    build: (s) => ({
      text: [
        "How to remove & replace photo backgrounds (100% in browser, no API key):",
        "1. In Passport Photo Studio, click AI Remove BG below your photo preview, then choose Pure White, Light Blue, Sky Blue, Light Grey, or Custom under 03. Background Color.",
        "2. Or open AI Photo Enhance Studio → Background tab to remove backgrounds with transparent PNG export or solid colour replacement and compare Before/After.",
        "",
        `Current studio background: ${formatBgColorLabel(s.bgColor)}${s.bgRemoved ? " (BG Cutout Active)" : ""}.`,
      ].join("\n"),
      actions: [
        { id: "jump_bg_cut", label: "Jump to 03 BG & Cut" },
        { id: "open_enhance", label: "Open AI Photo Enhance" },
      ],
      followUps: [
        "How to align Student or Officer outfits?",
        "How do I add outline or cut borders?",
        "Check my current studio settings",
      ],
    }),
  },
  {
    id: "dress_generator",
    phrases: [
      "passport dress",
      "student outfit",
      "officer outfit",
      "officer uniform",
      "police uniform",
      "doctor coat",
      "graduation gown",
      "formal suit",
      "align outfit",
      "align dress",
      "custom outfit",
    ],
    keywords: [
      "dress",
      "outfit",
      "outfits",
      "suit",
      "blazer",
      "tie",
      "shirt",
      "coat",
      "uniform",
      "student",
      "officer",
      "police",
      "khaki",
      "ias",
      "doctor",
      "medical",
      "defence",
      "navy",
      "graduation",
      "gown",
      "bandhgala",
      "nehru",
      "collar",
      "shoulder",
      "align",
    ],
    weight: 2,
    build: (s) => ({
      text: [
        "Using 03b. Passport Dress Generator (Student / Officer / Formal):",
        "1. Open step 03b Outfit in the right panel and filter by All, Student, Officer, Men, Women, Formal, or Custom.",
        "2. Pick an outfit (e.g., Student White Shirt & Tie, Navy Blazer & Crest, Police/Khaki Officer Uniform, IAS Executive Suit, Medical White Coat, Graduation Gown, or Bandhgala).",
        "3. Adjust Size (scale), Move X (left/right), and Move Y (up/down) so the collar sits cleanly at your neck and shoulders.",
        "4. Tip: Run AI Remove BG first if your original shirt collar peeks behind the new outfit.",
        "",
        `Currently selected outfit: ${s.dressLabel}.`,
      ].join("\n"),
      actions: [
        { id: "jump_outfit", label: "Jump to 03b Outfit" },
        { id: "jump_bg_cut", label: "03 BG & Cut" },
      ],
      followUps: [
        "How do I remove and change the background color?",
        "How do I add outline or cut borders?",
        "Check my current studio settings",
      ],
    }),
  },
  {
    id: "outline_cut_borders",
    phrases: [
      "cut border",
      "outline border",
      "cut line",
      "cut offset",
      "outer cut",
      "single photo border",
      "dashed border",
      "dotted border",
    ],
    keywords: [
      "outline",
      "border",
      "borders",
      "cut",
      "cutline",
      "scissor",
      "scissors",
      "dashed",
      "dotted",
      "solid",
      "thickness",
      "flush",
      "offset",
    ],
    build: () => ({
      text: [
        "Customizing Outline / Cut Borders (under 03 BG & Cut):",
        "• Thickness: Choose None, 2px, 4px, 6px, 10px, or drag smoothly from 0 to 16 px.",
        "• Line Style: Switch between Solid, Dashed, or Dotted cut guides.",
        "• Outer Cut Offset: Pick Flush (directly on photo edge) or +2 to +12 px outer spacing for cleaner trimming.",
        "• Color & Single Photo: Pick any border color and toggle On Single Photo if you also want the outline on individual digital downloads.",
      ].join("\n"),
      actions: [
        { id: "jump_bg_cut", label: "Jump to 03 BG & Cut" },
        { id: "open_sheet_preview", label: "Inspect on Sheet Preview" },
      ],
      followUps: [
        "How do I change paper size and photo gap?",
        "How to put 6 different photos in 1 A4 row?",
      ],
    }),
  },
  {
    id: "paper_sheet_layout",
    phrases: [
      "paper size",
      "print sheet",
      "photo gap",
      "sheet layout",
      "add 1 row",
      "add 2 rows",
      "sheet preview",
      "how many photos",
      "4x6 sheet",
      "a4 sheet",
    ],
    keywords: [
      "paper",
      "sheet",
      "a4",
      "a5",
      "4x6",
      "5x7",
      "6x8",
      "gap",
      "spacing",
      "margin",
      "rows",
      "orientation",
      "portrait",
      "landscape",
      "layout",
      "grid",
      "42",
      "12",
      "print",
    ],
    build: (s) => ({
      text: [
        "Print Paper Sizes & Uniform Gaps (02. Print Paper Size):",
        "• Supported 300 PPI Sheets: 4×6 in, 5×7 in, 6×8 in, A5, and A4 (210×297 mm · 2480×3508 px).",
        "• Photo Gap (All Papers): Choose 0 mm, 2 mm, 3 mm (35 px Standard), 4 mm, or 5 mm uniform cutting gap.",
        "• Fast Count Shortcuts: Pick All (e.g., 42 photos on A4 for 1.2×1.5 in), 1 Line (6), 2 Lines (12), Custom count, or tap Add 1 / 2 / 3 Rows.",
        "• Orientation: Keep Auto for maximum yield or lock Portrait / Landscape.",
        "",
        `Current sheet setup: ${s.paperLabel} · ${s.sheetCount} photos · ${s.gapMm} mm gap.`,
      ].join("\n"),
      actions: [
        { id: "jump_size", label: "Jump to 01–02 Size" },
        { id: "open_sheet_preview", label: "Open Sheet Preview" },
      ],
      followUps: [
        "How to put 6 different photos in 1 A4 row?",
        "How do I add outline or cut borders?",
        "Check my current studio settings",
      ],
    }),
  },
  {
    id: "name_dop_and_kb_export",
    phrases: [
      "name and date",
      "date strip",
      "date of photo",
      "under 50kb",
      "under 50 kb",
      "under 20kb",
      "under 20 kb",
      "max size",
      "file size",
      "portal upload",
      "compress photo",
      "download photo",
    ],
    keywords: [
      "name",
      "dop",
      "date",
      "strip",
      "slate",
      "kb",
      "20kb",
      "50kb",
      "100kb",
      "200kb",
      "compress",
      "compression",
      "limit",
      "portal",
      "download",
      "export",
      "jpg",
      "jpeg",
      "png",
      "save",
    ],
    build: (s) => ({
      text: [
        "04. Name & Date Strip (Govt Exams) + 05. Max KB Compression:",
        "• Name & DOP Strip: Enter Candidate Name and DOP (e.g. DOP: 14-11-2026) under 04–05 Info — a clean white strip prints automatically at the bottom of the portrait.",
        "• Single Photo Max Size (Portal Upload): Pick Best Quality (No Limit), < 20 KB, < 50 KB (ideal for Passport Seva, SSC & PAN), < 100 KB, or < 200 KB. Binary-search compression hits your exact KB ceiling while preserving 300 PPI metadata.",
        "• Export Options: Download Single Photo (JPG/PNG) or Full Print Sheet (JPG, PNG, or exact-mm PDF).",
        "",
        `Current KB target: ${s.targetKB > 0 ? `< ${s.targetKB} KB` : "Best Quality (No Limit)"}.`,
      ].join("\n"),
      actions: [
        { id: "jump_info", label: "Jump to 04–05 Info" },
        { id: "jump_export", label: "Jump to Export" },
      ],
      followUps: [
        "Which size fits Passport Seva or SSC forms?",
        "Check my current studio settings",
      ],
    }),
  },
  {
    id: "id_card_xerox",
    phrases: [
      "front and back",
      "front & back",
      "up down",
      "up-down",
      "side by side",
      "id card",
      "id xerox",
      "aadhaar xerox",
      "aadhar xerox",
      "pan xerox",
      "voter id",
      "driving license",
      "crop both",
    ],
    keywords: [
      "aadhaar",
      "aadhar",
      "voter",
      "license",
      "licence",
      "dl",
      "kyc",
      "xerox",
      "card",
      "front",
      "back",
      "cr80",
      "photocopy",
    ],
    weight: 2,
    build: () => ({
      text: [
        "How to make an Aadhaar / PAN / Voter ID / DL Front & Back A4 Xerox:",
        "1. Open the Aadhaar / PAN / ID Xerox workspace from the top mode switcher.",
        "2. Upload Front & Back photos separately, capture with Camera, or use Upload One Photo & Crop Both if both sides are in a single image.",
        "3. Choose Layout: Up-Down (stacked cleanly on A4), Side-by-Side, 2×2 Sheet, or Front Only.",
        "4. Pick Card Size: Standard CR80 (85.6×54 mm) or Custom mm dimensions, plus B&W Xerox, Grayscale, or Full Color tone.",
        "5. Download your true 300 PPI A4 PDF, JPG, or PNG ready for instant printing.",
      ].join("\n"),
      actions: [
        { id: "open_xerox", label: "Open Aadhaar / PAN Xerox" },
        { id: "open_converters", label: "PDF, XML & Text Tools" },
      ],
      followUps: [
        "How do I convert photos to PDF or extract text?",
        "Which size fits Passport Seva or SSC forms?",
      ],
    }),
  },
  {
    id: "pdf_xml_converters",
    phrases: [
      "photo to pdf",
      "image to pdf",
      "pdf to photo",
      "pdf to image",
      "text to image",
      "image to text",
      "xml to json",
      "xml to csv",
      "extract text",
    ],
    keywords: [
      "pdf",
      "xml",
      "json",
      "csv",
      "ocr",
      "converter",
      "converters",
      "convert",
      "extract",
      "minify",
      "pretty",
      "text",
    ],
    weight: 2,
    build: () => ({
      text: [
        "PDF, XML & Text Converters included inside SUN-NOVA PRINT SERVICE:",
        "• Photo → PDF: Combine one or multiple images into a clean A4 or Fit-to-Image PDF.",
        "• PDF → Photo: Render every page of a PDF into high-resolution JPG or PNG images.",
        "• Text → Image: Turn notices, quotes, or typed notes into styled PNG/JPG graphics.",
        "• Image → Text (OCR): Extract editable text from scanned documents or screenshots right in your browser.",
        "• XML Studio: Convert XML ↔ JSON, XML → CSV, Pretty-Print, Minify, or Plain Text.",
      ].join("\n"),
      actions: [
        { id: "open_converters", label: "Open PDF & XML Tools" },
        { id: "open_xerox", label: "Open ID Card Xerox" },
      ],
      followUps: [
        "How do I create a 300 PPI Resume?",
        "How to make Aadhaar Front & Back Up-Down Xerox?",
      ],
    }),
  },
  {
    id: "resume_maker",
    phrases: [
      "resume maker",
      "make resume",
      "create resume",
      "build resume",
      "bio data",
      "cv maker",
    ],
    keywords: [
      "resume",
      "cv",
      "biodata",
      "job",
      "template",
      "templates",
      "experience",
      "education",
      "skills",
      "career",
    ],
    weight: 2,
    build: () => ({
      text: [
        "Building a print-ready CV in Resume Maker:",
        "1. Switch to the Resume Maker workspace.",
        "2. Load a Quick Role Preset (e.g., Fresh Graduate, Software Engineer, Office Admin, Govt/Teaching) or edit every section directly.",
        "3. Pick from 4 clean templates, customize accent colors & typography, and optionally attach or capture a circular/portrait headshot.",
        "4. Export an exact A4 300 PPI PDF, JPG, or PNG ready for job portals or print shops.",
      ].join("\n"),
      actions: [
        { id: "open_resume", label: "Open Resume Maker" },
        { id: "open_passport", label: "Passport Photo Studio" },
      ],
      followUps: [
        "How do I remove pimples and brighten skin?",
        "How do I convert photos to PDF?",
      ],
    }),
  },
  {
    id: "camera_filters_controls",
    phrases: [
      "image filter",
      "photo filter",
      "take photo",
      "use camera",
      "undo redo",
      "zoom rotate",
      "scroll photo",
    ],
    keywords: [
      "camera",
      "webcam",
      "selfie",
      "zoom",
      "rotate",
      "straighten",
      "brightness",
      "contrast",
      "filter",
      "filters",
      "grayscale",
      "sepia",
      "warm",
      "cool",
      "undo",
      "redo",
      "crop",
      "pan",
      "drag",
    ],
    build: () => ({
      text: [
        "Camera, Studio Filters, Pinned Cropper & Undo/Redo:",
        "• Camera Capture: Click Camera in the Passport Studio or ID Xerox workspace to shoot directly with your phone or webcam.",
        "• Pinned Photo Stage: Your selected portrait stays locked at the top of the left workbench while sliders, filters, and right-side steps scroll independently.",
        "• Fine-Tune & Filters: Adjust Zoom, Straighten/Rotate, Brightness, Contrast, plus 6 studio filters (Original, Grayscale, Sepia, High Contrast, Warm Tone, Cool Studio) — all baked into the 300 PPI output.",
        "• Undo / Redo: Use the toolbar buttons or Ctrl+Z / Ctrl+Y anytime.",
      ].join("\n"),
      actions: [
        { id: "open_passport", label: "Open Passport Studio" },
        { id: "open_enhance", label: "Open AI Photo Enhance" },
      ],
      followUps: [
        "How do I upscale to HD/4K or unblur a photo?",
        "Check my current studio settings",
      ],
    }),
  },
  {
    id: "privacy_no_api_key",
    phrases: [
      "api key",
      "no api",
      "without api",
      "gemini key",
      "is it free",
      "offline mode",
      "safe to upload",
      "data privacy",
    ],
    keywords: [
      "api",
      "apikey",
      "gemini",
      "offline",
      "privacy",
      "private",
      "safe",
      "secure",
      "security",
      "server",
      "cloud",
      "free",
      "store",
      "stored",
    ],
    build: () => ({
      text: [
        "100% Private & Zero-API-Key Architecture:",
        "• No API key needed: This Studio Guide, AI Photo Enhance Studio (ESRGAN HD/4K upscaling, deblurring, neural BG removal, face retouch, colour correction), 300 PPI Passport Sheets, Aadhaar/PAN Xerox, PDF/XML Converters, and Resume Maker all run directly on your device.",
        "• Your photos & ID cards never leave your browser — nothing is uploaded or stored on third-party servers.",
        "• Works smoothly on desktop and mobile even without cloud AI keys configured.",
      ].join("\n"),
      actions: [
        { id: "open_passport", label: "Open Passport Studio" },
        { id: "open_mail_desk", label: "Mail Print Desk" },
      ],
      followUps: [
        "Check my current studio settings",
        "How do I contact the print desk for bulk printing?",
      ],
    }),
  },
  {
    id: "commercial_print_contact",
    phrases: [
      "print desk",
      "mail print",
      "contact support",
      "phone number",
      "whatsapp number",
      "bulk print",
      "visiting card",
      "wedding card",
      "custom order",
      "get quote",
    ],
    keywords: [
      "order",
      "orders",
      "price",
      "pricing",
      "cost",
      "rate",
      "rates",
      "quote",
      "quotation",
      "bulk",
      "commercial",
      "wedding",
      "banner",
      "brochure",
      "flyer",
      "visiting",
      "contact",
      "support",
      "email",
      "mail",
      "phone",
      "call",
      "whatsapp",
      "number",
      "shop",
      "delivery",
    ],
    weight: 2,
    build: (s, rawQuestion) => ({
      text: [
        `${BRAND_NAME} Commercial Print Desk & Support (Email Only):`,
        "• We handle custom print orders, bulk passport sheets, visiting cards, brochures, wedding cards, banners, and support strictly via official email.",
        `• Official Print Desk Email: ${s.supportEmail}`,
        "• Tap Mail Print Desk below to open a prefilled inquiry with your current studio specs ready to send.",
      ].join("\n"),
      actions: [
        {
          id: "open_mail_desk",
          label: "Mail Print Desk",
          mailSubject: `${BRAND_NAME} — Print Desk Inquiry`,
          mailBody: `Hello ${BRAND_NAME},\n\nQuestion / Print Request:\n${rawQuestion}\n\nCurrent Studio Setup: ${s.presetLabel} · ${s.paperLabel} (${s.sheetCount} photos, ${s.gapMm} mm gap).\n\nPlease share details and next steps.`,
        },
      ],
      followUps: [
        "Check my current studio settings",
        "Which size fits Passport Seva or SSC forms?",
      ],
    }),
  },
  {
    id: "greeting_overview",
    phrases: [
      "what can you do",
      "how to use",
      "about this app",
      "all features",
      "sun nova",
      "sun-nova",
    ],
    keywords: [
      "hi",
      "hello",
      "hey",
      "namaste",
      "help",
      "guide",
      "features",
      "feature",
      "menu",
      "about",
      "start",
      "overview",
      "tools",
    ],
    build: (s) => ({
      text: [
        `Welcome to ${BRAND_NAME}! I am your built-in app guide (zero API key needed). I can walk you through all 5 studio workspaces:`,
        "1. Passport Photo Studio — 300 PPI exam/visa presets, AI Remove BG, Student/Officer outfits, cut outlines, Name & DOP strip, KB compression, and A4 Multi-Photo sheets.",
        "2. AI Photo Enhance Studio — Open-source ESRGAN HD/4K upscaling, blur removal & sharpening, neural background removal, natural face retouching, colour/lighting correction, Before/After slider, and 300 PPI print export.",
        "3. Aadhaar / PAN / ID Xerox — Front & Back Up-Down, Side-by-Side, or 2×2 CR80 layouts.",
        "4. PDF, XML & Text Converters — Photo↔PDF, Text→Image, Image→Text OCR, and XML↔JSON/CSV.",
        "5. Resume Maker — 4 templates, role presets, photo crop, and 300 PPI A4 export.",
        "",
        `You are currently in: ${WORKSPACE_NAMES[s.workspaceMode]}. Tap a shortcut below or ask any question!`,
      ].join("\n"),
      actions: [
        { id: "open_passport", label: "Passport Studio" },
        { id: "open_enhance", label: "AI Photo Enhance" },
        { id: "open_xerox", label: "ID Card Xerox" },
        { id: "open_converters", label: "PDF & XML Tools" },
        { id: "open_resume", label: "Resume Maker" },
      ],
      followUps: [
        "Which size fits Passport Seva or SSC forms?",
        "How do I upscale to HD/4K or unblur a photo?",
        "Check my current studio settings",
      ],
    }),
  },
];

export function generateStudioAssistantReply(
  question: string,
  snapshot: StudioLiveSnapshot
): AssistantReply {
  const normalized = normalizeQuery(question);
  if (!normalized) {
    return TOPIC_RULES[TOPIC_RULES.length - 1].build(snapshot, question);
  }

  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));

  let bestRule: TopicRule | null = null;
  let bestScore = 0;

  for (const rule of TOPIC_RULES) {
    let score = 0;
    const multiplier = rule.weight ?? 1;

    for (const phrase of rule.phrases) {
      if (normalized.includes(phrase)) {
        score += 6 * multiplier;
      }
    }

    for (const kw of rule.keywords) {
      if (tokens.has(kw)) {
        score += 2.5 * multiplier;
      } else if (kw.length >= 4 && normalized.includes(kw)) {
        score += 1.4 * multiplier;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (bestRule && bestScore >= 2.5) {
    return bestRule.build(snapshot, question.trim());
  }

  return {
    text: [
      `I am the built-in ${BRAND_NAME} App Guide (works offline with zero API key), so I specialize strictly in tools inside this app:`,
      "• Passport & Exam Photo Sizes (Passport Seva, SSC, UPSC, US Visa, PAN, Custom 300 PPI)",
      "• A4 1-Line (6 Different Photos), Print Sheets, Photo Gaps & Cut Outlines",
      "• AI Photo Enhance Studio (HD/4K ESRGAN Upscaling, Deblur, Neural BG Removal, Face Retouch, Colour Correction)",
      "• Name & DOP Strips and < 20 / 50 / 100 / 200 KB Portal Compression",
      "• Aadhaar / PAN / ID Card Xerox, PDF/XML/OCR Converters, and Resume Maker",
      "",
      "Need help with a custom print order or question outside these tools? Use Mail Print Desk below.",
    ].join("\n"),
    actions: [
      { id: "open_enhance", label: "AI Photo Enhance" },
      { id: "open_passport", label: "Passport Studio" },
      {
        id: "open_mail_desk",
        label: "Mail Print Desk",
        mailSubject: `${BRAND_NAME} — Support Question`,
        mailBody: `Hello ${BRAND_NAME},\n\nI have a question:\n${question.trim()}\n\nPlease assist me via email.`,
      },
    ],
    followUps: [
      "Check my current studio settings",
      "How do I upscale to HD/4K or unblur a photo?",
      "Which size fits Passport Seva or SSC forms?",
    ],
  };
}
