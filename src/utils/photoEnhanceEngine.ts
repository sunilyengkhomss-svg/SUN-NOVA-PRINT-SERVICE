import { PRINT_PPI } from "../types/photo";
import { setJpegPpi } from "./imageProcessing";

export type UpscaleTargetMode = "hd" | "4k";

export interface DeblurSharpenOptions {
  deblur: number; // 0 - 100
  sharpness: number; // 0 - 100
  denoise: number; // 0 - 100
}

export interface NaturalFaceRetouchOptions {
  smoothSkin: number; // 0 - 100
  removeBlemishes: number; // 0 - 100
  skinBrighten: number; // 0 - 100 (Fair glow & under-eye shadow lift)
  evenTone: number; // 0 - 100 (Even complexion & oil-shine control)
  facialClarity: number; // 0 - 100 (Eyes, lashes, brows, hair clarity)
}

export interface ColorLightingOptions {
  exposure: number; // -100 to +100
  shadows: number; // -50 to +80
  highlights: number; // -80 to +50
  brightness: number; // -50 to +50
  contrast: number; // -50 to +50
  warmth: number; // -50 to +50
  tint: number; // -50 to +50
  vibrance: number; // -50 to +70
}

export const DEFAULT_COLOR_LIGHTING_OPTIONS: ColorLightingOptions = {
  exposure: 0,
  shadows: 0,
  highlights: 0,
  brightness: 0,
  contrast: 0,
  warmth: 0,
  tint: 0,
  vibrance: 0,
};

export type EnhanceBackgroundFill =
  | "transparent"
  | "#FFFFFF"
  | "#1D63B8"
  | "#CBE4F9"
  | "#E5E7EB"
  | "custom"
  | "image";

export interface PrintExportOptions {
  format: "jpeg" | "png";
  jpegQuality: number; // 0.7 - 1.0
  dimensionMode: "original" | "preset" | "custom";
  targetWidthPx: number;
  targetHeightPx: number;
  preserveAspectRatio: boolean;
  backgroundFillHex?: string;
}

export interface UpscaleExecutionResult {
  blob: Blob;
  width: number;
  height: number;
  backend: string;
  scaleFactor: 2 | 4;
  wasInputCapped: boolean;
}

export interface AddedObjectSpec {
  kind: "image" | "text";
  image?: HTMLImageElement | null;
  text?: string;
  textColor?: string;
  textBgColor?: string | null;
  xPct: number; // 0 - 100 center X on base photo
  yPct: number; // 0 - 100 center Y on base photo
  scalePct: number; // 10 - 200 (% of base short edge or 40% reference)
  rotationDeg: number; // -180 to +180
  opacity: number; // 10 - 100
  flipX: boolean;
  shadow: number; // 0 - 100
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image file."));
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/png" | "image/jpeg",
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to encode output image."));
      },
      mimeType,
      quality
    );
  });
}

// ============================================================================
// FAST O(N) SEPARABLE BLUR UTILITIES (Supports Arbitrary Resolution-Scaled Radii)
// ============================================================================

function boxBlurHorizontal(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  r: number
): void {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const fv = src[row];
    const lv = src[row + w - 1];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) {
      val += src[row + Math.min(w - 1, j)];
    }
    for (let x = 0; x <= r; x++) {
      const rx = Math.min(w - 1, x + r);
      val += src[row + rx] - fv;
      if (x < w) dst[row + x] = val * iarr;
    }
    for (let x = r + 1; x < w - r; x++) {
      val += src[row + x + r] - src[row + x - r - 1];
      dst[row + x] = val * iarr;
    }
    for (let x = Math.max(r + 1, w - r); x < w; x++) {
      const lx = Math.max(0, x - r - 1);
      val += lv - src[row + lx];
      dst[row + x] = val * iarr;
    }
  }
}

function boxBlurVertical(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  r: number
): void {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    const fv = src[x];
    const lv = src[(h - 1) * w + x];
    let val = (r + 1) * fv;
    for (let j = 0; j < r; j++) {
      val += src[Math.min(h - 1, j) * w + x];
    }
    for (let y = 0; y <= r; y++) {
      const ry = Math.min(h - 1, y + r);
      val += src[ry * w + x] - fv;
      if (y < h) dst[y * w + x] = val * iarr;
    }
    for (let y = r + 1; y < h - r; y++) {
      val += src[(y + r) * w + x] - src[(y - r - 1) * w + x];
      dst[y * w + x] = val * iarr;
    }
    for (let y = Math.max(r + 1, h - r); y < h; y++) {
      const ly = Math.max(0, y - r - 1);
      val += lv - src[ly * w + x];
      dst[y * w + x] = val * iarr;
    }
  }
}

/**
 * O(W*H) 3-pass sliding-window Gaussian approximation.
 * Scales seamlessly to large radii (1px to 48px) on 2K-4K photos in milliseconds.
 */
function fastBlurFloat(
  src: Float32Array,
  w: number,
  h: number,
  sigma: number
): Float32Array {
  const s = Math.max(0.5, Math.min(48, sigma));
  if (s <= 1.8) {
    return exactSmallGaussianFloat(src, w, h, s);
  }
  const boxes = 3;
  const wIdeal = Math.sqrt((12 * s * s) / boxes + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const mIdeal =
    (12 * s * s - boxes * wl * wl - 4 * boxes * wl - 3 * boxes) /
    (-4 * wl - 4);
  const m = Math.round(mIdeal);

  let cur = new Float32Array(src);
  let tmp = new Float32Array(w * h);

  for (let i = 0; i < boxes; i++) {
    const r = Math.max(1, Math.floor(((i < m ? wl : wu) - 1) / 2));
    boxBlurHorizontal(cur, tmp, w, h, r);
    boxBlurVertical(tmp, cur, w, h, r);
  }
  return cur;
}

function exactSmallGaussianFloat(
  src: Float32Array,
  w: number,
  h: number,
  sigma: number
): Float32Array {
  const s = Math.max(0.45, Math.min(3.5, sigma));
  const r = Math.max(1, Math.min(6, Math.ceil(s * 2.1)));
  const kSize = r * 2 + 1;
  const kernel = new Float32Array(kSize);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const val = Math.exp(-(i * i) / (2 * s * s));
    kernel[i + r] = val;
    sum += val;
  }
  for (let i = 0; i < kSize; i++) kernel[i] /= sum;

  const temp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const sx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k;
        acc += src[rowOff + sx] * kernel[k + r];
      }
      temp[rowOff + x] = acc;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const sy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k;
        acc += temp[sy * w + x] * kernel[k + r];
      }
      out[y * w + x] = acc;
    }
  }

  return out;
}

// ============================================================================
// TRUE 300 PPI PNG pHYs CHUNK WRITER (11811 pixels per meter = 300.00 DPI)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export async function setPngPpi(blob: Blob, ppi = PRINT_PPI): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return blob;
  }

  const ppm = Math.round(ppi / 0.0254);

  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9, false);
  chunk[4] = 0x70;
  chunk[5] = 0x48;
  chunk[6] = 0x59;
  chunk[7] = 0x73;
  view.setUint32(8, ppm, false);
  view.setUint32(12, ppm, false);
  chunk[16] = 1;
  const crc = crc32(chunk.subarray(4, 17));
  view.setUint32(17, crc, false);

  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let inserted = false;

  while (offset + 12 <= bytes.length) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
    const len = dv.getUint32(0, false);
    const chunkTotal = 12 + len;
    if (offset + chunkTotal > bytes.length) break;

    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    if (type !== "pHYs") {
      parts.push(bytes.subarray(offset, offset + chunkTotal));
    }
    if (type === "IHDR" && !inserted) {
      parts.push(chunk);
      inserted = true;
    }
    offset += chunkTotal;
  }

  if (offset < bytes.length) {
    parts.push(bytes.subarray(offset));
  }

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }

  return new Blob([out], { type: "image/png" });
}

// ============================================================================
// SAFE IMAGE PREPARATION (Guards Browser Memory on Oversized Raw Photos)
// ============================================================================

export async function prepareSafeUploadedImage(
  fileOrBlob: Blob,
  maxEdge = 4096
): Promise<{
  blob: Blob;
  url: string;
  width: number;
  height: number;
  wasResizedForSafety: boolean;
}> {
  const rawUrl = URL.createObjectURL(fileOrBlob);
  try {
    const img = await loadImageFromUrl(rawUrl);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    if (origW <= maxEdge && origH <= maxEdge) {
      return {
        blob: fileOrBlob,
        url: rawUrl,
        width: origW,
        height: origH,
        wasResizedForSafety: false,
      };
    }

    const ratio = maxEdge / Math.max(origW, origH);
    const w = Math.max(1, Math.round(origW * ratio));
    const h = Math.max(1, Math.round(origH * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const safeBlob = await canvasToBlob(canvas, "image/png");
    URL.revokeObjectURL(rawUrl);
    return {
      blob: safeBlob,
      url: URL.createObjectURL(safeBlob),
      width: w,
      height: h,
      wasResizedForSafety: true,
    };
  } catch (err) {
    URL.revokeObjectURL(rawUrl);
    throw err;
  }
}

// ============================================================================
// TOOL A: GENUINE IN-BROWSER OPEN-SOURCE REAL-ESRGAN AI HD / 4K UPSCALING
// ============================================================================

export function computePredictedUpscaleSize(
  srcW: number,
  srcH: number,
  mode: UpscaleTargetMode
): {
  inputW: number;
  inputH: number;
  outputW: number;
  outputH: number;
  scaleFactor: 2 | 4;
  wasInputCapped: boolean;
} {
  const scaleFactor: 2 | 4 = mode === "4k" ? 4 : 2;
  const maxInputLongEdge = mode === "4k" ? 960 : 1024;
  const maxDim = Math.max(srcW, srcH);

  let inputW = srcW;
  let inputH = srcH;
  let wasInputCapped = false;

  if (maxDim > maxInputLongEdge) {
    const ratio = maxInputLongEdge / maxDim;
    inputW = Math.max(32, Math.round(srcW * ratio));
    inputH = Math.max(32, Math.round(srcH * ratio));
    wasInputCapped = true;
  }

  return {
    inputW,
    inputH,
    outputW: inputW * scaleFactor,
    outputH: inputH * scaleFactor,
    scaleFactor,
    wasInputCapped,
  };
}

export async function runNeuralEsrganUpscale(
  img: HTMLImageElement,
  mode: UpscaleTargetMode,
  preserveTransparency: boolean,
  onProgress?: (pct: number, stage: string, backendLabel?: string) => void,
  polishDetail = 40
): Promise<UpscaleExecutionResult> {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const plan = computePredictedUpscaleSize(srcW, srcH, mode);

  onProgress?.(4, "Loading open-source ESRGAN neural engine...");
  await nextFrame();

  let tf: typeof import("@tensorflow/tfjs");
  let UpscalerCtor: (typeof import("upscaler"))["default"];
  let rawModelDef: Record<string, unknown>;

  try {
    const [tfMod, upscalerMod, modelMod] = await Promise.all([
      import("@tensorflow/tfjs"),
      import("upscaler"),
      plan.scaleFactor === 4
        ? import("@upscalerjs/esrgan-slim/4x")
        : import("@upscalerjs/esrgan-slim/2x"),
    ]);
    tf = tfMod;
    UpscalerCtor = upscalerMod.default;
    rawModelDef = (modelMod.default || modelMod) as unknown as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Open-source ESRGAN AI model could not be loaded in this browser (${
        err instanceof Error ? err.message : "module error"
      }).`
    );
  }

  try {
    await tf.ready();
  } catch {
    throw new Error(
      "TensorFlow.js AI runtime could not initialize in this browser. WebGL or CPU backend is unavailable."
    );
  }

  const backendRaw = tf.getBackend() || "cpu";
  const backendLabel =
    backendRaw === "webgl" ? "WebGL GPU" : backendRaw.toUpperCase();

  onProgress?.(
    10,
    `Initializing ESRGAN ${plan.scaleFactor}× neural weights (${backendLabel})...`,
    backendLabel
  );

  const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const localModelPath = `${baseUrl}models/esrgan-slim/x${plan.scaleFactor}/model.json`;

  const modelDefinition = {
    ...rawModelDef,
    path: localModelPath,
  };

  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = plan.inputW;
  inputCanvas.height = plan.inputH;
  const inCtx = inputCanvas.getContext("2d");
  if (!inCtx) throw new Error("Canvas context unavailable.");
  inCtx.imageSmoothingEnabled = true;
  inCtx.imageSmoothingQuality = "high";

  if (!preserveTransparency) {
    inCtx.fillStyle = "#FFFFFF";
    inCtx.fillRect(0, 0, plan.inputW, plan.inputH);
  }
  inCtx.drawImage(img, 0, 0, plan.inputW, plan.inputH);

  let upscaler: InstanceType<typeof UpscalerCtor> | null = null;
  try {
    upscaler = new UpscalerCtor({
      model: modelDefinition as never,
    });

    await upscaler.warmup([{ patchSize: 64, padding: 4 }]);
    onProgress?.(
      16,
      `Running ESRGAN ${plan.scaleFactor}× super-resolution (${backendLabel})...`,
      backendLabel
    );

    const outputDataUrl = (await upscaler.upscale(inputCanvas, {
      patchSize: 64,
      padding: 4,
      output: "base64",
      awaitNextFrame: true,
      progress: (amount: number) => {
        const pct = Math.min(90, Math.max(16, Math.round(16 + amount * 74)));
        onProgress?.(
          pct,
          `Neural ESRGAN ${plan.scaleFactor}× upscaling (${Math.round(amount * 100)}%)`,
          backendLabel
        );
      },
    })) as string;

    onProgress?.(93, "Refining micro-details & edge crispness...", backendLabel);
    await nextFrame();

    const upscaledImg = await loadImageFromUrl(outputDataUrl);
    const outW = upscaledImg.naturalWidth || plan.outputW;
    const outH = upscaledImg.naturalHeight || plan.outputH;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = outW;
    finalCanvas.height = outH;
    const fCtx = finalCanvas.getContext("2d");
    if (!fCtx) throw new Error("Output canvas context unavailable.");
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = "high";
    fCtx.drawImage(upscaledImg, 0, 0, outW, outH);

    // Post-ESRGAN luminance detail & micro-contrast polish (makes HD/4K crispness unmistakable)
    if (polishDetail > 0) {
      const imgData = fCtx.getImageData(0, 0, outW, outH);
      const data = imgData.data;
      const total = outW * outH;
      const Y = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        const p = i * 4;
        Y[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      }

      const resScale = Math.max(1, Math.min(2.2, Math.max(outW, outH) / 1400));
      const fineBlur = fastBlurFloat(Y, outW, outH, 1.15 * resScale);
      const midBlur = fastBlurFloat(Y, outW, outH, 3.6 * resScale);
      const pNorm = Math.max(0, Math.min(1, polishDetail / 100));
      const fineGain = pNorm * 1.15;
      const midGain = pNorm * 0.28;

      for (let i = 0; i < total; i++) {
        const p = i * 4;
        if (preserveTransparency && data[p + 3] < 8) continue;
        const fine = Y[i] - fineBlur[i];
        const mid = Y[i] - midBlur[i];
        const gatedFine =
          Math.abs(fine) > 1.8
            ? Math.sign(fine) * (Math.abs(fine) - 1.8)
            : 0;
        const boost =
          Math.tanh((gatedFine * fineGain + mid * midGain) / 36) * 36;
        if (boost !== 0) {
          data[p] = clampByte(data[p] + boost);
          data[p + 1] = clampByte(data[p + 1] + boost);
          data[p + 2] = clampByte(data[p + 2] + boost);
        }
      }
      fCtx.putImageData(imgData, 0, 0);
    }

    if (preserveTransparency) {
      const alphaCanvas = document.createElement("canvas");
      alphaCanvas.width = outW;
      alphaCanvas.height = outH;
      const aCtx = alphaCanvas.getContext("2d");
      if (aCtx) {
        aCtx.imageSmoothingEnabled = true;
        aCtx.imageSmoothingQuality = "high";
        aCtx.drawImage(img, 0, 0, outW, outH);
        const alphaData = aCtx.getImageData(0, 0, outW, outH).data;
        const rgbImageData = fCtx.getImageData(0, 0, outW, outH);
        const rgbData = rgbImageData.data;
        for (let i = 3; i < rgbData.length; i += 4) {
          rgbData[i] = alphaData[i];
        }
        fCtx.putImageData(rgbImageData, 0, 0);
      }
    }

    const blob = await canvasToBlob(finalCanvas, "image/png");
    onProgress?.(100, `ESRGAN ${plan.scaleFactor}× complete`, backendLabel);

    return {
      blob,
      width: outW,
      height: outH,
      backend: backendLabel,
      scaleFactor: plan.scaleFactor,
      wasInputCapped: plan.wasInputCapped,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `AI ESRGAN ${plan.scaleFactor}× model unavailable or failed on this device: ${detail}`
    );
  } finally {
    if (upscaler) {
      try {
        await upscaler.dispose();
      } catch {
        // Ignore dispose cleanup warnings
      }
    }
  }
}

// ============================================================================
// TOOL B: RESOLUTION-ADAPTIVE DEBLUR (RICHARDSON-LUCY), SHARPENING & DENOISE
// ============================================================================

export async function runDeblurAndSharpen(
  img: HTMLImageElement,
  options: DeblurSharpenOptions,
  preserveTransparency: boolean,
  onProgress?: (pct: number, stage: string) => void
): Promise<Blob> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const total = w * h;
  const resScale = Math.max(1, Math.min(2.4, Math.max(w, h) / 1000));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  onProgress?.(10, "Analyzing luminance, blur radius & digital grain...");
  await nextFrame();

  const Y = new Float32Array(total);
  const Cb = new Float32Array(total);
  const Cr = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
  }

  let workY = Y;

  // Stage 1: Edge-Preserving Noise Reduction (luma bilateral + smooth chroma denoise)
  if (options.denoise > 0) {
    onProgress?.(28, "Reducing digital noise while keeping sharp edges...");
    await nextFrame();

    const strength = options.denoise / 100;
    const sigmaRange = 10 + strength * 28;
    const invTwoSigmaR2 = 1 / (2 * sigmaRange * sigmaRange);
    const radius = strength > 0.5 ? 2 : 1;
    const denoisedY = new Float32Array(total);

    // Smooth chroma noise fast without losing sharp luminance details
    const smoothCb = fastBlurFloat(Cb, w, h, (0.9 + strength * 1.4) * resScale);
    const smoothCr = fastBlurFloat(Cr, w, h, (0.9 + strength * 1.4) * resScale);
    const chromaMix = 0.35 + strength * 0.55;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const centerY = workY[idx];
        let wSum = 0;
        let accY = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
          const nRow = ny * w;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
            const nIdx = nRow + nx;
            const diff = workY[nIdx] - centerY;
            const spatial = Math.exp(
              -(dx * dx + dy * dy) / (2 * radius * radius)
            );
            const range = Math.exp(-(diff * diff) * invTwoSigmaR2);
            const wt = spatial * range;
            wSum += wt;
            accY += workY[nIdx] * wt;
          }
        }

        const inv = wSum > 0 ? 1 / wSum : 1;
        denoisedY[idx] =
          centerY + (accY * inv - centerY) * (0.45 + strength * 0.55);
        Cb[idx] = Cb[idx] + (smoothCb[idx] - Cb[idx]) * chromaMix;
        Cr[idx] = Cr[idx] + (smoothCr[idx] - Cr[idx]) * chromaMix;
      }
    }
    workY = denoisedY;
  }

  // Stage 2: Resolution-Scaled Iterative Richardson-Lucy Deconvolution
  if (options.deblur > 0) {
    onProgress?.(55, "Recovering focus & tightening blurred edges...");
    await nextFrame();

    const deblurNorm = options.deblur / 100;
    const iterations = deblurNorm > 0.7 ? 6 : deblurNorm > 0.35 ? 4 : 3;
    const psfSigma = (0.95 + deblurNorm * 1.05) * resScale;

    const observed = new Float32Array(total);
    const estimate = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const v = Math.max(1, workY[i] + 1);
      observed[i] = v;
      estimate[i] = v;
    }

    const ratioBuf = new Float32Array(total);
    for (let iter = 0; iter < iterations; iter++) {
      const conv = fastBlurFloat(estimate, w, h, psfSigma);
      for (let i = 0; i < total; i++) {
        ratioBuf[i] = observed[i] / Math.max(1e-3, conv[i]);
      }
      const correction = fastBlurFloat(ratioBuf, w, h, psfSigma);
      const damping = 0.65 + deblurNorm * 0.35;
      const maxDelta = 36 + deblurNorm * 44;
      for (let i = 0; i < total; i++) {
        const nextVal = estimate[i] * (1 + (correction[i] - 1) * damping);
        const clamped = Math.max(
          observed[i] - maxDelta,
          Math.min(observed[i] + maxDelta, nextVal)
        );
        estimate[i] = Math.max(1, Math.min(256, clamped));
      }
      await nextFrame();
    }

    const blend = 0.45 + deblurNorm * 0.55;
    for (let i = 0; i < total; i++) {
      const recovered = estimate[i] - 1;
      workY[i] = workY[i] + (recovered - workY[i]) * blend;
    }
  }

  // Stage 3: Dual-Scale Crispness & Local Clarity Sharpening
  if (options.sharpness > 0) {
    onProgress?.(84, "Enhancing fine detail crispness & micro-contrast...");
    await nextFrame();

    const sharpNorm = options.sharpness / 100;
    const blurFine = fastBlurFloat(workY, w, h, 1.05 * resScale);
    const blurMid = fastBlurFloat(workY, w, h, 3.4 * resScale);
    const fineAmount = sharpNorm * 1.85;
    const midAmount = sharpNorm * 0.42;
    const noiseGate = 1.8;

    for (let i = 0; i < total; i++) {
      const fine = workY[i] - blurFine[i];
      const mid = workY[i] - blurMid[i];
      let fineBoost = 0;
      if (Math.abs(fine) > noiseGate) {
        const sign = fine >= 0 ? 1 : -1;
        fineBoost = sign * (Math.abs(fine) - noiseGate) * fineAmount;
      }
      const midBoost = mid * midAmount;
      const totalBoost = Math.tanh((fineBoost + midBoost) / 56) * 56;
      workY[i] = Math.max(0, Math.min(255, workY[i] + totalBoost));
    }
  }

  // Reconstruct RGB cleanly from YCbCr
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (preserveTransparency && data[p + 3] === 0) continue;
    const yv = workY[i];
    const cb = Cb[i];
    const cr = Cr[i];
    data[p] = clampByte(yv + 1.402 * cr);
    data[p + 1] = clampByte(yv - 0.344136 * cb - 0.714136 * cr);
    data[p + 2] = clampByte(yv + 1.772 * cb);
  }

  ctx.putImageData(imgData, 0, 0);
  onProgress?.(100, "Blur removal & sharpening complete");
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// TOOL C: NEURAL BACKGROUND REMOVAL & REPLACEMENT (@imgly/background-removal)
// ============================================================================

export async function runNeuralBackgroundRemoval(
  sourceBlob: Blob,
  onProgress?: (pct: number, stage: string) => void
): Promise<Blob> {
  onProgress?.(6, "Loading on-device neural cutout model...");
  try {
    const { removeBackground } = await import("@imgly/background-removal");

    const runWithConfig = async (device: "gpu" | "cpu") =>
      removeBackground(sourceBlob, {
        device,
        output: { format: "image/png", quality: 1 },
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const pct = Math.min(
              96,
              Math.max(8, Math.round((current / total) * 100))
            );
            const label = key.toLowerCase().includes("fetch")
              ? `Downloading AI cutout model (${pct}%)`
              : `Segmenting hair & subject edges (${pct}%)`;
            onProgress?.(pct, label);
          }
        },
      });

    let resultBlob: Blob;
    try {
      // CPU WASM is most reliable across desktop/mobile iframes; try CPU directly first for stability
      resultBlob = await runWithConfig("cpu");
    } catch {
      onProgress?.(12, "Retrying neural segmentation with fallback runtime...");
      resultBlob = await runWithConfig("gpu");
    }

    onProgress?.(100, "Background removed cleanly");
    return resultBlob;
  } catch (err) {
    throw new Error(
      `Background removal AI model could not run in this browser (${
        err instanceof Error ? err.message : "runtime error"
      }).`
    );
  }
}

export async function compositeBackgroundFill(
  cutoutImg: HTMLImageElement,
  fillHex: string | null,
  options?: {
    bgImage?: HTMLImageElement | null;
    edgeFeatherPx?: number; // 0 - 3
  }
): Promise<Blob> {
  const w = cutoutImg.naturalWidth || cutoutImg.width;
  const h = cutoutImg.naturalHeight || cutoutImg.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");

  ctx.clearRect(0, 0, w, h);

  // 1. Optional custom background photograph (cover-fit cleanly)
  if (options?.bgImage) {
    const bg = options.bgImage;
    const bgW = bg.naturalWidth || bg.width;
    const bgH = bg.naturalHeight || bg.height;
    const srcAspect = bgW / Math.max(1, bgH);
    const dstAspect = w / Math.max(1, h);
    let sx = 0;
    let sy = 0;
    let sw = bgW;
    let sh = bgH;
    if (srcAspect > dstAspect) {
      sw = bgH * dstAspect;
      sx = (bgW - sw) / 2;
    } else {
      sh = bgW / dstAspect;
      sy = (bgH - sh) / 2;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, w, h);
  } else if (fillHex) {
    ctx.fillStyle = fillHex;
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Optional edge feathering on the cutout alpha mask for studio-smooth hair/shoulders
  const feather = options?.edgeFeatherPx ?? 0;
  if (feather > 0.1) {
    const fgCanvas = document.createElement("canvas");
    fgCanvas.width = w;
    fgCanvas.height = h;
    const fgCtx = fgCanvas.getContext("2d");
    if (fgCtx) {
      fgCtx.drawImage(cutoutImg, 0, 0, w, h);
      const fgData = fgCtx.getImageData(0, 0, w, h);
      const d = fgData.data;
      const total = w * h;
      const alpha = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        alpha[i] = d[i * 4 + 3];
      }
      const blurredA = fastBlurFloat(alpha, w, h, feather);
      for (let i = 0; i < total; i++) {
        // Slightly tighten outer fringe while softening transition
        const origA = alpha[i];
        const softA = blurredA[i];
        const refined = origA < 250 ? Math.min(origA, softA * 1.05) : origA;
        d[i * 4 + 3] = clampByte(refined);
      }
      fgCtx.putImageData(fgData, 0, 0);
      ctx.drawImage(fgCanvas, 0, 0, w, h);
      return canvasToBlob(canvas, "image/png");
    }
  }

  ctx.drawImage(cutoutImg, 0, 0, w, h);
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// TOOL D: STUDIO FACE & IMAGE BEAUTY SKIN ENHANCE (Resolution-Adaptive)
// ============================================================================

function computeInclusiveSkinMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  resScale: number
): Float32Array {
  const total = w * h;
  const rawMask = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (data[p + 3] < 32) continue;

    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    // Broad inclusive skin gamut covering fair, wheatish, olive, tan, brown, and deep tones
    // Also tolerate slightly cool/warm indoor lighting shifts
    if (
      y > 24 &&
      y < 250 &&
      cb >= 70 &&
      cb <= 135 &&
      cr >= 129 &&
      cr <= 182 &&
      r >= g * 0.92 &&
      r >= b * 0.95
    ) {
      const cbDist = Math.abs(cb - 103) / 31;
      const crDist = Math.abs(cr - 153) / 26;
      const d = Math.sqrt(cbDist * cbDist + crDist * crDist);
      if (d < 1.2) {
        // Protect very dark pupils/eyelashes/brows and overly saturated red lips
        const lumaFactor = y < 52 ? Math.max(0, (y - 24) / 28) : 1;
        const satFactor = cr > 171 ? Math.max(0, 1 - (cr - 171) / 11) : 1;
        rawMask[i] =
          Math.max(0, Math.min(1, (1.2 - d) * 1.45)) * lumaFactor * satFactor;
      }
    }
  }

  return fastBlurFloat(rawMask, w, h, 2.2 * resScale);
}

export async function runNaturalFaceRetouch(
  img: HTMLImageElement,
  options: NaturalFaceRetouchOptions,
  preserveTransparency: boolean,
  onProgress?: (pct: number, stage: string) => void
): Promise<Blob> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const total = w * h;
  // Critical: scale kernels with image resolution so high-res photos get visible, studio-grade beauty results!
  const resScale = Math.max(1, Math.min(3.8, Math.max(w, h) / 720));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  onProgress?.(12, "Mapping facial skin, eyes & hair zones...");
  await nextFrame();

  const skinMask = computeInclusiveSkinMask(data, w, h, resScale);

  const R = new Float32Array(total);
  const G = new Float32Array(total);
  const B = new Float32Array(total);
  const Y = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    R[i] = data[p];
    G[i] = data[p + 1];
    B[i] = data[p + 2];
    Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
  }

  // Stage 1: Multi-Scale Blemish, Pimple & Acne Spot Removal
  if (options.removeBlemishes > 0) {
    onProgress?.(28, "Clearing pimples, dark spots & skin blemishes...");
    await nextFrame();

    const strength = options.removeBlemishes / 100;
    const radii = [3.6 * resScale, 7.2 * resScale];

    for (const rad of radii) {
      const medR = fastBlurFloat(R, w, h, rad);
      const medG = fastBlurFloat(G, w, h, rad);
      const medB = fastBlurFloat(B, w, h, rad);
      const medY = fastBlurFloat(Y, w, h, rad);

      for (let i = 0; i < total; i++) {
        const m = skinMask[i];
        if (m < 0.14) continue;

        // Detect localized dark acne spots (Y dip) or inflamed red blemishes (R-G spike)
        const localRed = R[i] - G[i];
        const bgRed = medR[i] - medG[i];
        const redExcess = Math.max(0, localRed - bgRed - 2.8);
        const darkDip = Math.max(0, medY[i] - Y[i] - 4.0);

        // Guard eyes, pupils, nostrils, glasses rims (very steep luminance drops)
        if (darkDip > 62) continue;

        const spotScore = Math.min(
          1,
          (redExcess / 13 + darkDip / 19) * strength * 1.15
        );
        if (spotScore > 0.03) {
          const blend = Math.min(0.94, spotScore * m);
          R[i] = R[i] + (medR[i] - R[i]) * blend;
          G[i] = G[i] + (medG[i] - G[i]) * blend;
          B[i] = B[i] + (medB[i] - B[i]) * blend;
          Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
        }
      }
      await nextFrame();
    }
  }

  // Stage 2: Resolution-Adaptive Frequency-Separated Skin Smoothing
  if (options.smoothSkin > 0) {
    onProgress?.(50, "Smoothing skin texture while keeping natural pores...");
    await nextFrame();

    const strength = (options.smoothSkin / 100) * 0.86;
    const lowSigma = (3.4 + (options.smoothSkin / 100) * 3.8) * resScale;
    const lowR = fastBlurFloat(R, w, h, lowSigma);
    const lowG = fastBlurFloat(G, w, h, lowSigma);
    const lowB = fastBlurFloat(B, w, h, lowSigma);
    const microBlurY = fastBlurFloat(Y, w, h, 1.15 * resScale);

    // Keep authentic micro-texture proportional to inverse smoothness (never waxy/plastic)
    const microTexKeep = Math.max(0.14, 0.34 - (options.smoothSkin / 100) * 0.18);

    for (let i = 0; i < total; i++) {
      const m = skinMask[i];
      if (m < 0.08) continue;

      const lowY = 0.299 * lowR[i] + 0.587 * lowG[i] + 0.114 * lowB[i];
      const diffLuma = Math.abs(Y[i] - lowY);
      // Protect real facial contours (eyelids, nose bridge, lips, glasses)
      const edgeKeep = Math.exp(-(diffLuma * diffLuma) / (2 * 24 * 24));
      const blend = m * strength * edgeKeep;

      const microTex = (Y[i] - microBlurY[i]) * microTexKeep;
      R[i] = R[i] + (lowR[i] + microTex - R[i]) * blend;
      G[i] = G[i] + (lowG[i] + microTex - G[i]) * blend;
      B[i] = B[i] + (lowB[i] + microTex - B[i]) * blend;
      Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
    }
  }

  // Stage 3: Even Skin Tone & Oil-Shine Glare Control
  if (options.evenTone > 0) {
    onProgress?.(66, "Evening skin complexion & reducing forehead shine...");
    await nextFrame();

    const evenNorm = options.evenTone / 100;
    const broadSigma = 14 * resScale;
    const broadR = fastBlurFloat(R, w, h, broadSigma);
    const broadG = fastBlurFloat(G, w, h, broadSigma);
    const broadB = fastBlurFloat(B, w, h, broadSigma);
    const broadY = fastBlurFloat(Y, w, h, broadSigma);

    for (let i = 0; i < total; i++) {
      const m = skinMask[i];
      if (m < 0.1) continue;

      // 3a. Evening blotchy chroma variations while preserving natural shading (Y)
      const curY = Math.max(1, Y[i]);
      const bY = Math.max(1, broadY[i]);
      const targetR = (broadR[i] / bY) * curY;
      const targetG = (broadG[i] / bY) * curY;
      const targetB = (broadB[i] / bY) * curY;
      const chromaBlend = m * evenNorm * 0.52;

      R[i] = R[i] + (targetR - R[i]) * chromaBlend;
      G[i] = G[i] + (targetG - G[i]) * chromaBlend;
      B[i] = B[i] + (targetB - B[i]) * chromaBlend;

      // 3b. Softly tone down harsh oily glare hotspots (pixels much brighter than surrounding skin)
      const glare = Y[i] - broadY[i];
      if (glare > 14 && Y[i] > 175) {
        const reduce = Math.min(0.45, ((glare - 14) / 55) * evenNorm * m);
        R[i] = R[i] + (broadR[i] * 1.06 - R[i]) * reduce;
        G[i] = G[i] + (broadG[i] * 1.06 - G[i]) * reduce;
        B[i] = B[i] + (broadB[i] * 1.06 - B[i]) * reduce;
      }

      Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
    }
  }

  // Stage 4: Skin Brighten, Fair Glow & Under-Eye Shadow Softening
  if (options.skinBrighten > 0) {
    onProgress?.(78, "Adding studio radiance & brightening skin tone...");
    await nextFrame();

    const glowNorm = options.skinBrighten / 100;
    const localY = fastBlurFloat(Y, w, h, 10 * resScale);

    for (let i = 0; i < total; i++) {
      const m = skinMask[i];
      if (m < 0.08) continue;

      const yn = Math.max(0, Math.min(1, Y[i] / 255));
      // Smooth midtone/shadow skin radiance curve that protects bright highlights from clipping
      const highlightGuard = Math.pow(1 - yn, 0.72);
      const baseLift = glowNorm * 26 * m * highlightGuard;

      // Soften dark under-eye / harsh facial shadow dips naturally
      const shadowDip = Math.max(0, localY[i] - Y[i]);
      const underEyeLift =
        shadowDip > 4 && shadowDip < 48
          ? Math.min(14, shadowDip * 0.32 * glowNorm * m)
          : 0;

      const totalLift = baseLift + underEyeLift;

      // Clean luminous tone (very slight rosy freshness, never orange/yellow)
      R[i] = Math.min(255, R[i] + totalLift * 1.03);
      G[i] = Math.min(255, G[i] + totalLift * 1.0);
      B[i] = Math.min(255, B[i] + totalLift * 1.02);
      Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
    }
  }

  // Stage 5: Crisp Eyes, Lashes, Eyebrows & Facial Clarity
  if (options.facialClarity > 0) {
    onProgress?.(90, "Sharpening eyes, lashes & facial definition...");
    await nextFrame();

    const clarityNorm = options.facialClarity / 100;
    const fineBlurY = fastBlurFloat(Y, w, h, 1.15 * resScale);
    const midBlurY = fastBlurFloat(Y, w, h, 3.8 * resScale);

    for (let i = 0; i < total; i++) {
      const p = i * 4;
      if (preserveTransparency && data[p + 3] < 16) continue;

      const m = skinMask[i];
      // Strongest crispness on eyes, brows, lashes, hair (non-skin) + subtle definition on skin
      const featureWeight = 1 - m * 0.72;
      const microDetail =
        (Y[i] - fineBlurY[i]) * clarityNorm * 1.25 * featureWeight;
      const localContrast =
        (Y[i] - midBlurY[i]) * clarityNorm * 0.34 * featureWeight;
      const delta = Math.tanh((microDetail + localContrast) / 34) * 34;

      R[i] += delta;
      G[i] += delta;
      B[i] += delta;
    }
  }

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (preserveTransparency && data[p + 3] === 0) continue;
    data[p] = clampByte(R[i]);
    data[p + 1] = clampByte(G[i]);
    data[p + 2] = clampByte(B[i]);
  }

  ctx.putImageData(imgData, 0, 0);
  onProgress?.(100, "Beauty skin enhancement complete");
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// TOOL E: STUDIO COLOUR & LIGHTING CORRECTION (Exposure, Shadows, Highlights, WB)
// ============================================================================

export function analyzeAutoColorCorrection(
  img: HTMLImageElement
): ColorLightingOptions {
  const sampleMax = 280;
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;
  const scale = Math.min(1, sampleMax / Math.max(origW, origH));
  const w = Math.max(16, Math.round(origW * scale));
  const h = Math.max(16, Math.round(origH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ...DEFAULT_COLOR_LIGHTING_OPTIONS };
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  const hist = new Uint32Array(256);
  let count = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumY = 0;
  let sumSat = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    hist[y]++;
    sumR += r;
    sumG += g;
    sumB += b;
    sumY += y;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    sumSat += maxC > 0 ? (maxC - minC) / maxC : 0;
    count++;
  }

  if (count === 0) return { ...DEFAULT_COLOR_LIGHTING_OPTIONS };

  let acc = 0;
  let p02 = 0;
  let p15 = 0;
  let p95 = 255;
  let p98 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= count * 0.02 && p02 === 0) p02 = v;
    if (acc >= count * 0.15 && p15 === 0) p15 = v;
    if (acc >= count * 0.95 && p95 === 255) p95 = v;
    if (acc >= count * 0.98) {
      p98 = v;
      break;
    }
  }

  const meanY = sumY / count;
  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;
  const meanSat = sumSat / count;

  // Target bright, clean studio midtone (~136)
  const exposure = Math.max(
    -45,
    Math.min(60, Math.round(((136 - meanY) / 128) * 62))
  );
  const brightness = Math.max(
    -16,
    Math.min(20, Math.round(((132 - meanY) / 128) * 14))
  );

  // Lift dark/backlit shadows automatically, recover hot highlights
  const shadows =
    p15 < 65 ? Math.min(55, Math.round(((68 - p15) / 68) * 58)) : 8;
  const highlights =
    p95 > 235 ? Math.max(-45, -Math.round(((p95 - 230) / 25) * 35)) : -6;

  // Dynamic range contrast boost for flat/hazy photos
  const range = Math.max(30, p98 - p02);
  const contrast =
    range < 205
      ? Math.min(34, Math.round(((222 - range) / 222) * 42))
      : range > 246
        ? 4
        : 12;

  // Skin-safe White Balance correction
  const gray = (meanR + meanG + meanB) / 3;
  const rbDiff = (meanB - meanR) / Math.max(40, gray);
  const warmth = Math.max(-24, Math.min(24, Math.round(rbDiff * 40)));

  const gDiff = (meanG - (meanR + meanB) * 0.5) / Math.max(40, gray);
  const tint = Math.max(-18, Math.min(18, Math.round(gDiff * 32)));

  // Noticeable vibrance boost for dull/flat prints
  const vibrance =
    meanSat < 0.32 ? Math.min(36, Math.round((0.38 - meanSat) * 105)) : 14;

  return {
    exposure,
    shadows,
    highlights,
    brightness,
    contrast,
    warmth,
    tint,
    vibrance,
  };
}

export async function runColorAndLightingCorrection(
  img: HTMLImageElement,
  options: ColorLightingOptions,
  preserveTransparency: boolean,
  onProgress?: (pct: number, stage: string) => void
): Promise<Blob> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(img, 0, 0, w, h);

  onProgress?.(20, "Balancing exposure, shadows, highlights & colours...");
  await nextFrame();

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const evGain = Math.pow(2, (options.exposure / 100) * 1.25);
  const shadowNorm = options.shadows / 100;
  const highlightNorm = options.highlights / 100;
  const brightOffset = (options.brightness / 50) * 42;
  const contrastFactor = Math.pow((100 + options.contrast * 1.2) / 100, 1.3);

  const warmShift = (options.warmth / 50) * 22;
  const tintShift = (options.tint / 50) * 16;
  const vibranceAmt = options.vibrance / 100;

  for (let i = 0; i < data.length; i += 4) {
    if (preserveTransparency && data[i + 3] === 0) continue;

    // 1. Exposure + Brightness
    let r = data[i] * evGain + brightOffset;
    let g = data[i + 1] * evGain + brightOffset;
    let b = data[i + 2] * evGain + brightOffset;

    // 2. Smooth Shadows Lift & Highlights Recovery (preserves colour ratios)
    if (shadowNorm !== 0 || highlightNorm !== 0) {
      const cr = Math.max(0, Math.min(255, r));
      const cg = Math.max(0, Math.min(255, g));
      const cb = Math.max(0, Math.min(255, b));
      const luma = (0.299 * cr + 0.587 * cg + 0.114 * cb) / 255;

      let toneDelta = 0;
      if (shadowNorm !== 0) {
        const sWeight = Math.pow(1 - luma, 2.15);
        toneDelta += shadowNorm * 95 * sWeight;
      }
      if (highlightNorm !== 0) {
        const hWeight = Math.pow(luma, 2.15);
        toneDelta += highlightNorm * 95 * hWeight;
      }

      if (toneDelta !== 0) {
        const baseLuma = Math.max(6, luma * 255);
        const newLuma = Math.max(0, Math.min(255, baseLuma + toneDelta));
        const ratio = newLuma / baseLuma;
        // Blend multiplicative ratio with additive offset for natural shadow colour
        const addPart = toneDelta * 0.35;
        r = r * (0.65 * ratio + 0.35) + addPart;
        g = g * (0.65 * ratio + 0.35) + addPart;
        b = b * (0.65 * ratio + 0.35) + addPart;
      }
    }

    // 3. White Balance (Temperature + Tint)
    r += warmShift + tintShift * 0.5;
    g -= tintShift * 0.7;
    b -= warmShift - tintShift * 0.5;

    // 4. Contrast around mid-gray (128)
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // 5. Perceptual Vibrance (richer colours without clipping skin/reds)
    if (vibranceAmt !== 0) {
      const cr = Math.max(0, Math.min(255, r));
      const cg = Math.max(0, Math.min(255, g));
      const cb = Math.max(0, Math.min(255, b));
      const maxC = Math.max(cr, cg, cb);
      const minC = Math.min(cr, cg, cb);
      const avg = (cr + cg + cb) / 3;
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
      const amt = vibranceAmt * (1 - sat * 0.65) * 1.15;
      r = cr + (cr - avg) * amt;
      g = cg + (cg - avg) * amt;
      b = cb + (cb - avg) * amt;
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }

  ctx.putImageData(imgData, 0, 0);
  onProgress?.(100, "Colour & lighting correction applied");
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// TOOL F: REMOVE ANY OBJECT (Multi-Scale Pyramid Diffusion + Texture Synthesis)
// ============================================================================

interface PyramidLevel {
  w: number;
  h: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  mask: Uint8Array; // 1 = masked (to inpaint), 0 = known background
}

function downsampleLevel(src: PyramidLevel): PyramidLevel {
  const nw = Math.max(2, Math.floor(src.w / 2));
  const nh = Math.max(2, Math.floor(src.h / 2));
  const r = new Float32Array(nw * nh);
  const g = new Float32Array(nw * nh);
  const b = new Float32Array(nw * nh);
  const mask = new Uint8Array(nw * nh);

  for (let y = 0; y < nh; y++) {
    const sy0 = Math.min(src.h - 1, y * 2);
    const sy1 = Math.min(src.h - 1, sy0 + 1);
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.min(src.w - 1, x * 2);
      const sx1 = Math.min(src.w - 1, sx0 + 1);
      const ids = [
        sy0 * src.w + sx0,
        sy0 * src.w + sx1,
        sy1 * src.w + sx0,
        sy1 * src.w + sx1,
      ];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let knownCount = 0;
      for (const idx of ids) {
        if (src.mask[idx] === 0) {
          sr += src.r[idx];
          sg += src.g[idx];
          sb += src.b[idx];
          knownCount++;
        }
      }
      const outIdx = y * nw + x;
      if (knownCount > 0) {
        r[outIdx] = sr / knownCount;
        g[outIdx] = sg / knownCount;
        b[outIdx] = sb / knownCount;
        mask[outIdx] = 0;
      } else {
        r[outIdx] =
          (src.r[ids[0]] + src.r[ids[1]] + src.r[ids[2]] + src.r[ids[3]]) * 0.25;
        g[outIdx] =
          (src.g[ids[0]] + src.g[ids[1]] + src.g[ids[2]] + src.g[ids[3]]) * 0.25;
        b[outIdx] =
          (src.b[ids[0]] + src.b[ids[1]] + src.b[ids[2]] + src.b[ids[3]]) * 0.25;
        mask[outIdx] = 1;
      }
    }
  }
  return { w: nw, h: nh, r, g, b, mask };
}

function upsampleMaskedPixels(coarse: PyramidLevel, fine: PyramidLevel): void {
  const cw = coarse.w;
  const ch = coarse.h;
  const fw = fine.w;
  const fh = fine.h;

  for (let y = 0; y < fh; y++) {
    const gy = (y / Math.max(1, fh - 1)) * (ch - 1);
    const y0 = Math.floor(gy);
    const y1 = Math.min(ch - 1, y0 + 1);
    const wy = gy - y0;
    for (let x = 0; x < fw; x++) {
      const idx = y * fw + x;
      if (fine.mask[idx] === 0) continue;
      const gx = (x / Math.max(1, fw - 1)) * (cw - 1);
      const x0 = Math.floor(gx);
      const x1 = Math.min(cw - 1, x0 + 1);
      const wx = gx - x0;

      const i00 = y0 * cw + x0;
      const i10 = y0 * cw + x1;
      const i01 = y1 * cw + x0;
      const i11 = y1 * cw + x1;

      const w00 = (1 - wx) * (1 - wy);
      const w10 = wx * (1 - wy);
      const w01 = (1 - wx) * wy;
      const w11 = wx * wy;

      fine.r[idx] =
        coarse.r[i00] * w00 +
        coarse.r[i10] * w10 +
        coarse.r[i01] * w01 +
        coarse.r[i11] * w11;
      fine.g[idx] =
        coarse.g[i00] * w00 +
        coarse.g[i10] * w10 +
        coarse.g[i01] * w01 +
        coarse.g[i11] * w11;
      fine.b[idx] =
        coarse.b[i00] * w00 +
        coarse.b[i10] * w10 +
        coarse.b[i01] * w01 +
        coarse.b[i11] * w11;
    }
  }
}

function diffuseMaskedRegion(
  lvl: PyramidLevel,
  iterations: number,
  omega = 1.65
): void {
  const { w, h, r, g, b, mask } = lvl;
  // Build compact list of masked pixel indices for fast SOR Gauss-Seidel relaxation
  const maskedIndices: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      if (mask[row + x] === 1) maskedIndices.push(row + x);
    }
  }
  // Handle border masked pixels too
  for (let x = 0; x < w; x++) {
    if (mask[x] === 1) maskedIndices.push(x);
    if (h > 1 && mask[(h - 1) * w + x] === 1) maskedIndices.push((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    if (mask[y * w] === 1) maskedIndices.push(y * w);
    if (w > 1 && mask[y * w + (w - 1)] === 1) maskedIndices.push(y * w + (w - 1));
  }

  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < maskedIndices.length; k++) {
      const idx = maskedIndices[k];
      const y = Math.floor(idx / w);
      const x = idx - y * w;

      let sr = 0;
      let sg = 0;
      let sb = 0;
      let cnt = 0;

      if (x > 0) {
        const n = idx - 1;
        sr += r[n];
        sg += g[n];
        sb += b[n];
        cnt++;
      }
      if (x < w - 1) {
        const n = idx + 1;
        sr += r[n];
        sg += g[n];
        sb += b[n];
        cnt++;
      }
      if (y > 0) {
        const n = idx - w;
        sr += r[n];
        sg += g[n];
        sb += b[n];
        cnt++;
      }
      if (y < h - 1) {
        const n = idx + w;
        sr += r[n];
        sg += g[n];
        sb += b[n];
        cnt++;
      }

      if (cnt > 0) {
        const inv = 1 / cnt;
        r[idx] = Math.max(0, Math.min(255, r[idx] + omega * (sr * inv - r[idx])));
        g[idx] = Math.max(0, Math.min(255, g[idx] + omega * (sg * inv - g[idx])));
        b[idx] = Math.max(0, Math.min(255, b[idx] + omega * (sb * inv - b[idx])));
      }
    }
  }
}

export async function runObjectRemovalInpaint(
  img: HTMLImageElement,
  maskCanvas: HTMLCanvasElement,
  preserveTransparency: boolean,
  onProgress?: (pct: number, stage: string) => void
): Promise<Blob> {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Work at up to 1600px long edge for fast multi-scale pyramid + texture synthesis,
  // then composite ONLY the masked region back onto the original full-res image!
  const workMax = 1600;
  const workScale = Math.min(1, workMax / Math.max(origW, origH));
  const w = Math.max(32, Math.round(origW * workScale));
  const h = Math.max(32, Math.round(origH * workScale));
  const total = w * h;

  onProgress?.(10, "Preparing object removal mask...");
  await nextFrame();

  const workCanvas = document.createElement("canvas");
  workCanvas.width = w;
  workCanvas.height = h;
  const wCtx = workCanvas.getContext("2d");
  if (!wCtx) throw new Error("Canvas context unavailable.");
  wCtx.imageSmoothingEnabled = true;
  wCtx.imageSmoothingQuality = "high";
  wCtx.drawImage(img, 0, 0, w, h);

  const maskWorkCanvas = document.createElement("canvas");
  maskWorkCanvas.width = w;
  maskWorkCanvas.height = h;
  const mCtx = maskWorkCanvas.getContext("2d");
  if (!mCtx) throw new Error("Mask context unavailable.");
  mCtx.drawImage(maskCanvas, 0, 0, w, h);

  const workImgData = wCtx.getImageData(0, 0, w, h);
  const workData = workImgData.data;
  const maskData = mCtx.getImageData(0, 0, w, h).data;

  const rArr = new Float32Array(total);
  const gArr = new Float32Array(total);
  const bArr = new Float32Array(total);
  const maskArr = new Uint8Array(total);
  const softMask = new Float32Array(total);

  let maskedCount = 0;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      rArr[i] = workData[p];
      gArr[i] = workData[p + 1];
      bArr[i] = workData[p + 2];
      const isPainted = maskData[p + 3] > 28;
      if (isPainted) {
        maskArr[i] = 1;
        softMask[i] = 1;
        maskedCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maskedCount === 0) {
    throw new Error("Paint over the unwanted object on the photo first.");
  }
  if (maskedCount > total * 0.85) {
    throw new Error(
      "Too much of the image is painted. Paint only over the object you want to erase."
    );
  }

  // Dilate mask by 2px so edge fringes of the unwanted object are cleanly swallowed
  const dilated = new Uint8Array(maskArr);
  for (let y = Math.max(1, minY - 2); y <= Math.min(h - 2, maxY + 2); y++) {
    for (let x = Math.max(1, minX - 2); x <= Math.min(w - 2, maxX + 2); x++) {
      const i = y * w + x;
      if (
        maskArr[i] ||
        maskArr[i - 1] ||
        maskArr[i + 1] ||
        maskArr[i - w] ||
        maskArr[i + w]
      ) {
        dilated[i] = 1;
        softMask[i] = 1;
      }
    }
  }

  onProgress?.(24, "Building multi-scale structure pyramid...");
  await nextFrame();

  // Build coarse-to-fine pyramid (up to 6 levels so even wide objects fill cleanly!)
  const levels: PyramidLevel[] = [
    { w, h, r: rArr, g: gArr, b: bArr, mask: dilated },
  ];
  while (levels.length < 6) {
    const prev = levels[levels.length - 1];
    if (Math.min(prev.w, prev.h) <= 24) break;
    levels.push(downsampleLevel(prev));
  }

  // Seed coarsest level masked pixels with average of known pixels
  const coarsest = levels[levels.length - 1];
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let known = 0;
  for (let i = 0; i < coarsest.mask.length; i++) {
    if (coarsest.mask[i] === 0) {
      avgR += coarsest.r[i];
      avgG += coarsest.g[i];
      avgB += coarsest.b[i];
      known++;
    }
  }
  if (known > 0) {
    avgR /= known;
    avgG /= known;
    avgB /= known;
    for (let i = 0; i < coarsest.mask.length; i++) {
      if (coarsest.mask[i] === 1) {
        coarsest.r[i] = avgR;
        coarsest.g[i] = avgG;
        coarsest.b[i] = avgB;
      }
    }
  }

  // Solve coarse-to-fine harmonic diffusion
  for (let li = levels.length - 1; li >= 0; li--) {
    const lvl = levels[li];
    const pct = 30 + Math.round(((levels.length - 1 - li) / levels.length) * 42);
    onProgress?.(pct, "Reconstructing background behind removed object...");
    await nextFrame();

    const iters = li === levels.length - 1 ? 80 : li >= 2 ? 32 : 18;
    diffuseMaskedRegion(lvl, iters, 1.62);

    if (li > 0) {
      upsampleMaskedPixels(lvl, levels[li - 1]);
    }
  }

  onProgress?.(78, "Synthesizing matching natural background texture...");
  await nextFrame();

  // Extract high-frequency photographic texture from surrounding unmasked ring
  const baseLvl = levels[0];
  const origY = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    origY[i] = 0.299 * workData[i * 4] + 0.587 * workData[i * 4 + 1] + 0.114 * workData[i * 4 + 2];
  }
  const smoothOrigY = fastBlurFloat(origY, w, h, 2.2);

  // Collect donor texture samples from unmasked ring around bounding box
  const pad = Math.max(24, Math.round(Math.max(maxX - minX, maxY - minY) * 0.45));
  const rx0 = Math.max(2, minX - pad);
  const ry0 = Math.max(2, minY - pad);
  const rx1 = Math.min(w - 3, maxX + pad);
  const ry1 = Math.min(h - 3, maxY + pad);

  const donors: Array<{ x: number; y: number; luma: number }> = [];
  const step = Math.max(2, Math.floor(Math.sqrt((rx1 - rx0) * (ry1 - ry0) / 1400)));
  for (let y = ry0; y <= ry1; y += step) {
    for (let x = rx0; x <= rx1; x += step) {
      const idx = y * w + x;
      if (dilated[idx] === 0 && dilated[idx - 1] === 0 && dilated[idx + 1] === 0 && dilated[idx - w] === 0 && dilated[idx + w] === 0) {
        donors.push({ x, y, luma: smoothOrigY[idx] });
      }
    }
  }

  // Transfer matching local high-frequency detail into the smoothly inpainted region
  if (donors.length > 12) {
    const tile = 7;
    for (let y = Math.max(0, minY - 2); y <= Math.min(h - 1, maxY + 2); y += tile) {
      for (let x = Math.max(0, minX - 2); x <= Math.min(w - 1, maxX + 2); x += tile) {
        const cx = Math.min(w - 1, x + 3);
        const cy = Math.min(h - 1, y + 3);
        const cIdx = cy * w + cx;
        if (dilated[cIdx] === 0) continue;

        const targetLuma =
          0.299 * baseLvl.r[cIdx] +
          0.587 * baseLvl.g[cIdx] +
          0.114 * baseLvl.b[cIdx];

        // Pick closest donor in both spatial proximity and luminance
        let bestDonor = donors[0];
        let bestCost = Infinity;
        // Sample stride through donors for speed
        const dStride = Math.max(1, Math.floor(donors.length / 90));
        for (let di = 0; di < donors.length; di += dStride) {
          const d = donors[di];
          const dl = Math.abs(d.luma - targetLuma);
          const dist = Math.hypot(d.x - cx, d.y - cy) * 0.22;
          const cost = dl + dist;
          if (cost < bestCost) {
            bestCost = cost;
            bestDonor = d;
          }
        }

        for (let ty = 0; ty < tile && y + ty < h; ty++) {
          for (let tx = 0; tx < tile && x + tx < w; tx++) {
            const px = x + tx;
            const py = y + ty;
            const pIdx = py * w + px;
            if (dilated[pIdx] === 0) continue;

            const sx = Math.max(0, Math.min(w - 1, bestDonor.x + tx - 3));
            const sy = Math.max(0, Math.min(h - 1, bestDonor.y + ty - 3));
            const sIdx = sy * w + sx;
            if (dilated[sIdx] === 1) continue;

            const texDetail = Math.max(
              -16,
              Math.min(16, (origY[sIdx] - smoothOrigY[sIdx]) * 0.72)
            );
            baseLvl.r[pIdx] = Math.max(0, Math.min(255, baseLvl.r[pIdx] + texDetail));
            baseLvl.g[pIdx] = Math.max(0, Math.min(255, baseLvl.g[pIdx] + texDetail));
            baseLvl.b[pIdx] = Math.max(0, Math.min(255, baseLvl.b[pIdx] + texDetail));
          }
        }
      }
    }
  }

  // Feather mask edges cleanly so erased zone blends seamlessly with zero visible boundary
  const featheredMask = fastBlurFloat(softMask, w, h, 2.2);

  for (let i = 0; i < total; i++) {
    const alpha = Math.max(0, Math.min(1, featheredMask[i] * 1.15));
    if (alpha <= 0.01) continue;
    const p = i * 4;
    if (preserveTransparency && workData[p + 3] === 0) continue;
    workData[p] = clampByte(workData[p] * (1 - alpha) + baseLvl.r[i] * alpha);
    workData[p + 1] = clampByte(workData[p + 1] * (1 - alpha) + baseLvl.g[i] * alpha);
    workData[p + 2] = clampByte(workData[p + 2] * (1 - alpha) + baseLvl.b[i] * alpha);
  }
  wCtx.putImageData(workImgData, 0, 0);

  onProgress?.(94, "Blending seamlessly at full original resolution...");
  await nextFrame();

  // If photo was larger than workMax, composite ONLY the patched area over the untouched full-res original!
  if (workScale < 0.999) {
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = origW;
    fullCanvas.height = origH;
    const fCtx = fullCanvas.getContext("2d");
    if (!fCtx) throw new Error("Output canvas context unavailable.");
    fCtx.drawImage(img, 0, 0, origW, origH);

    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = origW;
    patchCanvas.height = origH;
    const pCtx = patchCanvas.getContext("2d");
    if (pCtx) {
      pCtx.imageSmoothingEnabled = true;
      pCtx.imageSmoothingQuality = "high";
      pCtx.drawImage(workCanvas, 0, 0, origW, origH);
      pCtx.globalCompositeOperation = "destination-in";
      pCtx.filter = "blur(2px)";
      pCtx.drawImage(maskCanvas, 0, 0, origW, origH);
      pCtx.filter = "none";
      fCtx.drawImage(patchCanvas, 0, 0, origW, origH);
    }

    onProgress?.(100, "Object removed cleanly");
    return canvasToBlob(fullCanvas, "image/png");
  }

  onProgress?.(100, "Object removed cleanly");
  return canvasToBlob(workCanvas, "image/png");
}

// ============================================================================
// TOOL F (PART 2): ADD ANY OBJECT / LOGO / STICKER / TEXT OVERLAY
// ============================================================================

export async function compositeAddedObject(
  baseImg: HTMLImageElement,
  spec: AddedObjectSpec,
  preserveTransparency: boolean
): Promise<Blob> {
  const w = baseImg.naturalWidth || baseImg.width;
  const h = baseImg.naturalHeight || baseImg.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");

  if (!preserveTransparency) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  ctx.drawImage(baseImg, 0, 0, w, h);

  const cx = (spec.xPct / 100) * w;
  const cy = (spec.yPct / 100) * h;
  const refSize = Math.min(w, h) * 0.42 * (spec.scalePct / 100);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((spec.rotationDeg * Math.PI) / 180);
  if (spec.flipX) {
    ctx.scale(-1, 1);
  }
  ctx.globalAlpha = Math.max(0.05, Math.min(1, spec.opacity / 100));

  if (spec.shadow > 0) {
    const s = spec.shadow / 100;
    ctx.shadowColor = `rgba(0, 0, 0, ${(0.25 + s * 0.45).toFixed(2)})`;
    ctx.shadowBlur = Math.max(4, Math.min(w, h) * 0.025 * s);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(2, Math.min(w, h) * 0.01 * s);
  }

  if (spec.kind === "image" && spec.image) {
    const objW = spec.image.naturalWidth || spec.image.width;
    const objH = spec.image.naturalHeight || spec.image.height;
    const aspect = objW / Math.max(1, objH);
    let drawW = refSize;
    let drawH = refSize / aspect;
    if (aspect < 1) {
      drawH = refSize;
      drawW = refSize * aspect;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(spec.image, -drawW / 2, -drawH / 2, drawW, drawH);
  } else if (spec.kind === "text" && spec.text && spec.text.trim()) {
    const label = spec.text.trim();
    const fontSize = Math.max(18, Math.round(refSize * 0.24));
    ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(label);
    const padX = fontSize * 0.55;
    const padY = fontSize * 0.34;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize * 1.25 + padY * 2;

    if (spec.textBgColor) {
      ctx.fillStyle = spec.textBgColor;
      const r = Math.min(boxH / 2, fontSize * 0.4);
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, r);
      ctx.fill();
    }

    ctx.fillStyle = spec.textColor || "#FFFFFF";
    ctx.fillText(label, 0, 0);
  }

  ctx.restore();
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// PRINT-READY 300 PPI EXPORT (JPG JFIF 300 PPI & PNG pHYs 300 PPI)
// ============================================================================

export async function exportPrintReadyPhoto(
  img: HTMLImageElement,
  options: PrintExportOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  let outW = srcW;
  let outH = srcH;

  if (options.dimensionMode !== "original") {
    const reqW = Math.max(64, Math.min(8000, Math.round(options.targetWidthPx)));
    const reqH = Math.max(64, Math.min(8000, Math.round(options.targetHeightPx)));
    if (options.preserveAspectRatio) {
      const srcAspect = srcW / Math.max(1, srcH);
      outW = reqW;
      outH = Math.max(64, Math.round(reqW / srcAspect));
    } else {
      outW = reqW;
      outH = reqH;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export context unavailable.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (options.format === "jpeg") {
    ctx.fillStyle = options.backgroundFillHex || "#FFFFFF";
    ctx.fillRect(0, 0, outW, outH);
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }

  if (options.dimensionMode !== "original" && !options.preserveAspectRatio) {
    const srcAspect = srcW / Math.max(1, srcH);
    const dstAspect = outW / Math.max(1, outH);
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (srcAspect > dstAspect) {
      sw = Math.round(srcH * dstAspect);
      sx = Math.round((srcW - sw) / 2);
    } else {
      sh = Math.round(srcW / dstAspect);
      sy = Math.round((srcH - sh) / 2);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  } else {
    ctx.drawImage(img, 0, 0, outW, outH);
  }

  if (options.format === "jpeg") {
    const rawJpg = await canvasToBlob(
      canvas,
      "image/jpeg",
      Math.max(0.7, Math.min(1, options.jpegQuality))
    );
    const ppiJpg = await setJpegPpi(rawJpg, PRINT_PPI);
    return { blob: ppiJpg, width: outW, height: outH };
  }

  const rawPng = await canvasToBlob(canvas, "image/png");
  const ppiPng = await setPngPpi(rawPng, PRINT_PPI);
  return { blob: ppiPng, width: outW, height: outH };
}
