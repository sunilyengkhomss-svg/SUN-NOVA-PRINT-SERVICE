import React, { useCallback, useEffect, useRef, useState } from "react";
import pdfWorkerCode from "pdfjs-dist/build/pdf.worker.min.mjs?raw";
import { PDFDocument } from "pdf-lib";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Copy,
  Download,
  FileCode2,
  FileImage,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCw,
  ScanText,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { PRINT_PPI } from "../types/photo";
import {
  loadHtmlImage,
  setJpegPpi,
  triggerBlobDownload,
} from "../utils/imageProcessing";
import {
  SAMPLE_XML_DOC,
  csvToXmlString,
  formatXmlPretty,
  jsonToXmlString,
  minifyXml,
  validateXmlInput,
  xmlToCsvString,
  xmlToJsonString,
  xmlToPlainText,
} from "../utils/xmlConverter";
import { CameraCaptureModal } from "./CameraCaptureModal";

let cachedPdfWorkerUrl: string | null = null;
function getPdfWorkerSrc(): string {
  if (!cachedPdfWorkerUrl) {
    const blob = new Blob([pdfWorkerCode], { type: "text/javascript" });
    cachedPdfWorkerUrl = URL.createObjectURL(blob);
  }
  return cachedPdfWorkerUrl;
}

type ConverterTab =
  | "photo_to_pdf"
  | "pdf_to_photo"
  | "text_to_image"
  | "image_to_text"
  | "xml_converter";

type XmlConversionMode =
  | "xml_to_json"
  | "xml_to_csv"
  | "xml_pretty"
  | "xml_minify"
  | "xml_to_text"
  | "json_to_xml"
  | "csv_to_xml";

interface PdfQueuePhoto {
  id: string;
  name: string;
  url: string;
  rotDeg: number;
}

interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  selected: boolean;
}

type PdfPagePreset = "a4" | "letter" | "4x6" | "fit";
type PdfOrientation = "auto" | "portrait" | "landscape";

const TEXT_BG_PRESETS = [
  { name: "Pure White", bg: "#FFFFFF", text: "#0F172A" },
  { name: "Warm Paper", bg: "#FEFCE8", text: "#1E293B" },
  { name: "Soft Sky", bg: "#EFF6FF", text: "#0F172A" },
  { name: "Mint Note", bg: "#ECFDF5", text: "#064E3B" },
  { name: "Studio Dark", bg: "#0F172A", text: "#F8FAFC" },
];

const TEXT_CANVAS_PRESETS = [
  { id: "a4", label: "A4 Notice (1240 × 1754 px)", w: 1240, h: 1754 },
  { id: "4x6", label: "4 × 6 Card (1200 × 1800 px)", w: 1200, h: 1800 },
  { id: "square", label: "Square Post (1080 × 1080 px)", w: 1080, h: 1080 },
  { id: "wide", label: "Wide Banner (1600 × 900 px)", w: 1600, h: 900 },
  { id: "custom", label: "Custom Pixels", w: 1200, h: 1200 },
] as const;

export function DocumentConverterStudio() {
  const [activeTab, setActiveTab] = useState<ConverterTab>("photo_to_pdf");

  // 1. Photo -> PDF State
  const [pdfPhotos, setPdfPhotos] = useState<PdfQueuePhoto[]>([]);
  const [pdfPagePreset, setPdfPagePreset] = useState<PdfPagePreset>("a4");
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>("auto");
  const [pdfMarginMm, setPdfMarginMm] = useState<number>(8);
  const [pdfFilename, setPdfFilename] = useState<string>("sun-nova-photos");
  const [isBuildingPdf, setIsBuildingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // 2. PDF -> Photo State
  const [pdfSourceName, setPdfSourceName] = useState<string | null>(null);
  const [pdfDpi, setPdfDpi] = useState<number>(200);
  const [pdfOutFormat, setPdfOutFormat] = useState<"jpeg" | "png">("jpeg");
  const [renderedPages, setRenderedPages] = useState<RenderedPdfPage[]>([]);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfToPhotoStatus, setPdfToPhotoStatus] = useState<string | null>(null);
  const [pdfToPhotoError, setPdfToPhotoError] = useState<string | null>(null);
  const lastPdfBufferRef = useRef<ArrayBuffer | null>(null);

  // 3. Text -> Image State
  const [textTitle, setTextTitle] = useState<string>("SUN-NOVA PRINT SERVICE");
  const [textBody, setTextBody] = useState<string>(
    "Type or paste your notice, bio-data, address label, or quote here.\n\nCustomize font, size, colors, and download as a crisp PNG or 300 PPI JPG."
  );
  const [textFooter, setTextFooter] = useState<string>("300 PPI Print Ready");
  const [textCanvasId, setTextCanvasId] = useState<string>("square");
  const [textCustomW, setTextCustomW] = useState<number>(1200);
  const [textCustomH, setTextCustomH] = useState<number>(1200);
  const [textFontFamily, setTextFontFamily] = useState<
    "sans" | "serif" | "mono"
  >("sans");
  const [textFontSize, setTextFontSize] = useState<number>(42);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">(
    "left"
  );
  const [textBgColor, setTextBgColor] = useState<string>("#FFFFFF");
  const [textColor, setTextColor] = useState<string>("#0F172A");
  const [textBorderMode, setTextBorderMode] = useState<"none" | "thin" | "bold">(
    "thin"
  );
  const [textStatus, setTextStatus] = useState<string | null>(null);
  const textPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 4. Image -> Text (OCR) State
  const [ocrImageUrl, setOcrImageUrl] = useState<string | null>(null);
  const [ocrMode, setOcrMode] = useState<
    "plain" | "paragraph" | "id_card" | "table"
  >("plain");
  const [ocrResultText, setOcrResultText] = useState<string>("");
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrCopied, setOcrCopied] = useState(false);

  // 5. XML File Converter State
  const [xmlInputText, setXmlInputText] = useState<string>(SAMPLE_XML_DOC);
  const [xmlSourceName, setXmlSourceName] = useState<string>("print-orders.xml");
  const [xmlMode, setXmlMode] = useState<XmlConversionMode>("xml_to_json");
  const [xmlIndent, setXmlIndent] = useState<"2" | "4" | "tab">("2");
  const [xmlRootTag, setXmlRootTag] = useState<string>("dataset");
  const [xmlRowTag, setXmlRowTag] = useState<string>("record");
  const [xmlCopied, setXmlCopied] = useState(false);
  const [xmlStatus, setXmlStatus] = useState<string | null>(null);

  // Shared Camera Modal target
  const [cameraFor, setCameraFor] = useState<"pdf" | "ocr" | null>(null);

  const xmlValidation = React.useMemo(() => {
    if (xmlMode === "json_to_xml" || xmlMode === "csv_to_xml") return null;
    return validateXmlInput(xmlInputText);
  }, [xmlInputText, xmlMode]);

  const xmlConverted = React.useMemo(() => {
    const indentUnit = xmlIndent === "tab" ? "\t" : xmlIndent === "4" ? "    " : "  ";
    const indentSpaces = xmlIndent === "4" ? 4 : 2;
    try {
      let output = "";
      let ext = "json";
      let mime = "application/json;charset=utf-8";
      switch (xmlMode) {
        case "xml_to_json":
          output = xmlToJsonString(xmlInputText, indentSpaces);
          ext = "json";
          mime = "application/json;charset=utf-8";
          break;
        case "xml_to_csv":
          output = xmlToCsvString(xmlInputText);
          ext = "csv";
          mime = "text/csv;charset=utf-8";
          break;
        case "xml_pretty":
          output = formatXmlPretty(xmlInputText, indentUnit);
          ext = "xml";
          mime = "application/xml;charset=utf-8";
          break;
        case "xml_minify":
          output = minifyXml(xmlInputText);
          ext = "xml";
          mime = "application/xml;charset=utf-8";
          break;
        case "xml_to_text":
          output = xmlToPlainText(xmlInputText);
          ext = "txt";
          mime = "text/plain;charset=utf-8";
          break;
        case "json_to_xml":
          output = jsonToXmlString(xmlInputText, xmlRootTag || "dataset", indentUnit);
          ext = "xml";
          mime = "application/xml;charset=utf-8";
          break;
        case "csv_to_xml":
          output = csvToXmlString(
            xmlInputText,
            xmlRootTag || "dataset",
            xmlRowTag || "record",
            indentUnit
          );
          ext = "xml";
          mime = "application/xml;charset=utf-8";
          break;
      }
      return { output, ext, mime, error: null as string | null };
    } catch (err) {
      return {
        output: "",
        ext: xmlMode === "xml_to_json" ? "json" : xmlMode === "xml_to_csv" ? "csv" : "xml",
        mime: "text/plain;charset=utf-8",
        error: err instanceof Error ? err.message : "Conversion failed.",
      };
    }
  }, [xmlInputText, xmlMode, xmlIndent, xmlRootTag, xmlRowTag]);

  const handleXmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const content = await file.text();
    setXmlInputText(content);
    setXmlSourceName(file.name);
    setXmlStatus(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".json")) {
      setXmlMode("json_to_xml");
    } else if (lower.endsWith(".csv")) {
      setXmlMode("csv_to_xml");
    } else if (xmlMode === "json_to_xml" || xmlMode === "csv_to_xml") {
      setXmlMode("xml_to_json");
    }
  };

  const handleCopyXmlOutput = async () => {
    if (!xmlConverted.output) return;
    await navigator.clipboard.writeText(xmlConverted.output);
    setXmlCopied(true);
    setTimeout(() => setXmlCopied(false), 2000);
  };

  const handleDownloadXmlOutput = () => {
    if (!xmlConverted.output) return;
    const base =
      xmlSourceName
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-") || "sun-nova-converted";
    const filename = `${base}.${xmlConverted.ext}`;
    const blob = new Blob([xmlConverted.output], { type: xmlConverted.mime });
    triggerBlobDownload(blob, filename);
    setXmlStatus(`Downloaded ${filename} (${Math.max(1, Math.round(blob.size / 1024))} KB)`);
  };

  // --- PHOTO TO PDF HANDLERS ---
  const handleAddPdfPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      setPdfError("Please select valid JPG, PNG, or WEBP images.");
      return;
    }
    const items: PdfQueuePhoto[] = valid.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name || `Image ${pdfPhotos.length + idx + 1}`,
      url: URL.createObjectURL(f),
      rotDeg: 0,
    }));
    setPdfPhotos((prev) => [...prev, ...items]);
    setPdfError(null);
    setPdfStatus(null);
  };

  const movePdfPhoto = (index: number, dir: -1 | 1) => {
    setPdfPhotos((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleGeneratePdf = async () => {
    if (pdfPhotos.length === 0) {
      setPdfError("Please add at least one photo to convert to PDF.");
      return;
    }
    try {
      setIsBuildingPdf(true);
      setPdfError(null);
      setPdfStatus(null);

      const pdfDoc = await PDFDocument.create();
      const mmToPt = (mm: number) => (mm / 25.4) * 72;
      const marginPt = mmToPt(pdfMarginMm);

      for (const item of pdfPhotos) {
        const img = await loadHtmlImage(item.url);
        const rad = (item.rotDeg * Math.PI) / 180;
        const quarterTurn = item.rotDeg % 180 !== 0;
        const outW = quarterTurn ? img.height : img.width;
        const outH = quarterTurn ? img.width : img.height;

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, outW, outH);
        ctx.translate(outW / 2, outH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        const jpgBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
        );
        const jpgBytes = await jpgBlob.arrayBuffer();
        const embedded = await pdfDoc.embedJpg(jpgBytes);

        let pageW = 595.28; // A4 portrait pt
        let pageH = 841.89;

        if (pdfPagePreset === "letter") {
          pageW = 612;
          pageH = 792;
        } else if (pdfPagePreset === "4x6") {
          pageW = 288;
          pageH = 432;
        } else if (pdfPagePreset === "fit") {
          const maxSidePt = 842;
          const scale = Math.min(1, maxSidePt / Math.max(outW, outH));
          pageW = Math.max(144, outW * scale + marginPt * 2);
          pageH = Math.max(144, outH * scale + marginPt * 2);
        }

        if (pdfPagePreset !== "fit") {
          const isImgLandscape = outW > outH;
          if (
            pdfOrientation === "landscape" ||
            (pdfOrientation === "auto" && isImgLandscape)
          ) {
            [pageW, pageH] = [Math.max(pageW, pageH), Math.min(pageW, pageH)];
          } else {
            [pageW, pageH] = [Math.min(pageW, pageH), Math.max(pageW, pageH)];
          }
        }

        const page = pdfDoc.addPage([pageW, pageH]);
        const availW = Math.max(40, pageW - marginPt * 2);
        const availH = Math.max(40, pageH - marginPt * 2);
        const scale = Math.min(availW / outW, availH / outH);
        const drawW = outW * scale;
        const drawH = outH * scale;
        const drawX = (pageW - drawW) / 2;
        const drawY = (pageH - drawH) / 2;

        page.drawImage(embedded, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const safeBytes = new Uint8Array(pdfBytes);
      const blob = new Blob([safeBytes], { type: "application/pdf" });
      const cleanName =
        pdfFilename.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") ||
        "sun-nova-photos";
      triggerBlobDownload(blob, `${cleanName}.pdf`);
      const sizeKB = Math.round((blob.size / 1024) * 10) / 10;
      setPdfStatus(
        `Created ${cleanName}.pdf (${pdfPhotos.length} ${
          pdfPhotos.length === 1 ? "page" : "pages"
        } · ${sizeKB} KB)`
      );
    } catch (err: unknown) {
      setPdfError(
        err instanceof Error ? err.message : "Failed to build PDF file."
      );
    } finally {
      setIsBuildingPdf(false);
    }
  };

  // --- PDF TO PHOTO HANDLERS ---
  const renderPdfBufferToImages = useCallback(
    async (buffer: ArrayBuffer, dpi: number, format: "jpeg" | "png") => {
      try {
        setIsExtractingPdf(true);
        setPdfToPhotoError(null);
        setPdfToPhotoStatus("Rendering PDF pages...");

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();

        const copyBuffer = buffer.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: copyBuffer });
        const pdf = await loadingTask.promise;
        const scale = dpi / 72;
        const pages: RenderedPdfPage[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext("2d")!;

          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          }).promise;

          const dataUrl = canvas.toDataURL(
            format === "png" ? "image/png" : "image/jpeg",
            0.94
          );
          pages.push({
            pageNumber: pageNum,
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            selected: true,
          });
        }

        setRenderedPages(pages);
        setPdfToPhotoStatus(
          `Rendered ${pages.length} ${
            pages.length === 1 ? "page" : "pages"
          } at ${dpi} DPI.`
        );
      } catch (err: unknown) {
        setPdfToPhotoError(
          err instanceof Error
            ? err.message
            : "Could not read this PDF file. Ensure it is not password-protected."
        );
        setPdfToPhotoStatus(null);
      } finally {
        setIsExtractingPdf(false);
      }
    },
    []
  );

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPdfSourceName(file.name);
    const buffer = await file.arrayBuffer();
    lastPdfBufferRef.current = buffer;
    await renderPdfBufferToImages(buffer, pdfDpi, pdfOutFormat);
  };

  const downloadRenderedPage = async (page: RenderedPdfPage) => {
    const baseName = (pdfSourceName || "document").replace(/\.pdf$/i, "");
    const res = await fetch(page.dataUrl);
    const rawBlob = await res.blob();
    if (pdfOutFormat === "jpeg") {
      const ppiBlob = await setJpegPpi(rawBlob, PRINT_PPI);
      triggerBlobDownload(ppiBlob, `${baseName}-page-${page.pageNumber}.jpg`);
    } else {
      triggerBlobDownload(rawBlob, `${baseName}-page-${page.pageNumber}.png`);
    }
  };

  const handleDownloadAllSelectedPages = async () => {
    const selected = renderedPages.filter((p) => p.selected);
    if (selected.length === 0) return;
    for (const p of selected) {
      await downloadRenderedPage(p);
    }
    setPdfToPhotoStatus(`Downloaded ${selected.length} page image(s).`);
  };

  // --- TEXT TO IMAGE RENDERER ---
  const textCanvasDims = (() => {
    const found = TEXT_CANVAS_PRESETS.find((p) => p.id === textCanvasId);
    if (textCanvasId === "custom" || !found) {
      return {
        w: Math.min(3000, Math.max(300, Number(textCustomW) || 1200)),
        h: Math.min(3508, Math.max(300, Number(textCustomH) || 1200)),
      };
    }
    return { w: found.w, h: found.h };
  })();

  const buildTextImageCanvas = useCallback((): HTMLCanvasElement => {
    const { w, h } = textCanvasDims;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = textBgColor;
    ctx.fillRect(0, 0, w, h);

    if (textBorderMode !== "none") {
      const bw = textBorderMode === "bold" ? 14 : 4;
      const inset = bw * 2;
      ctx.strokeStyle = textColor;
      ctx.lineWidth = bw;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    }

    const fontStack =
      textFontFamily === "serif"
        ? 'Georgia, "Times New Roman", serif'
        : textFontFamily === "mono"
        ? '"IBM Plex Mono", monospace'
        : '"Plus Jakarta Sans", Arial, sans-serif';

    const padX = Math.round(w * 0.09);
    const padTop = Math.round(h * 0.1);
    const maxLineW = w - padX * 2;
    const xPos =
      textAlign === "center"
        ? w / 2
        : textAlign === "right"
        ? w - padX
        : padX;

    ctx.fillStyle = textColor;
    ctx.textAlign = textAlign;
    ctx.textBaseline = "top";

    let cursorY = padTop;

    if (textTitle.trim()) {
      const titleSize = Math.round(textFontSize * 1.25);
      ctx.font = `800 ${titleSize}px ${fontStack}`;
      ctx.fillText(textTitle.trim(), xPos, cursorY, maxLineW);
      cursorY += titleSize * 1.45;

      // Subtle divider line under header
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillRect(padX, cursorY - titleSize * 0.2, maxLineW, 2);
      ctx.restore();
      cursorY += Math.round(textFontSize * 0.55);
    }

    ctx.font = `500 ${textFontSize}px ${fontStack}`;
    const lineHeight = Math.round(textFontSize * 1.48);
    const paragraphs = textBody.split("\n");

    for (const para of paragraphs) {
      if (para.trim() === "") {
        cursorY += Math.round(lineHeight * 0.6);
        continue;
      }
      const words = para.split(/\s+/);
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxLineW && line) {
          if (cursorY + lineHeight < h - padTop * 0.8) {
            ctx.fillText(line, xPos, cursorY);
          }
          cursorY += lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line && cursorY + lineHeight < h - padTop * 0.8) {
        ctx.fillText(line, xPos, cursorY);
        cursorY += lineHeight;
      }
    }

    if (textFooter.trim()) {
      const footerSize = Math.max(18, Math.round(textFontSize * 0.62));
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.font = `600 ${footerSize}px ${fontStack}`;
      ctx.textBaseline = "bottom";
      ctx.fillText(textFooter.trim(), xPos, h - Math.round(h * 0.06), maxLineW);
      ctx.restore();
    }

    return canvas;
  }, [
    textCanvasDims,
    textBgColor,
    textColor,
    textBorderMode,
    textFontFamily,
    textFontSize,
    textAlign,
    textTitle,
    textBody,
    textFooter,
  ]);

  useEffect(() => {
    if (activeTab !== "text_to_image") return;
    const preview = textPreviewCanvasRef.current;
    if (!preview) return;
    const full = buildTextImageCanvas();
    const maxPreview = 560;
    const scale = Math.min(maxPreview / full.width, maxPreview / full.height);
    preview.width = Math.round(full.width * scale);
    preview.height = Math.round(full.height * scale);
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(full, 0, 0, preview.width, preview.height);
  }, [activeTab, buildTextImageCanvas]);

  const handleDownloadTextImage = async (format: "png" | "jpeg") => {
    const canvas = buildTextImageCanvas();
    const rawBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob(
        (b) => resolve(b!),
        format === "png" ? "image/png" : "image/jpeg",
        0.96
      )
    );
    const finalBlob =
      format === "jpeg" ? await setJpegPpi(rawBlob, PRINT_PPI) : rawBlob;
    const ext = format === "png" ? "png" : "jpg";
    const filename = `sun-nova-text-image-${canvas.width}x${canvas.height}.${ext}`;
    triggerBlobDownload(finalBlob, filename);
    const sizeKB = Math.round((finalBlob.size / 1024) * 10) / 10;
    setTextStatus(`Downloaded ${filename} (${sizeKB} KB)`);
  };

  // --- IMAGE TO TEXT (OCR) HANDLERS ---
  const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrImageUrl(URL.createObjectURL(file));
    setOcrError(null);
  };

  const handleRunOcr = async () => {
    if (!ocrImageUrl) {
      setOcrError("Please upload or capture an image first.");
      return;
    }
    try {
      setIsRunningOcr(true);
      setOcrError(null);

      const img = await loadHtmlImage(ocrImageUrl);
      const maxDim = 2000;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const base64 = dataUrl.split(",")[1];

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: "image/jpeg",
          mode: ocrMode,
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not extract text from image.");
      }
      setOcrResultText(data.text || "");
    } catch (err: unknown) {
      setOcrError(
        err instanceof Error ? err.message : "Failed to extract text."
      );
    } finally {
      setIsRunningOcr(false);
    }
  };

  const handleCopyOcrText = async () => {
    if (!ocrResultText.trim()) return;
    try {
      await navigator.clipboard.writeText(ocrResultText);
      setOcrCopied(true);
      setTimeout(() => setOcrCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadTxt = () => {
    if (!ocrResultText.trim()) return;
    const blob = new Blob([ocrResultText], { type: "text/plain;charset=utf-8" });
    triggerBlobDownload(blob, "sun-nova-extracted-text.txt");
  };

  return (
    <section className="space-y-6">
      {/* Sub-navigation for all 5 converters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: "photo_to_pdf", label: "Photo → PDF", icon: FileText },
              { id: "pdf_to_photo", label: "PDF → Photo", icon: FileImage },
              { id: "text_to_image", label: "Text → Image", icon: Type },
              { id: "image_to_text", label: "Image → Text (OCR)", icon: ScanText },
              { id: "xml_converter", label: "XML File Converter", icon: FileCode2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500 font-mono-nums">
          PDF, XML, Text &amp; OCR Studio
        </span>
      </div>

      {/* TAB 1: PHOTO TO PDF */}
      {activeTab === "photo_to_pdf" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Photo to PDF Converter
                </h2>
                <p className="text-xs text-slate-500">
                  Combine one or multiple photos into a clean multi-page PDF.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Add Photos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      handleAddPdfPhotos(e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setCameraFor("pdf")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Click</span>
                </button>
                {pdfPhotos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPdfPhotos([])}
                    className="text-xs text-slate-500 hover:text-red-600 cursor-pointer ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {pdfPhotos.length === 0 ? (
              <label className="h-64 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-lg bg-slate-50 flex flex-col items-center justify-center gap-2 p-6 text-center cursor-pointer transition-colors">
                <FileText className="w-8 h-8 text-amber-600" />
                <span className="text-sm font-semibold text-slate-900">
                  Select Photos to Convert into PDF
                </span>
                <span className="text-xs text-slate-500">
                  Supports multiple JPG, PNG, WEBP or live Camera captures
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    handleAddPdfPhotos(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pdfPhotos.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex flex-col gap-2"
                  >
                    <div className="h-32 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                      <img
                        src={item.url}
                        alt={item.name}
                        style={{ transform: `rotate(${item.rotDeg}deg)` }}
                        className="max-h-full max-w-full object-contain transition-transform"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600">
                      <span className="font-mono-nums font-semibold">
                        Page {idx + 1}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => movePdfPhoto(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePdfPhoto(idx, 1)}
                          disabled={idx === pdfPhotos.length - 1}
                          className="p-1 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPdfPhotos((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? { ...p, rotDeg: (p.rotDeg + 90) % 360 }
                                  : p
                              )
                            )
                          }
                          className="p-1 hover:text-amber-700 cursor-pointer"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPdfPhotos((prev) =>
                              prev.filter((p) => p.id !== item.id)
                            )
                          }
                          className="p-1 hover:text-red-600 cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              PDF Page Settings
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PDF Page Size
              </label>
              <select
                value={pdfPagePreset}
                onChange={(e) =>
                  setPdfPagePreset(e.target.value as PdfPagePreset)
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white"
              >
                <option value="a4">A4 Document (210 × 297 mm)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
                <option value="4x6">4 × 6 inch Photo Page</option>
                <option value="fit">Fit Page to Each Photo</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Orientation
                </label>
                <select
                  value={pdfOrientation}
                  disabled={pdfPagePreset === "fit"}
                  onChange={(e) =>
                    setPdfOrientation(e.target.value as PdfOrientation)
                  }
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 bg-white disabled:bg-slate-100"
                >
                  <option value="auto">Auto (Match Photo)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Page Margin
                </label>
                <select
                  value={pdfMarginMm}
                  onChange={(e) => setPdfMarginMm(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value={0}>0 mm (Full Bleed)</option>
                  <option value={8}>8 mm (Small)</option>
                  <option value={15}>15 mm (Standard)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Output Filename
              </label>
              <input
                type="text"
                value={pdfFilename}
                onChange={(e) => setPdfFilename(e.target.value)}
                placeholder="sun-nova-photos"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>

            {pdfError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {pdfError}
              </div>
            )}
            {pdfStatus && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono-nums">
                {pdfStatus}
              </div>
            )}

            <button
              type="button"
              disabled={pdfPhotos.length === 0 || isBuildingPdf}
              onClick={handleGeneratePdf}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            >
              {isBuildingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isBuildingPdf
                  ? "Building PDF..."
                  : `Convert & Download PDF (${pdfPhotos.length} ${
                      pdfPhotos.length === 1 ? "Page" : "Pages"
                    })`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PDF TO PHOTO */}
      {activeTab === "pdf_to_photo" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  PDF to Photo Converter
                </h2>
                <p className="text-xs text-slate-500">
                  Extract every PDF page as crisp JPG or PNG photos right in
                  your browser.
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{pdfSourceName ? "Change PDF" : "Upload PDF"}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>
            </div>

            {isExtractingPdf ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-600 text-sm">
                <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
                <span>Rendering PDF pages...</span>
              </div>
            ) : renderedPages.length === 0 ? (
              <label className="h-64 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-lg bg-slate-50 flex flex-col items-center justify-center gap-2 p-6 text-center cursor-pointer transition-colors">
                <FileImage className="w-8 h-8 text-amber-600" />
                <span className="text-sm font-semibold text-slate-900">
                  Drop or Select a PDF File
                </span>
                <span className="text-xs text-slate-500">
                  Convert E-Aadhaar, PAN, certificates, or multi-page PDFs into
                  high-DPI photos
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {renderedPages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className={`rounded-lg border p-2.5 flex flex-col gap-2 ${
                      page.selected
                        ? "border-amber-500 bg-amber-50/30"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <label className="inline-flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={page.selected}
                          onChange={(e) =>
                            setRenderedPages((prev) =>
                              prev.map((p) =>
                                p.pageNumber === page.pageNumber
                                  ? { ...p, selected: e.target.checked }
                                  : p
                              )
                            )
                          }
                          className="rounded accent-amber-600"
                        />
                        <span>Page {page.pageNumber}</span>
                      </label>
                      <span className="text-[11px] font-mono-nums text-slate-500">
                        {page.width}×{page.height}
                      </span>
                    </div>

                    <div className="h-44 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                      <img
                        src={page.dataUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void downloadRenderedPage(page)}
                        className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white py-1.5 rounded cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOcrImageUrl(page.dataUrl);
                          setActiveTab("image_to_text");
                        }}
                        className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 rounded cursor-pointer"
                      >
                        <ScanText className="w-3 h-3" />
                        <span>OCR Text</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Export Quality &amp; Format
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Output Image Format
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: "jpeg", label: "JPG (300 PPI)" },
                    { id: "png", label: "PNG (Lossless)" },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      setPdfOutFormat(fmt.id);
                      if (lastPdfBufferRef.current) {
                        void renderPdfBufferToImages(
                          lastPdfBufferRef.current,
                          pdfDpi,
                          fmt.id
                        );
                      }
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                      pdfOutFormat === fmt.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Render Resolution (DPI)
              </label>
              <select
                value={pdfDpi}
                onChange={(e) => {
                  const nextDpi = Number(e.target.value);
                  setPdfDpi(nextDpi);
                  if (lastPdfBufferRef.current) {
                    void renderPdfBufferToImages(
                      lastPdfBufferRef.current,
                      nextDpi,
                      pdfOutFormat
                    );
                  }
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white"
              >
                <option value={150}>150 DPI (Fast Screen / Share)</option>
                <option value={200}>200 DPI (High Quality)</option>
                <option value={300}>300 DPI (Studio Print Ready)</option>
              </select>
            </div>

            {renderedPages.length > 0 && (
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setRenderedPages((prev) =>
                      prev.map((p) => ({ ...p, selected: true }))
                    )
                  }
                  className="text-amber-700 font-semibold underline cursor-pointer"
                >
                  Select All ({renderedPages.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRenderedPages((prev) =>
                      prev.map((p) => ({ ...p, selected: false }))
                    )
                  }
                  className="text-slate-500 underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            )}

            {pdfToPhotoError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {pdfToPhotoError}
              </div>
            )}
            {pdfToPhotoStatus && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono-nums">
                {pdfToPhotoStatus}
              </div>
            )}

            <button
              type="button"
              disabled={renderedPages.filter((p) => p.selected).length === 0}
              onClick={handleDownloadAllSelectedPages}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                Download Selected Pages (
                {renderedPages.filter((p) => p.selected).length})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: TEXT TO IMAGE */}
      {activeTab === "text_to_image" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Text to Image Converter
              </h2>
              <p className="text-xs text-slate-500">
                Turn notices, text cards, or notes into crisp PNG / 300 PPI JPG
                images.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Heading / Title (Optional)
              </label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Heading"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Body Text
              </label>
              <textarea
                rows={6}
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                placeholder="Type or paste your text..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Footer Note (Optional)
              </label>
              <input
                type="text"
                value={textFooter}
                onChange={(e) => setTextFooter(e.target.value)}
                placeholder="Footer text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Canvas Size
                </label>
                <select
                  value={textCanvasId}
                  onChange={(e) => setTextCanvasId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 bg-white"
                >
                  {TEXT_CANVAS_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Font Style
                </label>
                <select
                  value={textFontFamily}
                  onChange={(e) =>
                    setTextFontFamily(
                      e.target.value as "sans" | "serif" | "mono"
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="sans">Modern Sans</option>
                  <option value="serif">Classic Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
            </div>

            {textCanvasId === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={3000}
                    value={textCustomW}
                    onChange={(e) => setTextCustomW(Number(e.target.value))}
                    className="w-full font-mono-nums border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={3508}
                    value={textCustomH}
                    onChange={(e) => setTextCustomH(Number(e.target.value))}
                    className="w-full font-mono-nums border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-semibold text-slate-700">
                    Text Size
                  </span>
                  <span className="font-mono-nums">{textFontSize} px</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={84}
                  value={textFontSize}
                  onChange={(e) => setTextFontSize(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Align &amp; Frame
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                  {(["left", "center", "right"] as const).map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => setTextAlign(al)}
                      className={`py-1 text-[11px] font-semibold rounded capitalize cursor-pointer ${
                        textAlign === al
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      {al}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                {TEXT_BG_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    onClick={() => {
                      setTextBgColor(p.bg);
                      setTextColor(p.text);
                    }}
                    className={`w-6 h-6 rounded-full border cursor-pointer ${
                      textBgColor.toUpperCase() === p.bg
                        ? "ring-2 ring-amber-500 border-slate-900"
                        : "border-slate-300"
                    }`}
                    style={{ backgroundColor: p.bg }}
                  />
                ))}
                <input
                  type="color"
                  title="Background color"
                  value={textBgColor}
                  onChange={(e) => setTextBgColor(e.target.value)}
                  className="w-6 h-6 rounded border border-slate-300 p-0 cursor-pointer"
                />
                <input
                  type="color"
                  title="Text color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-6 h-6 rounded border border-slate-300 p-0 cursor-pointer"
                />
              </div>

              <select
                aria-label="Border frame"
                value={textBorderMode}
                onChange={(e) =>
                  setTextBorderMode(
                    e.target.value as "none" | "thin" | "bold"
                  )
                }
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-white"
              >
                <option value="none">No Frame</option>
                <option value="thin">Thin Border</option>
                <option value="bold">Bold Border</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 font-mono-nums">
              <span className="font-semibold text-slate-800">Live Preview</span>
              <span>
                {textCanvasDims.w} × {textCanvasDims.h} px
              </span>
            </div>

            <div className="bg-slate-100 rounded-lg border border-slate-200 p-4 flex items-center justify-center min-h-[320px]">
              <canvas
                ref={textPreviewCanvasRef}
                className="max-w-full max-h-[380px] w-auto h-auto shadow-md border border-slate-300 bg-white"
              />
            </div>

            {textStatus && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono-nums">
                {textStatus}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadTextImage("png")}
                className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadTextImage("jpeg")}
                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download 300 PPI JPG</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const dataUrl = buildTextImageCanvas().toDataURL(
                    "image/jpeg",
                    0.95
                  );
                  setPdfPhotos((prev) => [
                    ...prev,
                    {
                      id: `${Date.now()}-txt`,
                      name: "Text Card",
                      url: dataUrl,
                      rotDeg: 0,
                    },
                  ]);
                  setActiveTab("photo_to_pdf");
                }}
                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Send to PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: IMAGE TO TEXT (OCR) */}
      {activeTab === "image_to_text" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Image to Text Converter (OCR)
                </h2>
                <p className="text-xs text-slate-500">
                  Extract printed or handwritten text from photos and ID scans.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{ocrImageUrl ? "Change Image" : "Upload Image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleOcrFileChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setCameraFor("ocr")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Click Photo</span>
              </button>
            </div>

            {ocrImageUrl ? (
              <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden p-2">
                <img
                  src={ocrImageUrl}
                  alt="OCR input preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <label className="h-64 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-lg bg-slate-50 flex flex-col items-center justify-center gap-2 p-6 text-center cursor-pointer transition-colors">
                <ImageIcon className="w-8 h-8 text-amber-600" />
                <span className="text-sm font-semibold text-slate-900">
                  Upload Document, Note, or ID Photo
                </span>
                <span className="text-xs text-slate-500">
                  Supports English, Hindi &amp; regional text, tables, and
                  handwriting
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleOcrFileChange}
                  className="hidden"
                />
              </label>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Extraction Format
              </label>
              <select
                value={ocrMode}
                onChange={(e) =>
                  setOcrMode(
                    e.target.value as
                      | "plain"
                      | "paragraph"
                      | "id_card"
                      | "table"
                  )
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white"
              >
                <option value="plain">Exact Text (Preserve Lines)</option>
                <option value="paragraph">Clean Readable Paragraphs</option>
                <option value="id_card">ID Card / Form Key-Value Fields</option>
                <option value="table">Table / List Rows</option>
              </select>
            </div>

            {ocrError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {ocrError}
              </div>
            )}

            <button
              type="button"
              disabled={!ocrImageUrl || isRunningOcr}
              onClick={handleRunOcr}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            >
              {isRunningOcr ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ScanText className="w-4 h-4" />
              )}
              <span>
                {isRunningOcr ? "Extracting Text..." : "Extract Text from Image"}
              </span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">
                Extracted Text Output
              </span>
              <span className="text-xs font-mono-nums text-slate-500">
                {ocrResultText.trim()
                  ? `${ocrResultText.trim().split(/\s+/).length} words · ${ocrResultText.length} chars`
                  : "Ready"}
              </span>
            </div>

            <textarea
              rows={12}
              value={ocrResultText}
              onChange={(e) => setOcrResultText(e.target.value)}
              placeholder="Extracted text will appear here. You can edit it freely, copy it, download .txt, or send it to Text → Image."
              className="w-full border border-slate-300 rounded-lg px-3.5 py-3 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!ocrResultText.trim()}
                  onClick={handleCopyOcrText}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
                >
                  {ocrCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{ocrCopied ? "Copied" : "Copy Text"}</span>
                </button>

                <button
                  type="button"
                  disabled={!ocrResultText.trim()}
                  onClick={handleDownloadTxt}
                  className="inline-flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT</span>
                </button>
              </div>

              <button
                type="button"
                disabled={!ocrResultText.trim()}
                onClick={() => {
                  setTextTitle("");
                  setTextBody(ocrResultText);
                  setActiveTab("text_to_image");
                }}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Convert to Image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: XML FILE CONVERTER */}
      {activeTab === "xml_converter" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  XML File Converter &amp; Validator
                </h2>
                <p className="text-xs text-slate-500">
                  Convert XML to JSON, CSV, Formatted XML, Minified XML, Text — or JSON/CSV to XML.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept=".xml,.json,.csv,.txt,application/xml,text/xml,application/json,text/csv"
                    onChange={handleXmlFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setXmlInputText(SAMPLE_XML_DOC);
                    setXmlSourceName("print-orders.xml");
                    if (xmlMode === "json_to_xml" || xmlMode === "csv_to_xml") {
                      setXmlMode("xml_to_json");
                    }
                    setXmlStatus(null);
                  }}
                  className="text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  Load Sample
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setXmlInputText("");
                    setXmlStatus(null);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conversion Mode
                </label>
                <select
                  value={xmlMode}
                  onChange={(e) => {
                    setXmlMode(e.target.value as XmlConversionMode);
                    setXmlStatus(null);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 bg-white"
                >
                  <option value="xml_to_json">XML → JSON (.json)</option>
                  <option value="xml_to_csv">XML → CSV / Excel (.csv)</option>
                  <option value="xml_pretty">Format / Pretty XML (.xml)</option>
                  <option value="xml_minify">Minify XML (.xml)</option>
                  <option value="xml_to_text">XML → Plain Text Report (.txt)</option>
                  <option value="json_to_xml">JSON → XML (.xml)</option>
                  <option value="csv_to_xml">CSV → XML (.xml)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Indentation / Output Base Name
                </label>
                <div className="flex gap-2">
                  <select
                    aria-label="Indentation"
                    value={xmlIndent}
                    onChange={(e) => setXmlIndent(e.target.value as "2" | "4" | "tab")}
                    className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-900 bg-white"
                  >
                    <option value="2">2 Spaces</option>
                    <option value="4">4 Spaces</option>
                    <option value="tab">Tab</option>
                  </select>
                  <input
                    type="text"
                    value={xmlSourceName}
                    onChange={(e) => setXmlSourceName(e.target.value)}
                    placeholder="output-name"
                    className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 font-mono-nums"
                  />
                </div>
              </div>
            </div>

            {(xmlMode === "json_to_xml" || xmlMode === "csv_to_xml") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Root XML Element Tag
                  </label>
                  <input
                    type="text"
                    value={xmlRootTag}
                    onChange={(e) => setXmlRootTag(e.target.value)}
                    placeholder="dataset"
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-nums text-slate-900"
                  />
                </div>
                {xmlMode === "csv_to_xml" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Row XML Element Tag
                    </label>
                    <input
                      type="text"
                      value={xmlRowTag}
                      onChange={(e) => setXmlRowTag(e.target.value)}
                      placeholder="record"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono-nums text-slate-900"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">
                  Source Input ({xmlMode === "json_to_xml" ? "JSON" : xmlMode === "csv_to_xml" ? "CSV" : "XML"})
                </span>
                <span className="font-mono-nums text-slate-500">
                  {xmlValidation
                    ? xmlValidation.valid
                      ? `Valid <${xmlValidation.rootTag}> · ${xmlValidation.elementCount} nodes`
                      : "XML Syntax Notice"
                    : `${xmlInputText.split("\n").length} lines`}
                </span>
              </div>
              <textarea
                rows={13}
                value={xmlInputText}
                onChange={(e) => setXmlInputText(e.target.value)}
                spellCheck={false}
                placeholder="Paste XML, JSON, or CSV content here, or click Upload File above..."
                className="w-full font-mono-nums border border-slate-300 rounded-lg px-3 py-2.5 text-xs leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">
                Converted Output (.{xmlConverted.ext.toUpperCase()})
              </span>
              <span className="text-xs font-mono-nums text-slate-500">
                {xmlConverted.output
                  ? `${xmlConverted.output.split("\n").length} lines · ${xmlConverted.output.length} chars`
                  : "Waiting for valid input"}
              </span>
            </div>

            {xmlConverted.error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {xmlConverted.error}
              </div>
            )}

            <textarea
              rows={15}
              readOnly
              value={xmlConverted.output}
              placeholder="Converted output will appear here live..."
              className="w-full font-mono-nums border border-slate-300 rounded-lg px-3 py-2.5 text-xs leading-relaxed text-slate-900 bg-slate-50"
            />

            {xmlStatus && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono-nums">
                {xmlStatus}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!xmlConverted.output}
                  onClick={handleCopyXmlOutput}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
                >
                  {xmlCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{xmlCopied ? "Copied" : "Copy Output"}</span>
                </button>

                <button
                  type="button"
                  disabled={!xmlConverted.output}
                  onClick={handleDownloadXmlOutput}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .{xmlConverted.ext.toUpperCase()}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={!xmlConverted.output}
                onClick={() => {
                  setTextTitle(xmlSourceName || "XML Export");
                  setTextBody(xmlConverted.output.slice(0, 4000));
                  setActiveTab("text_to_image");
                }}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Send to Text → Image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CameraCaptureModal
        isOpen={cameraFor !== null}
        onClose={() => setCameraFor(null)}
        onCapture={(blob) => {
          const url = URL.createObjectURL(blob);
          if (cameraFor === "pdf") {
            setPdfPhotos((prev) => [
              ...prev,
              {
                id: `${Date.now()}-cam`,
                name: "Camera Photo",
                url,
                rotDeg: 0,
              },
            ]);
          } else if (cameraFor === "ocr") {
            setOcrImageUrl(url);
          }
        }}
      />
    </section>
  );
}
