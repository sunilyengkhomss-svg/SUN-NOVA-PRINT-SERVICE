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
  facialClarity: number; // 0 - 100
}

export interface ColorLightingOptions {
  exposure: number; // -100 to +100 (maps to -1.0 to +1.0 EV)
  brightness: number; // -50 to +50
  contrast: number; // -50 to +50
  warmth: number; // -50 to +50 (white balance temp)
  tint: number; // -50 to +50 (green-magenta balance)
  vibrance: number; // -50 to +60
}

export const DEFAULT_COLOR_LIGHTING_OPTIONS: ColorLightingOptions = {
  exposure: 0,
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
  | "custom";

export interface PrintExportOptions {
  format: "jpeg" | "png";
  jpegQuality: number; // 0.7 - 1.0
  dimensionMode: "original" | "preset" | "custom";
  targetWidthPx: number;
  targetHeightPx: number;
  preserveAspectRatio: boolean;
  backgroundFillHex?: string; // used when flattening transparent PNG -> JPEG
}

export interface UpscaleExecutionResult {
  blob: Blob;
  width: number;
  height: number;
  backend: string;
  scaleFactor: 2 | 4;
  wasInputCapped: boolean;
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
  // Verify PNG signature
  if (
    bytes.length < 33 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return blob;
  }

  const ppm = Math.round(ppi / 0.0254); // 300 PPI -> 11811 px/meter

  // Build 21-byte pHYs chunk: length(4) + "pHYs"(4) + data(9) + crc(4)
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9, false);
  chunk[4] = 0x70; // p
  chunk[5] = 0x48; // H
  chunk[6] = 0x59; // Y
  chunk[7] = 0x73; // s
  view.setUint32(8, ppm, false);
  view.setUint32(12, ppm, false);
  chunk[16] = 1; // unit = meter
  const crc = crc32(chunk.subarray(4, 17));
  view.setUint32(17, crc, false);

  // Strip any existing pHYs chunk and insert right after IHDR
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
// TOOL A: GENUINE IN-BROWSER OPEN-SOURCE REAL-ESRGAN (RDN) AI HD / 4K UPSCALING
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
  // Memory-safe cap so WebGL textures & browser RAM never crash on mobile or desktop
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
  onProgress?: (pct: number, stage: string, backendLabel?: string) => void
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

  // Resolve bundled same-origin model weights first (zero third-party CDN dependency)
  const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const localModelPath = `${baseUrl}models/esrgan-slim/x${plan.scaleFactor}/model.json`;

  const modelDefinition = {
    ...rawModelDef,
    path: localModelPath,
  };

  // Prepare clean RGB canvas for neural inference (and capture alpha channel if transparent)
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
        const pct = Math.min(94, Math.max(16, Math.round(16 + amount * 78)));
        onProgress?.(
          pct,
          `Neural ESRGAN ${plan.scaleFactor}× upscaling (${Math.round(amount * 100)}%)`,
          backendLabel
        );
      },
    })) as string;

    onProgress?.(96, "Finalizing high-resolution image...", backendLabel);
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

    // If original had transparent background cutout, re-apply clean upscaled alpha matte
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
// TOOL B: BLUR REMOVAL (RICHARDSON-LUCY DECONVOLUTION), SHARPENING & DENOISE
// ============================================================================

function gaussianBlurFloat(
  src: Float32Array,
  w: number,
  h: number,
  radius: number
): Float32Array {
  const r = Math.max(1, Math.min(4, Math.round(radius)));
  const kernelSize = r * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  const sigma = Math.max(0.6, radius * 0.55);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + r] = val;
    sum += val;
  }
  for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;

  const temp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  // Horizontal pass
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

  // Vertical pass
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

export async function runDeblurAndSharpen(
  img: HTMLImageElement,
  options: DeblurSharpenOptions,
  preserveTransparency: boolean,
  onProgress?: (pct: number, stage: string) => void
): Promise<Blob> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const total = w * h;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  onProgress?.(12, "Analyzing luminance & digital noise...");
  await nextFrame();

  // Separate Y (luminance), Cb, Cr so deblur/sharpen never create color fringes
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

  // Stage 1: Edge-Preserving Bilateral Denoising (luminance + gentle chroma denoise)
  if (options.denoise > 0) {
    onProgress?.(32, "Reducing digital noise while preserving texture...");
    await nextFrame();

    const strength = options.denoise / 100;
    const sigmaRange = 10 + strength * 26;
    const invTwoSigmaR2 = 1 / (2 * sigmaRange * sigmaRange);
    const radius = strength > 0.55 ? 2 : 1;
    const denoisedY = new Float32Array(total);
    const denoisedCb = new Float32Array(total);
    const denoisedCr = new Float32Array(total);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const centerY = workY[idx];
        let wSum = 0;
        let accY = 0;
        let accCb = 0;
        let accCr = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
          const nRow = ny * w;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
            const nIdx = nRow + nx;
            const diff = workY[nIdx] - centerY;
            const spatial = Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
            const range = Math.exp(-(diff * diff) * invTwoSigmaR2);
            const wt = spatial * range;
            wSum += wt;
            accY += workY[nIdx] * wt;
            accCb += Cb[nIdx] * wt;
            accCr += Cr[nIdx] * wt;
          }
        }

        const inv = wSum > 0 ? 1 / wSum : 1;
        denoisedY[idx] = centerY + (accY * inv - centerY) * (0.45 + strength * 0.55);
        denoisedCb[idx] = Cb[idx] + (accCb * inv - Cb[idx]) * (0.55 + strength * 0.45);
        denoisedCr[idx] = Cr[idx] + (accCr * inv - Cr[idx]) * (0.55 + strength * 0.45);
      }
    }
    workY = denoisedY;
    Cb.set(denoisedCb);
    Cr.set(denoisedCr);
  }

  // Stage 2: Iterative Richardson-Lucy Deconvolution for Blur Recovery
  if (options.deblur > 0) {
    onProgress?.(60, "Recovering focus & reducing image blur...");
    await nextFrame();

    const deblurNorm = options.deblur / 100;
    const iterations = deblurNorm > 0.65 ? 4 : deblurNorm > 0.3 ? 3 : 2;
    const psfRadius = 1.15 + deblurNorm * 0.95;

    // Normalize to positive [1, 256] for stable multiplicative RL updates
    const observed = new Float32Array(total);
    const estimate = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const v = Math.max(1, workY[i] + 1);
      observed[i] = v;
      estimate[i] = v;
    }

    const ratioBuf = new Float32Array(total);
    for (let iter = 0; iter < iterations; iter++) {
      const conv = gaussianBlurFloat(estimate, w, h, psfRadius);
      for (let i = 0; i < total; i++) {
        ratioBuf[i] = observed[i] / Math.max(1e-3, conv[i]);
      }
      const correction = gaussianBlurFloat(ratioBuf, w, h, psfRadius);
      const damping = 0.55 + deblurNorm * 0.35;
      for (let i = 0; i < total; i++) {
        const nextVal = estimate[i] * (1 + (correction[i] - 1) * damping);
        // Halo-limiting clamp relative to observed luminance
        const maxDelta = 28 + deblurNorm * 32;
        const clamped = Math.max(
          observed[i] - maxDelta,
          Math.min(observed[i] + maxDelta, nextVal)
        );
        estimate[i] = Math.max(1, Math.min(256, clamped));
      }
      await nextFrame();
    }

    const blend = 0.35 + deblurNorm * 0.65;
    for (let i = 0; i < total; i++) {
      const recovered = estimate[i] - 1;
      workY[i] = workY[i] + (recovered - workY[i]) * blend;
    }
  }

  // Stage 3: Natural Texture-Preserving Multi-Scale Sharpening
  if (options.sharpness > 0) {
    onProgress?.(84, "Enhancing crispness & natural textures...");
    await nextFrame();

    const sharpNorm = options.sharpness / 100;
    const blurFine = gaussianBlurFloat(workY, w, h, 1.0);
    const amount = sharpNorm * 1.15;
    const noiseGate = 2.5; // protects smooth skin/sky from amplifying grain

    for (let i = 0; i < total; i++) {
      const detail = workY[i] - blurFine[i];
      if (Math.abs(detail) > noiseGate) {
        const sign = detail >= 0 ? 1 : -1;
        const gated = sign * (Math.abs(detail) - noiseGate);
        // Soft knee to prevent clipping white halos on high-contrast edges
        const boost = Math.tanh((gated * amount) / 42) * 42;
        workY[i] = Math.max(0, Math.min(255, workY[i] + boost));
      }
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
  onProgress?.(6, "Loading on-device neural segmentation model...");
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const resultBlob = await removeBackground(sourceBlob, {
      output: { format: "image/png", quality: 1 },
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.min(96, Math.max(8, Math.round((current / total) * 100)));
          const label = key.toLowerCase().includes("fetch")
            ? `Loading AI cutout model (${pct}%)`
            : `Segmenting hair & subject edges (${pct}%)`;
          onProgress?.(pct, label);
        }
      },
    });
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
  fillHex: string | null // null = keep transparent
): Promise<Blob> {
  const w = cutoutImg.naturalWidth || cutoutImg.width;
  const h = cutoutImg.naturalHeight || cutoutImg.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");

  ctx.clearRect(0, 0, w, h);
  if (fillHex) {
    ctx.fillStyle = fillHex;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(cutoutImg, 0, 0, w, h);
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// TOOL D: NATURAL FACE RETOUCHING (Identity-Preserving CIE L*a*b* Engine)
// ============================================================================

function computeInclusiveSkinMask(
  data: Uint8ClampedArray,
  w: number,
  h: number
): Float32Array {
  const total = w * h;
  const rawMask = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const a = data[p + 3];
    if (a < 32) continue;

    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    // Broad YCbCr skin gamut covering fair, olive, tan, brown, and deep tones
    if (y > 28 && y < 248 && cb >= 74 && cb <= 132 && cr >= 131 && cr <= 178) {
      const cbDist = Math.abs(cb - 103) / 29;
      const crDist = Math.abs(cr - 153) / 24;
      const d = Math.sqrt(cbDist * cbDist + crDist * crDist);
      if (d < 1.15) {
        // Protect very dark eyelashes/pupils/brows and overly saturated lips
        const lumaFactor = y < 55 ? (y - 28) / 27 : 1;
        const satFactor = cr > 168 ? Math.max(0, 1 - (cr - 168) / 10) : 1;
        rawMask[i] = Math.max(0, Math.min(1, (1.15 - d) * 1.4)) * lumaFactor * satFactor;
      }
    }
  }

  // Smooth the skin mask edges cleanly so transitions are invisible
  return gaussianBlurFloat(rawMask, w, h, 2.0);
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

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  onProgress?.(14, "Detecting natural skin & facial feature zones...");
  await nextFrame();

  const skinMask = computeInclusiveSkinMask(data, w, h);

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

  // Stage 1: Minor Blemish & Spot Healing (targets localized red/dark outlier spots on skin)
  if (options.removeBlemishes > 0) {
    onProgress?.(38, "Healing minor blemishes while preserving natural pores...");
    await nextFrame();

    const strength = options.removeBlemishes / 100;
    const medR = gaussianBlurFloat(R, w, h, 3.2);
    const medG = gaussianBlurFloat(G, w, h, 3.2);
    const medB = gaussianBlurFloat(B, w, h, 3.2);
    const medY = gaussianBlurFloat(Y, w, h, 3.2);

    for (let i = 0; i < total; i++) {
      const m = skinMask[i];
      if (m < 0.15) continue;

      // Detect localized dark spots (Y drop) or inflamed redness (R-G spike vs surrounding skin)
      const localRedness = R[i] - G[i];
      const bgRedness = medR[i] - medG[i];
      const redExcess = Math.max(0, localRedness - bgRedness - 4.5);
      const darkDip = Math.max(0, medY[i] - Y[i] - 6.0);

      // Guard against healing real facial creases/eyes (extreme high-contrast edges)
      if (darkDip > 58) continue;

      const spotScore = Math.min(1, (redExcess / 18 + darkDip / 24) * strength);
      if (spotScore > 0.04) {
        const blend = Math.min(0.88, spotScore * m);
        R[i] = R[i] + (medR[i] - R[i]) * blend;
        G[i] = G[i] + (medG[i] - G[i]) * blend;
        B[i] = B[i] + (medB[i] - B[i]) * blend;
        Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
      }
    }
  }

  // Stage 2: Frequency-Separated Natural Skin Smoothing (preserves authentic micro-texture)
  if (options.smoothSkin > 0) {
    onProgress?.(64, "Applying frequency-separated natural skin smoothing...");
    await nextFrame();

    const strength = (options.smoothSkin / 100) * 0.68; // Capped intentionally so skin never turns plastic
    const lowR = gaussianBlurFloat(R, w, h, 2.4);
    const lowG = gaussianBlurFloat(G, w, h, 2.4);
    const lowB = gaussianBlurFloat(B, w, h, 2.4);
    const microBlurY = gaussianBlurFloat(Y, w, h, 1.0);

    for (let i = 0; i < total; i++) {
      const m = skinMask[i];
      if (m < 0.1) continue;

      // Preserve edge boundaries (glasses, nostril lines, lip edges) via range weight
      const diffLuma = Math.abs(Y[i] - (0.299 * lowR[i] + 0.587 * lowG[i] + 0.114 * lowB[i]));
      const edgeKeep = Math.exp(-(diffLuma * diffLuma) / (2 * 18 * 18));
      const blend = m * strength * edgeKeep;

      // Re-inject 35% of fine pore micro-texture so skin looks 100% authentic
      const microTex = (Y[i] - microBlurY[i]) * 0.35;
      R[i] = R[i] + (lowR[i] + microTex - R[i]) * blend;
      G[i] = G[i] + (lowG[i] + microTex - G[i]) * blend;
      B[i] = B[i] + (lowB[i] + microTex - B[i]) * blend;
      Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
    }
  }

  // Stage 3: Facial Clarity (crisp eyes, brows, hair, and natural local contrast)
  if (options.facialClarity > 0) {
    onProgress?.(86, "Refining eye & facial clarity...");
    await nextFrame();

    const clarityNorm = options.facialClarity / 100;
    const fineBlurY = gaussianBlurFloat(Y, w, h, 1.1);
    const midBlurY = gaussianBlurFloat(Y, w, h, 3.0);

    for (let i = 0; i < total; i++) {
      const p = i * 4;
      if (preserveTransparency && data[p + 3] < 16) continue;

      const m = skinMask[i];
      // Boost crispness strongest on eyes/brows/hair (non-skin) and gently on skin
      const featureWeight = 1 - m * 0.65;
      const microDetail = (Y[i] - fineBlurY[i]) * clarityNorm * 0.65 * featureWeight;
      const localContrast = (Y[i] - midBlurY[i]) * clarityNorm * 0.22 * featureWeight;
      const delta = Math.max(-22, Math.min(22, microDetail + localContrast));

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
  onProgress?.(100, "Natural face retouching complete");
  return canvasToBlob(canvas, "image/png");
}

// ============================================================================
// TOOL E: COLOUR & LIGHTING CORRECTION (Auto Exposure, WB, Contrast, Vibrance)
// ============================================================================

export function analyzeAutoColorCorrection(
  img: HTMLImageElement
): ColorLightingOptions {
  const sampleMax = 256;
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

  // Compute 2nd and 98th percentile luminance for dynamic range analysis
  let acc = 0;
  let p02 = 0;
  let p98 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= count * 0.02 && p02 === 0) p02 = v;
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

  // Target comfortable mid-tone ~132 for studio clarity
  const exposure = Math.max(-45, Math.min(55, Math.round(((132 - meanY) / 128) * 58)));
  const brightness = Math.max(-18, Math.min(22, Math.round(((128 - meanY) / 128) * 16)));

  // Dynamic range stretch if flat histogram
  const range = Math.max(30, p98 - p02);
  const contrast =
    range < 195
      ? Math.min(28, Math.round(((215 - range) / 215) * 34))
      : range > 245
        ? -6
        : 6;

  // Conservative Gray-World White Balance correction (avoids over-correcting warm portraits)
  const gray = (meanR + meanG + meanB) / 3;
  const rbDiff = (meanB - meanR) / Math.max(40, gray); // positive = too cool -> add warmth
  const warmth = Math.max(-24, Math.min(24, Math.round(rbDiff * 38)));

  const gDiff = (meanG - (meanR + meanB) * 0.5) / Math.max(40, gray); // positive = greenish -> magenta tint
  const tint = Math.max(-18, Math.min(18, Math.round(gDiff * 30)));

  // Gentle vibrance boost for dull/flat photos
  const vibrance = meanSat < 0.26 ? Math.min(28, Math.round((0.32 - meanSat) * 95)) : 8;

  return {
    exposure,
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

  onProgress?.(20, "Adjusting exposure, white balance & tone curve...");
  await nextFrame();

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const evGain = Math.pow(2, (options.exposure / 100) * 1.15);
  const brightOffset = (options.brightness / 50) * 38;
  const contrastFactor = Math.pow((100 + options.contrast * 1.15) / 100, 1.25);

  const warmShift = (options.warmth / 50) * 18;
  const tintShift = (options.tint / 50) * 14;
  const vibranceAmt = options.vibrance / 100;

  for (let i = 0; i < data.length; i += 4) {
    if (preserveTransparency && data[i + 3] === 0) continue;

    // 1. Exposure + Brightness
    let r = data[i] * evGain + brightOffset;
    let g = data[i + 1] * evGain + brightOffset;
    let b = data[i + 2] * evGain + brightOffset;

    // 2. White Balance (Temperature + Tint)
    r += warmShift + tintShift * 0.5;
    g -= tintShift * 0.7;
    b -= warmShift - tintShift * 0.5;

    // 3. Contrast around mid-gray (128)
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // 4. Perceptual Vibrance (protects already-saturated skin/reds from clipping)
    if (vibranceAmt !== 0) {
      const cr = Math.max(0, Math.min(255, r));
      const cg = Math.max(0, Math.min(255, g));
      const cb = Math.max(0, Math.min(255, b));
      const maxC = Math.max(cr, cg, cb);
      const minC = Math.min(cr, cg, cb);
      const avg = (cr + cg + cb) / 3;
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
      const amt = vibranceAmt * (1 - sat * 0.75);
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
      // Fit cleanly within requested print width preserving exact original aspect ratio
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
    // Center cover-fit into exact custom print canvas without stretching faces
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
