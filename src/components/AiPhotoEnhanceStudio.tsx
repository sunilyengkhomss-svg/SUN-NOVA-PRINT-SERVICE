import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Brush,
  Camera,
  CheckCircle2,
  Download,
  Eraser,
  FlipHorizontal2,
  Focus,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Loader2,
  Mail,
  Maximize2,
  Move,
  Printer,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Undo2,
  Upload,
  UserCheck,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import samplePortraitImg from "../assets/images/sample_portrait_1794641002441.jpg";
import { BRAND_NAME, PRINT_PPI } from "../types/photo";
import {
  analyzeAutoColorCorrection,
  compositeAddedObject,
  compositeBackgroundFill,
  computePredictedUpscaleSize,
  DEFAULT_COLOR_LIGHTING_OPTIONS,
  exportPrintReadyPhoto,
  loadImageFromUrl,
  prepareSafeUploadedImage,
  runColorAndLightingCorrection,
  runDeblurAndSharpen,
  runNaturalFaceRetouch,
  runNeuralBackgroundRemoval,
  runNeuralEsrganUpscale,
  runObjectRemovalInpaint,
  type AddedObjectSpec,
  type ColorLightingOptions,
  type DeblurSharpenOptions,
  type EnhanceBackgroundFill,
  type NaturalFaceRetouchOptions,
  type UpscaleTargetMode,
} from "../utils/photoEnhanceEngine";
import { CameraCaptureModal } from "./CameraCaptureModal";

type EnhanceToolTab =
  | "upscale"
  | "sharpen"
  | "background"
  | "face"
  | "color"
  | "objects"
  | "export";

type ObjectSubMode = "remove" | "add";

interface HistoryEntry {
  id: string;
  label: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  hasTransparency: boolean;
  bgAppliedHex: string | null;
}

interface CutoutAsset {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

interface BrushStroke {
  sizeNorm: number; // fraction of image min-dimension
  points: Array<{ x: number; y: number }>; // normalized 0..1
}

interface AiPhotoEnhanceStudioProps {
  onSendToPassport: (blob: Blob, label?: string) => void;
  onMailQuery: (summary: string) => void;
}

interface PrintPresetOption {
  id: string;
  label: string;
  unit: "in" | "mm";
  w: number;
  h: number;
}

const PRINT_PRESETS: readonly PrintPresetOption[] = [
  { id: "4x6", label: "4 × 6 in", unit: "in", w: 4, h: 6 },
  { id: "5x7", label: "5 × 7 in", unit: "in", w: 5, h: 7 },
  { id: "8x10", label: "8 × 10 in", unit: "in", w: 8, h: 10 },
  { id: "a4", label: "A4 (210 × 297 mm)", unit: "mm", w: 210, h: 297 },
  { id: "pp_35x45", label: "Passport 35 × 45 mm", unit: "mm", w: 35, h: 45 },
  { id: "pp_12x15", label: "Passport 1.2 × 1.5 in", unit: "in", w: 1.2, h: 1.5 },
];

const BG_SWATCHES: Array<{
  id: EnhanceBackgroundFill;
  label: string;
  swatch?: string;
}> = [
  { id: "transparent", label: "Transparent" },
  { id: "#FFFFFF", label: "Pure White", swatch: "#FFFFFF" },
  { id: "#1D63B8", label: "Studio Blue", swatch: "#1D63B8" },
  { id: "#CBE4F9", label: "Sky Blue", swatch: "#CBE4F9" },
  { id: "#E5E7EB", label: "Light Grey", swatch: "#E5E7EB" },
  { id: "custom", label: "Custom" },
];

const TOOL_TABS: Array<{
  id: EnhanceToolTab;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "upscale", label: "Upscale", icon: Maximize2 },
  { id: "sharpen", label: "Deblur", icon: Focus },
  { id: "background", label: "Background", icon: Eraser },
  { id: "face", label: "Face Beauty", icon: UserCheck },
  { id: "color", label: "Colour", icon: Sun },
  { id: "objects", label: "Objects", icon: Wand2 },
  { id: "export", label: "Print Export", icon: Printer },
];

const FACE_PRESETS: Array<{
  label: string;
  values: NaturalFaceRetouchOptions;
}> = [
  {
    label: "Natural Portrait",
    values: {
      smoothSkin: 48,
      removeBlemishes: 58,
      skinBrighten: 32,
      evenTone: 40,
      facialClarity: 38,
    },
  },
  {
    label: "Fair & Radiant Glow",
    values: {
      smoothSkin: 62,
      removeBlemishes: 65,
      skinBrighten: 68,
      evenTone: 55,
      facialClarity: 42,
    },
  },
  {
    label: "Clear Pimples & Spots",
    values: {
      smoothSkin: 52,
      removeBlemishes: 92,
      skinBrighten: 30,
      evenTone: 65,
      facialClarity: 35,
    },
  },
  {
    label: "Silky Studio Beauty",
    values: {
      smoothSkin: 78,
      removeBlemishes: 80,
      skinBrighten: 54,
      evenTone: 70,
      facialClarity: 50,
    },
  },
];

const COLOR_PRESETS: Array<{
  label: string;
  values: ColorLightingOptions;
}> = [
  {
    label: "Bright Portrait",
    values: {
      exposure: 18,
      shadows: 36,
      highlights: -14,
      brightness: 10,
      contrast: 12,
      warmth: 6,
      tint: 0,
      vibrance: 18,
    },
  },
  {
    label: "Vibrant HD",
    values: {
      exposure: 10,
      shadows: 24,
      highlights: -10,
      brightness: 4,
      contrast: 22,
      warmth: 4,
      tint: 0,
      vibrance: 42,
    },
  },
  {
    label: "Warm Glow",
    values: {
      exposure: 12,
      shadows: 26,
      highlights: -12,
      brightness: 6,
      contrast: 10,
      warmth: 24,
      tint: 4,
      vibrance: 22,
    },
  },
  {
    label: "Crisp Cool",
    values: {
      exposure: 8,
      shadows: 18,
      highlights: -8,
      brightness: 4,
      contrast: 18,
      warmth: -18,
      tint: -2,
      vibrance: 20,
    },
  },
];

const MAX_HISTORY_ENTRIES = 14;

function toPixels300(val: number, unit: "in" | "mm"): number {
  const safe = Number.isFinite(val) && val > 0 ? val : 1;
  return unit === "in"
    ? Math.round(safe * PRINT_PPI)
    : Math.round((safe / 25.4) * PRINT_PPI);
}

function formatInches300(px: number): string {
  return (px / PRINT_PPI).toFixed(1);
}

function isColorOptionsActive(c: ColorLightingOptions): boolean {
  return (
    c.exposure !== 0 ||
    c.shadows !== 0 ||
    c.highlights !== 0 ||
    c.brightness !== 0 ||
    c.contrast !== 0 ||
    c.warmth !== 0 ||
    c.tint !== 0 ||
    c.vibrance !== 0
  );
}

export function AiPhotoEnhanceStudio({
  onSendToPassport,
  onMailQuery,
}: AiPhotoEnhanceStudioProps) {
  // Core Image & Undo/Redo History State
  const [originalEntry, setOriginalEntry] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [cutoutAsset, setCutoutAsset] = useState<CutoutAsset | null>(null);

  // Preview Stage State (Before/After Slider + Zoom + Pan + Fitted Image Box)
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({
    w: 640,
    h: 480,
  });

  const panStartRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customBgInputRef = useRef<HTMLInputElement | null>(null);
  const addObjInputRef = useRef<HTMLInputElement | null>(null);

  // Upload & Camera State
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Active Tool Tab & Per-Tool Settings
  const [activeTool, setActiveTool] = useState<EnhanceToolTab>("upscale");
  const [upscaleMode, setUpscaleMode] = useState<UpscaleTargetMode>("hd");
  const [upscalePolish, setUpscalePolish] = useState<number>(42);

  const [deblurOpts, setDeblurOpts] = useState<DeblurSharpenOptions>({
    deblur: 58,
    sharpness: 48,
    denoise: 22,
  });

  const [bgChoice, setBgChoice] = useState<EnhanceBackgroundFill>("transparent");
  const [customBgHex, setCustomBgHex] = useState<string>("#1E3A8A");
  const [bgEdgeFeather, setBgEdgeFeather] = useState<number>(0.8);
  const [customBgImgUrl, setCustomBgImgUrl] = useState<string | null>(null);

  const [faceOpts, setFaceOpts] = useState<NaturalFaceRetouchOptions>({
    smoothSkin: 52,
    removeBlemishes: 62,
    skinBrighten: 38,
    evenTone: 45,
    facialClarity: 40,
  });

  const [colorOpts, setColorOpts] = useState<ColorLightingOptions>({
    ...DEFAULT_COLOR_LIGHTING_OPTIONS,
  });

  // TOOL F: Remove Any Object (Brush) & Add Any Object (Image / Text)
  const [objectSubMode, setObjectSubMode] = useState<ObjectSubMode>("remove");
  const [brushSizePx, setBrushSizePx] = useState<number>(38);
  const [brushStrokes, setBrushStrokes] = useState<BrushStroke[]>([]);
  const isDrawingMaskRef = useRef(false);
  const activeStrokeRef = useRef<BrushStroke | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [addKind, setAddKind] = useState<"image" | "text">("image");
  const [addedImgUrl, setAddedImgUrl] = useState<string | null>(null);
  const [addedImgBlob, setAddedImgBlob] = useState<Blob | null>(null);
  const [addedImgAspect, setAddedImgAspect] = useState<number>(1);
  const [addedText, setAddedText] = useState<string>("SUN-NOVA STUDIO");
  const [addedTextColor, setAddedTextColor] = useState<string>("#FFFFFF");
  const [addedTextBgEnabled, setAddedTextBgEnabled] = useState<boolean>(true);
  const [addedTextBgColor, setAddedTextBgColor] = useState<string>("#0F172A");
  const [objTransform, setObjTransform] = useState({
    xPct: 50,
    yPct: 50,
    scalePct: 75,
    rotationDeg: 0,
    opacity: 100,
    flipX: false,
    shadow: 35,
  });
  const [isDraggingAddedObj, setIsDraggingAddedObj] = useState(false);
  const objDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);

  // Print-Ready Export State
  const [exportFormat, setExportFormat] = useState<"jpeg" | "png">("jpeg");
  const [jpegQuality, setJpegQuality] = useState<number>(0.96);
  const [dimensionMode, setDimensionMode] = useState<
    "original" | "preset" | "custom"
  >("original");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("4x6");
  const [customUnit, setCustomUnit] = useState<"in" | "mm">("in");
  const [customW, setCustomW] = useState<number>(4);
  const [customH, setCustomH] = useState<number>(6);
  const [preserveAspectRatio, setPreserveAspectRatio] = useState<boolean>(true);

  // Async Progress, Status & Error States
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [activeBackendLabel, setActiveBackendLabel] = useState<string | null>(
    null
  );
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track created Object URLs for clean unmount disposal
  const managedUrlsRef = useRef<Set<string>>(new Set());

  const registerUrl = (url: string) => {
    managedUrlsRef.current.add(url);
    return url;
  };

  const releaseAllUrls = useCallback(() => {
    managedUrlsRef.current.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {
        // Ignore already-revoked URLs
      }
    });
    managedUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      releaseAllUrls();
    };
  }, [releaseAllUrls]);

  const currentEntry: HistoryEntry | null =
    historyIndex >= 0 && historyIndex < history.length
      ? history[historyIndex]
      : null;

  // Observe stage container size so image wrapper, brush canvas & object overlay match pixel-for-pixel
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        setStageSize({ w: rect.width, h: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentEntry?.id]);

  const fittedBox = useMemo(() => {
    if (!currentEntry || stageSize.w <= 0 || stageSize.h <= 0) {
      return { w: stageSize.w, h: stageSize.h };
    }
    const imgAspect = currentEntry.width / Math.max(1, currentEntry.height);
    const stageAspect = stageSize.w / Math.max(1, stageSize.h);
    if (imgAspect > stageAspect) {
      const w = stageSize.w;
      const h = w / imgAspect;
      return { w: Math.round(w), h: Math.round(h) };
    }
    const h = stageSize.h;
    const w = h * imgAspect;
    return { w: Math.round(w), h: Math.round(h) };
  }, [currentEntry, stageSize]);

  const isObjectsInteractive = activeTool === "objects" && Boolean(currentEntry);
  const canUndo = historyIndex > 0 && !isProcessing;
  const canRedo = historyIndex < history.length - 1 && !isProcessing;
  const hasEdits = historyIndex > 0;

  // Keyboard shortcuts for Undo / Redo (Ctrl+Z / Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          setHistoryIndex((idx) => Math.max(0, idx - 1));
          setNoticeMessage("Undid last enhancement step.");
        }
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        if (canRedo) {
          e.preventDefault();
          setHistoryIndex((idx) => Math.min(history.length - 1, idx + 1));
          setNoticeMessage("Redid enhancement step.");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, history.length]);

  const pushHistoryEntry = useCallback(
    (entry: Omit<HistoryEntry, "id">) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      registerUrl(newEntry.url);

      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const next = [...sliced, newEntry];
        if (next.length > MAX_HISTORY_ENTRIES) {
          return [
            next[0],
            ...next.slice(next.length - (MAX_HISTORY_ENTRIES - 1)),
          ];
        }
        return next;
      });
      setHistoryIndex((prevIdx) => {
        const nextLen = Math.min(MAX_HISTORY_ENTRIES, prevIdx + 2);
        return nextLen - 1;
      });
    },
    [historyIndex]
  );

  // Upload / Drop / Camera Ingestion
  const ingestPhotoBlob = useCallback(
    async (fileOrBlob: Blob, sourceLabel = "Original Photo") => {
      if (
        fileOrBlob instanceof File &&
        fileOrBlob.type &&
        !/^image\/(jpeg|jpg|png|webp)$/i.test(fileOrBlob.type)
      ) {
        setErrorMessage(
          "Unsupported file format. Please upload a JPG, JPEG, PNG, or WEBP photograph."
        );
        return;
      }

      try {
        setErrorMessage(null);
        setNoticeMessage(null);
        setIsProcessing(true);
        setProgressPct(25);
        setProgressStage("Preparing photograph safely in browser memory...");

        const prepared = await prepareSafeUploadedImage(fileOrBlob, 4096);
        registerUrl(prepared.url);

        const initial: HistoryEntry = {
          id: `orig-${Date.now()}`,
          label: sourceLabel,
          blob: prepared.blob,
          url: prepared.url,
          width: prepared.width,
          height: prepared.height,
          hasTransparency: false,
          bgAppliedHex: null,
        };

        setOriginalEntry(initial);
        setHistory([initial]);
        setHistoryIndex(0);
        setCutoutAsset(null);
        setBrushStrokes([]);
        setSplitPercent(50);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
        setColorOpts({ ...DEFAULT_COLOR_LIGHTING_OPTIONS });
        setBgChoice("transparent");
        setActiveBackendLabel(null);

        if (prepared.wasResizedForSafety) {
          setNoticeMessage(
            `Photo loaded safely at ${prepared.width}×${prepared.height} px (capped from very large raw size to keep browser processing fast).`
          );
        } else {
          setNoticeMessage(
            `Photo loaded (${prepared.width}×${prepared.height} px). Choose an AI enhancement tool on the right.`
          );
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not load this image file. Please try another JPG, PNG, or WEBP."
        );
      } finally {
        setIsProcessing(false);
        setProgressPct(0);
        setProgressStage("");
      }
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void ingestPhotoBlob(file, file.name);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void ingestPhotoBlob(file, file.name);
    }
  };

  const handleLoadSample = async () => {
    try {
      const res = await fetch(samplePortraitImg);
      const blob = await res.blob();
      await ingestPhotoBlob(blob, "Studio Sample Portrait");
    } catch {
      setErrorMessage("Could not load sample portrait.");
    }
  };

  const handleResetOriginal = () => {
    if (!originalEntry || isProcessing) return;
    setHistory([originalEntry]);
    setHistoryIndex(0);
    setCutoutAsset(null);
    setBrushStrokes([]);
    setColorOpts({ ...DEFAULT_COLOR_LIGHTING_OPTIONS });
    setBgChoice("transparent");
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSplitPercent(50);
    setErrorMessage(null);
    setNoticeMessage("Reset to original unedited photograph.");
  };

  // Interactive Draggable Before/After Split Pointer Logic
  const updateSplitFromClientX = useCallback((clientX: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    if (!isDraggingSplit) return;
    const onMove = (e: PointerEvent) => {
      updateSplitFromClientX(e.clientX);
    };
    const onUp = () => setIsDraggingSplit(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDraggingSplit, updateSplitFromClientX]);

  // Panning when zoomed > 100% (disabled while painting/dragging objects in Objects tab)
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1 || isDraggingSplit || isObjectsInteractive) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-split-handle='true']")) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: panOffset.x,
      oy: panOffset.y,
    };
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: PointerEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      setPanOffset({
        x: start.ox + (e.clientX - start.x),
        y: start.oy + (e.clientY - start.y),
      });
    };
    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isPanning]);

  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.max(0.5, Math.min(3, Number((prev + delta).toFixed(2))));
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  // ============================================================================
  // REMOVE OBJECT BRUSH MASK RENDERING & POINTER HANDLERS
  // ============================================================================

  const redrawMaskCanvas = useCallback(
    (strokes: BrushStroke[], liveStroke?: BrushStroke | null) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const minDim = Math.min(canvas.width, canvas.height);
      const drawOne = (st: BrushStroke) => {
        if (st.points.length === 0) return;
        const radiusPx = Math.max(4, st.sizeNorm * minDim);
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(244, 63, 94, 0.58)";
        ctx.fillStyle = "rgba(244, 63, 94, 0.58)";
        ctx.lineWidth = radiusPx;

        if (st.points.length === 1) {
          ctx.beginPath();
          ctx.arc(
            st.points[0].x * canvas.width,
            st.points[0].y * canvas.height,
            radiusPx / 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(
            st.points[0].x * canvas.width,
            st.points[0].y * canvas.height
          );
          for (let i = 1; i < st.points.length; i++) {
            ctx.lineTo(
              st.points[i].x * canvas.width,
              st.points[i].y * canvas.height
            );
          }
          ctx.stroke();
        }
        ctx.restore();
      };

      for (const s of strokes) drawOne(s);
      if (liveStroke) drawOne(liveStroke);
    },
    []
  );

  useEffect(() => {
    if (activeTool === "objects" && objectSubMode === "remove") {
      redrawMaskCanvas(brushStrokes, activeStrokeRef.current);
    }
  }, [activeTool, objectSubMode, brushStrokes, fittedBox, redrawMaskCanvas]);

  const getNormalizedPointerOnCanvas = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y, minRectDim: Math.min(rect.width, rect.height) };
  };

  const handleMaskPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isProcessing) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPointerOnCanvas(e);
    if (!pt) return;

    const sizeNorm = Math.max(0.015, brushSizePx / Math.max(80, pt.minRectDim));
    const stroke: BrushStroke = {
      sizeNorm,
      points: [{ x: pt.x, y: pt.y }],
    };
    isDrawingMaskRef.current = true;
    activeStrokeRef.current = stroke;
    redrawMaskCanvas(brushStrokes, stroke);
  };

  const handleMaskPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMaskRef.current || !activeStrokeRef.current) return;
    e.stopPropagation();
    const pt = getNormalizedPointerOnCanvas(e);
    if (!pt) return;
    activeStrokeRef.current.points.push({ x: pt.x, y: pt.y });
    redrawMaskCanvas(brushStrokes, activeStrokeRef.current);
  };

  const handleMaskPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMaskRef.current) return;
    e.stopPropagation();
    isDrawingMaskRef.current = false;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (finished && finished.points.length > 0) {
      setBrushStrokes((prev) => [...prev, finished]);
    }
  };

  // ============================================================================
  // ADD OBJECT DRAG POSITIONING ON PREVIEW STAGE
  // ============================================================================

  const handleAddedObjPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isProcessing) return;
    e.stopPropagation();
    setIsDraggingAddedObj(true);
    objDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startXPct: objTransform.xPct,
      startYPct: objTransform.yPct,
    };
  };

  useEffect(() => {
    if (!isDraggingAddedObj) return;
    const onMove = (e: PointerEvent) => {
      const box = imageBoxRef.current;
      const start = objDragStartRef.current;
      if (!box || !start) return;
      const rect = box.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dxPct = ((e.clientX - start.clientX) / rect.width) * 100;
      const dyPct = ((e.clientY - start.clientY) / rect.height) * 100;
      setObjTransform((prev) => ({
        ...prev,
        xPct: Math.max(2, Math.min(98, Number((start.startXPct + dxPct).toFixed(1)))),
        yPct: Math.max(2, Math.min(98, Number((start.startYPct + dyPct).toFixed(1)))),
      }));
    };
    const onUp = () => {
      setIsDraggingAddedObj(false);
      objDragStartRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDraggingAddedObj]);

  // ============================================================================
  // TOOL EXECUTION HANDLERS
  // ============================================================================

  // A. Genuine In-Browser Open-Source Real-ESRGAN Upscaling + Detail Polish
  const handleRunUpscale = async () => {
    if (!currentEntry || isProcessing) return;
    try {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsProcessing(true);
      setProgressPct(5);
      setProgressStage("Loading open-source ESRGAN neural super-resolution model...");

      const img = await loadImageFromUrl(currentEntry.url);
      const res = await runNeuralEsrganUpscale(
        img,
        upscaleMode,
        currentEntry.hasTransparency,
        (pct, stage, backend) => {
          setProgressPct(pct);
          setProgressStage(stage);
          if (backend) setActiveBackendLabel(backend);
        },
        upscalePolish
      );

      const url = URL.createObjectURL(res.blob);
      pushHistoryEntry({
        label: `AI ${upscaleMode === "4k" ? "4K (4×)" : "HD (2×)"} ESRGAN Upscale`,
        blob: res.blob,
        url,
        width: res.width,
        height: res.height,
        hasTransparency: currentEntry.hasTransparency,
        bgAppliedHex: currentEntry.bgAppliedHex,
      });

      setNoticeMessage(
        `AI ESRGAN ${res.scaleFactor}× upscaling finished (${res.width}×${res.height} px via ${res.backend}). Zoom in or drag the slider to inspect crisp details.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "AI ESRGAN neural upscaling is currently unavailable in this browser."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // B. Resolution-Adaptive Blur Removal & Sharpening
  const handleApplyDeblurSharpen = async () => {
    if (!currentEntry || isProcessing) return;
    if (
      deblurOpts.deblur === 0 &&
      deblurOpts.sharpness === 0 &&
      deblurOpts.denoise === 0
    ) {
      setErrorMessage("Move at least one slider above 0% before applying.");
      return;
    }
    try {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsProcessing(true);
      setProgressPct(8);
      setProgressStage("Running resolution-adaptive blur recovery & sharpening...");

      const img = await loadImageFromUrl(currentEntry.url);
      const blob = await runDeblurAndSharpen(
        img,
        deblurOpts,
        currentEntry.hasTransparency,
        (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
        }
      );

      const url = URL.createObjectURL(blob);
      pushHistoryEntry({
        label: "Deblur & Crisp Sharpening",
        blob,
        url,
        width: currentEntry.width,
        height: currentEntry.height,
        hasTransparency: currentEntry.hasTransparency,
        bgAppliedHex: currentEntry.bgAppliedHex,
      });
      setNoticeMessage(
        "Blur removal, edge-preserving denoise, and crisp sharpening applied at full resolution."
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not apply sharpening."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // C. Neural Background Removal & Replacement (Solid Colour or Custom Background Image)
  const resolveSelectedBgHex = (choice: EnhanceBackgroundFill): string | null => {
    if (choice === "transparent" || choice === "image") return null;
    if (choice === "custom") return customBgHex;
    return choice;
  };

  const compositeFromCutout = async (
    asset: CutoutAsset,
    choice: EnhanceBackgroundFill,
    hexOverride?: string,
    bgImageUrlOverride?: string | null,
    featherOverride?: number
  ) => {
    const cutoutImg = await loadImageFromUrl(asset.url);
    const feather = featherOverride ?? bgEdgeFeather;

    if (choice === "image") {
      const targetUrl = bgImageUrlOverride ?? customBgImgUrl;
      if (!targetUrl) {
        throw new Error("Please upload a custom background photo first.");
      }
      const bgImg = await loadImageFromUrl(targetUrl);
      const composited = await compositeBackgroundFill(cutoutImg, null, {
        bgImage: bgImg,
        edgeFeatherPx: feather,
      });
      const url = URL.createObjectURL(composited);
      pushHistoryEntry({
        label: "Custom Background Photo",
        blob: composited,
        url,
        width: asset.width,
        height: asset.height,
        hasTransparency: false,
        bgAppliedHex: "#FFFFFF",
      });
      setNoticeMessage("Replaced background cleanly with your custom photo.");
      return;
    }

    const fillHex =
      choice === "transparent"
        ? null
        : choice === "custom"
          ? hexOverride || customBgHex
          : choice;

    const composited = await compositeBackgroundFill(cutoutImg, fillHex, {
      edgeFeatherPx: feather,
    });
    const url = URL.createObjectURL(composited);

    pushHistoryEntry({
      label: fillHex ? `Background Fill (${fillHex})` : "Transparent Background",
      blob: composited,
      url,
      width: asset.width,
      height: asset.height,
      hasTransparency: !fillHex,
      bgAppliedHex: fillHex,
    });

    if (!fillHex) setExportFormat("png");
    setNoticeMessage(
      fillHex
        ? `Background updated to ${fillHex} cleanly from neural cutout.`
        : "Restored transparent PNG cutout cleanly."
    );
  };

  const handleRemoveBackground = async () => {
    if (!currentEntry || isProcessing) return;
    try {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsProcessing(true);
      setProgressPct(6);
      setProgressStage("Initializing on-device neural background segmentation...");

      const transparentBlob = await runNeuralBackgroundRemoval(
        currentEntry.blob,
        (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
          setActiveBackendLabel("ONNX Neural");
        }
      );

      const cutoutUrl = registerUrl(URL.createObjectURL(transparentBlob));
      const cutoutImg = await loadImageFromUrl(cutoutUrl);
      const nextCutout: CutoutAsset = {
        blob: transparentBlob,
        url: cutoutUrl,
        width: cutoutImg.naturalWidth || currentEntry.width,
        height: cutoutImg.naturalHeight || currentEntry.height,
      };
      setCutoutAsset(nextCutout);

      const effectiveChoice =
        bgChoice === "image" && !customBgImgUrl ? "transparent" : bgChoice;
      await compositeFromCutout(nextCutout, effectiveChoice);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Neural background removal could not complete on this image."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  const handleApplyBackgroundColor = async (
    choice: EnhanceBackgroundFill,
    hexOverride?: string
  ) => {
    setBgChoice(choice);
    if (!cutoutAsset || isProcessing) return;
    try {
      setErrorMessage(null);
      await compositeFromCutout(cutoutAsset, choice, hexOverride);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not update background."
      );
    }
  };

  const handleCustomBgImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setErrorMessage(null);
      const url = registerUrl(URL.createObjectURL(file));
      setCustomBgImgUrl(url);
      setBgChoice("image");
      if (cutoutAsset && !isProcessing) {
        await compositeFromCutout(cutoutAsset, "image", undefined, url);
      } else {
        setNoticeMessage(
          "Custom background photo loaded. Click 'Remove Background (AI Neural)' above to place your subject on it."
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not load background photo."
      );
    }
  };

  // D. Studio Face & Image Beauty Skin Enhance
  const handleApplyFaceRetouch = async () => {
    if (!currentEntry || isProcessing) return;
    if (
      faceOpts.smoothSkin === 0 &&
      faceOpts.removeBlemishes === 0 &&
      faceOpts.skinBrighten === 0 &&
      faceOpts.evenTone === 0 &&
      faceOpts.facialClarity === 0
    ) {
      setErrorMessage("Move at least one beauty skin slider above 0%.");
      return;
    }
    try {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsProcessing(true);
      setProgressPct(10);
      setProgressStage("Applying studio beauty skin enhancement...");

      const img = await loadImageFromUrl(currentEntry.url);
      const blob = await runNaturalFaceRetouch(
        img,
        faceOpts,
        currentEntry.hasTransparency,
        (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
        }
      );

      const url = URL.createObjectURL(blob);
      pushHistoryEntry({
        label: "Face & Beauty Skin Enhance",
        blob,
        url,
        width: currentEntry.width,
        height: currentEntry.height,
        hasTransparency: currentEntry.hasTransparency,
        bgAppliedHex: currentEntry.bgAppliedHex,
      });
      setNoticeMessage(
        "Skin smoothing, blemish healing, fair studio glow, even tone, and eye clarity applied cleanly."
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not apply face enhancement."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // E. Colour & Lighting Correction
  const handleAutoAnalyzeColor = async () => {
    if (!currentEntry || isProcessing) return;
    try {
      setErrorMessage(null);
      const img = await loadImageFromUrl(currentEntry.url);
      const suggested = analyzeAutoColorCorrection(img);
      setColorOpts(suggested);
      setNoticeMessage(
        "Auto studio exposure, shadows, highlights, white balance, and vibrance calculated. Preview live or click Apply Colour & Lighting."
      );
    } catch {
      setErrorMessage("Could not analyze image histogram.");
    }
  };

  const handleApplyColorLighting = async (overrideOpts?: ColorLightingOptions) => {
    if (!currentEntry || isProcessing) return;
    const opts = overrideOpts ?? colorOpts;
    if (!isColorOptionsActive(opts)) {
      setErrorMessage(
        "Click Auto Correct, pick a preset, or adjust any slider before applying."
      );
      return;
    }
    try {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsProcessing(true);
      setProgressPct(15);
      setProgressStage("Applying full-resolution colour & lighting correction...");

      const img = await loadImageFromUrl(currentEntry.url);
      const blob = await runColorAndLightingCorrection(
        img,
        opts,
        currentEntry.hasTransparency,
        (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
        }
      );

      const url = URL.createObjectURL(blob);
      pushHistoryEntry({
        label: "Colour & Lighting Fix",
        blob,
        url,
        width: currentEntry.width,
        height: currentEntry.height,
        hasTransparency: currentEntry.hasTransparency,
        bgAppliedHex: currentEntry.bgAppliedHex,
      });
      setColorOpts({ ...DEFAULT_COLOR_LIGHTING_OPTIONS });
      setNoticeMessage(
        "Exposure, shadows, highlights, white balance, and colour vibrance applied at full resolution."
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not apply colour correction."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // F1. Remove Any Painted Object (Multi-Scale Inpainting)
  const handleRunObjectRemoval = async () => {
    if (!currentEntry || isProcessing) return;
    if (brushStrokes.length === 0) {
      setErrorMessage(
        "Paint over the unwanted object on the preview photo using the brush first."
      );
      return;
    }
    try {
      setErrorMessage(null);
      setNoticeMessage(null);
      setIsProcessing(true);
      setProgressPct(8);
      setProgressStage("Preparing painted mask for object removal...");

      // Render crisp full-aspect mask canvas from normalized strokes
      const maskCanvas = document.createElement("canvas");
      const maskScale = Math.min(
        1,
        1600 / Math.max(currentEntry.width, currentEntry.height)
      );
      maskCanvas.width = Math.max(32, Math.round(currentEntry.width * maskScale));
      maskCanvas.height = Math.max(32, Math.round(currentEntry.height * maskScale));
      const mCtx = maskCanvas.getContext("2d");
      if (!mCtx) throw new Error("Mask canvas unavailable.");

      const minDim = Math.min(maskCanvas.width, maskCanvas.height);
      for (const st of brushStrokes) {
        if (st.points.length === 0) continue;
        const radiusPx = Math.max(4, st.sizeNorm * minDim);
        mCtx.lineCap = "round";
        mCtx.lineJoin = "round";
        mCtx.strokeStyle = "#FF0000";
        mCtx.fillStyle = "#FF0000";
        mCtx.lineWidth = radiusPx;
        if (st.points.length === 1) {
          mCtx.beginPath();
          mCtx.arc(
            st.points[0].x * maskCanvas.width,
            st.points[0].y * maskCanvas.height,
            radiusPx / 2,
            0,
            Math.PI * 2
          );
          mCtx.fill();
        } else {
          mCtx.beginPath();
          mCtx.moveTo(
            st.points[0].x * maskCanvas.width,
            st.points[0].y * maskCanvas.height
          );
          for (let i = 1; i < st.points.length; i++) {
            mCtx.lineTo(
              st.points[i].x * maskCanvas.width,
              st.points[i].y * maskCanvas.height
            );
          }
          mCtx.stroke();
        }
      }

      const img = await loadImageFromUrl(currentEntry.url);
      const blob = await runObjectRemovalInpaint(
        img,
        maskCanvas,
        currentEntry.hasTransparency,
        (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
        }
      );

      const url = URL.createObjectURL(blob);
      pushHistoryEntry({
        label: "Object Removed (Magic Erase)",
        blob,
        url,
        width: currentEntry.width,
        height: currentEntry.height,
        hasTransparency: currentEntry.hasTransparency,
        bgAppliedHex: currentEntry.bgAppliedHex,
      });
      setBrushStrokes([]);
      setNoticeMessage(
        "Painted object removed and background reconstructed cleanly. Paint again to refine any spot."
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not remove object."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // F2. Add Any Object (Upload Image / Optional AI Cutout / Add Text Stamp)
  const handleUploadAddedObject = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setErrorMessage(null);
      const url = registerUrl(URL.createObjectURL(file));
      const img = await loadImageFromUrl(url);
      const aspect =
        (img.naturalWidth || img.width) /
        Math.max(1, img.naturalHeight || img.height);
      setAddedImgUrl(url);
      setAddedImgBlob(file);
      setAddedImgAspect(aspect);
      setAddKind("image");
      setObjTransform({
        xPct: 50,
        yPct: 50,
        scalePct: 75,
        rotationDeg: 0,
        opacity: 100,
        flipX: false,
        shadow: 35,
      });
      setNoticeMessage(
        "Object loaded! Drag it directly on the photo, resize/rotate, or click 'Remove BG on Object' for a clean cutout."
      );
    } catch {
      setErrorMessage("Could not load object image file.");
    }
  };

  const handleRemoveBgOnAddedObject = async () => {
    if (!addedImgBlob || isProcessing) return;
    try {
      setErrorMessage(null);
      setIsProcessing(true);
      setProgressPct(8);
      setProgressStage("Removing background from added object...");
      const cutoutBlob = await runNeuralBackgroundRemoval(
        addedImgBlob,
        (pct, stage) => {
          setProgressPct(pct);
          setProgressStage(stage);
          setActiveBackendLabel("ONNX Neural");
        }
      );
      const url = registerUrl(URL.createObjectURL(cutoutBlob));
      setAddedImgUrl(url);
      setAddedImgBlob(cutoutBlob);
      setNoticeMessage("Added object background removed! Drag & position freely.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not remove background from object."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  const handleApplyAddedObject = async () => {
    if (!currentEntry || isProcessing) return;
    if (addKind === "image" && !addedImgUrl) {
      setErrorMessage("Upload an object, logo, or sticker image first.");
      return;
    }
    if (addKind === "text" && !addedText.trim()) {
      setErrorMessage("Enter text or stamp wording before applying.");
      return;
    }
    try {
      setErrorMessage(null);
      setIsProcessing(true);
      setProgressPct(45);
      setProgressStage("Compositing object cleanly at full resolution...");

      const baseImg = await loadImageFromUrl(currentEntry.url);
      const objImg =
        addKind === "image" && addedImgUrl
          ? await loadImageFromUrl(addedImgUrl)
          : null;

      const spec: AddedObjectSpec = {
        kind: addKind,
        image: objImg,
        text: addedText,
        textColor: addedTextColor,
        textBgColor: addedTextBgEnabled ? addedTextBgColor : null,
        ...objTransform,
      };

      const blob = await compositeAddedObject(
        baseImg,
        spec,
        currentEntry.hasTransparency
      );
      const url = URL.createObjectURL(blob);
      pushHistoryEntry({
        label: addKind === "image" ? "Added Object Overlay" : "Added Text Stamp",
        blob,
        url,
        width: currentEntry.width,
        height: currentEntry.height,
        hasTransparency: currentEntry.hasTransparency,
        bgAppliedHex: currentEntry.bgAppliedHex,
      });
      setNoticeMessage(
        addKind === "image"
          ? "Object baked cleanly into photograph! You can undo anytime or add another."
          : "Text/stamp baked cleanly into photograph!"
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not add object to photo."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // Live CSS filter preview when user adjusts Colour & Lighting sliders before baking
  const liveColorCssFilter = useMemo(() => {
    if (!isColorOptionsActive(colorOpts)) return undefined;
    const shadowLiftBoost = colorOpts.shadows * 0.0028;
    const highlightBoost = colorOpts.highlights * 0.0014;
    const bright = Math.max(
      0.35,
      1 +
        colorOpts.exposure * 0.0052 +
        colorOpts.brightness * 0.008 +
        shadowLiftBoost +
        highlightBoost
    );
    const contrast = Math.max(
      0.4,
      1 + colorOpts.contrast * 0.0115 - Math.max(0, colorOpts.shadows) * 0.0016
    );
    const sat = Math.max(0.2, 1 + colorOpts.vibrance * 0.0095);
    const sepia =
      colorOpts.warmth > 0 ? Math.min(0.32, colorOpts.warmth * 0.005) : 0;
    const hueRotate =
      colorOpts.warmth < 0 ? colorOpts.warmth * 0.28 : colorOpts.tint * 0.35;
    return `brightness(${bright.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${sat.toFixed(3)}) sepia(${sepia.toFixed(3)}) hue-rotate(${hueRotate.toFixed(1)}deg)`;
  }, [colorOpts]);

  // Compute Print Export Target Dimensions
  const resolvedPrintTarget = useMemo(() => {
    if (!currentEntry) {
      return { w: 0, h: 0, label: "No photo" };
    }
    if (dimensionMode === "original") {
      return {
        w: currentEntry.width,
        h: currentEntry.height,
        label: `Original (${currentEntry.width} × ${currentEntry.height} px)`,
      };
    }

    let rawW = currentEntry.width;
    let rawH = currentEntry.height;

    if (dimensionMode === "preset") {
      const preset =
        PRINT_PRESETS.find((p) => p.id === selectedPresetId) || PRINT_PRESETS[0];
      rawW = toPixels300(preset.w, preset.unit);
      rawH = toPixels300(preset.h, preset.unit);
    } else {
      rawW = toPixels300(customW, customUnit);
      rawH = toPixels300(customH, customUnit);
    }

    if (preserveAspectRatio) {
      const aspect = currentEntry.width / Math.max(1, currentEntry.height);
      const lockedH = Math.max(64, Math.round(rawW / aspect));
      return {
        w: rawW,
        h: lockedH,
        label: `${rawW} × ${lockedH} px (aspect locked)`,
      };
    }

    return {
      w: rawW,
      h: rawH,
      label: `${rawW} × ${rawH} px`,
    };
  }, [
    currentEntry,
    dimensionMode,
    selectedPresetId,
    customW,
    customH,
    customUnit,
    preserveAspectRatio,
  ]);

  // Bake un-applied colour sliders if user clicks Download or Send to Passport directly
  const getCommittedBlobAndImage = async (): Promise<{
    blob: Blob;
    img: HTMLImageElement;
  }> => {
    if (!currentEntry) throw new Error("Upload a photo first.");
    const baseImg = await loadImageFromUrl(currentEntry.url);
    if (!isColorOptionsActive(colorOpts)) {
      return { blob: currentEntry.blob, img: baseImg };
    }
    const bakedBlob = await runColorAndLightingCorrection(
      baseImg,
      colorOpts,
      currentEntry.hasTransparency
    );
    const bakedUrl = URL.createObjectURL(bakedBlob);
    try {
      const bakedImg = await loadImageFromUrl(bakedUrl);
      return { blob: bakedBlob, img: bakedImg };
    } finally {
      URL.revokeObjectURL(bakedUrl);
    }
  };

  // Download 300 PPI Print-Ready JPG or PNG
  const handleDownloadEnhanced = async () => {
    if (!currentEntry || isProcessing) return;
    try {
      setErrorMessage(null);
      setIsProcessing(true);
      setProgressPct(45);
      setProgressStage("Encoding true 300 PPI print-ready file...");

      const { img } = await getCommittedBlobAndImage();
      const exported = await exportPrintReadyPhoto(img, {
        format: exportFormat,
        jpegQuality,
        dimensionMode,
        targetWidthPx: resolvedPrintTarget.w,
        targetHeightPx: resolvedPrintTarget.h,
        preserveAspectRatio,
        backgroundFillHex: currentEntry.bgAppliedHex || "#FFFFFF",
      });

      const dlUrl = URL.createObjectURL(exported.blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      const ext = exportFormat === "jpeg" ? "jpg" : "png";
      a.download = `SUN-NOVA-AI-Enhanced-${exported.width}x${exported.height}-300ppi.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1500);

      setNoticeMessage(
        `Downloaded 300 PPI ${exportFormat.toUpperCase()} (${exported.width}×${exported.height} px · ${(
          exported.blob.size / 1024
        ).toFixed(0)} KB).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not export enhanced photo."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  // Send Enhanced Photo Directly to Passport Photo Studio & Sheet Layout
  const handleSendToPassportStudio = async () => {
    if (!currentEntry || isProcessing) return;
    try {
      setIsProcessing(true);
      setProgressPct(60);
      setProgressStage("Sending enhanced photo to Passport Photo Studio...");
      const { blob } = await getCommittedBlobAndImage();
      onSendToPassport(
        blob,
        `Enhanced ${currentEntry.width}×${currentEntry.height} px`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not send photo to Passport Photo Studio."
      );
    } finally {
      setIsProcessing(false);
      setProgressPct(0);
      setProgressStage("");
    }
  };

  const predictedHd = currentEntry
    ? computePredictedUpscaleSize(currentEntry.width, currentEntry.height, "hd")
    : null;
  const predicted4k = currentEntry
    ? computePredictedUpscaleSize(currentEntry.width, currentEntry.height, "4k")
    : null;

  // Preview size in screen px for Added Object inside fittedBox
  const previewObjRefPx =
    Math.min(fittedBox.w, fittedBox.h) * 0.42 * (objTransform.scalePct / 100);
  const previewObjDims = useMemo(() => {
    if (addedImgAspect >= 1) {
      return {
        w: Math.max(24, previewObjRefPx),
        h: Math.max(24, previewObjRefPx / Math.max(0.1, addedImgAspect)),
      };
    }
    return {
      w: Math.max(24, previewObjRefPx * addedImgAspect),
      h: Math.max(24, previewObjRefPx),
    };
  }, [previewObjRefPx, addedImgAspect]);

  const showSplitCompare = !isObjectsInteractive;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={customBgInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleCustomBgImageUpload}
        className="hidden"
      />
      <input
        ref={addObjInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleUploadAddedObject}
        className="hidden"
      />

      {/* Top Studio Header & Editing Toolbar */}
      <div className="bg-[#111827]/90 backdrop-blur-xl border border-[#00E5FF]/20 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-[#F5F7FA] tracking-tight">
              AI Photo Enhance Studio
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              100% browser-private AI restoration · Beauty skin enhance · Remove
              &amp; add objects · 300 PPI print export
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#161D2B] border border-[#00E5FF]/30 hover:border-[#00E5FF] text-[#F5F7FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 min-h-[38px]"
            >
              <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>{currentEntry ? "Change Photo" : "Upload Photo"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 text-[#F5F7FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 min-h-[38px]"
            >
              <Camera className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Camera</span>
            </button>

            {currentEntry && (
              <>
                <div className="h-5 w-px bg-[#00E5FF]/15 mx-0.5 hidden sm:block" />

                <button
                  type="button"
                  onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg bg-[#161D2B] border border-white/10 hover:border-[#00E5FF]/50 text-[#F5F7FA] disabled:opacity-35 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[38px]"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Undo</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setHistoryIndex((i) => Math.min(history.length - 1, i + 1))
                  }
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  aria-label="Redo"
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg bg-[#161D2B] border border-white/10 hover:border-[#00E5FF]/50 text-[#F5F7FA] disabled:opacity-35 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[38px]"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Redo</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetOriginal}
                  disabled={!hasEdits || isProcessing}
                  title="Reset to original photo"
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg bg-[#161D2B] border border-white/10 hover:border-amber-400/50 text-[#E2E8F0] disabled:opacity-35 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[38px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadEnhanced}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] hover:brightness-110 disabled:opacity-45 transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[38px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download 300 PPI</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Unboxed Tabular Metadata Line */}
        {currentEntry && originalEntry && (
          <div className="mt-3 pt-2.5 border-t border-[#00E5FF]/12 flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono-nums">
              <span>
                Original: {originalEntry.width}×{originalEntry.height} px
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#F5F7FA] font-semibold">
                Enhanced: {currentEntry.width}×{currentEntry.height} px
              </span>
              <span aria-hidden="true">·</span>
              <span>
                300 PPI Print: {formatInches300(currentEntry.width)}×
                {formatInches300(currentEntry.height)} in
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#00E5FF]">
                Step {historyIndex + 1}/{history.length}: {currentEntry.label}
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => adjustZoom(-0.25)}
                disabled={zoomLevel <= 0.5}
                aria-label="Zoom out"
                className="p-1.5 rounded-md bg-[#080B12] border border-[#00E5FF]/20 hover:border-[#00E5FF]/60 text-[#E2E8F0] disabled:opacity-35 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="px-2 py-1 text-[11px] font-mono-nums font-semibold rounded-md bg-[#080B12] border border-[#00E5FF]/20 hover:border-[#00E5FF]/60 text-[#F5F7FA] cursor-pointer min-w-[52px]"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={() => adjustZoom(0.25)}
                disabled={zoomLevel >= 3}
                aria-label="Zoom in"
                className="p-1.5 rounded-md bg-[#080B12] border border-[#00E5FF]/20 hover:border-[#00E5FF]/60 text-[#E2E8F0] disabled:opacity-35 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback & Error Notices */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs rounded-xl px-4 py-3"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {noticeMessage && !errorMessage && (
        <div
          role="status"
          className="flex items-start gap-2.5 bg-emerald-950/45 border border-emerald-500/35 text-emerald-200 text-xs rounded-xl px-4 py-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{noticeMessage}</span>
        </div>
      )}

      {/* Main Responsive Workbench: Left Large Preview Stage + Right Tool & Export Dock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT: Large Preview & Interactive Stage */}
        <div className="lg:col-span-7 xl:col-span-8 bg-[#111827]/90 backdrop-blur-xl border border-[#00E5FF]/20 rounded-2xl p-3 sm:p-4">
          {!currentEntry || !originalEntry ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`min-h-[380px] sm:min-h-[480px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 sm:p-10 transition-colors ${
                isDragOver
                  ? "border-[#00E5FF] bg-[#00E5FF]/10"
                  : "border-[#00E5FF]/25 bg-[#080B12]/75 hover:border-[#00E5FF]/50"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#161D2B] border border-[#00E5FF]/30 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-[#00E5FF]" />
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#F5F7FA] max-w-md">
                Drop a photograph to enhance at 300 PPI print quality
              </h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mt-2 leading-relaxed">
                Upscale to HD/4K with ESRGAN, recover blur, remove &amp; replace
                backgrounds, apply beauty skin retouching, fix colours, and
                erase or add objects—all privately inside your browser.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs sm:text-sm font-bold hover:brightness-110 transition-all cursor-pointer min-h-[44px]"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/30 hover:border-[#00E5FF] text-[#F5F7FA] text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  <Camera className="w-4 h-4 text-[#00E5FF]" />
                  <span>Camera Capture</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLoadSample()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161D2B] border border-white/15 hover:border-[#8B5CF6] text-[#E2E8F0] text-xs sm:text-sm font-medium transition-colors cursor-pointer min-h-[44px]"
                >
                  <ImageIcon className="w-4 h-4 text-[#8B5CF6]" />
                  <span>Try Sample Photo</span>
                </button>
              </div>

              <div className="mt-6 flex items-center gap-2 text-[11px] text-[#94A3B8]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Original photos stay strictly on your device · Zero external
                  uploads · No API key required
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Interactive Comparison / Paint / Object Viewport */}
              <div
                ref={stageRef}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onPointerDown={handleStagePointerDown}
                className={`relative w-full h-[360px] sm:h-[480px] lg:h-[540px] rounded-xl overflow-hidden border select-none flex items-center justify-center ${
                  isDragOver ? "border-[#00E5FF]" : "border-[#00E5FF]/20"
                } ${
                  !isObjectsInteractive && zoomLevel > 1
                    ? isPanning
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-default"
                }`}
                style={{
                  backgroundColor: "#080B12",
                  backgroundImage:
                    "linear-gradient(45deg, #111827 25%, transparent 25%), linear-gradient(-45deg, #111827 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #111827 75%), linear-gradient(-45deg, transparent 75%, #111827 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}
              >
                {/* Synchronized Zoom & Pan Layer */}
                <div
                  className="flex items-center justify-center transition-transform duration-75"
                  style={{
                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
                    transformOrigin: "center center",
                  }}
                >
                  {/* Exact-Fitted Image Box (Pixel-synchronized for Split, Brush Canvas & Added Object) */}
                  <div
                    ref={imageBoxRef}
                    className="relative overflow-hidden"
                    style={{
                      width: `${fittedBox.w}px`,
                      height: `${fittedBox.h}px`,
                    }}
                  >
                    {/* Base Layer: Enhanced Result */}
                    <img
                      src={currentEntry.url}
                      alt="Enhanced photograph preview"
                      draggable={false}
                      style={{ filter: liveColorCssFilter }}
                      className="w-full h-full object-fill pointer-events-none block"
                    />

                    {/* Clipped Overlay Layer: Original Untouched Photograph */}
                    {showSplitCompare && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                        }}
                      >
                        <img
                          src={originalEntry.url}
                          alt="Original photograph preview"
                          draggable={false}
                          className="w-full h-full object-fill pointer-events-none block"
                        />
                      </div>
                    )}

                    {/* TOOL F1: Interactive Remove Object Brush Canvas */}
                    {isObjectsInteractive && objectSubMode === "remove" && (
                      <canvas
                        ref={maskCanvasRef}
                        width={Math.max(100, fittedBox.w)}
                        height={Math.max(100, fittedBox.h)}
                        onPointerDown={handleMaskPointerDown}
                        onPointerMove={handleMaskPointerMove}
                        onPointerUp={handleMaskPointerUp}
                        onPointerCancel={handleMaskPointerUp}
                        className="absolute inset-0 w-full h-full touch-none cursor-crosshair z-20"
                      />
                    )}

                    {/* TOOL F2: Live Draggable Add Object / Text Overlay Preview */}
                    {isObjectsInteractive &&
                      objectSubMode === "add" &&
                      ((addKind === "image" && addedImgUrl) ||
                        (addKind === "text" && addedText.trim())) && (
                        <div
                          onPointerDown={handleAddedObjPointerDown}
                          style={{
                            left: `${objTransform.xPct}%`,
                            top: `${objTransform.yPct}%`,
                            opacity: objTransform.opacity / 100,
                            transform: `translate(-50%, -50%) rotate(${objTransform.rotationDeg}deg) scaleX(${objTransform.flipX ? -1 : 1})`,
                            filter:
                              objTransform.shadow > 0
                                ? `drop-shadow(0 ${Math.round(
                                    2 + objTransform.shadow * 0.08
                                  )}px ${Math.round(
                                    4 + objTransform.shadow * 0.16
                                  )}px rgba(0,0,0,${(
                                    0.28 +
                                    (objTransform.shadow / 100) * 0.45
                                  ).toFixed(2)}))`
                                : undefined,
                          }}
                          className="absolute z-20 cursor-move touch-none ring-1 ring-dashed ring-[#00E5FF]/85 rounded-md p-0.5"
                          title="Drag to position object"
                        >
                          {addKind === "image" && addedImgUrl ? (
                            <img
                              src={addedImgUrl}
                              alt="Added object preview"
                              draggable={false}
                              style={{
                                width: `${previewObjDims.w}px`,
                                height: `${previewObjDims.h}px`,
                              }}
                              className="block object-contain pointer-events-none select-none"
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: `${Math.max(
                                  12,
                                  Math.round(previewObjRefPx * 0.24)
                                )}px`,
                                color: addedTextColor,
                                backgroundColor: addedTextBgEnabled
                                  ? addedTextBgColor
                                  : "transparent",
                                padding: addedTextBgEnabled
                                  ? "0.28em 0.6em"
                                  : "0.1em 0.2em",
                                borderRadius: "0.35em",
                              }}
                              className="font-bold whitespace-nowrap leading-tight pointer-events-none select-none"
                            >
                              {addedText}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </div>

                {/* Draggable Split Divider Line & Handle (hidden while painting/placing objects) */}
                {showSplitCompare && (
                  <div
                    data-split-handle="true"
                    role="slider"
                    tabIndex={0}
                    aria-label="Before and after comparison slider"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(splitPercent)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingSplit(true);
                      updateSplitFromClientX(e.clientX);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        setSplitPercent((v) => Math.max(0, v - 5));
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        setSplitPercent((v) => Math.min(100, v + 5));
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        setSplitPercent(0);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        setSplitPercent(100);
                      }
                    }}
                    style={{ left: `${splitPercent}%` }}
                    className="absolute inset-y-0 -translate-x-1/2 w-10 flex items-center justify-center cursor-ew-resize touch-none z-20 focus:outline-none group"
                  >
                    <div className="w-0.5 h-full bg-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.85)]" />
                    <div className="absolute w-9 h-9 rounded-full bg-[#080B12]/90 border-2 border-[#00E5FF] text-[#00E5FF] flex items-center justify-center shadow-[0_4px_18px_rgba(0,0,0,0.65)] group-focus-visible:ring-2 group-focus-visible:ring-[#8B5CF6]">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Subtle Corner Labels */}
                {showSplitCompare ? (
                  <>
                    <div className="pointer-events-none absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-[#080B12]/75 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-[#E2E8F0]">
                      Before · Original
                    </div>
                    <div className="pointer-events-none absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-[#080B12]/75 backdrop-blur-md border border-[#00E5FF]/30 text-[11px] font-semibold text-[#00E5FF]">
                      After · Enhanced
                    </div>
                  </>
                ) : (
                  <div className="pointer-events-none absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-[#080B12]/80 backdrop-blur-md border border-[#00E5FF]/35 text-[11px] font-semibold text-[#00E5FF]">
                    {objectSubMode === "remove"
                      ? "Magic Eraser Active · Paint over unwanted object"
                      : "Add Object Active · Drag object to reposition"}
                  </div>
                )}

                {/* Real-Time Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 z-30 bg-[#080B12]/82 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                    <Loader2 className="w-8 h-8 text-[#00E5FF] animate-spin mb-3" />
                    <p className="text-sm font-bold text-[#F5F7FA]">
                      {progressStage || "Processing photograph..."}
                    </p>
                    <div className="w-full max-w-xs h-2 bg-[#161D2B] rounded-full overflow-hidden mt-3 border border-[#00E5FF]/20">
                      <div
                        className="h-full bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] transition-all duration-150"
                        style={{ width: `${Math.max(8, progressPct)}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-mono-nums text-[#94A3B8] mt-2">
                      {progressPct}%
                      {activeBackendLabel ? ` · ${activeBackendLabel}` : ""} ·
                      Running locally in browser
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Stage Helper Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
                {showSplitCompare ? (
                  <>
                    <span>
                      Drag the cyan center handle to compare Before &amp; After
                      {zoomLevel > 1 ? " · Drag canvas to pan while zoomed" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSplitPercent(100)}
                        className="hover:text-[#00E5FF] cursor-pointer"
                      >
                        Full Original
                      </button>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setSplitPercent(50)}
                        className="hover:text-[#00E5FF] cursor-pointer"
                      >
                        50 / 50
                      </button>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setSplitPercent(0)}
                        className="hover:text-[#00E5FF] cursor-pointer"
                      >
                        Full Enhanced
                      </button>
                    </div>
                  </>
                ) : (
                  <span>
                    {objectSubMode === "remove"
                      ? "Paint smoothly over any unwanted wire, person, text, or blemish—then click Erase Painted Object."
                      : "Drag the uploaded object or text stamp directly on the photo, then click Apply Object to Photo."}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: AI Enhancement Tools + Objects + Print Export Dock */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#111827]/90 backdrop-blur-xl border border-[#00E5FF]/20 rounded-2xl overflow-hidden">
          {/* 7-Tab Tool Navigation */}
          <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 gap-1 p-2 bg-[#080B12]/80 border-b border-[#00E5FF]/15">
            {TOOL_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTool === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTool(tab.id)}
                  className={`inline-flex items-center justify-center gap-1 px-1.5 py-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[36px] ${
                    active
                      ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold"
                      : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4">
            {/* TOOL A: AI HD / 4K UPSCALING */}
            {activeTool === "upscale" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    A. AI HD / 4K Super-Resolution
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Runs an open-source ESRGAN neural network locally plus
                    micro-detail crispness polish to restore ultra-sharp print
                    details.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUpscaleMode("hd")}
                    disabled={isProcessing}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      upscaleMode === "hd"
                        ? "border-[#00E5FF] bg-[#00E5FF]/12 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/45 text-[#E2E8F0]"
                    }`}
                  >
                    <span className="text-xs font-bold">HD Neural (2×)</span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Fast studio upscale
                    </span>
                    {predictedHd && (
                      <span className="text-[11px] font-mono-nums text-[#00E5FF] mt-1">
                        {predictedHd.outputW} × {predictedHd.outputH} px
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setUpscaleMode("4k")}
                    disabled={isProcessing}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      upscaleMode === "4k"
                        ? "border-[#00E5FF] bg-[#00E5FF]/12 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/45 text-[#E2E8F0]"
                    }`}
                  >
                    <span className="text-xs font-bold">4K Neural (4×)</span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Ultra-high print detail
                    </span>
                    {predicted4k && (
                      <span className="text-[11px] font-mono-nums text-[#00E5FF] mt-1">
                        {predicted4k.outputW} × {predicted4k.outputH} px
                      </span>
                    )}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#E2E8F0] font-medium">
                      Post-Upscale Detail Crispness
                    </span>
                    <span className="font-mono-nums text-[#00E5FF]">
                      {upscalePolish}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={upscalePolish}
                    onChange={(e) => setUpscalePolish(Number(e.target.value))}
                    className="w-full accent-[#00E5FF]"
                  />
                </div>

                {((upscaleMode === "hd" && predictedHd?.wasInputCapped) ||
                  (upscaleMode === "4k" && predicted4k?.wasInputCapped)) && (
                  <p className="text-[11px] text-amber-300/90 bg-amber-950/35 border border-amber-500/25 rounded-lg px-3 py-2 leading-relaxed">
                    Memory safety cap active: input tiles are bounded cleanly to
                    keep browser GPU fast while outputting up to{" "}
                    {upscaleMode === "4k" ? "3840 px (4K)" : "2048 px (HD)"}.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleRunUpscale()}
                  disabled={!currentEntry || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>
                    Run AI {upscaleMode === "4k" ? "4K (4×)" : "HD (2×)"}{" "}
                    ESRGAN Upscale
                  </span>
                </button>
              </div>
            )}

            {/* TOOL B: BLUR REMOVAL & SHARPENING */}
            {activeTool === "sharpen" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    B. Blur Removal &amp; Crisp Sharpening
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Resolution-adaptive Richardson-Lucy deconvolution, dual-scale
                    edge clarity, and colour-safe digital noise reduction.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {
                      label: "Strong Deblur",
                      val: { deblur: 85, sharpness: 58, denoise: 15 },
                    },
                    {
                      label: "Fix Soft Focus",
                      val: { deblur: 65, sharpness: 48, denoise: 20 },
                    },
                    {
                      label: "Denoise Low-Light",
                      val: { deblur: 32, sharpness: 35, denoise: 72 },
                    },
                    {
                      label: "Crisp Studio Print",
                      val: { deblur: 48, sharpness: 68, denoise: 18 },
                    },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDeblurOpts(p.val)}
                      className="px-2 py-2 rounded-lg text-[11px] font-semibold bg-[#080B12]/80 border border-[#00E5FF]/20 hover:border-[#00E5FF] text-[#E2E8F0] transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#E2E8F0] font-medium">
                        Blur Removal (Deconvolution)
                      </span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {deblurOpts.deblur}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={deblurOpts.deblur}
                      onChange={(e) =>
                        setDeblurOpts((s) => ({
                          ...s,
                          deblur: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#00E5FF]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#E2E8F0] font-medium">
                        Detail Crispness &amp; Clarity
                      </span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {deblurOpts.sharpness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={deblurOpts.sharpness}
                      onChange={(e) =>
                        setDeblurOpts((s) => ({
                          ...s,
                          sharpness: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#00E5FF]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#E2E8F0] font-medium">
                        Digital Noise Reduction
                      </span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {deblurOpts.denoise}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={deblurOpts.denoise}
                      onChange={(e) =>
                        setDeblurOpts((s) => ({
                          ...s,
                          denoise: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#00E5FF]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleApplyDeblurSharpen()}
                  disabled={!currentEntry || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                >
                  <Focus className="w-4 h-4" />
                  <span>Apply Blur Removal &amp; Sharpening</span>
                </button>
              </div>
            )}

            {/* TOOL C: BACKGROUND REMOVAL & REPLACEMENT */}
            {activeTool === "background" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    C. AI Background Removal &amp; Replacement
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Runs on-device ONNX neural segmentation to cut out subjects
                    cleanly, then swap to transparent, studio colour, or a custom
                    photo backdrop.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRemoveBackground()}
                  disabled={!currentEntry || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                >
                  <Eraser className="w-4 h-4" />
                  <span>
                    {cutoutAsset
                      ? "Re-run AI Background Cutout"
                      : "Remove Background (AI Neural)"}
                  </span>
                </button>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#E2E8F0]">
                      Replacement Backdrop
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {cutoutAsset
                        ? "Tap any backdrop to switch instantly"
                        : "Select colour or photo anytime"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {BG_SWATCHES.map((sw) => {
                      const active = bgChoice === sw.id;
                      return (
                        <button
                          key={sw.id}
                          type="button"
                          onClick={() => void handleApplyBackgroundColor(sw.id)}
                          disabled={isProcessing}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer min-h-[38px] ${
                            active
                              ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                              : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/45 text-[#CBD5E1]"
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                            style={
                              sw.id === "transparent"
                                ? {
                                    backgroundImage:
                                      "linear-gradient(45deg, #64748b 25%, transparent 25%), linear-gradient(-45deg, #64748b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #64748b 75%), linear-gradient(-45deg, transparent 75%, #64748b 75%)",
                                    backgroundSize: "8px 8px",
                                    backgroundPosition:
                                      "0 0, 0 4px, 4px -4px, -4px 0px",
                                  }
                                : {
                                    backgroundColor:
                                      sw.id === "custom"
                                        ? customBgHex
                                        : sw.swatch,
                                  }
                            }
                          />
                          <span className="truncate">{sw.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {bgChoice === "custom" && (
                    <div className="flex items-center gap-2.5 pt-1">
                      <input
                        type="color"
                        value={customBgHex}
                        onChange={(e) => {
                          const hex = e.target.value;
                          setCustomBgHex(hex);
                          if (cutoutAsset) {
                            void handleApplyBackgroundColor("custom", hex);
                          }
                        }}
                        aria-label="Pick custom background colour"
                        className="w-10 h-9 rounded-lg border border-[#00E5FF]/30 bg-transparent cursor-pointer"
                      />
                      <span className="text-xs font-mono-nums text-[#E2E8F0]">
                        {customBgHex.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Custom Photo Backdrop Upload */}
                  <button
                    type="button"
                    onClick={() => customBgInputRef.current?.click()}
                    disabled={isProcessing}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer min-h-[38px] ${
                      bgChoice === "image"
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/20 bg-[#080B12]/70 hover:border-[#00E5FF]/50 text-[#CBD5E1]"
                    }`}
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span>
                      {customBgImgUrl
                        ? "Change Custom Background Photo"
                        : "Upload Custom Background Photo"}
                    </span>
                  </button>

                  {/* Edge Feathering */}
                  <div className="pt-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#E2E8F0] font-medium">
                        Cutout Edge Softness
                      </span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {bgEdgeFeather.toFixed(1)} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.2}
                      value={bgEdgeFeather}
                      onChange={(e) => setBgEdgeFeather(Number(e.target.value))}
                      onMouseUp={() => {
                        if (cutoutAsset && !isProcessing) {
                          void compositeFromCutout(
                            cutoutAsset,
                            bgChoice,
                            undefined,
                            undefined,
                            bgEdgeFeather
                          );
                        }
                      }}
                      className="w-full accent-[#00E5FF]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TOOL D: STUDIO FACE & IMAGE BEAUTY SKIN ENHANCE */}
            {activeTool === "face" && (
              <div className="space-y-3.5">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    D. Face &amp; Beauty Skin Enhance
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Resolution-adaptive beauty skin engine: clears pimples &amp;
                    spots, smooths texture naturally, brightens dull skin &amp;
                    under-eyes, controls oil shine, and sharpens eyes.
                  </p>
                </div>

                {/* One-Click Beauty Presets */}
                <div className="grid grid-cols-2 gap-1.5">
                  {FACE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFaceOpts(preset.values)}
                      className="px-2 py-2 rounded-lg text-[11px] font-semibold bg-[#080B12]/80 border border-[#00E5FF]/20 hover:border-[#00E5FF] text-[#E2E8F0] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      key: "smoothSkin" as const,
                      label: "Silky Skin Smoothing",
                    },
                    {
                      key: "removeBlemishes" as const,
                      label: "Pimple, Acne & Blemish Clear",
                    },
                    {
                      key: "skinBrighten" as const,
                      label: "Skin Brighten & Fair Glow",
                    },
                    {
                      key: "evenTone" as const,
                      label: "Even Skin Tone & Shine Control",
                    },
                    {
                      key: "facialClarity" as const,
                      label: "Eyes, Lashes & Facial Clarity",
                    },
                  ].map((item) => (
                    <div key={item.key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-[#E2E8F0] font-medium">
                          {item.label}
                        </span>
                        <span className="font-mono-nums text-[#00E5FF]">
                          {faceOpts[item.key]}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={faceOpts[item.key]}
                        onChange={(e) =>
                          setFaceOpts((s) => ({
                            ...s,
                            [item.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#00E5FF]"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handleApplyFaceRetouch()}
                  disabled={!currentEntry || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Apply Beauty Skin Enhance</span>
                </button>
              </div>
            )}

            {/* TOOL E: COLOUR & LIGHTING CORRECTION */}
            {activeTool === "color" && (
              <div className="space-y-3.5">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    E. Studio Colour &amp; Lighting Fix
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Auto exposure, shadow recovery, white balance, and rich
                    studio colour presets with live preview.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleAutoAnalyzeColor()}
                    disabled={!currentEntry || isProcessing}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#161D2B] border border-[#00E5FF]/45 hover:border-[#00E5FF] text-xs font-semibold text-[#00E5FF] transition-colors cursor-pointer min-h-[38px] disabled:opacity-40"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Auto Studio Fix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setColorOpts({ ...DEFAULT_COLOR_LIGHTING_OPTIONS })
                    }
                    disabled={!isColorOptionsActive(colorOpts)}
                    className="px-3 py-2 rounded-lg bg-[#080B12] border border-white/10 hover:border-white/30 text-xs font-medium text-[#94A3B8] hover:text-[#F5F7FA] disabled:opacity-35 cursor-pointer min-h-[38px]"
                  >
                    Zero
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setColorOpts(preset.values)}
                      className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-[#080B12]/80 border border-[#00E5FF]/20 hover:border-[#00E5FF] text-[#E2E8F0] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {[
                    { key: "exposure" as const, label: "Exposure", min: -100, max: 100 },
                    { key: "shadows" as const, label: "Shadows Lift (Dark Faces)", min: -50, max: 80 },
                    { key: "highlights" as const, label: "Highlights Recovery", min: -80, max: 50 },
                    { key: "brightness" as const, label: "Brightness", min: -50, max: 50 },
                    { key: "contrast" as const, label: "Contrast", min: -50, max: 50 },
                    { key: "warmth" as const, label: "White Balance (Warmth)", min: -50, max: 50 },
                    { key: "tint" as const, label: "Tint (Green / Magenta)", min: -50, max: 50 },
                    { key: "vibrance" as const, label: "Colour Vibrance", min: -50, max: 70 },
                  ].map((slider) => (
                    <div key={slider.key}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-[#E2E8F0] font-medium">
                          {slider.label}
                        </span>
                        <span className="font-mono-nums text-[#00E5FF]">
                          {colorOpts[slider.key] > 0
                            ? `+${colorOpts[slider.key]}`
                            : colorOpts[slider.key]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        value={colorOpts[slider.key]}
                        onChange={(e) =>
                          setColorOpts((prev) => ({
                            ...prev,
                            [slider.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#00E5FF]"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handleApplyColorLighting()}
                  disabled={
                    !currentEntry ||
                    isProcessing ||
                    !isColorOptionsActive(colorOpts)
                  }
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                >
                  <Sun className="w-4 h-4" />
                  <span>Apply Colour &amp; Lighting</span>
                </button>
              </div>
            )}

            {/* TOOL F (NEW): REMOVE ANY OBJECT & ADD ANY OBJECT */}
            {activeTool === "objects" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    F. Remove Any Object &amp; Add Objects
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Brush over unwanted people, wires, spots, or text to erase
                    them cleanly—or place logos, cutouts, stickers, and text
                    anywhere on your photo.
                  </p>
                </div>

                {/* Sub-mode Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setObjectSubMode("remove")}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer min-h-[38px] ${
                      objectSubMode === "remove"
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 text-[#94A3B8]"
                    }`}
                  >
                    <Brush className="w-3.5 h-3.5 text-rose-400" />
                    <span>Remove Object</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setObjectSubMode("add")}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer min-h-[38px] ${
                      objectSubMode === "add"
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 text-[#94A3B8]"
                    }`}
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span>Add Object</span>
                  </button>
                </div>

                {objectSubMode === "remove" ? (
                  <div className="space-y-3.5">
                    <div className="bg-[#080B12]/75 border border-rose-500/25 rounded-xl p-3 text-[11px] text-[#CBD5E1] leading-relaxed">
                      Paint directly over the unwanted object on the preview
                      photo with the red magic brush, then tap{" "}
                      <strong className="text-[#F5F7FA]">
                        Erase Painted Object
                      </strong>
                      .
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#E2E8F0] font-medium">
                          Magic Brush Size
                        </span>
                        <span className="font-mono-nums text-[#00E5FF]">
                          {brushSizePx} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={120}
                        value={brushSizePx}
                        onChange={(e) => setBrushSizePx(Number(e.target.value))}
                        className="w-full accent-rose-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBrushStrokes((prev) => prev.slice(0, -1))
                        }
                        disabled={brushStrokes.length === 0 || isProcessing}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#080B12] border border-white/15 hover:border-[#00E5FF]/50 text-xs font-semibold text-[#E2E8F0] disabled:opacity-35 cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Undo Stroke</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushStrokes([])}
                        disabled={brushStrokes.length === 0 || isProcessing}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#080B12] border border-white/15 hover:border-rose-400/50 text-xs font-semibold text-[#E2E8F0] disabled:opacity-35 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Brush</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRunObjectRemoval()}
                      disabled={
                        !currentEntry ||
                        isProcessing ||
                        brushStrokes.length === 0
                      }
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>
                        Erase Painted Object ({brushStrokes.length} stroke
                        {brushStrokes.length === 1 ? "" : "s"})
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {/* Add Image/Cutout vs Add Text Stamp */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddKind("image")}
                        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                          addKind === "image"
                            ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                            : "border-white/10 bg-[#080B12] text-[#94A3B8]"
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Image / Logo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddKind("text")}
                        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                          addKind === "text"
                            ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                            : "border-white/10 bg-[#080B12] text-[#94A3B8]"
                        }`}
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span>Text / Stamp</span>
                      </button>
                    </div>

                    {addKind === "image" ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => addObjInputRef.current?.click()}
                          disabled={isProcessing}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/35 hover:border-[#00E5FF] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                          <span>
                            {addedImgUrl
                              ? "Change Object / Sticker Image"
                              : "Upload Object / Logo / Sticker"}
                          </span>
                        </button>

                        {addedImgUrl && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveBgOnAddedObject()}
                            disabled={isProcessing}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#080B12] border border-[#8B5CF6]/45 hover:border-[#8B5CF6] text-[11px] font-semibold text-[#C4B5FD] cursor-pointer"
                          >
                            <Eraser className="w-3.5 h-3.5" />
                            <span>1-Click AI Remove BG on Added Object</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={addedText}
                          onChange={(e) => setAddedText(e.target.value)}
                          placeholder="Enter text, watermark, or label..."
                          className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                        />
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <label className="flex items-center gap-1.5 text-[#CBD5E1]">
                            <span>Text</span>
                            <input
                              type="color"
                              value={addedTextColor}
                              onChange={(e) =>
                                setAddedTextColor(e.target.value)
                              }
                              className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                            />
                          </label>
                          <label className="flex items-center gap-1.5 text-[#CBD5E1] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={addedTextBgEnabled}
                              onChange={(e) =>
                                setAddedTextBgEnabled(e.target.checked)
                              }
                              className="accent-[#00E5FF]"
                            />
                            <span>Badge BG</span>
                            {addedTextBgEnabled && (
                              <input
                                type="color"
                                value={addedTextBgColor}
                                onChange={(e) =>
                                  setAddedTextBgColor(e.target.value)
                                }
                                className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                              />
                            )}
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Live Transform Controls */}
                    <div className="space-y-2 pt-1">
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-[#E2E8F0] font-medium">
                            Size / Scale
                          </span>
                          <span className="font-mono-nums text-[#00E5FF]">
                            {objTransform.scalePct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={200}
                          value={objTransform.scalePct}
                          onChange={(e) =>
                            setObjTransform((p) => ({
                              ...p,
                              scalePct: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#00E5FF]"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-[#E2E8F0] font-medium">
                            Rotation
                          </span>
                          <span className="font-mono-nums text-[#00E5FF]">
                            {objTransform.rotationDeg}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={objTransform.rotationDeg}
                          onChange={(e) =>
                            setObjTransform((p) => ({
                              ...p,
                              rotationDeg: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#00E5FF]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-[#E2E8F0]">Opacity</span>
                            <span className="font-mono-nums text-[#00E5FF]">
                              {objTransform.opacity}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={objTransform.opacity}
                            onChange={(e) =>
                              setObjTransform((p) => ({
                                ...p,
                                opacity: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#00E5FF]"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-[#E2E8F0]">Shadow</span>
                            <span className="font-mono-nums text-[#00E5FF]">
                              {objTransform.shadow}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={objTransform.shadow}
                            onChange={(e) =>
                              setObjTransform((p) => ({
                                ...p,
                                shadow: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#00E5FF]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setObjTransform((p) => ({
                              ...p,
                              flipX: !p.flipX,
                            }))
                          }
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                            objTransform.flipX
                              ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                              : "border-white/15 bg-[#080B12] text-[#CBD5E1]"
                          }`}
                        >
                          <FlipHorizontal2 className="w-3.5 h-3.5" />
                          <span>Flip Horizontal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setObjTransform((p) => ({
                              ...p,
                              xPct: 50,
                              yPct: 50,
                              rotationDeg: 0,
                            }))
                          }
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-[#080B12] text-[11px] font-semibold text-[#CBD5E1] cursor-pointer"
                        >
                          <Move className="w-3.5 h-3.5" />
                          <span>Center</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleApplyAddedObject()}
                      disabled={
                        !currentEntry ||
                        isProcessing ||
                        (addKind === "image" && !addedImgUrl) ||
                        (addKind === "text" && !addedText.trim())
                      }
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>Apply Object to Photo</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PRINT-READY 300 PPI EXPORT & PASSPORT STUDIO INTEGRATION */}
            {activeTool === "export" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">
                    Print-Ready 300 PPI Export
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Embeds true 300 PPI metadata in both JPG (JFIF) and PNG
                    (pHYs) for exact studio printing.
                  </p>
                </div>

                {/* Format Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat("jpeg")}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      exportFormat === "jpeg"
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 text-[#94A3B8]"
                    }`}
                  >
                    JPG · 300 PPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("png")}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      exportFormat === "png"
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 text-[#94A3B8]"
                    }`}
                  >
                    PNG · 300 PPI Lossless
                  </button>
                </div>

                {exportFormat === "jpeg" && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#E2E8F0] font-medium">
                        JPG Print Quality
                      </span>
                      <span className="font-mono-nums text-[#00E5FF]">
                        {Math.round(jpegQuality * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={75}
                      max={100}
                      value={Math.round(jpegQuality * 100)}
                      onChange={(e) =>
                        setJpegQuality(Number(e.target.value) / 100)
                      }
                      className="w-full accent-[#00E5FF]"
                    />
                  </div>
                )}

                {/* Print Dimensions Mode */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#E2E8F0]">
                    Output Dimensions (300 PPI)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "original", label: "Original" },
                        { id: "preset", label: "Print Preset" },
                        { id: "custom", label: "Custom Size" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDimensionMode(m.id)}
                        className={`px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                          dimensionMode === m.id
                            ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                            : "border-[#00E5FF]/15 bg-[#080B12]/70 text-[#94A3B8]"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {dimensionMode === "preset" && (
                    <select
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                      className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                    >
                      {PRINT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({toPixels300(p.w, p.unit)} ×{" "}
                          {toPixels300(p.h, p.unit)} px)
                        </option>
                      ))}
                    </select>
                  )}

                  {dimensionMode === "custom" && (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min={0.5}
                        max={600}
                        value={customW}
                        onChange={(e) =>
                          setCustomW(Math.max(0.5, Number(e.target.value)))
                        }
                        aria-label="Custom print width"
                        className="bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min={0.5}
                        max={600}
                        value={customH}
                        onChange={(e) =>
                          setCustomH(Math.max(0.5, Number(e.target.value)))
                        }
                        aria-label="Custom print height"
                        className="bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                      />
                      <select
                        value={customUnit}
                        onChange={(e) =>
                          setCustomUnit(e.target.value as "in" | "mm")
                        }
                        aria-label="Print unit"
                        className="bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2 py-2 text-xs text-[#F5F7FA]"
                      >
                        <option value="in">Inches</option>
                        <option value="mm">Millimeters</option>
                      </select>
                    </div>
                  )}

                  {dimensionMode !== "original" && (
                    <label className="flex items-center gap-2 text-xs text-[#CBD5E1] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={preserveAspectRatio}
                        onChange={(e) =>
                          setPreserveAspectRatio(e.target.checked)
                        }
                        className="accent-[#00E5FF] rounded"
                      />
                      <span>Preserve original aspect ratio</span>
                    </label>
                  )}

                  {currentEntry && (
                    <p className="text-[11px] font-mono-nums text-[#94A3B8]">
                      Output: {resolvedPrintTarget.label} · 300 PPI
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleDownloadEnhanced()}
                  disabled={!currentEntry || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Download {exportFormat.toUpperCase()} (300 PPI)
                  </span>
                </button>
              </div>
            )}

            {/* Always-Visible Passport Photo, Sheet Layout & Print Service Handoff Footer */}
            <div className="pt-4 border-t border-[#00E5FF]/15 space-y-2">
              <p className="text-[11px] font-semibold text-[#94A3B8]">
                Continue to {BRAND_NAME} Print Tools
              </p>
              <button
                type="button"
                onClick={() => void handleSendToPassportStudio()}
                disabled={!currentEntry || isProcessing}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/35 hover:border-[#00E5FF] text-xs font-semibold text-[#F5F7FA] disabled:opacity-40 transition-colors cursor-pointer min-h-[42px]"
              >
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <span>Send to Passport Studio &amp; Sheet Layout</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onMailQuery(
                    currentEntry
                      ? `AI Enhanced Photo Print Order (${resolvedPrintTarget.label}, ${exportFormat.toUpperCase()} @ 300 PPI)`
                      : "AI Enhanced Photo Printing Service Inquiry"
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#080B12] border border-[#8B5CF6]/35 hover:border-[#8B5CF6] text-xs font-medium text-[#E2E8F0] transition-colors cursor-pointer min-h-[38px]"
              >
                <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Order Print via Mail Desk</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(blob) => void ingestPhotoBlob(blob, "Camera Capture")}
      />
    </div>
  );
}
