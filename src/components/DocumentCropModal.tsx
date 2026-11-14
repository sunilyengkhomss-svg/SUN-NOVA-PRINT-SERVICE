import React, { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Camera,
  Check,
  Download,
  RotateCw,
  Scissors,
  Upload,
  X,
} from "lucide-react";
import { PRINT_PPI } from "../types/photo";
import {
  mmToPixels300Ppi,
  renderCroppedDocumentCanvas,
  setJpegPpi,
  triggerBlobDownload,
} from "../utils/imageProcessing";
import { CameraCaptureModal } from "./CameraCaptureModal";

export type DocCropTarget = "front" | "back" | "custom";

export interface DocumentCropResult {
  target: DocCropTarget;
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  sourceUrl: string;
}

interface DocumentCropModalProps {
  isOpen: boolean;
  initialSourceUrl?: string | null;
  initialTarget?: DocCropTarget;
  defaultWidthMm?: number;
  defaultHeightMm?: number;
  onClose: () => void;
  onApply: (result: DocumentCropResult, keepOpenForTarget?: DocCropTarget) => void;
}

const DOC_SIZE_PRESETS = [
  { id: "cr80", label: "ID Card CR80 (85.6 × 54 mm)", wMm: 85.6, hMm: 54 },
  { id: "aadhaar", label: "Aadhaar PVC (85 × 55 mm)", wMm: 85, hMm: 55 },
  { id: "eaadhaar", label: "E-Aadhaar Cut (90 × 58 mm)", wMm: 90, hMm: 58 },
  { id: "booklet", label: "Passport / Booklet (125 × 88 mm)", wMm: 125, hMm: 88 },
  { id: "4x6", label: "4 × 6 Document (101.6 × 152.4 mm)", wMm: 101.6, hMm: 152.4 },
  { id: "a5", label: "A5 Document (148 × 210 mm)", wMm: 148, hMm: 210 },
  { id: "custom", label: "Custom Document Size (mm)", wMm: 85.6, hMm: 54 },
] as const;

export function DocumentCropModal({
  isOpen,
  initialSourceUrl = null,
  initialTarget = "front",
  defaultWidthMm = 85.6,
  defaultHeightMm = 54,
  onClose,
  onApply,
}: DocumentCropModalProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(initialSourceUrl);
  const [target, setTarget] = useState<DocCropTarget>(initialTarget);
  const [sizePresetId, setSizePresetId] = useState<string>("cr80");
  const [widthMm, setWidthMm] = useState<number>(defaultWidthMm);
  const [heightMm, setHeightMm] = useState<number>(defaultHeightMm);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [baseRotate, setBaseRotate] = useState(0);
  const [fineRotate, setFineRotate] = useState(0);
  const [brightness, setBrightness] = useState(105);
  const [contrast, setContrast] = useState(115);
  const [previewTone, setPreviewTone] = useState<
    "color" | "grayscale" | "bw_xerox"
  >("color");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTarget(initialTarget);
    setWidthMm(defaultWidthMm);
    setHeightMm(defaultHeightMm);
    const matched = DOC_SIZE_PRESETS.find(
      (p) =>
        p.id !== "custom" &&
        Math.abs(p.wMm - defaultWidthMm) < 0.2 &&
        Math.abs(p.hMm - defaultHeightMm) < 0.2
    );
    setSizePresetId(matched ? matched.id : "custom");
    if (initialSourceUrl) {
      setSourceUrl(initialSourceUrl);
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setBaseRotate(0);
    setFineRotate(0);
    setStatusMessage(null);
    setErrorMessage(null);
  }, [isOpen, initialSourceUrl, initialTarget, defaultWidthMm, defaultHeightMm]);

  const safeWMm = Math.min(297, Math.max(15, Number(widthMm) || 85.6));
  const safeHMm = Math.min(420, Math.max(15, Number(heightMm) || 54));
  const outW = mmToPixels300Ppi(safeWMm);
  const outH = mmToPixels300Ppi(safeHMm);
  const aspect = safeWMm / safeHMm;
  const totalRotation = baseRotate + fineRotate;

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handlePresetChange = (id: string) => {
    setSizePresetId(id);
    const found = DOC_SIZE_PRESETS.find((p) => p.id === id);
    if (found && id !== "custom") {
      setWidthMm(found.wMm);
      setHeightMm(found.hMm);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setBaseRotate(0);
    setFineRotate(0);
    setErrorMessage(null);
    setStatusMessage(null);
    e.target.value = "";
  };

  const renderResultDataUrl = async (
    tone: "color" | "grayscale" | "bw_xerox" = "color"
  ) => {
    if (!sourceUrl || !croppedAreaPixels) {
      throw new Error("Upload a document image and position the crop frame.");
    }
    const canvas = await renderCroppedDocumentCanvas({
      imageSrc: sourceUrl,
      croppedAreaPixels,
      outW,
      outH,
      rotation: totalRotation,
      brightness,
      contrast,
      toneMode: tone,
    });
    return { canvas, dataUrl: canvas.toDataURL("image/jpeg", 0.96) };
  };

  const handleApplyToSlot = async (nextTargetToKeepOpen?: DocCropTarget) => {
    if (!sourceUrl || !croppedAreaPixels) {
      setErrorMessage("Please upload or click a photo first.");
      return;
    }
    try {
      setErrorMessage(null);
      // Keep color data cleanly so IdCardXeroxStudio applies its own live B&W Xerox / Grayscale / Color filter!
      const { dataUrl } = await renderResultDataUrl("color");
      onApply(
        {
          target,
          dataUrl,
          widthMm: safeWMm,
          heightMm: safeHMm,
          sourceUrl,
        },
        nextTargetToKeepOpen
      );
      if (nextTargetToKeepOpen) {
        const appliedName = target === "front" ? "Front Side" : "Back Side";
        setTarget(nextTargetToKeepOpen);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setStatusMessage(
          `Saved ${appliedName}! Now position the crop frame for the ${nextTargetToKeepOpen === "back" ? "Back Side" : "Front Side"}.`
        );
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not crop document."
      );
    }
  };

  const handleDownloadDirect = async () => {
    if (!sourceUrl || !croppedAreaPixels) {
      setErrorMessage("Please upload or click a document image first.");
      return;
    }
    try {
      setErrorMessage(null);
      const { canvas } = await renderResultDataUrl(previewTone);
      const rawBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.96)
      );
      const ppiBlob = await setJpegPpi(rawBlob, PRINT_PPI);
      const sizeKB = Math.round((ppiBlob.size / 1024) * 10) / 10;
      const filename = `sun-nova-doc-${safeWMm}x${safeHMm}mm-${outW}x${outH}-300ppi.jpg`;
      triggerBlobDownload(ppiBlob, filename);
      setStatusMessage(
        `Downloaded ${filename} (${sizeKB} KB · ${outW}×${outH} px @ 300 PPI)`
      );
    } catch {
      setErrorMessage("Failed to download cropped document.");
    }
  };

  const previewFilter = useMemo(() => {
    const parts = [`brightness(${brightness}%)`, `contrast(${contrast}%)`];
    if (previewTone !== "color") parts.push("grayscale(100%)");
    return parts.join(" ");
  }, [brightness, contrast, previewTone]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document Size Maker and Preparative Crop Tool"
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full overflow-hidden shadow-2xl my-auto">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Document Size Maker &amp; Preparative Crop Tool
              </h3>
              <p className="text-[11px] text-slate-500 font-mono-nums">
                Upload one image &amp; crop Front Side, Back Side, or Custom Size
                ({safeWMm} × {safeHMm} mm · {outW} × {outH} px @ 300 PPI)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
            aria-label="Close document crop tool"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 cols: Interactive Preparative Cropper */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: "front", label: "Crop Front Side" },
                    { id: "back", label: "Crop Back Side" },
                    { id: "custom", label: "Custom Size Maker" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTarget(tab.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      target === tab.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-md cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{sourceUrl ? "Change Image" : "Upload One"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Click</span>
                </button>
              </div>
            </div>

            {!sourceUrl ? (
              <label className="h-72 sm:h-80 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-lg bg-slate-50 flex flex-col items-center justify-center gap-2 p-6 text-center cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-amber-600" />
                <span className="text-sm font-semibold text-slate-900">
                  Upload One Document / E-Aadhaar / ID Photo
                </span>
                <span className="text-xs text-slate-500 max-w-sm">
                  Crop the Front Side and Back Side separately from one single
                  upload, or create any custom millimeter document size at 300
                  PPI.
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div
                className="relative w-full h-72 sm:h-80 rounded-lg overflow-hidden border border-slate-300 bg-slate-900"
                style={{ filter: previewFilter }}
              >
                <Cropper
                  image={sourceUrl}
                  crop={crop}
                  zoom={zoom}
                  rotation={totalRotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
            )}

            {sourceUrl && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                    <span>Zoom</span>
                    <span className="font-mono-nums">{zoom.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                    <span>Straighten</span>
                    <span className="font-mono-nums">{totalRotation}°</span>
                  </div>
                  <input
                    type="range"
                    min={-15}
                    max={15}
                    step={0.5}
                    value={fineRotate}
                    onChange={(e) => setFineRotate(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                    <span>Brightness</span>
                    <span className="font-mono-nums">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={150}
                    step={1}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                    <span>Contrast</span>
                    <span className="font-mono-nums">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={170}
                    step={1}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: Document Size Maker & Actions */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label
                htmlFor="doc-crop-preset"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Document Size Maker (mm @ 300 PPI)
              </label>
              <select
                id="doc-crop-preset"
                value={sizePresetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {DOC_SIZE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2.5 mt-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={297}
                    step={0.5}
                    value={widthMm}
                    onChange={(e) => {
                      setSizePresetId("custom");
                      setWidthMm(Number(e.target.value));
                    }}
                    className="w-full font-mono-nums border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={420}
                    step={0.5}
                    value={heightMm}
                    onChange={(e) => {
                      setSizePresetId("custom");
                      setHeightMm(Number(e.target.value));
                    }}
                    className="w-full font-mono-nums border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-nums mt-1.5">
                <span>
                  Output: {outW} × {outH} px (300 PPI)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWidthMm(safeHMm);
                      setHeightMm(safeWMm);
                      setSizePresetId("custom");
                    }}
                    className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                  >
                    Swap W×H
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseRotate((r) => (r + 90) % 360)}
                    className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>90°</span>
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1">
                Preview / Direct Export Tone
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: "color", label: "Color" },
                    { id: "grayscale", label: "Grayscale" },
                    { id: "bw_xerox", label: "B&W Xerox" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewTone(t.id)}
                    className={`px-2 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                      previewTone === t.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMessage}
              </div>
            )}
            {statusMessage && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {statusMessage}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-100">
              {target !== "custom" && (
                <button
                  type="button"
                  disabled={!sourceUrl}
                  onClick={() => handleApplyToSlot(undefined)}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    Apply to {target === "front" ? "Front Side" : "Back Side"} &amp;
                    Close
                  </span>
                </button>
              )}

              {target === "front" && (
                <button
                  type="button"
                  disabled={!sourceUrl}
                  onClick={() => handleApplyToSlot("back")}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Save Front &amp; Crop Back Side Next</span>
                </button>
              )}

              {target === "custom" && (
                <button
                  type="button"
                  disabled={!sourceUrl}
                  onClick={() => handleApplyToSlot(undefined)}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use Custom Size on Xerox Sheet</span>
                </button>
              )}

              <button
                type="button"
                disabled={!sourceUrl}
                onClick={handleDownloadDirect}
                className="w-full flex items-center justify-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold py-2 px-3 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Cropped Size ({outW}×{outH} px JPG)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(blob) => {
          setSourceUrl(URL.createObjectURL(blob));
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setBaseRotate(0);
          setFineRotate(0);
          setErrorMessage(null);
        }}
      />
    </div>
  );
}
