import { Area } from "react-easy-crop";
import {
  BRAND_NAME,
  CutBorderStyle,
  DressStyleId,
  ImageFilterKey,
  OutlineStyle,
  PRINT_PPI,
  SheetLayoutResult,
  SheetOrientation,
} from "../types/photo";
import { buildDressDataUrl } from "./dressTemplates";

export function drawStyledOutlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  widthPx: number,
  color: string,
  style: OutlineStyle = "solid",
  offsetPx = 0
) {
  if (widthPx <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = widthPx;

  if (style === "dashed") {
    const dashLen = Math.max(8, widthPx * 3.5);
    const gapLen = Math.max(6, widthPx * 2.5);
    ctx.setLineDash([dashLen, gapLen]);
  } else if (style === "dotted") {
    const dotLen = Math.max(2, widthPx);
    const gapLen = Math.max(4, widthPx * 2);
    ctx.setLineDash([dotLen, gapLen]);
    ctx.lineCap = "round";
  } else {
    ctx.setLineDash([]);
  }

  if (offsetPx > 0) {
    // Draw cutting outline outside the tile edge by offsetPx
    ctx.strokeRect(
      x - offsetPx - widthPx / 2,
      y - offsetPx - widthPx / 2,
      w + offsetPx * 2 + widthPx,
      h + offsetPx * 2 + widthPx
    );
  } else {
    // Draw outline cleanly flush on the inner photo edge
    const half = widthPx / 2;
    ctx.strokeRect(x + half, y + half, w - widthPx, h - widthPx);
  }
  ctx.restore();
}

export function mmToPixels300Ppi(mm: number): number {
  return Math.round((mm / 25.4) * PRINT_PPI);
}

/**
 * Embeds true 300 PPI metadata into a JPEG Blob's JFIF APP0 header so
 * Photoshop, CorelDRAW, and studio photo printers open at exact inch/mm size.
 */
export async function setJpegPpi(blob: Blob, ppi = PRINT_PPI): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;

  if (
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    bytes[6] === 0x4a && // J
    bytes[7] === 0x46 && // F
    bytes[8] === 0x49 && // I
    bytes[9] === 0x46 && // F
    bytes[10] === 0x00
  ) {
    bytes[13] = 1; // units = dots per inch
    bytes[14] = (ppi >> 8) & 0xff;
    bytes[15] = ppi & 0xff;
    bytes[16] = (ppi >> 8) & 0xff;
    bytes[17] = ppi & 0xff;
    return new Blob([bytes], { type: "image/jpeg" });
  }

  const jfifHeader = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01,
    0x01,
    (ppi >> 8) & 0xff, ppi & 0xff,
    (ppi >> 8) & 0xff, ppi & 0xff,
    0x00, 0x00,
  ]);
  const combined = new Uint8Array(2 + jfifHeader.length + (bytes.length - 2));
  combined.set(bytes.subarray(0, 2), 0);
  combined.set(jfifHeader, 2);
  combined.set(bytes.subarray(2), 2 + jfifHeader.length);
  return new Blob([combined], { type: "image/jpeg" });
}

/**
 * Computes optimal paper orientation and grid layout preserving the EXACT same
 * gapPx horizontally and vertically across all papers, with optional custom photo count.
 */
export function calculateSheetLayout(
  paperW: number,
  paperH: number,
  tileW: number,
  tileH: number,
  gapPx: number,
  orientationPref: SheetOrientation = "auto",
  customCount?: number | null
): SheetLayoutResult {
  const minMargin = 16; // ~1.35mm safe outer edge

  const evaluate = (
    w: number,
    h: number,
    orientation: "Portrait" | "Landscape"
  ): SheetLayoutResult => {
    const cols = Math.max(
      1,
      Math.floor((w - 2 * minMargin + gapPx) / (tileW + gapPx))
    );
    const rows = Math.max(
      1,
      Math.floor((h - 2 * minMargin + gapPx) / (tileH + gapPx))
    );
    const maxCount = cols * rows;
    const count =
      customCount && customCount > 0
        ? Math.min(maxCount, Math.max(1, Math.round(customCount)))
        : maxCount;
    const activeRows = Math.ceil(count / cols);

    const usedW = cols * tileW + (cols - 1) * gapPx;
    const usedH = activeRows * tileH + (activeRows - 1) * gapPx;
    const startX = Math.round((w - usedW) / 2);

    // Anchor partial sheets neatly at top margin so remaining paper can be reused;
    // center vertically when printing a full sheet.
    const startY =
      activeRows < rows
        ? Math.max(36, Math.min(72, startX))
        : Math.round((h - usedH) / 2);

    return {
      sheetW: w,
      sheetH: h,
      cols,
      rows,
      maxCount,
      count,
      activeRows,
      orientation,
      startX,
      startY,
      usedW,
      usedH,
    };
  };

  const portrait = evaluate(paperW, paperH, "Portrait");
  const landscape = evaluate(paperH, paperW, "Landscape");

  if (orientationPref === "portrait") return portrait;
  if (orientationPref === "landscape") return landscape;
  return landscape.maxCount > portrait.maxCount ? landscape : portrait;
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for rendering."));
    img.src = src;
  });
}

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export function buildCanvasFilterString(
  brightness = 100,
  contrast = 100,
  imageFilter: ImageFilterKey = "none"
): string {
  switch (imageFilter) {
    case "grayscale":
      return `brightness(${brightness}%) contrast(${contrast}%) grayscale(100%)`;
    case "sepia":
      return `brightness(${brightness}%) contrast(${contrast}%) sepia(85%)`;
    case "high_contrast":
      return `brightness(${brightness}%) contrast(${Math.round(contrast * 1.32)}%) saturate(112%)`;
    case "warm":
      return `brightness(${brightness}%) contrast(${contrast}%) sepia(22%) saturate(115%)`;
    case "cool_studio":
      return `brightness(${brightness}%) contrast(${Math.round(contrast * 1.05)}%) saturate(92%) hue-rotate(-6deg)`;
    case "none":
    default:
      return `brightness(${brightness}%) contrast(${contrast}%)`;
  }
}

export interface RenderPhotoOptions {
  imageSrc: string;
  croppedAreaPixels: Area;
  outW: number;
  outH: number;
  bgColor: string;
  bgImageUrl?: string | null;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  imageFilter?: ImageFilterKey;
  nameText?: string;
  dateText?: string;
  dressId?: DressStyleId | string;
  dressCustomUrl?: string | null;
  dressScale?: number;
  dressOffsetX?: number;
  dressOffsetY?: number;
  borderWidthPx?: number;
  borderColor?: string;
  outlineStyle?: OutlineStyle;
  outlineOffsetPx?: number;
  applyBorderToSingle?: boolean;
}

export async function renderSinglePhotoCanvas(
  opts: RenderPhotoOptions
): Promise<HTMLCanvasElement> {
  const {
    imageSrc,
    croppedAreaPixels,
    outW,
    outH,
    bgColor,
    bgImageUrl = null,
    rotation = 0,
    brightness = 100,
    contrast = 100,
    imageFilter = "none",
    nameText = "",
    dateText = "",
    dressId = "none",
    dressCustomUrl = null,
    dressScale = 1,
    dressOffsetX = 0,
    dressOffsetY = 0,
    borderWidthPx = 0,
    borderColor = "#CBD5E1",
    outlineStyle = "solid",
    outlineOffsetPx = 0,
    applyBorderToSingle = false,
  } = opts;

  const image = await loadHtmlImage(imageSrc);

  // Step 1: Rotate source image onto a temporary canvas matching react-easy-crop geometry
  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = Math.round(bBoxWidth);
  rotCanvas.height = Math.round(bBoxHeight);
  const rotCtx = rotCanvas.getContext("2d")!;

  rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rotCtx.rotate(rotRad);
  rotCtx.translate(-image.width / 2, -image.height / 2);
  rotCtx.filter = buildCanvasFilterString(brightness, contrast, imageFilter);
  rotCtx.drawImage(image, 0, 0);

  // Step 2: Output canvas at exact target pixel dimensions
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext("2d")!;

  // Background fill (solid color fallback + optional custom backdrop image)
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, outW, outH);

  if (bgImageUrl) {
    try {
      const bgImg = await loadHtmlImage(bgImageUrl);
      const iw = bgImg.naturalWidth || bgImg.width;
      const ih = bgImg.naturalHeight || bgImg.height;
      const targetRatio = outW / outH;
      const imgRatio = iw / ih;
      let sx = 0;
      let sy = 0;
      let sw = iw;
      let sh = ih;
      if (imgRatio > targetRatio) {
        sw = ih * targetRatio;
        sx = (iw - sw) / 2;
      } else {
        sh = iw / targetRatio;
        sy = (ih - sh) / 2;
      }
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, outW, outH);
    } catch {
      // Keep solid bgColor if backdrop failed to load
    }
  }

  // Draw cropped portion scaled cleanly to outW x outH
  ctx.drawImage(
    rotCanvas,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outW,
    outH
  );

  // Step 2b: Optional Formal Passport Dress Overlay (built-in SVG or R2 PNG/WEBP)
  const resolvedDressUrl =
    dressCustomUrl || buildDressDataUrl(dressId as DressStyleId);
  if (resolvedDressUrl) {
    const dressImg = await loadHtmlImage(resolvedDressUrl);
    const dw = outW * dressScale;
    const dh = outH * dressScale;
    const dx = (outW - dw) / 2 + (dressOffsetX / 100) * outW;
    const dy = (outH - dh) / 2 + (dressOffsetY / 100) * outH;
    ctx.drawImage(dressImg, dx, dy, dw, dh);
  }

  // Step 3: Optional Name & DOP strip
  if (nameText.trim() || dateText.trim()) {
    const stripH = Math.round(outH * 0.14);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, outH - stripH, outW, stripH);

    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = Math.max(2, Math.round(outW * 0.005));
    ctx.beginPath();
    ctx.moveTo(0, outH - stripH);
    ctx.lineTo(outW, outH - stripH);
    ctx.stroke();

    ctx.fillStyle = "#0F172A";
    ctx.textAlign = "center";
    const fontSize = Math.max(11, Math.round(stripH * 0.34));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", Arial, sans-serif`;

    if (nameText.trim() && dateText.trim()) {
      ctx.fillText(
        nameText.trim().toUpperCase(),
        outW / 2,
        outH - stripH * 0.56,
        outW - 16
      );
      ctx.fillText(
        `DOP: ${dateText.trim()}`,
        outW / 2,
        outH - stripH * 0.16,
        outW - 16
      );
    } else {
      const singleLine = nameText.trim()
        ? nameText.trim().toUpperCase()
        : `DOP: ${dateText.trim()}`;
      ctx.fillText(singleLine, outW / 2, outH - stripH * 0.34, outW - 16);
    }
  }

  // Step 4: Optional Single Photo Border / Outline
  if (applyBorderToSingle && borderWidthPx > 0) {
    drawStyledOutlineRect(
      ctx,
      0,
      0,
      outW,
      outH,
      borderWidthPx,
      borderColor,
      outlineStyle,
      outlineOffsetPx > 0 ? 0 : 0
    );
  }

  return outCanvas;
}

/**
 * Smart portrait auto-crop for bulk multi-photo uploads: centers horizontally
 * and biases slightly toward the upper third so heads stay well framed.
 */
export async function autoCropImageToDataUrl(
  file: Blob,
  outW: number,
  outH: number,
  bgColor = "#FFFFFF"
): Promise<{ dataUrl: string; sourceUrl: string }> {
  const sourceUrl = URL.createObjectURL(file);
  const img = await loadHtmlImage(sourceUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const targetAspect = outW / outH;
  const srcAspect = srcW / srcH;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcAspect > targetAspect) {
    sw = srcH * targetAspect;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / targetAspect;
    sy = Math.max(0, (srcH - sh) * 0.18);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    sourceUrl,
  };
}

export interface RenderSheetOptions {
  singleCanvas?: HTMLCanvasElement;
  queueItems?: { dataUrl: string; copies: number }[];
  paperW: number;
  paperH: number;
  tileW: number;
  tileH: number;
  gapPx: number;
  gapMm: number;
  paperLabel: string;
  borderStyle?: CutBorderStyle;
  borderWidthPx?: number;
  borderColor?: string;
  outlineStyle?: OutlineStyle;
  outlineOffsetPx?: number;
  orientationPref?: SheetOrientation;
  customCount?: number | null;
}

export async function renderSheetCanvas(opts: RenderSheetOptions): Promise<{
  canvas: HTMLCanvasElement;
  layout: SheetLayoutResult;
}> {
  const {
    singleCanvas,
    queueItems,
    paperW,
    paperH,
    tileW,
    tileH,
    gapPx,
    gapMm,
    paperLabel,
    borderStyle,
    borderWidthPx,
    borderColor,
    outlineStyle = "solid",
    outlineOffsetPx = 0,
    orientationPref = "auto",
    customCount = null,
  } = opts;

  let effectiveCustomCount = customCount;
  let expandedTiles: HTMLImageElement[] | null = null;

  if (queueItems && queueItems.length > 0) {
    const loadedImgs = await Promise.all(
      queueItems.map((item) => loadHtmlImage(item.dataUrl))
    );
    expandedTiles = [];
    queueItems.forEach((item, idx) => {
      const count = Math.max(1, item.copies);
      for (let k = 0; k < count; k++) {
        expandedTiles!.push(loadedImgs[idx]);
      }
    });
    effectiveCustomCount = expandedTiles.length;
  }

  const layout = calculateSheetLayout(
    paperW,
    paperH,
    tileW,
    tileH,
    gapPx,
    orientationPref,
    effectiveCustomCount
  );

  const sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = layout.sheetW;
  sheetCanvas.height = layout.sheetH;
  const ctx = sheetCanvas.getContext("2d")!;

  // White studio photo paper background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, layout.sheetW, layout.sheetH);

  const drawCount = expandedTiles
    ? Math.min(layout.maxCount, expandedTiles.length)
    : layout.count;

  const resolvedBorderWidth =
    typeof borderWidthPx === "number"
      ? borderWidthPx
      : borderStyle === "none"
      ? 0
      : 2;
  const resolvedBorderColor =
    borderColor || (borderStyle === "dark" ? "#334155" : "#CBD5E1");

  for (let i = 0; i < drawCount; i++) {
    const r = Math.floor(i / layout.cols);
    const c = i % layout.cols;
    const x = layout.startX + c * (tileW + gapPx);
    const y = layout.startY + r * (tileH + gapPx);

    const source = expandedTiles ? expandedTiles[i] : singleCanvas;
    if (source) {
      ctx.drawImage(source, x, y, tileW, tileH);
    }

    if (resolvedBorderWidth > 0) {
      drawStyledOutlineRect(
        ctx,
        x,
        y,
        tileW,
        tileH,
        resolvedBorderWidth,
        resolvedBorderColor,
        outlineStyle,
        outlineOffsetPx
      );
    }
  }

  const bottomMargin = layout.sheetH - (layout.startY + layout.usedH);
  if (bottomMargin >= 34) {
    ctx.fillStyle = "#94A3B8";
    ctx.font = '500 20px "IBM Plex Mono", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(
      `${BRAND_NAME} · ${drawCount} Photos (${paperLabel} · ${gapMm}mm Gap · 300 PPI)`,
      layout.sheetW / 2,
      layout.sheetH - 12
    );
  }

  return { canvas: sheetCanvas, layout };
}

export async function exportCanvasWithTargetKB(
  canvas: HTMLCanvasElement,
  maxKB: number
): Promise<{ blob: Blob; sizeKB: number }> {
  const toBlob = (q: number) =>
    new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", q)
    );

  if (!maxKB || maxKB <= 0) {
    const raw = await toBlob(0.96);
    const ppiBlob = await setJpegPpi(raw, PRINT_PPI);
    return {
      blob: ppiBlob,
      sizeKB: Math.round((ppiBlob.size / 1024) * 10) / 10,
    };
  }

  const maxBytes = maxKB * 1024;
  let bestBlob = await toBlob(0.95);
  if (bestBlob.size > maxBytes) {
    let low = 0.05;
    let high = 0.95;
    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2;
      const blob = await toBlob(mid);
      if (blob.size <= maxBytes) {
        bestBlob = blob;
        low = mid;
      } else {
        high = mid;
      }
    }
  }

  const ppiBlob = await setJpegPpi(bestBlob, PRINT_PPI);
  return {
    blob: ppiBlob,
    sizeKB: Math.round((ppiBlob.size / 1024) * 10) / 10,
  };
}

export async function renderCroppedDocumentCanvas(opts: {
  imageSrc: string;
  croppedAreaPixels: Area;
  outW: number;
  outH: number;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  toneMode?: "color" | "grayscale" | "bw_xerox";
}): Promise<HTMLCanvasElement> {
  const {
    imageSrc,
    croppedAreaPixels,
    outW,
    outH,
    rotation = 0,
    brightness = 100,
    contrast = 100,
    toneMode = "color",
  } = opts;

  const image = await loadHtmlImage(imageSrc);
  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = Math.round(bBoxWidth);
  rotCanvas.height = Math.round(bBoxHeight);
  const rotCtx = rotCanvas.getContext("2d")!;

  rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rotCtx.rotate(rotRad);
  rotCtx.translate(-image.width / 2, -image.height / 2);

  const filterParts = [`brightness(${brightness}%)`, `contrast(${contrast}%)`];
  if (toneMode === "bw_xerox" || toneMode === "grayscale") {
    filterParts.push("grayscale(100%)");
  }
  rotCtx.filter = filterParts.join(" ");
  rotCtx.drawImage(image, 0, 0);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(
    rotCanvas,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outW,
    outH
  );

  if (toneMode === "bw_xerox") {
    const imgData = ctx.getImageData(0, 0, outW, outH);
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

  return outCanvas;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
