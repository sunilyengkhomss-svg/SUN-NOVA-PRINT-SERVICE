import { useEffect, useRef } from "react";
import { OutlineStyle, SheetLayoutResult, SheetQueueItem } from "../types/photo";
import { drawStyledOutlineRect } from "../utils/imageProcessing";

interface SheetPreviewCanvasProps {
  singlePhotoDataUrl: string | null;
  queueItems: SheetQueueItem[];
  layout: SheetLayoutResult;
  tileW: number;
  tileH: number;
  gapPx: number;
  gapMm: number;
  paperLabel: string;
  borderWidthPx: number;
  borderColor: string;
  outlineStyle: OutlineStyle;
  outlineOffsetPx: number;
}

export function SheetPreviewCanvas({
  singlePhotoDataUrl,
  queueItems,
  layout,
  tileW,
  tileH,
  gapPx,
  gapMm,
  paperLabel,
  borderWidthPx,
  borderColor,
  outlineStyle,
  outlineOffsetPx,
}: SheetPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxPreview = 760;
    const scale = Math.min(
      maxPreview / layout.sheetW,
      maxPreview / layout.sheetH
    );

    canvas.width = Math.round(layout.sheetW * scale);
    canvas.height = Math.round(layout.sheetH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    const drawGrid = (tileImgs?: HTMLImageElement[]) => {
      if (cancelled) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawCount = tileImgs
        ? Math.min(layout.maxCount, tileImgs.length)
        : layout.count;

      const scaledBorder =
        borderWidthPx > 0 ? Math.max(1, borderWidthPx * scale) : 0;
      const scaledOffset =
        outlineOffsetPx > 0 ? Math.max(1, outlineOffsetPx * scale) : 0;

      for (let i = 0; i < drawCount; i++) {
        const r = Math.floor(i / layout.cols);
        const c = i % layout.cols;
        const x = (layout.startX + c * (tileW + gapPx)) * scale;
        const y = (layout.startY + r * (tileH + gapPx)) * scale;
        const w = tileW * scale;
        const h = tileH * scale;

        const img = tileImgs ? tileImgs[i] : undefined;
        if (img) {
          ctx.drawImage(img, x, y, w, h);
        } else {
          ctx.fillStyle = "#F1F5F9";
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = "#CBD5E1";
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h * 0.36, Math.min(w, h) * 0.17, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(
            x + w / 2,
            y + h * 0.78,
            w * 0.3,
            h * 0.18,
            0,
            Math.PI,
            Math.PI * 2
          );
          ctx.fill();
        }

        if (scaledBorder > 0) {
          drawStyledOutlineRect(
            ctx,
            x,
            y,
            w,
            h,
            scaledBorder,
            borderColor,
            outlineStyle,
            scaledOffset
          );
        }
      }
    };

    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    if (queueItems.length > 0) {
      Promise.all(queueItems.map((q) => loadImg(q.dataUrl)))
        .then((imgs) => {
          const expanded: HTMLImageElement[] = [];
          queueItems.forEach((q, idx) => {
            for (let k = 0; k < Math.max(1, q.copies); k++) {
              expanded.push(imgs[idx]);
            }
          });
          drawGrid(expanded);
        })
        .catch(() => drawGrid());
    } else if (singlePhotoDataUrl) {
      loadImg(singlePhotoDataUrl)
        .then((img) => {
          const repeated = Array.from({ length: layout.count }, () => img);
          drawGrid(repeated);
        })
        .catch(() => drawGrid());
    } else {
      drawGrid();
    }

    return () => {
      cancelled = true;
    };
  }, [
    singlePhotoDataUrl,
    queueItems,
    layout,
    tileW,
    tileH,
    gapPx,
    borderWidthPx,
    borderColor,
    outlineStyle,
    outlineOffsetPx,
  ]);

  const activePhotoCount =
    queueItems.length > 0
      ? Math.min(
          layout.maxCount,
          queueItems.reduce((sum, q) => sum + Math.max(1, q.copies), 0)
        )
      : layout.count;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#0B101B]/90 rounded-xl border border-[#00E5FF]/20 p-4 sm:p-6">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8] mb-3">
        <span className="font-semibold text-[#F5F7FA]">{paperLabel}</span>
        <span className="font-mono-nums text-[#00E5FF]">
          {activePhotoCount} of {layout.maxCount} slots ({layout.cols}×
          {layout.activeRows} lines) · {layout.orientation} · {gapMm}mm gap
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center w-full min-h-[300px]">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[380px] w-auto h-auto shadow-[0_12px_36px_rgba(0,0,0,0.6)] border border-[#00E5FF]/25 bg-white"
        />
      </div>

      <div className="mt-3 text-[11px] text-[#94A3B8] font-mono-nums text-center">
        Canvas output: {layout.sheetW} × {layout.sheetH} px @ 300 PPI · Outline:{" "}
        {borderWidthPx === 0
          ? "None"
          : `${borderWidthPx}px ${outlineStyle}${outlineOffsetPx > 0 ? ` (+${outlineOffsetPx}px outer)` : ""}`}{" "}
        · Uniform {gapMm} mm gap
      </div>
    </div>
  );
}
