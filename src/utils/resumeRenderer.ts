import {
  ResumeData,
  ResumePhotoBorderStyle,
  ResumePhotoShape,
} from "../types/resume";
import { loadHtmlImage } from "./imageProcessing";

export interface ResumeRenderOptions {
  /** Scale factor vs 300 PPI (1.0 = full 2480x3508px, 0.5 = 1240x1754px preview) */
  scale?: number;
}

function getFontStacks(family: ResumeData["fontFamily"]) {
  if (family === "serif") {
    return {
      heading: `"Georgia", "Times New Roman", serif`,
      body: `"Georgia", "Times New Roman", serif`,
      mono: `"IBM Plex Mono", monospace`,
    };
  }
  if (family === "classic") {
    return {
      heading: `"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`,
      body: `"Segoe UI", "Helvetica Neue", Arial, sans-serif`,
      mono: `"IBM Plex Mono", monospace`,
    };
  }
  return {
    heading: `"Plus Jakarta Sans", system-ui, sans-serif`,
    body: `"Plus Jakarta Sans", system-ui, sans-serif`,
    mono: `"IBM Plex Mono", monospace`,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(16, 31, 60, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, "").split("\n");
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>
) {
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function buildPhotoShapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  shape: ResumePhotoShape
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (shape === "circle") {
    const rad = Math.min(w, h) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.closePath();
  } else if (shape === "oval") {
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if (shape === "squircle") {
    drawRoundedRectPath(ctx, x, y, w, h, Math.round(Math.min(w, h) * 0.28));
  } else if (shape === "rounded") {
    drawRoundedRectPath(ctx, x, y, w, h, Math.round(Math.min(w, h) * 0.1));
  } else if (shape === "hexagon") {
    const rx = w / 2;
    const ry = h / 2;
    drawPolygonPath(ctx, [
      [cx, y],
      [x + w, cy - ry * 0.5],
      [x + w, cy + ry * 0.5],
      [cx, y + h],
      [x, cy + ry * 0.5],
      [x, cy - ry * 0.5],
    ]);
  } else if (shape === "octagon") {
    const cX = w * 0.27;
    const cY = h * 0.27;
    drawPolygonPath(ctx, [
      [x + cX, y],
      [x + w - cX, y],
      [x + w, y + cY],
      [x + w, y + h - cY],
      [x + w - cX, y + h],
      [x + cX, y + h],
      [x, y + h - cY],
      [x, y + cY],
    ]);
  } else if (shape === "diamond") {
    drawPolygonPath(ctx, [
      [cx, y],
      [x + w, cy],
      [cx, y + h],
      [x, cy],
    ]);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
  }
}

function drawClippedPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  shape: ResumePhotoShape,
  borderColor: string,
  lineWidth: number,
  borderStyle: ResumePhotoBorderStyle
) {
  ctx.save();
  buildPhotoShapePath(ctx, x, y, w, h, shape);
  ctx.clip();

  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = Math.max(0, (img.height - sh) * 0.25);
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();

  if (borderStyle === "none" || lineWidth <= 0) return;

  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  if (borderStyle === "dashed") {
    ctx.setLineDash([lineWidth * 2.2, lineWidth * 1.4]);
  }
  buildPhotoShapePath(ctx, x, y, w, h, shape);
  ctx.stroke();

  if (borderStyle === "double") {
    const gap = Math.max(2, lineWidth * 1.6);
    ctx.lineWidth = Math.max(1, lineWidth * 0.55);
    buildPhotoShapePath(ctx, x - gap, y - gap, w + gap * 2, h + gap * 2, shape);
    ctx.stroke();
  }
  ctx.restore();
}

function getInitials(name: string): string {
  const parts = (name || "S N").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function renderResumeCanvases(
  data: ResumeData,
  options: ResumeRenderOptions = {}
): Promise<HTMLCanvasElement[]> {
  const scale = options.scale ?? 1;
  const baseW = data.paperSize === "letter" ? 2550 : 2480;
  const baseH = data.paperSize === "letter" ? 3300 : 3508;
  const pageW = Math.round(baseW * scale);
  const pageH = Math.round(baseH * scale);

  const s = (v: number) => v * scale;
  const fs = (v: number) => Math.round(v * data.fontScale * scale);

  // Line, section & item spacing multipliers
  const lineGapScale = data.lineGapScale ?? 1;
  const sectionGapScale = data.sectionGapScale ?? 1;
  const itemGapScale = data.itemGapScale ?? 1;
  const ls = (v: number) => Math.round(v * data.fontScale * lineGapScale * scale);
  const sg = (v: number) => v * sectionGapScale * scale;
  const ig = (v: number) => v * itemGapScale * scale;

  const fonts = getFontStacks(data.fontFamily);
  const accent = data.accentColor || "#101F3C";
  const photoBorderStyle = data.photoBorderStyle || "solid";
  const photoBorderWidth = s(data.photoBorderWidth ?? 5);
  const photoScale = data.photoSizeScale ?? 1;

  let photoImg: HTMLImageElement | null = null;
  if (data.showPhoto && data.photoUrl) {
    try {
      photoImg = await loadHtmlImage(data.photoUrl);
    } catch {
      photoImg = null;
    }
  }

  const pages: HTMLCanvasElement[] = [];

  const createPageCanvas = (): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } => {
    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, pageW, pageH);
    pages.push(canvas);
    return { canvas, ctx };
  };

  const contactParts = [
    data.email.trim(),
    data.phone.trim(),
    data.location.trim(),
    data.website.trim(),
  ].filter(Boolean);

  // =========================================================================
  // SIDEBAR TEMPLATES: sidebar (left), right_sidebar (right), split_dark (dark left)
  // =========================================================================
  if (
    data.template === "sidebar" ||
    data.template === "right_sidebar" ||
    data.template === "split_dark"
  ) {
    const isRight = data.template === "right_sidebar";
    const isDarkSide = data.template === "split_dark";
    const sidebarW = Math.round(pageW * 0.32);
    const sideAreaX = isRight ? pageW - sidebarW : 0;
    const mainX = isRight ? s(110) : sidebarW + s(95);
    const mainW = pageW - sidebarW - s(205);
    const marginTop = s(120);
    const marginBottom = s(120);
    const maxPages = 3;

    const sideTextPrimary = isDarkSide ? "#F8FAFC" : "#0F172A";
    const sideTextSecondary = isDarkSide ? "#CBD5E1" : "#334155";
    const sideHeadingColor = isDarkSide ? "#FFFFFF" : accent;
    const sideDividerColor = isDarkSide
      ? "rgba(255,255,255,0.28)"
      : hexToRgba(accent, 0.25);

    const paintSidebarBackground = (ctx: CanvasRenderingContext2D) => {
      if (isDarkSide) {
        ctx.fillStyle = accent;
        ctx.fillRect(sideAreaX, 0, sidebarW, pageH);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(sideAreaX, 0, sidebarW, pageH);
      } else {
        ctx.fillStyle = hexToRgba(accent, 0.08);
        ctx.fillRect(sideAreaX, 0, sidebarW, pageH);
        ctx.fillStyle = accent;
        ctx.fillRect(
          isRight ? pageW - s(18) : 0,
          0,
          s(18),
          pageH
        );
      }
    };

    const first = createPageCanvas();
    let ctx = first.ctx;
    paintSidebarBackground(ctx);

    let sideY = marginTop;
    const sideX = sideAreaX + s(68);
    const sideInnerW = sidebarW - s(136);

    if (photoImg && data.showPhoto) {
      const pw = Math.min(sideInnerW, s(340 * photoScale));
      const isSym =
        data.photoShape === "circle" ||
        data.photoShape === "square" ||
        data.photoShape === "diamond" ||
        data.photoShape === "octagon" ||
        data.photoShape === "squircle";
      const ph = isSym ? pw : pw * 1.18;
      const px = sideX + (sideInnerW - pw) / 2;
      drawClippedPhoto(
        ctx,
        photoImg,
        px,
        sideY,
        pw,
        ph,
        data.photoShape,
        isDarkSide ? "rgba(255,255,255,0.7)" : hexToRgba(accent, 0.45),
        photoBorderWidth,
        photoBorderStyle
      );
      sideY += ph + sg(54);
    }

    const drawSidebarHeading = (title: string) => {
      ctx.font = `700 ${fs(31)}px ${fonts.heading}`;
      ctx.fillStyle = sideHeadingColor;
      ctx.fillText(title.toUpperCase(), sideX, sideY);
      sideY += s(16);
      ctx.fillStyle = sideDividerColor;
      ctx.fillRect(sideX, sideY, sideInnerW, s(3));
      sideY += s(34);
    };

    if (contactParts.length > 0) {
      drawSidebarHeading("Contact");
      ctx.font = `500 ${fs(27)}px ${fonts.body}`;
      ctx.fillStyle = sideTextSecondary;
      for (const part of contactParts) {
        for (const ln of wrapText(ctx, part, sideInnerW)) {
          ctx.fillText(ln, sideX, sideY);
          sideY += ls(37);
        }
        sideY += ig(8);
      }
      sideY += sg(30);
    }

    if (data.visibleSections.skills && data.skills.length > 0) {
      drawSidebarHeading(data.sectionTitles.skills || "Skills");
      ctx.font = `500 ${fs(27)}px ${fonts.body}`;
      for (const skill of data.skills) {
        if (sideY > pageH - marginBottom) break;
        ctx.fillStyle = sideTextPrimary;
        for (const ln of wrapText(ctx, `•  ${skill}`, sideInnerW)) {
          ctx.fillText(ln, sideX, sideY);
          sideY += ls(36);
        }
        sideY += ig(6);
      }
      sideY += sg(30);
    }

    if (data.visibleSections.certifications && data.certifications.length > 0) {
      drawSidebarHeading(data.sectionTitles.certifications || "Certifications");
      for (const cert of data.certifications) {
        if (sideY > pageH - marginBottom) break;
        ctx.font = `700 ${fs(27)}px ${fonts.body}`;
        ctx.fillStyle = sideTextPrimary;
        for (const ln of wrapText(ctx, cert.title, sideInnerW)) {
          ctx.fillText(ln, sideX, sideY);
          sideY += ls(35);
        }
        const meta = [cert.issuer, cert.year].filter(Boolean).join(" · ");
        if (meta) {
          ctx.font = `400 ${fs(24)}px ${fonts.body}`;
          ctx.fillStyle = sideTextSecondary;
          for (const ln of wrapText(ctx, meta, sideInnerW)) {
            ctx.fillText(ln, sideX, sideY);
            sideY += ls(32);
          }
        }
        sideY += ig(18);
      }
      sideY += sg(22);
    }

    if (data.visibleSections.languages && data.languages.trim()) {
      if (sideY < pageH - marginBottom - s(90)) {
        drawSidebarHeading(data.sectionTitles.languages || "Languages");
        ctx.font = `400 ${fs(26)}px ${fonts.body}`;
        ctx.fillStyle = sideTextSecondary;
        for (const ln of wrapText(ctx, data.languages, sideInnerW)) {
          ctx.fillText(ln, sideX, sideY);
          sideY += ls(36);
        }
      }
    }

    // Main Column Header
    let mainY = marginTop + s(24);
    ctx.font = `800 ${fs(76)}px ${fonts.heading}`;
    ctx.fillStyle = "#0F172A";
    for (const ln of wrapText(ctx, data.fullName || "Your Name", mainW)) {
      ctx.fillText(ln, mainX, mainY);
      mainY += ls(82);
    }
    if (data.jobTitle.trim()) {
      ctx.font = `600 ${fs(36)}px ${fonts.heading}`;
      ctx.fillStyle = accent;
      for (const ln of wrapText(ctx, data.jobTitle, mainW)) {
        ctx.fillText(ln, mainX, mainY);
        mainY += ls(44);
      }
    }
    mainY += s(18);
    ctx.fillStyle = accent;
    ctx.fillRect(mainX, mainY, s(150), s(6));
    mainY += sg(50);

    const ensureMainSpace = (needed: number) => {
      if (mainY + needed > pageH - marginBottom && pages.length < maxPages) {
        const next = createPageCanvas();
        ctx = next.ctx;
        paintSidebarBackground(ctx);
        mainY = marginTop;
      }
    };

    const drawMainSectionTitle = (title: string) => {
      ensureMainSpace(s(120));
      ctx.font = `700 ${fs(34)}px ${fonts.heading}`;
      ctx.fillStyle = accent;
      ctx.fillText(title.toUpperCase(), mainX, mainY);
      mainY += s(16);
      ctx.fillStyle = "#CBD5E1";
      ctx.fillRect(mainX, mainY, mainW, s(3));
      mainY += s(40);
    };

    const mainSections = data.sectionOrder.filter(
      (k) =>
        k !== "skills" &&
        k !== "certifications" &&
        k !== "languages" &&
        data.visibleSections[k]
    );

    for (const sec of mainSections) {
      if (sec === "summary" && data.summary.trim()) {
        drawMainSectionTitle(data.sectionTitles.summary);
        ctx.font = `400 ${fs(30)}px ${fonts.body}`;
        ctx.fillStyle = "#334155";
        for (const ln of wrapText(ctx, data.summary, mainW)) {
          ensureMainSpace(ls(44));
          ctx.fillText(ln, mainX, mainY);
          mainY += ls(42);
        }
        mainY += sg(34);
      }

      if (sec === "experience" && data.experience.length > 0) {
        drawMainSectionTitle(data.sectionTitles.experience);
        for (const exp of data.experience) {
          ensureMainSpace(s(170));
          ctx.font = `700 ${fs(34)}px ${fonts.heading}`;
          ctx.fillStyle = "#0F172A";
          ctx.fillText(exp.role || "Role", mainX, mainY);

          if (exp.period.trim()) {
            ctx.font = `600 ${fs(27)}px ${fonts.mono}`;
            ctx.fillStyle = "#475569";
            const pw = ctx.measureText(exp.period).width;
            ctx.fillText(exp.period, mainX + mainW - pw, mainY);
          }
          mainY += ls(42);

          const orgLine = [exp.organization, exp.location]
            .filter(Boolean)
            .join(" · ");
          if (orgLine) {
            ctx.font = `600 ${fs(29)}px ${fonts.body}`;
            ctx.fillStyle = accent;
            ctx.fillText(orgLine, mainX, mainY);
            mainY += ls(40);
          }

          if (exp.bullets.trim()) {
            ctx.font = `400 ${fs(28)}px ${fonts.body}`;
            for (const rawLine of exp.bullets.split("\n")) {
              const cleaned = rawLine.trim();
              if (!cleaned) continue;
              const isBullet =
                cleaned.startsWith("•") ||
                cleaned.startsWith("-") ||
                cleaned.startsWith("*");
              const textBody = isBullet
                ? cleaned.replace(/^[•\-*]\s*/, "")
                : cleaned;
              const wrapped = wrapText(ctx, textBody, mainW - s(36));
              wrapped.forEach((wLine, idx) => {
                ensureMainSpace(ls(42));
                if (idx === 0) {
                  ctx.fillStyle = accent;
                  ctx.fillText("•", mainX + s(6), mainY);
                }
                ctx.fillStyle = "#334155";
                ctx.fillText(wLine, mainX + s(34), mainY);
                mainY += ls(39);
              });
            }
          }
          mainY += ig(28);
        }
        mainY += sg(12);
      }

      if (sec === "education" && data.education.length > 0) {
        drawMainSectionTitle(data.sectionTitles.education);
        for (const edu of data.education) {
          ensureMainSpace(s(110));
          ctx.font = `700 ${fs(32)}px ${fonts.heading}`;
          ctx.fillStyle = "#0F172A";
          ctx.fillText(edu.degree || "Degree", mainX, mainY);

          if (edu.year.trim()) {
            ctx.font = `600 ${fs(26)}px ${fonts.mono}`;
            ctx.fillStyle = "#475569";
            const yw = ctx.measureText(edu.year).width;
            ctx.fillText(edu.year, mainX + mainW - yw, mainY);
          }
          mainY += ls(39);

          const instLine = [edu.institution, edu.grade]
            .filter(Boolean)
            .join("  ·  ");
          if (instLine) {
            ctx.font = `400 ${fs(28)}px ${fonts.body}`;
            ctx.fillStyle = "#475569";
            for (const ln of wrapText(ctx, instLine, mainW)) {
              ctx.fillText(ln, mainX, mainY);
              mainY += ls(37);
            }
          }
          mainY += ig(22);
        }
        mainY += sg(12);
      }

      if (sec === "projects" && data.projects.length > 0) {
        drawMainSectionTitle(data.sectionTitles.projects);
        for (const proj of data.projects) {
          ensureMainSpace(s(120));
          ctx.font = `700 ${fs(31)}px ${fonts.heading}`;
          ctx.fillStyle = "#0F172A";
          ctx.fillText(proj.title, mainX, mainY);
          if (proj.subtitle.trim()) {
            ctx.font = `500 ${fs(25)}px ${fonts.mono}`;
            ctx.fillStyle = "#64748B";
            const sw = ctx.measureText(proj.subtitle).width;
            ctx.fillText(proj.subtitle, mainX + mainW - sw, mainY);
          }
          mainY += ls(38);
          if (proj.details.trim()) {
            ctx.font = `400 ${fs(28)}px ${fonts.body}`;
            ctx.fillStyle = "#334155";
            for (const ln of wrapText(ctx, proj.details, mainW)) {
              ensureMainSpace(ls(40));
              ctx.fillText(ln, mainX, mainY);
              mainY += ls(38);
            }
          }
          mainY += ig(20);
        }
        mainY += sg(12);
      }

      if (sec === "declaration" && data.declarationText.trim()) {
        drawMainSectionTitle(data.sectionTitles.declaration);
        ctx.font = `400 ${fs(27)}px ${fonts.body}`;
        ctx.fillStyle = "#334155";
        for (const ln of wrapText(ctx, data.declarationText, mainW)) {
          ensureMainSpace(ls(38));
          ctx.fillText(ln, mainX, mainY);
          mainY += ls(37);
        }
        mainY += ig(22);
        ctx.font = `600 ${fs(27)}px ${fonts.body}`;
        ctx.fillStyle = "#0F172A";
        if (data.declarationPlace.trim()) {
          ctx.fillText(`Place: ${data.declarationPlace}`, mainX, mainY);
        }
        const sigText = data.fullName || "Signature";
        const sigW = ctx.measureText(sigText).width;
        ctx.fillText(sigText, mainX + mainW - sigW, mainY);
        mainY += sg(34);
      }
    }

    return pages;
  }

  // =========================================================================
  // FULL-WIDTH & SPECIAL TEMPLATES (13 variants)
  // =========================================================================
  const tpl = data.template;
  const isCompact = tpl === "compact";
  const isAcademic = tpl === "academic";
  const isBoldBanner = tpl === "bold_banner";
  const isEsportsHud = tpl === "esports_hud";
  const isSportsCard = tpl === "sports_card";
  const isTimeline = tpl === "timeline";
  const isMinimalist = tpl === "minimalist";
  const isEditorial = tpl === "editorial";
  const isFrame = tpl === "two_tone_frame";
  const isBoxed = tpl === "boxed_cards";
  const isMonogram = tpl === "monogram";
  const isRibbon = tpl === "creative_ribbon";

  const marginX = s(isCompact ? 115 : isFrame ? 170 : 145);
  const marginTop = s(isCompact ? 110 : isBoldBanner || isEsportsHud || isSportsCard ? 85 : 140);
  const marginBottom = s(isFrame ? 145 : 120);
  const contentW = pageW - marginX * 2;
  const maxPages = 3;

  const paintPageChrome = (
    pageCtx: CanvasRenderingContext2D,
    isFirstPage: boolean
  ) => {
    if (tpl === "executive") {
      pageCtx.fillStyle = accent;
      pageCtx.fillRect(0, 0, pageW, isFirstPage ? s(26) : s(16));
    } else if (isEditorial) {
      pageCtx.fillStyle = accent;
      pageCtx.fillRect(0, 0, s(28), pageH);
    } else if (isFrame) {
      pageCtx.strokeStyle = accent;
      pageCtx.lineWidth = s(8);
      pageCtx.strokeRect(s(55), s(55), pageW - s(110), pageH - s(110));
      pageCtx.strokeStyle = hexToRgba(accent, 0.35);
      pageCtx.lineWidth = s(2);
      pageCtx.strokeRect(s(72), s(72), pageW - s(144), pageH - s(144));
    } else if (isRibbon && isFirstPage) {
      pageCtx.save();
      pageCtx.fillStyle = accent;
      pageCtx.beginPath();
      pageCtx.moveTo(0, 0);
      pageCtx.lineTo(s(360), 0);
      pageCtx.lineTo(0, s(220));
      pageCtx.closePath();
      pageCtx.fill();
      pageCtx.fillStyle = hexToRgba(accent, 0.16);
      pageCtx.beginPath();
      pageCtx.moveTo(pageW, pageH);
      pageCtx.lineTo(pageW - s(340), pageH);
      pageCtx.lineTo(pageW, pageH - s(190));
      pageCtx.closePath();
      pageCtx.fill();
      pageCtx.restore();
    }
  };

  const first = createPageCanvas();
  let ctx = first.ctx;
  paintPageChrome(ctx, true);
  let y = marginTop;

  const hasPhoto = Boolean(photoImg && data.showPhoto);
  const basePhotoSize = isCompact ? 235 : 275;
  const photoW = s(basePhotoSize * photoScale);
  const isSymmetricShape =
    data.photoShape === "circle" ||
    data.photoShape === "square" ||
    data.photoShape === "diamond" ||
    data.photoShape === "octagon" ||
    data.photoShape === "squircle";
  const photoH = isSymmetricShape
    ? photoW
    : s((isCompact ? 285 : 335) * photoScale);

  // HEADER BLOCK BY TEMPLATE
  if (isBoldBanner || isEsportsHud || isSportsCard) {
    // Full-bleed high-contrast banner header
    const bannerStartY = 0;
    const textW = hasPhoto ? contentW - photoW - s(55) : contentW;
    const padTop = s(85);
    const padBottom = s(68);

    // Measure wrapped header lines first so banner fits perfectly
    ctx.font = `800 ${fs(72)}px ${fonts.heading}`;
    const nameLines = wrapText(ctx, data.fullName || "Your Name", textW);
    ctx.font = `600 ${fs(34)}px ${fonts.heading}`;
    const titleLines = data.jobTitle.trim()
      ? wrapText(ctx, data.jobTitle, textW)
      : [];
    const joinedContact = contactParts.join("  ·  ");
    ctx.font = `500 ${fs(26)}px ${fonts.body}`;
    const contactLines = joinedContact
      ? wrapText(ctx, joinedContact, textW)
      : [];

    const textBlockH =
      nameLines.length * fs(78) +
      titleLines.length * fs(44) +
      (contactLines.length > 0 ? s(14) + contactLines.length * fs(35) : 0);
    const bannerH = Math.max(
      padTop + textBlockH + padBottom,
      hasPhoto ? padTop + photoH + padBottom : 0
    );

    if (isEsportsHud) {
      ctx.fillStyle = "#0B1120";
      ctx.fillRect(0, bannerStartY, pageW, bannerH);
      // Neon accent stripe + corner brackets
      ctx.fillStyle = accent;
      ctx.fillRect(0, bannerH - s(8), pageW, s(8));
      ctx.strokeStyle = accent;
      ctx.lineWidth = s(5);
      // Top-left & bottom-right HUD brackets
      ctx.beginPath();
      ctx.moveTo(s(50), s(95));
      ctx.lineTo(s(50), s(45));
      ctx.lineTo(s(130), s(45));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pageW - s(130), bannerH - s(36));
      ctx.lineTo(pageW - s(50), bannerH - s(36));
      ctx.lineTo(pageW - s(50), bannerH - s(86));
      ctx.stroke();
    } else if (isSportsCard) {
      ctx.fillStyle = accent;
      ctx.fillRect(0, bannerStartY, pageW, bannerH);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, bannerStartY, pageW, bannerH);
      // Dynamic diagonal athletic stripes on right
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let k = 0; k < 3; k++) {
        const sx = pageW - s(380) + k * s(88);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + s(48), 0);
        ctx.lineTo(sx - s(70), bannerH);
        ctx.lineTo(sx - s(118), bannerH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(0, bannerStartY, pageW, bannerH);
    }

    if (hasPhoto && photoImg) {
      const py = bannerStartY + (bannerH - photoH) / 2;
      drawClippedPhoto(
        ctx,
        photoImg,
        marginX + contentW - photoW,
        py,
        photoW,
        photoH,
        data.photoShape,
        isEsportsHud ? accent : "rgba(255,255,255,0.85)",
        photoBorderWidth,
        photoBorderStyle
      );
    }

    let ty = bannerStartY + padTop + fs(54);
    ctx.font = `800 ${fs(72)}px ${fonts.heading}`;
    ctx.fillStyle = "#FFFFFF";
    for (const ln of nameLines) {
      ctx.fillText(ln, marginX, ty);
      ty += fs(78);
    }
    if (titleLines.length > 0) {
      ctx.font = `600 ${fs(34)}px ${fonts.heading}`;
      ctx.fillStyle = isEsportsHud ? "#38BDF8" : "rgba(255,255,255,0.92)";
      for (const ln of titleLines) {
        ctx.fillText(ln, marginX, ty);
        ty += fs(44);
      }
    }
    if (contactLines.length > 0) {
      ty += s(10);
      ctx.font = `500 ${fs(26)}px ${fonts.body}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (const ln of contactLines) {
        ctx.fillText(ln, marginX, ty);
        ty += fs(35);
      }
    }

    y = bannerH + sg(58);
  } else if (isAcademic) {
    const textW = hasPhoto ? contentW - photoW - s(50) : contentW;
    const startHeaderY = y;
    if (hasPhoto && photoImg) {
      drawClippedPhoto(
        ctx,
        photoImg,
        marginX + contentW - photoW,
        y,
        photoW,
        photoH,
        data.photoShape,
        hexToRgba(accent, 0.4),
        photoBorderWidth,
        photoBorderStyle
      );
    }

    ctx.font = `800 ${fs(72)}px ${fonts.heading}`;
    ctx.fillStyle = accent;
    for (const ln of wrapText(ctx, data.fullName || "Your Name", textW)) {
      if (!hasPhoto) {
        const lw = ctx.measureText(ln).width;
        ctx.fillText(ln, marginX + (contentW - lw) / 2, y + fs(58));
      } else {
        ctx.fillText(ln, marginX, y + fs(58));
      }
      y += ls(76);
    }

    if (data.jobTitle.trim()) {
      ctx.font = `600 ${fs(35)}px ${fonts.heading}`;
      ctx.fillStyle = "#1E293B";
      for (const ln of wrapText(ctx, data.jobTitle, textW)) {
        if (!hasPhoto) {
          const lw = ctx.measureText(ln).width;
          ctx.fillText(ln, marginX + (contentW - lw) / 2, y + fs(34));
        } else {
          ctx.fillText(ln, marginX, y + fs(34));
        }
        y += ls(43);
      }
    }

    if (contactParts.length > 0) {
      y += s(12);
      const joined = contactParts.join("   |   ");
      ctx.font = `500 ${fs(27)}px ${fonts.body}`;
      ctx.fillStyle = "#475569";
      for (const ln of wrapText(ctx, joined, textW)) {
        if (!hasPhoto) {
          const lw = ctx.measureText(ln).width;
          ctx.fillText(ln, marginX + (contentW - lw) / 2, y + fs(26));
        } else {
          ctx.fillText(ln, marginX, y + fs(26));
        }
        y += ls(36);
      }
    }

    y = hasPhoto
      ? Math.max(y + s(24), startHeaderY + photoH + s(32))
      : y + s(24);
    ctx.fillStyle = accent;
    ctx.fillRect(marginX, y, contentW, s(6));
    y += s(10);
    ctx.fillStyle = hexToRgba(accent, 0.35);
    ctx.fillRect(marginX, y, contentW, s(2));
    y += sg(48);
  } else {
    // Standard / Frame / Monogram / Minimalist / Editorial / Compact / Timeline / Ribbon header
    const monogramShift = isMonogram ? s(145) : 0;
    const textW =
      (hasPhoto ? contentW - photoW - s(50) : contentW) - monogramShift;
    const headerStartY = y;

    if (isFrame) {
      ctx.fillStyle = hexToRgba(accent, 0.06);
      ctx.fillRect(marginX - s(24), y - s(26), contentW + s(48), s(280));
    }

    if (isMonogram) {
      const mx = marginX + s(58);
      const my = y + s(66);
      ctx.save();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(mx, my, s(58), 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `800 ${fs(44)}px ${fonts.heading}`;
      ctx.fillStyle = "#FFFFFF";
      const init = getInitials(data.fullName);
      const iw = ctx.measureText(init).width;
      ctx.fillText(init, mx - iw / 2, my + fs(15));
      ctx.restore();
    }

    if (hasPhoto && photoImg) {
      drawClippedPhoto(
        ctx,
        photoImg,
        marginX + contentW - photoW,
        y,
        photoW,
        photoH,
        data.photoShape,
        hexToRgba(accent, 0.4),
        photoBorderWidth,
        photoBorderStyle
      );
    }

    const nameX = marginX + monogramShift;
    ctx.font = `800 ${fs(isCompact ? 68 : 76)}px ${fonts.heading}`;
    ctx.fillStyle = "#0F172A";
    for (const ln of wrapText(ctx, data.fullName || "Your Name", textW)) {
      ctx.fillText(ln, nameX, y + fs(58));
      y += ls(isCompact ? 72 : 82);
    }

    if (data.jobTitle.trim()) {
      ctx.font = `600 ${fs(isCompact ? 33 : 37)}px ${fonts.heading}`;
      ctx.fillStyle = accent;
      for (const ln of wrapText(ctx, data.jobTitle, textW)) {
        ctx.fillText(ln, nameX, y + fs(28));
        y += ls(45);
      }
    }

    if (contactParts.length > 0) {
      y += s(10);
      const joined = contactParts.join("  ·  ");
      ctx.font = `500 ${fs(27)}px ${fonts.body}`;
      ctx.fillStyle = "#475569";
      for (const ln of wrapText(ctx, joined, textW)) {
        ctx.fillText(ln, nameX, y + fs(26));
        y += ls(37);
      }
    }

    y = hasPhoto
      ? Math.max(y + s(20), headerStartY + photoH + s(28))
      : y + s(20);

    if (isMinimalist) {
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(marginX, y, contentW, s(2));
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(marginX, y, contentW, s(isCompact ? 4 : 6));
    }
    y += sg(isCompact ? 40 : 48);
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - marginBottom && pages.length < maxPages) {
      const next = createPageCanvas();
      ctx = next.ctx;
      paintPageChrome(ctx, false);
      y = marginTop;
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(s(120));
    if (isAcademic || isSportsCard) {
      ctx.fillStyle = hexToRgba(accent, isSportsCard ? 0.12 : 0.08);
      ctx.fillRect(marginX, y - fs(30), contentW, fs(48));
      ctx.fillStyle = accent;
      ctx.fillRect(marginX, y - fs(30), s(12), fs(48));
      ctx.font = `700 ${fs(32)}px ${fonts.heading}`;
      ctx.fillText(title.toUpperCase(), marginX + s(28), y + fs(4));
      y += s(46);
    } else if (isEsportsHud) {
      ctx.font = `700 ${fs(32)}px ${fonts.heading}`;
      ctx.fillStyle = accent;
      ctx.fillText(`// ${title.toUpperCase()}`, marginX, y);
      y += s(14);
      ctx.fillStyle = hexToRgba(accent, 0.35);
      ctx.fillRect(marginX, y, contentW, s(3));
      ctx.fillStyle = accent;
      ctx.fillRect(marginX, y, s(140), s(5));
      y += s(40);
    } else if (isMinimalist) {
      ctx.font = `700 ${fs(30)}px ${fonts.heading}`;
      ctx.fillStyle = "#0F172A";
      ctx.fillText(title.toUpperCase(), marginX, y);
      y += s(34);
    } else {
      ctx.font = `700 ${fs(isCompact ? 30 : 34)}px ${fonts.heading}`;
      ctx.fillStyle = accent;
      ctx.fillText(title.toUpperCase(), marginX, y);
      y += s(14);
      ctx.fillStyle = "#CBD5E1";
      ctx.fillRect(marginX, y, contentW, s(3));
      y += s(isCompact ? 34 : 40);
    }
  };

  const baseLineStep = isCompact ? 36 : 41;
  const baseSectionGap = isCompact ? 26 : 36;

  for (const sec of data.sectionOrder) {
    if (!data.visibleSections[sec]) continue;

    if (sec === "summary" && data.summary.trim()) {
      drawSectionHeader(data.sectionTitles.summary);
      ctx.font = `400 ${fs(isCompact ? 28 : 30)}px ${fonts.body}`;
      const summaryLines = wrapText(
        ctx,
        data.summary,
        isEditorial ? contentW - s(44) : contentW
      );
      if (isEditorial) {
        const boxH = summaryLines.length * ls(baseLineStep) + s(28);
        ensureSpace(boxH + s(20));
        ctx.fillStyle = hexToRgba(accent, 0.06);
        drawRoundedRectPath(ctx, marginX, y - fs(26), contentW, boxH, s(12));
        ctx.fill();
      }
      ctx.fillStyle = "#334155";
      for (const ln of summaryLines) {
        ensureSpace(ls(baseLineStep + 10));
        ctx.fillText(ln, isEditorial ? marginX + s(22) : marginX, y);
        y += ls(baseLineStep);
      }
      y += sg(baseSectionGap);
    }

    if (sec === "experience" && data.experience.length > 0) {
      drawSectionHeader(data.sectionTitles.experience);
      for (const exp of data.experience) {
        ensureSpace(s(170));
        const itemLeftX = isTimeline ? marginX + s(46) : marginX;
        const itemW = isTimeline ? contentW - s(46) : contentW;

        if (isBoxed) {
          ctx.font = `400 ${fs(isCompact ? 27 : 29)}px ${fonts.body}`;
          const bulletCount = exp.bullets
            .split("\n")
            .filter((l) => l.trim()).length;
          const approxH = ls(41) + ls(40) + bulletCount * ls(42) + s(32);
          ctx.fillStyle = "#F8FAFC";
          drawRoundedRectPath(ctx, marginX, y - fs(30), contentW, approxH, s(12));
          ctx.fill();
          ctx.strokeStyle = hexToRgba(accent, 0.22);
          ctx.lineWidth = s(2);
          ctx.stroke();
        }

        if (isTimeline) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(marginX + s(14), y - fs(10), s(10), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hexToRgba(accent, 0.25);
          ctx.fillRect(marginX + s(12.5), y + s(4), s(3), s(110));
        }

        const innerPadX = isBoxed ? marginX + s(20) : itemLeftX;
        const innerDrawW = isBoxed ? contentW - s(40) : itemW;

        ctx.font = `700 ${fs(isCompact ? 31 : 34)}px ${fonts.heading}`;
        ctx.fillStyle = "#0F172A";
        ctx.fillText(exp.role || "Role", innerPadX, y);

        if (exp.period.trim()) {
          ctx.font = `600 ${fs(26)}px ${fonts.mono}`;
          ctx.fillStyle = "#475569";
          const pw = ctx.measureText(exp.period).width;
          ctx.fillText(exp.period, innerPadX + innerDrawW - pw, y);
        }
        y += ls(isCompact ? 37 : 41);

        const orgLine = [exp.organization, exp.location]
          .filter(Boolean)
          .join(" · ");
        if (orgLine) {
          ctx.font = `600 ${fs(28)}px ${fonts.body}`;
          ctx.fillStyle = accent;
          ctx.fillText(orgLine, innerPadX, y);
          y += ls(isCompact ? 36 : 40);
        }

        if (exp.bullets.trim()) {
          ctx.font = `400 ${fs(isCompact ? 27 : 29)}px ${fonts.body}`;
          for (const rawLine of exp.bullets.split("\n")) {
            const cleaned = rawLine.trim();
            if (!cleaned) continue;
            const isBullet =
              cleaned.startsWith("•") ||
              cleaned.startsWith("-") ||
              cleaned.startsWith("*");
            const textBody = isBullet
              ? cleaned.replace(/^[•\-*]\s*/, "")
              : cleaned;
            const wrapped = wrapText(ctx, textBody, innerDrawW - s(38));
            wrapped.forEach((wLine, idx) => {
              ensureSpace(ls(baseLineStep));
              if (idx === 0) {
                ctx.fillStyle = accent;
                ctx.fillText("•", innerPadX + s(6), y);
              }
              ctx.fillStyle = "#334155";
              ctx.fillText(wLine, innerPadX + s(34), y);
              y += ls(baseLineStep - 1);
            });
          }
        }
        y += ig(isCompact ? 20 : 28);
      }
      y += sg(10);
    }

    if (sec === "education" && data.education.length > 0) {
      drawSectionHeader(data.sectionTitles.education);
      for (const edu of data.education) {
        ensureSpace(s(110));
        const itemLeftX = isTimeline ? marginX + s(46) : marginX;
        const itemW = isTimeline ? contentW - s(46) : contentW;

        if (isTimeline) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(marginX + s(14), y - fs(10), s(9), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.font = `700 ${fs(isCompact ? 30 : 32)}px ${fonts.heading}`;
        ctx.fillStyle = "#0F172A";
        ctx.fillText(edu.degree || "Degree", itemLeftX, y);

        if (edu.year.trim()) {
          ctx.font = `600 ${fs(26)}px ${fonts.mono}`;
          ctx.fillStyle = "#475569";
          const yw = ctx.measureText(edu.year).width;
          ctx.fillText(edu.year, itemLeftX + itemW - yw, y);
        }
        y += ls(38);

        const instLine = [edu.institution, edu.grade]
          .filter(Boolean)
          .join("  ·  ");
        if (instLine) {
          ctx.font = `400 ${fs(28)}px ${fonts.body}`;
          ctx.fillStyle = "#475569";
          for (const ln of wrapText(ctx, instLine, itemW)) {
            ctx.fillText(ln, itemLeftX, y);
            y += ls(36);
          }
        }
        y += ig(isCompact ? 16 : 22);
      }
      y += sg(10);
    }

    if (sec === "skills" && data.skills.length > 0) {
      drawSectionHeader(data.sectionTitles.skills);
      if (isEsportsHud || isSportsCard || isRibbon) {
        // Draw visual pill tags wrapped nicely
        ctx.font = `600 ${fs(25)}px ${fonts.body}`;
        let px = marginX;
        const tagH = fs(42);
        const tagGapX = s(14);
        const tagGapY = ig(14);

        for (const skill of data.skills) {
          const textW = ctx.measureText(skill).width;
          const pillW = textW + s(34);
          if (px + pillW > marginX + contentW) {
            px = marginX;
            y += tagH + tagGapY;
            ensureSpace(tagH + tagGapY);
          }
          ctx.fillStyle = hexToRgba(accent, 0.1);
          drawRoundedRectPath(ctx, px, y - fs(30), pillW, tagH, s(10));
          ctx.fill();
          ctx.strokeStyle = hexToRgba(accent, 0.35);
          ctx.lineWidth = s(2);
          ctx.stroke();

          ctx.fillStyle = "#0F172A";
          ctx.fillText(skill, px + s(17), y - fs(2));
          px += pillW + tagGapX;
        }
        y += tagH + s(10);
      } else if (isCompact) {
        ctx.font = `500 ${fs(27)}px ${fonts.body}`;
        ctx.fillStyle = "#1E293B";
        for (const ln of wrapText(ctx, data.skills.join("   •   "), contentW)) {
          ensureSpace(ls(38));
          ctx.fillText(ln, marginX, y);
          y += ls(38);
        }
      } else {
        const colW = (contentW - s(40)) / 2;
        ctx.font = `500 ${fs(28)}px ${fonts.body}`;
        for (let i = 0; i < data.skills.length; i += 2) {
          ensureSpace(ls(44));
          const leftSkill = data.skills[i];
          const rightSkill = data.skills[i + 1];
          ctx.fillStyle = accent;
          ctx.fillText("▪", marginX, y);
          ctx.fillStyle = "#1E293B";
          ctx.fillText(leftSkill, marginX + s(28), y, colW - s(36));

          if (rightSkill) {
            ctx.fillStyle = accent;
            ctx.fillText("▪", marginX + colW + s(40), y);
            ctx.fillStyle = "#1E293B";
            ctx.fillText(
              rightSkill,
              marginX + colW + s(68),
              y,
              colW - s(36)
            );
          }
          y += ls(42);
        }
      }
      y += sg(baseSectionGap);
    }

    if (sec === "projects" && data.projects.length > 0) {
      drawSectionHeader(data.sectionTitles.projects);
      for (const proj of data.projects) {
        ensureSpace(s(120));
        ctx.font = `700 ${fs(30)}px ${fonts.heading}`;
        ctx.fillStyle = "#0F172A";
        ctx.fillText(proj.title, marginX, y);
        if (proj.subtitle.trim()) {
          ctx.font = `500 ${fs(25)}px ${fonts.mono}`;
          ctx.fillStyle = "#64748B";
          const sw = ctx.measureText(proj.subtitle).width;
          ctx.fillText(proj.subtitle, marginX + contentW - sw, y);
        }
        y += ls(38);
        if (proj.details.trim()) {
          ctx.font = `400 ${fs(28)}px ${fonts.body}`;
          ctx.fillStyle = "#334155";
          for (const ln of wrapText(ctx, proj.details, contentW)) {
            ensureSpace(ls(38));
            ctx.fillText(ln, marginX, y);
            y += ls(38);
          }
        }
        y += ig(20);
      }
      y += sg(8);
    }

    if (sec === "certifications" && data.certifications.length > 0) {
      drawSectionHeader(data.sectionTitles.certifications);
      for (const cert of data.certifications) {
        ensureSpace(s(65));
        ctx.font = `600 ${fs(28)}px ${fonts.body}`;
        ctx.fillStyle = "#0F172A";
        const leftText = cert.issuer
          ? `${cert.title} — ${cert.issuer}`
          : cert.title;
        ctx.fillText(`•  ${leftText}`, marginX, y, contentW - s(160));
        if (cert.year.trim()) {
          ctx.font = `500 ${fs(25)}px ${fonts.mono}`;
          ctx.fillStyle = "#475569";
          const yw = ctx.measureText(cert.year).width;
          ctx.fillText(cert.year, marginX + contentW - yw, y);
        }
        y += ls(40);
      }
      y += sg(baseSectionGap);
    }

    if (sec === "languages" && data.languages.trim()) {
      drawSectionHeader(data.sectionTitles.languages);
      ctx.font = `400 ${fs(28)}px ${fonts.body}`;
      ctx.fillStyle = "#334155";
      for (const ln of wrapText(ctx, data.languages, contentW)) {
        ensureSpace(ls(38));
        ctx.fillText(ln, marginX, y);
        y += ls(38);
      }
      y += sg(baseSectionGap);
    }

    if (sec === "declaration" && data.declarationText.trim()) {
      drawSectionHeader(data.sectionTitles.declaration);
      ctx.font = `400 ${fs(27)}px ${fonts.body}`;
      ctx.fillStyle = "#334155";
      for (const ln of wrapText(ctx, data.declarationText, contentW)) {
        ensureSpace(ls(38));
        ctx.fillText(ln, marginX, y);
        y += ls(38);
      }
      y += ig(24);
      ctx.font = `600 ${fs(27)}px ${fonts.body}`;
      ctx.fillStyle = "#0F172A";
      if (data.declarationPlace.trim()) {
        ctx.fillText(`Place: ${data.declarationPlace}`, marginX, y);
      }
      const sigName = data.fullName || "Signature";
      const sigW = ctx.measureText(sigName).width;
      ctx.fillText(sigName, marginX + contentW - sigW, y);
      y += sg(34);
    }
  }

  return pages;
}
