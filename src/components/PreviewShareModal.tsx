import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Share2,
  X,
} from "lucide-react";
import { BRAND_NAME } from "../types/photo";
import { loadHtmlImage } from "../utils/imageProcessing";

export interface PreviewModalPayload {
  kind: "single" | "sheet";
  title: string;
  specs: string;
  previewDataUrl: string;
  jpegBlob: Blob;
  filename: string;
  sizeKB: number;
}

interface PreviewShareModalProps {
  payload: PreviewModalPayload | null;
  zeroZerosUrl: string;
  onClose: () => void;
  onDownload: (blob: Blob, filename: string) => void;
  onMailShare: () => void;
}

export function PreviewShareModal({
  payload,
  zeroZerosUrl,
  onClose,
  onDownload,
  onMailShare,
}: PreviewShareModalProps) {
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [copiedImage, setCopiedImage] = useState(false);

  if (!payload) return null;

  const handleNativeFileShare = async () => {
    try {
      setShareFeedback(null);
      const file = new File([payload.jpegBlob], payload.filename, {
        type: "image/jpeg",
      });

      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `${BRAND_NAME} — ${payload.title}`,
          text: `${payload.title} (${payload.specs})`,
          files: [file],
        });
        setShareFeedback("Shared file directly via device share sheet.");
      } else {
        onDownload(payload.jpegBlob, payload.filename);
        setShareFeedback(
          "Direct file share is restricted in this browser window. File downloaded so you can attach it directly."
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setShareFeedback(
        "Could not open system share sheet. Use Copy Image or Download below."
      );
    }
  };

  const handleCopyImage = async () => {
    try {
      setShareFeedback(null);
      const img = await loadHtmlImage(payload.previewDataUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Clipboard PNG failed"))),
          "image/png"
        )
      );

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      setCopiedImage(true);
      setShareFeedback(
        "Image copied to clipboard. Paste directly (Ctrl+V / Cmd+V) into ZeroZeros, WhatsApp, or Photoshop."
      );
      setTimeout(() => setCopiedImage(false), 2500);
    } catch {
      setShareFeedback(
        "Clipboard image copy is blocked in this browser. Use Download JPG or System Share instead."
      );
    }
  };

  const handleShareToZeroZeros = async () => {
    // 1. Copy image or download so the file is ready immediately
    await handleCopyImage();
    onDownload(payload.jpegBlob, payload.filename);

    const trimmed = zeroZerosUrl.trim();
    if (trimmed) {
      const targetUrl =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      const link = document.createElement("a");
      link.href = targetUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShareFeedback(
        "File downloaded & copied to clipboard while opening ZeroZeros."
      );
    } else {
      await handleNativeFileShare();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={payload.title}
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {payload.title}
            </h3>
            <p className="text-xs text-slate-500 font-mono-nums truncate mt-0.5">
              {payload.specs} · {payload.sizeKB} KB
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* High-Resolution Preview Canvas */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-6 flex items-center justify-center min-h-[260px]">
          <img
            src={payload.previewDataUrl}
            alt={payload.title}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[58vh] w-auto h-auto object-contain bg-white border border-slate-300 shadow-md"
          />
        </div>

        {/* Direct Share & Export Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white space-y-3">
          {shareFeedback && (
            <div className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              {shareFeedback}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleShareToZeroZeros}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Direct Share to ZeroZeros</span>
              </button>

              <button
                type="button"
                onClick={handleNativeFileShare}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Share File</span>
              </button>

              <button
                type="button"
                onClick={handleCopyImage}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedImage ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 shrink-0" />
                )}
                <span>{copiedImage ? "Copied" : "Copy Image"}</span>
              </button>

              <button
                type="button"
                onClick={onMailShare}
                className="inline-flex items-center gap-2 border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>Send on Mail</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDownload(payload.jpegBlob, payload.filename)}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download JPG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
