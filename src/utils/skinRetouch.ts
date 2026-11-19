import {
  AiSkinBeautyOptions,
  SkinTonePresetKey,
  SkinWhiteningLevel,
  hasAnyAiBeautyOption,
} from "../types/photo";

// Fast sRGB <-> Linear lookup tables
const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linToSrgbByte(lin: number): number {
  if (lin <= 0) return 0;
  if (lin >= 1) return 255;
  const s = lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(s * 255)));
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labInvF(t: number): number {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 16));
}

/**
 * Separable alpha-aware box blur on a single Float32Array plane (e.g., L*, a*, b* or mask).
 */
function blurPlane(
  src: Float32Array,
  alpha: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const r = Math.max(1, Math.min(40, Math.round(radius)));
  const temp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    let wSum = 0;
    for (let dx = -r; dx <= r; dx++) {
      const x = Math.max(0, Math.min(width - 1, dx));
      const a = alpha[row + x];
      sum += src[row + x] * a;
      wSum += a;
    }
    for (let x = 0; x < width; x++) {
      temp[row + x] = wSum > 0.001 ? sum / wSum : src[row + x];
      const remX = Math.max(0, x - r);
      const addX = Math.min(width - 1, x + r + 1);
      const ra = alpha[row + remX];
      const aa = alpha[row + addX];
      sum += src[row + addX] * aa - src[row + remX] * ra;
      wSum += aa - ra;
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let wSum = 0;
    for (let dy = -r; dy <= r; dy++) {
      const y = Math.max(0, Math.min(height - 1, dy));
      const idx = y * width + x;
      const a = alpha[idx];
      sum += temp[idx] * a;
      wSum += a;
    }
    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      dst[idx] = wSum > 0.001 ? sum / wSum : temp[idx];
      const remY = Math.max(0, y - r);
      const addY = Math.min(height - 1, y + r + 1);
      const rIdx = remY * width + x;
      const aIdx = addY * width + x;
      const ra = alpha[rIdx];
      const aa = alpha[aIdx];
      sum += temp[aIdx] * aa - temp[rIdx] * ra;
      wSum += aa - ra;
    }
  }

  return dst;
}

/**
 * Simple morphological max dilation on a 0..1 Float32Array mask so pimple halos
 * are cleanly covered during inpainting.
 */
function dilateMask(
  src: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const r = Math.max(1, Math.min(6, Math.round(radius)));
  const temp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let m = 0;
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width - 1, x + r);
      for (let kx = x0; kx <= x1; kx++) {
        const v = src[row + kx];
        if (v > m) m = v;
      }
      temp[row + x] = m;
    }
  }

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height - 1, y + r);
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let ky = y0; ky <= y1; ky++) {
        const v = temp[ky * width + x];
        if (v > m) m = v;
      }
      dst[y * width + x] = m;
    }
  }

  return dst;
}

/**
 * Multi-skin-type CIE L*a*b* + YCbCr portrait skin probability mask with
 * Sobel edge protection so eyes, lashes, eyebrows, lips, glasses, and collars stay crisp.
 */
function computePortraitSkinMask(
  rgba: Uint8ClampedArray,
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  alpha: Float32Array,
  width: number,
  height: number
): { skinMask: Float32Array; edgeEnergy: Float32Array; faceCx: number; faceCy: number } {
  const count = width * height;
  const raw = new Float32Array(count);
  const edgeEnergy = new Float32Array(count);

  // Sobel gradient on L* to protect crisp facial features (eyes, eyebrows, lips, hair)
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const gx =
        -L[i - width - 1] +
        L[i - width + 1] -
        2 * L[i - 1] +
        2 * L[i + 1] -
        L[i + width - 1] +
        L[i + width + 1];
      const gy =
        -L[i - width - 1] -
        2 * L[i - width] -
        L[i - width + 1] +
        L[i + width - 1] +
        2 * L[i + width] +
        L[i + width + 1];
      edgeEnergy[i] = Math.hypot(gx, gy) * 0.25;
    }
  }

  let sumX = 0;
  let sumY = 0;
  let sumW = 0;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const aNorm = alpha[i];
      if (aNorm < 0.1) continue;

      const idx = i * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      const lVal = L[i];
      const aVal = A[i];
      const bVal = B[i];

      // Exclude pitch-black hair/pupils & blown-out white shirts/backdrops
      if (lVal < 14 || lVal > 97) continue;

      // CIE L*a*b* skin chromaticity envelope (covers Fitzpatrick I to VI cleanly)
      const labAScore =
        smoothstep(0.5, 4.5, aVal) * (1 - smoothstep(26, 36, aVal));
      const labBScore =
        smoothstep(-1.5, 4.0, bVal) * (1 - smoothstep(32, 44, bVal));

      // YCbCr secondary validation rejects bright saturated clothing & colored backdrops
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const crScore = smoothstep(127, 134, cr) * (1 - smoothstep(173, 184, cr));
      const cbScore = smoothstep(72, 82, cb) * (1 - smoothstep(125, 134, cb));

      // Chroma guard excludes neutral gray/white backgrounds
      const chroma = Math.hypot(aVal, bVal);
      const chromaScore =
        smoothstep(3.5, 8.5, chroma) * (1 - smoothstep(38, 52, chroma));

      // Protect sharp dark features (eyelashes, pupils, thick eyebrows)
      const featureGuard = 1 - smoothstep(8, 22, edgeEnergy[i]) * (1 - smoothstep(18, 44, lVal));

      const prob =
        labAScore *
        labBScore *
        (0.35 + 0.65 * crScore * cbScore) *
        chromaScore *
        featureGuard *
        aNorm;

      raw[i] = prob;
      if (prob > 0.35) {
        sumX += x * prob;
        sumY += y * prob;
        sumW += prob;
      }
    }
  }

  const faceCx = sumW > 50 ? sumX / sumW : width * 0.5;
  const faceCy = sumW > 50 ? sumY / sumW : height * 0.42;

  const featherRadius = Math.max(2, Math.round(Math.min(width, height) / 180));
  const skinMask = blurPlane(raw, alpha, width, height, featherRadius);
  return { skinMask, edgeEnergy, faceCx, faceCy };
}

interface LabToneProfile {
  dL: number;
  dA: number;
  dB: number;
  chromaScale: number;
}

const LAB_TONE_PROFILES: Record<SkinTonePresetKey, LabToneProfile> = {
  original: { dL: 0, dA: 0, dB: 0, chromaScale: 1.0 },
  fair: { dL: 5.5, dA: -0.6, dB: -2.2, chromaScale: 0.9 },
  natural: { dL: 2.0, dA: -0.5, dB: -0.4, chromaScale: 0.96 },
  warm: { dL: 1.8, dA: 1.4, dB: 4.5, chromaScale: 1.06 },
  rosy: { dL: 2.8, dA: 3.4, dB: -0.8, chromaScale: 1.04 },
  olive: { dL: 1.6, dA: -2.6, dB: 1.6, chromaScale: 0.95 },
  deep_glow: { dL: 1.4, dA: 2.0, dB: 3.6, chromaScale: 1.1 },
};

const WHITENING_LIFT: Record<SkinWhiteningLevel, { lift: number; deYellow: number }> = {
  off: { lift: 0, deYellow: 0 },
  light: { lift: 5.5, deYellow: 0.6 },
  medium: { lift: 10.5, deYellow: 1.4 },
  bright: { lift: 16.5, deYellow: 2.2 },
};

/**
 * Pro On-Device AI Skin Beauty & Pimple Removal Pipeline (100% browser-local, ZERO API key).
 * Runs in perceptual CIE L*a*b* space with multi-scale pimple/acne inpainting,
 * frequency-separation skin smoothing, oil-shine control, dark-circle lift,
 * all-skin-type whitening/tone grading, and studio portrait key lighting.
 */
export async function processOnDeviceAiSkinBeauty(
  sourceImage: HTMLImageElement,
  options: AiSkinBeautyOptions,
  preserveTransparency = false,
  onProgress?: (percent: number, stageLabel: string) => void
): Promise<Blob> {
  const natW = sourceImage.naturalWidth || sourceImage.width;
  const natH = sourceImage.naturalHeight || sourceImage.height;
  // Cap working resolution at 1440px max side (plenty for 300 PPI 2x2" / 35x45mm passport prints)
  const scale = Math.min(1, 1440 / Math.max(natW, natH));
  const width = Math.max(1, Math.round(natW * scale));
  const height = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(sourceImage, 0, 0, width, height);

  if (!hasAnyAiBeautyOption(options)) {
    const fallbackMime = preserveTransparency ? "image/png" : "image/jpeg";
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode portrait."))),
        fallbackMime,
        0.95
      )
    );
  }

  onProgress?.(14, "Analyzing facial skin & lighting (14%)");
  await yieldFrame();

  const imgData = ctx.getImageData(0, 0, width, height);
  const rgba = imgData.data;
  const count = width * height;

  // Step 1: Convert RGBA -> perceptual CIE L*a*b* planes
  const L = new Float32Array(count);
  const A = new Float32Array(count);
  const B = new Float32Array(count);
  const alpha = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const idx = i * 4;
    alpha[i] = rgba[idx + 3] / 255;
    if (alpha[i] < 0.02) continue;

    const rl = SRGB_TO_LIN[rgba[idx]];
    const gl = SRGB_TO_LIN[rgba[idx + 1]];
    const bl = SRGB_TO_LIN[rgba[idx + 2]];

    // D65 XYZ
    const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047;
    const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
    const z = (0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl) / 1.08883;

    const fx = labF(x);
    const fy = labF(y);
    const fz = labF(z);

    L[i] = 116 * fy - 16;
    A[i] = 500 * (fx - fy);
    B[i] = 200 * (fy - fz);
  }

  const { skinMask, edgeEnergy, faceCx, faceCy } = computePortraitSkinMask(
    rgba,
    L,
    A,
    B,
    alpha,
    width,
    height
  );

  const minDim = Math.min(width, height);
  const fineR = Math.max(2, Math.round(minDim * 0.007));
  const medR = Math.max(4, Math.round(minDim * 0.018));
  const broadR = Math.max(8, Math.round(minDim * 0.036));

  // Step 2: Automated Pimple, Acne & Dark Spot Detection + 2-Pass Clean-Surround Inpainting
  if (options.removePimples) {
    onProgress?.(38, "Removing pimples, acne & dark spots (38%)");
    await yieldFrame();

    for (let pass = 0; pass < 2; pass++) {
      const rSpan = pass === 0 ? medR : Math.max(3, Math.round(medR * 0.68));
      const refL = blurPlane(L, alpha, width, height, rSpan);
      const refA = blurPlane(A, alpha, width, height, rSpan);
      const refB = blurPlane(B, alpha, width, height, rSpan);

      const spotRaw = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const sm = skinMask[i];
        if (sm < 0.18) continue;
        // Skip strong facial boundaries (eyes, eyebrows, lip outline)
        const boundaryGuard = 1 - smoothstep(10, 22, edgeEnergy[i]);
        if (boundaryGuard < 0.05) continue;

        // Inflamed red pimple / acne spot (positive a* spike vs local skin)
        const redSpike = A[i] - refA[i];
        const redProb = smoothstep(2.2, 8.5, redSpike);

        // Dark acne mark / blackhead / blemish dip (L* dip vs local skin)
        const darkDip = refL[i] - L[i];
        const darkProb =
          smoothstep(2.8, 12.5, darkDip) * (1 - smoothstep(24, 38, darkDip));

        // Yellowish/whitehead bump (small positive L* bump + slight chroma shift)
        const bumpPeak = L[i] - refL[i];
        const whiteheadProb =
          smoothstep(3.5, 11.0, bumpPeak) * smoothstep(1.0, 5.0, Math.abs(A[i] - refA[i]));

        const p = Math.min(1, Math.max(redProb, darkProb * 0.95, whiteheadProb * 0.8));
        if (p > 0.02) {
          spotRaw[i] = p * sm * boundaryGuard;
        }
      }

      // Dilate slightly to erase reddish pimple halos completely
      const dilated = dilateMask(spotRaw, width, height, pass === 0 ? 2 : 1);
      const spotMask = blurPlane(dilated, alpha, width, height, 2);

      // Compute clean skin reference weighted AWAY from flagged pimple pixels
      const cleanWeight = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        cleanWeight[i] = alpha[i] * Math.max(0.02, 1 - spotMask[i] * 0.95);
      }
      const cleanL = blurPlane(L, cleanWeight, width, height, rSpan);
      const cleanA = blurPlane(A, cleanWeight, width, height, rSpan);
      const cleanB = blurPlane(B, cleanWeight, width, height, rSpan);

      for (let i = 0; i < count; i++) {
        const w = Math.min(0.96, spotMask[i] * 1.15);
        if (w <= 0.01) continue;
        L[i] = L[i] * (1 - w) + cleanL[i] * w;
        A[i] = A[i] * (1 - w) + cleanA[i] * w;
        B[i] = B[i] * (1 - w) + cleanB[i] * w;
      }
    }
  }

  // Step 3: Frequency-Separation Skin Smoothing, Pore Softening & Oil Shine Matte Control
  onProgress?.(64, "Smoothing skin, pores & oil shine (64%)");
  await yieldFrame();

  const smoothL = blurPlane(L, alpha, width, height, fineR);
  const broadL = blurPlane(L, alpha, width, height, medR);
  const smoothA = blurPlane(A, alpha, width, height, medR);
  const smoothB = blurPlane(B, alpha, width, height, medR);
  const wideL = options.removeDarkCircles
    ? blurPlane(L, alpha, width, height, broadR)
    : null;
  const wideB = options.removeDarkCircles
    ? blurPlane(B, alpha, width, height, broadR)
    : null;

  if (options.smoothSkinAndShine) {
    for (let i = 0; i < count; i++) {
      const sm = skinMask[i];
      if (sm < 0.04) continue;

      const origL = L[i];
      const baseL = smoothL[i] * 0.58 + broadL[i] * 0.42;
      const diffL = Math.abs(origL - baseL);

      // Edge-preserving bilateral weight keeps crisp facial landmarks intact
      const edgeKeep = Math.exp(-(diffL * diffL) / (2 * 9.5 * 9.5));
      const detailSoft = Math.min(0.76, sm * edgeKeep * 0.78);
      // Even out patchy skin chroma (a*, b*) smoothly
      const chromaEven = Math.min(0.68, sm * edgeKeep * 0.7);

      L[i] = origL * (1 - detailSoft) + baseL * detailSoft;
      A[i] = A[i] * (1 - chromaEven) + smoothA[i] * chromaEven;
      B[i] = B[i] * (1 - chromaEven) + smoothB[i] * chromaEven;

      // Oil shine & forehead/nose specular glare matte compression
      const chroma = Math.hypot(A[i], B[i]);
      const shineScore =
        smoothstep(74, 91, L[i]) * (1 - smoothstep(8, 22, chroma));
      if (shineScore > 0.01) {
        const matte = shineScore * sm * 0.65;
        L[i] -= matte * Math.max(0, L[i] - 72) * 0.48;
        // Restore warm skin chroma into matte area from broader neighborhood
        A[i] = A[i] * (1 - matte * 0.55) + smoothA[i] * (matte * 0.55);
        B[i] = B[i] * (1 - matte * 0.55) + smoothB[i] * (matte * 0.55);
      }
    }
  }

  // Step 4: Under-Eye Dark Circle & Shadow Lift
  if (options.removeDarkCircles && wideL && wideB) {
    onProgress?.(78, "Reducing dark circles & balancing skin tone (78%)");
    await yieldFrame();

    for (let i = 0; i < count; i++) {
      const sm = skinMask[i];
      if (sm < 0.08) continue;

      const lVal = L[i];
      const shadowBand =
        smoothstep(24, 42, lVal) * (1 - smoothstep(66, 82, lVal));
      const localDip = smoothstep(0.5, 11.5, wideL[i] - lVal);
      const coolCast = smoothstep(-3, 7, wideB[i] - B[i]);
      const edgeSafe = 1 - smoothstep(9, 20, edgeEnergy[i]);

      const liftWeight =
        sm * shadowBand * edgeSafe * (0.35 + 0.42 * localDip + 0.23 * coolCast);
      if (liftWeight > 0.01) {
        L[i] += liftWeight * 8.2;
        // Neutralize bluish/purplish under-eye tint slightly toward healthy cheek tone
        B[i] += liftWeight * 2.1;
        A[i] = A[i] * (1 - liftWeight * 0.22) + smoothA[i] * (liftWeight * 0.22);
      }
    }
  }

  // Step 5: CIE L*a*b* Skin Whitening, All-Skin-Type Colour Grading & Studio Key Lighting
  onProgress?.(88, "Applying studio skin colour & clarity (88%)");
  await yieldFrame();

  const whiteCfg = WHITENING_LIFT[options.whiteningLevel] || WHITENING_LIFT.off;
  const toneCfg = LAB_TONE_PROFILES[options.skinTone] || LAB_TONE_PROFILES.original;
  const maxFaceRadius = Math.max(width, height) * 0.52;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      if (alpha[i] < 0.02) continue;

      const sm = skinMask[i];

      // Skin whitening & tone shifts strictly inside the soft skin mask
      if (sm > 0.01) {
        let lVal = L[i];
        let aVal = A[i];
        let bVal = B[i];

        const totalLift = whiteCfg.lift + toneCfg.dL;
        if (totalLift > 0.01) {
          // Highlight-safe perceptual lightness curve (works evenly on fair to deep skin)
          const headroom = Math.pow(Math.max(0, 1 - lVal / 100), 0.72);
          const midBoost = 0.42 + 0.58 * smoothstep(14, 52, lVal);
          lVal += totalLift * headroom * midBoost * sm;
        }

        if (whiteCfg.deYellow > 0.01) {
          bVal -= whiteCfg.deYellow * sm;
        }

        if (options.skinTone !== "original") {
          aVal = aVal * (1 + (toneCfg.chromaScale - 1) * sm) + toneCfg.dA * sm;
          bVal = bVal * (1 + (toneCfg.chromaScale - 1) * sm) + toneCfg.dB * sm;
        }

        L[i] = Math.max(0, Math.min(99, lVal));
        A[i] = Math.max(-60, Math.min(60, aVal));
        B[i] = Math.max(-60, Math.min(60, bVal));
      }

      // Studio Portrait Key Lighting & Crisp Eye/Hair Clarity
      if (options.studioLighting) {
        const dist = Math.hypot(x - faceCx, y - faceCy) / maxFaceRadius;
        const softbox = Math.max(0, 1 - dist * dist);
        // Gentle key light lift on portrait center
        const keyLift = softbox * 3.8 * Math.pow(Math.max(0, 1 - L[i] / 100), 0.8);
        L[i] = Math.max(0, Math.min(99.5, L[i] + keyLift));

        // Crisp micro-clarity strictly on non-skin edges (eyes, brows, hair, collar)
        const nonSkinWeight = Math.max(0, 1 - sm * 1.15);
        if (nonSkinWeight > 0.1) {
          const detail = L[i] - smoothL[i];
          L[i] = Math.max(
            0,
            Math.min(99.5, L[i] + detail * 0.42 * nonSkinWeight)
          );
        }
      }
    }
  }

  // Step 6: Convert CIE L*a*b* -> sRGB RGBA
  onProgress?.(96, "Finalizing 300 PPI portrait (96%)");
  for (let i = 0; i < count; i++) {
    if (alpha[i] < 0.02) continue;

    const fy = (L[i] + 16) / 116;
    const fx = fy + A[i] / 500;
    const fz = fy - B[i] / 200;

    const x = 0.95047 * labInvF(fx);
    const y = labInvF(fy);
    const z = 1.08883 * labInvF(fz);

    const rl = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
    const gl = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
    const bl = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

    const idx = i * 4;
    rgba[idx] = linToSrgbByte(rl);
    rgba[idx + 1] = linToSrgbByte(gl);
    rgba[idx + 2] = linToSrgbByte(bl);
  }

  ctx.putImageData(imgData, 0, 0);

  const outMime = preserveTransparency ? "image/png" : "image/jpeg";
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode retouched photo."))),
      outMime,
      0.95
    )
  );
}
