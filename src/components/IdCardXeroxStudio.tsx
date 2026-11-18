import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  FlipHorizontal,
  Mail,
  RotateCw,
  Scissors,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BORDER_COLOR_PRESETS,
  BRAND_NAME,
  OUTLINE_STYLES,
  OutlineStyle,
  PRINT_PPI,
} from "../types/photo";
import {
  drawStyledOutlineRect,
  loadHtmlImage,
  mmToPixels300Ppi,
  setJpegPpi,
  triggerBlobDownload,
} from "../utils/imageProcessing";
import { CameraCaptureModal } from "./CameraCaptureModal";
import {
  DocCropTarget,
  DocumentCropModal,
  DocumentCropResult,
} from "./DocumentCropModal";

type IdPresetId =
  | "cr80"
  | "aadhaar_pvc"
  | "eaadhaar_cut"
  | "a5_doc"
  | "custom_mm";
type XeroxColorMode = "bw_xerox" | "grayscale" | "color";
type IdPaperKey = "a4" | "4x6";
type IdArrangement = "side_by_side" | "up_down" | "grid_2x2" | "front_only";
type VerticalAnchor = "top" | "center" | "bottom";

const ID_PRESETS: Record<
  IdPresetId,
  { label: string; wMm: number; hMm: number }
> = {
  cr80: {
    label: "Aadhaar / PAN / Voter ID / DL (85.6 × 54 mm · CR80)",
    wMm: 85.6,
    hMm: 54,
  },
  aadhaar_pvc: {
    label: "Aadhaar Card Standard (85 × 55 mm)",
    wMm: 85,
    hMm: 55,
  },
  eaadhaar_cut: {
    label: "E-Aadhaar Full Cut (90 × 58 mm)",
    wMm: 90,
    hMm: 58,
  },
  a5_doc: {
    label: "A5 Document / Certificate (148 × 210 mm)",
    wMm: 148,
    hMm: 210,
  },
  custom_mm: {
    label: "Custom Document Size Maker (mm @ 300 PPI)",
    wMm: 85.6,
    hMm: 54,
  },
};

const ID_PAPERS: Record<
  IdPaperKey,
  { label: string; w: number; h: number }
> = {
  a4: { label: "A4 Sheet (2480 × 3508 px)", w: 2480, h: 3508 },
  "4x6": { label: "4 × 6 inch (1800 × 1200 px)", w: 1800, h: 1200 },
};

interface IdCardXeroxStudioProps {
  onMailQuery: (summary: string) => void;
}

export function IdCardXeroxStudio({ onMailQuery }: IdCardXeroxStudioProps) {
  const [presetId, setPresetId] = useState<IdPresetId>("cr80");
  const [customWMm, setCustomWMm] = useState<number>(85.6);
  const [customHMm, setCustomHMm] = useState<number>(54);
  const [cardScalePct, setCardScalePct] = useState<number>(100);

  const [paperKey, setPaperKey] = useState<IdPaperKey>("a4");
  const [arrangement, setArrangement] = useState<IdArrangement>("side_by_side");
  const [verticalAnchor, setVerticalAnchor] = useState<VerticalAnchor>("top");
  const [setsCount, setSetsCount] = useState<number>(1);
  const [colorMode, setColorMode] = useState<XeroxColorMode>("bw_xerox");
  const [brightness, setBrightness] = useState<number>(112);
  const [contrast, setContrast] = useState<number>(135);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [showSideLabels, setShowSideLabels] = useState<boolean>(false);

  const [borderWidthPx, setBorderWidthPx] = useState<number>(3);
  const [borderColor, setBorderColor] = useState<string>("#334155");
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>("solid");
  const [outlineOffsetPx, setOutlineOffsetPx] = useState<number>(0);
  const [gapMm, setGapMm] = useState<number>(6);
  const [marginTopMm, setMarginTopMm] = useState<number>(10);

  const [frontSrc, setFrontSrc] = useState<string | null>(null);
  const [backSrc, setBackSrc] = useState<string | null>(null);
  const [frontRot, setFrontRot] = useState<number>(0);
  const [backRot, setBackRot] = useState<number>(0);
  const [singleUploadUrl, setSingleUploadUrl] = useState<string | null>(null);

  const [cameraTarget, setCameraTarget] = useState<
    "front" | "back" | "one_crop" | null
  >(null);
  const [cropModalState, setCropModalState] = useState<{
    isOpen: boolean;
    sourceUrl: string | null;
    target: DocCropTarget;
  }>({ isOpen: false, sourceUrl: null, target: "front" });

  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeCardDims = useMemo(() => {
    const base = ID_PRESETS[presetId];
    const rawWMm =
      presetId === "custom_mm"
        ? Math.min(200, Math.max(20, Number(customWMm) || 85.6))
        : base.wMm;
    const rawHMm =
      presetId === "custom_mm"
        ? Math.min(285, Math.max(20, Number(customHMm) || 54))
        : base.hMm;
    const scaleFactor = cardScalePct / 100;
    const wMm = Math.round(rawWMm * scaleFactor * 10) / 10;
    const hMm = Math.round(rawHMm * scaleFactor * 10) / 10;
    return {
      label: base.label,
      wMm,
      hMm,
      wPx: mmToPixels300Ppi(wMm),
      hPx: mmToPixels300Ppi(hMm),
    };
  }, [presetId, customWMm, customHMm, cardScalePct]);

  const paper = ID_PAPERS[paperKey];
  const gapPx = mmToPixels300Ppi(gapMm);
  const marginTopPx = mmToPixels300Ppi(marginTopMm);

  const maxSetsOnPaper = useMemo(() => {
    const usableH = Math.max(activeCardDims.hPx, paper.h - 120);
    if (arrangement === "side_by_side") {
      return Math.max(
        1,
        Math.min(
          6,
          Math.floor((usableH + gapPx) / (activeCardDims.hPx + gapPx))
        )
      );
    }
    if (arrangement === "up_down") {
      const setH = activeCardDims.hPx * 2 + gapPx;
      return Math.max(
        1,
        Math.min(4, Math.floor((usableH + gapPx) / (setH + gapPx)))
      );
    }
    if (arrangement === "grid_2x2") {
      return paperKey === "a4" ? 2 : 1;
    }
    // front_only
    const cols = Math.max(
      1,
      Math.floor((paper.w - 120 + gapPx) / (activeCardDims.wPx + gapPx))
    );
    const rows = Math.max(
      1,
      Math.floor((usableH + gapPx) / (activeCardDims.hPx + gapPx))
    );
    return Math.max(1, Math.min(8, cols * rows));
  }, [
    arrangement,
    paperKey,
    paper.w,
    paper.h,
    activeCardDims.wPx,
    activeCardDims.hPx,
    gapPx,
  ]);

  useEffect(() => {
    if (setsCount > maxSetsOnPaper) {
      setSetsCount(maxSetsOnPaper);
    }
  }, [maxSetsOnPaper, setsCount]);

  const handleFileUpload = (
    side: "front" | "back",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === "front") {
      setFrontSrc(url);
      setFrontRot(0);
    } else {
      setBackSrc(url);
      setBackRot(0);
    }
    setSingleUploadUrl(url);
    setErrorStatus(null);
    setExportStatus(null);
    e.target.value = "";
  };

  const handleUploadOneAndCrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSingleUploadUrl(url);
    setCropModalState({ isOpen: true, sourceUrl: url, target: "front" });
    setErrorStatus(null);
    setExportStatus(null);
    e.target.value = "";
  };

  const renderCardToCanvas = (
    img: HTMLImageElement,
    rotDeg: number,
    cardW: number,
    cardH: number
  ): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cardW, cardH);

    const filterParts = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
    ];
    if (colorMode === "bw_xerox" || colorMode === "grayscale") {
      filterParts.push("grayscale(100%)");
    }
    ctx.filter = filterParts.join(" ");

    const rad = (rotDeg * Math.PI) / 180;
    const isQuarterTurn = rotDeg % 180 !== 0;
    const srcW = isQuarterTurn ? img.height : img.width;
    const srcH = isQuarterTurn ? img.width : img.height;

    const scale =
      fitMode === "cover"
        ? Math.max(cardW / srcW, cardH / srcH)
        : Math.min(cardW / srcW, cardH / srcH);
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    ctx.save();
    ctx.translate(cardW / 2, cardH / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    ctx.filter = "none";

    if (colorMode === "bw_xerox") {
      const imgData = ctx.getImageData(0, 0, cardW, cardH);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = data[i];
        let adjusted = lum;
        if (lum > 215) adjusted = 255;
        else if (lum < 75) adjusted = Math.max(0, lum * 0.55);
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    return canvas;
  };

  const buildXeroxSheetCanvas = async (): Promise<HTMLCanvasElement> => {
    const sheetCanvas = document.createElement("canvas");
    sheetCanvas.width = paper.w;
    sheetCanvas.height = paper.h;
    const ctx = sheetCanvas.getContext("2d")!;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, paper.w, paper.h);

    const frontImg = frontSrc ? await loadHtmlImage(frontSrc) : null;
    const backImg = backSrc ? await loadHtmlImage(backSrc) : null;

    const cw = activeCardDims.wPx;
    const ch = activeCardDims.hPx;

    const frontCard = frontImg
      ? renderCardToCanvas(frontImg, frontRot, cw, ch)
      : null;
    const backCard = backImg
      ? renderCardToCanvas(backImg, backRot, cw, ch)
      : null;

    const drawCardTile = (
      cardCanvas: HTMLCanvasElement | null,
      x: number,
      y: number,
      label: string
    ) => {
      if (cardCanvas) {
        ctx.drawImage(cardCanvas, x, y, cw, ch);
      } else {
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = "#94A3B8";
        ctx.font = '600 30px "Plus Jakarta Sans", Arial, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + cw / 2, y + ch / 2);
      }

      if (showSideLabels) {
        ctx.fillStyle = "#475569";
        ctx.font = '700 22px "IBM Plex Mono", Arial, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, x + cw / 2, y - Math.max(6, outlineOffsetPx + 4));
      }

      if (borderWidthPx > 0 || !cardCanvas) {
        drawStyledOutlineRect(
          ctx,
          x,
          y,
          cw,
          ch,
          borderWidthPx > 0 ? borderWidthPx : 2,
          borderWidthPx > 0 ? borderColor : "#CBD5E1",
          outlineStyle,
          outlineOffsetPx
        );
      }
    };

    // Collect placement slots based on arrangement
    const slots: { x: number; y: number; kind: "front" | "back" }[] = [];

    if (arrangement === "side_by_side") {
      const hasOnlyFront = Boolean(frontSrc && !backSrc);
      const cols = hasOnlyFront ? 1 : 2;
      const rowW = cols * cw + (cols - 1) * gapPx;
      const startX = Math.round((paper.w - rowW) / 2);

      for (let s = 0; s < setsCount; s++) {
        const y = s * (ch + gapPx);
        slots.push({ x: startX, y, kind: "front" });
        if (cols === 2 && startX + cw + gapPx + cw <= paper.w - 20) {
          slots.push({ x: startX + cw + gapPx, y, kind: "back" });
        }
      }
    } else if (arrangement === "up_down") {
      const startX = Math.round((paper.w - cw) / 2);
      const showBack = Boolean(backSrc || !frontSrc);
      const setGap = Math.round(gapPx * 1.4);
      let cursorY = 0;
      for (let s = 0; s < setsCount; s++) {
        slots.push({ x: startX, y: cursorY, kind: "front" });
        cursorY += ch + gapPx;
        if (showBack) {
          slots.push({ x: startX, y: cursorY, kind: "back" });
          cursorY += ch + setGap;
        }
      }
    } else if (arrangement === "grid_2x2") {
      const rowW = cw * 2 + gapPx;
      const startX = Math.round((paper.w - rowW) / 2);
      let cursorY = 0;
      for (let s = 0; s < setsCount; s++) {
        slots.push({ x: startX, y: cursorY, kind: "front" });
        slots.push({ x: startX + cw + gapPx, y: cursorY, kind: "front" });
        cursorY += ch + gapPx;
        slots.push({ x: startX, y: cursorY, kind: "back" });
        slots.push({ x: startX + cw + gapPx, y: cursorY, kind: "back" });
        cursorY += ch + gapPx * 1.5;
      }
    } else {
      // front_only
      const cols = Math.max(
        1,
        Math.floor((paper.w - 80 + gapPx) / (cw + gapPx))
      );
      const usedCols = Math.min(cols, setsCount);
      const rowW = usedCols * cw + (usedCols - 1) * gapPx;
      const startX = Math.round((paper.w - rowW) / 2);
      for (let i = 0; i < setsCount; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        slots.push({
          x: startX + c * (cw + gapPx),
          y: r * (ch + gapPx),
          kind: "front",
        });
      }
    }

    const totalH =
      slots.length > 0 ? Math.max(...slots.map((s) => s.y + ch)) : ch;
    let offsetY = marginTopPx;
    if (verticalAnchor === "center") {
      offsetY = Math.max(40, Math.round((paper.h - totalH) / 2));
    } else if (verticalAnchor === "bottom") {
      offsetY = Math.max(40, paper.h - totalH - marginTopPx);
    }

    for (const slot of slots) {
      const y = slot.y + offsetY;
      if (y + ch > paper.h - 20) continue;
      if (slot.kind === "front") {
        drawCardTile(frontCard, slot.x, y, "FRONT SIDE");
      } else {
        drawCardTile(backCard, slot.x, y, "BACK SIDE");
      }
    }

    return sheetCanvas;
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const fullSheet = await buildXeroxSheetCanvas();
        if (cancelled || !previewCanvasRef.current) return;

        const preview = previewCanvasRef.current;
        const maxPreview = 680;
        const scale = Math.min(maxPreview / paper.w, maxPreview / paper.h);
        preview.width = Math.round(paper.w * scale);
        preview.height = Math.round(paper.h * scale);
        const pCtx = preview.getContext("2d");
        if (!pCtx) return;
        pCtx.drawImage(fullSheet, 0, 0, preview.width, preview.height);
      } catch {
        // Ignore transient preview errors
      }
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    frontSrc,
    backSrc,
    frontRot,
    backRot,
    activeCardDims,
    paperKey,
    arrangement,
    verticalAnchor,
    marginTopMm,
    setsCount,
    colorMode,
    brightness,
    contrast,
    fitMode,
    showSideLabels,
    borderWidthPx,
    borderColor,
    outlineStyle,
    outlineOffsetPx,
    gapMm,
  ]);

  const handleDownloadXeroxSheet = async () => {
    if (!frontSrc && !backSrc) {
      setErrorStatus(
        "Please upload or click at least the Front Side of the ID card."
      );
      return;
    }
    try {
      setErrorStatus(null);
      const canvas = await buildXeroxSheetCanvas();
      const rawBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.96)
      );
      const ppiBlob = await setJpegPpi(rawBlob, PRINT_PPI);
      const sizeKB = Math.round((ppiBlob.size / 1024) * 10) / 10;
      const filename = `sun-nova-id-xerox-${presetId}-${arrangement}-${paperKey}-300ppi.jpg`;
      triggerBlobDownload(ppiBlob, filename);
      setExportStatus(`Downloaded ${filename} (${sizeKB} KB · 300 PPI)`);
    } catch {
      setErrorStatus("Failed to export ID Xerox sheet.");
    }
  };

  const handleApplyCropResult = (
    result: DocumentCropResult,
    keepOpenForTarget?: DocCropTarget
  ) => {
    setSingleUploadUrl(result.sourceUrl);
    if (result.target === "front") {
      setFrontSrc(result.dataUrl);
      setFrontRot(0);
    } else if (result.target === "back") {
      setBackSrc(result.dataUrl);
      setBackRot(0);
    } else {
      setPresetId("custom_mm");
      setCustomWMm(result.widthMm);
      setCustomHMm(result.heightMm);
      setCardScalePct(100);
      setFrontSrc(result.dataUrl);
      setFrontRot(0);
    }
    if (!keepOpenForTarget) {
      setCropModalState((s) => ({ ...s, isOpen: false }));
    }
    setErrorStatus(null);
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Columns: Upload One / Front & Back Cards + Live Sheet Preview */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Aadhaar, PAN, Voter ID &amp; DL Xerox Sheet
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono-nums">
                {activeCardDims.wMm} × {activeCardDims.hMm} mm (
                {activeCardDims.wPx} × {activeCardDims.hPx} px @ 300 PPI)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                <Scissors className="w-3.5 h-3.5" />
                <span>Upload One &amp; Crop Both</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadOneAndCrop}
                  className="hidden"
                />
              </label>

              {singleUploadUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setCropModalState({
                      isOpen: true,
                      sourceUrl: singleUploadUrl,
                      target: "front",
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Crop Tool</span>
                </button>
              )}

              {(frontSrc || backSrc) && (
                <button
                  type="button"
                  onClick={() => {
                    const tmpSrc = frontSrc;
                    const tmpRot = frontRot;
                    setFrontSrc(backSrc);
                    setFrontRot(backRot);
                    setBackSrc(tmpSrc);
                    setBackRot(tmpRot);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Swap Front / Back</span>
                </button>
              )}
            </div>
          </div>

          {/* Front & Back Uploaders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {(
              [
                {
                  key: "front" as const,
                  title: "Front Side (Aadhaar / PAN)",
                  src: frontSrc,
                  rot: frontRot,
                  setRot: setFrontRot,
                  clear: () => setFrontSrc(null),
                },
                {
                  key: "back" as const,
                  title: "Back Side (Optional)",
                  src: backSrc,
                  rot: backRot,
                  setRot: setBackRot,
                  clear: () => setBackSrc(null),
                },
              ]
            ).map((card) => (
              <div
                key={card.key}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>{card.title}</span>
                  {card.src && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCropModalState({
                            isOpen: true,
                            sourceUrl: card.src,
                            target: card.key,
                          })
                        }
                        className="p-1 text-slate-600 hover:text-amber-700 cursor-pointer"
                        title="Preparative Crop & Size"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => card.setRot((r) => (r + 90) % 360)}
                        className="p-1 text-slate-600 hover:text-amber-700 cursor-pointer"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={card.clear}
                        className="p-1 text-slate-500 hover:text-red-600 cursor-pointer"
                        title="Remove card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {card.src ? (
                  <div className="h-32 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                    <img
                      src={card.src}
                      alt={card.title}
                      referrerPolicy="no-referrer"
                      style={{ transform: `rotate(${card.rot}deg)` }}
                      className="max-h-full max-w-full object-contain transition-transform"
                    />
                  </div>
                ) : (
                  <div className="h-32 border border-dashed border-slate-300 rounded bg-white flex flex-col items-center justify-center gap-2 px-3 text-center">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-md cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(card.key, e)}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setCameraTarget(card.key)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Click</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      JPG, PNG or Camera photo
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Live Sheet Preview */}
          <div className="bg-slate-100 rounded-lg border border-slate-200 p-4 flex flex-col items-center">
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 mb-3 font-mono-nums">
              <span className="font-semibold text-slate-800">{paper.label}</span>
              <span>
                {setsCount} {setsCount === 1 ? "Set" : "Sets"} ·{" "}
                {colorMode === "bw_xerox"
                  ? "B&W Xerox"
                  : colorMode === "grayscale"
                  ? "Grayscale"
                  : "Color"}
              </span>
            </div>

            <canvas
              ref={previewCanvasRef}
              className="max-w-full max-h-[380px] w-auto h-auto shadow-md border border-slate-300 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Right 5 Columns: Document Size Maker, Up/Down Arrangement & Xerox Settings */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
        {/* 01. Document / Card Size Maker */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="id-preset-select"
              className="text-xs font-semibold text-slate-700"
            >
              01. Document / Card Size (300 PPI)
            </label>
            <button
              type="button"
              onClick={() =>
                setCropModalState({
                  isOpen: true,
                  sourceUrl: singleUploadUrl || frontSrc || backSrc,
                  target: "custom",
                })
              }
              className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
            >
              Open Size Cropper
            </button>
          </div>
          <select
            id="id-preset-select"
            value={presetId}
            onChange={(e) => setPresetId(e.target.value as IdPresetId)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {Object.entries(ID_PRESETS).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
              </option>
            ))}
          </select>

          {presetId === "custom_mm" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">
                  Width (mm)
                </label>
                <input
                  type="number"
                  min={20}
                  max={200}
                  step={0.5}
                  value={customWMm}
                  onChange={(e) => setCustomWMm(Number(e.target.value))}
                  className="w-full font-mono-nums border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">
                  Height (mm)
                </label>
                <input
                  type="number"
                  min={20}
                  max={285}
                  step={0.5}
                  value={customHMm}
                  onChange={(e) => setCustomHMm(Number(e.target.value))}
                  className="w-full font-mono-nums border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
              <span>Document Scale on Sheet</span>
              <span className="font-mono-nums font-semibold">
                {cardScalePct}% ({activeCardDims.wMm} × {activeCardDims.hMm} mm)
              </span>
            </div>
            <input
              type="range"
              min={70}
              max={130}
              step={2}
              value={cardScalePct}
              onChange={(e) => setCardScalePct(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>
        </div>

        {/* 02. Xerox / Print Tone */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">
            02. Xerox / Print Tone
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: "bw_xerox", label: "B&W Xerox" },
                { id: "grayscale", label: "Grayscale" },
                { id: "color", label: "Full Color" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setColorMode(mode.id)}
                className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  colorMode === mode.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Brightness</span>
                <span className="font-mono-nums">{brightness}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={160}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Contrast</span>
                <span className="font-mono-nums">{contrast}%</span>
              </div>
              <input
                type="range"
                min={80}
                max={180}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 03. Paper, Sets & Front/Back Up-Down Layout */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="id-paper-select"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                03. Paper Size
              </label>
              <select
                id="id-paper-select"
                value={paperKey}
                onChange={(e) => setPaperKey(e.target.value as IdPaperKey)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="a4">A4 Sheet</option>
                <option value="4x6">4 × 6 inch</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="id-sets-select"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Copies ({arrangement === "front_only" ? "Cards" : "Sets"})
              </label>
              <select
                id="id-sets-select"
                value={setsCount}
                onChange={(e) => setSetsCount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {Array.from({ length: maxSetsOnPaper }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}{" "}
                      {arrangement === "front_only"
                        ? n === 1
                          ? "Card"
                          : "Cards"
                        : n === 1
                        ? "Set (Front+Back)"
                        : "Sets"}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Front / Back Arrangement
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: "side_by_side", label: "Side-by-Side" },
                  { id: "up_down", label: "Up / Down" },
                  { id: "grid_2x2", label: "2×2 Grid" },
                  { id: "front_only", label: "Front Only" },
                ] as const
              ).map((arr) => (
                <button
                  key={arr.id}
                  type="button"
                  onClick={() => setArrangement(arr.id)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                    arrangement === arr.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {arr.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <span className="block text-[11px] text-slate-600 mb-1">
                Position on Sheet
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: "top", label: "Top" },
                    { id: "center", label: "Mid" },
                    { id: "bottom", label: "Bottom" },
                  ] as const
                ).map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setVerticalAnchor(pos.id)}
                    className={`px-1.5 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      verticalAnchor === pos.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-1">
                Gap &amp; Edge Margin
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  aria-label="Card gap"
                  value={gapMm}
                  onChange={(e) => setGapMm(Number(e.target.value))}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-900 bg-white"
                >
                  <option value={3}>3mm gap</option>
                  <option value={6}>6mm gap</option>
                  <option value={10}>10mm gap</option>
                  <option value={15}>15mm gap</option>
                </select>
                <select
                  aria-label="Edge margin"
                  value={marginTopMm}
                  onChange={(e) => setMarginTopMm(Number(e.target.value))}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-900 bg-white"
                >
                  <option value={6}>6mm edge</option>
                  <option value={10}>10mm edge</option>
                  <option value={18}>18mm edge</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSideLabels}
                onChange={(e) => setShowSideLabels(e.target.checked)}
                className="rounded border-slate-300 accent-amber-600"
              />
              <span>Print FRONT / BACK Labels</span>
            </label>
            <button
              type="button"
              onClick={() =>
                setFitMode((m) => (m === "contain" ? "cover" : "contain"))
              }
              className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded cursor-pointer"
            >
              Fit: {fitMode === "contain" ? "Full Card" : "Fill Box"}
            </button>
          </div>
        </div>

        {/* 04. Outline / Cut Border Customize */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              04. Outline / Cut Frame
            </span>
            <span className="font-mono-nums text-slate-600">
              {borderWidthPx === 0
                ? "None"
                : `${borderWidthPx} px · ${outlineStyle}`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            {OUTLINE_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setOutlineStyle(st.id)}
                className={`py-1 text-xs font-semibold rounded-md cursor-pointer ${
                  outlineStyle === st.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                <span>Thickness</span>
                <span className="font-mono-nums">{borderWidthPx} px</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={borderWidthPx}
                onChange={(e) => setBorderWidthPx(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                <span>Outer Offset</span>
                <span className="font-mono-nums">+{outlineOffsetPx} px</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={2}
                value={outlineOffsetPx}
                onChange={(e) => setOutlineOffsetPx(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs text-slate-600">Outline Color:</span>
            <div className="flex items-center gap-1.5">
              {BORDER_COLOR_PRESETS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setBorderColor(c.hex)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full border cursor-pointer ${
                    borderColor.toUpperCase() === c.hex
                      ? "ring-2 ring-amber-500 border-slate-900"
                      : "border-slate-300"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              <input
                type="color"
                aria-label="Custom outline color"
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
                className="w-6 h-6 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
              />
            </div>
          </div>
        </div>

        {errorStatus && (
          <div
            role="alert"
            className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {errorStatus}
          </div>
        )}
        {exportStatus && (
          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono-nums">
            {exportStatus}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <button
            type="button"
            onClick={handleDownloadXeroxSheet}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Download 300 PPI Xerox Sheet (JPG)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onMailQuery(
                `ID Card Xerox Print (${activeCardDims.wMm}×${activeCardDims.hMm}mm · ${arrangement} · ${paper.label} · ${setsCount} ${setsCount === 1 ? "Set" : "Sets"} · ${colorMode})`
              )
            }
            className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span>Send Xerox Query on Mail</span>
          </button>
        </div>
      </div>

      <CameraCaptureModal
        isOpen={cameraTarget !== null}
        onClose={() => setCameraTarget(null)}
        onCapture={(blob) => {
          const url = URL.createObjectURL(blob);
          setSingleUploadUrl(url);
          if (cameraTarget === "front") {
            setFrontSrc(url);
            setFrontRot(0);
          } else if (cameraTarget === "back") {
            setBackSrc(url);
            setBackRot(0);
          } else if (cameraTarget === "one_crop") {
            setCropModalState({
              isOpen: true,
              sourceUrl: url,
              target: "front",
            });
          }
          setErrorStatus(null);
        }}
      />

      <DocumentCropModal
        isOpen={cropModalState.isOpen}
        initialSourceUrl={cropModalState.sourceUrl}
        initialTarget={cropModalState.target}
        defaultWidthMm={activeCardDims.wMm}
        defaultHeightMm={activeCardDims.hMm}
        onClose={() => setCropModalState((s) => ({ ...s, isOpen: false }))}
        onApply={handleApplyCropResult}
      />
    </section>
  );
}
