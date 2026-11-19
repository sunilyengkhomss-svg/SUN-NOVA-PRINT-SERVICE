import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  ArrowLeftRight,
  Briefcase,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Grid,
  Image as ImageIcon,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Shirt,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import samplePortraitImg from "./assets/images/sample_portrait_1794641002441.jpg";
import { CameraCaptureModal } from "./components/CameraCaptureModal";
import { Header } from "./components/Header";
import { HeroShowcase } from "./components/HeroShowcase";
import { LandingSections } from "./components/LandingSections";
import { MailQueryModal } from "./components/MailQueryModal";
import {
  LowerBannerShowcase,
  NativeAdBanner,
  ResponsiveHorizontalBanner,
  SocialBarAd,
} from "./components/NativeAdBanner";
import { AiSkinBeautyModal } from "./components/AiSkinBeautyModal";
import { SheetPreviewCanvas } from "./components/SheetPreviewCanvas";
import { StudioAiAgent } from "./components/StudioAiAgent";
import { StudioSections } from "./components/StudioSections";
import type {
  StudioAssistantAction,
  StudioLiveSnapshot,
} from "./utils/studioAssistantEngine";

const IdCardXeroxStudio = lazy(() =>
  import("./components/IdCardXeroxStudio").then((m) => ({
    default: m.IdCardXeroxStudio,
  }))
);
const DocumentConverterStudio = lazy(() =>
  import("./components/DocumentConverterStudio").then((m) => ({
    default: m.DocumentConverterStudio,
  }))
);
const ResumeMakerStudio = lazy(() =>
  import("./components/ResumeMakerStudio").then((m) => ({
    default: m.ResumeMakerStudio,
  }))
);
const AdminPortal = lazy(() =>
  import("./components/admin/AdminPortal").then((m) => ({
    default: m.AdminPortal,
  }))
);
import {
  OutfitCategory,
  PublicBootstrapPayload,
} from "./types/cms";
import { fetchPublicBootstrap } from "./utils/adminApi";
import {
  AiSkinBeautyOptions,
  BG_COLORS,
  BORDER_COLOR_PRESETS,
  BRAND_ICON_URL,
  BRAND_NAME,
  OFFICIAL_SITE_URL,
  OFFICIAL_SUPPORT_EMAIL,
  DEFAULT_AI_SKIN_BEAUTY_OPTIONS,
  DEFAULT_SUPPORT_EMAIL,
  DRESS_PRESETS,
  DressStyleId,
  GAP_OPTIONS_MM,
  IMAGE_FILTER_PRESETS,
  ImageFilterKey,
  OUTLINE_STYLES,
  OutlineStyle,
  PAPER_SIZES,
  PaperKey,
  PHOTO_PRESETS,
  PresetKey,
  PRINT_PPI,
  SheetOrientation,
  SheetQueueItem,
  STUDIO_ACCENTS,
  StudioAccentKey,
} from "./types/photo";
import { buildDressDataUrl } from "./utils/dressTemplates";
import {
  autoCropImageToDataUrl,
  buildCanvasFilterString,
  calculateSheetLayout,
  exportCanvasWithTargetKB,
  loadHtmlImage,
  mmToPixels300Ppi,
  renderSheetCanvas,
  renderSinglePhotoCanvas,
  setJpegPpi,
  triggerBlobDownload,
} from "./utils/imageProcessing";
import { processOnDeviceAiSkinBeauty } from "./utils/skinRetouch";
import { useTouchScrollIsolation } from "./utils/useTouchScrollIsolation";
import { useUndoRedo } from "./utils/useUndoRedo";

type StudioTab = "crop" | "sheet";
type WorkspaceMode = "passport" | "xerox" | "converters" | "resume";
type CountMode = "max" | "line1" | "line2" | "custom";
type ExtendedDressCategory = "All" | OutfitCategory;

interface PassportStudioState {
  originalSrc: string | null;
  originalFile: Blob | null;
  imageSrc: string | null;
  bgRemoved: boolean;
  presetKey: PresetKey;
  customWInch: number;
  customHInch: number;
  paperKey: PaperKey;
  sheetOrientation: SheetOrientation;
  countMode: CountMode;
  customPhotoCount: number;
  gapMm: number;
  borderWidthPx: number;
  borderColor: string;
  outlineStyle: OutlineStyle;
  outlineOffsetPx: number;
  applyBorderToSingle: boolean;
  dressCategory: ExtendedDressCategory;
  dressId: string;
  dressScale: number;
  dressOffsetX: number;
  dressOffsetY: number;
  sheetQueue: SheetQueueItem[];
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  brightness: number;
  contrast: number;
  imageFilter: ImageFilterKey;
  aiBeautyApplied: boolean;
  preBeautySrc: string | null;
  aiBeautyFile: Blob | null;
  showHeadGuide: boolean;
  bgColor: string;
  bgImageUrl: string | null;
  nameText: string;
  dateText: string;
  targetKB: number;
}

const INITIAL_PASSPORT_STUDIO_STATE: PassportStudioState = {
  originalSrc: null,
  originalFile: null,
  imageSrc: null,
  bgRemoved: false,
  presetKey: "inch_1_2x1_5",
  customWInch: 1.2,
  customHInch: 1.5,
  paperKey: "a4",
  sheetOrientation: "auto",
  countMode: "max",
  customPhotoCount: 6,
  gapMm: 3,
  borderWidthPx: 2,
  borderColor: "#CBD5E1",
  outlineStyle: "solid",
  outlineOffsetPx: 0,
  applyBorderToSingle: false,
  dressCategory: "All",
  dressId: "none",
  dressScale: 1,
  dressOffsetX: 0,
  dressOffsetY: 0,
  sheetQueue: [],
  crop: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  brightness: 100,
  contrast: 100,
  imageFilter: "none",
  aiBeautyApplied: false,
  preBeautySrc: null,
  aiBeautyFile: null,
  showHeadGuide: true,
  bgColor: "#FFFFFF",
  bgImageUrl: null,
  nameText: "",
  dateText: "",
  targetKB: 0,
};

export default function App() {
  // Admin Route vs Public Website
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/admin");
  });

  useEffect(() => {
    const onPopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith("/admin"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToAdmin = useCallback(() => {
    if (window.location.pathname !== "/admin") {
      window.history.pushState({}, "", "/admin");
    }
    setIsAdminRoute(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navigateToHome = useCallback(() => {
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }
    setIsAdminRoute(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Backend CMS Bootstrap Hydration
  const [cmsData, setCmsData] = useState<PublicBootstrapPayload | null>(null);

  const refreshPublicData = useCallback(async () => {
    try {
      const data = await fetchPublicBootstrap();
      setCmsData(data);
    } catch {
      // Public UI keeps full built-in fallbacks if offline/static preview
    }
  }, []);

  useEffect(() => {
    refreshPublicData();
  }, [refreshPublicData]);

  // Workspace Mode (Passport Photos vs Aadhaar/PAN/ID Xerox)
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("passport");

  // Undoable Passport Photo Studio State
  const {
    state: studio,
    setState: setStudio,
    undo: undoStudio,
    redo: redoStudio,
    canUndo: canUndoStudio,
    canRedo: canRedoStudio,
    undoCount: studioUndoCount,
    redoCount: studioRedoCount,
  } = useUndoRedo<PassportStudioState>(INITIAL_PASSPORT_STUDIO_STATE, 60);

  const {
    originalSrc,
    originalFile,
    imageSrc,
    bgRemoved,
    presetKey,
    customWInch,
    customHInch,
    paperKey,
    sheetOrientation,
    countMode,
    customPhotoCount,
    gapMm,
    borderWidthPx,
    borderColor,
    outlineStyle,
    outlineOffsetPx,
    applyBorderToSingle,
    dressCategory,
    dressId,
    dressScale,
    dressOffsetX,
    dressOffsetY,
    sheetQueue,
    crop,
    zoom,
    rotation,
    brightness,
    contrast,
    imageFilter,
    aiBeautyApplied,
    preBeautySrc,
    aiBeautyFile,
    showHeadGuide,
    bgColor,
    bgImageUrl,
    nameText,
    dateText,
    targetKB,
  } = studio;

  const patchStudio = useCallback(
    (
      patch:
        | Partial<PassportStudioState>
        | ((prev: PassportStudioState) => Partial<PassportStudioState>),
      coalesceKey?: string
    ) => {
      setStudio(
        (prev) => ({
          ...prev,
          ...(typeof patch === "function" ? patch(prev) : patch),
        }),
        coalesceKey ? { coalesceKey } : undefined
      );
    },
    [setStudio]
  );

  const setPresetKey = (v: PresetKey) => patchStudio({ presetKey: v });
  const setCustomWInch = (v: number) =>
    patchStudio({ customWInch: v }, "custom-w");
  const setCustomHInch = (v: number) =>
    patchStudio({ customHInch: v }, "custom-h");
  const setPaperKey = (v: PaperKey) => patchStudio({ paperKey: v });
  const setSheetOrientation = (v: SheetOrientation) =>
    patchStudio({ sheetOrientation: v });
  const setCountMode = (v: CountMode) => patchStudio({ countMode: v });
  const setCustomPhotoCount = (v: number) =>
    patchStudio({ customPhotoCount: v }, "custom-count");
  const setGapMm = (v: number) => patchStudio({ gapMm: v });
  const setBorderWidthPx = (v: number) =>
    patchStudio({ borderWidthPx: v }, "border-width");
  const setBorderColor = (v: string) =>
    patchStudio({ borderColor: v }, "border-color");
  const setOutlineStyle = (v: OutlineStyle) => patchStudio({ outlineStyle: v });
  const setOutlineOffsetPx = (v: number) =>
    patchStudio({ outlineOffsetPx: v }, "outline-offset");
  const setApplyBorderToSingle = (v: boolean) =>
    patchStudio({ applyBorderToSingle: v });
  const setDressCategory = (v: ExtendedDressCategory) =>
    patchStudio({ dressCategory: v });
  const setDressId = (v: string) => patchStudio({ dressId: v });
  const setDressScale = (v: number) =>
    patchStudio({ dressScale: v }, "dress-scale");
  const setDressOffsetX = (v: number) =>
    patchStudio({ dressOffsetX: v }, "dress-x");
  const setDressOffsetY = (v: number) =>
    patchStudio({ dressOffsetY: v }, "dress-y");
  const setSheetQueue = (updater: React.SetStateAction<SheetQueueItem[]>) =>
    patchStudio((prev) => ({
      sheetQueue:
        typeof updater === "function" ? updater(prev.sheetQueue) : updater,
    }));
  const setCrop = (v: { x: number; y: number }) =>
    patchStudio({ crop: v }, "crop-pan");
  const setZoom = (v: number) => patchStudio({ zoom: v }, "crop-zoom");
  const setRotation = (v: number) =>
    patchStudio({ rotation: v }, "crop-rotation");
  const setBrightness = (v: number) =>
    patchStudio({ brightness: v }, "crop-brightness");
  const setContrast = (v: number) =>
    patchStudio({ contrast: v }, "crop-contrast");
  const setImageFilter = (v: ImageFilterKey) =>
    patchStudio({ imageFilter: v });
  const setShowHeadGuide = (updater: React.SetStateAction<boolean>) =>
    patchStudio((prev) => ({
      showHeadGuide:
        typeof updater === "function" ? updater(prev.showHeadGuide) : updater,
    }));
  const setBgColor = (v: string) =>
    patchStudio({ bgColor: v, bgImageUrl: null }, "bg-color");
  const setBgPreset = (hexColor: string, imageUrl: string | null) =>
    patchStudio({ bgColor: hexColor, bgImageUrl: imageUrl }, "bg-color");
  const setNameText = (v: string) => patchStudio({ nameText: v }, "name-text");
  const setDateText = (v: string) => patchStudio({ dateText: v }, "date-text");
  const setTargetKB = (v: number) => patchStudio({ targetKB: v });

  // Camera Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Studio Tab (Crop vs Live Sheet Preview)
  const [activeTab, setActiveTab] = useState<StudioTab>("crop");
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);

  // Cropper container size tracking for exact dress overlay alignment
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const [cropContainerSize, setCropContainerSize] = useState({
    width: 0,
    height: 0,
  });

  // Multi-Photo Queue UI State
  const [copiesToAdd, setCopiesToAdd] = useState<number>(1);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);

  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState<Area | null>(null);

  // AI Skin Beauty Modal & Hold-to-Compare State (Zero-API-Key On-Device)
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const [aiBeautyOptions, setAiBeautyOptions] = useState<AiSkinBeautyOptions>(
    DEFAULT_AI_SKIN_BEAUTY_OPTIONS
  );
  const [isAiBeautyModalOpen, setIsAiBeautyModalOpen] = useState(false);
  const [isApplyingAiBeauty, setIsApplyingAiBeauty] = useState(false);
  const [aiBeautyStatusText, setAiBeautyStatusText] = useState("");

  // Async Status & Feedback
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgStatusText, setBgStatusText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Keyboard Undo / Redo for Passport Photo Studio
  useEffect(() => {
    if (workspaceMode !== "passport") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextControl =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTextControl) return;

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (canUndoStudio) {
          e.preventDefault();
          undoStudio();
        }
      } else if (
        e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        if (canRedoStudio) {
          e.preventDefault();
          redoStudio();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    workspaceMode,
    canUndoStudio,
    canRedoStudio,
    undoStudio,
    redoStudio,
  ]);

  // Mail Desk Email (no phone numbers shown)
  const [supportEmail, setSupportEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("sunnova_support_email");
      if (!saved || saved.toLowerCase().includes("sunilyengkhomss")) {
        localStorage.setItem("sunnova_support_email", DEFAULT_SUPPORT_EMAIL);
        return DEFAULT_SUPPORT_EMAIL;
      }
      return saved;
    } catch {
      return DEFAULT_SUPPORT_EMAIL;
    }
  });

  useEffect(() => {
    const cmsEmail = cmsData?.settings?.contactEmail?.trim();
    if (
      cmsEmail &&
      !cmsEmail.toLowerCase().includes("sunilyengkhomss") &&
      supportEmail === DEFAULT_SUPPORT_EMAIL
    ) {
      setSupportEmail(cmsEmail);
    }
  }, [cmsData?.settings?.contactEmail, supportEmail]);

  const handleSupportEmailChange = (email: string) => {
    setSupportEmail(email);
    try {
      localStorage.setItem("sunnova_support_email", email);
    } catch {
      // Ignore storage failures in restricted frames
    }
  };

  // Studio Accent Theme Customization
  const [studioAccent, setStudioAccent] = useState<StudioAccentKey>(() => {
    try {
      const saved = localStorage.getItem("sunnova_accent") as StudioAccentKey;
      return saved && saved in STUDIO_ACCENTS ? saved : "amber";
    } catch {
      return "amber";
    }
  });

  const handleStudioAccentChange = (accent: StudioAccentKey) => {
    setStudioAccent(accent);
    try {
      localStorage.setItem("sunnova_accent", accent);
    } catch {
      // Ignore storage failures in restricted frames
    }
  };

  // Ask AI Chat Agent & Mail Query Modal State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [mailModalState, setMailModalState] = useState<{
    isOpen: boolean;
    subject: string;
    body: string;
  }>({ isOpen: false, subject: "", body: "" });

  // Side-by-Side Next-by-Next Control Panel Navigation
  type ControlStepId = "size" | "bg" | "dress" | "name" | "export";
  const STUDIO_CONTROL_STEPS: ReadonlyArray<{
    id: ControlStepId;
    label: string;
  }> = [
    { id: "size", label: "01–02 Size" },
    { id: "bg", label: "03 BG & Cut" },
    { id: "dress", label: "03b Outfit" },
    { id: "name", label: "04–05 Info" },
    { id: "export", label: "Export" },
  ];
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const [activeControlStep, setActiveControlStep] =
    useState<ControlStepId>("size");

  // Isolate mobile touch gestures strictly within both Left and Right studio panels
  const isPassportWorkbenchMounted = !isAdminRoute && workspaceMode === "passport";
  useTouchScrollIsolation(leftColumnRef, {
    enabled: isPassportWorkbenchMounted,
    allowInnerScroll: true,
  });
  useTouchScrollIsolation(rightPanelRef, {
    enabled: isPassportWorkbenchMounted,
    allowInnerScroll: true,
  });

  const scrollToControlStep = (stepId: ControlStepId) => {
    setActiveControlStep(stepId);
    const panel = rightPanelRef.current;
    const target = document.getElementById(`studio-step-${stepId}`);
    if (!target) return;
    if (panel && panel.scrollHeight > panel.clientHeight + 8) {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const topOffset = panel.scrollTop + (targetRect.top - panelRect.top) - 56;
      panel.scrollTo({ top: Math.max(0, topOffset), behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const stepControlIndex = STUDIO_CONTROL_STEPS.findIndex(
    (s) => s.id === activeControlStep
  );

  const handleRightPanelScroll = () => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    let closest: ControlStepId = "size";
    let smallestDist = Infinity;
    for (const step of STUDIO_CONTROL_STEPS) {
      const el = document.getElementById(`studio-step-${step.id}`);
      if (!el) continue;
      const dist = Math.abs(el.getBoundingClientRect().top - panelRect.top - 58);
      if (dist < smallestDist) {
        smallestDist = dist;
        closest = step.id;
      }
    }
    setActiveControlStep(closest);
  };

  // Saved ZeroZeros Portal URL
  const [zeroZerosUrl, setZeroZerosUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("sunnova_zerozeros_url") || "";
    } catch {
      return "";
    }
  });

  const handleZeroZerosUrlChange = (url: string) => {
    setZeroZerosUrl(url);
    try {
      localStorage.setItem("sunnova_zerozeros_url", url);
    } catch {
      // Ignore storage failures in restricted frames
    }
  };

  // Resolved Active Dimensions at 300 PPI
  const activeDims = useMemo(() => {
    const base = PHOTO_PRESETS[presetKey];
    if (presetKey === "custom_inch") {
      const safeW = Math.min(6, Math.max(0.5, Number(customWInch) || 1.2));
      const safeH = Math.min(8, Math.max(0.5, Number(customHInch) || 1.5));
      const wPx = Math.round(safeW * PRINT_PPI);
      const hPx = Math.round(safeH * PRINT_PPI);
      return {
        label: `${safeW} × ${safeH} inch (300 PPI)`,
        w: wPx,
        h: hPx,
        printW: wPx,
        printH: hPx,
        aspect: safeW / safeH,
      };
    }
    return {
      label: base.label,
      w: base.w,
      h: base.h,
      printW: base.printW,
      printH: base.printH,
      aspect: base.aspect,
    };
  }, [presetKey, customWInch, customHInch]);

  const paper = PAPER_SIZES[paperKey];
  const gapPx = mmToPixels300Ppi(gapMm);

  // Base full-sheet layout (gives cols, rows, maxCount)
  const baseLayout = useMemo(
    () =>
      calculateSheetLayout(
        paper.w,
        paper.h,
        activeDims.printW,
        activeDims.printH,
        gapPx,
        sheetOrientation,
        null
      ),
    [
      paper.w,
      paper.h,
      activeDims.printW,
      activeDims.printH,
      gapPx,
      sheetOrientation,
    ]
  );

  // Total copies in Multi-Photo Queue
  const totalQueuedCopies = useMemo(
    () => sheetQueue.reduce((sum, item) => sum + Math.max(1, item.copies), 0),
    [sheetQueue]
  );

  // Effective requested photo count for the sheet
  const requestedCount = useMemo(() => {
    if (sheetQueue.length > 0) {
      return Math.min(baseLayout.maxCount, totalQueuedCopies);
    }
    if (countMode === "line1") return baseLayout.cols;
    if (countMode === "line2") {
      return Math.min(baseLayout.maxCount, baseLayout.cols * 2);
    }
    if (countMode === "custom") {
      return Math.min(
        baseLayout.maxCount,
        Math.max(1, Math.round(customPhotoCount) || 1)
      );
    }
    return baseLayout.maxCount;
  }, [
    sheetQueue.length,
    totalQueuedCopies,
    countMode,
    customPhotoCount,
    baseLayout.cols,
    baseLayout.maxCount,
  ]);

  // Active sheet layout reflecting custom count or multi-photo queue
  const sheetLayout = useMemo(
    () =>
      calculateSheetLayout(
        paper.w,
        paper.h,
        activeDims.printW,
        activeDims.printH,
        gapPx,
        sheetOrientation,
        requestedCount
      ),
    [
      paper.w,
      paper.h,
      activeDims.printW,
      activeDims.printH,
      gapPx,
      sheetOrientation,
      requestedCount,
    ]
  );

  // Load File Helper
  const loadImageBlob = useCallback(
    (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      patchStudio({
        originalFile: blob,
        originalSrc: url,
        imageSrc: url,
        bgRemoved: false,
        aiBeautyApplied: false,
        preBeautySrc: null,
        aiBeautyFile: null,
        zoom: 1,
        rotation: 0,
        brightness: 100,
        contrast: 100,
        imageFilter: "none",
        crop: { x: 0, y: 0 },
      });
      setIsComparingOriginal(false);
      setErrorMessage(null);
      setExportMessage(null);
      setActiveTab("crop");
    },
    [patchStudio]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadImageBlob(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      loadImageBlob(file);
    } else if (file) {
      setErrorMessage("Please drop a valid JPG, PNG, or WEBP image file.");
    }
  };

  const publishedSamplePortraits = useMemo(() => {
    const list = (cmsData?.portraits || []).filter((p) => p.is_published !== 0);
    if (list.length > 0) return list;
    return [
      {
        id: "builtin-sample-1",
        title: "Studio Sample Portrait",
        media_id: null,
        image_url: samplePortraitImg,
        display_order: 1,
        is_published: 1,
        created_at: "",
        updated_at: "",
      },
    ];
  }, [cmsData?.portraits]);

  const handleLoadSample = async (customUrl?: string) => {
    const targetUrl =
      customUrl || publishedSamplePortraits[0]?.image_url || samplePortraitImg;
    try {
      setErrorMessage(null);
      try {
        const response = await fetch(targetUrl);
        if (response.ok) {
          const blob = await response.blob();
          loadImageBlob(blob);
          return;
        }
      } catch {
        // Fallback to image element conversion below
      }
      const img = await loadHtmlImage(targetUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Blob conversion failed"))),
          "image/jpeg",
          0.95
        )
      );
      loadImageBlob(blob);
    } catch {
      setErrorMessage("Could not load sample portrait.");
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPercent(croppedArea);
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // Resolve active outfit list (CMS D1 published outfits merged with Original None)
  const resolvedOutfits = useMemo(() => {
    const cmsList = (cmsData?.outfits || []).filter((o) => o.is_published !== 0);
    if (cmsList.length > 0) {
      const items = cmsList.map((o) => ({
        id: o.builtin_style_id || o.id,
        label: o.name,
        category: o.category as OutfitCategory,
        customUrl: o.image_url || null,
        builtinStyleId: o.builtin_style_id as DressStyleId | null,
      }));
      return [
        {
          id: "none",
          label: "Original Outfit",
          category: "None" as const,
          customUrl: null,
          builtinStyleId: "none" as DressStyleId,
        },
        ...items,
      ];
    }
    return DRESS_PRESETS.map((d) => ({
      id: d.id,
      label: d.label,
      category: d.category,
      customUrl: null as string | null,
      builtinStyleId: d.id as DressStyleId,
    }));
  }, [cmsData?.outfits]);

  const activeOutfitCustomUrl = useMemo(() => {
    if (dressId === "none") return null;
    const found = resolvedOutfits.find((o) => o.id === dressId);
    return found?.customUrl || null;
  }, [dressId, resolvedOutfits]);

  const dressPreviewUrl = useMemo(() => {
    if (dressId === "none") return null;
    if (activeOutfitCustomUrl) return activeOutfitCustomUrl;
    return buildDressDataUrl(dressId as DressStyleId);
  }, [dressId, activeOutfitCustomUrl]);

  useEffect(() => {
    const el = cropContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const updateSize = () => {
      setCropContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageSrc, activeTab, workspaceMode]);

  const cropBoxSize = useMemo(() => {
    const { width: cw, height: ch } = cropContainerSize;
    if (!cw || !ch) return undefined;
    const pad = 20;
    const maxW = Math.max(120, cw - pad);
    const maxH = Math.max(120, ch - pad);
    const aspect = activeDims.aspect;
    if (maxW / maxH > aspect) {
      const h = maxH;
      return { width: Math.round(h * aspect), height: Math.round(h) };
    }
    const w = maxW;
    return { width: Math.round(w), height: Math.round(w / aspect) };
  }, [cropContainerSize, activeDims.aspect]);

  // Update live single-photo preview URL whenever user switches to Print Sheet Preview
  useEffect(() => {
    if (
      activeTab !== "sheet" ||
      sheetQueue.length > 0 ||
      !imageSrc ||
      !croppedAreaPixels
    ) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const canvas = await renderSinglePhotoCanvas({
          imageSrc,
          croppedAreaPixels,
          croppedAreaPercent,
          outW: activeDims.printW,
          outH: activeDims.printH,
          bgColor,
          bgImageUrl,
          rotation,
          brightness,
          contrast,
          imageFilter,
          nameText,
          dateText,
          dressId,
          dressCustomUrl: activeOutfitCustomUrl,
          dressScale,
          dressOffsetX,
          dressOffsetY,
        });
        if (!cancelled) {
          setSinglePreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
        }
      } catch {
        // Ignore transient preview errors while adjusting sliders
      }
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeTab,
    sheetQueue.length,
    imageSrc,
    croppedAreaPixels,
    croppedAreaPercent,
    activeDims.printW,
    activeDims.printH,
    bgColor,
    bgImageUrl,
    rotation,
    brightness,
    contrast,
    imageFilter,
    nameText,
    dateText,
    dressId,
    activeOutfitCustomUrl,
    dressScale,
    dressOffsetX,
    dressOffsetY,
  ]);

  // Activate A4 1-Line (6 Different Photos) preset workflow
  const handleActivateA4SixDifferent = () => {
    patchStudio({
      presetKey: "inch_1_2x1_5",
      paperKey: "a4",
      sheetOrientation: "portrait",
    });
    setCopiesToAdd(1);
    setErrorMessage(null);
    setExportMessage(
      "A4 1-Line (6 Different Photos) ready: select up to 6 different photos at once or add each with 1 copy."
    );
  };

  // Bulk upload multiple different photos at once (auto-crops each into a 1-copy slot)
  const handleBulkUploadMultiple = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    e.target.value = "";
    if (imageFiles.length === 0) {
      setErrorMessage("Please select valid JPG, PNG, or WEBP image files.");
      return;
    }

    try {
      setIsBulkUploading(true);
      setErrorMessage(null);
      const startIndex = sheetQueue.length;
      const newItems: SheetQueueItem[] = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const { dataUrl, sourceUrl } = await autoCropImageToDataUrl(
          file,
          activeDims.printW,
          activeDims.printH,
          bgColor
        );
        const rawName = file.name.replace(/\.[^/.]+$/, "").trim();
        const label = rawName
          ? rawName.slice(0, 24)
          : `Photo ${startIndex + i + 1}`;
        newItems.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          label,
          dataUrl,
          copies: 1,
          sourceUrl,
          sourceFile: file,
        });
      }

      setSheetQueue((prev) => [...prev, ...newItems]);
      setActiveTab("sheet");
      setExportMessage(
        `Added ${newItems.length} different photos (1 copy each) to the sheet. Click Edit on any slot to adjust crop.`
      );
    } catch {
      setErrorMessage("Could not process one or more selected photos.");
    } finally {
      setIsBulkUploading(false);
    }
  };

  // Add or update current cropped & retouched photo in Multi-Photo Sheet Queue
  const handleAddToQueue = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      setErrorMessage("Upload and position a photo before adding to queue.");
      return;
    }
    try {
      setErrorMessage(null);
      const canvas = await renderSinglePhotoCanvas({
        imageSrc,
        croppedAreaPixels,
        croppedAreaPercent,
        outW: activeDims.printW,
        outH: activeDims.printH,
        bgColor,
        bgImageUrl,
        rotation,
        brightness,
        contrast,
        imageFilter,
        nameText,
        dateText,
        dressId,
        dressCustomUrl: activeOutfitCustomUrl,
        dressScale,
        dressOffsetX,
        dressOffsetY,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const cleanCopies = Math.max(1, Math.round(copiesToAdd) || 1);

      if (editingQueueId) {
        setSheetQueue((prev) =>
          prev.map((item) =>
            item.id === editingQueueId
              ? {
                  ...item,
                  label: nameText.trim() ? nameText.trim() : item.label,
                  dataUrl,
                  copies: cleanCopies,
                  sourceUrl: originalSrc || imageSrc,
                  sourceFile: originalFile || item.sourceFile,
                }
              : item
          )
        );
        setEditingQueueId(null);
        setActiveTab("sheet");
        setExportMessage("Updated photo in Multi-Photo Sheet Queue.");
        return;
      }

      const label = nameText.trim()
        ? nameText.trim()
        : `Photo ${sheetQueue.length + 1}`;

      setSheetQueue((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label,
          dataUrl,
          copies: cleanCopies,
          sourceUrl: originalSrc || imageSrc,
          sourceFile: originalFile || undefined,
        },
      ]);
      setExportMessage(
        `Added "${label}" (${cleanCopies} ${cleanCopies === 1 ? "copy" : "copies"}) to Multi-Photo Sheet Queue.`
      );
    } catch {
      setErrorMessage("Could not add current photo to queue.");
    }
  };

  // Load a queued photo back into the main cropper for manual crop / BG adjustment
  const handleEditQueueItem = (item: SheetQueueItem) => {
    if (!item.sourceUrl) return;
    patchStudio({
      originalSrc: item.sourceUrl,
      originalFile: item.sourceFile || null,
      imageSrc: item.sourceUrl,
      bgRemoved: false,
      aiBeautyApplied: false,
      preBeautySrc: null,
      aiBeautyFile: null,
      zoom: 1,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      imageFilter: "none",
      crop: { x: 0, y: 0 },
    });
    setIsComparingOriginal(false);
    setCopiesToAdd(item.copies);
    setEditingQueueId(item.id);
    setActiveTab("crop");
  };

  const handleUpdateQueueCopies = (id: string, deltaOrValue: number, isAbsolute = false) => {
    setSheetQueue((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = isAbsolute ? deltaOrValue : item.copies + deltaOrValue;
        return { ...item, copies: Math.max(1, Math.min(100, next)) };
      })
    );
  };

  const handleRemoveQueueItem = (id: string) => {
    setSheetQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Client-Side AI Background Removal (preserves AI Skin Beauty if applied first)
  const handleRemoveBackground = async () => {
    const sourceBlob = aiBeautyApplied && aiBeautyFile ? aiBeautyFile : originalFile;
    if (!sourceBlob) return;
    try {
      setErrorMessage(null);
      setIsRemovingBg(true);
      setBgStatusText("Preparing AI model...");
      const { removeBackground } = await import("@imgly/background-removal");

      const transparentBlob = await removeBackground(sourceBlob, {
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(100, Math.round((current / total) * 100));
            setBgStatusText(`Removing background (${pct}%)`);
          }
        },
      });

      const newUrl = URL.createObjectURL(transparentBlob);
      patchStudio({
        imageSrc: newUrl,
        bgRemoved: true,
        preBeautySrc: null,
        aiBeautyFile: aiBeautyApplied ? transparentBlob : null,
      });
      setBgStatusText("");
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Background removal could not complete on this image. You can still crop and export normally."
      );
    } finally {
      setIsRemovingBg(false);
    }
  };

  // Zero-API-Key On-Device AI Skin Beauty & Pimple Removal
  const handleApplyAiSkinBeauty = async (chosenOptions: AiSkinBeautyOptions) => {
    const baseSrc = preBeautySrc || imageSrc;
    if (!baseSrc) return;
    try {
      setAiBeautyOptions(chosenOptions);
      setErrorMessage(null);
      setIsApplyingAiBeauty(true);
      setAiBeautyStatusText("Analyzing skin tone (10%)");

      const img = await loadHtmlImage(baseSrc);
      const retouchedBlob = await processOnDeviceAiSkinBeauty(
        img,
        chosenOptions,
        bgRemoved,
        (_pct, stageLabel) => {
          setAiBeautyStatusText(stageLabel);
        }
      );

      const nextUrl = URL.createObjectURL(retouchedBlob);
      patchStudio({
        imageSrc: nextUrl,
        aiBeautyApplied: true,
        preBeautySrc: baseSrc,
        aiBeautyFile: retouchedBlob,
      });
      setIsComparingOriginal(false);
      setIsAiBeautyModalOpen(false);
      setAiBeautyStatusText("");
      setExportMessage(
        "AI Skin Beauty applied cleanly. Hold Before / After to compare or download at 300 PPI."
      );
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "AI Skin Beauty could not complete on this image. Please try again."
      );
    } finally {
      setIsApplyingAiBeauty(false);
      setAiBeautyStatusText("");
    }
  };

  const handleRestoreOriginal = () => {
    if (!originalSrc) return;
    patchStudio({
      imageSrc: originalSrc,
      bgRemoved: false,
      aiBeautyApplied: false,
      preBeautySrc: null,
      aiBeautyFile: null,
    });
    setIsComparingOriginal(false);
    setErrorMessage(null);
  };

  // Download Single Photo (300 PPI + Optional KB Compression)
  const handleDownloadSingle = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      setErrorMessage("Upload a photo and position your crop first.");
      return;
    }
    try {
      setIsExporting(true);
      setErrorMessage(null);

      const canvas = await renderSinglePhotoCanvas({
        imageSrc,
        croppedAreaPixels,
        croppedAreaPercent,
        outW: activeDims.w,
        outH: activeDims.h,
        bgColor,
        bgImageUrl,
        rotation,
        brightness,
        contrast,
        imageFilter,
        nameText,
        dateText,
        dressId,
        dressCustomUrl: activeOutfitCustomUrl,
        dressScale,
        dressOffsetX,
        dressOffsetY,
        borderWidthPx,
        borderColor,
        outlineStyle,
        outlineOffsetPx,
        applyBorderToSingle,
      });

      const { blob, sizeKB } = await exportCanvasWithTargetKB(canvas, targetKB);
      const filename = `sun-nova-${presetKey}-${activeDims.w}x${activeDims.h}-300ppi.jpg`;
      triggerBlobDownload(blob, filename);
      setExportMessage(
        `Downloaded ${filename} (${sizeKB} KB · ${activeDims.w}×${activeDims.h} px @ 300 PPI)`
      );
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to generate single photo."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Download Print Sheet for ANY Paper Size (Supports Custom Count & Multi-Photo Queue)
  const handleDownloadSheet = async (selectedPaperKey: PaperKey = paperKey) => {
    const usingQueue = sheetQueue.length > 0;
    if (!usingQueue && (!imageSrc || !croppedAreaPixels)) {
      setErrorMessage(
        "Upload a photo or add photos to the Multi-Photo Sheet Queue first."
      );
      return;
    }
    try {
      setIsExporting(true);
      setErrorMessage(null);

      const targetPaper = PAPER_SIZES[selectedPaperKey];
      const targetBaseLayout = calculateSheetLayout(
        targetPaper.w,
        targetPaper.h,
        activeDims.printW,
        activeDims.printH,
        gapPx,
        sheetOrientation,
        null
      );

      let singleCanvas: HTMLCanvasElement | undefined;
      if (!usingQueue && imageSrc && croppedAreaPixels) {
        singleCanvas = await renderSinglePhotoCanvas({
          imageSrc,
          croppedAreaPixels,
          croppedAreaPercent,
          outW: activeDims.printW,
          outH: activeDims.printH,
          bgColor,
          bgImageUrl,
          rotation,
          brightness,
          contrast,
          imageFilter,
          nameText,
          dateText,
          dressId,
          dressCustomUrl: activeOutfitCustomUrl,
          dressScale,
          dressOffsetX,
          dressOffsetY,
        });
      }

      const targetCustomCount = usingQueue
        ? totalQueuedCopies
        : countMode === "line1"
        ? targetBaseLayout.cols
        : countMode === "line2"
        ? Math.min(targetBaseLayout.maxCount, targetBaseLayout.cols * 2)
        : countMode === "custom"
        ? Math.min(targetBaseLayout.maxCount, Math.max(1, customPhotoCount || 1))
        : null;

      const { canvas: sheetCanvas, layout } = await renderSheetCanvas({
        singleCanvas,
        queueItems: usingQueue ? sheetQueue : undefined,
        paperW: targetPaper.w,
        paperH: targetPaper.h,
        tileW: activeDims.printW,
        tileH: activeDims.printH,
        gapPx,
        gapMm,
        paperLabel: targetPaper.shortLabel,
        borderWidthPx,
        borderColor,
        outlineStyle,
        outlineOffsetPx,
        orientationPref: sheetOrientation,
        customCount: targetCustomCount,
      });

      const rawBlob = await new Promise<Blob>((resolve) =>
        sheetCanvas.toBlob((b) => resolve(b!), "image/jpeg", 0.96)
      );
      const ppiBlob = await setJpegPpi(rawBlob, PRINT_PPI);
      const sizeKB = Math.round((ppiBlob.size / 1024) * 10) / 10;
      const countLabel = usingQueue
        ? Math.min(layout.maxCount, totalQueuedCopies)
        : layout.count;
      const filename = `sun-nova-${selectedPaperKey}-${countLabel}photos-${gapMm}mm-gap-300ppi.jpg`;
      triggerBlobDownload(ppiBlob, filename);
      setExportMessage(
        `Downloaded ${filename} (${sizeKB} KB · ${countLabel} photos · ${gapMm}mm uniform gap)`
      );
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to generate print sheet."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Open Mail Query Modal with Pre-filled Print / Studio Specs (no phone numbers)
  const handleOpenMailQuery = (
    customBody?: string,
    customSubject?: string
  ) => {
    const countSummary =
      sheetQueue.length > 0
        ? `${Math.min(sheetLayout.maxCount, totalQueuedCopies)} multi-photos (${sheetQueue.length} different people)`
        : `${sheetLayout.count} photos`;

    const body = customBody
      ? customSubject
        ? customBody
        : `Hello ${BRAND_NAME},\n\nI have a query / print request:\n• ${customBody}\n\nPlease let me know the next steps. I have my 300 PPI file ready to attach.`
      : `Hello ${BRAND_NAME},\n\nI would like to inquire about / order printed photos:\n` +
        `• Crop Size: ${activeDims.label} (${activeDims.printW}×${activeDims.printH} px)\n` +
        `• Print Sheet: ${paper.label} (${countSummary}, ${gapMm}mm gap)\n` +
        `• Background: ${bgColor}\n` +
        (dressId !== "none" ? `• Outfit Overlay: ${dressId}\n` : "") +
        (nameText.trim() ? `• Name Strip: ${nameText.trim()}\n` : "") +
        `\nI have prepared my 300 PPI file and will attach it here.`;

    setMailModalState({
      isOpen: true,
      subject:
        customSubject ||
        `${BRAND_NAME} — Print Query (${workspaceMode === "xerox" ? "ID Card Xerox" : activeDims.label})`,
      body,
    });
  };

  const canExportSheet = Boolean(
    sheetQueue.length > 0 || (imageSrc && croppedAreaPixels)
  );
  const effectiveSheetCount =
    sheetQueue.length > 0
      ? Math.min(sheetLayout.maxCount, totalQueuedCopies)
      : sheetLayout.count;

  const filteredDresses = useMemo(() => {
    if (dressCategory === "All") return resolvedOutfits;
    return resolvedOutfits.filter(
      (d) => d.id === "none" || d.category === dressCategory
    );
  }, [dressCategory, resolvedOutfits]);

  const resolvedBackgrounds = useMemo(() => {
    const cmsBgs = (cmsData?.backgrounds || []).filter(
      (b) => b.is_published !== 0
    );
    if (cmsBgs.length > 0) return cmsBgs;
    return BG_COLORS.map((c, idx) => ({
      id: `builtin-bg-${idx}`,
      name: c.name,
      preset_type: "color" as const,
      hex_color: c.hex,
      media_id: null,
      image_url: null,
      display_order: idx + 1,
      is_published: 1,
      created_at: "",
      updated_at: "",
    }));
  }, [cmsData?.backgrounds]);

  const activeTheme = STUDIO_ACCENTS[studioAccent];
  const activeDressLabel = useMemo(() => {
    if (dressId === "none") return "None (Original Outfit)";
    return (
      resolvedOutfits.find((o) => o.id === dressId)?.label || dressId
    );
  }, [dressId, resolvedOutfits]);

  const studioLiveSnapshot = useMemo<StudioLiveSnapshot>(
    () => ({
      workspaceMode,
      hasImage: Boolean(imageSrc),
      presetLabel: activeDims.label,
      dimensionsText: `${activeDims.printW}×${activeDims.printH} px`,
      paperLabel: paper.label,
      sheetCount: effectiveSheetCount,
      gapMm,
      bgColor,
      bgRemoved,
      aiBeautyApplied,
      dressLabel: activeDressLabel,
      queueCount: sheetQueue.length,
      targetKB,
      supportEmail,
    }),
    [
      workspaceMode,
      imageSrc,
      activeDims.label,
      activeDims.printW,
      activeDims.printH,
      paper.label,
      effectiveSheetCount,
      gapMm,
      bgColor,
      bgRemoved,
      aiBeautyApplied,
      activeDressLabel,
      sheetQueue.length,
      targetKB,
      supportEmail,
    ]
  );

  const handleAssistantAction = (action: StudioAssistantAction) => {
    const closeOnCompact = () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsAiOpen(false);
      }
    };

    const scrollToWorkbench = () => {
      setTimeout(() => {
        document
          .getElementById("studio-workbench")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    };

    const jumpPassportStep = (stepId: ControlStepId) => {
      setWorkspaceMode("passport");
      setActiveTab("crop");
      closeOnCompact();
      setTimeout(() => {
        document
          .getElementById("studio-workbench")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        scrollToControlStep(stepId);
      }, 90);
    };

    switch (action.id) {
      case "open_passport":
        setWorkspaceMode("passport");
        setActiveTab("crop");
        closeOnCompact();
        scrollToWorkbench();
        break;
      case "open_sheet_preview":
        setWorkspaceMode("passport");
        setActiveTab("sheet");
        closeOnCompact();
        scrollToWorkbench();
        break;
      case "open_ai_beauty":
        setWorkspaceMode("passport");
        setActiveTab("crop");
        closeOnCompact();
        if (imageSrc) {
          setIsAiBeautyModalOpen(true);
        } else {
          scrollToWorkbench();
        }
        break;
      case "jump_size":
        jumpPassportStep("size");
        break;
      case "jump_bg_cut":
        jumpPassportStep("bg");
        break;
      case "jump_outfit":
        jumpPassportStep("dress");
        break;
      case "jump_info":
        jumpPassportStep("name");
        break;
      case "jump_export":
        jumpPassportStep("export");
        break;
      case "open_xerox":
        setWorkspaceMode("xerox");
        closeOnCompact();
        scrollToWorkbench();
        break;
      case "open_converters":
        setWorkspaceMode("converters");
        closeOnCompact();
        scrollToWorkbench();
        break;
      case "open_resume":
        setWorkspaceMode("resume");
        closeOnCompact();
        scrollToWorkbench();
        break;
      case "open_mail_desk":
        handleOpenMailQuery(action.mailBody, action.mailSubject);
        closeOnCompact();
        break;
    }
  };

  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#080B12] text-[#F5F7FA] flex items-center justify-center p-6 text-sm text-[#94A3B8]">
            Loading SUN-NOVA Admin Dashboard...
          </div>
        }
      >
        <AdminPortal
          onExitAdmin={navigateToHome}
          onPublicDataChanged={refreshPublicData}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F5F7FA] flex flex-col">
      <Header
        cmsSettings={cmsData?.settings}
        onMailQuery={() => handleOpenMailQuery()}
      />

      <main className="flex-1 w-full">
        {/* Cinematic Full-Screen Hero */}
        <HeroShowcase
          cmsSettings={cmsData?.settings}
          workspaceMode={workspaceMode}
          onSelectWorkspaceMode={(mode) => {
            setWorkspaceMode(mode);
            document
              .getElementById("studio-workbench")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          onJumpToStudio={() => {
            setWorkspaceMode("passport");
            document
              .getElementById("studio-workbench")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Interactive 300 PPI Print Studio Workbench */}
        <section
          id="studio-workbench"
          className="studio-dark-shell max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-6 pt-6 sm:pt-10 pb-6"
        >
          {/* Compact Centered Workspace Mode Switcher */}
          <div className="mb-6 sm:mb-7 max-w-4xl mx-auto">
            <p className="text-center text-[10px] sm:text-[11px] font-mono-nums tracking-[0.18em] text-[#00E5FF] uppercase mb-2.5">
              {BRAND_NAME} · Precision Digital Print Studio
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 p-1.5 bg-[#111827] border border-[#00E5FF]/20 rounded-xl w-full">
              <button
                type="button"
                onClick={() => setWorkspaceMode("passport")}
                className={`inline-flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs lg:text-sm font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] sm:min-h-[42px] ${
                  workspaceMode === "passport"
                    ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm font-bold"
                    : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Passport Photo Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("xerox")}
                className={`inline-flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs lg:text-sm font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] sm:min-h-[42px] ${
                  workspaceMode === "xerox"
                    ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm font-bold"
                    : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                }`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Aadhaar / PAN / ID Xerox</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("converters")}
                className={`inline-flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs lg:text-sm font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] sm:min-h-[42px] ${
                  workspaceMode === "converters"
                    ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm font-bold"
                    : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">PDF, XML &amp; Text</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("resume")}
                className={`inline-flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs lg:text-sm font-semibold rounded-lg transition-all cursor-pointer min-h-[40px] sm:min-h-[42px] ${
                  workspaceMode === "resume"
                    ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm font-bold"
                    : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Resume Maker</span>
              </button>
            </div>
          </div>

          {workspaceMode === "xerox" ? (
            <Suspense
              fallback={
                <div className="glass-card p-10 text-center text-sm text-[#94A3B8]">
                  Loading ID Card Xerox Studio...
                </div>
              }
            >
              <IdCardXeroxStudio
                onMailQuery={(summary) => handleOpenMailQuery(summary)}
              />
            </Suspense>
          ) : workspaceMode === "converters" ? (
            <Suspense
              fallback={
                <div className="glass-card p-10 text-center text-sm text-[#94A3B8]">
                  Loading PDF, XML &amp; Text Converters...
                </div>
              }
            >
              <DocumentConverterStudio />
            </Suspense>
          ) : workspaceMode === "resume" ? (
            <Suspense
              fallback={
                <div className="glass-card p-10 text-center text-sm text-[#94A3B8]">
                  Loading Professional Resume Maker...
                </div>
              }
            >
              <ResumeMakerStudio />
            </Suspense>
          ) : (
          <>
          {/* Main Two-Column Studio Workbench (Always Side-by-Side on All Screen Sizes; Selected Photo Stays Pinned) */}
          <div
            id="studio"
            className="grid grid-cols-12 gap-2 sm:gap-4 lg:gap-6 items-start"
          >
            {/* Left 7 Columns: Pinned Selected Photo Stage + Independent-Scroll Lower Tools & Queue */}
            <div
              ref={leftColumnRef}
              className="col-span-7 min-w-0 flex flex-col gap-2.5 sm:gap-3.5 h-[calc(100dvh-4.75rem)] sm:h-[calc(100vh-5.75rem)] sticky top-16 sm:top-20 pr-0.5 lg:pr-1 overscroll-contain"
            >
              {/* Pinned Top Stage (Does Not Scroll Away When Scrolling Tools Below or Right Panel) */}
              <div
                className={`glass-card p-2 sm:p-3.5 lg:p-4 shrink-0 overscroll-contain ${
                  activeTab === "sheet" || !imageSrc
                    ? "max-h-[62%] overflow-y-auto overflow-x-hidden studio-panel-scroll"
                    : ""
                }`}
              >
                {/* Workspace Toolbar */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2 sm:gap-2.5 pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-[#00E5FF]/15">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
                    <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-xl flex-1 sm:flex-initial min-w-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab("crop")}
                        className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors whitespace-nowrap min-w-0 cursor-pointer ${
                          activeTab === "crop"
                            ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm"
                            : "text-[#94A3B8] hover:text-[#F5F7FA]"
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Crop &amp; Retouch</span>
                      </button>
                      <button
                        type="button"
                        id="sheet-layout"
                        onClick={() => setActiveTab("sheet")}
                        className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors whitespace-nowrap min-w-0 cursor-pointer ${
                          activeTab === "sheet"
                            ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm"
                            : "text-[#94A3B8] hover:text-[#F5F7FA]"
                        }`}
                      >
                        <Grid className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          Sheet ({effectiveSheetCount} · {paper.shortLabel})
                        </span>
                      </button>
                    </div>

                    {/* Undo / Redo Toolbar */}
                    <div className="inline-flex items-center gap-1 p-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-xl">
                      <button
                        type="button"
                        onClick={undoStudio}
                        disabled={!canUndoStudio}
                        title="Undo (Ctrl+Z)"
                        aria-label="Undo last studio change"
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-[#161D2B] text-[#F5F7FA] hover:bg-[#1E273B] disabled:bg-transparent disabled:text-slate-600 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Undo</span>
                        {studioUndoCount > 0 && (
                          <span className="font-mono-nums text-[10px] text-[#00E5FF]">
                            ({studioUndoCount})
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={redoStudio}
                        disabled={!canRedoStudio}
                        title="Redo (Ctrl+Y)"
                        aria-label="Redo studio change"
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-[#161D2B] text-[#F5F7FA] hover:bg-[#1E273B] disabled:bg-transparent disabled:text-slate-600 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                        <span>Redo</span>
                        {studioRedoCount > 0 && (
                          <span className="font-mono-nums text-[10px] text-[#00E5FF]">
                            ({studioRedoCount})
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {imageSrc && (
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      {activeTab === "crop" && (
                        <>
                          <button
                            type="button"
                            disabled={!aiBeautyApplied && !bgRemoved}
                            onPointerDown={() => setIsComparingOriginal(true)}
                            onPointerUp={() => setIsComparingOriginal(false)}
                            onPointerLeave={() => setIsComparingOriginal(false)}
                            onPointerCancel={() => setIsComparingOriginal(false)}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                setIsComparingOriginal(true);
                              }
                            }}
                            onKeyUp={() => setIsComparingOriginal(false)}
                            onBlur={() => setIsComparingOriginal(false)}
                            title="Press and hold to compare with the unretouched original photo"
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 select-none ${
                              isComparingOriginal
                                ? "border-[#00E5FF] bg-[#00E5FF] text-[#080B12] cursor-pointer"
                                : aiBeautyApplied || bgRemoved
                                ? "border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#F5F7FA] hover:border-[#00E5FF] cursor-pointer"
                                : "border-[#00E5FF]/15 text-slate-500 cursor-not-allowed"
                            }`}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>
                              {isComparingOriginal
                                ? "Showing Original"
                                : "Hold: Before / After"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowHeadGuide((v) => !v)}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              showHeadGuide
                                ? "border-[#00E5FF]/60 bg-[#00E5FF]/15 text-[#00E5FF]"
                                : "border-[#00E5FF]/20 text-[#94A3B8] hover:text-[#F5F7FA]"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Head Guide</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span>Click Photo</span>
                      </button>

                      <label className="text-xs font-semibold text-[#00E5FF] hover:text-[#F5F7FA] cursor-pointer whitespace-nowrap shrink-0 underline underline-offset-4">
                        Upload New Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Canvas Body */}
                {activeTab === "sheet" ? (
                  <SheetPreviewCanvas
                    singlePhotoDataUrl={singlePreviewUrl}
                    queueItems={sheetQueue}
                    layout={sheetLayout}
                    tileW={activeDims.printW}
                    tileH={activeDims.printH}
                    gapPx={gapPx}
                    gapMm={gapMm}
                    paperLabel={paper.label}
                    borderWidthPx={borderWidthPx}
                    borderColor={borderColor}
                    outlineStyle={outlineStyle}
                    outlineOffsetPx={outlineOffsetPx}
                  />
                ) : !imageSrc ? (
                  <div className="space-y-4">
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragActive(true);
                      }}
                      onDragLeave={() => setIsDragActive(false)}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-4 sm:px-6 py-6 sm:py-8 lg:py-14 cursor-pointer transition-colors ${
                        isDragActive
                          ? "border-[#00E5FF] bg-[#00E5FF]/10"
                          : "border-[#00E5FF]/25 hover:border-[#00E5FF]/60 bg-[#080B12]/70"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/15 border border-[#00E5FF]/30 text-[#00E5FF] flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-[#F5F7FA] text-base">
                        Drop a portrait photo here or click to browse
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-1 text-center">
                        Supports JPG, PNG, and WEBP · Stays strictly on your
                        device
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                        className="hidden"
                      />
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-[#94A3B8]">
                      <span>
                        Take a photo live with your camera or test with a sample
                        portrait:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCameraOpen(true)}
                          className="inline-flex items-center gap-2 font-bold text-[#080B12] bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Click Photo (Camera)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSample()}
                          className="inline-flex items-center gap-2 font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF]/60 px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#00E5FF]" />
                          <span>
                            {publishedSamplePortraits[0]?.title
                              ? `Sample: ${publishedSamplePortraits[0].title}`
                              : "Load Sample Portrait"}
                          </span>
                        </button>
                      </div>
                    </div>
                    {publishedSamplePortraits.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-[#94A3B8]">
                          More studio samples:
                        </span>
                        {publishedSamplePortraits.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => handleLoadSample(sp.image_url)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF] text-[11px] text-[#E2E8F0] cursor-pointer"
                          >
                            <img
                              src={sp.image_url}
                              alt={sp.title}
                              className="w-4 h-4 rounded-sm object-cover"
                            />
                            <span>{sp.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Interactive Crop Frame (Locked in View Above Scrollable Controls) */}
                    <div
                      ref={cropContainerRef}
                      className="relative w-full h-[180px] sm:h-[235px] lg:h-[300px] xl:h-[340px] rounded-xl overflow-hidden border border-[#00E5FF]/25 touch-none"
                      style={{
                        backgroundColor: bgColor,
                        backgroundImage: bgImageUrl ? `url("${bgImageUrl}")` : undefined,
                        backgroundSize: bgImageUrl ? "cover" : undefined,
                        backgroundPosition: bgImageUrl ? "center" : undefined,
                      }}
                    >
                      <div
                        className="w-full h-full"
                        style={{
                          filter: buildCanvasFilterString(
                            brightness,
                            contrast,
                            imageFilter
                          ),
                        }}
                      >
                        <Cropper
                          image={
                            isComparingOriginal
                              ? preBeautySrc || originalSrc || imageSrc
                              : imageSrc
                          }
                          crop={crop}
                          zoom={zoom}
                          rotation={rotation}
                          aspect={activeDims.aspect}
                          cropSize={cropBoxSize}
                          showGrid={true}
                          zoomWithScroll={false}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onRotationChange={setRotation}
                          onCropComplete={onCropComplete}
                          style={{
                            containerStyle: {
                              backgroundColor: bgImageUrl ? "transparent" : bgColor,
                            },
                          }}
                        />
                      </div>

                      {/* Live Formal Dress Overlay inside Exact Crop Frame */}
                      {dressPreviewUrl && cropBoxSize && (
                        <div
                          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden z-10"
                          style={{
                            width: cropBoxSize.width,
                            height: cropBoxSize.height,
                          }}
                        >
                          <img
                            src={dressPreviewUrl}
                            alt="Formal passport dress preview"
                            className="absolute max-w-none pointer-events-none"
                            style={{
                              width: `${dressScale * 100}%`,
                              height: `${dressScale * 100}%`,
                              left: `${50 - (dressScale * 100) / 2 + dressOffsetX}%`,
                              top: `${50 - (dressScale * 100) / 2 + dressOffsetY}%`,
                            }}
                          />
                        </div>
                      )}

                      {/* Optional Official Head & Eye Alignment Overlay */}
                      {showHeadGuide && (
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          className="pointer-events-none absolute inset-0 w-full h-full z-10"
                          aria-hidden="true"
                        >
                          <ellipse
                            cx="50"
                            cy="42"
                            rx="19"
                            ry="25"
                            fill="none"
                            stroke="rgba(0, 229, 255, 0.85)"
                            strokeWidth="0.6"
                            strokeDasharray="2 2"
                          />
                          <line
                            x1="28"
                            y1="40"
                            x2="72"
                            y2="40"
                            stroke="rgba(0, 229, 255, 0.6)"
                            strokeWidth="0.45"
                            strokeDasharray="1.5 1.5"
                          />
                          <line
                            x1="50"
                            y1="14"
                            x2="50"
                            y2="70"
                            stroke="rgba(139, 92, 246, 0.5)"
                            strokeWidth="0.4"
                          />
                        </svg>
                      )}

                      {/* Active Comparison Indicator */}
                      {isComparingOriginal && (
                        <div className="pointer-events-none absolute top-3 left-3 z-30 px-2.5 py-1 rounded-md bg-[#080B12]/90 border border-[#00E5FF]/50 text-[11px] font-semibold text-[#00E5FF]">
                          Original (Before)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Independent Scrollable Lower Tools & Multi-Photo Queue (Scrolls Without Moving Selected Photo Above) */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain studio-panel-scroll space-y-2.5 sm:space-y-3.5 pr-0.5">
                {activeTab === "crop" && imageSrc && (
                  <div className="glass-card p-2 sm:p-3.5 lg:p-4">
                    {/* Fine-Tune Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 lg:gap-x-6 gap-y-2.5 sm:gap-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                          <span className="font-medium text-[#E2E8F0]">Zoom</span>
                          <span className="font-mono-nums text-[#00E5FF]">
                            {zoom.toFixed(2)}×
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.05}
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-full accent-studio cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                          <span className="font-medium text-[#E2E8F0]">
                            Straighten / Rotate
                          </span>
                          <span className="font-mono-nums text-[#00E5FF]">
                            {rotation}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-30}
                          max={30}
                          step={1}
                          value={rotation}
                          onChange={(e) => setRotation(Number(e.target.value))}
                          className="w-full accent-studio cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                          <span className="font-medium text-[#E2E8F0]">
                            Brightness
                          </span>
                          <span className="font-mono-nums text-[#00E5FF]">
                            {brightness}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={75}
                          max={130}
                          step={1}
                          value={brightness}
                          onChange={(e) =>
                            setBrightness(Number(e.target.value))
                          }
                          className="w-full accent-studio cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                          <span className="font-medium text-[#E2E8F0]">
                            Contrast
                          </span>
                          <span className="font-mono-nums text-[#00E5FF]">
                            {contrast}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={80}
                          max={130}
                          step={1}
                          value={contrast}
                          onChange={(e) => setContrast(Number(e.target.value))}
                          className="w-full accent-studio cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Image Filters */}
                    <div className="mt-4 pt-4 border-t border-[#00E5FF]/15">
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#F5F7FA]">
                            Image Filters
                          </span>
                          <span className="text-[11px] text-[#94A3B8]">
                            · Applied to 300 PPI output
                          </span>
                        </div>
                        {imageFilter !== "none" && (
                          <button
                            type="button"
                            onClick={() => setImageFilter("none")}
                            className="text-xs font-medium text-[#00E5FF] hover:text-[#F5F7FA] cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Reset Filter
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-1.5 sm:gap-2">
                        {IMAGE_FILTER_PRESETS.map((preset) => {
                          const isActive = imageFilter === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setImageFilter(preset.id)}
                              className={`flex flex-col items-start gap-1 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                                isActive
                                  ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                                  : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/40 text-[#E2E8F0]"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 w-full">
                                <span
                                  className="w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, #00E5FF 0%, #8B5CF6 55%, #080B12 100%)",
                                    filter: buildCanvasFilterString(
                                      100,
                                      100,
                                      preset.id
                                    ),
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="text-xs font-semibold truncate">
                                  {preset.label}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#94A3B8] truncate w-full">
                                {preset.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Background Removal, AI Skin Beauty & Add to Multi-Photo Queue Bar */}
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#00E5FF]/15 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {(bgRemoved || aiBeautyApplied) && (
                          <button
                            type="button"
                            onClick={handleRestoreOriginal}
                            disabled={isRemovingBg || isApplyingAiBeauty}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore Original</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleRemoveBackground}
                          disabled={isRemovingBg || isApplyingAiBeauty}
                          className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#161D2B] border border-[#00E5FF]/35 hover:border-[#00E5FF] disabled:opacity-50 text-[#F5F7FA] text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isRemovingBg ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
                              <span>{bgStatusText || "Processing..."}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                              <span>
                                {bgRemoved ? "Re-run BG Cutout" : "AI Remove BG"}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsAiBeautyModalOpen(true)}
                          disabled={isApplyingAiBeauty || isRemovingBg}
                          className={`inline-flex items-center gap-1.5 sm:gap-2 border disabled:opacity-50 text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            aiBeautyApplied
                              ? "bg-[#00E5FF]/15 border-[#00E5FF] text-[#F5F7FA] hover:bg-[#00E5FF]/25"
                              : "bg-[#161D2B] border-[#8B5CF6]/55 hover:border-[#00E5FF] text-[#F5F7FA]"
                          }`}
                        >
                          {isApplyingAiBeauty ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
                              <span>{aiBeautyStatusText || "Retouching..."}</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                              <span>
                                {aiBeautyApplied
                                  ? "AI Skin Beauty (Edit)"
                                  : "AI Skin Beauty"}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Add Current Photo to Multi-Photo Sheet */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <label
                          htmlFor="copies-to-add"
                          className="text-[11px] sm:text-xs text-[#94A3B8] whitespace-nowrap"
                        >
                          Copies:
                        </label>
                        <input
                          id="copies-to-add"
                          type="number"
                          min={1}
                          max={60}
                          value={copiesToAdd}
                          onChange={(e) =>
                            setCopiesToAdd(Math.max(1, Number(e.target.value)))
                          }
                          className="w-12 sm:w-14 font-mono-nums bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-1.5 sm:px-2 py-1.5 text-xs text-center text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                        />
                        <button
                          type="button"
                          onClick={handleAddToQueue}
                          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg hover:brightness-110 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {editingQueueId
                              ? "Update Slot in Sheet"
                              : "Add to Multi-Photo Sheet"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-Photo Sheet Queue Panel */}
                <div className="glass-card p-2 sm:p-3.5 lg:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#00E5FF] shrink-0" />
                    <h3 className="text-sm font-bold text-[#F5F7FA]">
                      Multi-Photo Sheet Queue
                    </h3>
                    <span className="text-xs text-[#94A3B8] font-mono-nums">
                      ·{" "}
                      {sheetQueue.length > 0
                        ? `${totalQueuedCopies} / ${baseLayout.maxCount} slots on ${paper.shortLabel}`
                        : `Up to ${baseLayout.cols} different per line`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleActivateA4SixDifferent}
                      className="text-xs font-semibold text-[#E2E8F0] bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      A4 1-Line (6 Different)
                    </button>

                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#080B12] bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] hover:brightness-110 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap">
                      {isBulkUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isBulkUploading
                          ? "Adding Photos..."
                          : "+ Upload Multiple Photos"}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleBulkUploadMultiple}
                        className="hidden"
                      />
                    </label>

                    {sheetQueue.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab("sheet")}
                          className="text-xs font-semibold text-[#00E5FF] hover:text-[#F5F7FA] underline underline-offset-4 cursor-pointer whitespace-nowrap ml-1"
                        >
                          Preview Sheet
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSheetQueue([]);
                            setEditingQueueId(null);
                          }}
                          className="text-xs font-medium text-[#94A3B8] hover:text-rose-400 cursor-pointer whitespace-nowrap"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {sheetQueue.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">
                    For{" "}
                    <strong className="font-semibold text-[#F5F7FA]">
                      A4 one line with 6 different photos
                    </strong>
                    , click{" "}
                    <strong className="font-semibold text-[#F5F7FA]">
                      A4 1-Line (6 Different)
                    </strong>{" "}
                    and select up to 6 photos using{" "}
                    <strong className="font-semibold text-[#F5F7FA]">
                      + Upload Multiple Photos
                    </strong>{" "}
                    (auto-cropped to 300 PPI with 1 copy each), or crop each
                    photo individually above.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {totalQueuedCopies > baseLayout.maxCount && (
                      <div className="text-xs text-amber-200 bg-amber-950/60 border border-amber-500/40 rounded-lg px-3 py-2">
                        Queue total ({totalQueuedCopies} photos) exceeds{" "}
                        {paper.shortLabel} capacity ({baseLayout.maxCount} slots).
                        Only the first {baseLayout.maxCount} will fit on one{" "}
                        {paper.shortLabel} sheet, or switch Paper Size to A4.
                      </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {sheetQueue.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                            editingQueueId === item.id
                              ? "border-[#00E5FF] bg-[#00E5FF]/10"
                              : "border-[#00E5FF]/15 bg-[#080B12]/70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={item.dataUrl}
                              alt={item.label}
                              referrerPolicy="no-referrer"
                              className="w-9 h-11 object-cover rounded border border-white/20 bg-white shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                                {idx + 1}. {item.label}
                              </p>
                              <p className="text-[11px] text-[#94A3B8] font-mono-nums">
                                {activeDims.printW}×{activeDims.printH} px
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {item.sourceUrl && (
                              <button
                                type="button"
                                onClick={() => handleEditQueueItem(item)}
                                className="p-1.5 text-[#94A3B8] hover:text-[#00E5FF] cursor-pointer"
                                title="Edit crop or background"
                                aria-label="Edit photo crop"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueCopies(item.id, -1)}
                              className="w-6 h-6 rounded border border-[#00E5FF]/25 bg-[#161D2B] hover:border-[#00E5FF] text-xs font-bold text-[#F5F7FA] cursor-pointer"
                              aria-label="Decrease copies"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={item.copies}
                              onChange={(e) =>
                                handleUpdateQueueCopies(
                                  item.id,
                                  Number(e.target.value) || 1,
                                  true
                                )
                              }
                              className="w-10 text-center font-mono-nums text-xs font-semibold border border-[#00E5FF]/25 bg-[#080B12] text-[#F5F7FA] rounded py-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueCopies(item.id, 1)}
                              className="w-6 h-6 rounded border border-[#00E5FF]/25 bg-[#161D2B] hover:border-[#00E5FF] text-xs font-bold text-[#F5F7FA] cursor-pointer"
                              aria-label="Increase copies"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveQueueItem(item.id)}
                              className="p-1.5 text-[#94A3B8] hover:text-rose-400 cursor-pointer"
                              aria-label="Remove photo from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                      <span className="font-mono-nums">
                        Row summary: {sheetQueue.length} unique{" "}
                        {sheetQueue.length === 1 ? "person" : "people"} ·{" "}
                        {totalQueuedCopies} total prints (
                        {Math.ceil(totalQueuedCopies / baseLayout.cols)}{" "}
                        {Math.ceil(totalQueuedCopies / baseLayout.cols) === 1
                          ? "line"
                          : "lines"}{" "}
                        on {paper.shortLabel})
                      </span>
                      <label className="font-semibold text-[#00E5FF] hover:text-[#F5F7FA] cursor-pointer underline underline-offset-4">
                        + Add More Photos
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleBulkUploadMultiple}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Independent-Scroll Configuration & Export Controls */}
            <div
              ref={rightPanelRef}
              onScroll={handleRightPanelScroll}
              className="col-span-5 min-w-0 glass-card p-2 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 lg:space-y-5 h-[calc(100dvh-4.75rem)] sm:h-[calc(100vh-5.75rem)] overflow-y-auto overflow-x-hidden overscroll-contain studio-panel-scroll sticky top-16 sm:top-20"
            >
            {/* Sticky Quick-Step Next-by-Next Bar */}
            <div className="sticky top-0 z-20 -mx-2 sm:-mx-4 lg:-mx-5 -mt-2 sm:-mt-4 lg:-mt-5 px-2 sm:px-4 py-1.5 sm:py-2.5 bg-[#0D131F]/95 backdrop-blur-xl border-b border-[#00E5FF]/20 rounded-t-[20px] flex items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {STUDIO_CONTROL_STEPS.map((step) => {
                  const isActive = activeControlStep === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => scrollToControlStep(step.id)}
                      className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold"
                          : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                      }`}
                    >
                      {step.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const prevIdx = Math.max(0, stepControlIndex - 1);
                    scrollToControlStep(STUDIO_CONTROL_STEPS[prevIdx].id);
                  }}
                  disabled={stepControlIndex <= 0}
                  aria-label="Previous editing step"
                  title="Previous editing option"
                  className="p-1 rounded-md border border-[#00E5FF]/20 bg-[#161D2B] text-[#E2E8F0] hover:border-[#00E5FF]/60 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = Math.min(
                      STUDIO_CONTROL_STEPS.length - 1,
                      stepControlIndex + 1
                    );
                    scrollToControlStep(STUDIO_CONTROL_STEPS[nextIdx].id);
                  }}
                  disabled={stepControlIndex >= STUDIO_CONTROL_STEPS.length - 1}
                  aria-label="Next editing step"
                  title="Next editing option"
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md border border-[#00E5FF]/30 bg-[#161D2B] text-[11px] font-semibold text-[#00E5FF] hover:border-[#00E5FF] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 1. Crop Size Preset */}
            <div id="studio-step-size" className="scroll-mt-14">
              <label
                htmlFor="preset-select"
                className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
              >
                01. Crop Size (300 PPI)
              </label>
              <select
                id="preset-select"
                value={presetKey}
                onChange={(e) => setPresetKey(e.target.value as PresetKey)}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-3 py-2 text-sm font-medium text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              >
                {Object.values(PHOTO_PRESETS).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>

              {presetKey === "custom_inch" && (
                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                  <div>
                    <label
                      htmlFor="custom-w"
                      className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                    >
                      Width (Inches)
                    </label>
                    <input
                      id="custom-w"
                      type="number"
                      min={0.5}
                      max={6}
                      step={0.1}
                      value={customWInch}
                      onChange={(e) => setCustomWInch(Number(e.target.value))}
                      className="w-full font-mono-nums bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="custom-h"
                      className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                    >
                      Height (Inches)
                    </label>
                    <input
                      id="custom-h"
                      type="number"
                      min={0.5}
                      max={8}
                      step={0.1}
                      value={customHInch}
                      onChange={(e) => setCustomHInch(Number(e.target.value))}
                      className="w-full font-mono-nums bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Paper Size, Orientation, Custom Photo Count & Uniform Gap */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label
                    htmlFor="paper-select"
                    className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                  >
                    02. Print Paper Size
                  </label>
                  <select
                    id="paper-select"
                    value={paperKey}
                    onChange={(e) => setPaperKey(e.target.value as PaperKey)}
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-2 text-sm font-medium text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  >
                    {Object.values(PAPER_SIZES).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gap-select"
                    className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                  >
                    Photo Gap (All Papers)
                  </label>
                  <select
                    id="gap-select"
                    value={gapMm}
                    onChange={(e) => setGapMm(Number(e.target.value))}
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-2 text-sm font-medium text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  >
                    {GAP_OPTIONS_MM.map((g) => (
                      <option key={g.mm} value={g.mm}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customize Photo Count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#E2E8F0]">
                    Photos on {paper.shortLabel} Sheet
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                    <span>Orientation:</span>
                    <select
                      aria-label="Sheet orientation"
                      value={sheetOrientation}
                      onChange={(e) =>
                        setSheetOrientation(e.target.value as SheetOrientation)
                      }
                      className="bg-[#080B12] border border-[#00E5FF]/25 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#F5F7FA] focus:outline-none"
                    >
                      <option value="auto">Auto</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>

                {sheetQueue.length > 0 ? (
                  <div className="text-xs text-[#94A3B8] bg-[#080B12]/80 border border-[#00E5FF]/20 rounded-lg px-3 py-2 font-mono-nums">
                    Multi-Photo Queue active:{" "}
                    <strong className="text-[#00E5FF]">
                      {effectiveSheetCount} mixed photos
                    </strong>{" "}
                    ({sheetLayout.cols}×{sheetLayout.activeRows} lines)
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 p-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setCountMode("max")}
                        className={`px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                          countMode === "max"
                            ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                            : "text-[#94A3B8] hover:text-[#F5F7FA]"
                        }`}
                      >
                        All ({baseLayout.maxCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCountMode("line1");
                          setCustomPhotoCount(baseLayout.cols);
                        }}
                        className={`px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                          countMode === "line1"
                            ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                            : "text-[#94A3B8] hover:text-[#F5F7FA]"
                        }`}
                      >
                        1 Line ({baseLayout.cols})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const twoLines = Math.min(
                            baseLayout.maxCount,
                            baseLayout.cols * 2
                          );
                          setCountMode("line2");
                          setCustomPhotoCount(twoLines);
                        }}
                        className={`px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                          countMode === "line2"
                            ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                            : "text-[#94A3B8] hover:text-[#F5F7FA]"
                        }`}
                      >
                        2 Lines (
                        {Math.min(baseLayout.maxCount, baseLayout.cols * 2)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCountMode("custom")}
                        className={`px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                          countMode === "custom"
                            ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                            : "text-[#94A3B8] hover:text-[#F5F7FA]"
                        }`}
                      >
                        Custom
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-1.5">
                      {[1, 2, 3].map((rowCount) => (
                        <button
                          key={rowCount}
                          type="button"
                          onClick={() => {
                            const baseCurrent =
                              countMode === "max" ? 0 : requestedCount;
                            const nextCount = Math.min(
                              baseLayout.maxCount,
                              baseCurrent + rowCount * baseLayout.cols
                            );
                            setCountMode("custom");
                            setCustomPhotoCount(nextCount);
                          }}
                          className="px-2 py-1.5 text-xs font-medium text-[#E2E8F0] bg-[#080B12]/70 hover:border-[#00E5FF]/50 border border-[#00E5FF]/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          title={`Add ${rowCount} row${rowCount > 1 ? "s" : ""} (+${rowCount * baseLayout.cols} photos)`}
                        >
                          Add {rowCount} {rowCount === 1 ? "Row" : "Rows"}
                        </button>
                      ))}
                    </div>

                    {countMode === "custom" && (
                      <div className="flex items-center justify-between gap-3 pt-0.5">
                        <label
                          htmlFor="custom-photo-count"
                          className="text-xs text-[#94A3B8] whitespace-nowrap"
                        >
                          Number of photos (1–{baseLayout.maxCount}):
                        </label>
                        <input
                          id="custom-photo-count"
                          type="number"
                          min={1}
                          max={baseLayout.maxCount}
                          value={customPhotoCount}
                          onChange={(e) =>
                            setCustomPhotoCount(
                              Math.min(
                                baseLayout.maxCount,
                                Math.max(1, Number(e.target.value) || 1)
                              )
                            )
                          }
                          className="w-20 font-mono-nums bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clean Unboxed Layout Spec Line */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8] py-2 border-y border-[#00E5FF]/15 font-mono-nums">
                <span>
                  Grid:{" "}
                  <strong className="text-[#F5F7FA]">
                    {effectiveSheetCount} photos ({sheetLayout.cols}×
                    {sheetLayout.activeRows} lines)
                  </strong>{" "}
                  · {sheetLayout.orientation}
                </span>
                <span className="text-[#00E5FF] font-semibold">
                  {gapMm}mm ({gapPx}px) gap
                </span>
              </div>
            </div>

            {/* 3. Background Color & Cut Lines */}
            <div id="studio-step-bg" className="space-y-3 scroll-mt-14">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#E2E8F0]">
                  03. Background Color (for Cutouts)
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] cursor-pointer">
                  <span>Custom:</span>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 rounded border border-[#00E5FF]/30 cursor-pointer p-0 bg-transparent"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {resolvedBackgrounds.map((bg) => {
                  const isImage = bg.preset_type === "image" && bg.image_url;
                  const hex = (bg.hex_color || "#FFFFFF").toUpperCase();
                  const active = isImage
                    ? bgImageUrl === bg.image_url
                    : !bgImageUrl && bgColor.toUpperCase() === hex;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() =>
                        isImage
                          ? setBgPreset(hex, bg.image_url)
                          : setBgColor(hex)
                      }
                      className={`flex flex-col items-center p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        active
                          ? "border-[#00E5FF] bg-[#00E5FF]/15 font-semibold text-[#F5F7FA]"
                          : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/40 text-[#94A3B8]"
                      }`}
                    >
                      {isImage ? (
                        <img
                          src={bg.image_url!}
                          alt={bg.name}
                          className="w-6 h-5 rounded border border-white/25 mb-1 object-cover"
                        />
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full border border-white/25 mb-1"
                          style={{ backgroundColor: hex }}
                        />
                      )}
                      <span className="truncate w-full text-center text-[11px]">
                        {bg.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Outline & Border Size Customization */}
              <div className="space-y-2.5 pt-2 border-t border-[#00E5FF]/15">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#E2E8F0]">
                    Outline / Cut Border Customize
                  </span>
                  <span className="font-mono-nums text-[#00E5FF] font-semibold">
                    {borderWidthPx === 0
                      ? "None (0 px)"
                      : `${borderWidthPx} px · ${outlineStyle}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                  {[0, 2, 4, 6, 10].map((px) => (
                    <button
                      key={px}
                      type="button"
                      onClick={() => setBorderWidthPx(px)}
                      className={`py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer font-mono-nums ${
                        borderWidthPx === px
                          ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#00E5FF] font-semibold"
                          : "border-[#00E5FF]/15 text-[#94A3B8] hover:border-[#00E5FF]/40"
                      }`}
                    >
                      {px === 0 ? "None" : `${px}px`}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1 p-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-lg">
                  {OUTLINE_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOutlineStyle(st.id)}
                      className={`py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer truncate ${
                        outlineStyle === st.id
                          ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                          : "text-[#94A3B8] hover:text-[#F5F7FA]"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mb-0.5">
                      <span>Outline Thickness</span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {borderWidthPx} px
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="Outline width in pixels"
                      min={0}
                      max={16}
                      step={1}
                      value={borderWidthPx}
                      onChange={(e) => setBorderWidthPx(Number(e.target.value))}
                      className="w-full accent-studio cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mb-0.5">
                      <span>Outer Cut Offset</span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {outlineOffsetPx === 0
                          ? "Flush"
                          : `+${outlineOffsetPx} px`}
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="Outer outline offset in pixels"
                      min={0}
                      max={12}
                      step={2}
                      value={outlineOffsetPx}
                      onChange={(e) =>
                        setOutlineOffsetPx(Number(e.target.value))
                      }
                      className="w-full accent-studio cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[#94A3B8] mr-1">Color:</span>
                    {BORDER_COLOR_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setBorderColor(c.hex)}
                        title={c.name}
                        className={`w-5 h-5 rounded-full border cursor-pointer ${
                          borderColor.toUpperCase() === c.hex
                            ? "ring-2 ring-[#00E5FF] border-white"
                            : "border-white/25"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom outline color"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      className="w-6 h-6 rounded border border-[#00E5FF]/25 cursor-pointer p-0 bg-transparent"
                    />
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyBorderToSingle}
                      onChange={(e) =>
                        setApplyBorderToSingle(e.target.checked)
                      }
                      className="rounded border-[#00E5FF]/30 accent-studio"
                    />
                    <span>On Single Photo</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 3b. Formal Passport Dress Generator (Student, Officer, Men, Women) */}
            <div id="studio-step-dress" className="space-y-2.5 pt-2 border-t border-[#00E5FF]/15 scroll-mt-14">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E2E8F0]">
                  <Shirt className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>03b. Passport Dress Generator (Student / Officer)</span>
                </span>
                {dressId !== "none" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDressId("none");
                      setDressScale(1);
                      setDressOffsetX(0);
                      setDressOffsetY(0);
                    }}
                    className="text-[11px] font-medium text-[#00E5FF] hover:text-[#F5F7FA] underline cursor-pointer"
                  >
                    Reset Outfit
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-1 p-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-lg">
                {(
                  [
                    "All",
                    "Student",
                    "Officer",
                    "Men",
                    "Women",
                    "Formal",
                    "Custom",
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDressCategory(cat)}
                    className={`px-1 py-1.5 text-[10px] sm:text-[11px] font-semibold rounded-md transition-colors cursor-pointer text-center truncate ${
                      dressCategory === cat
                        ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                        : "text-[#94A3B8] hover:text-[#F5F7FA]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Visual Outfit Thumbnail Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {filteredDresses.map((d) => {
                  const thumbUrl =
                    d.customUrl ||
                    buildDressDataUrl((d.builtinStyleId || d.id) as DressStyleId);
                  const isSelected = dressId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDressId(d.id)}
                      className={`p-1.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col items-center gap-1 ${
                        isSelected
                          ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA] font-semibold"
                          : "border-[#00E5FF]/15 hover:border-[#00E5FF]/40 bg-[#080B12]/70 text-[#E2E8F0]"
                      }`}
                    >
                      <div className="w-full h-11 rounded bg-[#161D2B] border border-white/10 flex items-end justify-center overflow-hidden">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={d.label}
                            className="w-11 h-11 object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] self-center">
                            None
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] leading-tight text-center line-clamp-2 w-full">
                        {d.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {dressId !== "none" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 pt-1 bg-[#080B12]/75 border border-[#00E5FF]/20 rounded-lg p-2.5">
                  <div>
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mb-0.5">
                      <span>Size</span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {Math.round(dressScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.65}
                      max={1.4}
                      step={0.02}
                      value={dressScale}
                      onChange={(e) => setDressScale(Number(e.target.value))}
                      className="w-full accent-studio cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mb-0.5">
                      <span>Move X</span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {dressOffsetX}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      step={1}
                      value={dressOffsetX}
                      onChange={(e) => setDressOffsetX(Number(e.target.value))}
                      className="w-full accent-studio cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mb-0.5">
                      <span>Move Y</span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {dressOffsetY}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      step={1}
                      value={dressOffsetY}
                      onChange={(e) => setDressOffsetY(Number(e.target.value))}
                      className="w-full accent-studio cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Name & DOP Strip */}
            <div id="studio-step-name" className="scroll-mt-14">
              <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
                04. Name &amp; Date Strip (Optional for Govt Exams)
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
                <input
                  type="text"
                  placeholder="Candidate Name"
                  value={nameText}
                  onChange={(e) => setNameText(e.target.value)}
                  className="w-full min-w-0 bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
                <input
                  type="text"
                  placeholder="DOP: 14-11-2026"
                  value={dateText}
                  onChange={(e) => setDateText(e.target.value)}
                  className="w-full min-w-0 bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
            </div>

            {/* 5. Target KB Size */}
            <div>
              <label
                htmlFor="kb-select"
                className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
              >
                05. Single Photo Max Size (Portal Upload)
              </label>
              <select
                id="kb-select"
                value={targetKB}
                onChange={(e) => setTargetKB(Number(e.target.value))}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-3 py-2 text-sm font-medium text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              >
                <option value={0}>Best Quality (No Size Limit)</option>
                <option value={20}>Under 20 KB</option>
                <option value={50}>Under 50 KB (Passport / PAN / SSC)</option>
                <option value={100}>Under 100 KB</option>
                <option value={200}>Under 200 KB</option>
              </select>
            </div>

            {/* Error or Export Status */}
            {errorMessage && (
              <div
                role="alert"
                className="text-xs text-rose-200 bg-rose-950/60 border border-rose-500/40 rounded-lg px-3 py-2"
              >
                {errorMessage}
              </div>
            )}
            {exportMessage && (
              <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/40 rounded-lg px-3 py-2 font-mono-nums">
                {exportMessage}
              </div>
            )}

            {/* Primary Export & Order Buttons */}
            <div id="studio-step-export" className="pt-2 border-t border-[#00E5FF]/15 space-y-2 sm:space-y-2.5 scroll-mt-14">
              <button
                type="button"
                onClick={handleDownloadSingle}
                disabled={!imageSrc || isExporting}
                className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-40 font-bold text-xs sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl transition-all whitespace-nowrap cursor-pointer disabled:cursor-not-allowed ${activeTheme.primaryBtn}`}
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  Download Single Photo ({activeDims.w}×{activeDims.h} px)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSheet(paperKey)}
                disabled={!canExportSheet || isExporting}
                className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-[#161D2B] border border-[#00E5FF]/35 hover:border-[#00E5FF] disabled:opacity-40 text-[#F5F7FA] font-semibold text-xs sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
              >
                <Grid className="w-4 h-4 shrink-0 text-[#00E5FF]" />
                <span className="truncate">
                  Download {paper.shortLabel} Sheet ({effectiveSheetCount}{" "}
                  {sheetQueue.length > 0 ? "Mixed Photos" : "Photos"})
                </span>
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSheet("4x6")}
                  disabled={!canExportSheet || isExporting}
                  className="flex items-center justify-center gap-1.5 bg-[#080B12] border border-[#00E5FF]/20 hover:border-[#00E5FF]/60 disabled:opacity-40 text-[#E2E8F0] text-xs font-semibold py-2 px-2.5 sm:px-3 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed min-w-0"
                >
                  <Download className="w-3.5 h-3.5 shrink-0 text-[#00E5FF]" />
                  <span className="truncate">Quick 4×6 Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSheet("a4")}
                  disabled={!canExportSheet || isExporting}
                  className="flex items-center justify-center gap-1.5 bg-[#080B12] border border-[#00E5FF]/20 hover:border-[#00E5FF]/60 disabled:opacity-40 text-[#E2E8F0] text-xs font-semibold py-2 px-2.5 sm:px-3 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed min-w-0"
                >
                  <Download className="w-3.5 h-3.5 shrink-0 text-[#00E5FF]" />
                  <span className="truncate">Quick A4 Sheet</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenMailQuery()}
                className="w-full flex items-center justify-center gap-1.5 sm:gap-2 border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#F5F7FA] font-semibold py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Mail className="w-4 h-4 shrink-0 text-[#00E5FF]" />
                <span className="truncate">Send Print Query via Mail</span>
              </button>
            </div>
          </div>
        </div>

        <StudioSections
          gapMm={gapMm}
          selectedPresetKey={presetKey}
          customWInch={customWInch}
          customHInch={customHInch}
          supportEmail={supportEmail}
          onChangeSupportEmail={handleSupportEmailChange}
          studioAccent={studioAccent}
          onChangeStudioAccent={handleStudioAccentChange}
          zeroZerosUrl={zeroZerosUrl}
          onChangeZeroZerosUrl={handleZeroZerosUrlChange}
          onSelectPaperAndDownload={(pk) => handleDownloadSheet(pk)}
          hasImage={canExportSheet}
        />
        </>
        )}
        </section>

        <ResponsiveHorizontalBanner />
        <NativeAdBanner />
        <SocialBarAd />

        {/* Full Commercial Printing Showcase, Portfolio Gallery, Workflow, Quote, About & Contact */}
        <LandingSections
          supportEmail={supportEmail}
          cmsSettings={cmsData?.settings}
          cmsServices={cmsData?.services}
          cmsPortfolio={cmsData?.portfolio}
          onOpenMailModal={(subj, body) => handleOpenMailQuery(body, subj)}
          onLaunchStudioMode={(mode) => {
            setWorkspaceMode(mode);
            document
              .getElementById("studio-workbench")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        <LowerBannerShowcase />
      </main>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(blob) => loadImageBlob(blob)}
      />

      <AiSkinBeautyModal
        isOpen={isAiBeautyModalOpen}
        onClose={() => setIsAiBeautyModalOpen(false)}
        previewImageUrl={imageSrc}
        options={aiBeautyOptions}
        onChangeOptions={setAiBeautyOptions}
        onApply={handleApplyAiSkinBeauty}
        isApplying={isApplyingAiBeauty}
        statusText={aiBeautyStatusText}
        aiBeautyApplied={aiBeautyApplied}
        onRestoreOriginal={handleRestoreOriginal}
      />

      <MailQueryModal
        isOpen={mailModalState.isOpen}
        supportEmail={supportEmail}
        initialSubject={mailModalState.subject}
        initialBody={mailModalState.body}
        onClose={() => setMailModalState((s) => ({ ...s, isOpen: false }))}
      />

      <StudioAiAgent
        studioSnapshot={studioLiveSnapshot}
        onTriggerAction={handleAssistantAction}
        isOpen={isAiOpen}
        onToggle={setIsAiOpen}
      />

      <footer className="bg-[#06080E] mt-16">
        <div className="cyan-divider-glow" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <div className="inline-flex items-center gap-3">
              <img
                src={cmsData?.settings?.logoImageUrl?.trim() || BRAND_ICON_URL}
                alt={BRAND_NAME}
                className="w-10 h-10 rounded-xl object-cover border border-[#00E5FF]/35 shadow-[0_0_16px_rgba(0,229,255,0.2)] shrink-0"
              />
              <span className="text-base font-extrabold tracking-wide text-[#F5F7FA]">
                {BRAND_NAME}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-sm leading-relaxed">
              Premium futuristic digital printing and graphic design studio.
              Combining true 300 PPI passport &amp; ID tools with bespoke
              commercial print production.
            </p>
            <p className="text-xs font-mono-nums text-[#00E5FF] break-all">
              Official Print Desk: {supportEmail}
            </p>
            <p className="text-xs font-mono-nums text-[#94A3B8] break-all">
              Support Mail:{" "}
              <a
                href={`mailto:${OFFICIAL_SUPPORT_EMAIL}`}
                className="text-[#00E5FF] hover:underline"
              >
                {OFFICIAL_SUPPORT_EMAIL}
              </a>
            </p>
            {OFFICIAL_SITE_URL && (
              <p className="text-xs font-mono-nums text-[#94A3B8] break-all">
                Official Website:{" "}
                <a
                  href={OFFICIAL_SITE_URL}
                  className="text-[#00E5FF] hover:underline"
                >
                  {OFFICIAL_SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </p>
            )}
          </div>

          <div className="md:col-span-3 space-y-2.5 text-xs">
            <h4 className="font-bold text-[#F5F7FA] uppercase tracking-wider text-[11px]">
              Quick Links
            </h4>
            <ul className="space-y-1.5 text-[#94A3B8]">
              <li>
                <a href="#home" className="hover:text-[#00E5FF] transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#studio-workbench"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  300 PPI Print Studio
                </a>
              </li>
              <li>
                <a
                  href="#services"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  Printing Services
                </a>
              </li>
              <li>
                <a
                  href="#portfolio"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  Portfolio Gallery
                </a>
              </li>
              <li>
                <a
                  href="#quote"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  Request a Quote
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  Contact Print Desk
                </a>
              </li>
              <li>
                <a
                  href="/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToAdmin();
                  }}
                  className="hover:text-[#00E5FF] transition-colors"
                >
                  Admin Dashboard
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5 text-xs">
            <h4 className="font-bold text-[#F5F7FA] uppercase tracking-wider text-[11px]">
              Print Specialties
            </h4>
            <p className="text-[#94A3B8] leading-relaxed">
              Business Cards · Banners &amp; Flex · Posters &amp; Flyers ·
              Stickers &amp; Vinyl · 300 PPI Photo Sheets · T-Shirts ·
              Invitations · Custom Graphic &amp; Logo Design · ID Cards · Large
              Format Printing.
            </p>
            <button
              type="button"
              onClick={() => handleOpenMailQuery()}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF]/60 text-[#F5F7FA] font-semibold transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Open Mail Print Desk</span>
            </button>
          </div>
        </div>

        <div className="border-t border-white/5 pt-5 pb-20 sm:pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
            <span>
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </span>
            <span className="font-mono-nums">
              300 PPI Studio · 4×6 · 5×7 · 6×8 · A5 · A4
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
